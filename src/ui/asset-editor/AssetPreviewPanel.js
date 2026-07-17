/**
 * Asset preview: image / color, optional collider/trigger AABB overlay, interactable radius.
 */
import {
    getEditingAsset,
    getEditingComponentId,
    subscribeAssetEditor,
    resolveAssetImageSrc
} from './AssetEditorContext.js';

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
        this.container.style.cssText = 'overflow:hidden;padding:8px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f172a;gap:6px;';
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
        const src = resolveAssetImageSrc(asset);
        const compId = getEditingComponentId(this.levelEditor);
        const comp = compId
            ? (asset.components || []).find((c) => c.id === compId)
            : null;

        // Stage size: fit panel, keep aspect
        const maxW = Math.max(80, (this.container.clientWidth || 200) - 24);
        const maxH = Math.max(80, (this.container.clientHeight || 160) - 40);
        const scale = Math.min(maxW / w, maxH / h, 4);
        const sw = Math.round(w * scale);
        const sh = Math.round(h * scale);

        const overlays = this._overlayHtml(comp, asset, sw, sh, scale);
        const media = src
            ? `<img alt="${this._esc(asset.name || 'asset')}" src="${this._esc(src)}"
                    style="width:100%;height:100%;object-fit:fill;image-rendering:pixelated;display:block;"
                    onerror="this.style.display='none';this.parentElement.style.background='${color}';" />`
            : '';

        this.container.innerHTML = `
            <div class="ae-preview-stage" style="position:relative;width:${sw}px;height:${sh}px;max-width:100%;background:${src ? 'transparent' : color};border:1px solid #374151;box-shadow:0 0 0 1px #000 inset;flex-shrink:0;">
                ${media}
                ${overlays}
            </div>
            <div style="font-size:10px;color:#94a3b8;text-align:center;">
                ${this._esc(asset.name || '')} · ${w}×${h}${src ? ' · image' : ' · color'}
                ${comp ? ` · ${this._esc(comp.type)}` : ''}
            </div>
        `;
    }

    /**
     * @param {object|null|undefined} comp
     * @param {object} asset
     * @param {number} sw
     * @param {number} sh
     * @param {number} scale
     * @private
     */
    _overlayHtml(comp, asset, sw, sh, scale) {
        if (!comp || comp.enabled === false) return '';
        const p = comp.properties || {};
        const type = comp.type;

        if (type === 'collider' || type === 'trigger') {
            const ew = Number(asset.width) || 32;
            const eh = Number(asset.height) || 32;
            const ox = Number(p.offsetX) || 0;
            const oy = Number(p.offsetY) || 0;
            const bw = p.width != null && p.width !== '' ? Number(p.width) : ew;
            const bh = p.height != null && p.height !== '' ? Number(p.height) : eh;
            const left = ox * scale;
            const top = oy * scale;
            const width = Math.max(1, bw * scale);
            const height = Math.max(1, bh * scale);
            const stroke = type === 'trigger' ? '#22d3ee' : '#fbbf24';
            return `<div title="${type} bounds" style="position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;border:1px dashed ${stroke};box-sizing:border-box;pointer-events:none;background:${stroke}22;"></div>`;
        }

        if (type === 'interactable') {
            const ew = Number(asset.width) || 32;
            const eh = Number(asset.height) || 32;
            const radius = Number(p.radius) || 32;
            const cx = (ew / 2) * scale;
            const cy = (eh / 2) * scale;
            const r = radius * scale;
            return `<div title="interact radius" style="position:absolute;left:${cx - r}px;top:${cy - r}px;width:${r * 2}px;height:${r * 2}px;border:1px dashed #a78bfa;border-radius:50%;box-sizing:border-box;pointer-events:none;background:#a78bfa18;"></div>`;
        }

        if (type === 'spriteUiAnimation' && Array.isArray(p.frames) && p.frames.length) {
            const f0 = p.frames[0];
            if (f0 && f0.w != null) {
                return `<div style="position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;border:1px solid #34d39966;" title="${p.frames.length} frame(s)"></div>
                    <div style="position:absolute;left:2px;top:2px;font-size:9px;color:#34d399;background:#000a;padding:1px 4px;border-radius:2px;">${p.frames.length} frames</div>`;
            }
        }

        return '';
    }

    /** @private */
    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    destroy() {
        this._unsub?.();
        this._unsub = null;
        this.container.innerHTML = '';
        this.levelEditor = null;
        this.stateManager = null;
    }
}
