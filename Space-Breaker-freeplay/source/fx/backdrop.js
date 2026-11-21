// backdrop.js — parallax starfield, drifting nebulae, sector set-pieces,
// LIVING skyline (billboards, beacons, searchlights) and a distant WAR
// simulation (Macross-style dogfights, artillery, flak, capital flashes).
import { W, H } from '../engine/renderer.js';
import { SECTORS, sectorFor } from '../palettes.js';
import { rand, TAU } from '../engine/rand.js';

const LAYERS = [
  { n: 70, spd: 34, size: [0.8, 1.6], a: 0.5 },
  { n: 44, spd: 78, size: [1.2, 2.4], a: 0.75 },
  { n: 22, spd: 150, size: [1.8, 3.2], a: 1 },
];
const stars = [];

let cur = null;          // current palette (lerped rgb)
let from = null, toP = null, lerpT = 1;
let nebs = [];           // {x,y,r,cvs,a,vx,vy}
let skyline = null;      // baked buildings canvas
let SKY = null;          // animated skyline metadata
let t = 0;

// ---------------- distant war ----------------
const war = [];          // background battle events
let warT = 0.6;
let warCap = 34;
// adaptive-quality hook: thin the background war on weak machines
export function setWarDensity(n) { warCap = Math.max(4, n | 0); }

export function initBackdrop() {
  stars.length = 0;
  for (const L of LAYERS) {
    for (let i = 0; i < L.n; i++) {
      stars.push({
        x: rand(0, W), y: rand(0, H),
        s: rand(L.size[0], L.size[1]),
        spd: L.spd, a: L.a * rand(0.6, 1),
        tw: rand(0, TAU), tws: rand(1, 4),
      });
    }
  }
  setSector(0, true);
}

export function setSector(idx, instant = false) {
  const p = sectorFor(idx + 1);
  from = instant ? null : { ...cur };
  toP = p;
  lerpT = instant ? 1 : 0;
  cur = { ...p };
  buildNebs(p);
  buildSkyline(p);
}

function buildNebs(p) {
  nebs = [];
  for (let i = 0; i < 5; i++) {
    const col = p.neb[i % p.neb.length];
    const r = rand(220, 420);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(256, 256, 10, 256, 256, 250);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.55)`);
    g.addColorStop(0.6, `rgba(${col[0] * 0.6 | 0},${col[1] * 0.6 | 0},${col[2] * 0.6 | 0},0.22)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    nebs.push({
      x: rand(0, W), y: rand(-100, H), r,
      cvs: cv, a: rand(0.14, 0.3),
      vx: rand(-8, 8), vy: rand(6, 16),
    });
  }
}

function hex2rgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function buildSkyline(p) {
  skyline = document.createElement('canvas');
  skyline.width = W; skyline.height = 260;
  const x = skyline.getContext('2d');
  const acc = hex2rgb(p.accent);
  const acc2 = hex2rgb(p.accent2);
  SKY = { lights: [], billboards: [], beacons: [], towers: [] };
  let bx = -20;
  x.fillStyle = 'rgba(4,6,16,0.92)';
  while (bx < W + 40) {
    const bw = rand(36, 92);
    const bh = rand(60, 210);
    x.fillStyle = 'rgba(4,6,16,0.92)';
    x.fillRect(bx, 260 - bh, bw, bh);
    const antenna = Math.random() < 0.32 ? rand(14, 42) : 0;
    if (antenna) x.fillRect(bx + bw / 2 - 1.5, 260 - bh - antenna, 3, antenna);
    // windows: bake some, animate a subset
    const wcol = Math.random() < 0.5 ? acc : acc2;
    for (let wy = 260 - bh + 10; wy < 250; wy += 16) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
        if (Math.random() < 0.26) {
          const live = Math.random() < 0.34; // ~1/3 of windows animate
          if (live) {
            SKY.lights.push({ x: wx, y: wy, w: 4, h: 6, col: wcol, ph: rand(0, TAU), sp: rand(1.4, 3.2) });
          } else {
            x.fillStyle = `rgba(${wcol[0]},${wcol[1]},${wcol[2]},${rand(0.28, 0.55)})`;
            x.fillRect(wx, wy, 4, 6);
          }
        }
      }
    }
    // rooftop beacon
    if (antenna && Math.random() < 0.8) {
      SKY.beacons.push({ x: bx + bw / 2, y: 260 - bh - antenna, ph: rand(0, TAU) });
    }
    // tall towers get searchlights
    if (bh > 160 && SKY.towers.length < 3) {
      SKY.towers.push({ x: bx + bw / 2, y: 260 - bh, ph: rand(0, TAU) });
    }
    // billboard
    if (bw > 55 && Math.random() < 0.4 && SKY.billboards.length < 6) {
      SKY.billboards.push({
        x: bx + rand(6, 18), y: 260 - bh + rand(12, 40),
        w: rand(22, 38), h: rand(26, 46),
        col: Math.random() < 0.5 ? p.accent : p.accent2, ph: rand(0, TAU),
      });
    }
    bx += bw + rand(4, 18);
  }
  // cap lights for perf
  SKY.lights = SKY.lights.slice(0, 110);
}

