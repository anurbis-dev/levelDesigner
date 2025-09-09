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

export class ConsoleContextMenu {
    constructor(consolePanel, consoleOutput, callbacks = {}) {
        this.consolePanel = consolePanel;
        this.consoleOutput = consoleOutput;
        this.callbacks = {
            onLoggingToggle: callbacks.onLoggingToggle || (() => {}),
            onConsoleClear: callbacks.onConsoleClear || (() => {}),
            onCopyToClipboard: callbacks.onCopyToClipboard || (() => {})
        };
        
        this.isLoggingEnabled = true;
        this.currentMenu = null;
        
        // Debug: Check if elements exist
        if (!this.consolePanel) {
            Logger.console.error('ConsoleContextMenu: consolePanel not found');
        }
        if (!this.consoleOutput) {
            Logger.console.error('ConsoleContextMenu: consoleOutput not found');
        }
        
        this.setupContextMenu();
        this.setupWindowResizeHandler();
        
        Logger.console.info('ConsoleContextMenu initialized successfully');
    }

    /**
     * Initialize context menu functionality
     * Sets up event listeners and menu creation
     */
    setupContextMenu() {
        // Add context menu to entire console panel
        this.consolePanel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Extract message and timestamp from log entry if available
            const { message, timestamp } = this.extractLogData(e.target);
            this.showContextMenu(e, message, timestamp);
        });
    }

    /**
     * Setup window resize handler to reposition menu if needed
     */
    setupWindowResizeHandler() {
        this.resizeHandler = () => {
            if (this.currentMenu) {
                // Hide menu on window resize to avoid positioning issues
                this.removeMenu(this.currentMenu);
                this.currentMenu = null;
            }
        };
        
        window.addEventListener('resize', this.resizeHandler, { passive: true });
    }

    /**
     * Extract log message and timestamp from clicked element
     * @param {Element} target - The clicked element
     * @returns {Object} - Object with message and timestamp
     */
    extractLogData(target) {
        let message = '';
        let timestamp = '';
        
        const logEntry = target.closest('.log-entry');
        if (logEntry) {
            const textContent = logEntry.textContent;
            const timestampMatch = textContent.match(/^\[([^\]]+)\]\s*(.*)$/);
            if (timestampMatch) {
                timestamp = timestampMatch[1];
                message = timestampMatch[2];
            }
        }
        
        return { message, timestamp };
    }

    /**
     * Show context menu at specified position
     * @param {Event} event - The context menu event
     * @param {string} message - Log message (if any)
     * @param {string} timestamp - Log timestamp (if any)
     */
    showContextMenu(event, message, timestamp) {
        // Remove existing context menu
        this.removeExistingMenu();

        // Create new context menu
        const contextMenu = this.createContextMenu(event, message, timestamp);
        
        // Add to document first (hidden)
        document.body.appendChild(contextMenu);
        this.currentMenu = contextMenu;
        
        // Calculate optimal position after menu is in DOM
        const optimalPosition = this.calculateOptimalPosition(event, contextMenu);
        contextMenu.style.left = optimalPosition.x + 'px';
        contextMenu.style.top = optimalPosition.y + 'px';
        
        // Add positioning classes for better animation
        this.addPositioningClasses(contextMenu, event, optimalPosition);
        
        // Trigger animation
        requestAnimationFrame(() => {
            contextMenu.classList.add('show');
        });

        // Setup menu closing
        this.setupMenuClosing(contextMenu);
    }

    /**
     * Calculate optimal position for context menu
     * @param {Event} event - The context menu event
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Object with x and y coordinates
     */
    calculateOptimalPosition(event, menu) {
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Get actual menu dimensions after creation
        const menuSize = this.getMenuDimensions(menu);
        
        const margins = {
            horizontal: 20, // Minimum distance from viewport edges
            vertical: 20
        };
        
        let x = event.pageX;
        let y = event.pageY;
        
        // Determine optimal horizontal position
        const spaceRight = viewport.width - event.pageX;
        const spaceLeft = event.pageX;
        
        if (spaceRight >= menuSize.width + margins.horizontal) {
            // Enough space to the right, show menu to the right
            x = event.pageX;
        } else if (spaceLeft >= menuSize.width + margins.horizontal) {
            // Not enough space to the right, but enough to the left
            x = event.pageX - menuSize.width;
        } else {
            // Not enough space on either side, center the menu
            x = Math.max(margins.horizontal, 
                       Math.min(event.pageX - menuSize.width / 2, 
                               viewport.width - menuSize.width - margins.horizontal));
        }
        
        // Determine optimal vertical position
        const spaceBelow = viewport.height - event.pageY;
        const spaceAbove = event.pageY;
        
        if (spaceBelow >= menuSize.height + margins.vertical) {
            // Enough space below, show menu below
            y = event.pageY;
        } else if (spaceAbove >= menuSize.height + margins.vertical) {
            // Not enough space below, but enough above
            y = event.pageY - menuSize.height;
        } else {
            // Not enough space above or below, center the menu
            y = Math.max(margins.vertical,
                        Math.min(event.pageY - menuSize.height / 2,
                                viewport.height - menuSize.height - margins.vertical));
        }
        
        // Ensure menu stays within console panel bounds when possible
        const consoleRect = this.consolePanel.getBoundingClientRect();
        const consoleBounds = {
            left: consoleRect.left,
            right: consoleRect.right,
            top: consoleRect.top,
            bottom: consoleRect.bottom
        };
        
        // Adjust position to stay within console panel when possible
        if (x < consoleBounds.left) {
            x = consoleBounds.left + 5;
        }
        if (x + menuSize.width > consoleBounds.right) {
            x = consoleBounds.right - menuSize.width - 5;
        }
        if (y < consoleBounds.top) {
            y = consoleBounds.top + 5;
        }
        if (y + menuSize.height > consoleBounds.bottom) {
            y = consoleBounds.bottom - menuSize.height - 5;
        }
        
        return { x, y };
    }

    /**
     * Get actual menu dimensions
     * @param {HTMLElement} menu - The context menu element
     * @returns {Object} - Object with width and height
     */
    getMenuDimensions(menu) {
        const rect = menu.getBoundingClientRect();
        const dimensions = {
            width: rect.width || 200, // Fallback width
            height: rect.height || 150 // Fallback height
        };
        
        return dimensions;
    }

    /**
     * Add positioning classes for better animation
     * @param {HTMLElement} menu - The context menu element
     * @param {Event} event - The context menu event
     * @param {Object} position - The calculated position
     */
    addPositioningClasses(menu, event, position) {
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Determine horizontal positioning
        if (position.x < event.pageX) {
            menu.classList.add('positioned-left');
        } else {
            menu.classList.add('positioned-right');
        }
        
        // Determine vertical positioning
        if (position.y < event.pageY) {
            menu.classList.add('positioned-above');
        } else {
            menu.classList.add('positioned-below');
        }
    }

    /**
     * Remove any existing context menu
     */
    removeExistingMenu() {
        const existingMenu = document.querySelector('.console-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    /**
     * Create context menu element with appropriate items
     * @param {Event} event - The context menu event
     * @param {string} message - Log message (if any)
     * @param {string} timestamp - Log timestamp (if any)
     * @returns {HTMLElement} - The context menu element
     */
    createContextMenu(event, message, timestamp) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'console-context-menu';
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';

        // Add copy options only if there's actual message content
        if (message && message.trim()) {
            this.addCopyOptions(contextMenu, message, timestamp);
        }

        // Add console management options
        this.addConsoleOptions(contextMenu);

        return contextMenu;
    }

    /**
     * Add copy-related menu items
     * @param {HTMLElement} menu - The context menu element
     * @param {string} message - Log message
     * @param {string} timestamp - Log timestamp
     */
    addCopyOptions(menu, message, timestamp) {
        // Copy message option
        const copyMessageItem = this.createMenuItem('📋 Copy message', () => {
            this.copyToClipboard(message);
            this.removeMenu(menu);
        });
        menu.appendChild(copyMessageItem);

        // Copy with timestamp option
        const copyWithTimestampItem = this.createMenuItem('🕒 Copy with timestamp', () => {
            this.copyToClipboard(`[${timestamp}] ${message}`);
            this.removeMenu(menu);
        });
        menu.appendChild(copyWithTimestampItem);
    }

    /**
     * Add console management menu items
     * @param {HTMLElement} menu - The context menu element
     */
    addConsoleOptions(menu) {
        // Clear console option
        const clearConsoleItem = this.createMenuItem('🗑️ Clear console', () => {
            this.clearConsole();
            this.removeMenu(menu);
        });
        menu.appendChild(clearConsoleItem);

        // Logging toggle option
        const loggingToggleItem = this.createMenuItem(
            this.isLoggingEnabled ? '🔇 Logging off' : '🔊 Logging on',
            () => {
                this.toggleLogging();
                this.removeMenu(menu);
            }
        );
        menu.appendChild(loggingToggleItem);
    }

    /**
     * Create a menu item element
     * @param {string} text - Menu item text
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} - The menu item element
     */
    createMenuItem(text, onClick) {
        const item = document.createElement('div');
        item.className = 'console-context-menu-item';
        item.innerHTML = text;
        item.addEventListener('click', onClick);
        return item;
    }

    /**
     * Setup menu closing behavior
     * @param {HTMLElement} menu - The context menu element
     */
    setupMenuClosing(menu) {
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                this.removeMenu(menu);
                document.removeEventListener('click', closeMenu);
            }
        };

        // Close menu after a short delay to allow click events to register
        setTimeout(() => {
            document.addEventListener('click', closeMenu, { passive: true });
        }, 100);
    }

    /**
     * Remove context menu
     * @param {HTMLElement} menu - The context menu element
     */
    removeMenu(menu) {
        if (menu && menu.parentNode) {
            menu.classList.remove('show');
            // Wait for animation to complete before removing
            setTimeout(() => {
                if (menu.parentNode) {
                    menu.parentNode.removeChild(menu);
                }
            }, 150);
        }
        if (this.currentMenu === menu) {
            this.currentMenu = null;
        }
    }

    /**
     * Clear console output
     */
    clearConsole() {
        this.consoleOutput.innerHTML = '';
        this.callbacks.onConsoleClear();
    }

    /**
     * Toggle logging state
     */
    toggleLogging() {
        this.isLoggingEnabled = !this.isLoggingEnabled;
        this.callbacks.onLoggingToggle(this.isLoggingEnabled);
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                this.callbacks.onCopyToClipboard(text);
            } else {
                // Fallback for older browsers
                this.fallbackCopyToClipboard(text);
            }
        } catch (err) {
            Logger.console.error('Failed to copy text: ', err);
            this.fallbackCopyToClipboard(text);
        }
    }

    /**
     * Fallback copy method for older browsers
     * @param {string} text - Text to copy
     */
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.id = 'console-copy-textarea';
        textArea.name = 'console-copy-textarea';
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
            Logger.console.error('Fallback copy failed: ', err);
        }
        
        document.body.removeChild(textArea);
    }

    /**
     * Get current logging state
     * @returns {boolean} - Whether logging is enabled
     */
    getLoggingState() {
        return this.isLoggingEnabled;
    }

    /**
     * Set logging state
     * @param {boolean} enabled - Whether to enable logging
     */
    setLoggingState(enabled) {
        this.isLoggingEnabled = enabled;
    }

    /**
     * Destroy context menu and clean up event listeners
     */
    destroy() {
        this.removeExistingMenu();
        if (this.currentMenu) {
            this.removeMenu(this.currentMenu);
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        // Note: Other event listeners will be cleaned up automatically when elements are removed
    }
}
