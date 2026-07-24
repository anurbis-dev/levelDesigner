import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameEngine } from '../../src/engine/GameEngine.js';
import { Input } from '../../src/engine/Input.js';
import { AudioPlayer } from '../../src/engine/AudioPlayer.js';

/** Minimal fake EventTarget so tests don't need jsdom (see tests/engine/Input.test.js). */
function fakeInputTarget() {
    const listeners = {};
    return {
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener(type, fn) {
            listeners[type] = (listeners[type] || []).filter(l => l !== fn);
        },
        dispatch(type, event) {
            (listeners[type] || []).forEach(fn => fn(event));
        }
    };
}

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

// §7 backlog Tier 3 (musicTrack): PlayMusic/StopMusic + audioZone enter/exit.
describe('GameEngine — §7 backlog PlayMusic / audioZone', () => {
    function musicManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'bgm' } },
                            { id: 'n2', type: 'PlayMusic', params: { src: 'theme.ogg', volume: 0.6 } },
                            { id: 'n3', type: 'OnCustomEvent', params: { name: 'silence' } },
                            { id: 'n4', type: 'StopMusic', params: {} }
                        ],
                        edges: [
                            { from: 'n1', to: 'n2' },
                            { from: 'n3', to: 'n4' }
                        ]
                    },
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'amb', type: 'audioZone', x: 100, y: 0, width: 40, height: 40,
                            layerId: 'main',
                            components: [{
                                type: 'audioZone',
                                properties: { src: 'cave.ogg', volume: 0.5, channel: 'ambient' }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    afterEach(() => {
        AudioPlayer._reset();
        delete global.Audio;
    });

    it('PlayMusic starts the music channel; StopMusic clears it', async () => {
        global.Audio = vi.fn(function (src) {
            this.src = src;
            this.volume = 1;
            this.loop = false;
            this.currentTime = 0;
            this.pause = vi.fn();
            this.play = vi.fn().mockResolvedValue(undefined);
        });

        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(musicManifest());

        engine.scene.eventGraphRuntime.emitCustomEvent('bgm');
        expect(global.Audio).toHaveBeenCalledWith('theme.ogg');
        expect(AudioPlayer._music?.volume).toBe(0.6);
        expect(AudioPlayer._music?.loop).toBe(true);

        engine.scene.eventGraphRuntime.emitCustomEvent('silence');
        expect(AudioPlayer._music).toBe(null);
    });

    it('audioZone plays ambient when the player enters the zone', async () => {
        global.Audio = vi.fn(function (src) {
            this.src = src;
            this.volume = 1;
            this.loop = false;
            this.currentTime = 0;
            this.pause = vi.fn();
            this.play = vi.fn().mockResolvedValue(undefined);
        });

        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(musicManifest());

        // player starts at (0,0); move into the zone at x=100
        engine.scene.player.x = 110;
        engine.scene.player.y = 10;
        engine.tick(0.016);

        expect(global.Audio).toHaveBeenCalledWith('cave.ogg');
        expect(AudioPlayer._ambient?.volume).toBe(0.5);
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

// §7 backlog Tier 3 (questObjective): StartQuest begins tracking; QuestRunner.tick() (driven by
// EventGraphRuntime.tick(), not a separate GameEngine hook) polls objective.condition against
// eventGraphRuntime variables and applies the reward once every objective completes.
describe('GameEngine — §7 backlog StartQuest action (questObjective, Tier 3)', () => {
    function questManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    quests: [{
                        id: 'quest_key',
                        name: 'Find the key',
                        objectives: [{ id: 'obj_found', condition: { var: 'hasKey', op: '==', value: true } }],
                        reward: [{ type: 'giveItem', itemId: 'gold', count: 5 }]
                    }],
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [{ name: 'hasKey', default: false }],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'begin' } },
                            { id: 'n2', type: 'StartQuest', params: { questId: 'quest_key' } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }]
                    },
                    objects: []
                }
            }]
        };
    }

    it('completes the quest and applies its reward once the objective condition is met', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(questManifest());

        engine.scene.eventGraphRuntime.emitCustomEvent('begin');
        expect(engine.scene.questRunner.getStatus('quest_key')).toBe('active');

        engine.tick(0);
        expect(engine.scene.questRunner.getStatus('quest_key')).toBe('active');
        expect(engine.scene.inventory.count('gold')).toBe(0);

        engine.scene.eventGraphRuntime.setVariable('hasKey', true);
        engine.tick(0);

        expect(engine.scene.questRunner.getStatus('quest_key')).toBe('completed');
        expect(engine.scene.inventory.count('gold')).toBe(5);
    });
});