function curRGB(key) {
  if (!from || lerpT >= 1) return toP[key];
  const a = from[key], b = toP[key];
  const k = lerpT;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

// ---------------- war event spawning ----------------
function spawnWarEvent() {
  const roll = Math.random();
  if (roll < 0.34) {
    // dogfight: two silhouettes chasing across the near-far background
    const fromL = Math.random() < 0.5;
    war.push({
      type: 'dog',
      x: fromL ? -80 : W + 80, y: rand(110, H * 0.55),
      vx: (fromL ? 1 : -1) * rand(70, 170), vy: rand(-30, 30),
      t: 0, life: rand(4.5, 8), fireT: rand(0.4, 1.1),
    });
  } else if (roll < 0.58) {
    // flak burst
    war.push({ type: 'flak', x: rand(0, W), y: rand(80, H * 0.55), t: 0, life: 0.9, r: rand(50, 110) });
  } else if (roll < 0.82) {
    // artillery streak rising diagonally, ends in flak
    const dir = Math.random() < 0.5 ? 1 : -1;
    war.push({
      type: 'streak',
      x: rand(W * 0.15, W * 0.85), y: rand(H * 0.38, H * 0.55),
      vx: dir * rand(40, 100), vy: -rand(180, 340),
      t: 0, life: rand(1.4, 2.4),
    });
  } else {
    // capital ship flash (something big dies far away)
    war.push({ type: 'cap', x: rand(100, W - 100), y: rand(100, H * 0.38), t: 0, life: 1.6, r: rand(130, 240) });
  }
}

function updateWar(dt) {
  warT -= dt;
  if (warT <= 0) {
    warT = rand(0.2, 0.55);
    if (war.length < warCap) spawnWarEvent();
  }
  for (let i = war.length - 1; i >= 0; i--) {
    const e = war[i];
    e.t += dt;
    if (e.type === 'dog') {
      e.x += e.vx * dt; e.y += e.vy * dt + Math.sin(e.t * 2.2) * 14 * dt;
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT = rand(0.3, 0.9);
        // tracer exchange between the pair
        war.push({
          type: 'tracer',
          x1: e.x, y1: e.y, x2: e.x + Math.sign(e.vx) * rand(60, 150), y2: e.y + rand(-36, 36),
          t: 0, life: 0.18,
        });
        if (Math.random() < 0.28) {
          war.push({ type: 'boom', x: e.x + rand(-24, 24), y: e.y + rand(-18, 18), t: 0, life: 0.45, r: rand(12, 24) });
        }
      }
      if (e.x < -140 || e.x > W + 140 || e.t > e.life) war.splice(i, 1);
    } else if (e.type === 'streak') {
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.t >= e.life) {
        war.push({ type: 'flak', x: e.x, y: e.y, t: 0, life: 0.9, r: rand(60, 110) });
        war.splice(i, 1);
      }
    } else if (e.t >= e.life) {
      war.splice(i, 1);
    }
  }
}

