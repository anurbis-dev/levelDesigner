import { Behavior } from './Behavior.js';
import { TILE_KIND, isSolidKind } from './platformer/platformerConstants.js';

/**
 * §7 tileset + tilemap: grid of atlas tiles with per-cell collision.
 *
 * Properties (inline atlas or catalog tileset via assetsById):
 * - `tilesetAssetId` — catalog `tileset` asset id (optional); supplies
 *   tileWidth/tileHeight/columns/solidIndices/src via asset.properties + imgSrc
 * - `imageAssetId` — catalog Image id for the atlas (optional if src/tileset set)
 * - `src` — direct atlas URL (inline fallback, same convention as PlaySound)
 * - `tileWidth` / `tileHeight` (default 16)
 * - `columns` — tiles per row in the atlas (default 1)
 * - `mapWidth` / `mapHeight` — grid size in tiles (default 1)
 * - `tiles` — row-major indices into the atlas; `-1` / null / undefined = empty
 * - `solidIndices` — which atlas indices are solid:
 *     `null`/omitted = every non-empty cell is solid;
 *     `[]` = no collision; `[0,2]` = only those indices
 * - `layer` — collision layer category (matchesLayer / collidesWith)
 *
 * Duck-types:
 * - `getSolidRects()` — one AABB per solid occupied cell (PlayerMovement expands these)
 * - `drawTiles(ctx, imageCache, absX, absY)` — multi-tile atlas draw (Renderer)
 * - `collectImageSources(sources, scene)` — atlas preload (AssetLoader)
 *
 * No autotiling in this pass — catalog description mentions it for later.
 */
