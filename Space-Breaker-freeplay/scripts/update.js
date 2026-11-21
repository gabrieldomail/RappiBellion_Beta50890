"use strict";

/* ==========================================================================
   UPDATE.JS — Lógica de juego original + hooks NeonFX
   Cambios respecto al original:
     · updateTime      → llama NeonFX.update + spawnea engine trail
     · updateTorpedos  → spawnea torpedo trail
     · checkEnemyCollision → bigExplosion + spawnHitSpark + popup score
     · checkFighterCollision → bigExplosion para muerte del player
     · Cuerpo enemigo vs fighter → bigExplosion para muerte del player
   ========================================================================== */

// ── Helpers NeonFX (guardas por si NeonFX no está disponible) ─────────────
function _nfxExplosion(x, y, type) {
    if (typeof NeonFX !== 'undefined') NeonFX.bigExplosion(x, y, type);
}
function _nfxHitSpark(x, y, color) {
    if (typeof NeonFX !== 'undefined') NeonFX.spawnHitSpark(x, y, color);
}
function _nfxPopup(text, x, y) {
    if (typeof NeonFX !== 'undefined') NeonFX.spawnPopup(text, x, y);
}
function _nfxLightPool(x, y, radius, type) {
    if (typeof NeonFX === 'undefined' || typeof MyGame === 'undefined' || !MyGame.graphics) return;
    const color = type === 'boss' ? NeonFX.COL.rojo
        : type === 'butterfly' ? NeonFX.COL.rosa
        : type === 'bee' ? NeonFX.COL.verde
        : NeonFX.COL.amarillo;
    MyGame.graphics.addLightPool(x, y, radius, color);
}
function _nfxEnemyDamageState(enemy, remaining, total) {
    if (typeof MyGame !== 'undefined' && MyGame.graphics &&
        typeof MyGame.graphics.showEnemyDamageState === 'function') {
        MyGame.graphics.showEnemyDamageState(enemy, remaining, total);
    }
}
function _nfxClearEnemyDamageState(enemy) {
    if (typeof MyGame !== 'undefined' && MyGame.graphics &&
        typeof MyGame.graphics.clearEnemyDamageState === 'function') {
        MyGame.graphics.clearEnemyDamageState(enemy);
    }
}

function checkHomingMissileCollisions(missiles, enemies, stats, particles, sound, powerups, fighter, removeEnemy) {
    for (let i = missiles.length - 1; i >= 0; i--) {
        const missile = missiles[i];
        for (let j = enemies.enemy.length - 1; j >= 0; j--) {
            const enemy = enemies.enemy[j];
            if (removeEnemy.includes(j)) continue;
            const size = enemies[enemy.type].size;
            const eW = enemy.commander ? 312 : size.width;
            const eH = enemy.commander ? 216 : size.height;
            if (Math.abs(missile.center.x - enemy.center.x) > eW / 2 + 18 ||
                Math.abs(missile.center.y - enemy.center.y) > eH / 2 + 18) continue;

            if (damageSpriteEnemy(enemy, missile.damage, stats, particles, sound, enemies, powerups, fighter,
                missile.center.x, missile.center.y)) {
                removeEnemy.push(j);
            }
            showHomingMissileImpact(missile, enemy);
            stats.stage.hits++;
            missiles.splice(i, 1);
            break;
        }
    }
}

function showHomingMissileImpact(missile, enemy) {
    if (typeof NeonFX === 'undefined') return;
    const color = missile.role === 'primary' ? '#8ef0ff' : '#b26bff';
    NeonFX.spawnHitSpark(missile.center.x, missile.center.y, color);
    if (enemy.type === 'boss' && enemy.life > 0) {
        NeonFX.shockwaves.push({
            x: missile.center.x, y: missile.center.y, r: 8, maxR: 105,
            life: 280, maxLife: 280, color
        });
        NeonFX.flash = Math.max(NeonFX.flash, 0.08);
    }
}

// Devuelve el score que se le daría a un enemigo (espejo de addScore)
function _getEnemyScore(enemy) {
    if (enemy.type === "bee"       && !enemy.diving) return 50;
    if (enemy.type === "bee"       &&  enemy.diving) return 100;
    if (enemy.type === "butterfly" && !enemy.diving) return 80;
    if (enemy.type === "butterfly" &&  enemy.diving) return 160;
    if (enemy.type === "boss"      && !enemy.diving) return 150;
    if (enemy.type === "boss"      &&  enemy.diving) return 400;
    return 100; // bonus1/2/3
}


// ═══════════════════════════════════════════════════════════════════════════
//  FUNCIONES ORIGINALES (sin modificar salvo los hooks NeonFX indicados)
// ═══════════════════════════════════════════════════════════════════════════

function updateTime(elapsedTime, stats, fighter) {
    stats.currentTime        += elapsedTime;
    stats.stage.stageTime    += elapsedTime;
    stats.stage.showStageTimer -= elapsedTime;

    if (fighter.invulnerableTimer > 0) {
        fighter.invulnerableTimer -= elapsedTime;
    } else if (fighter.dead) {
        fighter.deadTimer -= elapsedTime;
        if (fighter.deadTimer < 0 && fighter.lives > 0) {
            fighter.invulnerableTimer = 1000;
            fighter.dead = false;
        }
    }
    if (stats.showPlayerResults === true) {
        stats.endGameTimer -= elapsedTime;
    }

    // ── NeonFX: update global + engine trail del fighter ──────────────────
    if (typeof NeonFX !== 'undefined') {
        NeonFX.update(elapsedTime);
        if (!fighter.dead && fighter.img && fighter.img.isReady) {
            NeonFX.spawnEngineTrail(fighter.center.x, fighter.center.y);
        }
    }

    // ── ATOMIC IMMUNITY timer ─────────────────────────────────────────────
    if (fighter.atomicImmune && fighter.atomicImmune > 0) {
        fighter.atomicImmune -= elapsedTime;
        if (fighter.atomicImmune <= 0) {
            fighter.atomicImmune = 0;
            // Al terminar: flash suave de fin de inmunidad
            if (typeof NeonFX !== 'undefined') {
                NeonFX.flash = Math.max(NeonFX.flash, 0.18);
            }
        }
    }
}

function updateBackgroundStars(elapsedTime, backgroundStars) {
    const canvas = document.getElementById('id-canvas');
    for (let i = 0; i < backgroundStars.stars.length; i++) {
        const star = backgroundStars.stars[i];
        star.y += star.speed * elapsedTime / 1000;
        star.phase += elapsedTime * star.twinkleSpeed;
        if (star.y > canvas.height) star.y -= canvas.height;
    }
}

function spawnEnemies(stats, enemies) {
    let stageEnemies = stats.stage.stageEnemies;
    if (stageEnemies.length > 0) {
        let remove = [];
        for (let i = 0; i < stageEnemies.length; i++) {
            if (stageEnemies[i].time < stats.stage.stageTime) {
                for (let j = 0; j < stageEnemies[i].enemy.length; j++) {
                    enemies.enemy.push(stageEnemies[i].enemy[j]);
                }
                remove.push(i);
            }
        }
        for (let i = remove.length-1; i > -1; i--) {
            stageEnemies.splice(remove[i], 1);
        }
    }
}

