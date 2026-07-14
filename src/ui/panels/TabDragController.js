import { Logger } from '../../utils/Logger.js';
import { globalEventRegistry } from '../../event-system/GlobalEventRegistry.js';
import { PanelSubController } from './PanelSubController.js';

/**
 * Ordinary tab-bar drag-and-drop: reordering within a panel and moving a tab across
 * panels. Owns the instance-scoped dragging state (was window.tabDraggingState/
 * window.tabDraggingGlobalMouseUp/window._tabDraggingRegistered — encapsulated in
 * Фаза 2 of the refactor) and the temporary all-tabs container used during
 * initializeTabPositions. Split-pane-header dragging is a separate protocol — see
 * SplitPaneController.
 * Extracted from PanelPositionManager.js — Фаза 4.5.3 (tmp/2D_Editor_REFACTOR_PLAN.md).
 */
export class TabDragController extends PanelSubController {
    /**
     * Initialize global tab dragging handler (called once by the owning manager's
     * constructor)
     * @private
     */
    _initGlobalTabDraggingHandler() {
        // Check if already initialized to prevent duplicates
        if (this._tabDraggingInitialized) {
            return;
        }

        // Instance-owned dragging state (was window.tabDraggingState) — lives and dies with
        // this PanelPositionManager instance instead of leaking across a hypothetical
        // re-initialization of the editor.
        this._tabDraggingState = {
            draggedTab: null,
            draggedIndex: -1,
            draggedPanel: null
        };

        this._boundGlobalTabMouseUp = this._onGlobalTabMouseUp.bind(this);

        // globalEventRegistry.registerComponentHandlers already no-ops on a duplicate
        // 'panel-tab-dragging'/'document' registration (see GlobalEventRegistry.js), so no
        // extra window-level "already registered" guard is needed here.
        globalEventRegistry.registerComponentHandlers('panel-tab-dragging', {
            mouseup: this._boundGlobalTabMouseUp
        }, 'document');

        // Mark as initialized
        this._tabDraggingInitialized = true;
    }

    /**
     * Global mouseup cleanup for tab dragging (was window.tabDraggingGlobalMouseUp).
     * Only handles releases OUTSIDE a panel's tab strip — a release inside a tab strip is
     * finalized by the panel-level mouseup handler set up in setupTabDraggingForPanel.
     * @private
     */
    _onGlobalTabMouseUp(e) {
        if (this._tabDraggingState && this._tabDraggingState.draggedTab) {
            const releaseInTabStrip = !!e.target?.closest('.flex.border-b.border-gray-700');
            if (releaseInTabStrip) {
                return;
            }

            this._tabDraggingState.draggedTab.classList.remove('dragging');
            document.querySelectorAll('.tab-right, .tab-left').forEach(t => t.classList.remove('tab-drag-over'));

            this._tabDraggingState.draggedTab = null;
            this._tabDraggingState.draggedIndex = -1;
            this._tabDraggingState.draggedPanel = null;
        }
    }

    /**
     * Create temporary container with all tabs and content
     */
    createTemporaryTabContainer() {
        const tempContainer = document.createElement('div');
        tempContainer.id = 'temp-tabs-panel';
        tempContainer.style.display = 'none';

        // Create tabs container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'flex border-b border-gray-700 flex-shrink-0 overflow-hidden';

        // Create content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'flex-grow overflow-y-auto';

        // Create default tabs
        const defaultTabs = [
            { name: 'details', text: 'Details', active: true },
            { name: 'levels', text: 'Levels', active: false },
            { name: 'layers', text: 'Layers', active: false },
            { name: 'outliner', text: 'Outliner', active: false }
        ];

        defaultTabs.forEach(tab => {
            const tabButton = document.createElement('button');
            tabButton.setAttribute('data-tab', tab.name);
            tabButton.className = `tab-right ${tab.active ? 'active' : ''}`;
            tabButton.textContent = tab.text;
            tabsContainer.appendChild(tabButton);
        });

        // Move existing content panels to temporary container
        const contentPanels = [
            'details-content-panel',
            'levels-content-panel',
            'layers-content-panel',
            'outliner-content-panel'
        ];

        contentPanels.forEach(panelId => {
            const contentPanel = document.getElementById(panelId);
            if (contentPanel) {
                // Remove from current parent and add to content container
                if (contentPanel.parentNode && contentPanel.parentNode.contains(contentPanel)) {
                    contentPanel.parentNode.removeChild(contentPanel);
                }
                contentContainer.appendChild(contentPanel);
            }
        });

        tempContainer.appendChild(tabsContainer);
        tempContainer.appendChild(contentContainer);

        // Add to DOM (hidden)
        document.body.appendChild(tempContainer);

        Logger.ui.debug('Created temporary tab container with content panels');
    }

