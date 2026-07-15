# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- Fix: Assets multi-select **click-drag drop on canvas** — mousedown keeps multi if item already selected; `dragstart` ships full `selectedAssets`; post-drag click does not sole-select.
- Fix: empty-canvas click clears full multi-selection (0×0 replace marquee no longer re-hits a nearby object as sole select).
- Fix: **Assets panel** marquee — after modifier threshold, keep `pendingMouseKey` so move tracks `isAssetMarqueeSelecting` (rect + Shift/Ctrl modes); panel mouseup no longer wipes canvas marquee keys.
- Fix: canvas gesture lock — global move continues pending modifier-marquee; lock arms when marquee/transform actually starts (viewport OK).
- Fix: **Assets** first-click miss — keep `mouseStateKey`/`marqueeId` in `BasePanel.setupSelection` (asset marquee no longer sets canvas `isMarqueeSelecting`); select assets on mousedown (HTML5 `draggable` was swallowing click).
- Fix: panel clicks requiring a second try — `viewport-gesture-mode` no longer arms on bare `isLeftDown`/`isRightDown` (only real drag/marquee/pan/zoom), so `pointer-events:none` does not swallow the first UI click.
- Dock floating: keep **relative** position on workspace resize; optional **edge snap** to workspace (`panels.dock.floatEdgeSnap`, margin `panels.dock.floatEdgeMargin`) — Settings → General → Floating Windows.
- Dock: floating window **resize** free of Shift; resize grip only when pointer is in bottom band of the window.
- Dock UI customize: hold **Shift** for layout ops (move/split/copy/detach/snap) and drop/snap highlights; release mid-drag clears highlight and cancels layout commit (`isDockCustomizeKey`).
