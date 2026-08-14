#!/usr/bin/env node
/**
 * Rasterize LEDGE prototype (tmp/ledge-v5.html) fillRect art into PNGs.
 * Palette and tile/item recipes match P / drawTile / drawLadder / items / doors.
 * No extra npm packages — PNG via node:zlib (filter-none, deflate IDAT).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content', 'assets', 'ledge');

const P = {
  out: '#100c1c',
  skin: '#f6cda2', skinS: '#c98f66', skinL: '#ffe7c9',
  hair: '#e0563c', hairS: '#a13425', hairL: '#ff8a63',
  shirt: '#2fb6ab', shirtS: '#1b7a76', shirtL: '#69e6d8',
  skirt: '#26618a', skirtS: '#17415e',
  pants: '#443c73', pantsS: '#2b2550',
  boot: '#8a5228', bootS: '#57301a',
  rock: '#635c8c', rockD: '#464069', rockL: '#8f86b8', rockX: '#2e2949',
  moss: '#6aa86f', mossD: '#437a51',
  crum: '#96705a', crumD: '#5d4437', crumL: '#bb8f70',
  wood: '#bd8347', woodD: '#7d5029', woodL: '#e0ac68',
  gem: '#6de8ff', gemD: '#2189ad',
  shroom: '#ff8f5e', shroomD: '#a8482c', stem: '#ffe9c9',
  coin: '#ffd75e', coinD: '#b98420',
  relic: '#e2c6ff', relicD: '#8a63c4',
  torch: '#ffb060',
  stickC: '#bd8347', stickD: '#7d5029',
  key: '#ffd75e', keyD: '#b98420',
  door: '#bd8347', doorD: '#7d5029', doorL: '#e0ac68',
  lockC: '#ffd75e', lockD: '#b98420',
  foeA: '#6d5a8f', foeB: '#443c73', foeEye: '#ffe7c9',
  liftA: '#bd8347', liftB: '#7d5029', liftC: '#e0ac68'
};

function parseCol(col) {
  if (typeof col !== 'string' || col[0] !== '#') return [0, 0, 0, 255];
  const h = col.slice(1);
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      255
    ];
  }
  if (h.length === 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      255
    ];
  }
  if (h.length === 8) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      parseInt(h.slice(6, 8), 16)
    ];
  }
  return [0, 0, 0, 255];
}

function createImage(w, h) {
  return { w, h, data: new Uint8Array(w * h * 4) };
}

function setPixel(buf, w, h, x, y, r, g, b, a) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= w || y >= h || a <= 0) return;
  const i = (y * w + x) * 4;
  if (a >= 255) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = 255;
    return;
  }
  const sa = a / 255;
  const inv = 1 - sa;
  const da = buf[i + 3] / 255;
  const outA = sa + da * inv;
  if (outA <= 0) return;
  buf[i] = Math.round((r * sa + buf[i] * da * inv) / outA);
  buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * inv) / outA);
  buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * inv) / outA);
  buf[i + 3] = Math.round(outA * 255);
}

function pix(img, x, y, col) {
  const [r, g, b, a] = parseCol(col);
  setPixel(img.data, img.w, img.h, x, y, r, g, b, a);
}

function rc(img, x, y, w, h, col) {
  const [r, g, b, a] = parseCol(col);
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) setPixel(img.data, img.w, img.h, x + i, y + j, r, g, b, a);
  }
}

function lb(img, a, b, th, col) {
  let x0 = Math.round(a[0]);
  let y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const o = -((th / 2) | 0);
  for (let g = 0; g < 240; g++) {
    rc(img, x0 + o, y0 + o, th, th, col);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3] === 0) continue;
      setPixel(
        dst.data, dst.w, dst.h, dx + x, dy + y,
        src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]
      );
    }
  }
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(buf, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = y * (w * 4 + 1) + 1 + x * 4;
      raw[di] = buf[si];
      raw[di + 1] = buf[si + 1];
      raw[di + 2] = buf[si + 2];
      raw[di + 3] = buf[si + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function writePng(name, img) {
  const path = join(OUT, name);
  writeFileSync(path, encodePng(img.data, img.w, img.h));
  return path;
}

/* ---------- tiles ---------- */

function drawEmpty() {
  return createImage(16, 16);
}

