import { ColorChooser } from '../widgets/ColorChooser.js';
import { GridSettings } from './GridSettings.js';
import { RenderUtils } from '../utils/RenderUtils.js';
import { SettingsSyncManager } from '../utils/SettingsSyncManager.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { eventHandlerManager } from '../managers/EventHandlerManager.js';
import { EventHandlerUtils } from '../utils/EventHandlerUtils.js';

/**
 * Settings Panel UI Component
 */
export class SettingsPanel {
    constructor(container, configManager, levelEditor = null) {
        this.container = container;
        this.configManager = configManager;
        this.levelEditor = levelEditor;
        this.isVisible = false;
        this.lastActiveTab = 'general'; // Default tab

        // Track event listeners for cleanup
        this.eventListeners = [];

        // Store original values for cancel functionality
        this.originalValues = {};

        // Initialize grid settings module
        this.gridSettings = configManager ? new GridSettings(configManager) : null;

        // Initialize settings sync manager
        this.syncManager = new SettingsSyncManager(levelEditor);

        // Initialize context menu
        this.contextMenu = null;

        // Sync settings from ConfigManager to StateManager on initialization (only once)
        if (this.syncManager && !SettingsPanel._initialSyncDone) {
            SettingsPanel._initialSyncDone = true;
            this.syncManager.syncFromConfigToState();
        }

        this.init();
    }

    init() {
        this.createSettingsPanel();
        // setupEventListeners() будет вызван в show() после создания DOM
    }

    createSettingsPanel() {
        // Import mobile interface manager
        import('../managers/MobileInterfaceManager.js').then(({ mobileInterfaceManager }) => {
            this.mobileManager = mobileInterfaceManager;
        });
        
        // Create settings overlay element
        const overlay = document.createElement('div');
        overlay.id = 'settings-overlay';
        overlay.style.display = 'none'; // Only set display, let CSS handle the rest
        
        overlay.innerHTML = `
            <div class="settings-panel-container mobile-dialog" id="settings-panel-container">
                <div class="settings-header" id="settings-header">
                    <h2>Settings</h2>
                    <div class="settings-header-controls">
                        <button id="settings-menu-btn" class="settings-menu-btn mobile-touch-target">⋮</button>
                    </div>
                </div>
                
                <div class="settings-content-area">
                    <!-- Settings Categories -->
                    <div class="settings-nav">
                        <button class="settings-tab active" data-tab="general">General</button>
                        <button class="settings-tab" data-tab="colors">Colors</button>
                        <button class="settings-tab" data-tab="grid">Grid & Snapping</button>
                        <button class="settings-tab" data-tab="camera">Camera</button>
                        <button class="settings-tab" data-tab="selection">Selection</button>
                        <button class="settings-tab" data-tab="assets">Assets</button>
                        <button class="settings-tab" data-tab="hotkeys">Hotkeys</button>
                        <button class="settings-tab" data-tab="touch">Touch</button>
                        <button class="settings-tab" data-tab="performance">Performance</button>
                    </div>
                    
                    <!-- Settings Content -->
                    <div class="settings-main-content">
                        <div id="settings-content">
                            <!-- Content will be dynamically generated -->
                        </div>
                    </div>
                </div>
                
                <div class="settings-footer">
                    <div class="settings-footer-right">
                        <button id="cancel-settings" class="settings-btn settings-btn-cancel mobile-button">Cancel</button>
                        <button id="save-settings" class="settings-btn settings-btn-save mobile-button">Apply Changes</button>
                    </div>
                </div>
                
                <!-- Hidden file input for import -->
                <input type="file" id="import-file" name="import-file" accept=".json" class="settings-input" style="display: none;">
                
            </div>
        `;
        
        document.body.appendChild(overlay);
    }


