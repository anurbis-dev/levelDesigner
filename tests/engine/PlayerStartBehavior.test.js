import { describe, it, expect } from 'vitest';
import { PlayerStartBehavior } from '../../src/engine/behaviors/PlayerStartBehavior.js';

describe('PlayerStartBehavior', () => {
    it('getSpawnPosition() returns the entity own position', () => {
        const entity = { x: 100, y: 200, width: 32, height: 32 };
        const playerStart = new PlayerStartBehavior(entity, { properties: {} });
        expect(playerStart.getSpawnPosition()).toEqual({ x: 100, y: 200 });
    });
});
