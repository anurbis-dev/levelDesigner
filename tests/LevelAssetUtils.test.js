import { describe, it, expect } from 'vitest';
import {
    isLevelDocument,
    resolveLevelSrc,
    contentUrl,
    resolveCatalogAssetType
} from '../src/utils/LevelAssetUtils.js';

describe('LevelAssetUtils', () => {
    it('detects a level document by objects+layers+settings', () => {
        expect(isLevelDocument({
            objects: [],
            layers: [],
            settings: { gridSize: 16 }
        })).toBe(true);
        expect(isLevelDocument({ type: 'image', imgSrc: 'a.png' })).toBe(false);
    });

    it('classifies maps/ledge.json as type=level', () => {
        const data = { objects: [], layers: [], settings: {}, meta: { name: 'LEDGE' } };
        expect(resolveCatalogAssetType(data, 'maps/ledge.json')).toBe('level');
        expect(resolveCatalogAssetType({ type: 'image', imgSrc: 'x.png' }, 'maps/a.json')).toBe('image');
    });

    it('resolves levelSrc and content URL', () => {
        expect(resolveLevelSrc({ properties: { levelSrc: 'maps/ledge.json' } })).toBe('maps/ledge.json');
        expect(resolveLevelSrc({ path: 'maps/ledge.json' })).toBe('maps/ledge.json');
        expect(contentUrl('maps/ledge.json')).toBe('./content/maps/ledge.json');
        expect(contentUrl('./content/maps/ledge.json')).toBe('./content/maps/ledge.json');
    });
});
