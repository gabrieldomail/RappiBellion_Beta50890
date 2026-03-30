import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — Hide REVANCHA button in T2E bet mode
# In fpShowVerdict, hide #vrd-retry when fpState.betMode is true
# -----------------------------------------------------------------------
# Current code around line 1356: vrdEl.classList.add('show')
# We insert the betMode check right after the verdict is shown
p1_search = (
    '        if (vrdEl) vrdEl.classList.add(\'show\');' + nl +
    nl +
    '        // Animar la barra de caos con el nivel REAL guardado en fpState'
)
p1_replace = (
    '        if (vrdEl) vrdEl.classList.add(\'show\');' + nl +
    nl +
    '        // Hide REVANCHA in bet mode — retry is free play only' + nl +
    '        var retryBtn = document.getElementById(\'vrd-retry\');' + nl +
    '        if (retryBtn) retryBtn.style.display = fpState.betMode ? \'none\' : \'\';' + nl +
    nl +
    '        // Animar la barra de caos con el nivel REAL guardado en fpState'
)
if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: hide REVANCHA in bet mode')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: fpShowVerdict anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — Verdict screen centering
# Desktop: centre content with min-height trick
# Mobile: flex-start + scroll (keep existing behaviour)
# Replace the current #fp-verdict CSS block
# -----------------------------------------------------------------------
p2_search = (
    '        #fp-verdict {' + nl +
    '            display: none;' + nl +
    '            position: fixed; inset: 0; z-index: 9997;' + nl +
    '            background: rgba(3,5,10,0.96);' + nl +
    '            align-items: flex-start; justify-content: flex-start;' + nl +
    '            flex-direction: column; gap: 20px;' + nl +
    '            text-align: center; padding: 30px 20px;' + nl +
    '            overflow-y: auto;' + nl +
    '            -webkit-overflow-scrolling: touch;' + nl +
    '        }' + nl +
    '        /* Centre verdict content when space allows */' + nl +
    '        #fp-verdict > * { width: 100%; }' + nl +
    '        #fp-verdict > .vrd-buttons { margin: auto 0 0; }'
)
p2_replace = (
    '        #fp-verdict {' + nl +
    '            display: none;' + nl +
    '            position: fixed; inset: 0; z-index: 9997;' + nl +
    '            background: rgba(3,5,10,0.96);' + nl +
    '            /* Desktop: centre all content */' + nl +
    '            align-items: center; justify-content: center;' + nl +
    '            flex-direction: column; gap: 20px;' + nl +
    '            text-align: center; padding: 30px 20px;' + nl +
    '            overflow-y: auto;' + nl +
    '            -webkit-overflow-scrolling: touch;' + nl +
    '        }' + nl +
    '        /* Centre verdict content */' + nl +
    '        #fp-verdict > * { width: 100%; max-width: 560px; }' + nl +
    '        /* On mobile where content may overflow, push to top so scroll works */' + nl +
    '        @media (max-height: 680px) {' + nl +
    '            #fp-verdict { align-items: flex-start; justify-content: flex-start; }' + nl +
    '        }'
)
if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: verdict centering fixed (desktop centred, mobile scrollable)')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: #fp-verdict CSS anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok}/2 patches applied to index.html')

checks = [
    ('retryBtn.style.display = fpState.betMode', 'REVANCHA hidden in bet mode'),
    ('align-items: center; justify-content: center;', 'verdict centred on desktop'),
    ('max-height: 680px', 'verdict mobile scroll fallback'),
]
print()
print('--- VERIFICATION ---')
for needle, label in checks:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label}')
