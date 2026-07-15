/**
 * Facade for the split-tree dock system (replaces PanelPositionManager over B0–B5).
 * B1: singleton registry + layout persistence; real panel content mounts in B2–B3.
 */
import { Logger } from '../../utils/Logger.js';
import { TYPE_ORDER, typeLabel } from './DockConstants.js';
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
        this._chipCleanups = [];
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

        this._wireChips();
        this._wireDebugActions();
        this._suppressPersist = true;
        this.renderer.render();
        this._suppressPersist = false;
        this._updateChipVisibility();
        this._inited = true;
        Logger.ui.info('DockManager initialized (B1 singleton + persistence)');
    }

    _onStructureChange() {
        this._updateChipVisibility();
        if (this._suppressPersist || !this._inited) return;
        this.persistence.scheduleSave(this.model.snapshot());
    }

    _updateChipVisibility() {
        const present = this.model.collectPresentContentTypes();
        document.querySelectorAll('#dock-chips .chip[data-new]').forEach((chip) => {
            const type = chip.dataset.new;
            const missing = type && !present.has(type);
            chip.hidden = !missing;
            chip.style.display = missing ? '' : 'none';
        });
    }

    _wireChips() {
        const chips = document.querySelectorAll('#dock-chips .chip[data-new]');
        chips.forEach((chip) => {
            const handler = (e) => {
                const type = chip.dataset.new;
                if (!type || this.model.hasContentType(type)) return;
                this.drag.startNodeDrag(e, () => `new:${type}:${chip.dataset.label || typeLabel(type)}`, {
                    ghostLabel: chip.dataset.label || typeLabel(type),
                    onNoTargetDrop: (x, y) => {
                        if (this.model.hasContentType(type)) return;
                        const node = this.model.makeLeaf(type, chip.dataset.label || typeLabel(type));
                        this.model.floatingWindows.push(
                            this.model.makeFloatingWindow(node, x - 70, y - 14, 220, 160)
                        );
                        this.renderer.render();
                    }
                });
            };
            chip.addEventListener('pointerdown', handler);
            this._chipCleanups.push(() => chip.removeEventListener('pointerdown', handler));
        });
    }

    _wireDebugActions() {
        const resetBtn = document.getElementById('dock-reset-layout');
        if (resetBtn) {
            const onReset = () => {
                this.model.reset();
                this.renderer.render();
                this.persistence.save(this.model.snapshot());
            };
            resetBtn.addEventListener('click', onReset);
            this._chipCleanups.push(() => resetBtn.removeEventListener('click', onReset));
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

    /** Ensure contentType is present (chip reopen / View menu later). Floating if main empty zone. */
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
        this._chipCleanups.forEach((fn) => {
            try {
                fn();
            } catch (_) { /* ignore */ }
        });
        this._chipCleanups = [];
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

/** Build chip markup helpers (used if chips are generated in JS later). */
export function chipDescriptors() {
    return TYPE_ORDER.map((type) => ({
        type,
        label: typeLabel(type)
    }));
}
