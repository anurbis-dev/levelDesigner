# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: LEDGE platformer port (v4.50.0)**: `PlayerMovementBehavior.mode=platformer` (гравитация, прыжок, койот, wall jump, ledge grab, crouch/roll, лестницы/bars). Хелперы `src/engine/behaviors/platformer/`, не новый component type. `playerStart` (`movementMode`/`bodyWidth`/`bodyHeight`/`speed`/`platformer`) + `damageHealth`/`spriteUiAnimation`/`imgSrc` копируются `Scene._createPlayer` (тело 10×22). `Input`: `jump` Space/Z/X, `interact` E/F/C, `wasActionPressed`/`beginFrame`/`endFrame`/`consumeAction`. `tilemap.tileKinds` + crumb. `pathFollower` elevator/gravity/turnAtLedge/`getGateRects`. `pickup` hold/heal/throw. portal `requireInteract`/`requireItem`/`consumeItem`/`fadeSeconds` (0=instant). `camera.viewHeight` → zoom. `collider.oneWay=up`. `spawner` `spawnWhen=playerBelow`. Renderer: pixel, `drawFade`, `scaleX` flip. Event Graph `HasItem`/`ConsumeItem`. Уровень `content/maps/ledge.json` (rebuild: `node scripts/build-ledge-level.mjs`), план `docs/LEDGE_PORT_PLAN.md`.
