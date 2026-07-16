/**
 * Shared state + DOM-sync for viewport leaf header chrome (B4.2/VP-EYE).
 * Split out of ViewportLeafChrome.js (400-line guardrail) — has zero dependency on
 * ViewportLeafChrome.js/ViewportLeafMenus.js so both can import from here without
 * a circular import (madge --circular src gate in `npm run check`).
 */
import { MenuPositioningUtils } from '../../utils/MenuPositioningUtils.js';
import { buildTypeIconSvg } from '../../constants/AssetTypeIcons.js';
import { hasActiveTypeFilters } from '../../utils/TypeFilterMenu.js';

export const WORK_CAM_COLOR = '#9ca3af';

/** VP-EYE: per-view display-flag menu entries (ViewportViewManager.DISPLAY_FLAG_KEYS). */
export const DISPLAY_MENU_ITEMS = [
    { key: 'showGrid', label: 'Grid' },
    { key: 'objectBoundaries', label: 'Boundaries' },
    { key: 'objectCollisions', label: 'Collisions' },
    { key: 'parallax', label: 'Parallax' },
    { key: 'infoOverlay', label: 'Info' }
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
export function closeChromeMenu(keepHover = false) {
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

/** @returns {{ hover: boolean, root: HTMLElement|null, kind: string|null, menu: HTMLElement|null }} */
export function getChromeMenuState() {
    return chromeMenuState;
}

/**
 * @param {HTMLElement} menu
 * @param {HTMLElement} root
 * @param {'cam'|'filter'|'eye'} kind
 */
export function registerChromeMenu(menu, root, kind) {
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
