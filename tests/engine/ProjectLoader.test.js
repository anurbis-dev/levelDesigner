import { describe, it, expect } from 'vitest';
import { ProjectLoader } from '../../src/engine/ProjectLoader.js';

function fixtureManifest() {
    return {
        formatVersion: 1,
        name: 'Demo',
        entryLevelId: 'level_a',
        levels: [
            {
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    settings: { backgroundColor: '#123456', parallaxHorizontal: 0.5, parallaxVertical: 0.5 },
                    camera: { x: 10, y: 20, zoom: 2 },
                    objects: [{ id: 'obj_1', type: 'actor', x: 0, y: 0 }],
                    layers: [{ id: 'layer_1', order: 0, visible: true }]
                }
            }
        ]
    };
}

describe('ProjectLoader.load', () => {
    it('builds levelsById and entryLevelId from the manifest', () => {
        const registries = ProjectLoader.load(fixtureManifest());
        expect(registries.entryLevelId).toBe('level_a');
        expect(registries.levelsById.has('level_a')).toBe(true);
        expect(registries.assetsById.size).toBe(0);
        expect(registries.eventsById.size).toBe(0);
    });

    it('builds assetsById keyed by asset id from manifest.assets (§7 backlog prefab, Tier 2)', () => {
        const manifest = { ...fixtureManifest(), assets: [{ id: 'asset_1', type: 'image', imgSrc: 'crate.png' }] };
        const registries = ProjectLoader.load(manifest);

        expect(registries.assetsById.size).toBe(1);
        expect(registries.assetsById.get('asset_1')).toEqual({ id: 'asset_1', type: 'image', imgSrc: 'crate.png' });
    });
});

describe('ProjectLoader.loadLevel', () => {
    it('produces a Scene with settings/layers/camera from the level data', () => {
        const registries = ProjectLoader.load(fixtureManifest());
        const scene = ProjectLoader.loadLevel(registries.entryLevelId, registries);

        expect(scene.settings.backgroundColor).toBe('#123456');
        expect(scene.settings.parallaxHorizontal).toBe(0.5);
        expect(scene.camera).toEqual({ x: 10, y: 20, zoom: 2 });
        expect(scene.layers).toHaveLength(1);
        expect(scene.entities).toHaveLength(1);
        expect(scene.entities[0].id).toBe('obj_1');
    });

    it('throws for an unknown levelId', () => {
        const registries = ProjectLoader.load(fixtureManifest());
        expect(() => ProjectLoader.loadLevel('missing', registries)).toThrow();
    });

    it('attaches registries.assetsById to the produced Scene (§7 backlog prefab, Tier 2)', () => {
        const manifest = { ...fixtureManifest(), assets: [{ id: 'asset_1', type: 'image', imgSrc: 'crate.png' }] };
        const registries = ProjectLoader.load(manifest);
        const scene = ProjectLoader.loadLevel(registries.entryLevelId, registries);

        expect(scene.assetsById).toBe(registries.assetsById);
        expect(scene.assetsById.get('asset_1').imgSrc).toBe('crate.png');
    });
});
