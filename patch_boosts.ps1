# patch_boosts.ps1 v2 - avoids non-ASCII chars in PS string literals

$file = "index.html"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$isCRLF = $content.Contains("`r`n")
$NL = if ($isCRLF) { "`r`n" } else { "`n" }
Write-Host "Line ending: $(if ($isCRLF) { 'CRLF' } else { 'LF' })"

# Safe replace helper using IndexOf to avoid encoding issues
function SafeReplace($text, $search, $replace) {
    $idx = $text.IndexOf($search)
    if ($idx -lt 0) { return $null }
    return $text.Substring(0, $idx) + $replace + $text.Substring($idx + $search.Length)
}

# -----------------------------------------------------------------------
# PATCH 1 - HTML: BOOSTS block in left column, after chaos bar wrap closing tag
# Anchor: the closing tag sequence before COLUMNA CENTRAL comment
# -----------------------------------------------------------------------

# Build anchor using only ASCII - the comment uses only ASCII
$anchor1search = "        </div>" + $NL + $NL + "    </div>" + $NL + $NL + "    <!-- COLUMNA CENTRAL"

$boostHtml = "        </div>" + $NL + $NL +
    "        <!-- BOOSTS COUNTER (bet mode only) -->" + $NL +
    "        <div id=`"fp-boost-wrap`" style=`"display:none; width:100%; margin-top:12px;`">" + $NL +
    "            <div style=`"font-size:10px; letter-spacing:3px; color:#888;" + $NL +
    "                        font-family:'Courier New',monospace; margin-bottom:4px;`">// BOOSTS</div>" + $NL +
    "            <div id=`"fp-boost-val`"" + $NL +
    "                 style=`"font-family:'Orbitron',monospace; font-size:1.5em;" + $NL +
    "                         color:var(--color-caos-amarillo); letter-spacing:4px;`">-/-</div>" + $NL +
    "        </div>" + $NL + $NL +
    "    </div>" + $NL + $NL +
    "    <!-- COLUMNA CENTRAL"

