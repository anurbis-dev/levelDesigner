# LEDGE → Level Designer: план переноса

**Статус:** геймплей — v4.50.0; каталог ассетов — v4.53.0.

- Уровень: `content/maps/ledge.json`
- Каталог: `content/assets/ledge/` — Image sidecars (`player.png`, `tileset.png`, …); `ledge_tileset.json` (`type=tileset`, `tileKinds`/`solidIndices` + `sprite.imageAssetId`); `actors/*.json` (player, camera, terrain, items, enemies, doors, platforms, lifts); `graphs/ledge_logic.json` (`type=eventGraph`); `LEDGE.json` (`type=level`, `properties.levelSrc=maps/ledge.json`)
- Drop `LEDGE` на viewport открывает карту; dblclick — Asset Editor. Drop `ledge_logic` применяет graph.
- Объекты уровня — actors/prefabs со `sprite.imageAssetId`. Tilemap: `tilesetAssetId` + `imageAssetId`. `Level.eventGraphAssetId`.
- Камера: `followLerp=0.0015`, `lookAhead=20`. Спрайт рисуется в native frame size (feet-aligned), collider crouch/prone сжимается (`crouchHeight` 14 / `proneHeight` 7).
- Сборка: `node scripts/build-ledge-level.mjs`

Ниже — исходный план (не переписывать как текущий статус движка).

Источник: `tmp/ledge-v5.html`. Цель: тот же геймплей в Play редактора через компоненты, tilemap, Event Graph. Не хардкод уровня в JS.

Карта прототипа: 186×48 тайлов по 16px. Старт `(60, 22*16-22)`. Камера 320×180.

## Принцип

Физика и состояния игрока — один `playerMovement` (`mode:'platformer'`). Мир — tilemap + объекты. Связи — Event Graph и свойства компонентов. Новые типы только если существующий нельзя расширить.

## Что уже есть

| Прототип | Компонент |
|---|---|
| твёрдые тайлы | `tilemap` + `solidIndices` |
| лестницы (зона) | `climbableLadder` (сейчас top-down) |
| двери-пары | `conveyorZiplineJumpPadPortal` kind `portal` |
| монеты/гемы | `pickup` + `inventory` |
| HP / урон | `damageHealth` |
| патруль / платформы | `pathFollower` |
| бомбы флаеров | `spawner` |
| ключ / замок | `variableModifier` + Event Graph |
| старт / камера / HUD | `playerStart`, `camera`, canvases |

Движок сейчас top-down, без гравитации. Без `mode:'platformer'` LEDGE не поедет.

## Расширения (не дубли)

### 1. `Input`

- Actions: `jump` = Space/Z/X, `interact` += F/C.
- `wasActionPressed(name)` — фронт кадра (буфер прыжка, act).
- `endFrame()` из `GameEngine._update`.

### 2. `playerStart` + `PlayerMovementBehavior`

Свойства старта копируются на runtime-игрока:

- `movementMode`: `topdown` \| `platformer` (дефолт `topdown`)
- платформерные константы как в `C` прототипа (GRAV, JUMP, RUN, …)

`Scene._createPlayer`: collider + movement + `damageHealth`/`spriteUiAnimation` с маркера; размер 10×22; `imgSrc` игрока.

Платформер (один контроллер, файлы `<400` строк):

- гравитация, разгон/трение, койот, jump buffer, variable jump
- crouch / prone / roll, wall slide / wall jump
- ledge grab + climb, descend с края
- лестницы 4 видов + bars
- езда на pathFollower / лифте
- fall damage, respawn на checkpoint

Состояния пишутся в переменные Event Graph (`speed`, `moveState`, `stance`, `facing`, `hp`) — анимация читает их.

Хелперы: `src/engine/behaviors/platformer/` (`PlatformerController`, `PlatformerWorld`, `PlatformerLedge`, `PlatformerLadder`). Не отдельные component types.

### 3. `tilemap` — виды клеток

`tileKinds[index]`:

| index | kind | коллизия |
|---|---|---|
| 0 | empty | нет |
| 1 | solid | полный |
| 2 | crumb | полный, таймер 1.05s → gone 3.4s |
| 3 | ladderWall | нет (лаз) |
| 4 | ladderFront | нет; верх держит как пол |
| 5 | ladderDiagR | нет |
| 6 | ladderDiagL | нет |
| 7 | halfTop | верхние 8px |
| 8 | bar | нет (перекладина) |

