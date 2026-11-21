// input.js — unified input: keyboard, touch/pointer, bridge-injected keys (dpad)
import { getDrawRegion } from './renderer.js';

export const In = {
  left: false, right: false, up: false, down: false,
  fire: false, fireHeld: false,
  axis: 0,               // -1..1 horizontal
  dash: false,           // edge
  overdrive: false,      // edge
  pause: false,          // edge
  confirm: false,        // edge (Enter / tap)
  back: false,           // edge (Esc in menus)
  muteToggle: false,     // edge
  pointerX: null,        // world x target while touching
  touching: false,
  tap: false,            // edge: pointerdown this frame (position in ptrX/ptrY)
  ptrX: 0, ptrY: 0,      // last tap position in world coords
  anyPress: false,       // edge: any input at all (for menus / audio unlock)
};

const keys = new Set();
const edges = { dash: false, overdrive: false, pause: false, confirm: false, back: false, muteToggle: false, tap: false };
let lastTapT = 0;
let cv = null;

const MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'fire', KeyJ: 'fire',
  ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyK: 'dash',
  KeyE: 'overdrive', KeyB: 'overdrive',
  KeyP: 'pause', Escape: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm',
  KeyM: 'muteToggle',
  Backquote: 'back',
};

export function initInput(canvas) {
  cv = canvas;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) { if (MAP[e.code]) e.preventDefault(); return; }
    press(e.code);
    if (MAP[e.code]) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => release(e.code));

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    const p = ptrToWorldPair(e);
    In.touching = true;
    In.pointerX = p.x;
    In.ptrX = p.x;
    In.ptrY = p.y;
    edges.tap = true;
    In.fire = true;
    In.anyPress = true;
    const now = performance.now();
    if (now - lastTapT < 280) edges.dash = true;
    lastTapT = now;
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (In.touching) { In.pointerX = ptrToWorld(e); e.preventDefault(); }
  });
  const up = () => { In.touching = false; In.pointerX = null; In.fire = false; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// client px -> world px through the VISIBLE draw region (zoom/parent-clip proof)
function ptrToWorldPair(e) {
  const rg = getDrawRegion();
  return {
    x: Math.max(40, Math.min(1160, (e.clientX - rg.x) / rg.s)),
    y: Math.max(0, Math.min(1600, (e.clientY - rg.y) / rg.s)),
  };
}

function ptrToWorld(e) { return ptrToWorldPair(e).x; }

export function press(code) {
  const k = MAP[code];
  In.anyPress = true;
  if (!k) return;
  keys.add(k);
  if (k === 'dash') edges.dash = true;
  if (k === 'overdrive') edges.overdrive = true;
  if (k === 'pause') edges.pause = true;
  if (k === 'confirm') edges.confirm = true;
  if (k === 'muteToggle') edges.muteToggle = true;
  if (k === 'fire' && !In.fireHeld) In.fire = true;
}

export function release(code) {
  const k = MAP[code];
  if (!k) return;
  keys.delete(k);
}

// called by bridge: KEY_DOWN/KEY_UP with key names
export function bridgeKey(key, down) {
  const code = key && key.length === 1 ? 'Key' + key.toUpperCase() : key;
  if (down) press(code); else release(code);
}
export function bridgeFire(on) { In.fireHeld = on; if (on) In.fire = true; }

export function updateInput() {
  // axis: keyboard wins when held, else touch target handled by player
  const kAxis = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  In.axis = kAxis;
  // fire is a live state: keyboard hold, bridge hold, or any touch
  In.fire = keys.has('fire') || In.fireHeld || In.touching;

  In.dash = edges.dash; edges.dash = false;
  In.overdrive = edges.overdrive; edges.overdrive = false;
  In.pause = edges.pause; edges.pause = false;
  In.confirm = edges.confirm; edges.confirm = false;
  In.back = edges.back; edges.back = false;
  In.muteToggle = edges.muteToggle; edges.muteToggle = false;
  In.tap = edges.tap; edges.tap = false;
}

export function consumeFire() { const f = In.fire; In.fire = false; return f; }
export function clearEdges() {
  edges.dash = edges.overdrive = edges.pause = edges.confirm = edges.back = edges.muteToggle = edges.tap = false;
  In.anyPress = false;
}
