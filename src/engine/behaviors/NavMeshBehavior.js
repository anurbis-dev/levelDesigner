import { Behavior } from './Behavior.js';
import { getEntityBounds } from './AABB.js';

/**
 * §7 navMesh: walkable zone AI can path across (free AI movement).
 *
 * Zone discipline matches audioZone/volume: shape fields → AABB via
 * getEntityBounds, never solid. Pathfinding is grid A* over walkable cells
 * (mesh AABB minus local `blocked` rects). Optional `navMeshAssetId` merges
 * catalog `navMesh` fields (cellSize/blocked) when component values empty.
 *
 * Properties:
 * - shape/offset/width/height/radius/points — AABB via getEntityBounds
 * - cellSize — grid resolution in world px (default 16)
 * - blocked — asset-local rects `[{x,y,width,height}]` carved out of walkable
 * - navMeshAssetId — catalog merge for cellSize/blocked when empty
 * - enabled (default true)
 *
 * Duck-types:
 * - `containsWorldPoint(x,y)` — true if point is walkable on this mesh
 * - `findPath(fromX,fromY,toX,toY)` — world waypoints or null
 * - never solid (`isOverlapping` false)
 *
 * Scene helper: `NavMeshBehavior.findPathInScene(scene, …)` — first mesh that
 * contains both endpoints (or falls back to any mesh that finds a path).
 * StateMachine chase/flee follow this path when present; otherwise straight line.
 */
