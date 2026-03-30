with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

old = (
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
    '            </button>'
)
new = (
    '            <button id="fp-boost-btn" onclick="fpFireBoost()">' + nl +
    '                HACK IT' + nl +
    '            </button>'
)

count = c.count(old)
print(f'anchor: {count}')
if count == 1:
    c2 = c.replace(old, new, 1)
    with open('index.html','w',encoding='utf-8') as f: f.write(c2)
    print('OK: button cleaned up')
else:
    # show what's there
    idx = c.find('fp-boost-btn')
    print(repr(c[idx-10:idx+400]))
