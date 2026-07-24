import { EntityFactory } from './EntityFactory.js';
import { Entity } from './Entity.js';
import { ColliderBehavior } from './behaviors/ColliderBehavior.js';
import { PlayerMovementBehavior } from './behaviors/PlayerMovementBehavior.js';
import { Inventory } from './Inventory.js';
import { QuestRunner } from './QuestRunner.js';

/**
 * Runtime scene — one loaded level's worth of entities/layers/settings/camera.
 * Engine-side counterpart of editor's Level, stripped to what playback needs
 * (no undo/index caches/notify callbacks — those serve editing, not playback).
 */
export class Scene {
    constructor(levelData = {}) {
        this.entities = (levelData.objects || []).map(obj => EntityFactory.fromGameObjectData(obj));
        this.layers = levelData.layers || [];
        this.settings = {
            backgroundColor: levelData.settings?.backgroundColor || '#4B5563',
            parallaxHorizontal: levelData.settings?.parallaxHorizontal ?? 1,
            parallaxVertical: levelData.settings?.parallaxVertical ?? 1
        };
        this.camera = {
            x: levelData.camera?.x || 0,
            y: levelData.camera?.y || 0,
            zoom: levelData.camera?.zoom || 1
        };
        // Level-scope Event Graph (tmp/2D_Editor_LOGIC_SYSTEMS_PLAN.md Фаза D), null when the
        // level has none authored yet. GameEngine wires the interpreter into
        // `this.eventGraphRuntime` after construction — kept as a plain Scene field (not
        // constructor-built) so ProjectLoader.loadLevel() doesn't need to know about it.
        this.eventGraph = levelData.eventGraph || null;
        this.eventGraphRuntime = null;
        // §7 backlog (inputMap, Tier 3): keyboard action→key bindings, null when the level has
        // none authored (GameEngine.loadProject() calls `this.input.setInputMap(scene.inputMap)`,
        // which itself treats null as "use Input.DEFAULT_ACTIONS only" — same plain-field
        // convention as eventGraph above, not a separate catalog asset).
        this.inputMap = levelData.inputMap || null;
        // Level-scope Dialogue Graphs (Фаза E), keyed by id — a plain field/level-scope map,
        // not the catalog `assetsById` registry (see below, §7 backlog prefab Tier 2) — dialogues
        // aren't catalog assets. StartDialogue resolves node.params.dialogueId against this map.
        this.dialogues = new Map((levelData.dialogues || []).map(d => [d.id, d]));
        this.dialogueRunner = null;
        this.dialogueActive = false;
        // §7 sequenceCutscene: true while a playing sequence has lockPlayer (PlayerMovement pauses).
        this.cutsceneActive = false;
        // HUD Canvases (Level.canvases), keyed by id — same "plain field" shortcut as
        // dialogues/eventGraph above. CanvasHudRenderer reads scene.canvases + the active id
        // list below to build the on-screen widget tree.
        this.canvases = new Map((levelData.canvases || []).map(c => [c.id, c]));
        // Canvas ids the active camera renders this tick (CameraBehavior.getCanvasIds(),
        // written by GameEngine._updateCamera()); null/empty = no HUD canvas shown.
        this.activeCanvasIds = null;
        // Item definitions (levelData.items) — display names for HUD / pickers.
        this.itemDefs = new Map(
            (levelData.items || [])
                .filter((i) => i && i.id)
                .map((i) => [i.id, i])
        );
        // Player item bag for dialogue give/take/require (levelData.inventory seed optional).
        this.inventory = new Inventory(levelData.inventory || null);
        // Per-object NPC bags (levelData.npcInventories: { [objectId]: seed }).
        /** @type {Map<string, Inventory>} */
        this.npcInventories = new Map();
        const npcSeed = levelData.npcInventories || {};
        if (npcSeed && typeof npcSeed === 'object') {
            for (const [objectId, seed] of Object.entries(npcSeed)) {
                if (!objectId) continue;
                this.npcInventories.set(objectId, new Inventory(seed));
            }
        }
        // §7 backlog (questObjective, Tier 3): quest definitions (level.quests), keyed by id —
        // same level-scope-map convention as dialogues/canvases/itemDefs above. QuestRunner is
        // self-contained (only needs `this`, resolves `this.eventGraphRuntime` lazily on each
        // tick — see QuestRunner.js), so it's built here directly rather than wired post-hoc by
        // GameEngine like eventGraphRuntime/dialogueRunner are.
        this.quests = new Map((levelData.quests || []).filter(q => q?.id).map(q => [q.id, q]));
        this.questRunner = new QuestRunner(this);
        // §7 backlog (prefab, Tier 2): catalog asset registry, keyed by asset id — populated
        // by ProjectLoader.loadLevel() from registries.assetsById (empty Map by default here,
        // e.g. for tests/callers constructing a Scene directly). Consumed by the `SpawnObject`
        // Event Graph node via EntityFactory.fromAssetData().
        this.assetsById = new Map();
        // Active camera marker entity (docs/RUNTIME_SCHEMA.md `camera`), set by
        // hideCameraMarker() at load time; null when the level has none (GameEngine falls
        // back to hardcoded player-centering, see GameEngine._updateCamera()).
        this.cameraEntity = null;
        // Respawn state written by CheckpointSaveBehavior.activate() — null until the player
        // crosses a checkpoint, at which point respawnPlayer() prefers it over playerStart.
        this.checkpointPosition = null;
        this.activeCheckpoint = null;
    }

