/**
 * Builds content/maps/ledge.json from the same fillR/line geometry as tmp/ledge-v5.html.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const T = 16;
const MAP_W = 186;
const MAP_H = 48;
const E = 0; const ROCK = 1; const CRUMB = 2;
const LADW = 3; const LADF = 4; const LADR = 5; const LADL = 6;
const HTOP = 7; const BAR = 8;

const base = new Uint8Array(MAP_W * MAP_H);
function fillR(c, r, w, h, v) {
    v = v === undefined ? ROCK : v;
    for (let y = r; y < r + h; y++) {
        for (let x = c; x < c + w; x++) {
            if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) base[y * MAP_W + x] = v;
        }
    }
}
function line(c, r, n, dc, dr, v) {
    for (let i = 0; i < n; i++) fillR(c + dc * i, r + dr * i, 1, 1, v);
}

fillR(0, 0, 2, MAP_H); fillR(MAP_W - 2, 0, 2, MAP_H);
fillR(0, 27, MAP_W, 5);
fillR(0, 46, MAP_W, 2);
fillR(2, 22, 15, 5);
fillR(8, 18, 3, 1);
fillR(17, 19, 6, 8);
fillR(23, 10, 9, 8);
fillR(23, 19, 9, 8);
fillR(32, 19, 4, 8);
fillR(34, 12, 2, 5);
fillR(39, 12, 2, 7);
fillR(36, 19, 3, 8);
fillR(41, 12, 7, 3);
fillR(36, 9, 3, 1, CRUMB);
line(49, 6, 4, 0, 1, LADW);
fillR(50, 6, 7, 3);
fillR(48, 12, 2, 3);
line(57, 6, 16, 0, 1, LADF);
fillR(50, 22, 23, 5);
line(60, 21, 7, 1, -1, LADR);
fillR(67, 15, 5, 2);
fillR(72, 8, 1, 12);
fillR(76, 10, 1, 2);
fillR(76, 12, 1, 2);
fillR(76, 16, 1, 2);
fillR(76, 18, 1, 2);
fillR(76, 22, 1, 5);
fillR(73, 23, 3, 4);
fillR(77, 22, 10, 5);
fillR(77, 16, 8, 2);
fillR(77, 10, 6, 2);
fillR(83, 12, 1, 4);
fillR(87, 22, 4, 5);
fillR(95, 22, 9, 5);
line(88, 18, 7, 1, 0, BAR);
fillR(118, 18, 4, 1, HTOP);
fillR(122, 15, 1, 1, ROCK);
fillR(96, 17, 8, 2);
line(104, 17, 5, 0, 1, LADW);
fillR(104, 22, 12, 5);
fillR(116, 19, 6, 8);
fillR(122, 16, 6, 11);
fillR(128, 22, 10, 5);
fillR(133, 16, 4, 1, CRUMB);
fillR(138, 12, 1, 8);
fillR(142, 13, 1, 2);
fillR(142, 15, 1, 5);
fillR(142, 22, 1, 5);
fillR(139, 23, 3, 4);
fillR(143, 22, 12, 5);
fillR(143, 13, 7, 2);
fillR(150, 13, 4, 2);
fillR(156, 16, 5, 2);
fillR(155, 22, 12, 5);
fillR(167, 22, 17, 5);
fillR(10, 40, 22, 6);
fillR(14, 36, 4, 1);
line(20, 36, 4, 0, 1, LADW);
fillR(21, 36, 6, 2);
fillR(27, 33, 4, 1);
fillR(32, 42, 6, 4);
fillR(38, 40, 20, 6);
fillR(42, 35, 5, 2);
fillR(50, 37, 4, 1);
fillR(54, 33, 5, 2);
fillR(58, 31, 8, 8);
fillR(58, 40, 8, 6);
fillR(66, 40, 20, 6);
line(68, 36, 9, 1, 0, BAR);
fillR(70, 35, 5, 2);
fillR(78, 33, 5, 2);
line(84, 35, 5, 0, 1, LADW);
fillR(85, 35, 6, 2);
fillR(86, 40, 14, 6);
fillR(104, 40, 20, 6);
fillR(108, 35, 5, 2);
fillR(115, 33, 5, 2);
fillR(120, 37, 3, 1, CRUMB);

const tiles = Array.from(base, (v) => (v === 0 ? -1 : v));

const LEDGE = 'content/assets/ledge';
let seq = 1;
function comp(type, properties = {}) {
    return {
        id: `comp_ledge_${seq++}`,
        type,
        enabled: true,
        properties
    };
}
function obj(partial) {
    return {
        id: partial.id,
        name: partial.name || partial.id,
        type: partial.type || 'object',
        x: partial.x,
        y: partial.y,
        width: partial.width ?? 16,
        height: partial.height ?? 16,
        color: partial.color || '#cccccc',
        rotation: 0,
        imgSrc: partial.imgSrc || null,
        visible: true,
        locked: false,
        layerId: partial.layerId,
        properties: partial.properties || {},
        components: partial.components || []
    };
}

const L_TERRAIN = 'layer_ledge_terrain';
const L_ACTORS = 'layer_ledge_actors';
const L_ITEMS = 'layer_ledge_items';

const objects = [];

objects.push(obj({
    id: 'tilemap_ledge',
    name: 'LEDGE Terrain',
    type: 'tilemap',
    x: 0, y: 0, width: MAP_W * T, height: MAP_H * T,
    color: '#635c8c',
    layerId: L_TERRAIN,
    imgSrc: `${LEDGE}/tileset.png`,
    components: [comp('tilemap', {
        src: `${LEDGE}/tileset.png`,
        tileWidth: 16, tileHeight: 16, columns: 9,
        mapWidth: MAP_W, mapHeight: MAP_H,
        tiles,
        tileKinds: {
            1: 'solid', 2: 'crumb', 3: 'ladderWall', 4: 'ladderFront',
            5: 'ladderDiagR', 6: 'ladderDiagL', 7: 'halfTop', 8: 'bar'
        },
        solidIndices: [1, 2, 7],
        crumbTime: 1.05, crumbBack: 3.4
    })]
}));

objects.push(obj({
    id: 'player_start_ledge',
    name: 'Player Start',
    type: 'player_start',
    x: 60, y: 22 * T - 22, width: 10, height: 22,
    color: 'lightblue',
    layerId: L_ACTORS,
    imgSrc: `${LEDGE}/player.png`,
    properties: { movementMode: 'platformer', bodyWidth: 10, bodyHeight: 22 },
    components: [
        comp('playerStart', { movementMode: 'platformer', bodyWidth: 10, bodyHeight: 22 }),
        comp('damageHealth', { maxHealth: 3, currentHealth: 3, contactDamage: 0, invulnerabilityDuration: 1, destroyOnDeath: true }),
        comp('spriteUiAnimation', {
            frames: [{ x: 0, y: 0, w: 16, h: 28, duration: 200 }],
            loop: true
        })
    ]
}));

objects.push(obj({
    id: 'camera_ledge',
    name: 'Camera',
    type: 'camera',
    x: 60, y: 300, width: 32, height: 32,
    color: '#38bdf8',
    layerId: L_ACTORS,
    components: [comp('camera', {
        viewHeight: 180,
        deadzoneWidth: 40,
        deadzoneHeight: 20,
        bounds: { x: 0, y: 0, width: MAP_W * T, height: MAP_H * T },
        canvasIds: ['hud_ledge']
    })]
}));

const ITEMS = [
    [5, 21, 'coin'], [9, 17, 'coin'], [13, 21, 'coin'], [15, 21, 'gem'],
    [19, 18, 'coin'], [26, 18, 'shroom'], [29, 18, 'coin'],
    [37, 18, 'coin'], [37, 15, 'coin'], [37, 8, 'gem'], [44, 11, 'coin'],
    [49, 5, 'gem'], [52, 5, 'coin'], [55, 5, 'shroom'],
    [57, 9, 'coin'], [57, 13, 'coin'], [57, 17, 'coin'],
    [53, 21, 'coin'], [63, 21, 'shroom'], [62, 19, 'coin'], [65, 16, 'coin'], [70, 14, 'gem'],
    [79, 15, 'gem'], [80, 9, 'gem'], [85, 21, 'coin'], [92, 19, 'coin'],
    [98, 16, 'coin'], [106, 21, 'shroom'], [113, 21, 'coin'],
    [117, 18, 'coin'], [124, 15, 'gem'], [134, 15, 'gem'], [131, 21, 'coin'],
    [146, 12, 'gem'], [152, 12, 'coin'], [158, 15, 'coin'], [164, 21, 'coin'],
    [12, 39, 'coin'], [15, 35, 'coin'], [23, 35, 'gem'], [28, 32, 'gem'], [30, 39, 'coin'],
    [40, 39, 'coin'], [44, 34, 'gem'], [51, 36, 'coin'], [55, 32, 'gem'], [61, 39, 'shroom'],
    [68, 39, 'coin'], [72, 34, 'gem'], [80, 32, 'coin'], [87, 34, 'coin'], [92, 39, 'shroom'],
    [106, 39, 'coin'], [110, 34, 'gem'], [117, 32, 'gem'], [122, 39, 'coin'],
    [172, 21, 'gem'], [178, 21, 'relic']
];
const ITEM_FRAME = { coin: 0, gem: 1, shroom: 2, relic: 3, key: 4, stick: 5 };
for (let i = 0; i < ITEMS.length; i++) {
    const [c, r, kind] = ITEMS[i];
    objects.push(obj({
        id: `item_${kind}_${i}`,
        name: kind,
        x: c * T + 4, y: r * T + 4, width: 8, height: 8,
        layerId: L_ITEMS,
        imgSrc: `${LEDGE}/items.png`,
        components: [
            comp('spriteUiAnimation', { frames: [{ x: ITEM_FRAME[kind] * 16, y: 0, w: 16, h: 16, duration: 1000 }], loop: false }),
            comp('pickup', {
                itemId: kind, count: 1, destroyOnPickup: true,
                healAmount: kind === 'shroom' ? 1 : 0,
                onPickupEvent: kind === 'relic' ? 'win' : ''
            })
        ]
    }));
}

objects.push(obj({
    id: 'item_key',
    name: 'key',
    x: 69 * T + 4, y: 15 * T - 10, width: 8, height: 8,
    layerId: L_ITEMS,
    imgSrc: `${LEDGE}/items.png`,
    components: [
        comp('spriteUiAnimation', { frames: [{ x: 64, y: 0, w: 16, h: 16, duration: 1000 }], loop: false }),
        comp('pickup', { itemId: 'key', count: 1, destroyOnPickup: true })
    ]
}));
objects.push(obj({
    id: 'item_stick',
    name: 'stick',
    x: 117 * T, y: 40 * T - 12, width: 8, height: 12,
    layerId: L_ITEMS,
    imgSrc: `${LEDGE}/items.png`,
    components: [
        comp('spriteUiAnimation', { frames: [{ x: 80, y: 0, w: 16, h: 16, duration: 1000 }], loop: false }),
        comp('pickup', { itemId: 'stick', count: 1, destroyOnPickup: true })
    ]
}));

const DOORS = [
    { id: 'door_0', x: 44 * T, y: 12 * T, pair: 'door_1', locked: false },
    { id: 'door_1', x: 11 * T, y: 40 * T, pair: 'door_0', locked: false },
    { id: 'door_2', x: 97 * T, y: 40 * T, pair: 'door_3', locked: false },
    { id: 'door_3', x: 157 * T, y: 22 * T, pair: 'door_2', locked: false },
    { id: 'door_4', x: 101 * T, y: 17 * T, pair: 'door_5', locked: true },
    { id: 'door_5', x: 121 * T, y: 40 * T, pair: 'door_4', locked: false }
];
for (const d of DOORS) {
    objects.push(obj({
        id: d.id,
        name: d.id,
        x: d.x, y: d.y - 24, width: 16, height: 24,
        layerId: L_ACTORS,
        imgSrc: `${LEDGE}/door.png`,
        components: [
            comp('interactable', { radius: 26, hint: d.locked ? 'Locked' : 'Enter' }),
            comp('conveyorZiplineJumpPadPortal', {
                kind: 'portal',
                targetId: d.pair,
                requireInteract: true,
                requireItem: d.locked ? 'key' : '',
                consumeItem: !!d.locked,
                fadeSeconds: 0.62,
                width: 16, height: 24
            })
        ]
    }));
}

const ENEMIES = [
    [60 * T, 22 * T, 53 * T, 70 * T, 26],
    [148 * T, 22 * T, 144 * T, 154 * T, 24],
    [108 * T, 22 * T, 105 * T, 115 * T, 28],
    [160 * T, 22 * T, 156 * T, 166 * T, 26],
    [16 * T, 40 * T, 11 * T, 31 * T, 24],
    [44 * T, 40 * T, 39 * T, 57 * T, 28],
    [74 * T, 40 * T, 67 * T, 85 * T, 26],
    [110 * T, 40 * T, 105 * T, 123 * T, 22]
];
for (let i = 0; i < ENEMIES.length; i++) {
    const [x, y, x0, x1, v] = ENEMIES[i];
    objects.push(obj({
        id: `enemy_${i}`,
        name: `enemy_${i}`,
        x, y: y - 14, width: 11, height: 14,
        layerId: L_ACTORS,
        imgSrc: `${LEDGE}/enemy.png`,
        components: [
            comp('damageHealth', { maxHealth: 1, contactDamage: 1, invulnerabilityDuration: 0, layer: 'hazard', destroyOnDeath: true }),
            comp('pathFollower', {
                waypoints: [{ x: 0, y: 0 }, { x: x1 - x, y: 0 }, { x: x0 - x, y: 0 }],
                speed: v, mode: 'pingpong', turnAtLedge: true
            })
        ]
    }));
}

const FLIERS = [
    [6 * T, 16 * T, 3 * T, 7 * T, 26],
    [52 * T, 17 * T, 50 * T, 56 * T, 26],
    [99 * T, 20 * T, 96 * T, 102 * T, 28],
    [131 * T, 18 * T, 128 * T, 136 * T, 32],
    [163 * T, 18 * T, 161 * T, 172 * T, 28],
    [25 * T, 39 * T, 21 * T, 30 * T, 28],
    [80 * T, 38 * T, 77 * T, 84 * T, 24]
];
for (let i = 0; i < FLIERS.length; i++) {
    const [x, y, x0, x1, v] = FLIERS[i];
    objects.push(obj({
        id: `flier_${i}`,
        name: `flier_${i}`,
        x, y, width: 13, height: 9,
        layerId: L_ACTORS,
        imgSrc: `${LEDGE}/flier.png`,
        components: [
            comp('damageHealth', { maxHealth: 1, contactDamage: 1, layer: 'hazard', destroyOnDeath: true }),
            comp('pathFollower', {
                waypoints: [{ x: 0, y: 0 }, { x: x1 - x, y: 0 }, { x: x0 - x, y: 0 }],
                speed: v, mode: 'pingpong'
            }),
            comp('spawner', {
                interval: 1.8, maxAlive: 1, spawnOffsetX: 4, spawnOffsetY: 8,
                spawnWhen: 'playerBelow', playerBelowX: 26,
                template: {
                    type: 'object', width: 6, height: 6, imgSrc: `${LEDGE}/bomb.png`,
                    components: [
                        { type: 'damageHealth', enabled: true, properties: { maxHealth: 1, contactDamage: 1, layer: 'hazard', destroyOnDeath: true } },
                        { type: 'pathFollower', enabled: true, properties: { gravity: 520, waypoints: [] } }
                    ]
                }
            })
        ]
    }));
}

const PLATS = [
    { id: 'plat_0', x: 91 * T, y: 20 * T, x0: 90 * T + 8, x1: 94 * T, v: 30 },
    { id: 'plat_1', x: 46 * T, y: 37 * T, x0: 46 * T, x1: 50 * T, v: 26 },
    { id: 'plat_2', x: 100 * T, y: 36 * T, x0: 99 * T, x1: 103 * T, v: 24 }
];
for (const q of PLATS) {
    objects.push(obj({
        id: q.id, name: q.id,
        x: q.x, y: q.y, width: 38, height: 8,
        layerId: L_ACTORS,
        imgSrc: `${LEDGE}/platform.png`,
        components: [
            comp('collider', { oneWay: 'up', width: 38, height: 8 }),
            comp('pathFollower', {
                waypoints: [{ x: 0, y: 0 }, { x: q.x1 - q.x, y: 0 }, { x: q.x0 - q.x, y: 0 }],
                speed: q.v, mode: 'pingpong', oneWayTop: true
            })
        ]
    }));
}

objects.push(obj({
    id: 'lift_0', name: 'lift_0',
    x: 73 * T, y: 22 * T, width: 48, height: 8,
    layerId: L_ACTORS, imgSrc: `${LEDGE}/lift.png`,
    components: [
        comp('collider', { oneWay: 'up', width: 48, height: 8 }),
        comp('pathFollower', {
            mode: 'elevator', elevator: true, speed: 42, waitAtWaypoint: 1.6,
            waypoints: [{ x: 0, y: 0 }, { x: 0, y: -6 * T }, { x: 0, y: -12 * T }]
        })
    ]
}));
objects.push(obj({
    id: 'lift_1', name: 'lift_1',
    x: 139 * T, y: 22 * T, width: 48, height: 8,
    layerId: L_ACTORS, imgSrc: `${LEDGE}/lift.png`,
    components: [
        comp('collider', { oneWay: 'up', width: 48, height: 8 }),
        comp('pathFollower', {
            mode: 'elevator', elevator: true, speed: 42, waitAtWaypoint: 1.6,
            waypoints: [{ x: 0, y: 0 }, { x: 0, y: -9 * T }]
        })
    ]
}));

const TORCHES = [
    [6, 21], [20, 18], [37, 18], [54, 21], [66, 21], [86, 21], [113, 21], [131, 21], [164, 21],
    [14, 39], [30, 39], [46, 39], [70, 39], [92, 39], [110, 39]
];
for (let i = 0; i < TORCHES.length; i++) {
    const [c, r] = TORCHES[i];
    objects.push(obj({
        id: `torch_${i}`, name: `torch_${i}`,
        x: c * T + 4, y: (r + 1) * T - 16, width: 8, height: 16,
        layerId: L_ITEMS, imgSrc: `${LEDGE}/torch.png`,
        components: [comp('pickup', { itemId: 'torch', mode: 'hold', requireInteract: true, destroyOnPickup: false })]
    }));
}

const graph = {
    formatVersion: 1,
    scope: 'level',
    variables: [
        { name: 'hp', default: 3 },
        { name: 'done', default: false },
        { name: 'speed', default: 0 },
        { name: 'moveState', default: 'normal' }
    ],
    nodes: [
        { id: 'n_start', type: 'OnStart', x: 40, y: 40, params: {} },
        { id: 'n_hp', type: 'SetVariable', x: 240, y: 40, params: { name: 'hp', value: 3 } },
        { id: 'n_win_ev', type: 'OnCustomEvent', x: 40, y: 160, params: { name: 'win' } },
        { id: 'n_win_set', type: 'SetVariable', x: 240, y: 160, params: { name: 'done', value: true } }
    ],
    edges: [
        { id: 'e1', from: 'n_start', to: 'n_hp' },
        { id: 'e2', from: 'n_win_ev', to: 'n_win_set' }
    ]
};

const level = {
    meta: {
        name: 'LEDGE',
        version: '1.0.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        author: 'ledge-port',
        description: 'LEDGE prototype rebuilt as tilemap + components + Event Graph'
    },
    settings: {
        gridSize: 16,
        snapToGrid: true,
        showGrid: true,
        backgroundColor: '#07060f',
        parallaxHorizontal: 1,
        parallaxVertical: 1
    },
    camera: { x: 0, y: 200, zoom: 3 },
    eventGraph: graph,
    dialogues: [],
    items: [
        { id: 'coin', displayName: 'Coin' },
        { id: 'gem', displayName: 'Gem' },
        { id: 'shroom', displayName: 'Shroom' },
        { id: 'relic', displayName: 'Relic' },
        { id: 'key', displayName: 'Key' },
        { id: 'stick', displayName: 'Stick' },
        { id: 'torch', displayName: 'Torch' }
    ],
    canvases: [{
        id: 'hud_ledge',
        name: 'LEDGE HUD',
        widgets: [
            { id: 'w_hp', type: 'text', anchor: 'topLeft', offsetX: 8, offsetY: 6, text: 'HP', binding: { source: 'variable', name: 'hp' } },
            { id: 'w_coin', type: 'text', anchor: 'topLeft', offsetX: 48, offsetY: 6, text: '0', binding: { source: 'inventoryCount', itemId: 'coin' } },
            { id: 'w_gem', type: 'text', anchor: 'topLeft', offsetX: 80, offsetY: 6, text: '0', binding: { source: 'inventoryCount', itemId: 'gem' } },
            { id: 'w_key', type: 'text', anchor: 'topLeft', offsetX: 112, offsetY: 6, text: '', binding: { source: 'inventoryCount', itemId: 'key' } },
            { id: 'w_done', type: 'text', anchor: 'topCenter', offsetX: 0, offsetY: 8, text: '', binding: { source: 'variable', name: 'done' } }
        ]
    }],
    inputMap: {
        actions: {
            moveLeft: ['arrowleft', 'a'],
            moveRight: ['arrowright', 'd'],
            moveUp: ['arrowup', 'w'],
            moveDown: ['arrowdown', 's'],
            jump: [' ', 'z', 'x'],
            interact: ['e', 'f', 'c']
        }
    },
    inventory: [],
    npcInventories: {},
    objects,
    layers: [
        { id: L_TERRAIN, name: 'Terrain', visible: true, locked: false, order: 0, color: '#635c8c', parallaxOffset: 0, index: 2 },
        { id: L_ACTORS, name: 'Actors', visible: true, locked: false, order: 1, color: '#f87171', parallaxOffset: 0, index: 1 },
        { id: L_ITEMS, name: 'Items', visible: true, locked: false, order: 2, color: '#fbbf24', parallaxOffset: 0, index: 0 }
    ],
    nextObjectId: objects.length + 1,
    mainLayerId: L_ACTORS
};

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'maps');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, 'ledge.json');
writeFileSync(out, JSON.stringify(level));
console.log(`wrote ${out} objects=${objects.length} tiles=${tiles.filter((t) => t > 0).length}`);
