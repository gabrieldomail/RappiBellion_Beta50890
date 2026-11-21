// bullets.js — player shots / homing missiles, enemy shots, telegraphed beams
import { wctx } from '../engine/renderer.js';
import { W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { spawn as pSpawn, burst } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { angleTo, clamp } from '../engine/rand.js';

export const shots = [];    // player: {x,y,vx,vy,dmg,kind:'bolt'|'missile',t,target?,turn}
export const eshots = [];   // enemy: {x,y,vx,vy,r,kind:'ball'|'bolt'|'orb'|'wave',ph,grazed,hue}
export const beams = [];    // {x,y,ang,len,w,warnT,fireT,t,hue,owner}

// provider set by main: () => nearest foe/boss-part position for homing (or null)
let targetProvider = null;
export function setTargetProvider(fn) { targetProvider = fn; }

export function clearBullets() {
  shots.length = 0; eshots.length = 0; beams.length = 0;
}

// ---- player fire ----
export function fireBolt(x, y, vx, vy, dmg = 1) {
  shots.push({ x, y, vx, vy, dmg, kind: 'bolt', t: 0 });
}
export function fireMissile(x, y, side) {
  // Itano launch: pop out sideways-down, then hunt
  shots.push({
    x, y, vx: side * 320, vy: 160, dmg: 3, kind: 'missile', t: 0,
    target: null, turn: 7.5, spd: 780, trailT: 0,
  });
  sfx.laserBig();
}

// ---- enemy fire ----
export function eShot(x, y, ang, spd, kind = 'ball') {
  if (eshots.length > 220) return;
  eshots.push({
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
    r: kind === 'orb' ? 16 : 9, kind, ph: Math.random() * 6.28, grazed: false,
  });
  sfx.enemyShot();
}
export function eAimed(x, y, tx, ty, spd, kind = 'ball') {
  eShot(x, y, angleTo(x, y, tx, ty), spd, kind);
}
export function eBeam(x, y, ang, hue = '#ff5c5c', warnT = 0.7, fireT = 0.45, len = 1900, w = 26, owner = null) {
  beams.push({ x, y, ang, len, w, warnT, fireT, t: 0, hue, owner });
  sfx.beamCharge(warnT);
}

export function enemyBulletSweep() {
  // convert all live enemy shots to sparkle medals (bomb / stage end)
  for (const b of eshots) {
    burst(b.x, b.y, 3, { col: '#ffd23f', spd: 120, life: 0.4, size: 4 });
  }
  eshots.length = 0;
  for (const bm of beams) if (bm.owner) bm.owner.beamArmed = false;
  beams.length = 0;
}

export function updateBullets(dt) {
  const t0 = targetProvider ? targetProvider : null;

  // player shots
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.t += dt;
    if (s.kind === 'missile') {
      // acquire target
      if (!s.target || s.target.dead || s.target.hp <= 0) {
        s.target = t0 ? t0(s.x, s.y) : null;
      }
      const spd = Math.min(s.spd, 320 + s.t * 1500);
      let ang = Math.atan2(s.vy, s.vx);
      if (s.t > 0.12 && s.target) {
        const want = angleTo(s.x, s.y, s.target.x, s.target.y);
        let d = want - ang;
        while (d > Math.PI) d -= 6.28318;
        while (d < -Math.PI) d += 6.28318;
        ang += clamp(d, -s.turn * dt, s.turn * dt);
      } else if (s.t <= 0.12) {
        // launch flourish: pitch up toward the sky before hunting
        const UP = -Math.PI / 2;
        let d = UP - ang;
        while (d > Math.PI) d -= 6.28318;
        while (d < -Math.PI) d += 6.28318;
        ang += clamp(d, -12 * dt, 12 * dt);
      }
      s.vx = Math.cos(ang) * spd; s.vy = Math.sin(ang) * spd;
      s.trailT -= dt;
      if (s.trailT <= 0) {
        s.trailT = 0.016;
        pSpawn({ x: s.x, y: s.y, vx: 0, vy: 40, life: 0.3, size: 9, col: '#8ef0ff', type: 'trail', shrink: 1, endSize: 1 });
      }
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y < -60 || s.y > H + 80 || s.x < -80 || s.x > W + 80) shots.splice(i, 1);
  }

  // enemy shots
  for (let i = eshots.length - 1; i >= 0; i--) {
    const b = eshots[i];
    if (b.kind === 'wave') b.ph += dt * 6;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.kind === 'wave') b.x += Math.sin(b.ph) * 60 * dt;
    if (b.y > H + 60 || b.y < -120 || b.x < -80 || b.x > W + 80) eshots.splice(i, 1);
  }

  // beams
  for (let i = beams.length - 1; i >= 0; i--) {
    const bm = beams[i];
    bm.t += dt;
    if (bm.t > bm.warnT + bm.fireT) {
      if (bm.owner) bm.owner.beamArmed = false;
      beams.splice(i, 1);
    } else if (bm.t > bm.warnT && Math.random() < 0.6) {
      // beam core sparks
      const d = Math.random() * bm.len;
      pSpawn({
        x: bm.x + Math.cos(bm.ang) * d, y: bm.y + Math.sin(bm.ang) * d,
        vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
        life: 0.25, size: 7, col: bm.hue, type: 'spark',
      });
    }
  }
}

