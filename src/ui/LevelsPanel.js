import { Logger } from '../utils/Logger.js';
import { BasePanel } from './BasePanel.js';
import { LevelsContextMenu } from './LevelsContextMenu.js';
import { HoverEffects } from '../utils/HoverEffects.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { createLevelsPanelStructure, renderLevelsControls } from './panel-structures/LevelsPanelStructure.js';
import { createListItemRow, updateListItemVisuals } from './panel-structures/ListItemRowStructure.js';
import { searchManager } from '../utils/SearchManager.js';

/**
 * Levels panel UI component (mirrors LayersPanel.js). Lists open LevelSessions,
 * lets the user switch the current level, toggle per-level visibility/lock/color,
 * rename, and close.
 *
 * Still deferred: no per-level Save/Duplicate in the context menu (Save currently only
 * makes sense for the current level, via File menu). Levels have no parallax concept —
 * unlike layers, see tmp/multi-level-support-plan.md section 3.4. Solo (Ctrl+click the
 * eye icon) mirrors LayersPanel.toggleLayerSolo; lock mirrors LayersPanel.toggleLayerLock
 * (blocks selection of the current level's objects, see ObjectOperations.computeSelectableSet)
 * but as a plain click, without LayersPanel's paint-drag mousedown/mouseover gesture.
 */
