import { evalSpec } from './eventgraph/ConditionEvaluator.js';

/**
 * §7 backlog (questObjective, Tier 3). Tracks concurrent quest state for a Scene — unlike
 * DialogueRunner (one interpreter per active modal dialogue), quests aren't modal: several can
 * be active at once, so one QuestRunner instance owns all of them (same "one instance for the
 * whole level" shape as EventGraphRuntime).
 *
 * Schema (`level.quests[]`, level-scope array like `level.dialogues[]`):
 * {
 *   id, name?,
 *   objectives: [{ id, description?, condition: {var,op,value} }],  // same evalSpec shape used
 *                                                                    // everywhere else in the engine
 *   reward?: [{ type:'giveItem'|'takeItem', itemId, count?, to?, from? }]  // same Effect shape as
 *                                                                          // DialogueRunner's node/choice effects
 * }
 *
 * Objectives are polled per-tick (via `EventGraphRuntime.tick()`, not GameEngine directly — kept
 * out of GameEngine.js so quest wiring doesn't need to touch the engine's per-frame loop) against
 * `scene.eventGraphRuntime` variables — no dedicated `type:'inventoryCount'` condition variant in
 * this pass; level authors that want item-count objectives mirror inventory into a variable via
 * the already-implemented `variableModifier` component. Once every objective in a quest
 * completes, its `reward` (if any) is applied automatically — no separate CompleteQuest/
 * GiveReward action needed.
 */
export class QuestRunner {
    /** @param {import('./Scene.js').Scene} scene */
    constructor(scene) {
        this.scene = scene;
        /** @type {Map<string, {status: 'active'|'completed', completedObjectives: Set<string>}>} */
        this.states = new Map();
    }

    /** No-op if already started or `questId` isn't a known quest (warns). */
    startQuest(questId) {
        if (this.states.has(questId)) return;
        if (!this.scene.quests.has(questId)) {
            console.warn(`[engine] QuestRunner.startQuest: unknown questId '${questId}'`);
            return;
        }
        this.states.set(questId, { status: 'active', completedObjectives: new Set() });
    }

    /** @returns {'inactive'|'active'|'completed'} */
    getStatus(questId) {
        return this.states.get(questId)?.status ?? 'inactive';
    }

    isObjectiveComplete(questId, objectiveId) {
        return this.states.get(questId)?.completedObjectives.has(objectiveId) ?? false;
    }

    /** Called once per frame from EventGraphRuntime.tick() — no-op without an EventGraphRuntime (no variables to check conditions against). */
    tick() {
        const runtime = this.scene.eventGraphRuntime;
        if (!runtime) return;
        for (const [questId, state] of this.states) {
            if (state.status === 'active') this._checkObjectives(questId, state, runtime);
        }
    }

    _checkObjectives(questId, state, runtime) {
        const objectives = this.scene.quests.get(questId)?.objectives || [];
        for (const objective of objectives) {
            if (!objective?.id || state.completedObjectives.has(objective.id)) continue;
            if (objective.condition && evalSpec(objective.condition, runtime)) {
                state.completedObjectives.add(objective.id);
            }
        }
        if (objectives.length && objectives.every(o => state.completedObjectives.has(o.id))) {
            state.status = 'completed';
            this._applyReward(questId);
        }
    }

    _applyReward(questId) {
        const reward = this.scene.quests.get(questId)?.reward;
        if (!Array.isArray(reward) || !reward.length) return;
        for (const fx of reward) {
            if (!fx?.itemId) continue;
            const count = fx.count ?? 1;
            if (fx.type === 'giveItem') {
                this.scene.getBag(fx.to || 'player')?.add(fx.itemId, count);
            } else if (fx.type === 'takeItem') {
                const bag = this.scene.getBag(fx.from || 'player');
                if (!bag?.remove(fx.itemId, count)) {
                    console.warn(`[engine] QuestRunner: reward takeItem failed for quest '${questId}' (need ${count}× ${fx.itemId})`);
                }
            }
        }
    }
}
