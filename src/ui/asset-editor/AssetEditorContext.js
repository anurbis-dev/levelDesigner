/**
 * Shared context for asset-editor dock panels (editing asset + selected component).
 */
export const ASSET_EDITOR_ROLE = 'assetEditor';

/**
 * @param {object|null|undefined} levelEditor
 * @returns {object|null}
 */
export function getEditingAsset(levelEditor) {
    const id = levelEditor?.stateManager?.get('editingAssetId');
    if (!id) return null;
    return levelEditor.assetManager?.getAsset?.(id) || null;
}

/**
 * @param {object|null|undefined} levelEditor
 * @param {string|null} assetId
 */
export function setEditingAssetId(levelEditor, assetId) {
    const sm = levelEditor?.stateManager;
    if (!sm) return;
    sm.set('editingAssetId', assetId || null);
    if (!assetId) {
        sm.set('editingComponentId', null);
    }
}

/**
 * @param {object|null|undefined} levelEditor
 * @param {string|null} componentId
 */
export function setEditingComponentId(levelEditor, componentId) {
    levelEditor?.stateManager?.set('editingComponentId', componentId || null);
}

/**
 * @param {object|null|undefined} levelEditor
 * @returns {string|null}
 */
export function getEditingComponentId(levelEditor) {
    return levelEditor?.stateManager?.get('editingComponentId') || null;
}

/**
 * Subscribe panels to asset-editor context + catalog changes.
 * @param {object} stateManager
 * @param {() => void} onChange
 * @returns {() => void} unsubscribe all
 */
export function subscribeAssetEditor(stateManager, onChange) {
    if (!stateManager?.subscribe) return () => {};
    const unsubs = [
        stateManager.subscribe('editingAssetId', onChange),
        stateManager.subscribe('editingComponentId', onChange),
        stateManager.subscribe('assetsChanged', onChange)
    ];
    return () => unsubs.forEach((u) => {
        try { u?.(); } catch { /* ignore */ }
    });
}

/**
 * @param {object|null|undefined} levelEditor
 * @param {string} assetId
 * @param {object} patch
 * @returns {boolean}
 */
export function patchEditingAsset(levelEditor, assetId, patch) {
    const am = levelEditor?.assetManager;
    if (!am || !assetId || !patch) return false;
    return !!am.updateAsset(assetId, patch);
}
