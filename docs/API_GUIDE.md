### LevelEditor (src/core/LevelEditor.js)
Главный класс редактора уровней.

#### Диалоги и окна:
- `async showSplashScreen()` - отображение splash screen диалога с информацией о версии (вручную)
- `maybeShowSplashOnFirstVisit()` - показывает splash screen один раз при первом визите; флаг `levelEditor_hasSeenSplash` в localStorage предотвращает повтор
- `openSettings()` - открытие панели настроек
- `async importAssets()` - импорт ассетов из внешних папок

#### Файловые операции — уровни (v3.57.0 Phase 5-6: multi-level tabs):
- `async newLevel()` - создание нового уровня ДОБАВЛЯЕТ вкладку (LevelSession), а не заменяет текущий открытый уровень; переключает на новый уровень через `levelsManager.addLevel()`
- `async openLevel()` - открытие уровня из файла ДОБАВЛЯЕТ вкладку; делает best-effort деdup по fileName — если файл уже открыт, переключается на существующую вкладку вместо дубликата; пишет Open Recent
- `async openLevelFromAsset(asset)` - v4.53.0: catalog `type=level` (viewport drop). `LevelAssetUtils.resolveLevelSrc`/`contentUrl`/`isLevelDocument` → `openLevelFromData`. Dblclick ассета открывает Asset Editor, не уровень.
- `async saveLevel()` - сохранение текущего уровня; per-session fileName; без имени — prompt "Enter file name:" (default `level.json`); FSA: `content/maps/<file>` + manifest, иначе download; Open Recent
- `async saveLevelAs()` - prompt имени; обновляет per-session `session.fileName`; тот же FSA/download; Open Recent
- `async closeLevel(levelId)` (новый, v3.57.0) - закрытие вкладки уровня; нельзя закрыть последний открытый уровень; спрашивает подтверждение если уровень содержит несохранённые изменения

#### Файловые операции — проект (v3.57.0 Phase 7: Project; FSA v4.51.0–v4.52.0):
- `async newProject()` - создание нового проекта: очищает все открытые уровни, создаёт один пустой уровень с baseline history. Единый confirm-диалог при несохранённых правках вместо N диалогов. **Replace-not-merge**: заменяет весь набор открытых вкладок.
- `async openProject()` - открытие проекта из файла: парсит все уровни из project-JSON, восстанавливает видимость/порядок/currentLevelIndex. **Replace-not-merge**: новые уровни заменяют весь набор открытых табов. Единый confirm при dirty (Edge Case 11). Пишет Open Recent.
- `async saveProject()` - async; без pinned `project.fileName` — имя из `project.name` (`fileNameIsAuto`); `FsaStore.writeWorkingDirFile` или download; Open Recent
- `async saveProjectAs()` - async; prompt имени; FSA folder или download; Open Recent
- `async setProjectFolder()` - v4.52.0: File → Set Project Folder... → `FsaStore.pickWorkingDirectory()` + `reloadProjectContent()`; handle IndexedDB, name localStorage (не Project JSON); returns handle or null
- `async reloadProjectContent({onlyIfGranted?, skipFetchFallback?}?)` - v4.52.0: `FsaContentFs.ensureDefaultContentLayout` → `assetManager.scanFromFsa` → refresh FoldersPanel; no folder / no content → optional `scanContentFolder`; returns boolean
- `async clearProjectFolder()` - v4.52.0: `FsaStore.clearWorkingDirectory` + rescan served `./content/` + refresh FoldersPanel
- `async openRecentFile(id)` - U3: открыть level/project из MRU-кэша (`editor.recentFiles`)
- `clearRecentFiles()` - U3: очистить список Open Recent
- `async openProjectSettings()` - ProjectSettingsDialog: `project.name` + Project Folder (Choose…→`setProjectFolder` / Clear→`clearProjectFolder`)
- `async createAssetOfType(typeId)` - placeholder в активной папке Asset panel; `FsaContentWriter.saveNewAsset` + manifest; status `Created "name" → rel` если записано

#### Версия:
- `static VERSION` - текущая версия редактора (строка, например `'4.54.0'`)
- `updateVersionInfo()` - обновление отображения версии в UI

#### Copy/Paste/Duplicate (Ctrl+C/X/V, Shift+D):
- `copySelectedObjects()` - Ctrl+C, сохраняет deep-clone выделённых объектов в `levelEditor.clipboard`
- `cutSelectedObjects()` - Ctrl+X, копирует и удаляет выделённые объекты
- `pasteObjects()` - Ctrl+V, вставляет объекты из clipboard с использованием интерактивного flow размещения; no-op если курсор не над канвой (`mouse.isOverCanvas === false`); вызывает `duplicateOperations.startFromObjects()`
- `duplicateSelectedObjects()` - Shift+D, вызывает `duplicateOperations.startFromSelection()`

#### Операции с выделением:
- `selectObject(id)` - выделение объекта по ID
- `clearSelection()` - очистка выделения
- `deleteSelectedObjects()` - удаление выделённых объектов

### HorizontalScrollUtils (src/utils/HorizontalScrollUtils.js)
Утилита для настройки горизонтального скролла с поддержкой колеса мыши и средней кнопки.

#### Основные методы:
- `setupHorizontalScrolling(container, options)` - настройка горизонтального скролла для контейнера
- `startScrolling(container, config, e)` - начало скролла средней кнопкой мыши
- `updateScrolling(container, config, e)` - обновление позиции скролла при движении мыши
- `stopScrolling(container, config)` - завершение скролла и сохранение позиции
- `removeScrolling(container)` - удаление обработчиков событий скролла
- `saveScrollPosition(container, config)` - сохранение позиции скролла в пользовательских настройках

#### Опции конфигурации:
- `sensitivity` - чувствительность скролла (по умолчанию: 1.0)
- `preferenceKey` - ключ для сохранения позиции в настройках
- `isScrolling` - флаг активного скролла

#### Особенности:
- **Универсальность**: может использоваться для любых горизонтально скроллируемых контейнеров
- **Курсоры**: автоматическое изменение курсора на "grab" при наведении и "grabbing" при скролле
- **Сохранение состояния**: позиция скролла автоматически сохраняется в пользовательских настройках
- **Скрытие скроллбара**: визуально скрывает скроллбар при сохранении функциональности
- **Конфликт с drag**: корректно обрабатывает конфликты между скроллом и drag-and-drop

