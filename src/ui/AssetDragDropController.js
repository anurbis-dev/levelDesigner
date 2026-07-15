import { Logger } from '../utils/Logger.js';

/**
 * Drag & drop for AssetPanel — thumbnail drag-out (asset -> canvas), external-file drop
 * overlay (PNG import). AssetPanel.handleDrop (asset creation from dropped files) stays on
 * AssetPanel itself and calls into this controller's predicate methods.
 * Extracted from AssetPanel.js — Фаза 4.5 рефакторинга (tmp/2D_Editor_REFACTOR_PLAN.md).
 * Note: the plan's original jscpd finding about duplication with OutlinerPanel.js drag-drop
 * logic is stale — OutlinerPanel.js currently has no external-file-drop/overlay logic at all
 * (only the unrelated icon paint-drag feature for batch visibility toggling), so there is
 * nothing to share and no base class was introduced.
 */
export class AssetDragDropController {
    constructor(assetPanel) {
        this.assetPanel = assetPanel;
    }

    handleThumbnailDragStart(e, asset) {
        const assetPanel = this.assetPanel;

        // Disable dragging when Ctrl/Cmd or Shift is held to allow marquee selection
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Mark HTML5 drag so the following click does not sole-select and wipe multi.
        assetPanel._assetHtmlDragActive = true;

        const raw = assetPanel.stateManager.get('selectedAssets');
        const selectedAssets = raw instanceof Set
            ? raw
            : new Set(Array.isArray(raw) ? raw : []);
        // Drag whole multi-selection when the pressed item is part of it (drop on canvas).
        const draggedAssetIds = selectedAssets.has(asset.id)
            ? Array.from(selectedAssets)
            : [asset.id];

        Logger.ui.debug(
            'Drag start for asset:', asset.id,
            'draggedAssetIds:', draggedAssetIds,
            'selectedAssets:', Array.from(selectedAssets)
        );

        e.dataTransfer.setData('application/json', JSON.stringify(draggedAssetIds));
        e.dataTransfer.effectAllowed = 'copy';

        assetPanel.stateManager.update({
            'mouse.isDraggingAsset': true
        });
    }

    handleThumbnailDragEnd(e, asset) {
        // Keep _assetHtmlDragActive until click handler clears it (same gesture).
        this.assetPanel.stateManager.update({
            'mouse.isDraggingAsset': false
        });
    }

    /**
     * Add drop target styling
     */
    addDropTarget() {
        this.assetPanel.container.classList.add('drop-target');
    }

    /**
     * Remove drop target styling
     */
    removeDropTarget() {
        this.assetPanel.container.classList.remove('drop-target');
    }

    setupDragAndDrop() {
        const assetPanel = this.assetPanel;

        if (!assetPanel.container || !assetPanel.previewsContainer) {
            Logger.ui.warn('AssetPanel: Container or previewsContainer not available for drag-and-drop setup');
            return;
        }

        const dropZone = assetPanel.container;

        // Create drop overlay element - positioned relative to content container
        assetPanel.dropOverlay = document.createElement('div');
        assetPanel.dropOverlay.className = 'drop-overlay';

        // Create text container with background
        const textContainer = document.createElement('div');
        textContainer.className = 'drop-overlay-text';
        textContainer.textContent = 'Drop PNG image(s) to Import as Assets';
        assetPanel.dropOverlay.appendChild(textContainer);

        // Position overlay relative to main container but size it to match previews container
        assetPanel.container.style.position = 'relative';

        // Size overlay to match previews container dimensions and position
        if (assetPanel.previewsContainer) {
            const updateOverlaySize = () => {
                this.updateOverlayPosition();
            };

            // Initial sizing
            updateOverlaySize();

            // Update size on window resize or container changes
            const resizeObserver = new ResizeObserver(updateOverlaySize);
            resizeObserver.observe(assetPanel.previewsContainer);
            resizeObserver.observe(assetPanel.container);

            // Store reference for cleanup
            assetPanel.dropOverlayResizeObserver = resizeObserver;
        }

        assetPanel.container.appendChild(assetPanel.dropOverlay);

        // Bind methods to preserve context
        assetPanel.boundHandleDragEnter = this.handleDragEnter.bind(this);
        assetPanel.boundHandleDragOver = this.handleDragOver.bind(this);
        assetPanel.boundHandleDragLeave = this.handleDragLeave.bind(this);
        assetPanel.boundHandleDrop = assetPanel.handleDrop.bind(assetPanel);

        // Setup drag-n-drop handlers on container
        // Use capture phase to ensure we catch events before other handlers
        dropZone.addEventListener('dragenter', assetPanel.boundHandleDragEnter, true);
        dropZone.addEventListener('dragover', assetPanel.boundHandleDragOver, true);
        dropZone.addEventListener('dragleave', assetPanel.boundHandleDragLeave, true);
        dropZone.addEventListener('drop', assetPanel.boundHandleDrop, true);
    }

