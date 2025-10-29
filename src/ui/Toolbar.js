import { Logger } from '../utils/Logger.js';
import { BaseContextMenu } from './BaseContextMenu.js';
import { CommandAvailability } from '../utils/CommandAvailability.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { EventHandlerUtils } from '../event-system/EventHandlerUtils.js';
import { HorizontalScrollUtils } from '../utils/HorizontalScrollUtils.js';

/**
 * Toolbar UI component
 * Provides a horizontal toolbar with various control buttons
 */
export class Toolbar {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.isVisible = true;
        
        // Scrolling will be handled by HorizontalScrollUtils
        
        // Context menu state
        this.showIcons = true;
        this.showText = true;
        this.contextMenu = null;
        
        // Grid type carousel state - will be initialized dynamically
        this.gridTypes = [];
        this.currentGridTypeIndex = 0;
        this.gridTypeConfig = new Map();
        this.settingsMenuItemAdded = false;
        
        // Initialize grid types from available renderers first
        this.initializeGridTypes();
        
        // Load saved state before rendering
        this.loadStateBeforeRender();
        
        this.setupEventListeners();
        this.render();
        // Setup horizontal scrolling after render
        this.setupHorizontalScrolling();
        this.setupContextMenu();
        // Setup new event handlers
        this.setupNewEventHandlers();
        // Load scroll position after toolbar is fully rendered
        this.loadScrollPosition();
    }

    /**
     * Setup new event handlers using EventHandlerManager
     */
    setupNewEventHandlers() {
        if (!this.container) {
            Logger.ui.warn('Toolbar: Container not found');
            return;
        }

        // Create toolbar handlers configuration manually (not using createPanelHandlers)
        const toolbarHandlers = {
            click: {
                selector: 'button',
                handler: (e) => {
                    const button = e.target.closest('button');
                    if (button) {
                        this.onButtonClick(e);
                    }
                }
            },
            change: {
                selector: 'input, textarea, select',
                handler: (e) => this.onInputChange(e)
            },
            mouseenter: {
                selector: 'button',
                handler: (e) => this.onButtonHover(e)
            },
            mouseleave: {
                selector: 'button',
                handler: (e) => this.onButtonLeave(e)
            },
            focus: {
                selector: 'input, textarea, select',
                handler: (e) => this.onInputFocus(e)
            },
            blur: {
                selector: 'input, textarea, select',
                handler: (e) => this.onInputBlur(e)
            },
            keydown: {
                selector: 'input, textarea, select',
                handler: (e) => this.onInputKeyDown(e)
            }
        };

        // Register container with new event manager
        eventHandlerManager.registerContainer(this.container, toolbarHandlers);

        Logger.ui.debug('Toolbar: New event handlers setup complete');
    }

    /**
     * Handle button clicks
     * @param {Event} e - Click event
     */
    onButtonClick(e) {
        e.preventDefault();
        
        const button = e.target.closest('button');
        if (!button) return;
        
        // Don't handle clicks on disabled buttons
        if (button.style.pointerEvents === 'none') return;
        
        const action = button.getAttribute('data-action');
        const buttonId = button.id;
        
        Logger.ui.debug('Toolbar: Button clicked:', { buttonId, action });
        
        // Handle Ctrl+Click for grid type cycling
        if (action === 'toggleGrid' && e.ctrlKey) {
            this.cycleGridType();
            return;
        }
        
        // Handle async action
        if (action) {
            (async () => {
                await this.handleAction(action);
            })();
        }
        
        // Handle specific button actions by ID (legacy support)
        if (buttonId === 'toggleGrid') {
            this.levelEditor.toggleGrid();
        } else if (buttonId === 'toggleSnapToGrid') {
            this.levelEditor.toggleSnapToGrid();
        } else if (buttonId === 'toggleParallax') {
            this.levelEditor.toggleParallax();
        } else if (buttonId === 'toggleObjectBoundaries') {
            this.levelEditor.toggleObjectBoundaries();
        } else if (buttonId === 'toggleObjectCollisions') {
            this.levelEditor.toggleObjectCollisions();
        }
    }

    /**
     * Handle button hover
     * @param {Event} e - Mouse enter event
     */
    onButtonHover(e) {
        Logger.ui.debug('Toolbar: Button hover:', e.target.id);
    }

    /**
     * Handle button leave
     * @param {Event} e - Mouse leave event
     */
    onButtonLeave(e) {
        Logger.ui.debug('Toolbar: Button leave:', e.target.id);
    }

    /**
     * Handle input changes
     * @param {Event} e - Input event
     */
    onInputChange(e) {
        const input = e.target;
        const inputId = input.id;
        
        Logger.ui.debug('Toolbar: Input changed:', inputId);
        
        // Handle specific input actions
        if (inputId === 'grid-size') {
            this.levelEditor.setGridSize(parseInt(input.value));
        }
        // Add more input handlers as needed
    }

    /**
     * Handle input focus
     * @param {Event} e - Focus event
     */
    onInputFocus(e) {
        Logger.ui.debug('Toolbar: Input focus:', e.target.id);
    }

    /**
     * Handle input blur
     * @param {Event} e - Blur event
     */
    onInputBlur(e) {
        Logger.ui.debug('Toolbar: Input blur:', e.target.id);
    }

    /**
     * Handle input key down
     * @param {Event} e - Key down event
     */
    onInputKeyDown(e) {
        Logger.ui.debug('Toolbar: Input key down:', e.target.id, e.key);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for toolbar visibility changes
        this.stateManager.subscribe('view.toolbar', (visible) => {
            this.setVisible(visible);
        });

        // Listen for grid changes (use canvas.showGrid as single source of truth)
        this.stateManager.subscribe('canvas.showGrid', (enabled) => {
            this.updateToggleButtonState('toggleGrid', enabled);
            this.levelEditor.eventHandlers.updateViewCheckbox('grid', enabled);
        });
        // Subscribe to canvas.snapToGrid as primary source (settings panel changes)
        this.stateManager.subscribe('canvas.snapToGrid', (enabled) => {
            this.updateToggleButtonState('toggleSnapToGrid', enabled);
            this.levelEditor.eventHandlers.updateViewCheckbox('snapToGrid', enabled);
        });
        this.stateManager.subscribe('view.parallax', (enabled) => {
            this.updateToggleButtonState('toggleParallax', enabled);
            this.levelEditor.eventHandlers.updateViewCheckbox('parallax', enabled);
        });
        this.stateManager.subscribe('view.objectBoundaries', (enabled) => {
            this.updateToggleButtonState('toggleObjectBoundaries', enabled);
            this.levelEditor.eventHandlers.updateViewCheckbox('objectBoundaries', enabled);
        });
        this.stateManager.subscribe('view.objectCollisions', (enabled) => {
            this.updateToggleButtonState('toggleObjectCollisions', enabled);
            this.levelEditor.eventHandlers.updateViewCheckbox('objectCollisions', enabled);
        });

        // Listen for selection changes to update command availability
        this.stateManager.subscribe('selectedObjects', () => {
            this.updateCommandAvailability();
        });

        // Listen for history changes to update undo/redo availability
        // History changes are handled through level editor events, so we listen to a proxy event
        if (this.levelEditor?.historyManager) {
            // Since history manager doesn't emit events directly, we'll update on selection changes
            // and add a manual update after undo/redo operations in handleAction
        }
    }

    /**
     * Render toolbar
     */
    render() {
        this.container.innerHTML = '';

        this.container.style.display = this.isVisible ? 'flex' : 'none';
        
        // Create toolbar content with horizontal scrolling
        const toolbarContent = document.createElement('div');
        toolbarContent.className = 'flex items-center space-x-2 overflow-x-auto scrollbar-hide';
        toolbarContent.style.cssText = `
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
            white-space: nowrap;
            min-width: 100%;
            height: 100%;
        `;
        
        // Hide scrollbar for webkit browsers
        const style = document.createElement('style');
        style.textContent = `
            .toolbar-scroll::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(style);
        toolbarContent.classList.add('toolbar-scroll');
        
        // Add button groups
        toolbarContent.appendChild(this.createButtonGroup('File', [
            { id: 'new-level', label: 'New', icon: '📄', action: 'newLevel' },
            { id: 'open-level', label: 'Open', icon: '📂', action: 'openLevel' },
            { id: 'save-level', label: 'Save', icon: '💾', action: 'saveLevel' }
        ]));
        
        toolbarContent.appendChild(this.createButtonGroup('Edit', [
            { id: 'undo', label: 'Undo', icon: '↶', action: 'undo' },
            { id: 'redo', label: 'Redo', icon: '↷', action: 'redo' },
            { id: 'duplicate', label: 'Duplicate', icon: '📋', action: 'duplicate' },
            { id: 'delete', label: 'Delete', icon: '🗑️', action: 'deleteSelected' }
        ]));
        
        toolbarContent.appendChild(this.createButtonGroup('View', [
            { id: 'toggle-grid', label: 'Grid', icon: '⊞', action: 'toggleGrid', toggle: true, gridType: 'rectangular' },
            { id: 'toggle-snap', label: 'Snap', icon: '🧲', action: 'toggleSnapToGrid', toggle: true },
            { id: 'toggle-parallax', label: 'Parallax', icon: '🌊', action: 'toggleParallax', toggle: true },
            { id: 'toggle-boundaries', label: 'Boundaries', icon: '📐', action: 'toggleObjectBoundaries', toggle: true },
            { id: 'toggle-collisions', label: 'Collisions', icon: '💥', action: 'toggleObjectCollisions', toggle: true },
            { id: 'focus-selection', label: 'Focus', icon: '🎯', action: 'focusSelection' },
            { id: 'focus-all', label: 'Focus All', icon: '🔍', action: 'focusAll' }
        ]));
        
        toolbarContent.appendChild(this.createButtonGroup('Group', [
            { id: 'group-selected', label: 'Group', icon: '📦', action: 'groupSelected' },
            { id: 'ungroup-selected', label: 'Ungroup', icon: '📤', action: 'ungroupSelected' }
        ]));

        this.container.appendChild(toolbarContent);
        
        // Store reference to toolbar content for scrolling
        this.toolbarContent = toolbarContent;
        
        // Apply current display settings immediately
        this.updateButtonDisplay();

        // Apply current toggle states from StateManager
        this.updateToggleStates();

        // Load collapsed states
        this.loadCollapsedStates();

        // Update command availability based on current context
        this.updateCommandAvailability();
        
        // Update grid button icon after render
        this.updateGridButtonIcon();
    }

    /**
     * Create button group
     */
    createButtonGroup(title, buttons) {
        const group = document.createElement('div');
        group.className = 'flex items-center space-x-1';
        
        // Add collapsible title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'text-xs mr-2 cursor-pointer select-none';
        titleSpan.style.color = 'var(--ui-text-color, #9ca3af)';
        titleSpan.addEventListener('mouseenter', () => {
            titleSpan.style.color = 'var(--ui-text-color, #d1d5db)';
        });
        titleSpan.addEventListener('mouseleave', () => {
            titleSpan.style.color = 'var(--ui-text-color, #9ca3af)';
        });
        titleSpan.textContent = title;
        titleSpan.setAttribute('data-collapsed', 'false');
        
        // Add click handler for collapsing/expanding
        titleSpan.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleGroupCollapse(titleSpan, group);
        });
        
        group.appendChild(titleSpan);
        
        // Add buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'flex items-center space-x-1';
        buttonsContainer.setAttribute('data-buttons-container', 'true');
        
        // Add buttons to container
        buttons.forEach(button => {
            buttonsContainer.appendChild(this.createButton(button));
        });
        
        group.appendChild(buttonsContainer);

        return group;
    }

    /**
     * Create individual button
     */
    createButton(config) {
        const button = document.createElement('button');
        button.id = `toolbar-${config.id}`;
        button.className = 'px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded flex items-center space-x-1 transition-colors cursor-pointer';
        button.setAttribute('data-action', config.action);
        button.setAttribute('title', config.label);
        
        // Add icon
        const iconSpan = document.createElement('span');
        iconSpan.className = 'icon';
        iconSpan.textContent = config.icon;
        button.appendChild(iconSpan);
        
        // Add label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'text';
        labelSpan.textContent = config.label;
        button.appendChild(labelSpan);

        // Add toggle state if applicable
        if (config.toggle) {
            button.classList.add('toggle-button');
            this.updateToggleState(button, config.action);
        }

        return button;
    }


    /**
     * Handle toolbar action
     */
    async handleAction(action) {
        try {
            Logger.ui.info(`Toolbar action: ${action}`);
            
            // Handle toggle actions
            if (action.startsWith('toggle')) {
                this.handleToggleAction(action);
                return;
            }

            // Handle other actions
            switch (action) {
                case 'newLevel':
                    this.levelEditor.newLevel();
                    break;
                case 'openLevel':
                    this.levelEditor.openLevel();
                    break;
                case 'saveLevel':
                    await this.levelEditor.saveLevel();
                    break;
                case 'undo':
                    this.levelEditor.undo();
                    // Update command availability after undo
                    requestAnimationFrame(() => this.updateCommandAvailability());
                    break;
                case 'redo':
                    this.levelEditor.redo();
                    // Update command availability after redo
                    requestAnimationFrame(() => this.updateCommandAvailability());
                    break;
                case 'duplicate':
                    this.levelEditor.duplicateSelectedObjects();
                    break;
                case 'deleteSelected':
                    this.levelEditor.deleteSelectedObjects();
                    break;
                case 'focusSelection':
                    this.levelEditor.focusOnSelection();
                    break;
                case 'focusAll':
                    this.levelEditor.focusOnAll();
                    break;
                case 'groupSelected':
                    this.levelEditor.groupSelectedObjects();
                    break;
                case 'ungroupSelected':
                    this.levelEditor.ungroupSelectedObjects();
                    break;
                default:
                    Logger.ui.warn(`Unknown toolbar action: ${action}`);
            }
        } catch (error) {
            Logger.ui.error(`Error handling toolbar action ${action}:`, error);
        }
    }

    /**
     * Handle toggle actions
     */
    handleToggleAction(action) {
        const button = this.container.querySelector(`[data-action="${action}"]`);
        if (!button) return;

        // Update button state immediately
        this.toggleButtonState(button);

        // Get the option name for the method call
        let option;
        switch (action) {
            case 'toggleGrid':
                option = 'grid';
                break;
            case 'toggleSnapToGrid':
                option = 'snapToGrid';
                break;
            case 'toggleParallax':
                option = 'parallax';
                break;
            case 'toggleObjectBoundaries':
                option = 'objectBoundaries';
                break;
            case 'toggleObjectCollisions':
                option = 'objectCollisions';
                break;
            default:
                return;
        }

        // Apply the view option (StateManager already updated by toggleButtonState)
        requestAnimationFrame(() => {
            let enabled;
            if (action === 'toggleGrid') {
                // Grid uses canvas.showGrid as single source of truth
                enabled = this.stateManager.get('canvas.showGrid');
            } else {
                enabled = this.stateManager.get(`view.${option}`);
            }
            
            this.levelEditor.eventHandlers.applyViewOption(option, enabled);
            // Update menu checkbox state to match toolbar button
            this.levelEditor.eventHandlers.updateViewCheckbox(option, enabled);
            // Save to config for persistence
            if (action === 'toggleGrid') {
                // Grid uses canvas.showGrid as primary storage
                this.levelEditor.configManager.set('canvas.showGrid', enabled);
            } else if (option === 'snapToGrid') {
                // Snap to grid uses canvas.snapToGrid as primary storage
                this.levelEditor.configManager.set('canvas.snapToGrid', enabled);
            } else {
                // Other view options use editor.view.* path
                this.levelEditor.configManager.set(`editor.view.${option}`, enabled);
            }
        });
    }

    /**
     * Toggle button state immediately
     */
    toggleButtonState(button) {
        if (!button.classList.contains('toggle-button')) return;

        // Get the action to determine the state key
        const action = button.getAttribute('data-action');
        let stateKey;
        
        switch (action) {
            case 'toggleGrid':
                stateKey = 'canvas.showGrid';
                break;
            case 'toggleSnapToGrid':
                stateKey = 'view.snapToGrid';
                break;
            case 'toggleParallax':
                stateKey = 'view.parallax';
                break;
            case 'toggleObjectBoundaries':
                stateKey = 'view.objectBoundaries';
                break;
            case 'toggleObjectCollisions':
                stateKey = 'view.objectCollisions';
                break;
            default:
                return;
        }

        // Get current state from StateManager and toggle it
        const currentState = this.stateManager.get(stateKey) || false;
        const newState = !currentState;
        
        // Update StateManager immediately
        this.stateManager.set(stateKey, newState);
        
        // Update visual state based on new state
        if (newState) {
            button.classList.add('bg-blue-600', 'hover:bg-blue-700');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        } else {
            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }

        // Save state after change
        this.saveState();
    }

    /**
     * Update toggle button state based on StateManager
     */
    updateToggleState(button, action) {
        if (!button.classList.contains('toggle-button')) return;

        let isActive = false;

        switch (action) {
            case 'toggleGrid':
                isActive = this.stateManager.get('canvas.showGrid') || false;
                break;
            case 'toggleSnapToGrid':
                isActive = this.stateManager.get('view.snapToGrid') || false;
                break;
            case 'toggleParallax':
                isActive = this.stateManager.get('view.parallax') || false;
                break;
            case 'toggleObjectBoundaries':
                isActive = this.stateManager.get('view.objectBoundaries') || false;
                break;
            case 'toggleObjectCollisions':
                isActive = this.stateManager.get('view.objectCollisions') || false;
                break;
        }

        if (isActive) {
            button.classList.add('bg-blue-600', 'hover:bg-blue-700');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        } else {
            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    }

    /**
     * Update specific toggle button state by action
     */
    updateToggleButtonState(action, enabled) {
        const button = this.container.querySelector(`[data-action="${action}"]`);
        if (!button || !button.classList.contains('toggle-button')) return;

        if (enabled) {
            button.classList.add('bg-blue-600', 'hover:bg-blue-700');
            button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
        } else {
            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-gray-700', 'hover:bg-gray-600');
        }
    }

    /**
     * Update command availability for all buttons
     */
    updateCommandAvailability() {
        // Commands that depend on selection context
        const contextCommands = [
            'duplicate', 'deleteSelected', 'groupSelected', 'ungroupSelected', 'focusSelection'
        ];

        // Commands that depend on history
        const historyCommands = ['undo', 'redo'];

        // Update context-dependent commands
        contextCommands.forEach(command => {
            const action = command;
            const available = CommandAvailability.check(command, this.levelEditor);
            this.updateButtonAvailability(action, available);
        });

        // Update history-dependent commands
        historyCommands.forEach(command => {
            const action = command;
            const available = CommandAvailability.check(command, this.levelEditor);
            this.updateButtonAvailability(action, available);
        });
    }

    /**
     * Update button availability (enabled/disabled state)
     */
    updateButtonAvailability(action, available) {
        const button = this.container.querySelector(`[data-action="${action}"]`);
        if (!button) return;

        if (available) {
            button.classList.remove('opacity-50', 'cursor-not-allowed');
            button.classList.add('cursor-pointer');
            button.style.pointerEvents = 'auto';
        } else {
            button.classList.add('opacity-50', 'cursor-not-allowed');
            button.classList.remove('cursor-pointer');
            button.style.pointerEvents = 'none';
        }
    }

    /**
     * Set toolbar visibility
     */
    setVisible(visible) {
        this.isVisible = visible;
        if (visible) {
            this.container.style.display = 'flex';
        } else {
            this.container.style.display = 'none';
        }

        // Resize canvas to adapt to new available space
        if (this.levelEditor?.canvasRenderer) {
            this.levelEditor.canvasRenderer.resizeCanvas();
            this.levelEditor.render();
        }

        this.saveState();
    }

    /**
     * Get toolbar visibility
     */
    getVisible() {
        return this.isVisible;
    }

    /**
     * Save toolbar state to configuration
     */
    saveState() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        const buttonStates = {};
        const buttons = this.container.querySelectorAll('button[data-action]');

        buttons.forEach(button => {
            const action = button.getAttribute('data-action');
            const isActive = button.classList.contains('bg-blue-600');
            buttonStates[action] = isActive;
        });

        // Save collapsed sections state
        const collapsedSections = {};
        const groups = this.container.querySelectorAll('[data-collapsed]');
        groups.forEach(titleSpan => {
            const sectionName = titleSpan.textContent.replace('▼', '').trim();
            const isCollapsed = titleSpan.getAttribute('data-collapsed') === 'true';
            collapsedSections[sectionName] = isCollapsed;
        });

        // Toolbar state saved

        // Save to config manager
        this.levelEditor.configManager.set('toolbar.buttonStates', buttonStates);
        this.levelEditor.configManager.set('toolbar.collapsedSections', collapsedSections);

        // Save toolbar visibility to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set('toolbarVisible', this.isVisible);
        }
    }

    /**
     * Load toolbar state from configuration
     */
    loadState() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        // Load button states from config (for compatibility)
        const buttonStates = this.levelEditor.configManager.get('toolbar.buttonStates') || {};
        const buttons = this.container.querySelectorAll('button[data-action]');

        buttons.forEach(button => {
            const action = button.getAttribute('data-action');
            const isActive = buttonStates[action];

            if (typeof isActive === 'boolean') {
                if (isActive) {
                    button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                    button.classList.remove('bg-gray-700', 'hover:bg-gray-600');
                } else {
                    button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    button.classList.add('bg-gray-700', 'hover:bg-gray-600');
                }
            }
        });

        // Load collapsed states
        this.loadCollapsedStates();

        // Sync with current StateManager state (this will override config states)
        this.updateToggleStates();

        // Update command availability to set pointer events correctly
        this.updateCommandAvailability();
    }

    /**
     * Save collapsed state of a section
     */
    saveCollapsedState(sectionName, isCollapsed) {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        const collapsedSections = this.levelEditor.configManager.get('toolbar.collapsedSections') || {};
        collapsedSections[sectionName] = isCollapsed;
        this.levelEditor.configManager.set('toolbar.collapsedSections', collapsedSections);
        
        // Section collapsed state saved
    }

    /**
     * Load collapsed states of all sections
     */
    loadCollapsedStates() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        const collapsedSections = this.levelEditor.configManager.get('toolbar.collapsedSections') || {};
        const groups = this.container.querySelectorAll('[data-collapsed]');

        groups.forEach(titleSpan => {
            const sectionName = titleSpan.textContent.replace('▼', '').trim();
            const isCollapsed = collapsedSections[sectionName];

            if (typeof isCollapsed === 'boolean' && isCollapsed) {
                const group = titleSpan.parentElement;
                const buttonsContainer = group.querySelector('[data-buttons-container="true"]');

                if (buttonsContainer) {
                    buttonsContainer.style.display = 'none';
                    titleSpan.setAttribute('data-collapsed', 'true');
                    titleSpan.textContent = '▼ ' + sectionName;
                }
            }
        });

    }

    /**
     * Save display state (icons and text visibility)
     */
    saveDisplayState() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        this.levelEditor.configManager.set('toolbar.display.showIcons', this.showIcons);
        this.levelEditor.configManager.set('toolbar.display.showText', this.showText);
        
        // Save toolbar scroll position to user preferences
        if (this.levelEditor.userPrefs && this.toolbarContent) {
            this.levelEditor.userPrefs.set('toolbarScrollLeft', this.toolbarContent.scrollLeft);
        }
        
        // Display state saved
    }

    /**
     * Load display state (icons and text visibility)
     */
    loadDisplayState() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        const showIcons = this.levelEditor.configManager.get('toolbar.display.showIcons');
        const showText = this.levelEditor.configManager.get('toolbar.display.showText');

        if (typeof showIcons === 'boolean') {
            this.showIcons = showIcons;
        }
        if (typeof showText === 'boolean') {
            this.showText = showText;
        }

        // Apply the loaded settings
        this.updateButtonDisplay();

        // Display state loaded
    }

    /**
     * Load toolbar scroll position from user preferences
     */
    loadScrollPosition() {
        if (this.levelEditor && this.levelEditor.userPrefs && this.toolbarContent) {
            const savedScrollLeft = this.levelEditor.userPrefs.get('toolbarScrollLeft');
            if (typeof savedScrollLeft === 'number' && savedScrollLeft >= 0) {
                this.toolbarContent.scrollLeft = savedScrollLeft;
                Logger.ui.debug(`Toolbar scroll position restored: ${savedScrollLeft}px`);
            }
        }
    }

    /**
     * Load state before rendering (only settings that affect initial render)
     */
    loadStateBeforeRender() {
        if (!this.levelEditor || !this.levelEditor.configManager) return;

        // Load visibility from user preferences (fallback to configManager)
        const visible = this.levelEditor.userPrefs?.get('toolbarVisible') ??
                       this.levelEditor.configManager.get('editor.view.toolbar') ?? true;
        if (typeof visible === 'boolean') {
            this.isVisible = visible;
        }

        // Load display settings
        const showIcons = this.levelEditor.configManager.get('toolbar.display.showIcons');
        const showText = this.levelEditor.configManager.get('toolbar.display.showText');

        if (typeof showIcons === 'boolean') {
            this.showIcons = showIcons;
        }
        if (typeof showText === 'boolean') {
            this.showText = showText;
        }

        // Load saved grid type from user preferences
        const savedGridType = this.levelEditor.userPrefs?.get('gridType') || 
                             this.levelEditor.configManager?.get('canvas.gridType') || 
                             this.gridTypes[0] || 'rectangular';
        const gridTypeIndex = this.gridTypes.indexOf(savedGridType);
        if (gridTypeIndex !== -1) {
            this.currentGridTypeIndex = gridTypeIndex;
        } else {
            // Fallback to first available type
            this.currentGridTypeIndex = 0;
            Logger.ui.warn(`Saved grid type '${savedGridType}' not found, using first available: '${this.gridTypes[0]}'`);
        }
    }

    /**
     * Update all toggle states
     */
    updateToggleStates() {
        // Update each toggle button from StateManager
        this.updateToggleButtonState('toggleGrid', this.stateManager.get('canvas.showGrid') || false);
        this.updateToggleButtonState('toggleSnapToGrid', this.stateManager.get('canvas.snapToGrid') || false);
        this.updateToggleButtonState('toggleParallax', this.stateManager.get('view.parallax') || false);
        this.updateToggleButtonState('toggleObjectBoundaries', this.stateManager.get('view.objectBoundaries') || false);
        this.updateToggleButtonState('toggleObjectCollisions', this.stateManager.get('view.objectCollisions') || false);
        
        // Update grid button icon based on current grid type
        this.updateGridButtonIcon();
    }

    /**
     * Initialize grid types from available renderers
     */
    initializeGridTypes() {
        // Default grid type configuration
        const defaultConfig = [
            { type: 'rectangular', icon: '⊞', label: 'Rectangular' },
            { type: 'diamond', icon: '◇', label: 'Diamond' },
            { type: 'hexagonal', icon: '⬡', label: 'Hexagonal' }
        ];

        // Try to get available renderers from canvas renderer
        if (this.levelEditor?.canvasRenderer?.gridRenderers) {
            this.gridTypes = Array.from(this.levelEditor.canvasRenderer.gridRenderers.keys());
            
            // Create configuration map
            this.gridTypeConfig.clear();
            this.gridTypes.forEach((type, index) => {
                const config = defaultConfig.find(c => c.type === type) || {
                    type: type,
                    icon: '⊞', // fallback icon
                    label: type.charAt(0).toUpperCase() + type.slice(1)
                };
                this.gridTypeConfig.set(type, config);
            });
        } else {
            // Fallback to default configuration
            this.gridTypes = defaultConfig.map(c => c.type);
            this.gridTypeConfig.clear();
            defaultConfig.forEach(config => {
                this.gridTypeConfig.set(config.type, config);
            });
        }

        Logger.ui.debug(`Initialized ${this.gridTypes.length} grid types: ${this.gridTypes.join(', ')}`);
        
        // Update context menu with grid types
        if (this.contextMenu) {
            this.addGridTypeMenuItems();
        }
    }

    /**
     * Refresh grid types from available renderers
     * Call this when renderers are added/removed
     */
    refreshGridTypes() {
        const oldTypes = [...this.gridTypes];
        this.initializeGridTypes();
        
        // Check if current type is still available
        const currentType = this.gridTypes[this.currentGridTypeIndex];
        if (!currentType || !this.gridTypes.includes(currentType)) {
            this.currentGridTypeIndex = 0;
            Logger.ui.warn(`Current grid type no longer available, switched to: ${this.gridTypes[0]}`);
        }
        
        // Update button icon if types changed
        if (JSON.stringify(oldTypes) !== JSON.stringify(this.gridTypes)) {
            this.updateGridButtonIcon();
            Logger.ui.info(`Grid types updated: ${this.gridTypes.join(', ')}`);
            
            // Update context menu with new grid types
            if (this.contextMenu) {
                this.addGridTypeMenuItems();
            }
        }
    }

    /**
     * Update grid button icon based on current grid type
     */
    updateGridButtonIcon() {
        const gridButton = this.container.querySelector('[data-action="toggleGrid"]');
        if (!gridButton) return;

        const currentGridType = this.gridTypes[this.currentGridTypeIndex];
        const config = this.gridTypeConfig.get(currentGridType);
        const iconElement = gridButton.querySelector('.icon');
        if (iconElement && config) {
            iconElement.textContent = config.icon;
        }
    }

    /**
     * Cycle to next grid type
     */
    cycleGridType() {
        if (this.gridTypes.length === 0) {
            Logger.ui.warn('No grid types available for cycling');
            return;
        }
        
        this.currentGridTypeIndex = (this.currentGridTypeIndex + 1) % this.gridTypes.length;
        const newGridType = this.gridTypes[this.currentGridTypeIndex];
        
        // Update config manager
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('canvas.gridType', newGridType);
        }
        
        // Update state manager
        if (this.stateManager) {
            this.stateManager.set('canvas.gridType', newGridType);
        }
        
        // Save to user preferences
        if (this.levelEditor?.userPrefs) {
            this.levelEditor.userPrefs.set('gridType', newGridType);
        }
        
        // Update button icon
        this.updateGridButtonIcon();
        
        // Trigger grid settings sync and re-render
        if (this.levelEditor?.settingsPanel?.gridSettings) {
            this.levelEditor.settingsPanel.gridSettings.syncAllGridSettingsToState('canvas.gridType', newGridType);
        }
        
        Logger.ui.info(`Grid type changed to: ${newGridType}`);
    }

    /**
     * Setup horizontal scrolling for toolbar
     */
    setupHorizontalScrolling() {
        if (!this.container || !this.toolbarContent) return;
        
        // Setup horizontal scrolling with wheel and drag
        HorizontalScrollUtils.setupHorizontalScrolling(this.toolbarContent, {
            sensitivity: 0.5,
            scrollKey: 'toolbarScrollLeft',
            userPrefs: this.levelEditor?.userPrefs,
            onScrollChange: (scrollLeft) => {
                Logger.ui.debug(`Toolbar: Scroll position changed to ${scrollLeft}px`);
            }
        });
        
        Logger.ui.debug('Toolbar: Horizontal scrolling setup completed');
    }

    /**
     * Toggle group collapse/expand
     */
    toggleGroupCollapse(titleSpan, group) {
        const isCollapsed = titleSpan.getAttribute('data-collapsed') === 'true';
        const buttonsContainer = group.querySelector('[data-buttons-container="true"]');
        const sectionName = titleSpan.textContent.replace('▼', '').trim();
        
        if (isCollapsed) {
            // Expand group
            buttonsContainer.style.display = 'flex';
            titleSpan.setAttribute('data-collapsed', 'false');
            titleSpan.textContent = sectionName;
        } else {
            // Collapse group
            buttonsContainer.style.display = 'none';
            titleSpan.setAttribute('data-collapsed', 'true');
            titleSpan.textContent = '▼ ' + sectionName;
        }

        // Save collapsed state
        this.saveCollapsedState(sectionName, !isCollapsed);
        
        Logger.ui.debug(`Toolbar group ${isCollapsed ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Setup context menu for toolbar
     */
    setupContextMenu() {
        this.contextMenu = new BaseContextMenu(this.container, {
            onMenuShow: () => {},
            onMenuHide: () => {}
        });

        // Override positioning to always open downward
        const originalCalculatePosition = this.contextMenu.calculateOptimalPosition.bind(this.contextMenu);
        this.contextMenu.calculateOptimalPosition = (event, menu) => {
            const position = originalCalculatePosition(event, menu);
            
            // Force menu to open downward for toolbar
            const toolbarRect = this.container.getBoundingClientRect();
            position.y = toolbarRect.bottom + 5; // 5px gap below toolbar
            
            return position;
        };

        // Add menu items
        this.contextMenu.addMenuItem('Hide', '👁️', () => this.hideToolbar());
        this.contextMenu.addMenuItem('Icons', '🎨', () => this.toggleIcons());
        this.contextMenu.addMenuItem('Text', '📝', () => this.toggleText());
        
        // Add separator before Grid section
        this.contextMenu.addSeparator();
        
        // Add Grid section - will be populated after grid types are initialized
        this.setupGridContextMenu();
    }

    /**
     * Set specific grid type
     * @param {string} gridType - Grid type to set
     * @returns {boolean} - true if type was set successfully
     */
    setGridType(gridType) {
        const gridTypeIndex = this.gridTypes.indexOf(gridType);
        if (gridTypeIndex === -1) {
            Logger.ui.warn(`Grid type '${gridType}' not found in available types`);
            return false;
        }
        
        this.currentGridTypeIndex = gridTypeIndex;
        const newGridType = this.gridTypes[this.currentGridTypeIndex];
        
        // Update config manager
        if (this.levelEditor?.configManager) {
            this.levelEditor.configManager.set('canvas.gridType', newGridType);
        }
        
        // Update state manager
        if (this.stateManager) {
            this.stateManager.set('canvas.gridType', newGridType);
        }
        
        // Save to user preferences
        if (this.levelEditor?.userPrefs) {
            this.levelEditor.userPrefs.set('gridType', newGridType);
        }
        
        // Trigger grid settings sync and re-render
        if (this.levelEditor?.settingsPanel?.gridSettings) {
            this.levelEditor.settingsPanel.gridSettings.syncAllGridSettingsToState('canvas.gridType', newGridType);
        }
        
        // Update button icon
        this.updateGridButtonIcon();
        
        // Update context menu items disabled state
        if (this.contextMenu) {
            this.addGridTypeMenuItems();
        }
        
        // Trigger re-render
        if (this.levelEditor?.render) {
            // Clear grid caches when grid type changes
            if (this.levelEditor.canvasRenderer?.clearGridCaches) {
                this.levelEditor.canvasRenderer.clearGridCaches();
            }
            this.levelEditor.render();
        }
        
        Logger.ui.debug(`Grid type changed to: ${newGridType}`);
        return true;
    }

    /**
     * Setup Grid context menu section
     */
    setupGridContextMenu() {
        // Add Settings command first (only once) - this ensures it's always at the bottom
        if (!this.settingsMenuItemAdded) {
            this.contextMenu.addMenuItem('Settings...', '⚙️', () => {
                if (this.levelEditor && typeof this.levelEditor.openSettings === 'function') {
                    this.levelEditor.openSettings();
                }
            }, {
                id: 'grid-settings'
            });
            this.settingsMenuItemAdded = true;
        }
        
        // Add Grid type switching commands dynamically
        this.addGridTypeMenuItems();
    }

    /**
     * Add Grid type menu items dynamically
     */
    addGridTypeMenuItems() {
        // Clear existing grid type items (if any)
        this.clearGridTypeMenuItems();
        
        // Find Settings item position to insert grid types before it
        const settingsIndex = this.contextMenu.menuItems.findIndex(item => item.id === 'grid-settings');
        const insertIndex = settingsIndex !== -1 ? settingsIndex : this.contextMenu.menuItems.length;
        
        // Add current grid types before Settings
        this.gridTypes.forEach((gridType, index) => {
            const config = this.gridTypeConfig.get(gridType);
            if (config) {
                const isCurrentType = this.currentGridTypeIndex === index;
                const menuItem = {
                    text: config.label,
                    icon: config.icon,
                    action: () => this.setGridType(gridType),
                    visible: () => this.gridTypes.length > 0,
                    id: `grid-type-${gridType}`,
                    className: isCurrentType ? 'current-grid-type' : ''
                };
                
                // Insert at the correct position
                this.contextMenu.menuItems.splice(insertIndex + index, 0, menuItem);
            }
        });
    }

    /**
     * Clear Grid type menu items
     */
    clearGridTypeMenuItems() {
        if (this.contextMenu && this.contextMenu.menuItems) {
            // Remove only grid type items, keep Settings and other items
            this.contextMenu.menuItems = this.contextMenu.menuItems.filter(item => 
                !item.id || !item.id.startsWith('grid-type-')
            );
        }
    }

    /**
     * Hide toolbar
     */
    hideToolbar() {
        this.stateManager.set('view.toolbar', false);
        // Update menu checkbox to reflect toolbar state
        this.levelEditor.eventHandlers.updateViewCheckbox('toolbar', false);
        // Close context menu after hiding toolbar
        if (this.contextMenu) {
            this.contextMenu.hideMenu();
        }
        Logger.ui.debug('Toolbar hidden via context menu');
    }

    /**
     * Toggle icons visibility
     */
    toggleIcons() {
        this.showIcons = !this.showIcons;
        this.updateButtonDisplay();
        this.saveDisplayState();
        Logger.ui.debug(`Toolbar icons ${this.showIcons ? 'shown' : 'hidden'}`);
    }

    /**
     * Toggle text visibility
     */
    toggleText() {
        this.showText = !this.showText;
        this.updateButtonDisplay();
        this.saveDisplayState();
        Logger.ui.debug(`Toolbar text ${this.showText ? 'shown' : 'hidden'}`);
    }

    /**
     * Update button display based on showIcons and showText settings
     */
    updateButtonDisplay() {
        if (!this.toolbarContent) return;

        const buttons = this.toolbarContent.querySelectorAll('button');
        buttons.forEach(button => {
            const icon = button.querySelector('.icon');
            const text = button.querySelector('.text');
            
            if (icon) {
                icon.style.display = this.showIcons ? 'inline' : 'none';
            }
            if (text) {
                text.style.display = this.showText ? 'inline' : 'none';
            }
        });
    }
    
    /**
     * Cleanup and destroy toolbar
     */
    destroy() {
        Logger.ui.debug('Destroying Toolbar');
        
        // Remove event handlers using new system
        eventHandlerManager.unregisterContainer(this.container);
        
        // Remove horizontal scrolling
        HorizontalScrollUtils.removeScrolling(this.toolbarContent);
        
        // Save current state before destroying
        this.saveState();
        
        // Destroy context menu
        if (this.contextMenu) {
            try {
                this.contextMenu.destroy();
            } catch (error) {
                Logger.ui.warn('Failed to destroy toolbar context menu:', error);
            }
            this.contextMenu = null;
        }
        
        // Clear references
        this.container = null;
        this.stateManager = null;
        this.levelEditor = null;
        this.gridTypeConfig.clear();
        
        Logger.ui.debug('Toolbar destroyed');
    }
}
