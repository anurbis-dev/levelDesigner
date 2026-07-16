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
