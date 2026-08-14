import { Logger } from './Logger.js';
import { FsaStore } from './FsaStore.js';

/**
 * Directory/file ops on the granted project content root (create default
 * layout, scan tree, mkdir, delete, move). Complements FsaStore writes.
 */
export class FsaContentFs {
    static DEFAULT_DIRS = ['assets', 'maps', 'graphs'];

    static uiFolderToContentRel(folderPath) {
        if (!folderPath || folderPath === 'root') return '';
        return String(folderPath).replace(/\\/g, '/').replace(/^root\//, '');
    }

    static contentRelToUiFolder(rel) {
        const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        return clean ? `root/${clean}` : 'root';
    }

    static sanitizeFolderName(name) {
        return String(name || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/g, '').trim();
    }

    static addStructureFolder(structure, folderRel) {
        const parts = String(folderRel || '').split('/').filter(Boolean);
        let node = structure;
        for (const part of parts) {
            if (!node[part] || typeof node[part] !== 'object') node[part] = {};
            node = node[part];
        }
    }

    static removeStructureNode(structure, folderRel) {
        const parts = String(folderRel || '').split('/').filter(Boolean);
        if (!parts.length) return false;
        let node = structure;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node[parts[i]] || typeof node[parts[i]] !== 'object') return false;
            node = node[parts[i]];
        }
        if (!(parts[parts.length - 1] in node)) return false;
        delete node[parts[parts.length - 1]];
        return true;
    }

    static flattenFolderRels(structure, prefix = '') {
        const out = [];
        for (const [name, child] of Object.entries(structure || {})) {
            const rel = prefix ? `${prefix}/${name}` : name;
            out.push(rel);
            if (child && typeof child === 'object') {
                out.push(...FsaContentFs.flattenFolderRels(child, rel));
            }
        }
        return out;
    }

    /** True if `childRel` is `parentRel` or lives under it. Empty parent = content root. */
    static isUnderPath(parentRel, childRel) {
        const parent = String(parentRel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        const child = String(childRel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!parent) return true;
        return child === parent || child.startsWith(`${parent}/`);
    }

    static folderExists(structure, folderRel) {
        const parts = String(folderRel || '').split('/').filter(Boolean);
        if (!parts.length) return true;
        let node = structure;
        for (const part of parts) {
            if (!node || typeof node !== 'object' || !(part in node)) return false;
            node = node[part];
        }
        return true;
    }

    /** Relocate a structure subtree (keeps children). */
    static moveStructureNode(structure, fromRel, toRel) {
        const fromParts = String(fromRel || '').split('/').filter(Boolean);
        const toParts = String(toRel || '').split('/').filter(Boolean);
        if (!fromParts.length || !toParts.length) return false;
        let srcParent = structure;
        for (let i = 0; i < fromParts.length - 1; i++) {
            if (!srcParent?.[fromParts[i]] || typeof srcParent[fromParts[i]] !== 'object') return false;
            srcParent = srcParent[fromParts[i]];
        }
        const name = fromParts[fromParts.length - 1];
        if (!(name in srcParent)) return false;
        const subtree = srcParent[name];
        delete srcParent[name];
        FsaContentFs.addStructureFolder(structure, toParts.slice(0, -1).join('/'));
        let destParent = structure;
        for (let i = 0; i < toParts.length - 1; i++) {
            destParent = destParent[toParts[i]];
        }
        destParent[toParts[toParts.length - 1]] = subtree && typeof subtree === 'object' ? subtree : {};
        return true;
    }

    static async looksLikeContentRoot(handle) {
        if (!handle) return false;
        try {
            await handle.getFileHandle('manifest.json', { create: false });
            return true;
        } catch { /* no manifest */ }
        for (const name of ['assets', 'maps', 'graphs']) {
            try {
                await handle.getDirectoryHandle(name, { create: false });
                return true;
            } catch { /* missing */ }
        }
        return false;
    }

    /**
     * Create content/ (if the pick is a project root) plus default subdirs + manifest.
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    static async ensureDefaultContentLayout() {
        const root = await FsaStore.getWorkingDirectoryHandle();
        if (!root || !(await FsaStore.verifyPermission(root, 'readwrite'))) return null;

        let content = root;
        try {
            content = await root.getDirectoryHandle('content', { create: false });
        } catch {
            if (!(await FsaContentFs.looksLikeContentRoot(root))) {
                content = await root.getDirectoryHandle('content', { create: true });
            }
        }

        for (const name of FsaContentFs.DEFAULT_DIRS) {
            await content.getDirectoryHandle(name, { create: true });
        }

        const manifest = await FsaContentFs._readOrCreateManifest(content);
        for (const name of FsaContentFs.DEFAULT_DIRS) {
            if (!manifest.structure[name] || typeof manifest.structure[name] !== 'object') {
                manifest.structure[name] = {};
            }
        }
        await FsaContentFs._writeManifestHandle(content, manifest);
        Logger.file.info('FsaContentFs: default content layout ready');
        return content;
    }

    static async scanContentTree() {
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return null;
        const structure = {};
        const files = [];
        await FsaContentFs._walk(content, '', structure, files);
        for (const name of FsaContentFs.DEFAULT_DIRS) {
            if (!structure[name]) structure[name] = {};
        }
        return { structure, files };
    }

    static async createDirectory(folderRel) {
        const rel = String(folderRel || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
        if (!rel) return false;
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return false;
        try {
            let dir = content;
            for (const part of rel.split('/').filter(Boolean)) {
                dir = await dir.getDirectoryHandle(part, { create: true });
            }
            await FsaContentFs.updateManifest((manifest) => {
                FsaContentFs.addStructureFolder(manifest.structure, rel);
            });
            return true;
        } catch (error) {
            Logger.file.warn(`FsaContentFs: createDirectory failed (${rel})`, error);
            return false;
        }
    }

    static async deletePath(relPath) {
        const rel = FsaStore.toContentRelativePath(relPath) || String(relPath || '').replace(/\\/g, '/');
        if (!rel) return false;
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return false;
        try {
            const parts = rel.split('/').filter(Boolean);
            const name = parts.pop();
            let dir = content;
            for (const part of parts) {
                dir = await dir.getDirectoryHandle(part, { create: false });
            }
            await dir.removeEntry(name, { recursive: true });
            return true;
        } catch (error) {
            Logger.file.warn(`FsaContentFs: deletePath failed (${rel})`, error);
            return false;
        }
    }

    static async moveFile(fromRel, toRel) {
        const from = FsaStore.toContentRelativePath(fromRel);
        const to = FsaStore.toContentRelativePath(toRel);
        if (!from || !to || from === to) return false;
        const blob = await FsaContentFs.readBlob(from);
        if (!blob) return false;
        const wrote = await FsaStore.writeContentFile(to, blob);
        if (!wrote) return false;
        await FsaContentFs.deletePath(from);
        return true;
    }

    /**
     * Move a directory tree. Native handle.move when available, else copy+delete.
     */
    static async moveDirectory(fromRel, toRel) {
        const from = FsaStore.toContentRelativePath(fromRel) || String(fromRel || '').replace(/\\/g, '/');
        const to = FsaStore.toContentRelativePath(toRel) || String(toRel || '').replace(/\\/g, '/');
        if (!from || !to || from === to) return false;
        if (FsaContentFs.isUnderPath(from, to) && to !== from) return false;
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return false;
        try {
            const { handle, parent } = await FsaContentFs._getChildHandle(content, from);
            const destParts = to.split('/').filter(Boolean);
            const destName = destParts.pop();
            let destParent = content;
            for (const part of destParts) {
                destParent = await destParent.getDirectoryHandle(part, { create: true });
            }
            if (handle && typeof handle.move === 'function') {
                await handle.move(destParent, destName);
                return true;
            }
            if (handle?.kind === 'directory' && destParent !== parent) {
                /* fall through to copy */
            }
        } catch (error) {
            Logger.file.debug?.(`FsaContentFs: native move unavailable (${from})`, error);
        }
        try {
            await FsaContentFs.createDirectory(to);
            await FsaContentFs._copyTree(content, from, to);
            await FsaContentFs.deletePath(from);
            return true;
        } catch (error) {
            Logger.file.warn(`FsaContentFs: moveDirectory failed (${from} → ${to})`, error);
            return false;
        }
    }

    static async readText(relPath) {
        const rel = FsaStore.toContentRelativePath(relPath);
        if (!rel) return null;
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return null;
        try {
            const handle = await FsaContentFs._getFileHandle(content, rel, false);
            return await (await handle.getFile()).text();
        } catch {
            return null;
        }
    }

    static async readBlob(relPath) {
        const rel = FsaStore.toContentRelativePath(relPath);
        if (!rel) return null;
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return null;
        try {
            const handle = await FsaContentFs._getFileHandle(content, rel, false);
            return await (await handle.getFile());
        } catch {
            return null;
        }
    }

    /**
     * Resolve imgSrc for an asset JSON: FSA blob URL, else ./content/ fallback.
     */
    static async resolveImageSrc(jsonRel, assetData) {
        let raw = assetData?.imgSrc ?? assetData?.image ?? null;
        if (Array.isArray(raw)) raw = raw.find((x) => typeof x === 'string' && x.trim()) || null;
        if (!raw || typeof raw !== 'string') return null;
        if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
        const base = raw.split('?')[0].replace(/\\/g, '/').split('/').pop();
        const dir = String(jsonRel || '').split('/').slice(0, -1).join('/');
        const pngRel = dir ? `${dir}/${base}` : base;
        const file = await FsaContentFs.readBlob(pngRel);
        if (file) return URL.createObjectURL(file);
        return `./content/${pngRel}`;
    }

    static async updateManifest(mutator) {
        const content = await FsaStore.getContentDirectoryHandle();
        if (!content) return false;
        const manifest = await FsaContentFs._readOrCreateManifest(content);
        mutator(manifest);
        await FsaContentFs._writeManifestHandle(content, manifest);
        return manifest;
    }

    static async _walk(dirHandle, prefix, structure, files) {
        for await (const [name, handle] of dirHandle.entries()) {
            if (!name || name.startsWith('.')) continue;
            const rel = prefix ? `${prefix}/${name}` : name;
            if (handle.kind === 'directory') {
                FsaContentFs.addStructureFolder(structure, rel);
                await FsaContentFs._walk(handle, rel, structure, files);
            } else if (handle.kind === 'file' && name.endsWith('.json') && name !== 'manifest.json') {
                try {
                    const text = await (await handle.getFile()).text();
                    files.push({ relPath: rel, json: JSON.parse(text) });
                } catch (error) {
                    Logger.file.warn(`FsaContentFs: skip ${rel}`, error);
                }
            }
        }
    }

    static async _getFileHandle(root, rel, create) {
        const parts = rel.split('/').filter(Boolean);
        const fileName = parts.pop();
        let dir = root;
        for (const part of parts) {
            dir = await dir.getDirectoryHandle(part, { create });
        }
        return dir.getFileHandle(fileName, { create });
    }

    static async _getChildHandle(root, rel) {
        const parts = String(rel || '').split('/').filter(Boolean);
        const name = parts.pop();
        let parent = root;
        for (const part of parts) {
            parent = await parent.getDirectoryHandle(part, { create: false });
        }
        try {
            return { parent, handle: await parent.getDirectoryHandle(name, { create: false }) };
        } catch {
            return { parent, handle: await parent.getFileHandle(name, { create: false }) };
        }
    }

    static async _copyTree(root, fromRel, toRel) {
        const { handle } = await FsaContentFs._getChildHandle(root, fromRel);
        if (!handle || handle.kind !== 'directory') {
            const blob = await FsaContentFs.readBlob(fromRel);
            if (blob) await FsaStore.writeContentFile(toRel, blob);
            return;
        }
        for await (const [name, child] of handle.entries()) {
            if (!name || name.startsWith('.')) continue;
            const src = `${fromRel}/${name}`;
            const dest = `${toRel}/${name}`;
            if (child.kind === 'directory') {
                await FsaContentFs.createDirectory(dest);
                await FsaContentFs._copyTree(root, src, dest);
            } else {
                const file = await child.getFile();
                await FsaStore.writeContentFile(dest, file);
            }
        }
    }

    static async _readOrCreateManifest(contentDir) {
        const empty = {
            version: '1.0.0',
            generated: new Date().toISOString().slice(0, 10),
            structure: {},
            files: []
        };
        try {
            const handle = await contentDir.getFileHandle('manifest.json', { create: false });
            const parsed = JSON.parse(await (await handle.getFile()).text());
            if (!parsed || typeof parsed !== 'object') return empty;
            if (!Array.isArray(parsed.files)) parsed.files = [];
            if (!parsed.structure || typeof parsed.structure !== 'object') parsed.structure = {};
            return parsed;
        } catch {
            return empty;
        }
    }

    static async _writeManifestHandle(contentDir, manifest) {
        const handle = await contentDir.getFileHandle('manifest.json', { create: true });
        const writable = await handle.createWritable();
        try {
            await writable.write(JSON.stringify(manifest, null, 2));
        } finally {
            await writable.close();
        }
    }
}
