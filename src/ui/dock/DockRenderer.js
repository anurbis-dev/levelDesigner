/**
 * Dock DOM renderer with leaf-content reconciliation by node.id.
 * Chrome may be rebuilt; content roots reparent only.
 */
import { typeLabel, typeColor, COLLAPSED_H, floatDetachLayoutFromClient } from './DockConstants.js';
import { openTypeMenu, closeTypeMenu } from './DockTypeMenu.js';
import { buildViewportHeaderControls, syncViewportChromeState } from './ViewportLeafChrome.js';

/**
 * Toolbar instance paired with a viewport leaf (copy map or primary shell).
 * @param {object|null|undefined} editor
 * @param {string} leafId
 * @returns {object|null}
 */
export function getToolbarForLeaf(editor, leafId) {
    if (!editor || !leafId) return null;
    const copy = editor.viewportToolbars?.get?.(leafId);
    if (copy) return copy;
    const primaryLeafId = editor.viewportViewManager?.getPrimaryView?.()?.leafId
        ?? editor.dockManager?.registry?.getPrimaryLeafId?.('viewport')
        ?? null;
    if (primaryLeafId === leafId && editor.toolbar) return editor.toolbar;
    return null;
}

/**
 * Show/hide leaf-header ▾ for toolbar restore (per viewport leaf).
 * @param {string} leafId
 * @param {boolean} toolbarVisible
 */
export function setToolbarRevealCaretVisible(leafId, toolbarVisible) {
    if (!leafId) return;
    document.querySelectorAll(`.toolbar-reveal-caret[data-leaf-id="${leafId}"]`).forEach((caret) => {
        caret.hidden = !!toolbarVisible;
    });
}

export class DockRenderer {
    constructor(opts) {
        this.model = opts.model;
        this.splitRoot = opts.splitRoot;
        this.floatingLayer = opts.floatingLayer;
        this.workspaceEl = opts.workspaceEl;
        this.registry = opts.registry || null;
        this.mountLeafContent = opts.mountLeafContent
            || (this.registry
                ? (ws, node, body) => this.registry.mountLeafContent(ws, node, body)
                : this._defaultPlaceholderMount.bind(this));
        this.isCloseable = opts.isCloseable
            || ((type, leafId) => {
                if (this.registry?.isLeafCloseable) {
                    return this.registry.isLeafCloseable(type, leafId);
                }
                return this.registry ? this.registry.isCloseable(type) : type !== 'viewport';
            });
        this.onStructureChange = opts.onStructureChange || (() => {});
        this.drag = opts.drag || null;
        this._contentRoots = new Map();
        this._contentPool = document.createElement('div');
        this._contentPool.id = 'dock-content-pool';
        this._contentPool.style.display = 'none';
        document.body.appendChild(this._contentPool);
    }

    setDragController(drag) {
        this.drag = drag;
    }

    _defaultPlaceholderMount(workspaceId, node, bodyEl) {
        let root = this._contentRoots.get(node.id);
        if (!root) {
            root = document.createElement('div');
            root.className = 'dock-placeholder';
            root.dataset.leafId = node.id;
            root.textContent = node.contentType;
            this._contentRoots.set(node.id, root);
        }
        root.style.background = typeColor(node.contentType);
        root.textContent = node.contentType;
        if (root.parentElement !== bodyEl) {
            bodyEl.appendChild(root);
        }
    }

    _parkContentRoots() {
        if (this.registry) this.registry.parkRoots(this._contentPool);
        this._contentRoots.forEach((root) => {
            if (root.parentElement !== this._contentPool) this._contentPool.appendChild(root);
        });
    }

    render() {
        this.model.sanitizeCollapsedFlags(this.model.mainTree);
        this.model.floatingWindows.forEach((fw) => this.model.sanitizeCollapsedFlags(fw.tree));
        this._parkContentRoots();
        this._renderWorkspace('main', this.model.mainTree, this.splitRoot);
        this._renderFloatingLayer();
        this._reconcileRegistry();
        this.onStructureChange();
    }

