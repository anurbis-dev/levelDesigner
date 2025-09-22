import { Logger } from '../utils/Logger.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { OutlinerContextMenu } from './OutlinerContextMenu.js';

/**
 * Outliner panel UI component
 */
export class OutlinerPanel {
    constructor(container, stateManager, levelEditor) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.searchTerm = '';

        // Initialize collapsed groups state if not exists
        if (!this.stateManager.get('outliner')) {
            this.stateManager.set('outliner', {
                collapsedTypes: new Set(),
                collapsedGroups: new Set()
            });
        } else if (!this.stateManager.get('outliner').collapsedGroups) {
            const outlinerState = this.stateManager.get('outliner');
            outlinerState.collapsedGroups = new Set();
            this.stateManager.set('outliner', outlinerState);
        }

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

    getTypeGroupCount(type, objects) {
        if (type === 'Groups') {
            // For groups, count all objects in the hierarchy
            return objects.reduce((total, group) => {
                return total + this.countObjectsInGroup(group);
            }, 0);
        } else {
            // For regular objects, just count them
            return objects.length;
        }
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


    render() {
        // Save search input state before clearing
        const searchInput = document.getElementById('outliner-search');
        const wasSearchFocused = searchInput && document.activeElement === searchInput;
        const searchValue = this.searchTerm;

        this.container.innerHTML = '';

        // Create search bar
        this.createSearchBar();

        const level = this.levelEditor.getLevel();
        // Show only top-level objects in outliner
        const topLevelObjects = level.objects;
        const filteredObjects = this.searchTerm ? this.getAllFilteredObjects(topLevelObjects) : topLevelObjects;
        const groupedByType = this.groupObjectsByType(filteredObjects);

        // Show search results info
        if (this.searchTerm) {
            const totalFiltered = filteredObjects.length;
            Logger.outliner.info(`Search "${this.searchTerm}" found ${totalFiltered} objects`);

            const resultsInfo = SearchUtils.createSearchResultsInfo(totalFiltered, this.searchTerm, 'objects');
            this.container.appendChild(resultsInfo);
        }

        Object.keys(groupedByType).sort().forEach(type => {
            this.renderTypeGroup(type, groupedByType[type]);
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
    }

    groupObjectsByType(objects) {
        return objects.reduce((acc, obj) => {
            const type = obj.type === 'group' ? 'Groups' : obj.type || 'Untyped';
            if (!acc[type]) acc[type] = [];
            acc[type].push(obj);
            return acc;
        }, {});
    }

    renderTypeGroup(type, objects) {
        const header = document.createElement('h4');
        header.className = 'outliner-group-header mt-2';

        const isCollapsed = this.stateManager.get('outliner').collapsedTypes.has(type);
        if (isCollapsed) header.classList.add('collapsed');

        // Count objects in this type group
        const count = this.getTypeGroupCount(type, objects);
        header.textContent = `${type} (${count})`;
        
        const itemsContainer = document.createElement('div');
        if (isCollapsed) itemsContainer.classList.add('hidden');
        
        // Toggle collapse on double click
        header.addEventListener('dblclick', () => {
            const collapsedTypes = new Set(this.stateManager.get('outliner').collapsedTypes);
            
            if (collapsedTypes.has(type)) {
                collapsedTypes.delete(type);
            } else {
                collapsedTypes.add(type);
            }
            
            this.stateManager.update({
                'outliner.collapsedTypes': collapsedTypes
            });
            
            this.render();
        });
        
        this.container.appendChild(header);
        this.container.appendChild(itemsContainer);
        
        if (type === 'Groups') {
            // Render groups hierarchically
            objects.forEach(group => {
                this.renderGroupNode(group, 0, itemsContainer);
            });
        } else {
            // Render regular objects
            objects.forEach(obj => {
                this.renderObjectNode(obj, 0, itemsContainer);
            });
        }
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
            // Shift+click: select range from last selected to current object
            this.handleShiftClick(obj, selectedObjects);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+click: toggle single object
            this.handleCtrlClick(obj, selectedObjects);
        } else {
            // Normal click: replace selection
            selectedObjects.clear();
            selectedObjects.add(obj.id);
        }
        
        this.stateManager.set('selectedObjects', selectedObjects);
    }

    /**
     * Handle Shift+click: select range from last selected to current object
     */
    handleShiftClick(obj, selectedObjects) {
        const flatObjectList = this.getFlatObjectList();
        const currentIndex = flatObjectList.findIndex(item => item.id === obj.id);
        
        if (currentIndex === -1) {
            // Object not found in flat list, just add it
            selectedObjects.add(obj.id);
            return;
        }
        
        // Find the last selected object in the flat list
        let lastSelectedIndex = -1;
        for (let i = flatObjectList.length - 1; i >= 0; i--) {
            if (selectedObjects.has(flatObjectList[i].id)) {
                lastSelectedIndex = i;
                break;
            }
        }
        
        if (lastSelectedIndex === -1) {
            // No previous selection, just add current object
            selectedObjects.add(obj.id);
            return;
        }
        
        // Select range from last selected to current
        const startIndex = Math.min(lastSelectedIndex, currentIndex);
        const endIndex = Math.max(lastSelectedIndex, currentIndex);
        
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
        }
    }

    /**
     * Get flat list of all objects in the outliner (in display order)
     * If search is active, returns filtered list; otherwise returns all objects
     */
    getFlatObjectList() {
        const level = this.levelEditor.getLevel();
        const topLevelObjects = level.objects;
        
        // If search is active, use filtered objects
        const objectsToProcess = this.searchTerm ? 
            this.getAllFilteredObjects(topLevelObjects) : 
            topLevelObjects;
        
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

            if (save && newName !== (object.name || '')) {
                // Update object name
                object.name = newName;
                Logger.outliner.info(`Renamed object ${object.id} from "${object.name || ''}" to "${newName}"`);

                // Update display text
                nameDisplay.textContent = object.name || `[${object.type}]`;
                
                // Update input value
                nameInput.value = object.name || '';

                // Notify about object property change
                this.levelEditor.stateManager.notifyListeners('objectPropertyChanged', object, {
                    property: 'name',
                    oldValue: object.name || '',
                    newValue: newName
                });
            } else {
                // Restore original value
                nameInput.value = object.name || '';
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
