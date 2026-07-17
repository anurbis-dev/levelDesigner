import { describe, it, expect } from 'vitest';
import { DialogueRunner } from '../../src/engine/DialogueRunner.js';
import { Inventory } from '../../src/engine/Inventory.js';

function fakeRuntime(vars = {}, inventorySeed = null) {
    const variables = new Map(Object.entries(vars));
    const inventory = inventorySeed instanceof Inventory
        ? inventorySeed
        : new Inventory(inventorySeed);
    return {
        getVariable: (name) => variables.get(name),
        setVariable: (name, v) => variables.set(name, v),
        scene: { inventory }
    };
}

function guardDialogue() {
    return {
        formatVersion: 1,
        startNode: 'd1',
        nodes: [
            { id: 'd1', speaker: 'Guard', text: 'Стой!', choices: [
                { text: 'Пропусти', next: 'd2', condition: { var: 'hasPass', op: '==', value: true } },
                { text: 'Уйти', next: null }
            ] },
            { id: 'd2', speaker: 'Guard', text: 'Проходи.', next: null }
        ]
    };
}

describe('DialogueRunner', () => {
    it('starts at startNode', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime());
        expect(runner.getCurrentNode().text).toBe('Стой!');
        expect(runner.isEnded()).toBe(false);
    });

    it('hides a choice whose condition evaluates false', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: false }));
        const visible = runner.getVisibleChoices();
        expect(visible).toHaveLength(1);
        expect(visible[0].text).toBe('Уйти');
    });

    it('shows a conditioned choice once the variable matches', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: true }));
        expect(runner.getVisibleChoices()).toHaveLength(2);
    });

    it('advance(choiceIndex) indexes into the visible list', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: false }));
        runner.advance(0);
        expect(runner.isEnded()).toBe(true);
    });

    it('advances through a conditioned choice to the next node', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: true }));
        runner.advance(0);
        expect(runner.getCurrentNode().text).toBe('Проходи.');
        runner.advance();
        expect(runner.isEnded()).toBe(true);
    });

    it('advance() is a no-op once ended', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: false }));
        runner.advance(0);
        const nodeBefore = runner.currentNodeId;
        runner.advance(0);
        expect(runner.currentNodeId).toBe(nodeBefore);
    });

    it('resolves multi-NPC speaker via participants + speakerId', () => {
        const data = {
            formatVersion: 2,
            startNode: 'd1',
            participants: [
                { id: 'player', role: 'player', displayName: 'Hero' },
                { id: 'guard', role: 'npc', displayName: 'Guard', objectId: 'o1' },
                { id: 'merchant', role: 'npc', displayName: 'Shopkeep' }
            ],
            nodes: [
                { id: 'd1', speakerId: 'merchant', text: 'Wares?', next: null }
            ]
        };
        const runner = new DialogueRunner(data, fakeRuntime());
        expect(runner.getCurrentSpeaker()).toEqual({
            id: 'merchant',
            displayName: 'Shopkeep',
            role: 'npc',
            objectId: undefined
        });
    });

    it('giveItem on node enter adds to player inventory', () => {
        const data = {
            formatVersion: 2,
            startNode: 'd1',
            nodes: [{
                id: 'd1',
                text: 'Take this.',
                effects: [{ type: 'giveItem', itemId: 'key_red', count: 1 }],
                next: null
            }]
        };
        const rt = fakeRuntime();
        const runner = new DialogueRunner(data, rt);
        expect(rt.scene.inventory.has('key_red')).toBe(true);
        runner.advance();
        expect(runner.isEnded()).toBe(true);
    });

    it('takeItem on choice removes from player (payment)', () => {
        const data = {
            formatVersion: 2,
            startNode: 'd1',
            nodes: [{
                id: 'd1',
                text: 'Pay 10 gold?',
                choices: [{
                    text: 'Pay',
                    next: null,
                    effects: [{ type: 'takeItem', itemId: 'gold', count: 10 }]
                }]
            }]
        };
        const rt = fakeRuntime({}, [{ itemId: 'gold', count: 15 }]);
        const runner = new DialogueRunner(data, rt);
        runner.advance(0);
        expect(rt.scene.inventory.count('gold')).toBe(5);
        expect(runner.isEnded()).toBe(true);
    });

    it('requireItem hides choice without inventory', () => {
        const data = {
            formatVersion: 2,
            startNode: 'd1',
            nodes: [{
                id: 'd1',
                text: 'Need key?',
                choices: [
                    { text: 'Use key', next: null, requireItem: { itemId: 'key', count: 1 } },
                    { text: 'Leave', next: null }
                ]
            }]
        };
        const empty = new DialogueRunner(data, fakeRuntime());
        expect(empty.getVisibleChoices().map((c) => c.text)).toEqual(['Leave']);

        const withKey = new DialogueRunner(data, fakeRuntime({}, [{ itemId: 'key', count: 1 }]));
        expect(withKey.getVisibleChoices()).toHaveLength(2);
    });

    it('itemPick requires selectedItemId and transfers item', () => {
        const data = {
            formatVersion: 2,
            startNode: 'd1',
            nodes: [{
                id: 'd1',
                text: 'Give me something',
                choices: [{
                    text: 'Offer item…',
                    next: null,
                    itemPick: { count: 1 }
                }]
            }]
        };
        const rt = fakeRuntime({}, [{ itemId: 'apple', count: 1 }, { itemId: 'coin', count: 3 }]);
        const runner = new DialogueRunner(data, rt);
        expect(runner.advance(0)).toEqual({ ok: false, needItemPick: true, reason: 'needItemPick' });
        expect(runner.isEnded()).toBe(false);
        expect(runner.advance(0, { selectedItemId: 'apple' }).ok).toBe(true);
        expect(rt.scene.inventory.has('apple')).toBe(false);
        expect(rt.scene.inventory.count('coin')).toBe(3);
        expect(runner.isEnded()).toBe(true);
    });
});
