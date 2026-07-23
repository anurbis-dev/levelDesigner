/**
 * Form widgets for CanvasHudPanel (canvas meta + widget fields + binding/action).
 * Pure DOM builders; panel owns commit/history/selection.
 */

import {
    WIDGET_TYPES,
    BINDING_SOURCE_OPTIONS,
    listVariableNameOptions,
    listCustomEventNameOptions,
    cloneCanvases,
    upsertWidget
} from './CanvasHudModel.js';
import { createIdSelect } from '../LevelObjectPicker.js';
import { listItemOptions } from '../items/ItemModel.js';
import { createAssetRefControl } from '../AssetRefControl.js';
import {
    INPUT_CSS,
    mutedText,
    inlineRow,
    datalistInput,
    scrubNumberInput,
    numberPairRow,
    anchorIconPicker
} from './CanvasHudFormFields.js';

export { INPUT_CSS, BTN_CSS, mutedText, fieldLabel, inlineRow, numberPairRow } from './CanvasHudFormFields.js';

/**
 * @param {HTMLElement} formEl
 * @param {object} canvas
 * @param {{ getList: () => object[], commitList: (list: object[]) => void, commitCanvas: (c: object) => void, setSelectedCanvasId: (id: string) => void }} api
 */
export function renderCanvasMeta(formEl, canvas, api) {
    const meta = document.createElement('div');
    meta.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #374151;';

    const idInput = document.createElement('input');
    idInput.type = 'text';
    idInput.value = canvas.id;
    idInput.style.cssText = INPUT_CSS;
    idInput.addEventListener('change', () => {
        const newId = idInput.value.trim();
        if (!newId || newId === canvas.id) return;
        if (api.getList().some((c) => c.id === newId)) {
            idInput.value = canvas.id;
            return;
        }
        const next = cloneCanvases(api.getList());
        const idx = next.findIndex((c) => c.id === canvas.id);
        if (idx < 0) return;
        next[idx] = { ...next[idx], id: newId };
        api.setSelectedCanvasId(newId);
        api.commitList(next);
    });
    meta.appendChild(inlineRow('Canvas id', idInput));

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = canvas.name || canvas.id;
    nameInput.style.cssText = INPUT_CSS;
    nameInput.addEventListener('change', () => {
        api.commitCanvas({ ...canvas, name: nameInput.value });
    });
    meta.appendChild(inlineRow('Name', nameInput));

    formEl.appendChild(meta);
}

/**
 * @param {HTMLElement} formEl
 * @param {object} canvas
 * @param {object} widget
 * @param {{
 *   level: object|null|undefined,
 *   assetManager?: object|null,
 *   nextListId: () => string,
 *   stageLive: (fields: Record<string, unknown>) => void,
 *   commitCanvas: (c: object) => void
 * }} api
 */
