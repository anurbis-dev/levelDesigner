import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { AudioZoneBehavior } from '../../src/engine/behaviors/AudioZoneBehavior.js';
import { AudioPlayer } from '../../src/engine/AudioPlayer.js';

function makeZone(x, y, props = {}) {
    const entity = new Entity({ id: 'zone', type: 'actor', x, y, width: 32, height: 32 });
    entity.behaviors = [new AudioZoneBehavior(entity, { properties: props })];
    return entity;
}

function makePlayer(x, y) {
    return new Entity({ id: '__player', x, y, width: 10, height: 10 });
}

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

describe('AudioZoneBehavior', () => {
    beforeEach(() => {
        mockAudioClass();
    });

    afterEach(() => {
        AudioPlayer._reset();
        delete global.Audio;
    });

    it('is never solid (isOverlapping duck-type marker)', () => {
        const zone = makeZone(0, 0, { src: 'a.ogg' });
        expect(typeof zone.behaviors[0].getBounds).toBe('function');
        expect(zone.behaviors[0].isOverlapping()).toBe(false);
    });

    it('does nothing without src or player', () => {
        const zone = makeZone(0, 0, { src: '' });
        expect(() => zone.behaviors[0].update(0.1, {})).not.toThrow();
        expect(global.Audio).not.toHaveBeenCalled();
    });

    it('does nothing while the player is outside the zone', () => {
        const zone = makeZone(0, 0, { src: 'wind.ogg' });
        zone.behaviors[0].update(0.1, { player: makePlayer(500, 500) });
        expect(global.Audio).not.toHaveBeenCalled();
        expect(AudioPlayer._ambient).toBe(null);
    });

    it('plays ambient on enter (default channel)', () => {
        const zone = makeZone(0, 0, { src: 'wind.ogg', volume: 0.4 });
        const player = makePlayer(5, 5);
        zone.behaviors[0].update(0.1, { player });
        expect(global.Audio).toHaveBeenCalledWith('wind.ogg');
        expect(AudioPlayer._ambient?.volume).toBe(0.4);
        expect(AudioPlayer._ambient?.loop).toBe(true);
    });

    it('does not re-fire while still overlapping', () => {
        const zone = makeZone(0, 0, { src: 'wind.ogg' });
        const player = makePlayer(5, 5);
        const scene = { player };
        zone.behaviors[0].update(0.1, scene);
        expect(global.Audio).toHaveBeenCalledTimes(1);
        zone.behaviors[0].update(0.1, scene);
        expect(global.Audio).toHaveBeenCalledTimes(1);
    });

    it('stops ambient on exit when stopOnExit is true (default)', () => {
        const zone = makeZone(0, 0, { src: 'wind.ogg' });
        const player = makePlayer(5, 5);
        const scene = { player };
        zone.behaviors[0].update(0.1, scene);
        expect(AudioPlayer._ambient).not.toBe(null);

        player.x = 500;
        player.y = 500;
        zone.behaviors[0].update(0.1, scene);
        expect(AudioPlayer._ambient).toBe(null);
    });

    it('keeps ambient playing on exit when stopOnExit is false', () => {
        const zone = makeZone(0, 0, { src: 'wind.ogg', stopOnExit: false });
        const player = makePlayer(5, 5);
        const scene = { player };
        zone.behaviors[0].update(0.1, scene);
        player.x = 500;
        player.y = 500;
        zone.behaviors[0].update(0.1, scene);
        expect(AudioPlayer._ambient).not.toBe(null);
    });

    it('uses the music channel when channel=music', () => {
        const zone = makeZone(0, 0, { src: 'boss.ogg', channel: 'music', volume: 0.7 });
        zone.behaviors[0].update(0.1, { player: makePlayer(5, 5) });
        expect(AudioPlayer._music?.src).toBe('boss.ogg');
        expect(AudioPlayer._music?.volume).toBe(0.7);
        expect(AudioPlayer._ambient).toBe(null);
    });

    it('stops music on exit when channel=music and stopOnExit', () => {
        const zone = makeZone(0, 0, { src: 'boss.ogg', channel: 'music' });
        const player = makePlayer(5, 5);
        const scene = { player };
        zone.behaviors[0].update(0.1, scene);
        player.x = 500;
        player.y = 500;
        zone.behaviors[0].update(0.1, scene);
        expect(AudioPlayer._music).toBe(null);
    });
});
