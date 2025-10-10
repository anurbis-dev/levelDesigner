/**
 * SelectionUtils - Utilities for element selection
 *
 * Provides common methods for element selection in panels:
 * - Click handling (regular, Shift+click, Ctrl+click)
 * - Marquee selection (selection by frame)
 * - Selection state management
 * - Visual selection updates
 *
 * @author Level Designer
 * @version 3.31.0
 */

import { Logger } from './Logger.js';

export class SelectionUtils {
    /**
     * Handle item click with support for various modifiers
     * @param {Event} e - Click event
     * @param {Object} item - Item to select
     * @param {Object} options - Selection options
     * @param {StateManager} options.stateManager - State manager
     * @param {string} options.selectionKey - Key for storing selection in state
     * @param {string} options.anchorKey - Key for storing selection anchor
     * @param {Function} options.getItemList - Function to get item list for range selection
     * @param {Function} options.onSelectionChange - Callback when selection changes
     * @param {Function} options.canSelect - Function to check if item can be selected
     */
    static handleItemClick(e, item, options) {
        const {
            stateManager,
            selectionKey = 'selectedObjects',
            anchorKey = 'outliner.shiftAnchor',
            getItemList = null,
            onSelectionChange = null,
            canSelect = null
        } = options;

        // Check if selection is possible
        if (canSelect && !canSelect(item)) {
            return;
        }

        const selectedItems = new Set(stateManager.get(selectionKey));

        if (e.shiftKey) {
            // Shift+click: select range from anchor to current item
            this.handleShiftClick(item, selectedItems, {
                stateManager,
                selectionKey,
                anchorKey,
                getItemList
            });
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+click: toggle item selection
            this.handleCtrlClick(item, selectedItems, {
                stateManager,
                selectionKey,
                anchorKey
            });
        } else {
            // Regular click: replace selection and set anchor
            selectedItems.clear();
            selectedItems.add(item.id);
            // Set anchor for future shift+click operations
            stateManager.update({
                [anchorKey]: item.id
            });
        }

        stateManager.set(selectionKey, selectedItems);

        // Call callback when selection changes
        if (onSelectionChange) {
            onSelectionChange(selectedItems);
        }
    }

    /**
     * Handle Shift+click: select range from anchor to current item
     * @param {Object} item - Current item
     * @param {Set} selectedItems - Current selection
     * @param {Object} options - Options
     */
    static handleShiftClick(item, selectedItems, options) {
        const {
            stateManager,
            selectionKey,
            anchorKey,
            getItemList
        } = options;

        if (!getItemList) {
            // If no function to get list, just add the item
            selectedItems.add(item.id);
            return;
        }

        const itemList = getItemList();
        const currentIndex = itemList.findIndex(listItem => listItem.id === item.id);

        if (currentIndex === -1) {
            // Item not found in list, just add it
            selectedItems.add(item.id);
            return;
        }

        // Get anchor
        const anchorId = stateManager.get(anchorKey);

        if (!anchorId) {
            // No anchor, set current item as anchor and select it
            selectedItems.add(item.id);
            stateManager.update({
                [anchorKey]: item.id
            });
            return;
        }

        // Find anchor in list
        const anchorIndex = itemList.findIndex(listItem => listItem.id === anchorId);

        if (anchorIndex === -1) {
            // Anchor not found, reset anchor and select current item
            selectedItems.add(item.id);
            stateManager.update({
                [anchorKey]: item.id
            });
            return;
        }

        // Select range from anchor to current item
        const startIndex = Math.min(anchorIndex, currentIndex);
        const endIndex = Math.max(anchorIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            selectedItems.add(itemList[i].id);
        }
    }

