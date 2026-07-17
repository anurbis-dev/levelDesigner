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
    levels: { label: 'Levels', color: '#1f3f5b' },
    eventGraph: { label: 'Event Graph', color: '#3b1f5b' },
    dialogues: { label: 'Dialogues', color: '#5b1f3b' },
    items: { label: 'Items', color: '#1f5b3b' },
    // Asset editor (float workspace) — not in View menu
    assetPreview: { label: 'Preview', color: '#1a3a4a' },
    assetIdentity: { label: 'Identity', color: '#3a2a4a' },
    assetComponents: { label: 'Components', color: '#2a4a3a' },
    assetComponentDetails: { label: 'Comp. Details', color: '#4a3a2a' }
};

/** Level dock panels (View menu / default layout). */
export const LEVEL_TYPE_ORDER = [
    'viewport', 'outliner', 'details', 'layers', 'assets', 'levels', 'eventGraph', 'dialogues', 'items'
];

/** Asset-editor panel types (float role=assetEditor only in type menu). */
export const ASSET_EDITOR_TYPES = [
    'assetPreview',
    'assetIdentity',
    'assetComponents',
    'assetComponentDetails'
];

/**
 * Level content types with no fixed primary DOM in index.html — always factory copies
 * (same mount path as asset-editor panels).
 */
export const FACTORY_ONLY_LEVEL_TYPES = ['eventGraph', 'dialogues', 'items'];

const ASSET_EDITOR_TYPE_SET = new Set(ASSET_EDITOR_TYPES);
const FACTORY_ONLY_LEVEL_SET = new Set(FACTORY_ONLY_LEVEL_TYPES);

/** @param {string} contentType */
export function isAssetEditorType(contentType) {
    return ASSET_EDITOR_TYPE_SET.has(contentType);
}

/** @param {string} contentType */
export function isFactoryOnlyLevelType(contentType) {
    return FACTORY_ONLY_LEVEL_SET.has(contentType);
}

/** All registered contentTypes (level + asset editor). */
export const TYPE_ORDER = [...LEVEL_TYPE_ORDER, ...ASSET_EDITOR_TYPES];

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
