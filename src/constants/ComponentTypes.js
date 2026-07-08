/**
 * Catalog of component types that attach to an Actor/GameObject, derived from
 * tmp/game-editor-asset-types.md section 3. These are editor-side metadata stubs
 * (type + default properties) — actual runtime behavior (collision resolution,
 * AI, dialogue execution, etc.) is implemented by the game consuming the exported
 * level JSON, not by the editor itself.
 */

export const COMPONENT_CATEGORY = { label: 'Component Library', color: '#f87171' };

export const COMPONENT_TYPES = [
    { id: 'collider', label: 'Collider', description: 'Collision shape.', genres: 'all' },
    { id: 'trigger', label: 'Trigger', description: 'Zone reacting to player enter/exit.', genres: 'all' },
    { id: 'transformAnimation', label: 'Transform Animation', description: 'Move/rotate/scale along a Path or curve.', genres: 'platformer, transport' },
    { id: 'spriteUiAnimation', label: 'Sprite / UI Animation', description: 'Frame-by-frame animation playback.', genres: 'all' },
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

export function createComponentStub(typeId) {
    const def = getComponentTypeById(typeId);
    if (!def) return null;
    return {
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: typeId,
        enabled: true,
        properties: {}
    };
}