    /**
     * Resolve a bag: 'player' | empty → player inventory; else objectId NPC bag (created empty).
     * @param {string|null|undefined} bagRef
     * @returns {Inventory}
     */
    getBag(bagRef) {
        if (!bagRef || bagRef === 'player') return this.inventory;
        let bag = this.npcInventories.get(bagRef);
        if (!bag) {
            bag = new Inventory(null);
            this.npcInventories.set(bagRef, bag);
        }
        return bag;
    }

    getLayersSorted() {
        return [...this.layers].sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    getLayerById(layerId) {
        return this.layers.find(layer => layer.id === layerId);
    }

    getVisibleLayerIds() {
        return new Set(this.layers.filter(layer => layer.visible !== false).map(layer => layer.id));
    }

    /** Flat list of all entities, including nested group children. */
    getAllEntities() {
        const result = [];
        const walk = (list) => {
            for (const entity of list) {
                result.push(entity);
                if (entity.children) walk(entity.children);
            }
        };
        walk(this.entities);
        return result;
    }

    /** @returns {import('./Entity.js').Entity|null} the first entity carrying a playerStart behavior. */
    findPlayerStartEntity() {
        return this.getAllEntities()
            .find(entity => entity.behaviors.some(b => typeof b.getSpawnPosition === 'function'));
    }

    /** @returns {{x: number, y: number}|null} spawn position from the first playerStart entity found. */
    getPlayerStart() {
        const entity = this.findPlayerStartEntity();
        if (!entity) return null;
        const behavior = entity.behaviors.find(b => typeof b.getSpawnPosition === 'function');
        return behavior.getSpawnPosition();
    }

    /**
     * Creates the runtime player entity at the playerStart marker's position and hides the
     * marker itself (it's a design-time gizmo, not something that should render alongside
     * the actual player). No-op if the level has no playerStart entity.
     * @param {number} [speed] - px/sec, forwarded to PlayerMovementBehavior.
     * @returns {import('./Entity.js').Entity|null}
     */
    spawnPlayer(speed = 200) {
        const marker = this.findPlayerStartEntity();
        if (!marker) return null;
        const spawn = marker.behaviors.find(b => typeof b.getSpawnPosition === 'function').getSpawnPosition();
        marker.visible = false;
        this._playerStartMarker = marker;
        return this._createPlayer(spawn, marker, speed);
    }

    /**
     * Recreates the player entity after death (see DamageHealthBehavior.destroyOnDeath),
     * at `checkpointPosition` if a `checkpointSavePoint` was activated (CheckpointSaveBehavior),
     * else back at the playerStart marker. No-op if the player is already alive or the level
     * has no playerStart marker (spawnPlayer() was never able to run either).
     */
    respawnPlayer(speed = 200) {
        if (this.player) return this.player;
        const marker = this._playerStartMarker;
        if (!marker) return null;
        const spawn = this.checkpointPosition
            || marker.behaviors.find(b => typeof b.getSpawnPosition === 'function').getSpawnPosition();
        return this._createPlayer(spawn, marker, speed);
    }

    _createPlayer(spawn, marker, speed) {
        const player = new Entity({
            id: '__player', type: 'player', x: spawn.x, y: spawn.y,
            width: marker.width, height: marker.height, color: '#22c55e'
        });
        player.behaviors = [
            new ColliderBehavior(player, {}),
            new PlayerMovementBehavior(player, { properties: { speed } })
        ];

        this.player = player;
        this.entities.push(player);
        return player;
    }

    /**
     * Removes an entity by id (searches nested group children too). Used by Event Graph's
     * DestroyObject action (Фаза D) — no-op if the id isn't found (already destroyed/unknown).
     * @returns {boolean} true if an entity was actually removed
     */
    destroyEntity(id) {
        const removeFrom = (list) => {
            const index = list.findIndex(entity => entity.id === id);
            if (index !== -1) {
                list.splice(index, 1);
                return true;
            }
            return list.some(entity => entity.children && removeFrom(entity.children));
        };
        const removed = removeFrom(this.entities);
        if (removed && this.player?.id === id) this.player = null;
        if (removed && this.cameraEntity?.id === id) this.cameraEntity = null;
        return removed;
    }

    /** @returns {import('./Entity.js').Entity|null} the first entity carrying a CameraBehavior. */
    findCameraEntity() {
        return this.getAllEntities()
            .find(entity => entity.behaviors.some(b => typeof b.computeCamera === 'function'));
    }

    /**
     * Hides the camera marker (design-time gizmo, like playerStart) so it doesn't render as a
     * stray colored box, and caches it on `this.cameraEntity` for GameEngine._updateCamera().
     * No-op if the level has no camera marker.
     */
    hideCameraMarker() {
        const entity = this.findCameraEntity();
        if (entity) entity.visible = false;
        this.cameraEntity = entity || null;
        return entity;
    }
}
