import { Logger } from '../utils/Logger.js';
import { BasePanel } from './BasePanel.js';
import { LevelsContextMenu } from './LevelsContextMenu.js';
import { HoverEffects } from '../utils/HoverEffects.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { createLevelsPanelStructure, renderLevelsControls } from './panel-structures/LevelsPanelStructure.js';
import { searchManager } from '../utils/SearchManager.js';

/**
 * Levels panel UI component (mirrors LayersPanel.js). Lists open LevelSessions,
 * lets the user switch the current level, toggle per-level visibility, rename,
 * and close.
 *
 * Still deferred: no per-level Save/Duplicate in the context menu (Save currently only
 * makes sense for the current level, via File menu). Levels have no lock/parallax/solo
 * concept — unlike layers, see tmp/multi-level-support-plan.md section 3.4.
 */
export class LevelsPanel extends BasePanel {
    constructor(container, stateManager, levelEditor) {
        super(container, stateManager, levelEditor);
        this.searchFilter = '';
        this.subscriptions = [];
        this._draggedLevelId = null; // Track dragged level's id for drag-reorder (Phase 6)

        // Initialize panel structure
        this.panelElements = createLevelsPanelStructure(this.container);

        // Register search in universal search manager
        searchManager.registerSearch(
            'levels',
            'levels-search',
            (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLevelsSection();
            },
            null
        );

        this.levelContextMenu = null;
        this.setupContextMenus();
        this.setupEventListeners();
    }

    /**
     * Setup context menu for levels
     */
    setupContextMenus() {
        this.levelContextMenu = new LevelsContextMenu(this.container.parentElement, this, {
            onMakeCurrent: (session) => this.setCurrentLevelAndNotify(session.id),
            onRename: (session) => this.renameLevel(session.id),
            onClose: (session) => this.levelEditor.levelsManager.closeLevel(session.id)
        });

        if (this.levelEditor && this.levelEditor.contextMenuManager && this.levelContextMenu) {
            this.levelEditor.contextMenuManager.registerMenu('levels', this.levelContextMenu);
        }
    }

    setupEventListeners() {
        // Re-render when the set of open levels or the current level changes
        const unsubscribeList = this.stateManager.subscribe('levelsListChanged', () => {
            this.render();
        });
        this.subscriptions.push(unsubscribeList);

        const unsubscribeCurrent = this.stateManager.subscribe('currentLevelChanged', () => {
            this.render();
        });
        this.subscriptions.push(unsubscribeCurrent);
    }

    render() {
        // Save search input state before clearing
        const searchInput = document.getElementById('levels-search');
        const wasSearchFocused = searchInput && document.activeElement === searchInput;

        this.renderLevelsSection();

        if (wasSearchFocused) {
            const newSearchInput = document.getElementById('levels-search');
            if (newSearchInput) {
                newSearchInput.focus();
                newSearchInput.setSelectionRange(newSearchInput.value.length, newSearchInput.value.length);
            }
        }
    }

    /**
     * Render level controls in the top custom section
     */
    renderLevelsSearchControls() {
        const topSection = this.panelElements?.topCustom;
        if (!topSection) return;

        // Don't render if the Layers tab (shared parent of the Levels section) isn't active
        const layersContentPanel = document.getElementById('layers-content-panel');
        if (!layersContentPanel || layersContentPanel.classList.contains('hidden')) {
            return;
        }

        const searchInput = topSection.querySelector('#levels-search');
        const addButton = topSection.querySelector('#add-level-btn');

        if (searchInput && addButton) {
            const currentTerm = searchManager.getSearchTerm('levels');
            if (searchInput.value !== currentTerm) {
                searchInput.value = currentTerm;
            }
            if (!searchInput.hasAttribute('data-search-managed')) {
                searchManager.setupSearchListeners('levels');
            }
            return;
        }

        renderLevelsControls(topSection, {
            getSearchFilter: () => searchManager.getSearchTerm('levels'),
            onSearch: (searchFilter) => {
                this.searchFilter = searchFilter;
                this.renderLevelsSection();
            },
            onAddLevel: () => this.onAddLevel()
        });

        const newSearchInput = topSection.querySelector('#levels-search');
        if (newSearchInput && !newSearchInput.hasAttribute('data-search-managed')) {
            searchManager.setupSearchListeners('levels');
        }
    }

