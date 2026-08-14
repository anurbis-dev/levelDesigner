import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Scene } from '../../src/engine/Scene.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';
import { Input } from '../../src/engine/Input.js';

const levelPath = join(dirname(fileURLToPath(import.meta.url)), '../../content/maps/ledge.json');

describe('LEDGE level', () => {
    it('loads tilemap, playerStart, doors and platformer spawn', () => {
        registerDefaultBehaviors();
        const data = JSON.parse(readFileSync(levelPath, 'utf8'));
        const scene = new Scene(data);
        scene.input = new Input(null);
        expect(scene.getAllEntities().length).toBeGreaterThan(50);
        const tm = scene.getAllEntities().find((e) => e.behaviors.some((b) => typeof b.tileKindAtWorld === 'function'));
        expect(tm).toBeTruthy();
        expect(tm.behaviors[0].mapWidth).toBe(186);
        expect(tm.behaviors[0].kindOf(1)).toBe('solid');
        expect(tm.behaviors[0].kindOf(3)).toBe('ladderWall');
        const player = scene.spawnPlayer();
        expect(player).toBeTruthy();
        expect(player.width).toBe(10);
        expect(player.height).toBe(22);
        const move = player.behaviors.find((b) => b.mode === 'platformer' || b.properties?.mode === 'platformer');
        expect(move).toBeTruthy();
        for (let i = 0; i < 30; i++) {
            scene.input.beginFrame();
            move.update(1 / 60, scene);
            scene.input.endFrame();
        }
        expect(move._platformer.onGround).toBe(true);
        expect(player.y + player.height).toBeCloseTo(22 * 16, 0);
    });
});
