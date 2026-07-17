import { describe, it, expect } from 'vitest';
import {
    createEmptyEventGraph,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    updateNode,
    upsertVariable,
    removeVariable,
    cloneEventGraph
} from '../src/ui/event-graph/EventGraphModel.js';

describe('EventGraphModel', () => {
    it('creates empty graph schema', () => {
        const g = createEmptyEventGraph();
        expect(g.formatVersion).toBe(1);
        expect(g.scope).toBe('level');
        expect(g.nodes).toEqual([]);
        expect(g.edges).toEqual([]);
        expect(g.variables).toEqual([]);
    });

    it('adds nodes with defaults and unique ids', () => {
        let g = createEmptyEventGraph();
        const a = addNode(g, 'OnStart', { x: 10, y: 20 });
        g = a.graph;
        const b = addNode(g, 'SetVariable', { x: 100, y: 20 });
        g = b.graph;
        expect(g.nodes).toHaveLength(2);
        expect(a.nodeId).toBe('n1');
        expect(b.nodeId).toBe('n2');
        expect(g.nodes[1].params).toEqual({ name: '', value: true });
        expect(g.nodes[0].position).toEqual({ x: 10, y: 20 });
    });

    it('wires and removes edges; removeNode drops incident edges', () => {
        let g = createEmptyEventGraph();
        g = addNode(g, 'OnCollisionEnter').graph;
        g = addNode(g, 'SetVariable').graph;
        g = addEdge(g, 'n1', 'n2');
        expect(g.edges).toEqual([
            { from: 'n1', fromPort: 'out', to: 'n2', toPort: 'in' }
        ]);
        g = addEdge(g, 'n1', 'n2'); // dedupe
        expect(g.edges).toHaveLength(1);
        g = removeEdge(g, 'n1', 'n2');
        expect(g.edges).toHaveLength(0);
        g = addEdge(g, 'n1', 'n2');
        g = removeNode(g, 'n1');
        expect(g.nodes.map((n) => n.id)).toEqual(['n2']);
        expect(g.edges).toHaveLength(0);
    });

    it('updates params immutably', () => {
        let g = createEmptyEventGraph();
        g = addNode(g, 'SetVariable').graph;
        const before = g.nodes[0];
        g = updateNode(g, 'n1', { params: { name: 'doorOpen', value: true } });
        expect(before.params.name).toBe('');
        expect(g.nodes[0].params).toEqual({ name: 'doorOpen', value: true });
    });

    it('manages variables list', () => {
        let g = createEmptyEventGraph();
        g = upsertVariable(g, { name: 'doorOpen', type: 'bool', default: false });
        g = upsertVariable(g, { name: 'doorOpen', default: true });
        expect(g.variables).toEqual([{ name: 'doorOpen', type: 'bool', default: true }]);
        g = removeVariable(g, 'doorOpen');
        expect(g.variables).toEqual([]);
    });

    it('cloneEventGraph deep-clones', () => {
        const g = createEmptyEventGraph();
        g.nodes.push({ id: 'n1', type: 'OnStart', params: {}, position: { x: 0, y: 0 } });
        const c = cloneEventGraph(g);
        c.nodes[0].id = 'nX';
        expect(g.nodes[0].id).toBe('n1');
    });
});
