import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EntityFactory } from '../../src/engine/EntityFactory.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';

beforeAll(() => {
    registerDefaultBehaviors();
});

describe('EntityFactory.fromGameObjectData', () => {
    it('converts a plain GameObject-shaped object, dropping editor-only fields', () => {
        const entity = EntityFactory.fromGameObjectData({
            id: 'obj_1',
            name: 'Crate',
            type: 'actor',
            x: 10, y: 20, width: 32, height: 32,
            color: '#fff', rotation: 90, imgSrc: 'crate.png',
            visible: true, locked: true, layerId: 'layer_1',
            properties: { foo: 1 },
            components: [{ id: 'c1', type: 'collider', enabled: true, properties: {} }]
        });

        expect(entity.id).toBe('obj_1');
        expect(entity.type).toBe('actor');
        expect(entity.rotation).toBe(90);
        expect(entity.imgSrc).toBe('crate.png');
        expect(entity.properties).toEqual({ foo: 1 });
        expect(entity.components).toHaveLength(1);
        expect(entity).not.toHaveProperty('locked');
    });

    it('recursively converts group children', () => {
        const entity = EntityFactory.fromGameObjectData({
            id: 'group_1',
            type: 'group',
            x: 0, y: 0,
            children: [
                { id: 'child_1', type: 'actor', x: 1, y: 2 },
                { id: 'group_2', type: 'group', x: 5, y: 5, children: [
                    { id: 'child_2', type: 'actor', x: 3, y: 3 }
                ] }
            ]
        });

        expect(entity.children).toHaveLength(2);
        expect(entity.children[0].id).toBe('child_1');
        expect(entity.children[1].children[0].id).toBe('child_2');
    });

    it('non-group objects have null children', () => {
        const entity = EntityFactory.fromGameObjectData({ id: 'a', type: 'actor' });
        expect(entity.children).toBeNull();
    });
});

describe('EntityFactory.fromGameObjectData — component resolution', () => {
    it('instantiates a registered behavior for a known component type', () => {
        const entity = EntityFactory.fromGameObjectData({
            id: 'obj_1', type: 'actor',
            components: [{ id: 'c1', type: 'collider', enabled: true, properties: {} }]
        });

        expect(entity.behaviors).toHaveLength(1);
        expect(entity.behaviors[0]).toBeInstanceOf(ColliderBehavior);
    });

    it('warns and skips an unknown/unimplemented component type instead of throwing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const entity = EntityFactory.fromGameObjectData({
            id: 'obj_1', type: 'actor',
            components: [{ id: 'c1', type: 'aiBehaviorPreset', enabled: true, properties: {} }]
        });

        expect(entity.behaviors).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('aiBehaviorPreset'));
        warnSpy.mockRestore();
    });

    it('skips a disabled component without warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const entity = EntityFactory.fromGameObjectData({
            id: 'obj_1', type: 'actor',
            components: [{ id: 'c1', type: 'collider', enabled: false, properties: {} }]
        });

        expect(entity.behaviors).toHaveLength(0);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
