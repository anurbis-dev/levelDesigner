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
 * §7 backlog (prefab, Tier 2): assetsById is now built from `manifest.assets` (persisted
 * catalog asset data, `Asset.toJSON()` shape — see ProjectExporter.js's opts.assetManager),
 * keyed by asset id. Used by the `SpawnObject` Event Graph node
 * (registerDefaultEventGraphNodes.js) via `EntityFactory.fromAssetData()`. eventsById stays
 * an empty Map — Special Events registration (opts.events) still unused, MVP.
 */
export class ProjectLoader {
    static load(manifest, opts = {}) {
        const levelsById = new Map();
        (manifest?.levels || []).forEach(({ id, data }) => levelsById.set(id, data));

        const assetsById = new Map();
        (manifest?.assets || []).forEach(asset => {
            if (asset?.id) assetsById.set(asset.id, asset);
        });

        return {
            levelsById,
            entryLevelId: manifest?.entryLevelId ?? null,
            assetsById,
            eventsById: new Map()
        };
    }

    static loadLevel(levelId, registries) {
        const levelData = registries.levelsById.get(levelId);
        if (!levelData) {
            throw new Error(`ProjectLoader.loadLevel: unknown levelId "${levelId}"`);
        }
        const scene = new Scene(levelData);
        scene.assetsById = registries.assetsById;
        return scene;
    }
}
