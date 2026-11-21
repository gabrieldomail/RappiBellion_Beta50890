// weapons.js — tiered weapon system (bolt ladder + homing missile pods at MAX)
import { Pl } from './player.js';
import { In } from '../engine/input.js';
import { S } from './state.js';
import { fireBolt, fireMissile } from './bullets.js';
import { sfx } from '../engine/audio.js';
import { spawn as pSpawn } from '../engine/particles.js';
import { TAU } from '../engine/rand.js';

let cd = 0;
let mslCd = 0;
let mslSide = 1;

// tier 1: single | 2: twin | 3: twin+angled pair | 4: triple spread + pair | 5: MAX + missile pods
export function updateWeapons(dt) {
  if (!Pl.alive || Pl.hidden) return;
  cd -= dt;
  mslCd -= dt;

  if (In.fire && cd <= 0) {
    cd = 0.15;
    const x = Pl.x, y = Pl.y - 40;
    const t = S.weaponTier;
    muzzle(x, y - 8);
    if (t === 1) {
      fireBolt(x, y, 0, -1350, 1);
      sfx.laser();
    } else if (t === 2) {
      fireBolt(x - 14, y, 0, -1350, 1);
      fireBolt(x + 14, y, 0, -1350, 1);
      sfx.laser();
    } else if (t === 3) {
      fireBolt(x - 14, y, 0, -1350, 1);
      fireBolt(x + 14, y, 0, -1350, 1);
      fireBolt(x - 30, y + 6, -260, -1300, 1);
      fireBolt(x + 30, y + 6, 260, -1300, 1);
      sfx.laser();
    } else {
      fireBolt(x, y - 6, 0, -1400, 2);
      fireBolt(x - 16, y, -150, -1350, 1);
      fireBolt(x + 16, y, 150, -1350, 1);
      fireBolt(x - 32, y + 8, -340, -1280, 1);
      fireBolt(x + 32, y + 8, 340, -1280, 1);
      sfx.laserBig();
    }
  }

  if (S.weaponTier >= 5 && mslCd <= 0 && In.fire) {
    mslCd = 0.5;
    mslSide *= -1;
    fireMissile(Pl.x + mslSide * 34, Pl.y - 6, mslSide);
  }
}

function muzzle(x, y) {
  pSpawn({ x, y, vx: 0, vy: -140, life: 0.09, size: 13, col: '#bffbff', type: 'glow', shrink: 1, endSize: 2 });
}
