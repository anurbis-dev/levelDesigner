import { createPanelStructure, createSearchInput, createButton, createControlsRow } from './BasePanelStructure.js';

/**
 * Levels Panel Structure Definition
 * Defines the layout and custom sections for the Levels panel (mirrors LayersPanelStructure.js)
 */

export const LevelsPanelStructure = {
    // Panel metadata
    name: 'levels',
    displayName: 'Levels',

    // Custom sections configuration
    customSections: {
        top: {
            id: 'levels-top-custom',
            classes: 'panel-top-custom flex-shrink-0',
            content: 'search-level-controls',
            description: 'Search input and Add Level button for level management'
        }
    },

    // Content area configuration
    content: {
        id: 'levels-content',
        classes: 'flex-grow overflow-y-auto',
        description: 'Main levels content area'
    },

    // Level controls configuration
    levelControls: {
        searchInput: {
            id: 'levels-search',
            placeholder: 'Search levels...',
            classes: 'flex-1 bg-gray-700 px-1 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none'
        },
        addButton: {
            id: 'add-level-btn',
            classes: 'bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm',
            title: 'Add new level',
            text: '+ Add'
        }
    },

    // Layout order: top-custom -> content (no bottom section needed)
    layout: ['top', 'content']
};

/**
 * Creates the DOM structure for the Levels panel
 * @param {HTMLElement} container - The panel container element
 * @returns {Object} - Object with references to created elements
 */
export function createLevelsPanelStructure(container) {
    return createPanelStructure(container, LevelsPanelStructure);
}

/**
 * Renders level controls in the top custom section
 * @param {HTMLElement} topSection - The top custom section element
 * @param {Object} callbacks - Callback functions for level operations
 */
export function renderLevelsControls(topSection, callbacks = {}) {
    if (!topSection) return;

    // Clear existing content
    topSection.innerHTML = '';

    // Create controls row
    const controlsRow = createControlsRow();

    // Create search input with callback for ESC support
    const searchInput = createSearchInput(
        LevelsPanelStructure.levelControls.searchInput.placeholder,
        callbacks.searchInputId || LevelsPanelStructure.levelControls.searchInput.id,
        LevelsPanelStructure.levelControls.searchInput.classes,
        callbacks.getSearchFilter ? callbacks.getSearchFilter() : '',
        callbacks.onSearch || null
    );

    // Create Add Level button
    const addButton = createButton(
        LevelsPanelStructure.levelControls.addButton.id,
        LevelsPanelStructure.levelControls.addButton.classes,
        LevelsPanelStructure.levelControls.addButton.title,
        LevelsPanelStructure.levelControls.addButton.text,
        callbacks.onAddLevel
    );

    // Assemble controls
    controlsRow.appendChild(searchInput);
    controlsRow.appendChild(addButton);
    topSection.appendChild(controlsRow);
}
