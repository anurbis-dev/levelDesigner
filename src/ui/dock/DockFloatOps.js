/**
 * Floating-window attach / snap / restack ops mixed into DockTreeModel.
 */
import { SNAP_THRESHOLD, OPPOSITE } from './DockConstants.js';

export const DockFloatOps = {
    ensureAttach(f) {
        if (!f.attach) f.attach = { left: null, right: null, top: null, bottom: null };
        return f.attach;
    },

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
    },

    detachAttachLinks(fw) {
        const a = this.ensureAttach(fw);
        ['left', 'right', 'top', 'bottom'].forEach((side) => {
            const nid = a[side];
            if (!nid) return;
            const n = this.floatingWindows.find((f) => f.id === nid);
            if (n) this.ensureAttach(n)[OPPOSITE[side]] = null;
            a[side] = null;
        });
    },

    detachFloating(fw) {
        this.detachAttachLinks(fw);
        const gid = fw.groupId;
        fw.groupId = null;
        if (!gid) return;
        const remaining = this.floatingWindows.filter((f) => f.groupId === gid);
        if (remaining.length === 1) remaining[0].groupId = null;
    },

    localRect(f, effectiveHeightFn) {
        const h = effectiveHeightFn(f);
        return { left: f.x, top: f.y, right: f.x + f.w, bottom: f.y + h };
    },

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
    },

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
    },

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
    },

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
    },

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
    },

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
};
