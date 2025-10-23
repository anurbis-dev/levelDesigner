/**
 * Auto Event Handler Manager
 * Automatic system for registering handlers for all windows
 */

import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from './EventHandlerManager.js';
import { UniversalWindowHandlers } from '../handlers/UniversalWindowHandlers.js';

export class AutoEventHandlerManager {
    constructor() {
        this.registeredWindows = new Map(); // Map<windowId, { instance, type, handlers }>
        this.observer = null;
        this.initialized = false;
        Logger.event.info('🔄 Auto Event Handler Manager created');
    }

    /**
     * Initialize AutoEventHandlerManager after DOM is loaded
     */
    init() {
        if (this.initialized) return;

        this.initialized = true;
        this.setupAutoRegistration();
        Logger.event.info('🔄 Auto Event Handler Manager initialized');
    }

    /**
     * Setup automatic handler registration
     */
    setupAutoRegistration() {
        // Use MutationObserver to track new windows
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkForNewWindow(node);
                    }
                });
            });
        });

        // Start observing DOM changes
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        Logger.event.debug('AutoEventHandlerManager: Auto-registration observer started');
    }

    /**
     * Check new element for windows
     * @param {HTMLElement} element - Element to check
     */
    checkForNewWindow(element) {
        // Only check elements that could potentially be windows or panels
        if (!element || !element.tagName) return;

        // Skip elements that are unlikely to be windows or panels
        const tagName = element.tagName.toLowerCase();
        if (!['div', 'section', 'main', 'article', 'aside'].includes(tagName)) return;

        // Skip elements that don't have IDs or classes that suggest they might be windows/panels
        if (!element.id && !element.className) return;

        // Check if element itself is a window or panel
        const windowInfo = this.detectWindowType(element);
        if (windowInfo) {
            Logger.event.info(`AutoEventHandlerManager: Found window ${element.id} of type ${windowInfo.type}, instance: ${windowInfo.instance ? 'found' : 'not found'}`);
            this.registerWindowAutomatically(element, windowInfo);

            // If it's a panel, also register child element handlers
            if (windowInfo.type === 'layers-panel' || windowInfo.type === 'asset-panel') {
                this.registerPanelChildElements(element, windowInfo);
            }
        }

        // Check child elements (dialogs and windows)
        const childWindows = element.querySelectorAll('[id*="overlay"], [id*="dialog"], [id*="window"]');
        childWindows.forEach(child => {
            if (child !== element) { // Avoid checking the same element twice
            const childWindowInfo = this.detectWindowType(child);
            if (childWindowInfo) {
                Logger.event.debug(`AutoEventHandlerManager: Found child window ${child.id} of type ${childWindowInfo.type}`);
                this.registerWindowAutomatically(child, childWindowInfo);
                }
            }
        });

        // Check panels (separately from windows)
        const panels = element.querySelectorAll('[id*="panel"][class*="panel-container"]');
        panels.forEach(panel => {
            if (panel !== element) { // Avoid checking the same element twice
                const panelWindowInfo = this.detectWindowType(panel);
                if (panelWindowInfo) {
                    Logger.event.debug(`AutoEventHandlerManager: Found panel ${panel.id} of type ${panelWindowInfo.type}`);
                    this.registerWindowAutomatically(panel, panelWindowInfo);

                    // Also register handlers for child elements within the panel
                    this.registerPanelChildElements(panel, panelWindowInfo);
                }
            }
        });
    }

    /**
     * Register handlers for child elements within a panel
     * @param {HTMLElement} panel - Panel element
     * @param {Object} panelInfo - Panel type information
     */
    registerPanelChildElements(panel, panelInfo) {
        const { type, instance } = panelInfo;

        // Register handlers for buttons with proper event isolation
        this.registerElementTypeHandlers(panel, '.layer-visibility-btn', 'layerButton', instance);
        this.registerElementTypeHandlers(panel, '.layer-lock-btn', 'layerButton', instance);
        this.registerElementTypeHandlers(panel, '.layer-color', 'layerColor', instance);

        // Register handlers for layer items (main content area)
        this.registerElementTypeHandlers(panel, '.layer-item', 'layerItem', instance);

        // Register handlers for other elements
        this.registerElementTypeHandlers(panel, '#layers-search', 'searchInput', instance);
        // Note: #add-layer-btn is handled through panel click handlers, not as separate element

        // Register input handlers for layer name editing
        this.registerInputHandlers(panel, '[id^="layer-name-"]', 'layerNameInput', instance);
        this.registerInputHandlers(panel, '.layer-parallax-input', 'parallaxInput', instance);
    }

    /**
     * Register handlers for specific element types within a panel
     * @param {HTMLElement} panel - Panel element
     * @param {string} selector - CSS selector for elements
     * @param {string} elementType - Type of element for handler lookup
     * @param {Object} panelInstance - Panel instance
     */
    registerElementTypeHandlers(panel, selector, elementType, panelInstance) {
        const elements = panel.querySelectorAll(selector);

        elements.forEach((element, index) => {
            const elementId = element.id || `${elementType}_${Date.now()}_${index}`;

            // Create handlers based on element type
            const handlers = this.createElementTypeHandlers(elementType, panelInstance);

            if (handlers) {
                try {
                    eventHandlerManager.registerElement(
                        element,
                        'custom',
                        {
                            handlers: handlers,
                            context: panelInstance || this
                        },
                        elementId
                    );
                    Logger.event.debug(`AutoEventHandlerManager: Registered ${elementType} handler for ${elementId}`);
                } catch (error) {
                    Logger.event.warn(`AutoEventHandlerManager: Failed to register ${elementType} handler for ${elementId}:`, error);
                }
            }
        });
    }

    /**
     * Register input handlers for form elements
     * @param {HTMLElement} panel - Panel element
     * @param {string} selector - CSS selector for input elements
     * @param {string} inputType - Type of input for handler lookup
     * @param {Object} panelInstance - Panel instance
     */
    registerInputHandlers(panel, selector, inputType, panelInstance) {
        const inputs = panel.querySelectorAll(selector);

        inputs.forEach((input, index) => {
            const inputId = input.id || `${inputType}_${Date.now()}_${index}`;

            const inputHandlers = this.createInputTypeHandlers(inputType, panelInstance);

            if (inputHandlers) {
                try {
                    eventHandlerManager.registerElement(
                        input,
                        'input',
                        {
                            handlers: inputHandlers,
                            context: panelInstance || this
                        },
                        inputId
                    );
                    Logger.event.debug(`AutoEventHandlerManager: Registered ${inputType} input handler for ${inputId}`);
                } catch (error) {
                    Logger.event.warn(`AutoEventHandlerManager: Failed to register ${inputType} input handler for ${inputId}:`, error);
                }
            }
        });
    }

    /**
     * Create handlers for specific element types
     * @param {string} elementType - Type of element
     * @param {Object} panelInstance - Panel instance
     * @returns {Object} Handlers object or null
     */
    createElementTypeHandlers(elementType, panelInstance) {
        switch (elementType) {
            case 'layerItem':
                return {
                    click: (e) => this.handleLayerItemClick(e, panelInstance)
                };

            case 'layerButton':
                return {
                    click: (e) => this.handleLayerButtonClick(e, panelInstance)
                };

            case 'layerColor':
                return {
                    click: (e) => this.handleLayerColorClick(e, panelInstance)
                };

            case 'searchInput':
                return {
                    // Search inputs are handled by SearchManager, no additional handlers needed
                };

            case 'addButton':
                return {
                    click: (e) => this.handleAddButtonClick(e, panelInstance)
                };

            default:
                return null;
        }
    }

    /**
     * Create input handlers for specific input types
     * @param {string} inputType - Type of input
     * @param {Object} panelInstance - Panel instance
     * @returns {Object} Input handlers object or null
     */
    createInputTypeHandlers(inputType, panelInstance) {
        switch (inputType) {
            case 'layerNameInput':
                return {
                    blur: (e) => this.handleLayerNameInputBlur(e, panelInstance),
                    keydown: (e) => {
                        if (e.key === 'Enter') {
                            e.target.blur();
                        }
                    }
                };

            case 'parallaxInput':
                return {
                    input: (e) => this.handleParallaxInputChange(e, panelInstance),
                    blur: (e) => this.handleParallaxInputBlur(e, panelInstance)
                };

            default:
                return null;
        }
    }

    /**
     * Handle layer color click
     * @param {Event} e - Click event
     * @param {Object} panelInstance - Panel instance
     */
    handleLayerColorClick(e, panelInstance) {
        const colorElement = e.target.closest('.layer-color');
        if (colorElement && panelInstance) {
            const layerId = colorElement.dataset.layerId;
            const level = panelInstance.levelEditor?.getLevel();

            if (level) {
                const layer = level.getLayerById(layerId);
                if (layer && panelInstance.showColorPicker) {
                    panelInstance.showColorPicker(layer, e);
                }
            }
        }
    }

    /**
     * Handle layer name input blur
     * @param {Event} e - Blur event
     * @param {Object} panelInstance - Panel instance
     */
    handleLayerNameInputBlur(e, panelInstance) {
        const input = e.target;
        const layerId = input.dataset.layerId;

        if (layerId && panelInstance && panelInstance.levelEditor) {
            const level = panelInstance.levelEditor.getLevel();
            const layer = level?.getLayerById(layerId);

            if (layer) {
                const oldName = layer.name;
                layer.setName(input.value);
                panelInstance.stateManager.markDirty();

                // Notify about layer name change
                panelInstance.stateManager.notifyLayerChanged(layerId, 'name', layer.name, oldName);
            }
        }
    }

    /**
     * Handle parallax input change
     * @param {Event} e - Input event
     * @param {Object} panelInstance - Panel instance
     */
    handleParallaxInputChange(e, panelInstance) {
        const input = e.target;
        const layerId = input.dataset.layerId;

        if (layerId && panelInstance && panelInstance.levelEditor) {
            const level = panelInstance.levelEditor.getLevel();
            const layer = level?.getLayerById(layerId);

            if (layer) {
                const oldOffset = layer.parallaxOffset;
                const newOffset = parseFloat(input.value) || 0;
                layer.parallaxOffset = newOffset;
                panelInstance.stateManager.markDirty();

                // Notify about layer parallax change
                panelInstance.stateManager.notifyLayerChanged(layerId, 'parallaxOffset', newOffset, oldOffset);
            }
        }
    }

    /**
     * Handle parallax input blur (validation)
     * @param {Event} e - Blur event
     * @param {Object} panelInstance - Panel instance
     */
    handleParallaxInputBlur(e, panelInstance) {
        const input = e.target;
        const value = parseFloat(input.value);

        if (isNaN(value)) {
            input.value = 0;
            const layerId = input.dataset.layerId;

            if (layerId && panelInstance && panelInstance.levelEditor) {
                const level = panelInstance.levelEditor.getLevel();
                const layer = level?.getLayerById(layerId);

                if (layer) {
                    layer.parallaxOffset = 0;
                }
            }
        }
    }

    /**
     * Detect window type from element
     * @param {HTMLElement} element - Element to check
     * @returns {Object|null} Window type information or null
     */
    detectWindowType(element) {
        const id = element.id;
        const className = typeof element.className === 'string' ? element.className : '';
        
        Logger.event.debug(`AutoEventHandlerManager: Checking element ${id} with class ${className}`);
        
        // Check by ID and classes
        const windowTypes = [
            { id: 'settings-overlay', class: 'settings', type: 'settings', instance: 'SettingsPanel' },
            { id: 'actor-properties-overlay', class: 'actor-properties-container', type: 'actor-properties', instance: 'ActorPropertiesWindow' },
            { id: 'universal-dialog-overlay', class: 'universal-dialog', type: 'universal-dialog', instance: 'UniversalDialog' },
            { id: 'asset-panel-container', class: 'asset-panel-container', type: 'asset-panel', instance: 'AssetPanel' },
            { id: 'layers-content-panel', class: 'layers-panel-container', type: 'layers-panel', instance: 'LayersPanel' },
            { id: 'canvas-container', class: 'canvas-container', type: 'canvas-container', instance: 'CanvasRenderer' },
            { id: 'main-canvas', class: 'main-canvas', type: 'canvas', instance: 'CanvasRenderer' }
        ];
        
        for (const windowType of windowTypes) {
            if (id === windowType.id || className.includes(windowType.class)) {
                Logger.event.info(`AutoEventHandlerManager: Detected window type ${windowType.type} for element ${id}`);
                return { type: windowType.type, instance: this.findWindowInstance(windowType.instance) };
            }
        }
        
        return null;
    }

    /**
     * Find window instance in global objects
     * @param {string} windowType - Window type
     * @returns {Object|null} Window instance or null
     */
    findWindowInstance(windowType) {
        if (!window.editor) {
            Logger.event.warn(`AutoEventHandlerManager: window.editor not found for ${windowType}`);
            return null;
        }
        
        const instanceMap = {
            'SettingsPanel': 'settingsPanel',
            'ActorPropertiesWindow': 'actorPropertiesWindow',
            'AssetPanel': 'assetPanel',
            'LayersPanel': 'layersPanel',
            'UniversalDialog': null // Created dynamically
        };
        
        const propertyName = instanceMap[windowType];
        const instance = propertyName ? window.editor[propertyName] : null;
        
        if (instance) {
            Logger.event.info(`AutoEventHandlerManager: Found instance ${propertyName} for ${windowType}`);
        } else {
            Logger.event.warn(`AutoEventHandlerManager: No instance found for ${windowType} (property: ${propertyName})`);
        }
        
        return instance;
    }

    /**
     * Creates handlers depending on window type
     * @param {HTMLElement} element - Window element
     * @param {string} type - Window type
     * @param {Object} instance - Window instance
     * @param {string} windowId - Window ID
     * @returns {Object} Configuration for EventHandlerManager
     */
    createElementHandlers(element, type, instance, windowId) {
        // Use universal handlers for dialogs
        if (type === 'settings' || type === 'actor-properties' || type === 'universal-dialog') {
            const handlers = UniversalWindowHandlers.createUniversalHandlers(instance, type);

            return {
                elementType: 'dialog',
                config: {
                    handlers: {
                        click: handlers.onClick,
                        contextmenu: handlers.onContextMenu
                    },
                    context: instance || this,
                    globalHandlers: {
                        keydown: (e) => {
                            if (e.key === 'Escape') {
                                handlers.onEscape();
                            }
                        },
                        overlayClick: handlers.onOverlayClick
                    }
                }
            };
        }

        // Use panel handlers for panels
        if (type === 'asset-panel' || type === 'layers-panel') {
            return this.createPanelHandlers(element, type, instance, windowId);
        }

        // Use canvas handlers for canvas elements
        if (type === 'canvas-container' || type === 'canvas') {
            return this.createCanvasHandlers(element, type, instance, windowId);
        }

        // Fallback for unknown types
        Logger.event.warn(`AutoEventHandlerManager: Unknown window type ${type}, using default handlers`);
        const handlers = UniversalWindowHandlers.createUniversalHandlers(instance, type);

        return {
            elementType: 'dialog',
            config: {
                handlers: {
                    click: handlers.onClick,
                    contextmenu: handlers.onContextMenu
                },
                context: instance || this
            }
        };
    }

    /**
     * Create handlers for canvas elements
     * @param {HTMLElement} element - Canvas element
     * @param {string} type - Canvas type
     * @param {Object} instance - Canvas instance
     * @param {string} windowId - Window ID
     * @returns {Object} Configuration for EventHandlerManager
     */
    createCanvasHandlers(element, type, instance, windowId) {
        Logger.event.debug(`AutoEventHandlerManager: Creating canvas handlers for ${type}`);
        
        return {
            elementType: 'canvas',
            config: {
                handlers: {
                    click: (e) => {
                        Logger.event.debug(`Canvas ${type} clicked`);
                        // Canvas click events are handled by the canvas renderer
                        // No need to prevent default or stop propagation
                    },
                    contextmenu: (e) => {
                        Logger.event.debug(`Canvas ${type} context menu`);
                        // Canvas context menu events are handled by the canvas renderer
                    }
                },
                context: instance || this
            }
        };
    }

    /**
     * Creates handlers for panels
     * @param {HTMLElement} element - Panel element
     * @param {string} type - Panel type
     * @param {Object} instance - Panel instance
     * @param {string} windowId - Panel ID
     * @returns {Object} Configuration for EventHandlerManager
     */
    createPanelHandlers(element, type, instance, windowId) {
        const handlers = this.createPanelSpecificHandlers(type, instance);

        return {
            elementType: 'panel',
            config: {
                handlers: {
                    click: handlers.onClick,
                    contextmenu: handlers.onContextMenu,
                    // Add specific panel handlers
                    ...handlers.panelHandlers
                },
                context: instance || this,
                // Panels don't have global handlers like dialogs
                globalHandlers: handlers.globalHandlers || {}
            }
        };
    }

    /**
     * Creates specific handlers for different panel types
     * @param {string} type - Panel type
     * @param {Object} instance - Panel instance
     * @returns {Object} Handlers for the panel
     */
    createPanelSpecificHandlers(type, instance) {
        const baseHandlers = {
            onClick: (e) => {
                Logger.ui.debug(`Panel ${type}: Click event on`, e.target);
                this.handlePanelClick(e, type, instance);
            },
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                Logger.ui.debug(`Panel ${type}: Context menu on`, e.target);
            }
        };

        if (type === 'layers-panel') {
            return {
                ...baseHandlers,
                panelHandlers: {
                    // Specific handlers for layers-panel
                    layerItemClick: (e) => this.handleLayerItemClick(e, instance),
                    layerButtonClick: (e) => this.handleLayerButtonClick(e, instance)
                },
                globalHandlers: {
                    // Panels may have their own global handlers
                }
            };
        }

        if (type === 'asset-panel') {
            return {
                ...baseHandlers,
                panelHandlers: {
                    // Specific handlers for asset-panel
                    assetItemClick: (e) => this.handleAssetItemClick(e, instance)
                }
            };
        }

        return baseHandlers;
    }

    /**
     * Handles clicks in panels
     * @param {Event} e - Click event
     * @param {string} type - Panel type
     * @param {Object} instance - Panel instance
     */
    handlePanelClick(e, type, instance) {
        const target = e.target;
        Logger.ui.debug(`Panel ${type}: Handling click on ${target.className} ${target.id}`);

        // Use common element type handlers instead of panel-specific logic
        this.handleCommonElementClick(e, instance);
    }

    /**
     * Handles clicks using common element type logic
     * @param {Event} e - Click event
     * @param {Object} instance - Panel instance
     */
    handleCommonElementClick(e, instance) {
        const target = e.target;

        // Handle button clicks first (they are inside layer items) - highest priority
        const isButtonClick = target.closest('.layer-visibility-btn, .layer-lock-btn, .layer-color');
        if (isButtonClick) {
            this.handleLayerButtonClick(e, instance);
            return; // Don't process further if it's a button click
        }

        // Handle input clicks (they are inside layer items)
        const isInputClick = target.closest('.layer-name-input, .layer-parallax-input');
        if (isInputClick) {
            return; // Inputs are handled by their own handlers in LayersPanel.js
        }

        // Handle layer item clicks (but not if clicking on interactive elements inside)
        if (target.closest('.layer-item')) {
            this.handleLayerItemClick(e, instance);
        }

        // Handle search input clicks (handled by input handlers)
        if (target.closest('#layers-search, #asset-search')) {
            return;
        }

        // Handle add buttons
        if (target.closest('#add-layer-btn, #add-asset-btn')) {
            this.handleAddButtonClick(e, instance);
        }
    }

    /**
     * Handles clicks on layer items
     * @param {Event} e - Click event
     * @param {Object} instance - Panel instance
     */
    handleLayerItemClick(e, instance) {
        const target = e.target;
        const layerElement = target.closest('.layer-item');

        if (layerElement) {
            // Only handle clicks on the layer name display area or the main content area
            // Don't handle clicks on buttons, inputs, or other interactive elements
            const isInteractiveElement = target.closest('.layer-visibility-btn, .layer-lock-btn, .layer-color, .layer-name-input, .layer-parallax-input, .layer-objects-count');
            if (isInteractiveElement) {
                return;
            }

            // Check if clicking on the name display area or main content
            const isNameArea = target.closest('.layer-name-display');
            const isMainContent = target === layerElement || target.closest('.flex.items-center.space-x-2');

            if (!isNameArea && !isMainContent) {
                return; // Only allow selection when clicking on name or main content area
            }

            const layerId = layerElement.dataset.layerId;

            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Click - select all objects in layer
                if (instance && typeof instance.selectAllObjectsInLayer === 'function') {
                    instance.selectAllObjectsInLayer(layerId);
                }
            } else {
                // Normal click - set current layer
                if (instance && typeof instance.setCurrentLayer === 'function') {
                    instance.setCurrentLayer(layerId);
                }
            }
        }
    }

    /**
     * Handles clicks on layer buttons
     * @param {Event} e - Click event
     * @param {Object} instance - Panel instance
     */
    handleLayerButtonClick(e, instance) {
        e.stopPropagation(); // Prevent triggering layer click
        e.preventDefault(); // Prevent default behavior
        const target = e.target;
        const button = target.closest('button');

        if (button && instance) {
            const layerId = button.dataset.layerId;

            if (button.classList.contains('layer-visibility-btn')) {
                if (typeof instance.toggleLayerVisibility === 'function') {
                    instance.toggleLayerVisibility(layerId);
                } else {
                    Logger.ui.warn('LayersPanel: toggleLayerVisibility method not found');
                }
            } else if (button.classList.contains('layer-lock-btn')) {
                if (typeof instance.toggleLayerLock === 'function') {
                    instance.toggleLayerLock(layerId);
                } else {
                    Logger.ui.warn('LayersPanel: toggleLayerLock method not found');
                }
            }
        }
    }

    /**
     * Handles clicks on add buttons
     * @param {Event} e - Click event
     * @param {Object} instance - Panel instance
     */
    handleAddButtonClick(e, instance) {
        const target = e.target;
        const button = target.closest('button');

        if (button) {
            if (button.id === 'add-layer-btn') {
                Logger.ui.debug(`AutoEventHandlerManager: handleAddButtonClick called for ${button.id}`);
                if (instance && typeof instance.onAddLayer === 'function') {
                    instance.onAddLayer(e);
                } else {
                    Logger.ui.warn(`AutoEventHandlerManager: No onAddLayer method found on instance`);
                }
            }
        }
    }

    /**
     * Automatic window registration
     * @param {HTMLElement} element - Window element
     * @param {Object} windowInfo - Window type information
     */
    registerWindowAutomatically(element, windowInfo) {
        const { type, instance } = windowInfo;
        const windowId = element.id || `auto-window-${Date.now()}`;

        Logger.event.debug(`AutoEventHandlerManager: Registering window ${windowId} of type ${type}, instance: ${instance ? 'found' : 'not found'}`);

        // Check if already registered
        if (this.registeredWindows.has(windowId)) {
            Logger.event.debug(`AutoEventHandlerManager: Window ${windowId} already registered`);
            return;
        }

        // If instance not found, save window for later registration
        if (!instance) {
            Logger.event.debug(`AutoEventHandlerManager: Instance not found for ${windowId}, will register later`);
            this.registeredWindows.set(windowId, {
                instance: null,
                type,
                handlers: null,
                element,
                pending: true
            });
            return;
        }

        // Create handlers depending on window type
        const elementConfig = this.createElementHandlers(element, type, instance, windowId);
        
        // Register in EventHandlerManager
        try {
            eventHandlerManager.registerElement(
                element,
                elementConfig.elementType,
                elementConfig.config,
                windowId
            );

            // Save information about registered window
            this.registeredWindows.set(windowId, {
                instance,
                type,
                handlers: elementConfig,
                element,
                pending: false
            });

            Logger.event.info(`AutoEventHandlerManager: Window ${windowId} (${type}) registered automatically`);

            // Add handlers for input fields
            this.setupInputHandlers(element, instance, type);

        } catch (error) {
            Logger.event.error(`AutoEventHandlerManager: Failed to register window ${windowId}:`, error);
        }
    }

    /**
     * Setup handlers for input fields
     * @param {HTMLElement} element - Элемент окна
     * @param {Object} instance - Экземпляр окна
     * @param {string} type - Тип окна
     */
    setupInputHandlers(element, instance, type) {
        const inputs = element.querySelectorAll('input, textarea, select');
        
        inputs.forEach((input, index) => {
            const inputId = input.id || `auto-input-${Date.now()}-${index}`;
            const inputHandlers = UniversalWindowHandlers.createInputHandlers(instance, type);
            
            try {
                eventHandlerManager.registerElement(
                    input,
                    'input',
                    {
                        handlers: inputHandlers,
                        context: instance || this
                    },
                    inputId
                );
            } catch (error) {
                Logger.event.warn(`AutoEventHandlerManager: Failed to register input ${inputId}:`, error);
            }
        });
    }


    /**
     * Unregister window
     * @param {string} windowId - ID окна
     */
    unregisterWindow(windowId) {
        if (this.registeredWindows.has(windowId)) {
            const windowInfo = this.registeredWindows.get(windowId);
            
            // Remove from EventHandlerManager
            eventHandlerManager.unregisterElement(windowId);
            
            // Remove from our list
            this.registeredWindows.delete(windowId);
            
            Logger.event.info(`AutoEventHandlerManager: Window ${windowId} unregistered`);
        }
    }

    /**
     * Register pending windows (when instance becomes available)
     */
    registerPendingWindows() {
        for (const [windowId, windowInfo] of this.registeredWindows) {
            if (windowInfo.pending) {
                // Try to find instance again through detectWindowType
                const windowTypeInfo = this.detectWindowType(windowInfo.element);
                const instance = windowTypeInfo ? windowTypeInfo.instance : null;
                if (instance) {
                    Logger.event.debug(`AutoEventHandlerManager: Found instance for pending window ${windowId}`);
                    
                    // Create handlers depending on window type
                    const elementConfig = this.createElementHandlers(windowInfo.element, windowInfo.type, instance, windowId);
                    
                    // Register in EventHandlerManager
                    try {
                        eventHandlerManager.registerElement(
                            windowInfo.element,
                            elementConfig.elementType,
                            elementConfig.config,
                            windowId
                        );

                        // Update information about registered window
                        windowInfo.instance = instance;
                        windowInfo.handlers = elementConfig;
                        windowInfo.pending = false;

                        Logger.event.info(`AutoEventHandlerManager: Pending window ${windowId} (${windowInfo.type}) registered`);

                        // Add handlers for input fields
                        this.setupInputHandlers(windowInfo.element, instance, windowInfo.type);

                    } catch (error) {
                        Logger.event.error(`AutoEventHandlerManager: Failed to register pending window ${windowId}:`, error);
                    }
                }
            }
        }
    }

    /**
     * Get information about registered windows
     * @returns {Array} List of registered windows
     */
    getRegisteredWindows() {
        return Array.from(this.registeredWindows.entries()).map(([id, info]) => ({
            id,
            type: info.type,
            instance: info.instance,
            element: info.element,
            pending: info.pending
        }));
    }

    /**
     * Cleanup all handlers
     */
    destroy() {
        // Stop observing
        if (this.observer) {
            this.observer.disconnect();
        }

        // Remove all registered windows
        this.registeredWindows.forEach((_, windowId) => {
            this.unregisterWindow(windowId);
        });

        Logger.event.info('🔄 Auto Event Handler Manager destroyed');
    }
}

// Create global instance
export const autoEventHandlerManager = new AutoEventHandlerManager();
