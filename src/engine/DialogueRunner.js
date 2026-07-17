import { evalSpec } from './eventgraph/ConditionEvaluator.js';

/**
 * Interpreter for one Dialogue Graph.
 *
 * Schema (formatVersion ≥ 1, extensions for items / multi-NPC / bags):
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
 *   — to/from: 'player' | participantId | objectId (default player bag)
 * Choice: {
 *   text, next, condition?: {var,op,value},
 *   requireItem?: { itemId, count?, bag? },  // hide if bag lacks (default player)
 *   itemPick?: { count?, to? }, // player picks itemId; remove player, optional to bag
 *   effects?: Effect[]                 // on select (after itemPick transfer)
 * }
 *
 * Not a Behavior — modal scene state (Scene.dialogueActive).
 * `runtime` = EventGraphRuntime (variables + scene bags).
 */
export class DialogueRunner {
    /**
     * @param {object} dialogueData
     * @param {object} runtime EventGraphRuntime (variables; .scene)
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

    /** @returns {import('./Scene.js').Scene|null} */
    get scene() {
        return this.runtime?.scene || null;
    }

    /** @returns {import('./Inventory.js').Inventory|null} */
    get inventory() {
        return this.scene?.inventory || null;
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
     * Map bag ref: empty/'player' → player; participantId → its objectId or player;
     * otherwise treat as objectId.
     * @param {string|null|undefined} ref
     * @returns {string} 'player' | objectId
     */
    resolveBagKey(ref) {
        if (!ref || ref === 'player') return 'player';
        const p = (this.data.participants || []).find((x) => x.id === ref);
        if (p) {
            if (p.role === 'player') return 'player';
            if (p.objectId) return p.objectId;
            // NPC without object link — no dedicated bag; use synthetic key by participant id
            return `participant:${p.id}`;
        }
        return ref;
    }

    /**
     * @param {string|null|undefined} ref
     * @returns {import('./Inventory.js').Inventory|null}
     */
    getBag(ref) {
        const scene = this.scene;
        if (!scene) return null;
        if (typeof scene.getBag === 'function') {
            return scene.getBag(this.resolveBagKey(ref));
        }
        return scene.inventory || null;
    }

    /**
     * Choices visible to the player (conditions + requireItem).
     * Player response options = this list.
     */
    getVisibleChoices() {
        const node = this.getCurrentNode();
        if (!node?.choices) return [];
        return node.choices.filter((choice) => {
            if (choice.condition && !evalSpec(choice.condition, this.runtime)) return false;
            if (choice.requireItem?.itemId) {
                const need = choice.requireItem.count ?? 1;
                const bag = this.getBag(choice.requireItem.bag || 'player');
                if (!bag?.has(choice.requireItem.itemId, need)) return false;
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
                const playerBag = this.getBag('player');
                if (!playerBag?.remove(itemId, count)) {
                    this.lastError = 'missingItem';
                    return { ok: false, reason: 'missingItem' };
                }
                // Deposit into target bag (explicit to, else current speaker object/participant).
                const toRef = selectedChoice.itemPick.to
                    || this.getCurrentSpeaker().objectId
                    || this.getCurrentSpeaker().id
                    || null;
                if (toRef && this.resolveBagKey(toRef) !== 'player') {
                    this.getBag(toRef)?.add(itemId, count);
                }
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
        if (!this.scene) {
            console.warn('[engine] DialogueRunner: no scene, item effects skipped');
            return;
        }
        for (const fx of effects) {
            if (!fx || !fx.itemId) continue;
            const count = fx.count ?? 1;
            const type = fx.type;
            if (type === 'giveItem') {
                // Give to bag (default player). Semantic: item appears in target bag.
                const bag = this.getBag(fx.to || 'player');
                bag?.add(fx.itemId, count);
            } else if (type === 'takeItem') {
                // Take from bag (default player).
                const bag = this.getBag(fx.from || 'player');
                if (!bag?.remove(fx.itemId, count)) {
                    console.warn(
                        `[engine] DialogueRunner: takeItem failed (need ${count}× ${fx.itemId})`
                    );
                }
            }
        }
    }
}
