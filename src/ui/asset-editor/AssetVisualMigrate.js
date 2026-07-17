/**
 * Ensure visual assets carry a Sprite component that owns the texture path.
 * Legacy imgSrc/image on the asset is mirrored into sprite.properties.src.
 */
import { createComponentStub } from '../../constants/ComponentTypes.js';

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
 * Image path from Sprite component only (no legacy fields).
 * @param {object|null|undefined} asset
 * @returns {string|null}
 */
export function resolveSpriteSrc(asset) {
    const spr = findSpriteComponent(asset?.components);
    return normalizeImageSrc(spr?.properties?.src);
}

/**
 * Ensure asset.components includes a sprite with src from legacy imgSrc/image if needed.
 * Mutates and returns the asset-like object.
 * @param {object} asset
 * @returns {object}
 */
export function ensureSpriteComponent(asset) {
    if (!asset || typeof asset !== 'object') return asset;
    if (!Array.isArray(asset.components)) asset.components = [];

    const legacy = normalizeImageSrc(asset.imgSrc)
        || normalizeImageSrc(asset.image)
        || normalizeImageSrc(asset.properties?.sourceFile);

    let spr = findSpriteComponent(asset.components);
    if (!spr) {
        spr = createComponentStub('sprite');
        if (!spr) return asset;
        if (legacy) spr.properties = { ...spr.properties, src: legacy };
        asset.components = [...asset.components, spr];
    } else {
        const cur = normalizeImageSrc(spr.properties?.src);
        if (!cur && legacy) {
            asset.components = asset.components.map((c) => {
                if (c.id !== spr.id) return c;
                return {
                    ...c,
                    properties: { ...(c.properties || {}), src: legacy }
                };
            });
            spr = findSpriteComponent(asset.components);
        }
    }

    // Mirror sprite → asset.imgSrc for engine / placement back-compat
    const src = normalizeImageSrc(spr?.properties?.src) || legacy;
    if (src) asset.imgSrc = src;
    return asset;
}

/**
 * After component edits: if Sprite src changed, mirror to asset.imgSrc.
 * @param {object} asset
 * @returns {string|null} resolved src
 */
export function syncImgSrcFromSprite(asset) {
    if (!asset) return null;
    const src = resolveSpriteSrc(asset);
    if (src) asset.imgSrc = src;
    return src;
}
