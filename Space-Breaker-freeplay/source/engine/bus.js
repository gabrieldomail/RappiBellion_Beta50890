// bus.js — tiny event bus to decouple game systems
const map = new Map();

export function on(ev, fn) {
  let l = map.get(ev);
  if (!l) { l = []; map.set(ev, l); }
  l.push(fn);
}
export function off(ev, fn) {
  const l = map.get(ev);
  if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
}
export function emit(ev, data) {
  const l = map.get(ev);
  if (!l) return;
  for (let i = 0; i < l.length; i++) l[i](data);
}
export function clearBus() { map.clear(); }
