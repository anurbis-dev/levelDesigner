# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Dialogue MVP runtime (Фаза E)**: DialogueRunner интерпретатор, ConditionEvaluator для условий, DialogueTriggerBehavior компонент; OnDialogueEnded event-граф вход, StartDialogue action; Scene.dialogues и dialogue state (dialogueActive/dialogueRunner); PlayerMovementBehavior паузится при активном диалоге.
- **Asset Preview viewport camera**: Preview panel is a canvas mini-viewport with local camera (RMB pan, wheel zoom toward cursor, MMB drag zoom, double-click fit); grid + asset body + component overlays redraw without resetting pose on property edits.
