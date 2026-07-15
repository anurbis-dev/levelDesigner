import { describe, it, expect, beforeAll } from 'vitest';

/**
 * LevelEditor.js pulls in DOM-touching singletons at import time (e.g. DialogReplacer
 * reads `window.alert` in its constructor) — stub the minimum globals so the module
 * graph loads under vitest's default node environment.
 */
beforeAll(() => {
    globalThis.window = globalThis.window || {
        alert() {}, confirm() {}, prompt() {},
        addEventListener() {}, removeEventListener() {}
    };
    globalThis.document = globalThis.document || {
        addEventListener() {}, removeEventListener() {},
        createElement() { return { addEventListener() {}, style: {}, classList: { add() {}, remove() {} } }; },
        body: { appendChild() {} }
    };
});

/**
 * Characterization tests for LevelEditor.findObjectById / findTopLevelObject and their
 * private helpers, pinning current behavior before A1 (dedup against GroupTraversalUtils).
 * Methods are invoked on a bare `Object.create(LevelEditor.prototype)` stub carrying only
 * `this.level`, matching the pattern used for other core classes in this test suite.
 */
async function makeEditor(objects, { findTopLevelObjectFast = () => null } = {}) {
    const { LevelEditor } = await import('../src/core/LevelEditor.js');
    const editor = Object.create(LevelEditor.prototype);
    // `level` is a get/set accessor on the prototype backed by levelSessions (see
    // LevelEditor.js `set level()`) — shadow it with an own data property instead of
    // assigning through the setter, which would require a full session/manager stub.
    Object.defineProperty(editor, 'level', { value: { objects, findTopLevelObjectFast } });
    return editor;
}

describe('LevelEditor.findObjectById (characterization)', () => {
    it('returns null for an empty level', async () => {
        const editor = await makeEditor([]);
        expect(editor.findObjectById('missing')).toBeNull();
    });

    it('finds a top-level object', async () => {
        const a = { id: 'a' };
        const editor = await makeEditor([a]);
        expect(editor.findObjectById('a')).toBe(a);
    });

    it('finds an object inside a direct group', async () => {
        const child = { id: 'c' };
        const group = { id: 'g', type: 'group', children: [child] };
        const editor = await makeEditor([group]);
        expect(editor.findObjectById('c')).toBe(child);
    });

    it('finds an object inside a nested group', async () => {
        const grandchild = { id: 'gc' };
        const inner = { id: 'inner', type: 'group', children: [grandchild] };
        const outer = { id: 'outer', type: 'group', children: [inner] };
        const editor = await makeEditor([outer]);
        expect(editor.findObjectById('gc')).toBe(grandchild);
    });

    it('finds a nested group itself by id', async () => {
        const inner = { id: 'inner', type: 'group', children: [] };
        const outer = { id: 'outer', type: 'group', children: [inner] };
        const editor = await makeEditor([outer]);
        expect(editor.findObjectById('inner')).toBe(inner);
    });

    it('returns null for a non-existent id', async () => {
        const a = { id: 'a' };
        const group = { id: 'g', type: 'group', children: [{ id: 'c' }] };
        const editor = await makeEditor([a, group]);
        expect(editor.findObjectById('missing')).toBeNull();
    });
});

describe('LevelEditor.findTopLevelObject (characterization)', () => {
    it('returns the fast-path result immediately when the index hits', async () => {
        const fastResult = { id: 'fast' };
        const editor = await makeEditor([], { findTopLevelObjectFast: () => fastResult });
        expect(editor.findTopLevelObject('anything')).toBe(fastResult);
    });

    it('falls back and returns a matching top-level object', async () => {
        const a = { id: 'a' };
        const editor = await makeEditor([a]);
        expect(editor.findTopLevelObject('a')).toBe(a);
    });

    it('falls back and returns the containing top-level group for a direct child', async () => {
        const child = { id: 'c' };
        const group = { id: 'g', type: 'group', children: [child] };
        const editor = await makeEditor([group]);
        expect(editor.findTopLevelObject('c')).toBe(group);
    });

    it('falls back and returns the outer top-level group for a doubly-nested child', async () => {
        const grandchild = { id: 'gc' };
        const inner = { id: 'inner', type: 'group', children: [grandchild] };
        const outer = { id: 'outer', type: 'group', children: [inner] };
        const editor = await makeEditor([outer]);
        expect(editor.findTopLevelObject('gc')).toBe(outer);
    });

    it('returns null when the id does not exist anywhere', async () => {
        const a = { id: 'a' };
        const group = { id: 'g', type: 'group', children: [{ id: 'c' }] };
        const editor = await makeEditor([a, group]);
        expect(editor.findTopLevelObject('missing')).toBeNull();
    });

    it('returns null for an empty level', async () => {
        const editor = await makeEditor([]);
        expect(editor.findTopLevelObject('anything')).toBeNull();
    });
});
