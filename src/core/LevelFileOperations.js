import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

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
     * Create a new level
     * @returns {Promise<void>}
     */
    async newLevel() {
        // Check for unsaved changes
        if (this.editor.stateManager.get('isDirty')) {
            const confirmed = await confirm("You have unsaved changes. Are you sure you want to create a new level?");
            if (!confirmed) {
                return;
            }
        }

        Logger.file.info('Creating new level...');

        // Save current view states before resetting
        const savedViewStates = this.editor.eventHandlers.saveViewStates();

        // Create new level
        this.editor.level = this.editor.fileManager.createNewLevel();
        this.editor.stateManager.reset();

        // Re-initialize group edit mode state after reset
        this._initializeGroupEditMode();

        // Apply saved view states after reset
        this.editor.eventHandlers.applySavedViewStates(savedViewStates);

        // Auto-set parallax start position to current camera position
        this._updateParallaxStartPosition();

        // Update cached level statistics
        this.editor.updateCachedLevelStats();

        // Initialize current layer to Main layer
        this.editor.setCurrentLayer(this.editor.level.getMainLayerId());

        // Initialize history
        this._initializeHistory();

        // Render and update UI
        this.editor.render();
        this.editor.updateAllPanels();

        Logger.file.info('✅ New level created');
    }

    /**
     * Open an existing level from file
     * @returns {Promise<void>}
     */
    async openLevel() {
        // Check for unsaved changes
        if (this.editor.stateManager.get('isDirty')) {
            const confirmed = await confirm("You have unsaved changes. Are you sure you want to open a new level?");
            if (!confirmed) {
                return;
            }
        }

        try {
            Logger.file.info('📂 Opening level...');

            // Save current view states before resetting
            const savedViewStates = this.editor.eventHandlers.saveViewStates();

            // Load level from file
            this.editor.level = await this.editor.fileManager.loadLevelFromFileInput();
            this.editor.stateManager.reset();

            // Re-initialize group edit mode state after reset
            this._initializeGroupEditMode();

            // Apply saved view states after reset
            this.editor.eventHandlers.applySavedViewStates(savedViewStates);

            // Auto-set parallax start position to current camera position
            this._updateParallaxStartPosition();

            // Update cached level statistics
            this.editor.updateCachedLevelStats();

            // Initialize current layer to Main layer
            this.editor.setCurrentLayer(this.editor.level.getMainLayerId());

            // Clear selection and initialize history
            this.editor.stateManager.set('selectedObjects', new Set());
            this._initializeHistory();

            // Render and update UI
            this.editor.render();
            this.editor.updateAllPanels();

            Logger.file.info(`✅ Level loaded: ${this.editor.level.objects.length} objects`);
        } catch (error) {
            Logger.file.error(`❌ Failed to load level: ${error.message}`);
            await alert("Error loading level: " + error.message);
        }
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

        this.editor.fileManager.saveLevel(this.editor.level);
        this.editor.stateManager.markClean();
        Logger.file.info('💾 Level saved successfully');
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

        const currentFileName = this.editor.fileManager.getCurrentFileName() || "level.json";
        const fileName = await prompt("Enter file name:", currentFileName);
        
        if (!fileName) {
            return;
        }

        this.editor.fileManager.saveLevel(this.editor.level, fileName);
        this.editor.stateManager.markClean();
        Logger.file.info(`💾 Level saved as: ${fileName}`);
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
        } catch (error) {
            Logger.file.error(`❌ Asset import failed: ${error.message}`);
            await alert(`Asset import failed: ${error.message}`);
        }
    }

    /**
     * Initialize group edit mode state
     * @private
     */
    _initializeGroupEditMode() {
        this.editor.stateManager.set('groupEditMode', {
            isActive: false,
            groupId: null,
            group: null,
            openGroups: []
        });
    }

    /**
     * Update parallax start position to current camera position
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
     * Initialize history with current state
     * @private
     */
    _initializeHistory() {
        this.editor.historyManager.clear();
        this.editor.historyManager.saveState(
            this.editor.level.objects,
            this.editor.stateManager.get('selectedObjects'),
            true,
            this.editor.stateManager.get('groupEditMode')
        );
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
