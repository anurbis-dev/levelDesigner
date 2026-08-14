/** Ledge grab, climb-up/down, hang. Mutates controller + player entity. */

function hangBox(C, cx, cy, facing, kind) {
    if (kind === 'lad') return { x: cx - C.W / 2, y: cy - C.HAND };
    return { x: facing > 0 ? cx - C.W : cx, y: cy - C.HAND };
}

function standBox(C, cx, cy, facing) {
    return { x: cx + facing * C.STAND_OFF - C.W / 2, y: cy - C.H };
}

function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function tryGrab(ctrl, world, p) {
    const C = ctrl.C;
    if (ctrl.grabCd > 0 || ctrl.onGround || ctrl.state !== 'normal' || ctrl.rollT > 0) return false;
    if (ctrl.vy < C.GRAB_VY) return false;
    const handY = p.y + C.HAND;
    const dir = ctrl.facing;
    const hx = dir > 0 ? p.x + p.w + 2 : p.x - 2;
    for (let dy = -C.TOL_DN; dy <= C.TOL_UP; dy++) {
        const py = handY + dy;
        if (world.solidAt(hx, py) || !world.solidAt(hx, py + 2)) continue;
        const top = Math.floor((py + 2) / C.T) * C.T;
        const wc = Math.floor(hx / C.T);
        const cx = dir > 0 ? wc * C.T : (wc + 1) * C.T;
        const hb = hangBox(C, cx, top, dir, 'ledge');
        if (!world.rectFree(hb.x, hb.y, p.w, p.h)) continue;
        const sb = standBox(C, cx, top, dir);
        if (!world.rectFree(sb.x, sb.y, p.w, C.H)) continue;
        grabTo(ctrl, p, cx, top, dir, 'ledge');
        return true;
    }
    for (const q of world.platforms) {
        const side = (p.x + p.w / 2 < q.x + q.width / 2) ? -1 : 1;
        if (side !== dir) continue;
        const cxq = side > 0 ? q.x + q.width : q.x;
        if (Math.abs((dir > 0 ? p.x + p.w : p.x) - cxq) > 12) continue;
        if (Math.abs(handY - q.y) > 9) continue;
        const hbq = hangBox(C, cxq, q.y, dir, 'ledge');
        if (!world.rectFree(hbq.x, hbq.y, p.w, p.h)) continue;
        grabTo(ctrl, p, cxq, q.y, dir, 'ledge');
        ctrl.hang.plat = q;
        return true;
    }
    return false;
}

export function tryDescend(ctrl, world, p, want) {
    const C = ctrl.C;
    const gy = Math.floor((p.y + p.h + 2) / C.T) * C.T;
    const order = want ? [want, -want] : [ctrl.facing, -ctrl.facing];
    for (const dir of order) {
        let col = -1;
        for (let d = 2; d <= 16; d += 2) {
            const px = dir > 0 ? p.x + p.w - 1 + d : p.x - d;
            if (!world.solidAt(px, gy + 2)) {
                col = Math.floor(px / C.T) - dir;
                break;
            }
        }
        if (col < 0 || !world.solidAt(col * C.T + 8, gy + 2)) continue;
        const cx = dir > 0 ? (col + 1) * C.T : col * C.T;
        const f = -dir;
        const hb = hangBox(C, cx, gy, f, 'ledge');
        if (!world.rectFree(hb.x, hb.y, p.w, p.h)) continue;
        startClimb(ctrl, p, -1, cx, gy, f, 'ledge');
        return true;
    }
    return false;
}

export function grabTo(ctrl, p, cx, cy, facing, kind) {
    const C = ctrl.C;
    ctrl.lastWall = 0;
    const b = hangBox(C, cx, cy, facing, kind === 'lad' ? 'lad' : 'ledge');
    p.x = b.x;
    p.y = b.y;
    ctrl.vx = 0;
    ctrl.vy = 0;
    ctrl.facing = facing;
    ctrl.state = 'hang';
    ctrl.onGround = false;
    ctrl.hang = { cx, cy, kind, plat: null };
    ctrl.emit('grab');
}

