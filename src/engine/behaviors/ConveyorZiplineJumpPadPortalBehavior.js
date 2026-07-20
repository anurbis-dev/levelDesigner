import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * One component type, four mutually-exclusive `kind`s — same "shape enum" convention as
 * collider's box|circle|freeform, not four separate component types, since all four are the
 * same underlying shape (a Volume/Trigger zone that never blocks movement, isOverlapping()
 * always false, same duck-type as ClimbableLadderBehavior) with a different effect on
 * scene.player contact. Only reacts to scene.player (same "not generalized to arbitrary
 * entities, not requested" discipline as pickup/checkpointSavePoint/mountableVehicleSeat).
 *
 * - conveyor: continuous push while overlapping, every tick (a belt).
 * - jumpPad: one-shot instant position offset on entering the zone (edge-detected) — this
 *   engine has no gravity/velocity integrator (see ClimbableLadderBehavior design rationale),
 *   so an "impulse" is modelled as an instant displacement, not a physics force.
 * - zipline: hijacks player movement (same scene.<flag> guard pattern as scene.mountedVehicle/
 *   scene.dialogueActive in PlayerMovementBehavior) and rides the player at `speed` toward a
 *   fixed target point until arrival, then returns control.
 * - portal: one-shot teleport to another level object (`targetId`, resolved the same way
 *   Event Graph's Teleport action does: scene.getAllEntities().find(e => e.id === targetId)),
 *   edge-detected so standing inside the zone doesn't refire every tick. Two portals wired to
 *   point directly at each other can still ping-pong once on entry — out of scope to prevent
 *   (author's responsibility to place destination points apart), same "not requested" call as
 *   the rest of §7.
 */
export class ConveyorZiplineJumpPadPortalBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.kind = this.properties.kind ?? 'conveyor'; // 'conveyor' | 'zipline' | 'jumpPad' | 'portal'
        this.speed = this.properties.speed ?? 100;
        this.directionX = this.properties.directionX ?? 1;
        this.directionY = this.properties.directionY ?? 0;
        this.targetOffsetX = this.properties.targetOffsetX ?? 0;
        this.targetOffsetY = this.properties.targetOffsetY ?? -200;
        this.launchOffsetX = this.properties.launchOffsetX ?? 0;
        this.launchOffsetY = this.properties.launchOffsetY ?? -96;
        this.targetId = this.properties.targetId ?? '';
        this._originX = entity.x;
        this._originY = entity.y;
        this._wasOverlapping = false;
        this._riding = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    update(dt, scene) {
        const player = scene.player;
        if (!player) return;

        if (this.kind === 'zipline') {
            this._updateZipline(dt, scene, player);
            return;
        }

        const overlapping = rectsIntersect(this.getBounds(), getEntityBounds(player, {}));
        const entering = overlapping && !this._wasOverlapping;
        this._wasOverlapping = overlapping;

        if (this.kind === 'conveyor') {
            if (overlapping) {
                player.x += this.directionX * this.speed * dt;
                player.y += this.directionY * this.speed * dt;
            }
            return;
        }

        if (this.kind === 'jumpPad') {
            if (entering) {
                player.x += this.launchOffsetX;
                player.y += this.launchOffsetY;
            }
            return;
        }

        if (this.kind === 'portal') {
            if (!entering) return;
            const target = scene.getAllEntities().find(e => e.id === this.targetId);
            if (!target) return;
            player.x = target.x;
            player.y = target.y;
        }
    }

    _updateZipline(dt, scene, player) {
        if (this._riding) {
            const targetX = this._originX + this.targetOffsetX;
            const targetY = this._originY + this.targetOffsetY;
            const dx = targetX - player.x;
            const dy = targetY - player.y;
            const dist = Math.hypot(dx, dy);
            const step = this.speed * dt;
            if (dist <= step) {
                player.x = targetX;
                player.y = targetY;
                this._riding = false;
                scene.zipliningEntity = null;
            } else {
                player.x += (dx / dist) * step;
                player.y += (dy / dist) * step;
            }
            return;
        }

        if (scene.zipliningEntity && scene.zipliningEntity !== this.entity) return;
        const overlapping = rectsIntersect(this.getBounds(), getEntityBounds(player, {}));
        const entering = overlapping && !this._wasOverlapping;
        this._wasOverlapping = overlapping;
        if (!entering) return;
        this._riding = true;
        scene.zipliningEntity = this.entity;
    }
}
