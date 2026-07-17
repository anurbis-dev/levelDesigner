import { describe, it, expect } from 'vitest';
import { CameraBehavior } from '../../src/engine/behaviors/CameraBehavior.js';

function makeScene(player, extraEntities = []) {
    return {
        player,
        getAllEntities: () => [player, ...extraEntities].filter(Boolean)
    };
}

describe('CameraBehavior.computeCamera', () => {
    it('hard-centers on scene.player when no deadzone/bounds configured', () => {
        const player = { id: '__player', x: 100, y: 200, width: 32, height: 32 };
        const scene = makeScene(player);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, { properties: {} });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(100 + 16 - 400);
        expect(camera.y).toBe(200 + 16 - 300);
    });

    it('follows an explicit followTargetId instead of the player', () => {
        const player = { id: '__player', x: 0, y: 0, width: 32, height: 32 };
        const npc = { id: 'npc1', x: 500, y: 300, width: 32, height: 32 };
        const scene = makeScene(player, [npc]);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, { properties: { followTargetId: 'npc1' } });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(500 + 16 - 400);
        expect(camera.y).toBe(300 + 16 - 300);
    });

    it('does not move the camera while the target stays inside the deadzone', () => {
        const player = { id: '__player', x: 410, y: 305, width: 32, height: 32 };
        const scene = makeScene(player);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, {
            properties: { deadzoneWidth: 100, deadzoneHeight: 100 }
        });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(0);
        expect(camera.y).toBe(0);
    });

    it('recenters once the target exits the deadzone', () => {
        const player = { id: '__player', x: 700, y: 0, width: 32, height: 32 };
        const scene = makeScene(player);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, {
            properties: { deadzoneWidth: 100, deadzoneHeight: 100 }
        });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(700 + 16 - 400);
    });

    it('clamps the camera to bounds so it never shows outside the level', () => {
        const player = { id: '__player', x: 10, y: 10, width: 32, height: 32 };
        const scene = makeScene(player);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, {
            properties: { bounds: { x: 0, y: 0, width: 1000, height: 700 } }
        });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(0);
        expect(camera.y).toBe(0);
    });

    it('clamps the far edge when the target nears the end of bounds', () => {
        const player = { id: '__player', x: 980, y: 680, width: 32, height: 32 };
        const scene = makeScene(player);
        const camera = { x: 0, y: 0, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, {
            properties: { bounds: { x: 0, y: 0, width: 1000, height: 700 } }
        });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera.x).toBe(1000 - 800);
        expect(camera.y).toBe(700 - 600);
    });

    it('is a no-op when neither followTargetId nor scene.player resolves', () => {
        const scene = makeScene(null);
        const camera = { x: 5, y: 5, zoom: 1 };
        const canvas = { width: 800, height: 600 };
        const behavior = new CameraBehavior({}, { properties: {} });

        behavior.computeCamera(scene, camera, canvas);

        expect(camera).toEqual({ x: 5, y: 5, zoom: 1 });
    });
});
