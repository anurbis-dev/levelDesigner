/**
 * Level-scope Event Graph dock panel (LOGIC_SYSTEMS_PLAN — UI after phases C/D).
 * Layout: toolbar + palette | canvas | details + variables + play watch.
 */

import {
    listNodeDefs,
    getNodeDef,
    NODE_CATEGORY_LABELS
} from './EventGraphNodeCatalog.js';
import {
    addNode,
    removeNode,
    updateNode,
    cloneEventGraph,
    createEmptyEventGraph,
    ensureLevelEventGraph,
    upsertVariable,
    removeVariable
} from './EventGraphModel.js';
import { EventGraphCanvas } from './EventGraphCanvas.js';
import {
    listLevelObjectOptions,
    listDialogueOptions,
    createIdSelect
} from '../LevelObjectPicker.js';
import { Logger } from '../../utils/Logger.js';

export class EventGraphPanel {
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

        this.selectedNodeId = null;
        /** @type {EventGraphCanvas|null} */
        this.canvas = null;
        this._watchRaf = null;
        this._selfPatch = false;
        this._built = false;

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

        this._unsubs = [];
        this._unsubs.push(
            stateManager.subscribe?.('playMode', () => this._onPlayMode()) || (() => {})
        );
        this._unsubs.push(
            stateManager.subscribe?.('eventGraphRevision', () => {
                if (!this._selfPatch) this.render();
            }) || (() => {})
        );