    refreshWorkspace(workspaceId) {
        if (workspaceId === 'main') {
            this.model.sanitizeCollapsedFlags(this.model.mainTree);
        } else {
            const fw = this.model.floatingWindows.find((f) => f.id === workspaceId);
            if (fw) this.model.sanitizeCollapsedFlags(fw.tree);
        }
        this._parkContentRoots();
        if (workspaceId === 'main') {
            this._renderWorkspace('main', this.model.mainTree, this.splitRoot);
        } else {
            const fw = this.model.floatingWindows.find((f) => f.id === workspaceId);
            if (fw) this._refreshFloatingWindow(fw);
            else this._renderFloatingLayer();
        }
        this._reconcileRegistry();
        this.onStructureChange();
    }

    _reconcileRegistry() {
        if (!this.registry || typeof this.registry.reconcileLiveLeaves !== 'function') return;
        this.registry.reconcileLiveLeaves(this.model.collectAllLeafIds());
    }

    _renderWorkspace(workspaceId, treeNode, containerEl) {
        containerEl.innerHTML = '';
        if (!treeNode) {
            const empty = document.createElement('div');
            empty.className = 'empty-drop-zone';
            empty.dataset.workspaceId = workspaceId;
            empty.textContent = workspaceId === 'main'
                ? 'Empty area — drop a panel here'
                : 'Empty';
            containerEl.appendChild(empty);
            return;
        }
        containerEl.appendChild(this._renderNode(treeNode, workspaceId));
    }

    _renderNode(node, workspaceId) {
        if (node.type === 'leaf') return this._renderLeaf(node, workspaceId);
        const el = document.createElement('div');
        el.className = 'split-node';
        el.style.flexDirection = node.direction === 'row' ? 'row' : 'column';
        const a = this._renderNode(node.children[0], workspaceId);
        const b = this._renderNode(node.children[1], workspaceId);
        const resizer = document.createElement('div');
        resizer.className = `resizer ${node.direction === 'row' ? 'resizer-col' : 'resizer-row'}`;
        this._applySplitFlex(node, a, b, resizer);
        this._setupResizer(resizer, node, el, a, b);
        el.appendChild(a);
        el.appendChild(resizer);
        el.appendChild(b);
        return el;
    }

    /**
     * Column + collapsed leaf (DK-CLP): fixed chrome height, sibling takes rest; hide resizer.
     * @param {object} node split
     * @param {HTMLElement} elA
     * @param {HTMLElement} elB
     * @param {HTMLElement} resizer
     */
    _applySplitFlex(node, elA, elB, resizer) {
        if (node.direction === 'column') {
            const aCol = this.model.isNodeCollapsed(node.children[0]);
            const bCol = this.model.isNodeCollapsed(node.children[1]);
            if (aCol && !bCol) {
                elA.style.flex = '0 0 auto';
                elB.style.flex = '1 1 0';
                resizer.style.display = 'none';
                return;
            }
            if (!aCol && bCol) {
                elA.style.flex = '1 1 0';
                elB.style.flex = '0 0 auto';
                resizer.style.display = 'none';
                return;
            }
            if (aCol && bCol) {
                elA.style.flex = '0 0 auto';
                elB.style.flex = '0 0 auto';
                resizer.style.display = 'none';
                return;
            }
        }
        elA.style.flex = `${node.ratio} 1 0`;
        elB.style.flex = `${1 - node.ratio} 1 0`;
    }

