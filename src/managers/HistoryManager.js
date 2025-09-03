/**
 * Undo/Redo history management
 */
export class HistoryManager {
    constructor(maxSize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = maxSize;
        this.isRecording = true;
    }

    /**
     * Save current state to history
     */
    saveState(state, isInitial = false) {
        if (!this.isRecording && !isInitial) return;
        
        const stateSnapshot = JSON.stringify(state);
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
     */
    undo() {
        if (this.undoStack.length <= 1) return null;
        
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);
        
        const previousState = this.undoStack[this.undoStack.length - 1];
        return JSON.parse(previousState);
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return null;
        
        const nextState = this.redoStack.pop();
        this.undoStack.push(nextState);
        
        return JSON.parse(nextState);
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
}
