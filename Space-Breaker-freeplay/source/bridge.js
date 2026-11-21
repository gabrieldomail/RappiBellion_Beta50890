// bridge.js — RappiBellion platform postMessage contract (100% compatible with legacy game)
import { S } from './game/state.js';
import { In, bridgeKey, bridgeFire } from './engine/input.js';
import { startGame } from './game/director.js';
import { triggerOverdrive } from './game/combo.js';
import { emit } from './engine/bus.js';

export const Bridge = {
  inIframe: false,
  scoreTimer: null,
  matchOverSent: false,
};

export function initBridge() {
  Bridge.inIframe = window.self !== window.top;
  S.inIframe = Bridge.inIframe;

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d.type !== 'string') return;
    switch (d.type) {
      case 'START_MATCH':
        startMatchOnce();
        break;
      case 'MATCH_ENDED':
        // freeze and report final score (parent settles the verdict by timer)
        if (S.mode === 'playing' || S.mode === 'paused') {
          S.mode = 'gameover';
          notifyGameOver();
        }
        break;
      case 'SET_CONTROL':
        // dpad | swipe — both map onto the unified input already
        Bridge.controlMode = d.mode;
        break;
      case 'KEY_DOWN':
        bridgeKey(d.key, true);
        break;
      case 'KEY_UP':
        bridgeKey(d.key, false);
        break;
      case 'FIRE_START':
        bridgeFire(true);
        break;
      case 'FIRE_STOP':
        bridgeFire(false);
        break;
      case 'OVERDRIVE_SENSITIVITY':
        S.speedMult = typeof d.speedMultiplier === 'number' ? d.speedMultiplier : 1;
        break;
      case 'ATOMIC_PULSE':
        if (S.mode === 'playing') {
          if (triggerOverdrive(true)) notifyBoostUsed();
        }
        break;
      case 'UNLOCK_CHAOS':
      case 'CHAOS_LEVEL':
      case 'SET_GAME_WIDTH':
        // acknowledged; no behavioral change in freeplay
        break;
    }
  });

  // score stream: every 250ms while playing
  Bridge.scoreTimer = setInterval(() => {
    if (S.mode === 'playing' && S.score !== S.lastScoreSent) {
      notifyScore();
    }
  }, 250);
}

let startedOnce = false;
function startMatchOnce() {
  if (S.mode === 'playing' || S.mode === 'paused') return; // idempotent
  startedOnce = true;
  startGame();
}

// standalone (no iframe): auto-start on first interaction, like pac-hack Init.js
export function checkAutoStart() {
  if (Bridge.inIframe || startedOnce) return;
  if (S.mode === 'title' && In.anyPress) {
    startedOnce = true;
  }
}

export function notifyScore() {
  S.lastScoreSent = S.score;
  send({ type: 'SCORE_UPDATE', score: S.score });
}
export function notifyGameOver(score) {
  send({ type: 'GAME_OVER', score: score ?? S.score });
}
export function notifyBoostUsed() {
  send({ type: 'BOOST_USED' });
}

function send(msg) {
  try {
    if (Bridge.inIframe) window.parent.postMessage(msg, '*');
  } catch (e) { /* cross-origin exotic: ignore */ }
}
