/**
 * contentType → mount adapter + singleton/multi-instance metadata (Phase B4).
 * Primary roots: fixed DOM from initializeUIComponents.
 * Copies: factory instances keyed by leaf node.id.
 */
import {
    TYPE_META,
    TYPE_ORDER,
    typeLabel,
    typeColor,
    isAssetEditorType,
    isFactoryOnlyLevelType
} from './DockConstants.js';
import {
    isMultiInstanceType,
    createPanelCopy,
    destroyPanelCopy
} from './DockPanelFactory.js';
import { Logger } from '../../utils/Logger.js';

/** contentType → legacy primary panel root id (index.html / initializeUIComponents). */
const PANEL_ROOT_IDS = {
    outliner: 'outliner-content-panel',
    details: 'details-content-panel',
    layers: 'layers-content-panel',
    levels: 'levels-content-panel',
    assets: 'assets-panel'
};

/** contentType → editor property holding primary panel instance. */
const PRIMARY_PANEL_KEYS = {
    outliner: 'outlinerPanel',
    details: 'detailsPanel',
    layers: 'layersPanel',
    levels: 'levelsPanel',
    assets: 'assetPanel'
};

export class DockContentRegistry {
    /**
     * @param {object} [levelEditor]
     */
    constructor(levelEditor = null) {
        this.levelEditor = levelEditor;
        /** @type {Map<string, object>} */
        this._entries = new Map();
        /** @type {Map<string, HTMLElement>} primary/singleton roots by contentType */
        this._rootsByType = new Map();
        /**
         * Live leaf bindings: leafId → { contentType, isPrimary, root, panel }
         * @type {Map<string, { contentType: string, isPrimary: boolean, root: HTMLElement, panel: object|null }>}
         */
        this._byLeafId = new Map();
        /** @type {Map<string, string>} contentType → primary leaf id */
        this._primaryLeafIdByType = new Map();
        this._viewportResizeScheduled = false;

        TYPE_ORDER.forEach((type) => {
            let mount = null;
            if (type === 'viewport') {
                mount = this._mountViewport.bind(this);
            } else if (PANEL_ROOT_IDS[type] || isAssetEditorType(type) || isFactoryOnlyLevelType(type)) {
                // Level panels (fixed primary DOM) + factory-only panels (asset editor / eventGraph)
                mount = this._mountPanelLeaf.bind(this, type);
            }
            this.register(type, {
                label: typeLabel(type),
                color: typeColor(type),
                singleton: !isMultiInstanceType(type),
                // Primary viewport non-closeable; copies closeable (checked per-leaf in renderer)
                closeable: type !== 'viewport',
                mount
            });
        });
    }

