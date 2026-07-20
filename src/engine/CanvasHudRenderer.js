import { resolveAnchorStyle, resolveDisplayText, resolveProgressFraction } from './CanvasHudBinding.js';

/**
 * Play-mode HUD overlay: renders the level's `canvases` (Level.canvases / Scene.canvases)
 * whose id is in `scene.activeCanvasIds` (set per-tick by GameEngine._updateCamera() from
 * the active camera's CameraBehavior.getCanvasIds()). DOM layer on #play-overlay, polls
 * scene each rAF — same shape as DialoguePlayHud, kept as a separate class since HUD
 * canvases and the dialogue box are independent, always-possibly-concurrent overlays.
 */
export class CanvasHudRenderer {
    /**
     * @param {HTMLElement} overlayHost play-overlay element
     * @param {() => object|null|undefined} getScene () => GameEngine.scene
     */
    constructor(overlayHost, getScene) {
        this._host = overlayHost;
        this._getScene = getScene;
        this._rafId = null;
        this._root = null;
        /** @type {string|null} signature of last rendered state */
        this._sig = null;
        this._build();
    }

    start() {
        if (this._rafId != null) return;
        const loop = () => {
            this.sync();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() {
        if (this._rafId != null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = null;
        this._sig = null;
        if (this._root) {
            this._root.remove();
            this._root = null;
        }
    }

    /** @private */
    _build() {
        const root = document.createElement('div');
        root.className = 'canvas-hud';
        this._host.appendChild(root);
        this._root = root;
    }

    /** @private @returns {object[]} active canvas defs, in activeCanvasIds order */
    _activeCanvases(scene) {
        const ids = scene?.activeCanvasIds;
        if (!Array.isArray(ids) || !ids.length) return [];
        return ids.map((id) => scene.canvases?.get?.(id)).filter(Boolean);
    }

    sync() {
        const scene = this._getScene?.();
        const canvases = this._activeCanvases(scene);

        if (!canvases.length) {
            if (this._sig !== 'hidden') {
                this._root.innerHTML = '';
                this._sig = 'hidden';
            }
            return;
        }

        const sig = canvases
            .map((c) => `${c.id}:${(c.widgets || []).map((w) => this._widgetSig(scene, w)).join(',')}`)
            .join('|');
        if (sig === this._sig) return;
        this._sig = sig;
        this._render(scene, canvases);
    }

    /** @private */
    _widgetSig(scene, widget) {
        if (widget.type === 'progressBar') return `${widget.id}=${resolveProgressFraction(scene, widget.binding)}`;
        return `${widget.id}=${resolveDisplayText(scene, widget)}`;
    }

    /** @private */
    _render(scene, canvases) {
        const root = this._root;
        root.innerHTML = '';

        for (const canvasDef of canvases) {
            for (const widget of canvasDef.widgets || []) {
                const el = this._buildWidget(scene, widget);
                if (el) root.appendChild(el);
            }
        }
    }

    /** @private @returns {HTMLElement|null} */
    _buildWidget(scene, widget) {
        const style = resolveAnchorStyle(widget.anchor, widget.offsetX || 0, widget.offsetY || 0);
        if (widget.width != null) style.width = `${widget.width}px`;
        if (widget.height != null) style.height = `${widget.height}px`;
        Object.assign(style, widget.style || {});

        let el;
        switch (widget.type) {
            case 'button': {
                el = document.createElement('button');
                el.type = 'button';
                el.textContent = resolveDisplayText(scene, widget);
                el.addEventListener('click', () => {
                    if (widget.action?.type === 'customEvent' && widget.action.name) {
                        scene?.eventGraphRuntime?.emitCustomEvent(widget.action.name);
                    }
                });
                break;
            }
            case 'image': {
                el = document.createElement('img');
                if (widget.imgSrc) el.src = widget.imgSrc;
                break;
            }
            case 'progressBar': {
                el = document.createElement('div');
                const fill = document.createElement('div');
                fill.className = 'canvas-hud__widget-fill';
                fill.style.width = `${resolveProgressFraction(scene, widget.binding) * 100}%`;
                el.appendChild(fill);
                break;
            }
            case 'panel':
                el = document.createElement('div');
                break;
            case 'text':
            default:
                el = document.createElement('div');
                el.textContent = resolveDisplayText(scene, widget);
                break;
        }

        el.className = `${el.className ? el.className + ' ' : ''}canvas-hud__widget canvas-hud__widget--${widget.type || 'text'}`.trim();
        Object.assign(el.style, style);
        return el;
    }
}