function updateEnemy(elapsedTime, enemy, stats, enemies, torpedos, fighter) {
    // Update current sprite
    if (enemy.path.length !== 0 && (enemy.type === "bee" || enemy.type === "butterfly" || enemy.type === "boss")) {
        enemy.spriteCount -= elapsedTime;
        if (enemy.spriteCount < 0) {
            enemy.currentSprite = enemy.currentSprite === 0 ? 1 : 0;
            enemy.spriteCount = 400;
        }
    } else if (enemy.path.length === 0 && !enemy.diving) {
        enemy.currentSprite = enemies.formationSprite;
    }

    // Fire torpedo
    if (enemy.fireTimer > 0) {
        enemy.fireTimer -= elapsedTime;
        if (enemy.fireTimer <= 0) {
            fireEnemyTorpedo(enemy, torpedos, fighter, elapsedTime);
        }
    }

    // Update path
    if (enemy.path.length !== 0) {
        let speed = elapsedTime * (1 + (stats.stage.currentStage / 30));
        if (enemy.diving) speed /= 2;
        while (enemy.path.length !== 0 && speed !== 0) {
            let d = distance(enemy.center.x, enemy.center.y, enemy.path[0][0], enemy.path[0][1]);
            if (speed < d) {
                enemy.center = pointAtDistance(enemy.center.x, enemy.center.y, enemy.path[0][0], enemy.path[0][1], speed);
                speed = 0;
            } else {
                enemy.center = { x: enemy.path[0][0], y: enemy.path[0][1] };
                enemy.path.splice(0, 1);
                speed -= d;
            }
        }
        if (enemy.path.length === 1 && !enemy.diving) {
            enemy.path.push([enemy.formationLocation[0] + enemies.formationOffsetX, enemy.formationLocation[1]]);
        }
    } else if (enemy.path.length === 0 && enemy.diving) {
        enemy.path = getDivePath(enemy);
    } else if (enemies.formationLeftRight > 0) {
        enemy.center.x = enemy.formationLocation[0] + enemies.formationOffsetX;
    } else if (enemies.formationLeftRight === 0) {
        let diffX = enemy.formationLocation[0] - 600;
        enemy.center.x = diffX * enemies.formationOffsetBreath + 600;
        let diffY = enemy.formationLocation[1] - 200;
        enemy.center.y = diffY * enemies.formationOffsetBreath + 200;
    }
}

function updateEnemyFormation(elapsedTime, enemies) {
    enemies.formationSpriteCount -= elapsedTime;
    if (enemies.formationSpriteCount < 0) {
        enemies.formationSprite = enemies.formationSprite === 0 ? 1 : 0;
        enemies.formationSpriteCount = 500;
    }
    let speed = elapsedTime / 30;
    if (enemies.formationLeftRight > 0) {
        if (enemies.formationLeftRight % 2 === 0) {
            enemies.formationOffsetX += speed;
        } else {
            enemies.formationOffsetX -= speed;
        }
        if (enemies.formationOffsetX > 100) {
            enemies.formationOffsetX = 100;
            enemies.formationLeftRight -= 1;
        } else if (enemies.formationOffsetX < -100) {
            enemies.formationOffsetX = -100;
            enemies.formationLeftRight -= 1;
        } else if (enemies.formationLeftRight === 1 && enemies.formationOffsetX < 0) {
            enemies.formationOffsetX = 0;
            enemies.formationLeftRight = 0;
        }
    } else if (enemies.formationLeftRight === 0) {
        if (enemies.formationBreathOut) {
            enemies.formationOffsetBreath += speed / 250;
            if (enemies.formationOffsetBreath > 1.2) enemies.formationBreathOut = false;
        } else {
            enemies.formationOffsetBreath -= speed / 250;
            if (enemies.formationOffsetBreath < 1) enemies.formationBreathOut = true;
        }
    }
}

function updateEnemies(elapsedTime, enemies, stats, torpedos, fighter, sound) {
    updateEnemyFormation(elapsedTime, enemies);
    spawnEnemies(stats, enemies);
    for (let i = 0; i < enemies.enemy.length; i++) {
        const enemy = enemies.enemy[i];
        updateEnemy(elapsedTime, enemy, stats, enemies, torpedos, fighter);
        if (enemy.commander) updateCommander(elapsedTime, enemy, fighter, torpedos, stats);
    }
    enemyDiving(elapsedTime, enemies, stats, sound);
    spawnStageCommander(enemies, stats);
}

function enemyDiving(elapsedTime, enemies, stats, sound) {
    if (stats.stage.currentStage % 4 !== 3) {
        enemies.divingTimer -= elapsedTime;
    }
    if (enemies.divingTimer < 0) {
        let availableEnemies = [];
        for (let i = 0; i < enemies.enemy.length; i++) {
            let enemy = enemies.enemy[i];
            if (!enemy.diving && enemy.path.length === 0) {
                availableEnemies.push(enemy);
            }
        }
        if (availableEnemies.length > 1) {
            let a = getRandomInt(0, availableEnemies.length);
            let b = getRandomInt(0, availableEnemies.length);
            availableEnemies[a].path = getDivePath(availableEnemies[a]);
            availableEnemies[b].path = getDivePath(availableEnemies[b]);
            availableEnemies[a].fireTimer = 1000;
            availableEnemies[b].fireTimer = 1000;
            if (sound.diving.isReady && !attractMode) sound.diving.play();
        } else if (availableEnemies.length === 1) {
            availableEnemies[0].path = getDivePath(availableEnemies[0]);
            availableEnemies[0].fireTimer = 1000;
            if (sound.diving.isReady && !attractMode) sound.diving.play();
        }
        enemies.divingTimer = 3000;
    }
}

function updateTorpedos(elapsedTime, torpedos) {
    let canvas = document.getElementById('id-canvas');
    let speed  = elapsedTime / 800 * canvas.height;
    const seconds = elapsedTime / 1000;

    let removeFriendly = [];
    for (let i = 0; i < torpedos.friendly.length; i++) {
        let t = torpedos.friendly[i];
        t.velocityX = t.vx || 0;
        t.velocityY = -speed;
        t.center.x += t.velocityX * seconds;
        t.center.y += (t.vy === undefined ? -speed : t.vy * seconds);

        if (t.center.y < 0 || t.center.x < -40 || t.center.x > canvas.width + 40) removeFriendly.push(i);
    }
    for (let i = removeFriendly.length-1; i > -1; i--) {
        torpedos.friendly.splice(removeFriendly[i], 1);
    }

    let removeEnemy = [];
    for (let i = 0; i < torpedos.enemy.length; i++) {
        let t = torpedos.enemy[i];
        t.velocityX = t.xVel;
        t.velocityY = speed * 2 / 5;
        t.center.y += speed * 2 / 5;
        t.center.x += t.xVel;
        if (t.center.y > canvas.height) removeEnemy.push(i);
    }
    for (let i = removeEnemy.length-1; i > -1; i--) {
        torpedos.enemy.splice(removeEnemy[i], 1);
    }
}

const MAX_OVERDRIVE_MISSILES = 96;

function createHomingMissile(x, y, side, role) {
    return {
        center: { x, y },
        velocityX: side * 320,
        velocityY: 160,
        target: null,
        age: 0,
        damage: 3,
        trailTimer: 0,
        role,
        trailInterval: role === 'primary' ? 18 : 22
    };
}

