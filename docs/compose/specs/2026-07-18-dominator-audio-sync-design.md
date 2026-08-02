# Dominator Audio Sync — Design Spec

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/dominator-audio-sync.md)

## [S1] Problem
The Dominator crime coefficient cinemática (FASE 2: t=16s → t=22s) has a full visual sequence — counter 0→305, reticle deceleration, LED bar fill, glitch effects, EXECUTION state — but no audio. The file `sounds/dominator.mp3` exists but is not integrated.

## [S2] Solution Overview
Integrate `dominator.mp3` as ambient audio with volume ramp synced to the crime coefficient counter progression. Audio starts at FASE 2 onset (t=16s), ducks other site audio, scales volume with the counter, and peaks at EXECUTION (counter ≥300).

## [S3] Audio Lifecycle

### Start (FASE 2, t=16s)
- Create `Audio` element, set `src` to `sounds/dominator.mp3`
- Duck other audio: mute `#tango-audio` and `#freeplay-audio` if playing
- Start playback at volume 0.3
- Store reference on `window._dominatorAudio` for cleanup

### Volume Ramp (FASE 2 duration: ~5s)
- On each counter tick (~80ms intervals), compute volume from counter value:
  - `volume = 0.3 + (current / 305) * 0.55` → ranges from 0.3 to 0.85
- Apply via `audio.volume = rampedVolume`

### Critical Peak (counter ≥ 300)
- Set volume to 0.95 (near max, not clipping)
- Optional: apply slight bass emphasis via Web Audio API BiquadFilterNode (lowshelf at 200Hz, gain +6dB) if Web Audio context is available — degrade gracefully if not

### End (FASE 3, t=22s)
- Fade out: ramp volume from current → 0 over 600ms
- Then `audio.pause()`, reset `currentTime = 0`
- Restore other audio: unmute tango/freeplay if they were playing before ducking

### Skip (ESC / skip button)
- If user skips during FASE 1/2, immediately stop dominator audio
- Restore other audio state

## [S4] Ducking Logic
```js
// On FASE 2 start:
var prevTangoMuted = false;
var prevFreeplayMuted = false;
var tangoEl = document.getElementById('tango-audio');
var freeplayEl = document.getElementById('freeplay-audio');
if (tangoEl && !tangoEl.paused) { prevTangoMuted = tangoEl.muted; tangoEl.muted = true; }
if (freeplayEl && !freeplayEl.paused) { prevFreeplayMuted = freeplayEl.muted; freeplayEl.muted = true; }

// On FASE 3 end or skip:
if (tangoEl) tangoEl.muted = prevTangoMuted;
if (freeplayEl) freeplayEl.muted = prevFreeplayMuted;
```

## [S5] Integration Points
- **FASE 2 start** (line ~24778): Add audio init + ducking before counter starts
- **Counter tick** (line ~24790, inside `setInterval`): Add volume ramp after `updateLed()`
- **Critical state** (line ~24812): Add volume peak
- **FASE 3** (line ~24828): Add fade-out + cleanup + restore ducking
- **Skip function** (line ~24753): Add audio stop + restore

## [S6] Constraints
- Audio must respect browser autoplay policy (user interaction required before play) — the cinemática is triggered by page load but the audio should only play after first user gesture if browser blocks it
- Mobile: reduce max volume to 0.7 to avoid speaker blowout
- No new HTML elements needed — pure JS `Audio` object
- All edits are additive to existing FASE 2/3 JS blocks
- Must not break existing `_gammaBombSkip` skip functionality

## [S7] Files Modified
- `indexSybil21.html`: JS edits only (lines ~24753-24849)
