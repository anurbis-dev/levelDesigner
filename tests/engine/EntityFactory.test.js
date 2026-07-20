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

describe('EntityFactory.fromAssetData (§7 backlog prefab, Tier 2)', () => {
    it('spawns an entity from an image-type asset using its own imgSrc directly', () => {
        const entity = EntityFactory.fromAssetData(
            { name: 'Crate', type: 'image', width: 32, height: 32, color: '#fff', imgSrc: 'crate.png' },
            { x: 10, y: 20 }
        );

        expect(entity.type).toBe('image');
        expect(entity.x).toBe(10);
        expect(entity.y).toBe(20);
        expect(entity.imgSrc).toBe('crate.png');
    });

    it('resolves a composite asset\'s sprite.properties.imageAssetId against assetsById', () => {
        const assetsById = new Map([['img_1', { type: 'image', imgSrc: 'hero.png' }]]);
        const entity = EntityFactory.fromAssetData(
            {
                name: 'Hero', type: 'actor', width: 32, height: 32,
                components: [{ type: 'sprite', enabled: true, properties: { imageAssetId: 'img_1' } }]
            },
            {},
            assetsById
        );

        expect(entity.imgSrc).toBe('hero.png');
    });

    it('falls back to the asset\'s own imgSrc when the referenced image asset is missing', () => {
        const entity = EntityFactory.fromAssetData({
            name: 'Hero', type: 'actor', width: 32, height: 32, imgSrc: 'fallback.png',
            components: [{ type: 'sprite', enabled: true, properties: { imageAssetId: 'missing' } }]
        });

        expect(entity.imgSrc).toBe('fallback.png');
    });

    it('ignores a disabled sprite component', () => {
        const assetsById = new Map([['img_1', { type: 'image', imgSrc: 'hero.png' }]]);
        const entity = EntityFactory.fromAssetData(
            {
                name: 'Hero', type: 'actor', width: 32, height: 32,
                components: [{ type: 'sprite', enabled: false, properties: { imageAssetId: 'img_1' } }]
            },
            {},
            assetsById
        );

        expect(entity.imgSrc).toBeNull();
    });

    it('defaults x/y to 0 and layerId to null, generates an id when placement omits them', () => {
        const entity = EntityFactory.fromAssetData({ name: 'Crate', type: 'actor', width: 10, height: 10 });

        expect(entity.x).toBe(0);
        expect(entity.y).toBe(0);
        expect(entity.layerId).toBeNull();
        expect(entity.id).toMatch(/^spawn_/);
    });

    it('uses placement.id when provided', () => {
        const entity = EntityFactory.fromAssetData(
            { name: 'Crate', type: 'actor', width: 10, height: 10 },
            { id: 'obj_fixed' }
        );

        expect(entity.id).toBe('obj_fixed');
    });

    it('copies properties/components so the source asset data is not mutated by later edits', () => {
        const assetData = {
            name: 'Crate', type: 'actor', width: 10, height: 10,
            properties: { foo: 1 },
            components: [{ id: 'c1', type: 'collider', enabled: true, properties: { bar: 2 } }]
        };
        const entity = EntityFactory.fromAssetData(assetData);
        entity.properties.foo = 999;
        entity.components[0].properties.bar = 999;

        expect(assetData.properties.foo).toBe(1);
        expect(assetData.components[0].properties.bar).toBe(2);
    });
});
