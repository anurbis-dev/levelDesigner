/**
 * Facade for the split-tree dock system (replaces PanelPositionManager over B0–B5).
 * B0: placeholders only; real panel content mounts in B2–B3.
 */
import { Logger } from '../../utils/Logger.js';
import { TYPE_ORDER, typeLabel } from './DockConstants.js';
import { DockTreeModel } from './DockTreeModel.js';
import { DockRenderer } from './DockRenderer.js';
import { DockDragController } from './DockDragController.js';

export class DockManager {
    /**
     * @param {object} levelEditor
     */
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.model = new DockTreeModel();
        this.renderer = null;
        this.drag = null;
        this._inited = false;
        this._chipCleanups = [];
    }

    /**
     * Mount dock into #dock-workspace / #split-root / #floating-layer and render default tree.
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

        this.model.reset();

        this.renderer = new DockRenderer({
            model: this.model,
            splitRoot,
            floatingLayer,
            workspaceEl,
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
        this.renderer.render();
        this._inited = true;
        Logger.ui.info('DockManager initialized (B0 placeholders)');
    }

    _onStructureChange() {
        // B1: DockPersistence.save — no-op in B0
    }

    _wireChips() {
        const chips = document.querySelectorAll('#dock-chips .chip[data-new]');
        chips.forEach((chip) => {
            const handler = (e) => {
                this.drag.startNodeDrag(e, () => `new:${chip.dataset.new}:${chip.dataset.label}`, {
                    ghostLabel: chip.dataset.label,
                    onNoTargetDrop: (x, y) => {
                        const node = this.model.makeLeaf(chip.dataset.new, chip.dataset.label);
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
            };
            resetBtn.addEventListener('click', onReset);
            this._chipCleanups.push(() => resetBtn.removeEventListener('click', onReset));
        }
    }

    /** Snapshot for B1 persistence / debug. */
    getLayoutSnapshot() {
        return this.model.snapshot();
    }

    resetLayout() {
        if (!this._inited) return;
        this.model.reset();
        this.renderer.render();
    }

    destroy() {
        this._chipCleanups.forEach((fn) => {
            try {
                fn();
            } catch (_) { /* ignore */ }
        });
        this._chipCleanups = [];
        if (this.drag) this.drag.destroy();
        if (this.renderer) this.renderer.destroy();
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
