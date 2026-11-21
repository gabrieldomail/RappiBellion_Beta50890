// powerups.js — falling capsules (W/S/M/B), magnet pickup, effects + toasts
import { wctx, W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { burst } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { Pl } from './player.js';
import { S, addScore } from './state.js';
import { emit } from '../engine/bus.js';
import { dist2 } from '../engine/rand.js';

export const drops = [];

const KIND_SPR = { W: 'capW', S: 'capS', M: 'capM', B: 'capB' };
const KIND_W = [['W', 0.42], ['S', 0.26], ['M', 0.10], ['B', 0.22]];

export function dropPowerup(x, y, guaranteed = false) {
  let kind;
  if (guaranteed) {
    kind = S.weaponTier >= 5 ? 'S' : 'W';
  } else {
    let r = Math.random(), acc = 0;
    kind = 'W';
    for (const [k, p] of KIND_W) { acc += p; if (r <= acc) { kind = k; break; } }
  }
  drops.push({ x, y, kind, t: 0, vy: 210 });
}

export function updatePowerups(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    d.y += d.vy * dt;
    d.x += Math.sin(d.t * 3) * 46 * dt;
    // magnet
    if (!Pl.hidden) {
      const d2 = dist2(d.x, d.y, Pl.x, Pl.y);
      if (d2 < 130 * 130) {
        const k = Math.min(1, dt * 6);
        d.x += (Pl.x - d.x) * k;
        d.y += (Pl.y - d.y) * k;
      }
      if (d2 < 44 * 44) {
        applyPowerup(d.kind);
        burst(d.x, d.y, 14, { col: '#bffbff', spd: 200, life: 0.5 });
        drops.splice(i, 1);
        continue;
      }
    }
    if (d.y > H + 60) drops.splice(i, 1);
  }
}

export function applyPowerup(kind) {
  sfx.pickup();
  if (kind === 'W') {
    if (S.weaponTier < 5) { S.weaponTier++; emit('toast', 'WEAPON UP  LV' + S.weaponTier); }
    else { addScore(1000); emit('toast', '+1000 MAX WEAPON'); }
  } else if (kind === 'S') {
    if (Pl.shield < 2) { Pl.shield++; emit('toast', 'SHIELD +1'); }
    else { addScore(800); emit('toast', '+800'); }
  } else if (kind === 'M') {
    if (S.lives < 6) { S.lives++; sfx.oneUp(); emit('toast', '1UP!'); }
    else { addScore(2000); emit('toast', '+2000'); }
  } else if (kind === 'B') {
    emit('toast', 'PULSE BOMB');
    emit('bomb');
  }
}

export function drawPowerups(ctx) {
  for (const d of drops) {
    const pulse = 1 + 0.08 * Math.sin(d.t * 8);
    blit(ctx, Spr[KIND_SPR[d.kind]], d.x, d.y, 0, pulse);
  }
}
