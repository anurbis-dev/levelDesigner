import { ProjectLoader } from './ProjectLoader.js';
import { Renderer } from './render/Renderer.js';
import { Input } from './Input.js';
import { AssetLoader } from './AssetLoader.js';
import { registerDefaultBehaviors } from './behaviors/registerDefaultBehaviors.js';
import { EventGraphRuntime } from './eventgraph/EventGraphRuntime.js';
import { registerDefaultEventGraphNodes } from './eventgraph/registerDefaultEventGraphNodes.js';

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
        registerDefaultEventGraphNodes();
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
        this.scene.hideCameraMarker();
        this.scene.eventGraphRuntime = this.scene.eventGraph
            ? new EventGraphRuntime(this.scene.eventGraph, this.scene)
            : null;
        this.camera = { ...this.scene.camera };
        this.parallaxStartPosition = { ...this.camera };

        const sources = AssetLoader.collectImageSources(this.scene);
        this.renderer.imageCache = await AssetLoader.loadImages(sources);
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
                if (!behavior.enabled) continue;
                behavior.update(dt, this.scene);
            }
        }
        this.scene.eventGraphRuntime?.tick(dt);
    }

    /**
     * Delegates to the level's `camera` marker (follow target/deadzone/bounds, see
     * CameraBehavior) when present and enabled; otherwise falls back to the legacy
     * hardcoded hard-center-on-player (static camera if there's no player either) —
     * kept for levels authored before the camera asset/component existed.
     */
    _updateCamera() {
        const cameraEntity = this.scene.cameraEntity;
        const behavior = cameraEntity?.behaviors.find(b => typeof b.computeCamera === 'function');
        if (behavior?.enabled) {
            behavior.computeCamera(this.scene, this.camera, this.renderer.canvas);
            return;
        }

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
