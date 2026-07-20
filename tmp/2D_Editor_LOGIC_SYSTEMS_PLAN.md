# План: логические системы редактора (Event Graph / Dialogue / Animation / Sprite Playback / Collision Layers)

> Преемник `tmp/2D_Editor_ENGINE_PLAN.md` (удалён после закрытия — движковый MVP: загрузка, рендер,
> игрок, коллизии, камера, v4.8.1 — достигнут, оставшийся бэклог перенесён в §7 ниже, ничего не
> потеряно). Здесь — то, что нужно классической arcade/adventure игре сверх голого движения:
> связывание объектов уровня логикой, диалоги, анимация, проигрывание спрайт-листов.

> **Статус фаз (для других агентов/сессий, работающих в этом же репо параллельно):** заголовок
> фазы без пометки — ещё не начата, свободна. `🔨 В РАБОТЕ (кто, с даты)` — уже взята другой
> сессией, не начинать параллельно ту же фазу и не трогать перечисленные в пометке файлы/директории
> без согласования. `✅ ЗАВЕРШЕНА (дата, версия)` — сделано и закоммичено, детали расхождений с
> исходным текстом фазы — сразу под заголовком, как в бывшем `ENGINE_PLAN.md`. Перед тем как
> начинать любую фазу — проверить актуальный статус в этом файле (может быть обновлён другой
> сессией) и `git log --oneline -10`.

## Принцип: один визуальный граф, не три

Event Graph — единственный canvas-граф в редакторе. Dialogue и Animation получают свои форматы
данных (дерево реплик / стейт-машина), не отдельные визуальные графы — переиспользование
generic-графа для покадровой/полинейной логики душит читаемость (см. обоснование ниже в §3/§4;
так же исторически решили Unity — Animator отдельно от visual scripting, и Unreal — Dialogue
plugin поверх, а не вместо, Blueprint).

Оба формата данных дёргаются из Event Graph одним action-узлом (`StartDialogue`/`PlayAnimation`)
— граф остаётся точкой интеграции, не пытается сам моделировать текстовые ветвления или покадровые
переходы.

---

## Фаза A — Collision layers/mask (фундамент, маленькая)  ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия, v4.8.3)

Без этого триггер реагирует на всё подряд — семантически неверно уже для первого реального уровня
(зона диалога не должна триггериться от случайного ящика).

### Схема (расширение `collider`/`trigger` из `docs/RUNTIME_SCHEMA.md`)
```jsonc
{
  "id": "c1", "type": "collider", "enabled": true,
  "properties": {
    "offsetX": 0, "offsetY": 0, "width": 32, "height": 32,
    "layer": "player",                 // категория ЭТОГО объекта, одна строка
    "collidesWith": ["environment"]    // список категорий, с кем реагирует; [] = со всеми (back-compat)
  }
}
```
Категории — свободные строки, не enum (儿 как `layerId` у обычных layers) — фиксированного списка
на старте достаточно как конвенции в UI (`player`/`enemy`/`environment`/`hazard`/`trigger_zone`),
без жёсткой схемы-enum, чтобы не потребовалась миграция при добавлении новой категории.

### Реализация
- `AABB.js`/`TriggerBehavior.checkEntities` — фильтр по `layer`/`collidesWith` **до**
  геометрической проверки intersect (дешевле и корректнее).
- `ColliderBehavior`/`TriggerBehavior` конструкторы читают `layer`/`collidesWith` из
  `properties`, дефолт `collidesWith: []` = реагирует на всё (не ломает существующие тестовые
  уровни без миграции данных).

**Критерий готовности:** два коллайдера с разными `layer` и пустым/непустым `collidesWith`
корректно резолвятся в `AABB`/`TriggerBehavior` — покрыто vitest без UI.

---

## Фаза B — Sprite sheet playback (независима от графа, самый быстрый видимый результат)  ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия, v4.9.0)

TexturePacker-совместимый JSON — стандарт индустрии (Aseprite/TexturePacker/ShoeBox уже экспортируют
его бесплатно), переизобретать свой формат — чистое переусложнение.

### Схема `spriteAnimationClip` (asset-тип, уже в каталоге — из "not implemented" в implemented)
```jsonc
{
  "image": "content/atlases/hero.png",
  "frames": [
    { "name": "walk_0", "frame": { "x": 0, "y": 0, "w": 32, "h": 32 }, "duration": 100 },
    { "name": "walk_1", "frame": { "x": 32, "y": 0, "w": 32, "h": 32 }, "duration": 100 }
  ],
  "loop": true
}
```

### Реализация
- `src/engine/behaviors/SpriteAnimationBehavior.js` — держит `currentClip`, `frameIndex`,
  `elapsed`; `update(dt)` продвигает кадр по `duration` текущего фрейма; `play(clipId)`/`stop()`.
  Registered в `BehaviorRegistry` под `spriteUiAnimation` (закрывает пункт бэклога из
  ENGINE_PLAN §2.3).
- `Renderer._drawSingle` — расширить `drawImage` до 9-аргументного варианта
  (`drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`), беря `sx/sy/sw/sh` из текущего кадра
  behavior'а, если он есть; без behavior — прежнее поведение (вся текстура).
- `AssetLoader.js` — `spriteAnimationClip` уже в `LOADABLE_ASSET_TYPES`? Проверить при
  реализации — картинку атласа грузить как обычный `image`, JSON фреймов — данные, не бинарник
  (та же развилка loadable/data-only, что и в движковом Фаза 1.3).

### Редакторская сторона (MVP-урезание)
- **Импорт готового JSON** (drag-drop экспорт из Aseprite/TexturePacker) + превью с прокруткой
  кадров (простой timeline-scrubber, не canvas-редактор).
- **Не входит в MVP:** собственный UI нарезки атласа сеткой (drag-grid slicer) — внешние
  бесплатные инструменты закрывают эту функцию, делать свою — не нужно прямо сейчас.

**Критерий готовности:** уровень с объектом, несущим `spriteAnimationClip` + `spriteUiAnimation`,
проигрывает анимацию покадрово через Play-in-editor (видно смену кадров на глаз + vitest на
продвижение `frameIndex` по `dt`).

---

## Фаза C — Object Properties окно (нужна раньше графа — негде иначе настраивать компоненты)  ✅ ЗАВЕРШЕНА 2026-07-17 (editor-track, Asset Editor dock + undo)

Реализовано как **Asset Editor** float workspace (`role=assetEditor`, `src/ui/asset-editor/*`), не
отдельное modal-окно: Identity / Components / Details / Preview (mini-viewport).

### Расхождения с исходным текстом фазы
- **Capsule → circle**: в Details/Preview shape enum `box|circle|freeform` (+ color, freeform
  vertex edit). Circle покрывает 2D-капсульнуую геометрию MVP; отдельный capsule shape — backlog.
- **Event Graph вкладка (asset-scope UI)**: level-scope UI — **Фаза G** (ниже). Asset-scope
  (`Asset.eventGraph` + multi-runtime) — backlog: data model ассета ещё не держит граф.
- **Forms для Dialogue / Animation SM (E/F)**: generic Details schema; специализированные tree/
  states UI — backlog поверх schema.
