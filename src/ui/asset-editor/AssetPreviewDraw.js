/**
 * Canvas paint helpers for AssetPreviewPanel.
 * Sprite body is independent of colliders; colliders/triggers are stroke frames only.
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} aw
 * @param {number} ah
 * @param {number} zoom
 */
export function drawPreviewGrid(ctx, aw, ah, zoom) {
    const z = zoom || 1;
    const step = aw <= 64 && ah <= 64 ? 8 : 16;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1 / z;
    const pad = Math.max(aw, ah) * 2 + 200;
    const x0 = Math.floor(-pad / step) * step;
    const y0 = Math.floor(-pad / step) * step;
    const x1 = pad + aw;
    const y1 = pad + ah;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
    }
    for (let y = y0; y <= y1; y += step) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(0, y1);
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    ctx.stroke();
}

/**
 * Draw asset visual (sprite texture). Never uses collider sizes.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement|null} img
 * @param {number} aw
 * @param {number} ah
 * @param {string} color
 * @param {number} zoom
 */
export function drawAssetBody(ctx, img, aw, ah, color, zoom) {
    const z = zoom || 1;
    if (img && img.complete && img.naturalWidth) {
        ctx.imageSmoothingEnabled = false;
        try {
            ctx.drawImage(img, 0, 0, aw, ah);
        } catch {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, aw, ah);
        }
    } else {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, aw, ah);
    }
    // Entity bounds (not a collider)
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1 / z;
    ctx.setLineDash([]);
    ctx.strokeRect(0.5 / z, 0.5 / z, aw - 1 / z, ah - 1 / z);
}

const COLLIDER_PALETTE = ['#fbbf24', '#f97316', '#eab308', '#d97706'];
const TRIGGER_PALETTE = ['#22d3ee', '#06b6d4', '#67e8f9', '#0891b2'];

/**
 * Draw every enabled overlay as a frame. Selected is thicker; others dimmer.
 * Colliders never crop or recolor the sprite fill.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} components
 * @param {string|null} selectedId
 * @param {number} aw
 * @param {number} ah
 * @param {number} z
 */
export function drawAllComponentOverlays(ctx, components, selectedId, aw, ah, z) {
    const list = Array.isArray(components) ? components : [];
    let collIdx = 0;
    let trigIdx = 0;

    const paint = (comp, selected) => {
        if (!comp || comp.enabled === false) return;
        const type = comp.type;
        if (type === 'collider') {
            drawAabbFrame(ctx, comp, aw, ah, z, COLLIDER_PALETTE[collIdx++ % COLLIDER_PALETTE.length], selected);
            return;
        }
        if (type === 'trigger') {
            drawAabbFrame(ctx, comp, aw, ah, z, TRIGGER_PALETTE[trigIdx++ % TRIGGER_PALETTE.length], selected);
            return;
        }
        if (type === 'interactable') {
            drawInteractFrame(ctx, comp, aw, ah, z, selected);
        }
    };

    // Unselected under, selected on top
    for (const c of list) {
        if (c.id === selectedId) continue;
        paint(c, false);
    }
    const sel = list.find((c) => c.id === selectedId);
    if (sel) paint(sel, true);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} comp
 * @param {number} aw
 * @param {number} ah
 * @param {number} z
 * @param {string} stroke
 * @param {boolean} selected
 */
function drawAabbFrame(ctx, comp, aw, ah, z, stroke, selected) {
    const p = comp.properties || {};
    const ox = Number(p.offsetX) || 0;
    const oy = Number(p.offsetY) || 0;
    const bw = p.width != null && p.width !== '' ? Number(p.width) : aw;
    const bh = p.height != null && p.height !== '' ? Number(p.height) : ah;
    const w = Math.max(1, bw);
    const h = Math.max(1, bh);
    const lw = Math.max(1, (selected ? 2.5 : 1.5) / z);

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = selected ? 1 : 0.75;
    ctx.lineWidth = lw;
    ctx.setLineDash(selected ? [] : [5 / z, 4 / z]);
    ctx.fillStyle = 'transparent';
    // No fill — frames only (do not tint sprite)
    ctx.strokeRect(ox, oy, w, h);
    // Corner marks for multi-instance readability
    const m = Math.min(4, w / 4, h / 4);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(ox, oy + m);
    ctx.lineTo(ox, oy);
    ctx.lineTo(ox + m, oy);
    ctx.moveTo(ox + w - m, oy);
    ctx.lineTo(ox + w, oy);
    ctx.lineTo(ox + w, oy + m);
    ctx.moveTo(ox + w, oy + h - m);
    ctx.lineTo(ox + w, oy + h);
    ctx.lineTo(ox + w - m, oy + h);
    ctx.moveTo(ox + m, oy + h);
    ctx.lineTo(ox, oy + h);
    ctx.lineTo(ox, oy + h - m);
    ctx.stroke();
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} comp
 * @param {number} aw
 * @param {number} ah
 * @param {number} z
 * @param {boolean} selected
 */
function drawInteractFrame(ctx, comp, aw, ah, z, selected) {
    const radius = Number(comp.properties?.radius) || 32;
    const lw = Math.max(1, (selected ? 2.5 : 1.5) / z);
    ctx.save();
    ctx.strokeStyle = '#a78bfa';
    ctx.globalAlpha = selected ? 1 : 0.75;
    ctx.lineWidth = lw;
    ctx.setLineDash(selected ? [] : [5 / z, 4 / z]);
    ctx.beginPath();
    ctx.arc(aw / 2, ah / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cw
 * @param {number} ch
 * @param {object|null} asset
 */
export function paintPreviewEmpty(ctx, cw, ch, asset) {
    if (asset) return;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No asset selected', cw / 2, ch / 2);
}
