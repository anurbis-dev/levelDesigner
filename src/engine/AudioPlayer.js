/**
 * Fire-and-forget SFX playback for the `soundEffect` asset type (§7 backlog, Tier 1 —
 * docs/RUNTIME_SCHEMA.md). Browser-only, guarded like AssetLoader.loadImages: no global
 * `Audio` (Node test env) is a safe no-op, not an error. One-shot only — no instance tracking,
 * no stop/crossfade; `musicTrack` (loop/crossfade) is a separate, later backlog tier.
 */
export class AudioPlayer {
    /**
     * @param {string} src
     * @param {{volume?: number, loop?: boolean}} [opts]
     * @returns {HTMLAudioElement|null} the playing element, or null if Audio is unavailable/src is empty
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
}