function drawRock(crumb) {
  const img = createImage(16, 16);
  const bs = crumb ? P.crum : P.rock;
  const bd = crumb ? P.crumD : P.rockD;
  const bl = crumb ? P.crumL : P.rockL;
  rc(img, 0, 0, 16, 16, bs);
  rc(img, 0, 9, 16, 1, bd);
  rc(img, 4, 0, 1, 9, bd);
  rc(img, 12, 10, 1, 6, bd);
  rc(img, 2, 3, 2, 1, bl);
  rc(img, 10, 12, 2, 1, bl);
  rc(img, 3, 4, 4, 1, bl);
  rc(img, 4, 5, 2, 1, bl);
  if (crumb) {
    rc(img, 3, 2, 1, 6, P.crumD);
    rc(img, 8, 6, 1, 7, P.crumD);
    rc(img, 11, 3, 1, 4, P.crumD);
  } else {
    rc(img, 0, 0, 16, 3, P.moss);
    rc(img, 0, 3, 16, 1, P.mossD);
    rc(img, 0, 0, 16, 1, P.rockL);
    rc(img, 0, 15, 16, 1, P.rockX);
    rc(img, 0, 0, 1, 16, P.rockX);
    rc(img, 15, 0, 1, 16, P.rockX);
  }
  return img;
}

function drawLadderWall() {
  const img = createImage(16, 16);
  rc(img, 3, 0, 2, 16, P.woodD);
  rc(img, 11, 0, 2, 16, P.woodD);
  rc(img, 3, 0, 1, 16, P.woodL);
  rc(img, 11, 0, 1, 16, P.woodL);
  for (let i = 1; i < 16; i += 5) rc(img, 4, i, 8, 2, P.wood);
  return img;
}

function drawLadderFront() {
  const img = createImage(16, 16);
  rc(img, 1, 0, 14, 16, '#241c3d');
  rc(img, 1, 0, 2, 16, P.woodD);
  rc(img, 13, 0, 2, 16, P.woodD);
  rc(img, 1, 0, 1, 16, P.wood);
  rc(img, 13, 0, 1, 16, P.wood);
  for (let i = 2; i < 16; i += 5) {
    rc(img, 3, i, 10, 2, P.wood);
    rc(img, 3, i, 10, 1, P.woodL);
  }
  rc(img, 4, 0, 8, 1, '#00000044');
  return img;
}

function drawLadderDiag(dir) {
  const img = createImage(16, 16);
  const a = [dir > 0 ? 0 : 16, 16];
  const b = [dir > 0 ? 16 : 0, 0];
  const d = dir;
  lb(img, [a[0] - d * 2, a[1] - 4], [b[0] - d * 2, b[1] - 4], 2, P.woodD);
  lb(img, [a[0] + d * 3, a[1] + 3], [b[0] + d * 3, b[1] + 3], 2, P.wood);
  for (let i = 2; i < 16; i += 5) {
    const px = a[0] + d * i;
    const py = a[1] - i;
    lb(img, [px - d * 3, py - 5], [px + d * 4, py + 4], 2, P.woodL);
  }
  return img;
}

function drawHalfTop() {
  const img = createImage(16, 16);
  rc(img, 0, 0, 16, 8, P.rock);
  rc(img, 0, 6, 16, 2, P.rockD);
  rc(img, 3, 1, 3, 1, P.rockL);
  rc(img, 10, 3, 2, 1, P.rockL);
  return img;
}

function drawBar() {
  const img = createImage(16, 16);
  rc(img, 0, 0, 16, 3, P.woodD);
  rc(img, 0, 0, 16, 1, P.wood);
  rc(img, 2, 3, 2, 4, P.woodD);
  rc(img, 12, 3, 2, 4, P.woodD);
  rc(img, 6, 3, 4, 6, P.wood);
  rc(img, 6, 3, 4, 1, P.woodL);
  return img;
}

function makeTileset() {
  const tiles = [
    drawEmpty(),
    drawRock(false),
    drawRock(true),
    drawLadderWall(),
    drawLadderFront(),
    drawLadderDiag(1),
    drawLadderDiag(-1),
    drawHalfTop(),
    drawBar()
  ];
  const sheet = createImage(144, 16);
  tiles.forEach((t, i) => blit(sheet, t, i * 16, 0));
  return sheet;
}

