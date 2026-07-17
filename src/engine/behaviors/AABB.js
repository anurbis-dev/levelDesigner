/**
 * Shared axis-aligned bounding box helpers for Collider/Trigger behaviors — kept as
 * pure functions so both behaviors compute bounds identically without inheriting
 * from each other or duck-typing a shared base.
 */

/**
 * @param {import('../Entity.js').Entity} entity
 * @param {object} properties - component properties: optional offsetX/offsetY/width/height
 *   override of the entity's own position/size (collider box ≠ visual sprite size).
 */
export function getEntityBounds(entity, properties = {}) {
    const offsetX = properties.offsetX || 0;
    const offsetY = properties.offsetY || 0;
    return {
        x: entity.x + offsetX,
        y: entity.y + offsetY,
        width: properties.width ?? entity.width,
        height: properties.height ?? entity.height
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
