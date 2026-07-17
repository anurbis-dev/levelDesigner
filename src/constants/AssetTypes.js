/**
 * Catalog of creatable content-asset types, derived from tmp/game-editor-asset-types.md.
 * Each type can be instantiated as a placeholder Asset via AssetManager.createPlaceholderAsset(),
 * shown in the Assets panel with a type icon (see AssetTypeIcons.js) until real content/behavior
 * is authored for it.
 */

export const ASSET_CATEGORIES = {
    core: { label: 'Core', color: '#9ca3af' },
    visual: { label: 'Visual / Render', color: '#60a5fa' },
    audio: { label: 'Audio', color: '#f472b6' },
    data: { label: 'Data / System', color: '#34d399' },
    navigation: { label: 'Navigation / AI', color: '#fbbf24' },
    other: { label: 'Other', color: '#a78bfa' }
};

export const ASSET_TYPES = [
    // Core (section 1 — not yet backed by dedicated code, only Level/Image/Actor are real today)
    { id: 'camera', label: 'Camera', category: 'core', description: 'Scene camera: FOV/zoom, follow-target, bounds, render layers.' },
    { id: 'actor', label: 'Actor Placeholder', category: 'core', description: 'Generic Actor container asset (visual + collisions + triggers + animation).' },
    { id: 'image', label: 'Image', category: 'core', description: 'Raw bitmap resource.' },
    { id: 'imageAtlas', label: 'Image Atlas', category: 'core', description: 'Auto-packed image atlas / sprite sheet source.' },
    { id: 'volume', label: 'Volume', category: 'core', description: 'Arbitrary-shape trigger zone with visual effects (blur/color/shadow).' },
    // id must stay 'player_start' (not camelCase) — matches the GameObject.type string that
    // LevelEditor.ensurePlayerStartExists()/getPlayerStartCount() and FileManager.createNewLevel()
    // already use for the auto-managed, exactly-one-per-level spawn marker (see LevelEditor.js,
    // FileManager.js). width/height/color mirror that existing marker's look.
    { id: 'player_start', label: 'Player Start', category: 'core', description: 'Marks where the player spawns when the level loads.', width: 32, height: 32, color: 'lightblue' },

    // Visual / render (section 2)
    { id: 'spriteAnimationClip', label: 'Sprite Animation Clip', category: 'visual', description: 'Frame sequence from an Atlas + timings + loop mode.' },
    { id: 'tileset', label: 'Tileset', category: 'visual', description: 'Grid of tile images with autotiling rules.' },
    { id: 'tilemap', label: 'Tilemap', category: 'visual', description: 'Level layer built from Tileset tiles.' },
    { id: 'nineSliceSprite', label: 'Nine-Slice Sprite', category: 'visual', description: 'Stretchable-edge image for UI frames/scalable decorations.' },
    { id: 'fontTextStyle', label: 'Font / Text Style', category: 'visual', description: 'Font + size/outline/shadow parameters.' },
    { id: 'particleEffect', label: 'Particle Effect', category: 'visual', description: 'VFX emitter: sprite particles, gravity/speed/color over lifetime.' },
    { id: 'materialShaderPreset', label: 'Material / Shader Preset', category: 'visual', description: 'Reusable filter preset (blur/color/shadow) for Volume and others.' },
    { id: 'light', label: 'Light', category: 'visual', description: 'Point/directional/area light source, soft shadows over tilemap.' },

    // Audio
    { id: 'soundEffect', label: 'Sound Effect (SFX)', category: 'audio', description: 'Short sound bound to events (step, hit, pickup).' },
    { id: 'musicTrack', label: 'Music Track', category: 'audio', description: 'Music with crossfade/loop points.' },
    { id: 'audioZone', label: 'Audio Zone', category: 'audio', description: 'Volume specialization: ambient sound/music on player enter.' },

    // Data / system
    { id: 'dialogueGraph', label: 'Dialogue Graph', category: 'data', description: 'Branching dialogue lines with conditions and actions.' },
    { id: 'questObjective', label: 'Quest / Objective', category: 'data', description: 'Quest definition: steps, completion conditions, reward.' },
    { id: 'itemDefinition', label: 'Item Definition', category: 'data', description: 'Item data: icon, name, type, stack, use effect.' },
    { id: 'inventorySchema', label: 'Inventory Schema', category: 'data', description: 'Slot/weight/category structure for a game\'s inventory system.' },
    { id: 'localizationTable', label: 'Localization Table', category: 'data', description: 'Text strings per language, keyed for Dialogue/Quest.' },
    { id: 'saveSchema', label: 'Save Schema / Game State', category: 'data', description: 'Persistent variables/flags across levels and sessions.' },
    { id: 'inputMap', label: 'Input Map', category: 'data', description: 'Keyboard/gamepad/touch control layout.' },

    // Navigation / AI
    { id: 'pathSpline', label: 'Path / Spline', category: 'navigation', description: 'Point sequence with interpolation for patrol/platforms/camera/rails.' },
    { id: 'navMesh', label: 'NavMesh / Walkable Area', category: 'navigation', description: 'Zone AI can path across (free AI movement).' },
    { id: 'aiBehaviorPreset', label: 'AI Behavior Preset', category: 'navigation', description: 'Reusable AI behavior parameters (aggro radius, speed, mode).' },

    // Other
    { id: 'prefab', label: 'Prefab / Actor Template', category: 'other', description: 'Saved Actor with preconfigured components/parameters.' },
    { id: 'sequenceCutscene', label: 'Sequence / Cutscene Timeline', category: 'other', description: 'Timeline driving multiple Actors/camera/UI together.' }
];

// Component type ids (see ComponentTypes.js) auto-attached when a placeholder of this asset
// type is created — so e.g. a placed "Player Start" already carries its behavior stub instead
// of requiring the user to remember to add the matching component manually.
export const DEFAULT_ASSET_COMPONENTS = {
    player_start: ['playerStart'],
    // Visual assets get a Sprite component that owns the texture path (not Identity.imgSrc).
    image: ['sprite'],
    imageAtlas: ['sprite'],
    actor: ['sprite'],
    prefab: ['sprite']
};

const ASSET_TYPE_MAP = new Map(ASSET_TYPES.map(t => [t.id, t]));

export function getAssetTypeById(id) {
    return ASSET_TYPE_MAP.get(id) || null;
}

export function getAssetTypesByCategory(categoryId) {
    return ASSET_TYPES.filter(t => t.category === categoryId);
}

/**
 * Group ASSET_TYPES by category for menu construction (nav "Add" menu,
 * Assets-panel "Add" context menu entry — both build a category->types tree).
 * @returns {Array<{categoryId: string, category: Object, types: Array}>}
 */
export function getAssetCategoriesWithTypes() {
    const categoryIds = [...new Set(ASSET_TYPES.map(t => t.category))];
    return categoryIds.map(categoryId => ({
        categoryId,
        category: ASSET_CATEGORIES[categoryId] || { label: categoryId, color: '#9ca3af' },
        types: getAssetTypesByCategory(categoryId)
    }));
}