### GlobalEventRegistry (src/event-system/GlobalEventRegistry.js)
Глобальная регистрация событий компонентов.

#### Основные методы:
- `registerComponentHandlers(componentId, handlers, target)` - регистрация глобальных событий
- `unregisterComponentHandlers(componentId)` - отмена регистрации
- `isComponentRegistered(componentId)` - проверка регистрации
- `getRegisteredComponents()` - получение списка компонентов
- `cleanup()` - очистка всех компонентов

### HistoryManager (src/managers/HistoryManager.js)
Управление историей операций.

#### Основные методы:
- `saveState(state, isInitial)` - сохранение состояния
- `undo()` - отмена операции
- `redo()` - повтор операции
- `canUndo()` - проверка возможности отмены
- `canRedo()` - проверка возможности повтора
- `clear()` - очистка истории
- `exportState()` - снятие undo/redo стека (используется при переключении уровней)
- `importState(exportedState)` - восстановление undo/redo стека

### LevelsManager (v3.57.0 Phase 6) (src/core/LevelsManager.js)
Управление множеством открытых LevelSession (инфраструктура для multi-level поддержки).

#### Основные методы:
- `addLevel(level, opts)` - регистрация новой сессии уровня; отслеживает `levelMRU` для fallback при закрытии
- `setCurrentLevel(levelId)` - переключение текущего уровня (сохраняет/восстанавливает camera, selectedObjects, groupEditMode, currentLayerId, history); обновляет `levelMRU`
- `getCurrentSession()` - получение текущей LevelSession
- `getOrderedSessions()` - получение всех сессий в порядке добавления (табы)
- `getVisibleSessions()` - получение видимых уровней (eye-icon вкл); если есть soloed-сессии, возвращает только их, иначе фильтр по `visible` флагу
- `toggleLevelVisibility(levelId)` - переключение видимости уровня; soft-cap warning при >5 видимых уровней
- `toggleLevelSolo(levelId)` - Ctrl+click на eye-icon уровня (эксклюзивный solo, как LayersPanel.toggleLayerSolo); сбрасывает solo у остальных уровней, повторный клик снимает solo
- `cycleLevel(direction)` - циклическое переключение между открытыми уровнями (direction: +1 следующий, -1 предыдущий); используется для Ctrl+PageDown/PageUp
- `getVisibleSessionsForRender(sessions?)` - видимые уровни в порядке рендера (текущий ВСЕГДА в конце, рисуется поверх остальных, независимо от позиции таба) — Phase 6
- `reorderLevels(newOrder)` - переупорядочивание открытых уровней; newOrder должна быть полная перестановка `levelOrder`, иначе no-op; используется для drag-reorder в LevelsPanel — Phase 6
- `closeLevel(levelId)` - закрытие вкладки (нельзя закрыть последний открытый уровень, спрашивает подтверждение при dirty); при закрытии текущего уровня выбирает следующий по MRU fallback
- `hasAnyUnsavedChanges()` - проверка наличия несохранённых изменений в любом открытом уровне (not just current)

#### Примечание:
- Фаза 1 (v3.57.0): внутренняя инфраструктура для управления сессиями
- Фаза 2 (v3.57.0): LevelsPanel UI-компонент для управления списком уровней
- Фаза 3 (v3.57.0): композитинг рендеринга нескольких видимых уровней; namespacing кешей для защиты от коллизий id
- Фаза 5 (v3.57.0): per-session save, closeLevel, dirty-tracking
- Фаза 6 (v3.57.0): levelMRU fallback, cycleLevel, getVisibleSessionsForRender (текущий поверх), reorderLevels, drag-reorder UI, дизамбигуация имён

### AssetPanel (src/ui/AssetPanel.js) — v3.60.2 Фаза 4 завершена
Главная панель ассетов с поддержкой табов, фолдеров и превью (1154 строк orchestration-слой).

#### Архитектура (7 контроллеров):
- **AssetFoldersController** — навигация по папкам, управление табами папок
- **AssetViewRenderer** — рендеринг превью (grid/list/details)
- **AssetFilterController** — поиск и фильтр по типу ассета
- **AssetSelectionController** — выделение ассетов (multi-select, select-all)
- **AssetDragDropController** — drag-out ассетов на canvas (`application/x-asset-ids`, effectAllowed `copyMove`; canvas drop still copies), import PNG files
- **AssetItemActionsController** — контекстные меню, действия на ассеты
- **AssetToolbarController** — тулбар (zoom size, view mode), персистентность

#### Основные методы AssetPanel:
- `render()` - отрисовка панели ассетов (delegate → `this.viewRenderer.render()`)
- `getActiveTabPath()` - получение пути активного таба
- `selectAsset(assetId)` - выбор ассета
- `handleAssetWheel()` - mouse wheel навигация по табам
- `handleDrop()` - создание ассетов из dropped файлов
- `handleAssetSave()` - сохранение ассета после редакции
- `autoResizePanelHeight()` - автоподгонка высоты панели
- `destroy()` - очистка ресурсов

#### Особенности:
- **Двухпанельная структура**: левая панель с фолдерами, правая с превью ассетов
- **Система табов**: создание табов перетаскиванием папок (AssetFoldersController)
- **Multi-select**: поддержка множественного выбора ассетов (AssetSelectionController)
- **Гибкие размеры**: настраиваемый размер превью ассетов (AssetToolbarController)
- **Поиск и фильтрация**: поиск и фильтры по типам (AssetFilterController)
- **Drag-and-drop**: перетаскивание ассетов на canvas (copy) или на Content-tree folder / folder tab (move); импорт PNG (AssetDragDropController)
- **Контекстные меню**: правый клик для дополнительных действий (AssetItemActionsController)

### AssetManager (src/managers/AssetManager.js)
Управление ассетами с поддержкой динамической загрузки из манифеста и placeholder-созданием по каталогу типов.

