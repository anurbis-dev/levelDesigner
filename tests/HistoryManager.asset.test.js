import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../src/managers/HistoryManager.js';

describe('HistoryManager asset stack (Phase C)', () => {
    /** @type {HistoryManager} */
    let hm;

    beforeEach(() => {
        hm = new HistoryManager(10);
    });

    it('seeds baseline and undoes to previous catalog snapshot', () => {
        const a0 = [{ id: 'a1', name: 'Hero', components: [] }];
        const a1 = [{ id: 'a1', name: 'Hero', components: [{ id: 'c1', type: 'collider' }] }];

        hm.ensureAssetBaseline(a0);
        expect(hm.canUndoAsset()).toBe(false);

        hm.saveAssetState(a1);
        expect(hm.canUndoAsset()).toBe(true);

        const restored = hm.undoAsset();
        expect(restored).toEqual(a0);
        expect(hm.canUndoAsset()).toBe(false);
        expect(hm.canRedoAsset()).toBe(true);

        const redone = hm.redoAsset();
        expect(redone).toEqual(a1);
    });

    it('dedupes identical consecutive snapshots', () => {
        const snap = [{ id: 'a1', name: 'X' }];
        hm.ensureAssetBaseline(snap);
        hm.saveAssetState(snap);
        hm.saveAssetState(snap);
        expect(hm.assetUndoStack.length).toBe(1);
    });

    it('clearAssetHistory resets stacks', () => {
        hm.ensureAssetBaseline([{ id: '1' }]);
        hm.saveAssetState([{ id: '1', name: 'b' }]);
        hm.clearAssetHistory();
        expect(hm.canUndoAsset()).toBe(false);
        expect(hm.canRedoAsset()).toBe(false);
    });
});
