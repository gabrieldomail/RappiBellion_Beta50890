with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

# Check P1 actual function body
idx = c.find('window.fpFireBoost = function fpFireBoost()')
print('=== fpFireBoost current ===')
print(repr(c[idx:idx+700]))

print()
# Check P2 - BOOST_USED handler area
idx2 = c.find('// Disable button if no boosts left')
if idx2 == -1:
    idx2 = c.find('// Re-enable/disable button')
print('=== BOOST_USED handler (btn section) ===')
print(repr(c[idx2:idx2+600]))

print()
# Check RIVAL_BOOST postMessage presence
print('RIVAL_BOOST postMessage present:', "type: 'RIVAL_BOOST'" in c)
print('btn.disabled = true in fpFireBoost:', 'if (btn) btn.disabled = true;' in c)
