# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Event Graph UI (Фаза G, level-scope)**: dock contentType `eventGraph` (`src/ui/event-graph/*`) — canvas nodes/edges, add-node palette, params Details, variables list, Play variables watch + runtime `recentNodeIds` highlight. `HistoryManager` snapshots `level.eventGraph` via provider on every `saveState`; undo/redo restores graph. Asset-scope graph still backlog.
