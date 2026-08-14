import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { PlayerMovementBehavior } from '../../src/engine/behaviors/PlayerMovementBehavior.js';
import { TilemapBehavior } from '../../src/engine/behaviors/TilemapBehavior.js';
import { Input } from '../../src/engine/Input.js';

function fakeTarget() {
    const listeners = {};
    return {
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener(type, fn) {
            listeners[type] = (listeners[type] || []).filter((l) => l !== fn);
        },
        dispatch(type, event) { (listeners[type] || []).forEach((fn) => fn(event)); }
    };
}

function makeFloorScene() {
    const floor = new Entity({ id: 'tm', x: 0, y: 0, width: 160, height: 48 });
    const tiles = [
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1
    ];
    floor.behaviors = [new TilemapBehavior(floor, {
        properties: {
            tileWidth: 16, tileHeight: 16, mapWidth: 10, mapHeight: 3,
            tiles, tileKinds: { 1: 'solid' }, solidIndices: [1]
        }
    })];
    const player = new Entity({ id: '__player', x: 16, y: 8, width: 10, height: 22 });
    const move = new PlayerMovementBehavior(player, { properties: { mode: 'platformer' } });
    player.behaviors = [move];
    const target = fakeTarget();
    const input = new Input(target);
    const scene = {
        input,
        player,
        getAllEntities: () => [player, floor],
        inventory: { has: () => false },
        eventGraphRuntime: { setVariable() {} }
    };
    return { player, move, input, target, scene };
}

describe('PlatformerController', () => {
    it('falls with gravity onto a solid tile row', () => {
        const { player, move, scene, input } = makeFloorScene();
        for (let i = 0; i < 40; i++) {
            input.beginFrame();
            move.update(1 / 60, scene);
            input.endFrame();
        }
        expect(player.y + player.height).toBeCloseTo(32, 0);
        expect(move._platformer.onGround).toBe(true);
    });

    it('jumps when jump is pressed while grounded', () => {
        const { player, move, scene, input, target } = makeFloorScene();
        for (let i = 0; i < 40; i++) {
            input.beginFrame();
            move.update(1 / 60, scene);
            input.endFrame();
        }
        const y0 = player.y;
        target.dispatch('keydown', { key: ' ' });
        input.beginFrame();
        move.update(1 / 60, scene);
        input.endFrame();
        expect(player.y).toBeLessThan(y0);
        expect(move._platformer.onGround).toBe(false);
    });

    it('uses crouchHeight/proneHeight for collision, not sprite size', () => {
        const { player, move, scene, input, target } = makeFloorScene();
        move.properties.crouchHeight = 12;
        move.properties.proneHeight = 6;
        move.properties.bodyHeight = 22;
        for (let i = 0; i < 40; i++) {
            input.beginFrame();
            move.update(1 / 60, scene);
            input.endFrame();
        }
        const floorY = player.y + player.height;
        target.dispatch('keydown', { key: 's' });
        input.beginFrame();
        move.update(1 / 60, scene);
        input.endFrame();
        expect(move._platformer.stance).toBe(1);
        expect(player.height).toBe(12);
        expect(player.y + player.height).toBeCloseTo(floorY, 0);
        target.dispatch('keyup', { key: 's' });
        input.beginFrame();
        move.update(1 / 60, scene);
        input.endFrame();
        target.dispatch('keydown', { key: 's' });
        input.beginFrame();
        move.update(1 / 60, scene);
        input.endFrame();
        expect(move._platformer.stance).toBe(2);
        expect(player.height).toBe(6);
        expect(player.y + player.height).toBeCloseTo(floorY, 0);
    });
});

describe('Input jump edge', () => {
    it('wasActionPressed fires one tick for space', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.beginFrame();
        target.dispatch('keydown', { key: ' ' });
        expect(input.wasActionPressed('jump')).toBe(true);
        input.endFrame();
        input.beginFrame();
        expect(input.wasActionPressed('jump')).toBe(false);
        input.consumeAction('jump');
        expect(input.wasActionPressed('jump')).toBe(false);
    });
});
