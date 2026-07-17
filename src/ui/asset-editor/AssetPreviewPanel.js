/**
 * Asset preview mini-viewport: local camera (RMB pan, wheel/MMB zoom), asset + overlays.
 */
import {
    getEditingAsset,
    getEditingComponentId,
    subscribeAssetEditor,
    resolveAssetImageSrc
} from './AssetEditorContext.js';
import {
    PREVIEW_ZOOM_WHEEL,
    PREVIEW_ZOOM_MMB,
    fitCameraToAsset,
    zoomAtClient,
    panCamera
} from './AssetPreviewCamera.js';
import {
    drawPreviewGrid,
    drawAssetBody,
    drawComponentOverlays,
    paintPreviewHud
} from './AssetPreviewDraw.js';

export class AssetPreviewPanel {
    /**
     * @param {HTMLElement} container
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, stateManager, levelEditor, options = {}) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.instanceKey = options.instanceKey || null;

        /** @type {{ x: number, y: number, zoom: number }} */
        this.camera = { x: 0, y: 0, zoom: 1 };
        /** @type {string|null} */
        this._boundAssetId = null;
        /** @type {HTMLImageElement|null} */
        this._img = null;
        /** @type {string|null} */
        this._imgSrc = null;
        /** @type {{ mode: 'pan'|'zoom', lastX: number, lastY: number, startX: number, startY: number, initialZoom: number }|null} */
        this._drag = null;
        this._raf = null;
        this._ro = null;
        this._dpr = 1;

        this.container.style.cssText =
            'overflow:hidden;padding:0;height:100%;box-sizing:border-box;'
            + 'display:flex;flex-direction:column;background:#0f172a;';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ae-preview-canvas';
        this.canvas.style.cssText =
            'flex:1 1 auto;width:100%;min-height:0;display:block;cursor:default;touch-action:none;';
        this.canvas.tabIndex = 0;

        this.statusEl = document.createElement('div');
        this.statusEl.style.cssText =
            'flex:0 0 auto;font-size:10px;color:#94a3b8;padding:4px 8px;'
            + 'border-top:1px solid #1e293b;display:flex;justify-content:space-between;gap:8px;user-select:none;';

        this.container.appendChild(this.canvas);
        this.container.appendChild(this.statusEl);

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = (e) => e.preventDefault();
        this._onDblClick = () => {
            this.fitToAsset();
            this._draw();
        };

        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('pointercancel', this._onPointerUp);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        this.canvas.addEventListener('dblclick', this._onDblClick);

        this._ro = new ResizeObserver(() => {
            this._resizeCanvas();
            this._draw();
        });
        this._ro.observe(this.container);

