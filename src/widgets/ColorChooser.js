/**
 * Color Chooser Widget
 * Reusable color picker component for UI elements
 */
export class ColorChooser {
    constructor(options = {}) {
        this.options = {
            initialColor: '#3B82F6',
            onColorChange: null,
            onCancel: null,
            showCancel: true,
            showApply: true,
            applyText: 'Apply',
            cancelText: 'Cancel',
            label: 'Color',
            ...options
        };
    }

    /**
     * Create color picker element
     */
    createElement() {
        const container = document.createElement('div');
        container.className = 'color-chooser-container';
        
        container.innerHTML = `
            <div class="mb-4">
                <label class="block text-sm text-gray-300 mb-2">${this.options.label}</label>
                <input type="color" 
                       class="color-picker-input w-full h-10 rounded border border-gray-600 bg-gray-700 cursor-pointer"
                       value="${this.options.initialColor}"
                       style="border: 1px solid #4b5563; background: #374151;">
            </div>
            ${this.options.showCancel || this.options.showApply ? `
                <div class="flex justify-end space-x-2">
                    ${this.options.showCancel ? `
                        <button class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 color-chooser-cancel">
                            ${this.options.cancelText}
                        </button>
                    ` : ''}
                    ${this.options.showApply ? `
                        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 color-chooser-apply">
                            ${this.options.applyText}
                        </button>
                    ` : ''}
                </div>
            ` : ''}
        `;

        this.setupEventListeners(container);
        return container;
    }

    /**
     * Create inline color picker (no buttons)
     */
    createInlineElement() {
        const container = document.createElement('div');
        container.className = 'color-chooser-inline';
        
        container.innerHTML = `
            <input type="color" 
                   class="color-picker-input w-full h-8 rounded border border-gray-600 bg-gray-700 cursor-pointer"
                   value="${this.options.initialColor}"
                   style="border: 1px solid #4b5563; background: #374151;">
        `;

        this.setupInlineEventListeners(container);
        return container;
    }

    /**
     * Setup event listeners for full color chooser
     */
    setupEventListeners(container) {
        const colorPicker = container.querySelector('.color-picker-input');
        const applyBtn = container.querySelector('.color-chooser-apply');
        const cancelBtn = container.querySelector('.color-chooser-cancel');

        if (colorPicker) {
            // Apply on Enter key
            colorPicker.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && applyBtn) {
                    applyBtn.click();
                }
            });

            // Auto-apply on change if no apply button
            if (!applyBtn) {
                colorPicker.addEventListener('change', () => {
                    if (this.options.onColorChange) {
                        this.options.onColorChange(colorPicker.value);
                    }
                });
            }
        }

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (this.options.onColorChange) {
                    this.options.onColorChange(colorPicker.value);
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (this.options.onCancel) {
                    this.options.onCancel();
                }
            });
        }
    }

    /**
     * Setup event listeners for inline color chooser
     */
    setupInlineEventListeners(container) {
        const colorPicker = container.querySelector('.color-picker-input');

        if (colorPicker) {
            colorPicker.addEventListener('change', () => {
                if (this.options.onColorChange) {
                    this.options.onColorChange(colorPicker.value);
                }
            });
        }
    }

    /**
     * Get current color value
     */
    getValue() {
        const colorPicker = this.container?.querySelector('.color-picker-input');
        return colorPicker ? colorPicker.value : this.options.initialColor;
    }

    /**
     * Set color value
     */
    setValue(color) {
        const colorPicker = this.container?.querySelector('.color-picker-input');
        if (colorPicker) {
            colorPicker.value = color;
        }
    }

    /**
     * Show color chooser in modal
     */
    showModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
                <h3 class="text-lg font-bold text-white mb-4">Choose Color</h3>
                <div id="color-chooser-content"></div>
            </div>
        `;

        const content = modal.querySelector('#color-chooser-content');
        this.container = this.createElement();
        content.appendChild(this.container);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Create color chooser for specific use case
     */
    static forSettings(initialColor, onColorChange) {
        return new ColorChooser({
            initialColor,
            onColorChange,
            showCancel: false,
            showApply: false,
            label: 'Color'
        });
    }

    /**
     * Create color chooser for layers
     */
    static forLayers(initialColor, onColorChange, onCancel) {
        return new ColorChooser({
            initialColor,
            onColorChange,
            onCancel,
            showCancel: true,
            showApply: true,
            applyText: 'Apply',
            cancelText: 'Cancel',
            label: 'Layer Color'
        });
    }
}
