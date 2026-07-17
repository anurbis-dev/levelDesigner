import { evalSpec } from './eventgraph/ConditionEvaluator.js';

/**
 * Interpreter for one Dialogue Graph (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза E schema:
 * {formatVersion, startNode, nodes: [{id, speaker, text, choices?, next?}]}). Not a Behavior —
 * dialogue is a modal scene state, not a per-entity per-frame mechanic (see
 * Scene.dialogueActive, which PlayerMovementBehavior checks to pause movement while open).
 *
 * `runtime` is the owning EventGraphRuntime, reused as the variable source for choice
 * `condition` checks (same `{var,op,value}` shape and comparator as Event Graph, Фаза D) —
 * dialogue has no separate variable pool of its own.
 */
export class DialogueRunner {
    constructor(dialogueData, runtime) {
        this.data = dialogueData;
        this.runtime = runtime;
        this.currentNodeId = dialogueData.startNode;
        this.ended = false;
    }

    getCurrentNode() {
        return (this.data.nodes || []).find(n => n.id === this.currentNodeId) || null;
    }

    /** Choices with a `condition` that evaluates false are hidden, per the readiness criterion. */
    getVisibleChoices() {
        const node = this.getCurrentNode();
        if (!node?.choices) return [];
        return node.choices.filter(choice => !choice.condition || evalSpec(choice.condition, this.runtime));
    }

    /**
     * @param {number} [choiceIndex] - index into getVisibleChoices(), not the raw node.choices
     *   list (a hidden choice was never presented, so a UI can never pass its index) — ignored
     *   for linear nodes (no choices), which advance via node.next instead.
     */
    advance(choiceIndex) {
        if (this.ended) return;
        const node = this.getCurrentNode();
        if (!node) {
            this.ended = true;
            return;
        }

        let nextId;
        if (node.choices) {
            const choice = this.getVisibleChoices()[choiceIndex];
            nextId = choice ? choice.next : null;
        } else {
            nextId = node.next ?? null;
        }

        if (nextId === null || nextId === undefined) {
            this.ended = true;
        } else {
            this.currentNodeId = nextId;
        }
    }

    isEnded() {
        return this.ended;
    }
}
