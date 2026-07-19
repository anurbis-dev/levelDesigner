import { describe, it, expect, beforeAll } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { SpawnerBehavior } from '../../src/engine/behaviors/SpawnerBehavior.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

beforeAll(() => {
    registerDefaultBehaviors();
});

function makeSpawner(x, y, props = {}) {
    const entity = new Entity({ id: 'spawner1', type: 'object', x, y, width: 10, height: 10 });
    const behavior = new SpawnerBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    const scene = { entities: [entity] };
    return { entity, behavior, scene };
}

describe('SpawnerBehavior', () => {
    it('does nothing when interval <= 0', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 0 });
        behavior.update(10, scene);
        expect(scene.entities.length).toBe(1);
    });

    it('does not spawn before the interval elapses', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 3 });
        behavior.update(1, scene);
        behavior.update(1, scene);
        expect(scene.entities.length).toBe(1);
    });

    it('spawns and pushes a new entity into scene.entities once the interval elapses', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 3 });
        behavior.update(2, scene);
        behavior.update(1, scene);
        expect(scene.entities.length).toBe(2);
        expect(scene.entities[1].id).toBe('spawner1__spawn0');
    });

    it('positions the spawned entity at spawner position + offset, ignoring template x/y', () => {
        const { behavior, scene } = makeSpawner(100, 200, {
            interval: 1,
            spawnOffsetX: 5,
            spawnOffsetY: -5,
            template: { x: 9999, y: 9999, width: 16, height: 16 }
        });
        behavior.update(1, scene);
        const spawned = scene.entities[1];
        expect(spawned.x).toBe(105);
        expect(spawned.y).toBe(195);
        expect(spawned.width).toBe(16);
    });

    it('assigns unique ids to successive spawns', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 1 });
        behavior.update(1, scene);
        behavior.update(1, scene);
        behavior.update(1, scene);
        const ids = scene.entities.slice(1).map(e => e.id);
        expect(ids).toEqual(['spawner1__spawn0', 'spawner1__spawn1', 'spawner1__spawn2']);
    });

    it('maxAlive caps concurrent spawns until one is removed from the scene', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 1, maxAlive: 1 });
        behavior.update(1, scene);
        behavior.update(1, scene); // still capped at 1 alive
        expect(scene.entities.length).toBe(2);

        scene.entities.splice(1, 1); // simulate the spawned entity being destroyed
        behavior.update(1, scene);
        expect(scene.entities.length).toBe(2);
    });

    it('maxSpawns caps lifetime spawns even after alive ones are removed', () => {
        const { behavior, scene } = makeSpawner(0, 0, { interval: 1, maxSpawns: 1 });
        behavior.update(1, scene);
        scene.entities.splice(1, 1);
        behavior.update(1, scene);
        expect(scene.entities.length).toBe(1);
    });

    it('instantiates template components via EntityFactory (e.g. behaviors attach)', () => {
        const { behavior, scene } = makeSpawner(0, 0, {
            interval: 1,
            template: {
                type: 'actor',
                components: [{ id: 'c1', type: 'collider', enabled: true, properties: {} }]
            }
        });
        behavior.update(1, scene);
        const spawned = scene.entities[1];
        expect(spawned.behaviors.length).toBe(1);
        expect(typeof spawned.behaviors[0].getBounds).toBe('function');
    });
});
