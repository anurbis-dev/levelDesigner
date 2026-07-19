import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';
import { MountableVehicleSeatBehavior } from '../../src/engine/behaviors/MountableVehicleSeatBehavior.js';
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

function makeVehicle(x, y, props = {}) {
    const entity = new Entity({ id: 'vehicle', type: 'actor', x, y, width: 20, height: 20 });
    entity.behaviors = [new MountableVehicleSeatBehavior(entity, { properties: props })];
    return entity;
}

describe('MountableVehicleSeatBehavior', () => {
    it('mounts on E press when player is in range, hiding the player and taking over its position', () => {
        const player = new Entity({ id: '__player', x: 15, y: 0, width: 10, height: 10 });
        const vehicle = makeVehicle(0, 0, { speed: 100 });
        const seat = vehicle.behaviors[0];
        const scene = { input: fakeInput({ e: true }), player, getAllEntities: () => [player, vehicle] };

        seat.update(0.1, scene);

        expect(scene.mountedVehicle).toBe(vehicle);
        expect(player.visible).toBe(false);
        expect(player.x).toBe(vehicle.x);
        expect(player.y).toBe(vehicle.y);
    });

    it('does not mount when player is out of range', () => {
        const player = new Entity({ id: '__player', x: 500, y: 500, width: 10, height: 10 });
        const vehicle = makeVehicle(0, 0);
        const seat = vehicle.behaviors[0];
        const scene = { input: fakeInput({ e: true }), player, getAllEntities: () => [player, vehicle] };

        seat.update(0.1, scene);

        expect(scene.mountedVehicle).toBeUndefined();
        expect(player.visible).toBe(true);
    });

    it('drives the vehicle (and keeps the player snapped to it) while mounted, blocked by colliders', () => {
        const player = new Entity({ id: '__player', x: 15, y: 0, width: 10, height: 10 });
        const vehicle = makeVehicle(0, 0, { speed: 100 });
        const seat = vehicle.behaviors[0];
        const wall = new Entity({ id: 'wall', type: 'actor', x: 100, y: 0, width: 20, height: 20 });
        wall.behaviors = [new ColliderBehavior(wall, { properties: {} })];

        const input = fakeInput({ e: true, arrowright: true });
        const scene = { input, player, getAllEntities: () => [player, vehicle, wall] };

        seat.update(0.1, scene); // mount (E just-pressed)
        input._keys.e = false;
        for (let i = 0; i < 10; i++) seat.update(0.1, scene); // drive right, no dismount press

        expect(vehicle.x).toBeGreaterThan(0);
        expect(player.x).toBe(vehicle.x);
        expect(player.y).toBe(vehicle.y);
        expect(scene.mountedVehicle).toBe(vehicle);
    });

    it('dismounts on a second E press, restoring player control beside the vehicle', () => {
        const player = new Entity({ id: '__player', x: 15, y: 0, width: 10, height: 10 });
        const vehicle = makeVehicle(0, 0, { speed: 100 });
        const seat = vehicle.behaviors[0];
        const input = fakeInput({ e: true });
        const scene = { input, player, getAllEntities: () => [player, vehicle] };

        seat.update(0.1, scene); // mount
        input._keys.e = false;
        seat.update(0.1, scene); // release
        input._keys.e = true;
        seat.update(0.1, scene); // dismount (E just-pressed again)

        expect(scene.mountedVehicle).toBeNull();
        expect(player.visible).toBe(true);
        expect(player.x).toBe(vehicle.x + vehicle.width + 4);
    });

    it("ignores a second vehicle's input while already mounted in another", () => {
        const player = new Entity({ id: '__player', x: 15, y: 0, width: 10, height: 10 });
        const vehicleA = makeVehicle(0, 0, { speed: 100 });
        const vehicleB = makeVehicle(15, 0, { speed: 100 });
        const seatA = vehicleA.behaviors[0];
        const seatB = vehicleB.behaviors[0];
        const scene = { input: fakeInput({ e: true }), player, getAllEntities: () => [player, vehicleA, vehicleB] };

        seatA.update(0.1, scene);
        seatB.update(0.1, scene);

        expect(scene.mountedVehicle).toBe(vehicleA);
    });

    it('is solid (blocks the player) while parked and not mounted', () => {
        const player = new Entity({ id: '__player', x: 0, y: 0, width: 10, height: 10 });
        const movement = new PlayerMovementBehavior(player, { properties: { speed: 100 } });
        const vehicle = makeVehicle(15, 0);
        const scene = { input: fakeInput({ arrowright: true }), getAllEntities: () => [player, vehicle] };

        for (let i = 0; i < 6; i++) movement.update(0.1, scene);

        expect(player.x).toBe(0);
    });
});