/* ---------- player (chibi ~10×22, facing right) ---------- */

const KEYS = ['head', 'neck', 'hip', 'eF', 'hF', 'eB', 'hB', 'kF', 'fF', 'kB', 'fB'];

function po(o) {
  return o;
}

const IDLE_A = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [7, 11], hF: [7, 15], eB: [3, 11], hB: [3, 15], kF: [6, 18], fF: [6, 22], kB: [4, 18], fB: [4, 22] });
const IDLE_B = po({ head: [5, 5], neck: [5, 9], hip: [5, 15], eF: [7, 12], hF: [7, 16], eB: [3, 12], hB: [3, 15], kF: [6, 19], fF: [6, 22], kB: [4, 19], fB: [4, 22] });
const RUN_0 = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [4, 11], hF: [2, 13], eB: [6, 11], hB: [8, 12], kF: [8, 18], fF: [9, 22], kB: [3, 17], fB: [2, 20] });
const RUN_1 = po({ head: [5, 3], neck: [5, 7], hip: [5, 13], eF: [5, 10], hF: [4, 14], eB: [5, 10], hB: [6, 14], kF: [6, 17], fF: [6, 22], kB: [4, 16], fB: [5, 18] });

function swapFB(a) {
  return { head: a.head, neck: a.neck, hip: a.hip, eF: a.eB, hF: a.hB, eB: a.eF, hB: a.hF, kF: a.kB, fF: a.fB, kB: a.kF, fB: a.fF };
}

