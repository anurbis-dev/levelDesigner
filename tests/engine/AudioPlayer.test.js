import { describe, it, expect, vi, afterEach } from 'vitest';
import { AudioPlayer } from '../../src/engine/AudioPlayer.js';

describe('AudioPlayer.play', () => {
    afterEach(() => {
        delete global.Audio;
    });

    it('returns null without touching anything when Audio is unavailable (Node test env)', () => {
        expect(AudioPlayer.play('hit.wav')).toBe(null);
    });

    it('returns null for an empty src', () => {
        global.Audio = vi.fn();
        expect(AudioPlayer.play('')).toBe(null);
        expect(global.Audio).not.toHaveBeenCalled();
    });

    it('constructs an Audio element with volume/loop and calls play()', () => {
        const play = vi.fn().mockResolvedValue(undefined);
        global.Audio = vi.fn(function (src) {
            this.src = src;
            this.play = play;
        });

        const audio = AudioPlayer.play('hit.wav', { volume: 0.5, loop: true });

        expect(global.Audio).toHaveBeenCalledWith('hit.wav');
        expect(audio.volume).toBe(0.5);
        expect(audio.loop).toBe(true);
        expect(play).toHaveBeenCalled();
    });

    it('defaults volume=1, loop=false when opts are omitted', () => {
        global.Audio = vi.fn(function (src) {
            this.src = src;
            this.play = vi.fn().mockResolvedValue(undefined);
        });

        const audio = AudioPlayer.play('hit.wav');

        expect(audio.volume).toBe(1);
        expect(audio.loop).toBe(false);
    });

    it("doesn't throw when play() rejects (autoplay policy / network error)", async () => {
        global.Audio = vi.fn(function () {
            this.play = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
        });

        expect(() => AudioPlayer.play('hit.wav')).not.toThrow();
    });
});