    show() {
        try {
            // Store original values before showing panel
            this.storeOriginalValues();

            this.isVisible = true;
            const overlay = document.getElementById('settings-overlay');
            if (overlay) {
                overlay.style.display = 'flex';

                // Apply mobile interface adaptations
                let isMobile = false;
                if (this.mobileManager) {
                    this.mobileManager.adaptElement(overlay);
                    const container = overlay.querySelector('.settings-panel-container');
                    if (container) {
                        this.mobileManager.applyMobileStyles(container, 'settings');
                        isMobile = this.mobileManager.isMobile();
                    }
                }

                // Window positioning is now handled by CSS only
                
                // Setup event handlers and context menu after a short delay to ensure DOM is ready
                setTimeout(() => {
                    try {
                        this.setupNewEventHandlers();
                        this.setupContextMenu();
                    } catch (error) {
                        Logger.ui.warn('Error setting up event handlers:', error);
                    }
                }, 100);
                
                // Load last active tab from localStorage
                const savedTab = localStorage.getItem('levelEditor_lastActiveSettingsTab');
                const activeTab = savedTab || 'general';
                this.lastActiveTab = activeTab;
                
                // Activate the correct tab visually
                try {
                    this.activateTab(activeTab);
                } catch (error) {
                    Logger.ui.warn('Error activating tab:', error);
                }
                
                // First sync settings from ConfigManager to StateManager (for consistency)
                try {
                    if (this.syncManager) {
                        this.syncManager.syncFromConfigToState();
                        // Apply color settings immediately after sync
                        this.syncManager.applyInitialColorSettings();
                    }
                } catch (error) {
                    Logger.ui.warn('Error syncing from config to state:', error);
                }

                // Sync grid settings to StateManager when panel opens
                try {
                    if (this.gridSettings) {
                        this.gridSettings.syncAllGridSettingsToState();
                    }
                } catch (error) {
                    Logger.ui.warn('Error syncing grid settings:', error);
                }

                // Render content for the active tab (after StateManager is synced)
                try {
                    this.renderSettingsContent(activeTab);
                } catch (error) {
                    Logger.ui.warn('Error rendering settings content:', error);
                }

                // Now sync current StateManager values to UI (to show current state)
                try {
                    if (this.syncManager && !this._stateInitialized) {
                        this._stateInitialized = true;
                        this.syncManager.initializeFromState();
                    }
                } catch (error) {
                    Logger.ui.warn('Error initializing from state:', error);
                }

                // Add direct event listeners to tabs after they are visible
                try {
                    this.setupTabEventListeners();
                } catch (error) {
                    Logger.ui.warn('Error setting up tab event listeners:', error);
                }
                
                // Setup input event listeners after content is rendered
                try {
                    this.setupSettingsInputs();
                } catch (error) {
                    Logger.ui.warn('Error setting up settings inputs:', error);
                }

                // Escape key handler is now handled by EventHandlerManager
                
                // Initialize grid settings event listeners
                try {
                    if (this.gridSettings) {
                        this.gridSettings.initializeEventListeners();
                    }
                } catch (error) {
                    Logger.ui.warn('Error initializing grid settings event listeners:', error);
                }
            }
        } catch (error) {
            Logger.ui.error('Error in SettingsPanel.show():', error);
            // Ensure overlay is hidden if there was an error
            const overlay = document.getElementById('settings-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
            this.isVisible = false;
        }
    }

    hide() {
        this.isVisible = false;

        // Remove event handlers
        EventHandlerUtils.removeDialogEventHandling('settings-overlay', eventHandlerManager);

        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    activateTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Add active class to clicked tab
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    renderSettingsContent(tabName) {
        const contentDiv = document.getElementById('settings-content');
        if (!contentDiv) return;

        let content = '';
        switch (tabName) {
            case 'general':
                content = this.renderGeneralSettings();
                break;
            case 'colors':
                content = this.renderColorsSettings();
                break;
            case 'grid':
                content = this.gridSettings?.renderGridSettings() || '<div>Grid settings not available</div>';
                break;
            case 'camera':
                content = this.renderCameraSettings();
                break;
            case 'selection':
                content = this.renderSelectionSettings();
                break;
            case 'assets':
                content = this.renderAssetsSettings();
                break;
            case 'hotkeys':
                content = this.renderHotkeysSettings();
                break;
            case 'touch':
                content = this.renderTouchSettings();
                break;
            case 'performance':
                content = this.renderPerformanceSettings();
                break;
            default:
                content = '<h3>Settings</h3><p>No settings available for this tab.</p>';
        }

        contentDiv.innerHTML = content;
    }

    setupTabEventListeners() {
        // This method can be used for additional tab-specific event listeners
        // Currently handled by the main overlay click handler
    }

    renderGeneralSettings() {
        // Use StateManager as single source of truth instead of ConfigManager
        const stateManager = this.levelEditor?.stateManager;
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
        
        return `
            <h3>General Settings</h3>
            
            <div class="settings-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                <!-- UI Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">UI Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="ui-show-tooltips" class="setting-input" name="setting-input" data-setting="ui.showTooltips" ${settings.ui?.showTooltips ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Show Tooltips</span>
                            </label>
                        </div>
                        
                        <!-- Sliders in columns -->
                        <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%;">
                            <div>
                                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Font Scale</label>
                                <input type="range" id="ui-font-scale" min="0.5" max="2" step="0.1" class="setting-input" name="setting-input" data-setting="ui.fontScale" 
                                       value="${settings.ui?.fontScale || 1.0}"
                                       style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                                <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                    ${(settings.ui?.fontScale || 1.0).toFixed(1)}x
                                </div>
                            </div>
                            
                            <div>
                                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Spacing</label>
                                <input type="range" id="ui-spacing" min="0" max="2" step="0.1" class="setting-input" name="setting-input" data-setting="ui.spacing" 
                                       value="${settings.ui?.spacing || 1.0}"
                                       style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                                <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                    ${(settings.ui?.spacing || 1.0).toFixed(1)}x
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Editor Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Editor Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="editor-auto-save" class="setting-input" name="setting-input" data-setting="editor.autoSave" ${settings.editor?.autoSave ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Auto Save</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Auto Save Interval (minutes)</label>
                            <input type="number" id="auto-save-interval" min="1" max="60" step="1" class="setting-input" name="setting-input" data-setting="editor.autoSaveInterval" 
                                   value="${settings.editor?.autoSaveInterval || 5}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Undo History Limit</label>
                            <input type="number" id="undo-history-limit" min="10" max="1000" step="10" class="setting-input" name="setting-input" data-setting="editor.undoHistoryLimit" 
                                   value="${settings.editor?.undoHistoryLimit || 100}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        </div>
                    </div>
                </div>


                
                <div style="border-top: 1px solid #374151; padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">View Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="editor-game-mode" class="setting-input" name="setting-input" data-setting="editor.view.gameMode" ${settings.editor.view?.gameMode ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Immersive Mode</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="editor-object-boundaries" class="setting-input" name="setting-input" data-setting="editor.view.objectBoundaries" ${settings.editor.view?.objectBoundaries ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Object Boundaries</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="editor-object-collisions" class="setting-input" name="setting-input" data-setting="editor.view.objectCollisions" ${settings.editor.view?.objectCollisions ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Object Collisions</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="editor-parallax" class="setting-input" name="setting-input" data-setting="editor.view.parallax" ${settings.editor.view?.parallax ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: var(--ui-text-color, #d1d5db);">Parallax</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderColorsSettings() {
        // Use StateManager as single source of truth
        const stateManager = this.levelEditor?.stateManager;
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

        return `
            <h3>Color Settings</h3>

            <div class="settings-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">

                <!-- UI Colors -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">UI Colors</h4>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- UI Background Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">UI Background</label>
                            <input type="color" id="ui-background-color" class="setting-input" name="setting-input" data-setting="ui.backgroundColor"
                                   value="${colors.ui.backgroundColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- UI Text Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">UI Text Color</label>
                            <input type="color" id="ui-text-color" class="setting-input" name="setting-input" data-setting="ui.textColor"
                                   value="${colors.ui.textColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Active Elements Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Active Elements</label>
                            <input type="color" id="ui-active-color" class="setting-input" name="setting-input" data-setting="ui.activeColor"
                                   value="${colors.ui.activeColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Active Text Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Active Text Color</label>
                            <input type="color" id="ui-active-text-color" class="setting-input" name="setting-input" data-setting="ui.activeTextColor"
                                   value="${colors.ui.activeTextColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Active Tab Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Active Tab Color</label>
                            <input type="color" id="ui-active-tab-color" class="setting-input" name="setting-input" data-setting="ui.activeTabColor"
                                   value="${colors.ui.activeTabColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Accent Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Accent Color</label>
                            <input type="color" id="ui-accent-color" class="setting-input" name="setting-input" data-setting="ui.accentColor"
                                   value="${colors.ui.accentColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>
                    </div>
                </div>

                <!-- Canvas Colors -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Canvas Colors</h4>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- Canvas Background Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Canvas Background</label>
                            <input type="color" id="canvas-background-color" class="setting-input" name="setting-input" data-setting="canvas.backgroundColor"
                                   value="${colors.canvas.backgroundColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Grid Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Grid Color</label>
                            <input type="color" id="canvas-grid-color" class="setting-input" name="setting-input" data-setting="canvas.gridColor"
                                   value="${ColorUtils.toHex(colors.grid.color)}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Grid Subdivision Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Grid Subdivision</label>
                            <input type="color" id="canvas-grid-subdiv-color" class="setting-input" name="setting-input" data-setting="canvas.gridSubdivColor"
                                   value="${ColorUtils.toHex(colors.grid.subdivColor)}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>
                    </div>
                </div>

                <!-- Selection Colors -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Selection Colors</h4>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- Selection Outline Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Selection Outline</label>
                            <input type="color" id="selection-outline-color" class="setting-input" name="setting-input" data-setting="selection.outlineColor"
                                   value="${colors.selection.outlineColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Group Outline Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Group Outline</label>
                            <input type="color" id="selection-group-outline-color" class="setting-input" name="setting-input" data-setting="selection.groupOutlineColor"
                                   value="${colors.selection.groupOutlineColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Marquee Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Marquee Selection</label>
                            <input type="color" id="selection-marquee-color" class="setting-input" name="setting-input" data-setting="selection.marqueeColor"
                                   value="${colors.selection.marqueeColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Hierarchy Highlight Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Hierarchy Highlight</label>
                            <input type="color" id="selection-hierarchy-highlight-color" class="setting-input" name="setting-input" data-setting="selection.hierarchyHighlightColor"
                                   value="${colors.selection.hierarchyHighlightColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Active Layer Border Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Active Layer Border</label>
                            <input type="color" id="active-layer-border-color" class="setting-input" name="setting-input" data-setting="panels.selection.activeLayerBorderColor"
                                   value="${colors.selection.activeLayerBorderColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>
                    </div>
                </div>

                <!-- Logger Colors -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Logger Colors</h4>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem;">
                        ${Object.entries(colors.logger).map(([category, color]) => `
                            <div>
                                <label style="display: block; font-size: 0.75rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.25rem;">${category}</label>
                                <input type="color" id="logger-color-${category}" class="setting-input" name="setting-input" data-setting="logger.colors.${category}"
                                       value="${color}"
                                       style="width: 2.5rem; height: 1.5rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                            </div>
                        `).join('')}
                    </div>
                </div>

            </div>
        `;
    }

    renderCameraSettings() {
        return `<h3>Camera Settings</h3><p>Camera settings will be implemented here.</p>`;
    }

    renderSelectionSettings() {
        // Use StateManager as single source of truth
        const stateManager = this.levelEditor?.stateManager;
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
        
        return `
            <h3>Selection Settings</h3>
            
            <div class="settings-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                
                <!-- Multi-Select Mode -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Multi-Select Behavior</h4>
                    
                    <div>
                        <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Multi-Select Mode</label>
                        <select class="setting-input" name="setting-input" data-setting="editor.multiSelectMode"
                                style="width: 100%; padding: 0.5rem; background-color: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: var(--ui-text-color, #d1d5db);">
                            <option value="additive" ${settings.editor?.multiSelectMode === 'additive' ? 'selected' : ''}>Additive (Ctrl+Click to add)</option>
                            <option value="replace" ${settings.editor?.multiSelectMode === 'replace' ? 'selected' : ''}>Replace (Click to select only)</option>
                        </select>
                    </div>
                </div>

                <!-- Selection Visual Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Selection Visual</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- Outline Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Outline Color</label>
                            <input type="color" id="panels-selection-outline-color" class="setting-input" name="setting-input" data-setting="panels.selection.outlineColor"
                                   value="${settings.selection?.outlineColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Outline Width -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Outline Width</label>
                            <input type="range" class="setting-input" name="setting-input" data-setting="panels.selection.outlineWidth"
                                   min="1" max="5" step="1" value="${settings.selection?.outlineWidth}"
                                   style="width: 100%; height: 2rem;">
                            <div style="text-align: center; font-size: 0.75rem; color: var(--ui-text-color, #9ca3af); margin-top: 0.25rem;">${settings.selection?.outlineWidth}px</div>
                        </div>

                        <!-- Group Outline Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Group Outline Color</label>
                            <input type="color" class="setting-input" name="setting-input" data-setting="panels.selection.groupOutlineColor"
                                   value="${settings.selection?.groupOutlineColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Group Outline Width -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Group Outline Width</label>
                            <input type="range" class="setting-input" name="setting-input" data-setting="panels.selection.groupOutlineWidth"
                                   min="1" max="8" step="1" value="${settings.selection?.groupOutlineWidth}"
                                   style="width: 100%; height: 2rem;">
                            <div style="text-align: center; font-size: 0.75rem; color: var(--ui-text-color, #9ca3af); margin-top: 0.25rem;">${settings.selection?.groupOutlineWidth}px</div>
                        </div>
                    </div>
                </div>

                <!-- Marquee Selection Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Marquee Selection</h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <!-- Marquee Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Marquee Color</label>
                            <input type="color" class="setting-input" name="setting-input" data-setting="panels.selection.marqueeColor"
                                   value="${settings.selection?.marqueeColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>

                        <!-- Marquee Opacity -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Marquee Opacity</label>
                            <input type="range" class="setting-input" name="setting-input" data-setting="panels.selection.marqueeOpacity"
                                   min="0.1" max="1" step="0.1" value="${settings.selection?.marqueeOpacity}"
                                   style="width: 100%; height: 2rem;">
                            <div style="text-align: center; font-size: 0.75rem; color: var(--ui-text-color, #9ca3af); margin-top: 0.25rem;">${Math.round((settings.selection?.marqueeOpacity || 0.2) * 100)}%</div>
                        </div>
                    </div>
                </div>

                <!-- Hierarchy Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Hierarchy Highlight</h4>
                    
                    <div>
                        <!-- Hierarchy Highlight Color -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Highlight Color</label>
                            <input type="color" class="setting-input" name="setting-input" data-setting="panels.selection.hierarchyHighlightColor"
                                   value="${settings.selection?.hierarchyHighlightColor}"
                                   style="width: 3rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAssetsSettings() {
        return `<h3>Assets Settings</h3><p>Assets settings will be implemented here.</p>`;
    }

    renderShortcutsSettings() {
        return `<h3>Shortcuts Settings</h3><p>Shortcuts settings will be implemented here.</p>`;
    }

    renderPerformanceSettings() {
        return `<h3>Performance Settings</h3><p>Performance settings will be implemented here.</p>`;
    }

    /**
     * Render hotkeys settings section
     */
    renderHotkeysSettings() {
        const shortcuts = this.configManager?.getShortcuts() || {};
        let content = '<h3>Keyboard Shortcuts</h3>';

        // Editor shortcuts
        if (shortcuts.editor) {
            content += '<h4>Editor Shortcuts</h4>';
            content += '<div class="hotkeys-list">';

            Object.entries(shortcuts.editor).forEach(([action, shortcut]) => {
                const keyCombo = this.formatShortcut(shortcut);
                content += `
                    <div class="hotkey-item">
                        <div class="hotkey-description">${shortcut.description}</div>
                        <input type="text" id="hotkey-editor-${action}" class="hotkey-input" data-shortcut="${action}" data-category="editor" value="${keyCombo}" readonly>
                    </div>
                `;
            });

            content += '</div>';
        }

        // UI shortcuts
        if (shortcuts.ui) {
            content += '<h4>UI Shortcuts</h4>';
            content += '<div class="hotkeys-list">';

            Object.entries(shortcuts.ui).forEach(([action, shortcut]) => {
                const keyCombo = this.formatShortcut(shortcut);
                content += `
                    <div class="hotkey-item">
                        <div class="hotkey-description">${shortcut.description}</div>
                        <input type="text" id="hotkey-ui-${action}" class="hotkey-input" data-shortcut="${action}" data-category="ui" value="${keyCombo}" readonly>
                    </div>
                `;
            });

            content += '</div>';
        }

        return content;
    }

    /**
     * Render touch settings section
     */
    renderTouchSettings() {
        const stateManager = this.levelEditor?.stateManager;
        if (!stateManager) return '<div>Error: StateManager not available</div>';

        // Get current touch settings from StateManager
        const touchSettings = {
            panThreshold: stateManager.get('touch.panThreshold') || 5,
            zoomThreshold: stateManager.get('touch.zoomThreshold') || 0.03,
            panSensitivity: stateManager.get('touch.panSensitivity') || 2.0,
            zoomIntensity: stateManager.get('touch.zoomIntensity') || 0.1,
            longPressDelay: stateManager.get('touch.longPressDelay') || 500
        };

        return `
            <h3>Touch Gestures</h3>
            
            <div class="settings-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                <!-- Pan & Zoom Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Pan & Zoom Settings</h4>
                    
                    <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%;">
                        <!-- Pan Threshold -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Pan Threshold (px)</label>
                            <input type="range" min="1" max="50" step="1" class="setting-input" name="setting-input" data-setting="touch.panThreshold" 
                                   value="${touchSettings.panThreshold}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                            <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                ${touchSettings.panThreshold}px
                            </div>
                        </div>
                        
                        <!-- Pan Sensitivity -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Pan Sensitivity</label>
                            <input type="range" min="0.1" max="5.0" step="0.1" class="setting-input" name="setting-input" data-setting="touch.panSensitivity" 
                                   value="${touchSettings.panSensitivity}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                            <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                ${touchSettings.panSensitivity}x
                            </div>
                        </div>
                        
                        <!-- Zoom Threshold -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Zoom Threshold (%)</label>
                            <input type="range" min="0.01" max="0.5" step="0.01" class="setting-input" name="setting-input" data-setting="touch.zoomThreshold" 
                                   value="${touchSettings.zoomThreshold}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                            <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                ${(touchSettings.zoomThreshold * 100).toFixed(1)}%
                            </div>
                        </div>
                        
                        <!-- Zoom Intensity -->
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Zoom Intensity</label>
                            <input type="range" min="0.01" max="0.5" step="0.01" class="setting-input" name="setting-input" data-setting="touch.zoomIntensity" 
                                   value="${touchSettings.zoomIntensity}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                            <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                                ${touchSettings.zoomIntensity}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Long Press Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Long Press Settings</h4>
                    
                    <div>
                        <label style="display: block; font-size: 0.875rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.5rem;">Long Press Delay (ms)</label>
                        <input type="range" min="100" max="2000" step="50" class="setting-input" name="setting-input" data-setting="touch.longPressDelay" 
                               value="${touchSettings.longPressDelay}"
                               style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        <div style="text-align: center; color: var(--ui-text-color, #9ca3af); font-size: 0.75rem; margin-top: 0.25rem;">
                            ${touchSettings.longPressDelay}ms
                        </div>
                    </div>
                </div>

                <!-- Gesture Information -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: 0.75rem;">Gesture Information</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--ui-text-color, #9ca3af); font-size: 0.875rem;">
                        <p><strong style="color: var(--ui-text-color, #d1d5db);">Single Finger:</strong> Tap + drag for marquee selection</p>
                        <p><strong style="color: var(--ui-text-color, #d1d5db);">Two Fingers:</strong> Pan (move) or zoom (pinch/spread)</p>
                        <p><strong style="color: var(--ui-text-color, #d1d5db);">Long Press:</strong> Context menu or asset drag</p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Format shortcut object to readable string
     * @param {Object} shortcut - Shortcut definition
     * @returns {string} Formatted shortcut string
     */
    formatShortcut(shortcut) {
        const parts = [];

        if (shortcut.ctrlKey) parts.push('Ctrl');
        if (shortcut.altKey) parts.push('Alt');
        if (shortcut.shiftKey) parts.push('Shift');
        if (shortcut.metaKey) parts.push('Cmd');

        // Use the key property, ignore altKey/shiftKey if they are set as key values
        if (shortcut.key) {
            parts.push(shortcut.key.toUpperCase());
        }

        return parts.join(' + ');
    }

    /**
     * Update slider display value in real-time
     */
    updateSliderDisplay(slider, value) {
        const container = slider.closest('div');
        if (!container) return;

        const displayElement = container.querySelector('div[style*="text-align: center"]');
        if (displayElement) {
            const numValue = ValidationUtils.validateNumeric(value, 'slider value');
            if (numValue !== null) {
                displayElement.textContent = `${numValue.toFixed(1)}x`;
            }
        }
    }

    setupSettingsInputs() {
        document.querySelectorAll('.setting-input').forEach(input => {
            // Remove old listener if exists
            if (input._inputHandler) {
                input.removeEventListener('input', input._inputHandler);
            }
            
            // Create and store new handler
            input._inputHandler = (e) => {
                const path = ValidationUtils.validateString(e.target.dataset.setting, 'data-setting attribute');
                if (!path) {
                    Logger.settings.warn('SettingsPanel: No data-setting attribute found for input:', e.target);
                    return;
                }

                let value;
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else {
                    value = input.value;
                }

                ValidationUtils.logValidation('SettingsPanel', 'Input change detected', { path, value });

                // Update real-time display values for sliders
                if (input.type === 'range') {
                    this.updateSliderDisplay(input, value);
                }

                // Handle nested logger color settings
                if (path.startsWith('logger.colors.')) {
                    const category = path.split('.')[2];
                    const currentLoggerColors = this.levelEditor?.stateManager?.get('logger.colors') || {};
                    const updatedLoggerColors = { ...currentLoggerColors, [category]: value };

                    // Update StateManager
                    if (this.levelEditor?.stateManager) {
                        this.levelEditor.stateManager.set('logger.colors', updatedLoggerColors);
                    }

                    // Apply logger colors immediately
                    this.applyLoggerColors(updatedLoggerColors);

                    // Sync to ConfigManager for persistence
                    if (this.configManager) {
                        this.configManager.set('logger.colors', updatedLoggerColors);
                    }
                }
                // Handle grid color settings with proper opacity conversion
                else if (path === 'canvas.gridColor' || path === 'canvas.gridSubdivColor') {
                    this.applyGridColorSetting(path, value);
                }
                else {
                    // Synchronize with StateManager for real-time updates
                    if (this.syncManager) {
                        this.syncManager.syncSettingToState(path, value);
                    } else {
                        Logger.settings.warn('SettingsPanel: syncManager not available for', path, value);
                    }

                    // Handle UI-specific immediate updates
                    if (path === 'ui.compactMode') {
                        this.applyCompactMode(value);
                    }
                }

            };
            
            // Add the listener
            input.addEventListener('input', input._inputHandler);
            
            // Handle range slider value display updates
            if (input.type === 'range') {
                const valueDisplay = input.parentElement.querySelector('div[style*="text-align: center"]');
                if (valueDisplay) {
                    const updateRangeValue = () => {
                        let displayValue = input.value;
                        const setting = input.getAttribute('data-setting');
                        
                        if (setting === 'touch.panThreshold') {
                            displayValue = input.value + 'px';
                        } else if (setting === 'touch.panSensitivity') {
                            displayValue = input.value + 'x';
                        } else if (setting === 'touch.zoomThreshold') {
                            displayValue = (parseFloat(input.value) * 100).toFixed(1) + '%';
                        } else if (setting === 'touch.zoomIntensity') {
                            displayValue = input.value;
                        } else if (setting === 'touch.longPressDelay') {
                            displayValue = input.value + 'ms';
                        }
                        
                        valueDisplay.textContent = displayValue;
                    };
                    
                    input.addEventListener('input', updateRangeValue);
                    updateRangeValue(); // Set initial value
                }
            }
        });

        // Setup real-time sync from StateManager to UI (for toolbar/menu changes)
        this.setupStateManagerSubscriptions();

        // Setup hotkey input handlers
        this.setupHotkeyInputs();
    }

    /**
     * Setup subscriptions to StateManager changes to keep UI in sync
     */
    setupStateManagerSubscriptions() {
        if (!this.levelEditor?.stateManager) return;

        // Sync snap to grid - only subscribe to canvas.snapToGrid as primary source
        this.levelEditor.stateManager.subscribe('canvas.snapToGrid', (value) => {
            if (this.isVisible) {
                this.updateUIInput('canvas.snapToGrid', value);
            }
        });

        // Sync grid visibility
        this.levelEditor.stateManager.subscribe('canvas.showGrid', (value) => {
            if (this.isVisible) {
                this.updateUIInput('canvas.showGrid', value);
            }
        });
    }

    /**
     * Update UI input element with new value
     * @param {string} settingPath - Setting path
     * @param {any} value - New value
     */
    updateUIInput(settingPath, value) {
        const input = document.querySelector(`[data-setting="${settingPath}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }
        }
    }

    /**
     * Setup hotkey input handlers for keyboard shortcut customization
     */
    setupHotkeyInputs() {
        document.querySelectorAll('.hotkey-input').forEach(input => {
            if (input._hasHotkeyListeners) return; // Prevent duplicate listeners
            input._hasHotkeyListeners = true;
            
            // Make input focusable and editable
            input.addEventListener('click', (e) => {
                e.target.readOnly = false;
                e.target.focus();
                e.target.select();
            });

            input.addEventListener('keydown', (e) => {
                e.preventDefault();

                // Don't allow certain keys
                if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'Enter') {
                    e.target.blur();
                    return;
                }

                // Build shortcut object
                const shortcut = {
                    key: e.key.toUpperCase(),
                    ctrlKey: e.ctrlKey || e.metaKey,
                    altKey: e.altKey,
                    shiftKey: e.shiftKey
                };

                // Format and display
                const formatted = this.formatShortcut(shortcut);
                e.target.value = formatted;

                // Store the shortcut data
                e.target.dataset.shortcutData = JSON.stringify(shortcut);
            });

            input.addEventListener('blur', (e) => {
                e.target.readOnly = true;
                const shortcutData = e.target.dataset.shortcutData;
                if (shortcutData) {
                    this.saveHotkey(e.target);
                }
            });
        });
    }

    /**
     * Save hotkey to config
     * @param {HTMLElement} inputElement - The input element
     */
    saveHotkey(inputElement) {
        const action = inputElement.dataset.shortcut;
        const category = inputElement.dataset.category;
        const shortcutData = JSON.parse(inputElement.dataset.shortcutData || '{}');

        if (action && category && shortcutData.key) {
            // Get current shortcuts
            const shortcuts = this.configManager?.getShortcuts() || {};

            // Update the shortcut
            if (!shortcuts[category]) {
                shortcuts[category] = {};
            }
            shortcuts[category][action] = {
                ...shortcutData,
                description: shortcuts[category][action]?.description || action
            };

            // Save to config
            if (this.configManager) {
                this.configManager.set(`shortcuts.${category}.${action}`, shortcuts[category][action]);
            }
        }
    }

    /**
     * Setup new event handlers using EventHandlerManager
     */
    setupNewEventHandlers() {
        const overlay = document.getElementById('settings-overlay');
        const container = document.getElementById('settings-panel-container');
        
        if (!overlay || !container) {
            Logger.ui.warn('SettingsPanel: Overlay or container not found');
            return;
        }

        // Create dialog handlers with all necessary functionality
        const dialogHandlers = {
            onEscape: this.cancelSettings.bind(this),
            onOverlayClick: this.cancelSettings.bind(this),
            onClick: (e) => {
                // Handle close button and overlay click
                if (e.target.id === 'cancel-settings') {
                    this.cancelSettings();
                    return;
                }

                // Handle settings menu button
                if (e.target.id === 'settings-menu-btn') {
                    this.showContextMenu(e);
                    return;
                }

                // Handle settings tabs
                const tabButton = e.target.closest('.settings-tab');
                if (tabButton) {
                    const tabName = tabButton.dataset.tab;
                    
                    // Update last active tab
                    this.lastActiveTab = tabName;
                    localStorage.setItem('levelEditor_lastActiveSettingsTab', tabName);
                    
                    // Activate tab visually
                    this.activateTab(tabName);
                    
                    // Render content
                    this.renderSettingsContent(tabName);
                    
                    // Re-setup input event listeners after rendering
                    this.setupSettingsInputs();
                    
                    // Initialize grid settings event listeners if grid tab is active
                    if (tabName === 'grid' && this.gridSettings) {
                        this.gridSettings.initializeEventListeners();
                    }
                }

                // Handle other settings actions
                if (e.target.id === 'reset-settings') {
                    this.resetSettings();
                }
                if (e.target.id === 'export-settings') {
                    this.exportSettings();
                }
                if (e.target.id === 'import-settings') {
                    document.getElementById('import-file').click();
                }
                if (e.target.id === 'save-settings') {
                    this.saveSettings();
                }
            },
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // Register dialog with event manager
        EventHandlerUtils.addDialogEventHandling(
            overlay,
            'settings-overlay',
            dialogHandlers,
            this,
            eventHandlerManager
        );

        // Setup input handlers for all inputs
        const inputs = container.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            const inputHandlers = EventHandlerUtils.createInputHandlers(
                this,
                null, // onChange
                null, // onFocus
                null, // onBlur
                (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.saveSettings();
                    }
                }
            );

            EventHandlerUtils.addInputEventHandling(
                input,
                inputHandlers,
                this,
                eventHandlerManager
            );
        });

