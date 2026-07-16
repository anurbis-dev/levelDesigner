# Runtime Schema

Контракт для будущего игрового движка (`tmp/2D_Editor_ENGINE_PLAN.md`, Фаза 0): для каждого
asset-типа (`src/constants/AssetTypes.js`) и component-типа (`src/constants/ComponentTypes.js`)
фиксирует, какие поля в `properties`/`components[].properties` движок обязан читать, какие из
них обязательны, и какая версия схемы у этого конкретного типа.

Каталог типов (id/label/category/description) уже документирован в `docs/ASSET_TYPES_CATALOG.md`
и `src/constants/{AssetTypes,ComponentTypes}.js` — этот файл их не дублирует, а добавляет
runtime-контракт (`properties`) поверх уже существующего каталога.

**Процесс:** секция типа переходит из "not implemented" в конкретный список полей в том же
коммите, где движок реально реализует behavior/рендер для этого типа (Фаза 2/3 плана движка).
Не заполняется заранее вслепую — заполнение по мере реализации, не разовая работа на все типы.

## Versioning

Две независимые оси версий — не путать:

| | `LevelEditor.VERSION` | `Level.meta.version` |
|---|---|---|
| Что версионирует | сам редактор (приложение) | формат level-файла (эта схема) |
| Источник истины | `src/core/LevelEditor.js`, см. `docs/VERSIONING_GUIDE.md` | `src/models/Level.js` (`meta.version`) |
| Кто читает | пользователь/консоль/header | движок при загрузке уровня (Фаза 1 плана) |

`Level.meta.version` — semver формата уровня, дефолт `'1.0.0'` (до Фазы 0 был неиспользуемый
дефолт `'dynamic'`, ничего не версионировавший). Политика бампа:

- **major** — breaking-изменение формы `objects[]`/`layers[]`/`components[]` (переименование
  поля, смена типа значения, удаление обязательного поля) — старый загрузчик не сможет прочитать.
- **minor** — новое опциональное поле, обратно совместимое (старый загрузчик читает файл, просто
  не видит новое поле).
- **patch** — изменение без изменения данных (правки типов/дефолтов в этом документе,
  документация).

**Контракт загрузчика движка (реализуется в Фазе 1, политика фиксируется здесь заранее):**
неизвестный или несовместимый major → явная ошибка загрузки с понятным сообщением, никогда
молчаливое падение на `undefined.foo`.

## Asset Types

Источник: `ASSET_TYPES` в `src/constants/AssetTypes.js`, 29 id, 6 категорий. Все — `not
implemented`, `properties: {}` (пустой стаб, что уже сериализуется сегодня); `schemaVersion: 1`
для всех до первой реальной реализации.

### Core

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `camera` | Camera | 1 | not implemented | TBD (Фаза 1.2 — FOV/zoom, follow-target, bounds, render layers) |
| `actor` | Actor Placeholder | 1 | not implemented | TBD |
| `image` | Image | 1 | not implemented | TBD |
| `imageAtlas` | Image Atlas | 1 | not implemented | TBD |
| `volume` | Volume | 1 | not implemented | TBD |
| `player_start` | Player Start | 1 | not implemented | TBD (см. `playerStart` component ниже — уже auto-attached, см. `DEFAULT_ASSET_COMPONENTS`) |

### Visual / Render

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `spriteAnimationClip` | Sprite Animation Clip | 1 | not implemented | TBD |
| `tileset` | Tileset | 1 | not implemented | TBD |
| `tilemap` | Tilemap | 1 | not implemented | TBD |
| `nineSliceSprite` | Nine-Slice Sprite | 1 | not implemented | TBD |
| `fontTextStyle` | Font / Text Style | 1 | not implemented | TBD |
| `particleEffect` | Particle Effect | 1 | not implemented | TBD |
| `materialShaderPreset` | Material / Shader Preset | 1 | not implemented | TBD |
| `light` | Light | 1 | not implemented | TBD |

