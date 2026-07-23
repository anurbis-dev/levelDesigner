import { describe, it, expect } from 'vitest';
import { screenDeltaToOffsetDelta, canvasWithLivePatch } from '../src/ui/canvas-hud/CanvasHudPreview.js';

describe('CanvasHudPreview helpers', () => {
    it('maps screen delta to offset for corner anchors (right/bottom invert)', () => {
        expect(screenDeltaToOffsetDelta('topLeft', 10, 20)).toEqual({ dX: 10, dY: 20 });
        expect(screenDeltaToOffsetDelta('topRight', 10, 20)).toEqual({ dX: -10, dY: 20 });
        expect(screenDeltaToOffsetDelta('bottomLeft', 10, 20)).toEqual({ dX: 10, dY: -20 });
        expect(screenDeltaToOffsetDelta('bottomRight', 10, 20)).toEqual({ dX: -10, dY: -20 });
        expect(screenDeltaToOffsetDelta('middleCenter', 5, -3)).toEqual({ dX: 5, dY: -3 });
    });

    it('merges live patch onto selected widget only', () => {
        const canvas = {
            id: 'c1',
            widgets: [
                { id: 'a', offsetX: 0, offsetY: 0 },
                { id: 'b', offsetX: 1, offsetY: 2 }
            ]
        };
        const next = canvasWithLivePatch(canvas, 'b', { offsetX: 40 });
        expect(next.widgets[0].offsetX).toBe(0);
        expect(next.widgets[1].offsetX).toBe(40);
        expect(next.widgets[1].offsetY).toBe(2);
    });
});
