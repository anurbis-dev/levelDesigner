# Backlog редактора (после рефакторинга / dock)

**Дата:** 2026-07-16  
**Статус:** живой список «что ещё сделать» в редакторе.  
**Не сюда:** игровой движок — параллельный трек, план только в `tmp/2D_Editor_ENGINE_PLAN.md` (Фаза 0–1 ✅, далее 2–4).  
**Источник свежих пунктов:** `tmp/backlog.md` Open → сюда (P0/P1). Closed в backlog = ✅.

---

## Уже закрыто (не возвращать)

- Рефакторинг v1 (0–7), v2 Фаза A, dock Фаза B (B0–B6)
- Multi-level + Project (v3.57)
- Assets multi-instance UI (selection/tabs/filters/folders resizer независимы)
- PPM удалён; layout = `src/ui/dock/*`
- Хвост: prefs split (`saveEditingPreferences` / `savePanelUiPreferences`), dead `handleAssetClick`
- Лишние docs в `tmp/` вычищены (ENGINE_PLAN + `todos.md` + `backlog.md`)
- ✅ **B1** — параллакс: `getParallaxOffset` = `cam × offset`
- ✅ **A1–A3** — rename (dialog) / duplicate / delete ассета  
  *(A1 dialog — временно; см. **AS-REN** — заменить на inline как Outliner)*
- ✅ **VP-MMB** — MMB zoom: canvas внутри `.leaf-body` больше не глотает middle-drag

---

## P0 — баги / регрессии (из `backlog.md` Open)

| # | Задача | Где смотреть | Критерий |
|---|--------|--------------|----------|
| B2 | Проверить dock multi-viewport + Assets×N после polish | browser | 0 console errors; multi-drop все; folders width независим |
| **VP-COL** | Смена цвета camera → иконка в шапке viewport **сразу** (сейчас только после выбора камеры в меню) | viewport chrome / camera color | live color sync без re-select |
| **VP-FIL** | Иконка активного type-filter viewport — **синяя**, как фильтры в других панелях | ViewportView chrome | цвет active = panel filter style |

---

## P1 — из `backlog.md` Open (приоритетный product)

### Assets

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| **AS-REN** | Rename **inline** (поле имени), не dialog; убрать prompt-окно A1 | как Outliner; context Rename + F2 + dblclick на имени |
| **AS-F2** | **F2** с учётом панели под курсором: над Assets → rename ассета в библиотеке | hover panel hit-test; не глобальный rename level-object |
| **AS-DBL** | Dblclick на **имени** ассета → inline rename | не путать с open properties (dblclick thumbnail?) |
| **AS-FAV** | Favorites drop-zone: если пусто — серый текст «Drop favorite folders here» | tabs strip empty state |
| **AS-MMB** | Удаление закладки favorite-folder **средним кликом** | middle-click tab close |
| A4 | «Open / edit asset» (отдельный editor, если нужен) | stub; ниже AS-REN |
| A5 | Toolbar **panel settings** для Assets | `AssetToolbarController` TODO |

### Viewport / multi-view

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| **VP-HK** | Хоткеи **F, A, Grid, Boundaries, Collisions, Parallax** — на viewport **под курсором** | не только primary; view-scoped state |
| **VP-EYE** | В шапку viewport — иконка **глаза (View)**: меню состояний (collisions, boundaries, grid, parallax, …) | chrome рядом cam/filter |
| **VP-TB** | Копии **Toolbar** для копий viewport, работающие в паре | multi-view: toolbar ↔ active view |

### Outliner

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| **OL-F** | **F** над Outliner: auto-scroll к selection; multi → усреднять позицию | frame selection in list |

### Dock / float UX

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| **DK-ICO** | Убрать иконку «отрыв в окно» — достаточно Shift-layout | chrome cleanup |
| **DK-GST** | При отрыве + hover zone float — **ghost** будущего окна | preview rect before drop |
| **DK-CUR** | Курсор grab на шапке **только при Shift** (edit layout); иначе pointer (клик) | header cursor |
| **DK-CLP** | Схлопывание панели кликом по шапке, если есть соседи сверху/снизу | accordion collapse |

### UX / workflow (старый хвост)

| # | Задача | Заметки |
|---|--------|---------|
| U1 | Тип ассета **Level** (если ещё в каталоге/создании) | `AssetTypes` / Add menu |
| U2 | Tooltips + **актуальные хоткеи** | Settings Hotkeys ↔ title |
| U3 | **Open Recent…** Project / Level | File menu + userPrefs |
| U4 | Context menu selection: **перенос по слоям** | Canvas / Outliner |

### Cameras (editor-side)

| # | Задача | Заметки |
|---|--------|---------|
| C1 | Camera view — рамка / preview «что видит» game camera | base B4.2 |
| C2 | Виньетка, bg, aspect (1:1, 4:3, 16:9, …) | editor prefs + gizmo |
| C3 | Несколько камер + выбор / хоткей | Level data; play — engine |
| C4 | Adaptive fit нестандартных aspect | UI preview only |

---

## P2 — качество кода (без новой фичи)

### Сознательно отложено

| # | Что | Когда трогать | Критерий done |
|---|-----|---------------|---------------|
| **Q-DEDUP** | UI-дедуп context menus / dialogs | по касанию обоих клонов | `check:dedup` ↓ |
| **Q-GOD** | split god-files из OVERRIDES | по касанию файла | &lt;400 → снять OVERRIDES |

### Прочие stubs

| # | Задача | Критерий |
|---|--------|----------|
| Q3 | Ownership state Asset-контроллеров | по мере AS-* / A4–A5 |
| Q4 | Outliner inline rename / visibility stubs | пересекается с OL-F / F2-паттерном |
| Q5 | Settings tooltip system | `SettingsSyncManager` |

---

## P3 — polish dock / multi-instance (опционально)

| # | Задача |
|---|--------|
| D1 | Persist UI-state копий Assets (tabs/size) per-leaf id |
| D2 | Независимость Outliner/Details copies (filters/scroll) |
| D3 | Float edge-cases (snap + relative resize) — по багрепортам; см. также **DK-GST** |

---

## Порядок работ (рекомендуемый)

1. **AS-REN / AS-F2 / AS-DBL** — inline rename + F2/panel-aware (заменяет dialog A1)  
2. **VP-COL / VP-FIL** — быстрые viewport chrome баги  
3. **AS-FAV / AS-MMB** — favorites UX  
4. **VP-HK / VP-EYE / VP-TB** — multi-viewport input + chrome + toolbar pair  
5. **OL-F** — F over Outliner scroll  
6. **DK-ICO / DK-CUR / DK-GST / DK-CLP** — dock polish  
7. **B2** — browser smoke multi-view / Assets×N  
8. **U2–U3**, **U4**, **C1–C2** — старый product хвост  
9. **Q\*** / **D\*** — opportunistically  
10. Engine — **не из этого файла**

---

## Как вести этот файл

- Open из `tmp/backlog.md` → строка в P0/P1 с id (**AS-***, **VP-***, **DK-***, …)  
- Закрыто — ✅ + перенос в «Уже закрыто» **и** в Closed `backlog.md`  
- Не тащить сюда Фазы engine (см. ENGINE_PLAN)  
