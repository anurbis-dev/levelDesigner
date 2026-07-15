/**
 * Persist/restore dock layout: panels.dock.mainTree + panels.dock.floatingWindows.
 * Writes via ConfigManager (localStorage on unload / forceSave); optional StateManager mirror.
 */
import { Logger } from '../../utils/Logger.js';

const KEY_MAIN = 'panels.dock.mainTree';
const KEY_FLOAT = 'panels.dock.floatingWindows';

function cloneJson(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function isLeaf(node) {
    return node && node.type === 'leaf' && typeof node.id === 'string' && node.contentType;
}

function isSplit(node) {
    return node
        && node.type === 'split'
        && (node.direction === 'row' || node.direction === 'column')
        && Array.isArray(node.children)
        && node.children.length === 2
        && typeof node.ratio === 'number';
}

function validateTree(node) {
    if (node === null || node === undefined) return true;
    if (isLeaf(node)) return true;
    if (!isSplit(node)) return false;
    return validateTree(node.children[0]) && validateTree(node.children[1]);
}

function validateFloating(list) {
    if (!Array.isArray(list)) return false;
    return list.every((fw) => (
        fw
        && typeof fw.id === 'string'
        && typeof fw.x === 'number'
        && typeof fw.y === 'number'
        && typeof fw.w === 'number'
        && typeof fw.h === 'number'
        && validateTree(fw.tree)
    ));
}

export class DockPersistence {
    /**
     * @param {object} levelEditor
     */
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this._saveTimer = null;
        this._saveDelayMs = 150;
    }

    _configManager() {
        const ed = this.levelEditor;
        if (!ed) return null;
        return ed.configManager || ed.userPrefs?.configManager || null;
    }

    /**
     * @returns {{ mainTree: object, floatingWindows: object[] }|null}
     */
    load() {
        const cm = this._configManager();
        if (!cm) return null;

        let mainTree;
        let floatingWindows;
        try {
            mainTree = cm.get(KEY_MAIN);
            floatingWindows = cm.get(KEY_FLOAT);
        } catch (err) {
            Logger.ui.warn('DockPersistence.load failed:', err?.message || err);
            return null;
        }

        if (!mainTree && (!floatingWindows || floatingWindows.length === 0)) {
            return null;
        }

        if (mainTree && !validateTree(mainTree)) {
            Logger.ui.warn('DockPersistence: invalid mainTree — using default');
            return null;
        }
        if (floatingWindows && !validateFloating(floatingWindows)) {
            Logger.ui.warn('DockPersistence: invalid floatingWindows — using default');
            return null;
        }

        return {
            mainTree: mainTree ? cloneJson(mainTree) : null,
            floatingWindows: floatingWindows ? cloneJson(floatingWindows) : []
        };
    }

    /**
     * Immediate write into config (+ state mirror). Storage flush is unload/forceSave.
     * @param {{ mainTree: object|null, floatingWindows: object[] }} snapshot
     */
    save(snapshot) {
        if (!snapshot) return;
        const cm = this._configManager();
        if (!cm) return;

        try {
            const main = cloneJson(snapshot.mainTree);
            const floats = cloneJson(snapshot.floatingWindows || []);
            cm.set(KEY_MAIN, main);
            cm.set(KEY_FLOAT, floats);

            const sm = this.levelEditor?.stateManager;
            if (sm) {
                sm.set(KEY_MAIN, main);
                sm.set(KEY_FLOAT, floats);
            }
        } catch (err) {
            Logger.ui.warn('DockPersistence.save failed:', err?.message || err);
        }
    }

    /** Debounced save for drag/resize structure changes. */
    scheduleSave(snapshot) {
        if (this._saveTimer) clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this.save(snapshot);
            const cm = this._configManager();
            if (cm && typeof cm.debouncedSave === 'function') {
                cm.debouncedSave();
            }
        }, this._saveDelayMs);
    }

    /** Flush pending debounced save + force localStorage (tests / unload). */
    flush(snapshot) {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        if (snapshot) this.save(snapshot);
        const cm = this._configManager();
        if (cm && typeof cm.forceSaveAllSettings === 'function') {
            cm.forceSaveAllSettings();
        } else if (cm && typeof cm.saveModifiedConfigs === 'function') {
            cm.saveModifiedConfigs();
        }
    }

    destroy() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        this.levelEditor = null;
    }
}
