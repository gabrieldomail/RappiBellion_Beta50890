# Dominator Psycho-Pass Dialogue Overlay — Design Spec

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/dominator-dialogue-overlay.md)

## [S1] Problem
The Dominator crime coefficient cinemática has audio and visuals but lacks the iconic Japanese dialogue from Psycho-Pass that makes the experience immersive. Fans recognize the quotes instantly; newcomers enjoy the anime aesthetic regardless.

## [S2] Solution
Three text overlays synchronized with the cinemática phases, styled as anime subtitles: large Japanese text on top, smaller Spanish translation below, with glitch-fade animations.

## [S3] Dialogue Content and Timing

| # | Trigger | Japanese | Spanish |
|---|---------|----------|---------|
| 1 | FASE 2 start (counter ~0-50) | 犯罪係数スキャン開始 | Iniciando escaneo de coeficiente criminal |
| 2 | FASE 2 mid (counter ~150) | リーサル・イミテーター、起動 | Modo Lethal Eliminator activado |
| 3 | FASE 2 critical (counter ≥300) | ターゲットの処分が承認されました。慎重に進言します。 | Destino designado para eliminación - proceda con precaución |

## [S4] Visual Design

### Position
- Below the crime meter numbers, above the LED bar
- Centered horizontally within `.crime-panel`
- Fixed position relative to the panel (not absolute on viewport)

### Typography
- **Japanese:** `font-family: 'Share Tech Mono', monospace; font-size: clamp(14px, 2.5vw, 20px); color: #00FFFF; text-shadow: 0 0 8px rgba(0,255,255,0.6); letter-spacing: 0.1em;`
- **Spanish:** `font-family: 'Share Tech Mono', monospace; font-size: clamp(10px, 1.8vw, 14px); color: rgba(255,255,255,0.55); font-style: italic; margin-top: 4px;`

### Animation
- **Enter:** `opacity 0→1` + `translateY(8px)→0` over 0.3s + subtle glitch jitter (2 frames of `clip-path` skew)
- **Exit:** `opacity 1→0` over 0.2s
- **Transition between quotes:** Current fades out (0.2s) → gap (0.1s) → new fades in (0.3s)

## [S5] Architecture

### Data Structure
```js
var DOMINATOR_QUOTES = [
    { jp: '犯罪係数スキャン開始', es: 'Iniciando escaneo de coeficiente criminal', trigger: 0 },
    { jp: 'リーサル・イミテーター、起動', es: 'Modo Lethal Eliminator activado', trigger: 150 },
    { jp: 'ターゲットの処分が承認されました。慎重に進言します。', es: 'Destino designado para eliminación - proceda con precaución', trigger: 300 }
];
```

### Injection Point
- Create a `<div id="crime-dialogue-overlay">` inside `.crime-panel` (after `#crime-execution-label`)
- CSS added to existing `<style>` block in the crime meter section
- JS integrated into the existing `setInterval` counter tick (same callback as volume ramp)

### State Tracking
- `var _lastQuoteIdx = -1;` — tracks which quote is currently shown
- On each tick: check if `current >= quote.trigger && _lastQuoteIdx < i` → show quote
- Only advances forward (never goes back)

## [S6] Constraints
- All edits in `indexSybil21.html` only
- Must not break existing crime meter visuals, counter, or LED bar
- Must not break `_gammaBombSkip` skip functionality (quotes should disappear on skip)
- Mobile: font sizes already use `clamp()` for responsive scaling
- Japanese text renders correctly with Share Tech Mono (supports CJK)

## [S7] Files Modified
- `indexSybil21.html`: CSS additions to crime meter `<style>` block + JS additions to counter tick
