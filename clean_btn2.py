with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

# Clean up inline style assignments in fpFireBoost (now handled by CSS)
old_flash = (
    "    // Visual flash feedback" + nl +
    "    if (btn) {" + nl +
    "        btn.style.background = 'var(--color-caos-amarillo)';" + nl +
    "        btn.style.color = '#000';" + nl +
    "        setTimeout(function() {" + nl +
    "            btn.style.background = 'transparent';" + nl +
    "            btn.style.color = 'var(--color-caos-amarillo)';" + nl +
    "        }, 200);" + nl +
    "    }"
)
new_flash = (
    "    // Visual flash feedback" + nl +
    "    if (btn) {" + nl +
    "        btn.classList.add('fp-boost-firing');" + nl +
    "        setTimeout(function() { btn.classList.remove('fp-boost-firing'); }, 200);" + nl +
    "    }"
)

# Clean up inline style in disabled handler
old_disabled = (
    "            if (boostBtn) {" + nl +
    "                boostBtn.disabled = bRemain <= 0;" + nl +
    "                boostBtn.style.opacity = bRemain <= 0 ? '0.35' : '1';" + nl +
    "                boostBtn.style.cursor = bRemain <= 0 ? 'not-allowed' : 'pointer';" + nl +
    "            }"
)
new_disabled = (
    "            if (boostBtn) {" + nl +
    "                boostBtn.disabled = bRemain <= 0;" + nl +
    "            }"
)

ok = 0
if old_flash in c:
    c = c.replace(old_flash, new_flash, 1); ok+=1; print('OK: flash cleanup')
else:
    print('WARN: flash anchor not found')

if old_disabled in c:
    c = c.replace(old_disabled, new_disabled, 1); ok+=1; print('OK: disabled cleanup')
else:
    print('WARN: disabled anchor not found')

with open('index.html','w',encoding='utf-8') as f: f.write(c)
print(f'Done. {ok}/2')
