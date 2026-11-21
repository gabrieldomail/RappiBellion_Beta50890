// sprites.js — procedural neon-vector sprite factory (baked to offscreen canvases)
// Homage silhouettes: bee (yellow/blue), butterfly (red/white), elite boss (green/purple),
// fighter (white/red/blue). All crisp at any resolution, glow baked in.

export const Spr = {};

const S = 2; // raster supersample

function mk(w, h, pad, draw) {
  const cw = w + pad * 2, ch = h + pad * 2;
  const c = document.createElement('canvas');
  c.width = cw * S; c.height = ch * S;
  const x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, (w / 2 + pad) * S, (h / 2 + pad) * S);
  x.lineJoin = 'round'; x.lineCap = 'round';
  draw(x);
  return { c, w: cw, h: ch };
}

function glow(x, col, b = 14) { x.shadowColor = col; x.shadowBlur = b; }
function noGlow(x) { x.shadowBlur = 0; }

function grad(x, y0, y1, c0, c1) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  return g;
}

// path from point list
function polyPath(x, pts) {
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath();
}
// symmetric hull: right-half pts auto-mirrored on x=0
function symPath(x, pts) {
  const full = pts.concat(pts.slice(1, -1).reverse().map(p => [-p[0], p[1]]));
  polyPath(x, full);
}

function fillStroke(x, fill, stroke, lw = 2, glowCol = stroke) {
  glow(x, glowCol, 12);
  if (fill) { x.fillStyle = fill; x.fill(); }
  if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw; x.stroke(); }
  noGlow(x);
}

// ---------- PLAYER FIGHTER (white hull / red trim / blue canopy) ----------
function drawFighter(x, scale = 1) {
  x.save(); x.scale(scale, scale);
  // wings
  symPath(x, [[0, -8], [16, 6], [40, 26], [36, 34], [12, 26], [8, 38], [0, 36]]);
  fillStroke(x, grad(x, -20, 40, '#f4f9ff', '#aebfd8'), '#7fdcff', 2);
  // red wing stripes
  for (const m of [1, -1]) {
    polyPath(x, [[m * 17, 8], [m * 34, 25], [m * 28, 29], [m * 13, 16]]);
    x.fillStyle = '#ff3355'; x.fill();
  }
  // fuselage
  symPath(x, [[0, -50], [8, -28], [11, 6], [8, 32], [0, 40]]);
  fillStroke(x, grad(x, -50, 40, '#ffffff', '#c3d6ee'), '#9fe8ff', 2);
  // canopy
  polyPath(x, [[0, -34], [6, -8], [0, 2], [-6, -8]]);
  glow(x, '#35c8ff', 10);
  x.fillStyle = grad(x, -34, 2, '#8ef0ff', '#1877ff'); x.fill(); noGlow(x);
  // tail fins
  for (const m of [1, -1]) {
    polyPath(x, [[m * 6, 22], [m * 16, 40], [m * 8, 40], [m * 4, 28]]);
    x.fillStyle = '#ff3355'; glow(x, '#ff3355', 8); x.fill(); noGlow(x);
  }
  // nozzles
  for (const m of [1, -1]) {
    x.fillStyle = '#223046';
    x.fillRect(m * 10 - 5, 32, 10, 10);
    x.fillStyle = '#ffb347'; glow(x, '#ff9a2a', 10);
    x.fillRect(m * 10 - 2.5, 34, 5, 7); noGlow(x);
  }
  x.restore();
}

// ---------- BEE (drone homage: yellow body, blue wings, magenta eyes) ----------
function drawBee(x) {
  // wings swept
  for (const m of [1, -1]) {
    polyPath(x, [[m * 5, -6], [m * 32, -18], [m * 29, 4], [m * 22, 16], [m * 8, 12]]);
    fillStroke(x, grad(x, -18, 16, '#63c4ff', '#1f66cc'), '#9fe0ff', 2);
  }
  // body
  symPath(x, [[0, -30], [8, -18], [11, 4], [8, 22], [0, 30]]);
  fillStroke(x, grad(x, -30, 30, '#ffe14f', '#d98f00'), '#ffe9a3', 2);
  // segment lines
  x.strokeStyle = 'rgba(90,50,0,0.55)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-9, 2); x.lineTo(9, 2); x.moveTo(-8, 12); x.lineTo(8, 12); x.stroke();
  // eyes (faces down: attacker)
  glow(x, '#ff36c7', 10);
  x.fillStyle = '#ff36c7';
  for (const m of [1, -1]) { x.beginPath(); x.arc(m * 6, 20, 3.4, 0, 7); x.fill(); }
  noGlow(x);
  // antennae
  x.strokeStyle = '#ffe14f'; x.lineWidth = 2.4;
  x.beginPath(); x.moveTo(-5, -28); x.quadraticCurveTo(-10, -36, -16, -38);
  x.moveTo(5, -28); x.quadraticCurveTo(10, -36, 16, -38); x.stroke();
}

