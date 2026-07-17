import { isAssetEditorType, typeLabel } from '../dock/DockConstants.js';

/**
 * Default split-tree for the asset-editor floating window.
 * @param {{ makeLeaf: (type: string, label?: string) => object }} model
 * @returns {object} dock tree root
 */
export function buildDefaultAssetEditorTree(model) {
    return {
        type: 'split',
        direction: 'column',
        ratio: 0.55,
        children: [
            {
                type: 'split',
                direction: 'row',
                ratio: 0.55,
                children: [
                    model.makeLeaf('assetPreview', 'Preview'),
                    {
                        type: 'split',
                        direction: 'column',
                        ratio: 0.5,
                        children: [
                            model.makeLeaf('assetIdentity', 'Identity'),
                            model.makeLeaf('assetComponents', 'Components')
                        ]
                    }
                ]
            },
            model.makeLeaf('assetComponentDetails', 'Component Details')
        ]
    };
}

/**
 * Deep-clone a saved dock tree with fresh leaf ids (avoids collisions with live leaves).
 * Non-asset contentTypes are remapped to assetIdentity as a safe fallback.
 * @param {{ makeLeaf: (type: string, label?: string) => object }} model
 * @param {object|null|undefined} node
 * @returns {object|null}
 */
export function remapAssetEditorTree(model, node) {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'leaf') {
        const ct = isAssetEditorType(node.contentType) ? node.contentType : 'assetIdentity';
        const leaf = model.makeLeaf(ct, node.label || typeLabel(ct));
        if (node.collapsed) leaf.collapsed = true;
        return leaf;
    }
    if (node.type === 'split'
        && (node.direction === 'row' || node.direction === 'column')
        && Array.isArray(node.children)
        && node.children.length === 2) {
        const a = remapAssetEditorTree(model, node.children[0]);
        const b = remapAssetEditorTree(model, node.children[1]);
        if (!a && !b) return null;
        if (!a) return b;
        if (!b) return a;
        const ratio = typeof node.ratio === 'number' && Number.isFinite(node.ratio)
            ? Math.min(0.95, Math.max(0.05, node.ratio))
            : 0.5;
        return {
            type: 'split',
            direction: node.direction,
            ratio,
            children: [a, b]
        };
    }
    return null;
}
