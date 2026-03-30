with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

old = (
    "            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {" + nl +
    "                window._fbDB.ref('t2e_bets/' + fpState.betId + '/boosts/' + fpState.myRole)" + nl +
    "                    .set(fpState.boostsUsed);" + nl +
    "            }" + nl +
    "        }" + nl +
    "    });"
)

new = (
    "            if (fpState.betMode && fpState.betId && fpState.myRole && window._fbDB) {" + nl +
    "                window._fbDB.ref('t2e_bets/' + fpState.betId + '/boosts/' + fpState.myRole)" + nl +
    "                    .set(fpState.boostsUsed);" + nl +
    "            }" + nl +
    "            // Notify rival iframe about boost" + nl +
    "            if (fpIframe && fpIframe.contentWindow) {" + nl +
    "                fpIframe.contentWindow.postMessage({" + nl +
    "                    type: 'RIVAL_BOOST'," + nl +
    "                    boostsRemaining: Math.max(0, (fpState.boostLimit||0) - fpState.boostsUsed)" + nl +
    "                }, '*');" + nl +
    "            }" + nl +
    "        }" + nl +
    "    });"
)

count = c.count(old)
print(f'Anchor occurrences: {count}')
if count == 1:
    c2 = c.replace(old, new, 1)
    with open('index.html','w',encoding='utf-8') as f: f.write(c2)
    print('OK: RIVAL_BOOST dispatch added')
else:
    # show context
    idx = c.find("window._fbDB.ref('t2e_bets/' + fpState.betId + '/boosts/'")
    print(repr(c[idx-100:idx+400]))
