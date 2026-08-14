import { describe, it, expect } from 'vitest';
import {
    isLevelDocument,
    resolveLevelSrc,
    resolveMapSrc,
    pickLevelOpenPayload,
    resolveLevelFileName,
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

    it('resolveMapSrc uses only properties.levelSrc, not catalog path', () => {
        expect(resolveMapSrc({ type: 'level', path: 'Core/Level 1.json' })).toBe(null);
        expect(resolveMapSrc({
            type: 'level',
            path: 'Core/Level 1.json',
            properties: { placeholder: true }
        })).toBe(null);
        expect(resolveMapSrc({
            type: 'level',
            path: 'assets/maps/foo.json',
            properties: { levelSrc: 'maps/ledge.json' }
        })).toBe('maps/ledge.json');
    });

    it('pickLevelOpenPayload opens empty for placeholder type=level', () => {
        const map = { objects: [], layers: [], settings: {} };
        expect(pickLevelOpenPayload({ type: 'level' }, map)).toEqual({ kind: 'document', json: map });
        expect(pickLevelOpenPayload({ type: 'level', path: 'Core/Level 1.json' }, null))
            .toEqual({ kind: 'empty' });
        expect(pickLevelOpenPayload({ type: 'image' }, { name: 'x' })).toEqual({ kind: 'invalid' });
    });

    it('resolveLevelFileName prefers src basename', () => {
        expect(resolveLevelFileName({ name: 'Level 1' }, 'maps/ledge.json')).toBe('ledge.json');
        expect(resolveLevelFileName({ name: 'Level 1' }, null)).toBe('Level 1.json');
        expect(resolveLevelFileName({ name: 'boss.json' }, null)).toBe('boss.json');
    });
});