    /**
     * Render the levels list section
     */
    renderLevelsSection() {
        const sessions = this.levelEditor.levelsManager.getOrderedSessions();

        // Clear container but preserve custom sections
        const children = Array.from(this.container.children);
        children.forEach(child => {
            if (!child.classList.contains('panel-top-custom')) {
                this.container.removeChild(child);
            }
        });

        if (!this.panelElements?.topCustom || !this.container.contains(this.panelElements.topCustom)) {
            this.panelElements = createLevelsPanelStructure(this.container);
        }

        this.renderLevelsSearchControls();

        const levelsList = document.createElement('div');
        levelsList.className = 'levels-list space-y-1';
        levelsList.id = 'levels-list';

        const displayNames = this._computeDisplayNames(sessions);
        const filteredSessions = this.filterLevels(sessions);
        filteredSessions.forEach(session => {
            levelsList.appendChild(this.createLevelElement(session, displayNames.get(session.id)));
        });

        this.container.appendChild(levelsList);

        const scrollableContainer = this.container.closest('.flex-grow.overflow-y-auto');
        this.setupScrolling({
            horizontal: true,
            vertical: true,
            sensitivity: 1.0,
            target: scrollableContainer || this.container
        });

        if (this._eventHandlersRegistered) {
            eventHandlerManager.unregisterContainer(this.container);
        }
        this._eventHandlersRegistered = false;
        this.setupLevelsPanelHandlers();
    }

    /**
     * Compute display-only names disambiguating name collisions (e.g. two "Untitled
     * Level" tabs) with a numeric suffix ("Untitled Level (2)") — never mutates
     * session.level.meta.name (Edge Case 1).
     * @param {LevelSession[]} sessions - full open session list (not just filtered/visible)
     * @returns {Map<string,string>} sessionId -> display name
     */
    _computeDisplayNames(sessions) {
        const counts = new Map();
        sessions.forEach(session => {
            const name = session.level.meta.name || 'Untitled Level';
            counts.set(name, (counts.get(name) || 0) + 1);
        });

        const seen = new Map();
        const result = new Map();
        sessions.forEach(session => {
            const name = session.level.meta.name || 'Untitled Level';
            if (counts.get(name) > 1) {
                const occurrence = (seen.get(name) || 0) + 1;
                seen.set(name, occurrence);
                result.set(session.id, occurrence === 1 ? name : `${name} (${occurrence})`);
            } else {
                result.set(session.id, name);
            }
        });
        return result;
    }