function spawnOverdriveMissile(torpedos, side) {
    if (torpedos.missiles.length >= MAX_OVERDRIVE_MISSILES) return;
    const x = 600 + side * (80 + Math.random() * 400);
    const canvas = document.getElementById('id-canvas');
    torpedos.missiles.push(createHomingMissile(x, canvas.height - 120, side, 'overdrive'));
}

function spawnPrimaryHomingMissile(torpedos, fighter, side) {
    torpedos.primaryMissiles.push(createHomingMissile(
        fighter.center.x + side * 34,
        fighter.center.y - 6,
        side,
        'primary'
    ));
}

function updateOverdrive(elapsedTime, fighter, enemies, torpedos, stats) {
    if (stats.overdriveTimer <= 0 || fighter.dead || fighter.lives <= 0) return;
    stats.overdriveTimer = Math.max(0, stats.overdriveTimer - elapsedTime);
    stats.overdriveSpawnTimer -= elapsedTime;
    if (stats.overdriveSpawnTimer > 0) return;

    stats.overdriveSpawnTimer = 55;
    stats.overdriveSide *= -1;
    spawnOverdriveMissile(torpedos, stats.overdriveSide);
    if (Math.random() < 0.6) {
        spawnOverdriveMissile(torpedos, -stats.overdriveSide);
    }
}

function updateEvasiveManeuver(elapsedTime, fighter) {
    if (fighter.maneuverCooldown > 0) {
        fighter.maneuverCooldown = Math.max(0, fighter.maneuverCooldown - elapsedTime);
    }
    if (fighter.maneuverTimer <= 0) {
        fighter.maneuverRotation = 0;
        return;
    }

    fighter.maneuverTimer = Math.max(0, fighter.maneuverTimer - elapsedTime);
    const progress = 1 - fighter.maneuverTimer / fighter.maneuverDuration;
    const easedProgress = progress * progress * (3 - 2 * progress);
    fighter.maneuverRotation = fighter.maneuverDirection * Math.PI * 2 * easedProgress;
}

function activateLocalOverdrive(fighter, stats) {
    if (fighter.dead || fighter.lives <= 0 || stats.overdriveTimer > 0 ||
        stats.overdriveMeter < 100) return false;
    stats.overdriveMeter = 0;
    stats.overdriveTimer = 3200;
    stats.overdriveSpawnTimer = 0;
    stats.overdriveSide = 1;
    _nfxPopup('MISSILE OVERRIDE', fighter.center.x, fighter.center.y - 90);
    if (typeof NeonFX !== 'undefined') {
        NeonFX.flash = Math.max(NeonFX.flash, 0.24);
        NeonFX.screenShake = Math.max(NeonFX.screenShake, 8);
    }
    return true;
}

function updateHomingMissileGroup(elapsedTime, missiles, enemies, canvas) {
    const seconds = elapsedTime / 1000;
    for (let i = missiles.length - 1; i >= 0; i--) {
        const missile = missiles[i];
        missile.age += seconds;

        if (!missile.target || enemies.enemy.indexOf(missile.target) < 0 ||
            (missile.target.type === 'boss' && missile.target.life <= 0)) {
            let target = null;
            let bestDistance = Infinity;
            for (let j = 0; j < enemies.enemy.length; j++) {
                const candidate = enemies.enemy[j];
                const dx = candidate.center.x - missile.center.x;
                const dy = candidate.center.y - missile.center.y;
                const distance = dx * dx + dy * dy;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    target = candidate;
                }
            }
            missile.target = target;
        }

        let angle = Math.atan2(missile.velocityY, missile.velocityX);
        if (missile.age <= 0.12) {
            let delta = -Math.PI / 2 - angle;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            angle += Math.max(-12 * seconds, Math.min(12 * seconds, delta));
        } else if (missile.target) {
            let delta = Math.atan2(
                missile.target.center.y - missile.center.y,
                missile.target.center.x - missile.center.x
            ) - angle;
            while (delta > Math.PI) delta -= Math.PI * 2;
            while (delta < -Math.PI) delta += Math.PI * 2;
            angle += Math.max(-7.5 * seconds, Math.min(7.5 * seconds, delta));
        }

        const speed = Math.min(780, 320 + missile.age * 1500);
        missile.velocityX = Math.cos(angle) * speed;
        missile.velocityY = Math.sin(angle) * speed;
        missile.center.x += missile.velocityX * seconds;
        missile.center.y += missile.velocityY * seconds;

        missile.trailTimer -= elapsedTime;
        if (missile.trailTimer <= 0 && typeof NeonFX !== 'undefined' && NeonFX.particles.length < 480) {
            missile.trailTimer = missile.trailInterval;
            const mainCol = missile.role === 'primary' ? '#8ef0ff' : '#b26bff';
            const nozzleJitter = (Math.random() - 0.5) * 4;
            // Estela densa de humo balístico (Itano Circus smoke ribbon)
            NeonFX.particles.push({
                x: missile.center.x + nozzleJitter,
                y: missile.center.y,
                vx: -missile.velocityX * 0.022 + (Math.random() - 0.5) * 0.06,
                vy: -missile.velocityY * 0.022 + (Math.random() - 0.5) * 0.06,
                kind: 'engine', life: 220, maxLife: 220,
                color: mainCol,
                size: missile.role === 'primary' ? 9 : 8, rot: 0, vr: 0
            });
            // Núcleo incandescente de tobera (spark blanco/neón)
            NeonFX.particles.push({
                x: missile.center.x,
                y: missile.center.y,
                vx: -missile.velocityX * 0.04,
                vy: -missile.velocityY * 0.04,
                kind: 'spark', life: 90, maxLife: 90,
                color: Math.random() < 0.6 ? '#ffffff' : mainCol,
                size: 3.5, rot: 0, vr: 0
            });
            // Llamarada de escape pulsante
            if (Math.random() < 0.3) {
                NeonFX.particles.push({
                    x: missile.center.x,
                    y: missile.center.y,
                    vx: -missile.velocityX * 0.015,
                    vy: -missile.velocityY * 0.015,
                    kind: 'fire', life: 130, maxLife: 130,
                    color: mainCol,
                    size: 10 + Math.random() * 4, rot: 0, vr: 0
                });
            }
        }

        if (missile.center.y < -60 || missile.center.y > canvas.height + 80 ||
            missile.center.x < -80 || missile.center.x > canvas.width + 80 ||
            missile.age > 5) {
            missiles.splice(i, 1);
        }
    }
}

function updateMissiles(elapsedTime, torpedos, enemies) {
    const canvas = document.getElementById('id-canvas');
    updateHomingMissileGroup(elapsedTime, torpedos.missiles, enemies, canvas);
    updateHomingMissileGroup(elapsedTime, torpedos.primaryMissiles, enemies, canvas);
}

