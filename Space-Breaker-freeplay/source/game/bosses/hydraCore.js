// hydraCore.js — HYDRA-CORE: shielded core + 5 orbiting nodes; kill 3 nodes to break the shield
import { W, H } from '../../engine/renderer.js';
import { vec } from '../../engine/sprites.js';
import { eShot, eAimed } from '../bullets.js';
import { sfx } from '../../engine/audio.js';
import { spawn as pSpawn } from '../../engine/particles.js';
import { Pl } from '../player.js';
import { angleTo, rand, TAU, clamp } from '../../engine/rand.js';
import { addShake } from '../../fx/camera.js';
import { flash } from '../../engine/postfx.js';

export function makeHydra(diff) {
  const hpScale = 0.75 + 0.25 * diff;
  const NODES = 5;
  const parts = [];
  for (let i = 0; i < NODES; i++) {
    parts.push({
      idx: i, dx: 0, dy: 0, r: 30, hp: 190, maxHp: 190, alive: true,
      col: i % 2 ? '#39ff9a' : '#ff4fd8', kind: 'node',
      fireT: 2.4 + i * 0.62, hitFlash: 0,
    });
  }
  const b = {
    kind: 'hydra',
    name: 'HYDRA-CORE // ORBITAL TYRANT',
    x: W / 2, y: -160, t: 0, hitFlash: 0,
    w: 620, h: 620, coreR: 66, bodyR: 0,
    hp: 1400 * hpScale, maxHp: 1400 * hpScale,
    phase: 1, state: 'enter', enterDone: false,
    coreVulnerable: false, crit: false,
    parts,
    orbitA: 0, orbitSpd: 0.42, orbitR: 250,
    spiralT: 0.8, orbT: 2.2, nodesDead: 0, rage: false,
    deathT: 0, stageN: 1,
  };

  const spd = () => (b.rage ? 0.55 : 1) / Math.pow(diff, 0.3);

  b.update = (dt) => {
    if (b.state === 'enter') {
      b.y += 195 * dt;
      if (b.y >= 440) { b.y = 440; b.enterDone = true; }
      return;
    }
    if (b.state === 'dying') return;

    b.orbitA += b.orbitSpd * (b.rage ? -1.7 : 1) * dt;
    b.x = W / 2 + Math.sin(b.t * 0.3) * 90;
    b.y = 440 + Math.sin(b.t * 0.6) * 24;

    // place node parts on orbit
    for (const p of b.parts) {
      if (p.hitFlash > 0) p.hitFlash -= dt;
      if (!p.alive) { p.dx = 0; p.dy = 0; continue; }
      const a = b.orbitA + p.idx * TAU / b.parts.length;
      p.dx = Math.cos(a) * b.orbitR;
      p.dy = Math.sin(a) * b.orbitR * 0.82;
    }

    // node petal fire
    for (const p of b.parts) {
      if (!p.alive) continue;
      p.fireT -= dt;
      if (p.fireT <= 0) {
        p.fireT = 3.2 * spd();
        const wx = b.x + p.dx, wy = b.y + p.dy;
        const a = angleTo(wx, wy, Pl.x, Pl.y);
        const n = b.rage ? 7 : 5;
        for (let k = 0; k < n; k++) {
          eShot(wx, wy, a + (k - (n - 1) / 2) * 0.24, 265 + diff * 18, 'ball');
        }
      }
    }

    // exposed core attacks
    if (b.coreVulnerable) {
      b.spiralT -= dt;
      if (b.spiralT <= 0) {
        b.spiralT = (b.rage ? 0.5 : 0.85) * spd();
        const a0 = b.t * 3.1;
        for (let arm = 0; arm < 2; arm++) {
          eShot(b.x, b.y, a0 + arm * Math.PI, 235, 'ball');
          eShot(b.x, b.y, a0 + arm * Math.PI + 0.26, 235, 'ball');
        }
      }
      b.orbT -= dt;
      if (b.orbT <= 0) {
        b.orbT = 2.4 * spd();
        eAimed(b.x, b.y, Pl.x, Pl.y, 205 + diff * 14, 'orb');
      }
    }
  };

  b.onPartDead = (p) => {
    b.nodesDead++;
    addShake(0.32);
    // retaliate
    const a0 = b.t * 2;
    for (let k = 0; k < 10; k++) eShot(b.x, b.y, a0 + k * TAU / 10, 250, 'ball');
    if (b.nodesDead === 3 && !b.coreVulnerable) {
      // SHIELD BREAK
      b.coreVulnerable = true;
      flash(120, 255, 180, 0.4);
      addShake(0.6);
      sfx.bossExpl();
      for (let i = 0; i < 26; i++) {
        pSpawn({
          x: b.x, y: b.y,
          vx: Math.cos(i * TAU / 26) * 420, vy: Math.sin(i * TAU / 26) * 420,
          life: 0.6, size: 10, col: '#39ff9a', type: 'spark',
        });
      }
    }
    if (b.nodesDead >= 4) b.rage = true;
  };

  b.draw = (ctx) => {
    const x = b.x, y = b.y;
    ctx.save();
    ctx.translate(x, y);

    // orbit trace
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#39ff9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.orbitR, b.orbitR * 0.82, 0, 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // nodes
    for (const p of b.parts) {
      ctx.save();
      ctx.translate(p.dx, p.dy);
      if (!p.alive) {
        ctx.fillStyle = '#0c1210';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
        ctx.strokeStyle = '#234'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        continue;
      }
      const col = p.hitFlash > 0 ? '#fff' : p.col;
      vec.ring(ctx, 0, 0, 22, col, 3.5, 14);
      vec.dot(ctx, 0, 0, 12, col, 16);
      // petal spikes
      for (let k = 0; k < 6; k++) {
        const a = b.t * 1.2 + k * TAU / 6;
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 24, Math.sin(a) * 24);
        ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34);
        ctx.stroke();
      }
      vec.dot(ctx, 0, 0, 4, '#fff', 8);
      ctx.restore();
    }

    // core body: armored eye
    vec.symPath(ctx, [[0, -80], [56, -48], [72, 0], [56, 48], [0, 80]]);
    vec.fillStroke(ctx, cgrad(ctx), '#7dffce', 3.5);
    // armor plates
    for (let k = 0; k < 4; k++) {
      const a = b.t * 0.5 + k * Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      vec.polyPath(ctx, [[-30, -74], [30, -74], [22, -52], [-22, -52]]);
      ctx.fillStyle = '#0e2018';
      ctx.fill();
      ctx.strokeStyle = '#2d6b52'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    // the eye
    const lookA = angleTo(x, y, Pl.x, Pl.y);
    const eyeR = b.coreVulnerable ? 30 : 22;
    vec.dot(ctx, 0, 0, eyeR + 6, b.rage ? '#ff4fd8' : '#0a3a28', 18);
    vec.dot(ctx, Math.cos(lookA) * 8, Math.sin(lookA) * 8, eyeR * 0.62,
      b.coreVulnerable ? '#ffd23f' : '#39ff9a', 22);
    vec.dot(ctx, Math.cos(lookA) * 12, Math.sin(lookA) * 12, eyeR * 0.3, '#fff', 12);

    // shield bubble while sealed
    if (!b.coreVulnerable) {
      ctx.globalAlpha = 0.3 + 0.14 * Math.sin(b.t * 4);
      vec.ring(ctx, 0, 0, 96, '#39ff9a', 4, 18);
      ctx.globalAlpha = 0.12;
      vec.dot(ctx, 0, 0, 94, '#39ff9a', 24);
      ctx.globalAlpha = 1;
      // hex facets
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#39ff9a';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 6; k++) {
        const a = b.t * 0.8 + k * TAU / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 60, Math.sin(a) * 60);
        ctx.lineTo(Math.cos(a + 0.5) * 95, Math.sin(a + 0.5) * 95);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  return b;
}

function cgrad(ctx) {
  const g = ctx.createLinearGradient(0, -80, 0, 80);
  g.addColorStop(0, '#1d4a38');
  g.addColorStop(1, '#0a1a14');
  return g;
}
