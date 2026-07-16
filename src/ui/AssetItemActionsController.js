import { Logger } from '../utils/Logger.js';
import { AssetContextMenu } from './AssetContextMenu.js';
import { AssetPanelContextMenu } from './AssetPanelContextMenu.js';

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
        /** @type {string|null} asset id while inline rename input is open */
        this._renamingAssetId = null;
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
     * Handle asset rename — inline name field (Outliner/Layers style), not a dialog.
     * @param {Object} asset
     */
    handleAssetRename(asset) {
        this.startInlineRename(asset);
    }

    /**
     * Activate inline rename on the asset row/thumbnail name in this panel instance.
     * @param {Object} asset
     */
    startInlineRename(asset) {
        if (!asset?.id) return;
        const am = this._assetManager();
        if (!am) {
            Logger.ui.warn('Rename: AssetManager unavailable');
            return;
        }

        const container = this.assetPanel.container;
        if (!container) return;

        // Already editing this asset
        if (this._renamingAssetId === asset.id
            && container.querySelector(`.asset-name-input[data-asset-id="${asset.id}"]`)) {
            const existing = container.querySelector(`.asset-name-input[data-asset-id="${asset.id}"]`);
            existing?.focus();
            existing?.select();
            return;
        }

        const item = container.querySelector(`[data-asset-id="${CSS.escape(asset.id)}"]`);
        if (!item) {
            Logger.ui.warn('Rename: asset row not in DOM', asset.id);
            return;
        }

        const nameEl = item.querySelector('.asset-name-label');
        if (!nameEl) {
            Logger.ui.warn('Rename: .asset-name-label missing for', asset.id);
            return;
        }

        // Cancel any other open rename in this panel
        const openInput = container.querySelector('.asset-name-input');
        if (openInput) openInput.blur();

        const oldName = asset.name || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'asset-name-input rename-input';
        input.dataset.assetId = asset.id;
        input.value = oldName;
        input.setAttribute('aria-label', 'Rename asset');

        // Match grid label placement; list/details stay in-flow
        if (nameEl.classList.contains('asset-name-label') && item.classList.contains('asset-thumbnail')) {
            input.style.cssText = [
                'position:absolute', 'bottom:0', 'left:0', 'right:0',
                'width:100%', 'box-sizing:border-box', 'z-index:5',
                'font-size:10px', 'padding:2px 4px', 'text-align:center',
                'border:1px solid var(--ui-accent-color, #3b82f6)',
                'background:var(--ui-input-bg, #1f2937)',
                'color:var(--ui-active-text-color, #fff)'
            ].join(';');
        } else {
            input.style.cssText = [
                'width:100%', 'min-width:0', 'box-sizing:border-box',
                'font-size:inherit', 'padding:1px 4px',
                'border:1px solid var(--ui-accent-color, #3b82f6)',
                'background:var(--ui-input-bg, #1f2937)',
                'color:var(--ui-active-text-color, #fff)'
            ].join(';');
        }

        const wasDraggable = item.draggable;
        item.draggable = false;
        this._renamingAssetId = asset.id;

        let finished = false;
        /** Capture-phase: empty panel / marquee mousedown may not blur the input. */
        const onOutsidePointerDown = (e) => {
            if (finished) return;
            if (e.target === input || input.contains(e.target)) return;
            finishRename(true);
        };

        const finishRename = (save) => {
            if (finished) return;
            finished = true;
            this._renamingAssetId = null;
            item.draggable = wasDraggable;
            document.removeEventListener('pointerdown', onOutsidePointerDown, true);

            const newName = input.value.trim();
            if (save && newName && newName !== oldName) {
                const ok = am.updateAsset(asset.id, { name: newName });
                if (!ok) {
                    Logger.ui.warn('Rename failed:', asset.id);
                    if (input.isConnected) input.replaceWith(nameEl);
                    return;
                }
                // Restore label if re-render is deferred; assetsChanged usually rebuilds DOM.
                if (input.isConnected) {
                    const temp = asset.properties?.isTemporary;
                    nameEl.textContent = temp ? `⏳ ${newName}` : newName;
                    nameEl.title = temp ? `${newName} - TEMPORARY` : newName;
                    input.replaceWith(nameEl);
                }
                this.assetPanel.stateManager?.set('assetsLibraryDirty', true);
                this._notifyAssetsChanged();
                Logger.ui.info(`Renamed asset → "${newName}"`);
                return;
            }

            if (input.isConnected) input.replaceWith(nameEl);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                finishRename(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                finishRename(false);
            }
            // Keep typing from hitting global hotkeys
            e.stopPropagation();
        });
        input.addEventListener('blur', () => finishRename(true));
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('dblclick', (e) => e.stopPropagation());
        input.addEventListener('pointerdown', (e) => e.stopPropagation());

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        // After current event (F2 / dblclick / menu) so the opener click does not auto-commit.
        setTimeout(() => {
            if (!finished) {
                document.addEventListener('pointerdown', onOutsidePointerDown, true);
            }
        }, 0);
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

        // AS-DBL: dblclick on name → inline rename (not properties)
        if (e.target?.closest?.('.asset-name-label, .asset-name-input')) {
            this.startInlineRename(asset);
            return;
        }

        // Thumbnail / rest of row → Asset Properties Panel
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
