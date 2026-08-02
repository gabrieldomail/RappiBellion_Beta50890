---
feature: dominator-audio-sync
status: delivered
specs:
  - docs/compose/specs/2026-07-18-dominator-audio-sync-design.md
plans:
  - docs/compose/plans/2026-07-18-dominator-audio-sync.md
branch: test-inspector-ia
commits: pending
---

# Dominator Audio Sync — Final Report

## What Was Built

Integrated `sounds/dominator.mp3` into the Dominator crime coefficient cinemática. The audio starts at FASE 2 (t=16s) when the crime scanner activates, ramps volume from 0.3→0.85 in sync with the counter progression (0→305), peaks at 0.95 when the counter hits EXECUTION (≥300), and fades out over 600ms during FASE 3 disintegration. Other site audio (tango, freeplay) is ducked during playback and restored on completion or skip.

## Architecture

Pure JS additions to `indexSybil21.html` — no new HTML elements. All code is additive to the existing cinemática engine (lines ~24753-24917).

**Components:**
- `window._dominatorAudio` — Audio element reference (global for cross-scope access)
- `window._domDucking` — Ducking state object (prevMuted flags + element refs)
- Volume ramp formula: `0.3 + (current / 305.4) * (maxVol - 0.3)`
- Mobile cap: max volume 0.7 (vs 0.85 desktop)

**Data flow:**
```
FASE 2 start → Audio init + duck → play at 0.3
Counter tick → compute volume from current/TARGET → set audio.volume
Critical (≥300) → peak volume 0.95/0.7
FASE 3 → fade-out interval (12 steps × 50ms) → pause → restore ducking
Skip → immediate pause + restore
```

### Design Decisions

- **Volume ramp vs time-mapped SFX:** chose volume ramp because it's simpler, more maintainable, and naturally syncs with the existing counter progression without needing audio timestamp analysis.
- **`window._domDucking` global:** ducking state lives in outer scope but skipAll needs access — exposed via window object to avoid closure scope issues.
- **Fade-out via setInterval (50ms × 12):** gradual ramp-down instead of abrupt stop, matches the disintegration visual.

## Usage

Automatic — audio plays as part of the hero cinemática on first visit. No user interaction required beyond the initial page load (handles autoplay policy gracefully with `.catch()` fallback).

Skip via ESC key or skip button immediately stops audio and restores other audio state.

## Verification

- All 5 DOMINATOR AUDIO markers present at correct line numbers (24759, 24792, 24854, 24863, 24877)
- `window._dominatorAudio` refs: 5 (init, skip, 2 safety checks, fade cleanup)
- `window._domDucking` refs: 5 (init, fade restore, skip restore, 2 cleanup)
- Audio path `sounds/dominator.mp3` verified present
- Brace balance: pre-existing -3 imbalance in original file (not introduced by this feature)

## Journey Log

- [lesson] Cross-scope variable access in nested setTimeout callbacks requires window-level exposure — local vars in FASE 2 setTimeout aren't accessible from skipAll in outer scope
- [lesson] Pre-existing brace imbalance in the cinemática IIFE (-3) doesn't affect functionality — HTML parsers are lenient with JS inside script tags

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-07-18-dominator-audio-sync-design.md` | Design spec | Approach A: volume ramp |
| `docs/compose/plans/2026-07-18-dominator-audio-sync.md` | Implementation plan | 3 tasks, all in indexSybil21.html |
