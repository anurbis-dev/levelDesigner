/**
 * Settings Panel Refactored Example
 * 
 * Demonstrates how to use SettingsSectionConstructor to eliminate code duplication
 * and create cleaner, more maintainable settings sections.
 * 
 * @author Level Designer
 * @version 3.52.1
 */

import { 
    createSettingsSection, 
    createSettingsFormGroup, 
    createSettingsGrid, 
    createSettingsLabel, 
    createSettingsInput, 
    createSettingsCheckbox, 
    createSettingsColorInput, 
    createSettingsRange, 
    createSettingsContainer 
} from './SettingsSectionConstructor.js';

/**
 * Example of how to refactor the General Settings section
 * @param {Object} settings - Current settings object
 * @returns {string} - HTML string for the section
 */
export function renderGeneralSettingsRefactored(settings) {
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
 * Example of how to refactor the UI Colors section
 * @param {Object} colors - Current colors object
 * @returns {string} - HTML string for the section
 */
export function renderUIColorsRefactored(colors) {
    const colorInputs = createSettingsGrid(`
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

    return `
        <h3>UI Colors</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('UI Colors', colorInputs)}
        `)}
    `;
}

/**
 * Example of how to refactor the Touch Settings section
 * @param {Object} settings - Current settings object
 * @returns {string} - HTML string for the section
 */
export function renderTouchSettingsRefactored(settings) {
    const touchContent = createSettingsFormGroup(`
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
    `);

    return `
        <h3>Touch Settings</h3>
        
        ${createSettingsContainer(`
            ${createSettingsSection('Touch Configuration', touchContent)}
        `)}
    `;
}
