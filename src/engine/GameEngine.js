import { ProjectLoader } from './ProjectLoader.js';
import { Renderer } from './render/Renderer.js';
import { Input } from './Input.js';
import { registerDefaultBehaviors } from './behaviors/registerDefaultBehaviors.js';

/**
 * Top-level engine orchestrator. Loads a runtime-Project manifest, updates behaviors,
 * renders one level. No Addon/Event application yet (Фаза 3/4).
 */
export class GameEngine {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.input = new Input();
        this.scene = null;
        this.camera = null;
        this.parallaxStartPosition = null;
        this._rafId = null;
        this._lastFrameTime = null;
        registerDefaultBehaviors();
    }

    /**
     * @param {object} manifest - runtime-Project shape (see src/models/ProjectExporter.js)
     * @param {object} [opts] - forwarded to ProjectLoader.load (addons/events, unused in MVP)
     */
    async loadProject(manifest, opts = {}) {
        const registries = ProjectLoader.load(manifest, opts);
        const levelId = opts.levelId ?? registries.entryLevelId;
        this.scene = ProjectLoader.loadLevel(levelId, registries);
        this.scene.input = this.input;
        this.scene.spawnPlayer();
        this.camera = { ...this.scene.camera };
        this.parallaxStartPosition = { ...this.camera };
    }

    /** Runs one update+render frame. */
    tick(dt = 0) {
        if (!this.scene) return;
        this._update(dt);
        this._updateCamera();
        this.renderer.renderScene(this.scene, this.camera, this.parallaxStartPosition);
    }

    _update(dt) {
        for (const entity of this.scene.getAllEntities()) {
            for (const behavior of entity.behaviors) {
                behavior.update(dt, this.scene);
            }
        }
    }

    /** Centers the camera on scene.player, if any (static camera otherwise). */
    _updateCamera() {
        const player = this.scene.player;
        if (!player) return;
        const zoom = this.camera.zoom || 1;
        const canvas = this.renderer.canvas;
        this.camera.x = player.x + player.width / 2 - (canvas.width / zoom) / 2;
        this.camera.y = player.y + player.height / 2 - (canvas.height / zoom) / 2;
    }

    start() {
        if (this._rafId !== null || typeof requestAnimationFrame === 'undefined') return;
        this._lastFrameTime = null;
        const loop = (now) => {
            if (this._lastFrameTime === null) this._lastFrameTime = now;
            const dt = (now - this._lastFrameTime) / 1000;
            this._lastFrameTime = now;
            this.tick(dt);
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() {
        if (this._rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = null;
        this.input.destroy();
    }
}
