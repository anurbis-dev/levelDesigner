# Каталог типов ассетов и компонентов

Статус: реализовано как каталог типов + placeholder-создание. Runtime-поведение (коллизии, AI, диалоги и т.д.) не реализуется редактором — это ответственность игры, потребляющей экспортированный JSON уровня.

## Архитектурная развилка

Две независимые сущности, которые специально не смешаны в одну модель типов:

1. **Asset-типы** (`src/constants/AssetTypes.js`) — контент/ресурсы: то, что создаётся как файл-ассет (картинка, атлас, уровень, диалог, префаб).
2. **Component-типы** (`src/constants/ComponentTypes.js`) — поведение, навешиваемое на `Actor`/`GameObject` через `components[]` (коллизия, триггер, интерактивность и т.д.), редактируется в asset-editor float (`assetComponents` / `assetComponentDetails`).

`Actor` — универсальный контейнер; специализированные сущности (Door, Chest, NPC, Vehicle) не стали отдельными asset-типами — предполагается собирать их как `Prefab` (Actor + набор компонентов).

## Как это работает в редакторе

- `getAssetCategoriesWithTypes()` группирует `ASSET_TYPES` по категории — используется и в top-level "Add" меню навигации (`config/menu.js` → `buildAssetsMenu()`), и в контекстном меню панели ассетов (`AssetPanelContextMenu.js`).
- `AssetManager.createPlaceholderAsset(typeId, customName?, folderPath?)` создаёт ассет-заглушку: без `imgSrc`, с цветом из `typeDef.color` (если задан) или категории, путь по умолчанию — `<Категория>/<Имя>.json`, либо в выбранной папке. Размеры используют `typeDef.width`/`typeDef.height` (если заданы) или дефолтные 48×48. Если для типа определены default-компоненты в `DEFAULT_ASSET_COMPONENTS[typeId]`, они автоматически создаются и прикрепляются к ассету (см. примечание ниже).
- `DEFAULT_ASSET_COMPONENTS` — карта `typeId -> [componentTypeId, ...]`: `player_start → playerStart`, `actor`/`prefab → sprite`. **Image** не получает Sprite: файл/data URL живёт в `asset.imgSrc`. Sprite на actor/prefab ссылается на Image через `properties.imageAssetId`.
- `buildTypeIconSvg(typeId, color, size)` (`AssetTypeIcons.js`) — минималистичная SVG-иконка по типу; используется в двух местах:
  - В гриде/списке ассетов (AssetPanel): подставляется вместо color-swatch + первой буквы, если `asset.type` совпадает с ID из каталога.
  - На canvas (CanvasRenderer): при размещении GameObject без загруженного изображения, иконка рисуется поверх fallback-прямоугольника (50% от меньшего измерения объекта, центрирована). Обеспечивает визуальное узнавание placeholder-объектов на canvas, не только в панели.
- `createComponentStub(typeId)` создаёт стаб компонента (`{id, type, enabled, properties:{}}`), добавляется в `asset.components[]` через `AssetComponentsPanel` и сохраняется в `toJSON()`.
- **Важно**: и asset-типы, и component-типы на данном этапе — только каталог метаданных + UI создания/иконка. Реальная логика (автотайлинг Tileset, воспроизведение Dialogue Graph, физика Collider и т.п.) не реализована — это зона ответственности игрового рантайма, потребляющего экспортированный уровень.

## 1. Core (7)

| ID | Label | Комментарий |
|---|---|---|
| `camera` | Camera | follow-target, deadzone, `followLerp` (0=snap, 0.0015=smooth), `lookAhead`, `viewHeight`, bounds, слои рендера |
| `actor` | Actor Placeholder | универсальный контейнер: визуал + коллизии + триггеры + анимация; `sprite.imageAssetId` → Image |
| `image` | Image | сырой растровый ресурс (`imgSrc` на диске); sidecar PNG рядом с JSON |
| `level` | Level | документ уровня. Drop → `openLevelFromAsset`: карта только из `properties.levelSrc` (FSA затем `./content/`); placeholder без levelSrc → пустой уровень (`createNewLevel`). Catalog `path` — не URL карты. Dblclick — Asset Editor. Scan: map JSON (`objects`+`layers`+`settings`) → `type=level`. |
| `imageAtlas` | Image Atlas | авто-упаковка картинок / источник sprite sheet |
| `volume` | Volume | зона-триггер произвольной формы + визуальные эффекты |
| `player_start` | Player Start | маркер спавна (auto-managed: ровно один на уровень). Компонент `playerStart`: `movementMode` `topdown`\|`platformer`, `bodyWidth`/`bodyHeight` (stand capsule), `crouchHeight` (дефолт 14), `proneHeight` (дефолт 7), опц. `crouchWidth`/`proneWidth`, `speed`, `platformer` JSON. Runtime — `docs/RUNTIME_SCHEMA.md`. |

