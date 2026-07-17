import { describe, it, expect } from 'vitest';
import {
    createEmptyItem,
    nextItemId,
    upsertItem,
    removeItem,
    normalizeBagSeed,
    normalizeNpcInventories,
    listItemOptions,
    snapshotInventoryData
} from '../src/ui/items/ItemModel.js';

describe('ItemModel', () => {
    it('creates empty item and next id', () => {
        const a = createEmptyItem('item_1');
        expect(a.id).toBe('item_1');
        expect(nextItemId([a])).toBe('item_2');
    });

    it('upserts and removes items', () => {
        let list = [];
        list = upsertItem(list, { id: 'key', displayName: 'Key' });
        list = upsertItem(list, { id: 'key', displayName: 'Red Key' });
        expect(list).toHaveLength(1);
        expect(list[0].displayName).toBe('Red Key');
        list = removeItem(list, 'key');
        expect(list).toEqual([]);
    });

    it('normalizes bag seeds from array and map', () => {
        expect(normalizeBagSeed([{ itemId: 'a', count: 2 }, { id: 'b' }])).toEqual([
            { itemId: 'a', count: 2 },
            { itemId: 'b', count: 1 }
        ]);
        expect(normalizeBagSeed({ gold: 5 })).toEqual([{ itemId: 'gold', count: 5 }]);
    });

    it('normalizes npc inventories and lists options', () => {
        const map = normalizeNpcInventories({
            o1: [{ itemId: 'gem', count: 1 }],
            o2: []
        });
        expect(map.o1).toEqual([{ itemId: 'gem', count: 1 }]);
        expect(map.o2).toBeUndefined();

        const opts = listItemOptions([{ id: 'gem', displayName: 'Gem' }], ['orphan']);
        expect(opts.map((o) => o.id)).toEqual(['gem', 'orphan']);
    });

    it('snapshots inventory data', () => {
        const snap = snapshotInventoryData({
            items: [{ id: 'a', displayName: 'A' }],
            inventory: [{ itemId: 'a', count: 1 }],
            npcInventories: { x: [{ itemId: 'a', count: 2 }] }
        });
        expect(snap.items[0].id).toBe('a');
        expect(snap.npcInventories.x[0].count).toBe(2);
    });
});
