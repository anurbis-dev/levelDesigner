import { describe, it, expect, vi } from 'vitest';
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

function fakeRuntime(vars = {}) {
    const variables = new Map(Object.entries(vars));
    return { getVariable: (name) => variables.get(name), setVariable: (name, v) => variables.set(name, v) };
}

function stateMachine(runtimeVars) {
    const anim = new SpriteAnimationBehavior({}, { properties: {
        defaultState: 'idle',
        clips: {
            idle: [{ x: 0, y: 0, w: 32, h: 32, duration: 100 }],
            walk: [{ x: 32, y: 0, w: 32, h: 32, duration: 100 }]
        },
        states: [
            { name: 'idle', clip: 'idle', transitions: [{ condition: { var: 'speed', op: '>', value: 0 }, target: 'walk' }] },
            { name: 'walk', clip: 'walk', transitions: [{ condition: { var: 'speed', op: '==', value: 0 }, target: 'idle' }] }
        ]
    } });
    return { anim, scene: { eventGraphRuntime: fakeRuntime(runtimeVars) } };
}

// Фаза F (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md): state machine mode — named clips catalog +
// per-state transitions evaluated against the shared Event Graph variable store.
describe('SpriteAnimationBehavior — Фаза F state machine', () => {
    it('starts on defaultState\'s clip', () => {
        const { anim } = stateMachine({});
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('stays on the current state while its transitions are false', () => {
        const { anim, scene } = stateMachine({ speed: 0 });
        anim.update(0.1, scene);
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('switches state once a transition condition becomes true', () => {
        const { anim, scene } = stateMachine({ speed: 200 });
        anim.update(0.1, scene);
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });

    it('switches back once the condition reverses', () => {
        const { anim, scene } = stateMachine({ speed: 200 });
        anim.update(0.1, scene);
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });

        scene.eventGraphRuntime.setVariable('speed', 0);
        anim.update(0.1, scene);
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it('play(clipName) forces a clip without changing the current state', () => {
        const { anim, scene } = stateMachine({ speed: 0 });
        anim.play('walk');
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });

        // no transition fires (speed still 0, current state is still 'idle') -> forced clip holds
        anim.update(0.1, scene);
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });

    it('play() on an entity with no clips catalog warns and is a no-op', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        anim.play('anything');
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('is backward-compatible: update(dt) without a scene argument still advances frames normally', () => {
        const anim = clip([{ x: 0, y: 0, w: 32, h: 32, duration: 100 }, { x: 32, y: 0, w: 32, h: 32, duration: 100 }]);
        anim.update(0.1);
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });
});
