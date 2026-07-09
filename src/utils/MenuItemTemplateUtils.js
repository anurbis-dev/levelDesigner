/**
 * Shared menu-item row markup, used by both the nav-bar dropdown system (MenuManager.js)
 * and the floating context-menu system (BaseContextMenu.js) so the two can't visually
 * drift apart again — edit this once, both menu systems pick it up.
 *
 * Every command row (in either system, at any submenu depth) follows the same three-slot
 * layout: [leading block: icon or checkbox, same fixed box] | [label text] | [trailing:
 * shortcut label or submenu arrow].
 */

const MENU_ITEM_LEADING_STYLE = 'display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;flex-shrink:0;margin-right:8px;';
const MENU_ITEM_TRAILING_STYLE = 'font-size:0.75rem;margin-left:1rem;flex-shrink:0;color:var(--ui-text-color, #9ca3af);';

/**
 * Unified leading block: renders either an icon or a toggle checkbox indicator inside the
 * same fixed-size box, so icon rows and checkbox rows line up identically.
 * @param {Object} [opts]
 * @param {string} [opts.icon] - Icon HTML (SVG or emoji string)
 * @param {string} [opts.checkboxId] - If set, renders a checkbox indicator with this id instead of `icon`
 * @param {boolean} [opts.checked] - Initial checkbox checked state
 * @returns {string} Leading block markup, or '' if neither icon nor checkboxId given
 */
export function renderMenuItemLeadingHtml({ icon, checkboxId, checked = false } = {}) {
    let inner;
    if (checkboxId) {
        inner = `<span class="w-4 h-4 border border-gray-500 flex items-center justify-center">
            <span class="w-2 h-2 bg-gray-500${checked ? '' : ' hidden'}" id="${checkboxId}"></span>
        </span>`;
    } else if (icon) {
        inner = icon;
    } else {
        return '';
    }
    return `<span class="menu-item-leading" style="${MENU_ITEM_LEADING_STYLE}">${inner}</span>`;
}

/**
 * Wraps the leading block + label text as a single flex item, so a trailing block
 * (shortcut/arrow) placed alongside it via `justify-between` pins to the far edge instead
 * of splitting evenly across all inner nodes (leading span + label text would otherwise
 * count as separate flex children next to the trailing block).
 * @param {Object} opts
 * @param {string} [opts.leadingHtml] - Output of renderMenuItemLeadingHtml()
 * @param {string} opts.label - Row label text
 * @returns {string}
 */
export function renderMenuItemBodyHtml({ leadingHtml = '', label }) {
    return `<span class="flex items-center">${leadingHtml}${label}</span>`;
}

/**
 * Unified trailing block: keyboard shortcut label or submenu flyout arrow.
 * @param {string} text - Shortcut label or '▸' arrow glyph
 * @param {Object} [opts]
 * @param {string} [opts.shortcutKey] - dot-path shortcut config key, kept as a data attribute
 *   so MenuManager.refreshShortcutLabels() can re-resolve it live after a rebind
 * @returns {string} Trailing block markup, or '' if no text
 */
export function renderMenuItemTrailingHtml(text, { shortcutKey } = {}) {
    if (!text) return '';
    const dataAttr = shortcutKey ? ` data-shortcut-key="${shortcutKey}"` : '';
    return `<span class="menu-item-trailing"${dataAttr} style="${MENU_ITEM_TRAILING_STYLE}">${text}</span>`;
}