// ---------- BUTTERFLY (red wings, white body) ----------
function drawButterfly(x) {
  for (const m of [1, -1]) {
    // upper wing
    polyPath(x, [[m * 4, -10], [m * 34, -26], [m * 30, 0], [m * 10, 0]]);
    fillStroke(x, grad(x, -26, 0, '#ff5c5c', '#c41e3a'), '#ff9c9c', 2);
    // lower wing
    polyPath(x, [[m * 8, 2], [m * 32, 6], [m * 26, 24], [m * 8, 16]]);
    fillStroke(x, grad(x, 0, 24, '#ff8a5c', '#b02440'), '#ffb39c', 2);
  }
  symPath(x, [[0, -26], [6, -12], [7, 10], [4, 26], [0, 32]]);
  fillStroke(x, grad(x, -26, 32, '#ffffff', '#c9d4e8'), '#ffd7d7', 2);
  glow(x, '#ff4444', 10);
  x.fillStyle = '#ff4444';
  for (const m of [1, -1]) { x.beginPath(); x.arc(m * 4, 18, 3, 0, 7); x.fill(); }
  noGlow(x);
}

// ---------- ELITE (boss-galaga homage: purple hull, green crown) ----------
function drawElite(x) {
  symPath(x, [[0, -30], [12, -20], [30, -2], [24, 16], [10, 22], [0, 26]]);
  fillStroke(x, grad(x, -30, 26, '#c98bff', '#5e2bb8'), '#e3c2ff', 2);
  // crown head at nose (down)
  for (const m of [1, -1]) {
    polyPath(x, [[m * 4, 20], [m * 18, 30], [m * 8, 38], [m * 2, 30]]);
    fillStroke(x, '#39d97b', '#a5ffc9', 2);
  }
  polyPath(x, [[0, 22], [7, 30], [0, 40], [-7, 30]]);
  fillStroke(x, '#2fde6b', '#a5ffc9', 2);
  glow(x, '#2fde6b', 10);
  x.fillStyle = '#b6ffce';
  for (const m of [1, -1]) { x.beginPath(); x.arc(m * 9, 8, 3.2, 0, 7); x.fill(); }
  noGlow(x);
  // wing pods
  for (const m of [1, -1]) {
    x.fillStyle = '#411d80';
    polyPath(x, [[m * 12, -14], [m * 28, -4], [m * 22, 10], [m * 10, 2]]);
    x.fill();
    x.fillStyle = '#39d97b'; glow(x, '#39d97b', 8);
    polyPath(x, [[m * 16, -8], [m * 24, -3], [m * 19, 4], [m * 13, 0]]); x.fill(); noGlow(x);
  }
}

// ---------- SPINNER (teal gyroscope) ----------
function drawSpinner(x) {
  x.strokeStyle = '#3ef0d0'; x.lineWidth = 5; glow(x, '#3ef0d0', 14);
  x.beginPath(); x.arc(0, 0, 26, 0, 7); x.stroke();
  x.lineWidth = 2; x.strokeStyle = '#9ffbe9';
  x.beginPath(); x.arc(0, 0, 19, 0, 7); x.stroke();
  noGlow(x);
  polyPath(x, [[0, -14], [12, 7], [-12, 7]]);
  fillStroke(x, grad(x, -14, 8, '#c8fff4', '#0e8f7c'), '#3ef0d0', 2);
  glow(x, '#3ef0d0', 10);
  x.fillStyle = '#eafffb'; x.beginPath(); x.arc(0, 0, 4, 0, 7); x.fill(); noGlow(x);
}

