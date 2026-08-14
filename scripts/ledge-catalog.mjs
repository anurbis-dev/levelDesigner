/**
 * LEDGE catalog: image ids, animation clips, prefab writers.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const IMG = {
    player: 'asset_assets_ledge_player',
    items: 'asset_assets_ledge_items',
    enemy: 'asset_assets_ledge_enemy',
    flier: 'asset_assets_ledge_flier',
    door: 'asset_assets_ledge_door',
    lift: 'asset_assets_ledge_lift',
    platform: 'asset_assets_ledge_platform',
    bomb: 'asset_assets_ledge_bomb',
    torch: 'asset_assets_ledge_torch',
    tileset: 'asset_assets_ledge_tileset'
};

export const SRC = {
    player: './content/assets/ledge/player.png',
    items: './content/assets/ledge/items.png',
    enemy: './content/assets/ledge/enemy.png',
    flier: './content/assets/ledge/flier.png',
    door: './content/assets/ledge/door.png',
    lift: './content/assets/ledge/lift.png',
    platform: './content/assets/ledge/platform.png',
    bomb: './content/assets/ledge/bomb.png',
    torch: './content/assets/ledge/torch.png',
    tileset: './content/assets/ledge/tileset.png'
};

export const TILESET_ID = 'asset_assets_ledge_ledge_tileset';
export const GRAPH_ID = 'asset_assets_ledge_graphs_ledge_logic';
export const LEVEL_ASSET_ID = 'asset_assets_ledge_LEDGE';

export const TILE_KINDS = {
    1: 'solid', 2: 'crumb', 3: 'ladderWall', 4: 'ladderFront',
    5: 'ladderDiagR', 6: 'ladderDiagL', 7: 'halfTop', 8: 'bar'
};

const PF = [
    ['idle_a', 'idle_b', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall'],
    ['land', 'slide', 'stun', 'roll', 'crouch', 'crouch_w', 'prone0', 'prone1'],
    ['hang', 'climb0', 'climb1', 'climb2', 'lad0', 'lad1', 'ladf0', 'ladf1'],
    ['bars0', 'bars1', 'atk0', 'atk1', 'atk2']
];

export function playerFrame(name, duration = 120) {
    for (let r = 0; r < PF.length; r++) {
        const c = PF[r].indexOf(name);
        if (c >= 0) return { x: c * 16, y: r * 28, w: 16, h: 28, duration };
    }
    return { x: 0, y: 0, w: 16, h: 28, duration };
}

export function playerClip(names, duration = 120) {
    return names.map((n) => playerFrame(n, duration));
}

function trans(from, list) {
    return list.filter((t) => t.target !== from).map(({ condition, target }) => ({ condition, target }));
}

const STANCE_TRANS = [
    { condition: { var: 'moveState', op: '==', value: 'hang' }, target: 'hang' },
    { condition: { var: 'moveState', op: '==', value: 'climb' }, target: 'climb' },
    { condition: { var: 'moveState', op: '==', value: 'ladder' }, target: 'ladder' },
    { condition: { var: 'moveState', op: '==', value: 'bars' }, target: 'bars' },
    { condition: { var: 'moveState', op: '==', value: 'stun' }, target: 'stun' },
    { condition: { var: 'rolling', op: '==', value: true }, target: 'roll' },
    { condition: { var: 'stance', op: '==', value: 2 }, target: 'prone' },
    { condition: { var: 'stance', op: '==', value: 1 }, target: 'crouch' },
    { condition: { var: 'vy', op: '>', value: 20 }, target: 'fall' },
    { condition: { var: 'onGround', op: '==', value: false }, target: 'jump' },
    { condition: { var: 'speed', op: '>', value: 8 }, target: 'run' },
    { condition: { var: 'onGround', op: '==', value: true }, target: 'idle' }
];

export function playerAnim() {
    const names = ['idle', 'run', 'jump', 'fall', 'crouch', 'prone', 'hang', 'climb', 'ladder', 'bars', 'stun', 'roll'];
    return {
        clips: {
            idle: playerClip(['idle_a', 'idle_b'], 280),
            run: playerClip(['run0', 'run1', 'run2', 'run3'], 90),
            jump: playerClip(['jump'], 1000),
            fall: playerClip(['fall'], 1000),
            crouch: playerClip(['crouch', 'crouch_w'], 160),
            prone: playerClip(['prone0', 'prone1'], 180),
            hang: playerClip(['hang'], 1000),
            climb: playerClip(['climb0', 'climb1', 'climb2'], 140),
            ladder: playerClip(['lad0', 'lad1'], 140),
            bars: playerClip(['bars0', 'bars1'], 140),
            stun: playerClip(['stun'], 1000),
            roll: playerClip(['roll'], 1000)
        },
        defaultState: 'idle',
        states: names.map((name) => ({
            name,
            clip: name,
            transitions: trans(name, STANCE_TRANS)
        })),
        loop: true
    };
}

export function walkAnim(frameW, frameH) {
    return {
        frames: [
            { x: 0, y: 0, w: frameW, h: frameH, duration: 180 },
            { x: frameW, y: 0, w: frameW, h: frameH, duration: 180 }
        ],
        loop: true
    };
}

export const ITEM_FRAME = { coin: 0, gem: 1, shroom: 2, relic: 3, key: 4, stick: 5 };

export function itemAnim(kind) {
    const col = ITEM_FRAME[kind] ?? 0;
    return {
        frames: [{ x: col * 16, y: 0, w: 16, h: 16, duration: 1000 }],
        loop: false
    };
}

let seq = 1;
export function resetCompSeq() { seq = 1; }
export function catalogComp(type, properties = {}) {
    return { id: `comp_ledge_${seq++}`, type, enabled: true, properties };
}

export function spriteComp(imageAssetId) {
    return catalogComp('sprite', { imageAssetId });
}

function actorAsset(name, type, width, height, color, components, extra = {}) {
    return {
        name,
        type,
        category: 'ledge',
        width,
        height,
        color,
        properties: { isTemporary: false, ...(extra.properties || {}) },
        components,
        tags: ['ledge', ...(extra.tags || [])]
    };
}

export function ledgeGraph() {
    return {
        formatVersion: 1,
        scope: 'level',
        variables: [
            { name: 'hp', default: 3 },
            { name: 'done', default: false },
            { name: 'speed', default: 0 },
            { name: 'moveState', default: 'normal' },
            { name: 'stance', default: 0 },
            { name: 'facing', default: 1 },
            { name: 'onGround', default: true },
            { name: 'vy', default: 0 },
            { name: 'rolling', default: false },
            { name: 'sliding', default: false }
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
}

export function writeLedgeCatalog() {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'assets', 'ledge');
    const actors = join(root, 'actors');
    const graphs = join(root, 'graphs');
    mkdirSync(actors, { recursive: true });
    mkdirSync(graphs, { recursive: true });
    resetCompSeq();

    const files = [];
    const write = (rel, data) => {
        const path = join(root, rel);
        writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
        files.push(rel);
    };

    write('ledge_tileset.json', {
        name: 'ledge_tileset_def',
        type: 'tileset',
        category: 'ledge',
        width: 144,
        height: 16,
        color: '#635c8c',
        properties: {
            tileWidth: 16,
            tileHeight: 16,
            columns: 9,
            tileKinds: TILE_KINDS,
            solidIndices: [1, 2, 7],
            crumbTime: 1.05,
            crumbBack: 3.4
        },
        components: [spriteComp(IMG.tileset)],
        tags: ['ledge', 'tileset']
    });

    const anim = playerAnim();
    write('actors/player.json', actorAsset('ledge_player', 'player_start', 10, 22, 'lightblue', [
        spriteComp(IMG.player),
        catalogComp('playerStart', {
            movementMode: 'platformer',
            bodyWidth: 10,
            bodyHeight: 22,
            crouchHeight: 14,
            proneHeight: 7
        }),
        catalogComp('collider', { shape: 'box', width: 10, height: 22 }),
        catalogComp('damageHealth', {
            maxHealth: 3, currentHealth: 3, contactDamage: 0,
            invulnerabilityDuration: 1, destroyOnDeath: true
        }),
        catalogComp('spriteUiAnimation', anim)
    ], { properties: { movementMode: 'platformer', bodyWidth: 10, bodyHeight: 22, crouchHeight: 14, proneHeight: 7 } }));

    write('actors/camera.json', actorAsset('ledge_camera', 'camera', 32, 32, '#38bdf8', [
        catalogComp('camera', {
            viewHeight: 180,
            followLerp: 0.0015,
            lookAhead: 20,
            deadzoneWidth: 0,
            deadzoneHeight: 0,
            bounds: { x: 0, y: 0, width: 2976, height: 768 },
            canvasIds: ['hud_ledge']
        })
    ]));

    write('actors/terrain.json', actorAsset('ledge_terrain', 'tilemap', 2976, 768, '#635c8c', [
        spriteComp(IMG.tileset),
        catalogComp('tilemap', {
            tilesetAssetId: TILESET_ID,
            imageAssetId: IMG.tileset,
            src: SRC.tileset,
            tileWidth: 16, tileHeight: 16, columns: 9,
            mapWidth: 186, mapHeight: 48,
            tiles: [],
            tileKinds: TILE_KINDS,
            solidIndices: [1, 2, 7],
            crumbTime: 1.05, crumbBack: 3.4
        })
    ]));

    const itemKinds = ['coin', 'gem', 'shroom', 'relic', 'key', 'stick'];
    for (const kind of itemKinds) {
        write(`actors/${kind}.json`, actorAsset(`ledge_${kind}`, 'prefab', 8, kind === 'stick' ? 12 : 8, '#ffd75e', [
            spriteComp(IMG.items),
            catalogComp('spriteUiAnimation', itemAnim(kind)),
            catalogComp('pickup', {
                itemId: kind, count: 1, destroyOnPickup: true,
                healAmount: kind === 'shroom' ? 1 : 0,
                onPickupEvent: kind === 'relic' ? 'win' : ''
            })
        ]));
    }

    write('actors/torch.json', actorAsset('ledge_torch', 'prefab', 8, 16, '#ffb060', [
        spriteComp(IMG.torch),
        catalogComp('pickup', { itemId: 'torch', mode: 'hold', requireInteract: true, destroyOnPickup: false })
    ]));

    write('actors/enemy.json', actorAsset('ledge_enemy', 'prefab', 11, 14, '#6d5a8f', [
        spriteComp(IMG.enemy),
        catalogComp('spriteUiAnimation', walkAnim(16, 16)),
        catalogComp('collider', { shape: 'box', width: 11, height: 14 }),
        catalogComp('damageHealth', {
            maxHealth: 1, contactDamage: 1, invulnerabilityDuration: 0,
            layer: 'hazard', destroyOnDeath: true
        }),
        catalogComp('pathFollower', { waypoints: [{ x: 0, y: 0 }, { x: 48, y: 0 }], speed: 26, mode: 'pingpong', turnAtLedge: true })
    ]));

    write('actors/flier.json', actorAsset('ledge_flier', 'prefab', 13, 9, '#6d5a8f', [
        spriteComp(IMG.flier),
        catalogComp('spriteUiAnimation', walkAnim(16, 12)),
        catalogComp('collider', { shape: 'box', width: 13, height: 9 }),
        catalogComp('damageHealth', { maxHealth: 1, contactDamage: 1, layer: 'hazard', destroyOnDeath: true }),
        catalogComp('pathFollower', { waypoints: [{ x: 0, y: 0 }, { x: 48, y: 0 }], speed: 26, mode: 'pingpong' }),
        catalogComp('spawner', {
            interval: 1.8, maxAlive: 1, spawnOffsetX: 4, spawnOffsetY: 8,
            spawnWhen: 'playerBelow', playerBelowX: 26,
            template: {
                type: 'actor', width: 6, height: 6, imgSrc: SRC.bomb,
                components: [
                    { type: 'sprite', enabled: true, properties: { imageAssetId: IMG.bomb } },
                    { type: 'damageHealth', enabled: true, properties: { maxHealth: 1, contactDamage: 1, layer: 'hazard', destroyOnDeath: true } },
                    { type: 'pathFollower', enabled: true, properties: { gravity: 520, waypoints: [] } }
                ]
            }
        })
    ]));

    write('actors/door.json', actorAsset('ledge_door', 'prefab', 16, 24, '#bd8347', [
        spriteComp(IMG.door),
        catalogComp('interactable', { radius: 26, hint: 'Enter' }),
        catalogComp('conveyorZiplineJumpPadPortal', {
            kind: 'portal', targetId: '', requireInteract: true,
            requireItem: '', consumeItem: false, fadeSeconds: 0.62, width: 16, height: 24
        })
    ]));

    write('actors/platform.json', actorAsset('ledge_platform', 'prefab', 38, 8, '#bd8347', [
        spriteComp(IMG.platform),
        catalogComp('collider', { oneWay: 'up', width: 38, height: 8 }),
        catalogComp('pathFollower', { waypoints: [{ x: 0, y: 0 }, { x: 48, y: 0 }], speed: 30, mode: 'pingpong', oneWayTop: true })
    ]));

    write('actors/lift.json', actorAsset('ledge_lift', 'prefab', 48, 8, '#bd8347', [
        spriteComp(IMG.lift),
        catalogComp('collider', { oneWay: 'up', width: 48, height: 8 }),
        catalogComp('pathFollower', {
            mode: 'elevator', elevator: true, speed: 42, waitAtWaypoint: 1.6,
            waypoints: [{ x: 0, y: 0 }, { x: 0, y: -96 }]
        })
    ]));

    write('actors/bomb.json', actorAsset('ledge_bomb', 'prefab', 6, 6, '#2e2949', [
        spriteComp(IMG.bomb),
        catalogComp('damageHealth', { maxHealth: 1, contactDamage: 1, layer: 'hazard', destroyOnDeath: true }),
        catalogComp('pathFollower', { gravity: 520, waypoints: [] })
    ]));

    const graph = ledgeGraph();
    write('graphs/ledge_logic.json', {
        name: 'ledge_logic',
        type: 'eventGraph',
        category: 'ledge',
        width: 48,
        height: 48,
        color: '#a78bfa',
        properties: { graph },
        components: [],
        tags: ['ledge', 'graph']
    });

    write('LEDGE.json', {
        name: 'LEDGE',
        type: 'level',
        category: 'ledge',
        width: 48,
        height: 48,
        color: '#38bdf8',
        properties: { levelSrc: 'maps/ledge.json' },
        components: [],
        tags: ['ledge', 'level']
    });

    return { files, graph };
}
