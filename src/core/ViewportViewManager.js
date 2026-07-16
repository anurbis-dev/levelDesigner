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
 * Per view: camera source, local pose, object-type display filters, display options.
 *
 * Equality (VP-EQ): all leaves are peers for display/filter/camera pose.
 * `isPrimary` only marks the dock shell that hosts legacy #main-canvas DOM —
 * not settings authority. Last remaining viewport is non-closeable; any other may close.
 */
import { Logger } from '../utils/Logger.js';
import { bindSecondaryViewportNav, unbindSecondaryViewportNav } from './ViewportViewNav.js';
import { refreshAllViewportChrome } from '../ui/dock/ViewportLeafChrome.js';
import {
    ensureViewportInfoOverlay,
    removeViewportInfoOverlay,
    updateViewportInfoOverlay
} from '../ui/dock/ViewportInfoOverlay.js';

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
 * @property {CameraPose} localCamera - work-camera pose for this leaf (all views; peers)
 * @property {Set<string>} typeFilters - empty = all types; 'DISABLE_ALL' = none
 * @property {{ showGrid: boolean, objectBoundaries: boolean, objectCollisions: boolean, parallax: boolean, infoOverlay: boolean }} displayOptions
 *   fully owned per view (never live-inherit global after seed)
 * @property {ResizeObserver|null} resizeObserver
 */

