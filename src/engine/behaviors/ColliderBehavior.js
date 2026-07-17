import { Behavior } from './Behavior.js';
import { getEntityBounds } from './AABB.js';

/**
 * Collision shape — editor supports box | circle | freeform.
 * Runtime still uses AABB of the shape (see docs/RUNTIME_SCHEMA.md `collider`).
 */
export class ColliderBehavior extends Behavior {
    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }
}
