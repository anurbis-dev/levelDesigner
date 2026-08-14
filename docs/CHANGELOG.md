# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: Drag-move assets/folders + path rewrite (v4.54.0)**: click-drag assets onto Content tree (or a folder tab) and folders onto another folder to move them with contents; no RMB **Move to Folder**. `AssetPathRewriter` remaps `path`/`imgSrc`/`sourceFile`/`levelSrc` and any path-like strings in components, other assets, and the open level; `*AssetId` refs stay. `FsaContentFs.moveFile` is binary-safe; `moveDirectory` + `moveStructureNode` keep folder trees. IDs written back to moved JSON.
