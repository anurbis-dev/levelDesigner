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
- ✅ **VP-OVL** — per-view DOM info overlay (cam/zoom/flags/stats); eye menu Info
- ✅ **U2** — tooltips + live hotkeys on toolbar / Details order (`title` ↔ Settings Hotkeys)
- ✅ **U3** — Open Recent Project/Level (File menu + `editor.recentFiles` snapshot cache)
- ✅ **U4** — Context menu selection: Move to Layer (Canvas / Outliner)
- ✅ **OL-EMPTY** — click empty Outliner (any copy) clears selection
- ✅ **VW-NOVP** — View menu: no Viewport toggle (last leaf non-closeable)
- ✅ **VW-ALL** — View menu Grid/Boundaries/Collisions/Parallax → all viewport copies
- ✅ **OL-CTX** — Outliner RMB: no Select; Toggle Visibility → selection (H-path)
- ✅ **TB-OP** — Settings: toolbar underlay opacity slider (`ui.toolbarBackgroundOpacity`)
- ✅ **C1** — camera view frame gizmo (frustum dashed rect + cross; design res / zoom)
- ✅ **C2** — aspect presets + letterbox/vignette on game viewport; Details Aspect/Res/Vignette

---

## P0 — баги / регрессии (из `backlog.md` Open)

| # | Задача | Где смотреть | Критерий |
|---|--------|--------------|----------|
| B2 | Проверить dock multi-viewport + Assets×N после polish | browser | 0 console errors; multi-drop все; folders width независим |
| VW-EYE? | Eye/toolbar per-view vs main menu global — ok by design; recheck if user meant eye→all | browser | — |

---

## P1 — из `backlog.md` Open (приоритетный product)

### Assets

| # | Задача | Заметки / критерий |
|---|--------|-------------------|
| A4 | «Open / edit asset» (отдельный editor, если нужен) | stub |
| A5 | Toolbar **panel settings** для Assets | `AssetToolbarController` TODO |

### Cameras (editor-side)

| # | Задача | Заметки |
|---|--------|---------|
| ~~C1~~ | ~~Camera view frame~~ | ✅ |
| ~~C2~~ | ~~Aspect / vignette / letterbox~~ | ✅ |

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
| Q4 | Outliner inline rename / visibility stubs | rename ok; visibility via H/menu |
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

1. ~~VW-NOVP / VW-ALL / OL-CTX~~ ✅  
2. **B2** — browser smoke multi-view / Assets×N  
3. ~~C1–C2~~ ✅  
4. **Q\*** / **D\*** — opportunistically; next product **C3** / **A4–A5**  

5. Engine — **не из этого файла**

---

## Как вести этот файл

- Open из `tmp/backlog.md` → строка в P0/P1 с id (**AS-***, **VP-***, **DK-***, …)  
- Закрыто — ✅ + перенос в «Уже закрыто» **и** в Closed `backlog.md`  
- Не тащить сюда Фазы engine (см. ENGINE_PLAN)  
