# План: логические системы редактора (Event Graph / Dialogue / Animation / Sprite Playback / Collision Layers)

> Преемник `tmp/2D_Editor_ENGINE_PLAN.md` (удалён после закрытия — движковый MVP: загрузка, рендер,
> игрок, коллизии, камера, v4.8.1 — достигнут, оставшийся бэклог перенесён в §7 ниже, ничего не
> потеряно). Здесь — то, что нужно классической arcade/adventure игре сверх голого движения:
> связывание объектов уровня логикой, диалоги, анимация, проигрывание спрайт-листов.

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

## Фаза A — Collision layers/mask (фундамент, маленькая)

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

## Фаза B — Sprite sheet playback (независима от графа, самый быстрый видимый результат)

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

## Фаза C — Object Properties окно (нужна раньше графа — негде иначе настраивать компоненты)

Новое окно (аналог существующих doc-панелей, `src/ui/dock/*` паттерн), с 4 вкладками:

- **Components** — список компонентов ассета (аналог Outliner, но для компонентов одного
  объекта, не объектов уровня).
- **Details** — форма параметров выбранного компонента. Для `spriteUiAnimation`-стейт-машины
  (Фаза F) — здесь же форма состояний/переходов, не отдельный canvas.
- **Viewport** — визуальное состояние ассета + интерактивное редактирование формы коллайдера:
  - **2D Box** — 4 угла-ручки + drag offset.
  - **2D Capsule** — ручка radius + ручка height + offset.
  - **Freeform** — полигон: клик — добавить точку, drag точки — двигать, Delete на выделенной
    точке — удалить. Хранится как `properties.points: [{x,y}, ...]` относительно offset.
- **Event Graph** (asset-scope) — см. Фаза D, та же виджет-реализация графа, что и Level Event
  Graph, отличается только `scope: 'asset'` (доступны только `self`-ссылки, не object-picker по
  всем инстансам уровня).

### Undo/redo
Любое редактирование в этом окне (добавление/удаление компонента, форма коллайдера, значения в
Details) идёт через существующий `historyManager.saveState()` — не новый параллельный undo-стек.

**Критерий готовности:** можно выбрать ассет, добавить/удалить компонент, поменять форму
коллайдера на Freeform и подвигать точки, изменения переживают undo/redo и сохраняются в
`Asset.components[].properties`.

---

## Фаза D — Event Graph MVP (ядро)

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

## Фаза E — Dialogue (потребитель графа)

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

## Фаза F — Animation state machine (потребитель графа + Фазы B)

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

A и B независимы — можно делать параллельно/в любом порядке. C логически можно начать сразу
после A (Details/Viewport не ждут графа), но Event Graph-вкладка в С физически зависит от виджета
из D — реализовать C в два захода (сначала Components/Details/Viewport, вкладка Event Graph —
после готовности D).

---

## §7 — Унаследованный бэклог из `ENGINE_PLAN.md` (не потерян, перенесён сюда)

Не покрыто этим документом, остаётся отдельным бэклогом без привязки к фазам A-F:

- **Camera asset** (FOV/zoom/follow-target/bounds, блок 11 каталога) — то, что реализовано в
  этой сессии (`GameEngine._updateCamera`, v4.8.0) — заглушка-плейсхолдер для играбельности,
  не полноценный camera-компонент из `AssetTypes.js`.
- **Компоненты без отдельной фазы**: `pickup`, `damageHealth`, `movablePushable`,
  `mountableVehicleSeat`, `pathFollower`, `spawner`, `checkpointSavePoint`, `climbableLadder`,
  `conveyorZiplineJumpPadPortal`, `destructibleContainer`, `variableModifier` — реализуются по
  мере того, в какие реально упирается конкретная игра (та же дисциплина, что была в
  ENGINE_PLAN §2.3). `stateMachineBehavior` — уточнить при реализации: это AI-стейт-машина NPC
  (patrol/chase), отдельная от анимационной (Фаза F) — общий механизм переходов можно
  переиспользовать, но это не один и тот же компонент.
- **Полный критерий Фазы 4 движка** (было решено сдать минимальным срезом, v4.6.x): eslint-
  plugin-boundaries для границы `engine/`↔остальной `src/`, asset-usage-граф для отсечения
  мёртвого контента в `build:game`, флаг "включено в билд" на уровне, `build:addon`/`build:event`
  — полная реализация вместо заглушек.
- **~20 нереализованных asset-типов** без runtime-поведения (`tileset`, `particleEffect`,
  `navMesh` и т.д., за вычетом того, что теперь покрыто §B/§E: `spriteAnimationClip`,
  `dialogueGraph`) — бэклог `docs/RUNTIME_SCHEMA.md`, без дедлайна.
