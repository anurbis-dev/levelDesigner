import { Behavior } from './Behavior.js';

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
        this._resolvedSrc = null;
        this._resolved = false;
        this._solidCache = null;
        this._syncEntitySize();
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

    _isSolidIndex(tileIndex) {
        if (tileIndex < 0) return false;
        if (this.solidIndices == null) return true;
        if (!Array.isArray(this.solidIndices)) return true;
        return this.solidIndices.includes(tileIndex);
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
                rects.push({
                    x: ox + tx * tw,
                    y: oy + ty * th,
                    width: tw,
                    height: th
                });
            }
        }
        this._solidCache = rects;
        this._cacheOriginX = ox;
        this._cacheOriginY = oy;
        return rects;
    }

    update(_dt, scene) {
        this._ensureResolved(scene);
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
