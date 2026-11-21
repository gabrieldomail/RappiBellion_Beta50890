// state.js — central mutable game state (no imports: safe dependency root)
export const S = {
  mode: 'boot',        // boot|title|howto|scores|playing|paused|gameover
  score: 0,
  hi: 0,
  lives: 3,
  stage: 0,
  sector: 0,           // palette index (0..4)
  inIframe: false,
  muted: false,
  frame: 0,
  speedMult: 1,        // OVERDRIVE_SENSITIVITY from parent
  weaponTier: 1,
  odReady: false,      // overdrive meter full
  challenging: false,  // current stage is a challenging stage
  bossStage: false,
  lastScoreSent: -1,
  version: 'NV-2026.1',
};

export function addScore(n) {
  S.score += n | 0;
  if (S.score > S.hi) S.hi = S.score;
}

// ---- High scores (legacy-compatible: LocalSave.highScores, top-5 object) ----
const LS_KEY = 'LocalSave.highScores';

export function loadScores() {
  let hi = 0;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k in o) hi = Math.max(hi, o[k] | 0);
    }
  } catch (e) { /* corrupt store: ignore */ }
  S.hi = hi;
}

export function getTop5() {
  let arr = [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k in o) arr.push(o[k] | 0);
    }
  } catch (e) { arr = []; }
  arr.sort((a, b) => b - a);
  return arr.slice(0, 5);
}

export function saveScoreValue(v) {
  try {
    const o = {};
    let arr = getTop5();
    arr.push(v | 0);
    arr.sort((a, b) => b - a);
    arr = arr.slice(0, 5);
    for (let i = 0; i < arr.length; i++) o[i + ''] = arr[i];
    if (arr.length < 5) for (let i = arr.length; i < 5; i++) o[i + ''] = 0;
    localStorage.setItem(LS_KEY, JSON.stringify(o));
  } catch (e) { /* storage unavailable */ }
}
