/**
 * Facade for the split-tree dock system (replaces PanelPositionManager over B0–B5).
 * B2–B4: real content leaves; multi-instance panel copies; reopen via showContentType / View.
 */
import { Logger } from '../../utils/Logger.js';
import { typeLabel } from './DockConstants.js';
import { DockTreeModel } from './DockTreeModel.js';
import { DockRenderer } from './DockRenderer.js';
import { DockDragController } from './DockDragController.js';
import { DockContentRegistry } from './DockContentRegistry.js';
import { DockPersistence } from './DockPersistence.js';
import {
    readFloatWorkspacePrefs,
    applyFloatingWorkspaceResize
} from './DockFloatWorkspace.js';
import { bindDockCustomizeModeClass } from './DockDragKeyWatch.js';
import { ASSET_EDITOR_ROLE, getEditingAsset } from '../asset-editor/AssetEditorContext.js';
import { buildDefaultAssetEditorTree } from '../asset-editor/defaultAssetEditorTree.js';

export class DockManager {
    /**
     * @param {object} levelEditor
     */
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.model = new DockTreeModel();
        this.registry = new DockContentRegistry(levelEditor);
        this.persistence = new DockPersistence(levelEditor);
        this.renderer = null;
        this.drag = null;
        this._inited = false;
        this._suppressPersist = false;
        /** @type {{ mainTree: object|null, floatingWindows: object[] }|null} */
        this._immersiveSnapshot = null;
        /** @type {{ w: number, h: number }} */
        this._wsSize = { w: 0, h: 0 };
        /** @type {ResizeObserver|null} */
        this._wsRo = null;
        /** @type {(() => void)|null} DK-CUR Shift → body.dock-customize */
        this._unbindCustomizeMode = null;
    }

    /**
     * Mount dock into #dock-workspace / #split-root / #floating-layer; restore layout if any.
     */
    init() {
        if (this._inited) return;

        const workspaceEl = document.getElementById('dock-workspace');
        const splitRoot = document.getElementById('split-root');
        const floatingLayer = document.getElementById('floating-layer');
        if (!workspaceEl || !splitRoot || !floatingLayer) {
            Logger.ui.warn('DockManager: dock shell DOM missing — skip init');
            return;
        }

        const saved = this.persistence.load();
        if (saved) {
            this.model.restoreFromSnapshot(saved);
            Logger.ui.info('DockManager: restored layout from panels.dock.*');
        } else {
            this.model.reset();
        }

        this.renderer = new DockRenderer({
            model: this.model,
            registry: this.registry,
            splitRoot,
            floatingLayer,
            workspaceEl,
            mountLeafContent: (ws, node, body) => this.registry.mountLeafContent(ws, node, body),
            isCloseable: (type, leafId) => this.registry.isLeafCloseable
                ? this.registry.isLeafCloseable(type, leafId)
                : this.registry.isCloseable(type),
            onStructureChange: () => this._onStructureChange()
        });

        this.drag = new DockDragController({
            model: this.model,
            renderer: this.renderer,
            render: () => this.renderer.render(),
            onStructureChange: () => this._onStructureChange(),
            isSingleton: (type) => this.registry.isSingleton(type),
            getFloatWorkspacePrefs: () => this._floatWorkspacePrefs()
        });
        this.renderer.setDragController(this.drag);
        // DK-CUR: leaf header gap cursor grab only while Shift held.
        this._unbindCustomizeMode = bindDockCustomizeModeClass(document.body);

        this._suppressPersist = true;
        this.renderer.render();
        this._suppressPersist = false;
        this._inited = true;
        this._captureWorkspaceSize();
        this._wsRo = new ResizeObserver(() => this._onWorkspaceResize());
        this._wsRo.observe(workspaceEl);
        // Viewport may have just been reparented into a leaf — measure + RO reconnect.
        if (this.levelEditor?.lifecycleController?.setupViewportResizeObserver) {
            this.levelEditor.lifecycleController.setupViewportResizeObserver();
        }
        if (this.levelEditor?.updateCanvas) {
            this.levelEditor.updateCanvas();
        }
        Logger.ui.info('DockManager initialized (B4 multi-instance panels)');
    }

    _configManager() {
        const ed = this.levelEditor;
        if (!ed) return null;
        return ed.configManager || ed.userPrefs?.configManager || null;
    }

    _floatWorkspacePrefs() {
        return readFloatWorkspacePrefs(this._configManager());
    }

    _captureWorkspaceSize() {
        if (!this.renderer?.workspaceEl) return;
        const r = this.renderer.workspaceRect();
        this._wsSize = { w: r.width, h: r.height };
    }

    /**
     * Browser / shell resize: keep floating clusters at relative position;
     * with edge-snap on, re-pin clusters that were on an edge (margin).
     */
    _onWorkspaceResize() {
        if (!this._inited || !this.renderer || this._immersiveSnapshot) return;
        const r = this.renderer.workspaceRect();
        const newW = r.width;
        const newH = r.height;
        const oldW = this._wsSize.w;
        const oldH = this._wsSize.h;
        if (!(oldW > 0) || !(oldH > 0)) {
            this._wsSize = { w: newW, h: newH };
            return;
        }
        if (Math.abs(newW - oldW) < 0.5 && Math.abs(newH - oldH) < 0.5) return;

        const prefs = this._floatWorkspacePrefs();
        const changed = applyFloatingWorkspaceResize(
            this.model.floatingWindows,
            oldW,
            oldH,
            newW,
            newH,
            prefs,
            (f) => this.renderer.effectiveHeight(f)
        );
        this._wsSize = { w: newW, h: newH };
        if (!changed) return;

        this.model.floatingWindows.forEach((f) => this.renderer.syncFloatingDom(f));
        if (!this._suppressPersist) {
            this.persistence.scheduleSave(this.model.snapshot());
        }
    }

    _onStructureChange() {
        if (this._suppressPersist || !this._inited) return;
        this.persistence.scheduleSave(this.model.snapshot());
        // Split ratios / float move-resize rebuild — canvas size may change
        if (this.levelEditor?.updateCanvas) {
            this.levelEditor.updateCanvas();
        }
        // B3.1: keep View → Panels checkmarks aligned with tree presence
        this.levelEditor?.eventHandlers?.syncDockPanelMenuCheckboxes?.();
        // Asset editor float closed → clear editing context
        if (!this.findAssetEditorFloat()) {
            const sm = this.levelEditor?.stateManager;
            if (sm?.get('editingAssetId')) {
                sm.set('editingAssetId', null);
                sm.set('editingComponentId', null);
            }
        }
    }

    /**
     * @returns {object|null} floating window with role=assetEditor
     */
    findAssetEditorFloat() {
        return (this.model.floatingWindows || []).find((f) => f.role === ASSET_EDITOR_ROLE) || null;
    }

    /**
     * Open or focus the asset-editor floating workspace (split tree of asset* panels).
     * @param {{ x?: number, y?: number, w?: number, h?: number, title?: string }} [opts]
     * @returns {object|null} floating window
     */
    openAssetEditorWorkspace(opts = {}) {
        if (!this._inited) return null;
        let fw = this.findAssetEditorFloat();
        if (fw) {
            this.model.bumpZ(fw);
            if (opts.title) fw.customName = opts.title;
            this.renderer.render();
            return fw;
        }
        const tree = buildDefaultAssetEditorTree(this.model);
        fw = this.model.makeFloatingWindow(
            tree,
            opts.x ?? 96,
            opts.y ?? 72,
            opts.w ?? 720,
            opts.h ?? 480
        );
        fw.role = ASSET_EDITOR_ROLE;
        fw.customName = opts.title || 'Asset Editor';
        this.model.floatingWindows.push(fw);
        this.renderer.render();
        return fw;
    }

    /** Update float chrome title from current editing asset. */
    syncAssetEditorTitle() {
        const fw = this.findAssetEditorFloat();
        if (!fw) return;
        const asset = getEditingAsset(this.levelEditor);
        const next = asset ? `Asset: ${asset.name || asset.id}` : 'Asset Editor';
        if (fw.customName === next) return;
        fw.customName = next;
        const el = this.renderer?.floatingLayer?.querySelector(
            `.floating-window[data-float-id="${fw.id}"] .title`
        );
        if (el) el.textContent = next;
        else if (this.renderer) this.renderer.render();
    }

    /**
     * Close asset-editor float if present.
     * @returns {boolean}
     */
    closeAssetEditorWorkspace() {
        if (!this._inited) return false;
        const fw = this.findAssetEditorFloat();
        if (!fw) return false;
        this.model.detachAttachLinks?.(fw);
        this.model.floatingWindows = this.model.floatingWindows.filter((w) => w.id !== fw.id);
        this.renderer.render();
        return true;
    }

    /** Snapshot for persistence / debug. */
    getLayoutSnapshot() {
        return this.model.snapshot();
    }

    /** Whether any leaf of this contentType is present (main or floating). */
    hasContentType(contentType) {
        return !!(this._inited && this.model.hasContentType(contentType));
    }

    resetLayout() {
        if (!this._inited) return;
        this.model.reset();
        this.renderer.render();
        this.persistence.save(this.model.snapshot());
    }

    /** Reopen a closed singleton panel (View menu / API). Floating if main already has a tree. */
    showContentType(contentType, opts = {}) {
        if (!this._inited) return null;
        if (this.model.hasContentType(contentType)) {
            return this.model.findLeafByContentType(contentType);
        }
        const node = this.model.makeLeaf(contentType, typeLabel(contentType));
        if (!this.model.mainTree) {
            this.model.mainTree = node;
        } else {
            const x = opts.x ?? 80;
            const y = opts.y ?? 80;
            this.model.floatingWindows.push(
                this.model.makeFloatingWindow(node, x, y, opts.w ?? 280, opts.h ?? 200)
            );
        }
        this.renderer.render();
        return node;
    }

    /**
     * Hide primary (any) leaf of contentType — View menu / API.
     * Allows hiding non-closeable viewport (X button still blocked); content parks in pool.
     * @returns {boolean} true if a leaf was removed
     */
    hideContentType(contentType) {
        if (!this._inited) return false;
        const leaf = this.model.findLeafByContentType(contentType);
        if (!leaf) return false;
        const ws = this.model.findWorkspaceContaining(leaf.id);
        if (!ws) return false;
        this.model.setTreeOf(ws, this.model.removeLeaf(this.model.getTreeOf(ws), leaf.id));
        this.renderer.render();
        return true;
    }

    /**
     * Toggle leaf presence for contentType.
     * @returns {boolean} true if type is present after toggle
     */
    toggleContentType(contentType) {
        if (!this._inited) return false;
        if (this.model.hasContentType(contentType)) {
            this.hideContentType(contentType);
            return false;
        }
        this.showContentType(contentType);
        return true;
    }

    /**
     * Game/Immersive Mode: park layout snapshot and show only viewport (canvas stays live).
     * Does not destroy panel state; other roots park in content pool.
     */
    enterImmersiveLayout() {
        if (!this._inited || this._immersiveSnapshot) return;
        this._immersiveSnapshot = JSON.parse(JSON.stringify(this.model.snapshot()));
        const leaf = this.model.findLeafByContentType('viewport');
        if (leaf) {
            const ws = this.model.findWorkspaceContaining(leaf.id);
            if (ws) {
                this.model.setTreeOf(ws, this.model.removeLeaf(this.model.getTreeOf(ws), leaf.id));
            }
            this.model.mainTree = leaf;
            this.model.floatingWindows = [];
        } else {
            this.model.mainTree = null;
            this.model.floatingWindows = [];
        }
        this._suppressPersist = true;
        this.renderer.render();
        this._suppressPersist = false;
    }

    /** Restore dock tree saved by enterImmersiveLayout. */
    exitImmersiveLayout() {
        if (!this._inited || !this._immersiveSnapshot) return;
        this.model.restoreFromSnapshot(this._immersiveSnapshot);
        this._immersiveSnapshot = null;
        this._suppressPersist = true;
        this.renderer.render();
        this._suppressPersist = false;
        this.persistence.scheduleSave(this.model.snapshot());
        this.levelEditor?.eventHandlers?.syncDockPanelMenuCheckboxes?.();
        if (this.levelEditor?.updateCanvas) {
            this.levelEditor.updateCanvas();
        }
    }

    destroy() {
        if (this._wsRo) {
            this._wsRo.disconnect();
            this._wsRo = null;
        }
        if (this._unbindCustomizeMode) {
            this._unbindCustomizeMode();
            this._unbindCustomizeMode = null;
        }
        if (this._inited) {
            this.persistence.flush(this.model.snapshot());
        }
        if (this.drag) this.drag.destroy();
        if (this.renderer) this.renderer.destroy();
        if (this.registry) this.registry.destroy();
        if (this.persistence) this.persistence.destroy();
        this.drag = null;
        this.renderer = null;
        this._inited = false;
        this.levelEditor = null;
        Logger.ui.info('DockManager destroyed');
    }
}
