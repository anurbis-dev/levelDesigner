# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: variableModifier component (§7 backlog item 11/12)**: new behavior `VariableModifierBehavior` (registered in `BehaviorRegistry`) — Volume/Trigger zone, never solid (duck-typed `isOverlapping()` returns false, same convention as `ClimbableLadderBehavior`/`ConveyorZiplineJumpPadPortalBehavior`), reacts only to `scene.player`. Writes to an `EventGraphRuntime` variable on contact — the write side of the mechanism Quest/Dialogue conditions read via `ConditionEvaluator`'s `{var,op,value}` against `scene.eventGraphRuntime`. `op`: `set` writes `value` directly; `add`/`subtract` apply `value` against the current variable (missing treated as 0); `toggle` flips a boolean (`value` ignored). `mode: 'once'` is edge-detected (fires once per fresh entry, repeatable on re-entry, same pattern as `portal`/`jumpPad`); `mode: 'continuous'` re-applies every tick while overlapping. Tests: `tests/engine/VariableModifierBehavior.test.js` (9 tests).
