import { BaseModule } from './BaseModule.js';
import { Logger } from '../utils/Logger.js';
import { ProjectExporter } from '../models/ProjectExporter.js';
import { GameEngine } from '../engine/GameEngine.js';
import { DialoguePlayHud } from '../engine/DialoguePlayHud.js';

/**
 * Play-in-editor (engine plan §3, tmp/2D_Editor_ENGINE_PLAN.md). Serializes the current
 * level through the same ProjectExporter used for release builds (Фаза 4), boots a
 * self-contained src/engine/GameEngine in a fullscreen overlay canvas, and tears it down
 * on Stop. GameEngine.loadProject() spawns the controllable player and owns its own
 * keyboard Input instance (src/engine/Input.js) — nothing input-related lives here.
 * DialoguePlayHud mounts on the overlay for choices / item pick.
 * @extends BaseModule
 */
export class PlayOperations extends BaseModule {
    constructor(editor) {
        super(editor);
        this._engine = null;
        this._overlay = null;
        this._resizeObserver = null;
        /** @type {DialoguePlayHud|null} */
        this._dialogueHud = null;
        Logger.lifecycle.info('PlayOperations module initialized.');
    }

    isPlaying() {
        return !!this._engine;
    }

    async toggle() {
        return this.isPlaying() ? this.stop() : this.play();
    }

    async play() {
        if (this.isPlaying()) return;
        if (!this.editor.level) return;

        if (this.editor.getPlayerStartCount() === 0) {
            Logger.status.warn('Play: level needs a Player Start object');
            return;
        }

        const manifest = ProjectExporter.export(
            this.editor.levelSessions,
            this.editor.levelOrder,
            this.editor.project,
            { includeLevelIds: [this.editor.currentLevelId], entryLevelId: this.editor.currentLevelId }
        );

        const canvas = this._createOverlay();
        this._engine = new GameEngine(canvas);

        try {
            await this._engine.loadProject(manifest);
        } catch (error) {
            Logger.status.error(`Play: failed to load level (${error.message})`);
            this._engine = null;
            this._destroyOverlay();
            return;
        }

        this._engine.start();
        this._dialogueHud = new DialoguePlayHud(this._overlay, () => this._engine?.scene);
        this._dialogueHud.start();
        this.editor.stateManager.set('playMode', true);
        Logger.status.success('Play started — Esc to stop');
    }

    stop() {
        if (!this.isPlaying()) return;

        if (this._dialogueHud) {
            this._dialogueHud.stop();
            this._dialogueHud = null;
        }
        this._engine.stop();
        this._engine = null;
        this._destroyOverlay();

        this.editor.stateManager.set('playMode', false);
        Logger.status.info('Play stopped');
    }

    /** @private @returns {HTMLCanvasElement} */
    _createOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'play-overlay';
        overlay.className = 'play-overlay';

        const canvas = document.createElement('canvas');
        overlay.appendChild(canvas);
        document.body.appendChild(overlay);
        this._overlay = overlay;

        // ResizeObserver on the overlay itself (not a window 'resize' listener) — the
        // shared window resize slot is already merged across components by
        // GlobalEventRegistry (src/event-system/GlobalEventRegistry.js), which merges by
        // event-type key: a second 'resize' handler registered there would silently
        // replace the editor's own canvasRenderer.resizeCanvas() handler and not restore
        // it on unregister (merge is a plain object spread, last writer wins per key).
        const resize = () => {
            canvas.width = overlay.clientWidth;
            canvas.height = overlay.clientHeight;
        };
        resize();
        this._resizeObserver = new ResizeObserver(resize);
        this._resizeObserver.observe(overlay);

        return canvas;
    }

    /** @private */
    _destroyOverlay() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }

    destroy() {
        this.stop();
        Logger.lifecycle.info('PlayOperations module destroyed.');
    }
}
