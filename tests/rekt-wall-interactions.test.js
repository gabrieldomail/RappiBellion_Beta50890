/**
 * T3: REKT Wall Interaction Tests (TDD)
 * Tests modal open/close, carousel pause, keyboard handling.
 *
 * Uses jsdom to simulate the actual DOM and execute inline JS.
 * Run: npx jest tests/rekt-wall-interactions.test.js
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'indexSybil14.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

// Extract the REKT wall script body by locating the data-desc querySelector
const rektSelectorIdx = html.indexOf("bt-rekt-card[data-desc]");
const scriptTagStart = html.lastIndexOf('<script>', rektSelectorIdx + 200);
const scriptTagEnd = html.indexOf('</script>', rektSelectorIdx);
const rektScriptBody = html.substring(
  scriptTagStart + 8, // skip '<script>'
  scriptTagEnd
).trim();

// Minimal DOM fixture mimicking the REKT wall structure
function createFixture() {
  document.body.innerHTML = `
    <div class="bt-rekt-track" id="bt-rekt-track">
      <div class="bt-rekt-card bt-rekt-card-2000" data-era="2000" data-desc="La pantalla publicitaria de NASDAQ en Times Square brillando en el pico de la burbuja tecnológica.">
        <div class="bt-rekt-year-tag">2000</div>
        <div class="bt-rekt-masthead">THE WALL STREET TIMES</div>
        <div class="bt-rekt-headline">DOT-COM BUBBLE BURSTS:<br>NASDAQ EN CAÍDA LIBRE</div>
        <div class="bt-rekt-date">10 MARZO 2000</div>
      </div>
      <div class="bt-rekt-card bt-rekt-card-2008" data-era="2008" data-desc="Los empleados saliendo de la sede corporativa cargando cajas de cartón.">
        <div class="bt-rekt-year-tag">2008</div>
        <div class="bt-rekt-masthead">FINANCIAL CHRONICLE</div>
        <div class="bt-rekt-headline">LEHMAN BROTHERS COLAPSA:<br>CRISIS DE LAS CDO SUBPRIME</div>
        <div class="bt-rekt-date">15 SEPTIEMBRE 2008</div>
      </div>
      <!-- Duplicated card without data-desc -->
      <div class="bt-rekt-card">
        <div class="bt-rekt-year-tag">2000</div>
        <div class="bt-rekt-headline">DOT-COM BUBBLE BURSTS:<br>NASDAQ EN CAÍDA LIBRE</div>
      </div>
    </div>
    <div class="bt-rekt-modal-overlay" id="bt-rekt-modal" style="display:none;">
      <div class="bt-rekt-modal">
        <button class="bt-rekt-modal-close">[X]</button>
        <div class="bt-rekt-modal-title" id="bt-rekt-modal-title"></div>
        <div class="bt-rekt-modal-desc" id="bt-rekt-modal-desc"></div>
        <a class="bt-rekt-modal-cta" href="#" target="_blank">CLICK TO SEE WALL REKT FACE</a>
      </div>
    </div>
  `;
}

// Execute the script in jsdom's window context via globalThis.eval
function injectScript() {
  // globalThis in jest-jsdom IS the jsdom window
  globalThis.eval(rektScriptBody);
}

// ─── T3.1: Card click opens modal with correct content ──────────────────────
describe('T3.1 Card click opens modal', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
  });

  test('clicking a card with data-desc sets modal display to flex', () => {
    const card = document.querySelector('.bt-rekt-card-2000');
    card.click();
    const modal = document.getElementById('bt-rekt-modal');
    expect(modal.style.display).toBe('flex');
  });

  test('modal title contains card headline text', () => {
    const card = document.querySelector('.bt-rekt-card-2000');
    card.click();
    const title = document.getElementById('bt-rekt-modal-title');
    expect(title.textContent).toContain('DOT-COM BUBBLE BURSTS');
  });

  test('modal description comes from data-desc attribute', () => {
    const card = document.querySelector('.bt-rekt-card-2000');
    card.click();
    const desc = document.getElementById('bt-rekt-modal-desc');
    expect(desc.textContent).toContain('NASDAQ en Times Square');
  });
});

// ─── T3.2: Carousel pauses when modal opens ─────────────────────────────────
describe('T3.2 Carousel pauses on modal open', () => {
  beforeEach(() => {
    createFixture();
    document.getElementById('bt-rekt-track').style.animationPlayState = 'running';
    injectScript();
  });

  test('track animation pauses when card is clicked', () => {
    const card = document.querySelector('.bt-rekt-card-2000');
    card.click();
    const track = document.getElementById('bt-rekt-track');
    expect(track.style.animationPlayState).toBe('paused');
  });
});

// ─── T3.3: Close button closes modal and resumes carousel ───────────────────
describe('T3.3 Close button behavior', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
    document.querySelector('.bt-rekt-card-2000').click();
  });

  test('closeRektModal sets modal display to none', () => {
    window.closeRektModal();
    const modal = document.getElementById('bt-rekt-modal');
    expect(modal.style.display).toBe('none');
  });

  test('closeRektModal resumes carousel animation', () => {
    window.closeRektModal();
    const track = document.getElementById('bt-rekt-track');
    expect(track.style.animationPlayState).toBe('running');
  });
});

// ─── T3.4: Overlay click closes modal ───────────────────────────────────────
describe('T3.4 Overlay click closes modal', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
    document.querySelector('.bt-rekt-card-2000').click();
  });

  test('clicking the overlay (not the modal card) closes the modal', () => {
    const overlay = document.getElementById('bt-rekt-modal');
    const event = new Event('click', { bubbles: true });
    Object.defineProperty(event, 'target', { value: overlay, writable: false });
    overlay.dispatchEvent(event);
    expect(overlay.style.display).toBe('none');
  });
});

// ─── T3.5: Escape key closes modal ──────────────────────────────────────────
describe('T3.5 Escape key closes modal', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
    document.querySelector('.bt-rekt-card-2000').click();
  });

  test('pressing Escape closes the modal', () => {
    const modal = document.getElementById('bt-rekt-modal');
    expect(modal.style.display).toBe('flex');

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);

    expect(modal.style.display).toBe('none');
  });

  test('pressing Escape resumes carousel', () => {
    const track = document.getElementById('bt-rekt-track');
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    document.dispatchEvent(escEvent);
    expect(track.style.animationPlayState).toBe('running');
  });
});

// ─── T3.6: Cards without data-desc are not wired up ─────────────────────────
describe('T3.6 Cards without data-desc are ignored', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
  });

  test('clicking a duplicated card (no data-desc) does not open modal', () => {
    const dupCards = document.querySelectorAll('.bt-rekt-card:not([data-desc])');
    dupCards.forEach(card => card.click());
    const modal = document.getElementById('bt-rekt-modal');
    expect(modal.style.display).toBe('none');
  });
});

// ─── T3.7: closeRektModal is globally accessible ────────────────────────────
describe('T3.7 closeRektModal global accessibility', () => {
  beforeEach(() => {
    createFixture();
    injectScript();
  });

  test('closeRektModal is defined on window', () => {
    expect(typeof window.closeRektModal).toBe('function');
  });
});
