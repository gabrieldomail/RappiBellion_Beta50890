import sys

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

nl = '\r\n' if '\r\n' in content else '\n'
patches_ok = 0

# -----------------------------------------------------------------------
# PATCH 1 — Add CSS for the lobby float window
# Injected after the #gemini-chat-fab:hover rule
# -----------------------------------------------------------------------
CSS = (
    nl +
    '        /* \u2550\u2550 LOBBY FLOAT WINDOW \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */' + nl +
    '        #lobby-float-window {' + nl +
    '            position: fixed;' + nl +
    '            bottom: 120px;' + nl +
    '            right: 24px;' + nl +
    '            z-index: 9990;' + nl +
    '            width: 300px;' + nl +
    '            font-family: \'Courier New\', monospace;' + nl +
    '            border: 1px solid var(--color-primario, #ff00ff);' + nl +
    '            border-radius: 6px;' + nl +
    '            background: rgba(3,5,10,0.97);' + nl +
    '            box-shadow: 0 0 18px rgba(255,0,255,0.25);' + nl +
    '        }' + nl +
    '        #lobby-float-window.lobby-float-hidden { display: none !important; }' + nl +
    nl +
    '        .lobby-float-header {' + nl +
    '            display: flex;' + nl +
    '            justify-content: space-between;' + nl +
    '            align-items: center;' + nl +
    '            padding: 6px 10px;' + nl +
    '            background: var(--color-primario, #ff00ff);' + nl +
    '            color: #000;' + nl +
    '            font-size: 0.68em;' + nl +
    '            letter-spacing: 1px;' + nl +
    '            cursor: pointer;' + nl +
    '            user-select: none;' + nl +
    '            border-radius: 5px 5px 0 0;' + nl +
    '        }' + nl +
    '        .lobby-float-header:hover { filter: brightness(1.15); }' + nl +
    nl +
    '        .lobby-float-controls { display: flex; gap: 4px; }' + nl +
    '        .lobby-float-btn {' + nl +
    '            background: rgba(0,0,0,0.3);' + nl +
    '            border: none;' + nl +
    '            color: #000;' + nl +
    '            font-size: 0.9em;' + nl +
    '            width: 20px; height: 20px;' + nl +
    '            border-radius: 3px;' + nl +
    '            cursor: pointer;' + nl +
    '            display: flex; align-items: center; justify-content: center;' + nl +
    '        }' + nl +
    '        .lobby-float-btn:hover { background: rgba(0,0,0,0.5); }' + nl +
    nl +
    '        .lobby-float-body {' + nl +
    '            max-height: 260px;' + nl +
    '            overflow-y: auto;' + nl +
    '            padding: 10px;' + nl +
    '            color: var(--color-texto, #e0e0e0);' + nl +
    '            font-size: 0.75em;' + nl +
    '        }' + nl +
    '        /* Minimised: body hidden */' + nl +
    '        #lobby-float-window.minimized .lobby-float-body { display: none !important; }' + nl +
    '        #lobby-float-window.minimized { border-radius: 6px; }' + nl +
    '        #lobby-float-window.minimized .lobby-float-header { border-radius: 5px; }' + nl +
    nl +
    '        /* Hide lobby float while arena is active */' + nl +
    '        body.arena-active #lobby-float-window { display: none !important; }' + nl +
    nl +
    '        /* Bet items inside float */' + nl +
    '        #lobby-float-list .bet-offer-item {' + nl +
    '            border-bottom: 1px solid rgba(255,0,255,0.15);' + nl +
    '            padding: 6px 0;' + nl +
    '            display: flex; flex-direction: column; gap: 2px;' + nl +
    '        }' + nl +
    '        #lobby-float-list .bet-offer-item:last-child { border-bottom: none; }' + nl +
    '        #lobby-float-list .bet-offer-item button {' + nl +
    '            margin-top: 4px; padding: 4px 8px;' + nl +
    '            font-size: 0.85em; cursor: pointer;' + nl +
    '        }' + nl
)

p1_search = (
    '        #gemini-chat-fab:hover {' + nl +
    '            transform: scale(1.1);' + nl +
    '        }'
)
p1_replace = (
    '        #gemini-chat-fab:hover {' + nl +
    '            transform: scale(1.1);' + nl +
    '        }' + CSS
)

