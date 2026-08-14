import { Logger } from '../utils/Logger.js';
import { FsaStore } from '../utils/FsaStore.js';
import { FsaContentFs } from '../utils/FsaContentFs.js';
import { FsaContentWriter } from '../utils/FsaContentWriter.js';

/**
 * Create / move / delete asset folders and disk-backed assets.
 */
export class AssetFolderOps {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    _am() {
        return this.assetPanel.assetManager || this.assetPanel.levelEditor?.assetManager;
    }

    _editor() {
        return this.assetPanel.levelEditor;
    }

    refreshUi() {
        this.assetPanel.foldersPanel?.buildFolderStructure();
        this.assetPanel.render?.();
        this.assetPanel.stateManager?.notify('assetsChanged');
    }

    parentUiPath() {
        return this.assetPanel.getActiveTabPath?.() || 'root';
    }

    async createFolder(parentUiPath = null) {
        const parent = parentUiPath || this.parentUiPath();
        const name = await prompt('Folder name:', 'New Folder');
        if (!name) return false;
        const safe = FsaContentFs.sanitizeFolderName(name);
        if (!safe) {
            Logger.status.error('Invalid folder name');
            return false;
        }
        const parentRel = FsaContentFs.uiFolderToContentRel(parent);
        const folderRel = parentRel ? `${parentRel}/${safe}` : safe;
        const am = this._am();
        const existing = FsaContentFs.flattenFolderRels(am?.contentStructure || {});
        if (existing.includes(folderRel)) {
            Logger.status.error(`Folder already exists: ${safe}`);
            return false;
        }

        if (FsaStore.getWorkingDirectoryName()) {
            const ok = await FsaContentFs.createDirectory(folderRel);
            if (!ok) {
                Logger.status.error('Could not create folder on disk (set a project folder?)');
                return false;
            }
        }

        if (am) {
            if (!am.contentStructure || typeof am.contentStructure !== 'object') am.contentStructure = {};
            FsaContentFs.addStructureFolder(am.contentStructure, folderRel);
        }
        this.refreshUi();
        Logger.status.success(`Created folder "${safe}"`);
        return true;
    }

    async deleteFolder(uiPath) {
        if (!uiPath || uiPath === 'root') {
            Logger.status.warn('Cannot delete the Content root');
            return false;
        }
        const folderRel = FsaContentFs.uiFolderToContentRel(uiPath);
        const am = this._am();
        const assets = (am?.getAllAssets?.() || []).filter((a) => {
            const p = FsaStore.toContentRelativePath(a.path) || '';
            return p === folderRel || p.startsWith(`${folderRel}/`);
        });

        const ok = await confirm(
            `Delete folder "${folderRel}" and ${assets.length} asset(s) inside? Files are removed from the project folder.`
        );
        if (!ok) return false;

        for (const asset of assets) {
            await this._deleteAssetDiskAndMemory(asset);
        }

        if (FsaStore.getWorkingDirectoryName()) {
            await FsaContentFs.deletePath(folderRel);
            const manifest = await FsaContentFs.updateManifest((m) => {
                FsaContentFs.removeStructureNode(m.structure, folderRel);
                m.files = (m.files || []).filter((f) => f !== folderRel && !String(f).startsWith(`${folderRel}/`));
            });
            if (manifest && am) am.contentStructure = manifest.structure;
        } else if (am?.contentStructure) {
            FsaContentFs.removeStructureNode(am.contentStructure, folderRel);
        }

        const parentUi = FsaContentFs.contentRelToUiFolder(folderRel.split('/').slice(0, -1).join('/'));
        const selKey = this.assetPanel.uiStateKey?.('selectedFolders') || 'selectedFolders';
        this.assetPanel.stateManager?.set(selKey, [parentUi]);
        this.refreshUi();
        Logger.status.success(`Deleted folder "${folderRel}"`);
        return true;
    }

    async deleteSelectedFolders() {
        const folders = this.assetPanel.foldersPanel?.selectedFolders;
        const paths = folders instanceof Set ? Array.from(folders) : [];
        const targets = paths.filter((p) => p && p !== 'root');
        if (!targets.length) {
            Logger.status.warn('No folder selected');
            return false;
        }
        let any = false;
        for (const path of targets) {
            any = (await this.deleteFolder(path)) || any;
        }
        return any;
    }

