# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Toolbar RMB **Hide**: per-instance only (not global `view.toolbar` / sibling copies).
- Viewport leaf header: **▾** is a separate control right of the panel title (not type-menu); appears only when that leaf’s toolbar is hidden; click restores toolbar and hides ▾. Title alone opens type menu.
- Removed residual toolbar strip when hidden — toolbar container fully `display:none`.
