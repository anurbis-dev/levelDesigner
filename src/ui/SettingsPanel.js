import { GridSettings } from './GridSettings.js';
import { SettingsSyncManager } from '../utils/SettingsSyncManager.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { eventHandlerManager } from '../managers/EventHandlerManager.js';
import { EventHandlerUtils } from '../utils/EventHandlerUtils.js';
import { dialogSizeManager } from '../utils/DialogSizeManager.js';
import {
    renderGeneralSettings,
    renderColorsSettings,
    renderSelectionSettings,
    renderTouchSettings,
    renderCameraSettings,
    renderAssetsSettings,
    renderPerformanceSettings
} from './panel-structures/SettingsPanelRenderers.js';

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

        // Track if width has been calculated to prevent recalculation
        this.widthCalculated = false;

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

                // Calculate and apply optimal dialog size
                try {
                    this.updateDialogSize();
                } catch (error) {
                    Logger.ui.warn('Error updating dialog size:', error);
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
        this.widthCalculated = false; // Reset width calculation flag

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
        return renderGeneralSettings(this.levelEditor?.stateManager);
    }

    /**
     * Update dialog size based on all sections content
     */
    updateDialogSize() {
        if (this.widthCalculated) {
            return;
        }

        const sectionRenderers = [
            renderGeneralSettings,
            renderColorsSettings,
            renderSelectionSettings,
            renderTouchSettings,
            renderCameraSettings,
            renderAssetsSettings,
            renderPerformanceSettings
        ];

        const optimalWidth = dialogSizeManager.calculateOptimalWidth(
            'settings-panel-container', 
            sectionRenderers, 
            this.levelEditor?.stateManager
        );

        const container = document.getElementById('settings-panel-container');
        if (container) {
            container.style.width = `${optimalWidth}px`;
            container.style.minWidth = `${optimalWidth}px`;
            container.style.maxWidth = `${optimalWidth}px`;

            // Set CSS variable for override rules
            container.style.setProperty('--fixed-dialog-width', `${optimalWidth}px`);

            this.widthCalculated = true;
        }
    }

    renderColorsSettings() {
        return renderColorsSettings(this.levelEditor?.stateManager);
    }

    renderCameraSettings() {
        return renderCameraSettings(this.levelEditor?.stateManager);
    }

    renderSelectionSettings() {
        return renderSelectionSettings(this.levelEditor?.stateManager);
    }

    renderAssetsSettings() {
        return renderAssetsSettings(this.levelEditor?.stateManager);
    }


    renderPerformanceSettings() {
        return renderPerformanceSettings(this.levelEditor?.stateManager);
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
        return renderTouchSettings(this.levelEditor?.stateManager);
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
            'ui.resizerColor',
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
