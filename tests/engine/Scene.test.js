import { describe, it, expect, beforeAll } from 'vitest';
import { Scene } from '../../src/engine/Scene.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

beforeAll(() => {
    registerDefaultBehaviors();
});

describe('Scene.getAllEntities', () => {
    it('flattens top-level entities and nested group children', () => {
        const scene = new Scene({
            objects: [
                { id: 'a', type: 'actor' },
                { id: 'g', type: 'group', children: [
                    { id: 'b', type: 'actor' },
                    { id: 'g2', type: 'group', children: [{ id: 'c', type: 'actor' }] }
                ] }
            ]
        });

        const ids = scene.getAllEntities().map(e => e.id);
        expect(ids).toEqual(['a', 'g', 'b', 'g2', 'c']);
    });
});

describe('Scene.getPlayerStart', () => {
    it('finds a playerStart entity at any nesting depth', () => {
        const scene = new Scene({
            objects: [
                { id: 'a', type: 'actor' },
                { id: 'g', type: 'group', children: [
                    { id: 'start', type: 'player_start', x: 40, y: 60,
                        components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] }
                ] }
            ]
        });

        expect(scene.getPlayerStart()).toEqual({ x: 40, y: 60 });
    });

    it('returns null when no playerStart entity exists', () => {
        const scene = new Scene({ objects: [{ id: 'a', type: 'actor' }] });
        expect(scene.getPlayerStart()).toBeNull();
    });
});

describe('Scene.spawnPlayer', () => {
    function makeScene() {
        return new Scene({
            objects: [
                { id: 'start', type: 'player_start', x: 40, y: 60, width: 32, height: 32,
                    components: [{ id: 'c1', type: 'playerStart', enabled: true, properties: {} }] }
            ]
        });
    }

    it('spawns a player entity at the marker position and hides the marker', () => {
        const scene = makeScene();
        const player = scene.spawnPlayer();

        expect(player).toMatchObject({ id: '__player', x: 40, y: 60, width: 32, height: 32 });
        expect(scene.entities).toContain(player);
        expect(scene.player).toBe(player);

        const marker = scene.entities.find(e => e.id === 'start');
        expect(marker.visible).toBe(false);
    });

    it('gives the player a collider and a movement behavior', () => {
        const player = makeScene().spawnPlayer();
        expect(player.behaviors.some(b => typeof b.getBounds === 'function')).toBe(true);
        expect(player.behaviors.some(b => typeof b.update === 'function' && b.speed !== undefined)).toBe(true);
    });

    it('returns null and adds nothing when the level has no playerStart', () => {
        const scene = new Scene({ objects: [{ id: 'a', type: 'actor' }] });
        const before = scene.entities.length;
        expect(scene.spawnPlayer()).toBeNull();
        expect(scene.entities.length).toBe(before);
    });
});

describe('Scene camera marker', () => {
    function makeScene() {
        return new Scene({
            objects: [
                { id: 'cam1', type: 'camera', x: 10, y: 20, width: 32, height: 32,
                    components: [{ id: 'c1', type: 'camera', enabled: true, properties: {} }] }
            ]
        });
    }

    it('findCameraEntity() locates the entity carrying a camera component', () => {
        const scene = makeScene();
        expect(scene.findCameraEntity().id).toBe('cam1');
    });

    it('returns null when the level has no camera marker', () => {
        const scene = new Scene({ objects: [{ id: 'a', type: 'actor' }] });
        expect(scene.findCameraEntity()).toBeUndefined();
    });

    it('hideCameraMarker() hides the marker and caches it on scene.cameraEntity', () => {
        const scene = makeScene();
        const entity = scene.hideCameraMarker();

        expect(entity.id).toBe('cam1');
        expect(entity.visible).toBe(false);
        expect(scene.cameraEntity).toBe(entity);
    });

    it('destroyEntity() clears scene.cameraEntity when the marker is removed', () => {
        const scene = makeScene();
        scene.hideCameraMarker();
        scene.destroyEntity('cam1');

        expect(scene.cameraEntity).toBeNull();
    });
});
