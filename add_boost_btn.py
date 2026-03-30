with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

nl = '\r\n' if '\r\n' in c else '\n'

old = (
    '            <div id="fp-boost-val"' + nl +
    '                 style="font-family:\'Orbitron\',monospace; font-size:1.5em;' + nl +
    '                         color:var(--color-caos-amarillo); letter-spacing:4px;">-/-</div>' + nl +
    '        </div>'
)

new = (
    '            <div id="fp-boost-val"' + nl +
    '                 style="font-family:\'Orbitron\',monospace; font-size:1.5em;' + nl +
    '                         color:var(--color-caos-amarillo); letter-spacing:4px;">-/-</div>' + nl +
    '            <button id="fp-boost-btn"' + nl +
    '                    onclick="fpFireBoost()"' + nl +
    '                    style="margin-top:10px; width:100%; padding:8px 0;' + nl +
    '                            font-family:\'Orbitron\',monospace; font-size:0.78em;' + nl +
    '                            letter-spacing:3px; font-weight:700;' + nl +
    '                            background:transparent;' + nl +
    '                            border:2px solid var(--color-caos-amarillo);' + nl +
    '                            color:var(--color-caos-amarillo);' + nl +
    '                            cursor:pointer; transition:all .15s;' + nl +
    '                            text-shadow:0 0 8px var(--color-caos-amarillo);">' + nl +
    '                \u26a1 HACK IT' + nl +
    '            </button>' + nl +
    '        </div>'
)

# Also insert fpFireBoost() function after BOOST_USED handler
boost_fn_anchor = (
    '        if (d.type === \'BOOST_USED\') {' + nl +
    '            fpState.boostsUsed = (fpState.boostsUsed || 0) + 1;'
)
boost_fn_new = (
    '        if (d.type === \'BOOST_USED\') {' + nl +
    '            fpState.boostsUsed = (fpState.boostsUsed || 0) + 1;'
)

if old in c:
    c = c.replace(old, new, 1)
    print('OK: HACK IT button inserted')
else:
    print('FAIL: HTML anchor not found')
    exit(1)

# Insert fpFireBoost function — find a good anchor near the other fp* functions
fn_anchor = 'function fpCloseArena'
fn_new = (
    'function fpFireBoost() {' + nl +
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
    '        btn.style.background = \'var(--color-caos-amarillo)\';' + nl +
    '        btn.style.color = \'#000\';' + nl +
    '        setTimeout(function() {' + nl +
    '            btn.style.background = \'transparent\';' + nl +
    '            btn.style.color = \'var(--color-caos-amarillo)\';' + nl +
    '        }, 200);' + nl +
    '    }' + nl +
    '}' + nl + nl +
    'function fpCloseArena'
)

if 'function fpCloseArena' in c:
    c = c.replace('function fpCloseArena', fn_new, 1)
    print('OK: fpFireBoost() function inserted')
else:
    print('FAIL: fpCloseArena anchor not found')
    exit(1)

# Add TRIGGER_BOOST handler in pvp-bridge message listener in index.html (if exists inline)
# Also update BOOST_USED handler to disable button when boosts run out
boost_depleted = (
    '            var bLimit  = fpState.boostLimit || 0;' + nl +
    '            var bRemain = Math.max(0, bLimit - fpState.boostsUsed);' + nl +
    '            var myBEl = document.getElementById(\'fp-boost-val\');' + nl +
    '            if (myBEl && bLimit > 0) {' + nl +
    '                myBEl.textContent = bRemain + \'/\' + bLimit;' + nl +
    '                myBEl.style.color = bRemain === 0 ? \'#ff4444\' : \'var(--color-caos-amarillo)\';' + nl +
    '            }' + nl +
    '            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {' + nl +
    '                window._fbDB.ref(\'t2e_bets/\' + fpState.betId + \'/boosts/\' + fpState.myRole)' + nl +
    '                    .set(fpState.boostsUsed);' + nl +
    '            }'
)
boost_depleted_new = (
    '            var bLimit  = fpState.boostLimit || 0;' + nl +
    '            var bRemain = Math.max(0, bLimit - fpState.boostsUsed);' + nl +
    '            var myBEl = document.getElementById(\'fp-boost-val\');' + nl +
    '            if (myBEl && bLimit > 0) {' + nl +
    '                myBEl.textContent = bRemain + \'/\' + bLimit;' + nl +
    '                myBEl.style.color = bRemain === 0 ? \'#ff4444\' : \'var(--color-caos-amarillo)\';' + nl +
    '            }' + nl +
    '            // Disable button if no boosts left' + nl +
    '            var boostBtn = document.getElementById(\'fp-boost-btn\');' + nl +
    '            if (boostBtn) {' + nl +
    '                boostBtn.disabled = bRemain <= 0;' + nl +
    '                boostBtn.style.opacity = bRemain <= 0 ? \'0.35\' : \'1\';' + nl +
    '                boostBtn.style.cursor = bRemain <= 0 ? \'not-allowed\' : \'pointer\';' + nl +
    '            }' + nl +
    '            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {' + nl +
    '                window._fbDB.ref(\'t2e_bets/\' + fpState.betId + \'/boosts/\' + fpState.myRole)' + nl +
    '                    .set(fpState.boostsUsed);' + nl +
    '            }'
)

if boost_depleted in c:
    c = c.replace(boost_depleted, boost_depleted_new, 1)
    print('OK: button disabled-on-empty logic added')
else:
    print('WARN: boost-depletion anchor not found, skipping')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print('Done.')
checks = ['fp-boost-btn', 'fpFireBoost', 'TRIGGER_BOOST', 'HACK IT', 'fp-boost-btn.disabled']
for ch in checks:
    print(f"  {'OK' if ch in c else 'MISS'}: {ch}")
