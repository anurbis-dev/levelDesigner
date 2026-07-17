/**
 * Level-scope Dialogues dock panel (LOGIC_SYSTEMS_PLAN Фаза E authoring UI).
 * List of dialogue graphs → nodes list → form (speaker/text/next|choices).
 */

import {
    createEmptyDialogue,
    cloneDialogues,
    nextDialogueId,
    nextNodeId,
    upsertDialogue,
    removeDialogue,
    upsertNode,
    removeNode,
    normalizeCondition
} from './DialogueModel.js';
import { createIdSelect } from '../LevelObjectPicker.js';

const INPUT_CSS = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
const BTN_CSS = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;';

export class DialoguesPanel {
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
        this.selectedDialogueId = null;
        /** @type {string|null} */
        this.selectedNodeId = null;
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

        this._unsub = stateManager.subscribe?.('dialoguesRevision', () => {
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
        toolbar.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #374151;flex:0 0 auto;';
        const title = document.createElement('span');
        title.style.fontWeight = '600';
        title.textContent = 'Dialogues';
        toolbar.appendChild(title);

        const addDlg = document.createElement('button');
        addDlg.type = 'button';
        addDlg.textContent = '+ Dialogue';
        addDlg.style.cssText = BTN_CSS;
        addDlg.addEventListener('click', () => this._addDialogue());
        toolbar.appendChild(addDlg);

        const delDlg = document.createElement('button');
        delDlg.type = 'button';
        delDlg.textContent = 'Delete dialogue';
        delDlg.style.cssText = BTN_CSS;
        delDlg.addEventListener('click', () => this._deleteDialogue());
        toolbar.appendChild(delDlg);
        this.container.appendChild(toolbar);

        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex:1;min-height:0;';

        this.listEl = document.createElement('div');
        this.listEl.style.cssText = 'width:140px;flex:0 0 140px;border-right:1px solid #374151;overflow:auto;padding:6px;';
        body.appendChild(this.listEl);

        this.nodesEl = document.createElement('div');
        this.nodesEl.style.cssText = 'width:150px;flex:0 0 150px;border-right:1px solid #374151;overflow:auto;padding:6px;';
        body.appendChild(this.nodesEl);

        this.formEl = document.createElement('div');
        this.formEl.style.cssText = 'flex:1;min-width:0;overflow:auto;padding:8px;';
        body.appendChild(this.formEl);

        this.container.appendChild(body);
    }

    render() {
        const level = this.levelEditor?.level;
        if (!level) {
            this.listEl.innerHTML = '<div style="color:#6b7280;">No level</div>';
            this.nodesEl.innerHTML = '';
            this.formEl.innerHTML = '';
            return;
        }
        const list = level.dialogues || [];
        if (this.selectedDialogueId && !list.some((d) => d.id === this.selectedDialogueId)) {
            this.selectedDialogueId = list[0]?.id || null;
            this.selectedNodeId = null;
        }
        if (!this.selectedDialogueId && list[0]) {
            this.selectedDialogueId = list[0].id;
        }
        this._renderList(list);
        const dialogue = list.find((d) => d.id === this.selectedDialogueId) || null;
        if (dialogue && this.selectedNodeId && !dialogue.nodes?.some((n) => n.id === this.selectedNodeId)) {
            this.selectedNodeId = dialogue.startNode || dialogue.nodes?.[0]?.id || null;
        }
        if (dialogue && !this.selectedNodeId) {
            this.selectedNodeId = dialogue.startNode || dialogue.nodes?.[0]?.id || null;
        }
        this._renderNodes(dialogue);
        this._renderForm(dialogue);
    }

    /** @private */
    _getList() {
        return this.levelEditor?.level?.dialogues || [];
    }

    /**
     * @param {Array} nextList
     * @private
     */
    _commitList(nextList) {
        const level = this.levelEditor?.level;
        if (!level) return;
        level.dialogues = cloneDialogues(nextList);
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
                'dialoguesRevision',
                (this.stateManager.get('dialoguesRevision') || 0) + 1
            );
            this.render();
        } finally {
            this._selfPatch = false;
        }
    }

    /**
     * @param {object} dialogue
     * @private
     */
    _commitDialogue(dialogue) {
        this._commitList(upsertDialogue(this._getList(), dialogue));
    }

    /** @private */
    _addDialogue() {
        const id = nextDialogueId(this._getList());
        const d = createEmptyDialogue(id);
        this.selectedDialogueId = id;
        this.selectedNodeId = d.startNode;
        this._commitList(upsertDialogue(this._getList(), d));
    }

    /** @private */
    _deleteDialogue() {
        if (!this.selectedDialogueId) return;
        const id = this.selectedDialogueId;
        this.selectedDialogueId = null;
        this.selectedNodeId = null;
        this._commitList(removeDialogue(this._getList(), id));
    }

    /** @private */
    _renderList(list) {
        this.listEl.innerHTML = '';
        const h = document.createElement('div');
        h.style.cssText = 'color:#9ca3af;margin-bottom:6px;font-weight:600;';
        h.textContent = 'Graphs';
        this.listEl.appendChild(h);
        if (!list.length) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'None — add a dialogue';
            this.listEl.appendChild(empty);
            return;
        }
        for (const d of list) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = d.id;
            const selected = d.id === this.selectedDialogueId;
            btn.style.cssText = [
                'display:block',
                'width:100%',
                'text-align:left',
                'margin-bottom:3px',
                'padding:4px 6px',
                'border-radius:4px',
                'border:1px solid ' + (selected ? '#fbbf24' : '#374151'),
                'background:' + (selected ? '#1e3a5f' : '#1f2937'),
                'color:#e5e7eb',
                'cursor:pointer'
            ].join(';');
            btn.addEventListener('click', () => {
                this.selectedDialogueId = d.id;
                this.selectedNodeId = d.startNode || d.nodes?.[0]?.id || null;
                this.render();
            });
            this.listEl.appendChild(btn);
        }
    }

    /** @private */
    _renderNodes(dialogue) {
        this.nodesEl.innerHTML = '';
        if (!dialogue) {
            this.nodesEl.innerHTML = '<div style="color:#6b7280;">Select a dialogue</div>';
            return;
        }
        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
        const h = document.createElement('span');
        h.style.cssText = 'color:#9ca3af;font-weight:600;';
        h.textContent = 'Nodes';
        head.appendChild(h);
        const add = document.createElement('button');
        add.type = 'button';
        add.textContent = '+';
        add.title = 'Add node';
        add.style.cssText = BTN_CSS + 'width:22px;height:22px;padding:0;';
        add.addEventListener('click', () => {
            const id = nextNodeId(dialogue);
            const node = { id, speaker: '', text: '', next: null };
            const next = upsertNode(dialogue, node);
            this.selectedNodeId = id;
            this._commitDialogue(next);
        });
        head.appendChild(add);
        this.nodesEl.appendChild(head);

        for (const n of dialogue.nodes || []) {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isStart = n.id === dialogue.startNode;
            const selected = n.id === this.selectedNodeId;
            btn.textContent = `${isStart ? '★ ' : ''}${n.id}`;
            btn.title = n.text || n.id;
            btn.style.cssText = [
                'display:block',
                'width:100%',
                'text-align:left',
                'margin-bottom:3px',
                'padding:4px 6px',
                'border-radius:4px',
                'border:1px solid ' + (selected ? '#fbbf24' : '#374151'),
                'background:' + (selected ? '#1e3a5f' : '#1f2937'),
                'color:#e5e7eb',
                'cursor:pointer',
                'overflow:hidden',
                'text-overflow:ellipsis',
                'white-space:nowrap'
            ].join(';');
            btn.addEventListener('click', () => {
                this.selectedNodeId = n.id;
                this.render();
            });
            this.nodesEl.appendChild(btn);
        }
    }

    /** @private */
    _renderForm(dialogue) {
        this.formEl.innerHTML = '';
        if (!dialogue) {
            this.formEl.innerHTML = '<div style="color:#6b7280;">Select or create a dialogue graph</div>';
            return;
        }

        // Dialogue meta
        const meta = document.createElement('div');
        meta.style.cssText = 'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #374151;';

        meta.appendChild(this._fieldLabel('Dialogue id'));
        const idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.value = dialogue.id;
        idInput.style.cssText = INPUT_CSS;
        idInput.addEventListener('change', () => {
            const newId = idInput.value.trim();
            if (!newId || newId === dialogue.id) return;
            if (this._getList().some((d) => d.id === newId)) {
                idInput.value = dialogue.id;
                return;
            }
            const next = cloneDialogues(this._getList());
            const idx = next.findIndex((d) => d.id === dialogue.id);
            if (idx < 0) return;
            next[idx] = { ...next[idx], id: newId };
            this.selectedDialogueId = newId;
            this._commitList(next);
        });
        meta.appendChild(idInput);

        meta.appendChild(this._fieldLabel('Start node'));
        const startSelect = createIdSelect({
            value: dialogue.startNode || '',
            emptyLabel: '—',
            options: (dialogue.nodes || []).map((n) => ({ id: n.id, label: n.id })),
            onChange: (v) => {
                this._commitDialogue({ ...dialogue, startNode: v || null });
            }
        });
        meta.appendChild(startSelect);
        this.formEl.appendChild(meta);

        const node = (dialogue.nodes || []).find((n) => n.id === this.selectedNodeId);
        if (!node) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'Select a node';
            this.formEl.appendChild(empty);
            return;
        }

        const nh = document.createElement('div');
        nh.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
        const nt = document.createElement('span');
        nt.style.fontWeight = '600';
        nt.textContent = `Node ${node.id}`;
        nh.appendChild(nt);
        const delN = document.createElement('button');
        delN.type = 'button';
        delN.textContent = 'Delete node';
        delN.style.cssText = BTN_CSS;
        delN.addEventListener('click', () => {
            this.selectedNodeId = null;
            this._commitDialogue(removeNode(dialogue, node.id));
        });
        nh.appendChild(delN);
        this.formEl.appendChild(nh);

        this.formEl.appendChild(this._fieldLabel('Speaker'));
        const speaker = document.createElement('input');
        speaker.type = 'text';
        speaker.value = node.speaker || '';
        speaker.style.cssText = INPUT_CSS;
        speaker.addEventListener('change', () => {
            this._commitDialogue(upsertNode(dialogue, { ...node, speaker: speaker.value }));
        });
        this.formEl.appendChild(speaker);

        this.formEl.appendChild(this._fieldLabel('Text'));
        const text = document.createElement('textarea');
        text.rows = 3;
        text.value = node.text || '';
        text.style.cssText = INPUT_CSS + 'resize:vertical;';
        text.addEventListener('change', () => {
            this._commitDialogue(upsertNode(dialogue, { ...node, text: text.value }));
        });
        this.formEl.appendChild(text);

        const hasChoices = Array.isArray(node.choices);
        const modeRow = document.createElement('div');
        modeRow.style.cssText = 'margin:10px 0 6px;display:flex;gap:8px;align-items:center;';
        const modeLab = document.createElement('span');
        modeLab.style.color = '#9ca3af';
        modeLab.textContent = 'Branching:';
        modeRow.appendChild(modeLab);
        const modeBtn = document.createElement('button');
        modeBtn.type = 'button';
        modeBtn.textContent = hasChoices ? 'Choices' : 'Linear (next)';
        modeBtn.style.cssText = BTN_CSS;
        modeBtn.addEventListener('click', () => {
            if (hasChoices) {
                const next = { ...node };
                delete next.choices;
                next.next = null;
                this._commitDialogue(upsertNode(dialogue, next));
            } else {
                const next = { ...node };
                delete next.next;
                next.choices = [{ text: 'OK', next: null }];
                this._commitDialogue(upsertNode(dialogue, next));
            }
        });
        modeRow.appendChild(modeBtn);
        this.formEl.appendChild(modeRow);

        if (!hasChoices) {
            this.formEl.appendChild(this._fieldLabel('Next node (empty = end)'));
            const nextSelect = createIdSelect({
                value: node.next ?? '',
                emptyLabel: '— end —',
                options: (dialogue.nodes || [])
                    .filter((n) => n.id !== node.id)
                    .map((n) => ({ id: n.id, label: n.id })),
                onChange: (v) => {
                    this._commitDialogue(upsertNode(dialogue, {
                        ...node,
                        next: v === '' ? null : v
                    }));
                }
            });
            this.formEl.appendChild(nextSelect);
        } else {
            this.formEl.appendChild(this._fieldLabel('Choices'));
            const choicesBox = document.createElement('div');
            (node.choices || []).forEach((choice, index) => {
                choicesBox.appendChild(this._renderChoiceEditor(dialogue, node, choice, index));
            });
            const addChoice = document.createElement('button');
            addChoice.type = 'button';
            addChoice.textContent = '+ Choice';
            addChoice.style.cssText = BTN_CSS + 'margin-top:6px;';
            addChoice.addEventListener('click', () => {
                const choices = [...(node.choices || []), { text: '…', next: null }];
                this._commitDialogue(upsertNode(dialogue, { ...node, choices }));
            });
            choicesBox.appendChild(addChoice);
            this.formEl.appendChild(choicesBox);
        }
    }

    /**
     * @private
     */
    _renderChoiceEditor(dialogue, node, choice, index) {
        const box = document.createElement('div');
        box.style.cssText = 'border:1px solid #374151;border-radius:6px;padding:6px;margin-bottom:6px;background:#0f172a;';

        const head = document.createElement('div');
        head.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;color:#9ca3af;';
        head.textContent = `Choice ${index + 1}`;
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.textContent = '×';
        rm.style.cssText = 'background:transparent;border:none;color:#9ca3af;cursor:pointer;';
        rm.addEventListener('click', () => {
            const choices = (node.choices || []).filter((_, i) => i !== index);
            this._commitDialogue(upsertNode(dialogue, { ...node, choices }));
        });
        head.appendChild(rm);
        box.appendChild(head);

        box.appendChild(this._fieldLabel('Text'));
        const t = document.createElement('input');
        t.type = 'text';
        t.value = choice.text || '';
        t.style.cssText = INPUT_CSS;
        t.addEventListener('change', () => {
            this._patchChoice(dialogue, node, index, { text: t.value });
        });
        box.appendChild(t);

        box.appendChild(this._fieldLabel('Next'));
        const nextSelect = createIdSelect({
            value: choice.next ?? '',
            emptyLabel: '— end —',
            options: (dialogue.nodes || []).map((n) => ({ id: n.id, label: n.id })),
            onChange: (v) => {
                this._patchChoice(dialogue, node, index, { next: v === '' ? null : v });
            }
        });
        box.appendChild(nextSelect);

        box.appendChild(this._fieldLabel('Condition var (empty = always)'));
        const varIn = document.createElement('input');
        varIn.type = 'text';
        varIn.value = choice.condition?.var || '';
        varIn.style.cssText = INPUT_CSS;
        varIn.placeholder = 'hasPass';
        box.appendChild(varIn);

        box.appendChild(this._fieldLabel('Op / value (JSON)'));
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;';
        const opIn = document.createElement('input');
        opIn.type = 'text';
        opIn.value = choice.condition?.op || '==';
        opIn.style.cssText = INPUT_CSS + 'width:48px;';
        const valIn = document.createElement('input');
        valIn.type = 'text';
        valIn.value = choice.condition
            ? JSON.stringify(choice.condition.value)
            : 'true';
        valIn.style.cssText = INPUT_CSS + 'flex:1;';
        row.appendChild(opIn);
        row.appendChild(valIn);
        box.appendChild(row);

        const applyCond = () => {
            const varName = varIn.value.trim();
            if (!varName) {
                this._patchChoice(dialogue, node, index, { condition: undefined, clearCondition: true });
                return;
            }
            let value = true;
            try {
                value = valIn.value.trim() === '' ? true : JSON.parse(valIn.value);
            } catch {
                valIn.style.borderColor = '#ef4444';
                return;
            }
            valIn.style.borderColor = '#4b5563';
            this._patchChoice(dialogue, node, index, {
                condition: normalizeCondition({ var: varName, op: opIn.value.trim() || '==', value })
            });
        };
        varIn.addEventListener('change', applyCond);
        opIn.addEventListener('change', applyCond);
        valIn.addEventListener('change', applyCond);

        return box;
    }

    /**
     * @private
     */
    _patchChoice(dialogue, node, index, patch) {
        const choices = (node.choices || []).map((c, i) => {
            if (i !== index) return c;
            const next = { ...c, ...patch };
            if (patch.clearCondition) delete next.condition;
            delete next.clearCondition;
            return next;
        });
        this._commitDialogue(upsertNode(dialogue, { ...node, choices }));
    }

    /** @private */
    _fieldLabel(text) {
        const el = document.createElement('div');
        el.style.cssText = 'color:#9ca3af;margin:6px 0 2px;';
        el.textContent = text;
        return el;
    }
}
