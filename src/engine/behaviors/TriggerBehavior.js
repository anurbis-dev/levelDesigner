import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * Zone reacting to enter/exit of any other entity that exposes getBounds() (duck-typed —
 * not limited to ColliderBehavior specifically, any future behavior with getBounds() counts).
 */
export class TriggerBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this._overlapping = new Set();
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    /**
     * @param {import('../Entity.js').Entity[]} candidates - entities to test for overlap
     * @returns {{entered: string[], exited: string[]}}
     */
    checkEntities(candidates) {
        const bounds = this.getBounds();
        const currentlyInside = new Set();

        for (const other of candidates) {
            if (other === this.entity) continue;
            const colliderBehavior = other.behaviors?.find(b => typeof b.getBounds === 'function');
            if (!colliderBehavior) continue;
            if (rectsIntersect(bounds, colliderBehavior.getBounds())) {
                currentlyInside.add(other.id);
            }
        }

        const entered = [...currentlyInside].filter(id => !this._overlapping.has(id));
        const exited = [...this._overlapping].filter(id => !currentlyInside.has(id));
        this._overlapping = currentlyInside;
        return { entered, exited };
    }

    update(dt, scene) {
        this.checkEntities(scene.getAllEntities());
    }

    isOverlapping(entityId) {
        return this._overlapping.has(entityId);
    }
}
