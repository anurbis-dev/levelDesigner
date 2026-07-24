import { Behavior } from './Behavior.js';
import { getEntityBounds, rectsIntersect } from './AABB.js';
import { AudioPlayer } from '../AudioPlayer.js';

/**
 * Volume-specialization zone (§7 audioZone): ambient/music on player enter.
 * Only reacts to `scene.player` (same discipline as variableModifier / pickup /
 * conveyorZiplineJumpPadPortal). Never solid — isOverlapping() always false.
 *
 * Properties (inline src, same convention as PlaySound / PlayMusic):
 * - `src` — audio URL
 * - `volume` (default 1), `loop` (default true)
 * - `channel` — `'ambient'` (default, zone ambient channel) | `'music'` (global music + crossfade)
 * - `stopOnExit` (default true) — stop the channel when the player leaves
 * - `crossfade` (seconds, default 0) — only used when channel is `'music'`
 * - shape/offset/size fields via getEntityBounds (box default)
 */
export class AudioZoneBehavior extends Behavior {
    constructor(entity, componentData) {
        super(entity, componentData);
        this.src = this.properties.src ?? '';
        this.volume = this.properties.volume ?? 1;
        this.loop = this.properties.loop ?? true;
        this.channel = this.properties.channel ?? 'ambient'; // 'ambient' | 'music'
        this.stopOnExit = this.properties.stopOnExit ?? true;
        this.crossfade = this.properties.crossfade ?? 0;
        this._wasOverlapping = false;
    }

    getBounds() {
        return getEntityBounds(this.entity, this.properties);
    }

    isOverlapping() {
        return false;
    }

    update(dt, scene) {
        if (!this.src || !scene.player) return;

        const overlapping = rectsIntersect(this.getBounds(), getEntityBounds(scene.player, {}));
        const entering = overlapping && !this._wasOverlapping;
        const exiting = !overlapping && this._wasOverlapping;
        this._wasOverlapping = overlapping;

        if (entering) this._start();
        else if (exiting && this.stopOnExit) this._stop();
    }

    _start() {
        if (this.channel === 'music') {
            AudioPlayer.playMusic(this.src, {
                volume: this.volume,
                loop: this.loop,
                crossfade: this.crossfade
            });
        } else {
            AudioPlayer.playAmbient(this.src, {
                volume: this.volume,
                loop: this.loop
            });
        }
    }

    _stop() {
        if (this.channel === 'music') {
            AudioPlayer.stopMusic({ crossfade: this.crossfade });
        } else {
            AudioPlayer.stopAmbient();
        }
    }
}
