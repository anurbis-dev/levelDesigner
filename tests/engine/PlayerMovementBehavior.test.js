import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';
import { PlayerMovementBehavior } from '../../src/engine/behaviors/PlayerMovementBehavior.js';

function fakeInput(axis) {
    return { getAxis: () => axis };
}

function wall(x, y, width = 32, height = 32) {
    const entity = new Entity({ id: 'wall', type: 'actor', x, y, width, height });
    entity.behaviors = [new ColliderBehavior(entity, {})];
    return entity;
}

describe('PlayerMovementBehavior', () => {
    it('moves along input axis scaled by speed and dt', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const scene = { input: fakeInput({ x: 1, y: 0 }), getAllEntities: () => [player] };

        movement.update(0.5, scene);

        expect(player.x).toBe(50);
        expect(player.y).toBe(0);
    });

    it('normalizes diagonal movement (no faster diagonal speed)', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const scene = { input: fakeInput({ x: 1, y: 1 }), getAllEntities: () => [player] };

        movement.update(1, scene);

        expect(Math.hypot(player.x, player.y)).toBeCloseTo(100, 5);
    });

    it('is blocked by a collider in its path (small per-tick steps, no tunneling)', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const blocker = wall(50, 0, 32, 32);
        const scene = { input: fakeInput({ x: 1, y: 0 }), getAllEntities: () => [player, blocker] };

        // dt=0.1 -> 10px/tick; each step is small relative to the 32px wall, so the
        // end-of-step overlap check reliably catches contact instead of skipping past it.
        for (let i = 0; i < 6; i++) movement.update(0.1, scene);

        expect(player.x).toBe(40);
    });

    it('slides along a wall — blocked horizontally still allows vertical movement', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const blocker = wall(15, 0, 32, 32);
        const scene = { input: fakeInput({ x: 1, y: 1 }), getAllEntities: () => [player, blocker] };

        for (let i = 0; i < 3; i++) movement.update(0.1, scene);

        expect(player.x).toBe(0);
        expect(player.y).toBeGreaterThan(0);
    });

    it('does nothing without scene.input or with dt <= 0', () => {
        const player = new Entity({ id: '__player', x: 5, y: 5, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });

        movement.update(1, { getAllEntities: () => [player] });
        expect(player.x).toBe(5);

        movement.update(0, { input: fakeInput({ x: 1, y: 0 }), getAllEntities: () => [player] });
        expect(player.x).toBe(5);
    });
});
