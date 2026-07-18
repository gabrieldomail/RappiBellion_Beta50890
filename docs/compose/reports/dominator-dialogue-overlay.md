---
feature: dominator-dialogue-overlay
status: delivered
specs:
  - docs/compose/specs/2026-07-18-dominator-dialogue-overlay-design.md
plans:
  - docs/compose/plans/2026-07-18-dominator-dialogue-overlay.md
branch: test-inspector-ia
commits: pending
---

# Dominator Psycho-Pass Dialogue Overlay — Final Report

## What Was Built

Three Japanese dialogue overlays with Spanish translations, synchronized with the Dominator crime coefficient cinemática. Quotes appear at key counter thresholds (0, 150, 300) with anime-style glitch-fade animations, creating an immersive Psycho-Pass experience.

## Architecture

CSS additions to the crime meter `<style>` block for overlay positioning, typography, and animations. JS additions to the counter tick `setInterval` for quote data, DOM injection, and trigger logic. Single file: `indexSybil21.html`.

**Data flow:**
```
Counter tick → check DOMINATOR_QUOTES[i].trigger → if current >= trigger && not shown → showDialogue(i)
showDialogue() → fade-out current (if any) → inject new quote HTML → fade-in with glitch animation
FASE 3 / skip → remove overlay element from DOM
```

### Design Decisions

- **Anime-style subtitle positioning:** Below the crime meter numbers, above the LED bar — mimics anime subtitle placement without obscuring critical visuals.
- **Glitch-in animation:** `clip-path` keyframes create a digital interference effect matching the Psycho-Pass aesthetic.
- **Forward-only progression:** Quotes only advance (never go back) — matches the linear escalation of the Dominator's threat assessment.

## Usage

Automatic — quotes appear as part of the hero cinemática on first visit. No user interaction required. Three quotes appear sequentially:
1. 犯罪係数スキャン開始 (counter ~0)
2. リーサル・イミテーター、起動 (counter ~150)
3. ターゲットの処分が承認されました (counter ≥300)

## Verification

- All 4 DOMINATOR DIALOGUE markers present at correct lines (24824, 24868, 24953, 24990)
- CSS overlay and glitch animation present
- Quote data array with 3 entries (JP + ES + trigger values)
- Trigger logic in counter tick
- Cleanup in skipAll and FASE 3

## Journey Log

- [lesson] Dialogue overlays need cleanup in both skipAll AND FASE 3 — two separate code paths for ending the cinemática
