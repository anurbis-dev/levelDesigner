/**
 * Shared menu-item icon markup, used by both the nav-bar dropdown system (MenuManager.js)
 * and the floating context-menu system (BaseContextMenu.js) so the two can't visually
 * drift apart again — edit this once, both menu systems pick it up.
 */

const MENU_ITEM_ICON_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;margin-right:8px;';

/**
 * @param {string} [icon] - Icon HTML (SVG or emoji string)
 * @returns {string} - Wrapped icon span markup, or '' if no icon
 */
export function renderMenuItemIconHtml(icon) {
    return icon
        ? `<span class="menu-item-icon" style="${MENU_ITEM_ICON_STYLE}">${icon}</span>`
        : '';
}
