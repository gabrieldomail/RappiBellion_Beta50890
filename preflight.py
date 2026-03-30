with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

p1 = '    window.fpFireBoost = function fpFireBoost() {' + nl + '    if (!fpState.betMode) return;'
p2 = '// Notify rival iframe about boost'

with open('pac-hack/pvp-bridge.js','r',encoding='utf-8') as f: b=f.read()
bnl = '\r\n' if '\r\n' in b else '\n'
p3 = '    // Llamar cuando se come un power pellet' + bnl + '    onPowerPellet: function() {'

with open('pac-hack/source/Init.js','r',encoding='utf-8') as f: i=f.read()
p4 = '            // Escuchar SET_CONTROL desde el padre'

print('P1 fpFireBoost anchor:', 'OK' if p1 in c else 'MISS')
print('P2 RIVAL_BOOST anchor:', 'OK' if p2 in c else 'MISS')
print('P3 onPowerPellet anchor:', 'OK' if p3 in b else 'MISS')
print('P4 SET_CONTROL anchor Init.js:', 'OK' if p4 in i else 'MISS')
print('pvpBoost already in Init.js:', 'pvpBoost' in i)
print('pvpBoost already in bridge:', 'pvpBoost' in b)
print('RIVAL_BOOST removed already:', 'RIVAL_BOOST postMessage removed' in c)
