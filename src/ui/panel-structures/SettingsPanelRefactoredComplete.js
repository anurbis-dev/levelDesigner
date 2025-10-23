/**
 * Settings Panel - Complete Refactored Version
 * 
 * This file contains all refactored render methods for SettingsPanel
 * using the SettingsSectionConstructor for consistent styling and maintainability.
 * 
 * @author Level Designer
 * @version 3.52.1
 */

import { 
    createSettingsSection, 
    createSettingsFormGroup, 
    createSettingsGrid, 
    createSettingsCheckbox, 
    createSettingsRange, 
    createSettingsColorInput, 
    createSettingsInput, 
    createSettingsLabel, 
    createSettingsContainer 
} from './SettingsSectionConstructor.js';
import { ColorUtils } from '../../utils/ColorUtils.js';

/**
 * Render General Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for general settings
 */
export function renderGeneralSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        ui: {
            showTooltips: stateManager.get('ui.showTooltips'),
            fontScale: stateManager.get('ui.fontScale'),
            spacing: stateManager.get('ui.spacing'),
            backgroundColor: stateManager.get('ui.backgroundColor') || '#1f2937',
            textColor: stateManager.get('ui.textColor') || '#d1d5db',
            activeColor: stateManager.get('ui.activeColor') || '#3b82f6',
            activeTextColor: stateManager.get('ui.activeTextColor') || '#ffffff',
            activeTabColor: stateManager.get('ui.activeTabColor') || '#374151'
        },
        canvas: {
            backgroundColor: stateManager.get('canvas.backgroundColor') || '#4b5563'
        },
        editor: {
            autoSave: stateManager.get('editor.autoSave'),
            autoSaveInterval: stateManager.get('editor.autoSaveInterval'),
            undoHistoryLimit: stateManager.get('editor.undoHistoryLimit'),
            axisConstraint: {
                showAxis: stateManager.get('editor.axisConstraint.showAxis'),
                axisColor: stateManager.get('editor.axisConstraint.axisColor'),
                axisWidth: stateManager.get('editor.axisConstraint.axisWidth')
            }
        }
    };
    
    // Create UI Settings section
    const uiSettingsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'ui-show-tooltips',
                dataSetting: 'ui.showTooltips',
                checked: settings.ui?.showTooltips,
                label: 'Show Tooltips'
            })}
        </div>
        
        ${createSettingsGrid(`
            <div>
                ${createSettingsRange({
                    id: 'ui-font-scale',
                    dataSetting: 'ui.fontScale',
                    value: settings.ui?.fontScale || 1.0,
                    min: 0.5,
                    max: 2,
                    step: 0.1,
                    label: 'Font Scale'
                })}
            </div>
            <div>
                ${createSettingsRange({
                    id: 'ui-spacing',
                    dataSetting: 'ui.spacing',
                    value: settings.ui?.spacing || 1.0,
                    min: 0,
                    max: 2,
                    step: 0.1,
                    label: 'Spacing'
                })}
            </div>
        `, { columns: 2, gap: '1rem' })}
    `);

    // Create Editor Settings section
    const editorSettingsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'editor-auto-save',
                dataSetting: 'editor.autoSave',
                checked: settings.editor?.autoSave,
                label: 'Auto Save'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Auto Save Interval (minutes)', 'auto-save-interval')}
            ${createSettingsInput({
                type: 'number',
                id: 'auto-save-interval',
                dataSetting: 'editor.autoSaveInterval',
                value: settings.editor?.autoSaveInterval || 5,
                min: 1,
                max: 60,
                step: 1
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Undo History Limit', 'undo-history-limit')}
            ${createSettingsInput({
                type: 'number',
                id: 'undo-history-limit',
                dataSetting: 'editor.undoHistoryLimit',
                value: settings.editor?.undoHistoryLimit || 100,
                min: 10,
                max: 1000,
                step: 10
            })}
        </div>
    `);
    
    // Create View Settings section
    const viewSettingsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'editor-game-mode',
                dataSetting: 'editor.view.gameMode',
                checked: settings.editor.view?.gameMode,
                label: 'Immersive Mode'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'editor-object-boundaries',
                dataSetting: 'editor.view.objectBoundaries',
                checked: settings.editor.view?.objectBoundaries,
                label: 'Object Boundaries'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'editor-object-collisions',
                dataSetting: 'editor.view.objectCollisions',
                checked: settings.editor.view?.objectCollisions,
                label: 'Object Collisions'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'editor-parallax',
                dataSetting: 'editor.view.parallax',
                checked: settings.editor.view?.parallax,
                label: 'Parallax'
            })}
        </div>
    `);
    
    return `
        <h3>General Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('UI Settings', uiSettingsContent)}
            ${createSettingsSection('Editor Settings', editorSettingsContent)}
            ${createSettingsSection('View Settings', viewSettingsContent, { 
                border: false, 
                padding: false, 
                borderRadius: false,
                className: 'settings-divider'
            })}
        `)}
    `;
}

