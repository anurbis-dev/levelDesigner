import { describe, it, expect } from 'vitest';
import { getEntityBounds, rectsIntersect } from '../../src/engine/behaviors/AABB.js';

describe('getEntityBounds', () => {
    it('defaults to the entity own x/y/width/height', () => {
        const entity = { x: 10, y: 20, width: 32, height: 48 };
        expect(getEntityBounds(entity)).toEqual({ x: 10, y: 20, width: 32, height: 48 });
    });

    it('applies offsetX/offsetY/width/height overrides from properties', () => {
        const entity = { x: 10, y: 20, width: 32, height: 48 };
        const bounds = getEntityBounds(entity, { offsetX: 5, offsetY: -5, width: 16, height: 16 });
        expect(bounds).toEqual({ x: 15, y: 15, width: 16, height: 16 });
    });
});

describe('rectsIntersect', () => {
    it('detects full overlap', () => {
        expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
    });

    it('detects no overlap', () => {
        expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 5, height: 5 })).toBe(false);
    });

    it('treats edge-touching rects as not intersecting', () => {
        expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    });
});
