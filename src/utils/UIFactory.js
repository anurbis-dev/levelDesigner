/**
 * Factory for creating common UI elements
 * Eliminates CSS class duplication and provides consistent styling
 */
export class UIFactory {
    /**
     * Common CSS class configurations
     */
    static CSS = {
        input: 'mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm',
        inputLabel: 'block text-sm font-medium text-gray-300',
        button: 'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500',
        buttonSecondary: 'px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500',
        buttonDanger: 'px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500',
        container: 'mb-3',
        panel: 'bg-gray-800 border border-gray-700 rounded-lg p-4',
        tab: 'px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:bg-gray-700',
        tabActive: 'px-4 py-2 text-sm font-medium border-b-2 border-blue-500 bg-gray-700 text-blue-400'
    };

    /**
     * Create a labeled input field
     * @param {Object} options - Configuration options
     * @param {string} options.label - Label text
     * @param {string} options.type - Input type (default: 'text')
     * @param {string} options.value - Input value
     * @param {string} options.placeholder - Placeholder text
     * @param {Function} options.onChange - Change event handler
     * @param {string} options.id - Input ID
     * @param {boolean} options.disabled - Whether input is disabled
     * @returns {HTMLElement} Container element with label and input
     */
    static createLabeledInput(options = {}) {
        const {
            label,
            type = 'text',
            value = '',
            placeholder = '',
            onChange = null,
            id = null,
            disabled = false
        } = options;

        const container = document.createElement('div');
        container.className = this.CSS.container;

        if (label) {
            const labelElement = document.createElement('label');
            labelElement.className = this.CSS.inputLabel;
            labelElement.textContent = label;
            if (id) labelElement.setAttribute('for', id);
            container.appendChild(labelElement);
        }

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.placeholder = placeholder;
        input.className = this.CSS.input;
        input.disabled = disabled;
        
        if (id) input.id = id;
        
        if (onChange) {
            input.addEventListener('change', onChange);
        }

        container.appendChild(input);
        return container;
    }

    /**
     * Create a simple input without label
     * @param {Object} options - Configuration options  
     * @returns {HTMLInputElement} Input element
     */
    static createInput(options = {}) {
        const {
            type = 'text',
            value = '',
            placeholder = '',
            onChange = null,
            id = null,
            disabled = false
        } = options;

        const input = document.createElement('input');
        input.type = type;
        input.value = value;
        input.placeholder = placeholder;
        input.className = this.CSS.input;
        input.disabled = disabled;
        
        if (id) input.id = id;
        if (onChange) input.addEventListener('change', onChange);

        return input;
    }

    /**
     * Create a button element
     * @param {Object} options - Configuration options
     * @param {string} options.text - Button text
     * @param {Function} options.onClick - Click event handler
     * @param {string} options.variant - Button variant ('primary', 'secondary', 'danger')
     * @param {string} options.id - Button ID
     * @param {boolean} options.disabled - Whether button is disabled
     * @returns {HTMLButtonElement} Button element
     */
    static createButton(options = {}) {
        const {
            text = '',
            onClick = null,
            variant = 'primary',
            id = null,
            disabled = false
        } = options;

        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        
        // Set CSS class based on variant
        switch (variant) {
            case 'secondary':
                button.className = this.CSS.buttonSecondary;
                break;
            case 'danger':
                button.className = this.CSS.buttonDanger;
                break;
            default:
                button.className = this.CSS.button;
        }

        if (id) button.id = id;
        if (onClick) button.addEventListener('click', onClick);

        return button;
    }

    /**
     * Create a property editor container
     * @param {Object} obj - Object to edit
     * @param {Array} properties - Property names to create editors for
     * @param {Function} onPropertyChange - Callback when property changes
     * @returns {DocumentFragment} Fragment with property editors
     */
    static createPropertyEditor(obj, properties, onPropertyChange) {
        const fragment = document.createDocumentFragment();

        properties.forEach(prop => {
            const value = obj[prop];
            const displayValue = typeof value === 'number' ? value.toFixed(1) : value;

            const container = this.createLabeledInput({
                label: prop.charAt(0).toUpperCase() + prop.slice(1),
                value: displayValue,
                onChange: (e) => {
                    let newValue = e.target.value;
                    
                    // Convert to number if original was number
                    if (typeof value === 'number') {
                        newValue = parseFloat(newValue) || 0;
                    }
                    
                    obj[prop] = newValue;
                    
                    if (onPropertyChange) {
                        onPropertyChange(prop, newValue, obj);
                    }
                }
            });

            fragment.appendChild(container);
        });

        return fragment;
    }