const RUN_2 = swapFB(RUN_0);
const RUN_3 = swapFB(RUN_1);
const JUMPP = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [8, 10], hF: [9, 6], eB: [3, 10], hB: [2, 7], kF: [7, 17], fF: [6, 20], kB: [3, 18], fB: [3, 22] });
const FALLP = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [9, 11], hF: [10, 8], eB: [1, 11], hB: [0, 8], kF: [8, 18], fF: [8, 22], kB: [2, 18], fB: [2, 22] });
const LANDP = po({ head: [5, 7], neck: [5, 10], hip: [5, 16], eF: [8, 14], hF: [8, 17], eB: [2, 14], hB: [2, 17], kF: [8, 19], fF: [7, 22], kB: [2, 19], fB: [3, 22] });
const SLIDEP = po({ head: [5, 5], neck: [5, 9], hip: [5, 15], eF: [8, 8], hF: [10, 4], eB: [3, 12], hB: [2, 15], kF: [7, 17], fF: [7, 21], kB: [3, 18], fB: [3, 22] });
const STUNP = po({ head: [5, 10], neck: [5, 13], hip: [5, 17], eF: [8, 16], hF: [9, 20], eB: [2, 16], hB: [2, 20], kF: [7, 20], fF: [8, 22], kB: [3, 20], fB: [2, 22] });
const ROLLP = po({ head: [5, 7], neck: [5, 9], hip: [5, 13], eF: [8, 10], hF: [7, 13], eB: [2, 10], hB: [3, 13], kF: [8, 13], fF: [6, 16], kB: [2, 13], fB: [4, 16] });
const LADP0 = po({ head: [5, 5], neck: [5, 9], hip: [5, 15], eF: [8, 7], hF: [9, 2], eB: [6, 10], hB: [7, 7], kF: [7, 17], fF: [8, 20], kB: [4, 18], fB: [4, 22] });
const LADP1 = po({ head: [5, 5], neck: [5, 9], hip: [5, 15], eF: [7, 10], hF: [8, 6], eB: [7, 6], hB: [8, 2], kF: [7, 18], fF: [7, 22], kB: [4, 17], fB: [5, 19] });
const LADF0 = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [8, 8], hF: [8, 2], eB: [2, 8], hB: [2, 6], kF: [7, 17], fF: [7, 21], kB: [3, 18], fB: [3, 22] });
const LADF1 = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [8, 8], hF: [8, 6], eB: [2, 8], hB: [2, 2], kF: [7, 18], fF: [7, 22], kB: [3, 17], fB: [3, 20] });
const ATK0 = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [3, 10], hF: [2, 5], eB: [6, 11], hB: [7, 14], kF: [7, 18], fF: [8, 22], kB: [3, 18], fB: [2, 22] });
const ATK1 = po({ head: [5, 4], neck: [5, 8], hip: [5, 14], eF: [8, 9], hF: [12, 10], eB: [4, 11], hB: [3, 14], kF: [8, 18], fF: [9, 22], kB: [3, 17], fB: [2, 21] });
const ATK2 = po({ head: [5, 5], neck: [5, 9], hip: [5, 15], eF: [8, 12], hF: [11, 16], eB: [3, 12], hB: [2, 15], kF: [7, 18], fF: [8, 22], kB: [3, 18], fB: [2, 22] });
const CROUCH = po({ head: [5, 7], neck: [5, 10], hip: [5, 15], eF: [7, 12], hF: [8, 15], eB: [3, 12], hB: [3, 15], kF: [8, 17], fF: [6, 20], kB: [3, 17], fB: [3, 20] });
const CROUCH_W = po({ head: [5, 7], neck: [5, 10], hip: [5, 15], eF: [7, 12], hF: [6, 16], eB: [3, 12], hB: [4, 15], kF: [8, 16], fF: [8, 20], kB: [3, 18], fB: [2, 20] });
const PRONE0 = po({ head: [7, 3], neck: [6, 4], hip: [3, 5], eF: [8, 5], hF: [10, 6], eB: [6, 6], hB: [8, 7], kF: [1, 6], fF: [-1, 7], kB: [2, 7], fB: [0, 7] });
const PRONE1 = po({ head: [7, 3], neck: [6, 4], hip: [3, 5], eF: [9, 6], hF: [11, 7], eB: [5, 5], hB: [7, 6], kF: [1, 5], fF: [-1, 6], kB: [2, 7], fB: [0, 7] });
const BARS0 = po({ head: [5, 7], neck: [5, 10], hip: [5, 16], eF: [6, 5], hF: [7, 1], eB: [4, 6], hB: [3, 2], kF: [6, 20], fF: [6, 24], kB: [4, 20], fB: [4, 24] });
const BARS1 = po({ head: [5, 7], neck: [5, 10], hip: [5, 16], eF: [7, 4], hF: [9, 1], eB: [3, 6], hB: [2, 2], kF: [7, 20], fF: [8, 23], kB: [4, 20], fB: [3, 24] });
const HANGL = po({ head: [5, 8], neck: [5, 11], hip: [5, 17], eF: [7, 5], hF: [7, 2], eB: [3, 6], hB: [3, 3], kF: [6, 21], fF: [6, 26], kB: [4, 21], fB: [3, 25] });
const CL_K = [
  po({ head: [-5, 3], neck: [-5, 7], hip: [-5, 14], eF: [-2, 3], hF: [0, 0], eB: [-4, 4], hB: [-2, 1], kF: [-3, 19], fF: [-4, 24], kB: [-6, 19], fB: [-7, 23] }),
  po({ head: [-4, -2], neck: [-4, 2], hip: [-4, 9], eF: [0, -4], hF: [0, 0], eB: [-4, -3], hB: [-2, 1], kF: [-1, 13], fF: [-3, 17], kB: [-5, 13], fB: [-7, 16] }),
  po({ head: [-1, -8], neck: [-1, -4], hip: [0, 3], eF: [2, -6], hF: [3, -2], eB: [-3, -3], hB: [-2, 0], kF: [4, 0], fF: [1, 4], kB: [-3, 7], fB: [-5, 11] }),
  po({ head: [5, -13], neck: [5, -10], hip: [5, -4], eF: [8, -10], hF: [8, -6], eB: [2, -10], hB: [3, -7], kF: [8, -2], fF: [7, 0], kB: [4, -2], fB: [4, 0] }),
  po({ head: [8, -18], neck: [8, -14], hip: [8, -8], eF: [10, -11], hF: [10, -7], eB: [6, -11], hB: [6, -7], kF: [9, -4], fF: [9, 0], kB: [7, -4], fB: [7, 0] })
];

function shiftPose(a, dx, dy) {
  const o = {};
  for (const k of KEYS) o[k] = [a[k][0] + dx, a[k][1] + dy];
  return o;
}

function fitPose(a, hipX = 5, hipY = 14) {
  return shiftPose(a, hipX - a.hip[0], hipY - a.hip[1]);
}

