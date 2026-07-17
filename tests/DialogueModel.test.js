import { describe, it, expect } from 'vitest';
import {
    createEmptyDialogue,
    nextDialogueId,
    nextNodeId,
    nextParticipantId,
    upsertDialogue,
    removeDialogue,
    upsertNode,
    removeNode,
    upsertParticipant,
    removeParticipant,
    normalizeCondition,
    normalizeEffect,
    normalizeDialogue
} from '../src/ui/dialogues/DialogueModel.js';

describe('DialogueModel', () => {
    it('creates dialogue with start node and participants', () => {
        const d = createEmptyDialogue('guard');
        expect(d.id).toBe('guard');
        expect(d.formatVersion).toBe(2);
        expect(d.startNode).toBe('d1');
        expect(d.nodes).toHaveLength(1);
        expect(d.participants.some((p) => p.role === 'player')).toBe(true);
        expect(d.participants.some((p) => p.role === 'npc')).toBe(true);
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

    it('normalizeEffect and participants helpers', () => {
        expect(normalizeEffect({ type: 'giveItem', itemId: 'k', count: 2 })).toEqual({
            type: 'giveItem', itemId: 'k', count: 2
        });
        expect(normalizeEffect({ type: 'x', itemId: '' })).toBeNull();
        let d = createEmptyDialogue('g');
        const pid = nextParticipantId(d);
        d = upsertParticipant(d, { id: pid, role: 'npc', displayName: 'Extra' });
        expect(d.participants).toHaveLength(3);
        d = removeParticipant(d, pid);
        expect(d.participants).toHaveLength(2);
        d = removeParticipant(d, 'player');
        expect(d.participants.some((p) => p.role === 'player')).toBe(true);
        const legacy = normalizeDialogue({ id: 'old', startNode: 'd1', nodes: [{ id: 'd1', speaker: 'A', text: 'hi' }] });
        expect(legacy.participants.length).toBeGreaterThan(0);
    });
});
