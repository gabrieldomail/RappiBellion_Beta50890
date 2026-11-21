// stages.js — authored wave sets, boss cadence (every 3rd), challenging stages (every 4th)
export function getStage(n) {
  const bossStage = n % 3 === 0;
  const challenge = !bossStage && n % 4 === 0;
  const diff = Math.min(2.6, 1 + (n - 1) * 0.075);
  const sector = (n - 1) % 5;

  if (bossStage) {
    const kinds = ['seraph', 'nova', 'hydra'];
    const boss = kinds[(Math.floor(n / 3) - 1) % 3];
    return { n, bossStage: true, challenge: false, diff, sector, boss, waves: [] };
  }
  if (challenge) {
    return { n, bossStage: false, challenge: true, diff, sector, waves: genChallenge(n) };
  }

  // authored sets cycle for normals; loop counter tightens timings
  const sets = [WAVES_A, WAVES_B, WAVES_C];
  const idx = normalIndex(n);
  const loop = Math.floor(idx / 3); // times the same set repeats
  const waves = tighten(sets[idx % 3], loop);
  return { n, bossStage: false, challenge: false, diff, sector, waves };
}

function normalIndex(n) {
  let c = 0;
  for (let k = 1; k <= n; k++) {
    if (k % 3 !== 0 && k % 4 !== 0) c++;
  }
  return c - 1; // 0-based
}

function tighten(waves, loop) {
  if (loop <= 0) return waves;
  const k = Math.max(0.45, 1 - loop * 0.18);
  return waves.map((w) => ({ ...w, t: w.t * k }));
}

function genChallenge(n) {
  const waves = [];
  const entries = ['swoopL', 'swoopR', 'split', 'sideL', 'sideR', 'topC'];
  for (let i = 0; i < 5; i++) {
    waves.push({
      t: i * 3.4,
      spawns: [{ type: i % 2 ? 'fighter' : 'drone', n: 8, entry: entries[i % entries.length], train: true }],
    });
  }
  return waves;
}

// ---- Set A: stage 1 (teach the dance) ----
const WAVES_A = [
  { t: 0,  spawns: [{ type: 'drone', n: 8, entry: 'swoopL', row: 3 }] },
  { t: 4,  spawns: [{ type: 'drone', n: 8, entry: 'swoopR', row: 2 }] },
  { t: 9,  spawns: [{ type: 'fighter', n: 6, entry: 'split', row: 1 }] },
  { t: 13, spawns: [{ type: 'carrier', n: 1, entry: 'sideL' }] },
  { t: 15, spawns: [{ type: 'spinner', n: 2, entry: 'sideL' }] },
  { t: 19, spawns: [{ type: 'drone', n: 6, entry: 'sideR', row: 3 }] },
  { t: 23, spawns: [{ type: 'elite', n: 4, entry: 'swoopL', row: 0 }] },
  { t: 27, spawns: [{ type: 'sniper', n: 2, entry: 'sideR' }] },
  { t: 31, spawns: [{ type: 'mine', n: 5, entry: 'topC' }] },
];

// ---- Set B: stage 5 (pressure) ----
const WAVES_B = [
  { t: 0,  spawns: [{ type: 'fighter', n: 8, entry: 'swoopL', row: 2 }] },
  { t: 3,  spawns: [{ type: 'drone', n: 8, entry: 'swoopR', row: 3 }] },
  { t: 7,  spawns: [{ type: 'elite', n: 4, entry: 'split', row: 0 }] },
  { t: 10, spawns: [{ type: 'turret', n: 2, entry: 'sideL' }] },
  { t: 14, spawns: [{ type: 'bomber', n: 2, entry: 'topC' }] },
  { t: 17, spawns: [{ type: 'carrier', n: 1, entry: 'sideR' }] },
  { t: 19, spawns: [{ type: 'drone', n: 8, entry: 'topC', row: 3 }] },
  { t: 23, spawns: [{ type: 'sniper', n: 2, entry: 'sideL' }] },
  { t: 26, spawns: [{ type: 'fighter', n: 6, entry: 'split', row: 1 }] },
  { t: 30, spawns: [{ type: 'mine', n: 6, entry: 'topC' }] },
  { t: 34, spawns: [{ type: 'spinner', n: 3, entry: 'sideR' }] },
  { t: 36, spawns: [{ type: 'elite', n: 4, entry: 'swoopR', row: 0 }] },
];

// ---- Set C: stage 8+ (heavy) ----
const WAVES_C = [
  { t: 0,  spawns: [{ type: 'elite', n: 6, entry: 'swoopL', row: 0 }] },
  { t: 3,  spawns: [{ type: 'fighter', n: 8, entry: 'swoopR', row: 1 }] },
  { t: 6,  spawns: [{ type: 'drone', n: 10, entry: 'split', row: 3 }] },
  { t: 10, spawns: [{ type: 'turret', n: 3, entry: 'sideL' }] },
  { t: 13, spawns: [{ type: 'bomber', n: 3, entry: 'topC' }] },
  { t: 16, spawns: [{ type: 'carrier', n: 2, entry: 'sideL' }] },
  { t: 18, spawns: [{ type: 'sniper', n: 3, entry: 'sideR' }] },
  { t: 21, spawns: [{ type: 'spinner', n: 4, entry: 'sideL' }] },
  { t: 24, spawns: [{ type: 'mine', n: 8, entry: 'topC' }] },
  { t: 27, spawns: [{ type: 'fighter', n: 8, entry: 'topC', row: 2 }] },
  { t: 31, spawns: [{ type: 'elite', n: 6, entry: 'split', row: 0 }] },
  { t: 34, spawns: [{ type: 'bomber', n: 2, entry: 'topC' }] },
];
