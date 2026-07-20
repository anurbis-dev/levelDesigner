# Runtime Schema

Контракт для будущего игрового движка (`tmp/2D_Editor_ENGINE_PLAN.md`, Фаза 0): для каждого
asset-типа (`src/constants/AssetTypes.js`) и component-типа (`src/constants/ComponentTypes.js`)
фиксирует, какие поля в `properties`/`components[].properties` движок обязан читать, какие из
них обязательны, и какая версия схемы у этого конкретного типа.

Каталог типов (id/label/category/description) уже документирован в `docs/ASSET_TYPES_CATALOG.md`
и `src/constants/{AssetTypes,ComponentTypes}.js` — этот файл их не дублирует, а добавляет
runtime-контракт (`properties`) поверх уже существующего каталога.

**Примечание:** уровень-широкие данные (например, `eventGraph` из Фаза D LOGIC_SYSTEMS_PLAN и `dialogues` из Фаза E LOGIC_SYSTEMS_PLAN) не являются
component- или asset-типами и поэтому не документируются в таблицах per-type ниже. Они хранятся в
корневых полях JSON-уровня:

| Поле | Назначение |
|------|------------|
| `levelData.eventGraph` | Event Graph JSON |
| `levelData.dialogues` | Dialogue Graph[] by id |
| `levelData.items` | Item definitions `[{id, displayName, description?}]` (Items dock) |
| `levelData.inventory` | Player bag seed `[{itemId,count}]` for Play |
| `levelData.npcInventories` | NPC bags `{ [objectId]: [{itemId,count}] }` |

### Dialogue graph (level.dialogues[])

| Поле | Назначение |
|------|------------|
| `participants[]` | Multi-NPC: `{id, role:player\|npc, displayName?, objectId?}` |
| `nodes[].speakerId` | Кто говорит (ref participant); `speaker` — fallback label |
| `nodes[].effects[]` | On enter: `{type:giveItem\|takeItem, itemId, count?, to?, from?}` — bag refs: `player` / objectId / participantId |
| `nodes[].choices[]` | **Ответы игрока**: `text`, `next`, optional `condition`, `requireItem`, `itemPick`, `effects` |
| `choice.requireItem` | Скрыть ответ без предмета `{itemId, count?, bag?}` (default player) |
| `choice.itemPick` | Игрок выбирает itemId (`advance(i, {selectedItemId})`); remove player → optional `to` bag (default speaker object) |
| `choice.effects` | After select: give/take with bag `to`/`from` |

Play HUD (`DialoguePlayHud`): choices buttons + item picker while `scene.dialogueActive`.

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
| `camera` | Camera | 1 | implemented | see `camera` component below — asset placement auto-attaches it (`DEFAULT_ASSET_COMPONENTS`), width/height/color mirror `player_start`'s marker look |
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
| `soundEffect` | Sound Effect (SFX) | 1 | partial (Tier 1: PlaySound action wired) | Event Graph action `PlaySound` (params: `src`, `volume?`, `loop?`) fires browser `Audio` one-shot playback, fire-and-forget no-op if `Audio` global unavailable; asset catalog/editor form/AssetLoader wiring not yet implemented (Tier 2+). |
| `musicTrack` | Music Track | 1 | not implemented | TBD |
| `audioZone` | Audio Zone | 1 | not implemented | TBD |

### Data / System

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `dialogueGraph` | Dialogue Graph | 1 | not implemented | TBD |
| `questObjective` | Quest / Objective | 1 | not implemented | TBD |
| `itemDefinition` | Item Definition | 1 | level-scope alternative | Prefer `level.items[]` catalog (Items dock). Asset-type stub remains for future catalog assets. |
| `inventorySchema` | Inventory Schema | 1 | not implemented | TBD — runtime bags are free-form itemId→count (`Inventory.js`) |
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

Источник: `COMPONENT_TYPES` в `src/constants/ComponentTypes.js`, 19 id. Статус по каждому — в
таблице ниже (implemented/not implemented). `BehaviorRegistry` (движок, Фаза 2) резолвит
по `component.type`; незнакомый/нереализованный тип — warning в консоль, не крах загрузки уровня.

