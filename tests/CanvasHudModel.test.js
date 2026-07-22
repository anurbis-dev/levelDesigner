import { describe, it, expect } from 'vitest';
import {
    createEmptyCanvas,
    nextCanvasId,
    nextWidgetId,
    upsertCanvas,
    removeCanvas,
    upsertWidget,
    removeWidget,
    normalizeCanvas,
    listVariableNameOptions,
    listCustomEventNameOptions
} from '../src/ui/canvas-hud/CanvasHudModel.js';

describe('CanvasHudModel', () => {
    it('creates empty canvas and next id', () => {
        const c = createEmptyCanvas('canvas_1');
        expect(c).toEqual({ id: 'canvas_1', name: 'canvas_1', widgets: [] });
        expect(nextCanvasId([c])).toBe('canvas_2');
    });

    it('upserts and removes canvases', () => {
        let list = [];
        list = upsertCanvas(list, createEmptyCanvas('mainHud'));
        list = upsertCanvas(list, { id: 'mainHud', name: 'Main HUD', widgets: [] });
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('Main HUD');
        list = removeCanvas(list, 'mainHud');
        expect(list).toEqual([]);
    });

    it('normalizes a canvas missing name/widgets', () => {
        const c = normalizeCanvas({ id: 'x' });
        expect(c).toEqual({ id: 'x', name: 'x', widgets: [] });
    });

    it('upserts and removes widgets within a canvas, next widget id', () => {
        let canvas = createEmptyCanvas('hud1');
        expect(nextWidgetId(canvas)).toBe('widget_1');

        canvas = upsertWidget(canvas, { id: 'widget_1', type: 'text', anchor: 'topLeft', text: 'Score: 0' });
        expect(canvas.widgets).toHaveLength(1);
        expect(nextWidgetId(canvas)).toBe('widget_2');

        canvas = upsertWidget(canvas, { id: 'widget_1', type: 'text', anchor: 'topLeft', text: 'Score: 5' });
        expect(canvas.widgets).toHaveLength(1);
        expect(canvas.widgets[0].text).toBe('Score: 5');

        canvas = removeWidget(canvas, 'widget_1');
        expect(canvas.widgets).toEqual([]);
    });

    it('lists variable name suggestions scraped from SetVariable/Compare/Not nodes, deduped+sorted', () => {
        const level = {
            eventGraph: {
                nodes: [
                    { type: 'SetVariable', params: { name: 'score' } },
                    { type: 'Compare', params: { var: 'hasKey' } },
                    { type: 'SetVariable', params: { name: 'score' } },
                    { type: 'OnTimer', params: { seconds: 1 } }
                ]
            }
        };
        expect(listVariableNameOptions(level)).toEqual([
            { id: 'hasKey', label: 'hasKey' },
            { id: 'score', label: 'score' }
        ]);
    });

    it('lists custom event name suggestions from OnCustomEvent/EmitCustomEvent nodes only', () => {
        const level = {
            eventGraph: {
                nodes: [
                    { type: 'OnCustomEvent', params: { name: 'addScore' } },
                    { type: 'EmitCustomEvent', params: { name: 'openMenu' } },
                    { type: 'SetVariable', params: { name: 'ignored' } }
                ]
            }
        };
        expect(listCustomEventNameOptions(level)).toEqual([
            { id: 'addScore', label: 'addScore' },
            { id: 'openMenu', label: 'openMenu' }
        ]);
    });

    it('returns empty option lists when there is no event graph', () => {
        expect(listVariableNameOptions(null)).toEqual([]);
        expect(listCustomEventNameOptions({})).toEqual([]);
    });
});
