with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

# Add animation: pulse to inline #fp-boost-btn block
old = (
    '            transition: background 0.15s, box-shadow 0.15s;' + nl +
    '            min-height: 48px;' + nl +
    '            touch-action: manipulation;' + nl +
    '        }' + nl +
    '        #fp-boost-btn:hover:not(:disabled) {'
)
new = (
    '            transition: background 0.15s, box-shadow 0.15s;' + nl +
    '            min-height: 48px;' + nl +
    '            touch-action: manipulation;' + nl +
    '            animation: pulse 2s ease-in-out infinite;' + nl +
    '        }' + nl +
    '        #fp-boost-btn:hover:not(:disabled) {'
)

count = c.count(old)
print(f'anchor count: {count}')
if count == 1:
    c2 = c.replace(old, new, 1)
    with open('index.html','w',encoding='utf-8') as f: f.write(c2)
    print('OK: animation: pulse added to inline #fp-boost-btn')
else:
    # show context
    idx = c.find('touch-action: manipulation;')
    print(repr(c[idx-50:idx+200]))
