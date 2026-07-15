# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **B2 (Phase B dock):** viewport leaf hosts real toolbar + canvas (`DockContentRegistry._mountViewport`); canvas reparented into `#canvas-viewport` (leaf measure, not full-screen absolute); ResizeObserver always on measure host; `resizeCanvas` dock-hosted fill path.
- Fix dock: horizontal (`resizer-row`) splitters hit-target — reset global `.resizer { width: 6px }` via `width: auto; align-self: stretch`.
- Fix dock: removed debug `#dock-chips` strip (blocked main menu dropdowns; reopen via `dockManager.showContentType` / View later).
- **B1 (Phase B dock):** `DockContentRegistry` (6 singleton types, placeholder mount); `DockPersistence` (`panels.dock.mainTree` / `panels.dock.floatingWindows`); chips only for missing types; viewport non-closeable + chip reopen; no type-menu/duplicate-on-drag; default tree includes assets as bottom strip; `DockFloatOps` extracted for size limit.
