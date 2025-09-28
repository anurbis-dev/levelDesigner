import { ColorChooser } from '../widgets/ColorChooser.js';
import { GridSettings } from './GridSettings.js';
import { RenderUtils } from '../utils/RenderUtils.js';

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

        // Initialize grid settings module
        this.gridSettings = new GridSettings(configManager);

        this.init();
    }


    init() {
        this.createSettingsPanel();
        this.setupEventListeners();
    }

    createSettingsPanel() {
        // Create settings overlay element
        const overlay = document.createElement('div');
        overlay.id = 'settings-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;
        
        overlay.innerHTML = `
            <div class="settings-panel-container">
                <div class="settings-header">
                    <h2>Settings</h2>
                    <button id="close-settings" class="settings-close-btn">✕</button>
                </div>
                
                <div class="settings-content-area">
                    <!-- Settings Categories -->
                    <div class="settings-nav">
                        <button class="settings-tab active" data-tab="general">General</button>
                        <button class="settings-tab" data-tab="grid">Grid & Snapping</button>
                        <button class="settings-tab" data-tab="camera">Camera</button>
                        <button class="settings-tab" data-tab="selection">Selection</button>
                        <button class="settings-tab" data-tab="assets">Assets</button>
                        <button class="settings-tab" data-tab="shortcuts">Shortcuts</button>
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
                    <div class="settings-footer-left">
                        <button id="reset-settings" class="settings-btn settings-btn-reset">Reset to Defaults</button>
                        <button id="export-settings" class="settings-btn settings-btn-export">Export Settings</button>
                        <button id="import-settings" class="settings-btn settings-btn-import">Import Settings</button>
                        <input type="file" id="import-file" name="import-file" accept=".json" class="settings-input">
                    </div>
                    <div class="settings-footer-right">
                        <button id="cancel-settings" class="settings-btn settings-btn-cancel">Cancel</button>
                        <button id="save-settings" class="settings-btn settings-btn-save">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    setupEventListeners() {
        // Settings tabs - delegate to overlay since elements are created dynamically
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                // Handle close button and overlay click
                if (e.target.id === 'close-settings' || e.target.id === 'cancel-settings') {
                    this.cancelSettings();
                    return;
                }
                if (e.target.id === 'settings-overlay') {
                    this.cancelSettings();
                    return;
                }

                // Handle settings tabs (fallback for delegated events)
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
            });
        }

        // File import handler
        const importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.addEventListener('change', (e) => this.importSettings(e));
        }
        
        // ESC key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.cancelSettings();
            }
        });
    }

    show() {
        this.isVisible = true;
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // Load last active tab from localStorage
            const savedTab = localStorage.getItem('levelEditor_lastActiveSettingsTab');
            const activeTab = savedTab || 'general';
            this.lastActiveTab = activeTab;
            
            // Activate the correct tab visually
            this.activateTab(activeTab);
            
            // Render content for the active tab
            this.renderSettingsContent(activeTab);

            // Sync grid settings to StateManager when panel opens
            if (this.gridSettings) {
                this.gridSettings.syncAllGridSettingsToState();
            }

            // Add direct event listeners to tabs after they are visible
            this.setupTabEventListeners();
            
            // Setup input event listeners after content is rendered
            this.setupSettingsInputs();
            
            // Initialize grid settings event listeners
            if (this.gridSettings) {
                this.gridSettings.initializeEventListeners();
            }
        }
    }

    hide() {
        this.isVisible = false;
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    activateTab(tabName) {
        // Remove active class from all tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.style.backgroundColor = 'transparent';
        });
        
        // Activate the specified tab
        const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            targetTab.style.backgroundColor = '#374151';
        }
    }

    setupTabEventListeners() {
        const tabs = document.querySelectorAll('.settings-tab');
        tabs.forEach(tab => {
            // Remove existing listeners to avoid duplicates
            tab.removeEventListener('click', this.handleTabClick);
            // Add new listener
            tab.addEventListener('click', this.handleTabClick.bind(this));
        });
    }

    handleTabClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const tabButton = e.currentTarget;
        const tabName = tabButton.dataset.tab;
        
        // Update last active tab
        this.lastActiveTab = tabName;
        localStorage.setItem('levelEditor_lastActiveSettingsTab', tabName);
        
        // Activate tab visually
        this.activateTab(tabName);
        
        // Render content
        this.renderSettingsContent(tabName);
    }

    renderSettingsContent(category) {
        const content = document.getElementById('settings-content');
        if (!content) return;
        
        switch (category) {
            case 'general':
                content.innerHTML = this.renderGeneralSettings();
                break;
            case 'grid':
                content.innerHTML = this.gridSettings.renderGridSettings();
                // Initialize grid settings event listeners after rendering
                if (this.gridSettings) {
                    this.gridSettings.initializeEventListeners();
                }
                break;
            case 'camera':
                content.innerHTML = this.renderCameraSettings();
                break;
            case 'selection':
                content.innerHTML = `
                    <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">Selection Settings</h3>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <div>
                            <h4 style="font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; color: #d1d5db;">Object Selection</h4>
                            <div style="display: flex; flex-direction: column; gap: 1rem; padding-left: 0.5rem; border-left: 2px solid #374151;">
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Outline Color</label>
                                    <div id="outline-color-chooser"></div>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Outline Width (px)</label>
                                    <input type="number" min="1" max="12" class="setting-input" name="setting-input" data-setting="selection.outlineWidth" value="${this.configManager.get('selection.outlineWidth')}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Group Outline Width (px)</label>
                                    <input type="number" min="1" max="16" class="setting-input" name="setting-input" data-setting="selection.groupOutlineWidth" value="${this.configManager.get('selection.groupOutlineWidth')}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Nested Groups Highlight Color</label>
                                    <div id="hierarchy-color-chooser"></div>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Marquee Color</label>
                                    <input type="color" class="setting-input" name="setting-input" data-setting="selection.marqueeColor" value="${this.configManager.get('selection.marqueeColor')}"/>
                                </div>
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Marquee Opacity</label>
                                    <input type="range" min="0" max="1" step="0.05" class="setting-input" name="setting-input" data-setting="selection.marqueeOpacity" value="${this.configManager.get('selection.marqueeOpacity')}" style="width:100%;"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 style="font-size: 1rem; font-weight: 500; margin-bottom: 0.75rem; color: #d1d5db;">Layers</h4>
                            <div style="display: flex; flex-direction: column; gap: 1rem; padding-left: 0.5rem; border-left: 2px solid #374151;">
                                <div>
                                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Active Layer Border Color</label>
                                    <div id="active-layer-border-color-chooser"></div>
                                </div>
                            </div>
                        </div>
                    </div>                `;
                this.initializeColorChoosers();
                break;
            case 'assets':
                content.innerHTML = this.renderAssetSettings();
                break;
            case 'shortcuts':
                content.innerHTML = this.renderShortcutSettings();
                break;
            case 'performance':
                content.innerHTML = this.renderPerformanceSettings();
                break;
        }
        
        this.setupSettingsInputs();
    }

    /**
     * Initialize color choosers for selection settings
     */
    initializeColorChoosers() {
        // Outline Color Chooser
        const outlineColorContainer = document.getElementById('outline-color-chooser');
        if (outlineColorContainer) {
            const outlineColorChooser = ColorChooser.forSettings(
                this.configManager.get('selection.outlineColor'),
                (newColor) => {
                    this.configManager.set('selection.outlineColor', newColor);
                }
            );
            outlineColorContainer.appendChild(outlineColorChooser.createInlineElement());
        }

        // Hierarchy Highlight Color Chooser
        const hierarchyColorContainer = document.getElementById('hierarchy-color-chooser');
        if (hierarchyColorContainer) {
            const hierarchyColorChooser = ColorChooser.forSettings(
                this.configManager.get('selection.hierarchyHighlightColor') || '#3B82F6',
                (newColor) => {
                    this.configManager.set('selection.hierarchyHighlightColor', newColor);
                }
            );
            hierarchyColorContainer.appendChild(hierarchyColorChooser.createInlineElement());
        }

        // Active Layer Border Color Chooser
        const activeLayerBorderColorContainer = document.getElementById('active-layer-border-color-chooser');
        if (activeLayerBorderColorContainer) {
            const activeLayerBorderColorChooser = ColorChooser.forSettings(
                this.configManager.get('selection.activeLayerBorderColor') || '#3B82F6',
                (newColor) => {
                    this.configManager.set('selection.activeLayerBorderColor', newColor);
                }
            );
            activeLayerBorderColorContainer.appendChild(activeLayerBorderColorChooser.createInlineElement());
        }
    }

    renderGeneralSettings() {
        const settings = this.configManager.getAll();
        
        return `
            <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">General Settings</h3>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Theme</label>
                    <select class="setting-input" name="setting-input" data-setting="ui.theme" style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        <option value="dark" ${settings.ui.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        <option value="light" ${settings.ui.theme === 'light' ? 'selected' : ''}>Light</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">UI Font Scale</label>
                    <input type="number" step="0.05" min="0.5" max="2.0" class="setting-input" name="setting-input" data-setting="ui.fontScale" 
                           value="${settings.ui.fontScale || 1.0}"
                           style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                </div>

                <div>
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Panel Width (px)</label>
                    <input type="number" step="10" min="200" max="600" class="setting-input" name="setting-input" data-setting="ui.panelWidth" 
                           value="${settings.ui.panelWidth || 300}"
                           style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                </div>

                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="ui.showTooltips" ${settings.ui.showTooltips ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Show Tooltips</span>
                    </label>
                </div>

                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="ui.compactMode" ${settings.ui.compactMode ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Compact Mode</span>
                    </label>
                </div>
                
                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.autoSave" ${settings.editor.autoSave ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Auto Save</span>
                    </label>
                </div>
                
                <div>
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Auto Save Interval (minutes)</label>
                    <input type="number" class="setting-input" name="setting-input" data-setting="editor.autoSaveInterval" 
                           value="${settings.editor.autoSaveInterval / 60000}" min="1" max="60"
                           style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                </div>
                
                <div>
                    <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Undo History Limit</label>
                    <input type="number" class="setting-input" name="setting-input" data-setting="editor.undoHistoryLimit" 
                           value="${settings.editor.undoHistoryLimit}" min="1" max="1000"
                           style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                </div>
                
                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.showFPS" ${settings.editor.showFPS ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Show FPS Counter</span>
                    </label>
                </div>
                
                <div style="border-top: 1px solid #374151; padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">Axis Constraint</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.showAxis" ${settings.editor.axisConstraint?.showAxis ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Show Axis Line</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Axis Color</label>
                            <div class="axis-color-container" style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="color" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.axisColor" 
                                       value="${settings.editor.axisConstraint?.axisColor || '#cccccc'}"
                                       style="width: 3rem; height: 2rem; padding: 0; border: 1px solid #4b5563; border-radius: 0.25rem; background: none;">
                                <input type="text" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.axisColor" 
                                       value="${settings.editor.axisConstraint?.axisColor || '#cccccc'}"
                                       style="flex: 1; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                            </div>
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Axis Width (px)</label>
                            <input type="number" step="1" min="1" max="10" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.axisWidth" 
                                   value="${settings.editor.axisConstraint?.axisWidth || 1}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        </div>
                    </div>
                </div>
                
                <div style="border-top: 1px solid #374151; padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">View Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.grid" ${settings.editor.view?.grid ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Show Grid</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.gameMode" ${settings.editor.view?.gameMode ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Game Mode</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.snapToGrid" ${settings.editor.view?.snapToGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Snap To Grid</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.objectBoundaries" ${settings.editor.view?.objectBoundaries ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Object Boundaries</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.objectCollisions" ${settings.editor.view?.objectCollisions ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Object Collisions</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }



    renderCameraSettings() {
        return `<h3>Camera Settings</h3><p>Camera settings will be implemented here.</p>`;
    }

    renderSelectionSettings() {
        return `<h3>Selection Settings</h3><p>Selection settings will be implemented here.</p>`;
    }

    renderAssetSettings() {
        return `<h3>Asset Settings</h3><p>Asset settings will be implemented here.</p>`;
    }

    renderShortcutSettings() {
        return `<h3>Keyboard Shortcuts</h3><p>Shortcut settings will be implemented here.</p>`;
    }

    renderPerformanceSettings() {
        return `<h3>Performance Settings</h3><p>Performance settings will be implemented here.</p>`;
    }

    setupSettingsInputs() {
        document.querySelectorAll('.setting-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const path = e.target.dataset.setting;
                if (!path) return;

                let value = e.target.value;

                if (e.target.type === 'checkbox') {
                    value = e.target.checked;
                } else if (e.target.type === 'number' || e.target.type === 'range') {
                    value = parseFloat(value);

                    // Special handling for autoSaveInterval (convert minutes to milliseconds)
                    if (path === 'editor.autoSaveInterval') {
                        value = value * 60000;
                    }
                }

                // Handle grid settings with immediate sync to StateManager
                if (path.startsWith('grid.') || path.startsWith('canvas.')) {
                    // Save to ConfigManager
                    this.configManager.set(path, value);
                    // Sync to StateManager for immediate application
                    if (this.gridSettings) {
                        this.gridSettings.syncAllGridSettingsToState(path, value);
                    }
                    return; // Grid settings handled, don't process further
                }

                // Synchronize view options with StateManager in real-time
                if (path.startsWith('editor.view.')) {
                    const stateKey = path.replace('editor.view.', 'view.');
                    // Update StateManager immediately
                    if (window.editor?.stateManager) {
                        window.editor.stateManager.set(stateKey, value);
                        // Apply the view option immediately
                        if (window.editor.eventHandlers) {
                            const option = stateKey.replace('view.', '');
                            window.editor.eventHandlers.applyViewOption(option, value);
                            // Update menu checkbox state to match settings panel
                            window.editor.eventHandlers.updateViewCheckbox(option, value);
                        }
                    }
                }

                this.configManager.set(path, value);

                // Apply compact mode immediately
                if (path === 'ui.compactMode') {
                    this.applyCompactMode(value);
                }

                // Synchronize color inputs for axis constraint
                if (path === 'editor.axisConstraint.axisColor') {
                    const container = e.target.closest('.axis-color-container');
                    if (container) {
                        const colorInputs = container.querySelectorAll('input[data-setting="editor.axisConstraint.axisColor"]');
                        colorInputs.forEach(input => {
                            if (input !== e.target) {
                                input.value = value;
                            }
                        });
                    }
                }
            });
        });
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
        
        // Trigger layout update
        if (window.editor && window.editor.canvasRenderer) {
            window.editor.canvasRenderer.resizeCanvas();
            window.editor.render();
        }
        
        // Ensure grid settings visibility is maintained after compact mode change
        if (this.gridSettings && typeof this.gridSettings.handleGridTypeChange === 'function') {
            setTimeout(() => {
                this.gridSettings.handleGridTypeChange();
                // Re-initialize event listeners after DOM update
                this.gridSettings.initializeEventListeners();
            }, 100); // Small delay to ensure DOM is updated
        }
    }
    

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            this.configManager.reset();
            
            // Apply compact mode after reset
            this.applyCompactMode(false);
            
            // Sync grid settings after reset to ensure proper initialization
            this.gridSettings.syncAllGridSettingsToState();
            
            this.renderSettingsContent(document.querySelector('.settings-tab.active').dataset.tab);
        }
    }

    exportSettings() {
        const settings = this.configManager.exportSettings();
        const blob = new Blob([settings], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leveleditor-settings.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            if (this.configManager.importSettings(e.target.result)) {
                alert('Settings imported successfully!');
                this.renderSettingsContent(document.querySelector('.settings-tab.active').dataset.tab);
            } else {
                alert('Failed to import settings. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    saveSettings() {
        // Save current grid settings from StateManager to ConfigManager before saving
        if (window.editor?.stateManager) {
            const gridSize = window.editor.stateManager.get('canvas.gridSize');
            const gridColor = window.editor.stateManager.get('canvas.gridColor');
            const gridThickness = window.editor.stateManager.get('canvas.gridThickness');
            const gridOpacity = window.editor.stateManager.get('canvas.gridOpacity');
            const gridSubdivisions = window.editor.stateManager.get('canvas.gridSubdivisions');
            const gridSubdivColor = window.editor.stateManager.get('canvas.gridSubdivColor');
            const gridSubdivThickness = window.editor.stateManager.get('canvas.gridSubdivThickness');
            const gridType = window.editor.stateManager.get('canvas.gridType');
            const hexOrientation = window.editor.stateManager.get('canvas.hexOrientation');


            if (gridSize !== undefined) this.configManager.set('grid.size', gridSize);
            if (gridColor !== undefined) {
                // Convert rgba color to hex for storage
                const hexColor = RenderUtils.rgbaToHex(gridColor);
                this.configManager.set('grid.color', hexColor);
            }
            if (gridThickness !== undefined) this.configManager.set('grid.thickness', gridThickness);
            if (gridOpacity !== undefined) this.configManager.set('grid.opacity', gridOpacity);
            if (gridSubdivisions !== undefined) this.configManager.set('grid.subdivisions', gridSubdivisions);
            if (gridSubdivColor !== undefined) {
                // Convert rgba color to hex for storage
                const hexSubdivColor = RenderUtils.rgbaToHex(gridSubdivColor);
                this.configManager.set('grid.subdivColor', hexSubdivColor);
            }
            if (gridSubdivThickness !== undefined) this.configManager.set('grid.subdivThickness', gridSubdivThickness);
            if (gridType !== undefined) this.configManager.set('canvas.gridType', gridType);
            if (hexOrientation !== undefined) this.configManager.set('canvas.hexOrientation', hexOrientation);
        }

        this.configManager.saveSettings();

        // Sync all grid settings to StateManager before closing (for consistency)
        this.gridSettings.syncAllGridSettingsToState();

        // Apply UI font scale globally
        const scale = this.configManager.get('ui.fontScale') || 1.0;
        document.documentElement.style.fontSize = `${scale * 16}px`;
        this.hide();
    }
    
    cancelSettings() {
        // Reload settings from ConfigManager to discard unsaved changes
        this.configManager.loadAllConfigsSync();
        
        // Sync current saved settings to StateManager (not the unsaved changes)
        this.gridSettings.syncAllGridSettingsToState();
        
        this.hide();
    }
}