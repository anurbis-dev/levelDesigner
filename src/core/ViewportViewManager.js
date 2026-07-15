/**
 * Multi-viewport registry (Phase B4.2).
 *
 * Camera model:
 * - **Work camera** — editor navigation pose. Primary leaf uses stateManager.camera
 *   (legacy + level save). Secondary work leaves keep a local {x,y,zoom}.
 * - **Game cameras** — level objects with type === 'camera' (properties.zoom).
 *   A view can bind source { kind:'game', objectId } and follow that object pose.
 *
 * Shared across all views: level data, layers, selection, assets.
 * Per view: camera source, resolved pose, object-type display filters, display options.
 */
import { Logger } from '../utils/Logger.js';
import { bindSecondaryViewportNav, unbindSecondaryViewportNav } from './ViewportViewNav.js';

/** @typedef {{ kind: 'work' } | { kind: 'game', objectId: string }} CameraSource */
/** @typedef {{ x: number, y: number, zoom: number }} CameraPose */

/**
 * @typedef {object} ViewportView
 * @property {string} leafId
 * @property {boolean} isPrimary
 * @property {HTMLElement} root
 * @property {HTMLElement} measureEl - size host for canvas
 * @property {HTMLCanvasElement} canvas
 * @property {CameraSource} source
 * @property {CameraPose} localCamera - used when source.kind === 'work' && !isPrimary
 * @property {Set<string>} typeFilters - empty = all types; 'DISABLE_ALL' = none
 * @property {{ showGrid?: boolean|null, objectBoundaries?: boolean|null, objectCollisions?: boolean|null }} displayOptions
 *   null/undefined = inherit global view/canvas flags
 * @property {ResizeObserver|null} resizeObserver
 */

export class ViewportViewManager {
    /**
     * @param {object} levelEditor
     */
    constructor(levelEditor) {
        this.editor = levelEditor;
        /** @type {Map<string, ViewportView>} */
        this.views = new Map();
        /** @type {string|null} */
        this.focusedLeafId = null;
    }

    /**
     * @param {Partial<ViewportView> & { leafId: string, root: HTMLElement, measureEl: HTMLElement, canvas: HTMLCanvasElement }} opts
     * @returns {ViewportView}
     */
    registerView(opts) {
        const leafId = opts.leafId;
        const prev = this.views.get(leafId);
        // Preserve filters/localCamera when rebinding the same leaf after dock re-render
        const keepFilters = prev?.typeFilters;
        const keepLocal = prev?.localCamera;
        const keepSource = prev?.source;
        if (prev) {
            this.unregisterView(leafId);
        }

        const primaryCam = this._readPrimaryCamera();
        /** @type {ViewportView} */
        const view = {
            leafId,
            isPrimary: !!opts.isPrimary,
            root: opts.root,
            measureEl: opts.measureEl,
            canvas: opts.canvas,
            source: opts.source || keepSource || { kind: 'work' },
            localCamera: opts.localCamera
                ? { ...opts.localCamera }
                : (keepLocal ? { ...keepLocal } : { x: primaryCam.x, y: primaryCam.y, zoom: primaryCam.zoom }),
            typeFilters: opts.typeFilters instanceof Set
                ? new Set(opts.typeFilters)
                : (keepFilters ? new Set(keepFilters) : new Set()),
            displayOptions: opts.displayOptions || prev?.displayOptions || {},
            resizeObserver: null
        };

        view.canvas.dataset.viewportLeafId = leafId;
        view.canvas.classList.add('viewport-view-canvas');
        if (view.isPrimary) {
            view.canvas.dataset.viewportPrimary = '1';
        }

        this._bindFocus(view);
        this._bindResize(view);
        bindSecondaryViewportNav(this, view);

        this.views.set(leafId, view);
        if (!this.focusedLeafId || view.isPrimary) {
            this.focusedLeafId = leafId;
        }
        this.resizeView(leafId);
        Logger.ui.debug(`ViewportView registered ${leafId} primary=${view.isPrimary}`);
        return view;
    }

    /**
     * @param {string} leafId
     */
    unregisterView(leafId) {
        const view = this.views.get(leafId);
        if (!view) return;
        if (view.resizeObserver) {
            try { view.resizeObserver.disconnect(); } catch (_e) { /* */ }
        }
        unbindSecondaryViewportNav(view);
        this.views.delete(leafId);
        if (this.focusedLeafId === leafId) {
            const primary = this.getPrimaryView();
            this.focusedLeafId = primary ? primary.leafId : (this.views.keys().next().value || null);
        }
    }

    /** @returns {ViewportView[]} */
    getViews() {
        return [...this.views.values()];
    }

    /** @returns {ViewportView|null} */
    getView(leafId) {
        return this.views.get(leafId) || null;
    }

