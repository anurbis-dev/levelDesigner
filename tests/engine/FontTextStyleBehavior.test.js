import { describe, it, expect, vi } from 'vitest';
import { Entity } from '../../src/engine/Entity.js';
import { FontTextStyleBehavior } from '../../src/engine/behaviors/FontTextStyleBehavior.js';
import { BehaviorRegistry } from '../../src/engine/BehaviorRegistry.js';
import { registerDefaultBehaviors } from '../../src/engine/behaviors/registerDefaultBehaviors.js';

function makeText(props = {}, entityOpts = {}) {
    const entity = new Entity({
        id: 'label', type: 'fontTextStyle', x: 10, y: 20, width: 100, height: 40, color: '#abc',
        ...entityOpts
    });
    const behavior = new FontTextStyleBehavior(entity, { properties: props });
    entity.behaviors = [behavior];
    return { entity, behavior };
}

function mockCtx(measureWidths = {}) {
    return {
        save: vi.fn(),
        restore: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        measureText: vi.fn((s) => ({
            width: measureWidths[s] ?? (String(s).length * 8)
        })),
        font: '',
        fillStyle: null,
        strokeStyle: null,
        lineWidth: 0,
        lineJoin: '',
        textAlign: 'left',
        textBaseline: 'top',
        shadowColor: '',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0
    };
}

describe('FontTextStyleBehavior', () => {
    it('never solid', () => {
        const { behavior } = makeText();
        expect(behavior.isOverlapping()).toBe(false);
    });

    it('defaults font and text', () => {
        const { behavior } = makeText();
        expect(behavior.text).toBe('Text');
        expect(behavior.fontFamily).toBe('sans-serif');
        expect(behavior.fontSize).toBe(16);
        expect(behavior.fontWeight).toBe('normal');
        expect(behavior.align).toBe('left');
        expect(behavior.verticalAlign).toBe('top');
        expect(behavior.wrap).toBe(true);
        expect(behavior.lineHeight).toBe(1.2);
        expect(behavior.outlineWidth).toBe(0);
    });

    it('builds CSS font string', () => {
        const { behavior } = makeText({
            fontStyle: 'italic', fontWeight: 'bold', fontSize: 20, fontFamily: 'Georgia'
        });
        expect(behavior._fontString()).toBe('italic bold 20px Georgia');
    });

    it('draws fillText at entity top-left for left/top align', () => {
        const { behavior, entity } = makeText({ text: 'Hi', wrap: false });
        const ctx = mockCtx();
        behavior.drawText(ctx, entity.x, entity.y);
        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.fillText).toHaveBeenCalledWith('Hi', 10, 20);
        expect(ctx.restore).toHaveBeenCalled();
    });

    it('uses entity.color when color property absent', () => {
        const { behavior, entity } = makeText({ text: 'A', wrap: false });
        const ctx = mockCtx();
        behavior.drawText(ctx, entity.x, entity.y);
        expect(ctx.fillStyle).toBe('#abc');
    });

    it('centers horizontally and vertically', () => {
        const { behavior, entity } = makeText({
            text: 'Hi', align: 'center', verticalAlign: 'middle', wrap: false, fontSize: 10, lineHeight: 1
        });
        const ctx = mockCtx();
        behavior.drawText(ctx, entity.x, entity.y);
        // x = absX + w/2 = 10+50 = 60; y = 20 + (40-10)/2 = 35
        expect(ctx.fillText).toHaveBeenCalledWith('Hi', 60, 35);
        expect(ctx.textAlign).toBe('center');
    });

    it('strokes outline when outlineWidth > 0', () => {
        const { behavior, entity } = makeText({
            text: 'O', outlineWidth: 2, outlineColor: '#000', wrap: false
        });
        const ctx = mockCtx();
        behavior.drawText(ctx, entity.x, entity.y);
        expect(ctx.strokeText).toHaveBeenCalledWith('O', 10, 20);
        expect(ctx.strokeStyle).toBe('#000');
        expect(ctx.lineWidth).toBe(2);
    });

    it('applies canvas shadow when shadowColor set', () => {
        const { behavior, entity } = makeText({
            text: 'S', shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 4,
            shadowOffsetX: 1, shadowOffsetY: 2, wrap: false
        });
        const ctx = mockCtx();
        behavior.drawText(ctx, entity.x, entity.y);
        expect(ctx.shadowColor).toBe('rgba(0,0,0,0.5)');
        expect(ctx.shadowBlur).toBe(4);
        expect(ctx.shadowOffsetX).toBe(1);
        expect(ctx.shadowOffsetY).toBe(2);
    });

    it('wraps words to entity width', () => {
        const { behavior, entity } = makeText({
            text: 'hello world', wrap: true, fontSize: 10, lineHeight: 1
        }, { width: 50 });
        // force wrap: each word ~40px, box 50px → two lines
        const ctx = mockCtx({
            'hello': 40, 'hello ': 48, 'hello world': 80, 'world': 40, ' ': 8
        });
        behavior.drawText(ctx, entity.x, entity.y);
        expect(ctx.fillText).toHaveBeenCalledTimes(2);
        expect(ctx.fillText).toHaveBeenNthCalledWith(1, 'hello', 10, 20);
        expect(ctx.fillText).toHaveBeenNthCalledWith(2, 'world', 10, 30);
    });

    it('merges styleAssetId when component field empty', () => {
        const { behavior } = makeText({
            styleAssetId: 'style_a',
            text: 'Keep',
            // leave fontSize as default path — component has no fontSize key
        });
        // Explicitly set properties without fontFamily so merge fills it
        behavior.properties = { styleAssetId: 'style_a', text: 'Keep' };
        behavior.fontFamily = 'sans-serif';
        behavior.fontSize = 16;
        const scene = {
            assetsById: new Map([
                ['style_a', {
                    id: 'style_a', type: 'fontTextStyle',
                    properties: { fontFamily: 'Courier New', fontSize: 24, color: '#ff0' }
                }]
            ])
        };
        behavior.ensureStyleResolved(scene);
        expect(behavior.text).toBe('Keep'); // component text set
        expect(behavior.fontFamily).toBe('Courier New');
        expect(behavior.fontSize).toBe(24);
        expect(behavior.color).toBe('#ff0');
        // idempotent
        behavior.ensureStyleResolved(scene);
        expect(behavior.fontSize).toBe(24);
    });

    it('component non-empty fields win over style asset', () => {
        const { behavior } = makeText({
            styleAssetId: 'style_a',
            fontFamily: 'Impact',
            fontSize: 12
        });
        const scene = {
            assetsById: new Map([
                ['style_a', {
                    properties: { fontFamily: 'Courier', fontSize: 99, color: '#0f0' }
                }]
            ])
        };
        behavior.ensureStyleResolved(scene);
        expect(behavior.fontFamily).toBe('Impact');
        expect(behavior.fontSize).toBe(12);
        expect(behavior.color).toBe('#0f0'); // filled from asset (comp had null/default)
    });

    it('registerDefaultBehaviors registers fontTextStyle', () => {
        registerDefaultBehaviors();
        expect(BehaviorRegistry.get('fontTextStyle')).toBe(FontTextStyleBehavior);
    });
});
