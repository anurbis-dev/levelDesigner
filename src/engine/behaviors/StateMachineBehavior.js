import { Behavior } from './Behavior.js';
import { compareOp, evalSpec } from '../eventgraph/ConditionEvaluator.js';

/**
 * AI finite-state machine for NPCs/mechanisms (patrol/chase) — §7 backlog `stateMachineBehavior`,
 * explicitly a different component from Фаза F's animation-clip state machine on
 * SpriteAnimationBehavior (that one switches sprite clips; this one moves the entity). Reuses
 * the same "ordered, first-match transition" convention and `evalSpec`/ConditionEvaluator var
 * condition shape `{var, op, value}` as SpriteAnimationBehavior — the shared mechanism the
 * backlog note asked to reuse — plus an AI-specific `{type:'distance', op, value}` condition
 * (distance from this entity to `scene.player`, the only chase/flee target supported this pass,
 * same "no generic target list, not requested" call as pickup/mountableVehicleSeat hard-coding
 * scene.player).
 *
 * Each state's `movement` drives per-tick motion, no collision checks against solids (same
 * "patrol NPC passes through geometry, not blocked by it" call as PathFollowerBehavior):
 * - 'patrol': ping-pongs between `waypoints` (asset-local offsets from spawn, same convention
 *   as PathFollowerBehavior/collider freeform points), waypoints[0] conventionally {x:0,y:0}.
 * - 'chase': moves straight toward scene.player at `speed`.
 * - 'flee': moves straight away from scene.player at `speed`.
 * - unset/'idle': no movement — just evaluates transitions.
 *
 * `setState(name)` is a public duck-typed hook (mirrors MovablePushable's tryPush / Spawner's
 * spawnOne) for a future Event Graph "SetAIState" action — not wired to any node yet.
 *
 * `type:'distance'` is gated by a facing cone so the NPC doesn't "see" behind itself
 * (`_isWithinSight`, default 180° — front half, override per-condition via `fov` degrees;
 * `fov:360` restores the old fully-omnidirectional check). Facing (`_facingX`/`_facingY`) is
 * the entity's last actual movement heading, updated by `_setFacing` in patrol/chase/flee —
 * same one-tick-lag convention already used elsewhere in this engine (e.g. PlayerMovementBehavior
 * writing `speed` for Фаза F transitions). Initial facing defaults to (1,0) (right), overridable
 * via `properties.facingX`/`facingY` for a stationary guard's starting orientation.
 */
export class StateMachineBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.states = Array.isArray(this.properties.states) ? this.properties.states : [];
        this._originX = entity.x;
        this._originY = entity.y;
        this._currentStateName = this.properties.defaultState || this.states[0]?.name || null;
        this._patrolIndex = -1;
        this._patrolDirection = 1;
        this._facingX = this.properties.facingX ?? 1;
        this._facingY = this.properties.facingY ?? 0;
        this._resetPatrolProgress(this._stateByName(this._currentStateName));
    }

    update(dt, scene) {
        const state = this._stateByName(this._currentStateName);
        if (!state) return;

        this._checkTransitions(state, scene);
        const active = this._stateByName(this._currentStateName);
        this._runMovement(active, dt, scene);
    }

    /** @returns {string|null} name of the currently active state. */
    get currentStateName() {
        return this._currentStateName;
    }

    /** Forces a state change (see class docstring for the intended Event Graph hook). */
    setState(name) {
        if (name === this._currentStateName) return;
        const next = this._stateByName(name);
        if (!next) {
            console.warn(`[engine] StateMachineBehavior.setState('${name}'): no such state`);
            return;
        }
        this._currentStateName = name;
        this._resetPatrolProgress(next);
    }

    _checkTransitions(state, scene) {
        for (const transition of state.transitions || []) {
            if (this._evalCondition(transition.condition, scene)) {
                this.setState(transition.target);
                return;
            }
        }
    }

    _evalCondition(condition, scene) {
        if (!condition) return false;
        if (condition.type === 'distance') {
            if (!scene?.player) return false;
            const dx = scene.player.x - this.entity.x;
            const dy = scene.player.y - this.entity.y;
            const dist = Math.hypot(dx, dy);
            if (!compareOp(dist, condition.op, condition.value)) return false;
            return this._isWithinSight(dx, dy, dist, condition.fov);
        }
        if (!scene?.eventGraphRuntime) return false;
        return evalSpec(condition, scene.eventGraphRuntime);
    }

    /** @returns {boolean} whether (dx,dy) at distance `dist` falls within a `fov`-degree cone centered on the current facing (default 180° — excludes the rear half). */
    _isWithinSight(dx, dy, dist, fov = 180) {
        if (dist === 0) return true;
        const facingLen = Math.hypot(this._facingX, this._facingY) || 1;
        const dot = (dx / dist) * (this._facingX / facingLen) + (dy / dist) * (this._facingY / facingLen);
        const angleDeg = Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
        return angleDeg <= fov / 2;
    }

    /** Updates the facing heading from a movement direction; no-op when not actually moving (dist 0). */
    _setFacing(dx, dy, dist) {
        if (dist <= 0) return;
        this._facingX = dx / dist;
        this._facingY = dy / dist;
    }

    _runMovement(state, dt, scene) {
        if (!state || dt <= 0) return;
        switch (state.movement) {
            case 'patrol': this._runPatrol(state, dt); break;
            case 'chase': this._moveToward(scene?.player, state.speed ?? 100, dt); break;
            case 'flee': this._moveAway(scene?.player, state.speed ?? 100, dt); break;
            default: break;
        }
    }

    _runPatrol(state, dt) {
        const waypoints = state.waypoints || [];
        if (this._patrolIndex < 0) return;
        const target = waypoints[this._patrolIndex];
        const targetX = this._originX + (target.x ?? 0);
        const targetY = this._originY + (target.y ?? 0);
        const dx = targetX - this.entity.x;
        const dy = targetY - this.entity.y;
        const dist = Math.hypot(dx, dy);
        this._setFacing(dx, dy, dist);
        const step = (state.speed ?? 100) * dt;

        if (dist <= step) {
            this.entity.x = targetX;
            this.entity.y = targetY;
            this._advancePatrol(waypoints);
        } else {
            this.entity.x += (dx / dist) * step;
            this.entity.y += (dy / dist) * step;
        }
    }

    _advancePatrol(waypoints) {
        const last = waypoints.length - 1;
        let next = this._patrolIndex + this._patrolDirection;
        if (next > last || next < 0) {
            this._patrolDirection *= -1;
            next = this._patrolIndex + this._patrolDirection;
        }
        this._patrolIndex = next;
    }

    _moveToward(target, speed, dt) {
        if (!target) return;
        const dx = target.x - this.entity.x;
        const dy = target.y - this.entity.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        this._setFacing(dx, dy, dist);
        const step = Math.min(speed * dt, dist);
        this.entity.x += (dx / dist) * step;
        this.entity.y += (dy / dist) * step;
    }

    _moveAway(target, speed, dt) {
        if (!target) return;
        const dx = this.entity.x - target.x;
        const dy = this.entity.y - target.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0) return;
        this._setFacing(dx, dy, dist);
        const step = speed * dt;
        this.entity.x += (dx / dist) * step;
        this.entity.y += (dy / dist) * step;
    }

    _resetPatrolProgress(state) {
        this._patrolDirection = 1;
        this._patrolIndex = state?.movement === 'patrol' && (state.waypoints?.length ?? 0) > 1 ? 1 : -1;
    }

    _stateByName(name) {
        return this.states.find(s => s.name === name) || null;
    }
}
