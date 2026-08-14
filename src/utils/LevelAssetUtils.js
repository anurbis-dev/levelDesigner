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