function spawnStageCommander(enemies, stats) {
    const stage = stats.stage;
    if (stage.currentStage % 3 !== 0 || stage.stageTime < 17000 ||
        stage.stageEnemies.length > 0 || enemies.enemy.length > 0 ||
        stage.bossEncounterSpawned) return;

    // TRIUNVIRATO DE JEFES AAA: Progresion rotativa cada ciclo de 3 stages
    const cycle = Math.floor(stage.currentStage / 3);
    const variantIdx = (cycle - 1) % 3;
    let variant = 'dreadnought';
    let name = 'AEGIS DREADNOUGHT // GOLIATH-01';
    let baseCoreLife = 70 + cycle * 15;
    let wingLife = 28 + cycle * 5;

    if (variantIdx === 1) {
        variant = 'hornet';
        name = 'CYBER-HORNET // HIVE QUEEN-IX';
        baseCoreLife = 60 + cycle * 15;
        wingLife = 24 + cycle * 5;
    } else if (variantIdx === 2) {
        variant = 'seraph';
        name = 'VOID SERAPH // PHANTOM MONARCH';
        baseCoreLife = 75 + cycle * 15;
        wingLife = 30 + cycle * 5;
    }

    const commander = {
        type: 'boss',
        variant: variant,
        name: name,
        center: { x: 600, y: -180 },
        path: [[600, 230]],
        formationLocation: [600, 230],
        diving: false,
        commander: true,
        // Dimensiones aumentadas un +20% (312x216 px)
        size: { width: 312, height: 216 },
        // Multi-Part HP independiente
        coreHp: baseCoreLife,
        coreMaxHp: baseCoreLife,
        leftWingHp: wingLife,
        leftWingMaxHp: wingLife,
        rightWingHp: wingLife,
        rightWingMaxHp: wingLife,
        // Legacy life mirror para compatibilidad
        get life() { return this.coreHp; },
        set life(val) { this.coreHp = val; },
        maxLife: baseCoreLife,
        attackTimer: 1000,
        fireTimer: 0,
        enraged: false,
        smokeTimer: 0,
        currentSprite: 0,
        spriteCount: 0
    };
    enemies.enemy.push(commander);
    stage.bossEncounterSpawned = true;
    _nfxPopup(name, 600, 190);
    if (typeof NeonFX !== 'undefined') {
        NeonFX.screenShake = Math.max(NeonFX.screenShake, 20);
        NeonFX.flash = Math.max(NeonFX.flash, 0.45);
    }
}

function updateCommander(elapsedTime, commander, fighter, torpedos, stats) {
    if (commander.path.length > 0 || commander.coreHp <= 0) return;

    // Estado de furia (Enrage): si ambos módulos alares están destruidos
    const enraged = commander.leftWingHp <= 0 && commander.rightWingHp <= 0;
    commander.enraged = enraged;

    // ── PATRONES DE MOVIMIENTO POR VARIANTE (+20% ESCALA) ──────────────
    if (commander.variant === 'hornet') {
        // CYBER-HORNET: Maniobra depredadora de alta frecuencia (quiebres y zigzags)
        const speed = enraged ? 310 : 390;
        const subSpeed = enraged ? 155 : 195;
        commander.center.x = 600 + Math.sin(stats.currentTime / speed) * 410 + Math.sin(stats.currentTime / subSpeed) * 75;
        commander.center.y = 215 + Math.cos(stats.currentTime / 320) * 38;
    } else if (commander.variant === 'seraph') {
        // VOID SERAPH: Danza gravitacional hipnotica en forma de 8
        const sweepSpeed = enraged ? 500 : 640;
        commander.center.x = 600 + Math.sin(stats.currentTime / sweepSpeed) * 400;
        commander.center.y = 225 + Math.sin(stats.currentTime / (sweepSpeed / 2)) * 42;
    } else {
        // AEGIS DREADNOUGHT: Barrido pesado acorazado
        const strafeSpeed = enraged ? 660 : 890;
        const strafeWidth = enraged ? 410 : 360;
        commander.center.x = 600 + Math.sin(stats.currentTime / strafeSpeed) * strafeWidth;
        commander.center.y = 230 + Math.cos(stats.currentTime / 540) * 26;
    }

    // Limites de pantalla de combate (canvas w=1200)
    commander.center.x = Math.max(170, Math.min(1030, commander.center.x));

    // Emisión continua de humo y chispas de daño en alas destruidas (offset ±102 px)
    commander.smokeTimer = (commander.smokeTimer || 0) - elapsedTime;
    if (commander.smokeTimer <= 0 && typeof NeonFX !== 'undefined') {
        commander.smokeTimer = 55;
        const sparkCol = commander.variant === 'hornet' ? '#FFB300' : commander.variant === 'seraph' ? '#FF2D78' : NeonFX.COL.rojo;
        if (commander.leftWingHp <= 0) {
            NeonFX.particles.push({
                x: commander.center.x - 102 + (Math.random() - 0.5) * 18,
                y: commander.center.y + 18 + (Math.random() - 0.5) * 14,
                vx: -0.12 + (Math.random() - 0.5) * 0.1,
                vy: 0.16 + Math.random() * 0.16,
                kind: 'smoke', life: 260, maxLife: 260,
                color: 'rgba(50,50,55,0.7)',
                size: 9 + Math.random() * 7, rot: 0, vr: 0
            });
            if (Math.random() < 0.38) {
                NeonFX.particles.push({
                    x: commander.center.x - 102, y: commander.center.y + 18,
                    vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
                    kind: 'spark', life: 130, maxLife: 130,
                    color: sparkCol, size: 3.5, rot: 0, vr: 0
                });
            }
        }
        if (commander.rightWingHp <= 0) {
            NeonFX.particles.push({
                x: commander.center.x + 102 + (Math.random() - 0.5) * 18,
                y: commander.center.y + 18 + (Math.random() - 0.5) * 14,
                vx: 0.12 + (Math.random() - 0.5) * 0.1,
                vy: 0.16 + Math.random() * 0.16,
                kind: 'smoke', life: 260, maxLife: 260,
                color: 'rgba(50,50,55,0.7)',
                size: 9 + Math.random() * 7, rot: 0, vr: 0
            });
            if (Math.random() < 0.38) {
                NeonFX.particles.push({
                    x: commander.center.x + 102, y: commander.center.y + 18,
                    vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
                    kind: 'spark', life: 130, maxLife: 130,
                    color: sparkCol, size: 3.5, rot: 0, vr: 0
                });
            }
        }
    }

    commander.attackTimer -= elapsedTime;
    if (commander.attackTimer > 0 || torpedos.enemy.length >= 64) return;

    // ── CADENCIA Y PATRONES BALISTICOS DE ATAQUE ───────────────────────
    const baseInterval = enraged ? 580 : Math.max(750, 1300 - stats.stage.currentStage * 25);
    commander.attackTimer = baseInterval;

    const dx = fighter.center.x - commander.center.x;
    const dy = fighter.center.y - commander.center.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const aimX = dx / dist;

    if (commander.variant === 'hornet') {
        // BALISTICA CYBER-HORNET: Agujas sónicas + aguijón bio-eléctrico
        if (commander.leftWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x - 102, y: commander.center.y + 35 },
                xVel: aimX * 1.5 - 0.6
            });
        }
        if (commander.rightWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x + 102, y: commander.center.y + 35 },
                xVel: aimX * 1.5 + 0.6
            });
        }
        if (enraged) {
            // Ráfaga frenética de aguijones en abanico quíntuple
            for (let i = -2; i <= 2; i++) {
                torpedos.enemy.push({
                    center: { x: commander.center.x, y: commander.center.y + 55 },
                    xVel: i * 1.6 + aimX * 0.8
                });
            }
        } else {
            // Disparo gemelo directo del aguijón central
            torpedos.enemy.push({
                center: { x: commander.center.x - 14, y: commander.center.y + 55 },
                xVel: aimX * 1.2
            });
            torpedos.enemy.push({
                center: { x: commander.center.x + 14, y: commander.center.y + 55 },
                xVel: aimX * 1.2
            });
        }
    } else if (commander.variant === 'seraph') {
        // BALISTICA VOID SERAPH: Rayos de refracción prismática
        if (commander.leftWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x - 102, y: commander.center.y + 40 },
                xVel: -1.4 + (Math.random() - 0.5) * 0.4
            });
            torpedos.enemy.push({
                center: { x: commander.center.x - 76, y: commander.center.y + 45 },
                xVel: -0.5
            });
        }
        if (commander.rightWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x + 102, y: commander.center.y + 40 },
                xVel: 1.4 + (Math.random() - 0.5) * 0.4
            });
            torpedos.enemy.push({
                center: { x: commander.center.x + 76, y: commander.center.y + 45 },
                xVel: 0.5
            });
        }
        if (enraged) {
            // Nova cósmica psiónica séptuple
            for (let i = -3; i <= 3; i++) {
                torpedos.enemy.push({
                    center: { x: commander.center.x, y: commander.center.y + 50 },
                    xVel: i * 1.3
                });
            }
        } else {
            torpedos.enemy.push({
                center: { x: commander.center.x, y: commander.center.y + 50 },
                xVel: aimX * 1.4
            });
        }
    } else {
        // BALISTICA AEGIS DREADNOUGHT: Fuego pesado de artillería de plasma
        if (commander.leftWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x - 102, y: commander.center.y + 40 },
                xVel: -1.3 + (Math.random() - 0.5) * 0.6
            });
            torpedos.enemy.push({
                center: { x: commander.center.x - 80, y: commander.center.y + 45 },
                xVel: -0.4 + (Math.random() - 0.5) * 0.4
            });
        }
        if (commander.rightWingHp > 0) {
            torpedos.enemy.push({
                center: { x: commander.center.x + 102, y: commander.center.y + 40 },
                xVel: 1.3 + (Math.random() - 0.5) * 0.6
            });
            torpedos.enemy.push({
                center: { x: commander.center.x + 80, y: commander.center.y + 45 },
                xVel: 0.4 + (Math.random() - 0.5) * 0.4
            });
        }
        if (enraged) {
            // Enrage Overheat: ráfaga en abanico quíntuple
            for (let i = -2; i <= 2; i++) {
                torpedos.enemy.push({
                    center: { x: commander.center.x, y: commander.center.y + 50 },
                    xVel: i * 1.5 + (Math.random() - 0.5) * 0.3
                });
            }
        } else {
            // Fuego pesado dirigido hacia el caza
            for (let i = -1; i <= 1; i += 2) {
                torpedos.enemy.push({
                    center: { x: commander.center.x + i * 16, y: commander.center.y + 50 },
                    xVel: (aimX >= 0 ? 1 : -1) * 1.1 + i * 0.7
                });
            }
        }
    }
}

