# Dominator Audio Sync Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/dominator-audio-sync.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `sounds/dominator.mp3` into the Dominator crime coefficient cinemática with volume ramp synced to counter progression and ducking of other site audio.

**Architecture:** Pure JS additions to the existing cinemática engine in `indexSybil21.html`. Uses native `Audio` object for playback, volume ramp computed from counter value on each tick, fade-out on FASE 3, and ducking/restoration of tango/freeplay audio. No new HTML elements. All edits are additive to existing FASE 2/3 JS blocks (lines ~24753-24849).

**Tech Stack:** Vanilla JS, HTML5 Audio API, Web Audio API (optional bass boost, graceful degradation)

## Global Constraints
- All edits in `indexSybil21.html` only — additive to existing JS
- Never break `_gammaBombSkip` skip functionality
- Mobile: cap max volume at 0.7
- Browser autoplay: audio only plays after user gesture (cinemática triggers on page load, audio must handle blocked autoplay gracefully)
- Audio file path: `sounds/dominator.mp3`
- Duck tango (`#tango-audio`) and freeplay (`#freeplay-audio`) during playback, restore on end/skip

---

### Task 1: Audio init + ducking in FASE 2

**Covers:** [S3, S4, S6]

**Files:**
- Modify: `indexSybil21.html:24778-24782` (FASE 2 start block)

**Interfaces:**
- Consumes: existing `_aborted` flag, `tangoEl`/`freeplayEl` references
- Produces: `window._dominatorAudio` (Audio element), ducking state vars

- [ ] **Step 1: Add audio initialization variables and ducking logic**

After line 24778 (`_phase2Timer = setTimeout(function() {`), before `if (_aborted) return;`, insert:

```js
        /* ── DOMINATOR AUDIO: init + ducking ── */
        var _domAudio = new Audio('sounds/dominator.mp3');
        _domAudio.volume = 0;
        _domAudio.preload = 'auto';
        window._dominatorAudio = _domAudio;

        var _prevTangoMuted = false;
        var _prevFreeplayMuted = false;
        var _tangoEl = document.getElementById('tango-audio');
        var _freeplayEl = document.getElementById('freeplay-audio');
        if (_tangoEl && !_tangoEl.paused) { _prevTangoMuted = _tangoEl.muted; _tangoEl.muted = true; }
        if (_freeplayEl && !_freeplayEl.paused) { _prevFreeplayMuted = _freeplayEl.muted; _freeplayEl.muted = true; }
        /* Expose ducking state for skipAll() which lives in outer scope */
        window._domDucking = { prevTango: _prevTangoMuted, prevFreeplay: _prevFreeplayMuted, tangoEl: _tangoEl, freeplayEl: _freeplayEl };

        _domAudio.play().then(function() {
            _domAudio.volume = 0.3;
        }).catch(function() {
            /* Autoplay blocked — user hasn't interacted yet. Audio won't play. */
        });
```

- [ ] **Step 2: Verify no syntax errors**

