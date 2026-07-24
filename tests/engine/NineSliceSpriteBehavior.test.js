import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { NineSliceSpriteBehavior } from '../../src/engine/behaviors/NineSliceSpriteBehavior.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

function makeNine(props = {}, entityOpts = {}) {
    const entity = new Entity({
        id: 'panel', type: 'nineSliceSprite', x: 10, y: 20, width: 100, height: 60, color: '#888',
        ...entityOpts
    });
    const behavior = new NineSliceSpriteBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

function mockImg(w = 32, h = 32) {
    return {
        complete: true,
        naturalWidth: w,
        naturalHeight: h,
        width: w,
        height: h
    };
}

function mockCtx() {
    return {
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        fillStyle: null
    };
}

describe('NineSliceSpriteBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeNine();
        expect(behavior.isOverlapping()).toBe(false);
    });

    it('defaults borders and fillCenter', () => {
        const { behavior } = makeNine();
        expect(behavior.borderLeft).toBe(8);
        expect(behavior.borderRight).toBe(8);
        expect(behavior.borderTop).toBe(8);
        expect(behavior.borderBottom).toBe(8);
        expect(behavior.fillCenter).toBe(true);
    });

    it('resolves imageAssetId via collectImageSources', () => {
        const { behavior } = makeNine({ imageAssetId: 'frame_img' });
        const assetsById = new Map([
            ['frame_img', { id: 'frame_img', imgSrc: 'frame.png' }]
        ]);
        const sources = new Set();
        behavior.collectImageSources(sources, { assetsById });
        expect(sources.has('frame.png')).toBe(true);
        expect(behavior._resolvedSrc).toBe('frame.png');
    });

    it('falls back to entity.imgSrc', () => {
        const { behavior } = makeNine({}, { imgSrc: 'entity.png' });
        const sources = new Set();
        behavior.collectImageSources(sources, {});
        expect(behavior._resolvedSrc).toBe('entity.png');
        expect(sources.has('entity.png')).toBe(true);
    });

    it('draws color rect when image missing', () => {
        const { behavior, entity } = makeNine({ src: 'missing.png' });
        behavior._resolvedSrc = 'missing.png';
        behavior._resolved = true;
        const ctx = mockCtx();
        behavior.drawNineSlice(ctx, new Map(), entity.x, entity.y);
        expect(ctx.fillRect).toHaveBeenCalledWith(entity.x, entity.y, entity.width, entity.height);
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('draws 9 patches with fillCenter (corners + edges + center)', () => {
        const { behavior, entity } = makeNine({
            borderLeft: 4, borderRight: 4, borderTop: 4, borderBottom: 4, fillCenter: true
        });
        behavior._resolvedSrc = 'frame.png';
        behavior._resolved = true;
        const img = mockImg(32, 32);
        const cache = new Map([['frame.png', img]]);
        const ctx = mockCtx();
        behavior.drawNineSlice(ctx, cache, entity.x, entity.y);
        // 4 corners + 4 edges + 1 center = 9
        expect(ctx.drawImage).toHaveBeenCalledTimes(9);
        // TL corner: src (0,0,4,4) → dest (10,20,4,4)
        expect(ctx.drawImage).toHaveBeenCalledWith(img, 0, 0, 4, 4, 10, 20, 4, 4);
        // center dest size = 100-8 x 60-8
        expect(ctx.drawImage).toHaveBeenCalledWith(
            img, 4, 4, 24, 24, 14, 24, 92, 52
        );
    });

    it('omits center when fillCenter false', () => {
        const { behavior, entity } = makeNine({
            borderLeft: 4, borderRight: 4, borderTop: 4, borderBottom: 4, fillCenter: false
        });
        behavior._resolvedSrc = 'frame.png';
        behavior._resolved = true;
        const img = mockImg(32, 32);
        const cache = new Map([['frame.png', img]]);
        const ctx = mockCtx();
        behavior.drawNineSlice(ctx, cache, entity.x, entity.y);
        // 4 corners + 4 edges = 8
        expect(ctx.drawImage).toHaveBeenCalledTimes(8);
    });

    it('registerDefaultBehaviors registers nineSliceSprite', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('nineSliceSprite')).toBe(NineSliceSpriteBehavior);
    });
});
