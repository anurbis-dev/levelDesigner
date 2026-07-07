# План: убрать точечные updateAllPanels() — реактивные обновления панелей навсегда

Создано: 2026-07-07
Источник: диалог про баг Isolate/Outliner (ObjectOperations.toggleIsolateSelection() не звал updateAllPanels())
Цель: чтобы автор новой команды (объекты/слои) НЕ должен был помнить о панелях — это должно происходить сам

---

## Диагноз (для контекста, не переоткрывать)

`StateManager` (src/managers/StateManager.js) **уже реактивен** — есть `subscribe/notifyListeners`, и UI-состояние (`selectedObjects`, `camera`, `view.*`) уже работает через него: панели подписываются сами (см. `DetailsPanel.js:35`, `OutlinerPanel.js:146,150`, `LayersPanel.js:100-145`).

Но **граф уровня** (`Level.objects`, `Level.layers`) живёт вне StateManager — это plain-mutable структуры, и `Level.addObject()`/`removeObject()` (src/models/Level.js:148,194) их меняют напрямую, без уведомлений. Поэтому единственный способ панелям узнать об изменении — imperative `this.editor.updateAllPanels()`, который **каждая мутирующая операция обязана вызвать сама**. Сейчас таких вызовов ~30, разбросанных по:

- `src/core/ObjectOperations.js:492,597,630,699`
- `src/core/GroupOperations.js:207` (+ мест, где комментарий говорит "не нужно, вызывается внутри")
- `src/core/LayerOperations.js:54`
- `src/core/DuplicateOperations.js:398`
- `src/core/HistoryOperations.js:170`
- `src/core/LevelFileOperations.js:88,152`
- `src/core/BaseModule.js:79,215`
- `src/event-system/MouseHandlers.js` (12 мест), `EventHandlers.js` (2 места)
- `src/ui/LayersPanel.js:1857,1866,1948`
- `src/ui/BaseContextMenu.js:172`

Забыть один вызов = баг (пример: Isolate не обновлял Outliner до следующего клика). Это и есть фундаментальная проблема — обновление панелей зависит от памяти автора кода, а не от механизма.

**Важная находка**: паттерн решения уже существует в кодовой базе как прецедент — `Level.setLayerObjectsCountChangeCallback()` (src/models/Level.js:713) + `LevelEditor.js:1618` пробрасывает его в `stateManager.notifyLayerObjectsCountChanged()`, на который подписан `LayersPanel.js:122`. Задача — **генерализовать этот же паттерн** на все структурные изменения уровня (add/remove object, add/remove/reorder layer), а не изобретать новый механизм.

---

## Целевая архитектура

1. `Level` получает единый callback-хук `onLevelStructureChanged(changeType, payload)` (аналогично `onLayerObjectsCountChanged`), вызываемый из:
   - `addObject()` (Level.js:148) — `changeType: 'objectAdded'`
   - `removeObject()` (Level.js:194) — `changeType: 'objectRemoved'`
   - `addLayer()` (Level.js:301), `removeLayer()` (Level.js:319), `reorderLayers()` (Level.js:383) — `changeType: 'layerChanged'`
   - Новый метод `removeObjects(ids)` / `replaceObjects(newArray)` — заменяет все места, где сейчас код делает `this.editor.level.objects = this.editor.level.objects.filter(...)` в обход `Level`-методов (см. "Прямые мутации в обход Level" ниже). **Это критично** — без замены этих мест реактивность не покроет их, и баг того же класса вернётся.

2. `LevelEditor` (по аналогии с `LevelEditor.js:1618`) подключает callback один раз при инициализации:
   ```
   this.level.setStructureChangeCallback((changeType, payload) => {
       this.stateManager.notify('levelStructureChanged', { changeType, payload });
   });
   ```
   Дёшево — НЕ deep-clone уровня (в отличие от `LayerOperations.js:58`, который зря делает `JSON.parse(JSON.stringify(level))` только чтобы уведомить панели — эту строку тоже заменить на новый механизм и убрать дорогой clone).

3. Панели подписываются САМИ на `'levelStructureChanged'` (плюс уже существующий `'level'` для полной замены уровня) — `OutlinerPanel`, `LayersPanel`, `DetailsPanel`, level-stats-panel. Один subscribe в конструкторе каждой панели, `render()` в колбэке — паттерн уже есть, просто добавить.

4. **Батчинг**: если одна операция дёргает `addObject()` 50 раз (Duplicate 50 объектов), нельзя рендерить панель 50 раз. Добавить в `StateManager` тот же приём, что уже используется для `_needsRender` (перед рендер-циклом): `_pendingLevelChange = false`, `notifyLevelStructureChangedBatched()` — ставит флаг и планирует `queueMicrotask`/`requestAnimationFrame` один раз за тик; повторные вызовы в течение тика схлопываются. Панели подписываются на итоговый один вызов на операцию, а не на каждый addObject().

