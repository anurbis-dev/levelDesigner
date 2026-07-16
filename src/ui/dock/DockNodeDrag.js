/**
 * Dock leaf/panel node drag (Shift-gated layout customize).
 */
import {
    HOLD_MS,
    DOUBLE_TAP_MS,
    TAP_DELAY_MS,
    isDockCustomizeKey,
    floatDetachLayoutFromClient
} from './DockConstants.js';
import { bindDockCustomizeKeyWatch } from './DockDragKeyWatch.js';

export function startDockNodeDrag(ctx, e, getRawPayload, opts) {
    e.preventDefault();
    const captureEl = e.currentTarget;
    const pointerId = e.pointerId;
    captureEl.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let customize = isDockCustomizeKey(e);
    let moved = false;
    let target = null;
    let ghost = null;
    let holdFired = false;
    let unbindKeys = null;
    let holdTimer = null;
    const canDetachFloat = typeof opts.onNoTargetDrop === 'function';

    const clearHold = () => {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
    };

    const clearCustomizeUi = () => {
        target = null;
        ctx.overlay.hideDockOverlay();
        ctx.overlay.hideFloatDetachGhost();
    };

    const refreshDropUi = () => {
        if (!moved || !ghost) return;
        if (!customize) {
            clearCustomizeUi();
            return;
        }
        target = ctx.overlay.detectDropTarget(lastX, lastY, ghost);
        ctx.overlay.showDockOverlayFor(target);
        // DK-GST: when drop would create a floating window, preview its rect.
        if (canDetachFloat && !target) {
            const ws = ctx.renderer?.workspaceRect?.() || null;
            const layout = floatDetachLayoutFromClient(lastX, lastY, ws);
            ctx.overlay.showFloatDetachGhost(layout, opts.ghostLabel || '');
        } else {
            ctx.overlay.hideFloatDetachGhost();
        }
    };

    const endGesture = () => {
        clearHold();
        if (unbindKeys) {
            unbindKeys();
            unbindKeys = null;
        }
        try {
            captureEl.releasePointerCapture(pointerId);
        } catch (_) { /* ignore */ }
        captureEl.removeEventListener('pointermove', onMove);
        captureEl.removeEventListener('pointerup', onUp);
        ctx.overlay.hideDockOverlay();
        ctx.overlay.hideFloatDetachGhost();
        if (ghost) {
            ghost.remove();
            ghost = null;
        }
    };

    holdTimer = opts.onHold
        ? setTimeout(() => {
            if (!customize) return;
            holdFired = true;
            endGesture();
            opts.onHold();
        }, HOLD_MS)
        : null;

    unbindKeys = bindDockCustomizeKeyWatch((shiftDown) => {
        customize = shiftDown;
        if (!customize) clearHold();
        refreshDropUi();
    });

    const onMove = (ev) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        customize = isDockCustomizeKey(ev);
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            if (!customize) return;
            moved = true;
            clearHold();
            ghost = document.createElement('div');
            ghost.className = 'drag-ghost';
            ghost.textContent = opts.ghostLabel || '';
            ghost.style.display = 'block';
            document.body.appendChild(ghost);
        }
        if (!moved) return;

        if (!customize) {
            if (ghost) {
                ghost.remove();
                ghost = null;
            }
            moved = false;
            clearCustomizeUi();
            return;
        }

        ghost.style.left = `${ev.clientX + 14}px`;
        ghost.style.top = `${ev.clientY + 14}px`;
        refreshDropUi();
    };

    const onUp = (ev) => {
        if (holdFired) return;
        customize = isDockCustomizeKey(ev);
        const dropTarget = target;
        const didMove = moved;
        endGesture();

        // Layout drop requires Shift (customize). Plain tap works without Shift (DK-CLP collapse).
        if (didMove) {
            if (!customize) return;
            if (dropTarget) {
                if (opts.ownId && dropTarget.kind === 'leaf' && dropTarget.leafId === opts.ownId) {
                    const ws = ctx.model.findWorkspaceContaining(opts.ownId);
                    const original = ws
                        ? ctx.model.findNode(ctx.model.getTreeOf(ws), opts.ownId)
                        : null;
                    if (original && !ctx.isSingleton(original.contentType)) {
                        const dup = ctx.model.makeLeaf(original.contentType, original.label);
                        ctx.model.applyDropTarget(dropTarget, dup);
                        ctx.render();
                    }
                } else {
                    const node = ctx.model.resolveDraggedNode(getRawPayload());
                    if (node) {
                        ctx.model.applyDropTarget(dropTarget, node);
                        ctx.render();
                    }
                }
            } else if (opts.onNoTargetDrop) {
                opts.onNoTargetDrop(ev.clientX, ev.clientY);
            }
            return;
        }

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
    };

    captureEl.addEventListener('pointermove', onMove);
    captureEl.addEventListener('pointerup', onUp);
}

/**
 * @param {object} ctx - DockDragController instance
 * @param {PointerEvent} e
 * @param {object} fw
 * @param {HTMLElement} el
 * @param {object} opts
 */
