import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';
import { DialogueRunner } from '../DialogueRunner.js';
import { AudioPlayer } from '../AudioPlayer.js';

/**
 * §7 sequenceCutscene: ordered timeline that drives actors / camera / dialogue / vars.
 *
 * Marker entity (never solid). Optional zone geometry for `playOnEnter` (AABB vs player,
 * edge-detected like variableModifier). Catalog merge via `sequenceAssetId` fills empty
 * `steps`. Event Graph: `PlaySequence` / `StopSequence` call duck-typed `play` / `stop`.
 *
 * Properties:
 * - steps — ordered `[{type, …}]` (see step types below)
 * - autoPlay — start once on first update (default false)
 * - playOnEnter — start on player enter AABB (default false)
 * - lockPlayer — set `scene.cutsceneActive` while playing (default true)
 * - loop — restart when finished (default false)
 * - sequenceAssetId — catalog merge for steps when component steps empty
 * - shape/offset/geometry — zone for playOnEnter (same as trigger)
 * - enabled (default true)
 *
 * Step types:
 * - wait {duration}
 * - move {targetId?, x, y, duration} — lerp entity world pos (empty targetId = self)
 * - teleport {targetId?, x, y}
 * - camera {targetId?, x?, y?, duration?} — follow entity and/or pan to world point
 * - cameraRelease {} — clear cutscene camera override
 * - dialogue {dialogueId} — StartDialogue + hold until ended
 * - setVariable {name, value}
 * - playAnimation {targetId?, clip}
 * - playSound {src, volume?, loop?}
 * - emitEvent {name}
 *
 * Duck-types:
 * - play(scene) / stop(scene) / isPlaying()
 * - applyCutsceneCamera(scene, camera, canvas) — true if camera mutated this tick
 * - never solid (`isOverlapping` false)
 */
