import { Behavior } from './Behavior.js';

/**
 * §7 nineSliceSprite: stretchable-edge image for UI frames / scalable decorations.
 *
 * Source image is split into a 3×3 grid by border margins (source px). Corners stay
 * fixed size; edges stretch on one axis; center scales on both (optional).
 *
 * Properties:
 * - `imageAssetId` / `src` — atlas image (catalog Image or inline URL)
 * - `borderLeft` / `borderRight` / `borderTop` / `borderBottom` — source slice margins
 *   in px (default 8 each). Clamped so left+right ≤ sourceW and top+bottom ≤ sourceH.
 * - `fillCenter` — draw the center patch (default true); false = hollow frame
 * - destination size = entity.width × entity.height
 *
 * Duck-types:
 * - `drawNineSlice(ctx, imageCache, absX, absY)` — Renderer (skips entity fill)
 * - `collectImageSources(sources, scene)` — AssetLoader preload
 * - never solid (no getBounds; `isOverlapping` false)
 *
 * No dedicated Asset Editor 9-slice preview / paint UI this pass.
 */
export class NineSliceSpriteBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.imageAssetId = this.properties.imageAssetId ?? '';
        this.src = this.properties.src ?? '';
        this.borderLeft = Math.max(0, this.properties.borderLeft ?? 8);
        this.borderRight = Math.max(0, this.properties.borderRight ?? 8);
        this.borderTop = Math.max(0, this.properties.borderTop ?? 8);
        this.borderBottom = Math.max(0, this.properties.borderBottom ?? 8);
        this.fillCenter = this.properties.fillCenter !== false;
        this._resolvedSrc = null;
        this._resolved = false;
    }

    isOverlapping() {
        return false;
    }

    /**
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    _ensureResolved(scene) {
        if (this._resolved) return;
        this._resolved = true;
        let src = this.src || null;
        const assetsById = scene?.assetsById;
        if (!src && this.imageAssetId && assetsById) {
            const img = typeof assetsById.get === 'function'
                ? assetsById.get(this.imageAssetId)
                : assetsById[this.imageAssetId];
            if (img?.imgSrc) src = img.imgSrc;
        }
        // Fallback: entity.imgSrc if component has no explicit source
        if (!src && this.entity?.imgSrc) src = this.entity.imgSrc;
        this._resolvedSrc = src;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Map<string, HTMLImageElement>|null|undefined} imageCache
     * @param {number} absX
     * @param {number} absY
     * @returns {boolean}
     */
    drawNineSlice(ctx, imageCache, absX, absY) {
        const src = this._resolvedSrc;
        const img = src && imageCache?.get(src);
        const dw = this.entity?.width ?? 0;
        const dh = this.entity?.height ?? 0;
        if (dw <= 0 || dh <= 0) return true;

        if (!img || !img.complete || img.naturalHeight === 0) {
            // Fallback solid when image not ready (same as plain entity without cache)
            ctx.fillStyle = this.entity?.color || '#cccccc';
            ctx.fillRect(absX, absY, dw, dh);
            return true;
        }

        const sw = img.naturalWidth || img.width || 0;
        const sh = img.naturalHeight || img.height || 0;
        if (sw <= 0 || sh <= 0) return true;

        let bl = Math.min(this.borderLeft, sw);
        let br = Math.min(this.borderRight, sw);
        let bt = Math.min(this.borderTop, sh);
        let bb = Math.min(this.borderBottom, sh);
        if (bl + br > sw) {
            const s = sw / (bl + br);
            bl = Math.floor(bl * s);
            br = sw - bl;
        }
        if (bt + bb > sh) {
            const s = sh / (bt + bb);
            bt = Math.floor(bt * s);
            bb = sh - bt;
        }

        const midSW = Math.max(0, sw - bl - br);
        const midSH = Math.max(0, sh - bt - bb);

        // Dest: clamp borders so corners don't overflow small entities
        let dl = Math.min(bl, dw);
        let dr = Math.min(br, dw);
        let dt = Math.min(bt, dh);
        let db = Math.min(bb, dh);
        if (dl + dr > dw) {
            const s = dw / (dl + dr);
            dl = Math.floor(dl * s);
            dr = dw - dl;
        }
        if (dt + db > dh) {
            const s = dh / (dt + db);
            dt = Math.floor(dt * s);
            db = dh - dt;
        }
        const midDW = Math.max(0, dw - dl - dr);
        const midDH = Math.max(0, dh - dt - db);

        const sx0 = 0;
        const sx1 = bl;
        const sx2 = bl + midSW;
        const sy0 = 0;
        const sy1 = bt;
        const sy2 = bt + midSH;

        const dx0 = absX;
        const dx1 = absX + dl;
        const dx2 = absX + dl + midDW;
        const dy0 = absY;
        const dy1 = absY + dt;
        const dy2 = absY + dt + midDH;

        const draw = (sx, sy, sW, sH, dx, dy, dW, dH) => {
            if (sW <= 0 || sH <= 0 || dW <= 0 || dH <= 0) return;
            ctx.drawImage(img, sx, sy, sW, sH, dx, dy, dW, dH);
        };

        // Corners
        draw(sx0, sy0, bl, bt, dx0, dy0, dl, dt);
        draw(sx2, sy0, br, bt, dx2, dy0, dr, dt);
        draw(sx0, sy2, bl, bb, dx0, dy2, dl, db);
        draw(sx2, sy2, br, bb, dx2, dy2, dr, db);

        // Edges
        draw(sx1, sy0, midSW, bt, dx1, dy0, midDW, dt);
        draw(sx1, sy2, midSW, bb, dx1, dy2, midDW, db);
        draw(sx0, sy1, bl, midSH, dx0, dy1, dl, midDH);
        draw(sx2, sy1, br, midSH, dx2, dy1, dr, midDH);

        // Center
        if (this.fillCenter) {
            draw(sx1, sy1, midSW, midSH, dx1, dy1, midDW, midDH);
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
