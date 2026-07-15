/**
 * Pointer drag / floating drag-resize gestures for dock system.
 */
import {
    HOLD_MS,
    DOUBLE_TAP_MS,
    TAP_DELAY_MS,
    FLOAT_MIN_W,
    FLOAT_MIN_H,
    isDockCustomizeKey
} from './DockConstants.js';
import { DockDropOverlay } from './DockDropOverlay.js';

export class DockDragController {
    /**
     * @param {object} opts
     * @param {import('./DockTreeModel.js').DockTreeModel} opts.model
     * @param {import('./DockRenderer.js').DockRenderer} opts.renderer
     * @param {() => void} opts.render
     * @param {() => void} [opts.onStructureChange]
     * @param {(type: string) => boolean} [opts.isSingleton]
     */
    constructor(opts) {
        this.model = opts.model;
        this.renderer = opts.renderer;
        this.render = opts.render;
        this.onStructureChange = opts.onStructureChange || (() => {});
        this.isSingleton = opts.isSingleton || ((type) => type === 'viewport');
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
        e.preventDefault();
        const captureEl = e.currentTarget;
        const pointerId = e.pointerId;
        captureEl.setPointerCapture(pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        let moved = false;
        let target = null;
        let ghost = null;
        let holdFired = false;

        const clearHold = () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };
        const endGesture = () => {
            clearHold();
            try {
                captureEl.releasePointerCapture(pointerId);
            } catch (_) { /* ignore */ }
            captureEl.removeEventListener('pointermove', onMove);
            captureEl.removeEventListener('pointerup', onUp);
            this.overlay.hideDockOverlay();
            if (ghost) {
                ghost.remove();
                ghost = null;
            }
        };
        let holdTimer = opts.onHold
            ? setTimeout(() => {
                holdFired = true;
                endGesture();
                opts.onHold();
            }, HOLD_MS)
            : null;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                moved = true;
                clearHold();
                ghost = document.createElement('div');
                ghost.className = 'drag-ghost';
                ghost.textContent = opts.ghostLabel || '';
                ghost.style.display = 'block';
                document.body.appendChild(ghost);
            }
            if (!moved) return;
            ghost.style.left = `${ev.clientX + 14}px`;
            ghost.style.top = `${ev.clientY + 14}px`;
            target = this.overlay.detectDropTarget(ev.clientX, ev.clientY, ghost);
            this.overlay.showDockOverlayFor(target);
        };

        const onUp = (ev) => {
            if (holdFired) return;
            endGesture();
            const customize = isDockCustomizeKey(ev);
            if (moved && target) {
                // Self-drop clone only with Shift (UI customize).
                if (opts.ownId && target.kind === 'leaf' && target.leafId === opts.ownId) {
                    if (!customize) return;
                    const ws = this.model.findWorkspaceContaining(opts.ownId);
                    const original = ws
                        ? this.model.findNode(this.model.getTreeOf(ws), opts.ownId)
                        : null;
                    if (original && !this.isSingleton(original.contentType)) {
                        const dup = this.model.makeLeaf(original.contentType, original.label);
                        this.model.applyDropTarget(target, dup);
                        this.render();
                    }
                } else {
                    const node = this.model.resolveDraggedNode(getRawPayload());
                    if (node) {
                        this.model.applyDropTarget(target, node);
                        this.render();
                    }
                }
            } else if (moved && !target) {
                // Detach to floating only with Shift.
                if (customize && opts.onNoTargetDrop) opts.onNoTargetDrop(ev.clientX, ev.clientY);
            } else if (!moved) {
                const now = Date.now();
                const last = captureEl._lastTapTime || 0;
                if (opts.onDoubleTap && (now - last) < DOUBLE_TAP_MS) {
                    captureEl._lastTapTime = 0;
                    if (captureEl._tapTimer) {
                        clearTimeout(captureEl._tapTimer);
                        captureEl._tapTimer = null;
                    }
                    opts.onDoubleTap();
                } else {
                    captureEl._lastTapTime = now;
                    if (opts.onTap) {
                        captureEl._tapTimer = setTimeout(() => {
                            captureEl._tapTimer = null;
                            opts.onTap();
                        }, opts.onDoubleTap ? TAP_DELAY_MS : 0);
                    }
                }
            }
        };

        captureEl.addEventListener('pointermove', onMove);
        captureEl.addEventListener('pointerup', onUp);
    }

    startFloatingDrag(e, fw, el, opts) {
        e.preventDefault();
        let captureEl = e.currentTarget;
        const pointerId = e.pointerId;
        captureEl.setPointerCapture(pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        let moved = false;
        let treeTarget = null;
        let snapTarget = null;
        let origins;

        const snapshotOrigins = () => {
            const ids = fw.groupId
                ? this.model.floatingWindows.filter((f) => f.groupId === fw.groupId).map((f) => f.id)
                : [fw.id];
            origins = new Map();
            ids.forEach((id) => {
                const f = this.model.floatingWindows.find((x) => x.id === id);
                if (f) origins.set(id, { x: f.x, y: f.y });
            });
        };
        snapshotOrigins();

        const clearHold = () => {
            if (holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
        };
        const endGesture = () => {
            clearHold();
            try {
                captureEl.releasePointerCapture(pointerId);
            } catch (_) { /* ignore */ }
            captureEl.removeEventListener('pointermove', onMove);
            captureEl.removeEventListener('pointerup', onUp);
            this.overlay.hideDockOverlay();
            this.overlay.hideSnapHighlight();
        };

        // Hold-to-ungroup only when customize key is held at press (Shift).
        let holdTimer = (fw.groupId && isDockCustomizeKey(e))
            ? setTimeout(() => {
                clearHold();
                this.model.detachFloating(fw);
                moved = true;
                this.overlay.hideSnapHighlight();
                this.overlay.hideDockOverlay();
                this.render();
                const freshEl = this.renderer.floatingLayer.querySelector(
                    `.floating-window[data-float-id="${fw.id}"]`
                );
                const freshChrome = freshEl && freshEl.querySelector('.floating-chrome');
                if (freshChrome) {
                    captureEl.removeEventListener('pointermove', onMove);
                    captureEl.removeEventListener('pointerup', onUp);
                    el = freshEl;
                    captureEl = freshChrome;
                    try {
                        captureEl.setPointerCapture(pointerId);
                    } catch (_) { /* ignore */ }
                    captureEl.addEventListener('pointermove', onMove);
                    captureEl.addEventListener('pointerup', onUp);
                }
                snapshotOrigins();
            }, HOLD_MS)
            : null;

        const onMove = (ev) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                moved = true;
                clearHold();
            }
            if (!moved) return;

            origins.forEach((orig, id) => {
                const f = this.model.floatingWindows.find((x) => x.id === id);
                if (!f) return;
                f.x = orig.x + dx;
                f.y = orig.y + dy;
                this.renderer.syncFloatingDom(f);
            });

            // Snap-to-neighbor only with Shift.
            if (isDockCustomizeKey(ev)) {
                snapTarget = this.model.findFloatingSnapTarget(
                    fw,
                    (f) => this.renderer.effectiveHeight(f)
                );
            } else {
                snapTarget = null;
            }
            if (snapTarget) {
                this.overlay.showSnapHighlight(fw, snapTarget);
                this.overlay.hideDockOverlay();
                treeTarget = null;
            } else {
                this.overlay.hideSnapHighlight();
                if (!fw.groupId) {
                    treeTarget = this.overlay.detectDropTarget(ev.clientX, ev.clientY, el);
                    this.overlay.showDockOverlayFor(treeTarget);
                } else {
                    treeTarget = null;
                }
            }
        };

        const onUp = (ev) => {
            endGesture();
            if (moved && snapTarget && isDockCustomizeKey(ev)) {
                this.model.applyFloatingSnap(
                    fw,
                    snapTarget,
                    (f) => this.renderer.effectiveHeight(f)
                );
                this.renderer.syncFloatingDom(fw);
                if (snapTarget.side === 'left' || snapTarget.side === 'right') {
                    this.model.restackBottomChain(
                        fw,
                        (f) => this.renderer.effectiveHeight(f),
                        (f) => this.renderer.syncFloatingDom(f)
                    );
                } else {
                    this.model.verticalChainWidthSync(fw, (f) => this.renderer.syncFloatingDom(f));
                    this.model.restackRightChain(fw, (f) => this.renderer.syncFloatingDom(f));
                }
                this.render();
            } else if (moved && treeTarget) {
                this.model.floatingWindows = this.model.floatingWindows.filter((w) => w.id !== fw.id);
                this.model.applyDropTarget(treeTarget, fw.tree);
                this.render();
            } else if (!moved) {
                if (!opts.onText) {
                    this.renderer.toggleFloatingCollapse(fw);
                } else {
                    const now = Date.now();
                    const last = captureEl._lastTapTime || 0;
                    if ((now - last) < DOUBLE_TAP_MS) {
                        captureEl._lastTapTime = 0;
                        if (captureEl._tapTimer) {
                            clearTimeout(captureEl._tapTimer);
                            captureEl._tapTimer = null;
                        }
                        opts.onRename();
                    } else {
                        captureEl._lastTapTime = now;
                        captureEl._tapTimer = setTimeout(() => {
                            captureEl._tapTimer = null;
                            this.renderer.toggleFloatingCollapse(fw);
                        }, TAP_DELAY_MS);
                    }
                }
            }
        };

        captureEl.addEventListener('pointermove', onMove);
        captureEl.addEventListener('pointerup', onUp);
    }

    startFloatingResize(e, fw, el) {
        e.preventDefault();
        e.stopPropagation();
        const captureEl = e.currentTarget;
        captureEl.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const origW = fw.w;
        const origH = fw.h;
        document.body.style.userSelect = 'none';
        const onMove = (ev) => {
            fw.w = Math.max(FLOAT_MIN_W, origW + (ev.clientX - startX));
            fw.h = Math.max(FLOAT_MIN_H, origH + (ev.clientY - startY));
            el.style.width = `${fw.w}px`;
            el.style.height = `${fw.h}px`;
            this.model.verticalChainWidthSync(fw, (f) => this.renderer.syncFloatingDom(f));
            this.model.restackRightChain(fw, (f) => this.renderer.syncFloatingDom(f));
            this.model.restackBottomChain(
                fw,
                (f) => this.renderer.effectiveHeight(f),
                (f) => this.renderer.syncFloatingDom(f)
            );
        };
        const onUp = (ev) => {
            captureEl.releasePointerCapture(ev.pointerId);
            captureEl.removeEventListener('pointermove', onMove);
            captureEl.removeEventListener('pointerup', onUp);
            document.body.style.userSelect = '';
            this.onStructureChange();
        };
        captureEl.addEventListener('pointermove', onMove);
        captureEl.addEventListener('pointerup', onUp);
    }

    destroy() {
        this.overlay.destroy();
    }
}
