import { Logger } from '../utils/Logger.js';
import { BaseContextMenu } from './BaseContextMenu.js';

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
        
        // Scrolling state
        this.isScrolling = false;
        this.scrollStartX = 0;
        this.scrollStartScrollLeft = 0;
        
        // Context menu state
        this.showIcons = true;
        this.showText = true;
        this.contextMenu = null;
        
        this.setupEventListeners();
        this.render();
        // Setup scrolling events after render
        this.setupScrollingEvents();
        this.setupContextMenu();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for toolbar visibility changes
        this.stateManager.subscribe('view.toolbar', (visible) => {
            this.setVisible(visible);
        });
    }

    /**
     * Render toolbar
     */
    render() {
        this.container.innerHTML = '';
        
        if (!this.isVisible) {
            this.container.style.display = 'none';
            return;
        }

        this.container.style.display = 'flex';
        
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
            { id: 'toggle-grid', label: 'Grid', icon: '⊞', action: 'toggleGrid', toggle: true },
            { id: 'toggle-snap', label: 'Snap', icon: '🧲', action: 'toggleSnapToGrid', toggle: true },
            { id: 'focus-selection', label: 'Focus', icon: '🎯', action: 'focusSelection' },
            { id: 'focus-all', label: 'Focus All', icon: '🔍', action: 'focusAll' }
        ]));
        
        toolbarContent.appendChild(this.createButtonGroup('Group', [
            { id: 'group-selected', label: 'Group', icon: '📦', action: 'groupSelected' },
            { id: 'ungroup-selected', label: 'Ungroup', icon: '📤', action: 'ungroupSelected' }
        ]));

        this.container.appendChild(toolbarContent);
        this.setupButtonEvents();
        
        // Store reference to toolbar content for scrolling
        this.toolbarContent = toolbarContent;
        
        // Setup scrolling events for the new toolbar content
        this.setupScrollingEvents();
        
        // Apply current display settings
        this.updateButtonDisplay();
    }

    /**
     * Create button group
     */
    createButtonGroup(title, buttons) {
        const group = document.createElement('div');
        group.className = 'flex items-center space-x-1';
        
        // Add collapsible title
        const titleSpan = document.createElement('span');
        titleSpan.className = 'text-xs text-gray-400 mr-2 cursor-pointer hover:text-gray-300 select-none';
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
        button.className = 'px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded flex items-center space-x-1 transition-colors';
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
     * Setup button event listeners
     */
    setupButtonEvents() {
        const buttons = this.container.querySelectorAll('button[data-action]');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const action = button.getAttribute('data-action');
                this.handleAction(action);
            });
        });
    }

    /**
     * Handle toolbar action
     */
    handleAction(action) {
        try {
            Logger.log(`Toolbar action: ${action}`);
            
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
                    this.levelEditor.saveLevel();
                    break;
                case 'undo':
                    this.levelEditor.undo();
                    break;
                case 'redo':
                    this.levelEditor.redo();
                    break;
                case 'duplicate':
                    this.levelEditor.duplicateSelected();
                    break;
                case 'deleteSelected':
                    this.levelEditor.deleteSelected();
                    break;
                case 'focusSelection':
                    this.levelEditor.focusSelection();
                    break;
                case 'focusAll':
                    this.levelEditor.focusAll();
                    break;
                case 'groupSelected':
                    this.levelEditor.groupSelected();
                    break;
                case 'ungroupSelected':
                    this.levelEditor.ungroupSelected();
                    break;
                default:
                    Logger.warn(`Unknown toolbar action: ${action}`);
            }
        } catch (error) {
            Logger.error(`Error handling toolbar action ${action}:`, error);
        }
    }

    /**
     * Handle toggle actions
     */
    handleToggleAction(action) {
        const button = this.container.querySelector(`[data-action="${action}"]`);
        if (!button) return;

        switch (action) {
            case 'toggleGrid':
                this.levelEditor.toggleViewOption('grid');
                break;
            case 'toggleSnapToGrid':
                this.levelEditor.toggleViewOption('snapToGrid');
                break;
        }

        // Update button state after a short delay to allow state to update
        setTimeout(() => {
            this.updateToggleState(button, action);
        }, 50);
    }

    /**
     * Update toggle button state
     */
    updateToggleState(button, action) {
        if (!button.classList.contains('toggle-button')) return;

        let isActive = false;
        
        switch (action) {
            case 'toggleGrid':
                isActive = this.stateManager.get('view.grid') || false;
                break;
            case 'toggleSnapToGrid':
                isActive = this.stateManager.get('view.snapToGrid') || false;
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
     * Set toolbar visibility
     */
    setVisible(visible) {
        this.isVisible = visible;
        this.render();
    }

    /**
     * Get toolbar visibility
     */
    getVisible() {
        return this.isVisible;
    }

    /**
     * Update all toggle states
     */
    updateToggleStates() {
        const toggleButtons = this.container.querySelectorAll('.toggle-button');
        toggleButtons.forEach(button => {
            const action = button.getAttribute('data-action');
            this.updateToggleState(button, action);
        });
    }

    /**
     * Setup scrolling event listeners for middle mouse button
     */
    setupScrollingEvents() {
        if (!this.toolbarContent) return;

        // Middle mouse button down - start scrolling
        this.toolbarContent.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                this.startScrolling(e);
            }
        });

        // Mouse move - continue scrolling
        document.addEventListener('mousemove', (e) => {
            if (this.isScrolling) {
                e.preventDefault();
                this.updateScrolling(e);
            }
        });

        // Mouse up - stop scrolling
        document.addEventListener('mouseup', (e) => {
            if (this.isScrolling && e.button === 1) {
                e.preventDefault();
                this.stopScrolling();
            }
        });

        // Mouse wheel scrolling
        this.toolbarContent.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scrollAmount = e.deltaY * 0.5; // Adjust scroll sensitivity
            this.toolbarContent.scrollLeft += scrollAmount;
        });

        // Prevent context menu on middle click
        this.toolbarContent.addEventListener('contextmenu', (e) => {
            if (e.button === 1) {
                e.preventDefault();
            }
        });

        // Prevent text selection during scrolling
        this.toolbarContent.addEventListener('selectstart', (e) => {
            if (this.isScrolling) {
                e.preventDefault();
            }
        });
    }

    /**
     * Start horizontal scrolling
     */
    startScrolling(e) {
        this.isScrolling = true;
        this.scrollStartX = e.clientX;
        this.scrollStartScrollLeft = this.toolbarContent.scrollLeft;
        
        // Change cursor to indicate scrolling
        this.toolbarContent.style.cursor = 'grabbing';
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        
        Logger.debug('Toolbar scrolling started');
    }

    /**
     * Update scrolling position
     */
    updateScrolling(e) {
        if (!this.isScrolling || !this.toolbarContent) return;

        const deltaX = e.clientX - this.scrollStartX;
        const newScrollLeft = this.scrollStartScrollLeft - deltaX;
        
        // Apply scrolling with bounds
        this.toolbarContent.scrollLeft = Math.max(0, Math.min(
            newScrollLeft, 
            this.toolbarContent.scrollWidth - this.toolbarContent.clientWidth
        ));
    }

    /**
     * Stop horizontal scrolling
     */
    stopScrolling() {
        this.isScrolling = false;
        
        // Restore cursor
        this.toolbarContent.style.cursor = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        Logger.debug('Toolbar scrolling stopped');
    }

    /**
     * Toggle group collapse/expand
     */
    toggleGroupCollapse(titleSpan, group) {
        const isCollapsed = titleSpan.getAttribute('data-collapsed') === 'true';
        const buttonsContainer = group.querySelector('[data-buttons-container="true"]');
        
        if (isCollapsed) {
            // Expand group
            buttonsContainer.style.display = 'flex';
            titleSpan.setAttribute('data-collapsed', 'false');
            titleSpan.textContent = titleSpan.textContent.replace('▼', '').trim();
        } else {
            // Collapse group
            buttonsContainer.style.display = 'none';
            titleSpan.setAttribute('data-collapsed', 'true');
            titleSpan.textContent = '▼ ' + titleSpan.textContent;
        }
        
        Logger.debug(`Toolbar group ${isCollapsed ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Setup context menu for toolbar
     */
    setupContextMenu() {
        this.contextMenu = new BaseContextMenu(this.container, {
            onMenuShow: () => {
                Logger.debug('Toolbar context menu shown');
            },
            onMenuHide: () => {
                Logger.debug('Toolbar context menu hidden');
            }
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
    }

    /**
     * Hide toolbar
     */
    hideToolbar() {
        this.stateManager.set('view.toolbar', false);
        Logger.debug('Toolbar hidden via context menu');
    }

    /**
     * Toggle icons visibility
     */
    toggleIcons() {
        this.showIcons = !this.showIcons;
        this.updateButtonDisplay();
        Logger.debug(`Toolbar icons ${this.showIcons ? 'shown' : 'hidden'}`);
    }

    /**
     * Toggle text visibility
     */
    toggleText() {
        this.showText = !this.showText;
        this.updateButtonDisplay();
        Logger.debug(`Toolbar text ${this.showText ? 'shown' : 'hidden'}`);
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
}
