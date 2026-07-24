import { Behavior } from './Behavior.js';

/**
 * §7 fontTextStyle: canvas text with font / outline / shadow parameters.
 *
 * Draws `text` inside the entity box (no solid rect). Optional `styleAssetId`
 * merges catalog fontTextStyle asset fields (properties or top-level) under
 * component props — component wins on conflict.
 *
 * Properties:
 * - `text` — string (default `'Text'`)
 * - `fontFamily` — CSS family (default `'sans-serif'`)
 * - `fontSize` — px (default 16)
 * - `fontWeight` — CSS weight (default `'normal'`)
 * - `fontStyle` — CSS style (default `'normal'`)
 * - `color` — fill (default entity.color or `#ffffff`)
 * - `align` — `'left'` | `'center'` | `'right'` (default `'left'`)
 * - `verticalAlign` — `'top'` | `'middle'` | `'bottom'` (default `'top'`)
 * - `outlineColor` / `outlineWidth` — stroke (width 0 = no outline)
 * - `shadowColor` / `shadowBlur` / `shadowOffsetX` / `shadowOffsetY`
 * - `wrap` — word-wrap to entity.width (default true)
 * - `lineHeight` — multiplier of fontSize (default 1.2)
 * - `styleAssetId` — catalog fontTextStyle for shared defaults
 *
 * Duck-types:
 * - `drawText(ctx, absX, absY)` — Renderer (skips entity fill)
 * - never solid (`isOverlapping` false)
 *
 * No FontFace / custom .woff preload this pass (system/CSS families only).
 */
