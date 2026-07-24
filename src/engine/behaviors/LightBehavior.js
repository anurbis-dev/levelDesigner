import { Behavior } from './Behavior.js';

/**
 * §7 light: point / directional / area light for Canvas 2D ambient+additive pass.
 *
 * Properties:
 * - `lightType` — `'point'` | `'directional'` | `'area'` (default `'point'`)
 * - `color` — hex (default `#ffffff`)
 * - `intensity` — 0+ (default 1; used as peak alpha of the additive glow)
 * - `radius` — px reach for point/directional (default 128); area soft padding
 * - `angle` — deg for directional, 0 = +X, -90 = up (default -90)
 * - `spread` — full cone width deg for directional (default 60)
 * - `soft` — 0–1 edge falloff (default 0.5); point inner hard core = radius*(1-soft)
 * - `ambient` — 0–1 scene darkness when this light is enabled (default 0.45);
 *   Renderer takes the max ambient among enabled lights
 * - `enabled` (default true)
 *
 * Duck-types:
 * - `drawLight(ctx, absX, absY)` — additive glow under Renderer light pass
 * - never solid (`isOverlapping` false); entity body not drawn (marker only in editor)
 *
 * Soft geometry shadows over tilemap are out of scope this pass (falloff only).
 */
export class LightBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        const t = this.properties.lightType ?? 'point';
        this.lightType = (t === 'directional' || t === 'area') ? t : 'point';
        this.color = this.properties.color ?? '#ffffff';
        this.intensity = Math.max(0, this.properties.intensity ?? 1);
        this.radius = Math.max(0, this.properties.radius ?? 128);
        this.angle = this.properties.angle ?? -90;
        this.spread = Math.max(0, this.properties.spread ?? 60);
        this.soft = Math.max(0, Math.min(1, this.properties.soft ?? 0.5));
        this.ambient = Math.max(0, Math.min(1, this.properties.ambient ?? 0.45));
        this.enabled = this.properties.enabled !== false;
        this._rgb = LightBehavior._parseHex(this.color);
    }

    isOverlapping() {
        return false;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} absX entity top-left world X
     * @param {number} absY entity top-left world Y
     */
    drawLight(ctx, absX, absY) {
        if (!this.enabled || this.intensity <= 0) return;
        const { r, g, b } = this._rgb;
        const a = Math.min(1, this.intensity);
        const w = this.entity?.width ?? 0;
        const h = this.entity?.height ?? 0;
        const cx = absX + w / 2;
        const cy = absY + h / 2;

        if (this.lightType === 'area') {
            this._drawArea(ctx, absX, absY, w, h, r, g, b, a);
            return;
        }
        if (this.lightType === 'directional') {
            this._drawDirectional(ctx, cx, cy, r, g, b, a);
            return;
        }
        this._drawPoint(ctx, cx, cy, r, g, b, a);
    }

    _drawPoint(ctx, cx, cy, r, g, b, a) {
        const rad = this.radius;
        if (rad <= 0) return;
        const inner = rad * (1 - this.soft);
        const grad = ctx.createRadialGradient(cx, cy, Math.max(0, inner), cx, cy, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawDirectional(ctx, cx, cy, r, g, b, a) {
        const rad = this.radius;
        if (rad <= 0) return;
        const half = (this.spread * Math.PI) / 360;
        const base = (this.angle * Math.PI) / 180;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(base);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rad, -half, half);
        ctx.closePath();
        ctx.clip();
        const inner = rad * (1 - this.soft);
        const grad = ctx.createRadialGradient(0, 0, Math.max(0, inner), 0, 0, rad);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawArea(ctx, absX, absY, w, h, r, g, b, a) {
        const pad = this.radius > 0 ? this.radius * this.soft : 0;
        if (pad <= 0 && w <= 0 && h <= 0) return;
        // Soft halo via radial at center covering padded AABB
        const cx = absX + w / 2;
        const cy = absY + h / 2;
        const halfW = w / 2 + pad;
        const halfH = h / 2 + pad;
        const outer = Math.max(halfW, halfH, 1);
        const innerRatio = 1 - this.soft;
        const inner = outer * Math.max(0, Math.min(1, innerRatio));
        const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(cx - outer, cy - outer, outer * 2, outer * 2);
    }

    static _parseHex(hex) {
        if (typeof hex !== 'string') return { r: 255, g: 255, b: 255 };
        let h = hex.trim();
        if (h[0] === '#') h = h.slice(1);
        if (h.length === 3) {
            h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        }
        if (h.length !== 6) return { r: 255, g: 255, b: 255 };
        const n = parseInt(h, 16);
        if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
}
