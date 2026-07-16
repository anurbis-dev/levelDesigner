/**
 * Shared row template for LayersPanel/LevelsPanel list items — both panels render a
 * (color swatch) + name + object-count + visibility-eye (+ lock) (+ parallax) row.
 * `prefix` ('layer' | 'level') drives every class name/id/dataset key so the markup this
 * produces matches exactly what each panel's eventHandlerManager selectors and CSS already
 * expect. Optional slots (`color`, `lock`, `parallax`, `dirtyIndicator`) are omitted from the
 * DOM entirely when passed as `null` — Layers omits `dirtyIndicator`, Levels omits `parallax`.
 */

import { NumericInput } from '../../utils/NumericInput.js';

export const EYE_OPEN_PATH = '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>';
export const EYE_CLOSED_PATH = '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>';
export const LOCK_CLOSED_PATH = '<path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>';
export const LOCK_OPEN_PATH = '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z"/>';

/**
 * @param {'layer'|'level'} prefix
 * @param {Object} config
 * @param {string} config.id
 * @param {boolean} config.isCurrent
 * @param {boolean} config.effectivelyVisible
 * @param {boolean} config.draggable
 * @param {{display: string, value: string}} config.name
 * @param {number} config.objectsCount
 * @param {{soloed: boolean, title: string}} config.visibility
 * @param {{value: string, title?: string, shape: 'circle'|'square'}|null} [config.color]
 *        null omits the slot. `shape` is call-site presentation (not inferred from prefix):
 *        shared class `list-color-swatch--{shape}`; `${prefix}-color` stays for panel selectors/fill.
 * @param {{locked: boolean, title: string}|null} [config.lock] - null omits the slot
 * @param {{value: number, title: string}|null} [config.parallax] - null omits the slot
 * @param {boolean|null} [config.dirtyIndicator] - null omits the slot
 * @returns {HTMLElement}
 */
export function createListItemRow(prefix, config) {
    const {
        id, isCurrent, effectivelyVisible, draggable,
        name, objectsCount, visibility,
        color = null, lock = null, parallax = null, dirtyIndicator = null
    } = config;

    const row = document.createElement('div');
    row.className = `${prefix}-item flex items-center justify-between p-2 rounded border border-gray-600 cursor-pointer transition-colors ${
        isCurrent ? 'bg-blue-600' : 'bg-gray-700'
    }`;
    row.style.opacity = effectivelyVisible ? '' : '0.45';
    row.draggable = draggable;
    row.dataset[`${prefix}Id`] = id;

    const colorShape = color?.shape === 'square' ? 'square' : 'circle';
    const colorHtml = color ? `
                <div class="${prefix}-color list-color-swatch list-color-swatch--${colorShape} w-4 h-4 cursor-pointer border-2 border-gray-500"
                     data-${prefix}-id="${id}"
                     data-color="${color.value}"
                     title="${color.title || 'Click to change color'}"></div>` : '';

    const dirtyHtml = dirtyIndicator !== null ? `
                    <span class="${prefix}-dirty-indicator w-2 h-2 rounded-full flex-shrink-0 ${dirtyIndicator ? '' : 'invisible'}"
                          style="background-color: #fbbf24;" title="Unsaved changes"></span>` : '';

    const lockHtml = lock ? `
                <button class="${prefix}-lock-btn p-1 rounded w-8 h-8 flex items-center justify-center"
                        data-${prefix}-id="${id}"
                        title="${lock.title}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style="color: ${lock.locked ? '#ef4444' : 'var(--ui-text-color, #6b7280)'};">
                        ${lock.locked ? LOCK_CLOSED_PATH : LOCK_OPEN_PATH}
                    </svg>
                </button>` : '';

    const parallaxHtml = parallax ? `
                <input ${NumericInput.htmlAttrs({
                    id: `${prefix}-parallax-${id}`,
                    className: `${prefix}-parallax-input num-input bg-gray-600 border border-gray-500 text-xs rounded px-1 py-1 w-12 h-8 text-center focus:outline-none focus:border-blue-500`,
                    style: 'color: var(--ui-text-color, #d1d5db);',
                    value: parallax.value,
                    step: 0.1,
                    min: -10,
                    max: 10,
                    extra: `data-${prefix}-id="${id}" title="${parallax.title}"`
                })}>` : '';

    row.innerHTML = `
            <div class="flex items-center space-x-2 flex-1 min-w-0">${colorHtml}
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                    <span class="${prefix}-name-display flex-1 px-1 py-1 rounded min-w-0" style="color: var(--ui-text-color, #d1d5db);"
                          data-${prefix}-id="${id}">${name.display}</span>
                    <input type="text"
                           id="${prefix}-name-${id}"
                           name="${prefix}-name-${id}"
                           value="${name.value}"
                           class="${prefix}-name-input bg-transparent border-none flex-1 focus:outline-none focus:bg-gray-600 px-1 rounded min-w-0 hidden" style="color: var(--ui-text-color, #d1d5db);"
                           data-${prefix}-id="${id}">${dirtyHtml}
                </div>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <span class="${prefix}-objects-count text-sm px-2 py-1 rounded bg-gray-600 min-w-0" style="color: var(--ui-text-color, #9ca3af);"
                      data-${prefix}-id="${id}">${objectsCount > 0 ? objectsCount : ''}</span>
                <button class="${prefix}-visibility-btn p-1 rounded w-8 h-8 flex items-center justify-center"
                        data-${prefix}-id="${id}"
                        title="${visibility.title}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style="color: ${visibility.soloed ? '#fbbf24' : 'var(--ui-text-color, #d1d5db)'};">
                        ${effectivelyVisible ? EYE_OPEN_PATH : EYE_CLOSED_PATH}
                    </svg>
                </button>${lockHtml}${parallaxHtml}
            </div>
        `;

    return row;
}

