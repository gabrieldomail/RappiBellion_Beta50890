import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — fpFireBoost: disable button immediately (race-condition fix)
# Also remove the wrong RIVAL_BOOST postMessage that goes to own iframe
# -----------------------------------------------------------------------
p1_search = (
    '    window.fpFireBoost = function fpFireBoost() {' + nl +
    '    if (!fpState.betMode) return;' + nl +
    '    var bLimit  = fpState.boostLimit || 0;' + nl +
    '    var bUsed   = fpState.boostsUsed || 0;' + nl +
    '    if (bUsed >= bLimit) return;' + nl +
    '    var btn = document.getElementById(\'fp-boost-btn\');' + nl +
    '    if (btn && btn.disabled) return;' + nl +
    '    // Trigger in iframe' + nl +
    '    if (fpIframe && fpIframe.contentWindow) {' + nl +
    '        fpIframe.contentWindow.postMessage({ type: \'TRIGGER_BOOST\' }, \'*\');' + nl +
    '    }' + nl +
    '    // Visual flash feedback' + nl +
    '    if (btn) {' + nl +
    '        btn.classList.add(\'fp-boost-firing\');' + nl +
    '        setTimeout(function() { btn.classList.remove(\'fp-boost-firing\'); }, 200);' + nl +
    '    }' + nl +
    '}'
)
p1_replace = (
    '    window.fpFireBoost = function fpFireBoost() {' + nl +
    '    if (!fpState.betMode) return;' + nl +
    '    var bLimit  = fpState.boostLimit || 0;' + nl +
    '    var bUsed   = fpState.boostsUsed || 0;' + nl +
    '    if (bUsed >= bLimit) return;' + nl +
    '    var btn = document.getElementById(\'fp-boost-btn\');' + nl +
    '    if (btn && btn.disabled) return;' + nl +
    '    // BUG FIX: disable immediately to prevent rapid-click race condition.' + nl +
    '    // The BOOST_USED echo from the iframe will re-enable if boosts remain.' + nl +
    '    if (btn) btn.disabled = true;' + nl +
    '    // Trigger in iframe' + nl +
    '    if (fpIframe && fpIframe.contentWindow) {' + nl +
    '        fpIframe.contentWindow.postMessage({ type: \'TRIGGER_BOOST\' }, \'*\');' + nl +
    '    }' + nl +
    '    // Visual flash feedback' + nl +
    '    if (btn) {' + nl +
    '        btn.classList.add(\'fp-boost-firing\');' + nl +
    '        setTimeout(function() { btn.classList.remove(\'fp-boost-firing\'); }, 300);' + nl +
    '    }' + nl +
    '}'
)
if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: fpFireBoost race-condition fix')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: fpFireBoost anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — BOOST_USED handler: re-enable button based on real remaining count
# and remove the erroneous RIVAL_BOOST postMessage to own iframe
# -----------------------------------------------------------------------
p2_search = (
    '            // Disable button if no boosts left' + nl +
    '            var boostBtn = document.getElementById(\'fp-boost-btn\');' + nl +
    '            if (boostBtn) {' + nl +
    '                boostBtn.disabled = bRemain <= 0;' + nl +
    '            }' + nl +
    '            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {' + nl +
    '                window._fbDB.ref(\'t2e_bets/\' + fpState.betId + \'/boosts/\' + fpState.myRole)' + nl +
    '                    .set(fpState.boostsUsed);' + nl +
    '            }' + nl +
    '            // Notify rival iframe about boost' + nl +
    '            if (fpIframe && fpIframe.contentWindow) {' + nl +
    '                fpIframe.contentWindow.postMessage({' + nl +
    '                    type: \'RIVAL_BOOST\',' + nl +
    '                    boostsRemaining: Math.max(0, (fpState.boostLimit||0) - fpState.boostsUsed)' + nl +
    '                }, \'*\');' + nl +
    '            }' + nl +
    '        }'
)
p2_replace = (
    '            // Re-enable/disable button based on real remaining count' + nl +
    '            var boostBtn = document.getElementById(\'fp-boost-btn\');' + nl +
    '            if (boostBtn) {' + nl +
    '                boostBtn.disabled = bRemain <= 0;' + nl +
    '            }' + nl +
    '            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {' + nl +
    '                window._fbDB.ref(\'t2e_bets/\' + fpState.betId + \'/boosts/\' + fpState.myRole)' + nl +
    '                    .set(fpState.boostsUsed);' + nl +
    '            }' + nl +
    '            // NOTE: RIVAL_BOOST postMessage removed — the rival\'s device gets the boost' + nl +
    '            // count update via Firebase (rivalBoostsRef listener). Sending RIVAL_BOOST to' + nl +
    '            // our own iframe (fpIframe) was incorrect and showed the warning on the wrong side.' + nl +
    '        }'
)
if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: BOOST_USED handler — removed wrong RIVAL_BOOST postMessage')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: BOOST_USED handler anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# Write index.html
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'index.html: {patches_ok}/2 patches applied')