        this._buildShell();
        this.render();
    }

    destroy() {
        this._stopWatch();
        this.canvas?.destroy();
        this.canvas = null;
        for (const u of this._unsubs) {
            try { u(); } catch { /* ignore */ }
        }
        this._unsubs = [];
        this.container.innerHTML = '';
    }

    /** @private */
    _buildShell() {
        this.container.innerHTML = '';

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'event-graph-toolbar';
        toolbar.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #374151;flex:0 0 auto;flex-wrap:wrap;';

        const addSelect = document.createElement('select');
        addSelect.title = 'Add node';
        addSelect.style.cssText = 'max-width:180px;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 4px;';
        const opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '+ Add node…';
        addSelect.appendChild(opt0);
        for (const cat of ['entry', 'condition', 'action']) {
            const group = document.createElement('optgroup');
            group.label = NODE_CATEGORY_LABELS[cat] || cat;
            for (const def of listNodeDefs(cat)) {
                const o = document.createElement('option');
                o.value = def.type;
                o.textContent = def.label;
                group.appendChild(o);
            }
            addSelect.appendChild(group);
        }
        addSelect.addEventListener('change', () => {
            const type = addSelect.value;
            addSelect.value = '';
            if (type) this._addNode(type);
        });
        toolbar.appendChild(addSelect);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.textContent = 'Delete node';
        delBtn.style.cssText = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 8px;cursor:pointer;';
        delBtn.addEventListener('click', () => this._deleteSelected());
        toolbar.appendChild(delBtn);

        const hint = document.createElement('span');
        hint.style.cssText = 'color:#9ca3af;margin-left:auto;font-size:11px;';
        hint.textContent = 'Drag out→in to wire · Shift+click in-port: clear ins · MMB/Alt/Space pan · wheel zoom';
        toolbar.appendChild(hint);
        this.container.appendChild(toolbar);

        // Body: canvas | side
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex:1;min-height:0;';

        const canvasHost = document.createElement('div');
        canvasHost.style.cssText = 'flex:1;min-width:0;min-height:0;position:relative;';
        body.appendChild(canvasHost);

        const side = document.createElement('div');
        side.style.cssText = 'width:220px;flex:0 0 220px;border-left:1px solid #374151;display:flex;flex-direction:column;min-height:0;overflow:hidden;';
        body.appendChild(side);

        this.detailsEl = document.createElement('div');
        this.detailsEl.style.cssText = 'padding:8px;border-bottom:1px solid #374151;overflow:auto;flex:0 0 auto;max-height:45%;';
        side.appendChild(this.detailsEl);

        this.varsEl = document.createElement('div');
        this.varsEl.style.cssText = 'padding:8px;border-bottom:1px solid #374151;overflow:auto;flex:1;min-height:60px;';
        side.appendChild(this.varsEl);

        this.watchEl = document.createElement('div');
        this.watchEl.style.cssText = 'padding:8px;overflow:auto;flex:0 0 auto;max-height:30%;background:#0b1220;';
        side.appendChild(this.watchEl);

        this.container.appendChild(body);

        this.canvas = new EventGraphCanvas(canvasHost, {
            onChange: (g) => this._commitGraph(g, { keepSelection: true }),
            onSelectNode: (id) => {
                this.selectedNodeId = id;
                this._renderDetails();
            },
            getActiveNodeIds: () => this._getActiveNodeIds()
        });

        this._built = true;
    }

    render() {
        if (!this._built) return;
        const level = this.levelEditor?.level;
        if (!level) {
            this.canvas?.setGraph(null, null);
            this.detailsEl.innerHTML = '<div style="color:#9ca3af;">No level</div>';
            this.varsEl.innerHTML = '';
            this.watchEl.innerHTML = '';
            return;
        }
        const graph = level.eventGraph || createEmptyEventGraph();
        if (this.selectedNodeId && !(graph.nodes || []).some((n) => n.id === this.selectedNodeId)) {
            this.selectedNodeId = null;
        }
        this.canvas?.setGraph(graph, this.selectedNodeId);
        this._renderDetails();
        this._renderVariables();
        this._renderWatchStatic();
        this._onPlayMode();
    }

    /** @private */
    _getGraph() {
        const level = this.levelEditor?.level;
        if (!level) return createEmptyEventGraph();
        return level.eventGraph || createEmptyEventGraph();
    }

    /**
     * @param {object} nextGraph
     * @param {{ keepSelection?: boolean, skipHistory?: boolean }} [opts]
     * @private
     */
    _commitGraph(nextGraph, opts = {}) {
        const level = this.levelEditor?.level;
        if (!level) return;

        // Mutate first, then push snapshot (same order as ObjectOperations).
        level.eventGraph = cloneEventGraph(nextGraph);

        if (!opts.skipHistory) {
            this.levelEditor.historyManager?.saveState(
                level.objects,
                this.stateManager.get('selectedObjects'),
                false,
                this.stateManager.get('groupEditMode')
            );
        }

        this.stateManager.markDirty?.();

        this._selfPatch = true;
        try {
            this.stateManager.set?.('eventGraphRevision', (this.stateManager.get('eventGraphRevision') || 0) + 1);
            this.canvas?.setGraph(level.eventGraph, this.selectedNodeId);
            this._renderDetails();
            this._renderVariables();
        } finally {
            this._selfPatch = false;
        }
    }

    /** @private */
    _addNode(type) {
        const g = this._getGraph();
        const cam = this.canvas?.camera || { x: 0, y: 0 };
        const pos = {
            x: Math.round(cam.x + 40 + (g.nodes?.length || 0) * 12),
            y: Math.round(cam.y + 40 + (g.nodes?.length || 0) * 18)
        };
        const { graph, nodeId } = addNode(g, type, pos);
        this.selectedNodeId = nodeId;
        this._commitGraph(graph, { keepSelection: true });
        this.canvas?.setSelectedNodeId(nodeId);
    }

    /** @private */
    _deleteSelected() {
        if (!this.selectedNodeId) return;
        const next = removeNode(this._getGraph(), this.selectedNodeId);
        this.selectedNodeId = null;
        this._commitGraph(next);
    }

    /** @private */
    _renderDetails() {
        const node = (this._getGraph().nodes || []).find((n) => n.id === this.selectedNodeId);
        if (!node) {
            this.detailsEl.innerHTML = '<div style="color:#9ca3af;font-weight:600;margin-bottom:6px;">Node</div>'
                + '<div style="color:#6b7280;">Select a node on the canvas</div>';
            return;
        }
        const def = getNodeDef(node.type);
        this.detailsEl.innerHTML = '';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:6px;';
        title.textContent = `${def?.label || node.type} (${node.id})`;
        this.detailsEl.appendChild(title);

        const fields = def?.fields || [];
        if (fields.length === 0) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'No parameters';
            this.detailsEl.appendChild(empty);
            return;
        }

        for (const field of fields) {
            const row = document.createElement('label');
            row.style.cssText = 'display:block;margin-bottom:6px;';
            const lab = document.createElement('div');
            lab.style.cssText = 'color:#9ca3af;margin-bottom:2px;';
            lab.textContent = field.label;
            row.appendChild(lab);

            let input;
            const raw = node.params?.[field.key];
            if (field.type === 'boolean') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!raw;
                input.addEventListener('change', () => {
                    this._patchParams(node.id, { [field.key]: input.checked });
                });
            } else if (field.type === 'number') {
                input = document.createElement('input');
                input.type = 'number';
                input.value = raw ?? '';
                input.style.cssText = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
                input.addEventListener('change', () => {
                    const n = Number(input.value);
                    this._patchParams(node.id, { [field.key]: Number.isFinite(n) ? n : 0 });
                });
            } else if (field.type === 'json') {
                input = document.createElement('textarea');
                input.rows = 3;
                input.value = raw === undefined ? '' : JSON.stringify(raw);
                input.style.cssText = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;font-family:monospace;font-size:11px;';
                input.addEventListener('change', () => {
                    try {
                        const parsed = input.value.trim() === '' ? null : JSON.parse(input.value);
                        this._patchParams(node.id, { [field.key]: parsed });
                        input.style.borderColor = '#4b5563';
                    } catch {
                        input.style.borderColor = '#ef4444';
                        Logger.ui?.warn?.('EventGraphPanel: invalid JSON for ' + field.key);
                    }
                });
            } else if (field.type === 'objectId') {
                input = createIdSelect({
                    value: raw ?? '',
                    emptyLabel: '— object —',
                    options: listLevelObjectOptions(this.levelEditor?.level),
                    onChange: (v) => this._patchParams(node.id, { [field.key]: v })
                });
            } else if (field.type === 'dialogueId') {
                input = createIdSelect({
                    value: raw ?? '',
                    emptyLabel: '— dialogue —',
                    options: listDialogueOptions(this.levelEditor?.level),
                    onChange: (v) => this._patchParams(node.id, { [field.key]: v })
                });
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.value = raw ?? '';
                input.style.cssText = 'width:100%;box-sizing:border-box;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:3px 6px;';
                input.addEventListener('change', () => {
                    this._patchParams(node.id, { [field.key]: input.value });
                });
            }
            row.appendChild(input);
            this.detailsEl.appendChild(row);
        }
    }

    /** @private */
    _patchParams(nodeId, paramsPatch) {
        const next = updateNode(this._getGraph(), nodeId, { params: paramsPatch });
        this._commitGraph(next, { keepSelection: true });
    }

    /** @private */
    _renderVariables() {
        const graph = this._getGraph();
        this.varsEl.innerHTML = '';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;';
        title.innerHTML = '<span>Variables</span>';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = '+';
        addBtn.title = 'Add variable';
        addBtn.style.cssText = 'background:#374151;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;width:22px;height:22px;cursor:pointer;';
        addBtn.addEventListener('click', () => {
            const name = prompt('Variable name');
            if (!name) return;
            const next = upsertVariable(this._getGraph(), { name: name.trim(), type: 'bool', default: false });
            this._commitGraph(next, { keepSelection: true });
        });
        title.appendChild(addBtn);
        this.varsEl.appendChild(title);

        const vars = graph.variables || [];
        if (vars.length === 0) {
            const empty = document.createElement('div');
            empty.style.color = '#6b7280';
            empty.textContent = 'No variables';
            this.varsEl.appendChild(empty);
            return;
        }

        for (const v of vars) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;';
            const nameEl = document.createElement('span');
            nameEl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;';
            nameEl.textContent = v.name;
            nameEl.title = `${v.name} (${v.type ?? 'any'}) = ${JSON.stringify(v.default)}`;
            row.appendChild(nameEl);

            const defInput = document.createElement('input');
            defInput.type = 'text';
            defInput.value = v.default === undefined ? '' : JSON.stringify(v.default);
            defInput.title = 'Default (JSON)';
            defInput.style.cssText = 'width:72px;background:#1f2937;color:#e5e7eb;border:1px solid #4b5563;border-radius:4px;padding:2px 4px;font-size:11px;';
            defInput.addEventListener('change', () => {
                try {
                    const val = defInput.value.trim() === '' ? false : JSON.parse(defInput.value);
                    const next = upsertVariable(this._getGraph(), { name: v.name, type: v.type || 'bool', default: val });
                    this._commitGraph(next, { keepSelection: true });
                } catch {
                    defInput.style.borderColor = '#ef4444';
                }
            });
            row.appendChild(defInput);

            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '×';
            rm.style.cssText = 'background:transparent;color:#9ca3af;border:none;cursor:pointer;font-size:14px;';
            rm.addEventListener('click', () => {
                this._commitGraph(removeVariable(this._getGraph(), v.name), { keepSelection: true });
            });
            row.appendChild(rm);
            this.varsEl.appendChild(row);
        }
    }

    /** @private */
    _renderWatchStatic() {
        // filled by _tickWatch when playing
        if (!this.stateManager.get('playMode')) {
            this.watchEl.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">Watch</div>'
                + '<div style="color:#6b7280;">Start Play to watch live variables</div>';
        }
    }

    /** @private */
    _onPlayMode() {
        if (this.stateManager.get('playMode')) {
            this._startWatch();
        } else {
            this._stopWatch();
            this._renderWatchStatic();
            this.canvas?.draw();
        }
    }

    /** @private */
    _startWatch() {
        this._stopWatch();
        const tick = () => {
            this._tickWatch();
            this.canvas?.draw();
            this._watchRaf = requestAnimationFrame(tick);
        };
        this._watchRaf = requestAnimationFrame(tick);
    }

    /** @private */
    _stopWatch() {
        if (this._watchRaf != null) {
            cancelAnimationFrame(this._watchRaf);
            this._watchRaf = null;
        }
    }

    /** @private */
    _getRuntime() {
        return this.levelEditor?.playOperations?._engine?.scene?.eventGraphRuntime || null;
    }

    /** @private */
    _getActiveNodeIds() {
        const rt = this._getRuntime();
        if (!rt?.recentNodeIds) return new Set();
        return rt.recentNodeIds instanceof Set ? rt.recentNodeIds : new Set(rt.recentNodeIds);
    }

    /** @private */
    _tickWatch() {
        const rt = this._getRuntime();
        this.watchEl.innerHTML = '';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:600;margin-bottom:4px;';
        title.textContent = 'Watch (Play)';
        this.watchEl.appendChild(title);
        if (!rt) {
            const m = document.createElement('div');
            m.style.color = '#6b7280';
            m.textContent = 'Runtime not ready';
            this.watchEl.appendChild(m);
            return;
        }
        const entries = [...(rt.variables?.entries?.() || [])];
        if (entries.length === 0) {
            const m = document.createElement('div');
            m.style.color = '#6b7280';
            m.textContent = '(no variables)';
            this.watchEl.appendChild(m);
            return;
        }
        for (const [name, value] of entries) {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;justify-content:space-between;gap:6px;font-family:monospace;font-size:11px;';
            const n = document.createElement('span');
            n.textContent = name;
            n.style.color = '#93c5fd';
            const v = document.createElement('span');
            v.textContent = JSON.stringify(value);
            v.style.color = '#e5e7eb';
            row.appendChild(n);
            row.appendChild(v);
            this.watchEl.appendChild(row);
        }
    }

    /**
     * Ensure graph exists on level (for external callers).
     */
    ensureGraph() {
        const level = this.levelEditor?.level;
        if (level) ensureLevelEventGraph(level);
    }
}
