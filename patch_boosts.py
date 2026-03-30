import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
print(f"Line ending: {'CRLF' if nl == chr(13)+chr(10) else 'LF'}")

patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 - left column: BOOSTS block after chaos bar wrap, before COLUMNA CENTRAL
# -----------------------------------------------------------------------
p1_search = (
    '        </div>' + nl + nl +
    '    </div>' + nl + nl +
    '    <!-- COLUMNA CENTRAL'
)
p1_replace = (
    '        </div>' + nl + nl +
    '        <!-- BOOSTS COUNTER (bet mode only) -->' + nl +
    '        <div id="fp-boost-wrap" style="display:none; width:100%; margin-top:12px;">' + nl +
    '            <div style="font-size:10px; letter-spacing:3px; color:#888;' + nl +
    '                        font-family:\'Courier New\',monospace; margin-bottom:4px;">// BOOSTS</div>' + nl +
    '            <div id="fp-boost-val"' + nl +
    '                 style="font-family:\'Orbitron\',monospace; font-size:1.5em;' + nl +
    '                         color:var(--color-caos-amarillo); letter-spacing:4px;">-/-</div>' + nl +
    '        </div>' + nl + nl +
    '    </div>' + nl + nl +
    '    <!-- COLUMNA CENTRAL'
)
if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: BOOSTS block in left column')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 - right rival panel: RIVAL BOOSTS block before timer rival
# -----------------------------------------------------------------------
p2_search = '            <!-- Timer rival espejado -->'
p2_replace = (
    '            <!-- Boosts rival -->' + nl +
    '            <div style="background:rgba(255,68,68,0.08); border:1px solid rgba(255,68,68,0.3);' + nl +
    '                        padding:10px 12px;">' + nl +
    '                <div style="font-size:10px;letter-spacing:2px;color:#888;' + nl +
    '                            font-family:\'Courier New\',monospace;">BOOSTS RIVAL</div>' + nl +
    '                <div id="rival-boost-val"' + nl +
    '                     style="font-family:\'Orbitron\',monospace; font-size:1.5em;' + nl +
    '                             color:#ff4444; letter-spacing:4px; margin-top:4px;">-/-</div>' + nl +
    '            </div>' + nl + nl +
    '            <!-- Timer rival espejado -->'
)
if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: RIVAL BOOSTS block in right panel')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3 - _fpSetupBetSync: init boost display + betBoostLimit var
# -----------------------------------------------------------------------
p3_search = '        // BUG5 FIX: actualizar iframe con rol real (inicialmente cargado con ?player=p1)'
p3_replace = (
    '        // BOOSTS: initialize display from bet.boostLimit' + nl +
    '        var betBoostLimit = (bet && bet.boostLimit) ? parseInt(bet.boostLimit) : null;' + nl +
    '        if (betBoostLimit !== null) {' + nl +
    '            fpState.boostLimit = betBoostLimit;' + nl +
    '            fpState.boostsUsed = 0;' + nl +
    '            var myBoostEl    = document.getElementById(\'fp-boost-val\');' + nl +
    '            var boostWrapEl  = document.getElementById(\'fp-boost-wrap\');' + nl +
    '            if (myBoostEl)   myBoostEl.textContent = betBoostLimit + \'/\' + betBoostLimit;' + nl +
    '            if (boostWrapEl) boostWrapEl.style.display = \'block\';' + nl +
    '            var rivalBoostEl = document.getElementById(\'rival-boost-val\');' + nl +
    '            if (rivalBoostEl) rivalBoostEl.textContent = betBoostLimit + \'/\' + betBoostLimit;' + nl +
    '        }' + nl + nl +
    '        // BUG5 FIX: actualizar iframe con rol real (inicialmente cargado con ?player=p1)'
)
if p3_search in content:
    content = content.replace(p3_search, p3_replace, 1)
    print('PATCH 3 applied: boost init in _fpSetupBetSync')
    patches_ok += 1
