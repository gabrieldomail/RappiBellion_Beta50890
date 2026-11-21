// cinematics.js — WARNING boss intro, stage banners, challenge results, letterbox
import { W, H } from '../engine/renderer.js';
import { glitch } from '../engine/postfx.js';
import { sfx } from '../engine/audio.js';
import { rand } from '../engine/rand.js';
import { SECTORS } from '../palettes.js';
import { S } from '../game/state.js';

const C = {
  warnT: 0, warnDur: 0, name: '', cb: null, done: false,
  bannerT: 0, bannerDur: 0, bannerTxt: '', bannerSub: '',
  resT: 0, resDur: 0, hits: 0, total: 0, perfect: false, resCb: null,
};

export function bossWarning(name, cb) {
  C.warnT = 0; C.warnDur = 2.6; C.name = name; C.cb = cb; C.done = false;
  sfx.warn();
  glitch(0.5, 1);   // the full dramatic intro glitch (user-approved)
}

export function banner(txt, sub = '', dur = 1.8) {
  C.bannerT = 0; C.bannerDur = dur; C.bannerTxt = txt; C.bannerSub = sub;
}

export function challengeResults(hits, total, perfect, cb) {
  C.resT = 0; C.resDur = 2.8; C.hits = hits; C.total = total; C.perfect = perfect; C.resCb = cb;
}

export function cineActive() { return C.warnT < C.warnDur || C.resT < C.resDur; }

export function updateCine(dt) {
  if (C.warnT < C.warnDur) {
    C.warnT += dt;
    if (Math.random() < 0.12) glitch(0.06, 0.8);
    if (C.warnT >= C.warnDur && !C.done) {
      C.done = true;
      if (C.cb) { const cb = C.cb; C.cb = null; cb(); }
    }
  }
  if (C.bannerT < C.bannerDur) C.bannerT += dt;
  if (C.resT < C.resDur) {
    C.resT += dt;
    if (C.resT >= C.resDur && C.resCb) { const cb = C.resCb; C.resCb = null; cb(); }
  }
}

function holoText(ctx, txt, x, y, size, col, align = 'center', weight = 900) {
  ctx.font = `${weight} ${size}px Orbitron, 'Share Tech Mono', monospace`;
  ctx.textAlign = align;
  ctx.shadowColor = col; ctx.shadowBlur = 18;
  ctx.fillStyle = col;
  ctx.fillText(txt, x, y);
  ctx.shadowBlur = 0;
}

export function drawCine(ctx) {
  // ---- boss WARNING ----
  if (C.warnT < C.warnDur) {
    const k = C.warnT / C.warnDur;
    const lb = Math.min(1, k * 6) * 80; // letterbox height
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, lb);
    ctx.fillRect(0, H - lb, W, lb);

    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(C.warnT * 10));
    ctx.globalAlpha = pulse;
    holoText(ctx, '⚠ WARNING ⚠', W / 2 + rand(-3, 3), H / 2 - 60, 110, '#ff3b3b');
    ctx.globalAlpha = 1;

    if (k > 0.28) {
      const a = Math.min(1, (k - 0.28) * 5);
      ctx.globalAlpha = a;
      holoText(ctx, 'LARGE ENEMY SIGNATURE APPROACHING', W / 2, H / 2 + 10, 34, '#ffb0b0', 'center', 700);
      // name plate
      const nw = 720;
      ctx.fillStyle = 'rgba(20,0,10,0.8)';
      ctx.fillRect(W / 2 - nw / 2, H / 2 + 40, nw, 84);
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 3;
      ctx.strokeRect(W / 2 - nw / 2, H / 2 + 40, nw, 84);
      holoText(ctx, C.name, W / 2, H / 2 + 100, 52, '#ff6b6b');
      ctx.globalAlpha = 1;
    }
    // hazard stripes
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 14;
    for (let i = 0; i < 9; i++) {
      const y = H / 2 - 210 + i * 52;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 420 + ((C.warnT * 90) % 80), y);
      ctx.lineTo(W / 2 + 420 + ((C.warnT * 90) % 80), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- stage banner ----
  if (C.bannerT < C.bannerDur) {
    const k = C.bannerT / C.bannerDur;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const sector = SECTORS[(S.sector + 5) % 5];
    ctx.globalAlpha = a;
    holoText(ctx, C.bannerTxt, W / 2, H * 0.42, 92, sector.accent);
    if (C.bannerSub) holoText(ctx, C.bannerSub, W / 2, H * 0.42 + 56, 38, sector.accent2, 'center', 700);
    // side rules
    ctx.strokeStyle = sector.accent;
    ctx.lineWidth = 3;
    const rw = 200 + 400 * Math.min(1, k * 3);
    ctx.globalAlpha = a * 0.7;
    ctx.beginPath();
    ctx.moveTo(W / 2 - rw, H * 0.42 + 90); ctx.lineTo(W / 2 + rw, H * 0.42 + 90);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- challenge results ----
  if (C.resT < C.resDur) {
    const k = C.resT / C.resDur;
    const a = k < 0.1 ? k / 0.1 : k > 0.85 ? (1 - k) / 0.15 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,10,0.6)';
    ctx.fillRect(W / 2 - 400, H * 0.36, 800, 260);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
    ctx.strokeRect(W / 2 - 400, H * 0.36, 800, 260);
    holoText(ctx, 'CHALLENGING STAGE', W / 2, H * 0.36 + 70, 48, '#ffd23f');
    holoText(ctx, `${C.hits} / ${C.total} HITS`, W / 2, H * 0.36 + 140, 64,
      C.perfect ? '#7dff8a' : '#9ff');
    if (C.perfect) holoText(ctx, 'PERFECT! 1UP!', W / 2, H * 0.36 + 210, 44, '#7dff8a');
    ctx.globalAlpha = 1;
  }
}