/**
 * Render Colors Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for colors settings
 */
export function renderColorsSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';

    // Get current color values from StateManager
    const colors = {
        // UI Colors
        ui: {
            backgroundColor: stateManager.get('ui.backgroundColor') || '#1f2937',
            textColor: stateManager.get('ui.textColor') || '#d1d5db',
            activeColor: stateManager.get('ui.activeColor') || '#3b82f6',
            activeTextColor: stateManager.get('ui.activeTextColor') || '#ffffff',
            activeTabColor: stateManager.get('ui.activeTabColor') || '#374151',
            resizerColor: stateManager.get('ui.resizerColor') || '#374151',
            accentColor: stateManager.get('ui.accentColor') || '#3B82F6'
        },
        // Canvas Colors
        canvas: {
            backgroundColor: stateManager.get('canvas.backgroundColor') || '#4b5563'
        },
        // Selection Colors
        selection: {
            outlineColor: stateManager.get('selection.outlineColor') || '#3B82F6',
            groupOutlineColor: stateManager.get('selection.groupOutlineColor') || '#3B82F6',
            marqueeColor: stateManager.get('selection.marqueeColor') || '#3B82F6',
            hierarchyHighlightColor: stateManager.get('selection.hierarchyHighlightColor') || '#3B82F6',
            activeLayerBorderColor: stateManager.get('selection.activeLayerBorderColor') || '#3B82F6'
        },
        // Grid Colors
        grid: {
            color: stateManager.get('canvas.gridColor') || 'rgba(255, 255, 255, 0.1)',
            subdivColor: stateManager.get('canvas.gridSubdivColor') || '#666666'
        },
        // Logger Colors
        logger: stateManager.get('logger.colors') || {
            DUPLICATE: '#4CAF50',
            RENDER: '#2196F3',
            CANVAS: '#FF9800',
            MOUSE: '#9C27B0',
            EVENT: '#607D8B',
            GROUP: '#795548',
            STATE: '#E91E63',
            FILE: '#009688',
            ASSET: '#FF5722',
            UI: '#3F51B5',
            MENU: '#FF9800',
            PERFORMANCE: '#CDDC39',
            DEBUG: '#9E9E9E',
            GIT: '#FF6B35',
            CONSOLE: '#00BCD4',
            LAYOUT: '#8BC34A',
            SETTINGS: '#FFC107',
            PREFERENCES: '#673AB7',
            CONFIG: '#00E676',
            LAYER: '#03A9F4',
            LEVEL: '#8BC34A',
            CACHE: '#4CAF50',
            OUTLINER: '#9C27B0',
            PARALLAX: '#FF1493',
            OBJECT_OPERATIONS: '#9C27B0',
            LIFECYCLE: '#00BCD4',
            ERROR_HANDLER: '#F44336',
            VIEWPORT: '#00ACC1'
        }
    };

    // Create UI Colors section
    const uiColorsContent = createSettingsGrid(`
        ${createSettingsColorInput({
            id: 'ui-background-color',
            dataSetting: 'ui.backgroundColor',
            value: colors.ui.backgroundColor,
            label: 'UI Background'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-text-color',
            dataSetting: 'ui.textColor',
            value: colors.ui.textColor,
            label: 'UI Text Color'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-resizer-color',
            dataSetting: 'ui.resizerColor',
            value: colors.ui.resizerColor,
            label: 'Panel Resizers'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-active-color',
            dataSetting: 'ui.activeColor',
            value: colors.ui.activeColor,
            label: 'Active Elements'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-active-text-color',
            dataSetting: 'ui.activeTextColor',
            value: colors.ui.activeTextColor,
            label: 'Active Text Color'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-active-tab-color',
            dataSetting: 'ui.activeTabColor',
            value: colors.ui.activeTabColor,
            label: 'Active Tab Color'
        })}
        
        ${createSettingsColorInput({
            id: 'ui-accent-color',
            dataSetting: 'ui.accentColor',
            value: colors.ui.accentColor,
            label: 'Accent Color'
        })}
    `, { columns: 2, gap: '1rem' });

    // Create Canvas Colors section
    const canvasColorsContent = createSettingsGrid(`
        ${createSettingsColorInput({
            id: 'canvas-background-color',
            dataSetting: 'canvas.backgroundColor',
            value: colors.canvas.backgroundColor,
            label: 'Canvas Background'
        })}
        
        ${createSettingsColorInput({
            id: 'canvas-grid-color',
            dataSetting: 'canvas.gridColor',
            value: ColorUtils.toHex(colors.grid.color),
            label: 'Grid Color'
        })}
        
        ${createSettingsColorInput({
            id: 'canvas-grid-subdiv-color',
            dataSetting: 'canvas.gridSubdivColor',
            value: colors.grid.subdivColor,
            label: 'Grid Subdivision'
        })}
    `, { columns: 2, gap: '1rem' });

    // Create Selection Colors section
    const selectionColorsContent = createSettingsGrid(`
        ${createSettingsColorInput({
            id: 'selection-outline-color',
            dataSetting: 'selection.outlineColor',
            value: colors.selection.outlineColor,
            label: 'Selection Outline'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-group-outline-color',
            dataSetting: 'selection.groupOutlineColor',
            value: colors.selection.groupOutlineColor,
            label: 'Group Outline'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-marquee-color',
            dataSetting: 'selection.marqueeColor',
            value: colors.selection.marqueeColor,
            label: 'Marquee Color'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-hierarchy-highlight-color',
            dataSetting: 'selection.hierarchyHighlightColor',
            value: colors.selection.hierarchyHighlightColor,
            label: 'Hierarchy Highlight'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-active-layer-border-color',
            dataSetting: 'selection.activeLayerBorderColor',
            value: colors.selection.activeLayerBorderColor,
            label: 'Active Layer Border'
        })}
    `, { columns: 2, gap: '1rem' });

    // Create Logger Colors section
    const loggerColorsContent = createSettingsGrid(`
        ${Object.entries(colors.logger).map(([category, color]) => 
            createSettingsColorInput({
                id: `logger-color-${category}`,
                dataSetting: `logger.colors.${category}`,
                value: color,
                label: category,
                width: '2.5rem',
                height: '1.5rem'
            })
        ).join('')}
    `, { columns: 4, gap: '0.5rem' });
    
    return `
        <h3>Color Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('UI Colors', uiColorsContent)}
            ${createSettingsSection('Canvas Colors', canvasColorsContent)}
            ${createSettingsSection('Selection Colors', selectionColorsContent)}
            ${createSettingsSection('Logger Colors', loggerColorsContent)}
        `)}
    `;
}

/**
 * Render Selection Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for selection settings
 */
export function renderSelectionSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        editor: {
            multiSelectMode: stateManager.get('editor.multiSelectMode') || 'additive'
        },
        selection: {
            outlineColor: stateManager.get('selection.outlineColor') || '#3B82F6',
            outlineWidth: stateManager.get('selection.outlineWidth') || 2,
            groupOutlineColor: stateManager.get('selection.groupOutlineColor') || '#3B82F6',
            groupOutlineWidth: stateManager.get('selection.groupOutlineWidth') || 4,
            marqueeColor: stateManager.get('selection.marqueeColor') || '#3B82F6',
            marqueeOpacity: stateManager.get('selection.marqueeOpacity') || 0.2,
            hierarchyHighlightColor: stateManager.get('selection.hierarchyHighlightColor') || '#3B82F6'
        }
    };

    // Create Selection Behavior section
    const selectionBehaviorContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Multi-Select Mode', 'multi-select-mode')}
            ${createSettingsInput({
                type: 'select',
                id: 'multi-select-mode',
                dataSetting: 'editor.multiSelectMode',
                value: settings.editor.multiSelectMode,
                options: [
                    { value: 'additive', label: 'Additive' },
                    { value: 'replace', label: 'Replace' }
                ]
            })}
        </div>
    `);

    // Create Selection Visual section
    const selectionVisualContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Outline Width', 'selection-outline-width')}
            ${createSettingsRange({
                id: 'selection-outline-width',
                dataSetting: 'selection.outlineWidth',
                value: settings.selection.outlineWidth,
                min: 1,
                max: 10,
                step: 1,
                label: 'Outline Width'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Group Outline Width', 'selection-group-outline-width')}
            ${createSettingsRange({
                id: 'selection-group-outline-width',
                dataSetting: 'selection.groupOutlineWidth',
                value: settings.selection.groupOutlineWidth,
                min: 1,
                max: 10,
                step: 1,
                label: 'Group Outline Width'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Marquee Opacity', 'selection-marquee-opacity')}
            ${createSettingsRange({
                id: 'selection-marquee-opacity',
                dataSetting: 'selection.marqueeOpacity',
                value: settings.selection.marqueeOpacity,
                min: 0.1,
                max: 1.0,
                step: 0.1,
                label: 'Marquee Opacity'
            })}
        </div>
    `);

    // Create Selection Colors section
    const selectionColorsContent = createSettingsGrid(`
        ${createSettingsColorInput({
            id: 'selection-outline-color',
            dataSetting: 'selection.outlineColor',
            value: settings.selection.outlineColor,
            label: 'Selection Outline'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-group-outline-color',
            dataSetting: 'selection.groupOutlineColor',
            value: settings.selection.groupOutlineColor,
            label: 'Group Outline'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-marquee-color',
            dataSetting: 'selection.marqueeColor',
            value: settings.selection.marqueeColor,
            label: 'Marquee Color'
        })}
        
        ${createSettingsColorInput({
            id: 'selection-hierarchy-highlight-color',
            dataSetting: 'selection.hierarchyHighlightColor',
            value: settings.selection.hierarchyHighlightColor,
            label: 'Hierarchy Highlight'
        })}
    `, { columns: 2, gap: '1rem' });
    
    return `
        <h3>Selection Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Selection Behavior', selectionBehaviorContent)}
            ${createSettingsSection('Selection Visual', selectionVisualContent)}
            ${createSettingsSection('Selection Colors', selectionColorsContent)}
        `)}
    `;
}

/**
 * Render Touch Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for touch settings
 */
export function renderTouchSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        touch: {
            enabled: stateManager.get('touch.enabled'),
            gestures: stateManager.get('touch.gestures'),
            sensitivity: stateManager.get('touch.sensitivity') || 1.0,
            longPressDelay: stateManager.get('touch.longPressDelay') || 500,
            doubleTapDelay: stateManager.get('touch.doubleTapDelay') || 300,
            pinchThreshold: stateManager.get('touch.pinchThreshold') || 0.1,
            swipeThreshold: stateManager.get('touch.swipeThreshold') || 50
        }
    };

    // Create Touch Configuration section
    const touchConfigContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'touch-enabled',
                dataSetting: 'touch.enabled',
                checked: settings.touch?.enabled,
                label: 'Enable Touch Support'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'touch-gestures',
                dataSetting: 'touch.gestures',
                checked: settings.touch?.gestures,
                label: 'Enable Touch Gestures'
            })}
        </div>
    `);

    // Create Touch Sensitivity section
    const touchSensitivityContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Touch Sensitivity', 'touch-sensitivity')}
            ${createSettingsRange({
                id: 'touch-sensitivity',
                dataSetting: 'touch.sensitivity',
                value: settings.touch?.sensitivity || 1.0,
                min: 0.1,
                max: 3.0,
                step: 0.1,
                label: 'Touch Sensitivity'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Long Press Delay (ms)', 'touch-long-press-delay')}
            ${createSettingsRange({
                id: 'touch-long-press-delay',
                dataSetting: 'touch.longPressDelay',
                value: settings.touch?.longPressDelay || 500,
                min: 100,
                max: 2000,
                step: 50,
                label: 'Long Press Delay'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Double Tap Delay (ms)', 'touch-double-tap-delay')}
            ${createSettingsRange({
                id: 'touch-double-tap-delay',
                dataSetting: 'touch.doubleTapDelay',
                value: settings.touch?.doubleTapDelay || 300,
                min: 100,
                max: 1000,
                step: 50,
                label: 'Double Tap Delay'
            })}
        </div>
    `);

    // Create Touch Thresholds section
    const touchThresholdsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Pinch Threshold', 'touch-pinch-threshold')}
            ${createSettingsRange({
                id: 'touch-pinch-threshold',
                dataSetting: 'touch.pinchThreshold',
                value: settings.touch?.pinchThreshold || 0.1,
                min: 0.01,
                max: 1.0,
                step: 0.01,
                label: 'Pinch Threshold'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Swipe Threshold (px)', 'touch-swipe-threshold')}
            ${createSettingsRange({
                id: 'touch-swipe-threshold',
                dataSetting: 'touch.swipeThreshold',
                value: settings.touch?.swipeThreshold || 50,
                min: 10,
                max: 200,
                step: 5,
                label: 'Swipe Threshold'
            })}
        </div>
    `);
    
    return `
        <h3>Touch Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Touch Configuration', touchConfigContent)}
            ${createSettingsSection('Touch Sensitivity', touchSensitivityContent)}
            ${createSettingsSection('Touch Thresholds', touchThresholdsContent)}
        `)}
    `;
}

/**
 * Render Camera Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for camera settings
 */
export function renderCameraSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        camera: {
            zoomSpeed: stateManager.get('camera.zoomSpeed') || 0.1,
            panSpeed: stateManager.get('camera.panSpeed') || 1.0,
            minZoom: stateManager.get('camera.minZoom') || 0.1,
            maxZoom: stateManager.get('camera.maxZoom') || 10.0,
            smoothZoom: stateManager.get('camera.smoothZoom'),
            smoothPan: stateManager.get('camera.smoothPan'),
            inertia: stateManager.get('camera.inertia'),
            inertiaDeceleration: stateManager.get('camera.inertiaDeceleration') || 0.95
        }
    };

    // Create Camera Behavior section
    const cameraBehaviorContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'camera-smooth-zoom',
                dataSetting: 'camera.smoothZoom',
                checked: settings.camera?.smoothZoom,
                label: 'Smooth Zoom'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'camera-smooth-pan',
                dataSetting: 'camera.smoothPan',
                checked: settings.camera?.smoothPan,
                label: 'Smooth Pan'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'camera-inertia',
                dataSetting: 'camera.inertia',
                checked: settings.camera?.inertia,
                label: 'Camera Inertia'
            })}
        </div>
    `);

    // Create Camera Speed section
    const cameraSpeedContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Zoom Speed', 'camera-zoom-speed')}
            ${createSettingsRange({
                id: 'camera-zoom-speed',
                dataSetting: 'camera.zoomSpeed',
                value: settings.camera?.zoomSpeed || 0.1,
                min: 0.01,
                max: 1.0,
                step: 0.01,
                label: 'Zoom Speed'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Pan Speed', 'camera-pan-speed')}
            ${createSettingsRange({
                id: 'camera-pan-speed',
                dataSetting: 'camera.panSpeed',
                value: settings.camera?.panSpeed || 1.0,
                min: 0.1,
                max: 5.0,
                step: 0.1,
                label: 'Pan Speed'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Inertia Deceleration', 'camera-inertia-deceleration')}
            ${createSettingsRange({
                id: 'camera-inertia-deceleration',
                dataSetting: 'camera.inertiaDeceleration',
                value: settings.camera?.inertiaDeceleration || 0.95,
                min: 0.8,
                max: 0.99,
                step: 0.01,
                label: 'Inertia Deceleration'
            })}
        </div>
    `);

    // Create Camera Limits section
    const cameraLimitsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Minimum Zoom', 'camera-min-zoom')}
            ${createSettingsRange({
                id: 'camera-min-zoom',
                dataSetting: 'camera.minZoom',
                value: settings.camera?.minZoom || 0.1,
                min: 0.01,
                max: 1.0,
                step: 0.01,
                label: 'Minimum Zoom'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Maximum Zoom', 'camera-max-zoom')}
            ${createSettingsRange({
                id: 'camera-max-zoom',
                dataSetting: 'camera.maxZoom',
                value: settings.camera?.maxZoom || 10.0,
                min: 1.0,
                max: 50.0,
                step: 1.0,
                label: 'Maximum Zoom'
            })}
        </div>
    `);
    
    return `
        <h3>Camera Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Camera Behavior', cameraBehaviorContent)}
            ${createSettingsSection('Camera Speed', cameraSpeedContent)}
            ${createSettingsSection('Camera Limits', cameraLimitsContent)}
        `)}
    `;
}

/**
 * Render Assets Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for assets settings
 */
export function renderAssetsSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        assets: {
            autoLoad: stateManager.get('assets.autoLoad'),
            cacheEnabled: stateManager.get('assets.cacheEnabled'),
            maxCacheSize: stateManager.get('assets.maxCacheSize') || 100,
            compressionQuality: stateManager.get('assets.compressionQuality') || 0.8,
            generateThumbnails: stateManager.get('assets.generateThumbnails'),
            thumbnailSize: stateManager.get('assets.thumbnailSize') || 128
        }
    };

    // Create Asset Loading section
    const assetLoadingContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'assets-auto-load',
                dataSetting: 'assets.autoLoad',
                checked: settings.assets?.autoLoad,
                label: 'Auto Load Assets'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'assets-cache-enabled',
                dataSetting: 'assets.cacheEnabled',
                checked: settings.assets?.cacheEnabled,
                label: 'Enable Asset Caching'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'assets-generate-thumbnails',
                dataSetting: 'assets.generateThumbnails',
                checked: settings.assets?.generateThumbnails,
                label: 'Generate Thumbnails'
            })}
        </div>
    `);

    // Create Asset Performance section
    const assetPerformanceContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Max Cache Size (MB)', 'assets-max-cache-size')}
            ${createSettingsRange({
                id: 'assets-max-cache-size',
                dataSetting: 'assets.maxCacheSize',
                value: settings.assets?.maxCacheSize || 100,
                min: 10,
                max: 1000,
                step: 10,
                label: 'Max Cache Size'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Compression Quality', 'assets-compression-quality')}
            ${createSettingsRange({
                id: 'assets-compression-quality',
                dataSetting: 'assets.compressionQuality',
                value: settings.assets?.compressionQuality || 0.8,
                min: 0.1,
                max: 1.0,
                step: 0.1,
                label: 'Compression Quality'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Thumbnail Size (px)', 'assets-thumbnail-size')}
            ${createSettingsRange({
                id: 'assets-thumbnail-size',
                dataSetting: 'assets.thumbnailSize',
                value: settings.assets?.thumbnailSize || 128,
                min: 64,
                max: 512,
                step: 32,
                label: 'Thumbnail Size'
            })}
        </div>
    `);
    
    return `
        <h3>Assets Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Asset Loading', assetLoadingContent)}
            ${createSettingsSection('Asset Performance', assetPerformanceContent)}
        `)}
    `;
}

/**
 * Render Performance Settings with refactored constructors
 * @param {Object} stateManager - StateManager instance
 * @returns {string} - HTML string for performance settings
 */
export function renderPerformanceSettingsRefactored(stateManager) {
    if (!stateManager) return '<div>Error: StateManager not available</div>';
    
    // Get current values from StateManager
    const settings = {
        performance: {
            targetFPS: stateManager.get('performance.targetFPS') || 60,
            maxObjects: stateManager.get('performance.maxObjects') || 1000,
            enableVSync: stateManager.get('performance.enableVSync'),
            enableAntiAliasing: stateManager.get('performance.enableAntiAliasing'),
            renderDistance: stateManager.get('performance.renderDistance') || 1000,
            lodEnabled: stateManager.get('performance.lodEnabled'),
            lodLevels: stateManager.get('performance.lodLevels') || 3
        }
    };

    // Create Performance Targets section
    const performanceTargetsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('Target FPS', 'performance-target-fps')}
            ${createSettingsRange({
                id: 'performance-target-fps',
                dataSetting: 'performance.targetFPS',
                value: settings.performance?.targetFPS || 60,
                min: 30,
                max: 144,
                step: 15,
                label: 'Target FPS'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Max Objects', 'performance-max-objects')}
            ${createSettingsRange({
                id: 'performance-max-objects',
                dataSetting: 'performance.maxObjects',
                value: settings.performance?.maxObjects || 1000,
                min: 100,
                max: 10000,
                step: 100,
                label: 'Max Objects'
            })}
        </div>
        
        <div>
            ${createSettingsLabel('Render Distance', 'performance-render-distance')}
            ${createSettingsRange({
                id: 'performance-render-distance',
                dataSetting: 'performance.renderDistance',
                value: settings.performance?.renderDistance || 1000,
                min: 100,
                max: 5000,
                step: 100,
                label: 'Render Distance'
            })}
        </div>
    `);

    // Create Performance Features section
    const performanceFeaturesContent = createSettingsFormGroup(`
        <div>
            ${createSettingsCheckbox({
                id: 'performance-enable-vsync',
                dataSetting: 'performance.enableVSync',
                checked: settings.performance?.enableVSync,
                label: 'Enable VSync'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'performance-enable-antialiasing',
                dataSetting: 'performance.enableAntiAliasing',
                checked: settings.performance?.enableAntiAliasing,
                label: 'Enable Anti-Aliasing'
            })}
        </div>
        
        <div>
            ${createSettingsCheckbox({
                id: 'performance-lod-enabled',
                dataSetting: 'performance.lodEnabled',
                checked: settings.performance?.lodEnabled,
                label: 'Enable Level of Detail (LOD)'
            })}
        </div>
    `);

    // Create LOD Settings section
    const lodSettingsContent = createSettingsFormGroup(`
        <div>
            ${createSettingsLabel('LOD Levels', 'performance-lod-levels')}
            ${createSettingsRange({
                id: 'performance-lod-levels',
                dataSetting: 'performance.lodLevels',
                value: settings.performance?.lodLevels || 3,
                min: 1,
                max: 5,
                step: 1,
                label: 'LOD Levels'
            })}
        </div>
    `);
    
    return `
        <h3>Performance Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Performance Targets', performanceTargetsContent)}
            ${createSettingsSection('Performance Features', performanceFeaturesContent)}
            ${createSettingsSection('LOD Settings', lodSettingsContent)}
        `)}
    `;
}
