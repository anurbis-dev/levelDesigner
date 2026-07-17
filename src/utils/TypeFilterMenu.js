/**
 * Shared type-filter dropdown (viewport / outliner / assets).
 * No Ctrl multi-session: each click toggles, applies immediately, menu stays open.
 */
import { MenuPositioningUtils } from './MenuPositioningUtils.js';

/**
 * Whether a type is currently shown under the filter set.
 * empty set = all; 'DISABLE_ALL' = none; else membership.
 * @param {Set<string>} filters
 * @param {string} type
 * @returns {boolean}
 */
export function isTypeFilterActive(filters, type) {
    if (!filters || filters.size === 0) return true;
    if (filters.has('DISABLE_ALL')) return false;
    return filters.has(type);
}

/**
 * True when any non-all filter is engaged (for button highlight).
 * @param {Set<string>} filters
 * @returns {boolean}
 */
export function hasActiveTypeFilters(filters) {
    return !!(filters && filters.size > 0 && !filters.has('DISABLE_ALL'));
}

/**
 * Toggle All: empty ↔ DISABLE_ALL.
 * @param {Set<string>} filters
 * @returns {Set<string>}
 */
export function toggleAllTypeFilters(filters) {
    if (!filters || filters.size === 0) return new Set(['DISABLE_ALL']);
    return new Set();
}

/**
 * Toggle one type within the exclusive-set model used by outliner/assets/viewport.
 * @param {Set<string>} filters
 * @param {string} type
 * @param {Iterable<string>} allTypes
 * @returns {Set<string>}
 */
export function toggleTypeFilter(filters, type, allTypes) {
    const all = [...allTypes];
    let next = filters instanceof Set ? new Set(filters) : new Set(filters || []);

    if (next.has('DISABLE_ALL')) {
        next = new Set([type]);
    } else if (next.size === 0) {
        next = new Set(all.filter((t) => t !== type));
    } else if (next.has(type)) {
        next.delete(type);
        if (next.size === 0) next = new Set(['DISABLE_ALL']);
    } else {
        next.add(type);
        if (all.length > 0 && all.every((t) => next.has(t))) {
            next = new Set();
        }
    }
    return next;
}

/**
 * Open type-filter menu (viewport-style UX).
 * @param {object} opts
 * @param {HTMLElement} opts.anchor
 * @param {Iterable<string>|Set<string>} opts.types
 * @param {Set<string>} opts.filters - current filter set (copied)
 * @param {(filters: Set<string>) => void} opts.onChange - called after each toggle
 * @param {{ menuWidth?: number, menuHeight?: number, className?: string }} [opts.position]
 * @returns {HTMLElement|null} menu element
 */
export function openTypeFilterMenu(opts) {
    const {
        anchor,
        types,
        filters: initialFilters,
        onChange,
        position = {}
    } = opts || {};
    if (!anchor || typeof onChange !== 'function') return null;

    const allTypes = Array.from(types || []).filter(Boolean).sort();
    let filters = initialFilters instanceof Set
        ? new Set(initialFilters)
        : new Set(initialFilters || []);

    const menu = MenuPositioningUtils.createMenuElement({
        className: position.className || 'p-2'
    });
    MenuPositioningUtils.showMenu(menu, anchor, {
        alignment: position.alignment || 'right',
        direction: position.direction || 'below',
        menuWidth: position.menuWidth || 192,
        menuHeight: position.menuHeight || 220
    });

    const refreshChecks = () => {
        menu.querySelectorAll('[data-filter-type]').forEach((row) => {
            const type = row.dataset.filterType;
            const input = row.querySelector('input');
            if (!input) return;
            if (type === '__all__') {
                input.checked = filters.size === 0;
            } else {
                input.checked = isTypeFilterActive(filters, type);
            }
        });
    };

    const apply = (next) => {
        filters = next;
        onChange(new Set(filters));
        refreshChecks();
    };

    const allOption = MenuPositioningUtils.createMenuItem({
        text: 'Toggle All',
        checked: filters.size === 0
    });
    allOption.dataset.filterType = '__all__';
    allOption.addEventListener('click', (e) => {
        e.stopPropagation();
        apply(toggleAllTypeFilters(filters));
    });
    menu.appendChild(allOption);

    const sep = document.createElement('div');
    sep.className = 'border-t border-gray-600 my-1';
    menu.appendChild(sep);

    if (allTypes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-gray-400 px-2 py-1';
        empty.textContent = 'No types';
        menu.appendChild(empty);
    } else {
        allTypes.forEach((type) => {
            const option = MenuPositioningUtils.createMenuItem({
                text: type,
                checked: isTypeFilterActive(filters, type)
            });
            option.dataset.filterType = type;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                apply(toggleTypeFilter(filters, type, allTypes));
            });
            menu.appendChild(option);
        });
    }

    MenuPositioningUtils.repositionMenu(menu, anchor, {
        alignment: position.alignment || 'right',
        direction: position.direction || 'below',
        menuWidth: position.menuWidth || 192,
        menuHeight: position.menuHeight || 220
    });

    return menu;
}
