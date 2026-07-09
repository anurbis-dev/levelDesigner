import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { LevelSession } from '../models/LevelSession.js';

/**
 * Manages the set of open LevelSessions (multi-level support): adding levels,
 * switching the current level, and tracking per-level visibility.
 * @extends BaseModule
 */
export class LevelsManager extends BaseModule {
    // Soft cap for simultaneously visible levels (Edge Case 5) — warning only, no hard limit.
    static VISIBLE_LEVELS_SOFT_CAP = 5;

    constructor(editor) {
        super(editor);
        Logger.lifecycle.info('LevelsManager initialized');
    }

    /**
     * Wrap a Level in a LevelSession and register it as an open tab.
     * @param {Level} level
     * @param {Object} opts
     * @param {boolean} [opts.makeCurrent=true] - switch to this level once added
     * @param {boolean} [opts.visible=true] - initial eye-icon visibility
     * @param {string|null} [opts.fileName=null]
     * @returns {LevelSession}
     */
    addLevel(level, { makeCurrent = true, visible = true, fileName = null } = {}) {
        const hadCurrentSession = this.editor.currentLevelId !== null;

        // Level.toJSON() never serializes `id` (fresh id generated on every fromJSON()),
        // so files saved by this editor can't collide — but Level's constructor doesn't
        // reject an `id` present in externally-crafted/hand-edited JSON. A collision would
        // otherwise silently overwrite the existing Map entry in levelSessions.set() below
        // while levelOrder still gets a duplicate push, desyncing the two and breaking
        // closeLevel()'s "last level" guard (levelSessions.size vs levelOrder.length).
        if (this.editor.levelSessions.has(level.id)) {
            Logger.lifecycle.warn(`Level id collision on add (${level.id}) — generating a fresh id to keep levelSessions/levelOrder in sync.`);
            level.id = `level_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        const session = new LevelSession(level, { visible, fileName });
        this.editor.levelSessions.set(session.id, session);
        this.editor.levelOrder.push(session.id);

        if (!hadCurrentSession) {
            // Bootstrap / full-replace path (back-compat `editor.level = X` setter):
            // there is no previous session to save and no other open tab to switch
            // from, so skip setCurrentLevel()'s render/history side effects — the
            // caller (init flow, newLevel(), openLevel()) already handles those itself.
            this.editor.currentLevelId = session.id;
            this.editor.levelMRU.push(session.id);
        } else if (makeCurrent) {
            this.setCurrentLevel(session.id);
        }

        this.editor.stateManager.notify('levelsListChanged', { levelIds: [...this.editor.levelOrder] });
        return session;
    }

    /**
     * @returns {LevelSession|null} the session for the current level
     */
    getCurrentSession() {
        return this.editor.levelSessions.get(this.editor.currentLevelId) || null;
    }

    /**
     * @returns {LevelSession[]} sessions in tab order
     */
    getOrderedSessions() {
        return this.editor.levelOrder
            .map(id => this.editor.levelSessions.get(id))
            .filter(Boolean);
    }

    /**
     * @returns {LevelSession[]} sessions currently marked visible (eye icon on)
     */
    getVisibleSessions() {
        const sessions = this.getOrderedSessions();
        // Solo (Ctrl+click a level's eye icon in LevelsPanel): if any level is soloed,
        // only soloed level(s) render, regardless of their own `visible` flag — mirrors
        // LayersPanel/RenderOperations.getVisibleLayerIds() solo behavior for layers.
        const soloedSessions = sessions.filter(session => session.soloed);
        if (soloedSessions.length > 0) return soloedSessions;
        return sessions.filter(session => session.visible);
    }

    /**
     * Switch the current level, saving the outgoing session's view/history state
     * and restoring the incoming one's. Does NOT call stateManager.reset() —
     * that would wipe global UI chrome (view.* / panels.*) unrelated to which
     * level is open.
     * @param {string} levelId
     */
    setCurrentLevel(levelId) {
        const newSession = this.editor.levelSessions.get(levelId);
        if (!newSession || levelId === this.editor.currentLevelId) return;

        const oldSession = this.editor.levelSessions.get(this.editor.currentLevelId);
        if (oldSession) {
            oldSession.viewState.camera = { ...this.editor.stateManager.get('camera') };
            oldSession.viewState.selectedObjects = new Set(this.editor.stateManager.get('selectedObjects'));
            oldSession.viewState.groupEditMode = { ...this.editor.stateManager.get('groupEditMode') };
            oldSession.viewState.currentLayerId = this.editor.layersPanel?.getCurrentLayerId() ?? oldSession.viewState.currentLayerId;
            oldSession.viewState.outliner = { ...this.editor.stateManager.get('outliner') };
            oldSession.history = this.editor.historyManager.exportState();
            // stateManager.isDirty is a single global flag (~28 markDirty()/markClean()
            // call sites across the codebase, none of them level-aware) — snapshotting
            // it here on every switch, same as camera/selection/etc., makes it behave as
            // per-session without needing to touch any of those call sites (Phase 5).
            oldSession.isDirty = this.editor.stateManager.get('isDirty');
        }

        this.editor.currentLevelId = levelId;

        // Track most-recently-current order (Edge Case 2): move levelId to the end.
        // Used as the fallback pick when closeLevel() closes the current tab, instead
        // of always falling back to levelOrder[0].
        const mruIdx = this.editor.levelMRU.indexOf(levelId);
        if (mruIdx !== -1) this.editor.levelMRU.splice(mruIdx, 1);
        this.editor.levelMRU.push(levelId);

        // Clone on restore (mirrors the clone-on-save above) so the live stateManager
        // objects/Sets are never the same instance as what's stored on the session —
        // otherwise later in-place mutation (e.g. dotted-key 'camera.zoom' sets) would
        // silently corrupt the stored viewState of the session we just switched away from.
        this.editor.stateManager.set('camera', { ...newSession.viewState.camera });
        this.editor.stateManager.set('selectedObjects', new Set(newSession.viewState.selectedObjects));
        this.editor.stateManager.set('groupEditMode', { ...newSession.viewState.groupEditMode });
        this.editor.stateManager.set('outliner', { ...newSession.viewState.outliner });
        this.editor.stateManager.set('isDirty', newSession.isDirty);

        this.editor.clearCaches();
        this.editor.setupLayerObjectsCountTracking();
        this.editor.updateCachedLevelStats();
        if (newSession.viewState.currentLayerId) {
            this.editor.setCurrentLayer(newSession.viewState.currentLayerId);
        }
        this.editor.historyManager.importState(newSession.history);

        this.editor.stateManager.notify('currentLevelChanged', { levelId, level: newSession.level });
        this.editor.stateManager.notifyListeners('level', newSession.level, oldSession ? oldSession.level : null);

        this.editor.render();
        this.editor.updateAllPanels();
    }

    /**
     * Toggle the eye-icon visibility of a level (independent of which level is current).
     * @param {string} levelId
     */
    toggleLevelVisibility(levelId) {
        const session = this.editor.levelSessions.get(levelId);
        if (!session) return;
        session.visible = !session.visible;
        this.editor.stateManager.notify('levelVisibilityChanged', { levelId, visible: session.visible });

        if (session.visible) {
            const visibleCount = this.getVisibleSessions().length;
            // Warn only on the threshold crossing, not on every toggle while already above
            // it — otherwise clicking multiple eye icons in a row spams the status bar.
            if (visibleCount === LevelsManager.VISIBLE_LEVELS_SOFT_CAP + 1) {
                Logger.status.warn(`${visibleCount} levels visible at once — viewport performance may degrade on large levels.`);
            }
        }

        this.editor.render();
    }

    /**
     * Ctrl+click a level's eye icon: exclusive "solo" — only this level renders,
     * regardless of any level's own `visible` flag (see getVisibleSessions() above).
     * Ctrl+click an already-soloed level to un-solo (back to normal per-level visibility).
     * Non-destructive: never touches `session.visible`, `session.soloed` is a transient UI flag.
     * @param {string} levelId
     */
    toggleLevelSolo(levelId) {
        const session = this.editor.levelSessions.get(levelId);
        if (!session) return;

        const wasSoloed = session.soloed;
        this.getOrderedSessions().forEach(s => { s.soloed = false; });
        session.soloed = !wasSoloed;

        this.editor.stateManager.notify('levelVisibilityChanged', { levelId, visible: session.visible });
        this.editor.render();
    }

    /**
     * Toggle a level's lock state. Mirrors LayersPanel.toggleLayerLock's effect but scoped
     * to the whole level: when the CURRENT level becomes locked, clear its selection (the
     * canvas/Outliner selectability gates — ObjectOperations.computeSelectableSet(),
     * OutlinerPanel's canSelect — already block re-selecting anything in a locked current
     * level, so this just clears what was selected before the lock). Locking a background
     * (non-current) level has no selection to clear — its objects aren't reachable via
     * canvas/Outliner selection today regardless (see plan: no cross-level interaction).
     * @param {string} levelId
     */
    toggleLevelLock(levelId) {
        const session = this.editor.levelSessions.get(levelId);
        if (!session) return;

        session.locked = !session.locked;

        if (session.locked && levelId === this.editor.currentLevelId) {
            this.editor.stateManager.set('selectedObjects', new Set());
        }

        this.editor.stateManager.notify('levelLockChanged', { levelId, locked: session.locked });
        this.editor.render();
    }

    /**
     * Order levels for compositing (RenderOperations.render()): tab order, except the
     * current level (if visible) is always drawn last / on top, independent of its tab
     * position — plan decision, section 12 item 2.
     * @param {LevelSession[]} [sessions] - pre-computed getVisibleSessions() result, to
     *   avoid recomputing it a second time in the per-frame render hot path.
     * @returns {LevelSession[]}
     */
    getVisibleSessionsForRender(sessions = this.getVisibleSessions()) {
        const currentIdx = sessions.findIndex(session => session.id === this.editor.currentLevelId);
        if (currentIdx === -1 || currentIdx === sessions.length - 1) return sessions;
        const reordered = sessions.slice();
        const [currentSession] = reordered.splice(currentIdx, 1);
        reordered.push(currentSession);
        return reordered;
    }

    /**
     * Reorder open level tabs (drag-reorder in LevelsPanel). Purely a tab-order change —
     * does not affect which level is current or visible.
     * @param {string[]} newOrder - full permutation of the currently open level ids
     */
    reorderLevels(newOrder) {
        const validIds = new Set(this.editor.levelOrder);
        const filtered = newOrder.filter(id => validIds.has(id));
        if (filtered.length !== this.editor.levelOrder.length) {
            // Can happen if the drag gesture's source list was filtered (search) and so
            // didn't contain every open level — LevelsPanel disables dragging in that case,
            // this is just defense in depth. Status-bar (not just console) so a stray drop
            // that silently no-ops is still visible to the user, not just "nothing happened".
            Logger.status.warn('Could not reorder levels — drag order did not match the full open level list.');
            return;
        }
        this.editor.levelOrder = filtered;
        this.editor.stateManager.notify('levelsListChanged', { levelIds: [...this.editor.levelOrder] });
        this.editor.render();
    }

    /**
     * Switch to the next/previous level tab in `levelOrder` (wraps around).
     * @param {number} direction - +1 for next, -1 for previous
     */
    cycleLevel(direction) {
        const order = this.editor.levelOrder;
        if (order.length <= 1) return;
        const currentIdx = order.indexOf(this.editor.currentLevelId);
        if (currentIdx === -1) return;
        const nextIdx = (currentIdx + direction + order.length) % order.length;
        this.setCurrentLevel(order[nextIdx]);
    }

    /**
     * Close (remove) an open level tab. Refuses to close the last remaining level
     * (mirrors "Main layer can't be deleted" — count>=1, not a protected specific level,
     * see plan Edge Case 3) and confirms first if the level has unsaved changes.
     * @param {string} levelId
     */
    async closeLevel(levelId) {
        const session = this.editor.levelSessions.get(levelId);
        if (!session) return;

        if (this.editor.levelSessions.size === 1) {
            Logger.status.warn('Cannot close the only open level');
            return;
        }

        const isDirty = levelId === this.editor.currentLevelId
            ? this.editor.stateManager.get('isDirty')
            : session.isDirty;
        if (isDirty) {
            const ok = await confirm(`"${session.level.meta.name}" has unsaved changes. Close anyway?`);
            if (!ok) return;
        }

        const wasCurrent = levelId === this.editor.currentLevelId;
        this.editor.levelSessions.delete(levelId);
        this.editor.levelOrder = this.editor.levelOrder.filter(id => id !== levelId);
        this.editor.levelMRU = this.editor.levelMRU.filter(id => id !== levelId);

        // Session bookkeeping above already committed and must not be rolled back. Cache
        // cleanup is isolated in its own try/catch so a failure there (non-fatal — caches
        // are self-healing, just less efficient until rebuilt) can never skip the
        // switch-to-next-level step below, which MUST run when wasCurrent — otherwise
        // editor.currentLevelId is left dangling on the session just deleted above.
        try {
            session.level.clearLayerCountsCache();
            session.level.clearObjectsIndex();
            this.editor.renderOperations.invalidateSpatialIndex(levelId);
            this.editor.renderOperations.visibleLayersCache.delete(levelId);
        } catch (error) {
            Logger.lifecycle.error(`closeLevel(${levelId}) cache cleanup failed (non-fatal):`, error);
        }

        try {
            if (wasCurrent) {
                // MRU fallback (Edge Case 2): most-recently-current still-open tab, else
                // first tab in open order (e.g. right after startup, before any switch).
                const nextId = this.editor.levelMRU[this.editor.levelMRU.length - 1] ?? this.editor.levelOrder[0];
                this.setCurrentLevel(nextId);
            } else {
                this.editor.render();
            }
        } catch (error) {
            Logger.lifecycle.error(`closeLevel(${levelId}) switch/render step failed:`, error);
        }

        this.editor.stateManager.notify('levelsListChanged', { levelIds: [...this.editor.levelOrder] });
        this.editor.levelsPanel?.render();
    }

    /**
     * @returns {boolean} true if the current level or any other open (background)
     *   level has unsaved changes. Used by save-prompts that should consider every
     *   open tab, not just the current one (see plan section 7.1's "derived global").
     */
    hasAnyUnsavedChanges() {
        return this.getOrderedSessions().some(session =>
            session.id === this.editor.currentLevelId
                ? this.editor.stateManager.get('isDirty')
                : session.isDirty
        );
    }

    /**
     * Cleanup method. Runs before LevelEditor.destroy()'s own `this.level = null`
     * assignment (lifecycle destroys modules before that point), so cache cleanup
     * for every open session happens here rather than relying on `editor.level`
     * still resolving afterwards.
     */
    destroy() {
        this.editor.levelSessions.forEach(session => {
            session.level.clearLayerCountsCache();
            session.level.clearObjectsIndex();
        });
        this.editor.levelSessions.clear();
        this.editor.levelOrder = [];
        this.editor.levelMRU = [];
        this.editor.currentLevelId = null;
        Logger.lifecycle.info('LevelsManager destroyed');
    }
}
