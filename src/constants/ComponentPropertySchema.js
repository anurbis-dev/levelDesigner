/**
 * Editor field schemas for component.properties — mirrors docs/RUNTIME_SCHEMA.md
 * for implemented types; unknown types get a generic JSON bag of existing keys.
 */

/**
 * @typedef {{ key: string, label: string,
 *   kind: 'number'|'text'|'bool'|'stringList'|'json'|'select'|'color'|'assetRef',
 *   default?: *, options?: { value: string, label: string }[], assetTypes?: string[] }} CompField
 */

const PATH_FOLLOWER_MODE_OPTIONS = [
    { value: 'loop', label: 'Loop (wraps to first waypoint)' },
    { value: 'pingpong', label: 'Ping-pong (reverses at ends)' },
    { value: 'once', label: 'Once (stops at last waypoint)' }
];

const COLLIDER_SHAPE_OPTIONS = [
    { value: 'box', label: 'Box (square / rect)' },
    { value: 'circle', label: 'Circle' },
    { value: 'freeform', label: 'Freeform (polygon)' }
];

/** Shared shape fields for collider + trigger. */
const COLLIDER_SHAPE_FIELDS = [
    { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
    { key: 'color', label: 'Frame Color', kind: 'color', default: '' },
    { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
    { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
    { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
    { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
    { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
    { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
    { key: 'layer', label: 'Layer', kind: 'text', default: '' },
    { key: 'collidesWith', label: 'Collides With (comma list)', kind: 'stringList', default: [] }
];

/** @type {Record<string, CompField[]>} */
const SCHEMAS = {
    sprite: [
        // References a catalog Image asset (disk path lives only on that Image)
        { key: 'imageAssetId', label: 'Image Asset', kind: 'assetRef', assetTypes: ['image'], default: '' }
    ],
    collider: COLLIDER_SHAPE_FIELDS,
    trigger: COLLIDER_SHAPE_FIELDS,
    interactable: [
        { key: 'radius', label: 'Radius', kind: 'number', default: 32 },
        { key: 'hint', label: 'Hint', kind: 'text', default: 'Interact' }
    ],
    pickup: [
        { key: 'itemId', label: 'Item Id (level.items[].id)', kind: 'text', default: '' },
        { key: 'count', label: 'Count', kind: 'number', default: 1 },
        { key: 'destroyOnPickup', label: 'Destroy On Pickup', kind: 'bool', default: true }
    ],
    damageHealth: [
        { key: 'maxHealth', label: 'Max Health', kind: 'number', default: 100 },
        { key: 'currentHealth', label: 'Current Health (empty = max)', kind: 'number', default: null },
        { key: 'contactDamage', label: 'Contact Damage (dealt to others on touch)', kind: 'number', default: 0 },
        { key: 'invulnerabilityDuration', label: 'Invulnerability After Hit (sec)', kind: 'number', default: 0.5 },
        { key: 'destroyOnDeath', label: 'Destroy On Death', kind: 'bool', default: true },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Takes Damage From (comma list)', kind: 'stringList', default: [] }
    ],
    movablePushable: [
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Blocked By (comma list; empty = all)', kind: 'stringList', default: [] }
    ],
    mountableVehicleSeat: [
        { key: 'mountRadius', label: 'Mount Radius', kind: 'number', default: 32 },
        { key: 'speed', label: 'Vehicle Speed (px/sec)', kind: 'number', default: 150 },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Blocked By (comma list; empty = all)', kind: 'stringList', default: [] }
    ],
    pathFollower: [
        { key: 'waypoints', label: 'Waypoints (JSON [{x,y}], offsets from spawn)', kind: 'json', default: [] },
        { key: 'speed', label: 'Speed (px/sec)', kind: 'number', default: 100 },
        { key: 'mode', label: 'Mode', kind: 'select', default: 'loop', options: PATH_FOLLOWER_MODE_OPTIONS },
        { key: 'waitAtWaypoint', label: 'Wait At Waypoint (sec)', kind: 'number', default: 0 }
    ],
    spawner: [
        { key: 'template', label: 'Template (JSON GameObject data, id/x/y ignored)', kind: 'json', default: {} },
        { key: 'interval', label: 'Interval (sec, <=0 = disabled)', kind: 'number', default: 3 },
        { key: 'maxAlive', label: 'Max Alive (0 = unlimited)', kind: 'number', default: 0 },
        { key: 'maxSpawns', label: 'Max Total Spawns (0 = unlimited)', kind: 'number', default: 0 },
        { key: 'spawnOffsetX', label: 'Spawn Offset X', kind: 'number', default: 0 },
        { key: 'spawnOffsetY', label: 'Spawn Offset Y', kind: 'number', default: 0 }
    ],
    checkpointSavePoint: [],
    climbableLadder: [
        { key: 'climbSpeed', label: 'Climb Speed (px/sec)', kind: 'number', default: 100 },
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] }
    ],
    stateMachineBehavior: [
        { key: 'defaultState', label: 'Default State', kind: 'text', default: '' },
        { key: 'states', label: 'States (JSON: [{name,movement,speed,waypoints,transitions}])', kind: 'json', default: [] }
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
    playerStart: [],
    camera: [
        { key: 'followTargetId', label: 'Follow Target Id (empty = player)', kind: 'text', default: '' },
        { key: 'deadzoneWidth', label: 'Deadzone Width', kind: 'number', default: 0 },
        { key: 'deadzoneHeight', label: 'Deadzone Height', kind: 'number', default: 0 },
        { key: 'bounds', label: 'Bounds (JSON {x,y,width,height}; empty = unbounded)', kind: 'json', default: null }
    ]
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
    if (field.kind === 'select') {
        const v = String(raw ?? '').trim();
        const allowed = (field.options || []).map((o) => o.value);
        if (allowed.length && !allowed.includes(v)) {
            return { ok: false, error: 'Invalid option' };
        }
        return { ok: true, value: v || field.default || '' };
    }
    if (field.kind === 'assetRef') {
        return { ok: true, value: String(raw ?? '').trim() };
    }
    if (field.kind === 'color') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: '' };
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) {
            return { ok: false, error: 'Use #RGB or #RRGGBB' };
        }
        return { ok: true, value: s };
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