function drawWar(ctx) {
  const p = toP || SECTORS[0];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of war) {
    const k = e.t / e.life;
    if (e.type === 'dog') {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 8); ctx.lineTo(-6, 0); ctx.lineTo(-10, -8); ctx.closePath(); ctx.fill();
      ctx.restore();
      // wingman silhouette offset behind
      ctx.save();
      ctx.translate(e.x - Math.sign(e.vx) * 38, e.y + 15);
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = p.accent2;
      ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (e.type === 'tracer') {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.accent2;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
    } else if (e.type === 'flak') {
      const r = e.r * (0.2 + k);
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = '#ffe9c9';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, 7); ctx.stroke();
      if (k < 0.28) {
        ctx.globalAlpha = (1 - k * 3.5) * 0.9;
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath(); ctx.arc(e.x, e.y, 13 * (1 - k * 2.8), 0, 7); ctx.fill();
      }
    } else if (e.type === 'streak') {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - e.vx * 0.3, e.y - e.vy * 0.3);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, 7); ctx.fill();
    } else if (e.type === 'cap') {
      // distant capital-ship death: double pulse + ring
      const pulse = Math.sin(k * Math.PI);
      ctx.globalAlpha = pulse * 0.44;
      const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.r);
      g.addColorStop(0, 'rgba(255,240,220,0.9)');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 7); ctx.fill();
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = '#ffb98a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + k * 1.2), 0, 7); ctx.stroke();
    } else if (e.type === 'boom') {
      ctx.globalAlpha = (1 - k) * 0.8;
      const g2 = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 2);
      g2.addColorStop(0, 'rgba(255,235,200,0.95)');
      g2.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------------- main update / draw ----------------
export function updateBackdrop(dt) {
  t += dt;
  if (lerpT < 1) lerpT = Math.min(1, lerpT + dt / 1.4);
  for (const s of stars) {
    s.y += s.spd * dt;
    if (s.y > H + 4) { s.y = -4; s.x = rand(0, W); }
  }
  for (const n of nebs) {
    n.x += n.vx * dt; n.y += n.vy * dt;
    if (n.y - n.r > H) { n.y = -n.r; n.x = rand(0, W); }
  }
  updateWar(dt);
}

