import { describe, it, expect, vi } from 'vitest';
import { Renderer } from '../../src/engine/render/Renderer.js';
import { Scene } from '../../src/engine/Scene.js';

function mockCanvas() {
    const grad = { addColorStop: vi.fn() };
    const ctx = {
        fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
        save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
        fillStyle: null, filter: 'none',
        globalCompositeOperation: 'source-over',
        createRadialGradient: vi.fn(() => grad),
        beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
        moveTo: vi.fn(), closePath: vi.fn(), clip: vi.fn()
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx };
    return { canvas, ctx };
}

function sceneWith(overrides = {}) {
    return new Scene({
        settings: { backgroundColor: '#123456', ...overrides.settings },
        camera: { x: 0, y: 0, zoom: 1 },
        objects: overrides.objects || [],
        layers: overrides.layers || []
    });
}

describe('Renderer.renderScene', () => {
    it('draws the background using scene.settings.backgroundColor', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith();

        renderer.renderScene(scene, scene.camera);

        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
        expect(ctx.fillStyle).toBe('#123456');
    });

    it('applies camera scale/translate', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith();

        renderer.renderScene(scene, { x: 10, y: 20, zoom: 2 });

        expect(ctx.scale).toHaveBeenCalledWith(2, 2);
        expect(ctx.translate).toHaveBeenCalledWith(-10, -20);
    });

    it('camera movement between two renders changes the translate call', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith();

        renderer.renderScene(scene, { x: 0, y: 0, zoom: 1 });
        const firstCallArgs = ctx.translate.mock.calls.at(-1);

        renderer.renderScene(scene, { x: 50, y: 0, zoom: 1 });
        const secondCallArgs = ctx.translate.mock.calls.at(-1);

        expect(firstCallArgs).not.toEqual(secondCallArgs);
        expect(secondCallArgs[0]).toBe(-50);
        expect(secondCallArgs[1]).toBe(-0);
    });

    it('with a renderLayers filter, skips entities on layers outside the list', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith({
            layers: [{ id: 'bg' }, { id: 'fg' }],
            objects: [
                { id: 'a', type: 'actor', x: 0, y: 0, width: 10, height: 10, color: '#111111', layerId: 'bg' },
                { id: 'b', type: 'actor', x: 20, y: 20, width: 10, height: 10, color: '#222222', layerId: 'fg' }
            ]
        });

        renderer.renderScene(scene, scene.camera, scene.camera, ['fg']);

        // background fillRect + exactly one entity (the 'bg'-layer entity is skipped)
        expect(ctx.fillRect).toHaveBeenCalledTimes(2);
        expect(ctx.fillRect).toHaveBeenCalledWith(20, 20, 10, 10);
    });

    it('with a renderLayers filter, still draws entities without a layerId', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith({
            layers: [{ id: 'fg' }],
            objects: [
                { id: 'a', type: 'actor', x: 0, y: 0, width: 10, height: 10, color: '#111111' }
            ]
        });

        renderer.renderScene(scene, scene.camera, scene.camera, ['fg']);

        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 10, 10);
    });

    it('a null/empty renderLayers renders every entity (no restriction)', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const scene = sceneWith({
            layers: [{ id: 'bg' }, { id: 'fg' }],
            objects: [
                { id: 'a', type: 'actor', x: 0, y: 0, width: 10, height: 10, color: '#111111', layerId: 'bg' },
                { id: 'b', type: 'actor', x: 20, y: 20, width: 10, height: 10, color: '#222222', layerId: 'fg' }
            ]
        });

        renderer.renderScene(scene, scene.camera, scene.camera, []);

        // background fillRect + both entities
        expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    });
});