### Audio

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `soundEffect` | Sound Effect (SFX) | 1 | not implemented | TBD |
| `musicTrack` | Music Track | 1 | not implemented | TBD |
| `audioZone` | Audio Zone | 1 | not implemented | TBD |

### Data / System

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `dialogueGraph` | Dialogue Graph | 1 | not implemented | TBD |
| `questObjective` | Quest / Objective | 1 | not implemented | TBD |
| `itemDefinition` | Item Definition | 1 | not implemented | TBD |
| `inventorySchema` | Inventory Schema | 1 | not implemented | TBD |
| `localizationTable` | Localization Table | 1 | not implemented | TBD |
| `saveSchema` | Save Schema / Game State | 1 | not implemented | TBD |
| `inputMap` | Input Map | 1 | not implemented | TBD |

### Navigation / AI

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `pathSpline` | Path / Spline | 1 | not implemented | TBD |
| `navMesh` | NavMesh / Walkable Area | 1 | not implemented | TBD |
| `aiBehaviorPreset` | AI Behavior Preset | 1 | not implemented | TBD |

### Other

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `prefab` | Prefab / Actor Template | 1 | not implemented | TBD |
| `sequenceCutscene` | Sequence / Cutscene Timeline | 1 | not implemented | TBD |

## Component Types

Источник: `COMPONENT_TYPES` в `src/constants/ComponentTypes.js`, 19 id. Все — `not
implemented`, `properties: {}`, `schemaVersion: 1`. `BehaviorRegistry` (движок, Фаза 2) резолвит
по `component.type`; незнакомый/нереализованный тип — warning в консоль, не крах загрузки уровня.

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `collider` | Collider | 1 | implemented | `offsetX`/`offsetY`/`width`/`height` (все опциональные, дефолт — сам bounding box entity); AABB-прямоугольник, `shape` пока не читается (только rect) |
| `trigger` | Trigger | 1 | implemented | те же поля, что `collider` (использует ту же `getEntityBounds`); enter/exit трекается против любого поведения с `getBounds()`, не только `collider` |
| `interactable` | Interactable | 1 | implemented | `radius` (опционально, дефолт `32`), `hint` (опционально, дефолт `'Interact'`) |
| `playerStart` | Player Start | 1 | implemented | нет собственных полей — позиция берётся из `entity.x/y` (используется `Scene.spawnPlayer()` для создания управляемого игрока при запуске уровня; сама маркер-сущность скрывается, не отображается в игре) |
| `transformAnimation` | Transform Animation | 1 | not implemented | TBD |
| `spriteUiAnimation` | Sprite / UI Animation | 1 | not implemented | TBD |
| `pickup` | Pickup | 1 | not implemented | TBD |
| `dialogueTrigger` | Dialogue Trigger | 1 | not implemented | TBD |
| `damageHealth` | Damage / Health | 1 | not implemented | TBD |
| `movablePushable` | Movable / Pushable | 1 | not implemented | TBD |
| `mountableVehicleSeat` | Mountable / Vehicle Seat | 1 | not implemented | TBD |
| `pathFollower` | Path Follower | 1 | not implemented | TBD |
| `spawner` | Spawner | 1 | not implemented | TBD |
| `stateMachineBehavior` | State Machine / Behavior | 1 | not implemented | TBD |
| `checkpointSavePoint` | Checkpoint / Save Point | 1 | not implemented | TBD |
| `climbableLadder` | Climbable / Ladder | 1 | not implemented | TBD |
| `conveyorZiplineJumpPadPortal` | Conveyor / Zipline / Jump Pad / Portal | 1 | not implemented | TBD |
| `destructibleContainer` | Destructible Container | 1 | not implemented | TBD |
| `variableModifier` | Variable Modifier | 1 | not implemented | TBD |

Первые 4 (`collider`/`trigger`/`interactable`/`playerStart`) реализованы как вертикальный срез
Фазы 2 плана движка (`tmp/2D_Editor_ENGINE_PLAN.md` §2.2, `src/engine/behaviors/*`), остальные
15 — бэклог, реализуются по мере реальной потребности конкретной игры, не заранее.
