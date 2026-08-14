import { mergePlatformerProps, readPlatformerInput } from './platformerConstants.js';
import { PlatformerWorld } from './PlatformerWorld.js';
import { tryGrab, tryDescend, updateHang, updateClimb } from './PlatformerLedge.js';
import { tryBars, updateBars, tryLadder, autoLadder, updateLadder } from './PlatformerLadder.js';

/**
 * Platformer integrator owned by PlayerMovementBehavior (mode === 'platformer').
 * Not a component type — one movement behavior, two modes.
 */
export class PlatformerController {
    constructor(movement) {
        this.movement = movement;
        this.entity = movement.entity;
        this.C = mergePlatformerProps(movement.properties);
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.state = 'normal';
        this.onGround = true;
        this.stance = 0;
        this.coyote = 0;
        this.buf = 0;
        this.grabCd = 0;
        this.lock = 0;
        this.rollT = 0;
        this.rollCd = 0;
        this.stunT = 0;
        this.apexY = this.entity.y;
        this.hurtCd = 0;
        this.hang = null;
        this.climb = null;
        this.lad = null;
        this.bars = null;
        this.ride = null;
        this.sliding = 0;
        this.lastWall = 0;
        this.jumping = false;
        this.dt = 0;
        this.hitStop = 0;
        this.events = [];
    }

    emit(name) {
        this.events.push(name);
    }

