// main.js — boot + master loop (fixed timestep world, layered render, perf watchdog)
import { initRenderer, resize, view, world, wctx, screenTransform, W, H, setQuality, getQuality, fitDiagnostics } from './engine/renderer.js';
import { buildSprites } from './engine/sprites.js';
import { initInput, In, updateInput } from './engine/input.js';
import { Time, frame as timeFrame } from './engine/time.js';
import { renderPostfx, updatePostfx, fadeNow, fadeTo, setBloom } from './engine/postfx.js';
import { updateCam } from './fx/camera.js';
import { initBackdrop, updateBackdrop, drawBackdrop, setWarDensity } from './fx/backdrop.js';
import { updateCine, drawCine } from './fx/cinematics.js';
import { updateFx, drawFx } from './fx/explosions.js';
import { updateParticles, drawParticles, drawPopups, setParticleCap } from './engine/particles.js';
import { resumeAudio, setMuted, musicPlay, setIntensity } from './engine/audio.js';
import { S, loadScores } from './game/state.js';
import { updatePlayer, drawPlayer, Pl } from './game/player.js';
import { updateWeapons } from './game/weapons.js';
import { updateBullets, drawBullets, setTargetProvider } from './game/bullets.js';
import { updateFoes, drawFoes, foes } from './game/enemies.js';
import { updateFormation } from './game/formation.js';
import { updateDirector, wireDirector, startStage } from './game/director.js';
import { spawnBoss, bossTestHit } from './game/bosses/bossBase.js';
import { updateBoss, drawBoss, boss } from './game/bosses/bossBase.js';
import { initCombat, updateCombat } from './game/combat.js';
import { updatePowerups, drawPowerups } from './game/powerups.js';
import { updateCombo, Combo, triggerOverdrive } from './game/combo.js';
import { updateHud, drawHud } from './ui/hud.js';
import { updateScreens, drawScreens, resetScreens } from './ui/screens.js';
import { initBridge, notifyGameOver } from './bridge.js';
import { on } from './engine/bus.js';
import { dist2 } from './engine/rand.js';

// ---- homing target provider (nearest foe/boss part to x,y) ----
setTargetProvider((x, y) => {
  let best = null, bd = Infinity;
  for (const f of foes) {
    const d = dist2(x, y, f.x, f.y);
    if (d < bd) { bd = d; best = f; }
  }
  if (boss && boss.state === 'fight') {
    const d = dist2(x, y, boss.x, boss.y);
    if (d < bd * 1.4) {
      return { x: boss.x, y: boss.y, dead: false, hp: 1 };
    }
  }
  return best; // foe objects have x,y,hp,dead
});

// ---- global events ----
on('gameOver', (d) => notifyGameOver(d.score));
on('playerDied', () => { setIntensity(0.2); });

// ---- boot ----
const canvas = document.getElementById('game');
initRenderer(canvas);
buildSprites();
initInput(canvas);
initBackdrop();
loadScores();
initBridge();
initCombat();
wireDirector();
resetScreens();

S.mode = 'title';
fadeNow(1);
fadeTo(0, 1.2);

const splash = document.getElementById('splash');
if (splash) splash.remove();

let lastTs = performance.now();
let audioStarted = false;
let fpsAcc = 0, fpsN = 0, fpsClock = 0;

// ---- master loop ----
function loop(ts) {
  requestAnimationFrame(loop);
  let realDt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!(realDt > 0)) realDt = 1 / 60;
  if (realDt > 0.25) realDt = 0.25;

  // audio unlock on first interaction
  if (!audioStarted && In.anyPress) {
    resumeAudio();
    musicPlay('title');
    audioStarted = true;
  }

  updateCam(realDt);
  updatePostfx(realDt);

  timeFrame(realDt, updateWorld);

  render();
  watchdog(realDt);
}