const HEAD_S = ['.hhhh.', 'hhhhhh', 'hhssss', 'hhsses', '.hssss', '.hsss.', '..ss..'];
const HEAD_F = ['.hhhh.', 'hhhhhh', 'hhhhhh', 'hssssh', 'hssssh', '.ssss.', '..ss..'];

function drawHead(img, hx, hy, facing, wag, mode, frontal) {
  const rows = frontal ? HEAD_F : HEAD_S;
  const bx = frontal ? hx : hx - facing * 3;
  const by = hy - 1;
  const t1 = [bx - (frontal ? 0 : facing * 2) + (frontal ? wag * 0.6 : 0), by + (frontal ? 4 : 2) + (frontal ? 0 : wag)];
  const t2 = [bx - (frontal ? 0 : facing * 3) + (frontal ? wag : 0), by + (frontal ? 9 : 6) + (frontal ? 0 : wag * 2)];
  if (mode === 0) {
    lb(img, [bx, by], t1, 3, P.out);
    lb(img, t1, t2, 2, P.out);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < 6; c++) {
        if (rows[r][c] === '.') continue;
        let tx = c - 3;
        const ty = r - 4;
        if (!frontal && facing < 0) tx = -tx - 1;
        rc(img, hx + tx - 1, hy + ty - 1, 3, 3, P.out);
      }
    }
    return;
  }
  lb(img, [bx, by], t1, 2, P.hair);
  lb(img, t1, t2, 2, P.hairS);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 6; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      let tx = c - 3;
      const ty = r - 4;
      if (!frontal && facing < 0) tx = -tx - 1;
      const col = ch === 'h' ? (r < 2 ? P.hairL : P.hair) : (ch === 'e' ? P.out : (ty < 0 ? P.skinL : P.skin));
      pix(img, hx + tx, hy + ty, col);
    }
  }
}

function figure(img, pt, facing, wag, frontal, heldStick) {
  const sh = [pt.neck[0], pt.neck[1] + 1];
  const seg = [
    [pt.hip, pt.kB, 3], [pt.kB, pt.fB, 2], [sh, pt.eB, 2], [pt.eB, pt.hB, 2],
    [pt.neck, pt.hip, 4], [pt.hip, pt.kF, 3], [pt.kF, pt.fF, 2], [sh, pt.eF, 2], [pt.eF, pt.hF, 2]
  ];
  for (let i = 0; i < seg.length; i++) lb(img, seg[i][0], seg[i][1], seg[i][2] + 1, P.out);
  rc(img, pt.hip[0] - 4, pt.hip[1] - 2, 8, 5, P.out);
  drawHead(img, pt.head[0], pt.head[1], facing, wag, 0, frontal);
  lb(img, pt.hip, pt.kB, 3, P.pantsS);
  lb(img, pt.kB, pt.fB, 2, P.pantsS);
  rc(img, pt.fB[0] - 2, pt.fB[1] - 2, 4, 3, P.bootS);
  lb(img, sh, pt.eB, 2, P.shirtS);
  lb(img, pt.eB, pt.hB, 2, P.skinS);
  lb(img, pt.neck, pt.hip, 4, P.shirt);
  rc(img, pt.hip[0] - 3, pt.hip[1] - 2, 6, 4, P.skirt);
  rc(img, pt.hip[0] - 3, pt.hip[1] - 2, 6, 1, P.shirtS);
  rc(img, pt.hip[0] - 3, pt.hip[1] + 2, 6, 1, P.skirtS);
  lb(img, pt.hip, pt.kF, 3, P.pants);
  lb(img, pt.kF, pt.fF, 2, P.pants);
  rc(img, pt.fF[0] - 2, pt.fF[1] - 2, 4, 3, P.boot);
  lb(img, sh, pt.eF, 2, P.shirtL);
  lb(img, pt.eF, pt.hF, 2, P.skin);
  drawHead(img, pt.head[0], pt.head[1], facing, wag, 1, frontal);
  if (heldStick) {
    const ang = heldStick.ang;
    const hx2 = pt.hF[0];
    const hy2 = pt.hF[1];
    const ex2 = hx2 + Math.cos(ang) * 10;
    const ey2 = hy2 + Math.sin(ang) * 10;
    const bx2 = hx2 - Math.cos(ang) * 3;
    const by2 = hy2 - Math.sin(ang) * 3;
    lb(img, [bx2, by2], [ex2, ey2], 2, P.out);
    lb(img, [bx2, by2], [ex2, ey2], 1, P.stickC);
    rc(img, ex2 - 1, ey2 - 1, 2, 2, P.stickD);
  }
}

