/**
 * Minimalist stroke-based SVG glyphs for asset/component type placeholders.
 * Each entry is the inner markup of a 24x24 viewBox <svg>, drawn with
 * stroke="currentColor" fill="none" — color is applied by the caller so the
 * same glyph can be tinted per-type.
 */
export const TYPE_ICON_PATHS = {
    // --- Core (already-defined scene concepts, section 1) ---
    camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',
    actor: '<circle cx="12" cy="7" r="3"/><path d="M6 20c0-4 3-6 6-6s6 2 6 6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="M21 16l-5-5-4 4-2-2-6 6"/>',
    imageAtlas: '<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/>',
    volume: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    player_start: '<path d="M6 3v18"/><path d="M6 4h12l-3 3.5L18 11H6z"/>',

    // --- Visual / render (section 2) ---
    spriteAnimationClip: '<rect x="2" y="6" width="5.5" height="12" rx="1"/><rect x="9.2" y="6" width="5.5" height="12" rx="1"/><rect x="16.4" y="6" width="5.5" height="12" rx="1"/>',
    tileset: '<rect x="3" y="3" width="5" height="5"/><rect x="9.5" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/><rect x="3" y="9.5" width="5" height="5"/><rect x="9.5" y="9.5" width="5" height="5"/><rect x="16" y="9.5" width="5" height="5"/><rect x="3" y="16" width="5" height="5"/><rect x="9.5" y="16" width="5" height="5"/><rect x="16" y="16" width="5" height="5"/>',
    tilemap: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    nineSliceSprite: '<rect x="3" y="3" width="18" height="18"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke-dasharray="2 2"/>',
    fontTextStyle: '<path d="M6 20L11 4h2l5 16"/><path d="M7.5 14h9"/>',
    particleEffect: '<circle cx="12" cy="12" r="1.4"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
    materialShaderPreset: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5A8.5 8.5 0 0 1 12 20.5z"/>',
    light: '<circle cx="12" cy="10" r="5.5"/><path d="M9.5 20h5M10 17.5h4"/><path d="M12 1v2M4 10H2M22 10h-2M5.5 3.5l1.4 1.4M18.5 3.5l-1.4 1.4"/>',

    // --- Audio ---
    soundEffect: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>',
    musicTrack: '<circle cx="6.5" cy="18" r="2.4"/><circle cx="17" cy="16" r="2.4"/><path d="M8.9 18V5.5L19.4 4v12"/>',
    audioZone: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.5"/><path d="M9 10v4h2.4l3 2.4v-8.8l-3 2.4z"/>',

    // --- Data / system ---
    dialogueGraph: '<path d="M3 5h9v6H8l-2.5 2.5V11H3z"/><path d="M13 12h8v6h-3v2.5L15.5 18H13z"/>',
    questObjective: '<path d="M6 3v18"/><path d="M6 4h11l-2.5 3L17 10H6z"/><path d="M9 15.5l1.6 1.6L14 13.5"/>',
    itemDefinition: '<path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16z"/><path d="M4 8l8 4.5L20 8M12 12.5V21"/>',
    inventorySchema: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18"/><path d="M9 10v10M15 10v10"/>',
    localizationTable: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/>',
    saveSchema: '<path d="M5 3h12l4 4v14H5z"/><rect x="8" y="3" width="8" height="5"/><rect x="7" y="13" width="10" height="7"/>',
    inputMap: '<rect x="2.5" y="8" width="19" height="10" rx="4"/><path d="M7 11v4M5 13h4"/><circle cx="15.5" cy="12" r="1"/><circle cx="18" cy="14.5" r="1"/>',

    // --- Navigation / AI ---
    pathSpline: '<path d="M3 18C7 18 7 6 12 6s5 12 9 12" stroke-dasharray="1 3.2"/><circle cx="3" cy="18" r="1.4"/><circle cx="21" cy="18" r="1.4"/>',
    navMesh: '<path d="M4 18L10 4l10 3-3 12-9 3z"/><path d="M10 4l3 8-9 6M13 12l7-5M13 12l4 10"/>',
    aiBehaviorPreset: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6"/>',

    // --- Other ---
    prefab: '<rect x="3" y="6" width="13" height="13"/><path d="M8 6V3h13v13h-3"/>',
    sequenceCutscene: '<rect x="3" y="6" width="18" height="14" rx="1"/><path d="M3 10h18"/><path d="M6 6l2 4M11 6l2 4M16 6l2 4"/>',

    // --- Components (section 3, attach to Actor) ---
    sprite: '<rect x="3" y="3" width="18" height="18" rx="1"/><circle cx="9" cy="9" r="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/>',
    collider: '<rect x="3.5" y="3.5" width="17" height="17" stroke-dasharray="2.5 2"/>',
    trigger: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.5 2"/><path d="M2 12h7M9 9l3 3-3 3"/>',
    transformAnimation: '<path d="M4 12a8 8 0 0 1 14-5"/><path d="M20 12a8 8 0 0 1-14 5"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    spriteUiAnimation: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M10 8l6 4-6 4z"/>',
    interactable: '<path d="M9 12V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 6a1.5 1.5 0 0 1 3 0v5"/><path d="M15 7a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6.5 7S5 20 5 15.5V13l-1.5-2A1.4 1.4 0 0 1 5.7 9l1.3 1.5"/>',
    pickup: '<path d="M4 9h16l-1.5 10h-13z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
    dialogueTrigger: '<path d="M3 5h14v9H9l-3.5 3.5V14H3z"/><path d="M13 8.5v.01"/>',
    damageHealth: '<path d="M12 20S3 14.5 3 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 2.5C21 14.5 12 20 12 20z"/><path d="M12 8v5M9.5 10.5h5"/>',
    movablePushable: '<rect x="3" y="7" width="12" height="12"/><path d="M17 13h4M18.5 10.5L21 13l-2.5 2.5"/>',
    mountableVehicleSeat: '<circle cx="12" cy="12" r="8"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
    pathFollower: '<path d="M3 17C7 17 7 7 12 7s5 10 9 10" stroke-dasharray="1 3.2"/><circle cx="12" cy="7" r="1.6"/>',
    spawner: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    stateMachineBehavior: '<circle cx="5" cy="12" r="2.3"/><circle cx="19" cy="6" r="2.3"/><circle cx="19" cy="18" r="2.3"/><path d="M7.2 11l9.6-4M7.2 13l9.6 4"/>',
    playerStart: '<path d="M6 3v18"/><path d="M6 4h12l-3 3.5L18 11H6z"/>',
    checkpointSavePoint: '<path d="M6 3v18"/><path d="M6 5h11l-2.5 3L17 11H6z"/><path d="M9.5 16.5l1.4 1.4L14 14.5"/>',
    climbableLadder: '<path d="M7 2v20M17 2v20"/><path d="M7 6h10M7 11h10M7 16h10"/>',
    conveyorZiplineJumpPadPortal: '<path d="M3 12h14"/><path d="M13 8l4 4-4 4"/><path d="M3 8h4M3 16h4" stroke-dasharray="1.5 1.5"/>',
    destructibleContainer: '<path d="M4 8h16v12H4z"/><path d="M4 8l2-5h12l2 5"/><path d="M10 8l1.5 5-2 4M14 8l-1.5 5 2 4"/>',
    variableModifier: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="16" cy="12" r="2.6"/>',
    // component id matches asset-type id for audioZone / tilemap / particleEffect
    // (asset icons already under those keys above)
};

const DEFAULT_ICON = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v6M12 16.5v.01"/>';

/**
 * Build an inline SVG markup string for a given type id.
 * @param {string} typeId
 * @param {string} color - stroke color (CSS color string)
 * @param {number} size - pixel size (square)
 * @returns {string}
 */
export function buildTypeIconSvg(typeId, color = '#9ca3af', size = 20) {
    const inner = TYPE_ICON_PATHS[typeId] || DEFAULT_ICON;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