    _setupResizer(resizer, node, container, elA, elB) {
        resizer.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            resizer.setPointerCapture(e.pointerId);
            resizer.classList.add('active');
            document.body.style.userSelect = 'none';
            document.body.style.cursor = node.direction === 'row' ? 'col-resize' : 'row-resize';
            const rect = container.getBoundingClientRect();
            const total = node.direction === 'row' ? rect.width : rect.height;
            const start = node.direction === 'row' ? rect.left : rect.top;
            const onMove = (ev) => {
                const pos = node.direction === 'row' ? ev.clientX : ev.clientY;
                const ratio = Math.max(0.08, Math.min(0.92, (pos - start) / total));
                elA.style.flex = `${ratio} 1 0`;
                elB.style.flex = `${1 - ratio} 1 0`;
                node._pendingRatio = ratio;
            };
            const onUp = (ev) => {
                if (node._pendingRatio !== undefined) node.ratio = node._pendingRatio;
                resizer.classList.remove('active');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                resizer.releasePointerCapture(ev.pointerId);
                resizer.removeEventListener('pointermove', onMove);
                resizer.removeEventListener('pointerup', onUp);
                this.onStructureChange();
            };
            resizer.addEventListener('pointermove', onMove);
            resizer.addEventListener('pointerup', onUp);
        });
    }

    _buildHeader(node, workspaceId, opts) {
        const header = document.createElement('div');
        header.className = 'leaf-header';

        // Title: type menu only (not a drag handle). Caret is separate — viewport toolbar reveal.
        const title = document.createElement('span');
        title.className = 'leaf-title';
        title.textContent = typeLabel(node.contentType);
        title.title = 'Change panel type';

        const isSingleton = (t) => (this.registry ? this.registry.isSingleton(t) : t === 'viewport');
        const openTypes = (e) => {
            e.stopPropagation();
            openTypeMenu(title, node.contentType, (newType) => {
                if (this.model.applyLeafContentType(node, newType, { isSingleton })) this.render();
            }, { presentTypes: this.model.collectPresentContentTypes(), isSingleton });
        };
        title.addEventListener('click', openTypes);
        header.appendChild(title);

        // Viewport: ▾ right of title — show toolbar when hidden; hidden while toolbar visible.
        // Not part of type-menu hit target (title only).
        if (node.contentType === 'viewport') {
            const caret = document.createElement('button');
            caret.type = 'button';
            caret.className = 'toolbar-reveal-caret';
            caret.textContent = '▾';
            caret.title = 'Show toolbar';
            caret.setAttribute('aria-label', 'Show toolbar');
            caret.hidden = true;
            caret.dataset.leafId = node.id;
            caret.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tb = getToolbarForLeaf(this.registry?.levelEditor, node.id);
                tb?.setVisible?.(true);
            });
            header.appendChild(caret);
        }

        // Empty gap between title and right icons — drag (Shift) + collapse tap (DK-CLP).
        const handle = document.createElement('div');
        handle.className = 'drag-handle leaf-header-gap';
        const canCollapse = this.model.canToggleLeafCollapse(workspaceId, node.id);
        if (canCollapse) {
            handle.title = node.collapsed
                ? 'Expand panel · Shift — move'
                : 'Collapse panel · Shift — move/split/copy/detach';
            handle.classList.add('leaf-header-gap--collapsible');
        } else {
            handle.title = 'Hold Shift to move/split/copy/detach panel';
        }
        handle.addEventListener('pointerdown', (e) => {
            if (!this.drag) return;
            this.drag.startNodeDrag(e, () => node.id, {
                ghostLabel: typeLabel(node.contentType),
                ownId: node.id,
                onTap: canCollapse
                    ? () => {
                        if (this.model.toggleLeafCollapse(workspaceId, node.id)) this.render();
                    }
                    : null,
                onNoTargetDrop: (x, y) => {
                    const dragged = this.model.resolveDraggedNode(node.id);
                    if (!dragged) return;
                    const layout = floatDetachLayoutFromClient(x, y, this.workspaceRect());
                    this.model.floatingWindows.push(
                        this.model.makeFloatingWindow(dragged, layout.x, layout.y, layout.w, layout.h)
                    );
                    this.render();
                }
            });
        });
        header.appendChild(handle);

        // Viewport: camera source + type filter on the right side of the leaf header
        if (node.contentType === 'viewport' && this.registry?.levelEditor) {
            header.appendChild(buildViewportHeaderControls(node, this.registry.levelEditor));
        }

        if (opts.onClose) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'icon-btn close';
            closeBtn.title = 'Close';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                opts.onClose();
            });
            header.appendChild(closeBtn);
        }
        return header;
    }

    _renderLeaf(node, workspaceId) {
        const el = document.createElement('div');
        el.className = `leaf-node${node.collapsed ? ' collapsed' : ''}`;
        el.dataset.nodeId = node.id;
        el.dataset.contentType = node.contentType || '';
        // Build header without close first — viewport primary/copy status is known only after mount.
        // Detach-to-float: Shift+drag gap only (no chrome icon — DK-ICO).
        const header = this._buildHeader(node, workspaceId, {
            onClose: null
        });
        const body = document.createElement('div');
        body.className = 'leaf-body';
        body.dataset.leafId = node.id;
        if (node.collapsed) body.style.display = 'none';
        // Mount before chrome sync so ViewportViewManager has the leaf view (self-drop).
        this.mountLeafContent(workspaceId, node, body);
        if (node.contentType === 'viewport' && this.registry?.levelEditor) {
            const chrome = header.querySelector('.viewport-leaf-chrome');
            if (chrome) syncViewportChromeState(chrome, node.id, this.registry.levelEditor);
            // After toolbar mount: hide ▾ when toolbar visible, show when hidden
            const tb = getToolbarForLeaf(this.registry.levelEditor, node.id);
            const caret = header.querySelector('.toolbar-reveal-caret');
            if (caret) caret.hidden = tb?.getVisible?.() !== false;
        }
        // Close after mount: isLeafCloseable uses binding.isPrimary (pre-mount was often wrong for clones).
        const canClose = typeof this.isCloseable === 'function'
            ? this.isCloseable(node.contentType, node.id)
            : node.contentType !== 'viewport';
        if (canClose) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'icon-btn close';
            closeBtn.title = 'Close';
            closeBtn.textContent = '×';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closePane(workspaceId, node.id);
            });
            header.appendChild(closeBtn);
        }
        el.appendChild(header);
        el.appendChild(body);
        return el;
    }

    closePane(workspaceId, id) {
        const current = this.model.getTreeOf(workspaceId);
        const node = this.model.findNode(current, id);
        if (node && !this.isCloseable(node.contentType, node.id)) return;
        this.model.setTreeOf(workspaceId, this.model.removeLeaf(current, id));
        // Content root stays in registry/pool for chip reopen (B1)
        this.render();
    }

    _renderFloatingLayer() {
        // Park floating shells' content via global park; rebuild shells
        this.floatingLayer.innerHTML = '';
        this.model.floatingWindows.forEach((fw) => {
            this.floatingLayer.appendChild(this._renderFloatingWindow(fw));
        });
    }

    _refreshFloatingWindow(fw) {
        const oldEl = this.floatingLayer.querySelector(`.floating-window[data-float-id="${fw.id}"]`);
        const newEl = this._renderFloatingWindow(fw);
        if (oldEl) oldEl.replaceWith(newEl);
        else this.floatingLayer.appendChild(newEl);
    }

    _renderFloatingWindow(fw) {
        const el = document.createElement('div');
        el.className = `floating-window${fw.collapsed ? ' collapsed' : ''}${fw.groupId ? ' grouped' : ''}`;
        el.dataset.floatId = fw.id;
        if (fw.role) el.dataset.role = fw.role;
        el.style.left = `${fw.x}px`;
        el.style.top = `${fw.y}px`;
        el.style.width = `${fw.w}px`;
        el.style.height = fw.collapsed ? 'auto' : `${fw.h}px`;
        el.style.zIndex = String(fw.z);
        el.addEventListener('pointerdown', () => {
            this.model.bumpZ(fw);
            el.style.zIndex = String(fw.z);
        });

        const chrome = document.createElement('div');
        chrome.className = 'floating-chrome';
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = fw.collapsed ? '▸' : '▾';
        chrome.appendChild(arrow);
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = fw.customName || 'window';
        chrome.appendChild(title);
        const spacer = document.createElement('span');
        spacer.className = 'chrome-spacer';
        chrome.appendChild(spacer);
        const closeAllBtn = document.createElement('button');
        closeAllBtn.className = 'icon-btn close';
        closeAllBtn.title = 'Close entire window';
        closeAllBtn.textContent = '×';
        closeAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Persist asset-editor geometry/tree before drop so next open restores it
            if (fw.role === 'assetEditor') {
                this.registry?.levelEditor?.dockManager?._saveAssetEditorLayout?.(fw);
            }
            this.model.detachAttachLinks(fw);
            const gid = fw.groupId;
            this.model.floatingWindows = this.model.floatingWindows.filter((w) => w.id !== fw.id);
            if (gid) {
                const rest = this.model.floatingWindows.filter((w) => w.groupId === gid);
                if (rest.length === 1) rest[0].groupId = null;
            }
            this.render();
        });
        chrome.appendChild(closeAllBtn);
        chrome.addEventListener('pointerdown', (e) => {
            if (e.target === closeAllBtn || closeAllBtn.contains(e.target)) return;
            if (!this.drag) return;
            this.drag.startFloatingDrag(e, fw, el, {
                onRename: () => this.drag.startRename(title, fw.customName || '', (v) => {
                    fw.customName = v || null;
                }),
                onText: e.target === title || title.contains(e.target)
            });
        });
        el.appendChild(chrome);

        const body = document.createElement('div');
        body.className = 'floating-body';
        this._renderWorkspace(fw.id, fw.tree, body);
        el.appendChild(body);
        const corner = document.createElement('div');
        corner.className = 'resize-corner';
        corner.title = 'Resize window';
        corner.addEventListener('pointerdown', (e) => {
            if (this.drag) this.drag.startFloatingResize(e, fw, el);
        });
        el.appendChild(corner);

        // Show resize grip only when pointer is in the bottom band of the window.
        const BOTTOM_BAND_PX = 36;
        const updateResizeGrip = (clientY) => {
            if (fw.collapsed) {
                el.classList.remove('show-resize-corner');
                return;
            }
            const rect = el.getBoundingClientRect();
            const inBottom = rect.bottom - clientY <= BOTTOM_BAND_PX && clientY <= rect.bottom;
            el.classList.toggle('show-resize-corner', inBottom);
        };
        el.addEventListener('pointermove', (e) => {
            if (e.target === corner || corner.contains(e.target)) {
                el.classList.add('show-resize-corner');
                return;
            }
            updateResizeGrip(e.clientY);
        });
        el.addEventListener('pointerleave', () => {
            el.classList.remove('show-resize-corner');
        });

        this.applyCollapsedVisualState(el, fw);
        return el;
    }

    applyCollapsedVisualState(el, fw) {
        el.classList.toggle('collapsed', fw.collapsed);
        el.style.height = fw.collapsed ? 'auto' : `${fw.h}px`;
        const body = el.querySelector('.floating-body');
        const corner = el.querySelector('.resize-corner');
        const arrow = el.querySelector('.floating-chrome .arrow');
        if (body) body.style.display = fw.collapsed ? 'none' : '';
        if (corner) corner.style.display = fw.collapsed ? 'none' : '';
        if (fw.collapsed) el.classList.remove('show-resize-corner');
        if (arrow) arrow.textContent = fw.collapsed ? '▸' : '▾';
    }

    toggleFloatingCollapse(fw) {
        fw.collapsed = !fw.collapsed;
        const el = this.floatingLayer.querySelector(`.floating-window[data-float-id="${fw.id}"]`);
        if (el) this.applyCollapsedVisualState(el, fw);
        this.model.restackBottomChain(fw, (f) => this.effectiveHeight(f), (f) => this.syncFloatingDom(f));
        this.onStructureChange();
    }

    effectiveHeight(f) {
        if (!f.collapsed) return f.h;
        const chromeEl = this.floatingLayer.querySelector(
            `.floating-window[data-float-id="${f.id}"] .floating-chrome`
        );
        return chromeEl ? chromeEl.getBoundingClientRect().height : COLLAPSED_H;
    }

    syncFloatingDom(f) {
        const el = this.floatingLayer.querySelector(`.floating-window[data-float-id="${f.id}"]`);
        if (!el) return;
        el.style.left = `${f.x}px`;
        el.style.top = `${f.y}px`;
        el.style.width = `${f.w}px`;
        if (!f.collapsed) el.style.height = `${f.h}px`;
    }

    workspaceRect() {
        return this.workspaceEl.getBoundingClientRect();
    }

    floatingRectPx(f) {
        const ws = this.workspaceRect();
        return {
            left: ws.left + f.x,
            top: ws.top + f.y,
            right: ws.left + f.x + f.w,
            bottom: ws.top + f.y + this.effectiveHeight(f)
        };
    }

    destroy() {
        closeTypeMenu();
        this._contentRoots.clear();
        if (this._contentPool && this._contentPool.parentElement) {
            this._contentPool.remove();
        }
        this._contentPool = null;
        if (this.splitRoot) this.splitRoot.innerHTML = '';
        if (this.floatingLayer) this.floatingLayer.innerHTML = '';
    }
}
