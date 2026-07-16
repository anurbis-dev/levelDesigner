import { describe, it, expect } from 'vitest';
import { ParallaxController } from '../../src/engine/render/ParallaxController.js';

// Numeric expectations mirror src/utils/ParallaxRenderer.js's getCameraOffset/
// getParallaxOffset on the same inputs — regression guard against formula drift
// between editor preview and engine playback (tmp/2D_Editor_ENGINE_PLAN.md §1.2).
describe('ParallaxController.getCameraOffset', () => {
    it('matches ParallaxRenderer.getCameraOffset formula', () => {
        const camera = { x: 150, y: 80 };
        const settings = { parallaxHorizontal: 0.5, parallaxVertical: 2 };
        const startPosition = { x: 100, y: 50 };

        const offset = ParallaxController.getCameraOffset(camera, settings, startPosition);

        expect(offset).toEqual({ x: (150 - 100) * 0.5, y: (80 - 50) * 2 });
    });

    it('defaults multipliers to 1 when settings omit them', () => {
        const offset = ParallaxController.getCameraOffset({ x: 10, y: 10 }, {}, { x: 0, y: 0 });
        expect(offset).toEqual({ x: 10, y: 10 });
    });
});

describe('ParallaxController.getParallaxOffset', () => {
    it('returns zero offset when layer parallaxOffset is 0', () => {
        expect(ParallaxController.getParallaxOffset(0, { x: 100, y: 100 })).toEqual({ x: 0, y: 0 });
    });

    it('matches ParallaxRenderer.getParallaxOffset formula', () => {
        const cameraOffset = { x: 40, y: -20 };
        const offset = ParallaxController.getParallaxOffset(0.25, cameraOffset);
        expect(offset).toEqual({ x: 40 * 1.25, y: -20 * 1.25 });
    });
});
