import { Behavior } from './Behavior.js';

/**
 * Kinematic waypoint patrol: moves entity.x/y toward each `waypoints` entry at constant
 * `speed`, no collision checks against solids — a patrol NPC / moving platform is meant to
 * pass through level geometry, not be blocked by it (same "not requested, out of scope" call
 * as MovablePushable's box-pushes-box chain). Waypoints are offsets from the entity's spawn
 * position (same asset-local convention as collider's freeform `points`), so one path config
 * can be reused at different level placements; waypoints[0] is conventionally {x:0,y:0} (the
 * spawn spot itself) — the entity starts heading toward waypoints[1].
 *
 * §7 backlog (pathSpline, Tier 1): `interpolation:'smooth'` curves through waypoints via
 * Catmull-Rom instead of straight segments (AssetTypes.js pathSpline description: "Point
 * sequence with interpolation"). No separate `pathSpline` asset/registry — `ProjectLoader
 * .assetsById` is still an intentionally empty Map (see its header comment), so the curve
 * config lives inline on `waypoints`/`interpolation`, same convention as `PlaySound`'s params.
 * Segment progress `_segT` is driven by straight-line chord length, not true arc length along
 * the curve — a pragmatic approximation (speed varies slightly through curved segments), not
 * requested to be exact. Boundary control points are clamped (duplicate the endpoint) rather
 * than wrapped, including for `mode:'loop'` — the curve flattens slightly near the first/last
 * waypoint instead of wrapping smoothly; out of scope for this pass.
 */
export class PathFollowerBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.waypoints = Array.isArray(this.properties.waypoints) ? this.properties.waypoints : [];
        this.speed = this.properties.speed ?? 100;
        this.mode = this.properties.mode ?? 'loop'; // 'loop' | 'pingpong' | 'once'
        this.waitAtWaypoint = this.properties.waitAtWaypoint ?? 0;
        this.interpolation = this.properties.interpolation ?? 'linear'; // 'linear' | 'smooth'
        this._originX = entity.x;
        this._originY = entity.y;
        this._fromIndex = 0;
        this._targetIndex = this.waypoints.length > 1 ? 1 : -1;
        this._direction = 1;
        this._waitRemaining = 0;
        this._segT = 0;
    }

    update(dt, scene) {
        if (this._targetIndex < 0) return;
        if (this._waitRemaining > 0) {
            this._waitRemaining -= dt;
            return;
        }

        if (this.interpolation === 'smooth') {
            this._updateSmooth(dt);
        } else {
            this._updateLinear(dt);
        }
    }

    _updateLinear(dt) {
        const target = this._waypointPos(this._targetIndex);
        const dx = target.x - this.entity.x;
        const dy = target.y - this.entity.y;
        const dist = Math.hypot(dx, dy);
        const step = this.speed * dt;

        if (dist <= step) {
            this.entity.x = target.x;
            this.entity.y = target.y;
            this._waitRemaining = this.waitAtWaypoint;
            this._advance();
        } else {
            this.entity.x += (dx / dist) * step;
            this.entity.y += (dy / dist) * step;
        }
    }

    _updateSmooth(dt) {
        const from = this._waypointPos(this._fromIndex);
        const to = this._waypointPos(this._targetIndex);
        const chordLen = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        this._segT += (this.speed * dt) / chordLen;

        if (this._segT >= 1) {
            this.entity.x = to.x;
            this.entity.y = to.y;
            this._segT = 0;
            this._waitRemaining = this.waitAtWaypoint;
            this._advance();
            return;
        }

        const forward = this._targetIndex >= this._fromIndex;
        const last = this.waypoints.length - 1;
        const clamp = (i) => Math.max(0, Math.min(last, i));
        const p0 = this._waypointPos(clamp(forward ? this._fromIndex - 1 : this._fromIndex + 1));
        const p3 = this._waypointPos(clamp(forward ? this._targetIndex + 1 : this._targetIndex - 1));
        const pos = PathFollowerBehavior._catmullRom(p0, from, to, p3, this._segT);
        this.entity.x = pos.x;
        this.entity.y = pos.y;
    }

    _waypointPos(index) {
        const wp = this.waypoints[index];
        return { x: this._originX + (wp.x ?? 0), y: this._originY + (wp.y ?? 0) };
    }

    static _catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const axis = (a0, a1, a2, a3) => 0.5 * (
            (2 * a1) +
            (-a0 + a2) * t +
            (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 +
            (-a0 + 3 * a1 - 3 * a2 + a3) * t3
        );
        return { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) };
    }

    _advance() {
        this._fromIndex = this._targetIndex;
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