## 2. Visual / Render (8)

`spriteAnimationClip`, `tileset`, `tilemap`, `nineSliceSprite`, `fontTextStyle`, `particleEffect`, `materialShaderPreset`, `light` — см. описания в `AssetTypes.js`.

## 3. Audio (3)

`soundEffect`, `musicTrack`, `audioZone` (специализация `Volume`).

## 4. Data / System (8)

`eventGraph` (reusable graph: drop на viewport применяет `properties.graph` к текущему уровню и пишет `Level.eventGraphAssetId`; dblclick — Asset Editor; не путать с dock contentType `eventGraph` — это редактор графа уровня), `dialogueGraph`, `questObjective`, `itemDefinition`, `inventorySchema`, `localizationTable`, `saveSchema`, `inputMap`.

## 5. Navigation / AI (3)

`pathSpline`, `navMesh`, `aiBehaviorPreset`.

## 6. Other (2)

`prefab` (Actor Template), `sequenceCutscene` (Cutscene Timeline).

**Итого: 31 asset-тип** в 6 категориях (`ASSET_CATEGORIES`: core, visual, audio, data, navigation, other).

## 7. Component-типы (30)

Навешиваются на Actor: исходные 19 (`collider` … `variableModifier`) плюс `sprite`, `camera`, `audioZone`, `tilemap`, `particleEffect`, `light`, `nineSliceSprite`, `fontTextStyle`, `volume`, `navMesh`, `sequenceCutscene`. `sprite` в Play — no-op `Behavior` (`registerDefaultBehaviors`), чтобы не варнить. Полные описания — `ComponentTypes.js`. Runtime-поля (в т.ч. LEDGE: `playerStart` stance heights, `tilemap.tileKinds`/`tilesetAssetId`+`imageAssetId`, `pickup.mode`, portal fade/item, `pathFollower` elevator, `camera.followLerp`/`lookAhead`) — `docs/RUNTIME_SCHEMA.md`. Каталог LEDGE: `content/assets/ledge/` + уровень `content/maps/ledge.json`.

## Отличия итоговой реализации от исходного плана (tmp/game-editor-asset-types.md)

- План описывал 29 потенциальных asset-типов и исключал Level из creatable catalog; v4.53.0 добавил `level` (core) и `eventGraph` (data) — сейчас 31 id в `ASSET_TYPES`.
- Приоритетные "уровни внедрения" (1/2/3) из плана в код не перенесены как отдельные метаданные — каталог не различает приоритет типа программно, все типы равноправны и доступны для создания сразу.
- Asset Editor рисует поля из `ComponentPropertySchema.js`. Runtime-поведение — `src/engine/` / `docs/RUNTIME_SCHEMA.md`, не редактор.

## Связанные файлы

- `src/constants/AssetTypes.js` — каталог asset-типов и категорий.
- `src/constants/ComponentTypes.js` — каталог component-типов.
- `src/constants/AssetTypeIcons.js` — SVG-иконки по типу.
- `src/managers/AssetManager.js` — `createPlaceholderAsset()`; `ingestAssetJson` → `resolveCatalogAssetType`.
- `src/utils/LevelAssetUtils.js` — `isLevelDocument` / `resolveCatalogAssetType` / `resolveLevelSrc` / `resolveMapSrc` / `pickLevelOpenPayload` / `resolveLevelFileName` / `contentUrl`.
- `src/core/LevelFileOperations.js` — `openLevelFromAsset`.
- `src/ui/asset-editor/AssetComponentsPanel.js` — список Components; `AssetComponentDetailsPanel.js` — stub details.
- `src/ui/AssetPanelContextMenu.js`, `config/menu.js` (`buildAssetsMenu()`) — точки создания ассета по типу.
- `docs/RUNTIME_SCHEMA.md` — runtime-контракт properties.
- `docs/LEDGE_PORT_PLAN.md` — порт платформера LEDGE.
