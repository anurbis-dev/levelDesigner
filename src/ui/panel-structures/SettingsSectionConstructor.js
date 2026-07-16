/**
 * Settings Section Constructor
 * 
 * Utility for creating consistent settings sections with proper spacing and styling.
 * Eliminates code duplication in SettingsPanel by providing reusable section templates.
 * 
 * @author Level Designer
 * @version 3.52.1
 */

import { ColorUtils } from '../../utils/ColorUtils.js';
import { NumericInput } from '../../utils/NumericInput.js';

/**
 * Create a settings section container with consistent styling
 * @param {string} title - Section title
 * @param {string} content - Section content HTML
 * @param {Object} options - Additional options
 * @returns {string} - HTML string for the section
 */
export function createSettingsSection(title, content, options = {}) {
    const {
        border = true,
        padding = true,
        borderRadius = true,
        className = '',
        id = ''
    } = options;

    const borderStyle = border ? 'border: 1px solid #374151;' : '';
    const paddingStyle = padding ? 'padding: calc(1rem * max(var(--spacing-scale, 1.0), 0.5));' : '';
    const borderRadiusStyle = borderRadius ? 'border-radius: calc(0.5rem * max(var(--spacing-scale, 1.0), 0.5));' : '';
    // Always tagged as 'settings-section' so the header search (SettingsPanel.filterSettingsContent)
    // can find and hide/show whole sections that end up with zero matching rows.
    const classAttr = ` class="${['settings-section', className].filter(Boolean).join(' ')}"`;
    const idAttr = id ? ` id="${id}"` : '';

    return `
        <div${idAttr}${classAttr} style="${borderStyle} ${borderRadiusStyle} ${paddingStyle}">
            <h4 style="font-size: 1rem; font-weight: 500; color: var(--ui-text-color, #d1d5db); margin-bottom: calc(0.75rem * max(var(--spacing-scale, 1.0), 0.5));">${title}</h4>
            ${content}
        </div>
    `;
}

/**
 * Create a settings form group with consistent styling
 * @param {string} content - Form group content
 * @param {Object} options - Additional options
 * @returns {string} - HTML string for the form group
 */
export function createSettingsFormGroup(content, options = {}) {
    const {
        gap = '0.75rem',
        direction = 'column',
        className = ''
    } = options;

    const classAttr = className ? ` class="${className}"` : '';
    const gapValue = typeof gap === 'string' ? gap : `${gap}rem`;
    const gapStyle = `gap: calc(${gapValue} * max(var(--spacing-scale, 1.0), 0.5));`;

    return `
        <div${classAttr} style="display: flex; flex-direction: ${direction}; ${gapStyle}">
            ${content}
        </div>
    `;
}

/**
 * Create a settings grid layout
 * @param {string} content - Grid content
 * @param {Object} options - Grid options
 * @returns {string} - HTML string for the grid
 */
export function createSettingsGrid(content, options = {}) {
    const {
        columns = 2,
        gap = '1rem',
        className = 'settings-grid',
        width = '100%'
    } = options;

    const classAttr = className ? ` class="${className}"` : '';
    const gapValue = typeof gap === 'string' ? gap : `${gap}rem`;
    const gapStyle = `gap: calc(${gapValue} * max(var(--spacing-scale, 1.0), 0.5));`;
    const columnsStyle = `grid-template-columns: repeat(${columns}, 1fr);`;

    return `
        <div${classAttr} style="display: grid; ${columnsStyle} ${gapStyle}; width: ${width};">
            ${content}
        </div>
    `;
}

/**
 * Create a settings label with consistent styling
 * @param {string} text - Label text
 * @param {string} forId - ID of the associated input
 * @param {Object} options - Additional options
 * @returns {string} - HTML string for the label
 */
export function createSettingsLabel(text, forId = '', options = {}) {
    const {
        marginBottom = '0.5rem',
        fontSize = '0.875rem',
        fontWeight = '500',
        className = ''
    } = options;

    const forAttr = forId ? ` for="${forId}"` : '';
    const classAttr = className ? ` class="${className}"` : '';
    const marginValue = typeof marginBottom === 'string' ? marginBottom : `${marginBottom}rem`;
    const marginStyle = `margin-bottom: calc(${marginValue} * max(var(--spacing-scale, 1.0), 0.5));`;

    return `
        <label${forAttr}${classAttr} style="display: block; font-size: ${fontSize}; font-weight: ${fontWeight}; color: var(--ui-text-color, #d1d5db); ${marginStyle}">${text}</label>
    `;
}

