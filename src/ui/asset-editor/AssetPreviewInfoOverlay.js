/**
 * DOM info HUD for Asset Preview — same classes as viewport-info-overlay (VP-OVL).
 */

/**
 * @param {HTMLElement} host - position:relative measure host
 * @returns {HTMLElement}
 */
export function ensureAssetPreviewInfoOverlay(host) {
    let el = host.querySelector(':scope > .viewport-info-overlay.ae-preview-info');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'viewport-info-overlay ae-preview-info';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = [
        '<div class="viewport-info-block viewport-info-tl">',
        '  <div class="viewport-info-row" data-k="asset"></div>',
        '  <div class="viewport-info-row" data-k="size"></div>',
        '  <div class="viewport-info-row" data-k="zoom"></div>',
        '</div>',
        '<div class="viewport-info-block viewport-info-br">',
        '  <div class="viewport-info-row" data-k="comp"></div>',
        '  <div class="viewport-info-row" data-k="compDetail"></div>',
        '  <div class="viewport-info-row" data-k="stats"></div>',
        '</div>'
    ].join('');
    host.appendChild(el);
    return el;
}

/**
 * @param {HTMLElement|null} overlay
 * @param {object|null} asset
 * @param {object|null} [comp]
 * @param {{ zoom?: number }} [camera]
 */
export function updateAssetPreviewInfoOverlay(overlay, asset, comp, camera) {
    if (!overlay) return;
    if (!asset) {
        setText(overlay.querySelector('[data-k="asset"]'), 'No asset');
        setText(overlay.querySelector('[data-k="size"]'), '');
        setText(overlay.querySelector('[data-k="zoom"]'), '');
        setText(overlay.querySelector('[data-k="comp"]'), '');
        setText(overlay.querySelector('[data-k="compDetail"]'), '');
        setText(overlay.querySelector('[data-k="stats"]'), '');
        return;
    }

    const w = Math.max(1, Number(asset.width) || 32);
    const h = Math.max(1, Number(asset.height) || 32);
    const zoomPct = Math.round((camera?.zoom || 1) * 100);
    const comps = Array.isArray(asset.components) ? asset.components : [];
    const name = asset.name || asset.id || 'Asset';

    setText(overlay.querySelector('[data-k="asset"]'), name);
    setText(overlay.querySelector('[data-k="size"]'), `${w}×${h}`);
    setText(overlay.querySelector('[data-k="zoom"]'), `Zoom ${zoomPct}%`);

    if (comp) {
        const type = comp.type || 'component';
        const en = comp.enabled === false ? 'off' : 'on';
        setText(overlay.querySelector('[data-k="comp"]'), `${type} · ${en}`);
        setText(overlay.querySelector('[data-k="compDetail"]'), formatCompDetail(comp, w, h));
    } else {
        setText(overlay.querySelector('[data-k="comp"]'), 'No component');
        setText(overlay.querySelector('[data-k="compDetail"]'), '');
    }

    setText(
        overlay.querySelector('[data-k="stats"]'),
        `${comps.length} comp${comps.length === 1 ? '' : 's'}`
    );
}

/**
 * @param {object} comp
 * @param {number} aw
 * @param {number} ah
 * @returns {string}
 */
function formatCompDetail(comp, aw, ah) {
    const p = comp.properties || {};
    const type = comp.type;
    if (type === 'collider' || type === 'trigger') {
        const ox = Number(p.offsetX) || 0;
        const oy = Number(p.offsetY) || 0;
        const bw = p.width != null && p.width !== '' ? Number(p.width) : aw;
        const bh = p.height != null && p.height !== '' ? Number(p.height) : ah;
        return `off ${ox},${oy} · ${bw}×${bh}`;
    }
    if (type === 'interactable') {
        return `r ${Number(p.radius) || 32}`;
    }
    if (type === 'spriteUiAnimation') {
        const n = Array.isArray(p.frames) ? p.frames.length : 0;
        return n ? `${n} frames` : 'no frames';
    }
    if (type === 'playerStart') {
        return p.spawnFacing ? `facing ${p.spawnFacing}` : 'spawn';
    }
    const keys = Object.keys(p);
    if (!keys.length) return '';
    return `${keys.length} prop${keys.length === 1 ? '' : 's'}`;
}

/**
 * @param {HTMLElement|null} node
 * @param {string} text
 */
function setText(node, text) {
    if (node && node.textContent !== text) node.textContent = text;
}