export function renderWidgetForm(formEl, canvas, widget, api) {
    const patch = (fields) => {
        api.commitCanvas(upsertWidget(canvas, { ...widget, ...fields }));
    };

    // Delete/Duplicate use global editor shortcuts (Delete / Shift+D) when panel is under cursor.
    const head = document.createElement('div');
    head.style.cssText = 'margin-bottom:8px;';
    const t = document.createElement('span');
    t.style.fontWeight = '600';
    t.textContent = `Widget ${widget.id}`;
    head.appendChild(t);
    formEl.appendChild(head);

    const typeSel = createIdSelect({
        value: widget.type || 'text',
        emptyLabel: '— type —',
        options: WIDGET_TYPES,
        onChange: (v) => patch({ type: v || 'text' })
    });
    formEl.appendChild(inlineRow('Type', typeSel));

    formEl.appendChild(inlineRow('Anchor', anchorIconPicker(widget.anchor || 'topLeft', (a) => {
        patch({ anchor: a });
    }), { wrap: true }));

    formEl.appendChild(numberPairRow({
        labelA: 'Offset X',
        labelB: 'Offset Y',
        valueA: widget.offsetX ?? 0,
        valueB: widget.offsetY ?? 0,
        onA: (x) => patch({ offsetX: x }),
        onB: (y) => patch({ offsetY: y }),
        optional: false,
        onLiveA: (x) => api.stageLive({ offsetX: x }),
        onLiveB: (y) => api.stageLive({ offsetY: y })
    }));

    formEl.appendChild(numberPairRow({
        labelA: 'Width',
        labelB: 'Height',
        valueA: widget.width,
        valueB: widget.height,
        onA: (v) => patch({ width: v }),
        onB: (v) => patch({ height: v }),
        optional: true,
        min: 1,
        onLiveA: (v) => api.stageLive({ width: v }),
        onLiveB: (v) => api.stageLive({ height: v })
    }));

    if (widget.type === 'text' || widget.type === 'button') {
        const textIn = document.createElement('input');
        textIn.type = 'text';
        textIn.value = widget.text || '';
        textIn.placeholder = 'fallback if unbound';
        textIn.style.cssText = INPUT_CSS;
        textIn.addEventListener('input', () => api.stageLive({ text: textIn.value }));
        textIn.addEventListener('change', () => patch({ text: textIn.value }));
        formEl.appendChild(inlineRow('Text', textIn));
    }

    if (widget.type === 'image') {
        // Catalog Image asset id only — disk path lives on the Image asset, not here.
        const control = createAssetRefControl({
            value: widget.imageAssetId || '',
            assetManager: api.assetManager,
            assetTypes: ['image'],
            emptyLabel: '— image asset —',
            onChange: (id) => {
                const next = { ...widget, imageAssetId: id || '' };
                delete next.imgSrc;
                api.stageLive({ imageAssetId: id || '', imgSrc: undefined });
                api.commitCanvas(upsertWidget(canvas, next));
            }
        });
        formEl.appendChild(inlineRow('Image', control, { wrap: true }));
    }

    renderBindingSection(formEl, widget, patch, api);
    if (widget.type === 'button') {
        renderActionSection(formEl, widget, patch, api);
    }
}

/** @private */
function renderBindingSection(formEl, widget, patch, api) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:6px;';
    h.textContent = 'Data binding';
    box.appendChild(h);

    const binding = widget.binding || null;
    box.appendChild(inlineRow('Bind to', createIdSelect({
        value: binding?.source || '',
        emptyLabel: '— static —',
        options: BINDING_SOURCE_OPTIONS,
        onChange: (v) => {
            if (!v) {
                const next = { ...widget };
                delete next.binding;
                patch(next);
                return;
            }
            patch({
                binding: v === 'variable'
                    ? { source: 'variable', name: '' }
                    : { source: 'inventoryCount', itemId: '', max: 100 }
            });
        }
    })));

    if (binding?.source === 'variable') {
        box.appendChild(inlineRow('Variable', datalistInput({
            value: binding.name || '',
            placeholder: 'score',
            listId: api.nextListId(),
            options: listVariableNameOptions(api.level),
            onChange: (v) => patch({ binding: { ...binding, name: v } })
        })));
    }

    if (binding?.source === 'inventoryCount') {
        const items = api.level?.items || [];
        box.appendChild(inlineRow('Item', createIdSelect({
            value: binding.itemId || '',
            emptyLabel: '— item —',
            options: listItemOptions(items, binding.itemId ? [binding.itemId] : []),
            onChange: (v) => patch({ binding: { ...binding, itemId: v } })
        })));
    }

    if (binding && widget.type === 'progressBar') {
        box.appendChild(inlineRow('Max', scrubNumberInput({
            value: binding.max ?? 100,
            min: 1,
            step: 1,
            onChange: (v) => patch({ binding: { ...binding, max: v == null || v < 1 ? 1 : v } })
        })));
    }

    formEl.appendChild(box);
}

/** @private */
function renderActionSection(formEl, widget, patch, api) {
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #374151;';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:600;margin-bottom:6px;';
    h.textContent = 'On click';
    box.appendChild(h);

    const action = widget.action || null;
    box.appendChild(inlineRow('Action', createIdSelect({
        value: action?.type || '',
        emptyLabel: '— none —',
        options: [{ id: 'customEvent', label: 'Emit custom event' }],
        onChange: (v) => {
            if (!v) {
                const next = { ...widget };
                delete next.action;
                patch(next);
                return;
            }
            patch({ action: { type: 'customEvent', name: '' } });
        }
    })));

    if (action?.type === 'customEvent') {
        box.appendChild(inlineRow('Event', datalistInput({
            value: action.name || '',
            placeholder: 'addScore',
            listId: api.nextListId(),
            options: listCustomEventNameOptions(api.level),
            onChange: (v) => patch({ action: { ...action, name: v } })
        })));
    }

    formEl.appendChild(box);
}
