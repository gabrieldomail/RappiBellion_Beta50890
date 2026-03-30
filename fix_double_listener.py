with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

old = (
    '        // Add click event to button with toggle functionality' + nl +
    '        if (connectWalletButton) {' + nl +
    '            connectWalletButton.addEventListener(\'click\', function() {' + nl +
    '                console.log(\'🖱️ Botón clickeado, estado actual:\', isConnected);' + nl +
    '                if (isConnected) {' + nl +
    '                    disconnectWallet();' + nl +
    '                } else {' + nl +
    '                    connectWallet();' + nl +
    '                }' + nl +
    '            });' + nl +
    '            console.log(\'✅ Event listener del botón configurado\');' + nl +
    '        } else {' + nl +
    '            console.error(\'❌ Botón connectWalletButton no encontrado\');' + nl +
    '        }'
)

new = (
    '        // NOTE: click handler managed by disclaimer block — see connectWalletBtn listener above.' + nl +
    '        // Calling connectWallet() here directly would bypass the disclaimer gate.' + nl +
    '        // disconnectWallet is exposed so the disclaimer block can call it on logout.' + nl +
    '        window._web3DisconnectWallet = disconnectWallet;' + nl +
    '        if (!connectWalletButton) {' + nl +
    '            console.error(\'❌ Botón connectWalletButton no encontrado\');' + nl +
    '        }'
)

count = c.count(old)
print(f'anchor count: {count}')
if count == 1:
    c2 = c.replace(old, new, 1)
    with open('index.html','w',encoding='utf-8') as f: f.write(c2)
    print('OK: direct listener removed')
    print('listeners remaining:', c2.count('connectWalletButton.addEventListener'))
    print('_web3DisconnectWallet exposed:', 'window._web3DisconnectWallet' in c2)
else:
    # show exact bytes around the anchor
    idx = c.find('// Add click event to button with toggle')
    print('FOUND AT:', idx)
    print(repr(c[idx:idx+500]))