const MAX_POWERUPS = 12;

function dropPowerup(powerups, fighter, x, y, guaranteed) {
    if (powerups.items.length >= MAX_POWERUPS) return;
    let kind;
    if (guaranteed) {
        kind = fighter.weaponTier >= 5 ? 'S' : 'W';
    } else {
        const roll = Math.random();
        kind = roll < 0.42 ? 'W' : roll < 0.68 ? 'S' : roll < 0.78 ? 'M' : 'B';
    }
    powerups.items.push({ x, y, kind, age: 0, vy: 170 });
}

function collectPowerup(powerup, fighter, torpedos, enemies, stats, particles, sound, powerups) {
    switch (powerup.kind) {
        case 'W':
            if (fighter.weaponTier < 5) {
                fighter.weaponTier++;
                _nfxPopup('WEAPON UP  LV' + fighter.weaponTier, fighter.center.x, fighter.center.y - 70);
            } else {
                stats.score += 1000;
                _nfxPopup('+1000', fighter.center.x, fighter.center.y - 70);
            }
            break;
        case 'S':
            if (fighter.shieldCharges < 2) {
                fighter.shieldCharges++;
                _nfxPopup('SHIELD +1', fighter.center.x, fighter.center.y - 70);
            } else {
                stats.score += 800;
                _nfxPopup('+800', fighter.center.x, fighter.center.y - 70);
            }
            break;
        case 'M':
            if (fighter.lives < 6) {
                fighter.lives++;
                _nfxPopup('1UP!', fighter.center.x, fighter.center.y - 70);
            } else {
                stats.score += 2000;
                _nfxPopup('+2000', fighter.center.x, fighter.center.y - 70);
            }
            break;
        case 'B':
            torpedos.enemy.length = 0;
            for (let i = enemies.enemy.length - 1; i >= 0; i--) {
                if (damageSpriteEnemy(enemies.enemy[i], 3, stats, particles, sound, enemies, powerups, fighter,
                    enemies.enemy[i].center.x, enemies.enemy[i].center.y)) {
                    enemies.enemy.splice(i, 1);
                }
            }
            if (typeof NeonFX !== 'undefined') {
                NeonFX.shockwaves.push({
                    x: fighter.center.x, y: fighter.center.y, r: 10, maxR: 320,
                    life: 520, maxLife: 520, color: '#b26bff', kind: 'pulse-bomb'
                });
                NeonFX.screenShake = Math.max(NeonFX.screenShake, 12);
            }
            _nfxPopup('PULSE BOMB', fighter.center.x, fighter.center.y - 70);
            break;
    }
    if (typeof NeonFX !== 'undefined') NeonFX.spawnHitSpark(fighter.center.x, fighter.center.y, '#b26bff');
}

function updatePowerups(elapsedTime, powerups, fighter, torpedos, enemies, stats, particles, sound) {
    const seconds = elapsedTime / 1000;
    for (let i = powerups.items.length - 1; i >= 0; i--) {
        const item = powerups.items[i];
        item.age += seconds;
        item.y += item.vy * seconds;
        item.x += Math.sin(item.age * 3) * 46 * seconds;

        if (!fighter.dead && fighter.lives > 0) {
            let dx = fighter.center.x - item.x;
            let dy = fighter.center.y - item.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < 130 * 130) {
                const pull = Math.min(1, seconds * 6);
                item.x += dx * pull;
                item.y += dy * pull;
                dx = fighter.center.x - item.x;
                dy = fighter.center.y - item.y;
            }
            if (Math.abs(dx) < fighter.size.width / 2 + 22 &&
                Math.abs(dy) < fighter.size.height / 2 + 22) {
                collectPowerup(item, fighter, torpedos, enemies, stats, particles, sound, powerups);
                powerups.items.splice(i, 1);
                continue;
            }
        }

        // Aura ionica sutil mientras la capsula desciende
        item.sparkTimer = (item.sparkTimer || 0) - elapsedTime;
        if (item.sparkTimer <= 0 && typeof NeonFX !== 'undefined' && NeonFX.particles.length < 480) {
            item.sparkTimer = 90;
            const itemCols = { W: '#00FF41', S: '#00BCFF', M: '#FFD700', B: '#b26bff' };
            NeonFX.particles.push({
                x: item.x + (Math.random() - 0.5) * 14,
                y: item.y + (Math.random() - 0.5) * 14,
                vx: (Math.random() - 0.5) * 0.08,
                vy: (Math.random() - 0.5) * 0.08,
                kind: 'spark', life: 140, maxLife: 140,
                color: itemCols[item.kind] || '#00BCFF',
                size: 2.5 + Math.random() * 2, rot: 0, vr: 0
            });
        }

        if (item.y > 1660 || item.age > 12) powerups.items.splice(i, 1);
    }
}

