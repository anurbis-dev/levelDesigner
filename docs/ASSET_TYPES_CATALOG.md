# Каталог типов ассетов и компонентов

Статус: реализовано как каталог типов + placeholder-создание. Runtime-поведение (коллизии, AI, диалоги и т.д.) не реализуется редактором — это ответственность игры, потребляющей экспортированный JSON уровня.

## Архитектурная развилка

Две независимые сущности, которые специально не смешаны в одну модель типов:

1. **Asset-типы** (`src/constants/AssetTypes.js`) — контент/ресурсы: то, что создаётся как файл-ассет (картинка, атлас, уровень, диалог, префаб).
2. **Component-типы** (`src/constants/ComponentTypes.js`) — поведение, навешиваемое на `Actor`/`GameObject` через `components[]` (коллизия, триггер, интерактивность и т.д.), редактируется в секции "Components" `ActorPropertiesWindow`.

`Actor` — универсальный контейнер; специализированные сущности (Door, Chest, NPC, Vehicle) не стали отдельными asset-типами — предполагается собирать их как `Prefab` (Actor + набор компонентов).

## Как это работает в редакторе

- `getAssetCategoriesWithTypes()` группирует `ASSET_TYPES` по категории — используется и в top-level "Add" меню навигации (`config/menu.js` → `buildAssetsMenu()`), и в контекстном меню панели ассетов (`AssetPanelContextMenu.js`).
- `AssetManager.createPlaceholderAsset(typeId, customName?, folderPath?)` создаёт ассет-заглушку: без `imgSrc`, с цветом категории, путь по умолчанию — `<Категория>/<Имя>.json`, либо в выбранной папке.
- `buildTypeIconSvg(typeId, color, size)` (`AssetTypeIcons.js`) — минималистичная SVG-иконка по типу; в гриде/списке ассетов подставляется вместо color-swatch + первой буквы, если `asset.type` совпадает с ID из каталога.
- `createComponentStub(typeId)` создаёт стаб компонента (`{id, type, enabled, properties:{}}`), добавляется в `actor.components[]` через UI `ActorPropertiesWindow.renderComponentsSection()` и сохраняется в `toJSON()`.
- **Важно**: и asset-типы, и component-типы на данном этапе — только каталог метаданных + UI создания/иконка. Реальная логика (автотайлинг Tileset, воспроизведение Dialogue Graph, физика Collider и т.п.) не реализована — это зона ответственности игрового рантайма, потребляющего экспортированный уровень.

## 1. Core (5)

| ID | Label | Комментарий |
|---|---|---|
| `camera` | Camera | параметры без визуала (FOV/zoom, follow-target, границы, слои рендера) |
| `actor` | Actor Placeholder | универсальный контейнер: визуал + коллизии + триггеры + анимация |
| `image` | Image | сырой растровый ресурс |
| `imageAtlas` | Image Atlas | авто-упаковка картинок / источник sprite sheet |
| `volume` | Volume | зона-триггер произвольной формы + визуальные эффекты |

## 2. Visual / Render (8)

`spriteAnimationClip`, `tileset`, `tilemap`, `nineSliceSprite`, `fontTextStyle`, `particleEffect`, `materialShaderPreset`, `light` — см. описания в `AssetTypes.js`.

## 3. Audio (3)

`soundEffect`, `musicTrack`, `audioZone` (специализация `Volume`).

## 4. Data / System (7)

`dialogueGraph`, `questObjective`, `itemDefinition`, `inventorySchema`, `localizationTable`, `saveSchema`, `inputMap`.

## 5. Navigation / AI (3)

`pathSpline`, `navMesh`, `aiBehaviorPreset`.

## 6. Other (2)

`prefab` (Actor Template), `sequenceCutscene` (Cutscene Timeline).

**Итого: 28 asset-типов** в 6 категориях (`ASSET_CATEGORIES`: core, visual, audio, data, navigation, other).

## 7. Component-типы (19)

Навешиваются на Actor вместо создания отдельного asset-типа: `collider`, `trigger`, `transformAnimation`, `spriteUiAnimation`, `interactable`, `pickup`, `dialogueTrigger`, `damageHealth`, `movablePushable`, `mountableVehicleSeat`, `pathFollower`, `spawner`, `stateMachineBehavior`, `playerStart`, `checkpointSavePoint`, `climbableLadder`, `conveyorZiplineJumpPadPortal`, `destructibleContainer`, `variableModifier`. Полные описания и жанровая привязка — в `ComponentTypes.js`.

## Отличия итоговой реализации от исходного плана (tmp/game-editor-asset-types.md)

- План описывал 29 потенциальных asset-типов (Уровень 1-3 + уже определённые); в `ASSET_TYPES` попали 28 — структура категорий и состав типов перенесены практически 1:1.
- Приоритетные "уровни внедрения" (1/2/3) из плана в код не перенесены как отдельные метаданные — каталог не различает приоритет типа программно, все типы равноправны и доступны для создания сразу.
- Все типы обеих таблиц (asset и component) реализованы только как каталог + placeholder/stub — ни один не имеет специфичного редакторского UI сверх общего (кроме `actor.components[]`, который получил отдельную секцию в `ActorPropertiesWindow`).

## Связанные файлы

- `src/constants/AssetTypes.js` — каталог asset-типов и категорий.
- `src/constants/ComponentTypes.js` — каталог component-типов.
- `src/constants/AssetTypeIcons.js` — SVG-иконки по типу.
- `src/managers/AssetManager.js` — `createPlaceholderAsset()`.
- `src/ui/ActorPropertiesWindow.js` — секция "Components".
- `src/ui/AssetPanelContextMenu.js`, `config/menu.js` (`buildAssetsMenu()`) — точки создания ассета по типу.
