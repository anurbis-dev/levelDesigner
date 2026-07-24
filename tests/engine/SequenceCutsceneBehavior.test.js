import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { SequenceCutsceneBehavior } from '../../src/engine/behaviors/SequenceCutsceneBehavior.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { EventGraphRuntime } from '../../src/engine/eventgraph/EventGraphRuntime.js';
import { registerDefaultEventGraphNodes } from '../../src/engine/eventgraph/registerDefaultEventGraphNodes.js';
import { EventGraphNodeRegistry } from '../../src/engine/eventgraph/EventGraphNodeRegistry.js';
import { AudioPlayer } from '../../src/engine/AudioPlayer.js';

function makeSeq(props = {}, entityOpts = {}) {
    const entity = new Entity({
        id: 'seq', type: 'sequenceCutscene', x: 0, y: 0, width: 32, height: 32, ...entityOpts
    });
    const behavior = new SequenceCutsceneBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

function makeScene(extra = {}) {
    const entities = extra.entities || [];
    const scene = {
        entities,
        player: extra.player || null,
        assetsById: extra.assetsById || new Map(),
        dialogues: extra.dialogues || new Map(),
        dialogueRunner: null,
        dialogueActive: false,
        cutsceneActive: false,
        eventGraphRuntime: null,
        getAllEntities() { return this.entities; }
    };
    if (extra.withRuntime) {
        scene.eventGraph = { formatVersion: 1, variables: [], nodes: [], edges: [] };
        scene.eventGraphRuntime = new EventGraphRuntime(scene.eventGraph, scene);
    }
    return scene;
}

describe('SequenceCutsceneBehavior', () => {
    beforeEach(() => {
        registerDefaultBehaviors();
        registerDefaultEventGraphNodes();
    });

    it('never solid', () => {
        const { behavior } = makeSeq();
        expect(behavior.isOverlapping()).toBe(false);
        expect(typeof behavior.getBounds).toBe('function');
    });

    it('play runs wait then finishes and releases lock', () => {
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'wait', duration: 0.5 }],
            lockPlayer: true
        });
        const scene = makeScene({ entities: [entity] });
        behavior.play(scene);
        expect(behavior.isPlaying()).toBe(true);
        expect(scene.cutsceneActive).toBe(true);
        behavior.update(0.4, scene);
        expect(behavior.isPlaying()).toBe(true);
        behavior.update(0.2, scene);
        expect(behavior.isPlaying()).toBe(false);
        expect(scene.cutsceneActive).toBe(false);
    });

    it('move lerps entity to target over duration', () => {
        const actor = new Entity({ id: 'npc', x: 0, y: 0, width: 10, height: 10 });
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'move', targetId: 'npc', x: 100, y: 50, duration: 1 }],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity, actor] });
        behavior.play(scene);
        behavior.update(0.5, scene);
        expect(actor.x).toBeCloseTo(50);
        expect(actor.y).toBeCloseTo(25);
        behavior.update(0.5, scene);
        expect(actor.x).toBeCloseTo(100);
        expect(actor.y).toBeCloseTo(50);
        expect(behavior.isPlaying()).toBe(false);
    });

    it('teleport and setVariable are instant', () => {
        const actor = new Entity({ id: 'npc', x: 0, y: 0, width: 10, height: 10 });
        const { entity, behavior } = makeSeq({
            steps: [
                { type: 'teleport', targetId: 'npc', x: 40, y: 60 },
                { type: 'setVariable', name: 'done', value: true }
            ],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity, actor], withRuntime: true });
        behavior.play(scene);
        behavior.update(0, scene);
        expect(actor.x).toBe(40);
        expect(actor.y).toBe(60);
        expect(scene.eventGraphRuntime.getVariable('done')).toBe(true);
        expect(behavior.isPlaying()).toBe(false);
    });

    it('camera override is applied while playing', () => {
        const { entity, behavior } = makeSeq({
            steps: [
                { type: 'camera', x: 200, y: 100, duration: 1 },
                { type: 'wait', duration: 0.1 }
            ],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity] });
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 100, height: 50 };
        behavior.play(scene);
        behavior.update(0.1, scene);
        expect(behavior.applyCutsceneCamera(scene, camera, canvas)).toBe(true);
        expect(camera.x).toBeCloseTo(200 - 50);
        expect(camera.y).toBeCloseTo(100 - 25);
    });

    it('cameraRelease clears override', () => {
        const { entity, behavior } = makeSeq({
            steps: [
                { type: 'camera', x: 10, y: 10, duration: 0 },
                { type: 'cameraRelease' },
                { type: 'wait', duration: 1 }
            ],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity] });
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 100, height: 100 };
        behavior.play(scene);
        behavior.update(0, scene);
        expect(behavior.applyCutsceneCamera(scene, camera, canvas)).toBe(false);
    });

    it('autoPlay starts once on first update', () => {
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'wait', duration: 1 }],
            autoPlay: true,
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity] });
        behavior.update(0, scene);
        expect(behavior.isPlaying()).toBe(true);
        behavior.stop(scene);
        behavior.update(0, scene);
        expect(behavior.isPlaying()).toBe(false);
    });

    it('playOnEnter edge-detects player enter', () => {
        const player = new Entity({ id: 'player', x: 100, y: 100, width: 16, height: 16 });
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'wait', duration: 1 }],
            playOnEnter: true,
            lockPlayer: false,
            width: 40,
            height: 40
        });
        entity.width = 40;
        entity.height = 40;
        const scene = makeScene({ entities: [entity], player });
        behavior.update(0, scene);
        expect(behavior.isPlaying()).toBe(false);
        player.x = 5;
        player.y = 5;
        behavior.update(0, scene);
        expect(behavior.isPlaying()).toBe(true);
    });

    it('loop restarts timeline', () => {
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'setVariable', name: 'n', value: 1 }, { type: 'wait', duration: 0.1 }],
            loop: true,
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity], withRuntime: true });
        let count = 0;
        const orig = scene.eventGraphRuntime.setVariable.bind(scene.eventGraphRuntime);
        scene.eventGraphRuntime.setVariable = (name, value) => {
            if (name === 'n') count += 1;
            return orig(name, value);
        };
        behavior.play(scene);
        behavior.update(0, scene);
        behavior.update(0.15, scene);
        behavior.update(0, scene);
        expect(count).toBeGreaterThanOrEqual(2);
        behavior.stop(scene);
    });

    it('merges sequenceAssetId steps when component empty', () => {
        const { entity, behavior } = makeSeq({
            sequenceAssetId: 'seq_a',
            steps: []
        });
        const assetsById = new Map([['seq_a', {
            id: 'seq_a',
            type: 'sequenceCutscene',
            properties: {
                steps: [{ type: 'wait', duration: 0.2 }]
            }
        }]]);
        const scene = makeScene({ entities: [entity], assetsById });
        behavior.update(0, scene);
        expect(behavior.steps).toEqual([{ type: 'wait', duration: 0.2 }]);
    });

    it('dialogue step holds until dialogue ends', () => {
        const { entity, behavior } = makeSeq({
            steps: [
                { type: 'dialogue', dialogueId: 'd1' },
                { type: 'setVariable', name: 'after', value: true }
            ],
            lockPlayer: false
        });
        const dialogues = new Map([['d1', {
            id: 'd1', formatVersion: 1, startNode: 'n1',
            nodes: [{ id: 'n1', speaker: 'A', text: 'hi' }]
        }]]);
        const scene = makeScene({ entities: [entity], dialogues, withRuntime: true });
        behavior.play(scene);
        behavior.update(0, scene);
        expect(scene.dialogueActive).toBe(true);
        expect(behavior.isPlaying()).toBe(true);
        expect(scene.eventGraphRuntime.getVariable('after')).toBeUndefined();
        // End dialogue
        scene.dialogueRunner.advance();
        expect(scene.dialogueRunner.isEnded()).toBe(true);
        // EventGraphRuntime normally clears dialogueActive; mimic that
        scene.dialogueActive = false;
        scene.dialogueRunner = null;
        behavior.update(0, scene);
        expect(scene.eventGraphRuntime.getVariable('after')).toBe(true);
        expect(behavior.isPlaying()).toBe(false);
    });

    it('stop aborts mid-sequence', () => {
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'wait', duration: 10 }],
            lockPlayer: true
        });
        const scene = makeScene({ entities: [entity] });
        behavior.play(scene);
        expect(scene.cutsceneActive).toBe(true);
        behavior.stop(scene);
        expect(behavior.isPlaying()).toBe(false);
        expect(scene.cutsceneActive).toBe(false);
    });

    it('registry resolves sequenceCutscene type', () => {
        const entity = new Entity({ id: 's', x: 0, y: 0, width: 10, height: 10 });
        const Cls = BehaviorRegistry.get('sequenceCutscene');
        expect(Cls).toBe(SequenceCutsceneBehavior);
        const b = new Cls(entity, { type: 'sequenceCutscene', properties: { steps: [] } });
        expect(b).toBeInstanceOf(SequenceCutsceneBehavior);
    });

    it('PlaySequence / StopSequence event graph actions', () => {
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'wait', duration: 5 }],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity], withRuntime: true });
        const playNode = { type: 'PlaySequence', params: { objectId: 'seq' } };
        const stopNode = { type: 'StopSequence', params: { objectId: 'seq' } };
        EventGraphNodeRegistry.get('PlaySequence')(playNode, {
            scene, runtime: scene.eventGraphRuntime
        });
        expect(behavior.isPlaying()).toBe(true);
        EventGraphNodeRegistry.get('StopSequence')(stopNode, {
            scene, runtime: scene.eventGraphRuntime
        });
        expect(behavior.isPlaying()).toBe(false);
    });
});

describe('SequenceCutsceneBehavior playSound', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('playSound step calls AudioPlayer.play', () => {
        const spy = vi.spyOn(AudioPlayer, 'play').mockReturnValue(null);
        const { entity, behavior } = makeSeq({
            steps: [{ type: 'playSound', src: 'hit.wav', volume: 0.5 }],
            lockPlayer: false
        });
        const scene = makeScene({ entities: [entity] });
        behavior.play(scene);
        behavior.update(0, scene);
        expect(spy).toHaveBeenCalledWith('hit.wav', { volume: 0.5, loop: undefined });
    });
});
