import { Logger } from '../utils/Logger.js';
import { SearchUtils } from '../utils/SearchUtils.js';
import { OutlinerContextMenu } from './OutlinerContextMenu.js';
import { BasePanel } from './BasePanel.js';
import { createOutlinerPanelStructure, renderOutlinerSearchControls } from './panel-structures/OutlinerPanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';
import { MenuPositioningUtils } from '../utils/MenuPositioningUtils.js';

/**
 * Outliner panel UI component
 */
export class OutlinerPanel extends BasePanel {
    constructor(container, stateManager, levelEditor) {
        super(container, stateManager, levelEditor);
        this.searchTerm = '';

        // Track subscriptions for cleanup
        this.subscriptions = [];
        // Context menu reference
        this.contextMenu = null;

        // Persistent object-list DOM state for incremental render() (see render()/reconcileFlatList).
        // Keyed by object id so unchanged nodes are reused across renders instead of torn down —
        // a full teardown+rebuild costs ~200-400ms at ~2000 objects (all DOM node creation),
        // dominating everything else combined (measured via chrome-devtools during a duplicate-
        // placement profile). null objectsContainer means "not bootstrapped yet".
        this._objectsContainer = null;
        this._itemNodeCache = new Map(); // objId -> item element
        this._searchResultsInfoNode = null;

        // Icon "paint drag" (mirrors LayersPanel/LevelsPanel) — mousedown on an object's eye
        // icon + drag over other eye icons applies the same visibility before mouseup. No
        // native draggable rows exist in this panel, so unlike the other two panels there's
        // nothing to suspend/restore here.
        this._iconPaintDrag = null; // { value: boolean }
        this._endIconPaintDragBound = () => this._endIconPaintDrag();
        document.addEventListener('mouseup', this._endIconPaintDragBound);

        // Initialize panel structure
        this.panelElements = createOutlinerPanelStructure(this.container);

        // Register search in universal search manager
        searchManager.registerSearch(
            'outliner',
            'outliner-search',
            (searchTerm) => {
                this.searchTerm = searchTerm;
                Logger.outliner.debug('Search term changed:', searchTerm);
                this.render();
            },
            () => {
                // Clear callback - could be used for additional cleanup
                Logger.outliner.debug('Search cleared');
            }
        );

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
        // Setup selection functionality
        this.setupSelection({
            selectionKey: 'selectedObjects',
            anchorKey: 'outliner.shiftAnchor',
            getItemList: () => this.getFlatObjectList(),
            onSelectionChange: () => this.render(),
            canSelect: (obj) => {
                const level = this.levelEditor.getLevel();
                const effectiveLayerId = this.levelEditor.renderOperations ?
                    this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
                    (obj.layerId || level.getMainLayerId());
                const layer = level.getLayerById(effectiveLayerId);
                if (layer && layer.locked) return false;
                return !this.levelEditor.levelsManager?.getCurrentSession()?.locked;
            },
            itemSelector: '[data-object-id]',
            selectedClass: 'selected'
        });

        // Subscribe to level changes
        const unsubscribeLevel = this.stateManager.subscribe('level', () => this.render());
        this.subscriptions.push(unsubscribeLevel);

        // Subscribe to level structure changes (object/layer add/remove/reorder) — see
        // Level.setStructureChangeCallback / tmp/REACTIVE_LEVEL_UPDATES_PLAN.md. Replaces
        // the need for every mutating operation to remember calling editor.updateAllPanels().
        const unsubscribeStructure = this.stateManager.subscribe('levelStructureChanged', () => this.render());
        this.subscriptions.push(unsubscribeStructure);

        // Subscribe to outliner state changes (including filters)
        const unsubscribeOutliner = this.stateManager.subscribe('outliner', () => {
            // Update activeTypeFilters from state
            this.activeTypeFilters = this.stateManager.get('outliner').activeTypeFilters || new Set();
            this.render();
        });
        this.subscriptions.push(unsubscribeOutliner);
    }

