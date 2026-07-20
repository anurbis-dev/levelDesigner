import { Behavior } from './Behavior.js';
import { getEntityBounds } from './AABB.js';

/**
 * Ladder zone. Never solid — isOverlapping() exists purely so PlayerMovementBehavior's existing
 * solids filter (which already excludes anything exposing isOverlapping, e.g. TriggerBehavior)
 * skips this zone too, no filter changes needed. getBounds()/getClimbSpeed() are the duck-typed
 * hooks PlayerMovementBehavior._findLadder() looks for each tick: while the player's bounds
 * intersect a ladder zone, movement is restricted to vertical-only at climbSpeed instead of the
 * normal walk speed/free 8-direction movement (see PlayerMovementBehavior.update()).
 */
export class ClimbableLadderBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.climbSpeed = this.properties.climbSpeed ?? 100;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    getClimbSpeed() {
        return this.climbSpeed;
    }

    isOverlapping() {
        return false;
    }
}