function fireEnemyTorpedo(enemy, torpedos, fighter, elapsedTime) {
    let canvas = document.getElementById("id-canvas");
    let xVel = (fighter.center.x < enemy.center.x ? -1 : 1) * elapsedTime / 800 / 15 * canvas.height;
    torpedos.enemy.push({ center: { x: enemy.center.x, y: enemy.center.y }, xVel: xVel });
}

function fireTorpedo(fighter, torpedos, stats, sound) {
    if (fighter.dead) return;

    let fired = false;
    if (torpedos.noLimit || torpedos.friendly.length < 2) {
        const tier = fighter.weaponTier || 1;
        // BALISTICA SIMETRICA CORREGIDA: cada ala tiene velocidades horizontales inversas (+/-)
        // y el Tier 3 cuenta con abanico tridente equilibrado.
        const shots = tier === 1 ? [[0, 0]]
            : tier === 2 ? [[-16, 0], [16, 0]]
            : tier === 3 ? [[0, 0], [-18, -130], [18, 130]]
            : tier === 4 ? [[0, 0], [-16, -110], [16, 110], [-34, -260], [34, 260]]
            : [[0, 0], [-18, -140], [18, 140], [-38, -320], [38, 320]];
        for (let i = 0; i < shots.length; i++) {
            torpedos.friendly.push({
                center: { x: fighter.center.x + shots[i][0], y: fighter.center.y },
                vx: shots[i][1]
            });
        }
        stats.stage.torpedosFired += shots.length;
        fired = true;
    }

    if (fighter.weaponTier >= 5 && stats.currentTime >= stats.primaryMissileNextShotAt) {
        stats.primaryMissileSide *= -1;
        spawnPrimaryHomingMissile(torpedos, fighter, stats.primaryMissileSide);
        stats.primaryMissileNextShotAt = Math.max(
            stats.currentTime + 500,
            stats.primaryMissileNextShotAt + 500
        );
        stats.stage.torpedosFired++;
        fired = true;
    }

    if (fired) {
        if (sound.fireTorpedo[sound.fireTorpedoQueue].isReady && !attractMode) {
            sound.fireTorpedo[sound.fireTorpedoQueue].play();
            sound.fireTorpedoQueue++;
            if (sound.fireTorpedoQueue > 9) sound.fireTorpedoQueue = 0;
        }
    }
}

function moveFighterLeft(fighter, value) {
    fighter.center.x -= 12 * value;
    if (fighter.center.x < fighter.size.width / 2)
        fighter.center.x = fighter.size.width / 2;
}

function moveFighterRight(fighter, value) {
    let canvas = document.getElementById('id-canvas');
    fighter.center.x += 12 * value;
    if (fighter.center.x + fighter.size.width / 2 > canvas.width)
        fighter.center.x = canvas.width - fighter.size.width / 2;
}

function checkCollisions(torpedos, fighter, enemies, stats, particles, sound, powerups) {
    // Durante ATOMIC IMMUNITY el fighter es intocable
    if (fighter.atomicImmune && fighter.atomicImmune > 0) {
        checkEnemyCollision(torpedos, enemies, stats, particles, sound, powerups, fighter);
        return;
    }
    if (fighter.invulnerableTimer <= 0 && !fighter.dead) {
        checkFighterCollision(torpedos, fighter, enemies, particles, sound);
    }
    checkEnemyCollision(torpedos, enemies, stats, particles, sound, powerups, fighter);
}

function checkFighterCollision(torpedos, fighter, enemies, particles, sound) {
    let enemyTorpedos = torpedos.enemy;
    let removeTorpedo = [];

    // Torpedo enemigo vs fighter
    for (let i = 0; i < enemyTorpedos.length; i++) {
        let t = enemyTorpedos[i];
        let f = fighter;
        if (t.center.x < f.center.x + f.size.width/2  &&
            t.center.x > f.center.x - f.size.width/2  &&
            t.center.y + torpedos.size.height/2 < f.center.y + f.size.height/2 &&
            t.center.y + torpedos.size.height/2 > f.center.y - f.size.height/2 + 20) {
            removeTorpedo.push(i);
            if (!absorbShieldHit(fighter)) {
                createPlayerDeathParticles(fighter, particles);
                _nfxExplosion(fighter.center.x, fighter.center.y, 'player');
                loseLife(fighter);
                if (sound.playerDeath.isReady && !attractMode) sound.playerDeath.play();
            }
            break;
        }
    }
    for (let i = removeTorpedo.length-1; i > -1; i--) {
        enemyTorpedos.splice(removeTorpedo[i], 1);
    }

    // Cuerpo de enemigo en picada vs fighter
    let removeEnemy = [];
    for (let i = 0; i < enemies.enemy.length; i++) {
        let e = enemies.enemy[i];
        if (e.center.x < fighter.center.x + fighter.size.width/2  + 20 &&
            e.center.x > fighter.center.x - fighter.size.width/2  - 20 &&
            e.center.y < fighter.center.y + fighter.size.height/2 + 30 &&
            e.center.y > fighter.center.y - fighter.size.height/2) {
            if (absorbShieldHit(fighter)) break;
            createPlayerDeathParticles(fighter, particles);
            loseLife(fighter);
            _nfxExplosion(fighter.center.x, fighter.center.y, 'player');
            if (!e.commander) {
                createEnemyDeathParticles(particles, enemies, e);
                removeEnemy.push(i);
            }
            if (sound.playerDeath.isReady && !attractMode) sound.playerDeath.play();
            break;
        }
    }
    for (let i = removeEnemy.length-1; i > -1; i--) {
        _nfxClearEnemyDamageState(enemies.enemy[removeEnemy[i]]);
        enemies.enemy.splice(removeEnemy[i], 1);
    }
}

function checkEnemyCollision(torpedos, enemies, stats, particles, sound, powerups, fighter) {
    let friendlyTorpedos = torpedos.friendly;
    let removeTorpedo    = [];
    let removeEnemy      = [];

    for (let i = 0; i < friendlyTorpedos.length; i++) {
        let t = friendlyTorpedos[i];
        for (let j = 0; j < enemies.enemy.length; j++) {
            let e = enemies.enemy[j];
            // Bounding box expandido para el acorazado Sector Commander (312x216)
            const eW = e.commander ? 312 : enemies[e.type].size.width;
            const eH = e.commander ? 216 : enemies[e.type].size.height;
            if (t.center.x < e.center.x + eW / 2 + 6 &&
                t.center.x > e.center.x - eW / 2 - 6 &&
                t.center.y - torpedos.size.height/2 < e.center.y + eH / 2 &&
                t.center.y - torpedos.size.height/2 > e.center.y - eH / 2) {

                if (!removeTorpedo.includes(i)) removeTorpedo.push(i);

                if (!removeEnemy.includes(j) &&
                    damageSpriteEnemy(e, 1, stats, particles, sound, enemies, powerups, fighter,
                        t.center.x, t.center.y - torpedos.size.height / 2)) {
                    removeEnemy.push(j);
                }
                stats.stage.hits++;
            }
        }
    }

    checkHomingMissileCollisions(torpedos.missiles, enemies, stats, particles, sound,
        powerups, fighter, removeEnemy);
    checkHomingMissileCollisions(torpedos.primaryMissiles, enemies, stats, particles, sound,
        powerups, fighter, removeEnemy);

    for (let i = removeTorpedo.length-1; i > -1; i--) {
        friendlyTorpedos.splice(removeTorpedo[i], 1);
    }
    for (let i = removeEnemy.length-1; i > -1; i--) {
        _nfxClearEnemyDamageState(enemies.enemy[removeEnemy[i]]);
        enemies.enemy.splice(removeEnemy[i], 1);
    }
}