export class FontTextStyleBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.text = this.properties.text ?? 'Text';
        this.fontFamily = this.properties.fontFamily ?? 'sans-serif';
        this.fontSize = Math.max(1, this.properties.fontSize ?? 16);
        this.fontWeight = this.properties.fontWeight ?? 'normal';
        this.fontStyle = this.properties.fontStyle ?? 'normal';
        this.color = this.properties.color ?? null;
        this.align = FontTextStyleBehavior._align(this.properties.align);
        this.verticalAlign = FontTextStyleBehavior._vAlign(this.properties.verticalAlign);
        this.outlineColor = this.properties.outlineColor ?? '';
        this.outlineWidth = Math.max(0, this.properties.outlineWidth ?? 0);
        this.shadowColor = this.properties.shadowColor ?? '';
        this.shadowBlur = Math.max(0, this.properties.shadowBlur ?? 0);
        this.shadowOffsetX = this.properties.shadowOffsetX ?? 0;
        this.shadowOffsetY = this.properties.shadowOffsetY ?? 0;
        this.wrap = this.properties.wrap !== false;
        this.lineHeight = Math.max(0.5, this.properties.lineHeight ?? 1.2);
        this.styleAssetId = this.properties.styleAssetId ?? '';
        this._styleMerged = false;
    }

    isOverlapping() {
        return false;
    }

    update(_dt, scene) {
        this.ensureStyleResolved(scene);
    }

    static _align(v) {
        if (v === 'center' || v === 'right') return v;
        return 'left';
    }

    static _vAlign(v) {
        if (v === 'middle' || v === 'bottom') return v;
        return 'top';
    }

    /**
     * Merge catalog style once (component props already applied in ctor;
     * only fill empty/default gaps from asset, or override when asset has
     * explicit style fields and component left styleAssetId).
     * Component non-default-ish fields win: we apply asset first then re-apply
     * explicit component keys that were set.
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    ensureStyleResolved(scene) {
        if (this._styleMerged || !this.styleAssetId || !scene?.assetsById) return;
        this._styleMerged = true;
        const asset = typeof scene.assetsById.get === 'function'
            ? scene.assetsById.get(this.styleAssetId)
            : scene.assetsById[this.styleAssetId];
        if (!asset) return;
        const fromAsset = { ...(asset.properties || {}) };
        // Top-level style keys on catalog asset (if author put them there)
        for (const k of FontTextStyleBehavior.STYLE_KEYS) {
            if (asset[k] !== undefined && fromAsset[k] === undefined) {
                fromAsset[k] = asset[k];
            }
        }
        const comp = this.properties || {};
        for (const k of FontTextStyleBehavior.STYLE_KEYS) {
            if (comp[k] !== undefined && comp[k] !== null && comp[k] !== '') continue;
            if (fromAsset[k] === undefined || fromAsset[k] === null) continue;
            this._applyKey(k, fromAsset[k]);
        }
    }

    static STYLE_KEYS = [
        'text', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color',
        'align', 'verticalAlign', 'outlineColor', 'outlineWidth',
        'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY',
        'wrap', 'lineHeight'
    ];

    _applyKey(k, v) {
        switch (k) {
            case 'text': this.text = v; break;
            case 'fontFamily': this.fontFamily = v; break;
            case 'fontSize': this.fontSize = Math.max(1, v); break;
            case 'fontWeight': this.fontWeight = v; break;
            case 'fontStyle': this.fontStyle = v; break;
            case 'color': this.color = v; break;
            case 'align': this.align = FontTextStyleBehavior._align(v); break;
            case 'verticalAlign': this.verticalAlign = FontTextStyleBehavior._vAlign(v); break;
            case 'outlineColor': this.outlineColor = v; break;
            case 'outlineWidth': this.outlineWidth = Math.max(0, v); break;
            case 'shadowColor': this.shadowColor = v; break;
            case 'shadowBlur': this.shadowBlur = Math.max(0, v); break;
            case 'shadowOffsetX': this.shadowOffsetX = v; break;
            case 'shadowOffsetY': this.shadowOffsetY = v; break;
            case 'wrap': this.wrap = v !== false; break;
            case 'lineHeight': this.lineHeight = Math.max(0.5, v); break;
            default: break;
        }
    }

    _fontString() {
        return `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} absX
     * @param {number} absY
     * @returns {boolean}
     */
    drawText(ctx, absX, absY) {
        const raw = this.text == null ? '' : String(this.text);
        if (!raw) return true;

        const w = this.entity?.width ?? 0;
        const h = this.entity?.height ?? 0;
        const fill = this.color || this.entity?.color || '#ffffff';
        const lh = this.fontSize * this.lineHeight;

        ctx.save();
        ctx.font = this._fontString();
        ctx.textAlign = this.align;
        ctx.textBaseline = 'top';
        ctx.fillStyle = fill;

        const maxW = this.wrap && w > 0 ? w : Infinity;
        const lines = this._layoutLines(ctx, raw, maxW);
        const blockH = lines.length * lh;

        let y0 = absY;
        if (this.verticalAlign === 'middle') y0 = absY + (h - blockH) / 2;
        else if (this.verticalAlign === 'bottom') y0 = absY + h - blockH;

        let x0 = absX;
        if (this.align === 'center') x0 = absX + w / 2;
        else if (this.align === 'right') x0 = absX + w;

        const useShadow = !!(this.shadowColor && (this.shadowBlur > 0
            || this.shadowOffsetX || this.shadowOffsetY));
        if (useShadow) {
            ctx.shadowColor = this.shadowColor;
            ctx.shadowBlur = this.shadowBlur;
            ctx.shadowOffsetX = this.shadowOffsetX;
            ctx.shadowOffsetY = this.shadowOffsetY;
        }

        const stroke = this.outlineWidth > 0 && this.outlineColor;
        if (stroke) {
            ctx.strokeStyle = this.outlineColor;
            ctx.lineWidth = this.outlineWidth;
            ctx.lineJoin = 'round';
        }

        for (let i = 0; i < lines.length; i++) {
            const ly = y0 + i * lh;
            const line = lines[i];
            if (stroke) ctx.strokeText(line, x0, ly);
            ctx.fillText(line, x0, ly);
        }

        ctx.restore();
        return true;
    }

    /**
     * Word-wrap when possible; hard-split overlong tokens.
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} text
     * @param {number} maxW
     * @returns {string[]}
     */
    _layoutLines(ctx, text, maxW) {
        const paragraphs = String(text).split('\n');
        const lines = [];
        for (const para of paragraphs) {
            if (!this.wrap || !Number.isFinite(maxW) || maxW <= 0) {
                lines.push(para);
                continue;
            }
            const words = para.split(/(\s+)/);
            let current = '';
            for (const word of words) {
                if (!word) continue;
                const trial = current + word;
                if (current && ctx.measureText(trial).width > maxW) {
                    if (current.trim()) lines.push(current.replace(/\s+$/, ''));
                    // hard-split if single token wider than maxW
                    if (ctx.measureText(word).width > maxW && word.trim()) {
                        let chunk = '';
                        for (const ch of word) {
                            const t2 = chunk + ch;
                            if (chunk && ctx.measureText(t2).width > maxW) {
                                lines.push(chunk);
                                chunk = ch;
                            } else {
                                chunk = t2;
                            }
                        }
                        current = chunk;
                    } else {
                        current = word.replace(/^\s+/, '');
                    }
                } else {
                    current = trial;
                }
            }
            if (current !== '' || para === '') lines.push(current.replace(/\s+$/, ''));
        }
        return lines.length ? lines : [''];
    }
}