    /**
     * Create a single level list item
     */
    createLevelElement(session, displayName = session.level.meta.name) {
        const isCurrent = session.id === this.levelEditor.currentLevelId;
        const objectsCount = session.level.getStats ? session.level.getStats().totalObjects : session.level.objects.length;
        // Approximation until Phase 5 wires per-session isDirty tracking: the current
        // tab reflects the live global dirty flag, background tabs show their last
        // known value (always false until a later phase updates it on switch-away).
        const isDirty = session.id === this.levelEditor.currentLevelId
            ? this.stateManager.get('isDirty')
            : session.isDirty;

        const levelDiv = document.createElement('div');
        levelDiv.className = `level-item flex items-center justify-between p-2 rounded border border-gray-600 cursor-pointer transition-colors ${
            isCurrent ? 'bg-blue-600' : 'bg-gray-700'
        }`;
        levelDiv.style.opacity = session.visible ? '' : '0.45';
        // Drag-reorder needs the full open-level list in view — with an active search
        // filter, #levels-list only contains a subset, so a drop would silently reorder
        // against a mismatched id set (LevelsManager.reorderLevels() no-ops on that).
        levelDiv.draggable = !this.searchFilter;
        levelDiv.dataset.levelId = session.id;

        levelDiv.innerHTML = `
            <div class="flex items-center space-x-2 flex-1 min-w-0">
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                    <span class="level-name-display flex-1 px-1 py-1 rounded min-w-0" style="color: var(--ui-text-color, #d1d5db);"
                          data-level-id="${session.id}">${displayName}</span>
                    <input type="text"
                           id="level-name-${session.id}"
                           name="level-name-${session.id}"
                           value="${session.level.meta.name}"
                           class="level-name-input bg-transparent border-none flex-1 focus:outline-none focus:bg-gray-600 px-1 rounded min-w-0 hidden" style="color: var(--ui-text-color, #d1d5db);"
                           data-level-id="${session.id}">
                    <span class="level-dirty-indicator w-2 h-2 rounded-full flex-shrink-0 ${isDirty ? '' : 'invisible'}"
                          style="background-color: #fbbf24;" title="Unsaved changes"></span>
                </div>
            </div>
            <div class="flex items-center space-x-1 flex-shrink-0">
                <span class="level-objects-count text-sm px-2 py-1 rounded bg-gray-600 min-w-0" style="color: var(--ui-text-color, #9ca3af);"
                      data-level-id="${session.id}">${objectsCount > 0 ? objectsCount : ''}</span>
                <button class="level-visibility-btn p-1 rounded w-8 h-8 flex items-center justify-center"
                        data-level-id="${session.id}"
                        title="${session.visible ? 'Hide level' : 'Show level'}">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" style="color: var(--ui-text-color, #d1d5db);">
                        ${session.visible ?
                            '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                            '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>'
                        }
                    </svg>
                </button>
            </div>
        `;

        HoverEffects.setupListItemHover(levelDiv);

        const visibilityBtn = levelDiv.querySelector('.level-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.classList.add('hover:bg-gray-600');
        }

        return levelDiv;
    }

    /**
     * Update a level element's visual state without recreating it
     */
    updateLevelElement(levelId, session) {
        const levelElement = this.container.querySelector(`[data-level-id="${levelId}"].level-item`);
        if (!levelElement) return;

        levelElement.style.opacity = session.visible ? '' : '0.45';

        const isCurrent = levelId === this.levelEditor.currentLevelId;
        if (isCurrent) {
            levelElement.classList.remove('bg-gray-700');
            levelElement.classList.add('bg-blue-600');
        } else {
            levelElement.classList.remove('bg-blue-600');
            levelElement.classList.add('bg-gray-700');
        }

        const visibilityBtn = levelElement.querySelector('.level-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.title = session.visible ? 'Hide level' : 'Show level';
            const svg = visibilityBtn.querySelector('svg');
            if (svg) {
                svg.innerHTML = session.visible ?
                    '<path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>' :
                    '<path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/>';
            }
        }
    }

    /**
     * Filter levels based on search query
     */
    filterLevels(sessions) {
        if (!this.searchFilter) return sessions;
        const term = this.searchFilter.toLowerCase();
        return sessions.filter(session => (session.level.meta.name || 'Untitled Level').toLowerCase().includes(term));
    }

    /**
     * Handle add level button — creates a new level and adds it as a new tab
     * (does NOT replace the current level, unlike File > New Level pre-Phase-5)
     */
    onAddLevel() {
        const newLevel = this.levelEditor.fileManager.createNewLevel();
        this.levelEditor.levelsManager.addLevel(newLevel, { makeCurrent: true, visible: true });

        // addLevel() → setCurrentLevel() imports this brand-new session's empty
        // history stack; seed it exactly like LevelFileOperations._initializeHistory()
        // does for New Level, so Ctrl+Z on this tab has a baseline state to fall back to.
        this.levelEditor.historyManager.saveState(newLevel.objects, new Set(), true, null);

        Logger.ui.info(`Added level: ${newLevel.meta.name}`);
    }

