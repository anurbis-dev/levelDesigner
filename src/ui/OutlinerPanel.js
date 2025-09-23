import { Logger } from '../utils/Logger.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { OutlinerContextMenu } from './OutlinerContextMenu.js';
import { BasePanel } from './BasePanel.js';

/**
 * Outliner panel UI component
 */
export class OutlinerPanel extends BasePanel {
    constructor(container, stateManager, levelEditor) {
        super(container, stateManager, levelEditor);
        this.searchTerm = '';

        // Initialize collapsed groups state if not exists
        if (!this.stateManager.get('outliner')) {
            this.stateManager.set('outliner', {
                collapsedTypes: new Set(),
                collapsedGroups: new Set(),
                activeTypeFilters: new Set(), // All types active by default
                shiftAnchor: null // Anchor point for shift+click selection
            });
        } else {
            const outlinerState = this.stateManager.get('outliner');
            if (!outlinerState.collapsedGroups) {
                outlinerState.collapsedGroups = new Set();
            }
            if (!outlinerState.activeTypeFilters) {
                outlinerState.activeTypeFilters = new Set();
            }
            if (!outlinerState.shiftAnchor) {
                outlinerState.shiftAnchor = null;
            }
            this.stateManager.set('outliner', outlinerState);
        }

        // Get active type filters from state
        this.activeTypeFilters = this.stateManager.get('outliner').activeTypeFilters || new Set();

        this.setupEventListeners();
        this.setupContextMenu();
    }

    getObjectIcon(type) {
        const icons = {
            'group': '📁',
            'chars': '👤',
            'collectibles': '💎',
            'enemies': '👹',
            'environment': '🌿',
            'objects': '📦',
            'Player Start': '🚩',
            'default': '📄'
        };

        return icons[type] || icons.default;
    }


    countObjectsInGroup(group) {
        let count = 1; // Count the group itself

        if (group.children) {
            // Check if group should be expanded (same logic as in renderGroupNode)
            let isCollapsed = this.stateManager.get('outliner').collapsedGroups.has(group.id);
            
            // If searching and group has matching children, force it to be expanded
            if (this.searchTerm && group.children) {
                const hasMatchingChildren = this.hasMatchingChildrenRecursive(group.children, this.searchTerm);
                if (hasMatchingChildren) {
                    isCollapsed = false;
                }
            }

            if (!isCollapsed) {
                const childrenToCount = this.searchTerm ? 
                    SearchUtils.filterObjectsRecursive(group.children, this.searchTerm, 'name', 'children') : 
                    group.children;
                childrenToCount.forEach(child => {
                    if (child.type === 'group') {
                        count += this.countObjectsInGroup(child);
                    } else {
                        count += 1;
                    }
                });
            }
        }

        return count;
    }

    setupEventListeners() {
        // Subscribe to selection changes
        this.stateManager.subscribe('selectedObjects', () => this.render());
        // Subscribe to level changes
        this.stateManager.subscribe('level', () => this.render());
        // Subscribe to outliner state changes (including filters)
        this.stateManager.subscribe('outliner', () => {
            // Update activeTypeFilters from state
            this.activeTypeFilters = this.stateManager.get('outliner').activeTypeFilters || new Set();
            this.render();
        });
    }

