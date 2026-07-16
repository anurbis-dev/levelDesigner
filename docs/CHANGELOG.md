# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix (B1): `ParallaxRenderer.getParallaxOffset` — shift = `cameraOffset × parallaxOffset` (было `× (1 + offset)`: любой ненулевой offset давал ~2× скорость и разрыв с offset=0). Скорость слоя = `1 + offset` (−0.8 far, 0 none, 0.5 near, −1 screen-fixed). Docs: `USER_MANUAL` UI layer −1, not 0.
