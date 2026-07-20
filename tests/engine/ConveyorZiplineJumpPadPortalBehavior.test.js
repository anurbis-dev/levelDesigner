import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ConveyorZiplineJumpPadPortalBehavior } from '../../src/engine/behaviors/ConveyorZiplineJumpPadPortalBehavior.js';
import { PlayerMovementBehavior } from '../../src/engine/behaviors/PlayerMovementBehavior.js';

function makeZone(kind, x, y, props = {}) {
    const entity = new Entity({ id: 'zone', type: 'actor', x, y, width: 32, height: 32 });
    entity.behaviors = [new ConveyorZiplineJumpPadPortalBehavior(entity, { properties: { kind, ...props } })];
    return entity;
}

function makePlayer(x, y) {
    return new Entity({ id: '__player', x, y, width: 10, height: 10 });
}

function fakeInput(keys = {}) {
    return {
        isDown(key) { return !!keys[key]; },
        getAxis() {
            const right = this.isDown('arrowright') || this.isDown('d');
            const left = this.isDown('arrowleft') || this.isDown('a');
            const down = this.isDown('arrowdown') || this.isDown('s');
            const up = this.isDown('arrowup') || this.isDown('w');
            return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
        }
    };
}

describe('ConveyorZiplineJumpPadPortalBehavior', () => {
    it('is never solid (isOverlapping duck-type marker, like ClimbableLadderBehavior)', () => {
        const zone = makeZone('conveyor', 0, 0);
        expect(typeof zone.behaviors[0].getBounds).toBe('function');
        expect(zone.behaviors[0].isOverlapping()).toBe(false);
    });

    describe('kind=conveyor', () => {
        it('pushes the player every tick while overlapping', () => {
            const zone = makeZone('conveyor', 0, 0, { directionX: 1, directionY: 0, speed: 100 });
            const player = makePlayer(5, 5);
            const scene = { player };

            zone.behaviors[0].update(0.1, scene);
            expect(player.x).toBeCloseTo(15);

            zone.behaviors[0].update(0.1, scene);
            expect(player.x).toBeCloseTo(25);
        });

        it('does nothing while the player is outside the zone', () => {
            const zone = makeZone('conveyor', 0, 0, { directionX: 1, speed: 100 });
            const player = makePlayer(500, 500);
            zone.behaviors[0].update(0.1, { player });
            expect(player.x).toBe(500);
        });
    });

    describe('kind=jumpPad', () => {
        it('applies the launch offset once on entry, not every tick', () => {
            const zone = makeZone('jumpPad', 0, 0, { launchOffsetX: 0, launchOffsetY: -96 });
            const player = makePlayer(5, 5);
            const scene = { player };

            zone.behaviors[0].update(0.1, scene);
            expect(player.y).toBeCloseTo(-91);

            // player still overlaps the zone's original box (didn't move away) — must not refire
            zone.behaviors[0].update(0.1, scene);
            expect(player.y).toBeCloseTo(-91);
        });

        it('re-fires after the player leaves and re-enters the zone', () => {
            const zone = makeZone('jumpPad', 0, 0, { launchOffsetY: -50 });
            const behavior = zone.behaviors[0];
            const player = makePlayer(5, 5);
            const scene = { player };

            behavior.update(0.1, scene);
            expect(player.y).toBeCloseTo(-45);

            player.x = 500; player.y = 500; // leave
            behavior.update(0.1, scene);
            expect(player.y).toBe(500);

            player.x = 5; player.y = 5; // re-enter
            behavior.update(0.1, scene);
            expect(player.y).toBeCloseTo(-45);
        });
    });

    describe('kind=portal', () => {
        it('teleports the player to the target entity on entry, once', () => {
            const target = new Entity({ id: 'dest', type: 'actor', x: 300, y: 400, width: 10, height: 10 });
            const zone = makeZone('portal', 0, 0, { targetId: 'dest' });
            const player = makePlayer(5, 5);
            const scene = { player, getAllEntities: () => [player, target, zone] };

            zone.behaviors[0].update(0.1, scene);
            expect(player.x).toBe(300);
            expect(player.y).toBe(400);
        });

        it('does nothing if targetId does not resolve', () => {
            const zone = makeZone('portal', 0, 0, { targetId: 'missing' });
            const player = makePlayer(5, 5);
            const scene = { player, getAllEntities: () => [player, zone] };

            zone.behaviors[0].update(0.1, scene);
            expect(player.x).toBe(5);
            expect(player.y).toBe(5);
        });
    });

    describe('kind=zipline + PlayerMovementBehavior', () => {
        it('rides the player to the target point and suspends normal movement meanwhile', () => {
            const zone = makeZone('zipline', 0, 0, { targetOffsetX: 200, targetOffsetY: 0, speed: 100 });
            const player = makePlayer(5, 5);
            const movement = new PlayerMovementBehavior(player, { properties: { speed: 200 } });
            const scene = {
                input: fakeInput({ arrowright: true }),
                player,
                getAllEntities: () => [player, zone]
            };

            zone.behaviors[0].update(0.1, scene); // enters, starts riding
            expect(scene.zipliningEntity).toBe(zone);

            const xAfterEntry = player.x;
            movement.update(0.1, scene); // suppressed — zipline is driving
            expect(player.x).toBe(xAfterEntry);

            for (let i = 0; i < 30; i++) zone.behaviors[0].update(0.1, scene);

            expect(player.x).toBeCloseTo(200);
            expect(scene.zipliningEntity).toBe(null);

            movement.update(0.1, scene); // control returned to the player
            expect(player.x).toBeCloseTo(220);
        });

        it('a second zipline zone ignores overlap while another ride is in progress', () => {
            const zoneA = makeZone('zipline', 0, 0, { targetOffsetX: 200, targetOffsetY: 0, speed: 50 });
            const zoneB = makeZone('zipline', 0, 0, { targetOffsetX: -200, targetOffsetY: 0, speed: 50 });
            const player = makePlayer(5, 5);
            const scene = { player, getAllEntities: () => [player, zoneA, zoneB] };

            zoneA.behaviors[0].update(0.1, scene);
            expect(scene.zipliningEntity).toBe(zoneA);

            zoneB.behaviors[0].update(0.1, scene);
            expect(scene.zipliningEntity).toBe(zoneA); // zoneB did not steal the ride
        });
    });
});
