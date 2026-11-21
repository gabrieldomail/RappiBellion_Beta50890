// particles.js — pooled particle system with baked glow-dot sprites per color
const TAU = Math.PI * 2;
const MAX = 3200;
let cap = MAX;
// adaptive-quality hook: lower the live budget on weak machines
export function setParticleCap(n) { cap = Math.max(200, Math.min(MAX, n | 0)); }

const pool = [];
const list = [];
const popups = [];

// color name -> 64px radial glow dot canvas
const dotCache = new Map();
function dot(col) {
  let c = dotCache.get(col);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, col);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  dotCache.set(col, c);
  return c;
}

export function spawn(o) {
  if (list.length >= cap) return null;
  const p = pool.pop() || {};
  p.x = o.x; p.y = o.y;
  p.vx = o.vx || 0; p.vy = o.vy || 0;
  p.life = p.maxLife = o.life || 0.6;
  p.size = o.size || 4;
  p.col = o.col || '#fff';
  p.type = o.type || 'spark';       // spark | smoke | debris | trail | glow | ring
  p.drag = o.drag ?? 0.9;
  p.grav = o.grav || 0;
  p.rot = o.rot || 0; p.vr = o.vr || 0;
  p.shrink = o.shrink ?? 1;
  p.endSize = o.endSize ?? 0;
  list.push(p);
  return p;
}

export function burst(x, y, n, o = {}) {
  const spd = o.spd || 260;
  for (let i = 0; i < n; i++) {
    const a = o.ang !== undefined ? o.ang + (Math.random() - 0.5) * (o.arc || TAU) : Math.random() * TAU;
    const v = spd * (0.3 + Math.random() * 0.9);
    spawn({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: (o.life || 0.7) * (0.5 + Math.random() * 0.8),
      size: (o.size || 5) * (0.6 + Math.random() * 0.9),
      col: Array.isArray(o.col) ? o.col[(Math.random() * o.col.length) | 0] : (o.col || '#fff'),
      type: o.type || 'spark',
      drag: o.drag ?? 0.9,
      grav: o.grav || 0,
      vr: (Math.random() - 0.5) * 8,
    });
  }
}

export function popup(x, y, txt, col = '#9ff', size = 40) {
  if (popups.length > 40) popups.shift();
  popups.push({ x, y, txt, col, size, t: 0, life: 0.9 });
}

export function updateParticles(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); pool.push(p); continue; }
    const dr = Math.pow(p.drag, dt * 60);
    p.vx *= dr; p.vy *= dr;
    p.vy += p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    const t = popups[i];
    t.t += dt;
    t.y -= dt * 60;
    if (t.t >= t.life) popups.splice(i, 1);
  }
}

export function drawParticles(ctx) {
  // pass 1: smoke (normal blending)
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.type !== 'smoke') continue;
    const k = p.life / p.maxLife;
    const s = p.size * (0.6 + (1 - k) * 0.9);
    ctx.globalAlpha = 0.16 * k;
    const img = dot('#334');
    ctx.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
  }
  // pass 2: additive glows
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.type === 'smoke') continue;
    const k = p.life / p.maxLife;
    let s = p.size;
    if (p.shrink) s = p.endSize + (p.size - p.endSize) * k;
    ctx.globalAlpha = Math.min(1, k * 1.4);
    const img = dot(p.col);
    if (p.type === 'debris') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      ctx.globalAlpha = k;
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 0.7);
      ctx.restore();
    } else {
      ctx.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function drawPopups(ctx) {
  for (let i = 0; i < popups.length; i++) {
    const t = popups[i];
    const k = 1 - t.t / t.life;
    // elastic pop-in during the first frames (scale overshoot)
    const popIn = 1 + 0.85 * Math.pow(Math.max(0, 1 - t.t / 0.14), 2);
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.font = `700 ${Math.round(t.size * popIn)}px Orbitron, 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.shadowColor = t.col; ctx.shadowBlur = 12;
    ctx.fillStyle = t.col;
    ctx.fillText(t.txt, t.x, t.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

export function count() { return list.length; }
export function clearParticles() {
  while (list.length) pool.push(list.pop());
  popups.length = 0;
}
