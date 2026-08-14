# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Project-folder content sync + folder CRUD (v4.52.0)**: `FsaContentFs` + `AssetFolderOps` + `FoldersContextMenu` — Set Project Folder creates default `content/` layout (or uses existing content root), scans via FSA into Assets Content tree (`AssetManager.scanFromFsa`); New Folder / Delete Folder (tree RMB + Del), Move to Folder (asset RMB), delete/duplicate assets write through to disk + manifest when folder granted; Assets Refresh → `reloadProjectContent()`; init re-scans if permission already granted.