// ---------- SNIPER (violet lance) ----------
function drawSniper(x) {
  symPath(x, [[0, 38], [9, 10], [22, -8], [15, -22], [0, -26]]);
  fillStroke(x, grad(x, -26, 38, '#caa6ff', '#4b1d8f'), '#d9c2ff', 2);
  // long barrel
  x.fillStyle = '#2b1554'; glow(x, '#b06bff', 10);
  x.fillRect(-3, 8, 6, 34);
  x.fillStyle = '#e6d6ff'; x.fillRect(-1.4, 12, 2.8, 26); noGlow(x);
  // lens
  glow(x, '#54f0ff', 12);
  x.fillStyle = '#54f0ff'; x.beginPath(); x.arc(0, 2, 5, 0, 7); x.fill(); noGlow(x);
  for (const m of [1, -1]) {
    polyPath(x, [[m * 8, -14], [m * 26, -26], [m * 20, -8], [m * 8, -4]]);
    x.fillStyle = '#5c2bb8'; x.fill();
  }
}

// ---------- BOMBER (amber heavy) ----------
function drawBomber(x) {
  symPath(x, [[0, -40], [20, -34], [34, -12], [34, 14], [20, 36], [0, 42]]);
  fillStroke(x, grad(x, -40, 42, '#ffcf6e', '#a05a00'), '#ffe0a3', 2.4);
  // armor plates
  x.strokeStyle = 'rgba(70,35,0,0.6)'; x.lineWidth = 3;
  x.beginPath();
  x.moveTo(-26, -12); x.lineTo(26, -12);
  x.moveTo(-30, 8); x.lineTo(30, 8);
  x.stroke();
  // hazard chevrons
  x.fillStyle = '#2b1a00';
  for (let i = -2; i <= 2; i++) polyPath(x, [[i * 12 - 6, 16], [i * 12, 24], [i * 12 + 6, 16]]) , x.fill();
  // twin guns
  for (const m of [1, -1]) {
    x.fillStyle = '#4b3000'; x.fillRect(m * 12 - 4, 30, 8, 16);
    glow(x, '#ffb020', 10); x.fillStyle = '#ffd88a';
    x.fillRect(m * 12 - 2, 34, 4, 10); noGlow(x);
  }
  glow(x, '#ff9a2a', 10);
  x.fillStyle = '#ff9a2a'; x.beginPath(); x.arc(0, -18, 6, 0, 7); x.fill(); noGlow(x);
}

// ---------- TURRET (gunmetal base, orange cannon) ----------
function drawTurret(x) {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4;
    const px = Math.cos(a) * 28, py = Math.sin(a) * 28;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
  fillStroke(x, grad(x, -28, 28, '#aebcd8', '#3c4864'), '#cfe0ff', 2.4);
  x.beginPath(); x.arc(0, 0, 15, 0, 7);
  fillStroke(x, grad(x, -15, 15, '#dfe8ff', '#68789c'), '#cfe0ff', 2);
  // cannon (points down)
  x.fillStyle = '#33405c'; x.fillRect(-5, 8, 10, 26);
  glow(x, '#ff7733', 12); x.fillStyle = '#ff7733'; x.fillRect(-2.4, 10, 4.8, 22); noGlow(x);
  glow(x, '#ffcc88', 8);
  x.fillStyle = '#ffcc88'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); noGlow(x);
}

// ---------- MINE (magenta spiked orb) ----------
function drawMine(x) {
  x.strokeStyle = '#ff4fd8'; x.lineWidth = 4; glow(x, '#ff4fd8', 12);
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    x.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
    x.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
  }
  x.stroke();
  const g = x.createRadialGradient(0, 0, 2, 0, 0, 14);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#ff4fd8'); g.addColorStop(1, '#5a0c48');
  glow(x, '#ff4fd8', 14);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); noGlow(x);
}