export class TilemapBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.tilesetAssetId = this.properties.tilesetAssetId ?? '';
        this.imageAssetId = this.properties.imageAssetId ?? '';
        this.src = this.properties.src ?? '';
        this.tileWidth = this.properties.tileWidth ?? 16;
        this.tileHeight = this.properties.tileHeight ?? 16;
        this.columns = this.properties.columns ?? 1;
        this.mapWidth = this.properties.mapWidth ?? 1;
        this.mapHeight = this.properties.mapHeight ?? 1;
        this.tiles = Array.isArray(this.properties.tiles) ? this.properties.tiles : [];
        // null = all non-empty solid; array = whitelist of solid atlas indices
        this.solidIndices = this.properties.solidIndices === undefined
            ? null
            : this.properties.solidIndices;
        this.tileKinds = this.properties.tileKinds || null;
        this.crumbTime = this.properties.crumbTime ?? 1.05;
        this.crumbBack = this.properties.crumbBack ?? 3.4;
        this._crumbT = {};
        this._gone = {};
        this._resolvedSrc = null;
        this._resolved = false;
        this._solidCache = null;
        this._syncEntitySize();
    }

    kindOf(tileIndex) {
        if (tileIndex == null || tileIndex < 0) return TILE_KIND.empty;
        if (this.tileKinds) {
            return this.tileKinds[tileIndex] ?? this.tileKinds[String(tileIndex)] ?? TILE_KIND.empty;
        }
        return this._isSolidIndexLegacy(tileIndex) ? TILE_KIND.solid : TILE_KIND.empty;
    }

    tileKindAt(tx, ty) {
        return this.kindOf(this.tileAt(tx, ty));
    }

    tileKindAtWorld(px, py) {
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const tx = Math.floor((px - this.entity.x) / tw);
        const ty = Math.floor((py - this.entity.y) / th);
        return this.tileKindAt(tx, ty);
    }

    _cellKey(tx, ty) {
        return `${tx},${ty}`;
    }

    isSolidWorld(px, py) {
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const tx = Math.floor((px - this.entity.x) / tw);
        const ty = Math.floor((py - this.entity.y) / th);
        const idx = this.tileAt(tx, ty);
        if (idx < 0) return false;
        const kind = this.kindOf(idx);
        if (kind === TILE_KIND.crumb && this._gone[this._cellKey(tx, ty)] > 0) return false;
        if (kind === TILE_KIND.halfTop) return (py - this.entity.y) < ty * th + th / 2;
        if (this.tileKinds) return isSolidKind(kind);
        return this._isSolidIndexLegacy(idx);
    }

    rectBlocked(x, y, w, h) {
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const c0 = Math.floor((x - this.entity.x) / tw);
        const c1 = Math.floor((x + w - 1 - this.entity.x) / tw);
        const r0 = Math.floor((y - this.entity.y) / th);
        const r1 = Math.floor((y + h - 1 - this.entity.y) / th);
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const idx = this.tileAt(c, r);
                if (idx < 0) continue;
                const kind = this.kindOf(idx);
                if (kind === TILE_KIND.crumb && this._gone[this._cellKey(c, r)] > 0) continue;
                if (kind === TILE_KIND.halfTop) {
                    const top = this.entity.y + r * th;
                    if (y < top + th / 2) return true;
                    continue;
                }
                if (this.tileKinds ? isSolidKind(kind) : this._isSolidIndexLegacy(idx)) return true;
            }
        }
        return false;
    }

    touchCrumbUnder(p) {
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const r = Math.floor((p.y + p.h + 2 - this.entity.y) / th);
        const c0 = Math.floor((p.x - this.entity.x) / tw);
        const c1 = Math.floor((p.x + p.w - 1 - this.entity.x) / tw);
        for (let c = c0; c <= c1; c++) {
            if (this.kindOf(this.tileAt(c, r)) !== TILE_KIND.crumb) continue;
            const k = this._cellKey(c, r);
            if (this._gone[k] > 0 || this._crumbT[k] !== undefined) continue;
            this._crumbT[k] = this.crumbTime;
        }
    }

    /** Pixel size of the full map — keeps entity box aligned for editor/gizmos. */
    _syncEntitySize() {
        const w = Math.max(1, this.mapWidth) * Math.max(1, this.tileWidth);
        const h = Math.max(1, this.mapHeight) * Math.max(1, this.tileHeight);
        if (this.entity) {
            this.entity.width = w;
            this.entity.height = h;
        }
    }

    /**
     * Resolve tileset / Image catalog refs once scene.assetsById is available.
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    _ensureResolved(scene) {
        if (this._resolved) return;
        this._resolved = true;

        let src = this.src || null;
        const assetsById = scene?.assetsById;

        if (this.tilesetAssetId && assetsById) {
            const ts = typeof assetsById.get === 'function'
                ? assetsById.get(this.tilesetAssetId)
                : assetsById[this.tilesetAssetId];
            if (ts) {
                const p = ts.properties || {};
                if (p.tileWidth != null) this.tileWidth = p.tileWidth;
                if (p.tileHeight != null) this.tileHeight = p.tileHeight;
                if (p.columns != null) this.columns = p.columns;
                if (p.solidIndices !== undefined && this.properties.solidIndices === undefined) {
                    this.solidIndices = p.solidIndices;
                }
                src = TilemapBehavior._assetImgSrc(ts, assetsById) || src;
            }
        }

        if (!src && this.imageAssetId && assetsById) {
            const img = typeof assetsById.get === 'function'
                ? assetsById.get(this.imageAssetId)
                : assetsById[this.imageAssetId];
            src = img?.imgSrc || src;
        }

        this._resolvedSrc = src;
        this._syncEntitySize();
        this._solidCache = null;
    }

    static _assetImgSrc(asset, assetsById) {
        if (!asset) return null;
        if (asset.imgSrc) return asset.imgSrc;
        const imgId = asset.properties?.imageAssetId;
        if (imgId && assetsById) {
            const img = typeof assetsById.get === 'function' ? assetsById.get(imgId) : assetsById[imgId];
            if (img?.imgSrc) return img.imgSrc;
        }
        return null;
    }

    tileAt(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.mapWidth || ty >= this.mapHeight) return -1;
        const v = this.tiles[ty * this.mapWidth + tx];
        if (v == null || v < 0) return -1;
        return v;
    }

    _isSolidIndexLegacy(tileIndex) {
        if (tileIndex < 0) return false;
        if (this.solidIndices == null) return true;
        if (!Array.isArray(this.solidIndices)) return true;
        return this.solidIndices.includes(tileIndex);
    }

    _isSolidIndex(tileIndex) {
        if (tileIndex < 0) return false;
        if (this.tileKinds) {
            const kind = this.kindOf(tileIndex);
            return kind === TILE_KIND.solid || kind === TILE_KIND.crumb || kind === TILE_KIND.halfTop;
        }
        return this._isSolidIndexLegacy(tileIndex);
    }

    /**
     * One world-space AABB per solid occupied cell.
     * @param {import('../Scene.js').Scene|null|undefined} [scene]
     * @returns {Array<{x:number,y:number,width:number,height:number}>}
     */
    getSolidRects(scene) {
        this._ensureResolved(scene);
        if (
            this._solidCache
            && this._cacheOriginX === this.entity.x
            && this._cacheOriginY === this.entity.y
        ) {
            return this._solidCache;
        }

        const rects = [];
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const ox = this.entity.x;
        const oy = this.entity.y;

        for (let ty = 0; ty < this.mapHeight; ty++) {
            for (let tx = 0; tx < this.mapWidth; tx++) {
                const idx = this.tileAt(tx, ty);
                if (!this._isSolidIndex(idx)) continue;
                if (this.kindOf(idx) === TILE_KIND.crumb && this._gone[this._cellKey(tx, ty)] > 0) continue;
                const half = this.kindOf(idx) === TILE_KIND.halfTop;
                rects.push({
                    x: ox + tx * tw,
                    y: oy + ty * th,
                    width: tw,
                    height: half ? th / 2 : th
                });
            }
        }
        this._solidCache = rects;
        this._cacheOriginX = ox;
        this._cacheOriginY = oy;
        return rects;
    }

    update(dt, scene) {
        this._ensureResolved(scene);
        if (dt <= 0) return;
        let dirty = false;
        for (const k of Object.keys(this._crumbT)) {
            this._crumbT[k] -= dt;
            if (this._crumbT[k] <= 0) {
                this._gone[k] = this.crumbBack;
                delete this._crumbT[k];
                dirty = true;
            }
        }
        for (const k of Object.keys(this._gone)) {
            this._gone[k] -= dt;
            if (this._gone[k] <= 0) {
                delete this._gone[k];
                dirty = true;
            }
        }
        if (dirty) this._solidCache = null;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Map<string, CanvasImageSource>|null|undefined} imageCache
     * @param {number} absX
     * @param {number} absY
     * @returns {boolean} true if this behavior handled the draw (skip entity fallback)
     */
    drawTiles(ctx, imageCache, absX, absY) {
        // scene not available here — use already-resolved src or raw property
        const src = this._resolvedSrc || this.src;
        const img = src && imageCache?.get(src);
        const tw = Math.max(1, this.tileWidth);
        const th = Math.max(1, this.tileHeight);
        const cols = Math.max(1, this.columns);

        if (img && img.complete !== false && (img.naturalHeight === undefined || img.naturalHeight !== 0)) {
            for (let ty = 0; ty < this.mapHeight; ty++) {
                for (let tx = 0; tx < this.mapWidth; tx++) {
                    const idx = this.tileAt(tx, ty);
                    if (idx < 0) continue;
                    if (this.kindOf(idx) === TILE_KIND.crumb && this._gone[this._cellKey(tx, ty)] > 0) continue;
                    const sx = (idx % cols) * tw;
                    const sy = Math.floor(idx / cols) * th;
                    ctx.drawImage(img, sx, sy, tw, th, absX + tx * tw, absY + ty * th, tw, th);
                }
            }
            return true;
        }

        // Fallback: solid-colored cells so maps are visible without atlas preload
        for (let ty = 0; ty < this.mapHeight; ty++) {
            for (let tx = 0; tx < this.mapWidth; tx++) {
                const idx = this.tileAt(tx, ty);
                if (idx < 0) continue;
                if (this.kindOf(idx) === TILE_KIND.crumb && this._gone[this._cellKey(tx, ty)] > 0) continue;
                ctx.fillStyle = this.entity.color || '#6b7280';
                ctx.fillRect(absX + tx * tw, absY + ty * th, tw, th);
            }
        }
        return true;
    }

    /**
     * @param {Set<string>} sources
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    collectImageSources(sources, scene) {
        this._ensureResolved(scene);
        if (this._resolvedSrc) sources.add(this._resolvedSrc);
    }
}
