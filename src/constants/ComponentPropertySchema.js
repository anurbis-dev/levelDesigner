/**
 * Editor field schemas for component.properties — mirrors docs/RUNTIME_SCHEMA.md
 * for implemented types; unknown types get a generic JSON bag of existing keys.
 */

/**
 * @typedef {{ key: string, label: string,
 *   kind: 'number'|'text'|'bool'|'stringList'|'json'|'select'|'color'|'assetRef'|'idMultiSelect',
 *   default?: *, options?: { value: string, label: string }[], assetTypes?: string[],
 *   source?: 'canvases' }} CompField
 */

const PATH_FOLLOWER_MODE_OPTIONS = [
    { value: 'loop', label: 'Loop (wraps to first waypoint)' },
    { value: 'pingpong', label: 'Ping-pong (reverses at ends)' },
    { value: 'once', label: 'Once (stops at last waypoint)' }
];

const PATH_FOLLOWER_INTERPOLATION_OPTIONS = [
    { value: 'linear', label: 'Linear (straight segments)' },
    { value: 'smooth', label: 'Smooth (Catmull-Rom curve)' }
];

const CONVEYOR_ZIPLINE_JUMPPAD_PORTAL_KIND_OPTIONS = [
    { value: 'conveyor', label: 'Conveyor (continuous push while overlapping)' },
    { value: 'zipline', label: 'Zipline (rides player to a target point)' },
    { value: 'jumpPad', label: 'Jump Pad (instant offset on entry)' },
    { value: 'portal', label: 'Portal (teleport to target object)' }
];

const VARIABLE_MODIFIER_OP_OPTIONS = [
    { value: 'set', label: 'Set (write value directly)' },
    { value: 'add', label: 'Add (value += amount)' },
    { value: 'subtract', label: 'Subtract (value -= amount)' },
    { value: 'toggle', label: 'Toggle (flip boolean, value ignored)' }
];

const VARIABLE_MODIFIER_MODE_OPTIONS = [
    { value: 'once', label: 'Once (edge-detected on entry, repeatable on re-entry)' },
    { value: 'continuous', label: 'Continuous (re-applies every tick while overlapping)' }
];

const AUDIO_ZONE_CHANNEL_OPTIONS = [
    { value: 'ambient', label: 'Ambient (zone channel, stops on exit)' },
    { value: 'music', label: 'Music (global channel, optional crossfade)' }
];

const LIGHT_TYPE_OPTIONS = [
    { value: 'point', label: 'Point (radial)' },
    { value: 'directional', label: 'Directional (cone)' },
    { value: 'area', label: 'Area (entity bounds + soft pad)' }
];

const COLLIDER_SHAPE_OPTIONS = [
    { value: 'box', label: 'Box (square / rect)' },
    { value: 'circle', label: 'Circle' },
    { value: 'freeform', label: 'Freeform (polygon)' }
];

