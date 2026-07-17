import { GameObject } from '../models/GameObject.js';
import { Group } from '../models/Group.js';
import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { paintAssetEditorPreviews } from '../ui/asset-editor/AssetEditorContext.js';

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
     * Prefer asset-catalog undo while Asset Editor is open (project-global stack).
     * @returns {boolean}
     */
    undo() {
        const editingAsset = !!this.editor.stateManager?.get('editingAssetId');
        if (editingAsset && this.editor.historyManager.canUndoAsset()) {
            return this.undoAsset();
        }
        const previousState = this.editor.historyManager.undo();
        if (!previousState) {
            // Fallback: asset undo even if editor closed (still useful after edits)
            if (this.editor.historyManager.canUndoAsset()) {
                return this.undoAsset();
            }
            Logger.status.info('Nothing to undo');
            return false;
        }

        this._applyRestoredState(previousState);
        Logger.status.info('Undo');
        return true;
    }

    /**
     * @returns {boolean}
     */
    redo() {
        const editingAsset = !!this.editor.stateManager?.get('editingAssetId');
        if (editingAsset && this.editor.historyManager.canRedoAsset()) {
            return this.redoAsset();
        }
        const nextState = this.editor.historyManager.redo();
        if (!nextState) {
            if (this.editor.historyManager.canRedoAsset()) {
                return this.redoAsset();
            }
            Logger.status.info('Nothing to redo');
            return false;
        }

        this._applyRestoredState(nextState);
        Logger.status.info('Redo');
        return true;
    }

    /**
     * @returns {boolean}
     */
    undoAsset() {
        const previous = this.editor.historyManager.undoAsset();
        if (!previous) {
            Logger.status.info('Nothing to undo (assets)');
            return false;
        }
        this._applyRestoredAssets(previous);
        Logger.status.info('Undo (assets)');
        return true;
    }

    /**
     * @returns {boolean}
     */
    redoAsset() {
        const next = this.editor.historyManager.redoAsset();
        if (!next) {
            Logger.status.info('Nothing to redo (assets)');
            return false;
        }
        this._applyRestoredAssets(next);
        Logger.status.info('Redo (assets)');
        return true;
    }

    /**
     * @param {Array} assetsSnapshot
     * @private
     */
    _applyRestoredAssets(assetsSnapshot) {
        this.editor.assetManager?.restoreFromHistory?.(assetsSnapshot);
        paintAssetEditorPreviews(this.editor);
        this.editor.updateAllPanels?.();
    }

    /**
     * Revert an in-progress, uncommitted gesture (drag/transform cancelled by
     * releasing the mouse outside the canvas, or by window blur) back to the
     * last saved history snapshot. Unlike undo(), this does NOT pop the
     * undo/redo stacks - the gesture never pushed a new entry for its live
     * (dragged) state in the first place, so undo() would over-shoot and
     * restore the state before the PREVIOUS action instead of this one.
     * @returns {boolean} True if a snapshot existed to restore
     */
    cancelToLastSavedState() {
        const state = this.editor.historyManager.peekCurrentState();
        if (!state) return false;

        this._applyRestoredState(state);
        return true;
    }

    /**
     * Shared restore pipeline used by undo(), redo() and cancelToLastSavedState()
     * @private
     */
    _applyRestoredState(state) {
        this.restoreObjectsFromHistory(state.objects);
        this.rebuildAllIndices();
        this.restoreGroupEditMode(state.groupEditMode);
        this.recalculateGroupBounds();
        this.invalidateCachesAfterRestore();
        this.restoreSelection(state.selection);
        this.restoreEventGraphFromHistory(state.eventGraph);
        this.finalizeHistoryRestore();
    }

    /**
     * Restore level.eventGraph from history (undefined = legacy snapshot, leave as-is).
     * @param {object|null|undefined} eventGraph
     */
    restoreEventGraphFromHistory(eventGraph) {
        if (eventGraph === undefined || !this.editor.level) return;
        this.editor.level.eventGraph = eventGraph == null
            ? null
            : JSON.parse(JSON.stringify(eventGraph));
        this.editor.stateManager?.set?.(
            'eventGraphRevision',
            (this.editor.stateManager.get('eventGraphRevision') || 0) + 1
        );
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
            this.editor.renderOperations.markSpatialIndexDirty();
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
