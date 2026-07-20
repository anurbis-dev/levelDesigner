import { EventGraphNodeRegistry } from './EventGraphNodeRegistry.js';

/**
 * Interpreter for one Event Graph (level- or asset-scope, tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md
 * Фаза D schema). Holds the graph's variables and walks `edges` from whichever entry node an
 * external event dispatches to, executing each connected node's registered handler in order.
 * Unknown node type — warns and skips that node (same contract as BehaviorRegistry for unknown
 * component types), doesn't throw or abort the rest of the graph.
 *
 * Entry-node dispatch is driven by the engine, not by this class discovering events on its
 * own: GameEngine.tick() calls `.tick(dt)` (OnTick/OnTimer/OnInteract/OnDialogueEnded polling),
 * TriggerBehavior.update() calls `.notifyCollision()` (OnCollisionEnter/OnCollisionExit)
 * directly when it detects an enter/exit for this tick. StartDialogue (Фаза E) is the one
 * action that hands control to a separate interpreter (DialogueRunner) rather than acting
 * immediately — see _checkDialogueEnded().
 */
export class EventGraphRuntime {
    constructor(graphData, scene) {
        this.graph = graphData;
        this.scene = scene;
        this.variables = new Map((graphData.variables || []).map(v => [v.name, v.default]));
        this._tickCount = 0;
        this._timers = (graphData.nodes || [])
            .filter(node => node.type === 'OnTimer')
            .map(node => ({ node, remaining: node.params?.seconds ?? 1 }));
        this._customListeners = new Map();
        for (const node of graphData.nodes || []) {
            if (node.type !== 'OnCustomEvent') continue;
            const name = node.params?.name;
            const list = this._customListeners.get(name) || [];
            list.push(node.id);
            this._customListeners.set(name, list);
        }
        this._interactWasDown = false;
        /** Node ids executed recently — Event Graph UI highlight during Play. */
        this.recentNodeIds = new Set();
        /** @type {Map<string, number>} nodeId → expiry ms (performance.now) */
        this._recentExpiry = new Map();
        this._recentHighlightMs = 450;

        this._fireEntriesOfType('OnStart', {});
    }

    getVariable(name) {
        return this.variables.get(name);
    }

    setVariable(name, value) {
        this.variables.set(name, value);
    }

    /** Advances OnTick/OnTimer/OnInteract entry nodes. Called once per GameEngine.tick(dt). */
    tick(dt) {
        this._pruneRecent();
        this._tickCount++;
        for (const node of this.graph.nodes || []) {
            if (node.type !== 'OnTick') continue;
            const interval = node.params?.everyNTicks ?? 1;
            if (this._tickCount % interval === 0) this._runFrom(node.id, {});
        }

        for (const timer of this._timers) {
            timer.remaining -= dt;
            if (timer.remaining <= 0) {
                this._runFrom(timer.node.id, {});
                timer.remaining += timer.node.params?.seconds ?? 1;
            }
        }

        this._checkInteractNodes();
        this._checkDialogueEnded();
        // §7 backlog (questObjective, Tier 3): objective conditions read this runtime's
        // variables, so polling belongs here rather than a separate GameEngine._update() call —
        // keeps quest wiring out of GameEngine.js entirely (QuestRunner.tick() is itself a no-op
        // without an EventGraphRuntime, so this can't double-fire or run stale).
        this.scene.questRunner?.tick();
    }

    /**
     * @param {'Enter'|'Exit'} kind
     * @param {string} triggerEntityId - the entity the OnCollisionEnter/Exit node's `objectId` targets
     * @param {import('../Entity.js').Entity} otherEntity - the entity that entered/exited
     */
    notifyCollision(kind, triggerEntityId, otherEntity) {
        const type = `OnCollision${kind}`;
        for (const node of this.graph.nodes || []) {
            if (node.type !== type) continue;
            if (node.params?.objectId && node.params.objectId !== triggerEntityId) continue;
            if (node.params?.layer && !this._entityHasLayer(otherEntity, node.params.layer)) continue;
            this._runFrom(node.id, { otherEntity });
        }
    }

    /** Level-scope pub/sub bridge between graphs (Level Event Graph ⇄ Object Event Graph). */
    emitCustomEvent(name) {
        for (const nodeId of this._customListeners.get(name) || []) {
            this._runFrom(nodeId, {});
        }
    }

    _fireEntriesOfType(type, ctx) {
        for (const node of this.graph.nodes || []) {
            if (node.type === type) this._runFrom(node.id, ctx);
        }
    }

    _checkInteractNodes() {
        const input = this.scene.input;
        const player = this.scene.player;
        const pressedNow = typeof input?.isDown === 'function' && input.isDown('e');
        const justPressed = pressedNow && !this._interactWasDown;
        this._interactWasDown = pressedNow;
        if (!justPressed || !player) return;

        const point = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
        for (const node of this.graph.nodes || []) {
            if (node.type !== 'OnInteract') continue;
            const target = this.scene.getAllEntities().find(e => e.id === node.params?.objectId);
            const interactable = target?.behaviors?.find(b => typeof b.isInRange === 'function');
            if (interactable?.enabled && interactable.isInRange(point)) {
                this._runFrom(node.id, { otherEntity: target });
            }
        }
    }

    /**
     * Detects DialogueRunner.isEnded() (set by an external UI calling .advance() past the last
     * node) and fires OnDialogueEnded (Фаза E) — polled per-tick, the same pattern OnInteract
     * already uses for edge-detecting external state this class doesn't own.
     */
    _checkDialogueEnded() {
        if (!this.scene.dialogueActive || !this.scene.dialogueRunner?.isEnded()) return;
        this.scene.dialogueActive = false;
        this.scene.dialogueRunner = null;
        this._fireEntriesOfType('OnDialogueEnded', {});
    }

    _entityHasLayer(entity, layer) {
        const behavior = entity?.behaviors?.find(b => b.properties?.layer !== undefined);
        return behavior?.properties?.layer === layer;
    }

    /** Walks outgoing edges from `nodeId`, executing each target's handler, depth-first. */
    _runFrom(nodeId, ctx) {
        this._markRecent(nodeId);
        for (const edge of (this.graph.edges || []).filter(e => e.from === nodeId)) {
            const targetNode = (this.graph.nodes || []).find(n => n.id === edge.to);
            if (!targetNode) continue;

            const handler = EventGraphNodeRegistry.get(targetNode.type);
            if (!handler) {
                console.warn(`[engine] event graph node type '${targetNode.type}' not implemented, skipped`);
                continue;
            }

            this._markRecent(targetNode.id);
            const result = handler(targetNode, { runtime: this, scene: this.scene, ...ctx });
            if (result === false) continue;
            this._runFrom(targetNode.id, ctx);
        }
    }

    /** @private */
    _markRecent(nodeId) {
        if (!nodeId) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this._recentExpiry.set(nodeId, now + this._recentHighlightMs);
        this.recentNodeIds.add(nodeId);
    }

    /** @private */
    _pruneRecent() {
        if (this._recentExpiry.size === 0) return;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        for (const [id, exp] of this._recentExpiry) {
            if (exp <= now) {
                this._recentExpiry.delete(id);
                this.recentNodeIds.delete(id);
            }
        }
    }
}
