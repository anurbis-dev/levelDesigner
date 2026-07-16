# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature **U3**: File → **Open Recent** — MRU levels/projects (up to 10) with JSON snapshot in `userPrefs` / `editor.recentFiles`; open/save level or project records the list; browser has no path, so re-open uses the cache (`RecentFilesManager`). Submenu rebuilds on hover; **Clear Recent**.
