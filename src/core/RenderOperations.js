import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { ParallaxRenderer } from '../utils/ParallaxRenderer.js';
import { RenderUtils } from '../utils/RenderUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';
import { PERFORMANCE, CAMERA } from '../constants/EditorConstants.js';
import { WorldPositionUtils } from '../utils/WorldPositionUtils.js';
import { throttle } from '../utils/PerformanceUtils.js';
import { refreshAllViewportInfoOverlays } from '../ui/dock/ViewportInfoOverlay.js';

/**
 * Render Operations module for LevelEditor
 * Handles all rendering operations
 */
export class RenderOperations extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization caches
        this.visibleObjectsCache = new Map();
        this.cacheTimeout = PERFORMANCE.CACHE_TIMEOUT_MS;

        // Layer visibility cache for performance — Map<levelId, {layerIds: Set, timestamp}>,
        // namespaced per level so a layer-visibility change in one open level never leaks
        // into (or gets clobbered by) another's cached result — see getVisibleLayerIds().
        this.visibleLayersCache = new Map();

        // Пространственный индекс для быстрого поиска объектов в области видимости
        this.spatialIndex = new Map(); // levelId -> {grid, bounds, lastUpdate}
        this.spatialGridSize = PERFORMANCE.SPATIAL_GRID_SIZE;
        this.isBuildingSpatialIndex = false; // Флаг для предотвращения повторного построения
        this._spatialIndexDirty = false; // Отложенный rebuild: стройт только в getVisibleObjectsSpatial

        // Кеш для разных уровней масштаба камеры
        this.zoomLevelCache = new Map(); // zoom -> cachedObjects
        this.lastZoomLevel = null;

        // Parallax renderer
        this.parallaxRenderer = new ParallaxRenderer(levelEditor);
        
        // Performance monitoring
        this.lastRenderTime = 0;
        this.lastRenderDuration = 0;
        
        // Throttled slow frame logging (max once per 2 seconds to avoid console spam)
        this._throttledSlowFrameLog = throttle((renderTime, renderCount) => {
            Logger.render.warn(`🐌 Slow frame: ${renderTime.toFixed(2)}ms (${renderCount})`);
        }, 2000);
    }

    /**
     * Построение пространственного индекса для быстрого поиска объектов
     * O(N) - вызывается при изменении уровня или добавлении/удалении объектов
     */
    buildSpatialIndex(level = this.editor.level) {
        // Проверки на существование необходимых объектов
        if (!this.editor || !level || !level.objects) {
            Logger.render.warn('Cannot build spatial index: missing required objects');
            return;
        }

        // Предотвращаем повторное построение индекса
        if (this.isBuildingSpatialIndex) {
            return;
        }

        // Get level ID
        const levelId = level?.id || 'default';

        this.isBuildingSpatialIndex = true;

        const objects = level?.objects || [];

        // Создаем сетку для индексации
        const grid = new Map(); // 'x,y' -> Set of objects

        // Вычисляем границы всех объектов
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            if (!obj.visible) {
                return; // Тихо пропускаем невидимые объекты
            }

            // Получаем мировые границы объекта (в дереве ПЕРЕДАННОГО level, не обязательно
            // текущего — critical для composited spatial index не-текущих видимых уровней)
            const bounds = this.editor.objectOperations.getObjectWorldBounds(obj, [], level);

            if (!bounds) {
                return;
            }

            // Проверяем валидность границ
            if (bounds.minX === bounds.maxX || bounds.minY === bounds.maxY) {
                return;
            }

            // Проверяем на NaN или бесконечность
            if (!isFinite(bounds.minX) || !isFinite(bounds.minY) || !isFinite(bounds.maxX) || !isFinite(bounds.maxY)) {
                return;
            }

            // Проверяем на нулевые размеры
            if (bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
                return;
            }

            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);

            // Добавляем объект во все ячейки сетки, которые он пересекает
            const startGridX = Math.floor(bounds.minX / this.spatialGridSize);
            const endGridX = Math.floor(bounds.maxX / this.spatialGridSize);
            const startGridY = Math.floor(bounds.minY / this.spatialGridSize);
            const endGridY = Math.floor(bounds.maxY / this.spatialGridSize);

            // Убеждаемся, что объект попадает хотя бы в одну ячейку
            let cellsAdded = 0;
            for (let gridX = startGridX; gridX <= endGridX; gridX++) {
                for (let gridY = startGridY; gridY <= endGridY; gridY++) {
                    const key = `${gridX},${gridY}`;
                    if (!grid.has(key)) {
                        grid.set(key, new Set());
                    }
                    grid.get(key).add(obj);
                    cellsAdded++;
                }
            }

            // Если объект не попал ни в одну ячейку, добавляем в ближайшую
            if (cellsAdded === 0) {
                const centerX = (bounds.minX + bounds.maxX) / 2;
                const centerY = (bounds.minY + bounds.maxY) / 2;
                const gridX = Math.floor(centerX / this.spatialGridSize);
                const gridY = Math.floor(centerY / this.spatialGridSize);
                const key = `${gridX},${gridY}`;
                if (!grid.has(key)) {
                    grid.set(key, new Set());
                }
                grid.get(key).add(obj);
                cellsAdded++;
            }
        });

        // Сохраняем индекс
        this.spatialIndex.set(levelId, {
            grid,
            bounds: { minX, minY, maxX, maxY },
            lastUpdate: performance.now()
        });

        const totalGridCells = grid.size;

        Logger.render.info(`Spatial index built: ${objects.length} objects → ${totalGridCells} grid cells`);

        // Логируем только если есть проблемы
        if (objects.length > 0 && totalGridCells === 0) {
            Logger.render.warn(`Spatial index built but no grid cells created for ${objects.length} objects`);
        }

        this.isBuildingSpatialIndex = false;

    }

    /**
     * Invalidate spatial index for a level (defaults to the current level — this is
     * what every existing call site actually wants: an edit that just happened on
     * editor.level). Pass an explicit levelId to invalidate a different/closed level
     * (e.g. LevelsManager.closeLevel(), Phase 5).
     *
     * NOTE: this used to be two separate method definitions with the same name (a
     * duplicate silently shadowed the other) — merged into one during Phase 3's
     * multi-level render work since it directly overlaps with spatial-index-per-level.
     * @param {string|null} levelId - Level ID to invalidate; defaults to editor.level's id
     */
    invalidateSpatialIndex(levelId = null) {
        const targetId = levelId || this.editor?.level?.id || 'default';
        this.spatialIndex.delete(targetId);
        this.isBuildingSpatialIndex = false; // Reset flag in case build was interrupted
    }

    /**
     * Пометить spatial index устаревшим — перестройка произойдёт лениво в getVisibleObjectsSpatial.
     * Используется вместо прямого buildSpatialIndex() при batch/операциях вне render-loop.
     */
    markSpatialIndexDirty() {
        this._spatialIndexDirty = true;
    }

    /**
     * Shared preamble for getVisibleObjectsSpatial/getVisibleObjectsRegular/getVisibleObjects:
     * validates editor/level/canvasRenderer/canvas/camera.zoom, returns the canvas or null.
     */
    _getValidCanvasOrNull(camera, level) {
        if (!this.editor || !level || !level.objects) return null;
        if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) return null;
        const canvas = this.editor.canvasRenderer.canvas;
        if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) return null;
        if (!camera.zoom || camera.zoom <= 0) return null;
        return canvas;
    }

    /**
     * Viewport bounds extended by culling padding (plus parallax-offset padding when
     * parallax is enabled) — shared by getVisibleObjectsSpatial/getVisibleObjectsRegular.
     */
    _computeExtendedViewportBounds(camera, canvas) {
        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + canvas.width / camera.zoom;
        const viewportBottom = camera.y + canvas.height / camera.zoom;

        let padding = 100;
        if (this.parallaxRenderer.isParallaxEnabled()) {
            // Расширяем область на максимальное возможное параллакс смещение
            // Предполагаем максимальный коэффициент параллакса ±10
            const parallaxRange = Math.abs(camera.x - (this.parallaxRenderer.getParallaxState()?.startPosition?.x || 0)) * 10;
            padding = Math.max(padding, parallaxRange + 200); // +200 для безопасности
        }

        return {
            left: viewportLeft - padding,
            top: viewportTop - padding,
            right: viewportRight + padding,
            bottom: viewportBottom + padding
        };
    }

    /**
     * Быстрый поиск объектов в области видимости с помощью пространственного индекса
     * O(k) - где k - количество ячеек сетки в области видимости
     */
    getVisibleObjectsSpatial(camera, level = this.editor.level) {
        const canvas = this._getValidCanvasOrNull(camera, level);
        if (!canvas) return [];

        // _spatialIndexDirty only ever tracks the current level's index going stale
        // (see markSpatialIndexDirty callers) — only rebuild eagerly for that case.
        if (this._spatialIndexDirty && level === this.editor.level) {
            this.buildSpatialIndex(level);
            this._spatialIndexDirty = false;
        }

        const levelId = level?.id || 'default';
        let spatialData = this.spatialIndex.get(levelId);

        if (!spatialData) {
            // Попытка автоматически построить индекс, если он не найден
            try {
                this.buildSpatialIndex(level);
                spatialData = this.spatialIndex.get(levelId);
                if (!spatialData) {
                    return this.getVisibleObjectsRegular(camera, level);
                }
            } catch (error) {
                return this.getVisibleObjectsRegular(camera, level);
            }
        }

        const { left: extendedLeft, top: extendedTop, right: extendedRight, bottom: extendedBottom } =
            this._computeExtendedViewportBounds(camera, canvas);

        // Находим ячейки сетки, которые пересекают область видимости
        const startGridX = Math.floor(extendedLeft / this.spatialGridSize);
        const endGridX = Math.floor(extendedRight / this.spatialGridSize);
        const startGridY = Math.floor(extendedTop / this.spatialGridSize);
        const endGridY = Math.floor(extendedBottom / this.spatialGridSize);

        // Собираем объекты из найденных ячеек
        const candidates = new Set();

        for (let gridX = startGridX; gridX <= endGridX; gridX++) {
            for (let gridY = startGridY; gridY <= endGridY; gridY++) {
                const key = `${gridX},${gridY}`;
                const cellObjects = spatialData.grid.get(key);
                if (cellObjects) {
                    cellObjects.forEach(obj => candidates.add(obj));
                }
            }
        }

        // Фильтруем кандидаты по точным критериям видимости
        const visibleLayerIds = this.getVisibleLayerIds(level);

        // Use common method to collect visible objects recursively
        // First filter candidates by layer visibility and basic viewport check
        const filteredCandidates = Array.from(candidates).filter(obj => {
            const effectiveLayerId = this.getEffectiveLayerId(obj, level);
            return visibleLayerIds.has(effectiveLayerId) && obj.visible;
        });

        // Then use common recursive method for detailed collection
        return this.collectVisibleObjectsRecursive(
            filteredCandidates,
            visibleLayerIds,
            extendedLeft, extendedTop, extendedRight, extendedBottom,
            0, 0, level
        );
    }


    /**
     * Render all viewport views (multi-camera). Falls back to single primary canvas.
     */
    render() {
        const renderStart = performance.now();
        if (!this.renderCount) this.renderCount = 0;
        this.renderCount++;

        if (!this.editor || !this.editor.level || !this.editor.level.objects) return;
        if (!this.editor.canvasRenderer || !this.editor.stateManager) return;

        const vvm = this.editor.viewportViewManager;
        const views = vvm && vvm.views && vvm.views.size > 0 ? vvm.getViews() : null;

        if (!views) {
            const camera = this.editor.stateManager.get('camera');
            if (!camera?.zoom || camera.zoom <= 0) return;
            const canvas = this.editor.canvasRenderer.canvas;
            if (!canvas?.width || !canvas?.height) return;
            this._renderFrame(camera, null, true);
        } else {
            const focusedId = vvm.getFocusedView()?.leafId;
            for (const view of views) {
                if (!view.canvas?.width || !view.canvas?.height) {
                    vvm.resizeView(view.leafId);
                }
                if (!view.canvas?.width || !view.canvas?.height) continue;
                const camera = vvm.resolveCamera(view);
                if (!camera?.zoom || camera.zoom <= 0) continue;
                this.editor.canvasRenderer.setTarget(view.canvas);
                // Marquee / touch marquee only on the interaction leaf (not primary-always)
                const overlayLeaf = this.editor.mouseHandlers?._interactionViewLeafId || focusedId;
                this._renderFrame(camera, view, view.leafId === overlayLeaf);
            }
            this.editor.canvasRenderer.restorePrimaryTarget();
        }

        // VP-OVL: DOM HUD blocks (camera/zoom/flags/stats) — cheap text updates only
        refreshAllViewportInfoOverlays(this.editor);

        const renderTime = performance.now() - renderStart;
        this.lastRenderDuration = renderTime;
        this.lastRenderTime = performance.now();
        if (renderTime > 16) {
            this._throttledSlowFrameLog(renderTime, this.renderCount);
        }
    }

    /**
     * Draw one viewport frame onto the current canvasRenderer target.
     * @param {{x:number,y:number,zoom:number}} camera
     * @param {object|null} view - ViewportView or null (legacy)
     * @param {boolean} drawInteractiveOverlays - marquee / touch marquee
     */
    _renderFrame(camera, view, drawInteractiveOverlays) {
        const vvm = this.editor.viewportViewManager;
        const mouse = this.editor.stateManager.get('mouse');
        const canvas = this.editor.canvasRenderer.canvas;
        if (!canvas?.width || !canvas?.height || !camera?.zoom) return;

        this.editor.canvasRenderer.clear();
        this.editor.canvasRenderer.setCamera(camera);
        
        // Draw background and grid
        const showGrid = view && vvm
            ? vvm.getDisplayFlag(view, 'showGrid')
            : (this.editor.stateManager.get('canvas.showGrid') ?? this.editor.level.settings.showGrid);
        if (showGrid) {
            // Get grid parameters using centralized SnapUtils
            const gridSize = SnapUtils.getGridSize(this.editor.stateManager, this.editor.level);
            const gridColor = this.editor.stateManager.get('canvas.gridColor') ?? this.editor.level.settings.gridColor ?? 'rgba(255, 255, 255, 0.1)';
            const gridThickness = this.editor.stateManager.get('canvas.gridThickness') ?? 1;
            const gridOpacity = this.editor.stateManager.get('canvas.gridOpacity') ?? 0.1;
            const gridSubdivisions = this.editor.stateManager.get('canvas.gridSubdivisions') ?? 4;
            const gridSubdivColor = this.editor.stateManager.get('canvas.gridSubdivColor') ?? '#666666';
            const gridSubdivThickness = this.editor.stateManager.get('canvas.gridSubdivThickness') ?? 0.5;
            const gridType = this.editor.stateManager.get('canvas.gridType') ?? 'rectangular';
            const hexOrientation = this.editor.stateManager.get('canvas.hexOrientation') ?? 'pointy';




            // Get canvas background color from StateManager
            const canvasBackgroundColor = this.editor.stateManager.get('canvas.backgroundColor') || this.editor.level.settings.backgroundColor || '#4b5563';
            
            this.editor.canvasRenderer.drawGrid(
                gridSize,
                camera,
                canvasBackgroundColor,
                {
                    color: gridColor,
                    thickness: gridThickness,
                    opacity: gridOpacity,
                    subdivisions: gridSubdivisions,
                    subdivColor: gridSubdivColor,
                    subdivThickness: gridSubdivThickness,
                    gridType: gridType,
                    hexOrientation: hexOrientation
                }
            );
        } else {
            // Just draw background without grid
            this.editor.canvasRenderer.clear();
            this.editor.canvasRenderer.ctx.fillStyle = this.editor.level.settings.backgroundColor;
            this.editor.canvasRenderer.ctx.fillRect(0, 0, this.editor.canvasRenderer.canvas.width, this.editor.canvasRenderer.canvas.height);
        }
        
        // Draw objects with frustum culling — composited across every visible level (see
        // LevelsManager.getVisibleSessions()), not just the current one. Dimming modes
        // below (group-edit/isolate/solo) are UI state scoped to the current level only —
        // they never dim or hide another visible level's objects (plan section 2.2).
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const currentLevel = this.editor.level;

        // In group edit mode, compute selectable + excluded sets once for grayscale pass.
        // Dimming rule (applied per top-level object, which renders its whole subtree):
        //   - NOT dimmed: objects in selectableSet (direct children of active group, external selectable)
        //   - NOT dimmed: excluded (active group itself + its ancestors) — they contain the
        //                 active group's content which must render normally
        //   - DIMMED:     everything else (non-selectable external objects, non-selectable layers)
        let selectableSet = null;
        let excludedSet = null;
        if (groupEditMode && groupEditMode.isActive) {
            selectableSet = this.editor.objectOperations.computeSelectableSet();
            excludedSet   = this.editor.objectOperations._buildGroupEditExclusionSet();
        }

        // Isolate mode (`/`, see ObjectOperations.toggleIsolateSelection): dim every
        // top-level object/group that isn't part of the isolated branch. Reuses the same
        // dim treatment as group-edit-mode above rather than a separate hide mechanism.
        const isolatedTopLevelIds = this.editor.stateManager.get('view.isolatedTopLevelIds');

        // Object Solo (Ctrl+click an eye icon in the Outliner, see ObjectOperations.
        // toggleObjectSolo): unlike Isolate, this is a real hide (not a dim) of every other
        // top-level object, matching the eye-icon affordance. Filtering only at the top level
        // means a soloed group's own children render exactly as normal — no special-casing
        // needed for "the group's children stay visible". NOTE: this is global StateManager
        // state, not per-session (LevelSession.viewState doesn't track it, see Phase 1) — it
        // only ever filters the current level's own objects (guarded by isCurrent below), so a
        // stale value from a previous current level can't hide another level's objects, only
        // fail to filter the (now) current one until re-toggled.
        const soloedTopLevelObjectId = this.editor.stateManager.get('view.soloedTopLevelObjectId');

        const ctx = this.editor.canvasRenderer.ctx;
        const visibleSessions = this.editor.levelsManager.getVisibleSessions();
        // Compositing order: current level always drawn last / on top, regardless of its
        // tab position (plan decision, section 12 item 2) — see getVisibleSessionsForRender().
        const sessionsForRender = this.editor.levelsManager.getVisibleSessionsForRender(visibleSessions);
        let totalVisibleCount = 0;

        sessionsForRender.forEach(session => {
            const isCurrent = session.level === currentLevel;
            let levelSortedObjects = this.getVisibleObjects(camera, session.level);
            // Per-view object type display filter (independent of Outliner)
            if (view && vvm) {
                levelSortedObjects = levelSortedObjects.filter(
                    (item) => vvm.passesTypeFilter(view, item.obj)
                );
            }
            totalVisibleCount += levelSortedObjects.length;

            // Parallax: per-view displayOptions when multi-viewport (VP-HK), else global
            const parallaxEnabled = view && vvm
                ? vvm.getDisplayFlag(view, 'parallax')
                : this.parallaxRenderer.isParallaxEnabled();
            if (parallaxEnabled) {
                // For parallax, we need to convert back to simple objects for compatibility
                const soloFiltered = (isCurrent && soloedTopLevelObjectId)
                    ? levelSortedObjects.filter(item => item.obj.id === soloedTopLevelObjectId)
                    : levelSortedObjects;
                const simpleObjects = soloFiltered.map(item => item.obj);
                this.parallaxRenderer.renderParallaxObjects(simpleObjects, camera, session.level);
            } else {
                levelSortedObjects.forEach(item => {
                    const id = item.obj.id;
                    if (isCurrent && soloedTopLevelObjectId && id !== soloedTopLevelObjectId) return;
                    const dimmedByGroupEdit = isCurrent && selectableSet && !selectableSet.has(id) && !excludedSet.has(id);
                    const dimmedByIsolate = isCurrent && isolatedTopLevelIds && !isolatedTopLevelIds.has(id);
                    const dimmed = dimmedByGroupEdit || dimmedByIsolate;
                    if (dimmed) ctx.filter = 'grayscale(1) opacity(0.4)';
                    this.editor.canvasRenderer.drawObject(item.obj, item.parentX, item.parentY);
                    if (dimmed) ctx.filter = 'none';
                });
            }
        });

        // All current-level-only overlays below (boundaries/collisions/selection/hierarchy
        // highlight/group-edit-frame/duplicate-ghosts) only make sense if the current level
        // itself is actually being drawn — otherwise they'd float over objects that were
        // never rendered this frame (current level hidden via its own eye icon).
        const currentSessionVisible = visibleSessions.some(session => session.level === currentLevel);

        // Draw object boundaries if enabled (frame camera — not focused stateManager.camera)
        const showObjectBoundaries = view && vvm
            ? vvm.getDisplayFlag(view, 'objectBoundaries')
            : this.editor.stateManager.get('view.objectBoundaries');
        if (showObjectBoundaries && currentSessionVisible) {
            this.drawObjectBoundaries(camera);
        }

        // Draw object collisions if enabled
        const showObjectCollisions = view && vvm
            ? vvm.getDisplayFlag(view, 'objectCollisions')
            : this.editor.stateManager.get('view.objectCollisions');
        if (showObjectCollisions && currentSessionVisible) {
            this.drawObjectCollisions(camera);
        }

        if (currentSessionVisible) {
            // Draw selection (shared selection, per-view camera already applied)
            this.drawSelection(camera);

            // If a single group is selected, highlight its nested groups with fading
            const selected = this.editor.stateManager.get('selectedObjects');
            if (selected && selected.size === 1) {
                const selId = Array.from(selected)[0];
                const selObj = this.editor.level.findObjectById(selId);
                if (selObj && selObj.type === 'group') {
                    this.drawHierarchyHighlightForGroup(selObj, 0);
                }
            }

            // Draw group edit mode frame
            this.drawGroupEditFrame(camera);

            // C1: game-camera frustum frames (what each camera object “sees”)
            this.drawCameraViewFrames(camera, view);

            // Draw placing objects (duplicates) BEFORE restoreCamera() (world space)
            const duplicate = this.editor.stateManager.get('duplicate');
            if (duplicate && duplicate.isActive && Array.isArray(duplicate.objects) && duplicate.objects.length > 0) {
                // Log only once per duplicate session (optimized to reduce console spam)
                if (!this._lastRenderState || this._lastRenderState !== 'drawing') {
                    this._lastRenderState = 'drawing';
                }
                this.drawDuplicateObjects(duplicate.objects, camera);
            } else if (duplicate) {
                // Log state change only when it changes (optimized to reduce console spam)
                const currentState = `${duplicate.isActive}_${duplicate.objects?.length || 0}`;
                if (!this._lastRenderState || this._lastRenderState !== currentState) {
                    this._lastRenderState = currentState;
                }
            }
        }

        if (drawInteractiveOverlays) {
            // Draw marquee
            if (mouse.marqueeRect) {
                this.editor.canvasRenderer.drawMarquee(mouse.marqueeRect, camera);
            }

            // Draw touch marquee selection
            if (this.editor.touchHandlers) {
                const touchState = this.editor.touchHandlers.getTouchState();
                if (touchState && touchState.marqueeRect) {
                    this.editor.canvasRenderer.drawMarquee(touchState.marqueeRect, camera);
                }
            }

            // Draw axis constraint line
            if (mouse.constrainedAxis && mouse.isDragging && mouse.axisCenter) {
                const axisConfig = {
                    showAxis: this.editor.stateManager.get('editor.axisConstraint.showAxis'),
                    axisColor: this.editor.stateManager.get('editor.axisConstraint.axisColor'),
                    axisWidth: this.editor.stateManager.get('editor.axisConstraint.axisWidth')
                };
                this.editor.canvasRenderer.drawAxisConstraint(
                    mouse.constrainedAxis,
                    mouse.axisCenter.x,
                    mouse.axisCenter.y,
                    camera,
                    axisConfig
                );
            }
        }

        this.editor.canvasRenderer.restoreCamera();

        if (this.renderCount % 500 === 0 && (!view || view.isPrimary)) {
            Logger.render.info(
                `🎨 Render #${this.renderCount}: ${totalVisibleCount} visible objects (view ${view?.leafId || 'primary'})`
            );
        }
    }


    /**
     * Draw selection outlines
     */
    /**
     * @param {{x:number,y:number,zoom:number}} [cameraOverride] - multi-view frame camera
     */
    drawSelection(cameraOverride = null) {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const camera = cameraOverride || this.editor.stateManager.get('camera');

        if (this.isInGroupEditMode()) {
            const groupEditMode = this.getGroupEditMode();
            // In group edit mode, draw selection for all objects including nested ones
            this.editor.level.getAllObjects().forEach(obj => {
                if (selectedObjects.has(obj.id)) {
                    const effectiveLayerId = this.getEffectiveLayerId(obj);
                    const bounds = this.parallaxRenderer.getObjectWorldBoundsWithParallax(obj, effectiveLayerId);
                    const mouse = this.editor.stateManager.get('mouse');

                    // Special visual feedback for Alt+drag in group edit mode
                    if (mouse.altKey && mouse.isDragging && this.editor.objectOperations.isObjectInGroup(obj, groupEditMode.group)) {
                        this.drawAltDragSelectionRect(obj, bounds, camera);
                    } else {
                        this.drawObjectSelectionRect(obj, bounds, camera);
                    }
                }
            });
        } else {
            // Normal mode - draw selection for top-level objects only
            this.editor.level.objects.forEach(obj => {
                if (selectedObjects.has(obj.id)) {
                    const effectiveLayerId = this.getEffectiveLayerId(obj);
                    const bounds = this.parallaxRenderer.getObjectWorldBoundsWithParallax(obj, effectiveLayerId);
                    this.drawObjectSelectionRect(obj, bounds, camera);
                }
            });
        }
    }

    /**
     * Draw selection outline for an object, rotated to match its true on-screen orientation
     * (ancestor rotations + its own — see WorldPositionUtils.getFrameGeometry). `bounds` only
     * supplies the CENTER (its AABB center is invariant to rotation and already carries any
     * parallax offset); the actual rect size/rotation come from getFrameGeometry so this
     * never drifts out of sync with the rendered picture.
     */
    drawObjectSelectionRect(obj, bounds, camera) {
        const geometry = WorldPositionUtils.getFrameGeometry(obj, this.editor.level.objects);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const rect = { minX: cx - geometry.halfW, minY: cy - geometry.halfH, maxX: cx + geometry.halfW, maxY: cy + geometry.halfH };

        const isGroup = obj.type === 'group';
        const color = isGroup
            ? (this.editor.stateManager.get('selection.groupOutlineColor') || '#3B82F6')
            : (this.editor.stateManager.get('selection.outlineColor') || '#3B82F6');
        const width = isGroup
            ? (this.editor.stateManager.get('selection.groupOutlineWidth') || 4)
            : (this.editor.stateManager.get('selection.outlineWidth') || 2);

        this.strokeFrame(rect, camera, { color, width, dash: isGroup ? [5, 5] : [] }, geometry.rotationDeg);
    }

    /**
     * Low-level: stroke a (possibly rotated) rectangle. Shared by object/group selection
     * outlines, Alt-drag feedback, and the group-edit-mode frame so all of them always draw
     * consistently and can never visually diverge from each other or from the rendered
     * picture — previously each had its own hand-rolled rotation (or, for the group-edit
     * frame, no rotation at all), which is exactly what caused them to drift apart.
     * @param {Object} bounds - {minX,minY,maxX,maxY} of the UNROTATED rect
     * @param {Object} camera
     * @param {Object} style - { color, width, dash }
     * @param {number} rotationDeg - rotate around the rect's own center before stroking
     */
    strokeFrame(bounds, camera, { color, width, dash = [] }, rotationDeg = 0) {
        const ctx = this.editor.canvasRenderer.ctx;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width / camera.zoom;
        ctx.setLineDash(dash);

        if (rotationDeg) {
            const cx = (bounds.minX + bounds.maxX) / 2;
            const cy = (bounds.minY + bounds.maxY) / 2;
            ctx.translate(cx, cy);
            ctx.rotate(rotationDeg * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        ctx.restore();
    }

    drawAltDragSelectionRect(obj, bounds, camera) {
        const geometry = WorldPositionUtils.getFrameGeometry(obj, this.editor.level.objects);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const rect = { minX: cx - geometry.halfW, minY: cy - geometry.halfH, maxX: cx + geometry.halfW, maxY: cy + geometry.halfH };
        this.strokeFrame(rect, camera, { color: '#FF6B6B', width: 3, dash: [8, 4] }, geometry.rotationDeg);
    }

    /**
     * Compute the (already padded) group-edit frame geometry — bounds rect plus the
     * rotation needed to match the rendered picture exactly. Shared between the live frame
     * and the frozen Alt-drag-out-of-group snapshot so both use identical math.
     */
    getGroupEditFrameGeometry(group, padding = 10) {
        const bounds = this.editor.objectOperations.getObjectWorldBounds(group);
        const frameGeometry = WorldPositionUtils.getFrameGeometry(group, this.editor.level.objects);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        return {
            minX: cx - frameGeometry.halfW - padding,
            minY: cy - frameGeometry.halfH - padding,
            maxX: cx + frameGeometry.halfW + padding,
            maxY: cy + frameGeometry.halfH + padding,
            rotationDeg: frameGeometry.rotationDeg
        };
    }

    /**
     * Draw group edit mode frame
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride] - multi-view frame camera
     */
    drawGroupEditFrame(cameraOverride = null) {
        if (!this.isInGroupEditMode()) return;

        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const group = this.getActiveGroup();
        const groupEditMode = this.getGroupEditMode();

        // Draw frame around the group being edited; allow freezing during Alt-drag
        const geometry = (groupEditMode.frameFrozen && groupEditMode.frozenFrameGeometry)
            ? groupEditMode.frozenFrameGeometry
            : this.getGroupEditFrameGeometry(group);

        this.strokeFrame(geometry, camera, { color: '#FF6B6B', width: 3, dash: [10, 5] }, geometry.rotationDeg);
    }

    drawHierarchyHighlightForGroup(group, depth = 0) {
        const baseColor = this.editor.stateManager.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25;
        const decay = 0.6;
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        // One save/restore per depth level — fillStyle is constant within a depth
        const ctx = this.editor.canvasRenderer.ctx;
        ctx.save();
        ctx.fillStyle = RenderUtils.hexToRgba(baseColor, alpha);

        group.children.forEach(child => {
            if (child.type === 'group') {
                // Fill the child's true (rotated) footprint, not its axis-aligned AABB:
                // same center-plus-frame-geometry approach as drawObjectSelectionRect
                const bounds = this.editor.objectOperations.getObjectWorldBounds(child);
                const geometry = WorldPositionUtils.getFrameGeometry(child, this.editor.level.objects);
                const cx = (bounds.minX + bounds.maxX) / 2;
                const cy = (bounds.minY + bounds.maxY) / 2;
                if (geometry.rotationDeg) {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(geometry.rotationDeg * Math.PI / 180);
                    ctx.fillRect(-geometry.halfW, -geometry.halfH, geometry.halfW * 2, geometry.halfH * 2);
                    ctx.restore();
                } else {
                    ctx.fillRect(cx - geometry.halfW, cy - geometry.halfH, geometry.halfW * 2, geometry.halfH * 2);
                }
                // Each recursive call does its own save/restore and restores ctx back to our fillStyle
                this.drawHierarchyHighlightForGroup(child, depth + 1);
            }
        });

        ctx.restore();
    }


    /**
     * Get visible layer IDs for performance optimization
     * @returns {Set<string>} Set of visible layer IDs
     */
    getVisibleLayerIds(level = this.editor.level) {
        // Проверки на существование необходимых объектов
        if (!this.editor || !level) {
            Logger.render.warn('Cannot get visible layer IDs: level not available');
            return new Set();
        }

        const levelId = level.id || 'default';
        const cached = this.visibleLayersCache.get(levelId);
        if (cached && performance.now() - cached.timestamp < this.cacheTimeout) {
            return cached.layerIds;
        }

        // Get all layers and filter visible ones
        const visibleLayers = new Set();
        const layers = level.getLayersSorted();

        // Solo (Ctrl+click a layer's eye icon in LayersPanel): if any layer is soloed,
        // only soloed layer(s) render, regardless of their own `visible` flag — non-
        // destructive, `layer.soloed` is a transient UI aid, never touches `layer.visible`.
        const soloedLayers = layers.filter(layer => layer.soloed);
        const layersToCheck = soloedLayers.length > 0 ? soloedLayers : layers;

        layersToCheck.forEach(layer => {
            if (soloedLayers.length > 0 || layer.visible) {
                visibleLayers.add(layer.id);
            }
        });

        // Cache the result, keyed by levelId — a layer-visibility change in one level
        // must never serve stale (or worse, wrong-level) results for another.
        this.visibleLayersCache.set(levelId, { layerIds: visibleLayers, timestamp: performance.now() });

        return visibleLayers;
    }

    /**
     * Invalidate layer visibility cache (call when layer visibility changes).
     * @param {string|null} levelId - Level whose cache to drop; defaults to the current
     *   level (layer visibility edits only ever happen on editor.level). Pass null
     *   explicitly to drop every level's entry.
     */
    invalidateLayerVisibilityCache(levelId = this.editor.level?.id) {
        if (levelId) {
            this.visibleLayersCache.delete(levelId);
        } else {
            this.visibleLayersCache.clear();
        }
        // Also invalidate visible objects cache since layer visibility affects it
        // (full clear, not per-level: cheap to recompute, and keeps this call simple/safe)
        this.visibleObjectsCache.clear();
        // Invalidate selectable objects cache as well
        this.editor.clearSelectableObjectsCache();
    }

    /**
     * Clear visible objects cache for current camera position
     * More selective than clearing entire cache
     */
    clearVisibleObjectsCacheForCurrentCamera() {
        const camera = this.editor.stateManager.get('camera');
        if (!camera) return;

        // Size is part of the key (multi-view) — drop every entry for this pose by prefix
        // is fragile; clear all is cheap after structural edits. Prefer full clear when
        // multi-view active so secondary leaves don't keep a stale list.
        if (this.editor.viewportViewManager?.views?.size > 1) {
            this.visibleObjectsCache.clear();
            return;
        }
        this.visibleObjectsCache.delete(this._buildVisibleObjectsCacheKey(camera));
    }

    /**
     * Clear all visible objects cache
     * Use when object positions or stacking order change
     */
    clearVisibleObjectsCache() {
        this.visibleObjectsCache.clear();
    }

    /**
     * Clear visible objects cache for specific camera position
     * @param {Object} camera - Camera state to clear cache for
     */
    clearVisibleObjectsCacheForCamera(camera) {
        if (!camera) return;

        if (this.editor.viewportViewManager?.views?.size > 1) {
            this.visibleObjectsCache.clear();
            return;
        }
        this.visibleObjectsCache.delete(this._buildVisibleObjectsCacheKey(camera));
    }

    /**
     * Get objects visible in the current viewport (frustum culling) with caching
     */
    /**
     * Common method to recursively collect visible objects with their parent positions
     */
    collectVisibleObjectsRecursive(objects, visibleLayerIds, left, top, right, bottom, parentX = 0, parentY = 0, level = this.editor.level) {
        const result = [];

        objects.forEach(obj => {
            // Check if object's effective layer is visible (considering inheritance from parent groups)
            const effectiveLayerId = this.getEffectiveLayerId(obj, level);
            if (!visibleLayerIds.has(effectiveLayerId)) {
                return;
            }

            // Check if object itself is visible
            if (!obj.visible) {
                return;
            }

            // Calculate absolute position for viewport check
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;

            // Check if object is in viewport (adjust viewport for parent offset)
            const adjustedLeft = left - parentX;
            const adjustedTop = top - parentY;
            const adjustedRight = right - parentX;
            const adjustedBottom = bottom - parentY;

            if (this.isObjectVisible(obj, adjustedLeft, adjustedTop, adjustedRight, adjustedBottom)) {
                result.push({
                    obj: obj,
                    parentX: parentX,
                    parentY: parentY
                });
            }

            // Recursively collect children if this is a group
            if (obj.type === 'group' && obj.children) {
                // Children are rendered as part of the group, not as separate objects
                // const children = this.collectVisibleObjectsRecursive(obj.children, visibleLayerIds, left, top, right, bottom, absX, absY);
                // result.push(...children);
            }
        });

        return result;
    }

    /**
     * Обычный метод поиска видимых объектов (fallback)
     */
    getVisibleObjectsRegular(camera, level = this.editor.level) {
        const canvas = this._getValidCanvasOrNull(camera, level);
        if (!canvas) return [];

        const { left: extendedLeft, top: extendedTop, right: extendedRight, bottom: extendedBottom } =
            this._computeExtendedViewportBounds(camera, canvas);

        // Get visible layer IDs for performance
        const visibleLayerIds = this.getVisibleLayerIds(level);

        // Use common method to collect all visible objects recursively
        const visibleObjectsWithPosition = this.collectVisibleObjectsRecursive(
            level.objects,
            visibleLayerIds,
            extendedLeft, extendedTop, extendedRight, extendedBottom,
            0, 0, level
        );

        return visibleObjectsWithPosition;
    }

    /**
     * Cache key for visibleObjectsCache. MUST stay identical between the read path
     * (getVisibleObjects) and every invalidation path (clearVisibleObjectsCacheFor*) —
     * a mismatched key makes the "clear" calls silent no-ops, leaving stale
     * {obj, parentX, parentY} entries served up to CACHE_TIMEOUT_MS later (the ungroup/
     * delete/duplicate flicker bug: parallaxKey was appended here but omitted from the
     * two clear-by-camera methods, so those deletes never matched a real entry).
     *
     * Canvas size is part of the key: multi-viewport leaves share the same camera pose
     * but different buffer sizes → different frustums. Omitting size made views steal
     * each other's cull lists and flicker objects at edges while the TTL expired.
     */
    _buildVisibleObjectsCacheKey(camera, level = this.editor.level, canvas = null) {
        const parallaxEnabled = this.parallaxRenderer.isParallaxEnabled();
        const parallaxState = parallaxEnabled ? this.parallaxRenderer.getParallaxState() : null;
        const parallaxKey = parallaxState?.startPosition ? `_${parallaxState.startPosition.x.toFixed(1)},${parallaxState.startPosition.y.toFixed(1)}` : '_off';
        const levelId = level?.id || 'default';
        const c = canvas || this.editor.canvasRenderer?.canvas;
        const sizeKey = c ? `_${c.width}x${c.height}` : '';
        return `${levelId}_${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}${sizeKey}${parallaxKey}`;
    }

    /**
     * True while a gesture mutates object world bounds without refreshing the spatial
     * index (drag / rotate-scale / marquee). Mid-gesture TTL rebuilds would cull via
     * stale cells and blink non-selected objects (worse with multi-view × N rebuilds).
     * @returns {boolean}
     */
    _isInteractiveObjectGesture() {
        const mouse = this.editor.stateManager?.get('mouse');
        if (!mouse) return false;
        return !!(mouse.isDragging || mouse.isTransforming || mouse.isMarqueeSelecting
            || mouse.isPlacingObjects
            || this.editor.stateManager.get('duplicate.isActive')
            || this.editor.stateManager.get('duplicate.isAltDragMode'));
    }

    getVisibleObjects(camera, level = this.editor.level) {
        const canvas = this._getValidCanvasOrNull(camera, level);
        if (!canvas) return [];

        const currentTime = performance.now();
        const cameraKey = this._buildVisibleObjectsCacheKey(camera, level, canvas);
        const interactive = this._isInteractiveObjectGesture();

        // Check cache first
        if (this.visibleObjectsCache.has(cameraKey)) {
            const cached = this.visibleObjectsCache.get(cameraKey);
            // Sticky during interactive gestures: keep the pre-move candidate set
            // (object refs still read live x/y). Avoids spatial-index TTL flicker.
            if (interactive || currentTime - cached.timestamp < this.cacheTimeout) {
                return cached.objects;
            }
        }

        // Spatial index cells are stale while objects move — use full scan during
        // gestures so pivot-compensated groups / siblings stay in the candidate set.
        let visibleObjects;
        if (interactive) {
            visibleObjects = this.getVisibleObjectsRegular(camera, level);
        } else {
            try {
                visibleObjects = this.getVisibleObjectsSpatial(camera, level);
            } catch (error) {
                Logger.render.warn('Spatial index search failed, falling back to regular method', error);
                visibleObjects = this.getVisibleObjectsRegular(camera, level);
            }
        }

        // Sort objects by stacking order for proper layering (behind first, front last).
        // Computed once per cache entry instead of on every render() call; shares the same
        // TTL/invalidation as visibility (see clearVisibleObjectsCache - "objects or structure change").
        // Index built once per sort instead of per-comparison (see Level.buildStackOrderIndex) —
        // avoids an O(N) tree search inside every one of the O(M log M) comparator calls.
        const stackOrderIndex = level.buildStackOrderIndex();
        visibleObjects = visibleObjects.slice().sort((a, b) =>
            level.compareStackOrderIndexed(a.obj, b.obj, stackOrderIndex)
        );

        // Cache the result
        this.visibleObjectsCache.set(cameraKey, {
            objects: visibleObjects,
            timestamp: currentTime
        });

        // Clean old cache entries (multi-view × multi-level needs more slots than single canvas)
        const maxCache = Math.max(10, (this.editor.viewportViewManager?.views?.size || 1) * 4);
        while (this.visibleObjectsCache.size > maxCache) {
            const oldestKey = this.visibleObjectsCache.keys().next().value;
            this.visibleObjectsCache.delete(oldestKey);
        }

        return visibleObjects;
    }

    /**
     * Draw duplicate objects using standard rendering logic
     */
    drawDuplicateObjects(objects, camera) {
        if (!objects || objects.length === 0) return;

        // Draw objects with transparency
        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.globalAlpha = 0.7;

        // Draw each duplicate object using standard object rendering
        objects.forEach(obj => {
            this.drawDuplicateObject(obj);
        });

        this.editor.canvasRenderer.ctx.restore();

        // Draw selection outlines using direct bounds calculation (duplicates aren't in level
        // tree, so WorldPositionUtils.getFrameGeometry — which looks objects up by DFS —
        // doesn't apply here). getDuplicateObjectBounds is rotation-aware (conservative AABB);
        // for simple objects we additionally draw the frame TIGHT and actually rotated (their
        // own rotation is known directly, no ancestor lookup needed) instead of just the
        // axis-aligned conservative box.
        objects.forEach(obj => {
            const isGroup = obj.type === 'group';
            const color = isGroup
                ? (this.editor.stateManager.get('selection.groupOutlineColor') || '#3B82F6')
                : (this.editor.stateManager.get('selection.outlineColor') || '#3B82F6');
            const width = isGroup
                ? (this.editor.stateManager.get('selection.groupOutlineWidth') || 4)
                : (this.editor.stateManager.get('selection.outlineWidth') || 2);

            if (obj.rotation) {
                // For rotated objects, get unrotated bounds and rotate the frame
                const rawBounds = this.getDuplicateObjectBounds(obj, 0, 0, true);
                if (rawBounds) {
                    const cx = (rawBounds.minX + rawBounds.maxX) / 2;
                    const cy = (rawBounds.minY + rawBounds.maxY) / 2;
                    const halfW = isGroup ? ((rawBounds.maxX - rawBounds.minX) / 2) : ((obj.width || 0) / 2);
                    const halfH = isGroup ? ((rawBounds.maxY - rawBounds.minY) / 2) : ((obj.height || 0) / 2);
                    const rect = { minX: cx - halfW, minY: cy - halfH, maxX: cx + halfW, maxY: cy + halfH };
                    this.strokeFrame(rect, camera, { color, width, dash: isGroup ? [5, 5] : [] }, obj.rotation);
                }
            } else {
                const bounds = this.getDuplicateObjectBounds(obj);
                if (bounds) {
                    this.strokeFrame(bounds, camera, { color, width, dash: isGroup ? [5, 5] : [] });
                }
            }

            // Draw hierarchy highlight for groups
            if (obj.type === 'group') {
                this.drawDuplicateHierarchyHighlight(obj, 0, 0, 0);
            }
        });
    }

    /**
     * Draw hierarchy highlight for duplicate groups (uses direct bounds calculation).
     * Mirrors drawDuplicateObject's ctx-rotation nesting so the highlight fills land
     * exactly on the (possibly rotated) rendered children; each nested group's own
     * footprint is filled as its EXACT unrotated rect rotated as a rigid body, not a
     * conservative axis-aligned AABB.
     */
    drawDuplicateHierarchyHighlight(group, depth = 0, parentX = 0, parentY = 0) {
        if (!group || !group.children) return;

        const baseColor = this.editor.stateManager.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25;
        const decay = 0.6;
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        const groupAbsX = parentX + group.x;
        const groupAbsY = parentY + group.y;

        const ctx = this.editor.canvasRenderer.ctx;
        ctx.save();

        // Enter this group's rotated frame (same pivot as drawDuplicateObject) so all
        // plain child coordinates below land where the preview actually rendered them
        const groupRotation = group.rotation || 0;
        if (groupRotation) {
            const b = this.getDuplicateObjectBounds(group, parentX, parentY);
            const cx = (b.minX + b.maxX) / 2;
            const cy = (b.minY + b.maxY) / 2;
            ctx.translate(cx, cy);
            ctx.rotate(groupRotation * Math.PI / 180);
            ctx.translate(-cx, -cy);
        }

        ctx.fillStyle = RenderUtils.hexToRgba(baseColor, alpha);

        group.children.forEach(child => {
            if (child.type === 'group') {
                // Exact footprint: unrotated rect rotated by the child's own rotation
                // (deeper descendants' rotations are handled by the recursion below)
                const raw = this.getDuplicateObjectBounds(child, groupAbsX, groupAbsY, true);
                const childRotation = child.rotation || 0;
                if (childRotation) {
                    const cx = (raw.minX + raw.maxX) / 2;
                    const cy = (raw.minY + raw.maxY) / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(childRotation * Math.PI / 180);
                    ctx.translate(-cx, -cy);
                    ctx.fillRect(raw.minX, raw.minY, raw.maxX - raw.minX, raw.maxY - raw.minY);
                    ctx.restore();
                } else {
                    ctx.fillRect(raw.minX, raw.minY, raw.maxX - raw.minX, raw.maxY - raw.minY);
                }
                // Each recursive call does its own save/restore and restores ctx back to our fillStyle
                this.drawDuplicateHierarchyHighlight(child, depth + 1, groupAbsX, groupAbsY);
            }
        });

        ctx.restore();
    }

    /**
     * Get bounds for duplicate object (direct calculation without level tree search).
     * Rotation-aware: duplicate previews are a detached subtree (not in level.objects), so
     * they can't go through WorldPositionUtils' DFS-from-root lookup — this mirrors the same
     * "local bounds per group, rotate as a whole, then shift" algorithm by hand instead.
     * @param {boolean} skipOwnRotation - Return the rect BEFORE obj's own rotation is applied
     *        (used to draw exact rotated fills/frames instead of the conservative AABB;
     *        the rect's center is the same either way).
     */
    getDuplicateObjectBounds(obj, parentX = 0, parentY = 0, skipOwnRotation = false) {
        if (obj.type !== 'group') {
            const absX = obj.x + parentX;
            const absY = obj.y + parentY;
            return WorldPositionUtils.getRotatedRectAABB(absX, absY, obj.width || 0, obj.height || 0, skipOwnRotation ? 0 : (obj.rotation || 0));
        }

        // Group object - union of children's bounds in THIS group's own local frame
        // (each child call uses parentX/Y=0, so its result already includes ITS OWN x/y
        // relative to `obj`), then rotate the union as a rigid body by obj's own rotation.
        let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        if (obj.children && obj.children.length > 0) {
            for (const child of obj.children) {
                const childBounds = this.getDuplicateObjectBounds(child, 0, 0);
                bounds.minX = Math.min(bounds.minX, obj.x + childBounds.minX);
                bounds.minY = Math.min(bounds.minY, obj.y + childBounds.minY);
                bounds.maxX = Math.max(bounds.maxX, obj.x + childBounds.maxX);
                bounds.maxY = Math.max(bounds.maxY, obj.y + childBounds.maxY);
            }
        }

        // If no valid bounds found (empty group), use group's position
        if (bounds.minX === Infinity) {
            bounds = { minX: obj.x, minY: obj.y, maxX: obj.x, maxY: obj.y };
        }

        if (!skipOwnRotation) {
            bounds = WorldPositionUtils.rotateBoundsAroundCenter(bounds, obj.rotation || 0);
        }

        // Shift from obj's-parent-relative frame to the caller's requested absolute position
        return {
            minX: bounds.minX + parentX,
            minY: bounds.minY + parentY,
            maxX: bounds.maxX + parentX,
            maxY: bounds.maxY + parentY
        };
    }

    /**
     * Draw single duplicate object recursively.
     * Group rotation is applied via ctx transforms around the group's children-bounds
     * center — the same pivot convention as CanvasRenderer.drawGroup, so a duplicated
     * rotated group previews exactly like its original. (CanvasRenderer.drawGroup itself
     * can't be reused here: duplicates are plain deep-cloned objects without Group's
     * getBounds() method.)
     */
    drawDuplicateObject(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;

        if (obj.type === 'group') {
            const rotation = obj.rotation || 0;
            const ctx = this.editor.canvasRenderer.ctx;
            if (rotation) {
                const b = this.getDuplicateObjectBounds(obj, parentX, parentY);
                const cx = (b.minX + b.maxX) / 2;
                const cy = (b.minY + b.maxY) / 2;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.translate(-cx, -cy);
            }

            // Draw group children
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => {
                    this.drawDuplicateObject(child, absX, absY);
                });
            }

            if (rotation) {
                ctx.restore();
            }
        } else {
            // Use standard object drawing method
            this.editor.canvasRenderer.drawObject({
                ...obj,
                x: absX,
                y: absY
            });
        }
    }

    /**
     * Check if object is visible in the given viewport bounds
     */
    isObjectVisible(obj, left, top, right, bottom) {
        if (!obj.visible) {
            return false;
        }
        
        if (obj.type === 'group') {
            // For groups, check if any child is visible
            const result = obj.children && obj.children.some(child =>
                this.isObjectVisible(child, left - obj.x, top - obj.y, right - obj.x, bottom - obj.y)
            );

            // Debug group visibility issues
            if (!result) {
            }

            return result;
        }
        
        // Check if object bounds intersect with viewport
        const objLeft = obj.x;
        const objTop = obj.y;
        const objRight = obj.x + (obj.width || 32); // Default width for objects without explicit width
        const objBottom = obj.y + (obj.height || 32); // Default height for objects without explicit height

        // Debug bounds calculation for all operations
        const intersects = !(objRight < left || objLeft > right || objBottom < top || objTop > bottom);

        // Debug only during undo/redo operations or when object is not visible in viewport
        if (this.editor.historyManager && (this.editor.historyManager.isUndoing || this.editor.historyManager.isRedoing) || !intersects) {
        }

        return intersects;
    }

    /**
     * C1: draw dashed world-space frames for each game camera object — the area
     * `resolveGameCameraObject` would show at the design resolution (default 1920×1080,
     * overridable via `properties.resolutionWidth/Height`). Skips the camera currently
     * driving this viewport (frame would fill the whole canvas).
     * @param {{x:number,y:number,zoom:number}} camera - frame (work) camera
     * @param {object|null} view - ViewportView or null
     */
    drawCameraViewFrames(camera, view = null) {
        if (!camera?.zoom || camera.zoom <= 0) return;
        const level = this.editor.level;
        if (!level) return;

        const vvm = this.editor.viewportViewManager;
        let cameras;
        if (vvm?.listGameCameraObjects) {
            cameras = vvm.listGameCameraObjects();
        } else if (level.getAllObjects) {
            cameras = level.getAllObjects().filter((o) => o.type === 'camera');
        } else {
            cameras = (level.objects || []).filter((o) => o.type === 'camera');
        }
        if (!cameras.length) return;

        const selected = this.editor.stateManager.get('selectedObjects');
        const activeGameId = view?.source?.kind === 'game' ? view.source.objectId : null;
        const visibleLayerIds = this.getVisibleLayerIds();

        for (const obj of cameras) {
            if (!obj || obj.visible === false) continue;
            if (activeGameId && obj.id === activeGameId) continue;
            if (visibleLayerIds && !visibleLayerIds.has(this.getEffectiveLayerId(obj))) continue;
            if (view && vvm && !vvm.passesTypeFilter(view, obj)) continue;

            const frame = this.getCameraViewWorldRect(obj);
            if (!frame) continue;

            const isSelected = selected && selected.has(obj.id);
            this.strokeFrame(frame, camera, {
                color: isSelected ? CAMERA.FRAME_COLOR_SELECTED : CAMERA.FRAME_COLOR,
                width: CAMERA.FRAME_WIDTH,
                dash: CAMERA.FRAME_DASH
            }, 0);

            // Center cross (screen-constant length)
            const ctx = this.editor.canvasRenderer.ctx;
            const half = 8 / camera.zoom;
            const cx = (frame.minX + frame.maxX) / 2;
            const cy = (frame.minY + frame.maxY) / 2;
            ctx.save();
            ctx.strokeStyle = isSelected ? CAMERA.FRAME_COLOR_SELECTED : CAMERA.FRAME_COLOR;
            ctx.lineWidth = CAMERA.FRAME_WIDTH / camera.zoom;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(cx - half, cy);
            ctx.lineTo(cx + half, cy);
            ctx.moveTo(cx, cy - half);
            ctx.lineTo(cx, cy + half);
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * World AABB for a game camera's design frustum (center = object center, size = ref/zoom).
     * @param {object} obj - level object type === 'camera'
     * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null}
     */
    getCameraViewWorldRect(obj) {
        if (!obj || obj.type !== 'camera') return null;
        let zoom = obj.properties?.zoom ?? CAMERA.DEFAULT_ZOOM;
        if (!zoom || zoom <= 0) zoom = CAMERA.DEFAULT_ZOOM;

        const refW = Number(obj.properties?.resolutionWidth) > 0
            ? Number(obj.properties.resolutionWidth)
            : CAMERA.VIEW_REF_WIDTH;
        const refH = Number(obj.properties?.resolutionHeight) > 0
            ? Number(obj.properties.resolutionHeight)
            : CAMERA.VIEW_REF_HEIGHT;

        const worldW = refW / zoom;
        const worldH = refH / zoom;
        const cx = obj.x + (obj.width || 0) / 2;
        const cy = obj.y + (obj.height || 0) / 2;
        return {
            minX: cx - worldW / 2,
            minY: cy - worldH / 2,
            maxX: cx + worldW / 2,
            maxY: cy + worldH / 2
        };
    }

    /**
     * Draw object boundaries for debugging.
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride] - multi-view frame camera
     */
    drawObjectBoundaries(cameraOverride = null) {
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const visibleLayerIds = this.getVisibleLayerIds();

        this.editor.level.objects.forEach(obj => {
            if (obj.visible && visibleLayerIds.has(this.getEffectiveLayerId(obj))) {
                if (obj.type === 'group') {
                    this.drawGroupBoundaries(obj, camera);
                } else {
                    this.drawSingleObjectBoundary(obj, camera);
                }
            }
        });
    }

    /**
     * Draw the boundary for a single object, rotated to match its true on-screen
     * orientation. Shares strokeFrame()/getFrameGeometry() with the selection outline
     * (see drawObjectSelectionRect) so this debug overlay can never drift out of sync
     * with what's actually rendered/selectable, unlike the old plain strokeRect(worldPos)
     * which ignored rotation entirely.
     * @param {object} obj
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride]
     */
    drawSingleObjectBoundary(obj, cameraOverride = null) {
        const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const geometry = WorldPositionUtils.getFrameGeometry(obj, this.editor.level.objects);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const rect = { minX: cx - geometry.halfW, minY: cy - geometry.halfH, maxX: cx + geometry.halfW, maxY: cy + geometry.halfH };

        this.strokeFrame(rect, camera, { color: 'rgba(0, 255, 0, 0.5)', width: 1, dash: [2, 2] }, geometry.rotationDeg);
        this.drawHitTestArea(obj, camera);
    }

    /**
     * Debug overlay: the EXACT rectangle isPointInWorldBounds tests against (expanded by
     * the current click tolerance), computed via the same WorldPositionUtils.getHitTestGeometry
     * the real hit-test calls — so if this ever visually diverges from the green boundary
     * above, that's a genuine bug in one of the two geometry computations, not a fluke of
     * drawing them independently. Drawn as a plain expanded box (square corners); the real
     * tolerance test is circular around the click point (see WorldPositionUtils._pointNearRect),
     * so actual clicks near a corner are forgiven slightly less than this box implies.
     * Stroke width and world tolerance use the frame camera so peer zoom does not reskin this view.
     * @param {object} obj
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride]
     */
    drawHitTestArea(obj, cameraOverride = null) {
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const px = this.editor.stateManager.get('selection.hitTestTolerance') ?? 4;
        const zoom = camera?.zoom > 0 ? camera.zoom : 1;
        const tolerance = px / zoom;
        const geom = WorldPositionUtils.getHitTestGeometry(obj, this.editor.level.objects);
        const rect = {
            minX: geom.cx - geom.halfW - tolerance,
            minY: geom.cy - geom.halfH - tolerance,
            maxX: geom.cx + geom.halfW + tolerance,
            maxY: geom.cy + geom.halfH + tolerance
        };

        this.strokeFrame(rect, camera, { color: 'rgba(255, 165, 0, 0.9)', width: 1, dash: [1, 3] }, geom.rotationDeg);
    }

    /**
     * Draw boundaries for a group and its children
     * @param {object} group
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride]
     */
    drawGroupBoundaries(group, cameraOverride = null) {
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        this.drawSingleObjectBoundary(group, camera);

        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupBoundaries(child, camera);
                } else {
                    this.drawSingleObjectBoundary(child, camera);
                }
            });
        }
    }

    /**
     * Draw object collision boxes for debugging
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride] - multi-view frame camera
     */
    drawObjectCollisions(cameraOverride = null) {
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const visibleLayerIds = this.getVisibleLayerIds();

        this.editor.level.objects.forEach(obj => {
            if (obj.visible && visibleLayerIds.has(this.getEffectiveLayerId(obj))) {
                if (obj.type === 'group') {
                    this.drawGroupCollisions(obj, camera);
                } else {
                    this.drawSingleObjectCollision(obj, camera);
                }
            }
        });
    }

    /**
     * Draw collision box for a single object, rotated to match its true on-screen
     * orientation. Shares strokeFrame()/getFrameGeometry() with the selection outline
     * and drawSingleObjectBoundary — see drawObjectSelectionRect.
     * @param {object} obj
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride]
     */
    drawSingleObjectCollision(obj, cameraOverride = null) {
        const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        const geometry = WorldPositionUtils.getFrameGeometry(obj, this.editor.level.objects);
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const rect = { minX: cx - geometry.halfW, minY: cy - geometry.halfH, maxX: cx + geometry.halfW, maxY: cy + geometry.halfH };

        this.strokeFrame(rect, camera, { color: 'rgba(255, 0, 0, 0.7)', width: 2, dash: [] }, geometry.rotationDeg);

        const ctx = this.editor.canvasRenderer.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        const dotSize = 4 / camera.zoom;
        ctx.fillRect(cx - dotSize / 2, cy - dotSize / 2, dotSize, dotSize);
        ctx.restore();
    }

    /**
     * Draw collision boxes for a group and its children
     * @param {object} group
     * @param {{x:number,y:number,zoom:number}|null} [cameraOverride]
     */
    drawGroupCollisions(group, cameraOverride = null) {
        const camera = cameraOverride || this.editor.stateManager.get('camera');
        this.drawSingleObjectCollision(group, camera);

        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupCollisions(child, camera);
                } else {
                    this.drawSingleObjectCollision(child, camera);
                }
            });
        }
    }

    /**
     * Get effective layer ID for an object, considering inheritance from parent groups
     * @param {GameObject} obj - Object to get layer ID for
     * @returns {string} Effective layer ID
     */
    getEffectiveLayerId(obj, level = this.editor.level) {
        // Проверки на существование необходимых объектов
        if (!obj || !obj.id) {
            Logger.render.warn('Cannot get effective layer ID: object or object.id not available');
            return null;
        }

        if (!this.editor) {
            Logger.render.warn('Cannot get effective layer ID: editor not available');
            return null;
        }

        // If object has its own layerId, use it
        if (obj.layerId) {
            return obj.layerId;
        }

        // Try to find the object in the hierarchy and get parent's layerId
        return this.findParentLayerId(obj, level);
    }

    /**
     * Clear cache for specific object
     * @param {string} objId - Object ID to clear from cache
     */
    clearEffectiveLayerCacheForObject(objId) {
        if (this.editor && this.editor.cacheManager) {
            this.editor.cacheManager.effectiveLayerCache.delete(this.editor.cacheManager._namespacedKey(objId));
        }
    }

    /**
     * Find parent layer ID for object without caching (internal method)
     * @param {Object} obj - Object to find parent layer for
     * @returns {string} Parent layer ID or main layer ID
     */
    findParentLayerId(obj, level = this.editor.level) {
        // First check if object is at top level
        const topLevelObject = level.objects.find(topObj => topObj.id === obj.id);
        if (topLevelObject) {
            // Object is at top level, use its own layerId or main layer
            return topLevelObject.layerId || level.getMainLayerId();
        }

        // Search recursively in all groups
        for (const topLevelObj of level.objects) {
            if (topLevelObj.type === 'group') {
                const result = this.searchInGroupForLayerId(topLevelObj, obj, undefined, level);
                if (result) {
                    return result;
                }
            }
        }

        // If not found in any group, use main layer
        return level.getMainLayerId();
    }

    /**
     * Recursively search for object in group hierarchy and return parent's layerId
     * @param {Group} group - Group to search in
     * @param {GameObject} targetObj - Object to find
     * @returns {string|null} Parent's layerId or null if not found
     */
    searchInGroupForLayerId(group, targetObj, visitedGroups = new Set(), level = this.editor.level) {
        if (!group.children) return null;

        // Prevent infinite recursion
        if (visitedGroups.has(group.id)) {
            return null;
        }
        visitedGroups.add(group.id);

        for (const child of group.children) {
            if (child.id === targetObj.id) {
                // Found the object - return group's effective layerId
                // Group should inherit layerId from its parent if it doesn't have its own
                if (group.layerId) {
                    return group.layerId;
                } else {
                    // If group doesn't have layerId, find its parent's layerId
                    return this.findParentLayerId(group, level);
                }
            }

            // Search recursively in child groups
            if (child.type === 'group') {
                const result = this.searchInGroupForLayerId(child, targetObj, visitedGroups, level);
                if (result) return result;
            }
        }

        return null;
    }

}
