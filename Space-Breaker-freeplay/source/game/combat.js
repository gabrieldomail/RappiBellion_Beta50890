// combat.js — collisions: shots vs foes/boss, enemy fire vs player, graze, bombs
import { shots, eshots, beamHit, enemyBulletSweep } from './bullets.js';
import { foes, damageFoe } from './enemies.js';
import { Pl, hitPlayer } from './player.js';
import { addGraze } from './combo.js';
import { on } from '../engine/bus.js';
import { bossTestHit, bossBombHit, bossActive } from './bosses/bossBase.js';
import { explSmall } from '../fx/explosions.js';
import { dist2 } from '../engine/rand.js';
import { S } from './state.js';

export function initCombat() {
  on('bomb', () => {
    enemyBulletSweep();
    for (let i = foes.length - 1; i >= 0; i--) {
      const f = foes[i];
      explSmall(f.x, f.y, f.def.col);
      damageFoe(f, 3);
    }
    bossBombHit(90);
  });
}

export function updateCombat() {
  if (S.mode !== 'playing') return;

  // ---- player shots vs foes & boss ----
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    let consumed = false;

    if (bossActive()) {
      if (bossTestHit(s.x, s.y, s.dmg)) consumed = true;
    }
    if (!consumed) {
      for (let j = foes.length - 1; j >= 0; j--) {
        const f = foes[j];
        const rr = f.def.r + (s.kind === 'missile' ? 14 : 8);
        if (dist2(s.x, s.y, f.x, f.y) < rr * rr) {
          damageFoe(f, s.dmg);
          consumed = true;
          break;
        }
      }
    }
    if (consumed) {
      if (s.kind === 'missile') explSmall(s.x, s.y, '#8ef0ff');
      shots.splice(i, 1);
    }
  }

  if (Pl.hidden) return;

  // ---- graze ----
  const grIn = (Pl.r + 16) * (Pl.r + 16);
  const grOut = (Pl.r + 44) * (Pl.r + 44);
  for (const b of eshots) {
    if (b.grazed) continue;
    const d2 = dist2(b.x, b.y, Pl.x, Pl.y);
    if (d2 < grOut && d2 > grIn) {
      b.grazed = true;
      addGraze();
    }
  }

  // ---- enemy shots vs player ----
  const hitR = Pl.r + 8;
  for (let i = eshots.length - 1; i >= 0; i--) {
    const b = eshots[i];
    const rr = hitR + b.r * 0.6;
    if (dist2(b.x, b.y, Pl.x, Pl.y) < rr * rr) {
      eshots.splice(i, 1);
      hitPlayer();
      break;
    }
  }

  // ---- beams vs player ----
  if (beamHit(Pl.x, Pl.y, 8)) hitPlayer();

  // ---- ramming foes ----
  for (let i = foes.length - 1; i >= 0; i--) {
    const f = foes[i];
    const rr = Pl.r + f.def.r - 6;
    if (dist2(f.x, f.y, Pl.x, Pl.y) < rr * rr) {
      hitPlayer();
      damageFoe(f, 2);
      break;
    }
  }
}