    /**
     * Toggle level visibility (eye icon)
     */
    toggleLevelVisibility(levelId) {
        this.levelEditor.levelsManager.toggleLevelVisibility(levelId);
        const session = this.levelEditor.levelSessions.get(levelId);
        if (session) {
            this.updateLevelElement(levelId, session);
        }
    }

    /**
     * Set current level and notify other components
     */
    setCurrentLevelAndNotify(levelId) {
        // LevelsManager.setCurrentLevel() already renders + updates all panels
        this.levelEditor.levelsManager.setCurrentLevel(levelId);
    }

    /**
     * Show inline rename input for a level
     */
    renameLevel(levelId) {
        const session = this.levelEditor.levelSessions.get(levelId);
        if (!session) return;

        const input = this.container.querySelector(`#level-name-${levelId}`);
        const display = this.container.querySelector(`[data-level-id="${levelId}"].level-name-display`);
        const levelElement = this.container.querySelector(`[data-level-id="${levelId}"].level-item`);

        if (input && display) {
            // Disable dragging for this level during rename (mirrors LayersPanel.renameLayer)
            if (levelElement) levelElement.draggable = false;
            display.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
            input.select();
        }
    }

    /**
     * Commit a rename from the inline input. Triggers a full re-render (not just patching
     * the display/input elements) so name-collision disambiguation suffixes (Edge Case 1)
     * across all sessions stay correct after the rename, and dragging is re-enabled.
     */
    _commitRename(levelId, rawValue) {
        const session = this.levelEditor.levelSessions.get(levelId);
        if (!session) return;

        // Guard against empty names, mirrors Layer.setName()
        if (rawValue && rawValue.trim()) {
            session.level.meta.name = rawValue.trim();
            session.level.updateModified();
            this.stateManager.markDirty();
        }

        this.render();
    }

    /**
     * Show context menu for a level
     */
    showLevelContextMenu(event) {
        this.levelContextMenu.showContextMenu(event, {});
    }

