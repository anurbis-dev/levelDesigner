/**
 * Visual ownership:
 * - type=image: disk texture lives on asset.imgSrc only (no Sprite component).
 * - actor/prefab/etc: Sprite.properties.imageAssetId → Image asset id (not a file path).
 * Engine/placement still receive a resolved URL on entity.imgSrc at instance time.
 */
import { createComponentStub } from '../../constants/ComponentTypes.js';
import { DEFAULT_ASSET_COMPONENTS } from '../../constants/AssetTypes.js';

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function normalizeImageSrc(raw) {
    if (raw == null || raw === '') return null;
    if (Array.isArray(raw)) {
        const first = raw.find((x) => typeof x === 'string' && x.trim());
        return first ? first.trim() : null;
    }
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    return t || null;
}

/**
 * @param {object|null|undefined} asset
 * @returns {boolean}
 */
export function isImageAsset(asset) {
    return !!asset && asset.type === 'image';
}

/**
 * Disk path/URL only valid on Image assets.
 * @param {object|null|undefined} asset
 * @returns {string|null}
 */
export function getImageDiskSrc(asset) {
    if (!asset) return null;
    return normalizeImageSrc(asset.imgSrc)
        || normalizeImageSrc(asset.image)
        || normalizeImageSrc(asset.properties?.sourceFile);
}

/**
 * First enabled sprite component (or first sprite if none enabled).
 * @param {Array|null|undefined} components
 * @returns {object|null}
 */
export function findSpriteComponent(components) {
    const list = Array.isArray(components) ? components : [];
    const sprites = list.filter((c) => c && c.type === 'sprite');
    if (!sprites.length) return null;
    return sprites.find((c) => c.enabled !== false) || sprites[0];
}

/**
 * Types that should carry a Sprite component (reference Image assets).
 * @param {string|null|undefined} typeId
 */
export function assetTypeWantsSprite(typeId) {
    if (!typeId || typeId === 'image') return false;
    const defaults = DEFAULT_ASSET_COMPONENTS[typeId];
    if (Array.isArray(defaults) && defaults.includes('sprite')) return true;
    // Common composite / placeable types without explicit DEFAULT entry
    return typeId === 'actor' || typeId === 'prefab' || typeId === 'imageAtlas';
}

/**
 * Basename for path matching (FG_flora_02.png).
 * @param {string|null|undefined} src
 */
export function textureBasename(src) {
    if (!src || typeof src !== 'string') return '';
    const noQuery = src.split('?')[0];
    const parts = noQuery.replace(/\\/g, '/').split('/');
    return (parts[parts.length - 1] || '').toLowerCase();
}

/**
 * Find Image asset id whose disk src matches path/basename.
 * @param {object|null|undefined} assetManager
 * @param {string} pathOrUrl
 * @returns {string|null}
 */
export function findImageAssetIdBySrc(assetManager, pathOrUrl) {
    const want = normalizeImageSrc(pathOrUrl);
    if (!want || !assetManager?.getAllAssets) return null;
    const wantBase = textureBasename(want);
    const all = assetManager.getAllAssets() || [];
    for (const a of all) {
        if (!isImageAsset(a)) continue;
        const disk = getImageDiskSrc(a);
        if (!disk) continue;
        if (disk === want) return a.id;
        if (wantBase && textureBasename(disk) === wantBase) return a.id;
    }
    return null;
}

/**
 * Resolve display/engine texture URL for any asset.
 * Image → own imgSrc; else Sprite.imageAssetId → Image.imgSrc; legacy fallbacks last.
 * @param {object|null|undefined} asset
 * @param {object|null|undefined} assetManager
 * @returns {string|null}
 */
