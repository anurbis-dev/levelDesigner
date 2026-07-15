/**
 * Pure split-tree + floating-window model (no DOM).
 * Port of tree/float logic from tmp/split-tree-prototype_v1_10.html.
 */
import {
    FLOAT_MIN_W,
    FLOAT_MIN_H,
    SNAP_THRESHOLD,
    OPPOSITE
} from './DockConstants.js';

export class DockTreeModel {
    constructor() {
        this.idCounter = 1;
        this.floatIdCounter = 1;
        this.nextGroupId = 1;
        this.nextZ = 10;
        this.mainTree = null;
        this.floatingWindows = [];
    }

    makeLeaf(contentType, label) {
        return {
            type: 'leaf',
            id: `leaf-${this.idCounter++}`,
            contentType,
            label: label || contentType
        };
    }

    defaultMainTree() {
        this.idCounter = 1;
        return {
            type: 'split',
            direction: 'row',
            ratio: 0.25,
            children: [
                {
                    type: 'split',
                    direction: 'column',
                    ratio: 0.55,
                    children: [
                        this.makeLeaf('outliner', 'Outliner'),
                        this.makeLeaf('layers', 'Layers')
                    ]
                },
                {
                    type: 'split',
                    direction: 'row',
                    ratio: 0.67,
                    children: [
                        this.makeLeaf('viewport', 'Viewport'),
                        {
                            type: 'split',
                            direction: 'column',
                            ratio: 0.55,
                            children: [
                                this.makeLeaf('details', 'Details'),
                                this.makeLeaf('levels', 'Levels')
                            ]
                        }
                    ]
                }
            ]
        };
    }

    reset() {
        this.mainTree = this.defaultMainTree();
        this.floatingWindows = [];
        this.floatIdCounter = 1;
        this.nextGroupId = 1;
        this.nextZ = 10;
    }

    makeFloatingWindow(tree, x, y, w, h) {
        return {
            id: `float-${this.floatIdCounter++}`,
            tree,
            x,
            y,
            w: Math.max(FLOAT_MIN_W, w),
            h: Math.max(FLOAT_MIN_H, h),
            z: this.nextZ++,
            collapsed: false,
            customName: null,
            groupId: null,
            attach: { left: null, right: null, top: null, bottom: null }
        };
    }

    bumpZ(fw) {
        fw.z = this.nextZ++;
        return fw.z;
    }

    getTreeOf(workspaceId) {
        if (workspaceId === 'main') return this.mainTree;
        const fw = this.floatingWindows.find((f) => f.id === workspaceId);
        return fw ? fw.tree : null;
    }

    setTreeOf(workspaceId, newTree) {
        if (workspaceId === 'main') {
            this.mainTree = newTree;
            return;
        }
        const fw = this.floatingWindows.find((f) => f.id === workspaceId);
        if (!fw) return;
        if (newTree === null) {
            this.floatingWindows = this.floatingWindows.filter((f) => f.id !== workspaceId);
        } else {
            fw.tree = newTree;
        }
    }

    findNode(node, id) {
        if (!node) return null;
        if (node.type === 'leaf') return node.id === id ? node : null;
        for (const c of node.children) {
            const f = this.findNode(c, id);
            if (f) return f;
        }
        return null;
    }

    findWorkspaceContaining(leafId) {
        if (this.findNode(this.mainTree, leafId)) return 'main';
        for (const fw of this.floatingWindows) {
            if (this.findNode(fw.tree, leafId)) return fw.id;
        }
        return null;
    }

    removeLeaf(node, id) {
        if (!node) return null;
        if (node.type === 'leaf') return node.id === id ? null : node;
        const kept = node.children.map((c) => this.removeLeaf(c, id)).filter((c) => c !== null);
        if (kept.length === 1) return kept[0];
        if (kept.length === 0) return null;
        node.children = kept;
        return node;
    }

