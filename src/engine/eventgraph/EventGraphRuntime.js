import { EventGraphNodeRegistry } from './EventGraphNodeRegistry.js';

/**
 * Interpreter for one Event Graph (level- or asset-scope, tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md
 * Фаза D schema). Holds the graph's variables and walks `edges` from whichever entry node an
 * external event dispatches to, executing each connected node's registered handler in order.
 * Unknown node type — warns and skips that node (same contract as BehaviorRegistry for unknown
 * component types), doesn't throw or abort the rest of the graph.
 *
 * Entry-node dispatch is driven by the engine, not by this class discovering events on its
 * own: GameEngine.tick() calls `.tick(dt)` (OnTick/OnTimer/OnInteract), TriggerBehavior.update()
 * calls `.notifyCollision()` (OnCollisionEnter/OnCollisionExit) directly when it detects an
 * enter/exit for this tick.
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

    _entityHasLayer(entity, layer) {
        const behavior = entity?.behaviors?.find(b => b.properties?.layer !== undefined);
        return behavior?.properties?.layer === layer;
    }

    /** Walks outgoing edges from `nodeId`, executing each target's handler, depth-first. */
    _runFrom(nodeId, ctx) {
        for (const edge of (this.graph.edges || []).filter(e => e.from === nodeId)) {
            const targetNode = (this.graph.nodes || []).find(n => n.id === edge.to);
            if (!targetNode) continue;

            const handler = EventGraphNodeRegistry.get(targetNode.type);
            if (!handler) {
                console.warn(`[engine] event graph node type '${targetNode.type}' not implemented, skipped`);
                continue;
            }

            const result = handler(targetNode, { runtime: this, scene: this.scene, ...ctx });
            if (result === false) continue;
            this._runFrom(targetNode.id, ctx);
        }
    }
}
