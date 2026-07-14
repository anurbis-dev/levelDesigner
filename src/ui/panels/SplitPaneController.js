import { Logger } from '../../utils/Logger.js';
import { SearchSectionUtils } from '../../utils/SearchSectionUtils.js';
import { eventHandlerManager } from '../../event-system/EventHandlerManager.js';
import { PanelSubController } from './PanelSubController.js';

/**
 * Blender-style split-pane / drag-detach window manager: nested split sections created
 * by dropping a dragged tab onto another tab's content area, pane resizing, detaching a
 * pane back into a standalone tab, and the generic panel-existence bookkeeping
 * (removeEmptyPanel/updatePanelStateAfter*) that these operations lean on most heavily.
 * Extracted from PanelPositionManager.js — Фаза 4.5.4 (tmp/2D_Editor_REFACTOR_PLAN.md).
 *
 * ────────────────────────────────────────────────────────────────
 * Nested split sections — dropping a dragged tab onto another tab's
 * CONTENT area (not its tab strip) nests it as a split section instead
 * of moving/reordering the tab bar entry. Dropping onto one pane of an
 * EXISTING composite instead REPLACES that pane's occupant (replacePaneInSplit).
 * What happens to the evicted occupant depends on where the dragged tab came from:
 *   - dragged tab was a plain standalone tab → evicted tab is re-homed as a new
 *     standalone tab in the DRAGGED tab's own source panel (same panel if the drag was
 *     same-panel, the other panel if cross-panel), filling the exact slot it vacated.
 *   - dragged tab was ITSELF nested in a different composite → true pane-for-pane swap
 *     (_swapNestedPanes): the evicted tab takes the dragged tab's old slot in THAT
 *     composite instead, so both composites stay composites and just trade one member.
 * Detaching a pane's header pulls it back out into a standalone tab (detachFromSplit).
 * Two independent drag protocols feed into this same merge/replace/detach
 * logic: the ordinary tab-bar drag (source: a real standalone button, see
 * TabDragController) and the split-pane-header drag (source: a tab already nested in
 * another composite). _extractDraggedTab()/_collapseSplitPane() abstract over where
 * the dragged tab currently lives for the merge and standalone-source-replace
 * paths; replacePaneInSplit checks nesting itself up front so it can route a
 * nested dragged tab to the true-swap path instead.
 * Single level of nesting only. Composite membership (which tab is merged into which,
 * top/bottom position, and the resizer's pane-size ratio) IS persisted per panel side via
 * savePanelSplits/applyPanelSplits (stateManager keys leftPanelSplits/rightPanelSplits,
 * mirrored to userPrefs) — a page reload rebuilds the same composites by replaying
 * mergeTabIntoSplit with the saved ratio. A split that was never manually resized has no
 * saved ratio and restores at the CSS default even 50/50 split (see _setupSplitResizer).
 * ────────────────────────────────────────────────────────────────
 */
export class SplitPaneController extends PanelSubController {
    /**
     * Persist the current nested split-tab composites (see mergeTabIntoSplit) for a panel to
     * stateManager/userPrefs. Reads live DOM state rather than tracking it incrementally, so it
     * stays correct no matter which of merge/replace/detach mutated the composite last.
     * @param {string} panelSide - 'left' or 'right' (anything else, e.g. 'temp', is ignored)
     */
    savePanelSplits(panelSide) {
        if (this._initializing) return;
        if (panelSide !== 'left' && panelSide !== 'right') return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        const contentContainer = panel?.querySelector('.flex-grow.overflow-y-auto');
        if (!contentContainer) return;

        const splits = Array.from(contentContainer.children)
            .filter(child => child.classList.contains('tab-split-container'))
            .map(wrapper => {
                const target = wrapper.dataset.panelTabName;
                const paneEls = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane'));
                const paneTabNames = paneEls.map(pane => pane.querySelector('[data-panel-tab-content="true"]')?.dataset.panelTabName);
                const dragged = paneTabNames.find(name => name && name !== target);
                if (!target || !dragged) return null;
                // Mirrors mergeTabIntoSplit's own convention: position is where the NON-anchor
                // ("dragged") pane sits, so applyPanelSplits can hand this straight back to it.
                const position = paneTabNames[0] === dragged ? 'top' : 'bottom';
                // Top pane's size, set by _setupSplitResizer as the user drags — absent until
                // the user has actually resized this split at least once (default 50/50).
                const rawRatio = paneEls[0]?.dataset.splitRatio;
                const ratio = rawRatio !== undefined ? parseFloat(rawRatio) : null;
                return { target, dragged, position, ratio };
            })
            .filter(Boolean);

        const stateKey = panelSide === 'left' ? 'leftPanelSplits' : 'rightPanelSplits';
        this.stateManager.set(stateKey, splits);
        if (this.userPrefs) {
            this.userPrefs.set(stateKey, splits);
        }
    }

    /**
     * Recreate previously saved split-tab composites for a panel (called during
     * initializeTabPositions, after tab order/position are restored so both members of each
     * saved pair already exist as standalone tabs somewhere to merge). Reuses mergeTabIntoSplit
     * itself rather than rebuilding the DOM structure separately, so restore and live
     * drag-to-merge can never drift apart.
     * @param {string} panelSide - 'left' or 'right'
     */
    applyPanelSplits(panelSide) {
        const stateKey = panelSide === 'left' ? 'leftPanelSplits' : 'rightPanelSplits';
        const savedSplits = this.userPrefs?.get(stateKey);
        if (!Array.isArray(savedSplits) || savedSplits.length === 0) return;

        savedSplits.forEach(({ target, dragged, position, ratio }) => {
            if (target && dragged && position) {
                this.mergeTabIntoSplit(dragged, target, panelSide, position, ratio);
            }
        });

        this.stateManager.set(stateKey, savedSplits);
    }

