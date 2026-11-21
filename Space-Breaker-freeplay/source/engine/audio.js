// audio.js — WebAudio synth engine: procedural SFX + Macross power-rock sequencer
// (hero lead melodies, distorted power chords, double-kick boss, sidechain pump)
export const Aud = {
  ready: false,
  muted: false,
  intensity: 0,          // 0..1 music layering (drives arp density, lead/guitar gates)
};

let ctx = null, master, comp, sfxBus, musBus, revSend, delSend, noiseBuf;
const throttle = new Map();

function now() { return ctx ? ctx.currentTime : 0; }

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export function initAudio() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return false; }

  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 22; comp.ratio.value = 8;
  comp.attack.value = 0.004; comp.release.value = 0.2;
  master = ctx.createGain(); master.gain.value = 0.55;
  comp.connect(master); master.connect(ctx.destination);

  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
  musBus = ctx.createGain(); musBus.gain.value = 0.42; musBus.connect(comp);

  // reverb
  const rev = ctx.createConvolver();
  const len = (ctx.sampleRate * 1.7) | 0;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  rev.buffer = ir;
  const revG = ctx.createGain(); revG.gain.value = 0.9;
  revSend = ctx.createGain(); revSend.gain.value = 1;
  revSend.connect(rev); rev.connect(revG); revG.connect(comp);

  // delay (music sparkle)
  const del = ctx.createDelay(1); del.delayTime.value = 0.27;
  const fb = ctx.createGain(); fb.gain.value = 0.3;
  del.connect(fb); fb.connect(del);
  const delG = ctx.createGain(); delG.gain.value = 0.35;
  del.connect(delG); delG.connect(musBus);
  delSend = del;

  // shared noise buffer
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  Aud.ready = true;
  return true;
}

