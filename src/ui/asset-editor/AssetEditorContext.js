/**
 * Shared context for asset-editor dock panels (editing asset + selected component).
 */
import {
    ensureAssetVisualModel,
    ensureSpriteComponent,
    normalizeImageSrc,
    resolveTextureSrc,
    resolveSpriteSrc,
    findSpriteComponent,
    isImageAsset,
    getImageDiskSrc
} from './AssetVisualMigrate.js';

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
 * Paint every assetPreview panel immediately (live property edits).
 * @param {object|null|undefined} levelEditor
 */
export function paintAssetEditorPreviews(levelEditor) {
    const reg = levelEditor?.dockManager?.registry || levelEditor?.dockManager?.contentRegistry;
    if (!reg?._byLeafId) return;
    for (const bind of reg._byLeafId.values()) {
        if (bind.contentType !== 'assetPreview' || !bind.panel) continue;
        const p = bind.panel;
        if (typeof p._paint === 'function') p._paint();
        else if (typeof p._draw === 'function') p._draw();
    }
}

/**
 * Record asset-catalog snapshot on HistoryManager (project-global asset stack).
 * @param {object|null|undefined} levelEditor
 */
export function recordAssetEditorHistory(levelEditor) {
    const hm = levelEditor?.historyManager;
    const am = levelEditor?.assetManager;
    if (!hm || !am || typeof am.snapshotForHistory !== 'function') return;
    if (hm.isUndoing || hm.isRedoing || hm.isRecording === false) return;
    const snap = am.snapshotForHistory();
    hm.ensureAssetBaseline(snap);
    hm.saveAssetState(snap);
}

/**
 * @param {object|null|undefined} levelEditor
 * @param {string} assetId
 * @param {object} patch
 * @param {{ recordHistory?: boolean }} [opts]
 * @returns {boolean}
 */
export function patchEditingAsset(levelEditor, assetId, patch, opts = {}) {
    const am = levelEditor?.assetManager;
    if (!am || !assetId || !patch) return false;
    const recordHistory = opts.recordHistory !== false;
    if (recordHistory) {
        // Baseline before first mutation in a session
        const hm = levelEditor?.historyManager;
        if (hm && typeof am.snapshotForHistory === 'function' && hm.assetUndoStack?.length === 0) {
            hm.ensureAssetBaseline(am.snapshotForHistory());
        }
    }
    const ok = !!am.updateAsset(assetId, patch);
    if (ok) {
        paintAssetEditorPreviews(levelEditor);
        if (recordHistory) recordAssetEditorHistory(levelEditor);
    }
    return ok;
}

/**
 * Replace one component on the editing asset (immutable components array).
 * Does not mirror texture paths onto non-image base assets.
 * @param {object|null|undefined} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {(comp: object) => object} mapFn
 * @param {{ recordHistory?: boolean }} [opts]
 * @returns {boolean}
 */
export function patchEditingComponent(levelEditor, assetId, componentId, mapFn, opts = {}) {
    const asset = getEditingAsset(levelEditor);
    if (!asset || asset.id !== assetId) return false;
    const list = Array.isArray(asset.components) ? asset.components : [];
    let found = false;
    const next = list.map((c) => {
        if (c.id !== componentId) return c;
        found = true;
        return mapFn({ ...c, properties: { ...(c.properties || {}) } });
    });
    if (!found) return false;

    const patch = { components: next };
    // Image assets: never store texture on components; non-image: clear leaked imgSrc
    if (!isImageAsset(asset) && asset.imgSrc) {
        patch.imgSrc = null;
    }
    return patchEditingAsset(levelEditor, assetId, patch, opts);
}

/**
 * Resolve display image URL (needs AssetManager for Sprite→Image refs).
 * @param {object|null|undefined} asset
 * @param {object|null|undefined} [assetManagerOrEditor] AssetManager or levelEditor
 * @returns {string|null}
 */
export function resolveAssetImageSrc(asset, assetManagerOrEditor) {
    if (!asset) return null;
    const am = assetManagerOrEditor?.getAsset
        ? assetManagerOrEditor
        : assetManagerOrEditor?.assetManager || null;
    return resolveTextureSrc(asset, am);
}

export {
    ensureAssetVisualModel,
    ensureSpriteComponent,
    resolveSpriteSrc,
    resolveTextureSrc,
    findSpriteComponent,
    isImageAsset,
    getImageDiskSrc,
    normalizeImageSrc
};