// ---------- CARRIER (golden flying fortress) ----------
function drawCarrier(x) {
  symPath(x, [[0, -26], [26, -20], [48, -2], [48, 14], [26, 26], [0, 30]]);
  fillStroke(x, grad(x, -26, 30, '#ffe27a', '#a06a00'), '#ffefb0', 2.4);
  // bay doors
  x.fillStyle = '#4b3600';
  x.fillRect(-16, -10, 32, 24);
  glow(x, '#ffd94a', 12);
  x.fillStyle = '#ffd94a'; x.fillRect(-11, -5, 22, 14); noGlow(x);
  // fins
  for (const m of [1, -1]) {
    polyPath(x, [[m * 34, -12], [m * 52, -26], [m * 46, 0], [m * 34, 8]]);
    fillStroke(x, '#c9992a', '#ffe27a', 2);
  }
  // running lights
  glow(x, '#fff6c9', 10); x.fillStyle = '#fff6c9';
  for (const m of [1, -1]) { x.beginPath(); x.arc(m * 44, -2, 3, 0, 7); x.fill(); }
  noGlow(x);
}

// ---------- POWERUP CAPSULES ----------
const CAP_COL = { W: ['#3ef0ff', '#0a7f96'], S: ['#7dff8a', '#0a7f3c'], M: ['#ff6bd6', '#8f0a6b'], B: ['#ffb020', '#8f4a00'] };
function drawCapsule(x, kind) {
  const [c, cd] = CAP_COL[kind];
  const r = 12;
  x.beginPath();
  x.roundRect ? x.roundRect(-19, -24, 38, 48, r) : x.rect(-19, -24, 38, 48);
  x.closePath();
  fillStroke(x, grad(x, -24, 24, '#182338', '#0b1220'), c, 2.6);
  glow(x, c, 12);
  x.fillStyle = c;
  x.font = '900 26px Orbitron, monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(kind, 0, 1);
  noGlow(x);
}

// ---------- MEDAL ----------
function drawMedal(x) {
  x.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 3;
    const px = Math.cos(a) * 15, py = Math.sin(a) * 17;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
  fillStroke(x, grad(x, -17, 17, '#fff2b0', '#c98a00'), '#fff6cf', 2.4);
  glow(x, '#ffe27a', 8);
  x.fillStyle = '#8f5a00';
  x.font = '900 15px Orbitron, monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('★', 0, 1);
  noGlow(x);
}

// ---------- PROJECTILES ----------
function drawPShot(x) {
  glow(x, '#3ef0ff', 12);
  const g = x.createLinearGradient(0, -18, 0, 18);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#7df4ff'); g.addColorStop(1, '#0aa8cc');
  x.fillStyle = g;
  x.beginPath();
  x.roundRect ? x.roundRect(-4, -18, 8, 36, 4) : x.rect(-4, -18, 8, 36);
  x.fill(); noGlow(x);
}
function drawMissile(x) {
  symPath(x, [[0, -16], [4, -4], [4, 10], [8, 15], [8, 19], [0, 16]]);
  fillStroke(x, grad(x, -16, 19, '#f2fbff', '#8fa8c8'), '#bfe8ff', 1.6);
  glow(x, '#3ef0ff', 10);
  x.fillStyle = '#9df3ff';
  polyPath(x, [[0, -16], [3, -8], [-3, -8]]); x.fill(); noGlow(x);
}
function drawEBall(x) {
  const g = x.createRadialGradient(0, 0, 1, 0, 0, 11);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ff6be0'); g.addColorStop(1, 'rgba(255,40,190,0)');
  glow(x, '#ff6be0', 10);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 11, 0, 7); x.fill(); noGlow(x);
}
function drawEBolt(x) {
  glow(x, '#ff5c5c', 10);
  const g = x.createLinearGradient(0, -13, 0, 13);
  g.addColorStop(0, '#ffd0a0'); g.addColorStop(1, '#e02020');
  x.fillStyle = g;
  x.beginPath();
  x.roundRect ? x.roundRect(-3.6, -13, 7.2, 26, 3) : x.rect(-3.6, -13, 7.2, 26);
  x.fill(); noGlow(x);
}
function drawEOrb(x) {
  const g = x.createRadialGradient(0, 0, 2, 0, 0, 17);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#b06bff'); g.addColorStop(1, 'rgba(90,20,255,0)');
  glow(x, '#b06bff', 14);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 17, 0, 7); x.fill(); noGlow(x);
  x.strokeStyle = '#e0c2ff'; x.lineWidth = 1.6;
  x.beginPath(); x.arc(0, 0, 10, 0, 7); x.stroke();
}

