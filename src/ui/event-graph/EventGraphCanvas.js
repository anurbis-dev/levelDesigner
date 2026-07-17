/**
 * Canvas widget for Event Graph: pan, node drag, select, wire edges (out → in).
 * Does not own the graph — calls onChange(nextGraph) with immutable snapshots.
 */

import { getNodeDef, NODE_CATEGORY_COLORS } from './EventGraphNodeCatalog.js';
import { addEdge, removeEdge, updateNode } from './EventGraphModel.js';

const NODE_W = 150;
const NODE_H = 48;
const PORT_R = 6;

export class EventGraphCanvas {
    /**
     * @param {HTMLElement} host
     * @param {{
     *   onChange: (graph: object) => void,
     *   onSelectNode: (nodeId: string|null) => void,
     *   getActiveNodeIds?: () => Set<string>|string[]
     * }} callbacks
     */
    constructor(host, callbacks = {}) {
        this.host = host;
        this.onChange = callbacks.onChange || (() => {});
        this.onSelectNode = callbacks.onSelectNode || (() => {});
        this.getActiveNodeIds = callbacks.getActiveNodeIds || (() => new Set());

        /** @type {object|null} */
        this.graph = null;
        this.selectedNodeId = null;

        this.camera = { x: 0, y: 0, zoom: 1 };
        this._drag = null; // { kind, nodeId?, startX, startY, origX, origY, fromId? }
        this._spacePan = false;

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'event-graph-canvas';
        this.canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:default;background:#111827;';
        this.ctx = this.canvas.getContext('2d');
        this.host.appendChild(this.canvas);

        this._onResize = () => this._resize();
        this._ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._onResize) : null;
        this._ro?.observe(this.host);

        this._boundDown = (e) => this._pointerDown(e);
        this._boundMove = (e) => this._pointerMove(e);
        this._boundUp = (e) => this._pointerUp(e);
        this._boundWheel = (e) => this._wheel(e);
        this._boundKeyDown = (e) => this._keyDown(e);
        this._boundKeyUp = (e) => this._keyUp(e);
        this._boundContext = (e) => e.preventDefault();

        this.canvas.addEventListener('pointerdown', this._boundDown);
        window.addEventListener('pointermove', this._boundMove);
        window.addEventListener('pointerup', this._boundUp);
        this.canvas.addEventListener('wheel', this._boundWheel, { passive: false });
        window.addEventListener('keydown', this._boundKeyDown);
        window.addEventListener('keyup', this._boundKeyUp);
        this.canvas.addEventListener('contextmenu', this._boundContext);

