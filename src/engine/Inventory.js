/**
 * Minimal item bag for dialogue give/take/require (LOGIC_SYSTEMS dialogue extensions).
 * itemId → count. Full inventory UI / Item Definition assets are separate backlog.
 */
export class Inventory {
    /**
     * @param {Array<{ id?: string, itemId?: string, count?: number }>|Record<string, number>|null} [seed]
     */
    constructor(seed = null) {
        /** @type {Map<string, number>} */
        this._counts = new Map();
        if (Array.isArray(seed)) {
            for (const row of seed) {
                const id = row.itemId || row.id;
                if (!id) continue;
                this.add(id, row.count ?? 1);
            }
        } else if (seed && typeof seed === 'object') {
            for (const [id, count] of Object.entries(seed)) {
                this.add(id, Number(count) || 0);
            }
        }
    }

    /**
     * @param {string} itemId
     * @param {number} [count=1]
     */
    has(itemId, count = 1) {
        if (!itemId) return false;
        return (this._counts.get(itemId) || 0) >= count;
    }

    /**
     * @param {string} itemId
     * @returns {number}
     */
    count(itemId) {
        return this._counts.get(itemId) || 0;
    }

    /**
     * @param {string} itemId
     * @param {number} [count=1]
     */
    add(itemId, count = 1) {
        if (!itemId || count <= 0) return;
        this._counts.set(itemId, (this._counts.get(itemId) || 0) + count);
    }

    /**
     * @param {string} itemId
     * @param {number} [count=1]
     * @returns {boolean} false if not enough
     */
    remove(itemId, count = 1) {
        if (!itemId || count <= 0) return true;
        const cur = this._counts.get(itemId) || 0;
        if (cur < count) return false;
        const next = cur - count;
        if (next <= 0) this._counts.delete(itemId);
        else this._counts.set(itemId, next);
        return true;
    }

    /** @returns {{ itemId: string, count: number }[]} */
    list() {
        return [...this._counts.entries()].map(([itemId, count]) => ({ itemId, count }));
    }

    /** @returns {{ itemId: string, count: number }[]} */
    toJSON() {
        return this.list();
    }
}
