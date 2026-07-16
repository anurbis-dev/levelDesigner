/**
 * Factory for secondary (non-primary) dock panel instances (Phase B4).
 * Primary panels stay on editor.*Panel + fixed DOM ids from initializeUIComponents.
 */
import { OutlinerPanel } from '../OutlinerPanel.js';
import { DetailsPanel } from '../DetailsPanel.js';
import { LayersPanel } from '../LayersPanel.js';
import { LevelsPanel } from '../LevelsPanel.js';
import { AssetPanel } from '../AssetPanel.js';
import { Toolbar } from '../Toolbar.js';
import { Logger } from '../../utils/Logger.js';

const MULTI_TYPES = new Set(['outliner', 'details', 'layers', 'levels', 'assets', 'viewport']);

/**
 * @param {string} contentType
 * @returns {boolean}
 */
export function isMultiInstanceType(contentType) {
    return MULTI_TYPES.has(contentType);
}

/**
 * Build a fresh panel root + class instance for a dock leaf copy.
 * @param {string} contentType
 * @param {string} leafId
 * @param {object} levelEditor
 * @returns {{ root: HTMLElement, panel: object }|null}
 */
export function createPanelCopy(contentType, leafId, levelEditor) {
    if (!isMultiInstanceType(contentType) || !levelEditor) return null;

    const instanceKey = `copy-${leafId}`;
    const root = document.createElement('div');
    root.className = 'dock-panel-root dock-panel-copy';
    root.dataset.contentType = contentType;
    root.dataset.leafId = leafId;
    root.dataset.copy = '1';
    root.id = `${contentType}-copy-${leafId}`;

    const opts = { instanceKey, isPrimary: false };

    // Attach before ctor so context menus / listeners can bind (parent/container in DOM).
    const pool = document.getElementById('dock-content-pool') || document.body;
    pool.appendChild(root);

    try {
        let panel = null;
        switch (contentType) {
            case 'outliner':
                root.classList.add('tab-content-right');
                panel = new OutlinerPanel(root, levelEditor.stateManager, levelEditor, opts);
                break;
            case 'details':
                root.classList.add('tab-content-right');
                panel = new DetailsPanel(root, levelEditor.stateManager, levelEditor, opts);
                break;
            case 'layers':
                root.classList.add('tab-content-right', 'layers-panel-container');
                panel = new LayersPanel(root, levelEditor.stateManager, levelEditor, opts);
                break;
            case 'levels':
                root.classList.add('tab-content-right', 'levels-panel-container');
                panel = new LevelsPanel(root, levelEditor.stateManager, levelEditor, opts);
                break;
            case 'assets': {
                const tabs = document.createElement('div');
                tabs.dataset.assetRole = 'tabs';
                tabs.className = 'flex border-b border-gray-700';
                const previews = document.createElement('div');
                previews.dataset.assetRole = 'previews';
                previews.className = 'flex-grow overflow-auto p-1';
                root.appendChild(tabs);
                root.appendChild(previews);
                root.style.display = 'flex';
                root.style.flexDirection = 'column';
                panel = new AssetPanel(
                    root,
                    levelEditor.assetManager,
                    levelEditor.stateManager,
                    levelEditor,
                    opts
                );
                break;
            }
            case 'viewport':
                // Secondary viewport: paired toolbar + canvas (VP-TB)
                return createViewportCopy(leafId, levelEditor, root);
            default:
                return null;
        }
        // Primary panels get an initial render from lifecycle; copies need an explicit pass.
        if (panel && typeof panel.render === 'function') {
            try {
                panel.render();
            } catch (renderErr) {
                Logger.ui.warn(`DockPanelFactory: initial render failed for ${contentType}`, renderErr);
            }
        }
        return { root, panel };
    } catch (err) {
        Logger.ui.error(`DockPanelFactory: failed to create ${contentType} copy for ${leafId}`, err);
        root.remove();
        return null;
    }
}

/**
 * Secondary viewport leaf: independent canvas + work/game camera via ViewportViewManager.
 * @param {string} leafId
 * @param {object} levelEditor
 * @param {HTMLElement} root
 * @returns {{ root: HTMLElement, panel: object }|null}
 */
