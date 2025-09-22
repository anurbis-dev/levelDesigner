import { Logger } from './Logger.js';

/**
 * Utility class for search functionality
 * Provides reusable search methods for different panels
 */
export class SearchUtils {
    /**
     * Create search input element
     * @param {string} placeholder - Placeholder text
     * @param {string} id - Input element ID
     * @param {string} className - CSS classes
     * @returns {HTMLInputElement} Search input element
     */
    static createSearchInput(placeholder, id, className = '') {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = placeholder;
        searchInput.id = id;
        searchInput.className = className || 'search-input w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-700 text-white focus:border-blue-500 focus:outline-none';
        
        return searchInput;
    }

    /**
     * Create search container with input
     * @param {string} placeholder - Placeholder text
     * @param {string} id - Input element ID
     * @param {string} containerClass - Container CSS classes
     * @returns {HTMLElement} Search container element
     */
    static createSearchContainer(placeholder, id, containerClass = 'search-container mb-2') {
        const searchContainer = document.createElement('div');
        searchContainer.className = containerClass;

        const searchInput = this.createSearchInput(placeholder, id);
        searchContainer.appendChild(searchInput);

        return searchContainer;
    }

    /**
     * Setup search event listeners
     * @param {HTMLInputElement} searchInput - Search input element
     * @param {Function} onSearch - Callback function for search
     * @param {Function} onClear - Callback function for clear (optional)
     */
    static setupSearchListeners(searchInput, onSearch, onClear = null) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            onSearch(searchTerm);
        });

        // Clear search on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                onSearch('');
                if (onClear) {
                    onClear();
                }
            }
        });
    }

    /**
     * Filter objects by name
     * @param {Array} objects - Array of objects to filter
     * @param {string} searchTerm - Search term
     * @param {string} nameProperty - Property name to search in (default: 'name')
     * @returns {Array} Filtered objects
     */
    static filterObjects(objects, searchTerm, nameProperty = 'name') {
        if (!searchTerm) return objects;

        return objects.filter(obj => {
            const name = (obj[nameProperty] || `[${obj.type || 'object'}]`).toLowerCase();
            return name.includes(searchTerm);
        });
    }

    /**
     * Filter objects recursively (for hierarchical structures)
     * @param {Array} objects - Array of objects to filter
     * @param {string} searchTerm - Search term
     * @param {string} nameProperty - Property name to search in (default: 'name')
     * @param {string} childrenProperty - Property name for children (default: 'children')
     * @returns {Array} Filtered objects with matching children
     */
    static filterObjectsRecursive(objects, searchTerm, nameProperty = 'name', childrenProperty = 'children') {
        if (!searchTerm) return objects;

        const filtered = [];
        
        objects.forEach(obj => {
            const name = (obj[nameProperty] || `[${obj.type || 'object'}]`).toLowerCase();
            const matches = name.includes(searchTerm);
            
            // Check children recursively
            let matchingChildren = [];
            if (obj[childrenProperty] && obj[childrenProperty].length > 0) {
                matchingChildren = this.filterObjectsRecursive(obj[childrenProperty], searchTerm, nameProperty, childrenProperty);
            }
            
            // Include object if it matches or has matching children
            if (matches || matchingChildren.length > 0) {
                const filteredObj = { ...obj };
                if (matchingChildren.length > 0) {
                    filteredObj[childrenProperty] = matchingChildren;
                }
                filtered.push(filteredObj);
            }
        });
        
        return filtered;
    }

    /**
     * Create search results info element
     * @param {number} count - Number of results
     * @param {string} searchTerm - Search term
     * @param {string} itemType - Type of items being searched (default: 'objects')
     * @returns {HTMLElement} Results info element
     */
    static createSearchResultsInfo(count, searchTerm, itemType = 'objects') {
        const resultsInfo = document.createElement('div');
        resultsInfo.className = 'search-results text-xs text-gray-500 mb-2';
        resultsInfo.textContent = `Found ${count} ${itemType}${count !== 1 ? '' : ''} matching "${searchTerm}"`;
        return resultsInfo;
    }

    /**
     * Get search input value
     * @param {string} inputId - Input element ID
     * @returns {string} Current search value
     */
    static getSearchValue(inputId) {
        const input = document.getElementById(inputId);
        return input ? input.value.toLowerCase().trim() : '';
    }

    /**
     * Clear search input
     * @param {string} inputId - Input element ID
     */
    static clearSearch(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
        }
    }

    /**
     * Focus search input
     * @param {string} inputId - Input element ID
     */
    static focusSearch(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.focus();
            input.select();
        }
    }
}
