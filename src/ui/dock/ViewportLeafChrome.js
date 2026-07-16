/**
 * Viewport leaf header chrome: camera source picker + object-type display filter + VP-EYE
 * display-flag menu (B4.2). Header icon dropdowns follow main-menu hover mode: after first
 * open, hovering a sibling icon switches menus; leave chrome+menu exits hover mode.
 * Shared hover/close state: ViewportLeafChromeState.js. Menu bodies: ViewportLeafMenus.js
 * (split out to stay under the 400-line guardrail, see scripts/check-file-size.js).
 */
import { buildTypeIconSvg } from '../../constants/AssetTypeIcons.js';
import { WORK_CAM_COLOR, getChromeMenuState, closeChromeMenu, syncViewportChromeState } from './ViewportLeafChromeState.js';
import { openCameraSourceMenu, openViewportTypeFilterMenu, openViewportDisplayMenu } from './ViewportLeafMenus.js';

export { syncViewportChromeState };

/**
 * Build right-side header controls for a viewport dock leaf.
 * @param {object} node - dock leaf node
 * @param {object} levelEditor
 * @returns {HTMLElement}
 */
export function buildViewportHeaderControls(node, levelEditor) {
    const chromeMenuState = getChromeMenuState();
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
 * Open cam/filter/eye menu; closes previous chrome menu first (hover switch / re-click).
 * @param {HTMLElement} root
 * @param {'cam'|'filter'|'eye'} kind
 * @param {HTMLElement} anchor
 * @param {string} leafId
 * @param {object} levelEditor
 */
function openChromeKind(root, kind, anchor, leafId, levelEditor) {
    const chromeMenuState = getChromeMenuState();
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
