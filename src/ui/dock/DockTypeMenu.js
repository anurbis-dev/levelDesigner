/**
 * Floating content-type picker for dock leaf headers.
 */
import {
    LEVEL_TYPE_ORDER,
    ASSET_EDITOR_TYPES,
    TYPE_META,
    typeLabel,
    isAssetEditorType
} from './DockConstants.js';

let activeMenu = null;

export function closeTypeMenu() {
    if (!activeMenu) return;
    if (typeof activeMenu._cleanup === 'function') activeMenu._cleanup();
    activeMenu.remove();
    activeMenu = null;
}

/**
 * @param {HTMLElement} anchor
 * @param {string} currentType
 * @param {(type: string) => void} onSelect
 * @param {{ presentTypes?: Set<string>, isSingleton?: (type: string) => boolean }} [opts]
 */
export function openTypeMenu(anchor, currentType, onSelect, opts = {}) {
    closeTypeMenu();
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'type-menu';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    const present = opts.presentTypes || null;
    const isSingleton = typeof opts.isSingleton === 'function'
        ? opts.isSingleton
        : (t) => t === 'viewport';

    // Asset-editor leaves only swap among asset* types; level leaves among level types.
    const typeOrder = isAssetEditorType(currentType) ? ASSET_EDITOR_TYPES : LEVEL_TYPE_ORDER;

    typeOrder.forEach((type) => {
        const meta = TYPE_META[type] || { label: type, color: '#333' };
        const item = document.createElement('div');
        item.className = 'item';
        if (type === currentType) item.classList.add('current');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = meta.color;
        item.appendChild(swatch);
        const label = document.createElement('span');
        let text = typeLabel(type);
        const alreadyOpen = present && present.has(type) && type !== currentType;
        const willSwap = alreadyOpen && isSingleton(type);
        if (type === currentType) text += ' ✓';
        else if (willSwap) text += ' ⇄';
        else if (alreadyOpen) text += ' +';
        label.textContent = text;
        item.appendChild(label);
        item.title = type === currentType
            ? 'Current type'
            : (willSwap ? 'Swap places' : (alreadyOpen ? 'Add another' : 'Set type'));
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTypeMenu();
            if (type !== currentType) onSelect(type);
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    const onOutside = (e) => {
        if (!menu.contains(e.target)) closeTypeMenu();
    };
    setTimeout(() => document.addEventListener('pointerdown', onOutside), 0);
    menu._cleanup = () => document.removeEventListener('pointerdown', onOutside);
    activeMenu = menu;
}
