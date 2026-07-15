import { Logger } from '../utils/Logger.js';
import { PERFORMANCE } from '../constants/EditorConstants.js';
import { BaseManager } from './BaseManager.js';

/**
 * CacheManager - centralized cache management
 * Handles all caching logic for performance optimization
 * @version 3.42.0
 */
export class CacheManager extends BaseManager {
    constructor(editor) {
        super();
        this.editor = editor;
        
        // Performance optimization caches
        this.objectCache = new Map(); // Cache for object lookups: objId -> object
        this.topLevelObjectCache = new Map(); // Cache for top-level object lookups: objId -> topLevelObject
        this.effectiveLayerCache = new Map(); // Cache for effective layer IDs: objId -> effectiveLayerId
        this._layerToObjectIds = new Map(); // Reverse index: effectiveLayerId -> Set<objId> (for per-layer invalidation)
        this.selectableObjectsCache = new Map(); // Cache for selectable objects in viewport: cameraKey -> Set<objectIds>
        this.selectableObjectsCacheTimestamp = 0;
        this.cacheInvalidationTimeout = null;
        
        // Cache timeout for selectable objects (ms)
        this.selectableCacheTimeout = 200;
        
        Logger.lifecycle.info('CacheManager initialized');
    }

    /**
     * Namespace a bare objId/layerId by the current level, so that two open levels
     * whose independent id counters both produced e.g. "1" can never collide in these
     * caches. All of objectCache/topLevelObjectCache/effectiveLayerCache/_layerToObjectIds
     * are current-level-scoped by design (Outliner/DetailsPanel/ObjectOperations etc. only
     * ever read/write the current level) — keying by editor.currentLevelId at lookup time
     * makes that scoping explicit without needing to change any of their many call sites.
     * @param {string} id - bare object or layer id
     * @returns {string} namespaced cache key
     */
    _namespacedKey(id) {
        return `${this.editor.currentLevelId}:${id}`;
    }

    /**
     * Get object from cache or find it in level
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Found object or null
     */
    getCachedObject(objId) {
        const key = this._namespacedKey(objId);
        if (this.objectCache.has(key)) {
            return this.objectCache.get(key);
        }

        // Try to find using fast index lookup first
        const obj = this.editor.level.findObjectById(objId);
        if (obj) {
            this.objectCache.set(key, obj);
            return obj;
        }

        // Fallback: try to find in top-level objects (shouldn't reach here normally)
        const fallbackObj = this.editor.level.objects.find(o => o.id === objId);
        if (fallbackObj) {
            this.objectCache.set(key, fallbackObj);
        }
        return fallbackObj || null;
    }

    /**
     * Get top-level object from cache or find it
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Top-level object or null
     */
    getCachedTopLevelObject(objId) {
        const key = this._namespacedKey(objId);
        if (this.topLevelObjectCache.has(key)) {
            return this.topLevelObjectCache.get(key);
        }

        const topLevelObj = this.editor.findTopLevelObject(objId);
        if (topLevelObj) {
            this.topLevelObjectCache.set(key, topLevelObj);
        }
        return topLevelObj;
    }

    /**
     * Get effective layer ID from cache or calculate it
     * @param {Object} obj - Object to get layer ID for
     * @returns {string} Effective layer ID
     */
    getCachedEffectiveLayerId(obj) {
        const key = this._namespacedKey(obj.id);
        if (this.effectiveLayerCache.has(key)) {
            return this.effectiveLayerCache.get(key);
        }

        // Calculate effective layer ID (with inheritance)
        const effectiveLayerId = this.editor.renderOperations
            ? this.editor.renderOperations.getEffectiveLayerId(obj)
            : obj.layerId;

        this.effectiveLayerCache.set(key, effectiveLayerId);
        // Reverse index: namespaced layerId → Set<objId> (used by smartCacheInvalidation
        // for per-layer eviction) — objId stored bare since it's only ever deleted back
        // out of effectiveLayerCache via the same _namespacedKey() below.
        const layerKey = this._namespacedKey(effectiveLayerId);
        let layerSet = this._layerToObjectIds.get(layerKey);
        if (!layerSet) { layerSet = new Set(); this._layerToObjectIds.set(layerKey, layerSet); }
        layerSet.add(obj.id);
        return effectiveLayerId;
    }

    /**
     * Clear all caches (call when level changes or objects are modified)
     */
    clearCaches() {
        this.objectCache.clear();
        this.topLevelObjectCache.clear();
        this.effectiveLayerCache.clear();
        this._layerToObjectIds.clear();
        this.clearSelectableObjectsCache();
    }