    /**
     * Render outliner search controls in the top custom section
     */
    renderOutlinerSearchControls() {
        // Get the top custom section from panel structure
        const topSection = this.panelElements?.topCustom;
        if (!topSection) {
            Logger.ui.warn('OutlinerPanel: Top custom section not available, skipping search controls render');
            return;
        }

        // Check if outliner panel is currently active
        const outlinerPanel = document.getElementById('outliner-content-panel');
        if (!outlinerPanel || outlinerPanel.classList.contains('hidden')) {
            return; // Don't render if outliner is not active
        }

        // Check if controls are already rendered (avoid unnecessary re-rendering)
        const searchInput = topSection.querySelector('#outliner-search');
        const filterButton = topSection.querySelector('#outliner-filter-btn');

        if (searchInput && filterButton) {
            // Controls already exist, just update search value
            const currentTerm = searchManager.getSearchTerm('outliner');
            if (searchInput.value !== currentTerm) {
                searchInput.value = currentTerm;
            }
            Logger.outliner.debug('Outliner controls already rendered, skipping re-render');
            return;
        }

        // Use the structure's render function with callbacks
        renderOutlinerSearchControls(topSection, {
            getSearchTerm: () => searchManager.getSearchTerm('outliner'),
            onSearch: (searchTerm) => {
                this.searchTerm = searchTerm;
                Logger.outliner.debug('Search term changed:', searchTerm);
                this.render();
            },
            getActiveFilters: () => this.activeTypeFilters,
            onFilterClick: (button) => this.showFilterMenu(button)
        });

        Logger.outliner.debug('Outliner search controls rendered in top section');
    }

