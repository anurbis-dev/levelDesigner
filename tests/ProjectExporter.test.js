import { describe, it, expect } from 'vitest';
import { ProjectExporter } from '../src/models/ProjectExporter.js';

function makeSession(id, extra = {}) {
    return {
        id,
        visible: true,
        fileName: `${id}.level.json`,
        level: { toJSON: () => ({ meta: { name: id }, objects: [] }) },
        ...extra
    };
}

describe('ProjectExporter.export', () => {
    it('exports all levels from levelOrder by default, in order', () => {
        const levelSessions = new Map([
            ['a', makeSession('a')],
            ['b', makeSession('b')]
        ]);
        const result = ProjectExporter.export(levelSessions, ['b', 'a'], { name: 'Demo' });

        expect(result.levels.map(l => l.id)).toEqual(['b', 'a']);
    });

    it('carries level id and level.toJSON() data, drops editor-only fields', () => {
        const levelSessions = new Map([['a', makeSession('a')]]);
        const result = ProjectExporter.export(levelSessions, ['a'], { name: 'Demo' });

        expect(result.levels).toEqual([{ id: 'a', data: { meta: { name: 'a' }, objects: [] } }]);
        expect(result.levels[0]).not.toHaveProperty('visible');
        expect(result.levels[0]).not.toHaveProperty('fileName');
        expect(result).not.toHaveProperty('viewState');
        expect(result).not.toHaveProperty('currentLevelIndex');
    });

    it('defaults entryLevelId to the first exported level', () => {
        const levelSessions = new Map([
            ['a', makeSession('a')],
            ['b', makeSession('b')]
        ]);
        const result = ProjectExporter.export(levelSessions, ['b', 'a'], null);

        expect(result.entryLevelId).toBe('b');
    });

    it('returns entryLevelId null when there are no levels', () => {
        const result = ProjectExporter.export(new Map(), [], null);
        expect(result.entryLevelId).toBeNull();
        expect(result.levels).toEqual([]);
    });

    it('opts.includeLevelIds filters to a subset', () => {
        const levelSessions = new Map([
            ['a', makeSession('a')],
            ['b', makeSession('b')],
            ['c', makeSession('c')]
        ]);
        const result = ProjectExporter.export(levelSessions, ['a', 'b', 'c'], null, {
            includeLevelIds: ['c', 'a']
        });

        expect(result.levels.map(l => l.id)).toEqual(['c', 'a']);
    });

    it('opts.entryLevelId overrides the default first-level pick', () => {
        const levelSessions = new Map([
            ['a', makeSession('a')],
            ['b', makeSession('b')]
        ]);
        const result = ProjectExporter.export(levelSessions, ['a', 'b'], null, {
            entryLevelId: 'b'
        });

        expect(result.entryLevelId).toBe('b');
    });

    it('defaults project name when project is null/missing', () => {
        const result = ProjectExporter.export(new Map(), [], null);
        expect(result.name).toBe('Untitled Project');
    });

    it('sets formatVersion to 1', () => {
        const result = ProjectExporter.export(new Map(), [], null);
        expect(result.formatVersion).toBe(1);
    });
});
