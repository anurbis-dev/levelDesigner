/**
 * contentType → mount adapter + singleton metadata (Phase B).
 * B2: real viewport (toolbar + canvas measure); B3: remaining panels.
 */
import { TYPE_META, TYPE_ORDER, typeLabel, typeColor } from './DockConstants.js';

export class DockContentRegistry {
    /**
     * @param {object} [levelEditor]
     */
    constructor(levelEditor = null) {
        this.levelEditor = levelEditor;
        /** @type {Map<string, object>} */
        this._entries = new Map();
        /** @type {Map<string, HTMLElement>} contentType → stable root (singleton pool by type) */
        this._rootsByType = new Map();
        this._viewportResizeScheduled = false;

        TYPE_ORDER.forEach((type) => {
            this.register(type, {
                label: typeLabel(type),
                color: typeColor(type),
                singleton: true,
                closeable: type !== 'viewport',
                mount: type === 'viewport' ? this._mountViewport.bind(this) : null
            });
        });
    }

    /**
     * @param {string} contentType
     * @param {{ label?: string, color?: string, singleton?: boolean, closeable?: boolean, mount?: Function|null }} def
     */
    register(contentType, def = {}) {
        const meta = TYPE_META[contentType] || {};
        this._entries.set(contentType, {
            contentType,
            label: def.label || meta.label || contentType,
            color: def.color || meta.color || '#333',
            singleton: def.singleton !== false,
            closeable: def.closeable !== undefined ? def.closeable : contentType !== 'viewport',
            mount: typeof def.mount === 'function' ? def.mount : null
        });
    }

    get(contentType) {
        return this._entries.get(contentType) || null;
    }

    isSingleton(contentType) {
        const e = this.get(contentType);
        return e ? e.singleton : false;
    }

    isCloseable(contentType) {
        const e = this.get(contentType);
        return e ? e.closeable !== false : true;
    }

    /**
     * Mount leaf body content. Reparents stable root by contentType (singleton) or node.id.
     * @param {string} workspaceId
     * @param {object} node - leaf node
     * @param {HTMLElement} bodyEl
     */
    mountLeafContent(workspaceId, node, bodyEl) {
        const entry = this.get(node.contentType);
        if (entry && entry.mount) {
            entry.mount(workspaceId, node, bodyEl, this);
            return;
        }
        this._placeholderMount(node, bodyEl, entry);
    }

    /**
     * Viewport leaf: toolbar + canvas-viewport measure host with canvas inside (no full-screen absolute).
     */
    _mountViewport(_workspaceId, node, bodyEl) {
        let root = this._rootsByType.get('viewport');
        if (!root) {
            root = this._ensureViewportRoot();
            this._rootsByType.set('viewport', root);
        }
        root.dataset.leafId = node.id;
        root.dataset.contentType = 'viewport';
        if (root.parentElement !== bodyEl) {
            bodyEl.appendChild(root);
        }
        this._scheduleViewportResize();
    }

    _ensureViewportRoot() {
        const mainWorkspace = document.getElementById('main-workspace');
        const mainPanel = document.getElementById('main-panel');
        const toolbar = document.getElementById('toolbar-container');
        const viewport = document.getElementById('canvas-viewport');
        const canvasContainer = document.getElementById('canvas-container');

        if (!mainPanel || !toolbar || !viewport) {
            // Fallback placeholder if shell DOM is incomplete
            const fallback = document.createElement('div');
            fallback.className = 'dock-placeholder dock-viewport-root';
            fallback.dataset.contentType = 'viewport';
            fallback.textContent = 'Viewport';
            return fallback;
        }

        // Nest canvas under measure host so it moves with the leaf (floating + splits).
        if (canvasContainer && canvasContainer.parentElement !== viewport) {
            viewport.appendChild(canvasContainer);
        }

        // Prefer main-workspace as stable root; else wrap main-panel.
        const root = mainWorkspace || mainPanel;
        root.classList.add('dock-viewport-root');
        root.dataset.contentType = 'viewport';

        // Ensure panel children stay under main-panel if we reparented only workspace
        if (mainWorkspace && mainPanel.parentElement !== mainWorkspace) {
            mainWorkspace.appendChild(mainPanel);
        }
        if (toolbar.parentElement !== mainPanel) {
            mainPanel.insertBefore(toolbar, mainPanel.firstChild);
        }
        if (viewport.parentElement !== mainPanel) {
            mainPanel.appendChild(viewport);
        }

        return root;
    }

    _scheduleViewportResize() {
        if (this._viewportResizeScheduled) return;
        this._viewportResizeScheduled = true;
        requestAnimationFrame(() => {
            this._viewportResizeScheduled = false;
            const editor = this.levelEditor;
            if (editor && typeof editor.updateCanvas === 'function') {
                editor.updateCanvas();
            } else if (editor?.canvasRenderer) {
                editor.canvasRenderer.resizeCanvas();
            }
        });
    }

    _placeholderMount(node, bodyEl, entry) {
        const key = entry && entry.singleton ? node.contentType : node.id;
        let root = this._rootsByType.get(key);
        if (!root) {
            root = document.createElement('div');
            root.className = 'dock-placeholder';
            root.dataset.contentType = node.contentType;
            this._rootsByType.set(key, root);
        }
        root.dataset.leafId = node.id;
        root.style.background = (entry && entry.color) || typeColor(node.contentType);
        root.textContent = (entry && entry.label) || node.contentType;
        if (root.parentElement !== bodyEl) {
            bodyEl.appendChild(root);
        }
    }

    /** Park singleton roots into a pool element (used by renderer before chrome rebuild). */
    parkRoots(poolEl) {
        this._rootsByType.forEach((root) => {
            if (poolEl && root.parentElement !== poolEl) {
                poolEl.appendChild(root);
            }
        });
    }

    destroy() {
        this._rootsByType.forEach((root) => {
            if (root.parentElement) root.remove();
        });
        this._rootsByType.clear();
        this._entries.clear();
        this.levelEditor = null;
    }
}