// ---------- SHIELD BUBBLE ----------
function drawShield(x) {
  const g = x.createRadialGradient(0, 0, 48, 0, 0, 64);
  g.addColorStop(0, 'rgba(62,240,255,0)');
  g.addColorStop(0.82, 'rgba(62,240,255,0.25)');
  g.addColorStop(1, 'rgba(160,250,255,0.65)');
  glow(x, '#3ef0ff', 12);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 64, 0, 7); x.fill(); noGlow(x);
}

// ---------- STAGE BADGES (homage to Galaga level flags) ----------
function drawBadge(x, label, col) {
  polyPath(x, [[0, -18], [14, -8], [14, 12], [0, 20], [-14, 12], [-14, -8]]);
  fillStroke(x, grad(x, -18, 20, '#182338', '#0b1220'), col, 2.2);
  glow(x, col, 6);
  x.fillStyle = col;
  x.font = '900 15px Orbitron, monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(label, 0, 1);
  noGlow(x);
}

// ---------- BUILD ALL ----------
export function buildSprites() {
  Spr.fighter = mk(96, 110, 14, (x) => drawFighter(x, 1));
  Spr.lifeIcon = mk(46, 54, 6, (x) => drawFighter(x, 0.46));
  Spr.bee = mk(76, 82, 12, drawBee);
  Spr.butterfly = mk(76, 76, 12, drawButterfly);
  Spr.elite = mk(80, 90, 12, drawElite);
  Spr.spinner = mk(64, 64, 12, drawSpinner);
  Spr.sniper = mk(64, 90, 12, drawSniper);
  Spr.bomber = mk(88, 96, 12, drawBomber);
  Spr.turret = mk(72, 72, 12, drawTurret);
  Spr.mine = mk(56, 56, 12, drawMine);
  Spr.carrier = mk(116, 72, 12, drawCarrier);
  Spr.capW = mk(44, 52, 12, (x) => drawCapsule(x, 'W'));
  Spr.capS = mk(44, 52, 12, (x) => drawCapsule(x, 'S'));
  Spr.capM = mk(44, 52, 12, (x) => drawCapsule(x, 'M'));
  Spr.capB = mk(44, 52, 12, (x) => drawCapsule(x, 'B'));
  Spr.medal = mk(36, 40, 10, drawMedal);
  Spr.pShot = mk(12, 40, 10, drawPShot);
  Spr.missile = mk(18, 38, 10, drawMissile);
  Spr.eBall = mk(24, 24, 10, drawEBall);
  Spr.eBolt = mk(10, 28, 10, drawEBolt);
  Spr.eOrb = mk(36, 36, 10, drawEOrb);
  Spr.shield = mk(128, 128, 12, drawShield);
  Spr.badge1 = mk(30, 40, 8, (x) => drawBadge(x, '1', '#3ef0ff'));
  Spr.badge5 = mk(30, 40, 8, (x) => drawBadge(x, '5', '#7dff8a'));
  Spr.badge10 = mk(30, 40, 8, (x) => drawBadge(x, '10', '#ffd23f'));
  Spr.badge20 = mk(30, 40, 8, (x) => drawBadge(x, '20', '#ff9a2a'));
  Spr.badge50 = mk(30, 40, 8, (x) => drawBadge(x, '50', '#ff4fd8'));
}

// draw helper: centered sprite with optional rotation (radians) + scale + alpha
export function blit(ctx, spr, x, y, rot = 0, scale = 1, alpha = 1) {
  if (!spr) return;
  ctx.globalAlpha = alpha;
  if (rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(spr.c, -spr.w / 2 * scale, -spr.h / 2 * scale, spr.w * scale, spr.h * scale);
    ctx.restore();
  } else {
    ctx.drawImage(spr.c, x - spr.w / 2 * scale, y - spr.h / 2 * scale, spr.w * scale, spr.h * scale);
  }
  ctx.globalAlpha = 1;
}

// ---------- vector kit for per-frame boss drawing ----------
export const vec = {
  glow, noGlow, polyPath, symPath, fillStroke, grad,
  ring(ctx, x, y, r, col, lw = 3, blur = 12) {
    glow(ctx, col, blur);
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    noGlow(ctx);
  },
  dot(ctx, x, y, r, col, blur = 10) {
    glow(ctx, col, blur);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    noGlow(ctx);
  },
};
