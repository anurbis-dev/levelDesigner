# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: musicTrack + audioZone (§7 Tier 3, v4.41.0)**: `AudioPlayer` music/ambient channels — `playMusic`/`stopMusic` (optional linear crossfade), `playAmbient`/`stopAmbient`. Event Graph `PlayMusic`/`StopMusic` (`src`, `volume?`, `loop?`, `crossfade?`). Component `audioZone` + `AudioZoneBehavior` (AABB enter/exit, channel ambient|music, stopOnExit). `DEFAULT_ASSET_COMPONENTS.audioZone`. Catalog musicTrack/soundEffect forms still stubs. Tests: AudioPlayer, AudioZoneBehavior, GameEngine.integration.
