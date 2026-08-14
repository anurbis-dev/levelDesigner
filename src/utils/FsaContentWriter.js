import { Logger } from './Logger.js';
import { FsaStore } from './FsaStore.js';
import { assetToPersistable, isImageAsset, getImageDiskSrc } from '../ui/asset-editor/AssetVisualMigrate.js';

/**
 * Write content assets into the granted project folder (no browser save dialog).
 */
export class FsaContentWriter {
    /**
     * Disk JSON matching existing content/*.json (imgSrc is a sibling filename).
     */
    static assetToDiskJson(asset) {
        const json = assetToPersistable(asset);
        delete json.path;
        if (json.imgSrc) {
            if (json.imgSrc.startsWith('data:')) delete json.imgSrc;
            else json.imgSrc = FsaContentWriter._basename(json.imgSrc);
        }
        return json;
    }

    /**
     * @param {object} asset
     * @param {{updateManifest?: boolean, assetManager?: object}} [opts]
     * @returns {Promise<string|null>} content-relative path written, or null
     */
    static async saveAsset(asset, opts = {}) {
        if (!asset) return null;
        const rel = FsaStore.toContentRelativePath(asset.path);
        if (!rel) {
            Logger.file.warn('FsaContentWriter: asset has no content-relative path');
            return null;
        }

        const json = FsaContentWriter.assetToDiskJson(asset);
        const pngBlob = await FsaContentWriter._pngBlobIfNeeded(asset);
        if (pngBlob) {
            const pngName = FsaContentWriter._pngFileName(asset, rel);
            json.imgSrc = pngName;
            const pngRel = FsaContentWriter._siblingPath(rel, pngName);
            const pngOk = await FsaStore.writeContentFile(pngRel, pngBlob);
            if (!pngOk) return null;
        }

        const ok = await FsaStore.writeContentFile(rel, json);
        if (!ok) return null;

        if (opts.updateManifest) {
            await FsaStore.ensureManifestEntry(rel, opts.assetManager || null);
        }

        asset.path = rel;
        if (asset.properties) {
            asset.properties.isTemporary = false;
            asset.properties.placeholder = false;
            asset.properties.lastSaved = Date.now();
            asset.properties.hasUnsavedChanges = false;
        }
        return rel;
    }

    /**
     * Persist a newly created placeholder. No-op (returns null) if no folder granted.
     */
    static async saveNewAsset(asset, assetManager) {
        return FsaContentWriter.saveAsset(asset, { updateManifest: true, assetManager });
    }

    static _basename(src) {
        if (!src || typeof src !== 'string') return src;
        const noQuery = src.split('?')[0];
        const parts = noQuery.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1] || src;
    }

    static _pngFileName(asset, jsonRel) {
        const raw = getImageDiskSrc(asset) || '';
        if (raw && !raw.startsWith('data:')) {
            const fromSrc = FsaContentWriter._basename(raw);
            if (fromSrc.toLowerCase().endsWith('.png')) return fromSrc;
        }
        const base = jsonRel.split('/').pop().replace(/\.json$/i, '');
        return `${base}.png`;
    }

    static _siblingPath(jsonRel, fileName) {
        const parts = jsonRel.split('/');
        parts[parts.length - 1] = fileName;
        return parts.join('/');
    }

    static async _pngBlobIfNeeded(asset) {
        if (!isImageAsset(asset)) return null;
        const src = getImageDiskSrc(asset);
        if (!src || !src.startsWith('data:')) return null;
        try {
            const response = await fetch(src);
            return await response.blob();
        } catch (error) {
            Logger.file.warn('FsaContentWriter: failed to convert data URL to PNG blob', error);
            return null;
        }
    }
}
