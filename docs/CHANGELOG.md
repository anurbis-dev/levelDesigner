# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: panel clicks requiring a second try — `viewport-gesture-mode` no longer arms on bare `isLeftDown`/`isRightDown` (only real drag/marquee/pan/zoom), so `pointer-events:none` does not swallow the first UI click.
- Dock floating: keep **relative** position on workspace resize; optional **edge snap** to workspace (`panels.dock.floatEdgeSnap`, margin `panels.dock.floatEdgeMargin`) — Settings → General → Floating Windows.
- Dock: floating window **resize** free of Shift; resize grip only when pointer is in bottom band of the window.
- Dock UI customize: hold **Shift** for layout ops (move/split/copy/detach/snap) and drop/snap highlights; release mid-drag clears highlight and cancels layout commit (`isDockCustomizeKey`).