export function drawBullets(ctx) {
  ctx.globalCompositeOperation = 'lighter';
  // player shots
  for (const s of shots) {
    if (s.kind === 'missile') {
      blit(ctx, Spr.missile, s.x, s.y, Math.atan2(s.vy, s.vx) + Math.PI / 2);
    } else {
      const ang = Math.atan2(s.vy, s.vx) + Math.PI / 2;
      blit(ctx, Spr.pShot, s.x, s.y, ang);
    }
  }
  // enemy shots
  for (const b of eshots) {
    if (b.kind === 'orb') blit(ctx, Spr.eOrb, b.x, b.y);
    else if (b.kind === 'bolt') blit(ctx, Spr.eBolt, b.x, b.y, Math.atan2(b.vy, b.vx) - Math.PI / 2);
    else blit(ctx, Spr.eBall, b.x, b.y, 0, 1 + 0.1 * Math.sin(b.ph * 3));
  }
  // beams
  for (const bm of beams) {
    const firing = bm.t > bm.warnT;
    ctx.save();
    ctx.translate(bm.x, bm.y);
    ctx.rotate(bm.ang);
    if (!firing) {
      // telegraph: dashed thin line + blinking origin
      const k = bm.t / bm.warnT;
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(bm.t * 22));
      ctx.strokeStyle = bm.hue; ctx.lineWidth = 2.5;
      ctx.setLineDash([16, 14]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len, 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = bm.hue;
      ctx.beginPath(); ctx.arc(0, 0, 8 + 8 * k, 0, 7); ctx.fill();
    } else {
      const k = 1 - (bm.t - bm.warnT) / bm.fireT;
      const w = bm.w * Math.min(1, k * 3);
      const g = ctx.createLinearGradient(0, -w, 0, w);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, bm.hue);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, -w, bm.len, w * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0, -w * 0.28, bm.len, w * 0.56);
    }
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}

// beam hit test: is point (px,py) within `pad` of any FIRING beam line?
export function beamHit(px, py, pad = 10) {
  for (const bm of beams) {
    if (bm.t <= bm.warnT) continue;
    const dx = Math.cos(bm.ang), dy = Math.sin(bm.ang);
    const rx = px - bm.x, ry = py - bm.y;
    const proj = rx * dx + ry * dy;
    if (proj < 0 || proj > bm.len) continue;
    const perp = Math.abs(rx * -dy + ry * dx);
    if (perp < bm.w * 0.5 + pad) return bm;
  }
  return null;
}
