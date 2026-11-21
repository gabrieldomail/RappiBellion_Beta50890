// camera.js — trauma-based shake, zoom punch, hit-stop + slow-mo wrappers
import { Time } from '../engine/time.js';
import { rand } from '../engine/rand.js';

export const Cam = {
  shake: 0,          // 0..1 trauma
  zoom: 1,           // current world zoom
  zoomTarget: 1,
  dx: 0, dy: 0,      // shake offset in world px
  rot: 0,
};

export function addShake(a) { Cam.shake = Math.min(1, Cam.shake + a); }
export function hitstop(sec) { Time.hitstop = Math.max(Time.hitstop, sec); }
export function slowmo(scale, recoverAfter = 0) {
  // import cycle safety: dynamic use of setSlowmo via Time
  Time.targetScale = scale;
  if (recoverAfter > 0) {
    clearTimeout(slowmo._t);
    slowmo._t = setTimeout(() => { Time.targetScale = 1; }, recoverAfter * 1000);
  }
}
export function punchZoom(z) { Cam.zoomTarget = z; }

export function updateCam(realDt) {
  Cam.shake = Math.max(0, Cam.shake - realDt * 1.6);
  const s2 = Cam.shake * Cam.shake;
  const amp = 34 * s2;
  Cam.dx = (rand(-1, 1)) * amp;
  Cam.dy = (rand(-1, 1)) * amp;
  Cam.rot = (rand(-1, 1)) * 0.014 * s2;
  Cam.zoom += (Cam.zoomTarget - Cam.zoom) * Math.min(1, realDt * 5);
  if (Math.abs(Cam.zoomTarget - Cam.zoom) < 0.004) Cam.zoomTarget = 1;
}
