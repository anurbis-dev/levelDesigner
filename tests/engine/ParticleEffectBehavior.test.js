import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { ParticleEffectBehavior } from '../../src/engine/behaviors/ParticleEffectBehavior.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

function makeEmitter(props = {}) {
    const entity = new Entity({
        id: 'fx', type: 'particleEffect', x: 100, y: 50, width: 16, height: 16, color: '#f00'
    });
    const behavior = new ParticleEffectBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

describe('ParticleEffectBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeEmitter();
        expect(behavior.isOverlapping()).toBe(false);
    });

    it('burst spawns on first update', () => {
        const { behavior } = makeEmitter({
            burst: 5, emitting: false, seed: 1, maxParticles: 32
        });
        behavior.update(0.016, null);
        expect(behavior._particles).toHaveLength(5);
        behavior.update(0.016, null);
        expect(behavior._particles).toHaveLength(5);
    });

    it('emitRate accumulates continuous particles', () => {
        const { behavior } = makeEmitter({
            emitRate: 10, lifetime: 10, seed: 42, burst: 0, speedVariance: 0
        });
        behavior.update(0.5, null); // 5 particles
        expect(behavior._particles.length).toBe(5);
    });

    it('maxParticles caps pool', () => {
        const { behavior } = makeEmitter({
            burst: 100, maxParticles: 3, emitting: false, seed: 7
        });
        behavior.update(0, null);
        expect(behavior._particles).toHaveLength(3);
    });

    it('particles die after lifetime', () => {
        const { behavior } = makeEmitter({
            burst: 2, emitting: false, lifetime: 0.2, seed: 3, gravityY: 0
        });
        behavior.update(0, null);
        expect(behavior._particles).toHaveLength(2);
        behavior.update(0.25, null);
        expect(behavior._particles).toHaveLength(0);
    });

    it('gravity accelerates velocity', () => {
        const { behavior } = makeEmitter({
            burst: 1, emitting: false, lifetime: 10, seed: 9,
            speed: 0, speedVariance: 0, gravityY: 100, gravityX: 0, spread: 0
        });
        behavior.update(0, null);
        const p0 = behavior._particles[0];
        const y0 = p0.y;
        const vy0 = p0.vy;
        behavior.update(0.1, null);
        expect(behavior._particles[0].vy).toBeCloseTo(vy0 + 10, 5);
        expect(behavior._particles[0].y).toBeGreaterThan(y0);
    });

    it('drawParticles uses fillRect without image and restores globalAlpha', () => {
        const { behavior } = makeEmitter({
            burst: 1, emitting: false, seed: 1, lifetime: 10,
            speed: 0, speedVariance: 0, startSize: 8, endSize: 8,
            startAlpha: 0.5, endAlpha: 0.5, startColor: '#ff0000'
        });
        behavior.update(0, null);
        const ctx = {
            globalAlpha: 1,
            fillStyle: null,
            fillRect: vi.fn(),
            drawImage: vi.fn()
        };
        expect(behavior.drawParticles(ctx, new Map(), 0, 0)).toBe(true);
        expect(ctx.fillRect).toHaveBeenCalledTimes(1);
        expect(ctx.globalAlpha).toBe(1);
        expect(ctx.fillStyle).toMatch(/rgb\(/);
    });

    it('drawParticles uses drawImage when cache has sprite', () => {
        const { behavior } = makeEmitter({
            src: 'p.png', burst: 1, emitting: false, seed: 2, lifetime: 10,
            speed: 0, speedVariance: 0, startSize: 4, endSize: 4, startAlpha: 1, endAlpha: 1
        });
        behavior.update(0, null);
        const img = { complete: true, naturalHeight: 8 };
        const ctx = { globalAlpha: 1, fillRect: vi.fn(), drawImage: vi.fn() };
        behavior.drawParticles(ctx, new Map([['p.png', img]]), 10, 20);
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('resolves imageAssetId via collectImageSources', () => {
        const { behavior } = makeEmitter({ imageAssetId: 'img1' });
        const sources = new Set();
        const assetsById = new Map([
            ['img1', { id: 'img1', type: 'image', imgSrc: 'spark.png' }]
        ]);
        behavior.collectImageSources(sources, { assetsById });
        expect(behavior._resolvedSrc).toBe('spark.png');
        expect(sources.has('spark.png')).toBe(true);
    });

    it('seed makes emitBurst deterministic', () => {
        const a = makeEmitter({ burst: 4, emitting: false, seed: 99, speedVariance: 10 }).behavior;
        const b = makeEmitter({ burst: 4, emitting: false, seed: 99, speedVariance: 10 }).behavior;
        a.update(0, null);
        b.update(0, null);
        expect(a._particles.map(p => [p.vx, p.vy])).toEqual(b._particles.map(p => [p.vx, p.vy]));
    });

    it('registerDefaultBehaviors registers particleEffect', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('particleEffect')).toBe(ParticleEffectBehavior);
    });
});