// §7 backlog Tier 3 (saveSchema): SaveGame/LoadGame actions persist to localStorage, browser-
// guarded (no-op in Node, mocked here). Schema is inline node params, not a separate asset.
describe('GameEngine — §7 backlog SaveGame/LoadGame actions (saveSchema, Tier 3)', () => {
    function saveManifest() {
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
                        variables: [{ name: 'score', default: 0 }],
                        nodes: [
                            { id: 'n1', type: 'OnCustomEvent', params: { name: 'save' } },
                            { id: 'n2', type: 'SaveGame', params: { variables: ['score'], inventory: true } },
                            { id: 'n3', type: 'OnCustomEvent', params: { name: 'load' } },
                            { id: 'n4', type: 'LoadGame', params: { variables: ['score'], inventory: true } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }, { from: 'n3', to: 'n4' }]
                    },
                    objects: []
                }
            }]
        };
    }

    function mockLocalStorage() {
        const store = new Map();
        return {
            getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
            setItem: vi.fn((k, v) => store.set(k, v)),
            removeItem: vi.fn((k) => store.delete(k))
        };
    }

    afterEach(() => {
        delete global.localStorage;
    });

    it('SaveGame persists variables/inventory, LoadGame restores them onto a fresh scene', async () => {
        global.localStorage = mockLocalStorage();

        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(saveManifest());
        engine.scene.eventGraphRuntime.setVariable('score', 99);
        engine.scene.inventory.add('gold', 7);

        engine.scene.eventGraphRuntime.emitCustomEvent('save');

        const engine2 = new GameEngine(mockCanvas().canvas);
        await engine2.loadProject(saveManifest());
        engine2.scene.eventGraphRuntime.emitCustomEvent('load');

        expect(engine2.scene.eventGraphRuntime.getVariable('score')).toBe(99);
        expect(engine2.scene.inventory.count('gold')).toBe(7);
    });
});

