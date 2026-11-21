// enemies.js — bezier choreography (entries/dives) + 9 archetypes with distinct AI
import { W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { burst } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { eShot, eAimed, eBeam } from './bullets.js';
import { slotPos, slotBase } from './formation.js';
import { Pl } from './player.js';
import { applyScore, killMeter } from './combo.js';
import { dropPowerup } from './powerups.js';
import { addScore, S } from './state.js';
import { emit } from '../engine/bus.js';
import { explSmall, explBig } from '../fx/explosions.js';
import { addShake, hitstop } from '../fx/camera.js';
import { rand, pick, chance, TAU, angleTo, clamp } from '../engine/rand.js';

export const foes = [];

// ---- archetype table (score: [formation, diving]) ----
export const DEFS = {
  drone:   { name: 'DRONE',    hp: 1, r: 26, spr: 'bee',       col: '#ffe14f', score: [50, 100],   dive: true,  pathSpd: 430, fireCd: 2.6 },
  fighter: { name: 'SWIFT',    hp: 1, r: 26, spr: 'butterfly', col: '#ff5c5c', score: [80, 160],   dive: true,  pathSpd: 490, fireCd: 2.2 },
  elite:   { name: 'ELITE',    hp: 2, r: 30, spr: 'elite',     col: '#b26bff', score: [150, 400],  dive: true,  pathSpd: 450, fireCd: 1.9 },
  spinner: { name: 'SPINNER',  hp: 2, r: 26, spr: 'spinner',   col: '#3ef0d0', score: [200, 200],  dive: false, hold: true,  life: 13, pathSpd: 420 },
  sniper:  { name: 'LANCER',   hp: 2, r: 26, spr: 'sniper',    col: '#b06bff', score: [300, 300],  dive: false, hold: true,  life: 15, pathSpd: 460 },
  bomber:  { name: 'BASTION',  hp: 5, r: 34, spr: 'bomber',    col: '#ffb020', score: [500, 500],  dive: false, drift: true, pathSpd: 120, fireCd: 2.0 },
  turret:  { name: 'SENTRY',   hp: 3, r: 28, spr: 'turret',    col: '#ff7733', score: [300, 300],  dive: false, hold: true,  life: 12, pathSpd: 300 },
  mine:    { name: 'VOLTAIC',  hp: 1, r: 22, spr: 'mine',      col: '#ff4fd8', score: [100, 100],  dive: false, drift: true, pathSpd: 90 },
  carrier: { name: 'MIDAS',    hp: 3, r: 34, spr: 'carrier',   col: '#ffd94a', score: [300, 300],  dive: false, cross: true, pathSpd: 230 },
};

// ---------------- bezier path kit ----------------
function bezXY(p0, c1, c2, p1, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0[0] + 3 * mt * mt * t * c1[0] + 3 * mt * t * t * c2[0] + t * t * t * p1[0],
    y: mt * mt * mt * p0[1] + 3 * mt * mt * t * c1[1] + 3 * mt * t * t * c2[1] + t * t * t * p1[1],
  };
}
export function makePath(segs) {
  let len = 0;
  for (const s of segs) {
    len += Math.hypot(s.p1[0] - s.p0[0], s.p1[1] - s.p0[1]) * 1.12;
  }
  return {
    segs, len, d: 0,
    at(dd) {
      const t = clamp(dd / len, 0, 1) * segs.length;
      const i = Math.min(segs.length - 1, t | 0);
      const lt = t - i;
      const s = segs[i];
      const a = bezXY(s.p0, s.c1, s.c2, s.p1, lt);
      const b = bezXY(s.p0, s.c1, s.c2, s.p1, Math.min(1, lt + 0.03));
      return { x: a.x, y: a.y, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    },
  };
}

// full-circle-ish loop around (cx,cy) starting at angle a0 (2 segments)
function loopSegs(cx, cy, r, a0) {
  const p = (a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const c = (a, k) => [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  const K = 1.36;
  const a1 = a0 + Math.PI * 0.98, a2 = a0 - Math.PI * 0.04;
  return [
    { p0: p(a0), c1: c(a0 + 1.1, K), c2: c(a1 - 1.1, K), p1: p(a1) },
    { p0: p(a1), c1: c(a1 + 1.1, K), c2: c(a2 + 1.1, K), p1: p(a2) },
  ];
}

// entry choreographies ending at (tx,ty)
export function genEntry(kind, tx, ty) {
  switch (kind) {
    case 'swoopL': {
      const segs = [
        { p0: [-120, 240], c1: [220, 160], c2: [420, 300], p1: [500, 560] },
        ...loopSegs(560, 400, 150, Math.PI * 0.5),
        { p0: [560, 550], c1: [540, 700], c2: [tx + 60, ty - 60], p1: [tx, ty] },
      ];
      return makePath(segs);
    }
    case 'swoopR': {
      const segs = [
        { p0: [W + 120, 240], c1: [W - 220, 160], c2: [W - 420, 300], p1: [W - 500, 560] },
        ...loopSegs(W - 560, 400, 150, Math.PI * 0.5),
        { p0: [W - 560, 550], c1: [W - 540, 700], c2: [tx - 60, ty - 60], p1: [tx, ty] },
      ];
      return makePath(segs);
    }
    case 'split': {
      const segs = [
        { p0: [W / 2, -120], c1: [W / 2 - 260, 200], c2: [tx + 300, ty - 160], p1: [tx + 140, ty + 40] },
        ...loopSegs(tx + 60, ty - 120, 90, Math.PI * 0.9),
        { p0: [tx - 30, ty - 190], c1: [tx - 90, ty - 60], c2: [tx - 20, ty - 20], p1: [tx, ty] },
      ];
      return makePath(segs);
    }
    case 'sideL': {
      return makePath([
        { p0: [-120, 900], c1: [240, 860], c2: [520, 720], p1: [640, 480] },
        { p0: [640, 480], c1: [700, 300], c2: [tx + 160, ty - 160], p1: [tx, ty] },
      ]);
    }
    case 'sideR': {
      return makePath([
        { p0: [W + 120, 900], c1: [W - 240, 860], c2: [W - 520, 720], p1: [W - 640, 480] },
        { p0: [W - 640, 480], c1: [W - 700, 300], c2: [tx - 160, ty - 160], p1: [tx, ty] },
      ]);
    }
    case 'topC': {
      return makePath([
        { p0: [tx + rand(-160, 160), -100], c1: [tx + 220, 260], c2: [tx - 220, 200], p1: [tx, ty] },
      ]);
    }
    default: {
      return makePath([{ p0: [tx, -100], c1: [tx, 300], c2: [tx, ty - 100], p1: [tx, ty] }]);
    }
  }
}

// dive choreographies: 5 classic styles (loop / straight / slant / squiggle / circle)
export function genDive(x, y, style, targetX, diff) {
  const tx = clamp(targetX + rand(-140, 140), 80, W - 80);
  switch (style) {
    case 'loop': {
      const segs = [
        ...loopSegs(x, y + 130, 110, -Math.PI * 0.5),
        { p0: [x, y + 240], c1: [x + rand(-180, 180), y + 500], c2: [tx, y + 700], p1: [tx, H + 160] },
      ];
      segs[2].p0 = segs[1].p1.slice(); // chain from where the loop ends
      return makePath(segs);
    }
    case 'straight':
      return makePath([{ p0: [x, y], c1: [x, y + 400], c2: [tx, y + 700], p1: [tx, H + 160] }]);
    case 'slant':
      return makePath([
        { p0: [x, y], c1: [x - 260, y + 300], c2: [tx - 160, y + 600], p1: [tx, H + 160] },
      ]);
    case 'squiggle': {
      const dir = chance(0.5) ? 1 : -1;
      return makePath([
        { p0: [x, y], c1: [x + 190 * dir, y + 130], c2: [x + 130 * dir, y + 330], p1: [x, y + 430] },
        { p0: [x, y + 430], c1: [x - 170 * dir, y + 560], c2: [tx - 60, y + 760], p1: [tx, H + 160] },
      ]);
    }
    case 'circle': {
      return makePath([
        ...loopSegs(x + 60, y + 180, 130, Math.PI * 1.2),
        { p0: [x + 60, y + 310], c1: [tx, y + 500], c2: [tx + 60, y + 750], p1: [tx, H + 160] },
      ]);
    }
    default:
      return makePath([{ p0: [x, y], c1: [x, y + 300], c2: [tx, y + 600], p1: [tx, H + 160] }]);
  }
}

// ---------------- spawn / lifecycle ----------------
export function spawnFoe(type, entry = 'swoopL', slot = null, diff = 1, opts = {}) {
  const def = DEFS[type];
  const e = {
    type, def, slot, diff,
    hp: def.hp + (diff > 2.2 && def.hp > 1 ? 1 : 0),
    x: 0, y: 0, rot: 0, t: 0, hitFlash: 0,
    state: 'path', path: null, d: 0,
    fireT: rand(0.6, def.fireCd || 3) / diff,
    hold: opts.hold || null, dir: opts.dir || 1,
    attacks: 0, beamArmed: false, aimAng: Math.PI / 2,
    dead: false, wobP: rand(0, TAU),
    sprFlip: 1,
    popT: 0,                 // hit pop (decays)
  };
  if (def.cross) {
    e.x = e.dir > 0 ? -90 : W + 90;
    e.y = rand(360, 560);
    e.state = 'cross';
  } else if (def.drift) {
    e.x = opts.x ?? rand(120, W - 120);
    e.y = opts.y ?? -60;
    e.state = 'drift';
  } else if (def.hold) {
    e.hold = e.hold || { x: opts.holdX ?? rand(200, W - 200), y: opts.holdY ?? rand(380, 660) };
    e.path = genEntry(entry, e.hold.x, e.hold.y);
    e.state = 'path';
  } else if (slot) {
    const b = slotBase(slot.col, slot.row);
    e.path = genEntry(entry, b.x, b.y);
    e.state = 'path';
  } else if (opts.pathTo) {
    // challenge train: fly a choreography then pass through and exit
    e.passThrough = true;
    e.path = genEntry(entry, opts.pathTo[0], opts.pathTo[1]);
    e.state = 'path';
  } else {
    e.x = opts.x ?? W / 2; e.y = -60; e.state = 'drift';
  }
  foes.push(e);
  return e;
}

export function aliveCount() {
  let n = 0;
  for (const f of foes) if (!f.dead) n++;
  return n;
}
export function clearFoes() { foes.length = 0; }

export function damageFoe(e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.hitFlash = 0.09;
  e.popT = 0.16;
  if (e.hp <= 0) killFoe(e, true);
  else sfx.hit();
}

export function killFoe(e, byPlayer = true) {
  if (e.dead) return;
  e.dead = true;
  const i = foes.indexOf(e);
  if (i >= 0) foes.splice(i, 1);

  const big = e.def.hp >= 3;
  if (big) { explBig(e.x, e.y, e.def.col); addShake(0.34); hitstop(0.03); }
  else explSmall(e.x, e.y, e.def.col);

  if (e.type === 'mine') {
    for (let k = 0; k < 8; k++) eShot(e.x, e.y, k * TAU / 8 + 0.2, 240 * (0.8 + e.diff * 0.1));
  }
  if (byPlayer) {
    const diving = e.state === 'dive' || e.state === 'drift' || e.state === 'cross';
    const base = e.def.score[diving ? 1 : 0];
    const gained = applyScore(base, e.x, e.y);
    killMeter(e.def.hp >= 2 ? 5 : 2.5);
    emit('kill', { foe: e, score: gained });
    // drops
    if (e.type === 'carrier') dropPowerup(e.x, e.y, true);
    else if (e.type === 'elite' && chance(0.22)) dropPowerup(e.x, e.y);
    else if (e.type === 'bomber' && chance(0.3)) dropPowerup(e.x, e.y);
  }
}

// director calls this periodically: pick formation divers
export function diveTick(n, diff) {
  const cands = foes.filter((f) => f.state === 'form' && f.def.dive);
  for (let k = 0; k < n && cands.length; k++) {
    const e = pick(cands);
    cands.splice(cands.indexOf(e), 1);
    const style = pick(['loop', 'straight', 'slant', 'squiggle', 'circle']);
    e.path = genDive(e.x, e.y, style, Pl.x, diff);
    e.state = 'dive';
    e.fireT = rand(0.25, 0.6);
    e.diveShots = e.type === 'elite' ? 3 : (e.type === 'fighter' ? 2 : 1);
  }
}

// ---------------- per-frame update ----------------
export function updateFoes(dt) {
  for (let i = foes.length - 1; i >= 0; i--) {
    const e = foes[i];
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;

    if (e.state === 'path') {
      e.d += e.def.pathSpd * (0.85 + e.diff * 0.16) * dt;
      const p = e.path.at(e.d);
      e.x = p.x; e.y = p.y; e.rot = p.ang - Math.PI / 2;
      if (e.d >= e.path.len) {
        if (e.passThrough) {
          e.path = genDive(e.x, e.y, pick(['straight', 'slant', 'squiggle']), Pl.x, e.diff);
          e.state = 'dive';
          e.diveShots = 0;
        } else if (e.def.hold) e.state = 'hover';
        else e.state = 'form';
        if (e.state !== 'dive') e.rot = 0;
      }
    } else if (e.state === 'form') {
      const t = slotPos(e.slot.col, e.slot.row);
      e.x += (t.x - e.x) * Math.min(1, dt * 5);
      e.y += (t.y - e.y) * Math.min(1, dt * 5);
      e.rot *= Math.pow(0.001, dt);
      // occasional pot-shot from formation
      e.fireT -= dt;
      if (e.fireT <= 0 && S.mode === 'playing') {
        e.fireT = (e.def.fireCd * rand(1.2, 2.4)) / e.diff;
        if (e.type === 'elite') {
          const a = angleTo(e.x, e.y, Pl.x, Pl.y);
          for (let k = -1; k <= 1; k++) eShot(e.x, e.y, a + k * 0.22, 330 * (0.8 + e.diff * 0.1));
        } else if (chance(0.6)) {
          eAimed(e.x, e.y, Pl.x, Pl.y, 300 * (0.8 + e.diff * 0.12));
        }
      }
    } else if (e.state === 'hover') {
      e.x += (e.hold.x - e.x) * Math.min(1, dt * 2.4) + Math.sin(e.t * 2.1 + e.wobP) * 26 * dt;
      e.y += (e.hold.y - e.y) * Math.min(1, dt * 2.4) + Math.cos(e.t * 1.7 + e.wobP) * 18 * dt;
      e.rot = Math.sin(e.t * 1.4 + e.wobP) * 0.14;
      hoverAttack(e, dt);
      if (e.def.life && e.t > e.def.life + e.path.len / e.def.pathSpd) e.state = 'leave';
    } else if (e.state === 'dive') {
      e.d += e.def.pathSpd * 1.35 * (0.85 + e.diff * 0.16) * dt;
      const p = e.path.at(e.d);
      e.x = p.x; e.y = p.y; e.rot = p.ang - Math.PI / 2;
      e.fireT -= dt;
      if (e.fireT <= 0 && e.diveShots > 0 && S.mode === 'playing') {
        e.diveShots--;
        e.fireT = 0.34;
        eAimed(e.x, e.y, Pl.x, Pl.y, 360 * (0.85 + e.diff * 0.12), 'ball');
      }
      if (e.d >= e.path.len) {
        if (!e.slot) { foes.splice(i, 1); continue; } // pass-through divers exit for good
        // wrap: re-enter from top and return to slot (classic Galaga)
        const b = slotBase(e.slot.col, e.slot.row);
        e.x = b.x + rand(-60, 60); e.y = -80; e.rot = 0;
        e.state = 'return';
      }
    } else if (e.state === 'return') {
      const t = slotPos(e.slot.col, e.slot.row);
      e.x += (t.x - e.x) * Math.min(1, dt * 3);
      e.y += (t.y - e.y) * Math.min(1, dt * 3);
      if (Math.abs(e.y - t.y) < 8) e.state = 'form';
    } else if (e.state === 'leave') {
      e.y -= (300 + e.t * 40) * dt;
      e.rot = Math.PI; // flip and depart
      if (e.y < -120) foes.splice(i, 1);
    } else if (e.state === 'drift') {
      const spd = e.type === 'mine' ? 95 + e.diff * 14 : e.def.pathSpd;
      e.y += spd * dt;
      e.x += Math.sin(e.t * 1.5 + e.wobP) * (e.type === 'mine' ? 70 : 30) * dt;
      if (e.type === 'bomber') {
        e.fireT -= dt;
        if (e.fireT <= 0 && S.mode === 'playing') {
          e.fireT = (e.def.fireCd * rand(0.9, 1.4)) / e.diff;
          const a = angleTo(e.x, e.y, Pl.x, Pl.y);
          for (let k = -1; k <= 1; k++) eShot(e.x, e.y, a + k * 0.3, 300, 'bolt');
        }
      }
      if (e.y > H + 100) foes.splice(i, 1);
    } else if (e.state === 'cross') {
      e.x += e.def.pathSpd * e.dir * dt;
      e.y += Math.sin(e.t * 1.3 + e.wobP) * 30 * dt;
      e.rot = e.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      if (e.x < -140 || e.x > W + 140) foes.splice(i, 1);
    }
  }
}

function hoverAttack(e, dt) {
  if (S.mode !== 'playing') return;
  if (e.type === 'spinner') {
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = 2.3 / e.diff;
      const a0 = e.t * 2.4;
      for (let k = 0; k < 4; k++) eShot(e.x, e.y, a0 + k * TAU / 4, 250 + e.diff * 22);
      for (let k = 0; k < 4; k++) eShot(e.x, e.y, a0 + 0.4 + k * TAU / 4, 250 + e.diff * 22);
    }
  } else if (e.type === 'sniper') {
    if (!e.beamArmed) {
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.beamArmed = true;
        e.aimAng = angleTo(e.x, e.y, Pl.x, Pl.y);
        eBeam(e.x, e.y, e.aimAng, '#c76bff', 0.75, 0.4, 1900, 22, e);
        e.attacks++;
        e.fireT = 2.4 / e.diff;
      }
    }
    if (e.attacks >= 3) e.state = 'leave';
  } else if (e.type === 'turret') {
    e.x += Math.sin(e.t * 0.8 + e.wobP) * 90 * dt;
    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = 2.1 / e.diff;
      const a = angleTo(e.x, e.y, Pl.x, Pl.y);
      for (let k = -1; k <= 1; k++) eShot(e.x, e.y, a + k * 0.26, 340, 'bolt');
    }
  }
}

