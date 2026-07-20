import { describe, it, expect, vi, afterEach } from 'vitest';
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

    // §7 backlog item closed: real `camera` asset/component (docs/RUNTIME_SCHEMA.md) replaces
    // the always-on player-centering above when a level authors a camera marker.
    it('follows the camera marker\'s target instead of hard-centering on the player, and hides the marker', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        const manifest = movementManifest();
        manifest.levels[0].data.objects.push({
            id: 'cam1', type: 'camera', x: 0, y: 0, width: 32, height: 32,
            components: [{ id: 'c3', type: 'camera', enabled: true, properties: { deadzoneWidth: 100, deadzoneHeight: 100 } }]
        });
        await engine.loadProject(manifest);
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        const marker = engine.scene.entities.find(e => e.id === 'cam1');
        expect(marker.visible).toBe(false);

        engine.tick(0);
        expect(engine.camera.x).toBe(0 + 16 - 400);

        // Player moves ~3.2px — stays inside the 100px deadzone, camera doesn't follow yet.
        engine.tick(0.05);
        expect(engine.camera.x).toBe(0 + 16 - 400);
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

// Фаза D (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md) readiness criterion, verbatim: a trigger's
// OnCollisionEnter → SetVariable → SetComponentEnabled (disable a door's collider) actually
// works through Play-in-editor. TriggerBehavior.update() used to compute entered/exited and
// discard them (see checkEntities in tests/engine/TriggerBehavior.test.js) — this is the first
// place that result is consumed at runtime.
describe('GameEngine — Фаза D Event Graph MVP (OnCollisionEnter → SetVariable → SetComponentEnabled)', () => {
    function graphManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [{ name: 'doorOpen', type: 'bool', default: false }],
                        nodes: [
                            { id: 'n1', type: 'OnCollisionEnter', params: { objectId: 'zone' } },
                            { id: 'n2', type: 'SetVariable', params: { name: 'doorOpen', value: true } },
                            { id: 'n3', type: 'SetComponentEnabled', params: { objectId: 'door', componentType: 'collider', enabled: false } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }]
                    },
                    objects: [
                        { id: 'spawn', type: 'player_start', x: 0, y: 0, width: 32, height: 32,
                            components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                        { id: 'door', type: 'actor', x: 50, y: -10, width: 32, height: 52,
                            components: [{ id: 'c2', type: 'collider', enabled: true, properties: {} }] },
                        { id: 'zone', type: 'volume', x: -5, y: -5, width: 40, height: 40,
                            components: [{ id: 'c3', type: 'trigger', enabled: true, properties: {} }] }
                    ]
                }
            }]
        };
    }

    it('disables the door collider once the player steps into the zone, unblocking movement', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(graphManifest());
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        for (let i = 0; i < 5; i++) engine.tick(0.05); // 5 * 10px = 50px total, would stall at x=10 without the graph (see Input/player-movement suite above)

        expect(engine.scene.eventGraphRuntime.getVariable('doorOpen')).toBe(true);
        const doorCollider = engine.scene.entities.find(e => e.id === 'door').behaviors.find(b => b.type === 'collider');
        expect(doorCollider.enabled).toBe(false);
        expect(engine.scene.player.x).toBe(50);
    });
});