export function startClimb(ctrl, p, dir, cx, cy, facing, kind) {
    const C = ctrl.C;
    const from = { x: p.x, y: p.y };
    let to;
    if (dir > 0 && kind === 'lad') to = { x: cx - C.W / 2, y: cy - C.H };
    else if (dir > 0) to = standBox(C, cx, cy, facing);
    else to = hangBox(C, cx, cy, facing, 'ledge');
    ctrl.facing = facing;
    ctrl.state = 'climb';
    ctrl.vx = 0;
    ctrl.vy = 0;
    ctrl.onGround = false;
    ctrl.climb = {
        dir,
        kind,
        p: 0,
        dur: dir > 0 ? (kind === 'lad' ? C.TO_LAD : C.CLIMB_UP) : C.CLIMB_DN,
        cx,
        cy,
        facing,
        from,
        to
    };
    ctrl.emit(dir > 0 ? 'climbup' : 'climbdown');
}

export function updateHang(ctrl, world, p, inp) {
    const C = ctrl.C;
    ctrl.vx = 0;
    ctrl.vy = 0;
    if (ctrl.hang.plat) {
        const q = ctrl.hang.plat;
        const dx = q.dx || 0;
        ctrl.hang.cx += dx;
        ctrl.hang.cy = q.y;
        p.x += dx;
        p.y = q.y - C.HAND;
    }
    const away = (inp.x !== 0 && inp.x !== ctrl.facing) ? inp.x : 0;
    if (ctrl.hang.kind === 'lad') {
        if (inp.jumpPressed || inp.upPressed || inp.upHeld) {
            startClimb(ctrl, p, 1, ctrl.hang.cx, ctrl.hang.cy, ctrl.facing, 'lad');
        } else if (inp.downPressed) {
            releaseHang(ctrl);
        }
        return;
    }
    if (inp.jumpPressed) {
        if (away) {
            ctrl.state = 'normal';
            ctrl.hang = null;
            ctrl.grabCd = C.GRAB_CD;
            ctrl.vx = away * C.WJ_X * 0.9;
            ctrl.vy = C.WJ_Y;
            ctrl.facing = away;
            ctrl.lock = C.WJ_LOCK;
            ctrl.apexY = p.y;
            ctrl.emit('backjump');
            return;
        }
        const sb = standBox(C, ctrl.hang.cx, ctrl.hang.cy, ctrl.facing);
        if (world.rectFree(sb.x, sb.y, p.w, C.H)) {
            startClimb(ctrl, p, 1, ctrl.hang.cx, ctrl.hang.cy, ctrl.facing, 'ledge');
        }
        return;
    }
    if (inp.upPressed || inp.upHeld) {
        const sb = standBox(C, ctrl.hang.cx, ctrl.hang.cy, ctrl.facing);
        if (world.rectFree(sb.x, sb.y, p.w, C.H)) {
            startClimb(ctrl, p, 1, ctrl.hang.cx, ctrl.hang.cy, ctrl.facing, 'ledge');
        }
        return;
    }
    if (inp.downPressed) {
        releaseHang(ctrl);
        return;
    }
    if (away) releaseHang(ctrl, away);
}

export function updateClimb(ctrl, p) {
    const cl = ctrl.climb;
    cl.p += ctrl.dt / cl.dur;
    if (cl.p >= 1) {
        p.x = cl.to.x;
        p.y = cl.to.y;
        ctrl.vx = 0;
        ctrl.vy = 0;
        ctrl.apexY = p.y;
        if (cl.dir > 0) {
            ctrl.state = 'normal';
            ctrl.onGround = true;
            ctrl.coyote = ctrl.C.COYOTE;
            ctrl.hang = null;
            ctrl.climb = null;
            ctrl.emit('mantled');
        } else {
            ctrl.state = 'hang';
            ctrl.hang = { cx: cl.cx, cy: cl.cy, kind: 'ledge', plat: null };
            ctrl.climb = null;
            ctrl.grabCd = 0;
            ctrl.emit('hanged');
        }
        return;
    }
    const t = ease(cl.p);
    p.x = cl.from.x + (cl.to.x - cl.from.x) * t;
    p.y = cl.from.y + (cl.to.y - cl.from.y) * t;
}

function releaseHang(ctrl, push) {
    ctrl.state = 'normal';
    ctrl.hang = null;
    ctrl.grabCd = ctrl.C.GRAB_CD;
    ctrl.vy = 12;
    ctrl.onGround = false;
    ctrl.apexY = ctrl.entity.y;
    if (push) {
        ctrl.vx = push * 48;
        ctrl.facing = push;
    }
    ctrl.emit('release');
}
