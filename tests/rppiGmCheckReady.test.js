/**
 * Tests for the proposed rppiGmInputAmount / _rppiGmCheckReady logic
 * introduced in PR "fix: implementada logica de creditos insuficientes en HUD".
 *
 * The PR adds (as a developer note / proposed replacement) two functions
 * that add credit-insufficiency handling to the game-launch HUD. These tests
 * validate every branch of that logic using a jsdom DOM environment.
 *
 * Functions under test (extracted verbatim from the PR diff comment block):
 *   - rppiGmInputAmount(game)
 *   - _rppiGmCheckReady(game)
 */

// ---------------------------------------------------------------------------
// Helpers – create DOM structure expected by the functions under test
// ---------------------------------------------------------------------------
function setupDom(game, { inputValue = '', previewText = '' } = {}) {
  document.body.innerHTML = `
    <input  id="rppi-input-${game}"         value="${inputValue}" />
    <span   id="rppi-input-preview-${game}" >${previewText}</span>
    <button id="rppi-launch-${game}"        ></button>
    <span   id="rppi-status-${game}"        ></span>
  `;
}

// Verbatim copy of the functions proposed in the PR diff (inside the /* */ block)
function rppiGmInputAmount(game) {
  var input = document.getElementById('rppi-input-' + game);
  if (!_rppiGmState[game]) _rppiGmState[game] = { amount: 0, time: 0, boost: 0 };
  if (input && input.value) {
    _rppiGmState[game].amount = parseFloat(input.value);
    var prev = document.getElementById('rppi-input-preview-' + game);
    if (prev) prev.textContent = _rppiGmState[game].amount + ' RPPI-C INGRESADOS';
  } else {
    _rppiGmState[game].amount = 0;
    var prev = document.getElementById('rppi-input-preview-' + game);
    if (prev) prev.textContent = '';
  }
  _rppiGmCheckReady(game);
}

function _rppiGmCheckReady(game) {
  var btn = document.getElementById('rppi-launch-' + game);
  var st  = document.getElementById('rppi-status-' + game);
  var c   = _rppiGmColors[game];
  var s   = _rppiGmState[game];
  var user    = window._rppiUser;
  var credits = user ? (user.credits || 0) : 0;
  if (!btn) return;

  if (s && s.amount > 0 && s.time > 0 && s.boost > 0) {
    if (s.amount > credits) {
      btn.disabled = true;
      btn.style.borderColor = 'rgba(255,45,120,0.5)';
      btn.style.color       = 'rgba(255,45,120,0.6)';
      btn.style.textShadow  = 'none';
      btn.style.boxShadow   = 'none';
      btn.style.cursor      = 'not-allowed';
      btn.textContent       = 'RPPI-C INSUFICIENTES';
      if (st) {
        st.style.color = 'rgba(255,45,120,0.8)';
        st.textContent = 'Necesitás ' + s.amount + ' RPPI-C. Tenés ' + credits + '.';
      }
    } else {
      btn.disabled = false;
      btn.style.borderColor = c.main;
      btn.style.color       = '#fff';
      btn.style.textShadow  = '0 0 8px ' + c.main;
      btn.style.boxShadow   = '0 0 15px rgba(' + c.rgb + ',0.3)';
      btn.style.cursor      = 'pointer';
      btn.textContent       = 'LANZAR DESAFIO RPPI-C';
      if (st) st.textContent = '';
    }
  } else {
    btn.disabled = true;
    btn.style.borderColor = 'rgba(' + c.rgb + ',0.25)';
    btn.style.color       = 'rgba(' + c.rgb + ',0.3)';
    btn.style.textShadow  = 'none';
    btn.style.boxShadow   = 'none';
    btn.style.cursor      = 'not-allowed';
    btn.textContent       = 'SELECCIONA OPCIONES';
    if (st) st.textContent = '';
  }
}

// ---------------------------------------------------------------------------
// Shared globals mirroring the page-level variables the functions depend on
// ---------------------------------------------------------------------------
const GAME = 'tetris';
const COLOR = { main: '#00e5ff', rgb: '0,229,255' };

