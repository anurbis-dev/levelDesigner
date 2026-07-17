/**
 * Editor-side metadata for Event Graph nodes (labels, categories, default params, field forms).
 * Runtime handlers live in src/engine/eventgraph/registerDefaultEventGraphNodes.js —
 * this catalog only drives palette / details UI.
 */

/** @typedef {{ key: string, label: string, type: 'string'|'number'|'boolean'|'json', optional?: boolean }} NodeField */
/** @typedef {{ type: string, label: string, category: 'entry'|'condition'|'action', defaults: object, fields: NodeField[] }} NodeDef */

/** @type {NodeDef[]} */
export const EVENT_GRAPH_NODE_DEFS = [
    // Entry
    { type: 'OnStart', label: 'On Start', category: 'entry', defaults: {}, fields: [] },
    {
        type: 'OnTick',
        label: 'On Tick',
        category: 'entry',
        defaults: { everyNTicks: 1 },
        fields: [{ key: 'everyNTicks', label: 'Every N ticks', type: 'number' }]
    },
    {
        type: 'OnCollisionEnter',
        label: 'On Collision Enter',
        category: 'entry',
        defaults: { objectId: '', layer: '' },
        fields: [
            { key: 'objectId', label: 'Trigger object id', type: 'string' },
            { key: 'layer', label: 'Other layer (optional)', type: 'string', optional: true }
        ]
    },
    {
        type: 'OnCollisionExit',
        label: 'On Collision Exit',
        category: 'entry',
        defaults: { objectId: '', layer: '' },
        fields: [
            { key: 'objectId', label: 'Trigger object id', type: 'string' },
            { key: 'layer', label: 'Other layer (optional)', type: 'string', optional: true }
        ]
    },
    {
        type: 'OnInteract',
        label: 'On Interact',
        category: 'entry',
        defaults: { objectId: '' },
        fields: [{ key: 'objectId', label: 'Interactable object id', type: 'string' }]
    },
    {
        type: 'OnTimer',
        label: 'On Timer',
        category: 'entry',
        defaults: { seconds: 1 },
        fields: [{ key: 'seconds', label: 'Seconds', type: 'number' }]
    },
    {
        type: 'OnCustomEvent',
        label: 'On Custom Event',
        category: 'entry',
        defaults: { name: '' },
        fields: [{ key: 'name', label: 'Event name', type: 'string' }]
    },
    { type: 'OnDialogueEnded', label: 'On Dialogue Ended', category: 'entry', defaults: {}, fields: [] },

    // Conditions
    {
        type: 'Compare',
        label: 'Compare',
        category: 'condition',
        defaults: { var: '', op: '==', value: true },
        fields: [
            { key: 'var', label: 'Variable', type: 'string' },
            { key: 'op', label: 'Op (== != > <)', type: 'string' },
            { key: 'value', label: 'Value (JSON)', type: 'json' }
        ]
    },
    {
        type: 'And',
        label: 'And',
        category: 'condition',
        defaults: { conditions: [] },
        fields: [{ key: 'conditions', label: 'Conditions JSON', type: 'json' }]
    },
    {
        type: 'Or',
        label: 'Or',
        category: 'condition',
        defaults: { conditions: [] },
        fields: [{ key: 'conditions', label: 'Conditions JSON', type: 'json' }]
    },
    {
        type: 'Not',
        label: 'Not',
        category: 'condition',
        defaults: { var: '', op: '==', value: true },
        fields: [
            { key: 'var', label: 'Variable', type: 'string' },
            { key: 'op', label: 'Op', type: 'string' },
            { key: 'value', label: 'Value (JSON)', type: 'json' }
        ]
    },

    // Actions
    {
        type: 'SetVariable',
        label: 'Set Variable',
        category: 'action',
        defaults: { name: '', value: true },
        fields: [
            { key: 'name', label: 'Name', type: 'string' },
            { key: 'value', label: 'Value (JSON)', type: 'json' }
        ]
    },
    {
        type: 'SetComponentEnabled',
        label: 'Set Component Enabled',
        category: 'action',
        defaults: { objectId: '', componentType: 'collider', enabled: false },
        fields: [
            { key: 'objectId', label: 'Object id', type: 'string' },
            { key: 'componentType', label: 'Component type', type: 'string' },
            { key: 'enabled', label: 'Enabled', type: 'boolean' }
        ]
    },
    {
        type: 'Teleport',
        label: 'Teleport',
        category: 'action',
        defaults: { objectId: '', x: 0, y: 0 },
        fields: [
            { key: 'objectId', label: 'Object id', type: 'string' },
            { key: 'x', label: 'X', type: 'number' },
            { key: 'y', label: 'Y', type: 'number' }
        ]
    },
    {
        type: 'DestroyObject',
        label: 'Destroy Object',
        category: 'action',
        defaults: { objectId: '' },
        fields: [{ key: 'objectId', label: 'Object id', type: 'string' }]
    },
    {
        type: 'EmitCustomEvent',
        label: 'Emit Custom Event',
        category: 'action',
        defaults: { name: '' },
        fields: [{ key: 'name', label: 'Event name', type: 'string' }]
    },
    {
        type: 'StartDialogue',
        label: 'Start Dialogue',
        category: 'action',
        defaults: { dialogueId: '' },
        fields: [{ key: 'dialogueId', label: 'Dialogue id', type: 'string' }]
    },
    {
        type: 'PlayAnimation',
        label: 'Play Animation',
        category: 'action',
        defaults: { objectId: '', clip: '' },
        fields: [
            { key: 'objectId', label: 'Object id', type: 'string' },
            { key: 'clip', label: 'Clip name', type: 'string' }
        ]
    }
];

const BY_TYPE = new Map(EVENT_GRAPH_NODE_DEFS.map((d) => [d.type, d]));

/** @param {string} type */
export function getNodeDef(type) {
    return BY_TYPE.get(type) || null;
}

/** @param {'entry'|'condition'|'action'|null} [category] */
export function listNodeDefs(category = null) {
    if (!category) return EVENT_GRAPH_NODE_DEFS.slice();
    return EVENT_GRAPH_NODE_DEFS.filter((d) => d.category === category);
}

export const NODE_CATEGORY_LABELS = {
    entry: 'Entry',
    condition: 'Condition',
    action: 'Action'
};

export const NODE_CATEGORY_COLORS = {
    entry: '#2563eb',
    condition: '#ca8a04',
    action: '#16a34a'
};
