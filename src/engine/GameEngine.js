import { ProjectLoader } from './ProjectLoader.js';
import { Renderer } from './render/Renderer.js';

/**
 * Top-level engine orchestrator. Фаза 1 MVP: load a runtime-Project manifest, render
 * one level. No update/behavior step yet (Фаза 2), no Addon/Event application (Фаза 3/4).
 */
export class GameEngine {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.scene = null;
        this.camera = null;
        this.parallaxStartPosition = null;
        this._rafId = null;
    }

    /**
     * @param {object} manifest - runtime-Project shape (see src/models/ProjectExporter.js)
     * @param {object} [opts] - forwarded to ProjectLoader.load (addons/events, unused in MVP)
     */
    async loadProject(manifest, opts = {}) {
        const registries = ProjectLoader.load(manifest, opts);
        const levelId = opts.levelId ?? registries.entryLevelId;
        this.scene = ProjectLoader.loadLevel(levelId, registries);
        this.camera = { ...this.scene.camera };
        this.parallaxStartPosition = { ...this.camera };
    }

    /** Render exactly one frame. No timing/update step in MVP. */
    tick() {
        if (!this.scene) return;
        this.renderer.renderScene(this.scene, this.camera, this.parallaxStartPosition);
    }

    start() {
        if (this._rafId !== null || typeof requestAnimationFrame === 'undefined') return;
        const loop = () => {
            this.tick();
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() {
        if (this._rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
            cancelAnimationFrame(this._rafId);
        }
        this._rafId = null;
    }
}