- **Undo/redo**: каталог ассетов project-global, history уровня — per-session. Смешивать assets в
  `saveState(objects…)` ломает multi-level. Поэтому **asset-стек внутри того же
  `HistoryManager`** (`saveAssetState` / `undoAsset` / `redoAsset`); Ctrl+Z при открытом Asset
  Editor предпочитает asset-undo. Не отдельный класс, один entrypoint undo/redo.

### Критерий готовности (закрыт)
Выбрать ассет → add/remove component → shape freeform + точки → Ctrl+Z/Y восстанавливает
`Asset.components[].properties`; live `assetManager.updateAsset` + dirty `hasUnsavedChanges`.

---

## Фаза D — Event Graph MVP (ядро)  ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия, v4.10.0)

Реализовано строго в рамках рантайма (`src/engine/eventgraph/`), без UI-виджета графа — тот
остаётся будущей задачей (вероятно вкладка Event Graph в Фазе C). Из словаря узлов
зарегистрированы (`registerDefaultEventGraphNodes.js`) только те, что реально можно исполнить
уже сейчас: Entry — `OnStart/OnTick/OnCollisionEnter/OnCollisionExit/OnInteract/OnTimer/
OnCustomEvent`; Условия — `Compare/And/Or/Not`; Действия — `SetVariable/SetComponentEnabled/
Teleport/DestroyObject/EmitCustomEvent`. `PlaySound/SpawnObject/LoadLevel/StartDialogue/
PlayAnimation` сознательно не зарегистрированы (та же дисциплина, что и в
`docs/RUNTIME_SCHEMA.md` для нереализованных component-типов) — до Фаз E/F.

Упрощение против исходного текста фазы: `And/Or/Not` берут `params.conditions:
[{var,op,value}, ...]` явным списком, не через дополнительные рёбра графа — MVP-интерпретатор
моделирует только однонаправленную цепочку исполнения (`_runFrom`), не полноценный
multi-port dataflow для булевых операций.

Попутно найдены и исправлены два реальных, ранее незамеченных бага (в духе Фазы B/imageCache):
`Behavior.enabled` нигде не проверялся в рантайме (значит `SetComponentEnabled` не имел бы
никакого эффекта) — теперь `GameEngine._update` пропускает `update()` для выключенных behavior,
`PlayerMovementBehavior`/`TriggerBehavior` игнорируют выключенные коллайдеры; и
`PlayerMovementBehavior` считал `TriggerBehavior` твёрдым телом (оба экспонируют `getBounds()`)
— триггер-зона блокировала игрока как стена. Исправлено фильтром по `isOverlapping`.

Критерий готовности подтверждён vitest (`tests/engine/EventGraphRuntime.test.js`,
`GameEngine.integration.test.js`) и живым запуском в браузере (chrome-devtools,
идентичный результат).

### Схема графа (своя версия, независимая от версии уровня — принцип из движкового Фаза 0.2)
```jsonc
{
  "formatVersion": 1,
  "scope": "level",              // "level" | "asset"
  "variables": [
    { "name": "doorOpen", "type": "bool", "default": false }
  ],
  "nodes": [
    { "id": "n1", "type": "OnCollisionEnter", "params": { "layer": "player" }, "position": {"x":0,"y":0} },
    { "id": "n2", "type": "SetVariable", "params": { "name": "doorOpen", "value": true }, "position": {"x":200,"y":0} }
  ],
  "edges": [ { "from": "n1", "fromPort": "out", "to": "n2", "toPort": "in" } ]
}
```
`position` — только для раскладки в редакторе, рантайм её игнорирует.

### Минимальный словарь узлов
- **Entry**: `OnStart`, `OnTick` (только для редких проверок раз в N тиков — не для покадровой
  анимации, для этого Фаза F), `OnCollisionEnter`/`OnCollisionExit` (использует `layer` из Фазы
  A), `OnInteract` (использует `InteractableBehavior.isInRange` + нажатие клавиши взаимодействия
  — добавить `Input.isDown('e')` проверку, которой сейчас нет), `OnTimer`, `OnCustomEvent(name)`.
- **Условия**: `Compare(var, op, value)` (`==`,`!=`,`>`,`<`), `And`/`Or`/`Not`. Сложные выражения
  — не в MVP.
- **Действия**: `SetVariable`, `PlaySound`, `SpawnObject`/`DestroyObject`, `SetComponentEnabled`,
  `Teleport`, `LoadLevel`, `StartDialogue(dialogueId)` (Фаза E), `PlayAnimation(clipName)`
  (Фаза F), `EmitCustomEvent(name)`.
- **Переменные**: level-scoped (в манифесте уровня) + per-instance (в `GameObject.properties`,
  namespace чтобы не конфликтовать с движковыми полями) — общее хранилище для условий и Event
  Graph, и стейт-машины анимации (Фаза F), не два разных.
- **Custom Event** — pub/sub без прямой ссылки на объект: `EmitCustomEvent('doorOpened')` в одном
  графе, `OnCustomEvent('doorOpened')` в любом другом — мост Level Event Graph ⇄ Object Event
  Graph.
- **Object-picker** — только в узлах Level-scope графа (ссылка по instance-id, размещённому на
  уровне); asset-scope граф видит только `self`.

### Рантайм
- `src/engine/EventGraph.js` (или `behaviors/EventGraphBehavior.js`, решить при реализации по
  аналогии с существующими behavior-классами) — интерпретатор графа: держит `variables` map,
  на каждый релевантный entry-эвент проходит по связанным узлам, вызывая соответствующие action.
  Явная регистрация типов узлов (`EventGraphNodeRegistry.register(type, handler)`), тот же
  паттерн, что `BehaviorRegistry` — не `instanceof`/switch на 20 типов в одном файле.
- Незнакомый тип узла — warning в консоль, граф не падает целиком (тот же принцип, что
  `BehaviorRegistry` для незнакомых component.type).

### Debug (не откладывать в бэклог — без этого граф неотлаживаем)
- Live-подсветка активного узла + текущие значения переменных при Play — минимально: панель
  "Variables watch" рядом с графом, обновляется по `requestAnimationFrame`, не полноценный
  step-debugger.

**Критерий готовности:** уровень с триггером, у которого `OnCollisionEnter` → `SetVariable` →
`SetComponentEnabled` (отключить коллайдер двери) реально работает через Play-in-editor, граф
переживает Save/Load уровня, undo/redo на добавление узла работает.

---

## Фаза E — Dialogue (потребитель графа)  ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия, движковая часть)

Реализовано строго в рамках рантайма (`src/engine/DialogueRunner.js`,
`src/engine/eventgraph/ConditionEvaluator.js`, `src/engine/behaviors/DialogueTriggerBehavior.js`),
без UI (список/форма реплик — будущая задача, не canvas-виджет). `ConditionEvaluator` вынесен из
Фазы D в общий модуль — Event Graph (Compare/And/Or/Not) и DialogueRunner (choice.condition)
используют один и тот же `compareOp`/`evalSpec`, без дублирования, как и требовал план.
`dialogueTrigger` — чистый data-holder (dialogueId/layer), реальный dialogueId для запуска
диалога Event Graph's `StartDialogue` action несёт в своих params, а не читает из компонента.
`scene.dialogues` — level-scope `Map` по id (тот же приём, что `eventGraph` в Фазе D — полноценный
`assetsById` registry в `ProjectLoader` остаётся отложенным до Фазы 3/4).

