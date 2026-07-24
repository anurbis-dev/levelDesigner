# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Feat: sequenceCutscene (§7 Tier 4, v4.49.0)**: Component `sequenceCutscene` + `SequenceCutsceneBehavior` — ordered timeline driving actors/camera/dialogue/vars/SFX. Props: `steps` JSON (`wait|move|teleport|camera|cameraRelease|dialogue|setVariable|playAnimation|playSound|emitEvent`), `autoPlay`, `playOnEnter` (AABB zone), `lockPlayer` (`scene.cutsceneActive`), `loop`, optional `sequenceAssetId` catalog merge, `enabled`. Duck-types `play`/`stop`/`isPlaying`/`applyCutsceneCamera`; never solid. Event Graph `PlaySequence`/`StopSequence`. `DEFAULT_ASSET_COMPONENTS.sequenceCutscene`. Tests: SequenceCutsceneBehavior, GameEngine.integration.
