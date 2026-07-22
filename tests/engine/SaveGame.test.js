import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SaveGame } from '../../src/engine/SaveGame.js';
import { Scene } from '../../src/engine/Scene.js';

function mockLocalStorage() {
    const store = new Map();
    return {
        getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
        setItem: vi.fn((k, v) => store.set(k, v)),
        removeItem: vi.fn((k) => store.delete(k))
    };
}

function sceneWithRuntime(inventorySeed = null) {
    const scene = new Scene({ inventory: inventorySeed });
    scene.eventGraphRuntime = {
        variables: new Map(),
        getVariable(name) { return this.variables.get(name); },
        setVariable(name, value) { this.variables.set(name, value); }
    };
    return scene;
}

describe('SaveGame — browser guard', () => {
    afterEach(() => {
        delete global.localStorage;
    });

    it('save() returns false without touching anything when localStorage is unavailable', () => {
        const scene = sceneWithRuntime();
        expect(SaveGame.save(scene, { variables: ['x'] })).toBe(false);
    });

    it('load() returns false when localStorage is unavailable', () => {
        const scene = sceneWithRuntime();
        expect(SaveGame.load(scene, {})).toBe(false);
    });

    it('clear() returns false when localStorage is unavailable', () => {
        expect(SaveGame.clear()).toBe(false);
    });
});

describe('SaveGame.save / SaveGame.load', () => {
    beforeEach(() => {
        global.localStorage = mockLocalStorage();
    });

    afterEach(() => {
        delete global.localStorage;
    });

    it('persists and restores listed variables', () => {
        const scene = sceneWithRuntime();
        scene.eventGraphRuntime.setVariable('hasKey', true);
        scene.eventGraphRuntime.setVariable('score', 42);

        expect(SaveGame.save(scene, { variables: ['hasKey', 'score'] })).toBe(true);

        const fresh = sceneWithRuntime();
        expect(SaveGame.load(fresh, {})).toBe(true);
        expect(fresh.eventGraphRuntime.getVariable('hasKey')).toBe(true);
        expect(fresh.eventGraphRuntime.getVariable('score')).toBe(42);
    });

    it('does not persist variables when schema.variables is omitted', () => {
        const scene = sceneWithRuntime();
        scene.eventGraphRuntime.setVariable('hasKey', true);

        SaveGame.save(scene, {});

        const fresh = sceneWithRuntime();
        SaveGame.load(fresh, {});
        expect(fresh.eventGraphRuntime.getVariable('hasKey')).toBeUndefined();
    });

    it('persists and restores inventory when schema.inventory is true', () => {
        const scene = sceneWithRuntime();
        scene.inventory.add('gold', 10);
        scene.inventory.add('key', 1);

        SaveGame.save(scene, { inventory: true });

        const fresh = sceneWithRuntime();
        SaveGame.load(fresh, { inventory: true });
        expect(fresh.inventory.count('gold')).toBe(10);
        expect(fresh.inventory.count('key')).toBe(1);
    });

    it('does not touch inventory when schema.inventory is falsy on load, even if saved', () => {
        const scene = sceneWithRuntime();
        scene.inventory.add('gold', 10);
        SaveGame.save(scene, { inventory: true });

        const fresh = sceneWithRuntime();
        SaveGame.load(fresh, {});
        expect(fresh.inventory.count('gold')).toBe(0);
    });

    it('load() returns false when there is no saved data yet', () => {
        const scene = sceneWithRuntime();
        expect(SaveGame.load(scene, { variables: ['x'] })).toBe(false);
    });

    it('load() warns and returns false for corrupted JSON instead of throwing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        global.localStorage.setItem(SaveGame.KEY, '{not json');
        const scene = sceneWithRuntime();

        expect(SaveGame.load(scene, {})).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('clear() removes the saved key', () => {
        const scene = sceneWithRuntime();
        SaveGame.save(scene, { inventory: true });
        expect(SaveGame.clear()).toBe(true);

        const fresh = sceneWithRuntime();
        expect(SaveGame.load(fresh, { inventory: true })).toBe(false);
    });

    it('skips variable persistence when the scene has no eventGraphRuntime', () => {
        const scene = new Scene({});
        expect(() => SaveGame.save(scene, { variables: ['x'] })).not.toThrow();
        expect(() => SaveGame.load(scene, { variables: ['x'] })).not.toThrow();
    });
});