function updateWorld() {
  S.frame++;
  updateInput();

  // global keys
  if (In.muteToggle) {
    S.muted = !S.muted;
    setMuted(S.muted);
  }

  const m = S.mode;
  if (m === 'playing') {
    if (In.pause) {
      S.mode = 'paused';
      return;
    }
    if (In.overdrive) triggerOverdrive(false);
    updateCombo(Time.dt);
    updatePlayer(Time.dt);
    updateWeapons(Time.dt);
    updateBullets(Time.dt);
    updateFoes(Time.dt);
    updateFormation(Time.dt);
    updateDirector(Time.dt);
    updateBoss(Time.dt);
    updateCombat();
    updatePowerups(Time.dt);
    updateParticles(Time.dt);
    updateFx(Time.dt);
    updateBackdrop(Time.dt);
    updateCine(Time.dt);
    updateHud(Time.dt);
    // music intensity follows battlefield density
    const threat = Math.min(1, 0.3 + foes.length * 0.06 + (boss ? 0.45 : 0));
    setIntensity(threat);
  } else if (m === 'paused') {
    if (In.pause || In.confirm || In.tap) S.mode = 'playing';
  } else {
    // title / howto / scores / gameover
    updateBackdrop(Time.dt);
    updateParticles(Time.dt);
    updateFx(Time.dt);
    updateHud(Time.dt);
    updateScreens(Time.dt);
    if (m !== 'title') musicPlay('title');
  }

  // BOSS-MOMENT AUTO-CAPTURE: record sizing telemetry through every boss intro
  // (paste __NVBOSSCAP in console after seeing anything weird)
  if (boss && boss.state === 'enter' && (!window.__NVBOSSCAP || !window.__NVBOSSCAP.on)) {
    window.__NVBOSSCAP = { on: true, rows: [] };
    const cap = setInterval(() => {
      const bs = boss;
      if (!bs || window.__NVBOSSCAP.rows.length > 40) { clearInterval(cap); window.__NVBOSSCAP.on = false; return; }
      try {
        const d = fitDiagnostics();
        window.__NVBOSSCAP.rows.push({
          s: bs.state, hp: Math.round(bs.hp),
          vis: d.vis.src + ' ' + d.vis.x.toFixed(2) + 'x' + d.vis.y.toFixed(2),
          back: d.backing.w + 'x' + d.backing.h, inner: d.inner.w + 'x' + d.inner.h,
          dpr: +d.dpr.toFixed(2), rect: d.rect.w + 'x' + d.rect.h,
          z: document.documentElement.style.zoom || '-',
        });
      } catch (e) { /* keep ticking */ }
    }, 250);
  }
}

// ---- render ----
function render() {
  const m = S.mode;

  // world layer
  drawBackdrop(wctx);
  if (m === 'playing' || m === 'paused' || m === 'gameover') {
    drawPowerups(wctx);
    drawFoes(wctx);
    drawBoss(wctx);
    drawPlayer(wctx);
    drawBullets(wctx);
    drawParticles(wctx);
    drawFx(wctx);
    drawPopups(wctx);
  }

  // screen composition
  renderPostfx();
  screenTransform(view);
  drawCine(view);
  drawHud(view);
  drawScreens(view);
}

// ---- adaptive quality ladder ----
// tier 0: full | 1: world 0.72 | 2: world 0.5 + light bloom | 3: world 0.5 + no bloom
let qTier = 0;
let goodWindows = 0;
function applyTier(t) {
  qTier = t;
  if (t === 0) { setQuality(1); setBloom(0.68); setParticleCap(3200); setWarDensity(34); }
  else if (t === 1) { setQuality(0.72); setBloom(0.58); setParticleCap(2400); setWarDensity(24); }
  else if (t === 2) { setQuality(0.5); setBloom(0.34); setParticleCap(1600); setWarDensity(14); }
  else { setQuality(0.5); setBloom(0); setParticleCap(1000); setWarDensity(8); }
}
function watchdog(realDt) {
  fpsAcc += Time.fps; fpsN++; fpsClock += realDt;
  if (fpsClock >= 3) {
    const avg = fpsAcc / fpsN;
    if (avg < 47 && qTier < 3) {
      applyTier(qTier + 1);
      goodWindows = 0;
    } else if (avg > 57 && qTier > 0) {
      // recover only after sustained headroom (3 good windows in a row)
      if (++goodWindows >= 3) { applyTier(qTier - 1); goodWindows = 0; }
    } else {
      goodWindows = 0;
    }
    fpsAcc = 0; fpsN = 0; fpsClock = 0;
  }
}

requestAnimationFrame(loop);

// WAR_ROOM diagnostic handle (read-only probes + stage/boss jumps for testing)
window.__NV = {
  S, Combo, Time,
  get Pl() { return Pl; },
  foes,
  startStage: (n) => { S.mode = 'playing'; startStage(n); },
  spawnBoss: (kind, diff = 1) => { S.mode = 'playing'; const b = spawnBoss(kind, diff); b.state = 'fight'; b.enterDone = true; b.y = 420; return b.kind; },
  boss: () => boss,
  hit: (x, y, dmg = 1) => bossTestHit(x, y, dmg),   // diagnostic: test boss hit zones
  nvs: () => fitDiagnostics(),                      // full size/fit diagnostic snapshot
};
