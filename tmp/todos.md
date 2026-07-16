# Backlog редактора (после рефакторинга / dock)

**Дата:** 2026-07-16  
**Статус:** живой список «что ещё сделать» в редакторе.  
**Не сюда:** игровой движок — параллельный трек, план только в `tmp/2D_Editor_ENGINE_PLAN.md` (Фаза 0–1 ✅, далее 2–4).  
**Баги:** `tmp/backlog.md` (Open → сюда в P0; Closed — 🟢).

---

## Уже закрыто (не возвращать)

- Рефакторинг v1 (0–7), v2 Фаза A, dock Фаза B (B0–B6)
- Multi-level + Project (v3.57)
- Assets multi-instance UI (selection/tabs/filters/folders resizer независимы)
- PPM удалён; layout = `src/ui/dock/*`
- Хвост: prefs split (`saveEditingPreferences` / `savePanelUiPreferences`), dead `handleAssetClick`
- Лишние docs в `tmp/` вычищены (ENGINE_PLAN + `todos.md` + `backlog.md`)
- 🟢 **B1** — параллакс: `ParallaxRenderer.getParallaxOffset` = `cam × offset` (не `×(1+offset)`); docs −0.8/0/0.5/−1
- 🟢 **A1** — rename ассета (`AssetItemActionsController` + UniversalDialog.prompt)
- 🟢 **A2** — duplicate ассета (clone `addExternalAsset`, temp+unsaved, unique name)
- 🟢 **A3** — delete ассета (confirm; multi if in selection; in-memory; `assetsLibraryDirty`)

---

## P0 — баги / регрессии

Источник: `tmp/backlog.md` Open + свежие UX-находки.

| # | Задача | Где смотреть | Критерий |
|---|--------|--------------|----------|
| B2 | Проверить dock multi-viewport + Assets×N после polish (selection, folders collapse tab, drag→canvas) | browser | 0 console errors; multi-select drop кладёт все; folders width не шарится между копиями |

---

## P1 — редакторный product backlog (не engine)

### Assets

| # | Задача | Файлы / заметки |
|---|--------|-----------------|
| A4 | «Open / edit asset» (если нужен отдельный editor, не только ActorProperties) | stub «asset editor» |
| A5 | Toolbar **panel settings** для Assets | `AssetToolbarController` TODO |

### UX / workflow

| # | Задача | Заметки |
|---|--------|---------|
| U1 | Тип ассета **Level** (если ещё в каталоге/создании) | сверка с `AssetTypes` / Add menu |
| U2 | Tooltips: все подсказки + **актуальные хоткеи** (обновление при смене shortcuts) | Settings Hotkeys ↔ title attributes |
| U3 | **Open Recent…** — Project list / Level list | File menu + userPrefs |
| U4 | Context menu на selection: команды **переноса по слоям** из Details | Canvas / Outliner context |

### Cameras (editor-side, не runtime engine)

| # | Задача | Заметки |
|---|--------|---------|
| C1 | Camera view — что «видит» game camera (рамка / preview) | пересекается с viewport work/game (B4.2 уже есть base) |
| C2 | Настройки камеры: виньетка, bg, aspect (1:1, 4:3, 16:9, …) | editor prefs + gizmo, не play-mode |
| C3 | Несколько камер на уровне + выбор / хоткей | data model на Level; play — engine |
| C4 | Adaptive fit для нестандартных aspect | UI preview only до engine Play |

---

## P2 — качество кода (без новой фичи)

### Сознательно отложено после закрытия рефакторинга (не «дыры в плане»)

Это **не** незакрытые фазы A/B. Рефакторинг закрыт; ниже — **технический долг по желанию**, без дедлайна.

| # | Что | Почему не делали в A/B | Когда трогать | Критерий done |
|---|-----|------------------------|---------------|---------------|
| **Q-DEDUP** | Полный UI-дедуп: context menus (`Asset*`/`Canvas`/`Outliner`…), паттерны Layers↔Levels, dialogs (`BaseDialog`/`Splash`/`DialogStructures`) | B заменял layout, не переписывал панели; jscpd-клоны не блокируют фичи | только если правишь **оба** клона в одной задаче — вынести shared helper, не big-bang sprint | `npm run check:dedup` ↓ по затронутым кластерам; без смены UX |
| **Q-GOD** | Дальнейший split god-files из `scripts/check-file-size.js` **OVERRIDES** (LayersPanel, MouseHandlers, RenderOperations, SettingsPanel, LevelEditor, Details, Toolbar, …) | 400-line guardrail = **не раздувать**, не обязательство «все ≤400»; plan 0–7/B уже вынес что нужно | только **по касанию** файла (фича/баг в том же модуле) → extract Controller/Ops; **не** отдельный «split everything» | файл <400 → **снять** из OVERRIDES; не поднимать лимит |

Топ по размеру (ориентир, 2026-07-16): LayersPanel ~2.1k · MouseHandlers ~2.0k · RenderOperations / SettingsPanel / LevelEditor ~1.4–1.5k · Details / Toolbar / Outliner / AssetPanel ~1.2–1.3k.

**Правило:** не открывать Q-DEDUP / Q-GOD как цель спринта; в порядке работ они **после** P0–P1, и только opportunistically.

### Прочие code stubs

| # | Задача | Критерий |
|---|--------|----------|
| Q3 | Ownership state Asset-контроллеров (меньше plain-мутации `assetPanel`) | по мере правок A1–A5 |
| Q4 | Outliner: inline rename / visibility toggle stubs | `OutlinerPanel` TODO |
| Q5 | Settings tooltip system «when implemented» | `SettingsSyncManager` TODO |

---

## P3 — polish dock / multi-instance (опционально)

| # | Задача |
|---|--------|
| D1 | Persist UI-state копий Assets (tabs/size) per-leaf id — сейчас in-memory only |
| D2 | Независимость Outliner/Details copies по local UI (filters/scroll), если понадобится как у Assets |
| D3 | Float window polish edge-cases (snap + relative resize) — только по багрепортам |

---

## Порядок работ (рекомендуемый)

1. **B2** — browser-проверка multi-viewport / Assets×N  
2. **U2–U3** — discoverability (tooltips + recent)  
3. **A4–A5**, **U1**, **U4**  
4. **C1–C2** — camera editor UX  
5. **Q3–Q5** — stubs по касанию  
6. **Q-DEDUP / Q-GOD** — только opportunistically  
7. Engine — **не из этого файла**

---

## Как вести этот файл

- Новая задача — одна строка в таблице + приоритет P0–P3  
- Закрыто — 🟢 + перенос в «Уже закрыто» (не оставлять ✅-строки в active-таблицах)  
- Баги с шагами — `tmp/backlog.md` Open; при закрытии 🟢 + Closed там и 🟢-строка здесь  
- Не тащить сюда Фазы engine (см. ENGINE_PLAN)  
