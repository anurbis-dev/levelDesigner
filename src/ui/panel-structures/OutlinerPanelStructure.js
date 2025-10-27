import { createPanelStructure, createSearchInput, createButton, createControlsRow } from './BasePanelStructure.js';

/**
 * Outliner Panel Structure Definition
 * Defines the layout and custom sections for the Outliner panel
 */

export const OutlinerPanelStructure = {
    // Panel metadata
    name: 'outliner',
    displayName: 'Outliner',

    // Custom sections configuration
    customSections: {
        top: {
            id: 'outliner-top-custom',
            classes: 'panel-top-custom flex-shrink-0',
            content: 'search-filter-controls',
            description: 'Search input and filter controls for object types'
        },
        bottom: {
            id: 'outliner-bottom-custom',
            classes: 'panel-bottom-custom flex-shrink-0',
            content: null,
            description: 'Reserved for future use'
        }
    },

    // Content area configuration
    content: {
        id: 'outliner-content',
        classes: 'flex-grow overflow-y-auto',
        description: 'Main outliner content area'
    },

    // Search and filter controls configuration
    searchControls: {
        searchInput: {
            id: 'outliner-search',
            placeholder: 'Search objects...',
            classes: 'flex-1 bg-gray-700 px-1 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none'
        },
        filterButton: {
            id: 'outliner-filter-btn',
            classes: 'px-2 py-1 rounded text-sm flex items-center justify-center',
            title: 'Filter by object types',
            icon: 'filter-icon'
        }
    },

    // Layout order: top-custom -> content -> bottom-custom
    layout: ['top', 'content', 'bottom']
};

/**
 * Creates the DOM structure for the Outliner panel
 * @param {HTMLElement} container - The panel container element
 * @returns {Object} - Object with references to created elements
 */
export function createOutlinerPanelStructure(container) {
    return createPanelStructure(container, OutlinerPanelStructure);
}

/**
 * Renders search and filter controls in the top custom section
 * @param {HTMLElement} topSection - The top custom section element
 * @param {Object} callbacks - Callback functions for search and filter
 */
export function renderOutlinerSearchControls(topSection, callbacks = {}) {
    if (!topSection) return;

    // Clear existing content
    topSection.innerHTML = '';

    // Create controls row
    const controlsRow = createControlsRow();

    // Create search input with callback for ESC support
    const searchInput = createSearchInput(
        OutlinerPanelStructure.searchControls.searchInput.placeholder,
        OutlinerPanelStructure.searchControls.searchInput.id,
        OutlinerPanelStructure.searchControls.searchInput.classes,
        callbacks.getSearchTerm ? callbacks.getSearchTerm() : '',
        callbacks.onSearch || null
    );

    // Create filter button
    const filterButton = document.createElement('button');
    filterButton.id = OutlinerPanelStructure.searchControls.filterButton.id;
    filterButton.className = OutlinerPanelStructure.searchControls.filterButton.classes;
    filterButton.title = OutlinerPanelStructure.searchControls.filterButton.title;

    // Set button state based on active filters
    const hasActiveFilters = callbacks.getActiveFilters ?
        callbacks.getActiveFilters().size > 0 && !callbacks.getActiveFilters().has('DISABLE_ALL') : false;

    filterButton.className += hasActiveFilters ?
        ' bg-blue-600 hover:bg-blue-700' : ' bg-gray-600 hover:bg-gray-700';

    filterButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 3h8l-3 3v3l-2 1V6L2 3z"/>
        </svg>
    `;

    // Setup filter button listener
    if (callbacks.onFilterClick) {
        filterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            callbacks.onFilterClick(filterButton);
        });
    }

    // Assemble controls
    controlsRow.appendChild(searchInput);
    controlsRow.appendChild(filterButton);
    topSection.appendChild(controlsRow);
}
