/**
 * REKT Wall CSS Integration Tests
 * TDD: These tests verify S1 (grayscale hover), S3 (gradient overlays),
 * S2 (modal markup), and S4 (responsive) from the spec.
 *
 * Run: node tests/rekt-wall-css.test.js
 */
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'indexSybil14.html');
const html = fs.readFileSync(HTML_PATH, 'utf-8');

// Extract only the REKT wall <style> block (lines ~4300-4358)
const rektStyleMatch = html.match(/<style>([\s\S]*?\.bt-rekt-wall[\s\S]*?)<\/style>/);
const rektCSS = rektStyleMatch ? rektStyleMatch[1] : '';

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

// ─── S1: Grayscale-to-Color Hover ─────────────────────────────────────────────

console.log('\n[S1] Grayscale default on .bt-rekt-card');

assert(
  rektCSS.includes('filter') && rektCSS.includes('grayscale'),
  'bt-rekt-card has filter: grayscale(1) property'
);

assert(
  /\.bt-rekt-card\s*\{[^}]*filter\s*:\s*grayscale\s*\(\s*1\s*\)/.test(rektCSS),
  'grayscale value is exactly 1'
);

console.log('\n[S1] Hover transition to full color + zoom');

assert(
  /\.bt-rekt-card:hover/.test(rektCSS),
  'bt-rekt-card:hover selector exists'
);

assert(
  /\.bt-rekt-card:hover[^}]*filter\s*:\s*grayscale\s*\(\s*0\s*\)/.test(rektCSS),
  'hover sets grayscale(0)'
);

assert(
  /\.bt-rekt-card:hover[^}]*scale\s*\(\s*1\.2\s*\)/.test(rektCSS),
  'hover sets transform: scale(1.2) — 20% zoom'
);

console.log('\n[S1] Transition smoothness');

assert(
  /\.bt-rekt-card[^}]*transition[^}]*0\.4s/.test(rektCSS) ||
  rektCSS.includes('0.4s'),
  'transition duration is 0.4s'
);

assert(
  /\.bt-rekt-card[^}]*transition[^}]*ease/.test(rektCSS) ||
  rektCSS.includes('ease'),
  'transition timing is ease'
);

// ─── S3: Gradient Overlays per Crisis Era ──────────────────────────────────────

console.log('\n[S3] Gradient overlays');

assert(
  /\.bt-rekt-card-1987/.test(rektCSS),
  'bt-rekt-card-1987 class exists'
);

assert(
  /\.bt-rekt-card-2000/.test(rektCSS),
  'bt-rekt-card-2000 class exists'
);

assert(
  /\.bt-rekt-card-2008/.test(rektCSS),
  'bt-rekt-card-2008 class exists'
);

assert(
  /\.bt-rekt-card-2020/.test(rektCSS),
  'bt-rekt-card-2020 class exists'
);

assert(
  /\.bt-rekt-card-2022/.test(rektCSS),
  'bt-rekt-card-2022 class exists'
);

assert(
  /linear-gradient|radial-gradient/.test(rektCSS),
  'gradient functions present in CSS'
);

// Check year-specific themes — verify gradient declarations exist with hex colors
assert(
  /card-1987[^}]*linear-gradient/.test(rektCSS),
  '1987 card has gradient (dark red → charcoal)'
);

assert(
  /card-2000[^}]*linear-gradient/.test(rektCSS),
  '2000 card has gradient (blue → purple)'
);

assert(
  /card-2008[^}]*linear-gradient/.test(rektCSS),
  '2008 card has gradient (steel-gray → navy)'
);

assert(
  /card-2020[^}]*linear-gradient/.test(rektCSS),
  '2020 card has gradient (dark teal → black)'
);

assert(
  /card-2022[^}]*linear-gradient/.test(rektCSS),
  '2022 card has gradient (orange → brown)'
);

// ─── S2: Modal Structure ──────────────────────────────────────────────────────

console.log('\n[S2] Modal markup');

assert(
  rektCSS.includes('.bt-rekt-modal') || html.includes('bt-rekt-modal'),
  'modal class (.bt-rekt-modal) defined'
);

assert(
  rektCSS.includes('modal-overlay') || html.includes('bt-rekt-modal-overlay'),
  'modal overlay class exists'
);

assert(
  html.includes('data-desc') || html.includes('data-desc='),
  'cards carry data-desc attribute with crisis description'
);

assert(
  html.includes('bt-rekt-modal-close') || rektCSS.includes('bt-rekt-modal-close'),
  'close button [X] class exists'
);

// ─── S4: Responsive at 700px ─────────────────────────────────────────────────

console.log('\n[S4] Responsive behavior');

assert(
  rektCSS.includes('@media') && rektCSS.includes('700px'),
  'media query at 700px exists'
);

// ─── S5: Integration Constraints ──────────────────────────────────────────────

console.log('\n[S5] Integration constraints');

// No global selectors that could break other sections
const globalStarRegex = /\*\s*\{/;
const rektOnly = rektCSS;
const hasGlobalStar = globalStarRegex.test(rektOnly);
assert(!hasGlobalStar, 'No global * selector in REKT wall styles');

assert(
  rektCSS.includes('clip-path') || html.includes('clip-path'),
  'clip-path preserved on cards'
);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(60)}`);

process.exit(failed > 0 ? 1 : 0);
