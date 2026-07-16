/**
 * Dock-zone, float-detach ghost (DK-GST), and floating-snap overlay helpers (DOM only).
 */
export class DockDropOverlay {
    constructor(renderer, model) {
        this.renderer = renderer;
        this.model = model;
        this.dockOverlay = null;
        this.snapOverlayEl = null;
        /** @type {HTMLElement|null} */
        this.floatDetachGhostEl = null;
    }

    getDockOverlay() {
        if (!this.dockOverlay) {
            this.dockOverlay = document.createElement('div');
            this.dockOverlay.className = 'drop-overlay';
            document.body.appendChild(this.dockOverlay);
        }
        return this.dockOverlay;
    }

    computeZone(clientX, clientY, rect) {
        const px = (clientX - rect.left) / rect.width;
        const py = (clientY - rect.top) / rect.height;
        if (px < 0.25) return 'left';
        if (px > 0.75) return 'right';
        if (py < 0.25) return 'top';
        if (py > 0.75) return 'bottom';
        return 'center';
    }

    positionOverlayRect(overlay, rect) {
        overlay.style.display = 'block';
        overlay.style.left = `${rect.left}px`;
        overlay.style.top = `${rect.top}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
    }

    positionOverlayZone(overlay, zone, rect) {
        if (zone === 'center') {
            overlay.style.display = 'none';
            return;
        }
        overlay.style.display = 'block';
        if (zone === 'left') {
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top}px`;
            overlay.style.width = `${rect.width / 2}px`;
            overlay.style.height = `${rect.height}px`;
        } else if (zone === 'right') {
            overlay.style.left = `${rect.left + rect.width / 2}px`;
            overlay.style.top = `${rect.top}px`;
            overlay.style.width = `${rect.width / 2}px`;
            overlay.style.height = `${rect.height}px`;
        } else if (zone === 'top') {
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height / 2}px`;
        } else if (zone === 'bottom') {
            overlay.style.left = `${rect.left}px`;
            overlay.style.top = `${rect.top + rect.height / 2}px`;
            overlay.style.width = `${rect.width}px`;
            overlay.style.height = `${rect.height / 2}px`;
        }
    }

    detectDropTarget(clientX, clientY, hiddenEl) {
        if (hiddenEl) hiddenEl.style.pointerEvents = 'none';
        const under = document.elementFromPoint(clientX, clientY);
        if (hiddenEl) hiddenEl.style.pointerEvents = '';
        const bodyUnder = under ? under.closest('.leaf-body') : null;
        if (bodyUnder) {
            const leafId = bodyUnder.dataset.leafId;
            const rect = bodyUnder.getBoundingClientRect();
            const zone = this.computeZone(clientX, clientY, rect);
            if (leafId && zone !== 'center') return { kind: 'leaf', leafId, zone, rect };
            return null;
        }
        const emptyUnder = under ? under.closest('.empty-drop-zone') : null;
        if (emptyUnder) {
            return {
                kind: 'empty',
                workspaceId: emptyUnder.dataset.workspaceId,
                rect: emptyUnder.getBoundingClientRect()
            };
        }
        return null;
    }

    showDockOverlayFor(target) {
        const overlay = this.getDockOverlay();
        if (!target) {
            overlay.style.display = 'none';
            return;
        }
        if (target.kind === 'leaf') this.positionOverlayZone(overlay, target.zone, target.rect);
        else this.positionOverlayRect(overlay, target.rect);
    }

    hideDockOverlay() {
        if (this.dockOverlay) this.dockOverlay.style.display = 'none';
    }

    /**
     * DK-GST: ghost of the floating window that would be created on no-target drop.
     * @param {{ screenLeft: number, screenTop: number, w: number, h: number }} layout
     * @param {string} [label]
     */
    showFloatDetachGhost(layout, label = '') {
        if (!layout) {
            this.hideFloatDetachGhost();
            return;
        }
        if (!this.floatDetachGhostEl) {
            this.floatDetachGhostEl = document.createElement('div');
            this.floatDetachGhostEl.className = 'float-detach-ghost';
            this.floatDetachGhostEl.setAttribute('aria-hidden', 'true');
            const chrome = document.createElement('div');
            chrome.className = 'float-detach-ghost-chrome';
            this.floatDetachGhostEl.appendChild(chrome);
            const body = document.createElement('div');
            body.className = 'float-detach-ghost-body';
            this.floatDetachGhostEl.appendChild(body);
            document.body.appendChild(this.floatDetachGhostEl);
        }
        const chrome = this.floatDetachGhostEl.querySelector('.float-detach-ghost-chrome');
        if (chrome) chrome.textContent = label || 'окно';
        const el = this.floatDetachGhostEl;
        el.style.display = 'flex';
        el.style.left = `${layout.screenLeft}px`;
        el.style.top = `${layout.screenTop}px`;
        el.style.width = `${layout.w}px`;
        el.style.height = `${layout.h}px`;
    }

    hideFloatDetachGhost() {
        if (this.floatDetachGhostEl) this.floatDetachGhostEl.style.display = 'none';
    }

    getSnapOverlay() {
        if (!this.snapOverlayEl) {
            this.snapOverlayEl = document.createElement('div');
            this.snapOverlayEl.className = 'snap-edge-overlay';
            document.body.appendChild(this.snapOverlayEl);
        }
        return this.snapOverlayEl;
    }

    showSnapHighlight(fw, snap) {
        const ws = this.renderer.workspaceRect();
        const localA = this.model.groupBoundingBoxLocal(fw, (f) => this.renderer.effectiveHeight(f));
        const a = {
            left: ws.left + localA.left,
            top: ws.top + localA.top,
            right: ws.left + localA.right,
            bottom: ws.top + localA.bottom
        };
        const b = this.renderer.floatingRectPx(snap.ow);
        const overlay = this.getSnapOverlay();
        overlay.style.display = 'block';
        if (snap.side === 'left' || snap.side === 'right') {
            const x = snap.side === 'left' ? b.right : b.left;
            const top = Math.max(a.top, b.top);
            const bottom = Math.min(a.bottom, b.bottom);
            overlay.style.left = `${x - 2}px`;
            overlay.style.top = `${top}px`;
            overlay.style.width = '4px';
            overlay.style.height = `${Math.max(20, bottom - top)}px`;
        } else {
            const y = snap.side === 'top' ? b.bottom : b.top;
            const left = Math.max(a.left, b.left);
            const right = Math.min(a.right, b.right);
            overlay.style.left = `${left}px`;
            overlay.style.top = `${y - 2}px`;
            overlay.style.height = '4px';
            overlay.style.width = `${Math.max(20, right - left)}px`;
        }
    }

    hideSnapHighlight() {
        if (this.snapOverlayEl) this.snapOverlayEl.style.display = 'none';
    }

    destroy() {
        if (this.dockOverlay) {
            this.dockOverlay.remove();
            this.dockOverlay = null;
        }
        if (this.snapOverlayEl) {
            this.snapOverlayEl.remove();
            this.snapOverlayEl = null;
        }
        if (this.floatDetachGhostEl) {
            this.floatDetachGhostEl.remove();
            this.floatDetachGhostEl = null;
        }
    }
}
