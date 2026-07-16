import { describe, it, expect } from 'vitest';
import { FileManager } from '../src/managers/FileManager.js';

describe('FileManager.createNewLevel', () => {
    // Regression: the default Player Start must carry a playerStart component, not just the
    // right `type` — Scene.findPlayerStartEntity() (src/engine/Scene.js) resolves entities by
    // component (`getSpawnPosition`), and GameEngine only spawns a controllable player from
    // that. Without it, Play-in-editor rendered only the static lightblue marker.
    it('attaches a playerStart component to the default Player Start object', () => {
        const level = new FileManager().createNewLevel();
        const playerStart = level.objects.find(o => o.type === 'player_start');

        expect(playerStart).toBeTruthy();
        expect(playerStart.components).toEqual([
            expect.objectContaining({ type: 'playerStart', enabled: true })
        ]);
    });
});