    /**
     * Detect whether the cursor is over another tab's CONTENT area, meaning the drop
     * should nest the dragged tab as a split section (or replace a pane of an existing
     * split) rather than move/reorder the tab. Shared by both drag protocols — the
     * ordinary tab-bar drag and the split-pane-header detach drag — so the dragged tab's
     * identity is passed in explicitly rather than read from `this._pendingDrag`, which
     * only the tab-bar protocol ever populates.
     * @param {HTMLElement} elUnder - Element under the cursor
     * @param {number} clientY - Cursor Y position (used to pick top/bottom half)
     * @param {string} draggedTabName - Tab being dragged (never a composite — callers
     *   guard that separately, since only the tab-bar drag can even pick one up)
     * @returns {{mode:'merge', targetTabName:string, panelSide:string, position:string, rect:DOMRect}|
     *           {mode:'replace', evictedTabName:string, panelSide:string, position:'replace', rect:DOMRect}|null}
     */
    _findSplitDropTarget(elUnder, clientY, draggedTabName) {
        const contentContainer = elUnder.closest('.flex-grow.overflow-y-auto');
        if (!contentContainer) return null;

        // Only the panel's currently-visible DIRECT child counts — a plain descendant query
        // would also match a *hidden* sibling split container elsewhere in the same panel
        // and wrongly block merging into the actually-active plain tab.
        const activeContent = Array.from(contentContainer.children).find(
            child => child.dataset?.panelTabContent === 'true' && !child.classList.contains('hidden')
        );
        if (!activeContent) return null;

        const targetPanel = contentContainer.closest('#left-tabs-panel, #right-tabs-panel');
        if (!targetPanel) return null;
        const panelSide = targetPanel.id.includes('left') ? 'left' : 'right';

        if (activeContent.classList.contains('tab-split-container')) {
            // Already a composite — the drop zone is whichever pane the cursor is over,
            // and the drop REPLACES that pane's occupant instead of adding a third nesting
            // level (v1 stays single-level).
            // If the dragged tab is itself currently nested (split-pane-header drag), its
            // OWN host composite can't be its own replace target — collapsing it as part of
            // committing the drop while also reading its pane as the target is ill-defined.
            const draggedContentEl = document.getElementById(`${draggedTabName}-content-panel`);
            if (draggedContentEl?.closest('.tab-split-container') === activeContent) return null;

            const pane = elUnder.closest('.tab-split-pane');
            if (!pane || !activeContent.contains(pane)) return null;
            const paneContent = pane.querySelector('[data-panel-tab-content="true"]');
            const evictedTabName = paneContent?.dataset.panelTabName;
            if (!evictedTabName || evictedTabName === draggedTabName) return null;
            return { mode: 'replace', evictedTabName, panelSide, position: 'replace', rect: pane.getBoundingClientRect() };
        }

        const targetTabName = activeContent.dataset.panelTabName;
        if (!targetTabName || targetTabName === draggedTabName) return null;

        // Use the panel's scrollable wrapper rect, not activeContent's own — plain (non-outliner)
        // tab content panels size to their intrinsic content height (no height:100%), so their
        // own rect can be far shorter than the panel body and the hint would highlight only
        // that partial area instead of the whole panel.
        const rect = contentContainer.getBoundingClientRect();
        const position = (clientY - rect.top) < rect.height / 2 ? 'top' : 'bottom';
        return { mode: 'merge', targetTabName, panelSide, position, rect };
    }

    _showSplitHint(rect, position) {
        if (!this._splitHintEl) {
            this._splitHintEl = document.createElement('div');
            this._splitHintEl.className = 'tab-split-drop-hint';
            document.body.appendChild(this._splitHintEl);
        }
        this._splitHintEl.style.left = rect.left + 'px';
        this._splitHintEl.style.width = rect.width + 'px';
        if (position === 'replace') {
            // Replacing an existing pane in place — the whole pane IS the drop zone.
            this._splitHintEl.style.top = rect.top + 'px';
            this._splitHintEl.style.height = rect.height + 'px';
        } else {
            const half = rect.height / 2;
            this._splitHintEl.style.top = (position === 'top' ? rect.top : rect.top + half) + 'px';
            this._splitHintEl.style.height = half + 'px';
        }
        this._splitHintEl.style.display = 'block';
    }

    _hideSplitHint() {
        if (this._splitHintEl) {
            this._splitHintEl.style.display = 'none';
        }
    }

    _removeSplitHint() {
        if (this._splitHintEl) {
            this._splitHintEl.remove();
            this._splitHintEl = null;
        }
    }

    /**
     * Resolve a tab's current location and detach it from there, regardless of whether it's
     * currently a standalone tab-bar button or nested inside an existing composite (dragged via
     * its pane header). Shared by mergeTabIntoSplit/replacePaneInSplit so both commit paths work
     * the same whether the drag originated from the ordinary tab-bar protocol or the split-pane-
     * header detach protocol.
     * @param {string} draggedTabName
     * @returns {{content:HTMLElement, title:string, sourcePanel:HTMLElement, sourceSide:string}|null}
     */
    _extractDraggedTab(draggedTabName) {
        // Check nesting FIRST via the content element's actual DOM position, not via a
        // data-tab button lookup: a composite's tab-bar button keeps using one of its two
        // nested tab names as its own `data-tab` (whichever was the original merge target/
        // anchor, or whichever pane survived a later replacePaneInSplit reassignment). When
        // draggedTabName is currently nested but happens to equal that anchor name, the
        // button lookup below would match the COMPOSITE's own button instead of finding no
        // standalone button at all — its `tabGroup` guard would then bail out entirely
        // instead of falling through to the nested-pane path below, silently no-oping the
        // drag for exactly that one pane (reproducible: build two composites, one on each
        // panel, then pane-header-drag the pane whose name equals its own composite's
        // current anchor onto the other composite — nothing happens, no error either).
        const nestedContent = document.getElementById(`${draggedTabName}-content-panel`);
        if (nestedContent?.closest('.tab-split-pane')) {
            // Nested inside an existing composite. Collapse its host composite first; the
            // sibling pane becomes a plain standalone tab in its place.
            const collapsed = this._collapseSplitPane(draggedTabName);
            if (!collapsed) return null;
            return { content: collapsed.content, title: collapsed.title, sourcePanel: collapsed.hostPanel, sourceSide: collapsed.hostSide };
        }

        const draggedTabButton = document.querySelector(`.tab-right[data-tab="${draggedTabName}"], .tab-left[data-tab="${draggedTabName}"]`);
        if (!draggedTabButton) return null;
        // v1: composites can't be a merge/replace source (guarded earlier in
        // _findSplitDropTarget too, but DOM state could in principle change by mouseup)
        if (draggedTabButton.dataset.tabGroup) return null;
        const content = document.getElementById(`${draggedTabName}-content-panel`);
        if (!content) return null;
        const sourcePanel = draggedTabButton.closest('#left-tabs-panel, #right-tabs-panel');
        const sourceSide = sourcePanel?.id.includes('left') ? 'left' : 'right';
        const title = draggedTabButton.textContent;
        // The dragged tab's own tab-bar button is gone — it's nested now, not standalone
        draggedTabButton.remove();
        return { content, title, sourcePanel, sourceSide };
    }

