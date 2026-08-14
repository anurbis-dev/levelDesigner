import { describe, it, expect } from 'vitest';
import { FsaContentFs } from '../src/utils/FsaContentFs.js';

describe('FsaContentFs path helpers', () => {
    it('maps UI folder paths to content-relative', () => {
        expect(FsaContentFs.uiFolderToContentRel('root')).toBe('');
        expect(FsaContentFs.uiFolderToContentRel('root/assets/ledge')).toBe('assets/ledge');
        expect(FsaContentFs.uiFolderToContentRel('assets/ledge')).toBe('assets/ledge');
    });

    it('maps content-relative back to UI', () => {
        expect(FsaContentFs.contentRelToUiFolder('')).toBe('root');
        expect(FsaContentFs.contentRelToUiFolder('assets/ledge')).toBe('root/assets/ledge');
    });

    it('sanitizes folder names', () => {
        expect(FsaContentFs.sanitizeFolderName('My Folder')).toBe('My Folder');
        expect(FsaContentFs.sanitizeFolderName('a/b:c*')).toBe('a-b-c-');
        expect(FsaContentFs.sanitizeFolderName('   ')).toBe('');
    });

    it('adds and removes structure nodes', () => {
        const structure = {};
        FsaContentFs.addStructureFolder(structure, 'assets/enemies');
        expect(structure.assets.enemies).toEqual({});
        expect(FsaContentFs.flattenFolderRels(structure)).toEqual(['assets', 'assets/enemies']);
        expect(FsaContentFs.removeStructureNode(structure, 'assets/enemies')).toBe(true);
        expect(structure.assets.enemies).toBeUndefined();
        expect(FsaContentFs.removeStructureNode(structure, 'missing/x')).toBe(false);
    });

    it('isUnderPath treats empty parent as root', () => {
        expect(FsaContentFs.isUnderPath('', 'assets/a')).toBe(true);
        expect(FsaContentFs.isUnderPath('assets', 'assets/a')).toBe(true);
        expect(FsaContentFs.isUnderPath('assets/a', 'assets')).toBe(false);
        expect(FsaContentFs.isUnderPath('assets/a', 'assets/a')).toBe(true);
    });

    it('moves a structure subtree with children', () => {
        const structure = {};
        FsaContentFs.addStructureFolder(structure, 'assets/old/enemies');
        expect(FsaContentFs.moveStructureNode(structure, 'assets/old', 'maps/old')).toBe(true);
        expect(structure.assets.old).toBeUndefined();
        expect(structure.maps.old.enemies).toEqual({});
        expect(FsaContentFs.folderExists(structure, 'maps/old/enemies')).toBe(true);
    });
});

