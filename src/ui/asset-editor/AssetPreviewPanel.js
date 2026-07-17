/**
 * Static asset preview (image or color). Collider handles — later.
 */
import { getEditingAsset, subscribeAssetEditor } from './AssetEditorContext.js';

export class AssetPreviewPanel {
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
        this.container.style.cssText = 'overflow:hidden;padding:8px;height:100%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:#0f172a;';
        this.render();
    }

    render() {
        const asset = getEditingAsset(this.levelEditor);
        if (!asset) {
            this.container.innerHTML = '<div style="color:#9ca3af;font-size:12px;">No asset selected</div>';
            return;
        }

        const w = Math.max(8, Number(asset.width) || 32);
        const h = Math.max(8, Number(asset.height) || 32);
        const color = asset.color || '#3B82F6';
        const src = asset.imgSrc || asset.properties?.sourceFile || null;

        if (src) {
            this.container.innerHTML = `
                <img alt="${asset.name || 'asset'}" src="${src}"
                    style="max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                <div style="display:none;width:${w}px;height:${h}px;max-width:90%;max-height:90%;background:${color};border:1px solid #374151;"></div>
            `;
            return;
        }

        this.container.innerHTML = `
            <div title="${asset.name || ''}"
                style="width:${w}px;height:${h}px;max-width:90%;max-height:90%;background:${color};border:1px solid #374151;box-shadow:0 0 0 1px #000 inset;"></div>
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
