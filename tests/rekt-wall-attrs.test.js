/**
 * T2: REKT Wall Data Attributes & Modal Markup Tests
 * Verifies:
 *   - First-set cards have data-era and data-desc attributes
 *   - Modal HTML exists with display:none
 *   - Duplicated cards do NOT have data-era or data-desc
 *
 * Run: node tests/rekt-wall-attrs.test.js
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'indexSybil14.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

// ─── Helper: extract card blocks between markers ──────────────────────────────
// First set: from bt-rekt-track opening to the <!-- Duplicado --> comment
const trackStart = html.indexOf('id="bt-rekt-track"');
const dupComment = html.indexOf('<!-- Duplicado para loop infinito -->');
const firstSetHTML = html.substring(trackStart, dupComment);
// Scope duplicated cards to just the card divs, stopping at the track/wall closing
const wallCloseRe = /\s*<\/div>\s*<\/div>\s*<\/div>/;
const dupRegion = html.substring(dupComment, dupComment + 2000);
const wallCloseMatch = dupRegion.match(wallCloseRe);
const dupSetHTML = wallCloseMatch
  ? dupRegion.substring(0, dupRegion.indexOf(wallCloseMatch[0]) + wallCloseMatch[0].length)
  : dupRegion;

// ─── T2.1: First-set cards carry data-era ────────────────────────────────────
console.log('\n[T2.1] First-set cards have data-era attribute');

const firstSetCardEras = ['2000', '2008', '2020', '2022', '1987'];
for (const era of firstSetCardEras) {
  const regex = new RegExp(`data-era=["']${era}["']`);
  assert(regex.test(firstSetHTML), `card ${era} has data-era="${era}"`);
}

// ─── T2.2: First-set cards carry data-desc ───────────────────────────────────
console.log('\n[T2.2] First-set cards have data-desc attribute');

for (const era of firstSetCardEras) {
  const regex = new RegExp(`bt-rekt-card-${era}[^>]*data-desc=`);
  assert(regex.test(firstSetHTML), `card ${era} has data-desc attribute`);
}

// ─── T2.3: Modal HTML exists with display:none ───────────────────────────────
console.log('\n[T2.3] Modal HTML exists with display:none');

assert(
  html.includes('bt-rekt-modal') && html.includes('display:none'),
  'modal overlay exists with display:none'
);

assert(
  html.includes('id="bt-rekt-modal"'),
  'modal has id="bt-rekt-modal"'
);

assert(
  html.includes('id="bt-rekt-modal-title"'),
  'modal has title element'
);

assert(
  html.includes('id="bt-rekt-modal-desc"'),
  'modal has description element'
);

// ─── T2.4: Duplicated cards do NOT have data-era or data-desc ────────────────
console.log('\n[T2.4] Duplicated cards have NO data-era or data-desc');

assert(
  !/data-era/.test(dupSetHTML),
  'duplicated cards have no data-era attribute'
);

assert(
  !/data-desc/.test(dupSetHTML),
  'duplicated cards have no data-desc attribute'
);

// ─── T2.5: Modal JS queries data-desc correctly ──────────────────────────────
console.log('\n[T2.5] Modal JS queries data-desc');

assert(
  html.includes("querySelectorAll('.bt-rekt-card[data-desc]')") ||
  html.includes('querySelectorAll(".bt-rekt-card[data-desc]")'),
  'JS selects cards with data-desc selector'
);

assert(
  html.includes("getAttribute('data-desc')") ||
  html.includes('getAttribute("data-desc")'),
  'JS reads data-desc via getAttribute'
);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}`);

process.exit(failed > 0 ? 1 : 0);