export function resumeAudio() {
  if (!ctx && !initAudio()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

export function setMuted(m) {
  Aud.muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, now(), 0.02);
}

function gate(name, gapMs) {
  const t = performance.now();
  const last = throttle.get(name) || 0;
  if (t - last < gapMs) return false;
  throttle.set(name, t);
  return true;
}

function osc(type, f, t, dur, vol, dest, opts = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t + dur * (opts.slideT || 1));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (opts.a ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  if (opts.filter) {
    const fl = ctx.createBiquadFilter();
    fl.type = opts.filter[0]; fl.frequency.value = opts.filter[1];
    if (opts.fSlide) fl.frequency.exponentialRampToValueAtTime(opts.fSlide, t + dur);
    g.connect(fl); fl.connect(dest);
  } else {
    g.connect(dest);
  }
  if (opts.rev) { const rg = ctx.createGain(); rg.gain.value = opts.rev; g.connect(rg); rg.connect(revSend); }
  o.start(t); o.stop(t + dur + 0.05);
  return o;
}

function noise(t, dur, vol, dest, opts = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf; src.loop = true;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (opts.a ?? 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const fl = ctx.createBiquadFilter();
  fl.type = opts.type || 'lowpass';
  fl.frequency.setValueAtTime(opts.f || 1400, t);
  if (opts.fSlide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, opts.fSlide), t + dur);
  if (opts.q) fl.Q.value = opts.q;
  src.connect(fl); fl.connect(g); g.connect(dest);
  if (opts.rev) { const rg = ctx.createGain(); rg.gain.value = opts.rev; g.connect(rg); rg.connect(revSend); }
  src.start(t); src.stop(t + dur + 0.05);
}

// ---------------- SFX ----------------
export const sfx = {
  laser() {
    if (!ctx || !gate('laser', 40)) return;
    const t = now();
    osc('sawtooth', 900, t, 0.09, 0.10, sfxBus, { slide: 180 });
    osc('square', 1400, t, 0.05, 0.05, sfxBus, { slide: 300 });
  },
  laserBig() {
    if (!ctx || !gate('laserBig', 60)) return;
    const t = now();
    osc('sawtooth', 640, t, 0.14, 0.16, sfxBus, { slide: 90, rev: 0.12 });
  },
  enemyShot() {
    if (!ctx || !gate('enemyShot', 70)) return;
    const t = now();
    osc('square', 340, t, 0.09, 0.045, sfxBus, { slide: 170 });
  },
  hit() {
    if (!ctx || !gate('hit', 30)) return;
    const t = now();
    noise(t, 0.06, 0.16, sfxBus, { f: 2600, fSlide: 500 });
    osc('triangle', 260, t, 0.08, 0.14, sfxBus, { slide: 70 });
  },
  explSmall() {
    if (!ctx || !gate('explS', 45)) return;
    const t = now();
    noise(t, 0.3, 0.4, sfxBus, { f: 1500, fSlide: 160, rev: 0.25 });
    osc('sine', 170, t, 0.28, 0.35, sfxBus, { slide: 40 });
  },
  explBig() {
    if (!ctx) return;
    const t = now();
    noise(t, 0.75, 0.6, sfxBus, { f: 1800, fSlide: 90, rev: 0.4 });
    osc('sine', 120, t, 0.55, 0.5, sfxBus, { slide: 28 });
    osc('sawtooth', 240, t, 0.3, 0.18, sfxBus, { slide: 50 });
  },
  bossHurt() {
    if (!ctx || !gate('bossHurt', 60)) return;
    const t = now();
    osc('square', 95, t, 0.14, 0.22, sfxBus, { slide: 55, filter: ['lowpass', 900] });
    noise(t, 0.1, 0.22, sfxBus, { f: 700, q: 6 });
  },
  bossExpl() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 5; i++) {
      noise(t + i * 0.12, 0.5, 0.4, sfxBus, { f: 1600 - i * 200, fSlide: 80, rev: 0.5 });
      osc('sine', 150 - i * 15, t + i * 0.12, 0.4, 0.4, sfxBus, { slide: 30 });
    }
  },
  pickup() {
    if (!ctx) return;
    const t = now();
    [76, 80, 83, 88].forEach((m, i) => osc('square', mtof(m), t + i * 0.055, 0.09, 0.1, sfxBus, { rev: 0.2 }));
  },
  medal() {
    if (!ctx || !gate('medal', 50)) return;
    const t = now();
    osc('sine', mtof(93), t, 0.06, 0.09, sfxBus);
    osc('sine', mtof(98), t + 0.05, 0.1, 0.09, sfxBus, { rev: 0.15 });
  },
  life() {
    if (!ctx) return;
    const t = now();
    [72, 76, 79, 84, 88].forEach((m, i) => osc('triangle', mtof(m), t + i * 0.09, 0.22, 0.14, sfxBus, { rev: 0.3 }));
  },
  dash() {
    if (!ctx || !gate('dash', 100)) return;
    const t = now();
    noise(t, 0.16, 0.2, sfxBus, { type: 'highpass', f: 900, fSlide: 4500 });
    osc('sawtooth', 200, t, 0.14, 0.1, sfxBus, { slide: 640 });
  },
  graze() {
    if (!ctx || !gate('graze', 60)) return;
    const t = now();
    osc('sine', 2300, t, 0.045, 0.045, sfxBus);
  },
  warn() {
    if (!ctx) return;
    const t = now();
    for (let i = 0; i < 4; i++) {
      osc('square', i % 2 ? 470 : 622, t + i * 0.16, 0.13, 0.16, sfxBus, { filter: ['lowpass', 2400] });
    }
  },
  beamCharge(dur = 0.8) {
    if (!ctx) return;
    const t = now();
    osc('sawtooth', 90, t, dur, 0.14, sfxBus, { slide: 880, rev: 0.25, a: dur * 0.6 });
  },
  beamFire() {
    if (!ctx) return;
    const t = now();
    noise(t, 0.7, 0.4, sfxBus, { f: 500, fSlide: 2400, q: 2, rev: 0.4 });
    osc('sawtooth', 130, t, 0.6, 0.3, sfxBus, { slide: 65 });
  },
  playerDeath() {
    if (!ctx) return;
    const t = now();
    osc('sawtooth', 420, t, 0.7, 0.25, sfxBus, { slide: 46, rev: 0.4 });
    noise(t, 0.6, 0.5, sfxBus, { f: 1800, fSlide: 120, rev: 0.4 });
    osc('sine', 110, t, 0.5, 0.4, sfxBus, { slide: 26 });
  },
  uiMove() {
    if (!ctx || !gate('uiMove', 60)) return;
    osc('square', 700, now(), 0.05, 0.07, sfxBus);
  },
  uiSel() {
    if (!ctx) return;
    const t = now();
    osc('square', 900, t, 0.07, 0.1, sfxBus);
    osc('square', 1400, t + 0.06, 0.1, 0.1, sfxBus, { rev: 0.2 });
  },
  pulseReady() {
    if (!ctx) return;
    const t = now();
    [60, 67, 72, 79].forEach((m, i) => osc('sawtooth', mtof(m), t, 0.5, 0.07, sfxBus, { a: 0.2, rev: 0.4 }));
  },
  pulseFire() {
    if (!ctx) return;
    const t = now();
    osc('sawtooth', 120, t, 1.0, 0.2, sfxBus, { slide: 960, rev: 0.4 });
    noise(t, 1.0, 0.3, sfxBus, { f: 800, fSlide: 5200, rev: 0.4 });
  },
  stageClear() {
    if (!ctx) return;
    const t = now();
    [72, 76, 79, 84, 88, 91].forEach((m, i) =>
      osc('square', mtof(m), t + i * 0.09, 0.16, 0.11, sfxBus, { rev: 0.3 }));
  },
  oneUp() {
    if (!ctx) return;
    const t = now();
    [79, 79, 79, 76, 79, 83].forEach((m, i) => osc('square', mtof(m), t + i * 0.11, 0.13, 0.12, sfxBus, { rev: 0.3 }));
  },
};