#### Основные методы:
- `loadDefaultAssets()` - загрузка стандартных ассетов
- `scanContentFolder()` - сканирование served `./content/` (fetch манифеста + JSON)
- `async scanFromFsa()` - v4.52.0: replace in-memory library from granted project folder (`FsaContentFs.scanContentTree` + `resolveImageSrc` + `ingestAssetJson`); revokes prior blob URLs
- `ingestAssetJson(filePath, assetData, result, imgSrcOverride)` - v4.52.0: register one asset JSON (shared by fetch and FSA paths); `imgSrcOverride` skips `./content/` path build; type via `LevelAssetUtils.resolveCatalogAssetType` (map JSON → `level`; non-image `imgSrc` cleared)
- `buildCategoriesFromManifest(structure, parentPath, result)` - построение категорий из манифеста
- `buildCategoriesFromStructure(result)` - построение категорий из известной структуры
- `loadAssetFromFile(filePath, result)` - загрузка ассета из файла (fetch → `ingestAssetJson`)
- `addAsset(assetData)` - добавление ассета
- `removeAsset(assetId)` - удаление ассета
- `getAsset(assetId)` - получение ассета по ID
- `getAllAssets()` - получение всех ассетов
- `getAssetsByCategory(category)` - получение ассетов по категории
- `getCategories()` - получение всех категорий
- `searchAssets(query)` - поиск ассетов
- `createPlaceholderAsset(typeId, customName?, folderPath?)` - создание placeholder-ассета по типу из каталога (Assets → Add → Category → Type); использует `typeDef.width`/`height`/`color` если заданы, иначе дефолты (48×48 + цвет категории); автоматически прикрепляет default-компоненты из `DEFAULT_ASSET_COMPONENTS[typeId]`

#### Особенности:
- **Манифест-система**: структура из `content/manifest.json` (fetch) или FSA scan (v4.52.0)
- **Динамическое сканирование**: Refresh / Set Project Folder → `reloadProjectContent`
- **Кеширование изображений**: оптимизация загрузки превью; FSA images as blob URLs
- **Структурированная организация**: поддержка иерархии папок
- **Обработка ошибок**: graceful handling ошибок загрузки файлов
- **Catalog-driven placeholder creation**: 31 встроенный тип ассетов (Core + `level`, Data + `eventGraph`, Visual/Render, Audio, Navigation/AI, Other); каждый тип может быть создан как placeholder с опциональными custom размерами/цветом и auto-attached компонентами. Drop `level` открывает карту; drop `eventGraph` применяет graph к текущему уровню.

### LevelAssetUtils (src/utils/LevelAssetUtils.js)
Хелперы каталога type=`level` и полных map JSON (v4.53.0).

- `isLevelDocument(data)` - `objects[]` + `layers[]` + `settings`
- `resolveLevelSrc(asset)` - `asset.properties.levelSrc` || `asset.path`
- `contentUrl(rel)` - `./content/<stripped rel>`
- `resolveCatalogAssetType(assetData, filePath)` - явный `type` (кроме `image`) → as-is; иначе level-document → `level`; иначе `assetData.type` || `image`

### AssetTabsManager (src/ui/AssetTabsManager.js)
Управление табами панели ассетов с поддержкой горизонтального скролла и drag-and-drop.

#### Основные методы:
- `render()` - отрисовка всех табов с визуальным выделением активных (поддержка multi-select)
- `syncTabToFolder()` - синхронизация визуального выделения табов с выбранными папками (не создает табы автоматически)
- `addFolderTab(folderPath)` - добавление таба для папки (только при дропе)
- `removeFolderTab(folderPath)` - удаление таба папки
- `handleTabClick(e, folderPath)` - обработка клика по табу (поддержка Shift+клик для multi-select)
- `getFolderName(folderPath)` - получение имени папки для отображения в табе
- `setupContextMenu()` - настройка контекстного меню для табов
- `setupTabDragging()` - настройка drag-and-drop для табов с правильными курсорами
- `setupFolderDragToTabs()` - folder drop on the tabs strip pins a tab; asset drop on a `.tab` calls `folderOps.moveAssetsByIds`
- `setupHorizontalScrolling()` - настройка горизонтального скролла колесом мыши и средней кнопкой
- `loadScrollPosition()` - загрузка сохраненной позиции скролла из пользовательских настроек
- `saveTabOrder()` - сохранение порядка табов
- `destroy()` - очистка ресурсов

#### Особенности:
- **Multi-select**: поддержка множественного выбора табов через Shift+клик
- **Горизонтальный скролл**: навигация по табам колесом мыши и средней кнопкой
- **Drag-and-drop**: перетаскивание табов с правильными курсорами (палец → схватывание); drop assets onto a `.tab` moves them; folder→tabs still adds a tab
- **Сохранение состояния**: позиция скролла сохраняется в пользовательских настройках
- **Контекстное меню**: правый клик на табах для дополнительных действий
- Табы создаются **только** при перетаскивании папок на контейнер табов
- Поддержка **multi-select** через Shift+клик (как на табах, так и на фолдерах)
- Визуальное выделение всех выбранных табов при multi-select
- Синхронизация с выбором папок в FoldersPanel
- Управление состоянием через StateManager (`activeAssetTabs`, `activeAssetTab`)

### FoldersPanel (src/ui/FoldersPanel.js)
Панель иерархической структуры папок ассетов с поддержкой динамического создания фолдеров.

#### Основные методы:
- `render()` - отрисовка панели фолдеров
- `renderFolderContent()` - обновление содержимого фолдеров без пересоздания структуры
- `updateLayout()` - оптимизированное обновление только обрезки имен при ресайзе (без пересоздания элементов)
- `buildFolderStructure()` - построение структуры фолдеров из манифеста и ассетов
- `buildFromManifestStructure(parentFolder, structure, parentPath)` - создание структуры из манифеста
- `addAssetsToStructure(parentFolder, assets)` - добавление ассетов в структуру (создание фолдеров по необходимости)
- `selectFolder(path, event)` - выбор папки (поддержка Shift+клик для multi-select)
- `toggleFolderExpansion(path)` - переключение раскрытия папки
- `toggleFolderExpansionRecursive(path)` - рекурсивное раскрытие/сворачивание папки
- `getFolderByPath(path)` - получение папки по пути
- `getCategoriesInFolder(folder)` - получение категорий ассетов в папке
- `truncateName(name, maxWidth)` - обрезка длинных имен папок
- `refresh()` - обновление структуры при изменении ассетов
- `destroy()` - очистка ресурсов