    /**
     * Check if assets can be dropped to the currently active folder
     * @returns {boolean} True if dropping is allowed, false otherwise
     */
    canDropToActiveFolder() {
        const activeTabPath = this.assetPanel.foldersController.getActiveTabPath();

        // Cannot drop to root folder
        return activeTabPath !== 'root';
    }

    /**
     * Check if drag event is for external files
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if external files
     */
    isExternalFilesDrag(e) {
        return e.dataTransfer.types.includes('Files');
    }

    /**
     * Check if drag coordinates are over tabs container
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if over tabs container
     */
    isOverTabsContainer(e) {
        const assetPanel = this.assetPanel;
        if (!assetPanel.tabsContainer) return false;
        const tabsRect = assetPanel.tabsContainer.getBoundingClientRect();
        return e.clientX >= tabsRect.left && e.clientX <= tabsRect.right &&
               e.clientY >= tabsRect.top && e.clientY <= tabsRect.bottom;
    }

    /**
     * Check if drag coordinates are over previews container
     * @param {DragEvent} e - Drag event
     * @returns {boolean} True if over previews container
     */
    isOverPreviewsContainer(e) {
        const assetPanel = this.assetPanel;
        if (!assetPanel.previewsContainer) return false;
        const rect = assetPanel.previewsContainer.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
               e.clientY >= rect.top && e.clientY <= rect.bottom;
    }

    /**
     * Update overlay position and size to match previewsContainer
     * This is a shared method used by both ResizeObserver and updateDropOverlayStyle
     * Note: Does not change display property - overlay visibility is controlled elsewhere
     */
    updateOverlayPosition() {
        const assetPanel = this.assetPanel;
        if (!assetPanel.dropOverlay || !assetPanel.previewsContainer) return;

        const rect = assetPanel.previewsContainer.getBoundingClientRect();
        const containerRect = assetPanel.container.getBoundingClientRect();

        assetPanel.dropOverlay.style.position = 'absolute';
        assetPanel.dropOverlay.style.top = `${rect.top - containerRect.top}px`;
        assetPanel.dropOverlay.style.left = `${rect.left - containerRect.left}px`;
        assetPanel.dropOverlay.style.width = `${rect.width}px`;
        assetPanel.dropOverlay.style.height = `${rect.height}px`;
        assetPanel.dropOverlay.style.zIndex = '9999';
        assetPanel.dropOverlay.style.pointerEvents = 'none';
    }

    /**
     * Update drop overlay style based on whether dropping is allowed
     * @param {boolean} allowed - Whether dropping is allowed
     */
    updateDropOverlayStyle(allowed) {
        const assetPanel = this.assetPanel;
        if (!assetPanel.dropOverlay) return;

        const textContainer = assetPanel.dropOverlay.querySelector('.drop-overlay-text');
        if (!textContainer) return;

        // Update overlay position and size to match previewsContainer
        this.updateOverlayPosition();

        // Remove previous state classes
        assetPanel.dropOverlay.classList.remove('drop-overlay-allowed', 'drop-overlay-disallowed');
        textContainer.classList.remove('drop-overlay-text-allowed', 'drop-overlay-text-disallowed');

        // Show overlay when updating style
        assetPanel.dropOverlay.classList.add('drop-overlay-visible');

        if (allowed) {
            // Normal style: blue
            assetPanel.dropOverlay.classList.add('drop-overlay-allowed');
            textContainer.classList.add('drop-overlay-text-allowed');
            textContainer.textContent = 'Drop PNG image(s) to Import as Assets';
        } else {
            // Error style: red
            assetPanel.dropOverlay.classList.add('drop-overlay-disallowed');
            textContainer.classList.add('drop-overlay-text-disallowed');
            textContainer.textContent = 'Can not create assets in this location';
        }
    }

    handleDragEnter(e) {
        const assetPanel = this.assetPanel;

        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }

        // Skip if over tabs container
        if (this.isOverTabsContainer(e)) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Show overlay if over previews container
        if (this.isOverPreviewsContainer(e) && assetPanel.dropOverlay) {
            const canDrop = this.canDropToActiveFolder();
            this.updateDropOverlayStyle(canDrop);
        }
    }

    handleDragOver(e) {
        const assetPanel = this.assetPanel;

        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }

        // Skip if over tabs container
        if (this.isOverTabsContainer(e)) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        // Update overlay if over previews container
        if (this.isOverPreviewsContainer(e)) {
            if (assetPanel.dropOverlay) {
                const canDrop = this.canDropToActiveFolder();
                this.updateDropOverlayStyle(canDrop);
            }
        } else if (assetPanel.dropOverlay) {
            // Hide overlay if outside previews container
            assetPanel.dropOverlay.classList.remove('drop-overlay-visible');
        }
    }

    handleDragLeave(e) {
        const assetPanel = this.assetPanel;

        // Only handle external file drops
        if (!this.isExternalFilesDrag(e)) {
            return;
        }

        // Hide overlay if leaving previews container
        if (!this.isOverPreviewsContainer(e) && assetPanel.dropOverlay) {
            assetPanel.dropOverlay.classList.remove('drop-overlay-visible');
        }
    }
}