// ---------------- draw ----------------
function easeOutBack(k) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}

export function drawFoes(ctx) {
  for (const e of foes) {
    if (e.popT > 0) e.popT = Math.max(0, e.popT - 0.016);
    const spr = Spr[e.def.spr];
    // elastic spawn pop + wing flap + idle breathing
    const spawnK = Math.min(1, e.t / 0.3);
    const popS = spawnK < 1 ? 0.35 + 0.65 * easeOutBack(spawnK) : 1;
    const flap = (e.type === 'drone' || e.type === 'fighter') ? 1 + 0.045 * Math.sin(e.t * 9 + e.wobP) : 1;
    const breathe = 1 + 0.05 * Math.sin(e.t * 2.6 + e.wobP);   // 5% scale pulse (dynamic-camera feel)
    // hit pop + dive stretch (speed squash)
    const hitPop = e.popT > 0 ? 1 + 0.22 * (e.popT / 0.16) : 1;
    const diving = e.state === 'dive';
    const sx = popS * flap * breathe * hitPop * (diving ? 0.9 : 1);
    const sy = popS * flap * breathe * hitPop * (diving ? 1.14 : 1);
    const jx = e.popT > 0 ? (Math.random() - 0.5) * 4 : 0;
    ctx.save();
    ctx.translate(e.x + jx, e.y);
    ctx.scale(sx, sy);
    blit(ctx, spr, 0, 0, e.rot);
    if (e.hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = e.hitFlash * 8;
      blit(ctx, spr, 0, 0, e.rot);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    // sniper aiming reticle
    if (e.type === 'sniper' && e.beamArmed) {
      // beam telegraph handled by bullets.beams
    }
  }
}
