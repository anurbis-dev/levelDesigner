import { Logger } from '../utils/Logger.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';
import { UniversalDialog } from './UniversalDialog.js';

/**
 * Context-menu/click actions for AssetPanel — context menu wiring, item click/double-click,
 * asset open / rename / duplicate / delete.
 * Extracted from AssetPanel.js — context menus / open / explorer.
 * Note: onSaveAsset/onSaveAssetChanges/onShowInExplorer and the panel-context-menu callbacks
 * (reset size, toggle view, refresh, settings, select/deselect all) call back into AssetPanel
 * directly — that logic isn't part of this phase's method list and stays where it is.
 */
export class AssetItemActionsController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    _assetManager() {
        return this.assetPanel.assetManager || this.assetPanel.levelEditor?.assetManager;
    }

    _notifyAssetsChanged() {
        const sm = this.assetPanel.stateManager;
        if (!sm) return;
        sm.set('assetsChanged', Date.now());
        sm.notify('assetsChanged');
    }

    _selectedAssetIds() {
        const raw = this.assetPanel.stateManager.get(
            this.assetPanel.uiStateKey('selectedAssets')
        );
        if (raw instanceof Set) return raw;
        if (Array.isArray(raw)) return new Set(raw);
        return new Set();
    }

    _uniqueAssetName(baseName) {
        const am = this._assetManager();
        const names = new Set((am?.getAllAssets() || []).map((a) => a.name));
        if (!names.has(baseName)) return baseName;
        let i = 2;
        while (names.has(`${baseName} ${i}`)) i += 1;
        return `${baseName} ${i}`;
    }

    /**
     * Setup context menus for assets and panel
     */
    setupContextMenus() {
        const assetPanel = this.assetPanel;

        // Asset context menu
        assetPanel.assetContextMenu = new AssetContextMenu(assetPanel, {
            stateManager: assetPanel.stateManager, // Pass StateManager for marquee check
            onOpenEditor: (asset) => this.handleAssetOpenEditor(asset),
            onRename: (asset) => this.handleAssetRename(asset),
            onDuplicate: (asset) => this.handleAssetDuplicate(asset),
            onSaveAsset: (asset) => assetPanel.handleAssetSave(asset),
            onSaveAssetChanges: (asset) => assetPanel.handleAssetSaveChanges(asset),
            onShowInExplorer: (asset) => assetPanel.handleAssetShowInExplorer(asset),
            onDelete: (asset) => this.handleAssetDelete(asset),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Panel context menu
        assetPanel.panelContextMenu = new AssetPanelContextMenu(assetPanel, {
            stateManager: assetPanel.stateManager, // Pass StateManager for marquee check
            onResetSize: () => assetPanel.handleResetSize(),
            onToggleGrid: () => assetPanel.handleToggleGrid(),
            onToggleList: () => assetPanel.handleToggleList(),
            onToggleDetails: () => assetPanel.handleToggleDetails(),
            onRefresh: () => assetPanel.handleRefresh(),
            onSettings: () => assetPanel.handleSettings(),
            onSelectAll: () => assetPanel.selectionController.handleSelectAll(),
            onDeselectAll: () => assetPanel.selectionController.handleDeselectAll(),
            disableGlobalHandlers: true // Disable global handlers since we use delegated events
        });

        // Complete deferred initialization for context menus
        if (assetPanel.assetContextMenu && assetPanel.assetContextMenu.completeDeferredInit) {
            assetPanel.assetContextMenu.completeDeferredInit();
        }
        if (assetPanel.panelContextMenu && assetPanel.panelContextMenu.completeDeferredInit) {
            assetPanel.panelContextMenu.completeDeferredInit();
        }

        // Register context menus with ContextMenuManager for global resize handling
        if (assetPanel.levelEditor && assetPanel.levelEditor.contextMenuManager) {
            if (assetPanel.assetContextMenu) {
                assetPanel.levelEditor.contextMenuManager.registerMenu('asset', assetPanel.assetContextMenu);
            }
            if (assetPanel.panelContextMenu) {
                assetPanel.levelEditor.contextMenuManager.registerMenu('assetPanel', assetPanel.panelContextMenu);
            }
            // AssetTabContextMenu handles events through delegation, no global registration needed
        }
    }

    /**
     * Handle asset open editor
     * @param {Object} asset - The asset to open in editor
     */
    handleAssetOpenEditor(asset) {
        Logger.ui.debug('Opening asset editor for:', asset.name);
        // TODO: Implement asset editor functionality
    }

    /**
     * Handle asset rename (in-memory + dirty flag; file rename via Save).
     * @param {Object} asset
     */
    async handleAssetRename(asset) {
        if (!asset) return;
        const am = this._assetManager();
        if (!am) {
            Logger.ui.warn('Rename: AssetManager unavailable');
            return;
        }

        const entered = await UniversalDialog.prompt('Rename asset', asset.name);
        if (entered == null) return;
        const newName = String(entered).trim();
        if (!newName || newName === asset.name) return;

        const ok = am.updateAsset(asset.id, { name: newName });
        if (!ok) {
            Logger.ui.warn('Rename failed:', asset.id);
            return;
        }
        this._notifyAssetsChanged();
        Logger.ui.info(`Renamed asset → "${newName}"`);
    }

    /**
     * Handle asset duplicate — new id, unique name, marked temporary/unsaved.
     * @param {Object} asset
     */
    handleAssetDuplicate(asset) {
        if (!asset) return;
        const am = this._assetManager();
        if (!am) {
            Logger.ui.warn('Duplicate: AssetManager unavailable');
            return;
        }

        const data = asset.toJSON ? asset.toJSON() : { ...asset };
        delete data.id;
        const copyName = this._uniqueAssetName(`${asset.name} Copy`);
        data.name = copyName;

        const dir = data.path && data.path.includes('/')
            ? data.path.slice(0, data.path.lastIndexOf('/'))
            : (data.category || 'Misc');
        data.path = `${dir}/${copyName.replace(/[/\\]/g, '-')}.json`;

        data.properties = {
            ...(data.properties || {}),
            isTemporary: true,
            hasUnsavedChanges: true,
            lastModified: Date.now(),
            duplicatedFrom: asset.id
        };
        if (Array.isArray(data.tags)) {
            data.tags = [...data.tags, 'duplicated'];
        } else {
            data.tags = ['duplicated'];
        }
        if (Array.isArray(data.components)) {
            data.components = data.components.map((c) => ({
                ...c,
                properties: { ...(c.properties || {}) }
            }));
        }

        const clone = am.addExternalAsset(data);
        const selKey = this.assetPanel.uiStateKey('selectedAssets');
        this.assetPanel.stateManager.set(selKey, new Set([clone.id]));
        this._notifyAssetsChanged();
        Logger.ui.info(`Duplicated asset: ${asset.name} → ${clone.name}`);
    }

    /**
     * Handle asset delete (+ multi if target is in selection). Confirm; in-memory only.
     * @param {Object} asset
     */
    async handleAssetDelete(asset) {
        if (!asset) return;
        const am = this._assetManager();
        if (!am) {
            Logger.ui.warn('Delete: AssetManager unavailable');
            return;
        }

        const selected = this._selectedAssetIds();
        const ids = (selected.has(asset.id) && selected.size > 1)
            ? Array.from(selected)
            : [asset.id];

        const message = ids.length > 1
            ? `Delete ${ids.length} assets from the library? This cannot be undone (in-memory; files on disk are not removed).`
            : `Delete asset "${asset.name}" from the library? This cannot be undone (in-memory; files on disk are not removed).`;

        const confirmed = await confirm(message);
        if (!confirmed) return;

        let removed = 0;
        for (const id of ids) {
            if (am.removeAsset(id)) removed += 1;
        }

        const nextSel = new Set([...selected].filter((id) => !ids.includes(id)));
        this.assetPanel.stateManager.set(
            this.assetPanel.uiStateKey('selectedAssets'),
            nextSel
        );

        // Level is not dirty from library edit, but surface library change for UI.
        this.assetPanel.stateManager.set('assetsLibraryDirty', true);
        this._notifyAssetsChanged();
        Logger.ui.info(`Deleted ${removed} asset(s) from library`);
    }

    /**
     * Handle item double click
     * @param {Event} e - Double click event
     * @param {Object} asset - Asset that was double clicked
     */
    handleItemDoubleClick(e, asset) {
        const assetPanel = this.assetPanel;
        e.preventDefault();
        e.stopPropagation();

        if (!asset) {
            Logger.ui.warn('Cannot handle double click: no asset provided');
            return;
        }

        // Open Asset Properties Panel
        if (assetPanel.levelEditor && assetPanel.levelEditor.showActorPropertiesPanel) {
            assetPanel.levelEditor.showActorPropertiesPanel(asset);
            Logger.ui.info(`Double-clicked asset: ${asset.name}, opening Asset Properties Panel`);
        } else {
            Logger.ui.warn('LevelEditor or showActorPropertiesPanel method not available');
        }
    }

    // Selection / dblclick live on AssetViewRenderer (mousedown + dblclick).
    // Dead panel-click detail===2 path removed after dock multi-instance.
}