    /**
     * Render outliner search controls in the shared search section
     */
    renderOutlinerSearchControls() {
        const searchSection = document.getElementById('right-panel-search');
        if (!searchSection) return;

        // Check if outliner panel is currently active
        const outlinerPanel = document.getElementById('outliner-content-panel');
        if (!outlinerPanel || outlinerPanel.classList.contains('hidden')) {
            return; // Don't render if outliner is not active
        }

        // Clear existing content
        searchSection.innerHTML = '';

        // Create controls row with search and filter
        const controlsRow = document.createElement('div');
        controlsRow.className = 'flex items-center space-x-2';

        // Create search input using SearchUtils with same style as LayersPanel
        const searchInput = SearchUtils.createSearchInput(
            'Search objects...',
            'outliner-search',
            'flex-1 bg-gray-700 text-white px-2 py-1 rounded text-sm border border-gray-600 focus:border-blue-500 focus:outline-none'
        );
        searchInput.value = this.searchTerm;

        SearchUtils.setupSearchListeners(searchInput, (searchTerm) => {
            this.searchTerm = searchTerm;
            Logger.outliner.debug('Search term changed:', searchTerm);
            this.render();
        });

        // Create filter button
        const filterButton = document.createElement('button');
        filterButton.id = 'outliner-filter-btn';
        const hasActiveFilters = this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL');
        filterButton.className = `text-white px-3 py-1 rounded text-sm flex items-center justify-center h-8 ${
            hasActiveFilters ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
        }`;
        filterButton.title = hasActiveFilters ? 'Filter active - click to change' : 'Filter by object types';
        filterButton.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2 3h8l-3 3v3l-2 1V6L2 3z"/>
            </svg>
        `;

        filterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showFilterMenu(filterButton);
        });

        controlsRow.appendChild(searchInput);
        controlsRow.appendChild(filterButton);
        searchSection.appendChild(controlsRow);
    }

    /**
     * Show filter menu with object types
     */
    showFilterMenu(button) {
        // Get all available object types from current level
        const level = this.levelEditor.getLevel();
        const allObjects = level.getAllObjects();
        const availableTypes = new Set();

        allObjects.forEach(obj => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            availableTypes.add(type);
        });

        // Create menu
        const menu = document.createElement('div');
        menu.className = 'absolute z-50 bg-gray-800 border border-gray-600 rounded shadow-lg p-2 min-w-48';
        menu.style.top = `${button.offsetTop + button.offsetHeight + 4}px`;
        menu.style.right = `${document.body.offsetWidth - button.offsetLeft - button.offsetWidth}px`;

        // Add "Toggle All" option
        const allTypesActive = this.activeTypeFilters.size === 0;
        const allOption = document.createElement('div');
        allOption.className = 'flex items-center p-2 hover:bg-gray-700 cursor-pointer text-sm text-white';
        allOption.innerHTML = `
            <input type="checkbox" id="filter-all" class="mr-2" ${allTypesActive ? 'checked' : ''}>
            <label for="filter-all">Toggle All</label>
        `;

        allOption.addEventListener('click', () => {
            // Check current state at the time of click
            const currentlyAllActive = this.activeTypeFilters.size === 0;
            
            if (currentlyAllActive) {
                // Currently all types are active, deactivate all
                this.activeTypeFilters = new Set(['DISABLE_ALL']);
            } else {
                // Currently some types are filtered or disabled, activate all
                this.activeTypeFilters.clear();
            }
            // Save state
            this.stateManager.update({
                'outliner.activeTypeFilters': this.activeTypeFilters
            });
            this.render();
            // Update menu instead of closing it
            this.updateFilterMenu(menu, button);
        });

        menu.appendChild(allOption);

        // Add separator
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        menu.appendChild(separator);

        // Add individual type options
        Array.from(availableTypes).sort().forEach(type => {
            const option = document.createElement('div');
            option.className = 'flex items-center p-2 hover:bg-gray-700 cursor-pointer text-sm text-white';

            // Type is active if: no filters (show all) OR specifically selected OR not in DISABLE_ALL mode
            const isActive = this.activeTypeFilters.size === 0 ||
                           (this.activeTypeFilters.has(type) && !this.activeTypeFilters.has('DISABLE_ALL'));

            option.innerHTML = `
                <input type="checkbox" id="filter-${type}" class="mr-2" ${isActive ? 'checked' : ''}>
                <label for="filter-${type}">${type}</label>
            `;

            option.addEventListener('click', () => {
                if (this.activeTypeFilters.has('DISABLE_ALL')) {
                    // If in DISABLE_ALL mode, start with this type only
                    this.activeTypeFilters = new Set([type]);
                } else if (this.activeTypeFilters.size === 0) {
                    // If all were active, exclude this type (show all except this one)
                    const level = this.levelEditor.getLevel();
                    const allObjects = level.getAllObjects();
                    const allTypes = new Set();
                    allObjects.forEach(obj => {
                        const objType = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
                        allTypes.add(objType);
                    });
                    // Create set with all types except the clicked one
                    this.activeTypeFilters = new Set([...allTypes].filter(t => t !== type));
                } else if (this.activeTypeFilters.has(type)) {
                    // Remove this type
                    this.activeTypeFilters.delete(type);
                    // If no types left, disable all (show nothing)
                    if (this.activeTypeFilters.size === 0) {
                        this.activeTypeFilters = new Set(['DISABLE_ALL']);
                    }
                } else {
                    // Add this type
                    this.activeTypeFilters.add(type);
                }
                // Save state
                this.stateManager.update({
                    'outliner.activeTypeFilters': this.activeTypeFilters
                });
                this.render();
                // Update menu instead of closing it
                this.updateFilterMenu(menu, button);
            });

            menu.appendChild(option);
        });

        // Close menu when clicking outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== button) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        };

        document.addEventListener('click', closeMenu);
        document.body.appendChild(menu);
    }

    /**
     * Update filter menu to reflect current filter state
     */
    updateFilterMenu(menu, button) {
        // Get all available object types from current level
        const level = this.levelEditor.getLevel();
        const allObjects = level.getAllObjects();
        const availableTypes = new Set();

        allObjects.forEach(obj => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            availableTypes.add(type);
        });

        // Update "Toggle All" option
        const allOption = menu.querySelector('#filter-all');
        if (allOption) {
            const allTypesActive = this.activeTypeFilters.size === 0;
            
            allOption.checked = allTypesActive;
            const label = allOption.nextElementSibling;
            if (label) {
                // Label is static "Toggle All"
                label.textContent = 'Toggle All';
            }
        }

        // Update individual type options
        Array.from(availableTypes).sort().forEach(type => {
            const option = menu.querySelector(`#filter-${type}`);
            if (option) {
                const isActive = this.activeTypeFilters.size === 0 ||
                               (this.activeTypeFilters.has(type) && !this.activeTypeFilters.has('DISABLE_ALL'));
                option.checked = isActive;
            }
        });

        // Update filter button appearance
        const hasActiveFilters = this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL');
        button.className = `text-white px-3 py-1 rounded text-sm flex items-center justify-center h-8 ${
            hasActiveFilters ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
        }`;
        button.title = hasActiveFilters ? 'Filter active - click to change' : 'Filter by object types';
    }

    /**
     * Check if object type should be shown based on filters
     */
    shouldShowObjectType(type) {
        // If no filters active, show all
        if (this.activeTypeFilters.size === 0) return true;

        // If DISABLE_ALL is active, show nothing
        if (this.activeTypeFilters.has('DISABLE_ALL')) return false;

        // Check if this type is in active filters
        return this.activeTypeFilters.has(type);
    }

    createSearchBar() {
        const searchContainer = SearchUtils.createSearchContainer(
            'Search objects...',
            'outliner-search',
            'outliner-search-container mb-2'
        );

        const searchInput = searchContainer.querySelector('#outliner-search');
        searchInput.value = this.searchTerm;

        SearchUtils.setupSearchListeners(searchInput, (searchTerm) => {
            this.searchTerm = searchTerm;
            Logger.outliner.debug('Search term changed:', searchTerm);
            this.render();
        });

        this.container.appendChild(searchContainer);
    }

    filterObjects(objects) {
        return SearchUtils.filterObjects(objects, this.searchTerm);
    }

    hasMatchingChildrenRecursive(objects, searchTerm) {
        for (const obj of objects) {
            const name = (obj.name || `[${obj.type || 'object'}]`).toLowerCase();
            if (name.includes(searchTerm)) {
                return true;
            }
            if (obj.children && obj.children.length > 0) {
                if (this.hasMatchingChildrenRecursive(obj.children, searchTerm)) {
                    return true;
                }
            }
        }
        return false;
    }

    getAllFilteredObjects(objects) {
        const allObjects = [];

        const collectAllObjects = (objs) => {
            objs.forEach(obj => {
                allObjects.push(obj);
                if (obj.type === 'group' && obj.children) {
                    collectAllObjects(obj.children);
                }
            });
        };

        if (this.searchTerm) {
            // When searching, collect all objects that match the filter
            collectAllObjects(objects);
            return this.filterObjects(allObjects);
        } else {
            // When not searching, return all objects
            collectAllObjects(objects);
            return allObjects;
        }
    }

    /**
     * Filter objects by type recursively, preserving hierarchy
     */
    filterObjectsByTypeRecursive(objects) {
        const filtered = [];
        
        objects.forEach(obj => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            
            if (this.activeTypeFilters.has(type)) {
                // Object type is allowed, add it
                const filteredObj = { ...obj };
                
                // If it's a group, recursively filter its children
                if (obj.type === 'group' && obj.children) {
                    const filteredChildren = this.filterObjectsByTypeRecursive(obj.children);
                    // Always include group if its type is allowed, even if no children
                    filteredObj.children = filteredChildren;
                    filtered.push(filteredObj);
                } else {
                    // Regular object, add it
                    filtered.push(filteredObj);
                }
            } else if (obj.type === 'group' && obj.children) {
                // Group type is not allowed, but check if any children are allowed
                const filteredChildren = this.filterObjectsByTypeRecursive(obj.children);
                if (filteredChildren.length > 0) {
                    // Don't create a group, just add the children directly (flatten the hierarchy)
                    filtered.push(...filteredChildren);
                }
            }
            // If object type is not allowed and it's not a group, skip it
        });
        
        return filtered;
    }

    /**
     * Count all objects recursively in the filtered hierarchy
     */
    countAllObjectsRecursive(objects) {
        let count = 0;
        
        objects.forEach(obj => {
            count++; // Count the object itself
            if (obj.type === 'group' && obj.children) {
                count += this.countAllObjectsRecursive(obj.children);
            }
        });
        
        return count;
    }


    render() {
        // Save search input state before clearing
        const searchInput = document.getElementById('outliner-search');
        const wasSearchFocused = searchInput && document.activeElement === searchInput;
        const searchValue = this.searchTerm;

        // Clear container
        this.container.innerHTML = '';

        // Render outliner search controls in shared section
        this.renderOutlinerSearchControls();

        const level = this.levelEditor.getLevel();
        // Show only top-level objects in outliner
        const topLevelObjects = level.objects;
        
        // First apply search filter if active
        let filteredObjects = this.searchTerm ? this.getAllFilteredObjects(topLevelObjects) : topLevelObjects;
        
        // Then apply type filter - filter objects by their types recursively
        if (this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL')) {
            filteredObjects = this.filterObjectsByTypeRecursive(filteredObjects);
        } else if (this.activeTypeFilters.has('DISABLE_ALL')) {
            // If DISABLE_ALL is active, show nothing
            filteredObjects = [];
        }

        // Show search results info
        if (this.searchTerm) {
            const totalFiltered = this.countAllObjectsRecursive(filteredObjects);
            Logger.outliner.info(`Search "${this.searchTerm}" found ${totalFiltered} objects`);

            const resultsInfo = SearchUtils.createSearchResultsInfo(totalFiltered, this.searchTerm, 'objects');
            this.container.appendChild(resultsInfo);
        }

        // Render objects directly without grouping by type
        filteredObjects.forEach(obj => {
            if (obj.type === 'group') {
                this.renderGroupNode(obj, 0, this.container);
            } else {
                this.renderObjectNode(obj, 0, this.container);
            }
        });

        // Restore search input state after render
        if (wasSearchFocused) {
            const newSearchInput = document.getElementById('outliner-search');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        }

        // Always recreate context menu after DOM is updated to ensure it works with new objects
        this.setupContextMenu();
        
        // Setup scrolling using BasePanel - target the actual scrollable container
        const rightPanel = this.container.closest('#right-panel');
        const scrollableContainer = rightPanel?.querySelector('.flex-grow.overflow-y-auto');
        
        this.setupScrolling({
            horizontal: false,
            vertical: true,
            sensitivity: 1.0,
            target: scrollableContainer || rightPanel
        });
    }


    renderGroupNode(group, depth, container) {
        const item = document.createElement('div');
        item.className = 'outliner-item outliner-group-item';
        item.style.paddingLeft = `${5 + depth * 15}px`;
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.dataset.id = group.id;

        // Check if group is collapsed
        let isCollapsed = this.stateManager.get('outliner').collapsedGroups.has(group.id);
        
        // If searching and group has matching children, force it to be expanded
        if (this.searchTerm && group.children) {
            const hasMatchingChildren = this.hasMatchingChildrenRecursive(group.children, this.searchTerm);
            if (hasMatchingChildren) {
                isCollapsed = false;
            }
        }

        // Create collapse/expand indicator (first element)
        const indicator = document.createElement('span');
        indicator.className = 'outliner-collapse-indicator';
        indicator.textContent = isCollapsed ? '▶' : '▼';
        indicator.style.cursor = 'pointer';
        indicator.style.userSelect = 'none';
        indicator.style.color = '#666';
        indicator.style.marginRight = '4px';
        indicator.style.pointerEvents = 'auto';
        indicator.style.display = 'inline-block';
        indicator.style.width = '12px';
        indicator.style.textAlign = 'center';
        indicator.style.flexShrink = '0';

        // Add click handler for collapse/expand (single click)
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleGroupCollapse(group.id);
        });

        // Create name container with display and input
        const nameContainer = document.createElement('div');
        nameContainer.className = 'outliner-item-name-container';
        nameContainer.style.flex = '1';
        nameContainer.style.minWidth = '0';
        nameContainer.style.display = 'flex';
        nameContainer.style.alignItems = 'center';

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'outliner-item-icon';
        icon.textContent = this.getObjectIcon('group');
        icon.style.marginRight = '4px';
        icon.style.flexShrink = '0';

        // Create display span with count
        const childCount = group.children ? group.children.length : 0;
        const nameSpan = document.createElement('span');
        nameSpan.className = 'outliner-item-name-display';
        nameSpan.textContent = `${group.name || `[${group.type}]`}`;
        if (childCount > 0) {
            nameSpan.textContent += ` (${childCount})`;
        }
        nameSpan.style.flex = '1';
        nameSpan.style.padding = '1px';
        nameSpan.style.borderRadius = '3px';
        nameSpan.style.minWidth = '0';

        // Create input element
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = group.name || '';
        nameInput.className = 'outliner-item-name-input';
        nameInput.style.flex = '1';
        nameInput.style.background = 'transparent';
        nameInput.style.border = 'none';
        nameInput.style.color = 'white';
        nameInput.style.outline = 'none';
        nameInput.style.padding = '1px';
        nameInput.style.borderRadius = '3px';
        nameInput.style.minWidth = '0';
        nameInput.style.display = 'none';

        // Add double-click handler for inline rename
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startInlineRename(group);
        });

        nameContainer.appendChild(icon);
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(nameInput);

        item.appendChild(indicator);
        item.appendChild(nameContainer);
        
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(group) :
            (group.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            item.classList.add('locked');
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
            item.title = 'Object is in locked layer';
        }
        
        if (this.stateManager.get('selectedObjects').has(group.id)) {
            item.classList.add('selected');
        }
        
        item.addEventListener('click', (e) => {
            // Don't handle selection if right-click (context menu)
            if (e.button === 2) return;
            
            // Don't handle selection if clicked on collapse indicator
            if (e.target.classList.contains('outliner-collapse-indicator')) {
                return;
            }
            this.handleObjectClick(e, group);
        });
        
        container.appendChild(item);

        // Render children only if group is not collapsed
        if (!isCollapsed && group.children) {
            if (this.searchTerm) {
                // When searching, use recursive filtering to find matching children at any depth
                const matchingChildren = SearchUtils.filterObjectsRecursive(group.children, this.searchTerm, 'name', 'children');
                matchingChildren.forEach(child => {
                    if (child.type === 'group') {
                        this.renderGroupNode(child, depth + 1, container);
                    } else {
                        this.renderObjectNode(child, depth + 1, container);
                    }
                });
            } else {
                // When not searching, show all children
                group.children.forEach(child => {
                    if (child.type === 'group') {
                        this.renderGroupNode(child, depth + 1, container);
                    } else {
                        this.renderObjectNode(child, depth + 1, container);
                    }
                });
            }
        }
    }

    renderObjectNode(obj, depth, container) {
        const item = document.createElement('div');
        item.className = 'outliner-item';
        item.style.paddingLeft = `${5 + depth * 15}px`;
        item.style.display = 'flex';
        item.style.alignItems = 'center';

        // Create name container with display and input
        const nameContainer = document.createElement('div');
        nameContainer.className = 'outliner-item-name-container';
        nameContainer.style.flex = '1';
        nameContainer.style.minWidth = '0';
        nameContainer.style.display = 'flex';
        nameContainer.style.alignItems = 'center';

        // Create icon
        const icon = document.createElement('span');
        icon.className = 'outliner-item-icon';
        icon.textContent = this.getObjectIcon(obj.type);
        icon.style.marginRight = '4px';
        icon.style.flexShrink = '0';

        // Create display span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'outliner-item-name-display';
        nameSpan.textContent = obj.name || `[${obj.type}]`;
        nameSpan.style.flex = '1';
        nameSpan.style.padding = '1px';
        nameSpan.style.borderRadius = '3px';
        nameSpan.style.minWidth = '0';

        // Create input element
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = obj.name || '';
        nameInput.className = 'outliner-item-name-input';
        nameInput.style.flex = '1';
        nameInput.style.background = 'transparent';
        nameInput.style.border = 'none';
        nameInput.style.color = 'white';
        nameInput.style.outline = 'none';
        nameInput.style.padding = '1px';
        nameInput.style.borderRadius = '3px';
        nameInput.style.minWidth = '0';
        nameInput.style.display = 'none';

        // Add double-click handler for inline rename
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.startInlineRename(obj);
        });

        nameContainer.appendChild(icon);
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(nameInput);

        item.appendChild(nameContainer);
        item.dataset.id = obj.id;
        
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            item.classList.add('locked');
            item.style.opacity = '0.5';
            item.style.cursor = 'not-allowed';
            item.title = 'Object is in locked layer';
        }
        
        if (this.stateManager.get('selectedObjects').has(obj.id)) {
            item.classList.add('selected');
        }
        
        item.addEventListener('click', (e) => {
            // Don't handle selection if right-click (context menu)
            if (e.button === 2) return;
            this.handleObjectClick(e, obj);
        });
        
        container.appendChild(item);
    }

    handleObjectClick(e, obj) {
        // Check if object is in a locked layer
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        
        if (layer && layer.locked) {
            // Don't allow selection of objects in locked layers
            return;
        }
        
        const selectedObjects = new Set(this.stateManager.get('selectedObjects'));

        if (e.shiftKey) {
            // Shift+click: select range from anchor point to current object
            this.handleShiftClick(obj, selectedObjects);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+click: toggle single object
            this.handleCtrlClick(obj, selectedObjects);
        } else {
            // Normal click: replace selection and set anchor point
            selectedObjects.clear();
            selectedObjects.add(obj.id);
            // Set anchor point for future shift+click operations
            this.stateManager.update({
                'outliner.shiftAnchor': obj.id
            });
        }
        
        this.stateManager.set('selectedObjects', selectedObjects);
    }

    /**
     * Handle Shift+click: select range from anchor point to current object
     */
    handleShiftClick(obj, selectedObjects) {
        const flatObjectList = this.getFlatObjectList();
        const currentIndex = flatObjectList.findIndex(item => item.id === obj.id);

        if (currentIndex === -1) {
            // Object not found in flat list, just add it
            selectedObjects.add(obj.id);
            return;
        }

        // Get anchor point from state
        const anchorId = this.stateManager.get('outliner').shiftAnchor;

        if (!anchorId) {
            // No anchor point set, set current object as anchor and select it
            selectedObjects.add(obj.id);
            this.stateManager.update({
                'outliner.shiftAnchor': obj.id
            });
            return;
        }

        // Find anchor point in flat list
        const anchorIndex = flatObjectList.findIndex(item => item.id === anchorId);

        if (anchorIndex === -1) {
            // Anchor point not found, reset anchor and select current object
            selectedObjects.add(obj.id);
            this.stateManager.update({
                'outliner.shiftAnchor': obj.id
            });
            return;
        }

        // Select range from anchor point to current object
        const startIndex = Math.min(anchorIndex, currentIndex);
        const endIndex = Math.max(anchorIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            selectedObjects.add(flatObjectList[i].id);
        }
    }

    /**
     * Handle Ctrl/Cmd+click: toggle single object
     */
    handleCtrlClick(obj, selectedObjects) {
        if (selectedObjects.has(obj.id)) {
            selectedObjects.delete(obj.id);
        } else {
            selectedObjects.add(obj.id);
            // Update anchor point to last toggled object
            this.stateManager.update({
                'outliner.shiftAnchor': obj.id
            });
        }
    }

    /**
     * Get flat list of all objects in the outliner (in display order)
     * If search is active, returns filtered list; otherwise returns all objects
     */
    getFlatObjectList() {
        const level = this.levelEditor.getLevel();
        const topLevelObjects = level.objects;
        
        // First apply search filter if active
        let objectsToProcess = this.searchTerm ? 
            this.getAllFilteredObjects(topLevelObjects) : 
            topLevelObjects;
        
        // Then apply type filter if active
        if (this.activeTypeFilters.size > 0 && !this.activeTypeFilters.has('DISABLE_ALL')) {
            objectsToProcess = this.filterObjectsByTypeRecursive(objectsToProcess);
        } else if (this.activeTypeFilters.has('DISABLE_ALL')) {
            objectsToProcess = [];
        }
        
        const flatList = [];
        
        // Add all objects recursively in display order
        this.addObjectsToFlatList(objectsToProcess, flatList);
        
        return flatList;
    }

    /**
     * Add objects to flat list recursively
     */
    addObjectsToFlatList(objects, flatList) {
        objects.forEach(obj => {
            flatList.push(obj);
            
            // Add children if it's a group and not collapsed
            if (obj.type === 'group' && obj.children) {
                const outlinerState = this.stateManager.get('outliner');
                let isCollapsed = outlinerState?.collapsedGroups?.has(obj.id);
                
                // If searching and group has matching children, force it to be expanded
                if (this.searchTerm && obj.children) {
                    const hasMatchingChildren = this.hasMatchingChildrenRecursive(obj.children, this.searchTerm);
                    if (hasMatchingChildren) {
                        isCollapsed = false;
                    }
                }
                
                if (!isCollapsed) {
                    // If searching, filter children; otherwise add all children
                    const childrenToAdd = this.searchTerm ? 
                        SearchUtils.filterObjectsRecursive(obj.children, this.searchTerm, 'name', 'children') :
                        obj.children;
                    
                    this.addObjectsToFlatList(childrenToAdd, flatList);
                }
            }
        });
    }

    setupContextMenu() {
        // Clean up existing context menu if it exists
        if (this.contextMenu) {
            // Hide menu immediately before destroying
            this.contextMenu.hideMenu();
            this.contextMenu.destroy();
        }
        
        this.contextMenu = new OutlinerContextMenu(this.container, this.levelEditor, {
            onRename: (object) => this.handleRenameObject(object),
            onDelete: (object) => this.handleDeleteObject(object),
            onToggleVisibility: (object) => this.handleToggleVisibility(object),
            onSelect: (object) => this.handleSelectObject(object),
            onDuplicate: (object) => this.handleDuplicateObject(object),
            onExpandAllGroups: () => this.handleExpandAllGroups(),
            onCollapseAllGroups: () => this.handleCollapseAllGroups()
        });
    }

    handleRenameObject(object) {
        Logger.outliner.info('Rename requested for object:', object.name);
        // TODO: Implement inline renaming
        this.startInlineRename(object);
    }

    handleDeleteObject(object) {
        Logger.outliner.info('Delete requested for object:', object.name);

        if (confirm(`Delete "${object.name || 'Unnamed object'}"?`)) {
            const level = this.levelEditor.getLevel();
            level.removeObject(object.id);
            this.levelEditor.stateManager.notifyListeners('level', level);
            Logger.outliner.info('Object deleted:', object.name);
        }
    }

    handleToggleVisibility(object) {
        Logger.outliner.info('Toggle visibility for object:', object.name);
        // TODO: Implement visibility toggle
        // This would require adding visibility property to objects
    }

    handleSelectObject(object) {
        Logger.outliner.debug('Select object:', object.name);
        const selectedObjects = new Set([object.id]);
        this.stateManager.set('selectedObjects', selectedObjects);
    }

    handleDuplicateObject(object) {
        Logger.outliner.info('Duplicate requested for object:', object.name);
        // TODO: Implement duplication
        // This would use the existing duplication system
    }

    handleExpandAllGroups() {
        Logger.outliner.info('Expanding all groups');
        const collapsedGroups = new Set();
        this.stateManager.update({
            'outliner.collapsedGroups': collapsedGroups
        });
        this.render();
    }

    handleCollapseAllGroups() {
        Logger.outliner.info('Collapsing all groups');
        const level = this.levelEditor.getLevel();
        const collapsedGroups = new Set();

        // Find all group IDs
        const findGroupIds = (objects) => {
            objects.forEach(obj => {
                if (obj.type === 'group') {
                    collapsedGroups.add(obj.id);
                    if (obj.children) {
                        findGroupIds(obj.children);
                    }
                }
            });
        };

        findGroupIds(level.objects);
        this.stateManager.update({
            'outliner.collapsedGroups': collapsedGroups
        });
        this.render();
    }

    startInlineRename(object) {
        Logger.outliner.debug('Starting inline rename for object:', object.name);

        // Find the DOM element for this object
        const item = this.container.querySelector(`[data-id="${object.id}"]`);
        if (!item) {
            Logger.outliner.warn('Could not find DOM element for object:', object.id);
            return;
        }

        // Find the display and input elements
        const nameDisplay = item.querySelector('.outliner-item-name-display');
        const nameInput = item.querySelector('.outliner-item-name-input');
        
        if (!nameDisplay || !nameInput) {
            Logger.outliner.warn('Could not find name display or input for object:', object.id);
            return;
        }

        // Set input value and show input, hide display
        nameInput.value = object.name || '';
        nameDisplay.style.display = 'none';
        nameInput.style.display = 'block';
        nameInput.focus();
        nameInput.select();

        // Handle save/cancel
        const finishRename = (save = true) => {
            const newName = nameInput.value.trim();
            const oldName = object.name || '';

            if (save && newName !== oldName) {
                // Update object name
                object.name = newName;
                Logger.outliner.info(`Renamed object ${object.id} from "${oldName}" to "${newName}"`);

                // Update display text
                nameDisplay.textContent = newName || `[${object.type}]`;
                
                // Update input value
                nameInput.value = newName;

                // Notify about object property change
                this.levelEditor.stateManager.notifyListeners('objectPropertyChanged', object, {
                    property: 'name',
                    oldValue: oldName,
                    newValue: newName
                });

                // Notify about level change to trigger save
                const level = this.levelEditor.getLevel();
                this.levelEditor.stateManager.notifyListeners('level', level);
            } else {
                // Restore original value
                nameInput.value = oldName;
            }

            // Hide input, show display
            nameInput.style.display = 'none';
            nameDisplay.style.display = 'block';
        };

        // Save on Enter or blur
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishRename(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishRename(false);
            }
        });

        nameInput.addEventListener('blur', () => {
            finishRename(true);
        });

        // Prevent clicks on input from triggering selection
        nameInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    toggleGroupCollapse(groupId) {
        const outlinerState = this.stateManager.get('outliner') || {};
        const collapsedGroups = new Set(outlinerState.collapsedGroups || []);

        if (collapsedGroups.has(groupId)) {
            collapsedGroups.delete(groupId);
        } else {
            collapsedGroups.add(groupId);
        }

        this.stateManager.update({
            'outliner.collapsedGroups': collapsedGroups
        });

        this.render();
    }

}