    /** @returns {ViewportView|null} */
    getPrimaryView() {
        for (const v of this.views.values()) {
            if (v.isPrimary) return v;
        }
        return null;
    }

    /** @returns {ViewportView|null} */
    getFocusedView() {
        if (this.focusedLeafId && this.views.has(this.focusedLeafId)) {
            return this.views.get(this.focusedLeafId);
        }
        return this.getPrimaryView();
    }

    /**
     * @param {string} leafId
     */
    focus(leafId) {
        if (!this.views.has(leafId)) return;
        this.focusedLeafId = leafId;
        this.views.forEach((v) => {
            v.root?.classList.toggle('viewport-view-focused', v.leafId === leafId);
        });
    }

    /**
     * Resolve camera pose for a view (work local/primary or game object).
     * @param {string|ViewportView} leafIdOrView
     * @returns {CameraPose}
     */
    resolveCamera(leafIdOrView) {
        const view = typeof leafIdOrView === 'string'
            ? this.views.get(leafIdOrView)
            : leafIdOrView;
        if (!view) return this._readPrimaryCamera();

        if (view.source?.kind === 'game' && view.source.objectId) {
            const gameCam = this.resolveGameCameraObject(view.source.objectId, view.canvas);
            if (gameCam) return gameCam;
            // Missing object → fall back to work pose
        }

        if (view.isPrimary) {
            return this._readPrimaryCamera();
        }
        return { ...view.localCamera };
    }

    /**
     * Active camera for input tools (focused view).
     * @returns {CameraPose}
     */
    getActiveCamera() {
        return this.resolveCamera(this.getFocusedView());
    }

    /**
     * Write pose into the focused (or given) work view. Game-bound views ignore pan
     * unless unlockToWork is set (converts source to work first).
     * @param {Partial<CameraPose>} patch
     * @param {string} [leafId]
     * @param {{ unlockGame?: boolean }} [opts]
     */
    updateCamera(patch, leafId = null, opts = {}) {
        const view = leafId
            ? this.views.get(leafId)
            : this.getFocusedView();
        if (!view) return;

        if (view.source?.kind === 'game') {
            if (!opts.unlockGame) return;
            const pose = this.resolveGameCameraObject(view.source.objectId, view.canvas)
                || { ...view.localCamera };
            view.source = { kind: 'work' };
            view.localCamera = { ...pose };
        }

        if (view.isPrimary) {
            const cam = this._readPrimaryCamera();
            const next = {
                x: patch.x !== undefined ? patch.x : cam.x,
                y: patch.y !== undefined ? patch.y : cam.y,
                zoom: patch.zoom !== undefined ? patch.zoom : cam.zoom
            };
            this.editor.stateManager.set('camera', next);
            return;
        }

        view.localCamera = {
            x: patch.x !== undefined ? patch.x : view.localCamera.x,
            y: patch.y !== undefined ? patch.y : view.localCamera.y,
            zoom: patch.zoom !== undefined ? patch.zoom : view.localCamera.zoom
        };
    }

    /**
     * @param {string} leafId
     * @param {CameraSource} source
     */
    setSource(leafId, source) {
        const view = this.views.get(leafId);
        if (!view) return;
        view.source = source?.kind === 'game'
            ? { kind: 'game', objectId: source.objectId }
            : { kind: 'work' };
        if (view.source.kind === 'work' && !view.isPrimary) {
            // Keep current on-screen pose when switching back to free work camera
            const resolved = this.resolveCamera(view);
            view.localCamera = { ...resolved };
        }
        this.editor.render?.();
    }

    /**
     * @param {string} leafId
     * @param {Set<string>} filters
     */
    setTypeFilters(leafId, filters) {
        const view = this.views.get(leafId);
        if (!view) return;
        view.typeFilters = filters instanceof Set ? new Set(filters) : new Set(filters || []);
        this.editor.render?.();
    }

    /**
     * Level objects that act as game cameras.
     * @returns {Array<object>}
     */
    listGameCameraObjects() {
        const level = this.editor.getLevel?.() || this.editor.level;
        if (!level?.getAllObjects) {
            return (level?.objects || []).filter((o) => o.type === 'camera');
        }
        return level.getAllObjects().filter((o) => o.type === 'camera');
    }

    /**
     * @param {string} objectId
     * @param {HTMLCanvasElement} canvas
     * @returns {CameraPose|null}
     */
    resolveGameCameraObject(objectId, canvas) {
        const obj = this.editor.getCachedObject?.(objectId)
            || this.editor.level?.findObjectById?.(objectId);
        if (!obj || obj.type !== 'camera') return null;

        const zoom = obj.properties?.zoom ?? 1;
        const w = canvas?.width || 1;
        const h = canvas?.height || 1;
        const centerX = obj.x + (obj.width || 0) / 2;
        const centerY = obj.y + (obj.height || 0) / 2;
        return {
            zoom,
            x: centerX - w / (2 * zoom),
            y: centerY - h / (2 * zoom)
        };
    }

