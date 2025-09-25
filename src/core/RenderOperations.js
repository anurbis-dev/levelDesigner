import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { ParallaxRenderer } from '../utils/ParallaxRenderer.js';
import { RenderUtils } from '../utils/RenderUtils.js';
import { SnapUtils } from '../utils/SnapUtils.js';

/**
 * Render Operations module for LevelEditor
 * Handles all rendering operations
 */
export class RenderOperations extends BaseModule {
    constructor(levelEditor) {
        super(levelEditor);
        
        // Performance optimization caches
        this.visibleObjectsCache = new Map();
        this.lastCameraState = null;
        this.cacheTimeout = 100; // Cache timeout in ms

        // Layer visibility cache for performance
        this.visibleLayersCache = null;
        this.layerVisibilityCacheTimestamp = 0;

        // Пространственный индекс для быстрого поиска объектов в области видимости
        this.spatialIndex = new Map(); // levelId -> {grid, bounds, lastUpdate}
        this.spatialGridSize = 256; // Размер ячейки пространственного индекса
        this.isBuildingSpatialIndex = false; // Флаг для предотвращения повторного построения

        // Кеш для разных уровней масштаба камеры
        this.zoomLevelCache = new Map(); // zoom -> cachedObjects
        this.lastZoomLevel = null;

        // Parallax renderer
        this.parallaxRenderer = new ParallaxRenderer(levelEditor);
    }

    /**
     * Построение пространственного индекса для быстрого поиска объектов
     * O(N) - вызывается при изменении уровня или добавлении/удалении объектов
     */
    buildSpatialIndex() {
        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level || !this.editor.level.objects) {
            Logger.render.warn('Cannot build spatial index: missing required objects');
            return;
        }

        // Предотвращаем повторное построение индекса
        if (this.isBuildingSpatialIndex) {
            return;
        }

        // Get level ID
        const levelId = this.editor.level?.id || 'default';

        this.isBuildingSpatialIndex = true;

        const objects = this.editor.level?.objects || [];

        // Создаем сетку для индексации
        const grid = new Map(); // 'x,y' -> Set of objects

        // Вычисляем границы всех объектов
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        objects.forEach(obj => {
            if (!obj.visible) {
                return; // Тихо пропускаем невидимые объекты
            }

            // Получаем мировые границы объекта
            const bounds = this.editor.objectOperations.getObjectWorldBounds(obj);

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
     * Invalidate spatial index for a specific level or all levels
     * @param {string} levelId - Level ID to invalidate, or null to invalidate all
     */
    invalidateSpatialIndex(levelId = null) {
        if (levelId) {
            this.spatialIndex.delete(levelId);
        } else {
            this.spatialIndex.clear();
        }
        this.isBuildingSpatialIndex = false; // Reset flag in case build was interrupted
    }

    /**
     * Быстрый поиск объектов в области видимости с помощью пространственного индекса
     * O(k) - где k - количество ячеек сетки в области видимости
     */
    getVisibleObjectsSpatial(camera) {
        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level || !this.editor.level.objects) {
            return [];
        }

        if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) {
            return [];
        }

        const canvas = this.editor.canvasRenderer.canvas;

        // Проверки на валидность canvas размеров
        if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
            return [];
        }

        if (!camera.zoom || camera.zoom <= 0) {
            return [];
        }

        const levelId = this.editor.level?.id || 'default';
        let spatialData = this.spatialIndex.get(levelId);

        if (!spatialData) {
            // Попытка автоматически построить индекс, если он не найден
            try {
                this.buildSpatialIndex();
                spatialData = this.spatialIndex.get(levelId);
                if (!spatialData) {
                    return this.getVisibleObjectsRegular(camera);
                }
            } catch (error) {
                return this.getVisibleObjectsRegular(camera);
            }
        }

        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + canvas.width / camera.zoom;
        const viewportBottom = camera.y + canvas.height / camera.zoom;

        // Добавляем padding
        let padding = 100;

        // При включенном параллаксе расширяем область поиска, чтобы учесть возможные смещения объектов
        if (this.parallaxRenderer.isParallaxEnabled()) {
            // Расширяем область на максимальное возможное параллакс смещение
            // Предполагаем максимальный коэффициент параллакса ±10
            const parallaxRange = Math.abs(camera.x - (this.parallaxRenderer.getParallaxState()?.startPosition?.x || 0)) * 10;
            padding = Math.max(padding, parallaxRange + 200); // +200 для безопасности
        }