5. После этого **удалить** явные `this.editor.updateAllPanels()` из всех операций в списке выше, которые вызываются только из-за add/remove object/layer. Оставить `updateAllPanels()` как метод (используется в местах, не связанных со структурой уровня — например, после `openLevel()`/`newLevel()`, где меняется вообще всё, и там `updateCachedLevelStats()`+полный ререндер оправданы явным вызовом).

---

## Прямые мутации в обход Level (обязательно закрыть — иначе реактивность не полна)

Эти места меняют `level.objects` напрямую, а не через `Level.addObject/removeObject` — при переходе на реактивность их нужно завести на новый метод `Level.removeObjects(ids)`:

- `src/core/GroupOperations.js:265,592,646` — `this.editor.level.objects = this.editor.level.objects.filter(...)`
- `src/core/ObjectOperations.js:459` — то же самое (delete)
- `src/core/HistoryOperations.js:86` — `this.editor.level.objects = objectsData.map(...)` (undo/redo restore — это уже полноценная замена уровня, тут ок оставить явный `updateAllPanels()` после, т.к. это massive restore, не точечная мутация)

Для GroupOperations/ObjectOperations — завести `Level.removeObjects(idsSet)`, которая один раз фильтрует массив и один раз уведомляет (не 1 уведомление на объект).

---

## Порядок работы (для новой сессии)

1. **Level.js**: добавить `onLevelStructureChanged` callback + `setStructureChangeCallback()`, вызовы из `addObject`, `removeObject`, `addLayer`, `removeLayer`, `reorderLayers`; добавить `removeObjects(ids)` (batched, один callback-вызов).
2. **GroupOperations.js / ObjectOperations.js**: заменить прямые `level.objects = ...filter(...)` на `level.removeObjects(ids)` (строки указаны выше).
3. **LevelEditor.js**: рядом с существующим `setLayerObjectsCountChangeCallback` (строка ~1618) подключить `setStructureChangeCallback` → `stateManager.notify('levelStructureChanged', ...)` с батчингом через микротаск (см. п.4 архитектуры).
4. **StateManager.js**: добавить batched-notify обёртку (по образцу `_needsRender`/`consumeNeedsRender`).
5. **OutlinerPanel.js, LayersPanel.js, DetailsPanel.js**: подписаться на `'levelStructureChanged'` → `this.render()`. Проверить, что существующая подписка на `'level'` не дублирует рендер в одном тике (если и `'level'`, и `'levelStructureChanged'` выстрелят вместе — батчинг из п.4 должен схлопывать оба в один рендер-тик; если нет — оставить только `'levelStructureChanged'` для точечных изменений и `'level'` только для полной замены уровня).
6. **Убрать явные updateAllPanels()**: пройтись по списку файлов из раздела "Диагноз" — оставить только те вызовы, что относятся к чисто UI-состоянию, не проходящему через Level (например, `LayersPanel.js:1857,1866,1948` — если это про UI слоёв, не про сам граф, проверить индивидуально перед удалением).
7. **LayerOperations.js:58**: убрать дорогой `JSON.parse(JSON.stringify(this.editor.level))` — заменить на обычный вызов операции слоя (addLayer/removeLayer/reorderLayers), который теперь сам уведомит через новый механизм.

---

## Верификация (по правилам проекта — CLAUDE.md, tier "Standard")

Через chrome-devtools MCP (`evaluate_script` на живом `editor`):
1. Создать/удалить объект программно — Outliner/Layers/Details обновились без ручного клика.
2. Duplicate 20+ объектов одной операцией — панель отрендерилась 1 раз, не 20 (замерить через monkey-patch счётчика `render()`/`OutlinerPanel.render`, аналогично примеру в `tmp/PERF_FIXES_PLAN.md`).
3. Isolate/Solo/группировка/разгруппировка/undo-redo — все панели синхронны без доп. клика (регрессия на баг, из-за которого весь разговор начался).
4. `list_console_messages` — 0 ошибок.

## Риски

- Средний объём изменений (Level.js — ядро модели, трогать осторожно, покрыто ли тестами — нет автотестов, только browser-console, см. TestGenerator агент).
- Если где-то код рассчитывает на синхронный updateAllPanels() сразу после мутации (не дожидаясь микротаска) — найти такие места по regressions при browser-верификации п.2 плана (Isolate-баг — ровно такой случай).
- Не путать с `_needsRender` (рендер канвы, per-frame) — это отдельный механизм, не трогать.
