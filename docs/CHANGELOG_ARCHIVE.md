# Changelog Archive

Записи, перенесённые из `CHANGELOG.md` при коммитах (см. `git log` для точных диффов). Актуальный неопубликованный разрез — в `docs/CHANGELOG.md`.

## Archived from CHANGELOG.md (questObjective quest tracking, v4.34.0)

- **Feat: `questObjective` quest tracking (§7 backlog Tier 3, v4.34.0)**: new `level.quests[]` (`{id, name?, objectives:[{id,description?,condition}], reward?}`), level-scope map like `dialogues`/`canvases`, and new `QuestRunner` (`src/engine/QuestRunner.js`) — one instance per Scene (built directly in `Scene`'s constructor, not wired post-hoc, since it only needs `this`), tracks concurrent (non-modal) quest state. New Event Graph action `StartQuest` (`params: {questId}`) begins tracking; `QuestRunner.tick()` — called from `EventGraphRuntime.tick()`, deliberately not a new `GameEngine._update()` hook — polls each active quest's incomplete `objective.condition` (same `{var,op,value}` shape as everywhere else, `ConditionEvaluator.evalSpec`) against `scene.eventGraphRuntime`; once every objective completes, status flips to `'completed'` and `reward` (same `{type:'giveItem'|'takeItem',...}` Effect shape as Dialogue's `effects`) is applied automatically via `scene.getBag()` — no separate CompleteQuest/GiveReward action. No dedicated `type:'inventoryCount'` objective condition in this pass — item-count objectives mirror inventory into a variable via the existing `variableModifier` component. No editor authoring UI or quest-log HUD widget yet (not requested this pass, same gap pattern as HUD Canvas/Event Graph MVP). Tests: `tests/engine/QuestRunner.test.js` (11 cases — unknown questId, idempotent restart, objective completion, quest completion gating, reward give/take, no-runtime no-op), 3 new in `tests/engine/Scene.test.js`, 1 new end-to-end in `tests/engine/GameEngine.integration.test.js`; full suite 383/383 green.

## Archived from CHANGELOG.md (HUD Canvas runtime + data model, v4.33.0)

- **Feat: HUD Canvas runtime + data model (v4.33.0)**: `Level.canvases[]` and `Scene.canvases` (Map) hold level-scope HUD widget definitions. `camera` component gets `canvasIds` property (`stringList`, default empty) — which HUD Canvases an active camera renders. `CameraBehavior.getCanvasIds()` returns null when unset/empty (unlike `getRenderLayers()`'s "empty=all" convention — here null means "no HUD shown"). `GameEngine._updateCamera()` writes `scene.activeCanvasIds` per-tick. DOM-based `CanvasHudRenderer` mounts on `#play-overlay` alongside `DialoguePlayHud`, reading `scene.canvases` + `scene.activeCanvasIds` each rAF frame. Widget shape: `{ id, type: 'panel'|'text'|'button'|'image'|'progressBar', anchor: 'topLeft'|...|'bottomRight', offsetX?, offsetY?, width?, height?, text?, imgSrc?, style?, binding?: {source:'variable'|'inventoryCount', name?, itemId?, max?}, action?: {type:'customEvent', name} }`. Pure helpers in `CanvasHudBinding.js`: `resolveAnchorStyle()`, `resolveBindingValue()`, `resolveProgressFraction()`, `resolveDisplayText()`. CSS for `.canvas-hud` / `.canvas-hud__widget*` in `styles/main.css`. **Known gap**: no editor authoring UI yet (dock panel TBD in follow-up phase, mirrors how Event Graph MVP preceded Event Graph UI). Tests: new `tests/engine/CameraBehavior.test.js` (getCanvasIds), new `tests/engine/CanvasHudBinding.test.js` (anchor/binding helpers). Verified in browser: camera+canvas+button wired live, click → `emitCustomEvent` → `SetVariable` → HUD text re-binds correctly.

## Archived from CHANGELOG.md (real ProjectLoader.assetsById registry + SpawnObject/prefab, v4.32.0)

- **Feat: real `ProjectLoader.assetsById` registry + `SpawnObject`/`prefab` (§7 backlog Tier 2, v4.32.0)**: `ProjectExporter.export(levelSessions, levelOrder, project, {assetManager})` now accepts an optional `assetManager` and embeds `assetManager.getAllAssets().map(a => a.toJSON())` as a new `assets` array on the exported manifest (empty array when omitted, backward compatible). `ProjectLoader.load()` builds a real `assetsById: Map` from `manifest.assets` (previously hardcoded to an always-empty `Map`, see its old header comment); `ProjectLoader.loadLevel()` attaches it to the produced `Scene.assetsById`. New `EntityFactory.fromAssetData(assetData, {id?, x?, y?, layerId?}, assetsById?)` — an engine-native port of the editor's `Asset.createInstance()` (`src/models/Asset.js`), kept as a separate reimplementation since `engine/` stays free of `src/models|ui|...` imports; resolves a composite asset's `sprite.properties.imageAssetId` against `assetsById` to another catalog asset's `imgSrc` (mirrors `AssetVisualMigrate.js`'s `resolveTextureSrc`, minus its deprecated `sprite.src` legacy fallback). New Event Graph action `SpawnObject` (`params: {assetId, x?, y?, layerId?}`, `registerDefaultEventGraphNodes.js`) resolves `scene.assetsById.get(assetId)` and pushes the spawned entity into `scene.entities`; warns and no-ops for an unknown `assetId`. This is the first Event Graph action to actually need the asset registry — every earlier Tier 1 action (`PlaySound`, etc.) used inline params specifically because the registry didn't exist yet. No editor UI to author `SpawnObject` nodes yet (not requested this pass). Tests: 2 new in `tests/ProjectExporter.test.js`, 2 new in `tests/engine/ProjectLoader.test.js`, 7 new in `tests/engine/EntityFactory.test.js`, 2 new in `tests/engine/GameEngine.integration.test.js`; full suite 349/349 green.

## Archived from CHANGELOG.md (materialShaderPreset canvas filter presets, v4.31.0)

- **Feat: `materialShaderPreset` canvas filter presets (§7 backlog Tier 1, v4.31.0)**: new `materialPreset` field on GameObject/`Entity` (JSON `{blur?, brightness?, saturate?, hueRotate?, dropShadow?:{x?,y?,blur?,color?}}`, direct field like `color`/`imgSrc`, not a component `properties` bag). New static `Renderer._buildFilterString()` (`src/engine/render/Renderer.js`) turns it into a canvas 2D CSS `filter` string, applied in `_drawSingle` to every entity draw (image or fallback rect); resets to `'none'` for entities without a preset so filters don't leak onto the next entity. Not gated behind a `volume` zone — `volume` (arbitrary-shape visual-effect trigger) is a separate, still-unimplemented §7 item; the filter applies to any entity. No separate reusable catalog asset/editor form yet — `ProjectLoader.assetsById` is still an intentionally empty `Map` (Tier 2+); preset data is inline on the object, same convention as `pathFollower.interpolation`/`stateMachineBehavior.aiPreset`/`PlaySound`. Tests: 3 new cases in `tests/engine/Renderer.test.js` (defaults `ctx.filter` to `'none'`, builds the full CSS filter string from all preset fields, resets to `'none'` for the next entity after a filtered one); full suite 336/336 green.

## Archived from CHANGELOG.md (aiBehaviorPreset shorthand, v4.30.0)

- **Feat: `aiBehaviorPreset` shorthand for `stateMachineBehavior` (§7 backlog Tier 1, v4.30.0)**: new `aiPreset` property on `stateMachineBehavior` (JSON `{aggroRadius?, leashRadius?, speed?, chaseSpeed?, waypoints?, fov?}`), expanded by new static `StateMachineBehavior._buildPresetStates` into the standard two-state patrol/guard→chase→leash machine — `'patrol'` (a stationary guard post when `waypoints` is empty/single-point, since `_resetPatrolProgress` already no-ops movement for <=1 waypoints) transitions to `'chase'` within `aggroRadius`, `'chase'` transitions back to `'patrol'` beyond `leashRadius` (default `aggroRadius*2`). Explicit `states`, if set, always takes precedence over `aiPreset` — it's a convenience generator, not a replacement for hand-authored multi-state machines. No separate `aiBehaviorPreset` catalog asset/editor form — `ProjectLoader.assetsById` is still an intentionally empty `Map` (Tier 2+); preset config lives inline on `stateMachineBehavior.properties`, same convention as `pathFollower.interpolation`/`PlaySound`. `ComponentPropertySchema.js` gained an `aiPreset` JSON field. Tests: 6 new cases in `tests/engine/StateMachineBehavior.test.js` (guard-post idle before aggro, patrol→chase on aggro entry, chase→patrol on leash exit, default leashRadius=2x aggroRadius, preset patrol with waypoints, explicit `states` overrides `aiPreset`); full suite 333/333 green.

## Archived from CHANGELOG.md (pathSpline smooth interpolation, v4.29.0)

- **Feat: `pathSpline` smooth interpolation for `pathFollower` (§7 backlog Tier 1, v4.29.0)**: new `interpolation` property on `pathFollower` (`'linear'` default, unchanged behavior \| `'smooth'`). In `'smooth'` mode, `PathFollowerBehavior` curves through `waypoints` via Catmull-Rom (`_updateSmooth`/`_catmullRom` in `src/engine/behaviors/PathFollowerBehavior.js`) instead of straight segments — control points are the adjacent waypoints (clamped, not wrapped, at path ends), segment progress `_segT` driven by straight-chord length (approximation, not true arc length). No separate `pathSpline` catalog asset/editor form — `ProjectLoader.assetsById` is still an intentionally empty `Map` (Tier 2+); curve config lives inline on `pathFollower.properties`, same convention as `PlaySound`'s inline params. `ComponentPropertySchema.js` gained `interpolation` select field (`PATH_FOLLOWER_INTERPOLATION_OPTIONS`). Tests: 3 new cases in `tests/engine/PathFollowerBehavior.test.js` (reaches every waypoint exactly like linear mode, curves off the straight chord mid-segment, defaults to `'linear'` when unset); full suite 327/327 green.

## Archived from CHANGELOG.md (stateMachineBehavior facing/FOV fix, v4.28.0)

- **Fix: `stateMachineBehavior` AI no longer detects the player through its own back (v4.28.0)**: `type:'distance'` transition conditions were fully omnidirectional — an NPC "saw" the player at any angle, including directly behind itself. `StateMachineBehavior` now tracks a facing heading (`_facingX`/`_facingY`, initial `(1,0)`, overridable via new `properties.facingX`/`facingY`), updated to the entity's last actual movement direction inside `patrol`/`chase`/`flee` (`_setFacing`, same one-tick-lag convention as Фаза F's `speed` write). `_evalCondition('distance', ...)` now also gates on `_isWithinSight()`: a `fov`-degree cone centered on that facing, default `180°` (front half — excludes only directly behind); level authors can widen it per-condition via `condition.fov` (`360` restores the old fully-omnidirectional check). `ComponentPropertySchema.js` gained `facingX`/`facingY` fields for the Details form. Tests: 3 new cases in `tests/engine/StateMachineBehavior.test.js` (behind-facing blocks the transition, explicit `fov:360` overrides it, facing follows patrol movement so a stationary player transitions from hidden to visible as the NPC turns); full suite 324/324 green.

## Archived from CHANGELOG.md (PlaySound event graph action, v4.27.0)

- **Feat: `PlaySound` event graph action (v4.27.0)**: new engine module `AudioPlayer` (`src/engine/AudioPlayer.js`) — browser-guarded static `play(src, {volume, loop})`, no-op when `Audio` is unavailable (Node test env). Registered `PlaySound` node in `registerDefaultEventGraphNodes.js`: `params: {src, volume?, loop?}` used directly, same inline-data convention as `Teleport` (no `assetId` lookup — `ProjectLoader.assetsById` is still an intentionally empty `Map`). One-shot SFX only, no instance tracking/stop — first slice of the `soundEffect` §7 backlog item; `musicTrack`/`audioZone` (loop/crossfade/ambient) not started. Catalog asset type `soundEffect` stays a placeholder with no dedicated Asset Editor form (not requested). Tests: `tests/engine/AudioPlayer.test.js` (5), `GameEngine.integration.test.js` PlaySound integration test (1); all 321 tests pass.

## Archived from CHANGELOG.md (camera render layers, v4.26.0)

- **Feat: camera render layers (v4.26.0)**: runtime-side layer filtering for active game camera. `CameraBehavior` gained new method `getRenderLayers()` returning array of layer ids from `this.properties.renderLayers` (empty/unset → `null`, meaning all layers). `Renderer.renderScene()` gained 4th parameter `renderLayers` (default null) and filters `scene.entities` by `entity.layerId`, skipping entities whose `layerId` is not in the filter (entities without `layerId` always render). `GameEngine` new field `this.cameraRenderLayers` populated in `_updateCamera()` from `behavior.getRenderLayers()` and passed to `renderer.renderScene()` for per-frame filtering. `ComponentPropertySchema` camera component added `renderLayers` field (kind `stringList`, default `[]`) for Details editor form. Tests: all 315 tests pass (CameraBehavior.test.js, Renderer.test.js, GameEngine.integration.test.js updated). Closes §7 Camera asset backlog extension post-release.

## Archived from CHANGELOG.md (sync LevelEditor.VERSION, v4.25.1)

- **Chore: sync `LevelEditor.VERSION` to `4.25.1`**: static version field had drifted from `package.json` across the last 3 releases (conveyorZiplineJumpPadPortal/variableModifier/destructibleContainer bumped `package.json` but not `LevelEditor.js`), failing `npm run validate:version`.

## Archived from CHANGELOG.md (destructibleContainer component, v4.25.0)

- **Feat: destructibleContainer component (§7 backlog item 12/12, closes the §7 backlog)**: new behavior `DestructibleContainerBehavior` (registered in `BehaviorRegistry`) subclasses `DamageHealthBehavior` to reuse its health-pool/contact-damage/invulnerability logic and solid-while-alive side effect verbatim (no `isOverlapping()` override). `DamageHealthBehavior` gained an extracted `_onDeath(scene)` hook (pure refactor, no behavior change) so `DestructibleContainerBehavior` can override it: on death it spawns a loot entity (`EntityFactory.fromGameObjectData`, same reuse pattern as `SpawnerBehavior`) carrying a `pickup` component (`itemId`/`count`) at its own position — the player walks over it like any other Pickup, rather than the item being granted directly. No `itemId` set → no loot spawned, `destroyOnDeath` still applies. `contactDamage` intentionally left out of the editor schema (a container shouldn't damage others) but still defaults to 0 at runtime via the inherited constructor. Tests: `tests/engine/DestructibleContainerBehavior.test.js` (8 tests).

## Archived from CHANGELOG.md (variableModifier component, v4.24.0)

- **Feat: variableModifier component (§7 backlog item 11/12)**: new behavior `VariableModifierBehavior` (registered in `BehaviorRegistry`) — Volume/Trigger zone, never solid (duck-typed `isOverlapping()` returns false, same convention as `ClimbableLadderBehavior`/`ConveyorZiplineJumpPadPortalBehavior`), reacts only to `scene.player`. Writes to an `EventGraphRuntime` variable on contact — the write side of the mechanism Quest/Dialogue conditions read via `ConditionEvaluator`'s `{var,op,value}` against `scene.eventGraphRuntime`. `op`: `set` writes `value` directly; `add`/`subtract` apply `value` against the current variable (missing treated as 0); `toggle` flips a boolean (`value` ignored). `mode: 'once'` is edge-detected (fires once per fresh entry, repeatable on re-entry, same pattern as `portal`/`jumpPad`); `mode: 'continuous'` re-applies every tick while overlapping. Tests: `tests/engine/VariableModifierBehavior.test.js` (9 tests).

## Archived from CHANGELOG.md (conveyorZiplineJumpPadPortal component, v4.23.0)

- **Feat: conveyorZiplineJumpPadPortal component (§7 backlog item 10/12)**: new behavior `ConveyorZiplineJumpPadPortalBehavior` (registered in `BehaviorRegistry`) — one component type, `kind` enum (`conveyor`|`zipline`|`jumpPad`|`portal`, same shape-enum convention as `collider`'s `box|circle|freeform`), zone never solid (duck-typed `isOverlapping()` returns false, same convention as `ClimbableLadderBehavior`), reacts only to `scene.player`. `conveyor` pushes the player every tick while overlapping (`directionX`/`directionY` × `speed`). `jumpPad` applies an instant position offset (`launchOffsetX`/`launchOffsetY`) once on entry (edge-detected) — no gravity/velocity integrator in this engine, so an "impulse" is a position offset, not a physics force. `zipline` hijacks player movement: `PlayerMovementBehavior` gained a new guard (`if (scene.zipliningEntity) return;`, same pattern as `scene.mountedVehicle`/`scene.dialogueActive`); on entry it rides the player to `targetOffsetX`/`targetOffsetY` (offset from the zone's spawn position) at `speed`, then returns control. `portal` teleports the player to `targetId` (resolved the same way Event Graph's `Teleport` action does) on entry, edge-detected so standing inside doesn't refire every tick. Tests: `tests/engine/ConveyorZiplineJumpPadPortalBehavior.test.js` (9 tests).

## Archived from CHANGELOG.md (climbableLadder component, v4.22.0)

- **Feat: climbableLadder component (§7 backlog item 9/12)**: new behavior `ClimbableLadderBehavior` (registered in `BehaviorRegistry`) — ladder zone, never solid (`isOverlapping()` exists purely as the duck-type marker `PlayerMovementBehavior`'s existing solids filter already excludes, same convention as `TriggerBehavior`). Exposes `getBounds()` (same shape/offset schema as `collider`/`trigger`: box/circle/freeform + `climbSpeed`, default `100`) and `getClimbSpeed()`. `PlayerMovementBehavior` gained `_findLadder(scene)` — each tick, if the player's bounds overlap an enabled ladder zone, horizontal input is ignored (vertical-only climb) and speed switches from the player's normal walk speed to the ladder's `climbSpeed`; normal solid-blocking (colliders) still applies per-axis while climbing. No Event Graph integration (no `OnLadderEnter`), no auto-centering on the ladder's horizontal axis — not requested, same discipline as the rest of §7.

## Archived from CHANGELOG.md (checkpointSavePoint component, v4.21.0)

- **Feat: checkpointSavePoint component (§7 backlog item 8/12)**: new behavior `CheckpointSaveBehavior` (registered in `BehaviorRegistry`) — self-contained checkpoint/save point, empty property schema (trigger zone = entity box, no shape override, same minimalism as `playerStart`). Each tick, while not yet active, AABB-checks overlap with `scene.player`; on overlap calls public `activate(scene)` (duck-typed hook, future Event Graph action target like `setState`/`spawnOne`) which deactivates the previous `scene.activeCheckpoint` (single source of truth — only one checkpoint active at a time) and records `scene.checkpointPosition`. Actual respawn lives in `Scene.js`: `spawnPlayer()`/new `respawnPlayer()` now share a `_createPlayer()` helper; `respawnPlayer()` is a no-op if `scene.player` is alive, otherwise recreates it at `checkpointPosition` if set, else at the cached `playerStart` marker position. `GameEngine._update()` calls `scene.respawnPlayer()` whenever `scene.player` is missing — the first engine-level reaction to `DamageHealthBehavior.destroyOnDeath`, which previously just left `scene.player = null` with no recovery path.

## Archived from CHANGELOG.md (stateMachineBehavior component, v4.20.0)

- **Feat: stateMachineBehavior component (§7 backlog item 7/12)**: new behavior `StateMachineBehavior` (registered in `BehaviorRegistry`) — AI finite-state machine for NPCs/mechanisms (patrol/chase), distinct from `spriteUiAnimation`'s Фаза F clip-state-machine (that one switches sprite clips, this one moves the entity) but reusing the same ordered first-match transition mechanism and shared `ConditionEvaluator.evalSpec`/`compareOp`. `states` (JSON `[{name, movement, speed, waypoints, transitions}]`), `defaultState`. Transition conditions: `{type:'distance', op, value}` (distance to `scene.player`, the only chase/flee target this pass) or `{var, op, value}` (evaluated against `scene.eventGraphRuntime`, same shape Event Graph/Dialogue/Фаза F use). Per-state `movement`: `patrol` (ping-pongs `waypoints`, spawn-relative offsets like `pathFollower`), `chase`/`flee` (moves straight to/from `scene.player` at `speed`), unset/`idle` (no movement). No collision against solids. Public `setState(name)` hook exposed for a future Event Graph "SetAIState" action — not wired this pass.

## Archived from CHANGELOG.md (spawner component, v4.19.0)

- **Feat: spawner component (§7 backlog item 6/12)**: new behavior `SpawnerBehavior` (registered in `BehaviorRegistry`) — self-contained periodic entity spawner; `template` (JSON, full GameObject-shaped data consumed by `EntityFactory.fromGameObjectData` — no runtime asset registry exists yet, so the spawned entity's data lives inline, same convention as `pathFollower.waypoints`), `interval` (sec, default 3, `<=0` disables), `maxAlive`/`maxSpawns` (default 0 = unlimited), `spawnOffsetX`/`spawnOffsetY` (default 0, asset-local offset from the spawner's own position). Spawned entities get id `${entity.id}__spawnN` and are pushed directly into `scene.entities`. Public `spawnOne(scene)` hook exposed for a future Event Graph "SpawnObject" action — not wired this pass.

## Archived from CHANGELOG.md (pathFollower component, v4.18.0)

- **Feat: pathFollower component (§7 backlog item 5/12)**: new behavior `PathFollowerBehavior` (registered in `BehaviorRegistry`) — self-contained kinematic waypoint patrol; `waypoints` (JSON `[{x,y},…]`, offsets from entity spawn position, same asset-local convention as collider freeform `points`); moves `entity.x/y` toward the current target waypoint at `speed` px/sec, pauses `waitAtWaypoint` sec on arrival, then advances per `mode` (`loop` wraps to first, `pingpong` reverses at ends, `once` stops at last). No collision checks against solids and no player/passenger carrying — out of scope for this pass.

## Archived from CHANGELOG.md (mountableVehicleSeat component, v4.17.0)

- **mountableVehicleSeat component (§7 backlog item 4/12)**: new behavior `MountableVehicleSeatBehavior` (registered in `BehaviorRegistry`) — self-contained, polls `scene.input.isDown('e')` directly (own edge-detect, no Event Graph node required); mounts when player is within `mountRadius`, hides `scene.player` and snaps it to the vehicle; while mounted drives the vehicle entity itself (`speed`/`layer`/`collidesWith`, same AABB-blocking pattern as `PlayerMovementBehavior`) and keeps `scene.player` position synced each tick (camera keeps following `scene.player` unchanged); second E press dismounts to a fixed offset beside the vehicle. `PlayerMovementBehavior.update()` gained one guard line: `if (scene.mountedVehicle) return;` (same pattern as the existing `dialogueActive` pause). Parked (unmounted) vehicle is solid via `getBounds()`.

## Archived from CHANGELOG.md (movablePushable component, v4.16.0)

- **movablePushable component (§7 backlog item 3/12)**: new behavior `MovablePushableBehavior` (registered in `BehaviorRegistry`) — Sokoban-style box, solid by default (`getBounds()`); `PlayerMovementBehavior._moveAxis` duck-type-calls `blocker.tryPush(dx,dy,scene)` on a blocking solid before reverting a blocked step, letting the box slide along; push only succeeds if the destination is itself clear of other solids (walls, other boxes); `layer`/`collidesWith` gate which solids block the destination.

## Archived from CHANGELOG.md (damageHealth component, parallax pure-zoom fix, v4.14.2/v4.15.0)

- **damageHealth component (§7 backlog item 2/12)**: new behavior `DamageHealthBehavior` (registered in `BehaviorRegistry`); AABB-checks every tick against other damageHealth entities; one component type covers both dealing and receiving damage — source sets `contactDamage>0` + `layer`, receiver sets `maxHealth`/`currentHealth` + `collidesWith`; `invulnerabilityDuration` (sec, default 0.5) provides i-frame window after each hit; `destroyOnDeath` (default true) calls `scene.destroyEntity()` when `currentHealth≤0`; no Event Graph integration this pass (no OnDeath node).
- **Fix: parallax layers shifting on pure zoom (no pan)**: `ParallaxRenderer.getCameraOffset()` compared raw `camera.x/y` (the viewport's top-left corner) against `parallax.startPosition` — but raw camera.x/y is entangled with zoom itself (`camera.x = centerX - canvasWidth/(2*zoom)`), so just zooming in/out with zero actual panning still shifted every parallax layer. New `ParallaxRenderer.getCameraCenter(camera)` derives the zoom-invariant viewport-center world point; `getCameraOffset` and all 5 "capture start position" call sites (level load, project load, Details panel button, x2 in LevelEditor) now use the center instead of raw camera.x/y. Real panning still shifts layers as before; zooming alone (center-anchored or cursor-anchored near center) no longer does.

## Archived from CHANGELOG.md (Parallax sprite/selection desync fix, v4.14.1)

- **Fix: parallax sprite/selection desync on camera zoom/pan**: `ParallaxRenderer.isParallaxEnabled()`/`getParallaxOffset()` read a standalone `stateManager.view.parallax` key that nothing in the current UI sets anymore — the real Parallax toolbar toggle only flips the per-viewport `displayOptions.parallax` flag. Selection bounds, mouse hit-testing, and duplicate-ghost offsets used the dead global key (effectively always parallax-off), while sprite rendering used the per-view flag — so sprites and selection boxes drifted apart as soon as the camera panned/zoomed with parallax on. Both paths now resolve the same per-view flag + that view's own camera.

## Archived from CHANGELOG.md (Play dialogue HUD, Items dock, NPC bags, Pickup component)

- **Play dialogue HUD**: choices buttons + item picker (`DialoguePlayHud` on play overlay); inventory strip with item display names.
- **Items & Inventory dock**: level `items[]` definitions, player bag seed, per-object NPC bags (`npcInventories`); history + undo.
- **NPC bags runtime**: `Scene.getBag` / `npcInventories`; dialogue effects `to`/`from`; `itemPick` deposits into speaker bag.
- **Pickup behavior**: сбор предметов через AABB-пересечение с игроком; автоудаление сущности и добавление в инвентарь (свойства: `itemId`, `count`, `destroyOnPickup`).

## Archived from CHANGELOG.md (English UI + Dialogue items/multi-NPC)

- **UI English-only**: user-facing Russian strings in Dialogues panel, dock chrome (tooltips/empty states/type menu), TypeFilterMenu, ErrorHandler, FileManager → English.
- **Dialogue items + multi-NPC (Фаза I)**: `participants` / `speakerId`; player `choices` as replies; `giveItem`/`takeItem` effects, `requireItem`, `itemPick` on choices; `Inventory` + `Scene.inventory` / `level.inventory` seed. Dialogues panel authoring for all of the above.

## Archived from CHANGELOG.md (Dialogue UI + EG pickers, Фаза H)

- **Dialogue UI + Event Graph pickers (Фаза H)**: dock `dialogues` panel (graphs/nodes/form, choices+conditions); `HistoryManager` snapshots `level.dialogues`. Event Graph params: `objectId`/`dialogueId` selects via `LevelObjectPicker` (level objects + dialogues).

## Archived from CHANGELOG.md (Event Graph UI, Фаза G)

- **Event Graph UI (Фаза G, level-scope)**: dock contentType `eventGraph` (`src/ui/event-graph/*`) — canvas nodes/edges, add-node palette, params Details, variables list, Play variables watch + runtime `recentNodeIds` highlight. `HistoryManager` snapshots `level.eventGraph` via provider on every `saveState`; undo/redo restores graph. Asset-scope graph still backlog.

## Archived from CHANGELOG.md (Asset Editor undo/redo, Phase C)

- **Asset Editor undo/redo (Phase C closed)**: project-global asset catalog stack in `HistoryManager` (`saveAssetState`/`undoAsset`/`redoAsset`); Ctrl+Z prefers asset undo while Asset Editor open. Freeform drag commits one history step on pointerup; Details text fields history on change (not per keystroke).

## Archived from CHANGELOG.md (Visual ownership)

- **Visual ownership cleanup**: only **Image** assets store disk/`imgSrc`; **Sprite** uses `imageAssetId` → Image (no path). Base asset no longer mirrors texture from components. Content JSON migrated (strip Sprite from images). Thumbs/preview/placement resolve via AssetManager.

## Archived from CHANGELOG.md (Collider shapes + Level eventGraph)

- **Collider shapes**: `shape` = `box` | `circle` | `freeform`; per-instance `color` for stroke frame; freeform Preview edit mode (Add/Move/Delete vertices). Runtime still AABB of shape.
- **Level model: `eventGraph`/`dialogues` fields**: `Level.js` now stores and round-trips level-scope `eventGraph`/`dialogues` (constructor + `toJSON()`), matching the `docs/RUNTIME_SCHEMA.md` root-field contract — previously an authored value would silently vanish on save since the model didn't know the keys existed. No editor UI yet; authored as raw JSON until the Event Graph/Dialogue widgets land (Фаза C).

## Archived from CHANGELOG.md (Sprite owns image, multi-collider frames, live preview)

- **Asset visual model**: new **Sprite** component owns image `src`; Identity no longer edits imgSrc; content JSON migrated with sprite; load/import ensure Sprite; `imgSrc` mirrored for engine placement.
- **Preview colliders**: draw **all** colliders/triggers as stroke frames (palette + corners), never tint/crop sprite; selected emphasized.
- **Realtime Details→Preview**: `updateAsset` uses `set('assetsChanged')`; live patch paints previews immediately; Components list skips re-render on pure prop edits.

## Archived from CHANGELOG.md (Asset Preview info HUD + F/A)

- **Asset Preview info HUD + F/A**: bottom status bar removed; viewport-style DOM info overlay (asset/size/zoom + component detail); no dblclick fit — **F** frames selected component, **A** frames whole asset when Asset Editor/Preview is under cursor; `dockManager.registry` used for panel hotkey routing.

## Archived from CHANGELOG.md (Dialogue MVP + Asset Preview camera)

- **Dialogue MVP runtime (Фаза E)**: DialogueRunner интерпретатор, ConditionEvaluator для условий, DialogueTriggerBehavior компонент; OnDialogueEnded event-граф вход, StartDialogue action; Scene.dialogues и dialogue state (dialogueActive/dialogueRunner); PlayerMovementBehavior паузится при активном диалоге.
- **Asset Preview viewport camera**: Preview panel is a canvas mini-viewport with local camera (RMB pan, wheel zoom toward cursor, MMB drag zoom); grid + asset body + component overlays redraw without resetting pose on property edits.

## Archived from CHANGELOG.md (Event Graph MVP + Asset Editor data/layout)

- **Event Graph MVP runtime** (Фаза D): engine-side interpreter for level-scope event graphs (`src/engine/eventgraph/`); NodeRegistry pattern like BehaviorRegistry; EventGraphRuntime executes graph traversal via entry dispatch (OnStart/OnTick/OnCollisionEnter/OnCollisionExit/OnInteract/OnTimer/OnCustomEvent); Conditions: Compare/And/Or/Not (inline spec-based, not graph edges); Actions: SetVariable/SetComponentEnabled/Teleport/DestroyObject/EmitCustomEvent; integration with TriggerBehavior.notifyCollision() + SetComponentEnabled now live-flips .enabled at runtime.
- **Asset Editor layout persist**: float remembers relative position/size (`relX/Y/W/H`) + full inner split-tree in `panels.dock.assetEditorLayout` across close/reopen and sessions; reopen remaps leaf ids.
- **Asset Editor data wiring**: typed component property forms from `ComponentPropertySchema` (collider/trigger/interactable/spriteUiAnimation/playerStart + raw JSON fallback); defaults on `createComponentStub`; Components list shows type/props count + fixed **Add Component** bar; Details: enabled + fields; Preview: resolved image, AABB/radius overlays for selected component; Identity: id/path/tags/status.

## Archived from CHANGELOG.md (Asset Editor float shell)

- **Asset Editor float**: modal `ActorPropertiesWindow` removed; dblclick/open asset → dock floating workspace (`role=assetEditor`) with panels `assetPreview` / `assetIdentity` / `assetComponents` / `assetComponentDetails`; live `assetManager.updateAsset`; state `editingAssetId` / `editingComponentId`; `DockManager.openAssetEditorWorkspace` / `closeAssetEditorWorkspace` / `syncAssetEditorTitle`; View menu stays level types only; type-menu filters asset* vs level types.

## Archived from CHANGELOG.md (D1/D2 multi-instance polish)

- **D1**: Assets dock copies persist UI per leaf (`ui.assetCopyUiState[instanceKey]`: tabs, size, viewMode, foldersWidth); primary prefs unchanged; flush on `savePanelUiPreferences`.
- **D2**: Outliner dock copies keep independent type filters (primary only writes `outliner.activeTypeFilters`); search already per-instance.
- **Q-GOD**: `ViewportOperations.js` / `UIFactory.js` back under 400-line guardrail (check:size green without new OVERRIDES).
- **B2**: browser smoke multi-viewport + Assets×N closed (0 editor console errors; multi-drop; folders width independent).

## Archived from CHANGELOG.md (A5)

- **A5**: Assets «Panel Settings» (RMB empty / gear path) opens global Settings on the **Assets** tab; `SettingsPanel.show(tab)` / `LevelEditor.openSettings(tab)`.

## Archived from CHANGELOG.md (C4 + Engine follow-player)

- **C4**: adaptive fit of game-camera design frustum into any viewport (letterbox safe-rect); `CameraAspectUtils`; design zoom preserved in object props.
- **Engine**: GameEngine now follows player with camera each tick via `_updateCamera()` method (centers camera on player position; no change if level has no playerStart).

## Archived from CHANGELOG.md (C3-toggle)

- **C3-toggle**: cam icon click + hotkey `.` toggle work ↔ last/selected game camera; `setSource` refreshes chrome icon; RMB opens source menu; menu pick still updates icon/check.

## Archived from CHANGELOG.md (C3 + Player Start component)

- **C3**: Multiple game cameras — exclusive `properties.isMain` (Details Main; first placed camera auto-main); jump `.` fallback selected→last→main; cycle `]`/`[` binds focused viewport + selects; chrome menu ★ main; gold frustum for main (`FRAME_COLOR_MAIN`).
- **fix**: auto-created Player Start (`FileManager.createNewLevel`/`ObjectOperations.ensurePlayerStartExists`) had no `playerStart` component — Play-in-editor showed only the static marker, no controllable player. Both now attach the component; regression tests added.

## Archived from CHANGELOG.md (NUM-SCRUB)

- **NUM-SCRUB**: Global numeric fields via `src/utils/NumericInput.js` + `styles/numeric-input.css` — no native spinner arrows anywhere (Settings, Grid, Actor Properties, Layers parallax, Details). `createSettingsInput({type:'number'})` / `UIFactory` coerce to scrub text; `NumericInput.wireAll(root)` after render; leftover `type=number` stripped by CSS + wireAll.

## Archived from CHANGELOG.md (DET-LIVE / CAM-HIDE)

- **DET-LIVE**: Details live transform/camera fields, scrub numerics in Details, live viewport from Details; no selectedObjects re-fire on property change.
- **CAM-HIDE**: game-source viewport hides driving camera asset.

## Archived from CHANGELOG.md (Engine Phase 2)

- **Engine Phase 2**: Input system and player movement — `src/engine/Input.js`, `PlayerMovementBehavior`, `Scene.spawnPlayer()`, `GameEngine` Input lifecycle.

## Archived from CHANGELOG.md (C2)

- **C2**: camera aspect presets (16:9/4:3/1:1/3:2/21:9/custom), game-viewport letterbox + vignette; Details Aspect/Resolution/Vignette.

## Archived from CHANGELOG.md (C1)

- **C1**: game-camera view frame gizmo — dashed frustum (default 1920×1080 / zoom) on canvas for each `type===camera` object; skip active game-source of the current viewport.

## Archived from CHANGELOG.md (TB-OP)

- **TB-OP**: Settings → General → «Toolbar Background Opacity» (`ui.toolbarBackgroundOpacity`, 0–1); underlay uses `--ui-toolbar-background-color` (bg × opacity) for primary + viewport toolbar copies.

## Archived from CHANGELOG.md (DK-CLS)

- **DK-CLS**: leaf-header close × only while Shift layout-edit (`body.dock-customize`) and only on the header under the cursor; floating-window chrome × unchanged.
- **DK-CLS**: close × uses opacity (always in layout, fixed 20×18) so header height/panel position do not jump on hover.

## Archived from CHANGELOG.md (toolbar hide + leaf caret)

- Toolbar RMB **Hide**: per-instance only (not global `view.toolbar` / sibling copies).
- Viewport leaf header: **▾** is a separate control right of the panel title (not type-menu); appears only when that leaf’s toolbar is hidden; click restores toolbar and hides ▾. Title alone opens type menu.
- Removed residual toolbar strip when hidden — toolbar container fully `display:none`.

## Archived from CHANGELOG.md (view menu + outliner ctx)

- View menu: remove Viewport toggle (last viewport leaf cannot be closed).
- View menu Grid / Boundaries / Collisions / Parallax apply to all viewport copies (`setDisplayFlagAll`); eye menu, paired toolbar, and hotkeys stay per-view.
- Outliner context menu: remove Select; Toggle Visibility uses selection (same as H / `toggleVisibilityForSelection`).

## Archived from CHANGELOG.md (view menu + outliner ctx prior)

- Outliner: click empty space (primary + dock copies) clears object selection.

## Archived from CHANGELOG.md (outliner empty-click deselect)


- Fix: Outliner context menu flicker (open → reselect under cursor → close/reopen) — select target on RMB mousedown before `contextmenu`; do not change selection inside `showContextMenu` (that triggered `updateAllPanels` mid-open).

## Archived from CHANGELOG.md (outliner context menu flicker)

- Fix: after RMB pan, releasing over panels/UI no longer opens that panel's context menu (`wasPanning` / `suppressContextMenu` capture block + global mouseup finishes pan path).
- Feature: Canvas/Outliner context menus — stack order (Bring to Front / Send to Back / Bring Forward / Send Backward) via `ObjectOperations.applyStackOrderActionToSelection` (same as Details); separators around layer-move block.

## Archived from CHANGELOG.md (pan suppress menu + stack order menus)

- Fix: canvas context menu (RMB on objects/assets in viewport) missing on secondary viewport leaves and floats — `ViewportViewNav` only called `preventDefault`; now routes to shared `CanvasContextMenu` (same as primary). Assets panel copies use unique ContextMenuManager ids (no primary overwrite).

## Archived from CHANGELOG.md (viewport copy canvas context menu)

- Fix: asset drop onto viewport showed only selection frames until mouse moved (and same on viewport copies) — `handleDrop` cleared spatial index but not `visibleObjectsCache` (same class of bug as duplicate place).

## Archived from CHANGELOG.md (asset-drop visible cache fix)

- Feature **U4**: Context menu **Move to Layer** (Canvas + Outliner) — flyout of all layers; current layer / locked disabled; also **Move Layer Up/Down** (PageUp/PageDown). API: `LayerOperations.moveSelectedObjectsToLayerId` + `buildMoveToLayerMenuItems`. Outliner ensures right-clicked object is in selection. `BaseContextMenu` submenus accept function-valued `items` (resolved each open).

## Archived from CHANGELOG.md (U4 Move to Layer commit)

- Feature **U3**: File → **Open Recent** — MRU levels/projects (up to 10) with JSON snapshot in `userPrefs` / `editor.recentFiles`; open/save level or project records the list; browser has no path, so re-open uses the cache (`RecentFilesManager`). Submenu rebuilds on hover; **Clear Recent**.

## Archived from CHANGELOG.md (U3 Open Recent commit)

- Feature **U2**: toolbar + Details stack-order buttons show live hotkeys in native `title` (`Label (Ctrl+S)`); source = Settings → Hotkeys / `shortcuts.json`; respects `ui.showTooltips`; rebind refreshes via `LevelEditor.refreshUiShortcutTitles`.
- Fix: `saveProject()` cached the file name derived from the project's default "Untitled Project" name on first save and kept reusing it forever, so renaming the project via Project Settings afterward had no effect on the saved file name. Now tracked via `Project.fileNameIsAuto` — the name re-derives on every save until pinned by an explicit Save As / Open.

## Archived from CHANGELOG.md (U2 tooltips commit)

- Fix: pan/zoom/F/A while a viewport is bound to a **game Camera** no longer unlocks to work camera — pose writes into the Camera object; jump-to-camera binds `source: game`.

## Archived from CHANGELOG.md (game-cam pan keep source commit)

- Feature: **VP-OVL** — per-viewport info overlay (DOM HUD): camera source, zoom, active display-flag badges (parallax/boundaries/collisions), level name + objects/layers/selection counts. Toggle via viewport eye menu **Info** (`displayOptions.infoOverlay`, default on). Module: `ViewportInfoOverlay.js`.

## Archived from CHANGELOG.md (VP-OVL commit)

- Feature: **Game** top-level menu — moved **Play** out of the toolbar into `Game > Play`; added `Game > Build...`, which saves the project and generates `build-game.bat` (via `FileUtils.saveDataDirectly`) that runs `npm run build:game` — browser has no shell/fs access to invoke esbuild itself. Both files need to end up next to `package.json`.
- Fix: `FileUtils.saveDataDirectly`'s native save-picker filter was hardcoded to `.json` regardless of the caller's `mimeType`/filename (would have forced `.bat` saves through a JSON filter) — now derives the picker `accept`/description from the actual filename extension.

## Archived from CHANGELOG.md (VP-BND commit)

- Feature **DK-CLP**: click leaf header gap collapses panel when stacked vertically (column parent + expandable sibling); expand on second click; state on `leaf.collapsed` (persisted with dock tree).

## Archived from CHANGELOG.md (DK-CLP commit)

- Fix: body-fixed menus (`MenuPositioningUtils`) use `z-index: 10000` so viewport chrome cam/filter/eye (and other popups) work over floating windows (`#floating-layer` was 100 > old `z-50`).

## Archived from CHANGELOG.md (Game menu commit)

- Fix **VP-BND**: multi-viewport boundaries / collisions / hit-test overlay / group-edit frame use frame camera for stroke scale (peer zoom no longer changes sibling debug overlays).

## Archived from CHANGELOG.md (build:game commit)

- UX **DK-CUR**: leaf header drag-gap cursor is `pointer` by default; `grab`/`grabbing` only while Shift (`body.dock-customize` via `bindDockCustomizeModeClass`); floating window chrome free-move still grab without Shift.

## Archived from CHANGELOG.md (float chrome menus z-index fix)

- Feature **DK-GST**: Shift-drag leaf with no dock drop target shows floating-window ghost (`.float-detach-ghost`); detach size/pos via `floatDetachLayoutFromClient` (workspace-local coords).

## Archived from CHANGELOG.md (DK-GST commit)

- UX **DK-CUR**: leaf header drag-gap cursor is `pointer` by default; `grab`/`grabbing` only while Shift (`body.dock-customize` via `bindDockCustomizeModeClass`); floating window chrome free-move still grab without Shift.

## Archived from CHANGELOG.md (DK-CUR commit)

- Cleanup **DK-ICO**: removed leaf-header detach icon (`⇱`); float only via Shift+drag gap (`onNoTargetDrop`); dropped dead `detachLeafToFloating`. *(повторно сброшено из Unreleased при коммите DK-CUR)*

## Archived from CHANGELOG.md (DK-ICO commit)

- Cleanup **DK-ICO**: removed leaf-header detach icon (`⇱`); float only via Shift+drag gap (`onNoTargetDrop`); dropped dead `detachLeafToFloating`.

## Archived from CHANGELOG.md (OL-F commit)

- Feature **OL-F**: hotkey **F** over Outliner scrolls the object list to selection (`scrollToSelection`) — single row centers; multi uses average Y; expands collapsed ancestor groups; otherwise F still frames on viewport under cursor (VP-HK).

## Archived from CHANGELOG.md (VP-EQ commit)

- Fix **VP-EQ**: viewport leaves equal for display/filter/work camera — `setDisplayFlag` no longer writes global state; each view owns seeded `displayOptions`; work pose always `localCamera` (focused mirrors to level-save camera); menu/hotkeys target under-cursor/focused/any; last viewport only non-closeable; promote-to-shell carries pose/display/filters.

## Archived from CHANGELOG.md (VP-TB commit)

- Feature **VP-TB**: копии Toolbar для копий viewport (`DockPanelFactory` + `Toolbar` isCopy/viewLeafId) — View toggles и Focus/Focus All работают на paired leaf; File/Edit/Group/Play/Snap глобальные; `refreshViewportToolbars` + sync hide/show с View→Toolbar.

## Archived from CHANGELOG.md (VP-EYE commit)

- Feature **VP-EYE**: иконка глаза в шапке viewport — меню Grid/Boundaries/Collisions/Parallax для этого viewport (`ViewportLeafChrome` + `ViewportViewManager.getDisplayFlag/toggleDisplayFlag`, тот же per-view `displayOptions` что и у VP-HK).

## Archived from CHANGELOG.md (VP-HK commit)

- Feature **VP-HK**: хоткеи F / A / Grid / Boundaries / Collisions / Parallax (и jump-to-camera) применяются к viewport **под курсором** — `displayOptions` per view + камера leaf, не только primary/global.

## Archived from CHANGELOG.md (AS-REN-END commit)

- Fix **AS-REN-END**: клик в пустое место панели Assets (и любой outside click) всегда завершает inline rename — document capture `pointerdown`, не только `blur`.

## Archived from CHANGELOG.md (engine Фаза 3 commit)

- Feat (engine Фаза 3): Play-in-editor — `src/core/PlayOperations.js` сериализует текущий уровень через `ProjectExporter.export()`, валидирует наличие Player Start (`editor.getPlayerStartCount()`), поднимает `GameEngine` в fullscreen-overlay canvas (вне `ViewportViewManager`/`RenderOperations`, чтобы не конкурировать с editor-рендером); toolbar-кнопка Play/Stop (`toggle-play`), `Esc` останавливает через `EventHandlers.handleKeyDown` (`playMode`-guard блокирует остальные editor-хоткеи во время игры). Без Input/player-controller — сознательно отложено на отдельный шаг.

## Archived from CHANGELOG.md (pre engine Фаза 3 commit)

- Feat **AS-FAV / AS-MMB**: пустые favorites — серый «Drop favorite folders here»; MMB по закладке фолдера снимает её.

## Archived from CHANGELOG.md (VP-COL/FIL commit)

- Fix **VP-COL**: цвет иконки game camera в шапке viewport обновляется сразу при смене color/name объекта (`objectPropertyChanged` → `refreshAllViewportChrome`).
- Fix **VP-FIL**: активный type-filter в шапке viewport — синяя иконка (как Outliner/Assets `bg-blue-600`).

## Archived from CHANGELOG.md (AS-REN/F2/DBL commit)

- Feat **AS-REN / AS-F2 / AS-DBL**: rename ассета inline (поле имени, без dialog); F2 над Assets → selected library asset; dblclick на имени → rename, на thumbnail → properties.

## Archived from CHANGELOG.md (VP-MMB commit)

- Fix **VP-MMB**: middle-button drag zoom снова работает — canvas внутри dock `.leaf-body` больше не уходит в ScrollUtils pan (`MouseHandlers._shouldDeferMiddleMouseToPanel`).

## Archived from CHANGELOG.md (engine Фаза 2 commit)

- Feat (engine Фаза 2): BehaviorRegistry + 4 MVP-компонента (Collider, Trigger, Interactable, PlayerStart) — `src/engine/BehaviorRegistry.js`, `src/engine/behaviors/{Behavior,AABB,ColliderBehavior,TriggerBehavior,InteractableBehavior,PlayerStartBehavior,registerDefaultBehaviors}.js`; Entity/EntityFactory/Scene/GameEngine обновлены для `_update(dt)` и duck-typed behavior injection; 27 новых тестов (91→118).

## Archived from CHANGELOG.md (pre engine Фаза 2 commit)

- Feat (engine Фаза 1): MVP-ядро движка — `src/engine/` (Entity, EntityFactory, Scene, ProjectLoader, Renderer, AssetLoader, GameEngine), самодостаточен (ноль импортов из editor-кода), 21 тест vitest.
- Feat (A1–A3): Assets context menu **Rename** / **Duplicate** / **Delete** — `AssetItemActionsController` (prompt rename → `updateAsset`; clone via `addExternalAsset` as temporary unsaved; delete with confirm, multi if target in selection, in-memory only + `assetsLibraryDirty`).

## Archived from CHANGELOG.md (B1 parallax fix)

- Fix (B1): `ParallaxRenderer.getParallaxOffset` — shift = `cameraOffset × parallaxOffset` (было `× (1 + offset)`: любой ненулевой offset давал ~2× скорость и разрыв с offset=0). Скорость слоя = `1 + offset` (−0.8 far, 0 none, 0.5 near, −1 screen-fixed). Docs: `USER_MANUAL` UI layer −1, not 0.

## Archived from CHANGELOG.md (pre B1 parallax fix)

- Chore: cleared obsolete `tmp/*` (refactor/dock/perf/multi-level plans, prototype, one-off check scripts); kept only `tmp/2D_Editor_ENGINE_PLAN.md` for parallel engine work.
- Refactor tail: `EditorPreferencesController.saveEditingPreferences` / `savePanelUiPreferences` / `saveAllUserSettings`; Assets type filters single-source (`activeTypeFilters` only); removed dead `handleAssetClick`; OVERRIDES/comments no longer point at deleted plans.
- Assets folders resizer per instance (unique id + owner in ResizerManager); collapse tab on dblclick restore; removed center tongue (`::after`) on panel/dock split lines.
- Assets multi-instance: dock copies UI-independent (`AssetPanel.uiStateKey` → `panelUI.<instanceKey>.*`) — own selection/tabs/filters/view; catalog + canvas drop shared; prefs primary only.
- Engine plan Фаза 0: `docs/RUNTIME_SCHEMA.md` (per-type schema contract, 29 asset + 19 component types) + `docs/CONTENT_MODEL.md` (Project/Addon/Special Event manifest formats) + `ProjectExporter.js` (editor-Project → runtime-Project manifest transform, unused so far) + `Level.meta.version` default `'dynamic'` → `'1.0.0'`.

## Archived from CHANGELOG.md (B5 commit 8c4ad4fe)

- B5: removed `PanelPositionManager` + `src/ui/panels/*`; layout is dock-only (`editor.dockManager`). Dropped L/R tab prefs listeners, dead `setupTabDragging`, panel dock CSS for `#left-tabs-panel`/`#right-tabs-panel`.

## Archived from CHANGELOG.md (pre B5 commit)

- Fix: Assets multi-select **click-drag drop on canvas** — mousedown keeps multi if item already selected; `dragstart` ships full `selectedAssets`; post-drag click does not sole-select.
- Fix: empty-canvas click clears full multi-selection (0×0 replace marquee no longer re-hits a nearby object as sole select).
- Fix: **Assets panel** marquee — after modifier threshold, keep `pendingMouseKey` so move tracks `isAssetMarqueeSelecting` (rect + Shift/Ctrl modes); panel mouseup no longer wipes canvas marquee keys.
- Fix: canvas gesture lock — global move continues pending modifier-marquee; lock arms when marquee/transform actually starts (viewport OK).
- Fix: **Assets** first-click miss — keep `mouseStateKey`/`marqueeId` in `BasePanel.setupSelection` (asset marquee no longer sets canvas `isMarqueeSelecting`); select assets on mousedown (HTML5 `draggable` was swallowing click).
- Fix: panel clicks requiring a second try — `viewport-gesture-mode` no longer arms on bare `isLeftDown`/`isRightDown` (only real drag/marquee/pan/zoom), so `pointer-events:none` does not swallow the first UI click.
- Dock floating: keep **relative** position on workspace resize; optional **edge snap** to workspace (`panels.dock.floatEdgeSnap`, margin `panels.dock.floatEdgeMargin`) — Settings → General → Floating Windows.
- Dock: floating window **resize** free of Shift; resize grip only when pointer is in bottom band of the window.
- Dock UI customize: hold **Shift** for layout ops (move/split/copy/detach/snap) and drop/snap highlights; release mid-drag clears highlight and cancels layout commit (`isDockCustomizeKey`).

## [Unreleased] (РґРѕ commit Shift dock customize)

- Docs: ARCHITECTURE / Context_map / EVENT_HANDLER_SYSTEM вЂ” Phase B dock B3вЂ“B4.2 multi-viewport, gestures, TypeFilterMenu, English chrome UI.
- Viewport camera source menu + chrome tooltips: English only (Work camera / Game camera / empty state).
- Fix multi-view pan cursor leak: RMB/MMB no longer stamp `grabbing`/`zoom-in` on primary while secondary pans; end/blur resets cursors on all viewport canvases.
- Viewport leaf chrome (cam / filter): after first open, hover over sibling icon switches menus (main-menu style); leave chrome+menu exits hover mode.
- Viewport gestures (object drag / marquee / transform / pan / zoom) continue outside the leaf: left-button `setPointerCapture`; release outside completes (does not cancel) via same path as canvas mouseup; `viewport-gesture-mode` blocks hover on other dock/UI during the gesture.
- Fix multi-viewport object flicker while dragging: `visibleObjectsCache` key includes canvas size (shared camera в‰  shared frustum); during drag/transform/marquee sticky cache + full cull scan instead of stale spatial index TTL rebuilds; refresh spatial/visible cache on drag end.
- Fix pick/marquee under cursor (multi-view + dock CSS): `screenToWorld`/`worldToScreen` map clientв†’buffer when canvas CSS is `100%` but buffer is floor(measure); `getSelectableObjectsInViewport` uses interaction camera/canvas (not primary-only); hit-test/click-cycle tolerance uses interaction zoom вЂ” restores rotated-object math vs wrong frustum/zoom.
- Viewport close (Г—): all viewports closeable when в‰Ґ2 exist (not only copies); promote former copy to primary shell if primary closed.
- Camera/type menus: `alignment:right` + `repositionMenu` after fill (flush under icon, not far left from guessed width).
- Leaf header: title/caret `cursor:pointer` + type menu only; grab/drag only on empty gap between title and right icons.
- Fix multi-viewport pick/drag: world coords use interaction leaf canvas (not primary after render restore); global mouseup/move bounds + left-drag continue on secondary; wheel no longer sticky-pins wrong leaf; marquee overlay only on interaction view.
- Fix viewport copy close (Г—): append after mount via `isLeafCloseable`.
- Fix: `AssetPanel.getActiveTabPath()` restored вЂ” Add menu / `createAssetOfType` no longer always see Content root.
- Type filters (Outliner / Assets / Viewport): shared `TypeFilterMenu` вЂ” toggle applies immediately, menu stays open, no Ctrl multi-session.
- Fix viewport chrome: camera icon default + re-sync after mount (self-drop clone no longer blank cam btn).
- Dock leaf header: grab/drag only on title strip (`.drag-handle`); type-menu only on title text; viewport camera btn вЂ” gray minimal SVG for work cam, stroke tinted with game camera object `color`.
- **B4.2 multi-viewport:** `ViewportViewManager` вЂ” work camera (`stateManager.camera` on primary) vs game cameras (level objects `type===camera`); N viewport leaves with independent canvas/pose/type-filters; leaf header camera source + filter; secondary uses same `MouseHandlers` as primary (RMB pan, MMB zoom, wheel); pointer-capture + global move so pan/zoom continues outside leaf; canvas bg fills leaf; self-drop viewport clone; primary non-closeable when sole, copies closeable.
- **B4 (Phase B dock):** multi-instance panel copies вЂ” `singleton:false` for outliner/details/layers/levels/assets; roots/instances keyed by leaf `node.id`; `DockPanelFactory` creates secondary panel instances; close copy в†’ destroy, close primary в†’ park; type-menu allows second multi leaf (`+`) / singleton still swaps (`в‡„`); panel `instanceKey` for search/context-menu ids.
- Layers/Levels list reorder: empty insertion slot under cursor during drag (`ListReorderPlaceholder`); drop order from slot index.
- Fix list reorder: do not collapse row in `dragstart` (aborts HTML5 DnD); collapse on first `dragover`; `dataTransfer.setData` + `closest` row.
- Fix: middle-click drag scroll on Levels/Details вЂ” list/root got real `overflow:auto` (dock roots were `overflow:hidden` with no inner scroller); both axes; Levels/Layers reuse list node for stable pan target.
- Panel scrollbars: setting `ui.scrollbarSize` (1вЂ“24px, default 2) in UI Settings; runtime `#ui-scrollbar-runtime-styles` with !important; removed `scrollbar-color`/`scrollbar-width:thin` on Chromium (they forced system-thick bars); no 6px floor; console/BasePanel hard-coded 8/6px overrides removed.
- Middle-pan `panning-mode` kills hover on other UI.
- Default layer color: `#F5E6A3` (pale yellow) instead of blue.
- List color swatch: `color.shape` (`circle`|`square`) in `createListItemRow`; shared `.list-color-swatch--*`; layers circle / levels square; fill stays panel-specific.
- **B3.1 (Phase B dock):** View в†’ Panels lists dock contentTypes (Viewport/Outliner/Details/Layers/Assets/Levels) instead of Left/Right/Assets Panel; `DockManager.hideContentType`/`toggleContentType` + menu sync on structure change; Alt+1/2/4 в†’ Outliner/Details/Assets; Immersive Mode uses dock layout snapshot (viewport-only), not legacy L/R flags.
- **B3 (Phase B dock):** primary panels (Outliner/Details/Layers/Levels/Assets) reparent into dock leaves via `DockContentRegistry._mountPrimaryPanel`; assets no longer fixed footer (`#resizer-assets` hidden; auto-height / prefs / View visibility skipped when dock active); leaf fill CSS for panel roots.
- Fix dock: restored leaf content-type menu (tap title/caret; singleton swap `в‡„`); `DockTypeMenu.js`.
- Fix dock: restored self-drop duplicate (drop on own leaf в†’ clone + split), as in prototype.

## [Unreleased] (РґРѕ commit Phase B B3вЂ“B4.2, 2026-07-15)

- **B2 (Phase B dock):** viewport leaf hosts real toolbar + canvas (`DockContentRegistry._mountViewport`); canvas reparented into `#canvas-viewport` (leaf measure, not full-screen absolute); ResizeObserver always on measure host; `resizeCanvas` dock-hosted fill path.
- Fix dock: horizontal (`resizer-row`) splitters hit-target вЂ” reset global `.resizer { width: 6px }` via `width: auto; align-self: stretch`.
- Fix dock: removed debug `#dock-chips` strip (blocked main menu dropdowns; reopen via `dockManager.showContentType` / View later).
- **B1 (Phase B dock):** `DockContentRegistry` (6 singleton types, placeholder mount); `DockPersistence` (`panels.dock.mainTree` / `panels.dock.floatingWindows`); chips only for missing types; viewport non-closeable + chip reopen; no type-menu/duplicate-on-drag; default tree includes assets as bottom strip; `DockFloatOps` extracted for size limit.

## [Unreleased] (РґРѕ commit f07084b, 2026-07-15)

- **B0 (Phase B dock):** split-tree engine port in `src/ui/dock/` (`DockTreeModel`, `DockRenderer` with leaf reparent by `node.id`, `DockDragController`, `DockDropOverlay`, `DockManager`); `styles/dock.css`; `index.html` shell `#dock-workspace` + chips; legacy panel DOM in `#dock-legacy-offtree`; `editor.dockManager` wired with placeholders (real panels B2вЂ“B3).
- Fix B0 boot: skip legacy `PanelPositionManager.initializePanelPositions` when `dockManager` is active (removed flex shell в†’ null `appendChild`); suppress 0Г—0 `resizeCanvas` warn while viewport is in `#dock-legacy-offtree`.
- Refactor: Р¤Р°Р·Р° A РїР»Р°РЅР° `tmp/2D_Editor_REFACTOR_PLAN_v2.md` (РЅРµ-UI СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Рµ РЅР°С…РѕРґРєРё Р°СѓРґРёС‚Р°) Р·Р°РІРµСЂС€РµРЅР°.
- **A0**: CONTRIBUTING.md вЂ” РґРѕР±Р°РІР»РµРЅ СЂР°Р·РґРµР» "РљР°РєРѕР№ Р±Р°Р·РѕРІС‹Р№ РєР»Р°СЃСЃ/РїР°С‚С‚РµСЂРЅ РІС‹Р±СЂР°С‚СЊ" СЃ РєСЂРёС‚РµСЂРёСЏРјРё РІС‹Р±РѕСЂР° BaseManager/BaseModule/РіРѕР»С‹Р№ constructor/PanelSubController
- **A1**: LevelEditor.js вЂ” СѓРґР°Р»РµРЅС‹ `findObjectInGroup`/`findObjectInGroupRecursive` (РґСѓР±Р»РёСЂСѓСЋС‰РёРµ РѕР±С…РѕРґ РґРµСЂРµРІР° РіСЂСѓРїРї); РёРЅС‚РµРіСЂР°С†РёСЏ СЃ `GroupTraversalUtils.findInObjects`/`findInGroup`; С„Р°Р№Р» СЃРѕРєСЂР°С‰С‘РЅ ~1583в†’1500 СЃС‚СЂРѕРє; РґРѕР±Р°РІР»РµРЅ С‚РµСЃС‚ tests/LevelEditor.findObject.test.js (С…Р°СЂР°РєС‚РµСЂРёР·Р°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ РґР»СЏ A1)
- **A2**: `ensurePlayerStartExists()` Р»РѕРіРёРєР° Р°РІС‚РѕСЃРѕР·РґР°РЅРёСЏ Player Start РїРµСЂРµРЅРµСЃРµРЅР° РёР· LevelEditor.js РІ ObjectOperations.js; РґРµР»РµРіР°С‚ РѕСЃС‚Р°Р»СЃСЏ РІ LevelEditor.js
- **A3**: AssetManager.js вЂ” РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `getAssetById(id)` (null-safe Р°Р»РёР°СЃ), СѓСЃС‚СЂР°РЅСЏРµС‚ РєСЂР°С€ РІ AssetItemActionsController
- **A4**: ConfigManager.js вЂ” СѓРґР°Р»С‘РЅ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ РјС‘СЂС‚РІС‹Р№ РјРµС‚РѕРґ `loadDefaultConfigs()` (~106 СЃС‚СЂРѕРє)
- **A5.1**: BaseModule.js вЂ” РґРѕР±Р°РІР»РµРЅ РѕР±С‰РёР№ РјРµС‚РѕРґ `hasActiveMouseOperation()` (Р·Р°РјРµРЅРёР» РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ РїСЂРёРІР°С‚РЅС‹Рµ РєРѕРїРёРё РІ LevelFileOperations/ProjectFileOperations)
- **A5.2**: RenderOperations.js вЂ” РґРѕР±Р°РІР»РµРЅС‹ РїСЂРёРІР°С‚РЅС‹Рµ С…РµР»РїРµСЂС‹ `_getValidCanvasOrNull()` Рё `_computeExtendedViewportBounds()` (СѓСЃС‚СЂР°РЅРµРЅРѕ С‚СЂРѕР№РЅРѕРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ preamble-РїСЂРѕРІРµСЂРѕРє)
- **A5.3**: SnapUtils.js вЂ” РґРѕР±Р°РІР»РµРЅС‹ СЃС‚Р°С‚РёС‡РµСЃРєРёРµ РјРµС‚РѕРґС‹ `findNearestSnapGridPoint()` Рё `computeBottomLeftSnapDelta()` (СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ inline-Р»РѕРіРёРєРё snap-to-grid)
- **A6.1**: BaseGridRenderer.js вЂ” Template Method РїР°С‚С‚РµСЂРЅ: `render()` СЃС‚Р°Р» РєРѕРЅРєСЂРµС‚РЅС‹Рј, `drawGrid()` Р°Р±СЃС‚СЂР°РєС‚РЅС‹Р№; РЅР°СЃР»РµРґРЅРёРєРё СЂРµР°Р»РёР·СѓСЋС‚ С‚РѕР»СЊРєРѕ `drawGrid()`
- **A6.2**: PerformanceUtils.js вЂ” `memoizeWithInvalidation()` РїРµСЂРµРІРµРґРµРЅР° РЅР° РєРѕРјРїРѕР·РёС†РёСЋ СЃ `memoize()` (СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ cache-Р»РѕРіРёРєРё)
- **A8**: Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅР° СЃ РєРѕРґРѕРј: Context_map.md, ARCHITECTURE.md, CHANGELOG.md РѕР±РЅРѕРІР»РµРЅС‹ РЅР° v4.0.0
- Fix: `AssetManager.loadImage()` С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°РµС‚ `window.editor?.render?.()` РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ РєСЌС€РёСЂРѕРІР°РЅРёСЏ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ вЂ” СѓСЃС‚СЂР°РЅСЏРµС‚ Р±Р°Рі, РєРѕРіРґР° РѕР±СЉРµРєС‚, РѕС‚СЂРёСЃРѕРІР°РЅРЅС‹Р№ РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ Р°СЃРёРЅС…СЂРѕРЅРЅРѕР№ Р·Р°РіСЂСѓР·РєРё РєР°СЂС‚РёРЅРєРё, РѕСЃС‚Р°РІР°Р»СЃСЏ РїР»РµР№СЃС…РѕР»РґРµСЂРѕРј РґРѕ СЃР»СѓС‡Р°Р№РЅРѕРіРѕ СЃР»РµРґСѓСЋС‰РµРіРѕ render()

## [Unreleased] (РґРѕ commit ac7a8b3, 2026-07-14)

- Refactor: Р¤Р°Р·Р° 6 (С‚РѕС‡РµС‡РЅС‹Р№ РґРµРґСѓРї) вЂ” `GitUtils.js` (РѕР±С‰РёР№ `runGitCommand()` РІРјРµСЃС‚Рѕ С‚СЂС‘С… РєРѕРїРёР№ spawn-РѕР±РІСЏР·РєРё), `DiamondGridRenderer.js` (РѕР±С‰РёР№ `drawDiagonalLines()` РІРјРµСЃС‚Рѕ РґРІСѓС… РєРѕРїРёР№ 60В°/120В°), `SettingsSyncManager.js` (`applyColorSettings`/`applySelectionSettings`/`applyStatusBarColors` РІС‹РЅРµСЃРµРЅС‹ РёР· `applySpecialUISettings`/`applyInitialColorSettings`), РЅРѕРІС‹Р№ `src/utils/ImageUtils.js` (`getImageDimensions`, РёСЃРїРѕР»СЊР·СѓРµС‚ `AssetImporter`/`AssetViewRenderer`; `getDefaultColor`/`getAssetTypeFromCategory` РѕСЃС‚Р°РІР»РµРЅС‹ СЂР°Р·РґРµР»СЊРЅС‹РјРё вЂ” СЂР°Р·РЅС‹Рµ РЅР°Р±РѕСЂС‹ РєР°С‚РµРіРѕСЂРёР№, СЃР»РёСЏРЅРёРµ РёР·РјРµРЅРёР»Рѕ Р±С‹ РїРѕРІРµРґРµРЅРёРµ), `LayersPanel.js` (dblclick-РѕР±СЂР°Р±РѕС‚С‡РёРє РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚ `renameLayer()`), `OutlinerPanel.js` (`createOutlinerNameContainer()`/`applyLockedRowState()` РѕР±С‰РёРµ РґР»СЏ `renderGroupNode`/`renderObjectNode`).
- Р¤Р°Р·Р° 7 (РґРѕР»РіРѕСЃСЂРѕС‡РЅС‹Рµ guardrails) вЂ” РЅРѕРІС‹Р№ `CONTRIBUTING.md` (РїСЂР°РІРёР»Рѕ: РїРµСЂРµРґ РЅРѕРІС‹Рј С„Р°Р№Р»РѕРј РёСЃРєР°С‚СЊ РїРѕРґС…РѕРґСЏС‰РёР№ Controller/Operations-РєР»Р°СЃСЃ), `npm run check:dedup` (`npx jscpd --min-lines 15`), overrides РІ `scripts/check-file-size.js` СЃРІРµСЂРµРЅС‹ СЃ С„Р°РєС‚РёС‡РµСЃРєРёРј СЂР°Р·РјРµСЂРѕРј С„Р°Р№Р»РѕРІ (41 Р°РєС‚СѓР°Р»СЊРЅС‹С…, stale РЅРµС‚). Р РµС„Р°РєС‚РѕСЂРёРЅРі РёР· `tmp/2D_Editor_REFACTOR_PLAN.md` Р·Р°РІРµСЂС€С‘РЅ (Р¤Р°Р·С‹ 0вЂ“7).

## [Unreleased] (РґРѕ commit bec4958, 2026-07-14)

- Refactor: Р¤Р°Р·Р° 4 (РґРµРєРѕРјРїРѕР·РёС†РёСЏ AssetPanel) Р·Р°РІРµСЂС€РµРЅР° вЂ” РёР·РІР»РµС‡РµРЅС‹ 7 РєРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ: AssetFoldersController (Р¤Р°Р·Р° 4.1), AssetViewRenderer (614 СЃС‚СЂРѕРє, Р¤Р°Р·Р° 4.2), AssetFilterController (Р¤Р°Р·Р° 4.3), AssetSelectionController (Р¤Р°Р·Р° 4.4), AssetDragDropController (Р¤Р°Р·Р° 4.5), AssetItemActionsController (Р¤Р°Р·Р° 4.6), AssetToolbarController (Р¤Р°Р·Р° 4.7); AssetPanel.js 3099в†’1154 СЃС‚СЂРѕРє (62% СЃРѕРєСЂР°С‰РµРЅРёРµ); РІСЃРµ РєРѕРЅС‚СЂРѕР»Р»РµСЂС‹ РёСЃРїРѕР»СЊР·СѓСЋС‚ РїР°С‚С‚РµСЂРЅ `constructor(assetPanel)` (РІР»Р°РґРµРЅРёРµ РІРјРµСЃС‚Рѕ BaseModule); orchestration-СЃР»РѕР№ AssetPanel СЃРѕРґРµСЂР¶РёС‚ init, destroy, setupEventListeners, handleAssetWheel, handleDrop, handleAssetSave, autoResizePanelHeight Рё delegate-РјРµС‚РѕРґС‹.
- Refactor: Р¤Р°Р·Р° 4.5 (РґРµРєРѕРјРїРѕР·РёС†РёСЏ PanelPositionManager) вЂ” РёР·РІР»РµС‡РµРЅС‹ 4 РєРѕРЅС‚СЂРѕР»Р»РµСЂР° РІ `src/ui/panels/`: TabLayoutController (719 СЃС‚СЂРѕРє, СЂР°СЃРєР»Р°РґРєР°/collapse/resize), TabOrderController (379 СЃС‚СЂРѕРє, РїСЂРѕРіСЂР°РјРјРЅРѕРµ РїРµСЂРµРјРµС‰РµРЅРёРµ), TabDragController (428 СЃС‚СЂРѕРє, drag-n-drop), SplitPaneController (1016 СЃС‚СЂРѕРє, split-pane/detach); PanelPositionManager.js 2552в†’74 СЃС‚СЂРѕРє (thin facade); PanelSubController вЂ” РѕР±С‰Р°СЏ Р±Р°Р·Р° РґР»СЏ РєРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ; РІРЅРµС€РЅРёРµ РІС‹Р·РѕРІС‹ РѕР±РЅРѕРІР»РµРЅС‹ (togglePanelPosition/initializePanelPositions/ensurePanelExists в†’ tabLayoutController.*, removeEmptyPanel в†’ splitPaneController.*); `scripts/check-file-size.js` РѕР±РЅРѕРІР»РµРЅ (СѓРґР°Р»РµРЅ PanelPositionManager РёР· overrides, РґРѕР±Р°РІР»РµРЅС‹ С‚СЂРё РєРѕРЅС‚СЂРѕР»Р»РµСЂР°).
- Chore: СЂРµС„Р°РєС‚РѕСЂРёРЅРі Р¤Р°Р·Р° 3 (РґРµРєРѕРјРїРѕР·РёС†РёСЏ LevelEditor.js) вЂ” РёР·РІР»РµС‡РµРЅС‹ EditorConfigController, EditorLifecycleController, EditorPreferencesController (РІСЃРµ extends BaseModule); LevelEditor.js 2399в†’1583 СЃС‚СЂРѕРє; РІСЃРµ РёРјРїРѕСЂС‚С‹ 46в†’34; С…Р°СЂР°РєС‚РµСЂРёР·Р°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ (EditorConfigController.test.js).
- Feature: rotation/scale snap-СЃС‚РµРї (Shift РІРѕ РІСЂРµРјСЏ Ctrl-drag transform) РІС‹РЅРµСЃРµРЅ РІ РЅР°СЃС‚СЂРѕР№РєРё вЂ” Settings в†’ Selection ("Rotation Snap (Shift+drag, В°)" Рё "Scale Snap (Shift+drag, factor)"), РґРµС„РѕР»С‚ РІСЂР°С‰РµРЅРёСЏ РёР·РјРµРЅС‘РЅ СЃ 10В° РЅР° 15В° (backed by `selection.rotationSnapDegrees`/`selection.scaleSnapFactor` РІ StateManager/ConfigManager, `EditorConstants.TRANSFORM.*` С‚РµРїРµСЂСЊ С‚РѕР»СЊРєРѕ fallback).
- Chore: СЂРµС„Р°РєС‚РѕСЂРёРЅРі Р¤Р°Р·Р° 0 (СЃС‚СЂР°С…РѕРІРѕС‡РЅР°СЏ СЃРµС‚РєР°) вЂ” РїРѕРґРєР»СЋС‡С‘РЅ `vitest` (`npm test`), С…Р°СЂР°РєС‚РµСЂРёР·Р°С†РёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ РґР»СЏ `StateManager`/`ObjectOperations`/`GroupOperations`/`AssetPanel` filter-Р»РѕРіРёРєРё (`tests/`), `eslint.config.js` СЃ `import/max-dependencies: 20` (override РґР»СЏ `LevelEditor.js` РґРѕ Р¤Р°Р·С‹ 3), `npm run check` (lint+test+madge --circular).
- Chore: СЂРµС„Р°РєС‚РѕСЂРёРЅРі Р¤Р°Р·Р° 1 (CI-guardrails) вЂ” `scripts/check-file-size.js` (Р»РёРјРёС‚ 400 СЃС‚СЂРѕРє РґР»СЏ РЅРѕРІС‹С… С„Р°Р№Р»РѕРІ, allowlist РёР· 37 СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… God Object'РѕРІ СЃ TODO РїРѕ С„Р°Р·Р°Рј РїР»Р°РЅР°), `npm run check:size` РґРѕР±Р°РІР»РµРЅ РІ `npm run check`; `knip.json` (`entry: index.html`, `project: src/**/*.js`) + `npm run check:unused` РґР»СЏ С‚РѕС‡РµС‡РЅРѕРіРѕ РїРѕРёСЃРєР° РЅРµРёСЃРїРѕР»СЊР·СѓРµРјРѕРіРѕ СЌРєСЃРїРѕСЂС‚Р° (РЅРµ РІ РіРµР№С‚Рµ вЂ” РѕС‚С‡С‘С‚ РЅР° СЂСѓС‡РЅРѕРµ С‚СЂРёР°Р¶).
- Refactor: Р¤Р°Р·Р° 4.2 (extract AssetViewRenderer) вЂ” РЅРѕРІС‹Р№ РјРѕРґСѓР»СЊ `src/ui/AssetViewRenderer.js` (614 СЃС‚СЂРѕРє) РІР»Р°РґРµРµС‚ РІСЃРµРјРё РјРµС‚РѕРґР°РјРё СЂРµРЅРґРµСЂРёРЅРіР° grid/list/details РїСЂРµРІСЊСЋ; `AssetPanel.js` 3099в†’2499 СЃС‚СЂРѕРє; `render()` РґРµР»РµРіРёСЂСѓРµС‚ `this.viewRenderer.render()` (РѕРґРЅР° СЃС‚СЂРѕРєР°, РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ external caller EditorPreferencesController:117); РѕСЃС‚Р°Р»СЊРЅС‹Рµ call sites РІРЅСѓС‚СЂРё AssetPanel.js РїРµСЂРµРІРµРґРµРЅС‹ РЅР° `this.viewRenderer.methodName()`; РїР°С‚С‚РµСЂРЅ РёРґРµРЅС‚РёС‡РµРЅ `AssetTabsManager`; РґРѕР±Р°РІР»РµРЅРѕ РІ allowlist `scripts/check-file-size.js`; Р¤Р°Р·Р° 4 in progress (6 РєРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ РѕСЃС‚Р°СЋС‚СЃСЏ: AssetFoldersController, AssetFilterController, AssetSelectionController, AssetDragDropController, AssetItemActionsController, AssetToolbarController).
- Fix: СЂРµС„Р°РєС‚РѕСЂРёРЅРі Р¤Р°Р·Р° 2 (`src/ui/PanelPositionManager.js`) вЂ” `window.tabDraggingState`/`window.tabDraggingGlobalMouseUp`/`window._tabDraggingRegistered` Р·Р°РјРµРЅРµРЅС‹ РЅР° РїСЂРёРІР°С‚РЅС‹Рµ РїРѕР»СЏ СЌРєР·РµРјРїР»СЏСЂР° (`this._tabDraggingState`, bound-РјРµС‚РѕРґ `_onGlobalTabMouseUp`, СЂРµРіРёСЃС‚СЂР°С†РёСЏ С‡РµСЂРµР· СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `globalEventRegistry` Р±РµР· РѕС‚РґРµР»СЊРЅРѕРіРѕ window-С„Р»Р°РіР°); `window.panelInitializationCompleted` (РЅРµ РёРјРµР» С‡РёС‚Р°С‚РµР»РµР№) СѓРґР°Р»С‘РЅ; `destroy()` С‚РµРїРµСЂСЊ РѕС‚РїРёСЃС‹РІР°РµС‚ `panel-tab-dragging` РѕС‚ `globalEventRegistry`. `DialogReplacer.js` вЂ” РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РѕСЃРѕР·РЅР°РЅРЅРѕ РѕСЃС‚Р°РІР»РµРЅРЅС‹Р№ `window.*` (Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅРѕ РІ РєРѕРґРµ).

## [Unreleased] (РґРѕ commit c811927, 2026-07-10)

- Fix: РІ РјРµРЅСЋ С„РёР»СЊС‚СЂР° С‚РёРїРѕРІ (Asset panel, Outliner) СѓС…РѕРґ РјС‹С€Рё Р·Р° РїСЂРµРґРµР»С‹ РјРµРЅСЋ РґРѕ РѕС‚РїСѓСЃРєР°РЅРёСЏ Ctrl Р·Р°РєСЂС‹РІР°Р» РјРµРЅСЋ Р±РµР· РїСЂРёРјРµРЅРµРЅРёСЏ РЅР°РєР»РёРєР°РЅРЅС‹С… С‡РµРєР±РѕРєСЃРѕРІ, РЅРѕ РІРЅСѓС‚СЂРµРЅРЅРµРµ СЃРѕСЃС‚РѕСЏРЅРёРµ `activeTypeFilters` РѕСЃС‚Р°РІР°Р»РѕСЃСЊ РёР·РјРµРЅС‘РЅРЅС‹Рј вЂ” РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РѕС‚РєСЂС‹С‚РёРё РјРµРЅСЋ С‡РµРєР±РѕРєСЃС‹ РїРѕРєР°Р·С‹РІР°Р»Рё РЅРµРїСЂРёРјРµРЅС‘РЅРЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ. РўРµРїРµСЂСЊ РЅР° С‚Р°РєРѕРµ Р·Р°РєСЂС‹С‚РёРµ СЃРѕСЃС‚РѕСЏРЅРёРµ РѕС‚РєР°С‚С‹РІР°РµС‚СЃСЏ Рє СЃРЅР°РїС€РѕС‚Сѓ, СЃРЅСЏС‚РѕРјСѓ РїРµСЂРµРґ РЅР°С‡Р°Р»РѕРј Ctrl-СЃРµСЃСЃРёРё (`AssetPanel.showAssetFilterMenu`, `OutlinerPanel.showFilterMenu`).
- Fix: Р·Р°РіРѕР»РѕРІРѕРє РІРєР»Р°РґРєРё "Details" РІ РїСЂР°РІРѕР№/Р»РµРІРѕР№ РїР°РЅРµР»Рё Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРµРєР»СЋС‡Р°РµС‚СЃСЏ РЅР° "Level"/"Asset"/"Assets" РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РІС‹РґРµР»РµРЅРёСЏ вЂ” РІСЃРµРіРґР° СЃС‚Р°С‚РёС‡РЅС‹Р№ С‚РµРєСЃС‚ "Details" (`PanelPositionManager.js` РґРµС„РѕР»С‚ С‚Р°Р±Р°, `DetailsPanel.updateTabTitle()` С‚РµРїРµСЂСЊ no-op).
- Feature: РІР»РѕР¶РµРЅРЅС‹Рµ split-СЃРµРєС†РёРё РІРєР»Р°РґРѕРє вЂ” drag РІРєР»Р°РґРєРё (РЅР°РїСЂ. Layers) РЅР° РѕР±Р»Р°СЃС‚СЊ РљРћРќРўР•РќРўРђ РґСЂСѓРіРѕР№ РІРєР»Р°РґРєРё (РЅР°РїСЂ. Outliner, РЅРµ РЅР° РµС‘ С‚Р°Р±-Р±Р°СЂ) РїРѕРґСЃРІРµС‡РёРІР°РµС‚ РІРµСЂС…РЅСЋСЋ/РЅРёР¶РЅСЋСЋ РїРѕР»РѕРІРёРЅСѓ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј; РЅР° drop СЃРѕР·РґР°С‘С‚СЃСЏ РІР»РѕР¶РµРЅРЅР°СЏ split-СЃРµРєС†РёСЏ (РѕР±Рµ РІРєР»Р°РґРєРё РІРёРґРЅС‹ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ, СЃС‚РµРє СЃРІРµСЂС…Сѓ/СЃРЅРёР·Сѓ СЃ resizer), РѕСЃРЅРѕРІРЅР°СЏ РєРЅРѕРїРєР° РїРµСЂРµРёРјРµРЅРѕРІС‹РІР°РµС‚СЃСЏ РІ "Outliner/Layers". Drag Р·Р°РіРѕР»РѕРІРєР° РІР»РѕР¶РµРЅРЅРѕР№ РїР°РЅРµР»Рё (`.tab-split-pane-header`) РѕР±СЂР°С‚РЅРѕ РѕС‚СЃРѕРµРґРёРЅСЏРµС‚ РµС‘ РІ РѕР±С‹С‡РЅСѓСЋ standalone-РІРєР»Р°РґРєСѓ РІ Р»СЋР±РѕР№ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ РїР°РЅРµР»Рё. Alternatively, drag РІРєР»Р°РґРєРё РЅР° РѕРґРЅСѓ РёР· РґРІСѓС… РїРѕР»РѕРІРёРЅ (`.tab-split-pane`) РЈР–Р• СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ composite Р—РђРњР•РќРЇР•Рў Р·Р°РЅРёРјР°СЋС‰СѓСЋ СЌС‚Сѓ РїРѕР»РѕРІРёРЅСѓ РІРєР»Р°РґРєСѓ РІРјРµСЃС‚Рѕ Р±Р»РѕРєРёСЂРѕРІРєРё: **РµСЃР»Рё РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјР°СЏ РІРєР»Р°РґРєР° вЂ” plain standalone-РІРєР»Р°РґРєР°**, РІС‹С‚РµСЃРЅРµРЅРЅР°СЏ РІРєР»Р°РґРєР° СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РѕР±С‹С‡РЅРѕР№ standalone-РІРєР»Р°РґРєРѕР№ РІ РџРђРќР•Р›Р-РРЎРўРћР§РќРРљР• РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕР№ РІРєР»Р°РґРєРё (РЅРµ РІ РїР°РЅРµР»Рё, СЃРѕРґРµСЂР¶Р°С‰РµР№ composite), Р·Р°РЅРёРјР°СЏ СЂРѕРІРЅРѕ СЃР»РѕС‚, РєРѕС‚РѕСЂС‹Р№ РѕСЃРІРѕР±РѕРґРёР»Р° РїРµСЂРµС‚Р°С‰РµРЅРЅР°СЏ; РїСЂРё cross-panel drag СЌС‚Рѕ РґРІСѓСЃС‚РѕСЂРѕРЅРЅРёР№ swap РјРµР¶РґСѓ РїР°РЅРµР»СЏРјРё. **Р•СЃР»Рё РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјР°СЏ РІРєР»Р°РґРєР° СЃР°РјР° РІР»РѕР¶РµРЅР° РІ РґСЂСѓРіРѕР№ composite**, РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ true pane-for-pane swap (РјРµС‚РѕРґ `_swapNestedPanes`): РІС‹С‚РµСЃРЅРµРЅРЅР°СЏ РІРєР»Р°РґРєР° Р·Р°РЅРёРјР°РµС‚ РјРµСЃС‚Рѕ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕР№ РІ РёСЃС…РѕРґРЅРѕРј composite, РѕР±Р° composite РѕСЃС‚Р°СЋС‚СЃСЏ composites (РЅРё РѕРґРёРЅ РЅРµ СЂР°Р·СЂСѓС€Р°РµС‚СЃСЏ), С‚РѕР»СЊРєРѕ РѕРґРёРЅ С‡Р»РµРЅ РІ РєР°Р¶РґРѕРј РјРµРЅСЏРµС‚СЃСЏ. Р’С‹С‚РµСЃРЅРµРЅРЅР°СЏ РІРєР»Р°РґРєР° РѕСЃС‚Р°С‘С‚СЃСЏ РІ РЅРµР°РєС‚РёРІРЅРѕРј СЃРѕСЃС‚РѕСЏРЅРёРё, РµСЃР»Рё С‚РѕР»СЊРєРѕ РЅРµ Р±С‹Р»Р° Р°РєС‚РёРІРЅРѕР№ РїРµСЂРµС‚Р°С‰РµРЅРЅР°СЏ РІРєР»Р°РґРєР° РІ СЃРІРѕРµР№ РёСЃС…РѕРґРЅРѕР№ РїР°РЅРµР»Рё (С‚РѕРіРґР° С‡РµСЂРµР· `_reactivateAfterTabRemoval` Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ РІС‹С‚РµСЃРЅРµРЅРЅР°СЏ). РљР»СЋС‡РµРІРѕР№ РЅСЋР°РЅСЃ "identity anchor": РµСЃР»Рё Р·Р°РјРµРЅСЏРµРјР°СЏ РїРѕР»РѕРІРёРЅР° вЂ” СЏРєРѕСЂСЊ РёРґРµРЅС‚РёС‡РЅРѕСЃС‚Рё composite (РёР·РЅР°С‡Р°Р»СЊРЅРѕ С†РµР»РµРІР°СЏ РІРєР»Р°РґРєР° РїРµСЂРІРѕРіРѕ merge), СЏРєРѕСЂСЊ РџР•Р Р•РќРћРЎРРўРЎРЇ РЅР° РЅРµС‚СЂРѕРЅСѓС‚СѓСЋ РїРѕР»РѕРІРёРЅСѓ, С‡С‚РѕР±С‹ РёР·Р±РµР¶Р°С‚СЊ РєРѕРЅС„Р»РёРєС‚Р° РёРґРµРЅС‚РёС‡РЅРѕСЃС‚Рё (РІ РѕР±РѕРёС… standalone Рё nested cases). `PanelPositionManager.js`: `mergeTabIntoSplit()`/`replacePaneInSplit()`/`detachFromSplit()` + drag-detection (`_findSplitDropTarget`) РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅ РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `_globalTabMouseMove`/`_globalTabMouseUp`, `_findSplitDropTarget` С‚РµРїРµСЂСЊ РІРѕР·РІСЂР°С‰Р°РµС‚ `{mode:'merge'|'replace', ...}`. `EventHandlers.setActivePanelTab()` РґРѕРїРѕР»РЅРµРЅ un-hide РІР»РѕР¶РµРЅРЅС‹С… РїР°РЅРµР»РµР№ РїСЂРё РїРѕРєР°Р·Рµ composite-РІРєР»Р°РґРєРё. v1-РѕРіСЂР°РЅРёС‡РµРЅРёСЏ (РѕСЃРѕР·РЅР°РЅРЅРѕ): РѕРґРёРЅ СѓСЂРѕРІРµРЅСЊ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё, С‚РѕР»СЊРєРѕ РІРµСЂС‚РёРєР°Р»СЊРЅС‹Р№ split, **С‡Р»РµРЅСЃС‚РІРѕ РІ composite Рё СЂР°Р·РјРµСЂ resizer-СЂР°Р·РґРµР»С‘РЅРЅС‹С… РїРѕР»РѕРІРёРЅ (ratio) РїРµСЂСЃРёСЃС‚СЏС‚СЃСЏ РјРµР¶РґСѓ РїРµСЂРµР·Р°РіСЂСѓР·РєР°РјРё** (leftPanelSplits/rightPanelSplits РІ config/user/panels.json, РјРµС‚РѕРґС‹ savePanelSplits/applyPanelSplits РІ PanelPositionManager), detach вЂ” С‚РѕР»СЊРєРѕ РІ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РїР°РЅРµР»Рё.
  - Refactor: СѓРЅРёС„РёРєР°С†РёСЏ РґРІСѓС… РЅРµР·Р°РІРёСЃРёРјС‹С… drag-РїСЂРѕС‚РѕРєРѕР»РѕРІ (РѕР±С‹С‡РЅС‹Р№ tab-bar drag Рё split-pane-header detach drag) вЂ” РѕР±Р° С‚РµРїРµСЂСЊ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚ merge/replace-Р·РѕРЅС‹ С‡РµСЂРµР· РѕР±С‰РёР№ `_findSplitDropTarget`. РќРѕРІС‹Рµ РїСЂРёРІР°С‚РЅС‹Рµ РјРµС‚РѕРґС‹ `_extractDraggedTab()` Рё `_collapseSplitPane()` Р°Р±СЃС‚СЂР°РіРёСЂСѓСЋС‚ Р»РѕРіРёРєСѓ "РѕС‚РєСѓРґР° Рё РєР°Рє Р·Р°Р±СЂР°С‚СЊ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјС‹Р№ С‚Р°Р±" вЂ” СЂР°Р±РѕС‚Р°РµС‚ РѕРґРёРЅР°РєРѕРІРѕ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ С‚РѕРіРѕ, С‚Р°С‰РёРјСЃСЏ Р»Рё standalone-РєРЅРѕРїРєР° РёР»Рё С‚Р°Р±, СѓР¶Рµ РІР»РѕР¶РµРЅРЅС‹Р№ РІ С‡СѓР¶РѕР№ composite. `_startSplitPaneDetachDrag()` СЂР°СЃС€РёСЂРµРЅ: С‚РµРїРµСЂСЊ РЅРµ С‚РѕР»СЊРєРѕ РїРѕРґСЃРІРµС‡РёРІР°РµС‚ С†РµР»СѓСЋ РїР°РЅРµР»СЊ РїСЂРё РѕС‚СЃРѕРµРґРёРЅРµРЅРёРё, РЅРѕ Рё РїСЂРѕРІРµСЂСЏРµС‚ merge/replace-Р·РѕРЅС‹, РїРѕРєР°Р·С‹РІР°СЏ С‚РѕС‡РЅС‹Рµ Р»РёРЅРёРё СЂР°Р·РґРµР»Р°, РєР°Рє РїСЂРё РѕР±С‹С‡РЅРѕРј drag РІРєР»Р°РґРєРё. Р’Р»РѕР¶РµРЅРЅС‹Р№ С‚Р°Р±, РїРµСЂРµРЅРµСЃС‘РЅРЅС‹Р№ РЅР° РєРѕРЅС‚РµРЅС‚ РґСЂСѓРіРѕР№ РїР°РЅРµР»Рё, С‚РµРїРµСЂСЊ РЅРµ РїСЂРѕСЃС‚Рѕ РѕС‚СЃРѕРµРґРёРЅСЏРµС‚СЃСЏ, РЅРѕ Рё РјРµСЂРґР¶РёС‚СЃСЏ/Р·Р°РјРµРЅСЏРµС‚ РїР°РЅРµ С‚Р°Рј Р¶Рµ РєР°Рє РѕР±С‹С‡РЅР°СЏ standalone-РєРЅРѕРїРєР°.
  - Fix: РїРѕРґСЃРІРµС‚РєР° split-С…РёРЅС‚Р° РєРѕСЂСЂРµРєС‚РЅРѕ РѕС…РІР°С‚С‹РІР°Р»Р° РІСЃСЋ РїР°РЅРµР»СЊ С‚РѕР»СЊРєРѕ РґР»СЏ Outliner (`.outliner-tab-layout` вЂ” `height:100%`), Сѓ Details/Layers/Levels `{tab}-content-panel` РЅРµ СЂР°СЃС‚СЏРЅСѓС‚ РЅР° РІСЃСЋ РІС‹СЃРѕС‚Сѓ (СЃР°Р№Р·РёС‚СЃСЏ РїРѕ РєРѕРЅС‚РµРЅС‚Сѓ), РїРѕСЌС‚РѕРјСѓ С…РёРЅС‚ РїРѕРґСЃРІРµС‡РёРІР°Р» С‚РѕР»СЊРєРѕ С‡Р°СЃС‚РёС‡РЅСѓСЋ/РІР»РѕР¶РµРЅРЅСѓСЋ РѕР±Р»Р°СЃС‚СЊ. `_findSplitDropTarget` С‚РµРїРµСЂСЊ Р±РµСЂС‘С‚ rect РЅРµ Сѓ `activeContent`, Р° Сѓ `contentContainer` (РІРЅРµС€РЅРёР№ `.flex-grow.overflow-y-auto` РІСЂР°РїРїРµСЂ, РІСЃРµРіРґР° СЂР°РІРµРЅ РїРѕР»РЅРѕР№ РІС‹СЃРѕС‚Рµ С‚РµР»Р° РїР°РЅРµР»Рё) вЂ” РµРґРёРЅРѕРѕР±СЂР°Р·РЅРѕ РґР»СЏ РІСЃРµС… РІРєР»Р°РґРѕРє.
  - Fix: merge РІРєР»Р°РґРєРё РІ split СЂРѕРЅСЏР» `insertBefore` (`NotFoundError`) Рё РЅР°РјРµСЂС‚РІРѕ РїРѕРґРІРµС€РёРІР°Р» drag (ghost-РІРєР»Р°РґРєР° Р·Р°Р»РёРїР°Р»Р° РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј, `_pendingDrag`/`_globalTabDragInstalled` РЅРµ СЃР±СЂР°СЃС‹РІР°Р»РёСЃСЊ вЂ” РІСЃРµ РїРѕСЃР»РµРґСѓСЋС‰РёРµ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ Р»РѕРјР°Р»РёСЃСЊ), РµСЃР»Рё dragged-РІРєР»Р°РґРєР° РѕРєР°Р·С‹РІР°Р»Р°СЃСЊ РЅРµРїРѕСЃСЂРµРґСЃС‚РІРµРЅРЅС‹Рј DOM-СЃРѕСЃРµРґРѕРј target-РІРєР»Р°РґРєРё (РЅР°РїСЂ. РѕР±Рµ РІ РѕРґРЅРѕР№ РїР°РЅРµР»Рё) вЂ” `referenceNode = targetContent.nextSibling` СЃРѕРІРїР°РґР°Р» СЃ `draggedContent`, Р° С‚РѕС‚ Рє РјРѕРјРµРЅС‚Сѓ `insertBefore` СѓР¶Рµ Р±С‹Р» СЂРµРѕС‚С†РѕРІР»С‘РЅ РІ `_createSplitPane`. `mergeTabIntoSplit()` С‚РµРїРµСЂСЊ СЏРєРѕСЂРёС‚ С‚РѕС‡РєСѓ РІСЃС‚Р°РІРєРё РІСЂРµРјРµРЅРЅС‹Рј comment-РїР»РµР№СЃС…РѕР»РґРµСЂРѕРј РІРјРµСЃС‚Рѕ `nextSibling`. Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ `_globalTabMouseUp` РѕР±С‘СЂРЅСѓС‚ РІ `try/finally` вЂ” `_cleanupTabDrag()` С‚РµРїРµСЂСЊ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РґР°Р¶Рµ РµСЃР»Рё commit-РІРµС‚РєР° Р±СЂРѕСЃРёС‚ РёСЃРєР»СЋС‡РµРЅРёРµ.
  - Fix: РєРѕРіРґР° РѕР±Рµ РїР°РЅРµР»Рё вЂ” composite (РїРѕ 2 РІРєР»Р°РґРєРё), РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ half'Р° composite РјРѕР»С‡Р° РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р»Рѕ (~РїРѕР»РѕРІРёРЅР° РєРѕРјР±РёРЅР°С†РёР№ drag'РѕРІ), РµСЃР»Рё РёРјСЏ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕР№ РІРєР»Р°РґРєРё СЃРѕРІРїР°РґР°Р»Рѕ СЃ `data-tab` РµС‘ Р¶Рµ composite-РєРЅРѕРїРєРё (Р°РЅРєРѕСЂ). РџСЂРёС‡РёРЅР°: `_extractDraggedTab()` РёСЃРєР°Р» РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјСѓСЋ РІРєР»Р°РґРєСѓ РіР»РѕР±Р°Р»СЊРЅС‹Рј `document.querySelector('[data-tab=...]')` Р”Рћ РїСЂРѕРІРµСЂРєРё РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё вЂ” СЃРѕРІРїР°РґРµРЅРёРµ РЅР°С…РѕРґРёР»Рѕ СЃР°РјСѓ composite-РєРЅРѕРїРєСѓ (РЅРµ СЃС‚Р°РЅРґСЌР»РѕРЅ), `dataset.tabGroup`-guard СЃСЂР°Р±Р°С‚С‹РІР°Р» Рё С„СѓРЅРєС†РёСЏ РјРѕР»С‡Р° РІРѕР·РІСЂР°С‰Р°Р»Р° `null`, РІРјРµСЃС‚Рѕ РїРµСЂРµС…РѕРґР° Рє РІРµС‚РєРµ "РІРєР»Р°РґРєР° РІР»РѕР¶РµРЅР° РІ С‡СѓР¶РѕР№ composite". РџРѕСЂСЏРґРѕРє РїСЂРѕРІРµСЂРѕРє РІ `_extractDraggedTab()` РёРЅРІРµСЂС‚РёСЂРѕРІР°РЅ: СЃРЅР°С‡Р°Р»Р° РїСЂРѕРІРµСЂСЏРµС‚СЃСЏ РІР»РѕР¶РµРЅРЅРѕСЃС‚СЊ С‡РµСЂРµР· `content.closest('.tab-split-pane')`, С‚РѕР»СЊРєРѕ Р·Р°С‚РµРј вЂ” РїРѕРёСЃРє standalone-РєРЅРѕРїРєРё.
  - Fix: `mergeTabIntoSplit()`/`replacePaneInSplit()`/`detachFromSplit()` РїСЂРё РјРµР¶РїР°РЅРµР»СЊРЅРѕРј (leftв†”right) РїРµСЂРµРјРµС‰РµРЅРёРё РІРєР»Р°РґРєРё РЅРµ РѕР±РЅРѕРІР»СЏР»Рё `tabPositions`/`tabPosition_{tab}` РІ userPrefs (СЌС‚Рѕ РґРµР»Р°Р» С‚РѕР»СЊРєРѕ `moveTab()`) вЂ” DOM СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РѕРїРµСЂР°С†РёРё Р±С‹Р» РєРѕСЂСЂРµРєС‚РµРЅ, РЅРѕ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё СЃС‚СЂР°РЅРёС†С‹ `initializeTabPositions()` РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°Р» РІРєР»Р°РґРєРё РїРѕ СѓСЃС‚Р°СЂРµРІС€РёРј РїРѕР·РёС†РёСЏРј, РєРѕРЅС„Р»РёРєС‚СѓСЏ СЃ СѓР¶Рµ РєРѕСЂСЂРµРєС‚РЅРѕ СЃРѕС…СЂР°РЅС‘РЅРЅС‹Рј `leftPanelSplits`/`rightPanelSplits`, Рё СЂР°СЃРєР»Р°РґРєР° "СЂР°Р·СЉРµР·Р¶Р°Р»Р°СЃСЊ". Р”РѕР±Р°РІР»РµРЅ `_syncTabPosition(tabName, panelSide)`, РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· РІСЃРµС… С‚СЂС‘С… РѕРїРµСЂР°С†РёР№ РІРµР·РґРµ, РіРґРµ РІРєР»Р°РґРєР° РјРµРЅСЏРµС‚ РїР°РЅРµР»СЊ.

## [Unreleased] (РґРѕ commit 5269f3e, 2026-07-09)

- Feature: Viewport "jump to camera" hotkey (`.` key) вЂ” restores the selected camera object's saved position and zoom to the viewport (`x + width/2`, `y + height/2`, `properties.zoom ?? 1`), or falls back to the last remembered camera; if neither exists, shows amber warning "No camera selected вЂ” select or place a camera object to jump to it." in the status bar. **Key difference from focusOnSelection/focusOnAll**: does NOT fit-to-bounds, but instead applies the camera object's OWN zoom. Implemented via `ViewportOperations.jumpToCamera()` в†’ `applyCameraObjectToViewport()`, reads zoom from `obj.properties.zoom`. Per-level `lastCameraObjectId` stored in `LevelSession.viewState` (not serialized). **Camera objects now have an editable Zoom field** in the Details panel's new "Camera" section (numeric input, default 1, stored in `obj.properties.zoom`) вЂ” this is what `jumpToCamera()` applies. Config: `editor.jumpToCamera` shortcut (key `"."`, description `"Jump viewport to selected/last camera object"`).
- UI Refactor: Levels вЂ” РѕС‚РґРµР»СЊРЅР°СЏ РІРєР»Р°РґРєР° РІ РїСЂР°РІРѕР№ РїР°РЅРµР»Рё (v3.58.0). Р Р°РЅСЊС€Рµ `#levels-content-panel` Р±С‹Р» РІР»РѕР¶РµРЅ РІ `#layers-content-panel` (РѕРґРЅР° РІРєР»Р°РґРєР° "Layers" СЃРѕРґРµСЂР¶Р°Р»Р° РѕР±Р° СЃРїРёСЃРєР°, СЂР°Р·РґРµР»С‘РЅРЅС‹Рµ `#outliner-layers-divider`); С‚РµРїРµСЂСЊ РґРІР° РЅРµР·Р°РІРёСЃРёРјС‹С… РїР»РѕСЃРєРёС… РґРёРІР°: `#levels-content-panel` Рё `#layers-content-panel`, РѕР±Р° вЂ” tab-content-right СЌР»РµРјРµРЅС‚С‹ (`index.html:148-149`). Р’РЅРµСЃРµРЅС‹ РёР·РјРµРЅРµРЅРёСЏ РІ С‚Р°Р±Р»-СЃРёСЃС‚РµРјСѓ: `PanelPositionManager` (РґРѕР±Р°РІР»РµРЅС‹ `levels` РІ `initializeTabPositions()`, `moveTab()`, `createTemporaryTabContainer()`), `EventHandlers.ensurePanelTabMarkers()` (РґРѕР±Р°РІР»РµРЅ `'levels'` РІ `coreTabs`), `SearchSectionUtils.showSearchSectionForTab()` (РґРІР° РЅРµР·Р°РІРёСЃРёРјС‹С… branch РґР»СЏ `'levels'` Рё `'layers'` РІРјРµСЃС‚Рѕ РѕРґРЅРѕРіРѕ РѕР±С‰РµРіРѕ), `UserPreferencesManager` (РґРѕР±Р°РІР»РµРЅ `'tabPosition_levels'`), `config/defaults/ui.json` (РґРѕР±Р°РІР»РµРЅ `"tabPosition_levels": "right"`), `styles/spacing-mode.css` (РґРѕР±Р°РІР»РµРЅРѕ РїСЂР°РІРёР»Рѕ РґР»СЏ `#levels-content-panel`). Р¤СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ Levels (РІРёРґРёРјРѕСЃС‚СЊ, РїРµСЂРµРєР»СЋС‡РµРЅРёРµ, drag-reorder, paint-drag РЅР° eye-icon, РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ) РѕСЃС‚Р°С‘С‚СЃСЏ РЅРµРёР·РјРµРЅРЅРѕР№; РёР·РјРµРЅРµРЅР° С‚РѕР»СЊРєРѕ РІРёР·СѓР°Р»СЊРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° Рё С‚Р°Р±РёСЂРѕРІР°РЅРёРµ.
- Refactor/Feature: РµРґРёРЅС‹Р№ С€Р°Р±Р»РѕРЅ СЃС‚СЂРѕРєРё СЃРїРёСЃРєР° РґР»СЏ LayersPanel/LevelsPanel вЂ” РЅРѕРІС‹Р№ `src/ui/panel-structures/ListItemRowStructure.js` (`createListItemRow`/`updateListItemVisuals`, РѕР±С‰РёРµ SVG-РєРѕРЅСЃС‚Р°РЅС‚С‹ eye/lock), РѕР±Рµ РїР°РЅРµР»Рё РїРµСЂРµРёСЃРїРѕР»СЊР·СѓСЋС‚ РµРіРѕ РІРјРµСЃС‚Рѕ РґРІСѓС… РЅРµР·Р°РІРёСЃРёРјС‹С… `innerHTML`-Р±Р»РѕРєРѕРІ. РџРѕРїСѓС‚РЅРѕ Сѓ Levels РїРѕСЏРІРёР»РёСЃСЊ lock Рё color СЃ СЂРµР°Р»СЊРЅРѕР№ С„СѓРЅРєС†РёРµР№ (РЅРµ С‚РѕР»СЊРєРѕ РІС‘СЂСЃС‚РєР°), РєР°Рє Сѓ Layers, РєСЂРѕРјРµ parallax: `LevelSession.locked`/`.color` (editor-only, РЅРµ СЃРµСЂРёР°Р»РёР·СѓСЋС‚СЃСЏ), `LevelsManager.toggleLevelLock()`. Lock Р±Р»РѕРєРёСЂСѓРµС‚ РІС‹Р±РѕСЂ РѕР±СЉРµРєС‚РѕРІ С‚РµРєСѓС‰РµРіРѕ СѓСЂРѕРІРЅСЏ С‡РµСЂРµР· РµРґРёРЅС‹Р№ РіРµР№С‚ `ObjectOperations.computeSelectableSet()` (РїСѓСЃС‚РѕР№ Set РїСЂРё Р·Р°Р»РѕС‡РµРЅРЅРѕРј С‚РµРєСѓС‰РµРј СѓСЂРѕРІРЅРµ вЂ” cross-level РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ РІ СЂРµРґР°РєС‚РѕСЂРµ РЅРµС‚, РїРѕСЌС‚РѕРјСѓ per-object РїСЂРѕРІРµСЂРєР° РЅРµ РЅСѓР¶РЅР°), РїР»СЋСЃ guard РІ `MouseHandlers.handleDrop()` (asset drag-drop) Рё `OutlinerPanel.canSelect`/РІРёР·СѓР°Р»СЊРЅР°СЏ РёРЅРґРёРєР°С†РёСЏ (`.locked` РєР»Р°СЃСЃ, opacity) РІ Outliner. `LevelsPanel`: `showLevelColorPicker()` вЂ” РїСЂРѕСЃС‚РѕР№ click.
- Fix: lock-РёРєРѕРЅРєР° РІ LevelsPanel РЅРµ РїРѕРґРґРµСЂР¶РёРІР°Р»Р° paint-drag Р¶РµСЃС‚ (С‚РѕР»СЊРєРѕ click), РІ РѕС‚Р»РёС‡РёРµ РѕС‚ eye-РёРєРѕРЅРєРё РІ С‚РѕР№ Р¶Рµ РїР°РЅРµР»Рё Рё РѕР±РµРёС… РёРєРѕРЅРѕРє РІ LayersPanel. `handleLevelIconMouseDown/Over` РѕР±РѕР±С‰РµРЅС‹ РЅР° `.level-visibility-btn, .level-lock-btn` СЃ `_iconPaintDrag.type`, РґРѕР±Р°РІР»РµРЅ `_paintLevelLock()` (РјРёСЂСЂРѕРёС‚ `_paintLevelVisibility`), РѕР±С‰РёР№ `_startIconPaintDrag()` РІС‹РЅРµСЃРµРЅ РёР· РёРЅР»Р°Р№РЅР°.
- Fix: Р·Р°Р»РѕС‡РµРЅРЅР°СЏ lock-РёРєРѕРЅРєР° (LayersPanel/LevelsPanel) Р±С‹Р»Р° С‚РѕРіРѕ Р¶Рµ СЃРµСЂРѕРіРѕ С†РІРµС‚Р°, С‡С‚Рѕ Рё СЂР°Р·Р»РѕС‡РµРЅРЅР°СЏ (`var(--ui-text-color)`) вЂ” РїР»РѕС…Рѕ Р·Р°РјРµС‚РЅР°. Р¦РІРµС‚ locked-СЃРѕСЃС‚РѕСЏРЅРёСЏ СЃРјРµРЅС‘РЅ РЅР° `#ef4444` РІ `ListItemRowStructure.js` (`createListItemRow`/`updateListItemVisuals`).
- Fix: РґРµС„РѕР»С‚РЅС‹Р№ С‚РёРї РґР»СЏ РёРјРїРѕСЂС‚РёСЂСѓРµРјС‹С… СЃРїСЂР°Р№С‚-Р°СЃСЃРµС‚РѕРІ (drag&drop PNG, Р·Р°РіСЂСѓР·РєР° РёР· `content/*.json`) СЃРјРµРЅС‘РЅ СЃ `'object'` (РЅРµ РІС…РѕРґРёС‚ РІ РєР°С‚Р°Р»РѕРі `ASSET_TYPES`, РЅРµРґРѕСЃС‚СѓРїРµРЅ РІ РјРµРЅСЋ Add) РЅР° `'image'` вЂ” `AssetPanel.getAssetTypeFromCategory()`, `AssetImporter.getAssetTypeFromCategory()`, `AssetManager.loadAssetFromFile()`. РњРёРіСЂРёСЂРѕРІР°РЅС‹ 7 СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… `content/**/*.json` СЃ `type:"object"` в†’ `"image"`, РѕР±РЅРѕРІР»С‘РЅ `content/README.md`.
- Feature: Paint drag РґР»СЏ toggle-РёРєРѕРЅРѕРє (v3.58.0) вЂ” mousedown РЅР° eye/lock-РёРєРѕРЅРєРµ (LayersPanel, LevelsPanel, OutlinerPanel) + drag РїРѕ РѕСЃС‚Р°Р»СЊРЅС‹Рј РёРєРѕРЅРєР°Рј С‚РѕРіРѕ Р¶Рµ С‚РёРїР° РїСЂРёРјРµРЅСЏРµС‚ РІР·СЏС‚РѕРµ СЃ РїРµСЂРІРѕР№ РёРєРѕРЅРєРё СЃРѕСЃС‚РѕСЏРЅРёРµ РєРѕ РІСЃРµРј РїСЂРѕР№РґРµРЅРЅС‹Рј РёРєРѕРЅРєР°Рј РґРѕ РѕС‚РїСѓСЃРєР°РЅРёСЏ РєРЅРѕРїРєРё. РџР°С‚С‚РµСЂРЅ: `handleLayerIconMouseDown/_startIconPaintDrag()` в†’ `_iconPaintDrag` С„Р»Р°Рі, `mouseover` в†’ `_paintLayerVisibility/_paintLayerLock/_paintObjectVisibility()`, РіР»РѕР±Р°Р»СЊРЅС‹Р№ `mouseup` в†’ `_endIconPaintDrag()` СЃ Р±Р°С‚С‡РµРІС‹Рј РєСЌС€-РёРЅРІР°Р»РёРґРёСЂРѕРІР°РЅРёРµРј Рё СЂРµ-СЂРµРЅРґРµСЂРѕРј (РІРјРµСЃС‚Рѕ РєР»РёРєР° РїРѕ РєР°Р¶РґРѕР№ РѕС‚РґРµР»СЊРЅРѕ). РќР° РІСЂРµРјСЏ РґСЂР°РіР° РІСЂРµРјРµРЅРЅРѕ РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ `draggable` Сѓ СЃС‚СЂРѕРєРё (LayersPanel/LevelsPanel), С‡С‚РѕР±С‹ РЅРµ РїРµСЂРµС…РІР°С‚РёС‚СЊ Р¶РµСЃС‚ HTML5 drag-reorder. EventHandlerManager РїРѕР»СѓС‡РёР» С‚СЂРё РЅРѕРІС‹С… generic-Р±Р»РѕРєР° РґРµР»РµРіРёСЂРѕРІР°РЅРёСЏ: `config.mousedown / config.mouseup / config.mouseover` (РїР°С‚С‚РµСЂРЅ РёРґРµРЅС‚РёС‡РµРЅ `config.click/dragstart`), СЂР°РЅСЊС€Рµ СЌС‚Рё СЃРѕР±С‹С‚РёСЏ РјРѕР»С‡Р° РёРіРЅРѕСЂРёСЂРѕРІР°Р»РёСЃСЊ.
  - Fix: eye-РёРєРѕРЅРєРё РІ LayersPanel РІРѕ РІСЂРµРјСЏ drag РІРёР·СѓР°Р»СЊРЅРѕ РЅРµ РїРµСЂРµРєР»СЋС‡Р°Р»РёСЃСЊ РґРѕ mouseup вЂ” `updateLayerElement` С‡РёС‚Р°РµС‚ `effectivelyVisible` РёР· С‚Р°Р№Рј-РєСЌС€Р° `RenderOperations.getVisibleLayerIds()`, РєРѕС‚РѕСЂС‹Р№ Р±Р°С‚С‡РµРІРѕ РёРЅРІР°Р»РёРґРёСЂРѕРІР°Р»СЃСЏ С‚РѕР»СЊРєРѕ РІ РєРѕРЅС†Рµ Р¶РµСЃС‚Р°. РРЅРІР°Р»РёРґР°С†РёСЏ СЃР°РјР° РїРѕ СЃРµР±Рµ РґРµС€С‘РІР°СЏ (РІ РѕС‚Р»РёС‡РёРµ РѕС‚ `editor.render()`/`outlinerPanel.render()`, РєРѕС‚РѕСЂС‹Рµ РѕСЃС‚Р°Р»РёСЃСЊ Р±Р°С‚С‡РµРІС‹РјРё) вЂ” РїРµСЂРµРЅРµСЃРµРЅР° РІ `_paintLayerVisibility()`, РІС‹Р·С‹РІР°РµС‚СЃСЏ РЅР° РєР°Р¶РґРѕР№ РїРѕРєСЂР°С€РµРЅРЅРѕР№ РёРєРѕРЅРєРµ.
  - Fix: РІ OutlinerPanel СЃРєСЂС‹С‚РёРµ РѕР±СЉРµРєС‚Р° РЅРµ Р·Р°С‚РµРјРЅСЏР»Рѕ РІСЃСЋ СЃС‚СЂРѕРєСѓ (`.outliner-item`), РІ РѕС‚Р»РёС‡РёРµ РѕС‚ LayersPanel/LevelsPanel вЂ” Р·Р°С‚РµРјРЅСЏР»РёСЃСЊ С‚РѕР»СЊРєРѕ С†РІРµС‚ РёРєРѕРЅРєРё-РіР»Р°Р·Р° Рё С‚РµРєСЃС‚Р°. Р”РѕР±Р°РІР»РµРЅ `OutlinerPanel._computeRowOpacity(obj)` (hidden=0.45 РїСЂРёРѕСЂРёС‚РµС‚РЅРµРµ locked=0.5, Р»РѕРєР°Р»СЊРЅС‹Р№ `''` РёРЅР°С‡Рµ), РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· `updateVisibilityButton()` (Р¶РёРІРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ РїСЂРё paint-drag Рё РѕР±С‹С‡РЅРѕРј РєР»РёРєРµ) Рё РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅ РІ `renderObjectNode`/`renderGroupNode` РІРјРµСЃС‚Рѕ РґСѓР±Р»РёСЂРѕРІР°РЅРЅРѕРіРѕ inline-Р±Р»РѕРєР° РЅР° opacity, РєРѕС‚РѕСЂС‹Р№ СЂР°РЅСЊС€Рµ СѓС‡РёС‚С‹РІР°Р» С‚РѕР»СЊРєРѕ locked-СЃРѕСЃС‚РѕСЏРЅРёРµ СЃР»РѕСЏ.
  - Fix: paint-drag Р·Р° eye/lock-РёРєРѕРЅРєСѓ РІ LayersPanel Рё LevelsPanel РїСЂРё СЂРµР°Р»СЊРЅРѕРј РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РјС‹С€СЊСЋ РїРµСЂРµС…РІР°С‚С‹РІР°Р»СЃСЏ РЅР°С‚РёРІРЅС‹Рј HTML5 drag-reorder СЃС‚СЂРѕРєРё вЂ” `handleLayerIconMouseDown`/`handleLevelIconMouseDown` РёСЃРєР°Р»Рё СЃС‚СЂРѕРєСѓ С‡РµСЂРµР· `button.closest('[data-layer-id]')`/`[data-level-id]`, Р° СЌС‚РѕС‚ Р°С‚СЂРёР±СѓС‚ СЃС‚РѕРёС‚ Сѓ РљРђР–Р”РћР“Рћ РґРѕС‡РµСЂРЅРµРіРѕ СЌР»РµРјРµРЅС‚Р° СЃС‚СЂРѕРєРё (РІРєР»СЋС‡Р°СЏ СЃР°РјСѓ РєРЅРѕРїРєСѓ), РїРѕСЌС‚РѕРјСѓ `closest()` РјР°С‚С‡РёР»СЃСЏ РЅР° СЃР°РјСѓ РєРЅРѕРїРєСѓ Рё РЅРµ РЅР°С…РѕРґРёР» `.layer-item`/`.level-item` вЂ” РІСЂРµРјРµРЅРЅРѕРµ РѕС‚РєР»СЋС‡РµРЅРёРµ `draggable` С‚РёС…Рѕ РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р»Рѕ (`if (layerElement.draggable)` Р±С‹Р»Рѕ false РґР»СЏ РєРЅРѕРїРєРё). РЎРёРЅС‚РµС‚РёС‡РµСЃРєРёРµ `dispatchEvent`-С‚РµСЃС‚С‹ Р±Р°РіР° РЅРµ Р»РѕРІРёР»Рё (РЅРµ С‚СЂРёРіРіРµСЂСЏС‚ РЅР°С‚РёРІРЅСѓСЋ РёРЅРёС†РёР°С†РёСЋ drag), Р±Р°Рі РїСЂРѕСЏРІР»СЏР»СЃСЏ С‚РѕР»СЊРєРѕ РЅР° СЂРµР°Р»СЊРЅРѕРј РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё. РСЃРїСЂР°РІР»РµРЅРѕ РЅР° `button.closest('.layer-item')`/`'.level-item')` вЂ” id СЃР°РјРѕР№ РёРєРѕРЅРєРё РїСЂРё СЌС‚РѕРј Р±РµСЂС‘С‚СЃСЏ РЅР°РїСЂСЏРјСѓСЋ РёР· `button.dataset.layerId/levelId` (РєРЅРѕРїРєР° С‚РѕР¶Рµ РЅРµСЃС‘С‚ СЌС‚РѕС‚ Р°С‚СЂРёР±СѓС‚), Р±РµР· ambiguous `.closest()`.
- Feature: Player Start РІ РєР°С‚Р°Р»РѕРіРµ С‚РёРїРѕРІ Р°СЃСЃРµС‚РѕРІ вЂ” РґРѕР±Р°РІР»РµРЅ С‚РёРї `player_start` (snake_case, СЃРѕРІРїР°РґР°РµС‚ СЃ GameObject.type СЃС‚СЂРѕРєРѕР№, РєРѕС‚РѕСЂСѓСЋ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚ `LevelEditor.ensurePlayerStartExists()`/`getPlayerStartCount()` РґР»СЏ Р°РІС‚Рѕ-СѓРїСЂР°РІР»СЏРµРјРѕРіРѕ РµРґРёРЅСЃС‚РІРµРЅРЅРѕРіРѕ РЅР° СѓСЂРѕРІРµРЅСЊ РјР°СЂРєРµСЂР° СЃРїР°РІРЅР°). Р§РµСЂРµР· РјРµРЅСЋ Assets в†’ Add в†’ Core в†’ "Player Start" С‚РµРїРµСЂСЊ РјРѕР¶РЅРѕ РІСЂСѓС‡РЅСѓСЋ СЃРѕР·РґР°С‚СЊ placeholder-Р°СЃСЃРµС‚, РєРѕС‚РѕСЂС‹Р№ РїСЂРё СЂР°Р·РјРµС‰РµРЅРёРё РЅР° СѓСЂРѕРІРЅРµ СЃРѕР·РґР°С‘С‚ GameObject СЃ РєРѕСЂСЂРµРєС‚РЅРѕ СЂР°СЃРїРѕР·РЅР°РІР°РµРјС‹Рј `type='player_start'`. Р’ `src/constants/AssetTypes.js`: РґРѕР±Р°РІР»РµРЅС‹ РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Рµ РїРѕР»СЏ `width`/`height`/`color` РІ РѕРїСЂРµРґРµР»РµРЅРёРµ С‚РёРїР° (РїРµСЂРµРѕРїСЂРµРґРµР»СЏСЋС‚ РґРµС„РѕР»С‚РЅС‹Рµ 48Г—48 + С†РІРµС‚ РєР°С‚РµРіРѕСЂРёРё РїСЂРё СЃРѕР·РґР°РЅРёРё), РЅРѕРІС‹Р№ СЌРєСЃРїРѕСЂС‚ `DEFAULT_ASSET_COMPONENTS = { player_start: ['playerStart'] }` РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ РїСЂРёРєСЂРµРїР»РµРЅРёСЏ РєРѕРјРїРѕРЅРµРЅС‚Р° playerStart РїСЂРё СЃРѕР·РґР°РЅРёРё placeholder-Р°СЃСЃРµС‚Р°. Р’ `src/managers/AssetManager.js`: `createPlaceholderAsset()` С‡РёС‚Р°РµС‚ `typeDef.width || 48`, `typeDef.height || 48`, `typeDef.color || categoryColor` Рё `DEFAULT_ASSET_COMPONENTS[typeId]` РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РєРѕРјРїРѕРЅРµРЅС‚-СЃС‚Р°Р±РѕРІ С‡РµСЂРµР· `createComponentStub()`. Р’ `src/constants/AssetTypeIcons.js`: РґРѕР±Р°РІР»РµРЅ РєР»СЋС‡ `player_start` РґР»СЏ РІРёР·СѓР°Р»РёР·Р°С†РёРё РЅР° canvas (С‚РѕС‚ Р¶Рµ SVG-РіР»РёС„ С„Р»Р°Р¶РєР°, С‡С‚Рѕ Сѓ РєРѕРјРїРѕРЅРµРЅС‚Р° playerStart). **Р’Р°Р¶РЅРѕ**: `player_start` РІСЃС‚СѓРїР°РµС‚ РІ РїРµСЂРµСЃРµС‡РµРЅРёРµ РґРІСѓС… СЃРёСЃС‚РµРј вЂ” СЌС‚Рѕ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ Рё asset-type (СЃРѕР·РґР°С‘С‚СЃСЏ РєР°Рє placeholder), Рё auto-managed GameObject marker (РІР°Р»РёРґРёСЂСѓРµС‚СЃСЏ РІ LevelFileOperations/DetailsPanel). РЎСѓС‰РµСЃС‚РІСѓСЋС‰Р°СЏ РІР°Р»РёРґР°С†РёСЏ (СЂРѕРІРЅРѕ РѕРґРёРЅ РЅР° СѓСЂРѕРІРµРЅСЊ, auto-create РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё) РѕСЃС‚Р°С‘С‚СЃСЏ РЅРµРёР·РјРµРЅРЅРѕР№ Рё РЅРµР·Р°РІРёСЃРёРјР° РѕС‚ СЌС‚РѕРіРѕ С‚РёРїР° Р°СЃСЃРµС‚Р°; С‚РёРї РїСЂРѕСЃС‚Рѕ РѕР±РµСЃРїРµС‡РёРІР°РµС‚ СѓРґРѕР±РЅС‹Р№ РїСѓС‚СЊ СЃРѕР·РґР°РЅРёСЏ С‡РµСЂРµР· UI РІРјРµСЃС‚Рѕ СЂСѓС‡РЅРѕРіРѕ РґРѕР±Р°РІР»РµРЅРёСЏ GameObject СЃ type='player_start' РІ С„Р°Р№Р».
- Feature: Level Solo вЂ” Ctrl+click РЅР° eye-icon СѓСЂРѕРІРЅСЏ РІ LevelsPanel С‚РµРїРµСЂСЊ РґРµР»Р°РµС‚ "solo" (СЌРєСЃРєР»СЋР·РёРІРЅР°СЏ РІРёРґРёРјРѕСЃС‚СЊ РѕРґРЅРѕРіРѕ СѓСЂРѕРІРЅСЏ), Р·РµСЂРєР°Р»РёС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `LayersPanel.toggleLayerSolo` 1:1. `LevelsManager.toggleLevelSolo(levelId)` РїРµСЂРµРєР»СЋС‡Р°РµС‚, РїСЂРё РІРєР»СЋС‡РµРЅРёРё СЃР±СЂР°СЃС‹РІР°РµС‚ solo Сѓ РѕСЃС‚Р°Р»СЊРЅС‹С… СѓСЂРѕРІРЅРµР№. `getVisibleSessions()` РµСЃР»Рё РµСЃС‚СЊ soloed-СЃРµСЃСЃРёРё, РІРѕР·РІСЂР°С‰Р°РµС‚ С‚РѕР»СЊРєРѕ РёС…, РёРЅР°С‡Рµ РєР°Рє СЂР°РЅСЊС€Рµ filter РїРѕ `visible`. `LevelSession.soloed` С…СЂР°РЅРёС‚ С„Р»Р°Рі (РЅРµ СЃРµСЂРёР°Р»РёР·СѓРµС‚СЃСЏ РІ JSON).
- Feature: РјРµРЅСЋ File РїРµСЂРµСѓРіСЂСѓРїРїРёСЂРѕРІР°РЅРѕ: Р±Р»РѕРє Project (New Project, Open Project..., separator, Save Project, Save Project As...), Р·Р°С‚РµРј Р±Р»РѕРє Level (New Level, Open Level..., separator, Save Level, Save Level As...), Р·Р°С‚РµРј Import Assets... (РїРµСЂРµРЅРµСЃРµРЅРѕ РёР· Settings). РџСѓРЅРєС‚ Close Level СѓРґР°Р»С‘РЅ РёР· РјРµРЅСЋ (РѕСЃС‚Р°С‘С‚СЃСЏ РґРѕСЃС‚СѓРїРµРЅ С‡РµСЂРµР· РєСЂРµСЃС‚РёРє РЅР° РІРєР»Р°РґРєРµ СѓСЂРѕРІРЅСЏ РІ LevelsPanel Рё РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ СѓСЂРѕРІРЅСЏ); СЃР°Рј РјРµС‚РѕРґ `closeLevel()` РЅРµ СѓРґР°Р»С‘РЅ вЂ” РѕСЃС‚Р°С‘С‚СЃСЏ РІ API.
- Feature: `saveProject()` (ProjectFileOperations) Р±РѕР»СЊС€Рµ РЅРµ СЃРїСЂР°С€РёРІР°РµС‚ РёРјСЏ С„Р°Р№Р»Р° РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё `project.fileName` вЂ” РёРјСЏ Р±РµСЂС‘С‚СЃСЏ РёР· `project.name` С‡РµСЂРµР· РїСЂРёРІР°С‚РЅС‹Р№ РјРµС‚РѕРґ `_deriveFileNameFromProjectName()` (Р·Р°РјРµРЅСЏРµС‚ `/` Рё `\` РЅР° `-`, РґРѕР±Р°РІР»СЏРµС‚ `.json`). `saveProjectAs()` СЃРїСЂР°С€РёРІР°РµС‚ РёРјСЏ РєР°Рє Рё РїСЂРµР¶РґРµ.
- Feature: `saveLevel()` (LevelFileOperations) РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё `session.fileName` РїРѕРєР°Р·С‹РІР°РµС‚ prompt "Enter file name:" СЃ РґРµС„РѕР»С‚РѕРј "level.json", РІРјРµСЃС‚Рѕ С‚РёС…РѕРіРѕ СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕРґ "level.json" Р±РµР· РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.
- Feature: `createDialog('prompt')` РІ UniversalDialog С‚РµРїРµСЂСЊ СЂРµРЅРґРµСЂРёС‚СЃСЏ Р‘Р•Р— header (Р·Р°РіРѕР»РѕРІРѕРє "Input" + РєСЂРµСЃС‚РёРє Р·Р°РєСЂС‹С‚РёСЏ); alert/confirm header РЅРµ РёР·РјРµРЅРёР»СЃСЏ. Cancel/ESC/РєР»РёРє РїРѕ РѕРІРµСЂР»РµСЋ Р·Р°РєСЂС‹РІР°СЋС‚ РґРёР°Р»РѕРі РєР°Рє Рё РїСЂРµР¶РґРµ.
- Feature: LevelFileOperations multi-level file ops (v3.57.0, Р¤Р°Р·Р° 5 multi-level) вЂ” `newLevel()` Рё `openLevel()` С‚РµРїРµСЂСЊ Р”РћР‘РђР’Р›РЇР®Рў РЅРѕРІСѓСЋ РІРєР»Р°РґРєСѓ/LevelSession РІРјРµСЃС‚Рѕ Р·Р°РјРµРЅС‹ С‚РµРєСѓС‰РµРіРѕ СѓСЂРѕРІРЅСЏ; `openLevel()` РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РґРµР»Р°РµС‚ best-effort dedup РїРѕ fileName вЂ” РµСЃР»Рё С„Р°Р№Р» СѓР¶Рµ РѕС‚РєСЂС‹С‚, РїРµСЂРµРєР»СЋС‡Р°РµС‚СЃСЏ РЅР° РІРєР»Р°РґРєСѓ РІРјРµСЃС‚Рѕ РґСѓР±Р»РёРєР°С‚Р°. `saveLevel()`/`saveLevelAs()` СЂР°Р±РѕС‚Р°СЋС‚ СЃ per-session fileName, РіР°СЂР°РЅС‚РёСЂСѓСЏ С‡С‚Рѕ СЃРѕС…СЂР°РЅРµРЅРёРµ B РЅРµ РїРµСЂРµР·Р°РїРёС€РµС‚ С„Р°Р№Р» A. РќРѕРІС‹Р№ `closeLevel(levelId)` Р·Р°РєСЂС‹РІР°РµС‚ РІРєР»Р°РґРєСѓ (РЅРµР»СЊР·СЏ Р·Р°РєСЂС‹С‚СЊ РїРѕСЃР»РµРґРЅРёР№ СѓСЂРѕРІРµРЅСЊ, СЃРїСЂР°С€РёРІР°РµС‚ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїСЂРё dirty). Per-session `isDirty` (РєР°Р¶РґР°СЏ LevelSession РЅРµР·Р°РІРёСЃРёРјР°), РіР»РѕР±Р°Р»СЊРЅС‹Р№ `stateManager.isDirty` СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ РЅР° РіСЂР°РЅРёС†Рµ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РІРєР»Р°РґРѕРє.

## [Unreleased] (РґРѕ commit f9d64c4, 2026-07-09)

- Feature: РїСѓСЃС‚С‹Рµ (assignable) С…РѕС‚РєРµР№-СЃР»РѕС‚С‹ РґР»СЏ 9 РєРѕРјР°РЅРґ, Сѓ РєРѕС‚РѕСЂС‹С… СЂР°РЅСЊС€Рµ РЅРµ Р±С‹Р»Рѕ Р±РёРЅРґР° РІРѕРѕР±С‰Рµ вЂ” `editor.toggleFullscreen`, `editor.toggleGameMode`, `editor.toggleSnapToGrid`, `editor.toggleObjectBoundaries`, `editor.toggleObjectCollisions`, `ui.toggleConsole`, `ui.toggleStatusBar`, `editor.openProjectSettings`, `editor.openSettings` вЂ” РґРѕР±Р°РІР»РµРЅС‹ РІ `config/defaults/shortcuts.json` СЃ `key: ""`, РїСЂРёРІСЏР·Р°РЅС‹ С‡РµСЂРµР· `shortcutKey` Рє СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёРј РїСѓРЅРєС‚Р°Рј View/Settings-РјРµРЅСЋ РІ `config/menu.js`, РїСЂРѕРІРµРґРµРЅС‹ С‡РµСЂРµР· `EventHandlers.handleKeyDown` (`_matchesShortcut`), СЃСЂР°Р·Сѓ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ/РЅР°Р·РЅР°С‡Р°СЋС‚СЃСЏ РІ Settings > Hotkeys. РџРѕРїСѓС‚РЅС‹Р№ С„РёРєСЃ: `SettingsPanel.saveHotkey()` РІС‹Р·С‹РІР°Р» `menuManager.refreshShortcutLabels()`, РєРѕС‚РѕСЂС‹Р№ РѕР±РЅРѕРІР»СЏРµС‚ С‚РѕР»СЊРєРѕ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `[data-shortcut-key]` span вЂ” РґР»СЏ РїСѓРЅРєС‚Р°, РёР·РЅР°С‡Р°Р»СЊРЅРѕ РѕС‚СЂРµРЅРґРµСЂРµРЅРЅРѕРіРѕ СЃ РїСѓСЃС‚С‹Рј С…РѕС‚РєРµРµРј (span РЅРµ СЃРѕР·РґР°РІР°Р»СЃСЏ), СЂРёР±Р°Р№РЅРґ РЅРµ РѕС‚СЂР°Р¶Р°Р»СЃСЏ РІ РјРµРЅСЋ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё СЃС‚СЂР°РЅРёС†С‹; Р·Р°РјРµРЅРµРЅРѕ РЅР° РїРѕР»РЅС‹Р№ `menuManager.refresh()`.
- Fix: СѓРґР°Р»РµРЅР° СЃРµРєС†РёСЏ "View Settings" РёР· General Settings (`SettingsPanelRenderers.js::renderGeneralSettings`) вЂ” РґСѓР±Р»РёСЂРѕРІР°Р»Р° РѕРїС†РёРё РјРµРЅСЋ View (Immersive Mode, Boundaries, Collisions, Parallax), РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· `configManager`. Р—Р°РѕРґРЅРѕ СѓРґР°Р»РµРЅС‹ РјС‘СЂС‚РІС‹Рµ Р·Р°РїРёСЃРё `editor.view.gameMode/objectBoundaries/objectCollisions/parallax` РёР· `SettingsSyncManager.stateMapping` (Р±С‹Р»Рё РЅСѓР¶РЅС‹ С‚РѕР»СЊРєРѕ РґР»СЏ СЌС‚РёС… input'РѕРІ).
- Refactor: СѓРґР°Р»С‘РЅ РјС‘СЂС‚РІС‹Р№ С…Р°СЂРґРєРѕРґ С…РѕС‚РєРµРµРІ вЂ” `MENU_CONFIG.shortcuts` (РєР°СЂС‚Р° `'Ctrl+D': 'duplicate'` Рё С‚.Рї., СЂР°Р·РѕС€РµРґС€Р°СЏСЃСЏ СЃ СЂРµР°Р»СЊРЅС‹РјРё Р±РёРЅРґР°РјРё РІ `config/defaults/shortcuts.json`) Рё `getShortcutTarget()` РІ `config/menu.js` РЅРёРіРґРµ РЅРµ РІС‹Р·С‹РІР°Р»РёСЃСЊ (С‚РѕР»СЊРєРѕ РёРјРїРѕСЂС‚РёСЂРѕРІР°Р»РёСЃСЊ РІ `EventHandlers.js`), СѓРґР°Р»РµРЅС‹ РІРјРµСЃС‚Рµ СЃ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рј РёРјРїРѕСЂС‚РѕРј.
- Feature: `CanvasContextMenu` С‚РµРїРµСЂСЊ РїРѕРєР°Р·С‹РІР°РµС‚ СЂРµР°Р»СЊРЅС‹Рµ С…РѕС‚РєРµРё (Copy=Ctrl+C, Cut=Ctrl+X, Paste=Ctrl+V, Duplicate=Shift+D, Delete=Delete, Group=Shift+G, Ungroup=Alt+G) РІ С‚РѕРј Р¶Рµ trailing-СЃР»РѕС‚Рµ, С‡С‚Рѕ Рё nav-РјРµРЅСЋ вЂ” С‡РµСЂРµР· РЅРѕРІС‹Р№ `CanvasContextMenu.resolveShortcut(category, action)` (РёСЃРїРѕР»СЊР·СѓРµС‚ `ShortcutFormatter` + `configManager.getShortcuts()`). `BaseContextMenu.addMenuItem()` РїРѕР»СѓС‡РёР» РѕРїС†РёСЋ `shortcut` (СЃС‚СЂРѕРєР° РёР»Рё С„СѓРЅРєС†РёСЏ вЂ” С„СѓРЅРєС†РёСЏ СЂРµР·РѕР»РІРёС‚СЃСЏ Р·Р°РЅРѕРІРѕ РїСЂРё РєР°Р¶РґРѕРј РѕС‚РєСЂС‹С‚РёРё РјРµРЅСЋ, РѕС‚СЂР°Р¶Р°СЏ live-СЂРµР±Р°Р№РЅРґ С‡РµСЂРµР· Settings > Hotkeys, С‚.Рє. DOM РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РїРµСЂРµСЃРѕР±РёСЂР°РµС‚СЃСЏ РЅР° РєР°Р¶РґС‹Р№ РїРѕРєР°Р·).
- Feature: LevelsManager Phase 6 edge cases (v3.57.0, Р¤Р°Р·Р° 6 multi-level) вЂ” `levelMRU: string[]` РѕС‚СЃР»РµР¶РёРІР°РµС‚ РїРѕСЂСЏРґРѕРє РЅРµРґР°РІРЅРёС… С‚РµРєСѓС‰РёС… СѓСЂРѕРІРЅРµР№, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РєР°Рє fallback РїСЂРё `closeLevel()` РґР»СЏ РІС‹Р±РѕСЂР° СЃР»РµРґСѓСЋС‰РµРіРѕ СѓСЂРѕРІРЅСЏ РІРјРµСЃС‚Рѕ РІСЃРµРіРґР° РїРµСЂРІРѕРіРѕ РїРѕ С‚Р°Р±Сѓ. РќРѕРІС‹Р№ `getVisibleSessionsForRender(sessions?)` РїРµСЂРµРЅРѕСЃРёС‚ С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ РІ РєРѕРЅРµС† РјР°СЃСЃРёРІР° РєРѕРјРїРѕСѓР·РёРЅРіР° вЂ” С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ Р’РЎР•Р“Р”Рђ СЂРёСЃСѓРµС‚СЃСЏ РїРѕРІРµСЂС… РѕСЃС‚Р°Р»СЊРЅС‹С… РІРёРґРёРјС‹С…, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ РїРѕР·РёС†РёРё С‚Р°Р±Р° (СЂРµС€РµРЅРёРµ СЂР°Р·РґРµР»Р° 12 РїСѓРЅРєС‚ 2 РїР»Р°РЅР°, СЂРµР°Р»РёР·РѕРІР°РЅРѕ РІ Р¤Р°Р·Рµ 3 РЅРµРїРѕР»РЅРѕСЃС‚СЊСЋ, РёСЃРїСЂР°РІР»РµРЅРѕ РІ Р¤Р°Р·Рµ 6). РќРѕРІС‹Р№ `cycleLevel(direction)` С†РёРєР»РёС‡РµСЃРєРё РїРµСЂРµРєР»СЋС‡Р°РµС‚ РјРµР¶РґСѓ РѕС‚РєСЂС‹С‚С‹РјРё СѓСЂРѕРІРЅСЏРјРё (+1 СЃР»РµРґСѓСЋС‰РёР№, -1 РїСЂРµРґС‹РґСѓС‰РёР№), РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ Ctrl+PageDown/PageUp. РќРѕРІС‹Р№ `reorderLevels(newOrder)` РјРµРЅСЏРµС‚ РїРѕСЂСЏРґРѕРє С‚Р°Р±РѕРІ (РїРѕР»РЅР°СЏ РїРµСЂРµСЃС‚Р°РЅРѕРІРєР° `levelOrder`), РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ drag-reorder РІ LevelsPanel; РЅРµРІР°Р»РёРґРЅР°СЏ РїРµСЂРµСЃС‚Р°РЅРѕРІРєР° в†’ no-op + `Logger.status.warn`. `toggleLevelVisibility()` РґРѕР±Р°РІР»РµРЅР° soft-cap РїСЂРѕРІРµСЂРєР°: warning РІ СЃС‚Р°С‚СѓСЃ-Р±Р°СЂРµ РїСЂРё РїРµСЂРµСЃРµС‡РµРЅРёРё РїРѕСЂРѕРіР° `VISIBLE_LEVELS_SOFT_CAP=5` (С‚РѕР»СЊРєРѕ РЅР° СЃР°РјРѕРј РїРµСЂРµС…РѕРґРµ, РЅРµ РЅР° РєР°Р¶РґРѕРј РєР»РёРєРµ РІС‹С€Рµ РїРѕСЂРѕРіР°).
- Feature: LevelsPanel Phase 6 edge cases (v3.57.0, Р¤Р°Р·Р° 6 multi-level) вЂ” drag-reorder РІРєР»Р°РґРѕРє СѓСЂРѕРІРЅРµР№ (Р·РµСЂРєР°Р»РёС‚ `LayersPanel.js`), Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ РїСЂРё Р°РєС‚РёРІРЅРѕРј РїРѕРёСЃРєРµ (DOM-РёСЃС‚РѕС‡РЅРёРє РЅРµРїРѕР»РЅС‹Р№). Р”РёР·Р°РјР±РёРіСѓР°С†РёСЏ РёРјС‘РЅ РїСЂРё РєРѕР»Р»РёР·РёРё: РІРёР·СѓР°Р»СЊРЅС‹Р№ СЃСѓС„С„РёРєСЃ `"Untitled Level (2)"` РІ `.level-name-display` С‚РѕР»СЊРєРѕ РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ, СЂРµР°Р»СЊРЅРѕРµ `level.meta.name` РЅРµ РјРµРЅСЏРµС‚СЃСЏ; РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РЅР° РєР°Р¶РґРѕРј СЂРµРЅРґРµСЂРµ РЅР° РїРѕР»РЅРѕРј СЃРїРёСЃРєРµ СЃРµСЃСЃРёР№ (Р±РµР· С„РёР»СЊС‚СЂР° РїРѕРёСЃРєР°), РІРєР»СЋС‡Р°СЏ РїРѕСЃР»Рµ rename.
- Feature: РҐРѕС‚РєРµРё Phase 6 (v3.57.0) вЂ” РЅРѕРІС‹Рµ РіРѕСЂСЏС‡РёРµ РєР»Р°РІРёС€Рё `editor.nextLevel` (Ctrl+PageDown) Рё `editor.previousLevel` (Ctrl+PageUp) РґР»СЏ С†РёРєР»РёС‡РµСЃРєРѕРіРѕ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РјРµР¶РґСѓ РѕС‚РєСЂС‹С‚С‹РјРё РІРєР»Р°РґРєР°РјРё СѓСЂРѕРІРЅРµР№ С‡РµСЂРµР· `levelsManager.cycleLevel()`. Р РµРіРёСЃС‚СЂРёСЂСѓСЋС‚СЃСЏ РІ `config/defaults/shortcuts.json` Рё РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ РІ `src/event-system/EventHandlers.js::handleKeyDown`.
- Feature: Project вЂ” Р¤Р°Р·Р° 7 multi-level (СЃСѓС‰РЅРѕСЃС‚СЊ-РєРѕРЅС‚РµР№РЅРµСЂ РЅР°Р±РѕСЂР° РѕС‚РєСЂС‹С‚С‹С… СѓСЂРѕРІРЅРµР№). РќРѕРІС‹Р№ `src/models/Project.js` (`toJSON()`/`fromJSON()` вЂ” СЃР°РјРѕРґРѕСЃС‚Р°С‚РѕС‡РЅС‹Р№ JSON, СЌРјР±РµРґРґРёС‚ `Level.toJSON()` РєР°Р¶РґРѕРіРѕ РѕС‚РєСЂС‹С‚РѕРіРѕ СѓСЂРѕРІРЅСЏ + `visible`/`fileName`/РїРѕСЂСЏРґРѕРє/`currentLevelIndex`, С‚.Рє. `Level.toJSON()` РЅРµ СЃРµСЂРёР°Р»РёР·СѓРµС‚ `id`). РќРѕРІС‹Р№ `src/core/ProjectFileOperations.js` (BaseModule): `newProject()`/`openProject()` Р·Р°РјРµРЅСЏСЋС‚ РІРµСЃСЊ РЅР°Р±РѕСЂ РѕС‚РєСЂС‹С‚С‹С… РІРєР»Р°РґРѕРє (РµРґРёРЅС‹Р№ confirm РїСЂРё РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹С… РїСЂР°РІРєР°С… РІРјРµСЃС‚Рѕ N РґРёР°Р»РѕРіРѕРІ), `saveProject()`/`saveProjectAs()` СЃРєР°С‡РёРІР°СЋС‚ project-С„Р°Р№Р». РњРµРЅСЋ `Level` РїРµСЂРµРёРјРµРЅРѕРІР°РЅРѕ РІ `File` (`config/menu.js`, id `level`в†’`file`): РґРѕР±Р°РІР»РµРЅ Р±Р»РѕРє Project-РєРѕРјР°РЅРґ (New/Open/Save/Save As Project) С‡РµСЂРµР· СЃРµРїР°СЂР°С‚РѕСЂ РѕС‚ Level-РєРѕРјР°РЅРґ, `Import Assets...` РїРµСЂРµРЅРµСЃС‘РЅ РІ РєРѕРЅРµС† `File` РёР· `Settings`; `Settings` РїРѕР»СѓС‡РёР» `Project Settings...` (РЅРѕРІС‹Р№ `src/ui/ProjectSettingsDialog.js`, extends `BaseDialog`, РїРѕРєР° СЃС‚Р°Р± вЂ” СЂРµРґР°РєС‚РёСЂСѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ `project.name`). `LevelEditor.js`: passthrough-РјРµС‚РѕРґС‹, `projectFileOperations` Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ РєР°Рє BaseModule, РїРѕР»СЏ `project`/`projectSettingsDialog` + cleanup РІ `destroy()`. `#menu-level` DOM-СЃРµР»РµРєС‚РѕСЂС‹ РІ `EventHandlers.js` (2 РјРµСЃС‚Р°) РѕР±РЅРѕРІР»РµРЅС‹ РЅР° `#menu-file`.

- Refactor: MenuItemTemplateUtils РїРµСЂРµРїРёСЃР°РЅ СЃ РµРґРёРЅРѕРіРѕ `renderMenuItemIconHtml(icon)` РЅР° С‚СЂРё СЌРєСЃРїРѕСЂС‚Р° РґР»СЏ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕР№ СЂР°Р·РјРµС‚РєРё РїСѓРЅРєС‚Р° РјРµРЅСЋ. РќРѕРІР°СЏ СЃС…РµРјР° `[leading | body | trailing]`: `renderMenuItemLeadingHtml({ icon, checkboxId, checked })` вЂ” РµРґРёРЅС‹Р№ 18Г—18px Р±Р»РѕРє РґР»СЏ РёРєРѕРЅРєРё РёР»Рё toggle-С‡РµРєР±РѕРєСЃР° РїСѓРЅРєС‚Р° (СЂР°РЅСЊС€Рµ СЂРµРЅРґРµСЂРёР»РёСЃСЊ СЃ СЂР°Р·РЅС‹РјРё СЂР°Р·РјРµСЂР°РјРё/margin); `renderMenuItemBodyHtml({ leadingHtml, label })` вЂ” РѕР±РѕСЂР°С‡РёРІР°РµС‚ leading+С‚РµРєСЃС‚ РІ `<span class="flex items-center">` (РµРґРёРЅС‹Р№ flex-item СЃР»РµРІР°, С‡С‚РѕР±С‹ trailing РїСЂРё `justify-content:space-between` РЅРµ С†РµРЅС‚СЂРёСЂРѕРІР°Р» С‚РµРєСЃС‚); `renderMenuItemTrailingHtml(text, { shortcutKey })` вЂ” РµРґРёРЅС‹Р№ trailing-Р±Р»РѕРє РґР»СЏ С…РѕС‚РєРµСЏ РёР»Рё СЃС‚СЂРµР»РєРё С„Р»Р°СѓС‚-РїРѕРґРјРµРЅСЋ в–ё. РџРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚: nav submenu-С‚СЂРёРіРіРµСЂС‹ (`createSubmenuItem`) С‚РµРїРµСЂСЊ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚ РёРєРѕРЅРєСѓ (itemConfig.icon); РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚ `item.shortcut` РІ trailing-СЃР»РѕС‚Рµ (РїРѕРєР° РЅРµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ, РЅРѕ СЃР»РѕС‚ РіРѕС‚РѕРІ). `config/menu.js`: СѓРґР°Р»РµРЅРѕ РјС‘СЂС‚РІРѕРµ РїРѕР»Рµ `checkboxHtml` РёР· `templates.toggle`.
- Feature: LevelFileOperations multi-level file ops (v3.57.0, Р¤Р°Р·Р° 5 multi-level) вЂ” `newLevel()` Рё `openLevel()` С‚РµРїРµСЂСЊ Р”РћР‘РђР’Р›РЇР®Рў РЅРѕРІСѓСЋ РІРєР»Р°РґРєСѓ/LevelSession РІРјРµСЃС‚Рѕ Р·Р°РјРµРЅС‹ С‚РµРєСѓС‰РµРіРѕ СѓСЂРѕРІРЅСЏ; `openLevel()` РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РґРµР»Р°РµС‚ best-effort dedup РїРѕ fileName вЂ” РµСЃР»Рё С„Р°Р№Р» СѓР¶Рµ РѕС‚РєСЂС‹С‚, РїРµСЂРµРєР»СЋС‡Р°РµС‚СЃСЏ РЅР° РІРєР»Р°РґРєСѓ РІРјРµСЃС‚Рѕ РґСѓР±Р»РёРєР°С‚Р°. `saveLevel()`/`saveLevelAs()` СЂР°Р±РѕС‚Р°СЋС‚ СЃ per-session fileName, РіР°СЂР°РЅС‚РёСЂСѓСЏ С‡С‚Рѕ СЃРѕС…СЂР°РЅРµРЅРёРµ B РЅРµ РїРµСЂРµР·Р°РїРёС€РµС‚ С„Р°Р№Р» A. РќРѕРІС‹Р№ `closeLevel(levelId)` Р·Р°РєСЂС‹РІР°РµС‚ РІРєР»Р°РґРєСѓ (РЅРµР»СЊР·СЏ Р·Р°РєСЂС‹С‚СЊ РїРѕСЃР»РµРґРЅРёР№ СѓСЂРѕРІРµРЅСЊ, СЃРїСЂР°С€РёРІР°РµС‚ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РїСЂРё dirty). Per-session `isDirty` (РєР°Р¶РґР°СЏ LevelSession РЅРµР·Р°РІРёСЃРёРјР°), РіР»РѕР±Р°Р»СЊРЅС‹Р№ `stateManager.isDirty` СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ РЅР° РіСЂР°РЅРёС†Рµ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РІРєР»Р°РґРѕРє. РњРµРЅСЋ "Level" РїРѕРїРѕР»РЅРµРЅРѕ РїСѓРЅРєС‚РѕРј "Close Level".

- Fix: `MenuManager.createMenuItem()` вЂ” РїСѓРЅРєС‚С‹ РјРµРЅСЋ СЃРѕ С€РѕСЂС‚РєР°С‚РѕРј (Parallax Mode, Toolbar, Assets Panel, Right Panel, Left Panel, Grid Рё С‚.Рґ.) РІРёР·СѓР°Р»СЊРЅРѕ РІС‹РіР»СЏРґРµР»Рё С†РµРЅС‚СЂРёСЂРѕРІР°РЅРЅС‹РјРё: С‡РµРєР±РѕРєСЃ+Р»РµР№Р±Р» Рё `shortcutSpan` Р±С‹Р»Рё С‚СЂРµРјСЏ РѕС‚РґРµР»СЊРЅС‹РјРё flex-СЌР»РµРјРµРЅС‚Р°РјРё РїСЂРё `justify-between`, РёР·-Р·Р° С‡РµРіРѕ СЃСЂРµРґРЅРёР№ (Р»РµР№Р±Р») РїРѕР»СѓС‡Р°Р» СЂР°РІРЅС‹Рµ РѕС‚СЃС‚СѓРїС‹ СЃ РѕР±РµРёС… СЃС‚РѕСЂРѕРЅ. РљРѕРЅС‚РµРЅС‚ (РёРєРѕРЅРєР°+С‡РµРєР±РѕРєСЃ+Р»РµР№Р±Р») РѕР±С‘СЂРЅСѓС‚ РІ РѕРґРёРЅ `<span class="flex items-center">`, С‚РµРїРµСЂСЊ `justify-between` СЂР°Р±РѕС‚Р°РµС‚ РјРµР¶РґСѓ РґРІСѓРјСЏ Р±Р»РѕРєР°РјРё вЂ” РєРѕРЅС‚РµРЅС‚ СЃР»РµРІР°, С€РѕСЂС‚РєР°С‚ СЃРїСЂР°РІР°.
- Fix: `LayersPanel.onAddLayer()`/`setupKeyboardShortcuts()` вЂ” РЅРѕРІС‹Рµ СЃР»РѕРё (РІ С‚.С‡. 3 СЃСЂР°Р·Сѓ РїРѕ Shift/Ctrl+РєР»РёРєСѓ) РѕС‚РѕР±СЂР°Р¶Р°Р»РёСЃСЊ СЃРєСЂС‹С‚С‹РјРё (РїРѕР»СѓРїСЂРѕР·СЂР°С‡РЅР°СЏ РёРєРѕРЅРєР° РіР»Р°Р·Р°, opacity 0.45) РєР°Рє РІ РїР°РЅРµР»Рё, С‚Р°Рє Рё РЅР° РєР°РЅРІР°СЃРµ, РїРѕРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РєР»РёРєР°Р» РїРѕ РїР°РЅРµР»Рё; РїСЂРёС‡РёРЅР° вЂ” `RenderOperations.visibleLayersCache` РЅРµ РёРЅРІР°Р»РёРґРёСЂРѕРІР°Р»СЃСЏ РїРѕСЃР»Рµ `level.addLayer()`. Р”РѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ `invalidateLayerVisibilityCache()` СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ СЃР»РѕСЏ(С‘РІ) РІ РѕР±РѕРёС… РјРµСЃС‚Р°С….

- Feature: RenderOperations multi-level compositing (v3.57.0, Р¤Р°Р·Р° 3 multi-level) вЂ” `render()` С‚РµРїРµСЂСЊ РєРѕРјРїРѕР·РёС‚РёС‚ РѕР±СЉРµРєС‚С‹ Р’РЎР•РҐ РІРёРґРёРјС‹С… СѓСЂРѕРІРЅРµР№ РІ РѕРґРЅРѕРј РєР°РґСЂРµ (РІРёРґРёРјРѕСЃС‚СЊ С‡РµСЂРµР· `session.visible`, per-level eye-icon РІ LevelsPanel), С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ РІСЃРµРіРґР° РїРѕРІРµСЂС…. Grid/selection/debug-overlays РѕСЃС‚Р°СЋС‚СЃСЏ current-level-only Рё РЅРµ РєРѕРјРїРѕР·РёС‚СЏС‚СЃСЏ. Dimming-СЂРµР¶РёРјС‹ (isolate/solo/group-edit-mode) РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ Рє С‚РµРєСѓС‰РµРјСѓ СѓСЂРѕРІРЅСЋ. **Namespacing РєРµС€РµР№**: `visibleObjectsCache` РєР»СЋС‡РёСЂСѓРµС‚СЃСЏ РєР°Рє `${levelId}_${cameraKey}`; `visibleLayersCache` СЃС‚Р°Р» `Map<levelId,...>`; `CacheManager` РёСЃРїРѕР»СЊР·СѓРµС‚ `${levelId}:${objId}` РґР»СЏ РІСЃРµС… object-РєРµС€РµР№ (Р·Р°С‰РёС‚Р° РѕС‚ РєРѕР»Р»РёР·РёР№ id РјРµР¶РґСѓ СѓСЂРѕРІРЅСЏРјРё). **РџР°СЂР°РјРµС‚СЂРёР·Р°С†РёСЏ РјРµС‚РѕРґРѕРІ**: `getVisibleObjects()`, `getVisibleLayerIds()`, `buildSpatialIndex()` Рё РїСЂРѕС‡РёРµ РїРѕР»СѓС‡РёР»Рё РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Р№ РїР°СЂР°РјРµС‚СЂ `level` (РґРµС„РѕР»С‚ С‚РµРєСѓС‰РёР№) РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё. **РџР°СЂР°Р»Р»Р°РєСЃ fix**: `renderParallaxObjects()` Рё `getObjectWorldBounds()` С‚РµРїРµСЂСЊ РїСЂРёРЅРёРјР°СЋС‚ `level` РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ СЂРµРЅРґРµСЂР° РЅР° non-current СѓСЂРѕРІРЅСЏС…. **РџРѕР±РѕС‡РЅС‹Рµ С„РёРєСЃС‹**: РѕР±СЉРµРґРёРЅРµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ `invalidateSpatialIndex()` РјРµС‚РѕРґС‹; СѓРґР°Р»С‘РЅ РјС‘СЂС‚РІС‹Р№ РєРѕРґ (`effectiveLayerCache` РЅР° РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРј РїРѕР»Рµ). Р’РµСЂРёС„РёРєР°С†РёСЏ: СЂР°РЅС‚Р°Р№Рј-С‚РµСЃС‚С‹ РІ Р±СЂР°СѓР·РµСЂРµ СЃ РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕР№ РєРѕР»Р»РёР·РёРµР№ id Рё РІР»РѕР¶РµРЅРЅС‹РјРё РіСЂСѓРїРїР°РјРё РЅР° non-current СѓСЂРѕРІРЅСЏС…; СЂРµРіСЂРµСЃСЃРёРѕРЅРЅР°СЏ РїСЂРѕРІРµСЂРєР° РѕРґРёРЅРѕС‡РЅРѕРіРѕ СѓСЂРѕРІРЅСЏ.
- Feature: LevelsPanel UI (v3.57.0, Р¤Р°Р·Р° 2 multi-level) вЂ” РЅРѕРІР°СЏ РїР°РЅРµР»СЊ РІ РїСЂР°РІРѕР№ РІРєР»Р°РґРєРµ Layers (РЅР°Рґ LayersPanel) РґР»СЏ СЃРїРёСЃРєР° РѕС‚РєСЂС‹С‚С‹С… СѓСЂРѕРІРЅРµР№ (LevelSession). Р¤СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ: РєРЅРѕРїРєР° "+Add" РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ РЅРѕРІС‹С… СѓСЂРѕРІРЅРµР№, РєР»РёРє РїРѕ СЌР»РµРјРµРЅС‚Сѓ РїРµСЂРµРєР»СЋС‡Р°РµС‚ С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ С‡РµСЂРµР· `setCurrentLevel()`, eye-icon РґР»СЏ per-level visibility (С‚РµРїРµСЂСЊ СЃ СЌС„С„РµРєС‚РѕРј РЅР° СЂРµРЅРґРµСЂ РІ Р¤Р°Р·Рµ 3), double-click/РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ "Rename" РґР»СЏ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёСЏ, РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ "Make Current". РўРµРєСѓС‰РёРµ РѕРіСЂР°РЅРёС‡РµРЅРёСЏ (РѕС‚Р»РѕР¶РµРЅРѕ РЅР° РїРѕР·РґРЅРµР№С€РёРµ С„Р°Р·С‹): РЅРµС‚ Close/Save/Duplicate (С‚СЂРµР±СѓСЋС‚ per-session save, Р¤Р°Р·Р° 5), РЅРµС‚ drag-reorder (Р¤Р°Р·Р° 6), РЅРµС‚ per-session dirty-РёРЅРґРёРєР°С‚РѕСЂР° РІ UI. **Р¤Р°Р№Р»С‹**: `src/ui/LevelsPanel.js`, `src/ui/LevelsContextMenu.js`, `src/ui/panel-structures/LevelsPanelStructure.js`.
- Fix: `SearchSectionUtils.showSearchSectionForTab()` вЂ” РїСЂРё Р°РєС‚РёРІР°С†РёРё РІРєР»Р°РґРєРё 'layers' С‚РµРїРµСЂСЊ С‚Р°РєР¶Рµ РІС‹Р·С‹РІР°РµС‚ `editor.levelsPanel.renderLevelsSearchControls()` РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РїРѕР»СЏ РїРѕРёСЃРєР° РІ LevelsPanel.

- Feature: LevelsManager (v3.57.0, Р¤Р°Р·Р° 1 multi-level) вЂ” РЅРѕРІС‹Р№ BaseModule РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РјРЅРѕР¶РµСЃС‚РІРѕРј РѕС‚РєСЂС‹С‚С‹С… `LevelSession`; `addLevel()` СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚ СѓСЂРѕРІРµРЅСЊ РІ `editor.levelSessions: Map` + `editor.levelOrder: Array`, `setCurrentLevel(levelId)` РїРµСЂРµРєР»СЋС‡Р°РµС‚ С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ СЃ СЃРѕС…СЂР°РЅРµРЅРёРµРј/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµРј camera view, selectedObjects, groupEditMode, outliner state, currentLayerId Рё history (С‡РµСЂРµР· `HistoryManager.exportState()`/`importState()`), Р‘Р•Р— РїРѕР»РЅРѕРіРѕ `stateManager.reset()`. **Р’Р°Р¶РЅРѕ**: СЌС‚Рѕ РІРЅСѓС‚СЂРµРЅРЅСЏСЏ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂР° Р±РµР· UI; РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїРѕ-РїСЂРµР¶РЅРµРјСѓ РІРёРґРёС‚ Рё СЂР°Р±РѕС‚Р°РµС‚ СЃ РѕРґРЅРёРј СѓСЂРѕРІРЅРµРј. Multi-level С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ РїРѕСЏРІРёС‚СЃСЏ РІ РїРѕР·РґРЅРµР№С€РёС… С„Р°Р·Р°С….
- Feature: LevelSession (v3.57.0, Р¤Р°Р·Р° 1) вЂ” РЅРѕРІС‹Р№ РєР»Р°СЃСЃ РІ `src/models/LevelSession.js`, editor-only РѕР±С‘СЂС‚РєР° РЅР°Рґ `Level` (СѓРїСЂР°РІР»СЏРµС‚ visible-С„Р»Р°РіРѕРј СѓСЂРѕРІРЅСЏ, fileName, isDirty, viewState, history). РќР• СЃРµСЂРёР°Р»РёР·СѓРµС‚СЃСЏ РІ `Level.toJSON()`. РџРѕ РѕРґРЅРѕР№ СЃРµСЃСЃРёРё РЅР° РѕС‚РєСЂС‹С‚С‹Р№ СѓСЂРѕРІРµРЅСЊ.
- Feature: HistoryManager.exportState() / importState() (v3.57.0) вЂ” СЃРЅСЏС‚РёРµ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ undo/redo СЃС‚РµРєР° (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё РјРµР¶РґСѓ СѓСЂРѕРІРЅСЏРјРё РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ undo-РёСЃС‚РѕСЂРёРё РєР°Р¶РґРѕРіРѕ).
- Feature: LevelEditor.level вЂ” С‚РµРїРµСЂСЊ computed getter/setter: СЂРµР·РѕР»РІРёС‚СЃСЏ С‡РµСЂРµР· `this.levelSessions.get(this.currentLevelId)`, РЅР°Р·Р°Рґ-СЃРѕРІРјРµСЃС‚РёРјРѕ РґР»СЏ ~300 СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… call sites. Р”РѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅРЅС‹Р№ Р°Р»РёР°СЃ `getCurrentLevel()` (= `getLevel()`) РґР»СЏ РЅРѕРІРѕРіРѕ РєРѕРґР°.
- Feature: CanvasRenderer вЂ” type-РёРєРѕРЅРєРё РєР°Рє fallback-РІРёР·СѓР°Р». РџСЂРё СЂР°Р·РјРµС‰РµРЅРёРё GameObject Р±РµР· Р·Р°РіСЂСѓР¶РµРЅРЅРѕРіРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ (`obj.imgSrc` РЅРµ Р·Р°РґР°РЅ/РЅРµ Р·Р°РіСЂСѓР¶РµРЅ) СЂРёСЃСѓРµС‚СЃСЏ SVG-РёРєРѕРЅРєР° С‚РёРїР° Р°СЃСЃРµС‚Р° (РёР· `buildTypeIconSvg`, `AssetTypeIcons.js`) РїРѕРІРµСЂС… С†РІРµС‚РЅРѕРіРѕ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° (50% РѕС‚ РјРµРЅСЊС€РµРіРѕ РёР·РјРµСЂРµРЅРёСЏ, С†РµРЅС‚СЂРёСЂРѕРІР°РЅР°). РРєРѕРЅРєР° РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ С‚РёРїРѕРІ РёР· РєР°С‚Р°Р»РѕРіР° `AssetTypes.js` (РІС‹Р·РѕРІ `getAssetTypeById(obj.type)`); РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ С‚РёРїС‹ РѕСЃС‚Р°СЋС‚СЃСЏ СЃ РїСѓСЃС‚С‹Рј РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРѕРј. РќРѕРІС‹Рµ РјРµС‚РѕРґС‹: `CanvasRenderer.getTypeIconImage(typeId)` (Р»РµРЅРёРІР°СЏ СЂР°СЃС‚РµСЂРёР·Р°С†РёСЏ + РєСЌС€ РїРѕ `${typeId}|${color}`), РѕС‡РёСЃС‚РєР° РєСЌС€Р° РІ `destroy()` РІРјРµСЃС‚Рµ СЃ `imageCache`. РћР±РµСЃРїРµС‡РёРІР°РµС‚ СѓР·РЅР°РІР°РµРјРѕСЃС‚СЊ placeholder-РѕР±СЉРµРєС‚РѕРІ РЅР° canvas.

- Fix: `AssetTypeIcons.buildTypeIconSvg` вЂ” canvas type-РёРєРѕРЅРєРё (СЃРј. РІС‹С€Рµ) РЅРµ РѕС‚СЂРёСЃРѕРІС‹РІР°Р»РёСЃСЊ: СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅС‹Р№ `<svg>` РЅРµ СЃРѕРґРµСЂР¶Р°Р» `xmlns="http://www.w3.org/2000/svg"`, РёР·-Р·Р° С‡РµРіРѕ data-URI `Image` СЂР°СЃС‚РµСЂРёР·РѕРІР°Р»СЃСЏ РІ 0Г—0 (naturalWidth/Height=0) РїСЂРё С„РѕСЂРјР°Р»СЊРЅРѕ СѓСЃРїРµС€РЅРѕР№ Р·Р°РіСЂСѓР·РєРµ (`complete=true`), Рё guard РІ `CanvasRenderer.drawSingleObject` С‚РёС…Рѕ РїСЂРѕРїСѓСЃРєР°Р» РѕС‚СЂРёСЃРѕРІРєСѓ. Р’ AssetPanel (innerHTML) Р±Р°Рі РЅРµ РїСЂРѕСЏРІР»СЏР»СЃСЏ вЂ” С‚Р°Рј namespace РїРѕРґСЃС‚Р°РІР»СЏРµС‚ HTML-РїР°СЂСЃРµСЂ.

- Fix: `AssetPanel.showAssetFilterMenu` вЂ” Ctrl+click РјСѓР»СЊС‚Рё-РІС‹Р±РѕСЂ С‡РµРєР±РѕРєСЃРѕРІ РЅРµ СЂР°Р±РѕС‚Р°Р» (РєР»РёРє РІСЃРµРіРґР° Р·Р°РєСЂС‹РІР°Р» РјРµРЅСЋ, С‚.Рє. РЅРµ Р±С‹Р»Рѕ `applyOrDefer`/`ctrlReleaseHandler`, РІ РѕС‚Р»РёС‡РёРµ РѕС‚ `OutlinerPanel.showFilterMenu`); Р»РѕРіРёРєР° СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅР° 1:1 СЃ OutlinerPanel.

- Docs: РїРµСЂРµРЅРµСЃС‘РЅ Рё РїРµСЂРµС„РѕСЂРјР°С‚РёСЂРѕРІР°РЅ `tmp/game-editor-asset-types.md` РІ `docs/ASSET_TYPES_CATALOG.md` вЂ” СЃРІРµСЂРµРЅРѕ СЃ РёС‚РѕРіРѕРІРѕР№ СЂРµР°Р»РёР·Р°С†РёРµР№ (`AssetTypes.js`: 28 С‚РёРїРѕРІ, `ComponentTypes.js`: 19 С‚РёРїРѕРІ).

- Fix: `ui.cursorMenuMargin` (РґРµС„РѕР»С‚ 6px, РґРёР°РїР°Р·РѕРЅ 0-60) С‚РµРїРµСЂСЊ РѕРґРёРЅР°РєРѕРІРѕ СЂР°Р±РѕС‚Р°РµС‚ РІРѕ РІСЃРµС… С‚СЂС‘С… СЃРёСЃС‚РµРјР°С… РјРµРЅСЋ: РџРљРњ-РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ (BaseContextMenu вЂ” Р±С‹Р»Рѕ Рё СЂР°РЅСЊС€Рµ), РјРµРЅСЋ С„РёР»СЊС‚СЂРѕРІ (OutlinerPanel/AssetPanel), РіР»Р°РІРЅРѕРµ РјРµРЅСЋ nav-bar (MenuManager). `MenuPositioningUtils.setupMenuClosing()` С‚РµРїРµСЂСЊ persistent `document.addEventListener('mousemove', ...)` РЅР° Р’РЎР® Р¶РёР·РЅСЊ РјРµРЅСЋ (РІРјРµСЃС‚Рѕ С‚РѕР»СЊРєРѕ opening-Р°РЅРёРјР°С†РёРё), РїСЂРѕРІРµСЂСЏРµС‚ margin-aware РїРѕРїР°РґР°РЅРёРµ РєСѓСЂСЃРѕСЂР°; `MenuPositioningUtils.repositionMenu(menu, triggerElement, options)` РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚ РїРѕР·РёС†РёСЋ РјРµРЅСЋ РїРѕ СЂРµР°Р»СЊРЅС‹Рј СЂР°Р·РјРµСЂР°Рј РїРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ РїСѓРЅРєС‚РѕРІ (СЂР°РЅСЊС€Рµ РјРµРЅСЋ РІС‹С‡РёСЃР»СЏР»РѕСЃСЊ РїРѕ guess'Сѓ Рё РѕРєР°Р·С‹РІР°Р»РѕСЃСЊ СЃРјРµС‰РµРЅРѕ РѕС‚ РєРЅРѕРїРєРё, РІС‹Р·С‹РІР°СЏ РјРіРЅРѕРІРµРЅРЅРѕРµ Р·Р°РєСЂС‹С‚РёРµ РЅР° РїРµСЂРІС‹Р№ mousemove). `MenuManager.setupDropdownCursorMarginWatcher()` вЂ” РЅРѕРІС‹Р№ persistent watcher РґР»СЏ top-level dropdown, Р·Р°РєСЂС‹РІР°РµС‚ РїРѕ margin РІРјРµСЃС‚Рѕ РЅР°С‚РёРІРЅРѕРіРѕ mouseleave.
- Fix (РїСЂРѕРґРѕР»Р¶РµРЅРёРµ): margin РґР»СЏ РіР»Р°РІРЅРѕРіРѕ РјРµРЅСЋ РІСЃС‘ РµС‰С‘ РЅРµ РґРµР№СЃС‚РІРѕРІР°Р» вЂ” РѕР±РЅР°СЂСѓР¶РµРЅ РІС‚РѕСЂРѕР№, РЅРµР·Р°РІРёСЃРёРјС‹Р№ РѕР±СЂР°Р±РѕС‚С‡РёРє Р·Р°РєСЂС‹С‚РёСЏ, `MenuManager.setupMenuContainerHoverReset()` (РЅР°С‚РёРІРЅС‹Р№ `mouseleave` РЅР° `#menu-container`, РЅСѓР»РµРІРѕР№ РґРѕРїСѓСЃРє), РїСЂРёС‡С‘Рј РІС‹Р·С‹РІР°РІС€РёР№СЃСЏ Р”Р’РђР–Р”Р« (РёР· `initialize()` Рё РїРѕРІС‚РѕСЂРЅРѕ РёР· `setupMenuEvents()`). РўР°Рє РєР°Рє РѕС‚РєСЂС‹С‚С‹Р№ dropdown СЂРµРЅРґРµСЂРёС‚СЃСЏ РЅРёР¶Рµ layout-Р±РѕРєСЃР° РєРѕРЅС‚РµР№РЅРµСЂР° (`position:absolute`, `mt-0`), РґРІРёР¶РµРЅРёРµ РєСѓСЂСЃРѕСЂР° РІРЅРёР· РІ РјРµРЅСЋ РѕР±С‹С‡РЅРѕ РїРµСЂРµСЃРµРєР°Р»Рѕ РіСЂР°РЅРёС†Сѓ РєРѕРЅС‚РµР№РЅРµСЂР° СЂР°РЅСЊС€Рµ, С‡РµРј СѓСЃРїРµРІР°Р» СЃСЂР°Р±РѕС‚Р°С‚СЊ margin-aware watcher вЂ” РјРµРЅСЋ РіР°СЃР»Рѕ РјРіРЅРѕРІРµРЅРЅРѕ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ `ui.cursorMenuMargin`. РњРµС‚РѕРґ СѓРґР°Р»С‘РЅ, РѕР±Р° РІС‹Р·РѕРІР° СѓР±СЂР°РЅС‹; РµРіРѕ СЂРѕР»СЊ (СЃР±СЂРѕСЃ `hoverModeEnabled` РїСЂРё СѓС…РѕРґРµ СЃ РїР°РЅРµР»Рё РјРµРЅСЋ С†РµР»РёРєРѕРј) СЃР»РёС‚Р° РІ `setupDropdownCursorMarginWatcher()` С‡РµСЂРµР· РЅРѕРІС‹Р№ `isCursorNearMenuBar()` (margin-aware РїСЂРѕРІРµСЂРєР° РїРѕ rect `#menu-container`), СЃ РѕСЃС‚РѕСЂРѕР¶РЅРѕСЃС‚СЊСЋ РЅРµ РіР°СЃРёС‚СЊ РѕС‚РєСЂС‹С‚С‹Р№ dropdown, РµСЃР»Рё РєСѓСЂСЃРѕСЂ РІСЃС‘ РµС‰С‘ РІРЅСѓС‚СЂРё РµРіРѕ СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ margin (Р°РєС‚СѓР°Р»СЊРЅРѕ РґР»СЏ РІС‹СЃРѕРєРёС… dropdown, РІС‹С…РѕРґСЏС‰РёС… Р·Р° РїСЂРµРґРµР»С‹ rect РєРѕРЅС‚РµР№РЅРµСЂР°).

- Feature: MenuManager вЂ” generic disabled-СЃРѕСЃС‚РѕСЏРЅРёРµ РїСѓРЅРєС‚РѕРІ РјРµРЅСЋ (itemConfig.disabled: boolean | (editor) => boolean); `refreshDisabledStates()` РІС‹С‡РёСЃР»СЏРµС‚ state, РїСЂРёРјРµРЅСЏРµС‚ CSS-РєР»Р°СЃСЃС‹ opacity-50/pointer-events-none, СЂРµР°РєС‚РёРІРЅРѕ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РЅР° selectedFolders/activeAssetTabs (РґР»СЏ РґРёР·РµР№Р±Р»Р° "Add" РїСЂРё РєРѕСЂРЅРµРІРѕР№ РїР°РїРєРµ).
- Feature: MenuManager.createMenuItem() С‚РµРїРµСЂСЊ СЂРµРЅРґРµСЂРёС‚ РёРєРѕРЅРєСѓ (itemConfig.icon: HTML/SVG/СЌРјРѕРґР·Рё) РІ `<span class="menu-item-icon">`, СЂР°Р±РѕС‚Р°РµС‚ РґР»СЏ Р»СЋР±РѕРіРѕ РјРµРЅСЋ.
- Feature: BaseContextMenu РїРѕР»СѓС‡РёР»Р° generic flyout-submenu (addSubmenuItem, createSubmenuItem, findMenuItemById СЂРµРєСѓСЂСЃРёРІРЅС‹Р№ РїРѕРёСЃРє); AssetPanelContextMenu РґРѕР±Р°РІРёР»Р° "Add" вћ• flyout СЃ РєР°С‚РµРіРѕСЂРёСЏРјРё/С‚РёРїР°РјРё Р°СЃСЃРµС‚РѕРІ (РёР· AssetTypes РєР°С‚Р°Р»РѕРіР°, РёРєРѕРЅРєРё, РґРёР·РµР№Р±Р» РїСЂРё РєРѕСЂРЅРµРІРѕР№ РїР°РїРєРµ).
- Fix: РїСѓРЅРєС‚ РјРµРЅСЋ "Assets" РїРµСЂРµРёРјРµРЅРѕРІР°РЅ РІ "Add" (id РѕСЃС‚Р°Р»СЃСЏ `assets`), РёР· Р»РµР№Р±Р»РѕРІ РєРѕРјР°РЅРґ СѓР±СЂР°РЅ РїСЂРµС„РёРєСЃ "New" (`New Camera` в†’ `Camera`).
- Fix: `LevelEditor.createAssetOfType()`/`AssetManager.createPlaceholderAsset()` СЃРѕР·РґР°РІР°Р»Рё Р°СЃСЃРµС‚ РІ РѕС‚РґРµР»СЊРЅРѕР№ category-РїР°РїРєРµ (`Core/`, `Visual / Render/` Рё С‚.Рґ.) РІРјРµСЃС‚Рѕ С‚РµРєСѓС‰РµР№ РІС‹Р±СЂР°РЅРЅРѕР№ РїР°РїРєРё РІ Asset panel, Рё РЅРµ РїРѕРєР°Р·С‹РІР°Р»Рё СЃРѕРѕР±С‰РµРЅРёРµ РІ СЃС‚СЂРѕРєРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ. РўРµРїРµСЂСЊ `createAssetOfType()` Р±РµСЂС‘С‚ `assetPanel.getActiveTabPath()` Рё РїРµСЂРµРґР°С‘С‚ РєР°Рє `folderPath` РІ `createPlaceholderAsset(typeId, customName, folderPath)`; РґРѕР±Р°РІР»РµРЅС‹ `Logger.status.success/error`.

- Fix: submenu Assets-РјРµРЅСЋ (РєР°С‚РµРіРѕСЂРёСЏв†’С‚РёРї) СЂРµРЅРґРµСЂРёР»СЃСЏ РїРѕРІРµСЂС… СЂРѕРґРёС‚РµР»СЊСЃРєРѕРіРѕ dropdown РІРјРµСЃС‚Рѕ СЂР°СЃРєСЂС‹С‚РёСЏ СЃР±РѕРєСѓ вЂ” РЅРѕРІС‹Рµ Tailwind-РєР»Р°СЃСЃС‹ (`top-0`, `left-full`, `w-56`, `z-30`, `max-h-96`), РґРѕР±Р°РІР»РµРЅРЅС‹Рµ РІ `MenuManager.createSubmenuItem()`, РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»Рё РІ СЃС‚Р°С‚РёС‡РµСЃРєРѕРј `styles/tailwind.build.css` (С„Р°Р№Р» РЅРµ РїРµСЂРµСЃРѕР±РёСЂР°Р»СЃСЏ РїРѕСЃР»Рµ РїСЂР°РІРєРё). РџРµСЂРµСЃРѕР±СЂР°РЅ С‡РµСЂРµР· `npm run build:css`.
- Fix: `BaseDialog.hide()` РЅРµ СЃР±СЂР°СЃС‹РІР°Р» `contentRendered` вЂ” РїСЂРё РїРѕРІС‚РѕСЂРЅРѕРј `show()` РґР»СЏ РґСЂСѓРіРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё (РЅР°РїСЂ. `ActorPropertiesWindow.show(otherAsset)`) DOM-РєРѕРЅС‚РµРЅС‚ РЅРµ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°Р»СЃСЏ, РїРѕР»СЏ С„РѕСЂРјС‹ РѕСЃС‚Р°РІР°Р»РёСЃСЊ РѕС‚ РїСЂРµРґС‹РґСѓС‰РµРіРѕ Р°РєС‚РѕСЂР°, Apply РјРѕРі РїРµСЂРµР·Р°РїРёСЃР°С‚СЊ РґР°РЅРЅС‹Рµ РЅРµ С‚РѕРіРѕ Р°СЃСЃРµС‚Р°. Р”РѕР±Р°РІР»РµРЅ СЃР±СЂРѕСЃ `this.contentRendered = false` РІ `hide()`.
- Fix: `Asset.hasChangesFromOriginal()`/`saveOriginalState()` РЅРµ СѓС‡РёС‚С‹РІР°Р»Рё РїРѕР»Рµ `components` вЂ” СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РєРѕРјРїРѕРЅРµРЅС‚РѕРІ РІ `ActorPropertiesWindow` РЅРµ РІС‹СЃС‚Р°РІР»СЏР»Рѕ dirty-С„Р»Р°Рі Р°СЃСЃРµС‚Р°. Р”РѕР±Р°РІР»РµРЅРѕ СЃСЂР°РІРЅРµРЅРёРµ `componentsSignature`.
- Refactor: СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ `flattenMenuItems` (Р±С‹Р»Р° РЅРµР·Р°РІРёСЃРёРјР°СЏ РєРѕРїРёСЏ-closure РІ `MenuManager.setupMenuItemEvents()`) вЂ” С‚РµРїРµСЂСЊ РёРјРїРѕСЂС‚РёСЂСѓРµС‚СЃСЏ РёР· `config/menu.js` (С„СѓРЅРєС†РёСЏ СЌРєСЃРїРѕСЂС‚РёСЂРѕРІР°РЅР°).
- Feature: РєР°С‚Р°Р»РѕРіРё С‚РёРїРѕРІ Р°СЃСЃРµС‚РѕРІ Рё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ (`AssetTypes.js`, `ComponentTypes.js`) СЃ 29 РїСЂРµРґРѕРїСЂРµРґРµР»С‘РЅРЅС‹РјРё С‚РёРїР°РјРё Р°СЃСЃРµС‚РѕРІ (Camera, Actor, Image, Tilemap, Рё РґСЂ., СЂР°Р·Р±РёС‚С‹РјРё РЅР° РєР°С‚РµРіРѕСЂРёРё Core/Visual/Audio/Data/Navigation/Other) Рё 19 С‚РёРїР°РјРё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ (Collider, Trigger, Interactable, Рё РґСЂ.), РєРѕС‚РѕСЂС‹Рµ РїСЂРёРєСЂРµРїР»СЏСЋС‚СЃСЏ Рє GameObject РєР°Рє editor-side metadata-СЃС‚Р°Р±С‹. `Asset.components` Рё `GameObject.components` вЂ” РЅРѕРІС‹Рµ РїРѕР»СЏ, СЃРµСЂРёР°Р»РёР·СѓСЋС‚СЃСЏ РІ `toJSON()`, РєРѕРїРёСЂСѓСЋС‚СЃСЏ РІ СЌРєР·РµРјРїР»СЏСЂС‹ РїСЂРё СЂР°Р·РјРµС‰РµРЅРёРё. `AssetManager.createPlaceholderAsset(typeId)` вЂ” СЃРѕР·РґР°РЅРёРµ Р·Р°РїРѕР»РЅРёС‚РµР»СЏ Р°СЃСЃРµС‚Р° (Р±РµР· СЂРµР°Р»СЊРЅРѕРіРѕ РєРѕРЅС‚РµРЅС‚Р°, РєР°С‚РµРіРѕСЂРёСЏ-Р±Р°Р·РёСЂРѕРІР°РЅРЅС‹Р№ С†РІРµС‚, type-РёРєРѕРЅРєР° РІ РїСЂРµРІСЊСЋ). РќРѕРІРѕРµ РјРµРЅСЋ "Assets" РІ РіР»Р°РІРЅРѕР№ РїР°РЅРµР»Рё (РјРµР¶РґСѓ View Рё Settings) СЃ РёРµСЂР°СЂС…РёРµР№ РєР°С‚РµРіРѕСЂРёСЏв†’С‚РёРї, РєР°Р¶РґС‹Р№ РїСѓРЅРєС‚ РІС‹Р·С‹РІР°РµС‚ `LevelEditor.createAssetOfType(typeId)`. `ActorPropertiesWindow` (РґРёР°Р»РѕРі СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ Р°СЃСЃРµС‚Р°) РґРѕР±Р°РІР»РµРЅР° СЃРµРєС†РёСЏ "Components" вЂ” СЃРїРёСЃРѕРє РїСЂРёРєСЂРµРїР»С‘РЅРЅС‹С… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ СЃ СѓРґР°Р»РµРЅРёРµРј + РєРЅРѕРїРєР° "+ Add" (dropdown С‚РёРїРѕРІ + submit), СЂР°Р±РѕС‡Р°СЏ РєРѕРїРёСЏ РєРѕРјРїРѕРЅРµРЅС‚РѕРІ РІ РїР°РјСЏС‚Рё РґРѕ Apply. `MenuManager` Рё `AssetPanel` РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅС‹ РґР»СЏ СЂРµРЅРґРµСЂР° type-РёРєРѕРЅРѕРє (SVG, `AssetTypeIcons.js`) РІРјРµСЃС‚Рѕ С†РІРµС‚РЅС‹С… СЃРІРѕС‚С‡РµР№+Р±СѓРєРІ Сѓ РєР°С‚Р°Р»РѕРіР°-С‚РёРїРѕРІ Р°СЃСЃРµС‚РѕРІ.

- Feature: BaseContextMenu вЂ” РµРґРёРЅР°СЏ РІРёР·СѓР°Р»СЊРЅР°СЏ СЃС…РµРјР° РґР»СЏ РІСЃРµС… РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ. `createMenuItem()`/`createSubmenuItem()` С‚РµРїРµСЂСЊ СЂРµРЅРґРµСЂСЏС‚ РёРєРѕРЅРєСѓ РєР°Рє DOM-child `<span class="menu-item-icon">` (РЅРµ РєРѕРЅРєР°С‚РµРЅР°С†РёСЏ РІ innerHTML) Рё РїСЂРёРјРµРЅСЏСЋС‚ РїРѕР»РЅС‹Р№ disabled-scheme (opacity-50/pointer-events-none/cursor-not-allowed + dataset.menuDisabled) вЂ” РёРґРµРЅС‚РёС‡РЅРѕ MenuManager (РѕСЃРЅРѕРІРЅРѕРµ РјРµРЅСЋ). Р’СЃРµ 6 РЅР°СЃР»РµРґРЅРёРєРѕРІ (AssetContextMenu, AssetPanelContextMenu, CanvasContextMenu, ConsoleContextMenu, LayersContextMenu, OutlinerContextMenu) РїРѕР»СѓС‡РёР»Рё РµРґРёРЅС‹Р№ С€Р°Р±Р»РѕРЅ.
- Fix: РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ вЂ” РєР»РёРїРїРёРЅРі РІР»РѕР¶РµРЅРЅС‹С… flyout-РїРѕРґРјРµРЅСЋ. `.submenu-flyout` Р±РѕР»СЊС€Рµ РЅРµ СЃС‚Р°РІРёС‚ `overflow-y:auto; max-height:320px` Р±РµР·СѓСЃР»РѕРІРЅРѕ; РЅРѕРІС‹Р№ РјРѕРґРёС„РёРєР°С‚РѕСЂ-РєР»Р°СЃСЃ `.submenu-flyout--scrollable`, РїСЂРёРјРµРЅСЏРµС‚СЃСЏ РўРћР›Р¬РљРћ Рє СЃР°РјРѕРјСѓ РіР»СѓР±РѕРєРѕРјСѓ С„Р»Р°Р№Р°СѓС‚Сѓ РІ С†РµРїРѕС‡РєРµ (Сѓ РєРѕС‚РѕСЂРѕРіРѕ РЅРµС‚ РІР»РѕР¶РµРЅРЅС‹С… submenu-РґРµС‚РµР№). РџРѕР·РІРѕР»РёР»Рѕ СЂР°СЃРєСЂС‹С‚СЊ С‚СЂРµС‚РёР№ СѓСЂРѕРІРµРЅСЊ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё РІ РџРљРњ-РјРµРЅСЋ Assets panel: Add в†’ РєР°С‚РµРіРѕСЂРёСЏ в†’ С‚РёРї Р°СЃСЃРµС‚Р°.

- Refactor: РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° `src/utils/MenuItemTemplateUtils.js` СЌРєСЃРїРѕСЂС‚РёСЂСѓРµС‚ `renderMenuItemIconHtml(icon)` вЂ” РѕРґРёРЅРѕС‡РЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РїСЂР°РІРґС‹ СЂР°Р·РјРµС‚РєРё РёРєРѕРЅРєРё РјРµРЅСЋ-РїСѓРЅРєС‚Р° (`<span class="menu-item-icon" style="width:18px;height:18px;margin-right:8px">...</span>`, 18Г—18 flex box). РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `MenuManager.createMenuItem()` Рё `BaseContextMenu.createMenuItem()/createSubmenuItem()` РґР»СЏ СѓСЃС‚СЂР°РЅРµРЅРёСЏ С‚СЂС‘С… РґСѓР±Р»РёСЂСѓСЋС‰РёС…СЃСЏ inline-С€Р°Р±Р»РѕРЅРѕРІ Рё РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РІРёР·СѓР°Р»СЊРЅРѕРіРѕ РґСЂРµР№С„Р° РјРµР¶РґСѓ dropdown-РјРµРЅСЋ nav-bar'Р° Рё floating РєРѕРЅС‚РµРєСЃС‚РЅС‹РјРё РјРµРЅСЋ (CanvasContextMenu, AssetPanelContextMenu Рё РґСЂ.).
- Fix: BaseContextMenu С‚РµРїРµСЂСЊ РїСЂРёРјРµРЅСЏРµС‚ С‚РѕС‡РЅС‹Р№ Р¶Рµ Tailwind-РєР»Р°СЃСЃ С€Р°Р±Р»РѕРЅ, С‡С‚Рѕ MenuManager: item-rows `'base-context-menu-item px-4 py-2 text-sm hover:bg-gray-700'` (РІРјРµСЃС‚Рѕ СЂСѓС‡РЅРѕРіРѕ padding/font-size/hover-С†РІРµС‚Р°), separators `'border-t border-gray-600 my-1'` (РІРјРµСЃС‚Рѕ gradient-line CSS), submenu-С‚СЂРёРіРіРµСЂС‹ `'px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between'` СЃ СЏРІРЅС‹Рј `<span class="text-xs ml-4">в–ё</span>`-РіР»С–С„РѕРј (Р·Р°РјРµРЅСЏРµС‚ CSS `::after` pseudo-element). `styles/base-context-menu.css` СѓРїСЂРѕС‰РµРЅ: СѓРґР°Р»РµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµ padding/font-size/gap/hover-background (С‚РµРїРµСЂСЊ С‡РµСЂРµР· utilities), СЃРѕС…СЂР°РЅРµРЅС‹ С‚РѕР»СЊРєРѕ color-var, cursor, flex/align-items, transitions, disabled/active-states, first/last-child radius.
- Fix: `BaseContextMenu.setupMenuClosing()` вЂ” С„РёРєСЃ margin'Р° РІРѕРєСЂСѓРі РєСѓСЂСЃРѕСЂР°. Р Р°РЅСЊС€Рµ РјРµРЅСЋ РїРѕР»СѓС‡Р°Р»Рѕ immunity-Р·РѕРЅСѓ РІРѕРєСЂСѓРі РєСѓСЂСЃРѕСЂР° РўРћР›Р¬РљРћ РІ С‚РµС‡РµРЅРёРµ ~150вЂ“200РјСЃ opening animation (С‡РµСЂРµР· `requestAnimationFrame` polling), РїРѕСЃР»Рµ С‡РµРіРѕ СЃСЂР°Р±Р°С‚С‹РІР°Р» `mouseleave` Рё РјРµРЅСЋ Р·Р°РєСЂС‹РІР°Р»РѕСЃСЊ РїСЂРё РјР°Р»РµР№С€РµРј РґРІРёР¶РµРЅРёРё, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ `ui.cursorMenuMargin`. РўРµРїРµСЂСЊ `setupMenuClosing()` СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ persistent `document` `mousemove`-Р»РёСЃС‚РµРЅРµСЂ РЅР° Р’РЎР® Р¶РёР·РЅСЊ РјРµРЅСЋ, РІС‹Р·С‹РІР°СЏ submenu-aware `isCursorInsideMenu(menu)` (true РµСЃР»Рё РєСѓСЂСЃРѕСЂ РІ РїСЂРµРґРµР»Р°С… `getCursorMenuMargin()` px РѕС‚ СЃР°РјРѕРіРѕ РјРµРЅСЋ OR Р»СЋР±РѕРіРѕ РѕС‚РєСЂС‹С‚РѕРіРѕ `.submenu-flyout.show` РїРѕС‚РѕРјРєР° РЅР° Р»СЋР±РѕР№ РіР»СѓР±РёРЅРµ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё). Р›РёСЃС‚РµРЅРµСЂ СѓРґР°Р»СЏРµС‚СЃСЏ РјРµС‚РѕРґРѕРј `removeMenuCloseWatcher()` (РІС‹Р·РѕРІ РёР· `hideMenu()` Рё РёР· early-replace-РїСѓС‚Рё РІ `showContextMenu()`), РёР·Р±РµРіР°СЏ СѓС‚РµС‡РµРє `document`-level РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ.
- Feature: РґРёРЅР°РјРёС‡РµСЃРєР°СЏ РЅР°СЃС‚СЂРѕР№РєР° `ui.cursorMenuMargin` (РґРµС„РѕР»С‚ 6px, РґРёР°РїР°Р·РѕРЅ 0-60) вЂ” СѓРїСЂР°РІР»СЏРµС‚ "РЅРµРІРёРґРёРјРѕР№ Р·РѕРЅРѕР№" РІРѕРєСЂСѓРі РѕС‚РєСЂС‹С‚РѕРіРѕ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ, РІ РєРѕС‚РѕСЂРѕР№ РєСѓСЂСЃРѕСЂ РЅРµ С‚СЂРёРіРіРµСЂРёС‚ Р·Р°РєСЂС‹С‚РёРµ. Р—Р°РјРµРЅСЏРµС‚ Р·Р°С…Р°СЂРґРєРѕР¶РµРЅРЅСѓСЋ РєРѕРЅСЃС‚Р°РЅС‚Сѓ `BaseContextMenu.CURSOR_MENU_MARGIN` (С‚Р° РѕСЃС‚Р°С‘С‚СЃСЏ РєР°Рє fallback-Р·РЅР°С‡РµРЅРёРµ). Р”РѕСЃС‚СѓРїРЅР° РІ Settings в†’ General в†’ UI Settings, СЃР»Р°Р№РґРµСЂ "Context Menu Cursor Margin (px)". РҐСЂР°РЅРёС‚СЃСЏ РІ `config/defaults/ui.json`, СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· `SettingsSyncManager`, С‡РёС‚Р°РµС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё РјРµС‚РѕРґРѕРј `BaseContextMenu.getCursorMenuMargin()`.

- Fix: РјРѕСЂРіР°РЅРёРµ РѕР±СЉРµРєС‚РѕРІ РЅР° Alt+G (Рё РІРѕРѕР±С‰Рµ РІРµР·РґРµ, РіРґРµ РІС‹Р·С‹РІР°Р»СЃСЏ `RenderOperations.clearVisibleObjectsCacheForCurrentCamera()` вЂ” delete/group/ungroup/duplicate/visibility-toggle) РїРµСЂРµР¶РёР»Рѕ РїСЂРµРґС‹РґСѓС‰РёР№ С„РёРєСЃ РёР·-Р·Р° РґРІСѓС… РЅРµР·Р°РІРёСЃРёРјС‹С… Р±Р°РіРѕРІ РІ СЃР°РјРѕРј РјРµС‚РѕРґРµ. (1) `clearVisibleObjectsCacheForCurrentCamera()`/`clearVisibleObjectsCacheForCamera()` СЃС‚СЂРѕРёР»Рё РєР»СЋС‡ РєСЌС€Р° РєР°Рє `x,y,zoom`, Р° `getVisibleObjects()` РїСЂРё Р·Р°РїРѕР»РЅРµРЅРёРё РІСЃРµРіРґР° РґРѕР±Р°РІР»СЏРµС‚ СЃСѓС„С„РёРєСЃ parallax (`_off` РёР»Рё `_x,y`) вЂ” РєР»СЋС‡Рё РЅРёРєРѕРіРґР° РЅРµ СЃРѕРІРїР°РґР°Р»Рё, `.delete()` Р±С‹Р» РїРѕСЃС‚РѕСЏРЅРЅС‹Рј no-op, С‚РѕС‡РµС‡РЅР°СЏ РёРЅРІР°Р»РёРґР°С†РёСЏ РЅРµ СЂР°Р±РѕС‚Р°Р»Р° РІРѕРѕР±С‰Рµ (С‚РѕР»СЊРєРѕ РїРѕР»РЅС‹Р№ `clearVisibleObjectsCache()` РёР»Рё TTL `CACHE_TIMEOUT_MS`=100РјСЃ). (2) `clearVisibleObjectsCacheForCurrentCamera()` РЅР°С‡РёРЅР°Р»СЃСЏ СЃ `if (!this.lastCameraState) return;`, Р° `lastCameraState` РЅРёРіРґРµ РІ РєРѕРґРµ РЅРµ СѓСЃС‚Р°РЅР°РІР»РёРІР°Р»СЃСЏ (С‚РѕР»СЊРєРѕ `null` РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂРµ) вЂ” guard РІСЃРµРіРґР° РѕР±СЂС‹РІР°Р» РјРµС‚РѕРґ СЂР°РЅСЊС€Рµ, С‡РµРј РґРѕС…РѕРґРёР»Рѕ РґРѕ СЃР°РјРѕРіРѕ delete. Р¤РёРєСЃ: РІС‹РЅРµСЃРµРЅ РѕР±С‰РёР№ `RenderOperations._buildVisibleObjectsCacheKey(camera)`, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё РїСЂРё Р·Р°РїРёСЃРё, Рё РїСЂРё РѕР±РѕРёС… clear-РјРµС‚РѕРґР°С…; РјС‘СЂС‚РІС‹Р№ guard Рё РїРѕР»Рµ `lastCameraState` СѓРґР°Р»РµРЅС‹.
- Fix: РЅР°СЃС‚СЂРѕР№РєРё, РёР·РјРµРЅС‘РЅРЅС‹Рµ РїСЂРё РІРєР»СЋС‡С‘РЅРЅРѕРј "Apply changes automatically" (РґРµС„РѕР»С‚), С‚РµСЂСЏР»РёСЃСЊ РїСЂРё РїРµСЂРµРѕС‚РєСЂС‹С‚РёРё РѕРєРЅР° вЂ” `SettingsSyncManager.syncSettingToState()` РїРёСЃР°Р» Р·РЅР°С‡РµРЅРёРµ С‚РѕР»СЊРєРѕ РІ `StateManager`, Р° `configManager.set()` РЅРµ РІС‹Р·С‹РІР°Р»СЃСЏ (РєРЅРѕРїРєР° "Apply Changes", РєРѕС‚РѕСЂР°СЏ СЂР°РЅСЊС€Рµ СЌС‚Рѕ РґРµР»Р°Р»Р°, РІ auto-apply СЂРµР¶РёРјРµ РЅР°РјРµСЂРµРЅРЅРѕ Р·Р°РґРёР·РµР№Р±Р»РµРЅР°). Р”РѕР±Р°РІР»РµРЅ write-through: `syncSettingToState()` С‚РµРїРµСЂСЊ СЃСЂР°Р·Сѓ РїРёС€РµС‚ Рё РІ `ConfigManager`.
- Fix: РјРѕСЂРіР°РЅРёРµ РґРµС‚РµР№ РіСЂСѓРїРїС‹ РїСЂРё ungroup РїРѕ С…РѕС‚РєРµСЋ Alt+G (РІ РѕС‚Р»РёС‡РёРµ РѕС‚ toolbar/РџРљРњ). РќР°Р№РґРµРЅРѕ 4 РЅРµР·Р°РІРёСЃРёРјС‹С… РёСЃС‚РѕС‡РЅРёРєР°. (1) `EventHandlers.js` С…РѕС‚РєРµРё group/ungroup РІС‹Р·С‹РІР°Р»Рё `groupOperations.groupSelectedObjects()/ungroupSelectedObjects()` РЅР°РїСЂСЏРјСѓСЋ, РјРёРЅСѓСЏ РѕР±С‘СЂС‚РєСѓ `LevelEditor.groupSelectedObjects()/ungroupSelectedObjects()` вЂ” С‚РµРїРµСЂСЊ РѕР±Р° С…РѕС‚РєРµСЏ РІС‹Р·С‹РІР°СЋС‚ РјРµС‚РѕРґС‹ `LevelEditor`, РєР°Рє toolbar Рё context-menu. (2) `EventHandlers.handleKeyDown()` РЅРµ РїСЂРѕРІРµСЂСЏР» `e.repeat` вЂ” РїСЂРё СѓРґРµСЂР¶Р°РЅРёРё Alt+G РћРЎ РіРµРЅРµСЂРёСЂСѓРµС‚ РїРѕРІС‚РѕСЂРЅС‹Рµ `keydown`, РєР°Р¶РґС‹Р№ РІС‹Р·С‹РІР°Р» `ungroupSelectedObjects()` Р·Р°РЅРѕРІРѕ; РґРѕР±Р°РІР»РµРЅ СЂР°РЅРЅРёР№ `if (e.repeat) return;`. (3) **РљР»СЋС‡РµРІР°СЏ РЅР°С…РѕРґРєР°**: `RenderOperations.clearEffectiveLayerCache()`/`clearEffectiveLayerCacheForObject()` РѕР±СЂР°С‰Р°Р»РёСЃСЊ Рє РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРјСѓ `this.editor.effectiveLayerCache` (СЂРµР°Р»СЊРЅС‹Р№ РєСЌС€ Р»РµР¶РёС‚ РІ `this.editor.cacheManager.effectiveLayerCache`) вЂ” РѕР±Р° РјРµС‚РѕРґР° Р±С‹Р»Рё РїРѕСЃС‚РѕСЏРЅРЅС‹Рј no-op РІРѕ РІСЃРµС… РІС‹Р·РѕРІР°С… РїРѕ РєРѕРґРѕРІРѕР№ Р±Р°Р·Рµ (GroupOperations, MouseHandlers, DuplicateOperations, Group.js); РёСЃРїСЂР°РІР»РµРЅРѕ РЅР° `this.editor.cacheManager.effectiveLayerCache`. (4) `LevelEditor.ungroupSelectedObjects()` С‡РёС‚Р°Р» `obj.children` **РїРѕСЃР»Рµ** РІС‹Р·РѕРІР° `groupOperations.ungroupSelectedObjects()`, Р° С‚РѕС‚ СѓР¶Рµ РІС‹С‡РёС‰Р°РµС‚ `group.children` РїРѕ РѕРґРЅРѕРјСѓ С‡РµСЂРµР· `extractObjectFromGroup`'s filter вЂ” С†РёРєР» РёРЅРІР°Р»РёРґР°С†РёРё РґРµС‚СЃРєРѕРіРѕ РєСЌС€Р° РІСЃРµРіРґР° РїСЂРѕС…РѕРґРёР» РїРѕ РїСѓСЃС‚РѕРјСѓ РјР°СЃСЃРёРІСѓ; С‚РµРїРµСЂСЊ id РґРµС‚РµР№ СЃРЅРёРјР°СЋС‚СЃСЏ СЃРЅРёРјРєРѕРј РґРѕ РІС‹Р·РѕРІР°. Р’РјРµСЃС‚Рµ (3)+(4) РѕР·РЅР°С‡Р°Р»Рё, С‡С‚Рѕ `effectiveLayerCache`/`topLevelObjectCache` РґР»СЏ С‚РѕР»СЊРєРѕ С‡С‚Рѕ СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІР°РЅРЅС‹С… РґРµС‚РµР№ РѕСЃС‚Р°РІР°Р»СЃСЏ РїСЂРѕС‚СѓС…С€РёРј РґРѕ РѕС‚Р»РѕР¶РµРЅРЅРѕРіРѕ `scheduleCacheInvalidation()` (100РјСЃ) РїСЂРё Р»СЋР±РѕРј СЃРїРѕСЃРѕР±Рµ ungroup вЂ” РЅРѕ РёРјРµРЅРЅРѕ РЅР°Р¶Р°С‚РёРµ Alt (РјРѕРґРёС„РёРєР°С‚РѕСЂ С…РѕС‚РєРµСЏ) СЃР°РјРѕ РїРѕ СЃРµР±Рµ С‚СЂРёРіРіРµСЂРёС‚ Р»РёС€РЅРёР№ СЂРµРЅРґРµСЂ-С‚РёРє С‡РµСЂРµР· `stateManager.update('keyboard.altKey', ...)`, РєРѕС‚РѕСЂС‹Р№ С‡Р°С‰Рµ РїРѕРїР°РґР°РµС‚ РІ СЌС‚Рѕ РѕРєРЅРѕ РїСЂРѕС‚СѓС…Р°РЅРёСЏ, С‡РµРј РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ СЃРёРЅС…СЂРѕРЅРЅС‹Р№ СЂРµРЅРґРµСЂ РѕС‚ РєР»РёРєР° РїРѕ toolbar/РџРљРњ.
- Feature: РїР°СЂР°Р»Р»Р°РєСЃ-РјРЅРѕР¶РёС‚РµР»Рё СѓСЂРѕРІРЅСЏ (Parallax H/V) вЂ” `Level.settings` РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚ `parallaxHorizontal` Рё `parallaxVertical` (РѕР±Р° РґРµС„РѕР»С‚ 1, СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ СЃ СѓСЂРѕРІРЅРµРј РІ JSON); DetailsPanel-СЃРµРєС†РёСЏ "Camera" (Р±С‹Р»Р° "Actions") РґРѕР±Р°РІР»СЏРµС‚ РѕРґРЅРѕСЃС‚СЂРѕС‡РЅС‹Р№ РёРЅРїСѓС‚-СЂСЏРґ "Parallax H/V" РґР»СЏ РЅР°СЃС‚СЂРѕР№РєРё; `ParallaxRenderer.getCameraOffset()` РїСЂРёРјРµРЅСЏРµС‚ РјРЅРѕР¶РёС‚РµР»Рё Рє СЃРјРµС‰РµРЅРёСЋ РєР°РјРµСЂС‹ РЅРµР·Р°РІРёСЃРёРјРѕ РїРѕ РѕСЃСЏРј (РїРѕРјРёРјРѕ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ per-layer Р»РѕРіРёРєРё РІ `getParallaxOffset`). **UI РєРѕРјРїР°РєС‚РЅРѕСЃС‚СЊ**: DetailsPanel РїСЂРµРѕР±СЂР°Р·РѕРІР°РЅР° РЅР° РѕРґРЅРѕСЃС‚СЂРѕС‡РЅС‹Р№ flex-Р»РµР№Р°СѓС‚ (label 40% СЃРїСЂР°РІР° + РєРѕРЅС‚СЂРѕР»С‹ РІ РѕСЃС‚Р°С‚РєРµ), РЅРѕРІС‹Р№ С…РµР»РїРµСЂ `DetailsPanel.createDualFieldRow(label, fields)` РґР»СЏ СЂСЏРґРѕРІ СЃ РЅРµСЃРєРѕР»СЊРєРёРјРё РёРЅРїСѓС‚Р°РјРё; `UIFactory.createLabeledInput()` РїРµСЂРµРІРµРґС‘РЅ СЃ label-above РЅР° flex-row (label flex 0 0 40% + input flex 1), РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє Basic Properties (Name/Type) Рё Visual (Color).
- Fix: РѕР±СЂРµР·Р°РЅРёРµ РґР»РёРЅРЅС‹С… РёРјС‘РЅ РїР°РїРѕРє РІ Content-Р±СЂР°СѓР·РµСЂРµ РїРµСЂРµРЅРѕСЃРёР»Рѕ С‚РµРєСЃС‚ РЅР° РІС‚РѕСЂСѓСЋ СЃС‚СЂРѕРєСѓ РІРјРµСЃС‚Рѕ ellipsis вЂ” РїСЂРёС‡РёРЅР° РІ РЅРµР·Р°РєСЂС‹С‚РѕРј С‚РµРі `<div class="folder-item">` (`FoldersPanel.js` `renderFolder`), РёР·-Р·Р° С‡РµРіРѕ Р±СЂР°СѓР·РµСЂ СЃСЉРµРґР°Р» РІР»РѕР¶РµРЅРЅС‹Р№ flex-wrapper РєР°Рє Р±РёС‚С‹Рµ Р°С‚СЂРёР±СѓС‚С‹ Рё СЂРµРЅРґРµСЂРёР» spans Р±Р»РѕС‡РЅРѕ Р±РµР· flex. Р—Р°РѕРґРЅРѕ СѓР±СЂР°РЅ РґСѓР±Р»РёСЂСѓСЋС‰РёР№ JS-Р°Р»РіРѕСЂРёС‚Рј РѕР±СЂРµР·Р°РЅРёСЏ С‚РµРєСЃС‚Р° (`truncateName` СЃ canvas measureText + ResizeObserver) вЂ” РёСЃРїРѕР»СЊР·РѕРІР°РЅ С‚РѕС‚ Р¶Рµ CSS-РїР°С‚С‚РµСЂРЅ (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`), С‡С‚Рѕ Рё РІ OutlinerPanel; Р°РЅР°Р»РѕРіРёС‡РЅС‹Р№ СЂРµРґСѓРЅРґР°РЅС‚РЅС‹Р№ `AssetPanel.truncateAssetName` С‚РѕР¶Рµ СѓРґР°Р»С‘РЅ (CSS `truncate`/inline-ellipsis СѓР¶Рµ РїРѕРєСЂС‹РІР°Р»Рё РѕР±СЂРµР·Р°РЅРёРµ). `.layer-name-display` (LayersPanel) РїРѕР»СѓС‡РёР» С‚РѕС‚ Р¶Рµ CSS-РїР°С‚С‚РµСЂРЅ РїСЂРѕР°РєС‚РёРІРЅРѕ вЂ” С‚РѕС‚ Р¶Рµ РєР»Р°СЃСЃ Р±Р°РіР° РјРѕРі РїСЂРѕСЏРІРёС‚СЊСЃСЏ С‚Р°Рј Р¶Рµ.
- Fix: paste/duplicate placement (`DuplicateOperations.startFromObjects`) С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ РїРѕР·РёС†РёСЋ РєСѓСЂСЃРѕСЂР° С‚РѕР»СЊРєРѕ РєРѕРіРґР° РѕРЅ СЂРµР°Р»СЊРЅРѕ РЅР°Рґ РєР°РЅРІРѕР№ (`mouse.isOverCanvas`, РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РІ `MouseHandlers._handleGlobalMouseMoveImpl` С‡РµСЂРµР· `canvas.getBoundingClientRect()`), РёРЅР°С‡Рµ fallback РЅР° С†РµРЅС‚СЂ РєР°РЅРІС‹. Р Р°РЅСЊС€Рµ РёСЃРїРѕР»СЊР·РѕРІР°Р»Р°СЃСЊ СѓСЃС‚Р°СЂРµРІС€Р°СЏ `mouse.worldX/worldY` РґР°Р¶Рµ РµСЃР»Рё РєСѓСЂСЃРѕСЂ СѓС€С‘Р» РЅР° РїР°РЅРµР»СЊ/РґРёР°Р»РѕРі, РёР·-Р·Р° С‡РµРіРѕ РѕР±СЉРµРєС‚С‹ РІСЃС‚Р°РІР»СЏР»РёСЃСЊ РІРЅРµ РІРёРґРёРјРѕСЃС‚Рё.
- Feature: РїСЂРё РІСЃС‚Р°РІРєРµ/РґСѓР±Р»РёСЂРѕРІР°РЅРёРё РЅРµСЃРєРѕР»СЊРєРёС… РѕР±СЉРµРєС‚РѕРІ РѕРЅРё С‚РµРїРµСЂСЊ СЂР°Р·РјРµС‰Р°СЋС‚СЃСЏ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј РєР°Рє РµРґРёРЅР°СЏ РіСЂСѓРїРїР°, С†РµРЅС‚СЂРёСЂРѕРІР°РЅРЅР°СЏ РїРѕ union bounding-box РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ (`anchorCenter` = С†РµРЅС‚СЂ РѕР±СЉРµРґРёРЅС‘РЅРЅС‹С… РјРёСЂРѕРІС‹С… bounds С‡РµСЂРµР· `getObjectWorldBounds`), РІРјРµСЃС‚Рѕ С‚РѕРіРѕ С‡С‚РѕР±С‹ РѕСЃС‚Р°С‚СЊСЃСЏ РЅР° РјРµСЃС‚Рµ РѕСЂРёРіРёРЅР°Р»Р°. `LevelEditor.pasteObjects()` С‚РµРїРµСЂСЊ РїСЂРѕРІРµСЂСЏРµС‚ `mouse.isOverCanvas` Рё РЅРµ Р·Р°РїСѓСЃРєР°РµС‚ РІСЃС‚Р°РІРєСѓ РІРЅРµ РєР°РЅРІС‹ (no-op СЃ warning РІ Р»РѕРі).
- Fix: СЂРµРіСЂРµСЃСЃРёСЏ РѕС‚ bbox-С†РµРЅС‚СЂРёСЂРѕРІР°РЅРёСЏ РІС‹С€Рµ вЂ” Alt+drag РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ (`DuplicateOperations.startFromObjects`) С‚РѕР¶Рµ С†РµРЅС‚СЂРёСЂРѕРІР°Р»РѕСЃСЊ РїРѕ bounding box, РёР·-Р·Р° С‡РµРіРѕ РїСЂРµРІСЊСЋ РїСЂС‹РіР°Р»Рѕ РїРѕРґ РєСѓСЂСЃРѕСЂ РІРјРµСЃС‚Рѕ С‚РѕРіРѕ С‡С‚РѕР±С‹ РѕСЃС‚Р°С‚СЊСЃСЏ РІ С‚РѕС‡РєРµ Р·Р°С…РІР°С‚Р°. РўРµРїРµСЂСЊ РїСЂРё `isAltDragMode` Р°РЅРєРѕСЂ РѕС„СЃРµС‚РѕРІ вЂ” СЃР°РјР° РїРѕР·РёС†РёСЏ РєСѓСЂСЃРѕСЂР° (РєР°Рє РїСЂРё РѕР±С‹С‡РЅРѕРј drag), bbox-С†РµРЅС‚СЂРёСЂРѕРІР°РЅРёРµ РѕСЃС‚Р°Р»РѕСЃСЊ С‚РѕР»СЊРєРѕ РґР»СЏ paste/Ctrl+D.
- Fix: РїСЂРё Alt+click РєРѕРїРёСЂРѕРІР°РЅРёРё РёС‚РѕРіРѕРІР°СЏ РїРѕР·РёС†РёСЏ РєРѕРїРёРё СЃРјРµС‰Р°Р»Р°СЃСЊ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РїСЂРµРІСЊСЋ вЂ” `startFromObjects` Р°РЅРєРѕСЂРёР» РїСЂРµРІСЊСЋ РЅР° `mouse.worldX/worldY` РёР· state, РєРѕС‚РѕСЂР°СЏ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ throttled-РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРј mousemove Рё РЅР° РјРѕРјРµРЅС‚ РєР»РёРєР° РјРѕРіР»Р° РѕС‚СЃС‚Р°РІР°С‚СЊ РѕС‚ СЂРµР°Р»СЊРЅРѕР№ С‚РѕС‡РєРё, С‚РѕРіРґР° РєР°Рє `confirmPlacement` РЅР° mouseup РІСЃРµРіРґР° Р±РµСЂС‘С‚ СЃРІРµР¶РёР№ `screenToWorld` РѕС‚ СЃРѕР±С‹С‚РёСЏ. `startFromSelection`/`startFromObjects` С‚РµРїРµСЂСЊ РїСЂРёРЅРёРјР°СЋС‚ РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Р№ `worldPosOverride`; `MouseHandlers.handleObjectClick`/`_handleMouseMoveImpl` РїРµСЂРµРґР°СЋС‚ С‚СѓРґР° СѓР¶Рµ РІС‹С‡РёСЃР»РµРЅРЅС‹Р№ РЅР° СЌС‚РѕС‚ Р¶Рµ РёРІРµРЅС‚ `worldPos` РІРјРµСЃС‚Рѕ С‡С‚РµРЅРёСЏ РёР· state.
- Fix: Р°СЃСЃРµС‚С‹ С‚РёРїРѕРІ СЃ `/` РІ Р»РµР№Р±Р»Рµ (Font/Text Style, Material/Shader Preset, Quest/Objective, Save Schema, Path/Spline, NavMesh, Prefab, Sequence/Cutscene) С‡РµСЂРµР· "Add" РЅРµ РїРѕСЏРІР»СЏР»РёСЃСЊ РІ Asset panel вЂ” `AssetManager.createPlaceholderAsset()` СЃС‚СЂРѕРёР» `name` РёР· `typeDef.label` Р±РµР· СЃР°РЅРёС‚Р°Р№Р·РёРЅРіР°, `/` РІ РёРјРµРЅРё СЃРѕР·РґР°РІР°Р» Р»РёС€РЅРёР№ СѓСЂРѕРІРµРЅСЊ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё РїР°РїРѕРє РїСЂРё СЂР°Р·Р±РѕСЂРµ `asset.path` РІ `FoldersPanel.addAssetsToStructure()`. Р”РѕР±Р°РІР»РµРЅ `safeName = name.replace(/\//g, '-')` РґР»СЏ РїСѓС‚Рё, `name`/label РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РЅРµ С‚СЂРѕРЅСѓС‚С‹.
- РЈРґР°Р»С‘РЅ С‚РёРї Р°СЃСЃРµС‚Р° "Parallax Layer / Background" (`parallaxLayer`) РёР· РєР°С‚Р°Р»РѕРіР° вЂ” РёР· `AssetTypes.js`/`AssetTypeIcons.js`.

### Feature вЂ” РЅР°С‚РёРІРЅРѕРµ splash-РѕРєРЅРѕ РїСЂРё СЃС‚Р°СЂС‚Рµ (`start_Editor.bat` + `scripts/splash_screen.ps1`)

- Р§С‚РѕР±С‹ Р·Р°РєСЂС‹С‚СЊ СЂР°Р·СЂС‹РІ РјРµР¶РґСѓ РґРІРѕР№РЅС‹Рј РєР»РёРєРѕРј Рё РїРѕСЏРІР»РµРЅРёРµРј РѕРєРЅР° Р±СЂР°СѓР·РµСЂР° (Р·Р°РїСѓСЃРє СЃРµСЂРІРµСЂР°/РїРѕРёСЃРє РїРѕСЂС‚Р°), `start_Editor.bat` РІ РЅР°С‡Р°Р»Рµ `:main` Р·Р°РїСѓСЃРєР°РµС‚ `scripts/splash_screen.ps1` вЂ” PowerShell/WinForms borderless `TopMost`-РѕРєРЅРѕ (РѕС‚РґРµР»СЊРЅРѕРµ СЃРёСЃС‚РµРјРЅРѕРµ РѕРєРЅРѕ, РЅРµ HTML/РЅРµ РІСЃС‚СЂРѕРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ). Р”РёР·Р°Р№РЅ РѕРєРЅР° (РєР°СЂС‚РёРЅРєР° `HAPLO_editor_SplashScreen_v3-54.png`, Р·Р°РіРѕР»РѕРІРѕРє "HAPLO EDITOR 2D is now loading...", СЃС‚СЂРѕРєР° СЃС‚Р°С‚СѓСЃР° РЅР° РІСЃСЋ С€РёСЂРёРЅСѓ РІРЅРёР·Сѓ) РїСЂР°РІРёС‚СЃСЏ РїСЂСЏРјРѕ РІ `scripts/splash_screen.ps1` вЂ” С„Р°Р№Р» Р±РѕР»СЊС€Рµ РЅРµ РіРµРЅРµСЂРёСЂСѓРµС‚СЃСЏ РЅР° Р»РµС‚Сѓ РїРѕСЃС‚СЂРѕС‡РЅС‹Рј `echo` РІ `.bat`.
- Р–РёРІРѕР№ СЃС‚Р°С‚СѓСЃ РїСЂРѕС†РµСЃСЃР° Р·Р°РїСѓСЃРєР°: `start_Editor.bat` РїРёС€РµС‚ РєРѕСЂРѕС‚РєРёРµ СЃРѕРѕР±С‰РµРЅРёСЏ Рѕ С‚РµРєСѓС‰РµРј С€Р°РіРµ (РїСЂРѕРІРµСЂРєР° РїРѕСЂС‚Р°, Р·Р°РїСѓСЃРє Python/Node СЃРµСЂРІРµСЂР°, РѕР¶РёРґР°РЅРёРµ РіРѕС‚РѕРІРЅРѕСЃС‚Рё, РѕРїСЂРµРґРµР»РµРЅРёРµ Р±СЂР°СѓР·РµСЂР°, РѕС‚РєСЂС‹С‚РёРµ Р±СЂР°СѓР·РµСЂР°) С‡РµСЂРµР· РїРѕРґРїСЂРѕРіСЂР°РјРјСѓ `:splashstatus` РІ С„Р°Р№Р» `%TEMP%\haplo_splash_status_*.txt`; `splash_screen.ps1` РѕРїСЂР°С€РёРІР°РµС‚ СЌС‚РѕС‚ С„Р°Р№Р» С‚Р°Р№РјРµСЂРѕРј (200РјСЃ) Рё РѕР±РЅРѕРІР»СЏРµС‚ РЅРёР¶РЅСЋСЋ СЃС‚СЂРѕРєСѓ РѕРєРЅР°.
- PID РїСЂРѕС†РµСЃСЃР° splash РїРёС€РµС‚СЃСЏ РІ `%TEMP%\haplo_splash_*.pid`; РїРѕРґРїСЂРѕРіСЂР°РјРјР° `:closesplash` (`taskkill /F /PID`) РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ СЂРµР°Р»СЊРЅС‹С… РѕС€РёР±РєР°С… Р·Р°РїСѓСЃРєР° (РЅРµС‚ Python/Node, РЅРµС‚ РЅРё РѕРґРЅРѕРіРѕ РёР·РІРµСЃС‚РЅРѕРіРѕ Р±СЂР°СѓР·РµСЂР°) вЂ” С‚Р°Рј Р¶РґР°С‚СЊ РЅРµС‡РµРіРѕ.
- Splash РЅРµ Р·Р°РєСЂС‹РІР°РµС‚СЃСЏ РїСЂРё РїСЂРѕСЃС‚РѕРј РѕС‚РєСЂС‹С‚РёРё РѕРєРЅР° Р±СЂР°СѓР·РµСЂР° вЂ” РѕРЅ РґРѕР»Р¶РµРЅ РІРёСЃРµС‚СЊ (`TopMost`) РїРѕРІРµСЂС… Р·Р°РіСЂСѓР¶Р°СЋС‰РµР№СЃСЏ СЃС‚СЂР°РЅРёС†С‹, РїРѕРєР° `LevelEditor` СЂРµР°Р»СЊРЅРѕ РЅРµ РґРѕРёРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚СЃСЏ. РњРµС…Р°РЅРёР·Рј: `scripts/splash_screen.ps1` РїРѕРґРЅРёРјР°РµС‚ Р»РѕРєР°Р»СЊРЅС‹Р№ `TcpListener` РЅР° loopback-РїРѕСЂС‚Сѓ (`-ReadyPort`, РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 47990; РѕР±С‹С‡РЅС‹Р№ `TcpListener`, Р° РЅРµ `HttpListener`, С‡С‚РѕР±С‹ РЅРµ С‚СЂРµР±РѕРІР°С‚СЊ admin/URL-ACL РґР°Р¶Рµ РЅР° localhost); `index.html`/`LevelEditor.finalizeInitialization()` РІС‹Р·С‹РІР°СЋС‚ `window.notifySplashReady()` (fetch `no-cors` РЅР° СЌС‚РѕС‚ РїРѕСЂС‚), РєР°Рє С‚РѕР»СЊРєРѕ СЂРµРґР°РєС‚РѕСЂ СЂРµР°Р»СЊРЅРѕ РіРѕС‚РѕРІ (РёР»Рё СѓРїР°Р» СЃ РѕС€РёР±РєРѕР№ РІ `init()` вЂ” С‚РѕР¶Рµ Р·Р°РєСЂС‹РІР°РµС‚ splash, С‡С‚РѕР±С‹ РЅРµ Р·Р°РІРёСЃР°Р»). РџРѕР»СѓС‡РёРІ СЃРѕРµРґРёРЅРµРЅРёРµ, `splash_screen.ps1` РѕС‚РІРµС‡Р°РµС‚ РјРёРЅРёРјР°Р»СЊРЅС‹Рј `200 OK` Рё Р·Р°РєСЂС‹РІР°РµС‚ С„РѕСЂРјСѓ СЃР°Рј. Р•СЃР»Рё РїРёРЅРі С‚Р°Рє Рё РЅРµ РїСЂРёС€С‘Р» (РєСЂР°С€ СЃС‚СЂР°РЅРёС†С‹ РґРѕ `finalizeInitialization`), РІСЃС‚СЂРѕРµРЅРЅС‹Р№ С‚Р°Р№РјР°СѓС‚ (`-MaxWaitSeconds`, РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ 90СЃ) Р·Р°РєСЂС‹РІР°РµС‚ splash РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕ.
- Safety-net РїСЂРё Р·Р°РєСЂС‹С‚РёРё СЂРµРґР°РєС‚РѕСЂР° (РїРѕСЃР»Рµ РѕСЃС‚Р°РЅРѕРІРєРё СЃРµСЂРІРµСЂР°, РЅР° СЃР»СѓС‡Р°Р№ С‡С‚Рѕ РЅРё ping, РЅРё РІРЅСѓС‚СЂРµРЅРЅРёР№ С‚Р°Р№РјР°СѓС‚ РЅРµ СЃСЂР°Р±РѕС‚Р°Р»Рё): `:closesplash` + РїРѕРёСЃРє Р·Р°РІРёСЃС€РµРіРѕ РїСЂРѕС†РµСЃСЃР° РїРѕ РєРѕРјР°РЅРґРЅРѕР№ СЃС‚СЂРѕРєРµ (`Get-CimInstance Win32_Process` СЃ С„РёР»СЊС‚СЂРѕРј `-like *<РїСѓС‚СЊ_Рє_pid-С„Р°Р№Р»Р°>*`, РёСЃРєР»СЋС‡Р°СЏ PID СЃР°РјРѕРіРѕ РїСЂРѕРІРµСЂСЏСЋС‰РµРіРѕ РїСЂРѕС†РµСЃСЃР° С‡РµСЂРµР· `-ne $PID`) Рё РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅС‹Р№ `Stop-Process -Force`.
- Fix: СЂР°РЅСЊС€Рµ `:closesplash` РІС‹Р·С‹РІР°Р»СЃСЏ РїСЂСЏРјРѕ РїРµСЂРµРґ Р·Р°РїСѓСЃРєРѕРј Р±СЂР°СѓР·РµСЂР°, РїРѕСЌС‚РѕРјСѓ splash РїСЂРѕРїР°РґР°Р» РµС‰С‘ РґРѕ РїРѕСЏРІР»РµРЅРёСЏ РѕРєРЅР° СЂРµРґР°РєС‚РѕСЂР° (РЅРµ РїРѕСЃР»Рµ РїРѕР»РЅРѕР№ Р·Р°РіСЂСѓР·РєРё, РєР°Рє С‚СЂРµР±РѕРІР°Р»РѕСЃСЊ) вЂ” СЃР°Рј РІС‹Р·РѕРІ СѓР±СЂР°РЅ РёР· СЌС‚РѕР№ С‚РѕС‡РєРё, Р·Р°РєСЂС‹С‚РёРµ С‚РµРїРµСЂСЊ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· ping/С‚Р°Р№РјР°СѓС‚/error-РІРµС‚РєРё РІС‹С€Рµ.
- Fix (РЅР°Р№РґРµРЅ РїСЂРё С‚РѕРј Р¶Рµ РґРµР±Р°РіРµ): `:closesplash` С‡РёС‚Р°Р» `%SPLASH_PID%` РІРјРµСЃС‚Рѕ `!SPLASH_PID!` РІРЅСѓС‚СЂРё Р±Р»РѕРєР° `if exist (...)` РїСЂРё Р°РєС‚РёРІРЅРѕРј `setlocal enabledelayedexpansion`; `%`-РїРµСЂРµРјРµРЅРЅС‹Рµ РІРЅСѓС‚СЂРё СЃРєРѕР±РѕС‡РЅРѕРіРѕ Р±Р»РѕРєР° СЂР°Р·РІРѕСЂР°С‡РёРІР°СЋС‚СЃСЏ РѕРґРёРЅ СЂР°Р· РїСЂРё СЂР°Р·Р±РѕСЂРµ Р±Р»РѕРєР° (РµС‰С‘ РґРѕ `set /p`), РїРѕСЌС‚РѕРјСѓ `taskkill` РїРѕР»СѓС‡Р°Р» РїСѓСЃС‚РѕР№/СѓСЃС‚Р°СЂРµРІС€РёР№ PID Рё РјРѕР»С‡Р° РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р» (РѕС€РёР±РєР° РїРѕРґР°РІР»РµРЅР° `>nul 2>&1`). РСЃРїСЂР°РІР»РµРЅРѕ РЅР° `!SPLASH_PID!`.
- Р’ `index.html`/`LevelEditor.js` РїСЂРѕР±РѕРІР°Р»СЃСЏ HTML-РѕРІРµСЂР»РµР№ `#loading-screen` (РІРёРґРµРЅ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РѕС‚РєСЂС‹С‚РёСЏ РѕРєРЅР° Р±СЂР°СѓР·РµСЂР°) вЂ” СѓР±СЂР°РЅ РєР°Рє РёР·Р±С‹С‚РѕС‡РЅС‹Р№: РЅР°С‚РёРІРЅРѕРµ splash-РѕРєРЅРѕ СѓР¶Рµ РїРѕР»РЅРѕСЃС‚СЊСЋ Р·Р°РєСЂС‹РІР°РµС‚ СЂР°Р·СЂС‹РІ РЅР° СЃС‚Р°СЂС‚Рµ.

### Feature вЂ” РЅРѕРІС‹Р№ Р»Р°СѓРЅС‡РµСЂ `start_Editor.vbs` Рё СѓР»СѓС‡С€РµРЅРёСЏ `start_Editor.bat`

- Р”РѕР±Р°РІР»РµРЅ `start_Editor.vbs` (VBScript Р»Р°СѓРЅС‡РµСЂ) вЂ” РёСЃС‚РёРЅРЅРѕ Р±РµСЃС„Р»РёРєРµСЂРЅС‹Р№ Р·Р°РїСѓСЃРє СЂРµРґР°РєС‚РѕСЂР° (РєРѕРЅСЃРѕР»СЊ РїРѕР»РЅРѕСЃС‚СЊСЋ СЃРєСЂС‹С‚Р°, Р±РµР· РјРµР»СЊРєР°РЅРёСЏ). Р РµРєРѕРјРµРЅРґСѓРµРјР°СЏ С‚РѕС‡РєР° РІС…РѕРґР° РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ (РІРјРµСЃС‚Рѕ РїСЂСЏРјРѕРіРѕ РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР° РїРѕ `.bat`).
- `start_Editor.bat` С‚РµРїРµСЂСЊ РІС‹С‡РёСЃР»СЏРµС‚ СЂР°Р·РјРµСЂ РѕРєРЅР° Р±СЂР°СѓР·РµСЂР°: С€РёСЂРёРЅР° = 50% С€РёСЂРёРЅС‹ РјРѕРЅРёС‚РѕСЂР° РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј, РІС‹СЃРѕС‚Р° = С€РёСЂРёРЅР° * 9/16 (С„РѕСЂРјР°С‚ 16:9), РѕРєРЅРѕ С†РµРЅС‚СЂРёСЂСѓРµС‚СЃСЏ РЅР° СЌС‚РѕРј РјРѕРЅРёС‚РѕСЂРµ. Р Р°Р·РјРµСЂ РїРµСЂРµРґР°С‘С‚СЃСЏ Р±СЂР°СѓР·РµСЂСѓ С‡РµСЂРµР· `--window-size` / `--window-position` (Chromium Рё Firefox).
- `package.json` в†’ `files[]` РІРєР»СЋС‡Р°РµС‚ `start_Editor.vbs` СЂСЏРґРѕРј СЃ `start_Editor.bat`.

### Fix вЂ” `start_Editor.bat`: СѓР±СЂР°РЅРѕ РјРµР»СЊРєР°РЅРёРµ РѕРєРЅР° РєРѕРЅСЃРѕР»Рё РїСЂРё Р·Р°РїСѓСЃРєРµ, РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РґСЂСѓРіРёС… Р±СЂР°СѓР·РµСЂРѕРІ

- Self-relaunch РїРµСЂРµРІРµРґС‘РЅ СЃ `powershell -WindowStyle Hidden` РЅР° VBScript (`WshShell.Run 0, False`): PowerShell СЃРѕР·РґР°С‘С‚ РєРѕРЅСЃРѕР»СЊРЅРѕРµ РѕРєРЅРѕ РµС‰С‘ РґРѕ РїСЂРёРјРµРЅРµРЅРёСЏ hidden-СЃС‚РёР»СЏ (race, РІРёРґРЅРѕ РєР°Рє РјРµР»СЊРєР°РЅРёРµ/СЃРІРѕСЂР°С‡РёРІР°РЅРёРµ), ShellExecute СЃ `SW_HIDE` СЃРѕР·РґР°С‘С‚ РѕРєРЅРѕ СѓР¶Рµ СЃРєСЂС‹С‚С‹Рј.
- РџРѕРёСЃРє Р±СЂР°СѓР·РµСЂР° СЂР°СЃС€РёСЂРµРЅ: Chrome в†’ Edge в†’ Brave в†’ Vivaldi в†’ Opera (РІСЃРµ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚ `--app`, РѕС‚РєСЂС‹РІР°СЋС‚СЃСЏ РєР°Рє РѕС‚РґРµР»СЊРЅРѕРµ frameless-РѕРєРЅРѕ СЃ РёР·РѕР»РёСЂРѕРІР°РЅРЅС‹Рј РїСЂРѕС„РёР»РµРј) в†’ Firefox (РЅРµС‚ app-СЂРµР¶РёРјР°, РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РѕР±С‹С‡РЅС‹Рј РѕРєРЅРѕРј С‡РµСЂРµР· `-no-remote -new-instance` РґР»СЏ РѕС‚РґРµР»СЊРЅРѕРіРѕ РїСЂРѕС†РµСЃСЃР° РїРѕРґ `/wait`).
- Р•СЃР»Рё РЅРё РѕРґРёРЅ РёР·РІРµСЃС‚РЅС‹Р№ Р±СЂР°СѓР·РµСЂ РЅРµ РЅР°Р№РґРµРЅ РїРѕ РїСѓС‚Рё, РЅРѕ РІ СЃРёСЃС‚РµРјРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ РѕР±СЂР°Р±РѕС‚С‡РёРє `http` РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ (`HKCR\http\shell\open\command`) вЂ” РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ С‡РµСЂРµР· РЅРµРіРѕ (`start "" %URL%`, Р±РµР· Р°РІС‚РѕСЃС‚РѕРїР° СЃРµСЂРІРµСЂР° РїРѕ Р·Р°РєСЂС‹С‚РёСЋ РѕРєРЅР°).
- Р•СЃР»Рё Р±СЂР°СѓР·РµСЂР° РЅРµС‚ РІРѕРѕР±С‰Рµ (РЅРё РёР·РІРµСЃС‚РЅС‹С… РїСѓС‚РµР№, РЅРё РґРµС„РѕР»С‚РЅРѕРіРѕ РѕР±СЂР°Р±РѕС‚С‡РёРєР°) вЂ” РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ РґРёР°Р»РѕРі СЃ РѕС€РёР±РєРѕР№ (РєР°Рє РґР»СЏ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РµРіРѕ Python/Node), СЃРµСЂРІРµСЂ РѕСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ.

### Fix вЂ” `start_Editor.bat`: РїРѕР»РЅРѕСЃС‚СЊСЋ СЃРєСЂС‹С‚С‹Р№ Р·Р°РїСѓСЃРє (self-relaunch С‡РµСЂРµР· `powershell -WindowStyle Hidden`, РѕРєРЅРѕ РєРѕРЅСЃРѕР»Рё Р±РѕР»СЊС€Рµ РЅРµ РјРµР»СЊРєР°РµС‚) Рё Р°РІС‚РѕСЃС‚РѕРї СЃРµСЂРІРµСЂР° РїСЂРё Р·Р°РєСЂС‹С‚РёРё РѕРєРЅР° СЂРµРґР°РєС‚РѕСЂР° (РёР·РѕР»РёСЂРѕРІР°РЅРЅС‹Р№ Chrome-РїСЂРѕС„РёР»СЊ + `start /wait` в†’ `taskkill` РїРѕ PID СЃРµСЂРІРµСЂР°)

### Fix вЂ” `start_Editor.bat`: СѓР±РёС‚РёРµ СѓР¶Рµ Р·Р°РїСѓС‰РµРЅРЅРѕРіРѕ СЃРµСЂРІРµСЂР°, С„РѕРЅРѕРІС‹Р№ Р·Р°РїСѓСЃРє Р±РµР· РѕРєРЅР°, РѕС‚РєСЂС‹С‚РёРµ РІ РѕС‚РґРµР»СЊРЅРѕРј Chrome app-РѕРєРЅРµ

- РџРµСЂРµРґ СЃС‚Р°СЂС‚РѕРј РёС‰РµС‚ РїСЂРѕС†РµСЃСЃ, СЃР»СѓС€Р°СЋС‰РёР№ РїРѕСЂС‚ 8000 (`netstat` + `taskkill /F`), Рё СѓР±РёРІР°РµС‚ РµРіРѕ.
- РЎРµСЂРІРµСЂ (Python `http.server` РёР»Рё `npx serve`) Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ С‡РµСЂРµР· `powershell Start-Process -WindowStyle Hidden` вЂ” Р±РµР· РІРёРґРёРјРѕРіРѕ РѕРєРЅР° РєРѕРЅСЃРѕР»Рё РЅР° СЂР°Р±РѕС‡РµРј СЃС‚РѕР»Рµ.
- Node-РІРµС‚РєР° РїРµСЂРµРІРµРґРµРЅР° СЃ `npm install -g serve` + `serve` (Р»РѕРјР°Р»СЃСЏ, РµСЃР»Рё PATH РЅРµ РїРѕРґС…РІР°С‚С‹РІР°Р» РіР»РѕР±Р°Р»СЊРЅС‹Р№ Р±РёРЅР°СЂРЅРёРє) РЅР° `npx serve` (СѓСЃС‚СЂР°РЅСЏРµС‚ "'serve' is not recognized").
- РћС‚РєСЂС‹С‚РёРµ С‚РµРїРµСЂСЊ С‡РµСЂРµР· `chrome.exe --app=<url>` (РѕРєРЅРѕ Р±РµР· РІРєР»Р°РґРѕРє/Р°РґСЂРµСЃРЅРѕР№ СЃС‚СЂРѕРєРё, РєР°Рє Chrome "Install Page As App"), СЃ С„РѕР»Р±СЌРєРѕРј РЅР° Р±СЂР°СѓР·РµСЂ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, РµСЃР»Рё Chrome РЅРµ РЅР°Р№РґРµРЅ.
- Р›РёС‚РµСЂР°Р»СЊРЅС‹Рµ `(...)` РІРЅСѓС‚СЂРё `echo`-С‚РµРєСЃС‚Р° (`(recommended)`, `(PID %%p)`) Р»РѕРјР°Р»Рё РїР°СЂСЃРёРЅРі РІР»РѕР¶РµРЅРЅС‹С… `if/else` Рё `for` Р±Р»РѕРєРѕРІ вЂ” cmd СЃС‡РёС‚Р°РµС‚ Р»СЋР±СѓСЋ РЅРµРїР°СЂРЅСѓСЋ СЃРєРѕР±РєСѓ РІ С‚РµРєСЃС‚Рµ РіСЂР°РЅРёС†РµР№ Р±Р»РѕРєР° РґР°Р¶Рµ РІРЅРµ РєР°РІС‹С‡РµРє, РёР·-Р·Р° С‡РµРіРѕ СЃРєСЂРёРїС‚ РїСЂРё РЅР°Р№РґРµРЅРЅРѕРј Node.js РІСЃС‘ СЂР°РІРЅРѕ РїСЂРѕРІР°Р»РёРІР°Р»СЃСЏ РІ РІРµС‚РєСѓ "Neither Python nor Node.js found". РЎРєРѕР±РєРё СѓР±СЂР°РЅС‹ РёР· С‚РµРєСЃС‚Р° echo.
- `timeout /t 2 /nobreak` РїР°РґР°Р» СЃ "Input redirection is not supported", РµСЃР»Рё stdin РЅРµ СЏРІР»СЏРµС‚СЃСЏ СЂРµР°Р»СЊРЅРѕР№ РєРѕРЅСЃРѕР»СЊСЋ вЂ” Р·Р°РјРµРЅС‘РЅ РЅР° `ping -n 3 127.0.0.1 >nul`.

### Fix вЂ” `start_Editor.bat` Р»РѕР¶РЅРѕ СЂРµРїРѕСЂС‚РёР» "Neither Python nor Node.js found"

- `%errorlevel%` СЂР°Р·РІРѕСЂР°С‡РёРІР°Р»СЃСЏ РїСЂРё РїР°СЂСЃРёРЅРіРµ СЃРєРѕР±РѕС‡РЅРѕРіРѕ `if/else`-Р±Р»РѕРєР°, Р° РЅРµ РїСЂРё РІС‹РїРѕР»РЅРµРЅРёРё вЂ” РїСЂРѕРІРµСЂРєР° Node.js С‡РёС‚Р°Р»Р° СѓСЃС‚Р°СЂРµРІС€РµРµ Р·РЅР°С‡РµРЅРёРµ РѕС‚ РїСЂРѕРІРµСЂРєРё Python. Р”РѕР±Р°РІР»РµРЅС‹ `setlocal enabledelayedexpansion` Рё `!errorlevel!`.

### Tooling вЂ” Claude Code PreToolUse-С…СѓРє Р±Р»РѕРєРёСЂСѓРµС‚ `git commit` Р±РµР· Р±Р°РјРїР° РІРµСЂСЃРёРё СЂРµРґР°РєС‚РѕСЂР° (`.claude/settings.json`, `scripts/check-version-bump-hook.mjs`, `npm run bump:patch|minor|major`)

### Fix вЂ” РєР»РёРє/marquee РІРЅРµ СЂР°РјРєРё РїРѕРІС‘СЂРЅСѓС‚РѕР№ РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїС‹ РЅРµ Р·Р°РєСЂС‹РІР°Р» РіСЂСѓРїРїСѓ

- `MouseHandlers.handleEmptyClick`/`handleMouseUp` (deferred group close) СЃСЂР°РІРЅРёРІР°Р»Рё С‚РѕС‡РєСѓ РєР»РёРєР° СЃ РѕСЃРµРІС‹Рј AABB РіСЂСѓРїРїС‹ (`getObjectWorldBounds`) РІРјРµСЃС‚Рѕ РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° вЂ” РґР»СЏ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ AABB С€РёСЂРµ РІРёР·СѓР°Р»СЊРЅРѕР№ СЂР°РјРєРё, РїРѕСЌС‚РѕРјСѓ РєР»РёРє РІ "СѓРіРѕР»РєРµ" AABB (РІРЅРµ СЂР°РјРєРё) РѕС€РёР±РѕС‡РЅРѕ СЃС‡РёС‚Р°Р»СЃСЏ РїРѕРїР°РґР°РЅРёРµРј РІРЅСѓС‚СЂСЊ. Р—Р°РјРµРЅРµРЅРѕ РЅР° `ObjectOperations.isPointInObject()` (СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ `findObjectAtPoint`), РєРѕС‚РѕСЂС‹Р№ СѓС‡РёС‚С‹РІР°РµС‚ rotation-chain.
- РџРѕР±РѕС‡РЅС‹Р№ СЂРµРіСЂРµСЃСЃ РїРѕСЃР»Рµ СЌС‚РѕРіРѕ С„РёРєСЃР°: РєР»РёРє СЃРЅР°СЂСѓР¶Рё РіСЂСѓРїРїС‹ Р±РѕР»СЊС€Рµ РЅРµ РґР°РІР°Р» РїСЂРѕРјРѕС‚РёСЂРѕРІР°С‚СЊ drag РІ marquee-РІС‹РґРµР»РµРЅРёРµ РІРЅРµС€РЅРёС… РѕР±СЉРµРєС‚РѕРІ (С‡С‚РѕР±С‹ Р·Р°С‚СЏРЅСѓС‚СЊ РёС… РІРЅСѓС‚СЂСЊ) вЂ” `handleEmptyClick`'s "outside" РІРµС‚РєР° С‚РѕР»СЊРєРѕ РѕС‚РєР»Р°РґС‹РІР°Р»Р° Р·Р°РєСЂС‹С‚РёРµ РіСЂСѓРїРїС‹ РґРѕ mouseup, РЅРѕ РЅРµ Р·Р°РїСѓСЃРєР°Р»Р° marquee РїСЂРё СЂРµР°Р»СЊРЅРѕРј РґРІРёР¶РµРЅРёРё РјС‹С€Рё. Р”РѕР±Р°РІР»РµРЅРѕ: outside-РєР»РёРє С‚РµРїРµСЂСЊ С‚РѕР¶Рµ РїРёС€РµС‚ `mouse.marqueePendingStartPos/...` (С‚РѕС‚ Р¶Рµ РїРѕСЂРѕРі-РјРµС…Р°РЅРёР·Рј, С‡С‚Рѕ Рё Сѓ РєР»РёРєР° РїРѕ РѕР±СЉРµРєС‚Сѓ), РєРѕС‚РѕСЂС‹Р№ РІ `_handleMouseMoveImpl` РїСЂРѕРјРѕС‚РёСЂСѓРµС‚ РІ Р¶РёРІРѕР№ marquee РїСЂРё РїСЂРµРІС‹С€РµРЅРёРё РїРѕСЂРѕРіР°.
- РЎРѕРїСѓС‚СЃС‚РІСѓСЋС‰РёР№ Р±Р°Рі: `handleMouseUp` С‡РёС‚Р°Р» `mouse.isMarqueeSelecting` РёР· РѕР±СЉРµРєС‚Р° СЃРѕСЃС‚РѕСЏРЅРёСЏ, РєРѕС‚РѕСЂС‹Р№ `finishMarqueeSelection()` С‚СѓС‚ Р¶Рµ РјСѓС‚РёСЂСѓРµС‚ РІ `false` вЂ” РёР·-Р·Р° С‡РµРіРѕ РїРѕСЃР»Рµ СѓСЃРїРµС€РЅРѕРіРѕ marquee-РІС‹РґРµР»РµРЅРёСЏ СЃРЅР°СЂСѓР¶Рё РіСЂСѓРїРїС‹ РєРѕРґ РІСЃС‘ СЂР°РІРЅРѕ РїСЂРѕРІР°Р»РёРІР°Р»СЃСЏ РІ close/select-РІРµС‚РєСѓ Рё СЃС‚РёСЂР°Р» СЂРµР·СѓР»СЊС‚Р°С‚. РСЃРїСЂР°РІР»РµРЅРѕ Р·Р°С…РІР°С‚РѕРј `wasMarqueeSelecting` РґРѕ РІС‹Р·РѕРІР° `finishMarqueeSelection()`.

### Feature вЂ” copy/cut/paste РѕР±СЉРµРєС‚РѕРІ (Ctrl+C/X/V) СЃ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕРіРѕ flow СЂР°Р·РјРµС‰РµРЅРёСЏ

- `LevelEditor.copySelectedObjects()` / `cutSelectedObjects()` / `pasteObjects()` вЂ” С„СѓРЅРєС†РёРё Р±РѕР»СЊС€Рµ РЅРµ Р·Р°РіР»СѓС€РєРё; copy СЃРѕС…СЂР°РЅСЏРµС‚ deep-clone РІС‹Р±СЂР°РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ РІ `this.clipboard`, paste РІС‹Р·С‹РІР°РµС‚ `DuplicateOperations.startFromObjects(this.clipboard)` (РёРЅС‚РµСЂР°РєС‚РёРІРЅС‹Р№ ghost-СЂРµР¶РёРј, С‚РѕС‚ Р¶Рµ, С‡С‚Рѕ Shift+D).
- `DuplicateOperations.startFromSelection()` СЂР°Р·Р±РёС‚ РЅР° РїСѓР±Р»РёС‡РЅС‹Р№ `startFromObjects(selected)` вЂ” РїСЂРёРЅРёРјР°РµС‚ РїСЂРѕРёР·РІРѕР»СЊРЅС‹Р№ РјР°СЃСЃРёРІ РѕР±СЉРµРєС‚РѕРІ, Р° РЅРµ С‚РѕР»СЊРєРѕ С‚РµРєСѓС‰РµРµ РІС‹РґРµР»РµРЅРёРµ/РґРµСЂРµРІРѕ СѓСЂРѕРІРЅСЏ.
- `CommandAvailability.canPaste()` С‚РµРїРµСЂСЊ РїСЂРѕРІРµСЂСЏРµС‚ СЂРµР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ `levelEditor.clipboard` (РЅРµРїСѓСЃС‚РѕР№ РјР°СЃСЃРёРІ), Р° РЅРµ С‚РѕР»СЊРєРѕ СЃРёСЃС‚РµРјРЅС‹Р№ Clipboard API.
- РҐРѕС‚РєРµРё РґРѕР±Р°РІР»РµРЅС‹ РІ `config/defaults/shortcuts.json` в†’ `editor`: `copy` (Ctrl+C), `cut` (Ctrl+X), `paste` (Ctrl+V); РѕР±СЂР°Р±РѕС‚РєР° РІ `EventHandlers.handleKeyDown()`.

### Feature вЂ” СЂРµР°РєС‚РёРІРЅС‹Рµ РѕР±РЅРѕРІР»РµРЅРёСЏ РїР°РЅРµР»РµР№ РїСЂРё СЃС‚СЂСѓРєС‚СѓСЂРЅС‹С… РёР·РјРµРЅРµРЅРёСЏС… СѓСЂРѕРІРЅСЏ (v3.55.0)

Р Р°РЅСЊС€Рµ РєР°Р¶РґР°СЏ РѕРїРµСЂР°С†РёСЏ, РґРѕР±Р°РІР»СЏСЋС‰Р°СЏ/СѓРґР°Р»СЏСЋС‰Р°СЏ РѕР±СЉРµРєС‚С‹ РёР»Рё СЃР»РѕРё, РґРѕР»Р¶РЅР° Р±С‹Р»Р° СЏРІРЅРѕ РІС‹Р·РІР°С‚СЊ `editor.updateAllPanels()` вЂ” Р·Р°Р±С‹С‚С‹Р№ РІС‹Р·РѕРІ Р±С‹Р» СЂРµР°Р»СЊРЅС‹Рј Р±Р°РіРѕРј (РЅР°РїСЂРёРјРµСЂ, Isolate РЅРµ РѕР±РЅРѕРІР»СЏР» Outliner). РўРµРїРµСЂСЊ РїР°РЅРµР»Рё РїРѕРґРїРёСЃС‹РІР°СЋС‚СЃСЏ РЅР° СЃРѕР±С‹С‚РёРµ `'levelStructureChanged'` Рё РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.

**РњРµС…Р°РЅРёР·Рј**:
- `Level.setStructureChangeCallback()` / `notifyStructureChange()` вЂ” РіРµРЅРµСЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№ callback-С…СѓРє РЅР° СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ (РґРѕР±Р°РІР»РµРЅРёРµ/СѓРґР°Р»РµРЅРёРµ РѕР±СЉРµРєС‚РѕРІ Рё СЃР»РѕС‘РІ).
- `Level.removeObjects(ids)` вЂ” Р±Р°С‚С‡РµРІРѕРµ СѓРґР°Р»РµРЅРёРµ (РѕРґРЅРѕ СѓРІРµРґРѕРјР»РµРЅРёРµ РІРјРµСЃС‚Рѕ РѕРґРЅРѕРіРѕ РЅР° РѕР±СЉРµРєС‚).
- `LevelEditor.setupLayerObjectsCountTracking()` СЃРѕР±РёСЂР°РµС‚ СѓРІРµРґРѕРјР»РµРЅРёСЏ РІ РјР°СЃСЃРёРІ, СЃС…Р»РѕРїС‹РІР°РµС‚ РёС… С‡РµСЂРµР· `queueMicrotask()` (Р±Р°С‚С‡РёРЅРі РЅР° event loop) Рё РІС‹Р±СЂР°СЃС‹РІР°РµС‚ `stateManager.notify('levelStructureChanged', changes)`.
- `OutlinerPanel`, `LayersPanel`, `DetailsPanel` РїРѕРґРїРёСЃС‹РІР°СЋС‚СЃСЏ РЅР° `'levelStructureChanged'` Рё СЂРµРЅРґРµСЂСЏС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.

**РЎР»РµРґСЃС‚РІРёРµ**: РѕРїРµСЂР°С†РёРё (`GroupOperations`, `ObjectOperations`) С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓСЋС‚ `level.removeObjects()` РІРјРµСЃС‚Рѕ `level.objects = level.objects.filter(...)`, СЏРІРЅС‹Рµ РІС‹Р·РѕРІС‹ `updateAllPanels()` РІ РєРѕРЅС†Рµ РѕРїРµСЂР°С†РёР№ СѓРґР°Р»СЏСЋС‚СЃСЏ. РљРѕРґ РѕРїРµСЂР°С†РёР№ РїСЂРѕС‰Рµ, Р° Р±Р°РіРѕРІ СЃ РЅРµРїРѕР»РЅС‹Рј РѕР±РЅРѕРІР»РµРЅРёРµРј РёРЅС‚РµСЂС„РµР№СЃР° СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РјРµРЅСЊС€Рµ.

**РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ Р±Р°РіРё**: 
- Isolate (`/`) РЅРµ РѕР±РЅРѕРІР»СЏР» Outliner Р±РµР· РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РєР»РёРєР° РІ РєР°РЅРІСѓ вЂ” С‚РµРїРµСЂСЊ Outliner РїРѕРґРїРёСЃР°РЅ РЅР° СЃРѕР±С‹С‚РёРµ Рё РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ СЃСЂР°Р·Сѓ.
- Р›СЋР±С‹Рµ СЃС‚СЂСѓРєС‚СѓСЂРЅС‹Рµ РёР·РјРµРЅРµРЅРёСЏ С‡РµСЂРµР· СЂР°Р·РЅС‹Рµ С‚РѕС‡РєРё РІС…РѕРґР° (РіСЂСѓРїРїРѕРІС‹Рµ РѕРїРµСЂР°С†РёРё, СѓРґР°Р»РµРЅРёРµ, РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ) РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РѕР±РЅРѕРІР»СЏСЋС‚ РІСЃРµ РїР°РЅРµР»Рё.

### Fix вЂ” Undo РїРѕСЃР»Рµ Groupв†’Ungroup РїСЂРѕСЃРєР°РєРёРІР°Р» РЅР° С€Р°Рі РґР°Р»СЊС€Рµ РѕР¶РёРґР°РµРјРѕРіРѕ

- `GroupOperations.ungroupSelectedObjects()` РІС‹Р·С‹РІР°Р» `historyManager.saveState()` Р”Рћ РјСѓС‚Р°С†РёРё (РІ РѕС‚Р»РёС‡РёРµ РѕС‚ `groupSelectedObjects()`, РєРѕС‚РѕСЂР°СЏ СЃРѕС…СЂР°РЅСЏРµС‚ РџРћРЎР›Р•) вЂ” СЃРЅР°РїС€РѕС‚ СЃРѕРІРїР°РґР°Р» СЃ СѓР¶Рµ Р»РµР¶Р°С‰РёРј РЅР° РІРµСЂС€РёРЅРµ СЃС‚РµРєР° СЃРѕСЃС‚РѕСЏРЅРёРµРј, `HistoryManager.saveState()`'s РґРµРґСѓРїР»РёРєР°С†РёСЏ (`stateSnapshot === lastState`) РѕС‚Р±СЂР°СЃС‹РІР°Р»Р° РµРіРѕ, Рё С‡РµРєРїРѕРёРЅС‚ СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєРё РЅРёРєРѕРіРґР° РЅРµ РїРѕРїР°РґР°Р» РІ undo-СЃС‚РµРє. РџСЂРё СЃРІСЏР·РєРµ Groupв†’Ungroupв†’Undo СЌС‚Рѕ РїСЂРѕРїСѓСЃРєР°Р»Рѕ СЃР°РјСѓ СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєСѓ Рё РѕС‚РєР°С‚С‹РІР°Р»Рѕ РЅР° С€Р°Рі СЂР°РЅСЊС€Рµ. `saveState()` РїРµСЂРµРЅРµСЃС‘РЅ РїРѕСЃР»Рµ РІСЃРµС… РјСѓС‚Р°С†РёР№ (`level.removeObjects` СЃС‚Р°СЂС‹С… РіСЂСѓРїРї), РєР°Рє РІ `groupSelectedObjects()`.

### Fix вЂ” РјРµРЅСЋ С„РёР»СЊС‚СЂР° С‚РёРїРѕРІ (Outliner/AssetPanel) СЃРѕ СЃРјРµС‰РµРЅРёРµРј РѕС‚ РєРЅРѕРїРєРё Рё РЅРµ Р·Р°РєСЂС‹РІР°Р»РѕСЃСЊ РїСЂРё СѓРІРѕРґРµ РєСѓСЂСЃРѕСЂР°

- `OutlinerPanel.showFilterMenu()` (СЂРµРіСЂРµСЃСЃРёСЏ РёР· РїСЂРµРґС‹РґСѓС‰РµРіРѕ РєРѕРјРјРёС‚Р°) РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°Р»Рѕ РјРµРЅСЋ, РїРѕР»РЅРѕСЃС‚СЊСЋ РїРµСЂРµРєСЂС‹РІР°СЏ РєРЅРѕРїРєСѓ (`offset: -buttonRect.height`), С‡С‚РѕР±С‹ РєСѓСЂСЃРѕСЂ РІ РјРѕРјРµРЅС‚ РєР»РёРєР° РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РѕРєР°Р·С‹РІР°Р»СЃСЏ РІРЅСѓС‚СЂРё РјРµРЅСЋ вЂ” РёРЅР°С‡Рµ `MenuPositioningUtils.setupMenuClosing()`'s `mouseleave` РЅРёРєРѕРіРґР° РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р» (РєСѓСЂСЃРѕСЂ РЅРµ В«РІС…РѕРґРёР»В» РІ РјРµРЅСЋ, РµСЃР»Рё РѕРЅРѕ РїРѕСЏРІР»СЏР»РѕСЃСЊ РЅРµ РїРѕРґ РЅРёРј). РџРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚ вЂ” РІРёР·СѓР°Р»СЊРЅРѕРµ СЃРјРµС‰РµРЅРёРµ: РјРµРЅСЋ РїРµСЂРµРєСЂС‹РІР°Р»Рѕ РєРЅРѕРїРєСѓ РІРјРµСЃС‚Рѕ РїРѕСЏРІР»РµРЅРёСЏ РїРѕРґ РЅРµР№. РўРѕС‚ Р¶Рµ РєРѕСЂРЅРµРІРѕР№ Р±Р°Рі (РїСЂРѕСЃС‚Рѕ Р±РµР· РѕРІРµСЂР»Р°Рї-РєРѕСЃС‚С‹Р»СЏ) Р±С‹Р» Рё РІ `AssetPanel.showAssetFilterMenu()`.
- `MenuPositioningUtils.setupMenuClosing()` РїРµСЂРµРїРёСЃР°РЅ РЅР° РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ СЂРµР°Р»СЊРЅС‹С… РєРѕРѕСЂРґРёРЅР°С‚ РєСѓСЂСЃРѕСЂР° С‡РµСЂРµР· `document.addEventListener('mousemove', ...)` РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РѕР±СЉРµРґРёРЅС‘РЅРЅРѕР№ РѕР±Р»Р°СЃС‚Рё РєРЅРѕРїРєР°+РјРµРЅСЋ, РІРјРµСЃС‚Рѕ РЅР°С‚РёРІРЅРѕРіРѕ `mouseleave`. Р‘РѕР»СЊС€Рµ РЅРµ РІР°Р¶РЅРѕ, С‡С‚Рѕ РєСѓСЂСЃРѕСЂ РІ РјРѕРјРµРЅС‚ РѕС‚РєСЂС‹С‚РёСЏ РЅР°С…РѕРґРёС‚СЃСЏ РЅР°Рґ РєРЅРѕРїРєРѕР№, Р° РЅРµ РЅР°Рґ РјРµРЅСЋ. РџСЂРё Р·Р°РєСЂС‹С‚РёРё РґРёСЃРїР°С‚С‡РёС‚СЃСЏ `menuclose` РЅР° СЌР»РµРјРµРЅС‚Рµ РјРµРЅСЋ (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `OutlinerPanel` РґР»СЏ РѕС‡РёСЃС‚РєРё `keyup`-СЃР»СѓС€Р°С‚РµР»СЏ Ctrl-РіРµР№С‚Р°).
- `OutlinerPanel.showFilterMenu()`: СѓР±СЂР°РЅ РѕРІРµСЂР»Р°Рї-С…Р°Рє (`offset`), РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РјРµРЅСЋ С‚РµРїРµСЂСЊ РєР°Рє РІ `AssetPanel` вЂ” РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РїРѕРґ РєРЅРѕРїРєРѕР№ СЃ РЅРµР±РѕР»СЊС€РёРј Р·Р°Р·РѕСЂРѕРј.

### Fix вЂ” Isolate (`/`) РЅРµ РѕР±РЅРѕРІР»СЏР» Outliner Р±РµР· РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РєР»РёРєР° РІ РєР°РЅРІСѓ

- `ObjectOperations.toggleIsolateSelection()` РІС‹Р·С‹РІР°Р» `render()`, РЅРѕ РЅРµ `updateAllPanels()` вЂ” РІ РѕС‚Р»РёС‡РёРµ РѕС‚ `toggleObjectSolo()`. РђСѓС‚Р»Р°Р№РЅРµСЂ РєСЂР°СЃРёС‚ СЌС„С„РµРєС‚РёРІРЅСѓСЋ РІРёРґРёРјРѕСЃС‚СЊ СЃС‚СЂРѕРє С‡РµСЂРµР· `isObjectEffectivelyVisible()`, РєРѕС‚РѕСЂР°СЏ СѓС‡РёС‚С‹РІР°РµС‚ `view.isolatedTopLevelIds`, РЅРѕ Р±РµР· `updateAllPanels()` DOM РЅРµ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°Р»СЃСЏ РґРѕ СЃР»РµРґСѓСЋС‰РµРіРѕ СЃРѕР±С‹С‚РёСЏ (РЅР°РїСЂРёРјРµСЂ, РєР»РёРєР° РїРѕ РєР°РЅРІРµ). Р”РѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ `this.editor.updateAllPanels()`.

### Fix вЂ” РґР»РёРЅРЅС‹Рµ РёРјРµРЅР° РѕР±СЉРµРєС‚РѕРІ РІ Outliner РѕР±СЂРµР·Р°СЋС‚СЃСЏ РјРЅРѕРіРѕС‚РѕС‡РёРµРј, РЅРµ РЅР°РµР·Р¶Р°СЏ РЅР° РєРЅРѕРїРєСѓ РІРёРґРёРјРѕСЃС‚Рё

- `.outliner-item-name-display` (styles/spacing-mode.css): РґРѕР±Р°РІР»РµРЅС‹ `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. РљРѕРЅС‚РµР№РЅРµСЂ РёРјРµРЅРё Рё СЃР°Рј span СѓР¶Рµ РёРјРµР»Рё `flex: 1; min-width: 0`, Р° РєРЅРѕРїРєР° РІРёРґРёРјРѕСЃС‚Рё вЂ” `flex-shrink: 0`, РЅРѕ РѕР±СЂРµР·РєР° С‚РµРєСЃС‚Р° РЅРµ Р±С‹Р»Р° Р·Р°РґР°РЅР°, РїРѕСЌС‚РѕРјСѓ РґР»РёРЅРЅС‹Рµ РёРјРµРЅР° СЂР°СЃС‚СЏРіРёРІР°Р»Рё СЃС‚СЂРѕРєСѓ/РЅР°РµР·Р¶Р°Р»Рё РЅР° РёРєРѕРЅРєСѓ РіР»Р°Р·Р°.

### Fix вЂ” СѓСЃС‚Р°СЂРµРІС€РёР№ visibleObjectsCache/spatial index РЅР° РєР°РґСЂ РїРѕРєР°Р·С‹РІР°Р» СѓРґР°Р»С‘РЅРЅС‹Рµ/СЃРєСЂС‹С‚С‹Рµ РѕР±СЉРµРєС‚С‹

- `ObjectOperations.deleteSelectedObjects()` Рё `toggleVisibilityForSelection()` РІС‹Р·С‹РІР°Р»Рё `stateManager.set('selectedObjects', ...)` (СЃРёРЅС…СЂРѕРЅРЅРѕ С‚СЂРёРіРіРµСЂРёС‚ СЂРµРЅРґРµСЂ С‡РµСЂРµР· РїРѕРґРїРёСЃС‡РёРєР°) Р”Рћ РёРЅРІР°Р»РёРґР°С†РёРё `visibleObjectsCache`/spatial index вЂ” СЂРµРЅРґРµСЂ СѓСЃРїРµРІР°Р» СЃС…РІР°С‚РёС‚СЊ РµС‰С‘ С‚С‘РїР»С‹Р№ РєСЌС€ (`CACHE_TIMEOUT_MS = 100`) РґР»СЏ С‚РµРєСѓС‰РµР№ РїРѕР·РёС†РёРё РєР°РјРµСЂС‹ Рё РЅР° РєР°РґСЂ РѕС‚СЂРёСЃРѕРІР°С‚СЊ СѓР¶Рµ СѓРґР°Р»С‘РЅРЅС‹Рµ/СЃРєСЂС‹С‚С‹Рµ РѕР±СЉРµРєС‚С‹. РРЅРІР°Р»РёРґР°С†РёСЏ РєСЌС€РµР№ РїРµСЂРµРЅРµСЃРµРЅР° РїРµСЂРµРґ `set('selectedObjects', ...)` РІ РѕР±РѕРёС… РјРµСЃС‚Р°С…. РўРѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ СѓР±СЂР°РЅ РІ `DuplicateOperations.confirmPlacement()` (Р»РёС€РЅРёР№ СЏРІРЅС‹Р№ `render()` СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ `set('selectedObjects', ...)`, РєСЌС€Рё С‚Р°Рј СѓР¶Рµ РёРЅРІР°Р»РёРґРёСЂРѕРІР°Р»РёСЃСЊ СЂР°РЅСЊС€Рµ) Рё `BaseContextMenu` (fallback-СЃР±СЂРѕСЃ РІС‹РґРµР»РµРЅРёСЏ).

### Fix вЂ” РґРІРѕР№РЅРѕР№ render() РЅР° РєР°Р¶РґРѕРµ РёР·РјРµРЅРµРЅРёРµ selectedObjects/camera (РєРѕСЂРµРЅСЊ РјРѕСЂРіР°РЅРёСЏ РєР°РЅРІС‹)

- `StateManager.set()`/`update()` РІС‹СЃС‚Р°РІР»СЏР»Рё `_needsRender = true` РџРћРЎР›Р• `notifyListeners(...)`. РџРѕРґРїРёСЃС‡РёРєРё РЅР° `selectedObjects`/`camera` РІ `EventHandlers.setupStateListeners` СѓР¶Рµ РІС‹Р·С‹РІР°СЋС‚ `editor.render()` СЃРёРЅС…СЂРѕРЅРЅРѕ РІРЅСѓС‚СЂРё `notifyListeners` вЂ” РЅРѕ СЃР»РµРґСѓСЋС‰Р°СЏ СЃС‚СЂРѕРєР° С‚СѓС‚ Р¶Рµ РІР·РІРѕРґРёР»Р° С„Р»Р°Рі Р·Р°РЅРѕРІРѕ, Рё РїРѕСЃС‚РѕСЏРЅРЅС‹Р№ `requestAnimationFrame`-Р»СѓРї СЂРµРЅРґРµСЂРёР» РµС‰С‘ СЂР°Р· РЅР° СЃР»РµРґСѓСЋС‰РµРј РєР°РґСЂРµ. Р”РІРѕР№РЅРѕР№ СЂРµРЅРґРµСЂ РїСЂРѕРёСЃС…РѕРґРёР» РЅР° РљРђР–Р”РћР• РёР·РјРµРЅРµРЅРёРµ РІС‹РґРµР»РµРЅРёСЏ/РєР°РјРµСЂС‹ РІ СЂРµРґР°РєС‚РѕСЂРµ, РІРєР»СЋС‡Р°СЏ РіСЂСѓРїРїРёСЂРѕРІРєСѓ/СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєСѓ вЂ” СЌС‚Рѕ Рё РµСЃС‚СЊ РёСЃС‚РѕС‡РЅРёРє РјРѕСЂРіР°РЅРёСЏ, РєРѕС‚РѕСЂРѕРµ РЅРµ СѓСЃС‚СЂР°РЅСЏР»РѕСЃСЊ РїСЂРµРґС‹РґСѓС‰РёРј С„РёРєСЃРѕРј (СѓР±РѕСЂРєРѕР№ СЏРІРЅС‹С… РІС‹Р·РѕРІРѕРІ `render()` РІ `GroupOperations`). Р¤Р»Р°Рі РїРµСЂРµРЅРµСЃС‘РЅ РЅР° РІС‹СЃС‚Р°РІР»РµРЅРёРµ РґРѕ `notifyListeners`; `LevelEditor.render()` РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РІС‹Р·С‹РІР°РµС‚ `consumeNeedsRender()`, С‡С‚РѕР±С‹ СЃРёРЅС…СЂРѕРЅРЅС‹Р№ СЂРµРЅРґРµСЂ РіР°СЃРёР» РЅР°РєРѕРїР»РµРЅРЅС‹Р№ С„Р»Р°Рі. РџСЂРѕРІРµСЂРµРЅРѕ: РґРѕ С„РёРєСЃР° вЂ” 2 РІС‹Р·РѕРІР° `render()` РЅР° РѕРґРЅСѓ РѕРїРµСЂР°С†РёСЋ (РіСЂСѓРїРїРёСЂРѕРІРєР°/СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєР°), РїРѕСЃР»Рµ вЂ” СЂРѕРІРЅРѕ 1.

### Fix вЂ” Shift+РґСЂР°Рі range-СЃР»Р°Р№РґРµСЂР° РІ Settings С‚РµРїРµСЂСЊ СЃРјСЏРіС‡С‘РЅ

- `SettingsPanel.setupRangeSliders()`: РїРµСЂРІР°СЏ РІРµСЂСЃРёСЏ С‡РµСЂРµР· `pointerdown.preventDefault()` + `setPointerCapture` РЅРµ СЂР°Р±РѕС‚Р°Р»Р° вЂ” РЅР°С‚РёРІРЅС‹Р№ РґСЂР°Рі range-РёРЅРїСѓС‚Р° РЅРµ РѕС‚РјРµРЅСЏРµС‚СЃСЏ С‡РµСЂРµР· preventDefault, Р·РЅР°С‡РµРЅРёРµ РІСЃС‘ СЂР°РІРЅРѕ СЃР»РµРґРѕРІР°Р»Рѕ Р·Р° РєСѓСЂСЃРѕСЂРѕРј 1:1, РїР»СЋСЃ РїР°СЂР°Р·РёС‚РЅС‹Р№ focus-highlight РѕС‚ setPointerCapture. РџРµСЂРµРїРёСЃР°РЅРѕ РЅР° РїРµСЂРµС…РІР°С‚ РґРµР»СЊС‚С‹ СЃС‹СЂРѕРіРѕ Р·РЅР°С‡РµРЅРёСЏ РЅР° РєР°Р¶РґРѕРј РЅР°С‚РёРІРЅРѕРј `input`-С‚РёРєРµ: СЃР»СѓС€Р°С‚РµР»СЊ СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚СЃСЏ РїРµСЂРІС‹Рј (РґРѕ updateValueText/updateFill), РїСЂРё Р·Р°Р¶Р°С‚РѕРј Shift РїСЂРёРјРµРЅСЏРµС‚ С‚РѕР»СЊРєРѕ `SOFT_DRAG_FACTOR = 0.2` РѕС‚ РґРµР»СЊС‚С‹ Рё РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµС‚ `input.value` (Р±РµР· РїСЂРµРїСЏС‚СЃС‚РІРѕРІР°РЅРёСЏ РЅР°С‚РёРІРЅРѕРјСѓ РґСЂР°РіСѓ Рё Р±РµР· setPointerCapture).

### Refactor вЂ” РµРґРёРЅР°СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјР°СЏ СЂР°СЃРєР»Р°РґРєР° РїР°СЂР°РјРµС‚СЂРѕРІ Settings (createSettingsRow) Рё РєРѕРјРїР°РєС‚РЅРѕСЃС‚СЊ range-СЃР»Р°Р№РґРµСЂРѕРІ

- Р”РѕР±Р°РІР»РµРЅ РЅРѕРІС‹Р№ Р±Р°Р·РѕРІС‹Р№ Р±Р»РѕРє `createSettingsRow(label, forId, controlHtml, options)` РІ `SettingsSectionConstructor.js` вЂ” СЂРµРЅРґРµСЂРёС‚ РєРѕРјРїР°РєС‚РЅСѓСЋ РѕРґРЅРѕСЃС‚СЂРѕС‡РЅСѓСЋ СЂР°СЃРєР»Р°РґРєСѓ: label СЃР»РµРІР° (`flex 0 0 40%, text-align: right`) + control СЃРїСЂР°РІР° (Р·Р°РїРѕР»РЅСЏРµС‚ РѕСЃС‚Р°С‚РѕРє). Р•РґРёРЅРѕРѕР±СЂР°Р·РЅС‹Р№ UI РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ settings-РєРѕРЅС‚СЂРѕР»РѕРІ.
- `createSettingsRange()` С‚РµРїРµСЂСЊ **РІСЃРµРіРґР°** РёСЃРїРѕР»СЊР·СѓРµС‚ `createSettingsRow` вЂ” label СЃР»Р°Р№РґРµСЂР° СЂРµРЅРґРµСЂРёС‚СЃСЏ РІ РѕРґРЅРѕР№ СЃС‚СЂРѕРєРµ СЃРѕ СЃР»Р°Р№РґРµСЂРѕРј, Р° РЅРµ РЅР°Рґ РЅРёРј (Р±С‹Р»Рѕ: label Рё СЃР»Р°Р№РґРµСЂ РІ СЂР°Р·РЅС‹С… `<div>`). Р Р°РЅСЊС€Рµ 21 РјРµСЃС‚Рѕ РІ `SettingsPanelRenderers.js` (Selection/Touch/Camera/Assets/Performance РІРєР»Р°РґРєРё) **РґСѓР±Р»РёСЂРѕРІР°Р» label** РѕС‚РґРµР»СЊРЅС‹Рј РІС‹Р·РѕРІРѕРј `createSettingsLabel(...)` РґРѕ `createSettingsRange({label: ...})`, Р° СЃР°Рј `createSettingsRange` СЂРµРЅРґРµСЂРёР» СЃРІРѕР№ label РІРЅСѓС‚СЂРё вЂ” РёС‚РѕРі: label РІС‹РІРѕРґРёР»СЃСЏ РґРІР°Р¶РґС‹ РЅР° СЌРєСЂР°РЅРµ. **Р­С‚Рё РёР·Р±С‹С‚РѕС‡РЅС‹Рµ РІС‹Р·РѕРІС‹ СѓРґР°Р»РµРЅС‹** вЂ” label С‚РµРїРµСЂСЊ СЂРµРЅРґРµСЂРёС‚СЃСЏ РѕРґРёРЅ СЂР°Р·.
- `createSettingsColorInput()` СЃ РѕРїС†РёРµР№ `inline: true` С‚РµРїРµСЂСЊ С‚РѕР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚ `createSettingsRow` (РїРѕРІРµРґРµРЅРёРµ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ, РїСЂРѕСЃС‚Рѕ РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚ РѕР±С‰РёР№ Р±Р»РѕРє РІРјРµСЃС‚Рѕ РґСѓР±Р»РёСЂСѓСЋС‰РµРіРѕ РєРѕРґР°).
- `styles/settings-panel.css`: `.settings-range-wrapper` РїРѕР»СѓС‡РёР» `flex: 1 1 auto; min-width: 0;` вЂ” СЂР°СЃС‚СЏРіРёРІР°РµС‚СЃСЏ РЅР° РґРѕСЃС‚СѓРїРЅСѓСЋ С€РёСЂРёРЅСѓ СЂСЏРґРѕРј СЃ label (СЂР°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ РІРЅСѓС‚СЂРё flex-РєРѕРЅС‚РµР№РЅРµСЂР° `createSettingsRow`).

### Fix вЂ” РґРІРѕР№РЅРѕР№ render()/updateAllPanels() РїСЂРё РіСЂСѓРїРїРёСЂРѕРІРєРµ/СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєРµ РІС‹Р·С‹РІР°Р» РјРѕСЂРіР°РЅРёРµ РєР°РЅРІС‹

- `GroupOperations`: `groupSelectedObjects()`, `ungroupSelectedObjects()`, `openGroupEditMode()`, `closeGroupEditMode()` РІС‹Р·С‹РІР°Р»Рё `render()`+`updateAllPanels()` СЏРІРЅРѕ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ `stateManager.set('selectedObjects', ...)` вЂ” Р° `set()` СѓР¶Рµ СЃРёРЅС…СЂРѕРЅРЅРѕ С‚СЂРёРіРіРµСЂРёС‚ РїРѕРґРїРёСЃРєСѓ РІ `EventHandlers.setupStateListeners`, РєРѕС‚РѕСЂР°СЏ СЃР°РјР° РґРµР»Р°РµС‚ `render()`+`updateAllPanels()`. РС‚РѕРі вЂ” РґРІР° РїРѕР»РЅС‹С… РїСЂРѕС…РѕРґР° СЂРµРЅРґРµСЂР°/РїР°РЅРµР»РµР№ РЅР° РѕРґРЅСѓ РѕРїРµСЂР°С†РёСЋ, Р·Р°РјРµС‚РЅС‹Рµ РєР°Рє РјРѕСЂРіР°РЅРёРµ РєР°РЅРІС‹ (РѕСЃРѕР±РµРЅРЅРѕ РїСЂРё СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєРµ РЅРµСЃРєРѕР»СЊРєРёС… РіСЂСѓРїРї СЃСЂР°Р·Сѓ). РЇРІРЅС‹Рµ РІС‹Р·РѕРІС‹ СѓР±СЂР°РЅС‹, `set('selectedObjects', ...)` РІ `groupSelectedObjects()` РїРµСЂРµРЅРµСЃС‘РЅ РІ РєРѕРЅРµС† (РїРѕСЃР»Рµ РёРЅРІР°Р»РёРґР°С†РёРё РєСЌС€РµР№), С‡С‚РѕР±С‹ РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РѕСЃС‚Р°РІС€РёР№СЃСЏ СЂРµРЅРґРµСЂ РІРёРґРµР» СѓР¶Рµ Р°РєС‚СѓР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ.

### Fix вЂ” СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєР° РІС‹Р·С‹РІР°Р»Р° С‚СЏР¶С‘Р»СѓСЋ РїРµСЂРµСЂРёСЃРѕРІРєСѓ РЅР° Р±РѕР»СЊС€РёС… СѓСЂРѕРІРЅСЏС…

- `GroupOperations.extractObjectFromGroup()` РЅР° РєР°Р¶РґРѕРіРѕ РёР·РІР»РµРєР°РµРјРѕРіРѕ СЂРµР±С‘РЅРєР° Р·Р°РЅРѕРІРѕ РґРµР»Р°Р» РїРѕР»РЅС‹Р№ РѕР±С…РѕРґ РґРµСЂРµРІР° СѓСЂРѕРІРЅСЏ С‡РµСЂРµР· `_findParentGroup(group)` (РґРІР°Р¶РґС‹ вЂ” РЅР°РїСЂСЏРјСѓСЋ Рё РІРЅСѓС‚СЂРё `_captureAncestorPivots`), С…РѕС‚СЏ `ungroupSelectedObjects()` РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚ С‚РѕР»СЊРєРѕ top-level РіСЂСѓРїРїС‹, РґР»СЏ РєРѕС‚РѕСЂС‹С… СЂРµР·СѓР»СЊС‚Р°С‚ РІСЃРµРіРґР° `null`. Р”РѕР±Р°РІР»РµРЅР° РѕРїС†РёСЏ `isTopLevelGroup`, РїСЂРѕРїСѓСЃРєР°СЋС‰Р°СЏ СЌС‚Рё РѕР±С…РѕРґС‹ Рё СЃСѓР¶Р°СЋС‰Р°СЏ РїРѕРёСЃРє РјРёСЂРѕРІРѕР№ РїРѕР·РёС†РёРё СЂРµР±С‘РЅРєР° РґРѕ `[group]` РІРјРµСЃС‚Рѕ РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ СѓСЂРѕРІРЅСЏ вЂ” СѓР±РёСЂР°РµС‚ O(children Г— СЂР°Р·РјРµСЂ СѓСЂРѕРІРЅСЏ) С„СЂРёР· РїРµСЂРµРґ СЂРµРЅРґРµСЂРѕРј РїСЂРё СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєРµ.

### Fix вЂ” РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РѕР±СЉРµРєС‚Р° РІРЅРµ РіСЂСѓРїРїС‹ РїСЂРё РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїРµ РґРѕР±Р°РІР»СЏР»Рѕ РµРіРѕ РІ РіСЂСѓРїРїСѓ

- `DuplicateOperations.confirmPlacement()`: РІРµС‚РєР° `else` (РґСѓР±Р»РёСЂСѓРµРјС‹Р№ РѕР±СЉРµРєС‚ РЅРµ Р±С‹Р» СЂРµР±С‘РЅРєРѕРј СЂРµРґР°РєС‚РёСЂСѓРµРјРѕР№ РіСЂСѓРїРїС‹) РІС‹СЃС‚Р°РІР»СЏР»Р° РјРёСЂРѕРІС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹, РЅРѕ РЅРµ Р·Р°РІРµСЂС€Р°Р»Р° РѕР±СЂР°Р±РѕС‚РєСѓ вЂ” РєРѕРґ РїСЂРѕРІР°Р»РёРІР°Р»СЃСЏ РЅРёР¶Рµ Рё РІСЃС‘ СЂР°РІРЅРѕ РїСѓС€РёР» РѕР±СЉРµРєС‚ РІ `groupEditMode.group.children`. Р”РѕР±Р°РІР»РµРЅ СЂР°РЅРЅРёР№ `return` СЃ `level.addObject()`, РєР°Рє РІ СЃРѕСЃРµРґРЅРµР№ РІРµС‚РєРµ РґР»СЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅРѕРіРѕ СЃР»РѕСЏ.

### Fix вЂ” РѕР±СЉРµРєС‚ "РјРѕСЂРіР°Р»" РІ РґСЂСѓРіРѕРј РјРµСЃС‚Рµ РєР°РЅРІС‹ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РІ РіСЂСѓРїРїСѓ

- `MouseHandlers.dragSelectedObjects()`: РїСЂРё drag-n-drop РѕР±СЉРµРєС‚Р° СЃ РіР»Р°РІРЅРѕРіРѕ СѓСЂРѕРІРЅСЏ РІ СЂРµРґР°РєС‚РёСЂСѓРµРјСѓСЋ РіСЂСѓРїРїСѓ `dx`/`dy` СЌС‚РѕРіРѕ РєР°РґСЂР° РїСЂРёР±Р°РІР»СЏР»РёСЃСЊ Рє `obj.x/y` РґРІР°Р¶РґС‹ вЂ” РѕРґРёРЅ СЂР°Р· Р±РµР·СѓСЃР»РѕРІРЅРѕ (РѕР±С‹С‡РЅРѕРµ РїРµСЂРµРјРµС‰РµРЅРёРµ), РІС‚РѕСЂРѕР№ СЂР°Р· РїСЂСЏРјРѕ РїРµСЂРµРґ `addObjectToGroup()`. `addObjectToGroup()` СЃС‡РёС‚Р°РµС‚ РјРёСЂРѕРІРѕР№ С†РµРЅС‚СЂ РѕР±СЉРµРєС‚Р° РїРѕ РµРіРѕ С‚РµРєСѓС‰РёРј РєРѕРѕСЂРґРёРЅР°С‚Р°Рј, РїРѕСЌС‚РѕРјСѓ РёР·-Р·Р° Р»РёС€РЅРµРіРѕ СЃРґРІРёРіР° РѕР±СЉРµРєС‚ РЅР° РєР°РґСЂ СЂРµР°Р»СЊРЅРѕРіРѕ СЂРµ-СЂРѕРґРёС‚РµР»СЏ РїСЂРѕСЃРєР°РєРёРІР°Р» РІ РЅРµРІРµСЂРЅСѓСЋ (РїРµСЂРµРїСЂРёР»РѕР¶РµРЅРЅСѓСЋ РґРµР»СЊС‚РѕР№) С‚РѕС‡РєСѓ, С‡С‚Рѕ РІРёР·СѓР°Р»СЊРЅРѕ РІС‹РіР»СЏРґРµР»Рѕ РєР°Рє "РјРѕСЂРіР°РЅРёРµ" РІ РґСЂСѓРіРѕРј РјРµСЃС‚Рµ. РЈР±СЂР°РЅРѕ РїРѕРІС‚РѕСЂРЅРѕРµ РїСЂРёРјРµРЅРµРЅРёРµ `dx`/`dy` вЂ” `addObjectToGroup()` РёСЃРїРѕР»СЊР·СѓРµС‚ РїРѕР·РёС†РёСЋ, СѓР¶Рµ РѕР±РЅРѕРІР»С‘РЅРЅСѓСЋ РѕСЃРЅРѕРІРЅС‹Рј РїРµСЂРµРјРµС‰РµРЅРёРµРј.
- Р’С‚РѕСЂР°СЏ РїСЂРёС‡РёРЅР°: `RenderOperations.getVisibleObjects()` РєРµС€РёСЂСѓРµС‚ СЃРїРёСЃРѕРє `{obj, parentX, parentY}` РЅР° РєР°РјРµСЂСѓ РґРѕ 100РјСЃ (`CACHE_TIMEOUT_MS`), `CanvasRenderer.drawObject()` РґРѕРІРµСЂСЏРµС‚ Р·Р°РєРµС€РёСЂРѕРІР°РЅРЅС‹Рј `parentX/parentY` Р±РµР· РїСЂРѕРІРµСЂРєРё. РџРѕСЃР»Рµ СЂРµ-СЂРѕРґРёС‚РµР»СЏ РѕР±СЉРµРєС‚ РїРѕР»СѓС‡Р°Р» group-local РєРѕРѕСЂРґРёРЅР°С‚С‹, РЅРѕ СѓСЃС‚Р°СЂРµРІС€Р°СЏ Р·Р°РїРёСЃСЊ РєРµС€Р° РµС‰С‘ РґРѕ 100РјСЃ СЃС‡РёС‚Р°Р»Р° РµРіРѕ top-level (`parentX=0,parentY=0`) вЂ” СЂРµРЅРґРµСЂРёР»СЃСЏ РїРѕ СЃС‹СЂС‹Рј Р»РѕРєР°Р»СЊРЅС‹Рј РєРѕРѕСЂРґРёРЅР°С‚Р°Рј РєР°Рє РїРѕ РјРёСЂРѕРІС‹Рј. `GroupOperations.groupSelectedObjects()/ungroupSelectedObjects()` СѓР¶Рµ Р·РІР°Р»Рё `clearVisibleObjectsCacheForCurrentCamera()` СЂСЏРґРѕРј СЃ `invalidateSpatialIndex()`, Р° РІС‹Р·РѕРІ `addObjectToGroup()` РІ `MouseHandlers.js` вЂ” РЅРµС‚. Р”РѕР±Р°РІР»РµРЅ РЅРµРґРѕСЃС‚Р°СЋС‰РёР№ РІС‹Р·РѕРІ.

### Fix вЂ” Ungroup Р»РѕРјР°Р» С‚СЂР°РЅСЃС„РѕСЂРјС‹ РґРµС‚РµР№ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹

- `GroupOperations.ungroupSelectedObjects()` РїРµСЂРµРІРѕРґРёР» РґРµС‚РµР№ РІ РјРёСЂРѕРІС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ РЅР°РёРІРЅС‹Рј `child.x += group.x; child.y += group.y`, РїРѕР»РЅРѕСЃС‚СЊСЋ РёРіРЅРѕСЂРёСЂСѓСЏ `group.rotation` вЂ” РїСЂРё СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєРµ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ РґРµС‚Рё РїРѕР»СѓС‡Р°Р»Рё РЅРµРІРµСЂРЅС‹Рµ РїРѕР·РёС†РёСЋ Рё rotation. РўРµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `extractObjectFromGroup()` (С‚РѕС‚ Р¶Рµ Р°Р»РіРѕСЂРёС‚Рј worldPositionStays, С‡С‚Рѕ Рё РїСЂРё РІС‹С‚Р°СЃРєРёРІР°РЅРёРё РѕРґРЅРѕРіРѕ РѕР±СЉРµРєС‚Р° РёР· РіСЂСѓРїРїС‹), СЃРѕС…СЂР°РЅСЏСЋС‰РёР№ С‚РѕС‡РЅС‹Р№ РІРёР·СѓР°Р»СЊРЅС‹Р№ С‚СЂР°РЅСЃС„РѕСЂРј РєР°Р¶РґРѕРіРѕ СЂРµР±С‘РЅРєР°.

### Fix вЂ” РґРµРґСѓРї РїСЂРѕРІРµСЂРєРё РЅРµСЃРѕС…СЂР°РЅС‘РЅРЅС‹С… РёР·РјРµРЅРµРЅРёР№ РІ `LevelFileOperations`

- `newLevel()` Рё `openLevel()` РґРµСЂР¶Р°Р»Рё РґРІР° РёРґРµРЅС‚РёС‡РЅС‹С…, РЅРѕ СЂР°Р·РґРµР»СЊРЅС‹С… Р±Р»РѕРєР° РїСЂРѕРІРµСЂРєРё `isDirty` + `confirm(...)` вЂ” СЂРёСЃРє СЂР°СЃСЃРёРЅС…СЂРѕРЅР° РїСЂРё Р±СѓРґСѓС‰РёС… РїСЂР°РІРєР°С… РѕРґРЅРѕРіРѕ Р±РµР· РґСЂСѓРіРѕРіРѕ. Р’С‹РЅРµСЃРµРЅРѕ РІ РѕР±С‰РёР№ `_confirmDiscardUnsavedChanges(actionLabel)`.

### Fix вЂ” StateManager.reset() Р»РѕРјР°Р» РѕР±РЅРѕРІР»РµРЅРёРµ РїР°РЅРµР»РµР№/canvas РїСЂРё Р·Р°РіСЂСѓР·РєРµ Р»РµРІРµР»Р°

- `reset()` СѓРІРµРґРѕРјР»СЏР» СЃР»СѓС€Р°С‚РµР»РµР№ С‡РµСЂРµР· `this.state[key]` РІРјРµСЃС‚Рѕ `this.get(key)` вЂ” РґР»СЏ dotted-РєР»СЋС‡РµР№ (`canvas.showGrid`, `canvas.snapToGrid` Рё РґСЂ.) СЌС‚Рѕ РІСЃРµРіРґР° РґР°РІР°Р»Рѕ `undefined`, РёР·-Р·Р° С‡РµРіРѕ Toolbar/SettingsPanel РІРёР·СѓР°Р»СЊРЅРѕ РїРѕРєР°Р·С‹РІР°Р»Рё Grid/Snap РІС‹РєР»СЋС‡РµРЅРЅС‹РјРё СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ New/Open Level, С…РѕС‚СЏ СЂРµР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ Р±С‹Р»Рѕ РєРѕСЂСЂРµРєС‚РЅС‹Рј. РўР°РєР¶Рµ `outliner` РІ `createInitialState()` РЅРµ СЃРѕРґРµСЂР¶Р°Р» `collapsedGroups`/`activeTypeFilters`/`shiftAnchor` (С‚РѕР»СЊРєРѕ `collapsedTypes`), РёР·-Р·Р° С‡РµРіРѕ `OutlinerPanel.countObjectsInGroup()` РєРёРґР°Р» `TypeError` РЅР° Р»СЋР±РѕРј Р»РµРІРµР»Рµ СЃ РіСЂСѓРїРїР°РјРё СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё. РџР»СЋСЃ `reset()` РЅРµ РІР·РІРѕРґРёР» `_needsRender` СЏРІРЅРѕ (РїРѕР»Р°РіР°Р»СЃСЏ РЅР° СЃР»СѓС‡Р°Р№РЅС‹Р№ РїРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚ СЃР»СѓС€Р°С‚РµР»СЏ).
- `src/managers/StateManager.js`: `reset()` С‚РµРїРµСЂСЊ СѓРІРµРґРѕРјР»СЏРµС‚ С‡РµСЂРµР· `get(key)` Рё СЏРІРЅРѕ СЃС‚Р°РІРёС‚ `_needsRender = true`; `outliner` РІ `createInitialState()` РґРѕРїРѕР»РЅРµРЅ РґРѕ РїРѕР»РЅРѕР№ С„РѕСЂРјС‹, РѕР¶РёРґР°РµРјРѕР№ `OutlinerPanel`.

### Feature вЂ” С‡РµРєР±РѕРєСЃ "Apply changes automatically" РІ С„СѓС‚РµСЂРµ Settings-РїР°РЅРµР»Рё

- РќРѕРІС‹Р№ С‡РµРєР±РѕРєСЃ `#settings-auto-apply` РІ `.settings-footer-left` (`SettingsPanel.createSettingsPanel()`), СЃРѕСЃС‚РѕСЏРЅРёРµ вЂ” `SettingsPanel.autoApply` (persisted РІ `localStorage['levelEditor_settingsAutoApply']`, `'1'`/`'0'`, РґРµС„РѕР»С‚ `true` вЂ” РїРѕРІРµРґРµРЅРёРµ РєР°Рє СЂР°РЅСЊС€Рµ). РџСЂРё РІРєР»СЋС‡РµРЅРёРё (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ) РєР°Р¶РґРѕРµ РёР·РјРµРЅРµРЅРёРµ `.setting-input` РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє СЂРµРґР°РєС‚РѕСЂСѓ СЃСЂР°Р·Сѓ (`SettingsSyncManager.syncSettingToState`/`applyGridColorSetting`/`applyLoggerColors`/`applyCompactMode`), Р° РєРЅРѕРїРєРё Cancel/Apply Changes Р·Р°РґРёР·РµР№Р±Р»РµРЅС‹ (`SettingsPanel.updateAutoApplyUI()`, `styles/dialog-positioning.css` в†’ `.settings-btn:disabled`) вЂ” С„РёРєСЃРёСЂРѕРІР°С‚СЊ/РѕС‚РєР°С‚С‹РІР°С‚СЊ РЅРµС‡РµРіРѕ. РџСЂРё РІС‹РєР»СЋС‡РµРЅРёРё live-РїСЂРёРјРµРЅРµРЅРёРµ РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ (СЂР°РЅРЅРёР№ `return` РІ `_inputHandler`/`_changeHandler` РёР· `setupSettingsInputs()`), РєРЅРѕРїРєРё СЃС‚Р°РЅРѕРІСЏС‚СЃСЏ Р°РєС‚РёРІРЅС‹: "Apply Changes" РІС‹Р·С‹РІР°РµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `saveSettings()`, Cancel/Escape/РєР»РёРє РїРѕ РѕРІРµСЂР»РµСЋ вЂ” `cancelSettings()`, РєРѕС‚РѕСЂС‹Р№ С‚РµРїРµСЂСЊ РѕС‚РєР°С‚С‹РІР°РµС‚ Р·РЅР°С‡РµРЅРёСЏ С‡РµСЂРµР· `restoreOriginalValues()`.
- `SettingsPanel.storeOriginalValues()` СЂР°СЃС€РёСЂРµРЅ: СЂР°РЅСЊС€Рµ СЃРЅРёРјР°Р» ~15 С…Р°СЂРґРєРѕРґ-РїСѓС‚РµР№ С‚РѕР»СЊРєРѕ РґР»СЏ С†РІРµС‚РѕРІ, С‚РµРїРµСЂСЊ СЃРЅРёРјР°РµС‚ РІСЃРµ РєР»СЋС‡Рё StateManager РёР· `syncManager.getAllMappings()` РїР»СЋСЃ `logger.colors` вЂ” Cancel/close РѕС‚РєР°С‚С‹РІР°РµС‚ Р»СЋР±СѓСЋ РІРєР»Р°РґРєСѓ, РЅРµ С‚РѕР»СЊРєРѕ Colors. `restoreOriginalValues()` РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РІС‹Р·С‹РІР°РµС‚ `syncManager.applySpecialUISettings()` Рё `syncManager.forceUpdateAllViewOptions()` (СЂР°РЅСЊС€Рµ вЂ” С‚РѕР»СЊРєРѕ `applyInitialColorSettings()`), С‡С‚РѕР±С‹ РїРѕСЃР»Рµ РѕС‚РєР°С‚Р° РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°Р»РёСЃСЊ CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ Рё СЃРѕСЃС‚РѕСЏРЅРёСЏ view/toolbar/menu С‚СѓРјР±Р»РµСЂРѕРІ.
- РР·РІРµСЃС‚РЅРѕРµ РѕРіСЂР°РЅРёС‡РµРЅРёРµ (РЅРµ Р±Р°РіС„РёРєСЃ, Р° С„РёРєСЃР°С†РёСЏ С‚РµРєСѓС‰РµРіРѕ РїРѕРІРµРґРµРЅРёСЏ): РІРєР»Р°РґРєР° Grid & Snapping (`GridSettings.js`) РёСЃРїРѕР»СЊР·СѓРµС‚ РєР»Р°СЃСЃ `settings-input` (РЅРµ `setting-input`, РєРѕС‚РѕСЂС‹Р№ СЃР»СѓС€Р°РµС‚ `setupSettingsInputs()`), РїРѕСЌС‚РѕРјСѓ РµС‘ РїРѕР»СЏ РЅРёРєРѕРіРґР° РЅРµ РїСЂРёРјРµРЅСЏР»РёСЃСЊ live РїРѕ РЅР°Р¶Р°С‚РёСЋ РєР»Р°РІРёС€Рё вЂ” РЅРё РґРѕ СЌС‚РѕРіРѕ РёР·РјРµРЅРµРЅРёСЏ, РЅРё РїРѕСЃР»Рµ; РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕ "Apply Changes". Р’РєР»Р°РґРєР° Hotkeys СЃРѕС…СЂР°РЅСЏРµС‚ СЂРµР±РёРЅРґС‹ РЅР°РїСЂСЏРјСѓСЋ РІ `ConfigManager` РїРѕ blur (`SettingsPanel.saveHotkey()`), РЅРµ Р·Р°РІСЏР·Р°РЅР° РЅР° Apply/Cancel Рё РЅРµ Р·Р°С‚СЂРѕРЅСѓС‚Р° РЅРѕРІС‹Рј С‡РµРєР±РѕРєСЃРѕРј.
- РЎС‚РёР»Рё: `.settings-auto-apply-label`, `.settings-footer-left` (`styles/settings-panel.css`), `.settings-btn:disabled` (`styles/dialog-positioning.css`).

### UI вЂ” РІРёРґР¶РµС‚ range-СЃР»Р°Р№РґРµСЂР° РІ Settings РїРµСЂРµСЂР°Р±РѕС‚Р°РЅ (Р±РµР· thumb, Р·РЅР°С‡РµРЅРёРµ РїРѕРІРµСЂС… С‚СЂРµРєР°, СЂСѓС‡РЅРѕР№ РІРІРѕРґ РїРѕ dblclick)

- `SettingsSectionConstructor.createSettingsRange()` Р±РѕР»СЊС€Рµ РЅРµ СЂРµРЅРґРµСЂРёС‚ `<input type="range">` СЃ РѕС‚РґРµР»СЊРЅС‹Рј `<div style="text-align:center">` РїРѕРґ РЅРёРј вЂ” С‚РµРїРµСЂСЊ `<div class="settings-range-wrapper">` СЃ С‚СЂРµРјСЏ РґРµС‚СЊРјРё: `input.settings-range-input[data-unit]`, `span.settings-range-value` (Р·РЅР°С‡РµРЅРёРµ РїРѕРІРµСЂС… СЃР»Р°Р№РґРµСЂР°) Рё СЃРєСЂС‹С‚С‹Р№ `input.settings-range-edit` (С‡РёСЃР»РѕРІРѕР№ РёРЅРїСѓС‚ РґР»СЏ СЂСѓС‡РЅРѕРіРѕ РІРІРѕРґР°). Р Р°Р·РјРµС‚РєР° РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІРѕ РІСЃРµС… РІРєР»Р°РґРєР°С…, СЂРµРЅРґРµСЂСЏС‰РёС…СЃСЏ С‡РµСЂРµР· `src/ui/panel-structures/SettingsPanelRenderers.js` (General/Camera/Selection/Touch/Performance Рё С‚.Рґ.) вЂ” РІС‹Р·РѕРІС‹ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР° РЅРµ РјРµРЅСЏР»РёСЃСЊ.
- `GridSettings.js` (СЃР»Р°Р№РґРµСЂ `#grid-opacity`, РёСЃРїРѕР»СЊР·СѓРµС‚ РєР»Р°СЃСЃ `settings-input` РІРјРµСЃС‚Рѕ `setting-input` Рё РЅРµ РІС‹Р·С‹РІР°РµС‚ `createSettingsRange`) РІСЂСѓС‡РЅСѓСЋ РѕР±С‘СЂРЅСѓС‚ РІ С‚Сѓ Р¶Рµ СЃС‚СЂСѓРєС‚СѓСЂСѓ `.settings-range-wrapper`/`.settings-range-value`/`.settings-range-edit`.
- `SettingsPanel.updateSliderDisplay()` СѓРґР°Р»С‘РЅ РІРјРµСЃС‚Рµ СЃРѕ СЃС‚Р°СЂС‹Рј РјРµС…Р°РЅРёР·РјРѕРј (РїРѕРёСЃРє `div[style*="text-align: center"]`, С…Р°СЂРґРєРѕРґ СЋРЅРёС‚РѕРІ `"ms"`/`"x"` РїРѕ РїСЂРµС„РёРєСЃСѓ `data-setting` РєР°С‚РµРіРѕСЂРёР№ `performance`/`camera`). Р”РѕР±Р°РІР»РµРЅ `setupRangeSliders()` (РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ РєРѕРЅС†Рµ `setupSettingsInputs()`), РєРѕС‚РѕСЂС‹Р№ РЅР°С…РѕРґРёС‚ РІСЃРµ `input[type="range"]` РІ `#settings-panel-container` РїРѕ С‚РёРїСѓ СЌР»РµРјРµРЅС‚Р° (РЅРµ РїРѕ CSS-РєР»Р°СЃСЃСѓ вЂ” РѕРґРёРЅР°РєРѕРІРѕ СЂР°Р±РѕС‚Р°РµС‚ РґР»СЏ `createSettingsRange` Рё РґР»СЏ `GridSettings.js`) Рё РІРµС€Р°РµС‚: live-РѕР±РЅРѕРІР»РµРЅРёРµ `.settings-range-value` РЅР° `input` (СЋРЅРёС‚ РёР· `data-unit`); РґРІРѕР№РЅРѕР№ РєР»РёРє РїРѕ `.settings-range-wrapper` РѕС‚РєСЂС‹РІР°РµС‚ `.settings-range-edit` (РєР»Р°СЃСЃ `.editing` РЅР° wrapper), `Enter` РєР»Р°РјРїРїРёС‚ Р·РЅР°С‡РµРЅРёРµ РїРѕ `min`/`max` Рё РґРёСЃРїР°С‚С‡РёС‚ `input`+`change`, `Escape` РѕС‚РјРµРЅСЏРµС‚, `blur` РїСЂРёРјРµРЅСЏРµС‚.
- `styles/settings-panel.css`: С‚СЂРµРє СЃР»Р°Р№РґРµСЂР° С‚РѕР»С‰Рµ РїСЂРµР¶РЅРµРіРѕ (`height:9px`, `appearance:none`), `::-webkit-slider-thumb`/`::-moz-range-thumb` СЃРєСЂС‹С‚С‹ (`opacity:0`) вЂ” РєР»РёРє Рё РґСЂР°Рі РїРѕ С‚СЂРµРєСѓ СЂР°Р±РѕС‚Р°СЋС‚ РЅР°С‚РёРІРЅРѕ Р±РµР· РІРёРґРёРјРѕРіРѕ Р±РµРіСѓРЅРєР°; `.settings-range-value` вЂ” Р°Р±СЃРѕР»СЋС‚РЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РїРѕ С†РµРЅС‚СЂСѓ, `pointer-events:none`.
- Р”РѕР±Р°РІР»РµРЅР° С†РІРµС‚РЅР°СЏ Р·Р°Р»РёРІРєР° С‚СЂРµРєР° РґРѕ С‚РµРєСѓС‰РµРіРѕ Р·РЅР°С‡РµРЅРёСЏ (progress fill): `--range-fill` (CSS custom property, РїСЂРѕС†РµРЅС‚С‹) РЅР° `.settings-range-input`, РґР»СЏ Chrome/Edge/Safari вЂ” РіСЂР°РґРёРµРЅС‚ СЃ С…Р°СЂРґСЃС‚РѕРїРѕРј РЅР° `::-webkit-slider-runnable-track`, РґР»СЏ Firefox вЂ” РЅР°С‚РёРІРЅС‹Р№ `::-moz-range-progress`. `SettingsPanel.setupRangeSliders()` СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚ `--range-fill` СЃРѕ Р·РЅР°С‡РµРЅРёРµРј С‡РµСЂРµР· `updateFill()` РЅР° РєР°Р¶РґРѕРµ СЃРѕР±С‹С‚РёРµ `input` (РІ С‚.С‡. live-РґСЂР°Рі Рё РєРѕРјРјРёС‚ С‡РµСЂРµР· dblclick/СЂСѓС‡РЅРѕР№ РІРІРѕРґ). РЈРґР°Р»РµРЅРѕ РјС‘СЂС‚РІРѕРµ РїСЂР°РІРёР»Рѕ `.settings-input[type="range"] { width: 100%; }`, РїРѕР»РЅРѕСЃС‚СЊСЋ РїРµСЂРµРєСЂС‹С‚РѕРµ Р±РѕР»РµРµ СЃРїРµС†РёС„РёС‡РЅС‹Рј СЃРµР»РµРєС‚РѕСЂРѕРј.

### Fix вЂ” СЂРµРіСЂРµСЃСЃРёСЏ РІ Settings в†’ Colors: С†РІРµС‚РѕРІС‹Рµ СЃРІРѕС‚С‡Рё СЃС…Р»РѕРїС‹РІР°Р»РёСЃСЊ РґРѕ 1px

- **`SettingsPanel.filterSettingsContent()` РЅР° РєР°Р¶РґС‹Р№ СЂРµРЅРґРµСЂ С‚Р°Р±Р° СЃР±СЂР°СЃС‹РІР°Р» `row.style.display = ''` РґР»СЏ СЃС‚СЂРѕРє-РѕР±С‘СЂС‚РѕРє РїР°СЂР°РјРµС‚СЂРѕРІ** вЂ” СЌС‚Рѕ СЃС‚РёСЂР°Р»Рѕ РёРЅР»Р°Р№РЅ `display:flex` Сѓ РѕР±С‘СЂС‚РєРё С†РІРµС‚РѕРІРѕРіРѕ РёРЅРїСѓС‚Р° (`SettingsSectionConstructor.createSettingsColorInput`, inline-СЂРµР¶РёРј), РёР·-Р·Р° С‡РµРіРѕ СЃРІРѕС‚С‡Рё СЃС…Р»РѕРїС‹РІР°Р»РёСЃСЊ РґРѕ 1px Рё РІРµСЂС‚РёРєР°Р»СЊРЅР°СЏ СЂР°СЃРєР»Р°РґРєР° РєРѕР»РѕРЅРєРё Colors Р»РѕРјР°Р»Р°СЃСЊ. РСЃРїСЂР°РІР»РµРЅРѕ: РґРѕР±Р°РІР»РµРЅР° Р»РѕРєР°Р»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ `setRowVisible(el, visible)`, РєРѕС‚РѕСЂР°СЏ РїРµСЂРµРґ СЃРєСЂС‹С‚РёРµРј РєСЌС€РёСЂСѓРµС‚ РёСЃС…РѕРґРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ `style.display` РІ `el.dataset.searchOrigDisplay` Рё РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РёРјРµРЅРЅРѕ РµРіРѕ (Р° РЅРµ РїСѓСЃС‚СѓСЋ СЃС‚СЂРѕРєСѓ) РїСЂРё РїРѕРєР°Р·Рµ; РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє СЃС‚СЂРѕРєР°Рј-label, `.hotkey-item` Рё `.settings-section` (`src/ui/SettingsPanel.js`).

### Fix вЂ” СЂРµРѕСЂРґРµСЂ Р·Р°РєР»Р°РґРѕРє РїР°РЅРµР»Рё (drag-n-drop) РЅРµ СЃРѕС…СЂР°РЅСЏР»СЃСЏ Рё СЃР±СЂР°СЃС‹РІР°Р»СЃСЏ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё

- **`PanelPositionManager` РЅРёРєРѕРіРґР° РЅРµ РїРёСЃР°Р» `rightPanelTabOrder`/`leftPanelTabOrder` РІ `stateManager`/`userPrefs`** вЂ” РєР»СЋС‡Рё Рё СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃ РєРѕРЅС„РёРіРѕРј (`LevelEditor.js`: СЃРѕС…СЂР°РЅРµРЅРёРµ РЅР° `beforeunload`, РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РІ `applyTabOrderSettings()`) СЃСѓС‰РµСЃС‚РІРѕРІР°Р»Рё, РЅРѕ РЅРёС‡РµРіРѕ РЅРµ РІС‹Р·С‹РІР°Р»Рѕ Р·Р°РїРёСЃСЊ РїСЂРё СЂРµРѕСЂРґРµСЂРµ, Р° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРЅС‹Р№ РёР· РєРѕРЅС„РёРіР° РїРѕСЂСЏРґРѕРє РЅРёРєРѕРіРґР° РЅРµ РїСЂРёРјРµРЅСЏР»СЃСЏ Рє DOM С‚Р°Р±РѕРІ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё вЂ” `initializeTabPositions()` РІСЃРµРіРґР° СЃРѕР±РёСЂР°Р» С‚Р°Р±С‹ РІ С„РёРєСЃРёСЂРѕРІР°РЅРЅРѕРј РїРѕСЂСЏРґРєРµ `details, layers, outliner`. РСЃРїСЂР°РІР»РµРЅРѕ: РґРѕР±Р°РІР»РµРЅС‹ `savePanelTabOrder()` (РїРёС€РµС‚ С‚РµРєСѓС‰РёР№ DOM-РїРѕСЂСЏРґРѕРє С‚Р°Р±РѕРІ РїР°РЅРµР»Рё РІ state/userPrefs, РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· `moveTab()` Рё РёР· same-panel СЂРµРѕСЂРґРµСЂР° РІ `_globalTabMouseUp()`) Рё `applyPanelTabOrder()` (РїРµСЂРµСЃС‚Р°РІР»СЏРµС‚ DOM-С‚Р°Р±С‹ РїРѕ СЃРѕС…СЂР°РЅС‘РЅРЅРѕРјСѓ РїРѕСЂСЏРґРєСѓ, РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ РєРѕРЅС†Рµ `initializeTabPositions()`) (`src/ui/PanelPositionManager.js`). Р—Р°РѕРґРЅРѕ РїРѕРїСЂР°РІР»РµРЅ СЂР°СЃСЃРёРЅС…СЂРѕРЅ РґРµС„РѕР»С‚РЅРѕРіРѕ Р·РЅР°С‡РµРЅРёСЏ `"level"` в†’ `"layers"` РІ `config/defaults/panels.json` Рё `config/user/panels.json` (РЅРµ СЃРѕРІРїР°РґР°Р»Рѕ СЃ СЂРµР°Р»СЊРЅС‹Рј РёРјРµРЅРµРј С‚Р°Р±Р°, РёР·-Р·Р° С‡РµРіРѕ РґРµС„РѕР»С‚РЅС‹Р№ РїРѕСЂСЏРґРѕРє РЅРёРєРѕРіРґР° РЅРµ РјР°С‚С‡РёР»СЃСЏ).

### Fix вЂ” Layer Solo/Visibility РЅРµ РѕР±РЅРѕРІР»СЏР»Рё Outliner Р±РµР· РєР»РёРєР° РІ РєР°РЅРІР°СЃ

- **`LayersPanel.toggleLayerSolo()`/`toggleLayerVisibility()` РЅРµ РІС‹Р·С‹РІР°Р»Рё `outlinerPanel.render()`** вЂ” РёРєРѕРЅРєРё/С†РІРµС‚ СЃС‚СЂРѕРє Outliner Р·Р°РІРёСЃСЏС‚ РѕС‚ СЌС„С„РµРєС‚РёРІРЅРѕР№ РІРёРґРёРјРѕСЃС‚Рё СЃР»РѕСЏ (`ObjectOperations.isObjectEffectivelyVisible`), РЅРѕ РѕР±РЅРѕРІР»СЏР»РёСЃСЊ С‚РѕР»СЊРєРѕ РЅР° СЃР»РµРґСѓСЋС‰РµРј РЅРµ СЃРІСЏР·Р°РЅРЅРѕРј РґРµР№СЃС‚РІРёРё, РєРѕС‚РѕСЂРѕРµ СЃР»СѓС‡Р°Р№РЅРѕ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°Р»Рѕ Outliner (РєР»РёРє РїРѕ РєР°РЅРІР°СЃСѓ в†’ СЃРјРµРЅР° selection в†’ `updateAllPanels()`). `toggleLayerLock()` СѓР¶Рµ РґРµР»Р°Р» С‚Р°РєРѕР№ РІС‹Р·РѕРІ вЂ” solo/visibility Р±С‹Р»Рё Р±РµР· РЅРµРіРѕ. РСЃРїСЂР°РІР»РµРЅРѕ: РѕР±Р° РјРµС‚РѕРґР° С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°СЋС‚ `this.levelEditor.outlinerPanel.render()` СЃРёРЅС…СЂРѕРЅРЅРѕ (`src/ui/LayersPanel.js`).

### Feature вЂ” РїРѕРёСЃРє РїР°СЂР°РјРµС‚СЂР° РїРѕ РёРјРµРЅРё РІ С€Р°РїРєРµ РѕРєРЅР° Settings-РїР°РЅРµР»Рё

- РћРґРёРЅ РёРЅРїСѓС‚ `#settings-search-input` РІ С€Р°РїРєРµ РѕРєРЅР° Settings (`.settings-header-controls`, СЂСЏРґРѕРј СЃ РєРЅРѕРїРєРѕР№ `в‹®`), СЃРѕР·РґР°С‘С‚СЃСЏ РІ `SettingsPanel.createSettingsPanel()` С‡РµСЂРµР· `SearchUtils.createSearchInput(...).outerHTML` (`src/ui/SettingsPanel.js`).
- `SettingsPanel.filterSettingsContent(term)` С„РёР»СЊС‚СЂСѓРµС‚ РІСЃС‘ СЃРѕРґРµСЂР¶РёРјРѕРµ `#settings-content` С‚РµРєСѓС‰РµР№ РѕС‚РєСЂС‹С‚РѕР№ РІРєР»Р°РґРєРё С†РµР»РёРєРѕРј (Р° РЅРµ РѕРґРЅСѓ СЃРµРєС†РёСЋ): СЃРєСЂС‹РІР°РµС‚/РїРѕРєР°Р·С‹РІР°РµС‚ `label.parentElement` РґР»СЏ РєР°Р¶РґРѕРіРѕ `<label>`, РѕС‚РґРµР»СЊРЅРѕ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚ `.hotkey-item`/`.hotkey-description` РІРєР»Р°РґРєРё Hotkeys, СЃРєСЂС‹РІР°РµС‚ `.settings-section` С†РµР»РёРєРѕРј РїСЂРё 0 РІРёРґРёРјС‹С… СЃС‚СЂРѕРє. Р’С‹Р·С‹РІР°РµС‚СЃСЏ РёР· `setupSettingsInputs()` РїСЂРё РєР°Р¶РґРѕРј СЂРµРЅРґРµСЂРµ/СЃРјРµРЅРµ РІРєР»Р°РґРєРё. Р Р°Р±РѕС‚Р°РµС‚ РЅР° РІСЃРµС… РІРєР»Р°РґРєР°С…, РІРєР»СЋС‡Р°СЏ Grid & Snapping.
- Escape РґРІСѓС…СЃС‚СѓРїРµРЅС‡Р°С‚С‹Р№: РїРµСЂРІРѕРµ РЅР°Р¶Р°С‚РёРµ СЃ РЅРµРїСѓСЃС‚С‹Рј С‚РµРєСЃС‚РѕРј С‚РѕР»СЊРєРѕ РѕС‡РёС‰Р°РµС‚ РїРѕР»Рµ (`stopPropagation` РІ РѕС‚РґРµР»СЊРЅРѕРј keydown-listener, РІРµС€Р°РµС‚СЃСЏ СЂР°РЅСЊС€Рµ `SearchUtils.setupSearchListeners`), РІС‚РѕСЂРѕРµ (СѓР¶Рµ РїСѓСЃС‚РѕРµ РїРѕР»Рµ) Р·Р°РєСЂС‹РІР°РµС‚ РїР°РЅРµР»СЊ РєР°Рє СЂР°РЅСЊС€Рµ.
- `createSettingsSection(title, content, options)` РїРѕРёСЃРє РІ С€Р°РїРєСѓ СЃРµРєС†РёРё Р±РѕР»СЊС€Рµ РЅРµ РґРѕР±Р°РІР»СЏРµС‚ (РїСЂРѕСЃС‚РѕР№ `<h4>{title}</h4>`); СЃРµРєС†РёСЏ РІСЃРµРіРґР° РїРѕР»СѓС‡Р°РµС‚ РєР»Р°СЃСЃ `settings-section` (РјР°СЂРєРµСЂ РґР»СЏ `filterSettingsContent`, СЂР°РЅРµРµ РєР»Р°СЃСЃ Р±С‹Р» РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Рј) (`src/ui/panel-structures/SettingsSectionConstructor.js`).
- `ResetRegistry.handleBackspace()` (`src/utils/ResetRegistry.js`): РґРѕР±Р°РІР»РµРЅ Р±Р°Р№РїР°СЃ вЂ” Backspace РЅР°Рґ СЃС„РѕРєСѓСЃРёСЂРѕРІР°РЅРЅС‹Рј РЅРµСЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рј С‚РµРєСЃС‚РѕРІС‹Рј `input`/`textarea` (РЅР°РїСЂРёРјРµСЂ, РїРѕРёСЃРєРѕРј РІ С€Р°РїРєРµ Settings) РІСЃРµРіРґР° РїСЂРѕСЃС‚Рѕ СѓРґР°Р»СЏРµС‚ СЃРёРјРІРѕР», РЅРµ СЃР±СЂР°СЃС‹РІР°СЏ resettable-РїРѕР»СЏ С‚РµРєСѓС‰РµР№ РІРєР»Р°РґРєРё, РєРѕС‚РѕСЂС‹Рµ С‚РµС…РЅРёС‡РµСЃРєРё Р»РµР¶Р°С‚ РІРЅСѓС‚СЂРё С‚РѕРіРѕ Р¶Рµ РєРѕРЅС‚РµР№РЅРµСЂР°.

### Fix вЂ” РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ Р·Р°РєР»Р°РґРєРё РІРЅСѓС‚СЂРё РїР°РЅРµР»Рё Р°РєС‚РёРІРёСЂРѕРІР°Р»Рѕ СЃРѕСЃРµРґРЅСЋСЋ РїР°РЅРµР»СЊ Р±РµР· РЅР°РґРѕР±РЅРѕСЃС‚Рё

- **`PanelPositionManager._installGlobalTabDragHandlers()` РІС‹Р·С‹РІР°Р» `togglePanel(otherSide)` СЃСЂР°Р·Сѓ РЅР° mousedown**, РµС‰С‘ РґРѕ С‚РѕРіРѕ РєР°Рє СЃС‚Р°Р»Рѕ РёР·РІРµСЃС‚РЅРѕ, СЂРµРѕСЂРґРµСЂ СЌС‚Рѕ РІРЅСѓС‚СЂРё С‚РµРєСѓС‰РµР№ РїР°РЅРµР»Рё РёР»Рё РїРµСЂРµРЅРѕСЃ РІ РґСЂСѓРіСѓСЋ вЂ” СЃРѕСЃРµРґРЅСЏСЏ (СЃРєСЂС‹С‚Р°СЏ) РїР°РЅРµР»СЊ СЃРѕР·РґР°РІР°Р»Р°СЃСЊ Рё РїРѕСЏРІР»СЏР»Р°СЃСЊ РїСЂРё Р»СЋР±РѕРј РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё Р·Р°РєР»Р°РґРєРё, РґР°Р¶Рµ РїСЂРё РїСЂРѕСЃС‚РѕР№ СЃРјРµРЅРµ РјРµСЃС‚ Р·Р°РєР»Р°РґРѕРє РІРЅСѓС‚СЂРё СЃРІРѕРµР№ РїР°РЅРµР»Рё. РСЃРїСЂР°РІР»РµРЅРѕ: СЃРѕР·РґР°РЅРёРµ/РїРѕРєР°Р· СЃРѕСЃРµРґРЅРµР№ РїР°РЅРµР»Рё РїРµСЂРµРЅРµСЃРµРЅРѕ РІ `_globalTabMouseMove` Рё РїСЂРѕРёСЃС…РѕРґРёС‚ С‚РѕР»СЊРєРѕ РєРѕРіРґР° РєСѓСЂСЃРѕСЂ РІС‹С…РѕРґРёС‚ Р·Р° `getBoundingClientRect()` СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РїР°РЅРµР»Рё; РµСЃР»Рё РєСѓСЂСЃРѕСЂ СЃ РіРѕСЃС‚-С‚Р°Р±РѕРј РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ РѕР±СЂР°С‚РЅРѕ РІ СЂРѕРґРЅСѓСЋ РїР°РЅРµР»СЊ, Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°РЅРЅР°СЏ СЃРѕСЃРµРґРЅСЏСЏ РїР°РЅРµР»СЊ РЅРµРјРµРґР»РµРЅРЅРѕ СѓРґР°Р»СЏРµС‚СЃСЏ С‡РµСЂРµР· `removeEmptyPanel()`, РЅРµ РґРѕР¶РёРґР°СЏСЃСЊ `mouseup` (`src/ui/PanelPositionManager.js`).

### Fix вЂ” РёРєРѕРЅРєР°/С†РІРµС‚ РіР»Р°Р·Р° РѕР±СЉРµРєС‚Р° РІ Outliner РЅРµ РѕР±РЅРѕРІР»СЏР»РёСЃСЊ, РїРѕРєР° СЃС‚СЂРѕРєР° РІС‹РґРµР»РµРЅР°

- **`.outliner-item.selected * { color: ... !important; }` (styles/main.css) РїРµСЂРµР±РёРІР°Р» РёРЅР»Р°Р№РЅ-С†РІРµС‚**, РєРѕС‚РѕСЂС‹Р№ `OutlinerPanel.updateVisibilityButton()` РІС‹СЃС‚Р°РІР»СЏР» С‡РµСЂРµР· `svg.style.color`/`nameSpan.style.color` РґР»СЏ Object Solo (РѕСЂР°РЅР¶РµРІС‹Р№) Рё СЃРєСЂС‹С‚С‹С… РѕР±СЉРµРєС‚РѕРІ (СЃРµСЂС‹Р№) вЂ” РїРѕРєР° СЃС‚СЂРѕРєР° РѕСЃС‚Р°РІР°Р»Р°СЃСЊ РІС‹РґРµР»РµРЅРЅРѕР№, CSS `!important` РїРѕР»РЅРѕСЃС‚СЊСЋ РјР°СЃРєРёСЂРѕРІР°Р» СѓР¶Рµ РєРѕСЂСЂРµРєС‚РЅРѕ РІС‹С‡РёСЃР»РµРЅРЅС‹Р№ С†РІРµС‚; РєР»РёРє РїРѕ РєР°РЅРІР°СЃСѓ (РѕР±С‹С‡РЅРѕ СЃРЅРёРјР°СЋС‰РёР№ РІС‹РґРµР»РµРЅРёРµ) СѓР±РёСЂР°Р» РјР°СЃРєСѓ, Рё С†РІРµС‚ "РІРЅРµР·Р°РїРЅРѕ" РїРѕСЏРІР»СЏР»СЃСЏ вЂ” РѕС‚СЃСЋРґР° РІРїРµС‡Р°С‚Р»РµРЅРёРµ "СЃС‚РёР»Рё РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РєР»РёРєР° РІ СЂР°Р±РѕС‡СѓСЋ РѕР±Р»Р°СЃС‚СЊ", С…РѕС‚СЏ Р»РѕРіРёРєР° РІС‹С‡РёСЃР»РµРЅРёСЏ СЃР°РјРѕРіРѕ С†РІРµС‚Р° Р±С‹Р»Р° РІРµСЂРЅР° СЃ СЃР°РјРѕРіРѕ РЅР°С‡Р°Р»Р°. РСЃРїСЂР°РІР»РµРЅРѕ: РґР»СЏ РѕС‚РєР»РѕРЅСЏСЋС‰РёС…СЃСЏ РѕС‚ РґРµС„РѕР»С‚Р° СЃРѕСЃС‚РѕСЏРЅРёР№ (soloed/СЃРєСЂС‹С‚) `updateVisibilityButton()` С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `style.setProperty('color', value, 'important')` вЂ” СЃРІРѕР№ `!important` РїРѕР±РµР¶РґР°РµС‚ РЅР°Рґ `!important` РёР· `.selected *` (РёРЅР»Р°Р№РЅ-СЃС‚РёР»СЊ РёРјРµРµС‚ РїСЂРёРѕСЂРёС‚РµС‚ РїСЂРё СЂР°РІРЅРѕРј СѓСЂРѕРІРЅРµ РІР°Р¶РЅРѕСЃС‚Рё); РґР»СЏ РѕР±С‹С‡РЅРѕРіРѕ РІРёРґРёРјРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ вЂ” `style.removeProperty('color')`, РѕС‚РґР°РІР°СЏ С†РІРµС‚ РѕР±СЂР°С‚РЅРѕ РїРѕРґ СѓРїСЂР°РІР»РµРЅРёРµ CSS-РєР°СЃРєР°РґР° (РІС‹РґРµР»РµРЅРёРµ РїРѕ-РїСЂРµР¶РЅРµРјСѓ РєСЂР°СЃРёС‚ С‚РµРєСЃС‚ РІ Р±РµР»С‹Р№ РєР°Рє СЂР°РЅСЊС€Рµ) (`src/ui/OutlinerPanel.js`).

### Fix вЂ” Focus layers search РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р» РёР·-Р·Р° Р±СЂР°СѓР·РµСЂРЅРѕРіРѕ Ctrl+L

- **`ui.focusLayersSearch` Р±С‹Р» РїСЂРёРІСЏР·Р°РЅ Рє `Ctrl/Cmd+L`** вЂ” Р±СЂР°СѓР·РµСЂ Р·Р°Р±РёСЂР°РµС‚ СЌС‚Сѓ РєРѕРјР±РёРЅР°С†РёСЋ СЃРµР±Рµ, РїРѕСЌС‚РѕРјСѓ СЃРѕР±С‹С‚РёРµ РЅРµ РґРѕС…РѕРґРёР»Рѕ РґРѕ СЂРµРґР°РєС‚РѕСЂР°. РџРµСЂРµРІС‘Р» РґРµС„РѕР»С‚ РЅР° `Ctrl+Alt+L` Рё РґРѕР±Р°РІРёР» РјРёРіСЂР°С†РёСЋ СЃС‚Р°СЂС‹С… СЃРѕС…СЂР°РЅС‘РЅРЅС‹С… РЅР°СЃС‚СЂРѕРµРє РІ `ConfigManager.migrateShortcuts()` (`config/defaults/shortcuts.json`, `src/managers/ConfigManager.js`).

### Fix вЂ” _matchesShortcut РёРіРЅРѕСЂРёСЂРѕРІР°Р» metaKey (Mac Cmd+key СЃР»РѕРјР°РЅ) Рё Ctrl+N fallback

- **`_matchesShortcut` СЃСЂР°РІРЅРёРІР°Р» `e.ctrlKey` Рё `e.metaKey` РЅРµР·Р°РІРёСЃРёРјРѕ** вЂ” РЅР° Mac РІСЃРµ `Cmd+Z/S/N/O` РїРµСЂРµСЃС‚Р°РІР°Р»Рё СЂР°Р±РѕС‚Р°С‚СЊ, РїРѕС‚РѕРјСѓ С‡С‚Рѕ shortcuts.json РёСЃРїРѕР»СЊР·СѓРµС‚ `ctrlKey:true`, Р° Mac РѕС‚РїСЂР°РІР»СЏРµС‚ `metaKey=true, ctrlKey=false`. РСЃРїСЂР°РІР»РµРЅРѕ: `(e.ctrlKey || e.metaKey)` СЃСЂР°РІРЅРёРІР°РµС‚СЃСЏ СЃ `(def.ctrlKey || def.metaKey)`. РЈР±СЂР°РЅР° РѕС‚РґРµР»СЊРЅР°СЏ РїСЂРѕРІРµСЂРєР° `metaKey` вЂ” РѕРЅР° РЅРµ РЅСѓР¶РЅР°.
- **`Ctrl+N` (Р±РµР· Alt) РїРµСЂРµСЃС‚Р°Р» РѕС‚РєСЂС‹РІР°С‚СЊ РЅРѕРІС‹Р№ СѓСЂРѕРІРµРЅСЊ** вЂ” РїСЂРё keyboard lock РІ fullscreen Р±СЂР°СѓР·РµСЂ РїСЂРѕРїСѓСЃРєР°РµС‚ `Ctrl+N` РІ РїСЂРёР»РѕР¶РµРЅРёРµ, РЅРѕ РїРѕСЃР»Рµ СЂРµС„Р°РєС‚РѕСЂР° С‚СЂРµР±РѕРІР°Р»СЃСЏ С‚РѕС‡РЅС‹Р№ РјР°С‚С‡ `Ctrl+Alt+N` РёР· РєРѕРЅС„РёРіР°. Р”РѕР±Р°РІР»РµРЅ СЏРІРЅС‹Р№ fallback `(e.ctrlKey||e.metaKey) && !e.altKey && !e.shiftKey && key==='n'` (`src/event-system/EventHandlers.js`, `src/ui/LayersPanel.js`).



- **`applySavedViewStates()` РѕР±РЅРѕРІР»СЏР»Р° DOM С‡РµСЂРµР· `applyPanelVisibility`, РЅРѕ РЅРµ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°Р»Р° `stateManager`** вЂ” РїРѕСЃР»Рµ `stateManager.reset()` РІ `newLevel()` СЃРѕСЃС‚РѕСЏРЅРёРµ `view.console` СЃР±СЂР°СЃС‹РІР°Р»РѕСЃСЊ РІ РґРµС„РѕР»С‚ `true`; РїСЂРё СЃР»РµРґСѓСЋС‰РµРј `saveViewStates()` С‡РёС‚Р°Р»СЃСЏ `true` РёР· СЃС‚РµР№С‚Р° (Р° РЅРµ `false` РєР°Рє РІ DOM), Рё РєРѕРЅСЃРѕР»СЊ РѕС‚РєСЂС‹РІР°Р»Р°СЃСЊ РїСЂРё `applySavedViewStates` РЅР° РІС‚РѕСЂРѕРј РІС‹Р·РѕРІРµ. Р¤РёРєСЃ: РґРѕР±Р°РІР»РµРЅ `stateManager.set('view.${option}', enabled)` РїРµСЂРµРґ `applyPanelVisibility` (`src/event-system/EventHandlers.js`).

### Refactor вЂ” СѓР±СЂР°РЅС‹ С…Р°СЂРґРєРѕРґРЅС‹Рµ С…РѕС‚РєРµРё РёР· handleKeyDown Рё LayersPanel

- **Р’СЃРµ С…РѕС‚РєРµРё РІ `EventHandlers.handleKeyDown` Рё `LayersPanel.setupKeyboardShortcuts` Р±С‹Р»Рё Р·Р°С…Р°СЂРґРєРѕР¶РµРЅС‹** вЂ” СЂРµР±РёРЅРґ С‡РµСЂРµР· Settings в†’ Hotkeys РЅРµ РґР°РІР°Р» СЌС„С„РµРєС‚Р°. Р”РѕР±Р°РІР»РµРЅ `EventHandlers._matchesShortcut(e, category, action)`, С‡РёС‚Р°СЋС‰РёР№ Р±РёРЅРґРёРЅРі РёР· `configManager.getShortcuts()`; `handleKeyDown` РїРѕР»РЅРѕСЃС‚СЊСЋ РїРµСЂРµРІРµРґС‘РЅ РЅР° data-driven РїСЂРѕРІРµСЂРєРё; `LayersPanel.setupKeyboardShortcuts` Р°РЅР°Р»РѕРіРёС‡РЅРѕ С‡РёС‚Р°РµС‚ `configManager.getShortcuts().ui` (`src/event-system/EventHandlers.js`, `src/ui/LayersPanel.js`).

### Fix вЂ” СЃРєСЂС‹С‚С‹Рµ С‡РµСЂРµР· H РѕР±СЉРµРєС‚С‹ РѕСЃС‚Р°РІР°Р»РёСЃСЊ РІ selection

- **`ObjectOperations.toggleVisibilityForSelection()` (H) РЅРµ СЃРЅРёРјР°Р»Р° РІС‹РґРµР»РµРЅРёРµ СЃ РѕР±СЉРµРєС‚РѕРІ, РєРѕС‚РѕСЂС‹Рµ РІ СЂРµР·СѓР»СЊС‚Р°С‚Рµ toggle СЃС‚Р°Р»Рё СЃРєСЂС‹С‚С‹РјРё** вЂ” РЅРµРІРёРґРёРјС‹Р№ РѕР±СЉРµРєС‚ РЅРµ РґРѕР»Р¶РµРЅ РѕСЃС‚Р°РІР°С‚СЊСЃСЏ selected (РЅРµ СЃ С‡РµРј РІР·Р°РёРјРѕРґРµР№СЃС‚РІРѕРІР°С‚СЊ РЅР° РєР°РЅРІРµ, gizmo/handles СЂРёСЃРѕРІР°С‚СЊ РЅРµ РЅР°Рґ С‡РµРј). Р¤РёРєСЃ: РїРѕСЃР»Рµ toggle СЃРµР»РµРєС‚ РїРµСЂРµСЃРѕР±РёСЂР°РµС‚СЃСЏ С„РёР»СЊС‚СЂРѕРј РїРѕ Р°РєС‚СѓР°Р»СЊРЅРѕРјСѓ `obj.visible` РєР°Р¶РґРѕРіРѕ СЂР°РЅРµРµ РІС‹Р±СЂР°РЅРЅРѕРіРѕ id вЂ” СЌС‚Рѕ Р·Р°РѕРґРЅРѕ РєРѕСЂСЂРµРєС‚РЅРѕ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚ РїРѕС‚РѕРјРєРѕРІ, СЃРєСЂС‹С‚С‹С… С‚РѕР»СЊРєРѕ РєР°СЃРєР°РґРѕРј РѕС‚ СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РіСЂСѓРїРїС‹ (`toggleObjectVisibility`), Рё СЃРјРµС€Р°РЅРЅС‹Р№ РІС‹Р±РѕСЂ (С‡Р°СЃС‚СЊ РѕР±СЉРµРєС‚РѕРІ СЃС‚Р°РЅРѕРІРёС‚СЃСЏ РІРёРґРёРјРѕР№, С‡Р°СЃС‚СЊ СЃРєСЂС‹С‚РѕР№) Р±РµР· РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕР№ Р»РѕРіРёРєРё (`src/core/ObjectOperations.js`). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: РІС‹Р±СЂР°РЅРЅС‹Р№ РѕР±СЉРµРєС‚ РїРѕСЃР»Рµ H РѕСЃС‚Р°С‘С‚СЃСЏ `visible:false` Рё РїСЂРѕРїР°РґР°РµС‚ РёР· `selectedObjects`.

### Fix вЂ” marquee-drag РІС‹РґРµР»РµРЅРёРµ РїРѕРІС‘СЂРЅСѓС‚С‹С… РѕР±СЉРµРєС‚РѕРІ/РіСЂСѓРїРї РїСЂРѕРІРµСЂСЏР»РѕСЃСЊ РїРѕ AABB РІРјРµСЃС‚Рѕ РёСЃС‚РёРЅРЅРѕР№ РїРѕРІС‘СЂРЅСѓС‚РѕР№ С„РѕСЂРјС‹

- **`MouseHandlers.getObjectsInMarquee()`: РґР»СЏ РЅР°СЃС‚РѕСЏС‰РµРіРѕ drag (РЅРµ РґР»СЏ РїР»РѕСЃРєРѕРіРѕ РєР»РёРєР°, СЃРј. С„РёРєСЃ РЅРёР¶Рµ) РїРµСЂРµСЃРµС‡РµРЅРёРµ marquee-РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° СЃ РѕР±СЉРµРєС‚РѕРј РїСЂРѕРІРµСЂСЏР»РѕСЃСЊ С‡РµСЂРµР· plain AABB-overlap** вЂ” РґР»СЏ РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ РѕР±СЉРµРєС‚Р°/РіСЂСѓРїРїС‹ AABB Р±РѕР»СЊС€Рµ РёСЃС‚РёРЅРЅРѕР№ С„РѕСЂРјС‹, РїРѕСЌС‚РѕРјСѓ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ СЂР°РјРєРё РІС‹РґРµР»РµРЅРёСЏ С‡РµСЂРµР· "РїСѓСЃС‚РѕР№" СѓРіРѕР» AABB (РјРёРјРѕ СЂРµР°Р»СЊРЅРѕР№ РєР°СЂС‚РёРЅРєРё) РѕС€РёР±РѕС‡РЅРѕ РІРєР»СЋС‡Р°Р»Рѕ РѕР±СЉРµРєС‚ РІ РІС‹РґРµР»РµРЅРёРµ. Р”РѕР±Р°РІР»РµРЅ `WorldPositionUtils.rectIntersectsGeometry(minX, minY, maxX, maxY, geom)` вЂ” С‚РѕС‡РЅС‹Р№ С‚РµСЃС‚ РїРµСЂРµСЃРµС‡РµРЅРёСЏ РѕСЃРµРІРѕРіРѕ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° СЃ РїРѕРІС‘СЂРЅСѓС‚С‹Рј С‡РµСЂРµР· Separating Axis Theorem (4 РѕСЃРё: 2 РѕС‚ AABB, 2 РѕС‚ РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° РїСЂРё `rotationDeg !== 0`), РёСЃРїРѕР»СЊР·СѓРµС‚ С‚Сѓ Р¶Рµ РіРµРѕРјРµС‚СЂРёСЋ `getHitTestGeometry`, С‡С‚Рѕ Рё РєР»РёРє вЂ” РіР°СЂР°РЅС‚РёСЂСѓРµС‚ РёРґРµРЅС‚РёС‡РЅСѓСЋ РѕР±Р»Р°СЃС‚СЊ РјРµР¶РґСѓ РєР»РёРєРѕРј Рё drag-РІС‹РґРµР»РµРЅРёРµРј. Parallax-СЃРјРµС‰РµРЅРёРµ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Рє `geom.cx/cy` РїРµСЂРµРґ РїСЂРѕРІРµСЂРєРѕР№ (С‚Р° Р¶Рµ РїРѕРїСЂР°РІРєР°, С‡С‚Рѕ СЂР°РЅСЊС€Рµ РґРµР»Р°Р»Р° `getObjectWorldBoundsWithParallax` РґР»СЏ bounds). РќР°СЃС‚РѕСЏС‰РёР№ drag СЃ РїРѕР»РЅС‹Рј РѕС…РІР°С‚РѕРј РѕР±СЉРµРєС‚Р° РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ РєР°Рє СЂР°РЅСЊС€Рµ. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ С‡РµСЂРµР· СЂРµР°Р»СЊРЅС‹Рµ `mousedown`+`mousemove`Г—2+`mouseup` DOM-СЃРѕР±С‹С‚РёСЏ (РЅРµ РїСЂСЏРјС‹Рµ РІС‹Р·РѕРІС‹): СЃРёСЃС‚РµРјР°С‚РёС‡РµСЃРєРёР№ СЃРІРµР¶РµРї 837 Р±РѕРєСЃРѕРІ РІРѕРєСЂСѓРі РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ СЃРїСЂР°Р№С‚Р° (45В°) РїСЂРѕС‚РёРІ С‚РѕС‡РЅРѕР№ СЌС‚Р°Р»РѕРЅРЅРѕР№ РіРµРѕРјРµС‚СЂРёРё (СЃСЌРјРїР»РёРЅРі С‚РѕС‡РµРє + СЂС‘Р±РµСЂ) вЂ” 0 РЅРµСЃРѕРІРїР°РґРµРЅРёР№; РІР»РѕР¶РµРЅРЅР°СЏ РїРѕРІС‘СЂРЅСѓС‚Р°СЏ РіСЂСѓРїРїР° (A 30В°в†’B 45В°) вЂ” СЂР°РјРєР° РІ РїСѓСЃС‚РѕРј СѓРіР»Сѓ AABB РєРѕСЂСЂРµРєС‚РЅРѕ РЅРµ РІС‹РґРµР»СЏРµС‚, СЂР°РјРєР° С‡РµСЂРµР· С†РµРЅС‚СЂ вЂ” РІС‹РґРµР»СЏРµС‚ (`src/utils/WorldPositionUtils.js`, `src/event-system/MouseHandlers.js`).

### Fix вЂ” РєР»РёРє РїРѕ РїРѕРІС‘СЂРЅСѓС‚РѕРјСѓ РѕР±СЉРµРєС‚Сѓ/РіСЂСѓРїРїРµ РІСЃС‘ РµС‰С‘ РїСЂРѕРІРµСЂСЏР»СЃСЏ РїРѕ РѕСЃРµРІРѕРјСѓ (РЅРµ РїРѕРІС‘СЂРЅСѓС‚РѕРјСѓ) bounding box

- **Р РµР°Р»СЊРЅС‹Р№ РєРѕСЂРµРЅСЊ Р±Р°РіР°, РёР·-Р·Р° РєРѕС‚РѕСЂРѕРіРѕ Р·РѕРЅР° РєР»РёРєР° "РѕСЃС‚Р°РІР°Р»Р°СЃСЊ РєРІР°РґСЂР°С‚РЅРѕР№" РЅР° РїРѕРІС‘СЂРЅСѓС‚С‹С… РѕР±СЉРµРєС‚Р°С…, РЅРµСЃРјРѕС‚СЂСЏ РЅР° СѓР¶Рµ РёСЃРїСЂР°РІР»РµРЅРЅС‹Р№ `isPointInWorldBounds`** вЂ” РѕР±С‹С‡РЅС‹Р№ РєР»РёРє (mousedown+mouseup Р±РµР· РґРІРёР¶РµРЅРёСЏ) РёРґС‘С‚ РќР• С‚РѕР»СЊРєРѕ С‡РµСЂРµР· `findObjectAtPoint` (РѕРЅ РєРѕСЂСЂРµРєС‚РЅРѕ РЅР°С…РѕРґРёР» РѕР±СЉРµРєС‚ РёР»Рё РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕР·РІСЂР°С‰Р°Р» `null`), Р° РїСЂРё РїСЂРѕРјР°С…Рµ вЂ” С‡РµСЂРµР· `MouseHandlers.handleEmptyClick()`, РєРѕС‚РѕСЂС‹Р№ Р±РµР·СѓСЃР»РѕРІРЅРѕ РѕС‚РєСЂС‹РІР°РµС‚ marquee-РІС‹РґРµР»РµРЅРёРµ РЅСѓР»РµРІРѕРіРѕ СЂР°Р·РјРµСЂР° РІ С‚РѕС‡РєРµ РєР»РёРєР°; РЅР° mouseup `finishMarqueeSelection()` СЌС‚Сѓ С‚РѕС‡РєСѓ РїСЂРѕРІРµСЂСЏР» С‡РµСЂРµР· **AABB**-РїРµСЂРµСЃРµС‡РµРЅРёРµ (`getObjectWorldBoundsWithParallax` + rect-overlap), Р° РЅРµ С‡РµСЂРµР· РїРѕРІС‘СЂРЅСѓС‚С‹Р№ С…РёС‚-С‚РµСЃС‚. Р”Р»СЏ РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ РѕР±СЉРµРєС‚Р°/РіСЂСѓРїРїС‹ AABB РІСЃРµРіРґР° Р±РѕР»СЊС€Рµ РёСЃС‚РёРЅРЅРѕР№ С„РѕСЂРјС‹ вЂ” РєР»РёРє РІ "РїСѓСЃС‚РѕРј" СѓРіР»Сѓ AABB (РјРёРјРѕ СЂРµР°Р»СЊРЅРѕР№ РєР°СЂС‚РёРЅРєРё) РІСЃС‘ СЂР°РІРЅРѕ РїРѕРїР°РґР°Р» РІ rect-overlap Рё РІС‹РґРµР»СЏР» РѕР±СЉРµРєС‚, РїРµСЂРµРѕРїСЂРµРґРµР»СЏСЏ РєРѕСЂСЂРµРєС‚РЅРѕРµ СЂРµС€РµРЅРёРµ, СѓР¶Рµ РїСЂРёРЅСЏС‚РѕРµ `findObjectAtPoint` РЅР° mousedown. РСЃРїСЂР°РІР»РµРЅРѕ: `getObjectsInMarquee()` С‚РµРїРµСЂСЊ РїСЂРё РІС‹СЂРѕР¶РґРµРЅРЅРѕРј (0Г—0) marquee-rect РёСЃРїРѕР»СЊР·СѓРµС‚ С‚РѕС‡РЅС‹Р№ `ObjectOperations.isPointInObject()` РЅР° РєР°РЅРґРёРґР°С‚ РІРјРµСЃС‚Рѕ AABB-overlap; РїСЂРё РЅР°СЃС‚РѕСЏС‰РµРј drag (rect СЃ РЅРµРЅСѓР»РµРІС‹Рј СЂР°Р·РјРµСЂРѕРј) РїРѕРІРµРґРµРЅРёРµ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ вЂ” AABB-overlap РґР»СЏ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРѕРіРѕ РјСѓР»СЊС‚Рё-РІС‹РґРµР»РµРЅРёСЏ РѕСЃС‚Р°РІР»РµРЅ РєР°Рє РµСЃС‚СЊ (РѕР±С‹С‡РЅР°СЏ РїСЂР°РєС‚РёРєР° РґР»СЏ marquee, С‚РѕС‡РЅСѓСЋ РїРѕР»РёРіРѕРЅ-РІ-РїРѕРІС‘СЂРЅСѓС‚С‹Р№-rect РїСЂРѕРІРµСЂРєСѓ РґРµР»Р°С‚СЊ РёР·Р±С‹С‚РѕС‡РЅРѕ). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ СЂРµР°Р»СЊРЅС‹РјРё DOM mousedown/mouseup СЃРѕР±С‹С‚РёСЏРјРё (РЅРµ РїСЂСЏРјС‹Рј РІС‹Р·РѕРІРѕРј `isPointInObject`, С‡С‚РѕР±С‹ РЅРµ РїСЂРѕРїСѓСЃС‚РёС‚СЊ РёРјРµРЅРЅРѕ СЌС‚РѕС‚ Р±Р°Рі): РєР»РёРє РІ СѓРіР»Сѓ AABB РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ СЃРїСЂР°Р№С‚Р° (45В°) Рё РїРѕРІС‘СЂРЅСѓС‚РѕР№ РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїС‹ (A 30В°в†’B 45В°) вЂ” РІС‹РґРµР»РµРЅРёРµ РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°РµС‚; РєР»РёРє РїРѕ С†РµРЅС‚СЂСѓ вЂ” СЃСЂР°Р±Р°С‚С‹РІР°РµС‚; РїРѕР»РЅРѕС†РµРЅРЅС‹Р№ marquee-drag (СЃ РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹РјРё `mousemove`) РїРѕ-РїСЂРµР¶РЅРµРјСѓ РІС‹РґРµР»СЏРµС‚ РѕР±СЉРµРєС‚С‹ РІРЅСѓС‚СЂРё РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєР° (`src/event-system/MouseHandlers.js`, `finishMarqueeSelection`/`getObjectsInMarquee`).

### Fix вЂ” РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ Р·Р°РєСЂС‹РІР°Р»РёСЃСЊ РїСЂРё resize РѕРєРЅР°

- **`BaseContextMenu.setupWindowResizeHandler()` РІС‹Р·С‹РІР°Р» `hideMenu()` РЅР° РєР°Р¶РґС‹Р№ `window.resize`**, РёР·-Р·Р° С‡РµРіРѕ Р»СЋР±РѕРµ РѕС‚РєСЂС‹С‚РѕРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ (canvas, layers, outliner, assets, console вЂ” РІСЃРµ РЅР°СЃР»РµРґРЅРёРєРё `BaseContextMenu`) РїСЂРѕРїР°РґР°Р»Рѕ РїСЂРё РјР°Р»РµР№С€РµРј РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂР° РѕРєРЅР°. Р—Р°РјРµРЅРµРЅРѕ РЅР° `repositionMenuWithinViewport()` вЂ” РєР»Р°РјРїРёС‚ `left`/`top` РѕС‚РєСЂС‹С‚РѕРіРѕ РјРµРЅСЋ РІ РіСЂР°РЅРёС†С‹ РЅРѕРІРѕРіРѕ viewport (РјРµРЅСЋ `position: fixed`), РЅРµ Р·Р°РєСЂС‹РІР°СЏ РµРіРѕ (`src/ui/BaseContextMenu.js`).

### Fix вЂ” РґРёР°Р»РѕРіРѕРІС‹Рµ РѕРєРЅР° (Settings, Actor Properties) Р·Р°РєСЂС‹РІР°Р»РёСЃСЊ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё СЂСѓС‡РєРё resize

- **Drag Р·Р° resize-handle РґРёР°Р»РѕРіР° (`DialogResizer`) РјРѕРі Р·Р°РєСЂС‹С‚СЊ РІРµСЃСЊ РґРёР°Р»РѕРі**, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р±С‹СЃС‚СЂРѕ С‚СЏРЅСѓР» РјС‹С€СЊ Рё РѕС‚РїСѓСЃРєР°Р» РµС‘ Р·Р° РїСЂРµРґРµР»Р°РјРё РґРёР°Р»РѕРіР° вЂ” РЅР°Рґ С„РѕРЅРѕРј РѕРІРµСЂР»РµСЏ. РџСЂРёС‡РёРЅР°: `mousedown` РїСЂРѕРёСЃС…РѕРґРёР» РЅР° resizer, Р° `mouseup` вЂ” РІРЅРµ РґРёР°Р»РѕРіР°; РєРѕРіРґР° target'С‹ `mousedown` Рё `mouseup` СЂР°Р·Р»РёС‡Р°СЋС‚СЃСЏ, Р±СЂР°СѓР·РµСЂ СЃРёРЅС‚РµР·РёСЂСѓРµС‚ `click` РЅР° РёС… Р±Р»РёР¶Р°Р№С€РµРј РѕР±С‰РµРј РїСЂРµРґРєРµ вЂ” РІ РґР°РЅРЅРѕРј СЃР»СѓС‡Р°Рµ РЅР° `.dialog-overlay`. `BaseDialog` С‚СЂР°РєС‚СѓРµС‚ РєР»РёРє РїРѕ overlay РєР°Рє В«РєР»РёРє РІРЅРµ РґРёР°Р»РѕРіР°В» Рё РІС‹Р·С‹РІР°РµС‚ `hide()`. Р¤РёРєСЃ: РІ `DialogResizer.setupResizer()` РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё resize (`handleMouseUp`, РµСЃР»Рё `isResizing`) РІРµС€Р°РµС‚СЃСЏ РѕРґРЅРѕСЂР°Р·РѕРІС‹Р№ capturing-РїРµСЂРµС…РІР°С‚С‡РёРє `click` РЅР° `document` (`{ once: true }` + РїРѕРґСЃС‚СЂР°С…РѕРІРєР° `setTimeout(...,0)` РЅР° СЃР»СѓС‡Р°Р№, РµСЃР»Рё `mouseup` РїСЂРѕРёР·РѕС€С‘Р» РІРЅРµ РґРѕРєСѓРјРµРЅС‚Р° Рё СЃРёРЅС‚РµС‚РёС‡РµСЃРєРёР№ click РІРѕРѕР±С‰Рµ РЅРµ РґРѕР»РµС‚РµР»), РєРѕС‚РѕСЂС‹Р№ РіР»СѓС€РёС‚ РёРјРµРЅРЅРѕ СЌС‚РѕС‚ РѕРґРёРЅ РїР°СЂР°Р·РёС‚РЅС‹Р№ РєР»РёРє (`src/utils/DialogResizer.js`). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: dispatch mousedown(resizer)в†’mousemoveв†’mouseup(РІРЅРµ РґРёР°Р»РѕРіР°)в†’click(overlay) вЂ” РґРёР°Р»РѕРі РѕСЃС‚Р°С‘С‚СЃСЏ РѕС‚РєСЂС‹С‚С‹Рј; РѕР±С‹С‡РЅС‹Р№ РєР»РёРє РїРѕ overlay Р±РµР· РїСЂРµРґС€РµСЃС‚РІСѓСЋС‰РµРіРѕ resize РїРѕ-РїСЂРµР¶РЅРµРјСѓ Р·Р°РєСЂС‹РІР°РµС‚ РґРёР°Р»РѕРі (С€С‚Р°С‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ РЅРµ СЃР»РѕРјР°РЅРѕ).

### Fix вЂ” РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РѕР±СЉРµРєС‚Р° СЃ РѕС‚РїСѓСЃРєР°РЅРёРµРј РєСѓСЂСЃРѕСЂР° Р·Р° РїСЂРµРґРµР»Р°РјРё РєР°РЅРІС‹ РЅРµРєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°Р»Рѕ С‚СЂР°РЅСЃС„РѕСЂРјС‹

- **`MouseHandlers.handleGlobalMouseUp()`/`handleWindowBlur()` РѕС‚РјРµРЅСЏР»Рё drag/transform, РѕС‚РїСѓС‰РµРЅРЅС‹Р№ Р·Р° РїСЂРµРґРµР»Р°РјРё РєР°РЅРІС‹ (РёР»Рё РїСЂРё РїРѕС‚РµСЂРµ С„РѕРєСѓСЃР° РѕРєРЅР°), РІС‹Р·РѕРІРѕРј `historyOperations.undo()`** вЂ” РЅРѕ РІРѕ РІСЂРµРјСЏ drag'Р° `historyManager.saveState()` РµС‰С‘ РЅРµ РІС‹Р·С‹РІР°Р»СЃСЏ (РѕРЅ РІС‹Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё С€С‚Р°С‚РЅРѕРј Р·Р°РІРµСЂС€РµРЅРёРё РІ `handleMouseUp`), РїРѕСЌС‚РѕРјСѓ РІРµСЂС… undo-СЃС‚РµРєР° вЂ” СЌС‚Рѕ СЃРѕСЃС‚РѕСЏРЅРёРµ Р”Рћ РЅР°С‡Р°Р»Р° С‚РµРєСѓС‰РµРіРѕ Р¶РµСЃС‚Р°, Р° РЅРµ "С‚РµРєСѓС‰РµРµ" (Р·Р°РґСЂР°РіРѕРІР°РЅРЅРѕРµ) СЃРѕСЃС‚РѕСЏРЅРёРµ, РєРѕС‚РѕСЂРѕРµ `undo()` РїСЂРµРґРїРѕР»Р°РіР°РµС‚ РЅР°Р№С‚Рё Рё РІС‹С‚РѕР»РєРЅСѓС‚СЊ. Р’ СЂРµР·СѓР»СЊС‚Р°С‚Рµ `undo()` РІС‹С‚Р°Р»РєРёРІР°Р» СЃРѕСЃС‚РѕСЏРЅРёРµ "РґРѕ Р¶РµСЃС‚Р°" РІ redo-СЃС‚РµРє Рё РІРѕР·РІСЂР°С‰Р°Р» СЃРѕСЃС‚РѕСЏРЅРёРµ РµС‰С‘ РЅР° С€Р°Рі СЂР°РЅСЊС€Рµ вЂ” РЅР° РѕРґРёРЅ С€Р°Рі РёСЃС‚РѕСЂРёРё РґР°Р»СЊС€Рµ, С‡РµРј РЅСѓР¶РЅРѕ, РѕСЃС‚Р°РІР»СЏСЏ РѕР±СЉРµРєС‚ РІ РЅРµРІРµСЂРЅРѕР№ РїРѕР·РёС†РёРё (РЅРµ РІ РёСЃС…РѕРґРЅРѕР№, Р° РІ СЃРѕСЃС‚РѕСЏРЅРёРё РґРѕ РџР Р•Р”Р«Р”РЈР©Р•Р“Рћ РґРµР№СЃС‚РІРёСЏ). Р¤РёРєСЃ: РЅРѕРІС‹Р№ `HistoryManager.peekCurrentState()` С‡РёС‚Р°РµС‚ РІРµСЂС… undo-СЃС‚РµРєР° Р‘Р•Р— РµРіРѕ РјРѕРґРёС„РёРєР°С†РёРё; `HistoryOperations.cancelToLastSavedState()` (РёСЃРїРѕР»СЊР·СѓРµС‚ С‚РѕС‚ Р¶Рµ restore-РїР°Р№РїР»Р°Р№РЅ, С‡С‚Рѕ `undo()`/`redo()`, РІС‹РЅРµСЃРµРЅРЅС‹Р№ РІ `_applyRestoredState()`) РїСЂРёРјРµРЅСЏРµС‚ СЌС‚Рѕ СЃРѕСЃС‚РѕСЏРЅРёРµ, РЅРµ С‚СЂРѕРіР°СЏ undo/redo-СЃС‚РµРєРё. Р’СЃРµ 4 РјРµСЃС‚Р° РѕС‚РјРµРЅС‹ Р¶РµСЃС‚Р° РІРЅРµ РєР°РЅРІС‹ (`handleGlobalMouseUp` вЂ” drag Рё transform, `handleWindowBlur` вЂ” drag Рё transform) РїРµСЂРµРІРµРґРµРЅС‹ СЃ `undo()` РЅР° `cancelToLastSavedState()` (`src/managers/HistoryManager.js`, `src/core/HistoryOperations.js`, `src/event-system/MouseHandlers.js`). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: РґРІР° РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹С… move (`saveState`) + РѕРґРёРЅ РЅРµР·Р°РєРѕРјРјРёС‡РµРЅРЅС‹Р№ "drag" РїРѕРІРµСЂС… в†’ `cancelToLastSavedState()` РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РёРјРµРЅРЅРѕ РїРѕР·РёС†РёСЋ РїРѕСЃР»Рµ РІС‚РѕСЂРѕРіРѕ move (РЅРµ РїРµСЂРІРѕРіРѕ Рё РЅРµ РёСЃС…РѕРґРЅСѓСЋ), СЃС‚РµРє РёСЃС‚РѕСЂРёРё РЅРµ С‚РµСЂСЏРµС‚ Рё РЅРµ Р·Р°РґРІР°РёРІР°РµС‚ Р·Р°РїРёСЃРё.

### Fix вЂ” РѕС‚РјРµРЅР° РґРёР°Р»РѕРіР° РѕС‚РєСЂС‹С‚РёСЏ СѓСЂРѕРІРЅСЏ РїСЂРёРІРѕРґРёР»Р° Рє РєСЂР°С…Сѓ Рё Р°Р»РµСЂС‚Сѓ "Cannot read properties of null"

- **`LevelFileOperations.openLevel()` РїСЂРёСЃРІР°РёРІР°Р» `this.editor.level` СЂРµР·СѓР»СЊС‚Р°С‚Сѓ `fileManager.loadLevelFromFileInput()` Р±РµР· РїСЂРѕРІРµСЂРєРё РЅР° `null`.** `loadLevelFromFileInput()` РІРѕР·РІСЂР°С‰Р°РµС‚ `null` Рё РїСЂРё РѕС‚РјРµРЅРµ РЅР°С‚РёРІРЅРѕРіРѕ С„Р°Р№Р»РѕРІРѕРіРѕ РґРёР°Р»РѕРіР°, Рё РїСЂРё РѕС€РёР±РєРµ С‡С‚РµРЅРёСЏ С„Р°Р№Р»Р° (РѕР±Р° СЃР»СѓС‡Р°СЏ РїСЂРѕС…РѕРґСЏС‚ С‡РµСЂРµР· `ErrorHandler.tryAsync` СЃ С„РѕР»Р±СЌРєРѕРј `null`). РљРѕРґ РїСЂРѕРґРѕР»Р¶Р°Р» РІС‹РїРѕР»РЅСЏС‚СЊСЃСЏ СЃ `this.editor.level = null` Рё РїР°РґР°Р» РЅР° `this.editor.level.getMainLayerId()`, Р° catch-Р±Р»РѕРє РїРѕРєР°Р·С‹РІР°Р» СЋР·РµСЂСѓ confusing Р°Р»РµСЂС‚ "Error loading level: Cannot read properties of null...", С…РѕС‚СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїСЂРѕСЃС‚Рѕ Р·Р°РєСЂС‹Р» РґРёР°Р»РѕРі РІС‹Р±РѕСЂР° С„Р°Р№Р»Р°. Р¤РёРєСЃ: СЂРµР·СѓР»СЊС‚Р°С‚ `loadLevelFromFileInput()` СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІРѕ РІСЂРµРјРµРЅРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ Рё РїСЂРѕРІРµСЂСЏРµС‚СЃСЏ РЅР° `null` Р”Рћ РїСЂРёСЃРІРѕРµРЅРёСЏ `this.editor.level` Рё РґРѕ `stateManager.reset()` вЂ” РїСЂРё РѕС‚РјРµРЅРµ/РѕС€РёР±РєРµ РјРµС‚РѕРґ С‚РёС…Рѕ РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ, С‚РµРєСѓС‰РёР№ СѓСЂРѕРІРµРЅСЊ РѕСЃС‚Р°С‘С‚СЃСЏ РЅРµС‚СЂРѕРЅСѓС‚С‹Рј, Р°Р»РµСЂС‚ РЅРµ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ (`src/core/LevelFileOperations.js`). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: `loadLevelFromFileInput` Р·Р°РјРѕРєР°РЅ РЅР° `async () => null` (СЌРјСѓР»СЏС†РёСЏ РѕС‚РјРµРЅС‹), `editor.level` РЅРµ РёР·РјРµРЅРёР»СЃСЏ Рё РѕСЃС‚Р°Р»СЃСЏ РІР°Р»РёРґРµРЅ, РѕС€РёР±РѕРє РІ РєРѕРЅСЃРѕР»Рё РЅРµС‚.

### Feature вЂ” РЅР°СЃС‚СЂР°РёРІР°РµРјС‹Р№ РґРѕРїСѓСЃРє РєР»РёРєР° (hit-test tolerance), СЂР°СЃС€РёСЂСЏСЋС‰РёР№ С‚РѕС‡РєСѓ РєР»РёРєР°, Р° РЅРµ СЂР°РјРєСѓ РѕР±СЉРµРєС‚Р°

- **РћР±Р»Р°СЃС‚СЊ РїРѕРїР°РґР°РЅРёСЏ РєР»РёРєР° = РІРёР·СѓР°Р»СЊРЅР°СЏ СЂР°РјРєР° (boundaries) + РґРѕРїСѓСЃРє РІРѕРєСЂСѓРі РўРћР§РљР РєР»РёРєР°, Р° РЅРµ РІРѕРєСЂСѓРі СЂР°РјРєРё РѕР±СЉРµРєС‚Р°** вЂ” СЂР°РЅСЊС€Рµ `isPointInObject`/`isPointInWorldBounds` С‚СЂРµР±РѕРІР°Р»Рё РїРѕРїР°РґР°РЅРёСЏ СЂРѕРІРЅРѕ РІ РіСЂР°РЅРёС†Сѓ Р±РµР· Р·Р°РїР°СЃР°. РџРµСЂРІР°СЏ РІРµСЂСЃРёСЏ РґРѕРїСѓСЃРєР° СЂР°СЃС€РёСЂСЏР»Р° СЃР°РјСѓ СЂР°РјРєСѓ РїРѕ РѕСЃСЏРј РЅРµР·Р°РІРёСЃРёРјРѕ (РїРѕ СЃСѓС‚Рё Chebyshev/РєРІР°РґСЂР°С‚РЅС‹Р№ РґРёР»РµР№С‚) вЂ” СЌС‚Рѕ РЅРµРєРѕСЂСЂРµРєС‚РЅРѕ Сѓ СѓРіР»РѕРІ: РєР»РёРє РїРѕ РґРёР°РіРѕРЅР°Р»Рё РґРѕ `toleranceВ·в€љ2` РѕС‚ СѓРіР»Р° РІСЃС‘ РµС‰С‘ Р·Р°СЃС‡РёС‚С‹РІР°Р»СЃСЏ РєР°Рє РїРѕРїР°РґР°РЅРёРµ, С…РѕС‚СЏ СЂРµР°Р»СЊРЅРѕРµ СЂР°СЃСЃС‚РѕСЏРЅРёРµ РґРѕ РѕР±СЉРµРєС‚Р° СѓР¶Рµ Р±РѕР»СЊС€Рµ Р·Р°РґР°РЅРЅРѕРіРѕ РґРѕРїСѓСЃРєР°. РџРµСЂРµРїРёСЃР°РЅРѕ РЅР° `WorldPositionUtils._pointNearRect()` вЂ” РѕР±С‰РёР№ С…РµР»РїРµСЂ (СѓР±СЂР°Р» 3-РєСЂР°С‚РЅРѕРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ СѓСЃР»РѕРІРёСЏ РІ `isPointInWorldBounds`), РєР»СЌРјРїРёС‚ С‚РѕС‡РєСѓ РєР»РёРєР° Рє РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєСѓ Рё СЃСЂР°РІРЅРёРІР°РµС‚ РµРІРєР»РёРґРѕРІРѕ СЂР°СЃСЃС‚РѕСЏРЅРёРµ СЃ `tolerance`: РїРѕР»СѓС‡Р°РµС‚СЃСЏ РґРѕРїСѓСЃРє РёРјРµРЅРЅРѕ РІРѕРєСЂСѓРі С‚РѕС‡РєРё РєР»РёРєР° (СЃРєСЂСѓРіР»С‘РЅРЅС‹Рµ СѓРіР»С‹), Р° РЅРµ СЂР°Р·РґСѓС‚Р°СЏ СЂР°РјРєР°. `ObjectOperations.getHitTestTolerance()` РїРµСЂРµРІРѕРґРёС‚ РЅР°СЃС‚СЂРѕР№РєСѓ `selection.hitTestTolerance` (СЌРєСЂР°РЅРЅС‹Рµ px, РґРµС„РѕР»С‚ 4) РІ РјРёСЂРѕРІС‹Рµ РµРґРёРЅРёС†С‹ С‡РµСЂРµР· РґРµР»РµРЅРёРµ РЅР° `camera.zoom`. РќР°СЃС‚СЂРѕР№РєР° Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅР° С‚РѕР»СЊРєРѕ С‚Р°Рј, РіРґРµ СЂРµР°Р»СЊРЅРѕ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ (`ConfigManager`/`StateManager` вЂ” hardcoded selection-defaults, `SettingsSyncManager` вЂ” РѕРґРёРЅ РїСЂСЏРјРѕР№ РјР°РїРїРёРЅРі `selection.hitTestTolerance`в†’`selection.hitTestTolerance`, UI-СЃР»Р°Р№РґРµСЂ "Click Tolerance (px)" РІ Settings в†’ Selection); РЅРµ СЃС‚Р°Р» РґСѓР±Р»РёСЂРѕРІР°С‚СЊ РІ `config/defaults/panels.json`/`panels.selection.*`-РјР°РїРїРёРЅРі вЂ” С‚Р° РІРµС‚РєР° С„Р°Р№Р»РѕРІРѕРіРѕ РєРѕРЅС„РёРіР° РґР»СЏ СЌС‚РѕРіРѕ СЃРµС‚С‚РёРЅРіР° РЅРёС‡РµРј РЅРµ С‡РёС‚Р°РµС‚СЃСЏ (РїСЂРѕРІРµСЂРµРЅРѕ grep'РѕРј), РґРѕР±Р°РІР»РµРЅРёРµ С‚СѓРґР° Р±С‹Р»Рѕ Р±С‹ РјС‘СЂС‚РІС‹Рј РєРѕРґРѕРј. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: РїРµСЂРїРµРЅРґРёРєСѓР»СЏСЂРЅРѕ Рє РіСЂР°РЅРё вЂ” 2px Р·Р° РіСЂР°РЅРёС†РµР№ РїРѕРїР°РґР°РЅРёРµ, 6px вЂ” РїСЂРѕРјР°С… (РєР°Рє Рё СЂР°РЅСЊС€Рµ); РїРѕ РґРёР°РіРѕРЅР°Р»Рё РѕС‚ СѓРіР»Р° вЂ” 2px РїРѕРїР°РґР°РЅРёРµ, 5px РїСЂРѕРјР°С… (СЂР°РЅСЊС€Рµ РґР°РІР°Р»Рѕ Р»РѕР¶РЅРѕРµ РїРѕРїР°РґР°РЅРёРµ РёР·-Р·Р° РєРІР°РґСЂР°С‚РЅРѕРіРѕ РґРёР»РµР№С‚Р°); UI-СЃР»Р°Р№РґРµСЂ Рё `configManager.getDefault()` РґР»СЏ reset РїРѕРґС‚РІРµСЂР¶РґРµРЅС‹ СЂР°Р±РѕС‡РёРјРё (`src/utils/WorldPositionUtils.js`, `src/core/ObjectOperations.js`, `src/managers/ConfigManager.js`, `src/managers/StateManager.js`, `src/utils/SettingsSyncManager.js`, `src/ui/panel-structures/SettingsPanelRenderers.js`).

### Feature вЂ” Object Solo (Outliner) + РјСѓР»СЊС‚Рё-select РІ С„РёР»СЊС‚СЂРµ С‚РёРїРѕРІ + С„РёРєСЃ Р·Р°РєСЂС‹С‚РёСЏ РјРµРЅСЋ С„РёР»СЊС‚СЂР°

- **Object Solo вЂ” Ctrl+click РЅР° РёРєРѕРЅРєСѓ РіР»Р°Р·Р° РѕР±СЉРµРєС‚Р° РІ Outliner** (Р°РЅР°Р»РѕРі СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ Layer Solo). РќРѕРІС‹Р№ `ObjectOperations.toggleObjectSolo(obj)`: РЅРµ СЂР°Р·СЂСѓС€Р°СЋС‰РёР№ (РЅРµ С‚СЂРѕРіР°РµС‚ `obj.visible`), СЃРѕСЃС‚РѕСЏРЅРёРµ вЂ” `stateManager` РєР»СЋС‡ `view.soloedTopLevelObjectId` (id РІРµСЂС…РЅРµСѓСЂРѕРІРЅРµРІРѕРіРѕ РѕР±СЉРµРєС‚Р° РёР»Рё `null`), СЌРєСЃРєР»СЋР·РёРІРЅС‹Р№ (СЃРѕР»Рѕ РґСЂСѓРіРѕРіРѕ РѕР±СЉРµРєС‚Р° Р·Р°РјРµРЅСЏРµС‚ РїСЂРµРґС‹РґСѓС‰РµРµ, РїРѕРІС‚РѕСЂРЅС‹Р№ Ctrl+click РЅР° СѓР¶Рµ-СЃРѕР»Рѕ вЂ” СЃРЅРёРјР°РµС‚). Р’ РѕС‚Р»РёС‡РёРµ РѕС‚ Isolate (`/`, РґРёРјРјРёСЂРѕРІР°РЅРёРµ С‡РµСЂРµР· `ctx.filter`), Object Solo вЂ” СЌС‚Рѕ РџРћР›РќРћР• СЃРєСЂС‹С‚РёРµ: `RenderOperations.render()` РїСЂРѕРїСѓСЃРєР°РµС‚ РѕС‚СЂРёСЃРѕРІРєСѓ С†РµР»РёРєРѕРј, Р° РЅРµ РґРёРјРјРёСЂСѓРµС‚ вЂ” СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ СЃРµРјР°РЅС‚РёРєРµ РёРєРѕРЅРєРё РіР»Р°Р·Р°. Р Р°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ РЅР° РІРµСЂС…РЅРµРј СѓСЂРѕРІРЅРµ (РґРµС‚Рё soloed-РіСЂСѓРїРїС‹ СЂРµРЅРґРµСЂСЏС‚СЃСЏ РєР°Рє РѕР±С‹С‡РЅРѕ вЂ” СЃР»РµРґСЃС‚РІРёРµ С„РёР»СЊС‚СЂР°С†РёРё С‚РѕР»СЊРєРѕ РЅР° РІРµСЂС…РЅРµРј СѓСЂРѕРІРЅРµ, РЅРµ СЃРїРµС†РєРµР№СЃ). РќРѕРІС‹Р№ РѕР±С‰РёР№ С…РµР»РїРµСЂ `ObjectOperations.findTopLevelAncestor(obj)` РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё `toggleIsolateSelection()`, Рё `toggleObjectSolo()` (`src/core/ObjectOperations.js`, `src/core/RenderOperations.js`, `src/ui/OutlinerPanel.js`).

- **Р¤РёРєСЃ: РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РёРєРѕРЅРєРё РіР»Р°Р·Р° РѕР±СЉРµРєС‚Р° Р±С‹Р»Рѕ РїСЂРёРІСЏР·Р°РЅРѕ Рє РљРћРњРђРќР”Р•, Р° РЅРµ Рє СЃРѕСЃС‚РѕСЏРЅРёСЋ.** РџРѕСЃР»Рµ Ctrl+click (solo) РЅР° РѕРґРЅРѕРј РѕР±СЉРµРєС‚Рµ РѕСЃС‚Р°Р»СЊРЅС‹Рµ РѕР±СЉРµРєС‚С‹ РІ Outliner РЅРµ РїРµСЂРµРєР»СЋС‡Р°Р»РёСЃСЊ РЅР° Р·Р°РєСЂС‹С‚С‹Р№ РіР»Р°Р·/СЃРµСЂС‹Р№ С†РІРµС‚ вЂ” `updateVisibilityButton()` РІС‹С‡РёСЃР»СЏР» РёРєРѕРЅРєСѓ РёР· `obj.visible` РЅР°РїСЂСЏРјСѓСЋ, Р° Object Solo РЅР°РјРµСЂРµРЅРЅРѕ РЅРµ С‚СЂРѕРіР°РµС‚ `obj.visible` (РЅРµ СЂР°Р·СЂСѓС€Р°СЋС‰РёР№). РќРѕРІС‹Р№ `ObjectOperations.isObjectEffectivelyVisible(obj)` вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹ РґР»СЏ В«СЂРµР°Р»СЊРЅРѕ Р»Рё РѕР±СЉРµРєС‚ СЃРµР№С‡Р°СЃ СЂРёСЃСѓРµС‚СЃСЏВ», СѓС‡РёС‚С‹РІР°СЋС‰РёР№ СЂР°Р·РѕРј: СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ Рё РІСЃРµ СЂРѕРґРёС‚РµР»СЊСЃРєРёРµ `visible`-С„Р»Р°РіРё (РЅРµ РїРѕР»Р°РіР°СЏСЃСЊ С‚РѕР»СЊРєРѕ РЅР° РєР°СЃРєР°Рґ `toggleObjectVisibility` РґР»СЏ РіСЂСѓРїРї), РІРёРґРёРјРѕСЃС‚СЊ СЌС„С„РµРєС‚РёРІРЅРѕРіРѕ СЃР»РѕСЏ, Object Solo, Isolate. `OutlinerPanel.updateVisibilityButton()` С‚РµРїРµСЂСЊ СЃС‚СЂРѕРёС‚ С„РѕСЂРјСѓ/С†РІРµС‚ РёРєРѕРЅРєРё Рё СЃРµСЂС‹Р№ С†РІРµС‚ РёРјРµРЅРё РёР· СЌС‚РѕР№ С„СѓРЅРєС†РёРё, Р° РЅРµ РёР· `obj.visible` вЂ” РїСЂР°РІРёР»СЊРЅРѕ СЂРµР°РіРёСЂСѓРµС‚ РЅР° РёР·РјРµРЅРµРЅРёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ, РІС‹Р·РІР°РЅРЅС‹Рµ Р›Р®Р‘Р«Рњ РґРµР№СЃС‚РІРёРµРј, РЅРµ С‚РѕР»СЊРєРѕ СЏРІРЅС‹Рј РєР»РёРєРѕРј РїРѕ СЌС‚РѕРјСѓ РєРѕРЅРєСЂРµС‚РЅРѕРјСѓ РѕР±СЉРµРєС‚Сѓ (`src/core/ObjectOperations.js`, `src/ui/OutlinerPanel.js`).

- **Ctrl+click РІ РјРµРЅСЋ С„РёР»СЊС‚СЂР° С‚РёРїРѕРІ Outliner РґР»СЏ РјСѓР»СЊС‚Рё-select, СЃ Р·Р°РєСЂС‹С‚РёРµРј РїРѕ РѕС‚РїСѓСЃРєР°РЅРёСЋ Ctrl** вЂ” РѕР±С‹С‡РЅС‹Р№ РєР»РёРє РїРѕ С‡РµРєР±РѕРєСЃСѓ С‚РёРїР° РїСЂРёРјРµРЅСЏРµС‚ С„РёР»СЊС‚СЂ СЃСЂР°Р·Сѓ Рё Р·Р°РєСЂС‹РІР°РµС‚ РјРµРЅСЋ, РєР°Рє Рё СЂР°РЅСЊС€Рµ (Р±Р°Р±Р»РёРЅРі РєР»РёРєР° Рє РґРµС„РѕР»С‚РЅРѕРјСѓ `close-on-click` РјРµРЅСЋ). РљР»РёРє СЃ Р·Р°Р¶Р°С‚С‹Рј Ctrl (РёР»Рё Cmd) РѕСЃС‚Р°РЅР°РІР»РёРІР°РµС‚ РІСЃРїР»С‹С‚РёРµ (`e.stopPropagation()`) вЂ” РѕР±РЅРѕРІР»СЏРµС‚ С‡РµРєР±РѕРєСЃС‹ РІРёР·СѓР°Р»СЊРЅРѕ (`updateFilterMenu`), РЅРµ РїСЂРёРјРµРЅСЏСЏ С„РёР»СЊС‚СЂ Рё РЅРµ Р·Р°РєСЂС‹РІР°СЏ РјРµРЅСЋ, РїРѕР·РІРѕР»СЏСЏ РѕС‚РјРµС‚РёС‚СЊ РЅРµСЃРєРѕР»СЊРєРѕ С‚РёРїРѕРІ РїРѕРґСЂСЏРґ. РќР°РєРѕРїР»РµРЅРЅС‹Р№ С„РёР»СЊС‚СЂ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Р Р·Р°РєСЂС‹РІР°РµС‚ РјРµРЅСЋ РѕРґРЅРёРј СЂР°Р·РѕРј РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё Ctrl (`document.addEventListener('keyup', ...)`, `e.key === 'Control'`) (`src/ui/OutlinerPanel.js`).

- **Р¤РёРєСЃ/СѓС‚РѕС‡РЅРµРЅРёРµ: Р·Р°РєСЂС‹С‚РёРµ РјРµРЅСЋ С„РёР»СЊС‚СЂР° С‚РёРїРѕРІ вЂ” РїРѕ СѓРІРѕРґСѓ РєСѓСЂСЃРѕСЂР°, РЅР°РјРµСЂРµРЅРЅРѕ, РєР°Рє Рё РІ Р°РЅР°Р»РѕРіРёС‡РЅРѕРј РјРµРЅСЋ `AssetPanel.showAssetFilterMenu`.** РџРµСЂРІР°СЏ РІРµСЂСЃРёСЏ С„РёРєСЃР° РѕС€РёР±РѕС‡РЅРѕ Р·Р°РјРµРЅСЏР»Р° СЌС‚Рѕ РЅР° СЏРІРЅС‹Р№ В«РєР»РёРє СЃРЅР°СЂСѓР¶РёВ» вЂ” РїСЂР°РІРёР»СЊРЅР°СЏ РїСЂРёС‡РёРЅР° В«РЅРµ РїСЂРѕРїР°РґР°РЅРёСЏВ» РѕРєР°Р·Р°Р»Р°СЃСЊ РІ РџРћР—РР¦РРћРќРР РћР’РђРќРР: `MenuPositioningUtils`-РґРµС„РѕР»С‚ РѕСЃС‚Р°РІР»СЏР» Р·Р°Р·РѕСЂ РјРµР¶РґСѓ РєРЅРѕРїРєРѕР№ Рё РјРµРЅСЋ (`offset: 4`), РёР·-Р·Р° С‡РµРіРѕ РєСѓСЂСЃРѕСЂ (СЃС‚РѕСЏС‰РёР№ РЅР° РєРЅРѕРїРєРµ РІ РјРѕРјРµРЅС‚ РєР»РёРєР°) РЅРµ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ РѕРєР°Р·С‹РІР°Р»СЃСЏ РІРЅСѓС‚СЂРё СЂР°РјРєРё РјРµРЅСЋ вЂ” `mouseleave` Р±С‹Р»Рѕ РЅРµС‡РµРјСѓ СЃСЂР°Р±РѕС‚Р°С‚СЊ РїСЂРё СѓРІРѕРґРµ РєСѓСЂСЃРѕСЂР°, РµСЃР»Рё РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРё СЂР°Р·Сѓ РЅРµ Р·Р°С…РѕРґРёР» РІРЅСѓС‚СЂСЊ РјРµРЅСЋ. РСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµРј: `OutlinerPanel.showFilterMenu()` С‚РµРїРµСЂСЊ СЃС‡РёС‚Р°РµС‚ `offset: -buttonRect.height`, РїРѕРґРЅРёРјР°СЏ РјРµРЅСЋ С‚Р°Рє, С‡С‚Рѕ РѕРЅРѕ РЅР°РєСЂС‹РІР°РµС‚ РІСЃСЋ РєРЅРѕРїРєСѓ С†РµР»РёРєРѕРј вЂ” РєСѓСЂСЃРѕСЂ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕ СЃС‚Р°СЂС‚СѓРµС‚ РІРЅСѓС‚СЂРё РјРµРЅСЋ РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ С‚РѕРіРѕ, РіРґРµ РёРјРµРЅРЅРѕ РЅР° РєРЅРѕРїРєРµ Р±С‹Р» РєР»РёРє. РЁС‚Р°С‚РЅС‹Р№ `mouseleave`/`click`-Р±Р°Р±Р±Р»РёРЅРі Р·Р°РєСЂС‹С‚РёСЏ (`MenuPositioningUtils.setupMenuClosing()`) РЅРµ С‚СЂРѕРЅСѓС‚ (`src/ui/OutlinerPanel.js`).

- **Р¤РёРєСЃ: Layer Solo РЅРµ РјРµРЅСЏР» РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РќР•-Р·Р°soloРµРЅРЅС‹С… СЃР»РѕС‘РІ.** `updateLayerElement()`/`createLayerElement()` СЂРёСЃРѕРІР°Р»Рё С„РѕСЂРјСѓ РёРєРѕРЅРєРё РіР»Р°Р·Р° РёР· СЃС‹СЂРѕРіРѕ `layer.visible`, Р° `toggleLayerSolo()` РЅР°РјРµСЂРµРЅРЅРѕ РЅРµ С‚СЂРѕРіР°РµС‚ `layer.visible` (РЅРµ СЂР°Р·СЂСѓС€Р°СЋС‰РёР№) вЂ” СЃРѕР»Рѕ РѕРґРЅРѕРіРѕ СЃР»РѕСЏ РЅРµ РїРµСЂРµРєР»СЋС‡Р°Р»Рѕ РёРєРѕРЅРєРё РћРЎРўРђР›Р¬РќР«РҐ СЃР»РѕС‘РІ РЅР° Р·Р°РєСЂС‹С‚С‹Р№ РіР»Р°Р·, С…РѕС‚СЏ РѕРЅРё С„Р°РєС‚РёС‡РµСЃРєРё РїРµСЂРµСЃС‚Р°Р»Рё СЂРµРЅРґРµСЂРёС‚СЊСЃСЏ (С‚Р° Р¶Рµ РѕС€РёР±РєР° В«СЃС‚РёР»СЊ РїСЂРёРІСЏР·Р°РЅ Рє РєРѕРјР°РЅРґРµ, Р° РЅРµ Рє СЃРѕСЃС‚РѕСЏРЅРёСЋВ», С‡С‚Рѕ Рё РІ Object Solo, СЃРј. РІС‹С€Рµ). РћР±Рµ С‚РѕС‡РєРё СЂРµРЅРґРµСЂР° С‚РµРїРµСЂСЊ Р±РµСЂСѓС‚ `effectivelyVisible = renderOperations.getVisibleLayerIds().has(layer.id)` вЂ” РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹, СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ СЂРµР°Р»СЊРЅС‹Рј СЂРµРЅРґРµСЂРѕРј вЂ” Рё РїРѕ РЅРµРјСѓ СЂРµС€Р°СЋС‚ РўРћР›Р¬РљРћ С„РѕСЂРјСѓ РёРєРѕРЅРєРё (РѕС‚РєСЂС‹С‚С‹Р№/Р·Р°РєСЂС‹С‚С‹Р№ РіР»Р°Р·), РїР»СЋСЃ Р·Р°С‚РµРјРЅСЏСЋС‚ (`opacity: 0.45`) РІРµСЃСЊ Р±Р»РѕРє СЃС‚СЂРѕРєРё СЃР»РѕСЏ С†РµР»РёРєРѕРј; С†РІРµС‚ РёРєРѕРЅРєРё РѕСЃС‚Р°С‘С‚СЃСЏ РґРµС„РѕР»С‚РЅС‹Рј РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ РІРёРґРёРјРѕСЃС‚Рё (СЃРѕР»Рѕ РїРѕ-РїСЂРµР¶РЅРµРјСѓ РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ Р¶С‘Р»С‚С‹Рј вЂ” РѕС‚РґРµР»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ, РЅРµ visible/hidden) вЂ” РїРµСЂРІР°СЏ РІРµСЂСЃРёСЏ СЌС‚РѕРіРѕ С„РёРєСЃР° РѕС€РёР±РѕС‡РЅРѕ РІРµСЂРЅСѓР»Р° С†РІРµС‚РѕРІРѕРµ РѕС‚Р»РёС‡РёРµ РІРёРґРёРјС‹Р№/СЃРєСЂС‹С‚С‹Р№, РєРѕС‚РѕСЂРѕРµ СЂР°РЅРµРµ СѓР¶Рµ Р±С‹Р»Рѕ РЅР°РјРµСЂРµРЅРЅРѕ СѓР±СЂР°РЅРѕ (В«РІРёРґРёРјРѕСЃС‚СЊ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ С„РѕСЂРјРѕР№В»); РІС‚РѕСЂРѕР№ РїСЂРѕС…РѕРґ СѓР±СЂР°Р» С†РІРµС‚ РѕР±СЂР°С‚РЅРѕ, РѕСЃС‚Р°РІРёРІ РґРёС„С„РµСЂРµРЅС†РёР°С†РёСЋ С‚РѕР»СЊРєРѕ РЅР° С„РѕСЂРјРµ РёРєРѕРЅРєРё Рё РґРёРјРјРёРЅРіРµ СЃС‚СЂРѕРєРё. РџРѕРїСѓС‚РЅРѕ РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РІС‹Р·РѕРІРѕРІ РІ `toggleLayerSolo()`/`toggleLayerVisibility()`: `invalidateLayerVisibilityCache()` С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°РµС‚СЃСЏ Р”Рћ `updateLayerElement()`, Р° РЅРµ РїРѕСЃР»Рµ вЂ” РёРЅР°С‡Рµ `getVisibleLayerIds()` (РєСЌС€-Р±СЌРєРµРЅРЅС‹Р№) РІРѕР·РІСЂР°С‰Р°Р» РµС‰С‘ РЅРµ РёРЅРІР°Р»РёРґРёСЂРѕРІР°РЅРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ Рё РёРєРѕРЅРєР° РѕС‚СЃС‚Р°РІР°Р»Р° РЅР° РѕРґРёРЅ РєР°РґСЂ (`src/ui/LayersPanel.js`).

- **Р¤РёРєСЃ: Alt+H (Show All) СЃРЅРёРјР°Р» РІРёРґРёРјРѕСЃС‚СЊ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· `obj.visible`, РёРіРЅРѕСЂРёСЂСѓСЏ РѕСЃС‚Р°Р»СЊРЅС‹Рµ РЅРµР·Р°РІРёСЃРёРјС‹Рµ РјРµС…Р°РЅРёР·РјС‹ СЃРєСЂС‹С‚РёСЏ.** Layer Solo/СЃРєСЂС‹С‚С‹Р№ СЃР»РѕР№, Object Solo (`view.soloedTopLevelObjectId`) Рё Isolate (`view.isolatedTopLevelIds`) вЂ” С‚СЂРё РѕС‚РґРµР»СЊРЅС‹С… non-destructive СЃРѕСЃС‚РѕСЏРЅРёСЏ, РєР°Р¶РґРѕРµ СЃР°РјРѕ РїРѕ СЃРµР±Рµ СЃРїРѕСЃРѕР±РЅРѕ СЃРґРµР»Р°С‚СЊ РѕР±СЉРµРєС‚ РЅРµРІРёРґРёРјС‹Рј, РЅРµ С‚СЂРѕРіР°СЏ РµРіРѕ `obj.visible`; `unhideAllObjects()` СЃР±СЂР°СЃС‹РІР°Р» С‚РѕР»СЊРєРѕ `obj.visible`, РїРѕСЌС‚РѕРјСѓ РѕР±СЉРµРєС‚, СЃРєСЂС‹С‚С‹Р№ Р›Р®Р‘Р«Рњ РёР· СЌС‚РёС… С‚СЂС‘С… РїСѓС‚РµР№, РѕСЃС‚Р°РІР°Р»СЃСЏ РЅРµРІРёРґРёРјС‹Рј РїРѕСЃР»Рµ Alt+H. РўРµРїРµСЂСЊ `unhideAllObjects()` РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ СЃР±СЂР°СЃС‹РІР°РµС‚: РІСЃРµ СЃР»РѕРё вЂ” `layer.visible = true`, `layer.soloed = false`; `view.soloedTopLevelObjectId = null`; `view.isolatedTopLevelIds = null` вЂ” РїРѕСЃР»Рµ Alt+H `isObjectEffectivelyVisible()` РІРѕР·РІСЂР°С‰Р°РµС‚ `true` РґР»СЏ Р°Р±СЃРѕР»СЋС‚РЅРѕ Р»СЋР±РѕРіРѕ РѕР±СЉРµРєС‚Р°, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ С‚РѕРіРѕ, РєР°РєРѕР№ РєРѕРјР°РЅРґРѕР№ РѕРЅ Р±С‹Р» СЃРєСЂС‹С‚ (`src/core/ObjectOperations.js`).

- **Р¤РёРєСЃ: РёРєРѕРЅРєР° Р·Р°РєСЂС‹С‚РѕРіРѕ РіР»Р°Р·Р° РІ Outliner РЅРµ С‚РµРјРЅРµР»Р° РІРјРµСЃС‚Рµ СЃ С‚РµРєСЃС‚РѕРј РёРјРµРЅРё.** `updateVisibilityButton()` РѕР±РѕСЂР°С‡РёРІР°Р» РћР‘Рђ СЃРѕСЃС‚РѕСЏРЅРёСЏ (РІРёРґРёРјС‹Р№/СЃРєСЂС‹С‚С‹Р№) РІ `var(--ui-text-color, fallback)` вЂ” РїРѕСЃРєРѕР»СЊРєСѓ CSS-РїРµСЂРµРјРµРЅРЅР°СЏ `--ui-text-color` СЂРµР°Р»СЊРЅРѕ РѕРїСЂРµРґРµР»РµРЅР° РіР»РѕР±Р°Р»СЊРЅРѕ, РѕРЅР° РїРµСЂРµРєСЂС‹РІР°Р»Р° fallback РІ РѕР±РµРёС… РІРµС‚РєР°С… РѕРґРёРЅР°РєРѕРІРѕ, Рё СЂР°Р·РЅС‹Рµ fallback-С†РІРµС‚Р° (`#d1d5db` / `#6b7280`) РЅРёРєРѕРіРґР° РЅРµ РїСЂРёРјРµРЅСЏР»РёСЃСЊ вЂ” РёРєРѕРЅРєР° РІРёР·СѓР°Р»СЊРЅРѕ РЅРµ РѕС‚Р»РёС‡Р°Р»Р°СЃСЊ РѕС‚ РІРёРґРёРјРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ. РСЃРїСЂР°РІР»РµРЅРѕ РЅР° С‚РѕС‚ Р¶Рµ РїР°С‚С‚РµСЂРЅ, С‡С‚Рѕ СѓР¶Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РґР»СЏ `nameSpan.style.color` СЂСЏРґРѕРј: РїСѓСЃС‚Р°СЏ СЃС‚СЂРѕРєР° (РЅР°СЃР»РµРґРѕРІР°РЅРёРµ РґРµС„РѕР»С‚Р°) РґР»СЏ РІРёРґРёРјРѕРіРѕ, Р»РёС‚РµСЂР°Р»СЊРЅС‹Р№ `#6b7280` (Р±РµР· `var()`) РґР»СЏ СЃРєСЂС‹С‚РѕРіРѕ (`src/ui/OutlinerPanel.js`).

- РќРѕРІС‹Рµ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Рµ (Р±РµР· С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕР№ РїСЂРёРІСЏР·РєРё, СЂРµР±РёРЅРґРёРЅРі РЅРµРґРѕСЃС‚СѓРїРµРЅ) Р·Р°РїРёСЃРё РІ `config/defaults/shortcuts.json` в†’ `mouse`: `soloObject`, `multiSelectFilterType`.

### Fix вЂ” drag-n-drop РІРєР»Р°РґРѕРє РїР°РЅРµР»РµР№: РїСѓСЃС‚Р°СЏ РїР°РЅРµР»СЊ Рё ghost-С‚Р°Р±

- **Р¤РёРєСЃ: РїРѕСЃР»Рµ СЂСѓС‡РЅРѕРіРѕ С‚РѕРіРіР»Р° РїСѓСЃС‚РѕР№ РїР°РЅРµР»Рё (РјРµРЅСЋ/Alt+1..4) drag-РїРµСЂРµРЅРѕСЃ РІРєР»Р°РґРєРё РїРµСЂРµСЃС‚Р°РІР°Р» СЃРѕР·РґР°РІР°С‚СЊ СЌС‚Сѓ РїР°РЅРµР»СЊ Р·Р°РЅРѕРІРѕ.** `EventHandlers.applyPanelVisibility()` РїСЂРё СЃРєСЂС‹С‚РёРё tabs-РїР°РЅРµР»Рё С‚РѕР»СЊРєРѕ СЃС‚Р°РІРёР» `display:none` РЅР° СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ DOM-СѓР·РµР», РЅРµ СѓРґР°Р»СЏСЏ РµРіРѕ вЂ” РІ РѕС‚Р»РёС‡РёРµ РѕС‚ `PanelPositionManager.removeEmptyPanel()`, РєРѕС‚РѕСЂС‹Рј РѕР±С‹С‡РЅС‹Р№ drag-cleanup СѓР±РёСЂР°РµС‚ РїСѓСЃС‚СѓСЋ РїР°РЅРµР»СЊ РёР· DOM РїРѕР»РЅРѕСЃС‚СЊСЋ. РџРѕСЃР»Рµ С‚Р°РєРѕРіРѕ СЂСѓС‡РЅРѕРіРѕ С‚РѕРіРіР»Р° РїСѓСЃС‚Р°СЏ РїР°РЅРµР»СЊ РѕСЃС‚Р°РІР°Р»Р°СЃСЊ РІ DOM (РїСЂРѕСЃС‚Рѕ СЃРєСЂС‹С‚Р°СЏ), РїРѕСЌС‚РѕРјСѓ РїСЂРѕРІРµСЂРєР° `_installGlobalTabDragHandlers()` В«РїР°РЅРµР»СЊ РµС‰С‘ РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚ в†’ Р°РІС‚Рѕ-РїРѕРєР°Р·Р°С‚СЊ С‡РµСЂРµР· `togglePanel()`В» РІРёРґРµР»Р° DOM-СѓР·РµР» Рё СЃС‡РёС‚Р°Р»Р°, С‡С‚Рѕ РїР°РЅРµР»СЊ В«СѓР¶Рµ РµСЃС‚СЊВ» вЂ” Р°РІС‚Рѕ-СЃРѕР·РґР°РЅРёРµ РїРµСЂРµСЃС‚Р°РІР°Р»Рѕ СЃСЂР°Р±Р°С‚С‹РІР°С‚СЊ, Р° СЃРєСЂС‹С‚Р°СЏ (display:none) РїР°РЅРµР»СЊ РЅРµ РјРѕРіР»Р° Р±С‹С‚СЊ С†РµР»СЊСЋ drop. РСЃРїСЂР°РІР»РµРЅРѕ: РїСЂРё СЃРєСЂС‹С‚РёРё tabs-РїР°РЅРµР»Рё С‚РµРїРµСЂСЊ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РІС‹Р·С‹РІР°РµС‚СЃСЏ `removeEmptyPanel(side)` (no-op, РµСЃР»Рё РІ РїР°РЅРµР»Рё РѕСЃС‚Р°Р»РёСЃСЊ РІРєР»Р°РґРєРё) вЂ” СЃРєСЂС‹С‚РёРµ РїСѓСЃС‚РѕР№ РїР°РЅРµР»Рё С‡РµСЂРµР· РјРµРЅСЋ/С…РѕС‚РєРµР№ Рё С‡РµСЂРµР· drag-cleanup РµРґРёРЅРѕРѕР±СЂР°Р·РЅРѕ СѓРґР°Р»СЏСЋС‚ РµС‘ РёР· DOM (`src/event-system/EventHandlers.js`).

- **Р¤РёРєСЃ: ghost-С‚Р°Р± РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РїРѕСЏРІР»СЏР»СЃСЏ РІ Р»РµРІРѕРј РІРµСЂС…РЅРµРј СѓРіР»Сѓ РѕРєРЅР° Рё Р±РµР· Р·Р°Р»РёРІРєРё.** РџРѕР·РёС†РёСЏ ghost-СЌР»РµРјРµРЅС‚Р° (`PanelPositionManager._installGlobalTabDragHandlers`) РІС‹СЃС‚Р°РІР»СЏР»Р°СЃСЊ С‚РѕР»СЊРєРѕ РІ РѕР±СЂР°Р±РѕС‚С‡РёРєРµ `mousemove` вЂ” РїРѕРєР° РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РїСЂРѕСЃС‚Рѕ Р·Р°Р¶РёРјР°Р» РєР»РёРє РЅР° РІРєР»Р°РґРєРµ Р±РµР· РґРІРёР¶РµРЅРёСЏ РјС‹С€Рё, `style.left/top` РЅРµ Р±С‹Р»Рё Р·Р°РґР°РЅС‹ РІРѕРѕР±С‰Рµ, Рё СЌР»РµРјРµРЅС‚ (РЅРµСЃРјРѕС‚СЂСЏ РЅР° `position:fixed` РІ CSS) РѕС‚РѕР±СЂР°Р¶Р°Р»СЃСЏ РІ РґРµС„РѕР»С‚РЅРѕР№ РїРѕР·РёС†РёРё (СѓРіРѕР» РѕРєРЅР°). РСЃРїСЂР°РІР»РµРЅРѕ: РїРѕР·РёС†РёСЏ ghost'Р° С‚РµРїРµСЂСЊ РІС‹СЃС‚Р°РІР»СЏРµС‚СЃСЏ СЃСЂР°Р·Сѓ РїСЂРё СЃРѕР·РґР°РЅРёРё, РёСЃРїРѕР»СЊР·СѓСЏ РєРѕРѕСЂРґРёРЅР°С‚С‹ СЃР°РјРѕРіРѕ `mousedown` (С‚РµРј Р¶Рµ СЃРјРµС‰РµРЅРёРµРј `+14/-12`, С‡С‚Рѕ Рё `mousemove`). РћС‚РґРµР»СЊРЅРѕ: Р·Р°Р»РёРІРєР° С‚РѕР¶Рµ РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р»Р° вЂ” `.tab`/`.tab-right`/`.tab-left` РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ `background: transparent`, Р·Р°Р»РёРІРєСѓ РґР°С‘С‚ С‚РѕР»СЊРєРѕ РєР»Р°СЃСЃ `.active`, РєРѕС‚РѕСЂС‹Р№ Сѓ ghost'Р° РЅР°РјРµСЂРµРЅРЅРѕ СЃРЅРёРјР°РµС‚СЃСЏ (`classList.remove('active', ...)`), РїРѕСЌС‚РѕРјСѓ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РќР• Р°РєС‚РёРІРЅРѕР№ РІРєР»Р°РґРєРё РґР°РІР°Р»Рѕ РїРѕР»РЅРѕСЃС‚СЊСЋ РїСЂРѕР·СЂР°С‡РЅС‹Р№ ghost (С‚РѕР»СЊРєРѕ С‚РµРєСЃС‚ Рё С‚РµРЅСЊ). Р”РѕР±Р°РІР»РµРЅР° СЃРѕР±СЃС‚РІРµРЅРЅР°СЏ Р·Р°Р»РёРІРєР° РІ CSS-РїСЂР°РІРёР»Рѕ `.tab-drag-ghost` (`background-color`/`color`, С‚РѕС‚ Р¶Рµ С†РІРµС‚, С‡С‚Рѕ Сѓ `.active`), РЅРµ Р·Р°РІРёСЃСЏС‰Р°СЏ РѕС‚ РёСЃС…РѕРґРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕР№ РІРєР»Р°РґРєРё (`src/ui/PanelPositionManager.js`, `styles/main.css`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/ui/OutlinerPanel.js` В· `src/core/ObjectOperations.js` В· `src/core/RenderOperations.js` В· `src/ui/LayersPanel.js` В· `config/defaults/shortcuts.json`

---

### Feature вЂ” 11 Blender-РІРґРѕС…РЅРѕРІР»С‘РЅРЅС‹С… UX-СѓР»СѓС‡С€РµРЅРёР№ (РїР°РЅРµР»Рё, РІС‹Р±РѕСЂ, РІРёРґРёРјРѕСЃС‚СЊ, С…РѕС‚РєРµРё РјРµРЅСЋ)

- **Alt+1/2/3/4 вЂ” С‚РѕРіРіР» РїР°РЅРµР»РµР№** вЂ” `EventHandlers.handleKeyDown` РїРѕР»СѓС‡РёР» РІРµС‚РєСѓ `e.altKey && ['1','2','3','4'].includes(e.key)`, РІС‹Р·С‹РІР°СЋС‰СѓСЋ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `this.togglePanel('leftPanel'|'rightPanel'|'toolbar'|'assetsPanel')` (`src/event-system/EventHandlers.js`).

- **РћС‚РѕР±СЂР°Р¶РµРЅРёРµ С…РѕС‚РєРµРµРІ РІ РіР»Р°РІРЅРѕРј РјРµРЅСЋ + live-РѕР±РЅРѕРІР»РµРЅРёРµ РїРѕСЃР»Рµ СЂРµР±РёРЅРґР°** вЂ” `config/menu.js` СЂР°РЅСЊС€Рµ С…СЂР°РЅРёР» С…Р°СЂРґРєРѕРґ-СЃС‚СЂРѕРєРё (`shortcut: 'Ctrl+S'`), РґСѓР±Р»РёСЂСѓСЏ `config/defaults/shortcuts.json`. РџСѓРЅРєС‚С‹ РјРµРЅСЋ С‚РµРїРµСЂСЊ СЃСЃС‹Р»Р°СЋС‚СЃСЏ РЅР° С…РѕС‚РєРµР№ С‡РµСЂРµР· `shortcutKey: 'editor.saveLevel'` (РґРѕС‚-РїСѓС‚СЊ РІ shortcuts.json) вЂ” РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹. РќРѕРІС‹Р№ РѕР±С‰РёР№ `src/utils/ShortcutFormatter.js` (`ShortcutFormatter.format(shortcut)` в†’ СЃС‚СЂРѕРєР° РІРёРґР° `"Ctrl+Alt+N"`) РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё РІ `SettingsPanel.formatShortcut()` (С‚РµРїРµСЂСЊ С‚РѕРЅРєР°СЏ РѕР±С‘СЂС‚РєР° РЅР°Рґ РЅРёРј), Рё РІ РЅРѕРІС‹С… `MenuManager.resolveShortcutLabel(shortcutKey)` / `MenuManager.createMenuItem()`. РќРѕРІС‹Р№ `MenuManager.refreshShortcutLabels()` РїРµСЂРµС‡РёС‚С‹РІР°РµС‚ РІСЃРµ `[data-shortcut-key]`-СЃРїР°РЅС‹ РІ DOM РјРµРЅСЋ Рё РѕР±РЅРѕРІР»СЏРµС‚ РёС… С‚РµРєСЃС‚ вЂ” РІС‹Р·С‹РІР°РµС‚СЃСЏ РѕРґРёРЅ СЂР°Р· РёР· `MenuManager.initialize()` Рё РїРѕРІС‚РѕСЂРЅРѕ РёР· `SettingsPanel.saveHotkey()` РїРѕСЃР»Рµ С‚РѕРіРѕ РєР°Рє СЂРµР±РёРЅРґ СѓР¶Рµ РїРµСЂСЃРёСЃС‚РёСЂРѕРІР°РЅ С‡РµСЂРµР· `configManager.set('shortcuts.category.action', ...)`. РњРёРіСЂРёСЂРѕРІР°РЅС‹ РЅР° `shortcutKey`: `new-level`/`open-level`/`save-level`/`save-level-as`, `toggle-grid`, `toggle-parallax`, 4 РїСѓРЅРєС‚Р° С‚РѕРіРіР»Р° РїР°РЅРµР»РµР№ (`config/menu.js`). РџРѕРїСѓС‚РЅРѕ РёСЃРїСЂР°РІР»РµРЅР° РЅРµС‚РѕС‡РЅРѕСЃС‚СЊ РІ `shortcuts.json`: `editor.newLevel` РЅРµ РёРјРµР» `altKey: true`, С…РѕС‚СЏ СЂРµР°Р»СЊРЅРѕ СЂР°Р±РѕС‚Р°СЋС‰Р°СЏ РєРѕРјР±РёРЅР°С†РёСЏ вЂ” Ctrl+Alt+N (Ctrl+N Р±СЂР°СѓР·РµСЂ РїРµСЂРµС…РІР°С‚С‹РІР°РµС‚ РєР°Рє В«РЅРѕРІРѕРµ РѕРєРЅРѕВ»). **РР·РІРµСЃС‚РЅРѕРµ РѕРіСЂР°РЅРёС‡РµРЅРёРµ (РЅРµ СЂР°СЃС€РёСЂРµРЅРѕ СЌС‚РёРј РїР°РєРµС‚РѕРј):** СЂРµР±РёРЅРґ РІ Settings в†’ Hotkeys РјРµРЅСЏРµС‚ С‚РѕР»СЊРєРѕ РѕС‚РѕР±СЂР°Р¶Р°РµРјСѓСЋ РїРѕРґРїРёСЃСЊ РІ РјРµРЅСЋ вЂ” `EventHandlers.handleKeyDown` РѕСЃС‚Р°С‘С‚СЃСЏ С…Р°СЂРґРєРѕРґ-С†РµРїРѕС‡РєРѕР№ if/else Рё РЅРµ С‡РёС‚Р°РµС‚ `shortcuts.json` РІ СЂР°РЅС‚Р°Р№РјРµ (`src/utils/ShortcutFormatter.js`, `src/managers/MenuManager.js`, `src/ui/SettingsPanel.js`, `config/menu.js`, `config/defaults/shortcuts.json`).

- **РЈРґР°Р»РµРЅС‹ РїСѓРЅРєС‚С‹ В«Swap PanelsВ»** РёР· `src/ui/CanvasContextMenu.js` Рё `src/ui/AssetPanelContextMenu.js` (Р±С‹Р»Рё РЅРµР·Р°РІРёСЃРёРјС‹Рµ РїСѓРЅРєС‚С‹ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ, Р±РµР· РѕР±С‰РµРіРѕ СЂРѕРґРёС‚РµР»СЏ/РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјРѕРіРѕ РєРѕРјРїРѕРЅРµРЅС‚Р°).

- **Р¦РёРєР» РІС‹Р±РѕСЂР° РїРµСЂРµРєСЂС‹РІР°СЋС‰РёС…СЃСЏ РѕР±СЉРµРєС‚РѕРІ РїРѕ РїРѕРІС‚РѕСЂРЅС‹Рј РєР»РёРєР°Рј (Blender-style)** вЂ” `ObjectOperations.findObjectAtPoint(x, y, skipCycle = false)` С‚РµРїРµСЂСЊ СЃРѕР±РёСЂР°РµС‚ Р’РЎР• СЃРѕРІРїР°РґРµРЅРёСЏ РІ С‚РѕС‡РєРµ (Р° РЅРµ С‚РѕР»СЊРєРѕ РїРµСЂРІРѕРµ) Рё С‡РµСЂРµР· РЅРѕРІС‹Р№ `_pickWithClickCycle(x, y, sortedCandidates)` С†РёРєР»РёС‡РµСЃРєРё РїРµСЂРµР±РёСЂР°РµС‚ РёС… РїСЂРё РїРѕРІС‚РѕСЂРЅС‹С… РєР»РёРєР°С… РІ (РїСЂРёРјРµСЂРЅРѕ) С‚РѕР№ Р¶Рµ С‚РѕС‡РєРµ вЂ” РґРѕРїСѓСЃРє `~4 СЌРєСЂР°РЅРЅС‹С… px` (`4 / camera.zoom`, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ СѓСЂРѕРІРЅСЏ Р·СѓРјР°) РїСЂРё С‚РѕРј Р¶Рµ РЅР°Р±РѕСЂРµ РєР°РЅРґРёРґР°С‚РѕРІ (`candidateKey`); РєР»РёРє РІ РґСЂСѓРіРѕРµ РјРµСЃС‚Рѕ РёР»Рё РёР·РјРµРЅРёРІС€РёР№СЃСЏ РЅР°Р±РѕСЂ РєР°РЅРґРёРґР°С‚РѕРІ СЃР±СЂР°СЃС‹РІР°РµС‚ С†РёРєР» РЅР° РІРµСЂС…РЅРёР№ РѕР±СЉРµРєС‚. Р”РІРѕР№РЅРѕР№ РєР»РёРє (`MouseHandlers.handleDoubleClick`) С„РёР·РёС‡РµСЃРєРё СЃРѕСЃС‚РѕРёС‚ РёР· РґРІСѓС… РѕРґРёРЅРѕС‡РЅС‹С… РєР»РёРєРѕРІ вЂ” С‡С‚РѕР±С‹ СЌС‚Рѕ РЅРµ Р»РѕРјР°Р»Рѕ РѕС‚РєСЂС‹С‚РёРµ РіСЂСѓРїРїС‹ РґРІРѕР№РЅС‹Рј РєР»РёРєРѕРј, РєРѕРіРґР° РѕРЅР° РїРµСЂРµРєСЂС‹С‚Р° РґСЂСѓРіРёРј РѕР±СЉРµРєС‚РѕРј, РѕРЅ РІС‹Р·С‹РІР°РµС‚ `findObjectAtPoint(x, y, true)` (РЅРѕРІС‹Р№ РїР°СЂР°РјРµС‚СЂ `skipCycle`), РєРѕС‚РѕСЂС‹Р№ РёСЃРїРѕР»СЊР·СѓРµС‚ РЅРѕРІС‹Р№ `_pickFrontMost(x, y, sortedCandidates)` (СЃС‚Р°СЂРѕРµ, РЅРµС†РёРєР»РёС‡РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ) (`src/core/ObjectOperations.js`, `src/event-system/MouseHandlers.js`).

- **F2 вЂ” РіР»РѕР±Р°Р»СЊРЅРѕРµ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёРµ РІС‹РґРµР»РµРЅРЅРѕРіРѕ РѕР±СЉРµРєС‚Р°** вЂ” РЅРѕРІС‹Р№ `EventHandlers.renameSelectedObject()`: СЃСЂР°Р±Р°С‚С‹РІР°РµС‚, РµСЃР»Рё РІС‹РґРµР»РµРЅ СЂРѕРІРЅРѕ РѕРґРёРЅ РѕР±СЉРµРєС‚; РїРµСЂРµРєР»СЋС‡Р°РµС‚ РІРєР»Р°РґРєСѓ Р»РµРІРѕР№/РїСЂР°РІРѕР№ РїР°РЅРµР»Рё РЅР° Outliner (РєР°РєР°СЏ Р±С‹ РїР°РЅРµР»СЊ РµС‘ СЃРµР№С‡Р°СЃ РЅРё С…РѕСЃС‚РёР»Р° вЂ” РІРєР»Р°РґРєРё РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјС‹ РјРµР¶РґСѓ РїР°РЅРµР»СЏРјРё, СЃРј. `PanelPositionManager`), Р·Р°С‚РµРј РІС‹Р·С‹РІР°РµС‚ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `OutlinerPanel.startInlineRename(obj)` (`src/event-system/EventHandlers.js`).

- **Layer Solo (Ctrl+click РЅР° РёРєРѕРЅРєСѓ РіР»Р°Р·Р° СЃР»РѕСЏ РІ LayersPanel)** вЂ” `Layer.js` РїРѕР»СѓС‡РёР» РЅРѕРІРѕРµ transient-РїРѕР»Рµ `soloed` (РЅРµ СЃРµСЂРёР°Р»РёР·СѓРµС‚СЃСЏ). РќРѕРІС‹Р№ `LayersPanel.toggleLayerSolo(layerId)` вЂ” СЌРєСЃРєР»СЋР·РёРІРЅС‹Р№ solo: СЃР±СЂР°СЃС‹РІР°РµС‚ `soloed` Сѓ РІСЃРµС… РѕСЃС‚Р°Р»СЊРЅС‹С… СЃР»РѕС‘РІ, РїРѕРІС‚РѕСЂРЅС‹Р№ Ctrl+click РЅР° СѓР¶Рµ Р·Р°soloРµРЅРЅРѕРј СЃР»РѕРµ СЃРЅРёРјР°РµС‚ solo. РљР»РёРє-РѕР±СЂР°Р±РѕС‚С‡РёРє `.layer-visibility-btn` РїСЂРѕРІРµСЂСЏРµС‚ `e.ctrlKey || e.metaKey` Рё РІС‹Р·С‹РІР°РµС‚ solo РІРјРµСЃС‚Рѕ РѕР±С‹С‡РЅРѕРіРѕ toggle РІРёРґРёРјРѕСЃС‚Рё. `RenderOperations.getVisibleLayerIds()` С‚РµРїРµСЂСЊ solo-aware: РµСЃР»Рё РµСЃС‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ Р·Р°soloРµРЅРЅС‹Р№ СЃР»РѕР№, РІРёРґРёРјС‹Р№ РЅР°Р±РѕСЂ вЂ” С‚РѕР»СЊРєРѕ Р·Р°soloРµРЅРЅС‹Рµ СЃР»РѕРё, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ РёС… СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ `layer.visible`. РЎРѕР»Рѕ-СЃР»РѕР№ РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ Р¶С‘Р»С‚С‹Рј С†РІРµС‚РѕРј РёРєРѕРЅРєРё РіР»Р°Р·Р° (`updateLayerElement`) (`src/models/Layer.js`, `src/ui/LayersPanel.js`, `src/core/RenderOperations.js`).

- **Isolate РІС‹РґРµР»РµРЅРёСЏ (С…РѕС‚РєРµР№ `/`)** вЂ” РЅРѕРІС‹Р№ `ObjectOperations.toggleIsolateSelection()`: non-destructive (РЅРµ С‚СЂРѕРіР°РµС‚ `obj.visible`), top-level-РіСЂР°РЅСѓР»СЏСЂРЅРѕСЃС‚СЊ (РёР·РѕР»РёСЂСѓРµС‚СЃСЏ РІРµСЃСЊ РІРµСЂС…РЅРµСѓСЂРѕРІРЅРµРІС‹Р№ РѕР±СЉРµРєС‚/РіСЂСѓРїРїР° РІС‹РґРµР»РµРЅРёСЏ С†РµР»РёРєРѕРј, Р° РЅРµ РєРѕРЅРєСЂРµС‚РЅС‹Р№ РІР»РѕР¶РµРЅРЅС‹Р№ РїРѕС‚РѕРјРѕРє). РЎРѕСЃС‚РѕСЏРЅРёРµ С…СЂР°РЅРёС‚СЃСЏ РІ `stateManager` РєР°Рє `view.isolatedTopLevelIds` (`Set` РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂРѕРІ РІРµСЂС…РЅРµСѓСЂРѕРІРЅРµРІС‹С… РѕР±СЉРµРєС‚РѕРІ, Р»РёР±Рѕ `null`). РџРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ РІ `RenderOperations.render()` РїР°С‚С‚РµСЂРЅ Р·Р°С‚РµРјРЅРµРЅРёСЏ (`ctx.filter = 'grayscale(1) opacity(0.4)'`, СЂР°РЅСЊС€Рµ РїСЂРёРјРµРЅСЏР»СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ group-edit-mode) вЂ” СЂР°СЃС€РёСЂРµРЅ СѓСЃР»РѕРІРёРµРј РїРѕ `isolatedTopLevelIds`. `ObjectOperations.getSelectableCandidateObjects()` С‚РѕР¶Рµ СѓС‡РёС‚С‹РІР°РµС‚ isolate вЂ” Р·Р°С‚РµРјРЅС‘РЅРЅРѕРµ РІРЅРµ isolate РЅРµ РєР»РёРєР°РµС‚СЃСЏ (`src/core/ObjectOperations.js`, `src/core/RenderOperations.js`).

- **Outliner: РёРєРѕРЅРєРё-РіР»Р°Р·Р° + СЃРµСЂС‹Р№ С†РІРµС‚ РёРјРµРЅРё СЃРєСЂС‹С‚С‹С… РѕР±СЉРµРєС‚РѕРІ** вЂ” РЅРѕРІС‹Р№ `OutlinerPanel.createVisibilityButton(item)` (РєР»РёРєР°Р±РµР»СЊРЅР°СЏ SVG-РёРєРѕРЅРєР° РіР»Р°Р·Р° СЃРїСЂР°РІР° РѕС‚ РёРјРµРЅРё РѕР±СЉРµРєС‚Р°, С‚Р° Р¶Рµ СЂР°Р·РјРµС‚РєР°, С‡С‚Рѕ РІ LayersPanel) Рё `updateVisibilityButton(visibilityBtn, nameSpan, obj)` (РѕР±РЅРѕРІР»СЏРµС‚ РёРєРѕРЅРєСѓ Рё РєСЂР°СЃРёС‚ `nameSpan.style.color` РІ `#6b7280`, РµСЃР»Рё `!obj.visible`). РџРѕРґРєР»СЋС‡РµРЅРѕ РІ `renderGroupNode`/`renderObjectNode` (С„Р°Р№Р» РёСЃРїРѕР»СЊР·СѓРµС‚ keyed-reconciliation вЂ” РєРЅРѕРїРєР° СЃРѕР·РґР°С‘С‚СЃСЏ РѕРґРёРЅ СЂР°Р· РїСЂРё `!existingNode`, РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РЅР° РєР°Р¶РґС‹Р№ СЂРµРЅРґРµСЂ). РљР»РёРє РїРѕ РёРєРѕРЅРєРµ РІС‹Р·С‹РІР°РµС‚ `ObjectOperations.toggleObjectVisibility()` (`src/ui/OutlinerPanel.js`).

- **H / Alt+H вЂ” РІРёРґРёРјРѕСЃС‚СЊ РѕР±СЉРµРєС‚РѕРІ** вЂ” РЅРѕРІС‹Р№ `ObjectOperations.toggleObjectVisibility(obj)` (РѕР±С‰РёР№ РґР»СЏ С…РѕС‚РєРµСЏ H Рё Outliner-РёРєРѕРЅРєРё): РїРµСЂРµРєР»СЋС‡Р°РµС‚ `obj.visible`; РµСЃР»Рё `obj.type === 'group'`, РєР°СЃРєР°РґРѕРј РїСЂРёРјРµРЅСЏРµС‚ С‚Рѕ Р¶Рµ Р·РЅР°С‡РµРЅРёРµ РєРѕ РІСЃРµРј РїРѕС‚РѕРјРєР°Рј С‡РµСЂРµР· `GroupTraversalUtils.getAllChildren(obj, true)` вЂ” РЅРµРѕР±С…РѕРґРёРјРѕ, С‚.Рє. `computeSelectableSet()`/`isObjectSelectable()` РїСЂРѕРІРµСЂСЏРµС‚ С‚РѕР»СЊРєРѕ СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ С„Р»Р°Рі `.visible` РѕР±СЉРµРєС‚Р° Р±РµР· РѕР±С…РѕРґР° РїСЂРµРґРєРѕРІ, РїРѕСЌС‚РѕРјСѓ Р±РµР· РєР°СЃРєР°РґР° СЃРєСЂС‹С‚С‹Рµ РІР»РѕР¶РµРЅРЅС‹Рµ РѕР±СЉРµРєС‚С‹ РіСЂСѓРїРїС‹ РѕСЃС‚Р°РІР°Р»РёСЃСЊ Р±С‹ РІС‹Р±РёСЂР°РµРјС‹РјРё (С…РѕС‚СЏ Рё РЅРµ РѕС‚СЂРёСЃРѕРІС‹РІР°Р»РёСЃСЊ вЂ” СЂРµРЅРґРµСЂ СѓР¶Рµ СЃР°Рј В«РїСЂСЏС‡РµС‚В» С‡РµСЂРµР· `CanvasRenderer.drawGroup`'s `if (!group.visible) return`). РќРѕРІС‹Р№ `ObjectOperations.toggleVisibilityForSelection()` (С…РѕС‚РєРµР№ `H`, РїСЂРёРјРµРЅСЏРµС‚ РєРѕ РІСЃРµРј РІС‹РґРµР»РµРЅРЅС‹Рј) Рё `unhideAllObjects()` (С…РѕС‚РєРµР№ `Alt+H`, РїРѕРєР°Р·С‹РІР°РµС‚ РІРѕРѕР±С‰Рµ РІСЃРµ СЃРєСЂС‹С‚С‹Рµ РѕР±СЉРµРєС‚С‹ РЅР° Р»СЋР±РѕРј СѓСЂРѕРІРЅРµ С‡РµСЂРµР· `GroupTraversalUtils.getAllObjects(level.objects, true)`). РћР±С‰РёР№ С…РІРѕСЃС‚ (СЃРѕС…СЂР°РЅРµРЅРёРµ РёСЃС‚РѕСЂРёРё, РёРЅРІР°Р»РёРґР°С†РёСЏ РєСЌС€РµР№, redraw, РѕР±РЅРѕРІР»РµРЅРёРµ РїР°РЅРµР»РµР№) РІС‹РЅРµСЃРµРЅ РІ `ObjectOperations.afterVisibilityChange()` (`src/core/ObjectOperations.js`).

- Р’СЃРµ РЅРѕРІС‹Рµ С…РѕС‚РєРµРё Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅС‹ РІ `config/defaults/shortcuts.json`: `editor.renameObject` (F2), `editor.isolateSelection` (`/`), `editor.hideSelected` (H), `editor.unhideAll` (Alt+H), `mouse.soloLayer` (Ctrl+click, РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅР°СЏ Р·Р°РїРёСЃСЊ вЂ” РєР°Рє Рё РґСЂСѓРіРёРµ Р·Р°РїРёСЃРё РєР°С‚РµРіРѕСЂРёРё `mouse`, СЂРµР±РёРЅРґРёРЅРі РЅРµРґРѕСЃС‚СѓРїРµРЅ), `ui.toggleLeftPanel`/`toggleRightPanel`/`toggleToolbar`/`toggleAssetsPanel` (Alt+1..4).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/event-system/EventHandlers.js` В· `src/event-system/MouseHandlers.js` В· `src/core/ObjectOperations.js` В· `src/core/RenderOperations.js` В· `src/models/Layer.js` В· `src/ui/LayersPanel.js` В· `src/ui/OutlinerPanel.js` В· `src/ui/CanvasContextMenu.js` В· `src/ui/AssetPanelContextMenu.js` В· `src/utils/ShortcutFormatter.js` (РЅРѕРІС‹Р№) В· `src/ui/SettingsPanel.js` В· `src/managers/MenuManager.js` В· `config/menu.js` В· `config/defaults/shortcuts.json`

---

### Fix вЂ” debug-СЂР°РјРєРё Object Boundaries/Object Collisions РёРіРЅРѕСЂРёСЂРѕРІР°Р»Рё РїРѕРІРѕСЂРѕС‚ (RenderOperations)

- **`drawSingleObjectBoundary`/`drawGroupBoundaries`/`drawSingleObjectCollision`/`drawGroupCollisions` СЂРёСЃРѕРІР°Р»Рё С‡РёСЃС‚С‹Р№ axis-aligned `ctx.strokeRect` Р±РµР· РїРѕРІРѕСЂРѕС‚Р°** вЂ” РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ РІСЂР°С‰РµРЅРёСЏ РѕР±СЉРµРєС‚Р°/РіСЂСѓРїРїС‹ РёР»Рё РµС‘ РїСЂРµРґРєРѕРІ (РЅР°РіР»СЏРґРЅРѕ РІРёРґРЅРѕ РЅР° СЃРєСЂРёРЅС€РѕС‚Рµ: СЃРёРЅСЏСЏ СЂР°РјРєР° РІС‹РґРµР»РµРЅРёСЏ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ вЂ” СЂРѕРјР±, Р·РµР»С‘РЅС‹Рµ debug-Р±РѕРєСЃС‹ boundaries РїРѕРґ РЅРµР№ вЂ” РїСЂСЏРјС‹Рµ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРєРё). Р­С‚Рѕ РѕС‚РґРµР»СЊРЅС‹Р№ Р±Р°Рі, РЅРµ РїРµСЂРµСЃРµРєР°СЋС‰РёР№СЃСЏ СЃ С„РёРєСЃРѕРј hit-testing РІС‹С€Рµ вЂ” С‚РѕС‚ РїСЂРѕ С‚Рѕ, Р§РўРћ СЃС‡РёС‚Р°РµС‚СЃСЏ В«РІРЅСѓС‚СЂРёВ» РїСЂРё РєР»РёРєРµ, СЌС‚РѕС‚ РїСЂРѕ С‚Рѕ, Р§РўРћ СЂРёСЃСѓРµС‚СЃСЏ РЅР° СЌРєСЂР°РЅРµ РґР»СЏ РѕС‚Р»Р°РґРєРё. РћР±Р° `drawSingleObjectBoundary` Рё `drawSingleObjectCollision` РїРµСЂРµРїРёСЃР°РЅС‹ РЅР° РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ rotation-aware РїСЂРёРјРёС‚РёРІР° `strokeFrame()`/`WorldPositionUtils.getFrameGeometry()` вЂ” С‚РѕРіРѕ Р¶Рµ, РєРѕС‚РѕСЂС‹Рј СЂРёСЃСѓРµС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ РїРѕРІС‘СЂРЅСѓС‚Р°СЏ СЂР°РјРєР° РІС‹РґРµР»РµРЅРёСЏ (`drawObjectSelectionRect`). `drawGroupBoundaries`/`drawGroupCollisions` Р±РѕР»СЊС€Рµ РЅРµ РґСѓР±Р»РёСЂСѓСЋС‚ box-Р»РѕРіРёРєСѓ РґР»СЏ РіСЂСѓРїРїС‹ РѕС‚РґРµР»СЊРЅРѕ РѕС‚ РѕРґРёРЅРѕС‡РЅРѕРіРѕ РѕР±СЉРµРєС‚Р° вЂ” РІС‹Р·С‹РІР°СЋС‚ `drawSingleObjectBoundary`/`drawSingleObjectCollision`(group) РЅР°РїСЂСЏРјСѓСЋ, С‚.Рє. `getFrameGeometry`/`getObjectWorldBounds` СѓР¶Рµ РѕРґРёРЅР°РєРѕРІРѕ РєРѕСЂСЂРµРєС‚РЅРѕ СЂР°Р±РѕС‚Р°СЋС‚ РґР»СЏ РѕР±РѕРёС… С‚РёРїРѕРІ. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: РІР»РѕР¶РµРЅРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° c1/c2 РІ B(45В°) РІ A(30В°) вЂ” Р·РµР»С‘РЅС‹Рµ/РєСЂР°СЃРЅС‹Рµ debug-СЂР°РјРєРё С‚РµРїРµСЂСЊ СЃРѕРІРїР°РґР°СЋС‚ СЃ С„РѕСЂРјРѕР№ СЃРёРЅРµР№ СЂР°РјРєРё РІС‹РґРµР»РµРЅРёСЏ (Screenshot РґРѕ/РїРѕСЃР»Рµ), 0 console errors (`src/core/RenderOperations.js`).

### Fix вЂ” РѕР±Р»Р°СЃС‚СЊ С…РёС‚-С‚РµСЃС‚Р° РїРѕРІС‘СЂРЅСѓС‚РѕР№ РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїС‹ РЅРµ СЃРѕРІРїР°РґР°Р»Р° СЃ СЂРµР°Р»СЊРЅРѕР№ РїРѕРІС‘СЂРЅСѓС‚РѕР№ СЂР°РјРєРѕР№ (WorldPositionUtils)

- **`isPointInWorldBounds()`: РґР»СЏ РіСЂСѓРїРї СЃ РїРѕРІС‘СЂРЅСѓС‚С‹Рј РїСЂРµРґРєРѕРј РѕР±Р»Р°СЃС‚СЊ РєР»РёРєР° Р±С‹Р»Р° СЂР°Р·РґСѓС‚Р°/СЃРјРµС‰РµРЅР° РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ СЂРµР°Р»СЊРЅРѕ РѕС‚СЂРёСЃРѕРІР°РЅРЅРѕР№ РїРѕРІС‘СЂРЅСѓС‚РѕР№ СЂР°РјРєРё** вЂ” РёСЃРїРѕР»СЊР·РѕРІР°Р»СЃСЏ `getWorldBounds(obj, ..., skipOwnRotation=true)`, РєРѕС‚РѕСЂС‹Р№ РґР»СЏ СЂРµРЅРґРµСЂР° СЂР°РјРєРё СЃРїРµС†РёР°Р»СЊРЅРѕ В«Р·Р°РїРµРєР°РµС‚В» РїРѕРІРѕСЂРѕС‚ РїСЂРµРґРєРѕРІ РІ СЂРµР·СѓР»СЊС‚Р°С‚ (РїРµСЂРµСЃС‚СЂР°РёРІР°РµС‚ AABB РїРѕ 4 РїРѕРІС‘СЂРЅСѓС‚С‹Рј СѓРіР»Р°Рј вЂ” РєРѕСЂСЂРµРєС‚РЅРѕ РґР»СЏ РѕС‚СЂРёСЃРѕРІРєРё, С‚.Рє. РґР°С‘С‚ РєРѕРЅСЃРµСЂРІР°С‚РёРІРЅС‹Р№ РѕС…РІР°С‚С‹РІР°СЋС‰РёР№ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє). `isPointInWorldBounds` Р·Р°С‚РµРј Р•Р©РЃ Р РђР— РѕР±СЂР°С‚РЅРѕ РїРѕРІРѕСЂР°С‡РёРІР°Р» С‚РѕС‡РєСѓ РєР»РёРєР° РЅР° РїРѕР»РЅС‹Р№ СѓРіРѕР» (РїСЂРµРґРєРё+СЃРІРѕР№) Рё СЃРІРµСЂСЏР» СЃ СЌС‚РёРј СѓР¶Рµ РїРѕРІС‘СЂРЅСѓС‚С‹Рј Рё СЂР°Р·РґСѓС‚С‹Рј Р±РѕРєСЃРѕРј вЂ” СѓРіРѕР» РїСЂРµРґРєРѕРІ СѓС‡РёС‚С‹РІР°Р»СЃСЏ РґРІР°Р¶РґС‹ Рё РЅРµСЃРѕРіР»Р°СЃРѕРІР°РЅРЅРѕ. Р—Р°РјРµРЅРµРЅРѕ РЅР° РїРѕРґС…РѕРґ РєР°Рє РґР»СЏ РїСЂРѕСЃС‚С‹С… РѕР±СЉРµРєС‚РѕРІ: Р±РµСЂС‘С‚СЃСЏ РїРѕР»РЅРѕСЃС‚СЊСЋ РЅРµРїРѕРІС‘СЂРЅСѓС‚С‹Р№ (РЅРё СЃРІРѕРёРј, РЅРё СЂРѕРґРёС‚РµР»СЊСЃРєРёРј СѓРіР»РѕРј) РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє С‡РµСЂРµР· `getLocalCenter()`/`obj.getBounds(true)`, РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ РёСЃС‚РёРЅРЅС‹Р№ РјРёСЂРѕРІРѕР№ С†РµРЅС‚СЂ (РёРЅРІР°СЂРёР°РЅС‚РµРЅ Рє РїРѕРІРѕСЂРѕС‚Сѓ) Рё С‚РѕС‡РєР° РєР»РёРєР° РѕР±СЂР°С‚РЅРѕ РїРѕРІРѕСЂР°С‡РёРІР°РµС‚СЃСЏ РЅР° `totalRotation` РІРѕРєСЂСѓРі РЅРµРіРѕ. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: СЃС‚СЂСѓРєС‚СѓСЂР° c1/c2 РІ B(rotation=45В°) РІРЅСѓС‚СЂРё A(rotation=30В°) вЂ” 2116 С‚РѕС‡РµРє СЃРµС‚РєРё СЃСЂР°РІРЅРµРЅС‹ СЃ СЌС‚Р°Р»РѕРЅРЅРѕР№ (РјР°С‚РµРјР°С‚РёС‡РµСЃРєРё С‚РѕС‡РЅРѕР№) РіРµРѕРјРµС‚СЂРёРµР№, Р±С‹Р»Рѕ 312 РЅРµСЃРѕРІРїР°РґРµРЅРёР№ (14.7%), СЃС‚Р°Р»Рѕ 0; СЂРµРіСЂРµСЃСЃРёСЏ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РґР»СЏ РїСЂРѕСЃС‚РѕР№ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ Р±РµР· РїСЂРµРґРєР° Рё РґР»СЏ РіСЂСѓРїРїС‹ Р±РµР· РїРѕРІРѕСЂРѕС‚Р° (`src/utils/WorldPositionUtils.js`).

### Fix вЂ” РЅРµР·РЅР°С‡РёС‚РµР»СЊРЅС‹Р№ РґСЂРµР№С„ СЃРѕСЃРµРґРµР№ РїСЂРё РёР·РІР»РµС‡РµРЅРёРё РѕР±СЉРµРєС‚Р° РёР· РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїС‹ (GroupOperations)

- **`extractObjectFromGroup()`: РєРѕРјРїРµРЅСЃР°С†РёСЏ СЂРѕРґРёС‚РµР»СЊСЃРєРёС… pivot'РѕРІ Р·Р°РїСѓСЃРєР°Р»Р°СЃСЊ Р”Рћ РІСЃС‚Р°РІРєРё РёР·РІР»РµС‡С‘РЅРЅРѕРіРѕ РѕР±СЉРµРєС‚Р° РІ parentGroup** вЂ” РїСЂРё РІР»РѕР¶РµРЅРЅС‹С… РїРѕРІС‘СЂРЅСѓС‚С‹С… РіСЂСѓРїРїР°С… (`B` РІРЅСѓС‚СЂРё `A`, РѕР±Рµ СЃ `rotation`) РєР°СЃРєР°РґРЅР°СЏ РєРѕРјРїРµРЅСЃР°С†РёСЏ (`_applyAncestorPivotCompensations`) РїСЂРёРјРµРЅСЏР»Р°СЃСЊ РѕРґРЅРёРј Р±Р»РѕРєРѕРј СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ СЂРµР±С‘РЅРєР° РёР· `B`, С‚.Рµ. Р”Рћ С‚РѕРіРѕ РєР°Рє СЌС‚РѕС‚ СЂРµР±С‘РЅРѕРє РґРѕР±Р°РІР»СЏР»СЃСЏ РІ `A.children`. РљРѕРјРїРµРЅСЃР°С†РёСЏ `A` СЃС‡РёС‚Р°Р»Р°СЃСЊ С‚РѕР»СЊРєРѕ РїРѕ СЌС„С„РµРєС‚Сѓ В«`B` РїРѕС‚РµСЂСЏР»Р° СЂРµР±С‘РЅРєР°В», РІС‚РѕСЂР°СЏ РїРµСЂС‚СѓСЂР±Р°С†РёСЏ (В«`A` РїРѕР»СѓС‡РёР»Р° СЂРµР±С‘РЅРєР°В») РѕСЃС‚Р°РІР°Р»Р°СЃСЊ РЅРµРєРѕРјРїРµРЅСЃРёСЂРѕРІР°РЅРЅРѕР№ в†’ `aSibling`/`c2` РІРЅСѓС‚СЂРё `A`/`B` РІРёР·СѓР°Р»СЊРЅРѕ СЃРјРµС‰Р°Р»РёСЃСЊ. Р Р°Р·Р±РёС‚Рѕ РЅР° РґРІРµ С„Р°Р·С‹: (1) `group` (B) РєРѕРјРїРµРЅСЃРёСЂСѓРµС‚СЃСЏ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ вЂ” РµС‘ bounds СѓР¶Рµ С„РёРЅР°Р»СЊРЅС‹; (2) РєРѕРјРїРµРЅСЃР°С†РёСЏ РѕСЃС‚Р°Р»СЊРЅС‹С… РїСЂРµРґРєРѕРІ (`ancestorPivots.slice(1)`, РІРєР»СЋС‡Р°СЏ `parentGroup`) РѕС‚Р»РѕР¶РµРЅР° РґРѕ РџРћРЎР›Р• РІСЃС‚Р°РІРєРё РІ `parentGroup` вЂ” РёС… bounds С„РёРЅР°Р»СЊРЅС‹ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РѕР±РѕРёС… РёР·РјРµРЅРµРЅРёР№. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ (3-СѓСЂРѕРІРЅРµРІР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° c1/c2 РІ B(60В°) РІ A(30В°) + aSibling): `aSiblingDrift`/`c2Drift`/`c1Drift` = `{dx:0, dy:0, dRot:0}` (`src/core/GroupOperations.js`).

### Fix вЂ” РјРѕСЂРіР°РЅРёРµ/РїСЂРѕРїР°РґР°РЅРёРµ РґСѓР±Р»РёРєР°С‚Р° РІ РјРѕРјРµРЅС‚ СЂР°Р·РјРµС‰РµРЅРёСЏ (DuplicateOperations)

- **`confirmPlacement()`: СѓР±СЂР°РЅР° debounce-Р·Р°РґРµСЂР¶РєР° РёРЅРІР°Р»РёРґР°С†РёРё РєСЌС€РµР№ СЂРµРЅРґРµСЂР° РґР»СЏ С‚РѕР»СЊРєРѕ С‡С‚Рѕ СЂР°Р·РјРµС‰С‘РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ** вЂ” РІС‹Р·С‹РІР°Р»СЃСЏ С‚РѕР»СЊРєРѕ `editor.scheduleCacheInvalidation()`, СЂРµР°Р»СЊРЅС‹Р№ СЃР±СЂРѕСЃ `visibleObjectsCache`/spatial index РёСЃРїРѕР»РЅСЏРµС‚СЃСЏ РІ `setTimeout` (~100РјСЃ, `PERFORMANCE.CACHE_TIMEOUT_MS`). РџРµСЂРІС‹Рµ РЅРµСЃРєРѕР»СЊРєРѕ РєР°РґСЂРѕРІ РїРѕСЃР»Рµ СЂР°Р·РјРµС‰РµРЅРёСЏ `render()` Р±СЂР°Р» СѓР¶Рµ Р·Р°РєСЌС€РёСЂРѕРІР°РЅРЅС‹Р№ (Р±РµР· РЅРѕРІРѕРіРѕ РѕР±СЉРµРєС‚Р°) СЃРїРёСЃРѕРє РІРёРґРёРјС‹С… РѕР±СЉРµРєС‚РѕРІ Рё spatial index, РµС‰С‘ РЅРµ Р·РЅР°СЋС‰РёР№ Рѕ РЅРѕРІРѕРј РѕР±СЉРµРєС‚Рµ вЂ” РєРѕРїРёСЏ РІРёР·СѓР°Р»СЊРЅРѕ РїСЂРѕРїР°РґР°Р»Р°/РјРѕСЂРіР°Р»Р° СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РёСЃС‡РµР·РЅРѕРІРµРЅРёСЏ preview-РїСЂРёР·СЂР°РєР° Рё РїРѕСЏРІР»СЏР»Р°СЃСЊ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёСЏ С‚Р°Р№РјРµСЂР°. Р”РѕР±Р°РІР»РµРЅС‹ СЃРёРЅС…СЂРѕРЅРЅС‹Рµ `renderOperations.clearVisibleObjectsCache()` + `markSpatialIndexDirty()` СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ `scheduleCacheInvalidation()` вЂ” СЃР»РµРґСѓСЋС‰РёР№ Р¶Рµ `render()` РІРёРґРёС‚ Р°РєС‚СѓР°Р»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ. РќРµ СЃРІСЏР·Р°РЅРѕ СЃ РїРµСЂС„-С„РёРєСЃР°РјРё render-loop/StateManager/compareStackOrder/OutlinerPanel вЂ” РѕС‚РґРµР»СЊРЅС‹Р№ Р±Р°Рі РёРјРµРЅРЅРѕ РІ РєСЌС€РёСЂРѕРІР°РЅРёРё СЃС†РµРЅС‹. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: `getVisibleObjects`/`spatialIndex` СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ `confirmPlacement()` СЃРѕРґРµСЂР¶Р°С‚ РЅРѕРІС‹Р№ РѕР±СЉРµРєС‚ (Р±С‹Р»Рѕ: С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ debounce) (`src/core/DuplicateOperations.js`).

- **Р¤РёРєСЃ: РІ group edit mode РјРѕР¶РЅРѕ Р±С‹Р»Рѕ РІС‹Р±СЂР°С‚СЊ РѕР±СЉРµРєС‚С‹ РІРЅСѓС‚СЂРё РІР»РѕР¶РµРЅРЅС‹С… child-РіСЂСѓРїРї** вЂ” `computeSelectableSet`, `findObjectAtPoint` Рё marquee СЂРµРєСѓСЂСЃРёРІРЅРѕ РѕР±С…РѕРґРёР»Рё РІСЃРµС… РїРѕС‚РѕРјРєРѕРІ Р°РєС‚РёРІРЅРѕР№ РіСЂСѓРїРїС‹. РџСЂР°РІРёР»Рѕ С‚РµРїРµСЂСЊ: (1) **РїСЂСЏРјС‹Рµ РґРµС‚Рё** Р°РєС‚РёРІРЅРѕР№ РіСЂСѓРїРїС‹ вЂ” РІС‹Р±РёСЂР°РµРјС‹; (2) **РІРЅРµС€РЅРёРµ top-level РѕР±СЉРµРєС‚С‹** (РЅРµ РІ РѕС‚РєСЂС‹С‚С‹С… РіСЂСѓРїРїР°С…) вЂ” РІС‹Р±РёСЂР°РµРјС‹, С‡С‚РѕР±С‹ РёС… РјРѕР¶РЅРѕ Р±С‹Р»Рѕ Р·Р°С‚СЏРЅСѓС‚СЊ РІРЅСѓС‚СЂСЊ; (3) РѕР±СЉРµРєС‚С‹ **РІРЅСѓС‚СЂРё child-РіСЂСѓРїРї** вЂ” РЅРµ РІС‹Р±РёСЂР°РµРјС‹ (С‚РѕР»СЊРєРѕ СЃР°РјР° child-РіСЂСѓРїРїР° РєР°Рє С†РµР»РѕРµ). (`src/core/ObjectOperations.js`, `src/event-system/MouseHandlers.js`)

- **Р¤РёРєСЃ: reparenting РѕР±СЉРµРєС‚РѕРІ/РіСЂСѓРїРї РІ РёРµСЂР°СЂС…РёРё СЃ СЃРѕС…СЂР°РЅРµРЅРёРµРј РІРёР·СѓР°Р»СЊРЅРѕРіРѕ С‚СЂР°РЅСЃС„РѕСЂРјР°** вЂ” РїРѕР»РЅР°СЏ РїРµСЂРµСЂР°Р±РѕС‚РєР° РЅР° РѕСЃРЅРѕРІРµ РїР°С‚С‚РµСЂРЅР° `worldPositionStays=true` (Unity/Godot). РўСЂРё РєРѕСЂРЅРµРІС‹Рµ РѕС€РёР±РєРё: (1) **pivot mismatch**: `worldPointToLocalPointInGroup` РІС‹Р·С‹РІР°Р»СЃСЏ РџРћРЎР›Р• СѓРґР°Р»РµРЅРёСЏ в†’ `getBounds()` СѓР¶Рµ РґСЂСѓРіРѕР№, pivot СЃРґРІРёРЅСѓС‚ в†’ РѕР±СЉРµРєС‚ РїРѕРїР°РґР°Р» РЅРµ С‚СѓРґР°; (2) **СЃРјРµС‰РµРЅРёРµ РѕСЃС‚Р°РІС€РёС…СЃСЏ РґРµС‚РµР№**: СѓРґР°Р»РµРЅРёРµ/РґРѕР±Р°РІР»РµРЅРёРµ СЂРµР±С‘РЅРєР° СЃРґРІРёРіР°РµС‚ pivot РіСЂСѓРїРїС‹, С‡С‚Рѕ РІРёР·СѓР°Р»СЊРЅРѕ СЃРјРµС‰Р°РµС‚ РІСЃРµС… РѕСЃС‚Р°Р»СЊРЅС‹С…; (3) **insertion Р±РµР· РїРѕРїСЂР°РІРєРё rotation**: РїСЂРё РїРµСЂРµРЅРѕСЃРµ РІ РїРѕРІС‘СЂРЅСѓС‚СѓСЋ РіСЂСѓРїРїСѓ `obj.rotation` РЅРµ РєРѕСЂСЂРµРєС‚РёСЂРѕРІР°Р»СЃСЏ в†’ РѕР±СЉРµРєС‚ РјРµРЅСЏР» РІРёР·СѓР°Р»СЊРЅС‹Р№ СѓРіРѕР». Р РµС€РµРЅРёРµ: `WorldPositionUtils.applyGroupPivotCompensation(group, pOld)` вЂ” РІРјРµСЃС‚Рѕ РїРµСЂРµСЃС‡С‘С‚Р° РєРѕРѕСЂРґРёРЅР°С‚ РІСЃРµС… РґРµС‚РµР№ РєРѕСЂСЂРµРєС‚РёСЂСѓРµС‚ `group.x/y` РїРѕ С„РѕСЂРјСѓР»Рµ `G.x -= (1-cosОё)В·О”x + sinОёВ·О”y` (РѕС‚РјРµРЅСЏРµС‚ РґСЂРµР№С„ `(Iв€’R)В·О”`). РќРѕРІС‹Р№ `GroupOperations.addObjectToGroup` РґР»СЏ insertion. Р’СЃРµ 4 РїСѓС‚Рё reparenting СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹: extract (Alt+drag), insert-to-group (drag-in, РѕР±Р° СѓСЂРѕРІРЅСЏ). (`src/utils/WorldPositionUtils.js`, `src/core/GroupOperations.js`, `src/event-system/MouseHandlers.js`)

- **Р¤РёРєСЃ: СЂР°РјРєР° РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ РїСЂРё РїРµСЂРµРјРµС‰РµРЅРёРё/Alt-drag РЅРµ СѓС‡РёС‚С‹РІР°Р»Р° rotation** вЂ” `RenderOperations.drawDuplicateObjects` РґР»СЏ РіСЂСѓРїРї СЃ `rotation` РїРѕР»СѓС‡Р°РµС‚ unrotated bounds С‡РµСЂРµР· `getDuplicateObjectBounds(..., skipOwnRotation=true)`. `drawAltDragSelectionRect` РїСЂРёРЅРёРјР°РµС‚ РѕР±СЉРµРєС‚, РІС‹Р·С‹РІР°РµС‚ `getFrameGeometry()`, РїРµСЂРµРґР°С‘С‚ `rotationDeg` РІ `strokeFrame`. (`src/core/RenderOperations.js`)

- **Tab drag visual polish** вЂ” ghost-С‚Р°Р± С‚РµРїРµСЂСЊ СЃРѕР·РґР°С‘С‚СЃСЏ С‡РµСЂРµР· `cloneNode(true)` СЃ РєР»Р°СЃСЃР°РјРё РѕСЂРёРіРёРЅР°Р»Р° (`.tab`/`.tab-right`/`.tab-left`): РІС‹РіР»СЏРґРёС‚ РёРґРµРЅС‚РёС‡РЅРѕ СЂРµР°Р»СЊРЅРѕР№ РІРєР»Р°РґРєРµ, С‚РѕР»СЊРєРѕ СЃ РЅР°РєР»РѕРЅРѕРј. `.tab-drag-ghost` CSS СЃРІРµРґС‘РЅ Рє С‡РёСЃС‚Рѕ РїРѕР·РёС†РёРѕРЅРЅС‹Рј СЃРІРѕР№СЃС‚РІР°Рј (`position:fixed`, `opacity`, `transform`, `box-shadow`). РџРѕРґСЃРІРµС‚РєР° С†РµР»РµРІРѕР№ РїР°РЅРµР»Рё: `.tab-drop-zone` РЅР° tab-bar Р·Р°РјРµРЅРµРЅР° РЅР° `.tab-panel--drag-over` РЅР° СЃР°РјРѕРј `aside`-СЌР»РµРјРµРЅС‚Рµ РїР°РЅРµР»Рё (`src/ui/PanelPositionManager.js`, `styles/main.css`).
- **Tab drag: РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰Р°СЏ РїР°РЅРµР»СЊ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‡РµСЂРµР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ View-РєРѕРјР°РЅРґСѓ РІРјРµСЃС‚Рѕ РєР°СЃС‚РѕРјРЅРѕР№ drop-Р·РѕРЅС‹** вЂ” РїСЂРё СЃС‚Р°СЂС‚Рµ РґСЂР°РіР° РІРєР»Р°РґРєРё, РµСЃР»Рё РїСЂРѕС‚РёРІРѕРїРѕР»РѕР¶РЅРѕР№ РїР°РЅРµР»Рё РЅРµС‚ РІ DOM, РІС‹Р·С‹РІР°РµС‚СЃСЏ `EventHandlers.togglePanel('leftPanel'/'rightPanel')` (С‚Р° Р¶Рµ РєРѕРјР°РЅРґР°, С‡С‚Рѕ Рё РїСѓРЅРєС‚ РјРµРЅСЋ View) вЂ” СЃРѕСЃС‚РѕСЏРЅРёРµ/prefs/С‡РµРєР±РѕРєСЃ РјРµРЅСЋ РѕСЃС‚Р°СЋС‚СЃСЏ СЃРёРЅС…СЂРѕРЅРЅС‹РјРё. Р•СЃР»Рё РґСЂР°Рі РѕС‚РјРµРЅСЏРµС‚СЃСЏ Р±РµР· РґСЂРѕРїР° РІ РЅРѕРІСѓСЋ РїР°РЅРµР»СЊ вЂ” РѕРЅР° СѓРґР°Р»СЏРµС‚СЃСЏ РѕР±СЂР°С‚РЅРѕ С‡РµСЂРµР· `removeEmptyPanel()`. РЈР±СЂР°РЅС‹ `_createNewPanelDropZones()`, `.tab-new-panel-zone*` CSS Рё РІСЃСЏ Р»РѕРіРёРєР° РіРѕР»СѓР±С‹С… Р·РѕРЅ-РїРѕРґСЃРєР°Р·РѕРє РїРѕ РєСЂР°СЏРј СЌРєСЂР°РЅР° (`src/ui/PanelPositionManager.js`, `styles/main.css`).
- **Р¤РёРєСЃ: РїРѕРґСЃРІРµС‚РєР°/РґСЂРѕРї РЅР° РЅРѕРІСѓСЋ (РїСѓСЃС‚СѓСЋ) РїР°РЅРµР»СЊ РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р»Рё** вЂ” РїРѕР»РѕСЃР° РІРєР»Р°РґРѕРє РїР°РЅРµР»Рё Р±РµР· РІРєР»Р°РґРѕРє СЃС…Р»РѕРїС‹РІР°РµС‚СЃСЏ РїРѕ РІС‹СЃРѕС‚Рµ РґРѕ ~1px (flex Р±РµР· children), Р° РґРµС‚РµРєС†РёСЏ С†РµР»Рё С‚СЂРµР±РѕРІР°Р»Р° РїРѕРїР°РґР°РЅРёСЏ РєСѓСЂСЃРѕСЂР° РёРјРµРЅРЅРѕ РЅР° РЅРµС‘ вЂ” РЅРµРґРѕСЃС‚РёР¶РёРјРѕ РїСЂРё РѕР±С‹С‡РЅРѕРј РґРІРёР¶РµРЅРёРё РјС‹С€Рё. Р”РµС‚РµРєС†РёСЏ РїРµСЂРµРїРёСЃР°РЅР° РЅР° `elUnder.closest('#left-tabs-panel, #right-tabs-panel')`: РїРѕРґСЃРІРµС‚РєР° `.tab-panel--drag-over` Рё РґСЂРѕРї С‚РµРїРµСЂСЊ СЂР°Р±РѕС‚Р°СЋС‚ РїСЂРё РЅР°РІРµРґРµРЅРёРё РЅР° Р»СЋР±СѓСЋ С‡Р°СЃС‚СЊ РїР°РЅРµР»Рё, РЅРµ С‚РѕР»СЊРєРѕ РЅР° РµС‘ С€Р°РїРєСѓ. Р—Р°РѕРґРЅРѕ СѓР±СЂР°РЅ РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Р№ `getValidTabBars()`/`Set` вЂ” id РїР°РЅРµР»РµР№ СѓРЅРёРєР°Р»СЊРЅС‹, РґРѕРї. scoping РёР·Р±С‹С‚РѕС‡РµРЅ (`src/ui/PanelPositionManager.js`).

- **Р¤РёРєСЃ: hit-testing РїРѕРІС‘СЂРЅСѓС‚С‹С… РіСЂСѓРїРї РёРіРЅРѕСЂРёСЂРѕРІР°Р» rotation** вЂ” РєР»РёРє РІ РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ РІС‹Р±РёСЂР°Р» РїРѕРІС‘СЂРЅСѓС‚СѓСЋ РіСЂСѓРїРїСѓ, РµСЃР»Рё РїРѕРїР°РґР°Р» РІ РµС‘ axis-aligned bounding box (AABB), РґР°Р¶Рµ РІРЅРµ СЂРµР°Р»СЊРЅРѕР№ РІРёР·СѓР°Р»СЊРЅРѕР№ РіРµРѕРјРµС‚СЂРёРё. `WorldPositionUtils.isPointInWorldBounds()` РґР»СЏ РіСЂСѓРїРї СЃ `totalRotation` С‚РµРїРµСЂСЊ РїРѕР»СѓС‡Р°РµС‚ unrotated bounds (С‡РµСЂРµР· `skipOwnRotation: true`), РІС‹С‡РёСЃР»СЏРµС‚ С†РµРЅС‚СЂ, РїСЂРёРјРµРЅСЏРµС‚ inverse rotation Рє С‚РѕС‡РєРµ РєР»РёРєР° (Р°РЅР°Р»РѕРіРёС‡РЅРѕ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ Р»РѕРіРёРєРµ РґР»СЏ РїСЂРѕСЃС‚С‹С… РѕР±СЉРµРєС‚РѕРІ) Рё РґРµР»Р°РµС‚ AABB-С‚РµСЃС‚ РІ Р»РѕРєР°Р»СЊРЅРѕР№ СЃРёСЃС‚РµРјРµ РєРѕРѕСЂРґРёРЅР°С‚. Р”Р»СЏ РїСЂРѕСЃС‚С‹С… РѕР±СЉРµРєС‚РѕРІ rotation-aware hit-testing СѓР¶Рµ Р±С‹Р» (`src/utils/WorldPositionUtils.js`).

### Perf вЂ” render loop dirty-flag, StateManager.update() Р±РµР· full-clone, O(1) stacking-order compare

#### вљЎ РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ

- **Render loop: РїСЂРѕРїСѓСЃРє РєР°РґСЂР°, РµСЃР»Рё РЅРёС‡РµРіРѕ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ** вЂ” `EventHandlers.startRenderLoop()` РІС‹Р·С‹РІР°Р» `editor.render()` Р±РµР·СѓСЃР»РѕРІРЅРѕ РЅР° РєР°Р¶РґС‹Р№ `requestAnimationFrame` (РїРѕСЃС‚РѕСЏРЅРЅС‹Рµ 60 СЂРµРЅРґРµСЂРѕРІ/СЃРµРє РґР°Р¶Рµ РЅР° РїРѕР»РЅРѕСЃС‚СЊСЋ СЃС‚Р°С‚РёС‡РЅРѕРј РєР°РЅРІР°СЃРµ). Р”РѕР±Р°РІР»РµРЅ `StateManager._needsRender` вЂ” С„Р»Р°Рі, РІС‹СЃС‚Р°РІР»СЏРµРјС‹Р№ РІ `true` РІРЅСѓС‚СЂРё `set()`/`update()` (СЌС‚Рѕ РїРѕРєСЂС‹РІР°РµС‚ РІСЃРµ РёРЅС‚РµСЂР°РєС‚РёРІРЅС‹Рµ РїСѓС‚Рё: mousemove СѓР¶Рµ Р±РµР·СѓСЃР»РѕРІРЅРѕ С€Р»С‘С‚ `mouse.x/y` С‡РµСЂРµР· `updateMouseState` РЅР° РєР°Р¶РґРѕРµ СЃРѕР±С‹С‚РёРµ, camera/selection/drag/marquee/duplicate вЂ” РІСЃС‘ РёРґС‘С‚ С‡РµСЂРµР· `stateManager`). Render loop С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°РµС‚ `editor.render()` С‚РѕР»СЊРєРѕ РµСЃР»Рё `stateManager.consumeNeedsRender()` РІРµСЂРЅСѓР» `true`. РќРµ РїРµСЂРµСЃРµРєР°РµС‚СЃСЏ СЃ 120 СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРјРё СЏРІРЅС‹РјРё РІС‹Р·РѕРІР°РјРё `editor.render()` РїРѕ РєРѕРґРѕРІРѕР№ Р±Р°Р·Рµ вЂ” РѕРЅРё РїСЂРѕРґРѕР»Р¶Р°СЋС‚ СЂР°Р±РѕС‚Р°С‚СЊ РЅР°РїСЂСЏРјСѓСЋ, РјРёРЅСѓСЏ loop. РќРµ РЅР°Р№РґРµРЅРѕ РЅРё РѕРґРЅРѕР№ С‡РёСЃС‚Рѕ time-based canvas-Р°РЅРёРјР°С†РёРё (marching ants, `lineDashOffset` Рё С‚.Рї.), РЅРµР·Р°РІРёСЃРёРјРѕР№ РѕС‚ state вЂ” РїСЂРѕРІРµСЂРµРЅРѕ `grep`. РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: 0 СЂРµРЅРґРµСЂРѕРІ Р·Р° 1 СЃРµРє РїСЂРѕСЃС‚РѕСЏ (Р±С‹Р»Рѕ ~60), РµРґРёРЅРёС‡РЅРѕРµ РёР·РјРµРЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РґР°С‘С‚ 1-2 СЂРµРЅРґРµСЂР° Рё РІРѕР·РІСЂР°С‚ Рє РїСЂРѕСЃС‚РѕСЋ (`EventHandlers.js`, `StateManager.js`).
- **StateManager.update(): СѓР±СЂР°РЅ full-clone СЃРѕСЃС‚РѕСЏРЅРёСЏ** вЂ” `update()` РґРµР»Р°Р» `{ ...this.state }` РЅР° РєР°Р¶РґС‹Р№ РІС‹Р·РѕРІ (РјСѓС‚РёСЂСѓРµС‚ РЅР° РєР°Р¶РґС‹Р№ mousemove/wheel/drag tick) РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ `oldValue` РІ `notifyListeners`. Р”Р»СЏ dotted-РєР»СЋС‡РµР№ (`'mouse.lastX'` Рё С‚.Рї., РїРѕРґР°РІР»СЏСЋС‰РµРµ Р±РѕР»СЊС€РёРЅСЃС‚РІРѕ РІС‹Р·РѕРІРѕРІ) `oldState[key]` РІСЃРµРіРґР° Р±С‹Р»Р° `undefined` вЂ” РєР»РѕРЅРёСЂРѕРІР°РЅРёРµ Р±С‹Р»Рѕ С‡РёСЃС‚РѕР№ С‚СЂР°С‚РѕР№ Р±РµР· РїРѕР»СЊР·С‹ РґР»СЏ СЌС‚РёС… РєР»СЋС‡РµР№. РџРµСЂРµРїРёСЃР°РЅРѕ РїРѕ Р°РЅР°Р»РѕРіРёРё СЃ `set()`: `oldValue` С‡РёС‚Р°РµС‚СЃСЏ С‚РѕС‡РµС‡РЅРѕ РїРѕ РєР°Р¶РґРѕРјСѓ РєР»СЋС‡Сѓ РЅРµРїРѕСЃСЂРµРґСЃС‚РІРµРЅРЅРѕ РїРµСЂРµРґ РµРіРѕ РїРµСЂРµР·Р°РїРёСЃСЊСЋ, Р±РµР· РєР»РѕРЅРёСЂРѕРІР°РЅРёСЏ РґРµСЂРµРІР° С†РµР»РёРєРѕРј. РџРѕР±РѕС‡РЅС‹Р№ СЌС„С„РµРєС‚ вЂ” С‚РµРїРµСЂСЊ `oldValue` РІ РїРѕРґРїРёСЃРєР°С… РєРѕСЂСЂРµРєС‚РµРЅ Рё РґР»СЏ nested-РєР»СЋС‡РµР№ (СЂР°РЅСЊС€Рµ Р±С‹Р» РІСЃРµРіРґР° `undefined`). РџСЂРѕРІРµСЂРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: `subscribe` РЅР° `'mouse.lastX'` РїРѕР»СѓС‡Р°РµС‚ РІРµСЂРЅС‹Р№ `oldVal` РїРѕСЃР»Рµ `update()` (`StateManager.js`).
- **`Level.compareStackOrder`: O(1) СЃСЂР°РІРЅРµРЅРёРµ РІРјРµСЃС‚Рѕ O(NГ—D) РґРІРѕР№РЅРѕРіРѕ tree-search Р·Р° СЃСЂР°РІРЅРµРЅРёРµ** вЂ” РєРѕРјРїР°СЂР°С‚РѕСЂ РІС‹Р·С‹РІР°Р» `GroupTraversalUtils.findObjectPath()` РґРІР°Р¶РґС‹ РЅР° РєР°Р¶РґСѓСЋ РїР°СЂСѓ СЃСЂР°РІРЅРёРІР°РµРјС‹С… РѕР±СЉРµРєС‚РѕРІ (РїРѕР»РЅС‹Р№ DFS РѕС‚ РєРѕСЂРЅСЏ), РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІ `Array.sort` (`RenderOperations.getVisibleObjects` вЂ” РєР°Р¶РґС‹Р№ РєР°РґСЂ РїСЂРё РґРІРёР¶РµРЅРёРё РєР°РјРµСЂС‹; `ObjectOperations._sortObjectsByZIndexDescending` вЂ” РЅР° РєР°Р¶РґС‹Р№ hit-test), С‚.Рµ. O(NГ—D) РїРѕРёСЃРє СѓРјРЅРѕР¶Р°Р»СЃСЏ РЅР° O(M log M) СЃСЂР°РІРЅРµРЅРёР№ СЃРѕСЂС‚РёСЂРѕРІРєРё. Р”РѕР±Р°РІР»РµРЅС‹ `Level.buildStackOrderIndex()` (РѕРґРёРЅ O(N) DFS-РїСЂРѕС…РѕРґ, РЅР°Р·РЅР°С‡Р°СЋС‰РёР№ РєР°Р¶РґРѕРјСѓ РѕР±СЉРµРєС‚Сѓ РїРѕСЂСЏРґРєРѕРІС‹Р№ РЅРѕРјРµСЂ вЂ” pre-order DFS СЌРєРІРёРІР°Р»РµРЅС‚РµРЅ Р»РµРєСЃРёРєРѕРіСЂР°С„РёС‡РµСЃРєРѕРјСѓ СЃСЂР°РІРЅРµРЅРёСЋ РїСѓС‚РµР№) Рё `Level.compareStackOrderIndexed(a, b, index)` (O(1) СЃСЂР°РІРЅРµРЅРёРµ РїРѕ РїСЂРµРґРІС‹С‡РёСЃР»РµРЅРЅРѕРјСѓ РёРЅРґРµРєСЃСѓ). РРЅРґРµРєСЃ СЃС‚СЂРѕРёС‚СЃСЏ РѕРґРёРЅ СЂР°Р· РїРµСЂРµРґ `.sort()`, РЅРµ РїРµСЂСЃРёСЃС‚РµРЅС‚РЅС‹Р№ (Р±РµР· РёРЅРІР°Р»РёРґР°С†РёРё, РІСЃРµРіРґР° СЃРІРµР¶РёР№ РЅР° РїРµСЂРµСЃС‡С‘С‚) вЂ” РёСЃРєР»СЋС‡Р°РµС‚ СЂРёСЃРє СЂР°СЃСЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё СЃ РЅРѕРІС‹Рј `ObjectOperations.applyStackOrderAction` (Bring to Front Рё С‚.Рґ.), РєРѕС‚РѕСЂС‹Р№ РЅРµ РїСЂРѕС…РѕРґРёС‚ С‡РµСЂРµР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ `markSpatialIndexDirty()`-С‚РѕС‡РєРё. РЎС‚Р°СЂС‹Р№ `compareStackOrder` (path-search) РѕСЃС‚Р°РІР»РµРЅ РЅРµС‚СЂРѕРЅСѓС‚С‹Рј РґР»СЏ РѕСЃС‚Р°Р»СЊРЅС‹С… РѕРґРёРЅРѕС‡РЅС‹С… РІС‹Р·РѕРІРѕРІ. РџСЂРѕРІРµСЂРµРЅРѕ СЌРєРІРёРІР°Р»РµРЅС‚РЅРѕСЃС‚СЊСЋ РЅР° СЃРёРЅС‚РµС‚РёС‡РµСЃРєРѕРј РґРµСЂРµРІРµ (64 РїР°СЂС‹ СЃСЂР°РІРЅРµРЅРёР№, 0 СЂР°СЃС…РѕР¶РґРµРЅРёР№) (`Level.js`, `RenderOperations.js`, `ObjectOperations.js`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/event-system/EventHandlers.js` В· `src/managers/StateManager.js` В· `src/models/Level.js` В· `src/core/RenderOperations.js` В· `src/core/ObjectOperations.js`

---

### Perf вЂ” OutlinerPanel: incremental keyed DOM diff РІРјРµСЃС‚Рѕ full teardown/rebuild

#### вљЎ РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ

- **OutlinerPanel.render(): keyed reconciliation РІРјРµСЃС‚Рѕ РїРѕР»РЅРѕР№ РїРµСЂРµСЃР±РѕСЂРєРё DOM** вЂ” `render()` РЅР° РєР°Р¶РґС‹Р№ РІС‹Р·РѕРІ СЃРЅРѕСЃРёР» Рё РїРµСЂРµСЃРѕР·РґР°РІР°Р» РІСЃРµ DOM-СѓР·Р»С‹ СЃРїРёСЃРєР° РѕР±СЉРµРєС‚РѕРІ (РїСЂРё ~2000 РѕР±СЉРµРєС‚РѕРІ вЂ” 200-400РјСЃ Р·Р° РІС‹Р·РѕРІ; Р·Р°РјРµСЂРµРЅРѕ С‡РµСЂРµР· chrome-devtools РїСЂРё РїСЂРѕС„РёР»РёСЂРѕРІР°РЅРёРё В«Р»Р°РіР° РїСЂРё СЂР°Р·РјРµС‰РµРЅРёРё РґСѓР±Р»РёРєР°С‚Р°В»: `updateAllPanels()` в†’ `outlinerPanel.render()` РґРѕРјРёРЅРёСЂРѕРІР°Р» РЅР°Рґ РІСЃРµРј РѕСЃС‚Р°Р»СЊРЅС‹Рј РІРјРµСЃС‚Рµ РІР·СЏС‚С‹Рј вЂ” СЃР°Рј `confirmPlacement` Р±РµР· РЅРµРіРѕ ~5РјСЃ). РўРµРїРµСЂСЊ: (1) РєРѕРЅС‚РµР№РЅРµСЂ `#outliner-objects-container` СЃРѕР·РґР°С‘С‚СЃСЏ РѕРґРёРЅ СЂР°Р· Рё РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ (middle-mouse panning Р±РёРЅРґРёС‚СЃСЏ РѕРґРЅРѕРєСЂР°С‚РЅРѕ; `ScrollUtils.setupMiddleMouseScrolling` РґРµРґСѓРїРёС‚ РїРѕ РєРѕРЅС‚РµР№РЅРµСЂСѓ); (2) РЅРѕРІС‹Р№ `buildFlatRenderList()` вЂ” DFS-СЂР°Р·РІС‘СЂС‚РєР° РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅРЅРѕРіРѕ РґРµСЂРµРІР° РІ РїР»РѕСЃРєРёР№ СЃРїРёСЃРѕРє `{obj, depth}` СЃ СѓС‡С‘С‚РѕРј collapsed-РіСЂСѓРїРї Рё РїРѕРёСЃРєР° (С‚Р° Р¶Рµ Р»РѕРіРёРєР°, С‡С‚Рѕ Р±С‹Р»Р° РІ СЂРµРєСѓСЂСЃРёРё `renderGroupNode`); (3) РЅРѕРІС‹Р№ `reconcileFlatList()` вЂ” keyed diff РїРѕ `Map<objId, node>` (`_itemNodeCache`): РЅРµРёР·РјРµРЅС‘РЅРЅС‹Рµ СѓР·Р»С‹ РїРµСЂРµРёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РЅР° РјРµСЃС‚Рµ (O(1) РїСЂРѕРІРµСЂРєР° РїРѕР·РёС†РёРё, РЅРѕР»СЊ DOM-РѕРїРµСЂР°С†РёР№), РЅРѕРІС‹Рµ СЃРѕР·РґР°СЋС‚СЃСЏ, РїРµСЂРµСЃС‚Р°РІР»РµРЅРЅС‹Рµ РґРІРёРіР°СЋС‚СЃСЏ С‡РµСЂРµР· `insertBefore` (move, РЅРµ clone), РёСЃС‡РµР·РЅСѓРІС€РёРµ СѓРґР°Р»СЏСЋС‚СЃСЏ; (4) `renderGroupNode`/`renderObjectNode` РїРµСЂРµРІРµРґРµРЅС‹ РЅР° create-or-refresh СЃРёРіРЅР°С‚СѓСЂСѓ `(obj, depth, existingNode)` вЂ” РїСЂРё reuse РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РёР·РјРµРЅСЏРµРјС‹Рµ С‡Р°СЃС‚Рё (paddingLeft/РёРјСЏ/СЃС‡С‘С‚С‡РёРє РґРµС‚РµР№/collapse-РіР»РёС„/locked/selected), listeners РЅРµ РїРµСЂРµРІРµС€РёРІР°СЋС‚СЃСЏ; (5) click/dblclick-С…РµРЅРґР»РµСЂС‹ РёС‰СѓС‚ РѕР±СЉРµРєС‚ РїРѕ `item.dataset.id` С‡РµСЂРµР· `level.findObjectById()` РІ РјРѕРјРµРЅС‚ РєР»РёРєР°, Р° РЅРµ Р·Р°РјС‹РєР°СЋС‚ СЃСЃС‹Р»РєСѓ РЅР° РѕР±СЉРµРєС‚ вЂ” reused-СѓР·РµР» РѕСЃС‚Р°С‘С‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅС‹Рј РїРѕСЃР»Рµ undo/redo, Р·Р°РјРµРЅСЏСЋС‰РµРіРѕ РѕР±СЉРµРєС‚С‹; (6) inline-rename input РЅРµ РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµС‚СЃСЏ, РїРѕРєР° РІ С„РѕРєСѓСЃРµ. Р‘Р°РЅРЅРµСЂ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РїРѕРёСЃРєР° вЂ” РѕРґРёРЅРѕС‡РЅС‹Р№ СѓР·РµР» РІРЅРµ diff. Р—Р°РјРµСЂ РїРѕСЃР»Рµ (С‚Рµ Р¶Рµ 2000 РѕР±СЉРµРєС‚РѕРІ): cold render (РІСЃРµ СѓР·Р»С‹ СЃРѕР·РґР°СЋС‚СЃСЏ) ~77РјСЃ, warm render (РЅРёС‡РµРіРѕ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ) ~30РјСЃ, `confirmPlacement` РґСѓР±Р»РёРєР°С‚Р° 174РјСЃ в†’ 57РјСЃ. Р‘СЂР°СѓР·РµСЂРЅР°СЏ РІРµСЂРёС„РёРєР°С†РёСЏ: click-selection, collapse/expand РіСЂСѓРїРїС‹ (РёРЅРґРёРєР°С‚РѕСЂ+СЃРєСЂС‹С‚РёРµ РґРµС‚РµР№), СѓРґР°Р»РµРЅРёРµ РѕР±СЉРµРєС‚Р°, РІР»РѕР¶РµРЅРЅРѕСЃС‚СЊ СЃ depth-РѕС‚СЃС‚СѓРїР°РјРё, РїРѕСЂСЏРґРѕРє СЃС‚СЂРѕРє вЂ” РІСЃС‘ РєРѕСЂСЂРµРєС‚РЅРѕ, 0 console errors (`src/ui/OutlinerPanel.js`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/ui/OutlinerPanel.js`

---

- **Backspace-to-reset (Blender-style hover reset)** вЂ” РіР»РѕР±Р°Р»СЊРЅС‹Р№ С…РѕС‚РєРµР№ `Backspace`: РµСЃР»Рё РєСѓСЂСЃРѕСЂ РјС‹С€Рё РЅР°РІРµРґС‘РЅ РЅР° РєРѕРЅРєСЂРµС‚РЅРѕРµ resettable-РїРѕР»Рµ РІ DetailsPanel/SettingsPanel вЂ” РѕРЅРѕ СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ Рє РґРµС„РѕР»С‚РЅРѕРјСѓ Р·РЅР°С‡РµРЅРёСЋ; РµСЃР»Рё РЅР°РІРµРґС‘РЅ РЅР° Р·Р°РіРѕР»РѕРІРѕРє/РєРѕРЅС‚РµР№РЅРµСЂ СЃРµРєС†РёРё (Р»СЋР±РѕР№ СѓСЂРѕРІРµРЅСЊ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё, РІРєР»СЋС‡Р°СЏ РІР»РѕР¶РµРЅРЅС‹Рµ РїРѕРґСЃРµРєС†РёРё) вЂ” СЃР±СЂР°СЃС‹РІР°СЋС‚СЃСЏ РІСЃРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕР»СЏ РІРЅСѓС‚СЂРё РЅРµС‘. РћРїСЂРµРґРµР»СЏРµС‚СЃСЏ С‡РµСЂРµР· `:hover` (`document.querySelectorAll(':hover')`, РїРѕСЃР»РµРґРЅРёР№ СЌР»РµРјРµРЅС‚ вЂ” СЂРµР°Р»СЊРЅРѕ С‚Рѕ, С‡С‚Рѕ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј), Р° РЅРµ С‡РµСЂРµР· С„РѕРєСѓСЃ РєР»Р°РІРёР°С‚СѓСЂС‹ вЂ” С‚Рѕ РµСЃС‚СЊ В«С‡С‚Рѕ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј РІ РјРѕРјРµРЅС‚ РЅР°Р¶Р°С‚РёСЏВ», Р° РЅРµ В«С‡С‚Рѕ СЃРµР№С‡Р°СЃ СЂРµРґР°РєС‚РёСЂСѓРµС‚СЃСЏВ». РќРµ РјРµС€Р°РµС‚ РѕР±С‹С‡РЅРѕРјСѓ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЋ С‚РµРєСЃС‚Р°: РµСЃР»Рё РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј СЂРѕРІРЅРѕ РѕРґРЅРѕ РїРѕР»Рµ Рё РѕРЅРѕ Р¶Рµ РІ С„РѕРєСѓСЃРµ СЃ С‚РµРєСЃС‚РѕРІС‹Рј РІРІРѕРґРѕРј вЂ” `Backspace` СЂР°Р±РѕС‚Р°РµС‚ РєР°Рє РѕР±С‹С‡РЅРѕРµ СѓРґР°Р»РµРЅРёРµ СЃРёРјРІРѕР»Р°. РќРѕРІС‹Р№ РјРѕРґСѓР»СЊ-СЃРёРЅРіР»С‚РѕРЅ `ResetRegistry` (`src/utils/ResetRegistry.js`) С…СЂР°РЅРёС‚ `Map<scopeKey, {element, defaultValue}[]>`; РїР°РЅРµР»Рё СЂРµРіРёСЃС‚СЂРёСЂСѓСЋС‚ СЃРІРѕРё resettable-РїРѕР»СЏ РЅР° РєР°Р¶РґС‹Р№ СЂРµРЅРґРµСЂ (`ResetRegistry.setFields(scopeKey, fields)`), С‚РѕС‡РєР° РІС…РѕРґР° вЂ” `ResetRegistry.handleBackspace()`, РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· `EventHandlers.handleKeyDown` РґРѕ РїСЂРѕРІРµСЂРєРё С„РѕРєСѓСЃР° РЅР° INPUT/TEXTAREA. РђСЂС…РёС‚РµРєС‚СѓСЂРЅРѕ СЃР±СЂРѕСЃ РЅРµ СЃРѕРґРµСЂР¶РёС‚ СЃРѕР±СЃС‚РІРµРЅРЅРѕР№ commit-Р»РѕРіРёРєРё: `applyDefault()` РїСЂРѕСЃС‚Р°РІР»СЏРµС‚ `element.value`/`element.checked` Рё РґРёСЃРїР°С‚С‡РёС‚ С‚Рµ Р¶Рµ `input`/`change`/`blur` DOM-СЃРѕР±С‹С‚РёСЏ, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ СЃР»СѓС€Р°СЋС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РєР°Р¶РґРѕР№ РїР°РЅРµР»Рё (РёСЃС‚РѕСЂРёСЏ/`notifyPropertyChange` РІ DetailsPanel; `ConfigManager`/`StateManager` sync РІ SettingsPanel) вЂ” РЅРѕР»СЊ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Р»РѕРіРёРєРё РїРµСЂСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё. `DetailsPanel.registerResettable(element, defaultValue)` РїРѕРґРєР»СЋС‡С‘РЅ РґР»СЏ РїРѕР»РµР№ Transform (x, y, width, height, rotation вЂ” РґРµС„РѕР»С‚С‹ С‡РµСЂРµР· РЅРѕРІСѓСЋ РєРѕРЅСЃС‚Р°РЅС‚Сѓ `TRANSFORM_DEFAULTS`, РёСЃРїРѕР»СЊР·СѓСЋС‰СѓСЋ СЂР°СЃС€РёСЂРµРЅРЅС‹Р№ `DEFAULT_OBJECT` СЃ РґРѕР±Р°РІР»РµРЅРЅС‹РјРё `X: 0, Y: 0, ROTATION: 0` РІ `EditorConstants.js`) Рё РґР»СЏ РїРѕР»СЏ Color РІ Visual (РѕРґРёРЅРѕС‡РЅС‹Р№ Рё multi-select); СЃРѕР·РЅР°С‚РµР»СЊРЅРѕ РЅРµ РїРѕРґРєР»СЋС‡РµРЅС‹ Name/Type (РЅРµС‚ РѕСЃРјС‹СЃР»РµРЅРЅРѕРіРѕ РґРµС„РѕР»С‚Р°) Рё Custom Properties (РЅРµС‚ СЃС…РµРјС‹ РґРµС„РѕР»С‚РѕРІ). `SettingsPanel.rebuildResetRegistry()` СЃРєР°РЅРёСЂСѓРµС‚ РІСЃРµ `[data-setting]`-СЌР»РµРјРµРЅС‚С‹ (РЅРµ CSS-РєР»Р°СЃСЃ вЂ” РѕР±С‹С‡РЅС‹Рµ РІРєР»Р°РґРєРё РёСЃРїРѕР»СЊР·СѓСЋС‚ `setting-input`, `GridSettings.js` вЂ” `settings-input`, РµРґРёРЅСЃС‚РІРµРЅРЅС‹Р№ РѕР±С‰РёР№ РјР°СЂРєРµСЂ вЂ” Р°С‚СЂРёР±СѓС‚ `data-setting`), РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ РєРѕРЅС†Рµ `setupSettingsInputs()`; РІРєР»Р°РґРєР° Hotkeys РЅРµ СѓС‡Р°СЃС‚РІСѓРµС‚ (С‚Р°Рј `.hotkey-input`/`data-shortcut`, read-only РґРµРєР»Р°СЂР°С†РёСЏ Р±РµР· РєРѕРЅС†РµРїС†РёРё РґРµС„РѕР»С‚Р°). РќРѕРІС‹Р№ РјРµС‚РѕРґ `ConfigManager.getDefault(path)` (Р·РµСЂРєР°Р»Рѕ `get(path)`) С‡РёС‚Р°РµС‚ РёР· Р·Р°РєРµС€РёСЂРѕРІР°РЅРЅРѕРіРѕ РіР»СѓР±РѕРєРѕРіРѕ РєР»РѕРЅР° `getDefaultConfigs()` (`this._defaultConfigsCache`, JSON-РєР»РѕРЅРёСЂРѕРІР°РЅРёРµ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ вЂ” `mergeConfigs()` РєРѕРїРёСЂСѓРµС‚ С‚РѕР»СЊРєРѕ С‚РѕРї-level РєР°С‚РµРіРѕСЂРёРё, РёРЅР°С‡Рµ РІР»РѕР¶РµРЅРЅС‹Рµ РїСѓС‚Рё РґРµР»РёР»Рё Р±С‹ РѕР±СЉРµРєС‚ СЃ Р¶РёРІС‹Рј `this.configs`). РҐРѕС‚РєРµР№ Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅ РІ `config/defaults/shortcuts.json` в†’ `ui.resetToDefault` (`key: "Backspace"`), РІРёРґРµРЅ РІ Settings в†’ Hotkeys (`src/utils/ResetRegistry.js`, `src/event-system/EventHandlers.js`, `src/constants/EditorConstants.js`, `src/ui/DetailsPanel.js`, `src/managers/ConfigManager.js`, `src/ui/SettingsPanel.js`, `config/defaults/shortcuts.json`).
  **Р¤РёРєСЃ (С‚РѕС‚ Р¶Рµ РґРµРЅСЊ):** (1) `findTargets()` СЌСЃРєР°Р»РёСЂРѕРІР°Р»СЃСЏ РґРѕ `document.body`/`documentElement`, РєРѕС‚РѕСЂС‹Рµ СЃС‚СЂСѓРєС‚СѓСЂРЅРѕ СЃРѕРґРµСЂР¶Р°С‚ РІРѕРѕР±С‰Рµ РІСЃРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ РїРѕР»СЏ вЂ” РёР·-Р·Р° СЌС‚РѕРіРѕ `Backspace` СЃСЂР°Р±Р°С‚С‹РІР°Р» РѕС‚РєСѓРґР° СѓРіРѕРґРЅРѕ РІ РёРЅС‚РµСЂС„РµР№СЃРµ, Р° РЅРµ С‚РѕР»СЊРєРѕ РЅР°Рґ РїР°РЅРµР»СЊСЋ; С‚РµРїРµСЂСЊ walk РѕСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РґРѕ body/html. (2) Width/Height СЃР±СЂР°СЃС‹РІР°Р»РёСЃСЊ РІ Р¶С‘СЃС‚РєРёРµ `32Г—32` РІРјРµСЃС‚Рѕ СЂРµР°Р»СЊРЅРѕРіРѕ СЂР°Р·РјРµСЂР° Р°СЃСЃРµС‚Р° вЂ” РґРѕР±Р°РІР»РµРЅ `DetailsPanel.getObjectDefaultSize(obj)` (РёС‰РµС‚ Р°СЃСЃРµС‚ РїРѕ `obj.imgSrc` С‡РµСЂРµР· `assetManager.getAllAssets()`, Р±РµСЂС‘С‚ РµРіРѕ `width`/`height`; Р±РµР· СЃРѕРІРїР°РґРµРЅРёСЏ вЂ” С„РѕР»Р»Р±СЌРє РЅР° `DEFAULT_OBJECT`). Р”Р»СЏ multi-select, РіРґРµ Сѓ РѕР±СЉРµРєС‚РѕРІ РјРѕРіСѓС‚ Р±С‹С‚СЊ СЂР°Р·РЅС‹Рµ Р°СЃСЃРµС‚С‹, `ResetRegistry`-РїРѕР»Рµ С‚РµРїРµСЂСЊ РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ `{element, reset: fn}` (РєР°СЃС‚РѕРјРЅР°СЏ С„СѓРЅРєС†РёСЏ СЃР±СЂРѕСЃР° РІРјРµСЃС‚Рѕ РѕРґРЅРѕРіРѕ СЃС‚Р°С‚РёС‡РЅРѕРіРѕ Р·РЅР°С‡РµРЅРёСЏ) вЂ” width/height РІ `setupMultipleTransformsListeners` СЃР±СЂР°СЃС‹РІР°СЋС‚ РєР°Р¶РґС‹Р№ РѕР±СЉРµРєС‚ Рє РµРіРѕ СЃРѕР±СЃС‚РІРµРЅРЅРѕРјСѓ РґРµС„РѕР»С‚Сѓ.

- **Z-РїРѕСЂСЏРґРѕРє РѕР±СЉРµРєС‚РѕРІ: СѓР±СЂР°РЅ `zIndex`, Р·Р°РјРµРЅС‘РЅ РЅР° РїРѕСЂСЏРґРѕРє РІ РјР°СЃСЃРёРІРµ (array-order stacking)** вЂ” Р·Р°РјРµРЅСЏРµС‚ (РЅРµ РґРѕРїРѕР»РЅСЏРµС‚) РґРІРµ РїСЂРµРґС‹РґСѓС‰РёРµ Р·Р°РїРёСЃРё В«zIndexВ» РЅРёР¶Рµ: С‚РѕС‡РµС‡РЅС‹Рµ РїР°С‚С‡Рё `getNextZIndex`/`fixZIndex` РЅРµ СѓСЃС‚СЂР°РЅРёР»Рё Р±Р°Рі (РєР»РёРє РїРѕ РїРµСЂРµРєСЂС‹РІР°СЋС‰РёРјСЃСЏ РѕР±СЉРµРєС‚Р°Рј РІРЅСѓС‚СЂРё РіСЂСѓРїРї РІС‹Р±РёСЂР°Р» РЅРµ С‚РѕС‚ РѕР±СЉРµРєС‚, С‡С‚Рѕ СЂРёСЃРѕРІР°Р»СЃСЏ СЃРІРµСЂС…Сѓ), РїСЂРёС‡РёРЅР° Р±С‹Р»Р° СЃС‚СЂСѓРєС‚СѓСЂРЅРѕР№ вЂ” `Level.buildFullObjectIndex`/`buildObjectPath` РЅРµ СѓС‡РёС‚С‹РІР°Р»Рё РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Рµ РІР»РѕР¶РµРЅРЅС‹Рµ РіСЂСѓРїРїС‹. РЎС…РµРјР° СѓР±СЂР°РЅР° С†РµР»РёРєРѕРј: `GameObject`/`Group` Р±РѕР»СЊС€Рµ РЅРµ С…СЂР°РЅСЏС‚ Рё РЅРµ СЃРµСЂРёР°Р»РёР·СѓСЋС‚ `zIndex` РІ `toJSON()`; z-РїРѕСЂСЏРґРѕРє С‚РµРїРµСЂСЊ вЂ” СЌС‚Рѕ РїСЂРѕСЃС‚Рѕ РїРѕР·РёС†РёСЏ РѕР±СЉРµРєС‚Р° РІ РєРѕРЅС‚РµР№РЅРµСЂРµ (`level.objects` РЅР° РІРµСЂС…РЅРµРј СѓСЂРѕРІРЅРµ, `group.children` РІРЅСѓС‚СЂРё РіСЂСѓРїРїС‹), РєР°Рє РІ СЃР»РѕСЏС… Photoshop/Figma. `Layer.index` (СЃР»РѕРё) РЅРµ С‚СЂРѕРЅСѓС‚, РѕСЃС‚Р°С‘С‚СЃСЏ РїРµСЂРІРёС‡РЅС‹Рј РєР»СЋС‡РѕРј СЃРѕСЂС‚РёСЂРѕРІРєРё. РќРѕРІРѕРµ: `GroupTraversalUtils.findObjectPath(topLevelObjects, targetId)` вЂ” DFS-РїСѓС‚СЊ РёРЅРґРµРєСЃРѕРІ РѕС‚ РєРѕСЂРЅСЏ РґРѕ РѕР±СЉРµРєС‚Р°; `Level.compareStackOrder(a, b)` вЂ” РµРґРёРЅС‹Р№ РєРѕРјРїР°СЂР°С‚РѕСЂ (СЃРЅР°С‡Р°Р»Р° layerIndex, Р·Р°С‚РµРј РїСѓС‚СЊ РІ РґРµСЂРµРІРµ), РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Рё СЂРµРЅРґРµСЂРѕРј (`RenderOperations.getVisibleObjects`), Рё hit-test'РѕРј (`ObjectOperations._sortObjectsByZIndexDescending`), РіР°СЂР°РЅС‚РёСЂСѓСЏ СЃРѕРІРїР°РґРµРЅРёРµ РєР»РёРєР° СЃ РѕС‚СЂРёСЃРѕРІРєРѕР№; `ObjectOperations.bringToFront/sendToBack/moveForward/moveBackward(obj)` + `getSiblingArray(obj)` вЂ” СЂСѓС‡РЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РїРѕСЂСЏРґРєРѕРј (splice/push/unshift/swap РЅР°Рґ РјР°СЃСЃРёРІРѕРј-РєРѕРЅС‚РµР№РЅРµСЂРѕРј). UI: РІ DetailsPanel (Advanced) С‡РёСЃР»РѕРІРѕРµ РїРѕР»Рµ В«Z-IndexВ» Р·Р°РјРµРЅРµРЅРѕ 4 РєРЅРѕРїРєР°РјРё РЅР° Р°РЅРіР»РёР№СЃРєРѕРј (СЃС‚Р°РЅРґР°СЂС‚РЅР°СЏ Illustrator/Figma С‚РµСЂРјРёРЅРѕР»РѕРіРёСЏ) вЂ” В«Bring to FrontВ» / В«Send to BackВ» / В«Bring ForwardВ» / В«Send BackwardВ» (`createOrderButtonsRow`, СЂР°Р±РѕС‚Р°РµС‚ РґР»СЏ РѕРґРёРЅРѕС‡РЅРѕРіРѕ Рё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРіРѕ РІС‹Р±РѕСЂР°), СЃ С…РѕС‚РєРµСЏРјРё `Ctrl+Shift+в†‘`/`Ctrl+Shift+в†“`/`Ctrl+в†‘`/`Ctrl+в†“` СЃРѕРѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕ (РѕР±СЂР°Р±РѕС‚РєР° РІ `EventHandlers.handleKeyDown`, РїСЂРёРІСЏР·РєР° Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅР° РІ `config/defaults/shortcuts.json` в†’ РІРёРґРЅР° РІ Settings в†’ Hotkeys). РљРЅРѕРїРєРё Рё С…РѕС‚РєРµРё РёСЃРїРѕР»СЊР·СѓСЋС‚ РѕР±С‰РёР№ `ObjectOperations.applyStackOrderAction()`, С‡С‚РѕР±С‹ РЅРµ СЂР°Р·СЉРµР·Р¶Р°С‚СЊСЃСЏ. РЈРґР°Р»РµРЅРѕ РёР· `Level.js`: `getNextZIndex`, `updateAllObjectZIndices`, `assignInitialZIndex`, `buildFullObjectIndex`, `buildObjectPath`, `isObjectInAnyGroup`, РјРёРіСЂР°С†РёРѕРЅРЅС‹Р№ Р±Р»РѕРє `fixZIndex` РІ `fromJSON` (`src/models/Level.js`, `src/models/Group.js`, `src/models/GameObject.js`, `src/models/Asset.js`, `src/utils/GroupTraversalUtils.js`, `src/utils/UIFactory.js`, `src/core/RenderOperations.js`, `src/ui/CanvasRenderer.js`, `src/core/ObjectOperations.js`, `src/event-system/EventHandlers.js`, `src/event-system/MouseHandlers.js`, `src/core/DuplicateOperations.js`, `src/ui/DetailsPanel.js`, `src/core/LayerOperations.js`, `src/managers/CacheManager.js`, `config/defaults/shortcuts.json`).

- **Rotate/Scale Р¶РµСЃС‚С‹ РѕР±СЉРµРєС‚РѕРІ** вЂ” Ctrl+click-drag РЅР° РѕР±СЉРµРєС‚Рµ РІСЂР°С‰Р°РµС‚ РІС‹РґРµР»РµРЅРёРµ РІРѕРєСЂСѓРі С†РµРЅС‚СЂР° РѕР±С‰РµРіРѕ world bounding box; Ctrl+Alt+click-drag СЂР°РІРЅРѕРјРµСЂРЅРѕ РјР°СЃС€С‚Р°Р±РёСЂСѓРµС‚ РІС‹РґРµР»РµРЅРёРµ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ С‚РѕРіРѕ Р¶Рµ С†РµРЅС‚СЂР° (РєР»Р°РјРїРёС‚СЃСЏ `TRANSFORM.MIN_SCALE_FACTOR=0.05`/`MAX_SCALE_FACTOR=20`). Р Р°Р±РѕС‚Р°РµС‚ РЅР° Р»СЋР±РѕРј СѓСЂРѕРІРЅРµ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё РіСЂСѓРїРї. РљР»РёРє РїРѕ РЅРµРІС‹РґРµР»РµРЅРЅРѕРјСѓ РѕР±СЉРµРєС‚Сѓ РґРµР»Р°РµС‚ РµРіРѕ РµРґРёРЅСЃС‚РІРµРЅРЅС‹Рј РІС‹РґРµР»РµРЅРёРµРј, РєР°Рє РїСЂРё РѕР±С‹С‡РЅРѕРј drag; Ctrl+click Р±РµР· drag Рё Ctrl+drag РїРѕ РїСѓСЃС‚РѕРјСѓ РјРµСЃС‚Сѓ (marquee toggle) РЅРµ РёР·РјРµРЅРёР»РёСЃСЊ. Alt+drag РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ С‚РµРїРµСЂСЊ СЃСЂР°Р±Р°С‚С‹РІР°РµС‚ С‚РѕР»СЊРєРѕ Р±РµР· Ctrl (Ctrl+Alt Р·Р°СЂРµР·РµСЂРІРёСЂРѕРІР°РЅ РїРѕРґ scale). `GameObject.rotation` (РіСЂР°РґСѓСЃС‹, РїРѕ С‡Р°СЃРѕРІРѕР№, РІРѕРєСЂСѓРі С†РµРЅС‚СЂР°; default 0) СЃРµСЂРёР°Р»РёР·СѓРµС‚СЃСЏ РІ `toJSON()`, `getBounds()`/`containsPoint()` rotation-aware; `Group.getBounds()` СѓС‡РёС‚С‹РІР°РµС‚ rotation РґРµС‚РµР№ Рё СЃРІРѕР№ rotation (РєРѕРЅСЃРµСЂРІР°С‚РёРІРЅС‹Р№ AABB). `CanvasRenderer` СЂРёСЃСѓРµС‚ РїРѕРІС‘СЂРЅСѓС‚С‹Рµ РѕР±СЉРµРєС‚С‹ Рё РіСЂСѓРїРїС‹ С‡РµСЂРµР· `ctx.translate`/`ctx.rotate`. Р Р°РјРєР° РІС‹РґРµР»РµРЅРёСЏ РїРѕРІС‘СЂРЅСѓС‚С‹С… РѕР±СЉРµРєС‚РѕРІ С‚РµРїРµСЂСЊ С‚РѕР¶Рµ РїРѕРІС‘СЂРЅСѓС‚Р° (`RenderOperations.drawObjectSelectionRect`, РЅРµРїРѕРІС‘СЂРЅСѓС‚С‹Р№ rect С‡РµСЂРµР· `getWorldBounds(..., skipOwnRotation=true)` РїРµСЂРµС†РµРЅС‚СЂРѕРІР°РЅ РЅР° РёРЅРІР°СЂРёР°РЅС‚РЅС‹Р№ Рє rotation С†РµРЅС‚СЂ AABB). РџР°РЅРµР»СЊ Details: СЃРµРєС†РёСЏ В«PositionВ» РїРµСЂРµРёРјРµРЅРѕРІР°РЅР° РІ В«TransformВ», РґРѕР±Р°РІР»РµРЅРѕ РїРѕР»Рµ В«RotationВ» (РіСЂР°РґСѓСЃС‹). РР·РІРµСЃС‚РЅС‹Рµ РѕРіСЂР°РЅРёС‡РµРЅРёСЏ v1: hit-test РґРµС‚РµР№ РІРЅСѓС‚СЂРё РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ РЅРµ СѓС‡РёС‚С‹РІР°РµС‚ РїРѕРІРѕСЂРѕС‚ СЂРѕРґРёС‚РµР»СЏ; Р¶РµСЃС‚ РїСЂРёРјРµРЅСЏРµС‚ РјРёСЂРѕРІС‹Рµ РґРµР»СЊС‚С‹ Рє Р»РѕРєР°Р»СЊРЅС‹Рј РєРѕРѕСЂРґРёРЅР°С‚Р°Рј (РєРѕСЂСЂРµРєС‚РЅРѕ, РїРѕРєР° СЂРѕРґРёС‚РµР»СЊСЃРєР°СЏ РіСЂСѓРїРїР° РЅРµ РїРѕРІС‘СЂРЅСѓС‚Р°) (`src/models/GameObject.js`, `src/models/Group.js`, `src/utils/WorldPositionUtils.js`, `src/ui/CanvasRenderer.js`, `src/core/RenderOperations.js`, `src/event-system/MouseHandlers.js`, `src/constants/EditorConstants.js`, `config/defaults/shortcuts.json`, `src/ui/SettingsPanel.js`, `src/ui/DetailsPanel.js`).

- **Shift РІРѕ РІСЂРµРјСЏ rotate/scale вЂ” СЃРЅР°Рї Рє Р°Р±СЃРѕР»СЋС‚РЅС‹Рј Р·РЅР°С‡РµРЅРёСЏРј, РЅРµ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Рј** вЂ” СЂР°РЅСЊС€Рµ `deltaDeg`/`factor` РѕРєСЂСѓРіР»СЏР»РёСЃСЊ СЃР°РјРё РїРѕ СЃРµР±Рµ, РёР·-Р·Р° С‡РµРіРѕ РёС‚РѕРіРѕРІС‹Р№ СѓРіРѕР»/РјР°СЃС€С‚Р°Р± РѕР±СЉРµРєС‚Р° Р·Р°РІРёСЃРµР» РѕС‚ РµРіРѕ РёСЃС…РѕРґРЅРѕРіРѕ Р·РЅР°С‡РµРЅРёСЏ (РЅРµ В«РІСЃС‚Р°С‘С‚В» РЅР° РєСЂСѓРіР»РѕРµ С‡РёСЃР»Рѕ). РСЃРїСЂР°РІР»РµРЅРѕ: РїСЂРё РІСЂР°С‰РµРЅРёРё `deltaDeg` РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ С‚Р°Рє, С‡С‚РѕР±С‹ СЂРµР·СѓР»СЊС‚РёСЂСѓСЋС‰РёР№ rotation РїРµСЂРІРѕРіРѕ РѕР±СЉРµРєС‚Р° СЃРЅР°РїС€РѕС‚Р° Р»С‘Рі РЅР° Р±Р»РёР¶Р°Р№С€РёР№ РєСЂР°С‚РЅС‹Р№ `TRANSFORM.ROTATION_SNAP_DEGREES` (10В°) СѓРіРѕР»; РїСЂРё РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРё РґРѕР±Р°РІР»РµРЅ `TRANSFORM.SCALE_SNAP_FACTOR` (10%) вЂ” С„Р°РєС‚РѕСЂ РѕРєСЂСѓРіР»СЏРµС‚СЃСЏ РґРѕ Р±Р»РёР¶Р°Р№С€РµРіРѕ РєСЂР°С‚РЅРѕРіРѕ С€Р°РіР° (`src/event-system/MouseHandlers.js`, `src/constants/EditorConstants.js`).

- **DetailsPanel: РїРѕР»СЏ Transform (Position/Size/Rotation) СЃС‚Р°Р»Рё РёРЅС‚РµСЂР°РєС‚РёРІРЅС‹РјРё** вЂ” СЂР°РЅСЊС€Рµ `obj[property]` РјРµРЅСЏР»РѕСЃСЊ РЅР° `input`, РЅРѕ `render()` РІС‹Р·С‹РІР°Р»СЃСЏ С‚РѕР»СЊРєРѕ РІ `notifyPropertyChange` РЅР° `blur`, РёР·-Р·Р° С‡РµРіРѕ С…РѕР»СЃС‚ РЅРµ РѕР±РЅРѕРІР»СЏР»СЃСЏ, РїРѕРєР° РЅРµ РїРѕС‚РµСЂСЏРЅ С„РѕРєСѓСЃ РїРѕР»СЏ. РўРµРїРµСЂСЊ `input`-Р»РёСЃС‚РµРЅРµСЂ (РѕРґРёРЅРѕС‡РЅС‹Р№ Рё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Р№ РІС‹Р±РѕСЂ) СЃСЂР°Р·Сѓ РІС‹Р·С‹РІР°РµС‚ `this.levelEditor.render()` РґР»СЏ Р¶РёРІРѕР№ РѕР±СЂР°С‚РЅРѕР№ СЃРІСЏР·Рё; `notifyPropertyChange` (markDirty, history-related side effects, РѕР±РЅРѕРІР»РµРЅРёРµ Р·Р°РіРѕР»РѕРІРєР° РІРєР»Р°РґРєРё) РїРѕ-РїСЂРµР¶РЅРµРјСѓ СЃСЂР°Р±Р°С‚С‹РІР°РµС‚ С‚РѕР»СЊРєРѕ РЅР° `blur`, С‡С‚РѕР±С‹ РЅРµ РїР»РѕРґРёС‚СЊ Р»РёС€РЅРёРµ СѓРІРµРґРѕРјР»РµРЅРёСЏ РЅР° РєР°Р¶РґРѕРµ РЅР°Р¶Р°С‚РёРµ РєР»Р°РІРёС€Рё (`src/ui/DetailsPanel.js`).

- **Р¤РёРєСЃ: СЂР°РјРєР° РіСЂСѓРїРїС‹ (group edit mode) Р·Р°РјРѕСЂР°Р¶РёРІР°Р»Р°СЃСЊ РІРѕ РІСЂРµРјСЏ Ctrl+Alt+drag (scale), СЂР°СЃС…РѕРґСЏСЃСЊ СЃ Р¶РёРІРѕР№ РєР°СЂС‚РёРЅРєРѕР№ РѕР±СЉРµРєС‚Р°** вЂ” `drawGroupEditFrame` РёСЃРїРѕР»СЊР·СѓРµС‚ `groupEditMode.frozenBounds`, РµСЃР»Рё `frameFrozen` (Р·Р°РґСѓРјР°РЅРѕ РґР»СЏ В«РІС‹РЅРµСЃС‚Рё РѕР±СЉРµРєС‚ РёР· РіСЂСѓРїРїС‹В» С‡РµСЂРµР· Alt+drag вЂ” СЂР°РјРєР° РЅРµ РґРѕР»Р¶РЅР° РјРёРіР°С‚СЊ, РїРѕРєР° `dragSelectedObjects` РѕРїСЂРµРґРµР»СЏРµС‚ РїРµСЂРµСЃРµС‡РµРЅРёРµ СЃ РіСЂР°РЅРёС†Р°РјРё РіСЂСѓРїРїС‹). РЈСЃР»РѕРІРёРµ Р·Р°РјРѕСЂРѕР·РєРё РїСЂРѕРІРµСЂСЏР»Рѕ С‚РѕР»СЊРєРѕ `e.altKey`, Р° Ctrl+Alt+drag (РЅР°С€ scale-Р¶РµСЃС‚) С‚РѕР¶Рµ РґРµСЂР¶РёС‚ Alt вЂ” РёР·-Р·Р° СЌС‚РѕРіРѕ group edit frame Р·Р°РјРѕСЂР°Р¶РёРІР°Р»СЃСЏ РІ РјРѕРјРµРЅС‚ РЅР°С‡Р°Р»Р° scale Рё РЅРµ РѕР±РЅРѕРІР»СЏР»СЃСЏ РґРѕ РєРѕРЅС†Р° Р¶РµСЃС‚Р°, РїРѕРєР° СЃР°Рј РѕР±СЉРµРєС‚ РїСЂРѕРґРѕР»Р¶Р°Р» live-РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°С‚СЊСЃСЏ РїРѕРґ РЅРµР№. РСЃРїСЂР°РІР»РµРЅРѕ: СѓСЃР»РѕРІРёРµ Р·Р°РјРѕСЂРѕР·РєРё С‚РµРїРµСЂСЊ `e.altKey && mouse.isDragging` вЂ” `isDragging` РёСЃС‚РёРЅРЅРѕ С‚РѕР»СЊРєРѕ РїСЂРё РѕР±С‹С‡РЅРѕРј drag РѕР±СЉРµРєС‚РѕРІ, РЅРёРєРѕРіРґР° РїСЂРё `isTransforming` (rotate/scale РёРґС‘С‚ РїРѕ РѕС‚РґРµР»СЊРЅРѕР№ РІРµС‚РєРµ `handleObjectClick`, РјРёРЅСѓСЏ РєРѕРґ, РєРѕС‚РѕСЂС‹Р№ РІС‹СЃС‚Р°РІР»СЏРµС‚ `isDragging`) (`src/event-system/MouseHandlers.js`).

- **DetailsPanel: РїРѕР»СЏ Transform РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ live РІРѕ РІСЂРµРјСЏ drag/rotate/scale РјС‹С€СЊСЋ, РЅРµ С‚РѕР»СЊРєРѕ РїСЂРё РІРІРѕРґРµ СЃ РєР»Р°РІРёР°С‚СѓСЂС‹** вЂ” РїСЂРµРґС‹РґСѓС‰РёР№ С„РёРєСЃ (`input`-Р»РёСЃС‚РµРЅРµСЂ в†’ `render()`) РїРѕРєСЂС‹РІР°Р» С‚РѕР»СЊРєРѕ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ РїРѕР»РµР№ РІСЂСѓС‡РЅСѓСЋ; РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё/РІСЂР°С‰РµРЅРёРё/РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРё РѕР±СЉРµРєС‚Р° РњР«РЁР¬Р® С‡РёСЃР»РѕРІС‹Рµ РїРѕР»СЏ Position/Size/Rotation РѕСЃС‚Р°РІР°Р»РёСЃСЊ СЃС‚Р°С‚РёС‡РЅС‹РјРё РґРѕ `mouseup` (`objectPropertyChanged`/`level`-РїРѕРґРїРёСЃРєРё РІ `DetailsPanel` РЅР°РјРµСЂРµРЅРЅРѕ РёРіРЅРѕСЂРёСЂСѓСЋС‚ live position-РёР·РјРµРЅРµРЅРёСЏ вЂ” perf-РѕРїС‚РёРјРёР·Р°С†РёСЏ, СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅР°СЏ СЂР°РЅРµРµ РґР»СЏ РѕР±С‹С‡РЅРѕРіРѕ drag). Р”РѕР±Р°РІР»РµРЅ `DetailsPanel.refreshTransformFieldsLive()` вЂ” С‚РѕС‡РµС‡РЅРѕ РѕР±РЅРѕРІР»СЏРµС‚ `.value` СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… input'РѕРІ РёР· С‚РµРєСѓС‰РµР№ РјРѕРґРµР»Рё (Р±РµР· РїРµСЂРµСЃС‚СЂРѕР№РєРё DOM, Р±РµР· РїРѕС‚РµСЂРё С„РѕРєСѓСЃР° Р°РєС‚РёРІРЅРѕРіРѕ РїРѕР»СЏ), РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· `MouseHandlers._handleMouseMoveImpl` СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ `dragSelectedObjects()`/`transformSelectedObjects()` (`src/ui/DetailsPanel.js`, `src/event-system/MouseHandlers.js`).

- **РћС‚РєСЂС‹С‚РёРµ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹: СЂР°РјРєР° РЅРµ СѓС‡РёС‚С‹РІР°Р»Р° rotation, РґРµС‚Рё В«СЂР°Р·СЉРµР·Р¶Р°Р»РёСЃСЊВ» СЃ РєР°СЂС‚РёРЅРєРѕР№, drag РІРЅСѓС‚СЂРё РІС‘Р» СЃРµР±СЏ РЅРµРєРѕСЂСЂРµРєС‚РЅРѕ** вЂ” С‚СЂРё РѕС‚РґРµР»СЊРЅС‹С… Р±Р°РіР°, РѕР±РЅР°СЂСѓР¶РµРЅРЅС‹С… РїСЂРё СЂР°Р±РѕС‚Рµ СЃ group edit mode РґР»СЏ РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ (`Ctrl+drag` РЅР° РіСЂСѓРїРїРµ, Р·Р°С‚РµРј РґРІРѕР№РЅРѕР№ РєР»РёРє РІРЅСѓС‚СЂСЊ):
  1. **`drawGroupEditFrame` РёРіРЅРѕСЂРёСЂРѕРІР°Р»Р° rotation РїРѕР»РЅРѕСЃС‚СЊСЋ** вЂ” СЂРёСЃРѕРІР°Р»Р° axis-aligned РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРёРє РІРѕРєСЂСѓРі СѓР¶Рµ РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ СЃРѕРґРµСЂР¶РёРјРѕРіРѕ. РћР±СЉРµРґРёРЅРµРЅР° СЃ `drawObjectSelectionRect` С‡РµСЂРµР· РѕР±С‰РёР№ РїСЂРёРјРёС‚РёРІ `RenderOperations.strokeFrame()` + `WorldPositionUtils.getFrameGeometry()` (СЃРј. Р·Р°РїРёСЃСЊ РїСЂРѕ rotate/scale Р¶РµСЃС‚С‹ РІС‹С€Рµ) вЂ” С‚РµРїРµСЂСЊ СЂР°РјРєР° РіСЂСѓРїРїС‹ РїРѕРІРѕСЂР°С‡РёРІР°РµС‚СЃСЏ РІРјРµСЃС‚Рµ СЃ РєР°СЂС‚РёРЅРєРѕР№, Р·Р°РјРѕСЂРѕР¶РµРЅРЅС‹Р№ СЃРЅР°РїС€РѕС‚ (`groupEditMode.frozenFrameGeometry`) С‚РѕР¶Рµ РЅРµСЃС‘С‚ rotation.
  2. **РџРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РѕР±СЉРµРєС‚Р° РІРЅСѓС‚СЂРё РїРѕРІС‘СЂРЅСѓС‚РѕР№ РіСЂСѓРїРїС‹ РґРІРёРіР°Р»Рѕ РµРіРѕ РІ РЅРµРІРµСЂРЅРѕРј РЅР°РїСЂР°РІР»РµРЅРёРё** вЂ” РјРёСЂРѕРІР°СЏ РґРµР»СЊС‚Р° РєСѓСЂСЃРѕСЂР° (`dx,dy`) РґРѕР±Р°РІР»СЏР»Р°СЃСЊ РЅР°РїСЂСЏРјСѓСЋ Рє Р»РѕРєР°Р»СЊРЅС‹Рј РєРѕРѕСЂРґРёРЅР°С‚Р°Рј, С‡С‚Рѕ РІРµСЂРЅРѕ С‚РѕР»СЊРєРѕ РґР»СЏ РЅРµРїРѕРІС‘СЂРЅСѓС‚С‹С… РїСЂРµРґРєРѕРІ. `WorldPositionUtils.worldDeltaToLocalDelta()` (РёРЅРІРµСЂС‚РёСЂСѓРµС‚ СЃСѓРјРјСѓ ancestor-РїРѕРІРѕСЂРѕС‚РѕРІ вЂ” РєРѕРјРїРѕР·РёС†РёСЏ С‡РёСЃС‚С‹С… РІСЂР°С‰РµРЅРёР№ Р°РґРґРёС‚РёРІРЅР°, РїРёРІРѕС‚С‹ РЅРµ РІР°Р¶РЅС‹ РґР»СЏ РґРµР»СЊС‚С‹) Рё `worldPointToLocalPointInGroup()` (РєРѕРЅРІРµСЂС‚РёСЂСѓРµС‚ РјРёСЂРѕРІСѓСЋ С‚РѕС‡РєСѓ РІ Р»РѕРєР°Р»СЊРЅСѓСЋ РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕР№ РіСЂСѓРїРїС‹, СѓС‡РёС‚С‹РІР°СЏ РµС‘ СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ rotation РєР°Рє Р±Р»РёР¶Р°Р№С€РµРµ Р·РІРµРЅРѕ С†РµРїРѕС‡РєРё) вЂ” РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ РІ `MouseHandlers.dragSelectedObjects` РІРјРµСЃС‚Рѕ РїСЂРµР¶РЅРёС… `obj.x += dx`/`obj.x -= groupPos.x`.
  3. **РџРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РћР”РќРћР“Рћ СЂРµР±С‘РЅРєР° СЃРґРІРёРіР°Р»Рѕ РѕС‚СЂРёСЃРѕРІР°РЅРЅСѓСЋ РїРѕР·РёС†РёСЋ РµРіРѕ РЅРµРІС‹РґРµР»РµРЅРЅС‹С… СЃРѕСЃРµРґРµР№** вЂ” rotation-pivot РіСЂСѓРїРїС‹ РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ РєР°Рє С†РµРЅС‚СЂ bounds РµС‘ С‚РµРєСѓС‰РёС… РґРµС‚РµР№ (`Group.getBounds()`), РєРѕС‚РѕСЂС‹Р№ РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РєР°Р¶РґС‹Р№ РєР°РґСЂ СЂРµРЅРґРµСЂР° Рё РІРєР»СЋС‡Р°РµС‚ С‚РµРєСѓС‰СѓСЋ (РґРІРёРіР°СЋС‰СѓСЋСЃСЏ) РїРѕР·РёС†РёСЋ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕРіРѕ РѕР±СЉРµРєС‚Р°. РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ РІ Р±СЂР°СѓР·РµСЂРµ: drag `c1` РІРЅСѓС‚СЂРё РіСЂСѓРїРїС‹, РїРѕРІС‘СЂРЅСѓС‚РѕР№ РЅР° 90В°, РґРІРёРіР°Р» СЂРµРЅРґРµСЂРЅСѓСЋ РјРёСЂРѕРІСѓСЋ РїРѕР·РёС†РёСЋ РЅРµРІС‹РґРµР»РµРЅРЅРѕРіРѕ `c2` РїСЂРё РЅРµРёР·РјРµРЅРЅС‹С… `c2.x/y`. **РџРѕРїС‹С‚РєР° С„РёРєСЃР° С‡РµСЂРµР· `excludeIds` (РёСЃРєР»СЋС‡РµРЅРёРµ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕРіРѕ id РёР· pivot-СЃСѓРјРјС‹, threaded С‡РµСЂРµР· `Group.getBounds`/`WorldPositionUtils`/`CanvasRenderer`/`RenderOperations`/`MouseHandlers`) РѕС‚РєР°С‡РµРЅР° РІ С‚РѕС‚ Р¶Рµ РґРµРЅСЊ** вЂ” СЃРј. СЃР»РµРґСѓСЋС‰СѓСЋ Р·Р°РїРёСЃСЊ; РѕРіСЂР°РЅРёС‡РµРЅРёРµ РѕСЃС‚Р°С‘С‚СЃСЏ РЅРµРёСЃРїСЂР°РІР»РµРЅРЅС‹Рј.

- **Р РµРІС‘СЂС‚: `excludeIds`-С„РёРєСЃ rotation-pivot РІС‹Р·РІР°Р» 5 СЂРµРіСЂРµСЃСЃРёР№** вЂ” РїРѕРїС‹С‚РєР° СЃС‚Р°Р±РёР»РёР·РёСЂРѕРІР°С‚СЊ pivot (РїСѓРЅРєС‚ 3 РІС‹С€Рµ) РёСЃРєР»СЋС‡Р°Р»Р° id РІС‹РґРµР»РµРЅРёСЏ РёР· СЃСѓРјРјС‹ bounds ancestor-РіСЂСѓРїРїС‹, РїРѕРєР° `mouse.isDragging || mouse.isTransforming`. РџСЂРѕР±Р»РµРјР°: `isDragging` СЃС‚Р°РЅРѕРІРёС‚СЃСЏ `true` СЃСЂР°Р·Сѓ РЅР° mousedown (РґРѕ РґРІРёР¶РµРЅРёСЏ РєСѓСЂСЃРѕСЂР°), РїРѕСЌС‚РѕРјСѓ РёСЃРєР»СЋС‡РµРЅРёРµ СЃСЂР°Р±Р°С‚С‹РІР°Р»Рѕ СѓР¶Рµ РїСЂРё РїСЂРѕСЃС‚РѕРј РљР›РРљР•/РІС‹РґРµР»РµРЅРёРё СЂРµР±С‘РЅРєР°, Р° РЅРµ С‚РѕР»СЊРєРѕ РІРѕ РІСЂРµРјСЏ СЂРµР°Р»СЊРЅРѕРіРѕ drag вЂ” СЌС‚Рѕ РІС‹Р·РІР°Р»Рѕ: (1) СЃРєР°С‡РѕРє СЂР°РјРєРё/РїРѕР·РёС†РёРё РіСЂСѓРїРїС‹ РІ РјРѕРјРµРЅС‚ РІС‹РґРµР»РµРЅРёСЏ Р±РµР· РґРІРёР¶РµРЅРёСЏ РјС‹С€Рё; (2) СЂР°РјРєР° РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїС‹ СЂРёСЃРѕРІР°Р»Р°СЃСЊ В«РІРѕРєСЂСѓРі РѕСЃС‚Р°Р»СЊРЅС‹С… РґРµС‚РµР№ Р±РµР· СѓС‡С‘С‚Р° РІС‹Р±СЂР°РЅРЅРѕРіРѕВ» СЃСЂР°Р·Сѓ РїСЂРё РІС‹Р±РѕСЂРµ; (3) СЂР°РјРєР° РїРµСЂРµСЃС‚Р°РІР°Р»Р° СЂРµР°РіРёСЂРѕРІР°С‚СЊ РЅР° РґРІРёР¶РµРЅРёРµ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕРіРѕ РѕР±СЉРµРєС‚Р° (РїРµСЂРµСЃС‚Р°РІР°Р»Р° Р±С‹С‚СЊ В«РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕР№В»); (4) РїРѕРґСЃРІРµС‚РєР° alt-drag-out (`drawAltDragSelectionRect`) Р»РѕРјР°Р»Р°СЃСЊ РґР»СЏ СЃР°РјРѕРіРѕ РїРµСЂРµС‚Р°СЃРєРёРІР°РµРјРѕРіРѕ РѕР±СЉРµРєС‚Р° вЂ” С‚РѕС‚ Р¶Рµ `excludeIds` РїРµСЂРµРґР°РІР°Р»СЃСЏ РІ `getObjectWorldBoundsWithParallax(obj, ..., excludeIds)`, РіРґРµ `obj.id` РѕРєР°Р·С‹РІР°Р»СЃСЏ РћР”РќРћР’Р Р•РњР•РќРќРћ С†РµР»СЊСЋ Р·Р°РїСЂРѕСЃР° Р РІ СЃРїРёСЃРєРµ РёСЃРєР»СЋС‡РµРЅРёР№ вЂ” СЃСЂР°Р±Р°С‚С‹РІР°Р» pre-existing РІС‹СЂРѕР¶РґРµРЅРЅС‹Р№ early-return `if (excludeIds.includes(obj.id)) return degenerate` РІ `WorldPositionUtils.getWorldBounds`, Р·Р°РґСѓРјР°РЅРЅС‹Р№ РґР»СЏ РґСЂСѓРіРѕР№ С†РµР»Рё (В«bounds РіСЂСѓРїРїС‹ Р±РµР· С‡Р°СЃС‚Рё РґРµС‚РµР№В»), Р° РЅРµ В«РЅРµ СѓС‡РёС‚С‹РІР°С‚СЊ РѕР±СЉРµРєС‚ РІ pivot РїСЂРµРґРєР°В». Р’СЃС‘ СЌС‚Рѕ вЂ” РєРѕРЅС„Р»РёРєС‚ Р”Р’РЈРҐ СЂР°Р·РЅС‹С… СЃРµРјР°РЅС‚РёРє РїРѕРґ РѕРґРЅРёРј РёРјРµРЅРµРј РїР°СЂР°РјРµС‚СЂР°. РћС‚РєР°С‡РµРЅРѕ РїРѕР»РЅРѕСЃС‚СЊСЋ: `Group.getBounds` РІРµСЂРЅСѓР»Р° СЃРёРіРЅР°С‚СѓСЂСѓ Р±РµР· `excludeIds`; `WorldPositionUtils` (`_findPlainPositionAndChain`/`getWorldPosition`/`getWorldTransform`/`getAncestorRotation`/`worldDeltaToLocalDelta`/`getFrameGeometry`/`worldPointToLocalPointInGroup`) вЂ” Р±РµР· РґРѕРї. РїР°СЂР°РјРµС‚СЂР°; `RenderOperations.getActiveDragExcludeIds()` СѓРґР°Р»С‘РЅ РІРјРµСЃС‚Рµ СЃРѕ РІСЃРµРјРё РІС‹Р·РѕРІР°РјРё; `CanvasRenderer.drawObject/drawGroup`, `ParallaxRenderer.renderParallaxObjects/getObjectWorldBoundsWithParallax`, `ObjectOperations.getObjectWorldPosition` вЂ” Р±РµР· РґРѕРї. РїР°СЂР°РјРµС‚СЂР°. РќР°РїСЂР°РІР»РµРЅРёРµ drag (`worldDeltaToLocalDelta`/`worldPointToLocalPointInGroup` РєР°Рє С‚Р°РєРѕРІС‹Рµ, Р±РµР· excludeIds) Рё СЂР°РјРєР°-СЃ-rotation РѕСЃС‚Р°Р»РёСЃСЊ вЂ” СЌС‚Рѕ РЅРµР·Р°РІРёСЃРёРјС‹Рµ, РІРµСЂРЅРѕ СЂР°Р±РѕС‚Р°СЋС‰РёРµ С„РёРєСЃС‹. РџСЂРѕР±Р»РµРјР° СЃ pivot РѕСЃС‚Р°С‘С‚СЃСЏ РѕС‚РєСЂС‹С‚РѕР№ (СЃРј. В«РР·РІРµСЃС‚РЅС‹Рµ РѕРіСЂР°РЅРёС‡РµРЅРёСЏВ» РІ ARCHITECTURE.md/DEVELOPMENT_GUIDE.md) вЂ” РєРѕСЂСЂРµРєС‚РЅС‹Р№ С„РёРєСЃ РїРѕС‚СЂРµР±РѕРІР°Р» Р±С‹ freeze-СЃРЅРёРјРєР° pivot'Р° РќРђ РЎРўРђР РўР• Р¶РµСЃС‚Р°, Р° РЅРµ exclude-РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЏ СЃРёРЅС…СЂРѕРЅРЅРѕРіРѕ СЃ `isDragging` (`src/models/Group.js`, `src/utils/WorldPositionUtils.js`, `src/core/RenderOperations.js`, `src/core/ObjectOperations.js`, `src/ui/CanvasRenderer.js`, `src/utils/ParallaxRenderer.js`, `src/event-system/MouseHandlers.js`).

- **Р”СѓР±Р»РёРєР°С‚С‹ РїРѕРІС‘СЂРЅСѓС‚С‹С… РѕР±СЉРµРєС‚РѕРІ: СЂР°РјРєР° РїСЂРµРІСЊСЋ РЅРµ СѓС‡РёС‚С‹РІР°Р»Р° rotation РѕСЂРёРіРёРЅР°Р»Р°** вЂ” `getDuplicateObjectBounds` (bounds РґР»СЏ preview-РѕР±СЉРµРєС‚РѕРІ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ, РєРѕС‚РѕСЂС‹Рµ РЅРµ Р»РµР¶Р°С‚ РІ `level.objects` Рё РїРѕСЌС‚РѕРјСѓ РЅРµ РїСЂРѕС…РѕРґСЏС‚ С‡РµСЂРµР· `WorldPositionUtils`) РїРѕР»РЅРѕСЃС‚СЊСЋ РёРіРЅРѕСЂРёСЂРѕРІР°Р»Р° `rotation`, С…РѕС‚СЏ СЃР°РјР° РєР°СЂС‚РёРЅРєР° РґСѓР±Р»РёРєР°С‚Р° РЈР–Р• СЂРёСЃРѕРІР°Р»Р°СЃСЊ РїРѕРІС‘СЂРЅСѓС‚РѕР№ (`CanvasRenderer.drawSingleObject` РїРѕР»СѓС‡Р°РµС‚ rotation С‡РµСЂРµР· spread-РєРѕРїРёСЋ РѕР±СЉРµРєС‚Р°). РСЃРїСЂР°РІР»РµРЅРѕ: `getDuplicateObjectBounds` С‚РµРїРµСЂСЊ СЃС‚СЂРѕРёС‚ bounds С‡РµСЂРµР· С‚РѕС‚ Р¶Рµ Р°Р»РіРѕСЂРёС‚Рј, С‡С‚Рѕ `WorldPositionUtils.getWorldBounds` РґР»СЏ РѕР±С‹С‡РЅС‹С… РіСЂСѓРїРї (В«union bounds РґРµС‚РµР№ РІ Р»РѕРєР°Р»СЊРЅРѕР№ СЃРёСЃС‚РµРјРµ в†’ РїРѕРІРµСЂРЅСѓС‚СЊ РєР°Рє РµРґРёРЅРѕРµ С†РµР»РѕРµ в†’ СЃРґРІРёРЅСѓС‚СЊВ»), РЅРѕ РІСЂСѓС‡РЅСѓСЋ (Р±РµР· DFS-РѕС‚-РєРѕСЂРЅСЏ, С‚.Рє. РґСѓР±Р»РёРєР°С‚С‹ вЂ” РѕС‚СЃРѕРµРґРёРЅС‘РЅРЅРѕРµ РїРѕРґРґРµСЂРµРІРѕ). Р”Р»СЏ РїСЂРѕСЃС‚С‹С… (РЅРµ РіСЂСѓРїРїРѕРІС‹С…) РѕР±СЉРµРєС‚РѕРІ СЂР°РјРєР° РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ СЂРёСЃСѓРµС‚СЃСЏ РўРћР§РќРћ РїРѕРІС‘СЂРЅСѓС‚РѕР№ (РЅРµ РєРѕРЅСЃРµСЂРІР°С‚РёРІРЅС‹Рј AABB) вЂ” `drawDuplicateObjects` СЃС‚СЂРѕРёС‚ rect РёР· `obj.width/height` Рё РїРѕРІРѕСЂР°С‡РёРІР°РµС‚ С‡РµСЂРµР· `strokeFrame(..., obj.rotation)` (`src/core/RenderOperations.js`).

- **Р¤РёРєСЃ: СЂР°РјРєРё/hit-test РІРЅСѓС‚СЂРё РџРћР’РЃР РќРЈРўРћР™ РіСЂСѓРїРїС‹ СЂР°СЃС…РѕРґРёР»РёСЃСЊ СЃ РєР°СЂС‚РёРЅРєРѕР№** вЂ” `WorldPositionUtils.getWorldPosition/getWorldBounds/isPointInWorldBounds` СЃС‡РёС‚Р°Р»Рё РїСЂРµРґРєРѕРІ translation-only, РёРіРЅРѕСЂРёСЂСѓСЏ `rotation` СЂРѕРґРёС‚РµР»СЊСЃРєРёС… РіСЂСѓРїРї; РїСЂРё РїРѕРІРѕСЂРѕС‚Рµ РіСЂСѓРїРїС‹ СЂРµРЅРґРµСЂ (`CanvasRenderer`, РєРѕСЂСЂРµРєС‚РЅРѕ РєР°СЃРєР°РґРёСЂСѓРµС‚ `ctx.rotate` С‡РµСЂРµР· РІР»РѕР¶РµРЅРЅРѕСЃС‚СЊ) Рё РіРµРѕРјРµС‚СЂРёСЏ (СЂР°РјРєР° РІС‹РґРµР»РµРЅРёСЏ, hit-test) СЂР°СЃС…РѕРґРёР»РёСЃСЊ. Р”РѕР±Р°РІР»РµРЅС‹ `_findPlainPositionAndChain`/`_applyRotationChain` вЂ” DFS СЃРѕР±РёСЂР°РµС‚ С†РµРїРѕС‡РєСѓ РїРѕРІС‘СЂРЅСѓС‚С‹С… РїСЂРµРґРєРѕРІ-РіСЂСѓРїРї (pivot = С†РµРЅС‚СЂ `ancestor.getBounds()`, С‚РѕС‚ Р¶Рµ pivot, С‡С‚Рѕ РёСЃРїРѕР»СЊР·СѓРµС‚ СЂРµРЅРґРµСЂ) Рё РїСЂРёРјРµРЅСЏРµС‚ РµС‘ Рє С‚РѕС‡РєРµ РѕС‚ СЃР°РјРѕРіРѕ РІРЅСѓС‚СЂРµРЅРЅРµРіРѕ РїСЂРµРґРєР° Рє СЃР°РјРѕРјСѓ РІРЅРµС€РЅРµРјСѓ, Р·РµСЂРєР°Р»СЏ РїРѕСЂСЏРґРѕРє РІР»РѕР¶РµРЅРЅС‹С… `ctx.rotate`; РёС‚РѕРіРѕРІС‹Р№ СѓРіРѕР» РѕР±СЉРµРєС‚Р° РЅР° СЌРєСЂР°РЅРµ = СЃСѓРјРјР° РїРѕРІРѕСЂРѕС‚РѕРІ РїСЂРµРґРєРѕРІ + СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ (РєРѕРјРїРѕР·РёС†РёСЏ С‡РёСЃС‚С‹С… 2D-РІСЂР°С‰РµРЅРёР№ Р°РґРґРёС‚РёРІРЅР°). Р¤РѕСЂРјСѓР»С‹ РїРµСЂРµРїСЂРѕРІРµСЂРµРЅС‹ Р°РЅР°Р»РёС‚РёС‡РµСЃРєРё Рё СЃРІРµСЂРµРЅС‹ СЃ РЅРµР·Р°РІРёСЃРёРјРѕР№ JS-СЂРµРїР»РёРєР°С†РёРµР№ ctx-С‚СЂР°РЅСЃС„РѕСЂРјР° РІ Р±СЂР°СѓР·РµСЂРµ вЂ” СЃРѕРІРїР°РґР°СЋС‚ РґРѕ Р±РёС‚Р°. РџРѕРІРµРґРµРЅРёРµ РґР»СЏ РЅРµРїРѕРІС‘СЂРЅСѓС‚С‹С… РїСЂРµРґРєРѕРІ РЅРµ РёР·РјРµРЅРёР»РѕСЃСЊ (СЂРµРіСЂРµСЃСЃРёРѕРЅРЅС‹Рµ С‚РµСЃС‚С‹ РїСЂРѕР№РґРµРЅС‹). РР·РІРµСЃС‚РЅРѕРµ РѕРіСЂР°РЅРёС‡РµРЅРёРµ РѕСЃС‚Р°Р»РѕСЃСЊ С‚РѕР»СЊРєРѕ РґР»СЏ Р–Р•РЎРўРђ (РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РїСЂРёРјРµРЅСЏРµС‚ РјРёСЂРѕРІС‹Рµ РґРµР»СЊС‚С‹ Рє Р»РѕРєР°Р»СЊРЅС‹Рј РєРѕРѕСЂРґРёРЅР°С‚Р°Рј вЂ” РЅРµРєРѕСЂСЂРµРєС‚РЅРѕ РІРЅСѓС‚СЂРё РїРѕРІС‘СЂРЅСѓС‚РѕРіРѕ РїСЂРµРґРєР°), РіРµРѕРјРµС‚СЂРёСЏ РґР»СЏ С‡С‚РµРЅРёСЏ (bounds/hit-test/СЂР°РјРєР°) С‚РµРїРµСЂСЊ РІРµСЂРЅР° (`src/utils/WorldPositionUtils.js`).

- **DetailsPanel: Р·Р°РіРѕР»РѕРІРѕРє РІРєР»Р°РґРєРё (Asset/Assets/Level) РЅРµ РѕР±РЅРѕРІР»СЏР»СЃСЏ** вЂ” `updateTabTitle()` РёСЃРєР°Р» `#details-tab`, СЌР»РµРјРµРЅС‚Р° СЃ С‚Р°РєРёРј id Р±РѕР»СЊС€Рµ РЅРµС‚: РІРєР»Р°РґРєРё РіРµРЅРµСЂРёСЂСѓСЋС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё `PanelPositionManager` РєР°Рє `<button data-tab="details">`. РСЃРїСЂР°РІР»РµРЅРѕ РЅР° `document.querySelectorAll('[data-tab="details"]')` (РѕР±РЅРѕРІР»СЏРµС‚ РІСЃРµ РІРєР»Р°РґРєРё-РґСѓР±Р»РёРєР°С‚С‹, РІРєР»СЋС‡Р°СЏ РїРµСЂРµРЅРµСЃС‘РЅРЅС‹Рµ РІ РґСЂСѓРіСѓСЋ РїР°РЅРµР»СЊ) (`src/ui/DetailsPanel.js`).

- **Cross-panel tab drag (replaces "Move to" context menu)** вЂ” РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ В«Move to Left/Right PanelВ» СѓРґР°Р»РµРЅРѕ (`TabMoveContextMenu`, `handleTabContextMenu` РёР· `EventHandlers.js`). Р’РєР»Р°РґРєРё РїРµСЂРµРјРµС‰Р°СЋС‚СЃСЏ РїСЂСЏРјС‹Рј drag:
  - **Ghost-С‚Р°Р±** (`.tab-drag-ghost`): РїРѕР»СѓРїСЂРѕР·СЂР°С‡РЅС‹Р№ РїРѕРІС‘СЂРЅСѓС‚С‹Р№ РґСѓР±Р»РёРєР°С‚ С‚СЏРЅРµС‚СЃСЏ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј РІРѕ РІСЂРµРјСЏ drag.
  - **РџРѕРґСЃРІРµС‚РєР° drop-Р·РѕРЅС‹**: РїСЂРё РЅР°РІРµРґРµРЅРёРё РЅР° tab-bar РґСЂСѓРіРѕР№ РїР°РЅРµР»Рё вЂ” СЃРёРЅСЏСЏ РїСѓРЅРєС‚РёСЂРЅР°СЏ СЂР°РјРєР° (`.tab-drop-zone`); РїСЂРё СЃР±СЂРѕСЃРµ РІС‹Р·С‹РІР°РµС‚СЃСЏ `PanelPositionManager.moveTab()`.
  - **РЎРѕР·РґР°РЅРёРµ РїР°РЅРµР»Рё**: РµСЃР»Рё С†РµР»РµРІРѕР№ РїР°РЅРµР»Рё РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚, РЅР° РєСЂР°СЏС… `#main-workspace` РїРѕСЏРІР»СЏСЋС‚СЃСЏ СЃРІРµС‚Р»Рѕ-СЃРёРЅРёРµ РїРѕР»РѕСЃС‹ (`.tab-new-panel-zone`); РїСЂРё СЃР±СЂРѕСЃРµ РЅР° РЅРёС… РїР°РЅРµР»СЊ СЃРѕР·РґР°С‘С‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё С‡РµСЂРµР· `ensurePanelExists()`.
  - **РЎРєРѕСѓРїРёРЅРі РІРёР·СѓР°Р»РѕРІ**: РїРѕРґСЃРІРµС‡РёРІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ `#left-tabs-panel > .flex.border-b.border-gray-700` Рё `#right-tabs-panel > .flex.border-b.border-gray-700` вЂ” СЃС‚СЂРѕРіРёР№ РїСЂСЏРјРѕР№-РґРѕС‡РµСЂРЅРёР№ СЃРµР»РµРєС‚РѕСЂ Рё Set-based РїСЂРѕРІРµСЂРєР° РІРјРµСЃС‚Рѕ `closest()`, С‡С‚РѕР±С‹ РґСЂСѓРіРёРµ UI-СЌР»РµРјРµРЅС‚С‹ (РїРѕРёСЃРє, С€Р°РїРєРё СЃРµРєС†РёР№) РЅРµ СЂРµР°РіРёСЂРѕРІР°Р»Рё.
  - **`this._pendingDrag`**: СЃРѕСЃС‚РѕСЏРЅРёРµ drag С…СЂР°РЅРёС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ РѕС‚ `window.tabDraggingState`, С‚.Рє. Р»РµРіР°СЃРё `tabDraggingGlobalMouseUp` (Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂРµ) РѕС‡РёС‰Р°РµС‚ РµРіРѕ РґРѕ РІС‹РїРѕР»РЅРµРЅРёСЏ РЅР°С€РµРіРѕ `mouseup`.
  - (`src/event-system/EventHandlers.js`, `src/ui/PanelPositionManager.js`, `styles/main.css`)

- **[SUPERSEDED вЂ” СЃРј. Р·Р°РїРёСЃСЊ В«Z-РїРѕСЂСЏРґРѕРє РѕР±СЉРµРєС‚РѕРІВ» РІС‹С€Рµ]** **zIndex РІ РіСЂСѓРїРїР°С…: СЂРµРЅРґРµСЂРёРЅРі, РЅР°Р·РЅР°С‡РµРЅРёРµ, РјРёРіСЂР°С†РёСЏ** вЂ” (1) `assignInitialZIndex` РІС‹Р·С‹РІР°Р» `assignObjectToLayer(obj.id)` в†’ `findObjectById` в†’ `null` РґР»СЏ РґРµС‚РµР№ РіСЂСѓРїРї (РЅРµ РІ `level.objects`) в†’ СЃР»РѕР№ РЅРµ РєРѕСЂСЂРµРєС‚РёСЂРѕРІР°Р»СЃСЏ в†’ zIndex РѕСЃС‚Р°РІР°Р»СЃСЏ СЃ `maxLayerIndex` РІРјРµСЃС‚Рѕ СЂРµР°Р»СЊРЅРѕРіРѕ. РСЃРїСЂР°РІР»РµРЅРѕ: layer index РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ РЅР°РїСЂСЏРјСѓСЋ РёР· `layerId`-РїР°СЂР°РјРµС‚СЂР°. (2) `fromData` РёС‚РµСЂРёСЂРѕРІР°Р» С‚РѕР»СЊРєРѕ `level.objects`, РЅРµ СЂРµРєСѓСЂСЃРёСЂСѓСЏ РІ РґРµС‚РµР№ РіСЂСѓРїРї в†’ РґРµС‚Рё СЃ `zIndex=0` (СЃРѕС…СЂР°РЅС‘РЅРЅС‹Рµ СЃ Р±Р°РіРѕРј) РЅРµ РјРёРіСЂРёСЂРѕРІР°Р»РёСЃСЊ. РСЃРїСЂР°РІР»РµРЅРѕ: `fixZIndex` СЂРµРєСѓСЂСЃРёРІРЅРѕ РѕР±С…РѕРґРёС‚ РІСЃРµ РІР»РѕР¶РµРЅРЅС‹Рµ РіСЂСѓРїРїС‹ СЃ СѓС‡С‘С‚РѕРј РЅР°СЃР»РµРґРѕРІР°РЅРёСЏ `layerId`. (3) `drawGroup` СЂРёСЃРѕРІР°Р» РґРµС‚РµР№ РІ РїРѕСЂСЏРґРєРµ РјР°СЃСЃРёРІР° Р±РµР· СЃРѕСЂС‚РёСЂРѕРІРєРё в†’ РїРѕСЂСЏРґРѕРє РЅРµ СЃРѕРІРїР°РґР°Р» СЃ hit-test. РСЃРїСЂР°РІР»РµРЅРѕ: `slice().sort(by zIndex asc)` РїРµСЂРµРґ `forEach`. (4) РџСЂРё drag top-levelв†’group zIndex РЅРµ РїРµСЂРµРЅР°Р·РЅР°С‡Р°Р»СЃСЏ. РСЃРїСЂР°РІР»РµРЅРѕ: `getNextZIndex()` + РєРѕСЂСЂРµРєС†РёСЏ СЃР»РѕСЏ РїРµСЂРµРґ `push` (`src/models/Level.js`, `src/ui/CanvasRenderer.js`, `src/event-system/MouseHandlers.js`).


- **[SUPERSEDED вЂ” СЃРј. Р·Р°РїРёСЃСЊ В«Z-РїРѕСЂСЏРґРѕРє РѕР±СЉРµРєС‚РѕРІВ» РІС‹С€Рµ]** **zIndex: РґРІР° Р±Р°РіР° РЅР°СЂСѓС€Р°Р»Рё РїРѕСЂСЏРґРѕРє СЂРµРЅРґРµСЂРёРЅРіР° Рё hit-test** вЂ” (1) `getNextZIndex`: СѓСЃР»РѕРІРёРµ `obj.zIndex > 0` РёСЃРєР»СЋС‡Р°Р»Рѕ РёР· СЃРєР°РЅРёСЂРѕРІР°РЅРёСЏ РѕР±СЉРµРєС‚С‹ СЃ `zIndex = 0.000` (СЃР»РѕР№ СЃ index=0) в†’ `nextObjectIndex` РІСЃРµРіРґР° СЂР°РІРµРЅ 0 в†’ РІСЃРµ РѕР±СЉРµРєС‚С‹ РїРѕР»СѓС‡Р°Р»Рё РѕРґРёРЅР°РєРѕРІС‹Р№ `zIndex = 0.000` в†’ Details РїРѕРєР°Р·С‹РІР°Р» 0 РґР»СЏ РІСЃРµС…, РєР»РёРєР°Р»СЃСЏ РЅРёР¶РЅРёР№ РѕР±СЉРµРєС‚ РІРјРµСЃС‚Рѕ РІРµСЂС…РЅРµРіРѕ. РСЃРїСЂР°РІР»РµРЅРѕ: `> 0` в†’ `!== undefined`. (2) Floating point: `Math.floor((1.001 % 1) * 1000) = 0` РІРјРµСЃС‚Рѕ `1` (С‚.Рє. `1.001 % 1 в‰€ 0.0009999...`) в†’ РЅРµРІРµСЂРЅС‹Р№ objectIndex РїСЂРё РїРµСЂРµРЅРѕСЃРµ РјРµР¶РґСѓ СЃР»РѕСЏРјРё СЃ indexв‰Ґ1. РСЃРїСЂР°РІР»РµРЅРѕ: `Math.floor в†’ Math.round` РІ 11 РјРµСЃС‚Р°С…. РЎСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СѓСЂРѕРІРЅРё СЃ `zIndex = 0` Р°РІС‚Рѕ-С„РёРєСЃРёСЂСѓСЋС‚СЃСЏ РїСЂРё Р·Р°РіСЂСѓР·РєРµ (`src/models/Level.js`, `src/models/Group.js`, `src/ui/DetailsPanel.js`, `src/core/LayerOperations.js`, `src/event-system/MouseHandlers.js`).

- **Asset tabs bug fixes** вЂ” РёСЃРїСЂР°РІР»РµРЅС‹ 4 Р±Р°РіР° РІ `AssetTabsManager`: (1) `addFolderTab`/`removeFolderTab` С‚РµРїРµСЂСЊ СЃРѕР·РґР°СЋС‚ РЅРѕРІС‹Р№ `Set` РІРјРµСЃС‚Рѕ РјСѓС‚Р°С†РёРё РѕР±СЉРµРєС‚Р° РёР· StateManager, С‡С‚РѕР±С‹ РіР°СЂР°РЅС‚РёСЂРѕРІР°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёРµ РїРѕРґРїРёСЃС‡РёРєРѕРІ; (2) `removeFolderTab` СЏРІРЅРѕ РїРµСЂРµРґР°С‘С‚ `null` РІ `_saveTabStateToConfig()` вЂ” СѓСЃС‚СЂР°РЅС‘РЅ СЂР°СЃСЃРёРЅС…СЂРѕРЅ `activeAssetTab` РјРµР¶РґСѓ state Рё config РїСЂРё РїРµСЂРµР·Р°РіСЂСѓР·РєРµ; (3) `AssetTabContextMenu.destroy()` С‚РµРїРµСЂСЊ СѓРґР°Р»СЏРµС‚ `document.click` listener С‡РµСЂРµР· СЃРѕС…СЂР°РЅС‘РЅРЅСѓСЋ СЃСЃС‹Р»РєСѓ, РїСЂРµРґРѕС‚РІСЂР°С‰Р°СЏ ghost-С…РµРЅРґР»РµСЂС‹; (4) DnD-СЃР»СѓС€Р°С‚РµР»Рё РёР· `setupFolderDragToTabs()` СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РєР°Рє СЃРІРѕР№СЃС‚РІР° Рё СѓРґР°Р»СЏСЋС‚СЃСЏ РІ `destroy()` (`src/ui/AssetTabsManager.js`).

- **SettingsPanel tab fixes** вЂ” (1) СѓСЃС‚СЂР°РЅРµРЅР° РіРѕРЅРєР° 100 РјСЃ: `setupNewEventHandlers()` Рё `setupContextMenu()` РІС‹Р·С‹РІР°СЋС‚СЃСЏ СЃРёРЅС…СЂРѕРЅРЅРѕ (DOM РіРѕС‚РѕРІ РІ РјРѕРјРµРЅС‚ `show()`); (2) `setupSettingsInputs()` РѕРіСЂР°РЅРёС‡РµРЅР° `settings-panel-container`, РІРјРµСЃС‚Рѕ РіР»РѕР±Р°Р»СЊРЅРѕРіРѕ `document.querySelectorAll` (`src/ui/SettingsPanel.js`).

- **Status Bar color settings** вЂ” РІ Settings в†’ Colors РґРѕР±Р°РІР»РµРЅР° СЃРµРєС†РёСЏ В«Status Bar ColorsВ» СЃ 4 РїРёРєРµСЂР°РјРё (Info / Success / Warning / Error); С†РІРµС‚Р° С…СЂР°РЅСЏС‚СЃСЏ РІ `ui.statusBarColor*`, РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ `--status-bar-color-*` СЃ live preview РїСЂРё РёР·РјРµРЅРµРЅРёРё (`styles/main.css`, `styles/status-bar.css`, `config/defaults/ui.json`, `src/utils/SettingsSyncManager.js`, `src/ui/panel-structures/SettingsPanelRenderers.js`).

- **Status Bar coverage** вЂ” СЂР°СЃС€РёСЂРµРЅРѕ РїРѕРєСЂС‹С‚РёРµ РѕРїРµСЂР°С†РёР№ СЂРµРґР°РєС‚РѕСЂР°: РіСЂСѓРїРїРёСЂРѕРІРєР°/СЂР°Р·РіСЂСѓРїРїРёСЂРѕРІРєР°, РІС…РѕРґ/РІС‹С…РѕРґ РёР· group-edit-mode, СѓРґР°Р»РµРЅРёРµ РѕР±СЉРµРєС‚РѕРІ, РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ (СЃС‚Р°СЂС‚ + РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ СЂР°Р·РјРµС‰РµРЅРёСЏ), undo/redo (РІ С‚.С‡. В«Nothing to undo/redoВ»), РїРµСЂРµРјРµС‰РµРЅРёРµ РѕР±СЉРµРєС‚РѕРІ РјРµР¶РґСѓ СЃР»РѕСЏРјРё, new/open/save/save-as СѓСЂРѕРІРЅСЏ, РёРјРїРѕСЂС‚ Р°СЃСЃРµС‚РѕРІ (`src/core/GroupOperations.js`, `ObjectOperations.js`, `DuplicateOperations.js`, `HistoryOperations.js`, `LayerOperations.js`, `LevelFileOperations.js`).

- **Status Bar history popup** вЂ” `Logger.status.*` СЃРѕРѕР±С‰РµРЅРёСЏ С‚РµРїРµСЂСЊ РґРµСЂР¶Р°С‚СЃСЏ РґРѕ СЃР»РµРґСѓСЋС‰РµРіРѕ (Р±РµР· Р°РІС‚Рѕ-РѕС‡РёСЃС‚РєРё); РєР»РёРє РїРѕ СЃС‚СЂРѕРєРµ РѕС‚РєСЂС‹РІР°РµС‚ popup СЃ РёСЃС‚РѕСЂРёРµР№ (newest first, РґРѕ 100 Р·Р°РїРёСЃРµР№), Р·Р°РєСЂС‹РІР°РµС‚СЃСЏ РїРѕ Esc / РїРѕРІС‚РѕСЂРЅРѕРјСѓ РєР»РёРєСѓ / РєР»РёРєСѓ РІРЅРµ; `AssetPanel` вЂ” РѕС€РёР±РєРё РёРјРїРѕСЂС‚Р° PNG СЂРѕСѓС‚СЏС‚СЃСЏ С‡РµСЂРµР· `Logger.status` Рё РїРѕСЏРІР»СЏСЋС‚СЃСЏ РІ СЃС‚СЂРѕРєРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ (`src/ui/StatusBar.js`, `styles/status-bar.css`, `src/ui/AssetPanel.js`, `src/core/LevelEditor.js`).

- **Panel tabs drag fixed (capture conflict)** вЂ” СѓСЃС‚СЂР°РЅРµРЅР° РїСЂРёС‡РёРЅР°, РёР·-Р·Р° РєРѕС‚РѕСЂРѕР№ РІРєР»Р°РґРєРё В«РЅРµ РїРµСЂРµРјРµС‰Р°Р»РёСЃСЊВ»: global `mouseup` РІ `PanelPositionManager` (capture-phase) РѕС‡РёС‰Р°Р» drag-state РґРѕ Р»РѕРєР°Р»СЊРЅРѕРіРѕ reorder-С…РµРЅРґР»РµСЂР°. РўРµРїРµСЂСЊ global cleanup РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РІРЅРµ tab-strip; РІРЅСѓС‚СЂРё tab-strip Р·Р°РІРµСЂС€РµРЅРёРµ РґРµР»Р°РµС‚ panel-level handler. РўР°РєР¶Рµ РѕС‚РєР»СЋС‡С‘РЅ legacy bootstrap `setupTabDragging()` РІ `index.html`, С‡С‚РѕР±С‹ РЅРµ Р±С‹Р»Рѕ РєРѕРЅРєСѓСЂРёСЂСѓСЋС‰РёС… drag-С†РµРїРѕС‡РµРє (`src/ui/PanelPositionManager.js`, `index.html`).

- **Panel tabs drag-reorder restored** вЂ” РёСЃРїСЂР°РІР»РµРЅ drag РІРЅСѓС‚СЂРё РѕРґРЅРѕР№ РїР°РЅРµР»Рё: СЃРµР»РµРєС‚РѕСЂС‹ СЂР°СЃС€РёСЂРµРЅС‹ РґРѕ unified `.tab[data-tab]` (РЅРµ С‚РѕР»СЊРєРѕ `.tab-right/.tab-left`), СЃС‚Р°СЂС‚ drag РѕРіСЂР°РЅРёС‡РµРЅ Р»РµРІРѕР№ РєРЅРѕРїРєРѕР№ РјС‹С€Рё. РџСЂРёРјРµРЅРµРЅРѕ РІ `PanelPositionManager.setupTabDraggingForPanel()` Рё legacy bootstrap РІ `index.html`, Р±РµР· РёР·РјРµРЅРµРЅРёСЏ Р»РѕРіРёРєРё РїРµСЂРµРЅРѕСЃР° РјРµР¶РґСѓ РїР°РЅРµР»СЏРјРё (`src/ui/PanelPositionManager.js`, `index.html`).

- **Middle-mouse horizontal panning restored** вЂ” РІ `OutlinerPanel` Рё `LayersPanel` РґР»СЏ `setupScrolling()` РІРєР»СЋС‡С‘РЅ `horizontal: true` (РІРјРµСЃС‚Рѕ `false`), РїРѕСЌС‚РѕРјСѓ middle-drag С‚РµРїРµСЂСЊ РґРІРёРіР°РµС‚ РєРѕРЅС‚РµРЅС‚ РїРѕ X Рё Y, РµСЃР»Рё РєРѕРЅС‚РµР№РЅРµСЂ РїРµСЂРµРїРѕР»РЅРµРЅ; СЂР°РЅРµРµ РїРѕ X СЂР°Р±РѕС‚Р°Р» С‚РѕР»СЊРєРѕ `Shift+wheel` Р±СЂР°СѓР·РµСЂР° (`src/ui/OutlinerPanel.js`, `src/ui/LayersPanel.js`).

- **Outliner list scroll restored** вЂ” РїРѕСЃР»Рµ СѓСЃС‚СЂР°РЅРµРЅРёСЏ tab-leak РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР° РєРѕСЂСЂРµРєС‚РЅР°СЏ РїСЂРѕРєСЂСѓС‚РєР° Outliner: layout РїРµСЂРµРІРµРґС‘РЅ РЅР° CSS-РєР»Р°СЃСЃ (`outliner-tab-layout`) Рё РѕС‚РґРµР»СЊРЅС‹Р№ scroll-РєРѕРЅС‚РµР№РЅРµСЂ СЃРїРёСЃРєР° (`outliner-objects-container`), Р±РµР· inline `display:flex` РєРѕРЅС„Р»РёРєС‚РѕРІ СЃ hidden/show (`src/ui/OutlinerPanel.js`, `styles/main.css`).

- **Layers + Outliner same-panel bleed (final visibility fix)** вЂ” `setActivePanelTab()` С‚РµРїРµСЂСЊ СѓРїСЂР°РІР»СЏРµС‚ РЅРµ С‚РѕР»СЊРєРѕ РєР»Р°СЃСЃРѕРј `hidden`, РЅРѕ Рё `style.display` (`none` РґР»СЏ РІСЃРµС…, `''` РґР»СЏ Р°РєС‚РёРІРЅС‹С…), С‡С‚РѕР±С‹ inline-СЃС‚РёР»Рё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ РЅРµ РјРѕРіР»Рё СѓРґРµСЂР¶РёРІР°С‚СЊ РЅРµР°РєС‚РёРІРЅСѓСЋ РІРєР»Р°РґРєСѓ РІРёРґРёРјРѕР№. Р’ `Outliner.render()` СѓРґР°Р»РµРЅРѕ РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕРµ `display:flex`, РєРѕС‚РѕСЂРѕРµ РїРµСЂРµР±РёРІР°Р»Рѕ СЃРєСЂС‹С‚РёРµ РІРєР»Р°РґРєРё (`src/event-system/EventHandlers.js`, `src/ui/OutlinerPanel.js`).

- **Layers/Outliner content leakage** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: `setActivePanelTab()` С‚РµРїРµСЂСЊ РІСЃРµРіРґР° СЃРєСЂС‹РІР°РµС‚ РІРµСЃСЊ tab-content (РјР°СЂРєРµСЂС‹ + legacy `.tab-content-right/.tab-content-left`), Р° `ensurePanelTabMarkers()` РІС‹СЃС‚Р°РІР»СЏРµС‚ РєР°РЅРѕРЅРёС‡РµСЃРєРёРµ РјР°СЂРєРµСЂС‹ РґР»СЏ `details/layers/outliner` РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ С‚РµРєСѓС‰РµРіРѕ РЅР°Р±РѕСЂР° tab buttons. Р­С‚Рѕ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ В«РїСЂРѕС‚РµРєР°РЅРёРµВ» СЃРѕРґРµСЂР¶РёРјРѕРіРѕ Outliner РІ Layers РїСЂРё СЃР»РѕР¶РЅС‹С… РІР°СЂРёР°РЅС‚Р°С… СЃР±РѕСЂРєРё/РїРµСЂРµРЅРѕСЃР° (`src/event-system/EventHandlers.js`).

- **Tab assembly stability across panel variations** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ СЃРјРµС€РёРІР°РЅРёРµ СЃРѕРґРµСЂР¶РёРјРѕРіРѕ РІРєР»Р°РґРѕРє: `PanelPositionManager.moveTabElements()` С‚РµРїРµСЂСЊ РёС‰РµС‚ tab button Рё tab content СЃС‚СЂРѕРіРѕ РІ source-container (РІРјРµСЃС‚Рѕ РіР»РѕР±Р°Р»СЊРЅРѕРіРѕ `document.querySelector/getElementById`), С‡С‚Рѕ СѓР±РёСЂР°РµС‚ РєСЂРѕСЃСЃ-РїРѕРїР°РґР°РЅРёСЏ РїСЂРё СЃР»РѕР¶РЅС‹С… РІР°СЂРёР°РЅС‚Р°С… СЃР±РѕСЂРєРё/РїРµСЂРµРЅРѕСЃР°. РўР°РєР¶Рµ СѓР±СЂР°РЅС‹ РІСЂРµРјРµРЅРЅС‹Рµ РґСѓР±Р»РёСЂСѓСЋС‰РёРµ `id` Сѓ tab-РєРЅРѕРїРѕРє РІ `temp-tabs-panel` (`src/ui/PanelPositionManager.js`).

- **Outliner scroll target precision** вЂ” `OutlinerPanel` С‚РµРїРµСЂСЊ СЃРѕР·РґР°С‘С‚ РѕС‚РґРµР»СЊРЅС‹Р№ `#outliner-objects-container` (С‚РѕР»СЊРєРѕ СЃРїРёСЃРѕРє РѕР±СЉРµРєС‚РѕРІ, `overflow-y-auto/overflow-x-auto`) Рё middle-pan РїСЂРёРІСЏР·С‹РІР°РµС‚СЃСЏ Рє РЅРµРјСѓ. Р‘Р»РѕРє РїРѕРёСЃРєР°/С„РёР»СЊС‚СЂР° РѕСЃС‚Р°С‘С‚СЃСЏ С„РёРєСЃРёСЂРѕРІР°РЅРЅС‹Рј Рё РЅРµ РїРѕРїР°РґР°РµС‚ РІ scroll target (`src/ui/OutlinerPanel.js`).

- **Tab content routing + middle-pan target** вЂ” РґРѕСЂР°Р±РѕС‚Р°РЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР°: middle-pan С‚РµРїРµСЂСЊ РІС‹Р±РёСЂР°РµС‚ С‚РѕР»СЊРєРѕ СЂРµР°Р»СЊРЅРѕ scrollable overflow-РєРѕРЅС‚РµР№РЅРµСЂ (РЅРµ РІРµСЂС…РЅРёР№ panel-wrapper), Р° РґР»СЏ РІРєР»Р°РґРѕРє РІРІРµРґРµРЅР° СЃС‚Р°Р±РёР»СЊРЅР°СЏ РјР°СЂРєРёСЂРѕРІРєР° `data-panel-tab-content=true` + `data-panel-tab-name`. `setActivePanelTab()` СЃРєСЂС‹РІР°РµС‚/РїРѕРєР°Р·С‹РІР°РµС‚ РєРѕРЅС‚РµРЅС‚ РїРѕ СЌС‚РѕР№ РјР°СЂРєРёСЂРѕРІРєРµ, С‡С‚Рѕ РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РїСѓС‚Р°РЅРёС†Сѓ СЃРѕРґРµСЂР¶РёРјРѕРіРѕ РїРѕСЃР»Рµ РїРµСЂРµРЅРѕСЃРѕРІ РјРµР¶РґСѓ РїР°РЅРµР»СЏРјРё (`src/utils/ScrollUtils.js`, `src/event-system/EventHandlers.js`, `src/ui/PanelPositionManager.js`).

- **Outliner search block and middle-pan** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ Р°СЂС…РёС‚РµРєС‚СѓСЂРЅРѕ: middle-pan Р±РѕР»СЊС€Рµ РЅРµ СЃС‚Р°СЂС‚СѓРµС‚ СЃ РёРЅС‚РµСЂР°РєС‚РёРІРЅС‹С… РєРѕРЅС‚СЂРѕР»РѕРІ (`input/textarea/select/contenteditable`) Рё СЃ panel custom sections (`panel-top-custom`/`panel-bottom-custom` РїРѕРјРµС‡РµРЅС‹ `data-no-middle-pan=true`). Р­С‚Рѕ СѓР±РёСЂР°РµС‚ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Р№ СЃРєСЂРѕР»Р» РїРѕР»СЏ РїРѕРёСЃРєР° РІ Outliner Рё РІС‹СЂР°РІРЅРёРІР°РµС‚ РїРѕРІРµРґРµРЅРёРµ СЃ Layers (`src/utils/ScrollUtils.js`, `src/ui/panel-structures/BasePanelStructure.js`).

- **Universal middle-mouse scrolling architecture** вЂ” РІРЅРµРґСЂС‘РЅ РµРґРёРЅС‹Р№ РіР»РѕР±Р°Р»СЊРЅС‹Р№ РјРµС…Р°РЅРёР·Рј РІ `ScrollUtils`: РѕРґРёРЅ `document`-level capture handler РѕРїСЂРµРґРµР»СЏРµС‚ Р±Р»РёР¶Р°Р№С€РёР№ scrollable РєРѕРЅС‚РµР№РЅРµСЂ Рё Р·Р°РїСѓСЃРєР°РµС‚ pan Р±РµР· РїСЂРёРІСЏР·РєРё Рє РєРѕРЅРєСЂРµС‚РЅРѕР№ РїР°РЅРµР»Рё. Р Р°Р±РѕС‚Р°РµС‚ РґР»СЏ Р»СЋР±С‹С… СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… Рё РЅРѕРІС‹С… overflow-РєРѕРЅС‚РµР№РЅРµСЂРѕРІ СЂРµРґР°РєС‚РѕСЂР°, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ СЃС‚РѕСЂРѕРЅС‹ (left/right) Рё РєРѕР»РёС‡РµСЃС‚РІР° РїР°РЅРµР»РµР№. `BasePanel.setupScrolling()` С‚РµРїРµСЂСЊ СЃР»СѓР¶РёС‚ РєР°Рє РѕРїС†РёРѕРЅР°Р»СЊРЅС‹Р№ override-РєРѕРЅС„РёРі РєРѕРЅС‚РµР№РЅРµСЂР°, Р° РЅРµ РєР°Рє РѕР±СЏР·Р°С‚РµР»СЊРЅР°СЏ С‚РѕС‡РєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё (`src/utils/ScrollUtils.js`, `src/event-system/EventHandlers.js`).

- **Outliner/Layers middle-mouse panning** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: С†РµР»РµРІРѕР№ scroll-РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ `setupScrolling()` Р±РѕР»СЊС€Рµ РЅРµ РїСЂРёРІСЏР·Р°РЅ Рє `#right-panel`; С‚РµРїРµСЂСЊ Р±РµСЂС‘С‚СЃСЏ Р±Р»РёР¶Р°Р№С€РёР№ `.flex-grow.overflow-y-auto`, РїРѕСЌС‚РѕРјСѓ РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРµ СЂР°Р±РѕС‚Р°РµС‚ РїРѕСЃР»Рµ РїРµСЂРµРјРµС‰РµРЅРёСЏ РІРєР»Р°РґРѕРє РјРµР¶РґСѓ Р»РµРІС‹Рј/РїСЂР°РІС‹Рј РїР°РЅРµР»СЏРјРё (`src/ui/OutlinerPanel.js`, `src/ui/LayersPanel.js`).

- **Panel middle-mouse panning (Outliner/Assets)** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: `ScrollUtils.setupMiddleMouseScrolling()` Р±РѕР»СЊС€Рµ РЅРµ РґСѓР±Р»РёСЂСѓРµС‚ СЃР»СѓС€Р°С‚РµР»Рё РїСЂРё РїРѕРІС‚РѕСЂРЅРѕР№ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё (РѕР±РЅРѕРІР»СЏРµС‚ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ config), Р° `mousedown` РґР»СЏ СЃСЂРµРґРЅРµР№ РєРЅРѕРїРєРё РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РІ capture-С„Р°Р·Рµ. Р­С‚Рѕ РІРѕР·РІСЂР°С‰Р°РµС‚ СЃС‚Р°Р±РёР»СЊРЅРѕРµ РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРµ РІ РїР°РЅРµР»СЏС… Р°СѓС‚Р»Р°Р№РЅРµСЂР° Рё Р°СЃСЃРµС‚РѕРІ (`src/utils/ScrollUtils.js`).

- **Toolbar panning cursor** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: РїСЂРё middle-mouse РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРё С‚СѓР»Р±Р°СЂР° С‚РµРїРµСЂСЊ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ РєСѓСЂСЃРѕСЂ Р·Р°Р¶Р°С‚РѕР№ СЂСѓРєРё (`grabbing`), С‚Р°Рє РєР°Рє `toolbar-scroll` РїРѕР»СѓС‡РёР» РєР»Р°СЃСЃ `horizontal-scroll-container` Рё РёСЃРїРѕР»СЊР·СѓРµС‚ РѕР±С‰РµРµ CSS-РїСЂР°РІРёР»Рѕ `.horizontal-scroll-container.scrolling` (`src/ui/Toolbar.js`, `styles/panels.css`).

- **Status Bar** вЂ” РѕРґРЅРѕСЃС‚СЂРѕС‡РЅР°СЏ РїР°РЅРµР»СЊ СѓРІРµРґРѕРјР»РµРЅРёР№ РІРЅРёР·Сѓ СЂРµРґР°РєС‚РѕСЂР° (`src/ui/StatusBar.js`). РџРѕРєР°Р·С‹РІР°РµС‚ РІР°Р¶РЅС‹Рµ СЃРѕР±С‹С‚РёСЏ СЃ С†РІРµС‚РѕРІС‹Рј РєРѕРґРёСЂРѕРІР°РЅРёРµРј: `error` (РєСЂР°СЃРЅС‹Р№), `warn` (Р¶С‘Р»С‚С‹Р№), `success` (Р·РµР»С‘РЅС‹Р№), `info` (СЃРµСЂС‹Р№). Р’РёРґРёРјРѕСЃС‚СЊ Р·Р°РїРѕРјРёРЅР°РµС‚СЃСЏ РІ StateManager/UserPreferences, РїРµСЂРµРєР»СЋС‡Р°РµС‚СЃСЏ С‡РµСЂРµР· View в†’ Panels в†’ Status Bar. РџСЂСЏРјРѕР№ API: `editor.statusBar.show(message, type, duration)`. Logger-РёРЅС‚РµРіСЂР°С†РёСЏ: `Logger.status.warn/error/success/info(msg)` вЂ” РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ Р»РѕРіРёСЂСѓРµС‚ РІ РєРѕРЅСЃРѕР»СЊ (СЃ РїСЂРµС„РёРєСЃРѕРј `STATUS:`) Рё РїРѕРєР°Р·С‹РІР°РµС‚ РІ СЃС‚СЂРѕРєРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ. Callback СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· `Logger.setStatusCallback(fn)`. Р”Р»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РїРѕ С‚РёРїСѓ: error 10s, warn 7s, success/info 4-5s.

- **Settings в†’ Colors: Р»РµР№Р°СѓС‚** вЂ” Blender-СЃС‚РёР»СЊ: label РІС‹СЂРѕРІРЅРµРЅ РІРїСЂР°РІРѕ (flex 40%), С€РёСЂРѕРєР°СЏ С†РІРµС‚РѕРІР°СЏ РїРѕР»РѕСЃР° Р·Р°РїРѕР»РЅСЏРµС‚ РѕСЃС‚Р°РІС€РёРµСЃСЏ 60%. Logger Colors вЂ” 2-РєРѕР»РѕРЅРѕС‡РЅС‹Р№ РіСЂРёРґ СЃ С‚РµРјРё Р¶Рµ СЃС‚СЂРѕРєР°РјРё. РЈР±СЂР°РЅ `width: 100% !important` РґР»СЏ `input[type="color"]` РёР· `settings-panel.css`.
- **Settings в†’ Colors: Apply Changes** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: selection colors (`selection.outlineColor`, `groupOutlineColor`, `marqueeColor`, `hierarchyHighlightColor`, `activeLayerBorderColor`) С‚РµРїРµСЂСЊ РІ stateMapping в†’ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ. Р”РѕР±Р°РІР»РµРЅР° CSS-РїРµСЂРµРјРµРЅРЅР°СЏ `--accent-color` Рё `--selection-active-layer-border-color` РІ `applySpecialUISettings`.

### Fixed вЂ” Р“СЂСѓРїРїС‹: РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РѕР±СЉРµРєС‚РѕРІ РёР· СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РІ РґРѕС‡РµСЂРЅСЋСЋ РіСЂСѓРїРїСѓ; РІС‹Р±РѕСЂ РѕР±СЉРµРєС‚РѕРІ РїСЂРё РѕС‚РєСЂС‹С‚РѕР№ РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїРµ

#### рџђ› РСЃРїСЂР°РІР»РµРЅРѕ

- **Drag РёР· G1 РІ G2** вЂ” РїСЂРё РѕС‚РєСЂС‹С‚РѕР№ РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїРµ (G2 Р°РєС‚РёРІРЅР°, G1 СЂРѕРґРёС‚РµР»СЊСЃРєР°СЏ) РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РѕР±СЉРµРєС‚Р° РёР· G1 РІ РѕР±Р»Р°СЃС‚СЊ G2 С‚РµРїРµСЂСЊ СЂРµР°Р»СЊРЅРѕ РїРµСЂРµРЅРѕСЃРёС‚ РѕР±СЉРµРєС‚ РёР· `G1.children` РІ `G2.children` СЃ РїСЂР°РІРёР»СЊРЅС‹Рј РїРµСЂРµСЃС‡С‘С‚РѕРј РєРѕРѕСЂРґРёРЅР°С‚ Рё РЅР°СЃР»РµРґРѕРІР°РЅРёРµРј layerId. Р Р°РЅРµРµ `dragSelectedObjects` РґР»СЏ `isInAnyOpenGroup`-РѕР±СЉРµРєС‚РѕРІ РїСЂРѕСЃС‚Рѕ РґРµР»Р°Р» `obj.x += dx` Р±РµР· РїСЂРѕРІРµСЂРєРё РІС…РѕРґР° РІ Р°РєС‚РёРІРЅСѓСЋ РіСЂСѓРїРїСѓ (`MouseHandlers.js`).
- **Marquee РїСЂРё missed-click** вЂ” РєР»РёРє РЅР° РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ РІРЅСѓС‚СЂРё СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїС‹ (G1) РЅРѕ СЃРЅР°СЂСѓР¶Рё Р°РєС‚РёРІРЅРѕР№ РґРѕС‡РµСЂРЅРµР№ (G2) С‚РµРїРµСЂСЊ РґРµР»Р°РµС‚ stepback Рє G1 Р РЅР°С‡РёРЅР°РµС‚ marquee-РІС‹РґРµР»РµРЅРёРµ РІ G1. Р Р°РЅРµРµ С‚Р°РєРѕР№ РєР»РёРє С‚РѕР»СЊРєРѕ Р·Р°РєСЂС‹РІР°Р» G2 Р±РµР· РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РІС‹РґРµР»РёС‚СЊ С‡С‚Рѕ-Р»РёР±Рѕ (`MouseHandlers.js`).
- **findObjectAtPoint: РІС‹Р±РёСЂР°РµС‚СЃСЏ СЂРѕРґРёС‚РµР»СЊСЃРєР°СЏ РіСЂСѓРїРїР° РІРјРµСЃС‚Рѕ РѕР±СЉРµРєС‚Р°** вЂ” РїСЂРё РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё 2+ СѓСЂРѕРІРЅРµР№ РєР»РёРє РЅР° РѕРґРёРЅРѕС‡РЅС‹Р№ РѕР±СЉРµРєС‚ РІРЅСѓС‚СЂРё РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїС‹ РІС‹Р±РёСЂР°Р» СЃР°РјСѓ РіСЂСѓРїРїСѓ-РєРѕРЅС‚РµР№РЅРµСЂ (С‚.Рє. РµС‘ bounds РѕС…РІР°С‚С‹РІР°СЋС‚ РїРѕС‚РѕРјРєРѕРІ). Р’ `collectAllDescendants` РѕС‚РєСЂС‹С‚С‹Рµ РіСЂСѓРїРїС‹ (РёР· `openIds`) С‚РµРїРµСЂСЊ РїСЂРѕРїСѓСЃРєР°СЋС‚СЃСЏ РєР°Рє РєР°РЅРґРёРґР°С‚С‹ РґР»СЏ hit-test, РЅРѕ СЂРµРєСѓСЂСЃРёСЏ РІ РЅРёС… СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ вЂ” С‚Р°Рє РѕРґРёРЅРѕС‡РЅС‹Рµ РѕР±СЉРµРєС‚С‹ РІРЅСѓС‚СЂРё РїСЂР°РІРёР»СЊРЅРѕ РїРѕРїР°РґР°СЋС‚ РІ СЃРїРёСЃРѕРє (`ObjectOperations.js`).
- **Alt+drag РёСЃРїСЂР°РІР»РµРЅ** вЂ” РІС‹С‡РёСЃР»РµРЅРёРµ world-РїРѕР·РёС†РёРё РїСЂРё Alt+drag РґР»СЏ `isInAnyOpenGroup`-РѕР±СЉРµРєС‚РѕРІ С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `getObjectWorldPosition(obj)` РІРјРµСЃС‚Рѕ РѕС€РёР±РѕС‡РЅРѕРіРѕ `groupPos.x + obj.x` (РєРѕС‚РѕСЂС‹Р№ РґР°РІР°Р» РЅРµРІРµСЂРЅС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РІ СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РіСЂСѓРїРїРµ).
- **РџРѕСЂС‚ СЃРµСЂРІРµСЂР°** вЂ” `start_Editor.bat`, `.vscode/launch.json`, `Context_map.md`, `docs/QUICK_START.md` СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ РЅР° РїРѕСЂС‚ **8000** (СЂР°РЅРµРµ Node.js serve РёСЃРїРѕР»СЊР·РѕРІР°Р» РїРѕСЂС‚ 3000).

- **CacheManager: spatial index fast path** вЂ” `getSelectableObjectsInViewport()` РІ fast path РёС‚РµСЂРёСЂРѕРІР°Р»Р° `viewportObjects` РєР°Рє `obj.id`, РЅРѕ `getVisibleObjectsSpatial` РІРѕР·РІСЂР°С‰Р°РµС‚ `{obj, parentX, parentY}` вЂ” РЅСѓР¶РЅРѕ `item.obj.id`. РЎР»РµРґСЃС‚РІРёРµ: РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ СЂРµРЅРґРµСЂР° `selectableInViewport` РІСЃРµРіРґР° РїСѓСЃС‚Р° в†’ `findObjectAtPoint` РІРѕР·РІСЂР°С‰Р°РµС‚ null РґР»СЏ РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ в†’ РєР»РёРє+РґСЂР°Рі РЅР° РІРµСЂС…РЅРµРј СѓСЂРѕРІРЅРµ РЅРµ СЂР°Р±РѕС‚Р°РµС‚ (`CacheManager.js`).

- **Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ РІРЅСѓС‚СЂРё РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїС‹: РїСЂРµРІСЊСЋ, offset, selection, highlight** вЂ” С‡РµС‚С‹СЂРµ СЃРІСЏР·Р°РЅРЅС‹С… Р±Р°РіР°: (1) РїСЂРµРІСЊСЋ РЅРµ РїРѕСЏРІР»СЏР»РѕСЃСЊ вЂ” `initializePositions` РёСЃРїРѕР»СЊР·РѕРІР°Р»Р° `isObjectInGroupRecursive(clone)` Рё `getObjectWorldPosition(clone)`, РЅРѕ РїРѕСЃР»Рµ `reassignIdsDeep` РєР»РѕРЅ РЅРµРґРѕСЃС‚СѓРїРµРЅ РІ РґРµСЂРµРІРµ в†’ РІСЃРµРіРґР° local coords в†’ РїСЂРµРІСЊСЋ СЂРёСЃРѕРІР°Р»РѕСЃСЊ Р·Р° viewport. Р¤РёРєСЃ: `_worldX/_worldY` Рё `_inGroup` РІС‹С‡РёСЃР»СЏСЋС‚СЃСЏ РґРѕ `reassignIdsDeep` РІ `startFromSelection`. (2) РїСЂРµРІСЊСЋ СЃРѕ СЃРґРІРёРіРѕРј вЂ” СЃРїРµС†РёР°Р»СЊРЅС‹Р№ case `_inGroup в†’ offsetX:0` СЃС‚Р°РІРёР» preview С‚РѕС‡РЅРѕ РІ РєСѓСЂСЃРѕСЂ; СѓРґР°Р»С‘РЅ вЂ” С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ С‚РѕС‚ Р¶Рµ offset-calculation С‡С‚Рѕ Рё РґР»СЏ top-level РѕР±СЉРµРєС‚РѕРІ, РїСЂРёРІСЏР·С‹РІР°СЏ Рє С‚РѕС‡РєРµ РєР»РёРєР°. (3) РїРѕСЃР»Рµ СЂР°Р·РјРµС‰РµРЅРёСЏ Р±С‹Р» РІС‹Р±СЂР°РЅ РѕСЂРёРіРёРЅР°Р» вЂ” `handleMouseDown` РїСЂРё РєР»РёРєРµ РґР»СЏ СЂР°Р·РјРµС‰РµРЅРёСЏ РІС‹Р·С‹РІР°Р» `handleObjectClick` РЅР° РѕСЂРёРіРёРЅР°Р»Рµ, РјРµРЅСЏСЏ selection Рё СЃС‚Р°РІСЏ `isDragging=true`; РґРѕР±Р°РІР»РµРЅР° СЂР°РЅРЅСЏСЏ РїСЂРѕРІРµСЂРєР° `if (mouse.isPlacingObjects) return`. (4) РїРѕРґСЃРІРµС‚РєР° РѕСЂРёРіРёРЅР°Р»Р° РІРѕ РІСЂРµРјСЏ РїСЂРµРІСЊСЋ вЂ” `selectedObjects` СЃРѕРґРµСЂР¶Р°Р»Р° ID РѕСЂРёРіРёРЅР°Р»Р° РјРµР¶РґСѓ Shift+D Рё mouseup; С‚РµРїРµСЂСЊ `startFromSelection` СЃР±СЂР°СЃС‹РІР°РµС‚ `selectedObjects = new Set()` РїРµСЂРµРґ render, С‚Р°Рє С‡С‚Рѕ РѕСЂРёРіРёРЅР°Р» РЅРµ РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ РІ preview-С„Р°Р·Рµ (`DuplicateOperations.js`, `DuplicateUtils.js`, `MouseHandlers.js`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/event-system/MouseHandlers.js` В· `src/managers/CacheManager.js` В· `start_Editor.bat` В· `.vscode/launch.json` В· `Context_map.md` В· `docs/QUICK_START.md`

---

### Perf вЂ” M9, M7, M8, M6: lazy spatial index, spatial-aware selectable filter, per-layer cache, ctx.save hoisting

#### вљЎ РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ

- **M9. buildSpatialIndex: lazy dirty-flag** вЂ” РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `markSpatialIndexDirty()` РІ `RenderOperations`. Р’СЃРµ РІРЅРµС€РЅРёРµ РІС‹Р·РѕРІС‹ `buildSpatialIndex()` (GroupOperations, LayerOperations, HistoryOperations, CacheManager) Р·Р°РјРµРЅРµРЅС‹ РЅР° `markSpatialIndexDirty()`. РџРµСЂРµСЃС‚СЂРѕР№РєР° O(N) РѕС‚РєР»Р°РґС‹РІР°РµС‚СЃСЏ РґРѕ РЅР°С‡Р°Р»Р° СЃР»РµРґСѓСЋС‰РµРіРѕ `getVisibleObjectsSpatial()` РІ render-loop. Init LevelEditor РѕСЃС‚Р°РІР»РµРЅ РїСЂСЏРјС‹Рј РІС‹Р·РѕРІРѕРј (`RenderOperations.js`, `GroupOperations.js`, `LayerOperations.js`, `HistoryOperations.js`, `CacheManager.js`).
- **M7. getSelectableObjectsInViewport: spatial index РєР°Рє РєР°РЅРґРёРґР°С‚С‹** вЂ” РїСЂРё РЅР°Р»РёС‡РёРё spatial index `getSelectableObjectsInViewport()` С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `getVisibleObjectsSpatial()` (O(k), k в‰Є N) РІРјРµСЃС‚Рѕ РёС‚РµСЂР°С†РёРё РІСЃРµС… selectable РѕР±СЉРµРєС‚РѕРІ. Р—Р°РѕРґРЅРѕ РёСЃРїСЂР°РІР»РµРЅ Р±Р°Рі: `camera.scale` (undefined, РґР°РІР°Р»Рѕ NaN-bounds Рё РїСЂРѕРїСѓСЃРєР°Р»Рѕ РІСЃРµ РѕР±СЉРµРєС‚С‹) Р·Р°РјРµРЅС‘РЅ РЅР° `camera.zoom` РєР°Рє РІ РѕСЃС‚Р°Р»СЊРЅРѕРј РєРѕРґРµ (`CacheManager.js`).
- **M8. effectiveLayerCache: per-layer invalidation** вЂ” РґРѕР±Р°РІР»РµРЅ РѕР±СЂР°С‚РЅС‹Р№ РёРЅРґРµРєСЃ `_layerToObjectIds: Map<layerId, Set<objId>>`, Р·Р°РїРѕР»РЅСЏРµРјС‹Р№ Р»РµРЅРёРІРѕ РІ `getCachedEffectiveLayerId()`. РџСЂРё layer-РёР·РјРµРЅРµРЅРёРё `smartCacheInvalidation()` С‚РµРїРµСЂСЊ СѓРґР°Р»СЏРµС‚ С‚РѕР»СЊРєРѕ Р·Р°РїРёСЃРё РѕР±СЉРµРєС‚РѕРІ Р·Р°С‚СЂРѕРЅСѓС‚РѕРіРѕ СЃР»РѕСЏ РІРјРµСЃС‚Рѕ `effectiveLayerCache.clear()`. Fallback РЅР° РїРѕР»РЅСѓСЋ РѕС‡РёСЃС‚РєСѓ РµСЃР»Рё РёРЅРґРµРєСЃ РЅРµ РїСЂРѕРіСЂРµС‚ (`CacheManager.js`).
- **M6. ctx.save/restore: hoisting Р·Р° РїСЂРµРґРµР»С‹ forEach** вЂ” РІ `drawHierarchyHighlightForGroup()` Рё `drawDuplicateHierarchyHighlight()` `ctx.save()/restore()` РІС‹РЅРµСЃРµРЅС‹ Р·Р° РїСЂРµРґРµР»С‹ forEach-С†РёРєР»Р°: РѕРґРёРЅ СЂР°Р· РЅР° depth РІРјРµСЃС‚Рѕ 2Г— РЅР° РєР°Р¶РґС‹Р№ РґРѕС‡РµСЂРЅРёР№ РѕР±СЉРµРєС‚. `fillStyle` СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РѕРґРёРЅ СЂР°Р· РїРµСЂРµРґ С†РёРєР»РѕРј (РЅРµ РјРµРЅСЏРµС‚СЃСЏ РІ СЂР°РјРєР°С… РѕРґРЅРѕРіРѕ depth). Р РµРєСѓСЂСЃРёРІРЅС‹Рµ РІС‹Р·РѕРІС‹ РґРµР»Р°СЋС‚ СЃРѕР±СЃС‚РІРµРЅРЅС‹Р№ save/restore Рё РІРѕР·РІСЂР°С‰Р°СЋС‚ ctx РІ РёСЃС…РѕРґРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ (`RenderOperations.js`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/core/RenderOperations.js` В· `src/core/GroupOperations.js` В· `src/core/LayerOperations.js` В· `src/core/HistoryOperations.js` В· `src/managers/CacheManager.js`

---

### Fixed вЂ” Р“СЂСѓРїРїС‹: РєРѕСЂСЂРµРєС‚РЅР°СЏ СЂР°Р±РѕС‚Р° РїСЂРё РіР»СѓР±РѕРєРѕР№ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё (3+ СѓСЂРѕРІРЅРµР№)

- **`GroupOperations.extractObjectFromGroup`**: РёСЃРїСЂР°РІР»РµРЅ СЂР°СЃС‡С‘С‚ РєРѕРѕСЂРґРёРЅР°С‚ РїСЂРё РёР·РІР»РµС‡РµРЅРёРё РѕР±СЉРµРєС‚Р° РёР· РІР»РѕР¶РµРЅРЅРѕР№ РіСЂСѓРїРїС‹. Р Р°РЅРµРµ РёСЃРїРѕР»СЊР·РѕРІР°Р»РёСЃСЊ `group.x`/`group.y` (Р»РѕРєР°Р»СЊРЅС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ СЂРѕРґРёС‚РµР»СЏ), С‡С‚Рѕ РґР°РІР°Р»Рѕ РЅРµРІРµСЂРЅСѓСЋ РїРѕР·РёС†РёСЋ РїСЂРё РіР»СѓР±РёРЅРµ в‰Ґ 2. РўРµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `getObjectWorldPosition(group)` вЂ” РїРѕР»РЅС‹Р№ РјРёСЂРѕРІРѕР№ DFS-РѕР±С…РѕРґ (`GroupOperations.js`).
- **`GroupOperations.extractObjectFromGroup`**: РїСЂРё РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРїР°С… РґРѕС‡РµСЂРЅРёР№ РѕР±СЉРµРєС‚ С‚РµРїРµСЂСЊ РїРµСЂРµРјРµС‰Р°РµС‚СЃСЏ РІ **СЂРѕРґРёС‚РµР»СЊСЃРєСѓСЋ РіСЂСѓРїРїСѓ** СЃ РїСЂР°РІРёР»СЊРЅС‹РјРё РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹РјРё РєРѕРѕСЂРґРёРЅР°С‚Р°РјРё, Р° РЅРµ РЅР° РІРµСЂС…РЅРёР№ СѓСЂРѕРІРµРЅСЊ (`level.objects`). Р­С‚Рѕ СЃРѕС…СЂР°РЅСЏРµС‚ РёРµСЂР°СЂС…РёСЋ: Р·Р°РєСЂС‹С‚РёРµ G3 (G1в†’G2в†’G3) СЃ 1 РґРѕС‡РµСЂРЅРёРј РѕР±СЉРµРєС‚РѕРј РєРѕСЂСЂРµРєС‚РЅРѕ РїРµСЂРµРЅРѕСЃРёС‚ РµРіРѕ РІ G2, РЅРµ Р»РѕРјР°СЏ СЃС‚СЂСѓРєС‚СѓСЂСѓ (`GroupOperations.js`).
- **`GroupOperations._findParentGroup`**: РґРѕР±Р°РІР»РµРЅ РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Р№ РјРµС‚РѕРґ вЂ” СЂРµРєСѓСЂСЃРёРІРЅС‹Р№ РїРѕРёСЃРє СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РіСЂСѓРїРїС‹ РїРѕ РІСЃРµРјСѓ РґРµСЂРµРІСѓ РѕР±СЉРµРєС‚РѕРІ СѓСЂРѕРІРЅСЏ (`GroupOperations.js`).

## [3.54.5] - 2026-07-01

### Fixed вЂ” РўРµС…РЅРёС‡РµСЃРєРёР№ Р°СѓРґРёС‚ v3.54.4: РєСЂРёС‚РёС‡РµСЃРєРёРµ Р±Р°РіРё, РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ, Р°СЂС…РёС‚РµРєС‚СѓСЂРЅР°СЏ РіРёРіРёРµРЅР°

#### рџђ› РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ Р±Р°РіРё

- **C1. Undo-СЂР°СЃСЃРёРЅС…СЂРѕРЅ РїРѕСЃР»Рµ drag-cancel РІРЅРµ РѕРєРЅР°** вЂ” `MouseHandlers.handleGlobalMouseUp()` С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°РµС‚ `historyOperations.undo()` (РїРѕР»РЅРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃ rebuild РёРЅРґРµРєСЃРѕРІ/РІС‹Р±РѕСЂРєРё) РІРјРµСЃС‚Рѕ РЅРёР·РєРѕСѓСЂРѕРІРЅРµРІРѕРіРѕ `historyManager.undo()` (`MouseHandlers.js`).
- **C2. РљСЂР°С€ РїСЂРё drag РіСЂСѓРїРїС‹ РІ СЃР°РјСѓ СЃРµР±СЏ** вЂ” РґРѕР±Р°РІР»РµРЅ guard РІ `dragSelectedObjects()`: Р·Р°РїСЂРµС‰Р°РµС‚ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ РіСЂСѓРїРїС‹ РІ СЃР°РјСѓ СЃРµР±СЏ РёР»Рё РІ СЃРѕР±СЃС‚РІРµРЅРЅРѕРіРѕ РїРѕС‚РѕРјРєР° (`wouldCreateCycle` С‡РµСЂРµР· `isObjectInGroupRecursive`) (`MouseHandlers.js`).
- **H5. Escape РЅРµ С‡РёСЃС‚РёР» pending-marquee state** вЂ” `marqueePendingStartPos` РґРѕР±Р°РІР»РµРЅ РІ `hasActiveProcess`-РїСЂРѕРІРµСЂРєСѓ РІ `handleKeyDown()`, С‚РµРїРµСЂСЊ Escape РєРѕСЂСЂРµРєС‚РЅРѕ РјР°СЂС€СЂСѓС‚РёР·РёСЂСѓРµС‚СЃСЏ РІ `cancelAllActions()` (`EventHandlers.js`).
- **H6. РџРѕС‚РµСЂСЏ С„РѕРєСѓСЃР° (Alt-Tab) РІРѕ РІСЂРµРјСЏ drag/marquee** вЂ” РґРѕР±Р°РІР»РµРЅ `MouseHandlers.handleWindowBlur()`, РІС‹Р·С‹РІР°РµС‚СЃСЏ РёР· СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ `visibilitychange`-РѕР±СЂР°Р±РѕС‚С‡РёРєР° РїСЂРё `document.hidden`: С„РёРЅР°Р»РёР·РёСЂСѓРµС‚ marquee, РѕС‚РєР°С‚С‹РІР°РµС‚ РЅРµР·Р°РІРµСЂС€С‘РЅРЅС‹Р№ drag С‡РµСЂРµР· `historyOperations.undo()`, СЃР±СЂР°СЃС‹РІР°РµС‚ С„Р»Р°РіРё РєРЅРѕРїРѕРє РјС‹С€Рё (`MouseHandlers.js`, `LevelEditor.js`).
- **M3. OutlinerPanel "Duplicate" вЂ” РїСѓСЃС‚Р°СЏ Р·Р°РіР»СѓС€РєР°** вЂ” РїРѕРґРєР»СЋС‡С‘РЅ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ `DuplicateOperations` С‡РµСЂРµР· `levelEditor.duplicateSelectedObjects()` (`OutlinerPanel.js`).
- **L2. РќР°РєРѕРїР»РµРЅРёРµ Escape-listener'РѕРІ РІ color picker СЃР»РѕСЏ** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ: handler С…СЂР°РЅРёС‚СЃСЏ РїРѕ СЃСЃС‹Р»РєРµ Рё СЏРІРЅРѕ СѓРґР°Р»СЏРµС‚СЃСЏ С‡РµСЂРµР· `removeEventListener` РІРѕ РІСЃРµС… РїСѓС‚СЏС… Р·Р°РєСЂС‹С‚РёСЏ (change / blur / Escape) (`LayersPanel.js`).

#### вљЎ РЈР»СѓС‡С€РµРЅРёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё

- **H2. РљСЌС€РёСЂРѕРІР°РЅРёРµ РїРѕСЂСЏРґРєР° СЂРµРЅРґРµСЂР°** вЂ” СЃРѕСЂС‚РёСЂРѕРІРєР° visible objects РїРѕ zIndex РІС‹С‡РёСЃР»СЏРµС‚СЃСЏ Рё РєСЌС€РёСЂСѓРµС‚СЃСЏ РІРјРµСЃС‚Рµ СЃ `visibleObjectsCache` (С‚РѕС‚ Р¶Рµ TTL/РёРЅРІР°Р»РёРґР°С†РёСЏ); СѓСЃС‚СЂР°РЅРµРЅРѕ СЃРѕР·РґР°РЅРёРµ РЅРѕРІРѕРіРѕ РѕС‚СЃРѕСЂС‚РёСЂРѕРІР°РЅРЅРѕРіРѕ РјР°СЃСЃРёРІР° РЅР° РєР°Р¶РґС‹Р№ `render()` РІС‹Р·РѕРІ (`RenderOperations.js`).
- **H3. Throttle РґР»СЏ global mousemove** вЂ” РґРѕР±Р°РІР»РµРЅ `_throttledGlobalMouseMove` СЃ С‚РµРј Р¶Рµ `PERFORMANCE.MOUSE_MOVE_THROTTLE_MS`, С‡С‚Рѕ Рё РѕР±С‹С‡РЅС‹Р№ mousemove; СѓСЃС‚СЂР°РЅСЏРµС‚ РЅРµРѕРіСЂР°РЅРёС‡РµРЅРЅС‹Рµ РІС‹Р·РѕРІС‹ `render()` РїСЂРё marquee Р·Р° РїСЂРµРґРµР»Р°РјРё canvas (`MouseHandlers.js`).
- **H4. РњРµРјРѕРёР·Р°С†РёСЏ renderPreviews() РІ AssetPanel** вЂ” РґРѕР±Р°РІР»РµРЅ guard: РїРѕР»РЅС‹Р№ teardown/rebuild DOM-РіСЂРёРґР° РїСЂРѕРїСѓСЃРєР°РµС‚СЃСЏ, РµСЃР»Рё РЅР°Р±РѕСЂ Р°СЃСЃРµС‚РѕРІ, РІС‹Р±РѕСЂРєР°, viewMode Рё СЂР°Р·РјРµСЂС‹ РЅРµ РёР·РјРµРЅРёР»РёСЃСЊ СЃ РїСЂРѕС€Р»РѕРіРѕ РІС‹Р·РѕРІР° (`AssetPanel.js`).
- **M1. РћС‡РёСЃС‚РєР° РєСЌС€РµР№ РїСЂРё СЃРјРµРЅРµ СѓСЂРѕРІРЅСЏ** вЂ” `newLevel()`/`openLevel()` С‚РµРїРµСЂСЊ РІС‹Р·С‹РІР°СЋС‚ `editor.clearCaches()` РїРµСЂРµРґ `stateManager.reset()`, РѕСЃРІРѕР±РѕР¶РґР°СЏ РѕР±СЉРµРєС‚С‹ РїСЂРµРґС‹РґСѓС‰РµРіРѕ СѓСЂРѕРІРЅСЏ РёР· С‚СЂС‘С… РЅРµРѕРіСЂР°РЅРёС‡РµРЅРЅС‹С… Map-РєСЌС€РµР№ (`LevelFileOperations.js`).

#### рџЏ—пёЏ РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СѓР»СѓС‡С€РµРЅРёСЏ

- **H7. РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ `updateDialogSize()`** вЂ” Р»РѕРіРёРєР° СЂР°СЃС‡С‘С‚Р° Рё РїСЂРёРјРµРЅРµРЅРёСЏ С€РёСЂРёРЅС‹ РІС‹РЅРµСЃРµРЅР° РІ `DialogResizer.applyCalculatedWidth()` (СЃС‚Р°С‚РёС‡РµСЃРєРёР№ РјРµС‚РѕРґ); `BaseDialog` Рё `SettingsPanel` С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓСЋС‚ РѕРґРёРЅ РєРѕРґ РІРјРµСЃС‚Рѕ РґРІСѓС… РїРѕС‡С‚Рё РёРґРµРЅС‚РёС‡РЅС‹С… РєРѕРїРёР№ (`DialogResizer.js`, `BaseDialog.js`, `SettingsPanel.js`).
- **M2. РЈСЃС‚СЂР°РЅРµРЅРёРµ С‚СЂРѕР№РЅРѕР№ СЂРµРіРёСЃС‚СЂР°С†РёРё global mouseup** вЂ” СѓРґР°Р»РµРЅС‹ РёР·Р±С‹С‚РѕС‡РЅС‹Рµ Р±Р»РѕРєРё `global-mouse-document` Рё `global-mouse-window`; РѕСЃС‚Р°РІР»РµРЅР° РµРґРёРЅСЃС‚РІРµРЅРЅР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ РЅР° `window` (РїРѕ РѕР±СЂР°Р·С†Сѓ `BasePanel`) (`EventHandlers.js`).
- **M4. Р‘Р»РѕРєРёСЂРѕРІРєР° newLevel/openLevel РїСЂРё Р°РєС‚РёРІРЅРѕРј drag/marquee** вЂ” РґРѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° `_hasActiveMouseOperation()` РІ РЅР°С‡Р°Р»Рµ РѕР±РѕРёС… РјРµС‚РѕРґРѕРІ, РёСЃРєР»СЋС‡Р°СЏ СЂРёСЃРє "ghost edits" РїСЂРё race РјРµР¶РґСѓ drag Рё File menu (`LevelFileOperations.js`).
- **M5. РЈРґР°Р»РµРЅРёРµ РјС‘СЂС‚РІС‹С… test\*() РјРµС‚РѕРґРѕРІ** вЂ” `testContextMenu`, `testContextMenuManager`, `testGlobalClickHandler`, `testPanningDetection`, `testMenuAutoClose`, `testCursorPositioning` СѓРґР°Р»РµРЅС‹ РёР· `LevelEditor.js` (115 СЃС‚СЂРѕРє, РЅРµС‚ РЅРё РѕРґРЅРѕРіРѕ caller'Р°, РЅРµС‚ Р°СЃСЃРµСЂС‚РѕРІ, РЅРµ РїСЂРѕРёР·РІРѕРґРёР»Рё РЅР°Р±Р»СЋРґР°РµРјС‹С… СЌС„С„РµРєС‚РѕРІ) (`LevelEditor.js`).
- **L1. РљРѕСЂСЂРµРєС‚РЅР°СЏ РѕС‚РїРёСЃРєР° РѕС‚ StateManager РІ destroy()** вЂ” `FoldersPanel` Рё `AssetPanel` С‚РµРїРµСЂСЊ СЃРѕС…СЂР°РЅСЏСЋС‚ unsubscribe-С„СѓРЅРєС†РёРё РІ `this.subscriptions[]` Рё РІС‹Р·С‹РІР°СЋС‚ РёС… РІ `destroy()` РїРѕ РѕР±СЂР°Р·С†Сѓ `LayersPanel` (`FoldersPanel.js`, `AssetPanel.js`).

#### рџ§№ Р§РёСЃС‚РєР° РєРѕРґР°

- **H9/L5. console.log РІ hot-path Рё BaseContextMenu** вЂ” СѓРґР°Р»РµРЅС‹: `console.log(new Error().stack)` РёР· `LevelEditor.updateAllPanels()`, 5 РІС‹Р·РѕРІРѕРІ РёР· `BaseContextMenu`, 2 РёР· `OutlinerPanel.render()`, 6 РґСѓР±Р»РёСЂСѓСЋС‰РёС… РёР· `AssetImporter` (СЂСЏРґРѕРј СѓР¶Рµ Р±С‹Р»Рё Logger-РІС‹Р·РѕРІС‹), 1 РёР· `DetailsPanel`. Р—Р°РјРµРЅРµРЅС‹ РЅР° `Logger.*`: `DialogSizeManager` (РґРѕР±Р°РІР»РµРЅ РёРјРїРѕСЂС‚), `BaseContextMenu`.
- **L3. РћС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёР№ Logger.menu accessor** вЂ” `Logger` СЃРѕРґРµСЂР¶Р°Р» Р·Р°РїРёСЃСЊ `MENU` РІ `CATEGORIES`, РЅРѕ РЅРµ РёРјРµР» СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РµРіРѕ `static menu = { info, debug, warn, error }` вЂ” РІС‹Р·РѕРІ `Logger.menu.info(...)` РїСЂРёРІРѕРґРёР» Рє РєСЂР°С€-СЃС‚Р°СЂС‚Сѓ СЂРµРґР°РєС‚РѕСЂР° (`TypeError: Cannot read properties of undefined (reading 'info')`). Р”РѕР±Р°РІР»РµРЅ `static menu` accessor РїРѕ Р°РЅР°Р»РѕРіРёРё СЃ РѕСЃС‚Р°Р»СЊРЅС‹РјРё 28 РєР°С‚РµРіРѕСЂРёСЏРјРё (`src/utils/Logger.js`).
- **L4. Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ Logger** вЂ” РёСЃРїСЂР°РІР»РµРЅРѕ С‡РёСЃР»Рѕ РєР°С‚РµРіРѕСЂРёР№: 17в†’29 РІ `DEVELOPMENT_GUIDE.md`, 19в†’29 РІ `ARCHITECTURE.md`.

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/event-system/MouseHandlers.js` В· `src/event-system/EventHandlers.js` В· `src/core/LevelEditor.js` В· `src/core/LevelFileOperations.js` В· `src/core/RenderOperations.js` В· `src/core/ObjectOperations.js (С‡РµСЂРµР· OutlinerPanel)` В· `src/ui/OutlinerPanel.js` В· `src/ui/AssetPanel.js` В· `src/ui/FoldersPanel.js` В· `src/ui/BaseContextMenu.js` В· `src/ui/DetailsPanel.js` В· `src/ui/LayersPanel.js` В· `src/ui/BaseDialog.js` В· `src/ui/SettingsPanel.js` В· `src/utils/DialogResizer.js` В· `src/utils/DialogSizeManager.js` В· `src/utils/AssetImporter.js` В· `src/utils/ParallaxRenderer.js` В· `src/utils/Logger.js` В· `src/managers/MenuManager.js` В· `docs/ARCHITECTURE.md` В· `docs/DEVELOPMENT_GUIDE.md`

### Fixed вЂ” Р РµРіСЂРµСЃСЃРёРё, РѕР±РЅР°СЂСѓР¶РµРЅРЅС‹Рµ РїСЂРё live-С‚РµСЃС‚РёСЂРѕРІР°РЅРёРё (chrome-devtools MCP)

#### рџђ› РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ Р±Р°РіРё

- **РљСЂР°С€ СЂРµРЅРґРµСЂ-Р»СѓРїР°: `visibleObjects is not defined`** вЂ” Р’ `RenderOperations.render()` РїРµСЂРµРјРµРЅРЅР°СЏ `sortedObjects` (СЂРµР·СѓР»СЊС‚Р°С‚ `this.getVisibleObjects(camera)`, СЃС‚СЂРѕРєР° 374) Р±С‹Р»Р° РїРµСЂРµРёРјРµРЅРѕРІР°РЅР° РІ С…РѕРґРµ СЂРµС„Р°РєС‚РѕСЂРёРЅРіР°, РЅРѕ РїРµСЂРёРѕРґРёС‡РµСЃРєРёР№ Р»РѕРі РЅР° СЃС‚СЂРѕРєРµ 472 РѕСЃС‚Р°Р»СЃСЏ СЃСЃС‹Р»Р°С‚СЊСЃСЏ РЅР° СЃС‚Р°СЂРѕРµ РёРјСЏ `visibleObjects`. РСЃРїСЂР°РІР»РµРЅРѕ: `visibleObjects.length` в†’ `sortedObjects.length` (`src/core/RenderOperations.js`).
- **Duplicate РЅРµ СЂР°Р±РѕС‚Р°Р»: `duplicateSelectedObjects is not a function`** вЂ” `LevelEditor.duplicateSelectedObjects()` РІС‹Р·С‹РІР°Р» `this.duplicateOperations.duplicateSelectedObjects()`, РєРѕС‚РѕСЂРѕРіРѕ РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚. РџСЂР°РІРёР»СЊРЅРѕРµ РёРјСЏ РјРµС‚РѕРґР° вЂ” `startFromSelection()`. РСЃРїСЂР°РІР»РµРЅРѕ РІ `src/core/LevelEditor.js`.
- **ConfigManager: 16 Р»РёС€РЅРёС… 404 РІ РєРѕРЅСЃРѕР»Рё РїСЂРё РєР°Р¶РґРѕРј СЃС‚Р°СЂС‚Рµ** вЂ” `loadUserConfigsFromStorage()` РїС‹С‚Р°Р»Р°СЃСЊ РїРѕРґРіСЂСѓР·РёС‚СЊ `config/user/<name>.json` РґР»СЏ 8 РєРѕРЅС„РёРіРѕРІ (camera, selection, assets, performance, shortcuts, view, toolbar, grid), РґР»СЏ РєРѕС‚РѕСЂС‹С… С„Р°Р№Р»С‹ РІ `config/user/` РЅРµ РїСЂРµРґСѓСЃРјРѕС‚СЂРµРЅС‹ (С‚РѕР»СЊРєРѕ editor/canvas/panels Р·Р°РґРѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅС‹ РІ `config/user/README.md`). Р”РѕР±Р°РІР»РµРЅ `this.fileBackedConfigs = ['editor', 'canvas', 'panels']`, file-fetch РѕРіСЂР°РЅРёС‡РµРЅ СЌС‚РёРј СЃРїРёСЃРєРѕРј (`src/managers/ConfigManager.js`).
- **Р”РµР»РµРіРёСЂРѕРІР°РЅРЅС‹Рµ blur/focus РЅРµ СЃСЂР°Р±Р°С‚С‹РІР°Р»Рё в†’ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёРµ СЃР»РѕСЏ СЃР»РµС‚Р°Р»Рѕ** вЂ” `EventHandlerManager.setupContainerEventListeners()` РЅР°РІРµС€РёРІР°Р» `blur`/`focus` РѕР±СЂР°Р±РѕС‚С‡РёРєРё РІ bubble-С„Р°Р·Рµ, РЅРѕ СЌС‚Рё СЃРѕР±С‹С‚РёСЏ РЅРµ РІСЃРїР»С‹РІР°СЋС‚ (`non-bubbling`). Р”РµР»РµРіРёСЂРѕРІР°РЅРёРµ РѕС‚ РєРѕРЅС‚РµР№РЅРµСЂР° Рє РґРѕС‡РµСЂРЅРµРјСѓ `<input>` РЅРµ СЂР°Р±РѕС‚Р°Р»Рѕ: `LayersPanel` blur-С…РµРЅРґР»РµСЂ (РєРѕРјРјРёС‚ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёСЏ СЃР»РѕСЏ) РЅРёРєРѕРіРґР° РЅРµ РїРѕР»СѓС‡Р°Р» СЃРѕР±С‹С‚РёРµ, Рё rename СЃР»РµС‚Р°Р» РїСЂРё РєР°Р¶РґРѕРј `render()` (РЅР°РїСЂРёРјРµСЂ, РїСЂРё РІС‹Р±РѕСЂРµ РґСЂСѓРіРѕРіРѕ СЃР»РѕСЏ). РСЃРїСЂР°РІР»РµРЅРѕ: РґР»СЏ `blur`/`focus` РІ `setupContainerEventListeners` С‚РµРїРµСЂСЊ СѓСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ `{ capture: true }` (`src/event-system/EventHandlerManager.js`).

#### вњЁ РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё

- **Splash screen РїСЂРё РїРµСЂРІРѕРј РІРёР·РёС‚Рµ** вЂ” `LevelEditor.maybeShowSplashOnFirstVisit()` РІС‹Р·С‹РІР°РµС‚СЃСЏ РІ РєРѕРЅС†Рµ `finalizeInitialization()`. РџСЂРѕРІРµСЂСЏРµС‚ localStorage-С„Р»Р°Рі `levelEditor_hasSeenSplash`; РїРѕРєР°Р·С‹РІР°РµС‚ СЃРїР»РµС€ РѕРґРёРЅ СЂР°Р· Рё Р±РѕР»СЊС€Рµ РЅРµ Р±РµСЃРїРѕРєРѕРёС‚. Р СѓС‡РЅРѕР№ РІС‹Р·РѕРІ С‡РµСЂРµР· Р»РѕРіРѕ-РєРЅРѕРїРєСѓ РїРѕ-РїСЂРµР¶РЅРµРјСѓ СЂР°Р±РѕС‚Р°РµС‚ РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚ (`src/core/LevelEditor.js`).

#### рџ“Ѓ РР·РјРµРЅС‘РЅРЅС‹Рµ С„Р°Р№Р»С‹

`src/core/LevelEditor.js` В· `src/core/RenderOperations.js` В· `src/event-system/EventHandlerManager.js` В· `src/managers/ConfigManager.js` В· `src/utils/Logger.js` В· `docs/API_GUIDE.md` В· `docs/ARCHITECTURE.md` В· `docs/DEVELOPMENT_GUIDE.md` В· `docs/EVENT_HANDLER_SYSTEM.md` В· `docs/README.md` В· `docs/VERSIONING_GUIDE.md`

## [3.54.4] - 2025-01-27

### Enhanced - РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃРёСЃС‚РµРјР° СЃРµР»РµРєС‚Р° РѕР±СЉРµРєС‚РѕРІ РЅР° РєР°РЅРІРµ Рё СѓРЅРёС„РёРєР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№

#### вњЁ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **Ctrl+click РЅР° РѕР±СЉРµРєС‚Рµ** - РїРµСЂРµРєР»СЋС‡РµРЅРёРµ РІС‹Р±РѕСЂР° РѕР±СЉРµРєС‚Р° (toggle selection)
- **Shift+click РЅР° РѕР±СЉРµРєС‚Рµ** - РґРѕР±Р°РІР»РµРЅРёРµ РѕР±СЉРµРєС‚Р° Рє РІС‹Р±РѕСЂСѓ (add to selection, РЅРµ toggle)
- **Ctrl+drag** - СЂР°РјРєР° РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РІС‹Р±РѕСЂР° (toggle marquee selection)
- **Shift+drag** - СЂР°РјРєР° РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ Рє РІС‹Р±РѕСЂСѓ (add marquee selection)
- **Ctrl+Shift+drag** - РєРѕРјР±РёРЅРёСЂРѕРІР°РЅРЅС‹Р№ СЂРµР¶РёРј РґРѕР±Р°РІР»РµРЅРёСЏ Рє РІС‹Р±РѕСЂСѓ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РЈРЅРёС„РёРєР°С†РёСЏ СЃРёСЃС‚РµРјС‹ СЃРµР»РµРєС‚Р°** - РєР°РЅРІР° С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `SelectionUtils` РґР»СЏ СѓРЅРёС„РёРєР°С†РёРё Р»РѕРіРёРєРё СЃ РїР°РЅРµР»СЏРјРё
- **Р•РґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ** - РІСЃРµ inline event listeners РїРµСЂРµРЅРµСЃРµРЅС‹ РІ `EventHandlerManager` Рё `GlobalEventRegistry`
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕС‡РёС‰Р°СЋС‚СЃСЏ РїСЂРё СѓРЅРёС‡С‚РѕР¶РµРЅРёРё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - РІС‹РЅРµСЃРµРЅ РјРµС‚РѕРґ `_determineMarqueeMode()` РґР»СЏ СѓСЃС‚СЂР°РЅРµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Р»РѕРіРёРєРё РѕРїСЂРµРґРµР»РµРЅРёСЏ СЂРµР¶РёРјР° marquee
- **Pending marquee state** - РґРѕР±Р°РІР»РµРЅР° СЃРёСЃС‚РµРјР° РѕС‚СЃСЂРѕС‡РµРЅРЅРѕРіРѕ РёР·РјРµРЅРµРЅРёСЏ СЃРµР»РµРєС‚Р° РїСЂРё РєР»РёРєРµ СЃ РјРѕРґРёС„РёРєР°С‚РѕСЂР°РјРё (РёР·РјРµРЅРµРЅРёРµ РїСЂРѕРёСЃС…РѕРґРёС‚ С‚РѕР»СЊРєРѕ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РјС‹С€Рё РёР»Рё Р·Р°РІРµСЂС€РµРЅРёРё marquee)
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° click+drag** - РїСЂРё РєР»РёРєРµ СЃ РјРѕРґРёС„РёРєР°С‚РѕСЂР°РјРё РЅР° РѕР±СЉРµРєС‚Рµ СЃРµР»РµРєС‚ РЅРµ РёР·РјРµРЅСЏРµС‚СЃСЏ СЃСЂР°Р·Сѓ, Р° С‚РѕР»СЊРєРѕ РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё РґРµР№СЃС‚РІРёСЏ (РїСЂРѕСЃС‚РѕРј РєР»РёРєРµ РёР»Рё marquee)

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **РЎРµР»РµРєС‚ РїСЂРё РєР»РёРєРµ+РґСЂР°РіРµ** - РёСЃРїСЂР°РІР»РµРЅРѕ РїСЂРµР¶РґРµРІСЂРµРјРµРЅРЅРѕРµ РёР·РјРµРЅРµРЅРёРµ СЃРµР»РµРєС‚Р° РїСЂРё РєР»РёРєРµ СЃ РјРѕРґРёС„РёРєР°С‚РѕСЂР°РјРё РЅР° РѕР±СЉРµРєС‚Рµ, С‚РµРїРµСЂСЊ СЃРµР»РµРєС‚ РёР·РјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РјС‹С€Рё
- **Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°** - СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ Р»РѕРіРёРєРё РѕРїСЂРµРґРµР»РµРЅРёСЏ СЂРµР¶РёРјР° marquee РІ `handleObjectClick` Рё `handleEmptyClick`
- **РќРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ** - СѓРґР°Р»РµРЅС‹ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ (`marquee`, `selectedObjects` РІ РЅРµРєРѕС‚РѕСЂС‹С… РјРµСЃС‚Р°С…)
- **РР·Р±С‹С‚РѕС‡РЅС‹Рµ РїРѕР»СЏ** - СѓРґР°Р»РµРЅРѕ РёР·Р±С‹С‚РѕС‡РЅРѕРµ РїРѕР»Рµ `marqueeMode` РёР· `marqueeOptions` (РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РёР· stateManager)

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/event-system/MouseHandlers.js` - СѓР»СѓС‡С€РµРЅР° СЃРёСЃС‚РµРјР° СЃРµР»РµРєС‚Р° РѕР±СЉРµРєС‚РѕРІ, РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `_determineMarqueeMode()`, РёРЅС‚РµРіСЂР°С†РёСЏ СЃ `SelectionUtils`, РїРµСЂРµРЅРѕСЃ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РІ РµРґРёРЅСѓСЋ СЃРёСЃС‚РµРјСѓ
- `src/core/LevelEditor.js` - РїРµСЂРµРЅРѕСЃ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ `beforeunload`, `visibilitychange` Рё РєРЅРѕРїРєРё "Set Camera Start Position" РІ `GlobalEventRegistry` Рё `EventHandlerManager`
- `src/event-system/EventHandlers.js` - РїРµСЂРµРЅРѕСЃ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ `TabMoveContextMenu` РІ РµРґРёРЅСѓСЋ СЃРёСЃС‚РµРјСѓ, РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `_cleanupMenuHandlers()`
- `src/utils/SelectionUtils.js` - СЂР°СЃС€РёСЂРµРЅР° РїРѕРґРґРµСЂР¶РєР° canvas mode РґР»СЏ marquee selection

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **Р•РґРёРЅРѕРѕР±СЂР°Р·РёРµ РїРѕРІРµРґРµРЅРёСЏ** - СЃРµР»РµРєС‚ РЅР° РєР°РЅРІРµ СЂР°Р±РѕС‚Р°РµС‚ С‚Р°Рє Р¶Рµ, РєР°Рє РІ РїР°РЅРµР»СЏС… (СЃ СѓС‡РµС‚РѕРј СЃРїРµС†РёС„РёРєРё РєР°РЅРІС‹)
- **РЈРїСЂРѕС‰РµРЅРёРµ РїРѕРґРґРµСЂР¶РєРё** - РµРґРёРЅР°СЏ Р»РѕРіРёРєР° СЃРµР»РµРєС‚Р° РІ `SelectionUtils`, Р»РµРіС‡Рµ РїРѕРґРґРµСЂР¶РёРІР°С‚СЊ Рё СЂР°СЃС€РёСЂСЏС‚СЊ
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР° СЃРѕР±С‹С‚РёР№** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё СѓРїСЂР°РІР»СЏСЋС‚СЃСЏ С‡РµСЂРµР· РµРґРёРЅСѓСЋ СЃРёСЃС‚РµРјСѓ, Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°
- **Р›СѓС‡С€РёР№ UX** - РєРѕСЂСЂРµРєС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ РїСЂРё РєР»РёРєРµ+РґСЂР°РіРµ СЃ РјРѕРґРёС„РёРєР°С‚РѕСЂР°РјРё, СЃРµР»РµРєС‚ РЅРµ РёР·РјРµРЅСЏРµС‚СЃСЏ РїСЂРµР¶РґРµРІСЂРµРјРµРЅРЅРѕ
- **Р§РёСЃС‚С‹Р№ РєРѕРґ** - СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ, СѓРґР°Р»РµРЅС‹ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ

#### рџЋЇ **Р”РµС‚Р°Р»Рё СЂРµР°Р»РёР·Р°С†РёРё:**
- **Pending marquee state** - РїСЂРё РєР»РёРєРµ СЃ РјРѕРґРёС„РёРєР°С‚РѕСЂР°РјРё РЅР° РѕР±СЉРµРєС‚Рµ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ `marqueePendingClickInfo` Рё `marqueePendingStartPos`, СЃРµР»РµРєС‚ РёР·РјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ `handleMouseUp` (РґР»СЏ РїСЂРѕСЃС‚РѕРіРѕ РєР»РёРєР°) РёР»Рё `finishMarqueeSelection` (РґР»СЏ РґСЂР°РіР°)
- **РРЅС‚РµРіСЂР°С†РёСЏ СЃ SelectionUtils** - РєР°РЅРІР° РёСЃРїРѕР»СЊР·СѓРµС‚ `SelectionUtils.selectSingleItem()`, `SelectionUtils.handleCtrlClick()` Рё `SelectionUtils.finalizeMarqueeSelection()` РґР»СЏ СѓРЅРёС„РёРєР°С†РёРё Р»РѕРіРёРєРё
- **РњРµС‚РѕРґ `_determineMarqueeMode()`** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ СЂРµР¶РёРјР° marquee РЅР° РѕСЃРЅРѕРІРµ РјРѕРґРёС„РёРєР°С‚РѕСЂРѕРІ (Ctrl, Shift)
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР° pending state** - РІСЃРµ pending СЃРѕСЃС‚РѕСЏРЅРёСЏ РѕС‡РёС‰Р°СЋС‚СЃСЏ РІ `cancelAllActions()` Рё РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё marquee

## [3.54.3] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№ РґР»СЏ СЃР»РѕРµРІ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **РџРѕРґСЃРІРµС‚РєР° СЃР»РѕРµРІ СЃ Р·Р°РґРµСЂР¶РєРѕР№** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚СЃС‚Р°РІР°РЅРёРµ РїРѕРґСЃРІРµС‚РєРё РѕС‚ РєСѓСЂСЃРѕСЂР°, РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ С‡РµСЂРµР· `updateLayerStyles()` РІРјРµСЃС‚Рѕ РїРѕР»РЅРѕРіРѕ `render()`
- **Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ** - СѓСЃС‚СЂР°РЅРµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРё EventHandlerManager РїСЂРё РїРµСЂРµСЃРѕР·РґР°РЅРёРё DOM
- **РљР»РёРє РЅР° С†РІРµС‚РѕРІРѕР№ РёРЅРґРёРєР°С‚РѕСЂ** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РєСЂС‹С‚РёРµ РІРёРґР¶РµС‚Р° РёР·РјРµРЅРµРЅРёСЏ С†РІРµС‚Р° РїСЂРё РєР»РёРєРµ РЅР° `.layer-color`
- **РљР»РёРє РЅР° С‚РµРєСЃС‚Рµ Рё СЃС‡РµС‚С‡РёРєРµ РѕР±СЉРµРєС‚РѕРІ** - РёРЅС„РѕСЂРјР°С‚РёРІРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ (`.layer-name-display`, `.layer-objects-count`) С‚РµРїРµСЂСЊ РїСЂРѕР·СЂР°С‡РЅС‹ РґР»СЏ РєР»РёРєРѕРІ, РїРѕР·РІРѕР»СЏСЏ РІС‹Р±РёСЂР°С‚СЊ СЃР»РѕР№
- **Ctrl+click РґР»СЏ РІС‹Р±РѕСЂР° РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ** - РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅ С„СѓРЅРєС†РёРѕРЅР°Р» РІС‹Р±РѕСЂР° РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ СЃР»РѕСЏ РїСЂРё Ctrl+click

#### вњЁ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **Shift+Ctrl+click** - РґРѕР±Р°РІР»РµРЅ С„СѓРЅРєС†РёРѕРЅР°Р» РґРѕР±Р°РІР»РµРЅРёСЏ РІСЃРµС… РѕР±СЉРµРєС‚РѕРІ СЃР»РѕСЏ Рє С‚РµРєСѓС‰РµРјСѓ СЃРµР»РµРєС‚Сѓ (Shift+Ctrl+click РЅР° СЃР»РѕР№)

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **Р•РґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃР»РѕРµРІ РїРµСЂРµРЅРµСЃРµРЅС‹ РІ EventHandlerManager (click, dblclick, contextmenu, drag/drop, input, blur, keypress, keydown)
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕС‡РёС‰Р°СЋС‚СЃСЏ С‡РµСЂРµР· EventHandlerManager РїСЂРё РїРµСЂРµСЃРѕР·РґР°РЅРёРё DOM
- **РћРїС‚РёРјРёР·Р°С†РёСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРїРёСЃРєР° РЅР° `selectedObjects` РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РѕР»СЊРєРѕ СЃС‚РёР»РµР№ СЃР»РѕРµРІ РІРјРµСЃС‚Рѕ РїРѕР»РЅРѕРіРѕ `render()`
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РєРѕРґР°** - РІС‹РЅРµСЃРµРЅР° РѕР±С‰Р°СЏ Р»РѕРіРёРєР° РїРѕР»СѓС‡РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ СЃР»РѕСЏ РІ РјРµС‚РѕРґ `_getObjectsInLayer()`
- **РЈРґР°Р»РµРЅ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ РєРѕРґ** - СѓРґР°Р»РµРЅ РёРјРїРѕСЂС‚ `EventHandlerUtils`, СѓР±СЂР°РЅС‹ `console.log` РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/LayersPanel.js` - СЂРµС„Р°РєС‚РѕСЂРёРЅРі РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№, РїРµСЂРµРЅРѕСЃ РІ EventHandlerManager, РѕРїС‚РёРјРёР·Р°С†РёСЏ РѕР±РЅРѕРІР»РµРЅРёР№
- `src/event-system/EventHandlerManager.js` - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° `dblclick`, `keypress`, `dragstart`, `dragend`, `dragover`, `drop` РґР»СЏ РєРѕРЅС‚РµР№РЅРµСЂРѕРІ

### Enhanced - РРЅС‚РµСЂР°РєС‚РёРІРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ Рё СЂРµСЃР°Р№Р· РєР°РЅРІС‹ РїРѕ viewport СЌР»РµРјРµРЅС‚Сѓ

#### рџЋЇ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **Canvas viewport** - РґРѕР±Р°РІР»РµРЅ ID `canvas-viewport` РґР»СЏ СЌР»РµРјРµРЅС‚Р° viewport
- **РРЅС‚РµСЂР°РєС‚РёРІРЅРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ** - РєР°РЅРІР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕР±РЅРѕРІР»СЏРµС‚ РїРѕР·РёС†РёСЋ Рё СЂР°Р·РјРµСЂ РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂРѕРІ viewport
- **ResizeObserver** - РґРѕР±Р°РІР»РµРЅ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ РѕС‚СЃР»РµР¶РёРІР°С‚РµР»СЊ РёР·РјРµРЅРµРЅРёР№ СЂР°Р·РјРµСЂРѕРІ viewport СЌР»РµРјРµРЅС‚Р°
- **StateManager СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ** - РїРѕР·РёС†РёСЏ Рё СЂР°Р·РјРµСЂ РєР°РЅРІС‹ РїРµСЂРµРґР°СЋС‚СЃСЏ РІ stateManager (`canvas.position`, `canvas.size`)

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **CanvasRenderer.resizeCanvas()** - С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `canvas-viewport` РІРјРµСЃС‚Рѕ `parentElement` РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ СЂР°Р·РјРµСЂРѕРІ
- **РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ canvas-container** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ СЃ РїРѕР·РёС†РёРµР№ viewport СЌР»РµРјРµРЅС‚Р°
- **РћС‚Р»РѕР¶РµРЅРЅР°СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ** - ResizeObserver РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚СЃСЏ СЃ РїРѕРІС‚РѕСЂРЅС‹РјРё РїРѕРїС‹С‚РєР°РјРё (РґРѕ 10 СЂР°Р·) РµСЃР»Рё СЌР»РµРјРµРЅС‚ РµС‰Рµ РЅРµ РіРѕС‚РѕРІ
- **РћС‡РёСЃС‚РєР° СЂРµСЃСѓСЂСЃРѕРІ** - ResizeObserver РєРѕСЂСЂРµРєС‚РЅРѕ РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ РІ РјРµС‚РѕРґРµ `destroy()`
- **РЈРїСЂРѕС‰РµРЅРёРµ РґРѕСЃС‚СѓРїР° Рє stateManager** - СѓР±СЂР°РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ `window.editor`, stateManager РїРµСЂРµРґР°РµС‚СЃСЏ С‡РµСЂРµР· СЃРІРѕР№СЃС‚РІРѕ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
- **Helper-РјРµС‚РѕРґ updateCanvas()** - РґРѕР±Р°РІР»РµРЅ РґР»СЏ СѓСЃС‚СЂР°РЅРµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РєРѕРґР° РѕР±РЅРѕРІР»РµРЅРёСЏ РєР°РЅРІС‹ (Р·Р°РјРµРЅРµРЅРѕ 4 РјРµСЃС‚Р°)
- **РЈРїСЂРѕС‰РµРЅРёРµ ResizeObserver** - РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїР°СЂР°РјРµС‚СЂ С„СѓРЅРєС†РёРё РІРјРµСЃС‚Рѕ РІРЅРµС€РЅРµР№ РїРµСЂРµРјРµРЅРЅРѕР№ РґР»СЏ retryCount

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `index.html` - РґРѕР±Р°РІР»РµРЅ ID `canvas-viewport` РґР»СЏ СЌР»РµРјРµРЅС‚Р° viewport
- `src/ui/CanvasRenderer.js` - РѕР±РЅРѕРІР»РµРЅ РјРµС‚РѕРґ `resizeCanvas()` РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ `canvas-viewport`, РґРѕР±Р°РІР»РµРЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ РїРѕР·РёС†РёРё `canvas-container` Рё РїРµСЂРµРґР°С‡Р° РґР°РЅРЅС‹С… РІ stateManager, СѓР±СЂР°РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ `window.editor`
- `src/core/LevelEditor.js` - РґРѕР±Р°РІР»РµРЅ ResizeObserver РґР»СЏ `canvas-viewport` РІ `setupPanelSizeListeners()`, РґРѕР±Р°РІР»РµРЅР° РѕС‡РёСЃС‚РєР° РІ `destroy()`, РґРѕР±Р°РІР»РµРЅ helper-РјРµС‚РѕРґ `updateCanvas()`, СѓРїСЂРѕС‰РµРЅР° РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ ResizeObserver, РїРµСЂРµРґР°С‡Р° stateManager РІ CanvasRenderer РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РРЅС‚РµСЂР°РєС‚РёРІРЅС‹Р№ РѕС‚РєР»РёРє** - РєР°РЅРІР° РјРіРЅРѕРІРµРЅРЅРѕ СЂРµР°РіРёСЂСѓРµС‚ РЅР° РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂРѕРІ РїР°РЅРµР»РµР№, СЂР°Р·РґРµР»РёС‚РµР»РµР№ Рё РІРёРґРёРјРѕСЃС‚Рё СЌР»РµРјРµРЅС‚РѕРІ
- **РўРѕС‡РЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ** - РєР°РЅРІР° РІСЃРµРіРґР° СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ СЂР°Р·РјРµСЂСѓ Рё РїРѕР·РёС†РёРё viewport СЌР»РµРјРµРЅС‚Р°
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ** - РІСЃРµ РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂРѕРІ РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р±РµР· СЂСѓС‡РЅС‹С… РІС‹Р·РѕРІРѕРІ
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ** - РїРѕР·РёС†РёСЏ Рё СЂР°Р·РјРµСЂ РєР°РЅРІС‹ РґРѕСЃС‚СѓРїРЅС‹ С‡РµСЂРµР· stateManager РґР»СЏ РґСЂСѓРіРёС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ ResizeObserver Рё РёРЅРґРёРєР°С‚РѕСЂР° РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹С… РёР·РјРµРЅРµРЅРёР№ Р°СЃСЃРµС‚РѕРІ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **ResizeObserver loop** - РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° "ResizeObserver loop completed with undelivered notifications" РїСЂРё Ctrl+Scroll РІ РѕРєРЅРµ Р°СЃСЃРµС‚РѕРІ
- **РРЅРґРёРєР°С‚РѕСЂ РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹С… РёР·РјРµРЅРµРЅРёР№** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ СЃРёРЅРµР№ С‚РѕС‡РєРё РЅР° Р°СЃСЃРµС‚Р°С… РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёСЏ РїР°СЂР°РјРµС‚СЂРѕРІ РІ Asset Properties
- **РџСЂРёРјРµРЅРµРЅРёРµ РёР·РјРµРЅРµРЅРёР№** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РёР·РјРµРЅРµРЅРёР№: С‚РµРїРµСЂСЊ СЃСЂР°РІРЅРёРІР°РµС‚СЃСЏ СЃ initialState, Р° РЅРµ СЃ С‚РµРєСѓС‰РёРј Р°СЃСЃРµС‚РѕРј
- **РљРЅРѕРїРєР° Cancel** - РёСЃРїСЂР°РІР»РµРЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Р·РЅР°С‡РµРЅРёР№ С„РѕСЂРјС‹ Рє СЃРѕСЃС‚РѕСЏРЅРёСЋ РЅР° РјРѕРјРµРЅС‚ РѕС‚РєСЂС‹С‚РёСЏ РѕРєРЅР°

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **AssetPanel ResizeObserver** - РґРѕР±Р°РІР»РµРЅ `requestAnimationFrame` РґР»СЏ РѕС‚Р»РѕР¶РµРЅРЅРѕРіРѕ РІС‹РїРѕР»РЅРµРЅРёСЏ РёР·РјРµРЅРµРЅРёР№ DOM, РїСЂРµРґРѕС‚РІСЂР°С‰Р°СЋС‰РёР№ С†РёРєР»
- **AssetPanel ResizeObserver** - РґРѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂР° (С‚РѕР»СЊРєРѕ РїСЂРё РёР·РјРµРЅРµРЅРёРё >1px) РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ Р»РёС€РЅРёС… РѕР±РЅРѕРІР»РµРЅРёР№
- **ActorPropertiesWindow** - РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РїР°СЂР°РјРµС‚СЂРѕРІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР° (СѓР±СЂР°РЅРѕ `document.body` РёР· РїРµСЂРІРѕРіРѕ РїР°СЂР°РјРµС‚СЂР°)
- **ActorPropertiesWindow** - РґРѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РёР·РјРµРЅРµРЅРёР№ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ `initialState` РІРјРµСЃС‚Рѕ С‚РµРєСѓС‰РµРіРѕ Р°СЃСЃРµС‚Р°
- **ActorPropertiesWindow** - РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `restoreInitialState()` РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ Р·РЅР°С‡РµРЅРёР№ РїСЂРё Cancel
- **BaseDialog** - РёСЃРїСЂР°РІР»РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° РєРЅРѕРїРєРё `apply` (РЅРµ Р·Р°РєСЂС‹РІР°РµС‚ РѕРєРЅРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, РїРѕР·РІРѕР»СЏРµС‚ `apply()` Р·Р°РєСЂС‹С‚СЊ)
- **AssetManager** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РЅР°Р»РёС‡РёСЏ `_originalState` РїРµСЂРµРґ РѕР±РЅРѕРІР»РµРЅРёРµРј
- **Asset.hasChangesFromOriginal()** - РґРѕР±Р°РІР»РµРЅР° РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ Р·РЅР°С‡РµРЅРёР№ (С†РІРµС‚ Р±РµР· СѓС‡РµС‚Р° СЂРµРіРёСЃС‚СЂР°, trim СЃС‚СЂРѕРє, С‡РёСЃР»Р° РєР°Рє С‡РёСЃР»Р°)
- **РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ** - СѓР±СЂР°РЅ РґСѓР±Р»РёСЂСѓСЋС‰РёР№ РєРѕРґ РїСЂРѕРІРµСЂРєРё РёР·РјРµРЅРµРЅРёР№ РІ `apply()`, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `checkForChanges()`
- **РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ** - РІС‹РЅРµСЃРµРЅ `_getNumericValue()` РєР°Рє РїСЂРёРІР°С‚РЅС‹Р№ РјРµС‚РѕРґ

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/AssetPanel.js` - РёСЃРїСЂР°РІР»РµРЅ ResizeObserver, СѓР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РёРЅРґРёРєР°С‚РѕСЂР° РЅРµСЃРѕС…СЂР°РЅРµРЅРЅС‹С… РёР·РјРµРЅРµРЅРёР№
- `src/ui/ActorPropertiesWindow.js` - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РїСЂРёРјРµРЅРµРЅРёСЏ РёР·РјРµРЅРµРЅРёР№, РґРѕР±Р°РІР»РµРЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Р·РЅР°С‡РµРЅРёР№ РїСЂРё Cancel
- `src/ui/BaseDialog.js` - РёСЃРїСЂР°РІР»РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° РєРЅРѕРїРєРё apply
- `src/core/LevelEditor.js` - РёСЃРїСЂР°РІР»РµРЅ РІС‹Р·РѕРІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂР° ActorPropertiesWindow
- `src/managers/AssetManager.js` - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° `_originalState`, РёСЃРїСЂР°РІР»РµРЅ РІС‹Р·РѕРІ `getAsset()` РІРјРµСЃС‚Рѕ `getAssetById()`
- `src/models/Asset.js` - СѓР»СѓС‡С€РµРЅР° РЅРѕСЂРјР°Р»РёР·Р°С†РёСЏ Р·РЅР°С‡РµРЅРёР№ РІ `hasChangesFromOriginal()`

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РљРѕСЂСЂРµРєС‚РЅР°СЏ СЂР°Р±РѕС‚Р° РёРЅРґРёРєР°С‚РѕСЂР°** - СЃРёРЅСЏСЏ С‚РѕС‡РєР° РїРѕСЏРІР»СЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё СЂРµР°Р»СЊРЅС‹С… РёР·РјРµРЅРµРЅРёСЏС…
- **РџСЂР°РІРёР»СЊРЅР°СЏ РѕС‚РјРµРЅР°** - Cancel РІРѕР·РІСЂР°С‰Р°РµС‚ Р·РЅР°С‡РµРЅРёСЏ Рє РёСЃС…РѕРґРЅРѕРјСѓ СЃРѕСЃС‚РѕСЏРЅРёСЋ
- **РќРµС‚ Р»РѕР¶РЅС‹С… СЃСЂР°Р±Р°С‚С‹РІР°РЅРёР№** - РёРЅРґРёРєР°С‚РѕСЂ РЅРµ РїРѕСЏРІР»СЏРµС‚СЃСЏ РїСЂРё РІРѕР·РІСЂР°С‚Рµ Рє РёСЃС…РѕРґРЅС‹Рј Р·РЅР°С‡РµРЅРёСЏРј
- **РЎС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ** - СѓСЃС‚СЂР°РЅРµРЅР° РѕС€РёР±РєР° ResizeObserver loop

### Performance - РћРїС‚РёРјРёР·Р°С†РёСЏ Р»РµР№Р°СѓС‚Р° РїСЂРё СЂРµСЃР°Р№Р·Рµ РѕРєРЅР°

#### рџљЂ **РћРїС‚РёРјРёР·Р°С†РёРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё:**
- **FoldersPanel** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅ СЂРµРЅРґРµСЂРёРЅРі РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂРѕРІ РѕРєРЅР°
- **РЈСЃС‚СЂР°РЅРµРЅРѕ РїРµСЂРµСЃРѕР·РґР°РЅРёРµ СЌР»РµРјРµРЅС‚РѕРІ** - РїСЂРё СЂРµСЃР°Р№Р·Рµ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ С‚РµРєСЃС‚ РѕР±СЂРµР·РєРё РёРјРµРЅ Р±РµР· РїРѕР»РЅРѕРіРѕ РїРµСЂРµСЃРѕР·РґР°РЅРёСЏ DOM
- **РќРѕРІС‹Р№ РјРµС‚РѕРґ updateLayout()** - Р»РµРіРєРѕРІРµСЃРЅРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ С‚РѕР»СЊРєРѕ РЅРµРѕР±С…РѕРґРёРјС‹С… СЌР»РµРјРµРЅС‚РѕРІ
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - Р·РЅР°С‡РёС‚РµР»СЊРЅРѕРµ СЃРЅРёР¶РµРЅРёРµ РЅР°РіСЂСѓР·РєРё РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂРѕРІ РѕРєРЅР°

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **FoldersPanel.updateLayout()** - РЅРѕРІС‹Р№ РјРµС‚РѕРґ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ С‚РѕР»СЊРєРѕ РѕР±СЂРµР·РєРё РёРјРµРЅ РїР°РїРѕРє
- **ResizeObserver РѕРїС‚РёРјРёР·Р°С†РёСЏ** - РёСЃРїРѕР»СЊР·СѓРµС‚ `updateLayout()` РІРјРµСЃС‚Рѕ РїРѕР»РЅРѕРіРѕ `renderFolderContent()` РїСЂРё СЂРµСЃР°Р№Р·Рµ
- **AssetPanel.updateGridViewSizes()** - СѓР¶Рµ Р±С‹Р» РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅ (РѕР±РЅРѕРІР»СЏРµС‚ С‚РѕР»СЊРєРѕ СЃС‚РёР»Рё grid Р±РµР· РїРµСЂРµСЃРѕР·РґР°РЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ)
- **Р§РёСЃС‚С‹Р№ РєРѕРґ** - РІСЃРµ РІС‹Р·РѕРІС‹ `renderFolderContent()` РѕСЃС‚Р°РІР»РµРЅС‹ С‚РѕР»СЊРєРѕ РґР»СЏ СЃР»СѓС‡Р°РµРІ РёР·РјРµРЅРµРЅРёСЏ СЃС‚СЂСѓРєС‚СѓСЂС‹/СЃРѕСЃС‚РѕСЏРЅРёСЏ

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/FoldersPanel.js` - РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `updateLayout()`, РѕР±РЅРѕРІР»РµРЅС‹ РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЂРµСЃР°Р№Р·Р°
- `docs/CHANGELOG.md` - РґРѕР±Р°РІР»РµРЅР° РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ РѕР± РѕРїС‚РёРјРёР·Р°С†РёРё
- `docs/API_GUIDE.md` - РѕР±РЅРѕРІР»РµРЅР° РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ РјРµС‚РѕРґРѕРІ FoldersPanel
- `docs/ARCHITECTURE.md` - РґРѕР±Р°РІР»РµРЅР° РёРЅС„РѕСЂРјР°С†РёСЏ РѕР± РѕРїС‚РёРјРёР·Р°С†РёРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **Р‘С‹СЃС‚СЂС‹Р№ РѕС‚РєР»РёРє** - РїР»Р°РІРЅРѕРµ РёР·РјРµРЅРµРЅРёРµ СЂР°Р·РјРµСЂРѕРІ Р±РµР· Р»Р°РіРѕРІ
- **РњРµРЅСЊС€Рµ РЅР°РіСЂСѓР·РєРё** - РѕС‚СЃСѓС‚СЃС‚РІРёРµ РїРµСЂРµСЃРѕР·РґР°РЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ РїСЂРё СЂРµСЃР°Р№Р·Рµ
- **Р›СѓС‡С€РёР№ UX** - РѕС‚СЃСѓС‚СЃС‚РІРёРµ РјРµСЂС†Р°РЅРёСЏ Рё Р·Р°РґРµСЂР¶РµРє РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂРѕРІ РѕРєРЅР°
- **РњР°СЃС€С‚Р°Р±РёСЂСѓРµРјРѕСЃС‚СЊ** - РїР°С‚С‚РµСЂРЅ РјРѕР¶РµС‚ Р±С‹С‚СЊ РїСЂРёРјРµРЅРµРЅ Рє РґСЂСѓРіРёРј РїР°РЅРµР»СЏРј РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё

## [3.54.1] - 2025-01-28

### Enhanced - РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ СЂРµСЃР°Р№Р·РµСЂ РґР»СЏ РІСЃРїР»С‹РІР°СЋС‰РёС… РѕРєРѕРЅ

#### рџЋЇ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **DialogResizer** - СЃРѕР·РґР°РЅР° СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ СЂРµСЃР°Р№Р·Р° РґРёР°Р»РѕРіРѕРІ
- **Р РµСЃР°Р№Р·РµСЂ РґР»СЏ РІСЃРµС… РґРёР°Р»РѕРіРѕРІ** - РґРѕР±Р°РІР»РµРЅР° РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РёР·РјРµРЅРµРЅРёСЏ С€РёСЂРёРЅС‹ РІСЃРµС… РІСЃРїР»С‹РІР°СЋС‰РёС… РѕРєРѕРЅ
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ С€РёСЂРёРЅС‹** - С€РёСЂРёРЅР° РґРёР°Р»РѕРіРѕРІ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ StateManager Рё РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РѕС‚РєСЂС‹С‚РёРё
- **РЈРјРѕР»С‡Р°РЅРёСЏ СЂР°Р·РјРµСЂРѕРІ** - РґРёР°Р»РѕРіРё РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ Р·Р°РЅРёРјР°СЋС‚ 50% С€РёСЂРёРЅС‹ РѕРєРЅР° Р±СЂР°СѓР·РµСЂР°

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **BaseDialog** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° СЂРµСЃР°Р№Р·РµСЂР° С‡РµСЂРµР· `DialogResizer.setupResizer()`
- **SettingsPanel** - РґРѕР±Р°РІР»РµРЅ СЂРµСЃР°Р№Р·РµСЂ РґР»СЏ РѕРєРЅР° РЅР°СЃС‚СЂРѕРµРє
- **РЈРїСЂРѕС‰РµРЅРёРµ РєРѕРґР°** - СѓРґР°Р»РµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµ РјРµС‚РѕРґС‹ `createDialogResizer()` Рё `setupSettingsPanelResizer()`
- **Р•РґРёРЅР°СЏ Р»РѕРіРёРєР°** - РІСЃРµ РґРёР°Р»РѕРіРё РёСЃРїРѕР»СЊР·СѓСЋС‚ `DialogResizer.setupResizer()` РѕРґРёРЅР°РєРѕРІС‹Рј РѕР±СЂР°Р·РѕРј
- **РћРїС‚РёРјРёР·Р°С†РёСЏ CSS** - СѓР±СЂР°РЅР° С„РёРєСЃРёСЂРѕРІР°РЅРЅР°СЏ С€РёСЂРёРЅР°, РєРѕРЅС‚СЂРѕР»РёСЂСѓРµС‚СЃСЏ С‡РµСЂРµР· JavaScript

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/utils/DialogResizer.js` - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ СЂРµСЃР°Р№Р·РѕРј РґРёР°Р»РѕРіРѕРІ
- `src/ui/BaseDialog.js` - СѓРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° СЃРѕР·РґР°РЅРёСЏ СЂРµСЃР°Р№Р·РµСЂР°, РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ `DialogResizer`
- `src/ui/SettingsPanel.js` - РґРѕР±Р°РІР»РµРЅ СЂРµСЃР°Р№Р·РµСЂ РґР»СЏ РѕРєРЅР° РЅР°СЃС‚СЂРѕРµРє
- `styles/dialog-positioning.css` - РѕР±РЅРѕРІР»РµРЅС‹ РєРѕРјРјРµРЅС‚Р°СЂРёРё, СѓР±СЂР°РЅР° С„РёРєСЃРёСЂРѕРІР°РЅРЅР°СЏ С€РёСЂРёРЅР°

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РЈРґРѕР±СЃС‚РІРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ** - РїРѕР»СЊР·РѕРІР°С‚РµР»Рё РјРѕРіСѓС‚ РЅР°СЃС‚СЂР°РёРІР°С‚СЊ С€РёСЂРёРЅСѓ РґРёР°Р»РѕРіРѕРІ РїРѕРґ СЃРІРѕРё РЅСѓР¶РґС‹
- **Р•РґРёРЅРѕРѕР±СЂР°Р·РёРµ** - РІСЃРµ РґРёР°Р»РѕРіРё РІРµРґСѓС‚ СЃРµР±СЏ РѕРґРёРЅР°РєРѕРІРѕ
- **РЈРїСЂРѕС‰РµРЅРёРµ РєРѕРґР°** - СѓРґР°Р»РµРЅРѕ ~40 СЃС‚СЂРѕРє РґСѓР±Р»РёСЂСѓСЋС‰РµРіРѕ РєРѕРґР°
- **РњР°СЃС€С‚Р°Р±РёСЂСѓРµРјРѕСЃС‚СЊ** - Р»РµРіРєРѕ РґРѕР±Р°РІРёС‚СЊ СЂРµСЃР°Р№Р·РµСЂ Р»СЋР±РѕРјСѓ РЅРѕРІРѕРјСѓ РґРёР°Р»РѕРіСѓ

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ Р·Р°РєСЂС‹С‚РёСЏ РґРёР°Р»РѕРіРѕРІ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **Р—Р°РєСЂС‹С‚РёРµ РїРѕ РєР»РёРєСѓ РІРЅРµ РѕРєРЅР°** - РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР° СЂР°Р±РѕС‚Р° РѕР±СЂР°Р±РѕС‚С‡РёРєР° Р·Р°РєСЂС‹С‚РёСЏ РґРёР°Р»РѕРіРѕРІ РїСЂРё РєР»РёРєРµ РЅР° overlay
- **Р—Р°РєСЂС‹С‚РёРµ СЃРїР»РµС€-РѕРєРЅР° РїРѕ РєР»РёРєСѓ РЅР° РЅС‘Рј** - РґРѕР±Р°РІР»РµРЅР° РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ Р·Р°РєСЂС‹РІР°С‚СЊ СЃРїР»РµС€-РѕРєРЅРѕ РєР»РёРєРѕРј РЅР° СЃР°РјРѕ РѕРєРЅРѕ (РЅРµ С‚РѕР»СЊРєРѕ РЅР° overlay)
- **Р•РґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓСЋС‚ `EventHandlerManager`, СѓСЃС‚СЂР°РЅРµРЅС‹ inline `addEventListener`

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **EventHandlerManager** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° `overlayClick` РІ `createDelegatedHandlers()`
- **BaseDialog** - СѓРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° РїСЂРѕРІРµСЂРєРё РєР»РёРєР° РЅР° overlay
- **SplashScreenDialog** - РїРµСЂРµРѕРїСЂРµРґРµР»РµРЅ `setupEventHandlers()` РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєР° РєР»РёРєР° РЅР° container
- **РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ** - СѓРґР°Р»РµРЅ РѕС‚РґРµР»СЊРЅС‹Р№ РјРµС‚РѕРґ `setupOverlayClickHandler()`, Р»РѕРіРёРєР° РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РІ `setupEventHandlers()`

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/event-system/EventHandlerManager.js` - РґРѕР±Р°РІР»РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° `overlayClick` РІ РґРµР»РµРіРёСЂРѕРІР°РЅРЅС‹С… РѕР±СЂР°Р±РѕС‚С‡РёРєР°С…
- `src/ui/BaseDialog.js` - СѓРїСЂРѕС‰РµРЅР° РїСЂРѕРІРµСЂРєР° РєР»РёРєР° РЅР° overlay
- `src/ui/SplashScreenDialog.js` - РїРµСЂРµРѕРїСЂРµРґРµР»РµРЅ `setupEventHandlers()` РґР»СЏ Р·Р°РєСЂС‹С‚РёСЏ РїРѕ РєР»РёРєСѓ РЅР° container

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ** - РІСЃРµ РґРёР°Р»РѕРіРё РёСЃРїРѕР»СЊР·СѓСЋС‚ РµРґРёРЅСѓСЋ СЃРёСЃС‚РµРјСѓ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **РќР°РґРµР¶РЅРѕСЃС‚СЊ** - РїСЂР°РІРёР»СЊРЅР°СЏ РѕС‡РёСЃС‚РєР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РїСЂРё СѓРЅРёС‡С‚РѕР¶РµРЅРёРё РґРёР°Р»РѕРіРѕРІ
- **РЈРґРѕР±СЃС‚РІРѕ** - СЃРїР»РµС€-РѕРєРЅРѕ Р·Р°РєСЂС‹РІР°РµС‚СЃСЏ РєР»РёРєРѕРј РєР°Рє РІРЅРµ, С‚Р°Рє Рё РІРЅСѓС‚СЂРё РѕРєРЅР°
- **РџРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ** - РµРґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє СЂРµРіРёСЃС‚СЂР°С†РёРё РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ С‡РµСЂРµР· `EventHandlerManager`

## [3.54.0] - 2025-01-28

### Enhanced - РЈР»СѓС‡С€РµРЅРёСЏ СЃРёСЃС‚РµРјС‹ РєСѓСЂСЃРѕСЂРѕРІ Рё РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРіРѕ СЃРєСЂРѕР»Р»Р° РґР»СЏ С‚Р°Р±РѕРІ Р°СЃСЃРµС‚РѕРІ

#### рџЋЇ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **Р“РѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Р№ СЃРєСЂРѕР»Р» С‚Р°Р±РѕРІ** - РґРѕР±Р°РІР»РµРЅ СЃРєСЂРѕР»Р» РєРѕР»РµСЃРѕРј РјС‹С€Рё Рё СЃСЂРµРґРЅРµР№ РєРЅРѕРїРєРѕР№ РґР»СЏ РЅР°РІРёРіР°С†РёРё РїРѕ С‚Р°Р±Р°Рј
- **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ СѓС‚РёР»РёС‚Р° СЃРєСЂРѕР»Р»Р°** - СЃРѕР·РґР°РЅ `HorizontalScrollUtils` РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РІ toolbar Рё С‚Р°Р±Р°С…
- **РЈР»СѓС‡С€РµРЅРЅС‹Рµ РєСѓСЂСЃРѕСЂС‹** - РїСЂР°РІРёР»СЊРЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РєСѓСЂСЃРѕСЂРѕРІ РґР»СЏ РІСЃРµС… СЃРѕСЃС‚РѕСЏРЅРёР№ (РїР°Р»РµС†, Р»Р°РїРєР°, СЃС…РІР°С‚С‹РІР°РЅРёРµ)
- **РЎРєСЂС‹С‚РёРµ СЃРєСЂРѕР»Р»Р±Р°СЂР°** - РІРёР·СѓР°Р»СЊРЅРѕ СЃРєСЂС‹С‚ СЃРєСЂРѕР»Р»Р±Р°СЂ РїСЂРё СЃРѕС…СЂР°РЅРµРЅРёРё С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚Рё
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕР·РёС†РёРё СЃРєСЂРѕР»Р»Р°** - РїРѕР·РёС†РёСЏ СЃРєСЂРѕР»Р»Р° С‚Р°Р±РѕРІ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **AssetTabsManager** - РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ `setupHorizontalScrolling()` Рё `loadScrollPosition()`
- **CSS РѕРїС‚РёРјРёР·Р°С†РёСЏ** - СѓРїСЂРѕС‰РµРЅС‹ СЃС‚РёР»Рё РєСѓСЂСЃРѕСЂРѕРІ, СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РїСЂР°РІРёР»
- **Event handling** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№ drag-and-drop Рё СЃРєСЂРѕР»Р»Р°
- **Memory management** - РґРѕР±Р°РІР»РµРЅР° РїСЂР°РІРёР»СЊРЅР°СЏ РѕС‡РёСЃС‚РєР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РљСѓСЂСЃРѕСЂ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё** - СѓР±СЂР°РЅР° СЃС‚СЂРµР»РєР°, РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ Р·Р°Р¶Р°С‚Р°СЏ Р»Р°РїРєР°
- **РљСѓСЂСЃРѕСЂ РїСЂРё СЃРєСЂРѕР»Р»Рµ** - РєРѕСЂСЂРµРєС‚РЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ Р·Р°Р¶Р°С‚РѕР№ Р»Р°РїРєРё РїСЂРё СЃРєСЂРѕР»Р»Рµ СЃСЂРµРґРЅРµР№ РєРЅРѕРїРєРѕР№
- **РљСѓСЂСЃРѕСЂ РїСЂРё РЅР°РІРµРґРµРЅРёРё** - СЃС‚Р°Р±РёР»СЊРЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РїР°Р»СЊС†Р° РїСЂРё РЅР°РІРµРґРµРЅРёРё РЅР° С‚Р°Р±С‹
- **РљРѕРЅС„Р»РёРєС‚ drag/scroll** - РёСЃРїСЂР°РІР»РµРЅ РєРѕРЅС„Р»РёРєС‚ РјРµР¶РґСѓ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµРј С‚Р°Р±РѕРІ Рё СЃРєСЂРѕР»Р»РѕРј

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/AssetTabsManager.js` - РґРѕР±Р°РІР»РµРЅ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Р№ СЃРєСЂРѕР»Р» Рё СѓР»СѓС‡С€РµРЅС‹ РєСѓСЂСЃРѕСЂС‹
- `src/utils/HorizontalScrollUtils.js` - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРіРѕ СЃРєСЂРѕР»Р»Р°
- `src/ui/Toolbar.js` - СЂРµС„Р°РєС‚РѕСЂРёРЅРі РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ HorizontalScrollUtils
- `styles/panels.css` - СѓРїСЂРѕС‰РµРЅС‹ СЃС‚РёР»Рё РєСѓСЂСЃРѕСЂРѕРІ, РґРѕР±Р°РІР»РµРЅС‹ СЃС‚РёР»Рё СЃРєСЂРѕР»Р»Р°
- `src/managers/UserPreferencesManager.js` - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° `assetTabsScrollLeft`
- `config/defaults/ui.json` - РґРѕР±Р°РІР»РµРЅРѕ Р·РЅР°С‡РµРЅРёРµ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ РґР»СЏ СЃРєСЂРѕР»Р»Р° С‚Р°Р±РѕРІ

#### рџ’Ў **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ** - РѕРґРёРЅР°РєРѕРІРѕРµ РїРѕРІРµРґРµРЅРёРµ СЃРєСЂРѕР»Р»Р° РІ toolbar Рё С‚Р°Р±Р°С…
- **UX СѓР»СѓС‡С€РµРЅРёСЏ** - РёРЅС‚СѓРёС‚РёРІРЅС‹Рµ РєСѓСЂСЃРѕСЂС‹ Рё РїР»Р°РІРЅР°СЏ РЅР°РІРёРіР°С†РёСЏ
- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№
- **РџРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ** - РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ РєРѕРґ РґР»СЏ СЃРєСЂРѕР»Р»Р°

---

## [3.53.0] - 2025-01-28

### Refactored - Р РµС„Р°РєС‚РѕСЂРёРЅРі СЃРёСЃС‚РµРјС‹ С‚Р°Р±РѕРІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ Рё РёСЃРїСЂР°РІР»РµРЅРёРµ multi-select

#### рџ”„ **РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **AssetTabsManager** - РІС‹РґРµР»РµРЅ РѕС‚РґРµР»СЊРЅС‹Р№ РєР»Р°СЃСЃ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ С‚Р°Р±Р°РјРё РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ** - РІСЃСЏ Р»РѕРіРёРєР° С‚Р°Р±РѕРІ РІС‹РЅРµСЃРµРЅР° РёР· AssetPanel РІ РѕС‚РґРµР»СЊРЅС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - СЃРѕР·РґР°РЅС‹ helper-РјРµС‚РѕРґС‹ РґР»СЏ РїСЂРѕРІРµСЂРєРё РєРѕРѕСЂРґРёРЅР°С‚ Рё С‚РёРїРѕРІ drag-СЃРѕР±С‹С‚РёР№
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - AssetPanel С‚РµРїРµСЂСЊ С„РѕРєСѓСЃРёСЂСѓРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РЅР° РѕС‚РѕР±СЂР°Р¶РµРЅРёРё Р°СЃСЃРµС‚РѕРІ
- **РЈРїСЂРѕС‰РµРЅРёРµ Р»РѕРіРёРєРё** - СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°, РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РјРµС‚РѕРґС‹ СѓРґР°Р»РµРЅС‹

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РѕС€РёР±РєРё:**
- **Р‘РµСЃРєРѕРЅРµС‡РЅР°СЏ СЂРµРєСѓСЂСЃРёСЏ** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ С†РёРєР»РёС‡РµСЃРєРёРјРё РѕР±РЅРѕРІР»РµРЅРёСЏРјРё СЃРѕСЃС‚РѕСЏРЅРёСЏ Рё СЂРµРЅРґРµСЂРёРЅРіР°
- **РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ С‚Р°Р±РѕРІ** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ С‚Р°Р±РѕРІ СЃР»РµРІР° РѕС‚ СЌР»РµРјРµРЅС‚РѕРІ РїРѕРёСЃРєР°
- **Drop overlay РїСЂРё СЃС‚Р°СЂС‚Рµ** - РёСЃРїСЂР°РІР»РµРЅРѕ СЃР»СѓС‡Р°Р№РЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ overlay РїСЂРё Р·Р°РїСѓСЃРєРµ СЂРµРґР°РєС‚РѕСЂР°
- **Р Р°Р·РјРµСЂ drop overlay** - РёСЃРїСЂР°РІР»РµРЅ СЂР°Р·РјРµСЂ РїРѕРґСЃРІРµС‚РєРё РґР»СЏ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ С‚РѕР»СЊРєРѕ РѕР±Р»Р°СЃС‚Рё РїСЂРµРІСЊСЋ Р°СЃСЃРµС‚РѕРІ
- **Multi-select С„РѕР»РґРµСЂРѕРІ** - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° Shift+РєР»РёРєР° РґР»СЏ РІС‹Р±РѕСЂР° РјРЅРѕР¶РµСЃС‚РІР° С„РѕР»РґРµСЂРѕРІ
- **Multi-select С‚Р°Р±РѕРІ** - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° Shift+РєР»РёРєР° РЅР° С‚Р°Р±Р°С… (РґРѕР±Р°РІР»РµРЅРёРµ/СѓРґР°Р»РµРЅРёРµ РёР· selection)
- **РћРіСЂР°РЅРёС‡РµРЅРёРµ РІС‹Р±РѕСЂР°** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РЅРµРІРѕР·РјРѕР¶РЅРѕСЃС‚СЊСЋ РІС‹Р±СЂР°С‚СЊ Р±РѕР»СЊС€Рµ РґРІСѓС… С„РѕР»РґРµСЂРѕРІ
- **РђРІС‚Рѕ-СЃРѕР·РґР°РЅРёРµ С‚Р°Р±РѕРІ** - СѓР±СЂР°РЅРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃРѕР·РґР°РЅРёРµ С‚Р°Р±РѕРІ РїСЂРё РІС‹Р±РѕСЂРµ С„РѕР»РґРµСЂРѕРІ (С‚РѕР»СЊРєРѕ РїСЂРё РґСЂРѕРїРµ)
- **Range selection** - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° range selection РїСЂРё Shift+РєР»РёРєРµ (РЅРµ РѕС‡РёС‰Р°РµС‚ С‚РµРєСѓС‰РёР№ РІС‹Р±РѕСЂ)

#### вњЁ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **Р’РёР·СѓР°Р»СЊРЅР°СЏ РёРЅРґРёРєР°С†РёСЏ Р·Р°РїСЂРµС‚Р° РґСЂРѕРїР°** - РєСЂР°СЃРЅР°СЏ РїРѕРґСЃРІРµС‚РєР° СЃ С‚РµРєСЃС‚РѕРј "Can not create assets in this location" РїСЂРё РїРѕРїС‹С‚РєРµ РґСЂРѕРїР° РІ РєРѕСЂРЅРµРІСѓСЋ РїР°РїРєСѓ
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° drag-and-drop** - С‚РѕС‡РЅРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ РєРѕРѕСЂРґРёРЅР°С‚ С‡РµСЂРµР· helper-РјРµС‚РѕРґС‹
- **CSS РєР»Р°СЃСЃС‹ РґР»СЏ drop overlay** - РІС‹РЅРµСЃРµРЅС‹ СЃС‚РёР»Рё РІ `styles/panels.css` РґР»СЏ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ
- **Multi-select С‚Р°Р±РѕРІ Рё С„РѕР»РґРµСЂРѕРІ** - РїРѕР»РЅРѕС†РµРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РєР° РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРіРѕ РІС‹Р±РѕСЂР° С‡РµСЂРµР· Shift+РєР»РёРє

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **AssetTabsManager.js** - РЅРѕРІС‹Р№ РєР»Р°СЃСЃ СЃ РјРµС‚РѕРґР°РјРё `render()`, `syncTabToFolder()`, `addFolderTab()`, `removeFolderTab()`, `handleTabClick()`
- **Helper-РјРµС‚РѕРґС‹** - `isExternalFilesDrag()`, `isOverTabsContainer()`, `isOverPreviewsContainer()` РґР»СЏ СѓСЃС‚СЂР°РЅРµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ
- **CSS РєР»Р°СЃСЃС‹** - `.drop-overlay`, `.drop-overlay-visible`, `.drop-overlay-allowed`, `.drop-overlay-disallowed` РІ `styles/panels.css`
- **РЈРїСЂРѕС‰РµРЅРёРµ РєРѕРґР°** - СѓРґР°Р»РµРЅС‹ РёР·Р±С‹С‚РѕС‡РЅС‹Рµ debug-Р»РѕРіРё, РѕСЃС‚Р°РІР»РµРЅС‹ С‚РѕР»СЊРєРѕ РєСЂРёС‚РёС‡РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РёРЅР»Р°Р№РЅ-СЃС‚РёР»РµР№** - РІСЃРµ СЃС‚РёР»Рё overlay РїРµСЂРµРЅРµСЃРµРЅС‹ РІ CSS С„Р°Р№Р»С‹
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ** - СѓРґР°Р»РµРЅ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ РјРµС‚РѕРґ `_getSelectedFolderPath()`, СѓРїСЂРѕС‰РµРЅС‹ РїРѕРґРїРёСЃРєРё РЅР° СЃРѕР±С‹С‚РёСЏ
- **Р›РѕРіРёРєР° С‚Р°Р±РѕРІ** - С‚Р°Р±С‹ СЃРѕР·РґР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РґСЂРѕРїРµ С„РѕР»РґРµСЂРѕРІ, РЅРµ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРё РІС‹Р±РѕСЂРµ
- **РЈРїСЂРѕС‰РµРЅРёРµ РїРѕРґРїРёСЃРѕРє** - РїРѕРґРїРёСЃРєР° РЅР° `selectedFolders` РІ AssetTabsManager С‚РѕР»СЊРєРѕ РґР»СЏ РІРёР·СѓР°Р»СЊРЅРѕРіРѕ РѕР±РЅРѕРІР»РµРЅРёСЏ

#### рџ“‹ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- **`src/ui/AssetPanel.js`** - СЂРµС„Р°РєС‚РѕСЂРёРЅРі, РґРµР»РµРіРёСЂРѕРІР°РЅРёРµ Р»РѕРіРёРєРё С‚Р°Р±РѕРІ РІ AssetTabsManager, СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° СѓРїСЂР°РІР»РµРЅРёСЏ С‚Р°Р±Р°РјРё
- **`src/ui/AssetTabsManager.js`** - РЅРѕРІС‹Р№ РєР»Р°СЃСЃ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ С‚Р°Р±Р°РјРё (РІРєР»СЋС‡Р°СЏ AssetTabContextMenu), РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° multi-select
- **`src/ui/FoldersPanel.js`** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° РґРёРЅР°РјРёС‡РµСЃРєРё РґРѕР±Р°РІР»РµРЅРЅС‹С… Р°СЃСЃРµС‚РѕРІ, РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° Shift+РєР»РёРєР° РґР»СЏ multi-select
- **`styles/panels.css`** - РґРѕР±Р°РІР»РµРЅС‹ CSS РєР»Р°СЃСЃС‹ РґР»СЏ drop overlay
- **`src/managers/AssetManager.js`** - СѓРґР°Р»РµРЅРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃРѕР·РґР°РЅРёРµ С‚Р°Р±РѕРІ РїСЂРё СЃРєР°РЅРёСЂРѕРІР°РЅРёРё
- **`src/core/LevelEditor.js`** - РѕР±РЅРѕРІР»РµРЅР° РІРµСЂСЃРёСЏ РґРѕ 3.53.0

#### рџљЂ **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ** - РєРѕРґ С‚Р°Р±РѕРІ РёР·РѕР»РёСЂРѕРІР°РЅ Рё РјРѕР¶РµС‚ Р±С‹С‚СЊ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅ
- **РџРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ** - РёР·РјРµРЅРµРЅРёСЏ РІ Р»РѕРіРёРєРµ С‚Р°Р±РѕРІ РЅРµ РІР»РёСЏСЋС‚ РЅР° РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ Р°СЃСЃРµС‚РѕРІ
- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - СѓСЃС‚СЂР°РЅРµРЅР° Р±РµСЃРєРѕРЅРµС‡РЅР°СЏ СЂРµРєСѓСЂСЃРёСЏ, РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅС‹ Р»РѕРіРё
- **Р§РёСЃС‚РѕС‚Р° РєРѕРґР°** - СѓР±СЂР°РЅС‹ РґСѓР±Р»РёРєР°С‚С‹, РёР·Р±С‹С‚РѕС‡РЅС‹Рµ Р»РѕРіРё Рё РёРЅР»Р°Р№РЅ-СЃС‚РёР»Рё
- **Р“РёР±РєРѕСЃС‚СЊ multi-select** - РїРѕР»РЅРѕС†РµРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РєР° РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРіРѕ РІС‹Р±РѕСЂР° С„РѕР»РґРµСЂРѕРІ Рё С‚Р°Р±РѕРІ
- **РљРѕРЅС‚СЂРѕР»СЊ СЃРѕР·РґР°РЅРёСЏ С‚Р°Р±РѕРІ** - С‚Р°Р±С‹ СЃРѕР·РґР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»РµРј С‡РµСЂРµР· РґСЂРѕРї, РЅРµ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё

## [3.52.8] - 2025-01-28

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ С‚Р°Р±РѕРІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РѕС€РёР±РєРё:**
- **РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РЅРµ РѕС‚РѕР±СЂР°Р¶Р°Р»РѕСЃСЊ** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµРј РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РїСЂРё РїСЂР°РІРѕРј РєР»РёРєРµ РЅР° С‚Р°Р±С‹ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ
- **РќРµРїСЂР°РІРёР»СЊРЅР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°Р»РёСЃСЊ РЅР° РЅРµРїСЂР°РІРёР»СЊРЅС‹Р№ РєРѕРЅС‚РµР№РЅРµСЂ
- **CSS СЃС‚РёР»Рё РЅРµ РїСЂРёРјРµРЅСЏР»РёСЃСЊ** - РѕС‚СЃСѓС‚СЃС‚РІРѕРІР°Р» РєР»Р°СЃСЃ `.show` РґР»СЏ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РјРµРЅСЋ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РџСЂР°РІРёР»СЊРЅР°СЏ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё С‚РµРїРµСЂСЊ СЂРµРіРёСЃС‚СЂРёСЂСѓСЋС‚СЃСЏ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ (РїРѕ РѕР±СЂР°Р·С†Сѓ LayersPanel)
- **Р”РµР»РµРіРёСЂРѕРІР°РЅРёРµ СЃРѕР±С‹С‚РёР№** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЂРµРіРёСЃС‚СЂРёСЂСѓСЋС‚СЃСЏ РЅР° `tabsContainer` РІРјРµСЃС‚Рѕ `container`
- **CSS РєР»Р°СЃСЃС‹** - РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РїСЂР°РІРёР»СЊРЅС‹Р№ РєР»Р°СЃСЃ `.base-context-menu-item` РґР»СЏ СЌР»РµРјРµРЅС‚РѕРІ РјРµРЅСЋ
- **РЈР±СЂР°РЅР° РѕС‚Р»Р°РґРѕС‡РЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ** - РѕС‡РёС‰РµРЅ РєРѕРґ РѕС‚ РІСЂРµРјРµРЅРЅС‹С… console.log

## [3.52.7] - 2025-01-28

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ СЂР°РјРєРё СЃРµР»РµРєС‚Р° РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РєР»РёРєР° Р·Р° РїСЂРµРґРµР»Р°РјРё РєР°РЅРІС‹

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РѕС€РёР±РєРё:**
- **Р Р°РјРєР° СЃРµР»РµРєС‚Р° РЅРµ Р·Р°РІРµСЂС€Р°Р»Р°СЃСЊ** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР°, РєРѕРіРґР° СЂР°РјРєР° СЃРµР»РµРєС‚Р° (marquee selection) РЅРµ Р·Р°РІРµСЂС€Р°Р»Р°СЃСЊ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РєРЅРѕРїРєРё РјС‹С€Рё Р·Р° РїСЂРµРґРµР»Р°РјРё РєР°РЅРІС‹
- **Mouseup СЃРѕР±С‹С‚РёСЏ РЅРµ РґРѕС…РѕРґРёР»Рё** - mouseup СЃРѕР±С‹С‚РёСЏ РЅРµ Р·Р°С…РІР°С‚С‹РІР°Р»РёСЃСЊ РіР»РѕР±Р°Р»СЊРЅС‹РјРё РѕР±СЂР°Р±РѕС‚С‡РёРєР°РјРё РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РєР»РёРєР° РІРЅРµ РѕР±Р»Р°СЃС‚Рё РєР°РЅРІС‹

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **EventHandlerManager** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РѕРїС†РёР№ `addEventListener` (capture, passive) РІ РјРµС‚РѕРґ `registerElement()`
- **GlobalEventRegistry** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РїСЂРёРјРµРЅРµРЅРёРµ `capture: true` РґР»СЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ mouseup СЃРѕР±С‹С‚РёР№
- **Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё** - mouseup СЃРѕР±С‹С‚РёСЏ С‚РµРїРµСЂСЊ Р·Р°С…РІР°С‚С‹РІР°СЋС‚СЃСЏ РІ С„Р°Р·Рµ Р·Р°С…РІР°С‚Р° РґР»СЏ РЅР°РґРµР¶РЅРѕР№ СЂР°Р±РѕС‚С‹ РІРЅРµ РєР°РЅРІС‹

## [3.52.6] - 2025-01-28

### Added - РљРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РґР»СЏ С‚Р°Р±РѕРІ Рё РёСЃРїСЂР°РІР»РµРЅРёСЏ РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР°

#### вњЁ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **РљРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РґР»СЏ С‚Р°Р±РѕРІ РїР°РЅРµР»РµР№** - РїСЂР°РІС‹Р№ РєР»РёРє РЅР° С‚Р°Р±Р°С… РїРѕРєР°Р·С‹РІР°РµС‚ РјРµРЅСЋ СЃ РѕРїС†РёРµР№ РїРµСЂРµРјРµС‰РµРЅРёСЏ РјРµР¶РґСѓ РїР°РЅРµР»СЏРјРё
- **РљРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РґР»СЏ assets С‚Р°Р±РѕРІ** - РїСЂР°РІС‹Р№ РєР»РёРє РЅР° С‚Р°Р±Р°С… assets РїР°РЅРµР»Рё РїРѕРєР°Р·С‹РІР°РµС‚ РјРµРЅСЋ СЃ РѕРїС†РёРµР№ "Close"
- **РџРѕРґРґРµСЂР¶РєР° РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР° РЅР° СЂР°Р·РґРµР»РёС‚РµР»СЏС…** - РґРѕР±Р°РІР»РµРЅ РїР°СЂР°РјРµС‚СЂ `onDoubleClick` РІ ResizerManager
- **РЈРјРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РјРµРЅСЋ** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕР·РёС†РёРѕРЅРёСЂСѓСЋС‚СЃСЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ viewport

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **EventHandlers** - РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ `updateTabContextMenus()`, `handleTabContextMenu()`, `showAssetTabContextMenu()`, `closeAssetTab()`
- **ResizerManager** - СЂР°СЃС€РёСЂРµРЅ РјРµС‚РѕРґ `registerResizer()` СЃ РїРѕРґРґРµСЂР¶РєРѕР№ РѕР±СЂР°Р±РѕС‚С‡РёРєР° РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР°
- **MutationObserver** - СЂР°СЃС€РёСЂРµРЅРѕ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ РёР·РјРµРЅРµРЅРёР№ РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ С‚Р°Р±РѕРІ (`.tab-right`, `.tab-left`, `.tab`)
- **РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - СЃРёСЃС‚РµРјР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ РїРѕРІС‚РѕСЂРЅСѓСЋ СЂРµРіРёСЃС‚СЂР°С†РёСЋ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РѕС€РёР±РєРё:**
- **Р”РІРѕР№РЅРѕР№ РєР»РёРє РЅР° СЂР°Р·РґРµР»РёС‚РµР»СЏС…** - СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ РѕР±СЂР°Р±РѕС‚С‡РёРєР°РјРё РјС‹С€Рё Рё РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР°
- **РџРѕСЂСЏРґРѕРє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё** - РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РІС‹Р·РѕРІРѕРІ РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ СЂР°Р±РѕС‚С‹ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- **Р—Р°С‰РёС‚Р° РѕС‚ Р·Р°РєСЂС‹С‚РёСЏ РїРѕСЃР»РµРґРЅРµРіРѕ С‚Р°Р±Р°** - СЃРёСЃС‚РµРјР° РїСЂРµРґРѕС‚РІСЂР°С‰Р°РµС‚ Р·Р°РєСЂС‹С‚РёРµ РїРѕСЃР»РµРґРЅРµРіРѕ Р°РєС‚РёРІРЅРѕРіРѕ С‚Р°Р±Р° assets РїР°РЅРµР»Рё

## [3.52.5] - 2025-01-28

### Added - РџР°СЂР°РјРµС‚СЂ С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№

#### вњЁ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **resizerColor** - РґРѕР±Р°РІР»РµРЅ РїР°СЂР°РјРµС‚СЂ С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№ РїР°РЅРµР»РµР№ РІ default settings
- **РРЅС‚РµРіСЂР°С†РёСЏ СЃ СЃРёСЃС‚РµРјРѕР№ РЅР°СЃС‚СЂРѕРµРє** - С†РІРµС‚ СЂР°Р·РґРµР»РёС‚РµР»РµР№ СѓРїСЂР°РІР»СЏРµС‚СЃСЏ С‡РµСЂРµР· UI РЅР°СЃС‚СЂРѕР№РєРё
- **CSS РїРµСЂРµРјРµРЅРЅР°СЏ** - `--ui-resizer-color` РґР»СЏ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРіРѕ СѓРїСЂР°РІР»РµРЅРёСЏ С†РІРµС‚РѕРј
- **РћР±РЅРѕРІР»РµРЅР° РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ** - РґРѕР±Р°РІР»РµРЅС‹ РїСЂРёРјРµСЂС‹ Рё РѕРїРёСЃР°РЅРёРµ РЅРѕРІРѕРіРѕ РїР°СЂР°РјРµС‚СЂР°

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **ConfigManager** - Р·Р°РіСЂСѓР·РєР° resizerColor РёР· JSON РєРѕРЅС„РёРіСѓСЂР°С†РёРё
- **StateManager** - С…СЂР°РЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№
- **LevelEditor** - РїСЂРёРјРµРЅРµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє С‡РµСЂРµР· `_applyColorConfiguration()`
- **SettingsPanel** - РёРЅС‚РµСЂС„РµР№СЃ РґР»СЏ РёР·РјРµРЅРµРЅРёСЏ С†РІРµС‚Р° С‡РµСЂРµР· color picker

## [3.52.4] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РѕС€РёР±РєРё:**
- **"No context menu instance found for BaseContextMenu"** - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РѕР±РЅР°СЂСѓР¶РµРЅРёСЏ СЌРєР·РµРјРїР»СЏСЂРѕРІ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- **РќРµРїСЂР°РІРёР»СЊРЅС‹Р№ РєР»Р°СЃСЃ РґР»СЏ РїРѕРёСЃРєР°** - РёР·РјРµРЅРµРЅ СЃ `context-menu` РЅР° `base-context-menu` РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ РѕР±РЅР°СЂСѓР¶РµРЅРёСЏ
- **РћР±СЂР°Р±РѕС‚РєР° null СЌРєР·РµРјРїР»СЏСЂРѕРІ** - РґРѕР±Р°РІР»РµРЅР° graceful РѕР±СЂР°Р±РѕС‚РєР° СЃР»СѓС‡Р°РµРІ Р±РµР· СЌРєР·РµРјРїР»СЏСЂРѕРІ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ Р»РѕРіРёРєР°** - СЃРѕР·РґР°РЅ РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹Р№ РјРµС‚РѕРґ `checkAndRegisterContextMenu`
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°** - РµРґРёРЅС‹Р№ РјРµС‚РѕРґ РґР»СЏ РїСЂРѕРІРµСЂРєРё Рё СЂРµРіРёСЃС‚СЂР°С†РёРё РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅС‹ Р»РѕРіРё** - СѓР±СЂР°РЅС‹ РёР·Р±С‹С‚РѕС‡РЅС‹Рµ debug СЃРѕРѕР±С‰РµРЅРёСЏ РґР»СЏ Р»СѓС‡С€РµР№ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё
- **РЈР»СѓС‡С€РµРЅР° С‡РёС‚Р°РµРјРѕСЃС‚СЊ** - РєРѕРґ СЃС‚Р°Р» Р±РѕР»РµРµ Р»Р°РєРѕРЅРёС‡РЅС‹Рј Рё РїРѕРЅСЏС‚РЅС‹Рј

#### рџ“‹ **РџРѕРґРґРµСЂР¶РёРІР°РµРјС‹Рµ С‚РёРїС‹ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ:**
- **`base-context-menu`** - РѕСЃРЅРѕРІРЅРѕР№ РєР»Р°СЃСЃ РґР»СЏ Р±Р°Р·РѕРІС‹С… РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- **`canvas-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РєР°РЅРІР°СЃР°
- **`asset-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ Р°СЃСЃРµС‚РѕРІ
- **`asset-panel-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ
- **`console-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ РєРѕРЅСЃРѕР»Рё
- **`layers-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ СЃР»РѕРµРІ
- **`outliner-context-menu`** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ Р°СѓС‚Р»Р°Р№РЅРµСЂР°

#### рџљЂ **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РЎС‚Р°Р±РёР»СЊРЅР°СЏ СЂР°Р±РѕС‚Р°** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ СЂР°Р±РѕС‚Р°СЋС‚ Р±РµР· РѕС€РёР±РѕРє
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕР±РЅР°СЂСѓР¶РµРЅРёРµ** - СЃРёСЃС‚РµРјР° РєРѕСЂСЂРµРєС‚РЅРѕ РЅР°С…РѕРґРёС‚ Рё СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚ РѕР±СЂР°Р±РѕС‚С‡РёРєРё
- **Graceful handling** - СЃРёСЃС‚РµРјР° СЂР°Р±РѕС‚Р°РµС‚ РґР°Р¶Рµ РїСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё СЌРєР·РµРјРїР»СЏСЂРѕРІ
- **Р›СѓС‡С€Р°СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - СѓР±СЂР°РЅС‹ РёР·Р±С‹С‚РѕС‡РЅС‹Рµ РѕРїРµСЂР°С†РёРё Р»РѕРіРёСЂРѕРІР°РЅРёСЏ

## [3.52.2] - 2025-01-27

### Refactored - РЈРЅРёС„РёРєР°С†РёСЏ Р»РѕРіРёРєРё resize РґР»СЏ mouse

#### рџ”„ **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РєРѕРґР°:**
- **Р•РґРёРЅР°СЏ СЃРёСЃС‚РµРјР° СЂР°СЃС‡РµС‚Р°** - mouse РёСЃРїРѕР»СЊР·СѓРµС‚ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹ СЂР°СЃС‡РµС‚Р° СЂР°Р·РјРµСЂРѕРІ РїР°РЅРµР»РµР№
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹** - `calculatePanelSize()`, `calculateHorizontalPanelSize()`, `calculateVerticalPanelSize()`
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ** - РёРґРµРЅС‚РёС‡РЅР°СЏ Р»РѕРіРёРєР° РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ РІРІРѕРґР°
- **Р›РµРіРєРѕСЃС‚СЊ РїРѕРґРґРµСЂР¶РєРё** - РёР·РјРµРЅРµРЅРёСЏ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ РІРјРµСЃС‚Рѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ

#### рџЋЇ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **PanelPositionManager** - mouse handlers РёСЃРїРѕР»СЊР·СѓСЋС‚ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹
- **AssetPanel** - folders resizer РёСЃРїРѕР»СЊР·СѓРµС‚ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅСѓСЋ Р»РѕРіРёРєСѓ
- **API РґР»СЏ РІРЅРµС€РЅРµРіРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ** - `getUnifiedResizeMethods()` РґР»СЏ РґСЂСѓРіРёС… С‡Р°СЃС‚РµР№ РєРѕРґР°

#### рџ“‹ **РџРѕРґРґРµСЂР¶РёРІР°РµРјС‹Рµ СЂР°Р·РґРµР»РёС‚РµР»Рё:**
- **Р“РѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Рµ:** left panel, right panel, folders resizer
- **Р’РµСЂС‚РёРєР°Р»СЊРЅС‹Рµ:** console resizer, assets resizer
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ** - Р»РѕРіРёРєР° РІС‹Р±РёСЂР°РµС‚СЃСЏ РЅР° РѕСЃРЅРѕРІРµ С‚РёРїР° СЂР°Р·РґРµР»РёС‚РµР»СЏ

#### рџљЂ **РџСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- **РњРµРЅСЊС€Рµ Р±Р°РіРѕРІ** - РЅРµС‚ СЂР°СЃС…РѕР¶РґРµРЅРёР№ РјРµР¶РґСѓ СЂР°Р·РЅС‹РјРё С‚РёРїР°РјРё РІРІРѕРґР°
- **РџСЂРѕС‰Рµ РїРѕРґРґРµСЂР¶РєР°** - РµРґРёРЅР°СЏ С‚РѕС‡РєР° РёР·РјРµРЅРµРЅРёР№
- **РџРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ** - РјРµС‚РѕРґС‹ РґРѕСЃС‚СѓРїРЅС‹ РґР»СЏ РґСЂСѓРіРёС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ** - РѕРґРёРЅР°РєРѕРІРѕРµ РїРѕРІРµРґРµРЅРёРµ РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ РІРІРѕРґР°

## [3.52.1] - 2025-01-27

### Added - РќР°СЃС‚СЂРѕР№РєР° С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№ РїР°РЅРµР»РµР№

#### рџЋЁ **РќРѕРІР°СЏ РЅР°СЃС‚СЂРѕР№РєР° С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№:**
- **CSS РїРµСЂРµРјРµРЅРЅР°СЏ** `--ui-resizer-color` - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ С†РІРµС‚РѕРј РІСЃРµС… СЂР°Р·РґРµР»РёС‚РµР»РµР№
- **РќР°СЃС‚СЂРѕР№РєР° РІ UI** - РїРѕР»Рµ "Panel Resizers" РІ Settings в†’ Colors
- **РџСЂРёРјРµРЅРµРЅРёРµ РїСЂРё Apply** - С†РІРµС‚ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РЅР°Р¶Р°С‚РёРё "Apply Changes"
- **РџРѕРґРґРµСЂР¶РєР° РІСЃРµС… СЂР°Р·РґРµР»РёС‚РµР»РµР№** - РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹С… Рё РІРµСЂС‚РёРєР°Р»СЊРЅС‹С… СЂР°Р·РґРµР»РёС‚РµР»РµР№ РїР°РЅРµР»РµР№

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РњР°РїРїРёРЅРі РІ SettingsSyncManager** - `ui.resizerColor` РїСЂР°РІРёР»СЊРЅРѕ РјР°РїРїРёС‚СЃСЏ РЅР° StateManager
- **РћР±СЂР°Р±РѕС‚РєР° РІ applySpecialUISettings()** - С†РІРµС‚ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ С‡РµСЂРµР· СЃС‚Р°РЅРґР°СЂС‚РЅС‹Р№ РјРµС…Р°РЅРёР·Рј РЅР°СЃС‚СЂРѕРµРє
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…** - РёР·РјРµРЅРµРЅРёСЏ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ localStorage
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ СЃС‚РёР»Рё** - РІСЃРµ СЂР°Р·РґРµР»РёС‚РµР»Рё РёСЃРїРѕР»СЊР·СѓСЋС‚ РѕРґРЅСѓ CSS РїРµСЂРµРјРµРЅРЅСѓСЋ

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`styles/main.css`** - РґРѕР±Р°РІР»РµРЅР° CSS РїРµСЂРµРјРµРЅРЅР°СЏ `--ui-resizer-color`
- **`src/ui/SettingsPanel.js`** - РґРѕР±Р°РІР»РµРЅРѕ РїРѕР»Рµ РЅР°СЃС‚СЂРѕР№РєРё С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№
- **`src/utils/SettingsSyncManager.js`** - РґРѕР±Р°РІР»РµРЅ РјР°РїРїРёРЅРі Рё РѕР±СЂР°Р±РѕС‚РєР° С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№
- **РЎС‚РёР»Рё СЂР°Р·РґРµР»РёС‚РµР»РµР№** - РѕР±РЅРѕРІР»РµРЅС‹ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ CSS РїРµСЂРµРјРµРЅРЅРѕР№

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ СЃРёСЃС‚РµРјС‹ РЅР°СЃС‚СЂРѕРµРє

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **РћС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёР№ РјР°РїРїРёРЅРі** - `ui.resizerColor` С‚РµРїРµСЂСЊ РїСЂР°РІРёР»СЊРЅРѕ РјР°РїРїРёС‚СЃСЏ РІ SettingsSyncManager
- **РџСЂРёРјРµРЅРµРЅРёРµ С†РІРµС‚Р°** - С†РІРµС‚ СЂР°Р·РґРµР»РёС‚РµР»РµР№ С‚РµРїРµСЂСЊ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ РїСЂРё РЅР°Р¶Р°С‚РёРё "Apply Changes"
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє** - РёР·РјРµРЅРµРЅРёСЏ С†РІРµС‚Р° СЂР°Р·РґРµР»РёС‚РµР»РµР№ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…
- **CSS РїРµСЂРµРјРµРЅРЅС‹Рµ** - РІСЃРµ СЂР°Р·РґРµР»РёС‚РµР»Рё РёСЃРїРѕР»СЊР·СѓСЋС‚ РµРґРёРЅСѓСЋ РїРµСЂРµРјРµРЅРЅСѓСЋ РґР»СЏ С†РІРµС‚Р°

## [3.52.0] - 2025-01-27

### Added - РќРѕРІР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° СЃ СЂР°Р·РґРµР»РµРЅРёРµРј СЃР»РѕС‘РІ

#### рџЋЁ **РџРµСЂРµСЂР°Р±РѕС‚Р°РЅРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° РёРЅС‚РµСЂС„РµР№СЃР°:**
- **Р Р°Р·РґРµР»РµРЅРёРµ СЃР»РѕС‘РІ** - РєР°РЅРІР° РЅР° РЅРёР¶РЅРµРј СЃР»РѕРµ, РёРЅС‚РµСЂС„РµР№СЃ РЅР° РІРµСЂС…РЅРµРј
- **РљРѕРЅС‚РµР№РЅРµСЂ РєР°РЅРІС‹** - РѕС‚РґРµР»СЊРЅС‹Р№ Р°Р±СЃРѕР»СЋС‚РЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРЅС‚РµР№РЅРµСЂ РґР»СЏ РєР°РЅРІС‹
- **РџСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ СЃРѕР±С‹С‚РёР№** - СЃРѕР±С‹С‚РёСЏ РїСЂРѕС…РѕРґСЏС‚ С‡РµСЂРµР· flex РєРѕРЅС‚РµР№РЅРµСЂС‹ Рє РєР°РЅРІРµ
- **РћРїС‚РёРјРёР·Р°С†РёСЏ CSS** - СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ СЃС‚РёР»РµР№ РїР°РЅРµР»РµР№ Рё СЂР°Р·РґРµР»РёС‚РµР»РµР№

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **Canvas container** - `#canvas-container` СЃ `z-index: 0` РЅР° РЅРёР¶РЅРµРј СЃР»РѕРµ
- **Flex РєРѕРЅС‚РµР№РЅРµСЂС‹** - `pointer-events: none` РґР»СЏ РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚Рё СЃРѕР±С‹С‚РёР№
- **РџР°РЅРµР»Рё** - `pointer-events: auto` РґР»СЏ РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕСЃС‚Рё
- **РћР±С‰РёРµ РєР»Р°СЃСЃС‹** - `.tab-panel` Рё `.panel-resizer` РґР»СЏ СѓСЃС‚СЂР°РЅРµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ
- **AutoEventHandlerManager** - РїРѕРґРґРµСЂР¶РєР° canvas СЌР»РµРјРµРЅС‚РѕРІ

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`index.html`** - РЅРѕРІР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° СЃ canvas РєРѕРЅС‚РµР№РЅРµСЂРѕРј
- **`styles/main.css`** - РїСЂРѕР·СЂР°С‡РЅРѕСЃС‚СЊ СЃРѕР±С‹С‚РёР№, РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РєР°РЅРІС‹
- **`styles/panels.css`** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Рµ СЃС‚РёР»Рё РїР°РЅРµР»РµР№
- **`src/ui/PanelPositionManager.js`** - РѕР±РЅРѕРІР»РµРЅРЅС‹Рµ РєР»Р°СЃСЃС‹
- **`src/event-system/AutoEventHandlerManager.js`** - РїРѕРґРґРµСЂР¶РєР° РєР°РЅРІС‹

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РёРЅС‚РµСЂС„РµР№СЃР°

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРЅС‹Рµ РїСЂРѕР±Р»РµРјС‹:**
- **Header РїРµСЂРµРєСЂС‹С‚РёРµ** - РєР°РЅРІР° Р±РѕР»СЊС€Рµ РЅРµ РїРµСЂРµРєСЂС‹РІР°РµС‚ РІРµСЂС…РЅРµРµ РјРµРЅСЋ
- **РЎРѕР±С‹С‚РёСЏ РјС‹С€Рё** - РєР°РЅРІР° РєРѕСЂСЂРµРєС‚РЅРѕ СЂРµР°РіРёСЂСѓРµС‚ РЅР° РєР»РёРєРё РІ С†РµРЅС‚СЂРµ СЌРєСЂР°РЅР°
- **РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ** - canvas РєРѕРЅС‚РµР№РЅРµСЂ РЅР°С‡РёРЅР°РµС‚СЃСЏ РЅРёР¶Рµ header (top: 40px)
- **Z-index СЃР»РѕРё** - РїСЂР°РІРёР»СЊРЅР°СЏ РёРµСЂР°СЂС…РёСЏ СЃР»РѕС‘РІ (header: 20, РїР°РЅРµР»Рё: 10, РєР°РЅРІР°: 0)

## [3.51.12] - 2025-01-27

### Added - РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё

#### рџЋЇ **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ СЃРёСЃС‚РµРјР° СЃРІРѕСЂР°С‡РёРІР°РЅРёСЏ/СЂР°Р·РІРѕСЂР°С‡РёРІР°РЅРёСЏ:**
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ** - РІСЃРµ РѕРїРµСЂР°С†РёРё СЃ РїР°РЅРµР»СЏРјРё РІ PanelPositionManager
- **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РјРµС‚РѕРґ** `togglePanelCollapse()` - РµРґРёРЅР°СЏ С‚РѕС‡РєР° РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ РїР°РЅРµР»РµР№
- **РџСЂРёРІСЏР·РєР° Рє РјРµС‚РѕРґСѓ СЃРІРѕСЂР°С‡РёРІР°РЅРёСЏ** - РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РїСЂРёРІСЏР·Р°РЅРѕ Рє Р»РѕРіРёРєРµ СЃРІРѕСЂР°С‡РёРІР°РЅРёСЏ, Р° РЅРµ Рє СЃРѕР±С‹С‚РёСЏРј
- **РџРѕРґРґРµСЂР¶РєР° РІСЃРµС… СЂР°Р·РґРµР»РёС‚РµР»РµР№** - Р»РµРІР°СЏ/РїСЂР°РІР°СЏ РїР°РЅРµР»Рё, РїР°РЅРµР»СЊ Р°СЃСЃРµС‚РѕРІ, РїР°РЅРµР»СЊ РїР°РїРѕРє

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РјРµС‚РѕРґ** `updateResizerPosition()` - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ СЂР°Р·РґРµР»РёС‚РµР»РµР№
- **РЎРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹** - `toggleTabPanelCollapse()`, `toggleAssetsPanelCollapse()`, `toggleFoldersPanelCollapse()`
- **РЈРїСЂРѕС‰РµРЅРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - СѓРґР°Р»РµРЅС‹ РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Рµ СЃР»РѕРё, РїСЂСЏРјС‹Рµ РІС‹Р·РѕРІС‹ РјРµС‚РѕРґРѕРІ
#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`src/ui/PanelPositionManager.js`** - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ СЃРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ Рё РѕС‡РёСЃС‚РєР° РєРѕРґР°

#### рџђ› **РСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РћС€РёР±РєР° `Cannot read properties of undefined`** - РёСЃРїСЂР°РІР»РµРЅР° СЃСЃС‹Р»РєР° РЅР° panelPositionManager
- **РЈРґР°Р»РµРЅ Р»РёС€РЅРёР№ РєРѕРґ** - console.log Рё РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РјРµС‚РѕРґС‹
- **РћС‡РёСЃС‚РєР° РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° РјРµР¶РґСѓ РєРѕРјРїРѕРЅРµРЅС‚Р°РјРё

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`src/ui/PanelPositionManager.js`** - СѓРґР°Р»РµРЅ console.log

## [3.51.11] - 2025-01-27

### Added - РџРѕРґРґРµСЂР¶РєР° РїР°РЅРµР»РµР№ РёРЅС‚РµСЂС„РµР№СЃР° РІ СЃРёСЃС‚РµРјРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№

#### рџЋЇ **РќРѕРІР°СЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ РїР°РЅРµР»РµР№:**
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕР±РЅР°СЂСѓР¶РµРЅРёРµ РїР°РЅРµР»РµР№** - СЃРёСЃС‚РµРјР° С‚РµРїРµСЂСЊ СЂР°СЃРїРѕР·РЅР°РµС‚ РїР°РЅРµР»Рё РёРЅС‚РµСЂС„РµР№СЃР°
- **Р РµРіРёСЃС‚СЂР°С†РёСЏ СЌР»РµРјРµРЅС‚РѕРІ РїР°РЅРµР»РµР№** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РґР»СЏ РґРѕС‡РµСЂРЅРёС… СЌР»РµРјРµРЅС‚РѕРІ
- **РџРѕРґРґРµСЂР¶РєР° С‚РёРїРѕРІ РїР°РЅРµР»РµР№** - РґРѕР±Р°РІР»РµРЅС‹ С‚РёРїС‹ `asset-panel` Рё `layers-panel`
- **РћР±СЂР°Р±РѕС‚С‡РёРєРё СЌР»РµРјРµРЅС‚РѕРІ РёРЅС‚РµСЂС„РµР№СЃР°** - СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РґР»СЏ РєРЅРѕРїРѕРє, РїРѕР»РµР№ РІРІРѕРґР° Рё СЌР»РµРјРµРЅС‚РѕРІ СЃРїРёСЃРєР°

#### рџ”§ **Р­Р»РµРјРµРЅС‚С‹ РїР°РЅРµР»РµР№ СЃ РїРѕРґРґРµСЂР¶РєРѕР№:**
- **Р­Р»РµРјРµРЅС‚С‹ СЃР»РѕРµРІ** - `.layer-item`, `.layer-visibility-btn`, `.layer-lock-btn`, `.layer-color`
- **РџРѕР»СЏ РІРІРѕРґР°** - `#layers-search`, `[id^="layer-name-"]`, `.layer-parallax-input`
- **РљРЅРѕРїРєРё РґРµР№СЃС‚РІРёР№** - `#add-layer-btn` (Shift+Click РґР»СЏ РґРѕР±Р°РІР»РµРЅРёСЏ 3 СЃР»РѕРµРІ)
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ** - РІСЃРµ СЌР»РµРјРµРЅС‚С‹ СЂРµРіРёСЃС‚СЂРёСЂСѓСЋС‚СЃСЏ Р±РµР· РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕРіРѕ РєРѕРґР°

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`src/event-system/AutoEventHandlerManager.js`** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РїР°РЅРµР»РµР№ Рё СЌР»РµРјРµРЅС‚РѕРІ РёРЅС‚РµСЂС„РµР№СЃР°
- **`src/event-system/EventHandlerManager.js`** - РґРѕР±Р°РІР»РµРЅ С‚РёРї СЌР»РµРјРµРЅС‚Р° `custom` Рё `panel`
- **`docs/EVENT_HANDLER_SYSTEM.md`** - РѕР±РЅРѕРІР»РµРЅР° РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ РїР°РЅРµР»СЏС…

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РѕС€РёР±РѕРє РІ СЃРёСЃС‚РµРјРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№

#### рџђ› **РљСЂРёС‚РёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РћС€РёР±РєР° `className.includes is not a function`** - Р±РµР·РѕРїР°СЃРЅР°СЏ РїСЂРѕРІРµСЂРєР° С‚РёРїР° className
- **РћРїС‚РёРјРёР·Р°С†РёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё** - СЃС‚СЂРѕРіРёРµ РїСЂРѕРІРµСЂРєРё СЌР»РµРјРµРЅС‚РѕРІ РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ Р»РёС€РЅРµР№ РѕР±СЂР°Р±РѕС‚РєРё
- **РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - РїСЂРѕРІРµСЂРєРё РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ РїРѕРІС‚РѕСЂРЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРё СЌР»РµРјРµРЅС‚РѕРІ

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`src/managers/AutoEventHandlerManager.js`** - РёСЃРїСЂР°РІР»РµРЅРёСЏ РѕС€РёР±РѕРє Рё РѕРїС‚РёРјРёР·Р°С†РёРё

## [3.51.9] - 2025-01-27

### Fixed - РРЅРІРµСЂС‚РёСЂРѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР° z-РёРЅРґРµРєСЃРѕРІ СЃР»РѕС‘РІ

#### рџЋЇ **РР·РјРµРЅРµРЅРёРµ Р»РѕРіРёРєРё z-РёРЅРґРµРєСЃРѕРІ:**
- **РРЅРІРµСЂС‚РёСЂРѕРІР°РЅРЅС‹Р№ РїРѕСЂСЏРґРѕРє** - РІРµСЂС…РЅРёР№ СЃР»РѕР№ С‚РµРїРµСЂСЊ РёРјРµРµС‚ РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ z-РёРЅРґРµРєСЃ
- **Р›РѕРіРёС‡РЅР°СЏ РёРµСЂР°СЂС…РёСЏ** - РЅРёР¶РЅРёР№ СЃР»РѕР№ РёРјРµРµС‚ РјРёРЅРёРјР°Р»СЊРЅС‹Р№ z-РёРЅРґРµРєСЃ
- **РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ** - РІСЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РѕР±СЉРµРєС‚С‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёР·РјРµРЅРµРЅРёСЏ:**
- **`Level.updateLayerIndices()`** - РёР·РјРµРЅРµРЅР° Р»РѕРіРёРєР° СЂР°СЃС‡С‘С‚Р° РёРЅРґРµРєСЃРѕРІ СЃР»РѕС‘РІ
- **`Layer.setOrder()`** - СѓР±СЂР°РЅР° РїРµСЂРµР·Р°РїРёСЃСЊ РёРЅРґРµРєСЃР°, СѓРїСЂР°РІР»РµРЅРёРµ С‡РµСЂРµР· Level
- **РћР±РЅРѕРІР»РµРЅС‹ РєРѕРјРјРµРЅС‚Р°СЂРёРё** - РёСЃРїСЂР°РІР»РµРЅС‹ СѓСЃС‚Р°СЂРµРІС€РёРµ СѓРїРѕРјРёРЅР°РЅРёСЏ 0-based РёРЅРґРµРєСЃРѕРІ

#### рџ“‹ **Р¤Р°Р№Р»С‹ РёР·РјРµРЅРµРЅС‹:**
- **`src/models/Level.js`** - РёРЅРІРµСЂС‚РёСЂРѕРІР°РЅРЅР°СЏ Р»РѕРіРёРєР° РІ updateLayerIndices()
- **`src/models/Layer.js`** - СѓР±СЂР°РЅР° РїРµСЂРµР·Р°РїРёСЃСЊ РёРЅРґРµРєСЃР° РІ setOrder()

## [3.51.8] - 2025-01-27

### Added - Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№

#### рџЋЇ **EventHandlerManager - РЅРѕРІР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°:**
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ** - РµРґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РґР»СЏ РІСЃРµС… РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°** - РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ СѓС‚РµС‡РµРє РїР°РјСЏС‚Рё РїСЂРё СѓРґР°Р»РµРЅРёРё СЌР»РµРјРµРЅС‚РѕРІ
- **Р“Р»РѕР±Р°Р»СЊРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕР±СЂР°Р±РѕС‚РєР° ESC Рё overlay РєР»РёРєРѕРІ
- **РўРёРїРёР·РёСЂРѕРІР°РЅРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹** - РїРѕРґРґРµСЂР¶РєР° dialog, button, input, form, contextMenu
- **Р‘РµР·РѕРїР°СЃРЅР°СЏ СЂР°Р±РѕС‚Р° СЃ DOM** - РїСЂРѕРІРµСЂРєРё СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ Рё РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє

#### рџ› пёЏ **EventHandlerUtils - СѓРїСЂРѕС‰РµРЅРёРµ СЂР°Р±РѕС‚С‹:**
- **Р“РѕС‚РѕРІС‹Рµ С€Р°Р±Р»РѕРЅС‹** - createDialogHandlers, createButtonHandlers, createInputHandlers
- **РЈРїСЂРѕС‰РµРЅРЅС‹Р№ API** - addDialogEventHandling, addButtonEventHandling, addInputEventHandling
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РїСЂРёРІСЏР·РєР° РєРѕРЅС‚РµРєСЃС‚Р°** - РїСЂР°РІРёР»СЊРЅС‹Р№ `this` РґР»СЏ РІСЃРµС… РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **РЎС‚Р°РЅРґР°СЂС‚РЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё** - С‚РёРїРѕРІС‹Рµ СЃС†РµРЅР°СЂРёРё РґР»СЏ РґРёР°Р»РѕРіРѕРІ, РєРЅРѕРїРѕРє, РїРѕР»РµР№ РІРІРѕРґР°

#### рџ”„ **РРЅС‚РµРіСЂР°С†РёСЏ СЃ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРјРё РєРѕРјРїРѕРЅРµРЅС‚Р°РјРё:**
- **SettingsPanel** - РїРѕР»РЅР°СЏ РјРёРіСЂР°С†РёСЏ РЅР° РЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ
- **ActorPropertiesWindow** - РїРѕР»РЅР°СЏ РјРёРіСЂР°С†РёСЏ РЅР° РЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ
- **UniversalDialog** - РїРѕР»РЅР°СЏ РјРёРіСЂР°С†РёСЏ РЅР° РЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ
- **BaseContextMenu** - РїРѕР»РЅР°СЏ РјРёРіСЂР°С†РёСЏ РЅР° РЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ
- **AssetPanel** - РјРёРіСЂР°С†РёСЏ СЃ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹РјРё РѕР±СЂР°Р±РѕС‚С‡РёРєР°РјРё Рё РґРµР»РµРіРёСЂРѕРІР°РЅРёРµРј
- **Toolbar** - РїРѕР»РЅР°СЏ РјРёРіСЂР°С†РёСЏ РЅР° РЅРѕРІСѓСЋ СЃРёСЃС‚РµРјСѓ

#### рџљЂ **РћРїС‚РёРјРёР·Р°С†РёСЏ СЃРёСЃС‚РµРјС‹ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ:**
- **Р”РµР»РµРіРёСЂРѕРІР°РЅРёРµ СЃРѕР±С‹С‚РёР№** - РѕРґРёРЅ РѕР±СЂР°Р±РѕС‚С‡РёРє РЅР° РєРѕРЅС‚РµР№РЅРµСЂ РІРјРµСЃС‚Рѕ РјРЅРѕР¶РµСЃС‚РІР° РЅР° СЌР»РµРјРµРЅС‚С‹
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё** - РѕС‚РґРµР»СЊРЅС‹Рµ РєР»Р°СЃСЃС‹ РґР»СЏ РєР°Р¶РґРѕРіРѕ С‚РёРїР° РєРѕРјРїРѕРЅРµРЅС‚Р°
- **РР·РѕР»СЏС†РёСЏ Р»РѕРіРёРєРё** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё РІС‹РЅРµСЃРµРЅС‹ РёР· РєРѕРјРїРѕРЅРµРЅС‚РѕРІ РІ РѕС‚РґРµР»СЊРЅС‹Рµ РєР»Р°СЃСЃС‹
- **РџРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РІ СЂР°Р·РЅС‹С… РєРѕРјРїРѕРЅРµРЅС‚Р°С…
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°** - СЃРёСЃС‚РµРјР° СЃР°РјР° СѓРґР°Р»СЏРµС‚ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РїСЂРё СѓРЅРёС‡С‚РѕР¶РµРЅРёРё СЌР»РµРјРµРЅС‚РѕРІ

#### рџ¤– **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ (NEW):**
- **AutoEventHandlerManager** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕР±РЅР°СЂСѓР¶РµРЅРёРµ Рё СЂРµРіРёСЃС‚СЂР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РґР»СЏ РІСЃРµС… РѕРєРѕРЅ
- **UniversalWindowHandlers** - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ РѕРєРѕРЅ
- **MutationObserver** - РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ РЅРѕРІС‹С… РѕРєРѕРЅ РІ DOM
- **РќСѓР»РµРІР°СЏ РЅР°СЃС‚СЂРѕР№РєР°** - РЅРѕРІС‹Рµ РѕРєРЅР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕР»СѓС‡Р°СЋС‚ РѕР±СЂР°Р±РѕС‚С‡РёРєРё
- **РћС‚РєР°Р·РѕСѓСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ** - СЃРёСЃС‚РµРјР° СЂР°Р±РѕС‚Р°РµС‚ РґР°Р¶Рµ РµСЃР»Рё РјРµС‚РѕРґС‹ РЅРµ РЅР°Р№РґРµРЅС‹

#### рџ—‘пёЏ **РЈРїСЂРѕС‰РµРЅРёРµ Р°СЂС…РёС‚РµРєС‚СѓСЂС‹ (NEW):**
- **РЈРґР°Р»РµРЅ `src/handlers/AssetPanelHandlers.js`** - РёР·Р±С‹С‚РѕС‡РЅС‹Р№ С„Р°Р№Р»
- **РЈРїСЂРѕС‰РµРЅР° AssetPanel** - Р±РѕР»СЊС€Рµ РЅРµ РЅСѓР¶РЅР° СЂСѓС‡РЅР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ СЃРёСЃС‚РµРјР°** - РѕРґРёРЅ `UniversalWindowHandlers.js` РґР»СЏ РІСЃРµС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЂР°Р±РѕС‚Р°** - РЅРѕРІС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹ СЂР°Р±РѕС‚Р°СЋС‚ Р±РµР· РєРѕРґР°

#### рџ“‹ **РќРѕРІС‹Рµ С„Р°Р№Р»С‹:**
- **`src/managers/EventHandlerManager.js`** - С†РµРЅС‚СЂР°Р»СЊРЅС‹Р№ РјРµРЅРµРґР¶РµСЂ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№
- **`src/utils/EventHandlerUtils.js`** - СѓС‚РёР»РёС‚С‹ РґР»СЏ СѓРїСЂРѕС‰РµРЅРёСЏ СЂР°Р±РѕС‚С‹
- **`src/managers/AutoEventHandlerManager.js`** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЃРёСЃС‚РµРјР° СЂРµРіРёСЃС‚СЂР°С†РёРё РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **`src/handlers/UniversalWindowHandlers.js`** - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РґР»СЏ РІСЃРµС… РѕРєРѕРЅ
- **`docs/EVENT_HANDLER_SYSTEM.md`** - РїРѕРґСЂРѕР±РЅРѕРµ СЂСѓРєРѕРІРѕРґСЃС‚РІРѕ РїРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЋ

#### рџљЂ **РЈР»СѓС‡С€РµРЅРёСЏ Р°СЂС…РёС‚РµРєС‚СѓСЂС‹:**
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ** - РµРґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє РѕР±СЂР°Р±РѕС‚РєРµ СЃРѕР±С‹С‚РёР№
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ** - РЅРµ РЅСѓР¶РЅРѕ РїРѕРјРЅРёС‚СЊ РѕР± РѕС‡РёСЃС‚РєРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕС‚Р»Р°РґРєР°** - Р»РѕРіРёСЂРѕРІР°РЅРёРµ РІСЃРµС… СЃРѕР±С‹С‚РёР№ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **Р Р°СЃС€РёСЂСЏРµРјРѕСЃС‚СЊ** - Р»РµРіРєРѕ РґРѕР±Р°РІР»СЏС‚СЊ РЅРѕРІС‹Рµ С‚РёРїС‹ СЌР»РµРјРµРЅС‚РѕРІ

## [3.51.7] - 2025-01-27

### Fixed - РљСЂРёС‚РёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ Р¶РµСЃС‚РѕРІ

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ pan/zoom Р¶РµСЃС‚РѕРІ:**
- **РџРѕР»РЅРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚Рё** - pan Рё zoom Р¶РµСЃС‚С‹ СЃРЅРѕРІР° СЂР°Р±РѕС‚Р°СЋС‚ РЅР° РєР°РЅРІРµ
- **РСЃРїСЂР°РІР»РµРЅР° Р±Р»РѕРєРёСЂРѕРІРєР° Р¶РµСЃС‚РѕРІ** - СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ СЃРёСЃС‚РµРјР°РјРё Р±Р»РѕРєРёСЂРѕРІРєРё
- **РџСЂР°РІРёР»СЊРЅР°СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ** - РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РїРѕРґРґРµСЂР¶РєРё Р¶РµСЃС‚РѕРІ
- **РћР±СЉРµРґРёРЅРµРЅРёРµ РєРѕРЅС„РёРіСѓСЂР°С†РёР№** - РїРѕРґРґРµСЂР¶РєР° РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹С… С‚РёРїРѕРІ Р¶РµСЃС‚РѕРІ РЅР° РѕРґРЅРѕРј СЌР»РµРјРµРЅС‚Рµ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РСЃРїСЂР°РІР»РµРЅ passive event listeners** - move СЃРѕР±С‹С‚РёСЏ С‚РµРїРµСЂСЊ non-passive РґР»СЏ pan/zoom
- **Р”РѕР±Р°РІР»РµРЅ preventDefault** - РїСЂР°РІРёР»СЊРЅР°СЏ Р±Р»РѕРєРёСЂРѕРІРєР° Р±СЂР°СѓР·РµСЂРЅС‹С… Р¶РµСЃС‚РѕРІ
- **РСЃРїСЂР°РІР»РµРЅРѕ Р·Р°РјС‹РєР°РЅРёРµ** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ РїРѕР»СѓС‡Р°СЋС‚ Р°РєС‚СѓР°Р»СЊРЅСѓСЋ РєРѕРЅС„РёРіСѓСЂР°С†РёСЋ
- **РџСЂРёРѕСЂРёС‚РµС‚ РїСЂРё РѕР±СЉРµРґРёРЅРµРЅРёРё** - СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РїСЂРё РґРѕР±Р°РІР»РµРЅРёРё РЅРѕРІС‹С…

#### рџљЂ **РЈР»СѓС‡С€РµРЅРёСЏ СЃРёСЃС‚РµРјС‹:**
- **Р—Р°РіСЂСѓР·РєР° РЅР°СЃС‚СЂРѕРµРє РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ** - pan/zoom РЅР°СЃС‚СЂРѕР№РєРё Р·Р°РіСЂСѓР¶Р°СЋС‚СЃСЏ РёР· РєРѕРЅС„РёРіСѓСЂР°С†РёРё
- **РЈРґР°Р»РµРЅС‹ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё** - РѕС‡РёС‰РµРЅ РєРѕРґ РѕС‚ РІСЂРµРјРµРЅРЅС‹С… Р»РѕРіРѕРІ РѕС‚Р»Р°РґРєРё
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅР°СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ РЅР°СЃС‚СЂР°РёРІР°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РѕРґРёРЅ СЂР°Р·
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ** - РІСЃРµ С‚РёРїС‹ Р¶РµСЃС‚РѕРІ СЂР°Р±РѕС‚Р°СЋС‚ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕ Р±РµР· РєРѕРЅС„Р»РёРєС‚РѕРІ

#### рџ“‹ **РџРѕРґРґРµСЂР¶РёРІР°РµРјС‹Рµ Р¶РµСЃС‚С‹:**
- **Marquee selection** - РІС‹РґРµР»РµРЅРёРµ СЂР°РјРєРѕР№ (РѕРґРЅРѕРїР°Р»СЊС†РµРІС‹Р№)
- **Two-finger pan** - РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРµ РґРІСѓРјСЏ РїР°Р»СЊС†Р°РјРё
- **Two-finger zoom** - РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёРµ РґРІСѓРјСЏ РїР°Р»СЊС†Р°РјРё
- **Two-finger context** - РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РґРІСѓРјСЏ РїР°Р»СЊС†Р°РјРё
- **Combined pan/zoom** - РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕРµ pan Рё zoom

## [3.51.6] - 2025-01-27

### Improved - РЈР»СѓС‡С€РµРЅРёСЏ РёРЅС‚РµСЂС„РµР№СЃР° РєРѕРЅСЃРѕР»Рё

#### рџЋЇ **РЈР»СѓС‡С€РµРЅРёСЏ РєРѕРЅСЃРѕР»Рё:**
- **РљР»РёРєР°Р±РµР»СЊРЅР°СЏ С€Р°РїРєР° РєРѕРЅСЃРѕР»Рё** - РІСЃСЏ С€Р°РїРєР° РєРѕРЅСЃРѕР»Рё С‚РµРїРµСЂСЊ Р°РєС‚РёРІРЅР° РґР»СЏ Р·Р°РєСЂС‹С‚РёСЏ РѕРґРЅРёРј РєР»РёРєРѕРј
- **РЈРІРµР»РёС‡РµРЅРЅР°СЏ РєРЅРѕРїРєР° Р·Р°РєСЂС‹С‚РёСЏ** - РєРЅРѕРїРєР° X СЃС‚Р°Р»Р° Р±РѕР»СЊС€Рµ СЃ РѕС‚СЃС‚СѓРїР°РјРё `px-3 py-2` Рё СЂР°Р·РјРµСЂРѕРј `text-lg`
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР°** - РєРѕРЅСЃРѕР»СЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `EventHandlers.togglePanel('console')` РІРјРµСЃС‚Рѕ СЃС‚Р°СЂС‹С… С„СѓРЅРєС†РёР№
- **РђРґР°РїС‚РёРІРЅС‹Рµ РѕРіСЂР°РЅРёС‡РµРЅРёСЏ СЂР°Р·РјРµСЂР°** - РєРѕРЅСЃРѕР»СЊ РѕРіСЂР°РЅРёС‡РµРЅР° 70% СЌРєСЂР°РЅР° РґР»СЏ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё СЃРµРїР°СЂР°С‚РѕСЂР°
- **Drag РґР»СЏ СЃРµРїР°СЂР°С‚РѕСЂР°** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂР° РєРѕРЅСЃРѕР»Рё
- **Р”РІРѕР№РЅРѕР№ РєР»РёРє РЅР° СЃРµРїР°СЂР°С‚РѕСЂРµ** - РґРІРѕР№РЅРѕР№ РєР»РёРє РЅР° СЃРµРїР°СЂР°С‚РѕСЂРµ Р·Р°РєСЂС‹РІР°РµС‚ РєРѕРЅСЃРѕР»СЊ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРґ** - СЃРѕР·РґР°РЅР° РµРґРёРЅР°СЏ С„СѓРЅРєС†РёСЏ `closeConsole()` РІРјРµСЃС‚Рѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Р»РѕРіРёРєРё
- **DRY РїСЂРёРЅС†РёРї** - СѓСЃС‚СЂР°РЅРµРЅРѕ 32+ СЃС‚СЂРѕРєРё РґСѓР±Р»РёСЂРѕРІР°РЅРЅРѕРіРѕ РєРѕРґР°
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - РєРѕРЅСЃРѕР»СЊ РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РІ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅСѓСЋ СЃРёСЃС‚РµРјСѓ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё
- **Fallback РїРѕРґРґРµСЂР¶РєР°** - СЃРѕС…СЂР°РЅРµРЅР° СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ СЃРѕ СЃС‚Р°СЂС‹РјРё С„СѓРЅРєС†РёСЏРјРё РїСЂРё РЅРµРґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё СЂРµРґР°РєС‚РѕСЂР°
- **Р”РµС‚РµРєС†РёСЏ СѓСЃС‚СЂРѕР№СЃС‚РІ** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ РјР°Р»РµРЅСЊРєРёС… РѕРєРѕРЅ
- **РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ** - РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РєРѕРЅСЃРѕР»Рё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂС‹РІР°РµС‚СЃСЏ РїСЂРё Р·Р°РєСЂС‹С‚РёРё РєРѕРЅСЃРѕР»Рё
- **РСЃРїСЂР°РІР»РµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ СЃРµРїР°СЂР°С‚РѕСЂРѕРІ** - СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ РѕР±СЂР°Р±РѕС‚С‡РёРєР°РјРё
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - РІСЃРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё РёСЃРїРѕР»СЊР·СѓСЋС‚ РµРґРёРЅСѓСЋ СЃРёСЃС‚РµРјСѓ
- **РџСЂР°РІРёР»СЊРЅР°СЏ СЂРµРіРёСЃС‚СЂР°С†РёСЏ** - РїРѕРґРґРµСЂР¶РєР° СЂРµРіРёСЃС‚СЂРёСЂСѓРµС‚СЃСЏ РІ LevelEditor

#### рџЋЁ **UI СѓР»СѓС‡С€РµРЅРёСЏ:**
- **Р’РёР·СѓР°Р»СЊРЅР°СЏ РѕР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ** - РґРѕР±Р°РІР»РµРЅ `hover:bg-gray-800` РґР»СЏ С€Р°РїРєРё РєРѕРЅСЃРѕР»Рё
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ** - СѓРІРµР»РёС‡РµРЅРЅР°СЏ РѕР±Р»Р°СЃС‚СЊ РєР»РёРєР° РґР»СЏ Р·Р°РєСЂС‹С‚РёСЏ РєРѕРЅСЃРѕР»Рё
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅС‹Р№ РґРёР·Р°Р№РЅ** - С€Р°РїРєР° РєРѕРЅСЃРѕР»Рё СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓРµС‚ РѕР±С‰РµРјСѓ СЃС‚РёР»СЋ РёРЅС‚РµСЂС„РµР№СЃР°
- **РњРѕР±РёР»СЊРЅР°СЏ Р°РґР°РїС‚Р°С†РёСЏ** - РєРѕРЅСЃРѕР»СЊ Р°РґР°РїС‚РёСЂСѓРµС‚СЃСЏ РїРѕРґ СЂР°Р·РјРµСЂ СЌРєСЂР°РЅР° Рё С‚РёРї СѓСЃС‚СЂРѕР№СЃС‚РІР°

## [3.51.5] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕР·РёС†РёР№ СЂР°Р·РґРµР»РёС‚РµР»РµР№ РїР°РЅРµР»РµР№

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕР·РёС†РёР№:**
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕР·РёС†РёР№ Р±РѕРєРѕРІС‹С… РїР°РЅРµР»РµР№** - РїРѕР·РёС†РёРё СЂР°Р·РґРµР»РёС‚РµР»РµР№ Р»РµРІРѕР№ Рё РїСЂР°РІРѕР№ РїР°РЅРµР»РµР№ С‚РµРїРµСЂСЊ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ С‡РµСЂРµР· stateManager
- **Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїРѕР·РёС†РёР№ РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ** - РїРѕР·РёС†РёРё СЂР°Р·РґРµР»РёС‚РµР»РµР№ РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°СЋС‚СЃСЏ РёР· userPrefs
- **РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃ userPrefs** - РІСЃРµ РёР·РјРµРЅРµРЅРёСЏ РїРѕР·РёС†РёР№ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…
- **РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїРѕР·РёС†РёР№** - РЅР°С‡Р°Р»СЊРЅС‹Рµ РїРѕР·РёС†РёРё РїР°РЅРµР»РµР№ СѓСЃС‚Р°РЅР°РІР»РёРІР°СЋС‚СЃСЏ РёР· СЃРѕС…СЂР°РЅРµРЅРЅС‹С… РЅР°СЃС‚СЂРѕРµРє

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **PanelPositionManager** - РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `initializePanelWidths()` РґР»СЏ СѓСЃС‚Р°РЅРѕРІРєРё РЅР°С‡Р°Р»СЊРЅС‹С… РїРѕР·РёС†РёР№
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё** - РїРѕР·РёС†РёРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ `handleMouseUp` РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂР°
- **РРЅС‚РµРіСЂР°С†РёСЏ СЃ stateManager** - РїРѕР·РёС†РёРё СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓСЋС‚СЃСЏ РјРµР¶РґСѓ stateManager Рё userPrefs
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР°** - РµРґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє СЃРѕС…СЂР°РЅРµРЅРёСЋ РїРѕР·РёС†РёР№ РґР»СЏ РІСЃРµС… РїР°РЅРµР»РµР№

## [3.51.4] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ С„РѕСЂРј Р±РµР· id Р°С‚СЂРёР±СѓС‚РѕРІ Рё СЃРёРЅС…СЂРѕРЅРЅС‹Рµ XMLHttpRequest

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё:**
- **Р”РѕР±Р°РІР»РµРЅС‹ СѓРЅРёРєР°Р»СЊРЅС‹Рµ id Р°С‚СЂРёР±СѓС‚С‹ РєРѕ РІСЃРµРј РїРѕР»СЏРј РІРІРѕРґР°** - СЂРµС€РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ Р°РІС‚РѕР·Р°РїРѕР»РЅРµРЅРёРµРј С„РѕСЂРј РІ Р±СЂР°СѓР·РµСЂРµ
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ SettingsPanel.js** - С‡РµРєР±РѕРєСЃС‹, СЃР»Р°Р№РґРµСЂС‹, С‡РёСЃР»РѕРІС‹Рµ Рё С†РІРµС‚РѕРІС‹Рµ РїРѕР»СЏ
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ GridSettings.js** - РЅР°СЃС‚СЂРѕР№РєРё СЃРµС‚РєРё, РѕСЃРµР№ Рё РїСЂРёРІСЏР·РєРё
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ DetailsPanel.js** - РїРѕР»СЏ РїРѕР·РёС†РёРё Рё СЂР°Р·РјРµСЂР° РѕР±СЉРµРєС‚РѕРІ
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ LayersPanel.js** - РїРѕР»СЏ РёРјРµРЅ СЃР»РѕРµРІ, С†РІРµС‚РѕРІ Рё РїР°СЂР°Р»Р»Р°РєСЃР°
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ OutlinerPanel.js** - РїРѕР»СЏ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РёРјРµРЅ РіСЂСѓРїРї Рё РѕР±СЉРµРєС‚РѕРІ
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ FolderPickerDialog.js** - РїРѕР»Рµ РІС‹Р±РѕСЂР° РїР°РїРєРё
- **РСЃРїСЂР°РІР»РµРЅС‹ РїРѕР»СЏ РІ MenuPositioningUtils.js** - С‡РµРєР±РѕРєСЃС‹ РІ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё:**
- **Р—Р°РјРµРЅРµРЅС‹ СЃРёРЅС…СЂРѕРЅРЅС‹Рµ XMLHttpRequest РЅР° Р°СЃРёРЅС…СЂРѕРЅРЅС‹Рµ fetch** - СѓСЃС‚СЂР°РЅРµРЅРѕ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ Р±СЂР°СѓР·РµСЂР° Рѕ Р±Р»РѕРєРёСЂРѕРІРєРµ РіР»Р°РІРЅРѕРіРѕ РїРѕС‚РѕРєР°
- **РћР±РЅРѕРІР»РµРЅ ConfigManager.js** - РІСЃРµ РјРµС‚РѕРґС‹ Р·Р°РіСЂСѓР·РєРё РєРѕРЅС„РёРіСѓСЂР°С†РёР№ С‚РµРїРµСЂСЊ Р°СЃРёРЅС…СЂРѕРЅРЅС‹Рµ
- **РЈР»СѓС‡С€РµРЅР° Р·Р°РіСЂСѓР·РєР° РєРѕРЅС„РёРіСѓСЂР°С†РёР№** - РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Promise.all РґР»СЏ РїР°СЂР°Р»Р»РµР»СЊРЅРѕР№ Р·Р°РіСЂСѓР·РєРё С„Р°Р№Р»РѕРІ
- **РћР±РЅРѕРІР»РµРЅС‹ РІСЃРµ РІС‹Р·РѕРІС‹ РјРµС‚РѕРґРѕРІ** - SettingsPanel.js Рё UserPreferencesManager.js Р°РґР°РїС‚РёСЂРѕРІР°РЅС‹ РїРѕРґ async/await

#### рџЋЇ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **Р’СЃРµ РїРѕР»СЏ С‚РµРїРµСЂСЊ РёРјРµСЋС‚ СѓРЅРёРєР°Р»СЊРЅС‹Рµ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂС‹** - СѓР»СѓС‡С€РµРЅР° СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ СЃ Р±СЂР°СѓР·РµСЂРЅС‹РјРё С„СѓРЅРєС†РёСЏРјРё
- **РЎРѕС…СЂР°РЅРµРЅР° С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ** - РІСЃРµ РёР·РјРµРЅРµРЅРёСЏ РѕР±СЂР°С‚РЅРѕ СЃРѕРІРјРµСЃС‚РёРјС‹
- **РЈР»СѓС‡С€РµРЅР° РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ** - РїРѕР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕ СЂР°Р±РѕС‚Р°СЋС‚ СЃ Р°РІС‚РѕР·Р°РїРѕР»РЅРµРЅРёРµРј Рё СЃРєСЂРёРЅ-СЂРёРґРµСЂР°РјРё
- **РЈР»СѓС‡С€РµРЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - СѓСЃС‚СЂР°РЅРµРЅР° Р±Р»РѕРєРёСЂРѕРІРєР° UI РїСЂРё Р·Р°РіСЂСѓР·РєРµ РєРѕРЅС„РёРіСѓСЂР°С†РёР№

## [3.51.3] - 2025-01-27

### Added - Р”РѕР±Р°РІР»РµРЅР° РєРѕРјР°РЅРґР° С‚РѕРіРіР»Р° РєРѕРЅСЃРѕР»Рё РІ РјРµРЅСЋ View

#### рџЋЇ **РќРѕРІР°СЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ:**
- **Р”РѕР±Р°РІР»РµРЅР° РєРѕРјР°РЅРґР° "Console" РІ СЃРµРєС†РёСЋ Panels РјРµРЅСЋ View** - РїРѕР·РІРѕР»СЏРµС‚ РїРµСЂРµРєР»СЋС‡Р°С‚СЊ РІРёРґРёРјРѕСЃС‚СЊ РєРѕРЅСЃРѕР»Рё
- **РРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РєРѕРЅСЃРѕР»СЊ РІ СѓРЅРёРІРµСЂСЃР°Р»СЊРЅСѓСЋ СЃРёСЃС‚РµРјСѓ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё** - РёСЃРїРѕР»СЊР·СѓРµС‚ `applyPanelVisibility()`
- **Р”РѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РєРѕРЅСЃРѕР»Рё РІ Immersive Mode** - РєРѕРЅСЃРѕР»СЊ СЃРєСЂС‹РІР°РµС‚СЃСЏ/РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ
- **РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРѕРЅСЃРѕР»Рё СЃ С‡РµРєР±РѕРєСЃРѕРј РјРµРЅСЋ** - РєРѕСЂСЂРµРєС‚РЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ

#### рџЋЇ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **Р Р°СЃС€РёСЂРµРЅ `panelConfig` РґР»СЏ РїРѕРґРґРµСЂР¶РєРё РєРѕРЅСЃРѕР»Рё** - РґРѕР±Р°РІР»РµРЅ С‚РёРї 'dom' СЃ СЌР»РµРјРµРЅС‚Р°РјРё console-panel Рё resizer-console
- **РћР±РЅРѕРІР»РµРЅС‹ РІСЃРµ РјР°СЃСЃРёРІС‹ РїР°РЅРµР»РµР№** - console РґРѕР±Р°РІР»РµРЅР° РІ panelStates, panelOptions, panelToggles
- **Р”РѕР±Р°РІР»РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° console РІ `updateViewCheckbox()`** - РєРѕСЂСЂРµРєС‚РЅРѕРµ РјР°РїРїРёСЂРѕРІР°РЅРёРµ РЅР° toggle-console
- **РРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РєРѕРЅСЃРѕР»СЊ РІ СЃРёСЃС‚РµРјСѓ СЃРѕС…СЂР°РЅРµРЅРёСЏ/РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ СЃРѕСЃС‚РѕСЏРЅРёР№** - СЂР°Р±РѕС‚Р°РµС‚ СЃ StateManager

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё:**
- **РСЃРїСЂР°РІР»РµРЅ РєРѕРЅС„Р»РёРєС‚ РєР»Р°РІРёР°С‚СѓСЂРЅРѕРіРѕ С€РѕСЂС‚РєР°С‚Р°** - РєР»Р°РІРёС€Р° ` С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `EventHandlers.togglePanel('console')`
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ РІСЃРµ СЃРїРѕСЃРѕР±С‹ СѓРїСЂР°РІР»РµРЅРёСЏ РєРѕРЅСЃРѕР»СЊСЋ** - РєР»Р°РІРёС€Р°, РјРµРЅСЋ, РєРЅРѕРїРєР° Р·Р°РєСЂС‹С‚РёСЏ РёСЃРїРѕР»СЊР·СѓСЋС‚ StateManager
- **РСЃРїСЂР°РІР»РµРЅР° РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РєРѕРЅСЃРѕР»Рё** - РёСЃРїРѕР»СЊР·СѓРµС‚ `stateManager.get('console.visible')` РІРјРµСЃС‚Рѕ `userPrefs.get('consoleVisible')`
- **РћР±РЅРѕРІР»РµРЅС‹ С„СѓРЅРєС†РёРё showConsole/hideConsole** - СЃРѕС…СЂР°РЅСЏСЋС‚ СЃРѕСЃС‚РѕСЏРЅРёРµ С‡РµСЂРµР· `stateManager.set('console.visible')`
- **Р”РѕР±Р°РІР»РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РїРѕСЃР»Рµ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё** - РѕР±РЅРѕРІР»СЏРµС‚ StateManager СЃ Р°РєС‚СѓР°Р»СЊРЅС‹Рј СЃРѕСЃС‚РѕСЏРЅРёРµРј РєРѕРЅСЃРѕР»Рё

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РєР»Р°РІРёР°С‚СѓСЂС‹:**
- **РСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ "Р·Р°Р¶РёРјР°РЅРёРµРј" Alt РєР»Р°РІРёС€Рё** - РґРѕР±Р°РІР»РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° Alt РІ `EventHandlers.setupKeyboardEvents()`
- **Р”РѕР±Р°РІР»РµРЅРѕ СЃРѕСЃС‚РѕСЏРЅРёРµ `keyboard.altKey` РІ StateManager** - РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ Alt РєР»Р°РІРёС€Рё
- **РћР±РЅРѕРІР»РµРЅ РјРµС‚РѕРґ `isAltKeyPressed()`** - РїСЂРѕРІРµСЂСЏРµС‚ РєР°Рє `mouse.altKey`, С‚Р°Рє Рё `keyboard.altKey`
- **РЈСЃС‚СЂР°РЅРµРЅР° СЂР°СЃСЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ** - С‚РµРїРµСЂСЊ Alt СЃРѕСЃС‚РѕСЏРЅРёРµ РєРѕСЂСЂРµРєС‚РЅРѕ РѕС‚СЃР»РµР¶РёРІР°РµС‚СЃСЏ Рё СЃР±СЂР°СЃС‹РІР°РµС‚СЃСЏ

## [3.51.2] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РјРµРЅСЋ Рё Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РјРµРЅСЋ:**
- **РСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РјРµРЅСЋ С„РёР»СЊС‚СЂР° outliner** - РєРѕСЂСЂРµРєС‚РЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂСѓРµС‚СЃСЏ РїСЂРё РїРµСЂРµРЅРѕСЃРµ РІ РїСЂР°РІСѓСЋ РїР°РЅРµР»СЊ
- **РЎРѕР·РґР°РЅР° СѓС‚РёР»РёС‚Р° MenuPositioningUtils** - СЃС‚Р°РЅРґР°СЂС‚РёР·РёСЂРѕРІР°РЅРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РґР»СЏ РІСЃРµС… РјРµРЅСЋ
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ CSS РєР»Р°СЃСЃС‹ РјРµРЅСЋ** - РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅС‹Р№ РІРЅРµС€РЅРёР№ РІРёРґ РІСЃРµС… popup РјРµРЅСЋ
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° СЃРєСЂС‹С‚РёСЏ РјРµРЅСЋ** - РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Р»РѕРіРёРєР° РёР· BaseContextMenu (mouseleave + click)
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅ РєРѕРґ OutlinerPanel** - СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ, СЃРѕРєСЂР°С‰РµРЅ РєРѕРґ СЃ ~50 РґРѕ ~15 СЃС‚СЂРѕРє

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ:**
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° Р°РєС‚РёРІР°С†РёРё РїСЂРё РїРµСЂРµРЅРѕСЃРµ С‚Р°Р±РѕРІ** - РїРµСЂРµРЅРµСЃРµРЅРЅС‹Р№ С‚Р°Р± Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ, РѕСЃС‚Р°Р»СЊРЅС‹Рµ РґРµР°РєС‚РёРІРёСЂСѓСЋС‚СЃСЏ
- **Р”РѕР±Р°РІР»РµРЅР° Р°РєС‚РёРІР°С†РёСЏ С‚Р°Р±Р°, Р±Р»РёР¶Р°Р№С€РµРіРѕ Рє СЃРµРїР°СЂР°С‚РѕСЂСѓ** - РїСЂРё РїРµСЂРµРЅРѕСЃРµ Р°РєС‚РёРІРёСЂСѓРµС‚СЃСЏ РєСЂР°Р№РЅРёР№ Рє main-panel С‚Р°Р±
- **РСЃРїСЂР°РІР»РµРЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Р°РєС‚РёРІРЅС‹С… С‚Р°Р±РѕРІ РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ** - РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°СЋС‚СЃСЏ СЃРѕС…СЂР°РЅРµРЅРЅС‹Рµ С‚Р°Р±С‹
- **РЈСЃС‚СЂР°РЅРµРЅР° РїСЂРѕР±Р»РµРјР° Р°РІС‚Рѕ-СЃРµР»РµРєС‚Р° РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё** - РЅРµ РїРµСЂРµР·Р°РїРёСЃС‹РІР°РµС‚ СЃРѕС…СЂР°РЅРµРЅРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ
- **РСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё** - СЃРЅР°С‡Р°Р»Р° РїРѕР·РёС†РёРё, Р·Р°С‚РµРј Р°РєС‚РёРІР°С†РёСЏ С‚Р°Р±РѕРІ

#### вњ… **РЈР»СѓС‡С€РµРЅРёСЏ Р°СЂС…РёС‚РµРєС‚СѓСЂС‹:**
- **РЎРѕР·РґР°РЅ MenuPositioningUtils** - РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµРјР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РјРµРЅСЋ
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅР° Р»РѕРіРёРєР° РїРѕР»СѓС‡РµРЅРёСЏ С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ** - РјРµС‚РѕРґ `getObjectTypes()` РІ СѓС‚РёР»РёС‚Рµ
- **РСЃРїСЂР°РІР»РµРЅ РїРѕС‚РѕРє РґР°РЅРЅС‹С… StateManager в†’ ConfigManager** - С‡РµСЂРµР· РїРѕРґРїРёСЃРєРё Р±РµР· РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° Р»РѕРіРёРєР° Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ** - СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- **РќРѕРІС‹Р№:** `src/utils/MenuPositioningUtils.js` - СѓС‚РёР»РёС‚Р° РґР»СЏ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РјРµРЅСЋ
- **РћР±РЅРѕРІР»РµРЅ:** `src/ui/OutlinerPanel.js` - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅ РєРѕРґ РјРµРЅСЋ С„РёР»СЊС‚СЂР°
- **РћР±РЅРѕРІР»РµРЅ:** `src/ui/PanelPositionManager.js` - РёСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ
- **РћР±РЅРѕРІР»РµРЅ:** `src/core/EventHandlers.js` - РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ

## [3.51.1] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»РµР№, С‚Р°Р±РѕРІ Рё РЅР°СЃС‚СЂРѕРµРє

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»РµР№:**
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° СЃРѕР·РґР°РЅРёСЏ Р»РµРІРѕР№ РїР°РЅРµР»Рё** - РЅРµ СЃРѕР·РґР°РµС‚СЃСЏ РєРѕРіРґР° РІСЃРµ С‚Р°Р±С‹ РІ РїСЂР°РІРѕР№ РїР°РЅРµР»Рё
- **РСЃРїСЂР°РІР»РµРЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїСЂР°РІРѕР№ РїР°РЅРµР»Рё** - РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё РїРµСЂРµРЅРѕСЃРµ С‚Р°Р±РѕРІ
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅР° Р»РѕРіРёРєР° СѓРґР°Р»РµРЅРёСЏ РїР°РЅРµР»РµР№** - РІСЃРµ РїСѓСЃС‚С‹Рµ РїР°РЅРµР»Рё СѓРґР°Р»СЏСЋС‚СЃСЏ РїРѕР»РЅРѕСЃС‚СЊСЋ
- **РСЃРїСЂР°РІР»РµРЅР° Р±РµСЃРєРѕРЅРµС‡РЅР°СЏ СЂРµРєСѓСЂСЃРёСЏ** - СѓСЃС‚СЂР°РЅРµРЅР° РѕС€РёР±РєР° "Maximum call stack size exceeded"
- **РСЃРїСЂР°РІР»РµРЅРѕ РѕР±СЂРµР·Р°РЅРёРµ С‚Р°Р±РѕРІ** - С‚Р°Р±С‹ Р»РµРІРѕР№ РїР°РЅРµР»Рё РїСЂР°РІРёР»СЊРЅРѕ РѕР±СЂРµР·Р°СЋС‚СЃСЏ РїСЂРё СѓРјРµРЅСЊС€РµРЅРёРё

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ С‚Р°Р±РѕРІ:**
- **РСЃРїСЂР°РІР»РµРЅР° РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїРѕР·РёС†РёР№ С‚Р°Р±РѕРІ** - РїСЂР°РІРёР»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє РѕРїРµСЂР°С†РёР№ РїСЂРё Р·Р°РїСѓСЃРєРµ
- **РСЃРїСЂР°РІР»РµРЅР° РІР°Р»РёРґР°С†РёСЏ Р°РєС‚РёРІРЅС‹С… С‚Р°Р±РѕРІ** - С‚Р°Р±С‹ Р°РєС‚РёРІРёСЂСѓСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… РїР°РЅРµР»СЏС…
- **РСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ РїРѕР·РёС†РёР№ С‚Р°Р±РѕРІ** - РєРѕСЂСЂРµРєС‚РЅРѕ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РїСЂРё Р·Р°РєСЂС‹С‚РёРё СЂРµРґР°РєС‚РѕСЂР°

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє:**
- **РСЃРїСЂР°РІР»РµРЅ РґРёР°РїР°Р·РѕРЅ zoom threshold** - РјРёРЅРёРјР°Р»СЊРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ 0.01, РјР°РєСЃРёРјР°Р»СЊРЅРѕРµ 0.5
- **РСЃРїСЂР°РІР»РµРЅС‹ Р·РЅР°С‡РµРЅРёСЏ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ** - СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‚ РґРёР°РїР°Р·РѕРЅСѓ СЃР»Р°Р№РґРµСЂР°
- **РСЃРїСЂР°РІР»РµРЅР° РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ РЅР°СЃС‚СЂРѕРµРє** - РѕРґРёРЅР°РєРѕРІС‹Рµ Р·РЅР°С‡РµРЅРёСЏ РІРѕ РІСЃРµС… С„Р°Р№Р»Р°С…

#### вњ… **РЈР»СѓС‡С€РµРЅРёСЏ РєРѕРґР°:**
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ РІС‹Р·РѕРІС‹ РѕР±РЅРѕРІР»РµРЅРёСЏ UI
- **РЈРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° Р°РєС‚РёРІР°С†РёРё С‚Р°Р±РѕРІ** - СЃРѕР·РґР°РЅ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ РјРµС‚РѕРґ `_activatePanelTab()`
- **РЈРґР°Р»РµРЅ СѓСЃС‚Р°СЂРµРІС€РёР№ РјРµС‚РѕРґ** - `setActiveRightPanelTab()` Р·Р°РјРµРЅРµРЅ РЅР° `setActivePanelTab()`
- **Р”РѕР±Р°РІР»РµРЅС‹ CSS СЃС‚РёР»Рё РґР»СЏ С‚Р°Р±РѕРІ** - РїСЂР°РІРёР»СЊРЅРѕРµ РѕР±СЂРµР·Р°РЅРёРµ Рё СЃР¶Р°С‚РёРµ РїСЂРё РїРµСЂРµРїРѕР»РЅРµРЅРёРё

## [3.51.0] - 2025-01-27

### Added - РћС‚РґРµР»СЊРЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ С‚Р°Р±РѕРІ РґР»СЏ Р»РµРІРѕР№ Рё РїСЂР°РІРѕР№ РїР°РЅРµР»РµР№

#### рџЋЇ **РќРѕРІС‹Рµ С„СѓРЅРєС†РёРё:**
- **РћС‚РґРµР»СЊРЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ `leftPanelTab` Рё `rightPanelTab`** - РЅРµР·Р°РІРёСЃРёРјРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ С‚Р°Р±Р°РјРё
- **РќРµР·Р°РІРёСЃРёРјС‹Р№ СЃРµР»РµРєС‚ С‚Р°Р±РѕРІ** - РїРµСЂРµРєР»СЋС‡РµРЅРёРµ РІ РѕРґРЅРѕР№ РїР°РЅРµР»Рё РЅРµ СЃР±СЂР°СЃС‹РІР°РµС‚ СЃРµР»РµРєС‚ РІ РґСЂСѓРіРѕР№
- **РљРѕСЂСЂРµРєС‚РЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РєРѕРЅС‚РµРЅС‚Р°** - РєРѕРЅС‚РµРЅС‚ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ Р°РєС‚РёРІРЅРѕРіРѕ С‚Р°Р±Р° РІ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РµР№ РїР°РЅРµР»Рё

#### вњ… **РЈР»СѓС‡С€РµРЅРёСЏ:**
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° РІ StateManager** - СЃРѕР·РґР°РЅ РјРµС‚РѕРґ `createInitialState()`
- **РћР±РЅРѕРІР»РµРЅР° РєРѕРЅС„РёРіСѓСЂР°С†РёСЏ** - РґРѕР±Р°РІР»РµРЅ `leftPanelTabOrder` РІ РЅР°СЃС‚СЂРѕР№РєРё РїР°РЅРµР»РµР№
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РїРѕРєР°Р·Р° РєРѕРЅС‚РµРЅС‚Р°** - РїРѕРёСЃРє РєРѕРЅС‚РµРЅС‚-РїР°РЅРµР»РµР№ РІ РїСЂР°РІРёР»СЊРЅС‹С… РєРѕРЅС‚РµР№РЅРµСЂР°С…

## [3.51.0] - 2025-01-27

### Fixed - РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ Р»РѕРіРёРєР° СЃРµРїР°СЂР°С‚РѕСЂРѕРІ Рё С‚Р°С‡-РїРѕРґРґРµСЂР¶РєР°

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅР° Р»РѕРіРёРєР° РґР°Р±Р»-РєР»РёРєР° СЃРµРїР°СЂР°С‚РѕСЂРѕРІ** - РµРґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РґР»СЏ РІСЃРµС… РїР°РЅРµР»РµР№
- **РЈРїСЂРѕС‰РµРЅРѕ СѓРїСЂР°РІР»РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏРјРё** - С‚РѕР»СЊРєРѕ С‡РµСЂРµР· StateManager, Р±РµР· РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ
- **РСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° `newSize is not defined`** - СѓР±СЂР°РЅРѕ РёР·Р±С‹С‚РѕС‡РЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ
- **Р”РѕР±Р°РІР»РµРЅ `leftPanelWidth` РІ UserPreferencesManager** - СѓСЃС‚СЂР°РЅРµРЅРѕ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ
- **РСЃРїСЂР°РІР»РµРЅРѕ Р·РµСЂРєР°Р»СЊРЅРѕРµ РґРІРёР¶РµРЅРёРµ СЂР°Р·РґРµР»РёС‚РµР»РµР№** - РєРѕСЂСЂРµРєС‚РЅР°СЏ СЂР°Р±РѕС‚Р° РґР»СЏ РїСЂР°РІРѕР№ РїР°РЅРµР»Рё Рё Р°СЃСЃРµС‚РЅРѕР№ РїР°РЅРµР»Рё
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ Р»РѕРіРёРєРё** - РµРґРёРЅР°СЏ СЃРёСЃС‚РµРјР° РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ СЃРѕР±С‹С‚РёР№

#### вњ… **РЈР»СѓС‡С€РµРЅРёСЏ:**
- **РЈР±СЂР°РЅС‹ Р»РѕРєР°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ `previousSizeRef`** - РІСЃРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РІ StateManager
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° СЃРІРѕСЂР°С‡РёРІР°РЅРёСЏ/СЂР°Р·РІРѕСЂР°С‡РёРІР°РЅРёСЏ** - РєРѕСЂСЂРµРєС‚РЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ РїРѕР·РёС†РёР№
- **РЈРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° СѓРїСЂР°РІР»РµРЅРёСЏ** - С‡РёС‚Р°РµС‚ РїРѕР·РёС†РёРё С‚РѕР»СЊРєРѕ РёР· StateManager
- **РЈР±СЂР°РЅРѕ РёР·Р±С‹С‚РѕС‡РЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёР№** - РїРѕР·РёС†РёСЏ СѓР¶Рµ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РїСЂРё РёР·РјРµРЅРµРЅРёРё
- **РЎРѕР·РґР°РЅ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ РјРµС‚РѕРґ `handlePanelResize`** - РµРґРёРЅР°СЏ Р»РѕРіРёРєР° РїСЂРёРјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂРѕРІ
- **РЈР±СЂР°РЅР° РґСѓР±Р»РёСЂСѓСЋС‰Р°СЏ Р»РѕРіРёРєР°** РјРµР¶РґСѓ СЂР°Р·РЅС‹РјРё С‚РёРїР°РјРё СЃРѕР±С‹С‚РёР№

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **РћР±РЅРѕРІР»РµРЅ:** `src/ui/PanelPositionManager.js` - СѓР±СЂР°РЅС‹ Р»РѕРєР°Р»СЊРЅС‹Рµ РїРµСЂРµРјРµРЅРЅС‹Рµ previousSizeRef, РґРѕР±Р°РІР»РµРЅ handlePanelResize
- **РћР±РЅРѕРІР»РµРЅ:** `src/managers/UserPreferencesManager.js` - РґРѕР±Р°РІР»РµРЅ leftPanelWidth
- **РћР±РЅРѕРІР»РµРЅ:** `src/managers/StateManager.js` - РґРѕР±Р°РІР»РµРЅ assetsPanelPreviousHeight

## [3.50.8] - 2025-01-27

### Added - РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ СЃРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ РїРѕР·РёС†РёРµР№ РїР°РЅРµР»РµР№

#### рџЋЇ **РќРѕРІР°СЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ:**
- **Р”РѕР±Р°РІР»РµРЅР° РѕРїС†РёСЏ РїРµСЂРµРЅРѕСЃР° РїСЂР°РІРѕР№ РїР°РЅРµР»Рё РЅР° Р»РµРІСѓСЋ СЃС‚РѕСЂРѕРЅСѓ** - РєРЅРѕРїРєР° в‡„ РІ Р·Р°РіРѕР»РѕРІРєРµ РїР°РЅРµР»Рё
- **РЎРѕР·РґР°РЅ СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ PanelPositionManager** РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїРѕР·РёС†РёРµР№ РІСЃРµС… РїР°РЅРµР»РµР№
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅ РїРѕРґС…РѕРґ** Рє РїРµСЂРµРєР»СЋС‡РµРЅРёСЋ РїРѕР·РёС†РёРё РїР°РЅРµР»РµР№ (folders Рё right panel)

#### вњ… **РЈР»СѓС‡С€РµРЅРёСЏ:**
- **РСЃРїСЂР°РІР»РµРЅРѕ РЅР°РїСЂР°РІР»РµРЅРёРµ РґРІРёР¶РµРЅРёСЏ СЂР°Р·РґРµР»РёС‚РµР»СЏ** РїСЂРё РїРµСЂРµРЅРѕСЃРµ РїР°РЅРµР»Рё РЅР° Р»РµРІСѓСЋ СЃС‚РѕСЂРѕРЅСѓ
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅС‹ РІС‹Р·РѕРІС‹ canvas** - СЃРѕР·РґР°РЅР° СѓРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ updateCanvas()
- **РЈСЃС‚СЂР°РЅРµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ СЃР»СѓС€Р°С‚РµР»Рё СЃРѕР±С‹С‚РёР№** - СѓРґР°Р»РµРЅ Р»РёС€РЅРёР№ window resize СЃР»СѓС€Р°С‚РµР»СЊ
- **РСЃРїСЂР°РІР»РµРЅС‹ СѓС‚РµС‡РєРё РїР°РјСЏС‚Рё** - РІСЃРµ СЃР»СѓС€Р°С‚РµР»Рё С‚РµРїРµСЂСЊ РїСЂР°РІРёР»СЊРЅРѕ РѕС‚РєР»СЋС‡Р°СЋС‚СЃСЏ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **РќРѕРІС‹Р№ РєРѕРјРїРѕРЅРµРЅС‚:** `src/ui/PanelPositionManager.js` - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РјРµРЅРµРґР¶РµСЂ РїРѕР·РёС†РёР№ РїР°РЅРµР»РµР№
- **РћР±РЅРѕРІР»РµРЅС‹:** `LevelEditor.js`, `EventHandlers.js`, `AssetPanel.js` - РёРЅС‚РµРіСЂР°С†РёСЏ СЃ PanelPositionManager
- **РСЃРїСЂР°РІР»РµРЅС‹:** `index.html`, `FoldersPanel.js` - СѓСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂСѓСЋС‰РёС…СЃСЏ СЃР»СѓС€Р°С‚РµР»РµР№
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅ РєРѕРґ:** СѓР±СЂР°РЅРѕ 8+ РґСѓР±Р»РёСЂСѓСЋС‰РёС…СЃСЏ РІС‹Р·РѕРІРѕРІ canvas, СѓР»СѓС‡С€РµРЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ

#### рџ“Љ **Р РµР·СѓР»СЊС‚Р°С‚:**
- Р•РґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє СѓРїСЂР°РІР»РµРЅРёСЋ РїРѕР·РёС†РёРµР№ РїР°РЅРµР»РµР№
- РџСЂР°РІРёР»СЊРЅР°СЏ СЂР°Р±РѕС‚Р° СЂР°Р·РґРµР»РёС‚РµР»СЏ РІ РѕР±РµРёС… РїРѕР·РёС†РёСЏС…
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅР°СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ
- РЈСЃС‚СЂР°РЅРµРЅС‹ СѓС‚РµС‡РєРё РїР°РјСЏС‚Рё

## [3.50.7] - 2025-01-27

### Fixed - Р”РѕСЂР°Р±РѕС‚РєР° С†РІРµС‚РѕРІ РёРЅС‚РµСЂС„РµР№СЃР° Рё РѕРїС‚РёРјРёР·Р°С†РёСЏ РєРѕРґР°

#### рџЋЇ **РџСЂРѕР±Р»РµРјР°:**
- Р’С‹РїР°РґР°СЋС‰РёРµ РјРµРЅСЋ РѕСЃРЅРѕРІРЅРѕРіРѕ РјРµРЅСЋ Р±РµР· UI Background РїРµСЂРµРјРµРЅРЅРѕР№
- РќРµРїСЂР°РІРёР»СЊРЅС‹Рµ С†РІРµС‚Р° РІ РїР°РЅРµР»Рё Layers (Active РІРјРµСЃС‚Рѕ UI Text Color)
- Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ CSS СЃС‚РёР»РµР№ Рё Р»РёС€РЅРёР№ РєРѕРґ

#### вњ… **Р РµС€РµРЅРёРµ:**
- **Р”РѕР±Р°РІР»РµРЅР° UI Background РїРµСЂРµРјРµРЅРЅР°СЏ** РґР»СЏ РІС‹РїР°РґР°СЋС‰РёС… РјРµРЅСЋ РѕСЃРЅРѕРІРЅРѕРіРѕ РјРµРЅСЋ
- **РСЃРїСЂР°РІР»РµРЅС‹ С†РІРµС‚Р° РїР°РЅРµР»Рё Layers** - Р·Р°РјРµРЅРµРЅ Active Text Color РЅР° UI Text Color
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅ РєРѕРґ** - СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ CSS РїСЂР°РІРёР» Рё СѓРїСЂРѕС‰РµРЅС‹ РєРѕРјРјРµРЅС‚Р°СЂРёРё

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- РћР±РЅРѕРІР»РµРЅС‹ `MenuManager.js`, `config/menu.js` - РґРѕР±Р°РІР»РµРЅС‹ CSS РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ РјРµРЅСЋ
- РСЃРїСЂР°РІР»РµРЅС‹ `LayersPanel.js`, `layers-panel.css` - Р·Р°РјРµРЅРµРЅС‹ С†РІРµС‚Р° РЅР° UI Text Color
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅС‹ `main.css`, `AssetPanel.js` - СѓР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ Рё Р»РёС€РЅРёР№ РєРѕРґ
- 209 РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№ CSS РїРµСЂРµРјРµРЅРЅС‹С… РІ 18 С„Р°Р№Р»Р°С…

## [3.50.6] - 2025-01-27

### Fixed - РЈРЅРёС„РёРєР°С†РёСЏ С†РІРµС‚РѕРІ С‚РµРєСЃС‚Р° РІ РёРЅС‚РµСЂС„РµР№СЃРµ

#### рџЋЇ **РџСЂРѕР±Р»РµРјР°:**
- РќР°СЃС‚СЂРѕР№РєР° UI Text Color РїСЂРёРјРµРЅСЏР»Р°СЃСЊ РЅРµ РєРѕ РІСЃРµРј СЌР»РµРјРµРЅС‚Р°Рј РёРЅС‚РµСЂС„РµР№СЃР°
- Р–РµСЃС‚РєРѕ Р·Р°РґР°РЅРЅС‹Рµ С†РІРµС‚Р° РІ РєРѕРґРµ Рё CSS РїРµСЂРµРєСЂС‹РІР°Р»Рё РїРµСЂРµРјРµРЅРЅС‹Рµ
- РќРµРїСЂР°РІРёР»СЊРЅС‹Рµ С†РІРµС‚Р° РІ СЂРµР¶РёРјР°С… РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ Assets РїР°РЅРµР»Рё

#### вњ… **Р РµС€РµРЅРёРµ:**
- **Р—Р°РјРµРЅРµРЅС‹ РІСЃРµ Р¶РµСЃС‚РєРѕ Р·Р°РґР°РЅРЅС‹Рµ С†РІРµС‚Р°** РЅР° CSS РїРµСЂРµРјРµРЅРЅС‹Рµ `--ui-text-color` Рё `--ui-active-text-color`
- **РСЃРїСЂР°РІР»РµРЅС‹ СЃС‚РёР»Рё С‚СѓР»Р±Р°СЂР° Рё РјРµРЅСЋ** - РґРѕР±Р°РІР»РµРЅС‹ CSS РїСЂР°РІРёР»Р° СЃ `!important`
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ С†РІРµС‚Р° Assets РїР°РЅРµР»Рё** РґР»СЏ РІСЃРµС… СЂРµР¶РёРјРѕРІ (Grid, List, Details)
- **РџСЂР°РІРёР»СЊРЅРѕРµ РїСЂРёРјРµРЅРµРЅРёРµ РїРµСЂРµРјРµРЅРЅС‹С…** РґР»СЏ РІС‹Р±СЂР°РЅРЅС‹С…/РЅРµР°РєС‚РёРІРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- 185 РёСЃРїРѕР»СЊР·РѕРІР°РЅРёР№ CSS РїРµСЂРµРјРµРЅРЅС‹С… РІ 17 С„Р°Р№Р»Р°С…
- РСЃРїСЂР°РІР»РµРЅС‹ СЃС‚РёР»Рё РІ `styles/main.css`, `styles/spacing-mode.css`
- РћР±РЅРѕРІР»РµРЅС‹ РєРѕРјРїРѕРЅРµРЅС‚С‹: Toolbar, MenuManager, AssetPanel, LayersPanel, DetailsPanel
- CSS СЃРµР»РµРєС‚РѕСЂС‹ `.selected` Рё `.selected *` РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ РїРµСЂРµРѕРїСЂРµРґРµР»РµРЅРёСЏ С†РІРµС‚РѕРІ

## [3.50.5] - 2025-01-27

### Fixed - Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Player Start РѕР±СЉРµРєС‚РѕРІ

#### рџЋЇ **РџСЂРѕР±Р»РµРјР°:**
- **РћС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёР№ РІС‹Р·РѕРІ**: `updateLevelStatsPanel()` РЅРµ РІС‹Р·С‹РІР°Р»СЃСЏ, РїРѕСЌС‚РѕРјСѓ Р»РѕРіРёРєР° РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РЅРµ СЂР°Р±РѕС‚Р°Р»Р°
- **РќРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№ СЌР»РµРјРµРЅС‚**: РњРµС‚РѕРґ РёСЃРєР°Р» СЌР»РµРјРµРЅС‚ `level-stats-content`, РєРѕС‚РѕСЂС‹Р№ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ РІ HTML
- **Р”СѓР±Р»РёСЂРѕРІР°РЅРЅС‹Р№ РєРѕРґ**: РњРµС‚РѕРґ `countPlayerStartObjects()` РЅРµ РёСЃРїРѕР»СЊР·РѕРІР°Р»СЃСЏ

#### вњ… **Р РµС€РµРЅРёРµ:**
- **РќРѕРІС‹Р№ РјРµС‚РѕРґ `ensurePlayerStartExists()`**: РџСЂРѕРІРµСЂСЏРµС‚ Рё Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРѕР·РґР°РµС‚ Player Start
- **РРЅС‚РµРіСЂР°С†РёСЏ РІ `updateAllPanels()`**: Р”РѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ РїСЂРѕРІРµСЂРєРё РїСЂРё РєР°Р¶РґРѕРј РѕР±РЅРѕРІР»РµРЅРёРё
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РїСЂРѕРІРµСЂРєР°**: Р’ `updateCachedLevelStats()` Рё РїРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ
- **Р—Р°С‰РёС‚Р° РѕС‚ СЂРµРєСѓСЂСЃРёРё**: РСЃРєР»СЋС‡РµРЅРёРµ undo/redo РѕРїРµСЂР°С†РёР№ Рё РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ Р±РµСЃРєРѕРЅРµС‡РЅС‹С… С†РёРєР»РѕРІ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- РСЃРїРѕР»СЊР·СѓРµС‚ РєСЌС€РёСЂРѕРІР°РЅРЅСѓСЋ СЃС‚Р°С‚РёСЃС‚РёРєСѓ С‡РµСЂРµР· `GroupTraversalUtils.getAllObjects()`
- РЎРѕР·РґР°РµС‚ Player Start РІ РєРѕРѕСЂРґРёРЅР°С‚Р°С… (0,0) СЃ СЃС‚Р°РЅРґР°СЂС‚РЅС‹РјРё РїР°СЂР°РјРµС‚СЂР°РјРё
- Р›РѕРіРёСЂРѕРІР°РЅРёРµ СЃРѕР·РґР°РЅРёСЏ С‡РµСЂРµР· `Logger.lifecycle.info()`
- РћР±РЅРѕРІР»РµРЅРёРµ РёСЃС‚РѕСЂРёРё Рё РєСЌС€РµР№ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ

## [3.50.4] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ РѕС€РёР±РѕРє "message channel closed" РѕС‚ Р±СЂР°СѓР·РµСЂРЅС‹С… СЂР°СЃС€РёСЂРµРЅРёР№

#### рџЋЇ **РљРѕСЂРµРЅСЊ РїСЂРѕР±Р»РµРјС‹:**
- **File System Access API РєРѕРЅС„Р»РёРєС‚С‹**: Р‘СЂР°СѓР·РµСЂРЅС‹Рµ СЂР°СЃС€РёСЂРµРЅРёСЏ (Р±Р»РѕРєРёСЂРѕРІС‰РёРєРё СЂРµРєР»Р°РјС‹, СЃСЂРµРґСЃС‚РІР° Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё) РїСЂРµСЂС‹РІР°СЋС‚ СЃРѕРѕР±С‰РµРЅРёСЏ РјРµР¶РґСѓ РІРµР±-СЃС‚СЂР°РЅРёС†РµР№ Рё Р±СЂР°СѓР·РµСЂРѕРј
- **РћС‚СЃСѓС‚СЃС‚РІРёРµ С‚Р°Р№РјР°СѓС‚РѕРІ**: File System Access API РѕРїРµСЂР°С†РёРё РјРѕРіР»Рё Р·Р°РІРёСЃР°С‚СЊ РїСЂРё РєРѕРЅС„Р»РёРєС‚Р°С… СЃ СЂР°СЃС€РёСЂРµРЅРёСЏРјРё
- **Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°**: Р¤СѓРЅРєС†РёСЏ `isExtensionError` РґСѓР±Р»РёСЂРѕРІР°Р»Р°СЃСЊ РІ 4 С„Р°Р№Р»Р°С…

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР°**: РЎРѕР·РґР°РЅ `ExtensionErrorUtils.js` РґР»СЏ РµРґРёРЅРѕРіРѕ СѓРїСЂР°РІР»РµРЅРёСЏ РѕС€РёР±РєР°РјРё СЂР°СЃС€РёСЂРµРЅРёР№
- **РўР°Р№РјР°СѓС‚С‹ РґР»СЏ API**: Р”РѕР±Р°РІР»РµРЅС‹ С‚Р°Р№РјР°СѓС‚С‹ РґР»СЏ РІСЃРµС… File System Access API РѕРїРµСЂР°С†РёР№ (5-15 СЃРµРєСѓРЅРґ)
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёРµ fallback**: Graceful degradation РїСЂРё РєРѕРЅС„Р»РёРєС‚Р°С… СЃ СЂР°СЃС€РёСЂРµРЅРёСЏРјРё
- **Р“Р»РѕР±Р°Р»СЊРЅР°СЏ С„РёР»СЊС‚СЂР°С†РёСЏ**: РћР±СЂР°Р±РѕС‚С‡РёРєРё `window.addEventListener('error')` Рё `window.addEventListener('unhandledrejection')`

#### рџ“‹ **Р¤СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ:**
- вњ… **FolderPickerDialog**: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ fallback РЅР° input dialog РїСЂРё РєРѕРЅС„Р»РёРєС‚Р°С…
- вњ… **AssetPanel**: РџРѕРЅСЏС‚РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ РѕР± РѕС€РёР±РєР°С… СЃ РїСЂРµРґР»РѕР¶РµРЅРёРµРј РѕС‚РєР»СЋС‡РёС‚СЊ СЂР°СЃС€РёСЂРµРЅРёСЏ
- вњ… **FileUtils**: Fallback РЅР° download РјРµС‚РѕРґ РїСЂРё РїСЂРѕР±Р»РµРјР°С… СЃ File System Access API
- вњ… **Р“Р»РѕР±Р°Р»СЊРЅР°СЏ Р·Р°С‰РёС‚Р°**: Р¤РёР»СЊС‚СЂР°С†РёСЏ РѕС€РёР±РѕРє СЂР°СЃС€РёСЂРµРЅРёР№ РЅР° СѓСЂРѕРІРЅРµ РїСЂРёР»РѕР¶РµРЅРёСЏ

#### рџЋЁ **РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **DRY РїСЂРёРЅС†РёРї**: РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ ~100 СЃС‚СЂРѕРє РєРѕРґР°
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ Р»РѕРіРёРєР°**: Р’СЃРµ РїР°С‚С‚РµСЂРЅС‹ РѕС€РёР±РѕРє СЂР°СЃС€РёСЂРµРЅРёР№ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅС‹Р№ API**: РЎС‚Р°РЅРґР°СЂС‚РёР·РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹ РѕР±СЂР°Р±РѕС‚РєРё РѕС€РёР±РѕРє
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ**: Р•РґРёРЅР°СЏ С‚РѕС‡РєР° РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїР°С‚С‚РµСЂРЅРѕРІ РѕС€РёР±РѕРє

#### рџ“Љ **РљРѕРґ РёР·РјРµРЅРµРЅРёР№:**
```javascript
// ExtensionErrorUtils.js - Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР°
export class ExtensionErrorUtils {
    static EXTENSION_ERROR_PATTERNS = [
        'message channel closed',
        'extension context invalidated',
        'receiving end does not exist',
        // ... РґСЂСѓРіРёРµ РїР°С‚С‚РµСЂРЅС‹
    ];
    
    static withTimeout(operationPromise, timeoutMs, operation) {
        return Promise.race([operationPromise, this.createTimeoutPromise(timeoutMs, operation)]);
    }
    
    static async handleFileSystemError(error, fallbackFunction, context) {
        // РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє СЃ fallback
    }
}

// РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РІ РєРѕРјРїРѕРЅРµРЅС‚Р°С…
const directoryHandle = await ExtensionErrorUtils.withTimeout(
    window.showDirectoryPicker({ mode: 'read' }),
    10000,
    'Directory picker'
);
```

### Performance - РЈСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ Рє РєРѕРЅС„Р»РёРєС‚Р°Рј СЂР°СЃС€РёСЂРµРЅРёР№
- **РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ Р·Р°РІРёСЃР°РЅРёР№**: РўР°Р№РјР°СѓС‚С‹ Р·Р°С‰РёС‰Р°СЋС‚ РѕС‚ Р±РµСЃРєРѕРЅРµС‡РЅРѕРіРѕ РѕР¶РёРґР°РЅРёСЏ
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёРµ fallback**: Graceful degradation РїСЂРё РїСЂРѕР±Р»РµРјР°С… СЃ API
- **РЈР»СѓС‡С€РµРЅРЅС‹Р№ UX**: РџРѕРЅСЏС‚РЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ РѕР± РѕС€РёР±РєР°С… РґР»СЏ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
- **РћС‚РєР°Р·РѕСѓСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ**: РџСЂРёР»РѕР¶РµРЅРёРµ РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ РЅРµСЃРјРѕС‚СЂСЏ РЅР° РєРѕРЅС„Р»РёРєС‚С‹

## [3.50.3] - 2025-01-27

### Fixed - РџРѕР»РЅРѕРµ РёСЃРїСЂР°РІР»РµРЅРёРµ РґР°Р±Р»-РєР»РёРєР° СЂР°Р·РґРµР»РёС‚РµР»РµР№ РїР°РЅРµР»РµР№

#### рџЋЇ **РљРѕСЂРµРЅСЊ РїСЂРѕР±Р»РµРјС‹:**
- **Р‘Р»РѕРєРёСЂРѕРІРєР° СЃРѕР±С‹С‚РёР№**: `pointerEvents = 'none'` РІ mousedown Р±Р»РѕРєРёСЂРѕРІР°Р» РіРµРЅРµСЂР°С†РёСЋ click/dblclick СЃРѕР±С‹С‚РёР№
- **РџРѕСЂСЏРґРѕРє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё**: РћР±СЂР°Р±РѕС‚С‡РёРєРё РЅР°СЃС‚СЂР°РёРІР°Р»РёСЃСЊ РґРѕ СЃРѕР·РґР°РЅРёСЏ window.editor
- **РЈС‚РµС‡РєРё РїР°РјСЏС‚Рё**: РЎР»СѓС€Р°С‚РµР»Рё StateManager РЅРµ РѕС‚РјРµРЅСЏР»РёСЃСЊ РїСЂРё СѓРЅРёС‡С‚РѕР¶РµРЅРёРё

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **РЈР±СЂР°РЅР° Р±Р»РѕРєРёСЂРѕРІРєР°**: РЈРґР°Р»РµРЅРѕ `pointerEvents = 'none'` РёР· mousedown РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ
- **РџСЂР°РІРёР»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє**: setupPanelResizing() РІС‹Р·С‹РІР°РµС‚СЃСЏ РїРѕСЃР»Рµ СЃРѕР·РґР°РЅРёСЏ window.editor
- **РЈРїСЂР°РІР»РµРЅРёРµ РїРѕРґРїРёСЃРєР°РјРё**: Р”РѕР±Р°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ Рё РѕС‚РјРµРЅР° РїРѕРґРїРёСЃРѕРє StateManager РІ destroy()
- **РћС‡РёСЃС‚РєР° РєРѕРґР°**: РЈР±СЂР°РЅС‹ РІСЃРµ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ console.log, РѕСЃС‚Р°РІР»РµРЅС‹ С‚РѕР»СЊРєРѕ Logger РІС‹Р·РѕРІС‹

#### рџ“‹ **Р¤СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ:**
- вњ… **РџСЂР°РІС‹Р№ СЂР°Р·РґРµР»РёС‚РµР»СЊ**: Р”Р°Р±Р»-РєР»РёРє СЃРІРѕСЂР°С‡РёРІР°РµС‚/СЂР°Р·РІРѕСЂР°С‡РёРІР°РµС‚ РїСЂР°РІСѓСЋ РїР°РЅРµР»СЊ
- вњ… **РџР°РЅРµР»СЊ Р°СЃСЃРµС‚РѕРІ**: Р”Р°Р±Р»-РєР»РёРє СЃРІРѕСЂР°С‡РёРІР°РµС‚/СЂР°Р·РІРѕСЂР°С‡РёРІР°РµС‚ РЅРёР¶РЅСЋСЋ РїР°РЅРµР»СЊ
- вњ… **РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ**: StateManager в†” DOM в†” user preferences
- вњ… **РџРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ**: Р Р°Р±РѕС‚Р°РµС‚ Р±РµР· `pointerEvents = 'none'`
- вњ… **Р›РѕРіРёСЂРѕРІР°РЅРёРµ**: Logger.layout.info РїСЂРё РґРІРѕР№РЅРѕРј РєР»РёРєРµ

#### рџЋЁ **РђСЂС…РёС‚РµРєС‚СѓСЂРЅС‹Рµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РЈРїСЂР°РІР»РµРЅРёРµ РїР°РјСЏС‚СЊСЋ**: РџРѕРґРїРёСЃРєРё StateManager РїСЂР°РІРёР»СЊРЅРѕ РѕС‚РјРµРЅСЏСЋС‚СЃСЏ РІ destroy()
- **Р Р°Р·РґРµР»РµРЅРёРµ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё**: РћР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ в†” СЃР»СѓС€Р°С‚РµР»Рё StateManager в†” DOM
- **Consistency**: Р•РґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє СѓРїСЂР°РІР»РµРЅРёСЋ РїРѕРґРїРёСЃРєР°РјРё РІРѕ РІСЃРµС… РєРѕРјРїРѕРЅРµРЅС‚Р°С…
- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ**: РќРµС‚ СѓС‚РµС‡РµРє РїР°РјСЏС‚Рё РїСЂРё РїРµСЂРµСЃРѕР·РґР°РЅРёРё LevelEditor

#### рџ“Љ **РљРѕРґ РёР·РјРµРЅРµРЅРёР№:**
```javascript
// LevelEditor.js - РЈРїСЂР°РІР»РµРЅРёРµ РїРѕРґРїРёСЃРєР°РјРё
this.subscriptions = []; // Р’ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂРµ

// РЎРѕС…СЂР°РЅРµРЅРёРµ СЃСЃС‹Р»РѕРє РЅР° РѕС‚РїРёСЃРєСѓ
const unsubscribe = this.stateManager.subscribe('panels.rightPanelWidth', callback);
this.subscriptions.push(unsubscribe);

// РћС‚РјРµРЅР° РІ destroy()
this.subscriptions.forEach(unsubscribe => unsubscribe());
this.subscriptions = [];
```

### Performance - РћРїС‚РёРјРёР·Р°С†РёСЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РјСЏС‚СЊСЋ
- **РЈС‚РµС‡РєРё РїР°РјСЏС‚Рё**: РСЃРїСЂР°РІР»РµРЅС‹ СѓС‚РµС‡РєРё РїРѕРґРїРёСЃРѕРє StateManager
- **РџСЂР°РІРёР»СЊРЅРѕРµ СѓРЅРёС‡С‚РѕР¶РµРЅРёРµ**: Р’СЃРµ РїРѕРґРїРёСЃРєРё РѕС‚РјРµРЅСЏСЋС‚СЃСЏ РїСЂРё destroy()
- **РњР°СЃС€С‚Р°Р±РёСЂСѓРµРјРѕСЃС‚СЊ**: Р‘РµР·РѕРїР°СЃРЅРѕРµ РїРµСЂРµСЃРѕР·РґР°РЅРёРµ LevelEditor Р±РµР· РЅР°РєРѕРїР»РµРЅРёСЏ СЃР»СѓС€Р°С‚РµР»РµР№

## [3.50.2] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ СЃС‚РёР»РµР№ СЂР°Р·РґРµР»РёС‚РµР»РµР№

#### рџЋЁ **РСЃРїСЂР°РІР»РµРЅРёСЏ СЂР°Р·РґРµР»РёС‚РµР»РµР№:**
- **РћСЂРёРµРЅС‚Р°С†РёСЏ hover РёРЅРґРёРєР°С‚РѕСЂР°**: РСЃРїСЂР°РІР»РµРЅР° РѕСЂРёРµРЅС‚Р°С†РёСЏ РґР»СЏ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРіРѕ СЂР°Р·РґРµР»РёС‚РµР»СЏ (resizer-assets)
- **РџСЂРѕРїР°РІС€РёР№ hover СЌР»РµРјРµРЅС‚**: РСЃРїСЂР°РІР»РµРЅ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёР№ hover СЌР»РµРјРµРЅС‚ РґР»СЏ РІРµСЂС‚РёРєР°Р»СЊРЅРѕРіРѕ СЂР°Р·РґРµР»РёС‚РµР»СЏ РјРµР¶РґСѓ Content Рё Assets
- **РћРїС‚РёРјРёР·Р°С†РёСЏ CSS**: РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° РІ СЃС‚РёР»СЏС… СЂР°Р·РґРµР»РёС‚РµР»РµР№

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- РСЃРїСЂР°РІР»РµРЅС‹ СЂР°Р·РјРµСЂС‹ `.resizer-y::after` СЃ РІРµСЂС‚РёРєР°Р»СЊРЅС‹С… (2px Г— 20px) РЅР° РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Рµ (20px Г— 2px)
- Р”РѕР±Р°РІР»РµРЅС‹ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёРµ СЃС‚РёР»Рё РґР»СЏ РєР»Р°СЃСЃР° `.resizer-x` РІ AssetPanel
- РћР±РЅРѕРІР»РµРЅ JavaScript AssetPanel РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РєР»Р°СЃСЃР° `.resizing` РІРјРµСЃС‚Рѕ inline СЃС‚РёР»РµР№
- РћР±СЉРµРґРёРЅРµРЅС‹ РѕР±С‰РёРµ CSS СЃРІРѕР№СЃС‚РІР° РґР»СЏ СѓРјРµРЅСЊС€РµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РєРѕРґР°

## [3.50.1] - 2025-01-27

### Fixed - РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ СЃРєСЂРѕР»Р» РєРѕРЅСЃРѕР»Рё СЃ СѓРјРЅС‹Рј СѓРїСЂР°РІР»РµРЅРёРµРј

#### рџ“њ **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ СЃРєСЂРѕР»Р» РєРѕРЅСЃРѕР»Рё:**
- **РђРІС‚Рѕ-СЃРєСЂРѕР»Р» РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ**: РљРѕРЅСЃРѕР»СЊ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂРѕР»Р»РёС‚ Рє РїРѕСЃР»РµРґРЅРµР№ Р·Р°РїРёСЃРё
- **РЈРјРЅРѕРµ РїРѕРІРµРґРµРЅРёРµ**: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ РїСЂРё СЂСѓС‡РЅРѕРј СЃРєСЂРѕР»Р»Рµ РІРІРµСЂС…
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РІРєР»СЋС‡РµРЅРёРµ**: Р’РєР»СЋС‡Р°РµС‚СЃСЏ РїСЂРё СЃРєСЂРѕР»Р»Рµ Рє РЅРёР·Сѓ РєРѕРЅСЃРѕР»Рё
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Р№ СЃРєСЂРѕР»Р»**: РСЃРїРѕР»СЊР·СѓРµС‚ `requestAnimationFrame` РґР»СЏ РїР»Р°РІРЅРѕСЃС‚Рё

#### рџЋ›пёЏ **РЈРїСЂР°РІР»РµРЅРёРµ Р°РІС‚Рѕ-СЃРєСЂРѕР»Р»РѕРј:**
- **РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ**: РџСѓРЅРєС‚ "Toggle Auto Scroll" СЃ РёРєРѕРЅРєРѕР№ рџ“њ
- **РљРѕРЅСЃРѕР»СЊРЅР°СЏ РєРѕРјР°РЅРґР°**: `autoscroll` РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ СЂРµР¶РёРјР°
- **Р’РёР·СѓР°Р»СЊРЅР°СЏ РѕР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ**: РЎС‚Р°С‚СѓСЃ РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РІ Р»РѕРіР°С… РєРѕРЅСЃРѕР»Рё
- **РњРіРЅРѕРІРµРЅРЅС‹Р№ СЃРєСЂРѕР»Р»**: РџСЂРё РІРєР»СЋС‡РµРЅРёРё СЃСЂР°Р·Сѓ СЃРєСЂРѕР»Р»РёС‚ Рє РїРѕСЃР»РµРґРЅРµР№ Р·Р°РїРёСЃРё

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **РџСЂР°РІРёР»СЊРЅС‹Р№ СЌР»РµРјРµРЅС‚ СЃРєСЂРѕР»Р»Р°**: РСЃРїСЂР°РІР»РµРЅ СЃРєСЂРѕР»Р» РєРѕРЅС‚РµР№РЅРµСЂР° СЃ `overflow-y-auto`
- **Р‘РµР·РѕРїР°СЃРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР°**: Р—Р°С‰РёС‚Р° РѕС‚ РѕС€РёР±РѕРє СЃРєСЂРѕР»Р»Р° Рё СЂРµРєСѓСЂСЃРёРё
- **Р”РµС‚РµРєС†РёСЏ СЃРєСЂРѕР»Р»Р°**: РћС‚СЃР»РµР¶РёРІР°РЅРёРµ СЂСѓС‡РЅРѕРіРѕ СЃРєСЂРѕР»Р»Р° СЃ Р·Р°РґРµСЂР¶РєРѕР№ 150РјСЃ
- **РўРѕС‡РЅРѕСЃС‚СЊ РґРµС‚РµРєС†РёРё**: РџСЂРѕРІРµСЂРєР° РЅР°С…РѕР¶РґРµРЅРёСЏ РІРЅРёР·Сѓ СЃ РїРѕРіСЂРµС€РЅРѕСЃС‚СЊСЋ 5px

#### рџ“‹ **Р¤СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ:**
- **РџСЂРё РѕС‚РєСЂС‹С‚РёРё РєРѕРЅСЃРѕР»Рё**: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂРѕР»Р»РёС‚ Рє РїРѕСЃР»РµРґРЅРµР№ Р·Р°РїРёСЃРё
- **РџСЂРё РЅРѕРІС‹С… Р»РѕРіР°С…**: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРєСЂРѕР»Р»РёС‚ РµСЃР»Рё СЂРµР¶РёРј РІРєР»СЋС‡РµРЅ
- **РџСЂРё РІРєР»СЋС‡РµРЅРёРё Р°РІС‚Рѕ-СЃРєСЂРѕР»Р»Р°**: РњРіРЅРѕРІРµРЅРЅРѕ СЃРєСЂРѕР»Р»РёС‚ Рє РЅРёР·Сѓ
- **РџСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё**: РЎРєСЂРѕР»Р»РёС‚ РµСЃР»Рё РєРѕРЅСЃРѕР»СЊ СѓР¶Рµ РІРёРґРёРјР°

## [3.50.0] - 2025-01-27

### Added - РљРѕРјРїР°РєС‚РЅС‹Р№ Р»РµР№Р°СѓС‚ РґР»СЏ РїР°РЅРµР»Рё Details СЃ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹РјРё СЃРµРєС†РёСЏРјРё

#### рџЋЁ **РќРѕРІС‹Р№ РєРѕРјРїР°РєС‚РЅС‹Р№ РґРёР·Р°Р№РЅ РїР°РЅРµР»Рё Details:**
- **РЎС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Рµ СЃРµРєС†РёРё**: Basic Properties, Transforms, Visual, Advanced, Custom Properties, Layer Information
- **Р•РґРёРЅС‹Р№ СЃС‚РёР»СЊ**: Р’СЃРµ СЃРµРєС†РёРё РёСЃРїРѕР»СЊР·СѓСЋС‚ РѕРґРёРЅР°РєРѕРІС‹Р№ РґРёР·Р°Р№РЅ СЃ СЃРµСЂС‹Рј С„РѕРЅРѕРј Рё СЂР°РјРєР°РјРё
- **РљРѕРјРїР°РєС‚РЅС‹Рµ Transforms**: РџРѕР·РёС†РёРё X,Y Рё СЂР°Р·РјРµСЂС‹ W,H РІ РѕРґРЅРѕР№ СЃС‚СЂРѕРєРµ СЃ РїРѕРґРїРёСЃСЏРјРё СЃР»РµРІР°
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ**: РћРґРёРЅР°РєРѕРІС‹Р№ РїРѕСЂСЏРґРѕРє СЃРµРєС†РёР№ РІРѕ РІСЃРµС… СЂРµР¶РёРјР°С…

#### рџ“ђ **РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃРµРєС†РёСЏ Transforms:**
- **РљРѕРјРїР°РєС‚РЅС‹Рµ РїРѕР»СЏ**: X, Y, Width, Height РІ РґРІСѓС… СЃС‚СЂРѕРєР°С…
- **Р’РёР·СѓР°Р»СЊРЅС‹Рµ РїРѕРґРїРёСЃРё**: Р‘СѓРєРІС‹ X, Y, W, H СЃР»РµРІР° РѕС‚ РїРѕР»РµР№ РІРІРѕРґР°
- **Р•РґРёРЅРѕРѕР±СЂР°Р·РЅС‹Р№ СЃС‚РёР»СЊ**: РћРґРёРЅР°РєРѕРІС‹Р№ РґРёР·Р°Р№РЅ РґР»СЏ РѕРґРёРЅРѕС‡РЅС‹С… Рё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ
- **РЈРјРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР°**: РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ Р·РЅР°С‡РµРЅРёР№ РїСЂРё РёР·РјРµРЅРµРЅРёРё

#### рџ”§ **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ СЃРµРєС†РёРё:**
- **Basic Properties**: Name Рё Type РѕР±СЉРµРєС‚РѕРІ
- **Visual Properties**: Color picker СЃ РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂРѕРј
- **Advanced Properties**: Z-Index СЃ РїСЂР°РІРёР»СЊРЅРѕР№ РѕР±СЂР°Р±РѕС‚РєРѕР№ СЃР»РѕРµРІ
- **Custom Properties**: Р”РёРЅР°РјРёС‡РµСЃРєРѕРµ РґРѕР±Р°РІР»РµРЅРёРµ СЃРІРѕР№СЃС‚РІ СЃ РєРЅРѕРїРєРѕР№ "Add Property"
- **Layer Information**: РРЅС„РѕСЂРјР°С†РёСЏ Рѕ СЃР»РѕСЏС… СЃ С†РІРµС‚РѕРІС‹РјРё РёРЅРґРёРєР°С‚РѕСЂР°РјРё

#### рџЋЇ **РџРѕРґРґРµСЂР¶РєР° РІСЃРµС… СЂРµР¶РёРјРѕРІ:**
- **РћРґРёРЅРѕС‡РЅС‹Рµ РѕР±СЉРµРєС‚С‹**: РџРѕР»РЅС‹Р№ РЅР°Р±РѕСЂ СЃРµРєС†РёР№ СЃ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµРј
- **РњРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Р№ РІС‹Р±РѕСЂ**: РЈРјРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° СЂР°Р·РЅС‹С… Р·РЅР°С‡РµРЅРёР№ ("multiple values")
- **Р“СЂСѓРїРїС‹**: РЎС‚Р°С‚РёСЃС‚РёРєР° СЃРѕРґРµСЂР¶РёРјРѕРіРѕ + РІСЃРµ СЃРІРѕР№СЃС‚РІР° РіСЂСѓРїРїС‹
- **РЈСЂРѕРІРµРЅСЊ**: РЎС‚Р°С‚РёСЃС‚РёРєР° СѓСЂРѕРІРЅСЏ + РґРµР№СЃС‚РІРёСЏ (Set Camera Start Position)

#### вљЎ **РћРїС‚РёРјРёР·Р°С†РёСЏ РєРѕРґР°:**
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ**: РЎРѕР·РґР°РЅ РѕР±С‰РёР№ РјРµС‚РѕРґ `createTransformsSectionHTML()`
- **РЎРѕРєСЂР°С‰РµРЅРёРµ РєРѕРґР°**: РЈРґР°Р»РµРЅРѕ ~60 СЃС‚СЂРѕРє РґСѓР±Р»РёСЂРѕРІР°РЅРЅРѕРіРѕ HTML
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ**: РР·РјРµРЅРµРЅРёСЏ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ РІРµР·РґРµ
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°**: Р•РґРёРЅРѕРѕР±СЂР°Р·РЅС‹Рµ РјРµС‚РѕРґС‹ РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ

#### рџЋЁ **РЈР»СѓС‡С€РµРЅРёСЏ UX:**
- **РџСЂРµРґСЃРєР°Р·СѓРµРјС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ**: РЎРµРєС†РёРё РІСЃРµРіРґР° РІ РѕРґРЅРѕРј РїРѕСЂСЏРґРєРµ
- **Р’РёР·СѓР°Р»СЊРЅР°СЏ РёРµСЂР°СЂС…РёСЏ**: Р§РµС‚РєРѕРµ СЂР°Р·РґРµР»РµРЅРёРµ РЅР° Р»РѕРіРёС‡РµСЃРєРёРµ РіСЂСѓРїРїС‹
- **Р¦РІРµС‚РѕРІРѕРµ РєРѕРґРёСЂРѕРІР°РЅРёРµ**: РЎС‚Р°С‚РёСЃС‚РёРєР° СЃ С†РІРµС‚РЅС‹РјРё РёРЅРґРёРєР°С‚РѕСЂР°РјРё
- **РРЅС‚СѓРёС‚РёРІРЅР°СЏ РЅР°РІРёРіР°С†РёСЏ**: Р›РµРіРєРѕ РЅР°Р№С‚Рё РЅСѓР¶РЅС‹Рµ СЃРІРѕР№СЃС‚РІР°

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/DetailsPanel.js` - РџРѕР»РЅР°СЏ СЂРµСЃС‚СЂСѓРєС‚СѓСЂРёР·Р°С†РёСЏ СЃ РєРѕРјРїР°РєС‚РЅС‹Рј Р»РµР№Р°СѓС‚РѕРј
- `src/core/LevelEditor.js` - РћР±РЅРѕРІР»РµРЅР° РІРµСЂСЃРёСЏ РґРѕ 3.50.0

#### рџ”„ **РћР±СЂР°С‚РЅР°СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ:**
- вњ… Р’СЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ С„СѓРЅРєС†РёРё СЃРѕС…СЂР°РЅРµРЅС‹
- вњ… РћР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ СЂР°Р±РѕС‚Р°СЋС‚ РєР°Рє СЂР°РЅСЊС€Рµ
- вњ… РљР°СЃС‚РѕРјРЅС‹Рµ СЃРІРѕР№СЃС‚РІР° РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ РїРѕР»РЅРѕСЃС‚СЊСЋ
- вњ… Layer Information РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РєРѕСЂСЂРµРєС‚РЅРѕ

---

## [3.49.6] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ drag-n-drop Рё tab dragging РІ AssetPanel

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёРµ РєРѕРЅС„Р»РёРєС‚Р° drag-n-drop РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё С‚Р°Р±РѕРІ:**
- **РџСЂРѕР±Р»РµРјР°**: РџСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё С‚Р°Р±РѕРІ СЃСЂР°Р±Р°С‚С‹РІР°Р»Р° РїРѕРґСЃРІРµС‚РєР° drop РґР»СЏ С„Р°Р№Р»РѕРІ
- **РџСЂРёС‡РёРЅР°**: РљР»Р°СЃСЃ `drag-over` РёСЃРїРѕР»СЊР·РѕРІР°Р»СЃСЏ РєР°Рє РґР»СЏ С‚Р°Р±РѕРІ, С‚Р°Рє Рё РґР»СЏ drop РїРѕРґСЃРІРµС‚РєРё С„Р°Р№Р»РѕРІ
- **Р РµС€РµРЅРёРµ**: Р Р°Р·РґРµР»РµРЅС‹ РєР»Р°СЃСЃС‹ РЅР° `tab-drag-over` РґР»СЏ С‚Р°Р±РѕРІ Рё `drag-over` РґР»СЏ С„Р°Р№Р»РѕРІ

#### рџ”§ **РСЃРїСЂР°РІР»РµРЅРёРµ РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹С… РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№:**
- **РџСЂРѕР±Р»РµРјР°**: РћР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ РґРѕР±Р°РІР»СЏР»РёСЃСЊ РјРЅРѕРіРѕРєСЂР°С‚РЅРѕ РїСЂРё РєР°Р¶РґРѕРј СЂРµРЅРґРµСЂРµ С‚Р°Р±РѕРІ
- **РџСЂРёС‡РёРЅР°**: `setupTabDragging()` РІС‹Р·С‹РІР°Р»СЃСЏ РїСЂРё РєР°Р¶РґРѕРј `renderTabs()`
- **Р РµС€РµРЅРёРµ**: Р”РѕР±Р°РІР»РµРЅ С„Р»Р°Рі `tabDraggingSetup` РґР»СЏ РѕРґРЅРѕРєСЂР°С‚РЅРѕР№ РЅР°СЃС‚СЂРѕР№РєРё

#### вљ™пёЏ **РЈР»СѓС‡С€РµРЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ СЃРѕР±С‹С‚РёСЏРјРё:**
- **Tab dragging**: РЎРѕС…СЂР°РЅРµРЅРёРµ СЃСЃС‹Р»РѕРє РЅР° РѕР±СЂР°Р±РѕС‚С‡РёРєРё РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ cleanup
- **Folders resizer**: РСЃРїСЂР°РІР»РµРЅР° СѓС‚РµС‡РєР° РїР°РјСЏС‚Рё РїСЂРё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹С… РѕР±СЂР°Р±РѕС‚С‡РёРєР°С…
- **Drag-n-drop**: Р”РѕР±Р°РІР»РµРЅС‹ РїСЂРѕРІРµСЂРєРё РЅР° РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ С‚Р°Р±РѕРІ РІРѕ РІСЃРµС… drag РѕР±СЂР°Р±РѕС‚С‡РёРєР°С…

#### рџ—‚пёЏ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**
- **EventHandlers**: Р”РѕР±Р°РІР»РµРЅС‹ РїСЂРѕРІРµСЂРєРё `isDraggingTab` РІ MouseHandlers
- **AssetPanel**: Р Р°Р·РґРµР»РµРЅС‹ CSS РєР»Р°СЃСЃС‹ РґР»СЏ СЂР°Р·РЅС‹С… С‚РёРїРѕРІ drag РѕРїРµСЂР°С†РёР№
- **Cleanup**: РљРѕСЂСЂРµРєС‚РЅРѕРµ СѓРґР°Р»РµРЅРёРµ РІСЃРµС… РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РІ РјРµС‚РѕРґРµ `destroy()`

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/ui/AssetPanel.js` - РСЃРїСЂР°РІР»РµРЅС‹ drag-n-drop РєРѕРЅС„Р»РёРєС‚С‹ Рё РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Рµ РѕР±СЂР°Р±РѕС‚С‡РёРєРё
- `src/core/MouseHandlers.js` - Р”РѕР±Р°РІР»РµРЅС‹ РїСЂРѕРІРµСЂРєРё РЅР° tab dragging
- `styles/main.css` - Р Р°Р·РґРµР»РµРЅС‹ CSS РєР»Р°СЃСЃС‹ РґР»СЏ tab Рё file drag
- `index.html` - РћР±РЅРѕРІР»РµРЅС‹ РєР»Р°СЃСЃС‹ drag-over РґР»СЏ РїСЂР°РІРѕР№ РїР°РЅРµР»Рё
- `docs/CHANGELOG.md` - Р”РѕРєСѓРјРµРЅС‚РёСЂРѕРІР°РЅС‹ РёСЃРїСЂР°РІР»РµРЅРёСЏ

## [3.49.5] - 2025-01-27

### Added - РџРѕРґРґРµСЂР¶РєР° РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРї Рё СѓР»СѓС‡С€РµРЅРЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР°

#### рџЋЇ **РџРѕР»РЅР°СЏ РїРѕРґРґРµСЂР¶РєР° РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРї:**
- **Р’Р»РѕР¶РµРЅРЅРѕСЃС‚СЊ Р»СЋР±РѕРіРѕ СѓСЂРѕРІРЅСЏ**: Р“СЂСѓРїРїС‹ РјРѕРіСѓС‚ СЃРѕРґРµСЂР¶Р°С‚СЊ РґСЂСѓРіРёРµ РіСЂСѓРїРїС‹ Р±РµР· РѕРіСЂР°РЅРёС‡РµРЅРёР№
- **РљРѕСЂСЂРµРєС‚РЅРѕРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ**: РџСЂРё РѕС‚РєСЂС‹С‚РёРё РіСЂСѓРїРїС‹ РІСЃРµ РµС‘ РїРѕС‚РѕРјРєРё (РІРєР»СЋС‡Р°СЏ РІР»РѕР¶РµРЅРЅС‹Рµ) СЃС‚Р°РЅРѕРІСЏС‚СЃСЏ РІС‹Р±РёСЂР°РµРјС‹РјРё
- **РџСЂР°РІРёР»СЊРЅРѕРµ РїРµСЂРµРјРµС‰РµРЅРёРµ**: РћР±СЉРµРєС‚С‹ РІ РіСЂСѓРїРїР°С… Р»СЋР±РѕРіРѕ СѓСЂРѕРІРЅСЏ РІР»РѕР¶РµРЅРЅРѕСЃС‚Рё РєРѕСЂСЂРµРєС‚РЅРѕ РїРµСЂРµРјРµС‰Р°СЋС‚СЃСЏ

#### рџ”§ **РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РїРѕ РіР»СѓР±РёРЅРµ:**
- **РРµСЂР°СЂС…РёС‡РµСЃРєРёРµ РёРЅРґРµРєСЃС‹**: РћР±СЉРµРєС‚С‹ СЃРѕСЂС‚РёСЂСѓСЋС‚СЃСЏ РїРѕ РїРѕР»РЅС‹Рј РїСѓС‚СЏРј РІ РёРµСЂР°СЂС…РёРё РіСЂСѓРїРї (layer.groupPath.objectIndex)
- **РџСЂР°РІРёР»СЊРЅС‹Р№ z-order**: РћР±СЉРµРєС‚С‹ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РІ РїСЂР°РІРёР»СЊРЅРѕРј РїРѕСЂСЏРґРєРµ РґР°Р¶Рµ РІ РіР»СѓР±РѕРєРѕ РІР»РѕР¶РµРЅРЅС‹С… СЃС‚СЂСѓРєС‚СѓСЂР°С…
- **РЎРµР»РµРєС‚ РїРѕ РєР»РёРєСѓ**: РџСЂРё РєР»РёРєРµ РІС‹Р±РёСЂР°РµС‚СЃСЏ РѕР±СЉРµРєС‚ СЃ РЅР°РёРІС‹СЃС€РёРј z-index РІ РІРёРґРёРјРѕР№ РѕР±Р»Р°СЃС‚Рё

#### вљ™пёЏ **РЈР»СѓС‡С€РµРЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РіСЂСѓРїРїР°РјРё:**
- **Escape РєР»Р°РІРёС€Р°**: `Esc` С‚РµРїРµСЂСЊ СЃР±СЂР°СЃС‹РІР°РµС‚ РІС‹РґРµР»РµРЅРёРµ РѕР±СЉРµРєС‚РѕРІ (РµСЃР»Рё РЅРµС‚ Р°РєС‚РёРІРЅС‹С… РїСЂРѕС†РµСЃСЃРѕРІ), РѕС‚РјРµРЅСЏРµС‚ С‚РµРєСѓС‰РёРµ РґРµР№СЃС‚РІРёСЏ Рё Р·Р°РєСЂС‹РІР°РµС‚ СЂРµР¶РёРј СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РіСЂСѓРїРїС‹
- **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ**: РћР±РЅРѕРІР»РµРЅР° РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ РїРѕРґРґРµСЂР¶РєРµ РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРї

#### рџ—‚пёЏ **РћРїС‚РёРјРёР·Р°С†РёСЏ РёРЅС‚РµСЂС„РµР№СЃР°:**
- **РЈРґР°Р»РµРЅР° Р·Р°РєР»Р°РґРєР° Level**: РЎС‚Р°С‚РёСЃС‚РёРєР° СѓСЂРѕРІРЅСЏ С‚РµРїРµСЂСЊ РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ РІ РїР°РЅРµР»Рё Details РєРѕРіРґР° РЅРёС‡РµРіРѕ РЅРµ РІС‹Р±СЂР°РЅРѕ
- **РРЅС‚РµРіСЂРёСЂРѕРІР°РЅРЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ**: РџР°РЅРµР»СЊ Details РѕР±СЉРµРґРёРЅСЏРµС‚ СЃРІРѕР№СЃС‚РІР° РѕР±СЉРµРєС‚РѕРІ Рё СЃС‚Р°С‚РёСЃС‚РёРєСѓ СѓСЂРѕРІРЅСЏ

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/models/Level.js` - Р”РѕР±Р°РІР»РµРЅС‹ С„СѓРЅРєС†РёРё `buildFullObjectIndex()`, `buildObjectPath()`, `isObjectInAnyGroup()`
- `src/core/ObjectOperations.js` - РћР±РЅРѕРІР»РµРЅР° Р»РѕРіРёРєР° СЃРѕСЂС‚РёСЂРѕРІРєРё Рё СЃРµР»РµРєС‚Р° РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїР°С…
- `src/core/MouseHandlers.js` - РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РїРµСЂРµРјРµС‰РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїР°С… Р»СЋР±РѕРіРѕ СѓСЂРѕРІРЅСЏ
- `src/core/EventHandlers.js` - Р”РѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° Escape РґР»СЏ Р·Р°РєСЂС‹С‚РёСЏ РіСЂСѓРїРї
- `src/core/LevelEditor.js` - РЈРґР°Р»РµРЅ РІС‹Р·РѕРІ updateLevelStatsPanel()
- `src/ui/DetailsPanel.js` - Р”РѕР±Р°РІР»РµРЅР° СЃС‚Р°С‚РёСЃС‚РёРєР° СѓСЂРѕРІРЅСЏ РІ СЂРµР¶РёРјРµ "РЅРёС‡РµРіРѕ РЅРµ РІС‹Р±СЂР°РЅРѕ"
- `index.html` - РЈРґР°Р»РµРЅР° Р·Р°РєР»Р°РґРєР° Level РёР· РёРЅС‚РµСЂС„РµР№СЃР°
- `docs/QUICK_START.md` - РћР±РЅРѕРІР»РµРЅР° РёРЅС„РѕСЂРјР°С†РёСЏ Рѕ РіРѕСЂСЏС‡РёС… РєР»Р°РІРёС€Р°С…
- `docs/USER_MANUAL.md` - РћР±РЅРѕРІР»РµРЅРѕ РѕРїРёСЃР°РЅРёРµ РїР°РЅРµР»Рё Details

## [3.49.4] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ Р»РѕРіРёРєРё РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РґСѓР±Р»РёРєР°С‚РѕРІ

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёРµ СЂР°СЃС‡РµС‚Р° offset РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РІРЅСѓС‚СЂРё РіСЂСѓРїРї:**
- **РџСЂРѕР±Р»РµРјР°**: Р”СѓР±Р»РёРєР°С‚С‹ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°Р»РёСЃСЊ РЅРµ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј РёР·-Р·Р° РЅРµРїСЂР°РІРёР»СЊРЅРѕРіРѕ СЂР°СЃС‡РµС‚Р° offset
- **РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР°**: `DuplicateUtils.initializePositions()` РёСЃРїРѕР»СЊР·РѕРІР°Р» `getObjectWorldPosition()` РІРјРµСЃС‚Рѕ СЂСѓС‡РЅРѕРіРѕ СЂР°СЃС‡РµС‚Р° РєРѕРѕСЂРґРёРЅР°С‚
- **Р РµС€РµРЅРёРµ**: РџСЂРёРјРµРЅРµРЅР° С‚Р° Р¶Рµ Р»РѕРіРёРєР°, С‡С‚Рѕ Рё РІ `MouseHandlers.dragSelectedObjects` РґР»СЏ Alt+drag

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **DuplicateUtils.initializePositions**: РўРµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ `groupWorldPos.x + obj.x` РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РІРЅСѓС‚СЂРё РіСЂСѓРїРї
- **DuplicateOperations.confirmPlacement**: Р”РѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° `wasInGroup` РґР»СЏ РїСЂР°РІРёР»СЊРЅРѕР№ РєРѕРЅРІРµСЂС‚Р°С†РёРё РєРѕРѕСЂРґРёРЅР°С‚
- **РћС‚СЃР»РµР¶РёРІР°РЅРёРµ РѕСЂРёРіРёРЅР°Р»СЊРЅС‹С… РѕР±СЉРµРєС‚РѕРІ**: Р”РѕР±Р°РІР»РµРЅРѕ `duplicate.originalObjects` РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё Рє РіСЂСѓРїРїРµ

#### рџ“Ѓ **РР·РјРµРЅРµРЅРЅС‹Рµ С„Р°Р№Р»С‹:**
- `src/utils/DuplicateUtils.js` - РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° СЂР°СЃС‡РµС‚Р° offset
- `src/core/DuplicateOperations.js` - Р”РѕР±Р°РІР»РµРЅРѕ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ originalObjects
- `src/core/LevelEditor.js` - Р’РµСЂСЃРёСЏ 3.49.4

## [3.49.3] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РґСѓР±Р»РёРєР°С‚РѕРІ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РіСЂСѓРїРї

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РІРЅРµС€РЅРёС… РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїР°С…:**
- **РџСЂРѕР±Р»РµРјР°**: РџСЂРё Alt+click+drag РІРЅРµС€РЅРёС… РѕР±СЉРµРєС‚РѕРІ РІ РѕС‚РєСЂС‹С‚РѕР№ РіСЂСѓРїРїРµ РґСѓР±Р»РёРєР°С‚С‹ РїРѕР»СѓС‡Р°Р»Рё РЅРµРїСЂР°РІРёР»СЊРЅСѓСЋ РїРѕР·РёС†РёСЋ
- **РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР°**: `DuplicateUtils.initializePositions()` РІСЃРµРіРґР° РїСЂРёРјРµРЅСЏР» РіСЂСѓРїРїРѕ-РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РіСЂСѓРїРї
- **Р РµС€РµРЅРёРµ**: Р”РѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё РѕР±СЉРµРєС‚Р° Рє Р°РєС‚РёРІРЅРѕР№ РіСЂСѓРїРїРµ
- **Р РµР·СѓР»СЊС‚Р°С‚**: Р’РЅРµС€РЅРёРµ РѕР±СЉРµРєС‚С‹ РєРѕСЂСЂРµРєС‚РЅРѕ РґСѓР±Р»РёСЂСѓСЋС‚СЃСЏ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј, РѕР±СЉРµРєС‚С‹ РІРЅСѓС‚СЂРё РіСЂСѓРїРїС‹ СЃРѕС…СЂР°РЅСЏСЋС‚ РіСЂСѓРїРїРѕ-РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕРµ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **DuplicateUtils.js**: Р”РѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° `isObjectInGroupRecursive(obj, activeGroup)` РІ `initializePositions()`
- **Р›РѕРіРёРєР° РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ**: Р Р°Р·РґРµР»РµРЅР° РЅР° РґРІР° СЃР»СѓС‡Р°СЏ - РІРЅСѓС‚СЂРµРЅРЅРёРµ Рё РІРЅРµС€РЅРёРµ РѕР±СЉРµРєС‚С‹ РіСЂСѓРїРїС‹
- **РћР±СЂР°С‚РЅР°СЏ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ**: Р’СЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ СЃС†РµРЅР°СЂРёРё РїСЂРѕРґРѕР»Р¶Р°СЋС‚ СЂР°Р±РѕС‚Р°С‚СЊ

#### рџ“‹ **Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ С„Р°Р№Р»С‹:**
- **DuplicateUtils.js**: РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РёРЅРёС†РёР°Р»РёР·Р°С†РёРё РїРѕР·РёС†РёР№ РґСѓР±Р»РёРєР°С‚РѕРІ

#### рџ”Ќ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **РџСЂРѕРІРµСЂРєР° РїСЂРёРЅР°РґР»РµР¶РЅРѕСЃС‚Рё**: РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `editor.objectOperations.isObjectInGroupRecursive(obj, activeGroup)`
- **РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РІРЅСѓС‚СЂРµРЅРЅРёС… РѕР±СЉРµРєС‚РѕРІ**: `groupWorldPos.x + obj.x, groupWorldPos.y + obj.y`
- **РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РІРЅРµС€РЅРёС… РѕР±СЉРµРєС‚РѕРІ**: `editor.objectOperations.getObjectWorldPosition(obj)`
- **РЎРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ**: РЎРѕС…СЂР°РЅРµРЅР° РїРѕРґРґРµСЂР¶РєР° parallax Рё РІСЃРµС… СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… СЂРµР¶РёРјРѕРІ

## [3.49.2] - 2025-01-27

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ СЃРµР»РµРєС†РёРё РѕР±СЉРµРєС‚РѕРІ Рё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ РІ РіСЂСѓРїРїС‹

#### рџЋЇ **РСЃРїСЂР°РІР»РµРЅРёРµ РїСЂРёРѕСЂРёС‚РµС‚Р° СЃРµР»РµРєС†РёРё РіСЂСѓРїРї:**
- **РџСЂРѕР±Р»РµРјР°**: Р“СЂСѓРїРїС‹ РёРјРµР»Рё РёСЃРєСѓСЃСЃС‚РІРµРЅРЅС‹Р№ РїСЂРёРѕСЂРёС‚РµС‚ РЅР°Рґ РѕР±С‹С‡РЅС‹РјРё РѕР±СЉРµРєС‚Р°РјРё РїСЂРё СЃРµР»РµРєС†РёРё, РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ zIndex
- **Р РµС€РµРЅРёРµ**: Р’СЃРµ РѕР±СЉРµРєС‚С‹ (РіСЂСѓРїРїС‹ Рё РѕР±С‹С‡РЅС‹Рµ) С‚РµРїРµСЂСЊ РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ РїРѕ zIndex РїСЂРё СЃРµР»РµРєС†РёРё
- **Р РµР·СѓР»СЊС‚Р°С‚**: Р’С‹Р±РёСЂР°РµС‚СЃСЏ РѕР±СЉРµРєС‚ СЃ РјР°РєСЃРёРјР°Р»СЊРЅС‹Рј zIndex (РїРµСЂРµРґРЅРёР№ РїР»Р°РЅ) РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ С‚РёРїР°

#### рџ”§ **РСЃРїСЂР°РІР»РµРЅРёРµ С„Р°РЅС‚РѕРјРЅС‹С… РѕР±СЉРµРєС‚РѕРІ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РІ РіСЂСѓРїРїС‹:**
- **РџСЂРѕР±Р»РµРјР°**: РџСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РѕР±СЉРµРєС‚РѕРІ РІ РѕС‚РєСЂС‹С‚С‹Рµ РіСЂСѓРїРїС‹ РїРѕСЏРІР»СЏР»РёСЃСЊ РєСЂР°С‚РєРѕРІСЂРµРјРµРЅРЅС‹Рµ С„Р°РЅС‚РѕРјС‹
- **РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР°**: РќРµРїСЂР°РІРёР»СЊРЅС‹Р№ РїРѕСЂСЏРґРѕРє РѕРїРµСЂР°С†РёР№ Рё РѕС‚СЃСѓС‚СЃС‚РІРёРµ РёРЅРІР°Р»РёРґР°С†РёРё РєРµС€РµР№
- **Р РµС€РµРЅРёРµ**: 
  - РРЅРІР°Р»РёРґР°С†РёСЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° Р”Рћ РїРµСЂРµРјРµС‰РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ
  - РћС‡РёСЃС‚РєР° РєРµС€РµР№ СЌС„С„РµРєС‚РёРІРЅРѕРіРѕ СЃР»РѕСЏ РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ С„Р°РЅС‚РѕРјРЅС‹С… СЃСЃС‹Р»РѕРє
  - РћС‚Р»РѕР¶РµРЅРЅС‹Р№ СЂРµРЅРґРµСЂРёРЅРі РґРѕ Р·Р°РІРµСЂС€РµРЅРёСЏ РІСЃРµС… РѕРїРµСЂР°С†РёР№ РїРµСЂРµРјРµС‰РµРЅРёСЏ

#### рџљЂ **РЈР»СѓС‡С€РµРЅРёСЏ Р°СЂС…РёС‚РµРєС‚СѓСЂС‹:**
- **DRY РїСЂРёРЅС†РёРї**: РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° СЃРѕСЂС‚РёСЂРѕРІРєРё РїРѕ zIndex
- **РћРїС‚РёРјРёР·Р°С†РёСЏ**: РЎРѕР·РґР°РЅР° РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ `_sortObjectsByZIndexDescending()`
- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ**: РЈР±СЂР°РЅС‹ РёР·Р±С‹С‚РѕС‡РЅС‹Рµ РѕРїРµСЂР°С†РёРё РѕС‡РёСЃС‚РєРё РєРµС€РµР№

#### рџ“‹ **Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ С„Р°Р№Р»С‹:**
- **ObjectOperations.js**: РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° СЃРµР»РµРєС†РёРё, СѓР±СЂР°РЅ РїСЂРёРѕСЂРёС‚РµС‚ РіСЂСѓРїРї
- **MouseHandlers.js**: РСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РѕРїРµСЂР°С†РёР№ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РІ РіСЂСѓРїРїС‹
- **DuplicateOperations.js**: Р”РѕР±Р°РІР»РµРЅ РёРјРїРѕСЂС‚ Logger РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ СЂР°Р±РѕС‚С‹

#### рџ”Ќ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **РЎРµР»РµРєС†РёСЏ**: Р’СЃРµ РѕР±СЉРµРєС‚С‹ РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ РІРјРµСЃС‚Рµ РїРѕ zIndex РІ РїРѕСЂСЏРґРєРµ СѓР±С‹РІР°РЅРёСЏ
- **РџРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ**: РћР±СЉРµРєС‚ СЃРЅР°С‡Р°Р»Р° РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РІ РіСЂСѓРїРїСѓ, РїРѕС‚РѕРј СѓРґР°Р»СЏРµС‚СЃСЏ РёР· РѕСЃРЅРѕРІРЅРѕРіРѕ СѓСЂРѕРІРЅСЏ
- **РљРµС€РёСЂРѕРІР°РЅРёРµ**: РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ `clearEffectiveLayerCacheForObject()` РІРјРµСЃС‚Рѕ РѕР±С‰РµР№ РѕС‡РёСЃС‚РєРё РєРµС€РµР№
- **Р РµРЅРґРµСЂРёРЅРі**: Р”РѕР±Р°РІР»РµРЅ С„Р»Р°Рі `objectsMovedToGroup` РґР»СЏ РѕС‚Р»РѕР¶РµРЅРЅРѕРіРѕ СЂРµРЅРґРµСЂРёРЅРіР°

## [3.49.1] - 2025-01-27

### Fixed - РљСЂРёС‚РёС‡РµСЃРєРѕРµ РёСЃРїСЂР°РІР»РµРЅРёРµ С„Р°РЅС‚РѕРјРЅС‹С… РѕР±СЉРµРєС‚РѕРІ РїСЂРё РіСЂСѓРїРїРёСЂРѕРІРєРµ

#### рџ”§ **РСЃРїСЂР°РІР»РµРЅРёРµ РїСЂРѕР±Р»РµРјС‹ С„Р°РЅС‚РѕРјРЅС‹С… РєРѕРїРёР№ Р°СЃСЃРµС‚РѕРІ:**
- **РљРѕСЂРЅРµРІР°СЏ РїСЂРёС‡РёРЅР°**: `collectVisibleObjectsRecursive()` СЂРµРєСѓСЂСЃРёРІРЅРѕ РґРѕР±Р°РІР»СЏР»Р° РґРµС‚РµР№ РіСЂСѓРїРї РєР°Рє РѕС‚РґРµР»СЊРЅС‹Рµ РѕР±СЉРµРєС‚С‹ РґР»СЏ СЂРµРЅРґРµСЂРёРЅРіР°
- **Р РµР·СѓР»СЊС‚Р°С‚**: С„Р°РЅС‚РѕРјРЅС‹Рµ РєРѕРїРёРё РѕС‚РѕР±СЂР°Р¶Р°Р»РёСЃСЊ РЅР° РєР°РЅРІРµ РїРѕСЃР»Рµ РіСЂСѓРїРїРёСЂРѕРІРєРё - РґРµС‚Рё РіСЂСѓРїРї СЂРµРЅРґРµСЂРёР»РёСЃСЊ РґРІР°Р¶РґС‹
- **Р РµС€РµРЅРёРµ**: СѓСЃС‚СЂР°РЅРµРЅРёРµ СЂРµРєСѓСЂСЃРёРІРЅРѕРіРѕ РѕР±С…РѕРґР° РґРµС‚РµР№ РіСЂСѓРїРї РІ `collectVisibleObjectsRecursive()`

#### рџЋЇ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёСЃРїСЂР°РІР»РµРЅРёСЏ:**
- **RenderOperations.js**: СѓСЃС‚СЂР°РЅРµРЅ СЂРµРєСѓСЂСЃРёРІРЅС‹Р№ РѕР±С…РѕРґ РґРµС‚РµР№ РіСЂСѓРїРї РІ `collectVisibleObjectsRecursive()`
- **GroupOperations.js**: РґРѕР±Р°РІР»РµРЅР° РїРѕР»РЅР°СЏ РѕС‡РёСЃС‚РєР° РєРµС€РµР№ Рё РёРЅРІР°Р»РёРґР°С†РёСЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР°
- **РџСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅС‹Р№ РёРЅРґРµРєСЃ**: СѓР»СѓС‡С€РµРЅР° РёРЅРІР°Р»РёРґР°С†РёСЏ РёРЅРґРµРєСЃР° РґРѕ Рё РїРѕСЃР»Рµ РіСЂСѓРїРїРёСЂРѕРІРєРё
- **РљРµС€РёСЂРѕРІР°РЅРёРµ**: РґРѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ `clearCaches()` Рё `invalidateObjectCaches()` РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ С„Р°РЅС‚РѕРјРЅС‹С… СЃСЃС‹Р»РѕРє

#### рџљЂ **РЈР»СѓС‡С€РµРЅРёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё:**
- **РЈРјРЅР°СЏ РёРЅРІР°Р»РёРґР°С†РёСЏ**: РїРµСЂРµСЃС‚СЂРѕР№РєР° С‚РѕР»СЊРєРѕ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° РІРјРµСЃС‚Рѕ РїРѕР»РЅРѕР№ РѕС‡РёСЃС‚РєРё РІСЃРµС… РєРµС€РµР№
- **РћРїС‚РёРјРёР·Р°С†РёСЏ**: `buildSpatialIndex()` РІС‹Р·С‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё
- **РќР°РґРµР¶РЅРѕСЃС‚СЊ**: fallback РЅР° РѕР±С‹С‡РЅС‹Р№ РјРµС‚РѕРґ РїРѕРёСЃРєР° РїСЂРё РїСЂРѕР±Р»РµРјР°С… СЃ РёРЅРґРµРєСЃРѕРј

#### рџ“‹ **Р—Р°С‚СЂРѕРЅСѓС‚С‹Рµ РјРµС‚РѕРґС‹:**
- `RenderOperations.collectVisibleObjectsRecursive()` - СѓСЃС‚СЂР°РЅРµРЅ СЂРµРєСѓСЂСЃРёРІРЅС‹Р№ РѕР±С…РѕРґ РґРµС‚РµР№ РіСЂСѓРїРї
- `GroupOperations.groupSelectedObjects()` - РґРѕР±Р°РІР»РµРЅР° РѕС‡РёСЃС‚РєР° РєРµС€РµР№ Рё РёРЅРІР°Р»РёРґР°С†РёСЏ РёРЅРґРµРєСЃРѕРІ
- `RenderOperations.invalidateSpatialIndex()` - РёРЅРІР°Р»РёРґР°С†РёСЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° РґРѕ РіСЂСѓРїРїРёСЂРѕРІРєРё
- `RenderOperations.buildSpatialIndex()` - РїРµСЂРµСЃС‚СЂРѕР№РєР° РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° РїРѕСЃР»Рµ РіСЂСѓРїРїРёСЂРѕРІРєРё

## [3.49.0] - 2025-10-14

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ РІ СЃРёСЃС‚РµРјРµ РёРЅРґРµРєСЃРѕРІ РіР»СѓР±РёРЅС‹ Рё СЂРµРЅРґРµСЂРёРЅРіР°

#### рџ”§ **РСЃРїСЂР°РІР»РµРЅРёРµ РїСЂРёСЃРІР°РёРІР°РЅРёСЏ zIndex РѕР±СЉРµРєС‚Р°Рј:**
- **РЈСЃС‚СЂР°РЅРµРЅР° РѕС€РёР±РєР°**: РѕР±СЉРµРєС‚С‹ РЅРµ РїРѕР»СѓС‡Р°Р»Рё РєРѕСЂСЂРµРєС‚РЅС‹Р№ zIndex РїСЂРё РґРѕР±Р°РІР»РµРЅРёРё РІ СѓСЂРѕРІРµРЅСЊ
- **РњРµС‚РѕРґ `assignInitialZIndex()`**: РЅРѕРІС‹Р№ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ РјРµС‚РѕРґ РґР»СЏ РїСЂРёСЃРІР°РёРІР°РЅРёСЏ zIndex РЅРѕРІС‹Рј РѕР±СЉРµРєС‚Р°Рј
- **РџСЂР°РІРёР»СЊРЅР°СЏ РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ**: СЃРЅР°С‡Р°Р»Р° `getNextZIndex()`, РїРѕС‚РѕРј `assignObjectToLayer()` РґР»СЏ РєРѕСЂСЂРµРєС†РёРё layer index
- **РћР±СЉРµРєС‚С‹ РІ РіСЂСѓРїРїР°С…**: РёСЃРїСЂР°РІР»РµРЅРѕ РїСЂРёСЃРІР°РёРІР°РЅРёРµ zIndex РґР»СЏ РѕР±СЉРµРєС‚РѕРІ, РґРѕР±Р°РІР»СЏРµРјС‹С… РІ РіСЂСѓРїРїС‹

#### рџЋЁ **РЈР»СѓС‡С€РµРЅРёРµ СЂРµРЅРґРµСЂРёРЅРіР° Рё СЃРѕСЂС‚РёСЂРѕРІРєРё РѕР±СЉРµРєС‚РѕРІ:**
- **Р РµРєСѓСЂСЃРёРІРЅС‹Р№ СЃР±РѕСЂ РѕР±СЉРµРєС‚РѕРІ**: РЅРѕРІС‹Р№ РјРµС‚РѕРґ `collectVisibleObjectsRecursive()` РґР»СЏ СЃР±РѕСЂР° РІСЃРµС… РІРёРґРёРјС‹С… РѕР±СЉРµРєС‚РѕРІ РІРєР»СЋС‡Р°СЏ РІР»РѕР¶РµРЅРЅС‹Рµ РІ РіСЂСѓРїРїС‹
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ**: СѓРЅРёС„РёС†РёСЂРѕРІР°РЅР° Р»РѕРіРёРєР° СЃР±РѕСЂР° РѕР±СЉРµРєС‚РѕРІ РІ `getVisibleObjectsRegular()` Рё `getVisibleObjectsSpatial()`
- **РџСЂР°РІРёР»СЊРЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР°**: РѕР±СЉРµРєС‚С‹ РІРЅСѓС‚СЂРё РіСЂСѓРїРї С‚РµРїРµСЂСЊ РїСЂР°РІРёР»СЊРЅРѕ СЃРѕСЂС‚РёСЂСѓСЋС‚СЃСЏ РїРѕ zIndex
- **РљРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ**: РµРґРёРЅР°СЏ Р»РѕРіРёРєР° РґР»СЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° Рё РѕР±С‹С‡РЅРѕРіРѕ РјРµС‚РѕРґР°

#### рџ§№ **Р РµС„Р°РєС‚РѕСЂРёРЅРі РєРѕРґР°:**
- **РЈСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ**: СѓРґР°Р»РµРЅР° РїРѕРІС‚РѕСЂСЏСЋС‰Р°СЏСЃСЏ Р»РѕРіРёРєР° РїСЂРёСЃРІР°РёРІР°РЅРёСЏ zIndex
- **РЈР»СѓС‡С€РµРЅРЅР°СЏ РїРѕРґРґРµСЂР¶РёРІР°РµРјРѕСЃС‚СЊ**: РёР·РјРµРЅРµРЅРёСЏ РІ Р»РѕРіРёРєРµ zIndex С‚РµРїРµСЂСЊ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **Р§РёС‰Рµ Р°СЂС…РёС‚РµРєС‚СѓСЂР°**: СЂР°Р·РґРµР»РµРЅРёРµ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕСЃС‚Рё РјРµР¶РґСѓ РјРµС‚РѕРґР°РјРё

#### рџЋЇ **РўРµС…РЅРёС‡РµСЃРєРёРµ РґРµС‚Р°Р»Рё:**
- **Level.js**: РґРѕР±Р°РІР»РµРЅ `assignInitialZIndex()` РґР»СЏ СѓРЅРёС„РёРєР°С†РёРё РїСЂРёСЃРІР°РёРІР°РЅРёСЏ zIndex
- **RenderOperations.js**: РґРѕР±Р°РІР»РµРЅ `collectVisibleObjectsRecursive()` РґР»СЏ СЂРµРєСѓСЂСЃРёРІРЅРѕРіРѕ СЃР±РѕСЂР° РѕР±СЉРµРєС‚РѕРІ
- **MouseHandlers.js**: СѓРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° РґСЂРѕРїР° РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїС‹
- **РСЃРїСЂР°РІР»РµРЅС‹ edge cases**: РїСЂР°РІРёР»СЊРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїР°С… Рё РѕР±С‹С‡РЅС‹С… РѕР±СЉРµРєС‚РѕРІ

### Added - РќРµР·РЅР°С‡РёС‚РµР»СЊРЅС‹Рµ СѓР»СѓС‡С€РµРЅРёСЏ

#### рџ“љ **РћР±РЅРѕРІР»РµРЅРёРµ РґРѕРєСѓРјРµРЅС‚Р°С†РёРё:**
- РЎРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅС‹ РІРµСЂСЃРёРё РІРѕ РІСЃРµС… С„Р°Р№Р»Р°С… РґРѕРєСѓРјРµРЅС‚Р°С†РёРё
- РћР±РЅРѕРІР»РµРЅРѕ РѕРїРёСЃР°РЅРёРµ API РјРµС‚РѕРґРѕРІ РІ `API_REFERENCE.md`

## [3.48.0] - 2025-10-14

### Added - Р Р°СЃС€РёСЂРµРЅРЅР°СЏ СЃРёСЃС‚РµРјР° С†РІРµС‚РѕРІС‹С… РЅР°СЃС‚СЂРѕРµРє РёРЅС‚РµСЂС„РµР№СЃР°

#### рџЋЁ **РќРѕРІС‹Р№ СЂР°Р·РґРµР» Colors РІ РЅР°СЃС‚СЂРѕР№РєР°С…**

**UI Colors - Р¦РІРµС‚Р° РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРѕРіРѕ РёРЅС‚РµСЂС„РµР№СЃР°:**
- **UI Background** - С†РІРµС‚ С„РѕРЅР° РёРЅС‚РµСЂС„РµР№СЃР° (`ui.backgroundColor`)
- **UI Text Color** - С†РІРµС‚ С‚РµРєСЃС‚Р° РІ РёРЅС‚РµСЂС„РµР№СЃРµ (`ui.textColor`)
- **Active Elements** - С†РІРµС‚ Р°РєС‚РёРІРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ (`ui.activeColor`)
- **Active Text Color** - С†РІРµС‚ С‚РµРєСЃС‚Р° Р°РєС‚РёРІРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ (`ui.activeTextColor`)
- **Active Tab Color** - С†РІРµС‚ Р°РєС‚РёРІРЅС‹С… РІРєР»Р°РґРѕРє (`ui.activeTabColor`)
- **Accent Color** - С†РІРµС‚ Р°РєС†РµРЅС‚РѕРІ (`ui.accentColor`)

**Canvas Colors - Р¦РІРµС‚Р° СЂР°Р±РѕС‡РµР№ РѕР±Р»Р°СЃС‚Рё:**
- **Canvas Background** - С†РІРµС‚ С„РѕРЅР° РєР°РЅРІС‹ (`canvas.backgroundColor`)
- **Grid Color** - С†РІРµС‚ Р»РёРЅРёР№ СЃРµС‚РєРё (`canvas.gridColor`)
- **Grid Subdivision** - С†РІРµС‚ РІСЃРїРѕРјРѕРіР°С‚РµР»СЊРЅС‹С… Р»РёРЅРёР№ СЃРµС‚РєРё (`canvas.gridSubdivColor`)

**Selection Colors - Р¦РІРµС‚Р° РІС‹РґРµР»РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ:**
- **Selection Outline** - С†РІРµС‚ СЂР°РјРєРё РІС‹РґРµР»РµРЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ (`selection.outlineColor`)
- **Group Outline** - С†РІРµС‚ СЂР°РјРєРё РІС‹РґРµР»РµРЅРЅС‹С… РіСЂСѓРїРї (`selection.groupOutlineColor`)
- **Marquee Selection** - С†РІРµС‚ СЂР°РјРєРё РІС‹РґРµР»РµРЅРёСЏ РјС‹С€СЊСЋ (`selection.marqueeColor`)
- **Hierarchy Highlight** - С†РІРµС‚ РїРѕРґСЃРІРµС‚РєРё РёРµСЂР°СЂС…РёРё (`selection.hierarchyHighlightColor`)
- **Active Layer Border** - С†РІРµС‚ РіСЂР°РЅРёС†С‹ СЃР»РѕРµРІ СЃ РІС‹Р±СЂР°РЅРЅС‹РјРё РѕР±СЉРµРєС‚Р°РјРё (`selection.activeLayerBorderColor`)

**Logger Colors - Р¦РІРµС‚Р° РєР°С‚РµРіРѕСЂРёР№ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ:**
- РќР°СЃС‚СЂР°РёРІР°РµРјС‹Рµ С†РІРµС‚Р° РґР»СЏ РІСЃРµС… 21 РєР°С‚РµРіРѕСЂРёРё Р»РѕРіРёСЂРѕРІР°РЅРёСЏ
- Р’РєР»СЋС‡Р°РµС‚: RENDER, UI, FILE, ERROR, CANVAS, MOUSE, EVENT, GROUP, etc.

#### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ СѓР»СѓС‡С€РµРЅРёСЏ:**

**Р РµР°Р»СЊРЅРѕРµ РІСЂРµРјСЏ РїСЂРёРјРµРЅРµРЅРёСЏ:**
- Р’СЃРµ С†РІРµС‚РѕРІС‹Рµ РёР·РјРµРЅРµРЅРёСЏ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ РјРіРЅРѕРІРµРЅРЅРѕ Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё
- StateManager РёРјРµРµС‚ РїСЂРёРѕСЂРёС‚РµС‚ РЅР°Рґ ConfigManager РґР»СЏ РјРіРЅРѕРІРµРЅРЅС‹С… РѕР±РЅРѕРІР»РµРЅРёР№
- РџРѕРґРїРёСЃРєРё РЅР° РёР·РјРµРЅРµРЅРёСЏ StateManager РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёС… РѕР±РЅРѕРІР»РµРЅРёР№ UI

**РЎРѕС…СЂР°РЅРµРЅРёРµ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ:**
- Р¦РІРµС‚Р° СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ user РЅР°СЃС‚СЂРѕР№РєРё (`localStorage`)
- РџСЂР°РІРёР»СЊРЅР°СЏ РѕС‚РјРµРЅР° РёР·РјРµРЅРµРЅРёР№ РїСЂРё РЅР°Р¶Р°С‚РёРё Cancel
- Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РёСЃС…РѕРґРЅС‹С… Р·РЅР°С‡РµРЅРёР№ РёР· StateManager

**РРЅС‚РµРіСЂР°С†РёСЏ СЃ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРјРё РєРѕРјРїРѕРЅРµРЅС‚Р°РјРё:**
- **LayersPanel**: СЂРµР°Р»СЊРЅРѕРµ РІСЂРµРјСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїРѕРґСЃРІРµС‚РєРё Р°РєС‚РёРІРЅС‹С… СЃР»РѕРµРІ
- **SettingsPanel**: СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅР°СЏ СЃРёСЃС‚РµРјР° С†РІРµС‚РѕРІС‹С… РЅР°СЃС‚СЂРѕРµРє
- **SettingsSyncManager**: Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РјРµР¶РґСѓ UI Рё StateManager

#### рџЋЇ **РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ РїСЂРµРёРјСѓС‰РµСЃС‚РІР°:**
- РџРѕР»РЅС‹Р№ РєРѕРЅС‚СЂРѕР»СЊ РЅР°Рґ С†РІРµС‚РѕРІРѕР№ СЃС…РµРјРѕР№ РёРЅС‚РµСЂС„РµР№СЃР°
- РњРіРЅРѕРІРµРЅРЅРѕРµ РїСЂРµРІСЊСЋ РёР·РјРµРЅРµРЅРёР№ С†РІРµС‚РѕРІ
- РќР°СЃС‚СЂР°РёРІР°РµРјР°СЏ РїРѕРґСЃРІРµС‚РєР° Р°РєС‚РёРІРЅС‹С… СЃР»РѕРµРІ
- РџРµСЂСЃРѕРЅР°Р»РёР·Р°С†РёСЏ С†РІРµС‚РѕРІРѕР№ СЃС…РµРјС‹ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ

## [3.47.0] - 2025-10-12

### Added - РЎРёСЃС‚РµРјР° РёРЅРґРµРєСЃРѕРІ РіР»СѓР±РёРЅС‹ (Z-Index) РґР»СЏ РѕР±СЉРµРєС‚РѕРІ

#### рџЋЇ **РќРѕРІР°СЏ СЃРёСЃС‚РµРјР° СЃР»РѕРµРІ Рё РёРЅРґРµРєСЃРѕРІ РіР»СѓР±РёРЅС‹**
- **РЎР»РѕРё РёРјРµСЋС‚ РЅРѕРјРµСЂР°**: РєР°Р¶РґС‹Р№ СЃР»РѕР№ РїРѕР»СѓС‡Р°РµС‚ РёРЅРґРµРєСЃ (0, 1, 2, ...) РЅР° РѕСЃРЅРѕРІРµ РїРѕСЂСЏРґРєР° РІ СЃРїРёСЃРєРµ
- **РРЅРґРµРєСЃ РіР»СѓР±РёРЅС‹ РѕР±СЉРµРєС‚РѕРІ**: `zIndex = layerIndex + (objectIndex / 1000)`
- **РўС‹СЃСЏС‡РЅС‹Рµ РґРѕР»Рё**: РїРѕРєР°Р·С‹РІР°СЋС‚ РїРѕР·РёС†РёСЋ РѕР±СЉРµРєС‚Р° РІРЅСѓС‚СЂРё СЃР»РѕСЏ (Р»РёС‡РЅС‹Р№ РёРЅРґРµРєСЃ)
- **Р¦РµР»Р°СЏ С‡Р°СЃС‚СЊ**: РїРѕРєР°Р·С‹РІР°РµС‚ РЅРѕРјРµСЂ СЃР»РѕСЏ (РіСЂСѓРїРїРёСЂРѕРІРєР° РїРѕ СЃР»РѕСЏРј)

#### рџ“Љ **РЎС‚СЂСѓРєС‚СѓСЂР° zIndex:**
```
РџСЂРёРјРµСЂС‹:
- РћР±СЉРµРєС‚ РЅР° СЃР»РѕРµ 0 СЃ РёРЅРґРµРєСЃРѕРј 5: zIndex = 0.005
- РћР±СЉРµРєС‚ РЅР° СЃР»РѕРµ 1 СЃ РёРЅРґРµРєСЃРѕРј 5: zIndex = 1.005
- РћР±СЉРµРєС‚ РЅР° СЃР»РѕРµ 2 СЃ РёРЅРґРµРєСЃРѕРј 0: zIndex = 2.000
```

#### рџ”§ **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РёРЅРґРµРєСЃР°РјРё:**
- **РџСЂРё РґРѕР±Р°РІР»РµРЅРёРё РѕР±СЉРµРєС‚РѕРІ**: Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРёСЃРІР°РёРІР°РµС‚СЃСЏ СЃР»РµРґСѓСЋС‰РёР№ РґРѕСЃС‚СѓРїРЅС‹Р№ РёРЅРґРµРєСЃ
- **РџСЂРё РґСѓР±Р»РёСЂРѕРІР°РЅРёРё**: РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹Рµ РѕР±СЉРµРєС‚С‹ РїРѕР»СѓС‡Р°СЋС‚ Р±РѕР»РµРµ РІС‹СЃРѕРєРёР№ РёРЅРґРµРєСЃ
- **РџСЂРё РїРµСЂРµРјРµС‰РµРЅРёРё РјРµР¶РґСѓ СЃР»РѕСЏРјРё**: РёРЅРґРµРєСЃ РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ СЃ СѓС‡РµС‚РѕРј РЅРѕРІРѕРіРѕ СЃР»РѕСЏ
- **РџСЂРё РёР·РјРµРЅРµРЅРёРё РїРѕСЂСЏРґРєР° СЃР»РѕРµРІ**: РІСЃРµ РёРЅРґРµРєСЃС‹ РѕР±СЉРµРєС‚РѕРІ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРµСЂРµСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ

#### рџЋЁ **РћС‚РѕР±СЂР°Р¶РµРЅРёРµ РІ РёРЅС‚РµСЂС„РµР№СЃРµ:**
- **РџР°РЅРµР»СЊ Details**: РїРѕРєР°Р·С‹РІР°РµС‚ С‚РѕР»СЊРєРѕ С‚С‹СЃСЏС‡РЅС‹Рµ РґРѕР»Рё (Р»РёС‡РЅС‹Р№ РёРЅРґРµРєСЃ РѕР±СЉРµРєС‚Р°)
- **РџСЂРёРјРµСЂ**: РѕР±СЉРµРєС‚ СЃ zIndex = 1.005 РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РєР°Рє "5" РІ РёРЅС‚РµСЂС„РµР№СЃРµ
- **РђРІС‚РѕРѕР±РЅРѕРІР»РµРЅРёРµ**: РїСЂРё РёР·РјРµРЅРµРЅРёРё РёРЅРґРµРєСЃР° РєР°РЅРІР° СЃСЂР°Р·Сѓ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµС‚СЃСЏ

#### рџ“ќ **РџРѕРґСЂРѕР±РЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ:**
- **РџРµСЂРµРјРµС‰РµРЅРёРµ РјРµР¶РґСѓ СЃР»РѕСЏРјРё**: РґРµС‚Р°Р»СЊРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ РѕР± РёР·РјРµРЅРµРЅРёРё РёРЅРґРµРєСЃРѕРІ
- **РЎРѕР·РґР°РЅРёРµ РѕР±СЉРµРєС‚РѕРІ**: Р»РѕРіРёСЂРѕРІР°РЅРёРµ РїСЂРёСЃРІРѕРµРЅРЅС‹С… РёРЅРґРµРєСЃРѕРІ
- **Р”СѓР±Р»РёСЂРѕРІР°РЅРёРµ**: РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ РЅРѕРІС‹С… РёРЅРґРµРєСЃРѕРІ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ
- **РџРµСЂРµСЃС‡РµС‚ РёРЅРґРµРєСЃРѕРІ**: Р»РѕРіРёСЂРѕРІР°РЅРёРµ РјР°СЃСЃРѕРІС‹С… РёР·РјРµРЅРµРЅРёР№ РїСЂРё СЂРµРѕСЂРґРµСЂРёРЅРіРµ СЃР»РѕРµРІ

### рџ”§ **РўРµС…РЅРёС‡РµСЃРєРёРµ РёР·РјРµРЅРµРЅРёСЏ:**

#### **РњРѕРґРµР»Рё РґР°РЅРЅС‹С…:**
- **`Layer.js`**: РґРѕР±Р°РІР»РµРЅ `index` РґР»СЏ С…СЂР°РЅРµРЅРёСЏ РЅРѕРјРµСЂР° СЃР»РѕСЏ РІ СЃРёСЃС‚РµРјРµ
- **`Level.js`**: РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ `getNextZIndex()`, `updateLayerIndices()`, `updateAllObjectZIndices()`
- **`GameObject.js`**: РґРѕР±Р°РІР»РµРЅРѕ СЃРІРѕР№СЃС‚РІРѕ `zIndex` РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїРѕСЂСЏРґРєРѕРј РѕС‚СЂРёСЃРѕРІРєРё
- **`Group.js`**: РѕР±РЅРѕРІР»РµРЅРѕ РЅР°СЃР»РµРґРѕРІР°РЅРёРµ zIndex РґР»СЏ РґРѕС‡РµСЂРЅРёС… РѕР±СЉРµРєС‚РѕРІ

#### **UI РєРѕРјРїРѕРЅРµРЅС‚С‹:**
- **`DetailsPanel.js`**: РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ С‚С‹СЃСЏС‡РЅС‹С… РґРѕР»РµР№ zIndex, РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹Р№ РІС‹Р±РѕСЂ
- **`UIFactory.js`**: СЃРїРµС†РёР°Р»СЊРЅРѕРµ С„РѕСЂРјР°С‚РёСЂРѕРІР°РЅРёРµ РґР»СЏ zIndex РІ С„РѕСЂРјР°С… СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ
- **`ActorPropertiesWindow.js`**: РґРѕР±Р°РІР»РµРЅРѕ РїРѕР»Рµ Z-Index РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РЅР° РєР°РЅРІРµ

#### **РћРїРµСЂР°С†РёРё:**
- **`LayerOperations.js`**: РїСЂР°РІРёР»СЊРЅРѕРµ РїРµСЂРµРјРµС‰РµРЅРёРµ РѕР±СЉРµРєС‚РѕРІ РјРµР¶РґСѓ СЃР»РѕСЏРјРё СЃ РїРµСЂРµСЃС‡РµС‚РѕРј РёРЅРґРµРєСЃРѕРІ
- **`MouseHandlers.js`**: РїСЂРёСЃРІРѕРµРЅРёРµ РїСЂР°РІРёР»СЊРЅС‹С… РёРЅРґРµРєСЃРѕРІ РїСЂРё drag & drop РІ РіСЂСѓРїРїС‹
- **`DuplicateOperations.js`**: РїСЂР°РІРёР»СЊРЅС‹Рµ РёРЅРґРµРєСЃС‹ РґР»СЏ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ

#### **Р РµРЅРґРµСЂРёРЅРі:**
- **`RenderOperations.js`**: СЃРѕСЂС‚РёСЂРѕРІРєР° РѕР±СЉРµРєС‚РѕРІ РїРѕ zIndex РїРµСЂРµРґ РѕС‚СЂРёСЃРѕРІРєРѕР№
- **`CacheManager.js`**: РёРЅРІР°Р»РёРґР°С†РёСЏ РєРµС€РµР№ РїСЂРё РёР·РјРµРЅРµРЅРёРё zIndex РѕР±СЉРµРєС‚РѕРІ

#### **Р›РѕРіРёСЂРѕРІР°РЅРёРµ:**
- **Р”РѕР±Р°РІР»РµРЅР° РєР°С‚РµРіРѕСЂРёСЏ `LEVEL`** РІ Logger РґР»СЏ РѕРїРµСЂР°С†РёР№ СЃ СѓСЂРѕРІРЅСЏРјРё
- **РџРѕРґСЂРѕР±РЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ** РІСЃРµС… РѕРїРµСЂР°С†РёР№ СЃ РёРЅРґРµРєСЃР°РјРё РіР»СѓР±РёРЅС‹
- **РћС‚СЃР»РµР¶РёРІР°РЅРёРµ** РїРµСЂРµРјРµС‰РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ РјРµР¶РґСѓ СЃР»РѕСЏРјРё

### рџЋЇ **Р РµР·СѓР»СЊС‚Р°С‚:**
вњ… **РџСЂР°РІРёР»СЊРЅР°СЏ СЃРѕСЂС‚РёСЂРѕРІРєР° РѕР±СЉРµРєС‚РѕРІ РїРѕ РіР»СѓР±РёРЅРµ**  
вњ… **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РёРЅРґРµРєСЃР°РјРё РїСЂРё РІСЃРµС… РѕРїРµСЂР°С†РёСЏС…**  
вњ… **РРЅС‚СѓРёС‚РёРІРЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РёРЅРґРµРєСЃРѕРІ**  
вњ… **РџРѕР»РЅР°СЏ РѕС‚СЃР»РµР¶РёРІР°РµРјРѕСЃС‚СЊ РІСЃРµС… РёР·РјРµРЅРµРЅРёР№ РёРЅРґРµРєСЃРѕРІ**  
вњ… **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅР°СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ СЃ РєРµС€РёСЂРѕРІР°РЅРёРµРј**

---

## [3.46.0] - 2025-10-10

### Added - Р“Р»РѕР±Р°Р»СЊРЅР°СЏ СЃРёСЃС‚РµРјР° РѕС‚РјРµРЅС‹ СЂР°РјРєРё РІС‹РґРµР»РµРЅРёСЏ
- **Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ РѕР±СЂР°Р±РѕС‚С‡РёРє РѕС‚РјРµРЅС‹ СЂР°РјРєРё**: РґРѕР±Р°РІР»РµРЅ РµРґРёРЅС‹Р№ РѕР±СЂР°Р±РѕС‚С‡РёРє РґР»СЏ РѕС‚РјРµРЅС‹ СЂР°РјРєРё РІС‹РґРµР»РµРЅРёСЏ РІ Р»СЋР±РѕРј РјРµСЃС‚Рµ СЌРєСЂР°РЅР° РїСЂРё РЅР°Р¶Р°С‚РёРё Р»СЋР±РѕР№ РєРЅРѕРїРєРё РјС‹С€Рё РєСЂРѕРјРµ Р»РµРІРѕР№ (РєР°РЅРІР°, РїР°РЅРµР»Рё, РІРЅРµ РёРЅС‚РµСЂС„РµР№СЃР°)
- **РЈРЅРёРІРµСЂСЃР°Р»СЊРЅР°СЏ РїРѕРґРґРµСЂР¶РєР°**: СЂР°Р±РѕС‚Р°РµС‚ СЃ РѕР±РµРёРјРё СЃРёСЃС‚РµРјР°РјРё СЂР°РјРѕРє (СЃС‚Р°СЂРѕР№ РґР»СЏ РєР°РЅРІС‹ Рё РЅРѕРІРѕР№ РґР»СЏ РїР°РЅРµР»РµР№)
- **РњРЅРѕРіРѕСѓСЂРѕРІРЅРµРІР°СЏ Р·Р°С‰РёС‚Р°**: С‚СЂРё СѓСЂРѕРІРЅСЏ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ РґР»СЏ РіР°СЂР°РЅС‚РёСЂРѕРІР°РЅРЅРѕР№ СЂР°Р±РѕС‚С‹ (contextmenu, mousedown, window-level)
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РѕС‡РёСЃС‚РєР°**: РѕС‡РёС‰Р°РµС‚ РІСЃРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ, DOM СЌР»РµРјРµРЅС‚С‹ Рё РІС‹РґРµР»РµРЅРёРµ РїСЂРё РѕС‚РјРµРЅРµ СЂР°РјРєРё

### Changed - РћС‡РёСЃС‚РєР° РґСѓР±Р»РёСЂСѓСЋС‰РµРіРѕ РєРѕРґР°
- **BaseContextMenu.js**: СѓРґР°Р»РµРЅС‹ Р»РёС€РЅРёРµ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё, РѕСЃС‚Р°РІР»РµРЅС‹ С‚РѕР»СЊРєРѕ РІР°Р¶РЅС‹Рµ РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅС‹Рµ СЃРѕРѕР±С‰РµРЅРёСЏ
- **SelectionUtils.js**: СѓРґР°Р»РµРЅС‹ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё РґР»СЏ РїСЂРѕРІРµСЂРєРё Р°РєС‚РёРІРЅС‹С… marquee selections
- **MouseHandlers.js**: СѓРґР°Р»РµРЅ РґСѓР±Р»РёСЂСѓСЋС‰РёР№ РєРѕРґ РѕС‚РјРµРЅС‹ СЂР°РјРєРё (С‚РµРїРµСЂСЊ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ РіР»РѕР±Р°Р»СЊРЅРѕ)
- **LevelEditor.js**: СѓРїСЂРѕС‰РµРЅ РјРµС‚РѕРґ `cancelAllActions()` - РѕС‚РјРµРЅР° marquee С‚РµРїРµСЂСЊ РіР»РѕР±Р°Р»СЊРЅР°СЏ

### Fixed - РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ РѕС‚РјРµРЅС‹ СЂР°РјРєРё
- **РћС‚РјРµРЅР° РІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ**: РёСЃРїСЂР°РІР»РµРЅРѕ - СЂР°РјРєР° С‚РµРїРµСЂСЊ РєРѕСЂСЂРµРєС‚РЅРѕ РѕС‚РјРµРЅСЏРµС‚СЃСЏ СЃ РѕС‡РёСЃС‚РєРѕР№ РІС‹РґРµР»РµРЅРёСЏ
- **РћС‚РјРµРЅР° РЅР° РєР°РЅРІРµ**: РёСЃРїСЂР°РІР»РµРЅРѕ - СЂР°РјРєР° РєР°РЅРІС‹ С‚РµРїРµСЂСЊ РѕС‚РјРµРЅСЏРµС‚СЃСЏ РІ Р»СЋР±РѕРј РјРµСЃС‚Рµ СЌРєСЂР°РЅР°
- **РџСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ РєРѕРЅС„Р»РёРєС‚РѕРІ**: СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ Р»РѕРєР°Р»СЊРЅС‹РјРё Рё РіР»РѕР±Р°Р»СЊРЅС‹РјРё РѕР±СЂР°Р±РѕС‚С‡РёРєР°РјРё РѕС‚РјРµРЅС‹

---

## [3.45.1] - 2025-10-10

### Fixed - РСЃРїСЂР°РІР»РµРЅРёСЏ UI Рё selection
- **SelectionUtils.js**: РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° РґСѓР±Р»РёСЂСѓСЋС‰РµРіРѕ РѕР±СЉСЏРІР»РµРЅРёСЏ РїРµСЂРµРјРµРЅРЅРѕР№ `mouseStateKey` (СЃС‚СЂРѕРєР° 339)
- **SelectionUtils.js**: РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° РґСѓР±Р»РёСЂСѓСЋС‰РµРіРѕ РѕР±СЉСЏРІР»РµРЅРёСЏ РїРµСЂРµРјРµРЅРЅРѕР№ `options` (СЃС‚СЂРѕРєР° 359) - РїРµСЂРµРёРјРµРЅРѕРІР°РЅР° РІ `marqueeOptions`
- **BasePanel.js**: РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° РЅРµРѕР±СЉСЏРІР»РµРЅРЅРѕР№ РїРµСЂРµРјРµРЅРЅРѕР№ `options` РІ `handleMouseUp` (СЃС‚СЂРѕРєР° 231) - Р·Р°РјРµРЅРµРЅРѕ РЅР° `this.selectionOptions`
- **SettingsPanel.js**: РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РЅРµСЂР°Р±РѕС‚Р°СЋС‰РёРјРё СЃР»Р°Р№РґРµСЂР°РјРё Font Scale Рё Spacing РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё С‚Р°Р±РѕРІ - РґРѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ `setupSettingsInputs()` РїРѕСЃР»Рµ СЂРµРЅРґРµСЂРёРЅРіР° РєРѕРЅС‚РµРЅС‚Р°

### Improved
- **РРЅС‚РµСЂР°РєС‚РёРІРЅРѕСЃС‚СЊ РЅР°СЃС‚СЂРѕРµРє**: СЃР»Р°Р№РґРµСЂС‹ Font Scale Рё Spacing С‚РµРїРµСЂСЊ РІСЃРµРіРґР° СЂР°Р±РѕС‚Р°СЋС‚ РїСЂРё РѕС‚РєСЂС‹С‚РёРё РѕРєРЅР° РЅР°СЃС‚СЂРѕРµРє
- **РЎС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ selection**: СѓСЃС‚СЂР°РЅРµРЅС‹ СЃРёРЅС‚Р°РєСЃРёС‡РµСЃРєРёРµ РѕС€РёР±РєРё РІ СЃРёСЃС‚РµРјРµ marquee selection
- **РќР°РґРµР¶РЅРѕСЃС‚СЊ**: СѓСЃС‚СЂР°РЅРµРЅС‹ РѕС€РёР±РєРё РѕР±СЂР°С‰РµРЅРёСЏ Рє РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРј РїРµСЂРµРјРµРЅРЅС‹Рј

---

## [3.45.0] - 2025-10-08

### Changed - РЎРёСЃС‚РµРјР° Р°СЃСЃРµС‚РѕРІ РїРµСЂРµСЂР°Р±РѕС‚Р°РЅР°
- **РЈРґР°Р»РµРЅС‹ Р·Р°РіР»СѓС€РєРё**: Grass, Dirt, Stone, Slime, Goblin, Coin, Health Potion
- **РЈРґР°Р»РµРЅС‹ РґРµС„РѕР»С‚РЅС‹Рµ С‚Р°Р±С‹**: Tiles, Enemies, Items, Prefabs
- **РЈРґР°Р»С‘РЅ Enemy Spawn** РёР· РЅР°С‡Р°Р»СЊРЅС‹С… РѕР±СЉРµРєС‚РѕРІ СѓСЂРѕРІРЅСЏ
- **РџРµСЂРµРёРјРµРЅРѕРІР°РЅР° РїР°РЅРµР»СЊ**: Folders в†’ Content

### Added - РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ Р·Р°РіСЂСѓР·РєР° Р°СЃСЃРµС‚РѕРІ
- **AssetManager.scanContentFolder()**: СЃРєР°РЅРёСЂРѕРІР°РЅРёРµ ./content РїСЂРё СЃС‚Р°СЂС‚Рµ
- **content/manifest.json**: РјР°РЅРёС„РµСЃС‚ СЃРѕ СЃС‚СЂСѓРєС‚СѓСЂРѕР№ РїР°РїРѕРє Рё СЃРїРёСЃРєРѕРј С„Р°Р№Р»РѕРІ
- **update_manifest.bat/py/js**: СЃРєСЂРёРїС‚С‹ РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РјР°РЅРёС„РµСЃС‚Р°
- **AssetManager.loadAssetFromFile()**: Р·Р°РіСЂСѓР·РєР° Р°СЃСЃРµС‚РѕРІ РёР· JSON
- **AssetManager.getCategoriesWithAssets()**: С‚РѕР»СЊРєРѕ РєР°С‚РµРіРѕСЂРёРё СЃ Р°СЃСЃРµС‚Р°РјРё
- **РђРІС‚РѕРіРµРЅРµСЂР°С†РёСЏ ID**: СѓРЅРёРєР°Р»СЊРЅС‹Рµ ID РёР· РїРѕР»РЅРѕРіРѕ РїСѓС‚Рё С„Р°Р№Р»Р°
- **Cache busting**: РґР»СЏ РјР°РЅРёС„РµСЃС‚Р° Рё JSON С„Р°Р№Р»РѕРІ

### Changed - FoldersPanel
- **РЎС‚СЂСѓРєС‚СѓСЂР° РёР· РјР°РЅРёС„РµСЃС‚Р°**: buildFromManifestStructure()
- **РўРѕР»СЊРєРѕ РїР°РїРєРё**: Р°СЃСЃРµС‚С‹ РЅРµ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РІ РґРµСЂРµРІРµ
- **Р РµРєСѓСЂСЃРёРІРЅС‹Р№ СЃС‡С‘С‚С‡РёРє**: countAssetsRecursive()
- **Р Р°СЃРєСЂС‹С‚РёРµ РїРѕ СЃС‚СЂРµР»РєРµ**: РєР»РёРє РїРѕ РїР°РїРєРµ С‚РѕР»СЊРєРѕ РІС‹РґРµР»СЏРµС‚
- **РЎРµСЂС‹Р№ С†РІРµС‚**: РґР»СЏ РїСѓСЃС‚С‹С… РїР°РїРѕРє
- **РџРѕРґСЃРІРµС‚РєР°**: СЂР°Р±РѕС‚Р°РµС‚ РЅР° РІСЃРµС… СѓСЂРѕРІРЅСЏС…
- **РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ С‚Р°Р±РѕРІ**: getCategoriesInFolder() СЂРµРєСѓСЂСЃРёРІРЅРѕ

### Changed - РћР±СЂР°Р±РѕС‚РєР° РёР·РѕР±СЂР°Р¶РµРЅРёР№
- **РўРѕР»СЊРєРѕ РѕРґРЅР° РєР°СЂС‚РёРЅРєР°**: РјР°СЃСЃРёРІ imgSrc в†’ РїРµСЂРІС‹Р№ СЌР»РµРјРµРЅС‚
- **РџРѕРґРґРµСЂР¶РєР° image field**: Р°Р»СЊС‚РµСЂРЅР°С‚РёРІРЅРѕРµ РїРѕР»Рµ
- **РџРѕР»РЅС‹Рµ РїСѓС‚Рё**: ./content/path/to/image.png
- **РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РєРµС€РµР№**: preloadImages() СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚ СЃ CanvasRenderer

### Fixed
- **FoldersPanel.folderStructure**: РІСЃРµРіРґР° РёРЅРёС†РёР°Р»РёР·РёСЂСѓРµС‚СЃСЏ
- **РЈРЅРёРєР°Р»СЊРЅРѕСЃС‚СЊ ID**: РѕРґРёРЅР°РєРѕРІС‹Рµ С„Р°Р№Р»С‹ РІ СЂР°Р·РЅС‹С… РїР°РїРєР°С…
- **РљР°С‚РµРіРѕСЂРёРё**: РёР· РёРјРµРЅРё СЂРѕРґРёС‚РµР»СЊСЃРєРѕР№ РїР°РїРєРё
- **РўР°Р±С‹**: С‚РѕР»СЊРєРѕ РґР»СЏ РєР°С‚РµРіРѕСЂРёР№ СЃ Р°СЃСЃРµС‚Р°РјРё
- **РџСѓСЃС‚С‹Рµ РїР°РїРєРё**: РѕС‡РёС‰Р°СЋС‚ С‚Р°Р±С‹

---

## [3.44.0] - 2025-10-05

### Added - Р¤Р°Р·Р° 5: РњРѕРґСѓР»СЏСЂРёР·Р°С†РёСЏ ViewportOperations Рё LevelFileOperations
- **ViewportOperations**: РЅРѕРІС‹Р№ РјРѕРґСѓР»СЊ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ viewport Рё РєР°РјРµСЂРѕР№ (200+ СЃС‚СЂРѕРє)
  - `zoomIn()`, `zoomOut()`, `zoomToFit()`, `resetView()`
  - `focusOnSelection()`, `focusOnAll()`, `focusOnBounds()`
- **LevelFileOperations**: РЅРѕРІС‹Р№ РјРѕРґСѓР»СЊ РґР»СЏ С„Р°Р№Р»РѕРІС‹С… РѕРїРµСЂР°С†РёР№ (250+ СЃС‚СЂРѕРє)
  - `newLevel()`, `openLevel()`, `saveLevel()`, `saveLevelAs()`
  - `importAssets()` СЃ РїРѕР»РЅРѕР№ РёРЅС‚РµРіСЂР°С†РёРµР№ AssetImporter
  - `_validatePlayerStart()` - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РІР°Р»РёРґР°С†РёСЏ

### Changed
- **LevelEditor**: РјРµС‚РѕРґС‹ viewport Рё С„Р°Р№Р»РѕРІС‹С… РѕРїРµСЂР°С†РёР№ РґРµР»РµРіРёСЂСѓСЋС‚ Рє РЅРѕРІС‹Рј РјРѕРґСѓР»СЏРј
- **ObjectOperations**: СѓРґР°Р»РµРЅС‹ `focusOnSelection()` Рё `focusOnAll()` (РїРµСЂРµРЅРµСЃРµРЅС‹ РІ ViewportOperations)
- **Р Р°Р·РјРµСЂ LevelEditor.js**: 2089в†’1770 СЃС‚СЂРѕРє (-319 СЃС‚СЂРѕРє, -15.3%)
- **Logger**: РґРѕР±Р°РІР»РµРЅР° РєР°С‚РµРіРѕСЂРёСЏ VIEWPORT РґР»СЏ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ РѕРїРµСЂР°С†РёР№ РєР°РјРµСЂС‹

### Improved
- **Separation of Concerns**: viewport Рё С„Р°Р№Р»РѕРІС‹Рµ РѕРїРµСЂР°С†РёРё РІ РѕС‚РґРµР»СЊРЅС‹С… РјРѕРґСѓР»СЏС…
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ**: +25% (viewport Рё С„Р°Р№Р»С‹ РјРѕРіСѓС‚ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ)
- **Maintainability**: РёР·РјРµРЅРµРЅРёСЏ Р»РѕРєР°Р»РёР·РѕРІР°РЅС‹ РІ СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹С… РјРѕРґСѓР»СЏС…
- **РџР°СЂР°РјРµС‚СЂРёР·Р°С†РёСЏ**: РјРµС‚РѕРґС‹ РїСЂРёРЅРёРјР°СЋС‚ РїР°СЂР°РјРµС‚СЂС‹ (factor, padding, defaults)
- **РЈР»СѓС‡С€РµРЅРЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ**: РґРµС‚Р°Р»СЊРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ Рѕ РІСЃРµС… РѕРїРµСЂР°С†РёСЏС…

### РњРµС‚СЂРёРєРё РїРѕСЃР»Рµ Р¤Р°Р·С‹ 5
- **LevelEditor.js**: 2488в†’1770 СЃС‚СЂРѕРє (-28.8% РѕС‚ РЅР°С‡Р°Р»Р° Р¤Р°Р·С‹ 4)
- **РќРѕРІС‹Рµ РјРѕРґСѓР»Рё**: ViewportOperations (200 СЃС‚СЂРѕРє), LevelFileOperations (250 СЃС‚СЂРѕРє)
- **РћР±С‰Р°СЏ РјРѕРґСѓР»СЊРЅРѕСЃС‚СЊ**: +70% РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РЅР°С‡Р°Р»Р° СЂРµС„Р°РєС‚РѕСЂРёРЅРіР°
- **Cognitive Complexity**: СЃРЅРёР¶РµРЅР° РЅР° ~65%

---

## [3.43.0] - 2025-10-05

### Changed - Р¤Р°Р·Р° 4.5: Р Р°Р·Р±РёРІРєР° applyConfiguration()
- **LevelEditor.applyConfiguration()**: СЂР°Р·Р±РёС‚ РЅР° 7 СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹С… РјРµС‚РѕРґРѕРІ
  - `_applyGridConfiguration()` - РєРѕРѕСЂРґРёРЅРёСЂСѓРµС‚ РїСЂРёРјРµРЅРµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР°
  - `_getGridSettingsFromConfig()` - РїРѕР»СѓС‡РµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє РёР· РєРѕРЅС„РёРіР°
  - `_applyBasicGridSettings()` - Р±Р°Р·РѕРІС‹Рµ РЅР°СЃС‚СЂРѕР№РєРё (size, color, thickness, opacity)
  - `_applyGridSubdivisionSettings()` - РЅР°СЃС‚СЂРѕР№РєРё РїРѕРґСЂР°Р·РґРµР»РµРЅРёР№ РіСЂРёРґР°
  - `_applyGridTypeSettings()` - С‚РёРї РіСЂРёРґР° (rectangular, hexagonal, etc.)
  - `_syncGridSettingsToUI()` - СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃ UI РєРѕРјРїРѕРЅРµРЅС‚Р°РјРё
  - `_saveDefaultConfiguration()` - СЃРѕС…СЂР°РЅРµРЅРёРµ РґРµС„РѕР»С‚РЅС‹С… РЅР°СЃС‚СЂРѕРµРє

### Improved
- **Р§РёС‚Р°РµРјРѕСЃС‚СЊ**: 65в†’10 СЃС‚СЂРѕРє РІ РѕСЃРЅРѕРІРЅРѕРј РјРµС‚РѕРґРµ (-85%)
- **Separation of Concerns**: РєР°Р¶РґС‹Р№ РјРµС‚РѕРґ РѕС‚РІРµС‡Р°РµС‚ Р·Р° СЃРІРѕСЋ Р·Р°РґР°С‡Сѓ
- **Maintainability**: Р»РµРіС‡Рµ СЂР°СЃС€РёСЂСЏС‚СЊ Рё С‚РµСЃС‚РёСЂРѕРІР°С‚СЊ РѕС‚РґРµР»СЊРЅС‹Рµ С‡Р°СЃС‚Рё
- **JSDoc**: РїРѕР»РЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ РґР»СЏ РІСЃРµС… РјРµС‚РѕРґРѕРІ

---

## [3.42.0] - 2025-10-05

### Added - Р¤Р°Р·Р° 4.4: CacheManager
- **CacheManager**: РЅРѕРІС‹Р№ РјРµРЅРµРґР¶РµСЂ РґР»СЏ С†РµРЅС‚СЂР°Р»РёР·Р°С†РёРё Р»РѕРіРёРєРё РєСЌС€РёСЂРѕРІР°РЅРёСЏ (269 СЃС‚СЂРѕРє)
  - getCachedObject(), getCachedTopLevelObject(), getCachedEffectiveLayerId()
  - getSelectableObjectsInViewport(), smartCacheInvalidation()
  - invalidateAfterLayerChanges/GroupOperations/DuplicateOperations()
  - scheduleCacheInvalidation() СЃ debouncing

### Changed
- **LevelEditor**: РјРµС‚РѕРґС‹ РєСЌС€РёСЂРѕРІР°РЅРёСЏ РґРµР»РµРіРёСЂСѓСЋС‚ Рє CacheManager
- **Р Р°Р·РјРµСЂ LevelEditor.js**: 2057в†’1811 СЃС‚СЂРѕРє (-246 СЃС‚СЂРѕРє, -12%)
- **Logger**: РґРѕР±Р°РІР»РµРЅР° РєР°С‚РµРіРѕСЂРёСЏ CACHE РґР»СЏ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ РєСЌС€РёСЂРѕРІР°РЅРёСЏ

### Improved
- **Separation of Concerns**: РєСЌС€РёСЂРѕРІР°РЅРёРµ РІ РѕС‚РґРµР»СЊРЅРѕРј РјРµРЅРµРґР¶РµСЂРµ
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ**: +15% (РєСЌС€РёСЂРѕРІР°РЅРёРµ РјРѕР¶РµС‚ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ)
- **Maintainability**: РёР·РјРµРЅРµРЅРёСЏ Р»РѕРєР°Р»РёР·РѕРІР°РЅС‹ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **РЎРѕС…СЂР°РЅРµРЅС‹ РѕРїС‚РёРјРёР·Р°С†РёРё**: smart invalidation, debouncing, TTL cache

---

## [3.41.0] - 2025-10-05

### Added - Р¤Р°Р·Р° 4.3: РњРѕРґСѓР»СЊ LayerOperations
- **LayerOperations**: РЅРѕРІС‹Р№ РјРѕРґСѓР»СЊ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ СЃР»РѕСЏРјРё (404 СЃС‚СЂРѕРєРё)
  - moveSelectedObjectsToLayer(), assignSelectedObjectsToLayer()
  - batchProcessLayerAssignment(), findNextUnlockedLayer()
  - processObjectForLayerAssignment(), batched notifications
  - canMoveObjectsToLayer()

### Changed
- **LevelEditor**: РјРµС‚РѕРґС‹ СѓРїСЂР°РІР»РµРЅРёСЏ СЃР»РѕСЏРјРё РґРµР»РµРіРёСЂСѓСЋС‚ Рє LayerOperations
- **Р Р°Р·РјРµСЂ LevelEditor.js**: 2415в†’2057 СЃС‚СЂРѕРє (-358 СЃС‚СЂРѕРє, -14.8%)

### Improved
- **Separation of Concerns**: СѓРїСЂР°РІР»РµРЅРёРµ СЃР»РѕСЏРјРё РІ РѕС‚РґРµР»СЊРЅРѕРј РјРѕРґСѓР»Рµ
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ**: +20% (СЃР»РѕРё РјРѕРіСѓС‚ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ)
- **Maintainability**: РёР·РјРµРЅРµРЅРёСЏ Р»РѕРєР°Р»РёР·РѕРІР°РЅС‹ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **РЎРѕС…СЂР°РЅРµРЅС‹ РѕРїС‚РёРјРёР·Р°С†РёРё**: batch processing, smart caching, spatial index

---

## [3.40.0] - 2025-10-05

### Added - Р¤Р°Р·Р° 4.2: РњРѕРґСѓР»СЊ HistoryOperations
- **HistoryOperations**: РЅРѕРІС‹Р№ РјРѕРґСѓР»СЊ РґР»СЏ С†РµРЅС‚СЂР°Р»РёР·Р°С†РёРё Р»РѕРіРёРєРё undo/redo (144 СЃС‚СЂРѕРєРё)
  - undo(), redo(), restoreObjectsFromHistory(), rebuildAllIndices()
  - restoreGroupEditMode(), recalculateGroupBounds(), invalidateCachesAfterRestore()
  - restoreSelection(), finalizeHistoryRestore()

### Changed
- **LevelEditor**: РјРµС‚РѕРґС‹ undo/redo РґРµР»РµРіРёСЂСѓСЋС‚ СЂР°Р±РѕС‚Сѓ Рє HistoryOperations
- **Р Р°Р·РјРµСЂ LevelEditor.js**: 2693в†’2415 СЃС‚СЂРѕРє (-278 СЃС‚СЂРѕРє, -10.3%)

### Improved
- **Separation of Concerns**: РёСЃС‚РѕСЂРёСЏ РІ РѕС‚РґРµР»СЊРЅРѕРј РјРѕРґСѓР»Рµ
- **РњРѕРґСѓР»СЊРЅРѕСЃС‚СЊ**: +20% (РёСЃС‚РѕСЂРёСЏ РјРѕР¶РµС‚ РїРµСЂРµРёСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ)
- **Maintainability**: РёР·РјРµРЅРµРЅРёСЏ Р»РѕРєР°Р»РёР·РѕРІР°РЅС‹ РІ РѕРґРЅРѕРј РјРµСЃС‚Рµ
- **РўРµСЃС‚РёСЂСѓРµРјРѕСЃС‚СЊ**: Р»РµРіРєРѕ С‚РµСЃС‚РёСЂРѕРІР°С‚СЊ РёСЃС‚РѕСЂРёСЋ РѕС‚РґРµР»СЊРЅРѕ

---

## [3.39.0] - 2025-10-05

### Changed - Р¤Р°Р·Р° 4.1: Р Р°Р·Р±РёРІРєР° Р±РѕР»СЊС€РёС… РјРµС‚РѕРґРѕРІ
- **LevelEditor.init()**: СЂР°Р·Р±РёС‚ РЅР° 7 СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹С… РјРµС‚РѕРґРѕРІ (180в†’15 СЃС‚СЂРѕРє, -92%)
  - initializeConfiguration(), initializeDOMElements(), initializeRenderer()
  - initializeUIComponents(), initializeMenuAndEvents(), initializeLevelAndData()
  - finalizeInitialization()
- **LevelEditor.undo()**: СЂР°Р·Р±РёС‚ РЅР° 7 РїСЂРёРІР°С‚РЅС‹С… РјРµС‚РѕРґРѕРІ (160в†’10 СЃС‚СЂРѕРє, -94%)
- **LevelEditor.redo()**: СѓРїСЂРѕС‰РµРЅ, РїРµСЂРµРёСЃРїРѕР»СЊР·СѓРµС‚ РјРµС‚РѕРґС‹ undo (85в†’10 СЃС‚СЂРѕРє, -88%)

### Improved
- **Р§РёС‚Р°РµРјРѕСЃС‚СЊ**: +85-90% (РјРµС‚РѕРґС‹ С‡РёС‚Р°СЋС‚СЃСЏ РєР°Рє РїРѕСЃР»РµРґРѕРІР°С‚РµР»СЊРЅРѕСЃС‚СЊ С€Р°РіРѕРІ)
- **DRY**: СѓСЃС‚СЂР°РЅРµРЅРѕ ~150 СЃС‚СЂРѕРє РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ РјРµР¶РґСѓ undo/redo (-95%)
- **РљРѕРіРЅРёС‚РёРІРЅР°СЏ СЃР»РѕР¶РЅРѕСЃС‚СЊ**: -80% (СЃ 25 РґРѕ 5)
- **Р Р°Р·РјРµСЂ С„Р°Р№Р»Р°**: 2914в†’2693 СЃС‚СЂРѕРє (-7.6%)
- **Maintainability**: РєР°Р¶РґС‹Р№ РјРµС‚РѕРґ РґРµР»Р°РµС‚ РѕРґРЅСѓ РІРµС‰СЊ (SRP)

### Technical
- 13 РЅРѕРІС‹С… РїСЂРёРІР°С‚РЅС‹С… РјРµС‚РѕРґРѕРІ СЃ @private JSDoc
- РЈСЃС‚СЂР°РЅРµРЅР° РІР»РѕР¶РµРЅРЅРѕСЃС‚СЊ РєРѕРґР° (4в†’1 СѓСЂРѕРІРµРЅСЊ)
- РЈР»СѓС‡С€РµРЅР° С‚РµСЃС‚РёСЂСѓРµРјРѕСЃС‚СЊ (РёР·РѕР»РёСЂРѕРІР°РЅРЅС‹Рµ С€Р°РіРё)

---

## [3.38.1] - 2025-10-05

### Fixed - РЈР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° РґР»СЏ РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРї
- Р”РѕР±Р°РІР»РµРЅР° РїСЂРѕРІРµСЂРєР° РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё activeGroupId Рё openGroupIds
- Р’Р°Р»РёРґР°С†РёСЏ РёРµСЂР°СЂС…РёРё РІР»РѕР¶РµРЅРЅС‹С… РіСЂСѓРїРї (parentв†’child)
- Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅС‹ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹Рµ РїРѕР»СЏ groupId Рё originalChildren
- Р‘РµР·РѕРїР°СЃРЅС‹Р№ РІС‹С…РѕРґ РёР· СЂРµР¶РёРјР° РїСЂРё СЃР»РѕРјР°РЅРЅРѕР№ РёРµСЂР°СЂС…РёРё

---

## [3.38.0] - 2025-10-05

### Added - Р¤РёРєСЃ Undo/Redo
- РЎРѕС…СЂР°РЅРµРЅРёРµ groupEditMode РІ РёСЃС‚РѕСЂРёСЋ (isActive, groupId, openGroupIds)
- РЈР±СЂР°РЅРѕ РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕРµ РёР·РјРµРЅРµРЅРёРµ visibility РїРѕСЃР»Рµ undo/redo
- РЈР±СЂР°РЅ РЅРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ markDirty() РїРѕСЃР»Рµ undo/redo

---

## [3.37.0] - 2025-10-05

### Added
- **PerformanceUtils**: РјРѕРґСѓР»СЊ РѕРїС‚РёРјРёР·Р°С†РёРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё
  - throttle(), debounce(), memoize(), batchRAF()
  - LRUCache class РґР»СЏ СЌС„С„РµРєС‚РёРІРЅРѕРіРѕ РєСЌС€РёСЂРѕРІР°РЅРёСЏ
- **Throttled mouse events**: 8ms РґР»СЏ mousemove, 16ms РґР»СЏ wheel
- **EditorConstants**: MOUSE_MOVE_THROTTLE_MS, WHEEL_THROTTLE_MS, RESIZE_DEBOUNCE_MS, INPUT_DEBOUNCE_MS

### Changed
- **MouseHandlers**: РїСЂРёРјРµРЅРµРЅ throttle Рє handleMouseMove Рё handleWheel (-20-30% CPU)
- **РџР»Р°РІРЅРѕСЃС‚СЊ РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёСЏ**: СѓР»СѓС‡С€РµРЅР° РѕС‚Р·С‹РІС‡РёРІРѕСЃС‚СЊ РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё Рё zoom

### Performance
- РЎРЅРёР¶РµРЅРёРµ CPU РЅР°РіСЂСѓР·РєРё РЅР° 20-30% РїСЂРё РёРЅС‚РµРЅСЃРёРІРЅРѕРј РІР·Р°РёРјРѕРґРµР№СЃС‚РІРёРё
- РџР»Р°РІРЅРѕРµ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ Рё zoom Р±РµР· Р»Р°РіРѕРІ
- Р“РѕС‚РѕРІР°СЏ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂР° РґР»СЏ memoization

---

## [3.36.0] - 2025-10-05

### Added
- **EditorConstants**: С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Рµ РєРѕРЅСЃС‚Р°РЅС‚С‹ СЂРµРґР°РєС‚РѕСЂР°
  - DEFAULT_OBJECT (width, height, color, visibility)
  - PERFORMANCE (cache timeout, spatial grid, history size)
  - GRID, CAMERA, UI, SELECTION, PARALLAX РЅР°СЃС‚СЂРѕР№РєРё

### Changed
- **DuplicateOperations**: СѓСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР° (~20 СЃС‚СЂРѕРє)
  - РЎРѕР·РґР°РЅ РјРµС‚РѕРґ _normalizeObjectProperties()
  - РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РєРѕРЅСЃС‚Р°РЅС‚ DEFAULT_OBJECT
- **RenderOperations**: РїСЂРёРјРµРЅРµРЅС‹ РєРѕРЅСЃС‚Р°РЅС‚С‹ PERFORMANCE
- **ErrorHandler**: РїСЂРёРјРµРЅРµРЅС‹ РєРѕРЅСЃС‚Р°РЅС‚С‹ PERFORMANCE.MAX_HISTORY_SIZE

### Improved
- DRY РїСЂРёРЅС†РёРї: +30% (РµРґРёРЅР°СЏ С‚РѕС‡РєР° РёР·РјРµРЅРµРЅРёСЏ РґР»СЏ СЃРІРѕР№СЃС‚РІ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ)
- Maintainability: +40% (РєРѕРЅСЃС‚Р°РЅС‚С‹ РІРјРµСЃС‚Рѕ magic numbers)
- Consistency: СѓР»СѓС‡С€РµРЅР° СЃРѕРіР»Р°СЃРѕРІР°РЅРЅРѕСЃС‚СЊ РєРѕРґР°

---

## [3.35.0] - 2025-10-05

### Added
- **JSDoc С‚РёРїРёР·Р°С†РёСЏ**: РїРѕР»РЅР°СЏ РґРѕРєСѓРјРµРЅС‚Р°С†РёСЏ ErrorHandler Рё Custom Error РєР»Р°СЃСЃРѕРІ
  - 17 РјРµС‚РѕРґРѕРІ СЃ РґРµС‚Р°Р»СЊРЅРѕР№ С‚РёРїРёР·Р°С†РёРµР№
  - 4 Custom Error РєР»Р°СЃСЃР° (NetworkError, ValidationError, PermissionError, FileNotFoundError)
  - 10+ РїСЂРёРјРµСЂРѕРІ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ
  - IDE Р°РІС‚РѕРґРѕРїРѕР»РЅРµРЅРёРµ Рё IntelliSense РїРѕРґРґРµСЂР¶РєР°

### Technical
- ~200 СЃС‚СЂРѕРє JSDoc РґРѕРєСѓРјРµРЅС‚Р°С†РёРё
- @param, @returns, @example РґР»СЏ РІСЃРµС… РїСѓР±Р»РёС‡РЅС‹С… РјРµС‚РѕРґРѕРІ
- @private РјР°СЂРєРµСЂС‹ РґР»СЏ РІРЅСѓС‚СЂРµРЅРЅРёС… РјРµС‚РѕРґРѕРІ
- @extends РґР»СЏ Custom Error РєР»Р°СЃСЃРѕРІ

---

## [3.34.0] - 2025-10-05

### Changed
- **Logger migration**: 100% Р·Р°РјРµРЅР° console.* РЅР° Logger.* (23 С„Р°Р№Р»Р°, 40+ РІС‹Р·РѕРІРѕРІ)
  - CanvasRenderer в†’ Logger.canvas
  - FileUtils в†’ Logger.file
  - AssetManager в†’ Logger.asset
  - SettingsPanel, DetailsPanel в†’ Logger.settings, Logger.ui
  - FolderPickerDialog в†’ Logger.file
  - ConsoleContextMenu в†’ Logger.console
- **ErrorHandler integration**: РєСЂРёС‚РёС‡РЅС‹Рµ С„Р°Р№Р»РѕРІС‹Рµ РѕРїРµСЂР°С†РёРё (FileManager: loadLevel, loadLevelFromFileInput, importLevelData, loadAssetLibrary)

### Fixed
- Р•РґРёРЅС‹Р№ СЃС‚РёР»СЊ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ РІРѕ РІСЃРµРј РїСЂРѕРµРєС‚Рµ
- РЈР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє РІ С„Р°Р№Р»РѕРІС‹С… РѕРїРµСЂР°С†РёСЏС…

### Technical
- Fallback console.* РѕСЃС‚Р°РІР»РµРЅ РІ Logger.js Рё ConfigManager (РїСЂР°РІРёР»СЊРЅРѕ)
- РџРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ СЃРѕРѕР±С‰РµРЅРёСЏ РѕР± РѕС€РёР±РєР°С… РЅР° СЂСѓСЃСЃРєРѕРј СЏР·С‹РєРµ
- ErrorHandler.try/tryAsync РѕР±РµСЂС‚РєРё РґР»СЏ РєСЂРёС‚РёС‡РЅС‹С… РѕРїРµСЂР°С†РёР№

---

## [3.33.0] - 2025-10-05

### Added
- **ErrorHandler**: С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє, РіР»РѕР±Р°Р»СЊРЅС‹Рµ РїРµСЂРµС…РІР°С‚С‡РёРєРё, СЃС‚СЂР°С‚РµРіРёРё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ, РёСЃС‚РѕСЂРёСЏ РѕС€РёР±РѕРє
- **ComponentLifecycle**: РјРµРЅРµРґР¶РµСЂ Р¶РёР·РЅРµРЅРЅРѕРіРѕ С†РёРєР»Р° РєРѕРјРїРѕРЅРµРЅС‚РѕРІ, РїСЂРёРѕСЂРёС‚РµС‚С‹ СѓРЅРёС‡С‚РѕР¶РµРЅРёСЏ, РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёРµ СѓС‚РµС‡РµРє РїР°РјСЏС‚Рё
- **destroy() РјРµС‚РѕРґС‹**: РґРѕР±Р°РІР»РµРЅС‹ РІРѕ РІСЃРµ UI РєРѕРјРїРѕРЅРµРЅС‚С‹ (AssetPanel, DetailsPanel, OutlinerPanel, LayersPanel, SettingsPanel, ActorPropertiesWindow, Toolbar, MenuManager, CanvasRenderer, EventHandlers)
- **Logger РєР°С‚РµРіРѕСЂРёРё**: LIFECYCLE, ERROR_HANDLER РґР»СЏ РЅРѕРІС‹С… СЃРёСЃС‚РµРј
- **LevelEditor.destroy()**: РїРѕР»РЅР°СЏ РѕС‡РёСЃС‚РєР° СЂРµРґР°РєС‚РѕСЂР° СЃ РїСЂР°РІРёР»СЊРЅС‹Рј РїРѕСЂСЏРґРєРѕРј СѓРЅРёС‡С‚РѕР¶РµРЅРёСЏ РєРѕРјРїРѕРЅРµРЅС‚РѕРІ

### Changed
- **EventHandlers**: С‚СЂРµРєРёРЅРі event listeners Рё RAF РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ РѕС‡РёСЃС‚РєРё
- **Logger**: РјРµС‚РѕРґС‹-Р°Р»РёР°СЃС‹ РґР»СЏ РЅРѕРІС‹С… РєР°С‚РµРіРѕСЂРёР№ (Logger.lifecycle, Logger.errorHandler)

### Fixed
- **Memory leaks**: СѓСЃС‚СЂР°РЅРµРЅС‹ СѓС‚РµС‡РєРё РїР°РјСЏС‚Рё РІ event listeners, subscriptions, render loops
- **Component cleanup**: РІСЃРµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅРЅС‹Рµ РєРѕРјРїРѕРЅРµРЅС‚С‹ РєРѕСЂСЂРµРєС‚РЅРѕ РѕС‡РёС‰Р°СЋС‚СЃСЏ РїСЂРё destroy

### Technical
- **ErrorHandler API**: init(), handle(), logError(), getErrorHistory(), getStatistics(), try(), tryAsync()
- **ComponentLifecycle API**: register(), destroy(), destroyAll(), РїСЂРёРѕСЂРёС‚РµС‚С‹ 1-10
- **Custom Error types**: NetworkError, ValidationError, PermissionError, FileNotFoundError
- **Recovery strategies**: Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РґР»СЏ С‚РёРїРѕРІС‹С… РѕС€РёР±РѕРє

---

## [3.32.0] - 2025-10-02

### Added
- **SelectionUtils**: СЂРµР¶РёРјС‹ marquee replace/add/toggle, РµРґРёРЅР°СЏ Р»РѕРіРёРєР° РґР»СЏ РІСЃРµС… РїР°РЅРµР»РµР№

### Changed
- **AssetPanel**: 
  - Ctrl+click+drag Р·Р°РїСѓСЃРєР°РµС‚ СЂР°РјРєСѓ РІ СЂРµР¶РёРјРµ toggle; Ctrl+Shift+drag вЂ” add; РѕР±С‹С‡РЅС‹Р№ drag РїРѕ С„РѕРЅСѓ вЂ” replace
  - Ctrl+click Р±РµР· drag вЂ” РјРіРЅРѕРІРµРЅРЅС‹Р№ toggle Р±РµР· СЂР°РјРєРё (РїРѕСЂРѕРі РґР»СЏ СЂР°РјРєРё 4px)
  - РћС‚РєР»СЋС‡РµРЅРѕ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРµ Р°СЃСЃРµС‚РѕРІ РїРѕ Ctrl+drag РІРѕ РёР·Р±РµР¶Р°РЅРёРµ РєРѕРЅС„Р»РёРєС‚Р° СЃ СЂР°РјРєРѕР№
  - Р’ СЂРµР¶РёРјРµ Details РєР»РёРє РїРѕ РїСЂРѕРјРµР¶СѓС‚РєР°Рј РєРѕР»РѕРЅРѕРє СЃС‡РёС‚Р°РµС‚СЃСЏ РєР»РёРєРѕРј РїРѕ СЃС‚СЂРѕРєРµ
  - РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Р№ `itemSelector` РґР»СЏ РІСЃРµС… СЂРµР¶РёРјРѕРІ (Grid/List/Details)

### Fixed
- **Ctrl+click toggle**: РїРѕС‡РёРЅРµРЅ РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ РІС‹РґРµР»РµРЅРёСЏ РІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ
- **Marquee false positive**: РѕР±С‹С‡РЅС‹Р№ drag РїРѕ СЌР»РµРјРµРЅС‚Сѓ Р±РѕР»СЊС€Рµ РЅРµ Р·Р°РїСѓСЃРєР°РµС‚ СЂР°РјРєСѓ
- **Details gaps**: РєР»РёРєРё РјРµР¶РґСѓ РєРѕР»РѕРЅРєР°РјРё СЃС‡РёС‚Р°СЋС‚СЃСЏ РєР»РёРєР°РјРё РїРѕ СЌР»РµРјРµРЅС‚Сѓ

### Technical
- **SelectionUtils**: РѕС‚Р»РѕР¶РµРЅРЅС‹Р№ СЃС‚Р°СЂС‚ СЂР°РјРєРё РґР»СЏ Ctrl СЃ РїРѕСЂРѕРіРѕРј 4px, pending-СЃРѕСЃС‚РѕСЏРЅРёРµ; С„РёРЅР°Р»РёР·Р°С†РёСЏ РїРѕ СЂРµР¶РёРјР°Рј
- **BasePanel/AssetPanel**: РєРѕСЂСЂРµРєС‚РЅР°СЏ РїРµСЂРµРґР°С‡Р° `itemSelector` Рё РєРѕРЅС‚РµР№РЅРµСЂР° СЃРµР»РµРєС†РёРё

---

## [3.31.0] - 2025-01-29

### Added
- **Custom Dialog System** - РїРѕР»РЅР°СЏ Р·Р°РјРµРЅР° Р±СЂР°СѓР·РµСЂРЅС‹С… РґРёР°Р»РѕРіРѕРІ РЅР° СЃС‚РёР»РёСЃС‚РёС‡РµСЃРєРё РёРґРµРЅС‚РёС‡РЅС‹Рµ СЂРµРґР°РєС‚РѕСЂСѓ
- **FolderPickerDialog** - РєР°СЃС‚РѕРјРЅС‹Р№ РґРёР°Р»РѕРі РІС‹Р±РѕСЂР° РїР°РїРєРё СЃ РїРѕРґРґРµСЂР¶РєРѕР№ File System Access API Рё Drag & Drop
- **UniversalDialog** - СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РґРёР°Р»РѕРі РґР»СЏ Р·Р°РјРµРЅС‹ alert, confirm, prompt
- **DialogReplacer** - СѓС‚РёР»РёС‚Р° РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕР№ Р·Р°РјРµРЅС‹ Р±СЂР°СѓР·РµСЂРЅС‹С… РґРёР°Р»РѕРіРѕРІ
- **File System Access API** - СЃРѕРІСЂРµРјРµРЅРЅС‹Р№ API РґР»СЏ РІС‹Р±РѕСЂР° РїР°РїРѕРє РІ Chrome/Edge
- **Drag & Drop Support** - РїРѕРґРґРµСЂР¶РєР° РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ РїР°РїРѕРє Рё С„Р°Р№Р»РѕРІ РґР»СЏ РІСЃРµС… Р±СЂР°СѓР·РµСЂРѕРІ
- **Asset Import Summary** - РґРµС‚Р°Р»СЊРЅР°СЏ СЃС‚Р°С‚РёСЃС‚РёРєР° РёРјРїРѕСЂС‚РёСЂСѓРµРјС‹С… Р°СЃСЃРµС‚РѕРІ РїРѕ РєР°С‚РµРіРѕСЂРёСЏРј
- **Real-time Path Display** - РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РІС‹Р±СЂР°РЅРЅРѕР№ РїР°РїРєРё РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё

### Changed
- **Asset Import Process** - СѓРїСЂРѕС‰РµРЅ РїСЂРѕС†РµСЃСЃ РёРјРїРѕСЂС‚Р° Р°СЃСЃРµС‚РѕРІ РґРѕ РѕРґРЅРѕРіРѕ РґРµР№СЃС‚РІРёСЏ
- **Dialog Consistency** - РІСЃРµ РґРёР°Р»РѕРіРё С‚РµРїРµСЂСЊ РёРјРµСЋС‚ РµРґРёРЅС‹Р№ СЃС‚РёР»СЊ СЂРµРґР°РєС‚РѕСЂР°
- **Path Display** - СѓР»СѓС‡С€РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РІС‹Р±СЂР°РЅРЅРѕР№ РїР°РїРєРё (С‚РѕР»СЊРєРѕ РёРјСЏ РїР°РїРєРё)
- **Summary Display** - РєРѕР»РёС‡РµСЃС‚РІРѕ С„Р°Р№Р»РѕРІ РІС‹РЅРµСЃРµРЅРѕ РІ РѕС‚РґРµР»СЊРЅСѓСЋ РѕР±Р»Р°СЃС‚СЊ summary
- **Error Handling** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє РїСЂРё РІС‹Р±РѕСЂРµ РїР°РїРѕРє
- **User Experience** - Р·РЅР°С‡РёС‚РµР»СЊРЅРѕ СѓР»СѓС‡С€РµРЅ UX РїСЂРѕС†РµСЃСЃР° РёРјРїРѕСЂС‚Р° Р°СЃСЃРµС‚РѕРІ

### Fixed
- **Syntax Errors** - РёСЃРїСЂР°РІР»РµРЅС‹ РІСЃРµ СЃРёРЅС‚Р°РєСЃРёС‡РµСЃРєРёРµ РѕС€РёР±РєРё СЃ async/await
- **File Object Handling** - РёСЃРїСЂР°РІР»РµРЅР° СЂР°Р±РѕС‚Р° СЃ File РѕР±СЉРµРєС‚Р°РјРё Рё webkitRelativePath
- **Dialog Compatibility** - РѕР±РµСЃРїРµС‡РµРЅР° СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚СЊ СЃ СЂР°Р·Р»РёС‡РЅС‹РјРё Р±СЂР°СѓР·РµСЂР°РјРё
- **Asset Display** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ Р°СЃСЃРµС‚РѕРІ Р±РµР· РёР·РѕР±СЂР°Р¶РµРЅРёР№
- **Path Truncation** - СѓР±СЂР°РЅРѕ РѕР±СЂРµР·Р°РЅРёРµ РїСѓС‚РµР№, РїРѕРєР°Р·С‹РІР°РµС‚СЃСЏ РїРѕР»РЅРѕРµ РёРјСЏ РїР°РїРєРё

### Technical
- **FolderPickerDialog.js** - РЅРѕРІС‹Р№ РєР»Р°СЃСЃ РґР»СЏ РІС‹Р±РѕСЂР° РїР°РїРѕРє СЃ СЃРѕРІСЂРµРјРµРЅРЅС‹РјРё API
- **UniversalDialog.js** - Р±Р°Р·РѕРІС‹Р№ РєР»Р°СЃСЃ РґР»СЏ РІСЃРµС… РєР°СЃС‚РѕРјРЅС‹С… РґРёР°Р»РѕРіРѕРІ
- **DialogReplacer.js** - СѓС‚РёР»РёС‚Р° РґР»СЏ Р·Р°РјРµРЅС‹ Р±СЂР°СѓР·РµСЂРЅС‹С… РґРёР°Р»РѕРіРѕРІ
- **AssetImporter.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ РЅРѕРІС‹Рј РґРёР°Р»РѕРіРѕРј РІС‹Р±РѕСЂР° РїР°РїРєРё
- **LevelEditor.js** - РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° СЃРёСЃС‚РµРјР° РєР°СЃС‚РѕРјРЅС‹С… РґРёР°Р»РѕРіРѕРІ
- **EventHandlers.js** - РѕР±РЅРѕРІР»РµРЅС‹ РѕР±СЂР°Р±РѕС‚С‡РёРєРё СЃРѕР±С‹С‚РёР№ РґР»СЏ async РјРµС‚РѕРґРѕРІ
- **Toolbar.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ async РјРµС‚РѕРґР°РјРё
- **SettingsPanel.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ РєР°СЃС‚РѕРјРЅС‹РјРё РґРёР°Р»РѕРіР°РјРё
- **OutlinerPanel.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ РєР°СЃС‚РѕРјРЅС‹РјРё РґРёР°Р»РѕРіР°РјРё
- **LayersPanel.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ РєР°СЃС‚РѕРјРЅС‹РјРё РґРёР°Р»РѕРіР°РјРё

### Removed
- **Browser Native Dialogs** - РїРѕР»РЅРѕСЃС‚СЊСЋ СѓР±СЂР°РЅС‹ Р±СЂР°СѓР·РµСЂРЅС‹Рµ alert, confirm, prompt
- **WebkitDirectory Fallback** - СѓР±СЂР°РЅ fallback РЅР° webkitdirectory (РІС‹Р·С‹РІР°Р» РґРІРѕР№РЅС‹Рµ РґРёР°Р»РѕРіРё)
- **File Preview Dialog** - СѓР±СЂР°РЅ РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Р№ РґРёР°Р»РѕРі РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅРѕРіРѕ РїСЂРѕСЃРјРѕС‚СЂР°
- **Path Truncation Logic** - СѓР±СЂР°РЅР° Р»РѕРіРёРєР° РѕР±СЂРµР·Р°РЅРёСЏ РїСѓС‚РµР№

## [3.30.2] - 2025-01-29

### Added
- **Asset Import System** - РЅРѕРІР°СЏ СЃРёСЃС‚РµРјР° РёРјРїРѕСЂС‚Р° РІРЅРµС€РЅРёС… Р°СЃСЃРµС‚РѕРІ РІ СЂРµРґР°РєС‚РѕСЂ
- **External Asset Support** - РїРѕРґРґРµСЂР¶РєР° РёРјРїРѕСЂС‚Р° Р°СЃСЃРµС‚РѕРІ РёР· РІРЅРµС€РЅРёС… РїР°РїРѕРє
- **Dynamic Asset Categories** - РґРёРЅР°РјРёС‡РµСЃРєРѕРµ СЃРѕР·РґР°РЅРёРµ РєР°С‚РµРіРѕСЂРёР№ Р°СЃСЃРµС‚РѕРІ РЅР° РѕСЃРЅРѕРІРµ СЃС‚СЂСѓРєС‚СѓСЂС‹ РїР°РїРѕРє
- **AssetImporter Utility** - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ РёРјРїРѕСЂС‚Р° Рё СѓРїСЂР°РІР»РµРЅРёСЏ РІРЅРµС€РЅРёРјРё Р°СЃСЃРµС‚Р°РјРё
- **Folder Structure Analysis** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ Р°РЅР°Р»РёР· СЃС‚СЂСѓРєС‚СѓСЂС‹ РїР°РїРѕРє РґР»СЏ РѕРїСЂРµРґРµР»РµРЅРёСЏ РєР°С‚РµРіРѕСЂРёР№

### Changed
- **Menu Command** - Р·Р°РјРµРЅРµРЅР° РєРѕРјР°РЅРґР° "Settings - Assets Path..." РЅР° "Import Assets..."
- **Asset Panel Tabs** - С‚Р°Р±С‹ СЃРѕР·РґР°СЋС‚СЃСЏ РґРёРЅР°РјРёС‡РµСЃРєРё РЅР° РѕСЃРЅРѕРІРµ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅРЅС‹С… РєР°С‚РµРіРѕСЂРёР№
- **AssetManager Integration** - РёРЅС‚РµРіСЂР°С†РёСЏ СЃ StateManager РґР»СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РєР°С‚РµРіРѕСЂРёР№
- **Asset Categories** - РєР°С‚РµРіРѕСЂРёРё Р°СЃСЃРµС‚РѕРІ С‚РµРїРµСЂСЊ РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё

### Technical
- **AssetImporter.js** - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° СЃ РјРµС‚РѕРґР°РјРё РёРјРїРѕСЂС‚Р°, СЃРєР°РЅРёСЂРѕРІР°РЅРёСЏ Рё СѓРїСЂР°РІР»РµРЅРёСЏ Р°СЃСЃРµС‚Р°РјРё
- **AssetManager.js** - РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ `addExternalAsset()`, `updateStateManagerCategories()`, `clearExternalAssets()`
- **LevelEditor.js** - РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ `importAssets()` РґР»СЏ РёРЅС‚РµРіСЂР°С†РёРё СЃ AssetImporter
- **MenuManager.js** - РѕР±РЅРѕРІР»РµРЅР° РєРѕРјР°РЅРґР° РјРµРЅСЋ РґР»СЏ РІС‹Р·РѕРІР° РёРјРїРѕСЂС‚Р° Р°СЃСЃРµС‚РѕРІ
- **StateManager.js** - РґРѕР±Р°РІР»РµРЅРѕ СЃРѕСЃС‚РѕСЏРЅРёРµ `assetTabOrder` РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РїРѕСЂСЏРґРєРѕРј С‚Р°Р±РѕРІ

### Improved
- **Asset Organization** - СѓР»СѓС‡С€РµРЅР° РѕСЂРіР°РЅРёР·Р°С†РёСЏ Р°СЃСЃРµС‚РѕРІ СЃ РїРѕРґРґРµСЂР¶РєРѕР№ РІРЅРµС€РЅРёС… РёСЃС‚РѕС‡РЅРёРєРѕРІ
- **User Experience** - СѓРїСЂРѕС‰РµРЅ РїСЂРѕС†РµСЃСЃ РґРѕР±Р°РІР»РµРЅРёСЏ РЅРѕРІС‹С… Р°СЃСЃРµС‚РѕРІ РІ СЂРµРґР°РєС‚РѕСЂ
- **Flexibility** - РїРѕРґРґРµСЂР¶РєР° СЂР°Р·Р»РёС‡РЅС‹С… СЃС‚СЂСѓРєС‚СѓСЂ РїР°РїРѕРє Рё РєР°С‚РµРіРѕСЂРёР№ Р°СЃСЃРµС‚РѕРІ
- **Integration** - РїРѕР»РЅР°СЏ РёРЅС‚РµРіСЂР°С†РёСЏ СЃ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ СЃРёСЃС‚РµРјРѕР№ СѓРїСЂР°РІР»РµРЅРёСЏ Р°СЃСЃРµС‚Р°РјРё

## [3.30.1] - 2025-01-29

### Improved
- **MenuManager Hover Experience** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° РєСѓСЂСЃРѕСЂР° РІ РіР»Р°РІРЅРѕРј РјРµРЅСЋ
- **Gap Elimination** - СѓР±СЂР°РЅ РїСЂРѕРјРµР¶СѓС‚РѕРє РјРµР¶РґСѓ РєРЅРѕРїРєРѕР№ Рё РІС‹РїР°РґР°СЋС‰РёРј РјРµРЅСЋ
- **Expanded Hover Area** - СЂР°СЃС€РёСЂРµРЅР° РѕР±Р»Р°СЃС‚СЊ РІС‹РїР°РґР°СЋС‰РµРіРѕ РјРµРЅСЋ РґР»СЏ РїРµСЂРµРєСЂС‹С‚РёСЏ Р·Р°Р·РѕСЂР°
- **Immediate Response** - СѓР±СЂР°РЅР° СЃРёСЃС‚РµРјР° Р·Р°РґРµСЂР¶РµРє, РјРµРЅСЋ СЂРµР°РіРёСЂСѓРµС‚ РјРіРЅРѕРІРµРЅРЅРѕ

### Technical
- **MenuManager.js** - СѓР±СЂР°РЅР° СЃРёСЃС‚РµРјР° `closeTimeouts`, СѓРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° СЃРѕР±С‹С‚РёР№
- **CSS Improvements** - РёР·РјРµРЅРµРЅ `mt-0.5` РЅР° `mt-0` Рё РґРѕР±Р°РІР»РµРЅ `paddingTop: '8px'`
- **Event Handling** - СѓРїСЂРѕС‰РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° `mouseenter`/`mouseleave` СЃРѕР±С‹С‚РёР№
- **Performance** - СѓР±СЂР°РЅС‹ С‚Р°Р№РјРµСЂС‹ Рё СЃР»РѕР¶РЅР°СЏ Р»РѕРіРёРєР° Р·Р°РґРµСЂР¶РµРє

## [3.30.0] - 2025-01-29

### Added
- **ValidationUtils v2.0** - StateManager-based СЃРёСЃС‚РµРјР° РІР°Р»РёРґР°С†РёРё СЃ РєСЌС€РёСЂРѕРІР°РЅРёРµРј
- **Component Readiness Tracking** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ РіРѕС‚РѕРІРЅРѕСЃС‚Рё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **Validation Caching** - РєСЌС€РёСЂРѕРІР°РЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РІР°Р»РёРґР°С†РёРё СЃ TTL
- **Enhanced StateManager** - РґРѕР±Р°РІР»РµРЅС‹ РјРµС‚РѕРґС‹ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ СЃРѕСЃС‚РѕСЏРЅРёРµРј РІР°Р»РёРґР°С†РёРё

### Technical
- **StateManager.js** - РґРѕР±Р°РІР»РµРЅРѕ СЃРѕСЃС‚РѕСЏРЅРёРµ `validation` СЃ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµРј РєРѕРјРїРѕРЅРµРЅС‚РѕРІ Рё РєСЌС€РµРј
- **ValidationUtils.js v2.0** - РїРѕР»РЅР°СЏ РїРµСЂРµСЂР°Р±РѕС‚РєР° СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј StateManager
- **SettingsSyncManager.js** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РЅРѕРІРѕР№ СЃРёСЃС‚РµРјС‹ РІР°Р»РёРґР°С†РёРё
- **Logger Integration** - РёСЃРїСЂР°РІР»РµРЅС‹ РІСЃРµ РІС‹Р·РѕРІС‹ Logger РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ СЂР°Р±РѕС‚С‹

### Improved
- **Performance** - РєСЌС€РёСЂРѕРІР°РЅРёРµ СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ РІР°Р»РёРґР°С†РёРё РїРѕРІС‹С€Р°РµС‚ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ
- **Reliability** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕРµ РѕС‚СЃР»РµР¶РёРІР°РЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **Consistency** - РµРґРёРЅС‹Р№ РїРѕРґС…РѕРґ Рє fallback Р»РѕРіРёРєРµ С‡РµСЂРµР· StateManager
- **Debugging** - СѓР»СѓС‡С€РµРЅРЅРѕРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ С‡РµСЂРµР· Logger API

## [3.29.0] - 2025-01-29

### Added
- **ValidationUtils** - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° РґР»СЏ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅРѕР№ РІР°Р»РёРґР°С†РёРё Рё РїСЂРѕРІРµСЂРѕРє
- **Code Refactoring** - СѓСЃС‚СЂР°РЅРµРЅРёРµ РґСѓР±Р»РёСЂРѕРІР°РЅРЅРѕРіРѕ РєРѕРґР° С‡РµСЂРµР· ValidationUtils
- **Enhanced Error Handling** - СѓР»СѓС‡С€РµРЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° РѕС€РёР±РѕРє СЃ РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅС‹Рј Р»РѕРіРёСЂРѕРІР°РЅРёРµРј
- **Fallback Mechanisms** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ fallback РЅР° window.editor РїСЂРё РЅРµРґРѕСЃС‚СѓРїРЅРѕСЃС‚Рё levelEditor

### Technical
- **ValidationUtils.js** - РЅРѕРІР°СЏ СѓС‚РёР»РёС‚Р° СЃ РјРµС‚РѕРґР°РјРё РІР°Р»РёРґР°С†РёРё, РїСЂРѕРІРµСЂРєРё РєРѕРјРїРѕРЅРµРЅС‚РѕРІ Рё fallback Р»РѕРіРёРєРѕР№
- **SettingsSyncManager.js** - СЂРµС„Р°РєС‚РѕСЂРёРЅРі РІСЃРµС… РјРµС‚РѕРґРѕРІ РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ ValidationUtils
- **SettingsPanel.js** - СЂРµС„Р°РєС‚РѕСЂРёРЅРі РјРµС‚РѕРґРѕРІ РІР°Р»РёРґР°С†РёРё С‡РµСЂРµР· ValidationUtils
- **Code Deduplication** - СѓСЃС‚СЂР°РЅРµРЅРёРµ 200+ СЃС‚СЂРѕРє РґСѓР±Р»РёСЂРѕРІР°РЅРЅРѕРіРѕ РєРѕРґР° РїСЂРѕРІРµСЂРѕРє

## [3.28.0] - 2025-01-29

### Added
- **Menu Hover Mode** - РґРѕР±Р°РІР»РµРЅ СЂРµР¶РёРј Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРіРѕ РѕС‚РєСЂС‹С‚РёСЏ РјРµРЅСЋ РїСЂРё РЅР°РІРµРґРµРЅРёРё РєСѓСЂСЃРѕСЂР° РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ РєР»РёРєР°
- **Smart Hover Reset** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕС‚РєР»СЋС‡РµРЅРёРµ hover-СЂРµР¶РёРјР° РїСЂРё РІС‹С…РѕРґРµ РєСѓСЂСЃРѕСЂР° Р·Р° РїСЂРµРґРµР»С‹ РєРѕРЅС‚РµР№РЅРµСЂР° РјРµРЅСЋ
- **Interactive Font Scaling** - РёРЅС‚РµСЂР°РєС‚РёРІРЅРѕРµ РёР·РјРµРЅРµРЅРёРµ СЂР°Р·РјРµСЂР° С€СЂРёС„С‚Р° РїСЂРё РґРІРёР¶РµРЅРёРё СЃР»Р°Р№РґРµСЂР° Font Size
- **Spacing Control Enhancement** - СѓР»СѓС‡С€РµРЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ РѕС‚СЃС‚СѓРїР°РјРё СЃ РјРёРЅРёРјР°Р»СЊРЅС‹РјРё Р·РЅР°С‡РµРЅРёСЏРјРё РґР»СЏ РІСЃРµС… UI СЌР»РµРјРµРЅС‚РѕРІ

### Fixed
- **Settings Reset Flow** - РёСЃРїСЂР°РІР»РµРЅ РїРѕС‚РѕРє СЃР±СЂРѕСЃР° РЅР°СЃС‚СЂРѕРµРє: ConfigManager в†’ StateManager в†’ UI в†’ СЃРѕС…СЂР°РЅРµРЅРёРµ
- **Grid Settings Integration** - РїРµСЂРµРЅРµСЃРµРЅ РїР°СЂР°РјРµС‚СЂ "Show Grid" РІ СЃРµРєС†РёСЋ "Grid & Snapping" РґР»СЏ Р»СѓС‡С€РµР№ РѕСЂРіР°РЅРёР·Р°С†РёРё
- **State Synchronization** - СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РјРµР¶РґСѓ `view.grid` Рё `canvas.showGrid`, СѓСЃС‚Р°РЅРѕРІР»РµРЅ РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹
- **AutoSave Configuration** - РёСЃРїСЂР°РІР»РµРЅС‹ РЅР°СЃС‚СЂРѕР№РєРё Р°РІС‚РѕСЃРѕС…СЂР°РЅРµРЅРёСЏ: РѕС‚РєР»СЋС‡РµРЅРѕ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ, РёРЅС‚РµСЂРІР°Р» РІ РјРёРЅСѓС‚Р°С…
- **Asset Panel Spacing** - РґРѕР±Р°РІР»РµРЅС‹ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Рµ РѕС‚СЃС‚СѓРїС‹ РґР»СЏ С‚Р°Р±РѕРІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ, СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ СЃ РїСЂР°РІРѕР№ РїР°РЅРµР»СЊСЋ
- **Ctrl+Scroll Prevention** - РѕС‚РєР»СЋС‡РµРЅ СЃРєСЂРѕР»Р» РєРѕРЅС‚РµРЅС‚Р° РїСЂРё Ctrl+scroll РІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ (С‚РѕР»СЊРєРѕ РёР·РјРµРЅРµРЅРёРµ СЂР°Р·РјРµСЂР° СЌР»РµРјРµРЅС‚РѕРІ)

### Technical
- **MenuManager.js** - РґРѕР±Р°РІР»РµРЅ `hoverModeEnabled` С„Р»Р°Рі Рё `setupMenuContainerHoverReset()` РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ hover-СЂРµР¶РёРјРѕРј
- **SettingsSyncManager.js** - СѓР»СѓС‡С€РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РјРµР¶РґСѓ UI, ConfigManager Рё StateManager СЃ Р·Р°С‰РёС‚РѕР№ РѕС‚ Р±РµСЃРєРѕРЅРµС‡РЅС‹С… С†РёРєР»РѕРІ
- **SettingsPanel.js** - РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РѕРїРµСЂР°С†РёР№ РІ `resetToDefaults()` РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ СЃР±СЂРѕСЃР° РЅР°СЃС‚СЂРѕРµРє
- **GridSettings.js** - РїРµСЂРµРЅРµСЃРµРЅ "Show Grid" РёР· РѕР±С‰РёС… РЅР°СЃС‚СЂРѕРµРє РІ СЃРµРєС†РёСЋ РіСЂРёРґР°
- **CSS Custom Properties** - РґРѕР±Р°РІР»РµРЅС‹ `--font-scale` Рё `--spacing-scale` РґР»СЏ РґРёРЅР°РјРёС‡РµСЃРєРѕРіРѕ РјР°СЃС€С‚Р°Р±РёСЂРѕРІР°РЅРёСЏ UI
- **State Management** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРѕ СѓРїСЂР°РІР»РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёРµРј С‡РµСЂРµР· StateManager РєР°Рє РµРґРёРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє РёСЃС‚РёРЅС‹

## [3.27.1] - 2025-01-29

### Fixed
- **Settings Initialization** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµРј autoSaveInterval РїСЂРё Р·Р°РіСЂСѓР·РєРµ РѕРєРЅР° РЅР°СЃС‚СЂРѕРµРє (РїРѕРєР°Р·С‹РІР°Р»Рѕ 300000 РІРјРµСЃС‚Рѕ 5 РјРёРЅСѓС‚)
- **State Synchronization** - РґРѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ syncFromConfigToState() РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ SettingsPanel РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕР№ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
- **Configuration Flow** - РёСЃРїСЂР°РІР»РµРЅ РїРѕС‚РѕРє РёРЅРёС†РёР°Р»РёР·Р°С†РёРё, С‚РµРїРµСЂСЊ StateManager РїСЂР°РІРёР»СЊРЅРѕ СЃРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚СЃСЏ СЃ ConfigManager РїСЂРё Р·Р°РїСѓСЃРєРµ

### Technical
- **SettingsPanel.js** - РґРѕР±Р°РІР»РµРЅ РІС‹Р·РѕРІ syncFromConfigToState() РІ РєРѕРЅСЃС‚СЂСѓРєС‚РѕСЂ РґР»СЏ РїСЂР°РІРёР»СЊРЅРѕР№ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё
- **State Management** - РѕР±РµСЃРїРµС‡РµРЅР° РєРѕСЂСЂРµРєС‚РЅР°СЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ StateManager СЃ ConfigManager РїСЂРё СЃРѕР·РґР°РЅРёРё SettingsPanel
- **Configuration Consistency** - СѓСЃС‚СЂР°РЅРµРЅРѕ СЂР°СЃС…РѕР¶РґРµРЅРёРµ РјРµР¶РґСѓ Р·Р°РіСЂСѓР·РєРѕР№ РѕРєРЅР° (300000) Рё СЃР±СЂРѕСЃРѕРј (5) Р·РЅР°С‡РµРЅРёР№

## [3.27.0] - 2025-01-29

### Fixed
- **Asset Panel Selection** - РёСЃРїСЂР°РІР»РµРЅР° РїРѕРґСЃРІРµС‚РєР° РІС‹Р±СЂР°РЅРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ РІ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ РІРѕ РІСЃРµС… СЂРµР¶РёРјР°С… (Grid, List, Details)
- **CSS Architecture Compliance** - СѓСЃС‚СЂР°РЅРµРЅС‹ РІСЃРµ inline-СЃС‚РёР»Рё РІ AssetPanel, С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ CSS-РєР»Р°СЃСЃС‹
- **Selection Visual Consistency** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ СЃС‚РёР»Рё СЃРµР»РµРєС†РёРё РґР»СЏ РІСЃРµС… СЂРµР¶РёРјРѕРІ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ Р°СЃСЃРµС‚РѕРІ
- **Hover Effects Integration** - РёСЃРїСЂР°РІР»РµРЅР° СЂР°Р±РѕС‚Р° HoverEffects СЃ CSS-РєР»Р°СЃСЃР°РјРё, СЃРѕС…СЂР°РЅРµРЅРёРµ СЃРµР»РµРєС†РёРё РїСЂРё СѓРІРѕРґРµ РєСѓСЂСЃРѕСЂР°
- **Empty Space Click** - РєРѕСЂСЂРµРєС‚РЅС‹Р№ СЃР±СЂРѕСЃ СЃРµР»РµРєС†РёРё РїСЂРё РєР»РёРєРµ РІ РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ РІРѕ РІСЃРµС… СЂРµР¶РёРјР°С…

### Technical
- **CSS Classes Unification** - РґРѕР±Р°РІР»РµРЅС‹ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹Рµ CSS-РєР»Р°СЃСЃС‹ `.asset-list-item.selected` Рё `.asset-details-row.selected`
- **Inline Styles Removal** - СѓРґР°Р»РµРЅС‹ РІСЃРµ inline-СЃС‚РёР»Рё РёР· `updateSelectionVisuals()` Рё РјРµС‚РѕРґРѕРІ СЃРѕР·РґР°РЅРёСЏ СЌР»РµРјРµРЅС‚РѕРІ
- **HoverEffects Preservation** - РёСЃРїСЂР°РІР»РµРЅ `removeHoverEffect()` РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РєР»Р°СЃСЃРѕРІ СЃРµР»РµРєС†РёРё РїСЂРё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРё СЃС‚РёР»РµР№
- **Selection State Management** - СѓР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° СЃР±СЂРѕСЃР° СЃРµР»РµРєС†РёРё РїСЂРё РєР»РёРєРµ РІ РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ

## [3.26.1] - 2025-01-29

### Fixed
- **Color Conversion Refactoring** - СѓСЃС‚СЂР°РЅРµРЅ inline РєРѕРґ РєРѕРЅРІРµСЂС‚Р°С†РёРё С†РІРµС‚РѕРІ, С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ СѓС‚РёР»РёС‚Р° ColorUtils
- **BaseGridRenderer** - Р·Р°РјРµРЅРµРЅ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹Р№ РјРµС‚РѕРґ hexToRgba РЅР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ ColorUtils.toRgba
- **GridSettings** - СѓРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° РїСЂРёРјРµРЅРµРЅРёСЏ opacity Рє С†РІРµС‚Р°Рј РіСЂРёРґР° С‡РµСЂРµР· ColorUtils
- **LevelEditor** - Р·Р°РјРµРЅРµРЅС‹ inline РєРѕРЅРІРµСЂС‚Р°С†РёРё hexв†’rgba РЅР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ ColorUtils

### Technical
- **ColorUtils Integration** - РІСЃРµ РєРѕРјРїРѕРЅРµРЅС‚С‹ С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓСЋС‚ РµРґРёРЅСѓСЋ СѓС‚РёР»РёС‚Сѓ ColorUtils РґР»СЏ РєРѕРЅРІРµСЂС‚Р°С†РёРё С†РІРµС‚РѕРІ
- **Code Deduplication** - СѓРґР°Р»РµРЅС‹ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹Рµ РјРµС‚РѕРґС‹ РєРѕРЅРІРµСЂС‚Р°С†РёРё С†РІРµС‚РѕРІ РІ СЂР°Р·РЅС‹С… РјРѕРґСѓР»СЏС…

## [3.26.0] - 2025-01-29

### Added
- **Hotkeys Settings Section** - РґРѕР±Р°РІР»РµРЅР° РЅРѕРІР°СЏ СЃРµРєС†РёСЏ "Hotkeys" РІ РѕРєРЅРµ РЅР°СЃС‚СЂРѕРµРє СЃ РїРѕР»РЅС‹Рј СЃРїРёСЃРєРѕРј РІСЃРµС… РіРѕСЂСЏС‡РёС… РєР»Р°РІРёС€
- **Hotkey Customization** - РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РїРµСЂРµРЅР°Р·РЅР°С‡РµРЅРёСЏ РіРѕСЂСЏС‡РёС… РєР»Р°РІРёС€ С‡РµСЂРµР· РёРЅС‚РµСЂС„РµР№СЃ РЅР°СЃС‚СЂРѕРµРє
- **Shortcuts Configuration** - РІС‹РЅРµСЃРµРЅС‹ РІСЃРµ РіРѕСЂСЏС‡РёРµ РєР»Р°РІРёС€Рё РІ РѕС‚РґРµР»СЊРЅС‹Р№ С„Р°Р№Р» `config/defaults/shortcuts.json`
- **Toolbar Configuration** - РґРѕР±Р°РІР»РµРЅ С„Р°Р№Р» `config/defaults/toolbar.json` РґР»СЏ РЅР°СЃС‚СЂРѕРµРє С‚СѓР»Р±Р°СЂР°
- **Asset Panel Persistence** - СЃРѕС…СЂР°РЅРµРЅРёРµ СЂР°Р·РјРµСЂР° СЌР»РµРјРµРЅС‚РѕРІ Рё СЂРµР¶РёРјР° РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ (Grid/List/Details) РїР°РЅРµР»Рё assets
- **Escape Key Support** - РґРѕР±Р°РІР»РµРЅР° РѕС‚РјРµРЅР° РёР·РјРµРЅРµРЅРёР№ РІ РѕРєРЅРµ РЅР°СЃС‚СЂРѕРµРє РєР»Р°РІРёС€РµР№ Esc

### Fixed
- **Settings Synchronization** - РёСЃРїСЂР°РІР»РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РЅР°СЃС‚СЂРѕРµРє РјРµР¶РґСѓ РѕРєРЅРѕРј settings, С‚СѓР»Р±Р°СЂРѕРј Рё РѕСЃРЅРѕРІРЅС‹Рј РјРµРЅСЋ
- **Snap to Grid Conflicts** - СѓСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РІ СЃРёСЃС‚РµРјРµ snap to grid РјРµР¶РґСѓ СЂР°Р·Р»РёС‡РЅС‹РјРё РёСЃС‚РѕС‡РЅРёРєР°РјРё
- **Settings Save Performance** - РёР·РјРµРЅРµРЅР° СЃРёСЃС‚РµРјР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє - С‚РµРїРµСЂСЊ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё Р·Р°РєСЂС‹С‚РёРё/РїРµСЂРµР·Р°РіСЂСѓР·РєРµ СЃС‚СЂР°РЅРёС†С‹, Р° РЅРµ РїСЂРё РєР°Р¶РґРѕРј РёР·РјРµРЅРµРЅРёРё
- **Asset Panel State** - РёСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РїР°РЅРµР»Рё assets РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ
- **Configuration Architecture** - СѓР»СѓС‡С€РµРЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё СЃ РїРѕРґРґРµСЂР¶РєРѕР№ РЅРѕРІС‹С… С‚РёРїРѕРІ РЅР°СЃС‚СЂРѕРµРє

### Improved
- **Settings Panel UX** - СѓР»СѓС‡С€РµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РёРЅС‚РµСЂС„РµР№СЃ РїР°РЅРµР»Рё РЅР°СЃС‚СЂРѕРµРє
- **Real-time Sync** - РґРѕР±Р°РІР»РµРЅР° РґРІСѓСЃС‚РѕСЂРѕРЅРЅСЏСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РЅР°СЃС‚СЂРѕРµРє РјРµР¶РґСѓ UI Рё StateManager
- **Compact Settings Style** - СѓРїСЂРѕС‰РµРЅ Рё РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅ СЃС‚РёР»СЊ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє
- **Configuration Files** - СЃС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅС‹ РєРѕРЅС„РёРіСѓСЂР°С†РёРѕРЅРЅС‹Рµ С„Р°Р№Р»С‹ РїРѕ РЅР°Р·РЅР°С‡РµРЅРёСЋ
- **Performance Optimization** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ Р·Р° СЃС‡РµС‚ СѓРјРµРЅСЊС€РµРЅРёСЏ РѕРїРµСЂР°С†РёР№ СЃ localStorage

### Technical
- **SettingsSyncManager** - СЃРѕР·РґР°РЅ СѓРЅРёРІРµСЂСЃР°Р»СЊРЅС‹Р№ РјРµРЅРµРґР¶РµСЂ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё РЅР°СЃС‚СЂРѕРµРє
- **ConfigManager Extensions** - СЂР°СЃС€РёСЂРµРЅР° С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ ConfigManager РґР»СЏ РїРѕРґРґРµСЂР¶РєРё toolbar Рё shortcuts
- **UserPreferencesManager** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РЅРѕРІС‹С… С‚РёРїРѕРІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕРµРє
- **Settings Panel Architecture** - СЂРµРѕСЂРіР°РЅРёР·РѕРІР°РЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° РїР°РЅРµР»Рё РЅР°СЃС‚СЂРѕРµРє СЃ РїРѕРґРґРµСЂР¶РєРѕР№ РЅРѕРІС‹С… СЃРµРєС†РёР№
- **Debounced Saving** - СЂРµР°Р»РёР·РѕРІР°РЅР° РѕС‚Р»РѕР¶РµРЅРЅР°СЏ СЃРёСЃС‚РµРјР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє
- **StateManager Integration** - СѓР»СѓС‡С€РµРЅР° РёРЅС‚РµРіСЂР°С†РёСЏ СЃ StateManager РґР»СЏ РјРіРЅРѕРІРµРЅРЅРѕР№ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёРё

## [3.25.0] - 2025-01-27

### Fixed
- **Console Context Menu Positioning** - РёСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РєРѕРЅСЃРѕР»Рё РїРѕСЃР»Рµ РїРµСЂРµРЅРѕСЃР° РІ РѕРІРµСЂР»РµР№
- **Console Menu Inheritance** - РїРµСЂРµРїРёСЃР°РЅ ConsoleContextMenu РґР»СЏ РЅР°СЃР»РµРґРѕРІР°РЅРёСЏ РѕС‚ BaseContextMenu
- **Console State Synchronization** - РёСЃРїСЂР°РІР»РµРЅ СЂР°СЃСЃРёРЅС…СЂРѕРЅ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРѕРЅСЃРѕР»Рё РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ РїСЂРёР»РѕР¶РµРЅРёСЏ
- **Console Height Persistence** - РёСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ СЂР°Р·РјРµСЂР° РєРѕРЅСЃРѕР»Рё РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…
- **Console Resize Functionality** - РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅР° РІРѕР·РјРѕР¶РЅРѕСЃС‚СЊ РёР·РјРµРЅРµРЅРёСЏ СЂР°Р·РјРµСЂР° РєРѕРЅСЃРѕР»Рё
- **Console Content Display** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕРїР°Р¶Р° СЃРѕРґРµСЂР¶РёРјРѕРіРѕ РєРѕРЅСЃРѕР»Рё РїРѕСЃР»Рµ СЂРµС„Р°РєС‚РѕСЂРёРЅРіР°

### Improved
- **Console Overlay Integration** - РєРѕРЅСЃРѕР»СЊ РїРѕР»РЅРѕСЃС‚СЊСЋ РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РєР°Рє РѕРІРµСЂР»РµР№ СЃ РїСЂР°РІРёР»СЊРЅС‹Рј РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµРј
- **Context Menu Architecture** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ С‡РµСЂРµР· РЅР°СЃР»РµРґРѕРІР°РЅРёРµ РѕС‚ BaseContextMenu
- **Console Menu Management** - РґРѕР±Р°РІР»РµРЅРѕ РїСЂРёРЅСѓРґРёС‚РµР»СЊРЅРѕРµ СѓРґР°Р»РµРЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РїСЂРё Р·Р°РєСЂС‹С‚РёРё РєРѕРЅСЃРѕР»Рё
- **Console Positioning** - РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ С‚РµРїРµСЂСЊ РїРѕСЏРІР»СЏРµС‚СЃСЏ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј Рё РїРѕРІРµСЂС… РІСЃРµС… СЌР»РµРјРµРЅС‚РѕРІ
- **Console Visibility Detection** - СѓР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° РѕРїСЂРµРґРµР»РµРЅРёСЏ РІРёРґРёРјРѕСЃС‚Рё РєРѕРЅСЃРѕР»Рё РґР»СЏ РїРѕРєР°Р·Р° РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ

### Technical
- **BaseContextMenu Integration** - ConsoleContextMenu С‚РµРїРµСЂСЊ РЅР°СЃР»РµРґСѓРµС‚СЃСЏ РѕС‚ BaseContextMenu
- **Fixed Positioning** - РёР·РјРµРЅРµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ СЃ absolute РЅР° fixed РґР»СЏ РѕРІРµСЂР»РµРµРІ
- **Event Handling** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№ РјС‹С€Рё РґР»СЏ РєРѕРЅСЃРѕР»Рё СЃ РёСЃРєР»СЋС‡РµРЅРёСЏРјРё РґР»СЏ resize handle
- **State Management** - СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅРѕ СЃРѕСЃС‚РѕСЏРЅРёРµ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ РјРµР¶РґСѓ ConsoleContextMenu Рё РѕСЃРЅРѕРІРЅС‹Рј РєРѕРґРѕРј

## [3.24.0] - 2025-01-27

### Fixed
- **CSS Architecture** - РїРѕР»РЅРѕСЃС‚СЊСЋ СЂРµРѕСЂРіР°РЅРёР·РѕРІР°РЅР° CSS Р°СЂС…РёС‚РµРєС‚СѓСЂР° СЃ РјРѕРґСѓР»СЊРЅРѕР№ СЃС‚СЂСѓРєС‚СѓСЂРѕР№
- **Inline Styles Cleanup** - СѓР±СЂР°РЅС‹ РІСЃРµ inline СЃС‚РёР»Рё РёР· HTML Рё JavaScript С„Р°Р№Р»РѕРІ
- **Duplicate Styles** - СѓСЃС‚СЂР°РЅРµРЅС‹ РґСѓР±Р»РёСЂСѓСЋС‰РёРµСЃСЏ CSS СЃС‚РёР»Рё РјРµР¶РґСѓ С„Р°Р№Р»Р°РјРё
- **Checkbox Colors** - РёСЃРїСЂР°РІР»РµРЅ С†РІРµС‚ С‡РµРєР±РѕРєСЃРѕРІ РІ РјРµРЅСЋ С„РёР»СЊС‚СЂРѕРІ (Р·РµР»РµРЅС‹Р№ в†’ СЃРёРЅРёР№)
- **Grid Settings Styling** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР° РїРѕСЃР»Рµ СЂРµС„Р°РєС‚РѕСЂРёРЅРіР° CSS
- **Tab Styles Unification** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ СЃС‚РёР»Рё С‚Р°Р±РѕРІ РјРµР¶РґСѓ AssetPanel Рё РїСЂР°РІРѕР№ РїР°РЅРµР»СЊСЋ

### Improved
- **Modular CSS** - СЃРѕР·РґР°РЅР° РјРѕРґСѓР»СЊРЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР° CSS С„Р°Р№Р»РѕРІ РІ РїР°РїРєРµ `styles/`
- **Unified Classes** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ CSS РєР»Р°СЃСЃС‹ РґР»СЏ С„РѕСЂРј Рё РЅР°СЃС‚СЂРѕРµРє
- **Hover Effects** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅР° СЃРёСЃС‚РµРјР° hover СЌС„С„РµРєС‚РѕРІ С‡РµСЂРµР· HoverEffects utility
- **Compact Mode** - СѓР»СѓС‡С€РµРЅР° РїРѕРґРґРµСЂР¶РєР° РєРѕРјРїР°РєС‚РЅРѕРіРѕ СЂРµР¶РёРјР° РґР»СЏ РІСЃРµС… РєРѕРјРїРѕРЅРµРЅС‚РѕРІ
- **Performance** - CSS С„Р°Р№Р»С‹ С‚РµРїРµСЂСЊ РєСЌС€РёСЂСѓСЋС‚СЃСЏ Р±СЂР°СѓР·РµСЂРѕРј
- **Tab Consistency** - РµРґРёРЅРѕРѕР±СЂР°Р·РЅС‹Р№ РІРЅРµС€РЅРёР№ РІРёРґ РІСЃРµС… С‚Р°Р±РѕРІ РІ РїСЂРёР»РѕР¶РµРЅРёРё

### Technical
- **CSS Files Created** - СЃРѕР·РґР°РЅС‹ СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Рµ CSS С„Р°Р№Р»С‹:
  - `styles/panels.css` - РѕСЃРЅРѕРІРЅС‹Рµ СЃС‚РёР»Рё РїР°РЅРµР»РµР№
  - `styles/layers-panel.css` - СЃС‚РёР»Рё РїР°РЅРµР»Рё СЃР»РѕРµРІ
  - `styles/settings-panel.css` - СЃС‚РёР»Рё РїР°РЅРµР»Рё РЅР°СЃС‚СЂРѕРµРє
  - `styles/grid-settings.css` - СЃС‚РёР»Рё РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР°
  - `styles/details-panel.css` - СЃС‚РёР»Рё РїР°РЅРµР»Рё РґРµС‚Р°Р»РµР№
  - `styles/color-chooser.css` - СЃС‚РёР»Рё РІС‹Р±РѕСЂР° С†РІРµС‚Р°
- **HoverEffects Utility** - СЃРѕР·РґР°РЅ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№ РєР»Р°СЃСЃ РґР»СЏ hover СЌС„С„РµРєС‚РѕРІ
- **CSS Variables** - РґРѕР±Р°РІР»РµРЅС‹ CSS РїРµСЂРµРјРµРЅРЅС‹Рµ РґР»СЏ accent-color Рё font-scale
- **Global Styles** - РґРѕР±Р°РІР»РµРЅС‹ РіР»РѕР±Р°Р»СЊРЅС‹Рµ СЃС‚РёР»Рё РґР»СЏ С‡РµРєР±РѕРєСЃРѕРІ, СЂР°РґРёРѕ РєРЅРѕРїРѕРє Рё СЃР»Р°Р№РґРµСЂРѕРІ
- **Unified Tab System** - СЃРѕР·РґР°РЅР° РµРґРёРЅР°СЏ СЃРёСЃС‚РµРјР° СЃС‚РёР»РµР№ РґР»СЏ РІСЃРµС… С‚Р°Р±РѕРІ (.tab, .tab-right)

## [3.23.0] - 2025-01-27

### Fixed
- **Context Menu Positioning** - РёСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ РІ LayersPanel Рё OutlinerPanel
- **Panel Boundary Detection** - РєРѕРЅС‚РµРєСЃС‚РЅС‹Рµ РјРµРЅСЋ С‚РµРїРµСЂСЊ РїРѕР·РёС†РёРѕРЅРёСЂСѓСЋС‚СЃСЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РїР°РЅРµР»Рё, Р° РЅРµ РІРЅСѓС‚СЂРµРЅРЅРµРіРѕ РєРѕРЅС‚РµР№РЅРµСЂР°
- **Menu Stability** - РїРѕР·РёС†РёСЏ РјРµРЅСЋ Р±РѕР»СЊС€Рµ РЅРµ Р·Р°РІРёСЃРёС‚ РѕС‚ РєРѕР»РёС‡РµСЃС‚РІР° СЌР»РµРјРµРЅС‚РѕРІ РІ РїР°РЅРµР»Рё

### Improved
- **Unified Separators** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ СЃС‚РёР»Рё СЃРµРїР°СЂР°С‚РѕСЂРѕРІ РІРѕ РІСЃРµС… РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- **Disabled States** - РЅРµРґРѕСЃС‚СѓРїРЅС‹Рµ РєРѕРјР°РЅРґС‹ С‚РµРїРµСЂСЊ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РєР°Рє РЅРµР°РєС‚РёРІРЅС‹Рµ РІРјРµСЃС‚Рѕ СЃРєСЂС‹С‚РёСЏ
- **Menu Positioning Logic** - СѓР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ СЃ СѓС‡РµС‚РѕРј РіСЂР°РЅРёС† РїР°РЅРµР»Рё
- **Ultra-Compact Mode** - Р·РЅР°С‡РёС‚РµР»СЊРЅРѕ СѓСЃРёР»РµРЅ РєРѕРјРїР°РєС‚РЅС‹Р№ СЂРµР¶РёРј СЃ СЂР°Р·РјРµСЂРѕРј С€СЂРёС„С‚Р° 12px Рё РјРёРЅРёРјР°Р»СЊРЅС‹РјРё РѕС‚СЃС‚СѓРїР°РјРё

### Technical
- **LayersContextMenu** - СЃРѕР·РґР°РЅ СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ РєР»Р°СЃСЃ РґР»СЏ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ СЃР»РѕРµРІ
- **BaseContextMenu** - СѓР»СѓС‡С€РµРЅР° РїРѕРґРґРµСЂР¶РєР° disabled СЃРѕСЃС‚РѕСЏРЅРёР№ Рё СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅС‹С… СЃРµРїР°СЂР°С‚РѕСЂРѕРІ
- **Panel Integration** - РёСЃРїСЂР°РІР»РµРЅР° РёРЅС‚РµРіСЂР°С†РёСЏ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ СЃ РїР°РЅРµР»СЏРјРё С‡РµСЂРµР· parentElement
- **CSS Organization** - СЂРµРѕСЂРіР°РЅРёР·РѕРІР°РЅС‹ СЃС‚РёР»Рё РІ РјРѕРґСѓР»СЊРЅСѓСЋ СЃС‚СЂСѓРєС‚СѓСЂСѓ РІ РїР°РїРєРµ `styles/`
- **Compact Mode** - СЂРµР°Р»РёР·РѕРІР°РЅ РїРѕР»РЅРѕС„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕРјРїР°РєС‚РЅС‹Р№ СЂРµР¶РёРј РёРЅС‚РµСЂС„РµР№СЃР°

## [3.22.0] - 2025-01-27

### Improved
- **AssetPanel Grid View** - СѓР»СѓС‡С€РµРЅ hover СЌС„С„РµРєС‚: СѓР±СЂР°РЅРѕ СѓРІРµР»РёС‡РµРЅРёРµ, РґРѕР±Р°РІР»РµРЅРѕ РІС‹СЃРІРµС‚Р»РµРЅРёРµ СЌР»РµРјРµРЅС‚РѕРІ
- **Marquee Selection** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґСЃРІРµС‚РєР° СЌР»РµРјРµРЅС‚РѕРІ РїСЂРё СЃРµР»РµРєС‚Рµ СЂР°РјРєРѕР№ РІРѕ РІСЃРµС… СЂРµР¶РёРјР°С… РїСЂРѕСЃРјРѕС‚СЂР°
- **Selection Visual Feedback** - РµРґРёРЅРѕРѕР±СЂР°Р·РЅР°СЏ РїРѕРґСЃРІРµС‚РєР° РїСЂРё hover Рё СЃРµР»РµРєС‚Рµ СЂР°РјРєРѕР№
- **AssetPanel Context Menu** - СѓР±СЂР°РЅР° РєРѕРјР°РЅРґР° "Deselect All Assets" РёР· РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РїР°РЅРµР»Рё
- **Scroll Position** - РёСЃРїСЂР°РІР»РµРЅ СЃР±СЂРѕСЃ РїРѕР·РёС†РёРё СЃРєСЂРѕР»Р»Р° РїСЂРё РєР»РёРєРµ РІ РїСѓСЃС‚РѕРµ РјРµСЃС‚Рѕ РїР°РЅРµР»Рё Р°СЃСЃРµС‚РѕРІ

### Technical
- **AssetPanel Performance** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ РІС‹РґРµР»РµРЅРёСЏ Р±РµР· РїРµСЂРµСЃРѕР·РґР°РЅРёСЏ РєРѕРЅС‚РµРЅС‚Р°
- **Marquee Highlighting** - СЂРµР°Р»РёР·РѕРІР°РЅР° СЃРёСЃС‚РµРјР° РїРѕРґСЃРІРµС‚РєРё СЌР»РµРјРµРЅС‚РѕРІ РїСЂРё СЃРµР»РµРєС‚Рµ СЂР°РјРєРѕР№
- **Hover Effects** - СѓРЅРёС„РёС†РёСЂРѕРІР°РЅС‹ hover СЌС„С„РµРєС‚С‹ РґР»СЏ РІСЃРµС… СЂРµР¶РёРјРѕРІ РїСЂРѕСЃРјРѕС‚СЂР°
- **Event Handling** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№ РјС‹С€Рё РґР»СЏ СЃРµР»РµРєС‚Р° СЂР°РјРєРѕР№

## [3.21.0] - 2025-01-27

### Improved
- **AssetPanel Details View** - РёСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ С€Р°РїРєРё СЃ РєРѕР»РѕРЅРєР°РјРё Р°С‚СЂРёР±СѓС‚РѕРІ
- **Sticky Header Behavior** - С€Р°РїРєР° С‚РµРїРµСЂСЊ РїСЂР°РІРёР»СЊРЅРѕ РІС‹СЂР°РІРЅРёРІР°РµС‚СЃСЏ РІСЃС‚С‹Рє СЃ С‚Р°Р±Р°РјРё Рё СЃР»РµРґСѓРµС‚ Р·Р° РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Рј СЃРєСЂРѕР»Р»РѕРј
- **Hexagonal Grid Performance** - РєР°СЂРґРёРЅР°Р»СЊРЅРѕ РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ РіРµРєСЃР°РіРѕРЅР°Р»СЊРЅРѕРіРѕ РіСЂРёРґР°
- **Grid Size Limits** - СѓРІРµР»РёС‡РµРЅ РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЂР°Р·РјРµСЂ РіСЂРёРґР° СЃ 128px РґРѕ 512px
- **Grid Overlap Optimization** - РјРёРЅРёРјРёР·РёСЂРѕРІР°РЅ РїРµСЂРµС…Р»РµСЃС‚ РіРµРєСЃР°РіРѕРЅРѕРІ Р·Р° РїСЂРµРґРµР»Р°РјРё СЌРєСЂР°РЅР°
- **Input Validation** - РґРѕР±Р°РІР»РµРЅР° РІР°Р»РёРґР°С†РёСЏ РІРІРѕРґР° РґР»СЏ СЂР°Р·РјРµСЂР° РіСЂРёРґР° (8-512px)

### Technical
- **AssetPanel Structure** - СѓРїСЂРѕС‰РµРЅР° СЃС‚СЂСѓРєС‚СѓСЂР° РєРѕРЅС‚РµР№РЅРµСЂРѕРІ РґР»СЏ РЅР°РґРµР¶РЅРѕРіРѕ sticky РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ
- **Padding Management** - РґРёРЅР°РјРёС‡РµСЃРєРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ padding РґР»СЏ СЂР°Р·РЅС‹С… СЂРµР¶РёРјРѕРІ РїСЂРѕСЃРјРѕС‚СЂР°
- **HexagonalGridRenderer** - СѓРїСЂРѕС‰РµРЅ СЂРµРЅРґРµСЂРёРЅРі, СѓР±СЂР°РЅР° СЃР»РѕР¶РЅР°СЏ LOD СЃРёСЃС‚РµРјР°
- **ConfigManager** - РѕР±РЅРѕРІР»РµРЅР° РІР°Р»РёРґР°С†РёСЏ gridSize РґРѕ 512px
- **GridSettings** - РґРѕР±Р°РІР»РµРЅР° HTML РІР°Р»РёРґР°С†РёСЏ СЃ oninput
- **RenderOperations** - СѓРІРµР»РёС‡РµРЅ РїРѕСЂРѕРі РјРµРґР»РµРЅРЅС‹С… РєР°РґСЂРѕРІ РґРѕ 20ms

### Performance
- **Smart Grid Disable** - РіСЂРёРґ РѕС‚РєР»СЋС‡Р°РµС‚СЃСЏ РїСЂРё >4500 РіРµРєСЃР°РіРѕРЅРѕРІ РґР»СЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё
- **Minimal Overlap** - РїРµСЂРµС…Р»РµСЃС‚ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РЅР° РѕСЃРЅРѕРІРµ СЂР°РґРёСѓСЃР° РіРµРєСЃР°РіРѕРЅР°
- **Clean Console** - СѓР±СЂР°РЅС‹ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё РґР»СЏ С‡РёСЃС‚РѕР№ РєРѕРЅСЃРѕР»Рё

## [3.20.0] - 2025-01-27

### Added
- **Hexagonal Grid Orientation** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РѕСЂРёРµРЅС‚Р°С†РёРё С…РµРєСЃР°РіРѕРЅР°Р»СЊРЅРѕРіРѕ РіСЂРёРґР° (Pointy Top / Flat Top)
- **Hex Orientation UI Control** - РґРѕР±Р°РІР»РµРЅ СЃРµР»РµРєС‚ РґР»СЏ РІС‹Р±РѕСЂР° РѕСЂРёРµРЅС‚Р°С†РёРё РІ РЅР°СЃС‚СЂРѕР№РєР°С… РіСЂРёРґР°
- **Enhanced Hexagonal Grid Renderer** - РїРѕР»РЅРѕСЃС‚СЊСЋ РїРµСЂРµРїРёСЃР°РЅ СЂРµРЅРґРµСЂРµСЂ СЃ РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Рј Р°Р»РіРѕСЂРёС‚РјРѕРј РѕС‚СЂРёСЃРѕРІРєРё
- **Grid Size Integration** - СЂР°Р·РјРµСЂ С…РµРєСЃР°РіРѕРЅР° С‚РµРїРµСЂСЊ РїСЂРёРІСЏР·Р°РЅ Рє РѕР±С‰РµРјСѓ РїР°СЂР°РјРµС‚СЂСѓ Grid Size

### Improved
- **Hex Grid Performance** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РѕС‚СЂРёСЃРѕРІРєР° С…РµРєСЃР°РіРѕРЅР°Р»СЊРЅРѕРіРѕ РіСЂРёРґР° СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј Set РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Р»РёРЅРёР№
- **Grid Settings UI** - СѓР»СѓС‡С€РµРЅ РёРЅС‚РµСЂС„РµР№СЃ РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР° СЃ РґРёРЅР°РјРёС‡РµСЃРєРёРј РїРѕРєР°Р·РѕРј/СЃРєСЂС‹С‚РёРµРј РѕРїС†РёР№ РѕСЂРёРµРЅС‚Р°С†РёРё
- **Configuration Management** - СЂР°СЃС€РёСЂРµРЅР° СЃРёСЃС‚РµРјР° РєРѕРЅС„РёРіСѓСЂР°С†РёРё РґР»СЏ РїРѕРґРґРµСЂР¶РєРё hexOrientation РїР°СЂР°РјРµС‚СЂР°

### Technical
- **ConfigManager** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° hexOrientation РІ РЅР°СЃС‚СЂРѕР№РєР°С… РіСЂРёРґР°
- **StateManager** - РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅ hexOrientation РІ СЃРёСЃС‚РµРјСѓ СЃРѕСЃС‚РѕСЏРЅРёР№
- **UserPreferencesManager** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° hexOrientation РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…
- **SettingsPanel** - РѕР±РЅРѕРІР»РµРЅ РґР»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ Рё Р·Р°РіСЂСѓР·РєРё hexOrientation

## [3.19.8] - 2025-01-27

### Fixed
- **View Menu Checkboxes** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ С‡РµРєР±РѕРєСЃРѕРІ РїР°РЅРµР»РµР№ РІ РјРµРЅСЋ View РїСЂРё СЃРєСЂС‹С‚РёРё С‚СѓР»Р±Р°СЂР° С‡РµСЂРµР· РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ
- **Game Mode Checkboxes** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕР±РЅРѕРІР»РµРЅРёРµ С‡РµРєР±РѕРєСЃР° Game Mode РїСЂРё РґРµР°РєС‚РёРІР°С†РёРё СЂРµР¶РёРјР°
- **Game Mode Menu** - РґРѕР±Р°РІР»РµРЅРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ Р·Р°РєСЂС‹С‚РёРµ РјРµРЅСЋ View РїСЂРё РѕС‚РєР»СЋС‡РµРЅРёРё Game Mode
- **Panel State Restoration** - РёСЃРїСЂР°РІР»РµРЅ РїРѕСЂСЏРґРѕРє РІС‹Р·РѕРІРѕРІ РїСЂРё РІС‹С…РѕРґРµ РёР· Game Mode РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ РѕР±РЅРѕРІР»РµРЅРёСЏ С‡РµРєР±РѕРєСЃРѕРІ
- **Null Reference Error** - РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° "Cannot read properties of null (reading 'style')" РІ restorePanelStates()

### Improved
- **Checkbox Synchronization** - СѓР»СѓС‡С€РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёР№ С‡РµРєР±РѕРєСЃРѕРІ РјРµР¶РґСѓ СЂР°Р·Р»РёС‡РЅС‹РјРё UI СЌР»РµРјРµРЅС‚Р°РјРё
- **Game Mode UX** - СѓР»СѓС‡С€РµРЅ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёР№ РѕРїС‹С‚ РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё Game Mode

## [3.19.7] - 2025-09-26

### Fixed
- **РљРѕРЅС„РёРіСѓСЂР°С†РёРё РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ** - РґРѕР±Р°РІР»РµРЅС‹ РЅРµРґРѕСЃС‚Р°СЋС‰РёРµ С„Р°Р№Р»С‹ editor.json Рё panels.json РІ config/user/
- **РЎС‚СЂСѓРєС‚СѓСЂР° РЅР°СЃС‚СЂРѕРµРє** - С‚РµРїРµСЂСЊ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ РЅР°СЃС‚СЂРѕР№РєРё РїРѕР»РЅРѕСЃС‚СЊСЋ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‚ РґРµС„РѕР»С‚РЅС‹Рј

### Improved
- **РћС‡РёСЃС‚РєР° РєРѕРґР°** - СѓРґР°Р»РµРЅС‹ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Рµ РєРѕРЅС„РёРіСѓСЂР°С†РёРѕРЅРЅС‹Рµ С„Р°Р№Р»С‹ (assets, camera, performance, selection, toolbar, view)
- **РћС‡РёСЃС‚РєР° РєРѕРґР°** - СѓРґР°Р»РµРЅ РЅРµРёСЃРїРѕР»СЊР·СѓРµРјС‹Р№ IsometricGridRenderer
- **РћС‡РёСЃС‚РєР° РєРѕРґР°** - СѓРґР°Р»РµРЅС‹ example С„Р°Р№Р»С‹ РёР· config/user/
- **Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ** - РѕР±РЅРѕРІР»РµРЅР° СЃС‚СЂСѓРєС‚СѓСЂР° РїР°РїРѕРє РІ README

## [3.19.6] - 2025-09-26

### Fixed
- **РЈРґР°Р»РµРЅРёРµ СЃР»РѕРµРІ** - РёСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° "moveObjectsToMainLayer is not a function" РїСЂРё СѓРґР°Р»РµРЅРёРё СЃР»РѕРµРІ
- **РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ СЃР»РѕРµРІ** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РѕРїСЂРµРґРµР»РµРЅРёРµРј СЃР»РѕСЏ РїРѕРґ РєСѓСЂСЃРѕСЂРѕРј РїСЂРё РєР»РёРєРµ РЅР° РІР»РѕР¶РµРЅРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹
- **API РјРµС‚РѕРґРѕРІ** - РёСЃРїСЂР°РІР»РµРЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ РїСЂР°РІРёР»СЊРЅРѕРіРѕ РјРµС‚РѕРґР° getLayerObjects() РІРјРµСЃС‚Рѕ РЅРµСЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ getObjectsForLayer()

### Improved
- **РќР°РґРµР¶РЅРѕСЃС‚СЊ СѓРґР°Р»РµРЅРёСЏ** - РґРѕР±Р°РІР»РµРЅ РјРµС‚РѕРґ moveObjectsToMainLayer() РґР»СЏ РєРѕСЂСЂРµРєС‚РЅРѕРіРѕ РїРµСЂРµРјРµС‰РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ РїСЂРё СѓРґР°Р»РµРЅРёРё СЃР»РѕСЏ
- **РћР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј closest() РґР»СЏ РїРѕРёСЃРєР° СЌР»РµРјРµРЅС‚Р° СЃР»РѕСЏ
- **РљРѕРґ** - СѓРґР°Р»РµРЅС‹ РІСЃРµ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё РёР· MouseHandlers.js Рё LayersPanel.js

## [3.19.5] - 2025-09-26

### Fixed
- **Diamond Grid РїСЂРё Р·СѓРјРµ** - РёСЃРїСЂР°РІР»РµРЅР° РЅРµРєРѕСЂСЂРµРєС‚РЅР°СЏ РѕС‚СЂРёСЃРѕРІРєР° РїСЂРё Р·СѓРјРµ РєР°РјРµСЂС‹
- **Р¦РµРЅС‚СЂР°Р»СЊРЅС‹Рµ Р»РёРЅРёРё РїСЂРё СЂРµСЃС‚Р°СЂС‚Рµ** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РѕС‚СЃСѓС‚СЃС‚РІРёРµРј С†РµРЅС‚СЂР°Р»СЊРЅС‹С… Р»РёРЅРёР№ РїСЂРё РєР°РјРµСЂРµ РІ РїРѕР·РёС†РёРё (0,0)
- **Р Р°СЃС‡РµС‚ spacing** - СѓР±СЂР°РЅР° РґРІРѕР№РЅР°СЏ РєРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° spacing (С‚СЂР°РЅСЃС„РѕСЂРјР°С†РёСЏ РєР°РјРµСЂС‹ СѓР¶Рµ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ РІ CanvasRenderer)
- **РўРѕС‡РЅРѕСЃС‚СЊ РІС‹С‡РёСЃР»РµРЅРёР№** - РґРѕР±Р°РІР»РµРЅС‹ РїСЂРѕРІРµСЂРєРё isFinite() РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ NaN РІ СЂР°СЃС‡РµС‚Р°С… РїРµСЂРµСЃРµС‡РµРЅРёР№

### Improved
- **РЎС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ РѕС‚СЂРёСЃРѕРІРєРё** - diamond grid С‚РµРїРµСЂСЊ СЃС‚Р°Р±РёР»СЊРЅРѕ СЂР°Р±РѕС‚Р°РµС‚ РїСЂРё РІСЃРµС… СѓСЂРѕРІРЅСЏС… Р·СѓРјР°
- **РћР±СЂР°Р±РѕС‚РєР° РіСЂР°РЅРёС‡РЅС‹С… СЃР»СѓС‡Р°РµРІ** - СѓР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° Р»РёРЅРёР№, РїСЂРѕС…РѕРґСЏС‰РёС… С‡РµСЂРµР· СѓРіР»С‹ viewport
- **РџСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - СѓР±СЂР°РЅС‹ РѕС‚Р»Р°РґРѕС‡РЅС‹Рµ Р»РѕРіРё, Р·Р°СЃРѕСЂСЏСЋС‰РёРµ РєРѕРЅСЃРѕР»СЊ

## [3.19.4] - 2025-09-26

### Fixed
- **Diamond Grid РѕС‚СЂРёСЃРѕРІРєР°** - РёСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РЅРµРїРѕР»РЅС‹Рј РїРѕРєСЂС‹С‚РёРµРј viewport Р»РёРЅРёСЏРјРё
- **Р—Р°РІРёСЃРёРјРѕСЃС‚СЊ РѕС‚ Р·СѓРјР° РєР°РјРµСЂС‹** - РґРѕР±Р°РІР»РµРЅР° РєРѕСЂСЂРµРєС‚РёСЂРѕРІРєР° spacing Р»РёРЅРёР№ РїСЂРё СЂР°Р·РЅС‹С… СѓСЂРѕРІРЅСЏС… Р·СѓРјР°
- **Р Р°СЃС‡РµС‚ РґРёР°РїР°Р·РѕРЅР° Р»РёРЅРёР№** - СѓР»СѓС‡С€РµРЅ Р°Р»РіРѕСЂРёС‚Рј СЂР°СЃС‡РµС‚Р° СЃ СѓС‡РµС‚РѕРј РІСЃРµС… СѓРіР»РѕРІ viewport

### Improved
- **РџРѕР»РЅРѕРµ РїРѕРєСЂС‹С‚РёРµ viewport** - diamond grid С‚РµРїРµСЂСЊ РїСЂР°РІРёР»СЊРЅРѕ СЂРёСЃСѓРµС‚ РІСЃРµ Р»РёРЅРёРё РїРѕ РІСЃРµРјСѓ РѕРєРЅСѓ
- **РђРґР°РїС‚РёРІРЅР°СЏ РїР»РѕС‚РЅРѕСЃС‚СЊ** - spacing Р»РёРЅРёР№ РєРѕСЂСЂРµРєС‚РёСЂСѓРµС‚СЃСЏ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ Р·СѓРјР° РґР»СЏ РѕРїС‚РёРјР°Р»СЊРЅРѕР№ РІРёРґРёРјРѕСЃС‚Рё
- **РўРѕС‡РЅРѕСЃС‚СЊ РїРµСЂРµСЃРµС‡РµРЅРёР№** - РѕРїС‚РёРјРёР·РёСЂРѕРІР°РЅ СЂР°СЃС‡РµС‚ С‚РѕС‡РµРє РїРµСЂРµСЃРµС‡РµРЅРёСЏ Р»РёРЅРёР№ СЃ РіСЂР°РЅРёС†Р°РјРё РІРёРґРёРјРѕСЃС‚Рё

## [3.19.3] - 2025-01-27

### Fixed
- **РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ С‚СѓР»Р±Р°СЂР°** - РёСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ СЃРµРїР°СЂР°С‚РѕСЂР° Рё РїСѓРЅРєС‚РѕРІ РјРµРЅСЋ
- **РџРѕСЂСЏРґРѕРє СЌР»РµРјРµРЅС‚РѕРІ РјРµРЅСЋ** - Settings РІСЃРµРіРґР° РѕСЃС‚Р°РµС‚СЃСЏ РІРЅРёР·Сѓ СЃРїРёСЃРєР°
- **РџРѕРґСЃРІРµС‚РєР° С‚РµРєСѓС‰РµРіРѕ С‚РёРїР°** - РІС‹Р±СЂР°РЅРЅС‹Р№ С‚РёРї РіСЂРёРґР° РїРѕРґСЃРІРµС‡РёРІР°РµС‚СЃСЏ СЃРёРЅРёРј РІРјРµСЃС‚Рѕ РґРёР·РµР№Р±Р»Р°
- **РЎС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ РјРµРЅСЋ** - СЌР»РµРјРµРЅС‚С‹ РЅРµ "РїСЂС‹РіР°СЋС‚" РїСЂРё РѕР±РЅРѕРІР»РµРЅРёРё С‚РёРїРѕРІ РіСЂРёРґРѕРІ

### Improved
- **РћР±СЂР°Р±РѕС‚РєР° СЃРµРїР°СЂР°С‚РѕСЂРѕРІ** - РґРѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° `type: 'separator'` РІ BaseContextMenu
- **Р”РёРЅР°РјРёС‡РµСЃРєРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ** - РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РєРѕСЂСЂРµРєС‚РЅРѕ РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ РїСЂРё СЃРјРµРЅРµ С‚РёРїР° РіСЂРёРґР°
- **РџСЂР°РІРёР»СЊРЅР°СЏ РѕС‡РёСЃС‚РєР°** - `clearGridTypeMenuItems()` СѓРґР°Р»СЏРµС‚ С‚РѕР»СЊРєРѕ СЌР»РµРјРµРЅС‚С‹ РіСЂРёРґРѕРІ

## [3.19.2] - 2025-01-27

### Added
- **РљР°СЂСѓСЃРµР»СЊРЅРѕРµ РїРµСЂРµРєР»СЋС‡РµРЅРёРµ С‚РёРїРѕРІ РіСЂРёРґРѕРІ** - Ctrl+Click РЅР° РєРЅРѕРїРєРµ Grid РґР»СЏ РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РјРµР¶РґСѓ С‚РёРїР°РјРё
- **Р”РёРЅР°РјРёС‡РµСЃРєРёРµ РёРєРѕРЅРєРё РіСЂРёРґРѕРІ** - РёРєРѕРЅРєР° РєРЅРѕРїРєРё Grid РјРµРЅСЏРµС‚СЃСЏ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РІС‹Р±СЂР°РЅРЅРѕРіРѕ С‚РёРїР°
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ С‚РёРїРѕРІ РіСЂРёРґРѕРІ** - СЃРёСЃС‚РµРјР° Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРѕРґС…РІР°С‚С‹РІР°РµС‚ РґРѕСЃС‚СѓРїРЅС‹Рµ СЂРµРЅРґРµСЂРµСЂС‹
- **РљРѕРЅС„РёРіСѓСЂРёСЂСѓРµРјС‹Рµ РёРєРѕРЅРєРё** - Р»РµРіРєРѕ РЅР°СЃС‚СЂР°РёРІР°РµРјС‹Рµ РёРєРѕРЅРєРё РґР»СЏ РєР°Р¶РґРѕРіРѕ С‚РёРїР° РіСЂРёРґР°
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РІС‹Р±СЂР°РЅРЅРѕРіРѕ С‚РёРїР°** - РІС‹Р±СЂР°РЅРЅС‹Р№ С‚РёРї РіСЂРёРґР° СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…

### Improved
- **Р“РёР±РєР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - РєРѕРґ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р°РґР°РїС‚РёСЂСѓРµС‚СЃСЏ Рє РёР·РјРµРЅРµРЅРёСЏРј РІ СЃРїРёСЃРєРµ СЂРµРЅРґРµСЂРµСЂРѕРІ
- **Fallback СЃРёСЃС‚РµРјР°** - graceful РѕР±СЂР°Р±РѕС‚РєР° РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёС… СЂРµРЅРґРµСЂРµСЂРѕРІ
- **Р•РґРёРЅС‹Р№ СЃС‚РёР»СЊ РёРєРѕРЅРѕРє** - РІСЃРµ РёРєРѕРЅРєРё РіСЂРёРґРѕРІ РІ РµРґРёРЅРѕРј РіРµРѕРјРµС‚СЂРёС‡РµСЃРєРѕРј СЃС‚РёР»Рµ

### Technical
- **Р”РёРЅР°РјРёС‡РµСЃРєР°СЏ РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ** - `initializeGridTypes()` РїРѕР»СѓС‡Р°РµС‚ С‚РёРїС‹ РёР· CanvasRenderer
- **РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕР±РЅРѕРІР»РµРЅРёРµ** - `refreshGridTypes()` РґР»СЏ РѕР±РЅРѕРІР»РµРЅРёСЏ РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂРµРЅРґРµСЂРµСЂРѕРІ
- **РљРѕРЅС„РёРіСѓСЂР°С†РёРѕРЅРЅР°СЏ СЃРёСЃС‚РµРјР°** - `gridTypeConfig` Map РґР»СЏ С…СЂР°РЅРµРЅРёСЏ РЅР°СЃС‚СЂРѕРµРє С‚РёРїРѕРІ

## [3.19.1] - 2025-01-27

### Added
- **РњРѕРґСѓР»СЊРЅР°СЏ Р°СЂС…РёС‚РµРєС‚СѓСЂР° СЂРµРЅРґРµСЂРёРЅРіР° СЃРµС‚РєРё** - СЂР°Р·РґРµР»РµРЅРёРµ СЂРµРЅРґРµСЂРµСЂРѕРІ РїРѕ С‚РёРїР°Рј СЃРµС‚РєРё
- **BaseGridRenderer** - Р±Р°Р·РѕРІС‹Р№ РєР»Р°СЃСЃ СЃ РѕР±С‰РµР№ Р»РѕРіРёРєРѕР№ РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ СЃРµС‚РєРё
- **RectangularGridRenderer** - СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ СЂРµРЅРґРµСЂРµСЂ РїСЂСЏРјРѕСѓРіРѕР»СЊРЅРѕР№ СЃРµС‚РєРё
- **DiamondGridRenderer** - СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ СЂРµРЅРґРµСЂРµСЂ diamond СЃРµС‚РєРё (60В°/120В°)
- **HexagonalGridRenderer** - СЃРїРµС†РёР°Р»РёР·РёСЂРѕРІР°РЅРЅС‹Р№ СЂРµРЅРґРµСЂРµСЂ С€РµСЃС‚РёСѓРіРѕР»СЊРЅРѕР№ СЃРµС‚РєРё
- **РЈРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕРµ API** - РµРґРёРЅС‹Р№ РёРЅС‚РµСЂС„РµР№СЃ РґР»СЏ РІСЃРµС… С‚РёРїРѕРІ СЃРµС‚РєРё
- **РћР±С‰Р°СЏ Р»РѕРіРёРєР° СЃС‚РёР»РёР·Р°С†РёРё** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° С†РІРµС‚РѕРІ Рё С‚РѕР»С‰РёРЅС‹ Р»РёРЅРёР№

### Refactored
- **РЈР±СЂР°РЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ РєРѕРґР°** - РѕР±С‰Р°СЏ Р»РѕРіРёРєР° РІС‹РЅРµСЃРµРЅР° РІ BaseGridRenderer
- **РЈРїСЂРѕС‰РµРЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР°** - СѓРґР°Р»РµРЅ РїСЂРѕРјРµР¶СѓС‚РѕС‡РЅС‹Р№ СЃР»РѕР№ GridRenderer.js
- **Р’СЃС‚СЂРѕРµРЅР° Р»РѕРіРёРєР° РІС‹Р±РѕСЂР° СЂРµРЅРґРµСЂРµСЂР°** - РёРЅС‚РµРіСЂРёСЂРѕРІР°РЅР° РІ CanvasRenderer.drawGrid()
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - СѓСЃС‚СЂР°РЅРµРЅС‹ Р»РёС€РЅРёРµ РІС‹Р·РѕРІС‹ Рё РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ

### Fixed
- **РСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ СЃРµС‚РєРё** - СѓСЃС‚СЂР°РЅРµРЅРѕ РґРІРѕР№РЅРѕРµ РїСЂРёРјРµРЅРµРЅРёРµ РєР°РјРµСЂС‹
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РёР·РѕРјРµС‚СЂРёС‡РµСЃРєРѕР№ СЃРµС‚РєРё** - РїСЂР°РІРёР»СЊРЅС‹Рµ СѓРіР»С‹ 60В° Рё 120В°
- **РЈСЃС‚СЂР°РЅРµРЅС‹ РєРѕРЅС„Р»РёРєС‚С‹ РёРјРїРѕСЂС‚РѕРІ** - С‡РёСЃС‚Р°СЏ СЃРёСЃС‚РµРјР° Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№

## [3.19.0] - 2025-01-27

### Added
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїРѕР·РёС†РёРё СЃРєСЂРѕР»Р»Р° С‚СѓР»Р±Р°СЂР°** - Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ Р·Р°РїРѕРјРёРЅР°РЅРёРµ РїРѕР·РёС†РёРё РїСЂРѕРєСЂСѓС‚РєРё
- **Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїРѕР·РёС†РёРё СЃРєСЂРѕР»Р»Р°** - РїРѕР·РёС†РёСЏ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё РїРµСЂРµР·Р°РіСЂСѓР·РєРµ СЂРµРґР°РєС‚РѕСЂР°
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїСЂРё СЃРєСЂРѕР»Р»Рµ РєРѕР»РµСЃРѕРј** - РїРѕР·РёС†РёСЏ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РїСЂРё РїСЂРѕРєСЂСѓС‚РєРµ РєРѕР»РµСЃРѕРј РјС‹С€Рё
- **РЎРѕС…СЂР°РЅРµРЅРёРµ РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ** - РїРѕР·РёС†РёСЏ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РјС‹С€Рё

### Fixed
- **РСЃРїСЂР°РІР»РµРЅР° РІРёРґРёРјРѕСЃС‚СЊ СѓРґР°Р»РµРЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ** - РѕР±СЉРµРєС‚С‹ РєРѕСЂСЂРµРєС‚РЅРѕ РёСЃС‡РµР·Р°СЋС‚ СЃ canvas РїРѕСЃР»Рµ СѓРґР°Р»РµРЅРёСЏ
- **РСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ СЂР°Р·РјРµСЂР° РєРѕРЅСЃРѕР»Рё** - СЂР°Р·РјРµСЂ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРё РѕС‚РїСѓСЃРєР°РЅРёРё РјС‹С€Рё, Р° РЅРµ РїСЂРё РєР°Р¶РґРѕРј РґРІРёР¶РµРЅРёРё
- **РСЃРїСЂР°РІР»РµРЅРѕ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РїРѕР·РёС†РёРё С‚СѓР»Р±Р°СЂР°** - РїРѕР·РёС†РёСЏ СЃРєСЂРѕР»Р»Р° РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё РёРЅРёС†РёР°Р»РёР·Р°С†РёРё

### Improved
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє** - СЃРЅРёР¶РµРЅР° С‡Р°СЃС‚РѕС‚Р° СЃРѕС…СЂР°РЅРµРЅРёСЏ РїСЂРё РёР·РјРµРЅРµРЅРёРё СЂР°Р·РјРµСЂР° РєРѕРЅСЃРѕР»Рё
- **РЈР»СѓС‡С€РµРЅР° СЃРёСЃС‚РµРјР° РёРЅРІР°Р»РёРґР°С†РёРё РєРµС€РµР№** - РґРѕР±Р°РІР»РµРЅР° РёРЅРІР°Р»РёРґР°С†РёСЏ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµРЅРЅРѕРіРѕ РёРЅРґРµРєСЃР° РїСЂРё СѓРґР°Р»РµРЅРёРё РѕР±СЉРµРєС‚РѕРІ

## [3.18.0] - 2025-01-27

### Added
- **РќР°СЃС‚СЂР°РёРІР°РµРјС‹Р№ snap tolerance** - Р°РґР°РїС‚РёРІРЅР°СЏ Р·РѕРЅР° РїСЂРёС‚СЏР¶РµРЅРёСЏ Рє СЃРµС‚РєРµ (5-100%)
- **РЎРѕС…СЂР°РЅРµРЅРёРµ snap tolerance** - РЅР°СЃС‚СЂРѕР№РєР° СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РїСЂРµРґРїРѕС‡С‚РµРЅРёСЏС…
- **Р•РґРёРЅР°СЏ Р»РѕРіРёРєР° СЃРЅСЌРїР°** - РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕРµ РїРѕРІРµРґРµРЅРёРµ РґР»СЏ РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёСЏ, РґСѓР±Р»РёСЂРѕРІР°РЅРёСЏ Рё drop РѕР±СЉРµРєС‚РѕРІ
- **Р¦РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Р№ SnapUtils** - РµРґРёРЅР°СЏ С‚РѕС‡РєР° СѓРїСЂР°РІР»РµРЅРёСЏ Р»РѕРіРёРєРѕР№ СЃРЅСЌРїР°

### Fixed
- **РСЃРїСЂР°РІР»РµРЅ СЃРЅСЌРї РґСѓР±Р»РёРєР°С‚РѕРІ** - Р»РµРІС‹Р№ РЅРёР¶РЅРёР№ СѓРіРѕР» РїРµСЂРІРѕРіРѕ РѕР±СЉРµРєС‚Р° РїРѕРїР°РґР°РµС‚ РІ С‚РѕС‡РєСѓ РіСЂРёРґР°
- **РСЃРїСЂР°РІР»РµРЅР° Р»РѕРіРёРєР° РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ** - РґСѓР±Р»РёРєР°С‚С‹ РёСЃРїРѕР»СЊР·СѓСЋС‚ РїСЂР°РІРёР»СЊРЅСѓСЋ С‚РѕС‡РєСѓ РїСЂРёРІСЏР·РєРё
- **РЈСЃС‚СЂР°РЅРµРЅ РґСѓР±Р»РёСЂСѓСЋС‰РёР№ РєРѕРґ** - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅ РјРµС‚РѕРґ findNearestGridPoint

### Improved
- **РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ** - РєРµС€РёСЂРѕРІР°РЅРёРµ РјРёСЂРѕРІС‹С… РїРѕР·РёС†РёР№ РѕР±СЉРµРєС‚РѕРІ
- **РЈР»СѓС‡С€РµРЅР° РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚СЊ** - РІСЃРµ РѕРїРµСЂР°С†РёРё СЃРЅСЌРїР° РёСЃРїРѕР»СЊР·СѓСЋС‚ РѕРґРёРЅР°РєРѕРІСѓСЋ Р»РѕРіРёРєСѓ
- **РЈРїСЂРѕС‰РµРЅ РєРѕРґ** - СѓРґР°Р»РµРЅ РґСѓР±Р»РёСЂСѓСЋС‰РёР№ РєРѕРґ, СѓР»СѓС‡С€РµРЅР° С‡РёС‚Р°РµРјРѕСЃС‚СЊ

### Changed
- **РћР±РЅРѕРІР»РµРЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° СЃРЅСЌРїР°** - РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СЃСѓС‰РµСЃС‚РІСѓСЋС‰Р°СЏ Р»РѕРіРёРєР° РёР· dragSelectedObjects
- **РР·РјРµРЅРµРЅР° С‚РѕС‡РєР° РїСЂРёРІСЏР·РєРё** - РґСѓР±Р»РёРєР°С‚С‹ РїСЂРёРІСЏР·С‹РІР°СЋС‚СЃСЏ Рє РїРѕР·РёС†РёРё РєСѓСЂСЃРѕСЂР°, СЃРЅСЌРї Рє Р»РµРІРѕРјСѓ РЅРёР¶РЅРµРјСѓ СѓРіР»Сѓ
- **РћР±РЅРѕРІР»РµРЅС‹ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёРµ РЅР°СЃС‚СЂРѕР№РєРё** - РґРѕР±Р°РІР»РµРЅ snapTolerance РІ UserPreferencesManager

## [3.17.0] - 2025-01-27

### Added
- Р”РѕР±Р°РІР»РµРЅ С„СѓРЅРєС†РёРѕРЅР°Р» РІС‹РґРµР»РµРЅРёСЏ СЃС‚СЂРѕРє РІ РєРѕРЅСЃРѕР»Рё Р»РµРІС‹Рј РєР»РёРє-РґСЂР°РіРѕРј
- Р”РѕР±Р°РІР»РµРЅРѕ РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РґР»СЏ РєРѕРїРёСЂРѕРІР°РЅРёСЏ РІС‹РґРµР»РµРЅРЅРѕРіРѕ С‚РµРєСЃС‚Р° РІ РєРѕРЅСЃРѕР»Рё
- Р”РѕР±Р°РІР»РµРЅС‹ CSS СЃС‚РёР»Рё РґР»СЏ РІРёР·СѓР°Р»СЊРЅРѕРіРѕ РІС‹РґРµР»РµРЅРёСЏ С‚РµРєСЃС‚Р° РІ РєРѕРЅСЃРѕР»Рё
- Р”РѕР±Р°РІР»РµРЅР° РїРѕРґРґРµСЂР¶РєР° РґРІРѕР№РЅРѕРіРѕ РєР»РёРєР° РґР»СЏ РІС‹РґРµР»РµРЅРёСЏ РІСЃРµР№ СЃС‚СЂРѕРєРё РІ РєРѕРЅСЃРѕР»Рё
- Р”РѕР±Р°РІР»РµРЅС‹ РєР»Р°РІРёР°С‚СѓСЂРЅС‹Рµ СЃРѕС‡РµС‚Р°РЅРёСЏ (Ctrl+A, Escape) РґР»СЏ СЂР°Р±РѕС‚С‹ СЃ РІС‹РґРµР»РµРЅРёРµРј

### Fixed
- РСЃРїСЂР°РІР»РµРЅР° РѕС€РёР±РєР° `ReferenceError: levelId is not defined` РІ RenderOperations.js
- РСЃРїСЂР°РІР»РµРЅРѕ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃР±СЂР°СЃС‹РІР°РЅРёРµ РІС‹РґРµР»РµРЅРёСЏ С‚РµРєСЃС‚Р° РІ РєРѕРЅСЃРѕР»Рё
- РСЃРїСЂР°РІР»РµРЅС‹ С„СЂРёР·С‹ СЂРµРґР°РєС‚РѕСЂР° РїСЂРё РІС‹РґРµР»РµРЅРёРё С‚РµРєСЃС‚Р° РІ РєРѕРЅСЃРѕР»Рё
- РСЃРїСЂР°РІР»РµРЅР° СЂР°Р±РѕС‚Р° РєРѕРјР°РЅРґРЅРѕР№ СЃС‚СЂРѕРєРё РєРѕРЅСЃРѕР»Рё РїСЂРё Р°РєС‚РёРІРЅРѕРј РІС‹РґРµР»РµРЅРёРё
- РСЃРїСЂР°РІР»РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕРµРє РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё

### Improved
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ РІС‹РґРµР»РµРЅРёСЏ С‚РµРєСЃС‚Р° РІ РєРѕРЅСЃРѕР»Рё
- РЈР»СѓС‡С€РµРЅР° Р»РѕРіРёРєР° РѕРїСЂРµРґРµР»РµРЅРёСЏ РІС‹РґРµР»РµРЅРЅС‹С… СЃС‚СЂРѕРє СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј throttling
- РЈРїСЂРѕС‰РµРЅР° СЃРёСЃС‚РµРјР° РѕР±СЂР°Р±РѕС‚РєРё СЃРѕР±С‹С‚РёР№ РІС‹РґРµР»РµРЅРёСЏ РґР»СЏ Р»СѓС‡С€РµР№ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё
- РЈРґР°Р»РµРЅС‹ Р»РёС€РЅРёРµ debug Р»РѕРіРё РґР»СЏ СѓР»СѓС‡С€РµРЅРёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё
- РЈР»СѓС‡С€РµРЅР° РІРёР·СѓР°Р»СЊРЅР°СЏ РѕР±СЂР°С‚РЅР°СЏ СЃРІСЏР·СЊ РїСЂРё РІС‹РґРµР»РµРЅРёРё С‚РµРєСЃС‚Р°

### Changed
- РћР±РЅРѕРІР»РµРЅР° СЃРёСЃС‚РµРјР° РІС‹РґРµР»РµРЅРёСЏ С‚РµРєСЃС‚Р° - С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ РіР»РѕР±Р°Р»СЊРЅС‹Р№ РѕР±СЂР°Р±РѕС‚С‡РёРє РІРјРµСЃС‚Рѕ РјРЅРѕР¶РµСЃС‚РІРµРЅРЅС‹С… Р»РѕРєР°Р»СЊРЅС‹С…
- РЈР»СѓС‡С€РµРЅР° СЃРёСЃС‚РµРјР° РєСЌС€РёСЂРѕРІР°РЅРёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ РІС‹РґРµР»РµРЅРёСЏ РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ Р»РёС€РЅРёС… РѕР±РЅРѕРІР»РµРЅРёР№ DOM
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° СЂР°Р±РѕС‚Р° СЃ РєРѕРЅС‚РµРєСЃС‚РЅС‹Рј РјРµРЅСЋ РєРѕРЅСЃРѕР»Рё

## [3.16.1] - 2025-01-27

### Fixed
- РСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР° РїСЂРё РїРµСЂРµР·Р°РїСѓСЃРєРµ СЂРµРґР°РєС‚РѕСЂР°
- РСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ С†РІРµС‚РѕРІ РіСЂРёРґР° РІ РЅР°СЃС‚СЂРѕР№РєР°С… - С‚РµРїРµСЂСЊ РєРѕСЂСЂРµРєС‚РЅРѕ РєРѕРЅРІРµСЂС‚РёСЂСѓСЋС‚СЃСЏ РјРµР¶РґСѓ hex Рё rgba С„РѕСЂРјР°С‚Р°РјРё
- РСЃРїСЂР°РІР»РµРЅ СЃР±СЂРѕСЃ РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР° РЅР° РґРµС„РѕР»С‚РЅС‹Рµ - С‚РµРїРµСЂСЊ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃ GridSettings
- РЈСЃС‚СЂР°РЅРµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ С„СѓРЅРєС†РёР№ РєРѕРЅРІРµСЂС‚Р°С†РёРё С†РІРµС‚РѕРІ - С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅС‹ РІ RenderUtils
- РЈРґР°Р»РµРЅС‹ Р»РёС€РЅРёРµ Р»РѕРіРё СЂР°Р±РѕС‚С‹ РіСЂРёРґР° РґР»СЏ СѓР»СѓС‡С€РµРЅРёСЏ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё

### Changed
- РЈР»СѓС‡С€РµРЅР° СЃРёСЃС‚РµРјР° Р·Р°РіСЂСѓР·РєРё РЅР°СЃС‚СЂРѕРµРє РіСЂРёРґР° - РґРѕР±Р°РІР»РµРЅР° СЃРµРєС†РёСЏ 'grid' РІ СЃРїРёСЃРѕРє Р·Р°РіСЂСѓР¶Р°РµРјС‹С… РєРѕРЅС„РёРіСѓСЂР°С†РёР№
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РєРѕРЅРІРµСЂС‚Р°С†РёСЏ С†РІРµС‚РѕРІ - РІСЃРµ С„СѓРЅРєС†РёРё РїРµСЂРµРЅРµСЃРµРЅС‹ РІ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Рµ СѓС‚РёР»РёС‚С‹

## [3.16.0] - 2025-09-24

### Fixed
- РСЃРїСЂР°РІР»РµРЅРѕ РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРµ С‚СѓР»Р±Р°СЂР° СЃСЂРµРґРЅРµР№ РєРЅРѕРїРєРѕР№ РјС‹С€Рё - С‚РµРїРµСЂСЊ СЂР°Р±РѕС‚Р°РµС‚ РЅР° РІСЃРµРј С‚СѓР»Р±Р°СЂРµ РІРєР»СЋС‡Р°СЏ Р°РєС‚РёРІРЅС‹Рµ Рё РЅРµР°РєС‚РёРІРЅС‹Рµ РєРЅРѕРїРєРё
- РЈР±СЂР°РЅРѕ "РїСЂРёР»РёРїР°РЅРёРµ" РєСѓСЂСЃРѕСЂР° РїСЂРё РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРё - С‚РµРїРµСЂСЊ РѕР±С‹С‡РЅРѕРµ РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёРµ РІ РїСЂРѕС‚РёРІРѕРїРѕР»РѕР¶РЅРѕРј РЅР°РїСЂР°РІР»РµРЅРёРё РґРІРёР¶РµРЅРёСЋ РєСѓСЂСЃРѕСЂР°

### Changed
- РЈР»СѓС‡С€РµРЅР° РѕР±СЂР°Р±РѕС‚РєР° СЃРѕР±С‹С‚РёР№ РЅР° disabled РєРЅРѕРїРєР°С… С‚СѓР»Р±Р°СЂР° - pointer-events: none РїРѕР·РІРѕР»СЏРµС‚ СЃРѕР±С‹С‚РёСЏРј РїСЂРѕС…РѕРґРёС‚СЊ СЃРєРІРѕР·СЊ РЅРµР°РєС‚РёРІРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹

## [3.15.0] - 2025-09-24

### Fixed
- РСЃРїСЂР°РІР»РµРЅРѕ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ canvas РїСЂРё РёР·РјРµРЅРµРЅРёРё РІРёРґРёРјРѕСЃС‚Рё toolbar - С‚РµРїРµСЂСЊ canvas Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Р°РґР°РїС‚РёСЂСѓРµС‚СЃСЏ РїРѕРґ РЅРѕРІРѕРµ РґРѕСЃС‚СѓРїРЅРѕРµ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ
- РСЃРїСЂР°РІР»РµРЅРѕ Р·Р°РєСЂС‹С‚РёРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ toolbar РїСЂРё Р°РєС‚РёРІР°С†РёРё РєРѕРјР°РЅРґС‹ "Hide" - РјРµРЅСЋ С‚РµРїРµСЂСЊ Р·Р°РєСЂС‹РІР°РµС‚СЃСЏ СЃСЂР°Р·Сѓ РїРѕСЃР»Рµ РІС‹РїРѕР»РЅРµРЅРёСЏ РґРµР№СЃС‚РІРёСЏ
- РЈР±СЂР°РЅРѕ Р»РёС€РЅРµРµ Р»РѕРіРёСЂРѕРІР°РЅРёРµ РІ СЃРёСЃС‚РµРјРµ toolbar РґР»СЏ РѕРїС‚РёРјРёР·Р°С†РёРё РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚Рё

### Changed
- РЈР»СѓС‡С€РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РјРµР¶РґСѓ UI СЌР»РµРјРµРЅС‚Р°РјРё toolbar Рё СЃРёСЃС‚РµРјРѕР№ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ toolbar СЃ canvas renderer

## [3.14.0] - 2024-12-19

### Added
- РџРѕР»РЅР°СЏ СЃРёСЃС‚РµРјР° СЃРѕС…СЂР°РЅРµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕРµРє С‚СѓР»Р±Р°СЂР°
- Р—Р°РїРѕРјРёРЅР°РЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРЅРѕРїРѕРє С‚СѓР»Р±Р°СЂР° (Grid, Snap, Parallax, Boundaries, Collisions)
- Р—Р°РїРѕРјРёРЅР°РЅРёРµ СЃРІРµСЂРЅСѓС‚С‹С… СЃРµРєС†РёР№ С‚СѓР»Р±Р°СЂР° (File, Edit, View, Group)
- Р—Р°РїРѕРјРёРЅР°РЅРёРµ РЅР°СЃС‚СЂРѕРµРє РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ (РёРєРѕРЅРєРё Рё С‚РµРєСЃС‚ РєРЅРѕРїРѕРє)
- Р—Р°РїРѕРјРёРЅР°РЅРёРµ РІРёРґРёРјРѕСЃС‚Рё С‚СѓР»Р±Р°СЂР°
- РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ РЅР°СЃС‚СЂРѕРµРє РІ localStorage
- Р’РѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ РІСЃРµС… РЅР°СЃС‚СЂРѕРµРє РїСЂРё РїРµСЂРµР·Р°РіСЂСѓР·РєРµ СЂРµРґР°РєС‚РѕСЂР°

### Changed
- РЈР»СѓС‡С€РµРЅР° РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ С‚СѓР»Р±Р°СЂР° - РѕС‚СЂРёСЃРѕРІС‹РІР°РµС‚СЃСЏ СЃСЂР°Р·Сѓ РІ РїСЂР°РІРёР»СЊРЅРѕРј СЃРѕСЃС‚РѕСЏРЅРёРё
- РЈСЃС‚СЂР°РЅРµРЅРѕ РІРёР·СѓР°Р»СЊРЅРѕРµ "РїРµСЂРµРєР»СЋС‡РµРЅРёРµ" С‚СѓР»Р±Р°СЂР° РїСЂРё Р·Р°РіСЂСѓР·РєРµ РЅР°СЃС‚СЂРѕРµРє
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅР° СЃРёСЃС‚РµРјР° Р·Р°РіСЂСѓР·РєРё СЃРѕСЃС‚РѕСЏРЅРёСЏ С‚СѓР»Р±Р°СЂР°
- РЈР»СѓС‡С€РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРЅРѕРїРѕРє СЃ StateManager

### Fixed
- РСЃРїСЂР°РІР»РµРЅР° РїСЂРѕР±Р»РµРјР° СЃ РёРЅРІРµСЂСЃРЅС‹Рј РѕС‚РѕР±СЂР°Р¶РµРЅРёРµРј РєРЅРѕРїРєРё Boundaries
- РЈСЃС‚СЂР°РЅРµРЅР° Р·Р°РґРµСЂР¶РєР° РїСЂРё РїРµСЂРµРєР»СЋС‡РµРЅРёРё СЃРѕСЃС‚РѕСЏРЅРёСЏ РєРЅРѕРїРѕРє С‚СѓР»Р±Р°СЂР°
- РСЃРїСЂР°РІР»РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ РІРёР·СѓР°Р»СЊРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ СЃ СЂРµР°Р»СЊРЅС‹Рј СЃРѕСЃС‚РѕСЏРЅРёРµРј С„СѓРЅРєС†РёР№

## [3.13.0] - 2024-12-19

### Added
- Р“РѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРµ СЂР°Р·РґРµР»РµРЅРёРµ СЂР°Р±РѕС‡РµР№ РѕР±Р»Р°СЃС‚Рё СЃ С‚СѓР»Р±Р°СЂРѕРј РІ РІРµСЂС…РЅРµР№ С‡Р°СЃС‚Рё
- РџРѕР»РЅРѕС„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Р№ С‚СѓР»Р±Р°СЂ СЃ РєРЅРѕРїРєР°РјРё СѓРїСЂР°РІР»РµРЅРёСЏ (File, Edit, View, Tools, Group)
- РЎРІРѕСЂР°С‡РёРІР°РµРјС‹Рµ СЃРµРєС†РёРё С‚СѓР»Р±Р°СЂР° РїРѕ РєР»РёРєСѓ РЅР° Р·Р°РіРѕР»РѕРІРѕРє
- РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ С‚СѓР»Р±Р°СЂР° СЃ РєРѕРјР°РЅРґР°РјРё Hide, Icons, Text
- Р“РѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Р№ СЃРєСЂРѕР»Р»РёРЅРі С‚СѓР»Р±Р°СЂР° (РєРѕР»РµСЃРѕ РјС‹С€Рё + СЃСЂРµРґРЅРёР№ РєР»РёРє)
- РЈРїСЂР°РІР»РµРЅРёРµ РІРёРґРёРјРѕСЃС‚СЊСЋ РёРєРѕРЅРѕРє Рё С‚РµРєСЃС‚Р° РєРЅРѕРїРѕРє С‚СѓР»Р±Р°СЂР°
- РРЅС‚РµРіСЂР°С†РёСЏ С‚СѓР»Р±Р°СЂР° РІ СЃРёСЃС‚РµРјСѓ СѓРїСЂР°РІР»РµРЅРёСЏ РїР°РЅРµР»СЏРјРё

### Changed
- РџРµСЂРµСЂР°Р±РѕС‚Р°РЅР° СЃС‚СЂСѓРєС‚СѓСЂР° HTML layout РґР»СЏ РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅРѕРіРѕ СЂР°Р·РґРµР»РµРЅРёСЏ
- РўСѓР»Р±Р°СЂ РїРµСЂРµРјРµС‰РµРЅ РІ РІРµСЂС…РЅСЋСЋ С‡Р°СЃС‚СЊ СЂР°Р±РѕС‡РµР№ РѕР±Р»Р°СЃС‚Рё
- РћР±РЅРѕРІР»РµРЅР° СЃРёСЃС‚РµРјР° СѓРїСЂР°РІР»РµРЅРёСЏ РІРёРґРёРјРѕСЃС‚СЊСЋ РїР°РЅРµР»РµР№ РґР»СЏ С‚СѓР»Р±Р°СЂР°
- РЈР»СѓС‡С€РµРЅР° РёРЅС‚РµРіСЂР°С†РёСЏ С‚СѓР»Р±Р°СЂР° СЃ Game Mode

### Fixed
- РСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ С‚СѓР»Р±Р°СЂР° (РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РІРЅРёР·)
- РЈР»СѓС‡С€РµРЅР° СЃРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЃРѕСЃС‚РѕСЏРЅРёР№ С‚СѓР»Р±Р°СЂР° СЃ РјРµРЅСЋ View
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅС‹ СЃС‚РёР»Рё С‚СѓР»Р±Р°СЂР° РґР»СЏ РЅРѕРІРѕР№ РїРѕР·РёС†РёРё

## [3.11.0] - 2024-12-19

### Added
- РЈР»СѓС‡С€РµРЅРЅР°СЏ СЃРёСЃС‚РµРјР° РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ СЃ С†РµРЅС‚СЂР°Р»РёР·РѕРІР°РЅРЅС‹Рј СѓРїСЂР°РІР»РµРЅРёРµРј
- РћРїС‚РёРјРёР·РёСЂРѕРІР°РЅРЅС‹Рµ СЃС‚РёР»Рё РґР»СЏ РІСЃРµС… РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ (BaseContextMenu, ConsoleContextMenu)
- РЈР»СѓС‡С€РµРЅРЅР°СЏ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅРѕСЃС‚СЊ OutlinerContextMenu СЃ РёСЃРїСЂР°РІР»РµРЅРЅС‹РјРё Р±Р°РіР°РјРё

### Changed
- РћР±РЅРѕРІР»РµРЅР° СЃРёСЃС‚РµРјР° СЃС‚РёР»РµР№ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ РґР»СЏ Р»СѓС‡С€РµР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
- РЈР»СѓС‡С€РµРЅР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЊРЅРѕСЃС‚СЊ РѕС‚РѕР±СЂР°Р¶РµРЅРёСЏ РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ

### Fixed
- РСЃРїСЂР°РІР»РµРЅС‹ РїСЂРѕР±Р»РµРјС‹ СЃ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµРј РєРѕРЅС‚РµРєСЃС‚РЅС‹С… РјРµРЅСЋ
- РЈСЃС‚СЂР°РЅРµРЅС‹ Р±Р°РіРё РІ OutlinerContextMenu
- РЈР»СѓС‡С€РµРЅР° СЃС‚Р°Р±РёР»СЊРЅРѕСЃС‚СЊ СЂР°Р±РѕС‚С‹ СЃ РєРѕРЅС‚РµРєСЃС‚РЅС‹РјРё РјРµРЅСЋ

## [3.10.0] - 2024-12-19

### Added
- РЎРёСЃС‚РµРјР° РєРѕРЅСЃС‚СЂРµР№РЅР° РѕСЃРё РїСЂРё РїРµСЂРµС‚Р°СЃРєРёРІР°РЅРёРё РѕР±СЉРµРєС‚РѕРІ СЃ Р·Р°Р¶Р°С‚С‹Рј Shift
- Р’РёР·СѓР°Р»СЊРЅРѕРµ РѕС‚РѕР±СЂР°Р¶РµРЅРёРµ РѕСЃРё РєРѕРЅСЃС‚СЂРµР№РЅР° СЃ РЅР°СЃС‚СЂР°РёРІР°РµРјС‹РјРё РїР°СЂР°РјРµС‚СЂР°РјРё
- РќР°СЃС‚СЂРѕР№РєРё РѕСЃРё РєРѕРЅСЃС‚СЂРµР№РЅР° РІ РїР°РЅРµР»Рё РЅР°СЃС‚СЂРѕРµРє (С†РІРµС‚, С‚РѕР»С‰РёРЅР°, РІРєР»СЋС‡РµРЅРёРµ/РѕС‚РєР»СЋС‡РµРЅРёРµ)
- РЎРѕС…СЂР°РЅРµРЅРёРµ РІСЃРµС… РЅР°СЃС‚СЂРѕРµРє View РІ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… РЅР°СЃС‚СЂРѕР№РєР°С…
- РљРѕСЂСЂРµРєС‚РЅРѕРµ РІС‹С‡РёСЃР»РµРЅРёРµ С†РµРЅС‚СЂР° РіСЂСѓРїРї РґР»СЏ РѕСЃРё РєРѕРЅСЃС‚СЂРµР№РЅР°
- РџРѕРґРґРµСЂР¶РєР° С„РёРєСЃР°С†РёРё РѕСЃРё Рє С‚РµРєСѓС‰РµР№ РїРѕР·РёС†РёРё РѕР±СЉРµРєС‚Р° РїСЂРё Р·Р°Р¶Р°С‚РёРё Shift

### Changed
- РћСЃСЊ РєРѕРЅСЃС‚СЂРµР№РЅР° С‚РµРїРµСЂСЊ С„РёРєСЃРёСЂСѓРµС‚СЃСЏ Рє С†РµРЅС‚СЂСѓ РѕР±СЉРµРєС‚Р°/РіСЂСѓРїРїС‹, Р° РЅРµ Рє РєСѓСЂСЃРѕСЂСѓ
- РћСЃСЊ РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ РІ РѕР±Рµ СЃС‚РѕСЂРѕРЅС‹ РѕС‚ С†РµРЅС‚СЂР° РґРѕ РєСЂР°РµРІ РІРёРґРёРјРѕР№ РѕР±Р»Р°СЃС‚Рё
- РќР°СЃС‚СЂРѕР№РєРё View (Grid, Game Mode, Snap To Grid, Object Boundaries, Object Collisions) С‚РµРїРµСЂСЊ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РјРµР¶РґСѓ СЃРµСЃСЃРёСЏРјРё
- Game Mode РєРѕСЂСЂРµРєС‚РЅРѕ РІРѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµС‚СЃСЏ РїСЂРё РїРµСЂРµР·Р°РїСѓСЃРєРµ СЂРµРґР°РєС‚РѕСЂР°

### Fixed
- РСЃРїСЂР°РІР»РµРЅР° РѕС‚СЂРёСЃРѕРІРєР° РѕСЃРё РєРѕРЅСЃС‚СЂРµР№РЅР° СЃ СѓС‡РµС‚РѕРј Р·СѓРјР° Рё РїР°РЅРѕСЂР°РјРёСЂРѕРІР°РЅРёСЏ РєР°РјРµСЂС‹
- РСЃРїСЂР°РІР»РµРЅРѕ РІС‹С‡РёСЃР»РµРЅРёРµ С†РµРЅС‚СЂР° РіСЂСѓРїРї РґР»СЏ Р±РѕР»РµРµ С‚РѕС‡РЅРѕРіРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёСЏ РѕСЃРё
- РСЃРїСЂР°РІР»РµРЅРѕ СЃРѕС…СЂР°РЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ Game Mode РїСЂРё РїРµСЂРµР·Р°РїСѓСЃРєРµ

## [3.9.0] - 2024-12-19

### Added
- РќРѕРІР°СЏ СЃРёСЃС‚РµРјР° РїРѕРёСЃРєР° РІ OutlinerPanel СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕРіРѕ SearchUtils
- РљРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РІ OutlinerPanel (OutlinerContextMenu)
- Р›РѕРіРёРєР° РІС‹РґРµР»РµРЅРёСЏ РґРёР°РїР°Р·РѕРЅР° РѕР±СЉРµРєС‚РѕРІ (Shift+РєР»РёРє)
- Р›РѕРіРёРєР° РїРµСЂРµРєР»СЋС‡РµРЅРёСЏ РµРґРёРЅРёС‡РЅС‹С… РѕР±СЉРµРєС‚РѕРІ (Ctrl+РєР»РёРє)
- РџРѕРґРґРµСЂР¶РєР° РІС‹РґРµР»РµРЅРёСЏ РїРѕ РѕС‚С„РёР»СЊС‚СЂРѕРІР°РЅРЅРѕРјСѓ СЃРїРёСЃРєСѓ РїСЂРё Р°РєС‚РёРІРЅРѕРј РїРѕРёСЃРєРµ
- РќРѕРІС‹Р№ РєР»Р°СЃСЃ SearchUtils РґР»СЏ СѓРЅРёС„РёС†РёСЂРѕРІР°РЅРЅРѕРіРѕ РїРѕРёСЃРєР° РІ РїР°РЅРµР»СЏС…
- РџРѕРґРґРµСЂР¶РєР° Logger.outliner РґР»СЏ Р»РѕРіРёСЂРѕРІР°РЅРёСЏ РѕРїРµСЂР°С†РёР№ OutlinerPanel

### Changed
- OutlinerPanel С‚РµРїРµСЂСЊ РёСЃРїРѕР»СЊР·СѓРµС‚ РѕР±С‰СѓСЋ СЃРёСЃС‚РµРјСѓ РїРѕРёСЃРєР° СЃ LayersPanel
- РЎС‚РёР»СЊ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёСЏ РѕР±СЉРµРєС‚РѕРІ РїСЂРёРІРµРґРµРЅ РІ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРµ СЃ LayersPanel
- РџРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РёРєРѕРЅРѕРє С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ РёСЃРїСЂР°РІР»РµРЅРѕ Рё РІС‹СЂРѕРІРЅРµРЅРѕ
- reassignIdsDeep С‚РµРїРµСЂСЊ СЃРѕР·РґР°РµС‚ СЃС‚СЂРѕРєРѕРІС‹Рµ ID РІРјРµСЃС‚Рѕ С‡РёСЃР»РѕРІС‹С…
- РЈР»СѓС‡С€РµРЅР° РёРЅРґРµРєСЃР°С†РёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ РІ РіСЂСѓРїРїР°С…

### Fixed
- РСЃРїСЂР°РІР»РµРЅРѕ РєРѕРЅС‚РµРєСЃС‚РЅРѕРµ РјРµРЅСЋ, РєРѕС‚РѕСЂРѕРµ РїРѕСЃС‚РѕСЏРЅРЅРѕ РїРѕРєР°Р·С‹РІР°Р»РѕСЃСЊ Рё РЅРµ РёСЃС‡РµР·Р°Р»Рѕ
- РСЃРїСЂР°РІР»РµРЅРѕ РЅР°РєРѕРїР»РµРЅРёРµ РѕР±СЂР°Р±РѕС‚С‡РёРєРѕРІ СЃРѕР±С‹С‚РёР№ РїСЂРё РїРµСЂРµСЃРѕР·РґР°РЅРёРё РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ
- РСЃРїСЂР°РІР»РµРЅР° СЂР°Р±РѕС‚Р° РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ РЅР° РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹С… РѕР±СЉРµРєС‚Р°С…
- РСЃРїСЂР°РІР»РµРЅРѕ РїРѕР·РёС†РёРѕРЅРёСЂРѕРІР°РЅРёРµ РёРєРѕРЅРѕРє С‚РёРїРѕРІ РѕР±СЉРµРєС‚РѕРІ РІ OutlinerPanel
- РСЃРїСЂР°РІР»РµРЅРѕ РїРѕСЏРІР»РµРЅРёРµ СЃРєСЂРѕР»Р»-Р±Р°СЂР° РїСЂРё Р°РєС‚РёРІР°С†РёРё РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёСЏ

## [3.8.8] - 2024-12-19

### Fixed
- РСЃРїСЂР°РІР»РµРЅС‹ РєРѕРѕСЂРґРёРЅР°С‚С‹ РґСѓР±Р»РёСЂСѓРµРјС‹С… РѕР±СЉРµРєС‚РѕРІ РІ РѕС‚РєСЂС‹С‚С‹С… РіСЂСѓРїРїР°С… - С‚РµРїРµСЂСЊ РґСѓР±Р»РёРєР°С‚С‹ РїРѕСЏРІР»СЏСЋС‚СЃСЏ С‚РѕС‡РЅРѕ РІ С‚РѕРј Р¶Рµ РјРµСЃС‚Рµ, С‡С‚Рѕ Рё РѕСЂРёРіРёРЅР°Р»С‹
- РСЃРїСЂР°РІР»РµРЅ СЂР°СЃС‡РµС‚ РјРёСЂРѕРІС‹С… РєРѕРѕСЂРґРёРЅР°С‚ РґР»СЏ РѕР±СЉРµРєС‚РѕРІ РІРЅСѓС‚СЂРё РіСЂСѓРїРї РїСЂРё РґСѓР±Р»РёСЂРѕРІР°РЅРёРё
- РЈРїСЂРѕС‰РµРЅР° Р»РѕРіРёРєР° СЂР°Р·РјРµС‰РµРЅРёСЏ РґСѓР±Р»РёСЂРѕРІР°РЅРЅС‹С… РѕР±СЉРµРєС‚РѕРІ РІ СЂРµР¶РёРјРµ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёСЏ РіСЂСѓРїРї

## [3.8.7] - 2024-12-19

### Added
- Р—Р°С‰РёС‚Р° РѕС‚ РґРѕР±Р°РІР»РµРЅРёСЏ РѕР±СЉРµРєС‚РѕРІ РЅР° Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹Рµ СЃР»РѕРё С‡РµСЂРµР· drag&drop

### Changed
- Ctrl+Click РЅР° СЃР»РѕРµ С‚РµРїРµСЂСЊ РІС‹Р±РёСЂР°РµС‚ РІСЃРµ РѕР±СЉРµРєС‚С‹ РІ СЃР»РѕРµ РІРјРµСЃС‚Рѕ РІС‹Р±РѕСЂР° СЃР»РѕС‘РІ
- Alt+Click+Drag С‚РµРїРµСЂСЊ СЂР°Р±РѕС‚Р°РµС‚ РЅР° Р»СЋР±С‹С… РѕР±СЉРµРєС‚Р°С…, РЅРµ С‚РѕР»СЊРєРѕ РІС‹Р±СЂР°РЅРЅС‹С…

### Fixed
- РСЃРїСЂР°РІР»РµРЅР° РєРѕРјР°РЅРґР° "Show All Layers" - РѕР±СЉРµРєС‚С‹ РєРѕСЂСЂРµРєС‚РЅРѕ РѕС‚РѕР±СЂР°Р¶Р°СЋС‚СЃСЏ РїРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёСЏ РІРёРґРёРјРѕСЃС‚Рё
- РСЃРїСЂР°РІР»РµРЅРѕ РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ СЃ Alt+Click РЅР° РЅРµРІС‹Р±СЂР°РЅРЅС‹С… РѕР±СЉРµРєС‚Р°С…

### Removed
- РЈРґР°Р»РµРЅР° РєРѕРјР°РЅРґР° "Move Objects to Main Layer" РёР· РєРѕРЅС‚РµРєСЃС‚РЅРѕРіРѕ РјРµРЅСЋ СЃР»РѕС‘РІ
- РЈРґР°Р»РµРЅР° Р»РѕРіРёРєР° РІС‹Р±РѕСЂР° СЃР»РѕС‘РІ (selectedLayers) Рё СЃРІСЏР·Р°РЅРЅС‹Рµ РјРµС‚РѕРґС‹
- РЈРґР°Р»РµРЅС‹ РїСѓРЅРєС‚С‹ РјРµРЅСЋ "Select All Layers" Рё "Deselect All"

## [3.8.6] - 2024-12-18

### Fixed
- РСЃРїСЂР°РІР»РµРЅР° СЃРёСЃС‚РµРјР° РІРµСЂСЃРёРѕРЅРёСЂРѕРІР°РЅРёСЏ
- РЈР»СѓС‡С€РµРЅР° Р°СЂС…РёС‚РµРєС‚СѓСЂР° СѓС‚РёР»РёС‚Р°СЂРЅС‹С… РєР»Р°СЃСЃРѕРІ
