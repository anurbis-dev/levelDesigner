import { EventGraphNodeRegistry } from './EventGraphNodeRegistry.js';
import { evalSpec } from './ConditionEvaluator.js';
import { DialogueRunner } from '../DialogueRunner.js';
import { AudioPlayer } from '../AudioPlayer.js';
import { EntityFactory } from '../EntityFactory.js';

function findEntity(scene, id) {
    return scene.getAllEntities().find(e => e.id === id);
}

/**
 * Registers the Фаза D/E/F MVP node vocabulary (see docs/RUNTIME_SCHEMA.md discipline applied to
 * BehaviorRegistry — same idea here: only nodes with a real, working implementation get
 * registered; the rest of the plan's word list (LoadLevel) stays unregistered until a later
 * phase actually needs it — EventGraphRuntime already warns-and-skips unknown node types, so
 * referencing one of those early is safe, just inert.
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
    EventGraphNodeRegistry.register('OnDialogueEnded', () => {});

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
    // Фаза E: dialogueId resolves against scene.dialogues (level-scope map, see Scene.js),
    // not the dialogueTrigger component — the component is a design-time reference only,
    // the graph node still carries its own dialogueId explicitly (plan's stated schema).
    EventGraphNodeRegistry.register('StartDialogue', (node, ctx) => {
        const dialogueData = ctx.scene.dialogues?.get(node.params.dialogueId);
        if (!dialogueData) {
            console.warn(`[engine] StartDialogue: unknown dialogueId '${node.params.dialogueId}'`);
            return;
        }
        ctx.scene.dialogueRunner = new DialogueRunner(dialogueData, ctx.runtime);
        ctx.scene.dialogueActive = true;
    });
    // Фаза F: forces a clip on SpriteAnimationBehavior directly, without touching the state
    // machine's currentState — it resumes its own clip next time a transition fires.
    EventGraphNodeRegistry.register('PlayAnimation', (node, ctx) => {
        const target = findEntity(ctx.scene, node.params.objectId);
        const anim = target?.behaviors?.find(b => typeof b.play === 'function');
        if (!anim) {
            console.warn(`[engine] PlayAnimation: no animation behavior on '${node.params.objectId}'`);
            return;
        }
        anim.play(node.params.clip);
    });
    // §7 backlog (soundEffect, Tier 1): params carry {src, volume?, loop?} directly, same
    // inline-data convention as Teleport — no assetId lookup, ProjectLoader.assetsById is
    // still intentionally empty (see its header comment).
    EventGraphNodeRegistry.register('PlaySound', (node) => {
        AudioPlayer.play(node.params.src, { volume: node.params.volume, loop: node.params.loop });
    });
    // §7 backlog (prefab, Tier 2): resolves node.params.assetId against scene.assetsById
    // (ProjectLoader.js, populated from the exported manifest's `assets` — see
    // ProjectExporter.js's opts.assetManager), unlike every earlier Tier 1 action which used
    // inline params — this is the first node that actually needs the asset registry to exist.
    EventGraphNodeRegistry.register('SpawnObject', (node, ctx) => {
        const assetData = ctx.scene.assetsById?.get(node.params.assetId);
        if (!assetData) {
            console.warn(`[engine] SpawnObject: unknown assetId '${node.params.assetId}'`);
            return;
        }
        const entity = EntityFactory.fromAssetData(assetData, {
            x: node.params.x, y: node.params.y, layerId: node.params.layerId
        }, ctx.scene.assetsById);
        ctx.scene.entities.push(entity);
    });
    // §7 backlog (questObjective, Tier 3): starts tracking — objective completion/reward is
    // handled by QuestRunner.tick() (called from EventGraphRuntime.tick(), see QuestRunner.js),
    // not a separate action; no CompleteQuest/GiveReward node needed.
    EventGraphNodeRegistry.register('StartQuest', (node, ctx) => {
        ctx.scene.questRunner?.startQuest(node.params.questId);
    });
}