    async moveAsset(asset, targetUiPath) {
        if (!asset) return false;
        const am = this._am();
        const destRel = FsaContentFs.uiFolderToContentRel(targetUiPath);
        const oldRel = FsaStore.toContentRelativePath(asset.path);
        if (!oldRel) {
            Logger.status.warn('Asset has no file path');
            return false;
        }
        const fileName = oldRel.split('/').pop();
        const newRel = destRel ? `${destRel}/${fileName}` : fileName;
        if (newRel === oldRel) return false;

        if (FsaStore.getWorkingDirectoryName()) {
            const pngName = this._siblingPngName(asset, oldRel);
            const moved = await FsaContentFs.moveFile(oldRel, newRel);
            if (!moved) {
                Logger.status.error('Could not move file on disk');
                return false;
            }
            if (pngName) {
                const oldPngRel = oldRel.split('/').slice(0, -1).concat(pngName).join('/');
                const newPngRel = newRel.split('/').slice(0, -1).concat(pngName).join('/');
                await FsaContentFs.moveFile(oldPngRel, newPngRel);
            }
            const manifest = await FsaContentFs.updateManifest((m) => {
                m.files = (m.files || []).filter((f) => f !== oldRel);
                if (!m.files.includes(newRel)) m.files.push(newRel);
                FsaContentFs.addStructureFolder(m.structure, destRel);
            });
            if (manifest && am) am.contentStructure = manifest.structure;
        }

        asset.path = newRel;
        const parts = newRel.split('/');
        asset.category = parts[parts.length - 2] || parts[0] || asset.category;
        this.refreshUi();
        Logger.status.success(`Moved "${asset.name}" → ${destRel || 'Content'}`);
        return true;
    }

    async deleteAssetWithDisk(asset) {
        return this._deleteAssetDiskAndMemory(asset);
    }

    async _deleteAssetDiskAndMemory(asset) {
        const am = this._am();
        if (!asset || !am) return false;
        const rel = FsaStore.toContentRelativePath(asset.path);
        if (rel && FsaStore.getWorkingDirectoryName()) {
            const pngName = this._siblingPngName(asset, rel);
            await FsaContentFs.deletePath(rel);
            if (pngName) {
                const pngRel = rel.split('/').slice(0, -1).concat(pngName).join('/');
                await FsaContentFs.deletePath(pngRel);
            }
            const manifest = await FsaContentFs.updateManifest((m) => {
                m.files = (m.files || []).filter((f) => f !== rel);
            });
            if (manifest && am) am.contentStructure = manifest.structure;
        }
        if (asset.imgSrc && String(asset.imgSrc).startsWith('blob:')) {
            try { URL.revokeObjectURL(asset.imgSrc); } catch { /* ignore */ }
        }
        am.removeAsset(asset.id);
        return true;
    }

    _siblingPngName(asset, jsonRel) {
        const src = asset.imgSrc || asset.properties?.sourceFile || '';
        if (typeof src === 'string' && src && !src.startsWith('data:') && !src.startsWith('blob:')) {
            const base = src.split('?')[0].replace(/\\/g, '/').split('/').pop();
            if (base.toLowerCase().endsWith('.png')) return base;
        }
        const stem = String(jsonRel || '').split('/').pop().replace(/\.json$/i, '');
        return stem ? `${stem}.png` : null;
    }

    static buildMoveMenuItems(assetPanel, asset) {
        const am = assetPanel.assetManager || assetPanel.levelEditor?.assetManager;
        const ops = assetPanel.folderOps || new AssetFolderOps(assetPanel);
        const currentRel = FsaStore.toContentRelativePath(asset?.path || '');
        const currentDir = currentRel ? currentRel.split('/').slice(0, -1).join('/') : '';
        const rels = FsaContentFs.flattenFolderRels(am?.contentStructure || {});
        const items = [{
            id: 'move-to-root',
            text: 'Content',
            disabled: () => currentDir === '',
            action: () => ops.moveAsset(asset, 'root')
        }];
        for (const rel of rels) {
            items.push({
                id: `move-to-${rel.replace(/[^\w-]+/g, '-')}`,
                text: rel,
                disabled: () => rel === currentDir,
                action: () => ops.moveAsset(asset, FsaContentFs.contentRelToUiFolder(rel))
            });
        }
        return items;
    }
}