export class NavMeshBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.cellSize = Math.max(2, Number(this.properties.cellSize) || 16);
        this.blocked = Array.isArray(this.properties.blocked) ? this.properties.blocked : [];
        this.navMeshAssetId = this.properties.navMeshAssetId ?? '';
        this.enabled = this.properties.enabled !== false;
        this._assetMerged = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    update(_dt, scene) {
        this.ensureAssetResolved(scene);
    }

    /**
     * Merge catalog navMesh asset once (component non-empty wins).
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    ensureAssetResolved(scene) {
        if (this._assetMerged || !this.navMeshAssetId || !scene?.assetsById) return;
        const asset = scene.assetsById.get(this.navMeshAssetId);
        this._assetMerged = true;
        if (!asset) return;
        const bag = asset.properties && typeof asset.properties === 'object'
            ? asset.properties
            : asset;
        if (!(this.properties.cellSize != null && this.properties.cellSize !== '')
            && bag.cellSize != null) {
            this.cellSize = Math.max(2, Number(bag.cellSize) || this.cellSize);
        }
        if ((!this.blocked || this.blocked.length === 0) && Array.isArray(bag.blocked)) {
            this.blocked = bag.blocked;
        }
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    containsWorldPoint(x, y) {
        if (!this.enabled) return false;
        const b = this.getBounds();
        if (x < b.x || y < b.y || x >= b.x + b.width || y >= b.y + b.height) {
            return false;
        }
        return !this._isBlockedWorld(x, y, b);
    }

    /**
     * Grid A* path in world space. Returns waypoint list including approximate
     * start/end cell centers; null if either endpoint is off-mesh or no route.
     * @param {number} fromX
     * @param {number} fromY
     * @param {number} toX
     * @param {number} toY
     * @returns {Array<{x:number,y:number}>|null}
     */
    findPath(fromX, fromY, toX, toY) {
        if (!this.enabled) return null;
        if (!this.containsWorldPoint(fromX, fromY) || !this.containsWorldPoint(toX, toY)) {
            return null;
        }

        const b = this.getBounds();
        const cs = this.cellSize;
        const cols = Math.max(1, Math.ceil(b.width / cs));
        const rows = Math.max(1, Math.ceil(b.height / cs));

        const toCell = (wx, wy) => ({
            c: Math.min(cols - 1, Math.max(0, Math.floor((wx - b.x) / cs))),
            r: Math.min(rows - 1, Math.max(0, Math.floor((wy - b.y) / cs)))
        });
        const cellCenter = (c, r) => ({
            x: b.x + (c + 0.5) * cs,
            y: b.y + (r + 0.5) * cs
        });
        const walkable = (c, r) => {
            if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
            const p = cellCenter(c, r);
            return !this._isBlockedWorld(p.x, p.y, b);
        };

        const start = toCell(fromX, fromY);
        const goal = toCell(toX, toY);
        if (!walkable(start.c, start.r) || !walkable(goal.c, goal.r)) return null;
        if (start.c === goal.c && start.r === goal.r) {
            return [{ x: toX, y: toY }];
        }

        const key = (c, r) => `${c},${r}`;
        const open = [{ c: start.c, r: start.r, g: 0, f: 0 }];
        const came = new Map();
        const gScore = new Map([[key(start.c, start.r), 0]]);
        const closed = new Set();

        // 8-connected free movement
        const neigh = [
            [1, 0], [-1, 0], [0, 1], [0, -1],
            [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];

        while (open.length > 0) {
            open.sort((a, b2) => a.f - b2.f);
            const cur = open.shift();
            const ck = key(cur.c, cur.r);
            if (closed.has(ck)) continue;
            closed.add(ck);

            if (cur.c === goal.c && cur.r === goal.r) {
                const cells = [{ c: cur.c, r: cur.r }];
                let k = ck;
                while (came.has(k)) {
                    const prev = came.get(k);
                    cells.push(prev);
                    k = key(prev.c, prev.r);
                }
                cells.reverse();
                const path = cells.map(({ c, r }) => cellCenter(c, r));
                // Snap last to exact target
                path[path.length - 1] = { x: toX, y: toY };
                return path;
            }

            for (const [dc, dr] of neigh) {
                const nc = cur.c + dc;
                const nr = cur.r + dr;
                if (!walkable(nc, nr)) continue;
                // No corner-cutting through blocked diagonal neighbors
                if (dc !== 0 && dr !== 0) {
                    if (!walkable(cur.c + dc, cur.r) || !walkable(cur.c, cur.r + dr)) continue;
                }
                const nk = key(nc, nr);
                if (closed.has(nk)) continue;
                const step = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
                const tentative = (gScore.get(ck) ?? Infinity) + step;
                if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
                came.set(nk, { c: cur.c, r: cur.r });
                gScore.set(nk, tentative);
                const h = Math.hypot(goal.c - nc, goal.r - nr);
                open.push({ c: nc, r: nr, g: tentative, f: tentative + h });
            }
        }
        return null;
    }

    /**
     * First enabled navMesh in the scene that can route both endpoints.
     * @param {{entities?: Array<{behaviors?: object[]}>}|null|undefined} scene
     * @param {number} fromX
     * @param {number} fromY
     * @param {number} toX
     * @param {number} toY
     * @returns {Array<{x:number,y:number}>|null}
     */
    static findPathInScene(scene, fromX, fromY, toX, toY) {
        const meshes = NavMeshBehavior.collectFromScene(scene);
        if (meshes.length === 0) return null;
        // Prefer a mesh that contains both points
        for (const m of meshes) {
            if (m.containsWorldPoint(fromX, fromY) && m.containsWorldPoint(toX, toY)) {
                const path = m.findPath(fromX, fromY, toX, toY);
                if (path) return path;
            }
        }
        // Fallback: any mesh that finds a route (partial coverage)
        for (const m of meshes) {
            const path = m.findPath(fromX, fromY, toX, toY);
            if (path) return path;
        }
        return null;
    }

    /**
     * @param {{entities?: Array<{behaviors?: object[]}>}|null|undefined} scene
     * @returns {NavMeshBehavior[]}
     */
    static collectFromScene(scene) {
        const out = [];
        for (const e of scene?.entities || []) {
            for (const b of e.behaviors || []) {
                if (b instanceof NavMeshBehavior || (
                    typeof b.findPath === 'function'
                    && typeof b.containsWorldPoint === 'function'
                    && b.enabled !== false
                )) {
                    out.push(b);
                }
            }
        }
        return out;
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {{x:number,y:number,width:number,height:number}} bounds
     * @returns {boolean}
     */
    _isBlockedWorld(x, y, bounds) {
        if (!this.blocked || this.blocked.length === 0) return false;
        // blocked rects are asset-local offsets from entity origin (same as freeform points)
        const ox = this.entity.x;
        const oy = this.entity.y;
        for (const rect of this.blocked) {
            if (!rect) continue;
            const rx = ox + (Number(rect.x) || 0);
            const ry = oy + (Number(rect.y) || 0);
            const rw = Number(rect.width) || 0;
            const rh = Number(rect.height) || 0;
            if (rw <= 0 || rh <= 0) continue;
            if (x >= rx && y >= ry && x < rx + rw && y < ry + rh) return true;
        }
        // bounds unused but kept for signature clarity / future circle mask
        void bounds;
        return false;
    }
}
