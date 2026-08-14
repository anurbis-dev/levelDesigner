import { describe, it, expect } from 'vitest';
import { FsaStore } from '../src/utils/FsaStore.js';
import { FsaContentWriter } from '../src/utils/FsaContentWriter.js';

describe('FsaStore path helpers', () => {
    it('strips root/ and content/ prefixes', () => {
        expect(FsaStore.toContentRelativePath('root/assets/ledge/player.json'))
            .toBe('assets/ledge/player.json');
        expect(FsaStore.toContentRelativePath('./content/assets/ledge/player.json'))
            .toBe('assets/ledge/player.json');
        expect(FsaStore.toContentRelativePath('content/maps/ledge.json'))
            .toBe('maps/ledge.json');
        expect(FsaStore.toContentRelativePath('assets/ledge/player.json'))
            .toBe('assets/ledge/player.json');
        expect(FsaStore.toContentRelativePath('root')).toBe(null);
        expect(FsaStore.toContentRelativePath('')).toBe(null);
    });

    it('places a bare level file name under maps/', () => {
        expect(FsaStore.toLevelRelativePath('level.json')).toBe('maps/level.json');
        expect(FsaStore.toLevelRelativePath('maps/ledge.json')).toBe('maps/ledge.json');
        expect(FsaStore.toLevelRelativePath('root/maps/foo.json')).toBe('maps/foo.json');
    });

    it('is unsupported in Node test env', () => {
        expect(FsaStore.isSupported()).toBe(false);
    });

    it('keys a project folder bind by basename', () => {
        expect(FsaStore.projectDirKey('My Game.json')).toBe('project:My Game.json');
        expect(FsaStore.projectDirKey('root/foo/bar.json')).toBe('project:bar.json');
        expect(FsaStore.projectDirKey('')).toBe(null);
        expect(FsaStore.projectDirKey(null)).toBe(null);
    });
});

describe('FsaContentWriter.assetToDiskJson', () => {
    it('uses sibling filename for imgSrc and drops path', () => {
        const json = FsaContentWriter.assetToDiskJson({
            id: 'asset_1',
            name: 'player',
            type: 'image',
            category: 'ledge',
            path: 'assets/ledge/player.json',
            width: 16,
            height: 16,
            color: '#fff',
            imgSrc: './content/assets/ledge/player.png',
            properties: {},
            tags: [],
            components: []
        });
        expect(json.path).toBeUndefined();
        expect(json.imgSrc).toBe('player.png');
        expect(json.name).toBe('player');
    });

    it('drops data-URL imgSrc (PNG is written as a sibling file)', () => {
        const json = FsaContentWriter.assetToDiskJson({
            name: 'tmp',
            type: 'image',
            imgSrc: 'data:image/png;base64,AAA',
            properties: {},
            tags: [],
            components: []
        });
        expect(json.imgSrc).toBeUndefined();
    });
});
