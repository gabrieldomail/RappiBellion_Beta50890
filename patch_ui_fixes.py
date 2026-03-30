import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — HACK IT button CSS
# Add #fp-boost-btn styles after .fp-btn:hover rule
# -----------------------------------------------------------------------
p1_search = '        .fp-btn:hover { background: rgba(248,255,43,0.1); }'

p1_replace = (
    '        .fp-btn:hover { background: rgba(248,255,43,0.1); }' + nl + nl +
    '        /* HACK IT boost button */' + nl +
    '        #fp-boost-btn {' + nl +
    '            display: block;' + nl +
    '            width: 100%;' + nl +
    '            margin-top: 10px;' + nl +
    '            padding: 10px 14px;' + nl +
    '            background: transparent;' + nl +
    '            border: 2px solid var(--color-caos-amarillo);' + nl +
    '            color: var(--color-caos-amarillo);' + nl +
    '            font-family: \'Orbitron\', monospace;' + nl +
    '            font-size: 0.9em;' + nl +
    '            letter-spacing: 3px;' + nl +
    '            cursor: pointer;' + nl +
    '            transition: background 0.15s, box-shadow 0.15s;' + nl +
    '            min-height: 48px;' + nl +
    '            touch-action: manipulation;' + nl +
    '        }' + nl +
    '        #fp-boost-btn:hover:not(:disabled) {' + nl +
    '            background: rgba(248,255,43,0.12);' + nl +
    '            box-shadow: 0 0 14px rgba(248,255,43,0.4);' + nl +
    '        }' + nl +
    '        #fp-boost-btn:disabled {' + nl +
    '            opacity: 0.35;' + nl +
    '            cursor: not-allowed;' + nl +
    '            border-color: #555;' + nl +
    '            color: #555;' + nl +
    '        }' + nl +
    '        #fp-boost-btn.fp-boost-firing {' + nl +
    '            background: rgba(248,255,43,0.35);' + nl +
    '            box-shadow: 0 0 28px rgba(248,255,43,0.7);' + nl +
    '        }' + nl +
    '        @media (max-width: 768px) {' + nl +
    '            #fp-boost-btn { font-size: 0.75em; padding: 8px 10px; min-height: 44px; }' + nl +
    '        }'
)