if p1_search in content:
    content = content.replace(p1_search, p1_replace, 1)
    print('PATCH 1 applied: lobby float CSS added')
    patches_ok += 1
else:
    print('PATCH 1 FAILED: gemini fab hover anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 2 — Rewrite the entire lobby float script block
# The block is: <!-- Ventana flotante... --> <script>(function(){...})();</script>
# We replace lines 6301-6340 verbatim.
# -----------------------------------------------------------------------
# Build the exact old text (special chars: \u25a0 = ■, \u2500 = ─)
old_block = (
    '<!-- Ventana flotante: lobby de apuestas -->' + nl +
    '<script>' + nl +
    '(function() {' + nl +
    '    document.addEventListener(\'DOMContentLoaded\', function() {' + nl +
    '        var win = document.getElementById(\'lobby-float-window\');' + nl +
    '        var minBtn = document.getElementById(\'lobby-float-minimize\');' + nl +
    '        var closeBtn = document.getElementById(\'lobby-float-close\');' + nl +
    '        var header = document.getElementById(\'lobby-float-drag\');' + nl +
    nl +
    '        function toggleMinimize() {' + nl +
    '            if (!win) return;' + nl +
    '            var minimized = win.classList.toggle(\'minimized\');' + nl +
    '            if (minBtn) minBtn.textContent = minimized ? \'\u25a0\' : \'\u2500\';' + nl +
    '        }' + nl +
    nl +
    '        if (header) {' + nl +
    '            header.addEventListener(\'click\', toggleMinimize);' + nl +
    '        }' + nl +
    '        if (minBtn) {' + nl +
    '            minBtn.addEventListener(\'click\', function(e) {' + nl +
    '                e.stopPropagation();' + nl +
    '                toggleMinimize();' + nl +
    '            });' + nl +
    '        }' + nl +
    '        if (closeBtn) {' + nl +
    '            closeBtn.addEventListener(\'click\', function(e) {' + nl +
    '                e.stopPropagation();' + nl +
    '                if (win) win.classList.add(\'lobby-float-hidden\');' + nl +
    '            });' + nl +
    '        }' + nl +
    nl +
    '        window.showLobbyFloat = function() {' + nl +
    '            if (win) win.classList.remove(\'lobby-float-hidden\');' + nl +
    '        };' + nl +
    '        window.hideLobbyFloat = function() {' + nl +
    '            if (win) win.classList.add(\'lobby-float-hidden\');' + nl +
    '        };' + nl +
    '    });' + nl +
    '})();' + nl +
    '</script>'
)

new_block = (
    '<!-- Ventana flotante: lobby de apuestas -->' + nl +
    '<script>' + nl +
    '(function() {' + nl +
    '    document.addEventListener(\'DOMContentLoaded\', function() {' + nl +
    '        var win      = document.getElementById(\'lobby-float-window\');' + nl +
    '        var minBtn   = document.getElementById(\'lobby-float-minimize\');' + nl +
    '        var closeBtn = document.getElementById(\'lobby-float-close\');' + nl +
    '        var header   = document.getElementById(\'lobby-float-drag\');' + nl +
    nl +
    '        function expand() {' + nl +
    '            if (!win) return;' + nl +
    '            win.classList.remove(\'minimized\');' + nl +
    '            if (minBtn) minBtn.textContent = \'\u2500\';' + nl +
    '        }' + nl +
    '        function collapse() {' + nl +
    '            if (!win) return;' + nl +
    '            win.classList.add(\'minimized\');' + nl +
    '            if (minBtn) minBtn.textContent = \'\u25a0\';' + nl +
    '        }' + nl +
    '        function toggleMinimize() {' + nl +
    '            if (win && win.classList.contains(\'minimized\')) expand();' + nl +
    '            else collapse();' + nl +
    '        }' + nl +
    nl +
    '        if (header)  header.addEventListener(\'click\', toggleMinimize);' + nl +
    '        if (minBtn)  minBtn.addEventListener(\'click\', function(e) { e.stopPropagation(); collapse(); });' + nl +
    '        if (closeBtn) closeBtn.addEventListener(\'click\', function(e) {' + nl +
    '            e.stopPropagation();' + nl +
    '            if (win) win.classList.add(\'lobby-float-hidden\');' + nl +
    '        });' + nl +
    nl +
    '        // showLobbyFloat: appear MINIMISED (header only).' + nl +
    '        // User clicks header to reveal bet list.' + nl +
    '        window.showLobbyFloat = function() {' + nl +
    '            if (!win) return;' + nl +
    '            if (document.body.classList.contains(\'arena-active\')) return;' + nl +
    '            win.classList.remove(\'lobby-float-hidden\');' + nl +
    '            win.classList.add(\'minimized\');' + nl +
    '            if (minBtn) minBtn.textContent = \'\u25a0\';' + nl +
    '        };' + nl +
    '        window.hideLobbyFloat = function() {' + nl +
    '            if (win) win.classList.add(\'lobby-float-hidden\');' + nl +
    '        };' + nl +
    '        // Called by arena open/close to suppress the lobby during gameplay' + nl +
    '        window.setArenaActive = function(active) {' + nl +
    '            if (active) {' + nl +
    '                document.body.classList.add(\'arena-active\');' + nl +
    '                if (win) win.classList.add(\'lobby-float-hidden\');' + nl +
    '            } else {' + nl +
    '                document.body.classList.remove(\'arena-active\');' + nl +
    '            }' + nl +
    '        };' + nl +
    '    });' + nl +
    '})();' + nl +
    '</script>'
)

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    print('PATCH 2 applied: lobby float JS rewritten (minimized by default)')
    patches_ok += 1
else:
    print('PATCH 2 FAILED: could not match old lobby float script block')
    # Debug: show what the raw bytes look like around line 6313
    raw = open('index.html', 'rb').read()
    idx = raw.find(b'toggleMinimize')
    if idx >= 0:
        print('  raw bytes around toggleMinimize:', repr(raw[idx-5:idx+80]))
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3a — fpOpenArena: setArenaActive(true)
# -----------------------------------------------------------------------
p3a_search = (
    '        // Bloquear scroll de la p\u00e1gina mientras el juego est\u00e1 activo' + nl +
    '        document.body.style.overflow = \'hidden\';'
)
p3a_replace = (
    '        // Ocultar lobby float mientras la arena est\u00e1 activa' + nl +
    '        if (typeof window.setArenaActive === \'function\') window.setArenaActive(true);' + nl +
    '        // Bloquear scroll de la p\u00e1gina mientras el juego est\u00e1 activo' + nl +
    '        document.body.style.overflow = \'hidden\';'
)
if p3a_search in content:
    content = content.replace(p3a_search, p3a_replace, 1)
    print('PATCH 3a applied: fpOpenArena calls setArenaActive(true)')
    patches_ok += 1
else:
    print('PATCH 3a FAILED: fpOpenArena scroll-block anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# PATCH 3b — fpCloseArena: setArenaActive(false)
# -----------------------------------------------------------------------
p3b_search = (
    '        // Restaurar scroll al salir del juego' + nl +
    '        document.body.style.overflow = \'\';' + nl +
    '        document.body.style.touchAction = \'\';'
)
p3b_replace = (
    '        // Restaurar scroll al salir del juego' + nl +
    '        document.body.style.overflow = \'\';' + nl +
    '        document.body.style.touchAction = \'\';' + nl +
    '        // Restaurar visibilidad del lobby float' + nl +
    '        if (typeof window.setArenaActive === \'function\') window.setArenaActive(false);'
)
if p3b_search in content:
    content = content.replace(p3b_search, p3b_replace, 1)
    print('PATCH 3b applied: fpCloseArena calls setArenaActive(false)')
    patches_ok += 1
else:
    print('PATCH 3b FAILED: fpCloseArena scroll-restore anchor not found')
    sys.exit(1)

# -----------------------------------------------------------------------
# Write result
# -----------------------------------------------------------------------
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print(f'Done. {patches_ok}/4 patches applied to index.html')

checks = [
    ('#lobby-float-window.lobby-float-hidden { display: none', 'lobby-float-hidden CSS'),
    ('.minimized .lobby-float-body { display: none', 'minimized hides body CSS'),
    ('body.arena-active #lobby-float-window', 'arena-active CSS rule'),
    ("win.classList.add('minimized')", 'showLobbyFloat adds minimized'),
    ('setArenaActive', 'setArenaActive function'),
]
print()
print('--- VERIFICATION ---')
for needle, label in checks:
    status = 'OK  ' if needle in content else 'FAIL'
    print(f'  {status}: {label}')
