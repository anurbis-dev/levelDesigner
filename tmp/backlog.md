# Open bugs & features

Источник живых багов и фичей для `tmp/todos.md`.  
Маркер: ✅ = закрыто (в Closed).

## Open

*(пусто — optional: Q-DEDUP / Q-GOD by-touch, Q3 ownership, D3 float bugs)*


## Closed (архив)

✅ D1 — Assets copy UI persist `ui.assetCopyUiState[instanceKey]` (tabs/size/viewMode/foldersWidth)  
✅ D2 — Outliner copy type filters independent; Details selection shared by design  
✅ Q-GOD partial — ViewportOperations + UIFactory under 400 lines  
✅ Q4 / Q5 / VW-EYE? — closed as already done / by design  
✅ B2 — browser smoke multi-viewport + Assets×N  
⏭ A4 — dedicated asset editor skipped (no product scope)  
✅ A5 — Assets Panel Settings opens Settings on Assets tab (`SettingsPanel.show('assets')` / `openSettings(tab)`)  
✅ C4 — adaptive fit: design frustum fills letterbox safe-rect on any viewport size/aspect (UI preview; `CameraAspectUtils`)  
✅ C3-toggle — cam icon click + `.` toggle work ↔ last/selected game; chrome icon refresh on setSource  
✅ C3 — multi camera: `properties.isMain` (Details Main), cycle `]`/`[`, jump fallback main, chrome ★, gold frustum  
✅ C2 — aspect presets + letterbox/vignette на game-source viewport; Details Aspect/Resolution/Vignette  
✅ C1 — рамка game camera: dashed frustum (design res / zoom) + cross; skip active viewport source  
✅ TB-OP — прозрачность подложки тулбара: Settings slider `ui.toolbarBackgroundOpacity` → `--ui-toolbar-background-color`  
✅ DK-CLS — крестик закрытия leaf только при Shift (`body.dock-customize`) и hover шапки этой панели  
✅ VW-NOVP — View menu: Viewport toggle removed (cannot disable last viewport leaf)  
✅ VW-ALL — View menu Grid/Boundaries/Collisions/Parallax apply to all viewport copies (`setDisplayFlagAll`); eye/toolbar/hotkeys remain per-view  
✅ OL-CTX — Outliner RMB: Select removed; Toggle Visibility uses `toggleVisibilityForSelection` (H-path)  
✅ OL-EMPTY — Outliner empty-space click clears selection (any copy)  
✅ U4 — Context menu Move to Layer (Canvas/Outliner; LayerOperations.moveSelectedObjectsToLayerId)  
✅ U3 — File → Open Recent (MRU level/project snapshots in editor.recentFiles; RecentFilesManager)  
✅ U2 — toolbar/Details titles = live hotkeys from Settings; ui.showTooltips; refreshUiShortcutTitles  
✅ VP-OVL — оверлей HUD на viewport: cam/zoom/флаги P·B·C / stats; eye **Info**; `ViewportInfoOverlay`  
✅ VP-BND — zoom соседнего viewport не меняет thickness boundaries/collisions/hit-test на текущем (`strokeFrame` + frame camera, не focused `stateManager.camera`)  
✅ DK-CLP — схлопывание leaf кликом по header gap при column-соседях (`leaf.collapsed`)  
✅ float viewport chrome menus — `MenuPositioningUtils` z-index 10000 поверх `#floating-layer`  
✅ DK-GST — ghost float-окна при Shift-drag без dock target (`.float-detach-ghost` + `floatDetachLayoutFromClient`)  
✅ DK-CUR — grab cursor на leaf header gap только при Shift (`body.dock-customize`); иначе pointer  
✅ DK-ICO — иконка отрыва панели в окно убрана; float только Shift+drag gap  
✅ OL-F — F над Outliner: scrollToSelection (single center / multi average Y); expand collapsed ancestors  
✅ VP-EQ — viewport peers: display/filter/camera не протекают с «главного»; last leaf non-closeable  
✅ VP-TB — копии тулбара для копий viewport, View toggles + Focus paired с leaf  
✅ VP-EYE — иконка глаза в шапке viewport: меню Grid/Boundaries/Collisions/Parallax per-view  
✅ VP-HK — хоткеи F/A/Grid/Boundaries/Collisions/Parallax на viewport под курсором (view-scoped displayOptions + camera)  
✅ AS-REN-END — inline rename: клик в пустое / вне input всегда закрывает поле (capture pointerdown)  
✅ AS-FAV/MMB — empty favorites «Drop favorite folders here»; MMB closes favorite tab  
✅ VP-COL — color/name game camera → live refresh chrome icon (`refreshAllViewportChrome`)  
✅ VP-FIL — active viewport type-filter icon blue (`viewport-filter-active`)  
✅ AS-REN/F2/DBL — inline rename ассета (без dialog); F2 над Assets → library asset; dblclick имени → rename  
✅ регрессия MMB zoom viewport — `MouseHandlers` early-return по `.leaf-body` глотал canvas (dock); `_shouldDeferMiddleMouseToPanel` исключает viewport canvas  
✅ параллакс первого слоя слишком сильный — `getParallaxOffset` использовал `cam×(1+offset)` вместо `cam×offset`  
✅ ctrl на меню фильтров не стабильно работает если увести мыш и на включение  
✅ убрать все контекстные переключения имени таба Details — всегда Details  
✅ уровни в панели Levels, не Layers  
✅ выравнивание пунктов View  
✅ добавляемые слои скрыты пока не кликнешь  
✅ soloed уровней Ctrl+click на глазу  
✅ повёрнутая группа: bounds / click-out close  
✅ undo групп — лишний шаг  
✅ ungroup / cut — тяжёлая перерисовка  
✅ auto apply settings сбрасывался  
✅ имена фолдеров Content — перенос  
✅ filter menu Outliner offset  
✅ isolation mode Outliner  
✅ New Level + console hotkey  
✅ hotkeys только через settings  
✅ tab drag persist  
✅ new level dirty confirm  
✅ solo layers style stick  
✅ object flash on add to group  
✅ duplicate into open group  
✅ ungroup child transforms  
