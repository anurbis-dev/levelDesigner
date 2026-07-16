/**
 * Asset-type load classification — own copy, not an import of
 * src/constants/AssetTypes.js (src/engine/ stays self-contained, see plan). Source of
 * truth for the id list is docs/RUNTIME_SCHEMA.md — keep both in sync by hand when a
 * type is added/removed there. Per tmp/2D_Editor_ENGINE_PLAN.md §1.3.
 */
export const LOADABLE_ASSET_TYPES = [
    'image', 'imageAtlas', 'soundEffect', 'musicTrack', 'fontTextStyle', 'tileset', 'spriteAnimationClip'
];

export const DATA_ONLY_ASSET_TYPES = [
    'camera', 'actor', 'volume', 'player_start',
    'tilemap', 'nineSliceSprite', 'particleEffect', 'materialShaderPreset', 'light',
    'audioZone',
    'dialogueGraph', 'questObjective', 'itemDefinition', 'inventorySchema',
    'localizationTable', 'saveSchema', 'inputMap',
    'pathSpline', 'navMesh', 'aiBehaviorPreset',
    'prefab', 'sequenceCutscene'
];

export class AssetLoader {
    /**
     * Distinct imgSrc values referenced by a scene's entities (including group children).
     * @param {import('./Scene.js').Scene} scene
     * @returns {Set<string>}
     */
    static collectImageSources(scene) {
        const sources = new Set();
        const visit = (entities) => {
            entities.forEach(entity => {
                if (entity.imgSrc) sources.add(entity.imgSrc);
                if (entity.children) visit(entity.children);
            });
        };
        visit(scene.entities);
        return sources;
    }

    /**
     * Preload images for the given sources. Browser-only (guarded) — not unit-tested,
     * verified once the engine is mounted in a page (Фаза 3).
     * @param {Set<string>|string[]} sources
     * @returns {Promise<Map<string, unknown>>}
     */
    static async loadImages(sources) {
        const cache = new Map();
        if (typeof Image === 'undefined') return cache;

        await Promise.all(Array.from(sources).map(src => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { cache.set(src, img); resolve(); };
            img.onerror = () => resolve();
            img.src = src;
        })));

        return cache;
    }
}