    /**
     * Closeable: any viewport leaf when ≥2 exist (VP-EQ — shell is not privileged).
     * Sole remaining viewport stays non-closeable.
     * @param {string} contentType
     * @param {string} [leafId]
     */
    isLeafCloseable(contentType, leafId) {
        if (contentType !== 'viewport') return this.isCloseable(contentType);
        if (!leafId) return false;
        const model = this.levelEditor?.dockManager?.model;
        if (model && typeof model.countLeavesByType === 'function') {
            return model.countLeavesByType('viewport') > 1;
        }
        // Fallback without model: count live viewport bindings
        let n = 0;
        for (const b of this._byLeafId.values()) {
            if (b.contentType === 'viewport') n += 1;
        }
        return n > 1;
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

    /** Primary leaf id for type, if claimed. */
    getPrimaryLeafId(contentType) {
        return this._primaryLeafIdByType.get(contentType) || null;
    }

    /**
     * Mount leaf body content.
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
     * After render: drop bindings for leaf ids no longer in the tree.
     * Primary → park root (keep editor panel). Copy → destroy instance.
     * @param {Iterable<string>} liveLeafIds
     */
    reconcileLiveLeaves(liveLeafIds) {
        const live = liveLeafIds instanceof Set ? liveLeafIds : new Set(liveLeafIds);
        const stale = [];
        this._byLeafId.forEach((_binding, leafId) => {
            if (!live.has(leafId)) stale.push(leafId);
        });
        stale.forEach((leafId) => this._releaseLeaf(leafId));
    }

    /**
     * Viewport leaf: primary = toolbar+main canvas; copies = extra canvas views (B4.2).
     */
    _mountViewport(_workspaceId, node, bodyEl) {
        const primaryId = this._primaryLeafIdByType.get('viewport');
        const primaryAlive = primaryId && this._byLeafId.has(primaryId)
            && this._byLeafId.get(primaryId).isPrimary;

        const existing = this._byLeafId.get(node.id);
        /** @type {{ localCamera?: object, displayOptions?: object, typeFilters?: Set<string>, source?: object }|null} */
        let promoteCarry = null;
        if (existing && existing.contentType === 'viewport' && existing.root) {
            // Promote former copy to shell when shell leaf was closed (VP-EQ: keep pose/display)
            if (!primaryAlive && !existing.isPrimary) {
                const prevView = this.levelEditor?.viewportViewManager?.getView(node.id);
                if (prevView) {
                    promoteCarry = {
                        localCamera: prevView.localCamera ? { ...prevView.localCamera } : null,
                        displayOptions: prevView.displayOptions
                            ? { ...prevView.displayOptions }
                            : null,
                        typeFilters: prevView.typeFilters
                            ? new Set(prevView.typeFilters)
                            : null,
                        source: prevView.source ? { ...prevView.source } : null
                    };
                }
                destroyPanelCopy(existing);
                this._byLeafId.delete(node.id);
                // fall through to claim primary shell
            } else {
                this._attachRoot(existing.root, bodyEl, 'viewport', node.id);
                if (existing.isPrimary) this._ensurePrimaryViewportView(node, existing.root);
                this._scheduleViewportResize();
                return;
            }
        }

        const stillPrimaryAlive = this._primaryLeafIdByType.get('viewport')
            && this._byLeafId.has(this._primaryLeafIdByType.get('viewport'))
            && this._byLeafId.get(this._primaryLeafIdByType.get('viewport')).isPrimary;

        if (!stillPrimaryAlive || this._primaryLeafIdByType.get('viewport') === node.id) {
            let root = this._rootsByType.get('viewport');
            if (!root) {
                root = this._ensureViewportRoot();
                this._rootsByType.set('viewport', root);
            }
            this._primaryLeafIdByType.set('viewport', node.id);
            this._byLeafId.set(node.id, {
                contentType: 'viewport',
                isPrimary: true,
                root,
                panel: null
            });
            this._attachRoot(root, bodyEl, 'viewport', node.id);
            this._ensurePrimaryViewportView(node, root, promoteCarry);
            this._scheduleViewportResize();
            return;
        }

        // Secondary viewport copy
        const created = createPanelCopy('viewport', node.id, this.levelEditor);
        if (!created) {
            this._placeholderMount(node, bodyEl, this.get('viewport'));
            return;
        }
        this._byLeafId.set(node.id, {
            contentType: 'viewport',
            isPrimary: false,
            root: created.root,
            panel: created.panel
        });
        this._attachRoot(created.root, bodyEl, 'viewport', node.id);
        this._scheduleViewportResize();
    }

    /**
     * Register shell viewport with ViewportViewManager (idempotent / rebind leaf id).
     * @param {object} node
     * @param {HTMLElement} root
     * @param {{ localCamera?: object, displayOptions?: object, typeFilters?: Set, source?: object }|null} [carry]
     */
    _ensurePrimaryViewportView(node, root, carry = null) {
        const vvm = this.levelEditor?.viewportViewManager;
        if (!vvm) return;

        const canvas = document.getElementById('main-canvas')
            || root?.querySelector?.('canvas')
            || this.levelEditor.canvasRenderer?.primaryCanvas
            || this.levelEditor.canvasRenderer?.canvas;
        const measure = document.getElementById('canvas-viewport')
            || root?.querySelector?.('#canvas-viewport, .canvas-viewport, .dock-viewport-measure');
        if (!canvas || !measure) {
            Logger.ui.warn('DockContentRegistry: primary viewport canvas/measure missing');
            return;
        }

        // Drop stale shell registration under a different leaf id
        const prevPrimary = vvm.getPrimaryView();
        if (prevPrimary && prevPrimary.leafId !== node.id) {
            vvm.unregisterView(prevPrimary.leafId);
        }

        if (this.levelEditor.canvasRenderer) {
            this.levelEditor.canvasRenderer.primaryCanvas = canvas;
            this.levelEditor.canvasRenderer.setTarget(canvas);
        }

        const existing = vvm.getView(node.id);
        // Re-register (registerView replaces same leafId); carry preserves promote state
        vvm.registerView({
            leafId: node.id,
            isPrimary: true,
            root: root || measure,
            measureEl: measure,
            canvas,
            source: carry?.source || existing?.source || { kind: 'work' },
            localCamera: carry?.localCamera || existing?.localCamera || undefined,
            typeFilters: carry?.typeFilters || existing?.typeFilters || new Set(),
            displayOptions: carry?.displayOptions || existing?.displayOptions || undefined
        });
    }

    /**
     * Multi or primary panel leaf mount.
     * @param {string} contentType
     */
    _mountPanelLeaf(contentType, _workspaceId, node, bodyEl) {
        const existing = this._byLeafId.get(node.id);
        if (existing && existing.contentType !== contentType) {
            this._releaseLeaf(node.id);
        }

        const rebound = this._byLeafId.get(node.id);
        if (rebound && rebound.contentType === contentType && rebound.root) {
            this._attachRoot(rebound.root, bodyEl, contentType, node.id);
            return;
        }

        // Factory-only panels have no fixed primary DOM — always factory instances.
        if (isAssetEditorType(contentType) || isFactoryOnlyLevelType(contentType)) {
            this._mountCopyPanel(contentType, node, bodyEl);
            return;
        }

        const primaryId = this._primaryLeafIdByType.get(contentType);
        const primaryAlive = primaryId && this._byLeafId.has(primaryId)
            && this._byLeafId.get(primaryId).isPrimary;

        // Claim primary if free or this leaf already owns it
        if (!primaryAlive || primaryId === node.id) {
            this._mountPrimaryPanel(contentType, node, bodyEl);
            return;
        }

        // Secondary copy
        if (!isMultiInstanceType(contentType)) {
            // Singleton last-wins: reparent primary root to this leaf
            this._primaryLeafIdByType.set(contentType, node.id);
            this._mountPrimaryPanel(contentType, node, bodyEl);
            return;
        }

        this._mountCopyPanel(contentType, node, bodyEl);
    }

    /**
     * @param {string} contentType
     * @param {object} node
     * @param {HTMLElement} bodyEl
     */
    _mountPrimaryPanel(contentType, node, bodyEl) {
        let root = this._rootsByType.get(contentType);
        if (!root) {
            root = this._ensurePrimaryPanelRoot(contentType);
            if (!root) {
                this._placeholderMount(node, bodyEl, this.get(contentType));
                return;
            }
            this._rootsByType.set(contentType, root);
        }

        const panelKey = PRIMARY_PANEL_KEYS[contentType];
        const panel = (panelKey && this.levelEditor) ? (this.levelEditor[panelKey] || null) : null;

        this._primaryLeafIdByType.set(contentType, node.id);
        this._byLeafId.set(node.id, {
            contentType,
            isPrimary: true,
            root,
            panel
        });
        this._attachRoot(root, bodyEl, contentType, node.id);
    }

    /**
     * @param {string} contentType
     * @param {object} node
     * @param {HTMLElement} bodyEl
     */
    _mountCopyPanel(contentType, node, bodyEl) {
        const created = createPanelCopy(contentType, node.id, this.levelEditor);
        if (!created) {
            this._placeholderMount(node, bodyEl, this.get(contentType));
            return;
        }
        this._byLeafId.set(node.id, {
            contentType,
            isPrimary: false,
            root: created.root,
            panel: created.panel
        });
        this._attachRoot(created.root, bodyEl, contentType, node.id);
    }

    /**
     * @param {HTMLElement} root
     * @param {HTMLElement} bodyEl
     * @param {string} contentType
     * @param {string} leafId
     */
    _attachRoot(root, bodyEl, contentType, leafId) {
        root.dataset.leafId = leafId;
        root.dataset.contentType = contentType;
        root.classList.add('dock-panel-root');
        if (contentType === 'assets') {
            root.style.height = '';
            root.style.flexShrink = '';
            root.style.display = 'flex';
        } else if (root.style.display === 'none') {
            root.style.display = '';
        }
        if (root.parentElement !== bodyEl) {
            bodyEl.appendChild(root);
        }
    }

    /**
     * @param {string} contentType
     * @returns {HTMLElement|null}
     */
    _ensurePrimaryPanelRoot(contentType) {
        const id = PANEL_ROOT_IDS[contentType];
        if (!id) return null;
        const el = document.getElementById(id);
        if (!el) return null;
        el.classList.add('dock-panel-root');
        el.dataset.contentType = contentType;
        return el;
    }

    _ensureViewportRoot() {
        const mainWorkspace = document.getElementById('main-workspace');
        const mainPanel = document.getElementById('main-panel');
        const toolbar = document.getElementById('toolbar-container');
        const viewport = document.getElementById('canvas-viewport');
        const canvasContainer = document.getElementById('canvas-container');

        if (!mainPanel || !toolbar || !viewport) {
            const fallback = document.createElement('div');
            fallback.className = 'dock-placeholder dock-viewport-root';
            fallback.dataset.contentType = 'viewport';
            fallback.textContent = 'Viewport';
            return fallback;
        }

        if (canvasContainer && canvasContainer.parentElement !== viewport) {
            viewport.appendChild(canvasContainer);
        }

        const root = mainWorkspace || mainPanel;
        root.classList.add('dock-viewport-root');
        root.dataset.contentType = 'viewport';

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
        this._byLeafId.set(node.id, {
            contentType: node.contentType,
            isPrimary: !!entry?.singleton,
            root,
            panel: null
        });
    }

    /**
     * @param {string} leafId
     */
    _releaseLeaf(leafId) {
        const binding = this._byLeafId.get(leafId);
        if (!binding) return;
        this._byLeafId.delete(leafId);

        if (binding.isPrimary) {
            if (this._primaryLeafIdByType.get(binding.contentType) === leafId) {
                this._primaryLeafIdByType.delete(binding.contentType);
            }
            // Primary viewport: keep shell; drop view registration for this leaf id
            if (binding.contentType === 'viewport') {
                this.levelEditor?.viewportViewManager?.unregisterView(leafId);
            }
            // Primary root stays in pool / offtree for reopen — do not destroy panel
            return;
        }

        destroyPanelCopy(binding);
    }

    /** Park all known roots into pool (renderer rebuild). */
    parkRoots(poolEl) {
        if (!poolEl) return;
        this._byLeafId.forEach((binding) => {
            if (binding.root && binding.root.parentElement !== poolEl) {
                poolEl.appendChild(binding.root);
            }
        });
        this._rootsByType.forEach((root) => {
            if (root.parentElement !== poolEl) {
                poolEl.appendChild(root);
            }
        });
    }

    destroy() {
        const leafIds = [...this._byLeafId.keys()];
        leafIds.forEach((id) => {
            const b = this._byLeafId.get(id);
            if (b && !b.isPrimary) destroyPanelCopy(b);
        });
        this._byLeafId.clear();
        this._primaryLeafIdByType.clear();
        this._rootsByType.clear();
        this._entries.clear();
        this.levelEditor = null;
    }
}
