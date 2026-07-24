# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: inputMap level keyboard remapping (§7 Tier 3, v4.40.0)**: `levelData.inputMap` `{actions: {name: string[]}}` on Scene/Level. `Input.setInputMap` / `isActionDown`; axes + interact honor remaps (`OnInteract`, mount/dismount). `GameEngine.loadProject` applies map; unmapped actions keep `DEFAULT_ACTIONS`. Tests for Input/Scene/GameEngine. No editor UI / gamepad this pass.
