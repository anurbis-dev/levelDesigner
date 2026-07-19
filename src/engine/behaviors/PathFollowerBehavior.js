import { Behavior } from './Behavior.js';

/**
 * Kinematic waypoint patrol: moves entity.x/y toward each `waypoints` entry at constant
 * `speed`, no collision checks against solids — a patrol NPC / moving platform is meant to
 * pass through level geometry, not be blocked by it (same "not requested, out of scope" call
 * as MovablePushable's box-pushes-box chain). Waypoints are offsets from the entity's spawn
 * position (same asset-local convention as collider's freeform `points`), so one path config
 * can be reused at different level placements; waypoints[0] is conventionally {x:0,y:0} (the
 * spawn spot itself) — the entity starts heading toward waypoints[1].
 */
export class PathFollowerBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.waypoints = Array.isArray(this.properties.waypoints) ? this.properties.waypoints : [];
        this.speed = this.properties.speed ?? 100;
        this.mode = this.properties.mode ?? 'loop'; // 'loop' | 'pingpong' | 'once'
        this.waitAtWaypoint = this.properties.waitAtWaypoint ?? 0;
        this._originX = entity.x;
        this._originY = entity.y;
        this._targetIndex = this.waypoints.length > 1 ? 1 : -1;
        this._direction = 1;
        this._waitRemaining = 0;
    }

    update(dt, scene) {
        if (this._targetIndex < 0) return;
        if (this._waitRemaining > 0) {
            this._waitRemaining -= dt;
            return;
        }

        const target = this.waypoints[this._targetIndex];
        const targetX = this._originX + (target.x ?? 0);
        const targetY = this._originY + (target.y ?? 0);
        const dx = targetX - this.entity.x;
        const dy = targetY - this.entity.y;
        const dist = Math.hypot(dx, dy);
        const step = this.speed * dt;

        if (dist <= step) {
            this.entity.x = targetX;
            this.entity.y = targetY;
            this._waitRemaining = this.waitAtWaypoint;
            this._advance();
        } else {
            this.entity.x += (dx / dist) * step;
            this.entity.y += (dy / dist) * step;
        }
    }

    _advance() {
        const last = this.waypoints.length - 1;
        if (this.mode === 'once') {
            this._targetIndex = this._targetIndex < last ? this._targetIndex + 1 : -1;
            return;
        }
        if (this.mode === 'pingpong') {
            let next = this._targetIndex + this._direction;
            if (next > last || next < 0) {
                this._direction *= -1;
                next = this._targetIndex + this._direction;
            }
            this._targetIndex = next;
            return;
        }
        this._targetIndex = this._targetIndex >= last ? 0 : this._targetIndex + 1;
    }
}
