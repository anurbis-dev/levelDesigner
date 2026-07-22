/**
 * Level-scope HUD Canvases dock panel: canvases → widgets → widget form.
 * Mirrors DialoguesPanel/ItemsPanel layout + commit/undo pattern.
 */

import {
    createEmptyCanvas,
    cloneCanvases,
    nextCanvasId,
    nextWidgetId,
    upsertCanvas,
    removeCanvas,
    upsertWidget,
    removeWidget,
    normalizeCanvas,
    WIDGET_TYPES,
    ANCHOR_OPTIONS,
    BINDING_SOURCE_OPTIONS,
    listVariableNameOptions,
    listCustomEventNameOptions
} from './CanvasHudModel.js';
import { createIdSelect } from '../LevelObjectPicker.js';
import { listItemOptions } from '../items/ItemModel.js';

const INPUT_CSS = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
const BTN_CSS = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;';

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
        this.formEl.style.cssText = 'flex:1;min-width:0;overflow:auto;padding:8px;';
        body.appendChild(this.formEl);

        this.container.appendChild(body);
    }

    render() {
        const level = this.levelEditor?.level;
        if (!level) {
            this.listEl.innerHTML = '<div style="color:#6b7280;">No level</div>';
            this.widgetsEl.innerHTML = '';
            this.formEl.innerHTML = '';
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
        head.appendChild(add);
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
            this.formEl.innerHTML = '<div style="color:#6b7280;">Select or create a canvas</div>';
            return;
        }

        this._renderCanvasMeta(canvas);

        const widget = (canvas.widgets || []).find((w) => w.id === this.selectedWidgetId);
        if (!widget) {
            this.formEl.appendChild(this._muted('Select or add a widget'));
            return;
        }
        this._renderWidgetForm(canvas, widget);
    }

    /** @private */
    _renderCanvasMeta(canvas) {
        const meta = document.createElement('div');
        meta.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #374151;';

        meta.appendChild(this._fieldLabel('Canvas id'));
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.value = canvas.id;
        idInput.style.cssText = INPUT_CSS;
        idInput.addEventListener('change', () => {
            const newId = idInput.value.trim();
            if (!newId || newId === canvas.id) return;
            if (this._getList().some((c) => c.id === newId)) {
                idInput.value = canvas.id;
                return;
            }
            const next = cloneCanvases(this._getList());
            const idx = next.findIndex((c) => c.id === canvas.id);
            if (idx < 0) return;
            next[idx] = { ...next[idx], id: newId };
            this.selectedCanvasId = newId;
            this._commitList(next);
        });
        meta.appendChild(idInput);

        meta.appendChild(this._fieldLabel('Display name'));
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = canvas.name || canvas.id;
        nameInput.style.cssText = INPUT_CSS;
        nameInput.addEventListener('change', () => {
            this._commitCanvas({ ...canvas, name: nameInput.value });
        });
        meta.appendChild(nameInput);

        this.formEl.appendChild(meta);
    }

    /** @private */
    _renderWidgetForm(canvas, widget) {
        const patch = (fields) => {
            this._commitCanvas(upsertWidget(canvas, { ...widget, ...fields }));
        };

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
        const t = document.createElement('span');
        t.style.fontWeight = '600';
        t.textContent = `Widget ${widget.id}`;
        head.appendChild(t);
        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = 'Delete widget';
        del.style.cssText = BTN_CSS;
        del.addEventListener('click', () => {
            this.selectedWidgetId = null;
            this._commitCanvas(removeWidget(canvas, widget.id));
        });
        head.appendChild(del);
        this.formEl.appendChild(head);

        this.formEl.appendChild(this._fieldLabel('Type'));
        this.formEl.appendChild(createIdSelect({
            value: widget.type || 'text',
            emptyLabel: '— type —',
            options: WIDGET_TYPES,
            onChange: (v) => patch({ type: v || 'text' })
        }));

        this.formEl.appendChild(this._fieldLabel('Anchor'));
        this.formEl.appendChild(createIdSelect({
            value: widget.anchor || 'topLeft',
            emptyLabel: '— anchor —',
            options: ANCHOR_OPTIONS,
            onChange: (v) => patch({ anchor: v || 'topLeft' })
        }));

        this.formEl.appendChild(this._numberPairRow(
            'Offset X', 'Offset Y',
            widget.offsetX ?? 0, widget.offsetY ?? 0,
            (x) => patch({ offsetX: x }),
            (y) => patch({ offsetY: y })
        ));

        this.formEl.appendChild(this._numberPairRow(
            'Width (empty = auto)', 'Height (empty = auto)',
            widget.width, widget.height,
            (v) => patch({ width: v }),
            (v) => patch({ height: v }),
            true
        ));

        if (widget.type === 'text' || widget.type === 'button') {
            this.formEl.appendChild(this._fieldLabel('Text (fallback if unbound)'));
            const textIn = document.createElement('input');
            textIn.type = 'text';
            textIn.value = widget.text || '';
            textIn.style.cssText = INPUT_CSS;
            textIn.addEventListener('change', () => patch({ text: textIn.value }));
            this.formEl.appendChild(textIn);
        }

        if (widget.type === 'image') {
            this.formEl.appendChild(this._fieldLabel('Image src (URL/path)'));
            const src = document.createElement('input');
            src.type = 'text';
            src.value = widget.imgSrc || '';
            src.style.cssText = INPUT_CSS;
            src.addEventListener('change', () => patch({ imgSrc: src.value }));
            this.formEl.appendChild(src);
        }

        this._renderBindingSection(canvas, widget, patch);

        if (widget.type === 'button') {
            this._renderActionSection(canvas, widget, patch);
        }
    }

    /**
     * Two number inputs side by side (offsets, or width/height).
     * @private
     */
    _numberPairRow(labelA, labelB, valueA, valueB, onA, onB, optional = false) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;';

        const colA = document.createElement('div');
        colA.style.flex = '1';
        colA.appendChild(this._fieldLabel(labelA));
        const inA = document.createElement('input');
        inA.type = 'number';
        inA.value = valueA == null ? '' : String(valueA);
        inA.style.cssText = INPUT_CSS;
        inA.addEventListener('change', () => {
            const s = inA.value.trim();
            onA(s === '' ? (optional ? undefined : 0) : Number(s));
        });
        colA.appendChild(inA);

        const colB = document.createElement('div');
        colB.style.flex = '1';
        colB.appendChild(this._fieldLabel(labelB));
        const inB = document.createElement('input');
        inB.type = 'number';
        inB.value = valueB == null ? '' : String(valueB);
        inB.style.cssText = INPUT_CSS;
        inB.addEventListener('change', () => {
            const s = inB.value.trim();
            onB(s === '' ? (optional ? undefined : 0) : Number(s));
        });
        colB.appendChild(inB);

        wrap.appendChild(colA);
        wrap.appendChild(colB);
        return wrap;
    }

    /** @private */
    _renderBindingSection(canvas, widget, patch) {
        const box = document.createElement('div');
        box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
        const h = document.createElement('div');
        h.style.cssText = 'font-weight:600;margin-bottom:6px;';
        h.textContent = 'Data binding';
        box.appendChild(h);

        const binding = widget.binding || null;
        box.appendChild(this._fieldLabel('Bind to'));
        box.appendChild(createIdSelect({
            value: binding?.source || '',
            emptyLabel: '— static (no binding) —',
            options: BINDING_SOURCE_OPTIONS,
            onChange: (v) => {
                if (!v) {
                    const next = { ...widget };
                    delete next.binding;
                    patch(next);
                    return;
                }
                patch({ binding: v === 'variable' ? { source: 'variable', name: '' } : { source: 'inventoryCount', itemId: '', max: 100 } });
            }
        }));

        if (binding?.source === 'variable') {
            box.appendChild(this._fieldLabel('Variable name'));
            box.appendChild(this._datalistInput({
                value: binding.name || '',
                placeholder: 'score',
                options: listVariableNameOptions(this.levelEditor?.level),
                onChange: (v) => patch({ binding: { ...binding, name: v } })
            }));
        }

        if (binding?.source === 'inventoryCount') {
            const items = this.levelEditor?.level?.items || [];
            box.appendChild(this._fieldLabel('Item'));
            box.appendChild(createIdSelect({
                value: binding.itemId || '',
                emptyLabel: '— item —',
                options: listItemOptions(items, binding.itemId ? [binding.itemId] : []),
                onChange: (v) => patch({ binding: { ...binding, itemId: v } })
            }));
        }

        if (binding && widget.type === 'progressBar') {
            box.appendChild(this._fieldLabel('Max (100% value)'));
            const maxIn = document.createElement('input');
            maxIn.type = 'number';
            maxIn.value = String(binding.max ?? 100);
            maxIn.style.cssText = INPUT_CSS;
            maxIn.addEventListener('change', () => {
                patch({ binding: { ...binding, max: Number(maxIn.value) || 1 } });
            });
            box.appendChild(maxIn);
        }

        this.formEl.appendChild(box);
    }

    /** @private */
    _renderActionSection(canvas, widget, patch) {
        const box = document.createElement('div');
        box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
        const h = document.createElement('div');
        h.style.cssText = 'font-weight:600;margin-bottom:6px;';
        h.textContent = 'On click';
        box.appendChild(h);

        const action = widget.action || null;
        box.appendChild(this._fieldLabel('Action'));
        box.appendChild(createIdSelect({
            value: action?.type || '',
            emptyLabel: '— none —',
            options: [{ id: 'customEvent', label: 'Emit custom event (Event Graph OnCustomEvent)' }],
            onChange: (v) => {
                if (!v) {
                    const next = { ...widget };
                    delete next.action;
                    patch(next);
                    return;
                }
                patch({ action: { type: 'customEvent', name: '' } });
            }
        }));

        if (action?.type === 'customEvent') {
            box.appendChild(this._fieldLabel('Event name'));
            box.appendChild(this._datalistInput({
                value: action.name || '',
                placeholder: 'addScore',
                options: listCustomEventNameOptions(this.levelEditor?.level),
                onChange: (v) => patch({ action: { ...action, name: v } })
            }));
        }

        this.formEl.appendChild(box);
    }

    /**
     * Text input with a <datalist> of known-value suggestions — used for variable/event
     * names that are authoring conventions, not an enumerable id domain like items/canvases
     * (the name may not exist in the Event Graph yet), so a hard dropdown would block
     * legitimate new-name entry.
     * @private
     * @param {{ value: string, placeholder?: string, options: {id:string,label:string}[], onChange: (v:string) => void }} opts
     */
    _datalistInput(opts) {
        const wrap = document.createElement('div');
        const listId = `canvas-hud-suggest-${++this._datalistSeq}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = opts.value || '';
        input.placeholder = opts.placeholder || '';
        input.setAttribute('list', listId);
        input.style.cssText = INPUT_CSS;
        input.addEventListener('change', () => opts.onChange(input.value.trim()));
        wrap.appendChild(input);

        const datalist = document.createElement('datalist');
        datalist.id = listId;
        for (const o of opts.options || []) {
            const opt = document.createElement('option');
            opt.value = o.id;
            datalist.appendChild(opt);
        }
        wrap.appendChild(datalist);
        return wrap;
    }

    /** @private */
    _fieldLabel(text) {
        const el = document.createElement('div');
        el.style.cssText = 'color:#9ca3af;margin:6px 0 2px;';
        el.textContent = text;
        return el;
    }

    /** @private */
    _muted(text) {
        const el = document.createElement('div');
        el.style.color = '#6b7280';
        el.textContent = text;
        return el;
    }
}
