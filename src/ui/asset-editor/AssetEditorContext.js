/**
 * Shared context for asset-editor dock panels (editing asset + selected component).
 */
import {
    ensureSpriteComponent,
    normalizeImageSrc,
    resolveSpriteSrc,
    syncImgSrcFromSprite
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
 * @param {object|null|undefined} levelEditor
 * @param {string} assetId
 * @param {object} patch
 * @returns {boolean}
 */
export function patchEditingAsset(levelEditor, assetId, patch) {
    const am = levelEditor?.assetManager;
    if (!am || !assetId || !patch) return false;
    const ok = !!am.updateAsset(assetId, patch);
    if (ok) paintAssetEditorPreviews(levelEditor);
    return ok;
}

/**
 * Replace one component on the editing asset (immutable components array).
 * Mirrors Sprite.src → asset.imgSrc for engine/placement.
 * @param {object|null|undefined} levelEditor
 * @param {string} assetId
 * @param {string} componentId
 * @param {(comp: object) => object} mapFn
 * @returns {boolean}
 */
export function patchEditingComponent(levelEditor, assetId, componentId, mapFn) {
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

    // Temporary apply for sync helper
    const prev = asset.components;
    asset.components = next;
    syncImgSrcFromSprite(asset);
    const imgSrc = asset.imgSrc;
    asset.components = prev;

    return patchEditingAsset(levelEditor, assetId, {
        components: next,
        ...(imgSrc != null ? { imgSrc } : {})
    });
}

/**
 * Resolve display image URL: Sprite component first, then legacy asset fields.
 * @param {object|null|undefined} asset
 * @returns {string|null}
 */
export function resolveAssetImageSrc(asset) {
    if (!asset) return null;
    const fromSprite = resolveSpriteSrc(asset);
    if (fromSprite) return fromSprite;
    let src = asset.imgSrc;
    if (Array.isArray(src)) src = src[0] || null;
    if (!src && asset.properties?.sourceFile) src = asset.properties.sourceFile;
    if (!src && asset.image) src = asset.image;
    return normalizeImageSrc(src);
}

export { ensureSpriteComponent, resolveSpriteSrc, findSpriteComponent } from './AssetVisualMigrate.js';
