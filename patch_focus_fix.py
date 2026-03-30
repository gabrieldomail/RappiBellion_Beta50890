import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — fpFireBoost: refocus iframe after dispatching TRIGGER_BOOST
# The button click steals focus from the iframe; give it back immediately
# so keyboard controls (arrow keys / WASD) keep working.
# -----------------------------------------------------------------------
p1_search = (
    '    // Visual flash feedback' + nl +
    '    if (btn) {' + nl +
    '        btn.classList.add(\'fp-boost-firing\');' + nl +
    '        setTimeout(function() { btn.classList.remove(\'fp-boost-firing\'); }, 300);' + nl +
    '    }' + nl +
    '}'
)
p1_replace = (
    '    // Visual flash feedback' + nl +
    '    if (btn) {' + nl +
    '        btn.classList.add(\'fp-boost-firing\');' + nl +
    '        setTimeout(function() { btn.classList.remove(\'fp-boost-firing\'); }, 300);' + nl +
    '    }' + nl +
    '    // Return focus to iframe so keyboard controls keep working' + nl +
    '    setTimeout(function() {' + nl +
    '        if (fpIframe && fpIframe.contentWindow) fpIframe.contentWindow.focus();' + nl +
    '    }, 0);' + nl +
    '}'
)
if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: fpFireBoost refocus iframe after boost')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: fpFireBoost visual flash block not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — Tips modal: refocus iframe after modal closes
# -----------------------------------------------------------------------
p2_search = (
    '    if (fpTipsClose) {' + nl +
    '        fpTipsClose.addEventListener(\'click\', function() {' + nl +
    '            if (fpTipsModal) fpTipsModal.classList.remove(\'show\');' + nl +
    '        });' + nl +
    '    }' + nl +
    '    if (fpTipsModal) {' + nl +
    '        fpTipsModal.addEventListener(\'click\', function(e) {' + nl +
    '            if (e.target === fpTipsModal) fpTipsModal.classList.remove(\'show\');' + nl +
    '        });' + nl +
    '    }'
)
p2_replace = (
    '    if (fpTipsClose) {' + nl +
    '        fpTipsClose.addEventListener(\'click\', function() {' + nl +
    '            if (fpTipsModal) fpTipsModal.classList.remove(\'show\');' + nl +
    '            setTimeout(function() { if (fpIframe && fpIframe.contentWindow) fpIframe.contentWindow.focus(); }, 0);' + nl +
    '        });' + nl +
    '    }' + nl +
    '    if (fpTipsModal) {' + nl +
    '        fpTipsModal.addEventListener(\'click\', function(e) {' + nl +
    '            if (e.target === fpTipsModal) {' + nl +
    '                fpTipsModal.classList.remove(\'show\');' + nl +
    '                setTimeout(function() { if (fpIframe && fpIframe.contentWindow) fpIframe.contentWindow.focus(); }, 0);' + nl +
    '            }' + nl +
    '        });' + nl +
    '    }'
)
if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: tips modal close refocuses iframe')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: tips modal listeners block not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3 — Global arena mousedown capture: refocus iframe after ANY
# click on the left/right columns while the arena is active.
# Injected right after the tips modal block — runs once at DOMReady.
# -----------------------------------------------------------------------
p3_search = (
    '    // Botones del veredicto' + nl +
    '    const vrdRetry = document.getElementById(\'vrd-retry\');'
)
p3_replace = (
    '    // ── FOCUS KEEPER ────────────────────────────────────────────' + nl +
    '    // The 3-column arena has clickable UI in the left/right panels.' + nl +
    '    // Any click outside the iframe steals DOM focus, breaking' + nl +
    '    // keyboard controls (arrow keys / WASD) in pac-hack.' + nl +
    '    // Capture mousedown on the whole arena; after event bubbles,' + nl +
    '    // return focus to the iframe contentWindow.' + nl +
    '    if (fpArena) {' + nl +
    '        fpArena.addEventListener(\'mousedown\', function(e) {' + nl +
    '            // Only act when the game is actually running' + nl +
    '            if (!fpState || !fpState.running) return;' + nl +
    '            // If the click is already inside the iframe element, skip' + nl +
    '            if (fpIframe && fpIframe.contains(e.target)) return;' + nl +
    '            setTimeout(function() {' + nl +
    '                if (fpIframe && fpIframe.contentWindow) fpIframe.contentWindow.focus();' + nl +
    '            }, 0);' + nl +
    '        }, true); // capture phase so it fires before button handlers' + nl +
    '    }' + nl +
    nl +
    '    // Botones del veredicto' + nl +
    '    const vrdRetry = document.getElementById(\'vrd-retry\');'
)
if p3_search in content:
    content = content.replace(p3_search, p3_replace, 1)
    print('PATCH 3 applied: global arena mousedown focus-keeper installed')
    patches_ok += 1
else:
    print('PATCH 3 FAILED: "Botones del veredicto" anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok}/3 patches applied to index.html')

checks = [
    ('fpIframe.contentWindow.focus', 'iframe refocus call present'),
    ('focusKeeper', 'n/a — check by label'),
    ('mousedown\', function(e)', 'arena mousedown capture listener'),
    ('fpTipsClose', 'tips close refocus'),
]
print()
print('--- VERIFICATION ---')
for needle, label in [
    ('fpIframe.contentWindow.focus();', 'iframe.contentWindow.focus present'),
    ("fpArena.addEventListener('mousedown'", 'arena mousedown capture'),
    ('fpTipsClose.addEventListener', 'tips close listener'),
]:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label}')