# -----------------------------------------------------------------------
# PATCH 3 — pvp-bridge.js: onPowerPellet actually triggers fright mode
# by calling the game engine's frighten logic directly
# -----------------------------------------------------------------------
with open('pac-hack/pvp-bridge.js', 'r', encoding='utf-8') as f:
    bridge = f.read()

bnl = '\r\n' if '\r\n' in bridge else '\n'

p3_search = (
    '    // Llamar cuando se come un power pellet' + bnl +
    '    onPowerPellet: function() {' + bnl +
    '      if (matchEnded) return;' + bnl +
    '      boostsUsed++;' + bnl +
    '      sendToParent({' + bnl +
    '        type: \'BOOST_USED\',' + bnl +
    '        player: PLAYER,' + bnl +
    '        score: lastScore,' + bnl +
    '        boosts: boostsUsed,' + bnl +
    '      });' + bnl +
    '      console.info(\'[PvP Bridge] Boost enviado. Total:\', boostsUsed);' + bnl +
    '    },'
)
p3_replace = (
    '    // Llamar cuando se usa un boost (HACK IT button or ate a power pellet).' + bnl +
    '    // Also triggers fright mode in the pac-hack engine so it has a real game effect.' + bnl +
    '    onPowerPellet: function() {' + bnl +
    '      if (matchEnded) return;' + bnl +
    '      boostsUsed++;' + bnl +
    '      // === REAL GAME EFFECT: frighten all ghosts ====' + bnl +
    '      // Access the Ghosts singleton that Init.js creates and call frighten()' + bnl +
    '      try {' + bnl +
    '        // The ghosts variable is local to Init.js IIFE; we trigger via a custom event' + bnl +
    '        // that Init.js listens for, OR we simulate eating an energizer food tile.' + bnl +
    '        // Simplest reliable approach: dispatch a custom "pvpBoost" event on document.' + bnl +
    '        document.dispatchEvent(new CustomEvent(\'pvpBoost\', { detail: { boostsUsed: boostsUsed } }));' + bnl +
    '      } catch(e) {}' + bnl +
    '      sendToParent({' + bnl +
    '        type: \'BOOST_USED\',' + bnl +
    '        player: PLAYER,' + bnl +
    '        score: lastScore,' + bnl +
    '        boosts: boostsUsed,' + bnl +
    '      });' + bnl +
    '      console.info(\'[PvP Bridge] Boost enviado. Total:\', boostsUsed);' + bnl +
    '    },'
)
if p3_search in bridge:
    bridge = bridge.replace(p3_search, p3_replace, 1)
    print('PATCH 3 applied: pvp-bridge.js onPowerPellet dispatches pvpBoost event')
else:
    print('PATCH 3 FAILED: onPowerPellet anchor not found in pvp-bridge.js')
    sys.exit(1)

with open('pac-hack/pvp-bridge.js', 'w', encoding='utf-8') as f:
    f.write(bridge)
print('pac-hack/pvp-bridge.js: PATCH 3 applied')

# -----------------------------------------------------------------------
# PATCH 4 — Init.js: listen for pvpBoost event and call ghosts.frighten(blob)
# -----------------------------------------------------------------------
with open('pac-hack/source/Init.js', 'r', encoding='utf-8') as f:
    init = f.read()

