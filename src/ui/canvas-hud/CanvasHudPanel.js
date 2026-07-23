/**
 * Level-scope HUD Canvases dock panel: canvases → widgets → form → layout preview.
 * Mirrors DialoguesPanel/ItemsPanel commit/undo pattern.
 */

import {
    createEmptyCanvas,
    cloneCanvases,
    nextCanvasId,
    nextWidgetId,
    upsertCanvas,
    removeCanvas,
    upsertWidget,
    duplicateWidget,
    normalizeCanvas
} from './CanvasHudModel.js';
import { renderCanvasHudPreview } from './CanvasHudPreview.js';
import {
    BTN_CSS,
    mutedText,
    renderCanvasMeta,
    renderWidgetForm
} from './CanvasHudForm.js';

export class CanvasHudPanel {
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

        /** @type {string|null} */
        this.selectedCanvasId = null;
        /** @type {string|null} */
        this.selectedWidgetId = null;
        /** @type {Record<string, unknown>|null} live form values not yet committed (preview only) */
        this._liveWidgetPatch = null;
        this._selfPatch = false;
        this._datalistSeq = 0;

        this.container.style.cssText = [
            'display:flex',
            'flex-direction:column',
            'height:100%',
            'min-height:0',
            'box-sizing:border-box',
            'font-size:12px',
            'color:var(--ui-text-color,#e5e7eb)',
            'background:var(--ui-panel-bg,#111827)'
        ].join(';');

        this._unsub = stateManager.subscribe?.('canvasesRevision', () => {
            if (!this._selfPatch) this.render();
        }) || null;

