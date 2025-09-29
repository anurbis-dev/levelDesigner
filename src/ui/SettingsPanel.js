import { ColorChooser } from '../widgets/ColorChooser.js';
import { GridSettings } from './GridSettings.js';
import { RenderUtils } from '../utils/RenderUtils.js';
import { SettingsSyncManager } from '../utils/SettingsSyncManager.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';

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
        this.escapeKeyHandler = null;

        // Initialize grid settings module
        this.gridSettings = new GridSettings(configManager);
        
        // Initialize settings sync manager
        this.syncManager = new SettingsSyncManager(levelEditor);

        // Initialize context menu
        this.contextMenu = null;

        // Sync settings from ConfigManager to StateManager on initialization
        if (this.syncManager) {
            this.syncManager.syncFromConfigToState();
        }

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
            <div class="settings-panel-container" id="settings-panel-container">
                <div class="settings-header" id="settings-header">
                    <h2>Settings</h2>
                    <div class="settings-header-controls">
                        <button id="settings-menu-btn" class="settings-menu-btn">⋮</button>
                    </div>
                </div>
                
                <div class="settings-content-area">
                    <!-- Settings Categories -->
                    <div class="settings-nav">
                        <button class="settings-tab active" data-tab="general">General</button>
                        <button class="settings-tab" data-tab="grid">Grid & Snapping</button>
                        <button class="settings-tab" data-tab="camera">Camera</button>
                        <button class="settings-tab" data-tab="selection">Selection</button>
                        <button class="settings-tab" data-tab="assets">Assets</button>
                        <button class="settings-tab" data-tab="hotkeys">Hotkeys</button>
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
                        <button id="cancel-settings" class="settings-btn settings-btn-cancel">Cancel</button>
                        <button id="save-settings" class="settings-btn settings-btn-save">Apply Changes</button>
                    </div>
                </div>
                
                <!-- Hidden file input for import -->
                <input type="file" id="import-file" name="import-file" accept=".json" class="settings-input" style="display: none;">
                
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
                if (e.target.id === 'cancel-settings') {
                    this.cancelSettings();
                    return;
                }

                // Handle settings menu button
                if (e.target.id === 'settings-menu-btn') {
                    this.showContextMenu(e);
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
            });
        }

        // File import handler
        const importFile = document.getElementById('import-file');
        if (importFile) {
            importFile.addEventListener('change', (e) => {
                this.importSettings(e);
            });
        }
    }

    show() {
        this.isVisible = true;
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            
            // Load window position and size
            this.loadWindowState();
            
            // Setup window handlers and context menu after a short delay to ensure DOM is ready
            setTimeout(() => {
                this.setupWindowHandlers();
                this.setupContextMenu();
            }, 100);
            
            // Load last active tab from localStorage
            const savedTab = localStorage.getItem('levelEditor_lastActiveSettingsTab');
            const activeTab = savedTab || 'general';
            this.lastActiveTab = activeTab;
            
            // Activate the correct tab visually
            this.activateTab(activeTab);
            
            // First sync settings from ConfigManager to StateManager (for consistency)
            this.syncManager.syncFromConfigToState();

            // Sync grid settings to StateManager when panel opens
            if (this.gridSettings) {
                this.gridSettings.syncAllGridSettingsToState();
            }

            // Render content for the active tab (after StateManager is synced)
            this.renderSettingsContent(activeTab);

            // Now sync current StateManager values to UI (to show current state)
            this.syncManager.initializeFromState();

            // Add direct event listeners to tabs after they are visible
            this.setupTabEventListeners();
            
            // Setup input event listeners after content is rendered
            this.setupSettingsInputs();

            // Setup escape key handler to cancel settings
            this.setupEscapeKeyHandler();
            
            // Initialize grid settings event listeners
            if (this.gridSettings) {
                this.gridSettings.initializeEventListeners();
            }
        }
    }

    hide() {
        this.isVisible = false;

        // Save window state before hiding
        this.saveWindowState();

        // Remove escape key handler
        this.removeEscapeKeyHandler();

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
            case 'grid':
                content = this.gridSettings.renderGridSettings();
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
                spacing: stateManager.get('ui.spacing')
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
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">UI Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="ui.showTooltips" ${settings.ui?.showTooltips ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Show Tooltips</span>
                            </label>
                        </div>
                        
                        <!-- Sliders in columns -->
                        <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; width: 100%;">
                            <div>
                                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Font Scale</label>
                                <input type="range" min="0.5" max="2" step="0.1" class="setting-input" name="setting-input" data-setting="ui.fontScale" 
                                       value="${settings.ui?.fontScale || 1.0}"
                                       style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                                <div style="text-align: center; color: #9ca3af; font-size: 0.75rem; margin-top: 0.25rem;">
                                    ${(settings.ui?.fontScale || 1.0).toFixed(1)}x
                                </div>
                            </div>
                            
                            <div>
                                <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Spacing</label>
                                <input type="range" min="0" max="2" step="0.1" class="setting-input" name="setting-input" data-setting="ui.spacing" 
                                       value="${settings.ui?.spacing || 1.0}"
                                       style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                                <div style="text-align: center; color: #9ca3af; font-size: 0.75rem; margin-top: 0.25rem;">
                                    ${(settings.ui?.spacing || 1.0).toFixed(1)}x
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Editor Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">Editor Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.autoSave" ${settings.editor?.autoSave ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Auto Save</span>
                            </label>
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Auto Save Interval (minutes)</label>
                            <input type="number" min="1" max="60" step="1" class="setting-input" name="setting-input" data-setting="editor.autoSaveInterval" 
                                   value="${settings.editor?.autoSaveInterval || 5}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        </div>
                        
                        <div>
                            <label style="display: block; font-size: 0.875rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.5rem;">Undo History Limit</label>
                            <input type="number" min="10" max="1000" step="10" class="setting-input" name="setting-input" data-setting="editor.undoHistoryLimit" 
                                   value="${settings.editor?.undoHistoryLimit || 100}"
                                   style="width: 100%; padding: 0.5rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white;">
                        </div>
                    </div>
                </div>

                <!-- Axis Constraint Settings -->
                <div style="border: 1px solid #374151; border-radius: 0.5rem; padding: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">Axis Constraint</h4>
                    
                    <div class="settings-flex" style="display: flex; gap: 1rem; align-items: center; width: 100%;">
                        <!-- Show Axis Checkbox -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.showAxis" 
                                   ${settings.editor?.axisConstraint?.showAxis ? 'checked' : ''}
                                   style="width: 1rem; height: 1rem;">
                            <label style="font-size: 0.875rem; color: #d1d5db;">Show Axis</label>
                        </div>
                        
                        <!-- Axis Color -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-size: 0.875rem; color: #d1d5db;">Color:</label>
                            <input type="color" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.axisColor" 
                                   value="${settings.editor?.axisConstraint?.axisColor || '#cccccc'}"
                                   style="width: 2rem; height: 2rem; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem;">
                        </div>
                        
                        <!-- Axis Width -->
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <label style="font-size: 0.875rem; color: #d1d5db;">Width:</label>
                            <input type="number" step="1" min="1" max="10" class="setting-input" name="setting-input" data-setting="editor.axisConstraint.axisWidth" 
                                   value="${settings.editor?.axisConstraint?.axisWidth || 1}"
                                   style="width: 4rem; padding: 0.25rem; background: #374151; border: 1px solid #4b5563; border-radius: 0.25rem; color: white; text-align: center;">
                        </div>
                    </div>
                </div>
                
                <div style="border-top: 1px solid #374151; padding-top: 1rem; margin-top: 1rem;">
                    <h4 style="font-size: 1rem; font-weight: 500; color: #d1d5db; margin-bottom: 0.75rem;">View Settings</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.gameMode" ${settings.editor.view?.gameMode ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Game Mode</span>
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
                        
                        <div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" class="setting-input" name="setting-input" data-setting="editor.view.parallax" ${settings.editor.view?.parallax ? 'checked' : ''} style="margin-right: 0.5rem;">
                                <span style="color: #d1d5db;">Parallax</span>
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
        const shortcuts = this.configManager.getShortcuts();
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
                        <input type="text" class="hotkey-input" data-shortcut="${action}" data-category="editor" value="${keyCombo}" readonly>
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
                        <input type="text" class="hotkey-input" data-shortcut="${action}" data-category="ui" value="${keyCombo}" readonly>
                    </div>
                `;
            });

            content += '</div>';
        }

        return content;
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
            displayElement.textContent = `${parseFloat(value).toFixed(1)}x`;
        }
    }

    setupSettingsInputs() {
        document.querySelectorAll('.setting-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const path = e.target.dataset.setting;
                if (!path) return;

                let value;
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else {
                    value = input.value;
                }

                // Update real-time display values for sliders
                if (input.type === 'range') {
                    this.updateSliderDisplay(input, value);
                }

                // Synchronize with StateManager for real-time updates
                this.syncManager.syncSettingToState(path, value);

                // Handle UI-specific immediate updates
                if (path === 'ui.compactMode') {
                    this.applyCompactMode(value);
                }

            });
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
            const shortcuts = this.configManager.getShortcuts();

            // Update the shortcut
            if (!shortcuts[category]) {
                shortcuts[category] = {};
            }
            shortcuts[category][action] = {
                ...shortcutData,
                description: shortcuts[category][action]?.description || action
            };

            // Save to config
            this.configManager.set(`shortcuts.${category}.${action}`, shortcuts[category][action]);
        }
    }

    /**
     * Setup escape key handler to cancel settings
     */
    setupEscapeKeyHandler() {
        // Remove existing handler if any
        this.removeEscapeKeyHandler();

        // Add new handler
        this.escapeKeyHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelSettings();
            }
        };

        document.addEventListener('keydown', this.escapeKeyHandler);
    }

    /**
     * Remove escape key handler
     */
    removeEscapeKeyHandler() {
        if (this.escapeKeyHandler) {
            document.removeEventListener('keydown', this.escapeKeyHandler);
            this.escapeKeyHandler = null;
        }
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

    resetSettings() {
        // Reset to default values
        this.configManager.reset();
        
        // Sync to StateManager
        this.syncManager.syncFromConfigToState();
        
        // Re-render current tab
        this.renderSettingsContent(this.lastActiveTab);
        
        // Re-setup inputs
        this.setupSettingsInputs();
    }

    exportSettings() {
        const settings = this.configManager.getAll();
        const dataStr = JSON.stringify(settings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'level-editor-settings.json';
        link.click();
    }

    importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                this.configManager.importSettings(settings);
                
                // Reload all configs
                this.configManager.loadAllConfigsSync();
                
                // Sync to StateManager
                this.syncManager.syncFromConfigToState();
                
                // Re-render current tab
                this.renderSettingsContent(this.lastActiveTab);
                
                // Re-setup inputs
                this.setupSettingsInputs();
                
                alert('Settings imported successfully!');
            } catch (error) {
                alert('Error importing settings: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    saveSettings() {
        // Apply all UI settings to StateManager first
        this.syncManager.applyAllUISettingsToState();

        // Save all UI settings to ConfigManager
        this.syncManager.saveAllUISettingsToConfig();

        // Handle special grid settings that need color conversion
        this.saveGridSettingsWithColorConversion();

        // Note: Settings are now saved only on page unload/close, not immediately

        this.hide();
    }

    /**
     * Save grid settings with proper color conversion
     */
    saveGridSettingsWithColorConversion() {
        if (!window.editor?.stateManager) return;

        // Get grid color values from StateManager
        const gridColor = window.editor.stateManager.get('canvas.gridColor');
        const gridSubdivColor = window.editor.stateManager.get('canvas.gridSubdivColor');

        // Convert and save colors to canvas config
        if (gridColor !== undefined) {
            const hexColor = ColorUtils.toHex(gridColor);
            this.configManager.set('canvas.gridColor', hexColor);
        }
        if (gridSubdivColor !== undefined) {
            const hexSubdivColor = ColorUtils.toHex(gridSubdivColor);
            this.configManager.set('canvas.gridSubdivColor', hexSubdivColor);
        }
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
    resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults? This action cannot be undone.')) {
            // Reset to defaults
            this.configManager.reset();
            
            // Sync settings from ConfigManager to StateManager FIRST
            this.syncManager.syncFromConfigToState();
            
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
        const settings = this.configManager.getAll();
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
     * Load window state (position and size)
     */
    loadWindowState() {
        const container = document.getElementById('settings-panel-container');
        if (!container) return;

        // Get saved state or use defaults
        const savedState = this.configManager.get('ui.settingsWindow') || {};
        const defaultState = this.getDefaultWindowState();
        
        const state = {
            x: savedState.x ?? defaultState.x,
            y: savedState.y ?? defaultState.y,
            width: savedState.width ?? defaultState.width,
            height: savedState.height ?? defaultState.height
        };

        // Apply state
        container.style.position = 'absolute';
        container.style.left = `${state.x}px`;
        container.style.top = `${state.y}px`;
        container.style.width = `${state.width}px`;
        container.style.height = `${state.height}px`;
        container.style.transform = 'none';
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
     * Save window state
     */
    saveWindowState() {
        const container = document.getElementById('settings-panel-container');
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const state = {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };

        this.configManager.set('ui.settingsWindow', state);
    }

    /**
     * Setup window resize and drag handlers
     */
    setupWindowHandlers() {
        const container = document.getElementById('settings-panel-container');
        const header = document.getElementById('settings-header');
        
        if (!container || !header) return;

        // Make window draggable
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.settings-context-menu')) return;
            
            isDragging = true;
            dragStart.x = e.clientX - container.offsetLeft;
            dragStart.y = e.clientY - container.offsetTop;
            container.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;
            
            // Keep window within viewport
            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;
            
            container.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            container.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            
            // Auto-save position during drag
            this.saveWindowState();
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = '';
                this.saveWindowState();
            }
        });

        // Handle window resize
        let isResizing = false;
        let resizeStart = { x: 0, y: 0, width: 0, height: 0 };

        const handleResize = (e) => {
            if (!isResizing) return;
            
            const newWidth = resizeStart.width + (e.clientX - resizeStart.x);
            const newHeight = resizeStart.height + (e.clientY - resizeStart.y);
            
            const minWidth = 400;
            const minHeight = 300;
            
            container.style.width = `${Math.max(minWidth, newWidth)}px`;
            container.style.height = `${Math.max(minHeight, newHeight)}px`;
            
            // Auto-save size during resize
            this.saveWindowState();
        };

        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            this.saveWindowState();
        };

        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: 0;
            right: 0;
            width: 20px;
            height: 20px;
            cursor: se-resize;
            background: linear-gradient(-45deg, transparent 30%, #374151 30%, #374151 50%, transparent 50%);
        `;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizeStart.x = e.clientX;
            resizeStart.y = e.clientY;
            resizeStart.width = container.offsetWidth;
            resizeStart.height = container.offsetHeight;
            
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            e.preventDefault();
        });
        
        container.appendChild(resizeHandle);
    }
    
    cancelSettings() {
        // Don't reload from files - just close the window
        // The current settings in StateManager are already the last user settings
        // No need to reset anything
        
        this.hide();
    }
}
