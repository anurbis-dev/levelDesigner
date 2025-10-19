/**
 * Universal Search Manager
 * Handles search functionality across all panels in the editor
 */

import { Logger } from './Logger.js';

export class SearchManager {
    constructor() {
        this.searchHandlers = new Map(); // panelId -> {inputId, onSearch, onClear}
        this.activeSearches = new Map(); // inputId -> current search term
    }

    /**
     * Register a search input for a panel
     * @param {string} panelId - Unique panel identifier (e.g., 'outliner', 'layers')
     * @param {string} inputId - DOM ID of the search input
     * @param {Function} onSearch - Search callback function
     * @param {Function} onClear - Optional clear callback function
     */
    registerSearch(panelId, inputId, onSearch, onClear = null) {
        // Remove existing registration for this panel
        this.unregisterSearch(panelId);

        this.searchHandlers.set(panelId, {
            inputId,
            onSearch,
            onClear
        });

        // Setup listeners when input becomes available
        this.setupSearchListeners(panelId);

        Logger.ui.debug(`SearchManager: Registered search for panel ${panelId} with input ${inputId}`);
    }

    /**
     * Unregister search for a panel
     * @param {string} panelId - Panel identifier
     */
    unregisterSearch(panelId) {
        const handler = this.searchHandlers.get(panelId);
        if (handler) {
            this.searchHandlers.delete(panelId);
            this.activeSearches.delete(handler.inputId);

            // Remove managed attribute from the input element if it exists
            const searchInput = document.getElementById(handler.inputId);
            if (searchInput && searchInput.hasAttribute('data-search-managed')) {
                searchInput.removeAttribute('data-search-managed');
            }

            Logger.ui.debug(`SearchManager: Unregistered search for panel ${panelId}`);
        }
    }

    /**
     * Setup search listeners for a registered panel
     * @param {string} panelId - Panel identifier
     */
    setupSearchListeners(panelId) {
        const handler = this.searchHandlers.get(panelId);
        if (!handler) return;

        const searchInput = document.getElementById(handler.inputId);
        Logger.ui.debug(`SearchManager: setupSearchListeners for ${panelId}, element found: ${!!searchInput}`);
        if (!searchInput) {
            // Input not available yet, try again later
            Logger.ui.debug(`SearchManager: Element ${handler.inputId} not found, will retry in 100ms`);
            setTimeout(() => this.setupSearchListeners(panelId), 100);
            return;
        }

        // Check if this input already has our listeners (avoid duplicate setup)
        const hasManagedAttr = searchInput.hasAttribute('data-search-managed');
        Logger.ui.debug(`SearchManager: Element ${handler.inputId} has managed attr: ${hasManagedAttr}`);
        if (hasManagedAttr) {
            Logger.ui.debug(`SearchManager: Listeners already set up for ${panelId}, skipping`);
            return;
        }

        // Remove existing listeners to avoid duplicates
        const newInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newInput, searchInput);

        // Mark as managed to prevent duplicate setup
        newInput.setAttribute('data-search-managed', 'true');

        // Setup new listeners
        newInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            // Always trigger onSearch, even if searchTerm didn't change after trim
            // This ensures that deleting the last character properly resets the search
            const previousTerm = this.activeSearches.get(handler.inputId) || '';
            this.activeSearches.set(handler.inputId, searchTerm);

