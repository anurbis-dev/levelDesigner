import { Logger } from '../utils/Logger.js';
import { BaseManager } from './BaseManager.js';

/**
 * MRU list of recently opened/saved levels and projects (U3).
 * Browser has no stable file path — stores a JSON snapshot (when small enough)
 * in userPrefs (`editor.recentFiles`) so Open Recent can reload without a picker.
 */
export class RecentFilesManager extends BaseManager {
    static MAX_ENTRIES = 10;
    /** Skip caching payload above this JSON length (~1.5 MB) to protect localStorage. */
    static MAX_JSON_CHARS = 1_500_000;

    constructor(editor) {
        super();
        this.editor = editor;
    }

    /**
     * @returns {Array<{id:string, kind:'level'|'project', name:string, ts:number, data?:Object}>}
     */
    list() {
        const list = this.editor.userPrefs?.get('recentFiles');
        return Array.isArray(list) ? list : [];
    }

    /**
     * Record a successful open/save. Drops older same kind+name, caps length.
     * @param {'level'|'project'} kind
     * @param {string} name
     * @param {Object} data - serializable level or project JSON
     */
    remember(kind, name, data) {
        if (!name || !data || (kind !== 'level' && kind !== 'project')) return;

        let payload = null;
        try {
            const raw = JSON.stringify(data);
            if (raw.length <= RecentFilesManager.MAX_JSON_CHARS) {
                payload = data;
            } else {
                Logger.file.warn(`RecentFiles: skip payload for "${name}" (${raw.length} chars > limit)`);
            }
        } catch (error) {
            Logger.file.warn(`RecentFiles: could not serialize "${name}":`, error?.message);
        }

        if (!payload) return;

        const id = `${kind}:${name}`;
        const next = this.list().filter(e => e.id !== id);
        next.unshift({ id, kind, name, ts: Date.now(), data: payload });
        this._save(next.slice(0, RecentFilesManager.MAX_ENTRIES));
    }

    clear() {
        this._save([]);
        Logger.status.info('Recent files cleared');
    }

    /**
     * Open a recent entry from cached JSON (or report if missing).
     * @param {string} id
     */
    async open(id) {
        const entry = this.list().find(e => e.id === id);
        if (!entry) {
            Logger.status.warn('Recent entry not found');
            return;
        }
        if (!entry.data) {
            await alert(
                `No cached content for "${entry.name}".\n` +
                `Use File → Open ${entry.kind === 'project' ? 'Project' : 'Level'}… to load it again.`
            );
            return;
        }

        if (entry.kind === 'project') {
            await this.editor.projectFileOperations.openProjectFromData(entry.data, entry.name);
        } else {
            await this.editor.levelFileOperations.openLevelFromData(entry.data, entry.name);
        }
    }

    /**
     * @private
     * @param {Array} list
     */
    _save(list) {
        if (!this.editor.userPrefs) return;
        this.editor.userPrefs.set('recentFiles', list);
        const cm = this.editor.configManager;
        if (cm && typeof cm.debouncedSave === 'function') {
            cm.debouncedSave();
        }
    }

    destroy() {
        this.editor = null;
    }
}
