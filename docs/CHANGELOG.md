# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **D1**: Assets dock copies persist UI per leaf (`ui.assetCopyUiState[instanceKey]`: tabs, size, viewMode, foldersWidth); primary prefs unchanged; flush on `savePanelUiPreferences`.
- **D2**: Outliner dock copies keep independent type filters (primary only writes `outliner.activeTypeFilters`); search already per-instance.
- **Q-GOD**: `ViewportOperations.js` / `UIFactory.js` back under 400-line guardrail (check:size green without new OVERRIDES).
- **B2**: browser smoke multi-viewport + Assets×N closed (0 editor console errors; multi-drop; folders width independent).