beforeEach(() => {
  // Reset globals before each test
  global._rppiGmState  = {};
  global._rppiGmColors = { [GAME]: COLOR };
  global._rppiUser     = null;
  setupDom(GAME);
});

// ===========================================================================
// _rppiGmCheckReady – branch: incomplete state (amount | time | boost === 0)
// ===========================================================================
describe('_rppiGmCheckReady – incomplete state (SELECCIONA OPCIONES)', () => {
  test('disables button when all state values are zero', () => {
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
    expect(btn.style.cursor).toBe('not-allowed');
  });

  test('disables button when only amount is set', () => {
    _rppiGmState[GAME] = { amount: 10, time: 0, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
  });

  test('disables button when only time is set', () => {
    _rppiGmState[GAME] = { amount: 0, time: 5, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
  });

  test('disables button when only boost is set', () => {
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 2 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
  });

  test('disables button when amount and time are set but boost is missing', () => {
    _rppiGmState[GAME] = { amount: 10, time: 5, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
  });

  test('clears status element text in incomplete state', () => {
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 0 };
    const st = document.getElementById('rppi-status-' + GAME);
    st.textContent = 'some previous text';

    _rppiGmCheckReady(GAME);

    expect(st.textContent).toBe('');
  });

  test('applies inactive border color using game color rgb in incomplete state', () => {
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    // jsdom normalises rgba() by adding spaces after commas, so we check the
    // channel values rather than the exact serialisation.
    expect(btn.style.borderColor).toMatch(/rgba\(\s*0\s*,\s*229\s*,\s*255\s*,\s*0\.25\s*\)/);
    expect(btn.style.color).toMatch(/rgba\(\s*0\s*,\s*229\s*,\s*255\s*,\s*0\.3\s*\)/);
  });

  test('removes text-shadow and box-shadow in incomplete state', () => {
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 0 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.textShadow).toBe('none');
    expect(btn.style.boxShadow).toBe('none');
  });
});

// ===========================================================================
// _rppiGmCheckReady – branch: insufficient credits
// ===========================================================================
describe('_rppiGmCheckReady – insufficient credits (RPPI-C INSUFICIENTES)', () => {
  beforeEach(() => {
    _rppiGmState[GAME]  = { amount: 100, time: 5, boost: 2 };
    _rppiUser = window._rppiUser = { credits: 50 };
  });

  test('disables button when amount exceeds user credits', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });

  test('applies error border color when credits are insufficient', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    // jsdom normalises rgba() by adding spaces after commas
    expect(btn.style.borderColor).toMatch(/rgba\(\s*255\s*,\s*45\s*,\s*120\s*,\s*0\.5\s*\)/);
    expect(btn.style.color).toMatch(/rgba\(\s*255\s*,\s*45\s*,\s*120\s*,\s*0\.6\s*\)/);
  });

  test('sets cursor to not-allowed when credits are insufficient', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.cursor).toBe('not-allowed');
  });

  test('removes shadows when credits are insufficient', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.textShadow).toBe('none');
    expect(btn.style.boxShadow).toBe('none');
  });

  test('shows descriptive status message with required and available credits', () => {
    _rppiGmCheckReady(GAME);

    const st = document.getElementById('rppi-status-' + GAME);
    expect(st.textContent).toBe('Necesitás 100 RPPI-C. Tenés 50.');
  });

  test('applies error color to the status element', () => {
    _rppiGmCheckReady(GAME);

    const st = document.getElementById('rppi-status-' + GAME);
    // jsdom normalises rgba() by adding spaces after commas
    expect(st.style.color).toMatch(/rgba\(\s*255\s*,\s*45\s*,\s*120\s*,\s*0\.8\s*\)/);
  });

  test('treats missing user (null) as 0 credits → insufficient when amount > 0', () => {
    window._rppiUser = null;
    _rppiGmState[GAME] = { amount: 1, time: 5, boost: 2 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });

  test('treats user with undefined credits as 0 → insufficient when amount > 0', () => {
    window._rppiUser = { email: 'test@example.com' }; // no credits field
    _rppiGmState[GAME] = { amount: 5, time: 1, boost: 1 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });

  test('exact-match amount equals credits → sufficient (boundary)', () => {
    window._rppiUser = { credits: 100 };
    _rppiGmState[GAME] = { amount: 100, time: 5, boost: 2 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('LANZAR DESAFIO RPPI-C');
  });

  test('amount one more than credits → insufficient (boundary)', () => {
    window._rppiUser = { credits: 99 };
    _rppiGmState[GAME] = { amount: 100, time: 5, boost: 2 };
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });
});

// ===========================================================================
// _rppiGmCheckReady – branch: sufficient credits (LANZAR DESAFIO RPPI-C)
// ===========================================================================
describe('_rppiGmCheckReady – sufficient credits (LANZAR DESAFIO RPPI-C)', () => {
  beforeEach(() => {
    _rppiGmState[GAME]      = { amount: 50, time: 5, boost: 2 };
    window._rppiUser        = { credits: 200 };
  });

  test('enables button when all state values are positive and credits are sufficient', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('LANZAR DESAFIO RPPI-C');
  });

  test('applies game main color as border when ready', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.borderColor).toBe(COLOR.main);
  });

  test('sets text color to white when ready', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    // jsdom converts shorthand hex (#fff) to rgb(255, 255, 255)
    expect(btn.style.color).toMatch(/^(#fff|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/);
  });

  test('applies glow text-shadow using game main color when ready', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.textShadow).toBe('0 0 8px ' + COLOR.main);
  });

  test('applies glow box-shadow using game rgb color when ready', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.boxShadow).toBe('0 0 15px rgba(' + COLOR.rgb + ',0.3)');
  });

  test('sets cursor to pointer when ready', () => {
    _rppiGmCheckReady(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.style.cursor).toBe('pointer');
  });

  test('clears status element text when ready', () => {
    const st = document.getElementById('rppi-status-' + GAME);
    st.textContent = 'Necesitás 999 RPPI-C. Tenés 0.';
    _rppiGmCheckReady(GAME);

    expect(st.textContent).toBe('');
  });
});