function rasterPose(pose, opts = {}) {
  const facing = opts.facing ?? 1;
  const frontal = !!opts.frontal;
  const fw = 16;
  const fh = 28;
  const tmp = createImage(40, 48);
  const ox = 12;
  const oy = 12;
  const pt = {};
  for (const k of KEYS) {
    let x = pose[k][0];
    const y = pose[k][1];
    if (!frontal && facing < 0) x = 10 - x;
    pt[k] = [ox + x, oy + y];
  }
  figure(tmp, pt, facing, 0, frontal, opts.stick || null);
  const frame = createImage(fw, fh);
  const cx = Math.round(pt.hip[0] - 5);
  const cy = Math.round(pt.head[1] - 5);
  blit(frame, { w: fw, h: fh, data: crop(tmp, cx, cy, fw, fh) }, 0, 0);
  return frame;
}

function crop(src, x, y, w, h) {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const si = (sy * src.w + sx) * 4;
      const di = (j * w + i) * 4;
      data[di] = src.data[si];
      data[di + 1] = src.data[si + 1];
      data[di + 2] = src.data[si + 2];
      data[di + 3] = src.data[si + 3];
    }
  }
  return data;
}

function makePlayer() {
  const frames = [
    [IDLE_A, {}],
    [IDLE_B, {}],
    [RUN_0, {}],
    [RUN_1, {}],
    [RUN_2, {}],
    [RUN_3, {}],
    [JUMPP, {}],
    [FALLP, {}],
    [LANDP, {}],
    [SLIDEP, {}],
    [STUNP, {}],
    [ROLLP, {}],
    [CROUCH, {}],
    [CROUCH_W, {}],
    [PRONE0, {}],
    [PRONE1, {}],
    [HANGL, {}],
    [fitPose(CL_K[1]), {}],
    [fitPose(CL_K[2]), {}],
    [fitPose(CL_K[3]), {}],
    [LADP0, {}],
    [LADP1, {}],
    [LADF0, { frontal: true }],
    [LADF1, { frontal: true }],
    [BARS0, {}],
    [BARS1, {}],
    [ATK0, { stick: { ang: -2.1 } }],
    [ATK1, { stick: { ang: -0.98 } }],
    [ATK2, { stick: { ang: 1.4 } }],
    null,
    null,
    null
  ];
  const sheet = createImage(128, 112);
  frames.forEach((f, i) => {
    if (!f) return;
    const col = i % 8;
    const row = (i / 8) | 0;
    blit(sheet, rasterPose(f[0], f[1]), col * 16, row * 28);
  });
  return sheet;
}

/* ---------- items / props ---------- */

function makeItems() {
  const sheet = createImage(96, 16);
  const kinds = ['coin', 'gem', 'shroom', 'relic', 'key', 'stick'];
  kinds.forEach((kind, i) => {
    const img = createImage(16, 16);
    const x = 8;
    const y = 8;
    if (kind === 'gem') {
      rc(img, x - 1, y - 4, 2, 1, P.gem);
      rc(img, x - 3, y - 3, 6, 2, P.gem);
      rc(img, x - 2, y - 1, 4, 3, P.gemD);
      rc(img, x - 1, y + 2, 2, 2, P.gemD);
      rc(img, x - 2, y - 3, 1, 2, '#ffffff');
    } else if (kind === 'coin') {
      rc(img, x - 2, y - 3, 4, 6, P.coin);
      rc(img, x - 3, y - 2, 6, 4, P.coin);
      rc(img, x + 1, y - 2, 1, 4, P.coinD);
      rc(img, x - 2, y - 2, 1, 2, '#fff6c9');
    } else if (kind === 'shroom') {
      rc(img, x - 1, y, 2, 4, P.stem);
      rc(img, x - 4, y - 3, 8, 3, P.shroom);
      rc(img, x - 3, y - 5, 6, 2, P.shroom);
      rc(img, x - 2, y - 4, 1, 1, '#ffe9c9');
      rc(img, x + 1, y - 3, 1, 1, '#ffe9c9');
      rc(img, x - 4, y, 8, 1, P.shroomD);
    } else if (kind === 'relic') {
      rc(img, x - 3, y - 5, 6, 10, P.relicD);
      rc(img, x - 2, y - 4, 4, 8, P.relic);
      rc(img, x - 1, y - 2, 2, 4, '#fff');
      rc(img, x - 4, y - 6, 8, 1, P.relicD);
      rc(img, x - 4, y + 5, 8, 1, P.relicD);
    } else if (kind === 'key') {
      rc(img, x - 1, y - 4, 4, 4, P.key);
      rc(img, x, y - 3, 2, 2, P.keyD);
      rc(img, x, y, 2, 6, P.key);
      rc(img, x + 2, y + 3, 2, 1, P.key);
      rc(img, x + 2, y + 5, 2, 1, P.key);
    } else {
      rc(img, x - 6, y - 1, 13, 2, P.stickC);
      rc(img, x - 6, y + 1, 13, 1, P.stickD);
      rc(img, x + 5, y - 2, 3, 4, P.stickD);
    }
    blit(sheet, img, i * 16, 0);
  });
  return sheet;
}

