/**
 * Pure helpers for level-scope Event Graph JSON (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза D).
 * Mutates only when callers pass live graph objects; most APIs return new graph snapshots.
 */

import { getNodeDef } from './EventGraphNodeCatalog.js';

/** @returns {object} empty graph */
export function createEmptyEventGraph() {
    return {
        formatVersion: 1,
        scope: 'level',
        variables: [],
        nodes: [],
        edges: []
    };
}

/**
 * Deep-clone graph (or empty if null/undefined).
 * @param {object|null|undefined} graph
 * @returns {object}
 */
export function cloneEventGraph(graph) {
    if (!graph) return createEmptyEventGraph();
    return JSON.parse(JSON.stringify(graph));
}

/**
 * Ensure level.eventGraph is a usable object (mutates level when null).
 * @param {{ eventGraph?: object|null }} level
 * @returns {object}
 */
export function ensureLevelEventGraph(level) {
    if (!level) return createEmptyEventGraph();
    if (!level.eventGraph) {
        level.eventGraph = createEmptyEventGraph();
    }
    return level.eventGraph;
}

/** @returns {string} */
export function nextGraphNodeId(graph) {
    const used = new Set((graph?.nodes || []).map((n) => n.id));
    let i = 1;
    while (used.has(`n${i}`)) i += 1;
    return `n${i}`;
}

/**
 * @param {object} graph
 * @param {string} type
 * @param {{ x: number, y: number }} position
 * @returns {{ graph: object, nodeId: string }}
 */
export function addNode(graph, type, position = { x: 40, y: 40 }) {
    const g = cloneEventGraph(graph);
    const def = getNodeDef(type);
    const id = nextGraphNodeId(g);
    g.nodes.push({
        id,
        type,
        params: def ? JSON.parse(JSON.stringify(def.defaults || {})) : {},
        position: { x: position.x, y: position.y }
    });
    return { graph: g, nodeId: id };
}

/**
 * @param {object} graph
 * @param {string} nodeId
 * @returns {object}
 */
export function removeNode(graph, nodeId) {
    const g = cloneEventGraph(graph);
    g.nodes = (g.nodes || []).filter((n) => n.id !== nodeId);
    g.edges = (g.edges || []).filter((e) => e.from !== nodeId && e.to !== nodeId);
    return g;
}

/**
 * @param {object} graph
 * @param {string} fromId
 * @param {string} toId
 * @returns {object}
 */
export function addEdge(graph, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return cloneEventGraph(graph);
    const g = cloneEventGraph(graph);
    const exists = (g.edges || []).some((e) => e.from === fromId && e.to === toId);
    if (!exists) {
        g.edges = g.edges || [];
        g.edges.push({ from: fromId, fromPort: 'out', to: toId, toPort: 'in' });
    }
    return g;
}

/**
 * @param {object} graph
 * @param {string} fromId
 * @param {string} toId
 * @returns {object}
 */
export function removeEdge(graph, fromId, toId) {
    const g = cloneEventGraph(graph);
    g.edges = (g.edges || []).filter((e) => !(e.from === fromId && e.to === toId));
    return g;
}

/**
 * @param {object} graph
 * @param {string} nodeId
 * @param {object} patch params and/or position
 * @returns {object}
 */
export function updateNode(graph, nodeId, patch = {}) {
    const g = cloneEventGraph(graph);
    const node = (g.nodes || []).find((n) => n.id === nodeId);
    if (!node) return g;
    if (patch.params && typeof patch.params === 'object') {
        node.params = { ...(node.params || {}), ...patch.params };
    }
    if (patch.position && typeof patch.position === 'object') {
        node.position = {
            x: patch.position.x ?? node.position?.x ?? 0,
            y: patch.position.y ?? node.position?.y ?? 0
        };
    }
    if (typeof patch.type === 'string') node.type = patch.type;
    return g;
}

/**
 * Replace entire variables array.
 * @param {object} graph
 * @param {Array<{name:string,type?:string,default?:*}>} variables
 * @returns {object}
 */
export function setVariables(graph, variables) {
    const g = cloneEventGraph(graph);
    g.variables = Array.isArray(variables) ? JSON.parse(JSON.stringify(variables)) : [];
    return g;
}

/**
 * @param {object} graph
 * @param {{name:string,type?:string,default?:*}} variable
 * @returns {object}
 */
export function upsertVariable(graph, variable) {
    const g = cloneEventGraph(graph);
    g.variables = g.variables || [];
    const idx = g.variables.findIndex((v) => v.name === variable.name);
    if (idx >= 0) g.variables[idx] = { ...g.variables[idx], ...variable };
    else g.variables.push({ type: 'bool', default: false, ...variable });
    return g;
}

/**
 * @param {object} graph
 * @param {string} name
 * @returns {object}
 */
export function removeVariable(graph, name) {
    const g = cloneEventGraph(graph);
    g.variables = (g.variables || []).filter((v) => v.name !== name);
    return g;
}
