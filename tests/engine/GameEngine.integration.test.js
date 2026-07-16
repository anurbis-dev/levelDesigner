import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../../src/engine/GameEngine.js';

function mockCanvas() {
    const ctx = {
        fillRect: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn(),
        save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
        fillStyle: null
    };
    const canvas = { width: 800, height: 600, getContext: () => ctx };
    return { canvas, ctx };
}

// Фаза 1 "Критерий готовности" (tmp/2D_Editor_ENGINE_PLAN.md §1): a minimal runtime-Project
// (one level, no game-type objects, just layers+settings+camera) loads through
// ProjectLoader → EntityFactory, renders with the right background/parallax, camera moves.
function fixtureManifest() {
    return {
        formatVersion: 1,
        name: 'Demo',
        entryLevelId: 'level_a',
        levels: [{
            id: 'level_a',
            data: {
                meta: { name: 'Level A' },
                settings: { backgroundColor: '#654321', parallaxHorizontal: 1, parallaxVertical: 1 },
                camera: { x: 0, y: 0, zoom: 1 },
                objects: [],
                layers: []
            }
        }]
    };
}

describe('GameEngine — Фаза 1 readiness criterion', () => {
    it('loads a minimal Project and renders the correct background', async () => {
        const { canvas, ctx } = mockCanvas();
        const engine = new GameEngine(canvas);

        await engine.loadProject(fixtureManifest());
        engine.tick();

        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
        expect(ctx.fillStyle).toBe('#654321');
    });

    it('camera moves between frames (translate args change)', async () => {
        const { canvas, ctx } = mockCanvas();
        const engine = new GameEngine(canvas);

        await engine.loadProject(fixtureManifest());
        engine.tick();
        const firstTranslate = ctx.translate.mock.calls.at(-1);

        engine.camera.x += 100;
        engine.tick();
        const secondTranslate = ctx.translate.mock.calls.at(-1);

        expect(firstTranslate[0]).toBe(-0);
        expect(firstTranslate[1]).toBe(-0);
        expect(secondTranslate[0]).toBe(-100);
        expect(secondTranslate[1]).toBe(-0);
    });
});
