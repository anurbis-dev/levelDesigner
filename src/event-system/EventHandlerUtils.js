/**
 * Simple Event Handler Utilities
 * Helper functions for easy integration with EventHandlerManager
 */

import { Logger } from '../utils/Logger.js';

export class EventHandlerUtils {
    /**
     * Create dialog handlers configuration
     * @param {Function} onEscape - ESC handler
     * @param {Function} onOverlayClick - Overlay click handler
     * @param {Function} onButtonClick - Button click handler
     * @returns {Object} Dialog configuration
     */
    static createDialogHandlers(onEscape, onOverlayClick, onButtonClick) {
        return {
            escape: onEscape,
            overlayClick: onOverlayClick,
            click: {
                selector: 'button, [role="button"]',
                handler: onButtonClick
            }
        };
    }

    /**
     * Create panel handlers configuration
     * @param {Function} onItemClick - Item click handler
     * @param {Function} onButtonClick - Button click handler
     * @param {Function} onInputChange - Input change handler
     * @returns {Object} Panel configuration
     */
    static createPanelHandlers(onItemClick, onButtonClick, onInputChange) {
        return {
            click: {
                selector: '.panel-item, .layer-item, .asset-item',
                handler: onItemClick
            },
            buttonClick: {
                selector: 'button, .btn',
                handler: onButtonClick
            },
            change: {
                selector: 'input, textarea, select',
                handler: onInputChange
            }
        };
    }

    /**
     * Create context menu handlers configuration
     * @param {Function} onMenuItemClick - Menu item click handler
     * @param {Function} onMenuClose - Menu close handler
     * @returns {Object} Context menu configuration
     */
    static createContextMenuHandlers(onMenuItemClick, onMenuClose) {
        return {
            click: {
                selector: '.base-context-menu-item, .menu-item, .context-menu-item',
                handler: onMenuItemClick
            },
            escape: onMenuClose,
            overlayClick: onMenuClose
        };
    }

    /**
     * Create form handlers configuration
     * @param {Function} onSubmit - Form submit handler
     * @param {Function} onInputChange - Input change handler
     * @param {Function} onValidation - Validation handler
     * @returns {Object} Form configuration
     */
    static createFormHandlers(onSubmit, onInputChange, onValidation) {
        return {
            submit: {
                selector: 'form',
                handler: onSubmit
            },
            change: {
                selector: 'input, textarea, select',
                handler: onInputChange
            },
            blur: {
                selector: 'input, textarea, select',
                handler: onValidation
            }
        };
    }

    /**
     * Create button handlers for a single element
     * @param {Function} onClick - Click handler
     * @param {Function} onHover - Hover handler (optional)
     * @param {Function} onLeave - Leave handler (optional)
     * @returns {Object} Button handlers
     */
    static createButtonHandlers(onClick, onHover = null, onLeave = null) {
        const handlers = {
            click: onClick
        };

        if (onHover) handlers.mouseenter = onHover;
        if (onLeave) handlers.mouseleave = onLeave;

        return handlers;
    }

    /**
     * Create input handlers for a single element
     * @param {Function} onChange - Change handler
     * @param {Function} onFocus - Focus handler (optional)
     * @param {Function} onBlur - Blur handler (optional)
     * @param {Function} onKeyDown - Keydown handler (optional)
     * @returns {Object} Input handlers
     */
    static createInputHandlers(onChange, onFocus = null, onBlur = null, onKeyDown = null) {
        const handlers = {
            change: onChange
        };

        if (onFocus) handlers.focus = onFocus;
        if (onBlur) handlers.blur = onBlur;
        if (onKeyDown) handlers.keydown = onKeyDown;

        return handlers;
    }

