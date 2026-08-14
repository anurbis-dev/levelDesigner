import { TILE_KIND } from './platformerConstants.js';

/** Vertical / diagonal ladders and ceiling bars. */

export function tryBars(ctrl, world, p) {
    const C = ctrl.C;
    if (ctrl.state !== 'normal' || ctrl.onGround || ctrl.vy < -40) return false;
    const cx = p.x + p.w / 2;
    const handY = p.y + C.HAND;
    for (let dy = -8; dy <= 10; dy++) {
        const py = handY + dy;
        if (!world.barAt(cx, py)) continue;
        const r = Math.floor(py / C.T);
        const barY = (r + 1) * C.T;
        if (Math.abs(barY - handY) > 9) continue;
        const ny = barY - C.HAND;
        if (!world.rectFree(p.x, ny, p.w, p.h)) continue;
        p.y = ny;
        ctrl.vx = 0;
        ctrl.vy = 0;
        ctrl.onGround = false;
        ctrl.state = 'bars';
        ctrl.bars = { row: r };
        ctrl.emit('grabbar');
        return true;
    }
    return false;
}

export function updateBars(ctrl, world, p, inp) {
    const C = ctrl.C;
    if (inp.jumpPressed || inp.downPressed) {
        ctrl.state = 'normal';
        ctrl.bars = null;
        ctrl.vy = inp.jumpPressed ? C.JUMP * 0.72 : 10;
        ctrl.vx = inp.x * 70;
        ctrl.apexY = p.y;
        ctrl.grabCd = C.GRAB_CD;
        ctrl.emit(inp.jumpPressed ? 'jump' : 'release');
        return;
    }
    ctrl.vy = 0;
    const dir = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
    if (!dir) return;
    ctrl.facing = dir;
    const nx = p.x + dir * C.BAR_V * ctrl.dt;
    const ncx = nx + p.w / 2;
    if (world.rectFree(nx, p.y, p.w, p.h) && world.barAt(ncx, ctrl.bars.row * C.T + 4)) {
        p.x = nx;
    } else if (!world.barAt(ncx, ctrl.bars.row * C.T + 4)) {
        ctrl.state = 'normal';
        ctrl.bars = null;
        ctrl.vy = 12;
        ctrl.apexY = p.y;
        ctrl.grabCd = C.GRAB_CD;
        ctrl.emit('release');
    }
}

export function tryLadder(ctrl, world, p, inp) {
    if (ctrl.rollT > 0) return false;
    const up = inp.upPressed || inp.upHeld;
    const dn = inp.downPressed || inp.downHeld;
    if (!up && !dn) return false;
    const cx = p.x + p.w / 2;
    const probes = [];
    if (ctrl.onGround) {
        if (up) probes.push([cx, p.y + 8], [cx, p.y + p.h - 4]);
        if (dn) probes.push([cx, p.y + p.h + 3], [cx + ctrl.facing * 11, p.y + p.h + 2]);
    } else {
        probes.push([cx, p.y + 8], [cx, p.y + p.h - 4]);
    }
    for (const [px, py] of probes) {
        const k = world.ladderKindAt(px, py);
        if (!k) continue;
        const col = Math.floor(px / ctrl.C.T);
        const diag = k === TILE_KIND.ladderDiagR || k === TILE_KIND.ladderDiagL;
        const nx = diag ? p.x : col * ctrl.C.T + ctrl.C.T / 2 - p.w / 2;
        if (!world.rectFree(nx, p.y, p.w, p.h)) continue;
        attach(ctrl, p, k, col);
        return true;
    }
    return false;
}

