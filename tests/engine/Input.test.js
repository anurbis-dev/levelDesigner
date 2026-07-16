import { describe, it, expect } from 'vitest';
import { Input } from '../../src/engine/Input.js';

/** Minimal fake EventTarget so tests don't need jsdom (this project runs vitest in node env). */
function fakeTarget() {
    const listeners = {};
    return {
        addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
        removeEventListener(type, fn) {
            listeners[type] = (listeners[type] || []).filter(l => l !== fn);
        },
        dispatch(type, event) {
            (listeners[type] || []).forEach(fn => fn(event));
        },
        _listeners: listeners
    };
}

describe('Input', () => {
    it('tracks key down/up state case-insensitively', () => {
        const target = fakeTarget();
        const input = new Input(target);

        target.dispatch('keydown', { key: 'A' });
        expect(input.isDown('a')).toBe(true);

        target.dispatch('keyup', { key: 'a' });
        expect(input.isDown('a')).toBe(false);
    });

    it('maps arrow keys and WASD to a normalized axis', () => {
        const target = fakeTarget();
        const input = new Input(target);

        target.dispatch('keydown', { key: 'ArrowRight' });
        expect(input.getAxis()).toEqual({ x: 1, y: 0 });

        target.dispatch('keyup', { key: 'ArrowRight' });
        target.dispatch('keydown', { key: 'w' });
        expect(input.getAxis()).toEqual({ x: 0, y: -1 });
    });

    it('opposing keys cancel out on the same axis', () => {
        const target = fakeTarget();
        const input = new Input(target);
        target.dispatch('keydown', { key: 'a' });
        target.dispatch('keydown', { key: 'ArrowLeft' });
        target.dispatch('keydown', { key: 'd' });
        expect(input.getAxis()).toEqual({ x: 0, y: 0 });
    });

    it('destroy() removes listeners and clears held keys', () => {
        const target = fakeTarget();
        const input = new Input(target);
        target.dispatch('keydown', { key: 'a' });
        input.destroy();

        expect(input.isDown('a')).toBe(false);
        target.dispatch('keydown', { key: 'd' });
        expect(input.isDown('d')).toBe(false);
    });

    it('is inert with no event target (no crash in non-browser environments)', () => {
        const input = new Input(null);
        expect(input.getAxis()).toEqual({ x: 0, y: 0 });
        expect(() => input.destroy()).not.toThrow();
    });
});