    replaceLeaf(node, targetId, replacement) {
        if (!node) return node;
        if (node.type === 'leaf') return node.id === targetId ? replacement : node;
        node.children = node.children.map((c) => this.replaceLeaf(c, targetId, replacement));
        return node;
    }

    insertIntoTree(workspaceId, node, targetId, zone) {
        const current = this.getTreeOf(workspaceId);
        if (!current) {
            this.setTreeOf(workspaceId, node);
            return;
        }
        if (!targetId || zone === 'center') return;
        const targetNode = this.findNode(current, targetId);
        if (!targetNode) return;
        const direction = (zone === 'left' || zone === 'right') ? 'row' : 'column';
        const children = (zone === 'left' || zone === 'top')
            ? [node, targetNode]
            : [targetNode, node];
        const newSplit = { type: 'split', direction, ratio: 0.5, children };
        const updated = (current.type === 'leaf' && current.id === targetId)
            ? newSplit
            : this.replaceLeaf(current, targetId, newSplit);
        this.setTreeOf(workspaceId, updated);
    }

    /**
     * Resolve a drag payload into a tree node (mutates model: removes leaf from previous tree).
     * @param {string} raw - leaf id or `new:type:label`
     */
    resolveDraggedNode(raw) {
        if (!raw) return null;
        if (raw.indexOf('new:') === 0) {
            const parts = raw.split(':');
            return this.makeLeaf(parts[1], parts[2]);
        }
        let found = this.findNode(this.mainTree, raw);
        if (found) {
            this.setTreeOf('main', this.removeLeaf(this.mainTree, raw));
            return found;
        }
        for (const fw of this.floatingWindows) {
            found = this.findNode(fw.tree, raw);
            if (found) {
                this.setTreeOf(fw.id, this.removeLeaf(fw.tree, raw));
                return found;
            }
        }
        return null;
    }

    applyDropTarget(target, node) {
        if (!target || !node) return;
        if (target.kind === 'empty') {
            this.insertIntoTree(target.workspaceId, node, null, null);
            return;
        }
        const ws = this.findWorkspaceContaining(target.leafId);
        if (ws) this.insertIntoTree(ws, node, target.leafId, target.zone);
    }

    snapshot() {
        return {
            mainTree: this.mainTree,
            floatingWindows: this.floatingWindows
        };
    }

    // --- floating attach / snap (pure model; DOM sync via callbacks) ---

    ensureAttach(f) {
        if (!f.attach) f.attach = { left: null, right: null, top: null, bottom: null };
        return f.attach;
    }

    attachFloating(fw, ow) {
        const gid = fw.groupId || ow.groupId || (`grp-${this.nextGroupId++}`);
        const oldFwGid = fw.groupId;
        const oldOwGid = ow.groupId;
        this.floatingWindows.forEach((f) => {
            if (
                f.id === fw.id
                || f.id === ow.id
                || (oldFwGid && f.groupId === oldFwGid)
                || (oldOwGid && f.groupId === oldOwGid)
            ) {
                f.groupId = gid;
            }
        });
    }

    detachAttachLinks(fw) {
        const a = this.ensureAttach(fw);
        ['left', 'right', 'top', 'bottom'].forEach((side) => {
            const nid = a[side];
            if (!nid) return;
            const n = this.floatingWindows.find((f) => f.id === nid);
            if (n) this.ensureAttach(n)[OPPOSITE[side]] = null;
            a[side] = null;
        });
    }

    detachFloating(fw) {
        this.detachAttachLinks(fw);
        const gid = fw.groupId;
        fw.groupId = null;
        if (!gid) return;
        const remaining = this.floatingWindows.filter((f) => f.groupId === gid);
        if (remaining.length === 1) remaining[0].groupId = null;
    }

    localRect(f, effectiveHeightFn) {
        const h = effectiveHeightFn(f);
        return { left: f.x, top: f.y, right: f.x + f.w, bottom: f.y + h };
    }

