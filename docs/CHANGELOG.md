# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: stateMachineBehavior component (§7 backlog item 7/12)**: new behavior `StateMachineBehavior` (registered in `BehaviorRegistry`) — AI finite-state machine for NPCs/mechanisms (patrol/chase), distinct from `spriteUiAnimation`'s Фаза F clip-state-machine (that one switches sprite clips, this one moves the entity) but reusing the same ordered first-match transition mechanism and shared `ConditionEvaluator.evalSpec`/`compareOp`. `states` (JSON `[{name, movement, speed, waypoints, transitions}]`), `defaultState`. Transition conditions: `{type:'distance', op, value}` (distance to `scene.player`, the only chase/flee target this pass) or `{var, op, value}` (evaluated against `scene.eventGraphRuntime`, same shape Event Graph/Dialogue/Фаза F use). Per-state `movement`: `patrol` (ping-pongs `waypoints`, spawn-relative offsets like `pathFollower`), `chase`/`flee` (moves straight to/from `scene.player` at `speed`), unset/`idle` (no movement). No collision against solids. Public `setState(name)` hook exposed for a future Event Graph "SetAIState" action — not wired this pass.
