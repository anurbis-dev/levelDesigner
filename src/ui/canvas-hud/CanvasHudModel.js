/**
 * Level-scope HUD Canvas definitions + widgets.
 * - level.canvases: [{ id, name, widgets: [{ id, type, anchor, offsetX, offsetY,
 *   width?, height?, text?, imageAssetId?, style?, binding?, action? }] }]
 * Image widgets reference a catalog type=image asset (`imageAssetId`); disk path lives
 * only on that Image asset. Legacy `imgSrc` is still resolved read-only if present.
 * Runtime consumer: src/engine/CanvasHudRenderer.js / CanvasHudBinding.js.
 * Camera assignment: component.properties.canvasIds (src/constants/ComponentPropertySchema.js).
 */

/** Widget type labels for the type <select>. */
export const WIDGET_TYPES = [
    { id: 'panel', label: 'Panel (background box)' },
    { id: 'text', label: 'Text' },
    { id: 'button', label: 'Button' },
    { id: 'image', label: 'Image' },
    { id: 'progressBar', label: 'Progress bar' }
];

/** 9-point anchor labels, matches CanvasHudBinding.js ANCHOR_PARTS keys. */
export const ANCHOR_OPTIONS = [
    { id: 'topLeft', label: 'Top left' },
    { id: 'topCenter', label: 'Top center' },
    { id: 'topRight', label: 'Top right' },
    { id: 'middleLeft', label: 'Middle left' },
    { id: 'middleCenter', label: 'Middle center' },
    { id: 'middleRight', label: 'Middle right' },
    { id: 'bottomLeft', label: 'Bottom left' },
    { id: 'bottomCenter', label: 'Bottom center' },
    { id: 'bottomRight', label: 'Bottom right' }
];

/** Binding source labels; empty id = no binding (static text/value). */
export const BINDING_SOURCE_OPTIONS = [
    { id: 'variable', label: 'Event Graph variable' },
    { id: 'inventoryCount', label: 'Inventory item count' }
];

/** @returns {{id:string, name:string, widgets:Array}} */
export function createEmptyCanvas(id = 'canvas_1') {
    return { id, name: id, widgets: [] };
}

/** @param {object|null|undefined} canvas */
export function cloneCanvas(canvas) {
    return canvas == null ? null : JSON.parse(JSON.stringify(canvas));
}

/** @param {Array|null|undefined} list */
export function cloneCanvases(list) {
    return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []));
}

/**
 * @param {object} canvas
 * @returns {object}
 */
export function normalizeCanvas(canvas) {
    const c = cloneCanvas(canvas) || createEmptyCanvas('canvas_1');
    c.id = String(c.id || 'canvas_1');
    c.name = String(c.name || c.id);
    c.widgets = Array.isArray(c.widgets) ? c.widgets : [];
    return c;
}

/** @param {Array} list @returns {string} */
export function nextCanvasId(list) {
    const used = new Set((list || []).map((c) => c.id));
    let i = 1;
    while (used.has(`canvas_${i}`)) i += 1;
    return `canvas_${i}`;
}

/** @param {object} canvas @returns {string} */
export function nextWidgetId(canvas) {
    const used = new Set((canvas?.widgets || []).map((w) => w.id));
    let i = 1;
    while (used.has(`widget_${i}`)) i += 1;
    return `widget_${i}`;
}

/** @param {Array} list @param {object} canvas @returns {Array} */
export function upsertCanvas(list, canvas) {
    const next = cloneCanvases(list);
    const idx = next.findIndex((c) => c.id === canvas.id);
    const copy = normalizeCanvas(canvas);
    if (idx >= 0) next[idx] = copy;
    else next.push(copy);
    return next;
}

/** @param {Array} list @param {string} id @returns {Array} */
export function removeCanvas(list, id) {
    return cloneCanvases(list).filter((c) => c.id !== id);
}

/** @param {object} canvas @param {object} widget @returns {object} */
export function upsertWidget(canvas, widget) {
    const c = normalizeCanvas(canvas);
    const idx = c.widgets.findIndex((w) => w.id === widget.id);
    const copy = cloneCanvas(widget);
    if (idx >= 0) c.widgets[idx] = copy;
    else c.widgets.push(copy);
    return c;
}

/** @param {object} canvas @param {string} widgetId @returns {object} */
export function removeWidget(canvas, widgetId) {
    const c = normalizeCanvas(canvas);
    c.widgets = c.widgets.filter((w) => w.id !== widgetId);
    return c;
}

/**
 * Clone a widget with a new id, nudged +12/+12 so the copy is visible.
 * @param {object} canvas
 * @param {string} widgetId
 * @returns {{ canvas: object, newWidgetId: string|null }}
 */
export function duplicateWidget(canvas, widgetId) {
    const c = normalizeCanvas(canvas);
    const src = c.widgets.find((w) => w.id === widgetId);
    if (!src) return { canvas: c, newWidgetId: null };
    const copy = cloneCanvas(src);
    copy.id = nextWidgetId(c);
    copy.offsetX = (Number(copy.offsetX) || 0) + 12;
    copy.offsetY = (Number(copy.offsetY) || 0) + 12;
    c.widgets.push(copy);
    return { canvas: c, newWidgetId: copy.id };
}

/**
 * Suggests variable names already referenced by the level's Event Graph
 * (SetVariable/Compare/Not nodes), so binding.name can be picked instead of typed.
 * Not a canonical registry — Event Graph has no central variable list — just scan results.
 * @param {object|null|undefined} level
 * @returns {{id:string,label:string}[]}
 */
export function listVariableNameOptions(level) {
    const nodes = level?.eventGraph?.nodes || [];
    const seen = new Set();
    for (const n of nodes) {
        const name = n?.params?.name || n?.params?.var;
        if (name && !seen.has(name)) seen.add(name);
    }
    return [...seen].sort().map((name) => ({ id: name, label: name }));
}

/**
 * Suggests custom event names already used by OnCustomEvent/EmitCustomEvent nodes,
 * for widget action.name. Same "scan, not registry" caveat as listVariableNameOptions.
 * @param {object|null|undefined} level
 * @returns {{id:string,label:string}[]}
 */
export function listCustomEventNameOptions(level) {
    const nodes = level?.eventGraph?.nodes || [];
    const seen = new Set();
    for (const n of nodes) {
        if (n?.type !== 'OnCustomEvent' && n?.type !== 'EmitCustomEvent') continue;
        const name = n?.params?.name;
        if (name && !seen.has(name)) seen.add(name);
    }
    return [...seen].sort().map((name) => ({ id: name, label: name }));
}
