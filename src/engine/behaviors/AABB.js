/**
 * Shared axis-aligned bounding box helpers for Collider/Trigger behaviors — kept as
 * pure functions so both behaviors compute bounds identically without inheriting
 * from each other or duck-typing a shared base.
 */

/**
 * @param {import('../Entity.js').Entity} entity
 * @param {object} properties - component properties: optional offsetX/offsetY/width/height
 *   override of the entity's own position/size (collider box ≠ visual sprite size).
 *   shape=circle|freeform → AABB of that shape (narrow-phase still rect for MVP).
 */
export function getEntityBounds(entity, properties = {}) {
    const shape = properties.shape;
    if (shape === 'circle' || shape === 'freeform') {
        // Lazy import path avoided — inline AABB so engine stays free of UI modules
        return boundsFromShape(entity, properties);
    }
    const offsetX = properties.offsetX || 0;
    const offsetY = properties.offsetY || 0;
    return {
        x: entity.x + offsetX,
        y: entity.y + offsetY,
        width: properties.width ?? entity.width,
        height: properties.height ?? entity.height
    };
}

/**
 * @param {{ x: number, y: number, width: number, height: number }} entity
 * @param {object} properties
 */
function boundsFromShape(entity, properties) {
    const aw = entity.width || 1;
    const ah = entity.height || 1;
    if (properties.shape === 'circle') {
        const ox = Number(properties.offsetX) || 0;
        const oy = Number(properties.offsetY) || 0;
        let r;
        if (properties.radius != null && properties.radius !== '') {
            r = Math.max(0.5, Number(properties.radius) || 0.5);
            return { x: entity.x + ox - r, y: entity.y + oy - r, width: r * 2, height: r * 2 };
        }
        const w = properties.width != null ? Number(properties.width) : aw;
        const h = properties.height != null ? Number(properties.height) : ah;
        r = Math.max(0.5, Math.min(w, h) / 2);
        return {
            x: entity.x + ox + w / 2 - r,
            y: entity.y + oy + h / 2 - r,
            width: r * 2,
            height: r * 2
        };
    }
    // freeform: AABB of points
    const pts = Array.isArray(properties.points) ? properties.points : [];
    if (pts.length === 0) {
        return {
            x: entity.x,
            y: entity.y,
            width: aw,
            height: ah
        };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
        const x = Number(p?.x);
        const y = Number(p?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }
    if (!Number.isFinite(minX)) {
        return { x: entity.x, y: entity.y, width: aw, height: ah };
    }
    return {
        x: entity.x + minX,
        y: entity.y + minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY)
    };
}

export function rectsIntersect(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * @param {string[]|undefined} collidesWith - categories the reacting side accepts; empty/undefined = all (back-compat default)
 * @param {string|undefined} otherLayer - the candidate's own `layer` category
 */
export function matchesLayer(collidesWith, otherLayer) {
    if (!collidesWith || collidesWith.length === 0) return true;
    return collidesWith.includes(otherLayer);
}
