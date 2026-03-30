import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — Add logos header + footer to #fp-verdict
#
# Insert a logo bar BEFORE the rank icon, and a footer AFTER the buttons.
# Logos: rappibellion (desktop/mobile) + rappia, same images as hero.
# Footer: small branding line + back-to-site link.
# -----------------------------------------------------------------------
p1_search = (
    '<div id="fp-verdict">' + nl +
    '    <div class="vrd-rank-icon" id="vrd-icon">\u2620\ufe0f</div>'
)
p1_replace = (
    '<div id="fp-verdict">' + nl +
    nl +
    '    <!-- Logos header -->' + nl +
    '    <div class="vrd-logos">' + nl +
    '        <img src="images/rappibellion_el_ultimo_tango_inicio_page.png"' + nl +
    '             alt="Rappibellion: El \u00DAltimo Tango"' + nl +
    '             class="vrd-logo-rb logo-desktop">' + nl +
    '        <img src="images/rappibellion_logo_movil.png"' + nl +
    '             alt="Rappibellion"' + nl +
    '             class="vrd-logo-rb logo-mobile">' + nl +
    '        <img src="images/rappia_logo_inicio_page.png"' + nl +
    '             alt="Rappia $RPPI"' + nl +
    '             class="vrd-logo-rappia">' + nl +
    '    </div>' + nl +
    nl +
    '    <div class="vrd-rank-icon" id="vrd-icon">\u2620\ufe0f</div>'
)

if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: logos header added to verdict screen')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: verdict screen opening anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — Add footer after the buttons div
# -----------------------------------------------------------------------
p2_search = (
    '    <div class="vrd-buttons">' + nl +
    '        <button class="vrd-btn vrd-btn-retry" id="vrd-retry">\u21ba REVANCHA</button>' + nl +
    '        <button class="vrd-btn vrd-btn-exit"  id="vrd-exit">\u2715 SALIR</button>' + nl +
    '    </div>' + nl +
    '</div>'
)
p2_replace = (
    '    <div class="vrd-buttons">' + nl +
    '        <button class="vrd-btn vrd-btn-retry" id="vrd-retry">\u21ba REVANCHA</button>' + nl +
    '        <button class="vrd-btn vrd-btn-exit"  id="vrd-exit">\u2715 SALIR</button>' + nl +
    '    </div>' + nl +
    nl +
    '    <!-- Footer branding -->' + nl +
    '    <div class="vrd-footer">' + nl +
    '        <span class="vrd-footer-brand">RAPPIBELLION \u00b7 EL CIRCUITO T2E</span>' + nl +
    '        <span class="vrd-footer-sep">//</span>' + nl +
    '        <span class="vrd-footer-sub">Think-to-Earn \u00b7 Powered by $RPPI on Optimism</span>' + nl +
    '    </div>' + nl +
    '</div>'
)

if p2_search in content:
    content = content.replace(p2_search, p2_replace, 1)
    print('PATCH 2 applied: footer added to verdict screen')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: verdict buttons block not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3 — Add CSS for the new verdict logo bar and footer
# Injected inside the main <style> block just before the existing
# #fp-verdict rule (~line 5800).
# -----------------------------------------------------------------------
p3_search = '        /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550' + nl + '           VEREDICTO FINAL'

p3_replace = (
    '        /* Verdict logos bar */' + nl +
    '        .vrd-logos {' + nl +
    '            display: flex;' + nl +
    '            align-items: center;' + nl +
    '            justify-content: center;' + nl +
    '            gap: 24px;' + nl +
    '            width: 100%;' + nl +
    '            max-width: 560px;' + nl +
    '            padding-bottom: 12px;' + nl +
    '            border-bottom: 1px solid rgba(255,0,255,0.2);' + nl +
    '            margin-bottom: 4px;' + nl +
    '        }' + nl +
    '        .vrd-logo-rb {' + nl +
    '            height: 56px;' + nl +
    '            width: auto;' + nl +
    '            object-fit: contain;' + nl +
    '            filter: drop-shadow(0 0 8px rgba(255,0,255,0.4));' + nl +
    '        }' + nl +
    '        .vrd-logo-rappia {' + nl +
    '            height: 48px;' + nl +
    '            width: auto;' + nl +
    '            object-fit: contain;' + nl +
    '            filter: drop-shadow(0 0 8px rgba(255,140,0,0.4));' + nl +
    '        }' + nl +
    '        /* Show/hide logo variants */' + nl +
    '        .vrd-logos .logo-mobile { display: none; }' + nl +
    '        @media (max-width: 768px) {' + nl +
    '            .vrd-logos .logo-desktop { display: none; }' + nl +
    '            .vrd-logos .logo-mobile  { display: block; }' + nl +
    '            .vrd-logo-rb { height: 40px; }' + nl +
    '            .vrd-logo-rappia { height: 36px; }' + nl +
    '        }' + nl +
    nl +
    '        /* Verdict footer */' + nl +
    '        .vrd-footer {' + nl +
    '            display: flex;' + nl +
    '            align-items: center;' + nl +
    '            justify-content: center;' + nl +
    '            flex-wrap: wrap;' + nl +
    '            gap: 6px;' + nl +
    '            width: 100%;' + nl +
    '            max-width: 560px;' + nl +
    '            padding-top: 14px;' + nl +
    '            margin-top: 4px;' + nl +
    '            border-top: 1px solid rgba(255,0,255,0.15);' + nl +
    '            font-family: \'Courier New\', monospace;' + nl +
    '            font-size: 0.65em;' + nl +
    '            letter-spacing: 2px;' + nl +
    '            color: rgba(255,255,255,0.35);' + nl +
    '            text-transform: uppercase;' + nl +
    '        }' + nl +
    '        .vrd-footer-brand { color: var(--color-primario, #ff00ff); opacity: 0.7; }' + nl +
    '        .vrd-footer-sep   { color: rgba(255,255,255,0.2); }' + nl +
    '        .vrd-footer-sub   { color: rgba(255,200,0,0.45); }' + nl +
    nl +
    '        /* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550' + nl + '           VEREDICTO FINAL'
)

if p3_search in content:
    content = content.replace(p3_search, p3_replace, 1)
    print('PATCH 3 applied: verdict logos + footer CSS added')
    patches_ok += 1
else:
    print('PATCH 3 FAILED: verdict CSS section anchor not found')
    # Show what's around where we expect it
    idx = content.find('VEREDICTO FINAL')
    if idx >= 0:
        print('  Found VEREDICTO FINAL at char', idx)
        print('  Context:', repr(content[max(0,idx-80):idx+40]))
    sys.exit(1)

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok}/3 patches applied to index.html')

checks = [
    ('vrd-logos', 'vrd-logos div present'),
    ('vrd-logo-rb', 'logo-rb CSS'),
    ('vrd-footer', 'vrd-footer present'),
    ('rappibellion_el_ultimo_tango_inicio_page.png', 'RB desktop logo src'),
    ('rappia_logo_inicio_page.png', 'Rappia logo src'),
    ('Think-to-Earn', 'footer text'),
]
print()
print('--- VERIFICATION ---')
for needle, label in checks:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label}')