Критерий готовности подтверждён vitest (`tests/engine/DialogueRunner.test.js`,
`GameEngine.integration.test.js` Фаза E describe-блок, 106/106 суммарно) и живым запуском в
браузере (chrome-devtools), идентичный результат.

**Не собирается из блоков Event Graph** — ветвящийся текст как generic-граф нечитаем уже на
3-4 репликах, весь опыт индустрии (Ink/Yarn Spinner/RPG Maker/Godot Dialogue Manager) поэтому
использует отдельный узкий формат.

### Схема (дерево реплик, не canvas-граф — обычный список/дерево в UI)
```jsonc
{
  "formatVersion": 1,
  "startNode": "d1",
  "nodes": [
    { "id": "d1", "speaker": "Guard", "text": "Стой!",
      "choices": [
        { "text": "Пропусти", "next": "d2", "condition": { "var": "hasPass", "op": "==", "value": true } },
        { "text": "Уйти", "next": null }
      ]
    },
    { "id": "d2", "speaker": "Guard", "text": "Проходи.", "next": null }
  ]
}
```
`condition` — тот же формат `{var, op, value}`, что и в Event Graph (Фаза D) — одна библиотека
сравнения переменных на оба потребителя, не дублировать.

### Реализация
- `dialogueTrigger` компонент (закрывает пункт бэклога ENGINE_PLAN §2.3) — `properties.dialogueId`
  + `layer`-фильтр (Фаза A) как у обычного trigger.
- `src/engine/DialogueRunner.js` — держит текущий узел, текущие choices, `advance(choiceIndex?)`.
  Не behavior на entity — самостоятельный небольшой класс, т.к. диалог не покадровая механика
  сущности, а модальное состояние сцены (пока диалог открыт — обычно логика/движение паузятся,
  решить при реализации — вероятно `scene.dialogueActive` флаг, который `PlayerMovementBehavior`
  проверяет и не двигает игрока).
- Event Graph: `StartDialogue(dialogueId)` action создаёт `DialogueRunner`, `OnDialogueEnded`
  entry-узел срабатывает по его завершении (с последним choice, если нужно ветвление сценария).
- UI (простой, не canvas): список узлов слева, форма реплики/choices справа — тот же паттерн,
  что уже есть в редакторе для похожих древовидных структур (например Outliner), не изобретать
  новый виджет-класс.

**Критерий готовности:** `OnInteract` → `StartDialogue` показывает реплику с выбором, выбор с
`condition` корректно скрывается/показывается по переменной, `OnDialogueEnded` срабатывает.

---

## Фаза F — Animation state machine (потребитель графа + Фазы B) ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия, движковая часть)

Реализовано: `SpriteAnimationBehavior` расширен — `properties.states`/`defaultState`/`clips`
({clipName: frames[]}) поверх Фазы B (без `states` — прежнее поведение, полная обратная
совместимость). Каждый тик проверяет переходы текущего состояния через тот же `evalSpec`
(`ConditionEvaluator.js`, общий с Event Graph/Диалогами), первый true-переход побеждает. Читает
переменные из `scene.eventGraphRuntime` — то же общее хранилище, что у Фазы D/E, отдельного
per-instance канала не заводили (как и предполагал план). `PlayerMovementBehavior` пишет `speed`
в `eventGraphRuntime` каждый тик (0, если нет ввода/диалог активен). Новый Event Graph action
`PlayAnimation(objectId, clip)` — форсирует клип через `SpriteAnimationBehavior.play()`, не
трогая `currentState`; стейт-машина подхватывает управление на своём следующем переходе (не
раньше — если ни один переход не срабатывает, форсированный клип держится, что и означает
формулировка плана буквально). `ComponentPropertySchema.js` получил generic JSON-поля для
`clips`/`states` (тот же паттерн, что уже был у `frames`, без нового виджета).
Проверено дважды: 116/116 vitest (было 106, +10 новых тестов) и live в браузере через
chrome-devtools (dynamic import GameEngine) — идентичный результат обоих прогонов, включая
one-tick lag speed-записи и forced-clip-persists-until-next-transition поведение.


**Не отдельный визуальный граф.** Стейт-машина как данные на компоненте — Details-форма
(состояния + переходы), не canvas. Ручное форсирование — через `PlayAnimation` action-узел
Event Graph (катсцены), обычная покадровая логика (idle/walk/jump) — через условия переходов,
не через per-tick узлы графа (антипаттерн — см. принцип в начале документа).

### Схема (расширение `spriteUiAnimation`/`transformAnimation` из Фазы B)
```jsonc
{
  "properties": {
    "defaultState": "idle",
    "states": [
      { "name": "idle", "clip": "hero_idle" , "transitions": [
        { "condition": { "var": "speed", "op": ">", "value": 0 }, "target": "walk" }
      ]},
      { "name": "walk", "clip": "hero_walk", "transitions": [
        { "condition": { "var": "speed", "op": "==", "value": 0 }, "target": "idle" }
      ]}
    ]
  }
}
```
`speed` — движковая per-instance переменная, которую `PlayerMovementBehavior` уже может писать
каждый тик (не нужно городить отдельный канал — то же хранилище переменных, что у Фазы D).

### Реализация
- `SpriteAnimationBehavior` (Фаза B) расширяется: если `properties.states` присутствует —
  каждый тик проверяет переходы текущего состояния, при срабатывании — `play(newState.clip)`.
  Без `states` — просто проигрывает один клип (обратная совместимость с Фазой B).
- `PlayAnimation(clipName)` из Event Graph — временно форсирует клип напрямую (не меняя
  `currentState`), стейт-машина подхватывает обратно на следующем переходе.

**Критерий готовности:** игрок с `speed`-переменной, обновляемой при движении, переключается
`idle`⇄`walk` автоматически, без единого узла Event Graph; сценарный `PlayAnimation` из графа
может форсировать `attack`-клип поверх.

---

## Порядок работ

| Фаза | Что | Блокирует |
|---|---|---|
| A | Collision layers/mask | Корректную семантику Фазы D (`OnCollisionEnter` по layer) |
| B | Sprite sheet playback | Фазу F (нужны клипы для стейт-машины) |
| C | Object Properties окно | Фазы D/E/F — негде иначе настраивать граф/диалог/стейт-машину |
| D | Event Graph MVP | Фазы E/F (оба — потребители action-узлов) |
| E | Dialogue | — |
| F | Animation state machine | — |
| G | Event Graph UI (level) | Authored graph without raw JSON |
| H | Dialogue UI + EG pickers | Authored dialogues; objectId/dialogueId selects |