    /**
     * Register a dialog with simple configuration
     * @param {HTMLElement} dialogElement - Dialog element
     * @param {string} dialogId - Dialog ID
     * @param {Function} onEscape - ESC handler
     * @param {Function} onOverlayClick - Overlay click handler
     * @param {Function} onButtonClick - Button click handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerDialog(dialogElement, dialogId, onEscape, onOverlayClick, onButtonClick, manager) {
        const config = EventHandlerUtils.createDialogHandlers(onEscape, onOverlayClick, onButtonClick);
        manager.registerContainer(dialogElement, config, dialogId);
    }

    /**
     * Register a panel with simple configuration
     * @param {HTMLElement} panelElement - Panel element
     * @param {string} panelId - Panel ID
     * @param {Function} onItemClick - Item click handler
     * @param {Function} onButtonClick - Button click handler
     * @param {Function} onInputChange - Input change handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerPanel(panelElement, panelId, onItemClick, onButtonClick, onInputChange, manager) {
        const config = EventHandlerUtils.createPanelHandlers(onItemClick, onButtonClick, onInputChange);
        manager.registerContainer(panelElement, config, panelId);
    }

    /**
     * Register a context menu with simple configuration
     * @param {HTMLElement} menuElement - Menu element
     * @param {string} menuId - Menu ID
     * @param {Function} onMenuItemClick - Menu item click handler
     * @param {Function} onMenuClose - Menu close handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerContextMenu(menuElement, menuId, onMenuItemClick, onMenuClose, manager) {
        const config = EventHandlerUtils.createContextMenuHandlers(onMenuItemClick, onMenuClose);
        manager.registerContainer(menuElement, config, menuId);
    }

    /**
     * Register a form with simple configuration
     * @param {HTMLElement} formElement - Form element
     * @param {string} formId - Form ID
     * @param {Function} onSubmit - Submit handler
     * @param {Function} onInputChange - Input change handler
     * @param {Function} onValidation - Validation handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerForm(formElement, formId, onSubmit, onInputChange, onValidation, manager) {
        const config = EventHandlerUtils.createFormHandlers(onSubmit, onInputChange, onValidation);
        manager.registerContainer(formElement, config, formId);
    }

    /**
     * Register a single button element
     * @param {HTMLElement} buttonElement - Button element
     * @param {Function} onClick - Click handler
     * @param {Function} onHover - Hover handler (optional)
     * @param {Function} onLeave - Leave handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerButton(buttonElement, onClick, onHover = null, onLeave = null, manager) {
        const handlers = EventHandlerUtils.createButtonHandlers(onClick, onHover, onLeave);
        manager.registerElement(buttonElement, handlers);
    }

    /**
     * Register a single input element
     * @param {HTMLElement} inputElement - Input element
     * @param {Function} onChange - Change handler
     * @param {Function} onFocus - Focus handler (optional)
     * @param {Function} onBlur - Blur handler (optional)
     * @param {Function} onKeyDown - Keydown handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerInput(inputElement, onChange, onFocus = null, onBlur = null, onKeyDown = null, manager) {
        const handlers = EventHandlerUtils.createInputHandlers(onChange, onFocus, onBlur, onKeyDown);
        manager.registerElement(inputElement, handlers);
    }

    /**
     * Create universal window handlers (for backward compatibility)
     * @param {Object} windowInstance - Window instance
     * @param {string} windowType - Window type
     * @returns {Object} Universal handlers configuration
     */
    static createUniversalHandlers(windowInstance, windowType) {
        return {
            escape: () => {
                Logger.event.debug(`Universal handler: ESC for ${windowType}`);
                if (windowInstance) {
                    if (typeof windowInstance.cancel === 'function') {
                        windowInstance.cancel();
                    } else if (typeof windowInstance.hide === 'function') {
                        windowInstance.hide();
                    } else if (typeof windowInstance.close === 'function') {
                        windowInstance.close();
                    }
                }
            },
            overlayClick: () => {
                Logger.event.debug(`Universal handler: Overlay click for ${windowType}`);
                if (windowInstance) {
                    if (typeof windowInstance.cancel === 'function') {
                        windowInstance.cancel();
                    } else if (typeof windowInstance.hide === 'function') {
                        windowInstance.hide();
                    } else if (typeof windowInstance.close === 'function') {
                        windowInstance.close();
                    }
                }
            },
            click: {
                selector: 'button, [role="button"]',
                handler: (e, target) => {
                    Logger.event.debug(`Universal handler: Button click for ${windowType}`, target.id);
                    if (windowInstance) {
                        const buttonId = target.id;
                        if (buttonId.includes('cancel') || buttonId.includes('close')) {
                            if (typeof windowInstance.cancel === 'function') {
                                windowInstance.cancel();
                            }
                        } else if (buttonId.includes('apply') || buttonId.includes('save')) {
                            if (typeof windowInstance.apply === 'function') {
                                windowInstance.apply();
                            }
                        }
                    }
                }
            }
        };
    }
}
