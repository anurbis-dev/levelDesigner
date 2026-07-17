/**
 * Image load + paint path for AssetPreviewPanel (keeps panel under size budget).
 */
import { resolveAssetImageSrc } from './AssetEditorContext.js';
import {
    drawPreviewGrid, drawAssetBody, drawAllComponentOverlays, paintPreviewEmpty
} from './AssetPreviewDraw.js';
import { updateAssetPreviewInfoOverlay } from './AssetPreviewInfoOverlay.js';
import { isFreeformShapeComponent } from './AssetPreviewFreeformEdit.js';

/**
 * @param {object} panel AssetPreviewPanel-like
 * @param {object} asset
 */
export function ensurePreviewImage(panel, asset) {
    const src = resolveAssetImageSrc(asset, panel.levelEditor);
    if (!src) {
        panel._img = null;
        panel._imgSrc = null;
        return;
    }
    if (panel._imgSrc === src && panel._img) return;
    panel._imgSrc = src;
    const am = panel.levelEditor?.assetManager;
    const cached = am?.imageCache?.get?.(src) || am?.getCachedImage?.(src);
    if (cached) {
        panel._img = cached;
        return;
    }
    const apply = (img) => {
        if (panel._imgSrc !== src) return;
        panel._img = img || null;
        panel._draw?.();
    };
    if (am?.loadImage) {
        Promise.resolve(am.loadImage(src)).then(apply).catch(() => apply(null));
        return;
    }
    const img = new Image();
    img.onload = () => apply(img);
    img.onerror = () => apply(null);
    img.src = src;
}

/**
 * @param {object} panel
 */
export function resizePreviewCanvas(panel) {
    const dpr = window.devicePixelRatio || 1;
    const rect = panel.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    if (panel.canvas.width !== bw || panel.canvas.height !== bh) {
        panel.canvas.width = bw;
        panel.canvas.height = bh;
    }
    panel._dpr = dpr;
}

/**
 * @param {object} panel
 * @param {object|null} asset
 * @param {object|null} comp
 * @param {string|null} compId
 * @param {Array} comps
 */
export function paintPreviewFrame(panel, asset, comp, compId, comps) {
    resizePreviewCanvas(panel);
    const ctx = panel.canvas.getContext('2d');
    if (!ctx) return;
    const dpr = panel._dpr || 1;
    const cw = panel.canvas.width / dpr;
    const ch = panel.canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cw, ch);

    if (!asset) {
        paintPreviewEmpty(ctx, cw, ch, null);
        updateAssetPreviewInfoOverlay(panel.infoOverlay, null, null, panel.camera);
        return;
    }

    ensurePreviewImage(panel, asset);

    const z = panel.camera.zoom > 0 ? panel.camera.zoom : 1;
    const aw = Math.max(1, Number(asset.width) || 32);
    const ah = Math.max(1, Number(asset.height) || 32);
    const color = asset.color || '#3B82F6';

    ctx.save();
    ctx.translate(-panel.camera.x * z, -panel.camera.y * z);
    ctx.scale(z, z);
    drawPreviewGrid(ctx, aw, ah, z);
    drawAssetBody(ctx, panel._img, aw, ah, color, z);
    const ffEdit = panel._ffActive && isFreeformShapeComponent(comp)
        ? { editActive: true, tool: panel._ffTool }
        : null;
    drawAllComponentOverlays(ctx, comps, compId, aw, ah, z, ffEdit);
    ctx.restore();

    updateAssetPreviewInfoOverlay(panel.infoOverlay, asset, comp, panel.camera);
    panel._ffBar?.refresh();
}
