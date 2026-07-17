# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Event Graph UI (Фаза G, level-scope)**: dock contentType `eventGraph` (`src/ui/event-graph/*`) — canvas nodes/edges, add-node palette, params Details, variables list, Play variables watch + runtime `recentNodeIds` highlight. `HistoryManager` snapshots `level.eventGraph` via provider on every `saveState`; undo/redo restores graph. Asset-scope graph still backlog.
- **Camera asset/component (§7 backlog closed)**: `camera` component (`followTargetId`/`deadzoneWidth`/`deadzoneHeight`/`bounds`) + `CameraBehavior` — `GameEngine._updateCamera()` follows a placed camera marker with deadzone and clamps to `bounds`; falls back to the old hard-center-on-player when a level has no camera marker (backward compatible). Marker hidden at runtime like `playerStart`. No dedicated UI yet — generic Details JSON, same as `spriteUiAnimation`.