/**
 * Refresh the slots common to every row without recreating it: opacity, current/default
 * background, visibility-button icon+title+color, and (when `config.lock` is passed)
 * lock-button icon+title+color. Panel-specific bits (color-swatch fill, name/count text)
 * stay in each panel's own update method.
 * @param {HTMLElement} rowElement
 * @param {'layer'|'level'} prefix
 * @param {Object} config
 * @param {boolean} config.effectivelyVisible
 * @param {boolean} config.isCurrent
 * @param {{soloed: boolean, title: string}} config.visibility
 * @param {{locked: boolean, title: string}|null} [config.lock]
 */
export function updateListItemVisuals(rowElement, prefix, config) {
    const { effectivelyVisible, isCurrent, visibility, lock = null } = config;

    rowElement.style.opacity = effectivelyVisible ? '' : '0.45';

    if (isCurrent) {
        rowElement.classList.remove('bg-gray-700');
        rowElement.classList.add('bg-blue-600');
    } else {
        rowElement.classList.remove('bg-blue-600');
        rowElement.classList.add('bg-gray-700');
    }

    const visibilityBtn = rowElement.querySelector(`.${prefix}-visibility-btn`);
    if (visibilityBtn) {
        visibilityBtn.title = visibility.title;
        const svg = visibilityBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('class', 'w-4 h-4');
            // Icon SHAPE reflects EFFECTIVE visibility, color reflects soloed — a distinct
            // state from visible/hidden, always amber regardless of shape (mirrors
            // LayersPanel's original per-row logic).
            svg.style.color = visibility.soloed ? '#fbbf24' : 'var(--ui-text-color, #d1d5db)';
            svg.innerHTML = effectivelyVisible ? EYE_OPEN_PATH : EYE_CLOSED_PATH;
        }
    }

    if (lock) {
        const lockBtn = rowElement.querySelector(`.${prefix}-lock-btn`);
        if (lockBtn) {
            lockBtn.title = lock.title;
            const svg = lockBtn.querySelector('svg');
            if (svg) {
                svg.setAttribute('class', 'w-4 h-4');
                svg.style.color = lock.locked ? '#ef4444' : 'var(--ui-text-color, #6b7280)';
                svg.innerHTML = lock.locked ? LOCK_CLOSED_PATH : LOCK_OPEN_PATH;
            }
        }
    }
}
