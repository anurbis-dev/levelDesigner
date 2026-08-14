/**
 * Level catalog helpers — type=level assets and full map JSON documents.
 */

export function isLevelDocument(data) {
    return !!(data && typeof data === 'object'
        && Array.isArray(data.objects)
        && Array.isArray(data.layers)
        && data.settings);
}

export function resolveLevelSrc(asset) {
    if (!asset) return null;
    const src = asset.properties?.levelSrc || asset.path || null;
    return src ? String(src) : null;
}

/**
 * Map file to load for a catalog type=level asset.
 * Only `properties.levelSrc` points at a real map. `path` is the catalog JSON
 * (placeholder stubs, Asset Editor file) — fetching it as a map 404s.
 */
export function resolveMapSrc(asset) {
    if (!asset?.properties?.levelSrc) return null;
    return String(asset.properties.levelSrc);
}

/**
 * @param {object|null} asset
 * @param {object|null} loadedJson
 * @returns {{ kind: 'document', json: object } | { kind: 'empty' } | { kind: 'invalid' }}
 */
export function pickLevelOpenPayload(asset, loadedJson) {
    if (isLevelDocument(loadedJson)) return { kind: 'document', json: loadedJson };
    if (asset?.type === 'level') return { kind: 'empty' };
    return { kind: 'invalid' };
}

export function resolveLevelFileName(asset, src) {
    if (src) {
        const base = String(src).replace(/\\/g, '/').split('/').pop();
        if (base) return base;
    }
    const name = String(asset?.name || 'level').trim() || 'level';
    return name.toLowerCase().endsWith('.json') ? name : `${name}.json`;
}

export function contentUrl(rel) {
    const p = String(rel || '').replace(/^\.\//, '').replace(/^content\//, '');
    return p ? `./content/${p}` : null;
}

export function resolveCatalogAssetType(assetData, filePath = '') {
    if (assetData?.type && assetData.type !== 'image') return assetData.type;
    if (isLevelDocument(assetData)) return 'level';
    if (typeof filePath === 'string' && filePath.startsWith('maps/') && isLevelDocument(assetData)) {
        return 'level';
    }
    return assetData?.type || 'image';
}