function damageSpriteEnemy(enemy, damage, stats, particles, sound, enemies, powerups, fighter, hitX, hitY) {
    // ══════════════════════════════════════════════════════════════════════════
    // SISTEMA DE DAÑO MULTI-MODULO & PUNTOS DEBILES: SECTOR COMMANDER (+20% ESCALA)
    // ══════════════════════════════════════════════════════════════════════════
    if (enemy.commander) {
        const relX = hitX - enemy.center.x;
        const relY = hitY - enemy.center.y;
        const isHornet = enemy.variant === 'hornet';
        const isSeraph = enemy.variant === 'seraph';
        const wingCol = isHornet ? '#FFB300' : isSeraph ? '#FF2D78' : '#00BCFF';
        const lWingName = isHornet ? 'L-SONIC WING' : isSeraph ? 'L-PRISM WING' : 'L-TURRET';
        const rWingName = isHornet ? 'R-SONIC WING' : isSeraph ? 'R-PRISM WING' : 'R-TURRET';

        // ── A. IMPACTO EN ALA / MODULO IZQUIERDO (relX < -46) ──
        if (relX < -46) {
            if (enemy.leftWingHp > 0) {
                enemy.leftWingHp = Math.max(0, enemy.leftWingHp - damage);
                _nfxHitSpark(hitX, hitY, wingCol);
                if (sound.bossHurt.isReady && !attractMode) sound.bossHurt.play();
                if (enemy.leftWingHp === 0) {
                    _nfxExplosion(enemy.center.x - 102, enemy.center.y + 20, 'boss');
                    _nfxPopup(`${lWingName} DESTROYED! +2500`, enemy.center.x - 102, enemy.center.y - 45);
                    stats.score += 2500;
                    if (typeof NeonFX !== 'undefined') {
                        NeonFX.screenShake = Math.max(NeonFX.screenShake, 16);
                        NeonFX.flash = Math.max(NeonFX.flash, 0.3);
                    }
                } else {
                    _nfxPopup('-' + damage, hitX, hitY - 20);
                }
                return false;
            } else {
                // Ala ya destruida: penetración de blindaje residual (chip damage 40%) al nucleo
                damage = Math.max(1, Math.round(damage * 0.4));
                _nfxHitSpark(hitX, hitY, '#778899');
            }
        }
        // ── B. IMPACTO EN ALA / MODULO DERECHO (relX > 46) ──
        else if (relX > 46) {
            if (enemy.rightWingHp > 0) {
                enemy.rightWingHp = Math.max(0, enemy.rightWingHp - damage);
                _nfxHitSpark(hitX, hitY, wingCol);
                if (sound.bossHurt.isReady && !attractMode) sound.bossHurt.play();
                if (enemy.rightWingHp === 0) {
                    _nfxExplosion(enemy.center.x + 102, enemy.center.y + 20, 'boss');
                    _nfxPopup(`${rWingName} DESTROYED! +2500`, enemy.center.x + 102, enemy.center.y - 45);
                    stats.score += 2500;
                    if (typeof NeonFX !== 'undefined') {
                        NeonFX.screenShake = Math.max(NeonFX.screenShake, 16);
                        NeonFX.flash = Math.max(NeonFX.flash, 0.3);
                    }
                } else {
                    _nfxPopup('-' + damage, hitX, hitY - 20);
                }
                return false;
            } else {
                // Ala ya destruida: chip damage al nucleo
                damage = Math.max(1, Math.round(damage * 0.4));
                _nfxHitSpark(hitX, hitY, '#778899');
            }
        }
        // ── C. IMPACTO DIRECTO EN REACTOR / NUCLEO CENTRAL (PUNTO DEBIL, |relX| <= 46) ──
        else {
            const isShielded = enemy.leftWingHp > 0 || enemy.rightWingHp > 0;
            if (isShielded) {
                // Escudo deflector activo mientras al menos una ala esté viva
                const finalDamage = Math.max(1, Math.round(damage * 1.5));
                enemy.coreHp = Math.max(0, enemy.coreHp - finalDamage);
                _nfxHitSpark(hitX, hitY, '#FFD700');
                _nfxPopup('CORE HIT! -' + finalDamage, hitX, hitY - 25);
            } else {
                // NUCLEO TOTALMENTE EXPUESTO: ¡GOLPE CRITICO MASIVO AAA (x2.5)!
                const critDamage = Math.max(2, Math.round(damage * 2.5));
                enemy.coreHp = Math.max(0, enemy.coreHp - critDamage);
                _nfxHitSpark(hitX, hitY, '#FFD700');
                _nfxPopup('CRITICAL HIT! -' + critDamage, hitX, hitY - 32);
                if (typeof NeonFX !== 'undefined') {
                    NeonFX.screenShake = Math.max(NeonFX.screenShake, 14);
                }
            }

            if (sound.bossHurt.isReady && !attractMode) sound.bossHurt.play();
            if (enemy.coreHp > 0) return false;
        }

        // Si el Core llega a 0 -> ¡DESTRUCCIÓN TOTAL DEL COMMANDER EN CASCADA!
        if (enemy.coreHp <= 0) {
            _nfxClearEnemyDamageState(enemy);
            addScore(stats, enemy);
            // Cascada de explosiones masivas en el comandante escalado (±102 px)
            _nfxExplosion(enemy.center.x, enemy.center.y, 'boss');
            _nfxExplosion(enemy.center.x - 102, enemy.center.y + 18, 'boss');
            _nfxExplosion(enemy.center.x + 102, enemy.center.y + 18, 'boss');
            if (typeof NeonFX !== 'undefined') {
                const shockColor = isHornet ? '#FFB300' : isSeraph ? '#FF2D78' : '#FFD700';
                NeonFX.shockwaves.push({
                    x: enemy.center.x, y: enemy.center.y, r: 18, maxR: 460,
                    life: 750, maxLife: 750, color: shockColor, kind: 'boss-death'
                });
                NeonFX.screenShake = 40;
                NeonFX.flash = 0.9;
            }
            const clearTitle = isHornet ? 'HIVE PURGED! +15000' : isSeraph ? 'VOID BANISHED! +15000' : 'SECTOR CLEARED! +15000';
            _nfxPopup(clearTitle, enemy.center.x, enemy.center.y - 65);
            stats.score += 15000 + stats.stage.currentStage * 2000;
            dropPowerup(powerups, fighter, enemy.center.x, enemy.center.y, true);
            if (sound.bossDeath.isReady && !attractMode) sound.bossDeath.play();
            return true;
        }
        return false;
    }

    // Comportamiento estandar para jefes normales de oleada
    if (enemy.type === 'boss') {
        const totalLife = enemy.maxLife || 2;
        enemy.life = Math.max(0, enemy.life - damage);
        if (enemy.life > 0) {
            _nfxEnemyDamageState(enemy, enemy.life, totalLife);
            _nfxHitSpark(hitX, hitY, NeonFX.COL.rojo);
            NeonFX.screenShake = Math.max(NeonFX.screenShake, 6);
            if (sound.bossHurt.isReady && !attractMode) sound.bossHurt.play();
            return false;
        }
    }

    _nfxClearEnemyDamageState(enemy);
    addScore(stats, enemy);
    createEnemyDeathParticles(particles, enemies, enemy);
    _nfxExplosion(enemy.center.x, enemy.center.y, enemy.type);
    _nfxPopup('+' + _getEnemyScore(enemy), enemy.center.x, enemy.center.y - 30);
    _nfxLightPool(enemy.center.x, enemy.center.y,
        Math.max(enemies[enemy.type].size.width, enemies[enemy.type].size.height) * 0.75, enemy.type);

    if (stats.overdriveTimer <= 0) {
        const previous = stats.overdriveMeter;
        const gain = enemy.type === 'boss' ? 5 : 2.5;
        stats.overdriveMeter = Math.min(100, previous + gain);
        if (previous < 100 && stats.overdriveMeter >= 100) {
            _nfxPopup('OVERDRIVE READY  [E]', 600, 1450);
        }
    }

    if (enemy.type === 'butterfly' && Math.random() < 0.22) {
        dropPowerup(powerups, fighter, enemy.center.x, enemy.center.y, false);
    } else if (enemy.type === 'boss' && Math.random() < 0.22) {
        dropPowerup(powerups, fighter, enemy.center.x, enemy.center.y, false);
    }

    if (enemy.type === 'boss' && sound.bossDeath.isReady && !attractMode) {
        sound.bossDeath.play();
    } else if (sound.enemyDeath.isReady && !attractMode) {
        sound.enemyDeath.play();
    }
    return true;
}