export function drawBackdrop(ctx) {
  // sky gradient
  const c0 = curRGB('bg0'), c1 = curRGB('bg1');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgb(${c0[0] | 0},${c0[1] | 0},${c0[2] | 0})`);
  g.addColorStop(1, `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // set-piece behind everything
  if (toP) drawSetPiece(ctx, toP.set);

  // nebulae
  for (const n of nebs) {
    ctx.globalAlpha = n.a;
    ctx.drawImage(n.cvs, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  ctx.globalAlpha = 1;

  // the distant war
  drawWar(ctx);

  // stars (twinkle)
  const scol = toP ? toP.star : '#aef2ff';
  ctx.fillStyle = scol;
  for (const s of stars) {
    ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * s.tws + s.tw));
    ctx.fillRect(s.x, s.y, s.s, s.s * (1 + s.spd / 300));
  }
  ctx.globalAlpha = 1;

  // living skyline (the harbor you defend)
  if (skyline) {
    ctx.globalAlpha = 0.9;
    ctx.drawImage(skyline, 0, H - 200);
    drawSkyAnim(ctx);
    const gl = ctx.createLinearGradient(0, H - 200, 0, H);
    gl.addColorStop(0, 'rgba(0,0,0,0)');
    gl.addColorStop(1, 'rgba(0,0,0,0.66)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, H - 200, W, 200);
    ctx.globalAlpha = 1;
  }
}

function drawSkyAnim(ctx) {
  if (!SKY) return;
  const p = toP || SECTORS[0];
  ctx.save();
  ctx.translate(0, H - 260); // skyline canvas coords -> world

  // animated windows (breathing light)
  ctx.globalCompositeOperation = 'lighter';
  for (const l of SKY.lights) {
    const a = 0.3 + 0.55 * Math.max(0, Math.sin(t * l.sp + l.ph));
    ctx.globalAlpha = a;
    ctx.fillStyle = `rgb(${l.col[0]},${l.col[1]},${l.col[2]})`;
    ctx.fillRect(l.x, l.y, l.w, l.h);
  }

  // billboards: pulsing ad panels with frames
  for (const b of SKY.billboards) {
    const pulse = 0.45 + 0.4 * Math.max(0, Math.sin(t * 1.8 + b.ph));
    ctx.globalAlpha = pulse;
    ctx.fillStyle = b.col;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = pulse * 0.9;
    ctx.strokeStyle = b.col;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3);
    // scrolling highlight line
    const ly = b.y + ((t * 26 + b.ph * 20) % b.h);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x, ly, b.w, 1.5);
  }

  // rooftop beacons (red blink)
  for (const bcn of SKY.beacons) {
    if (Math.sin(t * 2.6 + bcn.ph) > 0.2) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ff4455';
      ctx.beginPath(); ctx.arc(bcn.x, bcn.y, 2.6, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(bcn.x, bcn.y, 5.5, 0, 7); ctx.fill();
    }
  }
  ctx.restore();

  // searchlights sweeping the sky (drawn in world coords above the skyline)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < SKY.towers.length; i++) {
    const tw = SKY.towers[i];
    const ang = -Math.PI / 2 + Math.sin(t * 0.22 + tw.ph) * 0.55;
    const len = 560;
    const x0 = tw.x, y0 = H - 260 + tw.y;
    const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
    const wHalf = 34;
    const px = -Math.sin(ang), py = Math.cos(ang);
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(200,240,255,0.10)');
    grad.addColorStop(1, 'rgba(200,240,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x0 + px * 4, y0 + py * 4);
    ctx.lineTo(x1 + px * wHalf, y1 + py * wHalf);
    ctx.lineTo(x1 - px * wHalf, y1 - py * wHalf);
    ctx.lineTo(x0 - px * 4, y0 - py * 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function drawSetPiece(ctx, kind) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  switch (kind) {
    case 'planet': {
      const px = W - 210, py = 240, r = 130;
      const g = ctx.createRadialGradient(px - 40, py - 40, 20, px, py, r);
      g.addColorStop(0, '#2a3f7a'); g.addColorStop(1, '#0a1030');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(120,180,255,0.5)'; ctx.lineWidth = 5;
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.5); ctx.scale(1, 0.28);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.65, 0, 7); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'fleet': {
      for (let i = 0; i < 3; i++) {
        const fx = 140 + i * 190 + Math.sin(t * 0.14 + i) * 16;
        const fy = 180 + i * 66;
        ctx.fillStyle = 'rgba(60,16,26,0.9)';
        ctx.beginPath();
        ctx.moveTo(fx - 70, fy); ctx.lineTo(fx + 70, fy - 12);
        ctx.lineTo(fx + 92, fy + 12); ctx.lineTo(fx - 40, fy + 22);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,90,90,0.8)';
        ctx.fillRect(fx + 60, fy - 4, 10, 4);
      }
      break;
    }
    case 'gate': {
      const gx = W / 2, gy = 210;
      ctx.strokeStyle = 'rgba(150,90,255,0.6)';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(gx, gy, 300, 110, 0.15, 0, 7); ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(190,140,255,0.8)';
      ctx.beginPath(); ctx.ellipse(gx, gy, 300, 110, 0.15, t * 0.4, t * 0.4 + 2.4); ctx.stroke();
      break;
    }
    case 'suns': {
      for (const [sx, sy, col] of [[W - 260, 240, '255,200,80'], [W - 130, 150, '255,120,60']]) {
        const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
        g.addColorStop(0, `rgba(${col},0.9)`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(sx - 110, sy - 110, 220, 220);
      }
      break;
    }
    case 'hole': {
      const bx = 260, by = 260;
      const g = ctx.createRadialGradient(bx, by, 30, bx, by, 200);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.5, 'rgba(20,80,60,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - 200, by - 200, 400, 400);
      ctx.strokeStyle = 'rgba(60,255,170,0.5)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(bx, by, 120 + i * 44, 40 + i * 16, t * 0.3 + i, 0, 7);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}
