# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Project Folder / FSA in-place writes (v4.51.0)**: `FsaStore` + `FsaContentWriter` — persist directory handle (IndexedDB) + folder name (localStorage); File → **Set Project Folder...** / Project Settings **Project Folder**; async save level/project/asset/build writes to granted folder (`content/` root when present), else download/picker. `createAssetOfType` writes new assets + manifest when folder set.