function makeTorch() {
  const img = createImage(8, 16);
  rc(img, 3, 8, 2, 8, P.woodD);
  rc(img, 3, 8, 1, 8, P.wood);
  rc(img, 2, 4, 4, 4, P.torch);
  rc(img, 3, 2, 2, 3, '#ffd98a');
  rc(img, 3, 1, 1, 1, '#fff6d0');
  return img;
}

function makeEnemy() {
  const img = createImage(16, 16);
  const x = 2;
  const y = 2;
  const w = 11;
  const h = 14;
  rc(img, x, y, w, h, P.foeB);
  rc(img, x + 1, y + 1, w - 2, h - 3, P.foeA);
  rc(img, x + 1, y + 1, w - 2, 1, '#b98ad0');
  rc(img, x + w - 4, y + 4, 2, 2, P.foeEye);
  rc(img, x + 1, y + h - 2, 3, 2, P.foeB);
  rc(img, x + w - 4, y + h - 2, 3, 2, P.foeB);
  for (let t = 0; t < 3; t++) rc(img, x + 2 + t * 3, y - 1, 1, 3, P.foeA);
  return img;
}

function makeFlier() {
  const img = createImage(16, 12);
  const x = 1;
  const y = 1;
  const w = 13;
  const h = 9;
  rc(img, x + 2, y + 2, w - 4, h - 3, '#6d5a8f');
  rc(img, x + 3, y + 3, w - 6, 2, '#9b83c4');
  rc(img, x + w - 4, y + 3, 2, 2, P.foeEye);
  rc(img, x + w - 2, y + 5, 2, 2, '#ffb060');
  lb(img, [x + 3, y + 3], [x - 1, y + 1], 2, '#7e6aa6');
  lb(img, [x + w - 3, y + 3], [x + w + 1, y + 1], 2, '#7e6aa6');
  return img;
}

function makeDoor() {
  const img = createImage(16, 24);
  rc(img, 0, 0, 16, 24, '#241a30');
  rc(img, 1, 1, 14, 22, P.doorD);
  rc(img, 2, 2, 12, 20, P.door);
  rc(img, 2, 2, 12, 1, P.doorL);
  rc(img, 7, 2, 2, 20, P.doorD);
  rc(img, 3, 5, 4, 6, P.doorD);
  rc(img, 9, 5, 4, 6, P.doorD);
  rc(img, 11, 13, 2, 2, P.lockD);
  return img;
}

function makeLift() {
  const img = createImage(48, 8);
  rc(img, 0, 0, 48, 8, P.liftB);
  rc(img, 0, 0, 48, 2, P.liftA);
  rc(img, 0, 0, 48, 1, P.liftC);
  rc(img, 0, 0, 3, 8, P.liftB);
  rc(img, 45, 0, 3, 8, P.liftB);
  rc(img, 0, 0, 3, 1, P.liftC);
  rc(img, 45, 0, 3, 1, P.liftC);
  rc(img, 22, 0, 4, 2, '#ffd06a');
  return img;
}