else:
    print('PATCH 3 FAILED: anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 4 - _fpSetupBetSync: add rival boosts Firebase subscription after rivalScoreRef block
# -----------------------------------------------------------------------
p4_search = (
    "        rivalScoreRef.on('value', function(snap) {" + nl +
    '            const score = snap.val();' + nl +
    '            if (score === null || score === undefined) return;' + nl +
    "            const rivalScoreEl = document.getElementById('rival-score');" + nl +
    '            if (rivalScoreEl) {' + nl +
    "                rivalScoreEl.textContent = String(score).padStart(4, '0');" + nl +
    "                rivalScoreEl.style.color = score > fpState.score ? '#ff4444' : '#00ff41';" + nl +
    '            }' + nl +
    '        });' + nl +
    '    }'
)
p4_replace = (
    "        rivalScoreRef.on('value', function(snap) {" + nl +
    '            const score = snap.val();' + nl +
    '            if (score === null || score === undefined) return;' + nl +
    "            const rivalScoreEl = document.getElementById('rival-score');" + nl +
    '            if (rivalScoreEl) {' + nl +
    "                rivalScoreEl.textContent = String(score).padStart(4, '0');" + nl +
    "                rivalScoreEl.style.color = score > fpState.score ? '#ff4444' : '#00ff41';" + nl +
    '            }' + nl +
    '        });' + nl + nl +
    '        // Subscribe to rival boost usage in Firebase' + nl +
    '        if (typeof betBoostLimit !== \'undefined\' && betBoostLimit !== null) {' + nl +
    "            var rivalBoostsRef = betRef.child('boosts/' + fpState.rivalRole);" + nl +
    '            _fpSyncRefs.push(rivalBoostsRef);' + nl +
    "            rivalBoostsRef.on('value', function(snap) {" + nl +
    '                var used = snap.val();' + nl +
    '                if (used === null || used === undefined) return;' + nl +
    '                var remaining = Math.max(0, betBoostLimit - used);' + nl +
    "                var rBEl = document.getElementById('rival-boost-val');" + nl +
    "                if (rBEl) rBEl.textContent = remaining + '/' + betBoostLimit;" + nl +
    '            });' + nl +
    '        }' + nl +
    '    }'
)
if p4_search in content:
    content = content.replace(p4_search, p4_replace, 1)
    print('PATCH 4 applied: rival boosts Firebase subscription')
    patches_ok += 1
else:
    print('PATCH 4 FAILED: anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 5 - add BOOST_USED handler before CHAOS_LEVEL block closes
# Anchor: unique line near end of the message event listener
# -----------------------------------------------------------------------
p5_search = (
    "                else                 label.style.color = 'var(--color-primario)';" + nl +
    '            }' + nl +
    '        }' + nl +
    '    });'
)
p5_replace = (
    "                else                 label.style.color = 'var(--color-primario)';" + nl +
    '            }' + nl +
    '        }' + nl +
        '        // BOOST_USED: boost used by this player — update display and publish to Firebase' + nl +
    "        if (d.type === 'BOOST_USED') {" + nl +
    '            fpState.boostsUsed = (fpState.boostsUsed || 0) + 1;' + nl +
    '            var bLimit  = fpState.boostLimit || 0;' + nl +
    '            var bRemain = Math.max(0, bLimit - fpState.boostsUsed);' + nl +
    "            var myBEl = document.getElementById('fp-boost-val');" + nl +
    '            if (myBEl && bLimit > 0) {' + nl +
    "                myBEl.textContent = bRemain + '/' + bLimit;" + nl +
    "                myBEl.style.color = bRemain === 0 ? '#ff4444' : 'var(--color-caos-amarillo)';" + nl +
    '            }' + nl +
    '            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {' + nl +
    "                window._fbDB.ref('t2e_bets/' + fpState.betId + '/boosts/' + fpState.myRole)" + nl +
    '                    .set(fpState.boostsUsed);' + nl +
    '            }' + nl +
    '        }' + nl +
    '    });'
)
if p5_search in content:
    content = content.replace(p5_search, p5_replace, 1)
    print('PATCH 5 applied: BOOST_USED handler')
    patches_ok += 1
else:
    print('PATCH 5 FAILED: anchor not found'); sys.exit(1)
    sys.exit(1)

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok}/5 patches applied to index.html')

# Verify
checks = ['fp-boost-wrap', 'fp-boost-val', 'rival-boost-val', 'BOOST_USED', 'rivalBoostsRef', 'betBoostLimit']
for c in checks:
    print(f"VERIFY {'OK' if c in content else 'FAIL'}: {c}")
