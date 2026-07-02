# Changelog

## [Unreleased]

- **Z-порядок объектов: убран `zIndex`, заменён на порядок в массиве (array-order stacking)** — заменяет (не дополняет) две предыдущие записи «zIndex» ниже: точечные патчи `getNextZIndex`/`fixZIndex` не устранили баг (клик по перекрывающимся объектам внутри групп выбирал не тот объект, что рисовался сверху), причина была структурной — `Level.buildFullObjectIndex`/`buildObjectPath` не учитывали промежуточные вложенные группы. Схема убрана целиком: `GameObject`/`Group` больше не хранят и не сериализуют `zIndex` в `toJSON()`; z-порядок теперь — это просто позиция объекта в контейнере (`level.objects` на верхнем уровне, `group.children` внутри группы), как в слоях Photoshop/Figma. `Layer.index` (слои) не тронут, остаётся первичным ключом сортировки. Новое: `GroupTraversalUtils.findObjectPath(topLevelObjects, targetId)` — DFS-путь индексов от корня до объекта; `Level.compareStackOrder(a, b)` — единый компаратор (сначала layerIndex, затем путь в дереве), используется и рендером (`RenderOperations.getVisibleObjects`), и hit-test'ом (`ObjectOperations._sortObjectsByZIndexDescending`), гарантируя совпадение клика с отрисовкой; `ObjectOperations.bringToFront/sendToBack/moveForward/moveBackward(obj)` + `getSiblingArray(obj)` — ручное управление порядком (splice/push/unshift/swap над массивом-контейнером). UI: в DetailsPanel (Advanced) числовое поле «Z-Index» заменено 4 кнопками — «На передний план» / «На задний план» / «Выше» / «Ниже» (`createOrderButtonsRow`, работает для одиночного и множественного выбора). Удалено из `Level.js`: `getNextZIndex`, `updateAllObjectZIndices`, `assignInitialZIndex`, `buildFullObjectIndex`, `buildObjectPath`, `isObjectInAnyGroup`, миграционный блок `fixZIndex` в `fromJSON` (`src/models/Level.js`, `src/models/Group.js`, `src/models/GameObject.js`, `src/models/Asset.js`, `src/utils/GroupTraversalUtils.js`, `src/utils/UIFactory.js`, `src/core/RenderOperations.js`, `src/ui/CanvasRenderer.js`, `src/core/ObjectOperations.js`, `src/event-system/MouseHandlers.js`, `src/core/DuplicateOperations.js`, `src/ui/DetailsPanel.js`, `src/core/LayerOperations.js`, `src/managers/CacheManager.js`).

- **Rotate/Scale жесты объектов** — Ctrl+click-drag на объекте вращает выделение вокруг центра общего world bounding box (Shift во время вращения — шаг 10°, `TRANSFORM.ROTATION_SNAP_DEGREES`); Ctrl+Alt+click-drag равномерно масштабирует выделение относительно того же центра (клампится `TRANSFORM.MIN_SCALE_FACTOR=0.05`/`MAX_SCALE_FACTOR=20`). Работает на любом уровне вложенности групп. Клик по невыделенному объекту делает его единственным выделением, как при обычном drag; Ctrl+click без drag и Ctrl+drag по пустому месту (marquee toggle) не изменились. Alt+drag дублирование теперь срабатывает только без Ctrl (Ctrl+Alt зарезервирован под scale). `GameObject.rotation` (градусы, по часовой, вокруг центра; default 0) сериализуется в `toJSON()`, `getBounds()`/`containsPoint()` rotation-aware; `Group.getBounds()` учитывает rotation детей и свой rotation (консервативный AABB). `CanvasRenderer` рисует повёрнутые объекты и группы через `ctx.translate`/`ctx.rotate`. Известные ограничения v1: рамка выделения рисует AABB, а не повёрнутый контур; hit-test детей внутри повёрнутой группы не учитывает поворот родителя; жест применяет мировые дельты к локальным координатам (корректно, пока родительская группа не повёрнута) (`src/models/GameObject.js`, `src/models/Group.js`, `src/utils/WorldPositionUtils.js`, `src/ui/CanvasRenderer.js`, `src/event-system/MouseHandlers.js`, `src/constants/EditorConstants.js`, `config/defaults/shortcuts.json`, `src/ui/SettingsPanel.js`).

- **Cross-panel tab drag (replaces "Move to" context menu)** — контекстное меню «Move to Left/Right Panel» удалено (`TabMoveContextMenu`, `handleTabContextMenu` из `EventHandlers.js`). Вкладки перемещаются прямым drag:
  - **Ghost-таб** (`.tab-drag-ghost`): полупрозрачный повёрнутый дубликат тянется под курсором во время drag.
  - **Подсветка drop-зоны**: при наведении на tab-bar другой панели — синяя пунктирная рамка (`.tab-drop-zone`); при сбросе вызывается `PanelPositionManager.moveTab()`.
  - **Создание панели**: если целевой панели не существует, на краях `#main-workspace` появляются светло-синие полосы (`.tab-new-panel-zone`); при сбросе на них панель создаётся автоматически через `ensurePanelExists()`.
  - **Скоупинг визуалов**: подсвечиваются только `#left-tabs-panel > .flex.border-b.border-gray-700` и `#right-tabs-panel > .flex.border-b.border-gray-700` — строгий прямой-дочерний селектор и Set-based проверка вместо `closest()`, чтобы другие UI-элементы (поиск, шапки секций) не реагировали.
  - **`this._pendingDrag`**: состояние drag хранится отдельно от `window.tabDraggingState`, т.к. легаси `tabDraggingGlobalMouseUp` (зарегистрирован в конструкторе) очищает его до выполнения нашего `mouseup`.
  - (`src/event-system/EventHandlers.js`, `src/ui/PanelPositionManager.js`, `styles/main.css`)

- **[SUPERSEDED — см. запись «Z-порядок объектов» выше]** **zIndex в группах: рендеринг, назначение, миграция** — (1) `assignInitialZIndex` вызывал `assignObjectToLayer(obj.id)` → `findObjectById` → `null` для детей групп (не в `level.objects`) → слой не корректировался → zIndex оставался с `maxLayerIndex` вместо реального. Исправлено: layer index вычисляется напрямую из `layerId`-параметра. (2) `fromData` итерировал только `level.objects`, не рекурсируя в детей групп → дети с `zIndex=0` (сохранённые с багом) не мигрировались. Исправлено: `fixZIndex` рекурсивно обходит все вложенные группы с учётом наследования `layerId`. (3) `drawGroup` рисовал детей в порядке массива без сортировки → порядок не совпадал с hit-test. Исправлено: `slice().sort(by zIndex asc)` перед `forEach`. (4) При drag top-level→group zIndex не переназначался. Исправлено: `getNextZIndex()` + коррекция слоя перед `push` (`src/models/Level.js`, `src/ui/CanvasRenderer.js`, `src/event-system/MouseHandlers.js`).


- **[SUPERSEDED — см. запись «Z-порядок объектов» выше]** **zIndex: два бага нарушали порядок рендеринга и hit-test** — (1) `getNextZIndex`: условие `obj.zIndex > 0` исключало из сканирования объекты с `zIndex = 0.000` (слой с index=0) → `nextObjectIndex` всегда равен 0 → все объекты получали одинаковый `zIndex = 0.000` → Details показывал 0 для всех, кликался нижний объект вместо верхнего. Исправлено: `> 0` → `!== undefined`. (2) Floating point: `Math.floor((1.001 % 1) * 1000) = 0` вместо `1` (т.к. `1.001 % 1 ≈ 0.0009999...`) → неверный objectIndex при переносе между слоями с index≥1. Исправлено: `Math.floor → Math.round` в 11 местах. Существующие уровни с `zIndex = 0` авто-фиксируются при загрузке (`src/models/Level.js`, `src/models/Group.js`, `src/ui/DetailsPanel.js`, `src/core/LayerOperations.js`, `src/event-system/MouseHandlers.js`).

- **Asset tabs bug fixes** — исправлены 4 бага в `AssetTabsManager`: (1) `addFolderTab`/`removeFolderTab` теперь создают новый `Set` вместо мутации объекта из StateManager, чтобы гарантировать уведомление подписчиков; (2) `removeFolderTab` явно передаёт `null` в `_saveTabStateToConfig()` — устранён рассинхрон `activeAssetTab` между state и config при перезагрузке; (3) `AssetTabContextMenu.destroy()` теперь удаляет `document.click` listener через сохранённую ссылку, предотвращая ghost-хендлеры; (4) DnD-слушатели из `setupFolderDragToTabs()` сохраняются как свойства и удаляются в `destroy()` (`src/ui/AssetTabsManager.js`).

- **SettingsPanel tab fixes** — (1) устранена гонка 100 мс: `setupNewEventHandlers()` и `setupContextMenu()` вызываются синхронно (DOM готов в момент `show()`); (2) `setupSettingsInputs()` ограничена `settings-panel-container`, вместо глобального `document.querySelectorAll` (`src/ui/SettingsPanel.js`).

- **Status Bar color settings** — в Settings → Colors добавлена секция «Status Bar Colors» с 4 пикерами (Info / Success / Warning / Error); цвета хранятся в `ui.statusBarColor*`, применяются через CSS-переменные `--status-bar-color-*` с live preview при изменении (`styles/main.css`, `styles/status-bar.css`, `config/defaults/ui.json`, `src/utils/SettingsSyncManager.js`, `src/ui/panel-structures/SettingsPanelRenderers.js`).

- **Status Bar coverage** — расширено покрытие операций редактора: группировка/разгруппировка, вход/выход из group-edit-mode, удаление объектов, дублирование (старт + подтверждение размещения), undo/redo (в т.ч. «Nothing to undo/redo»), перемещение объектов между слоями, new/open/save/save-as уровня, импорт ассетов (`src/core/GroupOperations.js`, `ObjectOperations.js`, `DuplicateOperations.js`, `HistoryOperations.js`, `LayerOperations.js`, `LevelFileOperations.js`).

- **Status Bar history popup** — `Logger.status.*` сообщения теперь держатся до следующего (без авто-очистки); клик по строке открывает popup с историей (newest first, до 100 записей), закрывается по Esc / повторному клику / клику вне; `AssetPanel` — ошибки импорта PNG роутятся через `Logger.status` и появляются в строке состояния (`src/ui/StatusBar.js`, `styles/status-bar.css`, `src/ui/AssetPanel.js`, `src/core/LevelEditor.js`).

- **Panel tabs drag fixed (capture conflict)** — устранена причина, из-за которой вкладки «не перемещались»: global `mouseup` в `PanelPositionManager` (capture-phase) очищал drag-state до локального reorder-хендлера. Теперь global cleanup выполняется только при отпускании вне tab-strip; внутри tab-strip завершение делает panel-level handler. Также отключён legacy bootstrap `setupTabDragging()` в `index.html`, чтобы не было конкурирующих drag-цепочек (`src/ui/PanelPositionManager.js`, `index.html`).

- **Panel tabs drag-reorder restored** — исправлен drag внутри одной панели: селекторы расширены до unified `.tab[data-tab]` (не только `.tab-right/.tab-left`), старт drag ограничен левой кнопкой мыши. Применено в `PanelPositionManager.setupTabDraggingForPanel()` и legacy bootstrap в `index.html`, без изменения логики переноса между панелями (`src/ui/PanelPositionManager.js`, `index.html`).

- **Middle-mouse horizontal panning restored** — в `OutlinerPanel` и `LayersPanel` для `setupScrolling()` включён `horizontal: true` (вместо `false`), поэтому middle-drag теперь двигает контент по X и Y, если контейнер переполнен; ранее по X работал только `Shift+wheel` браузера (`src/ui/OutlinerPanel.js`, `src/ui/LayersPanel.js`).

- **Outliner list scroll restored** — после устранения tab-leak восстановлена корректная прокрутка Outliner: layout переведён на CSS-класс (`outliner-tab-layout`) и отдельный scroll-контейнер списка (`outliner-objects-container`), без inline `display:flex` конфликтов с hidden/show (`src/ui/OutlinerPanel.js`, `styles/main.css`).

- **Layers + Outliner same-panel bleed (final visibility fix)** — `setActivePanelTab()` теперь управляет не только классом `hidden`, но и `style.display` (`none` для всех, `''` для активных), чтобы inline-стили компонентов не могли удерживать неактивную вкладку видимой. В `Outliner.render()` удалено принудительное `display:flex`, которое перебивало скрытие вкладки (`src/event-system/EventHandlers.js`, `src/ui/OutlinerPanel.js`).

- **Layers/Outliner content leakage** — исправлено: `setActivePanelTab()` теперь всегда скрывает весь tab-content (маркеры + legacy `.tab-content-right/.tab-content-left`), а `ensurePanelTabMarkers()` выставляет канонические маркеры для `details/layers/outliner` независимо от текущего набора tab buttons. Это предотвращает «протекание» содержимого Outliner в Layers при сложных вариантах сборки/переноса (`src/event-system/EventHandlers.js`).

- **Tab assembly stability across panel variations** — исправлено смешивание содержимого вкладок: `PanelPositionManager.moveTabElements()` теперь ищет tab button и tab content строго в source-container (вместо глобального `document.querySelector/getElementById`), что убирает кросс-попадания при сложных вариантах сборки/переноса. Также убраны временные дублирующие `id` у tab-кнопок в `temp-tabs-panel` (`src/ui/PanelPositionManager.js`).

- **Outliner scroll target precision** — `OutlinerPanel` теперь создаёт отдельный `#outliner-objects-container` (только список объектов, `overflow-y-auto/overflow-x-auto`) и middle-pan привязывается к нему. Блок поиска/фильтра остаётся фиксированным и не попадает в scroll target (`src/ui/OutlinerPanel.js`).

- **Tab content routing + middle-pan target** — доработана архитектура: middle-pan теперь выбирает только реально scrollable overflow-контейнер (не верхний panel-wrapper), а для вкладок введена стабильная маркировка `data-panel-tab-content=true` + `data-panel-tab-name`. `setActivePanelTab()` скрывает/показывает контент по этой маркировке, что предотвращает путаницу содержимого после переносов между панелями (`src/utils/ScrollUtils.js`, `src/event-system/EventHandlers.js`, `src/ui/PanelPositionManager.js`).

- **Outliner search block and middle-pan** — исправлено архитектурно: middle-pan больше не стартует с интерактивных контролов (`input/textarea/select/contenteditable`) и с panel custom sections (`panel-top-custom`/`panel-bottom-custom` помечены `data-no-middle-pan=true`). Это убирает горизонтальный скролл поля поиска в Outliner и выравнивает поведение с Layers (`src/utils/ScrollUtils.js`, `src/ui/panel-structures/BasePanelStructure.js`).

- **Universal middle-mouse scrolling architecture** — внедрён единый глобальный механизм в `ScrollUtils`: один `document`-level capture handler определяет ближайший scrollable контейнер и запускает pan без привязки к конкретной панели. Работает для любых существующих и новых overflow-контейнеров редактора, независимо от стороны (left/right) и количества панелей. `BasePanel.setupScrolling()` теперь служит как опциональный override-конфиг контейнера, а не как обязательная точка инициализации (`src/utils/ScrollUtils.js`, `src/event-system/EventHandlers.js`).

- **Outliner/Layers middle-mouse panning** — исправлено: целевой scroll-контейнер для `setupScrolling()` больше не привязан к `#right-panel`; теперь берётся ближайший `.flex-grow.overflow-y-auto`, поэтому панорамирование работает после перемещения вкладок между левым/правым панелями (`src/ui/OutlinerPanel.js`, `src/ui/LayersPanel.js`).

- **Panel middle-mouse panning (Outliner/Assets)** — исправлено: `ScrollUtils.setupMiddleMouseScrolling()` больше не дублирует слушатели при повторной инициализации (обновляет существующий config), а `mousedown` для средней кнопки обрабатывается в capture-фазе. Это возвращает стабильное панорамирование в панелях аутлайнера и ассетов (`src/utils/ScrollUtils.js`).

- **Toolbar panning cursor** — исправлено: при middle-mouse панорамировании тулбара теперь применяется курсор зажатой руки (`grabbing`), так как `toolbar-scroll` получил класс `horizontal-scroll-container` и использует общее CSS-правило `.horizontal-scroll-container.scrolling` (`src/ui/Toolbar.js`, `styles/panels.css`).

- **Status Bar** — однострочная панель уведомлений внизу редактора (`src/ui/StatusBar.js`). Показывает важные события с цветовым кодированием: `error` (красный), `warn` (жёлтый), `success` (зелёный), `info` (серый). Видимость запоминается в StateManager/UserPreferences, переключается через View → Panels → Status Bar. Прямой API: `editor.statusBar.show(message, type, duration)`. Logger-интеграция: `Logger.status.warn/error/success/info(msg)` — одновременно логирует в консоль (с префиксом `STATUS:`) и показывает в строке состояния. Callback регистрируется через `Logger.setStatusCallback(fn)`. Длительность по типу: error 10s, warn 7s, success/info 4-5s.

- **Settings → Colors: лейаут** — Blender-стиль: label выровнен вправо (flex 40%), широкая цветовая полоса заполняет оставшиеся 60%. Logger Colors — 2-колоночный грид с теми же строками. Убран `width: 100% !important` для `input[type="color"]` из `settings-panel.css`.
- **Settings → Colors: Apply Changes** — исправлено: selection colors (`selection.outlineColor`, `groupOutlineColor`, `marqueeColor`, `hierarchyHighlightColor`, `activeLayerBorderColor`) теперь в stateMapping → применяются корректно. Добавлена CSS-переменная `--accent-color` и `--selection-active-layer-border-color` в `applySpecialUISettings`.

### Fixed — Группы: перетаскивание объектов из родительской в дочернюю группу; выбор объектов при открытой вложенной группе

#### 🐛 Исправлено

- **Drag из G1 в G2** — при открытой вложенной группе (G2 активна, G1 родительская) перетаскивание объекта из G1 в область G2 теперь реально переносит объект из `G1.children` в `G2.children` с правильным пересчётом координат и наследованием layerId. Ранее `dragSelectedObjects` для `isInAnyOpenGroup`-объектов просто делал `obj.x += dx` без проверки входа в активную группу (`MouseHandlers.js`).
- **Marquee при missed-click** — клик на пустое место внутри родительской открытой группы (G1) но снаружи активной дочерней (G2) теперь делает stepback к G1 И начинает marquee-выделение в G1. Ранее такой клик только закрывал G2 без возможности выделить что-либо (`MouseHandlers.js`).
- **findObjectAtPoint: выбирается родительская группа вместо объекта** — при вложенности 2+ уровней клик на одиночный объект внутри открытой группы выбирал саму группу-контейнер (т.к. её bounds охватывают потомков). В `collectAllDescendants` открытые группы (из `openIds`) теперь пропускаются как кандидаты для hit-test, но рекурсия в них сохраняется — так одиночные объекты внутри правильно попадают в список (`ObjectOperations.js`).
- **Alt+drag исправлен** — вычисление world-позиции при Alt+drag для `isInAnyOpenGroup`-объектов теперь использует `getObjectWorldPosition(obj)` вместо ошибочного `groupPos.x + obj.x` (который давал неверные координаты для объектов в родительской группе).
- **Порт сервера** — `start_Editor.bat`, `.vscode/launch.json`, `Context_map.md`, `docs/QUICK_START.md` унифицированы на порт **8000** (ранее Node.js serve использовал порт 3000).

- **CacheManager: spatial index fast path** — `getSelectableObjectsInViewport()` в fast path итерировала `viewportObjects` как `obj.id`, но `getVisibleObjectsSpatial` возвращает `{obj, parentX, parentY}` — нужно `item.obj.id`. Следствие: после первого рендера `selectableInViewport` всегда пуста → `findObjectAtPoint` возвращает null для всех объектов → клик+драг на верхнем уровне не работает (`CacheManager.js`).

- **Дублирование внутри открытой группы: превью, offset, selection, highlight** — четыре связанных бага: (1) превью не появлялось — `initializePositions` использовала `isObjectInGroupRecursive(clone)` и `getObjectWorldPosition(clone)`, но после `reassignIdsDeep` клон недоступен в дереве → всегда local coords → превью рисовалось за viewport. Фикс: `_worldX/_worldY` и `_inGroup` вычисляются до `reassignIdsDeep` в `startFromSelection`. (2) превью со сдвигом — специальный case `_inGroup → offsetX:0` ставил preview точно в курсор; удалён — теперь используется тот же offset-calculation что и для top-level объектов, привязывая к точке клика. (3) после размещения был выбран оригинал — `handleMouseDown` при клике для размещения вызывал `handleObjectClick` на оригинале, меняя selection и ставя `isDragging=true`; добавлена ранняя проверка `if (mouse.isPlacingObjects) return`. (4) подсветка оригинала во время превью — `selectedObjects` содержала ID оригинала между Shift+D и mouseup; теперь `startFromSelection` сбрасывает `selectedObjects = new Set()` перед render, так что оригинал не подсвечивается в preview-фазе (`DuplicateOperations.js`, `DuplicateUtils.js`, `MouseHandlers.js`).

#### 📁 Изменённые файлы

`src/event-system/MouseHandlers.js` · `src/managers/CacheManager.js` · `start_Editor.bat` · `.vscode/launch.json` · `Context_map.md` · `docs/QUICK_START.md`

---

### Perf — M9, M7, M8, M6: lazy spatial index, spatial-aware selectable filter, per-layer cache, ctx.save hoisting

#### ⚡ Производительность