/**
 * Create a settings input with consistent styling.
 * type: 'number' is coerced to scrub-style text (NumericInput) — never native spinners.
 * @param {Object} inputConfig - Input configuration
 * @returns {string} - HTML string for the input
 */
export function createSettingsInput(inputConfig) {
    const {
        type = 'text',
        id = '',
        name = '',
        value = '',
        placeholder = '',
        min = '',
        max = '',
        step = '',
        className = 'setting-input',
        style = '',
        dataSetting = '',
        readonly = false
    } = inputConfig;

    const defaultStyle = 'width: 100%; padding: calc(0.5rem * max(var(--spacing-scale, 1.0), 0.5)); background: #374151; border: 1px solid #4b5563; border-radius: calc(0.25rem * max(var(--spacing-scale, 1.0), 0.5)); color: white;';
    const combinedStyle = style ? `${defaultStyle} ${style}` : defaultStyle;

    // Numeric: always NumericInput scrub field (type=number banned)
    if (type === 'number') {
        return `<input ${NumericInput.htmlAttrs({
            id,
            name: name || id,
            value,
            min,
            max,
            step,
            className: `${className} ${NumericInput.NUM_CLASS}`.trim(),
            placeholder,
            dataSetting,
            style: combinedStyle,
            extra: readonly ? 'readonly' : ''
        })}>`;
    }

    const idAttr = id ? ` id="${id}"` : '';
    const nameAttr = name ? ` name="${name}"` : '';
    const valueAttr = value !== '' && value !== undefined && value !== null ? ` value="${value}"` : '';
    const placeholderAttr = placeholder ? ` placeholder="${placeholder}"` : '';
    const classAttr = className ? ` class="${className}"` : '';
    const dataSettingAttr = dataSetting ? ` data-setting="${dataSetting}"` : '';
    const readonlyAttr = readonly ? ' readonly' : '';

    return `
        <input type="${type}"${idAttr}${nameAttr}${valueAttr}${placeholderAttr}${classAttr}${dataSettingAttr}${readonlyAttr} style="${combinedStyle}">
    `;
}

/**
 * Create a checkbox with label
 * @param {Object} checkboxConfig - Checkbox configuration
 * @returns {string} - HTML string for the checkbox with label
 */
export function createSettingsCheckbox(checkboxConfig) {
    const {
        id = '',
        name = '',
        checked = false,
        label = '',
        dataSetting = '',
        marginRight = '0.5rem'
    } = checkboxConfig;

    const idAttr = id ? ` id="${id}"` : '';
    const nameAttr = name ? ` name="${name}"` : '';
    const checkedAttr = checked ? ' checked' : '';
    const dataSettingAttr = dataSetting ? ` data-setting="${dataSetting}"` : '';
    const marginValue = typeof marginRight === 'string' ? marginRight : `${marginRight}rem`;
    const marginStyle = `margin-right: calc(${marginValue} * max(var(--spacing-scale, 1.0), 0.5));`;

    return `
        <label style="display: flex; align-items: center;">
            <input type="checkbox"${idAttr}${nameAttr}${dataSettingAttr}${checkedAttr} class="setting-input" style="${marginStyle}">
            <span style="color: var(--ui-text-color, #d1d5db);">${label}</span>
        </label>
    `;
}

/**
 * Create a color input with label
 * @param {Object} colorConfig - Color input configuration
 * @returns {string} - HTML string for the color input
 */
export function createSettingsColorInput(colorConfig) {
    const {
        id = '',
        name = '',
        value = '#000000',
        label = '',
        dataSetting = '',
        width = '3rem',
        height = '1.5rem',
        inline = false
    } = colorConfig;

    const idAttr = id ? ` id="${id}"` : '';
    const nameAttr = name ? ` name="${name}"` : '';
    const valueAttr = value ? ` value="${ColorUtils.toHex(value)}"` : '';
    const dataSettingAttr = dataSetting ? ` data-setting="${dataSetting}"` : '';
    const inputStyle = `width: ${width}; height: ${height}; padding: 0; background: #374151; border: 1px solid #4b5563; border-radius: calc(0.25rem * max(var(--spacing-scale, 1.0), 0.5)); cursor: pointer; flex-shrink: 0;`;

    if (inline) {
        const barStyle = `flex: 1; height: ${height}; width: auto; min-width: 0; padding: 0; border: 1px solid #4b5563; border-radius: calc(0.25rem * max(var(--spacing-scale, 1.0), 0.5)); cursor: pointer;`;
        const controlHtml = `<input type="color"${idAttr}${nameAttr}${valueAttr}${dataSettingAttr} class="setting-input" style="${barStyle}">`;
        return createSettingsRow(label, id, controlHtml);
    }

    return `
        <div>
            ${createSettingsLabel(label, id)}
            <input type="color"${idAttr}${nameAttr}${valueAttr}${dataSettingAttr} class="setting-input" style="${inputStyle}">
        </div>
    `;
}

