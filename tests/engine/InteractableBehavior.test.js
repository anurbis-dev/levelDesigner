import { describe, it, expect } from 'vitest';
import { InteractableBehavior } from '../../src/engine/behaviors/InteractableBehavior.js';

describe('InteractableBehavior', () => {
    it('defaults radius=32 and hint="Interact"', () => {
        const entity = { x: 0, y: 0, width: 32, height: 32 };
        const interactable = new InteractableBehavior(entity, { properties: {} });
        expect(interactable.radius).toBe(32);
        expect(interactable.hint).toBe('Interact');
    });

    it('reads radius/hint overrides from properties', () => {
        const entity = { x: 0, y: 0, width: 32, height: 32 };
        const interactable = new InteractableBehavior(entity, { properties: { radius: 64, hint: 'Open' } });
        expect(interactable.radius).toBe(64);
        expect(interactable.hint).toBe('Open');
    });

    it('isInRange() is true within the radius and false outside it', () => {
        const entity = { x: 0, y: 0, width: 32, height: 32 }; // center at (16, 16)
        const interactable = new InteractableBehavior(entity, { properties: { radius: 10 } });
        expect(interactable.isInRange({ x: 20, y: 16 })).toBe(true);
        expect(interactable.isInRange({ x: 100, y: 16 })).toBe(false);
    });
});
