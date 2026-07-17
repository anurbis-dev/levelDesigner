/**
 * Selected component details (MVP: type/id stub; property forms later).
 */
import { getComponentTypeById } from '../../constants/ComponentTypes.js';
import {
    getEditingAsset,
    getEditingComponentId,
    subscribeAssetEditor
} from './AssetEditorContext.js';

export class AssetComponentDetailsPanel {
    /**
     * @param {HTMLElement} container
     * @param {object} stateManager
     * @param {object} levelEditor
     * @param {{ instanceKey?: string, isPrimary?: boolean }} [options]
     */
    constructor(container, stateManager, levelEditor, options = {}) {
        this.container = container;
        this.stateManager = stateManager;
        this.levelEditor = levelEditor;
        this.instanceKey = options.instanceKey || null;
        this._unsub = subscribeAssetEditor(stateManager, () => this.render());
        this.container.style.cssText = 'overflow:auto;padding:8px;font-size:12px;height:100%;box-sizing:border-box;';
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">No asset selected</div>';
            return;
        }
        const compId = getEditingComponentId(this.levelEditor);
        if (!compId) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Select a component</div>';
            return;
        }
        const comp = (asset.components || []).find((c) => c.id === compId);
        if (!comp) {
            this.container.innerHTML = '<div style="color:var(--ui-text-color,#9ca3af);">Component not found</div>';
            return;
        }
        const def = getComponentTypeById(comp.type);
        const label = def ? def.label : comp.type;
        this.container.innerHTML = `
            <div style="font-weight:600;margin-bottom:8px;">${label}</div>
            <div style="color:var(--ui-text-color,#9ca3af);font-size:11px;margin-bottom:4px;">Type: ${comp.type}</div>
            <div style="color:var(--ui-text-color,#9ca3af);font-size:11px;margin-bottom:8px;">Id: ${comp.id}</div>
            <div style="color:var(--ui-text-color,#6b7280);font-size:11px;">
                Property editor for this component type is not implemented yet.
            </div>
        `;
    }

    destroy() {
        this._unsub?.();
        this._unsub = null;
        this.container.innerHTML = '';
        this.levelEditor = null;
        this.stateManager = null;
    }
}
