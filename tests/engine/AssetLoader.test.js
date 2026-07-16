import { describe, it, expect } from 'vitest';
import { AssetLoader, LOADABLE_ASSET_TYPES, DATA_ONLY_ASSET_TYPES } from '../../src/engine/AssetLoader.js';
import { ASSET_TYPES } from '../../src/constants/AssetTypes.js';
import { Scene } from '../../src/engine/Scene.js';

// Cross-checks the engine's own (self-contained, non-imported) classification list
// against the real catalog — guards against the two drifting apart silently.
describe('LOADABLE_ASSET_TYPES / DATA_ONLY_ASSET_TYPES', () => {
    it('together cover every ASSET_TYPES id exactly once', () => {
        const catalogIds = ASSET_TYPES.map(t => t.id).sort();
        const classifiedIds = [...LOADABLE_ASSET_TYPES, ...DATA_ONLY_ASSET_TYPES].sort();

        expect(classifiedIds).toEqual(catalogIds);
        expect(new Set(classifiedIds).size).toBe(classifiedIds.length);
    });
});

describe('AssetLoader.collectImageSources', () => {
    it('collects distinct imgSrc across top-level and nested group children', () => {
        const scene = new Scene({
            objects: [
                { id: 'a', type: 'actor', imgSrc: 'a.png' },
                { id: 'b', type: 'actor', imgSrc: 'a.png' },
                { id: 'g', type: 'group', children: [
                    { id: 'c', type: 'actor', imgSrc: 'c.png' },
                    { id: 'd', type: 'actor' }
                ] }
            ]
        });

        const sources = AssetLoader.collectImageSources(scene);
        expect(sources).toEqual(new Set(['a.png', 'c.png']));
    });
});

describe('AssetLoader.loadImages', () => {
    it('resolves to an empty map when Image is unavailable (Node/test environment)', async () => {
        const cache = await AssetLoader.loadImages(new Set(['a.png']));
        expect(cache.size).toBe(0);
    });
});
