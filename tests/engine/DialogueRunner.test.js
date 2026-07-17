import { describe, it, expect } from 'vitest';
import { DialogueRunner } from '../../src/engine/DialogueRunner.js';

function fakeRuntime(vars = {}) {
    const variables = new Map(Object.entries(vars));
    return { getVariable: (name) => variables.get(name), setVariable: (name, v) => variables.set(name, v) };
}

// tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза E schema example, verbatim.
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
        const visible = runner.getVisibleChoices();
        expect(visible).toHaveLength(2);
    });

    it('advance(choiceIndex) indexes into the visible (filtered) list, not raw node.choices', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: false }));
        // only 'Уйти' is visible at index 0 — advancing it ends the dialogue (next: null)
        runner.advance(0);
        expect(runner.isEnded()).toBe(true);
    });

    it('advances through a conditioned choice to the next node', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: true }));
        runner.advance(0); // 'Пропусти' -> d2
        expect(runner.isEnded()).toBe(false);
        expect(runner.getCurrentNode().text).toBe('Проходи.');
        runner.advance(); // linear node, no choices -> next: null
        expect(runner.isEnded()).toBe(true);
    });

    it('advance() is a no-op once ended', () => {
        const runner = new DialogueRunner(guardDialogue(), fakeRuntime({ hasPass: false }));
        runner.advance(0);
        expect(runner.isEnded()).toBe(true);
        const nodeBefore = runner.currentNodeId;
        runner.advance(0);
        expect(runner.currentNodeId).toBe(nodeBefore);
    });
});