    update(dt, scene) {
        this.events.length = 0;
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            if (this.hitStop > 0) return;
        }
        this.dt = dt;
        this.C = mergePlatformerProps(this.movement.properties);
        const inp = readPlatformerInput(scene.input);
        const world = new PlatformerWorld(scene, this.movement.properties.collidesWith);
        const p = this._body();
        this._tickTimers(dt);
        if (this.ride && this.onGround && this.state === 'normal') {
            if (this.ride.dx) this._moveX(world, p, this.ride.dx);
            if (this.ride.dy) {
                p.y += this.ride.dy;
                if (!world.rectFree(p.x, p.y, p.w, p.h)) p.y -= this.ride.dy;
            }
        }
        if (this.state === 'stun') {
            this.stunT -= dt;
            this.vy += this.C.GRAV * dt;
            this._moveY(world, p, this.vy * dt);
            if (this.stunT <= 0) this.state = 'normal';
            this._commit(p, scene, world);
            return;
        }
        if (this.state === 'bars') {
            updateBars(this, world, p, inp);
            this._commit(p, scene, world);
            return;
        }
        if (this.state === 'climb') {
            updateClimb(this, p);
            this._commit(p, scene, world);
            return;
        }
        if (this.state === 'hang') {
            updateHang(this, world, p, inp);
            world.touchCrumb(p);
            this._commit(p, scene, world);
            return;
        }
        if (this.state === 'ladder') {
            updateLadder(this, world, p, inp);
            this._commit(p, scene, world);
            return;
        }
        this._stepNormal(world, p, inp, scene);
        this._commit(p, scene, world);
    }

    _tickTimers(dt) {
        if (this.grabCd > 0) this.grabCd = Math.max(0, this.grabCd - dt);
        if (this.rollCd > 0) this.rollCd = Math.max(0, this.rollCd - dt);
        if (this.lock > 0) this.lock = Math.max(0, this.lock - dt);
        if (this.hurtCd > 0) this.hurtCd = Math.max(0, this.hurtCd - dt);
    }

    _stepNormal(world, p, inp, scene) {
        const C = this.C;
        let rolling = this.rollT > 0;
        if (!rolling && this.onGround) {
            if (inp.downPressed && this.stance < 2) this._setStance(world, p, this.stance + 1);
            if ((inp.upPressed || inp.upHeld || inp.jumpPressed) && this.stance > 0) {
                if (this._setStance(world, p, this.stance - 1)) this.buf = 0;
            }
        }
        if (this.stance > 0 && !this.onGround && world.rectFree(p.x, p.y + p.h - C.H, p.w, C.H)) {
            this._setStance(world, p, 0);
        }
        if (rolling) {
            this.rollT -= this.dt;
            if (inp.x) this.facing = inp.x > 0 ? 1 : -1;
            this.vx = this.facing * C.ROLL_V * Math.max(0.55, this.rollT / C.ROLL_T + 0.25);
            if (this.rollT <= 0) {
                if (world.rectFree(p.x, p.y + p.h - C.H, p.w, C.H)) {
                    this._setH(p, C.H);
                    this.stance = 0;
                    this.rollCd = C.ROLL_CD;
                } else this.rollT = 0.1;
            }
        } else {
            const ax = this.lock > 0 ? 0 : inp.x;
            if (ax !== 0) {
                this.vx += ax * C.ACC * this.dt;
                const lim = this.stance === 2 ? C.PRONE_V : (this.stance === 1 ? C.CROUCH_V : C.RUN);
                if (this.vx > lim) this.vx = lim;
                if (this.vx < -lim) this.vx = -lim;
                this.facing = ax > 0 ? 1 : -1;
            } else {
                const f = C.FRIC * this.dt;
                this.vx = Math.abs(this.vx) <= f ? 0 : this.vx - (this.vx > 0 ? f : -f);
            }
        }
        if (inp.jumpPressed) this.buf = C.BUF;
        this.buf -= this.dt;
        this.coyote -= this.dt;
        const inCabin = world.lifts.some((L) => this._inLift(p, L.entity));
        if (inCabin) this.buf = 0;
        if (this.buf > 0 && this.coyote > 0 && !rolling && this.stance === 0) {
            this.vy = C.JUMP;
            this.buf = 0;
            this.coyote = 0;
            this.onGround = false;
            this.jumping = true;
            this.apexY = p.y;
            this.emit('jump');
        } else if (this.buf > 0 && this.sliding !== 0 && !this.onGround) {
            const same = this.lastWall === this.sliding;
            this.vx = -this.sliding * (same ? C.WJ_SAME_X : C.WJ_X);
            this.vy = same ? C.WJ_SAME_Y : C.WJ_Y;
            this.facing = -this.sliding;
            this.lastWall = this.sliding;
            this.lock = C.WJ_LOCK;
            this.buf = 0;
            this.jumping = true;
            this.sliding = 0;
            this.apexY = p.y;
            this.emit(same ? 'walljumpweak' : 'walljump');
        }
        if (this.jumping && !inp.jumpHeld && this.vy < 0) {
            this.vy *= C.CUT;
            this.jumping = false;
        }
        if (this.onGround && !rolling && this.rollCd <= 0 && this.stance === 0
            && (inp.downHeld || inp.downPressed) && inp.x !== 0 && Math.abs(this.vx) > 62) {
            this.facing = inp.x > 0 ? 1 : -1;
            this.rollT = C.ROLL_T;
            this._setH(p, C.RH);
            this.emit('roll');
            rolling = true;
        }
        this.vy += C.GRAV * this.dt;
        if (this.vy > C.MAXFALL) this.vy = C.MAXFALL;
        this.sliding = 0;
        if (!this.onGround && this.vy > 0 && !rolling && this.lock <= 0) {
            const sd = inp.x;
            if (sd !== 0 && !world.rectFree(p.x + sd * 2, p.y, p.w, p.h) && world.rectFree(p.x, p.y, p.w, p.h)) {
                this.sliding = sd;
                this.facing = sd;
                if (this.vy > C.SLIDE_V) this.vy = C.SLIDE_V;
            }
        }
        const wasAir = !this.onGround;
        const prevBottom = p.y + p.h;
        this.onGround = false;
        this._moveX(world, p, this.vx * this.dt);
        this._moveY(world, p, this.vy * this.dt);
        if (!this.onGround && this._grounded(world, p) && this.vy >= 0) {
            this.onGround = true;
            this.vy = 0;
        }
        if (!this.onGround) {
            if (p.y < this.apexY) this.apexY = p.y;
            if (!rolling) autoLadder(this, world, p, prevBottom);
            if (!rolling && this.state === 'normal') tryBars(this, world, p);
            if (!rolling && this.state === 'normal') tryLadder(this, world, p, inp);
            if (this.state === 'normal') tryGrab(this, world, p);
        } else {
            this._land(world, p, inp, wasAir);
            if (this.state === 'normal' && !rolling) {
                if (!tryLadder(this, world, p, inp)
                    && (inp.downPressed || inp.downHeld) && this.grabCd <= 0) {
                    tryDescend(this, world, p, inp.x);
                }
            }
        }
        world.touchCrumb(p);
        this._tryMelee(scene, p, inp);
        if (p.y > 48 * C.T + 40) this._hurt(scene, 1);
    }

    _land(world, p, inp, wasAir) {
        const C = this.C;
        const pq = world.platUnder(p, p.y + p.h + 1);
        if (pq && world.rectFree(p.x, pq.y - p.h, p.w, p.h)) {
            this.ride = pq;
            p.y = pq.y - p.h;
        } else {
            this.ride = null;
            p.y = Math.floor((p.y + p.h) / this.C.T) * this.C.T - p.h;
        }
        this.vy = 0;
        this.coyote = C.COYOTE;
        this.jumping = false;
        this.lastWall = 0;
        if (!wasAir) return;
        const fall = p.y - this.apexY;
        if (fall > C.SAFE) {
            if (inp.x !== 0 && this.rollT <= 0 && this.rollCd <= 0) {
                this.rollT = C.ROLL_T;
                this._setH(p, C.RH);
                this.facing = inp.x > 0 ? 1 : -1;
                this.vx = inp.x * C.ROLL_V;
                this.emit('rollland');
            } else {
                this.hitStop = C.HITSTOP;
                this.emit('hardland');
            }
        } else if (fall > 18) this.emit('land');
        this.apexY = p.y;
    }

    _tryMelee(scene, p, inp) {
        if (!inp.actPressed || !scene.inventory?.has('stick')) return;
        if (scene.input?.consumeAction) scene.input.consumeAction('interact');
        this.emit('swing');
        const ax = p.x + p.w / 2 + this.facing * (this.C.ATK_R * 0.55);
        const ay = p.y + p.h / 2;
        for (const e of scene.getAllEntities()) {
            if (e === this.entity) continue;
            const dh = e.behaviors?.find((b) => b.contactDamage !== undefined && b.enabled);
            if (!dh || dh.contactDamage <= 0) continue;
            const ex = e.x + e.width / 2;
            const ey = e.y + e.height / 2;
            if (Math.abs(ex - ax) < this.C.ATK_R * 0.8 && Math.abs(ey - ay) < 20
                && (ex - (p.x + p.w / 2)) * this.facing > -4) {
                dh._applyDamage?.(99, scene);
                this.emit('kill');
            }
        }
    }

    _hurt(scene, n) {
        const dh = this.entity.behaviors?.find((b) => b.currentHealth !== undefined);
        if (dh) dh._applyDamage?.(n, scene);
        this.stunT = 0.3;
        this.state = 'stun';
        this.emit('hurt');
    }

    _moveX(world, p, dx) {
        p.x += dx;
        if (world.rectFree(p.x, p.y, p.w, p.h)) return;
        if (dx > 0) p.x = Math.floor((p.x + p.w) / this.C.T) * this.C.T - p.w;
        else p.x = Math.floor(p.x / this.C.T) * this.C.T + this.C.T;
        this.vx = 0;
    }

    _moveY(world, p, dy) {
        const oldB = p.y + p.h;
        p.y += dy;
        if (!world.rectFree(p.x, p.y, p.w, p.h)) {
            if (dy > 0) {
                p.y = Math.floor((p.y + p.h) / this.C.T) * this.C.T - p.h;
                this.onGround = true;
            } else p.y = Math.floor(p.y / this.C.T) * this.C.T + this.C.T;
            this.vy = 0;
            this.ride = null;
            return;
        }
        if (dy > 0) {
            for (const q of [...world.platforms, ...world.lifts.map((l) => l.entity)]) {
                if (p.x + p.w > q.x + 1 && p.x < q.x + q.width - 1
                    && oldB <= q.y + 1 && p.y + p.h >= q.y) {
                    p.y = q.y - p.h;
                    this.vy = 0;
                    this.onGround = true;
                    this.ride = q;
                    return;
                }
            }
        }
    }

    _grounded(world, p) {
        if (!world.rectFree(p.x + 1, p.y + p.h, p.w - 2, 1)) return true;
        return !!world.platUnder(p, p.y + p.h + 1);
    }

    _inLift(p, L) {
        return p.x + p.w > L.x + 2 && p.x < L.x + L.width - 2
            && Math.abs((p.y + p.h) - L.y) < 4;
    }

    _setH(p, h) {
        const b = p.y + p.h;
        p.h = h;
        p.y = b - h;
    }

    _stanceBox(st, p) {
        const h = st === 2 ? this.C.PRH : (st === 1 ? this.C.CRH : this.C.H);
        const wRaw = st === 2 ? this.C.PRW : (st === 1 ? this.C.CRW : this.C.W);
        const w = wRaw == null ? p.w : wRaw;
        return { w, h };
    }

    _setStance(world, p, st) {
        if (this.stance === st) return true;
        const { w, h } = this._stanceBox(st, p);
        const b = p.y + p.h;
        const x = p.x + (p.w - w) / 2;
        if (!world.rectFree(x, b - h, w, h)) return false;
        p.x = x;
        p.w = w;
        this._setH(p, h);
        this.stance = st;
        this.emit(st === 0 ? 'stand' : (st === 1 ? 'crouch' : 'prone'));
        return true;
    }

    _body() {
        return {
            x: this.entity.x,
            y: this.entity.y,
            w: this.entity.width,
            h: this.entity.height
        };
    }

    _commit(p, scene, world) {
        this.entity.x = p.x;
        this.entity.y = p.y;
        this.entity.width = p.w;
        this.entity.height = p.h;
        const speed = this.onGround ? Math.abs(this.vx) : 0;
        scene.eventGraphRuntime?.setVariable('speed', speed);
        scene.eventGraphRuntime?.setVariable('moveState', this.state);
        scene.eventGraphRuntime?.setVariable('stance', this.stance);
        scene.eventGraphRuntime?.setVariable('facing', this.facing);
        scene.eventGraphRuntime?.setVariable('onGround', this.onGround);
        scene.eventGraphRuntime?.setVariable('vy', this.vy);
        scene.eventGraphRuntime?.setVariable('rolling', this.rollT > 0);
        scene.eventGraphRuntime?.setVariable('sliding', this.sliding > 0);
        this.entity.scaleX = this.facing < 0 ? -1 : 1;
    }
}