    /**
     * Whether object passes this view's type display filter.
     * @param {ViewportView} view
     * @param {object} obj
     * @returns {boolean}
     */
    passesTypeFilter(view, obj) {
        if (!view || !obj) return true;
        const f = view.typeFilters;
        if (!f || f.size === 0) return true;
        if (f.has('DISABLE_ALL')) return false;
        return f.has(obj.type);
    }

    /**
     * Effective display flag: per-view override or global state.
     * @param {ViewportView} view
     * @param {'showGrid'|'objectBoundaries'|'objectCollisions'} key
     * @returns {boolean}
     */
    getDisplayFlag(view, key) {
        const local = view?.displayOptions?.[key];
        if (local === true || local === false) return local;
        if (key === 'showGrid') {
            return this.editor.stateManager.get('canvas.showGrid')
                ?? this.editor.level?.settings?.showGrid
                ?? true;
        }
        return !!this.editor.stateManager.get(`view.${key}`);
    }

    /**
     * Resize one view's canvas to its measure host.
     * @param {string} leafId
     */
    resizeView(leafId) {
        const view = this.views.get(leafId);
        if (!view?.measureEl || !view.canvas) return;

        const el = view.measureEl;
        const layoutW = el.clientWidth || el.getBoundingClientRect().width;
        const layoutH = el.clientHeight || el.getBoundingClientRect().height;
        if (!layoutW || !layoutH || layoutW <= 0 || layoutH <= 0) {
            if (!el.closest('#dock-legacy-offtree, #dock-content-pool')) {
                // quiet when parked
            }
            return;
        }
        const width = Math.max(1, Math.floor(layoutW));
        const height = Math.max(1, Math.floor(layoutH));
        if (view.canvas.width !== width || view.canvas.height !== height) {
            view.canvas.width = width;
            view.canvas.height = height;
            view.canvas.style.width = `${width}px`;
            view.canvas.style.height = `${height}px`;
            view.canvas.style.display = 'block';
        }
        // Keep host/canvas fill color in sync with level/settings (stretch with leaf)
        const bg = this.editor.stateManager?.get('canvas.backgroundColor')
            || this.editor.level?.settings?.backgroundColor
            || '#4B5563';
        if (view.measureEl) view.measureEl.style.backgroundColor = bg;
        if (view.root) view.root.style.backgroundColor = bg;
        view.canvas.style.backgroundColor = bg;
        if (view.isPrimary && this.editor.canvasRenderer) {
            // Keep primary canvasRenderer.canvas in sync (same element usually)
            const cr = this.editor.canvasRenderer;
            if (cr.canvas === view.canvas && this.editor.stateManager) {
                const rect = el.getBoundingClientRect();
                this.editor.stateManager.set('canvas.position', { x: rect.left, y: rect.top });
                this.editor.stateManager.set('canvas.size', { width, height });
            }
        }
    }

    resizeAll() {
        this.views.forEach((_v, id) => this.resizeView(id));
    }

    /**
     * Find view by event target (canvas or descendant).
     * @param {EventTarget|null} target
     * @returns {ViewportView|null}
     */
    viewFromEventTarget(target) {
        if (!(target instanceof Element)) return null;
        const canvas = target.closest('canvas.viewport-view-canvas, canvas#main-canvas, canvas[data-viewport-leaf-id]');
        if (!canvas) return null;
        const id = canvas.dataset.viewportLeafId;
        if (id && this.views.has(id)) return this.views.get(id);
        // main-canvas without dataset yet
        return this.getPrimaryView();
    }

    destroy() {
        [...this.views.keys()].forEach((id) => this.unregisterView(id));
        this.editor = null;
    }

    // --- internals ---

    _readPrimaryCamera() {
        const cam = this.editor?.stateManager?.get('camera');
        return {
            x: cam?.x ?? 0,
            y: cam?.y ?? 0,
            zoom: cam?.zoom && cam.zoom > 0 ? cam.zoom : 1
        };
    }

    _bindFocus(view) {
        const onFocus = () => this.focus(view.leafId);
        view.canvas.addEventListener('pointerdown', onFocus);
        view._onFocus = onFocus;
    }

    _bindResize(view) {
        if (typeof ResizeObserver === 'undefined') return;
        view.resizeObserver = new ResizeObserver(() => {
            this.resizeView(view.leafId);
            this.editor?.render?.();
        });
        view.resizeObserver.observe(view.measureEl);
    }
}
