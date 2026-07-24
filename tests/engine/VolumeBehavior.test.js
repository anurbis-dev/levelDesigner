import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { VolumeBehavior } from '../../src/engine/behaviors/VolumeBehavior.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';

function makeZone(x, y, props = {}, entityOpts = {}) {
    const entity = new Entity({
        id: 'vol', type: 'volume', x, y, width: 40, height: 40, ...entityOpts
    });
    const behavior = new VolumeBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

function makePlayer(x, y) {
    return new Entity({ id: '__player', x, y, width: 10, height: 10 });
}

describe('VolumeBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeZone(0, 0, { blur: 2 });
        expect(behavior.isOverlapping()).toBe(false);
        expect(typeof behavior.getBounds).toBe('function');
    });

    it('getViewFilter is null when player is outside', () => {
        const { behavior } = makeZone(0, 0, { blur: 4 });
        behavior.update(0.1, { player: makePlayer(500, 500) });
        expect(behavior.getViewFilter()).toBe(null);
    });

    it('getViewFilter returns preset when player is inside', () => {
        const { behavior } = makeZone(0, 0, {
            blur: 3,
            brightness: 1.1,
            saturate: 0.5,
            hueRotate: 45,
            dropShadow: { x: 1, y: 2, blur: 3, color: 'red' }
        });
        behavior.update(0.1, { player: makePlayer(5, 5) });
        expect(behavior.getViewFilter()).toEqual({
            blur: 3,
            brightness: 1.1,
            saturate: 0.5,
            hueRotate: 45,
            dropShadow: { x: 1, y: 2, blur: 3, color: 'red' }
        });
    });

    it('disabled volume never activates', () => {
        const { behavior } = makeZone(0, 0, { blur: 4, enabled: false });
        behavior.update(0.1, { player: makePlayer(5, 5) });
        expect(behavior.getViewFilter()).toBe(null);
    });

    it('empty filter fields yield null even when inside', () => {
        const { behavior } = makeZone(0, 0, {});
        behavior.update(0.1, { player: makePlayer(5, 5) });
        expect(behavior.getViewFilter()).toBe(null);
    });

    it('merges presetAssetId catalog fields when component empty', () => {
        const { behavior } = makeZone(0, 0, {
            presetAssetId: 'fx_underwater',
            blur: 0
        });
        const assetsById = new Map([['fx_underwater', {
            id: 'fx_underwater',
            type: 'materialShaderPreset',
            properties: { blur: 6, saturate: 0.4, brightness: 0.9 }
        }]]);
        behavior.update(0.1, { player: makePlayer(5, 5), assetsById });
        expect(behavior.blur).toBe(6);
        expect(behavior.saturate).toBe(0.4);
        expect(behavior.brightness).toBe(0.9);
        expect(behavior.getViewFilter()).toEqual({
            blur: 6,
            brightness: 0.9,
            saturate: 0.4
        });
    });

    it('component non-empty fields win over preset asset', () => {
        const { behavior } = makeZone(0, 0, {
            presetAssetId: 'fx',
            blur: 2
        });
        const assetsById = new Map([['fx', {
            properties: { blur: 99, hueRotate: 30 }
        }]]);
        behavior.update(0.1, { player: makePlayer(5, 5), assetsById });
        expect(behavior.blur).toBe(2);
        expect(behavior.hueRotate).toBe(30);
    });

    it('registers under volume type', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('volume')).toBe(VolumeBehavior);
    });
});