describe('Renderer.drawEntity', () => {
    it('delegates to tilemap.drawTiles when a drawTiles behavior is present', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const drawTiles = vi.fn().mockReturnValue(true);

        renderer.drawEntity({
            visible: true, type: 'tilemap', x: 5, y: 5, width: 64, height: 32, color: '#ff0000',
            behaviors: [{ drawTiles }]
        });

        expect(drawTiles).toHaveBeenCalledWith(ctx, undefined, 5, 5);
        // no full-entity fillRect fallback
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('delegates to particleEffect.drawParticles when present', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const drawParticles = vi.fn().mockReturnValue(true);

        renderer.drawEntity({
            visible: true, type: 'particleEffect', x: 10, y: 20, width: 8, height: 8, color: '#0f0',
            behaviors: [{ drawParticles }]
        });

        expect(drawParticles).toHaveBeenCalledWith(ctx, undefined, 10, 20);
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('suppresses entity fill when light.drawLight is present', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const drawLight = vi.fn();

        renderer.drawEntity({
            visible: true, type: 'light', x: 10, y: 20, width: 8, height: 8, color: '#ff0',
            behaviors: [{ drawLight, enabled: true, ambient: 0.3 }]
        });

        expect(drawLight).not.toHaveBeenCalled();
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('applyLights darkens ambient and calls drawLight with lighter composite', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const drawLight = vi.fn();
        const scene = sceneWith({
            objects: [{
                id: 'lamp', type: 'light', x: 40, y: 40, width: 16, height: 16,
                visible: true,
                behaviors: [{ drawLight, enabled: true, ambient: 0.5 }]
            }]
        });
        // Scene builds entities from objects — re-attach behavior duck-type
        const ent = scene.entities.find(e => e.id === 'lamp') || scene.entities[0];
        if (ent) ent.behaviors = [{ drawLight, enabled: true, ambient: 0.5 }];

        renderer.applyLights(scene, { x: 0, y: 0, zoom: 1 }, null);

        expect(ctx.fillStyle).toBe('rgba(0,0,0,0.5)');
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
        expect(drawLight).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe('source-over'); // restored
    });

    it('draws a colored rect when no image is cached', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({ visible: true, type: 'actor', x: 5, y: 5, width: 32, height: 32, color: '#ff0000' });

        expect(ctx.fillRect).toHaveBeenCalledWith(5, 5, 32, 32);
        expect(ctx.fillStyle).toBe('#ff0000');
    });

    it('skips invisible entities', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({ visible: false, type: 'actor', x: 0, y: 0, width: 32, height: 32 });

        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('recurses into group children with absolute position', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({
            visible: true, type: 'group', x: 10, y: 10,
            children: [{ visible: true, type: 'actor', x: 5, y: 5, width: 8, height: 8, color: '#00ff00' }]
        });

        expect(ctx.fillRect).toHaveBeenCalledWith(15, 15, 8, 8);
    });

    it('draws the whole cached image (5-arg drawImage) when there is no sprite-animation behavior', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const img = { complete: true, naturalHeight: 32 };
        renderer.imageCache = new Map([['hero.png', img]]);

        renderer.drawEntity({ visible: true, type: 'actor', x: 5, y: 5, width: 32, height: 32, imgSrc: 'hero.png' });

        expect(ctx.drawImage).toHaveBeenCalledWith(img, 5, 5, 32, 32);
    });

    it('draws the current animation frame (9-arg drawImage source-rect) when a getSourceRect behavior is present', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);
        const img = { complete: true, naturalHeight: 32 };
        renderer.imageCache = new Map([['hero.png', img]]);
        const spriteAnim = { getSourceRect: () => ({ x: 32, y: 0, w: 16, h: 16 }) };

        renderer.drawEntity({
            visible: true, type: 'actor', x: 5, y: 5, width: 16, height: 16, imgSrc: 'hero.png',
            behaviors: [spriteAnim]
        });

        expect(ctx.drawImage).toHaveBeenCalledWith(img, 32, 0, 16, 16, 5, 5, 16, 16);
    });

    it('sets ctx.filter to "none" for an entity with no materialPreset', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({ visible: true, type: 'actor', x: 0, y: 0, width: 10, height: 10, color: '#fff' });

        expect(ctx.filter).toBe('none');
    });

    it('builds a CSS filter string from materialPreset (§7 backlog materialShaderPreset Tier 1)', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({
            visible: true, type: 'actor', x: 0, y: 0, width: 10, height: 10, color: '#fff',
            materialPreset: { blur: 4, brightness: 1.2, saturate: 0.5, hueRotate: 90, dropShadow: { x: 2, y: 2, blur: 3, color: 'red' } }
        });

        expect(ctx.filter).toBe('blur(4px) brightness(1.2) saturate(0.5) hue-rotate(90deg) drop-shadow(2px 2px 3px red)');
    });

    it('resets ctx.filter to "none" for the next entity after a filtered one', () => {
        const { canvas, ctx } = mockCanvas();
        const renderer = new Renderer(canvas);

        renderer.drawEntity({ visible: true, type: 'actor', x: 0, y: 0, width: 10, height: 10, materialPreset: { blur: 4 } });
        expect(ctx.filter).toBe('blur(4px)');

        renderer.drawEntity({ visible: true, type: 'actor', x: 0, y: 0, width: 10, height: 10 });
        expect(ctx.filter).toBe('none');
    });
});