export function resolveTextureSrc(asset, assetManager) {
    if (!asset) return null;
    if (isImageAsset(asset)) {
        return getImageDiskSrc(asset);
    }
    const spr = findSpriteComponent(asset.components);
    if (spr && spr.enabled !== false) {
        const refId = spr.properties?.imageAssetId;
        if (refId && assetManager?.getAsset) {
            const imgAsset = assetManager.getAsset(refId);
            if (imgAsset) {
                const disk = getImageDiskSrc(imgAsset);
                if (disk) return disk;
            }
        }
        // Legacy: path stored on sprite.src (should be migrated away)
        const legacySrc = normalizeImageSrc(spr.properties?.src);
        if (legacySrc) return legacySrc;
    }
    // Deprecated base-field fallback (non-image should not keep imgSrc)
    return getImageDiskSrc(asset);
}

/**
 * @deprecated use resolveTextureSrc(asset, assetManager)
 * Kept for callers that only had sprite.src path.
 */
export function resolveSpriteSrc(asset, assetManager) {
    return resolveTextureSrc(asset, assetManager);
}

/**
 * Normalize asset visual ownership in place.
 * @param {object} asset
 * @param {object|null|undefined} [assetManager]
 * @returns {object}
 */
export function ensureAssetVisualModel(asset, assetManager = null) {
    if (!asset || typeof asset !== 'object') return asset;
    if (!Array.isArray(asset.components)) asset.components = [];

    if (isImageAsset(asset)) {
        const disk = getImageDiskSrc(asset)
            || (() => {
                const spr = findSpriteComponent(asset.components);
                return normalizeImageSrc(spr?.properties?.src);
            })();
        if (disk) asset.imgSrc = disk;
        // Image assets own the file — no Sprite component
        asset.components = asset.components.filter((c) => c.type !== 'sprite');
        if ('image' in asset) delete asset.image;
        return asset;
    }

    // Non-image: collect legacy disk hints, then clear base imgSrc
    const spr0 = findSpriteComponent(asset.components);
    const legacyDisk = normalizeImageSrc(asset.imgSrc)
        || normalizeImageSrc(asset.image)
        || normalizeImageSrc(spr0?.properties?.src);

    let spr = spr0;
    if (!spr && assetTypeWantsSprite(asset.type)) {
        spr = createComponentStub('sprite');
        if (spr) asset.components = [...asset.components, spr];
    }

    if (spr) {
        let imageAssetId = spr.properties?.imageAssetId || '';
        if (!imageAssetId && legacyDisk && assetManager) {
            imageAssetId = findImageAssetIdBySrc(assetManager, legacyDisk) || '';
        }
        const nextProps = { ...(spr.properties || {}) };
        if (imageAssetId) nextProps.imageAssetId = imageAssetId;
        // Drop path-style src from sprite (disk only on Image assets)
        delete nextProps.src;
        asset.components = asset.components.map((c) => {
            if (c.id !== spr.id && c.type !== 'sprite') return c;
            if (c.type !== 'sprite') return c;
            return { ...c, properties: nextProps };
        });
    }

    // Base asset must not carry texture path
    asset.imgSrc = null;
    if ('image' in asset) delete asset.image;
    return asset;
}

/**
 * @deprecated alias — prefer ensureAssetVisualModel
 */
export function ensureSpriteComponent(asset, assetManager = null) {
    return ensureAssetVisualModel(asset, assetManager);
}

/**
 * No-op mirror: non-image assets do not store imgSrc.
 * @param {object} asset
 * @param {object|null|undefined} [assetManager]
 * @returns {string|null}
 */
export function syncImgSrcFromSprite(asset, assetManager = null) {
    if (!asset) return null;
    if (isImageAsset(asset)) return getImageDiskSrc(asset);
    // Explicitly clear leaked imgSrc on composites
    if (asset.imgSrc) asset.imgSrc = null;
    return resolveTextureSrc(asset, assetManager);
}

/**
 * JSON-safe payload for persistence: only Image assets keep imgSrc.
 * @param {object} asset
 * @returns {object}
 */
export function assetToPersistable(asset) {
    const json = {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        category: asset.category,
        path: asset.path,
        width: asset.width,
        height: asset.height,
        color: asset.color,
        properties: asset.properties || {},
        tags: asset.tags || [],
        components: asset.components || []
    };
    if (isImageAsset(asset)) {
        const disk = getImageDiskSrc(asset);
        if (disk) json.imgSrc = disk;
    }
    return json;
}