// Фаза E (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md) readiness criterion: OnStart -> StartDialogue
// shows the first node, movement pauses while dialogueActive, advance()/isEnded() drives
// OnDialogueEnded, which itself can run further graph actions (SetVariable here).
describe('GameEngine — Фаза E Dialogue MVP (OnStart → StartDialogue → advance → OnDialogueEnded)', () => {
    function dialogueManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [{ name: 'talkedToGuard', type: 'bool', default: false }],
                        nodes: [
                            { id: 'n1', type: 'OnStart' },
                            { id: 'n2', type: 'StartDialogue', params: { dialogueId: 'guard' } },
                            { id: 'n3', type: 'OnDialogueEnded' },
                            { id: 'n4', type: 'SetVariable', params: { name: 'talkedToGuard', value: true } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }, { from: 'n3', to: 'n4' }]
                    },
                    dialogues: [
                        { id: 'guard', formatVersion: 1, startNode: 'd1', nodes: [
                            { id: 'd1', speaker: 'Guard', text: 'Стой!', choices: [{ text: 'Уйти', next: null }] }
                        ] }
                    ],
                    objects: [
                        { id: 'spawn', type: 'player_start', x: 0, y: 0, width: 32, height: 32,
                            components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] }
                    ]
                }
            }]
        };
    }

    it('OnStart fires StartDialogue immediately, showing the first node', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(dialogueManifest());

        expect(engine.scene.dialogueActive).toBe(true);
        expect(engine.scene.dialogueRunner.getCurrentNode().text).toBe('Стой!');
    });

    it('pauses player movement while dialogueActive', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(dialogueManifest());
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        engine.tick(0.05);
        expect(engine.scene.player.x).toBe(0);
    });

    it('advance() ending the dialogue fires OnDialogueEnded next tick and clears dialogueActive', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(dialogueManifest());

        engine.scene.dialogueRunner.advance(0); // only choice, next: null -> ended
        engine.tick(0.05);

        expect(engine.scene.dialogueActive).toBe(false);
        expect(engine.scene.dialogueRunner).toBe(null);
        expect(engine.scene.eventGraphRuntime.getVariable('talkedToGuard')).toBe(true);
    });
});

// Фаза F (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md) readiness criterion: a state machine on
// spriteUiAnimation switches idle<->walk off the 'speed' variable PlayerMovementBehavior writes
// each tick (same shared level-scope store as Event Graph/Dialogue), and Event Graph's
// PlayAnimation can force a clip on top, resuming state-machine control on its next transition.
describe('GameEngine — Фаза F Animation state machine (idle<->walk via speed variable, PlayAnimation override)', () => {
    function animationManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'forceAttack' } },
                            { id: 'n2', type: 'PlayAnimation', params: { objectId: 'hero', clip: 'hero_attack' } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }]
                    },
                    objects: [
                        { id: 'spawn', type: 'player_start', x: 0, y: 0, width: 32, height: 32,
                            components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                        { id: 'hero', type: 'actor', x: 0, y: 0, width: 32, height: 32, imgSrc: 'hero.png',
                            components: [{ id: 'c2', type: 'spriteUiAnimation', enabled: true, properties: {
                                defaultState: 'idle',
                                clips: {
                                    hero_idle: [{ x: 0, y: 0, w: 32, h: 32, duration: 100 }],
                                    hero_walk: [{ x: 32, y: 0, w: 32, h: 32, duration: 100 }],
                                    hero_attack: [{ x: 64, y: 0, w: 32, h: 32, duration: 100 }]
                                },
                                states: [
                                    { name: 'idle', clip: 'hero_idle', transitions: [
                                        { condition: { var: 'speed', op: '>', value: 0 }, target: 'walk' }
                                    ] },
                                    { name: 'walk', clip: 'hero_walk', transitions: [
                                        { condition: { var: 'speed', op: '==', value: 0 }, target: 'idle' }
                                    ] }
                                ]
                            } }] }
                    ]
                }
            }]
        };
    }

    it('starts on the defaultState clip', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(animationManifest());
        const hero = engine.scene.entities.find(e => e.id === 'hero');
        const anim = hero.behaviors.find(b => typeof b.getSourceRect === 'function');

        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 }); // hero_idle
    });

    it('switches idle→walk once the moving player writes a positive speed variable (one-tick lag, same as OnInteract polling)', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(animationManifest());
        const hero = engine.scene.entities.find(e => e.id === 'hero');
        const anim = hero.behaviors.find(b => typeof b.getSourceRect === 'function');
        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };

        engine.tick(0.05); // hero's transition check runs before player writes 'speed' this tick
        expect(anim.getSourceRect()).toEqual({ x: 0, y: 0, w: 32, h: 32 }); // still idle

        engine.tick(0.05); // now reads speed=200 written last tick
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 }); // hero_walk
    });

    it("PlayAnimation forces a clip; the state machine resumes control on its own next transition", async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(animationManifest());
        const hero = engine.scene.entities.find(e => e.id === 'hero');
        const anim = hero.behaviors.find(b => typeof b.getSourceRect === 'function');

        engine.scene.eventGraphRuntime.emitCustomEvent('forceAttack');
        expect(anim.getSourceRect()).toEqual({ x: 64, y: 0, w: 32, h: 32 }); // hero_attack, forced

        engine.scene.input = { getAxis: () => ({ x: 1, y: 0 }) };
        engine.tick(0.05); // still reads old speed=0 -> no transition fires, forced clip persists
        expect(anim.getSourceRect()).toEqual({ x: 64, y: 0, w: 32, h: 32 });

        engine.tick(0.05); // reads speed=200 -> idle's own transition fires -> plays hero_walk
        expect(anim.getSourceRect()).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });
});