        const extendedLeft = viewportLeft - padding;
        const extendedTop = viewportTop - padding;
        const extendedRight = viewportRight + padding;
        const extendedBottom = viewportBottom + padding;

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
        const visibleLayerIds = this.getVisibleLayerIds();
        const visibleObjects = Array.from(candidates).filter(obj => {
            // Проверяем видимость слоя
            const effectiveLayerId = this.getEffectiveLayerId(obj);
            if (!visibleLayerIds.has(effectiveLayerId)) {
                return false;
            }

            // Проверяем точную видимость в viewport
            return this.isObjectVisible(obj, extendedLeft, extendedTop, extendedRight, extendedBottom);
        });

        return visibleObjects;
    }


    /**
     * Render the canvas
     */
    render() {
        // Счетчик рендеров для периодических логов
        if (!this.renderCount) this.renderCount = 0;
        this.renderCount++;

        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level || !this.editor.level.objects) {
            return;
        }

        if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) {
            return;
        }

        if (!this.editor.stateManager) {
            return;
        }
        
        const camera = this.editor.stateManager.get('camera');
        const mouse = this.editor.stateManager.get('mouse');

        if (!camera) {
            return;
        }

        // Проверки на валидность canvas размеров и camera zoom
        const canvas = this.editor.canvasRenderer.canvas;
        if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
            return;
        }

        if (!camera.zoom || camera.zoom <= 0) {
            return;
        }
        
        this.editor.canvasRenderer.clear();
        this.editor.canvasRenderer.setCamera(camera);
        
        // Draw background and grid
        const showGrid = this.editor.stateManager.get('canvas.showGrid') ?? this.editor.level.settings.showGrid;
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




            this.editor.canvasRenderer.drawGrid(
                gridSize,
                camera,
                this.editor.level.settings.backgroundColor,
                {
                    color: gridColor,
                    thickness: gridThickness,
                    opacity: gridOpacity,
                    subdivisions: gridSubdivisions,
                    subdivColor: gridSubdivColor,
                    subdivThickness: gridSubdivThickness,
                    gridType: gridType
                }
            );
        } else {
            // Just draw background without grid
            this.editor.canvasRenderer.clear();
            this.editor.canvasRenderer.ctx.fillStyle = this.editor.level.settings.backgroundColor;
            this.editor.canvasRenderer.ctx.fillRect(0, 0, this.editor.canvasRenderer.canvas.width, this.editor.canvasRenderer.canvas.height);
        }
        
        // Draw objects with frustum culling
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        const visibleObjects = this.getVisibleObjects(camera);

        // Check if parallax mode is enabled
        if (this.parallaxRenderer.isParallaxEnabled()) {
            this.parallaxRenderer.renderParallaxObjects(visibleObjects, camera);
        } else {
            visibleObjects.forEach(obj => {
                this.editor.canvasRenderer.drawObject(obj);
            });
        }
        
        // Draw object boundaries if enabled
        const showObjectBoundaries = this.editor.stateManager.get('view.objectBoundaries');
        if (showObjectBoundaries) {
            this.drawObjectBoundaries();
        }
        
        // Draw object collisions if enabled
        const showObjectCollisions = this.editor.stateManager.get('view.objectCollisions');
        if (showObjectCollisions) {
            this.drawObjectCollisions();
        }
        
        // Draw selection
        this.drawSelection();

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
        this.drawGroupEditFrame();
        
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
        
        // Draw marquee
        if (mouse.marqueeRect) {
            this.editor.canvasRenderer.drawMarquee(mouse.marqueeRect, camera);
        }
        
        // Draw axis constraint line
        if (mouse.constrainedAxis && mouse.isDragging && mouse.axisCenter) {
            const axisConfig = this.editor.configManager.get('editor.axisConstraint') || {};
            this.editor.canvasRenderer.drawAxisConstraint(
                mouse.constrainedAxis, 
                mouse.axisCenter.x, 
                mouse.axisCenter.y, 
                camera, 
                axisConfig
            );
        }
        
        this.editor.canvasRenderer.restoreCamera();

        // Периодический лог состояния (каждые 500 рендеров)
        if (this.renderCount % 500 === 0) {
            const visibleCount = visibleObjects.length;
            Logger.render.info(`🎨 Render #${this.renderCount}: ${visibleCount} visible objects`);
        }
    }


    /**
     * Draw selection outlines
     */
    drawSelection() {
        const selectedObjects = this.editor.stateManager.get('selectedObjects');
        const camera = this.editor.stateManager.get('camera');

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
                        this.drawAltDragSelectionRect(bounds, camera);
                    } else {
                        this.drawSelectionRect(bounds, obj.type === 'group', camera);
                    }
                }
            });
        } else {
            // Normal mode - draw selection for top-level objects only
            this.editor.level.objects.forEach(obj => {
                if (selectedObjects.has(obj.id)) {
                    const effectiveLayerId = this.getEffectiveLayerId(obj);
                    const bounds = this.parallaxRenderer.getObjectWorldBoundsWithParallax(obj, effectiveLayerId);
                    this.drawSelectionRect(bounds, obj.type === 'group', camera);
                }
            });
        }
    }

    drawSelectionRect(bounds, isGroup, camera) {
        const selectionColor = this.editor.settingsManager?.get('selection.outlineColor') || '#3B82F6';
        const outlineWidth = (isGroup
            ? (this.editor.settingsManager?.get('selection.groupOutlineWidth') || 4)
            : (this.editor.settingsManager?.get('selection.outlineWidth') || 2)) / camera.zoom;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = selectionColor;
        this.editor.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.editor.canvasRenderer.ctx.setLineDash(isGroup ? [5, 5] : []);

        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    drawAltDragSelectionRect(bounds, camera) {
        const altDragColor = '#FF6B6B'; // Red color to indicate Alt+drag
        const outlineWidth = 3 / camera.zoom;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = altDragColor;
        this.editor.canvasRenderer.ctx.lineWidth = outlineWidth;
        this.editor.canvasRenderer.ctx.setLineDash([8, 4]); // Dashed line to indicate special mode

        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw group edit mode frame
     */
    drawGroupEditFrame() {
        if (!this.isInGroupEditMode()) return;

        const camera = this.editor.stateManager.get('camera');
        const group = this.getActiveGroup();
        const groupEditMode = this.getGroupEditMode();

        // Draw frame around the group being edited; allow freezing during Alt-drag
        const bounds = (groupEditMode.frameFrozen && groupEditMode.frozenBounds)
            ? groupEditMode.frozenBounds
            : this.editor.objectOperations.getObjectWorldBounds(group);

        // Add padding to show the group boundary clearly
        const padding = 10;
        const minX = bounds.minX - padding;
        const minY = bounds.minY - padding;
        const maxX = bounds.maxX + padding;
        const maxY = bounds.maxY + padding;

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = '#FF6B6B';
        this.editor.canvasRenderer.ctx.lineWidth = 3 / camera.zoom;
        this.editor.canvasRenderer.ctx.setLineDash([10, 5]);
        this.editor.canvasRenderer.ctx.strokeRect(
            minX,
            minY,
            maxX - minX,
            maxY - minY
        );
        this.editor.canvasRenderer.ctx.restore();
    }

    drawHierarchyHighlightForGroup(group, depth = 0) {
        const camera = this.editor.stateManager.get('camera');
        const baseColor = this.editor.settingsManager?.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25; // base alpha
        const decay = 0.6; // alpha decay per depth
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        // Highlight each nested group
        group.children.forEach(child => {
            if (child.type === 'group') {
                const bounds = this.editor.objectOperations.getObjectWorldBounds(child);
                const rgba = RenderUtils.hexToRgba(baseColor, alpha);
                this.editor.canvasRenderer.ctx.save();
                this.editor.canvasRenderer.ctx.fillStyle = rgba;
                this.editor.canvasRenderer.ctx.fillRect(
                    bounds.minX,
                    bounds.minY,
                    bounds.maxX - bounds.minX,
                    bounds.maxY - bounds.minY
                );
                this.editor.canvasRenderer.ctx.restore();

                // Recurse deeper
                this.drawHierarchyHighlightForGroup(child, depth + 1);
            }
        });
    }


    /**
     * Get visible layer IDs for performance optimization
     * @returns {Set<string>} Set of visible layer IDs
     */
    getVisibleLayerIds() {
        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level) {
            Logger.render.warn('Cannot get visible layer IDs: level not available');
            return new Set();
        }

        if (this.visibleLayersCache &&
            performance.now() - this.layerVisibilityCacheTimestamp < this.cacheTimeout) {
            return this.visibleLayersCache;
        }

        // Get all layers and filter visible ones
        const visibleLayers = new Set();
        const layers = this.editor.level.getLayersSorted();

        layers.forEach(layer => {
            if (layer.visible) {
                visibleLayers.add(layer.id);
            }
        });

        // Cache the result
        this.visibleLayersCache = visibleLayers;
        this.layerVisibilityCacheTimestamp = performance.now();

        return visibleLayers;
    }

    /**
     * Invalidate layer visibility cache (call when layer visibility changes)
     */
    invalidateLayerVisibilityCache() {
        this.visibleLayersCache = null;
        this.layerVisibilityCacheTimestamp = 0;
        // Also invalidate visible objects cache since layer visibility affects it
        this.visibleObjectsCache.clear();
        // Invalidate selectable objects cache as well
        this.editor.clearSelectableObjectsCache();
    }

    /**
     * Clear visible objects cache for current camera position
     * More selective than clearing entire cache
     */
    clearVisibleObjectsCacheForCurrentCamera() {
        if (!this.lastCameraState) return;

        const camera = this.editor.stateManager.get('camera');
        if (!camera) return;

        const cameraKey = `${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}`;
        this.visibleObjectsCache.delete(cameraKey);
    }

    /**
     * Clear visible objects cache for specific camera position
     * @param {Object} camera - Camera state to clear cache for
     */
    clearVisibleObjectsCacheForCamera(camera) {
        if (!camera) return;

        const cameraKey = `${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}`;
        this.visibleObjectsCache.delete(cameraKey);
    }

    /**
     * Invalidate spatial index for current level
     * Call when object positions or structure changes
     */
    invalidateSpatialIndex() {
        const levelId = this.editor?.level?.id || 'default';
        this.spatialIndex.delete(levelId);
        // Force rebuild on next access
        this.isBuildingSpatialIndex = false;
    }

    /**
     * Get objects visible in the current viewport (frustum culling) with caching
     */
    /**
     * Обычный метод поиска видимых объектов (fallback)
     */
    getVisibleObjectsRegular(camera) {
        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level || !this.editor.level.objects) {
            return [];
        }

        if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) {
            return [];
        }

        const canvas = this.editor.canvasRenderer.canvas;

        // Проверки на валидность canvas размеров
        if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
            return [];
        }

        if (!camera.zoom || camera.zoom <= 0) {
            return [];
        }

        const viewportLeft = camera.x;
        const viewportTop = camera.y;
        const viewportRight = camera.x + canvas.width / camera.zoom;
        const viewportBottom = camera.y + canvas.height / camera.zoom;

        // Add some padding to avoid objects appearing/disappearing at edges
        let padding = 100;

        // При включенном параллаксе расширяем область поиска, чтобы учесть возможные смещения объектов
        if (this.parallaxRenderer.isParallaxEnabled()) {
            // Расширяем область на максимальное возможное параллакс смещение
            const parallaxRange = Math.abs(camera.x - (this.parallaxRenderer.getParallaxState()?.startPosition?.x || 0)) * 10;
            padding = Math.max(padding, parallaxRange + 200); // +200 для безопасности
        }
        const extendedLeft = viewportLeft - padding;
        const extendedTop = viewportTop - padding;
        const extendedRight = viewportRight + padding;
        const extendedBottom = viewportBottom + padding;
        
        // Get visible layer IDs for performance
        const visibleLayerIds = this.getVisibleLayerIds();

        const visibleObjects = this.editor.level.objects.filter(obj => {
            // Check if object's effective layer is visible (considering inheritance from parent groups)
            const effectiveLayerId = this.getEffectiveLayerId(obj);
            if (!visibleLayerIds.has(effectiveLayerId)) {
                return false;
            }

            // Check if object itself is visible
            if (!obj.visible) {
                return false;
            }

            // Check if object is in viewport
            return this.isObjectVisible(obj, extendedLeft, extendedTop, extendedRight, extendedBottom);
        });

        return visibleObjects;
    }

    getVisibleObjects(camera) {
        // Проверки на существование необходимых объектов
        if (!this.editor || !this.editor.level || !this.editor.level.objects) {
            return [];
        }

        if (!this.editor.canvasRenderer || !this.editor.canvasRenderer.canvas) {
            return [];
        }

        const canvas = this.editor.canvasRenderer.canvas;

        // Проверки на валидность canvas размеров
        if (!canvas.width || !canvas.height || canvas.width <= 0 || canvas.height <= 0) {
            return [];
        }

        if (!camera.zoom || camera.zoom <= 0) {
            return [];
        }

        const currentTime = performance.now();
        const parallaxEnabled = this.parallaxRenderer.isParallaxEnabled();
        const parallaxState = parallaxEnabled ? this.parallaxRenderer.getParallaxState() : null;
        const parallaxKey = parallaxState?.startPosition ? `_${parallaxState.startPosition.x.toFixed(1)},${parallaxState.startPosition.y.toFixed(1)}` : '_off';
        const cameraKey = `${camera.x.toFixed(1)},${camera.y.toFixed(1)},${camera.zoom.toFixed(2)}${parallaxKey}`;

        // Check cache first
        if (this.visibleObjectsCache.has(cameraKey)) {
            const cached = this.visibleObjectsCache.get(cameraKey);
            if (currentTime - cached.timestamp < this.cacheTimeout) {
                return cached.objects;
            }
        }

        // Пытаемся использовать пространственный индекс для быстрого поиска
        let visibleObjects;
        try {
            visibleObjects = this.getVisibleObjectsSpatial(camera);
        } catch (error) {
            Logger.render.warn('Spatial index search failed, falling back to regular method', error);
            visibleObjects = this.getVisibleObjectsRegular(camera);
        }
        
        // Cache the result
        this.visibleObjectsCache.set(cameraKey, {
            objects: visibleObjects,
            timestamp: currentTime
        });
        
        // Clean old cache entries
        if (this.visibleObjectsCache.size > 10) {
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

        // Draw selection outlines using direct bounds calculation (duplicates aren't in level tree)
        objects.forEach(obj => {
            const bounds = this.getDuplicateObjectBounds(obj);
            if (bounds) {
                this.drawSelectionRect(bounds, obj.type === 'group', camera);
            }

            // Draw hierarchy highlight for groups
            if (obj.type === 'group') {
                this.drawDuplicateHierarchyHighlight(obj, 0, 0, 0);
            }
        });
    }

    /**
     * Draw hierarchy highlight for duplicate groups (uses direct bounds calculation)
     */
    drawDuplicateHierarchyHighlight(group, depth = 0, parentX = 0, parentY = 0) {
        const camera = this.editor.stateManager.get('camera');
        const baseColor = this.editor.settingsManager?.get('selection.hierarchyHighlightColor') || '#3B82F6';
        const maxAlpha = 0.25; // base alpha
        const decay = 0.6; // alpha decay per depth
        const alpha = Math.max(0, maxAlpha * Math.pow(decay, depth));

        if (!group || !group.children) return;

        const groupAbsX = parentX + group.x;
        const groupAbsY = parentY + group.y;

        // Highlight each nested group
        group.children.forEach(child => {
            if (child.type === 'group') {
                const bounds = this.getDuplicateObjectBounds(child, groupAbsX, groupAbsY);
                const rgba = RenderUtils.hexToRgba(baseColor, alpha);
                this.editor.canvasRenderer.ctx.save();
                this.editor.canvasRenderer.ctx.fillStyle = rgba;
                this.editor.canvasRenderer.ctx.fillRect(
                    bounds.minX,
                    bounds.minY,
                    bounds.maxX - bounds.minX,
                    bounds.maxY - bounds.minY
                );
                this.editor.canvasRenderer.ctx.restore();

                // Recurse deeper with updated parent coordinates
                this.drawDuplicateHierarchyHighlight(child, depth + 1, groupAbsX, groupAbsY);
            }
        });
    }

    /**
     * Get bounds for duplicate object (direct calculation without level tree search)
     */
    getDuplicateObjectBounds(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;

        if (obj.type !== 'group') {
            // Simple object - return its direct bounds
            return {
                minX: absX,
                minY: absY,
                maxX: absX + (obj.width || 0),
                maxY: absY + (obj.height || 0)
            };
        }

        // Group object - calculate bounds from all children
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        const walkChildren = (current, baseX, baseY) => {
            const currentAbsX = baseX + current.x;
            const currentAbsY = baseY + current.y;

            if (current.type === 'group' && current.children) {
                // Recursively walk group children
                for (const child of current.children) {
                    walkChildren(child, currentAbsX, currentAbsY);
                }
            } else {
                // Regular object - add to bounds
                bounds.minX = Math.min(bounds.minX, currentAbsX);
                bounds.minY = Math.min(bounds.minY, currentAbsY);
                bounds.maxX = Math.max(bounds.maxX, currentAbsX + (current.width || 0));
                bounds.maxY = Math.max(bounds.maxY, currentAbsY + (current.height || 0));
            }
        };

        // Walk all children
        if (obj.children && obj.children.length > 0) {
            for (const child of obj.children) {
                walkChildren(child, absX, absY);
            }
        }

        // If no valid bounds found (empty group), use group's position
        if (bounds.minX === Infinity) {
            bounds.minX = absX;
            bounds.minY = absY;
            bounds.maxX = absX;
            bounds.maxY = absY;
        }

        return bounds;
    }

    /**
     * Draw single duplicate object recursively
     */
    drawDuplicateObject(obj, parentX = 0, parentY = 0) {
        const absX = obj.x + parentX;
        const absY = obj.y + parentY;

        if (obj.type === 'group') {
            // Draw group children
            if (obj.children && obj.children.length > 0) {
                obj.children.forEach(child => {
                    this.drawDuplicateObject(child, absX, absY);
                });
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
     * Draw object boundaries for debugging
     */
    drawObjectBoundaries() {
        // Get visible layer IDs for filtering
        const visibleLayerIds = this.getVisibleLayerIds();

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.editor.canvasRenderer.ctx.lineWidth = 1;
        this.editor.canvasRenderer.ctx.setLineDash([2, 2]);

        // Only draw boundaries for visible top-level objects
        this.editor.level.objects.forEach(obj => {
            // Check if object is visible and in visible layer
            if (obj.visible && visibleLayerIds.has(this.getEffectiveLayerId(obj))) {
                if (obj.type === 'group') {
                    this.drawGroupBoundaries(obj);
                } else {
                    this.drawSingleObjectBoundary(obj);
                }
            }
        });

        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw boundaries for a single object
     */
    drawSingleObjectBoundary(obj) {
        const worldPos = this.editor.objectOperations.getObjectWorldPosition(obj);
        const width = obj.width || 32;
        const height = obj.height || 32;
        
        this.editor.canvasRenderer.ctx.strokeRect(
            worldPos.x, 
            worldPos.y, 
            width, 
            height
        );
    }

    /**
     * Draw boundaries for a group and its children
     */
    drawGroupBoundaries(group) {
        // Get bounds same way as selection does
        const bounds = this.editor.objectOperations.getObjectWorldBounds(group);
        const camera = this.editor.stateManager.get('camera');

        // Draw group boundary using exact same logic as drawSelectionRect
        this.editor.canvasRenderer.ctx.save();

        // Use object boundaries style instead of selection style
        this.editor.canvasRenderer.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        this.editor.canvasRenderer.ctx.lineWidth = 1;
        this.editor.canvasRenderer.ctx.setLineDash([2, 2]);

        // Use exact same coordinates as selection (bounds.minX, bounds.minY, etc.)
        this.editor.canvasRenderer.ctx.strokeRect(
            bounds.minX,
            bounds.minY,
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        );

        this.editor.canvasRenderer.ctx.restore();

        // Draw children boundaries
        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupBoundaries(child);
                } else {
                    this.drawSingleObjectBoundary(child);
                }
            });
        }
    }

    /**
     * Draw object collision boxes for debugging
     */
    drawObjectCollisions() {
        // Get visible layer IDs for filtering
        const visibleLayerIds = this.getVisibleLayerIds();

        this.editor.canvasRenderer.ctx.save();
        this.editor.canvasRenderer.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        this.editor.canvasRenderer.ctx.lineWidth = 2;
        this.editor.canvasRenderer.ctx.setLineDash([]);

        // Only draw collisions for visible top-level objects
        this.editor.level.objects.forEach(obj => {
            // Check if object is visible and in visible layer
            if (obj.visible && visibleLayerIds.has(this.getEffectiveLayerId(obj))) {
                if (obj.type === 'group') {
                    this.drawGroupCollisions(obj);
                } else {
                    this.drawSingleObjectCollision(obj);
                }
            }
        });

        this.editor.canvasRenderer.ctx.restore();
    }

    /**
     * Draw collision box for a single object
     */
    drawSingleObjectCollision(obj) {
        const worldPos = this.editor.objectOperations.getObjectWorldPosition(obj);
        const width = obj.width || 32;
        const height = obj.height || 32;
        
        // Draw collision box (same as boundary for now, but could be different)
        this.editor.canvasRenderer.ctx.strokeRect(
            worldPos.x, 
            worldPos.y, 
            width, 
            height
        );
        
        // Draw collision center point
        this.editor.canvasRenderer.ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        this.editor.canvasRenderer.ctx.fillRect(
            worldPos.x + width/2 - 2, 
            worldPos.y + height/2 - 2, 
            4, 
            4
        );
    }

    /**
     * Draw collision boxes for a group and its children
     */
    drawGroupCollisions(group) {
        // Draw group collision
        this.drawSingleObjectCollision(group);

        // Draw children collisions
        if (group.children) {
            group.children.forEach(child => {
                if (child.type === 'group') {
                    this.drawGroupCollisions(child);
                } else {
                    this.drawSingleObjectCollision(child);
                }
            });
        }
    }

    /**
     * Get effective layer ID for an object, considering inheritance from parent groups
     * @param {GameObject} obj - Object to get layer ID for
     * @returns {string} Effective layer ID
     */
    getEffectiveLayerId(obj) {
        // Проверки на существование необходимых объектов
        if (!obj || !obj.id) {
            Logger.render.warn('Cannot get effective layer ID: object or object.id not available');
            return null;
        }

        if (!this.editor) {
            Logger.render.warn('Cannot get effective layer ID: editor not available');
            return null;
        }

        // Use cached result if available
        if (this.editor.effectiveLayerCache && this.editor.effectiveLayerCache.has(obj.id)) {
            return this.editor.effectiveLayerCache.get(obj.id);
        }

        let effectiveLayerId;

        // If object has its own layerId, use it
        if (obj.layerId) {
            effectiveLayerId = obj.layerId;
        } else {
            // Try to find the object in the hierarchy and get parent's layerId
            effectiveLayerId = this.findParentLayerId(obj);
        }

        // Cache the result
        if (this.editor.effectiveLayerCache) {
            this.editor.effectiveLayerCache.set(obj.id, effectiveLayerId);
        }

        return effectiveLayerId;
    }

    /**
     * Clear the effective layer ID cache
     */
    clearEffectiveLayerCache() {
        if (this.editor && this.editor.effectiveLayerCache) {
            this.editor.effectiveLayerCache.clear();
        }
    }

    /**
     * Clear cache for specific object
     * @param {string} objId - Object ID to clear from cache
     */
    clearEffectiveLayerCacheForObject(objId) {
        if (this.editor && this.editor.effectiveLayerCache) {
            this.editor.effectiveLayerCache.delete(objId);
        }
    }

    /**
     * Find parent layer ID for object without caching (internal method)
     * @param {Object} obj - Object to find parent layer for
     * @returns {string} Parent layer ID or main layer ID
     */
    findParentLayerId(obj) {
        // First check if object is at top level
        const topLevelObject = this.editor.level.objects.find(topObj => topObj.id === obj.id);
        if (topLevelObject) {
            // Object is at top level, use its own layerId or main layer
            return topLevelObject.layerId || this.editor.level.getMainLayerId();
        }

        // Search recursively in all groups
        for (const topLevelObj of this.editor.level.objects) {
            if (topLevelObj.type === 'group') {
                const result = this.searchInGroupForLayerId(topLevelObj, obj);
                if (result) {
                    return result;
                }
            }
        }

        // If not found in any group, use main layer
        return this.editor.level.getMainLayerId();
    }

    /**
     * Recursively search for object in group hierarchy and return parent's layerId
     * @param {Group} group - Group to search in
     * @param {GameObject} targetObj - Object to find
     * @returns {string|null} Parent's layerId or null if not found
     */
    searchInGroupForLayerId(group, targetObj, visitedGroups = new Set()) {
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
                    return this.findParentLayerId(group);
                }
            }

            // Search recursively in child groups
            if (child.type === 'group') {
                const result = this.searchInGroupForLayerId(child, targetObj, visitedGroups);
                if (result) return result;
            }
        }

        return null;
    }

}