// ---------------- MUSIC SEQUENCER (Macross power edition) ----------------
// 64 steps = 4 bars x 16 sixteenths. Layers: drums / bass / arp / POWER CHORDS / HERO LEAD.
const SCALE = { m: [0, 3, 7, 12], M: [0, 4, 7, 12] };

// lead melodies: {s: startStep, m: midi, l: lengthInSteps}
const GAME_LEAD = [
  { s: 0, m: 69, l: 2 }, { s: 2, m: 72, l: 2 }, { s: 4, m: 76, l: 4 }, { s: 8, m: 74, l: 2 }, { s: 10, m: 72, l: 2 }, { s: 12, m: 74, l: 3 },
  { s: 16, m: 72, l: 3 }, { s: 20, m: 69, l: 1 }, { s: 21, m: 72, l: 3 }, { s: 24, m: 77, l: 4 }, { s: 28, m: 76, l: 3 },
  { s: 32, m: 76, l: 2 }, { s: 34, m: 72, l: 2 }, { s: 36, m: 79, l: 4 }, { s: 40, m: 76, l: 2 }, { s: 42, m: 74, l: 2 }, { s: 44, m: 72, l: 3 },
  { s: 48, m: 74, l: 3 }, { s: 52, m: 71, l: 1 }, { s: 53, m: 74, l: 3 }, { s: 56, m: 79, l: 5 }, { s: 62, m: 76, l: 2 },
];
const BOSS_LEAD = [
  { s: 0, m: 74, l: 2 }, { s: 2, m: 77, l: 2 }, { s: 4, m: 81, l: 4 }, { s: 8, m: 79, l: 2 }, { s: 10, m: 77, l: 2 }, { s: 12, m: 79, l: 3 },
  { s: 16, m: 77, l: 3 }, { s: 20, m: 74, l: 1 }, { s: 21, m: 77, l: 3 }, { s: 24, m: 82, l: 4 }, { s: 28, m: 81, l: 3 },
  { s: 32, m: 81, l: 2 }, { s: 34, m: 79, l: 2 }, { s: 36, m: 84, l: 4 }, { s: 40, m: 81, l: 2 }, { s: 42, m: 79, l: 2 }, { s: 44, m: 76, l: 3 },
  { s: 48, m: 76, l: 2 }, { s: 50, m: 73, l: 2 }, { s: 52, m: 76, l: 4 }, { s: 56, m: 81, l: 4 }, { s: 60, m: 73, l: 4 },
];
const TITLE_LEAD = [
  { s: 0, m: 76, l: 8 }, { s: 8, m: 74, l: 8 }, { s: 16, m: 72, l: 8 }, { s: 24, m: 69, l: 8 },
  { s: 32, m: 72, l: 8 }, { s: 40, m: 74, l: 8 }, { s: 48, m: 71, l: 8 }, { s: 56, m: 67, l: 8 },
];
const leadMap = (arr) => { const o = {}; for (const n of arr) o[n.s] = n; return o; };

