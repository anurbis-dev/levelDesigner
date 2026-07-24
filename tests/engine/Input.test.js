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

describe('Input.isActionDown / setInputMap (§7 backlog inputMap, Tier 3)', () => {
    it('isActionDown falls back to DEFAULT_ACTIONS without a custom map', () => {
        const target = fakeTarget();
        const input = new Input(target);
        target.dispatch('keydown', { key: 'e' });

        expect(input.isActionDown('interact')).toBe(true);
    });

    it('isActionDown treats an unmapped action name as a literal key (legacy isDown behavior)', () => {
        const target = fakeTarget();
        const input = new Input(target);
        target.dispatch('keydown', { key: 'q' });

        expect(input.isActionDown('q')).toBe(true);
    });

    it('setInputMap remaps a named action onto a custom key', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.setInputMap({ actions: { interact: ['f'] } });

        target.dispatch('keydown', { key: 'e' });
        expect(input.isActionDown('interact')).toBe(false);

        target.dispatch('keydown', { key: 'f' });
        expect(input.isActionDown('interact')).toBe(true);
    });

    it('actions not present in a partial custom map still fall back to DEFAULT_ACTIONS', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.setInputMap({ actions: { interact: ['f'] } }); // no moveRight override

        target.dispatch('keydown', { key: 'd' });
        expect(input.getAxis()).toEqual({ x: 1, y: 0 }); // still works via DEFAULT_ACTIONS.moveRight
    });

    it('remapping moveRight/moveLeft/moveUp/moveDown changes getAxis()', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.setInputMap({ actions: { moveRight: ['j'], moveLeft: ['h'], moveUp: ['k'], moveDown: ['l'] } });

        target.dispatch('keydown', { key: 'd' }); // old default key, should no longer register
        expect(input.getAxis()).toEqual({ x: 0, y: 0 });

        target.dispatch('keydown', { key: 'j' });
        expect(input.getAxis()).toEqual({ x: 1, y: 0 });
    });

    it('setInputMap(null) clears a previously set map back to defaults', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.setInputMap({ actions: { interact: ['f'] } });
        input.setInputMap(null);

        target.dispatch('keydown', { key: 'e' });
        expect(input.isActionDown('interact')).toBe(true);
    });

    it('ignores a malformed actions map entry (non-array value)', () => {
        const target = fakeTarget();
        const input = new Input(target);
        input.setInputMap({ actions: { interact: 'e' } });

        target.dispatch('keydown', { key: 'e' });
        expect(input.isActionDown('interact')).toBe(true); // falls back to DEFAULT_ACTIONS
    });
});
