import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { VariableModifierBehavior } from '../../src/engine/behaviors/VariableModifierBehavior.js';

function makeZone(x, y, props = {}) {
    const entity = new Entity({ id: 'zone', type: 'actor', x, y, width: 32, height: 32 });
    entity.behaviors = [new VariableModifierBehavior(entity, { properties: props })];
    return entity;
}

function makePlayer(x, y) {
    return new Entity({ id: '__player', x, y, width: 10, height: 10 });
}

function fakeRuntime(initial = {}) {
    const vars = new Map(Object.entries(initial));
    return {
        getVariable: (name) => vars.get(name),
        setVariable: (name, value) => vars.set(name, value)
    };
}

describe('VariableModifierBehavior', () => {
    it('is never solid (isOverlapping duck-type marker, like ClimbableLadderBehavior)', () => {
        const zone = makeZone(0, 0);
        expect(typeof zone.behaviors[0].getBounds).toBe('function');
        expect(zone.behaviors[0].isOverlapping()).toBe(false);
    });

    it('does nothing without an eventGraphRuntime on the scene', () => {
        const zone = makeZone(0, 0, { varName: 'flag', op: 'set', value: true });
        const player = makePlayer(5, 5);
        expect(() => zone.behaviors[0].update(0.1, { player })).not.toThrow();
    });

    it('does nothing while the player is outside the zone', () => {
        const runtime = fakeRuntime();
        const zone = makeZone(0, 0, { varName: 'flag', op: 'set', value: true });
        const player = makePlayer(500, 500);
        zone.behaviors[0].update(0.1, { player, eventGraphRuntime: runtime });
        expect(runtime.getVariable('flag')).toBeUndefined();
    });

    describe('mode=once (default)', () => {
        it('sets the variable once on entry, not on every subsequent tick while still overlapping', () => {
            const runtime = fakeRuntime();
            const zone = makeZone(0, 0, { varName: 'questStarted', op: 'set', value: true });
            const player = makePlayer(5, 5);
            const scene = { player, eventGraphRuntime: runtime };

            zone.behaviors[0].update(0.1, scene);
            expect(runtime.getVariable('questStarted')).toBe(true);

            runtime.setVariable('questStarted', false); // simulate something else changing it
            zone.behaviors[0].update(0.1, scene); // still overlapping, must not refire
            expect(runtime.getVariable('questStarted')).toBe(false);
        });

        it('re-fires after the player leaves and re-enters the zone', () => {
            const runtime = fakeRuntime();
            const zone = makeZone(0, 0, { varName: 'counter', op: 'add', value: 1 });
            const behavior = zone.behaviors[0];
            const player = makePlayer(5, 5);
            const scene = { player, eventGraphRuntime: runtime };

            behavior.update(0.1, scene);
            expect(runtime.getVariable('counter')).toBe(1);

            player.x = 500; player.y = 500; // leave
            behavior.update(0.1, scene);
            expect(runtime.getVariable('counter')).toBe(1);

            player.x = 5; player.y = 5; // re-enter
            behavior.update(0.1, scene);
            expect(runtime.getVariable('counter')).toBe(2);
        });
    });

    describe('op variants', () => {
        it('add treats a missing variable as 0', () => {
            const runtime = fakeRuntime();
            const zone = makeZone(0, 0, { varName: 'score', op: 'add', value: 5 });
            const player = makePlayer(5, 5);
            zone.behaviors[0].update(0.1, { player, eventGraphRuntime: runtime });
            expect(runtime.getVariable('score')).toBe(5);
        });

        it('subtract decrements the existing value', () => {
            const runtime = fakeRuntime({ lives: 3 });
            const zone = makeZone(0, 0, { varName: 'lives', op: 'subtract', value: 1 });
            const player = makePlayer(5, 5);
            zone.behaviors[0].update(0.1, { player, eventGraphRuntime: runtime });
            expect(runtime.getVariable('lives')).toBe(2);
        });

        it('toggle flips a boolean and ignores `value`', () => {
            const runtime = fakeRuntime({ doorOpen: false });
            const zone = makeZone(0, 0, { varName: 'doorOpen', op: 'toggle', value: 'ignored' });
            const player = makePlayer(5, 5);
            zone.behaviors[0].update(0.1, { player, eventGraphRuntime: runtime });
            expect(runtime.getVariable('doorOpen')).toBe(true);
        });
    });

    describe('mode=continuous', () => {
        it('re-applies every tick while overlapping', () => {
            const runtime = fakeRuntime({ charge: 0 });
            const zone = makeZone(0, 0, { varName: 'charge', op: 'add', value: 1, mode: 'continuous' });
            const player = makePlayer(5, 5);
            const scene = { player, eventGraphRuntime: runtime };

            zone.behaviors[0].update(0.1, scene);
            zone.behaviors[0].update(0.1, scene);
            zone.behaviors[0].update(0.1, scene);

            expect(runtime.getVariable('charge')).toBe(3);
        });
    });
});
