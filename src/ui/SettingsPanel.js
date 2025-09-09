import { ColorChooser } from '../widgets/ColorChooser.js';

/**
 * Settings Panel UI Component
 */
export class SettingsPanel {
    constructor(container, configManager) {
        this.container = container;
        this.configManager = configManager;
        this.isVisible = false;
        
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
            <div style="
                position: relative;
                background-color: #1f2937;
                border-radius: 0.5rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                max-width: 64rem;
                width: 100%;
                margin: 1rem auto;
                height: calc(100vh - 2rem);
                color: white;
                display: flex;
                flex-direction: column;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem 1rem;
                    border-bottom: 1px solid #374151;
                    flex: 0 0 auto;
                    min-height: 3rem;
                ">
                    <h2 style="font-size: 1.125rem; font-weight: 600; margin: 0;">Settings</h2>
                    <button id="close-settings" style="
                        color: #9ca3af;
                        background: none;
                        border: none;
                        cursor: pointer;
                        padding: 0.25rem;
                        font-size: 1.25rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        width: 2rem;
                        height: 2rem;
                    ">✕</button>
                </div>
                
                <div style="display: flex; flex: 1 1 auto; overflow: hidden; position: relative;">
                    <!-- Settings Categories -->
                    <div style="
                        width: 25%;
                        min-width: 200px;
                        background-color: #111827;
                        padding: 1rem;
                        overflow-y: auto;
                        flex: 0 0 auto;
                        height: 100%;
                    ">
                        <nav style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <button class="settings-tab active" data-tab="general" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: #374151; border: none; cursor: pointer;">General</button>
                            <button class="settings-tab" data-tab="grid" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Grid & Snapping</button>
                            <button class="settings-tab" data-tab="camera" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Camera</button>
                            <button class="settings-tab" data-tab="selection" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Selection</button>
                            <button class="settings-tab" data-tab="assets" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Assets</button>
                            <button class="settings-tab" data-tab="shortcuts" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Shortcuts</button>
                            <button class="settings-tab" data-tab="performance" style="width: 100%; text-align: left; padding: 0.75rem; border-radius: 0.25rem; color: #d1d5db; background: transparent; border: none; cursor: pointer;">Performance</button>
                        </nav>
                    </div>
                    
                    <!-- Settings Content -->
                    <div style="
                        flex: 1 1 auto;
                        padding: 1rem;
                        overflow-y: auto;
                        height: 100%;
                        padding-bottom: 4rem;
                    ">
                        <div id="settings-content">
                            <!-- Content will be dynamically generated -->
                        </div>
                    </div>
                </div>
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.75rem 1rem;
                    border-top: 1px solid #374151;
                    position: fixed;
                    bottom: 1rem;
                    left: 1rem;
                    right: 1rem;
                    max-width: calc(64rem - 2rem);
                    margin: 0 auto;
                    background-color: #1f2937;
                    z-index: 10;
                    border-radius: 0 0 0.5rem 0.5rem;
                    box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
                ">
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button id="reset-settings" style="padding: 0.4rem 0.75rem; background-color: #dc2626; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">Reset to Defaults</button>
                        <button id="export-settings" style="padding: 0.4rem 0.75rem; background-color: #2563eb; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">Export Settings</button>
                        <button id="import-settings" style="padding: 0.4rem 0.75rem; background-color: #059669; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">Import Settings</button>
                        <input type="file" id="import-file" name="import-file" accept=".json" style="display: none;">
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="cancel-settings" style="padding: 0.4rem 0.75rem; background-color: #4b5563; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">Cancel</button>
                        <button id="save-settings" style="padding: 0.4rem 0.75rem; background-color: #2563eb; color: white; border: none; border-radius: 0.25rem; cursor: pointer; font-size: 0.875rem;">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    setupEventListeners() {
        // Close settings
        document.getElementById('close-settings').addEventListener('click', () => this.hide());
        document.getElementById('cancel-settings').addEventListener('click', () => this.hide());
        document.getElementById('settings-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'settings-overlay') {
                this.hide();
            }
        });

        // Settings tabs
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.settings-tab').forEach(t => {
                    t.classList.remove('active');
                    t.style.backgroundColor = 'transparent';
                });
                tab.classList.add('active');
                tab.style.backgroundColor = '#374151';
                this.renderSettingsContent(tab.dataset.tab);
            });
        });

        // Settings actions
        document.getElementById('reset-settings').addEventListener('click', () => this.resetSettings());
        document.getElementById('export-settings').addEventListener('click', () => this.exportSettings());
        document.getElementById('import-settings').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => this.importSettings(e));
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    }

    show() {
        this.isVisible = true;
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            this.renderSettingsContent('general');
        }
    }

    hide() {
        this.isVisible = false;
        const overlay = document.getElementById('settings-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    renderSettingsContent(category) {
        const content = document.getElementById('settings-content');
        if (!content) return;
        
        switch (category) {
            case 'general':
                content.innerHTML = this.renderGeneralSettings();
                break;
            case 'grid':
                content.innerHTML = this.renderGridSettings();
                break;
            case 'camera':
                content.innerHTML = this.renderCameraSettings();
                break;
            case 'selection':
                content.innerHTML = `
                    <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">Selection Settings</h3>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
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
    }

    renderGeneralSettings() {
        const settings = this.configManager.getAllSettings();
        
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
            </div>
        `;
    }

    renderGridSettings() {
        const settings = this.configManager.getAllSettings();
        return `
            <h3 style="font-size: 1.125rem; font-weight: 500; margin-bottom: 1rem;">Grid & Snapping Settings</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="grid.showGrid" ${settings.grid.showGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Show Grid</span>
                    </label>
                </div>
                <div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" class="setting-input" name="setting-input" data-setting="grid.snapToGrid" ${settings.grid.snapToGrid ? 'checked' : ''} style="margin-right: 0.5rem;">
                        <span style="color: #d1d5db;">Snap to Grid</span>
                    </label>
                </div>
                <div>
                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Size (px)</label>
                    <input type="number" min="1" max="256" class="setting-input" name="setting-input" data-setting="grid.size" value="${settings.grid.size}" style="width:100%; padding:0.5rem; background:#374151; border:1px solid #4b5563; border-radius:0.25rem; color:white;"/>
                </div>
                <div>
                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Color</label>
                    <input type="color" class="setting-input" name="setting-input" data-setting="grid.color" value="${settings.grid.color}"/>
                </div>
                <div>
                    <label style="display:block; font-size:0.875rem; color:#d1d5db; margin-bottom:0.5rem;">Grid Opacity</label>
                    <input type="range" min="0" max="1" step="0.05" class="setting-input" name="setting-input" data-setting="grid.opacity" value="${settings.grid.opacity}" style="width:100%;"/>
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
            input.addEventListener('change', (e) => {
                const path = e.target.dataset.setting;
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
                
                this.configManager.set(path, value);
            });
        });
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            this.configManager.reset();
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
        this.configManager.saveSettings();
        // Apply UI font scale globally
        const scale = this.configManager.get('ui.fontScale') || 1.0;
        document.documentElement.style.fontSize = `${scale * 16}px`;
        this.hide();
    }
}