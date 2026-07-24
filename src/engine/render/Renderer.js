import { ParallaxController } from './ParallaxController.js';

/**
 * Canvas 2D renderer — ported subset of src/ui/CanvasRenderer.js's
 * setCamera/drawObject/drawGroup, minus editor-only affordances (missing-image
 * type-icon glyph, `locked` outline — debugging aids for the editor, not gameplay).
 * Accepts anything shaped like a canvas ({width, height, getContext()}) so it can
 * be unit-tested with a plain mock context (see tests/engine/Renderer.test.js).
 */
export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawBackground(color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    setCamera(camera) {
        this.ctx.save();
        this.ctx.scale(camera.zoom, camera.zoom);
        this.ctx.translate(-camera.x, -camera.y);
    }

    restoreCamera() {
        this.ctx.restore();
    }

    drawEntity(entity, parentX = 0, parentY = 0) {
        if (!entity.visible) return;
        const absX = entity.x + parentX;
        const absY = entity.y + parentY;

        if (entity.type === 'group' && entity.children) {
            entity.children.forEach(child => this.drawEntity(child, absX, absY));
            return;
        }

        this._drawSingle(entity, absX, absY);
    }

    _drawSingle(entity, x, y) {
        const rotation = entity.rotation || 0;
        if (rotation) {
            const cx = x + entity.width / 2;
            const cy = y + entity.height / 2;
            this.ctx.save();
            this.ctx.translate(cx, cy);
            this.ctx.rotate(rotation * Math.PI / 180);
            this.ctx.translate(-cx, -cy);
        }

        this.ctx.filter = Renderer._buildFilterString(entity.materialPreset) || 'none';

        // §7 tilemap: multi-cell atlas draw (empty cells stay transparent / not filled)
        const tilemap = entity.behaviors?.find(b => typeof b.drawTiles === 'function');
        if (tilemap) {
            tilemap.drawTiles(this.ctx, this.imageCache, x, y);
            if (rotation) this.ctx.restore();
            return;
        }

        // §7 particleEffect: VFX particles (emitter marker itself is not drawn)
        const particles = entity.behaviors?.find(b => typeof b.drawParticles === 'function');
        if (particles) {
            particles.drawParticles(this.ctx, this.imageCache, x, y);
            if (rotation) this.ctx.restore();
            return;
        }

        // §7 nineSliceSprite: 3×3 border-preserving stretch into entity box
        const nineSlice = entity.behaviors?.find(b => typeof b.drawNineSlice === 'function');
        if (nineSlice) {
            nineSlice.drawNineSlice(this.ctx, this.imageCache, x, y);
            if (rotation) this.ctx.restore();
            return;
        }

        // §7 fontTextStyle: canvas text (font/outline/shadow); no solid body
        const fontText = entity.behaviors?.find(b => typeof b.drawText === 'function');
        if (fontText) {
            fontText.drawText(this.ctx, x, y);
            if (rotation) this.ctx.restore();
            return;
        }

        // §7 light: marker body suppressed; glow drawn in post-pass applyLights
        const light = entity.behaviors?.find(b => typeof b.drawLight === 'function');
        if (light) {
            if (rotation) this.ctx.restore();
            return;
        }

        const img = entity.imgSrc && this.imageCache?.get(entity.imgSrc);
        if (img && img.complete && img.naturalHeight !== 0) {
            const spriteAnim = entity.behaviors?.find(b => typeof b.getSourceRect === 'function');
            const sourceRect = spriteAnim?.getSourceRect();
            if (sourceRect) {
                this.ctx.drawImage(img, sourceRect.x, sourceRect.y, sourceRect.w, sourceRect.h, x, y, entity.width, entity.height);
            } else {
                this.ctx.drawImage(img, x, y, entity.width, entity.height);
            }
        } else {
            this.ctx.fillStyle = entity.color || '#cccccc';
            this.ctx.fillRect(x, y, entity.width, entity.height);
        }

        if (rotation) {
            this.ctx.restore();
        }
    }

    /**
     * §7 materialShaderPreset / volume: `materialPreset`-shaped object
     * `{blur?, brightness?, saturate?, hueRotate?, dropShadow?:{x?,y?,blur?,color?}}`
     * → canvas 2D CSS `filter` string. Used for per-entity `entity.materialPreset` and for
     * screen-space `VolumeBehavior.getViewFilter()` post-pass.
     * @returns {string|null} CSS filter string, or null for an empty/absent preset.
     */
    static _buildFilterString(preset) {
        if (!preset) return null;
        const parts = [];
        if (preset.blur) parts.push(`blur(${preset.blur}px)`);
        if (preset.brightness !== undefined) parts.push(`brightness(${preset.brightness})`);
        if (preset.saturate !== undefined) parts.push(`saturate(${preset.saturate})`);
        if (preset.hueRotate) parts.push(`hue-rotate(${preset.hueRotate}deg)`);
        if (preset.dropShadow) {
            const d = preset.dropShadow;
            parts.push(`drop-shadow(${d.x ?? 0}px ${d.y ?? 0}px ${d.blur ?? 0}px ${d.color ?? 'rgba(0,0,0,0.5)'})`);
        }
        return parts.length ? parts.join(' ') : null;
    }

    /**
     * @param {import('../Scene.js').Scene} scene
     * @param {{x:number,y:number,zoom:number}} camera
     * @param {{x:number,y:number}} [parallaxStartPosition] - defaults to camera (no parallax shift)
     * @param {string[]|null} [renderLayers] - layer ids to draw, or null/empty for all
     *   (CameraBehavior.getRenderLayers()). Entities with no layerId always draw — layer
     *   restriction only excludes entities explicitly assigned to a layer outside the list.
     */
    renderScene(scene, camera, parallaxStartPosition = camera, renderLayers = null) {
        this.clear();
        this.drawBackground(scene.settings.backgroundColor);

        const cameraOffset = ParallaxController.getCameraOffset(camera, scene.settings, parallaxStartPosition);
        const layerFilter = renderLayers && renderLayers.length ? new Set(renderLayers) : null;
        this.setCamera(camera);

        scene.entities.forEach(entity => {
            if (layerFilter && entity.layerId && !layerFilter.has(entity.layerId)) return;

            const layer = scene.getLayerById(entity.layerId);
            const layerParallaxOffset = layer?.parallaxOffset || 0;

            if (!layerParallaxOffset) {
                this.drawEntity(entity);
                return;
            }

            const offset = ParallaxController.getParallaxOffset(layerParallaxOffset, cameraOffset);
            const originalX = entity.x;
            const originalY = entity.y;
            entity.x = originalX - offset.x;
            entity.y = originalY - offset.y;
            this.drawEntity(entity);
            entity.x = originalX;
            entity.y = originalY;
        });

        // §7 light: ambient darkness + additive glows (world space, under camera transform)
        this.applyLights(scene, camera, layerFilter);

        this.restoreCamera();

        // §7 volume: screen-space view filter while player is inside a volume zone
        this.applyVolumeFilter(scene);
    }

    /**
     * Collect enabled lights and apply ambient darken + lighter glows.
     * @param {import('../Scene.js').Scene} scene
     * @param {{x:number,y:number,zoom:number}} camera
     * @param {Set<string>|null} layerFilter
     */
    applyLights(scene, camera, layerFilter = null) {
        const lights = [];
        this._collectLights(scene.entities, 0, 0, layerFilter, lights);
        if (!lights.length) return;

        let ambient = 0;
        for (let i = 0; i < lights.length; i++) {
            const a = lights[i].behavior.ambient ?? 0;
            if (a > ambient) ambient = a;
        }

        const zoom = camera.zoom || 1;
        const viewX = camera.x;
        const viewY = camera.y;
        const viewW = this.canvas.width / zoom;
        const viewH = this.canvas.height / zoom;

        if (ambient > 0) {
            this.ctx.fillStyle = `rgba(0,0,0,${ambient})`;
            this.ctx.fillRect(viewX, viewY, viewW, viewH);
        }

        const prevOp = this.ctx.globalCompositeOperation;
        this.ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < lights.length; i++) {
            const { behavior, x, y } = lights[i];
            behavior.drawLight(this.ctx, x, y);
        }
        this.ctx.globalCompositeOperation = prevOp;
    }

    /**
     * @param {Array} entities
     * @param {number} parentX
     * @param {number} parentY
     * @param {Set<string>|null} layerFilter
     * @param {Array<{behavior: object, x: number, y: number}>} out
     */
    _collectLights(entities, parentX, parentY, layerFilter, out) {
        if (!entities) return;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (!entity || entity.visible === false) continue;
            if (layerFilter && entity.layerId && !layerFilter.has(entity.layerId)) continue;

            const absX = (entity.x || 0) + parentX;
            const absY = (entity.y || 0) + parentY;

            if (entity.type === 'group' && entity.children) {
                this._collectLights(entity.children, absX, absY, layerFilter, out);
                continue;
            }

            const behavior = entity.behaviors?.find(
                b => typeof b.drawLight === 'function' && b.enabled !== false
            );
            if (behavior) out.push({ behavior, x: absX, y: absY });
        }
    }

    /**
     * §7 volume: pick highest-priority active view filter (player inside zone)
     * and re-composite the frame with a CSS filter in screen space.
     * Sets `this.lastVolumeFilter` to the CSS string or null (test/observability).
     * @param {import('../Scene.js').Scene} scene
     */
    applyVolumeFilter(scene) {
        this.lastVolumeFilter = null;
        const preset = this._resolveActiveVolumePreset(scene);
        if (!preset) return;
        const filterStr = Renderer._buildFilterString(preset);
        if (!filterStr) return;
        this.lastVolumeFilter = filterStr;

        const w = this.canvas.width;
        const h = this.canvas.height;
        const tmp = this._getFilterScratch(w, h);
        if (!tmp || typeof this.ctx.drawImage !== 'function') {
            // Mock / headless without bitmap path — filter string still recorded.
            return;
        }
        const tctx = tmp.getContext('2d');
        if (!tctx || typeof tctx.drawImage !== 'function') return;
        try {
            tctx.setTransform?.(1, 0, 0, 1, 0, 0);
            tctx.clearRect?.(0, 0, w, h);
            tctx.drawImage(this.canvas, 0, 0);
            this.ctx.save();
            this.ctx.setTransform?.(1, 0, 0, 1, 0, 0);
            this.ctx.filter = filterStr;
            this.ctx.clearRect(0, 0, w, h);
            this.ctx.drawImage(tmp, 0, 0);
            this.ctx.restore();
        } catch {
            // Non-real canvas (unit mock) — lastVolumeFilter still set.
        }
    }

    /**
     * @param {import('../Scene.js').Scene} scene
     * @returns {object|null}
     */
    _resolveActiveVolumePreset(scene) {
        if (!scene?.entities) return null;
        let best = null;
        let bestPri = -Infinity;
        this._walkVolumeFilters(scene.entities, (behavior) => {
            const f = behavior.getViewFilter();
            if (!f) return;
            const pri = behavior.priority ?? 0;
            if (pri >= bestPri) {
                bestPri = pri;
                best = f;
            }
        });
        return best;
    }

    /**
     * @param {Array} entities
     * @param {(b: object) => void} visit
     */
    _walkVolumeFilters(entities, visit) {
        if (!entities) return;
        for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            if (!entity || entity.visible === false) continue;
            if (entity.type === 'group' && entity.children) {
                this._walkVolumeFilters(entity.children, visit);
                continue;
            }
            const behaviors = entity.behaviors;
            if (!behaviors) continue;
            for (let j = 0; j < behaviors.length; j++) {
                const b = behaviors[j];
                if (typeof b.getViewFilter === 'function') visit(b);
            }
        }
    }

    /**
     * Reusable offscreen surface for volume post-pass.
     * @param {number} w
     * @param {number} h
     * @returns {HTMLCanvasElement|OffscreenCanvas|null}
     */
    _getFilterScratch(w, h) {
        if (this._filterScratch && this._filterScratch.width === w && this._filterScratch.height === h) {
            return this._filterScratch;
        }
        try {
            if (typeof OffscreenCanvas !== 'undefined') {
                this._filterScratch = new OffscreenCanvas(w, h);
                return this._filterScratch;
            }
            if (typeof document !== 'undefined' && document.createElement) {
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                this._filterScratch = c;
                return c;
            }
        } catch {
            /* ignore */
        }
        return null;
    }
}
