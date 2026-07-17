import { describe, it, expect } from 'vitest';
import { SpriteAnimationBehavior } from '../../src/engine/behaviors/SpriteAnimationBehavior.js';

function clip(frames, loop = true) {
    return new SpriteAnimationBehavior({}, { properties: { frames, loop } });
}

describe('SpriteAnimationBehavior', () => {
    it('starts on the first frame', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('advances to the next frame once its duration elapses', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        anim.update(0.1); // 100ms
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });

    it('does not advance before the current frame duration elapses', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        anim.update(0.05); // 50ms
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('loops back to the first frame by default', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        anim.update(0.2); // exactly two frames' worth
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('holds on the last frame when loop is false', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }], false);
        anim.update(0.5); // well past the end
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });

    it('getSourceRect() returns null when there are no frames', () => {
        const anim = clip([]);
        expect(anim.getSourceRect()).toBeNull();
    });

    it('is a no-op with dt <= 0', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        anim.update(0);
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });
});
