import { describe, it, expect } from 'vitest';
import {
    createEmptyDialogue,
    nextDialogueId,
    nextNodeId,
    upsertDialogue,
    removeDialogue,
    upsertNode,
    removeNode,
    normalizeCondition
} from '../src/ui/dialogues/DialogueModel.js';

describe('DialogueModel', () => {
    it('creates dialogue with start node', () => {
        const d = createEmptyDialogue('guard');
        expect(d.id).toBe('guard');
        expect(d.startNode).toBe('d1');
        expect(d.nodes).toHaveLength(1);
    });

    it('upserts and removes dialogues by id', () => {
        let list = [];
        list = upsertDialogue(list, createEmptyDialogue('a'));
        list = upsertDialogue(list, createEmptyDialogue('b'));
        expect(list.map((d) => d.id)).toEqual(['a', 'b']);
        list = upsertDialogue(list, { ...createEmptyDialogue('a'), startNode: 'd1', nodes: [
            { id: 'd1', speaker: 'X', text: 'hi', next: null }
        ] });
        expect(list).toHaveLength(2);
        expect(list[0].nodes[0].speaker).toBe('X');
        list = removeDialogue(list, 'a');
        expect(list.map((d) => d.id)).toEqual(['b']);
    });

    it('manages nodes and clears dangling links', () => {
        let d = createEmptyDialogue('g');
        d = upsertNode(d, { id: 'd2', speaker: 'B', text: 'bye', next: null });
        d = upsertNode(d, { id: 'd1', speaker: 'A', text: 'hi', next: 'd2' });
        expect(d.nodes).toHaveLength(2);
        d = removeNode(d, 'd2');
        expect(d.nodes.map((n) => n.id)).toEqual(['d1']);
        expect(d.nodes[0].next).toBeNull();
    });

    it('allocates unique ids', () => {
        expect(nextDialogueId([{ id: 'dialogue_1' }])).toBe('dialogue_2');
        expect(nextNodeId({ nodes: [{ id: 'd1' }, { id: 'd2' }] })).toBe('d3');
    });

    it('normalizeCondition drops empty var', () => {
        expect(normalizeCondition(null)).toBeUndefined();
        expect(normalizeCondition({ var: '', op: '==', value: true })).toBeUndefined();
        expect(normalizeCondition({ var: 'hasPass', op: '==', value: true })).toEqual({
            var: 'hasPass', op: '==', value: true
        });
    });
});
