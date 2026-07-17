const registry = new Map();

/**
 * Maps event-graph node `type` (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза D) to a handler
 * function `(node, ctx) => boolean|void`. Same explicit-registration convention as
 * BehaviorRegistry — populated from registerDefaultEventGraphNodes(), not import
 * side-effects, so registration order never depends on module-graph traversal order.
 * A handler returning exactly `false` halts traversal down that execution path (used by
 * condition nodes); any other return value (including undefined, for action nodes) continues.
 */
export const EventGraphNodeRegistry = {
    register(type, handler) {
        registry.set(type, handler);
    },

    get(type) {
        return registry.get(type) || null;
    },

    has(type) {
        return registry.has(type);
    }
};
