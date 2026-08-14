import { Logger } from './Logger.js';

/**
 * File System Access API — persist a user-chosen project folder handle in
 * IndexedDB (PixisEditor fsa-store pattern). Once granted, files can be
 * created/updated inside that folder without a browser save dialog.
 *
 * The folder name lives in localStorage, not project JSON — it is machine-local
 * and must not round-trip through Project.toJSON().
 */
export class FsaStore {
    static DB_NAME = 'levelDesignerFsaHandles';
    static DB_VER = 1;
    static STORE = 'handles';
    static WORKING_DIR_KEY = 'workingDir';
    static PROJECT_DIR_PREFIX = 'project:';
    static DIR_NAME_LS_KEY = 'levelDesignerFsaWorkingDirName';

    static isSupported() {
        return typeof window !== 'undefined'
            && typeof window.showOpenFilePicker === 'function'
            && typeof window.showSaveFilePicker === 'function'
            && typeof window.showDirectoryPicker === 'function';
    }

    static getWorkingDirectoryName() {
        try {
            return localStorage.getItem(FsaStore.DIR_NAME_LS_KEY) || null;
        } catch {
            return null;
        }
    }

    static _setWorkingDirectoryName(name) {
        try {
            if (name) localStorage.setItem(FsaStore.DIR_NAME_LS_KEY, name);
            else localStorage.removeItem(FsaStore.DIR_NAME_LS_KEY);
        } catch {
            /* ignore quota / private mode */
        }
    }

    /**
     * Strip UI/fetch prefixes so a path is relative to the content/ root.
     * `root/assets/ledge/foo.json` → `assets/ledge/foo.json`
     */
    static toContentRelativePath(assetPath) {
        if (!assetPath || typeof assetPath !== 'string') return null;
        let path = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');
        if (path.startsWith('root/')) path = path.slice(5);
        else if (path === 'root') return null;
        if (path.startsWith('./content/')) path = path.slice(10);
        else if (path.startsWith('content/')) path = path.slice(8);
        path = path.replace(/^\/+/, '');
        return path || null;
    }

    /**
     * Level files live under content/maps/ unless the name already has a path.
     */
    static toLevelRelativePath(fileName) {
        const rel = FsaStore.toContentRelativePath(fileName) || String(fileName || '').replace(/\\/g, '/');
        if (!rel) return null;
        if (rel.includes('/')) return rel;
        return `maps/${rel}`;
    }

    static async verifyPermission(handle, mode) {
        if (!handle) return false;
        try {
            const opts = { mode };
            if ((await handle.queryPermission(opts)) === 'granted') return true;
            return (await handle.requestPermission(opts)) === 'granted';
        } catch {
            return false;
        }
    }

    static async getWorkingDirectoryHandle() {
        return FsaStore._getHandle(FsaStore.WORKING_DIR_KEY);
    }

    /** IDB key for a project's bound folder (`My Game.json` → `project:My Game.json`). */
    static projectDirKey(fileName) {
        const name = String(fileName || '').replace(/\\/g, '/').split('/').pop();
        return name ? `${FsaStore.PROJECT_DIR_PREFIX}${name}` : null;
    }

    static async bindProjectDirectory(fileName, handle) {
        const key = FsaStore.projectDirKey(fileName);
        if (!key || !handle || !FsaStore.isSupported()) return false;
        try {
            await FsaStore._putHandle(key, handle);
            return true;
        } catch {
            return false;
        }
    }

    static async unbindProjectDirectory(fileName) {
        const key = FsaStore.projectDirKey(fileName);
        if (!key) return;
        await FsaStore._deleteHandle(key);
    }

    static async getProjectDirectoryHandle(fileName) {
        const key = FsaStore.projectDirKey(fileName);
        return key ? FsaStore._getHandle(key) : null;
    }

    /**
     * Make `handle` the active working directory (name + workingDir key).
     * @returns {Promise<boolean>}
     */
    static async activateDirectoryHandle(handle) {
        if (!handle || !(await FsaStore.verifyPermission(handle, 'readwrite'))) return false;
        await FsaStore._putHandle(FsaStore.WORKING_DIR_KEY, handle);
        FsaStore._setWorkingDirectoryName(handle.name || null);
        return true;
    }

    /**
     * Restore the folder last bound to this project file. Null if none / no permission.
     */
    static async restoreProjectDirectory(fileName) {
        const handle = await FsaStore.getProjectDirectoryHandle(fileName);
        if (!handle) return null;
        if (!(await FsaStore.activateDirectoryHandle(handle))) return null;
        Logger.file.info(`FsaStore: restored project folder (${handle.name}) for ${fileName}`);
        return handle;
    }

    /**
     * Prompt once for a project folder (readwrite). Persists the handle.
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    static async pickWorkingDirectory() {
        if (!FsaStore.isSupported()) return null;
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            if (!(await FsaStore.verifyPermission(handle, 'readwrite'))) return null;
            await FsaStore._putHandle(FsaStore.WORKING_DIR_KEY, handle);
            FsaStore._setWorkingDirectoryName(handle.name || null);
            Logger.file.info(`FsaStore: project folder set (${handle.name})`);
            Logger.status.success(`Project folder set: ${handle.name}`);
            return handle;
        } catch (error) {
            if (error?.name === 'AbortError') return null;
            Logger.file.warn('FsaStore: pickWorkingDirectory failed', error);
            return null;
        }
    }

    static async clearWorkingDirectory() {
        await FsaStore._deleteHandle(FsaStore.WORKING_DIR_KEY);
        FsaStore._setWorkingDirectoryName(null);
        Logger.file.info('FsaStore: project folder cleared');
        Logger.status.info('Project folder cleared');
    }

    /**
     * If the picked folder contains a `content/` subdir, that is the content root
     * (user picked the repo/project root). Otherwise the picked folder itself is.
     */
    static async getContentDirectoryHandle() {
        const root = await FsaStore.getWorkingDirectoryHandle();
        if (!root || !(await FsaStore.verifyPermission(root, 'readwrite'))) return null;
        try {
            return await root.getDirectoryHandle('content', { create: false });
        } catch {
            return root;
        }
    }

