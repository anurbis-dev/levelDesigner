/**
 * Dialog Replacer
 * Replaces browser dialogs with custom styled dialogs
 *
 * The window.alert/confirm/prompt reassignment below is the ONE intentionally-kept
 * global-state mutation in the project (intentional DialogReplacer exception) — it's
 * the whole point of this class: monkey-patching the native dialog globals IS the feature,
 * not incidental global state to encapsulate. Every other window.* write found during the
 * Фаза 2 audit (panel-drag state in PanelPositionManager.js) was an accidental global and
 * got moved to instance fields; don't treat this file as precedent for adding more.
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
