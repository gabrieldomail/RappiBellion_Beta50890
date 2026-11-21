// time.js — fixed timestep accumulator with slow-mo + hit-stop support
export const STEP = 1 / 60;

export const Time = {
  dt: STEP,          // effective fixed dt (always STEP; slow-mo via fewer steps)
  scale: 1,          // current time scale (slow-mo)
  targetScale: 1,    // where scale is heading
  elapsed: 0,        // world time (scaled)
  hitstop: 0,        // seconds of world freeze
  fps: 60,
};

let acc = 0;
let fpsAvg = 16.7;

// Advances the world in fixed steps. update() runs 0..4 times per frame.
export function frame(realDt, update) {
  fpsAvg = fpsAvg * 0.95 + (realDt * 1000) * 0.05;
  Time.fps = 1000 / fpsAvg;

  Time.scale += (Time.targetScale - Time.scale) * Math.min(1, realDt * 6);
  if (Math.abs(Time.scale - Time.targetScale) < 0.01) Time.scale = Time.targetScale;

  if (Time.hitstop > 0) {
    Time.hitstop -= realDt;
    if (Time.hitstop > 0) return 0;
    Time.hitstop = 0;
  }

  acc += Math.min(realDt, 0.1) * Time.scale;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    Time.elapsed += STEP;
    update();
    steps++;
    acc -= STEP;
  }
  if (acc > STEP * 4) acc = 0; // drop backlog after big stall
  return steps;
}

export function setSlowmo(scale, recoverAfter = 0) {
  Time.targetScale = scale;
  if (recoverAfter > 0) {
    clearTimeout(setSlowmo._t);
    setSlowmo._t = setTimeout(() => { Time.targetScale = 1; }, recoverAfter * 1000);
  } else {
    clearTimeout(setSlowmo._t);
  }
}
