/**
 * Editor-Project -> runtime-Project-manifest transform (engine plan §0.3, Фаза 0).
 * Pure function: takes the same (levelSessions, levelOrder) pair Project.toJSON() reads,
 * but produces a DIFFERENT shape — only what a game engine needs to boot, not what the
 * editor needs to restore open tabs. Editor-only fields (viewState, currentLevelIndex,
 * fileName, order, visible) are deliberately dropped; see the editor-Project vs
 * runtime-Project comparison table in tmp/2D_Editor_ENGINE_PLAN.md §0.3.
 *
 * Level.toJSON() never serializes its own `id` (Project.js has the same constraint, see
 * its toJSON() comment) — this exporter reads `session.id` (== `level.id`, stable,
 * independent of file path) instead of changing that format.
 *
 * Not wired into any UI yet — Фаза 3 (Play-in-editor) and Фаза 4 (release build) call this.
 */
export class ProjectExporter {
    /**
     * @param {Map<string, LevelSession>} levelSessions
     * @param {string[]} levelOrder
     * @param {Project|null} project
     * @param {{includeLevelIds?: string[], entryLevelId?: string, assetManager?: {getAllAssets(): Array<{toJSON(): object}>}}} [opts]
     * @returns {{formatVersion: number, name: string, entryLevelId: string|null, levels: Array<{id: string, data: object}>, assets: object[]}}
     */
    static export(levelSessions, levelOrder, project, opts = {}) {
        const includeIds = opts.includeLevelIds ?? levelOrder;
        const levels = includeIds
            .filter(id => levelSessions.has(id))
            .map(id => {
                const session = levelSessions.get(id);
                return { id: session.id, data: session.level.toJSON() };
            });

        // §7 backlog (prefab, Tier 2): asset catalog was never part of the runtime manifest
        // before — ProjectLoader.assetsById was a hardcoded empty Map (see its old header
        // comment). opts.assetManager is optional so existing callers (and this file's own
        // tests) that only care about levels keep working unchanged.
        const assets = opts.assetManager?.getAllAssets?.().map(asset => asset.toJSON()) ?? [];

        return {
            formatVersion: 1,
            name: project?.name ?? 'Untitled Project',
            entryLevelId: opts.entryLevelId ?? levels[0]?.id ?? null,
            levels,
            assets
        };
    }
}