function createViewportCopy(leafId, levelEditor, root) {
    const bg = levelEditor.stateManager?.get('canvas.backgroundColor')
        || levelEditor.level?.settings?.backgroundColor
        || '#4B5563';

    root.className = 'dock-panel-root dock-panel-copy dock-viewport-root dock-viewport-copy';
    root.dataset.contentType = 'viewport';
    root.dataset.leafId = leafId;
    root.dataset.copy = '1';
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.minHeight = '0';
    root.style.flex = '1';
    root.style.backgroundColor = bg;

    // VP-TB: toolbar copy paired with this viewport leaf
    const toolbarEl = document.createElement('div');
    toolbarEl.className = 'toolbar-container viewport-toolbar viewport-toolbar-copy';
    toolbarEl.dataset.viewportLeafId = leafId;
    toolbarEl.style.flex = '0 0 auto';
    toolbarEl.style.pointerEvents = 'auto';
    root.appendChild(toolbarEl);

    const measure = document.createElement('div');
    measure.className = 'canvas-viewport dock-viewport-measure';
    measure.dataset.viewportLeafId = leafId;
    measure.style.flex = '1';
    measure.style.minHeight = '0';
    measure.style.position = 'relative';
    measure.style.overflow = 'hidden';
    measure.style.backgroundColor = bg;

    const container = document.createElement('div');
    container.className = 'canvas-container';
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.backgroundColor = bg;

    const canvas = document.createElement('canvas');
    canvas.className = 'viewport-view-canvas';
    canvas.dataset.viewportLeafId = leafId;
    canvas.style.backgroundColor = bg;

    container.appendChild(canvas);
    measure.appendChild(container);
    root.appendChild(measure);

    const pool = document.getElementById('dock-content-pool') || document.body;
    if (root.parentElement !== pool) pool.appendChild(root);

    const vvm = levelEditor.viewportViewManager;
    if (!vvm) {
        Logger.ui.error('DockPanelFactory: viewportViewManager missing');
        root.remove();
        return null;
    }

    const primary = vvm.getPrimaryView();
    const seedCam = primary
        ? vvm.resolveCamera(primary)
        : (levelEditor.stateManager.get('camera') || { x: 0, y: 0, zoom: 1 });

    vvm.registerView({
        leafId,
        isPrimary: false,
        root,
        measureEl: measure,
        canvas,
        source: { kind: 'work' },
        localCamera: { x: seedCam.x, y: seedCam.y, zoom: seedCam.zoom },
        typeFilters: new Set()
    });

    let toolbar = null;
    try {
        toolbar = new Toolbar(toolbarEl, levelEditor.stateManager, levelEditor, {
            viewLeafId: leafId,
            isCopy: true
        });
        // Match global toolbar visibility
        const toolbarVisible = levelEditor.stateManager?.get('view.toolbar') ?? true;
        if (!toolbarVisible) toolbar.setVisible(false);
    } catch (tbErr) {
        Logger.ui.warn('DockPanelFactory: viewport toolbar copy failed', tbErr);
    }

    const panel = {
        leafId,
        toolbar,
        destroy() {
            try {
                toolbar?.destroy?.();
            } catch (err) {
                Logger.ui.warn('DockPanelFactory: viewport toolbar destroy failed', err);
            }
            toolbar = null;
            levelEditor.viewportViewManager?.unregisterView(leafId);
        }
    };

    levelEditor.render?.();
    return { root, panel };
}

/**
 * Dispose a secondary panel instance (never call on primary editor.*Panel).
 * @param {{ panel?: object, root?: HTMLElement, contentType?: string }|null} entry
 */
export function destroyPanelCopy(entry) {
    if (!entry) return;
    const panel = entry.panel;
    if (panel && typeof panel.destroy === 'function') {
        try {
            panel.destroy();
        } catch (err) {
            Logger.ui.warn('DockPanelFactory: panel.destroy failed', err);
        }
    }
    if (entry.root && entry.root.parentElement) {
        entry.root.remove();
    }
}
