import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';
import { MovablePushableBehavior } from '../../src/engine/behaviors/MovablePushableBehavior.js';
import { PlayerMovementBehavior } from '../../src/engine/behaviors/PlayerMovementBehavior.js';

function box(x, y, width = 10, height = 10, props = {}) {
    const entity = new Entity({ id: 'box', type: 'actor', x, y, width, height });
    entity.behaviors = [new MovablePushableBehavior(entity, { properties: props })];
    return entity;
}

function wall(x, y, width = 10, height = 10, props = {}) {
    const entity = new Entity({ id: 'wall', type: 'actor', x, y, width, height });
    entity.behaviors = [new ColliderBehavior(entity, { properties: props })];
    return entity;
}

describe('MovablePushableBehavior', () => {
    it('is pushed along with the player walking into it', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const b = box(15, 0);
        const scene = { input: { getAxis: () => ({ x: 1, y: 0 }) }, getAllEntities: () => [player, b] };

        movement.update(0.1, scene);

        expect(player.x).toBeCloseTo(10, 5);
        expect(b.x).toBeCloseTo(25, 5);
    });

    it('does not move (and blocks the player) when the destination behind it is occupied', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const b = box(15, 0);
        const w = wall(25, 0);
        const scene = { input: { getAxis: () => ({ x: 1, y: 0 }) }, getAllEntities: () => [player, b, w] };

        movement.update(0.1, scene);

        expect(b.x).toBe(15);
        expect(player.x).toBe(0);
    });

    it('collidesWith gates which solids block the push destination', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const b = box(15, 0, 10, 10, { collidesWith: ['environment'] });
        const w = wall(25, 0, 10, 10, { layer: 'decor' });
        const scene = { input: { getAxis: () => ({ x: 1, y: 0 }) }, getAllEntities: () => [player, b, w] };

        movement.update(0.1, scene);

        expect(b.x).toBeCloseTo(25, 5);
        expect(player.x).toBeCloseTo(10, 5);
    });
});
