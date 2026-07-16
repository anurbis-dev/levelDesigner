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

        const img = entity.imgSrc && this.imageCache?.get(entity.imgSrc);
        if (img && img.complete && img.naturalHeight !== 0) {
            this.ctx.drawImage(img, x, y, entity.width, entity.height);
        } else {
            this.ctx.fillStyle = entity.color || '#cccccc';
            this.ctx.fillRect(x, y, entity.width, entity.height);
        }

        if (rotation) {
            this.ctx.restore();
        }
    }

    /**
     * @param {import('../Scene.js').Scene} scene
     * @param {{x:number,y:number,zoom:number}} camera
     * @param {{x:number,y:number}} [parallaxStartPosition] - defaults to camera (no parallax shift)
     */
    renderScene(scene, camera, parallaxStartPosition = camera) {
        this.clear();
        this.drawBackground(scene.settings.backgroundColor);

        const cameraOffset = ParallaxController.getCameraOffset(camera, scene.settings, parallaxStartPosition);
        this.setCamera(camera);

        scene.entities.forEach(entity => {
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

        this.restoreCamera();
    }
}