    groupBoundingBoxLocal(fw, effectiveHeightFn) {
        const members = fw.groupId
            ? this.floatingWindows.filter((f) => f.groupId === fw.groupId)
            : [fw];
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        members.forEach((f) => {
            const r = this.localRect(f, effectiveHeightFn);
            left = Math.min(left, r.left);
            top = Math.min(top, r.top);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
        });
        return { left, top, right, bottom };
    }

    findFloatingSnapTarget(fw, effectiveHeightFn) {
        const a = this.groupBoundingBoxLocal(fw, effectiveHeightFn);
        for (const ow of this.floatingWindows) {
            if (ow.id === fw.id) continue;
            if (fw.groupId && ow.groupId === fw.groupId) continue;
            const b = this.localRect(ow, effectiveHeightFn);
            const vOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            const hOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            if (vOverlap > 24) {
                if (Math.abs(a.left - b.right) < SNAP_THRESHOLD) return { ow, side: 'left' };
                if (Math.abs(a.right - b.left) < SNAP_THRESHOLD) return { ow, side: 'right' };
            }
            if (hOverlap > 24) {
                if (Math.abs(a.top - b.bottom) < SNAP_THRESHOLD) return { ow, side: 'top' };
                if (Math.abs(a.bottom - b.top) < SNAP_THRESHOLD) return { ow, side: 'bottom' };
            }
        }
        return null;
    }

    applyFloatingSnap(fw, snap, effectiveHeightFn) {
        const ow = snap.ow;
        const preX = fw.x;
        const preY = fw.y;
        if (snap.side === 'left') {
            fw.x = ow.x + ow.w;
            fw.y = ow.y;
            fw.h = ow.h;
        }
        if (snap.side === 'right') {
            fw.x = ow.x - fw.w;
            fw.y = ow.y;
            fw.h = ow.h;
        }
        if (snap.side === 'top') {
            fw.y = ow.y + effectiveHeightFn(ow);
            fw.x = ow.x;
            fw.w = ow.w;
        }
        if (snap.side === 'bottom') {
            fw.y = ow.y - effectiveHeightFn(fw);
            fw.x = ow.x;
            fw.w = ow.w;
        }
        const dx = fw.x - preX;
        const dy = fw.y - preY;
        if (fw.groupId) {
            this.floatingWindows.forEach((f) => {
                if (f.id !== fw.id && f.groupId === fw.groupId) {
                    f.x += dx;
                    f.y += dy;
                }
            });
        }
        this.ensureAttach(fw)[snap.side] = ow.id;
        this.ensureAttach(ow)[OPPOSITE[snap.side]] = fw.id;
        this.attachFloating(fw, ow);
        return snap.side;
    }

    restackBottomChain(startFw, effectiveHeightFn, syncDom) {
        let current = startFw;
        const visited = new Set([startFw.id]);
        while (current.attach && current.attach.bottom) {
            const next = this.floatingWindows.find((f) => f.id === current.attach.bottom);
            if (!next || visited.has(next.id)) break;
            next.y = current.y + effectiveHeightFn(current);
            if (syncDom) syncDom(next);
            visited.add(next.id);
            current = next;
        }
    }

    restackRightChain(startFw, syncDom) {
        let current = startFw;
        const visited = new Set([startFw.id]);
        while (current.attach && current.attach.right) {
            const next = this.floatingWindows.find((f) => f.id === current.attach.right);
            if (!next || visited.has(next.id)) break;
            next.x = current.x + current.w;
            if (syncDom) syncDom(next);
            visited.add(next.id);
            current = next;
        }
    }

    verticalChainWidthSync(fw, syncDom) {
        const visited = new Set([fw.id]);
        const queue = [fw];
        while (queue.length) {
            const cur = queue.shift();
            ['top', 'bottom'].forEach((side) => {
                const nid = cur.attach && cur.attach[side];
                if (!nid || visited.has(nid)) return;
                const n = this.floatingWindows.find((f) => f.id === nid);
                if (!n) return;
                n.w = fw.w;
                n.x = fw.x;
                visited.add(nid);
                if (syncDom) syncDom(n);
                queue.push(n);
            });
        }
    }
}