    /**
     * Invalidate specific object caches (call when object is modified)
     * @param {string} objId - Object ID to invalidate
     */
    invalidateObjectCaches(objId) {
        const key = this._namespacedKey(objId);
        this.objectCache.delete(key);
        this.topLevelObjectCache.delete(key);
        this.effectiveLayerCache.delete(key);
    }

    /**
     * Clear selectable objects cache
     */
    clearSelectableObjectsCache() {
        this.selectableObjectsCache.clear();
        this.selectableObjectsCacheTimestamp = 0;
    }

    /**
     * Active camera + canvas for pick/marquee frustum (multi-viewport).
     * Falls back to stateManager.camera + primary canvas.
     * @returns {{ camera: {x:number,y:number,zoom:number}, canvas: HTMLCanvasElement|null, leafId: string }}
     */
    _resolvePickViewport() {
        const mh = this.editor.mouseHandlers;
        const vvm = this.editor.viewportViewManager;
        const view = mh?.getInteractionView?.() || vvm?.getFocusedView?.() || vvm?.getPrimaryView?.();
        const camera = (mh?.getInteractionCamera?.()
            || (view && vvm?.resolveCamera?.(view))
            || this.editor.stateManager.get('camera')
            || { x: 0, y: 0, zoom: 1 });
        const canvas = view?.canvas
            || mh?.getInteractionCanvas?.()
            || this.editor.canvasRenderer?.primaryCanvas
            || this.editor.canvasRenderer?.canvas
            || null;
        return {
            camera,
            canvas,
            leafId: view?.leafId || 'primary'
        };
    }

    /**
     * Get selectable objects in the interaction viewport with caching.
     * Must use the same camera/canvas as click/marquee (not only primary stateManager.camera),
     * otherwise multi-view or CSS-scaled canvases drop valid hit-test candidates.
     * @returns {Set<string>} Set of object IDs that are selectable in viewport
     */
    getSelectableObjectsInViewport() {
        const { camera, canvas, leafId } = this._resolvePickViewport();
        const zoom = camera?.zoom > 0 ? camera.zoom : 1;
        const cw = canvas?.width || 0;
        const ch = canvas?.height || 0;
        const cameraKey = `${leafId}_${camera.x}_${camera.y}_${zoom}_${cw}x${ch}`;
        const currentTime = performance.now();

        // Check cache first
        if (this.selectableObjectsCache.has(cameraKey) &&
            currentTime - this.selectableObjectsCacheTimestamp < this.selectableCacheTimeout) {
            return this.selectableObjectsCache.get(cameraKey);
        }

        const selectableObjects = this.editor.objectOperations.computeSelectableSet();
        const selectableInViewport = new Set();

        const renderOps = this.editor.renderOperations;
        // Check the CURRENT level's own entry specifically — spatialIndex is now
        // Map<levelId,...> (multi-level), so a non-empty Map no longer implies the
        // current level's index exists (another open level's might be the only one built).
        if (renderOps && renderOps.spatialIndex.has(this.editor.level?.id) && cw > 0 && ch > 0) {
            // Fast path: spatial index already knows which objects are in viewport (O(k), k ≪ N)
            // Temporarily ensure spatial query uses interaction camera (and canvas size via
            // getVisibleObjects which reads canvasRenderer.canvas dimensions).
            const cr = this.editor.canvasRenderer;
            const prev = cr?.canvas;
            if (canvas && cr) cr.setTarget(canvas);
            try {
                const viewportObjects = renderOps.getVisibleObjectsSpatial(camera);
                viewportObjects.forEach(item => {
                    if (selectableObjects.has(item.obj.id)) selectableInViewport.add(item.obj.id);
                });
            } finally {
                if (prev && cr && prev !== canvas) cr.setTarget(prev);
            }
        } else {
            // Fallback: AABB check against viewport for every selectable object
            const z = zoom;
            const viewportLeft = camera.x;
            const viewportTop = camera.y;
            const viewportRight = camera.x + (cw || 1) / z;
            const viewportBottom = camera.y + (ch || 1) / z;

            selectableObjects.forEach(objId => {
                const obj = this.getCachedObject(objId);
                if (!obj) return;
                const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
                if (!bounds) return;
                const intersects = !(
                    bounds.maxX < viewportLeft ||
                    bounds.minX > viewportRight ||
                    bounds.maxY < viewportTop ||
                    bounds.minY > viewportBottom
                );
                if (intersects) selectableInViewport.add(objId);
            });
        }

        // Cache the result
        this.selectableObjectsCache.set(cameraKey, selectableInViewport);
        this.selectableObjectsCacheTimestamp = currentTime;

        // Clean old cache entries (keep max 5)
        if (this.selectableObjectsCache.size > 5) {
            const oldestKey = this.selectableObjectsCache.keys().next().value;
            this.selectableObjectsCache.delete(oldestKey);
        }

        return selectableInViewport;
    }

