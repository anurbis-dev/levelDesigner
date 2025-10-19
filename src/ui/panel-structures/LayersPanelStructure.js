import { createPanelStructure, createSearchInput, createButton, createControlsRow } from './BasePanelStructure.js';

/**
 * Layers Panel Structure Definition
 * Defines the layout and custom sections for the Layers panel
 */

export const LayersPanelStructure = {
    // Panel metadata
    name: 'layers',
    displayName: 'Layers',

    // Custom sections configuration
    customSections: {
        top: {
            id: 'layers-top-custom',
            classes: 'panel-top-custom flex-shrink-0',
            content: 'search-layer-controls',
            description: 'Search input, Add Layer button and Layer menu for layer management'
        },
        bottom: {
            id: 'layers-bottom-custom',
            classes: 'panel-bottom-custom flex-shrink-0',
            content: null,
            description: 'Reserved for future use'
        }
    },

    // Content area configuration
    content: {
        id: 'layers-content',
        classes: 'flex-grow overflow-y-auto',
        description: 'Main layers content area'
    },

    // Layer controls configuration
    layerControls: {
        searchInput: {
            id: 'layers-search',
            placeholder: 'Search layers...',
            classes: 'flex-1 bg-gray-700 px-1 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none'
        },
        addButton: {
            id: 'add-layer-btn',
            classes: 'bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm',
            title: 'Add new layer',
            text: '+ Add'
        },
    },

    // Layout order: top-custom -> content -> bottom-custom
    layout: ['top', 'content', 'bottom']
};

/**
 * Creates the DOM structure for the Layers panel
 * @param {HTMLElement} container - The panel container element
 * @returns {Object} - Object with references to created elements
 */
export function createLayersPanelStructure(container) {
    return createPanelStructure(container, LayersPanelStructure);
}

/**
 * Renders layer controls in the top custom section
 * @param {HTMLElement} topSection - The top custom section element
 * @param {Object} callbacks - Callback functions for layer operations
 */
export function renderLayersControls(topSection, callbacks = {}) {
    if (!topSection) return;

    // Clear existing content
    topSection.innerHTML = '';

    // Create controls row
    const controlsRow = createControlsRow();

    // Create search input (SearchManager will handle events)
    const searchInput = createSearchInput(
        LayersPanelStructure.layerControls.searchInput.placeholder,
        LayersPanelStructure.layerControls.searchInput.id,
        LayersPanelStructure.layerControls.searchInput.classes,
        callbacks.getSearchFilter ? callbacks.getSearchFilter() : ''
    );

    // Create Add Layer button
    const addButton = createButton(
        LayersPanelStructure.layerControls.addButton.id,
        LayersPanelStructure.layerControls.addButton.classes,
        LayersPanelStructure.layerControls.addButton.title,
        LayersPanelStructure.layerControls.addButton.text,
        callbacks.onAddLayer
    );

    // Assemble controls
    controlsRow.appendChild(searchInput);
    controlsRow.appendChild(addButton);
    topSection.appendChild(controlsRow);
}
