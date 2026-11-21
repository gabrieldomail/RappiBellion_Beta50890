// bossBase.js — boss lifecycle: enter/fight/dying, parts, phases, chain-death reward
import { W, H } from '../../engine/renderer.js';
import { burst } from '../../engine/particles.js';
import { sfx } from '../../engine/audio.js';
import { emit } from '../../engine/bus.js';
import { bossChain, explBig, medalShower } from '../../fx/explosions.js';
import { addShake, slowmo, hitstop } from '../../fx/camera.js';
import { flash, aberration, glitch } from '../../engine/postfx.js';
import { enemyBulletSweep } from '../bullets.js';
import { Pl, hitPlayer } from '../player.js';
import { applyScore, killMeter } from '../combo.js';
import { dropPowerup } from '../powerups.js';
import { dist2 } from '../../engine/rand.js';
import { makeSeraph } from './seraph.js';
import { makeNova } from './novaLance.js';
import { makeHydra } from './hydraCore.js';

export let boss = null;

export function spawnBoss(kind, diff) {
  const makers = { seraph: makeSeraph, nova: makeNova, hydra: makeHydra };
  boss = (makers[kind] || makeSeraph)(diff);
  return boss;
}
export function bossActive() { return boss !== null && boss.state !== 'dead'; }
export function clearBoss() { boss = null; }

export function bossTestHit(x, y, dmg) {
  if (!boss || boss.state === 'dead') return false;
  if (boss.state === 'dying') return false;
  const b = boss;

  // parts first (turrets / nodes / pods)
  for (const p of b.parts) {
    if (!p.alive) continue;
    const wx = b.x + (p.dx || 0), wy = b.y + (p.dy || 0);
    if (dist2(x, y, wx, wy) < p.r * p.r) {
      p.hp -= dmg;
      p.hitFlash = 0.08;
      sfx.bossHurt();
      burst(x, y, 4, { col: '#ffd23f', spd: 180, life: 0.3, size: 4 });
      if (p.hp <= 0) {
        p.alive = false;
        explBig(wx, wy, p.col || '#ffd23f');
        b.onPartDead && b.onPartDead(p);
      }
      return true;
    }
  }

  // core
  if (dist2(x, y, b.x, b.y) < b.coreR * b.coreR) {
    if (b.state !== 'fight' || b.coreVulnerable === false) {
      burst(x, y, 5, { col: b.shieldCol || '#8ff', spd: 200, life: 0.3, size: 4 });
      sfx.hit();
      return true;
    }
    b.hp -= dmg * (b.crit ? 2.5 : 1);
    b.hitFlash = 0.07;
    b.popT = 0.14;
    sfx.bossHurt();
    burst(x, y, 5, { col: '#fff', spd: 220, life: 0.28, size: 5 });
    phaseCheck(b);
    if (b.hp <= 0) startDeath(b);
    return true;
  }

  // armored hull: reduced damage (25%) — every landed shot counts, the core pays 4x
  if (b.bodyR && dist2(x, y, b.x, b.y) < b.bodyR * b.bodyR) {
    b.hp -= dmg * 0.25;
    b.hitFlash = 0.05;
    burst(x, y, 3, { col: '#9ab', spd: 160, life: 0.25, size: 3 });
    sfx.hit();
    phaseCheck(b);
    if (b.hp <= 0) startDeath(b);
    return true;
  }
  return false;
}

export function bossBombHit(dmg) {
  if (!boss || boss.state !== 'fight') return;
  boss.hp -= dmg;
  for (const p of boss.parts) if (p.alive) p.hp -= dmg;
  phaseCheck(boss);
  if (boss.hp <= 0) startDeath(boss);
}

function phaseCheck(b) {
  const frac = b.hp / b.maxHp;
  let ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  if (ph !== b.phase) {
    b.phase = ph;
    b.onPhase && b.onPhase(ph);
    flash(255, 80, 80, 0.24);
    aberration(0.7);
    glitch(0.22, 0.9);
    addShake(0.4);
    hitstop(0.06);
    sfx.warn();
  }
}

function startDeath(b) {
  if (b.state === 'dying') return;
  b.state = 'dying';
  b.deathT = 2.35;
  enemyBulletSweep();
  slowmo(0.3, 1.9);
  addShake(0.6);
  flash(255, 220, 160, 0.35);
  bossChain(b.x, b.y, b.w * 0.9, b.h * 0.9, 2.2, () => finishDeath(b));
}

function finishDeath(b) {
  const base = 5000 + 1000 * Math.ceil(b.stageN || 1);
  applyScore(base, b.x, b.y);
  killMeter(40);
  medalShower(b.x, b.y, 8);
  dropPowerup(b.x, b.y, true);
  emit('bossDead', { boss: b });
  boss = null;
}

export function updateBoss(dt) {
  if (!boss) return;
  const b = boss;
  b.t += dt;
  if (b.hitFlash > 0) b.hitFlash -= dt;
  if (b.popT > 0) b.popT = Math.max(0, b.popT - dt);

  if (b.state === 'enter') {
    b.update(dt);
    if (b.enterDone) { b.state = 'fight'; b.onEnterDone && b.onEnterDone(); }
  } else if (b.state === 'fight') {
    b.update(dt);
    // body contact with player
    if (!Pl.hidden && b.bodyR) {
      const rr = b.bodyR + Pl.r;
      if (dist2(b.x, b.y, Pl.x, Pl.y) < rr * rr) hitPlayer();
    }
  } else if (b.state === 'dying') {
    b.deathT -= dt;
    b.update && b.update(dt);
    // stay put while exploding
  }
}

export function drawBoss(ctx) {
  if (!boss || boss.state === 'dead') return;
  const b = boss;
  // hit pop + gentle 2% idle breathing (alive, massive, menacing)
  const pop = (b.popT > 0 ? 1 + 0.05 * (b.popT / 0.14) : 1) * (1 + 0.02 * Math.sin(b.t * 2));
  ctx.save();
  if (pop !== 1) {
    ctx.translate(b.x, b.y);
    ctx.scale(pop, pop);
    ctx.translate(-b.x, -b.y);
  }
  b.draw(ctx);
  if (b.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.8, b.hitFlash * 9);
    b.draw(ctx, true);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

export function bossHUD() {
  if (!boss || boss.state === 'dying') return null;
  return {
    name: boss.name,
    hp: Math.max(0, boss.hp),
    maxHp: boss.maxHp,
    phase: boss.phase,
    shielded: boss.coreVulnerable === false,
  };
}
