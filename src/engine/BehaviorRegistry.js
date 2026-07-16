const registry = new Map();

/**
 * Maps component.type (see src/constants/ComponentTypes.js) to a Behavior class.
 * Populated explicitly via registerDefaultBehaviors() — not import side-effects, so
 * registration order never depends on module-graph traversal order.
 */
export const BehaviorRegistry = {
    register(type, BehaviorClass) {
        registry.set(type, BehaviorClass);
    },

    get(type) {
        return registry.get(type) || null;
    },

    has(type) {
        return registry.has(type);
    }
};
