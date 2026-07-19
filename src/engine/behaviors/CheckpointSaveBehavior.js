import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * Self-contained checkpoint / save point (same AABB-overlap discipline as PickupBehavior):
 * on overlap with scene.player, becomes the active checkpoint — deactivates whichever
 * checkpoint was previously active (`scene.activeCheckpoint`, single source of truth) and
 * records its own position as `scene.checkpointPosition`. `Scene.respawnPlayer()` reads that
 * position (falling back to the playerStart marker) when GameEngine notices `scene.player`
 * is gone (see DamageHealthBehavior.destroyOnDeath).
 */
export class CheckpointSaveBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.isActive = false;
    }

    update(dt, scene) {
        if (this.isActive || !scene.player) return;
        const bounds = getEntityBounds(this.entity, this.properties);
        const playerBounds = getEntityBounds(scene.player, {});
        if (!rectsIntersect(bounds, playerBounds)) return;
        this.activate(scene);
    }

    /** Public hook (future Event Graph "ActivateCheckpoint" action) — also called on player overlap. */
    activate(scene) {
        if (scene.activeCheckpoint && scene.activeCheckpoint !== this) {
            scene.activeCheckpoint.isActive = false;
        }
        this.isActive = true;
        scene.activeCheckpoint = this;
        scene.checkpointPosition = { x: this.entity.x, y: this.entity.y };
    }
}
