import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { LightBehavior } from '../../src/engine/behaviors/LightBehavior.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

function makeLight(props = {}) {
    const entity = new Entity({
        id: 'lamp', type: 'light', x: 100, y: 50, width: 16, height: 16, color: '#ff0'
    });
    const behavior = new LightBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

function mockCtx() {
    const grad = { addColorStop: vi.fn() };
    return {
        fillStyle: null,
        globalCompositeOperation: 'source-over',
        createRadialGradient: vi.fn(() => grad),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        moveTo: vi.fn(),
        closePath: vi.fn(),
        clip: vi.fn(),
        _grad: grad
    };
}

describe('LightBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeLight();
        expect(behavior.isOverlapping()).toBe(false);
    });

    it('defaults to point light with sane props', () => {
        const { behavior } = makeLight();
        expect(behavior.lightType).toBe('point');
        expect(behavior.radius).toBe(128);
        expect(behavior.enabled).toBe(true);
        expect(behavior.intensity).toBe(1);
        expect(behavior.ambient).toBeCloseTo(0.45);
    });

    it('drawLight no-ops when disabled or zero intensity', () => {
        const ctx = mockCtx();
        const { behavior: off } = makeLight({ enabled: false });
        off.drawLight(ctx, 0, 0);
        expect(ctx.createRadialGradient).not.toHaveBeenCalled();

        const { behavior: zero } = makeLight({ intensity: 0 });
        zero.drawLight(ctx, 0, 0);
        expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    });

    it('point draws radial gradient arc at entity center', () => {
        const { behavior, entity } = makeLight({
            lightType: 'point', radius: 64, soft: 0.5, intensity: 0.8, color: '#ff0000'
        });
        const ctx = mockCtx();
        behavior.drawLight(ctx, entity.x, entity.y);
        const cx = entity.x + entity.width / 2;
        const cy = entity.y + entity.height / 2;
        expect(ctx.createRadialGradient).toHaveBeenCalledWith(cx, cy, 32, cx, cy, 64);
        expect(ctx.arc).toHaveBeenCalledWith(cx, cy, 64, 0, Math.PI * 2);
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx._grad.addColorStop).toHaveBeenCalled();
    });

    it('directional clips cone then radial fill', () => {
        const { behavior, entity } = makeLight({
            lightType: 'directional', radius: 80, spread: 45, angle: 0
        });
        const ctx = mockCtx();
        behavior.drawLight(ctx, entity.x, entity.y);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.clip).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
        expect(ctx.createRadialGradient).toHaveBeenCalled();
    });

    it('area fills soft halo around entity bounds', () => {
        const { behavior, entity } = makeLight({
            lightType: 'area', radius: 20, soft: 0.5, intensity: 1
        });
        const ctx = mockCtx();
        behavior.drawLight(ctx, entity.x, entity.y);
        expect(ctx.createRadialGradient).toHaveBeenCalled();
        expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('clamps soft and ambient to 0–1', () => {
        const { behavior } = makeLight({ soft: 2, ambient: -1 });
        expect(behavior.soft).toBe(1);
        expect(behavior.ambient).toBe(0);
    });

    it('registerDefaultBehaviors registers light', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('light')).toBe(LightBehavior);
    });
});
