import { GridSettings } from './GridSettings.js';
import { SettingsSyncManager } from '../utils/SettingsSyncManager.js';
import { ResetRegistry } from '../utils/ResetRegistry.js';
import { ShortcutFormatter } from '../utils/ShortcutFormatter.js';
import { ColorUtils } from '../utils/ColorUtils.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { Logger } from '../utils/Logger.js';
import { ValidationUtils } from '../utils/ValidationUtils.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { dialogSizeManager } from '../utils/DialogSizeManager.js';
import { DialogResizer } from '../utils/DialogResizer.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import {
    renderGeneralSettings,
    renderColorsSettings,
    renderSelectionSettings,
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

        // Whether input changes apply live to the editor, or only when Apply is pressed
        this.autoApply = localStorage.getItem('levelEditor_settingsAutoApply') !== '0';

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
        // Create settings overlay element
        const overlay = document.createElement('div');
        overlay.id = 'settings-overlay';
        overlay.className = 'dialog-overlay';
        overlay.style.display = 'none'; // Only set display, let CSS handle the rest
        
        overlay.innerHTML = `
            <div class="settings-panel-container dialog-container" id="settings-panel-container">
                <div class="settings-header" id="settings-header">
                    <h2>Settings</h2>
                    <div class="settings-header-controls">
                        ${SearchUtils.createSearchInput(
                            'Search parameters...',
                            'settings-search-input',
                            'settings-header-search-input px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-white focus:border-blue-500 focus:outline-none w-48'
                        ).outerHTML}
                        <button id="settings-menu-btn" class="settings-menu-btn">⋮</button>
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
                        <label class="settings-auto-apply-label">
                            <input type="checkbox" id="settings-auto-apply" checked>
                            Apply changes automatically
                        </label>
                    </div>
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


    show() {
        try {
            // Store original values before showing panel
            this.storeOriginalValues();

            this.isVisible = true;
            const overlay = document.getElementById('settings-overlay');
            if (overlay) {
                // Use CSS class instead of direct style manipulation
                overlay.classList.add('dialog-visible');
                overlay.style.display = 'flex';

                // Reflect the auto-apply preference in the checkbox and Cancel/Apply buttons
                const autoApplyCheckbox = document.getElementById('settings-auto-apply');
                if (autoApplyCheckbox) {
                    autoApplyCheckbox.checked = this.autoApply;
                }
                this.updateAutoApplyUI();

                // Window positioning is now handled by CSS only
                
                // Update dialog size (restore saved width or use default)
                this.updateDialogSize();
                
                // Setup resizer after size is calculated
                const container = document.getElementById('settings-panel-container');
                if (container) {
                    this.resizer = DialogResizer.setupResizer(
                        container, 
                        'settings-panel-container', 
                        { 
                            levelEditor: this.levelEditor, 
                            resizerId: 'settings-panel-resizer' 
                        }
                    );
                }
                
                // Setup event handlers and context menu (DOM is already ready at this point)
                try {
                    this.setupNewEventHandlers();
                    this.setupContextMenu();
                } catch (error) {
                    Logger.ui.warn('Error setting up event handlers:', error);
                }

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
                overlay.classList.remove('dialog-visible');
                overlay.style.display = 'none';
            }
            this.isVisible = false;
        }
    }

    hide() {
        this.isVisible = false;
        // Don't reset widthCalculated - preserve saved width for next show

        // Remove event handlers using new system
        const overlay = document.getElementById('settings-overlay');
        const container = document.getElementById('settings-panel-container');
        
        if (overlay) {
            eventHandlerManager.unregisterContainer(overlay);
        }
        if (container) {
            eventHandlerManager.unregisterContainer(container);
        }

        if (overlay) {
            overlay.classList.remove('dialog-visible');
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

        const container = document.getElementById('settings-panel-container');
        if (!container) return;

        DialogResizer.applyCalculatedWidth(container, 'settings-panel-container', this.levelEditor);
        this.widthCalculated = true;
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

        // Mouse gestures (informational, not rebindable)
        if (shortcuts.mouse) {
            content += '<h4>Mouse Gestures</h4>';
            content += '<div class="hotkeys-list">';

            Object.entries(shortcuts.mouse).forEach(([action, shortcut]) => {
                const parts = [];
                if (shortcut.ctrlKey) parts.push('Ctrl');
                if (shortcut.altKey) parts.push('Alt');
                if (shortcut.shiftKey) parts.push('Shift');
                parts.push(shortcut.key || 'Drag');
                content += `
                    <div class="hotkey-item">
                        <div class="hotkey-description">${shortcut.description}</div>
                        <input type="text" id="hotkey-mouse-${action}" class="hotkey-input" data-static="true" value="${parts.join(' + ')}" readonly>
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
        return ShortcutFormatter.format(shortcut);
    }



    setupSettingsInputs() {
        const settingsRoot = document.getElementById('settings-panel-container') || document;
        settingsRoot.querySelectorAll('.setting-input').forEach(input => {
            // Remove old listeners if exist
            if (input._inputHandler) {
                input.removeEventListener('input', input._inputHandler);
            }
            if (input._changeHandler) {
                input.removeEventListener('change', input._changeHandler);
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

                // Manual mode: defer application until the user presses Apply Changes
                if (!this.autoApply) return;

                // Font scale / spacing sliders apply immediately, except font scale itself
                // (which only applies on mouse release — see the 'change' listener below).
                // The live value overlay for all range sliders is handled by setupRangeSliders().
                if (input.type === 'range' && (path === 'ui.fontScale' || path === 'ui.spacingH' || path === 'ui.spacingV' || path === 'ui.elementSize' || path === 'ui.scrollbarSize' || path === 'ui.menuGapBase')) {
                    if (path !== 'ui.fontScale' && this.syncManager) {
                        this.syncManager.syncSettingToState(path, value);
                    }
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
                // Skip font scale here - it applies only on mouse release
                else if (path !== 'ui.fontScale') {
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
            
            // Add change listener for scaling sliders (ensure final value applied)
            if (input.type === 'range' && (input.dataset.setting === 'ui.fontScale' || input.dataset.setting === 'ui.spacingH' || input.dataset.setting === 'ui.spacingV' || input.dataset.setting === 'ui.elementSize' || input.dataset.setting === 'ui.scrollbarSize' || input.dataset.setting === 'ui.menuGapBase')) {
                input._changeHandler = (e) => {
                    if (!this.autoApply) return;

                    const path = e.target.dataset.setting;
                    const value = e.target.value;

                    // Apply the setting change when user releases the slider
                    if (this.syncManager) {
                        this.syncManager.syncSettingToState(path, value);
                    }
                };
                input.addEventListener('change', input._changeHandler);
            }
            
        });

        // Wire the custom slider widget (value overlay + double-click numeric edit) for
        // every range input currently in the DOM, regardless of which tab rendered it.
        this.setupRangeSliders();

        // Setup real-time sync from StateManager to UI (for toolbar/menu changes)
        this.setupStateManagerSubscriptions();

        // Setup hotkey input handlers
        this.setupHotkeyInputs();

        // Rebuild Backspace-to-reset targets for whichever tab is now in the DOM
        this.rebuildResetRegistry();

        // Re-apply the header search term (if any) to the freshly rendered tab content
        const headerSearchInput = document.getElementById('settings-search-input');
        this.filterSettingsContent(headerSearchInput ? headerSearchInput.value : '');
    }

    /**
     * Wire the thumb-less custom slider widget: live value overlay text while dragging, and
     * double-click to swap in a plain number input for direct entry. Queried by element type
     * (input[type="range"]), not by CSS class, so it covers both the shared .setting-input
     * sliders (SettingsSectionConstructor.createSettingsRange) and GridSettings.js's
     * differently-classed .settings-input slider (grid-opacity) with one implementation.
     */
    setupRangeSliders() {
        const settingsRoot = document.getElementById('settings-panel-container') || document;
        settingsRoot.querySelectorAll('input[type="range"]').forEach(input => {
            if (input._rangeSliderWired) return;
            input._rangeSliderWired = true;

            const wrapper = input.closest('.settings-range-wrapper');
            if (!wrapper) return;
            const valueEl = wrapper.querySelector('.settings-range-value');
            const editInput = wrapper.querySelector('.settings-range-edit');
            const unit = input.dataset.unit || '';

            const formatValue = () => {
                const num = parseFloat(input.value);
                return Number.isFinite(num) ? `${num.toFixed(1)}${unit}` : input.value;
            };

            // Shift+drag: fine adjustment. Native range dragging sets .value straight from the
            // pointer's absolute track position on every 'input' tick, which can't be cancelled
            // via preventDefault (the browser keeps following the cursor 1:1 regardless). Instead,
            // this listener — registered first, so it runs before updateValueText/updateFill below —
            // re-derives each tick's raw cursor-driven delta and, while Shift is held, overwrites
            // input.value with only a fraction of that delta. Reassigning .value here does not
            // re-dispatch 'input', so this can't recurse.
            const SOFT_DRAG_FACTOR = 0.2;
            let dragShiftActive = false;
            let dragValue = parseFloat(input.value);
            let lastRawValue = dragValue;

            input.addEventListener('pointerdown', (e) => {
                dragShiftActive = e.shiftKey;
                dragValue = parseFloat(input.value);
                lastRawValue = dragValue;
            });
            input.addEventListener('pointerup', () => { dragShiftActive = false; });

            input.addEventListener('input', () => {
                const rawValue = parseFloat(input.value);
                if (!dragShiftActive) {
                    dragValue = rawValue;
                    lastRawValue = rawValue;
                    return;
                }

                const delta = rawValue - lastRawValue;
                lastRawValue = rawValue;

                const min = parseFloat(input.min) || 0;
                const max = parseFloat(input.max);
                const step = parseFloat(input.step) || 0;

                dragValue += delta * SOFT_DRAG_FACTOR;
                dragValue = Math.max(min, Number.isFinite(max) ? Math.min(max, dragValue) : dragValue);
                if (step > 0) dragValue = Math.round(dragValue / step) * step;

                input.value = dragValue;
            });

            if (valueEl) {
                const updateValueText = () => { valueEl.textContent = formatValue(); };
                input.addEventListener('input', updateValueText);
                updateValueText();
            }

            // Drive the filled portion of the track (see --range-fill in settings-panel.css)
            const updateFill = () => {
                const min = parseFloat(input.min) || 0;
                const max = parseFloat(input.max);
                const val = parseFloat(input.value);
                const pct = Number.isFinite(max) && max > min && Number.isFinite(val)
                    ? ((val - min) / (max - min)) * 100
                    : 0;
                input.style.setProperty('--range-fill', `${pct}%`);
            };
            input.addEventListener('input', updateFill);
            updateFill();

            if (editInput) {
                const enterEditMode = () => {
                    editInput.value = input.value;
                    wrapper.classList.add('editing');
                    editInput.focus();
                    editInput.select();
                };

                const exitEditMode = (commit) => {
                    wrapper.classList.remove('editing');
                    if (!commit) return;

                    const num = parseFloat(editInput.value);
                    if (!Number.isFinite(num)) return;

                    const min = parseFloat(input.min);
                    const max = parseFloat(input.max);
                    let clamped = num;
                    if (Number.isFinite(min)) clamped = Math.max(min, clamped);
                    if (Number.isFinite(max)) clamped = Math.min(max, clamped);

                    input.value = clamped;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                };

                wrapper.addEventListener('dblclick', enterEditMode);
                editInput.addEventListener('blur', () => exitEditMode(true));
                editInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        exitEditMode(true);
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        exitEditMode(false);
                    }
                });
            }
        });
    }

    /**
     * Show/hide parameter rows across the currently rendered tab based on their label text,
     * driven by the single search input in the settings window header. A "row" is a label's
     * parent element, which in every settings constructor (checkbox, range, color, plain
     * input, and Grid tab's .settings-form-item) wraps exactly one label + its field. The
     * Hotkeys tab has no <label> elements, so its .hotkey-item rows are matched separately
     * against their .hotkey-description text.
     */
    filterSettingsContent(term) {
        const root = document.getElementById('settings-content');
        if (!root) return;

        const lower = (term || '').toLowerCase().trim();

        // Toggle display to/from 'none' while preserving whatever inline display value the
        // row had before hiding (e.g. the inline color-input wrapper's `display: flex`).
        // Blanking style.display on restore is NOT safe: once 'none' overwrites the CSSOM
        // display value there is no "previous value" to fall back to, so clearing it just
        // drops to the block default — cache the original value on hide and restore that.
        const setRowVisible = (el, visible) => {
            if (visible) {
                if (el.style.display === 'none') {
                    el.style.display = el.dataset.searchOrigDisplay || '';
                }
            } else if (el.style.display !== 'none') {
                el.dataset.searchOrigDisplay = el.style.display;
                el.style.display = 'none';
            }
        };

        root.querySelectorAll('label').forEach(label => {
            const row = label.parentElement;
            if (!row) return;
            setRowVisible(row, !lower || label.textContent.toLowerCase().includes(lower));
        });

        root.querySelectorAll('.hotkey-item').forEach(item => {
            const description = item.querySelector('.hotkey-description');
            const text = description ? description.textContent.toLowerCase() : '';
            setRowVisible(item, !lower || text.includes(lower));
        });

        // Hide sections left with zero matching rows so search doesn't leave empty title boxes
        root.querySelectorAll('.settings-section').forEach(section => {
            if (!lower) {
                setRowVisible(section, true);
                return;
            }
            const hasVisibleRow = Array.from(section.querySelectorAll('label'))
                .some(label => label.parentElement && label.parentElement.style.display !== 'none');
            setRowVisible(section, hasVisibleRow);
        });
    }

    /**
     * Collect every currently-rendered setting input (any tab except Hotkeys, which has no
     * "default" concept) for Backspace-to-reset (see ResetRegistry.js). Relies solely on the
     * [data-setting] attribute, not the "setting-input" CSS class, since GridSettings.js uses
     * a differently-named class ("settings-input") for the same purpose.
     */
    rebuildResetRegistry() {
        const settingsRoot = document.getElementById('settings-panel-container') || document;
        const fields = [];

        settingsRoot.querySelectorAll('[data-setting]').forEach(element => {
            const path = element.dataset.setting;
            const defaultValue = this.configManager?.getDefault(path);
            if (defaultValue === undefined) return;
            fields.push({ element, defaultValue });
        });

        ResetRegistry.setFields('settingsPanel', fields);
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

        // Sync UI spacing and size sliders from StateManager
        const uiKeys = ['ui.fontScale', 'ui.spacingH', 'ui.spacingV', 'ui.elementSize', 'ui.scrollbarSize', 'ui.menuGapBase'];
        uiKeys.forEach((key) => {
            this.levelEditor.stateManager.subscribe(key, (value) => {
                if (this.isVisible) {
                    this.updateUIInput(key, value);
                }
            });
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
            if (input.dataset.static) return; // Informational entries (mouse gestures) are not rebindable
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

            // Reflect the rebind in the main menu immediately. Full refresh() (not just
            // refreshShortcutLabels()) because an item that started with no shortcut renders
            // with no trailing `[data-shortcut-key]` span at all (see
            // MenuItemTemplateUtils.renderMenuItemTrailingHtml — empty text renders nothing) —
            // refreshShortcutLabels() can only update a span that already exists, so a rebind
            // from empty to a real key needs the item's DOM rebuilt, not just its label text.
            this.levelEditor?.menuManager?.refresh();
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

        // Create dialog handlers configuration using new system
        const dialogHandlers = EventHandlerUtils.createDialogHandlers(
            this.cancelSettings.bind(this), // ESC handler
            this.cancelSettings.bind(this), // Overlay click handler
            (e) => {
                // Handle close button
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
            }
        );

        // Register dialog with new event manager (avoid duplicate registration)
        try {
            if (eventHandlerManager.isContainerRegistered(overlay)) {
                eventHandlerManager.unregisterContainer(overlay);
            }
            eventHandlerManager.registerContainer(overlay, dialogHandlers);
        } catch (e) {
            Logger.ui.warn('SettingsPanel: overlay registration issue:', e);
        }

        // Setup input handlers for all inputs using new system
        const inputHandlers = EventHandlerUtils.createInputHandlers(
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

        try {
            if (eventHandlerManager.isContainerRegistered(container)) {
                eventHandlerManager.unregisterContainer(container);
            }
            eventHandlerManager.registerContainer(container, inputHandlers);
        } catch (e) {
            Logger.ui.warn('SettingsPanel: container registration issue:', e);
        }

        // Setup header search input (wired once; show()/hide() don't recreate this DOM node)
        const headerSearchInput = document.getElementById('settings-search-input');
        if (headerSearchInput && !headerSearchInput.dataset.searchWired) {
            headerSearchInput.dataset.searchWired = 'true';

            // First Escape with text should only clear the search box; only a second Escape
            // (already empty) should bubble up to the dialog's global Escape handler and
            // close the panel. stopPropagation here (registered before SearchUtils' own
            // Escape-clear listener on the same input) blocks that bubbling without
            // preventing SearchUtils' listener on this same element from also firing.
            headerSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && e.target.value) {
                    e.stopPropagation();
                }
            });

            SearchUtils.setupSearchListeners(headerSearchInput, (term) => this.filterSettingsContent(term));
        }

        // Setup auto-apply checkbox (wired once; show()/hide() don't recreate this DOM node)
        const autoApplyCheckbox = document.getElementById('settings-auto-apply');
        if (autoApplyCheckbox && !autoApplyCheckbox.dataset.autoApplyWired) {
            autoApplyCheckbox.dataset.autoApplyWired = 'true';
            autoApplyCheckbox.addEventListener('change', (e) => {
                this.autoApply = e.target.checked;
                localStorage.setItem('levelEditor_settingsAutoApply', this.autoApply ? '1' : '0');
                this.updateAutoApplyUI();
            });
        }

        // Setup file import handler
        const importFile = document.getElementById('import-file');
        if (importFile) {
            const fileHandlers = EventHandlerUtils.createInputHandlers(
                (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importSettings(file);
                    }
                }
            );

            try {
                const parent = importFile.parentElement;
                if (eventHandlerManager.isContainerRegistered(parent)) {
                    eventHandlerManager.unregisterContainer(parent);
                }
                eventHandlerManager.registerContainer(parent, fileHandlers);
            } catch (e) {
                Logger.ui.warn('SettingsPanel: import file registration issue:', e);
            }
        }

        Logger.ui.debug('SettingsPanel: New event handlers setup complete');
    }

    /**
     * Disable Cancel/Apply when auto-apply is on (there's nothing to commit or revert since
     * every change is already live), enable them when auto-apply is off (manual apply/cancel).
     */
    updateAutoApplyUI() {
        const cancelBtn = document.getElementById('cancel-settings');
        const saveBtn = document.getElementById('save-settings');
        if (cancelBtn) cancelBtn.disabled = this.autoApply;
        if (saveBtn) saveBtn.disabled = this.autoApply;
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
     * UniversalWindowHandlers compatibility method
     * Maps to saveSettings() for consistency
     */
    apply() {
        this.saveSettings();
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

        // Store every StateManager key the settings panel can modify (all tabs, not just
        // colors), so a manual-apply Cancel/close can fully revert. 'logger.colors' isn't
        // part of SettingsSyncManager's mapping since it's applied via a nested-path branch
        // in setupSettingsInputs(), so it's added explicitly.
        const stateKeys = new Set(Object.values(this.syncManager?.getAllMappings() || {}));
        stateKeys.add('logger.colors');

        this.originalValues = {};
        stateKeys.forEach(stateKey => {
            this.originalValues[stateKey] = this.levelEditor.stateManager.get(stateKey);
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

        // Re-apply CSS-driven settings (colors, font scale, spacing, etc.) and view/toolbar/menu
        // toggle states now that StateManager reflects the reverted values
        if (this.syncManager) {
            this.syncManager.applySpecialUISettings();
            this.syncManager.forceUpdateAllViewOptions();
        }

        // Trigger re-render to apply restored grid/canvas settings
        if (window.editor?.canvasRenderer?.clearGridCaches) {
            window.editor.canvasRenderer.clearGridCaches();
        }
        if (window.editor?.render) {
            window.editor.render();
        }

        Logger.ui.debug('Restored original settings values');
    }

    cancelSettings() {
        // In auto-apply mode every change is already live and there's nothing to revert;
        // reverting here would surprise the user by undoing changes they saw take effect.
        if (!this.autoApply) {
            this.restoreOriginalValues();
        }

        this.hide();
    }
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        Logger.ui.debug('Destroying SettingsPanel');

        ResetRegistry.clear('settingsPanel');

        // Remove all event listeners
        this.eventListeners.forEach(({ target, event, handler }) => {
            try {
                target.removeEventListener(event, handler);
            } catch (error) {
                Logger.ui.warn('Failed to remove event listener:', error);
            }
        });
        this.eventListeners = [];
        
        // Remove all event handlers using new system
        const settingsOverlay = document.getElementById('settings-overlay');
        const settingsContainer = document.getElementById('settings-panel-container');
        
        if (settingsOverlay) {
            eventHandlerManager.unregisterContainer(settingsOverlay);
        }
        if (settingsContainer) {
            eventHandlerManager.unregisterContainer(settingsContainer);
        }
        
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
        const destroyOverlay = document.getElementById('settings-overlay');
        if (destroyOverlay && destroyOverlay.parentNode) {
            destroyOverlay.parentNode.removeChild(destroyOverlay);
        }
        
        // Clear references
        this.container = null;
        this.configManager = null;
        this.levelEditor = null;
        
        Logger.ui.debug('SettingsPanel destroyed');
    }
}
