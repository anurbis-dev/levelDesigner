/**
 * Floating windows vs workspace: relative position on resize + optional edge snap.
 */
import { SNAP_THRESHOLD } from './DockConstants.js';

export const DEFAULT_FLOAT_EDGE_SNAP = true;
export const DEFAULT_FLOAT_EDGE_MARGIN = 8;

/**
 * @param {object|null|undefined} configManager
 * @returns {{ enabled: boolean, margin: number, threshold: number }}
 */
export function readFloatWorkspacePrefs(configManager) {
    const enabled = configManager?.get?.('panels.dock.floatEdgeSnap');
    const marginRaw = configManager?.get?.('panels.dock.floatEdgeMargin');
    const margin = Number.isFinite(Number(marginRaw))
        ? Math.max(0, Math.min(64, Number(marginRaw)))
        : DEFAULT_FLOAT_EDGE_MARGIN;
    return {
        enabled: enabled === undefined || enabled === null ? DEFAULT_FLOAT_EDGE_SNAP : !!enabled,
        margin,
        threshold: SNAP_THRESHOLD
    };
}

/**
 * Group floating windows: same groupId share a cluster; free windows alone.
 * @param {object[]} floatingWindows
 * @returns {Map<string, object[]>}
 */
export function clusterFloatingWindows(floatingWindows) {
    const map = new Map();
    for (const fw of floatingWindows || []) {
        const key = fw.groupId || fw.id;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(fw);
    }
    return map;
}

/**
 * @param {object[]} members
 * @param {(f: object) => number} effectiveHeightFn
 * @returns {{ minX: number, minY: number, maxR: number, maxB: number, w: number, h: number }}
 */
export function clusterBounds(members, effectiveHeightFn) {
    let minX = Infinity;
    let minY = Infinity;
    let maxR = -Infinity;
    let maxB = -Infinity;
    for (const m of members) {
        const h = effectiveHeightFn(m);
        minX = Math.min(minX, m.x);
        minY = Math.min(minY, m.y);
        maxR = Math.max(maxR, m.x + m.w);
        maxB = Math.max(maxB, m.y + h);
    }
    return {
        minX,
        minY,
        maxR,
        maxB,
        w: maxR - minX,
        h: maxB - minY
    };
}

/**
 * Snap a rectangle origin so edges stick to workspace with margin when within threshold.
 * @returns {{ x: number, y: number, snappedX: boolean, snappedY: boolean }}
 */
export function snapRectToWorkspaceEdges(x, y, w, h, wsW, wsH, margin, threshold) {
    let nx = x;
    let ny = y;
    let snappedX = false;
    let snappedY = false;
    const m = Math.max(0, margin);
    const t = Math.max(0, threshold);

    if (wsW > 0 && w > 0) {
        const leftT = m;
        const rightT = wsW - w - m;
        if (w + 2 * m >= wsW) {
            nx = Math.max(0, (wsW - w) / 2);
            snappedX = true;
        } else if (rightT < leftT) {
            nx = leftT;
            snappedX = true;
        } else {
            const dL = Math.abs(x - leftT);
            const dR = Math.abs(x - rightT);
            if (dL <= t && dL <= dR) {
                nx = leftT;
                snappedX = true;
            } else if (dR <= t) {
                nx = rightT;
                snappedX = true;
            }
        }
    }

    if (wsH > 0 && h > 0) {
        const topT = m;
        const bottomT = wsH - h - m;
        if (h + 2 * m >= wsH) {
            ny = Math.max(0, (wsH - h) / 2);
            snappedY = true;
        } else if (bottomT < topT) {
            ny = topT;
            snappedY = true;
        } else {
            const dT = Math.abs(y - topT);
            const dB = Math.abs(y - bottomT);
            if (dT <= t && dT <= dB) {
                ny = topT;
                snappedY = true;
            } else if (dB <= t) {
                ny = bottomT;
                snappedY = true;
            }
        }
    }

    return { x: nx, y: ny, snappedX, snappedY };
}

/**
 * Apply workspace edge snap to the cluster containing `fw`. Mutates members.
 * @returns {boolean} true if any position changed
 */
export function applyClusterWorkspaceEdgeSnap(floatingWindows, fw, wsW, wsH, prefs, effectiveHeightFn) {
    if (!prefs?.enabled || !fw || wsW <= 0 || wsH <= 0) return false;
    const key = fw.groupId || fw.id;
    const members = (floatingWindows || []).filter((f) => (f.groupId || f.id) === key);
    if (!members.length) return false;

    const b = clusterBounds(members, effectiveHeightFn);
    const snapped = snapRectToWorkspaceEdges(
        b.minX,
        b.minY,
        b.w,
        b.h,
        wsW,
        wsH,
        prefs.margin,
        prefs.threshold
    );
    const dx = snapped.x - b.minX;
    const dy = snapped.y - b.minY;
    if (dx === 0 && dy === 0) return false;
    members.forEach((m) => {
        m.x += dx;
        m.y += dy;
    });
    return true;
}

/**
 * On workspace size change: keep relative cluster position; optional edge re-pin.
 * Mutates floating window x/y. Sizes unchanged.
 * @returns {boolean} true if any position changed
 */
export function applyFloatingWorkspaceResize(
    floatingWindows,
    oldW,
    oldH,
    newW,
    newH,
    prefs,
    effectiveHeightFn
) {
    if (!floatingWindows?.length) return false;
    if (!(oldW > 0) || !(oldH > 0) || !(newW > 0) || !(newH > 0)) return false;
    if (Math.abs(newW - oldW) < 0.5 && Math.abs(newH - oldH) < 0.5) return false;

    const sx = newW / oldW;
    const sy = newH / oldH;
    const margin = prefs?.margin ?? DEFAULT_FLOAT_EDGE_MARGIN;
    const threshold = prefs?.threshold ?? SNAP_THRESHOLD;
    const edgeOn = !!prefs?.enabled;
    let changed = false;

    for (const members of clusterFloatingWindows(floatingWindows).values()) {
        const b = clusterBounds(members, effectiveHeightFn);
        const wasLeft = edgeOn && b.minX <= margin + threshold;
        const wasRight = edgeOn && b.maxR >= oldW - margin - threshold;
        const wasTop = edgeOn && b.minY <= margin + threshold;
        const wasBottom = edgeOn && b.maxB >= oldH - margin - threshold;

        let newMinX = b.minX * sx;
        let newMinY = b.minY * sy;

        if (edgeOn) {
            if (wasLeft && !wasRight) newMinX = margin;
            else if (wasRight && !wasLeft) newMinX = newW - b.w - margin;
            else if (wasLeft && wasRight) newMinX = margin;

            if (wasTop && !wasBottom) newMinY = margin;
            else if (wasBottom && !wasTop) newMinY = newH - b.h - margin;
            else if (wasTop && wasBottom) newMinY = margin;
        }

        const dx = newMinX - b.minX;
        const dy = newMinY - b.minY;
        if (dx === 0 && dy === 0) continue;
        members.forEach((m) => {
            m.x += dx;
            m.y += dy;
        });
        changed = true;
    }
    return changed;
}
