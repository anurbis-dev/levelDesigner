import { describe, it, expect } from 'vitest';
import { ObjectOperations } from '../src/core/ObjectOperations.js';
import { GroupOperations } from '../src/core/GroupOperations.js';

/**
 * Minimal editor stub covering only what ObjectOperations' stacking-order and
 * visibility methods touch: level.objects (flat + grouped), groupOperations
 * for parent lookup, and a StateManager-shaped map for groupEditMode/view.*.
 */
function makeEditor(objects) {
    const state = { selectedObjects: new Set(), groupEditMode: null };
    const editor = {
        level: { objects },
        stateManager: {
            get: (key) => state[key],
            set: (key, value) => { state[key] = value; }
        }
    };
    editor.objectOperations = new ObjectOperations(editor);
    editor.groupOperations = new GroupOperations(editor);
    return editor;
}

describe('ObjectOperations stacking order (characterization)', () => {
    it('getSiblingArray returns level.objects for a top-level object', () => {
        const a = { id: 'a' };
        const editor = makeEditor([a]);
        expect(editor.objectOperations.getSiblingArray(a)).toBe(editor.level.objects);
    });

    it('getSiblingArray returns the parent group children array for a nested object', () => {
        const child = { id: 'child' };
        const group = { id: 'g', type: 'group', children: [child] };
        const editor = makeEditor([group]);
        expect(editor.objectOperations.getSiblingArray(child)).toBe(group.children);
    });

    it('bringToFront moves object to the end of the array', () => {
        const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
        const editor = makeEditor([a, b, c]);
        editor.objectOperations.bringToFront(a);
        expect(editor.level.objects).toEqual([b, c, a]);
    });

    it('bringToFront is a no-op when already frontmost or not found', () => {
        const a = { id: 'a' }, b = { id: 'b' };
        const editor = makeEditor([a, b]);
        editor.objectOperations.bringToFront(b);
        expect(editor.level.objects).toEqual([a, b]);
    });

    it('sendToBack moves object to the start of the array', () => {
        const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
        const editor = makeEditor([a, b, c]);
        editor.objectOperations.sendToBack(c);
        expect(editor.level.objects).toEqual([c, a, b]);
    });

    it('sendToBack is a no-op when already at index 0', () => {
        const a = { id: 'a' }, b = { id: 'b' };
        const editor = makeEditor([a, b]);
        editor.objectOperations.sendToBack(a);
        expect(editor.level.objects).toEqual([a, b]);
    });

    it('moveForward swaps with the next sibling', () => {
        const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
        const editor = makeEditor([a, b, c]);
        editor.objectOperations.moveForward(a);
        expect(editor.level.objects).toEqual([b, a, c]);
    });

    it('moveForward is a no-op for the last element', () => {
        const a = { id: 'a' }, b = { id: 'b' };
        const editor = makeEditor([a, b]);
        editor.objectOperations.moveForward(b);
        expect(editor.level.objects).toEqual([a, b]);
    });

    it('moveBackward swaps with the previous sibling', () => {
        const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
        const editor = makeEditor([a, b, c]);
        editor.objectOperations.moveBackward(c);
        expect(editor.level.objects).toEqual([a, c, b]);
    });

    it('moveBackward is a no-op for the first element', () => {
        const a = { id: 'a' }, b = { id: 'b' };
        const editor = makeEditor([a, b]);
        editor.objectOperations.moveBackward(a);
        expect(editor.level.objects).toEqual([a, b]);
    });
});

describe('ObjectOperations.toggleObjectVisibility (characterization)', () => {
    it('toggles a plain object visible flag', () => {
        const a = { id: 'a', visible: true };
        const editor = makeEditor([a]);
        editor.objectOperations.toggleObjectVisibility(a);
        expect(a.visible).toBe(false);
    });

    it('cascades the same new value onto every descendant of a group', () => {
        const grandchild = { id: 'gc', visible: true };
        const child = { id: 'c', type: 'group', visible: true, children: [grandchild] };
        const group = { id: 'g', type: 'group', visible: true, children: [child] };
        const editor = makeEditor([group]);

        editor.objectOperations.toggleObjectVisibility(group);

        expect(group.visible).toBe(false);
        expect(child.visible).toBe(false);
        expect(grandchild.visible).toBe(false);
    });
});

describe('ObjectOperations.ensurePlayerStartExists', () => {
    // Regression: the auto-created object must carry a playerStart component, not just the
    // right `type` — Scene.findPlayerStartEntity() (src/engine/Scene.js) resolves entities by
    // component (`getSpawnPosition`), and GameEngine only spawns a controllable player from
    // that. Without it, Play-in-editor rendered only the static lightblue marker (bug fixed
    // alongside FileManager.createNewLevel(), same root cause).
    it('attaches a playerStart component to the auto-created object', () => {
        const objects = [];
        const editor = {
            level: { objects, addObject: (obj) => objects.push(obj), getStats: () => ({ byType: { player_start: 1 } }) },
            cachedLevelStats: { byType: {} },
            historyManager: { isUndoing: false, isRedoing: false, saveState: () => {} },
            stateManager: { get: () => null },
            invalidateObjectCaches: () => {},
            render: () => {}
        };
        editor.objectOperations = new ObjectOperations(editor);

        editor.objectOperations.ensurePlayerStartExists();

        expect(objects).toHaveLength(1);
        expect(objects[0].components).toEqual([
            expect.objectContaining({ type: 'playerStart', enabled: true })
        ]);
    });
});