/**
 * Base block for a compact "label left, control right" settings row — label and control share
 * one line instead of label-above-control, so params take half the vertical space. Reused by
 * any settings control that wants this layout (see createSettingsColorInput's inline mode and
 * createSettingsRange below) — apply identically to future control types the same way.
 * @param {string} label - Label text
 * @param {string} forId - ID of the associated input (for the <label for>)
 * @param {string} controlHtml - HTML of the control, sized to fill remaining row width
 * @param {Object} options - Additional options
 * @returns {string} - HTML string for the row
 */
export function createSettingsRow(label, forId, controlHtml, options = {}) {
    const { labelWidth = '40%' } = options;
    const forAttr = forId ? ` for="${forId}"` : '';

    return `
        <div class="settings-row" style="display: flex; align-items: center; gap: 0.5rem; min-height: 1.5rem;">
            <label${forAttr} class="settings-row-label" style="color: var(--ui-text-color, #d1d5db); font-size: 0.875rem; font-weight: 500; flex: 0 0 ${labelWidth}; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}</label>
            ${controlHtml}
        </div>
    `;
}

/**
 * Create a range slider with label and value display, label kept in the same row as the
 * slider (see createSettingsRow) for UI compactness.
 * @param {Object} rangeConfig - Range slider configuration
 * @returns {string} - HTML string for the range slider
 */
export function createSettingsRange(rangeConfig) {
    const {
        id = '',
        name = '',
        value = 1.0,
        min = 0,
        max = 2,
        step = 0.1,
        label = '',
        dataSetting = '',
        unit = 'x'
    } = rangeConfig;

    const idAttr = id ? ` id="${id}"` : '';
    const nameAttr = name ? ` name="${name}"` : '';
    const valueAttr = value !== '' && value !== undefined && value !== null ? ` value="${value}"` : '';
    const minAttr = min !== '' && min !== undefined && min !== null ? ` min="${min}"` : '';
    const maxAttr = max !== '' && max !== undefined && max !== null ? ` max="${max}"` : '';
    const stepAttr = step ? ` step="${step}"` : '';
    const dataSettingAttr = dataSetting ? ` data-setting="${dataSetting}"` : '';
    const numValue = parseFloat(value);
    const displayValue = Number.isFinite(numValue) ? numValue.toFixed(1) : value;

    const controlHtml = `
        <div class="settings-range-wrapper">
            <input type="range"${idAttr}${nameAttr}${valueAttr}${minAttr}${maxAttr}${stepAttr}${dataSettingAttr} class="setting-input settings-range-input" data-unit="${unit}">
            <span class="settings-range-value">${displayValue}${unit}</span>
            <input ${NumericInput.htmlAttrs({
                min,
                max,
                step,
                className: 'settings-range-edit',
                tabindex: -1
            })}>
        </div>
    `;

    return createSettingsRow(label, id, controlHtml);
}

/**
 * Create a settings container with consistent styling
 * @param {string} content - Container content
 * @param {Object} options - Container options
 * @returns {string} - HTML string for the container
 */
export function createSettingsContainer(content, options = {}) {
    const {
        gap = '1rem',
        direction = 'column',
        width = '100%',
        className = 'settings-container'
    } = options;

    const classAttr = className ? ` class="${className}"` : '';
    const gapValue = typeof gap === 'string' ? gap : `${gap}rem`;
    const gapStyle = `gap: calc(${gapValue} * max(var(--spacing-scale, 1.0), 0.5));`;

    return `
        <div${classAttr} style="display: flex; flex-direction: ${direction}; ${gapStyle}; width: ${width};">
            ${content}
        </div>
    `;
}
