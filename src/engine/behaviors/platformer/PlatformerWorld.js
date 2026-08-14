import { matchesLayer } from '../AABB.js';
import { TILE_KIND, isLadderKind } from './platformerConstants.js';

/**
 * Scene-wide solid / ladder / bar queries for platformer mode.
 * Tilemaps expose tileKindAtWorld / isCellSolid; one-way colliders are skipped here
 * (caught only when falling onto their top in PlatformerController.moveY).
 */
export class PlatformerWorld {
    constructor(scene, collidesWith) {
        this.scene = scene;
        this.collidesWith = collidesWith;
        this.tilemaps = [];
        this.staticSolids = [];
        this.platforms = [];
        this.lifts = [];
        for (const entity of scene.getAllEntities()) {
            for (const b of entity.behaviors || []) {
                if (!b?.enabled) continue;
                if (typeof b.tileKindAtWorld === 'function') this.tilemaps.push(b);
                if (b.mode === 'elevator' || b.properties?.elevator) this.lifts.push(b);
                if (b.properties?.oneWay === 'up' || b.properties?.oneWayTop) {
                    this.platforms.push(entity);
                    continue;
                }
                if (typeof b.getGateRects === 'function') {
                    for (const r of b.getGateRects()) this.staticSolids.push(r);
                }
                if (typeof b.getSolidRects === 'function' && typeof b.tileKindAtWorld !== 'function') {
                    if (!matchesLayer(collidesWith, b.properties?.layer)) continue;
                    for (const r of b.getSolidRects(scene)) this.staticSolids.push(r);
                    continue;
                }
                if (typeof b.getBounds !== 'function') continue;
                if (typeof b.isOverlapping === 'function') continue;
                if (!matchesLayer(collidesWith, b.properties?.layer)) continue;
                if (entity === scene.player) continue;
                this.staticSolids.push(b.getBounds());
            }
        }
    }

    tileKindAt(px, py) {
        for (const tm of this.tilemaps) {
            const kind = tm.tileKindAtWorld(px, py);
            if (kind && kind !== TILE_KIND.empty) return kind;
        }
        return TILE_KIND.empty;
    }

    solidAt(px, py) {
        for (const tm of this.tilemaps) {
            if (tm.isSolidWorld?.(px, py)) return true;
        }
        for (const r of this.staticSolids) {
            if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) return true;
        }
        return false;
    }

    ladderAt(px, py) {
        return isLadderKind(this.tileKindAt(px, py));
    }

    barAt(px, py) {
        return this.tileKindAt(px, py) === TILE_KIND.bar;
    }

    ladderKindAt(px, py) {
        const k = this.tileKindAt(px, py);
        return isLadderKind(k) ? k : null;
    }

    rectFree(x, y, w, h) {
        const x1 = x + w;
        const y1 = y + h;
        for (const tm of this.tilemaps) {
            if (tm.rectBlocked?.(x, y, w, h)) return false;
        }
        for (const r of this.staticSolids) {
            if (x < r.x + r.width && x1 > r.x && y < r.y + r.height && y1 > r.y) return false;
        }
        return true;
    }

    platUnder(p, probeY) {
        for (const q of this.platforms) {
            if (p.x + p.w > q.x + 1 && p.x < q.x + (q.width || 0) - 1
                && probeY >= q.y - 1 && probeY <= q.y + Math.min(q.height || 8, 10)) {
                return q;
            }
        }
        for (const lift of this.lifts) {
            const L = lift.entity;
            if (p.x + p.w > L.x + 1 && p.x < L.x + L.width - 1
                && probeY >= L.y - 1 && probeY <= L.y + 8) {
                return L;
            }
        }
        return null;
    }

    touchCrumb(p) {
        for (const tm of this.tilemaps) tm.touchCrumbUnder?.(p);
    }
}

/** True if any tilemap/static solid occupies this world pixel (ledge-turn for patrols). */
export function worldSolidAt(scene, px, py) {
    return new PlatformerWorld(scene, undefined).solidAt(px, py);
}
