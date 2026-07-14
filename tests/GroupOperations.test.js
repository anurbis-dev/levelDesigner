import { describe, it, expect } from 'vitest';
import { GroupOperations } from '../src/core/GroupOperations.js';

function makeEditor(objects, { groupEditMode = null } = {}) {
    const state = { groupEditMode };
    const editor = {
        level: {
            objects,
            removeObjects: (ids) => {
                editor.level.objects = editor.level.objects.filter(o => !ids.includes(o.id) && !ids.has?.(o.id));
            }
        },
        stateManager: { get: (key) => state[key] }
    };
    editor.groupOperations = new GroupOperations(editor);
    return editor;
}

describe('GroupOperations._findParentGroup (characterization)', () => {
    it('returns null for a top-level object', () => {
        const a = { id: 'a' };
        const editor = makeEditor([a]);
        expect(editor.groupOperations._findParentGroup(a)).toBeNull();
    });

    it('finds the direct parent group', () => {
        const child = { id: 'c' };
        const group = { id: 'g', type: 'group', children: [child] };
        const editor = makeEditor([group]);
        expect(editor.groupOperations._findParentGroup(child)).toBe(group);
    });

    it('finds the parent through nested groups (returns the immediate parent, not the root)', () => {
        const grandchild = { id: 'gc' };
        const inner = { id: 'inner', type: 'group', children: [grandchild] };
        const outer = { id: 'outer', type: 'group', children: [inner] };
        const editor = makeEditor([outer]);
        expect(editor.groupOperations._findParentGroup(grandchild)).toBe(inner);
        expect(editor.groupOperations._findParentGroup(inner)).toBe(outer);
    });
});

describe('GroupOperations.removeEmptyGroup (characterization)', () => {
    it('does nothing and returns false for a non-group', () => {
        const a = { id: 'a' };
        const editor = makeEditor([a]);
        expect(editor.groupOperations.removeEmptyGroup(a)).toBe(false);
    });

    it('does nothing and returns false when the group has more than one child', () => {
        const group = { id: 'g', type: 'group', children: [{ id: 'a' }, { id: 'b' }] };
        const editor = makeEditor([group]);
        expect(editor.groupOperations.removeEmptyGroup(group)).toBe(false);
        expect(editor.level.objects).toEqual([group]);
    });

    it('removes a top-level group with zero children', () => {
        const group = { id: 'g', type: 'group', children: [] };
        const editor = makeEditor([group]);
        expect(editor.groupOperations.removeEmptyGroup(group)).toBe(true);
        expect(editor.level.objects).toEqual([]);
    });

    it('is protected (returns false) while the group is open for group-edit', () => {
        const group = { id: 'g', type: 'group', children: [] };
        const editor = makeEditor([group], { groupEditMode: { openGroups: [group] } });
        expect(editor.groupOperations.removeEmptyGroup(group)).toBe(false);
        expect(editor.level.objects).toEqual([group]);
    });
});
