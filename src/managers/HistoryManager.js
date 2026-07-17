import { BaseManager } from './BaseManager.js';

/**
 * Undo/Redo history management
 */
export class HistoryManager extends BaseManager {
    constructor(maxSize = 50) {
        super();
        this.undoStack = [];
        this.redoStack = [];
        /** Asset catalog stack (project-global; not per-level — avoids multi-level wipe). */
        this.assetUndoStack = [];
        this.assetRedoStack = [];
        this.maxSize = maxSize;
        this.isRecording = true;
        this.isUndoing = false;
        this.isRedoing = false;
        this.operationFlagTimeout = null;
        /**
         * Optional () => eventGraph|null so every saveState snapshots level.eventGraph
         * without rewriting all call sites (Event Graph UI).
         * @type {null|(() => object|null|undefined)}
         */
        this._eventGraphProvider = null;
        /**
         * Optional () => dialogues[] for level.dialogues snapshots (Dialogue UI).
         * @type {null|(() => Array|undefined)}
         */
        this._dialoguesProvider = null;
        /**
         * Optional () => { items, inventory, npcInventories } for Items/Inventory UI.
         * @type {null|(() => object|undefined)}
         */
        this._inventoryDataProvider = null;
    }

    /**
     * @param {null|(() => object|null|undefined)} provider
     */
    setEventGraphProvider(provider) {
        this._eventGraphProvider = typeof provider === 'function' ? provider : null;
    }

    /**
     * @param {null|(() => Array|undefined)} provider
     */
    setDialoguesProvider(provider) {
        this._dialoguesProvider = typeof provider === 'function' ? provider : null;
    }

    /**
     * @param {null|(() => object|undefined)} provider
     */
    setInventoryDataProvider(provider) {
        this._inventoryDataProvider = typeof provider === 'function' ? provider : null;
    }

    /**
     * @returns {object|null|undefined}
     * @private
     */
    _snapshotEventGraph() {
        if (!this._eventGraphProvider) return undefined;
        try {
            const g = this._eventGraphProvider();
            if (g === undefined) return undefined;
            return g == null ? null : JSON.parse(JSON.stringify(g));
        } catch {
            return null;
        }
    }

    /**
     * @returns {Array|undefined}
     * @private
     */
    _snapshotDialogues() {
        if (!this._dialoguesProvider) return undefined;
        try {
            const d = this._dialoguesProvider();
            if (d === undefined) return undefined;
            return JSON.parse(JSON.stringify(Array.isArray(d) ? d : []));
        } catch {
            return [];
        }
    }

    /**
     * @returns {object|undefined}
     * @private
     */
    _snapshotInventoryData() {
        if (!this._inventoryDataProvider) return undefined;
        try {
            const d = this._inventoryDataProvider();
            if (d === undefined) return undefined;
            return JSON.parse(JSON.stringify(d || {
                items: [],
                inventory: [],
                npcInventories: {}
            }));
        } catch {
            return { items: [], inventory: [], npcInventories: {} };
        }
    }

    /**
     * Save current state to history
     * @param {Array} objects - Level objects array
     * @param {Set} selection - Selected objects set
     * @param {boolean} isInitial - Whether this is initial state
     * @param {Object} groupEditMode - Current group edit mode state (optional)
     */
    saveState(objects, selection = null, isInitial = false, groupEditMode = null) {
        if (!this.isRecording && !isInitial) return;

        // Create state object with objects, selection, and group edit mode
        const stateData = {
            objects: objects,
            selection: selection ? Array.from(selection) : [],
            groupEditMode: groupEditMode ? {
                isActive: groupEditMode.isActive,
                groupId: groupEditMode.group?.id || null,
                openGroupIds: groupEditMode.openGroups?.map(g => g.id) || [],
                frameFrozen: groupEditMode.frameFrozen || false
            } : null
        };

        const eventGraph = this._snapshotEventGraph();
        if (eventGraph !== undefined) {
            stateData.eventGraph = eventGraph;
        }
        const dialogues = this._snapshotDialogues();
        if (dialogues !== undefined) {
            stateData.dialogues = dialogues;
        }
        const inventoryData = this._snapshotInventoryData();
        if (inventoryData !== undefined) {
            stateData.inventoryData = inventoryData;
        }

        const stateSnapshot = JSON.stringify(stateData);
        const lastState = this.undoStack[this.undoStack.length - 1];

        // Don't save if state hasn't changed
        if (!isInitial && stateSnapshot === lastState) return;

        this.undoStack.push(stateSnapshot);

        // Limit stack size
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }

