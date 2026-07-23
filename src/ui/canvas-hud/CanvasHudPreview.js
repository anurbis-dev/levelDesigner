/**
 * Static layout preview for the Canvases dock panel.
 * Reuses play-mode anchor math (`resolveAnchorStyle`) and `.canvas-hud*` CSS so
 * editor placement matches CanvasHudRenderer; bindings render as `{name}` placeholders.
 * Supports click-select and pointer-drag to move offsetX/offsetY.
 */

import { resolveAnchorStyle } from '../../engine/CanvasHudBinding.js';

/** Anchor → screen delta invert for right/bottom (offset is measured inward). */
const ANCHOR_AXIS = {
    topLeft: { h: 1, v: 1 },
    topCenter: { h: 1, v: 1 },
    topRight: { h: -1, v: 1 },
    middleLeft: { h: 1, v: 1 },
    middleCenter: { h: 1, v: 1 },
    middleRight: { h: -1, v: 1 },
    bottomLeft: { h: 1, v: -1 },
    bottomCenter: { h: 1, v: -1 },
    bottomRight: { h: -1, v: -1 }
};

/**
 * Convert screen pointer delta into offsetX/offsetY delta for the widget's anchor.
 * @param {string} anchor
 * @param {number} dx
 * @param {number} dy
 * @returns {{ dX: number, dY: number }}
 */
export function screenDeltaToOffsetDelta(anchor, dx, dy) {
    const axis = ANCHOR_AXIS[anchor] || ANCHOR_AXIS.topLeft;
    return { dX: dx * axis.h, dY: dy * axis.v };
}

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
 * Apply position (+ optional size) styles from widget fields onto an element.
 * @param {HTMLElement} el
 * @param {object} widget
 */
export function applyPreviewWidgetStyle(el, widget) {
    const style = resolveAnchorStyle(widget.anchor || 'topLeft', widget.offsetX || 0, widget.offsetY || 0);
    if (widget.width != null) style.width = `${widget.width}px`;
    else style.width = '';
    if (widget.height != null) style.height = `${widget.height}px`;
    else style.height = '';
    Object.assign(el.style, style);
    if (widget.style) Object.assign(el.style, widget.style);
}

/**
 * @param {object} widget
 * @param {{items?: object[]}|null|undefined} level
 * @returns {HTMLElement|null}
 */
export function buildPreviewWidget(widget, level) {
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

    el.className = `${el.className ? el.className + ' ' : ''}canvas-hud__widget canvas-hud__widget--${widget.type || 'text'} canvas-hud__widget--editor-draggable`.trim();
    el.dataset.widgetId = widget.id;
    applyPreviewWidgetStyle(el, widget);
    return el;
}

/**
 * Wire pointer drag on a preview widget (select + move offsets). Does not rebuild host DOM.
 * @param {HTMLElement} el
 * @param {object} widget - snapshot at bind time (ids/anchor/base offsets)
 * @param {HTMLElement} viewport
 * @param {{
 *   onSelectWidget?: (widgetId: string) => void,
 *   onLiveOffset?: (widgetId: string, fields: {offsetX:number, offsetY:number}) => void,
 *   onCommitOffset?: (widgetId: string, fields: {offsetX:number, offsetY:number}) => void
 * }} opts
 */
function bindWidgetDrag(el, widget, viewport, opts) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startOffX = 0;
    let startOffY = 0;
    let moved = false;
    let dragging = false;
    let lastOx = 0;
    let lastOy = 0;

    const markSelected = () => {
        viewport.querySelectorAll('.canvas-hud__widget--selected').forEach((n) => {
            n.classList.remove('canvas-hud__widget--selected');
        });
        el.classList.add('canvas-hud__widget--selected');
    };

    el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        opts.onSelectWidget?.(widget.id);
        markSelected();

        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        startOffX = Number(widget.offsetX) || 0;
        startOffY = Number(widget.offsetY) || 0;
        lastOx = startOffX;
        lastOy = startOffY;
        moved = false;
        dragging = true;
        el.classList.add('canvas-hud__widget--editor-dragging');
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    });

    el.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        moved = true;
        const { dX, dY } = screenDeltaToOffsetDelta(widget.anchor || 'topLeft', dx, dy);
        lastOx = Math.round(startOffX + dX);
        lastOy = Math.round(startOffY + dY);
        applyPreviewWidgetStyle(el, { ...widget, offsetX: lastOx, offsetY: lastOy });
        opts.onLiveOffset?.(widget.id, { offsetX: lastOx, offsetY: lastOy });
    });

    const endDrag = (e) => {
        if (!dragging || (e && e.pointerId !== pointerId)) return;
        dragging = false;
        el.classList.remove('canvas-hud__widget--editor-dragging');
        try { el.releasePointerCapture(pointerId); } catch { /* ignore */ }
        pointerId = null;
        if (moved) {
            opts.onCommitOffset?.(widget.id, { offsetX: lastOx, offsetY: lastOy });
        }
    };

    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
}

/**
 * Paint the preview column into `host` (clears host first).
 * @param {HTMLElement} host
 * @param {{
 *   canvas: object|null,
 *   selectedWidgetId: string|null,
 *   livePatch?: Record<string, unknown>|null,
 *   level?: object|null,
 *   onSelectWidget?: (widgetId: string) => void,
 *   onLiveOffset?: (widgetId: string, fields: {offsetX:number, offsetY:number}) => void,
 *   onCommitOffset?: (widgetId: string, fields: {offsetX:number, offsetY:number}) => void
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
    hint.textContent = '16:9 — drag widgets to move; click to select';
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
        bindWidgetDrag(el, widget, viewport, opts);
        viewport.appendChild(el);
    }
}
