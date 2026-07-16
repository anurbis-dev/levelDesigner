/**
 * Per-viewport DOM info overlay (VP-OVL): non-interactive HUD blocks over the canvas.
 * Blocks: camera source, zoom, active display flags, level/selection stats.
 * Hosted on view.measureEl (sibling of canvas-container). Toggle via eye menu → Info.
 */
import { WORK_CAM_COLOR } from './ViewportLeafChromeState.js';

/** @type {ReadonlyArray<{ key: string, label: string, short: string }>} */
const FLAG_BADGES = [
    { key: 'parallax', label: 'Parallax', short: 'P' },
    { key: 'objectBoundaries', label: 'Boundaries', short: 'B' },
    { key: 'objectCollisions', label: 'Collisions', short: 'C' },
    { key: 'showGrid', label: 'Grid', short: 'G' }
];

/**
 * Ensure overlay DOM exists under the view measure host.
 * @param {object} view - ViewportView
 * @returns {HTMLElement|null}
 */
export function ensureViewportInfoOverlay(view) {
    if (!view?.measureEl) return null;
    let el = view._infoOverlay;
    if (el?.isConnected) return el;

    el = view.measureEl.querySelector(':scope > .viewport-info-overlay');
    if (!el) {
        el = document.createElement('div');
        el.className = 'viewport-info-overlay';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = [
            '<div class="viewport-info-block viewport-info-tl">',
            '  <div class="viewport-info-row" data-k="cam"></div>',
            '  <div class="viewport-info-row" data-k="zoom"></div>',
            '  <div class="viewport-info-flags" data-k="flags"></div>',
            '</div>',
            '<div class="viewport-info-block viewport-info-br">',
            '  <div class="viewport-info-row" data-k="level"></div>',
            '  <div class="viewport-info-row" data-k="stats"></div>',
            '</div>'
        ].join('');
        view.measureEl.appendChild(el);
    }
    el.dataset.viewportLeafId = view.leafId || '';
    view._infoOverlay = el;
    return el;
}

/**
 * Remove overlay DOM for a view.
 * @param {object} view
 */
export function removeViewportInfoOverlay(view) {
    const el = view?._infoOverlay
        || view?.measureEl?.querySelector?.(':scope > .viewport-info-overlay');
    if (el?.parentNode) el.parentNode.removeChild(el);
    if (view) view._infoOverlay = null;
}

/**
 * Refresh one view's overlay content from editor + view state.
 * @param {object} view
 * @param {object} editor
 */
export function updateViewportInfoOverlay(view, editor) {
    if (!view || !editor) return;
    const vvm = editor.viewportViewManager;
    const el = ensureViewportInfoOverlay(view);
    if (!el) return;

    const show = vvm ? vvm.getDisplayFlag(view, 'infoOverlay') : true;
    el.classList.toggle('viewport-info-overlay-hidden', !show);
    if (!show) return;

    const cam = resolveCamLabel(view, vvm, editor);
    setText(el.querySelector('[data-k="cam"]'), cam.text);
    const camRow = el.querySelector('[data-k="cam"]');
    if (camRow) camRow.style.color = cam.color || '';

    const pose = vvm?.resolveCamera?.(view) || editor.stateManager?.get('camera') || { zoom: 1 };
    const zoomPct = Math.round((pose.zoom || 1) * 100);
    setText(el.querySelector('[data-k="zoom"]'), `Zoom ${zoomPct}%`);

    updateFlags(el.querySelector('[data-k="flags"]'), view, vvm);

    const level = editor.getLevel?.() || editor.level;
    const levelName = level?.meta?.name || 'Level';
    setText(el.querySelector('[data-k="level"]'), levelName);

    const stats = editor.cachedLevelStats || level?.getStats?.() || null;
    const objCount = stats?.totalObjects
        ?? (level?.getAllObjects?.()?.length ?? level?.objects?.length ?? 0);
    const layerCount = level?.layers?.length ?? 0;
    const sel = editor.stateManager?.get('selectedObjects');
    const selCount = sel instanceof Set ? sel.size : (Array.isArray(sel) ? sel.length : 0);
    const statsParts = [`${objCount} obj`, `${layerCount} lyr`];
    if (selCount > 0) statsParts.push(`sel ${selCount}`);
    setText(el.querySelector('[data-k="stats"]'), statsParts.join(' · '));
}

/**
 * Refresh overlays for every registered viewport view.
 * @param {object} editor
 */
export function refreshAllViewportInfoOverlays(editor) {
    const views = editor?.viewportViewManager?.getViews?.();
    if (!views?.length) return;
    for (const view of views) {
        updateViewportInfoOverlay(view, editor);
    }
}

/**
 * @param {HTMLElement|null} node
 * @param {string} text
 */
function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
}

/**
 * @param {object} view
 * @param {object|null} vvm
 * @param {object} editor
 * @returns {{ text: string, color: string }}
 */
function resolveCamLabel(view, vvm, editor) {
    if (view?.source?.kind === 'game' && view.source.objectId) {
        const list = vvm?.listGameCameraObjects?.() || [];
        const camObj = list.find((c) => c.id === view.source.objectId)
            || editor.getCachedObject?.(view.source.objectId)
            || editor.level?.findObjectById?.(view.source.objectId);
        const name = camObj?.name || view.source.objectId;
        return {
            text: `Cam ${name}`,
            color: camObj?.color || WORK_CAM_COLOR
        };
    }
    return { text: 'Cam Work', color: WORK_CAM_COLOR };
}

/**
 * @param {HTMLElement|null} host
 * @param {object} view
 * @param {object|null} vvm
 */
function updateFlags(host, view, vvm) {
    if (!host) return;
    const on = FLAG_BADGES.filter(({ key }) => {
        if (!vvm) return false;
        // Grid is usually on — only badge when off would clutter; show all *active* flags.
        return vvm.getDisplayFlag(view, key) === true;
    });
    // Compact: only highlight non-default debug flags + parallax; always show G if grid on is noisy.
    // Show badges only for parallax / boundaries / collisions when ON; grid omitted (default chrome).
    const badges = on.filter(({ key }) => key !== 'showGrid');
    if (badges.length === 0) {
        if (host.textContent !== '') host.textContent = '';
        host.classList.add('viewport-info-flags-empty');
        return;
    }
    host.classList.remove('viewport-info-flags-empty');
    const next = badges.map(({ short }) => short).join(' ');
    if (host.dataset.flagKey === next) return;
    host.dataset.flagKey = next;
    host.innerHTML = '';
    for (const b of badges) {
        const span = document.createElement('span');
        span.className = `viewport-info-badge viewport-info-badge-${b.key}`;
        span.title = b.label;
        span.textContent = b.short;
        host.appendChild(span);
    }
}
