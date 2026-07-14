import { describe, it, expect, vi } from 'vitest';
import { StateManager } from '../src/managers/StateManager.js';

describe('StateManager (characterization)', () => {
    it('get/set plain key', () => {
        const sm = new StateManager();
        expect(sm.get('isDirty')).toBe(false);
        sm.set('isDirty', true);
        expect(sm.get('isDirty')).toBe(true);
    });

    it('get/set dotted nested key', () => {
        const sm = new StateManager();
        expect(sm.get('camera.zoom')).toBe(1);
        sm.set('camera.zoom', 2.5);
        expect(sm.get('camera.zoom')).toBe(2.5);
        expect(sm.get('camera')).toEqual({ x: 0, y: 0, zoom: 2.5 });
    });

    it('get on missing nested path returns undefined instead of throwing', () => {
        const sm = new StateManager();
        expect(sm.get('nope.deeper.deepest')).toBeUndefined();
    });

    it('set on a dotted key creates intermediate objects that do not exist yet', () => {
        const sm = new StateManager();
        sm.set('brandNew.child', 42);
        expect(sm.get('brandNew.child')).toBe(42);
    });

    it('update() sets multiple keys and reports correct per-key oldValue to listeners', () => {
        const sm = new StateManager();
        const calls = [];
        sm.subscribe('camera.x', (newV, oldV) => calls.push(['camera.x', newV, oldV]));
        sm.subscribe('isDirty', (newV, oldV) => calls.push(['isDirty', newV, oldV]));

        sm.update({ 'camera.x': 10, isDirty: true });

        expect(sm.get('camera.x')).toBe(10);
        expect(sm.get('isDirty')).toBe(true);
        expect(calls).toContainEqual(['camera.x', 10, 0]);
        expect(calls).toContainEqual(['isDirty', true, false]);
    });

    it('subscribe/unsubscribe', () => {
        const sm = new StateManager();
        const cb = vi.fn();
        const unsubscribe = sm.subscribe('isDirty', cb);
        sm.set('isDirty', true);
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(true, false);

        unsubscribe();
        sm.set('isDirty', false);
        expect(cb).toHaveBeenCalledTimes(1);
    });

    it('a throwing listener does not stop other listeners or the caller from proceeding', () => {
        const sm = new StateManager();
        const cbOk = vi.fn();
        sm.subscribe('isDirty', () => { throw new Error('boom'); });
        sm.subscribe('isDirty', cbOk);

        expect(() => sm.set('isDirty', true)).not.toThrow();
        expect(cbOk).toHaveBeenCalledTimes(1);
    });

    it('selection helpers: selectObject/deselectObject/toggleSelection/setSelection/clearSelection', () => {
        const sm = new StateManager();
        sm.selectObject('a');
        sm.selectObject('b');
        expect(sm.get('selectedObjects')).toEqual(new Set(['a', 'b']));

        sm.deselectObject('a');
        expect(sm.get('selectedObjects')).toEqual(new Set(['b']));

        sm.toggleSelection('b'); // present -> removed
        sm.toggleSelection('c'); // absent -> added
        expect(sm.get('selectedObjects')).toEqual(new Set(['c']));

        sm.setSelection(['x', 'y']);
        expect(sm.get('selectedObjects')).toEqual(new Set(['x', 'y']));

        sm.clearSelection();
        expect(sm.get('selectedObjects')).toEqual(new Set());
    });

    it('markDirty/markClean', () => {
        const sm = new StateManager();
        sm.markDirty();
        expect(sm.get('isDirty')).toBe(true);
        sm.markClean();
        expect(sm.get('isDirty')).toBe(false);
    });

    it('consumeNeedsRender flips true->false and is re-armed by any set()/update()', () => {
        const sm = new StateManager();
        expect(sm.consumeNeedsRender()).toBe(true); // dirty from construction
        expect(sm.consumeNeedsRender()).toBe(false); // already consumed

        sm.set('isDirty', true);
        expect(sm.consumeNeedsRender()).toBe(true);
        expect(sm.consumeNeedsRender()).toBe(false);
    });

    it('reset() restores initial state and notifies existing listeners with resolved (dotted) values', () => {
        const sm = new StateManager();
        sm.set('camera.zoom', 5);
        sm.set('isDirty', true);

        const calls = [];
        sm.subscribe('camera.zoom', (newV) => calls.push(newV));

        sm.reset();

        expect(sm.get('camera.zoom')).toBe(1);
        expect(sm.get('isDirty')).toBe(false);
        expect(calls).toContain(1); // listener received the resolved nested value, not undefined
    });

    it('updateComponentStatus / areComponentsReady', () => {
        const sm = new StateManager();
        expect(sm.areComponentsReady(['toolbar'])).toBe(false);
        sm.updateComponentStatus('toolbar', true);
        expect(sm.areComponentsReady(['toolbar'])).toBe(true);
        // Unknown component key is silently ignored (hasOwnProperty guard)
        sm.updateComponentStatus('doesNotExist', true);
        expect(sm.get('validation').componentsReady.doesNotExist).toBeUndefined();
    });

    it('validation cache set/get/expire', () => {
        const sm = new StateManager();
        sm.setValidationCache('k', 'v', 1000);
        // getValidationCache returns the raw {value, timestamp, ttl} cache entry, not the
        // unwrapped value — callers are expected to read `.value` themselves.
        expect(sm.getValidationCache('k')).toMatchObject({ value: 'v', ttl: 1000 });

        // Force expiry by writing an already-expired entry directly, then sweep.
        const validation = sm.get('validation');
        validation.cache.set('expired', { value: 'old', timestamp: Date.now() - 5000, ttl: 100 });
        sm.clearExpiredValidationCache();
        expect(sm.get('validation').cache.has('expired')).toBe(false);
        expect(sm.getValidationCache('k').value).toBe('v'); // untouched, still fresh
    });
});