        // Clear redo stack when new action is performed
        if (!isInitial) {
            this.redoStack = [];
        }
    }

    /**
     * Get the current top-of-stack snapshot WITHOUT popping it.
     * Use to revert an in-progress, uncommitted change (e.g. a drag/transform
     * gesture cancelled mid-flight, before its saveState() ever ran) back to
     * the last saved state. Unlike undo(), this doesn't assume the live state
     * was already pushed as a new entry - calling undo() in that situation
     * pops the entry that actually represents "before this gesture" and
     * returns the one before THAT, over-shooting by one step.
     * @returns {Object|null} State object with objects, selection, and groupEditMode
     */
    peekCurrentState() {
        if (this.undoStack.length === 0) return null;

        const parsedState = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        return this._parsedHistoryState(parsedState);
    }

    /**
     * @param {object} parsedState
     * @returns {object}
     * @private
     */
    _parsedHistoryState(parsedState) {
        return {
            objects: parsedState.objects,
            selection: new Set(parsedState.selection || []),
            groupEditMode: parsedState.groupEditMode || null,
            eventGraph: Object.prototype.hasOwnProperty.call(parsedState, 'eventGraph')
                ? parsedState.eventGraph
                : undefined,
            dialogues: Object.prototype.hasOwnProperty.call(parsedState, 'dialogues')
                ? parsedState.dialogues
                : undefined,
            inventoryData: Object.prototype.hasOwnProperty.call(parsedState, 'inventoryData')
                ? parsedState.inventoryData
                : undefined
        };
    }

    /**
     * Undo last action
     * @returns {Object|null} State object with objects, selection, and groupEditMode
     */
    undo() {
        if (this.undoStack.length <= 1) return null;

        this.isUndoing = true;
        this.clearOperationFlagTimeout();
        try {
            const currentState = this.undoStack.pop();
            this.redoStack.push(currentState);

            const previousState = this.undoStack[this.undoStack.length - 1];
            const parsedState = JSON.parse(previousState);

            return this._parsedHistoryState(parsedState);
        } finally {
            // Delay clearing the flag to prevent accidental selection clearing by empty clicks
            this.operationFlagTimeout = setTimeout(() => {
                this.isUndoing = false;
                this.operationFlagTimeout = null;
            }, 100); // 100ms delay
        }
    }

    /**
     * Redo last undone action
     * @returns {Object|null} State object with objects, selection, and groupEditMode
     */
    redo() {
        if (this.redoStack.length === 0) return null;

        this.isRedoing = true;
        this.clearOperationFlagTimeout();
        try {
            const nextState = this.redoStack.pop();
            this.undoStack.push(nextState);

            const parsedState = JSON.parse(nextState);
            return this._parsedHistoryState(parsedState);
        } finally {
            // Delay clearing the flag to prevent accidental selection clearing by empty clicks
            this.operationFlagTimeout = setTimeout(() => {
                this.isRedoing = false;
                this.operationFlagTimeout = null;
            }, 100); // 100ms delay
        }
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 1;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Push asset-catalog snapshot (JSON-serializable array from AssetManager).
     * First call seeds baseline; later calls record edits. Same dedupe as level stack.
     * @param {Array} assetsSnapshot
     * @param {boolean} [isInitial=false]
     */
    saveAssetState(assetsSnapshot, isInitial = false) {
        if (!this.isRecording && !isInitial) return;
        if (assetsSnapshot == null) return;

        const stateSnapshot = JSON.stringify(assetsSnapshot);
        const lastState = this.assetUndoStack[this.assetUndoStack.length - 1];
        if (!isInitial && stateSnapshot === lastState) return;

        this.assetUndoStack.push(stateSnapshot);
        if (this.assetUndoStack.length > this.maxSize) {
            this.assetUndoStack.shift();
        }
        if (!isInitial) {
            this.assetRedoStack = [];
        }
    }

    /**
     * Ensure a baseline exists so the first asset edit can be undone.
     * @param {Array} assetsSnapshot
     */
    ensureAssetBaseline(assetsSnapshot) {
        if (this.assetUndoStack.length === 0 && assetsSnapshot != null) {
            this.saveAssetState(assetsSnapshot, true);
        }
    }

    /**
     * @returns {Array|null} previous assets snapshot
     */
    undoAsset() {
        if (this.assetUndoStack.length <= 1) return null;

        this.isUndoing = true;
        this.clearOperationFlagTimeout();
        try {
            const currentState = this.assetUndoStack.pop();
            this.assetRedoStack.push(currentState);
            return JSON.parse(this.assetUndoStack[this.assetUndoStack.length - 1]);
        } finally {
            this.operationFlagTimeout = setTimeout(() => {
                this.isUndoing = false;
                this.operationFlagTimeout = null;
            }, 100);
        }
    }

    /**
     * @returns {Array|null} next assets snapshot
     */
    redoAsset() {
        if (this.assetRedoStack.length === 0) return null;

        this.isRedoing = true;
        this.clearOperationFlagTimeout();
        try {
            const nextState = this.assetRedoStack.pop();
            this.assetUndoStack.push(nextState);
            return JSON.parse(nextState);
        } finally {
            this.operationFlagTimeout = setTimeout(() => {
                this.isRedoing = false;
                this.operationFlagTimeout = null;
            }, 100);
        }
    }

    canUndoAsset() {
        return this.assetUndoStack.length > 1;
    }

    canRedoAsset() {
        return this.assetRedoStack.length > 0;
    }

    clearAssetHistory() {
        this.assetUndoStack = [];
        this.assetRedoStack = [];
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.clearAssetHistory();
    }

    /**
     * Get history info
     */
    getHistoryInfo() {
        return {
            undoCount: this.undoStack.length - 1,
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }

    /**
     * Temporarily disable recording
     */
    pauseRecording() {
        this.isRecording = false;
    }

    /**
     * Resume recording
     */
    resumeRecording() {
        this.isRecording = true;
    }

    /**
     * Clear operation flag timeout
     */
    clearOperationFlagTimeout() {
        if (this.operationFlagTimeout) {
            clearTimeout(this.operationFlagTimeout);
            this.operationFlagTimeout = null;
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.clearOperationFlagTimeout();
        this.clear();
    }

    /**
     * Snapshot the live undo/redo stacks for storing on a LevelSession while
     * switching away from it (multi-level support).
     * @returns {{undoStack: string[], redoStack: string[]}}
     */
    exportState() {
        return { undoStack: [...this.undoStack], redoStack: [...this.redoStack] };
    }

    /**
     * Restore undo/redo stacks previously captured by exportState(), when
     * switching to a level (multi-level support).
     * @param {{undoStack: string[], redoStack: string[]}|null} snapshot
     */
    importState(snapshot) {
        this.undoStack = snapshot ? [...snapshot.undoStack] : [];
        this.redoStack = snapshot ? [...snapshot.redoStack] : [];
        this.isRecording = true;
        this.isUndoing = false;
        this.isRedoing = false;
        this.clearOperationFlagTimeout();
    }
}
