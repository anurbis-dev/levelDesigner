import { describe, it, expect } from 'vitest';
import { Inventory } from '../../src/engine/Inventory.js';

describe('Inventory', () => {
    it('seeds from array and object', () => {
        const a = new Inventory([{ itemId: 'gold', count: 5 }, { id: 'key', count: 1 }]);
        expect(a.has('gold', 5)).toBe(true);
        expect(a.count('key')).toBe(1);
        const b = new Inventory({ potion: 2 });
        expect(b.list()).toEqual([{ itemId: 'potion', count: 2 }]);
    });

    it('add/remove/has', () => {
        const inv = new Inventory();
        inv.add('coin', 3);
        expect(inv.has('coin', 3)).toBe(true);
        expect(inv.remove('coin', 2)).toBe(true);
        expect(inv.count('coin')).toBe(1);
        expect(inv.remove('coin', 5)).toBe(false);
        expect(inv.count('coin')).toBe(1);
        inv.remove('coin', 1);
        expect(inv.list()).toEqual([]);
    });
});
