import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, matchesLayer } from './AABB.js';

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
            if (!colliderBehavior || !colliderBehavior.enabled) continue;
            if (!matchesLayer(this.properties.collidesWith, colliderBehavior.properties?.layer)) continue;
            if (rectsIntersect(bounds, colliderBehavior.getBounds())) {
                currentlyInside.add(other.id);
            }
        }

        const entered = [...currentlyInside].filter(id => !this._overlapping.has(id));
        const exited = [...this._overlapping].filter(id => !currentlyInside.has(id));
        this._overlapping = currentlyInside;
        return { entered, exited };
    }

    // Feeds Event Graph's OnCollisionEnter/OnCollisionExit (Фаза D) — checkEntities() itself
    // stays pure/testable (see tests/engine/TriggerBehavior.test.js), this is the only place
    // enter/exit results get consumed at runtime.
    update(dt, scene) {
        const { entered, exited } = this.checkEntities(scene.getAllEntities());
        const runtime = scene.eventGraphRuntime;
        if (!runtime || (entered.length === 0 && exited.length === 0)) return;

        const allEntities = scene.getAllEntities();
        for (const id of entered) {
            runtime.notifyCollision('Enter', this.entity.id, allEntities.find(e => e.id === id));
        }
        for (const id of exited) {
            runtime.notifyCollision('Exit', this.entity.id, allEntities.find(e => e.id === id));
        }
    }

    isOverlapping(entityId) {
        return this._overlapping.has(entityId);
    }
}
