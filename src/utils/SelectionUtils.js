/**
 * SelectionUtils - Утилиты для работы с селектом элементов
 * 
 * Предоставляет общие методы для селекта элементов в панелях:
 * - Обработка кликов (обычный, Shift+клик, Ctrl+клик)
 * - Marquee selection (выделение рамкой)
 * - Управление состоянием селекта
 * - Визуальное обновление селекта
 * 
 * @author Level Designer
 * @version 3.31.0
 */

import { Logger } from './Logger.js';

export class SelectionUtils {
    /**
     * Обработка клика по элементу с поддержкой различных модификаторов
     * @param {Event} e - Событие клика
     * @param {Object} item - Элемент для селекта
     * @param {Object} options - Опции селекта
     * @param {StateManager} options.stateManager - Менеджер состояния
     * @param {string} options.selectionKey - Ключ для хранения селекта в состоянии
     * @param {string} options.anchorKey - Ключ для хранения якоря селекта
     * @param {Function} options.getItemList - Функция получения списка элементов для range selection
     * @param {Function} options.onSelectionChange - Callback при изменении селекта
     * @param {Function} options.canSelect - Функция проверки возможности селекта элемента
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

        // Проверка возможности селекта
        if (canSelect && !canSelect(item)) {
            return;
        }

        const selectedItems = new Set(stateManager.get(selectionKey));

        if (e.shiftKey) {
            // Shift+клик: селект диапазона от якоря до текущего элемента
            this.handleShiftClick(item, selectedItems, {
                stateManager,
                selectionKey,
                anchorKey,
                getItemList
            });
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+клик: переключение селекта элемента
            this.handleCtrlClick(item, selectedItems, {
                stateManager,
                selectionKey,
                anchorKey
            });
        } else {
            // Обычный клик: замена селекта и установка якоря
            selectedItems.clear();
            selectedItems.add(item.id);
            // Установка якоря для будущих shift+клик операций
            stateManager.update({
                [anchorKey]: item.id
            });
        }

        stateManager.set(selectionKey, selectedItems);

        // Вызов callback при изменении селекта
        if (onSelectionChange) {
            onSelectionChange(selectedItems);
        }
    }

    /**
     * Обработка Shift+клик: селект диапазона от якоря до текущего элемента
     * @param {Object} item - Текущий элемент
     * @param {Set} selectedItems - Текущий селект
     * @param {Object} options - Опции
     */
    static handleShiftClick(item, selectedItems, options) {
        const {
            stateManager,
            selectionKey,
            anchorKey,
            getItemList
        } = options;

        if (!getItemList) {
            // Если нет функции получения списка, просто добавить элемент
            selectedItems.add(item.id);
            return;
        }

        const itemList = getItemList();
        const currentIndex = itemList.findIndex(listItem => listItem.id === item.id);

        if (currentIndex === -1) {
            // Элемент не найден в списке, просто добавить его
            selectedItems.add(item.id);
            return;
        }

        // Получение якоря
        const anchorId = stateManager.get(anchorKey);

        if (!anchorId) {
            // Нет якоря, установить текущий элемент как якорь и выбрать его
            selectedItems.add(item.id);
            stateManager.update({
                [anchorKey]: item.id
            });
            return;
        }

        // Поиск якоря в списке
        const anchorIndex = itemList.findIndex(listItem => listItem.id === anchorId);

        if (anchorIndex === -1) {
            // Якорь не найден, сбросить якорь и выбрать текущий элемент
            selectedItems.add(item.id);
            stateManager.update({
                [anchorKey]: item.id
            });
            return;
        }

        // Выбор диапазона от якоря до текущего элемента
        const startIndex = Math.min(anchorIndex, currentIndex);
        const endIndex = Math.max(anchorIndex, currentIndex);

        for (let i = startIndex; i <= endIndex; i++) {
            selectedItems.add(itemList[i].id);
        }
    }

