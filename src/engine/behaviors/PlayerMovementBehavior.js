import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, collectSolidBlockers } from './AABB.js';

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
        if (scene.cutsceneActive) return; // §7 sequenceCutscene: lockPlayer while timeline plays
        if (scene.mountedVehicle) return; // §7 mountableVehicleSeat: vehicle drives instead
        if (scene.zipliningEntity) return; // §7 conveyorZiplineJumpPadPortal: zipline drives instead

        const axis = input.getAxis();
        // §7 climbableLadder: while overlapping a ladder zone, horizontal input is ignored
        // (climb straight up/down) and speed switches to the ladder's own climbSpeed.
        const ladder = this._findLadder(scene);
        const effectiveAxis = ladder ? { x: 0, y: axis.y } : axis;
        const speed = ladder ? ladder.getClimbSpeed() : this.speed;
        const isMoving = effectiveAxis.x !== 0 || effectiveAxis.y !== 0;
        // Фаза F: same level-scope variable store as Event Graph/Dialogue (no separate
        // per-instance channel) — SpriteAnimationBehavior state machines read 'speed' to
        // drive idle<->walk transitions.
        scene.eventGraphRuntime?.setVariable('speed', isMoving ? speed : 0);
        if (!isMoving) return;

        const length = Math.hypot(effectiveAxis.x, effectiveAxis.y);
        const dx = (effectiveAxis.x / length) * speed * dt;
        const dy = (effectiveAxis.y / length) * speed * dt;

        // TriggerBehavior also exposes getBounds() but must never block movement —
        // sensors use isOverlapping; tilemaps expand via getSolidRects (collectSolidBlockers).
        const solids = collectSolidBlockers(scene, this.entity, this.properties.collidesWith);

        this._moveAxis(dx, 0, solids, scene);
        this._moveAxis(0, dy, solids, scene);
    }

    // Discrete end-of-step overlap check, not swept collision — assumes a single tick's
    // movement distance stays small relative to solid size (true at any normal frame rate;
    // an extreme dt spike combined with a thin solid could still tunnel through it).
    _moveAxis(dx, dy, solids, scene) {
        if (dx === 0 && dy === 0) return;
        this.entity.x += dx;
        this.entity.y += dy;
        const bounds = getEntityBounds(this.entity, {});
        let blockers = solids.filter(solid => rectsIntersect(bounds, solid.getBounds()));
        // MovablePushableBehavior duck-types tryPush (same convention as TriggerBehavior's
        // isOverlapping) — give each blocker a chance to slide out of the way before we
        // decide the step is actually blocked.
        for (const blocker of blockers) {
            if (typeof blocker.tryPush === 'function') blocker.tryPush(dx, dy, scene);
        }
        const blocked = solids.some(solid => rectsIntersect(bounds, solid.getBounds()));
        if (blocked) {
            this.entity.x -= dx;
            this.entity.y -= dy;
        }
    }

    // Duck-typed on getClimbSpeed() (ClimbableLadderBehavior) — mirrors the getBounds()/
    // tryPush() scans above, just a different marker method.
    _findLadder(scene) {
        const bounds = getEntityBounds(this.entity, {});
        return scene.getAllEntities()
            .map(candidate => candidate.behaviors?.find(b => typeof b.getClimbSpeed === 'function'))
            .filter(Boolean)
            .filter(ladder => ladder.enabled)
            .find(ladder => rectsIntersect(bounds, ladder.getBounds()));
    }
}
