/** Default LEDGE / platformer tunables (px, px/s, seconds). Overridable via properties. */
export const TILE_KIND = {
    empty: 'empty',
    solid: 'solid',
    crumb: 'crumb',
    ladderWall: 'ladderWall',
    ladderFront: 'ladderFront',
    ladderDiagR: 'ladderDiagR',
    ladderDiagL: 'ladderDiagL',
    halfTop: 'halfTop',
    bar: 'bar'
};

export const DEFAULT_TILE_KINDS = {
    0: TILE_KIND.empty,
    1: TILE_KIND.solid,
    2: TILE_KIND.crumb,
    3: TILE_KIND.ladderWall,
    4: TILE_KIND.ladderFront,
    5: TILE_KIND.ladderDiagR,
    6: TILE_KIND.ladderDiagL,
    7: TILE_KIND.halfTop,
    8: TILE_KIND.bar
};

export const LADDER_KINDS = new Set([
    TILE_KIND.ladderWall,
    TILE_KIND.ladderFront,
    TILE_KIND.ladderDiagR,
    TILE_KIND.ladderDiagL
]);

export const PLATFORMER_DEFAULTS = {
    W: 10,
    H: 22,
    RH: 12,
    CRH: 14,
    PRH: 7,
    GRAV: 700,
    MAXFALL: 340,
    RUN: 105,
    ACC: 950,
    FRIC: 1200,
    JUMP: -236,
    CUT: 0.45,
    COYOTE: 0.09,
    BUF: 0.12,
    HAND: 3,
    TOL_UP: 3,
    TOL_DN: 6,
    GRAB_VY: -130,
    GRAB_CD: 0.2,
    CLIMB_UP: 0.5,
    CLIMB_DN: 0.46,
    TO_LAD: 0.3,
    STAND_OFF: 8,
    SLIDE_V: 62,
    WJ_X: 158,
    WJ_Y: -214,
    WJ_LOCK: 0.19,
    WJ_SAME_Y: -150,
    WJ_SAME_X: 96,
    THROW_X: 155,
    THROW_Y: -135,
    ACT_R: 26,
    ATK_T: 0.3,
    ATK_R: 26,
    ATK_CD: 0.16,
    HURT_CD: 1.0,
    LAD_SNAP: 0.14,
    CROUCH_V: 40,
    PRONE_V: 26,
    BAR_V: 52,
    ROLL_V: 152,
    ROLL_T: 0.42,
    ROLL_CD: 0.14,
    LAD_V: 58,
    LAD_TOL: 6,
    LAD_XTOL: 11,
    SAFE: 46,
    HURT: 104,
    HITSTOP: 0.055,
    T: 16
};

export function isLadderKind(kind) {
    return LADDER_KINDS.has(kind);
}

export function isSolidKind(kind) {
    return kind === TILE_KIND.solid || kind === TILE_KIND.crumb || kind === TILE_KIND.halfTop;
}

export function mergePlatformerProps(properties = {}) {
    const bag = properties.platformer && typeof properties.platformer === 'object'
        ? properties.platformer
        : {};
    return { ...PLATFORMER_DEFAULTS, ...bag, ...properties };
}

export function readPlatformerInput(input) {
    if (!input) {
        return {
            x: 0,
            jumpHeld: false,
            jumpPressed: false,
            upHeld: false,
            upPressed: false,
            downHeld: false,
            downPressed: false,
            actPressed: false
        };
    }
    const axis = typeof input.getAxis === 'function' ? input.getAxis() : { x: 0, y: 0 };
    const down = (name) => (typeof input.isActionDown === 'function' ? input.isActionDown(name) : false);
    const pressed = (name) => (typeof input.wasActionPressed === 'function' ? input.wasActionPressed(name) : false);
    return {
        x: axis.x || 0,
        jumpHeld: down('jump'),
        jumpPressed: pressed('jump'),
        upHeld: down('moveUp'),
        upPressed: pressed('moveUp'),
        downHeld: down('moveDown'),
        downPressed: pressed('moveDown'),
        actPressed: pressed('interact')
    };
}
