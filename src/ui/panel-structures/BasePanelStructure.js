/**
 * Base Panel Structure utilities
 * Common functions for creating panel structures and controls
 */

/**
 * Creates custom sections for a panel container
 * @param {HTMLElement} container - The panel container element
 * @param {Object} structure - Panel structure configuration
 * @returns {Object} - Object with references to created elements
 */
export function createPanelStructure(container, structure) {
    if (!container) {
        throw new Error('Container element is required');
    }

    const elements = {};

    // Create custom sections according to layout
    structure.layout.forEach(sectionType => {
        if (sectionType === 'top' && structure.customSections.top) {
            const topSection = document.createElement('div');
            topSection.id = structure.customSections.top.id;
            topSection.className = structure.customSections.top.classes;
            container.appendChild(topSection);
            elements.topCustom = topSection;
        }

        if (sectionType === 'content') {
            // Content is already the container, just reference it
            elements.content = container;
        }

        if (sectionType === 'bottom' && structure.customSections.bottom) {
            const bottomSection = document.createElement('div');
            bottomSection.id = structure.customSections.bottom.id;
            bottomSection.className = structure.customSections.bottom.classes;
            container.appendChild(bottomSection);
            elements.bottomCustom = bottomSection;
        }
    });

    return elements;
}

/**
 * Creates a search input element with common styling
 * @param {string} placeholder - Placeholder text
 * @param {string} id - Element ID
 * @param {string} className - CSS classes
 * @param {string} value - Initial value
 * @param {Function} onChange - Change callback function
 * @returns {HTMLElement} - The created input element
 */
export function createSearchInput(placeholder, id, className, value = '', onChange = null) {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.placeholder = placeholder;
    input.className = className;
    input.value = value;

    if (onChange) {
        let timeout;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => onChange(e.target.value), 150);
        });
    }

    return input;
}

/**
 * Creates a button element with common styling
 * @param {string} id - Element ID
 * @param {string} className - CSS classes
 * @param {string} title - Button title
 * @param {string} text - Button text content
 * @param {Function} onClick - Click callback function
 * @returns {HTMLElement} - The created button element
 */
export function createButton(id, className, title, text, onClick = null) {
    const button = document.createElement('button');
    button.id = id;
    button.className = className;
    button.title = title;
    button.textContent = text;
    button.style.color = 'var(--ui-text-color, #d1d5db)';

    if (onClick && typeof onClick === 'function') {
        button.addEventListener('click', onClick);
    }

    return button;
}

/**
 * Creates a controls row container
 * @param {string} className - CSS classes for the row
 * @returns {HTMLElement} - The created container element
 */
export function createControlsRow(className = 'flex items-center gap-1 p-2 border-b border-gray-700') {
    const row = document.createElement('div');
    row.className = className;
    return row;
}
