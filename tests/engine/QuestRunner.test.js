import { describe, it, expect, vi } from 'vitest';
import { Scene } from '../../src/engine/Scene.js';

function makeScene(quests, { withRuntime = true } = {}) {
    const scene = new Scene({ quests });
    if (withRuntime) {
        scene.eventGraphRuntime = {
            variables: new Map(),
            getVariable(name) { return this.variables.get(name); },
            setVariable(name, value) { this.variables.set(name, value); }
        };
    }
    return scene;
}

describe('QuestRunner.startQuest', () => {
    it('warns and no-ops for an unknown questId', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const scene = makeScene([]);

        scene.questRunner.startQuest('missing');

        expect(scene.questRunner.getStatus('missing')).toBe('inactive');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing'));
        warnSpy.mockRestore();
    });

    it('is idempotent — starting an already-active quest does not reset progress', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);
        scene.questRunner.tick();
        expect(scene.questRunner.getStatus('q1')).toBe('completed');

        scene.questRunner.startQuest('q1');
        expect(scene.questRunner.getStatus('q1')).toBe('completed');
    });

    it('sets status to active with no objectives complete', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }]);
        scene.questRunner.startQuest('q1');

        expect(scene.questRunner.getStatus('q1')).toBe('active');
        expect(scene.questRunner.isObjectiveComplete('q1', 'o1')).toBe(false);
    });
});

describe('QuestRunner.tick — objective completion', () => {
    it('marks an objective complete once its condition becomes true', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }]);
        scene.questRunner.startQuest('q1');
        scene.questRunner.tick();
        expect(scene.questRunner.isObjectiveComplete('q1', 'o1')).toBe(false);

        scene.eventGraphRuntime.setVariable('flag', true);
        scene.questRunner.tick();
        expect(scene.questRunner.isObjectiveComplete('q1', 'o1')).toBe(true);
    });

    it('completes the quest only once every objective is done', () => {
        const scene = makeScene([{
            id: 'q1',
            objectives: [
                { id: 'o1', condition: { var: 'a', op: '==', value: true } },
                { id: 'o2', condition: { var: 'b', op: '==', value: true } }
            ]
        }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('a', true);
        scene.questRunner.tick();
        expect(scene.questRunner.getStatus('q1')).toBe('active');

        scene.eventGraphRuntime.setVariable('b', true);
        scene.questRunner.tick();
        expect(scene.questRunner.getStatus('q1')).toBe('completed');
    });

    it('stops polling a completed quest (objective state does not change after completion)', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);
        scene.questRunner.tick();
        expect(scene.questRunner.getStatus('q1')).toBe('completed');

        scene.eventGraphRuntime.setVariable('flag', false);
        scene.questRunner.tick();
        expect(scene.questRunner.getStatus('q1')).toBe('completed');
        expect(scene.questRunner.isObjectiveComplete('q1', 'o1')).toBe(true);
    });

    it('is a no-op without an eventGraphRuntime (no variables to evaluate against)', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }], { withRuntime: false });
        scene.questRunner.startQuest('q1');

        expect(() => scene.questRunner.tick()).not.toThrow();
        expect(scene.questRunner.getStatus('q1')).toBe('active');
    });
});

describe('QuestRunner — reward on completion', () => {
    it('gives an item to the player bag by default', () => {
        const scene = makeScene([{
            id: 'q1',
            objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }],
            reward: [{ type: 'giveItem', itemId: 'gold', count: 10 }]
        }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);
        scene.questRunner.tick();

        expect(scene.inventory.count('gold')).toBe(10);
    });

    it('defaults reward count to 1 when omitted', () => {
        const scene = makeScene([{
            id: 'q1',
            objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }],
            reward: [{ type: 'giveItem', itemId: 'gem' }]
        }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);
        scene.questRunner.tick();

        expect(scene.inventory.count('gem')).toBe(1);
    });

    it('takeItem reward warns instead of throwing when the bag lacks enough of the item', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const scene = makeScene([{
            id: 'q1',
            objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }],
            reward: [{ type: 'takeItem', itemId: 'key', count: 1 }]
        }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);

        expect(() => scene.questRunner.tick()).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('q1'));
        warnSpy.mockRestore();
    });

    it('does nothing when the quest has no reward', () => {
        const scene = makeScene([{ id: 'q1', objectives: [{ id: 'o1', condition: { var: 'flag', op: '==', value: true } }] }]);
        scene.questRunner.startQuest('q1');
        scene.eventGraphRuntime.setVariable('flag', true);

        expect(() => scene.questRunner.tick()).not.toThrow();
        expect(scene.questRunner.getStatus('q1')).toBe('completed');
    });
});
