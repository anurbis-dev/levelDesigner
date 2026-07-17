/**
 * Level-scope Items dock: item definitions, player bag seed, per-NPC bags.
 * English-only UI.
 */

import {
    createEmptyItem,
    cloneItems,
    nextItemId,
    upsertItem,
    removeItem,
    normalizeItem,
    normalizeBagSeed,
    normalizeNpcInventories,
    listItemOptions
} from './ItemModel.js';
import { createIdSelect, listLevelObjectOptions } from '../LevelObjectPicker.js';

const INPUT_CSS = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
const BTN_CSS = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;';

export class ItemsPanel {
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
        this.selectedItemId = null;
        /** @type {string|null} selected NPC objectId for bag editor */
        this.selectedNpcObjectId = null;
        this._selfPatch = false;

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

        this._unsub = stateManager.subscribe?.('inventoryRevision', () => {
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
        title.textContent = 'Items & Inventory';
        toolbar.appendChild(title);

        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+ Item';
        add.style.cssText = BTN_CSS;
        add.addEventListener('click', () => this._addItem());
        toolbar.appendChild(add);

        const del = document.createElement('button');
        del.type = 'button';
        del.textContent = 'Delete item';
        del.style.cssText = BTN_CSS;
        del.addEventListener('click', () => this._deleteItem());
        toolbar.appendChild(del);

        const hint = document.createElement('span');
        hint.style.cssText = 'color:#6b7280;font-size:11px;margin-left:auto;';
        hint.textContent = 'definitions · player bag · NPC bags';
        toolbar.appendChild(hint);
        this.container.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex:1;min-height:0;';

        this.listEl = document.createElement('div');
        this.listEl.style.cssText = 'width:150px;flex:0 0 150px;border-right:1px solid #374151;overflow:auto;padding:6px;';
        body.appendChild(this.listEl);

        this.formEl = document.createElement('div');
        this.formEl.style.cssText = 'flex:1;min-width:0;overflow:auto;padding:8px;';
        body.appendChild(this.formEl);

        this.container.appendChild(body);
    }

    render() {
        const level = this.levelEditor?.level;
        if (!level) {
            this.listEl.innerHTML = '<div style="color:#6b7280;">No level</div>';
            this.formEl.innerHTML = '';
            return;
        }
        const items = level.items || [];
        if (this.selectedItemId && !items.some((i) => i.id === this.selectedItemId)) {
            this.selectedItemId = items[0]?.id || null;
        }
        if (!this.selectedItemId && items[0]) this.selectedItemId = items[0].id;

        this._renderList(items);
        this._renderForm(level);
    }

    /** @private */
    _commit(patch) {
        const level = this.levelEditor?.level;
        if (!level) return;
        if (patch.items !== undefined) level.items = cloneItems(patch.items);
        if (patch.inventory !== undefined) {
            level.inventory = normalizeBagSeed(patch.inventory);
        }
        if (patch.npcInventories !== undefined) {
            level.npcInventories = normalizeNpcInventories(patch.npcInventories);
        }
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
                'inventoryRevision',
                (this.stateManager.get('inventoryRevision') || 0) + 1
            );
            this.render();
        } finally {
            this._selfPatch = false;
        }
    }

    /** @private */
    _addItem() {
        const list = this.levelEditor?.level?.items || [];
        const id = nextItemId(list);
        const item = createEmptyItem(id);
        this.selectedItemId = id;
        this._commit({ items: upsertItem(list, item) });
    }

    /** @private */
    _deleteItem() {
        if (!this.selectedItemId) return;
        const id = this.selectedItemId;
        this.selectedItemId = null;
        this._commit({ items: removeItem(this.levelEditor.level.items || [], id) });
    }

    /** @private */
    _renderList(items) {
        this.listEl.innerHTML = '';
        const h = document.createElement('div');
        h.style.cssText = 'color:#9ca3af;margin-bottom:6px;font-weight:600;';
        h.textContent = 'Definitions';
        this.listEl.appendChild(h);
        if (!items.length) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'None — add an item';
            this.listEl.appendChild(empty);
            return;
        }
        for (const it of items) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = it.displayName || it.id;
            btn.title = it.id;
            const selected = it.id === this.selectedItemId;
            btn.style.cssText = [
                'display:block', 'width:100%', 'text-align:left', 'margin-bottom:3px',
                'padding:4px 6px', 'border-radius:4px',
                'border:1px solid ' + (selected ? '#fbbf24' : '#374151'),
                'background:' + (selected ? '#1e3a5f' : '#1f2937'),
                'color:#e5e7eb', 'cursor:pointer',
                'overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap'
            ].join(';');
            btn.addEventListener('click', () => {
                this.selectedItemId = it.id;
                this.render();
            });
            this.listEl.appendChild(btn);
        }
    }

    /** @private */
    _renderForm(level) {
        this.formEl.innerHTML = '';
        const items = level.items || [];
        const item = items.find((i) => i.id === this.selectedItemId) || null;

        // —— Definition ——
        const defSec = document.createElement('div');
        defSec.style.cssText = 'margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #374151;';
        const defH = document.createElement('div');
        defH.style.cssText = 'font-weight:600;margin-bottom:8px;';
        defH.textContent = 'Item definition';
        defSec.appendChild(defH);

        if (!item) {
            defSec.appendChild(this._muted('Select or create an item definition'));
        } else {
            defSec.appendChild(this._fieldLabel('Id (itemId)'));
            const idIn = document.createElement('input');
            idIn.type = 'text';
            idIn.value = item.id;
            idIn.style.cssText = INPUT_CSS;
            idIn.addEventListener('change', () => {
                const newId = idIn.value.trim();
                if (!newId || newId === item.id) return;
                if (items.some((i) => i.id === newId)) {
                    idIn.value = item.id;
                    return;
                }
                const next = cloneItems(items);
                const idx = next.findIndex((i) => i.id === item.id);
                if (idx < 0) return;
                next[idx] = normalizeItem({ ...next[idx], id: newId });
                this.selectedItemId = newId;
                this._commit({ items: next });
            });
            defSec.appendChild(idIn);

            defSec.appendChild(this._fieldLabel('Display name'));
            const nameIn = document.createElement('input');
            nameIn.type = 'text';
            nameIn.value = item.displayName || '';
            nameIn.style.cssText = INPUT_CSS;
            nameIn.addEventListener('change', () => {
                this._commit({
                    items: upsertItem(items, { ...item, displayName: nameIn.value })
                });
            });
            defSec.appendChild(nameIn);

            defSec.appendChild(this._fieldLabel('Description'));
            const desc = document.createElement('textarea');
            desc.rows = 2;
            desc.value = item.description || '';
            desc.style.cssText = INPUT_CSS + 'resize:vertical;';
            desc.addEventListener('change', () => {
                this._commit({
                    items: upsertItem(items, { ...item, description: desc.value })
                });
            });
            defSec.appendChild(desc);
        }
        this.formEl.appendChild(defSec);

        // —— Player bag ——
        const playerSec = document.createElement('div');
        playerSec.style.cssText = 'margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #374151;';
        const ph = document.createElement('div');
        ph.style.cssText = 'font-weight:600;margin-bottom:8px;';
        ph.textContent = 'Player bag (Play seed)';
        playerSec.appendChild(ph);
        playerSec.appendChild(this._bagEditor(
            items,
            normalizeBagSeed(level.inventory),
            (rows) => this._commit({ inventory: rows })
        ));
        this.formEl.appendChild(playerSec);

        // —— NPC bags ——
        const npcSec = document.createElement('div');
        const nh = document.createElement('div');
        nh.style.cssText = 'font-weight:600;margin-bottom:8px;';
        nh.textContent = 'NPC bags (by object)';
        npcSec.appendChild(nh);

        const npcMap = normalizeNpcInventories(level.npcInventories);
        const objectOpts = listLevelObjectOptions(level);
        npcSec.appendChild(this._fieldLabel('Object'));
        const objSelect = createIdSelect({
            value: this.selectedNpcObjectId || '',
            emptyLabel: '— select object —',
            options: objectOpts,
            onChange: (v) => {
                this.selectedNpcObjectId = v || null;
                this.render();
            }
        });
        npcSec.appendChild(objSelect);

        // List objects that already have bags
        const keys = Object.keys(npcMap);
        if (keys.length) {
            const known = document.createElement('div');
            known.style.cssText = 'color:#6b7280;font-size:11px;margin:6px 0;';
            known.textContent = 'Bags defined: ' + keys.join(', ');
            npcSec.appendChild(known);
        }

        if (this.selectedNpcObjectId) {
            const bag = npcMap[this.selectedNpcObjectId] || [];
            npcSec.appendChild(this._bagEditor(items, bag, (rows) => {
                const next = { ...npcMap };
                if (!rows.length) delete next[this.selectedNpcObjectId];
                else next[this.selectedNpcObjectId] = rows;
                this._commit({ npcInventories: next });
            }));
        } else {
            npcSec.appendChild(this._muted('Select a level object to edit its bag'));
        }
        this.formEl.appendChild(npcSec);
    }

    /**
     * @private
     * @param {Array} items
     * @param {{itemId:string,count:number}[]} rows
     * @param {(rows: {itemId:string,count:number}[]) => void} onChange
     */
    _bagEditor(items, rows, onChange) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'border:1px solid #374151;border-radius:6px;padding:6px;background:#0f172a;';

        const opts = listItemOptions(items, rows.map((r) => r.itemId));

        rows.forEach((row, index) => {
            const line = document.createElement('div');
            line.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;';

            const sel = createIdSelect({
                value: row.itemId || '',
                emptyLabel: '— item —',
                options: opts,
                onChange: (v) => {
                    const next = rows.map((r, i) => (i === index ? { ...r, itemId: v } : r));
                    onChange(normalizeBagSeed(next));
                }
            });
            sel.style.flex = '1';
            line.appendChild(sel);

            // free-text fallback when no defs
            if (!opts.length) {
                const free = document.createElement('input');
                free.type = 'text';
                free.placeholder = 'itemId';
                free.value = row.itemId || '';
                free.style.cssText = INPUT_CSS + 'flex:1;';
                free.addEventListener('change', () => {
                    const next = rows.map((r, i) => (
                        i === index ? { ...r, itemId: free.value.trim() } : r
                    ));
                    onChange(normalizeBagSeed(next));
                });
                line.innerHTML = '';
                line.appendChild(free);
            }

            const cnt = document.createElement('input');
            cnt.type = 'number';
            cnt.min = '1';
            cnt.value = String(row.count ?? 1);
            cnt.style.cssText = INPUT_CSS + 'width:56px;';
            cnt.addEventListener('change', () => {
                const next = rows.map((r, i) => (
                    i === index ? { ...r, count: Number(cnt.value) || 1 } : r
                ));
                onChange(normalizeBagSeed(next));
            });
            line.appendChild(cnt);

            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '×';
            rm.style.cssText = 'background:transparent;border:none;color:#9ca3af;cursor:pointer;';
            rm.addEventListener('click', () => {
                onChange(rows.filter((_, i) => i !== index));
            });
            line.appendChild(rm);
            wrap.appendChild(line);
        });

        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+ Stack';
        add.style.cssText = BTN_CSS;
        add.addEventListener('click', () => {
            const defaultId = items[0]?.id || '';
            onChange([...rows, { itemId: defaultId, count: 1 }]);
        });
        wrap.appendChild(add);
        return wrap;
    }

    /** @private */
    _fieldLabel(text) {
        const el = document.createElement('div');
        el.style.cssText = 'color:#9ca3af;margin:6px 0 2px;font-size:11px;';
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
