/**
 * Floating window drag/resize (Shift-gated layout customize for snap/re-dock/resize).
 */
import {
    HOLD_MS,
    DOUBLE_TAP_MS,
    TAP_DELAY_MS,
    FLOAT_MIN_W,
    FLOAT_MIN_H,
    isDockCustomizeKey
} from './DockConstants.js';
import { bindDockCustomizeKeyWatch } from './DockDragKeyWatch.js';

export function startDockFloatingDrag(ctx, e, fw, el, opts) {
    e.preventDefault();
    let captureEl = e.currentTarget;
    const pointerId = e.pointerId;
    captureEl.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = e.clientX;
    let lastY = e.clientY;
    let customize = isDockCustomizeKey(e);
    let moved = false;
    let treeTarget = null;
    let snapTarget = null;
    let origins;
    let unbindKeys = null;
    let holdTimer = null;

    const snapshotOrigins = () => {
        const ids = fw.groupId
            ? ctx.model.floatingWindows.filter((f) => f.groupId === fw.groupId).map((f) => f.id)
            : [fw.id];
        origins = new Map();
        ids.forEach((id) => {
            const f = ctx.model.floatingWindows.find((x) => x.id === id);
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

    const clearLayoutUi = () => {
        snapTarget = null;
        treeTarget = null;
        ctx.overlay.hideSnapHighlight();
        ctx.overlay.hideDockOverlay();
    };

    const refreshLayoutUi = () => {
        if (!moved) return;
        if (!customize) {
            clearLayoutUi();
            return;
        }
        snapTarget = ctx.model.findFloatingSnapTarget(
            fw,
            (f) => ctx.renderer.effectiveHeight(f)
        );
        if (snapTarget) {
            ctx.overlay.showSnapHighlight(fw, snapTarget);
            ctx.overlay.hideDockOverlay();
            treeTarget = null;
        } else {
            ctx.overlay.hideSnapHighlight();
            if (!fw.groupId) {
                treeTarget = ctx.overlay.detectDropTarget(lastX, lastY, el);
                ctx.overlay.showDockOverlayFor(treeTarget);
            } else {
                treeTarget = null;
            }
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
        ctx.overlay.hideSnapHighlight();
    };

    holdTimer = (fw.groupId && customize)
        ? setTimeout(() => {
            if (!customize) return;
            clearHold();
            ctx.model.detachFloating(fw);
            moved = true;
            clearLayoutUi();
            ctx.render();
            const freshEl = ctx.renderer.floatingLayer.querySelector(
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

    unbindKeys = bindDockCustomizeKeyWatch((shiftDown) => {
        customize = shiftDown;
        if (!customize) clearHold();
        refreshLayoutUi();
    });

    const onMove = (ev) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        customize = isDockCustomizeKey(ev);
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            moved = true;
            clearHold();
        }
        if (!moved) return;

        origins.forEach((orig, id) => {
            const f = ctx.model.floatingWindows.find((x) => x.id === id);
            if (!f) return;
            f.x = orig.x + dx;
            f.y = orig.y + dy;
            ctx.renderer.syncFloatingDom(f);
        });

        refreshLayoutUi();
    };

    const onUp = (ev) => {
        customize = isDockCustomizeKey(ev);
        const snap = snapTarget;
        const tree = treeTarget;
        const didMove = moved;
        endGesture();

        if (didMove && customize && snap) {
            ctx.model.applyFloatingSnap(
                fw,
                snap,
                (f) => ctx.renderer.effectiveHeight(f)
            );
            ctx.renderer.syncFloatingDom(fw);
            if (snap.side === 'left' || snap.side === 'right') {
                ctx.model.restackBottomChain(
                    fw,
                    (f) => ctx.renderer.effectiveHeight(f),
                    (f) => ctx.renderer.syncFloatingDom(f)
                );
            } else {
                ctx.model.verticalChainWidthSync(fw, (f) => ctx.renderer.syncFloatingDom(f));
                ctx.model.restackRightChain(fw, (f) => ctx.renderer.syncFloatingDom(f));
            }
            ctx.render();
        } else if (didMove && customize && tree) {
            ctx.model.floatingWindows = ctx.model.floatingWindows.filter((w) => w.id !== fw.id);
            ctx.model.applyDropTarget(tree, fw.tree);
            ctx.render();
        } else if (!didMove) {
            if (!opts.onText) {
                ctx.renderer.toggleFloatingCollapse(fw);
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
                        ctx.renderer.toggleFloatingCollapse(fw);
                    }, TAP_DELAY_MS);
                }
            }
        } else if (didMove) {
            ctx.onStructureChange();
        }
    };

    captureEl.addEventListener('pointermove', onMove);
    captureEl.addEventListener('pointerup', onUp);
}

/**
 * @param {object} ctx
 * @param {PointerEvent} e
 * @param {object} fw
 * @param {HTMLElement} el
 */

export function startDockFloatingResize(ctx, e, fw, el) {
    if (!isDockCustomizeKey(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const captureEl = e.currentTarget;
    captureEl.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = fw.w;
    const origH = fw.h;
    let customize = true;
    document.body.style.userSelect = 'none';

    const unbindKeys = bindDockCustomizeKeyWatch((shiftDown) => {
        customize = shiftDown;
    });

    const onMove = (ev) => {
        customize = isDockCustomizeKey(ev);
        if (!customize) return;
        fw.w = Math.max(FLOAT_MIN_W, origW + (ev.clientX - startX));
        fw.h = Math.max(FLOAT_MIN_H, origH + (ev.clientY - startY));
        el.style.width = `${fw.w}px`;
        el.style.height = `${fw.h}px`;
        ctx.model.verticalChainWidthSync(fw, (f) => ctx.renderer.syncFloatingDom(f));
        ctx.model.restackRightChain(fw, (f) => ctx.renderer.syncFloatingDom(f));
        ctx.model.restackBottomChain(
            fw,
            (f) => ctx.renderer.effectiveHeight(f),
            (f) => ctx.renderer.syncFloatingDom(f)
        );
    };
    const onUp = (ev) => {
        unbindKeys();
        captureEl.releasePointerCapture(ev.pointerId);
        captureEl.removeEventListener('pointermove', onMove);
        captureEl.removeEventListener('pointerup', onUp);
        document.body.style.userSelect = '';
        if (isDockCustomizeKey(ev) && customize) ctx.onStructureChange();
    };
    captureEl.addEventListener('pointermove', onMove);
    captureEl.addEventListener('pointerup', onUp);
}
