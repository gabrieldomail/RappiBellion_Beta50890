// hud.js — holographic HUD: score, lives, badges, combo chain, overdrive, boss bar, toasts
import { W, H } from '../engine/renderer.js';
import { Spr, blit } from '../engine/sprites.js';
import { S } from '../game/state.js';
import { Combo } from '../game/combo.js';
import { Pl } from '../game/player.js';
import { bossHUD } from '../game/bosses/bossBase.js';
import { SECTORS } from '../palettes.js';
import { on } from '../engine/bus.js';

const toasts = []; // {txt, t, life, col}
on('toast', (txt) => toasts.push({ txt, t: 0, life: 1.5, col: '#9ff' }));

export function updateHud(dt) {
  for (let i = toasts.length - 1; i >= 0; i--) {
    toasts[i].t += dt;
    if (toasts[i].t > toasts[i].life) toasts.splice(i, 1);
  }
}

function font(ctx, size, weight = 700) {
  ctx.font = `${weight} ${size}px Orbitron, 'Share Tech Mono', monospace`;
}
function holo(ctx, txt, x, y, size, col, align = 'left', weight = 700) {
  font(ctx, size, weight);
  ctx.textAlign = align;
  ctx.shadowColor = col; ctx.shadowBlur = 10;
  ctx.fillStyle = col;
  ctx.fillText(txt, x, y);
  ctx.shadowBlur = 0;
}

export function drawHud(ctx) {
  if (S.mode !== 'playing' && S.mode !== 'paused') return;
  const sec = SECTORS[S.sector];

  // ---- score block ----
  holo(ctx, 'SCORE', 44, 64, 26, sec.accent);
  holo(ctx, String(S.score).padStart(7, '0'), 44, 118, 54, '#e8fbff', 'left', 900);
  holo(ctx, 'HI ' + String(S.hi).padStart(7, '0'), W - 44, 64, 26, sec.accent2, 'right');
  holo(ctx, 'SECTOR ' + S.sector + ' · ' + sec.name, W - 44, 100, 20, sec.accent2, 'right');

  // ---- weapon pips ----
  holo(ctx, 'WPN', 44, 160, 20, sec.accent);
  for (let i = 0; i < 5; i++) {
    const on = S.weaponTier > i;
    ctx.fillStyle = on ? '#3ef0ff' : 'rgba(62,240,255,0.16)';
    if (on) { ctx.shadowColor = '#3ef0ff'; ctx.shadowBlur = 8; }
    ctx.fillRect(110 + i * 26, 146, 18, 16);
    ctx.shadowBlur = 0;
  }
  // shield pips
  if (Pl.shield > 0) {
    holo(ctx, 'SHD', 44, 200, 20, '#7dff8a');
    for (let i = 0; i < Pl.shield; i++) {
      ctx.fillStyle = '#7dff8a';
      ctx.shadowColor = '#7dff8a'; ctx.shadowBlur = 8;
      ctx.fillRect(110 + i * 26, 186, 18, 16);
      ctx.shadowBlur = 0;
    }
  }

  // ---- lives ----
  for (let i = 0; i < Math.min(S.lives, 8); i++) {
    blit(ctx, Spr.lifeIcon, 56 + i * 44, H - 56, 0, 1);
  }

  // ---- stage badges (Galaga flags homage) ----
  drawBadges(ctx, S.stage);

  // ---- combo chain ----
  if (Combo.chain > 1) {
    const k = Combo.timer / 2.2;
    holo(ctx, 'x' + Combo.mult, W - 44, H - 150, 56, '#ffd23f', 'right', 900);
    holo(ctx, Combo.chain + ' CHAIN', W - 44, H - 110, 22, '#ffd23f', 'right');
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.fillRect(W - 220, H - 96, 176, 8);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(W - 220, H - 96, 176 * k, 8);
  }

  // ---- overdrive meter ----
  const mw = 420, mx = W / 2 - mw / 2, my = H - 64;
  const label = S.odReady ? 'OVERDRIVE READY [E]' : 'OVERDRIVE';
  const col = S.odReady ? '#ffb0ff' : 'rgba(255,176,255,0.6)';
  const pulse = S.odReady ? 0.6 + 0.4 * Math.sin(performance.now() / 120) : 1;
  ctx.globalAlpha = pulse;
  holo(ctx, label, W / 2, my - 12, 22, col, 'center');
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,176,255,0.15)';
  ctx.fillRect(mx, my, mw, 12);
  ctx.fillStyle = S.odReady ? '#ffb0ff' : '#c76bff';
  if (S.odReady || Combo.meter > 0) {
    ctx.shadowColor = '#ffb0ff'; ctx.shadowBlur = 10;
    ctx.fillRect(mx, my, mw * (S.odReady ? 1 : Combo.meter / 100), 12);
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = 'rgba(255,176,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(mx, my, mw, 12);
  if (Combo.odT > 0) {
    holo(ctx, '★ ITANO CIRCUS ★', W / 2, my - 40, 26, '#ffb0ff', 'center', 900);
  }

  // ---- boss bar ----
  const bh = bossHUD();
  if (bh) {
    const bw = 760, bx = W / 2 - bw / 2, by = 150;
    holo(ctx, bh.name, W / 2, by - 16, 26, '#ff6b6b', 'center', 900);
    ctx.fillStyle = 'rgba(20,4,10,0.7)';
    ctx.fillRect(bx, by, bw, 20);
    const frac = Math.max(0, bh.hp / bh.maxHp);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ff3b3b'); g.addColorStop(1, '#ffb020');
    ctx.fillStyle = g;
    ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 12;
    ctx.fillRect(bx, by, bw * frac, 20);
    ctx.shadowBlur = 0;
    // phase ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    for (const t of [0.33, 0.66]) {
      ctx.beginPath();
      ctx.moveTo(bx + bw * t, by); ctx.lineTo(bx + bw * t, by + 20);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, 20);
    if (bh.shielded) holo(ctx, 'CORE SHIELDED — DESTROY THE NODES', W / 2, by + 48, 22, '#39ff9a', 'center');
  }

  // ---- toasts ----
  for (const t of toasts) {
    const k = t.t / t.life;
    ctx.globalAlpha = k < 0.1 ? k / 0.1 : k > 0.7 ? (1 - k) / 0.3 : 1;
    holo(ctx, t.txt, W / 2, H * 0.3 - k * 30, 40, t.col, 'center', 900);
    ctx.globalAlpha = 1;
  }
}

function drawBadges(ctx, stage) {
  if (stage <= 0) return;
  let x = W - 44;
  const put = (spr) => { blit(ctx, Spr[spr], x, H - 56, 0, 1); x -= 42; };
  let n = stage;
  let fifties = Math.floor(n / 50); n %= 50;
  let twenties = Math.floor(n / 20); n %= 20;
  let tens = Math.floor(n / 10); n %= 10;
  let fives = Math.floor(n / 5); n %= 5;
  for (let i = 0; i < fifties && i < 2; i++) put('badge50');
  for (let i = 0; i < twenties && i < 2; i++) put('badge20');
  for (let i = 0; i < tens && i < 2; i++) put('badge10');
  for (let i = 0; i < fives && i < 2; i++) put('badge5');
  for (let i = 0; i < n && i < 5; i++) put('badge1');
}