    /**
     * Create a tab button
     * @param {Object} options - Configuration options
     * @param {string} options.text - Tab text
     * @param {Function} options.onClick - Click handler
     * @param {boolean} options.active - Whether tab is active
     * @param {string} options.dataset - Data attributes object
     * @returns {HTMLButtonElement} Tab button
     */
    static createTab(options = {}) {
        const {
            text = '',
            onClick = null,
            active = false,
            dataset = {}
        } = options;

        const tab = document.createElement('button');
        tab.textContent = text;
        tab.className = active ? this.CSS.tabActive : this.CSS.tab;

        // Set data attributes
        Object.entries(dataset).forEach(([key, value]) => {
            tab.dataset[key] = value;
        });

        if (onClick) tab.addEventListener('click', onClick);

        return tab;
    }

    /**
     * Create a panel container
     * @param {Object} options - Configuration options
     * @param {string} options.content - HTML content
     * @param {string} options.id - Panel ID
     * @param {boolean} options.hidden - Whether panel is hidden
     * @returns {HTMLDivElement} Panel element
     */
    static createPanel(options = {}) {
        const {
            content = '',
            id = null,
            hidden = false
        } = options;

        const panel = document.createElement('div');
        panel.className = this.CSS.panel;
        panel.innerHTML = content;
        
        if (id) panel.id = id;
        if (hidden) panel.classList.add('hidden');

        return panel;
    }

    /**
     * Create a thumbnail element for assets
     * @param {Object} options - Configuration options
     * @param {Object} options.asset - Asset data
     * @param {boolean} options.selected - Whether thumbnail is selected
     * @param {Function} options.onClick - Click handler
     * @param {Function} options.onDragStart - Drag start handler
     * @returns {HTMLDivElement} Thumbnail element
     */
    static createAssetThumbnail(options = {}) {
        const {
            asset,
            selected = false,
            onClick = null,
            onDragStart = null
        } = options;

        const thumb = document.createElement('div');
        thumb.className = `asset-thumbnail w-24 h-24 bg-gray-700 rounded-md flex items-center justify-center cursor-pointer p-1 ${
            selected ? 'selected' : ''
        }`;
        thumb.dataset.assetId = asset.id;
        thumb.draggable = true;
        thumb.title = `${asset.name} (${asset.type})`;

        if (asset.imgSrc) {
            const img = document.createElement('img');
            img.src = asset.imgSrc;
            img.alt = asset.name;
            img.draggable = false;
            img.onerror = () => { img.style.display = 'none'; };
            thumb.appendChild(img);
        } else {
            // Create colored rectangle as fallback
            const colorDiv = document.createElement('div');
            Object.assign(colorDiv.style, {
                width: '100%',
                height: '100%',
                backgroundColor: asset.color,
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#ffffff',
                textAlign: 'center'
            });
            colorDiv.textContent = asset.name;
            thumb.appendChild(colorDiv);
        }

        if (onClick) thumb.addEventListener('click', onClick);
        if (onDragStart) thumb.addEventListener('dragstart', onDragStart);

        return thumb;
    }

    /**
     * Show/hide loading state on element
     * @param {HTMLElement} element - Element to modify
     * @param {boolean} loading - Whether to show loading state
     * @param {string} loadingText - Text to show while loading
     */
    static setLoadingState(element, loading, loadingText = 'Loading...') {
        if (loading) {
            element.dataset.originalContent = element.innerHTML;
            element.innerHTML = `<span class="opacity-50">${loadingText}</span>`;
            element.disabled = true;
        } else {
            element.innerHTML = element.dataset.originalContent || '';
            element.disabled = false;
            delete element.dataset.originalContent;
        }
    }

    /**
     * Create a grid container for assets or other items
     * @param {Object} options - Configuration options
     * @param {number} options.columns - Number of columns (default: responsive)
     * @param {string} options.gap - Gap between items
     * @returns {HTMLDivElement} Grid container
     */
    static createGrid(options = {}) {
        const {
            columns = 'responsive',
            gap = '4'
        } = options;

        const grid = document.createElement('div');
        
        if (columns === 'responsive') {
            grid.className = 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-' + gap;
        } else {
            grid.className = `grid grid-cols-${columns} gap-${gap}`;
        }

        return grid;
    }
}
