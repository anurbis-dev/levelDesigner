/**
 * Level-scope dialogue graphs (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза E).
 * Array on level.dialogues; Scene builds Map by dialogue.id at Play.
 */

/** @returns {object} */
export function createEmptyDialogue(id = 'dialogue_1') {
    return {
        id,
        formatVersion: 1,
        startNode: 'd1',
        nodes: [
            { id: 'd1', speaker: '', text: '', next: null }
        ]
    };
}

/** @param {object|null|undefined} d */
export function cloneDialogue(d) {
    return d == null ? null : JSON.parse(JSON.stringify(d));
}

/** @param {Array|null|undefined} list */
export function cloneDialogues(list) {
    return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []));
}

/**
 * @param {Array} list
 * @returns {string}
 */
export function nextDialogueId(list) {
    const used = new Set((list || []).map((d) => d.id));
    let i = 1;
    while (used.has(`dialogue_${i}`)) i += 1;
    return `dialogue_${i}`;
}

/**
 * @param {object} dialogue
 * @returns {string}
 */
export function nextNodeId(dialogue) {
    const used = new Set((dialogue?.nodes || []).map((n) => n.id));
    let i = 1;
    while (used.has(`d${i}`)) i += 1;
    return `d${i}`;
}

/**
 * @param {Array} list
 * @param {object} dialogue
 * @returns {Array}
 */
export function upsertDialogue(list, dialogue) {
    const next = cloneDialogues(list);
    const idx = next.findIndex((d) => d.id === dialogue.id);
    const copy = cloneDialogue(dialogue);
    if (idx >= 0) next[idx] = copy;
    else next.push(copy);
    return next;
}

/**
 * @param {Array} list
 * @param {string} id
 * @returns {Array}
 */
export function removeDialogue(list, id) {
    return cloneDialogues(list).filter((d) => d.id !== id);
}

/**
 * @param {object} dialogue
 * @param {object} node
 * @returns {object}
 */
export function upsertNode(dialogue, node) {
    const d = cloneDialogue(dialogue);
    d.nodes = d.nodes || [];
    const idx = d.nodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) d.nodes[idx] = { ...d.nodes[idx], ...cloneDialogue(node) };
    else d.nodes.push(cloneDialogue(node));
    return d;
}

/**
 * @param {object} dialogue
 * @param {string} nodeId
 * @returns {object}
 */
export function removeNode(dialogue, nodeId) {
    const d = cloneDialogue(dialogue);
    d.nodes = (d.nodes || []).filter((n) => n.id !== nodeId);
    if (d.startNode === nodeId) {
        d.startNode = d.nodes[0]?.id || null;
    }
    // Clear dangling next / choice.next
    for (const n of d.nodes) {
        if (n.next === nodeId) n.next = null;
        if (Array.isArray(n.choices)) {
            for (const c of n.choices) {
                if (c.next === nodeId) c.next = null;
            }
        }
    }
    return d;
}

/**
 * Normalize choice condition from form fields.
 * @param {{ var?: string, op?: string, value?: * }|null} cond
 * @returns {object|undefined}
 */
export function normalizeCondition(cond) {
    if (!cond || !cond.var) return undefined;
    return {
        var: String(cond.var),
        op: cond.op || '==',
        value: cond.value
    };
}
