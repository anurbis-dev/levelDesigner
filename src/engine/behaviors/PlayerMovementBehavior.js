import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, matchesLayer } from './AABB.js';

/**
 * Drives the runtime player entity from scene.input (see Scene.spawnPlayer()). Not a
 * component type in the level schema — this behavior only exists on the synthetic
 * player entity the engine creates at the playerStart marker's position, never on
 * entities parsed from level JSON via EntityFactory/BehaviorRegistry.
 * Movement resolves per-axis against every other entity exposing getBounds() (duck-typed,
 * same convention as TriggerBehavior) so a diagonal move can still slide along a wall.
 */
export class PlayerMovementBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.speed = this.properties.speed ?? 200; // px/sec
    }

    update(dt, scene) {
        const input = scene.input;
        if (!input || dt <= 0) return;
        if (scene.dialogueActive) return; // Фаза E: movement pauses while a dialogue is open

        const axis = input.getAxis();
        const isMoving = axis.x !== 0 || axis.y !== 0;
        // Фаза F: same level-scope variable store as Event Graph/Dialogue (no separate
        // per-instance channel) — SpriteAnimationBehavior state machines read 'speed' to
        // drive idle<->walk transitions.
        scene.eventGraphRuntime?.setVariable('speed', isMoving ? this.speed : 0);
        if (!isMoving) return;

        const length = Math.hypot(axis.x, axis.y);
        const dx = (axis.x / length) * this.speed * dt;
        const dy = (axis.y / length) * this.speed * dt;

        // TriggerBehavior also exposes getBounds() (so trigger-vs-trigger/collider overlap
        // checks can duck-type it the same way) but must never itself block movement — a
        // trigger zone is a walk-through sensor, distinguished here by isOverlapping (same
        // duck-typing tests use to find "the trigger" among an entity's behaviors).
        const solids = scene.getAllEntities()
            .filter(candidate => candidate !== this.entity)
            .map(candidate => candidate.behaviors.find(b => typeof b.getBounds === 'function'))
            .filter(Boolean)
            .filter(solid => solid.enabled)
            .filter(solid => typeof solid.isOverlapping !== 'function')
            .filter(solid => matchesLayer(this.properties.collidesWith, solid.properties?.layer));

        this._moveAxis(dx, 0, solids);
        this._moveAxis(0, dy, solids);
    }

    // Discrete end-of-step overlap check, not swept collision — assumes a single tick's
    // movement distance stays small relative to solid size (true at any normal frame rate;
    // an extreme dt spike combined with a thin solid could still tunnel through it).
    _moveAxis(dx, dy, solids) {
        if (dx === 0 && dy === 0) return;
        this.entity.x += dx;
        this.entity.y += dy;
        const bounds = getEntityBounds(this.entity, {});
        const blocked = solids.some(solid => rectsIntersect(bounds, solid.getBounds()));
        if (blocked) {
            this.entity.x -= dx;
            this.entity.y -= dy;
        }
    }
}
