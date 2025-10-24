/**
 * EventHandlerUtils - Utility functions for easy event handling integration
 * 
 * Provides helper functions to quickly add event handling to common UI elements
 */

import { Logger } from '../utils/Logger.js';

export class EventHandlerUtils {
    /**
     * Add event handling to a dialog element
     * @param {HTMLElement} dialogElement - Dialog element
     * @param {string} dialogId - Dialog ID
     * @param {Object} handlers - Event handlers
     * @param {Object} context - Context for handlers (usually 'this')
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static addDialogEventHandling(dialogElement, dialogId, handlers, context, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'dialog',
            handlers: {
                click: handlers.onClick || null,
                keydown: handlers.onKeyDown || null,
                contextmenu: handlers.onContextMenu || null,
                overlayClick: handlers.onOverlayClick || null
            },
            globalHandlers: {
                escape: handlers.onEscape || null,
                enter: handlers.onEnter || null
            },
            context: context
        };

        eventManager.registerElement(dialogElement, 'dialog', config, dialogId);
    }

    /**
     * Add event handling to a button element
     * @param {HTMLElement} button - Button element
     * @param {Object} handlers - Event handlers
     * @param {Object} context - Context for handlers
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static addButtonEventHandling(button, handlers, context, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'button',
            handlers: {
                click: handlers.onClick || null,
                mouseenter: handlers.onMouseEnter || null,
                mouseleave: handlers.onMouseLeave || null
            },
            context: context
        };

        eventManager.registerElement(button, 'button', config);
    }

    /**
     * Add delegated event handling to a container element
     * This is more efficient for multiple similar elements
     * @param {HTMLElement} container - Container element
     * @param {Object} handlers - Event handlers with selectors
     * @param {Object} context - Context for handlers
     * @param {EventHandlerManager} eventManager - Event handler manager
     * @param {string} containerId - Unique ID for the container
     */
    static addDelegatedEventHandling(container, handlers, context, eventManager, containerId) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'delegated',
            handlers: {
                click: handlers.onClick || null,
                mouseenter: handlers.onMouseEnter || null,
                mouseleave: handlers.onMouseLeave || null,
                change: handlers.onChange || null,
                focus: handlers.onFocus || null,
                blur: handlers.onBlur || null,
                keydown: handlers.onKeyDown || null
            },
            selectors: handlers.selectors || {}, // e.g., { buttons: 'button', inputs: 'input' }
            context: context
        };

        eventManager.registerElement(container, 'delegated', config, containerId);
    }

    /**
     * Add event handling to an input element
     * @param {HTMLElement} input - Input element
     * @param {Object} handlers - Event handlers
     * @param {Object} context - Context for handlers
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static addInputEventHandling(input, handlers, context, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'input',
            handlers: {
                focus: handlers.onFocus || null,
                blur: handlers.onBlur || null,
                keydown: handlers.onKeyDown || null,
                change: handlers.onChange || null,
                click: handlers.onClick || null
            },
            context: context
        };

        eventManager.registerElement(input, 'input', config);
    }

    /**
     * Add event handling to a form element
     * @param {HTMLElement} form - Form element
     * @param {Object} handlers - Event handlers
     * @param {Object} context - Context for handlers
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static addFormEventHandling(form, handlers, context, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'form',
            handlers: {
                submit: handlers.onSubmit || null,
                reset: handlers.onReset || null,
                change: handlers.onChange || null
            },
            context: context
        };

        eventManager.registerElement(form, 'form', config);
    }

    /**
     * Add event handling to a context menu element
     * @param {HTMLElement} menu - Context menu element
     * @param {Object} handlers - Event handlers
     * @param {Object} context - Context for handlers
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static addContextMenuEventHandling(menu, handlers, context, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        const config = {
            type: 'contextMenu',
            handlers: {
                click: handlers.onClick || null,
                contextmenu: handlers.onContextMenu || null,
                mouseenter: handlers.onMouseEnter || null,
                mouseleave: handlers.onMouseLeave || null
            },
            context: context
        };

        eventManager.registerElement(menu, 'contextMenu', config);
    }

    /**
     * Remove event handling from an element
     * @param {HTMLElement} element - Element to remove handlers from
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static removeEventHandling(element, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        eventManager.unregisterElement(element);
    }

    /**
     * Remove all event handling for a dialog
     * @param {string} dialogId - Dialog ID
     * @param {EventHandlerManager} eventManager - Event handler manager
     */
    static removeDialogEventHandling(dialogId, eventManager) {
        if (!eventManager) {
            Logger.ui.warn('EventHandlerUtils: EventHandlerManager not provided');
            return;
        }

        eventManager.unregisterDialog(dialogId);
    }

    /**
     * Create a standard dialog handlers object
     * @param {Object} context - Context object (usually 'this')
     * @param {Function} onCancel - Cancel handler
     * @param {Function} onApply - Apply handler (optional)
     * @param {Function} onOverlayClick - Overlay click handler (optional)
     * @returns {Object} Handlers object
     */
    static createDialogHandlers(context, onCancel, onApply = null, onOverlayClick = null) {
        return {
            onEscape: onCancel,
            onOverlayClick: onOverlayClick || onCancel,
            onClick: (e) => {
                if (e.target.id === 'cancel-settings' || e.target.id === 'actor-props-cancel') {
                    onCancel.call(context, e);
                } else if (e.target.id === 'save-settings' || e.target.id === 'actor-props-apply') {
                    if (onApply) {
                        onApply.call(context, e);
                    }
                }
            }
        };
    }

    /**
     * Create a standard button handlers object
     * @param {Object} context - Context object
     * @param {Function} onClick - Click handler
     * @param {Function} onMouseEnter - Mouse enter handler (optional)
     * @param {Function} onMouseLeave - Mouse leave handler (optional)
     * @returns {Object} Handlers object
     */
    static createButtonHandlers(context, onClick, onMouseEnter = null, onMouseLeave = null) {
        return {
            onClick: onClick,
            onMouseEnter: onMouseEnter,
            onMouseLeave: onMouseLeave
        };
    }

    /**
     * Create a standard input handlers object
     * @param {Object} context - Context object
     * @param {Function} onChange - Change handler
     * @param {Function} onFocus - Focus handler (optional)
     * @param {Function} onBlur - Blur handler (optional)
     * @param {Function} onKeyDown - Key down handler (optional)
     * @returns {Object} Handlers object
     */
    static createInputHandlers(context, onChange, onFocus = null, onBlur = null, onKeyDown = null) {
        return {
            onChange: onChange,
            onFocus: onFocus,
            onBlur: onBlur,
            onKeyDown: onKeyDown,
            onClick: (e) => {
                // Make input editable on click
                if (e.target.readOnly) {
                    e.target.readOnly = false;
                    e.target.focus();
                }
            }
        };
    }
}
