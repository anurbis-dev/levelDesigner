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
