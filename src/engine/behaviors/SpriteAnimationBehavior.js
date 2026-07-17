import { Behavior } from './Behavior.js';
import { evalSpec } from '../eventgraph/ConditionEvaluator.js';

/**
 * Plays a sprite-sheet animation clip against the entity's own `imgSrc` atlas (frames are
 * source-rects into that same image, not a separate texture). `properties.frames` — TexturePacker-
 * style subset: [{x,y,w,h,duration}], duration in ms. `properties.loop` (default true) — when
 * false, the animation holds on the last frame instead of restarting.
 * Фаза B of tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md — single clip, no state machine.
 *
 * Фаза F extension: when `properties.states` is present, `properties.clips` is a named
 * `{clipName: frames[]}` catalog instead of the flat `frames` array, and each tick evaluates
 * the current state's `transitions` (first matching `condition` wins, same "ordered, first
 * match" convention as DialogueRunner.getVisibleChoices/EventGraphRuntime._runFrom) against
 * `scene.eventGraphRuntime` — the same level-scope variable store Event Graph/Dialogue use
 * (plan: no separate per-instance channel). Without `states`, behavior is unchanged from
 * Фаза B. `play(clipName)` is the forced override Event Graph's `PlayAnimation` action calls —
 * it swaps the active clip without touching `_currentStateName`, so the state machine resumes
 * its own clip on the next transition it evaluates.
 */
export class SpriteAnimationBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.clips = this.properties.clips || null;
        this.states = this.properties.states || null;
        this.loop = this.properties.loop ?? true;
        this._frameIndex = 0;
        this._elapsedMs = 0;

        if (this.states && this.states.length > 0) {
            this._currentStateName = this.properties.defaultState || this.states[0].name;
            this.frames = this._framesForClip(this._stateByName(this._currentStateName)?.clip);
        } else {
            this.frames = this.properties.frames || [];
        }
    }

    update(dt, scene) {
        if (this.states && scene?.eventGraphRuntime) this._checkTransitions(scene.eventGraphRuntime);
        if (this.frames.length === 0 || dt <= 0) return;
        this._elapsedMs += dt * 1000;

        while (true) {
            const duration = this.frames[this._frameIndex]?.duration ?? 100;
            if (this._elapsedMs < duration) break;
            this._elapsedMs -= duration;
            this._frameIndex++;
            if (this._frameIndex >= this.frames.length) {
                if (this.loop) {
                    this._frameIndex = 0;
                } else {
                    this._frameIndex = this.frames.length - 1;
                    this._elapsedMs = 0;
                    break;
                }
            }
        }
    }

    /** @returns {{x:number,y:number,w:number,h:number}|null} current frame's source rect in the atlas, or null with no frames. */
    getSourceRect() {
        const frame = this.frames[this._frameIndex];
        return frame ? { x: frame.x, y: frame.y, w: frame.w, h: frame.h } : null;
    }

    /** Forced clip override (Event Graph's `PlayAnimation` action) — see class docstring. */
    play(clipName) {
        if (!this.clips) {
            console.warn(`[engine] SpriteAnimationBehavior.play('${clipName}'): entity has no 'clips' catalog`);
            return;
        }
        this.frames = this._framesForClip(clipName);
        this._frameIndex = 0;
        this._elapsedMs = 0;
    }

    _checkTransitions(runtime) {
        const state = this._stateByName(this._currentStateName);
        for (const transition of state?.transitions || []) {
            if (evalSpec(transition.condition, runtime)) {
                this._setState(transition.target);
                return;
            }
        }
    }

    _setState(name) {
        if (name === this._currentStateName) return;
        this._currentStateName = name;
        this.play(this._stateByName(name)?.clip);
    }

    _stateByName(name) {
        return this.states?.find(s => s.name === name) || null;
    }

    _framesForClip(clipName) {
        return this.clips?.[clipName] || [];
    }
}
