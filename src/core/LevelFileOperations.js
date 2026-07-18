import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { Level } from '../models/Level.js';

/**
 * Level File Operations module for LevelEditor
 * Handles all file-related operations: new, open, save, import.
 * @extends BaseModule
 */
export class LevelFileOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('LevelFileOperations module initialized.');
    }

    /**
     * Create a brand-new level and add it as a new tab (does NOT replace/discard the
     * currently open level or any other open tab — see plan section 6.2). No unsaved-
     * changes confirm needed since nothing is being discarded anymore.
     */
    async newLevel() {
        if (this.hasActiveMouseOperation()) {
            Logger.file.warn('newLevel() blocked: mouse action in progress — finish or cancel it first');
            return;
        }

        Logger.file.info('Creating new level...');

        const level = this.editor.fileManager.createNewLevel();
        this.editor.levelsManager.addLevel(level, { makeCurrent: true, visible: true });

        // addLevel() -> setCurrentLevel() already rendered/updated panels and imported
        // this brand-new session's empty history stack — seed it so Ctrl+Z has a
        // baseline state to fall back to (mirrors LevelsPanel.onAddLevel(), Phase 2).
        this.editor.historyManager.saveState(level.objects, new Set(), true, null);

        // Auto-set parallax start position to the new session's camera. Global state,
        // not per-session (see plan Phase 1 known gaps) — matches legacy single-level
        // behavior for a freshly created level.
        this._updateParallaxStartPosition();

        Logger.file.info('✅ New level created');
        Logger.status.success('New level created');
    }

    /**
     * Open an existing level from file and add it as a new tab (does NOT replace/discard
     * the currently open level — see plan section 6.3). If a level with the same file
     * name is already open, switches to that tab instead of opening a duplicate
     * (best-effort: Level.toJSON() doesn't persist `id`, so this can't be exact — see
     * plan Edge Case 8).
     * @returns {Promise<void>}
     */
    async openLevel() {
        if (this.hasActiveMouseOperation()) {
            Logger.file.warn('openLevel() blocked: mouse action in progress — finish or cancel it first');
            return;
        }

        try {
            Logger.file.info('📂 Opening level...');

            // Load level from file. Returns null both when the user cancelled the file
            // picker and when loading failed (FileManager already showed its own alert
            // for real errors) - either way, keep the current level and stop here.
            const loadedLevel = await this.editor.fileManager.loadLevelFromFileInput();
            if (!loadedLevel) {
                Logger.file.info('Open level cancelled or failed - keeping current level');
                return;
            }
            // loadLevelFromFileInput() -> loadLevel() sets this as a side effect; read it
            // back immediately (nothing else runs in between) rather than changing that
            // method's return signature.
            const fileName = this.editor.fileManager.getCurrentFileName();
            await this.openLevelFromData(loadedLevel.toJSON(), fileName, { skipMouseGuard: true });
        } catch (error) {
            Logger.file.error(`❌ Failed to load level: ${error.message}`);
            Logger.status.error(`Failed to load level: ${error.message}`);
            await alert("Error loading level: " + error.message);
        }
    }

    /**
     * Open a level from JSON (disk open or Open Recent cache). Adds a tab; dedups by fileName.
     * @param {Object} json - Level.toJSON() payload
     * @param {string} fileName
     * @param {{skipMouseGuard?: boolean}} [opts]
     */
    async openLevelFromData(json, fileName, opts = {}) {
        if (!opts.skipMouseGuard && this.hasActiveMouseOperation()) {
            Logger.file.warn('openLevelFromData() blocked: mouse action in progress');
            return;
        }

        let loadedLevel;
        try {
            loadedLevel = Level.fromJSON(json);
        } catch (error) {
            Logger.file.error(`❌ Failed to parse level: ${error.message}`);
            Logger.status.error(`Failed to parse level: ${error.message}`);
            await alert('Error loading level: ' + error.message);
            return;
        }

        const name = fileName || 'level.json';
        this.editor.fileManager.setCurrentFileName(name);

        const alreadyOpenSession = this.editor.levelsManager.getOrderedSessions()
            .find(session => session.fileName && session.fileName === name);
        if (alreadyOpenSession) {
            this.editor.levelsManager.setCurrentLevel(alreadyOpenSession.id);
            this.editor.recentFilesManager?.remember('level', name, json);
            Logger.file.info(`"${name}" is already open — switched to its tab`);
            Logger.status.info(`"${name}" is already open`);
            return;
        }

        this.editor.levelsManager.addLevel(loadedLevel, { makeCurrent: true, visible: true, fileName: name });

        // addLevel() -> setCurrentLevel() already rendered/updated panels and imported
        // this session's empty history stack — seed it so Ctrl+Z has a baseline.
        this.editor.historyManager.saveState(loadedLevel.objects, new Set(), true, null);

        this._updateParallaxStartPosition();
        this.editor.recentFilesManager?.remember('level', name, json);

        Logger.file.info(`✅ Level loaded: ${loadedLevel.objects.length} objects`);
        Logger.status.success(`Level loaded: ${loadedLevel.objects.length} objects`);
    }

    /**
     * Save the current level
     * @returns {Promise<void>}
     */
    async saveLevel() {
        // Validate Player Start objects
        if (!await this._validatePlayerStart()) {
            return;
        }

        // Per-session fileName, not FileManager.currentFileName (global) — saving level B
        // after saving A once must never silently overwrite A's file. A level that has
        // never been saved has no name to reuse — fall through to the same prompt as
        // Save Level As... rather than silently defaulting to "level.json".
        const session = this.editor.levelsManager.getCurrentSession();
        let fileName = session.fileName;
        if (!fileName) {
            fileName = await prompt('Enter file name:', 'level.json');
            if (!fileName) return;
        }
        session.fileName = this.editor.fileManager.saveLevel(this.editor.level, fileName);
        session.isDirty = false;
        this.editor.stateManager.markClean();
        this.editor.recentFilesManager?.remember('level', session.fileName, this.editor.level.toJSON());
        Logger.file.info('💾 Level saved successfully');
        Logger.status.success('Level saved');
    }

    /**
     * Save the current level with a new filename
     * @returns {Promise<void>}
     */
    async saveLevelAs() {
        // Validate Player Start objects BEFORE prompting for filename
        if (!await this._validatePlayerStart()) {
            return;
        }

        const session = this.editor.levelsManager.getCurrentSession();
        const currentFileName = session.fileName || "level.json";
        const fileName = await prompt("Enter file name:", currentFileName);

        if (!fileName) {
            return;
        }

        session.fileName = this.editor.fileManager.saveLevel(this.editor.level, fileName);
        session.isDirty = false;
        this.editor.stateManager.markClean();
        this.editor.recentFilesManager?.remember('level', session.fileName, this.editor.level.toJSON());
        Logger.file.info(`💾 Level saved as: ${fileName}`);
        Logger.status.success(`Saved as: ${fileName}`);
    }

    /**
     * Import assets from folder
     * @returns {Promise<void>}
     */
    async importAssets() {
        try {
            Logger.file.info('🚀 IMPORT ASSETS STARTED from LevelFileOperations');
            
            // Dynamic import to avoid loading on startup - force cache busting
            const timestamp = Date.now();
            const { AssetImporter } = await import(`../utils/AssetImporter.js?v=${timestamp}`);
            Logger.file.info('✅ AssetImporter imported successfully with cache busting');

            // Create importer instance
            const importer = new AssetImporter(this.editor.assetManager);
            Logger.file.info('✅ AssetImporter instance created');

            // Show folder picker
            Logger.file.info('📂 Showing folder picker...');
            const folderData = await importer.showFolderPicker();
            Logger.file.info(`📁 Folder picker result:`, folderData ? {
                folderName: folderData.folderName,
                filesCount: folderData.files ? folderData.files.length : 0
            } : 'null (user cancelled)');
            
            if (!folderData) {
                Logger.file.warn('❌ User cancelled folder selection');
                return; // User cancelled
            }

            // Import assets
            Logger.file.info(`🔄 Calling importer.importFromFolder with folder: "${folderData.folderName}", files: ${folderData.files.length}`);
            const result = await importer.importFromFolder(folderData.folderName, folderData.files);

            // Show success message
            const message = `Successfully imported ${result.totalImported} assets from ${result.categories.length} categories:\n\n` +
                result.categories.map(cat => `• ${cat.name}: ${cat.importedCount} assets`).join('\n');

            await alert(message);

            // Refresh asset panel and folders panel
            if (this.editor.assetPanel) {
                this.editor.assetPanel.render();
                
                // Explicitly refresh folders panel to ensure nested structure is displayed
                if (this.editor.assetPanel.foldersPanel) {
                    this.editor.assetPanel.foldersPanel.refresh();
                }
            }

            Logger.file.info(`✅ Imported ${result.totalImported} assets from ${result.categories.length} categories`);
            Logger.status.success(`Imported ${result.totalImported} assets (${result.categories.length} categories)`);
        } catch (error) {
            Logger.file.error(`❌ Asset import failed: ${error.message}`);
            Logger.status.error(`Asset import failed: ${error.message}`);
            await alert(`Asset import failed: ${error.message}`);
        }
    }

    /**
     * Update parallax start position to current camera position
     * @private
     */
    _updateParallaxStartPosition() {
        const currentCamera = this.editor.stateManager.get('camera');
        const center = this.editor.renderOperations.parallaxRenderer.getCameraCenter(currentCamera);
        this.editor.stateManager.set('parallax.startPosition', center);
    }

    /**
     * Validate Player Start objects (exactly one required)
     * @private
     * @returns {Promise<boolean>} true if validation passes, false otherwise
     */
    async _validatePlayerStart() {
        const playerStartCount = this.editor.getPlayerStartCount();

        // Check if Player Start is missing
        if (playerStartCount === 0) {
            await alert(
                `Cannot save level!\n\n` +
                `No Player Start object found on the level.\n` +
                `Every level must have exactly one Player Start object.\n\n` +
                `Please add a Player Start object to your level before saving.\n\n` +
                `You can find Player Start objects in the Assets panel under the "Collectibles" category.`
            );
            return false;
        }

        // Check for multiple Player Start objects
        if (playerStartCount > 1) {
            await alert(
                `Cannot save level!\n\n` +
                `Found ${playerStartCount} Player Start objects on the level.\n` +
                `There should be only one Player Start object.\n\n` +
                `Please remove extra Player Start objects before saving the level.`
            );
            return false;
        }

        return true;
    }

    /**
     * Destroy method for cleanup
     */
    destroy() {
        Logger.lifecycle.info('LevelFileOperations module destroyed.');
        // No specific DOM elements or event listeners to clean up here.
    }
}
