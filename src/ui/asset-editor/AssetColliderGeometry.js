/**
 * Shared geometry for collider/trigger shapes (box | circle | freeform).
 * Used by Preview draw, camera fit, freeform edit, and engine AABB.
 */

export const COLLIDER_SHAPES = ['box', 'circle', 'freeform'];

/**
 * @param {object|null|undefined} props
 * @returns {'box'|'circle'|'freeform'}
 */
export function resolveColliderShape(props) {
    const s = props?.shape;
    if (s === 'circle' || s === 'freeform') return s;
    // Legacy aliases
    if (s === 'rect' || s === 'square' || s === 'aabb') return 'box';
    return 'box';
}

/**
 * Stroke color: explicit properties.color, else palette fallback.
 * @param {object|null|undefined} props
 * @param {string} fallback
 * @returns {string}
 */
export function resolveColliderColor(props, fallback) {
    const c = props?.color;
    if (typeof c === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c.trim())) {
        return c.trim();
    }
    return fallback;
}

/**
 * @param {object} props
 * @param {number} aw
 * @param {number} ah
 * @returns {{ ox: number, oy: number, w: number, h: number }}
 */
export function resolveBox(props, aw, ah) {
    const p = props || {};
    const ox = Number(p.offsetX) || 0;
    const oy = Number(p.offsetY) || 0;
    const bw = p.width != null && p.width !== '' ? Number(p.width) : aw;
    const bh = p.height != null && p.height !== '' ? Number(p.height) : ah;
    return {
        ox,
        oy,
        w: Math.max(1, Number.isFinite(bw) ? bw : aw),
        h: Math.max(1, Number.isFinite(bh) ? bh : ah)
    };
}

/**
 * Circle: center at (offsetX, offsetY), radius from `radius` or inscribed in box fields.
 * @param {object} props
 * @param {number} aw
 * @param {number} ah
 * @returns {{ cx: number, cy: number, r: number }}
 */
export function resolveCircle(props, aw, ah) {
    const p = props || {};
    const ox = Number(p.offsetX) || 0;
    const oy = Number(p.offsetY) || 0;
    if (p.radius != null && p.radius !== '' && Number.isFinite(Number(p.radius))) {
        return { cx: ox, cy: oy, r: Math.max(0.5, Number(p.radius)) };
    }
    // Back-compat: circle inscribed in AABB-style fields
    const box = resolveBox(p, aw, ah);
    return {
        cx: box.ox + box.w / 2,
        cy: box.oy + box.h / 2,
        r: Math.max(0.5, Math.min(box.w, box.h) / 2)
    };
}

/**
 * Freeform vertices in asset-local coords. Empty → null (caller may seed).
 * @param {object} props
 * @returns {{ x: number, y: number }[]|null}
 */
export function resolveFreeformPoints(props) {
    const pts = props?.points;
    if (!Array.isArray(pts) || pts.length === 0) return null;
    const out = [];
    for (const pt of pts) {
        if (!pt || typeof pt !== 'object') continue;
        const x = Number(pt.x);
        const y = Number(pt.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        out.push({ x, y });
    }
    return out.length ? out : null;
}

/**
 * Default rectangle freeform matching entity box (or optional box props).
 * @param {number} aw
 * @param {number} ah
 * @param {object} [props]
 * @returns {{ x: number, y: number }[]}
 */
export function defaultFreeformPoints(aw, ah, props) {
    const box = resolveBox(props || {}, aw, ah);
    return [
        { x: box.ox, y: box.oy },
        { x: box.ox + box.w, y: box.oy },
        { x: box.ox + box.w, y: box.oy + box.h },
        { x: box.ox, y: box.oy + box.h }
    ];
}

/**
 * World AABB for fit / camera (asset-local coords).
 * @param {object} props
 * @param {number} aw
 * @param {number} ah
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function getColliderLocalBounds(props, aw, ah) {
    const shape = resolveColliderShape(props);
    if (shape === 'circle') {
        const { cx, cy, r } = resolveCircle(props, aw, ah);
        return { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
    }
    if (shape === 'freeform') {
        const pts = resolveFreeformPoints(props) || defaultFreeformPoints(aw, ah, props);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        if (!Number.isFinite(minX)) {
            return { minX: 0, minY: 0, maxX: Math.max(1, aw), maxY: Math.max(1, ah) };
        }
        return { minX, minY, maxX, maxY };
    }
    const box = resolveBox(props, aw, ah);
    return {
        minX: box.ox,
        minY: box.oy,
        maxX: box.ox + box.w,
        maxY: box.oy + box.h
    };
}

/**
 * Hit-test freeform vertex. Returns index or -1.
 * @param {{ x: number, y: number }[]} points
 * @param {number} wx
 * @param {number} wy
 * @param {number} hitR world radius
 */
export function hitTestVertex(points, wx, wy, hitR) {
    if (!points?.length) return -1;
    const r2 = hitR * hitR;
    let best = -1;
    let bestD = r2;
    for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - wx;
        const dy = points[i].y - wy;
        const d = dx * dx + dy * dy;
        if (d <= bestD) {
            bestD = d;
            best = i;
        }
    }
    return best;
}

/**
 * Engine-space AABB (entity origin + local shape).
 * @param {{ x: number, y: number, width: number, height: number }} entity
 * @param {object} properties
 */
export function getColliderEntityBounds(entity, properties = {}) {
    const aw = entity.width || 1;
    const ah = entity.height || 1;
    const local = getColliderLocalBounds(properties, aw, ah);
    return {
        x: entity.x + local.minX,
        y: entity.y + local.minY,
        width: Math.max(1, local.maxX - local.minX),
        height: Math.max(1, local.maxY - local.minY)
    };
}
