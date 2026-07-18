# Dominator Psycho-Pass Dialogue Overlay Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/dominator-dialogue-overlay.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 Japanese dialogue overlays with Spanish translations to the Dominator crime coefficient cinemática, synchronized with counter progression.

**Architecture:** CSS additions to the crime meter `<style>` block for overlay styling and animations. JS additions to the existing counter tick `setInterval` callback for quote data, injection, and trigger logic. Single file: `indexSybil21.html`.

**Tech Stack:** Vanilla JS, CSS animations, HTML5 (no new dependencies)

## Global Constraints
- All edits in `indexSybil21.html` only — additive to existing CSS and JS
- Must not break existing crime meter visuals, counter, LED bar, or audio sync
- Must not break `_gammaBombSkip` skip functionality
- Mobile: font sizes use `clamp()` for responsive scaling
- Japanese text renders with Share Tech Mono (supports CJK)

---

### Task 1: CSS for dialogue overlay + animations

**Covers:** [S4]

**Files:**
- Modify: `indexSybil21.html` — crime meter `<style>` block (after `.crime-execution-label` styles, before closing `</style>`)

**Interfaces:**
- Consumes: existing `.crime-panel` styles
- Produces: `#crime-dialogue-overlay`, `.cd-overlay-jp`, `.cd-overlay-es` CSS classes

- [ ] **Step 1: Add CSS for dialogue overlay**

Find the closing `</style>` tag in the crime meter section (search for `.crime-execution-label` styles, the `</style>` is nearby). Insert BEFORE `</style>`:

```css
/* ── Dominator Psycho-Pass Dialogue Overlay ── */
#crime-dialogue-overlay {
    position: absolute;
    bottom: 18%;
    left: 0;
    width: 100%;
    text-align: center;
    z-index: 5;
    pointer-events: none;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.3s ease, transform 0.3s ease;
}
#crime-dialogue-overlay.show {
    opacity: 1;
    transform: translateY(0);
}
#crime-dialogue-overlay.hide {
    opacity: 0;
    transform: translateY(-4px);
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.cd-overlay-jp {
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(14px, 2.5vw, 20px);
    color: #00FFFF;
    text-shadow: 0 0 8px rgba(0,255,255,0.6), 0 0 16px rgba(0,255,255,0.3);
    letter-spacing: 0.1em;
    display: block;
    animation: cdGlitchIn 0.3s ease both;
}
.cd-overlay-es {
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(10px, 1.8vw, 14px);
    color: rgba(255,255,255,0.55);
    font-style: italic;
    margin-top: 4px;
    display: block;
    animation: cdFadeIn 0.4s ease 0.1s both;
}
@keyframes cdGlitchIn {
    0% { opacity: 0; clip-path: inset(0 0 100% 0); }
    30% { opacity: 1; clip-path: inset(20% 0 40% 0); }
    50% { clip-path: inset(60% 0 10% 0); }
    70% { clip-path: inset(0 0 0 0); }
    100% { opacity: 1; clip-path: inset(0 0 0 0); }
}
@keyframes cdFadeIn {
    0% { opacity: 0; }
    100% { opacity: 1; }
}
```

- [ ] **Step 2: Verify CSS loads**

Open `indexSybil21.html` in browser. Check console for no CSS errors. The crime meter should look identical (overlay is hidden by default).

- [ ] **Step 3: Commit**

```bash
git add indexSybil21.html
git commit -m "feat(dominator): add dialogue overlay CSS with glitch animation"
```

---

### Task 2: JS for quote data, injection, and trigger logic

**Covers:** [S3, S5, S6]

**Files:**
- Modify: `indexSybil21.html` — counter tick `setInterval` callback (after DOMINATOR AUDIO volume ramp, before `}, TICK);`)

**Interfaces:**
- Consumes: `current` counter variable from existing cinemática
- Produces: `#crime-dialogue-overlay` element, `_lastQuoteIdx` state

- [ ] **Step 1: Add quote data array and state variable**

