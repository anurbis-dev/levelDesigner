/** Asset preview mini-viewport: local camera, info HUD; F/A via EventHandlers. */
import {
    getEditingAsset, getEditingComponentId, subscribeAssetEditor
} from './AssetEditorContext.js';
import {
    PREVIEW_ZOOM_WHEEL, PREVIEW_ZOOM_MMB, fitCameraToAsset, fitCameraToBounds,
    getComponentBounds, zoomAtClient, panCamera, clientToWorld
} from './AssetPreviewCamera.js';
import { ensureAssetPreviewInfoOverlay } from './AssetPreviewInfoOverlay.js';
import {
    isFreeformShapeComponent,
    mountFreeformToolbar,
    freeformPointerDown,
    freeformMovePoint
} from './AssetPreviewFreeformEdit.js';
import {
    ensurePreviewImage, resizePreviewCanvas, paintPreviewFrame
} from './AssetPreviewRender.js';

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
        this._boundAssetId = null;
        this._img = null;
        this._imgSrc = null;
        /** @type {{ mode: 'pan'|'zoom'|'freeformMove', lastX: number, lastY: number, startX: number, startY: number, initialZoom: number, pointIndex?: number }|null} */
        this._drag = null;
        this._raf = null;
        this._ro = null;
        this._dpr = 1;
        this._needsFit = true;
        this._ffActive = false;
        /** @type {'add'|'move'|'delete'} */
        this._ffTool = 'move';

        this.container.style.cssText =
            'overflow:hidden;padding:0;height:100%;box-sizing:border-box;'
            + 'display:flex;flex-direction:column;background:#0f172a;';

        this.host = document.createElement('div');
        this.host.className = 'ae-preview-host';
        this.host.style.cssText =
            'position:relative;flex:1 1 auto;width:100%;min-height:0;overflow:hidden;';

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'ae-preview-canvas';
        this.canvas.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;display:block;'
            + 'cursor:default;touch-action:none;';
        this.canvas.tabIndex = 0;

        this.host.appendChild(this.canvas);
        this.infoOverlay = ensureAssetPreviewInfoOverlay(this.host);
        this._ffBar = mountFreeformToolbar(this.host, {
            getActive: () => this._ffActive,
            getTool: () => this._ffTool,
            setActive: (v) => {
                this._ffActive = !!v;
                this._syncCursor();
                this._draw();
            },
            setTool: (t) => {
                this._ffTool = t;
                this._syncCursor();
                this._draw();
            },
            isVisible: () => {
                const asset = getEditingAsset(this.levelEditor);
                const id = getEditingComponentId(this.levelEditor);
                const c = id ? (asset?.components || []).find((x) => x.id === id) : null;
                return isFreeformShapeComponent(c);
            }
        });
        this.container.appendChild(this.host);

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = (e) => e.preventDefault();

        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('pointercancel', this._onPointerUp);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContextMenu);

        this._ro = new ResizeObserver(() => {
            resizePreviewCanvas(this);
            if (this._needsFit) this._tryInitialFit();
            this._draw();
        });
        this._ro.observe(this.host);

        this._unsub = subscribeAssetEditor(stateManager, () => this._onContextChange());
        resizePreviewCanvas(this);
        this._onContextChange();
    }

    /** A — frame whole asset. */
    fitToAsset() {
        this._applyFitToAsset();
        this._needsFit = false;
        this._draw();
    }

    /** Request re-center on next sized frame (open editor / new asset). */
    requestInitialFit() {
        this._needsFit = true;
        this._tryInitialFit();
        this._draw();
    }

    /** @private */
    _applyFitToAsset() {
        const asset = getEditingAsset(this.levelEditor);
        const { cw, ch } = this._cssSize();
        if (!asset || cw < 16 || ch < 16) {
            if (!asset) this.camera = { x: 0, y: 0, zoom: 1 };
            return false;
        }
        this.camera = fitCameraToAsset(
            cw, ch,
            Math.max(1, Number(asset.width) || 32),
            Math.max(1, Number(asset.height) || 32)
        );
        return true;
    }

    /** @private */
    _tryInitialFit() {
        if (!this._needsFit) return;
        if (this._applyFitToAsset()) this._needsFit = false;
    }

    /** F — frame selected component (no-op if none). */
    fitToSelection() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) return;
        const compId = getEditingComponentId(this.levelEditor);
        const comp = compId
            ? (asset.components || []).find((c) => c.id === compId)
            : null;
        if (!comp) return;
        const aw = Math.max(1, Number(asset.width) || 32);
        const ah = Math.max(1, Number(asset.height) || 32);
        const b = getComponentBounds(comp, aw, ah);
        const { cw, ch } = this._cssSize();
        this.camera = fitCameraToBounds(cw, ch, b.minX, b.minY, b.maxX, b.maxY);
        this._draw();
    }

    /** @private */
    _cssSize() {
        const rect = this.canvas.getBoundingClientRect();
        return {
            cw: Math.max(1, rect.width || this.host.clientWidth || 1),
            ch: Math.max(1, rect.height || this.host.clientHeight || 1)
        };
    }

    /** @private */
    _onContextChange() {
        const asset = getEditingAsset(this.levelEditor);
        const id = asset?.id || null;
        if (id !== this._boundAssetId) {
            this._boundAssetId = id;
            this._img = null;
            this._imgSrc = null;
            this._needsFit = true;
            this._ffActive = false;
        }
        const compId = getEditingComponentId(this.levelEditor);
        const comp = compId ? (asset?.components || []).find((c) => c.id === compId) : null;
        if (!isFreeformShapeComponent(comp)) this._ffActive = false;
        this._tryInitialFit();
        if (asset) ensurePreviewImage(this, asset);
        this._ffBar?.refresh();
        this._syncCursor();
        this._draw();
    }

    /** @private */
    _syncCursor() {
        if (!this.canvas) return;
        if (this._drag?.mode === 'pan') this.canvas.style.cursor = 'grabbing';
        else if (this._drag?.mode === 'zoom') this.canvas.style.cursor = 'zoom-in';
        else if (this._ffActive) {
            this.canvas.style.cursor = this._ffTool === 'add' ? 'crosshair'
                : this._ffTool === 'delete' ? 'pointer' : 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
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
                lastX: e.clientX, lastY: e.clientY,
                startX: e.clientX, startY: e.clientY,
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
                lastX: e.clientX, lastY: e.clientY,
                startX: e.clientX, startY: e.clientY,
                initialZoom: this.camera.zoom
            };
            this.canvas.style.cursor = 'zoom-in';
            this.canvas.setPointerCapture?.(e.pointerId);
            return;
        }
        if (e.button === 0 && this._ffActive) {
            const asset = getEditingAsset(this.levelEditor);
            if (!asset) return;
            const aw = Math.max(1, Number(asset.width) || 32);
            const ah = Math.max(1, Number(asset.height) || 32);
            const drag = freeformPointerDown({
                levelEditor: this.levelEditor,
                canvas: this.canvas,
                camera: this.camera,
                clientX: e.clientX,
                clientY: e.clientY,
                tool: this._ffTool,
                aw,
                ah
            });
            e.preventDefault();
            if (drag?.mode === 'move') {
                this._drag = {
                    mode: 'freeformMove',
                    lastX: e.clientX, lastY: e.clientY,
                    startX: e.clientX, startY: e.clientY,
                    initialZoom: this.camera.zoom,
                    pointIndex: drag.index
                };
                this.canvas.setPointerCapture?.(e.pointerId);
            }
            this._draw();
        }
    }

    /**
     * @param {PointerEvent} e
     * @private
     */
    _onPointerMove(e) {
        if (!this._drag) return;
        if (this._drag.mode === 'pan') {
            this.camera = panCamera(
                this.camera,
                e.clientX - this._drag.lastX,
                e.clientY - this._drag.lastY
            );
            this._drag.lastX = e.clientX;
            this._drag.lastY = e.clientY;
            this._draw();
            return;
        }
        if (this._drag.mode === 'zoom') {
            const factor = 1 + (e.clientY - this._drag.startY) * PREVIEW_ZOOM_MMB;
            this.camera = zoomAtClient(
                this.camera, this.canvas,
                this._drag.startX, this._drag.startY,
                this._drag.initialZoom * factor
            );
            this._draw();
            return;
        }
        if (this._drag.mode === 'freeformMove') {
            const asset = getEditingAsset(this.levelEditor);
            const compId = getEditingComponentId(this.levelEditor);
            if (!asset || !compId || this._drag.pointIndex == null) return;
            const world = clientToWorld(this.canvas, e.clientX, e.clientY, this.camera);
            freeformMovePoint(
                this.levelEditor, asset.id, compId,
                this._drag.pointIndex, world.x, world.y,
                Math.max(1, Number(asset.width) || 32),
                Math.max(1, Number(asset.height) || 32)
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
        this._syncCursor();
        try {
            this.canvas.releasePointerCapture?.(e.pointerId);
        } catch { /* ignore */ }
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
            this.camera, this.canvas, e.clientX, e.clientY,
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
        const asset = getEditingAsset(this.levelEditor);
        const compId = getEditingComponentId(this.levelEditor);
        const comps = asset && Array.isArray(asset.components) ? asset.components : [];
        const comp = asset && compId ? comps.find((c) => c.id === compId) : null;
        paintPreviewFrame(this, asset, comp, compId, comps);
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
        this._ffBar?.destroy();
        this._ffBar = null;
        this.canvas?.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        window.removeEventListener('pointercancel', this._onPointerUp);
        this.canvas?.removeEventListener('wheel', this._onWheel);
        this.canvas?.removeEventListener('contextmenu', this._onContextMenu);
        this.container.innerHTML = '';
        this.canvas = null;
        this.host = null;
        this.infoOverlay = null;
        this._img = null;
        this.levelEditor = null;
        this.stateManager = null;
    }
}
