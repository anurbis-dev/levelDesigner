/**
 * §7 backlog (saveSchema, Tier 3). Browser-guarded (localStorage) persistence for a scene's
 * variables/inventory — same `typeof X === 'undefined'` guard convention as AudioPlayer/
 * AssetLoader.loadImages (no-op, not an error, when `localStorage` is unavailable, e.g. Node
 * test env). "Across sessions" (browser tab close/reopen) is what this actually implements;
 * "across levels" is supported by the same mechanism (a future LoadLevel action calling
 * SaveGame.load() on the newly-constructed Scene would restore the same persisted data under
 * one global key, not a per-level one) but level-switching itself isn't wired yet — `LoadLevel`
 * is still an unregistered Event Graph node (see registerDefaultEventGraphNodes.js header) —
 * that part is out of scope here.
 *
 * Schema is inline params on the `SaveGame`/`LoadGame` Event Graph action nodes — same "no
 * separate catalog asset/registry" convention as `PlaySound`/`pathFollower.interpolation`/
 * `stateMachineBehavior.aiPreset` — not a `level.saveSchema` data blob:
 * `{variables?: string[], inventory?: boolean}`.
 *
 * `load()` adds saved inventory counts onto whatever's already in `scene.inventory` — it
 * doesn't clear the bag first (Inventory has no bulk-clear method, and adding one is out of
 * scope for this pass). Intended usage: call `load()` right after `loadProject()`, before other
 * gameplay mutates the bag, on a level whose own `levelData.inventory` seed is empty.
 */
export class SaveGame {
    static KEY = 'levelDesigner.save';

    /**
     * @param {import('./Scene.js').Scene} scene
     * @param {{variables?: string[], inventory?: boolean}} [schema]
     * @returns {boolean} false when localStorage is unavailable
     */
    static save(scene, schema = {}) {
        if (typeof localStorage === 'undefined') return false;
        const data = {};
        if (Array.isArray(schema.variables) && schema.variables.length && scene.eventGraphRuntime) {
            data.variables = {};
            for (const name of schema.variables) {
                data.variables[name] = scene.eventGraphRuntime.getVariable(name);
            }
        }
        if (schema.inventory) {
            data.inventory = scene.inventory.list();
        }
        localStorage.setItem(SaveGame.KEY, JSON.stringify(data));
        return true;
    }

    /**
     * @param {import('./Scene.js').Scene} scene
     * @param {{variables?: string[], inventory?: boolean}} [schema]
     * @returns {boolean} false when localStorage is unavailable, no save exists, or it's unparseable
     */
    static load(scene, schema = {}) {
        if (typeof localStorage === 'undefined') return false;
        const raw = localStorage.getItem(SaveGame.KEY);
        if (!raw) return false;

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            console.warn('[engine] SaveGame.load: saved data is not valid JSON, ignored');
            return false;
        }

        if (data.variables && scene.eventGraphRuntime) {
            for (const [name, value] of Object.entries(data.variables)) {
                scene.eventGraphRuntime.setVariable(name, value);
            }
        }
        if (schema.inventory && Array.isArray(data.inventory)) {
            for (const { itemId, count } of data.inventory) {
                scene.inventory.add(itemId, count);
            }
        }
        return true;
    }

    /** @returns {boolean} false when localStorage is unavailable */
    static clear() {
        if (typeof localStorage === 'undefined') return false;
        localStorage.removeItem(SaveGame.KEY);
        return true;
    }
}
