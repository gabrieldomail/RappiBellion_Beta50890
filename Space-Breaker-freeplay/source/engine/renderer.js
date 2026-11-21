// renderer.js — world canvas (1200x1600) + screen canvas.
// SIZING DOCTRINE (v3, unconditional): the canvas ELEMENT never changes size
// (CSS 100vw/100vh forever, backing synced to it). Whatever the host does
// (browser zoom, CSS zoom, pinch, clipped iframe panels), we measure the
// VISIBLE FRACTION of the element every ~300ms and letterbox the DRAWING
// into that region. No style mutations -> no resize jumps, no sticky guards.
import { clamp } from './rand.js';

export const W = 1200;
export const H = 1600;

export let view = null;        // screen canvas ctx
export let world = null;       // offscreen world canvas
export let wctx = null;        // world ctx

let canvas = null;
let rs = Math.min(window.devicePixelRatio || 1, 2);
let quality = 1;
let resizeTimer = null;
let pollTimer = null;
let lastDpr = window.devicePixelRatio || 1;

// Visible fraction of the canvas element (in element CSS px, top-left anchored)
// x/y = visible fraction, ox/oy = visible origin as fraction of element size.
let vis = { x: 1, y: 1, ox: 0, oy: 0, src: 'full' };
let lastClientW = 0, lastClientH = 0;

export function initRenderer(cv) {
  canvas = cv;
  view = cv.getContext('2d');
  buildWorld();
  window.addEventListener('resize', scheduleResize);
  window.addEventListener('orientationchange', scheduleResize);
  try {
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', measure);
      window.visualViewport.addEventListener('scroll', measure);
    }
    if (window.parent && window.parent !== window) {
      window.parent.addEventListener('resize', measure, { passive: true });
      window.parent.addEventListener('scroll', measure, { passive: true, capture: true });
    }
  } catch (e) { /* cross-origin parent: ignore */ }
  resize();
  // single periodic watchdog: measure visible fraction + backing drift.
  // Pure measurement + drawing-space adaptation — never touches styles.
  pollTimer = setInterval(() => {
    const d = window.devicePixelRatio || 1;
    if (Math.abs(d - lastDpr) > 0.001) { lastDpr = d; scheduleResize(); }
    measure();
    if (canvas.clientWidth !== lastClientW || canvas.clientHeight !== lastClientH) {
      resize();
    }
  }, 300);
}

function scheduleResize() {
  if (resizeTimer) return;
  resizeTimer = setTimeout(() => { resizeTimer = null; resize(); }, 60);
}

// ---- visible-fraction measurement (all cases, one unit system per case) ----
function measure() {
  if (!canvas) return;
  const next = { x: 1, y: 1, ox: 0, oy: 0, src: 'full' };

  // 1) pinch/page zoom on this page: element visual size = inner * vv.scale
  const vv = window.visualViewport;
  if (vv && (vv.scale > 1.02 || vv.pageLeft > 8 || vv.pageTop > 8)) {
    const s = Math.max(1, vv.scale);
    const fx = clamp(vv.width / Math.max(1, window.innerWidth * s), 0.05, 1);
    const fy = clamp(vv.height / Math.max(1, window.innerHeight * s), 0.05, 1);
    next.x = fx; next.y = fy;
    next.ox = clamp(vv.pageLeft / Math.max(1, window.innerWidth), 0, 0.95);
    next.oy = clamp(vv.pageTop / Math.max(1, window.innerHeight), 0, 0.95);
    next.src = 'pinch';
  } else {
    // 2) host CSS zoom / clip: element rect vs layout viewport
    const r = canvas.getBoundingClientRect();
    const iw = window.innerWidth || 1, ih = window.innerHeight || 1;
    const zf = Math.max(r.width / iw, r.height / ih);
    if (zf > 1.04) {
      next.x = clamp(1 / zf, 0.05, 1);
      next.y = clamp(1 / zf, 0.05, 1);
      next.src = 'csszoom';
    } else {
      // 3) same-origin parent iframe clipped by panels/scroll (rects viewport-relative)
      const pc = parentClipInfo();
      if (pc && (pc.fracX < 0.98 || pc.fracY < 0.98)) {
        next.x = clamp(pc.fracX, 0.05, 1);
        next.y = clamp(pc.fracY, 0.05, 1);
        next.ox = clamp(pc.offX, 0, 0.95);
        next.oy = clamp(pc.offY, 0, 0.95);
        next.src = 'parent';
      }
    }
  }
  // hysteresis: only accept changes > 2% (kills transient flicker)
  if (Math.abs(next.x - vis.x) > 0.02 || Math.abs(next.y - vis.y) > 0.02 ||
      Math.abs(next.ox - vis.ox) > 0.02 || Math.abs(next.oy - vis.oy) > 0.02 || next.src !== vis.src) {
    vis = next;
  }
}

