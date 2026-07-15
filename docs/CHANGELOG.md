# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Chore: cleared obsolete `tmp/*` (refactor/dock/perf/multi-level plans, prototype, one-off check scripts); kept only `tmp/2D_Editor_ENGINE_PLAN.md` for parallel engine work.
- Refactor tail: `EditorPreferencesController.saveEditingPreferences` / `savePanelUiPreferences` / `saveAllUserSettings`; Assets type filters single-source (`activeTypeFilters` only); removed dead `handleAssetClick`; OVERRIDES/comments no longer point at deleted plans.
- Assets folders resizer per instance (unique id + owner in ResizerManager); collapse tab on dblclick restore; removed center tongue (`::after`) on panel/dock split lines.
- Assets multi-instance: dock copies UI-independent (`AssetPanel.uiStateKey` → `panelUI.<instanceKey>.*`) — own selection/tabs/filters/view; catalog + canvas drop shared; prefs primary only.
- Engine plan Фаза 0: `docs/RUNTIME_SCHEMA.md` (per-type schema contract, 29 asset + 19 component types) + `docs/CONTENT_MODEL.md` (Project/Addon/Special Event manifest formats) + `ProjectExporter.js` (editor-Project → runtime-Project manifest transform, unused so far) + `Level.meta.version` default `'dynamic'` → `'1.0.0'`.
