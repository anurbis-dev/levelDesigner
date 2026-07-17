/**
 * Level-scope dialogue graphs (Фаза E + item/multi-NPC extensions).
 * Array on level.dialogues; Scene builds Map by dialogue.id at Play.
 *
 * Schema highlights:
 * - participants[] — multi-NPC + player roles
 * - node.speakerId — which participant speaks
 * - node/choice.effects — giveItem / takeItem (player bag)
 * - choice.requireItem — hide reply without item
 * - choice.itemPick — player selects item to give
 * - choice[] — player response options
 */

/** Default participants for new dialogues (player + one NPC). */
export function defaultParticipants() {
    return [
        { id: 'player', role: 'player', displayName: 'Player' },
        { id: 'npc1', role: 'npc', displayName: 'NPC', objectId: '' }
    ];
}

/** @returns {object} */
export function createEmptyDialogue(id = 'dialogue_1') {
    return {
        id,
        formatVersion: 2,
        startNode: 'd1',
        participants: defaultParticipants(),
        nodes: [
            { id: 'd1', speakerId: 'npc1', speaker: 'NPC', text: '', next: null }
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
 * Ensure participants + formatVersion on load of older graphs.
 * @param {object} dialogue
 * @returns {object}
 */
export function normalizeDialogue(dialogue) {
    const d = cloneDialogue(dialogue) || createEmptyDialogue('dialogue_1');
    if (!d.formatVersion) d.formatVersion = 1;
    if (!Array.isArray(d.participants) || d.participants.length === 0) {
        d.participants = defaultParticipants();
        // migrate free-text speakers into first npc displayName if empty
        const npc = d.participants.find((p) => p.role === 'npc');
        const firstSpeaker = d.nodes?.[0]?.speaker;
        if (npc && firstSpeaker) npc.displayName = firstSpeaker;
    }
    return d;
}

/** @param {Array} list @returns {string} */
export function nextDialogueId(list) {
    const used = new Set((list || []).map((d) => d.id));
    let i = 1;
    while (used.has(`dialogue_${i}`)) i += 1;
    return `dialogue_${i}`;
}

/** @param {object} dialogue @returns {string} */
export function nextNodeId(dialogue) {
    const used = new Set((dialogue?.nodes || []).map((n) => n.id));
    let i = 1;
    while (used.has(`d${i}`)) i += 1;
    return `d${i}`;
}

/** @param {object} dialogue @returns {string} */
export function nextParticipantId(dialogue) {
    const used = new Set((dialogue?.participants || []).map((p) => p.id));
    let i = 1;
    while (used.has(`npc${i}`)) i += 1;
    return `npc${i}`;
}

/** @param {Array} list @param {object} dialogue @returns {Array} */
export function upsertDialogue(list, dialogue) {
    const next = cloneDialogues(list);
    const idx = next.findIndex((d) => d.id === dialogue.id);
    const copy = normalizeDialogue(dialogue);
    if (idx >= 0) next[idx] = copy;
    else next.push(copy);
    return next;
}

/** @param {Array} list @param {string} id @returns {Array} */
export function removeDialogue(list, id) {
    return cloneDialogues(list).filter((d) => d.id !== id);
}

/** @param {object} dialogue @param {object} node @returns {object} */
export function upsertNode(dialogue, node) {
    const d = normalizeDialogue(dialogue);
    d.nodes = d.nodes || [];
    const idx = d.nodes.findIndex((n) => n.id === node.id);
    if (idx >= 0) d.nodes[idx] = { ...d.nodes[idx], ...cloneDialogue(node) };
    else d.nodes.push(cloneDialogue(node));
    return d;
}

/** @param {object} dialogue @param {string} nodeId @returns {object} */
export function removeNode(dialogue, nodeId) {
    const d = normalizeDialogue(dialogue);
    d.nodes = (d.nodes || []).filter((n) => n.id !== nodeId);
    if (d.startNode === nodeId) {
        d.startNode = d.nodes[0]?.id || null;
    }
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
 * @param {object} dialogue
 * @param {object} participant
 * @returns {object}
 */
export function upsertParticipant(dialogue, participant) {
    const d = normalizeDialogue(dialogue);
    d.participants = d.participants || [];
    const idx = d.participants.findIndex((p) => p.id === participant.id);
    if (idx >= 0) d.participants[idx] = { ...d.participants[idx], ...participant };
    else d.participants.push({ ...participant });
    return d;
}

/**
 * @param {object} dialogue
 * @param {string} participantId
 * @returns {object}
 */
export function removeParticipant(dialogue, participantId) {
    const d = normalizeDialogue(dialogue);
    const p = d.participants?.find((x) => x.id === participantId);
    if (p?.role === 'player') return d; // never remove player
    d.participants = (d.participants || []).filter((x) => x.id !== participantId);
    for (const n of d.nodes || []) {
        if (n.speakerId === participantId) {
            n.speakerId = d.participants.find((x) => x.role === 'npc')?.id || '';
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

/**
 * @param {object|null} fx
 * @returns {object|null}
 */
export function normalizeEffect(fx) {
    if (!fx || !fx.type || !fx.itemId) return null;
    const out = {
        type: fx.type === 'takeItem' ? 'takeItem' : 'giveItem',
        itemId: String(fx.itemId),
        count: Number(fx.count) > 0 ? Number(fx.count) : 1
    };
    if (fx.to) out.to = fx.to;
    if (fx.from) out.from = fx.from;
    return out;
}

/** Effect type labels for UI. */
export const EFFECT_TYPES = [
    { id: 'giveItem', label: 'Give item → player (NPC даёт)' },
    { id: 'takeItem', label: 'Take item ← player (NPC забирает)' }
];
