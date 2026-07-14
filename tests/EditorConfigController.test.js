import { describe, it, expect, vi } from 'vitest';
import { EditorConfigController } from '../src/core/EditorConfigController.js';

function makeEditor({ configValues = {}, settingsPanel = null } = {}) {
    const stateStore = {};
    const configManager = {
        get: vi.fn((key) => configValues[key]),
        getCanvas: vi.fn(() => configValues.canvas || {}),
        saveSettings: vi.fn()
    };
    const editor = {
        configManager,
        stateManager: {
            set: vi.fn((key, value) => { stateStore[key] = value; })
        },
        settingsPanel,
        level: { settings: {} }
    };
    return { editor, stateStore, configManager };
}

describe('EditorConfigController', () => {
    it('applyConfiguration() no-ops when configManager missing', () => {
        const { editor } = makeEditor();
        editor.configManager = null;
        const controller = new EditorConfigController(editor);
        expect(() => controller.applyConfiguration()).not.toThrow();
    });

    it('_applyBasicGridSettings applies size/color/thickness/opacity, defaulting opacity to 0.1 for color', () => {
        const { editor, stateStore } = makeEditor();
        const controller = new EditorConfigController(editor);
        controller._applyBasicGridSettings({ size: 32, color: '#ff0000', thickness: 1 });
        expect(stateStore['canvas.gridSize']).toBe(32);
        expect(stateStore['canvas.gridThickness']).toBe(1);
        expect(stateStore['canvas.gridColor']).toMatch(/rgba\(255, 0, 0, 0\.1\)/);
        expect(stateStore['canvas.gridOpacity']).toBeUndefined();
    });

    it('_applyBasicGridSettings uses explicit opacity for grid color when provided', () => {
        const { editor, stateStore } = makeEditor();
        const controller = new EditorConfigController(editor);
        controller._applyBasicGridSettings({ color: '#00ff00', opacity: 0.5 });
        expect(stateStore['canvas.gridColor']).toMatch(/rgba\(0, 255, 0, 0\.5\)/);
        expect(stateStore['canvas.gridOpacity']).toBe(0.5);
    });

    it('_applyGridSubdivisionSettings skips undefined fields', () => {
        const { editor, stateStore } = makeEditor();
        const controller = new EditorConfigController(editor);
        controller._applyGridSubdivisionSettings({ subdivisions: 4 });
        expect(stateStore['canvas.gridSubdivisions']).toBe(4);
        expect('canvas.gridSubdivColor' in stateStore).toBe(false);
        expect('canvas.gridSubdivThickness' in stateStore).toBe(false);
    });

    it('_applyGridTypeSettings applies type and hexOrientation', () => {
        const { editor, stateStore } = makeEditor();
        const controller = new EditorConfigController(editor);
        controller._applyGridTypeSettings({ type: 'hexagonal', hexOrientation: 'flat' });
        expect(stateStore['canvas.gridType']).toBe('hexagonal');
        expect(stateStore['canvas.hexOrientation']).toBe('flat');
    });

    it('applyConfiguration() reads grid+color config and calls saveSettings', () => {
        const { editor, stateStore, configManager } = makeEditor({
            configValues: {
                'grid.size': 16,
                'grid.color': '#111111',
                ui: { backgroundColor: '#222', textColor: '#fff' },
                canvas: { backgroundColor: '#000' },
                selection: { outlineColor: '#0f0' }
            }
        });
        const controller = new EditorConfigController(editor);
        controller.applyConfiguration();
        expect(stateStore['canvas.gridSize']).toBe(16);
        expect(stateStore['ui.backgroundColor']).toBe('#222');
        expect(stateStore['canvas.backgroundColor']).toBe('#000');
        expect(stateStore['selection.outlineColor']).toBe('#0f0');
        expect(configManager.saveSettings).toHaveBeenCalledTimes(1);
    });

    it('_syncGridSettingsToUI calls settingsPanel.gridSettings.syncAllGridSettingsToState when present', () => {
        const sync = vi.fn();
        const { editor } = makeEditor({ settingsPanel: { gridSettings: { syncAllGridSettingsToState: sync } } });
        const controller = new EditorConfigController(editor);
        controller._syncGridSettingsToUI();
        expect(sync).toHaveBeenCalledTimes(1);
    });

    it('_syncGridSettingsToUI is a no-op when settingsPanel/gridSettings missing', () => {
        const { editor } = makeEditor();
        const controller = new EditorConfigController(editor);
        expect(() => controller._syncGridSettingsToUI()).not.toThrow();
    });

    it('applyConfigurationToLevel() no-ops without level or configManager', () => {
        const { editor } = makeEditor();
        const controller = new EditorConfigController(editor);
        editor.level = null;
        expect(() => controller.applyConfigurationToLevel()).not.toThrow();
    });

    it('applyConfigurationToLevel() copies canvas config into level.settings, only for defined/truthy fields', () => {
        const { editor } = makeEditor({
            configValues: { canvas: { backgroundColor: '#abc', gridSize: 0, showGrid: false } }
        });
        const controller = new EditorConfigController(editor);
        controller.applyConfigurationToLevel();
        expect(editor.level.settings.backgroundColor).toBe('#abc');
        // gridSize: 0 is falsy, so the (undocumented) truthy-check means it's NOT applied — characterization of current behavior
        expect('gridSize' in editor.level.settings).toBe(false);
        expect(editor.level.settings.showGrid).toBe(false);
    });
});
