/**
 * Auto Event Handler Manager
 * Автоматическая система регистрации обработчиков для всех окон
 */

import { Logger } from '../utils/Logger.js';
import { eventHandlerManager } from './EventHandlerManager.js';
import { UniversalWindowHandlers } from '../handlers/UniversalWindowHandlers.js';

export class AutoEventHandlerManager {
    constructor() {
        this.registeredWindows = new Map(); // Map<windowId, { instance, type, handlers }>
        this.observer = null;
        this.initialized = false;
        Logger.event.info('🔄 Auto Event Handler Manager created');
    }

    /**
     * Инициализация AutoEventHandlerManager после загрузки DOM
     */
    init() {
        if (this.initialized) return;

        this.initialized = true;
        this.setupAutoRegistration();
        Logger.event.info('🔄 Auto Event Handler Manager initialized');
    }

    /**
     * Настройка автоматической регистрации обработчиков
     */
    setupAutoRegistration() {
        // Используем MutationObserver для отслеживания новых окон
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.checkForNewWindow(node);
                    }
                });
            });
        });

        // Начинаем наблюдение за изменениями в DOM
        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        Logger.event.debug('AutoEventHandlerManager: Auto-registration observer started');
    }

    /**
     * Проверка нового элемента на наличие окон
     * @param {HTMLElement} element - Проверяемый элемент
     */
    checkForNewWindow(element) {
        // Проверяем, является ли элемент окном
        const windowInfo = this.detectWindowType(element);
        if (windowInfo) {
            Logger.event.info(`AutoEventHandlerManager: Found window ${element.id} of type ${windowInfo.type}, instance: ${windowInfo.instance ? 'found' : 'not found'}`);
            this.registerWindowAutomatically(element, windowInfo);
        }

        // Проверяем дочерние элементы
        const childWindows = element.querySelectorAll('[id*="overlay"], [id*="dialog"], [id*="window"]');
        childWindows.forEach(child => {
            const childWindowInfo = this.detectWindowType(child);
            if (childWindowInfo) {
                Logger.event.debug(`AutoEventHandlerManager: Found child window ${child.id} of type ${childWindowInfo.type}`);
                this.registerWindowAutomatically(child, childWindowInfo);
            }
        });
    }

    /**
     * Определение типа окна по элементу
     * @param {HTMLElement} element - Элемент для проверки
     * @returns {Object|null} Информация о типе окна или null
     */
    detectWindowType(element) {
        const id = element.id;
        const className = element.className;
        
        Logger.event.debug(`AutoEventHandlerManager: Checking element ${id} with class ${className}`);
        
        // Проверяем по ID и классам
        const windowTypes = [
            { id: 'settings-overlay', class: 'settings-panel-container', type: 'settings', instance: 'SettingsPanel' },
            { id: 'actor-properties-overlay', class: 'actor-properties-container', type: 'actor-properties', instance: 'ActorPropertiesWindow' },
            { id: 'universal-dialog-overlay', class: 'universal-dialog', type: 'universal-dialog', instance: 'UniversalDialog' },
            { id: 'asset-panel-container', class: 'asset-panel-container', type: 'asset-panel', instance: 'AssetPanel' }
        ];
        
        for (const windowType of windowTypes) {
            if (id === windowType.id || className.includes(windowType.class)) {
                Logger.event.info(`AutoEventHandlerManager: Detected window type ${windowType.type} for element ${id}`);
                return { type: windowType.type, instance: this.findWindowInstance(windowType.instance) };
            }
        }
        
        return null;
    }

    /**
     * Поиск экземпляра окна в глобальных объектах
     * @param {string} windowType - Тип окна
     * @returns {Object|null} Экземпляр окна или null
     */
    findWindowInstance(windowType) {
        if (!window.editor) {
            Logger.event.warn(`AutoEventHandlerManager: window.editor not found for ${windowType}`);
            return null;
        }
        
        const instanceMap = {
            'SettingsPanel': 'settingsPanel',
            'ActorPropertiesWindow': 'actorPropertiesWindow',
            'AssetPanel': 'assetPanel',
            'UniversalDialog': null // Создается динамически
        };
        
        const propertyName = instanceMap[windowType];
        const instance = propertyName ? window.editor[propertyName] : null;
        
        if (instance) {
            Logger.event.info(`AutoEventHandlerManager: Found instance ${propertyName} for ${windowType}`);
        } else {
            Logger.event.warn(`AutoEventHandlerManager: No instance found for ${windowType} (property: ${propertyName})`);
        }
        
        return instance;
    }


    /**
     * Автоматическая регистрация окна
     * @param {HTMLElement} element - Элемент окна
     * @param {Object} windowInfo - Информация о типе окна
     */
    registerWindowAutomatically(element, windowInfo) {
        const { type, instance } = windowInfo;
        const windowId = element.id || `auto-window-${Date.now()}`;

        Logger.event.debug(`AutoEventHandlerManager: Registering window ${windowId} of type ${type}, instance: ${instance ? 'found' : 'not found'}`);

        // Проверяем, не зарегистрировано ли уже
        if (this.registeredWindows.has(windowId)) {
            Logger.event.debug(`AutoEventHandlerManager: Window ${windowId} already registered`);
            return;
        }

        // Если экземпляр не найден, сохраняем окно для регистрации позже
        if (!instance) {
            Logger.event.debug(`AutoEventHandlerManager: Instance not found for ${windowId}, will register later`);
            this.registeredWindows.set(windowId, {
                instance: null,
                type,
                handlers: null,
                element,
                pending: true
            });
            return;
        }

        // Создаем универсальные обработчики
        const handlers = UniversalWindowHandlers.createUniversalHandlers(instance, type);
        
        // Регистрируем в EventHandlerManager
        try {
            eventHandlerManager.registerElement(
                element,
                'dialog',
                {
                    handlers: {
                        click: handlers.onClick,
                        contextmenu: handlers.onContextMenu
                    },
                    context: instance || this,
                    globalHandlers: {
                        keydown: (e) => {
                            if (e.key === 'Escape') {
                                handlers.onEscape();
                            }
                        },
                        overlayClick: handlers.onOverlayClick
                    }
                },
                windowId
            );

            // Сохраняем информацию о зарегистрированном окне
            this.registeredWindows.set(windowId, {
                instance,
                type,
                handlers,
                element,
                pending: false
            });

            Logger.event.info(`AutoEventHandlerManager: Window ${windowId} (${type}) registered automatically`);

            // Добавляем обработчики для полей ввода
            this.setupInputHandlers(element, instance, type);

        } catch (error) {
            Logger.event.error(`AutoEventHandlerManager: Failed to register window ${windowId}:`, error);
        }
    }

    /**
     * Настройка обработчиков для полей ввода
     * @param {HTMLElement} element - Элемент окна
     * @param {Object} instance - Экземпляр окна
     * @param {string} type - Тип окна
     */
    setupInputHandlers(element, instance, type) {
        const inputs = element.querySelectorAll('input, textarea, select');
        
        inputs.forEach((input, index) => {
            const inputId = input.id || `auto-input-${Date.now()}-${index}`;
            const inputHandlers = UniversalWindowHandlers.createInputHandlers(instance, type);
            
            try {
                eventHandlerManager.registerElement(
                    input,
                    'input',
                    {
                        handlers: inputHandlers,
                        context: instance || this
                    },
                    inputId
                );
            } catch (error) {
                Logger.event.warn(`AutoEventHandlerManager: Failed to register input ${inputId}:`, error);
            }
        });
    }


    /**
     * Отмена регистрации окна
     * @param {string} windowId - ID окна
     */
    unregisterWindow(windowId) {
        if (this.registeredWindows.has(windowId)) {
            const windowInfo = this.registeredWindows.get(windowId);
            
            // Удаляем из EventHandlerManager
            eventHandlerManager.unregisterElement(windowId);
            
            // Удаляем из нашего списка
            this.registeredWindows.delete(windowId);
            
            Logger.event.info(`AutoEventHandlerManager: Window ${windowId} unregistered`);
        }
    }

    /**
     * Регистрация отложенных окон (когда экземпляр становится доступен)
     */
    registerPendingWindows() {
        for (const [windowId, windowInfo] of this.registeredWindows) {
            if (windowInfo.pending) {
                // Попробуем найти экземпляр снова через detectWindowType
                const windowTypeInfo = this.detectWindowType(windowInfo.element);
                const instance = windowTypeInfo ? windowTypeInfo.instance : null;
                if (instance) {
                    Logger.event.debug(`AutoEventHandlerManager: Found instance for pending window ${windowId}`);
                    
                    // Создаем универсальные обработчики
                    const handlers = UniversalWindowHandlers.createUniversalHandlers(instance, windowInfo.type);
                    
                    // Регистрируем в EventHandlerManager
                    try {
                        eventHandlerManager.registerElement(
                            windowInfo.element,
                            'dialog',
                            {
                                handlers: {
                                    click: handlers.onClick,
                                    contextmenu: handlers.onContextMenu
                                },
                                context: instance,
                                globalHandlers: {
                                    keydown: (e) => {
                                        if (e.key === 'Escape') {
                                            handlers.onEscape();
                                        }
                                    },
                                    overlayClick: handlers.onOverlayClick
                                }
                            },
                            windowId
                        );

                        // Обновляем информацию о зарегистрированном окне
                        windowInfo.instance = instance;
                        windowInfo.handlers = handlers;
                        windowInfo.pending = false;

                        Logger.event.info(`AutoEventHandlerManager: Pending window ${windowId} (${windowInfo.type}) registered`);

                        // Добавляем обработчики для полей ввода
                        this.setupInputHandlers(windowInfo.element, instance, windowInfo.type);

                    } catch (error) {
                        Logger.event.error(`AutoEventHandlerManager: Failed to register pending window ${windowId}:`, error);
                    }
                }
            }
        }
    }

    /**
     * Получение информации о зарегистрированных окнах
     * @returns {Array} Список зарегистрированных окон
     */
    getRegisteredWindows() {
        return Array.from(this.registeredWindows.entries()).map(([id, info]) => ({
            id,
            type: info.type,
            instance: info.instance,
            element: info.element,
            pending: info.pending
        }));
    }

    /**
     * Очистка всех обработчиков
     */
    destroy() {
        // Останавливаем наблюдение
        if (this.observer) {
            this.observer.disconnect();
        }

        // Удаляем все зарегистрированные окна
        this.registeredWindows.forEach((_, windowId) => {
            this.unregisterWindow(windowId);
        });

        Logger.event.info('🔄 Auto Event Handler Manager destroyed');
    }
}

// Создаем глобальный экземпляр
export const autoEventHandlerManager = new AutoEventHandlerManager();
