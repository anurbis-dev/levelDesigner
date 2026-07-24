import { Behavior } from './Behavior.js';

/**
 * §7 particleEffect: continuous/burst VFX emitter.
 *
 * Properties (inline sprite + params; catalog particleEffect is spawnable placeholder):
 * - `imageAssetId` / `src` — optional particle sprite (fallback: colored rect)
 * - `maxParticles` (default 32)
 * - `emitRate` — particles per second while `emitting` (default 12)
 * - `lifetime` — seconds (default 1)
 * - `speed` / `speedVariance` — px/s initial velocity (default 50 / 20)
 * - `angle` — emit direction degrees, 0 = +X, -90 = up (default -90)
 * - `spread` — full cone width in degrees (default 360)
 * - `gravityX` / `gravityY` — px/s² (default 0 / 80)
 * - `startSize` / `endSize` — px (default 6 / 0)
 * - `startColor` / `endColor` — hex (default #ffffff / #ffffff)
 * - `startAlpha` / `endAlpha` — 0–1 (default 1 / 0)
 * - `emitting` (default true) — continuous emission
 * - `burst` — one-shot count on first update when > 0 (default 0)
 * - `seed` — optional uint for deterministic tests (LCG); omit → Math.random
 *
 * Duck-types:
 * - `drawParticles(ctx, imageCache, absX, absY)` — Renderer (skips entity fill)
 * - `collectImageSources(sources, scene)` — AssetLoader preload
 * - never solid (`isOverlapping` false)
 */
export class ParticleEffectBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.imageAssetId = this.properties.imageAssetId ?? '';
        this.src = this.properties.src ?? '';
        this.maxParticles = Math.max(1, this.properties.maxParticles ?? 32);
        this.emitRate = this.properties.emitRate ?? 12;
        this.lifetime = Math.max(0.01, this.properties.lifetime ?? 1);
        this.speed = this.properties.speed ?? 50;
        this.speedVariance = this.properties.speedVariance ?? 20;
        this.angle = this.properties.angle ?? -90;
        this.spread = this.properties.spread ?? 360;
        this.gravityX = this.properties.gravityX ?? 0;
        this.gravityY = this.properties.gravityY ?? 80;
        this.startSize = this.properties.startSize ?? 6;
        this.endSize = this.properties.endSize ?? 0;
        this.startColor = this.properties.startColor ?? '#ffffff';
        this.endColor = this.properties.endColor ?? '#ffffff';
        this.startAlpha = this.properties.startAlpha ?? 1;
        this.endAlpha = this.properties.endAlpha ?? 0;
        this.emitting = this.properties.emitting !== false;
        this.burst = Math.max(0, this.properties.burst ?? 0);

        this._particles = [];
        this._emitAcc = 0;
        this._burstDone = false;
        this._resolvedSrc = null;
        this._resolved = false;
        this._seed = this.properties.seed != null ? (this.properties.seed >>> 0) : null;
        this._startRgb = ParticleEffectBehavior._parseHex(this.startColor);
        this._endRgb = ParticleEffectBehavior._parseHex(this.endColor);
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
        this._resolvedSrc = src;
    }

    /** @returns {number} 0..1 */
    _rand() {
        if (this._seed == null) return Math.random();
        this._seed = (Math.imul(this._seed, 1664525) + 1013904223) >>> 0;
        return this._seed / 0x100000000;
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

    static _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    _spawnOne() {
        if (this._particles.length >= this.maxParticles) return;
        const half = (this.spread * Math.PI) / 360; // half cone in rad
        const base = (this.angle * Math.PI) / 180;
        const dir = base + (this._rand() * 2 - 1) * half;
        const spd = this.speed + (this._rand() * 2 - 1) * this.speedVariance;
        const ox = (this.entity?.width ?? 0) / 2;
        const oy = (this.entity?.height ?? 0) / 2;
        this._particles.push({
            x: ox,
            y: oy,
            vx: Math.cos(dir) * spd,
            vy: Math.sin(dir) * spd,
            age: 0,
            life: this.lifetime
        });
    }

    /**
     * Emit up to `count` particles (clamped by maxParticles).
     * @param {number} count
     */
    emitBurst(count) {
        const n = Math.max(0, Math.floor(count));
        for (let i = 0; i < n; i++) this._spawnOne();
    }

    isOverlapping() {
        return false;
    }

    update(dt, scene) {
        this._ensureResolved(scene);
        if (!this._burstDone && this.burst > 0) {
            this.emitBurst(this.burst);
            this._burstDone = true;
        }

        if (this.emitting && this.emitRate > 0) {
            this._emitAcc += dt * this.emitRate;
            while (this._emitAcc >= 1) {
                this._spawnOne();
                this._emitAcc -= 1;
            }
        }

        const gx = this.gravityX;
        const gy = this.gravityY;
        const next = [];
        for (let i = 0; i < this._particles.length; i++) {
            const p = this._particles[i];
            p.age += dt;
            if (p.age >= p.life) continue;
            p.vx += gx * dt;
            p.vy += gy * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            next.push(p);
        }
        this._particles = next;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Map<string, HTMLImageElement>|undefined} imageCache
     * @param {number} absX entity top-left world X
     * @param {number} absY entity top-left world Y
     * @returns {true} always — suppress default entity rect/sprite fill
     */
    drawParticles(ctx, imageCache, absX, absY) {
        const img = this._resolvedSrc && imageCache?.get(this._resolvedSrc);
        const hasImg = img && img.complete && img.naturalHeight !== 0;
        const prevAlpha = ctx.globalAlpha;
        const sr = this._startRgb;
        const er = this._endRgb;

        for (let i = 0; i < this._particles.length; i++) {
            const p = this._particles[i];
            const t = Math.min(1, p.age / p.life);
            const size = Math.max(0, ParticleEffectBehavior._lerp(this.startSize, this.endSize, t));
            if (size <= 0) continue;
            const alpha = Math.max(0, Math.min(1,
                ParticleEffectBehavior._lerp(this.startAlpha, this.endAlpha, t)));
            if (alpha <= 0) continue;

            const px = absX + p.x - size / 2;
            const py = absY + p.y - size / 2;
            ctx.globalAlpha = alpha;

            if (hasImg) {
                ctx.drawImage(img, px, py, size, size);
            } else {
                const r = Math.round(ParticleEffectBehavior._lerp(sr.r, er.r, t));
                const g = Math.round(ParticleEffectBehavior._lerp(sr.g, er.g, t));
                const b = Math.round(ParticleEffectBehavior._lerp(sr.b, er.b, t));
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(px, py, size, size);
            }
        }

        ctx.globalAlpha = prevAlpha;
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
