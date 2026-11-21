// player.js — the fighter: movement, dash i-frames, shield, respawn warp
import { W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { In } from '../engine/input.js';
import { spawn as pSpawn } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { S } from './state.js';
import { emit } from '../engine/bus.js';
import { explPlayer } from '../fx/explosions.js';
import { Combo } from './combo.js';
import { clamp, rand } from '../engine/rand.js';

export const Pl = {
  x: W / 2, y: H - 160,
  r: 20,                 // bullet-hell sized hitbox (visual is bigger)
  alive: true,
  hidden: false,         // dead & waiting respawn
  invuln: 0,
  respawnT: 0,
  dashT: 0, dashCd: 0, dashDir: 0,
  rollT: 0, rollDur: 0.30, rollDir: 1,   // barrel roll 360° on dash
  shield: 0,
  vx: 0,
  flameT: 0,
  warpT: 0,
};

export function resetPlayer(full) {
  Pl.x = W / 2; Pl.y = H - 160;
  Pl.alive = true; Pl.hidden = false;
  Pl.invuln = 2.2; Pl.dashT = 0; Pl.dashCd = 0;
  Pl.vx = 0; Pl.warpT = 0.6;
  if (full) { Pl.shield = 0; }
}

export function updatePlayer(dt) {
  if (Pl.hidden) {
    Pl.respawnT -= dt;
    if (Pl.respawnT <= 0) {
      resetPlayer(false);
      emit('playerRespawn');
    }
    return;
  }
  if (Pl.invuln > 0) Pl.invuln -= dt;
  if (Pl.warpT > 0) Pl.warpT -= dt;
  if (Pl.dashCd > 0) Pl.dashCd -= dt;

  const speedMult = S.speedMult;

  // dash (i-frame reposition) + barrel roll flourish
  if (In.dash && Pl.dashCd <= 0 && Pl.alive) {
    const dir = In.axis !== 0 ? In.axis : (Pl.x < W / 2 ? 1 : -1);
    Pl.dashDir = dir;
    Pl.dashT = 0.16;
    Pl.dashCd = 0.85;
    Pl.invuln = Math.max(Pl.invuln, 0.42);
    Pl.rollT = Pl.rollDur;
    Pl.rollDir = dir;
    sfx.dash();
  }
  if (Pl.rollT > 0) Pl.rollT -= dt;

  let targetVx = 0;
  if (Pl.dashT > 0) {
    Pl.dashT -= dt;
    targetVx = Pl.dashDir * 2300 * speedMult;
    // ghost trail
    pSpawn({ x: Pl.x, y: Pl.y + rand(-14, 14), vx: 0, vy: -60, life: 0.28, size: 20, col: '#7df4ff', type: 'glow', shrink: 1, endSize: 2 });
  } else if (In.axis !== 0) {
    targetVx = In.axis * 640 * speedMult;
  } else if (In.pointerX !== null) {
    // touch follow
    const dx = In.pointerX - Pl.x;
    targetVx = clamp(dx * 12, -1500 * speedMult, 1500 * speedMult);
  }
  Pl.vx += (targetVx - Pl.vx) * Math.min(1, dt * (Pl.dashT > 0 ? 30 : 14));
  Pl.x = clamp(Pl.x + Pl.vx * dt, 50, W - 50);

  // engine exhaust (hotter, bigger)
  Pl.flameT -= dt;
  if (Pl.flameT <= 0) {
    Pl.flameT = 0.018;
    const hot = Combo.odT > 0 ? '#ffb0ff' : (Pl.dashT > 0 ? '#ffd23f' : '#7df4ff');
    pSpawn({
      x: Pl.x + rand(-9, 9), y: Pl.y + 46,
      vx: rand(-40, 40), vy: rand(220, 420),
      life: 0.3, size: rand(9, 16), col: hot, type: 'trail', shrink: 1, endSize: 1,
    });
    if (Pl.dashT > 0) {
      // speed lines during dash
      pSpawn({
        x: Pl.x + rand(-30, 30), y: Pl.y + rand(-40, 60),
        vx: -Pl.dashDir * rand(300, 700), vy: 0,
        life: 0.18, size: rand(3, 6), col: '#bfefff', type: 'spark',
      });
    }
  }
}

export function drawPlayer(ctx) {
  if (Pl.hidden) return;
  const now = performance.now();
  // idle hover bob
  const bob = Math.sin(now / 650) * 4;

  // warp-in beam
  if (Pl.warpT > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const a = Pl.warpT / 0.6;
    const g = ctx.createLinearGradient(0, Pl.y - 700, 0, Pl.y + 40);
    g.addColorStop(0, 'rgba(125,244,255,0)');
    g.addColorStop(1, `rgba(125,244,255,${0.5 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(Pl.x - 18 * a - 6, Pl.y - 700, 36 * a + 12, 740);
    ctx.globalCompositeOperation = 'source-over';
  }

  const blink = Pl.invuln > 0 && Math.sin(Pl.invuln * 34) > 0 ? 0.35 : 1;
  const vbnk = clamp(Pl.vx / 640, -1, 1);          // -1..1 movement intent

  // DEPTH BANK (roll over the longitudinal axis) instead of screen yaw:
  // the wing dips toward the viewer -> horizontal foreshortening
  let roll = vbnk * 0.52;                           // ~30° max bank
  if (Pl.rollT > 0) {
    // barrel roll: full 360° over the roll window, same flight direction
    roll += (1 - Pl.rollT / Pl.rollDur) * Math.PI * 2 * Pl.rollDir;
  }
  let sx = Math.abs(Math.cos(roll));
  sx = Math.max(0.14, sx);
  let sy = 1 + (1 - sx) * 0.08;                     // slight stretch when edge-on
  if (Pl.dashT > 0) { sx *= 0.86; sy *= 1.16; }     // dash squash-stretch
  // 2% idle scale pulse — the camera "breathes" with the ship (asset zoom feel)
  const idle = 1 + 0.02 * Math.sin(now / 420);
  sx *= idle; sy *= idle;

  ctx.save();
  ctx.translate(Pl.x, Pl.y + bob + Math.sin(roll * 2) * 5);
  ctx.rotate(vbnk * 0.09);                          // hint of yaw for readability only
  ctx.scale(sx, sy);
  blit(ctx, Spr.fighter, 0, 0, 0, 1, blink);
  ctx.restore();

  // depth cue: wingtip nav lights when banked (visible when the wing dips)
  if (sx < 0.86 && sx > 0.2) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 * (0.86 - sx);
    const wx = Pl.x - vbnk * 26;
    ctx.fillStyle = '#3ef0ff';
    ctx.beginPath(); ctx.arc(wx, Pl.y + bob - 6, 3.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff3355';
    ctx.beginPath(); ctx.arc(Pl.x + vbnk * 26, Pl.y + bob + 6, 3, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  if (Combo.odT > 0) {
    // overdrive aura (pulsing, stronger)
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(Combo.odT * 25);
    blit(ctx, Spr.shield, Pl.x, Pl.y + bob, 0, 1.15 + 0.06 * Math.sin(Combo.odT * 18));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  } else if (Pl.shield > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Pl.shield > 1 ? 0.85 : 0.55 + 0.15 * Math.sin(now / 90);
    blit(ctx, Spr.shield, Pl.x, Pl.y + bob, 0, 1 + 0.03 * Math.sin(now / 160));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// returns true if the hit was fatal
export function hitPlayer() {
  if (Pl.hidden || Pl.invuln > 0 || Combo.odT > 0) return false;
  if (Pl.shield > 0) {
    Pl.shield--;
    Pl.invuln = 0.9;
    sfx.hit();
    emit('shieldBreak');
    return false;
  }
  Pl.hidden = true;
  Pl.alive = false;
  Pl.respawnT = 1.5;
  S.lives--;
  S.weaponTier = Math.max(1, S.weaponTier - 1);
  explPlayer(Pl.x, Pl.y);
  sfx.playerDeath();
  emit('playerDied');
  return true;
}