- **M9. buildSpatialIndex: lazy dirty-flag** — добавлен метод `markSpatialIndexDirty()` в `RenderOperations`. Все внешние вызовы `buildSpatialIndex()` (GroupOperations, LayerOperations, HistoryOperations, CacheManager) заменены на `markSpatialIndexDirty()`. Перестройка O(N) откладывается до начала следующего `getVisibleObjectsSpatial()` в render-loop. Init LevelEditor оставлен прямым вызовом (`RenderOperations.js`, `GroupOperations.js`, `LayerOperations.js`, `HistoryOperations.js`, `CacheManager.js`).
- **M7. getSelectableObjectsInViewport: spatial index как кандидаты** — при наличии spatial index `getSelectableObjectsInViewport()` теперь использует `getVisibleObjectsSpatial()` (O(k), k ≪ N) вместо итерации всех selectable объектов. Заодно исправлен баг: `camera.scale` (undefined, давало NaN-bounds и пропускало все объекты) заменён на `camera.zoom` как в остальном коде (`CacheManager.js`).
- **M8. effectiveLayerCache: per-layer invalidation** — добавлен обратный индекс `_layerToObjectIds: Map<layerId, Set<objId>>`, заполняемый лениво в `getCachedEffectiveLayerId()`. При layer-изменении `smartCacheInvalidation()` теперь удаляет только записи объектов затронутого слоя вместо `effectiveLayerCache.clear()`. Fallback на полную очистку если индекс не прогрет (`CacheManager.js`).
- **M6. ctx.save/restore: hoisting за пределы forEach** — в `drawHierarchyHighlightForGroup()` и `drawDuplicateHierarchyHighlight()` `ctx.save()/restore()` вынесены за пределы forEach-цикла: один раз на depth вместо 2× на каждый дочерний объект. `fillStyle` устанавливается один раз перед циклом (не меняется в рамках одного depth). Рекурсивные вызовы делают собственный save/restore и возвращают ctx в исходное состояние (`RenderOperations.js`).

#### 📁 Изменённые файлы

`src/core/RenderOperations.js` · `src/core/GroupOperations.js` · `src/core/LayerOperations.js` · `src/core/HistoryOperations.js` · `src/managers/CacheManager.js`

---

### Fixed — Группы: корректная работа при глубокой вложенности (3+ уровней)

- **`GroupOperations.extractObjectFromGroup`**: исправлен расчёт координат при извлечении объекта из вложенной группы. Ранее использовались `group.x`/`group.y` (локальные координаты относительно родителя), что давало неверную позицию при глубине ≥ 2. Теперь используется `getObjectWorldPosition(group)` — полный мировой DFS-обход (`GroupOperations.js`).
- **`GroupOperations.extractObjectFromGroup`**: при вложенных группах дочерний объект теперь перемещается в **родительскую группу** с правильными относительными координатами, а не на верхний уровень (`level.objects`). Это сохраняет иерархию: закрытие G3 (G1→G2→G3) с 1 дочерним объектом корректно переносит его в G2, не ломая структуру (`GroupOperations.js`).
- **`GroupOperations._findParentGroup`**: добавлен вспомогательный метод — рекурсивный поиск родительской группы по всему дереву объектов уровня (`GroupOperations.js`).

## [3.54.5] - 2026-07-01

### Fixed — Технический аудит v3.54.4: критические баги, производительность, архитектурная гигиена

#### 🐛 Исправленные баги

- **C1. Undo-рассинхрон после drag-cancel вне окна** — `MouseHandlers.handleGlobalMouseUp()` теперь вызывает `historyOperations.undo()` (полное восстановление с rebuild индексов/выборки) вместо низкоуровневого `historyManager.undo()` (`MouseHandlers.js`).
- **C2. Краш при drag группы в саму себя** — добавлен guard в `dragSelectedObjects()`: запрещает перетаскивание группы в саму себя или в собственного потомка (`wouldCreateCycle` через `isObjectInGroupRecursive`) (`MouseHandlers.js`).
- **H5. Escape не чистил pending-marquee state** — `marqueePendingStartPos` добавлен в `hasActiveProcess`-проверку в `handleKeyDown()`, теперь Escape корректно маршрутизируется в `cancelAllActions()` (`EventHandlers.js`).
- **H6. Потеря фокуса (Alt-Tab) во время drag/marquee** — добавлен `MouseHandlers.handleWindowBlur()`, вызывается из существующего `visibilitychange`-обработчика при `document.hidden`: финализирует marquee, откатывает незавершённый drag через `historyOperations.undo()`, сбрасывает флаги кнопок мыши (`MouseHandlers.js`, `LevelEditor.js`).
- **M3. OutlinerPanel "Duplicate" — пустая заглушка** — подключён существующий `DuplicateOperations` через `levelEditor.duplicateSelectedObjects()` (`OutlinerPanel.js`).
- **L2. Накопление Escape-listener'ов в color picker слоя** — исправлено: handler хранится по ссылке и явно удаляется через `removeEventListener` во всех путях закрытия (change / blur / Escape) (`LayersPanel.js`).

#### ⚡ Улучшения производительности

- **H2. Кэширование порядка рендера** — сортировка visible objects по zIndex вычисляется и кэшируется вместе с `visibleObjectsCache` (тот же TTL/инвалидация); устранено создание нового отсортированного массива на каждый `render()` вызов (`RenderOperations.js`).
- **H3. Throttle для global mousemove** — добавлен `_throttledGlobalMouseMove` с тем же `PERFORMANCE.MOUSE_MOVE_THROTTLE_MS`, что и обычный mousemove; устраняет неограниченные вызовы `render()` при marquee за пределами canvas (`MouseHandlers.js`).
- **H4. Мемоизация renderPreviews() в AssetPanel** — добавлен guard: полный teardown/rebuild DOM-грида пропускается, если набор ассетов, выборка, viewMode и размеры не изменились с прошлого вызова (`AssetPanel.js`).
- **M1. Очистка кэшей при смене уровня** — `newLevel()`/`openLevel()` теперь вызывают `editor.clearCaches()` перед `stateManager.reset()`, освобождая объекты предыдущего уровня из трёх неограниченных Map-кэшей (`LevelFileOperations.js`).

#### 🏗️ Архитектурные улучшения

