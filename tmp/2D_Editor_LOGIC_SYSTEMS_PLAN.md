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
  `spriteUiAnimation`. render layers (часть исходного описания в каталоге) не реализованы —
  все слои рендерятся одинаково для любой камеры, не было конкретной потребности.
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
- **Полный критерий Фазы 4 движка** (было решено сдать минимальным срезом, v4.6.x): eslint-
  plugin-boundaries для границы `engine/`↔остальной `src/`, asset-usage-граф для отсечения
  мёртвого контента в `build:game`, флаг "включено в билд" на уровне, `build:addon`/`build:event`
  — полная реализация вместо заглушек.
- **~20 нереализованных asset-типов** без runtime-поведения (`tileset`, `particleEffect`,
  `navMesh` и т.д., за вычетом того, что теперь покрыто §B/§E: `spriteAnimationClip`,
  `dialogueGraph`) — бэклог `docs/RUNTIME_SCHEMA.md`, без дедлайна.
