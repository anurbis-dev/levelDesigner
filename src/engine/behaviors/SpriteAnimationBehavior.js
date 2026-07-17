import { Behavior } from './Behavior.js';

/**
 * Plays a sprite-sheet animation clip against the entity's own `imgSrc` atlas (frames are
 * source-rects into that same image, not a separate texture). `properties.frames` — TexturePacker-
 * style subset: [{x,y,w,h,duration}], duration in ms. `properties.loop` (default true) — when
 * false, the animation holds on the last frame instead of restarting.
 * Фаза B of tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md — single clip only, no state-machine transitions
 * yet (Фаза F adds those on top, driven by the same per-instance variables as Event Graph).
 */
export class SpriteAnimationBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.frames = this.properties.frames || [];
        this.loop = this.properties.loop ?? true;
        this._frameIndex = 0;
        this._elapsedMs = 0;
    }

    update(dt) {
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
}
