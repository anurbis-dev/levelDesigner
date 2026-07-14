import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from '../event-system/EventHandlerManager.js';
import { PanelSizeCalculator } from '../utils/PanelSizeCalculator.js';
import { TabLayoutController } from './panels/TabLayoutController.js';
import { TabOrderController } from './panels/TabOrderController.js';
import { TabDragController } from './panels/TabDragController.js';
import { SplitPaneController } from './panels/SplitPaneController.js';

/**
 * Universal panel position manager — thin facade/orchestrator over four controllers:
 * TabLayoutController (position/size/collapse), TabOrderController (programmatic tab
 * moves/reordering), TabDragController (tab-bar drag-and-drop) and SplitPaneController
 * (Blender-style split-pane/detach window manager). Decomposed from a single
 * 2500+-line God Object — Фаза 4.5 (tmp/2D_Editor_REFACTOR_PLAN.md).
 *
 * Handles position toggling for both folders panel and right panel.
 */
export class PanelPositionManager {
    constructor(levelEditor) {
        this.levelEditor = levelEditor;
        this.stateManager = levelEditor.stateManager;
        this.userPrefs = levelEditor.userPrefs;
        this._initializing = false; // Flag to prevent loops during initialization

        // Initialize panel size calculator
        this.panelSizeCalculator = new PanelSizeCalculator();

        this.tabLayoutController = new TabLayoutController(this);
        this.tabOrderController = new TabOrderController(this);
        this.tabDragController = new TabDragController(this);
        this.splitPaneController = new SplitPaneController(this);

        // Initialize global tab dragging handler once
        this.tabDragController._initGlobalTabDraggingHandler();
    }

    /**
     * Update UI after panel changes
     * @private
     */
    _updateUI() {
        // No need to update panels content when only sizes change
        // Canvas is now in separate container, no need to update it when panels change
    }

    /**
     * Destroy and cleanup resources
     */
    destroy() {
        // Cleanup resizer event listeners
        const leftResizer = document.getElementById('resizer-left-tabs-panel');
        const rightResizer = document.getElementById('resizer-right-tabs-panel');

        if (leftResizer) {
            this.levelEditor.resizerManager.unregisterResizer(leftResizer);
            eventHandlerManager.unregisterElement(leftResizer);
        }

        if (rightResizer) {
            this.levelEditor.resizerManager.unregisterResizer(rightResizer);
            eventHandlerManager.unregisterElement(rightResizer);
        }

        // Cleanup global tab-dragging listener registered in tabDragController
        this.tabDragController.destroy();

        // Clear references
        this.levelEditor = null;
        this.stateManager = null;
        this.userPrefs = null;

        Logger.ui.info('PanelPositionManager destroyed');
    }
}