        // Setup file import handler
        const importFile = document.getElementById('import-file');
        if (importFile) {
            const fileHandlers = {
                onChange: (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importSettings(file);
                    }
                }
            };

            EventHandlerUtils.addInputEventHandling(
                importFile,
                fileHandlers,
                this,
                eventHandlerManager
            );
        }

        Logger.ui.debug('SettingsPanel: New event handlers setup complete');
    }


    /**
     * Register a new setting mapping for automatic StateManager synchronization
     * @param {string} settingPath - Path in settings (e.g., 'editor.view.newOption')
     * @param {string} stateKey - Key in StateManager (e.g., 'view.newOption')
     * @param {Function} [onChange] - Optional callback when setting changes
     * 
     * Example usage:
     * settingsPanel.registerSettingMapping('editor.view.newFeature', 'view.newFeature', (value) => {
     *     console.log('New feature toggled:', value);
     * });
     */
    registerSettingMapping(settingPath, stateKey, onChange = null) {
        this.syncManager.registerMapping(settingPath, stateKey, onChange);
    }

    /**
     * Get the settings sync manager instance
     * @returns {SettingsSyncManager} The sync manager instance
     */
    getSyncManager() {
        return this.syncManager;
    }

    /**
     * Check if a setting path is mapped for synchronization
     * @param {string} settingPath - Setting path
     * @returns {boolean} True if mapped
     */
    isSettingMapped(settingPath) {
        return this.syncManager.isMapped(settingPath);
    }

    /**
     * Get all registered mappings
     * @returns {Object} Object with setting paths as keys and state keys as values
     */
    getAllMappings() {
        return this.syncManager.getAllMappings();
    }

    /**
     * Apply compact mode to the UI
     * @param {boolean} enabled - Whether compact mode should be enabled
     */
    applyCompactMode(enabled) {
        const body = document.body;

        if (enabled) {
            body.classList.add('compact-mode');
        } else {
            body.classList.remove('compact-mode');
        }
    }

    /**
     * Apply logger colors in real-time
     * @param {Object} loggerColors - Logger color configuration
     */
    applyLoggerColors(loggerColors) {
        if (!loggerColors || typeof loggerColors !== 'object') return;

        // Apply colors to Logger instance if available
        if (window.Logger && typeof window.Logger.updateColors === 'function') {
            window.Logger.updateColors(loggerColors);
        } else if (Logger && typeof Logger.updateColors === 'function') {
            Logger.updateColors(loggerColors);
        } else {
            // Fallback: update the global LoggerColors object if it exists
            if (window.LoggerColors) {
                Object.assign(window.LoggerColors, loggerColors);
            }
        }
    }

    /**
     * Apply grid color setting with proper opacity conversion
     * @param {string} path - Setting path (canvas.gridColor or canvas.gridSubdivColor)
     * @param {string} hexColor - Hex color value
     */
    applyGridColorSetting(path, hexColor) {
        // Get current opacity
        const opacity = this.levelEditor?.stateManager?.get('canvas.gridOpacity') || 0.1;

        // Convert hex color to rgba with current opacity
        const rgbaColor = ColorUtils.toRgba(hexColor, opacity);

        // Update StateManager with rgba color
        if (this.levelEditor?.stateManager) {
            this.levelEditor.stateManager.set(path, rgbaColor);
        }

        // Sync to ConfigManager for persistence (store hex color)
        if (this.configManager) {
            this.configManager.set(path, hexColor);
        }

        // Trigger grid re-render
        if (window.editor?.canvasRenderer?.clearGridCaches) {
            window.editor.canvasRenderer.clearGridCaches();
        }
        if (window.editor?.render) {
            window.editor.render();
        }
    }

    async resetSettings() {
        // Reset to default values
        if (this.configManager) {
            await this.configManager.reset();
        }
        
        // Sync to StateManager
        this.syncManager.syncFromConfigToState();
        
        // Re-render current tab
        this.renderSettingsContent(this.lastActiveTab);
        
        // Re-setup inputs
        this.setupSettingsInputs();
    }

    exportSettings() {
        const settings = this.configManager?.getAll() || {};
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'level-editor-settings.json';
        link.click();
    }

    async importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                if (this.configManager) {
                    await this.configManager.importSettings(settings);
                    
                    // Reload all configs
                    await this.configManager.loadAllConfigsAsync();
                }
                
                // Sync to StateManager
                this.syncManager.syncFromConfigToState();
                
                // Apply color settings immediately after import
                this.syncManager.applyInitialColorSettings();
                
                // Re-render current tab
                this.renderSettingsContent(this.lastActiveTab);
                
                // Re-setup inputs
                this.setupSettingsInputs();
                
                await alert('Settings imported successfully!');
            } catch (error) {
                await alert('Error importing settings: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    saveSettings() {
        // Apply all UI settings to StateManager first
        this.syncManager.applyAllUISettingsToState();

        // Save all UI settings to ConfigManager
        this.syncManager.saveAllUISettingsToConfig();

        // Apply all settings to UI (colors, etc.)
        this.syncManager.applySpecialUISettings();

        // Force save settings to localStorage immediately
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.saveUserConfigsToStorage();
        }

        this.hide();
    }


    /**
     * Setup context menu for settings
     */
    setupContextMenu() {
        const container = document.getElementById('settings-panel-container');
        if (!container) return;

        this.contextMenu = new BaseContextMenu(container, {
            onMenuShow: () => {},
            onMenuHide: () => {}
        });

        // Remove the contextmenu listener that BaseContextMenu added
        if (this.contextMenu.contextMenuHandler) {
            container.removeEventListener('contextmenu', this.contextMenu.contextMenuHandler);
        }

        // Add menu items
        this.contextMenu.addMenuItem('Reset to Defaults', '🔄', () => this.resetToDefaults());
        this.contextMenu.addMenuItem('Export Settings', '📤', () => this.exportSettings());
        this.contextMenu.addMenuItem('Import Settings', '📥', () => this.importSettings());
    }

    /**
     * Show context menu
     */
    showContextMenu(event) {
        if (this.contextMenu) {
            this.contextMenu.showContextMenu(event, {});
        }
    }

    /**
     * Reset settings to defaults
     */
    async resetToDefaults() {
        if (await confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            // Reset to defaults
            if (this.configManager) {
                await this.configManager.reset();
            }
            
            // Sync settings from ConfigManager to StateManager FIRST
            this.syncManager.syncFromConfigToState();
            
            // Apply color settings immediately after reset
            this.syncManager.applyInitialColorSettings();
            
            // Refresh all tabs to show default values (now from StateManager)
            this.renderSettingsContent(this.lastActiveTab);
            
            // Re-setup inputs to reflect new values
            this.setupSettingsInputs();
            
            // Force render update to apply grid and other visual changes
            if (window.editor && window.editor.render) {
                window.editor.render();
            }
            
            Logger.ui.info('Settings reset to defaults and applied to state system');
        }
    }

    /**
     * Export settings
     */
    exportSettings() {
        const settings = this.configManager?.getAll() || {};
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'level-editor-settings.json';
        link.click();
        
        Logger.ui.info('Settings exported');
    }

    /**
     * Import settings
     */
    importSettings() {
        const fileInput = document.getElementById('import-file');
        if (fileInput) {
            fileInput.click();
        }
    }


    /**
     * Get default window state based on browser size
     */
    getDefaultWindowState() {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        const defaultWidth = Math.min(800, windowWidth * 0.8);
        const defaultHeight = Math.min(600, windowHeight * 0.8);
        
        return {
            x: (windowWidth - defaultWidth) / 2,
            y: (windowHeight - defaultHeight) / 2,
            width: defaultWidth,
            height: defaultHeight
        };
    }


    
    /**
     * Store original values before opening settings panel
     */
    storeOriginalValues() {
        if (!this.levelEditor?.stateManager) return;

        // Store all relevant settings that can be modified in the settings panel
        const settingsToStore = [
            // UI colors
            'ui.backgroundColor',
            'ui.textColor',
            'ui.activeColor',
            'ui.activeTextColor',
            'ui.activeTabColor',
            'ui.accentColor',
            // Canvas colors
            'canvas.backgroundColor',
            'canvas.gridColor',
            'canvas.gridSubdivColor',
            // Selection colors
            'selection.outlineColor',
            'selection.groupOutlineColor',
            'selection.marqueeColor',
            'selection.hierarchyHighlightColor',
            'panels.selection.activeLayerBorderColor',
            // Logger colors
            'logger.colors',
            // Touch settings
            'touch.panThreshold',
            'touch.zoomThreshold',
            'touch.panSensitivity',
            'touch.zoomIntensity',
            'touch.longPressDelay'
        ];

        this.originalValues = {};
        settingsToStore.forEach(path => {
            this.originalValues[path] = this.levelEditor.stateManager.get(path);
        });

        Logger.ui.debug('Stored original settings values for cancel functionality');
    }

    /**
     * Restore original values when canceling settings
     */
    restoreOriginalValues() {
        if (!this.levelEditor?.stateManager || !this.originalValues) return;

        // Restore all stored original values
        Object.entries(this.originalValues).forEach(([path, value]) => {
            if (value !== undefined) {
                this.levelEditor.stateManager.set(path, value);
            }
        });

        // Apply color settings immediately after restoration
        if (this.syncManager) {
            this.syncManager.applyInitialColorSettings();
        }

        // Trigger re-render to apply restored grid colors
        if (window.editor?.canvasRenderer?.clearGridCaches) {
            window.editor.canvasRenderer.clearGridCaches();
        }
        if (window.editor?.render) {
            window.editor.render();
        }

        Logger.ui.debug('Restored original settings values');
    }

    cancelSettings() {
        // Restore original values from StateManager
        this.restoreOriginalValues();

        this.hide();
    }
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        Logger.ui.debug('Destroying SettingsPanel');
        
        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (error) {
                Logger.ui.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Remove all event handlers
        EventHandlerUtils.removeDialogEventHandling('settings-overlay', eventHandlerManager);
        
        // Destroy context menu
        if (this.contextMenu) {
            try {
                this.contextMenu.destroy();
            } catch (error) {
                Logger.ui.warn('Failed to destroy context menu:', error);
            }
            this.contextMenu = null;
        }
        
        // Destroy sync manager
        if (this.syncManager) {
            // SettingsSyncManager doesn't have destroy method, just clear reference
            this.syncManager = null;
        }
        
        // Destroy grid settings
        if (this.gridSettings) {
            this.gridSettings = null;
        }
        
        // Remove overlay from DOM
        const overlay = document.getElementById('settings-overlay');
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // Clear references
        this.container = null;
        this.configManager = null;
        this.levelEditor = null;
        
        Logger.ui.debug('SettingsPanel destroyed');
    }
}