export class SequenceCutsceneBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.steps = Array.isArray(this.properties.steps) ? this.properties.steps : [];
        this.autoPlay = this.properties.autoPlay === true;
        this.playOnEnter = this.properties.playOnEnter === true;
        this.lockPlayer = this.properties.lockPlayer !== false;
        this.loop = this.properties.loop === true;
        this.sequenceAssetId = this.properties.sequenceAssetId ?? '';
        this.enabled = this.properties.enabled !== false;

        this._playing = false;
        this._stepIndex = 0;
        this._stepElapsed = 0;
        this._stepStarted = false;
        this._assetMerged = false;
        this._autoPlayed = false;
        this._wasPlayerInside = false;
        this._moveFrom = null;
        this._cameraFrom = null;
        this._cameraOverride = null; // {mode:'follow', targetId} | {mode:'pos', x, y}
        this._holdsLock = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    isPlaying() {
        return this._playing;
    }

    /**
     * Start (or restart) the timeline.
     * @param {import('../Scene.js').Scene} scene
     */
    play(scene) {
        if (!this.enabled) return;
        this.ensureAssetResolved(scene);
        if (!this.steps.length) return;
        this._playing = true;
        this._stepIndex = 0;
        this._stepElapsed = 0;
        this._stepStarted = false;
        this._moveFrom = null;
        this._cameraFrom = null;
        this._cameraOverride = null;
        this._applyLock(scene, true);
    }

    /**
     * Abort timeline; release player lock and camera override if we hold them.
     * @param {import('../Scene.js').Scene} scene
     */
    stop(scene) {
        this._playing = false;
        this._stepIndex = 0;
        this._stepElapsed = 0;
        this._stepStarted = false;
        this._moveFrom = null;
        this._cameraFrom = null;
        this._cameraOverride = null;
        this._applyLock(scene, false);
    }

    /**
     * Called from GameEngine._updateCamera before the level camera marker.
     * @returns {boolean} true if this behavior set camera this tick
     */
    applyCutsceneCamera(scene, camera, canvas) {
        if (!this._playing || !this._cameraOverride) return false;
        const zoom = camera.zoom || 1;
        const viewW = canvas.width / zoom;
        const viewH = canvas.height / zoom;
        const ov = this._cameraOverride;
        if (ov.mode === 'follow') {
            const target = this._resolveEntity(scene, ov.targetId);
            if (!target) return false;
            camera.x = target.x + (target.width || 0) / 2 - viewW / 2;
            camera.y = target.y + (target.height || 0) / 2 - viewH / 2;
            return true;
        }
        if (ov.mode === 'pos') {
            camera.x = ov.x - viewW / 2;
            camera.y = ov.y - viewH / 2;
            return true;
        }
        return false;
    }

    update(dt, scene) {
        this.ensureAssetResolved(scene);
        if (!this.enabled) {
            if (this._playing) this.stop(scene);
            return;
        }

        if (this.autoPlay && !this._autoPlayed) {
            this._autoPlayed = true;
            this.play(scene);
        }

        if (this.playOnEnter && scene?.player) {
            const inside = rectsIntersect(
                this.getBounds(),
                getEntityBounds(scene.player, {})
            );
            if (inside && !this._wasPlayerInside && !this._playing) {
                this.play(scene);
            }
            this._wasPlayerInside = inside;
        } else if (!this.playOnEnter) {
            this._wasPlayerInside = false;
        }

        if (!this._playing || dt < 0) return;
        this._tickSteps(dt, scene);
    }

    /**
     * Merge catalog sequenceCutscene asset once (component non-empty steps win).
     * @param {import('../Scene.js').Scene|null|undefined} scene
     */
    ensureAssetResolved(scene) {
        if (this._assetMerged || !this.sequenceAssetId || !scene?.assetsById) return;
        const asset = scene.assetsById.get(this.sequenceAssetId);
        this._assetMerged = true;
        if (!asset) return;
        const bag = asset.properties && typeof asset.properties === 'object'
            ? asset.properties
            : asset;
        if ((!this.steps || this.steps.length === 0) && Array.isArray(bag.steps)) {
            this.steps = bag.steps;
        }
        if (this.properties.autoPlay == null && bag.autoPlay != null) {
            this.autoPlay = bag.autoPlay === true;
        }
        if (this.properties.loop == null && bag.loop != null) {
            this.loop = bag.loop === true;
        }
        if (this.properties.lockPlayer == null && bag.lockPlayer != null) {
            this.lockPlayer = bag.lockPlayer !== false;
        }
    }

    _tickSteps(dt, scene) {
        // Cap work per frame so a chain of zero-duration steps still advances.
        let guard = 64;
        while (this._playing && guard-- > 0) {
            if (this._stepIndex >= this.steps.length) {
                if (this.loop && this.steps.length) {
                    this._stepIndex = 0;
                    this._stepElapsed = 0;
                    this._stepStarted = false;
                    this._moveFrom = null;
                    this._cameraFrom = null;
                    continue;
                }
                this.stop(scene);
                return;
            }

            const step = this.steps[this._stepIndex] || {};
            const type = step.type || 'wait';

            if (!this._stepStarted) {
                this._beginStep(step, type, scene);
                this._stepStarted = true;
                this._stepElapsed = 0;
            }

            const done = this._advanceStep(step, type, dt, scene);
            if (!done) return;

            this._stepIndex += 1;
            this._stepElapsed = 0;
            this._stepStarted = false;
            this._moveFrom = null;
            this._cameraFrom = null;

            // Finish (or loop) immediately when the last step completes this tick.
            if (this._stepIndex >= this.steps.length) {
                if (this.loop && this.steps.length) {
                    this._stepIndex = 0;
                    // Fall through: next loop iteration starts the first step again.
                    // Timed step already consumed dt — do not re-advance with remainder.
                    if ((type === 'wait' || type === 'move' || type === 'camera')
                        && Number(step.duration) > 0) {
                        return;
                    }
                    continue;
                }
                this.stop(scene);
                return;
            }

            // zero-duration steps chain in the same tick; timed steps consumed dt
            if ((type === 'wait' || type === 'move' || type === 'camera')
                && Number(step.duration) > 0) {
                return;
            }
        }
    }

    _beginStep(step, type, scene) {
        switch (type) {
            case 'move': {
                const target = this._resolveEntity(scene, step.targetId) || this.entity;
                this._moveFrom = { x: target.x, y: target.y, entity: target };
                break;
            }
            case 'teleport': {
                const target = this._resolveEntity(scene, step.targetId) || this.entity;
                if (step.x != null) target.x = Number(step.x);
                if (step.y != null) target.y = Number(step.y);
                break;
            }
            case 'camera': {
                this._cameraFrom = { x: null, y: null }; // filled lazily with current camera in advance
                if (step.targetId) {
                    this._cameraOverride = { mode: 'follow', targetId: step.targetId };
                } else if (step.x != null || step.y != null) {
                    this._cameraOverride = {
                        mode: 'pos',
                        x: Number(step.x) || 0,
                        y: Number(step.y) || 0
                    };
                }
                break;
            }
            case 'cameraRelease':
                this._cameraOverride = null;
                break;
            case 'dialogue': {
                const dialogueData = scene.dialogues?.get(step.dialogueId);
                if (!dialogueData) {
                    console.warn(
                        `[engine] sequenceCutscene dialogue: unknown dialogueId '${step.dialogueId}'`
                    );
                    break;
                }
                if (scene.eventGraphRuntime) {
                    scene.dialogueRunner = new DialogueRunner(dialogueData, scene.eventGraphRuntime);
                    scene.dialogueActive = true;
                }
                break;
            }
            case 'setVariable':
                if (step.name != null && scene.eventGraphRuntime) {
                    scene.eventGraphRuntime.setVariable(step.name, step.value);
                }
                break;
            case 'playAnimation': {
                const target = this._resolveEntity(scene, step.targetId) || this.entity;
                const anim = target?.behaviors?.find(b => typeof b.play === 'function');
                if (anim && step.clip) anim.play(step.clip);
                break;
            }
            case 'playSound':
                if (step.src) {
                    AudioPlayer.play(step.src, { volume: step.volume, loop: step.loop });
                }
                break;
            case 'emitEvent':
                if (step.name && scene.eventGraphRuntime) {
                    scene.eventGraphRuntime.emitCustomEvent(step.name);
                }
                break;
            default:
                break;
        }
    }

    /**
     * @returns {boolean} true when step finished
     */
    _advanceStep(step, type, dt, scene) {
        this._stepElapsed += dt;

        switch (type) {
            case 'wait': {
                const duration = Math.max(0, Number(step.duration) || 0);
                return this._stepElapsed >= duration;
            }
            case 'move': {
                const duration = Math.max(0, Number(step.duration) || 0);
                const from = this._moveFrom;
                if (!from?.entity) return true;
                const t = duration <= 0 ? 1 : Math.min(1, this._stepElapsed / duration);
                from.entity.x = from.x + (Number(step.x) - from.x) * t;
                from.entity.y = from.y + (Number(step.y) - from.y) * t;
                return t >= 1;
            }
            case 'camera': {
                const duration = Math.max(0, Number(step.duration) || 0);
                // Instant camera (duration 0) finishes same tick after override is set.
                if (duration <= 0) return true;
                // Follow mode: keep override live for duration.
                if (step.targetId) {
                    this._cameraOverride = { mode: 'follow', targetId: step.targetId };
                    return this._stepElapsed >= duration;
                }
                // Pos pan: store start on first advance frame when camera coords known via override target
                if (step.x != null || step.y != null) {
                    this._cameraOverride = {
                        mode: 'pos',
                        x: Number(step.x) || 0,
                        y: Number(step.y) || 0
                    };
                }
                return this._stepElapsed >= duration;
            }
            case 'dialogue': {
                if (!step.dialogueId) return true;
                if (!scene.eventGraphRuntime) return true;
                // Hold until dialogue closed (runner ended or flag cleared).
                if (scene.dialogueActive && scene.dialogueRunner && !scene.dialogueRunner.isEnded()) {
                    return false;
                }
                return true;
            }
            // Instant steps finished in _beginStep
            case 'teleport':
            case 'cameraRelease':
            case 'setVariable':
            case 'playAnimation':
            case 'playSound':
            case 'emitEvent':
                return true;
            default:
                return true;
        }
    }

    _resolveEntity(scene, id) {
        if (!id || !scene) return null;
        return scene.getAllEntities().find(e => e.id === id) || null;
    }

    _applyLock(scene, on) {
        if (!this.lockPlayer || !scene) {
            this._holdsLock = false;
            return;
        }
        if (on) {
            scene.cutsceneActive = true;
            this._holdsLock = true;
            return;
        }
        if (!this._holdsLock) return;
        this._holdsLock = false;
        // Release only if no other sequence still holds the lock.
        let otherHolds = false;
        for (const e of scene.getAllEntities()) {
            for (const b of e.behaviors || []) {
                if (b === this) continue;
                if (b._holdsLock && b.isPlaying?.()) {
                    otherHolds = true;
                    break;
                }
            }
            if (otherHolds) break;
        }
        if (!otherHolds) scene.cutsceneActive = false;
    }
}