A и B независимы — можно делать параллельно/в любом порядке. C логически можно начать сразу
после A (Details/Viewport не ждут графа), но Event Graph-вкладка в С физически зависит от виджета
из D — реализовать C в два захода (сначала Components/Details/Viewport, вкладка Event Graph —
после готовности D). **Фаза G** — level-scope canvas UI поверх runtime D.

---

## Фаза G — Event Graph UI (level-scope)  ✅ ЗАВЕРШЕНА 2026-07-17 (editor-track)

Dock contentType `eventGraph` (View menu / type picker), factory-only leaf (нет primary DOM в
`index.html`). Модули: `src/ui/event-graph/EventGraphPanel.js`, `EventGraphCanvas.js`,
`EventGraphModel.js`, `EventGraphNodeCatalog.js`.

### Что входит
- Canvas: узлы/рёбра (out→in), pan (MMB/Alt/Space), zoom (wheel), drag node, wire, Shift+in-port
  снимает входящие рёбра, delete selected node.
- Palette «+ Add node» по категориям entry/condition/action (словарь = runtime registerDefault).
- Details: params формы по catalog fields (string/number/boolean/json).
- Variables list (name + default JSON) → `level.eventGraph.variables`.
- Play Watch: live `eventGraphRuntime.variables` + подсветка `recentNodeIds` на canvas.
- History: `HistoryManager.setEventGraphProvider` — каждый `saveState` снапшотит
  `level.eventGraph` без правки всех call sites; restore в `HistoryOperations`.
- Save/Load: уже `Level.eventGraph` / `toJSON` (v4.12.2).

### Вне MVP / backlog
- Asset-scope graph (`scope: "asset"`, поле на Asset, multi EventGraphRuntime).
- Multi-port dataflow; step-debugger.
- Специализированный Animation SM editor.

**Критерий:** add nodes + wire + vars → Ctrl+Z → Save/Load → Play Watch видит variables.

---

## Фаза H — Dialogue UI + Event Graph object/dialogue pickers  ✅ ЗАВЕРШЕНА 2026-07-17 (editor-track)

### Dialogue authoring
- Dock contentType `dialogues` (factory-only), `src/ui/dialogues/DialoguesPanel.js` +
  `DialogueModel.js`.
- UI: list graphs → list nodes → form (speaker/text, linear next | choices + condition).
- Data: `level.dialogues[]` (`id`, `formatVersion`, `startNode`, `nodes`) — тот же контракт
  Scene Map / `StartDialogue`.
- History: `HistoryManager.setDialoguesProvider` + restore в `HistoryOperations`.

### Object / dialogue pickers (Event Graph)
- Field types `objectId` / `dialogueId` в `EventGraphNodeCatalog`.
- Shared `src/ui/LevelObjectPicker.js` (`listLevelObjectOptions`, `listDialogueOptions`,
  `createIdSelect`); orphan ids preserved as "(missing)".

**Критерий:** создать dialogue + choices → выбрать objectId/dialogueId из select → undo.

---

## Фаза I — Dialogue items + multi-NPC (schema/runtime/UI)  ✅ ЗАВЕРШЕНА 2026-07-17

### Заложено
- **Participants** multi-NPC (`role: player|npc`, `objectId`, `displayName`) + `node.speakerId`.
- **Player replies** = `choices[]` (UI: «Player reply options»).
- **Items** (player bag `Scene.inventory` / `Inventory.js`, seed `level.inventory`):
  - `giveItem` / `takeItem` effects on node enter and on choice select (NPC даёт / забирает).
  - `requireItem` on choice — скрыть ответ без предмета.
  - `itemPick` on choice — `advance(i, { selectedItemId })` отдаёт выбранный предмет.
- Authoring: Dialogues panel participants + effects + require/pick.
- MVP: only player bag is real; NPC bags deferred. Full Item Definition asset UI deferred.

**Критерий:** vitest give/take/require/itemPick + multi-speaker; UI fields present.

### Follow-up (2026-07-17) — Play HUD + Items UI + NPC bags ✅

- `DialoguePlayHud` on play overlay: Continue / choice buttons / item pick list.
- Dock `items`: `level.items`, `level.inventory`, `level.npcInventories` + history provider.
- Runtime multi-bag: `Scene.npcInventories` / `getBag`; effects `to`/`from`; itemPick → speaker bag.

---

## §7 — Унаследованный бэклог из `ENGINE_PLAN.md` (не потерян, перенесён сюда)

Не покрыто этим документом, остаётся отдельным бэклогом без привязки к фазам A-F:

- **Camera asset** (follow-target/deadzone/bounds) ✅ ЗАВЕРШЕНА 2026-07-17 (engine-track сессия) —
  `camera` component + `CameraBehavior` (`src/engine/behaviors/CameraBehavior.js`), auto-attached
  на асset-тип `camera` (`DEFAULT_ASSET_COMPONENTS`). `GameEngine._updateCamera()` делегирует
  маркеру, если он есть на уровне; иначе legacy hard-center на игроке (v4.8.0 заглушка) остаётся
  как fallback для уровней без камеры. Без своего UI-виджета — generic Details JSON, как
  `spriteUiAnimation`. **Render layers** ✅ ЗАВЕРШЕНА 2026-07-20: `camera.properties.renderLayers`
  (список layer id; пусто = все слои, конвенция Фазы A `collidesWith: []`) —
  `CameraBehavior.getRenderLayers()`, `GameEngine._updateCamera()` кэширует в
  `this.cameraRenderLayers` (`null` для legacy hard-center fallback — без ограничения слоёв),
  `Renderer.renderScene(scene, camera, parallaxStartPosition, renderLayers)` фильтрует
  `scene.entities` по `entity.layerId` до отрисовки; сущности без `layerId` рендерятся всегда.
