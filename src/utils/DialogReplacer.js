/**
 * Dialog Replacer
 * Replaces browser dialogs with custom styled dialogs
 */
import { UniversalDialog } from '../ui/UniversalDialog.js';

export class DialogReplacer {
    constructor() {
        this.originalAlert = window.alert;
        this.originalConfirm = window.confirm;
        this.originalPrompt = window.prompt;
        this.isReplaced = false;
    }

    /**
     * Replace browser dialogs with custom ones
     */
    replace() {
        if (this.isReplaced) return;

        // Replace alert
        window.alert = async (message) => {
            await UniversalDialog.alert(message);
        };

        // Replace confirm
        window.confirm = async (message) => {
            return await UniversalDialog.confirm(message);
        };

        // Replace prompt
        window.prompt = async (message, defaultValue = '') => {
            return await UniversalDialog.prompt(message, defaultValue);
        };

        this.isReplaced = true;
    }

    /**
     * Restore original browser dialogs
     */
    restore() {
        if (!this.isReplaced) return;

        window.alert = this.originalAlert;
        window.confirm = this.originalConfirm;
        window.prompt = this.originalPrompt;

        this.isReplaced = false;
    }

    /**
     * Check if dialogs are replaced
     * @returns {boolean} True if replaced
     */
    isDialogReplaced() {
        return this.isReplaced;
    }
}

// Global instance
export const dialogReplacer = new DialogReplacer();
