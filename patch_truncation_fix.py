import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'

# The file ends with a truncated duplicate of the music button script.
# The correct full block is already at line 3288 (inside the main DOMContentLoaded handler).
# The duplicate starts at:
#   <!-- Controlador del botón flotante de zorzal para música -->
# and runs to the end of file (which is truncated before </body></html>).
# We need to strip the duplicate and restore a proper </body></html> ending.

bad_suffix = (
    nl +
    '<!-- Controlador del bot\u00f3n flotante de zorzal para m\u00fasica -->' + nl +
    '<script>' + nl +
    'document.addEventListener(\'DOMContentLoaded\', function() {' + nl +
    '    const musicFloatBtn = document.getElementById(\'music-float-btn\');' + nl +
    '    const tangoAudio = document.getElementById(\'tango-audio\');' + nl +
    '    if (musicFloatBtn && tangoAudio) {' + nl +
    '        function updateMusicBtn() {' + nl +
    '            if (tangoAudio.paused) {' + nl +
    '                musicFloatBtn.classList.remove(\'playing\');' + nl +
    '                musicFloatBtn.classList.add(\'paused\');' + nl +
    '            } else {' + nl +
    '                musicFloatBtn.classList.remove(\'paused\');' + nl +
    '</body>' + nl +
    '</html>'
)

if bad_suffix in content:
    # Replace the bad suffix with proper closing tags
    content = content.replace(bad_suffix, nl + '</body>' + nl + '</html>', 1)
    print('PATCH applied: removed truncated duplicate music-float-btn script')
else:
    # Try a simpler anchor — just find the duplicate comment and truncate there
    marker = nl + '<!-- Controlador del bot\u00f3n flotante de zorzal para m\u00fasica -->'
    # Find last occurrence (the duplicate is the second one)
    first_idx = content.find(marker)
    last_idx  = content.rfind(marker)
    if first_idx != last_idx and last_idx != -1:
        content = content[:last_idx] + nl + '</body>' + nl + '</html>'
        print('PATCH applied (rfind method): removed truncated duplicate script')
    else:
        print('PATCH: no duplicate found — checking if file ends correctly')
        if content.strip().endswith('</html>'):
            print('File already ends correctly — no action needed')
        else:
            # Ensure file ends with </body></html>
            stripped = content.rstrip()
            if not stripped.endswith('</html>'):
                content = stripped + nl + '</body>' + nl + '</html>' + nl
                print('PATCH applied: appended missing </body></html>')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open('index.html', 'r', encoding='utf-8') as f:
    verify = f.read()

lines = verify.split('\n')
total = len(lines)
print(f'Total lines after fix: {total}')
print(f'Last 5 lines:')
for ln in lines[-5:]:
    print(f'  {repr(ln)}')

# Count occurrences of the music button comment
count = verify.count('Controlador del bot')
print(f'Occurrences of music-float-btn comment: {count} (expected: 1)')