    /**
     * Pull ONE nested tab's content out of its host composite, leaving the OTHER pane as a
     * plain standalone tab in the composite's panel. Does NOT re-home the pulled-out content
     * anywhere — that's the caller's job (detachFromSplit re-homes it as a new standalone tab;
     * mergeTabIntoSplit/replacePaneInSplit, via _extractDraggedTab, feed it into a split
     * elsewhere instead).
     * @param {string} tabName - tab currently nested in a split, to pull out
     * @returns {{content:HTMLElement, title:string, hostPanel:HTMLElement, hostSide:string}|null}
     */
    _collapseSplitPane(tabName) {
        const content = document.getElementById(`${tabName}-content-panel`);
        const pane = content?.closest('.tab-split-pane');
        const wrapper = pane?.closest('.tab-split-container');
        if (!content || !pane || !wrapper) return null;

        const wrapperTabName = wrapper.dataset.panelTabName;
        const hostPanel = wrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const hostSide = hostPanel?.id.includes('left') ? 'left' : 'right';
        const compositeTabButton = hostPanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${wrapperTabName}"]`
        );

        const otherPane = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== pane);
        const otherContent = otherPane?.querySelector('[data-panel-tab-content="true"]');
        const otherTabName = otherContent?.dataset.panelTabName;
        // By construction (mergeTabIntoSplit always creates exactly 2 panes) this should
        // always resolve — but if it doesn't, abort before mutating anything rather than
        // proceeding into wrapper.remove() and silently discarding the other pane's content.
        if (!otherContent || !otherTabName) {
            Logger.ui.warn(`_collapseSplitPane: could not resolve the other pane for ${tabName} — aborting`);
            return null;
        }
        const otherTitle = otherPane?.querySelector('.tab-split-pane-header')?.textContent || otherTabName;
        const title = pane.querySelector('.tab-split-pane-header')?.textContent || tabName;

        const wrapperParent = wrapper.parentElement;

        // Unwrap: restore the remaining pane to a plain content panel, drop the wrapper
        wrapperParent.insertBefore(otherContent, wrapper);
        otherContent.classList.remove('hidden');
        otherContent.style.display = '';

        if (compositeTabButton) {
            // The remaining tab may be the ORIGINAL target (identity unchanged) or the
            // tab that was merged in (identity must switch to it) — always resync.
            compositeTabButton.dataset.tab = otherTabName;
            compositeTabButton.textContent = otherTitle;
            delete compositeTabButton.dataset.originalLabel;
            delete compositeTabButton.dataset.tabGroup;
        }

        wrapper.remove();

        // Skip during init-time restore (applyPanelSplits): activation is left for EventHandlers
        // to resolve after initialization finishes, same as updateActiveTabAfterMove does.
        if (!this._initializing && this.levelEditor?.eventHandlers && hostPanel) {
            this.levelEditor.eventHandlers.setActivePanelTab(otherTabName, hostSide);
        }

        this.savePanelSplits(hostSide);

        return { content, title, hostPanel, hostSide };
    }

    /**
     * Merge a dragged tab into another tab's content area as a nested split section.
     * The target tab's button becomes a composite ("Outliner/Layers"); both content
     * panels stay visible together, stacked top/bottom, independently resizable.
     * @param {string} draggedTabName
     * @param {string} targetTabName
     * @param {string} panelSide - Panel the target tab lives in ('left' or 'right')
     * @param {string} position - 'top' or 'bottom' — where the dragged tab's pane goes
     * @param {number|null} [ratio] - Top pane's size as a 0-100 percentage, from a previously
     *   saved split (see savePanelSplits/applyPanelSplits). Omitted/null for a live drag-merge,
     *   which always starts at an even 50/50 split.
     */
    mergeTabIntoSplit(draggedTabName, targetTabName, panelSide, position, ratio = null) {
        const targetContent = document.getElementById(`${targetTabName}-content-panel`);
        const targetPanel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!targetContent || !targetPanel) return;

        const targetTabButton = targetPanel.querySelector(`.flex.border-b.border-gray-700 [data-tab="${targetTabName}"]`);
        if (!targetTabButton) return;
        // Re-verify the target isn't already split — _findSplitDropTarget checked this at the
        // last mousemove, but DOM state could in principle have changed by mouseup; committing
        // a merge into an already-split target would corrupt the single-nesting invariant.
        if (targetContent.closest('.tab-split-container')) return;

        // Capture the target's title BEFORE any mutation
        const targetTitle = targetTabButton.dataset.originalLabel || targetTabButton.textContent;

        // Resolves + detaches the dragged tab from wherever it currently lives — a standalone
        // tab-bar button, or (split-pane-header drag) nested inside another composite.
        const dragged = this._extractDraggedTab(draggedTabName);
        if (!dragged) return;
        const { content: draggedContent, title: draggedTitle, sourcePanel, sourceSide } = dragged;

        const contentContainer = targetContent.parentElement;
        // Anchor the insertion point with a placeholder rather than targetContent.nextSibling:
        // if draggedContent is target's immediate DOM sibling (same-panel merge), nextSibling
        // WOULD be draggedContent itself, which _createSplitPane below reparents away before
        // insertBefore runs — inserting relative to a now-detached node throws NotFoundError.
        const placeholder = document.createComment('split-target-anchor');
        contentContainer.insertBefore(placeholder, targetContent);

        const wrapper = document.createElement('div');
        wrapper.className = 'tab-split-container';
        wrapper.dataset.panelTabContent = 'true';
        wrapper.dataset.panelTabName = targetTabName;

        const targetPane = this._createSplitPane(targetTitle, targetContent);
        const draggedPane = this._createSplitPane(draggedTitle, draggedContent);
        const resizer = document.createElement('div');
        resizer.className = 'tab-split-resizer';

        const [firstPane, secondPane] = position === 'top' ? [draggedPane, targetPane] : [targetPane, draggedPane];
        wrapper.appendChild(firstPane);
        wrapper.appendChild(resizer);
        wrapper.appendChild(secondPane);

        contentContainer.insertBefore(wrapper, placeholder);
        placeholder.remove();
        this._setupSplitResizer(resizer, firstPane);
        if (typeof ratio === 'number' && !Number.isNaN(ratio)) {
            firstPane.style.flex = `0 0 ${ratio}%`;
            firstPane.dataset.splitRatio = String(ratio);
        }

        // Both panes are visible together now
        [targetContent, draggedContent].forEach(el => {
            el.classList.remove('hidden');
            el.style.display = '';
        });

        targetTabButton.dataset.originalLabel = targetTitle;
        targetTabButton.dataset.tabGroup = `${targetTabName},${draggedTabName}`;
        targetTabButton.textContent = `${targetTitle}/${draggedTitle}`;

        // Both nested tabs' search controls need an explicit refresh: setActivePanelTab only
        // ever passes a single tabName through to SearchSectionUtils, so the pane that wasn't
        // "the" active tab this session may never have had its search controls rendered yet.
        SearchSectionUtils.showSearchSectionForTab(targetTabName, this.levelEditor);
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);

        // Clean up the source panel: remove it if now empty, or re-activate a remaining tab
        // if the dragged tab was the active one there.
        this.removeEmptyPanel(sourceSide);
        this._reactivateAfterTabRemoval(sourceSide);

        // The dragged tab now lives inside panelSide's composite — keep tabPositions in sync
        // so a reload's stale-position reconstruction (initializeTabPositions) doesn't fight
        // the leftPanelSplits/rightPanelSplits restore that runs right after it.
        this.manager.tabOrderController._syncTabPosition(draggedTabName, panelSide);

        this.savePanelSplits(panelSide);

        Logger.ui.info(`Merged tab ${draggedTabName} into ${targetTabName} split (${position}, ${panelSide} panel)`);
    }

    /**
     * Replace one pane's occupant inside an EXISTING split composite with a dragged tab.
     * The composite stays a composite (still exactly 2 panes) — only the dragged-onto pane's
     * content changes.
     *
     * If the dragged tab is a plain standalone tab, the pane's previous occupant is evicted
     * back out as a standalone tab in the panel the DRAGGED tab came from — not the panel
     * hosting the split. When the drag is same-panel this is the same panel either way; when
     * it's cross-panel (left ↔ right) this fills the exact slot the dragged tab vacated, making
     * it read as a two-way swap between the two panels rather than the split's panel
     * accumulating an extra tab.
     *
     * If the dragged tab is ITSELF nested inside a different composite, this instead performs
     * a true pane-for-pane swap (delegated to _swapNestedPanes): the evicted tab takes the
     * dragged tab's old slot in ITS composite (paired with its original sibling), rather than
     * being evicted as a new standalone tab and tearing that composite down.
     * @param {string} draggedTabName
     * @param {string} evictedTabName - tab currently occupying the target pane
     * @param {string} panelSide - panel hosting the split
     */
    replacePaneInSplit(draggedTabName, evictedTabName, panelSide) {
        const evictedContent = document.getElementById(`${evictedTabName}-content-panel`);
        const pane = evictedContent?.closest('.tab-split-pane');
        const wrapper = pane?.closest('.tab-split-container');
        if (!evictedContent || !pane || !wrapper) return;

        const wrapperTabName = wrapper.dataset.panelTabName;
        const compositePanel = wrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const compositeSide = compositePanel?.id.includes('left') ? 'left' : 'right';
        const compositeTabButton = compositePanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${wrapperTabName}"]`
        );
        if (!compositeTabButton) return;

        // Re-verify the dragged tab isn't nested in THIS SAME composite — _findSplitDropTarget
        // already guards this at the last mousemove, but DOM state could in principle have
        // changed by mouseup; collapsing a composite while also replacing a pane inside it is
        // ill-defined and would corrupt the structure.
        const draggedContentEl = document.getElementById(`${draggedTabName}-content-panel`);
        if (draggedContentEl?.closest('.tab-split-container') === wrapper) return;

        const otherPane = Array.from(wrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== pane);
        const otherContent = otherPane?.querySelector('[data-panel-tab-content="true"]');
        const otherTabName = otherContent?.dataset.panelTabName;
        // By construction (mergeTabIntoSplit always creates exactly 2 panes) this should
        // always resolve — but abort before mutating anything rather than risk corrupting
        // the composite if it doesn't.
        if (!otherContent || !otherTabName) {
            Logger.ui.warn(`replacePaneInSplit: could not resolve the other pane for ${evictedTabName} — aborting`);
            return;
        }

        const evictedTitle = pane.querySelector('.tab-split-pane-header')?.textContent || evictedTabName;
        const otherTitle = otherPane.querySelector('.tab-split-pane-header')?.textContent || otherTabName;

        // If the dragged tab is ITSELF nested inside a different composite, hand off to the
        // dedicated true-swap path — must NOT go through _extractDraggedTab/_collapseSplitPane,
        // which would tear the source composite down into a standalone tab instead of leaving
        // it intact with the evicted tab filling the vacated slot.
        const draggedPane = draggedContentEl?.closest('.tab-split-pane');
        const draggedWrapper = draggedPane?.closest('.tab-split-container');
        if (draggedWrapper) {
            this._swapNestedPanes(
                draggedTabName, draggedContentEl, draggedPane, draggedWrapper,
                evictedTabName, evictedContent, evictedTitle,
                pane, wrapper, wrapperTabName, compositeTabButton,
                otherTabName, otherTitle, compositeSide
            );
            return;
        }

        // Resolves + detaches the dragged tab from its standalone tab-bar button (the nested
        // case is handled above). Must run AFTER resolving the target pane/wrapper above —
        // _findSplitDropTarget already guards against the dragged tab's own host composite
        // being its own replace target, so this can't collapse the very composite we just
        // resolved as the target.
        const dragged = this._extractDraggedTab(draggedTabName);
        if (!dragged) return;
        const { content: draggedContent, title: draggedTitle, sourcePanel: draggedSourcePanel, sourceSide: draggedSourceSide } = dragged;

        // 1) Swap the pane's content: the dragged tab's content takes the evicted tab's slot
        pane.replaceChild(draggedContent, evictedContent);
        const paneHeader = pane.querySelector('.tab-split-pane-header');
        if (paneHeader) paneHeader.textContent = draggedTitle;
        draggedContent.classList.remove('hidden');
        draggedContent.style.display = '';

        // 2) If the evicted pane WAS the composite's identity anchor, the anchor must move to
        // the untouched pane's tab — otherwise the composite button and the evicted tab's new
        // standalone button would both claim the same data-tab identity.
        if (wrapperTabName === evictedTabName) {
            wrapper.dataset.panelTabName = otherTabName;
            compositeTabButton.dataset.tab = otherTabName;
        }
        compositeTabButton.dataset.originalLabel = otherTitle;
        compositeTabButton.dataset.tabGroup = `${otherTabName},${draggedTabName}`;
        compositeTabButton.textContent = `${otherTitle}/${draggedTitle}`;

        // 3) Re-home the evicted tab as a standalone tab in the DRAGGED TAB'S source panel —
        // it fills the slot the dragged tab just vacated there, rather than piling up in the
        // split's own panel. Stays backgrounded (inactive); _reactivateAfterTabRemoval below
        // will promote it to active if the dragged tab was the active tab of that panel.
        const destTabsContainer = draggedSourcePanel.querySelector('.flex.border-b.border-gray-700');
        const destContentContainer = draggedSourcePanel.querySelector('.flex-grow.overflow-y-auto');

        const newTabButton = document.createElement('button');
        newTabButton.dataset.tab = evictedTabName;
        newTabButton.className = `tab-${draggedSourceSide}`;
        newTabButton.textContent = evictedTitle;
        destTabsContainer.appendChild(newTabButton);

        evictedContent.className = evictedContent.className
            .replace('tab-content-right', `tab-content-${draggedSourceSide}`)
            .replace('tab-content-left', `tab-content-${draggedSourceSide}`);
        evictedContent.classList.add('hidden');
        evictedContent.style.display = 'none';
        destContentContainer.appendChild(evictedContent);

        this.manager.tabDragController.setupTabDraggingForPanel(draggedSourcePanel);

        // The dragged tab is now nested and visible as part of the (already active) composite —
        // setActivePanelTab never runs for it, so its search controls need an explicit refresh
        // (same reasoning as mergeTabIntoSplit above).
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);

        // The evicted tab's button already replaced the dragged tab's slot in the same panel
        // (added above), so this never actually finds the panel empty — but re-activate if the
        // dragged tab was the active one there, so the evicted tab takes over its spot visually.
        this.removeEmptyPanel(draggedSourceSide);
        this._reactivateAfterTabRemoval(draggedSourceSide);

        // Both tabs crossed panels (in a cross-panel swap) or stayed put (same-panel replace) —
        // sync tabPositions either way so a reload doesn't reconstruct the pre-swap layout out
        // from under the just-saved leftPanelSplits/rightPanelSplits (same reasoning as
        // mergeTabIntoSplit above).
        this.manager.tabOrderController._syncTabPosition(draggedTabName, compositeSide);
        this.manager.tabOrderController._syncTabPosition(evictedTabName, draggedSourceSide);
        this.manager.tabOrderController.savePanelTabOrder(draggedSourceSide);

        this.savePanelSplits(compositeSide);

        Logger.ui.info(`Replaced ${evictedTabName} with ${draggedTabName} in split (${compositeSide} panel); evicted ${evictedTabName} to standalone tab in ${draggedSourceSide} panel`);
    }

    /**
     * True pane-for-pane swap for replacePaneInSplit when the dragged tab is itself nested in a
     * different composite: the dragged tab and the evicted tab trade slots directly — each
     * composite keeps its own untouched sibling and stays a composite (still 2 panes), only the
     * two traded panes' content/labels change. Neither composite is collapsed/torn down.
     * @param {string} draggedTabName
     * @param {HTMLElement} draggedContentEl - dragged tab's `#{tab}-content-panel` element
     * @param {HTMLElement} draggedPane - the `.tab-split-pane` currently hosting draggedContentEl
     * @param {HTMLElement} draggedWrapper - draggedPane's `.tab-split-container`
     * @param {string} evictedTabName
     * @param {HTMLElement} evictedContent - evicted tab's `#{tab}-content-panel` element
     * @param {string} evictedTitle
     * @param {HTMLElement} pane - target `.tab-split-pane` (currently hosting evictedContent)
     * @param {HTMLElement} wrapper - pane's `.tab-split-container`
     * @param {string} wrapperTabName - wrapper's current identity-anchor tab name
     * @param {HTMLElement} compositeTabButton - wrapper's tab-bar button
     * @param {string} otherTabName - the target composite's untouched sibling tab
     * @param {string} otherTitle
     * @param {string} compositeSide - panel hosting `wrapper` ('left' or 'right')
     */
    _swapNestedPanes(
        draggedTabName, draggedContentEl, draggedPane, draggedWrapper,
        evictedTabName, evictedContent, evictedTitle,
        pane, wrapper, wrapperTabName, compositeTabButton,
        otherTabName, otherTitle, compositeSide
    ) {
        const draggedWrapperTabName = draggedWrapper.dataset.panelTabName;
        const draggedHostPanel = draggedWrapper.closest('#left-tabs-panel, #right-tabs-panel');
        const draggedHostSide = draggedHostPanel?.id.includes('left') ? 'left' : 'right';
        const draggedCompositeTabButton = draggedHostPanel?.querySelector(
            `.flex.border-b.border-gray-700 [data-tab="${draggedWrapperTabName}"]`
        );
        if (!draggedCompositeTabButton) return;

        const draggedSiblingPane = Array.from(draggedWrapper.querySelectorAll(':scope > .tab-split-pane')).find(p => p !== draggedPane);
        const draggedSiblingContent = draggedSiblingPane?.querySelector('[data-panel-tab-content="true"]');
        const draggedSiblingTabName = draggedSiblingContent?.dataset.panelTabName;
        // Mirrors the "could not resolve the other pane" guards elsewhere — abort before
        // mutating anything rather than risk corrupting either composite.
        if (!draggedSiblingContent || !draggedSiblingTabName) {
            Logger.ui.warn(`_swapNestedPanes: could not resolve the other pane for ${draggedTabName} — aborting`);
            return;
        }
        const draggedSiblingTitle = draggedSiblingPane.querySelector('.tab-split-pane-header')?.textContent || draggedSiblingTabName;
        const draggedTitle = draggedPane.querySelector('.tab-split-pane-header')?.textContent || draggedTabName;

        // 1) Target composite: dragged content takes the evicted content's slot. replaceChild
        // auto-detaches draggedContentEl from draggedPane (a node can only have one parent),
        // leaving draggedPane empty and ready to receive evictedContent below.
        pane.replaceChild(draggedContentEl, evictedContent);
        const targetPaneHeader = pane.querySelector('.tab-split-pane-header');
        if (targetPaneHeader) targetPaneHeader.textContent = draggedTitle;
        draggedContentEl.classList.remove('hidden');
        draggedContentEl.style.display = '';

        if (wrapperTabName === evictedTabName) {
            wrapper.dataset.panelTabName = otherTabName;
            compositeTabButton.dataset.tab = otherTabName;
        }
        compositeTabButton.dataset.originalLabel = otherTitle;
        compositeTabButton.dataset.tabGroup = `${otherTabName},${draggedTabName}`;
        compositeTabButton.textContent = `${otherTitle}/${draggedTitle}`;

        // 2) Source composite: evicted content fills the pane the dragged tab just vacated.
        draggedPane.appendChild(evictedContent);
        const sourcePaneHeader = draggedPane.querySelector('.tab-split-pane-header');
        if (sourcePaneHeader) sourcePaneHeader.textContent = evictedTitle;
        evictedContent.classList.remove('hidden');
        evictedContent.style.display = '';

        if (draggedWrapperTabName === draggedTabName) {
            draggedWrapper.dataset.panelTabName = draggedSiblingTabName;
            draggedCompositeTabButton.dataset.tab = draggedSiblingTabName;
        }
        draggedCompositeTabButton.dataset.originalLabel = draggedSiblingTitle;
        draggedCompositeTabButton.dataset.tabGroup = `${draggedSiblingTabName},${evictedTabName}`;
        draggedCompositeTabButton.textContent = `${draggedSiblingTitle}/${evictedTitle}`;

        // Both nested tabs need an explicit search-controls refresh — setActivePanelTab never
        // runs for either (same reasoning as mergeTabIntoSplit/replacePaneInSplit above).
        SearchSectionUtils.showSearchSectionForTab(draggedTabName, this.levelEditor);
        SearchSectionUtils.showSearchSectionForTab(evictedTabName, this.levelEditor);

        // Neither panel's tab-bar membership changed (no button added/removed — both
        // composites' own buttons stay put, only their nested content/labels changed), so
        // tabPositions/splits are all that need persisting; no savePanelTabOrder call needed.
        this.manager.tabOrderController._syncTabPosition(draggedTabName, compositeSide);
        this.manager.tabOrderController._syncTabPosition(evictedTabName, draggedHostSide);
        this.savePanelSplits(compositeSide);
        this.savePanelSplits(draggedHostSide);

        Logger.ui.info(`Swapped nested tabs ${draggedTabName} <-> ${evictedTabName} (composites in ${compositeSide} and ${draggedHostSide} panels)`);
    }

    /**
     * Build a `.tab-split-pane` wrapping an existing content-panel element with a small
     * draggable header (used to detach it back out later).
     * @param {string} title - Display title for the pane header
     * @param {HTMLElement} contentEl - Existing #{tab}-content-panel element (reparented, not cloned)
     */
    _createSplitPane(title, contentEl) {
        const pane = document.createElement('div');
        pane.className = 'tab-split-pane';

        const header = document.createElement('div');
        header.className = 'tab-split-pane-header';
        header.textContent = title;
        pane.appendChild(header);

        pane.appendChild(contentEl); // reparents — removes it from its previous parent

        this._setupSplitPaneHeaderDragging(header, pane);
        return pane;
    }

    /**
     * Vertical resizer between the two panes of a split container (flex-basis %). The ratio is
     * stashed on firstPane's `dataset.splitRatio` as it's dragged (read back by savePanelSplits/
     * applyPanelSplits — see mergeTabIntoSplit's `ratio` param) and persisted on release.
     */
    _setupSplitResizer(resizer, firstPane) {
        let dragging = false;
        let startY = 0;
        let startHeight = 0;
        let wrapperHeight = 0;

        const onMouseMove = (e) => {
            if (!dragging) return;
            // If the split was torn down mid-drag (e.g. its pane got detached elsewhere),
            // the resizer/pane are detached DOM nodes — stop instead of writing into the void.
            if (!resizer.isConnected || !firstPane.isConnected) { onMouseUp(); return; }
            const delta = e.clientY - startY;
            const minPane = 32;
            const newHeight = Math.max(minPane, Math.min(wrapperHeight - minPane, startHeight + delta));
            const pct = (newHeight / wrapperHeight) * 100;
            firstPane.style.flex = `0 0 ${pct}%`;
            firstPane.dataset.splitRatio = String(pct);
        };

        const onMouseUp = () => {
            dragging = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // Resizer can outlive its original panelSide (pane content gets swapped in place
            // by replacePaneInSplit) — always resolve it fresh from the live DOM rather than
            // capturing it once at setup time.
            if (resizer.isConnected) {
                const panelSide = resizer.closest('#left-tabs-panel, #right-tabs-panel')?.id.includes('left') ? 'left' : 'right';
                this.savePanelSplits(panelSide);
            }
        };

        resizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            dragging = true;
            startY = e.clientY;
            const wrapper = resizer.parentElement;
            wrapperHeight = wrapper.getBoundingClientRect().height;
            startHeight = firstPane.getBoundingClientRect().height;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    }

    /**
     * If the removed/merged-away tab was the active tab of its (former) panel, activate the
     * next-best remaining tab there — mirrors updateActiveTabAfterMove's fallback logic.
     * @param {string} panelSide - 'left' or 'right'
     */
    _reactivateAfterTabRemoval(panelSide) {
        // Skip during init-time restore (applyPanelSplits): activation is left for EventHandlers
        // to resolve after initialization finishes, same as updateActiveTabAfterMove does.
        if (this._initializing) return;

        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!panel) return; // panel was empty and got removed entirely

        const activeKey = panelSide === 'left' ? 'leftPanelTab' : 'rightPanelTab';
        const currentActive = this.stateManager.get(activeKey);
        if (currentActive && panel.querySelector(`.flex.border-b.border-gray-700 [data-tab="${currentActive}"]`)) {
            return; // active tab still exists, nothing to do
        }

        const tabsContainer = panel.querySelector('.flex.border-b.border-gray-700');
        const remaining = tabsContainer ? Array.from(tabsContainer.children).filter(t => t.dataset.tab) : [];
        if (remaining.length === 0) return;

        const next = this.manager.tabOrderController.getTabClosestToSeparator(remaining, panelSide);
        if (next?.dataset.tab && this.levelEditor?.eventHandlers) {
            this.levelEditor.eventHandlers.setActivePanelTab(next.dataset.tab, panelSide);
        }
    }

    // ── Detach: drag a split pane's header back out into a standalone tab ──

    _setupSplitPaneHeaderDragging(header, pane) {
        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            // The ordinary tab-bar drag (separate protocol) may already be in flight —
            // don't start a second, overlapping drag.
            if (this.manager.tabDragController._pendingDrag) return;
            e.preventDefault();
            this._startSplitPaneDetachDrag(header, pane, e.clientX, e.clientY);
        });
    }

    _startSplitPaneDetachDrag(header, pane, startClientX, startClientY) {
        if (this._splitDetachDragActive) return;
        this._splitDetachDragActive = true;

        // The nested tab being dragged out — resolved once at drag-start, since single-level
        // nesting guarantees it can never itself be a composite (no dataset.tabGroup guard
        // needed here the way the tab-bar protocol needs one for its own dragged tab).
        const draggedTabName = pane.querySelector('[data-panel-tab-content="true"]')?.dataset.panelTabName;

        const ghost = header.cloneNode(true);
        ghost.classList.add('tab-drag-ghost');
        ghost.style.cssText = '';
        document.body.appendChild(ghost);
        ghost.style.left = (startClientX + 14) + 'px';
        ghost.style.top = (startClientY - 12) + 'px';

        let pendingSplitTarget = null;

        const cleanup = () => {
            ghost.remove();
            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
            this._removeSplitHint();
            pendingSplitTarget = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onWindowBlur);
            this._splitDetachDragActive = false;
        };

        // Safety net: if the window loses focus mid-drag (e.g. Alt-Tab, a native dialog
        // stealing the mouseup), no 'mouseup' may ever reach document — cancel the drag
        // instead of leaving _splitDetachDragActive stuck true forever (which would
        // silently disable pane detach for the rest of the session).
        const onWindowBlur = () => cleanup();

        const onMouseMove = (e) => {
            ghost.style.left = (e.clientX + 14) + 'px';
            ghost.style.top = (e.clientY - 12) + 'px';

            document.querySelectorAll('#left-tabs-panel, #right-tabs-panel').forEach(p =>
                p.classList.remove('tab-panel--drag-over')
            );
            pendingSplitTarget = null;
            this._hideSplitHint();

            header.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            header.style.pointerEvents = '';
            if (!elUnder) return;

            // Dropping onto another tab's content area (plain tab, or a pane of a DIFFERENT
            // composite) merges/replaces just like the ordinary tab-bar drag — same fine-grained
            // zone highlighting instead of the coarse whole-panel highlight used below.
            if (draggedTabName) {
                const splitTarget = this._findSplitDropTarget(elUnder, e.clientY, draggedTabName);
                if (splitTarget) {
                    pendingSplitTarget = splitTarget;
                    this._showSplitHint(splitTarget.rect, splitTarget.position);
                    return;
                }
            }

            // v1: only existing panels are valid detach targets — this drag doesn't
            // auto-create a brand-new panel side the way the main tab-bar drag does.
            const targetPanel = elUnder?.closest('#left-tabs-panel, #right-tabs-panel');
            if (targetPanel) targetPanel.classList.add('tab-panel--drag-over');
        };

        const onMouseUp = (e) => {
            header.style.pointerEvents = 'none';
            const elUnder = document.elementFromPoint(e.clientX, e.clientY);
            header.style.pointerEvents = '';

            if (draggedTabName && pendingSplitTarget) {
                if (pendingSplitTarget.mode === 'replace') {
                    if (draggedTabName !== pendingSplitTarget.evictedTabName) {
                        this.replacePaneInSplit(draggedTabName, pendingSplitTarget.evictedTabName, pendingSplitTarget.panelSide);
                    }
                } else if (draggedTabName !== pendingSplitTarget.targetTabName) {
                    this.mergeTabIntoSplit(draggedTabName, pendingSplitTarget.targetTabName, pendingSplitTarget.panelSide, pendingSplitTarget.position);
                }
            } else {
                const targetPanel = elUnder?.closest('#left-tabs-panel, #right-tabs-panel');
                if (targetPanel && draggedTabName) {
                    const targetSide = targetPanel.id.includes('left') ? 'left' : 'right';
                    this.detachFromSplit(draggedTabName, targetSide);
                }
            }

            cleanup();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onWindowBlur);
    }

    /**
     * Pull a tab back out of a split container into a standalone tab in targetPanelSide.
     * The composite unwraps back into a plain tab once only one pane remains.
     * @param {string} tabName - Tab to detach (the one whose pane header was dragged)
     * @param {string} targetPanelSide - Destination panel ('left' or 'right') — may be the
     *   same panel the split currently lives in, which just un-merges it in place.
     */
    detachFromSplit(tabName, targetPanelSide) {
        const collapsed = this._collapseSplitPane(tabName);
        if (!collapsed) return;
        const { content: contentEl, title } = collapsed;

        // Re-home the detached tab as a plain standalone tab in the destination panel
        const destPanel = this.manager.tabLayoutController.ensurePanelExists(targetPanelSide);
        const destTabsContainer = destPanel.querySelector('.flex.border-b.border-gray-700');
        const destContentContainer = destPanel.querySelector('.flex-grow.overflow-y-auto');

        const newTabButton = document.createElement('button');
        newTabButton.dataset.tab = tabName;
        newTabButton.className = `tab-${targetPanelSide}`;
        newTabButton.textContent = title;
        destTabsContainer.appendChild(newTabButton);

        contentEl.className = contentEl.className
            .replace('tab-content-right', `tab-content-${targetPanelSide}`)
            .replace('tab-content-left', `tab-content-${targetPanelSide}`);
        contentEl.classList.remove('hidden');
        contentEl.style.display = '';
        destContentContainer.appendChild(contentEl);

        this.manager.tabDragController.setupTabDraggingForPanel(destPanel);

        if (this.levelEditor?.eventHandlers) {
            this.levelEditor.eventHandlers.setActivePanelTab(tabName, targetPanelSide);
        }

        // Keep tabPositions in sync with the tab's actual new panel (see mergeTabIntoSplit's
        // matching call for why this matters — otherwise a reload undoes the detach).
        this.manager.tabOrderController._syncTabPosition(tabName, targetPanelSide);
        this.manager.tabOrderController.savePanelTabOrder(targetPanelSide);

        Logger.ui.info(`Detached tab ${tabName} from split, now standalone in ${targetPanelSide} panel`);
    }

    /**
     * Remove panel if it has no tabs
     * @param {string} panelSide - 'left' or 'right'
     */
    removeEmptyPanel(panelSide) {
        const panel = document.getElementById(`${panelSide}-tabs-panel`);
        if (!panel) return;

        const tabsContainer = panel.querySelector('.flex.border-b.border-gray-700');
        if (tabsContainer && tabsContainer.children.length === 0) {
            // Always remove empty panels completely for consistency
            // This prevents accumulation of hidden panels in DOM

            // Cleanup event listeners before removing
            const resizer = document.getElementById(`resizer-${panelSide}-tabs-panel`);
            if (resizer) {
                if (this.levelEditor?.resizerManager) {
                    this.levelEditor.resizerManager.unregisterResizer(resizer);
                }
                eventHandlerManager.unregisterElement(resizer);
            }


            // Remove panel and resizer completely
            panel.remove();
            if (resizer) {
                resizer.remove();
            }

            Logger.ui.info(`Removed empty ${panelSide} panel completely`);

            // Update panel state to false and disable menu item since panel is empty
            this.updatePanelStateAfterRemoval(panelSide);

            // Update UI after panel is removed
            this.manager._updateUI();
        }
    }

    /**
     * Update panel state after removal - disable menu toggle when panel becomes empty
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterRemoval(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to false
        this.stateManager.set(`view.${panelKey}`, false);

        // Save to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set(`${panelKey}Visible`, false);
        }

        // Update menu item state - disable and uncheck
        if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
            this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, false);
        }

        Logger.ui.debug(`Disabled menu toggle for empty ${panelSide} panel`);
    }

    /**
     * Update panel state after creation - enable menu toggle when panel is created
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterCreation(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to true
        this.stateManager.set(`view.${panelKey}`, true);

        // Save to user preferences
        if (this.levelEditor.userPrefs) {
            this.levelEditor.userPrefs.set(`${panelKey}Visible`, true);
        }

        // Update menu item state - enable and check
        if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
            this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, true);
        }

        Logger.ui.debug(`Enabled menu toggle for ${panelSide} panel after creation`);
    }

    /**
     * Update panel state after tab addition - enable menu toggle when panel gets first tab
     * @param {string} panelSide - 'left' or 'right'
     */
    updatePanelStateAfterTabAddition(panelSide) {
        // Map panel side to state key
        const panelKey = panelSide === 'left' ? 'leftPanel' : 'rightPanel';
        const menuItemId = `toggle-${panelKey}`;

        // Set panel state to true if it was disabled due to being empty
        const currentState = this.stateManager.get(`view.${panelKey}`);
        if (currentState === false) {
            // Only enable if panel was disabled due to being empty
            this.stateManager.set(`view.${panelKey}`, true);

            // Save to user preferences
            if (this.levelEditor.userPrefs) {
                this.levelEditor.userPrefs.set(`${panelKey}Visible`, true);
            }

            // Update menu item state - enable and check
            if (this.levelEditor.eventHandlers && this.levelEditor.eventHandlers.menuManager) {
                this.levelEditor.eventHandlers.menuManager.updateToggleState(menuItemId, true);
            }

            Logger.ui.debug(`Enabled menu toggle for ${panelSide} panel after tab addition`);
        }
    }
}