function absorbShieldHit(fighter) {
    if (fighter.shieldCharges <= 0) return false;
    fighter.shieldCharges--;
    fighter.invulnerableTimer = Math.max(fighter.invulnerableTimer, 900);
    _nfxPopup('SHIELD BREAK', fighter.center.x, fighter.center.y - 70);
    _nfxHitSpark(fighter.center.x, fighter.center.y, NeonFX.COL.primario);
    return true;
}

function loseLife(fighter) {
    fighter.lives--;
    fighter.dead = true;
    fighter.deadTimer = 2000;
}

function addScore(stats, enemy) {
    if (enemy.type === "bee" && !enemy.diving) {
        stats.score += 50;
    } else if (enemy.type === "bee" && enemy.diving) {
        stats.score += 100;
    } else if (enemy.type === "butterfly" && !enemy.diving) {
        stats.score += 80;
    } else if (enemy.type === "butterfly" && enemy.diving) {
        stats.score += 160;
    } else if (enemy.type === "bonus1" || enemy.type === "bonus2" || enemy.type === "bonus3") {
        stats.score += 100;
    } else if (enemy.type === "boss" && !enemy.diving) {
        stats.score += enemy.commander ? 5000 + stats.stage.currentStage * 1000 : 150;
    } else if (enemy.type === "boss" && enemy.diving) {
        stats.score += enemy.commander ? 5000 + stats.stage.currentStage * 1000 : 400;
    }
}

function checkEndStage(enemies, stats, fighter, elapsedTime, sound) {
    if (fighter.lives === 0 && fighter.deadTimer <= 0 && !stats.showPlayerResults) {
        stats.totalTorpedosFired += stats.stage.torpedosFired;
        stats.totalHits          += stats.stage.hits;
        stats.showPlayerResults   = true;
    } else if (stats.stage.stageEnemies.length === 0 && enemies.enemy.length === 0 && fighter.lives > 0) {
        if (!stats.stage.endStage) {
            if (stats.stage.currentStage % 4 === 3) {
                stats.stage.endStageTimer = 2000;
                stats.showPlayerStats     = true;
            } else {
                stats.stage.endStageTimer = 500;
            }
            stats.totalTorpedosFired += stats.stage.torpedosFired;
            stats.totalHits          += stats.stage.hits;
            stats.stage.endStage      = true;
        } else {
            stats.stage.endStageTimer -= elapsedTime;
            if (stats.stage.endStageTimer < 0) {
                stats.showPlayerStats              = false;
                stats.stage.endStage               = false;
                stats.stage.currentStage           += 1;
                stats.stage.showStageTimer         = 2000;
                stats.stage.torpedosFired          = 0;
                stats.stage.hits                   = 0;
                stats.stage.stageTime              = 0;
                stats.stage.stageEnemies           = getStage(stats.stage.currentStage);
                stats.stage.bossEncounterSpawned   = false;
                enemies.divingTimer                = 15000;
                enemies.formationSpriteCount       = 500;
                enemies.formationLeftRight         = 4;
                enemies.formationOffsetX           = 0;
                enemies.formationOffsetBreath      = 1;
                enemies.formationBreathOut         = true;
                if (sound.levelStart.isReady && !attractMode) sound.levelStart.play();
            }
        }
    } else if (stats.stage.currentStage % 4 === 3 && stats.stage.stageTime > 17000 &&
        !stats.stage.bossEncounterSpawned) {
        enemies.enemy = [];
    }
}

function updateAI(elapsedTime, ai, fighter, enemies, torpedos, stats, sound) {
    let moveSpeed = elapsedTime / 2;
    ai.fireTimer -= elapsedTime;
    if (ai.fireTimer < 0 && enemies.enemy.length !== 0) {
        ai.fireTimer = 200;
        fireTorpedo(fighter, torpedos, stats, sound);
    }
    if (enemies.enemy.length !== 0) {
        let e = enemies.enemy[0];
        if      (e.center.x < fighter.center.x) fighter.center.x -= moveSpeed;
        else if (e.center.x > fighter.center.x) fighter.center.x += moveSpeed;
    }
}

function mobileSupport(fighter, torpedos, stats, sound) {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        document.getElementById("game").style.height  = "130vw";
        document.getElementById("game").style.width   = "98vw";
        document.getElementById("game").style.margin  = "4vh 0 4vh 0";
        let mobileControls = document.getElementById("mobile-controls");
        mobileControls.style.visibility = "visible";
        let slider = document.getElementById("mobile-movement");
        let start;
        slider.addEventListener("touchstart", function(event) {
            start = event.touches[0].clientX;
        });
        slider.addEventListener("touchmove", function(event) {
            let current = event.touches[0].clientX;
            let delta   = current - start;
            let value   = parseInt(slider.value) + delta;
            if (value < slider.min)       value = slider.min;
            else if (value > slider.max)  value = slider.max;
            slider.value = value;
            start = current;
        });
        slider.addEventListener("input", function() {
            fighter.mobileMoveVal = slider.value;
        });
        slider.addEventListener("touchend", function() {
            slider.value = 50;
            fighter.mobileMoveVal = 50;
        });
        let fireButton = document.getElementById("mobile-fire");
        fireButton.addEventListener("touchstart", function() {
            if (stats.currentTime > 0) fireTorpedo(fighter, torpedos, stats, sound);
        });
    }
}

function updateFighterMobile(elapsedTime, fighter) {
    if      (fighter.mobileMoveVal < 50) moveFighterLeft (fighter, (1 - (fighter.mobileMoveVal / 50)) * elapsedTime / 6);
    else if (fighter.mobileMoveVal > 50) moveFighterRight(fighter, ((fighter.mobileMoveVal - 50) / 50) * elapsedTime / 6);
}
