# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: `PlaySound` event graph action (v4.27.0)**: new engine module `AudioPlayer` (`src/engine/AudioPlayer.js`) — browser-guarded static `play(src, {volume, loop})`, no-op when `Audio` is unavailable (Node test env). Registered `PlaySound` node in `registerDefaultEventGraphNodes.js`: `params: {src, volume?, loop?}` used directly, same inline-data convention as `Teleport` (no `assetId` lookup — `ProjectLoader.assetsById` is still an intentionally empty `Map`). One-shot SFX only, no instance tracking/stop — first slice of the `soundEffect` §7 backlog item; `musicTrack`/`audioZone` (loop/crossfade/ambient) not started. Catalog asset type `soundEffect` stays a placeholder with no dedicated Asset Editor form (not requested). Tests: `tests/engine/AudioPlayer.test.js` (5), `GameEngine.integration.test.js` PlaySound integration test (1); all 321 tests pass.