export function autoLadder(ctrl, world, p, prevBottom) {
    if (ctrl.state !== 'normal' || ctrl.vy <= 0 || ctrl.rollT > 0 || ctrl.lock > 0) return false;
    const cx = p.x + p.w / 2;
    const c = Math.floor(cx / ctrl.C.T);
    const r0 = Math.floor(prevBottom / ctrl.C.T);
    const r1 = Math.floor((p.y + p.h) / ctrl.C.T);
    for (let r = r0; r <= r1; r++) {
        for (const col of [c, c + 1, c - 1]) {
            const k = world.ladderKindAt(col * ctrl.C.T + 8, r * ctrl.C.T + 8);
            if (!k) continue;
            const diag = k === TILE_KIND.ladderDiagR || k === TILE_KIND.ladderDiagL;
            if (!diag && ctrl.vy > 190) continue;
            if (Math.abs(col * ctrl.C.T + ctrl.C.T / 2 - cx) > 12) continue;
            const nx = diag ? p.x : col * ctrl.C.T + ctrl.C.T / 2 - p.w / 2;
            if (!world.rectFree(nx, p.y, p.w, p.h)) continue;
            p.x = nx;
            attach(ctrl, p, k, col);
            return true;
        }
    }
    return false;
}

function attach(ctrl, p, kind, col) {
    ctrl.lastWall = 0;
    ctrl.lad = { v: kind, col, dirx: kind === TILE_KIND.ladderDiagL ? -1 : 1 };
    ctrl.state = 'ladder';
    ctrl.vx = 0;
    ctrl.vy = 0;
    ctrl.onGround = false;
    ctrl.ride = null;
    ctrl.emit('onladder');
}

export function updateLadder(ctrl, world, p, inp) {
    const C = ctrl.C;
    const L = ctrl.lad;
    const diag = L.v === TILE_KIND.ladderDiagR || L.v === TILE_KIND.ladderDiagL;
    if (inp.jumpPressed) {
        ctrl.state = 'normal';
        ctrl.lad = null;
        ctrl.vy = C.JUMP * 0.84;
        ctrl.vx = inp.x * 92;
        ctrl.jumping = true;
        ctrl.apexY = p.y;
        if (inp.x) ctrl.facing = inp.x > 0 ? 1 : -1;
        ctrl.emit('jump');
        return;
    }
    if (!diag && Math.abs(inp.x) > 0.6 && !inp.upHeld && !inp.downHeld) {
        const sx = inp.x > 0 ? 1 : -1;
        const tx = p.x + sx * 3;
        if (world.rectFree(tx, p.y, p.w, p.h)) {
            p.x = tx;
            ctrl.state = 'normal';
            ctrl.lad = null;
            ctrl.facing = sx;
            ctrl.vx = sx * 95;
            ctrl.vy = -70;
            ctrl.apexY = p.y;
            ctrl.emit('offladder');
            return;
        }
    }
    let up;
    if (diag) {
        const hx = Math.abs(inp.x) > 0.35 ? (inp.x > 0 ? 1 : -1) : 0;
        up = hx !== 0 ? hx * L.dirx : ((inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0));
    } else {
        up = (inp.upHeld ? 1 : 0) - (inp.downHeld ? 1 : 0);
    }
    if (up === 0) return;
    const sp = C.LAD_V * ctrl.dt;
    let nx = p.x;
    let ny = p.y;
    if (diag) {
        nx += L.dirx * up * sp * 0.72;
        ny -= up * sp * 0.72;
    } else {
        ny -= up * sp;
    }
    if (!world.rectFree(nx, ny, p.w, p.h)) {
        if (up > 0) exitTop(ctrl, world, p, L);
        return;
    }
    if (diag || world.ladderKindAt(nx + p.w / 2, ny + p.h / 2)) {
        p.x = nx;
        p.y = ny;
    } else if (up > 0) {
        exitTop(ctrl, world, p, L);
    } else {
        ctrl.state = 'normal';
        ctrl.lad = null;
        ctrl.emit('offladder');
    }
}

function exitTop(ctrl, world, p, L) {
    const C = ctrl.C;
    const ty = Math.floor((p.y + 4) / C.T) * C.T - p.h;
    if (world.rectFree(p.x, ty, p.w, p.h)) {
        p.y = ty;
        ctrl.vx = 0;
        ctrl.vy = 0;
        ctrl.state = 'normal';
        ctrl.onGround = true;
        ctrl.lad = null;
        ctrl.apexY = p.y;
        ctrl.coyote = C.COYOTE;
        ctrl.emit('offladder');
        return true;
    }
    return false;
}
