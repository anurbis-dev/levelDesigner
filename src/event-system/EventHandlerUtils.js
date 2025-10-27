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
     * @param {Function} onContextMenu - Context menu handler (optional)
     * @returns {Object} Panel configuration
     */
    static createPanelHandlers(onItemClick, onButtonClick, onInputChange, onContextMenu = null) {
        const config = {
            click: {
                selector: '.panel-item, .layer-item, .asset-item, .tab, .settings-tab',
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

        if (onContextMenu) {
            config.contextmenu = {
                selector: '.panel-item, .layer-item, .asset-item, .tab, .settings-tab',
                handler: onContextMenu
            };
        }

        return config;
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
     * @param {Function} onContextMenu - Context menu handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerPanel(panelElement, panelId, onItemClick, onButtonClick, onInputChange, onContextMenu = null, manager) {
        const config = EventHandlerUtils.createPanelHandlers(onItemClick, onButtonClick, onInputChange, onContextMenu);
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
     * Create touch handlers for a single element
     * @param {Function} onTouchStart - Touch start handler
     * @param {Function} onTouchMove - Touch move handler (optional)
     * @param {Function} onTouchEnd - Touch end handler (optional)
     * @param {Function} onTouchCancel - Touch cancel handler (optional)
     * @returns {Object} Touch handlers
     */
    static createTouchHandlers(onTouchStart, onTouchMove = null, onTouchEnd = null, onTouchCancel = null) {
        const handlers = {
            touchstart: onTouchStart
        };

        if (onTouchMove) handlers.touchmove = onTouchMove;
        if (onTouchEnd) handlers.touchend = onTouchEnd;
        if (onTouchCancel) handlers.touchcancel = onTouchCancel;

        return handlers;
    }

    /**
     * Create touch gesture handlers for canvas-like elements
     * @param {Function} onSingleTouch - Single touch handler (tap, drag)
     * @param {Function} onTwoTouch - Two touch handler (pan, zoom)
     * @param {Function} onTouchEnd - Touch end handler
     * @returns {Object} Touch gesture configuration
     */
    static createTouchGestureHandlers(onSingleTouch, onTwoTouch, onTouchEnd) {
        return {
            touchstart: {
                selector: '*',
                handler: (e, target) => {
                    const touches = Array.from(e.touches);
                    if (touches.length === 1) {
                        onSingleTouch(e, touches[0], target);
                    } else if (touches.length === 2) {
                        onTwoTouch(e, touches, target);
                    }
                }
            },
            touchend: {
                selector: '*',
                handler: (e, target) => {
                    onTouchEnd(e, target);
                }
            }
        };
    }

    /**
     * Create touch panel handlers for resizable panels
     * @param {Function} onResizeStart - Resize start handler
     * @param {Function} onResizeMove - Resize move handler
     * @param {Function} onResizeEnd - Resize end handler
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @returns {Object} Touch panel configuration
     */
    static createTouchPanelHandlers(onResizeStart, onResizeMove, onResizeEnd, onDoubleTap = null) {
        const config = {
            touchstart: {
                selector: '.resizer, .resizer-y, .resizer-x',
                handler: (e, target) => {
                    const touch = e.touches[0];
                    onResizeStart(e, touch, target);
                }
            },
            touchmove: {
                selector: '.resizer, .resizer-y, .resizer-x',
                handler: (e, target) => {
                    const touch = e.touches[0];
                    onResizeMove(e, touch, target);
                }
            },
            touchend: {
                selector: '.resizer, .resizer-y, .resizer-x',
                handler: (e, target) => {
                    onResizeEnd(e, target);
                }
            }
        };

        if (onDoubleTap) {
            config.doubleTap = onDoubleTap;
        }

        return config;
    }

    /**
     * Create touch button handlers for interactive buttons
     * @param {Function} onTap - Tap handler
     * @param {Function} onLongPress - Long press handler (optional)
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @returns {Object} Touch button configuration
     */
    static createTouchButtonHandlers(onTap, onLongPress = null, onDoubleTap = null) {
        const config = {
            touchstart: {
                selector: 'button, [role="button"], .touch-button',
                handler: (e, target) => {
                    const touch = e.touches[0];
                    // Handle tap, long press, and double tap logic here
                    onTap(e, touch, target);
                }
            }
        };

        if (onLongPress) {
            config.longPress = onLongPress;
        }

        if (onDoubleTap) {
            config.doubleTap = onDoubleTap;
        }

        return config;
    }

    /**
     * Create advanced touch gesture handlers
     * @param {Function} onSingleTap - Single tap handler
     * @param {Function} onDoubleTap - Double tap handler
     * @param {Function} onLongPress - Long press handler
     * @param {Function} onTouchDrag - Touch drag handler
     * @param {Function} onTwoFingerTap - Two finger tap handler
     * @param {Function} onThreeFingerTap - Three finger tap handler
     * @returns {Object} Advanced touch gesture configuration
     */
    static createAdvancedTouchHandlers(onSingleTap, onDoubleTap, onLongPress, onTouchDrag, onTwoFingerTap, onThreeFingerTap) {
        return {
            // Listen for custom touch events dispatched by TouchHandlers
            touchsingletap: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onSingleTap === 'function') {
                        onSingleTap(e.detail, target);
                    }
                }
            },
            touchdoubletap: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onDoubleTap === 'function') {
                        onDoubleTap(e.detail, target);
                    }
                }
            },
            touchlongpress: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onLongPress === 'function') {
                        onLongPress(e.detail, target);
                    }
                }
            },
            touchdragstart: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onTouchDrag === 'function') {
                        onTouchDrag('start', e.detail, target);
                    }
                }
            },
            touchdrag: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onTouchDrag === 'function') {
                        onTouchDrag('move', e.detail, target);
                    }
                }
            },
            touchdragend: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onTouchDrag === 'function') {
                        onTouchDrag('end', e.detail, target);
                    }
                }
            },
            touchtwofingertap: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onTwoFingerTap === 'function') {
                        onTwoFingerTap(e.detail, target);
                    }
                }
            },
            touchthreefingertap: {
                selector: '*',
                handler: (e, target) => {
                    if (typeof onThreeFingerTap === 'function') {
                        onThreeFingerTap(e.detail, target);
                    }
                }
            }
        };
    }

    /**
     * Register advanced touch gesture handlers
     * @param {HTMLElement} element - Element to register
     * @param {string} elementId - Element ID
     * @param {Function} onSingleTap - Single tap handler
     * @param {Function} onDoubleTap - Double tap handler
     * @param {Function} onLongPress - Long press handler
     * @param {Function} onTouchDrag - Touch drag handler
     * @param {Function} onTwoFingerTap - Two finger tap handler
     * @param {Function} onThreeFingerTap - Three finger tap handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerAdvancedTouchElement(element, elementId, onSingleTap, onDoubleTap, onLongPress, onTouchDrag, onTwoFingerTap, onThreeFingerTap, manager) {
        const config = EventHandlerUtils.createAdvancedTouchHandlers(onSingleTap, onDoubleTap, onLongPress, onTouchDrag, onTwoFingerTap, onThreeFingerTap);
        manager.registerElement(element, config, elementId);
    }

    /**
     * Register a touch-enabled element
     * @param {HTMLElement} element - Element to register
     * @param {Function} onTouchStart - Touch start handler
     * @param {Function} onTouchMove - Touch move handler (optional)
     * @param {Function} onTouchEnd - Touch end handler (optional)
     * @param {Function} onTouchCancel - Touch cancel handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerTouchElement(element, onTouchStart, onTouchMove = null, onTouchEnd = null, onTouchCancel = null, manager) {
        const handlers = EventHandlerUtils.createTouchHandlers(onTouchStart, onTouchMove, onTouchEnd, onTouchCancel);
        manager.registerElement(element, handlers);
    }

    /**
     * Register a touch gesture container
     * @param {HTMLElement} containerElement - Container element
     * @param {string} containerId - Container ID
     * @param {Function} onSingleTouch - Single touch handler
     * @param {Function} onTwoTouch - Two touch handler
     * @param {Function} onTouchEnd - Touch end handler
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerTouchGestureContainer(containerElement, containerId, onSingleTouch, onTwoTouch, onTouchEnd, manager) {
        const config = EventHandlerUtils.createTouchGestureHandlers(onSingleTouch, onTwoTouch, onTouchEnd);
        manager.registerContainer(containerElement, config, containerId);
    }

    /**
     * Register a touch panel with resize support
     * @param {HTMLElement} panelElement - Panel element
     * @param {string} panelId - Panel ID
     * @param {Function} onResizeStart - Resize start handler
     * @param {Function} onResizeMove - Resize move handler
     * @param {Function} onResizeEnd - Resize end handler
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerTouchPanel(panelElement, panelId, onResizeStart, onResizeMove, onResizeEnd, onDoubleTap = null, manager) {
        const config = EventHandlerUtils.createTouchPanelHandlers(onResizeStart, onResizeMove, onResizeEnd, onDoubleTap);
        manager.registerContainer(panelElement, config, panelId);
    }

    /**
     * Register touch button handlers
     * @param {HTMLElement} buttonElement - Button element
     * @param {Function} onTap - Tap handler
     * @param {Function} onLongPress - Long press handler (optional)
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @param {EventHandlerManager} manager - Event manager
     */
    static registerTouchButton(buttonElement, onTap, onLongPress = null, onDoubleTap = null, manager) {
        const config = EventHandlerUtils.createTouchButtonHandlers(onTap, onLongPress, onDoubleTap);
        manager.registerContainer(buttonElement, config);
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