// §7 backlog Tier 1 (soundEffect): PlaySound reads {src, volume?, loop?} straight off node.params
// (Teleport-style inline data, see registerDefaultEventGraphNodes.js) and hands it to AudioPlayer.
describe('GameEngine — §7 backlog PlaySound action', () => {
    function soundManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'hit' } },
                            { id: 'n2', type: 'PlaySound', params: { src: 'hit.wav', volume: 0.5 } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }]
                    },
                    objects: []
                }
            }]
        };
    }

    afterEach(() => {
        delete global.Audio;
    });

    it('constructs and plays an Audio element with the node\'s src/volume when the event fires', async () => {
        const play = vi.fn().mockResolvedValue(undefined);
        global.Audio = vi.fn(function (src) {
            this.src = src;
            this.play = play;
        });

        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(soundManifest());

        engine.scene.eventGraphRuntime.emitCustomEvent('hit');

        expect(global.Audio).toHaveBeenCalledWith('hit.wav');
        expect(play).toHaveBeenCalled();
    });
});

// §7 backlog Tier 2 (prefab): SpawnObject resolves node.params.assetId against
// scene.assetsById (ProjectLoader.js, built from the manifest's `assets` array — see
// ProjectExporter.js's opts.assetManager) via EntityFactory.fromAssetData().
describe('GameEngine — §7 backlog SpawnObject action (prefab, Tier 2)', () => {
    function spawnManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{ id: 'asset_crate', name: 'Crate', type: 'actor', width: 16, height: 16, color: '#a52a2a' }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'spawn' } },
                            { id: 'n2', type: 'SpawnObject', params: { assetId: 'asset_crate', x: 40, y: 50 } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }]
                    },
                    objects: []
                }
            }]
        };
    }

    it('spawns an entity from the resolved catalog asset at the event graph node\'s x/y', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(spawnManifest());

        const before = engine.scene.entities.length;
        engine.scene.eventGraphRuntime.emitCustomEvent('spawn');

        expect(engine.scene.entities.length).toBe(before + 1);
        const spawned = engine.scene.entities.at(-1);
        expect(spawned.name).toBe('Crate');
        expect(spawned.x).toBe(40);
        expect(spawned.y).toBe(50);
        expect(spawned.color).toBe('#a52a2a');
    });

    it('warns and no-ops for an unknown assetId', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        const manifest = spawnManifest();
        manifest.levels[0].data.eventGraph.nodes[1].params.assetId = 'missing';
        await engine.loadProject(manifest);

        const before = engine.scene.entities.length;
        engine.scene.eventGraphRuntime.emitCustomEvent('spawn');

        expect(engine.scene.entities.length).toBe(before);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing'));
        warnSpy.mockRestore();
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
