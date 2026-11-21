// combo.js — kill-chain multiplier, graze bonuses, overdrive meter + Itano barrage
import { addScore, S } from './state.js';
import { popup } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { emit } from '../engine/bus.js';
import { fireMissile } from './bullets.js';
import { shockRing } from '../fx/explosions.js';
import { flash } from '../engine/postfx.js';
import { W, H } from '../engine/renderer.js';
import { addShake } from '../fx/camera.js';
import { Pl } from './player.js';
import { rand } from '../engine/rand.js';
import { aberration, glitch } from '../engine/postfx.js';

export const Combo = {
  chain: 0,
  mult: 1,
  timer: 0,
  meter: 0,          // 0..100 overdrive
  graze: 0,
  odT: 0,            // overdrive active time remaining
  odSide: 1,
  odSpawnT: 0,
  bestChain: 0,
};

const WINDOW = 2.2;

function multForChain(c) {
  if (c >= 40) return 8;
  if (c >= 28) return 6;
  if (c >= 18) return 4;
  if (c >= 10) return 3;
  if (c >= 5) return 2;
  return 1;
}

export function applyScore(base, x, y) {
  Combo.chain++;
  Combo.timer = WINDOW;
  Combo.bestChain = Math.max(Combo.bestChain, Combo.chain);
  const prevM = Combo.mult;
  Combo.mult = multForChain(Combo.chain);
  if (Combo.mult > prevM) {
    popup(x, y - 34, 'x' + Combo.mult + ' CHAIN', '#ffd23f', 34);
  }
  const gained = Math.round(base * Combo.mult * (Combo.odT > 0 ? 2 : 1));
  addScore(gained);
  popup(x, y, '+' + gained, Combo.mult > 1 ? '#ffd23f' : '#9ff', 30);
  return gained;
}

export function killMeter(v) {
  if (Combo.odT > 0) return;
  const was = Combo.meter;
  Combo.meter = Math.min(100, Combo.meter + v);
  if (was < 100 && Combo.meter >= 100) {
    S.odReady = true;
    sfx.pulseReady();
    popup(W / 2, H - 320, 'OVERDRIVE READY  [E]', '#ffb0ff', 40);
  }
}

export function addGraze() {
  Combo.graze++;
  Combo.meter = Math.min(100, Combo.meter + 1.6);
  addScore(50);
  sfx.graze();
}

export function comboBreak() {
  if (Combo.chain >= 10) popup(W / 2, 240, 'CHAIN LOST', '#ff6b6b', 30);
  Combo.chain = 0;
  Combo.mult = 1;
  Combo.timer = 0;
}

export function updateCombo(dt) {
  if (Combo.timer > 0) {
    Combo.timer -= dt;
    if (Combo.timer <= 0) comboBreak();
  }
  if (Combo.odT > 0) {
    Combo.odT -= dt;
    Combo.odSpawnT -= dt;
    if (Combo.odSpawnT <= 0) {
      Combo.odSpawnT = 0.055;
      Combo.odSide *= -1;
      fireMissile(W / 2 + Combo.odSide * rand(80, 480), H - 120, Combo.odSide);
      if (Math.random() < 0.6) fireMissile(W / 2 - Combo.odSide * rand(80, 480), H - 120, -Combo.odSide);
    }
    if (Combo.odT <= 0) {
      shockRing(Pl.x, Pl.y, '#ffb0ff', 500);
      flash(255, 120, 255, 0.25);
      addShake(0.3);
    }
  }
}

// forced=true when the platform injects ATOMIC_PULSE (a purchased boost)
export function triggerOverdrive(forced = false) {
  if (Combo.odT > 0) return false;
  if (!forced && Combo.meter < 100) return false;
  Combo.odT = 3.2;
  Combo.odSpawnT = 0;
  Combo.meter = 0;
  S.odReady = false;
  sfx.pulseFire();
  flash(190, 90, 255, 0.45);
  aberration(1);
  glitch(0.28, 1);
  addShake(0.45);
  emit('overdrive');
  return true;
}

export function resetCombo() {
  Combo.chain = 0; Combo.mult = 1; Combo.timer = 0;
  Combo.meter = 0; Combo.graze = 0; Combo.odT = 0;
  Combo.bestChain = 0;
  S.odReady = false;
}