$result1 = SafeReplace $content $anchor1search $boostHtml
if ($result1 -ne $null) {
    $content = $result1
    Write-Host "PATCH 1 applied: BOOSTS block in left column"
} else {
    Write-Host "PATCH 1 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 2 - HTML: RIVAL BOOSTS block before rival-timer section
# Anchor: the rival-timer section opening
# -----------------------------------------------------------------------
$anchor2search = "            <!-- Timer rival espejado -->"

$rivalBoostHtml = "            <!-- Boosts rival -->" + $NL +
    "            <div style=`"background:rgba(255,68,68,0.08); border:1px solid rgba(255,68,68,0.3);" + $NL +
    "                        padding:10px 12px;`">" + $NL +
    "                <div style=`"font-size:10px;letter-spacing:2px;color:#888;" + $NL +
    "                            font-family:'Courier New',monospace;`">BOOSTS RIVAL</div>" + $NL +
    "                <div id=`"rival-boost-val`"" + $NL +
    "                     style=`"font-family:'Orbitron',monospace; font-size:1.5em;" + $NL +
    "                             color:#ff4444; letter-spacing:4px; margin-top:4px;`">-/-</div>" + $NL +
    "            </div>" + $NL + $NL +
    "            <!-- Timer rival espejado -->"

$result2 = SafeReplace $content $anchor2search $rivalBoostHtml
if ($result2 -ne $null) {
    $content = $result2
    Write-Host "PATCH 2 applied: RIVAL BOOSTS block in right panel"
} else {
    Write-Host "PATCH 2 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 3 - JS: init boost display in _fpSetupBetSync (after nick update, before iframe fix)
# -----------------------------------------------------------------------
$anchor3search = "        // BUG5 FIX: actualizar iframe con rol real (inicialmente cargado con ?player=p1)"

$boostInit = "        // BOOSTS: initialize display from bet.boostLimit" + $NL +
    "        var betBoostLimit = (bet && bet.boostLimit) ? parseInt(bet.boostLimit) : null;" + $NL +
    "        if (betBoostLimit !== null) {" + $NL +
    "            fpState.boostLimit = betBoostLimit;" + $NL +
    "            fpState.boostsUsed = 0;" + $NL +
    "            var myBoostEl    = document.getElementById('fp-boost-val');" + $NL +
    "            var boostWrapEl  = document.getElementById('fp-boost-wrap');" + $NL +
    "            if (myBoostEl)   myBoostEl.textContent = betBoostLimit + '/' + betBoostLimit;" + $NL +
    "            if (boostWrapEl) boostWrapEl.style.display = 'block';" + $NL +
    "            var rivalBoostEl = document.getElementById('rival-boost-val');" + $NL +
    "            if (rivalBoostEl) rivalBoostEl.textContent = betBoostLimit + '/' + betBoostLimit;" + $NL +
    "        }" + $NL + $NL +
    "        // BUG5 FIX: actualizar iframe con rol real (inicialmente cargado con ?player=p1)"

$result3 = SafeReplace $content $anchor3search $boostInit
if ($result3 -ne $null) {
    $content = $result3
    Write-Host "PATCH 3 applied: boost init in _fpSetupBetSync"
} else {
    Write-Host "PATCH 3 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 4 - JS: subscribe to rival boosts in Firebase (after rivalScoreRef block)
# -----------------------------------------------------------------------
$anchor4search = "        rivalScoreRef.on('value', function(snap) {" + $NL +
    "            const score = snap.val();" + $NL +
    "            if (score === null || score === undefined) return;" + $NL +
    "            const rivalScoreEl = document.getElementById('rival-score');" + $NL +
    "            if (rivalScoreEl) {" + $NL +
    "                rivalScoreEl.textContent = String(score).padStart(4, '0');" + $NL +
    "                rivalScoreEl.style.color = score > fpState.score ? '#ff4444' : '#00ff41';" + $NL +
    "            }" + $NL +
    "        });" + $NL +
    "    }"

$rivalBoostSub = "        rivalScoreRef.on('value', function(snap) {" + $NL +
    "            const score = snap.val();" + $NL +
    "            if (score === null || score === undefined) return;" + $NL +
    "            const rivalScoreEl = document.getElementById('rival-score');" + $NL +
    "            if (rivalScoreEl) {" + $NL +
    "                rivalScoreEl.textContent = String(score).padStart(4, '0');" + $NL +
    "                rivalScoreEl.style.color = score > fpState.score ? '#ff4444' : '#00ff41';" + $NL +
    "            }" + $NL +
    "        });" + $NL + $NL +
    "        // Subscribe to rival boost usage in Firebase" + $NL +
    "        if (typeof betBoostLimit !== 'undefined' && betBoostLimit !== null) {" + $NL +
    "            var rivalBoostsRef = betRef.child('boosts/' + fpState.rivalRole);" + $NL +
    "            _fpSyncRefs.push(rivalBoostsRef);" + $NL +
    "            rivalBoostsRef.on('value', function(snap) {" + $NL +
    "                var used = snap.val();" + $NL +
    "                if (used === null || used === undefined) return;" + $NL +
    "                var remaining = Math.max(0, betBoostLimit - used);" + $NL +
    "                var rBEl = document.getElementById('rival-boost-val');" + $NL +
    "                if (rBEl) rBEl.textContent = remaining + '/' + betBoostLimit;" + $NL +
    "            });" + $NL +
    "        }" + $NL +
    "    }"

$result4 = SafeReplace $content $anchor4search $rivalBoostSub
if ($result4 -ne $null) {
    $content = $result4
    Write-Host "PATCH 4 applied: rival boosts Firebase subscription"
} else {
    Write-Host "PATCH 4 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 5 - JS: BOOST_UPDATE message handler (before TIPS MODAL comment)
# Use ASCII-only anchor: the line before TIPS MODAL is "    });"
# More specific: closing of the addEventListener('message') block
# -----------------------------------------------------------------------
$anchor5search = "        }" + $NL +
    "    });" + $NL + $NL +
    "    // "

# We need to be more precise - find the CHAOS_LEVEL block's closing and the Tips comment
# Use a unique string around line 1465-1468
$anchor5search = "                else                 label.style.color = 'var(--color-primario)';" + $NL +
    "            }" + $NL +
    "        }" + $NL +
    "    });"

$boostHandler = "                else                 label.style.color = 'var(--color-primario)';" + $NL +
    "            }" + $NL +
    "        }" + $NL +
    "        // BOOST_UPDATE: boost used by this player — update display and publish to Firebase" + $NL +
    "        if (d.type === 'BOOST_UPDATE') {" + $NL +
    "            fpState.boostsUsed = (fpState.boostsUsed || 0) + 1;" + $NL +
    "            var bLimit = fpState.boostLimit || 0;" + $NL +
    "            var bRemain = Math.max(0, bLimit - fpState.boostsUsed);" + $NL +
    "            var myBEl = document.getElementById('fp-boost-val');" + $NL +
    "            if (myBEl && bLimit > 0) {" + $NL +
    "                myBEl.textContent = bRemain + '/' + bLimit;" + $NL +
    "                myBEl.style.color = bRemain === 0 ? '#ff4444' : 'var(--color-caos-amarillo)';" + $NL +
    "            }" + $NL +
    "            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {" + $NL +
    "                window._fbDB.ref('t2e_bets/' + fpState.betId + '/boosts/' + fpState.myRole)" + $NL +
    "                    .set(fpState.boostsUsed);" + $NL +
    "            }" + $NL +
    "        }" + $NL +
    "    });"

$result5 = SafeReplace $content $anchor5search $boostHandler
if ($result5 -ne $null) {
    $content = $result5
    Write-Host "PATCH 5 applied: BOOST_UPDATE handler"
} else {
    Write-Host "PATCH 5 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
$outBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
[System.IO.File]::WriteAllBytes($file, $outBytes)
Write-Host "Done. index.html patched."

# Verify
$v = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
@("fp-boost-wrap","fp-boost-val","rival-boost-val","BOOST_UPDATE","rivalBoostsRef","betBoostLimit") | ForEach-Object {
    if ($v.Contains($_)) { Write-Host "VERIFY OK: $_" }
    else                  { Write-Host "VERIFY FAIL: $_" }
}
