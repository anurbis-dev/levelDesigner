/**
 * Viewport leaf header dropdown menus: camera source, type filter, VP-EYE display flags.
 * Split out of ViewportLeafChrome.js (400-line guardrail) — shared hover/close state
 * lives in ViewportLeafChromeState.js so this file has no dependency on
 * ViewportLeafChrome.js (avoids a circular import between the two).
 */
import { MenuPositioningUtils } from '../../utils/MenuPositioningUtils.js';
import { buildTypeIconSvg } from '../../constants/AssetTypeIcons.js';
import { openTypeFilterMenu } from '../../utils/TypeFilterMenu.js';
import {
    WORK_CAM_COLOR,
    DISPLAY_MENU_ITEMS,
    closeChromeMenu,
    registerChromeMenu,
    syncViewportChromeState
} from './ViewportLeafChromeState.js';

/**
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 * @param {HTMLElement} [chromeRoot]
 */
export function openCameraSourceMenu(anchor, leafId, levelEditor, chromeRoot) {
    const vvm = levelEditor.viewportViewManager;
    if (!vvm) return;
    const view = vvm.getView(leafId);
    if (!view) return;

    const menu = MenuPositioningUtils.createMenuElement({ className: 'p-2 viewport-cam-menu' });
    // Right edge under cam button; reposition after fill so guessed menuWidth doesn't
    // shift the whole menu far left of the icon.
    const posOpts = {
        alignment: 'right',
        direction: 'below',
        menuWidth: 220,
        menuHeight: 240
    };
    MenuPositioningUtils.showMenu(menu, anchor, posOpts);
    registerChromeMenu(menu, chromeRoot || anchor.closest('.viewport-leaf-chrome'), 'cam');

    const addItem = (label, checked, onClick, iconOpts = null) => {
        const item = MenuPositioningUtils.createMenuItem({ text: label, checked });
        if (iconOpts?.iconHtml) {
            const icon = document.createElement('span');
            icon.className = 'viewport-cam-menu-icon';
            icon.innerHTML = iconOpts.iconHtml;
            icon.style.cssText = 'display:inline-flex;margin-right:6px;vertical-align:middle;';
            item.insertBefore(icon, item.firstChild);
        }
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
            closeChromeMenu(false);
            levelEditor.render?.();
            const chrome = anchor.closest('.viewport-leaf-chrome');
            if (chrome) syncViewportChromeState(chrome, leafId, levelEditor);
        });
        menu.appendChild(item);
    };

    addItem(
        'Work camera',
        view.source?.kind !== 'game',
        () => vvm.setSource(leafId, { kind: 'work' }),
        { iconHtml: buildTypeIconSvg('camera', WORK_CAM_COLOR, 14) }
    );

    const sep = document.createElement('div');
    sep.className = 'border-t border-gray-600 my-1';
    menu.appendChild(sep);

    const cameras = vvm.listGameCameraObjects();
    if (cameras.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-gray-400 px-2 py-1';
        empty.textContent = 'No Camera objects in level';
        menu.appendChild(empty);
    } else {
        cameras.forEach((cam) => {
            const name = cam.name || cam.id;
            const color = cam.color || WORK_CAM_COLOR;
            addItem(
                name,
                view.source?.kind === 'game' && view.source.objectId === cam.id,
                () => vvm.setSource(leafId, { kind: 'game', objectId: cam.id }),
                { iconHtml: buildTypeIconSvg('camera', color, 14) }
            );
        });
    }

    MenuPositioningUtils.repositionMenu(menu, anchor, posOpts);
}

/**
 * Type filter for one viewport view — shared TypeFilterMenu (no Ctrl).
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 * @param {HTMLElement} [chromeRoot]
 */
export function openViewportTypeFilterMenu(anchor, leafId, levelEditor, chromeRoot) {
    const vvm = levelEditor.viewportViewManager;
    if (!vvm) return;
    const view = vvm.getView(leafId);
    if (!view) return;

    const level = levelEditor.getLevel?.() || levelEditor.level;
    const allObjects = level?.getAllObjects?.() || level?.objects || [];
    const availableTypes = MenuPositioningUtils.getObjectTypes
        ? MenuPositioningUtils.getObjectTypes(allObjects)
        : new Set(allObjects.map((o) => o.type).filter(Boolean));

    const menu = openTypeFilterMenu({
        anchor,
        types: availableTypes,
        filters: view.typeFilters,
        onChange: (filters) => {
            vvm.setTypeFilters(leafId, filters);
            const chrome = anchor.closest('.viewport-leaf-chrome');
            if (chrome) syncViewportChromeState(chrome, leafId, levelEditor);
            levelEditor.render?.();
        },
        position: { alignment: 'right', menuWidth: 192, menuHeight: 220 }
    });
    if (menu) {
        registerChromeMenu(menu, chromeRoot || anchor.closest('.viewport-leaf-chrome'), 'filter');
    }
}

/**
 * VP-EYE: per-view display-flag menu (grid / boundaries / collisions / parallax).
 * Mirrors TypeFilterMenu UX — each click toggles and applies immediately, menu stays open.
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 * @param {HTMLElement} [chromeRoot]
 */
export function openViewportDisplayMenu(anchor, leafId, levelEditor, chromeRoot) {
    const vvm = levelEditor.viewportViewManager;
    if (!vvm) return;
    const view = vvm.getView(leafId);
    if (!view) return;

    const menu = MenuPositioningUtils.createMenuElement({ className: 'p-2 viewport-eye-menu' });
    const posOpts = { alignment: 'right', direction: 'below', menuWidth: 180, menuHeight: 160 };
    MenuPositioningUtils.showMenu(menu, anchor, posOpts);
    registerChromeMenu(menu, chromeRoot || anchor.closest('.viewport-leaf-chrome'), 'eye');

    const refreshChecks = () => {
        menu.querySelectorAll('[data-display-key]').forEach((row) => {
            const key = row.dataset.displayKey;
            const input = row.querySelector('input');
            if (input) input.checked = vvm.getDisplayFlag(view, key);
        });
    };

    DISPLAY_MENU_ITEMS.forEach(({ key, label }) => {
        const item = MenuPositioningUtils.createMenuItem({
            text: label,
            checked: vvm.getDisplayFlag(view, key)
        });
        item.dataset.displayKey = key;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            vvm.toggleDisplayFlag(view, key);
            refreshChecks();
            const chrome = anchor.closest('.viewport-leaf-chrome');
            if (chrome) syncViewportChromeState(chrome, leafId, levelEditor);
        });
        menu.appendChild(item);
    });

    MenuPositioningUtils.repositionMenu(menu, anchor, posOpts);
}