`getSolidRects` учитывает crumb-gone и halfTop. Запросы: `tileKindAt`, `isSolidAt`, `isLadderAt`, `isBarAt`.

### 4. `climbableLadder`

`kind`: `vertical` \| `diagonalR` \| `diagonalL` \| `bar`. Для штучных зон; тайловые лестницы читает tilemap.

### 5. `pathFollower`

- `oneWayTop`: платформа ловит только сверху.
- `elevator`: `floors[]` (y), dwell, вызов ↑/↓, игрок едет в кабине.
- `dx`/`dy` за тик — для ride.

### 6. `collider`

`oneWay: 'up'` — сквозь снизу, стоп сверху (платформы/лифт).

### 7. `pickup`

- `mode: collect` (как сейчас) \| `hold` (факел: не destroy, `scene.heldEntity`).
- `healAmount` (гриб).
- `onPickupEvent` → `EmitCustomEvent`.

### 8. portal

`requireInteract`, `requireItem`, `consumeItem`, `lockedVar`, `fadeSeconds`. Без предмета — событие `locked`.

### 9. `damageHealth`

Пишет `hp`. Контакт с `layer:'hazard'`. Уничтожение врага → custom event.

### 10. Event Graph

Уже достаточно: OnInteract, OnCollisionEnter, Compare, SetVariable, Teleport, DestroyObject, SpawnObject, EmitCustomEvent, PlayAnimation.

Ноды: `HasItem` (condition), `ConsumeItem` (action) — инвентарь без дублирования в portal, если portal не покрывает кейс.

Граф уровня:

- двери: OnInteract → HasItem/Compare → ConsumeItem? → Teleport
- реликвия: OnCollision/pickup → `done=true` + HUD
- ключ: pickup → var `keys`
- win: Compare `done`

### 11. Камера / рендер

- `camera.viewHeight: 180` → zoom = canvasH / 180
- `imageSmoothingEnabled = false`
- bounds карты 0..2976 × 0..768

### 12. HUD canvas

HP, монеты/гемы/грибы, ключ, палка, «реликвия». Binding: variable + inventoryCount.

## Графика → `content/assets/ledge/`

Прототип рисует процедурно. Вытянуть в PNG:

```
content/assets/ledge/
  tileset.png          # 16×16, колонки 9: empty, rock, crumb, ladW, ladF, ladR, ladL, half, bar
  player.png           # атлас поз
  items.png            # coin, gem, shroom, relic, key, stick
  torch.png
  enemy.png
  flier.png
  door.png
  lift.png
  platform.png
```

Скрипт `scripts/extract-ledge-art.mjs` (+ при необходимости HTML-рендер в chrome).

## Уровень `content/maps/ledge.json`

Слои: terrain (tilemap), actors, items, fx.

Объекты (не тайлы):

- playerStart `(60, 330)` 10×22, mode platformer, hp=3
- camera viewHeight 180, follow player
- pickup: ~70 монет/гемов/грибов + relic + key + stick
- 6 дверей (3 пары portal)
- 8 врагов (pathFollower + damageHealth)
- 7 флаеров (pathFollower + spawner бомб)
- 3 платформы
- 2 лифта
- 15 факелов (pickup hold)
- checkpoint на земле

Карта тайлов — тем же `fillR`/`line`, что в прототипе.

## Ввод (level.inputMap)

```
moveLeft: arrowleft,a
moveRight: arrowright,d
moveUp: arrowup,w
moveDown: arrowdown,s
jump: ,z,x
interact: e,f,c
```

## Порядок работ

1. План (этот файл)
2. Input + platformer + spawn + camera zoom + pixel render
3. tilemap kinds + crumb + oneWay
4. pickup hold / portal lock / pathFollower elevator
5. Вытянуть PNG
6. Собрать `ledge.json` + items + canvases + eventGraph
7. Тесты + Play в редакторе
8. CHANGELOG, MemPalace, commit+push

## Вне скоупа (не в прототипе как логика уровня)

Отдельный визуальный граф анимации ( besides spriteUiAnimation SM). Touch-джойстик редактора. Процедурный per-frame рисунок персонажа — заменён атласом.