// §7 backlog Tier 3 (inputMap): remapped keyboard actions, wired via GameEngine.loadProject()
// calling engine.input.setInputMap(scene.inputMap) — see src/engine/Input.js.
describe('GameEngine — §7 backlog inputMap wiring (Tier 3)', () => {
    function inputMapManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [],
                    inputMap: { actions: { interact: ['f'] } },
                    eventGraph: {
                        formatVersion: 1, scope: 'level',
                        variables: [{ name: 'talked', default: false }],
                        nodes: [
                            { id: 'n1', type: 'OnInteract', params: { objectId: 'npc' } },
                            { id: 'n2', type: 'SetVariable', params: { name: 'talked', value: true } }
                        ],
                        edges: [{ from: 'n1', to: 'n2' }]
                    },
                    objects: [
                        { id: 'spawn', type: 'player_start', x: 0, y: 0, width: 32, height: 32,
                            components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                        { id: 'npc', type: 'actor', x: 0, y: 0, width: 32, height: 32,
                            components: [{ id: 'c2', type: 'interactable', enabled: true, properties: { radius: 32 } }] }
                    ]
                }
            }]
        };
    }

    it("applies the level's inputMap onto engine.input via setInputMap", async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        const spy = vi.spyOn(engine.input, 'setInputMap');

        await engine.loadProject(inputMapManifest());

        expect(spy).toHaveBeenCalledWith({ actions: { interact: ['f'] } });
    });

    it('OnInteract fires on the remapped key, not the default "e", once the level customizes it', async () => {
        const target = fakeInputTarget();
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        engine.input.destroy();
        engine.input = new Input(target);

        await engine.loadProject(inputMapManifest());
        engine.scene.input = engine.input;

        target.dispatch('keydown', { key: 'e' }); // old default key — should NOT trigger interact
        engine.tick(0.016);
        expect(engine.scene.eventGraphRuntime.getVariable('talked')).toBe(false);

        target.dispatch('keyup', { key: 'e' });
        target.dispatch('keydown', { key: 'f' }); // remapped key
        engine.tick(0.016);
        expect(engine.scene.eventGraphRuntime.getVariable('talked')).toBe(true);
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

// §7 backlog Tier 3 (tileset + tilemap): grid collision + tileset asset resolve.
describe('GameEngine — §7 backlog tileset + tilemap', () => {
    function tilemapManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'ts_ground', name: 'Ground', type: 'tileset', imgSrc: 'ground.png',
                properties: { tileWidth: 16, tileHeight: 16, columns: 2 }
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            // wall of solid tiles at x=32..64, empty gap at left so spawn is free
                            id: 'ground', type: 'tilemap', x: 32, y: 0, width: 32, height: 16,
                            layerId: 'main',
                            components: [{
                                type: 'tilemap',
                                properties: {
                                    tilesetAssetId: 'ts_ground',
                                    mapWidth: 2, mapHeight: 1,
                                    tiles: [0, 1]
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads tilemap behavior, resolves tileset atlas, blocks player on solid cells', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(tilemapManifest());

        const ground = engine.scene.entities.find(e => e.id === 'ground');
        const tilemap = ground.behaviors.find(b => typeof b.getSolidRects === 'function');
        expect(tilemap).toBeTruthy();
        // AssetLoader.collectImageSources resolves tileset during loadProject
        expect(tilemap._resolvedSrc).toBe('ground.png');
        const rects = tilemap.getSolidRects(engine.scene);
        expect(rects).toHaveLength(2);
        expect(rects.every(r => r.x >= 32)).toBe(true);

        const player = engine.scene.player;
        expect(player).toBeTruthy();

        const { rectsIntersect, getEntityBounds, collectSolidBlockers } =
            await import('../../src/engine/behaviors/AABB.js');
        const solids = collectSolidBlockers(engine.scene, player, undefined);
        expect(solids.length).toBeGreaterThanOrEqual(2);

        const pBounds = getEntityBounds(player, {});
        pBounds.x = 32;
        pBounds.y = 0;
        expect(solids.some(s => rectsIntersect(pBounds, s.getBounds()))).toBe(true);

        // left of the map stays free
        pBounds.x = 0;
        expect(solids.some(s => rectsIntersect(pBounds, s.getBounds()))).toBe(false);
    });
});

// §7 backlog Tier 4 (navMesh): walkable zone + chase pathfinding.
describe('GameEngine — §7 backlog navMesh', () => {
    function navMeshManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'mesh_shared', name: 'Floor', type: 'navMesh',
                properties: {
                    cellSize: 10,
                    blocked: [{ x: 30, y: 0, width: 20, height: 50 }]
                }
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 70, y: 10, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'floor', type: 'navMesh', x: 0, y: 0, width: 80, height: 80,
                            layerId: 'main',
                            components: [{
                                type: 'navMesh',
                                properties: { navMeshAssetId: 'mesh_shared' }
                            }]
                        },
                        {
                            id: 'npc', type: 'object', x: 10, y: 10, width: 10, height: 10,
                            layerId: 'main',
                            components: [{
                                type: 'stateMachineBehavior',
                                properties: {
                                    defaultState: 'chase',
                                    states: [{ name: 'chase', movement: 'chase', speed: 50 }]
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads navMesh, merges asset, never solid, chase routes around blocked', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(navMeshManifest());

        const floor = engine.scene.entities.find(e => e.id === 'floor');
        expect(floor).toBeTruthy();
        const nav = floor.behaviors.find(b => typeof b.findPath === 'function');
        expect(nav).toBeTruthy();
        expect(nav.isOverlapping()).toBe(false);
        nav.update(0, engine.scene);
        expect(nav.cellSize).toBe(10);
        expect(nav.blocked.length).toBe(1);
        expect(nav.containsWorldPoint(10, 10)).toBe(true);
        expect(nav.containsWorldPoint(40, 10)).toBe(false);

        const npc = engine.scene.entities.find(e => e.id === 'npc');
        const sm = npc.behaviors.find(b => typeof b.setState === 'function');
        expect(sm).toBeTruthy();
        for (let i = 0; i < 30; i++) engine.tick(0.2);
        // Should have moved toward player without ending inside blocked band
        expect(npc.x).toBeGreaterThan(10);
        const insideBlocked = npc.x >= 30 && npc.x < 50 && npc.y < 50;
        expect(insideBlocked).toBe(false);
    });
});

// §7 backlog Tier 4 (volume): view filter while player inside zone.
describe('GameEngine — §7 backlog volume', () => {
    function volumeManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'fx_fog', name: 'Fog', type: 'materialShaderPreset',
                properties: { blur: 5, saturate: 0.6 }
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'fog', type: 'volume', x: 0, y: 0, width: 64, height: 64,
                            layerId: 'main',
                            components: [{
                                type: 'volume',
                                properties: {
                                    presetAssetId: 'fx_fog',
                                    priority: 1
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads volume, merges preset asset, never solid, activates filter on player enter', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(volumeManifest());

        const fog = engine.scene.entities.find(e => e.id === 'fog');
        expect(fog).toBeTruthy();
        const vol = fog.behaviors.find(b => typeof b.getViewFilter === 'function');
        expect(vol).toBeTruthy();
        expect(vol.isOverlapping()).toBe(false);

        // Player spawns at 0,0 — inside the 64×64 volume
        vol.update(0, engine.scene);
        expect(vol.blur).toBe(5);
        expect(vol.saturate).toBe(0.6);
        expect(vol.getViewFilter()).toEqual({ blur: 5, saturate: 0.6 });

        engine.renderer.applyVolumeFilter(engine.scene);
        expect(engine.renderer.lastVolumeFilter).toBe('blur(5px) saturate(0.6)');
    });
});

// §7 backlog Tier 4 (fontTextStyle): canvas text draw path.
describe('GameEngine — §7 backlog fontTextStyle', () => {
    function fontTextManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'title_style', name: 'Title', type: 'fontTextStyle',
                properties: { fontFamily: 'Georgia', fontSize: 22, color: '#ffcc00' }
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'label', type: 'fontTextStyle', x: 40, y: 50, width: 200, height: 48,
                            layerId: 'main',
                            components: [{
                                type: 'fontTextStyle',
                                properties: {
                                    text: 'Hello',
                                    styleAssetId: 'title_style',
                                    align: 'center',
                                    wrap: false
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads fontTextStyle, merges style asset, never solid, draws text', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(fontTextManifest());

        const label = engine.scene.entities.find(e => e.id === 'label');
        expect(label).toBeTruthy();
        const ft = label.behaviors.find(b => typeof b.drawText === 'function');
        expect(ft).toBeTruthy();
        expect(ft.isOverlapping()).toBe(false);

        ft.update(0, engine.scene);
        expect(ft.fontFamily).toBe('Georgia');
        expect(ft.fontSize).toBe(22);
        expect(ft.color).toBe('#ffcc00');
        expect(ft.text).toBe('Hello');

        const ctx = {
            save: vi.fn(), restore: vi.fn(),
            fillText: vi.fn(), strokeText: vi.fn(),
            measureText: vi.fn(() => ({ width: 40 })),
            font: '', fillStyle: null, strokeStyle: null, lineWidth: 0, lineJoin: '',
            textAlign: 'left', textBaseline: 'top',
            shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0
        };
        ft.drawText(ctx, label.x, label.y);
        expect(ctx.fillText).toHaveBeenCalledWith('Hello', 40 + 100, 50);
        expect(ctx.textAlign).toBe('center');
    });
});

// §7 backlog Tier 4 (nineSliceSprite): 3×3 stretch draw path.
describe('GameEngine — §7 backlog nineSliceSprite', () => {
    function nineSliceManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'frame_img', name: 'Frame', type: 'image', imgSrc: 'frame.png'
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'panel', type: 'nineSliceSprite', x: 20, y: 30, width: 120, height: 80,
                            layerId: 'main',
                            components: [{
                                type: 'nineSliceSprite',
                                properties: {
                                    imageAssetId: 'frame_img',
                                    borderLeft: 6,
                                    borderRight: 6,
                                    borderTop: 6,
                                    borderBottom: 6,
                                    fillCenter: true
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads nineSliceSprite, resolves image, never solid, draws 9 patches', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(nineSliceManifest());

        const panel = engine.scene.entities.find(e => e.id === 'panel');
        expect(panel).toBeTruthy();
        const ns = panel.behaviors.find(b => typeof b.drawNineSlice === 'function');
        expect(ns).toBeTruthy();
        expect(ns._resolvedSrc).toBe('frame.png');
        expect(ns.isOverlapping()).toBe(false);
        expect(ns.borderLeft).toBe(6);

        const img = {
            complete: true, naturalWidth: 32, naturalHeight: 32, width: 32, height: 32
        };
        const ctx = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: null };
        ns.drawNineSlice(ctx, new Map([['frame.png', img]]), panel.x, panel.y);
        expect(ctx.drawImage).toHaveBeenCalledTimes(9);
    });
});

// §7 backlog Tier 4 (light): ambient + additive glow pass.
describe('GameEngine — §7 backlog light', () => {
    function lightManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'lamp', type: 'light', x: 80, y: 60, width: 16, height: 16,
                            layerId: 'main',
                            components: [{
                                type: 'light',
                                properties: {
                                    lightType: 'point',
                                    color: '#ffaa00',
                                    intensity: 0.9,
                                    radius: 100,
                                    ambient: 0.4
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads light, never solid, drawLight paints radial glow', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(lightManifest());

        const lamp = engine.scene.entities.find(e => e.id === 'lamp');
        expect(lamp).toBeTruthy();
        const light = lamp.behaviors.find(b => typeof b.drawLight === 'function');
        expect(light).toBeTruthy();
        expect(light.lightType).toBe('point');
        expect(light.isOverlapping()).toBe(false);

        const grad = { addColorStop: vi.fn() };
        const ctx = {
            createRadialGradient: vi.fn(() => grad),
            beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
            fillStyle: null
        };
        light.drawLight(ctx, lamp.x, lamp.y);
        expect(ctx.createRadialGradient).toHaveBeenCalled();
        expect(ctx.fill).toHaveBeenCalled();
    });
});

// §7 backlog Tier 4 (particleEffect): emitter + drawParticles path.
describe('GameEngine — §7 backlog particleEffect', () => {
    function particleManifest() {
        return {
            formatVersion: 1, name: 'Demo', entryLevelId: 'level_a',
            assets: [{
                id: 'spark_img', name: 'Spark', type: 'image', imgSrc: 'spark.png'
            }],
            levels: [{
                id: 'level_a',
                data: {
                    meta: { name: 'Level A' },
                    camera: { x: 0, y: 0, zoom: 1 },
                    layers: [{ id: 'main', name: 'Main', visible: true, locked: false, parallaxX: 1, parallaxY: 1 }],
                    objects: [
                        {
                            id: 'spawn', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                            layerId: 'main',
                            components: [{ type: 'playerStart', properties: {} }]
                        },
                        {
                            id: 'fx', type: 'particleEffect', x: 40, y: 40, width: 16, height: 16,
                            layerId: 'main',
                            components: [{
                                type: 'particleEffect',
                                properties: {
                                    imageAssetId: 'spark_img',
                                    burst: 8,
                                    emitting: false,
                                    lifetime: 2,
                                    seed: 11
                                }
                            }]
                        }
                    ]
                }
            }]
        };
    }

    it('loads particleEffect, resolves image, bursts particles, never solid', async () => {
        const { canvas } = mockCanvas();
        const engine = new GameEngine(canvas);
        await engine.loadProject(particleManifest());

        const fx = engine.scene.entities.find(e => e.id === 'fx');
        expect(fx).toBeTruthy();
        const pe = fx.behaviors.find(b => typeof b.drawParticles === 'function');
        expect(pe).toBeTruthy();
        expect(pe._resolvedSrc).toBe('spark.png');
        expect(pe.isOverlapping()).toBe(false);

        // behaviors update once per engine tick
        pe.update(0.016, engine.scene);
        expect(pe._particles.length).toBe(8);

        const ctx = { globalAlpha: 1, fillRect: vi.fn(), drawImage: vi.fn() };
        pe.drawParticles(ctx, new Map(), fx.x, fx.y);
        expect(ctx.fillRect.mock.calls.length + ctx.drawImage.mock.calls.length).toBeGreaterThan(0);
    });
});
