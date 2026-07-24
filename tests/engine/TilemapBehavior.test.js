import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { TilemapBehavior } from '../../src/engine/behaviors/TilemapBehavior.js';
import { collectSolidBlockers } from '../../src/engine/behaviors/AABB.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

function makeMap(x, y, props = {}) {
    const entity = new Entity({ id: 'map', type: 'tilemap', x, y, width: 16, height: 16, color: '#888' });
    const behavior = new TilemapBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

describe('TilemapBehavior', () => {
    it('syncs entity pixel size from mapWidth/mapHeight × tile size', () => {
        const { entity } = makeMap(0, 0, {
            tileWidth: 16, tileHeight: 16, mapWidth: 4, mapHeight: 3, tiles: []
        });
        expect(entity.width).toBe(64);
        expect(entity.height).toBe(48);
    });

    it('getSolidRects: non-empty tiles are solid by default; empty (-1) are not', () => {
        // 2×2: only (1,0) and (0,1) filled
        const { behavior } = makeMap(10, 20, {
            tileWidth: 16, tileHeight: 16,
            mapWidth: 2, mapHeight: 2,
            tiles: [-1, 0, 1, -1]
        });
        const rects = behavior.getSolidRects();
        expect(rects).toHaveLength(2);
        expect(rects).toEqual(expect.arrayContaining([
            { x: 10 + 16, y: 20, width: 16, height: 16 },
            { x: 10, y: 20 + 16, width: 16, height: 16 }
        ]));
    });

    it('solidIndices whitelist limits which atlas indices block', () => {
        const { behavior } = makeMap(0, 0, {
            tileWidth: 8, tileHeight: 8,
            mapWidth: 3, mapHeight: 1,
            tiles: [0, 1, 2],
            solidIndices: [1]
        });
        const rects = behavior.getSolidRects();
        expect(rects).toEqual([{ x: 8, y: 0, width: 8, height: 8 }]);
    });

    it('solidIndices [] means no collision', () => {
        const { behavior } = makeMap(0, 0, {
            mapWidth: 2, mapHeight: 1, tiles: [0, 0], solidIndices: []
        });
        expect(behavior.getSolidRects()).toEqual([]);
    });

    it('resolves tilesetAssetId from scene.assetsById', () => {
        const { behavior } = makeMap(0, 0, {
            tilesetAssetId: 'ts1',
            mapWidth: 1, mapHeight: 1, tiles: [0]
        });
        const assetsById = new Map([['ts1', {
            id: 'ts1', type: 'tileset', imgSrc: 'atlas.png',
            properties: { tileWidth: 32, tileHeight: 32, columns: 4, solidIndices: [0] }
        }]]);
        behavior._ensureResolved({ assetsById });
        expect(behavior.tileWidth).toBe(32);
        expect(behavior.tileHeight).toBe(32);
        expect(behavior.columns).toBe(4);
        expect(behavior._resolvedSrc).toBe('atlas.png');
    });

    it('resolves tileset imageAssetId → Image.imgSrc', () => {
        const { behavior } = makeMap(0, 0, {
            tilesetAssetId: 'ts1', mapWidth: 1, mapHeight: 1, tiles: [0]
        });
        const assetsById = new Map([
            ['ts1', {
                id: 'ts1', type: 'tileset',
                properties: { tileWidth: 16, tileHeight: 16, columns: 2, imageAssetId: 'img1' }
            }],
            ['img1', { id: 'img1', type: 'image', imgSrc: 'from-image.png' }]
        ]);
        behavior.collectImageSources(new Set(), { assetsById });
        expect(behavior._resolvedSrc).toBe('from-image.png');
    });

    it('drawTiles draws atlas cells via drawImage source rects', () => {
        const { behavior } = makeMap(0, 0, {
            src: 't.png', tileWidth: 16, tileHeight: 16, columns: 2,
            mapWidth: 2, mapHeight: 1, tiles: [0, 1]
        });
        behavior._ensureResolved(null);
        const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: null };
        const img = { complete: true, naturalHeight: 32 };
        const cache = new Map([['t.png', img]]);
        expect(behavior.drawTiles(ctx, cache, 100, 200)).toBe(true);
        expect(ctx.drawImage).toHaveBeenCalledTimes(2);
        expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 16, 16, 100, 200, 16, 16);
        expect(ctx.drawImage).toHaveBeenCalledWith(img, 16, 0, 16, 16, 116, 200, 16, 16);
    });

    it('drawTiles falls back to fillRect without image', () => {
        const { behavior, entity } = makeMap(0, 0, {
            mapWidth: 1, mapHeight: 1, tiles: [0], tileWidth: 10, tileHeight: 10
        });
        entity.color = '#abc';
        const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: null };
        behavior.drawTiles(ctx, new Map(), 0, 0);
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 10, 10);
        expect(ctx.fillStyle).toBe('#abc');
    });

    it('collectSolidBlockers expands tilemap cells; empty cells stay walkable', () => {
        const { entity } = makeMap(0, 0, {
            tileWidth: 16, tileHeight: 16,
            mapWidth: 2, mapHeight: 1,
            tiles: [0, -1]
        });
        const player = new Entity({ id: 'p', x: 0, y: 0, width: 8, height: 8 });
        const scene = {
            getAllEntities: () => [entity, player]
        };
        const solids = collectSolidBlockers(scene, player, undefined);
        expect(solids).toHaveLength(1);
        expect(solids[0].getBounds()).toEqual({ x: 0, y: 0, width: 16, height: 16 });
    });

    it('registerDefaultBehaviors registers tilemap', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('tilemap')).toBe(TilemapBehavior);
    });
});
