import { describe, it, expect } from 'vitest';
import {
    listLevelObjectOptions,
    listDialogueOptions
} from '../src/ui/LevelObjectPicker.js';

describe('LevelObjectPicker', () => {
    it('lists objects with name (id) labels', () => {
        const level = {
            getAllObjects: () => [
                { id: 'hero', name: 'Hero' },
                { id: 2, name: '', type: 'prop' }
            ]
        };
        expect(listLevelObjectOptions(level)).toEqual([
            { id: 'hero', label: 'Hero (hero)' },
            { id: '2', label: 'prop (2)' }
        ]);
    });

    it('lists dialogues by id', () => {
        const level = { dialogues: [{ id: 'guard' }, { id: 'shop' }] };
        expect(listDialogueOptions(level)).toEqual([
            { id: 'guard', label: 'guard' },
            { id: 'shop', label: 'shop' }
        ]);
    });
});
