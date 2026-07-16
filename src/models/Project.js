/**
 * Metadata + serialization for a set of open LevelSessions (multi-level support,
 * Phase 7). Does NOT hold the LevelSessions/Level instances themselves — those stay
 * on LevelEditor.levelSessions/levelOrder (single source of truth, mirrors how
 * LevelSession wraps a Level without owning the editor-wide session map). A project
 * file is fully self-contained: it embeds every open level's own Level.toJSON()
 * output rather than referencing files by path, since the browser editor has no
 * persistent file-handle API to re-resolve paths across sessions.
 */
export class Project {
    constructor(opts = {}) {
        this.name = opts.name ?? 'Untitled Project';
        this.fileName = opts.fileName ?? null;
        // True until the file name is pinned by an explicit user action (Save As /
        // Open) — while true, saveProject() re-derives the file name from `name` on
        // every save instead of reusing a stale name cached from an earlier save
        // (see ProjectFileOperations.saveProject()).
        this.fileNameIsAuto = opts.fileNameIsAuto ?? true;
        this.isDirty = opts.isDirty ?? false;
        this.settings = opts.settings ?? Project.defaultSettings();
    }

    /**
     * Placeholder for project-scope settings (default asset import path, default
     * grid/snap for new levels, naming convention, ...) — exact field set is still
     * open (plan section 12, item 9); left empty until ProjectSettingsDialog grows
     * beyond its current name-only stub.
     */
    static defaultSettings() {
        return {};
    }

    /**
     * Serialize this project plus every currently open level into one self-contained
     * JSON document.
     * @param {Map<string, LevelSession>} levelSessions
     * @param {string[]} levelOrder - open-tab order (levelId[])
     * @param {string|null} currentLevelId
     * @returns {Object}
     */
    toJSON(levelSessions, levelOrder, currentLevelId) {
        return {
            version: 1,
            name: this.name,
            settings: this.settings,
            // Level.toJSON() never serializes `id` (a fresh id is generated on every
            // fromJSON(), see Level.js/plan Edge Case 8), so a saved level id can't be
            // used to identify "the current level" again after reload — store its
            // position in `levels` instead, resolved back to an id once the loaded
            // levels have been re-added (see ProjectFileOperations.openProject()).
            currentLevelIndex: levelOrder.indexOf(currentLevelId),
            levels: levelOrder.map((id, index) => {
                const session = levelSessions.get(id);
                return {
                    order: index,
                    visible: session.visible,
                    fileName: session.fileName,
                    data: session.level.toJSON()
                };
            })
        };
    }

    /**
     * Rebuild the Project's own metadata from a saved project file. Does NOT touch
     * levels — ProjectFileOperations.openProject() re-adds those itself via
     * LevelsManager.addLevel(Level.fromJSON(entry.data), ...).
     * @param {Object} json
     * @returns {Project}
     */
    static fromJSON(json) {
        return new Project({
            name: json.name,
            settings: json.settings
        });
    }
}
