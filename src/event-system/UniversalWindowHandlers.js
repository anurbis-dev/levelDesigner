/**
 * Universal Window Event Handlers
 * Автоматические обработчики для всех типов окон
 */

import { Logger } from '../utils/Logger.js';

export class UniversalWindowHandlers {
    /**
     * Создает универсальные обработчики для любого окна
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна ('settings', 'actor-properties', 'universal-dialog')
     * @returns {Object} Конфигурация обработчиков
     */
    static createUniversalHandlers(windowInstance, windowType) {
        return {
            // Обработчики диалога
            onEscape: () => {
                Logger.ui.debug(`UniversalWindowHandlers: ESC pressed for ${windowType}`);
                UniversalWindowHandlers.handleEscape(windowInstance, windowType);
            },
            
            onOverlayClick: (e) => {
                if (e.target === e.currentTarget) {
                    Logger.ui.debug(`UniversalWindowHandlers: Overlay clicked for ${windowType}`);
                    UniversalWindowHandlers.handleOverlayClick(windowInstance, windowType);
                }
            },
            
            onClick: (e) => {
                UniversalWindowHandlers.handleClick(e, windowInstance, windowType);
            },
            
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
            }
        };
    }

    /**
     * Обработка нажатия ESC
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     */
    static handleEscape(windowInstance, windowType) {
        Logger.ui.info(`UniversalWindowHandlers: ESC pressed for ${windowType}, instance: ${windowInstance ? 'found' : 'not found'}`);

        // Special handling for UniversalDialog - let the dialog handle ESC
        if (windowType === 'universal-dialog') {
            // Dialog handles ESC through EventHandlerManager
            return;
        }

        // Check if window is visible before closing
        if (windowInstance && windowInstance.isVisible === false) {
            Logger.ui.debug(`UniversalWindowHandlers: Window ${windowType} is not visible, ignoring ESC`);
            return;
        }

        // Универсальные методы закрытия
        if (typeof windowInstance.cancel === 'function') {
            windowInstance.cancel();
        } else if (typeof windowInstance.hide === 'function') {
            windowInstance.hide();
        } else if (typeof windowInstance.close === 'function') {
            windowInstance.close();
        } else {
            Logger.ui.warn(`UniversalWindowHandlers: No close method found for ${windowType}`);
        }
    }



    /**
     * Обработка клика по overlay
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     */
    static handleOverlayClick(windowInstance, windowType) {
        // Special handling for UniversalDialog - let the dialog handle overlay clicks
        if (windowType === 'universal-dialog') {
            // Dialog handles overlay clicks through EventHandlerManager
            return;
        }

        // Универсальные методы закрытия
        if (typeof windowInstance.cancel === 'function') {
            windowInstance.cancel();
        } else if (typeof windowInstance.hide === 'function') {
            windowInstance.hide();
        } else if (typeof windowInstance.close === 'function') {
            windowInstance.close();
        } else {
            Logger.ui.warn(`UniversalWindowHandlers: No close method found for ${windowType}`);
        }
    }

    /**
     * Обработка кликов внутри окна
     * @param {Event} e - Событие клика
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     */
    static handleClick(e, windowInstance, windowType) {
        const target = e.target;
        const targetId = target.id;
        const targetClass = target.className;
        
        Logger.ui.debug(`UniversalWindowHandlers: Click on ${targetId || targetClass} in ${windowType}`);

        // Special handling for UniversalDialog - let the dialog handle its own buttons
        if (windowType === 'universal-dialog') {
            // Dialog handles its own button clicks through EventHandlerManager
            return;
        }

        // Универсальные обработчики кнопок
        if (target.tagName === 'BUTTON') {
            UniversalWindowHandlers.handleButtonClick(target, windowInstance, windowType, e);
        }
        
        // Обработка закрытия по кнопке
        if (targetClass.includes('close') || targetClass.includes('cancel') || targetId.includes('close') || targetId.includes('cancel')) {
            UniversalWindowHandlers.handleEscape(windowInstance, windowType);
        }
        
        // Обработка применения/сохранения
        if (targetClass.includes('apply') || targetClass.includes('save') || targetId.includes('apply') || targetId.includes('save')) {
            UniversalWindowHandlers.handleApply(windowInstance, windowType);
        }
    }

    /**
     * Обработка клика по кнопке
     * @param {HTMLElement} button - Элемент кнопки
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     * @param {Event} event - Событие клика (опционально)
     */
    static handleButtonClick(button, windowInstance, windowType, event = null) {
        const buttonId = button.id;
        const buttonClass = button.className;
        
        Logger.ui.debug(`UniversalWindowHandlers: Button clicked: ${buttonId} in ${windowType}`);

        // Универсальные обработчики кнопок
        if (buttonId.includes('cancel') || buttonClass.includes('cancel')) {
            UniversalWindowHandlers.handleEscape(windowInstance, windowType);
        } else if (buttonId.includes('apply') || buttonId.includes('save') || buttonClass.includes('apply') || buttonClass.includes('save')) {
            UniversalWindowHandlers.handleApply(windowInstance, windowType);
        } else {
        // Специфичные обработчики для разных типов окон
        if (windowType === 'asset-panel' && windowInstance) {
            UniversalWindowHandlers.handleAssetPanelButton(button, windowInstance);
        } else if (windowType === 'layers-panel' && windowInstance) {
            UniversalWindowHandlers.handleLayersPanelButton(button, windowInstance, event);
        } else if (windowType === 'actor-properties' && windowInstance) {
            UniversalWindowHandlers.handleActorPropertiesButton(button, windowInstance);
        } else {
                // Попытка вызвать специфичный обработчик
                const methodName = `handle${buttonId.charAt(0).toUpperCase() + buttonId.slice(1)}Click`;
                if (typeof windowInstance[methodName] === 'function') {
                    windowInstance[methodName](button);
                } else {
                    Logger.ui.debug(`UniversalWindowHandlers: No specific handler for button ${buttonId}`);
                }
            }
        }
    }

    /**
     * Обработка кнопок AssetPanel
     * @param {HTMLElement} button - Элемент кнопки
     * @param {Object} assetPanel - Экземпляр AssetPanel
     */
    static handleAssetPanelButton(button, assetPanel) {
        const buttonId = button.id;
        
        // Обработка специфичных кнопок AssetPanel
        if (buttonId === 'asset-size-decrease') {
            if (typeof assetPanel.decreaseAssetSize === 'function') {
                assetPanel.decreaseAssetSize();
            }
        } else if (buttonId === 'asset-size-increase') {
            if (typeof assetPanel.increaseAssetSize === 'function') {
                assetPanel.increaseAssetSize();
            }
        } else if (buttonId === 'asset-view-grid') {
            if (typeof assetPanel.setViewMode === 'function') {
                assetPanel.setViewMode('grid');
            }
        } else if (buttonId === 'asset-view-list') {
            if (typeof assetPanel.setViewMode === 'function') {
                assetPanel.setViewMode('list');
            }
        } else if (buttonId === 'asset-view-details') {
            if (typeof assetPanel.setViewMode === 'function') {
                assetPanel.setViewMode('details');
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown AssetPanel button: ${buttonId}`);
        }
    }

    /**
     * Обработка кнопок ActorPropertiesWindow
     * @param {HTMLElement} button - Элемент кнопки
     * @param {Object} actorPropertiesWindow - Экземпляр ActorPropertiesWindow
     */
    static handleActorPropertiesButton(button, actorPropertiesWindow) {
        const buttonId = button.id;

        // Обработка специфичных кнопок ActorPropertiesWindow
        if (buttonId === 'actor-props-cancel') {
            if (typeof actorPropertiesWindow.cancel === 'function') {
                actorPropertiesWindow.cancel();
            }
        } else if (buttonId === 'actor-props-apply') {
            if (typeof actorPropertiesWindow.apply === 'function') {
                actorPropertiesWindow.apply();
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown ActorPropertiesWindow button: ${buttonId}`);
        }
    }

    /**
     * Обработка кнопок LayersPanel
     * @param {HTMLElement} button - Элемент кнопки
     * @param {Object} layersPanel - Экземпляр LayersPanel
     * @param {Event} event - Событие клика (опционально)
     */
    static handleLayersPanelButton(button, layersPanel, event = null) {
        const buttonId = button.id;

        // Обработка специфичных кнопок LayersPanel
        if (buttonId === 'add-layer-btn') {
            if (typeof layersPanel.onAddLayer === 'function') {
                layersPanel.onAddLayer(event);
            } else {
                Logger.ui.debug(`UniversalWindowHandlers: add-layer-btn clicked, but no handler found`);
            }
        } else if (buttonId === 'layers-search-clear') {
            if (typeof layersPanel.clearSearch === 'function') {
                layersPanel.clearSearch();
            } else {
                Logger.ui.debug(`UniversalWindowHandlers: layers-search-clear clicked, but no handler found`);
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown LayersPanel button: ${buttonId}`);
        }
    }

    /**
     * Обработка полей ввода LayersPanel
     * @param {HTMLElement} input - Элемент поля ввода
     * @param {Object} layersPanel - Экземпляр LayersPanel
     */
    static handleLayersPanelInput(input, layersPanel) {
        const inputId = input.id;

        // Обработка специфичных полей ввода LayersPanel
        if (inputId === 'layers-search') {
            if (typeof layersPanel.handleSearch === 'function') {
                layersPanel.handleSearch(input.value);
            } else {
                Logger.ui.debug(`UniversalWindowHandlers: layers-search input changed, but no handler found`);
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown LayersPanel input: ${inputId}`);
        }
    }

    /**
     * Обработка применения/сохранения
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     */
    static handleApply(windowInstance, windowType) {
        // Универсальные методы применения
        if (typeof windowInstance.apply === 'function') {
            windowInstance.apply();
        } else if (typeof windowInstance.save === 'function') {
            windowInstance.save();
        } else if (typeof windowInstance.saveSettings === 'function') {
            windowInstance.saveSettings();
        } else {
            Logger.ui.warn(`UniversalWindowHandlers: No apply method found for ${windowType}`);
        }
    }

    /**
     * Создает обработчики для полей ввода
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     * @returns {Object} Обработчики для полей ввода
     */
    static createInputHandlers(windowInstance, windowType) {
        return {
            onChange: (e) => {
                UniversalWindowHandlers.handleInputChange(e, windowInstance, windowType);
            },
            
            onKeyDown: (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    UniversalWindowHandlers.handleApply(windowInstance, windowType);
                }
            }
        };
    }

    /**
     * Обработка изменений в полях ввода
     * @param {Event} e - Событие изменения
     * @param {Object} windowInstance - Экземпляр окна
     * @param {string} windowType - Тип окна
     */
    static handleInputChange(e, windowInstance, windowType) {
        const input = e.target;
        const inputId = input.id;
        
        Logger.ui.debug(`UniversalWindowHandlers: Input changed: ${inputId} in ${windowType}`);

        // Специфичные обработчики для разных типов окон
        if (windowType === 'asset-panel' && windowInstance) {
            UniversalWindowHandlers.handleAssetPanelInput(input, windowInstance);
        } else if (windowType === 'layers-panel' && windowInstance) {
            UniversalWindowHandlers.handleLayersPanelInput(input, windowInstance);
        } else if (windowType === 'actor-properties' && windowInstance) {
            UniversalWindowHandlers.handleActorPropertiesInput(input, windowInstance);
        } else {
            // Попытка вызвать специфичный обработчик
            if (typeof windowInstance.onInputChange === 'function') {
                windowInstance.onInputChange(e);
            } else if (typeof windowInstance.handleInputChange === 'function') {
                windowInstance.handleInputChange(e);
            } else {
                // Универсальная обработка - просто логируем
                Logger.ui.debug(`UniversalWindowHandlers: No specific input handler for ${inputId}`);
            }
        }
    }

    /**
     * Обработка полей ввода AssetPanel
     * @param {HTMLElement} input - Элемент поля ввода
     * @param {Object} assetPanel - Экземпляр AssetPanel
     */
    static handleAssetPanelInput(input, assetPanel) {
        const inputId = input.id;
        
        // Обработка специфичных полей ввода AssetPanel
        if (inputId === 'asset-search') {
            if (typeof assetPanel.handleSearch === 'function') {
                assetPanel.handleSearch(input.value);
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown AssetPanel input: ${inputId}`);
        }
    }

    /**
     * Обработка полей ввода ActorPropertiesWindow
     * @param {HTMLElement} input - Элемент поля ввода
     * @param {Object} actorPropertiesWindow - Экземпляр ActorPropertiesWindow
     */
    static handleActorPropertiesInput(input, actorPropertiesWindow) {
        const inputId = input.id;
        
        // Обработка специфичных полей ввода ActorPropertiesWindow
        if (inputId.startsWith('actor-')) {
            // Для полей actor-* просто отмечаем изменения
            if (typeof actorPropertiesWindow.onInputChange === 'function') {
                actorPropertiesWindow.onInputChange(input);
            } else {
                // Универсальная обработка - отмечаем изменения
                actorPropertiesWindow.hasChanges = true;
                if (typeof actorPropertiesWindow.updateApplyButton === 'function') {
                    actorPropertiesWindow.updateApplyButton();
                }
            }
        } else {
            Logger.ui.debug(`UniversalWindowHandlers: Unknown ActorPropertiesWindow input: ${inputId}`);
        }
    }

    /**
     * Создает универсальные обработчики для контекстных меню
     * @param {Object} contextMenuInstance - Экземпляр контекстного меню
     * @param {string} menuType - Тип контекстного меню
     * @returns {Object} Конфигурация обработчиков
     */
    static createContextMenuHandlers(contextMenuInstance, menuType) {
        return {
            // Обработчики контекстного меню
            onClick: (e) => {
                Logger.ui.debug(`UniversalWindowHandlers: Context menu click for ${menuType}`);
                UniversalWindowHandlers.handleContextMenuClick(e, contextMenuInstance, menuType);
            },
            
            onContextMenu: (e) => {
                e.preventDefault();
                e.stopPropagation();
                Logger.ui.debug(`UniversalWindowHandlers: Context menu context menu event for ${menuType}`);
            },
            
            onMouseEnter: (e) => {
                Logger.ui.debug(`UniversalWindowHandlers: Context menu mouse enter for ${menuType}`);
            },
            
            onMouseLeave: (e) => {
                Logger.ui.debug(`UniversalWindowHandlers: Context menu mouse leave for ${menuType}`);
                UniversalWindowHandlers.handleContextMenuMouseLeave(e, contextMenuInstance, menuType);
            }
        };
    }

    /**
     * Обработка кликов в контекстном меню
     * @param {Event} e - Событие клика
     * @param {Object} contextMenuInstance - Экземпляр контекстного меню
     * @param {string} menuType - Тип контекстного меню
     */
    static handleContextMenuClick(e, contextMenuInstance, menuType) {
        const target = e.target;
        const menuItem = target.closest('.base-context-menu-item');
        
        if (menuItem && !menuItem.classList.contains('disabled')) {
            Logger.ui.debug(`UniversalWindowHandlers: Menu item clicked in ${menuType}`, menuItem);
            
            // If we have an instance, let it handle the click
            if (contextMenuInstance && typeof contextMenuInstance.handleMenuItemClick === 'function') {
                const result = contextMenuInstance.handleMenuItemClick(menuItem, contextMenuInstance.lastContextData);
                if (result !== false && typeof contextMenuInstance.hideMenu === 'function') {
                    contextMenuInstance.hideMenu();
                }
            } else {
                // Handle case when no context menu instance is found
                Logger.ui.warn(`UniversalWindowHandlers: No context menu instance found for ${menuType}`);
                
                // Fallback: try to find the menu item's action
                const action = menuItem.dataset.action;
                if (action) {
                    Logger.ui.debug(`UniversalWindowHandlers: Executing action ${action} for ${menuType}`);
                    // Could implement generic action handling here
                }
                
                // Try to hide the menu by finding it in the DOM
                const contextMenu = target.closest('.context-menu, .base-context-menu');
                if (contextMenu) {
                    contextMenu.style.display = 'none';
                    contextMenu.classList.remove('visible');
                }
            }
        }
    }

    /**
     * Обработка mouse leave в контекстном меню
     * @param {Event} e - Событие mouse leave
     * @param {Object} contextMenuInstance - Экземпляр контекстного меню
     * @param {string} menuType - Тип контекстного меню
     */
    static handleContextMenuMouseLeave(e, contextMenuInstance, menuType) {
        Logger.ui.debug(`UniversalWindowHandlers: Mouse left context menu ${menuType}`);
        
        // If we have an instance, let it handle the mouse leave
        if (contextMenuInstance && typeof contextMenuInstance.hideMenu === 'function') {
            Logger.ui.debug(`UniversalWindowHandlers: Calling hideMenu for ${menuType}`);
            contextMenuInstance.hideMenu();
        } else {
            Logger.ui.warn(`UniversalWindowHandlers: No hideMenu method found for ${menuType}`);
        }
    }
}
