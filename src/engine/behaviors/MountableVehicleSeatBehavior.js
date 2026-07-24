import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect, collectSolidBlockers } from './AABB.js';

/**
 * Player mount point — hands movement control to this entity (the "vehicle") while mounted.
 * Self-contained like PlayerMovementBehavior itself: polls scene.input directly (own
 * edge-detected interact action, independent of EventGraphRuntime's own interact tracking)
 * rather than requiring an authored OnInteract Event Graph node, same discipline as
 * pickup/damageHealth not requiring an Event Graph wire-up. Uses isActionDown('interact')
 * so level.inputMap remaps apply (fallback isDown('e') for legacy mocks). getBounds() makes
 * the parked vehicle solid (players must mount to pass "through" it, same as ColliderBehavior)
 * until mounted, at which point scene.player is hidden and kept snapped to the vehicle's
 * position (camera, which follows scene.player by default, keeps tracking correctly with zero
 * changes to CameraBehavior). PlayerMovementBehavior early-returns while scene.mountedVehicle
 * is set (same pattern as its existing scene.dialogueActive pause).
 */
export class MountableVehicleSeatBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.mountRadius = this.properties.mountRadius ?? 32;
        this.speed = this.properties.speed ?? 150;
        this._mounted = false;
        this._interactWasDown = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    update(dt, scene) {
        const input = scene.input;
        const player = scene.player;
        if (!input || !player) return;
        // Another vehicle is currently mounted — ignore input so two seats in range of each
        // other on the same tick can't both claim the mount (see MountableVehicleSeatBehavior
        // test 'ignores a second vehicle...').
        if (scene.mountedVehicle && scene.mountedVehicle !== this.entity) return;

        const pressedNow = typeof input.isActionDown === 'function'
            ? input.isActionDown('interact')
            : input.isDown('e');
        const justPressed = pressedNow && !this._interactWasDown;
        this._interactWasDown = pressedNow;

        if (this._mounted) {
            this._driveVehicle(dt, scene);
            if (justPressed) this._dismount(scene);
            return;
        }

        if (!justPressed || !this._inRange(player)) return;
        this._mount(scene);
    }

    _inRange(player) {
        const cx = this.entity.x + this.entity.width / 2;
        const cy = this.entity.y + this.entity.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        return Math.hypot(px - cx, py - cy) <= this.mountRadius;
    }

    _mount(scene) {
        this._mounted = true;
        scene.mountedVehicle = this.entity;
        scene.player.visible = false;
        scene.player.x = this.entity.x;
        scene.player.y = this.entity.y;
    }

    // Dismounts to a fixed offset beside the vehicle — not a free-tile search, out of scope for
    // this pass (author can leave room beside expected parking spots).
    _dismount(scene) {
        this._mounted = false;
        scene.mountedVehicle = null;
        const player = scene.player;
        player.x = this.entity.x + this.entity.width + 4;
        player.y = this.entity.y;
        player.visible = true;
    }

    _driveVehicle(dt, scene) {
        const axis = scene.input.getAxis();
        if (axis.x === 0 && axis.y === 0) return;
        const length = Math.hypot(axis.x, axis.y);
        const dx = (axis.x / length) * this.speed * dt;
        const dy = (axis.y / length) * this.speed * dt;

        const solids = collectSolidBlockers(scene, this.entity, this.properties.collidesWith);

        this._moveAxis(dx, 0, solids);
        this._moveAxis(0, dy, solids);

        scene.player.x = this.entity.x;
        scene.player.y = this.entity.y;
    }

    _moveAxis(dx, dy, solids) {
        if (dx === 0 && dy === 0) return;
        this.entity.x += dx;
        this.entity.y += dy;
        const bounds = this.getBounds();
        const blocked = solids.some(solid => rectsIntersect(bounds, solid.getBounds()));
        if (blocked) {
            this.entity.x -= dx;
            this.entity.y -= dy;
        }
    }
}
