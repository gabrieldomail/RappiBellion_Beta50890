# patch_regression.ps1 - v3: uses -replace operator for CRLF, not .Replace(char,char)

$file = "index.html"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Detect line ending
$isCRLF = $content.Contains("`r`n")
$NL = if ($isCRLF) { "`r`n" } else { "`n" }
Write-Host "Line ending detected: $(if ($isCRLF) { 'CRLF' } else { 'LF' })"

# Helper: build a search/replace string using the file's actual NL
function NL($s) { $s -replace "`n", $NL }

# -----------------------------------------------------------------------
# PATCH 1 - fpOpenArena re-entrancy guard
# -----------------------------------------------------------------------
$s1 = NL("    function fpOpenArena(betId) {`n        const dur = parseInt(fpDurSelect ? fpDurSelect.value : 600);`n        fpState = { timeLeft:dur, totalTime:dur, running:false, ended:false, interval:null, score:0, chaosLevel:0,`n                    betId: betId || null, betMode: !!betId };")

$r1 = NL("    // REGRESSION FIX: tracks which betId the arena was last opened for`n    var _fpArenaOpenedForBet = null;`n`n    function fpOpenArena(betId) {`n        // REGRESSION FIX: re-entrancy guard - if arena already open for this betId, bail out.`n        // Prevents infinite loop: betAccepted -> fpOpenArena -> _fpSetupBetSync -> Firebase write`n        // -> child_changed -> betAccepted -> fpOpenArena -> ..._`n        if (betId && betId === _fpArenaOpenedForBet && fpArena && fpArena.classList.contains('show')) {`n            console.log('[fpOpenArena] Arena ya abierta para betId:', betId, '- ignorando duplicado.');`n            return;`n        }`n        if (betId) _fpArenaOpenedForBet = betId;`n`n        const dur = parseInt(fpDurSelect ? fpDurSelect.value : 600);`n        fpState = { timeLeft:dur, totalTime:dur, running:false, ended:false, interval:null, score:0, chaosLevel:0,`n                    betId: betId || null, betMode: !!betId };")

if ($content.Contains($s1)) {
    $content = $content.Replace($s1, $r1)
    Write-Host "PATCH 1 applied: fpOpenArena re-entrancy guard"
} else {
    Write-Host "PATCH 1 FAILED: anchor not found"
    # Debug: show first 80 chars around 'function fpOpenArena'
    $idx = $content.IndexOf("function fpOpenArena")
    if ($idx -ge 0) {
        Write-Host "DEBUG found at index $idx, context: $($content.Substring([Math]::Max(0,$idx-10), 120) -replace '[`r`n]','|')"
    }
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 2 - _fpSetupBetSync re-entrancy guard
# -----------------------------------------------------------------------
$s2 = NL("    async function _fpSetupBetSync(betId) {`n        const fbDB = window._fbDB;`n        if (!fbDB || !betId) {`n            // Sin Firebase: arrancar directo`n            fpStartCountdown();`n            return;`n        }")

$r2 = NL("    // REGRESSION FIX: tracks betIds already initialized this session`n    var _fpSyncInitiatedBets = new Set();`n`n    async function _fpSetupBetSync(betId) {`n        const fbDB = window._fbDB;`n        if (!fbDB || !betId) {`n            // Sin Firebase: arrancar directo`n            fpStartCountdown();`n            return;`n        }`n`n        // REGRESSION FIX: only run once per betId. Firebase writes inside this function`n        // (betRef.child('ready/X').set(true)) trigger child_changed -> betAccepted ->`n        // fpOpenArena -> _fpSetupBetSync again = infinite loop without this guard.`n        if (_fpSyncInitiatedBets.has(betId)) {`n            console.log('[T2E Sync] _fpSetupBetSync ya ejecutado para betId:', betId);`n            return;`n        }`n        _fpSyncInitiatedBets.add(betId);")

if ($content.Contains($s2)) {
    $content = $content.Replace($s2, $r2)
    Write-Host "PATCH 2 applied: _fpSetupBetSync re-entrancy guard"
} else {
    Write-Host "PATCH 2 FAILED: anchor not found"
    exit 1
}

# -----------------------------------------------------------------------
# PATCH 3 - fpCloseArena: reset guards
# -----------------------------------------------------------------------
$s3 = NL("        // Limpiar listeners Firebase de sync`n        _fpCleanSyncRefs();`n    }")

$r3 = NL("        // Limpiar listeners Firebase de sync`n        _fpCleanSyncRefs();`n        // REGRESSION FIX: reset guards so next match can open fresh`n        _fpArenaOpenedForBet = null;`n        if (typeof _fpSyncInitiatedBets !== 'undefined') _fpSyncInitiatedBets.clear();`n    }")

if ($content.Contains($s3)) {
    $content = $content.Replace($s3, $r3)
    Write-Host "PATCH 3 applied: fpCloseArena resets guards"
} else {
    Write-Host "PATCH 3 FAILED: anchor not found - non-critical, continuing"
}

# -----------------------------------------------------------------------
# Write result preserving original encoding
# -----------------------------------------------------------------------
$outBytes = [System.Text.Encoding]::UTF8.GetBytes($content)
[System.IO.File]::WriteAllBytes($file, $outBytes)
Write-Host "Done. index.html patched successfully."

# Verify
$verify = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
if ($verify.Contains("_fpArenaOpenedForBet")) {
    Write-Host "VERIFY OK: _fpArenaOpenedForBet found in file"
} else {
    Write-Host "VERIFY FAIL: _fpArenaOpenedForBet NOT found"
}
if ($verify.Contains("_fpSyncInitiatedBets")) {
    Write-Host "VERIFY OK: _fpSyncInitiatedBets found in file"
} else {
    Write-Host "VERIFY FAIL: _fpSyncInitiatedBets NOT found"
}
