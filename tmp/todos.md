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
- ✅ **AS-REN / AS-F2 / AS-DBL** — inline rename ассета; F2 panel-aware; dblclick имени
- ✅ **VP-COL** — camera color/name → chrome icon live
- ✅ **VP-FIL** — active filter icon blue
- ✅ **AS-FAV / AS-MMB** — empty favorites hint + MMB close tab
- ✅ **AS-REN-END** — empty/outside click всегда закрывает inline rename (capture pointerdown)
- ✅ **VP-HK** — hotkeys F/A/Grid/Boundaries/Collisions/Parallax → viewport under cursor
- ✅ **VP-EYE** — eye icon in viewport header: per-view Grid/Boundaries/Collisions/Parallax menu
- ✅ **VP-TB** — toolbar copies paired with viewport copies (View toggles + Focus per leaf)
- ✅ **VP-EQ** — viewport peers: no primary display authority; last leaf only non-closeable
- ✅ **OL-F** — F over Outliner: scroll selection into view (multi → avg Y); expand ancestors
- ✅ **DK-ICO** — no leaf detach icon; float via Shift+drag only
- ✅ **DK-CUR** — header drag-gap grab only with Shift; else pointer
- ✅ **DK-GST** — float detach ghost preview on no-target Shift-drag
- ✅ **DK-CLP** — header-gap click collapse when vertical (column) neighbors
- ✅ **VP-BND** — peer zoom no longer reskins boundaries/collisions stroke on sibling views

---

## P0 — баги / регрессии (из `backlog.md` Open)

| # | Задача | Где смотреть | Критерий |
|---|--------|--------------|----------|
| B2 | Проверить dock multi-viewport + Assets×N после polish | browser | 0 console errors; multi-drop все; folders width независим |

---

## P1 — из `backlog.md` Open (приоритетный product)

### Assets

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| A4 | «Open / edit asset» (отдельный editor, если нужен) | stub |
| A5 | Toolbar **panel settings** для Assets | `AssetToolbarController` TODO |

### Viewport / multi-view

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| ~~**VP-HK**~~ | ✅ Хоткеи F/A/G/Boundaries/Collisions/Parallax — viewport **под курсором** | view-scoped displayOptions + camera |
| ~~**VP-EYE**~~ | ✅ Иконка **глаза (View)** в шапке viewport: меню Grid/Boundaries/Collisions/Parallax | chrome рядом cam/filter |
| ~~**VP-TB**~~ | ✅ Копии **Toolbar** для копий viewport, работающие в паре | View toggles + Focus per leaf |

### Outliner

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| ~~**OL-F**~~ | ✅ **F** над Outliner: auto-scroll к selection; multi → average Y | `OutlinerPanel.scrollToSelection` |

### Dock / float UX

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| ~~**DK-ICO**~~ | ✅ Нет иконки отрыва — float через Shift+drag gap | chrome cleanup |
| ~~**DK-CUR**~~ | ✅ Grab на gap только при Shift (`body.dock-customize`) | header cursor |
| ~~**DK-GST**~~ | ✅ Ghost float-окна при no-target Shift-drag | `.float-detach-ghost` |
| ~~**DK-CLP**~~ | ✅ Схлопывание кликом по gap шапки при column-соседях | `leaf.collapsed` |

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

1. **OL-F** / **DK-*** / **VP-BND** ✅  
2. **B2** — browser smoke multi-view / Assets×N  
3. **viewport overlay** (backlog Open)  
4. **U2–U3**, **U4**, **C1–C2** — старый product хвост  
5. **Q\*** / **D\*** — opportunistically  
6. Engine — **не из этого файла**

---

## Как вести этот файл

- Open из `tmp/backlog.md` → строка в P0/P1 с id (**AS-***, **VP-***, **DK-***, …)  
- Закрыто — ✅ + перенос в «Уже закрыто» **и** в Closed `backlog.md`  
- Не тащить сюда Фазы engine (см. ENGINE_PLAN)  
