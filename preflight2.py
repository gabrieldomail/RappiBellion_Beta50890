with open('index.html','r',encoding='utf-8') as f: c=f.read()
nl = '\r\n' if '\r\n' in c else '\n'

checks = [
    # P1 anchor
    ("if (vrdEl) vrdEl.classList.add('show');", 'P1 anchor exists'),
    ('retryBtn.style.display = fpState.betMode', 'P1 already applied'),
    # P2 anchor
    ('align-items: flex-start; justify-content: flex-start;', 'P2 anchor (old)'),
    ('align-items: center; justify-content: center;', 'P2 already applied or conflict'),
    ('max-height: 680px', 'P2 mobile media query present'),
    ('#fp-verdict > * { width: 100%; max-width: 560px; }', 'P2 max-width present'),
]
for needle, label in checks:
    print(f"{'OK  ' if needle in c else 'MISS'}: {label}")
