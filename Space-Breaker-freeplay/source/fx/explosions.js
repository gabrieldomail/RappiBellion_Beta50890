// explosions.js — BIG juice: multi-ring shockwaves, light pools, elastic debris,
// boss chain deaths, medal showers. "This is cyberpunk war, don't hold back."
import { burst, spawn as pSpawn, popup } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { flash, aberration, glitch } from '../engine/postfx.js';
import { addShake } from './camera.js';
import { emit } from '../engine/bus.js';
import { rand } from '../engine/rand.js';

const rings = [];      // {x,y,r,vr,maxR,col,w}
const lights = [];     // {x,y,r,col,t,life} — additive light pools
const chains = [];     // {x,y,w,h,t,dur,n,done,cb}

export function shockRing(x, y, col = '#8ff', maxR = 240, w = 7) {
  rings.push({ x, y, r: 8, vr: maxR / 0.4, maxR, col, w });
}

function lightPool(x, y, r, col, life = 0.45) {
  if (lights.length > 10) lights.shift();
  lights.push({ x, y, r, col, t: 0, life });
}

export function explSmall(x, y, col = '#ffd23f') {
  burst(x, y, 26, { col: [col, '#fff', '#ff9a2a'], spd: 360, life: 0.65, size: 7 });
  burst(x, y, 6, { col: '#558', spd: 70, life: 1.0, size: 20, type: 'smoke' });
  burst(x, y, 4, { col, spd: 280, life: 0.9, size: 5, type: 'debris', grav: 520, vr: 10 });
  shockRing(x, y, col, 130);
  shockRing(x, y, '#fff', 70, 4);
  lightPool(x, y, 150, col, 0.32);
  flash(255, 210, 130, 0.07);
  aberration(0.28);
  addShake(0.16);
  sfx.explSmall();
}

export function explBig(x, y, col = '#ffd23f') {
  burst(x, y, 56, { col: [col, '#fff', '#ff5c2a', '#ffe9c9'], spd: 620, life: 0.95, size: 9 });
  burst(x, y, 16, { col: '#558', spd: 90, life: 1.6, size: 30, type: 'smoke' });
  burst(x, y, 14, { col, spd: 380, life: 1.3, size: 6, type: 'debris', grav: 560, vr: 12 });
  shockRing(x, y, col, 300);
  shockRing(x, y, '#fff', 150, 5);
  shockRing(x, y, col, 460, 4);
  lightPool(x, y, 320, col, 0.55);
  flash(255, 190, 110, 0.22);
  aberration(0.55);
  addShake(0.42);
  sfx.explBig();
}

export function explPlayer(x, y) {
  burst(x, y, 84, { col: ['#7df4ff', '#fff', '#3ef0ff', '#ffd23f'], spd: 640, life: 1.2, size: 9 });
  burst(x, y, 16, { col: '#558', spd: 80, life: 2.0, size: 34, type: 'smoke' });
  burst(x, y, 16, { col: '#7df4ff', spd: 420, life: 1.4, size: 6, type: 'debris', grav: 500, vr: 12 });
  shockRing(x, y, '#7df4ff', 440);
  shockRing(x, y, '#fff', 220, 5);
  shockRing(x, y, '#3ef0ff', 620, 4);
  lightPool(x, y, 420, '#3ef0ff', 0.8);
  flash(120, 220, 255, 0.4);
  aberration(0.8);
  glitch(0.14, 0.7);
}

// sequential explosion sweep over a rect (boss death)
export function bossChain(x, y, w, h, dur, cb) {
  chains.push({ x, y, w, h, t: 0, dur, n: 0, done: false, cb });
}

export function medalShower(x, y, n) {
  for (let i = 0; i < n; i++) {
    popup(x + rand(-70, 70), y + rand(-40, 40), '★', '#ffe27a', 34);
  }
}

export function updateFx(dt) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.r += r.vr * dt;
    r.vr *= Math.pow(0.2, dt);
    if (r.r >= r.maxR) rings.splice(i, 1);
  }
  for (let i = lights.length - 1; i >= 0; i--) {
    const l = lights[i];
    l.t += dt;
    if (l.t >= l.life) lights.splice(i, 1);
  }
  for (let i = chains.length - 1; i >= 0; i--) {
    const c = chains[i];
    c.t += dt;
    const want = Math.floor((c.t / c.dur) * 20);
    while (c.n < want && c.n < 20) {
      c.n++;
      const ex = c.x + rand(-c.w / 2, c.w / 2);
      const ey = c.y + rand(-c.h / 2, c.h / 2);
      explBig(ex, ey, rand() < 0.5 ? '#ffd23f' : '#ff6be0');
      addShake(0.26);
    }
    if (c.t >= c.dur && !c.done) {
      c.done = true;
      flash(255, 255, 255, 0.6);
      aberration(1);
      glitch(0.2, 1);
      shockRing(c.x, c.y, '#fff', 800, 9);
      shockRing(c.x, c.y, '#ffd23f', 560, 6);
      lightPool(c.x, c.y, 640, '#ffd23f', 0.9);
      sfx.bossExpl();
      chains.splice(i, 1);
      if (c.cb) c.cb();
    }
  }
}

export function drawFx(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  // light pools (soft additive radial glow)
  for (const l of lights) {
    const k = 1 - l.t / l.life;
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    g.addColorStop(0, `rgba(255,255,255,${0.30 * k})`);
    g.addColorStop(0.45, hexA(l.col, 0.22 * k));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r, 0, 7);
    ctx.fill();
  }
  // shock rings + inner glow disc
  for (const r of rings) {
    const k = 1 - r.r / r.maxR;
    ctx.globalAlpha = Math.max(0, k * 0.95);
    ctx.strokeStyle = r.col;
    ctx.lineWidth = r.w * k + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 7);
    ctx.stroke();
    if (k > 0.55) {
      ctx.globalAlpha = (k - 0.55) * 0.4;
      const g = ctx.createRadialGradient(r.x, r.y, 2, r.x, r.y, r.r);
      g.addColorStop(0, hexA(r.col, 0.5));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// '#rrggbb' -> rgba with alpha
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16) || 255;
  const g = parseInt(hex.slice(3, 5), 16) || 255;
  const b = parseInt(hex.slice(5, 7), 16) || 255;
  return `rgba(${r},${g},${b},${a})`;
}
