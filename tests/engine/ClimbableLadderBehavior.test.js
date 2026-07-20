import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ClimbableLadderBehavior } from '../../src/engine/behaviors/ClimbableLadderBehavior.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';
import { PlayerMovementBehavior } from '../../src/engine/behaviors/PlayerMovementBehavior.js';

function fakeInput(keys = {}) {
    return {
        _keys: keys,
        isDown(key) { return !!this._keys[key]; },
        getAxis() {
            const right = this.isDown('arrowright') || this.isDown('d');
            const left = this.isDown('arrowleft') || this.isDown('a');
            const down = this.isDown('arrowdown') || this.isDown('s');
            const up = this.isDown('arrowup') || this.isDown('w');
            return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
        }
    };
}

function makeLadder(x, y, props = {}) {
    const entity = new Entity({ id: 'ladder', type: 'actor', x, y, width: 20, height: 60 });
    entity.behaviors = [new ClimbableLadderBehavior(entity, { properties: props })];
    return entity;
}

describe('ClimbableLadderBehavior', () => {
    it('is not solid — it is excluded from the collider getBounds() solids scan (isOverlapping duck-type)', () => {
        const ladder = makeLadder(0, 0);
        expect(typeof ladder.behaviors[0].getBounds).toBe('function');
        expect(typeof ladder.behaviors[0].isOverlapping).toBe('function');
    });

    it('exposes climbSpeed (default 100) via getClimbSpeed()', () => {
        const ladder = makeLadder(0, 0);
        expect(ladder.behaviors[0].getClimbSpeed()).toBe(100);

        const custom = makeLadder(0, 0, { climbSpeed: 50 });
        expect(custom.behaviors[0].getClimbSpeed()).toBe(50);
    });
});

describe('PlayerMovementBehavior + climbableLadder', () => {
    it('restricts movement to vertical-only at climbSpeed while overlapping a ladder', () => {
        const player = new Entity({ id: '__player', x: 5, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 200 } });
        const ladder = makeLadder(0, 0, { climbSpeed: 50 });
        const scene = {
            input: fakeInput({ arrowright: true, arrowdown: true }),
            getAllEntities: () => [player, ladder]
        };

        movement.update(0.1, scene);

        expect(player.x).toBe(5); // horizontal input ignored while on the ladder
        expect(player.y).toBeCloseTo(5); // climbSpeed (50) * dt (0.1), not walk speed (200)
    });

    it('ignores a disabled ladder (falls back to normal free movement)', () => {
        const player = new Entity({ id: '__player', x: 5, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 200 } });
        const ladder = makeLadder(0, 0, { climbSpeed: 50 });
        ladder.behaviors[0].enabled = false;
        const scene = {
            input: fakeInput({ arrowright: true, arrowdown: true }),
            getAllEntities: () => [player, ladder]
        };

        movement.update(0.1, scene);

        expect(player.x).not.toBe(5); // horizontal movement allowed, ladder ignored
    });

    it('resumes normal walk speed and free movement after leaving the ladder zone', () => {
        const player = new Entity({ id: '__player', x: 100, y: 100, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 200 } });
        const ladder = makeLadder(0, 0, { climbSpeed: 50 });
        const scene = { input: fakeInput({ arrowright: true }), getAllEntities: () => [player, ladder] };

        movement.update(0.1, scene);

        expect(player.x).toBeCloseTo(120); // full walk speed (200) * dt (0.1)
        expect(player.y).toBe(100);
    });

    it('a solid collider still blocks the player even while climbing (per-axis)', () => {
        const player = new Entity({ id: '__player', x: 5, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 200 } });
        const ladder = makeLadder(0, -10, { climbSpeed: 50 });
        const wall = new Entity({ id: 'wall', type: 'actor', x: 0, y: 5, width: 20, height: 20 });
        wall.behaviors = [new ColliderBehavior(wall, { properties: {} })];
        const scene = { input: fakeInput({ arrowdown: true }), getAllEntities: () => [player, ladder, wall] };

        for (let i = 0; i < 10; i++) movement.update(0.1, scene);

        expect(player.y).toBeLessThanOrEqual(0);
    });
});
