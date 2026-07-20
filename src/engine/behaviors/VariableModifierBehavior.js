import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';

/**
 * Volume/Trigger zone (never solid — isOverlapping() always false, same duck-type as
 * ClimbableLadderBehavior/ConveyorZiplineJumpPadPortalBehavior) that writes to an
 * EventGraphRuntime variable on player contact — the write side of the mechanism
 * Quest/Dialogue conditions read via ConditionEvaluator's `{var,op,value}` against
 * `scene.eventGraphRuntime`. Only reacts to `scene.player` (same "not generalized to
 * arbitrary entities, not requested" discipline as pickup/checkpointSavePoint/
 * conveyorZiplineJumpPadPortal).
 *
 * `op`: `set` writes `value` directly; `add`/`subtract` apply `value` against the
 * current variable (missing/undefined treated as 0, same "read-then-write" a counter
 * needs); `toggle` flips a boolean variable (`value` ignored). `mode: 'once'` is
 * edge-detected — fires once per fresh entry, same repeatable-but-not-spammy pattern as
 * `portal`/`jumpPad` (no destroyOnTrigger — not requested); `mode: 'continuous'`
 * re-applies every tick while overlapping (e.g. a drain/regen counter zone).
 */
export class VariableModifierBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.varName = this.properties.varName ?? '';
        this.op = this.properties.op ?? 'set'; // 'set' | 'add' | 'subtract' | 'toggle'
        this.value = this.properties.value ?? true;
        this.mode = this.properties.mode ?? 'once'; // 'once' | 'continuous'
        this._wasOverlapping = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    update(dt, scene) {
        const player = scene.player;
        const runtime = scene.eventGraphRuntime;
        if (!player || !runtime || !this.varName) return;

        const overlapping = rectsIntersect(this.getBounds(), getEntityBounds(player, {}));
        const entering = overlapping && !this._wasOverlapping;
        this._wasOverlapping = overlapping;

        if (this.mode === 'continuous') {
            if (overlapping) this._apply(runtime);
            return;
        }

        if (entering) this._apply(runtime);
    }

    _apply(runtime) {
        switch (this.op) {
            case 'add':
                runtime.setVariable(this.varName, (runtime.getVariable(this.varName) ?? 0) + this.value);
                break;
            case 'subtract':
                runtime.setVariable(this.varName, (runtime.getVariable(this.varName) ?? 0) - this.value);
                break;
            case 'toggle':
                runtime.setVariable(this.varName, !runtime.getVariable(this.varName));
                break;
            default:
                runtime.setVariable(this.varName, this.value);
        }
    }
}
