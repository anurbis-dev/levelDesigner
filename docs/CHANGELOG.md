# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Collider shapes**: `shape` = `box` | `circle` | `freeform`; per-instance `color` for stroke frame; freeform Preview edit mode (Add/Move/Delete vertices). Runtime still AABB of shape.
- **Level model: `eventGraph`/`dialogues` fields**: `Level.js` now stores and round-trips level-scope `eventGraph`/`dialogues` (constructor + `toJSON()`), matching the `docs/RUNTIME_SCHEMA.md` root-field contract — previously an authored value would silently vanish on save since the model didn't know the keys existed. No editor UI yet; authored as raw JSON until the Event Graph/Dialogue widgets land (Фаза C).
