import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, collectSolidBlockers } from './AABB.js';

/**
 * Sokoban-style box: solid like ColliderBehavior (getBounds() blocks movers by default), but
 * exposes tryPush(dx,dy,scene) — a duck-typed hook PlayerMovementBehavior calls (mirroring the
 * isOverlapping hook TriggerBehavior already uses) when its attempted step would collide with
 * this entity. Slides this entity by the same (dx,dy); succeeds only if the destination is
 * itself clear of every other solid, so a box can't be pushed through a wall or another box.
 */
export class MovablePushableBehavior extends Behavior {
    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    tryPush(dx, dy, scene) {
        this.entity.x += dx;
        this.entity.y += dy;
        const bounds = this.getBounds();
        const solids = collectSolidBlockers(scene, this.entity, this.properties.collidesWith);

        const blocked = solids.some(solid => rectsIntersect(bounds, solid.getBounds()));
        if (blocked) {
            this.entity.x -= dx;
            this.entity.y -= dy;
            return false;
        }
        return true;
    }
}