inl = '\r\n' if '\r\n' in init else '\n'

# Insert pvpBoost listener inside initDomListeners(), before the closing brace
# Anchor: the SET_CONTROL message listener closing block inside initDomListeners
p4_search = (
    '            // Escuchar SET_CONTROL desde el padre' + inl +
    '            window.addEventListener(\'message\', function(e) {' + inl +
    '                if (e.data && e.data.type === \'SET_CONTROL\') {' + inl +
    '                    window._controlMode = e.data.mode;' + inl +
    '                    if (e.data.mode === \'dpad\') _dpadShow();' + inl +
    '                    else                        _dpadHide();' + inl +
    '                }' + inl +
    '            });' + inl +
    '        }' + inl +
    '    }'  # end of initDomListeners
)
p4_replace = (
    '            // Escuchar SET_CONTROL desde el padre' + inl +
    '            window.addEventListener(\'message\', function(e) {' + inl +
    '                if (e.data && e.data.type === \'SET_CONTROL\') {' + inl +
    '                    window._controlMode = e.data.mode;' + inl +
    '                    if (e.data.mode === \'dpad\') _dpadShow();' + inl +
    '                    else                        _dpadHide();' + inl +
    '                }' + inl +
    '            });' + inl +
    '        }' + inl +
    inl +
    '        // PvP BOOST: frighten ghosts when HACK IT button is used' + inl +
    '        // pvp-bridge.js dispatches this event via document.dispatchEvent(new CustomEvent("pvpBoost"))' + inl +
    '        document.addEventListener(\'pvpBoost\', function() {' + inl +
    '            if (display.isPlaying() && ghosts && blob) {' + inl +
    '                ghosts.frighten(blob);' + inl +
    '            }' + inl +
    '        });' + inl +
    '    }'  # end of initDomListeners
)
if p4_search in init:
    init = init.replace(p4_search, p4_replace, 1)
    print('PATCH 4 applied: Init.js listens for pvpBoost and calls ghosts.frighten(blob)')
else:
    print('PATCH 4 FAILED: initDomListeners SET_CONTROL anchor not found in Init.js')
    sys.exit(1)

with open('pac-hack/source/Init.js', 'w', encoding='utf-8') as f:
    f.write(init)
print('pac-hack/source/Init.js: PATCH 4 applied')

# Also apply same patch to carpeta el circuito copy
with open('carpeta el circuito/pac-hack/source/Init.js', 'r', encoding='utf-8') as f:
    init2 = f.read()
inl2 = '\r\n' if '\r\n' in init2 else '\n'
p4_search2 = p4_search.replace(inl, inl2)
p4_replace2 = p4_replace.replace(inl, inl2)
if p4_search2 in init2:
    init2 = init2.replace(p4_search2, p4_replace2, 1)
    with open('carpeta el circuito/pac-hack/source/Init.js', 'w', encoding='utf-8') as f:
        f.write(init2)
    print('carpeta el circuito/pac-hack/source/Init.js: PATCH 4 applied')
else:
    print('carpeta el circuito Init.js: PATCH 4 anchor not found (may differ) — skipping')

print()
print('--- VERIFICATION ---')
checks_html = [
    ('btn.disabled = true', 'fpFireBoost immediate disable'),
    ('RIVAL_BOOST postMessage removed', 'RIVAL_BOOST removed comment'),
]
for needle, label in checks_html:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label} [index.html]')

checks_bridge = [
    ('pvpBoost', 'pvpBoost event dispatched'),
    ('BOOST_USED', 'BOOST_USED still sent'),
]
for needle, label in checks_bridge:
    status = 'OK  ' if needle in bridge else 'FAIL'
    print(f'  {status}: {label} [pvp-bridge.js]')

checks_init = [
    ('pvpBoost', 'pvpBoost listener in Init.js'),
    ('ghosts.frighten(blob)', 'ghosts.frighten called'),
]
for needle, label in checks_init:
    status = 'OK  ' if needle in init else 'FAIL'
    print(f'  {status}: {label} [Init.js]')
