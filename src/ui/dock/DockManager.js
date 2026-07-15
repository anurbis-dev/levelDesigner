/**
 * Facade for the split-tree dock system (replaces PanelPositionManager over B0–B5).
 * B2: viewport (toolbar + canvas) mounts into leaf; B3: remaining panels.
 * Reopen closed panels via showContentType / View menu later.
 */
import { Logger } from '../../utils/Logger.js';
import { typeLabel } from './DockConstants.js';
import { DockTreeModel } from './DockTreeModel.js';
import { DockRenderer } from './DockRenderer.js';
import { DockDragController } from './DockDragController.js';
import { DockContentRegistry } from './DockContentRegistry.js';
import { DockPersistence } from './DockPersistence.js';

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
            isCloseable: (type) => this.registry.isCloseable(type),
            onStructureChange: () => this._onStructureChange()
        });

        this.drag = new DockDragController({
            model: this.model,
            renderer: this.renderer,
            render: () => this.renderer.render(),
            onStructureChange: () => this._onStructureChange()
        });
        this.renderer.setDragController(this.drag);

        this._suppressPersist = true;
        this.renderer.render();
        this._suppressPersist = false;
        this._inited = true;
        // Viewport may have just been reparented into a leaf — measure + RO reconnect.
        if (this.levelEditor?.lifecycleController?.setupViewportResizeObserver) {
            this.levelEditor.lifecycleController.setupViewportResizeObserver();
        }
        if (this.levelEditor?.updateCanvas) {
            this.levelEditor.updateCanvas();
        }
        Logger.ui.info('DockManager initialized (B2 viewport leaf host)');
    }

    _onStructureChange() {
        if (this._suppressPersist || !this._inited) return;
        this.persistence.scheduleSave(this.model.snapshot());
        // Split ratios / float move-resize rebuild — canvas size may change
        if (this.levelEditor?.updateCanvas) {
            this.levelEditor.updateCanvas();
        }
    }

    /** Snapshot for persistence / debug. */
    getLayoutSnapshot() {
        return this.model.snapshot();
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

    destroy() {
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
