import { describe, it, expect } from 'vitest';
import { AssetPathRewriter } from '../src/utils/AssetPathRewriter.js';

describe('AssetPathRewriter', () => {
    const remaps = AssetPathRewriter.sortRemaps([
        { from: 'assets/old/hero.json', to: 'assets/chars/hero.json' },
        { from: 'assets/old/hero.png', to: 'assets/chars/hero.png' },
        { from: 'assets/old', to: 'assets/chars' }
    ]);

    it('rewrites content-relative, ./content/, content/, and root/ forms', () => {
        expect(AssetPathRewriter.rewriteString('assets/old/hero.json', remaps))
            .toBe('assets/chars/hero.json');
        expect(AssetPathRewriter.rewriteString('./content/assets/old/hero.png', remaps))
            .toBe('./content/assets/chars/hero.png');
        expect(AssetPathRewriter.rewriteString('content/assets/old/hero.json', remaps))
            .toBe('content/assets/chars/hero.json');
        expect(AssetPathRewriter.rewriteString('root/assets/old', remaps))
            .toBe('root/assets/chars');
    });

    it('does not rewrite asset ids or unrelated strings', () => {
        expect(AssetPathRewriter.rewriteString('img_hero_01', remaps)).toBe('img_hero_01');
        expect(AssetPathRewriter.rewriteString('assets/other/x.json', remaps)).toBe('assets/other/x.json');
        expect(AssetPathRewriter.rewriteString('', remaps)).toBe('');
        expect(AssetPathRewriter.rewriteString(null, remaps)).toBe(null);
    });

    it('rewrites nested component + property path refs in place', () => {
        const asset = {
            id: 'actor_1',
            path: 'assets/old/hero.json',
            imgSrc: './content/assets/old/hero.png',
            properties: { sourceFile: 'assets/old/hero.png', levelSrc: 'assets/old/map.json' },
            components: [{
                type: 'sprite',
                properties: { imageAssetId: 'img_hero_01', src: 'assets/old/hero.png' }
            }]
        };
        const dirty = AssetPathRewriter.rewriteInPlace(asset, remaps);
        expect(dirty).toBe(true);
        expect(asset.id).toBe('actor_1');
        expect(asset.path).toBe('assets/chars/hero.json');
        expect(asset.imgSrc).toBe('./content/assets/chars/hero.png');
        expect(asset.properties.sourceFile).toBe('assets/chars/hero.png');
        expect(asset.components[0].properties.imageAssetId).toBe('img_hero_01');
        expect(asset.components[0].properties.src).toBe('assets/chars/hero.png');
    });

    it('rewriteAll updates library assets and the open level', () => {
        const assets = [{
            id: 'a',
            path: 'assets/old/hero.json',
            components: [{ properties: { imageAssetId: 'keep-me', atlas: 'assets/old/hero.png' } }]
        }];
        const editor = {
            assetManager: { getAllAssets: () => assets },
            level: {
                objects: [{ properties: { spriteSrc: './content/assets/old/hero.png' } }],
                eventGraphAssetId: 'graph_1'
            }
        };
        const dirty = AssetPathRewriter.rewriteAll(editor, remaps);
        expect(dirty).toHaveLength(1);
        expect(assets[0].path).toBe('assets/chars/hero.json');
        expect(assets[0].components[0].properties.imageAssetId).toBe('keep-me');
        expect(editor.level.objects[0].properties.spriteSrc).toBe('./content/assets/chars/hero.png');
        expect(editor.level.eventGraphAssetId).toBe('graph_1');
    });
});