| id | label | schemaVersion | status | fields |
|---|---|---|---|---|
| `sprite` | Sprite | 2 | editor+placement | `imageAssetId` (string, id of a catalog **Image** asset). Does **not** store a disk path — only Image assets hold `imgSrc`/file. At place-time editor resolves Image → URL into `entity.imgSrc` for the engine. Static display only (animation frames stay on `spriteUiAnimation`). |
| `collider` | Collider | 3 | implemented | `shape` (`box`\|`circle`\|`freeform`, default `box`); `color` (optional `#RGB`/`#RRGGBB` stroke in editor; empty = palette); box: `offsetX`/`offsetY`/`width`/`height` (опц., дефолт — entity box); circle: `offsetX`/`offsetY` = center, `radius` (или inscribed in box fields); freeform: `points` `[{x,y},…]` asset-local; `layer` + `collidesWith` (пусто = all). Runtime collision = AABB of shape. Editor Preview: stroke frames only — never crops sprite; freeform has Add/Move/Delete vertex tools. |
| `trigger` | Trigger | 3 | implemented | те же shape/color/geometry поля, что `collider` (та же `getEntityBounds`); enter/exit vs любой behavior с `getBounds()`, фильтр `collidesWith` |
| `interactable` | Interactable | 1 | implemented | `radius` (опционально, дефолт `32`), `hint` (опционально, дефолт `'Interact'`) |
| `playerStart` | Player Start | 1 | implemented | нет собственных полей — позиция берётся из `entity.x/y` (используется `Scene.spawnPlayer()` для создания управляемого игрока при запуске уровня; сама маркер-сущность скрывается, не отображается в игре) |
| `camera` | Camera | 1 | implemented | `followTargetId` (опц., string entity id; пусто = `scene.player`), `deadzoneWidth`/`deadzoneHeight` (опц., px; `0` = жёсткий центр каждый кадр), `bounds` (опц. JSON `{x,y,width,height}`; без него — без клампа), `renderLayers` (опц., список layer id через запятую; пусто = рендерятся все слои, та же `collidesWith: []`-конвенция Фазы A). Маркер скрывается `Scene.hideCameraMarker()` при загрузке, как `playerStart`; `GameEngine._updateCamera()` делегирует `CameraBehavior.computeCamera()`, без маркера — legacy hard-center на игроке без ограничения слоёв (`cameraRenderLayers = null`) |
| `transformAnimation` | Transform Animation | 1 | not implemented | TBD |
| `spriteUiAnimation` | Sprite / UI Animation | 1 | implemented | `frames` — массив `{x,y,w,h,duration}` (source-rect в атласе, взятом из `entity.imgSrc`; `duration` в мс), `loop` (опционально, дефолт `true`; `false` — держит последний кадр вместо рестарта). **Фаза F state machine:** `states` (array `{name, clip, transitions: [{condition:{var,op,value}, target}]}`), `clips` (named `{clipName: frames[]}` catalog заменяет flat `frames` в режиме state machine), `defaultState` (initial state name) — каждый tick проверяет переходы (первый matching `condition` wins) против `scene.eventGraphRuntime` variables; `play(clipName)` метод Event Graph `PlayAnimation` действия. Без `states` — полная обратная совместимость с Фазой B |
| `pickup` | Pickup | 1 | implemented | `itemId` (string, id из `level.items[]`), `count` (опционально, дефолт `1`), `destroyOnPickup` (опционально, дефолт `true`). Самодостаточное поведение (не data-holder, в отличие от `dialogueTrigger`): каждый тик AABB-проверка пересечения с `scene.player`, при пересечении — `scene.inventory.add(itemId, count)` и `scene.destroyEntity()` (если `destroyOnPickup`). Без формы shape/collider — прямоугольник по entity box. |
| `dialogueTrigger` | Dialogue Trigger | 1 | implemented | `dialogueId` (string, опционально), `layer` (string, опционально) — component-маркер сущности, инициирующей диалоги; фактический dialogueId берётся из Event Graph действия `StartDialogue` (action params), не из этого компонента |
| `damageHealth` | Damage / Health | 1 | implemented | `maxHealth` (число, дефолт 100), `currentHealth` (число, дефолт = maxHealth), `contactDamage` (число, дефолт 0 — урон наносимый другим при столкновении), `invulnerabilityDuration` (сек, дефолт 0.5), `destroyOnDeath` (дефолт true), `layer` (слой), `collidesWith` (список слоёв, разделённых запятой). Самодостаточное поведение: каждый тик AABB-проверка пересечения с другими сущностями, имеющими damageHealth компонент; при пересечении с источником `contactDamage>0` применяется урон один раз, затем удары игнорируются на `invulnerabilityDuration` сек. Один тип компонента для обеих сторон контакта — источник урона (враг/ловушка) устанавливает `contactDamage>0`, получатель (игрок/враг) использует `maxHealth`/`currentHealth` и `collidesWith` для фильтрации; `layer`/`collidesWith` следуют конвенции Phase A коллизионных слоёв. При `currentHealth≤0` сущность помечена мёртвой один раз, если `destroyOnDeath` — вызывается `scene.destroyEntity()`. |
| `movablePushable` | Movable / Pushable | 1 | implemented | `layer` (string, опционально), `collidesWith` (список слоёв запятой; пусто = все слои). Самодостаточное поведение: duck-typed hook `tryPush(dx,dy,scene)` (как `TriggerBehavior.isOverlapping`), вызывается `PlayerMovementBehavior` при коллизии. Сдвигает entity на (dx,dy), проверяет свободу целевой позиции (AABB vs другие enabled solids, исключая triggers); возвращает false и отменяет при блокировке, иначе true. `layer`/`collidesWith` следуют Phase A конвенции слоёв. |
| `mountableVehicleSeat` | Mountable / Vehicle Seat | 1 | implemented | `mountRadius` (число, дефолт 32 — расстояние центр-центр к игроку для монтирования), `speed` (число, дефолт 150 — px/sec транспортного средства), `layer` (слой), `collidesWith` (список слоёв запятой; пусто = все слои). Самодостаточное поведение: сущность с этим компонентом становится твёрдым препятствием (getBounds()) пока не смонтирована. Каждый тик: на нажатие E в пределах `mountRadius` от игрока — `scene.mountedVehicle = this.entity`, `scene.player.visible = false`, позиция игрока синхронизируется с машиной. Во время монтирования: машина управляется через `scene.input.getAxis()` с собственной per-axis AABB-коллизией (как PlayerMovementBehavior), игрок следует за координатами машины каждый тик. Второе нажатие E — демонтирование в фиксированное смещение (`vehicle.x + vehicle.width + 4`, `vehicle.y`), `scene.player.visible = true`, `scene.mountedVehicle = null`. Если рядом несколько машин, только одна получает монтирование за такт (guard check `scene.mountedVehicle`). `layer`/`collidesWith` следуют Phase A конвенции слоёв. Исключено: Event Graph integration, sprite swap, multi-seat. |
| `pathFollower` | Path Follower | 1 | implemented | `waypoints` (JSON `[{x,y},…]`, offsets from entity spawn position — same asset-local convention as collider freeform `points`; conventionally `waypoints[0] = {x:0,y:0}`), `speed` (px/sec, дефолт 100), `mode` (`loop`\|`pingpong`\|`once`, дефолт `loop`), `waitAtWaypoint` (сек, дефолт 0). Самодостаточное кинематическое поведение: каждый тик двигает entity.x/y к текущей целевой waypoint на `speed`; по достижении — пауза `waitAtWaypoint`, затем переход к следующей согласно `mode` (`loop` — wrap к первой, `pingpong` — реверс на концах, `once` — останов на последней). Без коллизий с solids (проходит сквозь геометрию) и без переноса игрока/пассажиров на движущейся платформе — не запрошено, вне рамок прохода. |
| `spawner` | Spawner | 1 | implemented | `template` (JSON, GameObject-shaped данные — то же, что принимает `EntityFactory.fromGameObjectData`; `id`/`x`/`y` игнорируются — задаются spawner'ом), `interval` (сек, дефолт 3; `<=0` — спавн выключен), `maxAlive` (дефолт 0 = без лимита — макс. одновременно живых сущностей от этого spawner'а), `maxSpawns` (дефолт 0 = без лимита — общий лимит спавнов за всё время жизни), `spawnOffsetX`/`spawnOffsetY` (дефолт 0 — offset от позиции spawner'а, asset-local конвенция, как `pathFollower.waypoints`). Самодостаточное поведение: каждый тик прунит `_alive` по факту присутствия в `scene.entities`, затем при `interval>0`, лимитах не исчерпанных и накопленном таймере `>= interval` — вызывает `EntityFactory.fromGameObjectData(template)` с id `${entity.id}__spawnN` и координатами `entity.x/y + spawnOffsetX/Y`, пушит в `scene.entities`. Публичный метод `spawnOne(scene)` — duck-typed hook для будущего Event Graph action (не подключён, вне рамок прохода). Нет ассет-реестра на рантайме — `template` хранит данные инлайн, как `pathFollower.waypoints`. |
| `stateMachineBehavior` | State Machine / Behavior | 1 | implemented | `defaultState` (string, имя начального состояния, дефолт — первый элемент `states`), `states` (JSON `[{name, movement, speed, waypoints, transitions}]`), `facingX`/`facingY` (опц., начальное направление взгляда, дефолт `(1,0)`). AI-стейт-машина NPC (patrol/chase) — отдельный компонент от `spriteUiAnimation`'s Фаза F clip-state-machine (та переключает спрайт-клипы, эта двигает entity), но переиспользует тот же механизм переходов: каждый тик проверяет `transitions` текущего состояния по порядку (первый matching wins), условие — либо `{type:'distance', op, value, fov?}` (дистанция от entity до `scene.player`, единственная поддерживаемая цель chase/flee в этом проходе; `fov` — градусы конуса обзора вокруг текущего facing, дефолт `180` — то есть NPC не видит игрока прямо позади себя, `fov:360` — старое всенаправленное поведение), либо `{var, op, value}` через общий `ConditionEvaluator.evalSpec` против `scene.eventGraphRuntime` (тот же формат условий, что Event Graph/Dialogue/Фаза F). Facing (`_facingX`/`_facingY`) — направление последнего фактического движения entity (обновляется в `patrol`/`chase`/`flee`, тот же one-tick-lag приём, что запись `speed` в Фазе F); проверка `transitions` идёт до `_runMovement` в рамках тика, так что facing используется от предыдущего тика. `movement` управляет тик-движением состояния: `patrol` — ping-pong между `waypoints` (offsets от spawn, та же asset-local конвенция что `pathFollower`), `chase`/`flee` — прямое движение к/от `scene.player` на `speed` (дефолт 100), без `movement` (или `idle`) — нет движения. Без коллизий с solids (как `pathFollower`). Публичный `setState(name)` — duck-typed hook для будущего Event Graph action "SetAIState" (не подключён). |
| `checkpointSavePoint` | Checkpoint / Save Point | 1 | implemented | Без properties (пустая схема, как `playerStart`) — триггер-зона = entity box. Самодостаточное поведение: каждый тик, пока не активен, AABB-проверка пересечения с `scene.player`; при пересечении — `activate(scene)`: снимает `isActive` с прежнего `scene.activeCheckpoint` (если был другой), помечает себя `isActive=true`, пишет `scene.checkpointPosition = {x,y}` (позиция entity). `Scene.respawnPlayer()` пересоздаёт `scene.player` (как `spawnPlayer()`, тот же `_createPlayer` helper) в `checkpointPosition`, если он задан, иначе в позиции `playerStart` маркера; вызывается из `GameEngine._update()` каждый тик, когда `scene.player` отсутствует (после `DamageHealthBehavior.destroyOnDeath`). Публичный `activate(scene)` — duck-typed hook, пригоден и для будущего Event Graph action. |
| `climbableLadder` | Climbable / Ladder | 1 | implemented | `climbSpeed` (число, дефолт 100 — px/sec при лазании), `shape` (`box`\|`circle`\|`freeform`, дефолт `box`); `color` (опционально); box: `offsetX`/`offsetY`/`width`/`height` (опц., дефолт — entity box); circle: `offsetX`/`offsetY` = центр, `radius` (или вписан в box fields); freeform: `points` `[{x,y},…]` asset-local. Не твёрдое препятствие (duck-type `isOverlapping()` возвращает false, исключается из PlayerMovementBehavior solids-скана как TriggerBehavior). Самодостаточное поведение: каждый тик PlayerMovementBehavior._findLadder() проверяет пересечение AABB игрока с ladder-зонами, при пересечении горизонтальный ввод игрока обнуляется (вертикальное-только движение) и скорость переходит на `climbSpeed` вместо normal walk-speed. Колл с solid-коллайдерами остаётся активным. Без Event Graph integration. |
| `conveyorZiplineJumpPadPortal` | Conveyor / Zipline / Jump Pad / Portal | 1 | implemented | `kind` (`conveyor`\|`zipline`\|`jumpPad`\|`portal`, select), shape/offsetX/offsetY/width/height/radius/points (zone geometry, same as collider/trigger, never solid), `speed` (conveyor push / zipline ride, px/sec), `directionX`/`directionY` (conveyor), `targetOffsetX`/`targetOffsetY` (zipline destination, offset from spawn), `launchOffsetX`/`launchOffsetY` (jump pad instant displacement), `targetId` (portal destination object id) |
| `variableModifier` | Variable Modifier | 1 | implemented | `varName` (string, имя переменной в `scene.eventGraphRuntime`), `op` (`set`\|`add`\|`subtract`\|`toggle`, дефолт `set`), `value` (JSON, игнорируется для `toggle`), `mode` (`once`\|`continuous`, дефолт `once`), shape/offsetX/offsetY/width/height/radius/points (zone geometry, same as collider/trigger, never solid — не твёрдое препятствие, duck-type `isOverlapping()` возвращает false). Самодостаточное поведение: реагирует только на `scene.player`. `once` — edge-detected, срабатывает один раз за вход в зону (повторно при повторном входе); `continuous` — применяется каждый тик, пока пересекается. `set` пишет `value` напрямую; `add`/`subtract` читают текущее значение переменной (отсутствующая трактуется как 0) и модифицируют; `toggle` инвертирует boolean, `value` не используется. |
| `destructibleContainer` | Destructible Container | 1 | implemented | Подкласс `damageHealth` (наследует health pool/contact-damage/invulnerability один в один, включая solid-blocking-while-alive побочный эффект — нет `isOverlapping()`, тот же duck-type, что PlayerMovementBehavior уже проверяет для damageHealth-сущностей). На смерть переопределённый хук `_onDeath(scene)` спавнит loot-сущность (`EntityFactory.fromGameObjectData`, тот же приём, что `SpawnerBehavior`) с `pickup`-компонентом (`itemId`/`count`) на своей позиции — игрок подбирает как обычный Pickup, вместо прямой выдачи в инвентарь. Без `itemId` — loot не спавнится, но `destroyOnDeath` всё равно отрабатывает. `contactDamage` намеренно не выведен в editor-схему (контейнер не наносит урон), но остаётся 0 по дефолту в рантайме (унаследованный конструктор). |

Первые 4 (`collider`/`trigger`/`interactable`/`playerStart`) реализованы как вертикальный срез
движкового MVP (`src/engine/behaviors/*`), остальные 14 — бэклог (см.
`tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md` §7), реализуются по мере реальной потребности конкретной
игры, не заранее. `collider`/`trigger` `layer`/`collidesWith` — Фаза A того же плана,
`spriteUiAnimation` — Фаза B (один клип), Фаза F (state machine с transitions/clips/defaultState).
