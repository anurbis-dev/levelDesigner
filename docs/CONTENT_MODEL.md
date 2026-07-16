# Content Model — Project / Addon / Special Event

Три типа контент-паков движка (`tmp/2D_Editor_ENGINE_PLAN.md`, §0.4, Фаза 0). Движок
(`GameEngine`) грузит не отдельный `level.json`, а `Project` целиком — Engine универсален,
Project = конкретная игра (ассеты + уровни + настройки). Связка `Engine + Project = запущенная
игра`, аналогично паре "движок-бинарник + `project.godot`" у Godot.

**editor-Project vs runtime-Project — не один и тот же объект**, даже с одинаковым названием:

| | editor-Project (`src/models/Project.js`) | runtime-Project (эта дока) |
|---|---|---|
| Что содержит | все уровни, открытые в табах прямо сейчас (черновики тоже) | только явно включённое в релиз |
| Кто пишет | `ProjectFileOperations` | `ProjectExporter` (`src/models/ProjectExporter.js`) |
| `viewState`/`currentLevelIndex` | нужны (UI-состояние вкладок) | не нужны в игре |

`ProjectExporter.export(levelSessions, levelOrder, project, opts)` — единственная точка
перехода editor → runtime. Editor-only поля (`viewState`, `currentLevelIndex`, `fileName`,
`order`, `visible`) в вывод не попадают.

## `levelId` — закрытый вопрос

`Level.toJSON()` **не** сериализует собственный `id` (осознанно, см. комментарий в
`Project.js`) — и не должен ради этой задачи меняться. Каждая `LevelSession` уже хранит
стабильный `id = level.id` (`src/models/LevelSession.js`), не зависящий от файлового пути.
`ProjectExporter` читает этот id из `session.id` и кладёт его в runtime-манифест как
`{ id, data }` на уровень — переопределение Addon'ом по `id` (ниже) опирается на это поле
манифеста, не на сам `level.json`.

## 1. Project (база + патчи)

Не отдельная сущность — сама Project-манифест, версионируется через `formatVersion`
(`ProjectExporter`) и per-level `Level.meta.version` (`docs/RUNTIME_SCHEMA.md`, Versioning).
Обновление игры = замена содержимого runtime-Project более новой версией (целиком или дельта-
патчем конкретных файлов). Не проходит через Addon-механизм ниже — это не расширение, а новая
версия того же контента.

```json
{
  "formatVersion": 1,
  "name": "My Game",
  "entryLevelId": "level_abc123",
  "levels": [
    { "id": "level_abc123", "data": { "...": "Level.toJSON() output" } }
  ]
}
```

## 2. Addon (переопределяющее расширение)

```json
{
  "id": "addon-winter-skins",
  "version": "1.0.0",
  "targetProjectId": "base-game",
  "targetProjectVersion": "^1.4.0",
  "overrides": {
    "assets": { "<assetId>": "path/to/replacement-asset.json" },
    "levels": { "<levelId>": "path/to/replacement-level.json" }
  },
  "additions": {
    "assets": [],
    "levels": []
  }
}
```

Переопределение — **по `id`, не по `path`**. `Asset.id` уже стабилен независимо от пути
(переименование/перенос ассета его не меняет), а `levelId` теперь тоже стабилен и известен
движку через runtime-манифест (см. выше) — оба ключа для override уже есть без изменения
формата `level.json`/`Asset.js`.

Несколько Addon одновременно — явный список с приоритетом (не порядок файлов на диске).
Конфликт двух Addon на один `id` — побеждает выше приоритет, warning в лог загрузки, не
silent overwrite.

## 3. Special Event (параллельный изолированный контент-пак)

```json
{
  "id": "winter-event-2026",
  "version": "1.0.0",
  "requiresProjectId": "base-game",
  "requiresProjectVersion": "^1.4.0",
  "levels": [],
  "rules": {}
}
```

Ключевое отличие от Addon: **никаких `overrides`** — Special Event не трогает содержимое
базового Project, только добавляет отдельный набор уровней/правил, живущий параллельно
основной игре (отдельная точка входа, свой namespace сохранений). Патч на основную игру —
отдельный процесс (новая версия Project), не связан с выпуском/снятием Special Event.

## Порядок загрузки (`ProjectLoader`, Фаза 1 плана движка)

1. Загрузить базовый Project-манифест, построить `assetsById`/`levelsById`.
2. Применить активные Addon по приоритету — `overrides` заменяют записи в реестре по id,
   `additions` добавляют новые.
3. Зарегистрировать Special Event отдельно, в собственном `eventsById` — не сливать с основным
   реестром.
4. Загрузить конкретный уровень (по умолчанию `entryLevelId`).
