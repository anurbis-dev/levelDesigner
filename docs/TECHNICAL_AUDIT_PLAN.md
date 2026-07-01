# Технический аудит v3.54.4 — план исправлений

Создано: 2026-06-30. Источник: тройной параллельный аудит (CodeMaster/архитектура, PerformanceOptimizer/производительность, BugHunter/баги).
Статус выполнения отмечается по ходу работы. Каждый пункт проверяется в браузере (chrome-devtools MCP) перед отметкой ✅, если затрагивает рантайм-поведение.

Легенда: ⬜ не начато · 🔄 в работе · ✅ исправлено и проверено · ⏭️ пропущено (с обоснованием)

**Примечание по верификации:** chrome-devtools MCP недоступен в этой сессии (стабильно возвращает "browser already running" без lock-файла в профиле — проблема на стороне MCP-сервера). Верификация поведенческих изменений проводится тщательным статическим ревью (полное чтение затронутого кода и всех call site'ов) вместо live-теста в браузере. Финальный ручной regression-прогон в браузере рекомендуется пользователю перед активным использованием.

## 🔴 Критично — риск краша/потери данных

- ✅ **C1.** Undo после потери фокуса drag не синхронизирует данные — исправлено: `MouseHandlers.js:537` теперь вызывает `this.editor.historyOperations.undo()` (полный restore с rebuild индексов/выборки) вместо низкоуровневого `historyManager.undo()`.
- ✅ **C2.** Drag редактируемой группы в саму себя → бесконечная рекурсия — исправлено: добавлен guard в `MouseHandlers.js` (`dragSelectedObjects`), запрещающий перетаскивание группы в саму себя или в собственного потомка (`wouldCreateCycle` проверка через `isObjectInGroupRecursive`).

## 🟠 Высокая серьёзность

### Производительность
- ⏭️ **H1.** `HistoryManager.saveState()` полный `JSON.stringify` на каждый drag — **descoped**: полноценная переделка на delta-based историю требует переписывания ядра undo/redo без тестового покрытия и живой браузерной проверки в этой сессии — риск тихой порчи данных пользователя сочтён неприемлемым для безнадзорного прохода. Зафиксировано как отдельная задача на будущее с проектированием и тестами.
- ✅ **H2.** `RenderOperations.render()` — `.slice().sort()` теперь считается один раз и кэшируется вместе с `visibleObjectsCache` (та же инвалидация по camera/zIndex/layer), а не на каждый `render()`.
- ✅ **H3.** Глобальный mousemove во время marquee — добавлен throttle (`_throttledGlobalMouseMove`, тот же `PERFORMANCE.MOUSE_MOVE_THROTTLE_MS`, что и у обычного mousemove).
- 🔄 **H4.** `AssetPanel` полный снос DOM-грида — см. ниже, в работе.

### Баги
- ✅ **H5.** Escape во время pending-marquee-click — исправлено: `marqueePendingStartPos` добавлен в `hasActiveProcess` в `EventHandlers.js:handleKeyDown`, теперь маршрутизируется в `cancelAllActions()`, который уже корректно чистит pending-state.
- ✅ **H6.** Потеря фокуса окна (Alt-Tab) во время drag/marquee — добавлен `MouseHandlers.handleWindowBlur()`, вызывается из существующего `visibilitychange`-обработчика в `LevelEditor.js` при `document.hidden`: финализирует marquee, откатывает незавершённый drag, сбрасывает флаги кнопок мыши.

### Архитектура
- ✅ **H7.** `SettingsPanel` не наследует `BaseDialog` — **частично, безопасным способом**: полное переключение на `extends BaseDialog` descoped (потребовало бы переноса кастомной табовой структуры/header/footer SettingsPanel на generic config-driven систему BaseDialog — большой рефактор 1274-строчного файла без возможности живой проверки в браузере). Вместо этого устранена сама дублированная логика, на которую жаловался аудит: добавлен `DialogResizer.applyCalculatedWidth()` (новый статический метод в уже существующем общем для обоих классов утилитном файле), теперь `BaseDialog.updateDialogSize()` и `SettingsPanel.updateDialogSize()` используют один и тот же код вместо двух копий.
- ⏭️ **H8.** `LayersPanel` без `SelectionUtils` — **отклонено как ложное срабатывание после проверки кода**: `handleLayerClick` в LayersPanel.js не делает row-multi-select слоёв (там нет `selectedLayers`/мульти-выбора строк слоёв вообще). Ctrl+click/Ctrl+Shift+click на слое управляют ОБЪЕКТАМИ канвы через `selectAllObjectsInLayer`/`addAllObjectsInLayerToSelection` — это намеренная, отдельно спроектированная фича (добавлена в v3.54.3 по CHANGELOG: "Shift+Ctrl+click - добавлен функционал добавления всех объектов слоя к текущему селекту"), а не row-selection в духе Outliner/AssetPanel. `SelectionUtils`/`BasePanel.handleItemClick` спроектированы для другой задачи (выбор строк-элементов списка) и механическая миграция сломала бы существующий, недавно реализованный функционал. Корневой аудит был основан на поверхностном паттерн-матчинге ("не использует SelectionUtils"), не на анализе семантики.
- ✅ **H9.** `console.log` в `BaseContextMenu` (5 мест) и hot-path `LevelEditor.updateAllPanels()` (включая дорогой `new Error().stack`) — удалены/заменены на `Logger.ui.debug`. Заодно вычищен `OutlinerPanel.render()`.

## 🟡 Средняя серьёзность

- ✅ **M1.** `CacheManager` неограниченные кэши — исправлено: `newLevel()` и `openLevel()` в `LevelFileOperations.js` теперь вызывают `editor.clearCaches()` перед `stateManager.reset()`, освобождая объекты предыдущего уровня из трёх unbounded Map-кэшей.
- ✅ **M2.** Тройная регистрация `global mouseup`/`mousedown`/`mousemove` — исправлено попутно при H6: удалены избыточные регистрации `global-mouse-document` и `global-mouse-window`, оставлена единственная на `window` (подтверждено по образцу `BasePanel`, который тоже использует только `window`).
- ✅ **M3.** `OutlinerPanel` Duplicate-заглушка — исправлено: `handleDuplicateObject()` теперь устанавливает `selectedObjects = {object.id}` и вызывает `levelEditor.duplicateSelectedObjects()`, делегируя в существующий `DuplicateOperations`.
- ✅ **M4.** `newLevel()`/`openLevel()` не блокируют активный drag — исправлено: добавлен `_hasActiveMouseOperation()` guard в начале обоих методов.
- ✅ **M5.** Мёртвые `test*()` методы в `LevelEditor.js` — удалены (6 методов, ~115 строк, ноль callers, нет ассертов).
- ⏭️ **M6.** Per-object `ctx.save()/restore()` без батчинга — descoped: требует реструктуризации цикла рендеринга selection/boundaries без браузерной проверки; риск визуальных регрессий неприемлем.
- ⏭️ **M7.** `CacheManager.getSelectableObjectsInViewport` без spatial index — descoped: требует переписывания cache path, высокий риск без тестов.
- ⏭️ **M8.** `effectiveLayerCache` полная очистка — descoped: selective invalidation требует point-map objects→layers, высокий риск.
- ⏭️ **M9.** `buildSpatialIndex()` многократный пересбор — descoped: debounce внутри drag-цикла без знания точных timing-инвариантов опасен.

## 🟢 Низкая / гигиена

- ✅ **L1.** `FoldersPanel.destroy()`/`AssetPanel.destroy()` — добавлен `this.subscriptions[]` паттерн по образцу `LayersPanel`: все 4 subscribe-вызова в AssetPanel и 2 в FoldersPanel теперь сохраняют unsubscribe-функции и вызывают их в `destroy()`.
- ✅ **L2.** Escape-listener в color picker слоя — исправлено: хранится ссылка на handler, явное `removeEventListener` во всех трёх путях закрытия (change/blur/Escape). Заодно `change`-обработчик теперь вызывает общий `cleanup()`.
- ✅ **L3.** `MenuManager`/`ParallaxRenderer` мёртвый fallback — удалён.
- ✅ **L4.** Документация Logger — исправлены числа: 17→29 в `DEVELOPMENT_GUIDE.md`, 19→29 в `ARCHITECTURE.md`.
- ✅ **L5.** `console.log` sweep по проекту — вычищены в `AssetImporter.js`, `DetailsPanel.js`, `DialogSizeManager.js` (добавлен Logger import), `BaseContextMenu.js`, `OutlinerPanel.js`, `LevelEditor.js` (hot-path updateAllPanels + stack trace capture), `MenuManager.js`, `ParallaxRenderer.js`.

## 🟢 Низкая / гигиена

- ⬜ **L1.** Утечки подписок в `FoldersPanel.destroy()`/`AssetPanel.destroy()` — не начато.
- ⬜ **L2.** Несинхронизированный Escape-listener в color picker слоя — не начато.
- ✅ **L3.** `MenuManager`/`ParallaxRenderer` мёртвый console-fallback — удалён, теперь напрямую `Logger.menu`/`Logger.parallax`.
- ⬜ **L4.** Документация расходится по числу категорий Logger — не начато.
- ✅ **L5.** Остальные `console.log`: `AssetImporter.js` (9→0, дублировали соседние `Logger.asset.*`), `DetailsPanel.js` (1, неинформативная debug-строка удалена), `DialogSizeManager.js` (1, заменён на `Logger.ui.warn`, добавлен импорт Logger). Проверены и оставлены как есть: `Logger.js` (это сам sink логгера — корректно), README.md/JSDoc-примеры (не исполняемый код), `SplashScreenDialog.js` inline `onerror` (выполняется до возможной готовности модулей).

## После завершения

- ⬜ Прогнать `npm run validate:version`.
- ⬜ Обновить `docs/CHANGELOG.md` (запись под текущей версией/Unreleased).
- ⬜ Обновить `docs/ARCHITECTURE.md`/`docs/COMMON_MISTAKES.md` там, где код изменился.
- ⬜ Финальная регрессия в браузере: создание/выбор/перетаскивание/группировка объектов, undo/redo, marquee с модификаторами, drag вне окна, Alt-Tab во время drag.
