# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Docs: ARCHITECTURE / Context_map / EVENT_HANDLER_SYSTEM — Phase B dock B3–B4.2 multi-viewport, gestures, TypeFilterMenu, English chrome UI.
- Viewport camera source menu + chrome tooltips: English only (Work camera / Game camera / empty state).
- Fix multi-view pan cursor leak: RMB/MMB no longer stamp `grabbing`/`zoom-in` on primary while secondary pans; end/blur resets cursors on all viewport canvases.
- Viewport leaf chrome (cam / filter): after first open, hover over sibling icon switches menus (main-menu style); leave chrome+menu exits hover mode.
- Viewport gestures (object drag / marquee / transform / pan / zoom) continue outside the leaf: left-button `setPointerCapture`; release outside completes (does not cancel) via same path as canvas mouseup; `viewport-gesture-mode` blocks hover on other dock/UI during the gesture.
- Fix multi-viewport object flicker while dragging: `visibleObjectsCache` key includes canvas size (shared camera ≠ shared frustum); during drag/transform/marquee sticky cache + full cull scan instead of stale spatial index TTL rebuilds; refresh spatial/visible cache on drag end.
- Fix pick/marquee under cursor (multi-view + dock CSS): `screenToWorld`/`worldToScreen` map client→buffer when canvas CSS is `100%` but buffer is floor(measure); `getSelectableObjectsInViewport` uses interaction camera/canvas (not primary-only); hit-test/click-cycle tolerance uses interaction zoom — restores rotated-object math vs wrong frustum/zoom.
- Viewport close (×): all viewports closeable when ≥2 exist (not only copies); promote former copy to primary shell if primary closed.
- Camera/type menus: `alignment:right` + `repositionMenu` after fill (flush under icon, not far left from guessed width).
- Leaf header: title/caret `cursor:pointer` + type menu only; grab/drag only on empty gap between title and right icons.
- Fix multi-viewport pick/drag: world coords use interaction leaf canvas (not primary after render restore); global mouseup/move bounds + left-drag continue on secondary; wheel no longer sticky-pins wrong leaf; marquee overlay only on interaction view.
- Fix viewport copy close (×): append after mount via `isLeafCloseable`.
- Fix: `AssetPanel.getActiveTabPath()` restored — Add menu / `createAssetOfType` no longer always see Content root.
- Type filters (Outliner / Assets / Viewport): shared `TypeFilterMenu` — toggle applies immediately, menu stays open, no Ctrl multi-session.
- Fix viewport chrome: camera icon default + re-sync after mount (self-drop clone no longer blank cam btn).
- Dock leaf header: grab/drag only on title strip (`.drag-handle`); type-menu only on title text; viewport camera btn — gray minimal SVG for work cam, stroke tinted with game camera object `color`.
- **B4.2 multi-viewport:** `ViewportViewManager` — work camera (`stateManager.camera` on primary) vs game cameras (level objects `type===camera`); N viewport leaves with independent canvas/pose/type-filters; leaf header camera source + filter; secondary uses same `MouseHandlers` as primary (RMB pan, MMB zoom, wheel); pointer-capture + global move so pan/zoom continues outside leaf; canvas bg fills leaf; self-drop viewport clone; primary non-closeable when sole, copies closeable.
- **B4 (Phase B dock):** multi-instance panel copies — `singleton:false` for outliner/details/layers/levels/assets; roots/instances keyed by leaf `node.id`; `DockPanelFactory` creates secondary panel instances; close copy → destroy, close primary → park; type-menu allows second multi leaf (`+`) / singleton still swaps (`⇄`); panel `instanceKey` for search/context-menu ids.
- Layers/Levels list reorder: empty insertion slot under cursor during drag (`ListReorderPlaceholder`); drop order from slot index.
- Fix list reorder: do not collapse row in `dragstart` (aborts HTML5 DnD); collapse on first `dragover`; `dataTransfer.setData` + `closest` row.
- Fix: middle-click drag scroll on Levels/Details — list/root got real `overflow:auto` (dock roots were `overflow:hidden` with no inner scroller); both axes; Levels/Layers reuse list node for stable pan target.
- Panel scrollbars: setting `ui.scrollbarSize` (1–24px, default 2) in UI Settings; runtime `#ui-scrollbar-runtime-styles` with !important; removed `scrollbar-color`/`scrollbar-width:thin` on Chromium (they forced system-thick bars); no 6px floor; console/BasePanel hard-coded 8/6px overrides removed.
- Middle-pan `panning-mode` kills hover on other UI.
- Default layer color: `#F5E6A3` (pale yellow) instead of blue.
- List color swatch: `color.shape` (`circle`|`square`) in `createListItemRow`; shared `.list-color-swatch--*`; layers circle / levels square; fill stays panel-specific.
- **B3.1 (Phase B dock):** View → Panels lists dock contentTypes (Viewport/Outliner/Details/Layers/Assets/Levels) instead of Left/Right/Assets Panel; `DockManager.hideContentType`/`toggleContentType` + menu sync on structure change; Alt+1/2/4 → Outliner/Details/Assets; Immersive Mode uses dock layout snapshot (viewport-only), not legacy L/R flags.
- **B3 (Phase B dock):** primary panels (Outliner/Details/Layers/Levels/Assets) reparent into dock leaves via `DockContentRegistry._mountPrimaryPanel`; assets no longer fixed footer (`#resizer-assets` hidden; auto-height / prefs / View visibility skipped when dock active); leaf fill CSS for panel roots.
- Fix dock: restored leaf content-type menu (tap title/caret; singleton swap `⇄`); `DockTypeMenu.js`.
- Fix dock: restored self-drop duplicate (drop on own leaf → clone + split), as in prototype.
