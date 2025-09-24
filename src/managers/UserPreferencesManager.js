/**
 * User Preferences Manager
 * Handles saving and loading user preferences to/from localStorage
 */

import { Logger } from '../utils/Logger.js';
export class UserPreferencesManager {
    constructor() {
        this.prefsKey = 'levelEditor_userPrefs';
        this.defaultPrefs = {
            // Panel sizes
            rightPanelWidth: 320,
            consoleHeight: 300,
            assetsPanelHeight: 256,
            
            // Tab order
            rightPanelTabOrder: ['details', 'level', 'outliner'],
            assetTabOrder: [],
            
            // Console settings
            consoleVisible: false,
            consoleMaxLines: 1000,
            
            // Canvas settings
            canvasBackgroundColor: '#4B5563',
            gridSize: 32,
            showGrid: true,
            gridColor: '#ffffff',
            gridOpacity: 0.1,
            gridThickness: 1,
            gridSubdivisions: 4,
            gridSubdivColor: '#666666',
            gridSubdivThickness: 0.5,
            
            // Editor settings
            autoSave: true,
            autoSaveInterval: 30000, // 30 seconds
            
            // UI settings
            theme: 'dark',
            fontSize: 'sm',
            fontScale: 1.0,
            compactMode: false
        };
        
        this.preferences = this.loadPreferences();
    }

    /**
     * Load preferences from localStorage
     */
    loadPreferences() {
        try {
            const stored = localStorage.getItem(this.prefsKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to ensure all properties exist
                return { ...this.defaultPrefs, ...parsed };
            }
        } catch (error) {
            Logger.preferences.warn('Failed to load user preferences:', error);
        }
        return { ...this.defaultPrefs };
    }

    /**
     * Save preferences to localStorage
     */
    savePreferences() {
        try {
            localStorage.setItem(this.prefsKey, JSON.stringify(this.preferences));
            return true;
        } catch (error) {
            Logger.preferences.error('Failed to save user preferences:', error);
            return false;
        }
    }

    /**
     * Get a preference value
     */
    get(key) {
        return this.preferences[key];
    }

    /**
     * Set a preference value and save
     */
    set(key, value) {
        this.preferences[key] = value;
        this.savePreferences();
    }

    /**
     * Update multiple preferences at once
     */
    update(updates) {
        Object.assign(this.preferences, updates);
        this.savePreferences();
    }

    /**
     * Reset preferences to defaults
     */
    reset() {
        this.preferences = { ...this.defaultPrefs };
        this.savePreferences();
    }

    /**
     * Export preferences as JSON string
     */
    export() {
        return JSON.stringify(this.preferences, null, 2);
    }

    /**
     * Import preferences from JSON string
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            this.preferences = { ...this.defaultPrefs, ...imported };
            this.savePreferences();
            return true;
        } catch (error) {
            Logger.preferences.error('Failed to import preferences:', error);
            return false;
        }
    }

    /**
     * Get all preferences
     */
    getAll() {
        return { ...this.preferences };
    }

    /**
     * Check if a preference exists
     */
    has(key) {
        return key in this.preferences;
    }

    /**
     * Remove a preference (reset to default)
     */
    remove(key) {
        if (key in this.defaultPrefs) {
            this.preferences[key] = this.defaultPrefs[key];
            this.savePreferences();
        }
    }
}
