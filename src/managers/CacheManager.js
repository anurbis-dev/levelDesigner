import { Logger } from '../utils/Logger.js';
import { PERFORMANCE } from '../constants/EditorConstants.js';

/**
 * CacheManager - centralized cache management
 * Handles all caching logic for performance optimization
 * @version 3.42.0
 */
export class CacheManager {
    constructor(editor) {
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
     * Get object from cache or find it in level
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Found object or null
     */
    getCachedObject(objId) {
        if (this.objectCache.has(objId)) {
            return this.objectCache.get(objId);
        }

        // Try to find using fast index lookup first
        const obj = this.editor.level.findObjectById(objId);
        if (obj) {
            this.objectCache.set(objId, obj);
            return obj;
        }

        // Fallback: try to find in top-level objects (shouldn't reach here normally)
        const fallbackObj = this.editor.level.objects.find(o => o.id === objId);
        if (fallbackObj) {
            this.objectCache.set(objId, fallbackObj);
        }
        return fallbackObj || null;
    }

    /**
     * Get top-level object from cache or find it
     * @param {string} objId - Object ID to find
     * @returns {Object|null} Top-level object or null
     */
    getCachedTopLevelObject(objId) {
        if (this.topLevelObjectCache.has(objId)) {
            return this.topLevelObjectCache.get(objId);
        }

        const topLevelObj = this.editor.findTopLevelObject(objId);
        if (topLevelObj) {
            this.topLevelObjectCache.set(objId, topLevelObj);
        }
        return topLevelObj;
    }

    /**
     * Get effective layer ID from cache or calculate it
     * @param {Object} obj - Object to get layer ID for
     * @returns {string} Effective layer ID
     */
    getCachedEffectiveLayerId(obj) {
        if (this.effectiveLayerCache.has(obj.id)) {
            return this.effectiveLayerCache.get(obj.id);
        }

        // Calculate effective layer ID (with inheritance)
        const effectiveLayerId = this.editor.renderOperations 
            ? this.editor.renderOperations.getEffectiveLayerId(obj) 
            : obj.layerId;
        
        this.effectiveLayerCache.set(obj.id, effectiveLayerId);
        // Reverse index: layerId → Set<objId> (used by smartCacheInvalidation for per-layer eviction)
        let layerSet = this._layerToObjectIds.get(effectiveLayerId);
        if (!layerSet) { layerSet = new Set(); this._layerToObjectIds.set(effectiveLayerId, layerSet); }
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
        this.objectCache.delete(objId);
        this.topLevelObjectCache.delete(objId);
        this.effectiveLayerCache.delete(objId);
    }

    /**
     * Clear selectable objects cache
     */
    clearSelectableObjectsCache() {
        this.selectableObjectsCache.clear();
        this.selectableObjectsCacheTimestamp = 0;
    }

    /**
     * Get selectable objects in current viewport with caching
     * @returns {Set<string>} Set of object IDs that are selectable in viewport
     */
    getSelectableObjectsInViewport() {
        const camera = this.editor.stateManager.get('camera');
        const cameraKey = `${camera.x}_${camera.y}_${camera.zoom}`;
        const currentTime = performance.now();

        // Check cache first
        if (this.selectableObjectsCache.has(cameraKey) &&
            currentTime - this.selectableObjectsCacheTimestamp < this.selectableCacheTimeout) {
            return this.selectableObjectsCache.get(cameraKey);
        }

        const selectableObjects = this.editor.objectOperations.computeSelectableSet();
        const selectableInViewport = new Set();

        const renderOps = this.editor.renderOperations;
        if (renderOps && renderOps.spatialIndex.size > 0) {
            // Fast path: spatial index already knows which objects are in viewport (O(k), k ≪ N)
            const viewportObjects = renderOps.getVisibleObjectsSpatial(camera);
            viewportObjects.forEach(item => {
                if (selectableObjects.has(item.obj.id)) selectableInViewport.add(item.obj.id);
            });
        } else {
            // Fallback: AABB check against viewport for every selectable object
            const canvas = this.editor.canvasRenderer.canvas;
            const zoom = camera.zoom || 1;
            const viewportLeft = camera.x;
            const viewportTop = camera.y;
            const viewportRight = camera.x + canvas.width / zoom;
            const viewportBottom = camera.y + canvas.height / zoom;

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
                const objIds = this._layerToObjectIds.get(layerId);
                if (objIds) {
                    objIds.forEach(objId => this.effectiveLayerCache.delete(objId));
                    this._layerToObjectIds.delete(layerId);
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