Inside the FASE 2 setTimeout, BEFORE the `var current = 0;` line (after the DOMINATOR AUDIO init block), insert:

```js
        /* ── DOMINATOR DIALOGUE: quote data + state ── */
        var DOMINATOR_QUOTES = [
            { jp: '犯罪係数スキャン開始', es: 'Iniciando escaneo de coeficiente criminal', trigger: 0 },
            { jp: 'リーサル・イミテーター、起動', es: 'Modo Lethal Eliminator activado', trigger: 150 },
            { jp: 'ターゲットの処分が承認されました。慎重に進言します。', es: 'Destino designado para eliminación - proceda con precaución', trigger: 300 }
        ];
        var _lastQuoteIdx = -1;
        var _dialogueEl = null;
```

- [ ] **Step 2: Add dialogue injection function**

After the `_lastQuoteIdx` declaration, insert:

```js
        function showDialogue(idx) {
            if (!_dialogueEl) {
                _dialogueEl = document.createElement('div');
                _dialogueEl.id = 'crime-dialogue-overlay';
                var panel = document.querySelector('.crime-panel');
                if (panel) panel.appendChild(_dialogueEl);
            }
            /* Fade out current if exists */
            if (_dialogueEl.classList.contains('show')) {
                _dialogueEl.classList.remove('show');
                _dialogueEl.classList.add('hide');
            }
            /* Inject new quote after brief delay */
            setTimeout(function() {
                _dialogueEl.innerHTML = '<span class="cd-overlay-jp">' + DOMINATOR_QUOTES[idx].jp + '</span>'
                                      + '<span class="cd-overlay-es">' + DOMINATOR_QUOTES[idx].es + '</span>';
                _dialogueEl.classList.remove('hide');
                _dialogueEl.classList.add('show');
            }, 220);
        }
```

- [ ] **Step 3: Add trigger logic in counter tick**

Inside the `setInterval` callback, AFTER the DOMINATOR AUDIO volume ramp block and BEFORE `}`, insert:

```js
                /* ── DOMINATOR DIALOGUE: trigger quotes ── */
                for (var qi = 0; qi < DOMINATOR_QUOTES.length; qi++) {
                    if (current >= DOMINATOR_QUOTES[qi].trigger && _lastQuoteIdx < qi) {
                        _lastQuoteIdx = qi;
                        showDialogue(qi);
                        break;
                    }
                }
```

- [ ] **Step 4: Add dialogue cleanup to skipAll**

Inside `skipAll()` function, AFTER the DOMINATOR AUDIO stop block and BEFORE `scanner.style.opacity = '0';`, insert:

```js
        /* ── DOMINATOR DIALOGUE: remove on skip ── */
        var _cdEl = document.getElementById('crime-dialogue-overlay');
        if (_cdEl) _cdEl.remove();
```

- [ ] **Step 5: Add dialogue cleanup to FASE 3**

Inside `_phase3Timer` setTimeout, AFTER the DOMINATOR AUDIO fade-out block and BEFORE `scanner.classList.remove('active');`, insert:

```js
            /* ── DOMINATOR DIALOGUE: remove on disintegration ── */
            var _cdEl3 = document.getElementById('crime-dialogue-overlay');
            if (_cdEl3) _cdEl3.remove();
```

- [ ] **Step 6: Full integration test**

1. Let cinemática play fully — 3 quotes should appear sequentially:
   - Quote 1 at counter start (~0-50): Japanese glitch-in, Spanish fade-in below
   - Quote 2 at counter ~150: Replaces quote 1 with fade transition
   - Quote 3 at counter ≥300: Final quote with fade transition
2. Press ESC during FASE 2 — dialogue should disappear immediately
3. Check mobile viewport — font sizes should scale via clamp()
4. Verify no console errors

- [ ] **Step 7: Commit**

```bash
git add indexSybil21.html
git commit -m "feat(dominator): add Psycho-Pass dialogue overlays synced to counter"
```
