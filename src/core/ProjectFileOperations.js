import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { Project } from '../models/Project.js';
import { Level } from '../models/Level.js';
import { FileUtils } from '../utils/FileUtils.js';

/**
 * Project File Operations module for LevelEditor (Phase 7 of multi-level support).
 * Handles New/Open/Save/Save As for the Project — the container that saves/restores
 * the full set of currently open levels (visibility, tab order, current tab) as one
 * self-contained JSON file. See src/models/Project.js and
 * tmp/multi-level-support-plan.md section 0.
 * @extends BaseModule
 */
export class ProjectFileOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('ProjectFileOperations module initialized.');
    }

    /**
     * Create a fresh Project with a single new level, replacing every currently open
     * level (Edge Case 10 — "New Project" always replaces, single combined confirm if
     * any open level has unsaved changes, no per-tab confirms).
     */
    async newProject() {
        if (this.hasActiveMouseOperation()) {
            Logger.file.warn('newProject() blocked: mouse action in progress — finish or cancel it first');
            return;
        }

        if (this.editor.levelsManager.hasAnyUnsavedChanges()) {
            const ok = await confirm('Starting a new project will close all currently open levels. Unsaved changes will be lost. Continue?');
            if (!ok) return;
        }

        this._cleanupAllOpenSessions();

        const level = this.editor.fileManager.createNewLevel();
        // Back-compat setter (LevelEditor.js `set level()`): clears every open session
        // and bootstraps a single new one directly, without running
        // LevelsManager.setCurrentLevel()'s render/history-import side effects (there is
        // no "previous session" to switch from yet).
        this.editor.level = level;

        this._activateBootstrappedSession();
        this.editor.historyManager.saveState(level.objects, new Set(), true, null);
        this._updateParallaxStartPosition();

        this.editor.project = new Project();

        Logger.file.info('✅ New project created');
        Logger.status.success('New project created');
    }

    /**
     * Load a project file, replacing every currently open level with the ones it
     * contains (Edge Case 11 — plan default is replace, not merge; a manual merge can
     * still be done afterwards via Open Level...).
     */
    async openProject() {
        if (this.hasActiveMouseOperation()) {
            Logger.file.warn('openProject() blocked: mouse action in progress — finish or cancel it first');
            return;
        }

        if (this.editor.levelsManager.hasAnyUnsavedChanges()) {
            const ok = await confirm('Opening a project will close all currently open levels. Unsaved changes will be lost. Continue?');
            if (!ok) return;
        }

        let file;
        try {
            file = await FileUtils.pickFile('.json', false);
        } catch (error) {
            // FileUtils.pickFile() rejects both on user-cancel ('File selection
            // cancelled' / 'No file selected') and on a genuine unexpected failure
            // inside its onchange handler — only swallow the known cancel signals
            // silently, surface anything else instead of hiding a real error.
            if (error?.message === 'File selection cancelled' || error?.message === 'No file selected') {
                Logger.file.info('Open project cancelled');
                return;
            }
            Logger.file.error(`❌ Failed to open project file picker: ${error.message}`);
            Logger.status.error(`Failed to open project: ${error.message}`);
            await alert('Error opening project: ' + error.message);
            return;
        }

        let json;
        try {
            json = await FileUtils.readFileAsJSON(file);
        } catch (error) {
            Logger.file.error(`❌ Failed to load project: ${error.message}`);
            Logger.status.error(`Failed to load project: ${error.message}`);
            await alert('Error loading project: ' + error.message);
            return;
        }

        if (!json || !Array.isArray(json.levels) || json.levels.length === 0) {
            await alert('Invalid project file: no levels found.');
            return;
        }

        const sortedEntries = [...json.levels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // Parse every level BEFORE tearing down the currently open sessions — a
        // malformed entry partway through must not leave the editor with zero open
        // levels (Edge Case 3: at least one level must always stay open).
        let levels;
        try {
            levels = sortedEntries.map(entry => Level.fromJSON(entry.data));
        } catch (error) {
            Logger.file.error(`❌ Failed to parse project levels: ${error.message}`);
            Logger.status.error(`Failed to parse project levels: ${error.message}`);
            await alert('Error loading project: ' + error.message);
            return;
        }

        const project = Project.fromJSON(json);
        project.fileName = file.name;

        this._cleanupAllOpenSessions();
        this.editor.level = null; // clear every open session (see newProject() re: this setter)

        sortedEntries.forEach((entry, index) => {
            const level = levels[index];
            const session = this.editor.levelsManager.addLevel(level, {
                makeCurrent: false,
                visible: entry.visible ?? true,
                fileName: entry.fileName ?? null
            });
            // addLevel({makeCurrent:false}) never runs HistoryManager.saveState() (that
            // only happens for the live/current session in newLevel()/openLevel()) —
            // seed each background session's own snapshot directly in the same string
            // format HistoryManager.saveState() produces, so every tab has a Ctrl+Z
            // baseline the moment it becomes current, not just whichever tab happened
            // to be current when the project was opened.
            session.history = {
                undoStack: [JSON.stringify({ objects: level.objects, selection: [], groupEditMode: null })],
                redoStack: []
            };
        });

        this.editor.project = project;

        const currentIndex = Number.isInteger(json.currentLevelIndex) ? json.currentLevelIndex : 0;
        const orderedIds = this.editor.levelOrder;
        const targetId = orderedIds[currentIndex] ?? orderedIds[0];

        this._activateBootstrappedSession(targetId);
        this._updateParallaxStartPosition();

        Logger.file.info(`✅ Project loaded: ${sortedEntries.length} level(s)`);
        Logger.status.success(`Project loaded: ${sortedEntries.length} level(s)`);
    }

    /**
     * Save the current project (embedding every open level's data) to its existing
     * file name. A project always has a name (Project.js defaults it to
     * "Untitled Project", editable via Project Settings), so a never-saved project
     * derives its file name from that instead of prompting — mirrors Save Level's
     * "reuse the known name, no dialog" behavior rather than Save Level As.
     */
    async saveProject() {
        const fileName = this.editor.project?.fileName || this._deriveFileNameFromProjectName();
        this._doSaveProject(fileName);
    }

    /**
     * Save the current project with a new filename.
     */
    async saveProjectAs() {
        const currentFileName = this.editor.project?.fileName || 'project.json';
        const fileName = await prompt('Enter project file name:', currentFileName);
        if (!fileName) return;
        this._doSaveProject(fileName);
    }

    /**
     * Derive a download file name from the project's configured name (Project
     * Settings), e.g. "My Game" -> "My Game.json". Mirrors AssetManager's
     * filename sanitization: only "/" and "\" are stripped since browsers accept
     * spaces/other punctuation in a download name.
     * @private
     * @returns {string}
     */
    _deriveFileNameFromProjectName() {
        const name = this.editor.project?.name || 'Untitled Project';
        const safeName = name.replace(/[/\\]/g, '-');
        return `${safeName}.json`;
    }

    /**
     * @private
     */
    _doSaveProject(fileName) {
        if (!this.editor.project) {
            this.editor.project = new Project();
        }

        const data = this.editor.project.toJSON(this.editor.levelSessions, this.editor.levelOrder, this.editor.currentLevelId);
        FileUtils.downloadData(data, fileName, FileUtils.TYPES.JSON);

        this.editor.project.fileName = fileName;
        this.editor.project.isDirty = false;

        Logger.file.info(`💾 Project saved: ${fileName}`);
        Logger.status.success(`Project saved: ${fileName}`);
    }

    /**
     * The bootstrap add inside `editor.level = X` (see newProject()/openProject())
     * sets `currentLevelId` directly without going through
     * LevelsManager.setCurrentLevel() — there is no previous session to switch away
     * from yet, so its render/history-import/panel-update side effects never ran.
     * Forcing `currentLevelId` to null first makes setCurrentLevel() treat this as a
     * genuine "switch from nothing" into `targetLevelId`, reusing its already-reviewed
     * switch-in logic instead of duplicating it here.
     * @private
     * @param {string} [targetLevelId] - defaults to whatever addLevel() just bootstrapped
     */
    _activateBootstrappedSession(targetLevelId = this.editor.currentLevelId) {
        this.editor.currentLevelId = null;
        this.editor.levelsManager.setCurrentLevel(targetLevelId);
    }

    /**
     * `editor.level = X` (the back-compat setter used to bulk-replace every open
     * session below) just drops every LevelSession from the Map — unlike
     * LevelsManager.closeLevel(), it does none of that method's per-session cache
     * cleanup (spatial index, visibleLayersCache, layer-counts/objects-index caches
     * on the Level itself). Run that same cleanup here first for every session about
     * to be discarded, so repeated New/Open Project calls don't leak spatial-index/
     * visibleLayersCache entries keyed by now-orphaned levelIds.
     * @private
     */
    _cleanupAllOpenSessions() {
        this.editor.levelSessions.forEach(session => {
            try {
                session.level.clearLayerCountsCache();
                session.level.clearObjectsIndex();
                this.editor.renderOperations.invalidateSpatialIndex(session.id);
                this.editor.renderOperations.visibleLayersCache.delete(session.id);
            } catch (error) {
                Logger.lifecycle.error(`_cleanupAllOpenSessions() cache cleanup failed for ${session.id} (non-fatal):`, error);
            }
        });
    }

    /**
     * Mirrors LevelFileOperations._updateParallaxStartPosition() — kept as a small
     * private duplicate rather than a cross-module call, same as that module's own
     * private helpers.
     * @private
     */
    _updateParallaxStartPosition() {
        const currentCamera = this.editor.stateManager.get('camera');
        this.editor.stateManager.set('parallax.startPosition', {
            x: currentCamera.x,
            y: currentCamera.y
        });
    }

    /**
     * Destroy method for cleanup
     */
    destroy() {
        Logger.lifecycle.info('ProjectFileOperations module destroyed.');
    }
}