        this._resize();
    }

    /**
     * @param {object|null} graph
     * @param {string|null} [selectedNodeId]
     */
    setGraph(graph, selectedNodeId = this.selectedNodeId) {
        this.graph = graph;
        this.selectedNodeId = selectedNodeId;
        this.draw();
    }

    setSelectedNodeId(nodeId) {
        this.selectedNodeId = nodeId;
        this.draw();
    }

    destroy() {
        this._ro?.disconnect();
        this.canvas.removeEventListener('pointerdown', this._boundDown);
        window.removeEventListener('pointermove', this._boundMove);
        window.removeEventListener('pointerup', this._boundUp);
        this.canvas.removeEventListener('wheel', this._boundWheel);
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        this.canvas.removeEventListener('contextmenu', this._boundContext);
        this.canvas.remove();
    }

    /** @private */
    _resize() {
        const rect = this.host.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(rect.width));
        const h = Math.max(1, Math.floor(rect.height));
        this.canvas.width = Math.floor(w * dpr);
        this.canvas.height = Math.floor(h * dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        if (!ctx) return;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        ctx.clearRect(0, 0, w, h);

        // grid
        ctx.save();
        ctx.translate(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        this._drawGrid(ctx, w, h);

        const nodes = this.graph?.nodes || [];
        const edges = this.graph?.edges || [];
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const active = new Set(this.getActiveNodeIds?.() || []);

        for (const e of edges) {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) continue;
            this._drawEdge(ctx, a, b);
        }

        if (this._drag?.kind === 'wire' && this._drag.fromId) {
            const a = byId.get(this._drag.fromId);
            if (a) {
                const out = this._outPort(a);
                ctx.strokeStyle = '#93c5fd';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(out.x, out.y);
                ctx.lineTo(this._drag.wx, this._drag.wy);
                ctx.stroke();
            }
        }

        for (const node of nodes) {
            this._drawNode(ctx, node, node.id === this.selectedNodeId, active.has(node.id));
        }
        ctx.restore();
    }

    /** @private */
    _drawGrid(ctx, cssW, cssH) {
        const z = this.camera.zoom || 1;
        const left = this.camera.x;
        const top = this.camera.y;
        const right = left + cssW / z;
        const bottom = top + cssH / z;
        const step = 24;
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1 / z;
        ctx.beginPath();
        for (let x = Math.floor(left / step) * step; x < right; x += step) {
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
        }
        for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
        }
        ctx.stroke();
    }

    /** @private */
    _nodePos(node) {
        return {
            x: node.position?.x ?? 0,
            y: node.position?.y ?? 0
        };
    }

    /** @private */
    _outPort(node) {
        const p = this._nodePos(node);
        return { x: p.x + NODE_W, y: p.y + NODE_H / 2 };
    }

    /** @private */
    _inPort(node) {
        const p = this._nodePos(node);
        return { x: p.x, y: p.y + NODE_H / 2 };
    }

    /** @private */
    _drawEdge(ctx, a, b) {
        const from = this._outPort(a);
        const to = this._inPort(b);
        const dx = Math.max(40, (to.x - from.x) * 0.5);
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.bezierCurveTo(from.x + dx, from.y, to.x - dx, to.y, to.x, to.y);
        ctx.stroke();
    }

    /** @private */
    _drawNode(ctx, node, selected, active) {
        const p = this._nodePos(node);
        const def = getNodeDef(node.type);
        const color = NODE_CATEGORY_COLORS[def?.category] || '#4b5563';

        ctx.fillStyle = active ? '#1e3a5f' : '#1f2937';
        ctx.strokeStyle = selected ? '#fbbf24' : color;
        ctx.lineWidth = selected ? 2.5 : 1.5;
        this._roundRect(ctx, p.x, p.y, NODE_W, NODE_H, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillRect(p.x, p.y, 6, NODE_H);

        ctx.fillStyle = '#e5e7eb';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const label = def?.label || node.type;
        ctx.fillText(label, p.x + 14, p.y + NODE_H / 2 - 6, NODE_W - 28);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px system-ui, sans-serif';
        ctx.fillText(node.id, p.x + 14, p.y + NODE_H / 2 + 10, NODE_W - 28);

        // ports
        const out = this._outPort(node);
        const inn = this._inPort(node);
        ctx.fillStyle = '#93c5fd';
        ctx.beginPath();
        ctx.arc(out.x, out.y, PORT_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a7f3d0';
        ctx.beginPath();
        ctx.arc(inn.x, inn.y, PORT_R, 0, Math.PI * 2);
        ctx.fill();
    }

    /** @private */
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    /** @private */
    _screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left;
        const sy = clientY - rect.top;
        return {
            x: sx / this.camera.zoom + this.camera.x,
            y: sy / this.camera.zoom + this.camera.y
        };
    }

    /** @private */
    _hitNode(wx, wy) {
        const nodes = this.graph?.nodes || [];
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const p = this._nodePos(n);
            if (wx >= p.x && wx <= p.x + NODE_W && wy >= p.y && wy <= p.y + NODE_H) {
                return n;
            }
        }
        return null;
    }

    /** @private */
    _hitOutPort(wx, wy) {
        for (const n of this.graph?.nodes || []) {
            const o = this._outPort(n);
            const dx = wx - o.x;
            const dy = wy - o.y;
            if (dx * dx + dy * dy <= (PORT_R + 4) ** 2) return n;
        }
        return null;
    }

    /** @private */
    _hitInPort(wx, wy) {
        for (const n of this.graph?.nodes || []) {
            const o = this._inPort(n);
            const dx = wx - o.x;
            const dy = wy - o.y;
            if (dx * dx + dy * dy <= (PORT_R + 4) ** 2) return n;
        }
        return null;
    }

    /** @private */
    _pointerDown(e) {
        if (e.button === 1 || (e.button === 0 && (this._spacePan || e.altKey))) {
            this._drag = {
                kind: 'pan',
                startX: e.clientX,
                startY: e.clientY,
                origX: this.camera.x,
                origY: this.camera.y
            };
            this.canvas.setPointerCapture?.(e.pointerId);
            return;
        }
        if (e.button !== 0) return;

        const w = this._screenToWorld(e.clientX, e.clientY);
        const outNode = this._hitOutPort(w.x, w.y);
        if (outNode) {
            this._drag = { kind: 'wire', fromId: outNode.id, wx: w.x, wy: w.y };
            this.canvas.setPointerCapture?.(e.pointerId);
            this.draw();
            return;
        }

        // Alt+click in-port or edge delete: click near existing edge midpoint — skip MVP
        // Double-click in-port with shift removes edges into that node
        if (e.shiftKey) {
            const inNode = this._hitInPort(w.x, w.y);
            if (inNode && this.graph) {
                let g = this.graph;
                for (const edge of [...(g.edges || [])]) {
                    if (edge.to === inNode.id) g = removeEdge(g, edge.from, edge.to);
                }
                this.onChange(g);
                return;
            }
        }

        const node = this._hitNode(w.x, w.y);
        if (node) {
            this.selectedNodeId = node.id;
            this.onSelectNode(node.id);
            const p = this._nodePos(node);
            this._drag = {
                kind: 'node',
                nodeId: node.id,
                startX: e.clientX,
                startY: e.clientY,
                origX: p.x,
                origY: p.y,
                moved: false
            };
            this.draw();
            return;
        }

        this.selectedNodeId = null;
        this.onSelectNode(null);
        this.draw();
    }

    /** @private */
    _pointerMove(e) {
        if (!this._drag) return;
        if (this._drag.kind === 'pan') {
            const dx = (e.clientX - this._drag.startX) / this.camera.zoom;
            const dy = (e.clientY - this._drag.startY) / this.camera.zoom;
            this.camera.x = this._drag.origX - dx;
            this.camera.y = this._drag.origY - dy;
            this.draw();
            return;
        }
        if (this._drag.kind === 'wire') {
            const w = this._screenToWorld(e.clientX, e.clientY);
            this._drag.wx = w.x;
            this._drag.wy = w.y;
            this.draw();
            return;
        }
        if (this._drag.kind === 'node') {
            const dx = (e.clientX - this._drag.startX) / this.camera.zoom;
            const dy = (e.clientY - this._drag.startY) / this.camera.zoom;
            if (Math.abs(dx) + Math.abs(dy) > 2) this._drag.moved = true;
            if (this.graph && this._drag.moved) {
                const next = updateNode(this.graph, this._drag.nodeId, {
                    position: {
                        x: Math.round(this._drag.origX + dx),
                        y: Math.round(this._drag.origY + dy)
                    }
                });
                // live visual without history until pointerup
                this.graph = next;
                this.draw();
            }
        }
    }

    /** @private */
    _pointerUp(e) {
        if (!this._drag) return;
        const drag = this._drag;
        this._drag = null;

        if (drag.kind === 'wire' && this.graph) {
            const w = this._screenToWorld(e.clientX, e.clientY);
            const target = this._hitInPort(w.x, w.y) || this._hitNode(w.x, w.y);
            if (target && target.id !== drag.fromId) {
                this.onChange(addEdge(this.graph, drag.fromId, target.id));
            } else {
                this.draw();
            }
            return;
        }

        if (drag.kind === 'node' && drag.moved && this.graph) {
            // commit final position (already in this.graph from move)
            this.onChange(this.graph);
            return;
        }

        this.draw();
    }

    /** @private */
    _wheel(e) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const next = Math.min(2.5, Math.max(0.35, this.camera.zoom * factor));
        const w = this._screenToWorld(e.clientX, e.clientY);
        this.camera.zoom = next;
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        this.camera.x = w.x - sx / this.camera.zoom;
        this.camera.y = w.y - sy / this.camera.zoom;
        this.draw();
    }

    /** @private */
    _keyDown(e) {
        if (e.code === 'Space') this._spacePan = true;
    }

    /** @private */
    _keyUp(e) {
        if (e.code === 'Space') this._spacePan = false;
    }
}
