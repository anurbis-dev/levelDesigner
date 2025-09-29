/**
 * HoverEffects - Universal hover effects utility
 * Provides consistent hover effects across different UI components
 */
export class HoverEffects {
    /**
     * Apply hover effect to an element
     * @param {HTMLElement} element - Element to apply hover effect to
     * @param {string} effectType - Type of hover effect ('brightness', 'background', 'border', 'class')
     * @param {Object} options - Effect options
     */
    static applyHoverEffect(element, effectType = 'brightness', options = {}) {
        if (!element) return;

        const defaultOptions = {
            brightness: 1.2,
            backgroundColor: '#4B5563', // gray-600
            borderColor: '#9CA3AF', // gray-400
            transition: 'all 0.2s ease',
            hoverClass: 'hover:bg-gray-600'
        };

        const config = { ...defaultOptions, ...options };

        // Store original styles
        if (!element._originalStyles) {
            element._originalStyles = {
                filter: element.style.filter || '',
                backgroundColor: element.style.backgroundColor || '',
                borderColor: element.style.borderColor || '',
                transition: element.style.transition || '',
                classes: Array.from(element.classList)
            };
        }

        // Apply transition
        element.style.transition = config.transition;

        switch (effectType) {
            case 'brightness':
                element.style.filter = `brightness(${config.brightness})`;
                break;
            case 'background':
                element.style.backgroundColor = config.backgroundColor;
                break;
            case 'border':
                element.style.borderColor = config.borderColor;
                break;
            case 'combined':
                element.style.filter = `brightness(${config.brightness})`;
                element.style.backgroundColor = config.backgroundColor;
                break;
            case 'class':
                // Use CSS classes instead of inline styles
                element.classList.add(config.hoverClass);
                break;
        }
    }

    /**
     * Remove hover effect from an element
     * @param {HTMLElement} element - Element to remove hover effect from
     */
    static removeHoverEffect(element) {
        if (!element || !element._originalStyles) return;

        // Restore original styles
        element.style.filter = element._originalStyles.filter;
        element.style.backgroundColor = element._originalStyles.backgroundColor;
        element.style.borderColor = element._originalStyles.borderColor;
        element.style.transition = element._originalStyles.transition;

        // Remove hover classes but preserve selection classes
        if (element._originalStyles.classes) {
            const currentClasses = Array.from(element.classList);
            const selectionClasses = currentClasses.filter(cls => 
                cls === 'selected' || cls === 'active' || cls === 'bg-blue-600'
            );
            
            // Restore original classes and add back selection classes
            element.className = element._originalStyles.classes.join(' ');
            selectionClasses.forEach(cls => element.classList.add(cls));
        }
    }

    /**
     * Setup hover event listeners for an element
     * @param {HTMLElement} element - Element to setup hover for
     * @param {string} effectType - Type of hover effect
     * @param {Object} options - Effect options
     * @param {Array} excludeClasses - CSS classes to exclude from hover effect
     */
    static setupHoverListeners(element, effectType = 'brightness', options = {}, excludeClasses = ['selected', 'active']) {
        if (!element) return;

        element.addEventListener('mouseenter', () => {
            // Check if element should be excluded
            const shouldExclude = excludeClasses.some(className => element.classList.contains(className));
            if (!shouldExclude) {
                this.applyHoverEffect(element, effectType, options);
            }
        });

        element.addEventListener('mouseleave', () => {
            this.removeHoverEffect(element);
        });
    }

    /**
     * Setup hover effect for color indicators (like layer colors)
     * @param {HTMLElement} colorElement - Color indicator element
     * @param {Object} options - Effect options
     */
    static setupColorHover(colorElement, options = {}) {
        if (!colorElement) return;

        const defaultOptions = {
            brightness: 1.3,
            borderColor: '#F3F4F6', // gray-100
            transition: 'all 0.2s ease'
        };

        const config = { ...defaultOptions, ...options };

        // Store original border color
        if (!colorElement._originalBorderColor) {
            colorElement._originalBorderColor = colorElement.style.borderColor || '';
        }

        colorElement.addEventListener('mouseenter', () => {
            colorElement.style.filter = `brightness(${config.brightness})`;
            colorElement.style.borderColor = config.borderColor;
            colorElement.style.transition = config.transition;
        });

        colorElement.addEventListener('mouseleave', () => {
            colorElement.style.filter = '';
            colorElement.style.borderColor = colorElement._originalBorderColor;
        });
    }

    /**
     * Setup hover effect for grid items (like asset thumbnails)
     * @param {HTMLElement} gridItem - Grid item element
     * @param {Object} options - Effect options
     */
    static setupGridItemHover(gridItem, options = {}) {
        if (!gridItem) return;

        const defaultOptions = {
            brightness: 1.2,
            transition: 'all 0.2s ease'
        };

        const config = { ...defaultOptions, ...options };

        this.setupHoverListeners(gridItem, 'brightness', config, ['selected', 'active']);
    }

    /**
     * Setup hover effect for list items
     * @param {HTMLElement} listItem - List item element
     * @param {Object} options - Effect options
     */
    static setupListItemHover(listItem, options = {}) {
        if (!listItem) return;

        const defaultOptions = {
            hoverClass: 'hover:bg-gray-600',
            transition: 'all 0.2s ease'
        };

        const config = { ...defaultOptions, ...options };

        // Add hover class directly to the element
        listItem.classList.add(config.hoverClass);
    }

    /**
     * Remove only hover effects without removing other event listeners
     * @param {HTMLElement} element - Element to remove hover effects from
     */
    static removeHoverOnly(element) {
        if (!element) return;

        // Remove hover effects by restoring original styles
        this.removeHoverEffect(element);

        // Remove stored hover data
        delete element._originalStyles;
        delete element._originalBorderColor;
    }

    /**
     * Remove all hover effects and event listeners from an element
     * @param {HTMLElement} element - Element to clean up
     */
    static cleanup(element) {
        if (!element) return;

        // Remove event listeners by cloning the element
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);

        // Clean up stored data
        delete newElement._originalStyles;
        delete newElement._originalBorderColor;

        return newElement;
    }
}