    /**
     * Setup levels panel handlers using the shared event system
     */
    setupLevelsPanelHandlers() {
        if (this._eventHandlersRegistered) {
            return;
        }

        const levelsHandlers = {
            click: {
                selector: '.level-item, button, [data-level-id], .levels-list',
                handler: (e) => {
                    const target = e.target;

                    const button = target.closest('button');
                    if (button) {
                        if (button.classList.contains('level-visibility-btn')) {
                            const levelId = button.closest('[data-level-id]')?.dataset.levelId;
                            if (levelId) {
                                this.toggleLevelVisibility(levelId);
                            }
                            return;
                        }
                        return;
                    }

                    const levelElement = target.closest('.level-item');
                    if (levelElement) {
                        const levelId = levelElement.dataset.levelId;
                        if (levelId) {
                            const interactiveElement = target.closest('button, input');
                            // Only switch on the single-click of a click/dblclick pair (mirrors
                            // LayersPanel.handleLayerClick's e.detail check) — without this guard,
                            // double-clicking a name to rename it also fires a full level switch
                            // (camera/selection/history round-trip + DOM rebuild) on the first click
                            // of the pair, which is wasted work once the dblclick's rename wins anyway.
                            if (!interactiveElement && e.detail === 1) {
                                this.setCurrentLevelAndNotify(levelId);
                            }
                        }
                    }
                }
            },
            blur: {
                selector: '.level-name-input',
                handler: (e) => {
                    const levelId = e.target.dataset.levelId;
                    this._commitRename(levelId, e.target.value);
                }
            },
            dblclick: {
                selector: '.level-name-display',
                handler: (e) => {
                    e.stopPropagation();
                    const levelId = e.target.dataset.levelId;
                    this.renameLevel(levelId);
                }
            },
            keypress: {
                selector: '.level-name-input',
                handler: (e) => {
                    if (e.key === 'Enter') {
                        e.target.blur();
                    }
                }
            },
            keydown: {
                selector: '.level-name-input',
                handler: (e) => {
                    if (e.key === 'Escape') {
                        const levelId = e.target.dataset.levelId;
                        const session = this.levelEditor.levelSessions.get(levelId);
                        if (session) {
                            e.target.value = session.level.meta.name;
                            e.target.blur();
                        }
                    }
                }
            },
            contextmenu: {
                selector: '.level-item',
                handler: (e) => {
                    const levelElement = e.target.closest('[data-level-id]');
                    if (levelElement && levelElement.classList.contains('level-item')) {
                        this.showLevelContextMenu(e);
                    }
                }
            },
            dragstart: {
                selector: '.level-item',
                handler: (e) => {
                    const levelsList = document.getElementById('levels-list');
                    if (!levelsList) return;

                    if (e.target.classList.contains('level-item')) {
                        // Don't allow dragging while a level name is being renamed
                        const visibleInput = levelsList.querySelector('.level-name-input:not(.hidden)');
                        if (visibleInput) {
                            e.preventDefault();
                            return;
                        }

                        // Store the id, not the element reference — if the list re-renders
                        // mid-drag (e.g. another tab opens/closes concurrently), the original
                        // node goes stale/detached and an identity check against it would
                        // wrongly reject every drop for the rest of the gesture.
                        this._draggedLevelId = e.target.dataset.levelId;
                        e.target.style.opacity = '0.5';
                    }
                }
            },
            dragend: {
                selector: '.level-item',
                handler: (e) => {
                    if (e.target.classList.contains('level-item')) {
                        e.target.style.opacity = '1';
                        this._draggedLevelId = null;
                    }
                }
            },
            dragover: {
                selector: '.levels-list',
                handler: (e) => {
                    e.preventDefault();
                }
            },
            drop: {
                selector: '.levels-list',
                handler: (e) => {
                    e.preventDefault();

                    if (!this._draggedLevelId) return;

                    const dropTarget = e.target.closest('.level-item');
                    if (!dropTarget || dropTarget.dataset.levelId === this._draggedLevelId) return;

                    const levelsList = document.getElementById('levels-list');
                    if (!levelsList) return;

                    const currentOrder = Array.from(levelsList.children).map(el => el.dataset.levelId);

                    const draggedIndex = currentOrder.indexOf(this._draggedLevelId);
                    const dropIndex = currentOrder.indexOf(dropTarget.dataset.levelId);
                    if (draggedIndex === -1 || dropIndex === -1) return;

                    const newOrder = [...currentOrder];
                    newOrder.splice(draggedIndex, 1);
                    newOrder.splice(dropIndex, 0, this._draggedLevelId);

                    this.levelEditor.levelsManager.reorderLevels(newOrder);
                }
            }
        };

        eventHandlerManager.registerContainer(this.container, levelsHandlers);

        Logger.ui.debug('LevelsPanel: event handlers setup complete');
        this._eventHandlersRegistered = true;
    }

    /**
     * Cleanup and destroy panel
     */
    destroy() {
        eventHandlerManager.unregisterContainer(this.container);

        const topSection = this.panelElements?.topCustom;
        if (topSection) {
            eventHandlerManager.unregisterContainer(topSection);
        }

        this._eventHandlersRegistered = false;

        this.subscriptions.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                Logger.ui.warn('Failed to unsubscribe:', error);
            }
        });
        this.subscriptions = [];

        searchManager.unregisterSearch('levels');

        if (this.levelContextMenu) {
            try {
                this.levelContextMenu.destroy();
            } catch (error) {
                Logger.ui.warn('Failed to destroy level context menu:', error);
            }
            this.levelContextMenu = null;
        }

        super.destroy();

        this.searchFilter = '';
    }
}
