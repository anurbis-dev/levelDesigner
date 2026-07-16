/**
 * Viewport leaf header chrome: camera source picker + object-type display filter (B4.2).
 * Header icon dropdowns follow main-menu hover mode: after first open, hovering a sibling
 * icon switches menus; leave chrome+menu exits hover mode.
 */
import { MenuPositioningUtils } from '../../utils/MenuPositioningUtils.js';
import { buildTypeIconSvg } from '../../constants/AssetTypeIcons.js';
import { openTypeFilterMenu, hasActiveTypeFilters } from '../../utils/TypeFilterMenu.js';

const WORK_CAM_COLOR = '#9ca3af';

/** VP-EYE: per-view display-flag menu entries (ViewportViewManager.DISPLAY_FLAG_KEYS). */
const DISPLAY_MENU_ITEMS = [
    { key: 'showGrid', label: 'Grid' },
    { key: 'objectBoundaries', label: 'Boundaries' },
    { key: 'objectCollisions', label: 'Collisions' },
    { key: 'parallax', label: 'Parallax' }
];

/** @type {{ hover: boolean, root: HTMLElement|null, kind: string|null, menu: HTMLElement|null }} */
const chromeMenuState = {
    hover: false,
    root: null,
    kind: null,
    menu: null
};

let chromeHoverWatcherBound = false;

/**
 * @param {number} x
 * @param {number} y
 * @param {DOMRect} rect
 * @param {number} margin
 */
function isInsideRect(x, y, rect, margin) {
    return x >= rect.left - margin && x <= rect.right + margin
        && y >= rect.top - margin && y <= rect.bottom + margin;
}

function ensureChromeHoverWatcher() {
    if (chromeHoverWatcherBound) return;
    chromeHoverWatcherBound = true;
    document.addEventListener('mousemove', (e) => {
        if (!chromeMenuState.hover || !chromeMenuState.root) return;
        const margin = MenuPositioningUtils.getCursorMenuMargin();
        const overRoot = isInsideRect(e.clientX, e.clientY, chromeMenuState.root.getBoundingClientRect(), margin);
        const menu = chromeMenuState.menu;
        const overMenu = !!(menu?.isConnected
            && isInsideRect(e.clientX, e.clientY, menu.getBoundingClientRect(), margin));
        if (!overRoot && !overMenu) {
            closeChromeMenu(false);
        }
    });
}

/**
 * @param {boolean} [keepHover=false] - keep hover-switch mode (sibling icon switch)
 */
function closeChromeMenu(keepHover = false) {
    const menu = chromeMenuState.menu;
    if (menu?._closeMenuHandler) {
        try {
            menu._closeMenuHandler();
        } catch (_e) {
            if (menu.parentNode) menu.parentNode.removeChild(menu);
        }
    } else if (menu?.parentNode) {
        menu.parentNode.removeChild(menu);
    }
    chromeMenuState.menu = null;
    chromeMenuState.kind = null;
    if (!keepHover) {
        chromeMenuState.hover = false;
        chromeMenuState.root = null;
    }
}

/**
 * @param {HTMLElement} menu
 * @param {HTMLElement} root
 * @param {'cam'|'filter'} kind
 */
function registerChromeMenu(menu, root, kind) {
    chromeMenuState.menu = menu;
    chromeMenuState.root = root;
    chromeMenuState.kind = kind;
    chromeMenuState.hover = true;
    ensureChromeHoverWatcher();
    menu.addEventListener('menuclose', () => {
        if (chromeMenuState.menu === menu) {
            chromeMenuState.menu = null;
            chromeMenuState.kind = null;
            // hover stays until cursor leaves chrome (watcher) — same as MenuManager
        }
    }, { once: true });
}

/**
 * Build right-side header controls for a viewport dock leaf.
 * @param {object} node - dock leaf node
 * @param {object} levelEditor
 * @returns {HTMLElement}
 */
export function buildViewportHeaderControls(node, levelEditor) {
    const wrap = document.createElement('div');
    wrap.className = 'viewport-leaf-chrome';
    wrap.dataset.leafId = node.id;
    // Keep drag on leaf title strip only — chrome is not a drag/grab zone.
    wrap.addEventListener('pointerdown', (e) => e.stopPropagation());

    const camBtn = document.createElement('button');
    camBtn.type = 'button';
    camBtn.className = 'icon-btn viewport-cam-btn';
    camBtn.title = 'Camera source: work / game (Camera objects)';
    // Default icon so chrome is never blank before view registration (self-drop race).
    camBtn.innerHTML = buildTypeIconSvg('camera', WORK_CAM_COLOR, 14);
    camBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChromeKind(wrap, 'cam', camBtn, node.id, levelEditor);
    });
    camBtn.addEventListener('mouseenter', () => {
        if (!chromeMenuState.hover || chromeMenuState.root !== wrap) return;
        if (chromeMenuState.kind === 'cam' && chromeMenuState.menu) return;
        openChromeKind(wrap, 'cam', camBtn, node.id, levelEditor);
    });

    const filterBtn = document.createElement('button');
    filterBtn.type = 'button';
    filterBtn.className = 'icon-btn viewport-filter-btn';
    filterBtn.title = 'Object type filter (this viewport only)';
    filterBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
        <path d="M2 3h8l-3 3v3l-2 1V6L2 3z"/>
    </svg>`;
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChromeKind(wrap, 'filter', filterBtn, node.id, levelEditor);
    });
    filterBtn.addEventListener('mouseenter', () => {
        if (!chromeMenuState.hover || chromeMenuState.root !== wrap) return;
        if (chromeMenuState.kind === 'filter' && chromeMenuState.menu) return;
        openChromeKind(wrap, 'filter', filterBtn, node.id, levelEditor);
    });

    const eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = 'icon-btn viewport-eye-btn';
    eyeBtn.title = 'View: grid / boundaries / collisions / parallax (this viewport)';
    eyeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z"/>
        <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>
    </svg>`;
    eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChromeKind(wrap, 'eye', eyeBtn, node.id, levelEditor);
    });
    eyeBtn.addEventListener('mouseenter', () => {
        if (!chromeMenuState.hover || chromeMenuState.root !== wrap) return;
        if (chromeMenuState.kind === 'eye' && chromeMenuState.menu) return;
        openChromeKind(wrap, 'eye', eyeBtn, node.id, levelEditor);
    });

    wrap.appendChild(camBtn);
    wrap.appendChild(filterBtn);
    wrap.appendChild(eyeBtn);
    syncViewportChromeState(wrap, node.id, levelEditor);
    return wrap;
}