// ===========================================================================
// _rppiGmCheckReady – missing DOM elements (graceful handling)
// ===========================================================================
describe('_rppiGmCheckReady – missing DOM elements', () => {
  test('returns early without throwing when button element does not exist', () => {
    document.body.innerHTML = ''; // no DOM elements
    _rppiGmState[GAME] = { amount: 10, time: 5, boost: 2 };
    window._rppiUser   = { credits: 100 };

    expect(() => _rppiGmCheckReady(GAME)).not.toThrow();
  });

  test('does not throw when status element is missing in insufficient-credits branch', () => {
    // Remove only the status element
    document.getElementById('rppi-status-' + GAME).remove();
    _rppiGmState[GAME] = { amount: 999, time: 5, boost: 2 };
    window._rppiUser   = { credits: 1 };

    expect(() => _rppiGmCheckReady(GAME)).not.toThrow();
    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });

  test('does not throw when status element is missing in sufficient-credits branch', () => {
    document.getElementById('rppi-status-' + GAME).remove();
    _rppiGmState[GAME] = { amount: 10, time: 5, boost: 2 };
    window._rppiUser   = { credits: 100 };

    expect(() => _rppiGmCheckReady(GAME)).not.toThrow();
    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.textContent).toBe('LANZAR DESAFIO RPPI-C');
  });

  test('does not throw when status element is missing in incomplete-state branch', () => {
    document.getElementById('rppi-status-' + GAME).remove();
    _rppiGmState[GAME] = { amount: 0, time: 0, boost: 0 };

    expect(() => _rppiGmCheckReady(GAME)).not.toThrow();
  });
});

