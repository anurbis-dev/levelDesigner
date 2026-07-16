# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature **U2**: toolbar + Details stack-order buttons show live hotkeys in native `title` (`Label (Ctrl+S)`); source = Settings → Hotkeys / `shortcuts.json`; respects `ui.showTooltips`; rebind refreshes via `LevelEditor.refreshUiShortcutTitles`.
- Fix: `saveProject()` cached the file name derived from the project's default "Untitled Project" name on first save and kept reusing it forever, so renaming the project via Project Settings afterward had no effect on the saved file name. Now tracked via `Project.fileNameIsAuto` — the name re-derives on every save until pinned by an explicit Save As / Open.