export class LevelsPanel extends BasePanel {
    constructor(container, stateManager, levelEditor) {
        super(container, stateManager, levelEditor);
        this.searchFilter = '';
        this.subscriptions = [];
        this._draggedLevelId = null; // Track dragged level's id for drag-reorder (Phase 6)

        // Icon "paint drag" (mirrors LayersPanel) — mousedown on the eye/lock icon + drag over
        // other levels' icons of the same type applies the same value before mouseup.
        this._iconPaintDrag = null; // { type: 'visibility'|'lock', value: boolean }
        this._draggableSuspendedRow = null; // .level-item temporarily set draggable=false during a paint drag

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

        // Don't render if the Levels tab isn't active
        const levelsContentPanel = document.getElementById('levels-content-panel');
        if (!levelsContentPanel || levelsContentPanel.classList.contains('hidden')) {
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
        // Effective visibility (not raw session.visible): another level being soloed
        // makes THIS level stop rendering without ever touching its own `visible` flag —
        // see LevelsManager.getVisibleSessions(), the single source of truth for this.
        const effectivelyVisible = this.levelEditor.levelsManager.getVisibleSessions().some(s => s.id === session.id);
        const objectsCount = session.level.getStats ? session.level.getStats().totalObjects : session.level.objects.length;
        // Approximation until Phase 5 wires per-session isDirty tracking: the current
        // tab reflects the live global dirty flag, background tabs show their last
        // known value (always false until a later phase updates it on switch-away).
        const isDirty = session.id === this.levelEditor.currentLevelId
            ? this.stateManager.get('isDirty')
            : session.isDirty;

        const levelDiv = createListItemRow('level', {
            id: session.id,
            isCurrent,
            effectivelyVisible,
            // Drag-reorder needs the full open-level list in view — with an active search
            // filter, #levels-list only contains a subset, so a drop would silently reorder
            // against a mismatched id set (LevelsManager.reorderLevels() no-ops on that).
            draggable: !this.searchFilter,
            name: { display: displayName, value: session.level.meta.name },
            objectsCount,
            visibility: {
                soloed: session.soloed,
                title: session.soloed ? 'Soloed — Ctrl+click to un-solo' : (session.visible ? 'Hide level (Ctrl+click to solo)' : 'Show level (Ctrl+click to solo)')
            },
            color: { value: session.color, title: 'Click to change color' },
            lock: { locked: session.locked, title: session.locked ? 'Unlock level' : 'Lock level' },
            dirtyIndicator: isDirty
        });

        HoverEffects.setupListItemHover(levelDiv);

        const colorElement = levelDiv.querySelector('.level-color');
        if (colorElement) {
            // No dedicated .level-color CSS class exists (unlike .layer-color, which reads
            // a --layer-color custom property set via setProperty) — set the fill directly.
            colorElement.style.backgroundColor = session.color;
            HoverEffects.setupColorHover(colorElement);
        }

        const visibilityBtn = levelDiv.querySelector('.level-visibility-btn');
        if (visibilityBtn) {
            visibilityBtn.classList.add('hover:bg-gray-600');
        }
        const lockBtn = levelDiv.querySelector('.level-lock-btn');
        if (lockBtn) {
            lockBtn.classList.add('hover:bg-gray-600');
        }

        return levelDiv;
    }

    /**
     * Update a level element's visual state without recreating it
     */
    updateLevelElement(levelId, session) {
        const levelElement = this.container.querySelector(`[data-level-id="${levelId}"].level-item`);
        if (!levelElement) return;

        // See createLevelElement's effectivelyVisible comment — solo elsewhere can hide
        // this level without touching its own `visible` flag.
        const effectivelyVisible = this.levelEditor.levelsManager.getVisibleSessions().some(s => s.id === levelId);
        const isCurrent = levelId === this.levelEditor.currentLevelId;

        updateListItemVisuals(levelElement, 'level', {
            effectivelyVisible,
            isCurrent,
            visibility: {
                soloed: session.soloed,
                title: session.soloed ? 'Soloed — Ctrl+click to un-solo' : (session.visible ? 'Hide level (Ctrl+click to solo)' : 'Show level (Ctrl+click to solo)')
            },
            lock: { locked: session.locked, title: session.locked ? 'Unlock level' : 'Lock level' }
        });

        const colorElement = levelElement.querySelector('.level-color');
        if (colorElement) {
            colorElement.style.backgroundColor = session.color;
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
     * Ctrl+click a level's eye icon: exclusive "solo" (mirrors LayersPanel.toggleLayerSolo).
     * @param {string} levelId
     */
    toggleLevelSolo(levelId) {
        this.levelEditor.levelsManager.toggleLevelSolo(levelId);

        // Solo affects every open level's effective visibility, not just the toggled
        // one — refresh all rows, not just this level's.
        this.levelEditor.levelSessions.forEach((session, id) => this.updateLevelElement(id, session));
    }

    /**
     * Toggle a level's lock (mirrors LayersPanel.toggleLayerLock, scoped to the whole level —
     * see ObjectOperations.computeSelectableSet/OutlinerPanel.canSelect for the actual gate).
     * Also the per-icon apply used by the lock paint-drag (see _paintLevelLock) — same as
     * toggleLevelVisibility doubling as the eye icon's paint-drag apply.
     * @param {string} levelId
     */
    toggleLevelLock(levelId) {
        this.levelEditor.levelsManager.toggleLevelLock(levelId);
        const session = this.levelEditor.levelSessions.get(levelId);
        if (session) {
            this.updateLevelElement(levelId, session);
        }
        // Lock changes what's selectable/how rows look in the Outliner too — refresh it.
        if (this.levelEditor.outlinerPanel) {
            this.levelEditor.outlinerPanel.render();
        }
    }

    /**
     * Show color picker for a level (mirrors LayersPanel.showColorPicker). `session.color`
     * is editor-only UI state, never serialized (see LevelSession doc comment) — no
     * markDirty(), same as toggling visible/soloed/locked.
     * @param {LevelSession} session
     * @param {Event} event
     */
    showLevelColorPicker(session, event) {
        const button = event.target.closest('.level-color');
        const buttonRect = button.getBoundingClientRect();

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = `level-color-input-${session.id}`;
        colorInput.name = `level-color-input-${session.id}`;
        colorInput.value = session.color;
        colorInput.style.position = 'fixed';
        colorInput.style.left = `${buttonRect.left}px`;
        colorInput.style.top = `${buttonRect.bottom + 5}px`;
        colorInput.style.width = '40px';
        colorInput.style.height = '40px';
        colorInput.style.border = '2px solid var(--ui-active-color, #3B82F6)';
        colorInput.style.borderRadius = '4px';
        colorInput.style.zIndex = '10000';
        colorInput.style.cursor = 'pointer';
        colorInput.style.opacity = '1';

        document.body.appendChild(colorInput);
        colorInput.focus();
        colorInput.click();

        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            }
        };
        const cleanup = () => {
            document.removeEventListener('keydown', escapeHandler);
            if (document.body.contains(colorInput)) {
                document.body.removeChild(colorInput);
            }
        };

        colorInput.addEventListener('change', (e) => {
            session.color = e.target.value;
            this.updateLevelElement(session.id, session);
            cleanup();
        });

        colorInput.addEventListener('blur', cleanup);
        document.addEventListener('keydown', escapeHandler);
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
                selector: '.level-item, .level-color, button, [data-level-id], .levels-list',
                handler: (e) => {
                    const target = e.target;

                    const colorIndicator = target.closest('.level-color');
                    if (colorIndicator) {
                        e.stopPropagation();
                        const levelId = colorIndicator.dataset.levelId;
                        const session = levelId ? this.levelEditor.levelSessions.get(levelId) : null;
                        if (session) {
                            this.showLevelColorPicker(session, e);
                        }
                        return;
                    }

                    const button = target.closest('button');
                    if (button) {
                        // level-visibility-btn / level-lock-btn are handled on mousedown
                        // (see handleLevelIconMouseDown) so a plain click and a paint-drag
                        // both go through one code path — nothing to do here.
                        if (button.classList.contains('level-visibility-btn') || button.classList.contains('level-lock-btn')) {
                            return;
                        }
                        return;
                    }

                    const levelElement = target.closest('.level-item');
                    if (levelElement) {
                        const levelId = levelElement.dataset.levelId;
                        if (levelId) {
                            const interactiveElement = target.closest('button, input, .level-color');
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
            },
            mousedown: {
                selector: '.level-visibility-btn, .level-lock-btn',
                handler: (e) => this.handleLevelIconMouseDown(e)
            },
            mouseover: {
                selector: '.level-visibility-btn, .level-lock-btn',
                handler: (e) => this.handleLevelIconMouseOver(e)
            }
        };

        eventHandlerManager.registerContainer(this.container, levelsHandlers);

        // mouseup can land anywhere on the page once dragging off the panel, so end the
        // paint drag globally rather than only within this container.
        eventHandlerManager.registerGlobalHandlers({
            mouseup: () => this._endIconPaintDrag()
        }, 'levelsPanel-iconPaintDrag');

        Logger.ui.debug('LevelsPanel: event handlers setup complete');
        this._eventHandlersRegistered = true;
    }

    /**
     * mousedown on a level's eye/lock icon (mirrors LayersPanel.handleLayerIconMouseDown).
     * Ctrl/Cmd on the eye icon is solo — a single-shot action, not paintable — so it doesn't
     * arm paint-drag mode.
     * @param {MouseEvent} e
     */
    handleLevelIconMouseDown(e) {
        const button = e.target.closest('.level-visibility-btn, .level-lock-btn');
        if (!button) return;
        const levelId = button.dataset.levelId;
        if (!levelId) return;
        // NOT button.closest('[data-level-id]') — every child in the row (color, name,
        // count, both buttons) carries its own data-level-id, so closest() on the button
        // matches the button itself, not the row. That silently no-oped the draggable-
        // suspend below (row draggable stayed true), which real mouse drags then hijacked
        // into native row-reorder instead of paint-drag — .level-item is unambiguous.
        const levelElement = button.closest('.level-item');
        if (!levelElement) return;
        const session = this.levelEditor.levelSessions.get(levelId);
        if (!session) return;

        if (button.classList.contains('level-visibility-btn')) {
            if (e.ctrlKey || e.metaKey) {
                this.toggleLevelSolo(levelId);
                return;
            }
            e.preventDefault();
            this._startIconPaintDrag('visibility', !session.visible, levelElement);
            this._paintLevelVisibility(levelId, this._iconPaintDrag.value);
        } else if (button.classList.contains('level-lock-btn')) {
            e.preventDefault();
            this._startIconPaintDrag('lock', !session.locked, levelElement);
            this._paintLevelLock(levelId, this._iconPaintDrag.value);
        }
    }

    /**
     * mouseover during an active paint drag: apply the armed target value to the icon of the
     * same type under the cursor. Icons already at that value are left alone (paint, not
     * re-toggle).
     * @param {MouseEvent} e
     */
    handleLevelIconMouseOver(e) {
        if (!this._iconPaintDrag) return;
        const button = e.target.closest('.level-visibility-btn, .level-lock-btn');
        if (!button) return;
        const levelId = button.dataset.levelId;
        if (!levelId) return;

        if (this._iconPaintDrag.type === 'visibility' && button.classList.contains('level-visibility-btn')) {
            this._paintLevelVisibility(levelId, this._iconPaintDrag.value);
        } else if (this._iconPaintDrag.type === 'lock' && button.classList.contains('level-lock-btn')) {
            this._paintLevelLock(levelId, this._iconPaintDrag.value);
        }
    }

    /**
     * @param {'visibility'|'lock'} type
     * @param {boolean} value - state to paint onto every icon of this type until mouseup
     * @param {HTMLElement} levelElement - the .level-item the drag started on
     */
    _startIconPaintDrag(type, value, levelElement) {
        this._iconPaintDrag = { type, value };
        // A nested mousedown+move inside a draggable .level-item would otherwise be hijacked
        // into an HTML5 row-reorder drag instead of painting — suspend it for just this row.
        if (levelElement.draggable) {
            this._draggableSuspendedRow = levelElement;
            levelElement.draggable = false;
        }
    }

    /**
     * @param {string} levelId
     * @param {boolean} targetValue
     */
    _paintLevelVisibility(levelId, targetValue) {
        const session = this.levelEditor.levelSessions.get(levelId);
        if (!session || session.visible === targetValue) return;
        this.toggleLevelVisibility(levelId);
    }

    /**
     * @param {string} levelId
     * @param {boolean} targetValue
     */
    _paintLevelLock(levelId, targetValue) {
        const session = this.levelEditor.levelSessions.get(levelId);
        if (!session || session.locked === targetValue) return;
        this.toggleLevelLock(levelId);
    }

    /**
     * mouseup (global): close out the paint drag and restore suspended dragging.
     */
    _endIconPaintDrag() {
        if (!this._iconPaintDrag) return;
        this._iconPaintDrag = null;
        if (this._draggableSuspendedRow) {
            this._draggableSuspendedRow.draggable = true;
            this._draggableSuspendedRow = null;
        }
    }

    /**
     * Cleanup and destroy panel
     */
    destroy() {
        eventHandlerManager.unregisterContainer(this.container);
        eventHandlerManager.unregisterGlobalHandlers('levelsPanel-iconPaintDrag');

        const topSection = this.panelElements?.topCustom;
        if (topSection) {
            eventHandlerManager.unregisterContainer(topSection);
        }

        this._eventHandlersRegistered = false;
        this._iconPaintDrag = null;
        this._draggableSuspendedRow = null;

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
