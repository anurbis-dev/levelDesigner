/**
 * Universal Dialog
 * Replaces browser dialogs (alert, confirm, prompt) with custom styled dialogs
 */
export class UniversalDialog {
    constructor() {
        this.overlay = null;
        this.dialog = null;
        this.resolve = null;
        this.reject = null;
    }

    /**
     * Show alert dialog
     * @param {string} message - Alert message
     * @returns {Promise<void>}
     */
    static async alert(message) {
        const dialog = new UniversalDialog();
        return dialog.showAlert(message);
    }

    /**
     * Show confirm dialog
     * @param {string} message - Confirm message
     * @returns {Promise<boolean>} True if confirmed, false if cancelled
     */
    static async confirm(message) {
        const dialog = new UniversalDialog();
        return dialog.showConfirm(message);
    }

    /**
     * Show prompt dialog
     * @param {string} message - Prompt message
     * @param {string} defaultValue - Default input value
     * @returns {Promise<string|null>} Entered value or null if cancelled
     */
    static async prompt(message, defaultValue = '') {
        const dialog = new UniversalDialog();
        return dialog.showPrompt(message, defaultValue);
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
            this.showDialog();
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
            this.showDialog();
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
            this.showDialog();
        });
    }

    /**
     * Create dialog HTML structure
     * @param {string} type - Dialog type ('alert', 'confirm', 'prompt')
     * @param {string} message - Dialog message
     * @param {string} defaultValue - Default value for prompt
     */
    createDialog(type, message, defaultValue = '') {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'universal-dialog-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;

        // Create dialog container
        this.dialog = document.createElement('div');
        this.dialog.id = 'universal-dialog';
        this.dialog.className = 'mobile-dialog';
        this.dialog.style.cssText = `
            background-color: #1f2937;
            border: 1px solid #374151;
            border-radius: 8px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            min-width: 400px;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Create header
        const header = document.createElement('div');
        header.className = 'dialog-header';
        header.style.cssText = `
            background-color: #111827;
            border-bottom: 1px solid #374151;
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        const title = document.createElement('h2');
        title.className = 'dialog-title';
        title.textContent = this.getTitle(type);
        title.style.cssText = `
            color: #f9fafb;
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dialog-close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--ui-text-color, #9ca3af);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#f9fafb';
            closeBtn.style.backgroundColor = '#374151';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = '#9ca3af';
            closeBtn.style.backgroundColor = 'transparent';
        });
        closeBtn.addEventListener('click', () => this.cancel());

        header.appendChild(title);
        header.appendChild(closeBtn);

        // Create content
        const content = document.createElement('div');
        content.className = 'dialog-content';
        content.style.cssText = `
            padding: 1.5rem;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        `;

        // Message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'dialog-message';
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            color: var(--ui-text-color, #d1d5db);
            font-size: 0.875rem;
            line-height: 1.5;
            white-space: pre-line;
        `;

        content.appendChild(messageDiv);

        // Input for prompt
        let input = null;
        if (type === 'prompt') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = defaultValue;
            input.id = 'universal-dialog-input';
            input.className = 'dialog-input mobile-input';
            input.style.cssText = `
                background-color: #374151;
                border: 1px solid #4b5563;
                border-radius: 4px;
                color: #f9fafb;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                width: 100%;
            `;
            input.addEventListener('focus', () => {
                input.style.borderColor = '#3b82f6';
                input.style.outline = 'none';
            });
            input.addEventListener('blur', () => {
                input.style.borderColor = '#4b5563';
            });
            content.appendChild(input);
        }

        // Create footer
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        footer.style.cssText = `
            background-color: #111827;
            border-top: 1px solid #374151;
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: flex-end;
            gap: 0.5rem;
        `;

        // Buttons based on type
        if (type === 'alert') {
            const okBtn = this.createButton('OK', 'primary', () => this.confirm());
            footer.appendChild(okBtn);
        } else if (type === 'confirm') {
            const cancelBtn = this.createButton('Cancel', 'secondary', () => this.cancel());
            const okBtn = this.createButton('OK', 'primary', () => this.confirm());
            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
        } else if (type === 'prompt') {
            const cancelBtn = this.createButton('Cancel', 'secondary', () => this.cancel());
            const okBtn = this.createButton('OK', 'primary', () => this.confirm(input));
            footer.appendChild(cancelBtn);
            footer.appendChild(okBtn);
        }

        // Assemble dialog
        this.dialog.appendChild(header);
        this.dialog.appendChild(content);
        this.dialog.appendChild(footer);

        this.overlay.appendChild(this.dialog);

        // Store input reference for prompt
        if (input) {
            this.input = input;
        }
    }

    /**
     * Create button element
     * @param {string} text - Button text
     * @param {string} type - Button type ('primary', 'secondary')
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} Button element
     */
    createButton(text, type, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'dialog-btn mobile-button';
        
        if (type === 'primary') {
            button.style.cssText = `
                background-color: #3b82f6;
                border: 1px solid #3b82f6;
                border-radius: 4px;
                color: var(--ui-active-text-color, #ffffff);
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                cursor: pointer;
            `;
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = '#2563eb';
                button.style.borderColor = '#2563eb';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = '#3b82f6';
                button.style.borderColor = '#3b82f6';
            });
        } else {
            button.style.cssText = `
                background-color: #374151;
                border: 1px solid #4b5563;
                border-radius: 4px;
                color: #f9fafb;
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                cursor: pointer;
            `;
            button.addEventListener('mouseenter', () => {
                button.style.backgroundColor = '#4b5563';
            });
            button.addEventListener('mouseleave', () => {
                button.style.backgroundColor = '#374151';
            });
        }

        button.addEventListener('click', onClick);
        return button;
    }

    /**
     * Get dialog title based on type
     * @param {string} type - Dialog type
     * @returns {string} Title text
     */
    getTitle(type) {
        switch (type) {
            case 'alert': return 'Alert';
            case 'confirm': return 'Confirm';
            case 'prompt': return 'Input';
            default: return 'Dialog';
        }
    }

    /**
     * Show the dialog
     */
    showDialog() {
        document.body.appendChild(this.overlay);
        
        // Focus input for prompt
        if (this.input) {
            setTimeout(() => {
                this.input.focus();
                this.input.select();
            }, 100);
        }

        // Handle escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.cancel();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);

        // Handle enter key for prompt
        if (this.input) {
            this.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.confirm(this.input);
                }
            });
        }
    }

    /**
     * Confirm dialog
     * @param {HTMLElement} input - Input element for prompt
     */
    confirm(input = null) {
        let result = true;
        if (input) {
            result = input.value.trim();
        }
        this.close();
        this.resolve(result);
    }

    /**
     * Cancel dialog
     */
    cancel() {
        this.close();
        this.resolve(null);
    }

    /**
     * Close the dialog
     */
    close() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
    }
}