            // Trigger callback if term changed or if we're clearing search
            if (searchTerm !== previousTerm || (searchTerm === '' && previousTerm !== '')) {
                handler.onSearch(searchTerm);
            }
        });

        // Clear search on Escape
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.activeSearches.set(handler.inputId, '');
                handler.onSearch('');
                if (handler.onClear) {
                    handler.onClear();
                }
            }
        });

        // Restore previous search term if exists
        const previousTerm = this.activeSearches.get(handler.inputId);
        if (previousTerm) {
            newInput.value = previousTerm;
        }

        Logger.ui.debug(`SearchManager: SUCCESSFULLY setup listeners for ${panelId} search input`);
    }

    /**
     * Refresh search listeners for all registered panels
     * Call this when DOM structure changes (e.g., tabs move between panels)
     */
    refreshAllSearches() {
        // Only refresh listeners for panels that have active tabs or are currently rendered
        // This prevents trying to set up listeners for elements that don't exist yet
        const activeTabs = this.getActiveTabs();
        Logger.ui.debug('SearchManager: Active tabs found:', activeTabs);

        for (const panelId of this.searchHandlers.keys()) {
            const searchInput = document.getElementById(this.searchHandlers.get(panelId).inputId);
            const hasManagedAttr = searchInput ? searchInput.hasAttribute('data-search-managed') : false;

            Logger.ui.debug(`SearchManager: Panel ${panelId} - element exists: ${!!searchInput}, has managed attr: ${hasManagedAttr}, is active: ${activeTabs.includes(panelId)}`);

            if (activeTabs.includes(panelId)) {
                this.setupSearchListeners(panelId);
            } else if (searchInput && hasManagedAttr) {
                // Remove managed attribute from inactive elements to allow proper cleanup
                searchInput.removeAttribute('data-search-managed');
                Logger.ui.debug(`SearchManager: Removed managed attribute from inactive panel ${panelId}`);
            }
        }
        Logger.ui.debug('SearchManager: Refreshed search listeners for active panels');
    }

    /**
     * Get list of currently active panel IDs based on visible content
     * @returns {Array<string>} - Array of active panel IDs
     */
    getActiveTabs() {
        const activeTabs = [];

        // Check for active tabs in both left and right panels
        const activeTabElements = document.querySelectorAll('.tab-right.active, .tab-left.active');
        Logger.ui.debug('SearchManager: Found active tab elements:', activeTabElements.length);

        activeTabElements.forEach(tab => {
            const tabName = tab.dataset.tab;
            Logger.ui.debug(`SearchManager: Active tab element found: ${tabName}, registered: ${this.searchHandlers.has(tabName)}`);
            if (tabName && this.searchHandlers.has(tabName)) {
                activeTabs.push(tabName);
            }
        });

        Logger.ui.debug('SearchManager: Active tabs determined:', activeTabs);
        return activeTabs;
    }

    /**
     * Get current search term for a panel
     * @param {string} panelId - Panel identifier
     * @returns {string} - Current search term
     */
    getSearchTerm(panelId) {
        const handler = this.searchHandlers.get(panelId);
        if (handler) {
            return this.activeSearches.get(handler.inputId) || '';
        }
        return '';
    }

    /**
     * Set search term for a panel
     * @param {string} panelId - Panel identifier
     * @param {string} term - Search term to set
     */
    setSearchTerm(panelId, term) {
        const handler = this.searchHandlers.get(panelId);
        if (handler) {
            this.activeSearches.set(handler.inputId, term);

            // Update input value if it exists
            const searchInput = document.getElementById(handler.inputId);
            if (searchInput) {
                searchInput.value = term;
            }

            // Trigger search callback
            handler.onSearch(term);
        }
    }

    /**
     * Clear search for a panel
     * @param {string} panelId - Panel identifier
     */
    clearSearch(panelId) {
        this.setSearchTerm(panelId, '');
        const handler = this.searchHandlers.get(panelId);
        if (handler && handler.onClear) {
            handler.onClear();
        }
    }

    /**
     * Get all registered panel IDs
     * @returns {Array<string>} - Array of registered panel IDs
     */
    getRegisteredPanels() {
        return Array.from(this.searchHandlers.keys());
    }

    /**
     * Check if panel has active search
     * @param {string} panelId - Panel identifier
     * @returns {boolean} - True if panel has active search
     */
    hasActiveSearch(panelId) {
        const term = this.getSearchTerm(panelId);
        return term && term.length > 0;
    }
}

// Global instance
export const searchManager = new SearchManager();

/**
 * Example usage for new panels:
 *
 * // In your panel constructor:
 * searchManager.registerSearch(
 *     'your-panel-id',
 *     'your-search-input-id',
 *     (searchTerm) => {
 *         // Handle search term change
 *         this.searchTerm = searchTerm;
 *         this.render();
 *     },
 *     () => {
 *         // Optional: Handle search clear
 *         this.searchTerm = '';
 *         this.render();
 *     }
 * );
 *
 * // When panel is destroyed:
 * searchManager.unregisterSearch('your-panel-id');
 *
 * // To get current search term:
 * const currentTerm = searchManager.getSearchTerm('your-panel-id');
 *
 * // To set search term programmatically:
 * searchManager.setSearchTerm('your-panel-id', 'new term');
 */
