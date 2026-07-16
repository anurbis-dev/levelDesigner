/**
 * Shared constants for the split-tree dock system (Phase B0).
 * Ported from tmp/split-tree-prototype_v1_10.html.
 */

export const TYPE_META = {
    viewport: { label: 'Viewport', color: '#1e293b' },
    outliner: { label: 'Outliner', color: '#312e5b' },
    details: { label: 'Details', color: '#5b2e2e' },
    layers: { label: 'Layers', color: '#1f4d33' },
    assets: { label: 'Assets', color: '#5b4a1f' },
    levels: { label: 'Levels', color: '#1f3f5b' }
};

export const TYPE_ORDER = ['viewport', 'outliner', 'details', 'layers', 'assets', 'levels'];

export const FLOAT_MIN_W = 130;
export const FLOAT_MIN_H = 60;
/** Default size when detaching a leaf to a new floating window (DK-GST / onNoTargetDrop). */
export const FLOAT_DETACH_W = 220;
export const FLOAT_DETACH_H = 160;
/** Cursor hotspot inside the detach ghost (left/top offset from pointer). */
export const FLOAT_DETACH_HOTSPOT_X = 70;
export const FLOAT_DETACH_HOTSPOT_Y = 14;
export const COLLAPSED_H = 28;
export const SNAP_THRESHOLD = 16;
export const HOLD_MS = 500;
export const DOUBLE_TAP_MS = 350;
export const TAP_DELAY_MS = 260;

/**
 * Layout for detach-to-float at pointer (DK-GST preview + drop).
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ left: number, top: number }|null|undefined} workspaceRect
 * @returns {{ x: number, y: number, w: number, h: number, screenLeft: number, screenTop: number }}
 */
export function floatDetachLayoutFromClient(clientX, clientY, workspaceRect) {
    const screenLeft = clientX - FLOAT_DETACH_HOTSPOT_X;
    const screenTop = clientY - FLOAT_DETACH_HOTSPOT_Y;
    const wsLeft = workspaceRect?.left ?? 0;
    const wsTop = workspaceRect?.top ?? 0;
    return {
        x: screenLeft - wsLeft,
        y: screenTop - wsTop,
        w: FLOAT_DETACH_W,
        h: FLOAT_DETACH_H,
        screenLeft,
        screenTop
    };
}

export const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

export function typeLabel(contentType) {
    return TYPE_META[contentType] ? TYPE_META[contentType].label : contentType;
}

export function typeColor(contentType) {
    return TYPE_META[contentType] ? TYPE_META[contentType].color : '#333';
}

/**
 * Global modifier for dock UI layout customization.
 * With Shift only: move/split panels, self-drop clone, detach to floating,
 * floating snap/ungroup, drop-zone / snap highlights.
 * Floating window free-move position and corner resize work without Shift.
 * Without Shift (or after Shift release mid-gesture): no layout change / no highlight.
 * @param {Event|{ shiftKey?: boolean }|null|undefined} e
 * @returns {boolean}
 */
export function isDockCustomizeKey(e) {
    return !!(e && e.shiftKey);
}
