import { ProjectLoader } from './ProjectLoader.js';
import { Renderer } from './render/Renderer.js';
import { registerDefaultBehaviors } from './behaviors/registerDefaultBehaviors.js';

/**
 * Top-level engine orchestrator. Loads a runtime-Project manifest, updates behaviors,
 * renders one level. No Addon/Event application yet (Фаза 3/4).
 */
export class GameEngine {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.scene = null;
        this.camera = null;
        this.parallaxStartPosition = null;
        this._rafId = null;
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
        this.camera = { ...this.scene.camera };
        this.parallaxStartPosition = { ...this.camera };
    }

    /** Runs one update+render frame. */
    tick(dt = 0) {
        if (!this.scene) return;
        this._update(dt);
        this.renderer.renderScene(this.scene, this.camera, this.parallaxStartPosition);
    }

    _update(dt) {
        for (const entity of this.scene.getAllEntities()) {
            for (const behavior of entity.behaviors) {
                behavior.update(dt, this.scene);
            }
        }
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