const MODES = {
  title: {
    bpm: 88, lead: leadMap(TITLE_LEAD), leadVol: 0.085,
    bars: [
      { root: 48, type: 'M', pad: [48, 52, 55, 59] },
      { root: 45, type: 'm', pad: [45, 48, 52, 55] },
      { root: 41, type: 'M', pad: [41, 45, 48, 52] },
      { root: 43, type: 'M', pad: [43, 47, 50, 55] },
    ],
    kick: [0, 8], snare: [], hat: [2, 6, 10, 14], open: [], crash: false,
    bassSteps: [0, 8], guitar: false, arpEvery: 4, drive: 0.4,
  },
  game: {
    bpm: 132, lead: leadMap(GAME_LEAD), leadVol: 0.14,
    bars: [
      { root: 45, type: 'm' }, { root: 41, type: 'M' },
      { root: 48, type: 'M' }, { root: 43, type: 'M' },
    ],
    kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], open: [2, 10], crash: 32,
    bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], guitar: [0, 8], arpEvery: 2, drive: 0.7,
  },
  boss: {
    bpm: 152, lead: leadMap(BOSS_LEAD), leadVol: 0.16,
    bars: [
      { root: 38, type: 'm' }, { root: 34, type: 'M' },
      { root: 36, type: 'M' }, { root: 33, type: 'm' },
    ],
    kick: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], hat: [1, 3, 5, 7, 9, 11, 13, 15], open: [6, 14], crash: 32,
    bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], guitar: [0, 4, 8, 12], arpEvery: 1, drive: 1,
  },
};

const MUS = { mode: null, step: 0, next: 0, timer: null };
const MUS_LEVEL = 0.42;

// ---- lead voice: detuned saw+square with vibrato, warm filter ----
function leadVoice(midi, t, dur, vol) {
  const f = mtof(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.09));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 2600; fl.Q.value = 0.8;
  g.connect(fl); fl.connect(musBus);
  const rg = ctx.createGain(); rg.gain.value = 0.22; fl.connect(rg); rg.connect(revSend);
  const dg = ctx.createGain(); dg.gain.value = 0.5; fl.connect(dg); dg.connect(delSend);
  // vibrato LFO
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vibG = ctx.createGain(); vibG.gain.value = 7;
  vib.connect(vibG);
  for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = det;
    vibG.connect(o.detune);
    o.connect(g);
    o.start(t); o.stop(t + dur + 0.1);
  }
  vib.start(t); vib.stop(t + dur + 0.1);
}

