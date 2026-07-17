import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../src/managers/HistoryManager.js';

describe('HistoryManager eventGraph snapshots', () => {
    /** @type {HistoryManager} */
    let hm;
    let graph;

    beforeEach(() => {
        hm = new HistoryManager(10);
        graph = null;
        hm.setEventGraphProvider(() => graph);
    });

    it('includes eventGraph in undo restore', () => {
        graph = null;
        hm.saveState([], new Set(), true, null);
        graph = {
            formatVersion: 1,
            scope: 'level',
            variables: [{ name: 'doorOpen', type: 'bool', default: false }],
            nodes: [{ id: 'n1', type: 'OnStart', params: {}, position: { x: 0, y: 0 } }],
            edges: []
        };
        hm.saveState([], new Set(), false, null);

        const prev = hm.undo();
        expect(prev.eventGraph).toBeNull();

        const next = hm.redo();
        expect(next.eventGraph.nodes).toHaveLength(1);
        expect(next.eventGraph.variables[0].name).toBe('doorOpen');
    });

    it('legacy snapshots without provider leave eventGraph undefined', () => {
        const bare = new HistoryManager(10);
        bare.saveState([{ id: 1 }], new Set(), true, null);
        bare.saveState([{ id: 2 }], new Set(), false, null);
        const prev = bare.undo();
        expect(prev.eventGraph).toBeUndefined();
        expect(prev.objects).toEqual([{ id: 1 }]);
    });

    it('includes dialogues in undo restore', () => {
        let dialogues = [];
        hm.setDialoguesProvider(() => dialogues);
        graph = null;
        hm.saveState([], new Set(), true, null);
        dialogues = [{ id: 'guard', formatVersion: 1, startNode: 'd1', nodes: [{ id: 'd1', text: 'hi' }] }];
        hm.saveState([], new Set(), false, null);
        const prev = hm.undo();
        expect(prev.dialogues).toEqual([]);
        const next = hm.redo();
        expect(next.dialogues[0].id).toBe('guard');
    });
});

