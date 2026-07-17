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

// Фаза 2 vertical slice (tmp/2D_Editor_ENGINE_PLAN.md §2): playerStart + collider + trigger
// resolve to real behaviors and the trigger tracks enter/exit as entities move between ticks.
// No Input/player-entity yet (Фаза 3) — the "candidate" below stands in for a would-be player.
function verticalSliceManifest() {
    return {
        formatVersion: 1,
        name: 'Demo',
        entryLevelId: 'level_a',
        levels: [{
            id: 'level_a',
            data: {
                meta: { name: 'Level A' },
                settings: { backgroundColor: '#000000' },
                camera: { x: 0, y: 0, zoom: 1 },
                layers: [],
                objects: [
                    { id: 'spawn', type: 'player_start', x: 0, y: 0,
                        components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                    { id: 'wall', type: 'actor', x: 100, y: 100, width: 32, height: 32,
                        components: [{ id: 'c2', type: 'collider', enabled: true, properties: {} }] },
                    { id: 'zone', type: 'volume', x: 200, y: 200, width: 20, height: 20,
                        components: [{ id: 'c3', type: 'trigger', enabled: true, properties: {} }] },
                    { id: 'candidate', type: 'actor', x: 500, y: 500, width: 10, height: 10,
                        components: [{ id: 'c4', type: 'collider', enabled: true, properties: {} }] }
                ]
            }
        }]
    };
}

// Input/player-movement (see PlayOperations.js history — deliberately deferred past Фаза 3,
// filled in now): loadProject() spawns a controllable player at the playerStart marker and
// wires scene.input so PlayerMovementBehavior can move it, blocked by colliders.
function movementManifest() {
    return {
        formatVersion: 1,
        name: 'Demo',
        entryLevelId: 'level_a',
        levels: [{
            id: 'level_a',
            data: {
                meta: { name: 'Level A' },
                camera: { x: 0, y: 0, zoom: 1 },
                layers: [],
                objects: [
                    { id: 'spawn', type: 'player_start', x: 0, y: 0, width: 32, height: 32,
                        components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                    { id: 'wall', type: 'actor', x: 50, y: -10, width: 32, height: 52,
                        components: [{ id: 'c2', type: 'collider', enabled: true, properties: {} }] }
                ]
            }
        }]
    };
}

describe('GameEngine — Input/player-movement', () => {
    it('spawns a player at the playerStart marker and hides the marker', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(movementManifest());

        expect(engine.scene.player).toBeTruthy();
        expect(engine.scene.player.x).toBe(0);
        const marker = engine.scene.entities.find(e => e.id === 'spawn');
        expect(marker.visible).toBe(false);
    });

    it('moves the player from scene.input and stops it at a collider (small per-tick steps, no tunneling)', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(movementManifest());
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        // dt=0.05s * speed 200px/s = 10px/tick; wall starts at x=50 — small steps so the
        // discrete AABB check (compare end-of-step bounds) can't skip over it in one tick.
        for (let i = 0; i < 5; i++) engine.tick(0.05);

        expect(engine.scene.player.x).toBe(10);

        const stalled = engine.scene.player.x;
        engine.tick(0.05);
        expect(engine.scene.player.x).toBe(stalled);
    });

    it('start() computes real per-frame dt from rAF timestamps', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(movementManifest());
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        let frame = 0;
        const timestamps = [1000, 1016, 1032];
        global.requestAnimationFrame = (cb) => setTimeout(() => cb(timestamps[Math.min(frame++, timestamps.length - 1)]), 0);
        global.cancelAnimationFrame = (id) => clearTimeout(id);

        engine.start();
        await new Promise(resolve => setTimeout(resolve, 10));
        engine.stop();

        // first frame's dt is 0 (baseline), later frames move ~200px/s * 0.016s ≈ 3.2px each
        expect(engine.scene.player.x).toBeGreaterThan(0);

        delete global.requestAnimationFrame;
        delete global.cancelAnimationFrame;
    });

    // Camera-follow (closes the "не входит" gap noted in tmp/2D_Editor_ENGINE_PLAN.md §4):
    // GameEngine.camera used to be set once in loadProject() and never updated in tick(),
    // so the player could walk off-screen. _updateCamera() now centers it on scene.player.
    it('centers the camera on the player as it moves, canvas 800x600 zoom 1', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(movementManifest());
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        engine.tick(0);
        expect(engine.camera.x).toBe(0 + 16 - 400);
        expect(engine.camera.y).toBe(0 + 16 - 300);

        engine.tick(0.05);
        expect(engine.camera.x).toBe(engine.scene.player.x + 16 - 400);
    });

    it('leaves the camera static when the level has no player (no playerStart)', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(fixtureManifest());

        engine.camera.x = 42;
        engine.tick();

        expect(engine.camera.x).toBe(42);
    });
});

// Фаза B (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md): sprite-sheet playback. Also closes a real,
// previously-unnoticed gap — renderer.imageCache was never populated by loadProject(), so no
// entity's imgSrc ever actually rendered (always fell back to the flat-color rect).
describe('GameEngine — Фаза B sprite-sheet playback', () => {
    function spriteManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    objects: [
                        {
                            id: 'hero', type: 'actor', x: 0, y: 0, width: 32, height: 32, imgSrc: 'hero.png',
                            components: [{ id: 'c1', type: 'spriteUiAnimation', enabled: true, properties: {
                                frames: [
                                    { x: 0, y: 0, w: 32, h: 32, duration: 100 },
                                    { x: 32, y: 0, w: 32, h: 32, duration: 100 }
                                ], loop: true
                            } }]
                        }
                    ]
                }
            }]
        };
    }

    it('loadProject() wires renderer.imageCache (Map) even without an Image global (Node test env)', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);

        await engine.loadProject(spriteManifest());

        expect(engine.renderer.imageCache).toBeInstanceOf(Map);
    });

    it('advances the sprite animation frame over ticks', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(spriteManifest());
        const hero = engine.scene.entities.find(e => e.id === 'hero');
        const anim = hero.behaviors.find(b => typeof b.getSourceRect === 'function');

        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 });
        engine.tick(0.1);
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });
});

describe('GameEngine — Фаза 2 vertical slice (BehaviorRegistry + collider/trigger/playerStart)', () => {
    it('resolves playerStart/collider/trigger to real behaviors and tracks trigger enter/exit across ticks', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);

        await engine.loadProject(verticalSliceManifest());

        expect(engine.scene.getPlayerStart()).toEqual({ x: 0, y: 0 });

        const zone = engine.scene.entities.find(e => e.id === 'zone');
        const trigger = zone.behaviors.find(b => typeof b.isOverlapping === 'function');
        const candidate = engine.scene.entities.find(e => e.id === 'candidate');

        engine.tick();
        expect(trigger.isOverlapping('candidate')).toBe(false);

        candidate.x = 205;
        candidate.y = 205;
        engine.tick();
        expect(trigger.isOverlapping('candidate')).toBe(true);

        candidate.x = 500;
        engine.tick();
        expect(trigger.isOverlapping('candidate')).toBe(false);
    });
});
