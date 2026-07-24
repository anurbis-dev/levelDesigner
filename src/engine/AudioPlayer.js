/**
 * Audio playback for §7 soundEffect / musicTrack / audioZone.
 * Browser-only, guarded like AssetLoader.loadImages: no global `Audio` (Node test env)
 * is a safe no-op, not an error.
 *
 * Channels:
 * - `play()` — fire-and-forget SFX (no tracking, no stop)
 * - `playMusic` / `stopMusic` — single music track, optional linear crossfade
 * - `playAmbient` / `stopAmbient` — single ambient loop for audioZone enter/exit
 */
export class AudioPlayer {
    /** @type {HTMLAudioElement|null} */
    static _music = null;
    /** @type {HTMLAudioElement|null} */
    static _ambient = null;
    /** @type {ReturnType<typeof setInterval>[]} */
    static _fadeTimers = [];

    /**
     * One-shot (or free-looped) SFX — not tracked, cannot be stopped later.
     * @param {string} src
     * @param {{volume?: number, loop?: boolean}} [opts]
     * @returns {HTMLAudioElement|null}
     */
    static play(src, opts = {}) {
        if (typeof Audio === 'undefined' || !src) return null;

        const audio = new Audio(src);
        audio.volume = opts.volume ?? 1;
        audio.loop = opts.loop ?? false;
        // play() rejects on autoplay-policy/network errors — fire-and-forget, don't throw.
        audio.play?.().catch(() => {});
        return audio;
    }

    /**
     * Start (or replace) the music channel. `crossfade` is seconds of linear volume blend;
     * 0 = hard cut. Re-calling with the same src keeps the existing element (updates volume).
     * @param {string} src
     * @param {{volume?: number, loop?: boolean, crossfade?: number}} [opts]
     * @returns {HTMLAudioElement|null}
     */
    static playMusic(src, opts = {}) {
        if (typeof Audio === 'undefined' || !src) return null;

        const volume = opts.volume ?? 1;
        const loop = opts.loop ?? true;
        const crossfade = Math.max(0, opts.crossfade ?? 0);

        if (this._music && this._musicSrc === src) {
            this._music.volume = volume;
            this._music.loop = loop;
            return this._music;
        }

        const next = new Audio(src);
        next.loop = loop;
        next.play?.().catch(() => {});

        const prev = this._music;
        this._clearFades();

        if (prev && crossfade > 0) {
            next.volume = 0;
            this._music = next;
            this._musicSrc = src;
            this._crossfade(prev, next, volume, crossfade, () => {
                this._stopEl(prev);
            });
        } else {
            this._stopEl(prev);
            next.volume = volume;
            this._music = next;
            this._musicSrc = src;
        }
        return next;
    }

    /**
     * @param {{crossfade?: number}} [opts]
     */
    static stopMusic(opts = {}) {
        const crossfade = Math.max(0, opts.crossfade ?? 0);
        const el = this._music;
        if (!el) return;
        this._clearFades();
        if (crossfade > 0) {
            this._fadeOut(el, crossfade, () => {
                if (this._music === el) {
                    this._stopEl(el);
                    this._music = null;
                    this._musicSrc = null;
                }
            });
        } else {
            this._stopEl(el);
            this._music = null;
            this._musicSrc = null;
        }
    }

    /**
     * Ambient zone channel (audioZone). Replaces any previous ambient.
     * @param {string} src
     * @param {{volume?: number, loop?: boolean}} [opts]
     * @returns {HTMLAudioElement|null}
     */
    static playAmbient(src, opts = {}) {
        if (typeof Audio === 'undefined' || !src) return null;

        const volume = opts.volume ?? 1;
        const loop = opts.loop ?? true;

        if (this._ambient && this._ambientSrc === src) {
            this._ambient.volume = volume;
            this._ambient.loop = loop;
            return this._ambient;
        }

        this._stopEl(this._ambient);
        const audio = new Audio(src);
        audio.volume = volume;
        audio.loop = loop;
        audio.play?.().catch(() => {});
        this._ambient = audio;
        this._ambientSrc = src;
        return audio;
    }

    static stopAmbient() {
        this._stopEl(this._ambient);
        this._ambient = null;
        this._ambientSrc = null;
    }

    /** Test/teardown helper — hard-stops both channels and clears fade timers. */
    static _reset() {
        this._clearFades();
        this._stopEl(this._music);
        this._stopEl(this._ambient);
        this._music = null;
        this._musicSrc = null;
        this._ambient = null;
        this._ambientSrc = null;
    }

    /** @private */
    static _stopEl(el) {
        if (!el) return;
        try {
            el.pause?.();
            el.currentTime = 0;
        } catch {
            // ignore
        }
    }

    /** @private */
    static _clearFades() {
        for (const id of this._fadeTimers) clearInterval(id);
        this._fadeTimers = [];
    }

    /**
     * Linear volume blend over `seconds`. Steps via setInterval so tests can use fake timers.
     * @private
     */
    static _crossfade(fromEl, toEl, targetVol, seconds, onDone) {
        const steps = Math.max(1, Math.round(seconds * 20)); // ~50ms
        const intervalMs = (seconds * 1000) / steps;
        const fromStart = fromEl.volume;
        let i = 0;
        const id = setInterval(() => {
            i += 1;
            const t = i / steps;
            try {
                fromEl.volume = Math.max(0, fromStart * (1 - t));
                toEl.volume = Math.min(1, targetVol * t);
            } catch {
                // ignore
            }
            if (i >= steps) {
                clearInterval(id);
                this._fadeTimers = this._fadeTimers.filter(x => x !== id);
                try { toEl.volume = targetVol; } catch { /* ignore */ }
                onDone?.();
            }
        }, intervalMs);
        this._fadeTimers.push(id);
    }

    /** @private */
    static _fadeOut(el, seconds, onDone) {
        const steps = Math.max(1, Math.round(seconds * 20));
        const intervalMs = (seconds * 1000) / steps;
        const start = el.volume;
        let i = 0;
        const id = setInterval(() => {
            i += 1;
            try { el.volume = Math.max(0, start * (1 - i / steps)); } catch { /* ignore */ }
            if (i >= steps) {
                clearInterval(id);
                this._fadeTimers = this._fadeTimers.filter(x => x !== id);
                onDone?.();
            }
        }, intervalMs);
        this._fadeTimers.push(id);
    }
}