        this._buildShell();
        this.render();
    }

    destroy() {
        try { this._unsub?.(); } catch { /* ignore */ }
        this.container.innerHTML = '';
    }

    /** @private */
    _buildShell() {
        this.container.innerHTML = '';

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #374151;flex:0 0 auto;flex-wrap:wrap;';
        const title = document.createElement('span');
        title.style.fontWeight = '600';
        title.textContent = 'Canvases';
        toolbar.appendChild(title);

        const addCanvas = document.createElement('button');
        addCanvas.type = 'button';
        addCanvas.textContent = '+ Canvas';
        addCanvas.style.cssText = BTN_CSS;
        addCanvas.addEventListener('click', () => this._addCanvas());
        toolbar.appendChild(addCanvas);

        const delCanvas = document.createElement('button');
        delCanvas.type = 'button';
        delCanvas.textContent = 'Delete canvas';
        delCanvas.style.cssText = BTN_CSS;
        delCanvas.addEventListener('click', () => this._deleteCanvas());
        toolbar.appendChild(delCanvas);

        const hint = document.createElement('span');
        hint.style.cssText = 'color:#6b7280;font-size:11px;margin-left:auto;';
        hint.textContent = 'assign to a camera via component "HUD Canvases"';
        toolbar.appendChild(hint);
        this.container.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex:1;min-height:0;';

        this.listEl = document.createElement('div');
        this.listEl.style.cssText = 'width:140px;flex:0 0 140px;border-right:1px solid #374151;overflow:auto;padding:6px;';
        body.appendChild(this.listEl);

        this.widgetsEl = document.createElement('div');
        this.widgetsEl.style.cssText = 'width:160px;flex:0 0 160px;border-right:1px solid #374151;overflow:auto;padding:6px;';
        body.appendChild(this.widgetsEl);

        this.formEl = document.createElement('div');
        this.formEl.style.cssText = 'flex:0 0 320px;min-width:0;overflow:auto;padding:8px;border-right:1px solid #374151;';
        body.appendChild(this.formEl);

        this.previewEl = document.createElement('div');
        this.previewEl.style.cssText = 'flex:1;min-width:220px;overflow:auto;padding:8px;';
        body.appendChild(this.previewEl);

        this.container.appendChild(body);
    }

    render() {
        this._liveWidgetPatch = null;
        const level = this.levelEditor?.level;
        if (!level) {
            this.listEl.innerHTML = '<div style="color:#6b7280;">No level</div>';
            this.widgetsEl.innerHTML = '';
            this.formEl.innerHTML = '';
            this._renderPreview(null);
            return;
        }
        const list = level.canvases || [];
        if (this.selectedCanvasId && !list.some((c) => c.id === this.selectedCanvasId)) {
            this.selectedCanvasId = list[0]?.id || null;
            this.selectedWidgetId = null;
        }
        if (!this.selectedCanvasId && list[0]) this.selectedCanvasId = list[0].id;

        this._renderList(list);
        let canvas = list.find((c) => c.id === this.selectedCanvasId) || null;
        if (canvas) canvas = normalizeCanvas(canvas);
        if (canvas && this.selectedWidgetId && !canvas.widgets.some((w) => w.id === this.selectedWidgetId)) {
            this.selectedWidgetId = canvas.widgets[0]?.id || null;
        }
        if (canvas && !this.selectedWidgetId) {
            this.selectedWidgetId = canvas.widgets[0]?.id || null;
        }
        this._renderWidgets(canvas);
        this._renderForm(canvas);
        this._renderPreview(canvas);
    }

    /** @private */
    _getList() {
        return this.levelEditor?.level?.canvases || [];
    }

    /** @private */
    _commitList(nextList) {
        const level = this.levelEditor?.level;
        if (!level) return;
        level.canvases = cloneCanvases(nextList);
        this.levelEditor.historyManager?.saveState(
            level.objects,
            this.stateManager.get('selectedObjects'),
            false,
            this.stateManager.get('groupEditMode')
        );
        this.stateManager.markDirty?.();
        this._selfPatch = true;
        try {
            this.stateManager.set?.(
                'canvasesRevision',
                (this.stateManager.get('canvasesRevision') || 0) + 1
            );
            this.render();
        } finally {
            this._selfPatch = false;
        }
    }

    /** @private */
    _commitCanvas(canvas) {
        this._commitList(upsertCanvas(this._getList(), canvas));
    }

    /** @private */
    _addCanvas() {
        const id = nextCanvasId(this._getList());
        const c = createEmptyCanvas(id);
        this.selectedCanvasId = id;
        this.selectedWidgetId = null;
        this._commitList(upsertCanvas(this._getList(), c));
    }

    /** @private */
    _deleteCanvas() {
        if (!this.selectedCanvasId) return;
        const id = this.selectedCanvasId;
        this.selectedCanvasId = null;
        this.selectedWidgetId = null;
        this._commitList(removeCanvas(this._getList(), id));
    }

    /** @private */
    _renderList(list) {
        this.listEl.innerHTML = '';
        const h = document.createElement('div');
        h.style.cssText = 'color:#9ca3af;margin-bottom:6px;font-weight:600;';
        h.textContent = 'Canvases';
        this.listEl.appendChild(h);
        if (!list.length) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'None — add a canvas';
            this.listEl.appendChild(empty);
            return;
        }
        for (const c of list) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = c.name || c.id;
            btn.title = c.id;
            const selected = c.id === this.selectedCanvasId;
            btn.style.cssText = this._listBtnCss(selected);
            btn.addEventListener('click', () => {
                this.selectedCanvasId = c.id;
                this.selectedWidgetId = null;
                this.render();
            });
            this.listEl.appendChild(btn);
        }
    }

    /** @private */
    _listBtnCss(selected) {
        return [
            'display:block', 'width:100%', 'text-align:left', 'margin-bottom:3px',
            'padding:4px 6px', 'border-radius:4px',
            'border:1px solid ' + (selected ? '#fbbf24' : '#374151'),
            'background:' + (selected ? '#1e3a5f' : '#1f2937'),
            'color:#e5e7eb', 'cursor:pointer',
            'overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap'
        ].join(';');
    }

    /** @private */
    _renderWidgets(canvas) {
        this.widgetsEl.innerHTML = '';
        if (!canvas) {
            this.widgetsEl.innerHTML = '<div style="color:#6b7280;">Select a canvas</div>';
            return;
        }
        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
        const h = document.createElement('span');
        h.style.cssText = 'color:#9ca3af;font-weight:600;';
        h.textContent = 'Widgets';
        head.appendChild(h);
        const tools = document.createElement('div');
        tools.style.cssText = 'display:flex;gap:3px;';
        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+';
        add.title = 'Add widget';
        add.style.cssText = BTN_CSS + 'width:22px;height:22px;padding:0;';
        add.addEventListener('click', () => {
            const id = nextWidgetId(canvas);
            const widget = { id, type: 'text', anchor: 'topLeft', offsetX: 12, offsetY: 12, text: '' };
            this.selectedWidgetId = id;
            this._commitCanvas(upsertWidget(canvas, widget));
        });
        tools.appendChild(add);
        const dup = document.createElement('button');
        dup.type = 'button';
        dup.textContent = '⧉';
        dup.title = 'Duplicate selected widget';
        dup.style.cssText = BTN_CSS + 'width:22px;height:22px;padding:0;';
        dup.disabled = !this.selectedWidgetId;
        dup.addEventListener('click', () => this._duplicateSelectedWidget(canvas));
        tools.appendChild(dup);
        head.appendChild(tools);
        this.widgetsEl.appendChild(head);

        for (const w of canvas.widgets || []) {
            const btn = document.createElement('button');
            btn.type = 'button';
            const selected = w.id === this.selectedWidgetId;
            btn.textContent = `${w.id} · ${w.type}`;
            btn.style.cssText = this._listBtnCss(selected);
            btn.addEventListener('click', () => {
                this.selectedWidgetId = w.id;
                this.render();
            });
            this.widgetsEl.appendChild(btn);
        }
    }

    /** @private */
    _renderForm(canvas) {
        this.formEl.innerHTML = '';
        if (!canvas) {
            this.formEl.appendChild(mutedText('Select or create a canvas'));
            return;
        }

        renderCanvasMeta(this.formEl, canvas, {
            getList: () => this._getList(),
            commitList: (list) => this._commitList(list),
            commitCanvas: (c) => this._commitCanvas(c),
            setSelectedCanvasId: (id) => { this.selectedCanvasId = id; }
        });

        const widget = (canvas.widgets || []).find((w) => w.id === this.selectedWidgetId);
        if (!widget) {
            this.formEl.appendChild(mutedText('Select or add a widget'));
            return;
        }
        renderWidgetForm(this.formEl, canvas, widget, {
            level: this.levelEditor?.level,
            nextListId: () => `canvas-hud-suggest-${++this._datalistSeq}`,
            stageLive: (fields) => this._stageLivePreview(fields),
            commitCanvas: (c) => this._commitCanvas(c),
            clearSelectedWidget: () => { this.selectedWidgetId = null; },
            setSelectedWidgetId: (id) => { this.selectedWidgetId = id; }
        });
    }

    /** Preview select without DOM rebuild (keeps pointer capture for drag). @private */
    _selectWidgetFromPreview(id) {
        if (this.selectedWidgetId === id) return;
        this.selectedWidgetId = id;
        this._liveWidgetPatch = null;
        let canvas = this._getList().find((c) => c.id === this.selectedCanvasId) || null;
        if (canvas) canvas = normalizeCanvas(canvas);
        this._renderWidgets(canvas);
        this._renderForm(canvas);
    }

    /** @private */
    _duplicateSelectedWidget(canvas) {
        if (!this.selectedWidgetId || !canvas) return;
        const { canvas: next, newWidgetId } = duplicateWidget(canvas, this.selectedWidgetId);
        if (!newWidgetId) return;
        this.selectedWidgetId = newWidgetId;
        this._commitCanvas(next);
    }

    /** Live form values → preview (no history). @private */
    _stageLivePreview(fields) {
        this._liveWidgetPatch = { ...(this._liveWidgetPatch || {}), ...fields };
        let canvas = this._getList().find((c) => c.id === this.selectedCanvasId) || null;
        if (canvas) canvas = normalizeCanvas(canvas);
        this._renderPreview(canvas);
    }

    /** Live offset during drag — patch only, no preview rebuild. @private */
    _stageLiveOffset(fields) {
        this._liveWidgetPatch = { ...(this._liveWidgetPatch || {}), ...fields };
    }

    /** Commit offset after preview drag. @private */
    _commitWidgetOffset(widgetId, fields) {
        let canvas = this._getList().find((c) => c.id === this.selectedCanvasId) || null;
        if (!canvas) return;
        canvas = normalizeCanvas(canvas);
        const widget = canvas.widgets.find((w) => w.id === widgetId);
        if (!widget) return;
        this.selectedWidgetId = widgetId;
        this._liveWidgetPatch = null;
        this._commitCanvas(upsertWidget(canvas, { ...widget, ...fields }));
    }

    /** @private */
    _renderPreview(canvas) {
        renderCanvasHudPreview(this.previewEl, {
            canvas,
            selectedWidgetId: this.selectedWidgetId,
            livePatch: this._liveWidgetPatch,
            level: this.levelEditor?.level,
            onSelectWidget: (id) => this._selectWidgetFromPreview(id),
            onLiveOffset: (_id, fields) => this._stageLiveOffset(fields),
            onCommitOffset: (id, fields) => this._commitWidgetOffset(id, fields)
        });
    }
}