#### Особенности:
- **Динамическое создание фолдеров**: автоматическое создание папок для ассетов, не входящих в манифест
- **Двухэтапное построение**: сначала из манифеста (включая пустые папки), затем добавление ассетов
- **Multi-select**: поддержка множественного выбора папок через Shift+клик и Ctrl+клик
- **Рекурсивное раскрытие**: Shift+клик на иконке раскрытия для раскрытия всех вложенных папок
- **Умная обрезка имен**: динамическая обрезка длинных имен папок с учетом доступного места
- **Drag-and-drop**: перетаскивание папок на контейнер табов для создания табов (`application/x-folder-path` + `application/x-folder-paths`); folder items are drop targets — assets → `folderOps.moveAssetsByIds`, folders → `folderOps.moveFolders`
- **Синхронизация с табами**: автоматическая синхронизация выбора с AssetTabsManager
- **FoldersContextMenu (v4.52.0)**: RMB — **New Folder** / **Delete Folder** (Delete hidden on root) → `AssetFolderOps`
- **ResizeObserver**: автоматическое обновление при изменении размера панели
- **Оптимизация ресайза**: при изменении размеров окна обновляется только текст обрезки без пересоздания элементов DOM (метод `updateLayout()`)

### LevelsPanel (v3.57.0 Phase 2, v3.58.0: отдельная вкладка) (src/ui/LevelsPanel.js)
Панель списка открытых уровней для управления множеством LevelSession.

#### Основные методы:
- `render()` - отрисовка списка открытых уровней
- `renderLevelsSection()` - обновление содержимого списка с фильтрацией по поиску
- `renderLevelsSearchControls()` - отрисовка поля поиска (вызывается из SearchSectionUtils при активации вкладки 'levels')
- `setCurrentLevelAndNotify(levelId)` - переключение текущего уровня с обновлением UI
- `renameLevel(levelId)` - переименование уровня с диалогом подтверждения
- `toggleLevelVisibility(levelId)` - переключение видимости уровня

#### Контекстное меню:
- "Make Current" - переключение на текущий уровень
- "Rename" - переименование уровня

#### Особенности:
- **Размещение** (v3.58.0): самостоятельная вкладка в правой панели (раньше был вложен в вкладку Layers). DOM-элемент: `#levels-content-panel` (`index.html:148`), прямой потомок tab-content container, как `#layers-content-panel`, `#outliner-content-panel`, `#details-content-panel`
- **Функциональность**: кнопка "+Add" для добавления новых уровней через `LevelsManager.addLevel()`
- **Eye-icon**: переключение per-level visibility; Ctrl+click = solo-режим (эксклюзивная видимость); paint-drag (v3.58.0): mousedown + drag по другим eye-иконкам применяет взятое значение ко всем пройденным
- **Поиск**: интегрирован с SearchSectionUtils для фильтрации уровней (guard на видимость собственного `#levels-content-panel`)
- **Paint drag** (v3.58.0): временное отключение `draggable` на строке уровня при drag-операции, чтобы не перехватить HTML5 drag-reorder жест
- **Drag-reorder**, **per-session dirty-индикатор**, **Close/Save/Duplicate** — реализованы в Phase 5-6, см. ARCHITECTURE.md LevelsPanel

### FileManager (src/managers/FileManager.js)
Управление файлами.

#### Основные методы:
- `createNewLevel()` - создание нового уровня
- `async saveLevel(level, fileName)` - JSON уровня; FSA `writeContentFile` (`toLevelRelativePath` → обычно `maps/<name>`) + `ensureManifestEntry`; иначе `FileUtils.downloadData`
- `async loadLevel(file)` - загрузка уровня
- `async loadLevelFromFileInput()` - загрузка уровня из файла
- `isValidFile(file)` - проверка валидности файла
- `getCurrentFileName()` - получение текущего имени файла
- `setCurrentFileName(fileName)` - установка имени файла

### ConfigManager (src/managers/ConfigManager.js)
Централизованное управление всеми настройками редактора.

#### Основные методы:
- `async loadAllConfigs()` - загрузка всех конфигураций
- `async loadUserConfig(configName)` - загрузка пользовательской конфигурации
- `async saveUserConfig(configName, config)` - сохранение пользовательской конфигурации
- `get(path)` - получение настройки по пути
- `set(path, value)` - установка настройки
- `getAll()` - получение всех конфигураций
- `reset()` - сброс к значениям по умолчанию

### UserPreferencesManager (src/managers/UserPreferencesManager.js)
Управление пользовательскими предпочтениями.

#### Основные методы:
- `loadPreferences()` - загрузка предпочтений
- `savePreferences()` - сохранение предпочтений
- `get(key)` - получение предпочтения
- `set(key, value)` - установка предпочтения
- `update(updates)` - обновление предпочтений
- `reset()` - сброс предпочтений
- `getAll()` - получение всех предпочтений

### CacheManager (src/managers/CacheManager.js)
Управление кэшированием данных.

#### Основные методы:
- `getCachedObject(objId)` - получение кэшированного объекта
- `getCachedTopLevelObject(objId)` - получение верхнеуровневого объекта
- `getCachedEffectiveLayerId(obj)` - получение эффективного ID слоя
- `clearCaches()` - очистка всех кэшей
- `invalidateObjectCaches(objId)` - инвалидация кэшей объекта
- `smartCacheInvalidation(invalidationSpec)` - умная инвалидация кэша

### ResizerManager (src/managers/ResizerManager.js)
Унифицированный менеджер для всех разделителей панелей.

#### Основные методы:
- `registerResizer(resizer, panel, panelSide, direction, onDoubleClick)` - регистрация разделителя
- `unregisterResizer(resizer)` - удаление разделителя
- `setupMouseEvents(resizer, panel, panelSide, direction)` - настройка mouse событий
- `handlePanelResize(panel, panelSide, direction, newSize)` - унифицированная логика изменения размера
- `savePanelSize(panelSide, direction, size)` - сохранение размера панели
- `destroy()` - уничтожение менеджера и очистка всех разделителей

### DockManager (src/ui/dock/DockManager.js)
Единственная оконная система (Phase B). Экземпляр: `editor.dockManager`. Binary split-tree + floating windows; level contentTypes: `viewport`, `outliner`, `details`, `layers`, `assets`, `levels`; asset-editor (float `role=assetEditor`): `assetPreview` (canvas mini-viewport: RMB pan / wheel+MMB zoom; info HUD; **F**/`fitToSelection`, **A**/`fitToAsset` when AE under cursor), `assetIdentity`, `assetComponents`, `assetComponentDetails`. API: `openAssetEditorWorkspace(opts?)`, `closeAssetEditorWorkspace()`, `syncAssetEditorTitle()`, `findAssetEditorFloat()`. Entry: `editor.showActorPropertiesPanel(asset)` sets `editingAssetId` and opens the float.

