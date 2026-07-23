/**
 * Catalog of component types that attach to an Actor/GameObject, derived from
 * tmp/game-editor-asset-types.md section 3. These are editor-side metadata stubs
 * (type + default properties) — actual runtime behavior (collision resolution,
 * AI, dialogue execution, etc.) is implemented by the game consuming the exported
 * level JSON, not by the editor itself.
 */

import { defaultComponentProperties as getDefaultComponentProperties } from './ComponentPropertySchema.js';

export const COMPONENT_CATEGORY = { label: 'Component Library', color: '#f87171' };

export const COMPONENT_TYPES = [
    { id: 'sprite', label: 'Sprite', description: 'Static visual: references an Image asset (not a disk path).', genres: 'all' },
    { id: 'collider', label: 'Collider', description: 'Collision frame: box / circle / freeform; optional color. Does not crop the sprite.', genres: 'all' },
    { id: 'trigger', label: 'Trigger', description: 'Zone (box / circle / freeform) reacting to enter/exit.', genres: 'all' },
    { id: 'transformAnimation', label: 'Transform Animation', description: 'Move/rotate/scale along a Path or curve.', genres: 'platformer, transport' },
    { id: 'spriteUiAnimation', label: 'Sprite / UI Animation', description: 'Frame-by-frame animation into entity texture (Image asset / resolved imgSrc atlas).', genres: 'all' },
    { id: 'interactable', label: 'Interactable', description: 'Makes Actor usable via interact button (radius + hint).', genres: 'adventure, RPG, puzzle' },
    { id: 'pickup', label: 'Pickup', description: 'References an Item Definition; removes from level, adds to inventory.', genres: 'most genres' },
    { id: 'dialogueTrigger', label: 'Dialogue Trigger', description: 'References a Dialogue Graph, fired via Interactable/Trigger.', genres: 'RPG, adventure, visual novel' },
    { id: 'damageHealth', label: 'Damage / Health', description: 'HP, damage, death, invulnerability.', genres: 'action, platformer, RPG' },
    { id: 'movablePushable', label: 'Movable / Pushable', description: 'Actor can be pushed/pulled (box puzzles).', genres: 'puzzle, Sokoban-like' },
    { id: 'mountableVehicleSeat', label: 'Mountable / Vehicle Seat', description: 'Player mount point, hands control to the vehicle Actor.', genres: 'racing, exploration' },
    { id: 'pathFollower', label: 'Path Follower', description: 'Actor moves along a Path automatically.', genres: 'all with moving objects' },
    { id: 'spawner', label: 'Spawner', description: 'Periodically/conditionally spawns other Actors.', genres: 'action, roguelike' },
    { id: 'stateMachineBehavior', label: 'State Machine / Behavior', description: 'Finite state machine for NPCs/mechanisms.', genres: 'action-AI' },
    { id: 'playerStart', label: 'Player Start', description: 'Player spawn point marker.', genres: 'all' },
    { id: 'camera', label: 'Camera', description: 'Marks the active scene camera: follow target, deadzone, bounds clamp.', genres: 'all' },
    { id: 'checkpointSavePoint', label: 'Checkpoint / Save Point', description: 'Fixes progress / respawn point.', genres: 'platformer, RPG' },
    { id: 'climbableLadder', label: 'Climbable / Ladder', description: 'Allows vertical movement along the Actor.', genres: 'platformer, metroidvania' },
    { id: 'conveyorZiplineJumpPadPortal', label: 'Conveyor / Zipline / Jump Pad / Portal', description: 'Specialized movement-on-contact Volume/Trigger + impulse or teleport.', genres: 'platformer, puzzle' },
    { id: 'destructibleContainer', label: 'Destructible Container', description: 'Chest/vase/crate: yields a Pickup and changes sprite/disappears.', genres: 'adventure, action' },
    { id: 'variableModifier', label: 'Variable Modifier', description: 'Sets a global flag/variable on trigger (for Quest/Dialogue conditions).', genres: 'all with level logic' }
];

const COMPONENT_TYPE_MAP = new Map(COMPONENT_TYPES.map(c => [c.id, c]));

export function getComponentTypeById(id) {
    return COMPONENT_TYPE_MAP.get(id) || null;
}

/** Monotonic counter so same-ms stubs never share an id. */
let _componentStubSeq = 0;

/**
 * New component instance — always unique `id` (type may repeat on one asset).
 * @param {string} typeId
 * @returns {{ id: string, type: string, enabled: boolean, properties: object }|null}
 */
export function createComponentStub(typeId) {
    const def = getComponentTypeById(typeId);
    if (!def) return null;
    _componentStubSeq = (_componentStubSeq + 1) >>> 0;
    return {
        id: `comp_${Date.now().toString(36)}_${_componentStubSeq.toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
        type: typeId,
        enabled: true,
        properties: { ...getDefaultComponentProperties(typeId) }
    };
}

/**
 * Display labels for a component list: same type → "Collider", "Collider 2", …
 * Identity is always `comp.id` (like Outliner object ids; labels are not keys).
 * @param {Array<{ id?: string, type?: string }>} components
 * @returns {Map<string, string>} id → label
 */
export function buildComponentDisplayLabels(components) {
    const list = Array.isArray(components) ? components : [];
    const typeTotal = new Map();
    for (const c of list) {
        const t = c?.type || 'unknown';
        typeTotal.set(t, (typeTotal.get(t) || 0) + 1);
    }
    const typeSeen = new Map();
    const labels = new Map();
    for (const c of list) {
        if (!c?.id) continue;
        const t = c.type || 'unknown';
        const def = getComponentTypeById(t);
        const base = def?.label || t;
        const n = (typeSeen.get(t) || 0) + 1;
        typeSeen.set(t, n);
        labels.set(c.id, typeTotal.get(t) > 1 ? `${base} ${n}` : base);
    }
    return labels;
}
