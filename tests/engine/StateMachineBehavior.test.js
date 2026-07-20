import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { StateMachineBehavior } from '../../src/engine/behaviors/StateMachineBehavior.js';

function makeFsm(states, defaultState, x = 0, y = 0, player = null) {
    const entity = new Entity({ id: 'npc1', type: 'object', x, y, width: 10, height: 10 });
    const behavior = new StateMachineBehavior(entity, { properties: { states, defaultState } });
    entity.behaviors = [behavior];
    const scene = { entities: [entity], player };
    return { entity, behavior, scene };
}

describe('StateMachineBehavior', () => {
    it('starts in defaultState and does not move with movement:idle', () => {
        const { entity, behavior, scene } = makeFsm(
            [{ name: 'idle' }],
            'idle'
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('idle');
        expect(entity.x).toBe(0);
        expect(entity.y).toBe(0);
    });

    it('patrol state ping-pongs between waypoints', () => {
        const { entity, behavior, scene } = makeFsm(
            [{ name: 'patrol', movement: 'patrol', speed: 10, waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }],
            'patrol'
        );
        behavior.update(1, scene); // reaches x=10, advances toward index 0
        expect(entity.x).toBeCloseTo(10);
        behavior.update(1, scene); // heads back toward x=0
        expect(entity.x).toBeCloseTo(0);
    });

    it('chase state moves toward scene.player', () => {
        const player = { x: 100, y: 0 };
        const { entity, behavior, scene } = makeFsm(
            [{ name: 'chase', movement: 'chase', speed: 20 }],
            'chase',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(entity.x).toBeCloseTo(20);
        expect(entity.y).toBeCloseTo(0);
    });

    it('flee state moves away from scene.player', () => {
        const player = { x: 100, y: 0 };
        const { entity, behavior, scene } = makeFsm(
            [{ name: 'flee', movement: 'flee', speed: 20 }],
            'flee',
            50, 0, player
        );
        behavior.update(1, scene);
        expect(entity.x).toBeCloseTo(30);
    });

    it('transitions to another state when a distance condition is met', () => {
        const player = { x: 5, y: 0 };
        const { behavior, scene } = makeFsm(
            [
                { name: 'idle', transitions: [{ condition: { type: 'distance', op: '<', value: 50 }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'idle',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('chase');
    });

    it('does not transition when the player is within range but behind the NPC\'s facing (default 180° cone)', () => {
        // Default facing is (1,0) — player at x=-5 is directly behind, outside the 180° front cone.
        const player = { x: -5, y: 0 };
        const { behavior, scene } = makeFsm(
            [
                { name: 'idle', transitions: [{ condition: { type: 'distance', op: '<', value: 50 }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'idle',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('idle');
    });

    it('transitions to a behind-facing player when the condition explicitly sets fov:360', () => {
        const player = { x: -5, y: 0 };
        const { behavior, scene } = makeFsm(
            [
                { name: 'idle', transitions: [{ condition: { type: 'distance', op: '<', value: 50, fov: 360 }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'idle',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('chase');
    });

    it('facing follows patrol movement direction, gating a distance transition behind the new heading', () => {
        // NPC starts facing (1,0) (default) at x=0; player sits at x=-15 — behind that initial
        // facing, so tick 1 (patrol not yet moved) doesn't detect it. Patrol then walks the NPC
        // left to x=-10 (facing becomes (-1,0)), putting the still-stationary player back in
        // front of the NPC's new heading — tick 2 detects it.
        const player = { x: -15, y: 0 };
        const { entity, behavior, scene } = makeFsm(
            [
                { name: 'patrol', movement: 'patrol', speed: 10, waypoints: [{ x: 0, y: 0 }, { x: -10, y: 0 }],
                    transitions: [{ condition: { type: 'distance', op: '<', value: 50 }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'patrol',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('patrol');
        expect(entity.x).toBeCloseTo(-10);

        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('chase');
    });

    it('does not transition when the distance condition is not met', () => {
        const player = { x: 500, y: 0 };
        const { behavior, scene } = makeFsm(
            [
                { name: 'idle', transitions: [{ condition: { type: 'distance', op: '<', value: 50 }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'idle',
            0, 0, player
        );
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('idle');
    });

    it('evaluates var-based transitions against scene.eventGraphRuntime, same shape as SpriteAnimationBehavior', () => {
        const { behavior, scene } = makeFsm(
            [
                { name: 'idle', transitions: [{ condition: { var: 'alerted', op: '==', value: true }, target: 'chase' }] },
                { name: 'chase', movement: 'chase', speed: 10 }
            ],
            'idle'
        );
        scene.eventGraphRuntime = { getVariable: (name) => (name === 'alerted' ? true : undefined) };
        behavior.update(1, scene);
        expect(behavior.currentStateName).toBe('chase');
    });

    it('resets patrol progress to the first waypoint when re-entering a patrol state via setState', () => {
        const { entity, behavior, scene } = makeFsm(
            [
                { name: 'patrol', movement: 'patrol', speed: 100, waypoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
                { name: 'idle' }
            ],
            'patrol'
        );
        behavior.update(1, scene); // snaps to x=10 (step >= dist), flips direction toward index 0
        expect(entity.x).toBeCloseTo(10);
        behavior.setState('idle');
        behavior.setState('patrol');
        behavior.update(0.5, scene); // heading back toward waypoints[1] (x=10) from x=10, half-step toward it
        expect(entity.x).toBeCloseTo(10);
    });

    it('setState warns and no-ops for an unknown state name', () => {
        const { behavior } = makeFsm([{ name: 'idle' }], 'idle');
        behavior.setState('nope');
        expect(behavior.currentStateName).toBe('idle');
    });
});