    /**
     * Smart cache invalidation - invalidates only necessary caches
     * @param {Object} invalidationSpec - Specification of what to invalidate
     */
    smartCacheInvalidation(invalidationSpec = {}) {
        const {
            objectIds = new Set(),
            layerIds = new Set(),
            invalidateAll = false,
            reason = 'unknown'
        } = invalidationSpec;

        if (invalidateAll) {
            // Full invalidation (fallback for complex cases)
            this.scheduleCacheInvalidation();
            return;
        }

        // Selective invalidation for changed objects
        if (objectIds.size > 0) {
            objectIds.forEach(objId => {
                this.invalidateObjectCaches(objId);
            });

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.cache.debug(`Smart invalidation: ${objectIds.size} objects (${reason})`);
            }
        }

        // Clear selectable objects cache when objects or layers change
        if (objectIds.size > 0 || layerIds.size > 0) {
            this.clearSelectableObjectsCache();
        }

        // Clear visible objects cache when objects or layers change (affects stacking/rendering order)
        if (objectIds.size > 0 || layerIds.size > 0) {
            if (this.editor && this.editor.renderOperations && typeof this.editor.renderOperations.clearVisibleObjectsCache === 'function') {
                this.editor.renderOperations.clearVisibleObjectsCache();
            }
        }

        // If layer IDs are affected, evict only objects that belong to those layers
        if (layerIds.size > 0) {
            layerIds.forEach(layerId => {
                const layerKey = this._namespacedKey(layerId);
                const objIds = this._layerToObjectIds.get(layerKey);
                if (objIds) {
                    objIds.forEach(objId => this.effectiveLayerCache.delete(this._namespacedKey(objId)));
                    this._layerToObjectIds.delete(layerKey);
                } else {
                    // Reverse index not warmed for this layer — full clear as safe fallback
                    this.effectiveLayerCache.clear();
                    this._layerToObjectIds.clear();
                }
            });

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.cache.debug(`Per-layer effectiveLayerCache eviction: ${layerIds.size} layers (${reason})`);
            }
        }
    }

    /**
     * Invalidate caches after layer changes
     * @param {Set} changedObjectIds - ID of objects whose layers changed
     * @param {Set} affectedLayers - ID of layers that were affected
     */
    invalidateAfterLayerChanges(changedObjectIds, affectedLayers) {
        this.smartCacheInvalidation({
            objectIds: changedObjectIds,
            layerIds: affectedLayers,
            reason: 'layer_changes'
        });
    }

    /**
     * Invalidate caches after group operations
     * @param {Set} affectedObjectIds - ID of objects that were affected
     */
    invalidateAfterGroupOperations(affectedObjectIds) {
        this.smartCacheInvalidation({
            objectIds: affectedObjectIds,
            invalidateAll: false,
            reason: 'group_operations'
        });
    }

    /**
     * Invalidate caches after duplicate operations
     * @param {Set} newObjectIds - ID of new objects
     */
    invalidateAfterDuplicateOperations(newObjectIds) {
        this.smartCacheInvalidation({
            objectIds: newObjectIds,
            reason: 'duplicate_operations'
        });
    }

    /**
     * Legacy method for full cache invalidation (kept for compatibility)
     * Schedules a full cache clear with debouncing
     */
    scheduleCacheInvalidation() {
        if (this.cacheInvalidationTimeout) {
            clearTimeout(this.cacheInvalidationTimeout);
        }

        this.cacheInvalidationTimeout = setTimeout(() => {
            this.clearCaches();
            this.clearSelectableObjectsCache();
            this.editor.level.clearLayerCountsCache();
            this.editor.level.clearObjectsIndex();

            // Mark spatial index dirty — lazy rebuild on next render
            if (this.editor.renderOperations) {
                this.editor.renderOperations.markSpatialIndexDirty();
            }

            if (Logger.currentLevel <= Logger.LEVELS.DEBUG) {
                Logger.cache.debug('Full cache invalidation completed');
            }

            this.cacheInvalidationTimeout = null;
        }, PERFORMANCE.CACHE_TIMEOUT_MS);
    }

    /**
     * Cleanup method
     */
    destroy() {
        if (this.cacheInvalidationTimeout) {
            clearTimeout(this.cacheInvalidationTimeout);
            this.cacheInvalidationTimeout = null;
        }
        
        this.clearCaches();
        
        Logger.lifecycle.info('CacheManager destroyed');
    }
}
