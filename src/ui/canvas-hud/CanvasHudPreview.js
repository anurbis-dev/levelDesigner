/**
 * Static layout preview for the Canvases dock panel.
 * Reuses play-mode anchor math (`resolveAnchorStyle`) and `.canvas-hud*` CSS so
 * editor placement matches CanvasHudRenderer; bindings render as `{name}` placeholders.
 */

import { resolveAnchorStyle } from '../../engine/CanvasHudBinding.js';

/**
 * Merge live (not-yet-committed) form fields onto the selected widget.
 * @param {object|null} canvas
 * @param {string|null} selectedWidgetId
 * @param {Record<string, unknown>|null} livePatch
 * @returns {object|null}
 */
export function canvasWithLivePatch(canvas, selectedWidgetId, livePatch) {
    if (!canvas || !livePatch || !selectedWidgetId) return canvas;
    return {
        ...canvas,
        widgets: (canvas.widgets || []).map((w) => (
            w.id === selectedWidgetId ? { ...w, ...livePatch } : w
        ))
    };
}

/**
 * @param {{text?: string, binding?: {source?: string, name?: string, itemId?: string}}} widget
 * @param {{items?: {id: string, name?: string}[]}|null|undefined} level
 * @returns {string}
 */
export function previewDisplayText(widget, level) {
    const binding = widget.binding;
    if (binding?.source === 'variable') return `{${binding.name || '?'}}`;
    if (binding?.source === 'inventoryCount') {
        const item = (level?.items || []).find((i) => i.id === binding.itemId);
        return `{${item?.name || binding.itemId || '?'}}`;
    }
    return widget.text || '';
}

/**
 * @param {object} widget
 * @param {{items?: object[]}|null|undefined} level
 * @returns {HTMLElement|null}
 */
export function buildPreviewWidget(widget, level) {
    const style = resolveAnchorStyle(widget.anchor || 'topLeft', widget.offsetX || 0, widget.offsetY || 0);
    if (widget.width != null) style.width = `${widget.width}px`;
    if (widget.height != null) style.height = `${widget.height}px`;
    Object.assign(style, widget.style || {});

    let el;
    switch (widget.type) {
        case 'button':
            el = document.createElement('button');
            el.type = 'button';
            el.textContent = previewDisplayText(widget, level) || 'Button';
            break;
        case 'image':
            if (widget.imgSrc) {
                el = document.createElement('img');
                el.src = widget.imgSrc;
            } else {
                el = document.createElement('div');
                el.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:40px;min-height:24px;border:1px dashed #4b5563;color:#6b7280;font-size:10px;';
                el.textContent = 'image';
            }
            break;
        case 'progressBar': {
            el = document.createElement('div');
            el.style.minWidth = '80px';
            el.style.minHeight = '14px';
            const fill = document.createElement('div');
            fill.className = 'canvas-hud__widget-fill';
            fill.style.width = widget.binding ? '60%' : '0%';
            el.appendChild(fill);
            break;
        }
        case 'panel':
            el = document.createElement('div');
            el.style.minWidth = '60px';
            el.style.minHeight = '40px';
            break;
        case 'text':
        default:
            el = document.createElement('div');
            {
                const text = previewDisplayText(widget, level);
                el.textContent = text || `(${widget.id})`;
                if (!text) el.style.color = '#6b7280';
            }
            break;
    }

    el.className = `${el.className ? el.className + ' ' : ''}canvas-hud__widget canvas-hud__widget--${widget.type || 'text'}`.trim();
    Object.assign(el.style, style);
    return el;
}

/**
 * Paint the preview column into `host` (clears host first).
 * @param {HTMLElement} host
 * @param {{
 *   canvas: object|null,
 *   selectedWidgetId: string|null,
 *   livePatch?: Record<string, unknown>|null,
 *   level?: object|null,
 *   onSelectWidget?: (widgetId: string) => void
 * }} opts
 */
export function renderCanvasHudPreview(host, opts) {
    host.innerHTML = '';
    const canvas = canvasWithLivePatch(opts.canvas, opts.selectedWidgetId, opts.livePatch || null);

    const head = document.createElement('div');
    head.style.cssText = 'color:#9ca3af;margin-bottom:6px;font-weight:600;';
    head.textContent = 'Preview';
    host.appendChild(head);

    if (!canvas) {
        const empty = document.createElement('div');
        empty.style.color = '#6b7280';
        empty.textContent = 'Select or create a canvas';
        host.appendChild(empty);
        return;
    }

    const hint = document.createElement('div');
    hint.style.cssText = 'color:#6b7280;font-size:11px;margin-bottom:6px;';
    hint.textContent = 'layout preview (16:9) — bindings as {placeholder}; click a widget to select';
    host.appendChild(hint);

    const viewport = document.createElement('div');
    viewport.className = 'canvas-hud canvas-hud--editor-preview';
    host.appendChild(viewport);

    for (const widget of canvas.widgets || []) {
        const el = buildPreviewWidget(widget, opts.level);
        if (!el) continue;
        if (widget.id === opts.selectedWidgetId) {
            el.classList.add('canvas-hud__widget--selected');
        }
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            opts.onSelectWidget?.(widget.id);
        });
        viewport.appendChild(el);
    }
}
