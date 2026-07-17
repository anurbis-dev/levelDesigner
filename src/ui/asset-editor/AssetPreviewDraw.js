/**
 * Canvas paint helpers for AssetPreviewPanel (grid, asset body, component overlays, HUD).
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
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1 / z;
    ctx.strokeRect(0.5 / z, 0.5 / z, aw - 1 / z, ah - 1 / z);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object|null|undefined} comp
 * @param {number} aw
 * @param {number} ah
 * @param {number} z
 */
export function drawComponentOverlays(ctx, comp, aw, ah, z) {
    if (!comp || comp.enabled === false) return;
    const p = comp.properties || {};
    const type = comp.type;
    const lw = Math.max(1, 1.5 / z);

    if (type === 'collider' || type === 'trigger') {
        const ox = Number(p.offsetX) || 0;
        const oy = Number(p.offsetY) || 0;
        const bw = p.width != null && p.width !== '' ? Number(p.width) : aw;
        const bh = p.height != null && p.height !== '' ? Number(p.height) : ah;
        const stroke = type === 'trigger' ? '#22d3ee' : '#fbbf24';
        ctx.fillStyle = stroke + '22';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.setLineDash([4 / z, 3 / z]);
        ctx.fillRect(ox, oy, Math.max(1, bw), Math.max(1, bh));
        ctx.strokeRect(ox, oy, Math.max(1, bw), Math.max(1, bh));
        ctx.setLineDash([]);
        return;
    }

    if (type === 'interactable') {
        const radius = Number(p.radius) || 32;
        ctx.fillStyle = '#a78bfa18';
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = lw;
        ctx.setLineDash([4 / z, 3 / z]);
        ctx.beginPath();
        ctx.arc(aw / 2, ah / 2, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        return;
    }

    if (type === 'spriteUiAnimation' && Array.isArray(p.frames) && p.frames.length) {
        ctx.strokeStyle = '#34d39966';
        ctx.lineWidth = lw;
        ctx.strokeRect(0, 0, aw, ah);
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cw
 * @param {number} ch
 * @param {object|null} asset
 * @param {object|null} [comp]
 */
export function paintPreviewHud(ctx, cw, ch, asset, comp) {
    if (!asset) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No asset selected', cw / 2, ch / 2);
        return;
    }
    if (comp?.type === 'spriteUiAnimation') {
        const n = Array.isArray(comp.properties?.frames) ? comp.properties.frames.length : 0;
        if (n) {
            ctx.fillStyle = '#000a';
            ctx.fillRect(6, 6, 72, 16);
            ctx.fillStyle = '#34d399';
            ctx.font = '10px system-ui,sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${n} frames`, 10, 17);
        }
    }
}
