# Contributing

## Правило перед добавлением новой фичи

Перед тем как писать новый код — найти подходящий существующий Controller/Operations-класс и
добавить логику туда. Создавать новый файл **только если** ни один из существующих не подходит
по ответственности.

Проект прошёл декомпозицию God Object'ов (`LevelEditor.js`, `AssetPanel.js` — см.
`tmp/2D_Editor_REFACTOR_PLAN.md`) и замену layout на dock (`src/ui/dock/*`, Phase B —
`tmp/2D_Editor_REFACTOR_PLAN_v2_PhaseB.md`). Без этого правила файлы снова начнут расти.

Практически:
- Ищи существующий `*Controller`/`*Operations`/`*Manager` с подходящей ответственностью
  (`docs/ARCHITECTURE.md` — карта модулей) прежде чем добавлять метод в `LevelEditor.js` или
  `AssetPanel.js` напрямую.
- Layout/panels: только `editor.dockManager` и модули `src/ui/dock/` (`DockTreeModel`,
  `DockRenderer`, `DockDragController`, `DockContentRegistry`, `DockPanelFactory`, …). Не
  восстанавливать L/R tab shells / `PanelPositionManager`.
- Если ни один не подходит — новый файл нужен, но проверь, не стоит ли сначала выделить общий
  базовый класс (см. `BaseModule`, `BaseManager` как примеры).
- `npm run check:size` — guardrail на рост файлов сверх 400 строк (см.
  `scripts/check-file-size.js`); если файл в `OVERRIDES` перестал превышать лимит, убери его
  из списка.

## Какой базовый класс/паттерн выбрать

- BaseManager (src/managers/BaseManager.js) — если новый класс создаётся в конструкторе
  LevelEditor ДО того, как остальные подсистемы готовы (т.е. не может полагаться на
  this.editor.*), и его жизненный цикл — init()/destroy(). Пример: ConfigManager, CacheManager.
- BaseModule (src/core/BaseModule.js) — если новый класс создаётся ПОСЛЕ инициализации editor
  и его методам нужен доступ к this.editor (level, stateManager, другие Operations/managers).
  Пример: ObjectOperations, GroupOperations, LevelFileOperations.
- Голый constructor(owner) без общей базы — только для одного sub-controller, выносимого из
  конкретной панели/менеджера (owner), если это первый такой sub-controller у owner.
- Общий базовый класс для sub-controllers — как только у owner появляется ВТОРОЙ
  sub-controller (декомпозиция продолжается) — создать общую базу для этой группы сразу
  (исторический пример: удалённый `PanelSubController` у legacy panels; для dock — держать
  логику в существующих `src/ui/dock/*` модулях, не плодить параллельный layout-стек).

## Периодическая проверка деградации

Раз в 2–4 недели (не часть `npm run check`, ручной прогон):

```
npx madge --circular src
npx jscpd src --min-lines 15
```

Дёшево, ловит появление циклических зависимостей и дублирования кода на раннем этапе, до того
как оно разрастётся в очередной God Object.