    /**
     * Show filter menu with object types.
     *
     * Positioned flush below the button (MenuPositioningUtils default), same as the identical
     * filter menu in AssetPanel.showAssetFilterMenu. Closing relies on MenuPositioningUtils'
     * setupMenuClosing(), which tracks real cursor coordinates against the button+menu rects
     * rather than native mouseleave — so it doesn't matter that the cursor is over the BUTTON,
     * not the menu, at the moment the menu opens.
     *
     * Ctrl+click: hold Ctrl to toggle multiple type checkboxes without applying the filter or
     * closing the menu (each option's handler stops the click from bubbling to the menu's
     * default close-on-click while Ctrl is held); the accumulated filter is applied AND the
     * menu closes together, once, on Ctrl release. A plain click keeps applying immediately
     * and closing right away, as it always did.
     */
    showFilterMenu(button) {
        // Get all available object types from current level
        const level = this.levelEditor.getLevel();
        const allObjects = level.getAllObjects();
        const availableTypes = MenuPositioningUtils.getObjectTypes(allObjects);

        // Create menu using utility
        const menu = MenuPositioningUtils.createMenuElement({ className: 'p-2' });

        // Position menu using utility
        MenuPositioningUtils.showMenu(menu, button, {
            alignment: 'right',
            direction: 'below',
            menuWidth: 192,
            menuHeight: 200
        });

        // Applying (and closing) on Ctrl release commits whatever was accumulated while Ctrl
        // was held. Only 'Control' — metaKey clicks are treated the same as Ctrl for the
        // multi-select gesture itself, but Cmd has no equivalent reliable "just released" key.
        //
        // If the cursor leaves the menu's hit area before Ctrl is released, MenuPositioningUtils
        // closes the menu on its own (see setupMenuClosing) without going through
        // ctrlReleaseHandler — so the accumulated-but-unapplied edits would otherwise be silently
        // dropped while this.activeTypeFilters (mutated live by each checkbox click) stays out of
        // sync with what's actually applied. Snapshot the pre-session filters and roll back to
        // them on any close that didn't go through the apply paths below.
        const filtersSnapshot = new Set(this.activeTypeFilters);
        let filtersApplied = false;
        const ctrlReleaseHandler = (e) => {
            if (e.key === 'Control') {
                this.stateManager.update({ 'outliner.activeTypeFilters': this.activeTypeFilters });
                this.render();
                filtersApplied = true;
                if (menu._closeMenuHandler) menu._closeMenuHandler();
            }
        };
        document.addEventListener('keyup', ctrlReleaseHandler);
        // Fires once the menu actually closes, whichever path (cursor-leave or click) triggered it.
        menu.addEventListener('menuclose', () => {
            document.removeEventListener('keyup', ctrlReleaseHandler);
            if (!filtersApplied) {
                this.activeTypeFilters = filtersSnapshot;
            }
        });

        /**
         * Apply the (already-mutated) this.activeTypeFilters. Ctrl-held: only refresh the
         * checkboxes and stop the click from bubbling to the menu's default close-on-click, so
         * the user can keep selecting more types (applied later by ctrlReleaseHandler above).
         * Otherwise: apply immediately and let the click bubble on to close the menu, as before.
         */
        const applyOrDefer = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                this.updateFilterMenu(menu, button);
            } else {
                this.stateManager.update({ 'outliner.activeTypeFilters': this.activeTypeFilters });
                this.render();
                filtersApplied = true;
                this.updateFilterMenu(menu, button);
            }
        };

        // Add "Toggle All" option using utility
        const allTypesActive = this.activeTypeFilters.size === 0;
        const allOption = MenuPositioningUtils.createMenuItem({
            text: 'Toggle All',
            checked: allTypesActive
        });
        allOption.querySelector('input').id = 'filter-all';

        allOption.addEventListener('click', (e) => {
            // Check current state at the time of click
            const currentlyAllActive = this.activeTypeFilters.size === 0;

            if (currentlyAllActive) {
                // Currently all types are active, deactivate all
                this.activeTypeFilters = new Set(['DISABLE_ALL']);
            } else {
                // Currently some types are filtered or disabled, activate all
                this.activeTypeFilters.clear();
            }
            applyOrDefer(e);
        });

        menu.appendChild(allOption);

        // Add separator
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-600 my-1';
        menu.appendChild(separator);

        // Add individual type options using utility
        Array.from(availableTypes).sort().forEach(type => {
            // Type is active if: no filters (show all) OR specifically selected OR not in DISABLE_ALL mode
            const isActive = this.activeTypeFilters.size === 0 ||
                           (this.activeTypeFilters.has(type) && !this.activeTypeFilters.has('DISABLE_ALL'));

            const option = MenuPositioningUtils.createMenuItem({
                text: type,
                checked: isActive
            });
            option.querySelector('input').id = `filter-${type}`;

            option.addEventListener('click', (e) => {
                if (this.activeTypeFilters.has('DISABLE_ALL')) {
                    // If in DISABLE_ALL mode, start with this type only
                    this.activeTypeFilters = new Set([type]);
                } else if (this.activeTypeFilters.size === 0) {
                    // If all were active, exclude this type (show all except this one)
                    const level = this.levelEditor.getLevel();
                    const allObjects = level.getAllObjects();
                    const allTypes = MenuPositioningUtils.getObjectTypes(allObjects);
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
                applyOrDefer(e);
            });

            menu.appendChild(option);
        });

        // Real item count (and therefore real menu height) is only known now that all options
        // are in — see repositionMenu() for why the initial showMenu() position can be off.
        MenuPositioningUtils.repositionMenu(menu, button, {
            alignment: 'right',
            direction: 'below',
            menuWidth: 192,
            menuHeight: 200
        });
    }

    /**
     * Update filter menu to reflect current filter state
     */
    updateFilterMenu(menu, button) {
        // Get all available object types from current level using utility
        const level = this.levelEditor.getLevel();
        const allObjects = level.getAllObjects();
        const availableTypes = MenuPositioningUtils.getObjectTypes(allObjects);

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
        button.className = `px-3 py-1 rounded text-sm flex items-center justify-center ${
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
        // Keep top controls fixed and make only the object list area scrollable.
        // Use CSS class layout to avoid conflicting with tab visibility toggles.
        this.container.classList.add('outliner-tab-layout');

        // Save search input state before clearing
        const searchInput = document.getElementById('outliner-search');
        const wasSearchFocused = searchInput && document.activeElement === searchInput;

        // Bootstrap structural (top/bottom custom) sections once; only tear everything down
        // (including the item-node cache) if the panel structure itself is missing/corrupted —
        // NOT on every render. The object list itself is reconciled in place (see below),
        // never torn down: a full teardown+rebuild was ~200-400ms at ~2000 objects (all DOM
        // node creation), dwarfing every other render/perf fix in this pass combined.
        if (!this.panelElements?.topCustom || !this.container.contains(this.panelElements.topCustom)) {
            Array.from(this.container.children).forEach(child => this.container.removeChild(child));
            this.panelElements = createOutlinerPanelStructure(this.container);
            this._objectsContainer = null;
            this._itemNodeCache.clear();
            this._searchResultsInfoNode = null;
        }

        // Render outliner search controls in top custom section
        this.renderOutlinerSearchControls();

        // Create the object list container once and reuse it — search/filter controls stay
        // outside of it so they're excluded from its middle-mouse panning.
        if (!this._objectsContainer || !this.container.contains(this._objectsContainer)) {
            this._objectsContainer = document.createElement('div');
            this._objectsContainer.id = 'outliner-objects-container';
            this._objectsContainer.className = 'outliner-objects-container';
            this._itemNodeCache.clear();
            this._searchResultsInfoNode = null;
            // Bind panning once per element instance — ScrollUtils dedupes by container
            // internally, but a fresh element still needs its first registration.
            this.setupScrolling({
                horizontal: true,
                vertical: true,
                sensitivity: 1.0,
                target: this._objectsContainer
            });
        }
        // Always (re)place at the end, after the (possibly just re-rendered) top controls.
        this.container.appendChild(this._objectsContainer);
        const objectsContainer = this._objectsContainer;

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

        // Show search results info (single lightweight banner node, not part of the keyed diff)
        if (this.searchTerm) {
            const totalFiltered = this.countAllObjectsRecursive(filteredObjects);
            Logger.outliner.info(`Search "${this.searchTerm}" found ${totalFiltered} objects`);

            if (!this._searchResultsInfoNode) {
                this._searchResultsInfoNode = SearchUtils.createSearchResultsInfo(totalFiltered, this.searchTerm, 'objects');
                objectsContainer.insertBefore(this._searchResultsInfoNode, objectsContainer.firstChild);
            } else {
                this._searchResultsInfoNode.textContent = `Found ${totalFiltered} objects matching "${this.searchTerm}"`;
                if (objectsContainer.firstChild !== this._searchResultsInfoNode) {
                    objectsContainer.insertBefore(this._searchResultsInfoNode, objectsContainer.firstChild);
                }
            }
        } else if (this._searchResultsInfoNode) {
            this._searchResultsInfoNode.remove();
            this._searchResultsInfoNode = null;
        }

        // Flatten the filtered tree (DFS, respecting collapsed groups) into an ordered list,
        // then reconcile it against the existing DOM instead of rebuilding from scratch —
        // unchanged items are reused in place (O(1) per item when order didn't change).
        const flatList = this.buildFlatRenderList(filteredObjects);
        this.reconcileFlatList(objectsContainer, flatList);

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

    /**
     * Flatten the filtered object tree into a depth-first, display-order list of
     * { obj, depth } — mirrors the recursion that renderGroupNode/renderObjectNode used to do
     * directly against the DOM. Kept separate from getFlatObjectList() (used by shift-click
     * range selection) since that one doesn't track depth and is relied on elsewhere.
     */
    buildFlatRenderList(filteredObjects) {
        const flat = [];
        const walk = (objects, depth) => {
            objects.forEach(obj => {
                flat.push({ obj, depth });
                if (obj.type === 'group' && obj.children) {
                    let isCollapsed = this.stateManager.get('outliner').collapsedGroups.has(obj.id);
                    if (this.searchTerm) {
                        const hasMatchingChildren = this.hasMatchingChildrenRecursive(obj.children, this.searchTerm);
                        if (hasMatchingChildren) isCollapsed = false;
                    }
                    if (!isCollapsed) {
                        const childrenToWalk = this.searchTerm
                            ? SearchUtils.filterObjectsRecursive(obj.children, this.searchTerm, 'name', 'children')
                            : obj.children;
                        walk(childrenToWalk, depth + 1);
                    }
                }
            });
        };
        walk(filteredObjects, 0);
        return flat;
    }

    /**
     * Keyed reconciliation: create/update/reposition/remove item DOM nodes so the container's
     * children end up matching flatList exactly, reusing this._itemNodeCache entries (by
     * object id) wherever possible instead of recreating them. insertBefore() on a node
     * that's already in the document MOVES it rather than cloning, so already-correctly-
     * positioned nodes cost a single reference check (no DOM op) and only actually
     * new/reordered/removed nodes touch the DOM.
     */
    reconcileFlatList(container, flatList) {
        const seen = new Set();
        let anchor = this._searchResultsInfoNode || null;

        flatList.forEach(({ obj, depth }) => {
            seen.add(obj.id);
            let node = this._itemNodeCache.get(obj.id);

            node = obj.type === 'group'
                ? this.renderGroupNode(obj, depth, node)
                : this.renderObjectNode(obj, depth, node);

            this._itemNodeCache.set(obj.id, node);

            const expectedNext = anchor ? anchor.nextSibling : container.firstChild;
            if (expectedNext !== node) {
                container.insertBefore(node, expectedNext);
            }
            anchor = node;
        });

        this._itemNodeCache.forEach((node, id) => {
            if (!seen.has(id)) {
                node.remove();
                this._itemNodeCache.delete(id);
            }
        });
    }

    // Same open/closed eye SVG paths LayersPanel uses, for visual consistency.
    static VISIBILITY_ICON_OPEN = '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>';
    static VISIBILITY_ICON_CLOSED = '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>';

    /**
     * Create a clickable "eye" visibility icon button (mirrors LayersPanel's eye icon).
     * Toggles obj.visible via ObjectOperations.toggleObjectVisibility — the same method
     * the H hotkey uses, so both stay in sync by construction. Looks up the current object
     * by id at click time (like the click/dblclick handlers below), not by closing over the
     * object reference, so a reused node stays correct after undo/redo.
     * @param {HTMLElement} item - The row element (dataset.id is read at click time)
     * @returns {HTMLElement}
     */
    createVisibilityButton(item) {
        const btn = document.createElement('span');
        btn.className = 'outliner-visibility-btn';
        btn.style.flexShrink = '0';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.padding = '0 4px';
        btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"></svg>';
        // mousedown (not click) so a plain press and a paint-drag (mousedown + drag over more
        // eye icons, see handleVisibilityIconMouseOver/_paintObjectVisibility) share one path.
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const current = this.levelEditor.level.findObjectById(item.dataset.id);
            if (!current) return;
            if (e.ctrlKey || e.metaKey) {
                // Solo (like Ctrl+click a layer's eye icon): hide every other top-level
                // object; a soloed group's own children are unaffected (see
                // ObjectOperations.toggleObjectSolo). Single-shot, not paintable.
                this.levelEditor.objectOperations.toggleObjectSolo(current);
                return;
            }
            e.preventDefault();
            this._iconPaintDrag = { value: !current.visible };
            this._paintObjectVisibility(current, btn, item);
        });
        btn.addEventListener('mouseover', () => {
            if (!this._iconPaintDrag) return;
            const current = this.levelEditor.level.findObjectById(item.dataset.id);
            if (!current) return;
            this._paintObjectVisibility(current, btn, item);
        });
        return btn;
    }

    /**
     * Apply visibility=targetValue to one object during a paint drag (mousedown on an eye
     * icon + drag over more eye icons before mouseup, mirrors LayersPanel/LevelsPanel).
     * Mutates the model + gives immediate feedback on this row's own icon; the shared
     * history/cache/full-panel-refresh tail (ObjectOperations.afterVisibilityChange) is
     * batched once in _endIconPaintDrag rather than paid per icon crossed while dragging —
     * otherwise a fast drag over many objects would push one undo entry per object.
     * @param {Object} obj
     * @param {HTMLElement} visibilityBtn
     * @param {HTMLElement} item - row element, for the name-display color update
     */
    _paintObjectVisibility(obj, visibilityBtn, item) {
        if (!this._iconPaintDrag || obj.visible === this._iconPaintDrag.value) return;
        this.levelEditor.objectOperations.toggleObjectVisibility(obj);
        const nameSpan = item.querySelector('.outliner-item-name-display');
        if (nameSpan) {
            this.updateVisibilityButton(visibilityBtn, nameSpan, obj);
        }
    }

    /**
     * Row opacity: hidden (effective visibility, see isObjectEffectivelyVisible) takes
     * priority over locked-layer dimming — a hidden-and-locked object should still read as
     * "hidden" first. Shared by the full-render path (renderObjectNode/renderGroupNode) and
     * the live per-icon update (updateVisibilityButton, incl. during paint-drag) so both
     * compute the identical value.
     * @param {Object} obj
     * @param {boolean} [effectivelyVisible] - pass through if already computed, to avoid a
     *   redundant isObjectEffectivelyVisible call
     * @returns {string} CSS opacity value
     */
    _computeRowOpacity(obj, effectivelyVisible = this.levelEditor.objectOperations.isObjectEffectivelyVisible(obj)) {
        if (!effectivelyVisible) return '0.45';
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        if (layer && layer.locked) return '0.5';
        return this.levelEditor.levelsManager?.getCurrentSession()?.locked ? '0.5' : '';
    }

    /**
     * mouseup (global, document-level since a drag can end outside this panel): close out the
     * paint drag and run the batched history/render/panel-refresh tail once for the whole
     * gesture.
     */
    _endIconPaintDrag() {
        if (!this._iconPaintDrag) return;
        this._iconPaintDrag = null;
        this.levelEditor.objectOperations.afterVisibilityChange();
    }

    /**
     * Refresh a visibility button's icon/title and the row's name-display color, based on
     * the object's actual current EFFECTIVE visibility (own/ancestor `visible` flags, layer
     * visibility, Object Solo, Isolate — see ObjectOperations.isObjectEffectivelyVisible) and
     * Object Solo state. Deliberately NOT based on `obj.visible` alone: a click on a
     * DIFFERENT object's eye icon (soloing it) makes THIS object stop rendering too, without
     * ever touching its own `visible` flag — the icon must reflect that. Shared by
     * renderGroupNode/renderObjectNode.
     */
    updateVisibilityButton(visibilityBtn, nameSpan, obj) {
        const objectOperations = this.levelEditor.objectOperations;
        const soloedId = this.stateManager.get('view.soloedTopLevelObjectId');
        const isSoloed = soloedId && objectOperations.findTopLevelAncestor(obj).id === soloedId;
        const effectivelyVisible = objectOperations.isObjectEffectivelyVisible(obj);

        // Whole-row dim (mirrors LayersPanel/LevelsPanel's row-opacity hidden state) — without
        // this, hidden objects only showed a slightly darker icon/name color, easy to miss
        // next to the other two panels' much more visible row fade. visibilityBtn is always a
        // direct child of the row (see renderObjectNode/renderGroupNode).
        const item = visibilityBtn.closest('.outliner-item');
        if (item) {
            item.style.opacity = this._computeRowOpacity(obj, effectivelyVisible);
        }

        visibilityBtn.title = isSoloed
            ? 'Soloed — Ctrl+click to un-solo'
            : (obj.visible ? 'Hide object (H, Ctrl+click to solo)' : 'Show object (H, Ctrl+click to solo)');
        const svg = visibilityBtn.querySelector('svg');
        if (svg) {
            // `.outliner-item.selected *` forces `color !important` (see styles/main.css) —
            // a plain `svg.style.color = ...` gets silently overridden while the row is
            // selected, so the icon LOOKS unchanged until selection is cleared (e.g. by
            // clicking the canvas). Match that !important with our own so solo/hidden
            // color always wins regardless of selection state.
            if (isSoloed) {
                svg.style.setProperty('color', '#fbbf24', 'important');
            } else if (!effectivelyVisible) {
                svg.style.setProperty('color', '#6b7280', 'important');
            } else {
                svg.style.removeProperty('color');
            }
            svg.innerHTML = effectivelyVisible ? OutlinerPanel.VISIBILITY_ICON_OPEN : OutlinerPanel.VISIBILITY_ICON_CLOSED;
        }
        if (effectivelyVisible) {
            nameSpan.style.removeProperty('color');
        } else {
            nameSpan.style.setProperty('color', '#6b7280', 'important');
        }
    }

    /**
     * Build the icon+name-display+name-input cluster shared by group and object outliner rows.
     * `getCurrentObject` is called lazily on dblclick (not closed over directly) so a reused
     * node stays correct even after undo/redo replaces the underlying object reference.
     */
    createOutlinerNameContainer(getCurrentObject) {
        const nameContainer = document.createElement('div');
        nameContainer.className = 'outliner-item-name-container';
        nameContainer.style.flex = '1';
        nameContainer.style.minWidth = '0';
        nameContainer.style.display = 'flex';
        nameContainer.style.alignItems = 'center';

        const icon = document.createElement('span');
        icon.className = 'outliner-item-icon';
        icon.style.marginRight = 'calc(4px * max(var(--spacing-scale, 1.0), 0))';
        icon.style.flexShrink = '0';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'outliner-item-name-display';
        nameSpan.style.flex = '1';
        nameSpan.style.padding = 'calc(1px * max(var(--spacing-scale, 1.0), 0))';
        nameSpan.style.borderRadius = '3px';
        nameSpan.style.minWidth = '0';
        nameSpan.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const current = getCurrentObject();
            if (current) this.startInlineRename(current);
        });

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'outliner-item-name-input';
        nameInput.style.flex = '1';
        nameInput.style.background = 'transparent';
        nameInput.style.border = 'none';
        nameInput.style.color = 'var(--ui-text-color, #d1d5db)';
        nameInput.style.outline = 'none';
        nameInput.style.padding = 'calc(1px * max(var(--spacing-scale, 1.0), 0))';
        nameInput.style.borderRadius = '3px';
        nameInput.style.minWidth = '0';
        nameInput.style.display = 'none';

        nameContainer.appendChild(icon);
        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(nameInput);

        return { nameContainer, icon, nameSpan, nameInput };
    }

    /**
     * Apply/clear the locked-layer/locked-level visual state (border class, cursor, tooltip)
     * shared by group and object outliner rows.
     */
    applyLockedRowState(item, obj) {
        const effectiveLayerId = this.levelEditor.renderOperations ?
            this.levelEditor.renderOperations.getEffectiveLayerId(obj) :
            (obj.layerId || this.levelEditor.level.getMainLayerId());
        const layer = this.levelEditor.level.getLayerById(effectiveLayerId);
        const levelLocked = !!this.levelEditor.levelsManager?.getCurrentSession()?.locked;
        if ((layer && layer.locked) || levelLocked) {
            item.classList.add('locked');
            item.style.cursor = 'not-allowed';
            item.title = levelLocked ? 'Current level is locked' : 'Object is in locked layer';
        } else {
            item.classList.remove('locked');
            item.style.cursor = '';
            item.title = '';
        }
        // updateVisibilityButton (called by callers before this) already set item.style.opacity
        // from _computeRowOpacity, which factors in this same locked check.
    }

    /**
     * Create (existingNode absent) or refresh (existingNode present) the DOM node for a group
     * item. Click/dblclick handlers look up the current object by id at call time
     * (level.findObjectById) rather than closing over `group` directly, so a reused node
     * stays correct even after undo/redo replaces the underlying object reference.
     */
    renderGroupNode(group, depth, existingNode) {
        let item, indicator, nameContainer, icon, nameSpan, nameInput, visibilityBtn;

        if (!existingNode) {
            item = document.createElement('div');
            item.className = 'outliner-item outliner-group-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';

            indicator = document.createElement('span');
            indicator.className = 'outliner-collapse-indicator';
            indicator.style.cursor = 'pointer';
            indicator.style.userSelect = 'none';
            indicator.style.color = '#666';
            indicator.style.marginRight = 'calc(4px * max(var(--spacing-scale, 1.0), 0))';
            indicator.style.pointerEvents = 'auto';
            indicator.style.display = 'inline-block';
            indicator.style.width = '12px';
            indicator.style.textAlign = 'center';
            indicator.style.flexShrink = '0';
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.toggleGroupCollapse(item.dataset.id);
            });

            ({ nameContainer, icon, nameSpan, nameInput } = this.createOutlinerNameContainer(
                () => this.levelEditor.level.findObjectById(item.dataset.id)
            ));
            icon.textContent = this.getObjectIcon('group');

            item.appendChild(indicator);
            item.appendChild(nameContainer);

            visibilityBtn = this.createVisibilityButton(item);
            item.appendChild(visibilityBtn);

            item.addEventListener('click', (e) => {
                // Don't handle selection if right-click (context menu)
                if (e.button === 2) return;
                // Don't handle selection if clicked on collapse indicator
                if (e.target.classList.contains('outliner-collapse-indicator')) return;
                const current = this.levelEditor.level.findObjectById(item.dataset.id);
                if (current) this.handleItemClick(e, current);
            });
        } else {
            item = existingNode;
            indicator = item.querySelector(':scope > .outliner-collapse-indicator');
            nameContainer = item.querySelector(':scope > .outliner-item-name-container');
            icon = nameContainer.querySelector('.outliner-item-icon');
            nameSpan = nameContainer.querySelector('.outliner-item-name-display');
            nameInput = nameContainer.querySelector('.outliner-item-name-input');
            visibilityBtn = item.querySelector(':scope > .outliner-visibility-btn');
        }

        // --- Parts refreshed on every render, whether the node is new or reused ---
        item.dataset.id = group.id;
        item.style.paddingLeft = `calc(${5 + depth * 15}px * max(var(--spacing-scale, 1.0), 0))`;

        let isCollapsed = this.stateManager.get('outliner').collapsedGroups.has(group.id);
        if (this.searchTerm && group.children) {
            const hasMatchingChildren = this.hasMatchingChildrenRecursive(group.children, this.searchTerm);
            if (hasMatchingChildren) isCollapsed = false;
        }
        indicator.textContent = isCollapsed ? '▶' : '▼';

        const childCount = group.children ? group.children.length : 0;
        let nameText = `${group.name || `[${group.type}]`}`;
        if (childCount > 0) nameText += ` (${childCount})`;
        nameSpan.textContent = nameText;
        // Don't clobber the input while the user is actively editing it inline.
        if (document.activeElement !== nameInput) {
            nameInput.value = group.name || '';
        }
        nameInput.id = `group-name-input-${group.id}`;
        nameInput.name = nameInput.id;

        this.updateVisibilityButton(visibilityBtn, nameSpan, group);
        this.applyLockedRowState(item, group);

        item.classList.toggle('selected', this.stateManager.get('selectedObjects').has(group.id));

        return item;
    }

    /**
     * Create (existingNode absent) or refresh (existingNode present) the DOM node for a
     * non-group object item. See renderGroupNode for the id-lookup-at-click-time rationale.
     */
    renderObjectNode(obj, depth, existingNode) {
        let item, nameContainer, icon, nameSpan, nameInput, visibilityBtn;

        if (!existingNode) {
            item = document.createElement('div');
            item.className = 'outliner-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.dataset.id = obj.id;

            ({ nameContainer, icon, nameSpan, nameInput } = this.createOutlinerNameContainer(
                () => this.levelEditor.level.findObjectById(item.dataset.id)
            ));
            item.appendChild(nameContainer);

            visibilityBtn = this.createVisibilityButton(item);
            item.appendChild(visibilityBtn);

            item.addEventListener('click', (e) => {
                if (e.button === 2) return;
                const current = this.levelEditor.level.findObjectById(item.dataset.id);
                if (current) this.handleItemClick(e, current);
            });
        } else {
            item = existingNode;
            nameContainer = item.querySelector(':scope > .outliner-item-name-container');
            icon = nameContainer.querySelector('.outliner-item-icon');
            nameSpan = nameContainer.querySelector('.outliner-item-name-display');
            nameInput = nameContainer.querySelector('.outliner-item-name-input');
            visibilityBtn = item.querySelector(':scope > .outliner-visibility-btn');
        }

        // --- Parts refreshed on every render, whether the node is new or reused ---
        item.dataset.id = obj.id;
        item.style.paddingLeft = `calc(${5 + depth * 15}px * max(var(--spacing-scale, 1.0), 0))`;
        icon.textContent = this.getObjectIcon(obj.type);
        nameSpan.textContent = obj.name || `[${obj.type}]`;
        if (document.activeElement !== nameInput) {
            nameInput.value = obj.name || '';
        }
        nameInput.id = `object-name-input-${obj.id}`;
        nameInput.name = nameInput.id;

        this.updateVisibilityButton(visibilityBtn, nameSpan, obj);
        this.applyLockedRowState(item, obj);

        item.classList.toggle('selected', this.stateManager.get('selectedObjects').has(obj.id));

        return item;
    }

    // Note: handleObjectClick, handleShiftClick, handleCtrlClick methods removed
    // Now using BasePanel.handleItemClick with SelectionUtils

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
        // Avoid multiple initialization
        if (this.contextMenu) {
            return;
        }
        
        // Use the panel element, not the inner container
        this.contextMenu = new OutlinerContextMenu(this.container.parentElement, this.levelEditor, {
            stateManager: this.stateManager, // Pass StateManager for marquee check
            onRename: (object) => this.handleRenameObject(object),
            onDelete: (object) => this.handleDeleteObject(object),
            onToggleVisibility: (object) => this.handleToggleVisibility(object),
            onSelect: (object) => this.handleSelectObject(object),
            onDuplicate: (object) => this.handleDuplicateObject(object),
            onExpandAllGroups: () => this.handleExpandAllGroups(),
            onCollapseAllGroups: () => this.handleCollapseAllGroups()
        });

        // Register context menu with ContextMenuManager for global resize handling
        if (this.levelEditor && this.levelEditor.contextMenuManager && this.contextMenu) {
            this.levelEditor.contextMenuManager.registerMenu('outliner', this.contextMenu);
        }
    }

    handleRenameObject(object) {
        Logger.outliner.info('Rename requested for object:', object.name);
        // TODO: Implement inline renaming
        this.startInlineRename(object);
    }

    async handleDeleteObject(object) {
        Logger.outliner.info('Delete requested for object:', object.name);

        if (await confirm(`Delete "${object.name || 'Unnamed object'}"?`)) {
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
        this.stateManager.set('selectedObjects', new Set([object.id]));
        this.levelEditor.duplicateSelectedObjects();
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
    
    /**
     * Cleanup and destroy panel
     */
    destroy() {
        Logger.ui.debug('Destroying OutlinerPanel');

        document.removeEventListener('mouseup', this._endIconPaintDragBound);
        this._iconPaintDrag = null;

        // Unsubscribe from all state changes
        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                Logger.ui.warn('Failed to unsubscribe:', error);
            }
        });
        this.subscriptions = [];
        
        // Unregister search from SearchManager
        searchManager.unregisterSearch('outliner');

        // Destroy context menu
        if (this.contextMenu) {
            try {
                this.contextMenu.destroy();
            } catch (error) {
                Logger.ui.warn('Failed to destroy context menu:', error);
            }
            this.contextMenu = null;
        }

        // Call parent destroy
        super.destroy();
        
        // Clear references
        this.searchTerm = '';
        this.activeTypeFilters = null;
        
        Logger.ui.debug('OutlinerPanel destroyed');
    }

}