        this._unsub = subscribeAssetEditor(stateManager, () => this._onContextChange());
        this._resizeCanvas();
        this._onContextChange();
    }

    /** Fit camera to asset bounds (also double-click). */
    fitToAsset() {
        const asset = getEditingAsset(this.levelEditor);
        const rect = this.canvas.getBoundingClientRect();
        const cw = Math.max(1, rect.width);
        const ch = Math.max(1, rect.height);
        if (!asset) {
            this.camera = { x: 0, y: 0, zoom: 1 };
            return;
        }
        this.camera = fitCameraToAsset(
            cw,
            ch,
            Math.max(1, Number(asset.width) || 32),
            Math.max(1, Number(asset.height) || 32)
        );
    }

    /** @private */
    _onContextChange() {
        const asset = getEditingAsset(this.levelEditor);
        const id = asset?.id || null;
        if (id !== this._boundAssetId) {
            this._boundAssetId = id;
            this._img = null;
            this._imgSrc = null;
            this.fitToAsset();
        }
        if (asset) this._ensureImage(asset);
        this._draw();
    }

    /**
     * @param {object} asset
     * @private
     */
    _ensureImage(asset) {
        const src = resolveAssetImageSrc(asset);
        if (!src) {
            this._img = null;
            this._imgSrc = null;
            return;
        }
        if (this._imgSrc === src && this._img) return;
        this._imgSrc = src;
        const am = this.levelEditor?.assetManager;
        const cached = am?.imageCache?.get?.(src) || am?.getCachedImage?.(src);
        if (cached) {
            this._img = cached;
            return;
        }
        const apply = (img) => {
            if (this._imgSrc !== src) return;
            this._img = img || null;
            this._draw();
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

    /** @private */
    _resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        const bw = Math.floor(w * dpr);
        const bh = Math.floor(h * dpr);
        if (this.canvas.width !== bw || this.canvas.height !== bh) {
            this.canvas.width = bw;
            this.canvas.height = bh;
        }
        this._dpr = dpr;
    }

    /**
     * @param {PointerEvent} e
     * @private
     */
    _onPointerDown(e) {
        if (e.button === 2) {
            e.preventDefault();
            this._drag = {
                mode: 'pan',
                lastX: e.clientX,
                lastY: e.clientY,
                startX: e.clientX,
                startY: e.clientY,
                initialZoom: this.camera.zoom
            };
            this.canvas.style.cursor = 'grabbing';
            this.canvas.setPointerCapture?.(e.pointerId);
            return;
        }
        if (e.button === 1) {
            e.preventDefault();
            this._drag = {
                mode: 'zoom',
                lastX: e.clientX,
                lastY: e.clientY,
                startX: e.clientX,
                startY: e.clientY,
                initialZoom: this.camera.zoom
            };
            this.canvas.style.cursor = 'zoom-in';
            this.canvas.setPointerCapture?.(e.pointerId);
        }
    }

    /**
     * @param {PointerEvent} e
     * @private
     */
    _onPointerMove(e) {
        if (!this._drag) return;
        if (this._drag.mode === 'pan') {
            const dx = e.clientX - this._drag.lastX;
            const dy = e.clientY - this._drag.lastY;
            this.camera = panCamera(this.camera, dx, dy);
            this._drag.lastX = e.clientX;
            this._drag.lastY = e.clientY;
            this._draw();
            return;
        }
        if (this._drag.mode === 'zoom') {
            const deltaY = e.clientY - this._drag.startY;
            const factor = 1 + deltaY * PREVIEW_ZOOM_MMB;
            this.camera = zoomAtClient(
                this.camera,
                this.canvas,
                this._drag.startX,
                this._drag.startY,
                this._drag.initialZoom * factor
            );
            this._draw();
        }
    }

    /**
     * @param {PointerEvent} e
     * @private
     */
    _onPointerUp(e) {
        if (!this._drag) return;
        this._drag = null;
        this.canvas.style.cursor = 'default';
        try {
            this.canvas.releasePointerCapture?.(e.pointerId);
        } catch {
            /* ignore */
        }
    }

    /**
     * @param {WheelEvent} e
     * @private
     */
    _onWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        const direction = e.deltaY < 0 ? 1 : -1;
        this.camera = zoomAtClient(
            this.camera,
            this.canvas,
            e.clientX,
            e.clientY,
            this.camera.zoom * (1 + direction * PREVIEW_ZOOM_WHEEL)
        );
        this._draw();
    }

    /** @private */
    _draw() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = null;
            this._paint();
        });
    }

    /** @private */
    _paint() {
        this._resizeCanvas();
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        const dpr = this._dpr || 1;
        const cw = this.canvas.width / dpr;
        const ch = this.canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, ch);

        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            paintPreviewHud(ctx, cw, ch, null, null);
            this._updateStatus(null);
            return;
        }

        const z = this.camera.zoom > 0 ? this.camera.zoom : 1;
        const aw = Math.max(1, Number(asset.width) || 32);
        const ah = Math.max(1, Number(asset.height) || 32);
        const color = asset.color || '#3B82F6';

        ctx.save();
        ctx.translate(-this.camera.x * z, -this.camera.y * z);
        ctx.scale(z, z);
        drawPreviewGrid(ctx, aw, ah, z);
        drawAssetBody(ctx, this._img, aw, ah, color, z);

        const compId = getEditingComponentId(this.levelEditor);
        const comp = compId
            ? (asset.components || []).find((c) => c.id === compId)
            : null;
        drawComponentOverlays(ctx, comp, aw, ah, z);
        ctx.restore();

        paintPreviewHud(ctx, cw, ch, asset, comp);
        this._updateStatus(asset, comp);
    }

    /**
     * @param {object|null} asset
     * @param {object|null} [comp]
     * @private
     */
    _updateStatus(asset, comp) {
        if (!asset) {
            this.statusEl.innerHTML =
                '<span>No asset</span><span>dblclick fit · RMB pan · wheel zoom</span>';
            return;
        }
        const w = Math.max(1, Number(asset.width) || 32);
        const h = Math.max(1, Number(asset.height) || 32);
        const zoomPct = Math.round((this.camera.zoom || 1) * 100);
        const name = this._esc(asset.name || '');
        const extra = comp ? ` · ${this._esc(comp.type)}` : '';
        this.statusEl.innerHTML =
            `<span>${name} · ${w}×${h}${extra}</span>`
            + `<span>${zoomPct}% · dblclick fit · RMB pan · wheel/MMB zoom</span>`;
    }

    /** @private */
    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    destroy() {
        this._unsub?.();
        this._unsub = null;
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        this._ro?.disconnect();
        this._ro = null;
        this.canvas?.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        window.removeEventListener('pointercancel', this._onPointerUp);
        this.canvas?.removeEventListener('wheel', this._onWheel);
        this.canvas?.removeEventListener('contextmenu', this._onContextMenu);
        this.canvas?.removeEventListener('dblclick', this._onDblClick);
        this.container.innerHTML = '';
        this.canvas = null;
        this.statusEl = null;
        this._img = null;
        this.levelEditor = null;
        this.stateManager = null;
    }
}
