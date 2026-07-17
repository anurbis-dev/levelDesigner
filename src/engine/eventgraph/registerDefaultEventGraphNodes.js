import { EventGraphNodeRegistry } from './EventGraphNodeRegistry.js';

function compareOp(a, op, b) {
    switch (op) {
        case '==': return a === b;
        case '!=': return a !== b;
        case '>': return a > b;
        case '<': return a < b;
        default:
            console.warn(`[engine] event graph Compare: unknown op '${op}'`);
            return false;
    }
}

/** `spec` is `{var, op, value}` — the same shape node.params uses for Compare itself. */
function evalSpec(spec, runtime) {
    return compareOp(runtime.getVariable(spec.var), spec.op, spec.value);
}

function findEntity(scene, id) {
    return scene.getAllEntities().find(e => e.id === id);
}

/**
 * Registers the Фаза D MVP node vocabulary (see docs/RUNTIME_SCHEMA.md discipline applied to
 * BehaviorRegistry — same idea here: only nodes with a real, working implementation get
 * registered; the rest of the plan's word list (PlaySound, SpawnObject, LoadLevel,
 * StartDialogue, PlayAnimation) stays unregistered until Фаза E/F actually need them —
 * EventGraphRuntime already warns-and-skips unknown node types, so referencing one of those
 * early is safe, just inert.
 *
 * Boolean combinators (And/Or/Not) take `params.conditions: [{var,op,value}, ...]` — an
 * explicit list of Compare-shaped specs evaluated against current variables, not further graph
 * edges — the MVP graph only models a single-output execution chain (see
 * EventGraphRuntime._runFrom), not full multi-port boolean dataflow.
 */
export function registerDefaultEventGraphNodes() {
    // Entry nodes: reached only via external dispatch (EventGraphRuntime.tick/notifyCollision/
    // emitCustomEvent), never as a traversal target — no-op handler covers that case defensively.
    EventGraphNodeRegistry.register('OnStart', () => {});
    EventGraphNodeRegistry.register('OnTick', () => {});
    EventGraphNodeRegistry.register('OnCollisionEnter', () => {});
    EventGraphNodeRegistry.register('OnCollisionExit', () => {});
    EventGraphNodeRegistry.register('OnInteract', () => {});
    EventGraphNodeRegistry.register('OnTimer', () => {});
    EventGraphNodeRegistry.register('OnCustomEvent', () => {});

    // Conditions
    EventGraphNodeRegistry.register('Compare', (node, ctx) => evalSpec(node.params, ctx.runtime));
    EventGraphNodeRegistry.register('And', (node, ctx) =>
        (node.params?.conditions || []).every(spec => evalSpec(spec, ctx.runtime)));
    EventGraphNodeRegistry.register('Or', (node, ctx) =>
        (node.params?.conditions || []).some(spec => evalSpec(spec, ctx.runtime)));
    EventGraphNodeRegistry.register('Not', (node, ctx) => !evalSpec(node.params, ctx.runtime));

    // Actions
    EventGraphNodeRegistry.register('SetVariable', (node, ctx) => {
        ctx.runtime.setVariable(node.params.name, node.params.value);
    });
    EventGraphNodeRegistry.register('SetComponentEnabled', (node, ctx) => {
        const target = findEntity(ctx.scene, node.params.objectId);
        const behavior = target?.behaviors?.find(b => b.type === node.params.componentType);
        if (!behavior) {
            console.warn(`[engine] SetComponentEnabled: no '${node.params.componentType}' on '${node.params.objectId}'`);
            return;
        }
        behavior.enabled = node.params.enabled;
    });
    EventGraphNodeRegistry.register('Teleport', (node, ctx) => {
        const target = findEntity(ctx.scene, node.params.objectId);
        if (!target) return;
        target.x = node.params.x;
        target.y = node.params.y;
    });
    EventGraphNodeRegistry.register('DestroyObject', (node, ctx) => {
        ctx.scene.destroyEntity(node.params.objectId);
    });
    EventGraphNodeRegistry.register('EmitCustomEvent', (node, ctx) => {
        ctx.runtime.emitCustomEvent(node.params.name);
    });
}
