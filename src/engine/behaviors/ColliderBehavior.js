import { Behavior } from './Behavior.js';
import { getEntityBounds } from './AABB.js';

/** Collision shape — MVP supports rect only (see docs/RUNTIME_SCHEMA.md `collider`). */
export class ColliderBehavior extends Behavior {
    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }
}
