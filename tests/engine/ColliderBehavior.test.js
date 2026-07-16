import { describe, it, expect } from 'vitest';
import { ColliderBehavior } from '../../src/engine/behaviors/ColliderBehavior.js';

describe('ColliderBehavior', () => {
    it('getBounds() uses the entity own size by default', () => {
        const entity = { x: 5, y: 5, width: 32, height: 32 };
        const collider = new ColliderBehavior(entity, { properties: {} });
        expect(collider.getBounds()).toEqual({ x: 5, y: 5, width: 32, height: 32 });
    });

    it('getBounds() honors offset/size overrides from properties', () => {
        const entity = { x: 5, y: 5, width: 32, height: 32 };
        const collider = new ColliderBehavior(entity, { properties: { offsetX: 2, width: 10, height: 10 } });
        expect(collider.getBounds()).toEqual({ x: 7, y: 5, width: 10, height: 10 });
    });
});