- **H7. Устранение дублирования `updateDialogSize()`** — логика расчёта и применения ширины вынесена в `DialogResizer.applyCalculatedWidth()` (статический метод); `BaseDialog` и `SettingsPanel` теперь используют один код вместо двух почти идентичных копий (`DialogResizer.js`, `BaseDialog.js`, `SettingsPanel.js`).
- **M2. Устранение тройной регистрации global mouseup** — удалены избыточные блоки `global-mouse-document` и `global-mouse-window`; оставлена единственная регистрация на `window` (по образцу `BasePanel`) (`EventHandlers.js`).
- **M4. Блокировка newLevel/openLevel при активном drag/marquee** — добавлена проверка `_hasActiveMouseOperation()` в начале обоих методов, исключая риск "ghost edits" при race между drag и File menu (`LevelFileOperations.js`).
- **M5. Удаление мёртвых test\*() методов** — `testContextMenu`, `testContextMenuManager`, `testGlobalClickHandler`, `testPanningDetection`, `testMenuAutoClose`, `testCursorPositioning` удалены из `LevelEditor.js` (115 строк, нет ни одного caller'а, нет ассертов, не производили наблюдаемых эффектов) (`LevelEditor.js`).
- **L1. Корректная отписка от StateManager в destroy()** — `FoldersPanel` и `AssetPanel` теперь сохраняют unsubscribe-функции в `this.subscriptions[]` и вызывают их в `destroy()` по образцу `LayersPanel` (`FoldersPanel.js`, `AssetPanel.js`).

#### 🧹 Чистка кода

- **H9/L5. console.log в hot-path и BaseContextMenu** — удалены: `console.log(new Error().stack)` из `LevelEditor.updateAllPanels()`, 5 вызовов из `BaseContextMenu`, 2 из `OutlinerPanel.render()`, 6 дублирующих из `AssetImporter` (рядом уже были Logger-вызовы), 1 из `DetailsPanel`. Заменены на `Logger.*`: `DialogSizeManager` (добавлен импорт), `BaseContextMenu`.
- **L3. Отсутствующий Logger.menu accessor** — `Logger` содержал запись `MENU` в `CATEGORIES`, но не имел соответствующего `static menu = { info, debug, warn, error }` — вызов `Logger.menu.info(...)` приводил к краш-старту редактора (`TypeError: Cannot read properties of undefined (reading 'info')`). Добавлен `static menu` accessor по аналогии с остальными 28 категориями (`src/utils/Logger.js`).
- **L4. Документация Logger** — исправлено число категорий: 17→29 в `DEVELOPMENT_GUIDE.md`, 19→29 в `ARCHITECTURE.md`.

#### 📁 Изменённые файлы

`src/event-system/MouseHandlers.js` · `src/event-system/EventHandlers.js` · `src/core/LevelEditor.js` · `src/core/LevelFileOperations.js` · `src/core/RenderOperations.js` · `src/core/ObjectOperations.js (через OutlinerPanel)` · `src/ui/OutlinerPanel.js` · `src/ui/AssetPanel.js` · `src/ui/FoldersPanel.js` · `src/ui/BaseContextMenu.js` · `src/ui/DetailsPanel.js` · `src/ui/LayersPanel.js` · `src/ui/BaseDialog.js` · `src/ui/SettingsPanel.js` · `src/utils/DialogResizer.js` · `src/utils/DialogSizeManager.js` · `src/utils/AssetImporter.js` · `src/utils/ParallaxRenderer.js` · `src/utils/Logger.js` · `src/managers/MenuManager.js` · `docs/ARCHITECTURE.md` · `docs/DEVELOPMENT_GUIDE.md`

### Fixed — Регрессии, обнаруженные при live-тестировании (chrome-devtools MCP)

#### 🐛 Исправленные баги

- **Краш рендер-лупа: `visibleObjects is not defined`** — В `RenderOperations.render()` переменная `sortedObjects` (результат `this.getVisibleObjects(camera)`, строка 374) была переименована в ходе рефакторинга, но периодический лог на строке 472 остался ссылаться на старое имя `visibleObjects`. Исправлено: `visibleObjects.length` → `sortedObjects.length` (`src/core/RenderOperations.js`).
- **Duplicate не работал: `duplicateSelectedObjects is not a function`** — `LevelEditor.duplicateSelectedObjects()` вызывал `this.duplicateOperations.duplicateSelectedObjects()`, которого не существует. Правильное имя метода — `startFromSelection()`. Исправлено в `src/core/LevelEditor.js`.
- **ConfigManager: 16 лишних 404 в консоли при каждом старте** — `loadUserConfigsFromStorage()` пыталась подгрузить `config/user/<name>.json` для 8 конфигов (camera, selection, assets, performance, shortcuts, view, toolbar, grid), для которых файлы в `config/user/` не предусмотрены (только editor/canvas/panels задокументированы в `config/user/README.md`). Добавлен `this.fileBackedConfigs = ['editor', 'canvas', 'panels']`, file-fetch ограничен этим списком (`src/managers/ConfigManager.js`).
- **Делегированные blur/focus не срабатывали → переименование слоя слетало** — `EventHandlerManager.setupContainerEventListeners()` навешивал `blur`/`focus` обработчики в bubble-фазе, но эти события не всплывают (`non-bubbling`). Делегирование от контейнера к дочернему `<input>` не работало: `LayersPanel` blur-хендлер (коммит переименования слоя) никогда не получал событие, и rename слетал при каждом `render()` (например, при выборе другого слоя). Исправлено: для `blur`/`focus` в `setupContainerEventListeners` теперь устанавливается `{ capture: true }` (`src/event-system/EventHandlerManager.js`).

#### ✨ Новые функции

- **Splash screen при первом визите** — `LevelEditor.maybeShowSplashOnFirstVisit()` вызывается в конце `finalizeInitialization()`. Проверяет localStorage-флаг `levelEditor_hasSeenSplash`; показывает сплеш один раз и больше не беспокоит. Ручной вызов через лого-кнопку по-прежнему работает в любой момент (`src/core/LevelEditor.js`).

#### 📁 Изменённые файлы

`src/core/LevelEditor.js` · `src/core/RenderOperations.js` · `src/event-system/EventHandlerManager.js` · `src/managers/ConfigManager.js` · `src/utils/Logger.js` · `docs/API_GUIDE.md` · `docs/ARCHITECTURE.md` · `docs/DEVELOPMENT_GUIDE.md` · `docs/EVENT_HANDLER_SYSTEM.md` · `docs/README.md` · `docs/VERSIONING_GUIDE.md`

## [3.54.4] - 2025-01-27

### Enhanced - Улучшенная система селекта объектов на канве и унификация обработчиков событий

#### ✨ **Новые функции:**
- **Ctrl+click на объекте** - переключение выбора объекта (toggle selection)
- **Shift+click на объекте** - добавление объекта к выбору (add to selection, не toggle)
- **Ctrl+drag** - рамка для переключения выбора (toggle marquee selection)
- **Shift+drag** - рамка для добавления к выбору (add marquee selection)
- **Ctrl+Shift+drag** - комбинированный режим добавления к выбору

#### 🔧 **Технические улучшения:**
- **Унификация системы селекта** - канва теперь использует `SelectionUtils` для унификации логики с панелями
- **Единая система обработчиков** - все inline event listeners перенесены в `EventHandlerManager` и `GlobalEventRegistry`
- **Автоматическая очистка** - все обработчики автоматически очищаются при уничтожении компонентов
- **Устранение дублирования** - вынесен метод `_determineMarqueeMode()` для устранения дублирования логики определения режима marquee
- **Pending marquee state** - добавлена система отсроченного изменения селекта при клике с модификаторами (изменение происходит только при отпускании мыши или завершении marquee)
- **Улучшенная обработка click+drag** - при клике с модификаторами на объекте селект не изменяется сразу, а только при завершении действия (простом клике или marquee)

#### 🐛 **Исправленные проблемы:**
- **Селект при клике+драге** - исправлено преждевременное изменение селекта при клике с модификаторами на объекте, теперь селект изменяется только при отпускании мыши
- **Дублирование кода** - устранено дублирование логики определения режима marquee в `handleObjectClick` и `handleEmptyClick`
- **Неиспользуемые переменные** - удалены неиспользуемые переменные (`marquee`, `selectedObjects` в некоторых местах)
- **Избыточные поля** - удалено избыточное поле `marqueeMode` из `marqueeOptions` (используется из stateManager)

#### 📁 **Измененные файлы:**
- `src/event-system/MouseHandlers.js` - улучшена система селекта объектов, добавлен метод `_determineMarqueeMode()`, интеграция с `SelectionUtils`, перенос обработчиков в единую систему
- `src/core/LevelEditor.js` - перенос обработчиков `beforeunload`, `visibilitychange` и кнопки "Set Camera Start Position" в `GlobalEventRegistry` и `EventHandlerManager`
- `src/event-system/EventHandlers.js` - перенос обработчиков `TabMoveContextMenu` в единую систему, добавлен метод `_cleanupMenuHandlers()`
- `src/utils/SelectionUtils.js` - расширена поддержка canvas mode для marquee selection

#### 💡 **Преимущества:**
- **Единообразие поведения** - селект на канве работает так же, как в панелях (с учетом специфики канвы)
- **Упрощение поддержки** - единая логика селекта в `SelectionUtils`, легче поддерживать и расширять
- **Централизованная система событий** - все обработчики управляются через единую систему, автоматическая очистка
- **Лучший UX** - корректное поведение при клике+драге с модификаторами, селект не изменяется преждевременно
- **Чистый код** - устранено дублирование, удалены неиспользуемые переменные

#### 🎯 **Детали реализации:**
- **Pending marquee state** - при клике с модификаторами на объекте сохраняется `marqueePendingClickInfo` и `marqueePendingStartPos`, селект изменяется только в `handleMouseUp` (для простого клика) или `finishMarqueeSelection` (для драга)
- **Интеграция с SelectionUtils** - канва использует `SelectionUtils.selectSingleItem()`, `SelectionUtils.handleCtrlClick()` и `SelectionUtils.finalizeMarqueeSelection()` для унификации логики
- **Метод `_determineMarqueeMode()`** - централизованное определение режима marquee на основе модификаторов (Ctrl, Shift)
- **Автоматическая очистка pending state** - все pending состояния очищаются в `cancelAllActions()` и при завершении marquee

## [3.54.3] - 2025-01-27

### Fixed - Исправления обработчиков событий для слоев

#### 🐛 **Исправленные проблемы:**
- **Подсветка слоев с задержкой** - исправлено отставание подсветки от курсора, оптимизировано обновление через `updateLayerStyles()` вместо полного `render()`
- **Дублирование обработчиков** - устранены дублирующиеся обработчики EventHandlerManager при пересоздании DOM
- **Клик на цветовой индикатор** - исправлено открытие виджета изменения цвета при клике на `.layer-color`
- **Клик на тексте и счетчике объектов** - информативные элементы (`.layer-name-display`, `.layer-objects-count`) теперь прозрачны для кликов, позволяя выбирать слой
- **Ctrl+click для выбора всех объектов** - восстановлен функционал выбора всех объектов слоя при Ctrl+click

#### ✨ **Новые функции:**
- **Shift+Ctrl+click** - добавлен функционал добавления всех объектов слоя к текущему селекту (Shift+Ctrl+click на слой)

#### 🔧 **Технические улучшения:**
- **Единая система обработчиков** - все обработчики слоев перенесены в EventHandlerManager (click, dblclick, contextmenu, drag/drop, input, blur, keypress, keydown)
- **Автоматическая очистка** - все обработчики автоматически очищаются через EventHandlerManager при пересоздании DOM
- **Оптимизация обновления** - добавлена подписка на `selectedObjects` для обновления только стилей слоев вместо полного `render()`
- **Устранение дублирования кода** - вынесена общая логика получения объектов слоя в метод `_getObjectsInLayer()`
- **Удален неиспользуемый код** - удален импорт `EventHandlerUtils`, убраны `console.log` отладочные сообщения

#### 📁 **Измененные файлы:**
- `src/ui/LayersPanel.js` - рефакторинг обработчиков событий, перенос в EventHandlerManager, оптимизация обновлений
- `src/event-system/EventHandlerManager.js` - добавлена поддержка `dblclick`, `keypress`, `dragstart`, `dragend`, `dragover`, `drop` для контейнеров

### Enhanced - Интерактивное позиционирование и ресайз канвы по viewport элементу

#### 🎯 **Новые функции:**
- **Canvas viewport** - добавлен ID `canvas-viewport` для элемента viewport
- **Интерактивное обновление** - канва автоматически обновляет позицию и размер при изменении размеров viewport
- **ResizeObserver** - добавлен автоматический отслеживатель изменений размеров viewport элемента
- **StateManager синхронизация** - позиция и размер канвы передаются в stateManager (`canvas.position`, `canvas.size`)

#### 🔧 **Технические улучшения:**
- **CanvasRenderer.resizeCanvas()** - теперь использует `canvas-viewport` вместо `parentElement` для получения размеров
- **Позиционирование canvas-container** - автоматически синхронизируется с позицией viewport элемента
- **Отложенная инициализация** - ResizeObserver инициализируется с повторными попытками (до 10 раз) если элемент еще не готов
- **Очистка ресурсов** - ResizeObserver корректно отключается в методе `destroy()`
- **Упрощение доступа к stateManager** - убрано использование `window.editor`, stateManager передается через свойство при инициализации
- **Helper-метод updateCanvas()** - добавлен для устранения дублирования кода обновления канвы (заменено 4 места)
- **Упрощение ResizeObserver** - используется параметр функции вместо внешней переменной для retryCount

#### 📁 **Измененные файлы:**
- `index.html` - добавлен ID `canvas-viewport` для элемента viewport
- `src/ui/CanvasRenderer.js` - обновлен метод `resizeCanvas()` для использования `canvas-viewport`, добавлено обновление позиции `canvas-container` и передача данных в stateManager, убрано использование `window.editor`
- `src/core/LevelEditor.js` - добавлен ResizeObserver для `canvas-viewport` в `setupPanelSizeListeners()`, добавлена очистка в `destroy()`, добавлен helper-метод `updateCanvas()`, упрощена инициализация ResizeObserver, передача stateManager в CanvasRenderer при инициализации

#### 💡 **Преимущества:**
- **Интерактивный отклик** - канва мгновенно реагирует на изменения размеров панелей, разделителей и видимости элементов
- **Точное позиционирование** - канва всегда соответствует размеру и позиции viewport элемента
- **Автоматическая синхронизация** - все изменения размеров обрабатываются автоматически без ручных вызовов
- **Централизованное управление** - позиция и размер канвы доступны через stateManager для других компонентов

### Fixed - Исправления ResizeObserver и индикатора несохраненных изменений ассетов

#### 🐛 **Исправленные проблемы:**
- **ResizeObserver loop** - исправлена ошибка "ResizeObserver loop completed with undelivered notifications" при Ctrl+Scroll в окне ассетов
- **Индикатор несохраненных изменений** - исправлено отображение синей точки на ассетах после изменения параметров в Asset Properties
- **Применение изменений** - исправлена проверка изменений: теперь сравнивается с initialState, а не с текущим ассетом
- **Кнопка Cancel** - исправлено восстановление значений формы к состоянию на момент открытия окна

#### 🔧 **Технические улучшения:**
- **AssetPanel ResizeObserver** - добавлен `requestAnimationFrame` для отложенного выполнения изменений DOM, предотвращающий цикл
- **AssetPanel ResizeObserver** - добавлена проверка изменения размера (только при изменении >1px) для предотвращения лишних обновлений
- **ActorPropertiesWindow** - исправлен порядок параметров конструктора (убрано `document.body` из первого параметра)
- **ActorPropertiesWindow** - добавлена проверка изменений относительно `initialState` вместо текущего ассета
- **ActorPropertiesWindow** - добавлен метод `restoreInitialState()` для восстановления значений при Cancel
- **BaseDialog** - исправлена обработка кнопки `apply` (не закрывает окно автоматически, позволяет `apply()` закрыть)
- **AssetManager** - исправлена проверка наличия `_originalState` перед обновлением
- **Asset.hasChangesFromOriginal()** - добавлена нормализация значений (цвет без учета регистра, trim строк, числа как числа)
- **Устранено дублирование** - убран дублирующий код проверки изменений в `apply()`, используется `checkForChanges()`
- **Устранено дублирование** - вынесен `_getNumericValue()` как приватный метод

#### 📁 **Измененные файлы:**
- `src/ui/AssetPanel.js` - исправлен ResizeObserver, улучшена логика отображения индикатора несохраненных изменений
- `src/ui/ActorPropertiesWindow.js` - исправлена логика применения изменений, добавлено восстановление значений при Cancel
- `src/ui/BaseDialog.js` - исправлена обработка кнопки apply
- `src/core/LevelEditor.js` - исправлен вызов конструктора ActorPropertiesWindow
- `src/managers/AssetManager.js` - исправлена проверка `_originalState`, исправлен вызов `getAsset()` вместо `getAssetById()`
- `src/models/Asset.js` - улучшена нормализация значений в `hasChangesFromOriginal()`

#### 💡 **Преимущества:**
- **Корректная работа индикатора** - синяя точка появляется только при реальных изменениях
- **Правильная отмена** - Cancel возвращает значения к исходному состоянию
- **Нет ложных срабатываний** - индикатор не появляется при возврате к исходным значениям
- **Стабильность** - устранена ошибка ResizeObserver loop

### Performance - Оптимизация лейаута при ресайзе окна

#### 🚀 **Оптимизации производительности:**
- **FoldersPanel** - оптимизирован рендеринг при изменении размеров окна
- **Устранено пересоздание элементов** - при ресайзе обновляется только текст обрезки имен без полного пересоздания DOM
- **Новый метод updateLayout()** - легковесное обновление только необходимых элементов
- **Улучшенная производительность** - значительное снижение нагрузки при изменении размеров окна

#### 🔧 **Технические улучшения:**
- **FoldersPanel.updateLayout()** - новый метод для обновления только обрезки имен папок
- **ResizeObserver оптимизация** - использует `updateLayout()` вместо полного `renderFolderContent()` при ресайзе
- **AssetPanel.updateGridViewSizes()** - уже был оптимизирован (обновляет только стили grid без пересоздания элементов)
- **Чистый код** - все вызовы `renderFolderContent()` оставлены только для случаев изменения структуры/состояния

#### 📁 **Измененные файлы:**
- `src/ui/FoldersPanel.js` - добавлен метод `updateLayout()`, обновлены обработчики ресайза
- `docs/CHANGELOG.md` - добавлена документация об оптимизации
- `docs/API_GUIDE.md` - обновлена документация методов FoldersPanel
- `docs/ARCHITECTURE.md` - добавлена информация об оптимизации производительности

#### 💡 **Преимущества:**
- **Быстрый отклик** - плавное изменение размеров без лагов
- **Меньше нагрузки** - отсутствие пересоздания элементов при ресайзе
- **Лучший UX** - отсутствие мерцания и задержек при изменении размеров окна
- **Масштабируемость** - паттерн может быть применен к другим панелям при необходимости

## [3.54.1] - 2025-01-28

### Enhanced - Унифицированный ресайзер для всплывающих окон

#### 🎯 **Новые функции:**
- **DialogResizer** - создана унифицированная утилита для ресайза диалогов
- **Ресайзер для всех диалогов** - добавлена возможность изменения ширины всех всплывающих окон
- **Автоматическое сохранение ширины** - ширина диалогов сохраняется в StateManager и восстанавливается при следующем открытии
- **Умолчания размеров** - диалоги по умолчанию занимают 50% ширины окна браузера

#### 🔧 **Технические улучшения:**
- **BaseDialog** - добавлена поддержка ресайзера через `DialogResizer.setupResizer()`
- **SettingsPanel** - добавлен ресайзер для окна настроек
- **Упрощение кода** - удалены дублирующие методы `createDialogResizer()` и `setupSettingsPanelResizer()`
- **Единая логика** - все диалоги используют `DialogResizer.setupResizer()` одинаковым образом
- **Оптимизация CSS** - убрана фиксированная ширина, контролируется через JavaScript

#### 📁 **Измененные файлы:**
- `src/utils/DialogResizer.js` - новая утилита для управления ресайзом диалогов
- `src/ui/BaseDialog.js` - упрощена логика создания ресайзера, использование `DialogResizer`
- `src/ui/SettingsPanel.js` - добавлен ресайзер для окна настроек
- `styles/dialog-positioning.css` - обновлены комментарии, убрана фиксированная ширина

#### 💡 **Преимущества:**
- **Удобство использования** - пользователи могут настраивать ширину диалогов под свои нужды
- **Единообразие** - все диалоги ведут себя одинаково
- **Упрощение кода** - удалено ~40 строк дублирующего кода
- **Масштабируемость** - легко добавить ресайзер любому новому диалогу

### Fixed - Исправление обработчиков закрытия диалогов

#### 🐛 **Исправленные проблемы:**
- **Закрытие по клику вне окна** - восстановлена работа обработчика закрытия диалогов при клике на overlay
- **Закрытие сплеш-окна по клику на нём** - добавлена возможность закрывать сплеш-окно кликом на само окно (не только на overlay)
- **Единая система обработчиков** - все обработчики теперь используют `EventHandlerManager`, устранены inline `addEventListener`

#### 🔧 **Технические улучшения:**
- **EventHandlerManager** - добавлена поддержка `overlayClick` в `createDelegatedHandlers()`
- **BaseDialog** - упрощена логика проверки клика на overlay
- **SplashScreenDialog** - переопределен `setupEventHandlers()` для добавления обработчика клика на container
- **Устранено дублирование** - удален отдельный метод `setupOverlayClickHandler()`, логика интегрирована в `setupEventHandlers()`

#### 📁 **Измененные файлы:**
- `src/event-system/EventHandlerManager.js` - добавлена обработка `overlayClick` в делегированных обработчиках
- `src/ui/BaseDialog.js` - упрощена проверка клика на overlay
- `src/ui/SplashScreenDialog.js` - переопределен `setupEventHandlers()` для закрытия по клику на container

#### 💡 **Преимущества:**
- **Консистентность** - все диалоги используют единую систему обработчиков
- **Надежность** - правильная очистка обработчиков при уничтожении диалогов
- **Удобство** - сплеш-окно закрывается кликом как вне, так и внутри окна
- **Поддерживаемость** - единый подход к регистрации обработчиков через `EventHandlerManager`

## [3.54.0] - 2025-01-28

### Enhanced - Улучшения системы курсоров и горизонтального скролла для табов ассетов

#### 🎯 **Новые функции:**
- **Горизонтальный скролл табов** - добавлен скролл колесом мыши и средней кнопкой для навигации по табам
- **Универсальная утилита скролла** - создан `HorizontalScrollUtils` для переиспользования в toolbar и табах
- **Улучшенные курсоры** - правильное отображение курсоров для всех состояний (палец, лапка, схватывание)
- **Скрытие скроллбара** - визуально скрыт скроллбар при сохранении функциональности
- **Сохранение позиции скролла** - позиция скролла табов сохраняется в пользовательских настройках

#### 🔧 **Технические улучшения:**
- **AssetTabsManager** - добавлены методы `setupHorizontalScrolling()` и `loadScrollPosition()`
- **CSS оптимизация** - упрощены стили курсоров, убрано дублирование правил
- **Event handling** - улучшена обработка событий drag-and-drop и скролла
- **Memory management** - добавлена правильная очистка обработчиков событий

#### 🐛 **Исправления:**
- **Курсор при перетаскивании** - убрана стрелка, показывается только зажатая лапка
- **Курсор при скролле** - корректное отображение зажатой лапки при скролле средней кнопкой
- **Курсор при наведении** - стабильное отображение пальца при наведении на табы
- **Конфликт drag/scroll** - исправлен конфликт между перетаскиванием табов и скроллом

#### 📁 **Измененные файлы:**
- `src/ui/AssetTabsManager.js` - добавлен горизонтальный скролл и улучшены курсоры
- `src/utils/HorizontalScrollUtils.js` - новая утилита для горизонтального скролла
- `src/ui/Toolbar.js` - рефакторинг для использования HorizontalScrollUtils
- `styles/panels.css` - упрощены стили курсоров, добавлены стили скролла
- `src/managers/UserPreferencesManager.js` - добавлена поддержка `assetTabsScrollLeft`
- `config/defaults/ui.json` - добавлено значение по умолчанию для скролла табов

#### 💡 **Преимущества:**
- **Консистентность** - одинаковое поведение скролла в toolbar и табах
- **UX улучшения** - интуитивные курсоры и плавная навигация
- **Производительность** - оптимизированная обработка событий
- **Поддерживаемость** - переиспользуемый код для скролла

---

## [3.53.0] - 2025-01-28

### Refactored - Рефакторинг системы табов панели ассетов и исправление multi-select

#### 🔄 **Архитектурные улучшения:**
- **AssetTabsManager** - выделен отдельный класс для управления табами панели ассетов
- **Модульность** - вся логика табов вынесена из AssetPanel в отдельный компонент
- **Устранение дублирования** - созданы helper-методы для проверки координат и типов drag-событий
- **Улучшенная архитектура** - AssetPanel теперь фокусируется только на отображении ассетов
- **Упрощение логики** - убрано дублирование кода, неиспользуемые методы удалены

#### 🐛 **Исправленные ошибки:**
- **Бесконечная рекурсия** - исправлена проблема с циклическими обновлениями состояния и рендеринга
- **Позиционирование табов** - исправлено отображение табов слева от элементов поиска
- **Drop overlay при старте** - исправлено случайное отображение overlay при запуске редактора
- **Размер drop overlay** - исправлен размер подсветки для соответствия только области превью ассетов
- **Multi-select фолдеров** - исправлена логика Shift+клика для выбора множества фолдеров
- **Multi-select табов** - исправлена логика Shift+клика на табах (добавление/удаление из selection)
- **Ограничение выбора** - исправлена проблема с невозможностью выбрать больше двух фолдеров
- **Авто-создание табов** - убрано автоматическое создание табов при выборе фолдеров (только при дропе)
- **Range selection** - исправлена логика range selection при Shift+клике (не очищает текущий выбор)

#### ✨ **Новые функции:**
- **Визуальная индикация запрета дропа** - красная подсветка с текстом "Can not create assets in this location" при попытке дропа в корневую папку
- **Улучшенная обработка drag-and-drop** - точное определение координат через helper-методы
- **CSS классы для drop overlay** - вынесены стили в `styles/panels.css` для переиспользования
- **Multi-select табов и фолдеров** - полноценная поддержка множественного выбора через Shift+клик

#### 🔧 **Технические улучшения:**
- **AssetTabsManager.js** - новый класс с методами `render()`, `syncTabToFolder()`, `addFolderTab()`, `removeFolderTab()`, `handleTabClick()`
- **Helper-методы** - `isExternalFilesDrag()`, `isOverTabsContainer()`, `isOverPreviewsContainer()` для устранения дублирования
- **CSS классы** - `.drop-overlay`, `.drop-overlay-visible`, `.drop-overlay-allowed`, `.drop-overlay-disallowed` в `styles/panels.css`
- **Упрощение кода** - удалены избыточные debug-логи, оставлены только критичные сообщения
- **Устранение инлайн-стилей** - все стили overlay перенесены в CSS файлы
- **Убрано дублирование** - удален неиспользуемый метод `_getSelectedFolderPath()`, упрощены подписки на события
- **Логика табов** - табы создаются только при дропе фолдеров, не автоматически при выборе
- **Упрощение подписок** - подписка на `selectedFolders` в AssetTabsManager только для визуального обновления

#### 📋 **Измененные файлы:**
- **`src/ui/AssetPanel.js`** - рефакторинг, делегирование логики табов в AssetTabsManager, убрано дублирование кода управления табами
- **`src/ui/AssetTabsManager.js`** - новый класс для управления табами (включая AssetTabContextMenu), исправлена логика multi-select
- **`src/ui/FoldersPanel.js`** - улучшена обработка динамически добавленных ассетов, исправлена логика Shift+клика для multi-select
- **`styles/panels.css`** - добавлены CSS классы для drop overlay
- **`src/managers/AssetManager.js`** - удалено автоматическое создание табов при сканировании
- **`src/core/LevelEditor.js`** - обновлена версия до 3.53.0

#### 🚀 **Преимущества:**
- **Модульность** - код табов изолирован и может быть переиспользован
- **Поддерживаемость** - изменения в логике табов не влияют на отображение ассетов
- **Производительность** - устранена бесконечная рекурсия, оптимизированы логи
- **Чистота кода** - убраны дубликаты, избыточные логи и инлайн-стили
- **Гибкость multi-select** - полноценная поддержка множественного выбора фолдеров и табов
- **Контроль создания табов** - табы создаются только пользователем через дроп, не автоматически

## [3.52.8] - 2025-01-28

### Fixed - Исправление контекстного меню табов панели ассетов

#### 🐛 **Исправленные ошибки:**
- **Контекстное меню не отображалось** - исправлена проблема с отображением контекстного меню при правом клике на табы панели ассетов
- **Неправильная регистрация обработчиков** - обработчики событий регистрировались на неправильный контейнер
- **CSS стили не применялись** - отсутствовал класс `.show` для отображения меню

#### 🔧 **Технические улучшения:**
- **Правильная последовательность инициализации** - обработчики теперь регистрируются после создания элементов (по образцу LayersPanel)
- **Делегирование событий** - обработчики регистрируются на `tabsContainer` вместо `container`
- **CSS классы** - используется правильный класс `.base-context-menu-item` для элементов меню
- **Убрана отладочная информация** - очищен код от временных console.log

## [3.52.7] - 2025-01-28

### Fixed - Исправление рамки селекта при отпускании клика за пределами канвы

#### 🐛 **Исправленные ошибки:**
- **Рамка селекта не завершалась** - исправлена проблема, когда рамка селекта (marquee selection) не завершалась при отпускании кнопки мыши за пределами канвы
- **Mouseup события не доходили** - mouseup события не захватывались глобальными обработчиками при отпускании клика вне области канвы

#### 🔧 **Технические улучшения:**
- **EventHandlerManager** - добавлена поддержка опций `addEventListener` (capture, passive) в метод `registerElement()`
- **GlobalEventRegistry** - автоматическое применение `capture: true` для обработчиков mouseup событий
- **Глобальные обработчики** - mouseup события теперь захватываются в фазе захвата для надежной работы вне канвы

## [3.52.6] - 2025-01-28

### Added - Контекстные меню для табов и исправления двойного клика

#### ✨ **Новые функции:**
- **Контекстные меню для табов панелей** - правый клик на табах показывает меню с опцией перемещения между панелями
- **Контекстные меню для assets табов** - правый клик на табах assets панели показывает меню с опцией "Close"
- **Поддержка двойного клика на разделителях** - добавлен параметр `onDoubleClick` в ResizerManager
- **Умное позиционирование меню** - контекстные меню автоматически позиционируются относительно viewport

#### 🔧 **Технические улучшения:**
- **EventHandlers** - добавлены методы `updateTabContextMenus()`, `handleTabContextMenu()`, `showAssetTabContextMenu()`, `closeAssetTab()`
- **ResizerManager** - расширен метод `registerResizer()` с поддержкой обработчика двойного клика
- **MutationObserver** - расширено отслеживание изменений для всех типов табов (`.tab-right`, `.tab-left`, `.tab`)
- **Предотвращение дублирования** - система автоматически предотвращает повторную регистрацию обработчиков

#### 🐛 **Исправленные ошибки:**
- **Двойной клик на разделителях** - устранены конфликты между обработчиками мыши и двойного клика
- **Порядок инициализации** - исправлен порядок вызовов для корректной работы контекстных меню
- **Защита от закрытия последнего таба** - система предотвращает закрытие последнего активного таба assets панели

## [3.52.5] - 2025-01-28

### Added - Параметр цвета разделителей

#### ✨ **Новые функции:**
- **resizerColor** - добавлен параметр цвета разделителей панелей в default settings
- **Интеграция с системой настроек** - цвет разделителей управляется через UI настройки
- **CSS переменная** - `--ui-resizer-color` для централизованного управления цветом
- **Обновлена документация** - добавлены примеры и описание нового параметра

#### 🔧 **Технические улучшения:**
- **ConfigManager** - загрузка resizerColor из JSON конфигурации
- **StateManager** - хранение состояния цвета разделителей
- **LevelEditor** - применение настроек через `_applyColorConfiguration()`
- **SettingsPanel** - интерфейс для изменения цвета через color picker

## [3.52.4] - 2025-01-27

### Fixed - Исправления контекстных меню

#### 🐛 **Исправленные ошибки:**
- **"No context menu instance found for BaseContextMenu"** - исправлена логика обнаружения экземпляров контекстных меню
- **Неправильный класс для поиска** - изменен с `context-menu` на `base-context-menu` для корректного обнаружения
- **Обработка null экземпляров** - добавлена graceful обработка случаев без экземпляров

#### 🔧 **Технические улучшения:**
- **Унифицированная логика** - создан вспомогательный метод `checkAndRegisterContextMenu`
- **Убрано дублирование кода** - единый метод для проверки и регистрации контекстных меню
- **Оптимизированы логи** - убраны избыточные debug сообщения для лучшей производительности
- **Улучшена читаемость** - код стал более лаконичным и понятным

#### 📋 **Поддерживаемые типы контекстных меню:**
- **`base-context-menu`** - основной класс для базовых контекстных меню
- **`canvas-context-menu`** - контекстные меню канваса
- **`asset-context-menu`** - контекстные меню ассетов
- **`asset-panel-context-menu`** - контекстные меню панели ассетов
- **`console-context-menu`** - контекстные меню консоли
- **`layers-context-menu`** - контекстные меню слоев
- **`outliner-context-menu`** - контекстные меню аутлайнера

#### 🚀 **Преимущества:**
- **Стабильная работа** - контекстные меню работают без ошибок
- **Автоматическое обнаружение** - система корректно находит и регистрирует обработчики
- **Graceful handling** - система работает даже при отсутствии экземпляров
- **Лучшая производительность** - убраны избыточные операции логирования

## [3.52.2] - 2025-01-27

### Refactored - Унификация логики resize для mouse

#### 🔄 **Устранение дублирования кода:**
- **Единая система расчета** - mouse использует унифицированные методы расчета размеров панелей
- **Унифицированные методы** - `calculatePanelSize()`, `calculateHorizontalPanelSize()`, `calculateVerticalPanelSize()`
- **Консистентное поведение** - идентичная логика для всех типов ввода
- **Легкость поддержки** - изменения в одном месте вместо дублирования

#### 🎯 **Технические улучшения:**
- **PanelPositionManager** - mouse handlers используют унифицированные методы
- **AssetPanel** - folders resizer использует унифицированную логику
- **API для внешнего использования** - `getUnifiedResizeMethods()` для других частей кода

#### 📋 **Поддерживаемые разделители:**
- **Горизонтальные:** left panel, right panel, folders resizer
- **Вертикальные:** console resizer, assets resizer
- **Автоматическое определение** - логика выбирается на основе типа разделителя

#### 🚀 **Преимущества:**
- **Меньше багов** - нет расхождений между разными типами ввода
- **Проще поддержка** - единая точка изменений
- **Переиспользование** - методы доступны для других компонентов
- **Консистентность** - одинаковое поведение для всех типов ввода

## [3.52.1] - 2025-01-27

### Added - Настройка цвета разделителей панелей

#### 🎨 **Новая настройка цвета разделителей:**
- **CSS переменная** `--ui-resizer-color` - централизованное управление цветом всех разделителей
- **Настройка в UI** - поле "Panel Resizers" в Settings → Colors
- **Применение при Apply** - цвет применяется только при нажатии "Apply Changes"
- **Поддержка всех разделителей** - горизонтальных и вертикальных разделителей панелей

#### 🔧 **Технические улучшения:**
- **Маппинг в SettingsSyncManager** - `ui.resizerColor` правильно маппится на StateManager
- **Обработка в applySpecialUISettings()** - цвет применяется через стандартный механизм настроек
- **Сохранение в пользовательских настройках** - изменения сохраняются в localStorage
- **Унифицированные стили** - все разделители используют одну CSS переменную

#### 📋 **Файлы изменены:**
- **`styles/main.css`** - добавлена CSS переменная `--ui-resizer-color`
- **`src/ui/SettingsPanel.js`** - добавлено поле настройки цвета разделителей
- **`src/utils/SettingsSyncManager.js`** - добавлен маппинг и обработка цвета разделителей
- **Стили разделителей** - обновлены для использования CSS переменной

### Fixed - Исправления системы настроек

#### 🐛 **Исправленные проблемы:**
- **Отсутствующий маппинг** - `ui.resizerColor` теперь правильно маппится в SettingsSyncManager
- **Применение цвета** - цвет разделителей теперь применяется при нажатии "Apply Changes"
- **Сохранение настроек** - изменения цвета разделителей сохраняются в пользовательских настройках
- **CSS переменные** - все разделители используют единую переменную для цвета

## [3.52.0] - 2025-01-27

### Added - Новая архитектура с разделением слоёв

#### 🎨 **Переработанная структура интерфейса:**
- **Разделение слоёв** - канва на нижнем слое, интерфейс на верхнем
- **Контейнер канвы** - отдельный абсолютно позиционированный контейнер для канвы
- **Прозрачность событий** - события проходят через flex контейнеры к канве
- **Оптимизация CSS** - устранено дублирование стилей панелей и разделителей

#### 🔧 **Технические улучшения:**
- **Canvas container** - `#canvas-container` с `z-index: 0` на нижнем слое
- **Flex контейнеры** - `pointer-events: none` для прозрачности событий
- **Панели** - `pointer-events: auto` для интерактивности
- **Общие классы** - `.tab-panel` и `.panel-resizer` для устранения дублирования
- **AutoEventHandlerManager** - поддержка canvas элементов

#### 📋 **Файлы изменены:**
- **`index.html`** - новая структура с canvas контейнером
- **`styles/main.css`** - прозрачность событий, позиционирование канвы
- **`styles/panels.css`** - оптимизированные стили панелей
- **`src/ui/PanelPositionManager.js`** - обновленные классы
- **`src/event-system/AutoEventHandlerManager.js`** - поддержка канвы

### Fixed - Исправления интерфейса

#### 🐛 **Исправленные проблемы:**
- **Header перекрытие** - канва больше не перекрывает верхнее меню
- **События мыши** - канва корректно реагирует на клики в центре экрана
- **Позиционирование** - canvas контейнер начинается ниже header (top: 40px)
- **Z-index слои** - правильная иерархия слоёв (header: 20, панели: 10, канва: 0)

## [3.51.12] - 2025-01-27

### Added - Унифицированная система управления панелями

#### 🎯 **Универсальная система сворачивания/разворачивания:**
- **Централизованное управление** - все операции с панелями в PanelPositionManager
- **Универсальный метод** `togglePanelCollapse()` - единая точка для всех типов панелей
- **Привязка к методу сворачивания** - позиционирование привязано к логике сворачивания, а не к событиям
- **Поддержка всех разделителей** - левая/правая панели, панель ассетов, панель папок

#### 🔧 **Технические улучшения:**
- **Универсальный метод** `updateResizerPosition()` - централизованное позиционирование разделителей
- **Специализированные методы** - `toggleTabPanelCollapse()`, `toggleAssetsPanelCollapse()`, `toggleFoldersPanelCollapse()`
- **Упрощенная архитектура** - удалены промежуточные слои, прямые вызовы методов
#### 📋 **Файлы изменены:**
- **`src/ui/PanelPositionManager.js`** - универсальная система управления панелями

### Fixed - Исправления и очистка кода

#### 🐛 **Исправления:**
- **Ошибка `Cannot read properties of undefined`** - исправлена ссылка на panelPositionManager
- **Удален лишний код** - console.log и неиспользуемые методы
- **Очистка дублирования** - устранено дублирование кода между компонентами

#### 📋 **Файлы изменены:**
- **`src/ui/PanelPositionManager.js`** - удален console.log

## [3.51.11] - 2025-01-27

### Added - Поддержка панелей интерфейса в системе обработчиков событий

#### 🎯 **Новая функциональность панелей:**
- **Автоматическое обнаружение панелей** - система теперь распознает панели интерфейса
- **Регистрация элементов панелей** - автоматическая регистрация обработчиков для дочерних элементов
- **Поддержка типов панелей** - добавлены типы `asset-panel` и `layers-panel`
- **Обработчики элементов интерфейса** - специализированные обработчики для кнопок, полей ввода и элементов списка

#### 🔧 **Элементы панелей с поддержкой:**
- **Элементы слоев** - `.layer-item`, `.layer-visibility-btn`, `.layer-lock-btn`, `.layer-color`
- **Поля ввода** - `#layers-search`, `[id^="layer-name-"]`, `.layer-parallax-input`
- **Кнопки действий** - `#add-layer-btn` (Shift+Click для добавления 3 слоев)
- **Автоматическая регистрация** - все элементы регистрируются без дополнительного кода

#### 📋 **Файлы изменены:**
- **`src/event-system/AutoEventHandlerManager.js`** - добавлена поддержка панелей и элементов интерфейса
- **`src/event-system/EventHandlerManager.js`** - добавлен тип элемента `custom` и `panel`
- **`docs/EVENT_HANDLER_SYSTEM.md`** - обновлена документация с информацией о панелях

### Fixed - Исправления ошибок в системе обработчиков событий

#### 🐛 **Критические исправления:**
- **Ошибка `className.includes is not a function`** - безопасная проверка типа className
- **Оптимизация производительности** - строгие проверки элементов для предотвращения лишней обработки
- **Предотвращение дублирования** - проверки для избежания повторной обработки элементов

#### 📋 **Файлы изменены:**
- **`src/managers/AutoEventHandlerManager.js`** - исправления ошибок и оптимизации

## [3.51.9] - 2025-01-27

### Fixed - Инвертированная система z-индексов слоёв

#### 🎯 **Изменение логики z-индексов:**
- **Инвертированный порядок** - верхний слой теперь имеет максимальный z-индекс
- **Логичная иерархия** - нижний слой имеет минимальный z-индекс
- **Совместимость** - все существующие объекты автоматически обновляются

#### 🔧 **Технические изменения:**
- **`Level.updateLayerIndices()`** - изменена логика расчёта индексов слоёв
- **`Layer.setOrder()`** - убрана перезапись индекса, управление через Level
- **Обновлены комментарии** - исправлены устаревшие упоминания 0-based индексов

#### 📋 **Файлы изменены:**
- **`src/models/Level.js`** - инвертированная логика в updateLayerIndices()
- **`src/models/Layer.js`** - убрана перезапись индекса в setOrder()

## [3.51.8] - 2025-01-27

### Added - Централизованная система обработчиков событий

#### 🎯 **EventHandlerManager - новая архитектура:**
- **Централизованное управление** - единая система для всех обработчиков событий
- **Автоматическая очистка** - предотвращение утечек памяти при удалении элементов
- **Глобальные обработчики** - автоматическая обработка ESC и overlay кликов
- **Типизированные элементы** - поддержка dialog, button, input, form, contextMenu
- **Безопасная работа с DOM** - проверки существования элементов и обработка ошибок

#### 🛠️ **EventHandlerUtils - упрощение работы:**
- **Готовые шаблоны** - createDialogHandlers, createButtonHandlers, createInputHandlers
- **Упрощенный API** - addDialogEventHandling, addButtonEventHandling, addInputEventHandling
- **Автоматическая привязка контекста** - правильный `this` для всех обработчиков
- **Стандартные обработчики** - типовые сценарии для диалогов, кнопок, полей ввода

#### 🔄 **Интеграция с существующими компонентами:**
- **SettingsPanel** - полная миграция на новую систему
- **ActorPropertiesWindow** - полная миграция на новую систему
- **UniversalDialog** - полная миграция на новую систему
- **BaseContextMenu** - полная миграция на новую систему
- **AssetPanel** - миграция с централизованными обработчиками и делегированием
- **Toolbar** - полная миграция на новую систему

#### 🚀 **Оптимизация системы обработчиков:**
- **Делегирование событий** - один обработчик на контейнер вместо множества на элементы
- **Централизованные обработчики** - отдельные классы для каждого типа компонента
- **Изоляция логики** - обработчики вынесены из компонентов в отдельные классы
- **Переиспользование** - обработчики можно использовать в разных компонентах
- **Автоматическая очистка** - система сама удаляет обработчики при уничтожении элементов

#### 🤖 **Автоматическая система обработчиков (NEW):**
- **AutoEventHandlerManager** - автоматическое обнаружение и регистрация обработчиков для всех окон
- **UniversalWindowHandlers** - универсальные обработчики для всех типов окон
- **MutationObserver** - отслеживание новых окон в DOM
- **Нулевая настройка** - новые окна автоматически получают обработчики
- **Отказоустойчивость** - система работает даже если методы не найдены

#### 🗑️ **Упрощение архитектуры (NEW):**
- **Удален `src/handlers/AssetPanelHandlers.js`** - избыточный файл
- **Упрощена AssetPanel** - больше не нужна ручная регистрация обработчиков
- **Универсальная система** - один `UniversalWindowHandlers.js` для всех компонентов
- **Автоматическая работа** - новые компоненты работают без кода

#### 📋 **Новые файлы:**
- **`src/managers/EventHandlerManager.js`** - центральный менеджер обработчиков событий
- **`src/utils/EventHandlerUtils.js`** - утилиты для упрощения работы
- **`src/managers/AutoEventHandlerManager.js`** - автоматическая система регистрации обработчиков
- **`src/handlers/UniversalWindowHandlers.js`** - универсальные обработчики для всех окон
- **`docs/EVENT_HANDLER_SYSTEM.md`** - подробное руководство по использованию

#### 🚀 **Улучшения архитектуры:**
- **Устранение дублирования** - единый подход к обработке событий
- **Автоматическое управление** - не нужно помнить об очистке обработчиков
- **Централизованная отладка** - логирование всех событий в одном месте
- **Расширяемость** - легко добавлять новые типы элементов

## [3.51.7] - 2025-01-27

### Fixed - Критические исправления жестов

#### 🎯 **Исправления pan/zoom жестов:**
- **Полное восстановление функциональности** - pan и zoom жесты снова работают на канве
- **Исправлена блокировка жестов** - устранены конфликты между системами блокировки
- **Правильная инициализация** - исправлен порядок инициализации поддержки жестов
- **Объединение конфигураций** - поддержка множественных типов жестов на одном элементе

#### 🔧 **Технические исправления:**
- **Исправлен passive event listeners** - move события теперь non-passive для pan/zoom
- **Добавлен preventDefault** - правильная блокировка браузерных жестов
- **Исправлено замыкание** - обработчики событий получают актуальную конфигурацию
- **Приоритет при объединении** - существующие обработчики сохраняются при добавлении новых

#### 🚀 **Улучшения системы:**
- **Загрузка настроек пользователя** - pan/zoom настройки загружаются из конфигурации
- **Удалены отладочные логи** - очищен код от временных логов отладки
- **Оптимизированная производительность** - обработчики событий настраиваются только один раз
- **Улучшенная стабильность** - все типы жестов работают одновременно без конфликтов

#### 📋 **Поддерживаемые жесты:**
- **Marquee selection** - выделение рамкой (однопальцевый)
- **Two-finger pan** - панорамирование двумя пальцами
- **Two-finger zoom** - масштабирование двумя пальцами
- **Two-finger context** - контекстное меню двумя пальцами
- **Combined pan/zoom** - одновременное pan и zoom

## [3.51.6] - 2025-01-27

### Improved - Улучшения интерфейса консоли

#### 🎯 **Улучшения консоли:**
- **Кликабельная шапка консоли** - вся шапка консоли теперь активна для закрытия одним кликом
- **Увеличенная кнопка закрытия** - кнопка X стала больше с отступами `px-3 py-2` и размером `text-lg`
- **Унифицированная система** - консоль использует `EventHandlers.togglePanel('console')` вместо старых функций
- **Адаптивные ограничения размера** - консоль ограничена 70% экрана для доступности сепаратора
- **Drag для сепаратора** - добавлена поддержка изменения размера консоли
- **Двойной клик на сепараторе** - двойной клик на сепараторе закрывает консоль

#### 🔧 **Технические улучшения:**
- **Оптимизированный код** - создана единая функция `closeConsole()` вместо дублирования логики
- **DRY принцип** - устранено 32+ строки дублированного кода
- **Улучшенная архитектура** - консоль интегрирована в унифицированную систему управления панелями
- **Fallback поддержка** - сохранена совместимость со старыми функциями при недоступности редактора
- **Детекция устройств** - автоматическое определение маленьких окон
- **Контекстное меню** - контекстное меню консоли автоматически скрывается при закрытии консоли
- **Исправлены конфликты сепараторов** - устранены конфликты между обработчиками
- **Унифицированная архитектура** - все обработчики используют единую систему
- **Правильная регистрация** - поддержка регистрируется в LevelEditor

#### 🎨 **UI улучшения:**
- **Визуальная обратная связь** - добавлен `hover:bg-gray-800` для шапки консоли
- **Улучшенная доступность** - увеличенная область клика для закрытия консоли
- **Консистентный дизайн** - шапка консоли соответствует общему стилю интерфейса
- **Мобильная адаптация** - консоль адаптируется под размер экрана и тип устройства

## [3.51.5] - 2025-01-27

### Fixed - Исправления сохранения позиций разделителей панелей

#### 🎯 **Исправления сохранения позиций:**
- **Сохранение позиций боковых панелей** - позиции разделителей левой и правой панелей теперь сохраняются через stateManager
- **Восстановление позиций при рестарте** - позиции разделителей корректно восстанавливаются из userPrefs
- **Синхронизация с userPrefs** - все изменения позиций сохраняются в пользовательских настройках
- **Инициализация позиций** - начальные позиции панелей устанавливаются из сохраненных настроек

#### 🔧 **Технические улучшения:**
- **PanelPositionManager** - добавлен метод `initializePanelWidths()` для установки начальных позиций
- **Сохранение при завершении** - позиции сохраняются в `handleMouseUp` при завершении изменения размера
- **Интеграция с stateManager** - позиции синхронизируются между stateManager и userPrefs
- **Унифицированная система** - единый подход к сохранению позиций для всех панелей

## [3.51.4] - 2025-01-27

### Fixed - Исправлены поля форм без id атрибутов и синхронные XMLHttpRequest

#### 🎯 **Исправления доступности:**
- **Добавлены уникальные id атрибуты ко всем полям ввода** - решена проблема с автозаполнением форм в браузере
- **Исправлены поля в SettingsPanel.js** - чекбоксы, слайдеры, числовые и цветовые поля
- **Исправлены поля в GridSettings.js** - настройки сетки, осей и привязки
- **Исправлены поля в DetailsPanel.js** - поля позиции и размера объектов
- **Исправлены поля в LayersPanel.js** - поля имен слоев, цветов и параллакса
- **Исправлены поля в OutlinerPanel.js** - поля редактирования имен групп и объектов
- **Исправлены поля в FolderPickerDialog.js** - поле выбора папки
- **Исправлены поля в MenuPositioningUtils.js** - чекбоксы в контекстных меню

#### 🎯 **Исправления производительности:**
- **Заменены синхронные XMLHttpRequest на асинхронные fetch** - устранено предупреждение браузера о блокировке главного потока
- **Обновлен ConfigManager.js** - все методы загрузки конфигураций теперь асинхронные
- **Улучшена загрузка конфигураций** - используется Promise.all для параллельной загрузки файлов
- **Обновлены все вызовы методов** - SettingsPanel.js и UserPreferencesManager.js адаптированы под async/await

#### 🎯 **Технические улучшения:**
- **Все поля теперь имеют уникальные идентификаторы** - улучшена совместимость с браузерными функциями
- **Сохранена функциональность** - все изменения обратно совместимы
- **Улучшена доступность** - поля корректно работают с автозаполнением и скрин-ридерами
- **Улучшена производительность** - устранена блокировка UI при загрузке конфигураций

## [3.51.3] - 2025-01-27

### Added - Добавлена команда тоггла консоли в меню View

#### 🎯 **Новая функциональность:**
- **Добавлена команда "Console" в секцию Panels меню View** - позволяет переключать видимость консоли
- **Интегрирована консоль в универсальную систему управления панелями** - использует `applyPanelVisibility()`
- **Добавлена поддержка консоли в Immersive Mode** - консоль скрывается/восстанавливается корректно
- **Синхронизация состояния консоли с чекбоксом меню** - корректное отображение состояния

#### 🎯 **Технические улучшения:**
- **Расширен `panelConfig` для поддержки консоли** - добавлен тип 'dom' с элементами console-panel и resizer-console
- **Обновлены все массивы панелей** - console добавлена в panelStates, panelOptions, panelToggles
- **Добавлена обработка console в `updateViewCheckbox()`** - корректное маппирование на toggle-console
- **Интегрирована консоль в систему сохранения/восстановления состояний** - работает с StateManager

#### 🎯 **Исправления синхронизации:**
- **Исправлен конфликт клавиатурного шортката** - клавиша ` теперь использует `EventHandlers.togglePanel('console')`
- **Унифицированы все способы управления консолью** - клавиша, меню, кнопка закрытия используют StateManager
- **Исправлена инициализация консоли** - использует `stateManager.get('console.visible')` вместо `userPrefs.get('consoleVisible')`
- **Обновлены функции showConsole/hideConsole** - сохраняют состояние через `stateManager.set('console.visible')`
- **Добавлена синхронизация после инициализации** - обновляет StateManager с актуальным состоянием консоли

#### 🎯 **Исправления клавиатуры:**
- **Исправлена проблема с "зажиманием" Alt клавиши** - добавлена обработка Alt в `EventHandlers.setupKeyboardEvents()`
- **Добавлено состояние `keyboard.altKey` в StateManager** - отслеживание состояния Alt клавиши
- **Обновлен метод `isAltKeyPressed()`** - проверяет как `mouse.altKey`, так и `keyboard.altKey`
- **Устранена рассинхронизация** - теперь Alt состояние корректно отслеживается и сбрасывается

## [3.51.2] - 2025-01-27

### Fixed - Исправления позиционирования меню и активации табов

#### 🎯 **Исправления позиционирования меню:**
- **Исправлено позиционирование меню фильтра outliner** - корректно позиционируется при переносе в правую панель
- **Создана утилита MenuPositioningUtils** - стандартизированное позиционирование для всех меню
- **Унифицированы CSS классы меню** - консистентный внешний вид всех popup меню
- **Исправлена логика скрытия меню** - используется логика из BaseContextMenu (mouseleave + click)
- **Оптимизирован код OutlinerPanel** - убрано дублирование, сокращен код с ~50 до ~15 строк

#### 🎯 **Исправления активации табов:**
- **Исправлена логика активации при переносе табов** - перенесенный таб активируется, остальные деактивируются
- **Добавлена активация таба, ближайшего к сепаратору** - при переносе активируется крайний к main-panel таб
- **Исправлено восстановление активных табов при рестарте** - корректно восстанавливаются сохраненные табы
- **Устранена проблема авто-селекта при инициализации** - не перезаписывает сохраненное состояние
- **Исправлен порядок инициализации** - сначала позиции, затем активация табов

#### ✅ **Улучшения архитектуры:**
- **Создан MenuPositioningUtils** - переиспользуемая утилита для позиционирования меню
- **Унифицирована логика получения типов объектов** - метод `getObjectTypes()` в утилите
- **Исправлен поток данных StateManager → ConfigManager** - через подписки без дублирования
- **Оптимизирована логика активации табов** - убрано дублирование кода

#### 📁 **Измененные файлы:**
- **Новый:** `src/utils/MenuPositioningUtils.js` - утилита для позиционирования меню
- **Обновлен:** `src/ui/OutlinerPanel.js` - оптимизирован код меню фильтра
- **Обновлен:** `src/ui/PanelPositionManager.js` - исправлена логика активации табов
- **Обновлен:** `src/core/EventHandlers.js` - добавлены методы активации табов

## [3.51.1] - 2025-01-27

### Fixed - Исправления панелей, табов и настроек

#### 🎯 **Исправления панелей:**
- **Исправлена логика создания левой панели** - не создается когда все табы в правой панели
- **Исправлено восстановление правой панели** - корректно восстанавливается при переносе табов
- **Унифицирована логика удаления панелей** - все пустые панели удаляются полностью
- **Исправлена бесконечная рекурсия** - устранена ошибка "Maximum call stack size exceeded"
- **Исправлено обрезание табов** - табы левой панели правильно обрезаются при уменьшении

#### 🎯 **Исправления табов:**
- **Исправлена инициализация позиций табов** - правильный порядок операций при запуске
- **Исправлена валидация активных табов** - табы активируются только в существующих панелях
- **Исправлено сохранение позиций табов** - корректно сохраняются при закрытии редактора

#### 🎯 **Исправления настроек:**
- **Исправлен диапазон zoom threshold** - минимальное значение 0.01, максимальное 0.5
- **Исправлены значения по умолчанию** - соответствуют диапазону слайдера
- **Исправлена консистентность настроек** - одинаковые значения во всех файлах

#### ✅ **Улучшения кода:**
- **Убрано дублирование кода** - унифицированы вызовы обновления UI
- **Упрощена логика активации табов** - создан унифицированный метод `_activatePanelTab()`
- **Удален устаревший метод** - `setActiveRightPanelTab()` заменен на `setActivePanelTab()`
- **Добавлены CSS стили для табов** - правильное обрезание и сжатие при переполнении

## [3.51.0] - 2025-01-27

### Added - Отдельные состояния табов для левой и правой панелей

#### 🎯 **Новые функции:**
- **Отдельные состояния `leftPanelTab` и `rightPanelTab`** - независимое управление табами
- **Независимый селект табов** - переключение в одной панели не сбрасывает селект в другой
- **Корректное отображение контента** - контент показывается только для активного таба в соответствующей панели

#### ✅ **Улучшения:**
- **Убрано дублирование кода в StateManager** - создан метод `createInitialState()`
- **Обновлена конфигурация** - добавлен `leftPanelTabOrder` в настройки панелей
- **Исправлена логика показа контента** - поиск контент-панелей в правильных контейнерах

## [3.51.0] - 2025-01-27

### Fixed - Унифицированная логика сепараторов и тач-поддержка

#### 🎯 **Исправления:**
- **Унифицирована логика дабл-клика сепараторов** - единая система для всех панелей
- **Упрощено управление состояниями** - только через StateManager, без дублирования
- **Исправлена ошибка `newSize is not defined`** - убрано избыточное логирование
- **Добавлен `leftPanelWidth` в UserPreferencesManager** - устранено предупреждение
- **Исправлено зеркальное движение разделителей** - корректная работа для правой панели и ассетной панели
- **Убрано дублирование логики** - единая система для всех типов событий

#### ✅ **Улучшения:**
- **Убраны локальные переменные `previousSizeRef`** - все состояния в StateManager
- **Исправлена логика сворачивания/разворачивания** - корректное сохранение позиций
- **Упрощена логика управления** - читает позиции только из StateManager
- **Убрано избыточное сохранение состояний** - позиция уже сохраняется при изменении
- **Создан унифицированный метод `handlePanelResize`** - единая логика применения размеров
- **Убрана дублирующая логика** между разными типами событий

#### 🔧 **Технические детали:**
- **Обновлен:** `src/ui/PanelPositionManager.js` - убраны локальные переменные previousSizeRef, добавлен handlePanelResize
- **Обновлен:** `src/managers/UserPreferencesManager.js` - добавлен leftPanelWidth
- **Обновлен:** `src/managers/StateManager.js` - добавлен assetsPanelPreviousHeight

## [3.50.8] - 2025-01-27

### Added - Универсальная система управления позицией панелей

#### 🎯 **Новая функциональность:**
- **Добавлена опция переноса правой панели на левую сторону** - кнопка ⇄ в заголовке панели
- **Создан универсальный PanelPositionManager** для управления позицией всех панелей
- **Унифицирован подход** к переключению позиции панелей (folders и right panel)

#### ✅ **Улучшения:**
- **Исправлено направление движения разделителя** при переносе панели на левую сторону
- **Оптимизированы вызовы canvas** - создана универсальная функция updateCanvas()
- **Устранены дублирующиеся слушатели событий** - удален лишний window resize слушатель
- **Исправлены утечки памяти** - все слушатели теперь правильно отключаются

#### 🔧 **Технические детали:**
- **Новый компонент:** `src/ui/PanelPositionManager.js` - универсальный менеджер позиций панелей
- **Обновлены:** `LevelEditor.js`, `EventHandlers.js`, `AssetPanel.js` - интеграция с PanelPositionManager
- **Исправлены:** `index.html`, `FoldersPanel.js` - устранение дублирующихся слушателей
- **Оптимизирован код:** убрано 8+ дублирующихся вызовов canvas, улучшена производительность

#### 📊 **Результат:**
- Единый подход к управлению позицией панелей
- Правильная работа разделителя в обеих позициях
- Оптимизированная производительность
- Устранены утечки памяти

## [3.50.7] - 2025-01-27

### Fixed - Доработка цветов интерфейса и оптимизация кода

#### 🎯 **Проблема:**
- Выпадающие меню основного меню без UI Background переменной
- Неправильные цвета в панели Layers (Active вместо UI Text Color)
- Дублирование CSS стилей и лишний код

#### ✅ **Решение:**
- **Добавлена UI Background переменная** для выпадающих меню основного меню
- **Исправлены цвета панели Layers** - заменен Active Text Color на UI Text Color
- **Оптимизирован код** - убрано дублирование CSS правил и упрощены комментарии

#### 🔧 **Технические детали:**
- Обновлены `MenuManager.js`, `config/menu.js` - добавлены CSS переменные для меню
- Исправлены `LayersPanel.js`, `layers-panel.css` - заменены цвета на UI Text Color
- Оптимизированы `main.css`, `AssetPanel.js` - убрано дублирование и лишний код
- 209 использований CSS переменных в 18 файлах

## [3.50.6] - 2025-01-27

### Fixed - Унификация цветов текста в интерфейсе

#### 🎯 **Проблема:**
- Настройка UI Text Color применялась не ко всем элементам интерфейса
- Жестко заданные цвета в коде и CSS перекрывали переменные
- Неправильные цвета в режимах отображения Assets панели

#### ✅ **Решение:**
- **Заменены все жестко заданные цвета** на CSS переменные `--ui-text-color` и `--ui-active-text-color`
- **Исправлены стили тулбара и меню** - добавлены CSS правила с `!important`
- **Унифицированы цвета Assets панели** для всех режимов (Grid, List, Details)
- **Правильное применение переменных** для выбранных/неактивных элементов

#### 🔧 **Технические детали:**
- 185 использований CSS переменных в 17 файлах
- Исправлены стили в `styles/main.css`, `styles/spacing-mode.css`
- Обновлены компоненты: Toolbar, MenuManager, AssetPanel, LayersPanel, DetailsPanel
- CSS селекторы `.selected` и `.selected *` для корректного переопределения цветов

## [3.50.5] - 2025-01-27

### Fixed - Восстановление Player Start объектов

#### 🎯 **Проблема:**
- **Отсутствующий вызов**: `updateLevelStatsPanel()` не вызывался, поэтому логика восстановления не работала
- **Несуществующий элемент**: Метод искал элемент `level-stats-content`, который отсутствует в HTML
- **Дублированный код**: Метод `countPlayerStartObjects()` не использовался

#### ✅ **Решение:**
- **Новый метод `ensurePlayerStartExists()`**: Проверяет и автоматически создает Player Start
- **Интеграция в `updateAllPanels()`**: Добавлен вызов проверки при каждом обновлении
- **Автоматическая проверка**: В `updateCachedLevelStats()` и после удаления объектов
- **Защита от рекурсии**: Исключение undo/redo операций и предотвращение бесконечных циклов

#### 🔧 **Технические детали:**
- Использует кэшированную статистику через `GroupTraversalUtils.getAllObjects()`
- Создает Player Start в координатах (0,0) с стандартными параметрами
- Логирование создания через `Logger.lifecycle.info()`
- Обновление истории и кэшей после создания

## [3.50.4] - 2025-01-27

### Fixed - Исправление ошибок "message channel closed" от браузерных расширений

#### 🎯 **Корень проблемы:**
- **File System Access API конфликты**: Браузерные расширения (блокировщики рекламы, средства безопасности) прерывают сообщения между веб-страницей и браузером
- **Отсутствие таймаутов**: File System Access API операции могли зависать при конфликтах с расширениями
- **Дублирование кода**: Функция `isExtensionError` дублировалась в 4 файлах

#### 🔧 **Технические исправления:**
- **Централизованная обработка**: Создан `ExtensionErrorUtils.js` для единого управления ошибками расширений
- **Таймауты для API**: Добавлены таймауты для всех File System Access API операций (5-15 секунд)
- **Автоматические fallback**: Graceful degradation при конфликтах с расширениями
- **Глобальная фильтрация**: Обработчики `window.addEventListener('error')` и `window.addEventListener('unhandledrejection')`

#### 📋 **Функциональность:**
- ✅ **FolderPickerDialog**: Автоматический fallback на input dialog при конфликтах
- ✅ **AssetPanel**: Понятные сообщения об ошибках с предложением отключить расширения
- ✅ **FileUtils**: Fallback на download метод при проблемах с File System Access API
- ✅ **Глобальная защита**: Фильтрация ошибок расширений на уровне приложения

#### 🎨 **Архитектурные улучшения:**
- **DRY принцип**: Устранено дублирование ~100 строк кода
- **Централизованная логика**: Все паттерны ошибок расширений в одном месте
- **Консистентный API**: Стандартизированные методы обработки ошибок
- **Улучшенная поддерживаемость**: Единая точка для обновления паттернов ошибок

#### 📊 **Код изменений:**
```javascript
// ExtensionErrorUtils.js - Централизованная обработка
export class ExtensionErrorUtils {
    static EXTENSION_ERROR_PATTERNS = [
        'message channel closed',
        'extension context invalidated',
        'receiving end does not exist',
        // ... другие паттерны
    ];
    
    static withTimeout(operationPromise, timeoutMs, operation) {
        return Promise.race([operationPromise, this.createTimeoutPromise(timeoutMs, operation)]);
    }
    
    static async handleFileSystemError(error, fallbackFunction, context) {
        // Автоматическая обработка ошибок с fallback
    }
}

// Использование в компонентах
const directoryHandle = await ExtensionErrorUtils.withTimeout(
    window.showDirectoryPicker({ mode: 'read' }),
    10000,
    'Directory picker'
);
```

### Performance - Устойчивость к конфликтам расширений
- **Предотвращение зависаний**: Таймауты защищают от бесконечного ожидания
- **Автоматические fallback**: Graceful degradation при проблемах с API
- **Улучшенный UX**: Понятные сообщения об ошибках для пользователей
- **Отказоустойчивость**: Приложение продолжает работать несмотря на конфликты

## [3.50.3] - 2025-01-27

### Fixed - Полное исправление дабл-клика разделителей панелей

#### 🎯 **Корень проблемы:**
- **Блокировка событий**: `pointerEvents = 'none'` в mousedown блокировал генерацию click/dblclick событий
- **Порядок инициализации**: Обработчики настраивались до создания window.editor
- **Утечки памяти**: Слушатели StateManager не отменялись при уничтожении

#### 🔧 **Технические исправления:**
- **Убрана блокировка**: Удалено `pointerEvents = 'none'` из mousedown обработчиков
- **Правильный порядок**: setupPanelResizing() вызывается после создания window.editor
- **Управление подписками**: Добавлено сохранение и отмена подписок StateManager в destroy()
- **Очистка кода**: Убраны все отладочные console.log, оставлены только Logger вызовы

#### 📋 **Функциональность:**
- ✅ **Правый разделитель**: Дабл-клик сворачивает/разворачивает правую панель
- ✅ **Панель ассетов**: Дабл-клик сворачивает/разворачивает нижнюю панель
- ✅ **Синхронизация**: StateManager ↔ DOM ↔ user preferences
- ✅ **Перетаскивание**: Работает без `pointerEvents = 'none'`
- ✅ **Логирование**: Logger.layout.info при двойном клике

#### 🎨 **Архитектурные улучшения:**
- **Управление памятью**: Подписки StateManager правильно отменяются в destroy()
- **Разделение ответственности**: Обработчики событий ↔ слушатели StateManager ↔ DOM
- **Consistency**: Единый подход к управлению подписками во всех компонентах
- **Производительность**: Нет утечек памяти при пересоздании LevelEditor

#### 📊 **Код изменений:**
```javascript
// LevelEditor.js - Управление подписками
this.subscriptions = []; // В конструкторе

// Сохранение ссылок на отписку
const unsubscribe = this.stateManager.subscribe('panels.rightPanelWidth', callback);
this.subscriptions.push(unsubscribe);

// Отмена в destroy()
this.subscriptions.forEach(unsubscribe => unsubscribe());
this.subscriptions = [];
```

### Performance - Оптимизация управления памятью
- **Утечки памяти**: Исправлены утечки подписок StateManager
- **Правильное уничтожение**: Все подписки отменяются при destroy()
- **Масштабируемость**: Безопасное пересоздание LevelEditor без накопления слушателей

## [3.50.2] - 2025-01-27

### Fixed - Исправления стилей разделителей

#### 🎨 **Исправления разделителей:**
- **Ориентация hover индикатора**: Исправлена ориентация для горизонтального разделителя (resizer-assets)
- **Пропавший hover элемент**: Исправлен отсутствующий hover элемент для вертикального разделителя между Content и Assets
- **Оптимизация CSS**: Устранено дублирование кода в стилях разделителей

#### 🔧 **Технические детали:**
- Исправлены размеры `.resizer-y::after` с вертикальных (2px × 20px) на горизонтальные (20px × 2px)
- Добавлены отсутствующие стили для класса `.resizer-x` в AssetPanel
- Обновлен JavaScript AssetPanel для использования класса `.resizing` вместо inline стилей
- Объединены общие CSS свойства для уменьшения дублирования кода

## [3.50.1] - 2025-01-27

### Fixed - Автоматический скролл консоли с умным управлением

#### 📜 **Автоматический скролл консоли:**
- **Авто-скролл по умолчанию**: Консоль автоматически скроллит к последней записи
- **Умное поведение**: Автоматически отключается при ручном скролле вверх
- **Автоматическое включение**: Включается при скролле к низу консоли
- **Оптимизированный скролл**: Использует `requestAnimationFrame` для плавности

#### 🎛️ **Управление авто-скроллом:**
- **Контекстное меню**: Пункт "Toggle Auto Scroll" с иконкой 📜
- **Консольная команда**: `autoscroll` для переключения режима
- **Визуальная обратная связь**: Статус отображается в логах консоли
- **Мгновенный скролл**: При включении сразу скроллит к последней записи

#### 🔧 **Технические улучшения:**
- **Правильный элемент скролла**: Исправлен скролл контейнера с `overflow-y-auto`
- **Безопасная обработка**: Защита от ошибок скролла и рекурсии
- **Детекция скролла**: Отслеживание ручного скролла с задержкой 150мс
- **Точность детекции**: Проверка нахождения внизу с погрешностью 5px

#### 📋 **Функциональность:**
- **При открытии консоли**: Автоматически скроллит к последней записи
- **При новых логах**: Автоматически скроллит если режим включен
- **При включении авто-скролла**: Мгновенно скроллит к низу
- **При инициализации**: Скроллит если консоль уже видима

## [3.50.0] - 2025-01-27

### Added - Компактный лейаут для панели Details с унифицированными секциями

#### 🎨 **Новый компактный дизайн панели Details:**
- **Структурированные секции**: Basic Properties, Transforms, Visual, Advanced, Custom Properties, Layer Information
- **Единый стиль**: Все секции используют одинаковый дизайн с серым фоном и рамками
- **Компактные Transforms**: Позиции X,Y и размеры W,H в одной строке с подписями слева
- **Консистентный интерфейс**: Одинаковый порядок секций во всех режимах

#### 📐 **Улучшенная секция Transforms:**
- **Компактные поля**: X, Y, Width, Height в двух строках
- **Визуальные подписи**: Буквы X, Y, W, H слева от полей ввода
- **Единообразный стиль**: Одинаковый дизайн для одиночных и множественных объектов
- **Умная обработка**: Автоматическое обновление значений при изменении

#### 🔧 **Унифицированные секции:**
- **Basic Properties**: Name и Type объектов
- **Visual Properties**: Color picker с предпросмотром
- **Advanced Properties**: Z-Index с правильной обработкой слоев
- **Custom Properties**: Динамическое добавление свойств с кнопкой "Add Property"
- **Layer Information**: Информация о слоях с цветовыми индикаторами

#### 🎯 **Поддержка всех режимов:**
- **Одиночные объекты**: Полный набор секций с редактированием
- **Множественный выбор**: Умная обработка разных значений ("multiple values")
- **Группы**: Статистика содержимого + все свойства группы
- **Уровень**: Статистика уровня + действия (Set Camera Start Position)

#### ⚡ **Оптимизация кода:**
- **Устранение дублирования**: Создан общий метод `createTransformsSectionHTML()`
- **Сокращение кода**: Удалено ~60 строк дублированного HTML
- **Улучшенная поддерживаемость**: Изменения в одном месте применяются везде
- **Консистентная архитектура**: Единообразные методы для всех типов объектов

#### 🎨 **Улучшения UX:**
- **Предсказуемый интерфейс**: Секции всегда в одном порядке
- **Визуальная иерархия**: Четкое разделение на логические группы
- **Цветовое кодирование**: Статистика с цветными индикаторами
- **Интуитивная навигация**: Легко найти нужные свойства

#### 📁 **Измененные файлы:**
- `src/ui/DetailsPanel.js` - Полная реструктуризация с компактным лейаутом
- `src/core/LevelEditor.js` - Обновлена версия до 3.50.0

#### 🔄 **Обратная совместимость:**
- ✅ Все существующие функции сохранены
- ✅ Обработчики событий работают как раньше
- ✅ Кастомные свойства поддерживаются полностью
- ✅ Layer Information отображается корректно

---

## [3.49.6] - 2025-01-27

### Fixed - Исправления drag-n-drop и tab dragging в AssetPanel

#### 🎯 **Исправление конфликта drag-n-drop при перетаскивании табов:**
- **Проблема**: При перетаскивании табов срабатывала подсветка drop для файлов
- **Причина**: Класс `drag-over` использовался как для табов, так и для drop подсветки файлов
- **Решение**: Разделены классы на `tab-drag-over` для табов и `drag-over` для файлов

#### 🔧 **Исправление множественных обработчиков событий:**
- **Проблема**: Обработчики событий добавлялись многократно при каждом рендере табов
- **Причина**: `setupTabDragging()` вызывался при каждом `renderTabs()`
- **Решение**: Добавлен флаг `tabDraggingSetup` для однократной настройки

#### ⚙️ **Улучшенное управление событиями:**
- **Tab dragging**: Сохранение ссылок на обработчики для корректного cleanup
- **Folders resizer**: Исправлена утечка памяти при множественных обработчиках
- **Drag-n-drop**: Добавлены проверки на перетаскивание табов во всех drag обработчиках

#### 🗂️ **Технические улучшения:**
- **EventHandlers**: Добавлены проверки `isDraggingTab` в MouseHandlers
- **AssetPanel**: Разделены CSS классы для разных типов drag операций
- **Cleanup**: Корректное удаление всех обработчиков в методе `destroy()`

#### 📁 **Измененные файлы:**
- `src/ui/AssetPanel.js` - Исправлены drag-n-drop конфликты и множественные обработчики
- `src/core/MouseHandlers.js` - Добавлены проверки на tab dragging
- `styles/main.css` - Разделены CSS классы для tab и file drag
- `index.html` - Обновлены классы drag-over для правой панели
- `docs/CHANGELOG.md` - Документированы исправления

## [3.49.5] - 2025-01-27

### Added - Поддержка вложенных групп и улучшенная сортировка

#### 🎯 **Полная поддержка вложенных групп:**
- **Вложенность любого уровня**: Группы могут содержать другие группы без ограничений
- **Корректное редактирование**: При открытии группы все её потомки (включая вложенные) становятся выбираемыми
- **Правильное перемещение**: Объекты в группах любого уровня вложенности корректно перемещаются

#### 🔧 **Улучшенная сортировка по глубине:**
- **Иерархические индексы**: Объекты сортируются по полным путям в иерархии групп (layer.groupPath.objectIndex)
- **Правильный z-order**: Объекты отображаются в правильном порядке даже в глубоко вложенных структурах
- **Селект по клику**: При клике выбирается объект с наивысшим z-index в видимой области

#### ⚙️ **Улучшенное управление группами:**
- **Escape клавиша**: `Esc` теперь сбрасывает выделение объектов (если нет активных процессов), отменяет текущие действия и закрывает режим редактирования группы
- **Документация**: Обновлена документация с информацией о поддержке вложенных групп

#### 🗂️ **Оптимизация интерфейса:**
- **Удалена закладка Level**: Статистика уровня теперь показывается в панели Details когда ничего не выбрано
- **Интегрированный интерфейс**: Панель Details объединяет свойства объектов и статистику уровня

#### 📁 **Измененные файлы:**
- `src/models/Level.js` - Добавлены функции `buildFullObjectIndex()`, `buildObjectPath()`, `isObjectInAnyGroup()`
- `src/core/ObjectOperations.js` - Обновлена логика сортировки и селекта объектов в группах
- `src/core/MouseHandlers.js` - Исправлена логика перемещения объектов в группах любого уровня
- `src/core/EventHandlers.js` - Добавлена поддержка Escape для закрытия групп
- `src/core/LevelEditor.js` - Удален вызов updateLevelStatsPanel()
- `src/ui/DetailsPanel.js` - Добавлена статистика уровня в режиме "ничего не выбрано"
- `index.html` - Удалена закладка Level из интерфейса
- `docs/QUICK_START.md` - Обновлена информация о горячих клавишах
- `docs/USER_MANUAL.md` - Обновлено описание панели Details

## [3.49.4] - 2025-01-27

### Fixed - Исправление логики позиционирования дубликатов

#### 🎯 **Исправление расчета offset для объектов внутри групп:**
- **Проблема**: Дубликаты позиционировались не под курсором из-за неправильного расчета offset
- **Корневая причина**: `DuplicateUtils.initializePositions()` использовал `getObjectWorldPosition()` вместо ручного расчета координат
- **Решение**: Применена та же логика, что и в `MouseHandlers.dragSelectedObjects` для Alt+drag

#### 🔧 **Технические детали:**
- **DuplicateUtils.initializePositions**: Теперь использует `groupWorldPos.x + obj.x` для объектов внутри групп
- **DuplicateOperations.confirmPlacement**: Добавлена проверка `wasInGroup` для правильной конвертации координат
- **Отслеживание оригинальных объектов**: Добавлено `duplicate.originalObjects` для определения принадлежности к группе

#### 📁 **Измененные файлы:**
- `src/utils/DuplicateUtils.js` - Исправлена логика расчета offset
- `src/core/DuplicateOperations.js` - Добавлено отслеживание originalObjects
- `src/core/LevelEditor.js` - Версия 3.49.4

## [3.49.3] - 2025-01-27

### Fixed - Исправление позиционирования дубликатов в режиме редактирования групп

#### 🎯 **Исправление дублирования внешних объектов в группах:**
- **Проблема**: При Alt+click+drag внешних объектов в открытой группе дубликаты получали неправильную позицию
- **Корневая причина**: `DuplicateUtils.initializePositions()` всегда применял группо-относительное позиционирование в режиме редактирования групп
- **Решение**: Добавлена проверка принадлежности объекта к активной группе
- **Результат**: Внешние объекты корректно дублируются под курсором, объекты внутри группы сохраняют группо-относительное позиционирование

#### 🔧 **Технические исправления:**
- **DuplicateUtils.js**: Добавлена проверка `isObjectInGroupRecursive(obj, activeGroup)` в `initializePositions()`
- **Логика позиционирования**: Разделена на два случая - внутренние и внешние объекты группы
- **Обратная совместимость**: Все существующие сценарии продолжают работать

#### 📋 **Затронутые файлы:**
- **DuplicateUtils.js**: Исправлена логика инициализации позиций дубликатов

#### 🔍 **Технические детали:**
- **Проверка принадлежности**: Используется `editor.objectOperations.isObjectInGroupRecursive(obj, activeGroup)`
- **Позиционирование внутренних объектов**: `groupWorldPos.x + obj.x, groupWorldPos.y + obj.y`
- **Позиционирование внешних объектов**: `editor.objectOperations.getObjectWorldPosition(obj)`
- **Совместимость**: Сохранена поддержка parallax и всех существующих режимов

## [3.49.2] - 2025-01-27

### Fixed - Исправления селекции объектов и перетаскивания в группы

#### 🎯 **Исправление приоритета селекции групп:**
- **Проблема**: Группы имели искусственный приоритет над обычными объектами при селекции, независимо от zIndex
- **Решение**: Все объекты (группы и обычные) теперь обрабатываются по zIndex при селекции
- **Результат**: Выбирается объект с максимальным zIndex (передний план) независимо от типа

#### 🔧 **Исправление фантомных объектов при перетаскивании в группы:**
- **Проблема**: При перетаскивании объектов в открытые группы появлялись кратковременные фантомы
- **Корневая причина**: Неправильный порядок операций и отсутствие инвалидации кешей
- **Решение**: 
  - Инвалидация пространственного индекса ДО перемещения объектов
  - Очистка кешей эффективного слоя для предотвращения фантомных ссылок
  - Отложенный рендеринг до завершения всех операций перемещения

#### 🚀 **Улучшения архитектуры:**
- **DRY принцип**: Устранено дублирование кода сортировки по zIndex
- **Оптимизация**: Создана вспомогательная функция `_sortObjectsByZIndexDescending()`
- **Производительность**: Убраны избыточные операции очистки кешей

#### 📋 **Затронутые файлы:**
- **ObjectOperations.js**: Исправлена логика селекции, убран приоритет групп
- **MouseHandlers.js**: Исправлен порядок операций при перетаскивании в группы
- **DuplicateOperations.js**: Добавлен импорт Logger для корректной работы

#### 🔍 **Технические детали:**
- **Селекция**: Все объекты обрабатываются вместе по zIndex в порядке убывания
- **Перетаскивание**: Объект сначала добавляется в группу, потом удаляется из основного уровня
- **Кеширование**: Используется `clearEffectiveLayerCacheForObject()` вместо общей очистки кешей
- **Рендеринг**: Добавлен флаг `objectsMovedToGroup` для отложенного рендеринга

## [3.49.1] - 2025-01-27

### Fixed - Критическое исправление фантомных объектов при группировке

#### 🔧 **Исправление проблемы фантомных копий ассетов:**
- **Корневая причина**: `collectVisibleObjectsRecursive()` рекурсивно добавляла детей групп как отдельные объекты для рендеринга
- **Результат**: фантомные копии отображались на канве после группировки - дети групп рендерились дважды
- **Решение**: устранение рекурсивного обхода детей групп в `collectVisibleObjectsRecursive()`

#### 🎯 **Технические исправления:**
- **RenderOperations.js**: устранен рекурсивный обход детей групп в `collectVisibleObjectsRecursive()`
- **GroupOperations.js**: добавлена полная очистка кешей и инвалидация пространственного индекса
- **Пространственный индекс**: улучшена инвалидация индекса до и после группировки
- **Кеширование**: добавлен вызов `clearCaches()` и `invalidateObjectCaches()` для предотвращения фантомных ссылок

#### 🚀 **Улучшения производительности:**
- **Умная инвалидация**: перестройка только пространственного индекса вместо полной очистки всех кешей
- **Оптимизация**: `buildSpatialIndex()` вызывается только при необходимости
- **Надежность**: fallback на обычный метод поиска при проблемах с индексом

#### 📋 **Затронутые методы:**
- `RenderOperations.collectVisibleObjectsRecursive()` - устранен рекурсивный обход детей групп
- `GroupOperations.groupSelectedObjects()` - добавлена очистка кешей и инвалидация индексов
- `RenderOperations.invalidateSpatialIndex()` - инвалидация пространственного индекса до группировки
- `RenderOperations.buildSpatialIndex()` - перестройка пространственного индекса после группировки

## [3.49.0] - 2025-10-14

### Fixed - Исправления в системе индексов глубины и рендеринга

#### 🔧 **Исправление присваивания zIndex объектам:**
- **Устранена ошибка**: объекты не получали корректный zIndex при добавлении в уровень
- **Метод `assignInitialZIndex()`**: новый унифицированный метод для присваивания zIndex новым объектам
- **Правильная последовательность**: сначала `getNextZIndex()`, потом `assignObjectToLayer()` для коррекции layer index
- **Объекты в группах**: исправлено присваивание zIndex для объектов, добавляемых в группы

#### 🎨 **Улучшение рендеринга и сортировки объектов:**
- **Рекурсивный сбор объектов**: новый метод `collectVisibleObjectsRecursive()` для сбора всех видимых объектов включая вложенные в группы
- **Устранение дублирования**: унифицирована логика сбора объектов в `getVisibleObjectsRegular()` и `getVisibleObjectsSpatial()`
- **Правильная сортировка**: объекты внутри групп теперь правильно сортируются по zIndex
- **Консистентность**: единая логика для пространственного индекса и обычного метода

#### 🧹 **Рефакторинг кода:**
- **Устранение дублирования**: удалена повторяющаяся логика присваивания zIndex
- **Улучшенная поддерживаемость**: изменения в логике zIndex теперь в одном месте
- **Чище архитектура**: разделение ответственности между методами

#### 🎯 **Технические детали:**
- **Level.js**: добавлен `assignInitialZIndex()` для унификации присваивания zIndex
- **RenderOperations.js**: добавлен `collectVisibleObjectsRecursive()` для рекурсивного сбора объектов
- **MouseHandlers.js**: упрощена логика дропа объектов в группы
- **Исправлены edge cases**: правильная обработка объектов в группах и обычных объектов

### Added - Незначительные улучшения

#### 📚 **Обновление документации:**
- Синхронизированы версии во всех файлах документации
- Обновлено описание API методов в `API_REFERENCE.md`

## [3.48.0] - 2025-10-14

### Added - Расширенная система цветовых настроек интерфейса

#### 🎨 **Новый раздел Colors в настройках**

**UI Colors - Цвета пользовательского интерфейса:**
- **UI Background** - цвет фона интерфейса (`ui.backgroundColor`)
- **UI Text Color** - цвет текста в интерфейсе (`ui.textColor`)
- **Active Elements** - цвет активных элементов (`ui.activeColor`)
- **Active Text Color** - цвет текста активных элементов (`ui.activeTextColor`)
- **Active Tab Color** - цвет активных вкладок (`ui.activeTabColor`)
- **Accent Color** - цвет акцентов (`ui.accentColor`)

**Canvas Colors - Цвета рабочей области:**
- **Canvas Background** - цвет фона канвы (`canvas.backgroundColor`)
- **Grid Color** - цвет линий сетки (`canvas.gridColor`)
- **Grid Subdivision** - цвет вспомогательных линий сетки (`canvas.gridSubdivColor`)

**Selection Colors - Цвета выделения объектов:**
- **Selection Outline** - цвет рамки выделенных объектов (`selection.outlineColor`)
- **Group Outline** - цвет рамки выделенных групп (`selection.groupOutlineColor`)
- **Marquee Selection** - цвет рамки выделения мышью (`selection.marqueeColor`)
- **Hierarchy Highlight** - цвет подсветки иерархии (`selection.hierarchyHighlightColor`)
- **Active Layer Border** - цвет границы слоев с выбранными объектами (`selection.activeLayerBorderColor`)

**Logger Colors - Цвета категорий логирования:**
- Настраиваемые цвета для всех 21 категории логирования
- Включает: RENDER, UI, FILE, ERROR, CANVAS, MOUSE, EVENT, GROUP, etc.

#### 🔧 **Технические улучшения:**

**Реальное время применения:**
- Все цветовые изменения применяются мгновенно без перезагрузки
- StateManager имеет приоритет над ConfigManager для мгновенных обновлений
- Подписки на изменения StateManager для автоматических обновлений UI

**Сохранение и восстановление:**
- Цвета сохраняются в user настройки (`localStorage`)
- Правильная отмена изменений при нажатии Cancel
- Восстановление исходных значений из StateManager

**Интеграция с существующими компонентами:**
- **LayersPanel**: реальное время обновления подсветки активных слоев
- **SettingsPanel**: унифицированная система цветовых настроек
- **SettingsSyncManager**: автоматическая синхронизация между UI и StateManager

#### 🎯 **Пользовательские преимущества:**
- Полный контроль над цветовой схемой интерфейса
- Мгновенное превью изменений цветов
- Настраиваемая подсветка активных слоев
- Персонализация цветовой схемы логирования

## [3.47.0] - 2025-10-12

### Added - Система индексов глубины (Z-Index) для объектов

#### 🎯 **Новая система слоев и индексов глубины**
- **Слои имеют номера**: каждый слой получает индекс (0, 1, 2, ...) на основе порядка в списке
- **Индекс глубины объектов**: `zIndex = layerIndex + (objectIndex / 1000)`
- **Тысячные доли**: показывают позицию объекта внутри слоя (личный индекс)
- **Целая часть**: показывает номер слоя (группировка по слоям)

#### 📊 **Структура zIndex:**
```
Примеры:
- Объект на слое 0 с индексом 5: zIndex = 0.005
- Объект на слое 1 с индексом 5: zIndex = 1.005
- Объект на слое 2 с индексом 0: zIndex = 2.000
```

#### 🔧 **Автоматическое управление индексами:**
- **При добавлении объектов**: автоматически присваивается следующий доступный индекс
- **При дублировании**: дублированные объекты получают более высокий индекс
- **При перемещении между слоями**: индекс пересчитывается с учетом нового слоя
- **При изменении порядка слоев**: все индексы объектов автоматически пересчитываются

#### 🎨 **Отображение в интерфейсе:**
- **Панель Details**: показывает только тысячные доли (личный индекс объекта)
- **Пример**: объект с zIndex = 1.005 отображается как "5" в интерфейсе
- **Автообновление**: при изменении индекса канва сразу перерисовывается

#### 📝 **Подробное логирование:**
- **Перемещение между слоями**: детальная информация об изменении индексов
- **Создание объектов**: логирование присвоенных индексов
- **Дублирование**: отслеживание новых индексов дублированных объектов
- **Пересчет индексов**: логирование массовых изменений при реордеринге слоев

### 🔧 **Технические изменения:**

#### **Модели данных:**
- **`Layer.js`**: добавлен `index` для хранения номера слоя в системе
- **`Level.js`**: добавлены методы `getNextZIndex()`, `updateLayerIndices()`, `updateAllObjectZIndices()`
- **`GameObject.js`**: добавлено свойство `zIndex` для управления порядком отрисовки
- **`Group.js`**: обновлено наследование zIndex для дочерних объектов

#### **UI компоненты:**
- **`DetailsPanel.js`**: отображение тысячных долей zIndex, множественный выбор
- **`UIFactory.js`**: специальное форматирование для zIndex в формах редактирования
- **`ActorPropertiesWindow.js`**: добавлено поле Z-Index для объектов на канве

#### **Операции:**
- **`LayerOperations.js`**: правильное перемещение объектов между слоями с пересчетом индексов
- **`MouseHandlers.js`**: присвоение правильных индексов при drag & drop в группы
- **`DuplicateOperations.js`**: правильные индексы для дублированных объектов

#### **Рендеринг:**
- **`RenderOperations.js`**: сортировка объектов по zIndex перед отрисовкой
- **`CacheManager.js`**: инвалидация кешей при изменении zIndex объектов

#### **Логирование:**
- **Добавлена категория `LEVEL`** в Logger для операций с уровнями
- **Подробное логирование** всех операций с индексами глубины
- **Отслеживание** перемещения объектов между слоями

### 🎯 **Результат:**
✅ **Правильная сортировка объектов по глубине**  
✅ **Автоматическое управление индексами при всех операциях**  
✅ **Интуитивный интерфейс редактирования индексов**  
✅ **Полная отслеживаемость всех изменений индексов**  
✅ **Оптимизированная производительность с кешированием**

---

## [3.46.0] - 2025-10-10

### Added - Глобальная система отмены рамки выделения
- **Глобальный обработчик отмены рамки**: добавлен единый обработчик для отмены рамки выделения в любом месте экрана при нажатии любой кнопки мыши кроме левой (канва, панели, вне интерфейса)
- **Универсальная поддержка**: работает с обеими системами рамок (старой для канвы и новой для панелей)
- **Многоуровневая защита**: три уровня обработчиков для гарантированной работы (contextmenu, mousedown, window-level)
- **Автоматическая очистка**: очищает все состояния, DOM элементы и выделение при отмене рамки

### Changed - Очистка дублирующего кода
- **BaseContextMenu.js**: удалены лишние отладочные логи, оставлены только важные информационные сообщения
- **SelectionUtils.js**: удалены отладочные логи для проверки активных marquee selections
- **MouseHandlers.js**: удален дублирующий код отмены рамки (теперь обрабатывается глобально)
- **LevelEditor.js**: упрощен метод `cancelAllActions()` - отмена marquee теперь глобальная

### Fixed - Улучшенная стабильность отмены рамки
- **Отмена в панели ассетов**: исправлено - рамка теперь корректно отменяется с очисткой выделения
- **Отмена на канве**: исправлено - рамка канвы теперь отменяется в любом месте экрана
- **Предотвращение конфликтов**: устранены конфликты между локальными и глобальными обработчиками отмены

---

## [3.45.1] - 2025-10-10

### Fixed - Исправления UI и selection
- **SelectionUtils.js**: исправлена ошибка дублирующего объявления переменной `mouseStateKey` (строка 339)
- **SelectionUtils.js**: исправлена ошибка дублирующего объявления переменной `options` (строка 359) - переименована в `marqueeOptions`
- **BasePanel.js**: исправлена ошибка необъявленной переменной `options` в `handleMouseUp` (строка 231) - заменено на `this.selectionOptions`
- **SettingsPanel.js**: исправлена проблема с неработающими слайдерами Font Scale и Spacing при переключении табов - добавлен вызов `setupSettingsInputs()` после рендеринга контента

### Improved
- **Интерактивность настроек**: слайдеры Font Scale и Spacing теперь всегда работают при открытии окна настроек
- **Стабильность selection**: устранены синтаксические ошибки в системе marquee selection
- **Надежность**: устранены ошибки обращения к несуществующим переменным

---

## [3.45.0] - 2025-10-08

### Changed - Система ассетов переработана
- **Удалены заглушки**: Grass, Dirt, Stone, Slime, Goblin, Coin, Health Potion
- **Удалены дефолтные табы**: Tiles, Enemies, Items, Prefabs
- **Удалён Enemy Spawn** из начальных объектов уровня
- **Переименована панель**: Folders → Content

### Added - Автоматическая загрузка ассетов
- **AssetManager.scanContentFolder()**: сканирование ./content при старте
- **content/manifest.json**: манифест со структурой папок и списком файлов
- **update_manifest.bat/py/js**: скрипты для обновления манифеста
- **AssetManager.loadAssetFromFile()**: загрузка ассетов из JSON
- **AssetManager.getCategoriesWithAssets()**: только категории с ассетами
- **Автогенерация ID**: уникальные ID из полного пути файла
- **Cache busting**: для манифеста и JSON файлов

### Changed - FoldersPanel
- **Структура из манифеста**: buildFromManifestStructure()
- **Только папки**: ассеты не отображаются в дереве
- **Рекурсивный счётчик**: countAssetsRecursive()
- **Раскрытие по стрелке**: клик по папке только выделяет
- **Серый цвет**: для пустых папок
- **Подсветка**: работает на всех уровнях
- **Синхронизация табов**: getCategoriesInFolder() рекурсивно

### Changed - Обработка изображений
- **Только одна картинка**: массив imgSrc → первый элемент
- **Поддержка image field**: альтернативное поле
- **Полные пути**: ./content/path/to/image.png
- **Синхронизация кешей**: preloadImages() синхронизирует с CanvasRenderer

### Fixed
- **FoldersPanel.folderStructure**: всегда инициализируется
- **Уникальность ID**: одинаковые файлы в разных папках
- **Категории**: из имени родительской папки
- **Табы**: только для категорий с ассетами
- **Пустые папки**: очищают табы

---

## [3.44.0] - 2025-10-05

### Added - Фаза 5: Модуляризация ViewportOperations и LevelFileOperations
- **ViewportOperations**: новый модуль для управления viewport и камерой (200+ строк)
  - `zoomIn()`, `zoomOut()`, `zoomToFit()`, `resetView()`
  - `focusOnSelection()`, `focusOnAll()`, `focusOnBounds()`
- **LevelFileOperations**: новый модуль для файловых операций (250+ строк)
  - `newLevel()`, `openLevel()`, `saveLevel()`, `saveLevelAs()`
  - `importAssets()` с полной интеграцией AssetImporter
  - `_validatePlayerStart()` - централизованная валидация

### Changed
- **LevelEditor**: методы viewport и файловых операций делегируют к новым модулям
- **ObjectOperations**: удалены `focusOnSelection()` и `focusOnAll()` (перенесены в ViewportOperations)
- **Размер LevelEditor.js**: 2089→1770 строк (-319 строк, -15.3%)
- **Logger**: добавлена категория VIEWPORT для логирования операций камеры

### Improved
- **Separation of Concerns**: viewport и файловые операции в отдельных модулях
- **Модульность**: +25% (viewport и файлы могут переиспользоваться)
- **Maintainability**: изменения локализованы в специализированных модулях
- **Параметризация**: методы принимают параметры (factor, padding, defaults)
- **Улучшенное логирование**: детальная информация о всех операциях

### Метрики после Фазы 5
- **LevelEditor.js**: 2488→1770 строк (-28.8% от начала Фазы 4)
- **Новые модули**: ViewportOperations (200 строк), LevelFileOperations (250 строк)
- **Общая модульность**: +70% относительно начала рефакторинга
- **Cognitive Complexity**: снижена на ~65%

---

## [3.43.0] - 2025-10-05

### Changed - Фаза 4.5: Разбивка applyConfiguration()
- **LevelEditor.applyConfiguration()**: разбит на 7 специализированных методов
  - `_applyGridConfiguration()` - координирует применение настроек грида
  - `_getGridSettingsFromConfig()` - получение настроек из конфига
  - `_applyBasicGridSettings()` - базовые настройки (size, color, thickness, opacity)
  - `_applyGridSubdivisionSettings()` - настройки подразделений грида
  - `_applyGridTypeSettings()` - тип грида (rectangular, hexagonal, etc.)
  - `_syncGridSettingsToUI()` - синхронизация с UI компонентами
  - `_saveDefaultConfiguration()` - сохранение дефолтных настроек

### Improved
- **Читаемость**: 65→10 строк в основном методе (-85%)
- **Separation of Concerns**: каждый метод отвечает за свою задачу
- **Maintainability**: легче расширять и тестировать отдельные части
- **JSDoc**: полная документация для всех методов

---

## [3.42.0] - 2025-10-05

### Added - Фаза 4.4: CacheManager
- **CacheManager**: новый менеджер для централизации логики кэширования (269 строк)
  - getCachedObject(), getCachedTopLevelObject(), getCachedEffectiveLayerId()
  - getSelectableObjectsInViewport(), smartCacheInvalidation()
  - invalidateAfterLayerChanges/GroupOperations/DuplicateOperations()
  - scheduleCacheInvalidation() с debouncing

### Changed
- **LevelEditor**: методы кэширования делегируют к CacheManager
- **Размер LevelEditor.js**: 2057→1811 строк (-246 строк, -12%)
- **Logger**: добавлена категория CACHE для логирования кэширования

### Improved
- **Separation of Concerns**: кэширование в отдельном менеджере
- **Модульность**: +15% (кэширование может переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Сохранены оптимизации**: smart invalidation, debouncing, TTL cache

---

## [3.41.0] - 2025-10-05

### Added - Фаза 4.3: Модуль LayerOperations
- **LayerOperations**: новый модуль для управления слоями (404 строки)
  - moveSelectedObjectsToLayer(), assignSelectedObjectsToLayer()
  - batchProcessLayerAssignment(), findNextUnlockedLayer()
  - processObjectForLayerAssignment(), batched notifications
  - canMoveObjectsToLayer()

### Changed
- **LevelEditor**: методы управления слоями делегируют к LayerOperations
- **Размер LevelEditor.js**: 2415→2057 строк (-358 строк, -14.8%)

### Improved
- **Separation of Concerns**: управление слоями в отдельном модуле
- **Модульность**: +20% (слои могут переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Сохранены оптимизации**: batch processing, smart caching, spatial index

---

## [3.40.0] - 2025-10-05

### Added - Фаза 4.2: Модуль HistoryOperations
- **HistoryOperations**: новый модуль для централизации логики undo/redo (144 строки)
  - undo(), redo(), restoreObjectsFromHistory(), rebuildAllIndices()
  - restoreGroupEditMode(), recalculateGroupBounds(), invalidateCachesAfterRestore()
  - restoreSelection(), finalizeHistoryRestore()

### Changed
- **LevelEditor**: методы undo/redo делегируют работу к HistoryOperations
- **Размер LevelEditor.js**: 2693→2415 строк (-278 строк, -10.3%)

### Improved
- **Separation of Concerns**: история в отдельном модуле
- **Модульность**: +20% (история может переиспользоваться)
- **Maintainability**: изменения локализованы в одном месте
- **Тестируемость**: легко тестировать историю отдельно

---

## [3.39.0] - 2025-10-05

### Changed - Фаза 4.1: Разбивка больших методов
- **LevelEditor.init()**: разбит на 7 специализированных методов (180→15 строк, -92%)
  - initializeConfiguration(), initializeDOMElements(), initializeRenderer()
  - initializeUIComponents(), initializeMenuAndEvents(), initializeLevelAndData()
  - finalizeInitialization()
- **LevelEditor.undo()**: разбит на 7 приватных методов (160→10 строк, -94%)
- **LevelEditor.redo()**: упрощен, переиспользует методы undo (85→10 строк, -88%)

### Improved
- **Читаемость**: +85-90% (методы читаются как последовательность шагов)
- **DRY**: устранено ~150 строк дублирования между undo/redo (-95%)
- **Когнитивная сложность**: -80% (с 25 до 5)
- **Размер файла**: 2914→2693 строк (-7.6%)
- **Maintainability**: каждый метод делает одну вещь (SRP)

### Technical
- 13 новых приватных методов с @private JSDoc
- Устранена вложенность кода (4→1 уровень)
- Улучшена тестируемость (изолированные шаги)

---

## [3.38.1] - 2025-10-05

### Fixed - Улучшена логика для вложенных групп
- Добавлена проверка консистентности activeGroupId и openGroupIds
- Валидация иерархии вложенных групп (parent→child)
- Восстановлены обязательные поля groupId и originalChildren
- Безопасный выход из режима при сломанной иерархии

---

## [3.38.0] - 2025-10-05

### Added - Фикс Undo/Redo
- Сохранение groupEditMode в историю (isActive, groupId, openGroupIds)
- Убрано принудительное изменение visibility после undo/redo
- Убран некорректный markDirty() после undo/redo

---

## [3.37.0] - 2025-10-05

### Added
- **PerformanceUtils**: модуль оптимизации производительности
  - throttle(), debounce(), memoize(), batchRAF()
  - LRUCache class для эффективного кэширования
- **Throttled mouse events**: 8ms для mousemove, 16ms для wheel
- **EditorConstants**: MOUSE_MOVE_THROTTLE_MS, WHEEL_THROTTLE_MS, RESIZE_DEBOUNCE_MS, INPUT_DEBOUNCE_MS

### Changed
- **MouseHandlers**: применен throttle к handleMouseMove и handleWheel (-20-30% CPU)
- **Плавность взаимодействия**: улучшена отзывчивость при перетаскивании и zoom

### Performance
- Снижение CPU нагрузки на 20-30% при интенсивном взаимодействии
- Плавное перетаскивание и zoom без лагов
- Готовая инфраструктура для memoization

---

## [3.36.0] - 2025-10-05

### Added
- **EditorConstants**: централизованные константы редактора
  - DEFAULT_OBJECT (width, height, color, visibility)
  - PERFORMANCE (cache timeout, spatial grid, history size)
  - GRID, CAMERA, UI, SELECTION, PARALLAX настройки

### Changed
- **DuplicateOperations**: устранено дублирование кода (~20 строк)
  - Создан метод _normalizeObjectProperties()
  - Использование констант DEFAULT_OBJECT
- **RenderOperations**: применены константы PERFORMANCE
- **ErrorHandler**: применены константы PERFORMANCE.MAX_HISTORY_SIZE

### Improved
- DRY принцип: +30% (единая точка изменения для свойств по умолчанию)
- Maintainability: +40% (константы вместо magic numbers)
- Consistency: улучшена согласованность кода

---

## [3.35.0] - 2025-10-05

### Added
- **JSDoc типизация**: полная документация ErrorHandler и Custom Error классов
  - 17 методов с детальной типизацией
  - 4 Custom Error класса (NetworkError, ValidationError, PermissionError, FileNotFoundError)
  - 10+ примеров использования
  - IDE автодополнение и IntelliSense поддержка

### Technical
- ~200 строк JSDoc документации
- @param, @returns, @example для всех публичных методов
- @private маркеры для внутренних методов
- @extends для Custom Error классов

---

## [3.34.0] - 2025-10-05

### Changed
- **Logger migration**: 100% замена console.* на Logger.* (23 файла, 40+ вызовов)
  - CanvasRenderer → Logger.canvas
  - FileUtils → Logger.file
  - AssetManager → Logger.asset
  - SettingsPanel, DetailsPanel → Logger.settings, Logger.ui
  - FolderPickerDialog → Logger.file
  - ConsoleContextMenu → Logger.console
- **ErrorHandler integration**: критичные файловые операции (FileManager: loadLevel, loadLevelFromFileInput, importLevelData, loadAssetLibrary)

### Fixed
- Единый стиль логирования во всем проекте
- Улучшенная обработка ошибок в файловых операциях

### Technical
- Fallback console.* оставлен в Logger.js и ConfigManager (правильно)
- Пользовательские сообщения об ошибках на русском языке
- ErrorHandler.try/tryAsync обертки для критичных операций

---

## [3.33.0] - 2025-10-05

### Added
- **ErrorHandler**: централизованная обработка ошибок, глобальные перехватчики, стратегии восстановления, история ошибок
- **ComponentLifecycle**: менеджер жизненного цикла компонентов, приоритеты уничтожения, предотвращение утечек памяти
- **destroy() методы**: добавлены во все UI компоненты (AssetPanel, DetailsPanel, OutlinerPanel, LayersPanel, SettingsPanel, ActorPropertiesWindow, Toolbar, MenuManager, CanvasRenderer, EventHandlers)
- **Logger категории**: LIFECYCLE, ERROR_HANDLER для новых систем
- **LevelEditor.destroy()**: полная очистка редактора с правильным порядком уничтожения компонентов

### Changed
- **EventHandlers**: трекинг event listeners и RAF для корректной очистки
- **Logger**: методы-алиасы для новых категорий (Logger.lifecycle, Logger.errorHandler)

### Fixed
- **Memory leaks**: устранены утечки памяти в event listeners, subscriptions, render loops
- **Component cleanup**: все зарегистрированные компоненты корректно очищаются при destroy

### Technical
- **ErrorHandler API**: init(), handle(), logError(), getErrorHistory(), getStatistics(), try(), tryAsync()
- **ComponentLifecycle API**: register(), destroy(), destroyAll(), приоритеты 1-10
- **Custom Error types**: NetworkError, ValidationError, PermissionError, FileNotFoundError
- **Recovery strategies**: автоматическое восстановление для типовых ошибок

---

## [3.32.0] - 2025-10-02

### Added
- **SelectionUtils**: режимы marquee replace/add/toggle, единая логика для всех панелей

### Changed
- **AssetPanel**: 
  - Ctrl+click+drag запускает рамку в режиме toggle; Ctrl+Shift+drag — add; обычный drag по фону — replace
  - Ctrl+click без drag — мгновенный toggle без рамки (порог для рамки 4px)
  - Отключено перетаскивание ассетов по Ctrl+drag во избежание конфликта с рамкой
  - В режиме Details клик по промежуткам колонок считается кликом по строке
  - Унифицированный `itemSelector` для всех режимов (Grid/List/Details)

### Fixed
- **Ctrl+click toggle**: починен переключатель выделения в панели ассетов
- **Marquee false positive**: обычный drag по элементу больше не запускает рамку
- **Details gaps**: клики между колонками считаются кликами по элементу

### Technical
- **SelectionUtils**: отложенный старт рамки для Ctrl с порогом 4px, pending-состояние; финализация по режимам
- **BasePanel/AssetPanel**: корректная передача `itemSelector` и контейнера селекции

---

## [3.31.0] - 2025-01-29

### Added
- **Custom Dialog System** - полная замена браузерных диалогов на стилистически идентичные редактору
- **FolderPickerDialog** - кастомный диалог выбора папки с поддержкой File System Access API и Drag & Drop
- **UniversalDialog** - универсальный диалог для замены alert, confirm, prompt
- **DialogReplacer** - утилита для автоматической замены браузерных диалогов
- **File System Access API** - современный API для выбора папок в Chrome/Edge
- **Drag & Drop Support** - поддержка перетаскивания папок и файлов для всех браузеров
- **Asset Import Summary** - детальная статистика импортируемых ассетов по категориям
- **Real-time Path Display** - отображение выбранной папки в реальном времени

### Changed
- **Asset Import Process** - упрощен процесс импорта ассетов до одного действия
- **Dialog Consistency** - все диалоги теперь имеют единый стиль редактора
- **Path Display** - улучшено отображение выбранной папки (только имя папки)
- **Summary Display** - количество файлов вынесено в отдельную область summary
- **Error Handling** - улучшена обработка ошибок при выборе папок
- **User Experience** - значительно улучшен UX процесса импорта ассетов

### Fixed
- **Syntax Errors** - исправлены все синтаксические ошибки с async/await
- **File Object Handling** - исправлена работа с File объектами и webkitRelativePath
- **Dialog Compatibility** - обеспечена совместимость с различными браузерами
- **Asset Display** - исправлено отображение ассетов без изображений
- **Path Truncation** - убрано обрезание путей, показывается полное имя папки

### Technical
- **FolderPickerDialog.js** - новый класс для выбора папок с современными API
- **UniversalDialog.js** - базовый класс для всех кастомных диалогов
- **DialogReplacer.js** - утилита для замены браузерных диалогов
- **AssetImporter.js** - обновлен для работы с новым диалогом выбора папки
- **LevelEditor.js** - интегрирована система кастомных диалогов
- **EventHandlers.js** - обновлены обработчики событий для async методов
- **Toolbar.js** - обновлен для работы с async методами
- **SettingsPanel.js** - обновлен для работы с кастомными диалогами
- **OutlinerPanel.js** - обновлен для работы с кастомными диалогами
- **LayersPanel.js** - обновлен для работы с кастомными диалогами

### Removed
- **Browser Native Dialogs** - полностью убраны браузерные alert, confirm, prompt
- **WebkitDirectory Fallback** - убран fallback на webkitdirectory (вызывал двойные диалоги)
- **File Preview Dialog** - убран промежуточный диалог предварительного просмотра
- **Path Truncation Logic** - убрана логика обрезания путей

## [3.30.2] - 2025-01-29

### Added
- **Asset Import System** - новая система импорта внешних ассетов в редактор
- **External Asset Support** - поддержка импорта ассетов из внешних папок
- **Dynamic Asset Categories** - динамическое создание категорий ассетов на основе структуры папок
- **AssetImporter Utility** - новая утилита для импорта и управления внешними ассетами
- **Folder Structure Analysis** - автоматический анализ структуры папок для определения категорий

### Changed
- **Menu Command** - заменена команда "Settings - Assets Path..." на "Import Assets..."
- **Asset Panel Tabs** - табы создаются динамически на основе импортированных категорий
- **AssetManager Integration** - интеграция с StateManager для синхронизации категорий
- **Asset Categories** - категории ассетов теперь обновляются в реальном времени

### Technical
- **AssetImporter.js** - новая утилита с методами импорта, сканирования и управления ассетами
- **AssetManager.js** - добавлены методы `addExternalAsset()`, `updateStateManagerCategories()`, `clearExternalAssets()`
- **LevelEditor.js** - добавлен метод `importAssets()` для интеграции с AssetImporter
- **MenuManager.js** - обновлена команда меню для вызова импорта ассетов
- **StateManager.js** - добавлено состояние `assetTabOrder` для управления порядком табов

### Improved
- **Asset Organization** - улучшена организация ассетов с поддержкой внешних источников
- **User Experience** - упрощен процесс добавления новых ассетов в редактор
- **Flexibility** - поддержка различных структур папок и категорий ассетов
- **Integration** - полная интеграция с существующей системой управления ассетами

## [3.30.1] - 2025-01-29

### Improved
- **MenuManager Hover Experience** - улучшена обработка курсора в главном меню
- **Gap Elimination** - убран промежуток между кнопкой и выпадающим меню
- **Expanded Hover Area** - расширена область выпадающего меню для перекрытия зазора
- **Immediate Response** - убрана система задержек, меню реагирует мгновенно

### Technical
- **MenuManager.js** - убрана система `closeTimeouts`, упрощена логика событий
- **CSS Improvements** - изменен `mt-0.5` на `mt-0` и добавлен `paddingTop: '8px'`
- **Event Handling** - упрощена обработка `mouseenter`/`mouseleave` событий
- **Performance** - убраны таймеры и сложная логика задержек

## [3.30.0] - 2025-01-29

### Added
- **ValidationUtils v2.0** - StateManager-based система валидации с кэшированием
- **Component Readiness Tracking** - централизованное отслеживание готовности компонентов
- **Validation Caching** - кэширование результатов валидации с TTL
- **Enhanced StateManager** - добавлены методы для управления состоянием валидации

### Technical
- **StateManager.js** - добавлено состояние `validation` с отслеживанием компонентов и кэшем
- **ValidationUtils.js v2.0** - полная переработка с использованием StateManager
- **SettingsSyncManager.js** - обновлен для использования новой системы валидации
- **Logger Integration** - исправлены все вызовы Logger для корректной работы

### Improved
- **Performance** - кэширование результатов валидации повышает производительность
- **Reliability** - централизованное отслеживание состояния компонентов
- **Consistency** - единый подход к fallback логике через StateManager
- **Debugging** - улучшенное логирование через Logger API

## [3.29.0] - 2025-01-29

### Added
- **ValidationUtils** - новая утилита для централизованной валидации и проверок
- **Code Refactoring** - устранение дублированного кода через ValidationUtils
- **Enhanced Error Handling** - улучшенная обработка ошибок с консистентным логированием
- **Fallback Mechanisms** - автоматический fallback на window.editor при недоступности levelEditor

### Technical
- **ValidationUtils.js** - новая утилита с методами валидации, проверки компонентов и fallback логикой
- **SettingsSyncManager.js** - рефакторинг всех методов для использования ValidationUtils
- **SettingsPanel.js** - рефакторинг методов валидации через ValidationUtils
- **Code Deduplication** - устранение 200+ строк дублированного кода проверок

## [3.28.0] - 2025-01-29

### Added
- **Menu Hover Mode** - добавлен режим автоматического открытия меню при наведении курсора после первого клика
- **Smart Hover Reset** - автоматическое отключение hover-режима при выходе курсора за пределы контейнера меню
- **Interactive Font Scaling** - интерактивное изменение размера шрифта при движении слайдера Font Size
- **Spacing Control Enhancement** - улучшенное управление отступами с минимальными значениями для всех UI элементов

### Fixed
- **Settings Reset Flow** - исправлен поток сброса настроек: ConfigManager → StateManager → UI → сохранение
- **Grid Settings Integration** - перенесен параметр "Show Grid" в секцию "Grid & Snapping" для лучшей организации
- **State Synchronization** - устранены конфликты между `view.grid` и `canvas.showGrid`, установлен единый источник истины
- **AutoSave Configuration** - исправлены настройки автосохранения: отключено по умолчанию, интервал в минутах
- **Asset Panel Spacing** - добавлены горизонтальные отступы для табов панели ассетов, унифицированы с правой панелью
- **Ctrl+Scroll Prevention** - отключен скролл контента при Ctrl+scroll в панели ассетов (только изменение размера элементов)

### Technical
- **MenuManager.js** - добавлен `hoverModeEnabled` флаг и `setupMenuContainerHoverReset()` для управления hover-режимом
- **SettingsSyncManager.js** - улучшена синхронизация между UI, ConfigManager и StateManager с защитой от бесконечных циклов
- **SettingsPanel.js** - исправлен порядок операций в `resetToDefaults()` для корректного сброса настроек
- **GridSettings.js** - перенесен "Show Grid" из общих настроек в секцию грида
- **CSS Custom Properties** - добавлены `--font-scale` и `--spacing-scale` для динамического масштабирования UI
- **State Management** - централизовано управление состоянием через StateManager как единый источник истины

## [3.27.1] - 2025-01-29

### Fixed
- **Settings Initialization** - исправлена проблема с отображением autoSaveInterval при загрузке окна настроек (показывало 300000 вместо 5 минут)
- **State Synchronization** - добавлен вызов syncFromConfigToState() в конструктор SettingsPanel для корректной инициализации
- **Configuration Flow** - исправлен поток инициализации, теперь StateManager правильно синхронизируется с ConfigManager при запуске

### Technical
- **SettingsPanel.js** - добавлен вызов syncFromConfigToState() в конструктор для правильной инициализации
- **State Management** - обеспечена корректная синхронизация StateManager с ConfigManager при создании SettingsPanel
- **Configuration Consistency** - устранено расхождение между загрузкой окна (300000) и сбросом (5) значений

## [3.27.0] - 2025-01-29

### Fixed
- **Asset Panel Selection** - исправлена подсветка выбранных элементов в панели ассетов во всех режимах (Grid, List, Details)
- **CSS Architecture Compliance** - устранены все inline-стили в AssetPanel, теперь используются только CSS-классы
- **Selection Visual Consistency** - унифицированы стили селекции для всех режимов отображения ассетов
- **Hover Effects Integration** - исправлена работа HoverEffects с CSS-классами, сохранение селекции при уводе курсора
- **Empty Space Click** - корректный сброс селекции при клике в пустое место во всех режимах

### Technical
- **CSS Classes Unification** - добавлены унифицированные CSS-классы `.asset-list-item.selected` и `.asset-details-row.selected`
- **Inline Styles Removal** - удалены все inline-стили из `updateSelectionVisuals()` и методов создания элементов
- **HoverEffects Preservation** - исправлен `removeHoverEffect()` для сохранения классов селекции при восстановлении стилей
- **Selection State Management** - улучшена логика сброса селекции при клике в пустое место

## [3.26.1] - 2025-01-29

### Fixed
- **Color Conversion Refactoring** - устранен inline код конвертации цветов, теперь используется централизованная утилита ColorUtils
- **BaseGridRenderer** - заменен дублированный метод hexToRgba на использование ColorUtils.toRgba
- **GridSettings** - упрощена логика применения opacity к цветам грида через ColorUtils
- **LevelEditor** - заменены inline конвертации hex→rgba на использование ColorUtils

### Technical
- **ColorUtils Integration** - все компоненты теперь используют единую утилиту ColorUtils для конвертации цветов
- **Code Deduplication** - удалены дублированные методы конвертации цветов в разных модулях

## [3.26.0] - 2025-01-29

### Added
- **Hotkeys Settings Section** - добавлена новая секция "Hotkeys" в окне настроек с полным списком всех горячих клавиш
- **Hotkey Customization** - возможность переназначения горячих клавиш через интерфейс настроек
- **Shortcuts Configuration** - вынесены все горячие клавиши в отдельный файл `config/defaults/shortcuts.json`
- **Toolbar Configuration** - добавлен файл `config/defaults/toolbar.json` для настроек тулбара
- **Asset Panel Persistence** - сохранение размера элементов и режима отображения (Grid/List/Details) панели assets
- **Escape Key Support** - добавлена отмена изменений в окне настроек клавишей Esc

### Fixed
- **Settings Synchronization** - исправлена синхронизация настроек между окном settings, тулбаром и основным меню
- **Snap to Grid Conflicts** - устранены конфликты в системе snap to grid между различными источниками
- **Settings Save Performance** - изменена система сохранения настроек - теперь сохраняются только при закрытии/перезагрузке страницы, а не при каждом изменении
- **Asset Panel State** - исправлено сохранение и восстановление состояния панели assets при рестарте
- **Configuration Architecture** - улучшена архитектура конфигурации с поддержкой новых типов настроек

### Improved
- **Settings Panel UX** - улучшен пользовательский интерфейс панели настроек
- **Real-time Sync** - добавлена двусторонняя синхронизация настроек между UI и StateManager
- **Compact Settings Style** - упрощен и оптимизирован стиль отображения настроек
- **Configuration Files** - структурированы конфигурационные файлы по назначению
- **Performance Optimization** - оптимизирована производительность за счет уменьшения операций с localStorage

### Technical
- **SettingsSyncManager** - создан универсальный менеджер синхронизации настроек
- **ConfigManager Extensions** - расширена функциональность ConfigManager для поддержки toolbar и shortcuts
- **UserPreferencesManager** - добавлена поддержка новых типов пользовательских настроек
- **Settings Panel Architecture** - реорганизована архитектура панели настроек с поддержкой новых секций
- **Debounced Saving** - реализована отложенная система сохранения настроек
- **StateManager Integration** - улучшена интеграция с StateManager для мгновенной синхронизации

## [3.25.0] - 2025-01-27

### Fixed
- **Console Context Menu Positioning** - исправлено позиционирование контекстного меню консоли после переноса в оверлей
- **Console Menu Inheritance** - переписан ConsoleContextMenu для наследования от BaseContextMenu
- **Console State Synchronization** - исправлен рассинхрон состояния консоли при рестарте приложения
- **Console Height Persistence** - исправлено сохранение размера консоли в пользовательских настройках
- **Console Resize Functionality** - восстановлена возможность изменения размера консоли
- **Console Content Display** - исправлена пропажа содержимого консоли после рефакторинга

### Improved
- **Console Overlay Integration** - консоль полностью интегрирована как оверлей с правильным позиционированием
- **Context Menu Architecture** - унифицирована архитектура контекстных меню через наследование от BaseContextMenu
- **Console Menu Management** - добавлено принудительное удаление контекстного меню при закрытии консоли
- **Console Positioning** - контекстное меню теперь появляется под курсором и поверх всех элементов
- **Console Visibility Detection** - улучшена логика определения видимости консоли для показа контекстного меню

### Technical
- **BaseContextMenu Integration** - ConsoleContextMenu теперь наследуется от BaseContextMenu
- **Fixed Positioning** - изменено позиционирование контекстных меню с absolute на fixed для оверлеев
- **Event Handling** - улучшена обработка событий мыши для консоли с исключениями для resize handle
- **State Management** - синхронизировано состояние логирования между ConsoleContextMenu и основным кодом

## [3.24.0] - 2025-01-27

### Fixed
- **CSS Architecture** - полностью реорганизована CSS архитектура с модульной структурой
- **Inline Styles Cleanup** - убраны все inline стили из HTML и JavaScript файлов
- **Duplicate Styles** - устранены дублирующиеся CSS стили между файлами
- **Checkbox Colors** - исправлен цвет чекбоксов в меню фильтров (зеленый → синий)
- **Grid Settings Styling** - исправлено отображение настроек грида после рефакторинга CSS
- **Tab Styles Unification** - унифицированы стили табов между AssetPanel и правой панелью

### Improved
- **Modular CSS** - создана модульная структура CSS файлов в папке `styles/`
- **Unified Classes** - унифицированы CSS классы для форм и настроек
- **Hover Effects** - централизована система hover эффектов через HoverEffects utility
- **Compact Mode** - улучшена поддержка компактного режима для всех компонентов
- **Performance** - CSS файлы теперь кэшируются браузером
- **Tab Consistency** - единообразный внешний вид всех табов в приложении

### Technical
- **CSS Files Created** - созданы специализированные CSS файлы:
  - `styles/panels.css` - основные стили панелей
  - `styles/layers-panel.css` - стили панели слоев
  - `styles/settings-panel.css` - стили панели настроек
  - `styles/grid-settings.css` - стили настроек грида
  - `styles/details-panel.css` - стили панели деталей
  - `styles/color-chooser.css` - стили выбора цвета
- **HoverEffects Utility** - создан централизованный класс для hover эффектов
- **CSS Variables** - добавлены CSS переменные для accent-color и font-scale
- **Global Styles** - добавлены глобальные стили для чекбоксов, радио кнопок и слайдеров
- **Unified Tab System** - создана единая система стилей для всех табов (.tab, .tab-right)

## [3.23.0] - 2025-01-27

### Fixed
- **Context Menu Positioning** - исправлено позиционирование контекстных меню в LayersPanel и OutlinerPanel
- **Panel Boundary Detection** - контекстные меню теперь позиционируются относительно панели, а не внутреннего контейнера
- **Menu Stability** - позиция меню больше не зависит от количества элементов в панели

### Improved
- **Unified Separators** - унифицированы стили сепараторов во всех контекстных меню
- **Disabled States** - недоступные команды теперь отображаются как неактивные вместо скрытия
- **Menu Positioning Logic** - улучшена логика позиционирования с учетом границ панели
- **Ultra-Compact Mode** - значительно усилен компактный режим с размером шрифта 12px и минимальными отступами

### Technical
- **LayersContextMenu** - создан специализированный класс для контекстного меню слоев
- **BaseContextMenu** - улучшена поддержка disabled состояний и унифицированных сепараторов
- **Panel Integration** - исправлена интеграция контекстных меню с панелями через parentElement
- **CSS Organization** - реорганизованы стили в модульную структуру в папке `styles/`
- **Compact Mode** - реализован полнофункциональный компактный режим интерфейса

## [3.22.0] - 2025-01-27

### Improved
- **AssetPanel Grid View** - улучшен hover эффект: убрано увеличение, добавлено высветление элементов
- **Marquee Selection** - добавлена подсветка элементов при селекте рамкой во всех режимах просмотра
- **Selection Visual Feedback** - единообразная подсветка при hover и селекте рамкой
- **AssetPanel Context Menu** - убрана команда "Deselect All Assets" из контекстного меню панели
- **Scroll Position** - исправлен сброс позиции скролла при клике в пустое место панели ассетов

### Technical
- **AssetPanel Performance** - оптимизировано обновление выделения без пересоздания контента
- **Marquee Highlighting** - реализована система подсветки элементов при селекте рамкой
- **Hover Effects** - унифицированы hover эффекты для всех режимов просмотра
- **Event Handling** - улучшена обработка событий мыши для селекта рамкой

## [3.21.0] - 2025-01-27

### Improved
- **AssetPanel Details View** - исправлено позиционирование шапки с колонками атрибутов
- **Sticky Header Behavior** - шапка теперь правильно выравнивается встык с табами и следует за горизонтальным скроллом
- **Hexagonal Grid Performance** - кардинально оптимизирована производительность гексагонального грида
- **Grid Size Limits** - увеличен максимальный размер грида с 128px до 512px
- **Grid Overlap Optimization** - минимизирован перехлест гексагонов за пределами экрана
- **Input Validation** - добавлена валидация ввода для размера грида (8-512px)

### Technical
- **AssetPanel Structure** - упрощена структура контейнеров для надежного sticky позиционирования
- **Padding Management** - динамическое управление padding для разных режимов просмотра
- **HexagonalGridRenderer** - упрощен рендеринг, убрана сложная LOD система
- **ConfigManager** - обновлена валидация gridSize до 512px
- **GridSettings** - добавлена HTML валидация с oninput
- **RenderOperations** - увеличен порог медленных кадров до 20ms

### Performance
- **Smart Grid Disable** - грид отключается при >4500 гексагонов для производительности
- **Minimal Overlap** - перехлест рассчитывается на основе радиуса гексагона
- **Clean Console** - убраны отладочные логи для чистой консоли

## [3.20.0] - 2025-01-27

### Added
- **Hexagonal Grid Orientation** - добавлена поддержка ориентации хексагонального грида (Pointy Top / Flat Top)
- **Hex Orientation UI Control** - добавлен селект для выбора ориентации в настройках грида
- **Enhanced Hexagonal Grid Renderer** - полностью переписан рендерер с оптимизированным алгоритмом отрисовки
- **Grid Size Integration** - размер хексагона теперь привязан к общему параметру Grid Size

### Improved
- **Hex Grid Performance** - оптимизирована отрисовка хексагонального грида с использованием Set для избежания дублирования линий
- **Grid Settings UI** - улучшен интерфейс настроек грида с динамическим показом/скрытием опций ориентации
- **Configuration Management** - расширена система конфигурации для поддержки hexOrientation параметра

### Technical
- **ConfigManager** - добавлена поддержка hexOrientation в настройках грида
- **StateManager** - интегрирован hexOrientation в систему состояний
- **UserPreferencesManager** - добавлена поддержка hexOrientation в пользовательских настройках
- **SettingsPanel** - обновлен для сохранения и загрузки hexOrientation

## [3.19.8] - 2025-01-27

### Fixed
- **View Menu Checkboxes** - исправлено обновление чекбоксов панелей в меню View при скрытии тулбара через контекстное меню
- **Game Mode Checkboxes** - исправлено обновление чекбокса Game Mode при деактивации режима
- **Game Mode Menu** - добавлено автоматическое закрытие меню View при отключении Game Mode
- **Panel State Restoration** - исправлен порядок вызовов при выходе из Game Mode для корректного обновления чекбоксов
- **Null Reference Error** - исправлена ошибка "Cannot read properties of null (reading 'style')" в restorePanelStates()

### Improved
- **Checkbox Synchronization** - улучшена синхронизация состояний чекбоксов между различными UI элементами
- **Game Mode UX** - улучшен пользовательский опыт при переключении Game Mode

## [3.19.7] - 2025-09-26

### Fixed
- **Конфигурации пользователя** - добавлены недостающие файлы editor.json и panels.json в config/user/
- **Структура настроек** - теперь пользовательские настройки полностью соответствуют дефолтным

### Improved
- **Очистка кода** - удалены неиспользуемые конфигурационные файлы (assets, camera, performance, selection, toolbar, view)
- **Очистка кода** - удален неиспользуемый IsometricGridRenderer
- **Очистка кода** - удалены example файлы из config/user/
- **Документация** - обновлена структура папок в README

## [3.19.6] - 2025-09-26

### Fixed
- **Удаление слоев** - исправлена ошибка "moveObjectsToMainLayer is not a function" при удалении слоев
- **Контекстное меню слоев** - исправлена проблема с определением слоя под курсором при клике на вложенные элементы
- **API методов** - исправлено использование правильного метода getLayerObjects() вместо несуществующего getObjectsForLayer()

### Improved
- **Надежность удаления** - добавлен метод moveObjectsToMainLayer() для корректного перемещения объектов при удалении слоя
- **Обработка событий** - улучшена обработка событий контекстного меню с использованием closest() для поиска элемента слоя
- **Код** - удалены все отладочные логи из MouseHandlers.js и LayersPanel.js

## [3.19.5] - 2025-09-26

### Fixed
- **Diamond Grid при зуме** - исправлена некорректная отрисовка при зуме камеры
- **Центральные линии при рестарте** - исправлена проблема с отсутствием центральных линий при камере в позиции (0,0)
- **Расчет spacing** - убрана двойная корректировка spacing (трансформация камеры уже применяется в CanvasRenderer)
- **Точность вычислений** - добавлены проверки isFinite() для предотвращения NaN в расчетах пересечений

### Improved
- **Стабильность отрисовки** - diamond grid теперь стабильно работает при всех уровнях зума
- **Обработка граничных случаев** - улучшена обработка линий, проходящих через углы viewport
- **Производительность** - убраны отладочные логи, засоряющие консоль

## [3.19.4] - 2025-09-26

### Fixed
- **Diamond Grid отрисовка** - исправлена проблема с неполным покрытием viewport линиями
- **Зависимость от зума камеры** - добавлена корректировка spacing линий при разных уровнях зума
- **Расчет диапазона линий** - улучшен алгоритм расчета с учетом всех углов viewport

### Improved
- **Полное покрытие viewport** - diamond grid теперь правильно рисует все линии по всему окну
- **Адаптивная плотность** - spacing линий корректируется в зависимости от зума для оптимальной видимости
- **Точность пересечений** - оптимизирован расчет точек пересечения линий с границами видимости

## [3.19.3] - 2025-01-27

### Fixed
- **Контекстное меню тулбара** - исправлено отображение сепаратора и пунктов меню
- **Порядок элементов меню** - Settings всегда остается внизу списка
- **Подсветка текущего типа** - выбранный тип грида подсвечивается синим вместо дизейбла
- **Стабильность меню** - элементы не "прыгают" при обновлении типов гридов

### Improved
- **Обработка сепараторов** - добавлена поддержка `type: 'separator'` в BaseContextMenu
- **Динамическое обновление** - контекстное меню корректно обновляется при смене типа грида
- **Правильная очистка** - `clearGridTypeMenuItems()` удаляет только элементы гридов

## [3.19.2] - 2025-01-27

### Added
- **Карусельное переключение типов гридов** - Ctrl+Click на кнопке Grid для переключения между типами
- **Динамические иконки гридов** - иконка кнопки Grid меняется в зависимости от выбранного типа
- **Автоматическое определение типов гридов** - система автоматически подхватывает доступные рендереры
- **Конфигурируемые иконки** - легко настраиваемые иконки для каждого типа грида
- **Сохранение выбранного типа** - выбранный тип грида сохраняется в пользовательских настройках

### Improved
- **Гибкая архитектура** - код автоматически адаптируется к изменениям в списке рендереров
- **Fallback система** - graceful обработка отсутствующих рендереров
- **Единый стиль иконок** - все иконки гридов в едином геометрическом стиле

### Technical
- **Динамическая инициализация** - `initializeGridTypes()` получает типы из CanvasRenderer
- **Автоматическое обновление** - `refreshGridTypes()` для обновления при изменении рендереров
- **Конфигурационная система** - `gridTypeConfig` Map для хранения настроек типов

## [3.19.1] - 2025-01-27

### Added
- **Модульная архитектура рендеринга сетки** - разделение рендереров по типам сетки
- **BaseGridRenderer** - базовый класс с общей логикой для всех типов сетки
- **RectangularGridRenderer** - специализированный рендерер прямоугольной сетки
- **DiamondGridRenderer** - специализированный рендерер diamond сетки (60°/120°)
- **HexagonalGridRenderer** - специализированный рендерер шестиугольной сетки
- **Унифицированное API** - единый интерфейс для всех типов сетки
- **Общая логика стилизации** - централизованная обработка цветов и толщины линий

### Refactored
- **Убрано дублирование кода** - общая логика вынесена в BaseGridRenderer
- **Упрощена архитектура** - удален промежуточный слой GridRenderer.js
- **Встроена логика выбора рендерера** - интегрирована в CanvasRenderer.drawGrid()
- **Оптимизирована производительность** - устранены лишние вызовы и дублирование

### Fixed
- **Исправлено позиционирование сетки** - устранено двойное применение камеры
- **Исправлена логика изометрической сетки** - правильные углы 60° и 120°
- **Устранены конфликты импортов** - чистая система зависимостей

## [3.19.0] - 2025-01-27

### Added
- **Сохранение позиции скролла тулбара** - автоматическое запоминание позиции прокрутки
- **Восстановление позиции скролла** - позиция восстанавливается при перезагрузке редактора
- **Сохранение при скролле колесом** - позиция сохраняется при прокрутке колесом мыши
- **Сохранение при завершении перетаскивания** - позиция сохраняется при отпускании мыши

### Fixed
- **Исправлена видимость удаленных объектов** - объекты корректно исчезают с canvas после удаления
- **Исправлено сохранение размера консоли** - размер сохраняется только при отпускании мыши, а не при каждом движении
- **Исправлено восстановление позиции тулбара** - позиция скролла корректно восстанавливается при инициализации

### Improved
- **Оптимизировано сохранение настроек** - снижена частота сохранения при изменении размера консоли
- **Улучшена система инвалидации кешей** - добавлена инвалидация пространственного индекса при удалении объектов

## [3.18.0] - 2025-01-27

### Added
- **Настраиваемый snap tolerance** - адаптивная зона притяжения к сетке (5-100%)
- **Сохранение snap tolerance** - настройка сохраняется в пользовательских предпочтениях
- **Единая логика снэпа** - консистентное поведение для перетаскивания, дублирования и drop объектов
- **Централизованный SnapUtils** - единая точка управления логикой снэпа

### Fixed
- **Исправлен снэп дубликатов** - левый нижний угол первого объекта попадает в точку грида
- **Исправлена логика позиционирования** - дубликаты используют правильную точку привязки
- **Устранен дублирующий код** - централизован метод findNearestGridPoint

### Improved
- **Оптимизирована производительность** - кеширование мировых позиций объектов
- **Улучшена консистентность** - все операции снэпа используют одинаковую логику
- **Упрощен код** - удален дублирующий код, улучшена читаемость

### Changed
- **Обновлена архитектура снэпа** - используется существующая логика из dragSelectedObjects
- **Изменена точка привязки** - дубликаты привязываются к позиции курсора, снэп к левому нижнему углу
- **Обновлены пользовательские настройки** - добавлен snapTolerance в UserPreferencesManager

## [3.17.0] - 2025-01-27

### Added
- Добавлен функционал выделения строк в консоли левым клик-драгом
- Добавлено контекстное меню для копирования выделенного текста в консоли
- Добавлены CSS стили для визуального выделения текста в консоли
- Добавлена поддержка двойного клика для выделения всей строки в консоли
- Добавлены клавиатурные сочетания (Ctrl+A, Escape) для работы с выделением

### Fixed
- Исправлена ошибка `ReferenceError: levelId is not defined` в RenderOperations.js
- Исправлено автоматическое сбрасывание выделения текста в консоли
- Исправлены фризы редактора при выделении текста в консоли
- Исправлена работа командной строки консоли при активном выделении
- Исправлена синхронизация пользовательских настроек между сессиями

### Improved
- Оптимизирована производительность выделения текста в консоли
- Улучшена логика определения выделенных строк с использованием throttling
- Упрощена система обработки событий выделения для лучшей производительности
- Удалены лишние debug логи для улучшения производительности
- Улучшена визуальная обратная связь при выделении текста

### Changed
- Обновлена система выделения текста - теперь использует глобальный обработчик вместо множественных локальных
- Улучшена система кэширования состояния выделения для предотвращения лишних обновлений DOM
- Оптимизирована работа с контекстным меню консоли

## [3.16.1] - 2025-01-27

### Fixed
- Исправлено сохранение и восстановление настроек грида при перезапуске редактора
- Исправлено отображение цветов грида в настройках - теперь корректно конвертируются между hex и rgba форматами
- Исправлен сброс настроек грида на дефолтные - теперь применяется синхронизация с GridSettings
- Устранено дублирование функций конвертации цветов - централизованы в RenderUtils
- Удалены лишние логи работы грида для улучшения производительности

### Changed
- Улучшена система загрузки настроек грида - добавлена секция 'grid' в список загружаемых конфигураций
- Оптимизирована конвертация цветов - все функции перенесены в централизованные утилиты

## [3.16.0] - 2025-09-24

### Fixed
- Исправлено панорамирование тулбара средней кнопкой мыши - теперь работает на всем тулбаре включая активные и неактивные кнопки
- Убрано "прилипание" курсора при панорамировании - теперь обычное панорамирование в противоположном направлении движению курсора

### Changed
- Улучшена обработка событий на disabled кнопках тулбара - pointer-events: none позволяет событиям проходить сквозь неактивные элементы

## [3.15.0] - 2025-09-24

### Fixed
- Исправлено отображение canvas при изменении видимости toolbar - теперь canvas автоматически адаптируется под новое доступное пространство
- Исправлено закрытие контекстного меню toolbar при активации команды "Hide" - меню теперь закрывается сразу после выполнения действия
- Убрано лишнее логирование в системе toolbar для оптимизации производительности

### Changed
- Улучшена синхронизация между UI элементами toolbar и системой управления панелями
- Оптимизирована инициализация состояния toolbar с canvas renderer

## [3.14.0] - 2024-12-19

### Added
- Полная система сохранения пользовательских настроек тулбара
- Запоминание состояния кнопок тулбара (Grid, Snap, Parallax, Boundaries, Collisions)
- Запоминание свернутых секций тулбара (File, Edit, View, Group)
- Запоминание настроек отображения (иконки и текст кнопок)
- Запоминание видимости тулбара
- Автоматическое сохранение настроек в localStorage
- Восстановление всех настроек при перезагрузке редактора

### Changed
- Улучшена инициализация тулбара - отрисовывается сразу в правильном состоянии
- Устранено визуальное "переключение" тулбара при загрузке настроек
- Оптимизирована система загрузки состояния тулбара
- Улучшена синхронизация состояния кнопок с StateManager

### Fixed
- Исправлена проблема с инверсным отображением кнопки Boundaries
- Устранена задержка при переключении состояния кнопок тулбара
- Исправлена синхронизация визуального состояния с реальным состоянием функций

## [3.13.0] - 2024-12-19

### Added
- Горизонтальное разделение рабочей области с тулбаром в верхней части
- Полнофункциональный тулбар с кнопками управления (File, Edit, View, Tools, Group)
- Сворачиваемые секции тулбара по клику на заголовок
- Контекстное меню тулбара с командами Hide, Icons, Text
- Горизонтальный скроллинг тулбара (колесо мыши + средний клик)
- Управление видимостью иконок и текста кнопок тулбара
- Интеграция тулбара в систему управления панелями

### Changed
- Переработана структура HTML layout для горизонтального разделения
- Тулбар перемещен в верхнюю часть рабочей области
- Обновлена система управления видимостью панелей для тулбара
- Улучшена интеграция тулбара с Game Mode

### Fixed
- Исправлено позиционирование контекстного меню тулбара (открывается вниз)
- Улучшена синхронизация состояний тулбара с меню View
- Оптимизированы стили тулбара для новой позиции

## [3.11.0] - 2024-12-19

### Added
- Улучшенная система контекстных меню с централизованным управлением
- Оптимизированные стили для всех контекстных меню (BaseContextMenu, ConsoleContextMenu)
- Улучшенная функциональность OutlinerContextMenu с исправленными багами

### Changed
- Обновлена система стилей контекстных меню для лучшей совместимости
- Улучшена производительность отображения контекстных меню

### Fixed
- Исправлены проблемы с отображением контекстных меню
- Устранены баги в OutlinerContextMenu
- Улучшена стабильность работы с контекстными меню

## [3.10.0] - 2024-12-19

### Added
- Система констрейна оси при перетаскивании объектов с зажатым Shift
- Визуальное отображение оси констрейна с настраиваемыми параметрами
- Настройки оси констрейна в панели настроек (цвет, толщина, включение/отключение)
- Сохранение всех настроек View в пользовательских настройках
- Корректное вычисление центра групп для оси констрейна
- Поддержка фиксации оси к текущей позиции объекта при зажатии Shift

### Changed
- Ось констрейна теперь фиксируется к центру объекта/группы, а не к курсору
- Ось отображается в обе стороны от центра до краев видимой области
- Настройки View (Grid, Game Mode, Snap To Grid, Object Boundaries, Object Collisions) теперь сохраняются между сессиями
- Game Mode корректно восстанавливается при перезапуске редактора

### Fixed
- Исправлена отрисовка оси констрейна с учетом зума и панорамирования камеры
- Исправлено вычисление центра групп для более точного позиционирования оси
- Исправлено сохранение состояния Game Mode при перезапуске

## [3.9.0] - 2024-12-19

### Added
- Новая система поиска в OutlinerPanel с использованием унифицированного SearchUtils
- Контекстное меню для объектов в OutlinerPanel (OutlinerContextMenu)
- Логика выделения диапазона объектов (Shift+клик)
- Логика переключения единичных объектов (Ctrl+клик)
- Поддержка выделения по отфильтрованному списку при активном поиске
- Новый класс SearchUtils для унифицированного поиска в панелях
- Поддержка Logger.outliner для логирования операций OutlinerPanel

### Changed
- OutlinerPanel теперь использует общую систему поиска с LayersPanel
- Стиль переименования объектов приведен в соответствие с LayersPanel
- Позиционирование иконок типов объектов исправлено и выровнено
- reassignIdsDeep теперь создает строковые ID вместо числовых
- Улучшена индексация дублированных объектов в группах

### Fixed
- Исправлено контекстное меню, которое постоянно показывалось и не исчезало
- Исправлено накопление обработчиков событий при пересоздании контекстного меню
- Исправлена работа контекстного меню на дублированных объектах
- Исправлено позиционирование иконок типов объектов в OutlinerPanel
- Исправлено появление скролл-бара при активации переименования

## [3.8.8] - 2024-12-19

### Fixed
- Исправлены координаты дублируемых объектов в открытых группах - теперь дубликаты появляются точно в том же месте, что и оригиналы
- Исправлен расчет мировых координат для объектов внутри групп при дублировании
- Упрощена логика размещения дублированных объектов в режиме редактирования групп

## [3.8.7] - 2024-12-19

### Added
- Защита от добавления объектов на заблокированные слои через drag&drop

### Changed
- Ctrl+Click на слое теперь выбирает все объекты в слое вместо выбора слоёв
- Alt+Click+Drag теперь работает на любых объектах, не только выбранных

### Fixed
- Исправлена команда "Show All Layers" - объекты корректно отображаются после изменения видимости
- Исправлено дублирование с Alt+Click на невыбранных объектах

### Removed
- Удалена команда "Move Objects to Main Layer" из контекстного меню слоёв
- Удалена логика выбора слоёв (selectedLayers) и связанные методы
- Удалены пункты меню "Select All Layers" и "Deselect All"

## [3.8.6] - 2024-12-18

### Fixed
- Исправлена система версионирования
- Улучшена архитектура утилитарных классов