    /**
     * Remove temporary container
     */
    removeTemporaryTabContainer() {
        const tempContainer = document.getElementById('temp-tabs-panel');
        if (tempContainer) {
            tempContainer.remove();
            Logger.ui.debug('Removed temporary tab container');
        }
    }

    /**
     * Setup tab dragging functionality for a panel
     * @param {HTMLElement} panel - Panel element
     */
    setupTabDraggingForPanel(panel) {
        const tabContainer = panel.querySelector('.flex.border-b.border-gray-700');
        if (!tabContainer || tabContainer._draggingSetup) return;

        const draggingState = this._tabDraggingState;
        const tabSelector = '.tab-right[data-tab], .tab-left[data-tab], .tab[data-tab]';

        tabContainer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // A split-pane detach drag (separate protocol, see _startSplitPaneDetachDrag)
            // may already be in flight — don't start a second, overlapping drag.
            if (this.manager.splitPaneController._splitDetachDragActive) return;
            const tab = e.target.closest(tabSelector);
            if (!tab) return;

            const idx = Array.from(tabContainer.children).indexOf(tab);

            // Mirror into global state (for legacy global handler compatibility)
            draggingState.draggedTab = tab;
            draggingState.draggedIndex = idx;
            draggingState.draggedPanel = panel;
            draggingState.sourceContainer = tabContainer;

            // Also keep our own copy — the legacy global mouseup handler fires first
            // and clears draggingState before ours runs, so we need a local reference.
            this._pendingDrag = { tab, index: idx, sourceContainer: tabContainer };

            tab.classList.add('dragging');
            e.preventDefault();

            this._installGlobalTabDragHandlers(e.clientX, e.clientY);
        });

        tabContainer.addEventListener('selectstart', (e) => {
            if (this._pendingDrag) e.preventDefault();
        });

        tabContainer._draggingSetup = true;
        Logger.ui.debug(`Setup tab dragging for panel ${panel.id}`);
    }

    _installGlobalTabDragHandlers(startClientX, startClientY) {
        if (this._globalTabDragInstalled) return;
        this._globalTabDragInstalled = true;

        const tabSelector = '.tab-right[data-tab], .tab-left[data-tab], .tab[data-tab]';

        // ── Ghost element — clone of the real tab so it looks identical ──
        const ghost = this._pendingDrag.tab.cloneNode(true);
        ghost.classList.remove('active', 'dragging', 'tab-drag-over');
        ghost.classList.add('tab-drag-ghost');
        ghost.style.cssText = ''; // strip any inline overrides from the original
        document.body.appendChild(ghost);
        this._dragGhost = ghost;

        // Position it under the cursor immediately (same offset the mousemove handler below
        // uses) — otherwise, since .style.left/top are only ever set from a mousemove event,
        // the ghost would sit at its unpositioned default (effectively the viewport's
        // top-left corner) for as long as the user holds the mouse down without moving it.
        ghost.style.left = (startClientX + 14) + 'px';
        ghost.style.top  = (startClientY - 12) + 'px';

        // ── Opposite panel is shown lazily, only once the cursor actually leaves ──
        // the source panel's bounds (see _globalTabMouseMove below). A drag that
        // never leaves the source panel is just a same-panel tab reorder, so it
        // shouldn't auto-create/activate the other panel.
        const srcPanel = this._pendingDrag.sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');
        const srcSide  = srcPanel?.id.includes('left') ? 'left' : 'right';
        this._dragOtherSide = srcSide === 'left' ? 'right' : 'left';
        this._dragCreatedPanel = null;
        this._pendingSplitTarget = null;

        // Panel ids are unique, so matching via closest('#left-tabs-panel, #right-tabs-panel')
        // is unambiguous on its own — no need to pre-scope by tab-bar CSS classes.
        // Importantly, this treats the WHOLE panel (not just its header strip) as the drop
        // target: a freshly-created empty panel has a zero-height tab bar (no children yet),
        // so requiring the cursor to be exactly over that sliver made cross-panel drops
        // to a new panel practically unhittable.
        const clearAllDragVisuals = () => {
            document.querySelectorAll(tabSelector).forEach(t => t.classList.remove('tab-drag-over'));
            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
        };

        this._clearAllDragVisuals = clearAllDragVisuals;

        this._globalTabMouseMove = (e) => {
            if (!this._pendingDrag) return;

            ghost.style.left = (e.clientX + 14) + 'px';
            ghost.style.top  = (e.clientY - 12) + 'px';

            clearAllDragVisuals();
            this._pendingSplitTarget = null;
            this.manager.splitPaneController._hideSplitHint();

            const sourceContainer = this._pendingDrag.sourceContainer;
            const sourcePanel = sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');

            // Lazily show the opposite panel only once the cursor actually leaves the
            // source panel's bounds — a same-panel reorder shouldn't activate it. If the
            // ghost tab comes back home, undo the auto-created panel right away instead
            // of waiting for mouseup.
            if (sourcePanel) {
                const rect = sourcePanel.getBoundingClientRect();
                const insideSource = e.clientX >= rect.left && e.clientX <= rect.right &&
                                      e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!insideSource && !this._dragCreatedPanel &&
                    !document.getElementById(`${this._dragOtherSide}-tabs-panel`)) {
                    this.levelEditor.eventHandlers?.togglePanel(`${this._dragOtherSide}Panel`);
                    this._dragCreatedPanel = this._dragOtherSide;
                } else if (insideSource && this._dragCreatedPanel) {
                    this.manager.splitPaneController.removeEmptyPanel(this._dragCreatedPanel);
                    this._dragCreatedPanel = null;
                }
            }

            this._pendingDrag.tab.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            this._pendingDrag.tab.style.pointerEvents = '';

            if (!elUnder) return;

            // Dropping onto another tab's CONTENT area (not its tab strip) nests the
            // dragged tab as a split section instead of moving/reordering the tab bar entry.
            // v1: a composite (already-split) tab can't itself be dragged into a new split —
            // it keeps moving as a whole via the normal cross-panel/reorder path.
            const splitTarget = this._pendingDrag.tab.dataset.tabGroup
                ? null
                : this.manager.splitPaneController._findSplitDropTarget(elUnder, e.clientY, this._pendingDrag.tab.dataset.tab);
            if (splitTarget) {
                this._pendingSplitTarget = splitTarget;
                this.manager.splitPaneController._showSplitHint(splitTarget.rect, splitTarget.position);
                return;
            }

            const targetPanel = elUnder.closest('#left-tabs-panel, #right-tabs-panel');
            if (!targetPanel) return;

            if (targetPanel !== sourcePanel) {
                // Cursor is anywhere over the OTHER panel — highlight it as the drop target
                targetPanel.classList.add('tab-panel--drag-over');
            } else {
                // Same panel — show insertion hint on the sibling tab
                const targetTab = elUnder.closest(tabSelector);
                if (targetTab && targetTab !== this._pendingDrag.tab &&
                    sourceContainer.contains(targetTab)) {
                    targetTab.classList.add('tab-drag-over');
                }
            }
        };

        this._globalTabMouseUp = (e) => {
            // NOTE: _onGlobalTabMouseUp (registered in constructor) fires BEFORE this handler
            // and clears draggingState — so we use this._pendingDrag exclusively.
            const pending = this._pendingDrag;
            if (!pending) { this._cleanupTabDrag(); return; }

            const { tab: draggedTab, sourceContainer, index: draggedIndex } = pending;

            draggedTab.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            draggedTab.style.pointerEvents = '';

            try {
                if (this._pendingSplitTarget) {
                    // ── Dropped onto another tab's content area ──
                    const target = this._pendingSplitTarget;
                    const tabName = draggedTab.dataset.tab;
                    if (tabName) {
                        if (target.mode === 'replace') {
                            // Onto a pane of an EXISTING composite — replace that pane's occupant
                            if (tabName !== target.evictedTabName) {
                                this.manager.splitPaneController.replacePaneInSplit(tabName, target.evictedTabName, target.panelSide);
                            }
                        } else if (tabName !== target.targetTabName) {
                            // Onto a plain tab's content — nest both as a new split section
                            this.manager.splitPaneController.mergeTabIntoSplit(tabName, target.targetTabName, target.panelSide, target.position);
                        }
                    }
                } else if (elUnder) {
                    const srcPanel = sourceContainer.closest('#left-tabs-panel, #right-tabs-panel');
                    const tgtPanel = elUnder.closest('#left-tabs-panel, #right-tabs-panel');

                    if (tgtPanel && tgtPanel !== srcPanel) {
                        // ── Cross-panel move — dropped anywhere over the other panel ──
                        const tabName = draggedTab.dataset.tab;
                        if (tabName && srcPanel) {
                            const fromPanel = srcPanel.id.includes('left') ? 'left' : 'right';
                            const toPanel   = tgtPanel.id.includes('left') ? 'left' : 'right';
                            this.manager.tabOrderController.moveTab(tabName, fromPanel, toPanel);
                        }
                    } else if (tgtPanel && tgtPanel === srcPanel) {
                        // ── Same-panel reorder ──
                        const targetTab = elUnder.closest(tabSelector);
                        if (targetTab && targetTab !== draggedTab && sourceContainer.contains(targetTab)) {
                            const targetIndex = Array.from(sourceContainer.children).indexOf(targetTab);
                            if (targetIndex > draggedIndex) {
                                sourceContainer.insertBefore(draggedTab, targetTab.nextSibling);
                            } else {
                                sourceContainer.insertBefore(draggedTab, targetTab);
                            }
                            Logger.ui.debug(`Reordered tab ${draggedTab.dataset.tab} to position ${targetIndex}`);

                            const srcSide = srcPanel.id.includes('left') ? 'left' : 'right';
                            this.manager.tabOrderController.savePanelTabOrder(srcSide);
                        }
                    }
                }
            } finally {
                // However the commit branch above resolves (including if it throws), the drag
                // must always be torn down — otherwise the ghost keeps following the cursor
                // forever and _globalTabDragInstalled stays stuck true, silently no-opping every
                // subsequent drag's handler installation (see _installGlobalTabDragHandlers guard).
                this._cleanupTabDrag();
            }
        };

        // Safety net: if the window loses focus mid-drag (Alt-Tab, a native dialog stealing
        // the mouseup, etc.) no 'mouseup' may ever reach document — cancel the drag instead of
        // leaving _pendingDrag stuck truthy forever, which would also permanently block the
        // split-pane detach drag (mutually exclusive via the _pendingDrag/_splitDetachDragActive
        // guards in setupTabDraggingForPanel / _setupSplitPaneHeaderDragging).
        this._globalTabWindowBlur = () => this._cleanupTabDrag();

        document.addEventListener('mousemove', this._globalTabMouseMove);
        document.addEventListener('mouseup',   this._globalTabMouseUp);
        window.addEventListener('blur', this._globalTabWindowBlur);
    }

    _cleanupTabDrag() {
        const pending = this._pendingDrag;
        if (pending?.tab) {
            pending.tab.classList.remove('dragging');
            pending.tab.style.pointerEvents = '';
        }
        if (this._clearAllDragVisuals) {
            this._clearAllDragVisuals();
            this._clearAllDragVisuals = null;
        }
        if (this._dragGhost) {
            this._dragGhost.remove();
            this._dragGhost = null;
        }
        this.manager.splitPaneController._removeSplitHint();
        this._pendingSplitTarget = null;
        // If we auto-showed the opposite panel for this drag and the tab never landed there,
        // remove it again so we don't leave an empty panel behind.
        if (this._dragCreatedPanel) {
            this.manager.splitPaneController.removeEmptyPanel(this._dragCreatedPanel);
            this._dragCreatedPanel = null;
        }
        this._pendingDrag = null;
        this._removeGlobalTabDragHandlers();
    }

    _removeGlobalTabDragHandlers() {
        if (this._globalTabMouseMove) {
            document.removeEventListener('mousemove', this._globalTabMouseMove);
            this._globalTabMouseMove = null;
        }
        if (this._globalTabMouseUp) {
            document.removeEventListener('mouseup', this._globalTabMouseUp);
            this._globalTabMouseUp = null;
        }
        if (this._globalTabWindowBlur) {
            window.removeEventListener('blur', this._globalTabWindowBlur);
            this._globalTabWindowBlur = null;
        }
        this._globalTabDragInstalled = false;
    }

    /**
     * Cleanup resources — unregister the global tab-dragging listener registered in
     * _initGlobalTabDraggingHandler.
     */
    destroy() {
        if (this._tabDraggingInitialized) {
            globalEventRegistry.unregisterComponentHandlers('panel-tab-dragging', 'document');
            this._tabDraggingInitialized = false;
        }
    }
}
