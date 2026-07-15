/**
 * Bind secondary viewport canvases to the same MouseHandlers as primary,
 * plus pointer-capture so pan/zoom continues outside the leaf/window until release.
 */
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';

/**
 * @param {import('./ViewportViewManager.js').ViewportViewManager} vvm
 * @param {object} view
 */
export function bindSecondaryViewportNav(vvm, view) {
    if (view.isPrimary) {
        // Primary already registered as main-canvas; still ensure capture helper.
        attachPointerCaptureHelper(vvm, view);
        return;
    }

    const editor = vvm.editor;
    const mh = editor?.mouseHandlers;
    if (!mh || !view.canvas) return;

    const canvasId = `viewport-canvas-${view.leafId}`;
    const canvasConfig = {
        onMouseDown: (e) => mh.handleMouseDown(e),
        onMouseMove: (e) => mh.handleMouseMove(e),
        onMouseUp: (e) => mh.handleMouseUp(e),
        onWheel: (e) => mh.handleWheel(e),
        onDoubleClick: (e) => mh.handleDoubleClick(e),
        onDragOver: (e) => mh.handleDragOver(e),
        onDrop: (e) => mh.handleDrop(e),
        onContextMenu: (e) => e.preventDefault()
    };

    eventHandlerManager.registerCanvas(view.canvas, canvasConfig, canvasId);
    view._canvasId = canvasId;
    attachPointerCaptureHelper(vvm, view);
}

/**
 * setPointerCapture on any button so drag/pan/zoom/marquee continue outside the leaf
 * without hovering other dock windows / UI until release.
 * @param {import('./ViewportViewManager.js').ViewportViewManager} vvm
 * @param {object} view
 */
function attachPointerCaptureHelper(vvm, view) {
    if (!view.canvas || view._captureBound) return;

    const onPointerDown = (e) => {
        // Left = select/drag/marquee/transform, middle = zoom, right = pan
        if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
        vvm.focus(view.leafId);
        try {
            view.canvas.setPointerCapture(e.pointerId);
            view._capturedPointerId = e.pointerId;
        } catch (_err) {
            // Older browsers / failed capture — global mouse handlers still help
        }
    };

    const onLostCapture = () => {
        view._capturedPointerId = null;
    };

    view.canvas.addEventListener('pointerdown', onPointerDown);
    view.canvas.addEventListener('lostpointercapture', onLostCapture);
    view._captureBound = { onPointerDown, onLostCapture };
}

/** @param {object} view */
export function unbindSecondaryViewportNav(view) {
    if (view._onFocus) {
        view.canvas?.removeEventListener('pointerdown', view._onFocus);
        view._onFocus = null;
    }
    if (view._captureBound && view.canvas) {
        view.canvas.removeEventListener('pointerdown', view._captureBound.onPointerDown);
        view.canvas.removeEventListener('lostpointercapture', view._captureBound.onLostCapture);
        if (view._capturedPointerId != null) {
            try { view.canvas.releasePointerCapture(view._capturedPointerId); } catch (_e) { /* */ }
        }
        view._captureBound = null;
    }
    if (view._canvasId && view.canvas) {
        try {
            eventHandlerManager.unregisterElement(view.canvas);
        } catch (_e) {
            /* optional */
        }
        view._canvasId = null;
    }
}
