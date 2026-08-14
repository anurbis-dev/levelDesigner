import { Logger } from '../utils/Logger.js';
import { FsaStore } from '../utils/FsaStore.js';
import { FsaContentFs } from '../utils/FsaContentFs.js';
import { FsaContentWriter } from '../utils/FsaContentWriter.js';
import { AssetPathRewriter } from '../utils/AssetPathRewriter.js';

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
        return this.moveAssets(asset ? [asset] : [], targetUiPath);
    }

    async moveAssetsByIds(ids, targetUiPath) {
        const am = this._am();
        const assets = (ids || []).map((id) => am?.getAsset?.(id)).filter(Boolean);
        return this.moveAssets(assets, targetUiPath);
    }

    async moveAssets(assets, targetUiPath) {
        const list = (assets || []).filter(Boolean);
        if (!list.length) return false;
        const destRel = FsaContentFs.uiFolderToContentRel(targetUiPath);
        const plans = [];
        const remaps = [];
        for (const asset of list) {
            const oldRel = FsaStore.toContentRelativePath(asset.path);
            if (!oldRel) {
                Logger.status.warn(`Asset "${asset.name}" has no file path`);
                continue;
            }
            const fileName = oldRel.split('/').pop();
            const newRel = destRel ? `${destRel}/${fileName}` : fileName;
            if (newRel === oldRel) continue;
            const pngName = this._siblingPngName(asset, oldRel);
            const png = pngName ? {
                from: oldRel.split('/').slice(0, -1).concat(pngName).join('/'),
                to: newRel.split('/').slice(0, -1).concat(pngName).join('/')
            } : null;
            plans.push({ asset, oldRel, newRel, png });
            remaps.push({ from: oldRel, to: newRel });
            if (png) remaps.push(png);
        }
        if (!plans.length) return false;
        if (new Set(plans.map((p) => p.newRel)).size !== plans.length) {
            Logger.status.error('Cannot move: duplicate destination names');
            return false;
        }

        const granted = !!FsaStore.getWorkingDirectoryName();
        if (granted) {
            for (const plan of plans) {
                const moved = await FsaContentFs.moveFile(plan.oldRel, plan.newRel);
                if (!moved) {
                    Logger.status.error(`Could not move "${plan.oldRel}"`);
                    return false;
                }
                if (plan.png) await FsaContentFs.moveFile(plan.png.from, plan.png.to);
            }
        }

        for (const { asset, newRel } of plans) {
            asset.path = newRel;
            const parts = newRel.split('/');
            asset.category = parts[parts.length - 2] || parts[0] || asset.category;
        }
        await this._commitRemaps(remaps, (m) => {
            for (const { oldRel, newRel } of plans) {
                m.files = (m.files || []).filter((f) => f !== oldRel);
                if (!m.files.includes(newRel)) m.files.push(newRel);
            }
            FsaContentFs.addStructureFolder(m.structure, destRel);
        }, plans.map((p) => p.asset));
        this.refreshUi();
        Logger.status.success(`Moved ${plans.length} asset(s) → ${destRel || 'Content'}`);
        return true;
    }

    async moveFolder(sourceUiPath, targetUiPath) {
        return this.moveFolders(sourceUiPath ? [sourceUiPath] : [], targetUiPath);
    }

    async moveFolders(sourceUiPaths, targetUiPath) {
        const destRel = FsaContentFs.uiFolderToContentRel(targetUiPath);
        const am = this._am();
        const sources = this._uniqueFolderRels(sourceUiPaths);
        const plans = [];
        for (const fromRel of sources) {
            if (!fromRel) {
                Logger.status.warn('Cannot move the Content root');
                continue;
            }
            const name = fromRel.split('/').pop();
            const toRel = destRel ? `${destRel}/${name}` : name;
            if (toRel === fromRel || fromRel === destRel) continue;
            if (FsaContentFs.isUnderPath(fromRel, destRel) && destRel !== fromRel) {
                Logger.status.error('Cannot move a folder into itself');
                return false;
            }
            if (FsaContentFs.folderExists(am?.contentStructure || {}, toRel)) {
                Logger.status.error(`Folder already exists: ${toRel}`);
                return false;
            }
            plans.push({ fromRel, toRel });
        }
        if (!plans.length) return false;

        const granted = !!FsaStore.getWorkingDirectoryName();
        if (granted) {
            for (const { fromRel, toRel } of plans) {
                const ok = await FsaContentFs.moveDirectory(fromRel, toRel);
                if (!ok) {
                    Logger.status.error(`Could not move folder "${fromRel}"`);
                    return false;
                }
            }
        }

        const remaps = plans.map((p) => ({ from: p.fromRel, to: p.toRel }));
        await this._commitRemaps(remaps, (m) => {
            for (const { fromRel, toRel } of plans) {
                if (!FsaContentFs.moveStructureNode(m.structure, fromRel, toRel)) {
                    FsaContentFs.addStructureFolder(m.structure, toRel);
                }
                m.files = (m.files || []).map((f) => {
                    if (f === fromRel) return toRel;
                    if (String(f).startsWith(`${fromRel}/`)) return toRel + String(f).slice(fromRel.length);
                    return f;
                });
            }
        });
        if (!granted && am?.contentStructure) {
            for (const { fromRel, toRel } of plans) {
                if (!FsaContentFs.moveStructureNode(am.contentStructure, fromRel, toRel)) {
                    FsaContentFs.addStructureFolder(am.contentStructure, toRel);
                }
            }
        }
        this._remapUiFolders(remaps);
        this.refreshUi();
        Logger.status.success(`Moved ${plans.length} folder(s) → ${destRel || 'Content'}`);
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

    _uniqueFolderRels(uiPaths) {
        const rels = [...new Set((uiPaths || []).map((p) => FsaContentFs.uiFolderToContentRel(p)))];
        return rels.filter((rel) => !rels.some((other) => other && other !== rel && FsaContentFs.isUnderPath(other, rel)));
    }

    async _commitRemaps(remaps, mutateManifest, extraPersist = []) {
        const editor = this._editor();
        const dirty = AssetPathRewriter.rewriteAll(editor, remaps);
        const granted = !!FsaStore.getWorkingDirectoryName();
        if (granted) {
            const seen = new Set();
            for (const asset of [...dirty, ...extraPersist]) {
                if (!asset || seen.has(asset)) continue;
                seen.add(asset);
                await FsaContentWriter.saveAsset(asset);
                if (asset.type === 'image') {
                    const rel = FsaStore.toContentRelativePath(asset.path);
                    const src = rel ? await FsaContentFs.resolveImageSrc(rel, asset) : null;
                    if (src) asset.imgSrc = src;
                }
            }
            const am = this._am();
            const manifest = await FsaContentFs.updateManifest(mutateManifest);
            if (manifest && am) am.contentStructure = manifest.structure;
        }
    }

    _remapUiFolders(remaps) {
        const panel = this.assetPanel;
        const sm = panel?.stateManager;
        if (!sm) return;
        const rewrite = (path) => AssetPathRewriter.rewriteString(path, remaps);
        const mapSet = (key) => {
            const raw = sm.get(key);
            if (raw instanceof Set) {
                sm.set(key, new Set(Array.from(raw).map(rewrite)));
                return;
            }
            if (Array.isArray(raw)) sm.set(key, raw.map(rewrite));
        };
        const k = (base) => panel.uiStateKey?.(base) || base;
        mapSet(k('selectedFolders'));
        mapSet(k('activeAssetTabs'));
        const order = sm.get(k('assetTabOrder'));
        if (Array.isArray(order)) sm.set(k('assetTabOrder'), order.map(rewrite));
        const active = sm.get(k('activeAssetTab'));
        if (typeof active === 'string') sm.set(k('activeAssetTab'), rewrite(active));
        const folders = panel.foldersPanel;
        if (folders?.selectedFolders instanceof Set) {
            folders.selectedFolders = new Set(Array.from(folders.selectedFolders).map(rewrite));
        }
        if (folders?.expandedFolders instanceof Set) {
            folders.expandedFolders = new Set(Array.from(folders.expandedFolders).map(rewrite));
        }
    }
}
