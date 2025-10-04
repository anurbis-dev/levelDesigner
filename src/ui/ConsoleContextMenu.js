/**
 * ConsoleContextMenu - Context menu handler for console panel
 * 
 * This module provides a comprehensive context menu system for the console panel
 * that allows users to interact with console logs and manage console settings.
 * 
 * Features:
 * - Right-click context menu anywhere in console panel
 * - Smart menu items based on context (copy options only for log entries)
 * - Console management (clear, logging toggle)
 * - Browser context menu blocking
 * - High z-index for proper layering
 * 
 * Usage:
 * ```javascript
 * const contextMenu = new ConsoleContextMenu(consolePanel, consoleOutput, {
 *     onLoggingToggle: (enabled) => Logger.console.info(`Logging ${enabled ? 'enabled' : 'disabled'}`),
 *     onConsoleClear: () => Logger.console.info('Console cleared')
 * });
 * ```
 * 
 * @author Level Designer
 * @version dynamic
 */

import { Logger } from '../utils/Logger.js';
import { BaseContextMenu } from './BaseContextMenu.js';

export class ConsoleContextMenu extends BaseContextMenu {
    constructor(consolePanel, consoleOutput, callbacks = {}) {
        super(consolePanel, {
            onMenuShow: callbacks.onMenuShow || (() => {}),
            onMenuHide: callbacks.onMenuHide || (() => {}),
            onItemClick: callbacks.onItemClick || (() => {}),
            onLoggingToggle: callbacks.onLoggingToggle || (() => {}),
            onConsoleClear: callbacks.onConsoleClear || (() => {}),
            onCopyToClipboard: callbacks.onCopyToClipboard || (() => {})
        });
        
        this.consoleOutput = consoleOutput;
        this.isLoggingEnabled = true;

        if (!this.panel) {
            Logger.console.error('ConsoleContextMenu: consolePanel not found');
        }
        if (!this.consoleOutput) {
            Logger.console.error('ConsoleContextMenu: consoleOutput not found');
        }

        this.setupMenuItems();
        Logger.console.info('ConsoleContextMenu initialized successfully');
    }

    /**
     * Setup menu items for console context menu
     */
    setupMenuItems() {
        // Add console-specific menu items
        this.addMenuItem('Toggle Logging', '📝', () => this.toggleLogging());
        this.addMenuItem('Clear Console', '🗑️', () => this.clearConsole());
        this.addMenuItem('Copy All', '📋', () => this.copyAll());
        this.addMenuItem('Copy Selected', '📄', () => this.copySelected());
    }

    /**
     * Override extractContextData to extract console-specific information
     * @param {Element} target - The clicked element
     * @returns {Object} - Context data including console info
     */
    extractContextData(target) {
        const contextData = super.extractContextData(target);
        
        // Extract console-specific data
        const { message, timestamp, isSelected } = this.extractLogData(target);
        contextData.message = message;
        contextData.timestamp = timestamp;
        contextData.isSelected = isSelected;
        
        return contextData;
    }

    /**
     * Override setupContextMenu to add console-specific checks
     */
    setupContextMenu() {
        // Call parent setup first
        super.setupContextMenu();
        
        // Add console-specific event handlers
        this.panel.addEventListener('mousedown', (e) => {
            // Don't interfere with resize handle
            if (e.target.closest('.console-resize-handle')) {
                return;
            }
            
            if (e.target.closest('.console-context-menu')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        
        this.panel.addEventListener('click', (e) => {
            // Don't interfere with resize handle
            if (e.target.closest('.console-resize-handle')) {
                return;
            }
            
            if (e.target.closest('.console-context-menu')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    /**
     * Override showContextMenu to add console-specific checks
     */
    showContextMenu(event, contextData) {
        // Check if console overlay is visible before showing context menu
        if (this.panel.classList.contains('hidden')) {
            return; // Don't show context menu if console is hidden
        }

        // Additional check: ensure click is within console bounds
        const consoleRect = this.panel.getBoundingClientRect();
        const clickX = event.clientX;
        const clickY = event.clientY;
        
        if (clickX < consoleRect.left || clickX > consoleRect.right || 
            clickY < consoleRect.top || clickY > consoleRect.bottom) {
            return; // Click is outside console bounds
        }

        // Call parent showContextMenu
        super.showContextMenu(event, contextData);
    }

    /**
     * Force hide context menu when console is closed
     * This method should be called when console is hidden
     */
    forceHideMenu() {
        if (this.currentMenu) {
            this.hideMenu();
        }
    }

    /**
     * Toggle logging state
     */
    toggleLogging() {
        this.isLoggingEnabled = !this.isLoggingEnabled;
        this.callbacks.onLoggingToggle(this.isLoggingEnabled);
    }

    /**
     * Clear console output
     */
    clearConsole() {
        this.consoleOutput.innerHTML = '';
        this.callbacks.onConsoleClear();
    }

    /**
     * Copy all console content
     */
    copyAll() {
        const allText = this.consoleOutput.textContent || this.consoleOutput.innerText || '';
        this.copyToClipboard(allText);
    }

    /**
     * Copy selected text
     */
    copySelected() {
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            this.copyToClipboard(selection.toString().trim());
        } else {
            // Fallback to copy all if nothing selected
            this.copyAll();
        }
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                this.callbacks.onCopyToClipboard(text);
            }).catch(err => {
                Logger.console.warn('Clipboard API failed, using fallback:', err);
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }

    /**
     * Fallback copy method for older browsers
     * @param {string} text - Text to copy
     */
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.callbacks.onCopyToClipboard(text);
        } catch (err) {
            Logger.console.error('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }

    /**
     * Get current logging state
     * @returns {boolean} - Current logging state
     */
    getLoggingState() {
        return this.isLoggingEnabled;
    }

    /**
     * Extract log data from clicked element
     * @param {Element} target - The clicked element
     * @returns {Object} - Object with message, timestamp, and selection info
     */
    extractLogData(target) {
        let message = '';
        let timestamp = '';
        let isSelected = false;

        // Find the closest log entry
        const logEntry = target.closest('.console-message, .log-entry');
        if (logEntry) {
            // Extract message text
            message = logEntry.textContent || logEntry.innerText || '';
            
            // Check if this entry is selected
            isSelected = logEntry.classList.contains('selected');
            
            // Try to extract timestamp if available
            const timestampElement = logEntry.querySelector('.timestamp');
            if (timestampElement) {
                timestamp = timestampElement.textContent || '';
            }
        }

        return { message, timestamp, isSelected };
    }
}