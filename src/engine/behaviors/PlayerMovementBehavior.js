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

        const axis = input.getAxis();
        if (axis.x === 0 && axis.y === 0) return;

        const length = Math.hypot(axis.x, axis.y);
        const dx = (axis.x / length) * this.speed * dt;
        const dy = (axis.y / length) * this.speed * dt;

        const solids = scene.getAllEntities()
            .filter(candidate => candidate !== this.entity)
            .map(candidate => candidate.behaviors.find(b => typeof b.getBounds === 'function'))
            .filter(Boolean)
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
