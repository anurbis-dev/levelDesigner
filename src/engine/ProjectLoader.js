import { Scene } from './Scene.js';

/**
 * Entry point for loading a runtime-Project manifest (see docs/CONTENT_MODEL.md,
 * shape produced by src/models/ProjectExporter.js). Loading order per
 * tmp/2D_Editor_ENGINE_PLAN.md §1.0:
 *   1. build levelsById registry from the base Project manifest
 *   2. apply active Addons (overrides/additions by id) — MVP: opts.addons accepted, unused
 *   3. register Special Events separately, never merged into the main registry — MVP:
 *      opts.events accepted, unused
 *   4. load one concrete level (default: entryLevelId) via EntityFactory
 * assetsById/eventsById stay empty Maps for now — ProjectExporter doesn't emit a
 * separate asset registry yet (placed objects already carry imgSrc inline); wiring
 * Addon asset-overrides needs that registry to exist first (Фаза 3/4).
 */
export class ProjectLoader {
    static load(manifest, opts = {}) {
        const levelsById = new Map();
        (manifest?.levels || []).forEach(({ id, data }) => levelsById.set(id, data));

        return {
            levelsById,
            entryLevelId: manifest?.entryLevelId ?? null,
            assetsById: new Map(),
            eventsById: new Map()
        };
    }

    static loadLevel(levelId, registries) {
        const levelData = registries.levelsById.get(levelId);
        if (!levelData) {
            throw new Error(`ProjectLoader.loadLevel: unknown levelId "${levelId}"`);
        }
        return new Scene(levelData);
    }
}
