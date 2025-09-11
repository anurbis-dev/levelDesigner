/**
 * Undo/Redo history management
 */
export class HistoryManager {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
        this.isRecording = true;
        this.isUndoing = false;
        this.isRedoing = false;
        this.operationFlagTimeout = null;
    }

    /**
     * Save current state to history
     * @param {Array} objects - Level objects array
     * @param {Set} selection - Selected objects set
     * @param {boolean} isInitial - Whether this is initial state
     */
    saveState(objects, selection = null, isInitial = false) {
        if (!this.isRecording && !isInitial) return;

        // Create state object with objects and selection
        const stateData = {
            objects: objects,
            selection: selection ? Array.from(selection) : []
        };

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
     * Undo last action
     * @returns {Object|null} State object with objects and selection arrays
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

            // Convert selection array back to Set
            return {
                objects: parsedState.objects,
                selection: new Set(parsedState.selection || [])
            };
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
     * @returns {Object|null} State object with objects and selection arrays
     */
    redo() {
        if (this.redoStack.length === 0) return null;

        this.isRedoing = true;
        this.clearOperationFlagTimeout();
        try {
            const nextState = this.redoStack.pop();
            this.undoStack.push(nextState);

            const parsedState = JSON.parse(nextState);

            // Convert selection array back to Set
            return {
                objects: parsedState.objects,
                selection: new Set(parsedState.selection || [])
            };
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
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
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
}