Open `indexSybil21.html` in browser. Check console for JS errors. The cinemática should still work (audio may not play without user interaction — that's expected).

- [ ] **Step 3: Commit**

```bash
git add indexSybil21.html
git commit -m "feat(dominator): add audio init and ducking at FASE 2 start"
```

---

### Task 2: Volume ramp in counter tick + critical peak

**Covers:** [S3, S5, S6]

**Files:**
- Modify: `indexSybil21.html:24790-24825` (counter tick `setInterval` callback)

**Interfaces:**
- Consumes: `_domAudio` from Task 1, `current` counter variable, `TARGET` constant (305.4)
- Produces: volume changes on `_domAudio`

- [ ] **Step 1: Add volume ramp after updateLed() call**

Inside the `setInterval` callback, after `updateLed(current, false);` (line ~24823), insert:

```js
                /* ── DOMINATOR AUDIO: volume ramp ── */
                if (_domAudio && !_domAudio.paused) {
                    var isMobile = window.innerWidth < 768;
                    var maxVol = isMobile ? 0.7 : 0.85;
                    var rampVol = 0.3 + (current / TARGET) * (maxVol - 0.3);
                    _domAudio.volume = Math.min(rampVol, maxVol);
                }
```

- [ ] **Step 2: Add critical peak volume when counter ≥ 300**

Inside the `if (isCritical)` block (line ~24812), after `updateLed(300, true);` (line ~24819), insert:

```js
                /* ── DOMINATOR AUDIO: critical peak ── */
                if (_domAudio && !_domAudio.paused) {
                    var isMobileCrit = window.innerWidth < 768;
                    _domAudio.volume = isMobileCrit ? 0.7 : 0.95;
                }
```

- [ ] **Step 3: Verify in browser**

Play the cinemática. Audio should start quiet and get louder as the counter rises. At 300+, volume should peak. Check mobile viewport for volume cap.

- [ ] **Step 4: Commit**

```bash
git add indexSybil21.html
git commit -m "feat(dominator): add volume ramp synced to counter + critical peak"
```

---

### Task 3: Fade-out, cleanup, and skip integration

**Covers:** [S3, S5, S6]

**Files:**
- Modify: `indexSybil21.html:24828-24846` (FASE 3 disintegration block)
- Modify: `indexSybil21.html:24753-24768` (skipAll function)

**Interfaces:**
- Consumes: `_domAudio`, `window._domDucking` (ducking state) from Task 1
- Produces: clean audio state after cinemática ends

- [ ] **Step 1: Add fade-out + restore in FASE 3**

Inside `_phase3Timer` setTimeout callback (line ~24828), after `clearInterval(_scanInterval);` (line ~24829), insert:

```js
            /* ── DOMINATOR AUDIO: fade-out + restore ducking ── */
            if (_domAudio && !_domAudio.paused) {
                var fadeStart = _domAudio.volume;
                var fadeStep = fadeStart / 12; // 12 steps over ~600ms (50ms each)
                var fadeInterval = setInterval(function() {
                    if (_domAudio.volume > fadeStep) {
                        _domAudio.volume -= fadeStep;
                    } else {
                        _domAudio.volume = 0;
                        _domAudio.pause();
                        _domAudio.currentTime = 0;
                        clearInterval(fadeInterval);
                    }
                }, 50);
            }
            /* Restore ducked audio after fade completes */
            var ds = window._domDucking || {};
            setTimeout(function() {
                if (ds.tangoEl) ds.tangoEl.muted = ds.prevTango;
                if (ds.freeplayEl) ds.freeplayEl.muted = ds.prevFreeplay;
                window._domDucking = null;
            }, 700);
```

- [ ] **Step 2: Add audio stop to skipAll function**

Inside `skipAll()` function (line ~24753), after `clearTimeout(_phase3Timer);` (line ~24758), insert:

```js
        /* ── DOMINATOR AUDIO: immediate stop on skip ── */
        if (window._dominatorAudio) {
            window._dominatorAudio.pause();
            window._dominatorAudio.currentTime = 0;
            window._dominatorAudio = null;
        }
        /* Restore ducked audio immediately */
        var _ds = window._domDucking;
        if (_ds) {
            if (_ds.tangoEl) _ds.tangoEl.muted = _ds.prevTango;
            if (_ds.freeplayEl) _ds.freeplayEl.muted = _ds.prevFreeplay;
            window._domDucking = null;
        }
```

- [ ] **Step 3: Full integration test**

1. Let cinemática play fully — audio should start at FASE 2, ramp up, peak at 300, fade out at FASE 3, other audio restored
2. Press ESC during FASE 2 — audio should stop immediately, other audio restored
3. Test on mobile viewport — volume should cap at 0.7
4. Check console for errors throughout

- [ ] **Step 4: Commit**

```bash
git add indexSybil21.html
git commit -m "feat(dominator): add fade-out, cleanup, skip integration, and ducking restore"
```
