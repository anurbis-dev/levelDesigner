import { Entity } from './Entity.js';
import { BehaviorRegistry } from './BehaviorRegistry.js';

/**
 * Converts editor-serialized GameObject/Group data (see docs/RUNTIME_SCHEMA.md) into
 * runtime Entity instances. Single conversion point — validation against RUNTIME_SCHEMA.md
 * belongs here once per-type `properties` contracts are implemented (Фаза 2/3).
 */
export class EntityFactory {
    static fromGameObjectData(data) {
        const entity = new Entity(data);
        entity.behaviors = (entity.components || [])
            .filter(component => component.enabled !== false)
            .map(component => EntityFactory._instantiateBehavior(entity, component))
            .filter(Boolean);
        if (data.type === 'group' && Array.isArray(data.children)) {
            entity.children = data.children.map(child => EntityFactory.fromGameObjectData(child));
        }
        return entity;
    }

    /**
     * §7 backlog (prefab, Tier 2): spawns an Entity from a catalog asset's persisted data
     * (the shape `Asset.toJSON()`/`assetToPersistable` produce, as looked up in
     * `scene.assetsById` — see ProjectLoader.js). Engine-native counterpart of the editor's
     * `Asset.createInstance()` (`src/models/Asset.js`) — deliberately reimplemented here
     * rather than reused, since `engine/` stays free of `src/models|ui|...` imports (see
     * Context_map.md's Фаза 1 MVP-ядро rule). Skips the deprecated `sprite.src` legacy-path
     * fallback that `resolveTextureSrc` still carries — not needed for new runtime code.
     * @param {object} assetData - persisted asset (id/name/type/width/height/color/imgSrc?/properties/components)
     * @param {{id?: string, x?: number, y?: number, layerId?: string|null}} [placement]
     * @param {Map<string, object>} [assetsById] - for resolving a composite asset's
     *   `sprite` component `properties.imageAssetId` to another catalog asset's `imgSrc`
     * @returns {import('./Entity.js').Entity}
     */
    static fromAssetData(assetData, placement = {}, assetsById = new Map()) {
        const instanceData = {
            id: placement.id ?? EntityFactory._generateSpawnId(),
            name: assetData.name,
            type: assetData.type,
            x: placement.x ?? 0,
            y: placement.y ?? 0,
            width: assetData.width,
            height: assetData.height,
            color: assetData.color,
            imgSrc: EntityFactory._resolveAssetImgSrc(assetData, assetsById),
            materialPreset: assetData.materialPreset ?? null,
            layerId: placement.layerId ?? null,
            properties: { ...(assetData.properties || {}) },
            components: (assetData.components || []).map(c => ({ ...c, properties: { ...(c.properties || {}) } }))
        };
        return EntityFactory.fromGameObjectData(instanceData);
    }

    static _generateSpawnId() {
        return `spawn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    /** Mirrors AssetVisualMigrate.js's resolveTextureSrc(asset, assetManager), against a plain assetsById Map instead. */
    static _resolveAssetImgSrc(assetData, assetsById) {
        if (assetData.type === 'image') return assetData.imgSrc || null;
        const sprite = (assetData.components || []).find(c => c?.type === 'sprite' && c.enabled !== false);
        const refId = sprite?.properties?.imageAssetId;
        const imgAsset = refId ? assetsById.get(refId) : null;
        return imgAsset?.imgSrc || assetData.imgSrc || null;
    }

    static _instantiateBehavior(entity, componentData) {
        const BehaviorClass = BehaviorRegistry.get(componentData.type);
        if (!BehaviorClass) {
            console.warn(`[engine] component type '${componentData.type}' not implemented, skipped`);
            return null;
        }
        return new BehaviorClass(entity, componentData);
    }
}