function makePlatform() {
  const img = createImage(38, 8);
  rc(img, 0, 0, 38, 8, P.woodD);
  rc(img, 0, 0, 38, 2, P.wood);
  rc(img, 0, 0, 38, 1, P.woodL);
  rc(img, 2, 6, 2, 2, P.rockX);
  rc(img, 34, 6, 2, 2, P.rockX);
  return img;
}

function makeBomb() {
  const img = createImage(6, 6);
  rc(img, 1, 1, 4, 4, P.rockX);
  rc(img, 2, 0, 2, 5, P.out);
  rc(img, 0, 2, 6, 2, P.out);
  rc(img, 2, 2, 2, 2, '#3a3157');
  pix(img, 2, 1, '#5c5183');
  return img;
}

const TILE_NAMES = [
  'empty', 'rock', 'crumb', 'ladderWall', 'ladderFront',
  'ladderDiagR', 'ladderDiagL', 'halfTop', 'bar'
];
const PLAYER_FRAMES = [
  ['idle_a', 'idle_b', 'run0', 'run1', 'run2', 'run3', 'jump', 'fall'],
  ['land', 'slide', 'stun', 'roll', 'crouch', 'crouch_w', 'prone0', 'prone1'],
  ['hang', 'climb0', 'climb1', 'climb2', 'lad0', 'lad1', 'ladf0', 'ladf1'],
  ['bars0', 'bars1', 'atk0', 'atk1', 'atk2', 'empty', 'empty', 'empty']
];
const ITEM_FRAMES = ['coin', 'gem', 'shroom', 'relic', 'key', 'stick'];

function main() {
  mkdirSync(OUT, { recursive: true });
  const files = [
    ['tileset.png', makeTileset()],
    ['player.png', makePlayer()],
    ['items.png', makeItems()],
    ['torch.png', makeTorch()],
    ['enemy.png', makeEnemy()],
    ['flier.png', makeFlier()],
    ['door.png', makeDoor()],
    ['lift.png', makeLift()],
    ['platform.png', makePlatform()],
    ['bomb.png', makeBomb()]
  ];
  const listing = [];
  for (const [name, img] of files) {
    const path = writePng(name, img);
    listing.push({ name, w: img.w, h: img.h, bytes: statSync(path).size });
  }
  const meta = {
    source: 'tmp/ledge-v5.html',
    palette: P,
    files: {
      tileset: { file: 'tileset.png', tile: 16, columns: 9, tiles: TILE_NAMES },
      player: { file: 'player.png', frame: [16, 28], columns: 8, rows: 4, frames: PLAYER_FRAMES },
      items: { file: 'items.png', frame: 16, frames: ITEM_FRAMES },
      torch: { file: 'torch.png', size: [8, 16] },
      enemy: { file: 'enemy.png', size: [16, 16] },
      flier: { file: 'flier.png', size: [16, 12] },
      door: { file: 'door.png', size: [16, 24] },
      lift: { file: 'lift.png', size: [48, 8] },
      platform: { file: 'platform.png', size: [38, 8] },
      bomb: { file: 'bomb.png', size: [6, 6] }
    }
  };
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  listing.push({ name: 'meta.json', bytes: statSync(join(OUT, 'meta.json')).size });
  const colors = {
    tileset: '#635c8c', player: '#2fb6ab', items: '#ffd75e', torch: '#ffb060',
    enemy: '#6d5a8f', flier: '#6d5a8f', door: '#bd8347', lift: '#bd8347',
    platform: '#bd8347', bomb: '#2e2949'
  };
  for (const [name, img] of files) {
    const stem = name.replace(/\.png$/, '');
    const jsonName = `${stem}.json`;
    const data = {
      name: `ledge_${stem}`,
      type: 'image',
      category: 'ledge',
      imgSrc: name,
      color: colors[stem] || '#cccccc',
      width: img.w,
      height: img.h,
      properties: { isTemporary: false },
      components: []
    };
    writeFileSync(join(OUT, jsonName), JSON.stringify(data, null, 2) + '\n');
    listing.push({ name: jsonName, bytes: statSync(join(OUT, jsonName)).size });
  }
  for (const f of listing) {
    const dim = f.w ? ` ${f.w}×${f.h}` : '';
    console.log(`${f.name}${dim}  ${f.bytes} bytes`);
  }
}

main();
