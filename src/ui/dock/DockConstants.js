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
export const COLLAPSED_H = 28;
export const SNAP_THRESHOLD = 16;
export const HOLD_MS = 500;
export const DOUBLE_TAP_MS = 350;
export const TAP_DELAY_MS = 260;

export const OPPOSITE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

export function typeLabel(contentType) {
    return TYPE_META[contentType] ? TYPE_META[contentType].label : contentType;
}

export function typeColor(contentType) {
    return TYPE_META[contentType] ? TYPE_META[contentType].color : '#333';
}
