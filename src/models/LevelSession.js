/**
 * Editor-only wrapper around a Level instance: tracks per-level UI/editor state
 * (visibility, view state, undo/redo history, file name) that must never be
 * serialized into Level.toJSON() itself.
 */
export class LevelSession {
    constructor(level, opts = {}) {
        this.level = level;
        this.id = level.id;
        this.visible = opts.visible ?? true;
        this.fileName = opts.fileName ?? null;
        this.isDirty = opts.isDirty ?? false;
        this.viewState = opts.viewState ?? {
            camera: { x: 0, y: 0, zoom: 1 },
            selectedObjects: new Set(),
            groupEditMode: { isActive: false, groupId: null, group: null, openGroups: [] },
            currentLayerId: level.getMainLayerId(),
            outliner: {
                collapsedTypes: new Set(),
                collapsedGroups: new Set(),
                activeTypeFilters: new Set(),
                shiftAnchor: null
            }
        };
        this.history = opts.history ?? { undoStack: [], redoStack: [] };
    }
}