/** @type {ReadonlySet<string>} */
const DISPLAY_FLAG_KEYS = new Set([
    'showGrid', 'objectBoundaries', 'objectCollisions', 'parallax', 'infoOverlay'
]);

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
        /** @type {Function|null} */
        this._unsubObjectProperty = null;
        this._bindChromePropertySync();
    }

    /**
     * VP-COL: when a game Camera object's color/name changes, refresh header icons
     * without requiring re-select via the camera source menu.
     */
    _bindChromePropertySync() {
        if (this._unsubObjectProperty) return;
        const sm = this.editor?.stateManager;
        if (!sm?.subscribe) return;
        this._unsubObjectProperty = sm.subscribe('objectPropertyChanged', (obj, change) => {
            if (!obj || obj.type !== 'camera') return;
            const prop = change?.property;
            // Color/name affect chrome icon; ignore unrelated props to avoid extra DOM work.
            if (prop && prop !== 'color' && prop !== 'name') return;
            // Only if some view is bound to this (or any) game camera — cheap enough to always refresh.
            refreshAllViewportChrome(this.editor);
        });
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

        const seedCam = this._readSavedCamera();
        /** @type {ViewportView} */
        const view = {
            leafId,
            // Shell marker only (legacy #main-canvas host) — not display/filter authority
            isPrimary: !!opts.isPrimary,
            root: opts.root,
            measureEl: opts.measureEl,
            canvas: opts.canvas,
            source: opts.source || keepSource || { kind: 'work' },
            localCamera: opts.localCamera
                ? { ...opts.localCamera }
                : (keepLocal ? { ...keepLocal } : { x: seedCam.x, y: seedCam.y, zoom: seedCam.zoom }),
            typeFilters: opts.typeFilters instanceof Set
                ? new Set(opts.typeFilters)
                : (keepFilters ? new Set(keepFilters) : new Set()),
            // Independent snapshot — never live-link to global state after create
            displayOptions: this._seedDisplayOptions(
                opts.displayOptions || prev?.displayOptions || null
            ),
            resizeObserver: null
        };

        view.canvas.dataset.viewportLeafId = leafId;
        view.canvas.classList.add('viewport-view-canvas');
        if (view.isPrimary) {
            view.canvas.dataset.viewportPrimary = '1';
        } else {
            delete view.canvas.dataset.viewportPrimary;
        }

        this._bindFocus(view);
        this._bindResize(view);
        bindSecondaryViewportNav(this, view);

        this.views.set(leafId, view);
        // Do not steal focus when rebinding shell leaf
        if (!this.focusedLeafId || !this.views.has(this.focusedLeafId)) {
            this.focusedLeafId = leafId;
        }
        this.resizeView(leafId);
        ensureViewportInfoOverlay(view);
        updateViewportInfoOverlay(view, this.editor);
        Logger.ui.debug(`ViewportView registered ${leafId} shell=${view.isPrimary}`);
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
        removeViewportInfoOverlay(view);
        unbindSecondaryViewportNav(view);
        this.views.delete(leafId);
        if (this.focusedLeafId === leafId) {
            this.focusedLeafId = this.views.keys().next().value || null;
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

    /**
     * Dock shell leaf (hosts legacy #main-canvas). Not settings authority.
     * @returns {ViewportView|null}
     */
    getPrimaryView() {
        for (const v of this.views.values()) {
            if (v.isPrimary) return v;
        }
        return null;
    }

    /** First registered peer (stable fallback when no focus). */
    getAnyView() {
        return this.views.values().next().value || null;
    }

    /** @returns {ViewportView|null} */
    getFocusedView() {
        if (this.focusedLeafId && this.views.has(this.focusedLeafId)) {
            return this.views.get(this.focusedLeafId);
        }
        return this.getAnyView();
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
        // Persist focused work pose for level save (peers stay independent)
        const view = this.views.get(leafId);
        if (view && view.source?.kind !== 'game') {
            this.editor.stateManager?.set('camera', { ...view.localCamera });
        }
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
        if (!view) return this._readSavedCamera();

        if (view.source?.kind === 'game' && view.source.objectId) {
            const gameCam = this.resolveGameCameraObject(view.source.objectId, view.canvas);
            if (gameCam) return gameCam;
            // Missing object → fall back to work pose
        }

        // All peers store work pose in localCamera (VP-EQ)
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

        view.localCamera = {
            x: patch.x !== undefined ? patch.x : view.localCamera.x,
            y: patch.y !== undefined ? patch.y : view.localCamera.y,
            zoom: patch.zoom !== undefined ? patch.zoom : view.localCamera.zoom
        };

        // Level-save camera: mirror focused work view into stateManager (no peer coupling)
        if (view.leafId === this.focusedLeafId || this.views.size === 1) {
            this.editor.stateManager?.set('camera', { ...view.localCamera });
        }
    }

    /**
     * @param {string} leafId
     * @param {CameraSource} source
     */
    setSource(leafId, source) {
        const view = this.views.get(leafId);
        if (!view) return;
        if (source?.kind === 'game' && source.objectId) {
            view.source = { kind: 'game', objectId: source.objectId };
        } else {
            // Bake current on-screen pose (game or work) into local work camera
            const pose = this.resolveCamera(view);
            view.source = { kind: 'work' };
            view.localCamera = { ...pose };
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
     * Normalize hotkey/menu option names to displayOptions keys.
     * @param {string} key
     * @returns {'showGrid'|'objectBoundaries'|'objectCollisions'|'parallax'|string}
     */
    normalizeDisplayKey(key) {
        if (key === 'grid' || key === 'showGrid') return 'showGrid';
        return key;
    }

    /**
     * Effective display flag for one view only (VP-EQ: no live global inherit).
     * @param {ViewportView} view
     * @param {'showGrid'|'objectBoundaries'|'objectCollisions'|'parallax'|'grid'} key
     * @returns {boolean}
     */
    getDisplayFlag(view, key) {
        const k = this.normalizeDisplayKey(key);
        if (!view) return this._defaultDisplayFlag(k);
        if (!view.displayOptions) {
            view.displayOptions = this._seedDisplayOptions(null);
        }
        const local = view.displayOptions[k];
        if (local === true || local === false) return local;
        // Lazily materialize missing keys so peers never couple through globals
        const seeded = this._defaultDisplayFlag(k);
        view.displayOptions[k] = seeded;
        return seeded;
    }

    /**
     * Set display flag on one view only — never writes global state (VP-EQ).
     * @param {string|ViewportView} leafIdOrView
     * @param {string} key
     * @param {boolean} value
     */
    setDisplayFlag(leafIdOrView, key, value) {
        const view = typeof leafIdOrView === 'string'
            ? this.views.get(leafIdOrView)
            : leafIdOrView;
        if (!view) return;
        const k = this.normalizeDisplayKey(key);
        if (!DISPLAY_FLAG_KEYS.has(k)) return;
        if (!view.displayOptions) view.displayOptions = this._seedDisplayOptions(null);
        view.displayOptions[k] = !!value;

        this.editor.render?.();
        refreshAllViewportChrome(this.editor);
        // Only the paired toolbar for this leaf + primary shell toolbar states
        this.editor.refreshViewportToolbars?.(view.leafId);
    }

    /**
     * Toggle effective display flag on a view (materializes override).
     * @param {string|ViewportView} leafIdOrView
     * @param {string} key
     * @returns {boolean} new value
     */
    toggleDisplayFlag(leafIdOrView, key) {
        const view = typeof leafIdOrView === 'string'
            ? this.views.get(leafIdOrView)
            : leafIdOrView;
        if (!view) return false;
        const next = !this.getDisplayFlag(view, key);
        this.setDisplayFlag(view, key, next);
        return next;
    }

    /**
     * Hit-test viewport leaves (root → measureEl → canvas) at client coordinates.
     * Prefer smaller rect when overlapping (float over dock).
     * @param {number} clientX
     * @param {number} clientY
     * @returns {ViewportView|null}
     */
    viewFromClientPoint(clientX, clientY) {
        if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
        /** @type {ViewportView|null} */
        let hit = null;
        let bestArea = Infinity;
        for (const view of this.views.values()) {
            const el = view.root || view.measureEl || view.canvas;
            if (!el?.getBoundingClientRect) continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) continue;
            const area = r.width * r.height;
            if (area < bestArea) {
                bestArea = area;
                hit = view;
            }
        }
        return hit;
    }

    /**
     * Viewport under last known mouse client pos (VP-HK), else focused/primary.
     * @param {{ fallback?: boolean }} [opts] fallback default true
     * @returns {ViewportView|null}
     */
    getViewUnderCursor(opts = {}) {
        const fallback = opts.fallback !== false;
        const mouse = this.editor.stateManager?.get('mouse');
        const hit = this.viewFromClientPoint(mouse?.x, mouse?.y);
        if (hit) return hit;
        if (!fallback) return null;
        return this.getFocusedView() || this.getAnyView();
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
        // main-canvas without dataset yet → shell leaf if any
        return this.getPrimaryView() || this.getAnyView();
    }

    destroy() {
        if (typeof this._unsubObjectProperty === 'function') {
            try { this._unsubObjectProperty(); } catch (_e) { /* */ }
            this._unsubObjectProperty = null;
        }
        [...this.views.keys()].forEach((id) => this.unregisterView(id));
        this.editor = null;
    }

    // --- internals ---

    /**
     * Defaults for seeding a new view's displayOptions (snapshot, not a live link).
     * @param {string} k
     * @returns {boolean}
     */
    _defaultDisplayFlag(k) {
        if (k === 'showGrid') {
            return this.editor?.stateManager?.get('canvas.showGrid')
                ?? this.editor?.level?.settings?.showGrid
                ?? true;
        }
        // VP-OVL: HUD on by default (not stored in global view.* prefs)
        if (k === 'infoOverlay') return true;
        return !!this.editor?.stateManager?.get(`view.${k}`);
    }

    /**
     * Full independent displayOptions object for a view.
     * @param {object|null} partial
     * @returns {{ showGrid: boolean, objectBoundaries: boolean, objectCollisions: boolean, parallax: boolean, infoOverlay: boolean }}
     */
    _seedDisplayOptions(partial) {
        const base = {
            showGrid: this._defaultDisplayFlag('showGrid'),
            objectBoundaries: this._defaultDisplayFlag('objectBoundaries'),
            objectCollisions: this._defaultDisplayFlag('objectCollisions'),
            parallax: this._defaultDisplayFlag('parallax'),
            infoOverlay: this._defaultDisplayFlag('infoOverlay')
        };
        if (partial && typeof partial === 'object') {
            for (const k of DISPLAY_FLAG_KEYS) {
                if (partial[k] === true || partial[k] === false) base[k] = partial[k];
            }
        }
        return base;
    }

    /** @deprecated use _readSavedCamera — name kept for any external callers */
    _readPrimaryCamera() {
        return this._readSavedCamera();
    }

    _readSavedCamera() {
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
