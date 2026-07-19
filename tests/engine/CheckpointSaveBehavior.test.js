import { describe, it, expect, beforeAll } from 'vitest';
import { Scene } from '../../src/engine/Scene.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { CheckpointSaveBehavior } from '../../src/engine/behaviors/CheckpointSaveBehavior.js';

beforeAll(() => {
    registerDefaultBehaviors();
});

function makeScene(checkpointX, checkpointY) {
    return new Scene({
        objects: [
            { id: 'start', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
            { id: 'cp1', type: 'checkpoint', x: checkpointX, y: checkpointY, width: 16, height: 16,
                components: [{ id: 'c2', type: 'checkpointSavePoint', enabled: true, properties: {} }] }
        ]
    });
}

function findBehavior(scene, entityId) {
    return scene.entities.find(e => e.id === entityId).behaviors.find(b => b instanceof CheckpointSaveBehavior);
}

describe('CheckpointSaveBehavior', () => {
    it('activates on player overlap and records scene.checkpointPosition', () => {
        const scene = makeScene(100, 100);
        scene.spawnPlayer();
        scene.player.x = 100;
        scene.player.y = 100;

        const behavior = findBehavior(scene, 'cp1');
        behavior.update(1, scene);

        expect(behavior.isActive).toBe(true);
        expect(scene.checkpointPosition).toEqual({ x: 100, y: 100 });
        expect(scene.activeCheckpoint).toBe(behavior);
    });

    it('does not activate when the player is out of range', () => {
        const scene = makeScene(500, 500);
        scene.spawnPlayer();

        const behavior = findBehavior(scene, 'cp1');
        behavior.update(1, scene);

        expect(behavior.isActive).toBe(false);
        expect(scene.checkpointPosition).toBeNull();
    });

    it('deactivates the previously active checkpoint when a new one activates', () => {
        const scene = new Scene({
            objects: [
                { id: 'start', type: 'player_start', x: 0, y: 0, width: 16, height: 16,
                    components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] },
                { id: 'cp1', type: 'checkpoint', x: 0, y: 0, width: 16, height: 16,
                    components: [{ id: 'c2', type: 'checkpointSavePoint', enabled: true, properties: {} }] },
                { id: 'cp2', type: 'checkpoint', x: 200, y: 200, width: 16, height: 16,
                    components: [{ id: 'c3', type: 'checkpointSavePoint', enabled: true, properties: {} }] }
            ]
        });
        scene.spawnPlayer();

        const cp1 = findBehavior(scene, 'cp1');
        const cp2 = findBehavior(scene, 'cp2');

        cp1.activate(scene);
        expect(cp1.isActive).toBe(true);

        cp2.activate(scene);
        expect(cp1.isActive).toBe(false);
        expect(cp2.isActive).toBe(true);
        expect(scene.activeCheckpoint).toBe(cp2);
        expect(scene.checkpointPosition).toEqual({ x: 200, y: 200 });
    });

    it('an already-active checkpoint skips re-checking overlap', () => {
        const scene = makeScene(0, 0);
        scene.spawnPlayer();
        const behavior = findBehavior(scene, 'cp1');
        behavior.activate(scene);
        const before = scene.checkpointPosition;

        behavior.update(1, scene);
        expect(scene.checkpointPosition).toBe(before);
    });
});
