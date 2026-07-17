# Changelog

Полная история — `docs/CHANGELOG_ARCHIVE.md`. Здесь только записи, ещё не закоммиченные в git.

## [Unreleased]

- **Event Graph MVP runtime** (Фаза D): engine-side interpreter for level-scope event graphs (`src/engine/eventgraph/`); NodeRegistry pattern like BehaviorRegistry; EventGraphRuntime executes graph traversal via entry dispatch (OnStart/OnTick/OnCollisionEnter/OnCollisionExit/OnInteract/OnTimer/OnCustomEvent); Conditions: Compare/And/Or/Not (inline spec-based, not graph edges); Actions: SetVariable/SetComponentEnabled/Teleport/DestroyObject/EmitCustomEvent; integration with TriggerBehavior.notifyCollision() + SetComponentEnabled now live-flips .enabled at runtime.
- **Asset Editor layout persist**: float remembers relative position/size (`relX/Y/W/H`) + full inner split-tree in `panels.dock.assetEditorLayout` across close/reopen and sessions; reopen remaps leaf ids.
- **Asset Editor data wiring**: typed component property forms from `ComponentPropertySchema` (collider/trigger/interactable/spriteUiAnimation/playerStart + raw JSON fallback); defaults on `createComponentStub`; Components list shows type/props count + fixed **Add Component** bar; Details: enabled + fields; Preview: resolved image, AABB/radius overlays for selected component; Identity: id/path/tags/status.
