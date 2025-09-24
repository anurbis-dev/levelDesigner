import { Logger } from './Logger.js';

/**
 * CommandAvailability - Utility for checking command availability based on editor context
 *
 * This utility provides centralized logic for determining which commands should be
 * available/active based on the current state of the level editor.
 *
 * Features:
 * - Selection-based command availability
 * - Clipboard operations support detection
 * - Group operations logic
 * - History operations (undo/redo) availability
 *
 * Usage:
 * ```javascript
 * const availability = CommandAvailability.check('duplicate', levelEditor);
 * if (availability) {
 *     // Command is available
 * }
 * ```
 *
 * @author Level Designer
 * @version dynamic
 */
export class CommandAvailability {

    /**
     * Check if a command is available in the current context
     * @param {string} command - Command name to check
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether the command is available
     */
    static check(command, levelEditor) {
        if (!levelEditor) {
            Logger.utils.warn('CommandAvailability.check: levelEditor is null');
            return false;
        }

        const context = this.getContext(levelEditor);

        switch (command) {
            // Object operations
            case 'copy':
            case 'cut':
            case 'duplicate':
            case 'delete':
            case 'deleteSelected':
                return context.hasSelection;

            case 'paste':
                return this.canPaste();

            // Group operations
            case 'groupSelected':
                return context.hasMultipleSelection;

            case 'ungroupSelected':
                return context.hasSelection && context.isGroup;

            // History operations
            case 'undo':
                return this.canUndo(levelEditor);

            case 'redo':
                return this.canRedo(levelEditor);

            // View operations
            case 'toggleGrid':
            case 'toggleSnapToGrid':
            case 'toggleParallax':
            case 'toggleObjectBoundaries':
            case 'toggleObjectCollisions':
                return true;

            case 'focusSelection':
                return context.hasSelection;

            case 'focusAll':
                return true;

            // File operations
            case 'newLevel':
            case 'openLevel':
            case 'saveLevel':
                return true;

            default:
                Logger.utils.warn(`CommandAvailability.check: Unknown command "${command}"`);
                return false;
        }
    }

    /**
     * Get current editor context for command availability checks
     * @param {Object} levelEditor - Level editor instance
     * @returns {Object} - Context object with selection info
     */
    static getContext(levelEditor) {
        return {
            hasSelection: this.hasSelectedObjects(levelEditor),
            hasMultipleSelection: this.hasMultipleSelectedObjects(levelEditor),
            isGroup: this.isSelectedObjectGroup(levelEditor)
        };
    }

    /**
     * Check if there are any selected objects
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether there are selected objects
     */
    static hasSelectedObjects(levelEditor) {
        if (!levelEditor?.stateManager) return false;

        const selectedObjects = levelEditor.stateManager.get('selectedObjects');
        return selectedObjects && selectedObjects.size > 0;
    }

    /**
     * Check if there are at least 2 selected objects (for Group operation)
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether there are 2 or more selected objects
     */
    static hasMultipleSelectedObjects(levelEditor) {
        if (!levelEditor?.stateManager) return false;

        const selectedObjects = levelEditor.stateManager.get('selectedObjects');
        return selectedObjects && selectedObjects.size >= 2;
    }

    /**
     * Check if any of the selected objects is a group
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether any selected object is a group
     */
    static isSelectedObjectGroup(levelEditor) {
        if (!levelEditor?.stateManager || !levelEditor?.level) return false;

        const selectedObjects = levelEditor.stateManager.get('selectedObjects');
        if (!selectedObjects || selectedObjects.size === 0) {
            return false;
        }

        // Check if any selected object is a group
        for (const selectedId of selectedObjects) {
            const object = levelEditor.level.findObjectById(selectedId);
            if (object && object.type === 'group') {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if paste operation is available
     * @returns {boolean} - Whether paste is available
     */
    static canPaste() {
        return navigator.clipboard && window.isSecureContext;
    }

    /**
     * Check if undo operation is available
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether undo is available
     */
    static canUndo(levelEditor) {
        return levelEditor?.historyManager?.canUndo() || false;
    }

    /**
     * Check if redo operation is available
     * @param {Object} levelEditor - Level editor instance
     * @returns {boolean} - Whether redo is available
     */
    static canRedo(levelEditor) {
        return levelEditor?.historyManager?.canRedo() || false;
    }

    /**
     * Get all available commands in current context
     * @param {Object} levelEditor - Level editor instance
     * @returns {Array<string>} - Array of available command names
     */
    static getAvailableCommands(levelEditor) {
        const commands = [
            'copy', 'cut', 'paste', 'duplicate', 'delete', 'deleteSelected',
            'groupSelected', 'ungroupSelected',
            'undo', 'redo',
            'toggleGrid', 'toggleSnapToGrid', 'toggleParallax',
            'toggleObjectBoundaries', 'toggleObjectCollisions',
            'focusSelection', 'focusAll',
            'newLevel', 'openLevel', 'saveLevel'
        ];

        return commands.filter(command => this.check(command, levelEditor));
    }

    /**
     * Get command availability status for multiple commands
     * @param {Array<string>} commands - Array of command names
     * @param {Object} levelEditor - Level editor instance
     * @returns {Object} - Object with command names as keys and availability as values
     */
    static getCommandsStatus(commands, levelEditor) {
        const status = {};
        commands.forEach(command => {
            status[command] = this.check(command, levelEditor);
        });
        return status;
    }
}
