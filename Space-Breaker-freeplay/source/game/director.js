// director.js — stage orchestration: timelines, slots, dives, clears, game over
import { W } from '../engine/renderer.js';
import { S } from './state.js';
import { getStage } from './stages.js';
import { initFormation, Form } from './formation.js';
import { spawnFoe, foes, diveTick } from './enemies.js';
import { clearBullets, enemyBulletSweep } from './bullets.js';
import { clearBoss, spawnBoss, bossActive } from './bosses/bossBase.js';
import { resetPlayer, Pl } from './player.js';
import { resetCombo, comboBreak } from './combo.js';
import { drops } from './powerups.js';
import { setSector } from '../fx/backdrop.js';
import { banner, bossWarning, challengeResults } from '../fx/cinematics.js';
import { musicPlay, musicStop, setIntensity, sfx } from '../engine/audio.js';
import { on, emit } from '../engine/bus.js';
import { saveScoreValue } from './state.js';
import { SECTORS } from '../palettes.js';
import { clearParticles } from '../engine/particles.js';
import { rand } from '../engine/rand.js';

export const Dir = {
  state: 'idle',       // idle | cine | run | transition | gameover
  stageN: 0,
  diff: 1,
  t: 0, tlIdx: 0, timeline: [], pending: [],
  diveT: 2.2, transT: 0,
  chalHits: 0, chalTotal: 0,
  startedOnce: false,
};

let wired = false;

export function wireDirector() {
  if (wired) return;
  wired = true;
  on('playerDied', () => {
    // classic fairness: sweep the bullet field and drop the chain on death
    enemyBulletSweep();
    comboBreak();
    if (S.lives <= 0) endGame();
  });
  on('kill', () => { if (S.challenging) Dir.chalHits++; });
}

export function startGame() {
  S.mode = 'playing';
  S.score = 0; S.lives = 3; S.weaponTier = 1;
  resetCombo();
  foes.length = 0;
  clearBullets();
  drops.length = 0;
  clearBoss();
  clearParticles();
  resetPlayer(true);
  Dir.startedOnce = true;
  startStage(1);
}

export function startStage(n) {
  const st = getStage(n);
  S.stage = n;
  S.sector = st.sector;
  S.challenging = st.challenge;
  S.bossStage = st.bossStage;
  setSector(st.sector);
  musicPlay('game');
  setIntensity(Math.min(1, 0.25 + n * 0.05));

  Dir.stageN = n;
  Dir.diff = st.diff;
  Dir.t = 0;
  Dir.tlIdx = 0;
  Dir.timeline = st.waves;
  Dir.pending = [];
  Dir.diveT = 2.4;
  Dir.chalHits = 0;
  Dir.chalTotal = 0;

  initFormation(n < 5 ? 8 : 10, 4);

  if (st.bossStage) {
    Dir.state = 'cine';
    const names = {
      seraph: 'SERAPH-CLASS CARRIER',
      nova: 'NOVA-LANCE',
      hydra: 'HYDRA-CORE',
    };
    bossWarning(names[st.boss], () => {
      const boss = spawnBoss(st.boss, st.diff);
      boss.stageN = n;
      Dir.state = 'run';
      musicPlay('boss');
    });
  } else {
    Dir.state = 'run';
    const sec = SECTORS[st.sector];
    banner(
      st.challenge ? 'CHALLENGING STAGE' : 'STAGE ' + n,
      sec.name + (st.challenge ? ' · BONUS' : ''),
      2.0
    );
    sfx.stageClear();
  }
}

function occupiedSlots() {
  const set = new Set();
  for (const f of foes) {
    if (f.slot) set.add(f.slot.col + ',' + f.slot.row);
  }
  return set;
}

function nextFreeSlot(row, occ) {
  const cols = Form.cols;
  const order = [];
  const mid = (cols - 1) / 2;
  for (let c = 0; c < cols; c++) order.push(c);
  order.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  if (row >= 0) {
    for (const c of order) if (!occ.has(c + ',' + row)) { occ.add(c + ',' + row); return { col: c, row }; }
  }
  for (let r = 0; r < Form.rows; r++) {
    for (const c of order) {
      if (!occ.has(c + ',' + r)) { occ.add(c + ',' + r); return { col: c, row: r }; }
    }
  }
  return null;
}

function doSpawn(spec, i) {
  const occ = occupiedSlots();
  if (spec.train) {
    // challenge train: staggered pass-through foes on a shared corridor
    const baseX = rand(180, W - 180);
    spawnFoe(spec.type, spec.entry, null, Dir.diff, {
      pathTo: [baseX, 300 + i * 8],
    });
    Dir.chalTotal++;
    return;
  }
  const slot = spec.row !== undefined ? nextFreeSlot(spec.row, occ) : nextFreeSlot(-1, occ);
  const def = spec;
  const opts = {};
  if (spec.type === 'carrier') opts.dir = Math.random() < 0.5 ? 1 : -1;
  spawnFoe(spec.type, spec.entry, slot, Dir.diff, opts);
  if (spec.row !== undefined && !slot) { /* grid full: spawn anyway without slot */ }
}

export function updateDirector(dt) {
  if (S.mode !== 'playing') return;

  if (Dir.state === 'cine') return; // waiting on WARNING

  if (Dir.state === 'transition') {
    Dir.transT -= dt;
    if (Dir.transT <= 0) startStage(Dir.stageN + 1);
    return;
  }

  if (Dir.state !== 'run') return;

  Dir.t += dt;

  // timeline events
  while (Dir.tlIdx < Dir.timeline.length && Dir.t >= Dir.timeline[Dir.tlIdx].t) {
    const ev = Dir.timeline[Dir.tlIdx++];
    for (const spec of ev.spawns) {
      for (let i = 0; i < spec.n; i++) {
        Dir.pending.push({ spec, at: Dir.t + i * 0.22 });
      }
    }
  }
  // staggered pending spawns
  for (let i = Dir.pending.length - 1; i >= 0; i--) {
    if (Dir.t >= Dir.pending[i].at) {
      doSpawn(Dir.pending[i].spec, i);
      Dir.pending.splice(i, 1);
    }
  }

  // dive scheduler
  if (!S.challenging && !S.bossStage) {
    Dir.diveT -= dt;
    if (Dir.diveT <= 0) {
      Dir.diveT = rand(1.6, 2.6) / Math.max(0.7, Dir.diff * 0.75);
      const n = Dir.diff > 1.7 ? 2 : 1;
      diveTick(n, Dir.diff);
    }
  }

  // stage clear?
  const timelineDone = Dir.tlIdx >= Dir.timeline.length && Dir.pending.length === 0;
  if (timelineDone && foes.length === 0 && !bossActive()) {
    if (S.challenging) {
      const perfect = Dir.chalHits >= Dir.chalTotal && Dir.chalTotal > 0;
      if (perfect && S.lives < 6) {
        S.lives++;
        sfx.oneUp();
      }
      sfx.stageClear();
      Dir.state = 'transition';
      Dir.transT = 3.6;
      challengeResults(Dir.chalHits, Dir.chalTotal, perfect, null);
      // bonus
      const bonus = Dir.chalHits * 100 + (perfect ? 3000 : 0);
      S.score += bonus;
    } else {
      sfx.stageClear();
      banner('STAGE CLEAR', '', 1.6);
      Dir.state = 'transition';
      Dir.transT = 2.6;
    }
    enemyBulletSweep();
  }
}

function endGame() {
  Dir.state = 'gameover';
  S.mode = 'gameover';
  saveScoreValue(S.score);
  musicStop();
  emit('gameOver', { score: S.score, hi: S.hi });
}
