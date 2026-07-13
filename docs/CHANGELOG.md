# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Feature: rotation/scale snap-степ (Shift во время Ctrl-drag transform) вынесен в настройки — Settings → Selection ("Rotation Snap (Shift+drag, °)" и "Scale Snap (Shift+drag, factor)"), дефолт вращения изменён с 10° на 15° (backed by `selection.rotationSnapDegrees`/`selection.scaleSnapFactor` в StateManager/ConfigManager, `EditorConstants.TRANSFORM.*` теперь только fallback).