/** Shared shape fields for collider + trigger. */
const COLLIDER_SHAPE_FIELDS = [
    { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
    { key: 'color', label: 'Frame Color', kind: 'color', default: '' },
    { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
    { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
    { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
    { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
    { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
    { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
    { key: 'layer', label: 'Layer', kind: 'text', default: '' },
    { key: 'collidesWith', label: 'Collides With (comma list)', kind: 'stringList', default: [] }
];

/** @type {Record<string, CompField[]>} */
const SCHEMAS = {
    sprite: [
        // References a catalog Image asset (disk path lives only on that Image)
        { key: 'imageAssetId', label: 'Image Asset', kind: 'assetRef', assetTypes: ['image'], default: '' }
    ],
    collider: COLLIDER_SHAPE_FIELDS,
    trigger: COLLIDER_SHAPE_FIELDS,
    interactable: [
        { key: 'radius', label: 'Radius', kind: 'number', default: 32 },
        { key: 'hint', label: 'Hint', kind: 'text', default: 'Interact' }
    ],
    pickup: [
        { key: 'itemId', label: 'Item Id (level.items[].id)', kind: 'text', default: '' },
        { key: 'count', label: 'Count', kind: 'number', default: 1 },
        { key: 'destroyOnPickup', label: 'Destroy On Pickup', kind: 'bool', default: true }
    ],
    damageHealth: [
        { key: 'maxHealth', label: 'Max Health', kind: 'number', default: 100 },
        { key: 'currentHealth', label: 'Current Health (empty = max)', kind: 'number', default: null },
        { key: 'contactDamage', label: 'Contact Damage (dealt to others on touch)', kind: 'number', default: 0 },
        { key: 'invulnerabilityDuration', label: 'Invulnerability After Hit (sec)', kind: 'number', default: 0.5 },
        { key: 'destroyOnDeath', label: 'Destroy On Death', kind: 'bool', default: true },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Takes Damage From (comma list)', kind: 'stringList', default: [] }
    ],
    movablePushable: [
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Blocked By (comma list; empty = all)', kind: 'stringList', default: [] }
    ],
    mountableVehicleSeat: [
        { key: 'mountRadius', label: 'Mount Radius', kind: 'number', default: 32 },
        { key: 'speed', label: 'Vehicle Speed (px/sec)', kind: 'number', default: 150 },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Blocked By (comma list; empty = all)', kind: 'stringList', default: [] }
    ],
    pathFollower: [
        { key: 'waypoints', label: 'Waypoints (JSON [{x,y}], offsets from spawn)', kind: 'json', default: [] },
        { key: 'speed', label: 'Speed (px/sec)', kind: 'number', default: 100 },
        { key: 'mode', label: 'Mode', kind: 'select', default: 'loop', options: PATH_FOLLOWER_MODE_OPTIONS },
        { key: 'waitAtWaypoint', label: 'Wait At Waypoint (sec)', kind: 'number', default: 0 },
        { key: 'interpolation', label: 'Interpolation', kind: 'select', default: 'linear', options: PATH_FOLLOWER_INTERPOLATION_OPTIONS }
    ],
    spawner: [
        { key: 'template', label: 'Template (JSON GameObject data, id/x/y ignored)', kind: 'json', default: {} },
        { key: 'interval', label: 'Interval (sec, <=0 = disabled)', kind: 'number', default: 3 },
        { key: 'maxAlive', label: 'Max Alive (0 = unlimited)', kind: 'number', default: 0 },
        { key: 'maxSpawns', label: 'Max Total Spawns (0 = unlimited)', kind: 'number', default: 0 },
        { key: 'spawnOffsetX', label: 'Spawn Offset X', kind: 'number', default: 0 },
        { key: 'spawnOffsetY', label: 'Spawn Offset Y', kind: 'number', default: 0 }
    ],
    checkpointSavePoint: [],
    climbableLadder: [
        { key: 'climbSpeed', label: 'Climb Speed (px/sec)', kind: 'number', default: 100 },
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] }
    ],
    conveyorZiplineJumpPadPortal: [
        { key: 'kind', label: 'Kind', kind: 'select', default: 'conveyor', options: CONVEYOR_ZIPLINE_JUMPPAD_PORTAL_KIND_OPTIONS },
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        { key: 'speed', label: 'Speed (px/sec) — conveyor push / zipline ride', kind: 'number', default: 100 },
        { key: 'directionX', label: 'Conveyor Direction X', kind: 'number', default: 1 },
        { key: 'directionY', label: 'Conveyor Direction Y', kind: 'number', default: 0 },
        { key: 'targetOffsetX', label: 'Zipline Target Offset X (from spawn)', kind: 'number', default: 0 },
        { key: 'targetOffsetY', label: 'Zipline Target Offset Y (from spawn)', kind: 'number', default: -200 },
        { key: 'launchOffsetX', label: 'Jump Pad Launch Offset X', kind: 'number', default: 0 },
        { key: 'launchOffsetY', label: 'Jump Pad Launch Offset Y', kind: 'number', default: -96 },
        { key: 'targetId', label: 'Portal Target Object Id', kind: 'text', default: '' }
    ],
    variableModifier: [
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        { key: 'varName', label: 'Variable Name', kind: 'text', default: '' },
        { key: 'op', label: 'Op', kind: 'select', default: 'set', options: VARIABLE_MODIFIER_OP_OPTIONS },
        { key: 'value', label: 'Value (JSON; ignored for toggle)', kind: 'json', default: true },
        { key: 'mode', label: 'Mode', kind: 'select', default: 'once', options: VARIABLE_MODIFIER_MODE_OPTIONS }
    ],
    destructibleContainer: [
        { key: 'maxHealth', label: 'Max Health', kind: 'number', default: 20 },
        { key: 'currentHealth', label: 'Current Health (empty = max)', kind: 'number', default: null },
        { key: 'invulnerabilityDuration', label: 'Invulnerability After Hit (sec)', kind: 'number', default: 0 },
        { key: 'destroyOnDeath', label: 'Destroy On Death', kind: 'bool', default: true },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' },
        { key: 'collidesWith', label: 'Takes Damage From (comma list)', kind: 'stringList', default: [] },
        { key: 'itemId', label: 'Item Id (level.items[].id) — dropped on destroy', kind: 'text', default: '' },
        { key: 'count', label: 'Drop Count', kind: 'number', default: 1 }
    ],
    audioZone: [
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        { key: 'src', label: 'Audio Src (URL / path)', kind: 'text', default: '' },
        { key: 'volume', label: 'Volume (0–1)', kind: 'number', default: 1 },
        { key: 'loop', label: 'Loop', kind: 'bool', default: true },
        { key: 'channel', label: 'Channel', kind: 'select', default: 'ambient', options: AUDIO_ZONE_CHANNEL_OPTIONS },
        { key: 'stopOnExit', label: 'Stop On Exit', kind: 'bool', default: true },
        { key: 'crossfade', label: 'Crossfade (sec, music channel)', kind: 'number', default: 0 }
    ],
    tilemap: [
        { key: 'tilesetAssetId', label: 'Tileset Asset Id', kind: 'assetRef', assetTypes: ['tileset'], default: '' },
        { key: 'imageAssetId', label: 'Atlas Image Asset', kind: 'assetRef', assetTypes: ['image'], default: '' },
        { key: 'src', label: 'Atlas Src (URL fallback)', kind: 'text', default: '' },
        { key: 'tileWidth', label: 'Tile Width (px)', kind: 'number', default: 16 },
        { key: 'tileHeight', label: 'Tile Height (px)', kind: 'number', default: 16 },
        { key: 'columns', label: 'Atlas Columns', kind: 'number', default: 1 },
        { key: 'mapWidth', label: 'Map Width (tiles)', kind: 'number', default: 1 },
        { key: 'mapHeight', label: 'Map Height (tiles)', kind: 'number', default: 1 },
        { key: 'tiles', label: 'Tiles (JSON row-major indices; -1 empty)', kind: 'json', default: [] },
        { key: 'solidIndices', label: 'Solid Tile Indices (JSON null=all non-empty, []=none)', kind: 'json', default: null },
        { key: 'layer', label: 'Layer', kind: 'text', default: '' }
    ],
    particleEffect: [
        { key: 'imageAssetId', label: 'Particle Image Asset', kind: 'assetRef', assetTypes: ['image'], default: '' },
        { key: 'src', label: 'Particle Src (URL fallback)', kind: 'text', default: '' },
        { key: 'maxParticles', label: 'Max Particles', kind: 'number', default: 32 },
        { key: 'emitRate', label: 'Emit Rate (per sec)', kind: 'number', default: 12 },
        { key: 'lifetime', label: 'Lifetime (sec)', kind: 'number', default: 1 },
        { key: 'speed', label: 'Speed (px/s)', kind: 'number', default: 50 },
        { key: 'speedVariance', label: 'Speed Variance', kind: 'number', default: 20 },
        { key: 'angle', label: 'Angle (deg, 0=+X, -90=up)', kind: 'number', default: -90 },
        { key: 'spread', label: 'Spread (deg full cone)', kind: 'number', default: 360 },
        { key: 'gravityX', label: 'Gravity X (px/s²)', kind: 'number', default: 0 },
        { key: 'gravityY', label: 'Gravity Y (px/s²)', kind: 'number', default: 80 },
        { key: 'startSize', label: 'Start Size (px)', kind: 'number', default: 6 },
        { key: 'endSize', label: 'End Size (px)', kind: 'number', default: 0 },
        { key: 'startColor', label: 'Start Color', kind: 'color', default: '#ffffff' },
        { key: 'endColor', label: 'End Color', kind: 'color', default: '#ffffff' },
        { key: 'startAlpha', label: 'Start Alpha (0–1)', kind: 'number', default: 1 },
        { key: 'endAlpha', label: 'End Alpha (0–1)', kind: 'number', default: 0 },
        { key: 'emitting', label: 'Emitting', kind: 'bool', default: true },
        { key: 'burst', label: 'Burst On Start', kind: 'number', default: 0 },
        { key: 'seed', label: 'RNG Seed (empty = random)', kind: 'number', default: null }
    ],
    light: [
        { key: 'lightType', label: 'Light Type', kind: 'select', default: 'point', options: LIGHT_TYPE_OPTIONS },
        { key: 'color', label: 'Color', kind: 'color', default: '#ffffff' },
        { key: 'intensity', label: 'Intensity (0+)', kind: 'number', default: 1 },
        { key: 'radius', label: 'Radius (px)', kind: 'number', default: 128 },
        { key: 'angle', label: 'Angle (deg, directional; 0=+X, -90=up)', kind: 'number', default: -90 },
        { key: 'spread', label: 'Spread (deg full cone, directional)', kind: 'number', default: 60 },
        { key: 'soft', label: 'Soft Edge (0–1)', kind: 'number', default: 0.5 },
        { key: 'ambient', label: 'Ambient Darkness (0–1, max of enabled lights)', kind: 'number', default: 0.45 },
        { key: 'enabled', label: 'Enabled', kind: 'bool', default: true }
    ],
    nineSliceSprite: [
        { key: 'imageAssetId', label: 'Image Asset', kind: 'assetRef', assetTypes: ['image'], default: '' },
        { key: 'src', label: 'Src (URL fallback)', kind: 'text', default: '' },
        { key: 'borderLeft', label: 'Border Left (src px)', kind: 'number', default: 8 },
        { key: 'borderRight', label: 'Border Right (src px)', kind: 'number', default: 8 },
        { key: 'borderTop', label: 'Border Top (src px)', kind: 'number', default: 8 },
        { key: 'borderBottom', label: 'Border Bottom (src px)', kind: 'number', default: 8 },
        { key: 'fillCenter', label: 'Fill Center', kind: 'bool', default: true }
    ],
    fontTextStyle: [
        { key: 'text', label: 'Text', kind: 'text', default: 'Text' },
        { key: 'styleAssetId', label: 'Style Asset (fontTextStyle)', kind: 'assetRef', assetTypes: ['fontTextStyle'], default: '' },
        { key: 'fontFamily', label: 'Font Family', kind: 'text', default: 'sans-serif' },
        { key: 'fontSize', label: 'Font Size (px)', kind: 'number', default: 16 },
        { key: 'fontWeight', label: 'Font Weight', kind: 'text', default: 'normal' },
        { key: 'fontStyle', label: 'Font Style', kind: 'text', default: 'normal' },
        { key: 'color', label: 'Fill Color', kind: 'color', default: '#ffffff' },
        { key: 'align', label: 'Align', kind: 'select', default: 'left', options: [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
        ] },
        { key: 'verticalAlign', label: 'Vertical Align', kind: 'select', default: 'top', options: [
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' }
        ] },
        { key: 'outlineColor', label: 'Outline Color', kind: 'color', default: '' },
        { key: 'outlineWidth', label: 'Outline Width (px)', kind: 'number', default: 0 },
        { key: 'shadowColor', label: 'Shadow Color', kind: 'color', default: '' },
        { key: 'shadowBlur', label: 'Shadow Blur (px)', kind: 'number', default: 0 },
        { key: 'shadowOffsetX', label: 'Shadow Offset X', kind: 'number', default: 0 },
        { key: 'shadowOffsetY', label: 'Shadow Offset Y', kind: 'number', default: 0 },
        { key: 'wrap', label: 'Word Wrap', kind: 'bool', default: true },
        { key: 'lineHeight', label: 'Line Height (× fontSize)', kind: 'number', default: 1.2 }
    ],
    volume: [
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        { key: 'presetAssetId', label: 'Preset Asset (materialShaderPreset)', kind: 'assetRef', assetTypes: ['materialShaderPreset'], default: '' },
        { key: 'blur', label: 'Blur (px)', kind: 'number', default: 0 },
        { key: 'brightness', label: 'Brightness (1 = normal)', kind: 'number', default: null },
        { key: 'saturate', label: 'Saturate (1 = normal)', kind: 'number', default: null },
        { key: 'hueRotate', label: 'Hue Rotate (deg)', kind: 'number', default: 0 },
        { key: 'dropShadow', label: 'Drop Shadow (JSON {x,y,blur,color})', kind: 'json', default: null },
        { key: 'priority', label: 'Priority (higher wins on overlap)', kind: 'number', default: 0 },
        { key: 'enabled', label: 'Enabled', kind: 'bool', default: true }
    ],
    navMesh: [
        { key: 'shape', label: 'Shape', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        { key: 'cellSize', label: 'Cell Size (px)', kind: 'number', default: 16 },
        { key: 'blocked', label: 'Blocked (JSON [{x,y,width,height}] asset-local)', kind: 'json', default: [] },
        { key: 'navMeshAssetId', label: 'NavMesh Asset (shared cellSize/blocked)', kind: 'assetRef', assetTypes: ['navMesh'], default: '' },
        { key: 'enabled', label: 'Enabled', kind: 'bool', default: true }
    ],
    sequenceCutscene: [
        { key: 'shape', label: 'Shape (playOnEnter zone)', kind: 'select', default: 'box', options: COLLIDER_SHAPE_OPTIONS },
        { key: 'offsetX', label: 'Offset X (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'offsetY', label: 'Offset Y (box TL / circle center)', kind: 'number', default: 0 },
        { key: 'width', label: 'Width (box; empty = entity)', kind: 'number', default: null },
        { key: 'height', label: 'Height (box; empty = entity)', kind: 'number', default: null },
        { key: 'radius', label: 'Radius (circle)', kind: 'number', default: null },
        { key: 'points', label: 'Points (freeform JSON [{x,y}])', kind: 'json', default: [] },
        {
            key: 'steps',
            label: 'Steps (JSON [{type, …}] wait|move|teleport|camera|cameraRelease|dialogue|setVariable|playAnimation|playSound|emitEvent)',
            kind: 'json',
            default: []
        },
        { key: 'autoPlay', label: 'Auto Play', kind: 'bool', default: false },
        { key: 'playOnEnter', label: 'Play On Player Enter', kind: 'bool', default: false },
        { key: 'lockPlayer', label: 'Lock Player Movement', kind: 'bool', default: true },
        { key: 'loop', label: 'Loop', kind: 'bool', default: false },
        { key: 'sequenceAssetId', label: 'Sequence Asset (shared steps)', kind: 'assetRef', assetTypes: ['sequenceCutscene'], default: '' },
        { key: 'enabled', label: 'Enabled', kind: 'bool', default: true }
    ],
    stateMachineBehavior: [
        { key: 'defaultState', label: 'Default State', kind: 'text', default: '' },
        { key: 'states', label: 'States (JSON: [{name,movement,speed,waypoints,transitions}]; distance condition: {type:"distance",op,value,fov?} — fov degrees, default 180, 360 = omnidirectional); overrides aiPreset when non-empty', kind: 'json', default: [] },
        { key: 'aiPreset', label: 'AI Preset (JSON {aggroRadius?,leashRadius?,speed?,chaseSpeed?,waypoints?,fov?} — shorthand patrol/guard→chase→leash, ignored if States is set)', kind: 'json', default: null },
        { key: 'facingX', label: 'Initial Facing X', kind: 'number', default: 1 },
        { key: 'facingY', label: 'Initial Facing Y', kind: 'number', default: 0 }
    ],
    spriteUiAnimation: [
        { key: 'frames', label: 'Frames (JSON array)', kind: 'json', default: [] },
        { key: 'loop', label: 'Loop', kind: 'bool', default: true },
        // Фаза F: state machine mode — when 'states' is non-empty, 'clips' (named {clipName:
        // frames[]}) replaces the flat 'frames' array above as the frame-data source.
        { key: 'clips', label: 'Clips (JSON: {name: frames[]})', kind: 'json', default: {} },
        { key: 'defaultState', label: 'Default State', kind: 'text', default: '' },
        { key: 'states', label: 'States (JSON: [{name,clip,transitions}])', kind: 'json', default: [] }
    ],
    playerStart: [],
    camera: [
        { key: 'followTargetId', label: 'Follow Target Id (empty = player)', kind: 'text', default: '' },
        { key: 'deadzoneWidth', label: 'Deadzone Width', kind: 'number', default: 0 },
        { key: 'deadzoneHeight', label: 'Deadzone Height', kind: 'number', default: 0 },
        { key: 'bounds', label: 'Bounds (JSON {x,y,width,height}; empty = unbounded)', kind: 'json', default: null },
        { key: 'renderLayers', label: 'Render Layers (comma list of layer ids; empty = all)', kind: 'stringList', default: [] },
        { key: 'canvasIds', label: 'HUD Canvases (empty = none)', kind: 'idMultiSelect', source: 'canvases', default: [] }
    ]
};

/**
 * @param {string} typeId
 * @returns {CompField[]}
 */
export function getComponentFields(typeId) {
    return SCHEMAS[typeId] || null;
}

/**
 * Default properties for a new stub of this type.
 * @param {string} typeId
 * @returns {object}
 */
export function defaultComponentProperties(typeId) {
    const fields = SCHEMAS[typeId];
    if (!fields) return {};
    const props = {};
    for (const f of fields) {
        if (f.default === undefined) continue;
        // Don't write null optional size — engine uses entity box when omitted
        if (f.default === null) continue;
        if (Array.isArray(f.default)) props[f.key] = [...f.default];
        else if (typeof f.default === 'object') props[f.key] = JSON.parse(JSON.stringify(f.default));
        else props[f.key] = f.default;
    }
    return props;
}

/**
 * Resolve display value for a field from component.properties.
 * @param {CompField} field
 * @param {object} properties
 */
export function readFieldValue(field, properties) {
    const props = properties || {};
    if (!(field.key in props) || props[field.key] === undefined) {
        return field.default;
    }
    return props[field.key];
}

/**
 * Parse UI string/control into property value.
 * @param {CompField} field
 * @param {string|boolean} raw
 * @returns {{ ok: boolean, value?: *, error?: string }}
 */
export function parseFieldInput(field, raw) {
    if (field.kind === 'bool') {
        return { ok: true, value: !!raw };
    }
    if (field.kind === 'number') {
        const s = String(raw ?? '').trim();
        if (s === '') return { ok: true, value: null };
        const n = parseFloat(s);
        if (!Number.isFinite(n)) return { ok: false, error: 'Invalid number' };
        return { ok: true, value: n };
    }
    if (field.kind === 'select') {
        const v = String(raw ?? '').trim();
        const allowed = (field.options || []).map((o) => o.value);
        if (allowed.length && !allowed.includes(v)) {
            return { ok: false, error: 'Invalid option' };
        }
        return { ok: true, value: v || field.default || '' };
    }
    if (field.kind === 'assetRef') {
        return { ok: true, value: String(raw ?? '').trim() };
    }
    if (field.kind === 'color') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: '' };
        if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) {
            return { ok: false, error: 'Use #RGB or #RRGGBB' };
        }
        return { ok: true, value: s };
    }
    if (field.kind === 'stringList') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: [] };
        return {
            ok: true,
            value: s.split(',').map((p) => p.trim()).filter(Boolean)
        };
    }
    if (field.kind === 'json') {
        const s = String(raw ?? '').trim();
        if (!s) return { ok: true, value: field.default ?? null };
        try {
            return { ok: true, value: JSON.parse(s) };
        } catch (e) {
            return { ok: false, error: e.message || 'Invalid JSON' };
        }
    }
    return { ok: true, value: String(raw ?? '') };
}

/**
 * Format property value for an input control.
 * @param {CompField} field
 * @param {*} value
 */
export function formatFieldValue(field, value) {
    if (value === null || value === undefined) return '';
    if (field.kind === 'stringList') {
        return Array.isArray(value) ? value.join(', ') : String(value);
    }
    if (field.kind === 'json') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return String(value);
        }
    }
    if (field.kind === 'bool') return !!value;
    return String(value);
}
