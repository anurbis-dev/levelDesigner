/**
 * TouchSupportUtils - Utility functions for easy touch support integration
 * 
 * Provides helper functions to quickly add touch support to common UI elements
 */

import { Logger } from './Logger.js';

export class TouchSupportUtils {
    /**
     * Add touch support to a button element
     * @param {HTMLElement} button - Button element
     * @param {Function} onClick - Click handler
     * @param {Function} onDoubleClick - Double click handler (optional)
     * @param {Function} onLongPress - Long press handler (optional)
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addButtonTouchSupport(button, onClick, onDoubleClick = null, onLongPress = null, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(button, 'button', {
            onTap: onClick,
            onDoubleTap: onDoubleClick,
            onLongPress: onLongPress
        });
    }

    /**
     * Add touch support to a draggable element
     * @param {HTMLElement} element - Draggable element
     * @param {Function} onDragStart - Drag start handler
     * @param {Function} onDrag - Drag handler
     * @param {Function} onDragEnd - Drag end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addDragTouchSupport(element, onDragStart, onDrag, onDragEnd, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'tabDragger', {
            onDragStart: onDragStart,
            onDrag: onDrag,
            onDragEnd: onDragEnd
        });
    }

    /**
     * Add marquee selection touch support
     * @param {HTMLElement} element - Element to add marquee support to
     * @param {Function} onMarqueeStart - Marquee start handler
     * @param {Function} onMarqueeMove - Marquee move handler
     * @param {Function} onMarqueeEnd - Marquee end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addMarqueeTouchSupport(element, onMarqueeStart, onMarqueeMove, onMarqueeEnd, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'marqueeSelection', {
            onMarqueeStart: onMarqueeStart,
            onMarqueeMove: onMarqueeMove,
            onMarqueeEnd: onMarqueeEnd
        });
    }

    /**
     * Add long press marquee selection touch support
     * @param {HTMLElement} element - Element to add long press marquee support to
     * @param {Function} onMarqueeStart - Marquee start handler
     * @param {Function} onMarqueeMove - Marquee move handler
     * @param {Function} onMarqueeEnd - Marquee end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     * @param {number} longPressDelay - Long press delay in milliseconds (default: 500)
     */
    static addLongPressMarqueeTouchSupport(element, onMarqueeStart, onMarqueeMove, onMarqueeEnd, touchManager, longPressDelay = 500) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'longPressMarquee', {
            onMarqueeStart: onMarqueeStart,
            onMarqueeMove: onMarqueeMove,
            onMarqueeEnd: onMarqueeEnd,
            longPressDelay: longPressDelay
        });
    }

    /**
     * Add two finger pan touch support
     * @param {HTMLElement} element - Element to add pan support to
     * @param {Function} onPanStart - Pan start handler
     * @param {Function} onPanMove - Pan move handler
     * @param {Function} onPanEnd - Pan end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addTwoFingerPanSupport(element, onPanStart, onPanMove, onPanEnd, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'twoFingerPan', {
            onPanStart: onPanStart,
            onPanMove: onPanMove,
            onPanEnd: onPanEnd
        });
    }

    /**
     * Add two finger context menu touch support
     * @param {HTMLElement} element - Element to add context support to
     * @param {Function} onTwoFingerTap - Two finger tap handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addTwoFingerContextSupport(element, onTwoFingerTap, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'twoFingerContext', {
            onTwoFingerTap: onTwoFingerTap
        });
    }

    /**
     * Add two finger zoom touch support
     * @param {HTMLElement} element - Element to add zoom support to
     * @param {Function} onZoomStart - Zoom start handler
     * @param {Function} onZoomMove - Zoom move handler
     * @param {Function} onZoomEnd - Zoom end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addTwoFingerZoomSupport(element, onZoomStart, onZoomMove, onZoomEnd, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'twoFingerZoom', {
            onZoomStart: onZoomStart,
            onZoomMove: onZoomMove,
            onZoomEnd: onZoomEnd
        });
    }

    /**
     * Add combined two finger pan and zoom support to an element
     * @param {HTMLElement} element - Target element
     * @param {Function} onPanStart - Pan start handler
     * @param {Function} onPanMove - Pan move handler
     * @param {Function} onPanEnd - Pan end handler
     * @param {Function} onZoomStart - Zoom start handler
     * @param {Function} onZoomMove - Zoom move handler
     * @param {Function} onZoomEnd - Zoom end handler
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addTwoFingerPanZoomSupport(element, onPanStart, onPanMove, onPanEnd, onZoomStart, onZoomMove, onZoomEnd, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }


        touchManager.registerElement(element, 'twoFingerPanZoom', {
            onPanStart: onPanStart,
            onPanMove: onPanMove,
            onPanEnd: onPanEnd,
            onZoomStart: onZoomStart,
            onZoomMove: onZoomMove,
            onZoomEnd: onZoomEnd
        });
    }


    /**
     * Add touch support to a resizable element
     * @param {HTMLElement} resizer - Resizer element
     * @param {string} direction - 'horizontal' or 'vertical'
     * @param {number} minSize - Minimum size
     * @param {number} maxSize - Maximum size
     * @param {Function} onResizeStart - Resize start handler
     * @param {Function} onResize - Resize handler
     * @param {Function} onResizeEnd - Resize end handler
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addResizeTouchSupport(resizer, direction, minSize, maxSize, onResizeStart, onResize, onResizeEnd, onDoubleTap = null, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(resizer, 'panelResizer', {
            direction: direction,
            minSize: minSize,
            maxSize: maxSize,
            onResizeStart: onResizeStart,
            onResize: onResize,
            onResizeEnd: onResizeEnd,
            onDoubleTap: onDoubleTap
        });
    }

    /**
     * Add touch support to a context menu trigger
     * @param {HTMLElement} element - Context menu trigger element
     * @param {Function} onLongPress - Long press handler
     * @param {Function} onTap - Tap handler (optional)
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addContextMenuTouchSupport(element, onLongPress, onTap = null, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(element, 'button', {
            onLongPress: onLongPress,
            onTap: onTap,
            longPressDelay: 500
        });
    }

    /**
     * Add touch support to a tab element
     * @param {HTMLElement} tab - Tab element
     * @param {Function} onTap - Tap handler
     * @param {Function} onDoubleTap - Double tap handler (optional)
     * @param {Function} onLongPress - Long press handler (optional)
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addTabTouchSupport(tab, onTap, onDoubleTap = null, onLongPress = null, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(tab, 'button', {
            onTap: onTap,
            onDoubleTap: onDoubleTap,
            onLongPress: onLongPress
        });
    }

    /**
     * Add touch support to a list item
     * @param {HTMLElement} item - List item element
     * @param {Function} onTap - Tap handler
     * @param {Function} onLongPress - Long press handler (optional)
     * @param {Function} onSwipeLeft - Swipe left handler (optional)
     * @param {Function} onSwipeRight - Swipe right handler (optional)
     * @param {TouchSupportManager} touchManager - Touch support manager
     */
    static addListItemTouchSupport(item, onTap, onLongPress = null, onSwipeLeft = null, onSwipeRight = null, touchManager) {
        if (!touchManager) {
            Logger.ui.warn('TouchSupportUtils: TouchSupportManager not provided');
            return;
        }

        touchManager.registerElement(item, 'button', {
            onTap: onTap,
            onLongPress: onLongPress
        });
    }

    /**
     * Check if device supports touch
     * @returns {boolean} - True if touch is supported
     */
    static isTouchSupported() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Check if device is mobile
     * @returns {boolean} - True if device is mobile
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Get optimal touch target size for device
     * @returns {number} - Recommended touch target size in pixels
     */
    static getOptimalTouchSize() {
        if (this.isMobile()) {
            return 48; // Larger for mobile
        }
        return 44; // Standard minimum
    }

    /**
     * Apply touch-friendly styles to an element
     * @param {HTMLElement} element - Element to style
     * @param {Object} options - Styling options
     */
    static applyTouchStyles(element, options = {}) {
        const defaults = {
            minHeight: this.getOptimalTouchSize(),
            minWidth: this.getOptimalTouchSize(),
            touchAction: 'manipulation', // Allow tap but prevent other gestures
            userSelect: 'none',
            cursor: 'pointer'
        };

        const styles = { ...defaults, ...options };
        
        Object.assign(element.style, styles);
    }

    /**
     * Create a touch-friendly button
     * @param {string} text - Button text
     * @param {Function} onClick - Click handler
     * @param {Object} options - Button options
     * @returns {HTMLButtonElement} - Touch-friendly button
     */
    static createTouchButton(text, onClick, options = {}) {
        const button = document.createElement('button');
        button.textContent = text;
        button.addEventListener('click', onClick);
        
        this.applyTouchStyles(button, {
            padding: '12px 16px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
            ...options
        });
        
        return button;
    }

    /**
     * Add haptic feedback (if supported)
     * @param {string} type - Type of haptic feedback ('light', 'medium', 'heavy')
     */
    static hapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: [10],
                medium: [20],
                heavy: [30]
            };
            navigator.vibrate(patterns[type] || patterns.light);
        }
    }
}