// ---- distorted power chord: root + fifth (+oct) through a waveshaper ----
let shaperCurve = null;
function guitarCurve() {
  if (shaperCurve) return shaperCurve;
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * 3.2);
  }
  shaperCurve = c;
  return shaperCurve;
}
function powerChord(rootMidi, t, dur, vol = 0.11) {
  const sh = ctx.createWaveShaper();
  sh.curve = guitarCurve();
  const fl = ctx.createBiquadFilter();
  fl.type = 'lowpass'; fl.frequency.value = 1700; fl.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.setValueAtTime(vol * 0.8, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  sh.connect(fl); fl.connect(g); g.connect(musBus);
  for (const iv of [-12, -5, 0]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = mtof(rootMidi + iv);
    o.detune.value = (Math.random() - 0.5) * 12;
    o.connect(sh);
    o.start(t); o.stop(t + dur + 0.05);
  }
}

function crashCym(t) {
  noise(t, 1.1, 0.14, musBus, { type: 'highpass', f: 5200, rev: 0.5 });
}

function scheduleStep(mode, step, t) {
  const cfg = MODES[mode];
  const bar = (step / 16) | 0;
  const s16 = step % 16;
  const b = cfg.bars[bar];
  const ch = SCALE[b.type];
  const stepDur = 60 / cfg.bpm / 4;

  // kick (with sidechain pump on the music bus)
  if (cfg.kick.includes(s16)) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g); g.connect(musBus);
    o.start(t); o.stop(t + 0.2);
    // pump
    musBus.gain.cancelScheduledValues(t);
    musBus.gain.setValueAtTime(MUS_LEVEL * 0.78, t);
    musBus.gain.linearRampToValueAtTime(MUS_LEVEL, t + 0.16);
  }
  // snare (noise + tonal body)
  if (cfg.snare.includes(s16)) {
    noise(t, 0.16, 0.3, musBus, { type: 'bandpass', f: 1900, q: 1.1 });
    osc('triangle', 210, t, 0.09, 0.16, musBus, { slide: 130 });
  }
  // hats
  if (cfg.hat.includes(s16) || (Aud.intensity > 0.55 && mode === 'game' && s16 % 2 === 1)) {
    noise(t, 0.035, 0.09, musBus, { type: 'highpass', f: 8200 });
  }
  if (cfg.open.includes(s16)) {
    noise(t, 0.13, 0.1, musBus, { type: 'highpass', f: 7400 });
  }
  // crash at cycle marks
  if (cfg.crash !== false && step % cfg.crash === 0) crashCym(t);
  // bass
  if (cfg.bassSteps.includes(s16)) {
    const oct = (s16 === 0 || s16 === 8) ? 0 : 12;
    osc('sawtooth', mtof(b.root - 12 + oct), t, stepDur * 1.7, 0.22, musBus,
      { filter: ['lowpass', 420 + Aud.intensity * 600] });
  }
  // arp (density scales with intensity)
  if (s16 % cfg.arpEvery === 0 && (mode !== 'title' || Aud.intensity < 0.5)) {
    const idx = ((step / cfg.arpEvery) | 0) % ch.length;
    const note = b.root + 24 + ch[idx];
    const g = ctx.createGain(); g.gain.value = 0.06;
    osc('square', mtof(note), t, stepDur * 1.4, 0.055, g, { filter: ['lowpass', 2300], rev: 0.12 });
    g.connect(musBus); g.connect(delSend);
  }
  // POWER CHORDS (rock drive) — gated by intensity in game mode
  if (cfg.guitar && cfg.guitar.includes(s16)) {
    if (mode === 'boss' || Aud.intensity > 0.45) {
      powerChord(b.root + 12, t, stepDur * (mode === 'boss' ? 3.4 : 6.5));
    }
  }
  // HERO LEAD — always in boss, gated in game, sparse in title
  const ln = cfg.lead[step];
  if (ln) {
    const play = mode === 'boss' || mode === 'title' || Aud.intensity > 0.25;
    if (play) leadVoice(ln.m, t, stepDur * ln.l * 0.95, cfg.leadVol);
  }
  // pad on bar start (title keeps its dreamy bed)
  if (s16 === 0 && b.pad) {
    b.pad.forEach((m) => osc('sawtooth', mtof(m), t, stepDur * 16, 0.045, musBus,
      { a: 0.5, filter: ['lowpass', 900], rev: 0.4 }));
  }
}

function musTick() {
  if (!MUS.mode || !ctx) return;
  const stepDur = 60 / MODES[MUS.mode].bpm / 4;
  while (MUS.next < ctx.currentTime + 0.14) {
    scheduleStep(MUS.mode, MUS.step, MUS.next);
    MUS.next += stepDur;
    MUS.step = (MUS.step + 1) % 64;
  }
}

export function musicPlay(mode) {
  if (!ctx || MUS.mode === mode) return;
  MUS.mode = mode;
  MUS.step = 0;
  MUS.next = ctx.currentTime + 0.06;
  if (!MUS.timer) MUS.timer = setInterval(musTick, 25);
}

export function musicStop() {
  MUS.mode = null;
  if (MUS.timer) { clearInterval(MUS.timer); MUS.timer = null; }
}

export function setIntensity(v) { Aud.intensity = Math.max(0, Math.min(1, v)); }
