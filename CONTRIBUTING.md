# Contributing

## Правило перед добавлением новой фичи

Перед тем как писать новый код — найти подходящий существующий Controller/Operations-класс и
добавить логику туда. Создавать новый файл **только если** ни один из существующих не подходит
по ответственности.

Проект прошёл полную декомпозицию God Object'ов (`LevelEditor.js`, `AssetPanel.js`,
`PanelPositionManager.js` — см. `tmp/2D_Editor_REFACTOR_PLAN.md`), и без этого правила файлы
снова начнут расти теми же темпами, какими они выросли до рефакторинга.

Практически:
- Ищи существующий `*Controller`/`*Operations`/`*Manager` с подходящей ответственностью
  (`docs/ARCHITECTURE.md` — карта модулей) прежде чем добавлять метод в `LevelEditor.js` или
  `AssetPanel.js` напрямую.
- Если ни один не подходит — новый файл нужен, но проверь, не стоит ли сначала выделить общий
  базовый класс (см. `BaseModule`, `BaseManager`, `PanelSubController` как примеры).
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
- PanelSubController-подобный общий класс — как только у owner появляется ВТОРОЙ
  sub-controller (т.е. декомпозиция панели/менеджера продолжается) — создать общий базовый
  класс для этой группы сразу, а не после третьего-четвёртого файла. Не дожидаться, пока
  копипаста в конструкторах/getter-ах наберётся сама.

## Периодическая проверка деградации

Раз в 2–4 недели (не часть `npm run check`, ручной прогон):

```
npx madge --circular src
npx jscpd src --min-lines 15
```

Дёшево, ловит появление циклических зависимостей и дублирования кода на раннем этапе, до того
как оно разрастётся в очередной God Object.