#### Основные методы:
- `init()` — mount в `#dock-workspace` / `#split-root` / `#floating-layer`; restore `panels.dock.*` или default tree
- `destroy()` — flush persist, teardown renderer/drag/registry
- `showContentType(contentType, opts?)` — reopen closed type; если main tree уже есть — floating (`opts.x/y/w/h`); иначе root mainTree. No-op если type уже present
- `hideContentType(contentType)` — remove leaf (content parks in pool); `true` если удалён
- `toggleContentType(contentType)` — hide if present else show; returns whether present after toggle
- `hasContentType(contentType)` — leaf present in main or floating
- `getLayoutSnapshot()` — `{ mainTree, floatingWindows }`
- `resetLayout()` — default tree + immediate save
- `enterImmersiveLayout()` / `exitImmersiveLayout()` — Game Mode: viewport-only, restore previous snapshot

#### Persist / layout:
- Активные ключи: `panels.dock.mainTree`, `panels.dock.floatingWindows` (`DockPersistence`)
- Nested splits: `DockTreeModel` binary nodes (`direction: 'row'|'column'`, `ratio`, 2 children) — произвольная глубина
- Customize: `isDockCustomizeKey` (Shift) для move/split/clone/float snap; free-move float без Shift
- Multi-instance: `DockPanelFactory` (self-drop clone); multi-viewport — `ViewportViewManager`
- View menu / Alt+1/2/4: `EventHandlers.togglePanel` → dock contentTypes (legacy left/right/assets → outliner/details/assets)
- Stale (неактивны): L/R tab shells, `tabPositions`, `leftPanelTabOrder`/`rightPanelTabOrder`, `leftPanelSplits`/`rightPanelSplits`, fixed L/R widths

---

### Project (src/models/Project.js)
Модель проекта (контейнер набора открытых уровней).

#### Основные методы:
- `toJSON(levelSessions, levelOrder, currentLevelId)` - экспортирует проект в self-contained JSON: эмбеддит `Level.toJSON()` каждого открытого уровня + метаданные (per-level `visible` и `fileName`), `levelOrder` (порядок табов), и `currentLevelIndex` (позиция в массиве, т.к. Level.toJSON не сериализует id)
- `static fromJSON(json)` - парсит project-JSON обратно в набор уровней (восстанавливает per-level history из exported state)

#### Назначение:
- Полная сохранённость multi-level сессии в одном файле (в отличие от single-level `Level.toJSON()`)
- Уровни **embedded** в project JSON (не path-ссылки). Disk writes — через FsaStore directory handle (IndexedDB, machine-local); handle **не** входит в Project.toJSON()

### ProjectFileOperations (src/core/ProjectFileOperations.js)
Файловые операции проекта (BaseModule).

