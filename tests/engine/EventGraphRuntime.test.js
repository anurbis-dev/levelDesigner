import { describe, it, expect, vi, beforeAll } from 'vitest';
import { EventGraphRuntime } from '../../src/engine/eventgraph/EventGraphRuntime.js';
import { registerDefaultEventGraphNodes } from '../../src/engine/eventgraph/registerDefaultEventGraphNodes.js';

beforeAll(() => registerDefaultEventGraphNodes());

function dummyScene(overrides = {}) {
    return { getAllEntities: () => [], player: null, input: null, destroyEntity: vi.fn(), ...overrides };
}

describe('EventGraphRuntime — entry/action wiring', () => {
    it('fires OnStart nodes immediately on construction', () => {
        const graph = {
            variables: [{ name: 'ready', default: false }],
            nodes: [
                { id: 'n1', type: 'OnStart', params: {} },
                { id: 'n2', type: 'SetVariable', params: { name: 'ready', value: true } }
            ],
            edges: [{ from: 'n1', to: 'n2' }]
        };
        const runtime = new EventGraphRuntime(graph, dummyScene());
        expect(runtime.getVariable('ready')).toBe(true);
    });

    it('emitCustomEvent/OnCustomEvent bridges two independent chains', () => {
        const graph = {
            variables: [{ name: 'doorOpened', default: false }],
            nodes: [
                { id: 'n1', type: 'OnCustomEvent', params: { name: 'open' } },
                { id: 'n2', type: 'SetVariable', params: { name: 'doorOpened', value: true } }
            ],
            edges: [{ from: 'n1', to: 'n2' }]
        };
        const runtime = new EventGraphRuntime(graph, dummyScene());
        expect(runtime.getVariable('doorOpened')).toBe(false);
        runtime.emitCustomEvent('open');
        expect(runtime.getVariable('doorOpened')).toBe(true);
    });
});

describe('EventGraphRuntime — condition nodes gate propagation', () => {
    function graphWith(conditionNode) {
        return {
            variables: [{ name: 'reached', default: false }],
            nodes: [
                { id: 'trigger', type: 'OnCustomEvent', params: { name: 'go' } },
                conditionNode,
                { id: 'action', type: 'SetVariable', params: { name: 'reached', value: true } }
            ],
            edges: [{ from: 'trigger', to: 'cond' }, { from: 'cond', to: 'action' }]
        };
    }

    it('Compare true lets the chain continue', () => {
        const graph = graphWith({ id: 'cond', type: 'Compare', params: { var: 'reached', op: '==', value: false } });
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.emitCustomEvent('go');
        expect(runtime.getVariable('reached')).toBe(true);
    });

    it('Compare false halts the chain', () => {
        const graph = graphWith({ id: 'cond', type: 'Compare', params: { var: 'reached', op: '==', value: true } });
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.emitCustomEvent('go');
        expect(runtime.getVariable('reached')).toBe(false);
    });

    it('And requires every condition true', () => {
        const graph = graphWith({
            id: 'cond', type: 'And',
            params: { conditions: [{ var: 'reached', op: '==', value: false }, { var: 'missing', op: '==', value: undefined }] }
        });
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.emitCustomEvent('go');
        expect(runtime.getVariable('reached')).toBe(true);
    });

    it('Or requires at least one condition true', () => {
        const graph = graphWith({
            id: 'cond', type: 'Or',
            params: { conditions: [{ var: 'reached', op: '==', value: true }, { var: 'reached', op: '==', value: false }] }
        });
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.emitCustomEvent('go');
        expect(runtime.getVariable('reached')).toBe(true);
    });

    it('Not negates its condition', () => {
        const graph = graphWith({ id: 'cond', type: 'Not', params: { var: 'reached', op: '==', value: true } });
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.emitCustomEvent('go');
        expect(runtime.getVariable('reached')).toBe(true);
    });
});

describe('EventGraphRuntime — OnTick/OnTimer', () => {
    it('OnTick fires only every N ticks', () => {
        const graph = {
            variables: [{ name: 'count', default: 0 }],
            nodes: [
                { id: 'n1', type: 'OnTick', params: { everyNTicks: 3 } },
                { id: 'n2', type: 'SetVariable', params: { name: 'count', value: 1 } }
            ],
            edges: [{ from: 'n1', to: 'n2' }]
        };
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.tick(0.1);
        runtime.tick(0.1);
        expect(runtime.getVariable('count')).toBe(0);
        runtime.tick(0.1);
        expect(runtime.getVariable('count')).toBe(1);
    });

    it('OnTimer fires once its seconds have elapsed and repeats', () => {
        const graph = {
            variables: [{ name: 'fires', default: 0 }],
            nodes: [
                { id: 'n1', type: 'OnTimer', params: { seconds: 1 } },
                { id: 'n2', type: 'SetVariable', params: { name: 'fires', value: 1 } }
            ],
            edges: [{ from: 'n1', to: 'n2' }]
        };
        const runtime = new EventGraphRuntime(graph, dummyScene());
        runtime.tick(0.5);
        expect(runtime.getVariable('fires')).toBe(0);
        runtime.tick(0.5);
        expect(runtime.getVariable('fires')).toBe(1);
    });
});

describe('EventGraphRuntime — unknown node type', () => {
    it('warns and skips instead of throwing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const graph = {
            nodes: [
                { id: 'n1', type: 'OnCustomEvent', params: { name: 'go' } },
                { id: 'n2', type: 'TotallyUnknownNodeType', params: {} }
            ],
            edges: [{ from: 'n1', to: 'n2' }]
        };
        const runtime = new EventGraphRuntime(graph, dummyScene());
        expect(() => runtime.emitCustomEvent('go')).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('TotallyUnknownNodeType'));
        warnSpy.mockRestore();
    });
});