    /**
     * Handle Ctrl/Cmd+click: toggle item selection
     * @param {Object} item - Item to toggle
     * @param {Set} selectedItems - Current selection
     * @param {Object} options - Options
     */
    static handleCtrlClick(item, selectedItems, options) {
        const {
            stateManager,
            selectionKey,
            anchorKey
        } = options;

        if (selectedItems.has(item.id)) {
            selectedItems.delete(item.id);
        } else {
            selectedItems.add(item.id);
            // Update anchor to last toggled item
            stateManager.update({
                [anchorKey]: item.id
            });
        }

        // Save changes to state
        stateManager.set(selectionKey, selectedItems);
    }

    /**
     * Обработка marquee selection (выделение рамкой)
     * @param {Event} e - Событие mousedown
     * @param {Object} options - Опции marquee selection
     * @param {HTMLElement} options.container - Контейнер для marquee
     * @param {StateManager} options.stateManager - Менеджер состояния
     * @param {string} options.selectionKey - Ключ для хранения селекта
     * @param {Function} options.getSelectableItems - Функция получения селектируемых элементов
     * @param {Function} options.onSelectionChange - Callback при изменении селекта
     * @param {string} options.marqueeId - ID для marquee элемента
     * @param {string} options.mouseStateKey - Ключ для состояния мыши
     */
    static handleMarqueeMouseDown(e, options) {
        // Only left mouse button
        if (e.button !== 0) return;

        const {
            container,
            stateManager,
            selectionKey = 'selectedObjects',
            getSelectableItems,
            onSelectionChange,
            itemSelector = '[data-selectable]',
            marqueeId = 'marquee-selection',
            mouseStateKey = 'mouse.isMarqueeSelecting'
        } = options;

        // Check if any marquee selection is currently active - if so, don't start a new one
        const allMarqueeKeys = [
            'mouse.isMarqueeSelecting',
            'mouse.isAssetMarqueeSelecting',
            'mouse.isOutlinerMarqueeSelecting',
            'mouse.isLayerMarqueeSelecting'
        ];

        for (const key of allMarqueeKeys) {
            if (stateManager.get(key)) {
                return;
            }
        }

        // Also check for pending marquee state (Ctrl+drag scenarios)
        if (stateManager.get('marquee.pendingStartPos') || stateManager.get('marquee.pendingMode')) {
            return;
        }

        // Determine marquee selection mode
        let marqueeMode = 'replace'; // replace, toggle, add
        
        if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
                marqueeMode = 'add'; // Ctrl+Shift+drag = add to selection
            } else {
                marqueeMode = 'toggle'; // Ctrl+drag = toggle selection
            }
        } else if (e.shiftKey) {
            marqueeMode = 'add'; // Shift+drag = add to selection
        } else {
            marqueeMode = 'replace'; // regular drag = replace selection
        }

        // Don't start marquee on regular item dragging (without modifiers)
        const isOnItem = !!e.target.closest(itemSelector);
        if (isOnItem && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            return;
        }

        // Allow Ctrl/Cmd+click+drag on item: marquee in toggle mode

        // If Ctrl/Cmd is pressed - start delayed marquee with 4px threshold,
        // to not intercept regular Ctrl+click
        if (e.ctrlKey || e.metaKey) {
            const pendingStartPos = { x: e.clientX, y: e.clientY };
            stateManager.set('marquee.pendingStartPos', pendingStartPos);
            stateManager.set('marquee.pendingMode', marqueeMode);
            stateManager.set('marquee.pendingOptions', options);
            stateManager.set('marquee.pendingContainer', container);
            stateManager.set('marquee.pendingSelector', itemSelector);
            stateManager.set('marquee.pendingMouseKey', mouseStateKey);
            return;
        }

        // For other modes (replace/add without Ctrl) start immediately
        if (marqueeMode === 'replace') {
            stateManager.set(selectionKey, new Set());
            if (onSelectionChange) {
                onSelectionChange(new Set());
            }
        }

        const rect = container.getBoundingClientRect();
        const startPos = { x: e.clientX, y: e.clientY };
        const marqueeDiv = document.createElement('div');
        marqueeDiv.id = marqueeId;
        container.appendChild(marqueeDiv);

        marqueeDiv.style.position = 'absolute';
        marqueeDiv.style.left = `${e.clientX - rect.left + container.scrollLeft}px`;
        marqueeDiv.style.top = `${e.clientY - rect.top + container.scrollTop}px`;
        marqueeDiv.style.width = '0px';
        marqueeDiv.style.height = '0px';
        marqueeDiv.style.border = '2px dashed #3B82F6';
        marqueeDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        marqueeDiv.style.pointerEvents = 'none';
        marqueeDiv.style.zIndex = '1000';

                stateManager.set(mouseStateKey, true);
                stateManager.set('marquee.startPos', startPos);
                stateManager.set('marquee.element', marqueeDiv);
                stateManager.set('marquee.container', container);
                stateManager.set('marquee.options', options);
                stateManager.set('marquee.mode', marqueeMode);
                stateManager.set('marquee.pendingMouseKey', mouseStateKey);
    }

    /**
     * Обработка движения мыши для marquee selection
     * @param {Event} e - Событие mousemove
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static handleMarqueeMouseMove(e, stateManager) {
        // Check active marquee selection
        const mouseStateKey = stateManager.get('marquee.pendingMouseKey') || 'mouse.isMarqueeSelecting';
        if (stateManager.get(mouseStateKey)) {
            // Marquee already active - update it
            const marqueeDiv = stateManager.get('marquee.element');
            const container = stateManager.get('marquee.container');
            if (marqueeDiv && container) {
                const rect = container.getBoundingClientRect();
                const startPos = stateManager.get('marquee.startPos');

                const left = Math.min(startPos.x, e.clientX) - rect.left + container.scrollLeft;
                const top = Math.min(startPos.y, e.clientY) - rect.top + container.scrollTop;
                const width = Math.abs(e.clientX - startPos.x);
                const height = Math.abs(e.clientY - startPos.y);

                marqueeDiv.style.left = `${left}px`;
                marqueeDiv.style.top = `${top}px`;
                marqueeDiv.style.width = `${width}px`;
                marqueeDiv.style.height = `${height}px`;
            }
            return;
        }

        // If there is pending for Ctrl - activate at 4px threshold
        const pendingStartPos = stateManager.get('marquee.pendingStartPos');
        if (pendingStartPos) {
            const dxp = e.clientX - pendingStartPos.x;
            const dyp = e.clientY - pendingStartPos.y;
            const dist = Math.sqrt(dxp * dxp + dyp * dyp);
            if (dist >= 4) {
                // Activate marquee
                const container = stateManager.get('marquee.pendingContainer');
                const options = stateManager.get('marquee.pendingOptions');
                const marqueeMode = stateManager.get('marquee.pendingMode');
                const mouseStateKey = stateManager.get('marquee.pendingMouseKey') || 'mouse.isMarqueeSelecting';

                const rect = container.getBoundingClientRect();
                const marqueeDiv = document.createElement('div');
                marqueeDiv.id = options?.marqueeId || 'marquee-selection';
                container.appendChild(marqueeDiv);

                marqueeDiv.style.position = 'absolute';
                marqueeDiv.style.left = `${pendingStartPos.x - rect.left + container.scrollLeft}px`;
                marqueeDiv.style.top = `${pendingStartPos.y - rect.top + container.scrollTop}px`;
                marqueeDiv.style.width = '0px';
                marqueeDiv.style.height = '0px';
                marqueeDiv.style.border = '2px dashed #3B82F6';
                marqueeDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                marqueeDiv.style.pointerEvents = 'none';
                marqueeDiv.style.zIndex = '1000';

                stateManager.set(mouseStateKey, true);
                stateManager.set('marquee.startPos', pendingStartPos);
                stateManager.set('marquee.element', marqueeDiv);
                stateManager.set('marquee.container', container);
                stateManager.set('marquee.options', options);
                stateManager.set('marquee.mode', marqueeMode);

                // Clear pending
                stateManager.set('marquee.pendingStartPos', null);
                stateManager.set('marquee.pendingMode', null);
                stateManager.set('marquee.pendingOptions', null);
                stateManager.set('marquee.pendingContainer', null);
                stateManager.set('marquee.pendingSelector', null);
                stateManager.set('marquee.pendingMouseKey', null);
            }
        }
    }

    /**
     * Обработка отпускания мыши для marquee selection
     * @param {Event} e - Событие mouseup
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static handleMarqueeMouseUp(e, stateManager, options = {}) {
        // Reset pending if marquee wasn't activated (click with micro-movement)
        stateManager.set('marquee.pendingStartPos', null);
        stateManager.set('marquee.pendingMode', null);
        stateManager.set('marquee.pendingOptions', null);
        stateManager.set('marquee.pendingContainer', null);
        stateManager.set('marquee.pendingSelector', null);
        stateManager.set('marquee.pendingMouseKey', null);

        // Check if marquee is active using the correct state key
        const mouseStateKey = stateManager.get('marquee.pendingMouseKey') || options?.mouseStateKey || 'mouse.isMarqueeSelecting';
        if (!stateManager.get(mouseStateKey)) return;

        const marqueeDiv = stateManager.get('marquee.element');
        const container = stateManager.get('marquee.container');
        const marqueeOptions = stateManager.get('marquee.options');

        // Final selection of elements in marquee
        if (marqueeDiv && container && marqueeOptions) {
            this.finalizeMarqueeSelection(container, marqueeDiv, stateManager);
        }

        // Clean up marquee element
        if (marqueeDiv && marqueeDiv.parentNode) {
            marqueeDiv.parentNode.removeChild(marqueeDiv);
        }

        // Reset state - clear all possible marquee selection keys
        stateManager.set(mouseStateKey, false);

        // Clear all related marquee state keys
        stateManager.set('marquee.startPos', null);
        stateManager.set('marquee.element', null);
        stateManager.set('marquee.container', null);
        stateManager.set('marquee.options', null);
        stateManager.set('marquee.mode', null);

        // Clear pending state
        stateManager.set('marquee.pendingStartPos', null);
        stateManager.set('marquee.pendingMode', null);
        stateManager.set('marquee.pendingOptions', null);
        stateManager.set('marquee.pendingContainer', null);
        stateManager.set('marquee.pendingSelector', null);
        stateManager.set('marquee.pendingMouseKey', null);

        // Clear all possible active marquee selection keys
        stateManager.set('mouse.isMarqueeSelecting', false);
        stateManager.set('mouse.isAssetMarqueeSelecting', false);
        stateManager.set('mouse.isOutlinerMarqueeSelecting', false);
        stateManager.set('mouse.isLayerMarqueeSelecting', false);

        // Final selection update
        if (marqueeOptions && marqueeOptions.onSelectionChange) {
            const selectedItems = stateManager.get(marqueeOptions.selectionKey || 'selectedObjects');
            marqueeOptions.onSelectionChange(selectedItems);
        }
    }

    /**
     * Обновление подсветки элементов в marquee (только визуальная подсветка)
     * @param {HTMLElement} container - Контейнер с элементами
     * @param {HTMLElement} marqueeDiv - Marquee элемент
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static updateMarqueeSelection(container, marqueeDiv, stateManager) {
        const options = stateManager.get('marquee.options');
        if (!options || !options.getSelectableItems) return;

        const selectableItems = options.getSelectableItems();
        const marqueeRect = marqueeDiv.getBoundingClientRect();

        // Only highlight elements, without changing selection
        selectableItems.forEach(item => {
            const itemRect = item.getBoundingClientRect();
            const isIntersecting = !(
                itemRect.right < marqueeRect.left ||
                itemRect.left > marqueeRect.right ||
                itemRect.bottom < marqueeRect.top ||
                itemRect.top > marqueeRect.bottom
            );

            if (isIntersecting) {
                item.classList.add('marquee-highlighted');
            } else {
                item.classList.remove('marquee-highlighted');
            }
        });
    }

    /**
     * Финальный селект элементов в marquee при отпускании мыши
     * @param {HTMLElement} container - Контейнер с элементами
     * @param {HTMLElement} marqueeDiv - Marquee элемент
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static finalizeMarqueeSelection(container, marqueeDiv, stateManager) {
        const options = stateManager.get('marquee.options');
        if (!options || !options.getSelectableItems) return;

        const marqueeMode = stateManager.get('marquee.mode') || 'replace';
        const selectableItems = options.getSelectableItems();
        const marqueeRect = marqueeDiv.getBoundingClientRect();
        const selectedItems = new Set(stateManager.get(options.selectionKey || 'selectedObjects'));

        // Clear previous highlights
        selectableItems.forEach(item => {
            item.classList.remove('marquee-highlighted');
        });

        // Find elements intersecting with marquee
        const intersectingItems = [];
        selectableItems.forEach(item => {
            const itemRect = item.getBoundingClientRect();
            const isIntersecting = !(
                itemRect.right < marqueeRect.left ||
                itemRect.left > marqueeRect.right ||
                itemRect.bottom < marqueeRect.top ||
                itemRect.top > marqueeRect.bottom
            );

            if (isIntersecting) {
                intersectingItems.push(item.dataset.selectableId || item.dataset.assetId || item.dataset.objectId);
            }
        });

        // Apply marquee mode
        switch (marqueeMode) {
            case 'replace':
                // Replace selection with new elements
                selectedItems.clear();
                intersectingItems.forEach(id => selectedItems.add(id));
                break;

            case 'add':
                // Add elements to existing selection
                intersectingItems.forEach(id => selectedItems.add(id));
                break;

            case 'toggle':
                // Toggle elements in selection
                intersectingItems.forEach(id => {
                    if (selectedItems.has(id)) {
                        selectedItems.delete(id);
                    } else {
                        selectedItems.add(id);
                    }
                });
                break;
        }

        stateManager.set(options.selectionKey || 'selectedObjects', selectedItems);
    }

    /**
     * Обновление визуального состояния селекта
     * @param {HTMLElement} container - Контейнер с элементами
     * @param {Set} selectedItems - Выбранные элементы
     * @param {string} itemSelector - Селектор элементов для обновления
     * @param {string} selectedClass - CSS класс для выбранных элементов
     */
    static updateSelectionVisuals(container, selectedItems, itemSelector = '[data-selectable]', selectedClass = 'selected') {
        const items = container.querySelectorAll(itemSelector);
        
        items.forEach(item => {
            const itemId = item.dataset.selectableId || item.dataset.assetId || item.dataset.objectId;
            if (selectedItems.has(itemId)) {
                item.classList.add(selectedClass);
            } else {
                item.classList.remove(selectedClass);
            }
        });
    }

    /**
     * Очистка селекта
     * @param {StateManager} stateManager - Менеджер состояния
     * @param {string} selectionKey - Ключ для хранения селекта
     * @param {Function} onSelectionChange - Callback при изменении селекта
     */
    static clearSelection(stateManager, selectionKey = 'selectedObjects', onSelectionChange = null) {
        stateManager.set(selectionKey, new Set());
        if (onSelectionChange) {
            onSelectionChange(new Set());
        }
    }

    /**
     * Установка селекта одного элемента
     * @param {StateManager} stateManager - Менеджер состояния
     * @param {string} itemId - ID элемента
     * @param {string} selectionKey - Ключ для хранения селекта
     * @param {string} anchorKey - Ключ для хранения якоря
     * @param {Function} onSelectionChange - Callback при изменении селекта
     */
    static selectSingleItem(stateManager, itemId, selectionKey = 'selectedObjects', anchorKey = 'outliner.shiftAnchor', onSelectionChange = null) {
        const selectedItems = new Set([itemId]);
        stateManager.set(selectionKey, selectedItems);
        stateManager.update({
            [anchorKey]: itemId
        });
        
        if (onSelectionChange) {
            onSelectionChange(selectedItems);
        }
    }
}