/**
 * Open cam or filter menu; closes previous chrome menu first (hover switch / re-click).
 * @param {HTMLElement} root
 * @param {'cam'|'filter'} kind
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 */
function openChromeKind(root, kind, anchor, leafId, levelEditor) {
    // Toggle: click same open icon closes (main menu style)
    if (chromeMenuState.kind === kind && chromeMenuState.menu && chromeMenuState.root === root) {
        closeChromeMenu(false);
        return;
    }
    closeChromeMenu(true);
    chromeMenuState.hover = true;
    chromeMenuState.root = root;

    if (kind === 'cam') {
        openCameraSourceMenu(anchor, leafId, levelEditor, root);
    } else if (kind === 'eye') {
        openViewportDisplayMenu(anchor, leafId, levelEditor, root);
    } else {
        openViewportTypeFilterMenu(anchor, leafId, levelEditor, root);
    }
}

/**
 * @param {HTMLElement} chrome
 * @param {string} leafId
 * @param {object} levelEditor
 */
export function syncViewportChromeState(chrome, leafId, levelEditor) {
    if (!chrome) return;
    const filterBtn = chrome.querySelector('.viewport-filter-btn');
    const camBtn = chrome.querySelector('.viewport-cam-btn');
    const vvm = levelEditor?.viewportViewManager;
    const view = vvm?.getView(leafId);

    // Always paint a work-cam icon if view not registered yet (mount order / self-drop).
    if (!view) {
        if (camBtn && !camBtn.querySelector('svg')) {
            camBtn.innerHTML = buildTypeIconSvg('camera', WORK_CAM_COLOR, 14);
            camBtn.title = 'Editor work camera (pan/zoom for this viewport)';
        }
        return;
    }

    if (filterBtn) {
        const filterOn = hasActiveTypeFilters(view.typeFilters);
        filterBtn.classList.toggle('viewport-chrome-active', filterOn);
        filterBtn.classList.toggle('viewport-filter-active', filterOn);
        filterBtn.title = filterOn
            ? 'Type filter active (this viewport)'
            : 'Object type filter (this viewport only)';
    }
    const eyeBtn = chrome.querySelector('.viewport-eye-btn');
    if (eyeBtn) {
        const hasOverride = DISPLAY_MENU_ITEMS.some(({ key }) => {
            const v = view.displayOptions?.[key];
            return v === true || v === false;
        });
        eyeBtn.classList.toggle('viewport-chrome-active', hasOverride);
        eyeBtn.title = hasOverride
            ? 'View overrides active (this viewport)'
            : 'View: grid / boundaries / collisions / parallax (this viewport)';
    }
    if (camBtn) {
        const isGame = view.source?.kind === 'game';
        camBtn.classList.toggle('viewport-chrome-active', isGame);
        let stroke = WORK_CAM_COLOR;
        let title = 'Editor work camera (pan/zoom for this viewport)';
        if (isGame) {
            const camObj = (vvm.listGameCameraObjects() || [])
                .find((c) => c.id === view.source.objectId);
            stroke = camObj?.color || WORK_CAM_COLOR;
            const name = camObj?.name || view.source.objectId;
            title = `Game camera: ${name}`;
        }
        camBtn.innerHTML = buildTypeIconSvg('camera', stroke, 14);
        camBtn.title = title;
        camBtn.style.color = stroke;
    }
}

/**
 * Re-sync every viewport leaf chrome in the DOM (camera color/name, filter active).
 * Call when camera object props change without re-opening the source menu (VP-COL).
 * @param {object} levelEditor
 */
export function refreshAllViewportChrome(levelEditor) {
    if (!levelEditor) return;
    document.querySelectorAll('.viewport-leaf-chrome[data-leaf-id]').forEach((chrome) => {
        const leafId = chrome.dataset.leafId;
        if (leafId) syncViewportChromeState(chrome, leafId, levelEditor);
    });
}

/**
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 * @param {HTMLElement} [chromeRoot]
 */
function openCameraSourceMenu(anchor, leafId, levelEditor, chromeRoot) {
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
function openViewportTypeFilterMenu(anchor, leafId, levelEditor, chromeRoot) {
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
function openViewportDisplayMenu(anchor, leafId, levelEditor, chromeRoot) {
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
