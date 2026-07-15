/**
 * Pure split-tree + floating-window model (no DOM).
 * Port of tree/float logic from tmp/split-tree-prototype_v1_10.html.
 */
import { FLOAT_MIN_W, FLOAT_MIN_H } from './DockConstants.js';
import { DockFloatOps } from './DockFloatOps.js';

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
        // Assets fixed as bottom strip under the main L/C/R workspace (B1).
        return {
            type: 'split',
            direction: 'column',
            ratio: 0.72,
            children: [
                {
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
                },
                this.makeLeaf('assets', 'Assets')
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

    /**
     * Restore layout from persistence snapshot; rebuilds id counters from max ids.
     * @param {{ mainTree: object|null, floatingWindows?: object[] }} data
     */
    restoreFromSnapshot(data) {
        if (!data || (!data.mainTree && !(data.floatingWindows && data.floatingWindows.length))) {
            this.reset();
            return;
        }
        this.mainTree = data.mainTree || null;
        this.floatingWindows = Array.isArray(data.floatingWindows)
            ? data.floatingWindows.map((fw) => ({
                ...fw,
                attach: fw.attach || { left: null, right: null, top: null, bottom: null }
            }))
            : [];
        this._syncCountersFromTrees();
    }

    _walkLeaves(node, visit) {
        if (!node) return;
        if (node.type === 'leaf') {
            visit(node);
            return;
        }
        if (node.children) node.children.forEach((c) => this._walkLeaves(c, visit));
    }

    _syncCountersFromTrees() {
        let maxLeaf = 0;
        let maxFloat = 0;
        let maxGroup = 0;
        let maxZ = 9;
        const leafRe = /^leaf-(\d+)$/;
        const floatRe = /^float-(\d+)$/;
        const groupRe = /^grp-(\d+)$/;

        const noteLeaf = (leaf) => {
            const m = leafRe.exec(leaf.id || '');
            if (m) maxLeaf = Math.max(maxLeaf, parseInt(m[1], 10));
        };
        this._walkLeaves(this.mainTree, noteLeaf);
        this.floatingWindows.forEach((fw) => {
            const fm = floatRe.exec(fw.id || '');
            if (fm) maxFloat = Math.max(maxFloat, parseInt(fm[1], 10));
            if (fw.groupId) {
                const gm = groupRe.exec(fw.groupId);
                if (gm) maxGroup = Math.max(maxGroup, parseInt(gm[1], 10));
            }
            if (typeof fw.z === 'number') maxZ = Math.max(maxZ, fw.z);
            this._walkLeaves(fw.tree, noteLeaf);
        });
        this.idCounter = maxLeaf + 1;
        this.floatIdCounter = maxFloat + 1;
        this.nextGroupId = maxGroup + 1;
        this.nextZ = maxZ + 1;
    }

    /** @returns {Set<string>} contentTypes present in main + floating trees */
    collectPresentContentTypes() {
        const types = new Set();
        const visit = (leaf) => {
            if (leaf.contentType) types.add(leaf.contentType);
        };
        this._walkLeaves(this.mainTree, visit);
        this.floatingWindows.forEach((fw) => this._walkLeaves(fw.tree, visit));
        return types;
    }

    hasContentType(contentType) {
        return this.collectPresentContentTypes().has(contentType);
    }

    /** First leaf node with contentType, or null. */
    findLeafByContentType(contentType) {
        let found = null;
        const visit = (leaf) => {
            if (!found && leaf.contentType === contentType) found = leaf;
        };
        this._walkLeaves(this.mainTree, visit);
        if (found) return found;
        for (const fw of this.floatingWindows) {
            this._walkLeaves(fw.tree, visit);
            if (found) return found;
        }
        return null;
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
            const contentType = parts[1];
            // Singleton guard: never create a second instance of a present type
            if (contentType && this.hasContentType(contentType)) return null;
            return this.makeLeaf(contentType, parts[2]);
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
}

Object.assign(DockTreeModel.prototype, DockFloatOps);
