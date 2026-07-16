import { describe, it, expect } from 'vitest';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';

class FakeBehaviorA {}
class FakeBehaviorB {}

describe('BehaviorRegistry', () => {
    it('returns null for an unregistered type', () => {
        expect(BehaviorRegistry.get('__unregistered__')).toBeNull();
        expect(BehaviorRegistry.has('__unregistered__')).toBe(false);
    });

    it('registers and resolves a type', () => {
        BehaviorRegistry.register('__fakeA__', FakeBehaviorA);
        expect(BehaviorRegistry.get('__fakeA__')).toBe(FakeBehaviorA);
        expect(BehaviorRegistry.has('__fakeA__')).toBe(true);
    });

    it('re-registering the same type overwrites the previous class', () => {
        BehaviorRegistry.register('__fakeB__', FakeBehaviorA);
        BehaviorRegistry.register('__fakeB__', FakeBehaviorB);
        expect(BehaviorRegistry.get('__fakeB__')).toBe(FakeBehaviorB);
    });
});
