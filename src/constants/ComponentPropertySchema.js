/**
 * Editor field schemas for component.properties — mirrors docs/RUNTIME_SCHEMA.md
 * for implemented types; unknown types get a generic JSON bag of existing keys.
 */

/** @typedef {{ key: string, label: string, kind: 'number'|'text'|'bool'|'stringList'|'json', default?: * }} CompField */

/** @type {Record<string, CompField[]>} */
const SCHEMAS = {
    sprite: [
        { key: 'src', label: 'Image Path', kind: 'text', default: '' }
    ],
    collider: [
        { key: 'offsetX', label: 'Offset X', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (empty = entity)', kind: 'number', default: null },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Collides With (comma list)', kind: 'stringList', default: [] }
    ],
    trigger: [
        { key: 'offsetX', label: 'Offset X', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (empty = entity)', kind: 'number', default: null },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Collides With (comma list)', kind: 'stringList', default: [] }
    ],
    interactable: [
        { key: 'radius', label: 'Radius', kind: 'number', default: 32 },
        { key: 'hint', label: 'Hint', kind: 'text', default: 'Interact' }
    ],
    spriteUiAnimation: [
        { key: 'frames', label: 'Frames (JSON array)', kind: 'json', default: [] },
        { key: 'loop', label: 'Loop', kind: 'bool', default: true },
        // Фаза F: state machine mode — when 'states' is non-empty, 'clips' (named {clipName:
        // frames[]}) replaces the flat 'frames' array above as the frame-data source.
        { key: 'clips', label: 'Clips (JSON: {name: frames[]})', kind: 'json', default: {} },
        { key: 'defaultState', label: 'Default State', kind: 'text', default: '' },
        { key: 'states', label: 'States (JSON: [{name,clip,transitions}])', kind: 'json', default: [] }
    ],
    playerStart: []
};

/**
 * @param {string} typeId
 * @returns {CompField[]}
 */
export function getComponentFields(typeId) {
    return SCHEMAS[typeId] || null;
}

/**
 * Default properties for a new stub of this type.
 * @param {string} typeId
 * @returns {object}
 */
export function defaultComponentProperties(typeId) {
    const fields = SCHEMAS[typeId];
    if (!fields) return {};
    const props = {};
    for (const f of fields) {
        if (f.default === undefined) continue;
        // Don't write null optional size — engine uses entity box when omitted
        if (f.default === null) continue;
        if (Array.isArray(f.default)) props[f.key] = [...f.default];
        else if (typeof f.default === 'object') props[f.key] = JSON.parse(JSON.stringify(f.default));
        else props[f.key] = f.default;
    }
    return props;
}

/**
 * Resolve display value for a field from component.properties.
 * @param {CompField} field
 * @param {object} properties
 */
export function readFieldValue(field, properties) {
    const props = properties || {};
    if (!(field.key in props) || props[field.key] === undefined) {
        return field.default;
    }
    return props[field.key];
}

/**
 * Parse UI string/control into property value.
 * @param {CompField} field
 * @param {string|boolean} raw
 * @returns {{ ok: boolean, value?: *, error?: string }}
 */
export function parseFieldInput(field, raw) {
    if (field.kind === 'bool') {
        return { ok: true, value: !!raw };
    }
    if (field.kind === 'number') {
        const s = String(raw ?? '').trim();
        if (s === '') return { ok: true, value: null };
        const n = parseFloat(s);
        if (!Number.isFinite(n)) return { ok: false, error: 'Invalid number' };
        return { ok: true, value: n };
    }
    if (field.kind === 'stringList') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: [] };
        return {
            ok: true,
            value: s.split(',').map((p) => p.trim()).filter(Boolean)
        };
    }
    if (field.kind === 'json') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: field.default ?? null };
        try {
            return { ok: true, value: JSON.parse(s) };
        } catch (e) {
            return { ok: false, error: e.message || 'Invalid JSON' };
        }
    }
    return { ok: true, value: String(raw ?? '') };
}

/**
 * Format property value for an input control.
 * @param {CompField} field
 * @param {*} value
 */
export function formatFieldValue(field, value) {
    if (value === null || value === undefined) return '';
    if (field.kind === 'stringList') {
        return Array.isArray(value) ? value.join(', ') : String(value);
    }
    if (field.kind === 'json') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    if (field.kind === 'bool') return !!value;
    return String(value);
}