    /**
     * Write text/JSON/Blob under the picked folder (not necessarily content/).
     * @returns {Promise<boolean>}
     */
    static async writeWorkingDirFile(relativePath, data) {
        const root = await FsaStore.getWorkingDirectoryHandle();
        if (!root || !(await FsaStore.verifyPermission(root, 'readwrite'))) return false;
        const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!rel) return false;
        try {
            await FsaStore._writeFile(root, rel, data);
            return true;
        } catch (error) {
            Logger.file.warn(`FsaStore: writeWorkingDirFile failed (${rel})`, error);
            return false;
        }
    }

    /**
     * Write under the resolved content/ root.
     * @returns {Promise<boolean>}
     */
    static async writeContentFile(relativePath, data) {
        const rel = FsaStore.toContentRelativePath(relativePath);
        if (!rel) return false;
        const contentDir = await FsaStore.getContentDirectoryHandle();
        if (!contentDir) return false;
        try {
            await FsaStore._writeFile(contentDir, rel, data);
            return true;
        } catch (error) {
            Logger.file.warn(`FsaStore: writeContentFile failed (${rel})`, error);
            return false;
        }
    }

    /**
     * Add `relativePath` to content/manifest.json files[] + structure (create if missing).
     * @returns {Promise<boolean>}
     */
    static async ensureManifestEntry(relativePath, assetManager = null) {
        const rel = FsaStore.toContentRelativePath(relativePath);
        if (!rel) return false;
        const contentDir = await FsaStore.getContentDirectoryHandle();
        if (!contentDir) return false;

        let manifest = {
            version: '1.0.0',
            generated: new Date().toISOString().slice(0, 10),
            structure: {},
            files: []
        };
        try {
            const handle = await contentDir.getFileHandle('manifest.json', { create: false });
            const text = await (await handle.getFile()).text();
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed === 'object') manifest = parsed;
        } catch {
            /* new manifest */
        }

        if (!Array.isArray(manifest.files)) manifest.files = [];
        if (!manifest.structure || typeof manifest.structure !== 'object') manifest.structure = {};

        if (!manifest.files.includes(rel)) manifest.files.push(rel);
        FsaStore._ensureStructurePath(manifest.structure, rel);

        try {
            await FsaStore._writeFile(contentDir, 'manifest.json', manifest);
        } catch (error) {
            Logger.file.warn('FsaStore: failed to update manifest.json', error);
            return false;
        }

        if (assetManager) assetManager.contentStructure = manifest.structure;
        return true;
    }

    static _ensureStructurePath(structure, relativePath) {
        const parts = relativePath.split('/').filter(Boolean);
        parts.pop();
        let node = structure;
        for (const part of parts) {
            if (!node[part] || typeof node[part] !== 'object') node[part] = {};
            node = node[part];
        }
    }

    static async _writeFile(dirHandle, relativePath, data) {
        const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
        const fileName = parts.pop();
        if (!fileName) throw new Error('Empty file name');
        let dir = dirHandle;
        for (const part of parts) {
            dir = await dir.getDirectoryHandle(part, { create: true });
        }
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        try {
            if (typeof data === 'string' || data instanceof Blob || data instanceof ArrayBuffer) {
                await writable.write(data);
            } else {
                await writable.write(JSON.stringify(data, null, 2));
            }
        } finally {
            await writable.close();
        }
    }

    static _openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(FsaStore.DB_NAME, FsaStore.DB_VER);
            req.onerror = () => reject(req.error || new Error('IDB open failed'));
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(FsaStore.STORE)) db.createObjectStore(FsaStore.STORE);
            };
            req.onsuccess = () => resolve(req.result);
        });
    }

    static _idbReq(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    static async _getHandle(key) {
        if (!key || !FsaStore.isSupported()) return null;
        try {
            const db = await FsaStore._openDb();
            const tx = db.transaction(FsaStore.STORE, 'readonly');
            const handle = await FsaStore._idbReq(tx.objectStore(FsaStore.STORE).get(key));
            db.close();
            return handle || null;
        } catch (error) {
            Logger.file.warn(`FsaStore: failed to read handle (${key})`, error);
            return null;
        }
    }

    static async _putHandle(key, handle) {
        const db = await FsaStore._openDb();
        const tx = db.transaction(FsaStore.STORE, 'readwrite');
        tx.objectStore(FsaStore.STORE).put(handle, key);
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    static async _deleteHandle(key) {
        if (!key) return;
        try {
            const db = await FsaStore._openDb();
            const tx = db.transaction(FsaStore.STORE, 'readwrite');
            tx.objectStore(FsaStore.STORE).delete(key);
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
            db.close();
        } catch {
            /* ignore */
        }
    }
}
