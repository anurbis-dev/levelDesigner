import { evalSpec } from './eventgraph/ConditionEvaluator.js';

/**
 * Interpreter for one Dialogue Graph.
 *
 * Schema (formatVersion ≥ 1, extensions for items / multi-NPC):
 * {
 *   formatVersion, startNode,
 *   participants?: [{ id, role:'player'|'npc', displayName?, objectId? }],
 *   nodes: [{
 *     id, speaker?, speakerId?, text,
 *     effects?: Effect[],          // on enter
 *     next?, choices?: Choice[]
 *   }]
 * }
 * Effect: { type:'giveItem'|'takeItem', itemId, count?, to?, from? }
 *   — MVP: only player inventory is real; giveItem → player.add, takeItem → player.remove
 * Choice: {
 *   text, next, condition?: {var,op,value},
 *   requireItem?: { itemId, count? },  // hide if player lacks
 *   itemPick?: { count? },             // player picks itemId to give (advance opts.selectedItemId)
 *   effects?: Effect[]                 // on select (after itemPick transfer)
 * }
 *
 * Not a Behavior — modal scene state (Scene.dialogueActive).
 * `runtime` = EventGraphRuntime (variables + scene.inventory).
 */
export class DialogueRunner {
    /**
     * @param {object} dialogueData
     * @param {object} runtime EventGraphRuntime (variables; .scene.inventory)
     */
    constructor(dialogueData, runtime) {
        this.data = dialogueData;
        this.runtime = runtime;
        this.currentNodeId = dialogueData.startNode;
        this.ended = false;
        /** Last advance failure (itemPick / missing item) — for play UI. */
        this.lastError = null;
        // Enter start node effects
        this._applyNodeEnter(this.getCurrentNode());
    }

    /** @returns {import('./Inventory.js').Inventory|null} */
    get inventory() {
        return this.runtime?.scene?.inventory || null;
    }

    getCurrentNode() {
        return (this.data.nodes || []).find((n) => n.id === this.currentNodeId) || null;
    }

    /**
     * Resolve display speaker for current node (multi-NPC via participants).
     * @returns {{ id: string|null, displayName: string, role: string, objectId?: string }}
     */
    getCurrentSpeaker() {
        const node = this.getCurrentNode();
        if (!node) return { id: null, displayName: '', role: 'npc' };
        const participants = this.data.participants || [];
        if (node.speakerId) {
            const p = participants.find((x) => x.id === node.speakerId);
            if (p) {
                return {
                    id: p.id,
                    displayName: p.displayName || p.id,
                    role: p.role || 'npc',
                    objectId: p.objectId
                };
            }
            return { id: node.speakerId, displayName: node.speaker || node.speakerId, role: 'npc' };
        }
        return {
            id: null,
            displayName: node.speaker || '',
            role: 'npc'
        };
    }

    /**
     * Choices visible to the player (conditions + requireItem).
     * Player response options = this list.
     */
    getVisibleChoices() {
        const node = this.getCurrentNode();
        if (!node?.choices) return [];
        const inv = this.inventory;
        return node.choices.filter((choice) => {
            if (choice.condition && !evalSpec(choice.condition, this.runtime)) return false;
            if (choice.requireItem?.itemId) {
                const need = choice.requireItem.count ?? 1;
                if (!inv?.has(choice.requireItem.itemId, need)) return false;
            }
            return true;
        });
    }

    /**
     * @param {number} [choiceIndex] index into getVisibleChoices()
     * @param {{ selectedItemId?: string }} [opts] required when choice.itemPick is set
     * @returns {{ ok: boolean, needItemPick?: boolean, reason?: string }}
     */
    advance(choiceIndex, opts = {}) {
        this.lastError = null;
        if (this.ended) return { ok: false, reason: 'ended' };

        const node = this.getCurrentNode();
        if (!node) {
            this.ended = true;
            return { ok: true };
        }

        let nextId;
        let selectedChoice = null;

        if (node.choices) {
            selectedChoice = this.getVisibleChoices()[choiceIndex];
            if (!selectedChoice) {
                this.lastError = 'invalidChoice';
                return { ok: false, reason: 'invalidChoice' };
            }

            if (selectedChoice.itemPick) {
                const itemId = opts.selectedItemId;
                if (!itemId) {
                    this.lastError = 'needItemPick';
                    return { ok: false, needItemPick: true, reason: 'needItemPick' };
                }
                const count = selectedChoice.itemPick.count ?? 1;
                if (!this.inventory?.remove(itemId, count)) {
                    this.lastError = 'missingItem';
                    return { ok: false, reason: 'missingItem' };
                }
                // Item left the player (payment / gift to NPC). NPC bag not tracked in MVP.
            }

            this._applyEffects(selectedChoice.effects);
            nextId = selectedChoice.next;
        } else {
            nextId = node.next ?? null;
        }

        if (nextId === null || nextId === undefined) {
            this.ended = true;
            return { ok: true };
        }

        this.currentNodeId = nextId;
        this._applyNodeEnter(this.getCurrentNode());
        return { ok: true };
    }

    isEnded() {
        return this.ended;
    }

    /** @private */
    _applyNodeEnter(node) {
        if (!node) return;
        this._applyEffects(node.effects);
    }

    /**
     * @param {Array|undefined} effects
     * @private
     */
    _applyEffects(effects) {
        if (!Array.isArray(effects) || !effects.length) return;
        const inv = this.inventory;
        if (!inv) {
            console.warn('[engine] DialogueRunner: no scene.inventory, item effects skipped');
            return;
        }
        for (const fx of effects) {
            if (!fx || !fx.itemId) continue;
            const count = fx.count ?? 1;
            const type = fx.type;
            // MVP: player bag only. giveItem → player gains; takeItem → player loses.
            // to/from fields reserved for multi-bag later; ignored except documentation.
            if (type === 'giveItem') {
                inv.add(fx.itemId, count);
            } else if (type === 'takeItem') {
                if (!inv.remove(fx.itemId, count)) {
                    console.warn(
                        `[engine] DialogueRunner: takeItem failed (need ${count}× ${fx.itemId})`
                    );
                }
            }
        }
    }
}