if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: HACK IT button CSS')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: .fp-btn:hover anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — Verdict mobile: add overflow-y:auto
# The exact CSS block (single-line property pairs as in the file)
# -----------------------------------------------------------------------
p2_search = (
    '        #fp-verdict {' + nl +
    '            display: none;' + nl +
    '            position: fixed; inset: 0; z-index: 9997;' + nl +
    '            background: rgba(3,5,10,0.96);' + nl +
    '            align-items: center; justify-content: center;' + nl +
    '            flex-direction: column; gap: 20px;' + nl +
    '            text-align: center; padding: 30px;' + nl +
    '        }'
)
p2_replace = (
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
if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: verdict overflow-y scroll')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: #fp-verdict CSS anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3 — Rival panel mobile layout
# Add #fp-rival-panel overrides after .fp-col-right mobile rule
# -----------------------------------------------------------------------
p3_search = (
    '            /* Columna derecha: horizontal compacta abajo */' + nl +
    '            .fp-col-right {' + nl +
    '                width: 100% !important;' + nl +
    '                flex-direction: row !important;' + nl +
    '                flex-wrap: wrap;' + nl +
    '                align-items: center;' + nl +
    '                justify-content: space-between;' + nl +
    '                padding: 10px 16px !important;' + nl +
    '                border-left: none !important;' + nl +
    '                border-top: 2px solid var(--color-primario);' + nl +
    '                min-height: auto !important;' + nl +
    '            }'
)
p3_replace = (
    '            /* Columna derecha: horizontal compacta abajo (free play) */' + nl +
    '            .fp-col-right {' + nl +
    '                width: 100% !important;' + nl +
    '                flex-direction: row !important;' + nl +
    '                flex-wrap: wrap;' + nl +
    '                align-items: center;' + nl +
    '                justify-content: space-between;' + nl +
    '                padding: 10px 16px !important;' + nl +
    '                border-left: none !important;' + nl +
    '                border-top: 2px solid var(--color-primario);' + nl +
    '                min-height: auto !important;' + nl +
    '            }' + nl +
    '            /* Rival panel (bet mode): always vertical, scrollable on mobile */' + nl +
    '            #fp-rival-panel {' + nl +
    '                flex-direction: column !important;' + nl +
    '                width: 100% !important;' + nl +
    '                gap: 8px !important;' + nl +
    '                padding: 10px 16px !important;' + nl +
    '                overflow-y: auto !important;' + nl +
    '                max-height: 55vw;' + nl +
    '            }' + nl +
    '            #fp-rival-panel > div { width: 100% !important; }' + nl +
    '            #rival-comm-log { max-height: 60px !important; }' + nl +
    '            /* Boost wrap: compact row on mobile */' + nl +
    '            #fp-boost-wrap {' + nl +
    '                display: flex !important;' + nl +
    '                flex-direction: row !important;' + nl +
    '                align-items: center;' + nl +
    '                gap: 10px;' + nl +
    '                margin-top: 6px !important;' + nl +
    '            }' + nl +
    '            #fp-boost-wrap > div:first-child { white-space: nowrap; }' + nl +
    '            #fp-boost-btn { margin-top: 0 !important; width: auto !important; flex-shrink: 0; }'
)
if p3_search in content:
    content = content.replace(p3_search, p3_replace, 1)
    print('PATCH 3 applied: rival panel mobile layout')
    patches_ok += 1
else:
    print('PATCH 3 FAILED: fp-col-right mobile CSS anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 4 — Disclaimer mobile: larger checkbox + scrollable on small screens
# Insert a <style> block before the disclaimer modal comment
# -----------------------------------------------------------------------
p4_search = '    <!-- === MODAL DISCLAIMER CYBERPUNK T2E === -->'
p4_replace = (
    '<style>' + nl +
    '/* DISCLAIMER MOBILE FIXES */' + nl +
    '@media (max-width: 768px) {' + nl +
    '    #disclaimer-modal {' + nl +
    '        padding: 16px 8px !important;' + nl +
    '        align-items: flex-start !important;' + nl +
    '    }' + nl +
    '    #disclaimer-modal .terminal-modal { width: 100% !important; }' + nl +
    '    #disclaimer-modal .caos-terminal { max-width: 100% !important; }' + nl +
    '    #disclaimer-check {' + nl +
    '        width: 24px !important;' + nl +
    '        height: 24px !important;' + nl +
    '        min-width: 24px !important;' + nl +
    '        cursor: pointer;' + nl +
    '        accent-color: var(--color-caos-verde);' + nl +
    '        flex-shrink: 0;' + nl +
    '    }' + nl +
    '    #accept-disclaimer, #reject-disclaimer {' + nl +
    '        width: 100% !important;' + nl +
    '        padding: 16px !important;' + nl +
    '        font-size: 1em !important;' + nl +
    '        margin-top: 8px !important;' + nl +
    '    }' + nl +
    '    .disclaimer-actions label {' + nl +
    '        padding: 12px 0 !important;' + nl +
    '        gap: 14px !important;' + nl +
    '        align-items: flex-start !important;' + nl +
    '    }' + nl +
    '}' + nl +
    '</style>' + nl + nl +
    '    <!-- === MODAL DISCLAIMER CYBERPUNK T2E === -->'
)
if p4_search in content:
    content = content.replace(p4_search, p4_replace, 1)
    print('PATCH 4 applied: disclaimer mobile fixes')
    patches_ok += 1
else:
    print('PATCH 4 FAILED: disclaimer modal anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 5 — Expose fpFireBoost on window so inline onclick= works
# (function is inside the IIFE closure, inline onclick can't reach it)
# -----------------------------------------------------------------------
p5_search = '    function fpFireBoost() {'
p5_replace = (
    '    // Exposed globally so inline onclick="fpFireBoost()" can reach it' + nl +
    '    window.fpFireBoost = function fpFireBoost() {'
)

if p5_search in content:
    content = content.replace(p5_search, p5_replace, 1)
    print('PATCH 5 applied: fpFireBoost exposed on window')
    patches_ok += 1
else:
    print('PATCH 5 SKIPPED: fpFireBoost anchor not found with expected indent (may already be exposed)')

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok} patches applied to index.html')

checks = [
    ('#fp-boost-btn',              'HACK IT CSS present'),
    ('fp-boost-firing',            'fp-boost-firing class present'),
    ('overflow-y: auto',           'verdict overflow-y scroll present'),
    ('#fp-rival-panel',            'rival panel mobile CSS present'),
    ('flex-direction: column !important', 'rival panel column direction present'),
    ('disclaimer-check',           'disclaimer-check CSS present'),
    ('window.fpFireBoost',         'fpFireBoost on window present'),
]
print()
print('--- VERIFICATION ---')
for needle, label in checks:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label}')
