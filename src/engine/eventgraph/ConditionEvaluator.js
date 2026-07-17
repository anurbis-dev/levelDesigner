/**
 * Shared `{var, op, value}` comparator — used by Event Graph (Compare/And/Or/Not, Фаза D)
 * and Dialogue choice conditions (Фаза E), per tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md's explicit
 * "одна библиотека сравнения переменных на оба потребителя, не дублировать" instruction.
 */
export function compareOp(a, op, b) {
    switch (op) {
        case '==': return a === b;
        case '!=': return a !== b;
        case '>': return a > b;
        case '<': return a < b;
        default:
            console.warn(`[engine] condition evaluator: unknown op '${op}'`);
            return false;
    }
}

/**
 * @param {{var: string, op: string, value: *}} spec
 * @param {{getVariable(name: string): *}} variableSource - EventGraphRuntime (or anything
 *   exposing the same getVariable(name) contract, e.g. DialogueRunner's owning runtime)
 */
export function evalSpec(spec, variableSource) {
    return compareOp(variableSource.getVariable(spec.var), spec.op, spec.value);
}
