// seraph.js — SERAPH-CLASS CARRIER: drone bays, 4 destructible turrets, main beam (Macross battleship)
import { W, H } from '../../engine/renderer.js';
import { Spr, blit, vec } from '../../engine/sprites.js';
import { eShot, eAimed, eBeam } from '../bullets.js';
import { spawnFoe } from '../enemies.js';
import { sfx } from '../../engine/audio.js';
import { burst, spawn as pSpawn } from '../../engine/particles.js';
import { Pl } from '../player.js';
import { angleTo, rand, TAU, clamp } from '../../engine/rand.js';
import { addShake } from '../../fx/camera.js';

export function makeSeraph(diff) {
  const hpScale = 0.75 + 0.25 * diff;
  const b = {
    kind: 'seraph',
    name: 'SERAPH-CLASS CARRIER',
    x: W / 2, y: -260, t: 0, hitFlash: 0,
    w: 780, h: 260, coreR: 120, bodyR: 260,
    hp: 1350 * hpScale, maxHp: 1350 * hpScale,
    phase: 1, state: 'enter', enterDone: false,
    coreVulnerable: true, crit: false,
    parts: [
      { dx: -255, dy: 58, r: 34, hp: 150, maxHp: 150, alive: true, col: '#22d3ee', kind: 'turret' },
      { dx: 255, dy: 58, r: 34, hp: 150, maxHp: 150, alive: true, col: '#22d3ee', kind: 'turret' },
      { dx: -118, dy: 84, r: 30, hp: 120, maxHp: 120, alive: true, col: '#ff3ec8', kind: 'turret' },
      { dx: 118, dy: 84, r: 30, hp: 120, maxHp: 120, alive: true, col: '#ff3ec8', kind: 'turret' },
    ],
    turretT: 1.6, bayT: 3.4, podT: 4.6, beamT: 6.4, beamCharging: false,
    deathT: 0, stageN: 1,
  };

  const spd = () => (b.phase === 3 ? 0.62 : b.phase === 2 ? 0.8 : 1) / Math.pow(diff, 0.35);

  b.update = (dt) => {
    if (b.state === 'enter') {
      b.y += 185 * dt;
      if (b.y >= 400) { b.y = 400; b.enterDone = true; }
      return;
    }
    if (b.state === 'dying') return;

    const sway = b.phase === 3 ? 0.62 : 0.36;
    b.x = W / 2 + Math.sin(b.t * sway) * 245;
    b.y = 400 + Math.sin(b.t * 0.8) * 26;

    for (const p of b.parts) if (p.hitFlash > 0) p.hitFlash -= dt;

    // --- turret fans ---
    b.turretT -= dt;
    if (b.turretT <= 0) {
      b.turretT = 1.55 * spd();
      for (const p of b.parts) {
        if (!p.alive || p.kind !== 'turret') continue;
        const wx = b.x + p.dx, wy = b.y + p.dy;
        const a = angleTo(wx, wy, Pl.x, Pl.y);
        eShot(wx, wy, a, 320 + diff * 26, 'bolt');
        eShot(wx, wy, a - 0.22, 320 + diff * 26, 'bolt');
        eShot(wx, wy, a + 0.22, 320 + diff * 26, 'bolt');
      }
    }

    // --- drone bays ---
    b.bayT -= dt;
    if (b.bayT <= 0) {
      b.bayT = (b.phase >= 2 ? 3.4 : 4.4) * spd();
      const n = b.phase === 3 ? 4 : 3;
      const side = Math.random() < 0.5 ? -1 : 1;
      for (let i = 0; i < n; i++) {
        const fx = b.x + side * 185;
        spawnFoe(i % 2 ? 'drone' : 'fighter', 'topC', null, diff,
          { pathTo: [clamp(fx + i * 70 * side, 100, W - 100), 330 + i * 36] });
      }
      sfx.dash();
    }

    // --- missile pods (Itano against you) ---
    b.podT -= dt;
    if (b.podT <= 0) {
      b.podT = 5.2 * spd();
      for (let i = 0; i < 6; i++) {
        const sx = b.x + (i % 2 ? 210 : -210);
        eShot(sx, b.y + 40, angleTo(sx, b.y, Pl.x, Pl.y) + rand(-0.5, 0.5), 235 + diff * 18, 'wave');
      }
    }

    // --- main cannon beam (phase 2+) ---
    if (b.phase >= 2) {
      b.beamT -= dt;
      if (b.beamT <= 1.1 && !b.beamCharging) {
        b.beamCharging = true;
        sfx.beamCharge(1.0);
      }
      if (b.beamT <= 0) {
        b.beamCharging = false;
        b.beamT = 6.6 * spd();
        sfx.beamFire();
        addShake(0.25);
        eBeam(b.x, b.y + 92, Math.PI / 2, '#ff3ec8', 0.75, 0.5, 1500, 34);
        if (b.phase === 3) {
          eBeam(b.x - 170, b.y + 92, Math.PI / 2, '#ff3ec8', 0.75, 0.5, 1500, 26);
          eBeam(b.x + 170, b.y + 92, Math.PI / 2, '#ff3ec8', 0.75, 0.5, 1500, 26);
        }
      }
    }
  };

  b.onPartDead = (p) => {
    addShake(0.3);
    // avenging volley
    for (let i = 0; i < 5; i++) {
      eShot(b.x, b.y + 60, Math.PI / 2 + (i - 2) * 0.26, 300, 'ball');
    }
  };

  b.draw = (ctx, flat) => {
    const x = b.x, y = b.y;
    ctx.save();
    ctx.translate(x, y);
    const tilt = Math.sin(b.t * 0.36) * 0.045;
    ctx.rotate(tilt);

    // rear engine deck (top)
    vec.polyPath(ctx, [[-150, -128], [150, -128], [120, -92], [-120, -92]]);
    vec.fillStroke(ctx, '#141c30', '#3a4a6a', 2);
    for (const m of [-1, 1]) {
      vec.dot(ctx, m * 80, -108, 9, '#3ef0ff', 14);
    }

    // main hull
    vec.symPath(ctx, [[0, -96], [140, -70], [300, -18], [330, 44], [210, 96], [0, 112]]);
    vec.fillStroke(ctx, ctx.createLinearGradient ? grad3(ctx, -96, 112) : '#22304c', '#5a74a8', 3);

    // keel
    vec.symPath(ctx, [[0, 60], [150, 48], [190, 84], [0, 104]]);
    vec.fillStroke(ctx, '#101828', '#42557c', 2);

    // accent stripes
    ctx.fillStyle = 'rgba(34,211,238,0.8)';
    for (const m of [-1, 1]) {
      vec.polyPath(ctx, [[m * 40, -84], [m * 210, -40], [m * 214, -28], [m * 44, -70]]);
      ctx.fill();
    }

    // drone bays (glowing doors)
    for (const m of [-1, 1]) {
      vec.polyPath(ctx, [[m * 130, 10], [m * 250, 18], [m * 250, 62], [m * 130, 56]]);
      vec.fillStroke(ctx, '#0c1524', '#ff3ec8', 2);
      const pulse = 0.5 + 0.5 * Math.sin(b.t * 3 + m);
      ctx.globalAlpha = 0.35 + 0.4 * pulse;
      vec.dot(ctx, m * 190, 36, 16, '#ff3ec8', 18);
      ctx.globalAlpha = 1;
    }

    // command tower
    vec.symPath(ctx, [[0, -104], [34, -70], [46, -40], [-46, -40], [-34, -70]]);
    vec.fillStroke(ctx, '#1a2540', '#6a8ac0', 2);
    vec.dot(ctx, 0, -78, 7, '#9ff', 10);

    // main cannon
    const charge = b.beamCharging ? 1 : 0;
    const chR = 16 + charge * (10 + 8 * Math.sin(b.t * 18));
    vec.ring(ctx, 0, 84, 24, '#ff3ec8', 3);
    ctx.globalAlpha = 0.6 + charge * 0.4;
    vec.dot(ctx, 0, 92, chR, '#ff3ec8', 20);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a3550';
    ctx.fillRect(-13, 88, 26, 26);

    // CORE TARGET RETICLE — "hit here" marker (rotating segmented ring)
    {
      const rr = 96;
      ctx.save();
      ctx.rotate(b.t * 0.7);
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(b.t * 3.2);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a0 = k * Math.PI / 3, a1 = a0 + Math.PI / 3 * 0.6;
        ctx.beginPath();
        ctx.arc(0, 6, rr, a0, a1);
        ctx.stroke();
      }
      ctx.restore();
      // corner ticks
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5;
      for (const [tx, ty] of [[-rr - 8, -14], [rr + 8, -14], [-rr - 8, 26], [rr + 8, 26]]) {
        ctx.beginPath();
        ctx.moveTo(tx - Math.sign(tx) * 12, ty - 10);
        ctx.lineTo(tx - Math.sign(tx) * 12, ty + 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // navigation running lights along the hull (blink alternately)
    {
      ctx.globalCompositeOperation = 'lighter';
      const on = Math.sin(b.t * 2.4) > 0;
      for (const [lx, ly, col] of [
        [-310, 40, '#ff4455'], [310, 40, '#3ef0ff'],
        [-210, 74, '#ffd23f'], [210, 74, '#ffd23f'],
      ]) {
        const lit = (col === '#3ef0ff' || col === '#ff4455') ? on : !on;
        if (!lit) continue;
        ctx.globalAlpha = 0.9;
        vec.dot(ctx, lx, ly, 4, col, 10);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // rear engines (top deck) — flickering plasma
    {
      ctx.globalCompositeOperation = 'lighter';
      for (const m of [-1, 1]) {
        const fl = 26 + 14 * Math.sin(b.t * 26 + m);
        const g2 = ctx.createLinearGradient(0, -128, 0, -128 - fl);
        g2.addColorStop(0, 'rgba(120,240,255,0.85)');
        g2.addColorStop(1, 'rgba(60,120,255,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.moveTo(m * 80 - 12, -124);
        ctx.lineTo(m * 80 + 12, -124);
        ctx.lineTo(m * 80 + 5, -124 - fl);
        ctx.lineTo(m * 80 - 5, -124 - fl);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // battle damage: smoke from the hull once hurt
    if (b.phase >= 2 && Math.random() < 0.14) {
      pSpawn({
        x: b.x + rand(-220, 220), y: b.y + rand(-40, 60),
        vx: rand(-20, 20), vy: -rand(30, 70),
        life: rand(0.8, 1.6), size: rand(12, 24), col: '#556', type: 'smoke',
      });
      if (b.phase === 3 && Math.random() < 0.4) {
        pSpawn({
          x: b.x + rand(-160, 160), y: b.y + rand(-20, 40),
          vx: rand(-40, 40), vy: -rand(20, 60),
          life: 0.4, size: rand(4, 8), col: '#ff9a2a', type: 'spark',
        });
      }
    }

    // turrets
    for (const p of b.parts) {
      const wx = p.dx, wy = p.dy;
      if (!p.alive) {
        ctx.fillStyle = '#0a0f1a';
        ctx.beginPath(); ctx.arc(wx, wy, 16, 0, 7); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
        if (Math.random() < 0.1) {
          pSpawn({ x: b.x + wx, y: b.y + wy, vx: 0, vy: -40, life: 0.8, size: 14, col: '#445', type: 'smoke' });
        }
        continue;
      }
      const aim = angleTo(b.x + wx, b.y + wy, Pl.x, Pl.y);
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(aim - Math.PI / 2);
      vec.dot(ctx, 0, 0, 20, p.hitFlash > 0 ? '#fff' : '#39537c', 12);
      ctx.fillStyle = '#0e1526';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
      ctx.strokeStyle = p.col; ctx.lineWidth = 2.5; ctx.stroke();
      // barrel toward player
      ctx.fillStyle = p.col;
      vec.glow(ctx, p.col, 10);
      ctx.fillRect(-3.5, 12, 7, 22);
      vec.noGlow(ctx);
      ctx.restore();
    }

    ctx.restore();
  };

  return b;
}

function grad3(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#33436a');
  g.addColorStop(1, '#141e33');
  return g;
}
