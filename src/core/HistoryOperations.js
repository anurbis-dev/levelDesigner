import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';

/**
 * HistoryOperations - handles undo/redo logic
 * Centralizes all history restoration operations
 * @extends BaseModule
 * @version 3.40.0
 */
export class HistoryOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('HistoryOperations initialized');
    }

    /**
     * Execute undo operation
     * @returns {boolean} True if undo was successful
     */
    undo() {
        const previousState = this.editor.historyManager.undo();
        if (!previousState) return false;
        
        this.restoreObjectsFromHistory(previousState.objects);
        this.rebuildAllIndices();
        this.restoreGroupEditMode(previousState.groupEditMode);
        this.recalculateGroupBounds();
        this.invalidateCachesAfterRestore();
        this.restoreSelection(previousState.selection);
        this.finalizeHistoryRestore();
        
        return true;
    }

    /**
     * Execute redo operation
     * @returns {boolean} True if redo was successful
     */
    redo() {
        const nextState = this.editor.historyManager.redo();
        if (!nextState) return false;
        
        this.restoreObjectsFromHistory(nextState.objects);
        this.rebuildAllIndices();
        this.restoreGroupEditMode(nextState.groupEditMode);
        this.recalculateGroupBounds();
        this.invalidateCachesAfterRestore();
        this.restoreSelection(nextState.selection);
        this.finalizeHistoryRestore();
        
        return true;
    }

    /**
     * Restore objects from history (deserialize from JSON)
     * @param {Array} objectsData - Serialized objects data
     */
    restoreObjectsFromHistory(objectsData) {
        this.editor.level.objects = objectsData.map(objData => {
            if (objData.type === 'group') {
                return Group.fromJSON(objData);
            } else {
                return GameObject.fromJSON(objData);
            }
        });
    }

    /**
     * Rebuild all indices after restore
     */
    rebuildAllIndices() {
        this.editor.level.buildObjectsIndex();
        this.editor.level.rebuildLayerCountsCache();
        
        if (this.editor.renderOperations) {
            this.editor.renderOperations.buildSpatialIndex();
        }
    }

    /**
     * Restore group edit mode from saved state
     * @param {Object|null} savedGroupEditMode - Saved group edit mode state
     */
    restoreGroupEditMode(savedGroupEditMode) {
        this.editor.updateGroupEditModeAfterRestore(savedGroupEditMode);
    }

    /**
     * Recalculate group bounds for active group if in group edit mode
     */
    recalculateGroupBounds() {
        const groupEditMode = this.editor.stateManager.get('groupEditMode');
        if (groupEditMode && groupEditMode.isActive && groupEditMode.group) {
            const freshBounds = this.editor.objectOperations.getObjectWorldBounds(groupEditMode.group);
            
            const updatedState = this.editor.stateManager.get('groupEditMode');
            if (updatedState.frameFrozen === false) {
                updatedState.frozenBounds = freshBounds;
                this.editor.stateManager.set('groupEditMode', updatedState);
            }
        }
    }

    /**
     * Invalidate caches after restore
     */
    invalidateCachesAfterRestore() {
        const allRestoredObjectIds = new Set(this.editor.level.objects.map(obj => obj.id));
        this.editor.smartCacheInvalidation({
            objectIds: allRestoredObjectIds,
            invalidateAll: true,
            reason: 'history_restore'
        });
        
        this.editor.objectOperations.computeSelectableSet();
        this.editor.clearSelectableObjectsCache();
        this.editor.getSelectableObjectsInViewport();
    }

    /**
     * Restore selection from history
     * @param {Set|Array} selectionData - Selection data from history
     */
    restoreSelection(selectionData) {
        const validSelection = new Set();
        const objectIds = new Set(this.editor.level.objects.map(obj => obj.id));
        
        // Filter selection to only include objects that actually exist
        selectionData.forEach(id => {
            if (objectIds.has(id)) {
                validSelection.add(id);
            }
        });
        
        this.editor.stateManager.set('selectedObjects', validSelection);
    }

    /**
     * Finalize undo/redo operation (render, update panels)
     */
    finalizeHistoryRestore() {
        this.editor.render();
        this.editor.updateAllPanels();
        // Note: Don't call markDirty() after undo/redo - we're restoring previous state
    }

    /**
     * Cleanup method
     */
    destroy() {
        Logger.lifecycle.info('HistoryOperations destroyed');
    }
}
