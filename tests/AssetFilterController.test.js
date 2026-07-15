import { describe, it, expect } from 'vitest';
import { AssetFilterController } from '../src/ui/AssetFilterController.js';

/**
 * shouldShowAsset/filterAssets only read `this.assetPanel.activeTypeFilters` / `this.assetPanel.searchTerm` —
 * call them unbound against a controller wrapping a plain object instead of constructing a full
 * AssetPanel (which needs a real DOM container/assetManager/stateManager).
 * Moved from AssetPanel.js to AssetFilterController.js.
 */
describe('AssetFilterController.shouldShowAsset (characterization)', () => {
    it('shows everything when no type filters are active', () => {
        const controller = new AssetFilterController({ activeTypeFilters: new Set() });
        expect(controller.shouldShowAsset({ type: 'sprite' })).toBe(true);
        expect(controller.shouldShowAsset({})).toBe(true);
    });

    it('DISABLE_ALL hides everything regardless of other active filters', () => {
        const controller = new AssetFilterController({ activeTypeFilters: new Set(['DISABLE_ALL', 'sprite']) });
        expect(controller.shouldShowAsset({ type: 'sprite' })).toBe(false);
    });

    it('shows only assets whose type/category is in the active filter set', () => {
        const controller = new AssetFilterController({ activeTypeFilters: new Set(['sprite']) });
        expect(controller.shouldShowAsset({ type: 'sprite' })).toBe(true);
        expect(controller.shouldShowAsset({ type: 'sound' })).toBe(false);
    });

    it('falls back to asset.category when asset.type is absent', () => {
        const controller = new AssetFilterController({ activeTypeFilters: new Set(['prefab']) });
        expect(controller.shouldShowAsset({ category: 'prefab' })).toBe(true);
        expect(controller.shouldShowAsset({ category: 'other' })).toBe(false);
    });
});

describe('AssetFilterController.filterAssets (characterization)', () => {
    const assets = [
        { name: 'Tree', type: 'sprite' },
        { name: 'Treasure Chest', type: 'prop' },
        { name: 'Explosion', type: 'sprite' }
    ];

    it('returns all assets when no search term and no active filters', () => {
        const controller = new AssetFilterController({ searchTerm: '', activeTypeFilters: new Set() });
        expect(controller.filterAssets(assets)).toEqual(assets);
    });

    it('applies search filter by name (case-insensitive substring)', () => {
        const controller = new AssetFilterController({ searchTerm: 'tre', activeTypeFilters: new Set() });
        const result = controller.filterAssets(assets);
        expect(result.map(a => a.name)).toEqual(['Tree', 'Treasure Chest']);
    });

    it('applies type filter after search filter', () => {
        const controller = new AssetFilterController({ searchTerm: 'tre', activeTypeFilters: new Set(['sprite']) });
        const result = controller.filterAssets(assets);
        expect(result.map(a => a.name)).toEqual(['Tree']);
    });

    it('type filter alone (no search term) narrows by type', () => {
        const controller = new AssetFilterController({ searchTerm: '', activeTypeFilters: new Set(['prop']) });
        const result = controller.filterAssets(assets);
        expect(result.map(a => a.name)).toEqual(['Treasure Chest']);
    });
});
