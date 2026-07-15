/**
 * Pointer drag / floating drag-resize gestures for dock system.
 * Layout customization requires Shift (see DockDragGestures / isDockCustomizeKey).
 */
import { DockDropOverlay } from './DockDropOverlay.js';
import { startDockNodeDrag } from './DockNodeDrag.js';
import { startDockFloatingDrag, startDockFloatingResize } from './DockFloatingDrag.js';

export class DockDragController {
    /**
     * @param {object} opts
     * @param {import('./DockTreeModel.js').DockTreeModel} opts.model
     * @param {import('./DockRenderer.js').DockRenderer} opts.renderer
     * @param {() => void} opts.render
     * @param {() => void} [opts.onStructureChange]
     * @param {(type: string) => boolean} [opts.isSingleton]
     * @param {() => { enabled: boolean, margin: number, threshold: number }} [opts.getFloatWorkspacePrefs]
     */
    constructor(opts) {
        this.model = opts.model;
        this.renderer = opts.renderer;
        this.render = opts.render;
        this.onStructureChange = opts.onStructureChange || (() => {});
        this.isSingleton = opts.isSingleton || ((type) => type === 'viewport');
        this.getFloatWorkspacePrefs = opts.getFloatWorkspacePrefs
            || (() => ({ enabled: true, margin: 8, threshold: 16 }));
        this.overlay = new DockDropOverlay(opts.renderer, opts.model);
    }

    startRename(titleEl, currentValue, onCommit) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.value = currentValue || '';
        input.addEventListener('pointerdown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') {
                input.value = currentValue;
                input.blur();
            }
        });
        input.addEventListener('blur', () => {
            onCommit(input.value.trim());
            this.render();
        });
        titleEl.replaceWith(input);
        input.focus();
        input.select();
    }

    startNodeDrag(e, getRawPayload, opts) {
        startDockNodeDrag(this, e, getRawPayload, opts);
    }

    startFloatingDrag(e, fw, el, opts) {
        startDockFloatingDrag(this, e, fw, el, opts);
    }

    startFloatingResize(e, fw, el) {
        startDockFloatingResize(this, e, fw, el);
    }

    destroy() {
        this.overlay.destroy();
    }
}
