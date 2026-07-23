import { describe, it, expect } from 'vitest';
import {
    resolveAnchorStyle,
    resolveBindingValue,
    resolveProgressFraction,
    resolveDisplayText,
    resolveWidgetImageSrc
} from '../../src/engine/CanvasHudBinding.js';

describe('resolveAnchorStyle', () => {
    it('positions topLeft via left/top offsets, no transform', () => {
        expect(resolveAnchorStyle('topLeft', 10, 20)).toEqual({
            position: 'absolute', top: '20px', left: '10px'
        });
    });

    it('positions bottomRight via right/bottom offsets', () => {
        expect(resolveAnchorStyle('bottomRight', 5, 8)).toEqual({
            position: 'absolute', bottom: '8px', right: '5px'
        });
    });

    it('centers topCenter horizontally with a translateX offset', () => {
        expect(resolveAnchorStyle('topCenter', 3, 0)).toEqual({
            position: 'absolute', top: '0px', left: '50%', transform: 'translate(calc(-50% + 3px), 0)'
        });
    });

    it('centers middleCenter on both axes', () => {
        expect(resolveAnchorStyle('middleCenter')).toEqual({
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(calc(-50% + 0px), calc(-50% + 0px))'
        });
    });

    it('falls back to topLeft for an unknown anchor', () => {
        expect(resolveAnchorStyle('nonsense')).toEqual(resolveAnchorStyle('topLeft'));
    });
});

describe('resolveBindingValue', () => {
    it('returns null when binding is missing', () => {
        expect(resolveBindingValue({}, null)).toBeNull();
    });

    it('reads a variable from scene.eventGraphRuntime', () => {
        const scene = { eventGraphRuntime: { getVariable: (name) => (name === 'score' ? 42 : null) } };
        expect(resolveBindingValue(scene, { source: 'variable', name: 'score' })).toBe(42);
    });

    it('reads an inventory count from scene.inventory', () => {
        const scene = { inventory: { count: (id) => (id === 'coin' ? 7 : 0) } };
        expect(resolveBindingValue(scene, { source: 'inventoryCount', itemId: 'coin' })).toBe(7);
    });

    it('returns null for an unknown binding source', () => {
        expect(resolveBindingValue({}, { source: 'bogus' })).toBeNull();
    });
});

describe('resolveProgressFraction', () => {
    it('returns 0 when binding is missing', () => {
        expect(resolveProgressFraction({}, null)).toBe(0);
    });

    it('divides the bound value by max, clamped to [0,1]', () => {
        const scene = { eventGraphRuntime: { getVariable: () => 30 } };
        expect(resolveProgressFraction(scene, { source: 'variable', name: 'hp', max: 100 })).toBe(0.3);
    });

    it('clamps above max to 1', () => {
        const scene = { eventGraphRuntime: { getVariable: () => 150 } };
        expect(resolveProgressFraction(scene, { source: 'variable', name: 'hp', max: 100 })).toBe(1);
    });

    it('clamps negative values to 0', () => {
        const scene = { eventGraphRuntime: { getVariable: () => -10 } };
        expect(resolveProgressFraction(scene, { source: 'variable', name: 'hp', max: 100 })).toBe(0);
    });
});

describe('resolveDisplayText', () => {
    it('returns the static text when there is no binding', () => {
        expect(resolveDisplayText({}, { text: 'Hello' })).toBe('Hello');
    });

    it('prefers the resolved binding value over static text', () => {
        const scene = { eventGraphRuntime: { getVariable: () => 5 } };
        const widget = { text: 'Score: 0', binding: { source: 'variable', name: 'score' } };
        expect(resolveDisplayText(scene, widget)).toBe('5');
    });

    it('falls back to static text when the binding resolves to null', () => {
        const scene = { eventGraphRuntime: { getVariable: () => null } };
        const widget = { text: 'fallback', binding: { source: 'variable', name: 'missing' } };
        expect(resolveDisplayText(scene, widget)).toBe('fallback');
    });
});

describe('resolveWidgetImageSrc', () => {
    it('resolves imageAssetId via assetsById Map', () => {
        const assetsById = new Map([['img_1', { type: 'image', imgSrc: 'data:image/png;base64,xx' }]]);
        expect(resolveWidgetImageSrc({ imageAssetId: 'img_1' }, assetsById)).toBe('data:image/png;base64,xx');
    });

    it('returns null when image asset missing', () => {
        expect(resolveWidgetImageSrc({ imageAssetId: 'missing' }, new Map())).toBeNull();
    });

    it('uses legacy imgSrc only when imageAssetId is empty', () => {
        expect(resolveWidgetImageSrc({ imgSrc: '/legacy.png' }, null)).toBe('/legacy.png');
        expect(resolveWidgetImageSrc({ imageAssetId: 'img_1', imgSrc: '/legacy.png' }, new Map())).toBeNull();
    });
});
