/**
 * Level-scope item definitions + inventory seeds.
 * - level.items: [{ id, displayName, description? }]
 * - level.inventory: player bag seed [{ itemId, count }]
 * - level.npcInventories: { [objectId]: [{ itemId, count }] }
 */

/** @returns {{ id: string, displayName: string, description: string }} */
export function createEmptyItem(id = 'item_1') {
    return {
        id,
        displayName: id,
        description: ''
    };
}

/** @param {object|null|undefined} item */
export function cloneItem(item) {
    return item == null ? null : JSON.parse(JSON.stringify(item));
}

/** @param {Array|null|undefined} list */
export function cloneItems(list) {
    return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []));
}

/**
 * @param {object} item
 * @returns {object}
 */
export function normalizeItem(item) {
    const id = String(item?.id || '').trim();
    return {
        id,
        displayName: String(item?.displayName || id || 'Item').trim() || id,
        description: String(item?.description || '')
    };
}

/** @param {Array} list @returns {string} */
export function nextItemId(list) {
    const used = new Set((list || []).map((i) => i.id));
    let n = 1;
    while (used.has(`item_${n}`)) n += 1;
    return `item_${n}`;
}

/** @param {Array} list @param {object} item @returns {Array} */
export function upsertItem(list, item) {
    const next = cloneItems(list);
    const norm = normalizeItem(item);
    if (!norm.id) return next;
    const idx = next.findIndex((i) => i.id === norm.id);
    if (idx >= 0) next[idx] = norm;
    else next.push(norm);
    return next;
}

/** @param {Array} list @param {string} id @returns {Array} */
export function removeItem(list, id) {
    return cloneItems(list).filter((i) => i.id !== id);
}

/**
 * Normalize bag seed to [{ itemId, count }].
 * @param {Array|Record<string,number>|null|undefined} seed
 * @returns {{ itemId: string, count: number }[]}
 */
export function normalizeBagSeed(seed) {
    if (!seed) return [];
    if (Array.isArray(seed)) {
        return seed
            .map((row) => {
                const itemId = row.itemId || row.id;
                if (!itemId) return null;
                const count = Number(row.count);
                return { itemId: String(itemId), count: count > 0 ? count : 1 };
            })
            .filter(Boolean);
    }
    if (typeof seed === 'object') {
        return Object.entries(seed)
            .map(([itemId, count]) => ({
                itemId: String(itemId),
                count: Number(count) > 0 ? Number(count) : 1
            }))
            .filter((r) => r.itemId);
    }
    return [];
}

/**
 * @param {object|null|undefined} map
 * @returns {Record<string, { itemId: string, count: number }[]>}
 */
export function normalizeNpcInventories(map) {
    if (!map || typeof map !== 'object') return {};
    const out = {};
    for (const [objectId, seed] of Object.entries(map)) {
        if (!objectId) continue;
        const rows = normalizeBagSeed(seed);
        if (rows.length) out[objectId] = rows;
    }
    return out;
}

/**
 * Snapshot for history / commit.
 * @param {{ items?: Array, inventory?: *, npcInventories?: object }} level
 */
export function snapshotInventoryData(level) {
    return {
        items: cloneItems(level?.items),
        inventory: normalizeBagSeed(level?.inventory),
        npcInventories: normalizeNpcInventories(level?.npcInventories)
    };
}

/**
 * Options for itemId selects (definitions + orphan ids from seeds).
 * @param {Array} items
 * @param {string[]} [extraIds]
 */
export function listItemOptions(items, extraIds = []) {
    const seen = new Set();
    const opts = [];
    for (const it of items || []) {
        if (!it?.id || seen.has(it.id)) continue;
        seen.add(it.id);
        opts.push({
            id: it.id,
            label: it.displayName && it.displayName !== it.id
                ? `${it.displayName} (${it.id})`
                : it.id
        });
    }
    for (const id of extraIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        opts.push({ id, label: `${id} (missing def)` });
    }
    return opts;
}
