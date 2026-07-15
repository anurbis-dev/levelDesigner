# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: canvas marquee (modifiers + rect draw) after Assets click fix — panel `handleMarqueeMouseUp` no longer clears canvas `isMarqueeSelecting`/`marqueeRect`; global move continues pending modifier-marquee; gesture lock arms when marquee/transform actually starts.
- Fix: **Assets** first-click miss — keep `mouseStateKey`/`marqueeId` in `BasePanel.setupSelection` (asset marquee no longer sets canvas `isMarqueeSelecting`); select assets on mousedown (HTML5 `draggable` was swallowing click).
- Fix: panel clicks requiring a second try — `viewport-gesture-mode` no longer arms on bare `isLeftDown`/`isRightDown` (only real drag/marquee/pan/zoom), so `pointer-events:none` does not swallow the first UI click.
- Dock floating: keep **relative** position on workspace resize; optional **edge snap** to workspace (`panels.dock.floatEdgeSnap`, margin `panels.dock.floatEdgeMargin`) — Settings → General → Floating Windows.
- Dock: floating window **resize** free of Shift; resize grip only when pointer is in bottom band of the window.
- Dock UI customize: hold **Shift** for layout ops (move/split/copy/detach/snap) and drop/snap highlights; release mid-drag clears highlight and cancels layout commit (`isDockCustomizeKey`).
