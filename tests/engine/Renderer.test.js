import { describe, it, expect, vi } from 'vitest';
import { Renderer } from '../../src/engine/render/Renderer.js';
import { Scene } from '../../src/engine/Scene.js';

function mockCanvas() {
    const ctx = {
        fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
        save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
        fillStyle: null
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
});

describe('Renderer.drawEntity', () => {
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
});
