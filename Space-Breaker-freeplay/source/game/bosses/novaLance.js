// novaLance.js — NOVA-LANCE: transforming mech (jet strafe <-> telegraphed dash slash, stagger crit)
import { W, H } from '../../engine/renderer.js';
import { vec } from '../../engine/sprites.js';
import { eShot, eAimed } from '../bullets.js';
import { sfx } from '../../engine/audio.js';
import { spawn as pSpawn } from '../../engine/particles.js';
import { Pl } from '../player.js';
import { angleTo, rand, clamp, TAU } from '../../engine/rand.js';
import { addShake } from '../../fx/camera.js';

export function makeNova(diff) {
  const hpScale = 0.75 + 0.25 * diff;
  const b = {
    kind: 'nova',
    name: 'NOVA-LANCE // TRANSFORM MECH',
    x: W / 2, y: -180, t: 0, hitFlash: 0,
    w: 420, h: 420, coreR: 52, bodyR: 95,
    hp: 1150 * hpScale, maxHp: 1150 * hpScale,
    phase: 1, state: 'enter', enterDone: false,
    coreVulnerable: true, crit: false,
    parts: [],
    form: 'jet', formT: 0,
    vx: 430, dir: 1,
    aimT: 0, dashT: 0, dashDir: 1, dashY: 1000, dashX0: 0, dashX1: 0,
    volleyT: 0.8, mslT: 2.8, spiralT: 2.4,
    dashesLeft: 0,
    deathT: 0, stageN: 1,
  };

  const spd = () => (b.phase === 3 ? 0.6 : b.phase === 2 ? 0.78 : 1) / Math.pow(diff, 0.3);

  b.update = (dt) => {
    if (b.state === 'enter') {
      b.y += 215 * dt;
      if (b.y >= 430) { b.y = 430; b.enterDone = true; }
      return;
    }
    if (b.state === 'dying') {
      b.y += 20 * dt;
      return;
    }

    b.formT -= dt;

    if (b.form === 'jet') {
      const v = (b.phase === 3 ? 560 : 430);
      b.x += b.dir * v * dt;
      b.y = 430 + Math.sin(b.t * 1.7) * 46;
      if (b.x < 150) { b.x = 150; b.dir = 1; }
      if (b.x > W - 150) { b.x = W - 150; b.dir = -1; }

      b.volleyT -= dt;
      if (b.volleyT <= 0) {
        b.volleyT = 0.85 * spd();
        const a = angleTo(b.x, b.y, Pl.x, Pl.y);
        for (let k = -1; k <= 1; k++) eShot(b.x, b.y + 50, a + k * 0.18, 360 + diff * 26, 'bolt');
      }
      b.mslT -= dt;
      if (b.mslT <= 0) {
        b.mslT = 3.3 * spd();
        for (let i = 0; i < 5; i++) {
          eShot(b.x, b.y + 30, angleTo(b.x, b.y, Pl.x, Pl.y) + rand(-0.6, 0.6), 240 + diff * 16, 'wave');
        }
      }
      if (b.phase >= 2) {
        b.spiralT -= dt;
        if (b.spiralT <= 0) {
          b.spiralT = 2.6 * spd();
          const a0 = b.t * 2;
          for (let k = 0; k < 8; k++) eShot(b.x, b.y, a0 + k * TAU / 8, 265, 'ball');
        }
      }
      if (b.formT <= 0) { b.form = 'aim'; b.aimT = 0.75; b.dashY = clamp(Pl.y - 120, 820, 1250); sfx.warn(); }
    } else if (b.form === 'aim') {
      b.aimT -= dt;
      // slide toward the far side to wind up
      b.x += b.dir * 180 * dt;
      if (b.aimT <= 0) {
        b.form = 'dash';
        b.dashDir = -b.dir;
        b.dashX0 = b.x;
        b.dashX1 = b.dashDir > 0 ? W + 200 : -200;
        b.dashT = Math.abs(b.dashX1 - b.x) / 2300;
        sfx.beamFire();
        addShake(0.3);
      }
    } else if (b.form === 'dash') {
      b.dashT -= dt;
      const k = 1 - b.dashT / (Math.abs(b.dashX1 - b.dashX0) / 2300);
      b.x = b.dashX0 + (b.dashX1 - b.dashX0) * Math.min(1, k);
      b.y += (b.dashY - b.y) * Math.min(1, Math.abs(k) * 3);
      pSpawn({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, size: 26, col: '#b06bff', type: 'glow', shrink: 1, endSize: 4 });
      if (b.dashT <= 0) {
        b.dashesLeft = b.phase === 3 ? 1 : 0;
        if (b.dashesLeft > 0) {
          // second pass back
          b.form = 'aim'; b.aimT = 0.6;
          b.dir *= -1;
          b.x = b.dashDir > 0 ? W + 160 : -160;
        } else {
          b.form = 'stagger';
          b.formT = 1.35;
          b.crit = true;
          b.x = W / 2; b.y = 400;
          flashWarp();
        }
      }
    } else if (b.form === 'stagger') {
      b.y = 400 + Math.sin(b.t * 6) * 8;
      if (b.formT <= 0) {
        b.crit = false;
        b.form = 'jet';
        b.formT = b.phase === 3 ? 4.4 : 6.2;
        b.dir = Pl.x > b.x ? 1 : -1;
      }
    }
  };

  function flashWarp() {
    addShake(0.2);
    for (let i = 0; i < 16; i++) {
      pSpawn({
        x: b.x + rand(-60, 60), y: b.y + rand(-80, 80),
        vx: rand(-200, 200), vy: rand(-200, 200),
        life: 0.4, size: 10, col: '#b06bff', type: 'spark',
      });
    }
  }

  b.onPhase = (ph) => {
    if (ph >= 2 && b.form === 'jet') b.mslT = 0.4;
  };

  b.draw = (ctx) => {
    ctx.save();
    ctx.translate(b.x, b.y);

    if (b.form === 'jet' || b.form === 'aim') {
      const face = b.form === 'aim' ? b.dir : b.dir;
      ctx.scale(face >= 0 ? 1 : -1, 1);
      drawJet(ctx, b);
    } else if (b.form === 'dash') {
      ctx.scale(b.dashDir >= 0 ? 1 : -1, 1);
      drawDash(ctx, b);
    } else {
      drawStagger(ctx, b);
    }
    ctx.restore();

    // dash telegraph
    if (b.form === 'aim') {
      const k = 1 - b.aimT / 0.75;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(b.t * 20));
      ctx.strokeStyle = '#ff5c5c';
      ctx.lineWidth = 4 + 6 * k;
      ctx.setLineDash([26, 20]);
      ctx.beginPath();
      ctx.moveTo(-40, b.dashY);
      ctx.lineTo(W + 40, b.dashY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  };

  return b;
}

// ---- forms ----
function drawJet(ctx, b) {
  // sleek arrow interceptor
  vec.symPath(ctx, [[0, -95], [22, -50], [86, 10], [70, 40], [26, 26], [34, 88], [10, 70]]);
  vec.fillStroke(ctx, jgrad(ctx), '#d9c2ff', 3, '#b06bff');
  // wing blades
  for (const m of [1, -1]) {
    vec.polyPath(ctx, [[m * 24, -20], [m * 110, 26], [m * 96, 52], [m * 30, 18]]);
    vec.fillStroke(ctx, '#3d2370', '#b06bff', 2);
    vec.dot(ctx, m * 84, 36, 4, '#3ef0d0', 8);
  }
  // cockpit
  vec.polyPath(ctx, [[0, -70], [10, -30], [0, -12], [-10, -30]]);
  vec.fillStroke(ctx, ctx.createLinearGradient(0, -70, 0, -12) || '#8ef0ff', '#c2f6ff', 2);
  ctx.fillStyle = '#8ef0ff'; ctx.fill();
  // engines
  for (const m of [1, -1]) vec.dot(ctx, m * 16, 66, 8 + 3 * Math.sin(b.t * 30), '#3ef0d0', 14);
  vec.dot(ctx, 0, -95, 5, '#ff5c5c', 8);
}

function drawDash(ctx, b) {
  // lance-forward lunge silhouette
  ctx.rotate(0.35);
  vec.symPath(ctx, [[0, -60], [20, -14], [120, 6], [150, 18], [120, 34], [24, 44], [10, 90]]);
  vec.fillStroke(ctx, jgrad(ctx), '#d9c2ff', 3, '#b06bff');
  // lance
  vec.polyPath(ctx, [[150, 18], [260, 14], [280, 20], [260, 26], [150, 24]]);
  vec.fillStroke(ctx, '#e9dcff', '#fff', 2, '#e9dcff');
  for (const m of [1, -1]) {
    vec.polyPath(ctx, [[m * 18, 0], [m * 70, m > 0 ? -34 : 34], [m * 58, m > 0 ? -10 : 10]]);
    ctx.fillStyle = '#3d2370'; ctx.fill();
  }
  vec.dot(ctx, 0, 30, 10 + 4 * Math.sin(b.t * 26), '#3ef0d0', 16);
}

function drawStagger(ctx, b) {
  // humanoid mech, chest core cracked open (crit)
  // legs
  for (const m of [1, -1]) {
    vec.polyPath(ctx, [[m * 14, 40], [m * 34, 90], [m * 20, 96], [m * 2, 52]]);
    vec.fillStroke(ctx, '#241542', '#7a5cc0', 2);
  }
  // torso
  vec.symPath(ctx, [[0, -34], [34, -20], [46, 22], [26, 46], [0, 52]]);
  vec.fillStroke(ctx, jgrad(ctx), '#b06bff', 3);
  // shoulders
  for (const m of [1, -1]) {
    vec.polyPath(ctx, [[m * 30, -26], [m * 66, -34], [m * 74, -6], [m * 40, 0]]);
    vec.fillStroke(ctx, '#3d2370', '#b06bff', 2);
    vec.dot(ctx, m * 52, -18, 6, '#ff5c5c', 10);
  }
  // head
  vec.polyPath(ctx, [[-14, -34], [14, -34], [10, -58], [-10, -58]]);
  vec.fillStroke(ctx, '#2a1a4e', '#9a7ce0', 2);
  vec.dot(ctx, 0, -46, 4, '#ff5c5c', 8);
  // open core (weak point)
  const pulse = 0.7 + 0.3 * Math.sin(b.t * 14);
  vec.ring(ctx, 0, 6, 18, '#ffd23f', 3);
  ctx.globalAlpha = pulse;
  vec.dot(ctx, 0, 6, 13, '#ffd23f', 22);
  ctx.globalAlpha = 1;
}

function jgrad(ctx) {
  const g = ctx.createLinearGradient(0, -100, 0, 100);
  g.addColorStop(0, '#58309c');
  g.addColorStop(1, '#22123e');
  return g;
}