    /**
     * Обработка Ctrl/Cmd+клик: переключение селекта элемента
     * @param {Object} item - Элемент для переключения
     * @param {Set} selectedItems - Текущий селект
     * @param {Object} options - Опции
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
            // Обновление якоря на последний переключенный элемент
            stateManager.update({
                [anchorKey]: item.id
            });
        }

        // Сохранение изменений в состоянии
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
        // Только левая кнопка мыши
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

        // Определяем режим marquee selection
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
            marqueeMode = 'replace'; // обычный drag = replace selection
        }

        // Не запускать рамку при обычном перетаскивании элемента (без модификаторов)
        const isOnItem = !!e.target.closest(itemSelector);
        if (isOnItem && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            return;
        }

        // Разрешить Ctrl/Cmd+click+drag и по элементу: рамка в режиме toggle

        // Если Ctrl/Cmd зажат — запускаем отложенный старт рамки с порогом 4px,
        // чтобы не перехватывать обычный Ctrl+click
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

        // Для остальных режимов (replace/add без Ctrl) стартуем сразу
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
    }

    /**
     * Обработка движения мыши для marquee selection
     * @param {Event} e - Событие mousemove
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static handleMarqueeMouseMove(e, stateManager) {
        // Если есть pending для Ctrl — активируем при пороге 4px
        const pendingStartPos = stateManager.get('marquee.pendingStartPos');
        if (pendingStartPos) {
            const dxp = e.clientX - pendingStartPos.x;
            const dyp = e.clientY - pendingStartPos.y;
            const dist = Math.sqrt(dxp * dxp + dyp * dyp);
            if (dist >= 4) {
                // Активируем рамку
                const container = stateManager.get('marquee.pendingContainer');
                const options = stateManager.get('marquee.pendingOptions');
                const marqueeMode = stateManager.get('marquee.pendingMode');
                const mouseStateKey = stateManager.get('marquee.pendingMouseKey') || 'mouse.isMarqueeSelecting';

                const rect = container.getBoundingClientRect();
                const marqueeDiv = document.createElement('div');
                marqueeDiv.id = 'marquee-selection';
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

                // Очистить pending
                stateManager.set('marquee.pendingStartPos', null);
                stateManager.set('marquee.pendingMode', null);
                stateManager.set('marquee.pendingOptions', null);
                stateManager.set('marquee.pendingContainer', null);
                stateManager.set('marquee.pendingSelector', null);
                stateManager.set('marquee.pendingMouseKey', null);
            }
        }

        if (!stateManager.get('mouse.isMarqueeSelecting')) return;

        const startPos = stateManager.get('marquee.startPos');
        const marqueeDiv = stateManager.get('marquee.element');
        const container = stateManager.get('marquee.container');

        if (!startPos || !marqueeDiv || !container) return;

        const rect = container.getBoundingClientRect();
        const dx = e.clientX - startPos.x;
        const dy = e.clientY - startPos.y;

        // Обновление позиции и размера marquee
        if (dx < 0) {
            marqueeDiv.style.left = `${e.clientX - rect.left + container.scrollLeft}px`;
            marqueeDiv.style.width = `${Math.abs(dx)}px`;
        } else {
            marqueeDiv.style.width = `${dx}px`;
        }

        if (dy < 0) {
            marqueeDiv.style.top = `${e.clientY - rect.top + container.scrollTop}px`;
            marqueeDiv.style.height = `${Math.abs(dy)}px`;
        } else {
            marqueeDiv.style.height = `${dy}px`;
        }

        // Обновление селекта элементов в marquee
        this.updateMarqueeSelection(container, marqueeDiv, stateManager);
    }

    /**
     * Обработка отпускания мыши для marquee selection
     * @param {Event} e - Событие mouseup
     * @param {StateManager} stateManager - Менеджер состояния
     */
    static handleMarqueeMouseUp(e, stateManager) {
        // Сброс pending, если рамка не активировалась (клик с микросмещением)
        stateManager.set('marquee.pendingStartPos', null);
        stateManager.set('marquee.pendingMode', null);
        stateManager.set('marquee.pendingOptions', null);
        stateManager.set('marquee.pendingContainer', null);
        stateManager.set('marquee.pendingSelector', null);
        stateManager.set('marquee.pendingMouseKey', null);

        if (!stateManager.get('mouse.isMarqueeSelecting')) return;

        const marqueeDiv = stateManager.get('marquee.element');
        const container = stateManager.get('marquee.container');
        const options = stateManager.get('marquee.options');

        // Финальный селект элементов в marquee
        if (marqueeDiv && container && options) {
            this.finalizeMarqueeSelection(container, marqueeDiv, stateManager);
        }

        // Очистка marquee элемента
        if (marqueeDiv && marqueeDiv.parentNode) {
            marqueeDiv.parentNode.removeChild(marqueeDiv);
        }

        // Сброс состояния
        stateManager.set('mouse.isMarqueeSelecting', false);
        stateManager.set('marquee.startPos', null);
        stateManager.set('marquee.element', null);
        stateManager.set('marquee.container', null);
        stateManager.set('marquee.options', null);
        stateManager.set('marquee.mode', null);

        // Финальное обновление селекта
        if (options && options.onSelectionChange) {
            const selectedItems = stateManager.get(options.selectionKey || 'selectedObjects');
            options.onSelectionChange(selectedItems);
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

        // Только подсветка элементов, без изменения селекта
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

        // Очистка предыдущих подсветок
        selectableItems.forEach(item => {
            item.classList.remove('marquee-highlighted');
        });

        // Найти элементы, пересекающиеся с marquee
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

        // Применить режим marquee
        switch (marqueeMode) {
            case 'replace':
                // Заменить селект новыми элементами
                selectedItems.clear();
                intersectingItems.forEach(id => selectedItems.add(id));
                break;
                
            case 'add':
                // Добавить элементы к существующему селекту
                intersectingItems.forEach(id => selectedItems.add(id));
                break;
                
            case 'toggle':
                // Переключить элементы в селекте
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