- **Компоненты без отдельной фазы**: `damageHealth`, `movablePushable`,
  `mountableVehicleSeat`, `pathFollower`, `spawner`, `checkpointSavePoint`, `climbableLadder`,
  `conveyorZiplineJumpPadPortal`, `destructibleContainer`, `variableModifier` — реализуются по
  мере того, в какие реально упирается конкретная игра (та же дисциплина, что была в
  ENGINE_PLAN §2.3). `stateMachineBehavior` — уточнить при реализации: это AI-стейт-машина NPC
  (patrol/chase), отдельная от анимационной (Фаза F) — общий механизм переходов можно
  переиспользовать, но это не один и тот же компонент.
  - `pickup` ✅ ЗАВЕРШЕНА 2026-07-18: `PickupBehavior` (`src/engine/behaviors/PickupBehavior.js`)
    — самодостаточное поведение (не data-holder, как `dialogueTrigger`), тик AABB-проверка
    пересечения с `scene.player`, `scene.inventory.add(itemId, count)` +
    `scene.destroyEntity()` (если `destroyOnPickup`). Схема `itemId`/`count`/`destroyOnPickup`
    в `src/constants/ComponentPropertySchema.js`.
  - `damageHealth` ✅ ЗАВЕРШЕНА 2026-07-19: `DamageHealthBehavior`
    (`src/engine/behaviors/DamageHealthBehavior.js`) — один тип компонента покрывает обе
    стороны контактного урона: `maxHealth`/`currentHealth` — пул здоровья, `contactDamage` —
    сколько эта сущность наносит другим при касании (0 = только получает урон, не наносит).
    Тик AABB-проверка против всех сущностей с `damageHealth`-поведением (не только
    `scene.player`, в отличие от `pickup` — иначе враг не мог бы получать урон от игрока);
    переиспользует `layer`/`collidesWith` из Фазы A (`AABB.matchesLayer`) для фильтрации, кто
    кому наносит урон. `invulnerabilityDuration` — окно неуязвимости (i-frames) после
    получения урона. При `currentHealth <= 0` — `scene.destroyEntity()` (если
    `destroyOnDeath`). Без интеграции в Event Graph в этом проходе (нет `OnDeath`-узла) — как и
    `pickup` не добавлял `OnPickup`, здесь тоже не выходили за рамки задачи; HP HUD/отображение
    здоровья — отдельный бэклог, не запрошен. Схема в `src/constants/ComponentPropertySchema.js`.
  - `movablePushable` ✅ ЗАВЕРШЕНА 2026-07-19: `MovablePushableBehavior`
    (`src/engine/behaviors/MovablePushableBehavior.js`) — Sokoban-style ящик. В отличие от
    `pickup`/`damageHealth` не может быть полностью самодостаточным: сдвиг ящика должен
    происходить синхронно с шагом игрока, который его толкает, поэтому единственная точка
    интеграции — `PlayerMovementBehavior._moveAxis` (`src/engine/behaviors/PlayerMovementBehavior.js`)
    duck-type-вызывает `blocker.tryPush(dx, dy, scene)` на любом блокере (тот же приём, что уже
    использовался для `TriggerBehavior.isOverlapping`) перед откатом заблокированного шага.
    `tryPush` двигает свою сущность на тот же вектор и тут же проверяет, свободен ли пункт
    назначения от других solid-сущностей (кроме triggers) — если нет, откатывает себя и
    возвращает false, шаг игрока тоже откатывается как обычно. `getBounds()` делает ящик solid
    по умолчанию (блокирует, если не толкают). `layer`/`collidesWith` (Фаза A) фильтруют, что
    именно блокирует пункт назначения при толчке. Без цепочки "ящик толкает ящик" за один
    tryPush-вызов — если такое понадобится, можно рекурсивно звать `tryPush` на найденных
    блокерах внутри самого `tryPush`, не делали, т.к. не запрошено. Схема
    `layer`/`collidesWith` в `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/MovablePushableBehavior.test.js`.
  - `mountableVehicleSeat` ✅ ЗАВЕРШЕНА 2026-07-19: `MountableVehicleSeatBehavior`
    (`src/engine/behaviors/MountableVehicleSeatBehavior.js`) — самодостаточно, как `pickup`:
    сам опрашивает `scene.input.isDown('e')` с собственным edge-detect (не через
    `EventGraphRuntime`/`OnInteract` — не стали требовать авторства Event Graph узла ради
    базового mount/dismount, та же дисциплина, что `pickup` не заводил `OnPickup`). На E рядом
    (`mountRadius`, дефолт 32, дистанция от центра к центру игрока) — `scene.mountedVehicle =
    this.entity`, `scene.player.visible = false`, игрок телепортируется на позицию машины.
    Пока сел — ведёт машину сам (`_driveVehicle`: тот же `getAxis()`/AABB-blocking паттерн,
    что `PlayerMovementBehavior`, свои `speed`/`layer`/`collidesWith`), `scene.player.x/y`
    каждый тик синхронизируется с машиной (камера следит за `scene.player` по умолчанию —
    без правок `CameraBehavior`). Единственная правка вне нового файла:
    `PlayerMovementBehavior.update()` — добавлен `if (scene.mountedVehicle) return;` (тот же
    приём, что уже был для `scene.dialogueActive`). `getBounds()` делает припаркованную машину
    solid по умолчанию (блокирует игрока, пока не сел) — как `ColliderBehavior`/
    `MovablePushableBehavior`. Повторный E — dismount на фиксированный оффсет
    (`vehicle.x + vehicle.width + 4`, без поиска свободной клетки — вне рамок задачи). Guard
    `scene.mountedVehicle && scene.mountedVehicle !== this.entity → return` в начале `update()`
    защищает от одновременной посадки в две машины, стоящие в радиусе друг друга на одном тике.
    Схема `mountRadius`/`speed`/`layer`/`collidesWith` в
    `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/MountableVehicleSeatBehavior.test.js` (6 тестов). Без Event Graph
    (OnMount/OnDismount), без смены спрайта/анимации на посадку, без пассажиров.
  - `pathFollower` ✅ ЗАВЕРШЕНА 2026-07-19: `PathFollowerBehavior`
    (`src/engine/behaviors/PathFollowerBehavior.js`) — самодостаточное кинематическое
    поведение (не data-holder), как `pickup`/`damageHealth`. `waypoints` — JSON
    `[{x,y},…]`, offsets от spawn-позиции entity (тот же asset-local приём, что freeform
    `points` у collider/trigger) — один конфиг пути переиспользуем на разных размещениях
    актора. Каждый тик двигает `entity.x/y` к текущей target-waypoint на `speed` px/sec;
    по достижении — пауза `waitAtWaypoint` сек, затем переход по `mode`
    (`loop` wrap к первой / `pingpong` реверс на концах / `once` останов на последней).
    Без коллизий с solids (не блокируется геометрией, проходит сквозь) и без переноса
    игрока/пассажиров на движущейся платформе — не запрошено, как и другие §7-компоненты
    не выходили за рамки задачи. Схема `waypoints`/`speed`/`mode`/`waitAtWaypoint` в
    `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/PathFollowerBehavior.test.js` (8 тестов).
  - `spawner` ✅ ЗАВЕРШЕНА 2026-07-19: `SpawnerBehavior`
    (`src/engine/behaviors/SpawnerBehavior.js`) — самодостаточное поведение (не data-holder),
    как `pickup`/`pathFollower`. Ассет-реестра на рантайме ещё нет (`ProjectLoader.assetsById`
    — пустой Map, см. `ProjectLoader.js`), поэтому `template` — полноценные GameObject-данные
    инлайн (тот же формат, что принимает `EntityFactory.fromGameObjectData`), а не ссылка на
    ассет — тот же приём инлайновых данных без ассет-реестра, что `pathFollower.waypoints`.
    Каждый тик: прунит `_alive` по факту присутствия в `scene.entities`, при `interval>0` и не
    исчерпанных `maxAlive`/`maxSpawns` — копит таймер, по достижении `interval` вызывает
    `EntityFactory.fromGameObjectData({...template, id, x, y})` с координатами
    `entity.x/y + spawnOffsetX/Y` (asset-local offset, как у `pathFollower`) и пушит в
    `scene.entities` напрямую (тот же приём, что `Scene.spawnPlayer()`). `template.x/y`
    игнорируются — один template переиспользуем на разных размещениях spawner'а.
    `maxAlive`/`maxSpawns` — `0` = без лимита. Публичный `spawnOne(scene)` — duck-typed hook
    для будущего Event Graph "SpawnObject" action (не подключён — вне рамок прохода, как
    Event Graph-триггеры не заводились для `pickup`/`damageHealth`). Схема
    `template`/`interval`/`maxAlive`/`maxSpawns`/`spawnOffsetX`/`spawnOffsetY` в
    `src/constants/ComponentPropertySchema.js`; тесты `tests/engine/SpawnerBehavior.test.js`
    (8 тестов).
  - `stateMachineBehavior` ✅ ЗАВЕРШЕНА 2026-07-19: `StateMachineBehavior`
    (`src/engine/behaviors/StateMachineBehavior.js`) — уточнено при реализации согласно
    заметке в этом же бэклоге: AI-стейт-машина NPC (patrol/chase), отдельный компонент от
    `spriteUiAnimation`'s Фаза F clip-state-machine (та переключает спрайт-клипы, эта двигает
    entity), но переиспользует тот же механизм переходов — каждый тик перебирает
    `transitions` текущего состояния по порядку (первый matching wins, тот же convention что
    `DialogueRunner.getVisibleChoices`/`EventGraphRuntime._runFrom`/Фаза F). Условие двух
    видов: `{type:'distance', op, value}` — дистанция от entity до `scene.player` (единственная
    поддерживаемая chase/flee-цель в этом проходе, тот же "не завели generic target list, не
    запрошено" приём, что `pickup`/`mountableVehicleSeat` жёстко используют `scene.player`), и
    `{var, op, value}` — переиспользует общий `ConditionEvaluator.evalSpec`/`compareOp` (та же
    библиотека, что Event Graph Compare/Dialogue conditions/Фаза F, без дублирования) против
    `scene.eventGraphRuntime`. `movement` каждого состояния — `patrol` (ping-pong между
    `waypoints`, offsets от spawn, тот же asset-local приём что `pathFollower.waypoints`),
    `chase`/`flee` (прямое движение к/от `scene.player` на `speed`, дефолт 100), без
    `movement`/`idle` — нет движения. Без коллизий с solids (проходит сквозь геометрию, как
    `pathFollower`). Публичный `setState(name)` — duck-typed hook (как `tryPush`/`spawnOne`)
    для будущего Event Graph action "SetAIState" (не подключён — вне рамок прохода). Схема
    `defaultState`/`states` в `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/StateMachineBehavior.test.js` (9 тестов).
    **Facing-cone fix (2026-07-20, v4.28.0):** `type:'distance'` был всенаправленным — NPC
    "видел" игрока и у себя за спиной. Добавлен `_isWithinSight()` — конус обзора вокруг
    `_facingX`/`_facingY` (направление последнего фактического движения, обновляется в
    `patrol`/`chase`/`flee`), дефолт `fov: 180°` (не видит строго позади), override за счёт
    `condition.fov` (`360` — старое поведение). `properties.facingX`/`facingY` — начальная
    ориентация неподвижного NPC (дефолт `(1,0)`). Тесты +3 в
    `tests/engine/StateMachineBehavior.test.js` (12 всего).
  - `checkpointSavePoint` ✅ ЗАВЕРШЕНА 2026-07-19: `CheckpointSaveBehavior`
    (`src/engine/behaviors/CheckpointSaveBehavior.js`) — самодостаточное поведение (как
    `pickup`), пустая схема свойств (как `playerStart` — триггер-зона = entity box, без
    offset/shape override). Каждый тик, пока не активен, AABB-проверка пересечения с
    `scene.player`; при пересечении вызывает публичный `activate(scene)` (duck-typed hook,
    как `setState`/`tryPush`/`spawnOne` — пригоден и для будущего Event Graph action): снимает
    `isActive` с прежнего `scene.activeCheckpoint` (единственный источник истины, одновременно
    активен только один чекпоинт), помечает себя, пишет `scene.checkpointPosition = {x,y}`.
    Респавн реализован в `Scene.js`: `spawnPlayer()`/новый `respawnPlayer()` шарят общий
    `_createPlayer()` helper; `respawnPlayer()` — no-op если `scene.player` уже жив, иначе
    создаёт игрока в `checkpointPosition` (если задан) либо в позиции `playerStart` маркера
    (кэширован в `scene._playerStartMarker` при первом `spawnPlayer()`). `GameEngine._update()`
    зовёт `scene.respawnPlayer()` каждый тик, когда `scene.player` отсутствует — единственная
    точка входа для респавна после `DamageHealthBehavior.destroyOnDeath` (который до этого
    молча оставлял `scene.player = null` без какой-либо реакции движка). Тесты:
    `tests/engine/CheckpointSaveBehavior.test.js` (4), плюс 3 новых в `tests/engine/Scene.test.js`
    (`Scene.respawnPlayer`).
  - `climbableLadder` ✅ ЗАВЕРШЕНА 2026-07-20: `ClimbableLadderBehavior`
    (`src/engine/behaviors/ClimbableLadderBehavior.js`) — никогда не solid: `isOverlapping()`
    существует только как duck-type маркер, тот же приём, что `TriggerBehavior` — уже
    существующий фильтр solids в `PlayerMovementBehavior` (`typeof x.isOverlapping !==
    'function'`) исключает ladder-зону без правок самого фильтра. `getBounds()` — та же
    shape/offset/circle/freeform схема, что `collider`/`trigger`; `getClimbSpeed()` —
    `properties.climbSpeed` (дефолт 100). Единственная точка интеграции —
    `PlayerMovementBehavior._findLadder(scene)` (duck-type на `getClimbSpeed`): пока bounds
    игрока пересекают включённую ladder-зону, горизонтальный ввод обнуляется (climb только по
    вертикали), скорость переключается с обычной ходьбы на `climbSpeed`; обычная per-axis
    solid-блокировка (коллайдеры) продолжает действовать во время climb — без обхода стен.
    Без Event Graph (`OnLadderEnter`), без авто-центрирования игрока по горизонтали ladder —
    не запрошено, та же дисциплина, что у остальных §7-компонентов. Схема
    `climbSpeed`/`shape`/`offsetX`/`offsetY`/`width`/`height`/`radius`/`points` в
    `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/ClimbableLadderBehavior.test.js` (6 тестов).
  - `conveyorZiplineJumpPadPortal` ✅ ЗАВЕРШЕНА 2026-07-20: один компонент, `kind` enum
    (`conveyor`|`zipline`|`jumpPad`|`portal`) — тот же приём shape-enum, что `collider`'s
    `box|circle|freeform`, а не четыре отдельных component-типа, т.к. все четыре — одна и та
    же зона (never solid, `isOverlapping()` возвращает false, тот же duck-type, что
    `ClimbableLadderBehavior`), различается только эффект на `scene.player` при контакте.
    Реагирует только на `scene.player` (та же "не обобщено на произвольные сущности, не
    запрошено" дисциплина, что `pickup`/`checkpointSavePoint`/`mountableVehicleSeat`).
    `conveyor` — непрерывный толчок каждый тик, пока пересекается (`directionX`/`directionY`
    × `speed`). `jumpPad` — одноразовое мгновенное смещение (`launchOffsetX`/`launchOffsetY`)
    при входе в зону (edge-detect по `_wasOverlapping`, не повторяется, пока игрок стоит
    внутри); двигатель без гравитации/velocity-интегратора (та же design rationale, что у
    `climbableLadder`), поэтому "импульс" — мгновенное смещение позиции, а не физическая
    сила. `zipline` — захватывает управление игроком: `PlayerMovementBehavior` получил новый
    guard `if (scene.zipliningEntity) return;` (тот же приём, что `scene.mountedVehicle`/
    `scene.dialogueActive`); при входе в зону ставит `scene.zipliningEntity = this.entity` и
    везёт `scene.player` к `targetOffsetX`/`targetOffsetY` (offset от spawn-позиции entity,
    тот же asset-local приём, что `pathFollower.waypoints`) на `speed`, по достижении
    отпускает управление (`scene.zipliningEntity = null`); вторая zipline-зона игнорирует
    оверлап, пока едет первая (guard на `scene.zipliningEntity !== this.entity`). `portal` —
    одноразовый телепорт на `targetId` (тот же resolve, что Event Graph's `Teleport` action:
    `scene.getAllEntities().find(e => e.id === targetId)`), edge-detected, чтобы стоять в
    зоне не значило телепортироваться каждый тик. Два портала, направленные друг на друга,
    всё ещё могут дать один "пинг-понг" переход на входе — не предотвращается намеренно
    (ответственность автора уровня — разносить точки назначения), та же "не запрошено"
    дисциплина, что у остальных §7-компонентов. Схема (`kind`/shape-поля/`speed`/
    `directionX`/`directionY`/`targetOffsetX`/`targetOffsetY`/`launchOffsetX`/
    `launchOffsetY`/`targetId`) в `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/ConveyorZiplineJumpPadPortalBehavior.test.js` (9 тестов, включая
    zipline+`PlayerMovementBehavior` suspend/resume и double-zipline guard).
  - `variableModifier` ✅ ЗАВЕРШЕНА 2026-07-20: `VariableModifierBehavior`
    (`src/engine/behaviors/VariableModifierBehavior.js`) — never-solid Volume/Trigger зона
    (`isOverlapping()` возвращает false, тот же duck-type, что `ClimbableLadderBehavior`/
    `ConveyorZiplineJumpPadPortalBehavior`), реагирует только на `scene.player` (та же
    дисциплина, что у остальных §7-зон). Пишет в переменную `EventGraphRuntime` при
    контакте — обратная сторона механизма, которым Quest/Dialogue условия читают
    переменные через `ConditionEvaluator`'s `{var,op,value}` против
    `scene.eventGraphRuntime` (тот же `getVariable`/`setVariable` контракт, что уже
    использует `PlayerMovementBehavior` для `speed` и `StateMachineBehavior`/
    `spriteUiAnimation` для transition-условий). `op`: `set` пишет `value` напрямую;
    `add`/`subtract` читают текущее значение (отсутствующее трактуется как 0) и
    прибавляют/вычитают `value`; `toggle` инвертирует boolean, `value` игнорируется.
    `mode: 'once'` — edge-detected, срабатывает один раз за вход в зону, повторно при
    повторном входе (тот же "не спамит, но повторяем" приём, что `portal`/`jumpPad`, без
    `destroyOnTrigger` — не запрошено); `mode: 'continuous'` — применяется каждый тик,
    пока пересекается (drain/regen-зона). Схема `varName`/`op`/`value`/`mode`/shape-полей
    в `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/VariableModifierBehavior.test.js` (9 тестов).
  - `destructibleContainer` ✅ ЗАВЕРШЕНА 2026-07-20 (12/12, §7 backlog закрыт): `DestructibleContainerBehavior`
    (`src/engine/behaviors/DestructibleContainerBehavior.js`) — подкласс `DamageHealthBehavior`,
    не отдельная реализация health-pool: переиспользует его контактный урон/invulnerability/
    solid-blocking-while-alive один в один (нет `isOverlapping()`, тот же duck-type, что
    PlayerMovementBehavior уже проверяет для damageHealth-сущностей — контейнер блокирует
    игрока, пока жив, "бесплатно"). `DamageHealthBehavior._applyDamage` разбит на явный хук
    `_onDeath(scene)` (чистый рефакторинг, без изменения поведения) — `DestructibleContainerBehavior`
    переопределяет его: перед вызовом `super._onDeath` (который делает `destroyEntity`, если
    `destroyOnDeath`) спавнит loot-сущность через `EntityFactory.fromGameObjectData` (тот же
    приём, что `SpawnerBehavior`) с `pickup`-компонентом (`itemId`/`count`) на своей позиции —
    игрок подбирает loot как обычный Pickup (`PickupBehavior` уже существует), а не получает
    предмет напрямую в инвентарь — тем самым сохраняется жанровая механика "разбил ящик →
    подобрал предмет". Пустой `itemId` — loot не спавнится, `destroyOnDeath` всё равно
    отрабатывает. `contactDamage` намеренно не выведен в editor-схему (контейнер не наносит
    урон другим), но остаётся 0 по дефолту в рантайме (унаследованный конструктор, не требует
    отдельного кода). Схема `maxHealth`/`currentHealth`/`invulnerabilityDuration`/
    `destroyOnDeath`/`layer`/`collidesWith`/`itemId`/`count` в
    `src/constants/ComponentPropertySchema.js`; тесты
    `tests/engine/DestructibleContainerBehavior.test.js` (8 тестов).
- **Полный критерий Фазы 4 движка** (было решено сдать минимальным срезом, v4.6.x): eslint-
  plugin-boundaries для границы `engine/`↔остальной `src/`, asset-usage-граф для отсечения
  мёртвого контента в `build:game`, флаг "включено в билд" на уровне, `build:addon`/`build:event`
  — полная реализация вместо заглушек.
- **~20 нереализованных asset-типов** без runtime-поведения (`tileset`, `particleEffect`,
  `navMesh` и т.д., за вычетом того, что теперь покрыто §B/§E: `spriteAnimationClip`,
  `dialogueGraph`) — бэклог `docs/RUNTIME_SCHEMA.md`, без дедлайна.
  - `soundEffect` Tier 1 частично 🔨 2026-07-20: `PlaySound` event-graph action зарегистрирован
    (`src/engine/eventgraph/registerDefaultEventGraphNodes.js`) — `params: {src, volume?, loop?}`
    напрямую (тот же inline-приём, что `Teleport`, без резолва через `assetsById`, который
    по-прежнему пустой `Map`, см. `ProjectLoader.js` шапку). Проигрывание —
    `AudioPlayer.play()` (`src/engine/AudioPlayer.js`), browser-guarded static-хелпер, только
    one-shot SFX (без instance-tracking/stop). Каталожный asset-тип `soundEffect` остаётся
    плейсхолдером без выделенной Asset Editor формы — не запрошено в этом срезе.
    Тесты: `tests/engine/AudioPlayer.test.js` (5), `GameEngine.integration.test.js` §7 PlaySound
    (1). `musicTrack`/`audioZone` (loop/crossfade/ambient-on-enter) — следующий Tier, не начат.
  - `pathSpline` Tier 1 частично 🔨 2026-07-20: `pathFollower` получил `interpolation`
    (`'linear'` дефолт \| `'smooth'`) — в `'smooth'` `PathFollowerBehavior._updateSmooth`/
    `_catmullRom` (`src/engine/behaviors/PathFollowerBehavior.js`) двигает entity по кривой
    Catmull-Rom через `waypoints` вместо прямых отрезков; control points — соседние waypoints
    (клэмп на границах, без wrap даже в `mode:'loop'`), прогресс сегмента `_segT` — по длине
    прямой хорды (приближение, не истинная длина дуги). Без отдельного каталожного ассета —
    конфиг инлайн на `pathFollower.properties`, тот же приём, что `PlaySound`. Schema-форма:
    `ComponentPropertySchema.js` `PATH_FOLLOWER_INTERPOLATION_OPTIONS`.
    Тесты: 3 новых в `tests/engine/PathFollowerBehavior.test.js` (точное попадание в waypoints,
    отклонение от прямой хорды mid-segment, дефолт `'linear'`). `aiBehaviorPreset`/
    `materialShaderPreset` — следующие Tier 1 пункты, не начаты.
  - `aiBehaviorPreset` Tier 1 частично 🔨 2026-07-20: `stateMachineBehavior` получил `aiPreset`
    (JSON `{aggroRadius?, leashRadius?, speed?, chaseSpeed?, waypoints?, fov?}`) — статический
    `StateMachineBehavior._buildPresetStates` разворачивает его в стандартную двух-состоятельную
    машину `patrol`(guard-пост при пустых waypoints)→`chase` по входу в `aggroRadius`→обратно
    в `patrol` по выходу за `leashRadius` (дефолт `aggroRadius*2`). Явный `states`, если задан,
    всегда приоритетнее `aiPreset` (это генератор-шорткат, не замена ручной машины). Без
    отдельного каталожного ассета — конфиг инлайн на `stateMachineBehavior.properties`, тот же
    приём, что `pathFollower.interpolation`/`PlaySound`. Schema-поле: `ComponentPropertySchema.js`
    `aiPreset` (JSON). Тесты: 6 новых в `tests/engine/StateMachineBehavior.test.js`.
  - `materialShaderPreset` Tier 1 завершён ✅ 2026-07-20: `entity.materialPreset` — прямое поле
    GameObject (как `color`/`imgSrc`, не component `properties`), JSON `{blur?, brightness?,
    saturate?, hueRotate?, dropShadow?:{x?,y?,blur?,color?}}`. `Renderer._buildFilterString()`
    (`src/engine/render/Renderer.js`) собирает CSS `filter`-строку, применяется в `_drawSingle`
    к каждому draw (картинка или fallback rect), сбрасывается в `'none'` для сущностей без
    пресета (не течёт на следующую). Не привязано к `volume`-зоне — `volume` (произвольной формы
    визуальная триггер-зона) отдельный, всё ещё не реализованный §7 пункт; фильтр применяется к
    любой сущности. Без отдельного каталожного ассета — тот же inline-приём, что
    `pathFollower.interpolation`/`stateMachineBehavior.aiPreset`/`PlaySound`.
    Тесты: 3 новых в `tests/engine/Renderer.test.js`.
    **Весь Tier 1 §7 backlog (soundEffect/pathSpline/aiBehaviorPreset/materialShaderPreset)
    закрыт.**
  - **Tier 2 завершён ✅ 2026-07-20: реальный `ProjectLoader.assetsById` + `prefab`
    (`SpawnObject`).** `ProjectExporter.export(..., {assetManager})` — опциональный
    `assetManager`, встраивает `assetManager.getAllAssets().map(a => a.toJSON())` как новое
    поле `assets` в манифест (пусто, если не передан — обратная совместимость).
    `ProjectLoader.load()` строит настоящий `assetsById: Map` из `manifest.assets` (раньше —
    захардкоженный пустой Map, см. старый шапка-комментарий); `ProjectLoader.loadLevel()`
    прикрепляет его к `Scene.assetsById`. Новый `EntityFactory.fromAssetData(assetData,
    {id?,x?,y?,layerId?}, assetsById?)` — engine-native порт `Asset.createInstance()`
    (`src/models/Asset.js`), отдельная реализация (не переиспользует models/ui — `engine/`
    остаётся без импортов оттуда); резолвит `sprite.properties.imageAssetId` композитного
    ассета через `assetsById` в `imgSrc` другого каталожного ассета (аналог
    `AssetVisualMigrate.resolveTextureSrc`, без deprecated `sprite.src` fallback).
    Новый Event Graph action `SpawnObject` (`params: {assetId, x?, y?, layerId?}`,
    `registerDefaultEventGraphNodes.js`) — первый action, которому реально нужен asset-реестр
    (все предыдущие Tier 1 actions использовали inline params именно потому, что реестра не
    было). Без editor UI для авторства `SpawnObject`-нод — не запрошено в этом срезе.
    Тесты: 2 в `tests/ProjectExporter.test.js`, 2 в `tests/engine/ProjectLoader.test.js`,
    7 в `tests/engine/EntityFactory.test.js`, 2 в `tests/engine/GameEngine.integration.test.js`.
  - **Tier 3 в работе — `questObjective` завершён ✅ 2026-07-21.** Новый `level.quests[]`
    (`{id, name?, objectives:[{id,description?,condition}], reward?}`), level-scope map как
    `dialogues`/`canvases`. Новый `QuestRunner` (`src/engine/QuestRunner.js`) — один экземпляр
    на Scene, строится прямо в конструкторе `Scene` (не post-hoc wiring как
    `eventGraphRuntime`/`dialogueRunner`, т.к. нужен только `this`, резолвит
    `this.eventGraphRuntime` лениво на каждый tick). Квесты не модальны (в отличие от Dialogue)
    — несколько активны одновременно. Новый Event Graph action `StartQuest`
    (`params: {questId}`) запускает трекинг; `QuestRunner.tick()` — вызывается из
    `EventGraphRuntime.tick()`, намеренно НЕ новый хук в `GameEngine._update()` (чтобы не
    трогать `GameEngine.js`, пока там были незакоммиченные правки параллельной HUD-сессии) —
    прогоняет `evalSpec(objective.condition, eventGraphRuntime)` для незавершённых objectives
    активных квестов; когда все завершены — статус `'completed'`, `reward` (тот же Effect-формат
    `{type:'giveItem'|'takeItem',...}`, что Dialogue's `effects`) применяется автоматически через
    `scene.getBag()`. Без выделенного `type:'inventoryCount'` условия — objectives по количеству
    предметов зеркалят инвентарь в переменную через `variableModifier`. Без editor UI/quest-log
    HUD виджета — не запрошено в этом срезе (тот же паттерн, что HUD Canvas/Event Graph MVP).
    Тесты: `tests/engine/QuestRunner.test.js` (11), 3 в `tests/engine/Scene.test.js`, 1 e2e в
    `tests/engine/GameEngine.integration.test.js`.
    Следующий приоритет — `saveSchema`/`inputMap`/`musicTrack`/`audioZone`/`tileset`+`tilemap`.
