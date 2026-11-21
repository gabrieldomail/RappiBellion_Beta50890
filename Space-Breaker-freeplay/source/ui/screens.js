// screens.js — title (animated), how-to (enemy gallery homage), high scores, pause, game over
import { W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { In } from '../engine/input.js';
import { S, getTop5 } from '../game/state.js';
import { sfx } from '../engine/audio.js';
import { SECTORS } from '../palettes.js';
import { Combo } from '../game/combo.js';
import { DEFS } from '../game/enemies.js';
import { startGame } from '../game/director.js';

const MENU = ['LAUNCH', 'HOW TO PLAY', 'HIGH SCORES'];
let sel = 0;
let t = 0;
let goT = 0;         // game-over timer (input lockout)
let demoFoes = [];

export function resetScreens() {
  sel = 0; t = 0; goT = 0;
  demoFoes = [];
  for (let i = 0; i < 6; i++) {
    demoFoes.push({
      spr: ['bee', 'butterfly', 'elite'][i % 3],
      x: W / 2 + Math.sin(i * 1.05) * 300,
      y: 0, ph: i * 1.05,
    });
  }
}

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px Orbitron, 'Share Tech Mono', monospace`;
}
function holo(ctx, txt, x, y, size, col, align = 'center', weight = 700) {
  font(ctx, size, weight);
  ctx.textAlign = align;
  ctx.shadowColor = col; ctx.shadowBlur = 14;
  ctx.fillStyle = col;
  ctx.fillText(txt, x, y);
  ctx.shadowBlur = 0;
}

export function updateScreens(dt) {
  t += dt;
  if (S.mode === 'gameover') goT += dt;

  for (const d of demoFoes) {
    d.ph += dt * 0.5;
    d.x = W / 2 + Math.sin(d.ph) * 320;
    d.y = ((d.ph * 260) % (H + 300)) - 150;
  }

  if (S.mode === 'title') {
    if (In.up && !updateScreens._u) { sel = (sel + MENU.length - 1) % MENU.length; sfx.uiMove(); }
    if (In.down && !updateScreens._d) { sel = (sel + 1) % MENU.length; sfx.uiMove(); }
    updateScreens._u = In.up; updateScreens._d = In.down;

    if (In.tap) {
      // tap zones over menu rows
      const y0 = H * 0.585;
      const row = Math.floor((In.ptrY - y0 + 26) / 76);
      if (row >= 0 && row < MENU.length) { sel = row; confirmMenu(); return; }
    }
    if (In.confirm) confirmMenu();
  } else if (S.mode === 'howto' || S.mode === 'scores') {
    if (In.back || In.confirm || In.tap || In.pause) { sfx.uiMove(); S.mode = 'title'; }
  } else if (S.mode === 'gameover' && goT > 1.2) {
    if (In.confirm || In.tap) {
      sfx.uiSel();
      S.mode = 'title';
    }
  }
}

function confirmMenu() {
  sfx.uiSel();
  if (sel === 0) {
    startGame();
  } else if (sel === 1) {
    S.mode = 'howto';
  } else {
    S.mode = 'scores';
  }
}

export function drawScreens(ctx) {
  const sec = SECTORS[S.sector] || SECTORS[0];
  if (S.mode === 'title') {
    // demo drift behind logo (dimmed so text always reads)
    ctx.globalAlpha = 0.55;
    for (const d of demoFoes) blit(ctx, Spr[d.spr], d.x, d.y, Math.sin(d.ph) * 0.4);
    ctx.globalAlpha = 1;

    const bob = Math.sin(t * 1.4) * 6;
    holo(ctx, 'SPACE', W / 2, 360 + bob, 150, '#e8fbff', 'center', 900);
    holo(ctx, 'BREAKER', W / 2, 500 + bob, 150, sec.accent, 'center', 900);
    // chrome rule
    ctx.strokeStyle = sec.accent2;
    ctx.lineWidth = 3;
    ctx.shadowColor = sec.accent2; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 330, 550 + bob); ctx.lineTo(W / 2 + 330, 550 + bob);
    ctx.stroke();
    ctx.shadowBlur = 0;
    holo(ctx, '— NEON VECTOR 2026 —', W / 2, 610 + bob, 36, sec.accent2);

    // menu
    const y0 = H * 0.585;
    for (let i = 0; i < MENU.length; i++) {
      const active = i === sel;
      const y = y0 + i * 76;
      if (active) {
        ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 5);
        ctx.fillStyle = sec.accent;
        ctx.fillRect(W / 2 - 300, y - 40, 600, 60);
        ctx.globalAlpha = 1;
      }
      holo(ctx, (active ? '▶  ' : '   ') + MENU[i], W / 2, y, active ? 44 : 36,
        active ? '#e8fbff' : 'rgba(160,200,220,0.65)', 'center', active ? 900 : 700);
    }

    if (Math.sin(t * 3.4) > -0.3) {
      holo(ctx, 'PRESS ENTER · ARROWS / DRAG · SPACE FIRE', W / 2, H - 170, 26, sec.accent);
    }
    holo(ctx, 'HI-SCORE  ' + String(S.hi).padStart(7, '0'), W / 2, 250, 34, '#ffd23f', 'center', 900);
    holo(ctx, 'A NEON VECTOR TRIBUTE · RAPPIBELLION FREEPLAY', W / 2, H - 70, 20, 'rgba(140,170,200,0.8)');
  } else if (S.mode === 'howto') {
    holo(ctx, 'HOW TO PLAY', W / 2, 160, 64, sec.accent, 'center', 900);
    const L = 140, col = '#cfe0ee';
    holo(ctx, 'MOVE   ← →  /  A D  /  DRAG', L, 260, 30, col, 'left');
    holo(ctx, 'FIRE   SPACE / HOLD TOUCH (autofire)', L, 310, 30, col, 'left');
    holo(ctx, 'DASH   SHIFT / X   (i-frames)', L, 360, 30, col, 'left');
    holo(ctx, 'OVERDRIVE   E   (when the bar is full)', L, 410, 30, col, 'left');
    holo(ctx, 'PAUSE P · MUTE M', L, 460, 30, col, 'left');
    holo(ctx, 'Graze enemy bullets for bonus + overdrive charge.', L, 530, 26, sec.accent2, 'left');
    holo(ctx, 'Chain kills to raise the score multiplier up to x8.', L, 566, 26, sec.accent2, 'left');
    holo(ctx, 'A boss guards every 3rd stage. Every 4th: bonus run.', L, 602, 26, sec.accent2, 'left');

    // powerups
    const py = 700;
    holo(ctx, 'SUPPLY CAPSULES', W / 2, py - 30, 30, '#ffd23f', 'center', 900);
    const caps = [
      ['capW', 'WEAPON UP'], ['capS', 'SHIELD'], ['capM', '1UP'], ['capB', 'PULSE BOMB'],
    ];
    caps.forEach(([spr, txt], i) => {
      const x = 220 + i * 260;
      blit(ctx, Spr[spr], x, py + 30, 0, 1);
      holo(ctx, txt, x, py + 100, 22, '#cfe0ee');
    });

    // enemy gallery ("and your enemies" homage)
    holo(ctx, '· KNOW YOUR ENEMY ·', W / 2, 880, 34, '#ff6b6b', 'center', 900);
    const gallery = [
      ['bee', '50'], ['butterfly', '80'], ['elite', '150~400'], ['spinner', '200'],
      ['sniper', '300'], ['bomber', '500'], ['turret', '300'], ['mine', '100'], ['carrier', '300'],
    ];
    gallery.forEach(([spr, pts], i) => {
      const x = 170 + (i % 5) * 220;
      const y = 980 + Math.floor(i / 5) * 150;
      blit(ctx, Spr[spr], x, y, 0, 1);
      holo(ctx, pts, x, y + 66, 24, '#ffd23f');
    });
    holo(ctx, 'BACK: ESC / TAP', W / 2, H - 90, 24, 'rgba(160,200,220,0.7)');
  } else if (S.mode === 'scores') {
    holo(ctx, 'HIGH SCORES', W / 2, 240, 72, sec.accent, 'center', 900);
    const top = getTop5();
    for (let i = 0; i < 5; i++) {
      const v = top[i] || 0;
      holo(ctx, `${i + 1}.`, W / 2 - 220, 380 + i * 90, 40, '#cfe0ee', 'left', 900);
      holo(ctx, String(v).padStart(7, '0'), W / 2 + 220, 380 + i * 90, 40,
        v === S.hi && v > 0 ? '#ffd23f' : '#cfe0ee', 'right', 900);
    }
    holo(ctx, 'BACK: ESC / TAP', W / 2, H - 160, 24, 'rgba(160,200,220,0.7)');
  } else if (S.mode === 'paused') {
    ctx.fillStyle = 'rgba(2,6,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    holo(ctx, 'PAUSED', W / 2, H / 2 - 40, 100, sec.accent, 'center', 900);
    holo(ctx, 'P / ESC to resume · M mute', W / 2, H / 2 + 50, 30, '#cfe0ee');
  } else if (S.mode === 'gameover') {
    ctx.fillStyle = 'rgba(2,4,12,0.78)';
    ctx.fillRect(0, 0, W, H);
    const shake = Math.max(0, 1 - goT * 2) * 8;
    holo(ctx, 'GAME OVER', W / 2 + Math.sin(goT * 60) * shake, 560, 120, '#ff3b3b', 'center', 900);
    holo(ctx, 'FINAL SCORE', W / 2, 680, 30, '#9ff');
    holo(ctx, String(S.score).padStart(7, '0'), W / 2, 760, 80, '#e8fbff', 'center', 900);
    if (S.score >= S.hi && S.score > 0) {
      holo(ctx, '★ NEW RECORD ★', W / 2, 840, 44, '#ffd23f', 'center', 900);
    }
    holo(ctx, `STAGE ${S.stage} · BEST CHAIN ${Combo.bestChain}`, W / 2, 910, 28, '#cfe0ee');
    if (goT > 1.2 && Math.sin(t * 3.4) > -0.3) {
      holo(ctx, 'PRESS ENTER / TAP', W / 2, 1020, 34, sec.accent);
    }
  }
}