// ===========================================================================
// rppiGmInputAmount – reads input, updates state, delegates to _rppiGmCheckReady
// ===========================================================================
describe('rppiGmInputAmount – input reading and state update', () => {
  test('sets state amount from input value and updates preview', () => {
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '75';
    _rppiGmState[GAME] = { amount: 0, time: 5, boost: 2 };

    rppiGmInputAmount(GAME);

    expect(_rppiGmState[GAME].amount).toBe(75);
    const prev = document.getElementById('rppi-input-preview-' + GAME);
    expect(prev.textContent).toBe('75 RPPI-C INGRESADOS');
  });

  test('parses float input value correctly', () => {
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '12.5';
    _rppiGmState[GAME] = { amount: 0, time: 1, boost: 1 };

    rppiGmInputAmount(GAME);

    expect(_rppiGmState[GAME].amount).toBe(12.5);
  });

  test('resets state amount to 0 and clears preview when input is empty', () => {
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '';
    _rppiGmState[GAME] = { amount: 99, time: 5, boost: 2 };

    rppiGmInputAmount(GAME);

    expect(_rppiGmState[GAME].amount).toBe(0);
    const prev = document.getElementById('rppi-input-preview-' + GAME);
    expect(prev.textContent).toBe('');
  });

  test('initializes state entry with defaults when game key is absent', () => {
    const newGame = 'pacman';
    _rppiGmColors[newGame] = { main: '#ff0', rgb: '255,255,0' };
    setupDom(newGame, { inputValue: '30' });
    // _rppiGmState has no entry for newGame yet

    rppiGmInputAmount(newGame);

    expect(_rppiGmState[newGame]).toBeDefined();
    expect(_rppiGmState[newGame].amount).toBe(30);
  });

  test('calls _rppiGmCheckReady which enables the button when all state is valid and credits sufficient', () => {
    window._rppiUser = { credits: 200 };
    _rppiGmState[GAME] = { amount: 0, time: 5, boost: 2 };
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '50';

    rppiGmInputAmount(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('LANZAR DESAFIO RPPI-C');
  });

  test('calls _rppiGmCheckReady which disables button when credits are insufficient', () => {
    window._rppiUser = { credits: 10 };
    _rppiGmState[GAME] = { amount: 0, time: 5, boost: 2 };
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '100';

    rppiGmInputAmount(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('RPPI-C INSUFICIENTES');
  });

  test('calls _rppiGmCheckReady which shows SELECCIONA OPCIONES when state is incomplete after clearing input', () => {
    _rppiGmState[GAME] = { amount: 50, time: 5, boost: 2 };
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '';

    rppiGmInputAmount(GAME);

    const btn = document.getElementById('rppi-launch-' + GAME);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('SELECCIONA OPCIONES');
  });

  test('does not throw when preview element is missing', () => {
    document.getElementById('rppi-input-preview-' + GAME).remove();
    const input = document.getElementById('rppi-input-' + GAME);
    input.value = '50';
    _rppiGmState[GAME] = { amount: 0, time: 5, boost: 2 };

    expect(() => rppiGmInputAmount(GAME)).not.toThrow();
  });
});

// ===========================================================================
// Status message content – regression / format tests
// ===========================================================================
describe('_rppiGmCheckReady – status message format regression', () => {
  test('status message contains exact amount needed and credits available', () => {
    _rppiGmState[GAME] = { amount: 250, time: 3, boost: 1 };
    window._rppiUser   = { credits: 100 };
    _rppiGmCheckReady(GAME);

    const st = document.getElementById('rppi-status-' + GAME);
    expect(st.textContent).toContain('250');
    expect(st.textContent).toContain('100');
  });

  test('status message uses correct Spanish phrasing', () => {
    _rppiGmState[GAME] = { amount: 10, time: 1, boost: 1 };
    window._rppiUser   = { credits: 5 };
    _rppiGmCheckReady(GAME);

    const st = document.getElementById('rppi-status-' + GAME);
    expect(st.textContent).toMatch(/Necesit[aá]s\s+\d+\s+RPPI-C/);
    expect(st.textContent).toMatch(/Ten[eé]s\s+\d+/);
  });

  test('status message is cleared when transitioning from insufficient to sufficient credits', () => {
    _rppiGmState[GAME] = { amount: 100, time: 5, boost: 2 };
    window._rppiUser   = { credits: 50 };
    _rppiGmCheckReady(GAME);

    // Simulate user adding credits
    window._rppiUser.credits = 200;
    _rppiGmCheckReady(GAME);

    const st = document.getElementById('rppi-status-' + GAME);
    expect(st.textContent).toBe('');
  });
});
