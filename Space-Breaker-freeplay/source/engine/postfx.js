// postfx.js — bloom, chromatic ghost, glitch slices, scanlines, vignette, flash, fade
import { view, world, screenTransform, W, H } from './renderer.js';
import { Cam } from '../fx/camera.js';
import { rand } from './rand.js';

const FX = {
  flashA: 0, flashCol: [255, 255, 255],
  fadeA: 1, fadeTarget: 0, fadeSpeed: 2.2, fadeCb: null,
  glitchT: 0, glitchStr: 0,
  aberr: 0,                     // chromatic ghost strength 0..1
  bloom: 0.68,
};

export function flash(r, g, b, a) {
  if (a <= FX.flashA) { FX.flashCol = [r, g, b]; return; }
  FX.flashCol = [r, g, b]; FX.flashA = a;
}
export function fadeTo(target, speed = 2.2, cb = null) {
  FX.fadeTarget = target; FX.fadeSpeed = speed; FX.fadeCb = cb;
}
export function glitch(dur, strength = 1) { FX.glitchT = Math.max(FX.glitchT, dur); FX.glitchStr = strength; }
export function aberration(a) { FX.aberr = Math.max(FX.aberr, a); }
export function setBloom(a) { FX.bloom = a; }
export function fadeNow(a) { FX.fadeA = a; FX.fadeTarget = a; }

let bloomCv = null, bctx = null;
let scanTile = null, vigKey = '', vigCv = null;
let filterOK = null;

export function updatePostfx(realDt) {
  FX.flashA = Math.max(0, FX.flashA - realDt * 2.8);
  FX.aberr = Math.max(0, FX.aberr - realDt * 3);
  FX.glitchT = Math.max(0, FX.glitchT - realDt);
  if (FX.fadeA !== FX.fadeTarget) {
    const d = FX.fadeTarget - FX.fadeA;
    const step = FX.fadeSpeed * realDt;
    FX.fadeA += Math.abs(d) <= step ? d : Math.sign(d) * step;
    if (Math.abs(FX.fadeTarget - FX.fadeA) < 0.002 && FX.fadeCb) {
      const cb = FX.fadeCb; FX.fadeCb = null; cb();
    }
  }
}

function ensureBloom() {
  if (bloomCv) return;
  bloomCv = document.createElement('canvas');
  bloomCv.width = 300; bloomCv.height = 400;
  bctx = bloomCv.getContext('2d');
  if (filterOK === null) {
    bctx.filter = 'blur(2px)';
    filterOK = bctx.filter === 'blur(2px)';
  }
}

function ensureScan() {
  if (scanTile) return;
  scanTile = document.createElement('canvas');
  scanTile.width = 4; scanTile.height = 4;
  const c = scanTile.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.fillRect(0, 2, 4, 1);
  c.fillRect(0, 3, 4, 1);
}

function ensureVig(w, h) {
  const key = w + 'x' + h;
  if (vigKey === key) return;
  vigKey = key;
  vigCv = document.createElement('canvas');
  vigCv.width = w; vigCv.height = h;
  const c = vigCv.getContext('2d');
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(2,2,10,0.55)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

export function renderPostfx() {
  const ctx = view;
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, cw, ch);

  // world -> screen with camera shake / zoom
  screenTransform(ctx);
  const z = Cam.zoom;
  ctx.translate(W / 2 + Cam.dx, H / 2 + Cam.dy);
  ctx.rotate(Cam.rot);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(world, 0, 0, W, H);

  // chromatic ghost on big impacts (cheap: additive offset copies)
  if (FX.aberr > 0.02) {
    const off = 3 + FX.aberr * 10;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 * FX.aberr;
    ctx.drawImage(world, -off, 0, W, H);
    ctx.drawImage(world, off, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // bloom (downscale + blur + additive)
  ensureBloom();
  if (filterOK && FX.bloom > 0.02) {
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.filter = 'none';
    bctx.clearRect(0, 0, 300, 400);
    bctx.drawImage(world, 0, 0, 300, 400);
    bctx.filter = 'blur(7px)';
    bctx.drawImage(bloomCv, 0, 0);
    bctx.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = FX.bloom;
    ctx.drawImage(bloomCv, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // glitch slices (boss intros / big events)
  if (FX.glitchT > 0) {
    const n = 4 + (FX.glitchStr * 6) | 0;
    for (let i = 0; i < n; i++) {
      const sy = rand(0, H - 60);
      const sh = rand(8, 46);
      const off = rand(-1, 1) * 60 * FX.glitchStr;
      ctx.drawImage(world, 0, sy * (world.height / H), world.width, sh * (world.height / H),
        off, sy, W, sh);
    }
  }

  // scanlines + vignette (screen space)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ensureScan();
  const pat = ctx.createPattern(scanTile, 'repeat');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, cw, ch);
  ctx.globalAlpha = 1;
  ensureVig(cw, ch);
  ctx.drawImage(vigCv, 0, 0);

  // flash + fade
  if (FX.flashA > 0.01) {
    ctx.fillStyle = `rgba(${FX.flashCol[0]},${FX.flashCol[1]},${FX.flashCol[2]},${Math.min(0.85, FX.flashA)})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  if (FX.fadeA > 0.005) {
    ctx.fillStyle = `rgba(2,3,10,${FX.fadeA})`;
    ctx.fillRect(0, 0, cw, ch);
  }
}

export function isGlitching() { return FX.glitchT > 0; }
