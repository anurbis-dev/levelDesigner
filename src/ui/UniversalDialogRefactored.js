/**
 * Universal Dialog (Refactored)
 * 
 * Refactored version using BaseDialog for consistent behavior and styling.
 * Replaces browser dialogs (alert, confirm, prompt) with custom styled dialogs.
 * 
 * @author Level Designer
 * @version 3.52.1
 */

import { BaseDialog } from './BaseDialog.js';
import { getDialogStructure } from './panel-structures/DialogStructures.js';
import { Logger } from '../utils/Logger.js';

export class UniversalDialogRefactored {
    constructor() {
        this.currentDialog = null;
        this.resolve = null;
        this.reject = null;
    }

    /**
     * Show alert dialog
     * @param {string} message - Alert message
     * @returns {Promise<void>}
     */
    async showAlert(message) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.createDialog('alert', message);
        });
    }

    /**
     * Show confirm dialog
     * @param {string} message - Confirm message
     * @returns {Promise<boolean>}
     */
    async showConfirm(message) {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.createDialog('confirm', message);
        });
    }

    /**
     * Show prompt dialog
     * @param {string} message - Prompt message
     * @param {string} defaultValue - Default input value
     * @returns {Promise<string|null>}
     */
    async showPrompt(message, defaultValue = '') {
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
            this.createDialog('prompt', message, defaultValue);
        });
    }

    /**
     * Create dialog using BaseDialog
     * @param {string} type - Dialog type ('alert', 'confirm', 'prompt')
     * @param {string} message - Dialog message
     * @param {string} defaultValue - Default value for prompt
     */
    createDialog(type, message, defaultValue = '') {
        // Get base structure and customize it
        const structure = getDialogStructure('universal');
        const config = {
            ...structure,
            id: 'universal-dialog',
            title: this.getTitle(type),
            contentRenderer: () => this.renderContent(type, message, defaultValue),
            footerButtons: this.getFooterButtons(type),
            onConfirm: () => this.handleConfirm(type, defaultValue),
            onCancel: () => this.handleCancel(type)
        };

        // Create dialog using BaseDialog
        this.currentDialog = new BaseDialog(config);
        this.currentDialog.show();
    }

    /**
     * Get dialog title based on type
     * @param {string} type - Dialog type
     * @returns {string} - Dialog title
     */
    getTitle(type) {
        const titles = {
            'alert': 'Alert',
            'confirm': 'Confirm',
            'prompt': 'Prompt'
        };
        return titles[type] || 'Dialog';
    }

    /**
     * Render dialog content
     * @param {string} type - Dialog type
     * @param {string} message - Dialog message
     * @param {string} defaultValue - Default value for prompt
     * @returns {string} - HTML content
     */
    renderContent(type, message, defaultValue) {
        let content = `
            <div class="dialog-message" style="
                color: var(--ui-text-color, #d1d5db);
                font-size: 0.875rem;
                line-height: 1.5;
                white-space: pre-line;
                margin-bottom: 1rem;
            ">${message}</div>
        `;

        if (type === 'prompt') {
            content += `
                <input type="text" id="universal-dialog-input" class="dialog-input mobile-input" 
                       value="${defaultValue}" style="
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid #4b5563;
                    border-radius: 0.375rem;
                    background-color: #374151;
                    color: #f9fafb;
                    font-size: 0.875rem;
                    transition: border-color 0.2s, background-color 0.2s;
                " placeholder="Enter value...">
            `;
        }

        return content;
    }

    /**
     * Get footer buttons based on dialog type
     * @param {string} type - Dialog type
     * @returns {Array} - Footer buttons configuration
     */
    getFooterButtons(type) {
        if (type === 'alert') {
            return [
                {
                    id: 'ok',
                    text: 'OK',
                    class: 'dialog-btn-confirm',
                    backgroundColor: '#2563eb',
                    textColor: 'white'
                }
            ];
        } else if (type === 'confirm') {
            return [
                {
                    id: 'cancel',
                    text: 'Cancel',
                    class: 'dialog-btn-cancel',
                    backgroundColor: '#6b7280',
                    textColor: 'white'
                },
                {
                    id: 'confirm',
                    text: 'OK',
                    class: 'dialog-btn-confirm',
                    backgroundColor: '#2563eb',
                    textColor: 'white'
                }
            ];
        } else if (type === 'prompt') {
            return [
                {
                    id: 'cancel',
                    text: 'Cancel',
                    class: 'dialog-btn-cancel',
                    backgroundColor: '#6b7280',
                    textColor: 'white'
                },
                {
                    id: 'confirm',
                    text: 'OK',
                    class: 'dialog-btn-confirm',
                    backgroundColor: '#2563eb',
                    textColor: 'white'
                }
            ];
        }

        return [];
    }

    /**
     * Handle confirm action
     * @param {string} type - Dialog type
     * @param {string} defaultValue - Default value for prompt
     */
    handleConfirm(type, defaultValue) {
        if (type === 'alert') {
            this.resolve();
        } else if (type === 'confirm') {
            this.resolve(true);
        } else if (type === 'prompt') {
            const input = document.getElementById('universal-dialog-input');
            const value = input ? input.value : defaultValue;
            this.resolve(value);
        }
        
        this.cleanup();
    }

    /**
     * Handle cancel action
     * @param {string} type - Dialog type
     */
    handleCancel(type) {
        if (type === 'confirm') {
            this.resolve(false);
        } else if (type === 'prompt') {
            this.resolve(null);
        } else {
            this.reject(new Error('Dialog cancelled'));
        }
        
        this.cleanup();
    }

    /**
     * Cleanup dialog
     */
    cleanup() {
        if (this.currentDialog) {
            this.currentDialog.destroy();
            this.currentDialog = null;
        }
        this.resolve = null;
        this.reject = null;
    }
}

// Export singleton instance
export const universalDialogRefactored = new UniversalDialogRefactored();
