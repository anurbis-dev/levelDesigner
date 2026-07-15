/**
 * Shared HTML5 list-reorder placeholder for LayersPanel / LevelsPanel.
 * Shows an empty slot under the cursor while dragging a row; drop order is
 * derived from the placeholder index (not from whichever row was last under
 * the pointer). Does not fork panel templates — only DOM chrome during drag.
 */

export const LIST_REORDER_PLACEHOLDER_CLASS = 'list-reorder-placeholder';

/**
 * @param {HTMLElement} listEl
 */
export function clearListReorderPlaceholder(listEl) {
    if (!listEl) return;
    listEl.querySelectorAll(`.${LIST_REORDER_PLACEHOLDER_CLASS}`).forEach((el) => el.remove());
}

/**
 * Move/create the empty slot so it sits at the insertion index implied by clientY.
 * Dragged row stays in the list (dimmed by the panel); it is excluded from hit-testing
 * so the slot can land on either side of its original neighbors.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.listEl
 * @param {HTMLElement} opts.draggedEl
 * @param {number} opts.clientY
 * @param {(el: HTMLElement) => boolean} opts.isItem
 * @param {number} [opts.slotHeight] - pre-collapse row height (dragged row may already be 0)
 */
export function syncListReorderPlaceholder({ listEl, draggedEl, clientY, isItem, slotHeight = 0 }) {
    if (!listEl || !draggedEl || typeof clientY !== 'number') return;

    let placeholder = listEl.querySelector(`.${LIST_REORDER_PLACEHOLDER_CLASS}`);
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = LIST_REORDER_PLACEHOLDER_CLASS;
        placeholder.setAttribute('aria-hidden', 'true');
        const h = slotHeight > 0 ? slotHeight : draggedEl.offsetHeight;
        if (h > 0) {
            placeholder.style.height = `${h}px`;
        }
        listEl.appendChild(placeholder);
    }

    const items = Array.from(listEl.children).filter(
        (el) => el !== placeholder && el !== draggedEl && isItem(el)
    );

    let insertBefore = null;
    for (const item of items) {
        const rect = item.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (clientY < midY) {
            insertBefore = item;
            break;
        }
    }

    if (insertBefore) {
        if (placeholder.nextSibling !== insertBefore) {
            listEl.insertBefore(placeholder, insertBefore);
        }
    } else if (listEl.lastElementChild !== placeholder) {
        listEl.appendChild(placeholder);
    }
}

/**
 * Build the new id order from list children: placeholder position = draggedId,
 * original dragged row (still in DOM) is skipped.
 *
 * @param {HTMLElement} listEl
 * @param {string} idDatasetKey - dataset key, e.g. 'layerId' / 'levelId'
 * @param {string} draggedId
 * @param {(el: HTMLElement) => boolean} isItem
 * @returns {string[]|null} null if placeholder missing or order incomplete
 */
export function getListOrderAfterReorder(listEl, idDatasetKey, draggedId, isItem) {
    if (!listEl || !draggedId) return null;

    const placeholder = listEl.querySelector(`.${LIST_REORDER_PLACEHOLDER_CLASS}`);
    if (!placeholder) return null;

    const order = [];
    for (const el of listEl.children) {
        if (el === placeholder) {
            order.push(draggedId);
            continue;
        }
        if (!isItem(el)) continue;
        const id = el.dataset[idDatasetKey];
        if (!id || id === draggedId) continue;
        order.push(id);
    }

    return order.length > 0 ? order : null;
}