function parentClipInfo() {
  try {
    if (window.parent === window) return null;
    const pd = window.parent.document;
    const pv = window.parent;
    let el = null;
    for (const f of pd.querySelectorAll('iframe')) {
      try { if (f.contentWindow === window) { el = f; break; } } catch (e) { /* skip */ }
    }
    if (!el) return null;
    const pvv = pv.visualViewport;
    const s = pvv && pvv.scale > 1.02 ? pvv.scale : 1;
    let clipL = 0, clipT = 0;
    // innerWidth/Height: correct in standards AND quirks mode (clientHeight lies in quirks)
    let clipR = s > 1 ? pvv.width : (pv.innerWidth || pd.documentElement.clientWidth);
    let clipB = s > 1 ? pvv.height : (pv.innerHeight || pd.documentElement.clientHeight);
    let a = el.parentElement;
    while (a && a !== pd.body) {
      const cs = pv.getComputedStyle(a);
      const ov = (cs.overflow + ' ' + cs.overflowX + ' ' + cs.overflowY);
      if (/hidden|clip|auto|scroll/.test(ov)) {
        const r = a.getBoundingClientRect();
        clipL = Math.max(clipL, r.left * s);
        clipT = Math.max(clipT, r.top * s);
        clipR = Math.min(clipR, r.right * s);
        clipB = Math.min(clipB, r.bottom * s);
      }
      a = a.parentElement;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    const rl = r.left * s, rt = r.top * s, rr2 = r.right * s, rb2 = r.bottom * s;
    const visL = Math.max(clipL, rl), visT = Math.max(clipT, rt);
    const visR = Math.min(clipR, rr2), visB = Math.min(clipB, rb2);
    return {
      fracX: Math.max(0, (visR - visL) / (rr2 - rl)),
      fracY: Math.max(0, (visB - visT) / (rb2 - rt)),
      offX: Math.max(0, (visL - rl) / (rr2 - rl)),
      offY: Math.max(0, (visT - rt) / (rb2 - rt)),
    };
  } catch (e) {
    return null;
  }
}

export function resize() {
  if (!canvas) return;
  measure();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  lastDpr = window.devicePixelRatio || 1;
  const vw = Math.max(1, canvas.clientWidth || window.innerWidth);
  const vh = Math.max(1, canvas.clientHeight || window.innerHeight);
  lastClientW = canvas.clientWidth;
  lastClientH = canvas.clientHeight;
  const w = Math.round(vw * dpr);
  const h = Math.round(vh * dpr);
  if (w !== canvas.width) canvas.width = w;
  if (h !== canvas.height) canvas.height = h;
}

// ---- THE one true transform: world -> visible region of the screen canvas ----
export function screenTransform(ctx) {
  const cw = canvas.width, ch = canvas.height;
  const rx = Math.max(40, cw * vis.x);
  const ry = Math.max(40, ch * vis.y);
  const s = Math.min(rx / W, ry / H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // visible region origin (top-left anchored) + centered letterbox inside it
  ctx.translate(cw * vis.ox + (rx - W * s) / 2, ch * vis.oy + (ry - H * s) / 2);
  ctx.scale(s, s);
  return s;
}

// visible draw region in ELEMENT CSS px (for pointer mapping)
export function getDrawRegion() {
  const r = canvas.getBoundingClientRect();
  const s = Math.min((r.width * vis.x) / W, (r.height * vis.y) / H);
  return {
    x: r.left + r.width * vis.ox + (r.width * vis.x - W * s) / 2,
    y: r.top + r.height * vis.oy + (r.height * vis.y - H * s) / 2,
    s,
  };
}

function buildWorld() {
  world = document.createElement('canvas');
  world.width = Math.round(W * rs * quality);
  world.height = Math.round(H * rs * quality);
  wctx = world.getContext('2d');
  wctx.imageSmoothingEnabled = true;
}

export function worldScale() { return rs * quality; }

export function setQuality(q) {
  q = clamp(q, 0.5, 1);
  if (Math.abs(q - quality) < 0.05) return false;
  quality = q;
  buildWorld();
  return true;
}
export function getQuality() { return quality; }

// diagnostics for __NVS
export function fitDiagnostics() {
  const vv = window.visualViewport;
  return {
    vis: { ...vis },
    vv: vv ? { scale: +vv.scale.toFixed(3), w: Math.round(vv.width), h: Math.round(vv.height), pl: Math.round(vv.pageLeft), pt: Math.round(vv.pageTop) } : null,
    inner: { w: window.innerWidth, h: window.innerHeight },
    dpr: window.devicePixelRatio,
    rect: (() => { const r = canvas.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    backing: { w: canvas.width, h: canvas.height },
    style: { pos: canvas.style.position || 'static', w: canvas.style.width || '(css)' },
    letterbox: (() => {
      const rx = Math.max(40, canvas.width * vis.x), ry = Math.max(40, canvas.height * vis.y);
      const s = Math.min(rx / W, ry / H);
      return { s: +s.toFixed(3), rx: Math.round(rx), ry: Math.round(ry) };
    })(),
  };
}
