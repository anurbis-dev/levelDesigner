import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { AudioPlayer } from '../../src/engine/AudioPlayer.js';

function mockAudioClass() {
    global.Audio = vi.fn(function (src) {
        this.src = src;
        this.volume = 1;
        this.loop = false;
        this.currentTime = 0;
        this.pause = vi.fn();
        this.play = vi.fn().mockResolvedValue(undefined);
    });
}

describe('AudioPlayer.play', () => {
    afterEach(() => {
        AudioPlayer._reset();
        delete global.Audio;
    });

    it('returns null without touching anything when Audio is unavailable (Node test env)', () => {
        expect(AudioPlayer.play('hit.wav')).toBe(null);
    });

    it('returns null for an empty src', () => {
        mockAudioClass();
        expect(AudioPlayer.play('')).toBe(null);
        expect(global.Audio).not.toHaveBeenCalled();
    });

    it('constructs an Audio element with volume/loop and calls play()', () => {
        mockAudioClass();
        const audio = AudioPlayer.play('hit.wav', { volume: 0.5, loop: true });

        expect(global.Audio).toHaveBeenCalledWith('hit.wav');
        expect(audio.volume).toBe(0.5);
        expect(audio.loop).toBe(true);
        expect(audio.play).toHaveBeenCalled();
    });

    it('defaults volume=1, loop=false when opts are omitted', () => {
        mockAudioClass();
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

describe('AudioPlayer.playMusic / stopMusic', () => {
    beforeEach(() => {
        mockAudioClass();
        vi.useFakeTimers();
    });

    afterEach(() => {
        AudioPlayer._reset();
        vi.useRealTimers();
        delete global.Audio;
    });

    it('returns null when Audio unavailable or src empty', () => {
        delete global.Audio;
        expect(AudioPlayer.playMusic('theme.ogg')).toBe(null);
        mockAudioClass();
        expect(AudioPlayer.playMusic('')).toBe(null);
    });

    it('starts music with loop=true by default and tracks the channel', () => {
        const audio = AudioPlayer.playMusic('theme.ogg', { volume: 0.4 });
        expect(global.Audio).toHaveBeenCalledWith('theme.ogg');
        expect(audio.loop).toBe(true);
        expect(audio.volume).toBe(0.4);
        expect(audio.play).toHaveBeenCalled();
        expect(AudioPlayer._music).toBe(audio);
    });

    it('reuses the same element when re-playing the same src', () => {
        const a = AudioPlayer.playMusic('theme.ogg', { volume: 0.5 });
        const b = AudioPlayer.playMusic('theme.ogg', { volume: 0.8 });
        expect(a).toBe(b);
        expect(global.Audio).toHaveBeenCalledTimes(1);
        expect(b.volume).toBe(0.8);
    });

    it('hard-cuts to a new track when crossfade is 0', () => {
        const a = AudioPlayer.playMusic('a.ogg');
        const b = AudioPlayer.playMusic('b.ogg');
        expect(a.pause).toHaveBeenCalled();
        expect(b).not.toBe(a);
        expect(AudioPlayer._music).toBe(b);
        expect(b.volume).toBe(1);
    });

    it('crossfades volume over the given duration then stops the previous track', () => {
        const a = AudioPlayer.playMusic('a.ogg', { volume: 1 });
        const b = AudioPlayer.playMusic('b.ogg', { volume: 1, crossfade: 1 });
        expect(b.volume).toBe(0);
        expect(AudioPlayer._music).toBe(b);

        vi.advanceTimersByTime(1000);
        expect(a.pause).toHaveBeenCalled();
        expect(b.volume).toBeCloseTo(1, 5);
    });

    it('stopMusic hard-cuts the channel', () => {
        const a = AudioPlayer.playMusic('theme.ogg');
        AudioPlayer.stopMusic();
        expect(a.pause).toHaveBeenCalled();
        expect(AudioPlayer._music).toBe(null);
    });

    it('stopMusic with crossfade fades then clears', () => {
        const a = AudioPlayer.playMusic('theme.ogg', { volume: 1 });
        AudioPlayer.stopMusic({ crossfade: 0.5 });
        expect(AudioPlayer._music).toBe(a); // still held until fade ends
        vi.advanceTimersByTime(500);
        expect(a.pause).toHaveBeenCalled();
        expect(AudioPlayer._music).toBe(null);
    });
});

describe('AudioPlayer.playAmbient / stopAmbient', () => {
    beforeEach(() => {
        mockAudioClass();
    });

    afterEach(() => {
        AudioPlayer._reset();
        delete global.Audio;
    });

    it('starts ambient with loop=true by default', () => {
        const a = AudioPlayer.playAmbient('wind.ogg', { volume: 0.3 });
        expect(a.loop).toBe(true);
        expect(a.volume).toBe(0.3);
        expect(AudioPlayer._ambient).toBe(a);
    });

    it('replaces previous ambient on a different src', () => {
        const a = AudioPlayer.playAmbient('wind.ogg');
        const b = AudioPlayer.playAmbient('rain.ogg');
        expect(a.pause).toHaveBeenCalled();
        expect(AudioPlayer._ambient).toBe(b);
    });

    it('stopAmbient pauses and clears the channel', () => {
        const a = AudioPlayer.playAmbient('wind.ogg');
        AudioPlayer.stopAmbient();
        expect(a.pause).toHaveBeenCalled();
        expect(AudioPlayer._ambient).toBe(null);
    });
});