#### Основные методы:
- `async newProject()` - создание нового проекта: очищает все открытые уровни, создаёт один пустой с baseline history. Единый confirm-диалог при несохранённых правках вместо N диалогов.
- `async openProject()` - открытие проекта из файла: парсит все уровни ДО очистки текущих (невалидная запись не оставит редактор без открытого уровня). Replace-not-merge: новые уровни заменяют весь набор табов. Единый confirm при dirty.
- `async saveProject()` - async; без `project.fileName` — `_deriveFileNameFromProjectName()`; `writeWorkingDirFile` или download
- `async saveProjectAs()` - async; prompt имени; FSA или download
- `async _doSaveProject(fileName, isAuto)` - private write path
- `_activateBootstrappedSession(level)` - приватный helper: переключение на новую сессию с перезагруженным history
- `_cleanupAllOpenSessions()` - приватный helper: очистка orphaned entries в per-levelId кешах (renderOperations.spatialIndex, visibleLayersCache и т.д.)
- `_deriveFileNameFromProjectName()` - приватный helper: преобразует `project.name` в имя файла (заменяет `/` и `\` на `-`, добавляет `.json`)

#### Семантика:
- **Replace-not-merge**: `newProject()` и `openProject()` заменяют весь набор открытых уровней (не добавляют к существующим)
- **Per-session history**: каждая фоновая сессия при загрузке получает seeded history (иначе `addLevel({makeCurrent:false})` не пропускает живой HistoryManager)
- **saveProject() без диалога имени**: в отличие от `saveLevelAs()` / `saveProjectAs()`, имя из `project.name` или pinned `project.fileName`; при granted folder — in-place write без browser save dialog

### ProjectSettingsDialog (src/ui/ProjectSettingsDialog.js)
Диалог редактирования параметров проекта (extends BaseDialog, Phase 7).

#### Основные методы:
- `show()` - отображение диалога с текущими значениями проекта (re-render Project Folder row)
- `hide()` - скрытие диалога без применения изменений
- `commitChanges()` - применение изменений проекта
- `destroy()` - очистка ресурсов

#### Текущие поля:
- `project.name` - `<input type="text">`
- **Project Folder** - label + Choose… (`levelEditor.setProjectFolder`) / Clear (`levelEditor.clearProjectFolder`); hint: Level Designer folder or its `content/` folder; machine-local; after Choose, Assets Content tree shows that folder

#### Отложенные поля (Open Questions #9):
- Default asset import path
- Default grid/snap для новых уровней проекта
- Naming convention
- (явно задокументированы в UI, реализация отложена)

### FsaStore (src/utils/FsaStore.js)
Static File System Access helpers (v4.51.0). PixisEditor-style working directory.

#### Константы:
- IndexedDB: `levelDesignerFsaHandles` / store `handles` / key `workingDir`
- localStorage name: `levelDesignerFsaWorkingDirName`

#### Основные методы:
- `isSupported()` - `showOpenFilePicker` + `showSaveFilePicker` + `showDirectoryPicker`
- `getWorkingDirectoryName()` - folder name or null
- `async pickWorkingDirectory()` - `showDirectoryPicker({ mode: 'readwrite' })`, persist handle
- `async clearWorkingDirectory()` - drop handle + name
- `async getWorkingDirectoryHandle()` / `async verifyPermission(handle, mode)`
- `async getContentDirectoryHandle()` - `content/` subdir if present, else picked folder
- `async writeWorkingDirFile(rel, data)` / `async writeContentFile(rel, data)` - `Promise<boolean>`
- `async ensureManifestEntry(rel, assetManager?)` - update `content/manifest.json` files[] + structure
- `toContentRelativePath(path)` - strip `root/` / `./content/` / `content/`
- `toLevelRelativePath(fileName)` - bare name → `maps/<name>`

### FsaContentWriter (src/utils/FsaContentWriter.js)
Write content assets into the granted project folder (v4.51.0).

#### Основные методы:
- `assetToDiskJson(asset)` - persistable JSON; `imgSrc` = sibling basename; drop `path` and data-URL imgSrc
- `async saveAsset(asset, {updateManifest?, assetManager?})` - `Promise<string|null>` content-relative path; PNG sibling when data-URL imgSrc
- `async saveNewAsset(asset, assetManager)` - `saveAsset` with `updateManifest: true`

### FsaContentFs (src/utils/FsaContentFs.js)
Content-root layout, scan, and CRUD over the granted project folder (v4.52.0–v4.54.0). Complements `FsaStore` writes.

#### Константы:
- `DEFAULT_DIRS` - `['assets', 'maps', 'graphs']`

#### Path helpers:
- `uiFolderToContentRel(folderPath)` - UI path (`root/...`) → content-relative
- `contentRelToUiFolder(rel)` - content-relative → `root/...`
- `sanitizeFolderName(name)` - strip illegal path chars
- `addStructureFolder(structure, folderRel)` / `removeStructureNode(structure, folderRel)` / `flattenFolderRels(structure)`
- `isUnderPath(parentRel, childRel)` - true if `childRel` is `parentRel` or lives under it
- `folderExists(structure, folderRel)` / `moveStructureNode(structure, fromRel, toRel)`

#### Основные методы:
- `async looksLikeContentRoot(handle)` - has `manifest.json` or `assets`/`maps`/`graphs` dir
- `async ensureDefaultContentLayout()` - create nested `content/` if pick is not already a content root; ensure default dirs + manifest; returns content dir handle or null
- `async scanContentTree()` - `{ structure, files: [{relPath, json}] }` or null
- `async createDirectory(folderRel)` / `async deletePath(relPath)` / `async moveFile(fromRel, toRel)` - `moveFile` copies Blob (PNG-safe) then deletes source
- `async moveDirectory(fromRel, toRel)` - native `handle.move` when available, else `_copyTree` + delete; refuses self/descendant
- `async readText(relPath)` / `async readBlob(relPath)`
- `async resolveImageSrc(jsonRel, assetData)` - FSA blob URL, else `./content/` fallback
- `async updateManifest(mutator)` - read-mutate-write `manifest.json`; returns manifest or false

### AssetPathRewriter (src/utils/AssetPathRewriter.js)
Remap content-relative paths after an asset/folder move (v4.54.0). Component `*AssetId` refs stay.

#### Основные методы:
- `static sortRemaps(remaps)` - drop no-ops; longest `from` first
- `static rewriteString(value, remaps)` - rewrite one string if it equals or is prefixed by old path (`''`, `./content/`, `content/`, `root/` forms)
- `static rewriteInPlace(obj, remaps)` - mutate path-like strings in an object graph; returns whether anything changed
- `static rewriteAll(editor, remaps)` - rewrite every catalog asset + the open level (+ other `levelsManager` sessions); returns dirty assets

### AssetFolderOps (src/ui/AssetFolderOps.js)
Create / move / delete asset folders and disk-backed assets (v4.52.0–v4.54.0). Owned by `AssetItemActionsController` as `assetPanel.folderOps`. No RMB **Move to Folder** (`buildMoveMenuItems` removed).

#### Основные методы:
- `async createFolder(parentUiPath?)` - prompt name; disk mkdir + structure when folder granted
- `async deleteFolder(uiPath)` - confirm; recursive assets + disk; cannot delete `root`
- `async deleteSelectedFolders()` - delete all selected non-root folders
- `async moveAsset(asset, targetUiPath)` - delegates to `moveAssets`
- `async moveAssets(assets, targetUiPath)` - move JSON + sibling PNG + manifest when folder granted; then `AssetPathRewriter.rewriteAll`; persist dirty assets with stable `id`
- `async moveAssetsByIds(ids, targetUiPath)` - resolve ids via AssetManager, then `moveAssets`
- `async moveFolder(sourceUiPath, targetUiPath)` - delegates to `moveFolders`
- `async moveFolders(sourceUiPaths, targetUiPath)` - move folder + contents; cannot move Content root; cannot drop into self/descendant
- `async deleteAssetWithDisk(asset)` - delete JSON + sibling PNG + manifest + memory

### FoldersContextMenu (src/ui/FoldersContextMenu.js)
RMB on the Assets Content tree (v4.52.0). Extends `BaseContextMenu`.

#### Menu items:
- **New Folder** - `onNewFolder(folderPath)`
- **Delete Folder** - `onDeleteFolder(folderPath)`; hidden when `folderPath === 'root'`

---

### BaseModule (src/core/BaseModule.js)
Базовый класс для всех модулей редактора.

#### Методы состояния группы:
- `isInGroupEditMode()` - проверка режима редактирования группы
- `getActiveGroup()` - получение активной группы
- `getGroupEditMode()` - получение состояния режима редактирования группы

#### Методы мыши:
- `isAltKeyPressed()` - проверка нажатия Alt
- `updateMouseState(e, worldPos)` - обновление состояния мыши
- `getMouseState()` - получение состояния мыши
- `getCameraState()` - получение состояния камеры
- `isLeftMouseDown()` - проверка нажатия левой кнопки мыши
- `isRightMouseDown()` - проверка нажатия правой кнопки мыши
- `isDragging()` - проверка перетаскивания
- `isMarqueeSelecting()` - проверка выделения рамкой

#### Методы выделения:
- `getSelectedObjects()` - получение выделенных объектов
- `clearSelection()` - очистка выделения
- `selectObjects(objectIds)` - выделение объектов по ID

---

### DuplicateOperations (src/core/DuplicateOperations.js)
Операции дублирования объектов. Общий flow используется Duplicate (Shift+D) и Paste (Ctrl+V): интерактивное размещение с ghost-превью, следующим за мышью до клика подтверждения.

#### Основные методы:
- `startFromSelection()` - начало дублирования из выделения (Shift+D)
- `startFromObjects(selected)` - начало интерактивного размещения произвольного набора объектов; используется `pasteObjects()` (Ctrl+V) и `startFromSelection()`. Объекты размещаются под текущей позицией курсора, если `mouse.isOverCanvas === true`; иначе fallback на центр канвы. Несколько объектов центрируются по union bounding-box (`anchorCenter` = центр объединённых мировых bounds) так, чтобы вся группа оказалась под курсором.
- `updatePreview(worldPos)` - обновление превью дублирования
- `confirmPlacement(worldPos)` - подтверждение размещения
- `cancel()` - отмена дублирования

### GroupOperations (src/core/GroupOperations.js)
Операции с группами.

#### Основные методы:
- `groupSelectedObjects()` - группировка выделенных объектов
- `openGroupEditMode(group)` - открытие режима редактирования группы
- `closeGroupEditMode()` - закрытие режима редактирования группы
- `ungroupSelectedObjects()` - разгруппировка выделенных объектов
- `removeEmptyGroup(targetGroup)` - удаление пустой группы
- `removeEmptyGroups()` - удаление всех пустых групп
- `extractObjectFromGroup(group, childObject)` - извлечение объекта из группы

### MouseHandlers (src/event-system/MouseHandlers.js)
Обработчики мыши.

#### Основные обработчики:
- `handleMouseDown(e)` - обработка нажатия мыши
- `handleMouseMove(e)` - обработка движения мыши
- `handleMouseUp(e)` - обработка отпускания мыши
- `handleGlobalMouseMove(e)` - глобальное движение мыши
- `handleGlobalMouseUp(e)` - глобальное отпускание мыши
- `handleWheel(e)` - обработка колесика мыши
- viewport drop: `type=level` → `levelFileOperations.openLevelFromAsset`; `type=eventGraph` → копирует `properties.graph` на `level.eventGraph` + `eventGraphAssetId`

#### Rotate/Scale жесты (Ctrl+drag / Ctrl+Alt+drag):
- `startObjectTransform(mode, clickInfo, startWorldPos)` - старт жеста, снапшот геометрии выделения
- `transformSelectedObjects(worldPos)` - пересчёт rotate/scale из снапшота на каждый mousemove
- `_snapshotChildrenForScale(group)` - рекурсивный снапшот геометрии детей группы
- `_applyChildScale(children, factor)` - применение масштаба к детям группы из снапшота

### ObjectOperations (src/core/ObjectOperations.js)
Операции с объектами.

#### Поиск и проверки:
- `findObjectAtPoint(x, y, skipCycle = false)` - поиск объекта в точке; по умолчанию циклически перебирает перекрывающиеся совпадения при повторных кликах в (примерно) той же точке (Blender-style, см. ARCHITECTURE.md → «Цикл выбора перекрывающихся объектов по кликам»); `skipCycle = true` (используется двойным кликом) форсирует старое поведение — всегда передний объект
- `_pickFrontMost(x, y, sortedCandidates)` - нецикличный front-to-back hit-test (внутренний, используется при `skipCycle = true`)
- `_pickWithClickCycle(x, y, sortedCandidates)` - цикличный pick по повторным кликам (внутренний, используется по умолчанию)
- `isPointInObject(x, y, obj)` - проверка точки в объекте
- `isObjectInGroup(obj, group)` - проверка объекта в группе
- `isObjectInGroupRecursive(obj, group)` - рекурсивная проверка объекта в группе
- `getSelectableCandidateObjects()` - список объектов-кандидатов на выбор для текущего режима (group edit mode / isolate / solo / обычный); общий источник для `computeSelectableSet()`, `findObjectAtPoint()` и marquee-выделения
- `findTopLevelAncestor(obj)` - поднимается через `groupOperations._findParentGroup()` до верхнеуровневого предка (или возвращает сам `obj`, если он уже top-level); общий хелпер для `toggleIsolateSelection()` и `toggleObjectSolo()`

#### Операции с объектами:
- `deleteSelectedObjects()` - удаление выделенных объектов
- `duplicateSelectedObjects()` - дублирование выделенных объектов
- `focusOnSelection()` - фокус на выделении (хоткей `F`)
- `focusOnAll()` - фокус на всех объектах (хоткей `A`)
- `jumpToCamera()` - toggle work ↔ game camera (хоткей `.` / click cam icon): if on game → work (unless selected is another camera); if on work → selected → `lastCameraObjectId` → main. Chrome icon via `setSource` → `refreshAllViewportChrome`. RMB on cam icon opens full source menu
- `cycleNextCamera()` / `cyclePrevCamera()` - C3, хоткеи `]` / `[`; цикл по `listGameCameraObjects`, bind focused viewport, select camera, update `lastCameraObjectId`
- `ViewportViewManager.getMainCameraObject()` / `setMainCamera(id, isMain)` — level default camera (`properties.isMain`, exclusive)
- `toggleObjectVisibility(obj)` - переключение `obj.visible`; каскадом применяется ко всем потомкам, если `obj.type === 'group'`
- `toggleVisibilityForSelection()` - хоткей `H`, переключает видимость всех выделенных объектов
- `unhideAllObjects()` - хоткей `Alt+H`, показывает все скрытые объекты на любом уровне вложенности
- `afterVisibilityChange()` - общий хвост (история, инвалидация кэшей, render, обновление панелей) для операций видимости выше
- `toggleIsolateSelection()` - хоткей `/`, тоггл Isolate для текущего выделения (top-level-гранулярность, non-destructive, состояние в `stateManager.get('view.isolatedTopLevelIds')`)
- `toggleObjectSolo(obj)` - Ctrl+click на иконку глаза объекта в Outliner; аналог Layer Solo, но full-hide вместо dim (top-level-гранулярность, non-destructive, эксклюзивный, состояние в `stateManager.get('view.soloedTopLevelObjectId')`)

### RenderOperations (src/core/RenderOperations.js)
Операции отрисовки.

#### Основные методы:
- `render()` - основная отрисовка
- `drawSelection()` - отрисовка выделения
- `drawGroupEditFrame()` - отрисовка рамки редактирования группы
- `getVisibleObjects(camera)` - получение видимых объектов
- `isObjectVisible(obj, left, top, right, bottom)` - проверка видимости объекта

---

### Level (src/models/Level.js)
Модель уровня с поддержкой системы слоев.

#### Основные методы:
- `constructor(data)` - создание уровня
- `addObject(obj)` - добавление объекта
- `removeObject(objId)` - удаление объекта
- `findObjectById(id)` - поиск объекта по ID
- `getAllObjects()` - получение всех объектов
- `getStats()` - получение статистики уровня
- `compareStackOrder(a, b)` - сравнение Z-порядка объектов (сначала по слою, затем по позиции в иерархии)

#### Свойства settings:
- `gridSize` (number) - размер сетки (по умолчанию 32)
- `snapToGrid` (boolean) - привязка к сетке (по умолчанию true)
- `showGrid` (boolean) - отображение сетки (по умолчанию true)
- `backgroundColor` (string) - цвет фона уровня в hex (по умолчанию '#4B5563')
- `parallaxHorizontal` (number) - множитель параллакса по горизонтали (по умолчанию 1, масштабирует смещение камеры, применяется поверх per-layer parallaxOffset)
- `parallaxVertical` (number) - множитель параллакса по вертикали (по умолчанию 1, применяется независимо по оси Y)

### GameObject (src/models/GameObject.js)
Базовый класс игрового объекта.

#### Основные методы:
- `constructor(data)` - создание объекта
- `generateId()` - генерация ID
- `getBounds()` - получение границ объекта (rotation-aware AABB через `WorldPositionUtils.getRotatedRectAABB`)
- `containsPoint(x, y)` - проверка точки в объекте (inverse-rotate hit-test при `rotation !== 0`)
- `clone()` - клонирование объекта
- `toJSON()` - сериализация в JSON

#### Свойства:
- `rotation` - угол поворота в градусах, по часовой стрелке, вокруг центра объекта (default `0`)

### Group (src/models/Group.js)
Модель группы объектов.

#### Основные методы:
- `constructor(data)` - создание группы
- `addChild(child)` - добавление дочернего объекта
- `removeChild(childId)` - удаление дочернего объекта
- `getAllChildren()` - получение всех дочерних объектов
- `getBounds()` - получение границ группы (объединение rotation-aware bounds детей + консервативный AABB собственного `rotation` группы)
- `clone()` - клонирование группы

### Layer (src/models/Layer.js)
Модель слоя уровня.

#### Основные методы:
- `constructor(data)` - создание слоя
- `toggleVisibility()` - переключение видимости
- `toggleLock()` - переключение блокировки
- `setName(name)` - установка имени
- `setOrder(order)` - установка порядка
- `toJSON()` - сериализация в JSON

#### Свойства:
- `soloed` - transient UI-флаг (не сериализуется в `toJSON()`); `true`, если слой заsoloен через Ctrl+click иконки глаза в `LayersPanel.toggleLayerSolo(layerId)` — см. ARCHITECTURE.md → «Isolate и Layer Solo»

### ShortcutFormatter (src/utils/ShortcutFormatter.js)
Форматирование хоткея в отображаемую строку. Единый источник форматирования для `SettingsPanel` (Hotkeys tab) и `MenuManager` (подписи в главном меню).

#### Основные методы:
- `static format(shortcut)` - форматирует `{key, ctrlKey, altKey, shiftKey, metaKey}` в строку вида `"Ctrl+Alt+N"`

---

### UIFactory (src/utils/UIFactory.js)
Фабрика UI элементов.

#### Основные методы:
- `createLabeledInput(options)` - создание поля ввода с меткой
- `createInput(options)` - создание поля ввода
- `createButton(options)` - создание кнопки
- `createPropertyEditor(obj, properties, onPropertyChange)` - создание редактора свойств
- `createTab(options)` - создание вкладки
- `createPanel(options)` - создание панели

### Logger (src/utils/Logger.js)
Централизованная система логирования.

#### Основные методы:
- `static log(category, level, message, ...args)` - основное логирование
- `static time(label)` - начало измерения времени
- `static timeEnd(label)` - окончание измерения времени
- `static setLevel(level)` - установка уровня логирования
- `static setCategoryEnabled(category, enabled)` - включение/отключение категории

---

## 📁 Система манифеста и динамических фолдеров

### Update Manifest (update_manifest.py)
Автоматическое обновление манифеста ассетов на основе структуры папок.

#### Функциональность:
- **Рекурсивное сканирование**: поиск всех JSON файлов в папке `content/`
- **Построение структуры**: создание иерархической структуры папок
- **Включение пустых папок**: добавление папок без файлов в структуру
- **Кеш-бастинг**: обновление манифеста с временными метками
- **Валидация**: проверка корректности JSON файлов

#### Использование:
```bash
# Обновление манифеста
python update_manifest.py

# Или через batch файл
./update_manifest.bat
```

#### Структура манифеста:
```json
{
  "version": "1.0.0",
  "generated": "2024-01-15",
  "structure": {
    "assets": {
      "characters": {
        "player": {},
        "enemies": {}
      },
      "platforms": {
        "blocks": {},
        "ground": {}
      }
    },
    "maps": {},
    "graphs": {}
  },
  "files": [
    "assets/characters/player/player.json",
    "assets/platforms/blocks/block.json"
  ]
}
```

### Динамическое создание фолдеров
Система автоматически создает папки для ассетов, не входящих в манифест.

#### Процесс:
1. **Загрузка манифеста**: AssetManager загружает структуру из `manifest.json`
2. **Построение базовой структуры**: FoldersPanel создает папки из манифеста
3. **Добавление ассетов**: система добавляет ассеты в существующие папки
4. **Создание недостающих папок**: автоматическое создание папок для новых ассетов
5. **Синхронизация**: обновление структуры при изменении ассетов

#### Особенности:
- **Двухэтапное построение**: сначала манифест, затем ассеты
- **Сохранение пустых папок**: папки из манифеста остаются даже без ассетов
- **Автоматическое обновление**: структура обновляется при изменении файлов
- **Нормализация путей**: унификация путей с префиксом `root/`

## 📝 Заключение

Этот справочник содержит все доступные методы и функции Level Editor. Используйте его для:

1. **Понимания существующего API** - перед добавлением новой функциональности
2. **Избежания дублирования** - проверки, не существует ли уже нужный метод
3. **Планирования архитектуры** - понимания структуры и связей между компонентами
4. **Отладки** - поиска нужных методов для решения проблем

Для получения подробной информации о параметрах и возвращаемых значениях обращайтесь к исходному коду соответствующих файлов.

**📚 Связанные документы:**
- [ARCHITECTURE.md](./ARCHITECTURE.md) - архитектура системы
- [Development Guide](./DEVELOPMENT_GUIDE.md) - примеры использования
- [COMMON_MISTAKES.md](./COMMON_MISTAKES.md) - частые ошибки
