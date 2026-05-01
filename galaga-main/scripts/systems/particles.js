'use strict';

// =============================================================================
// SISTEMA DE PARTÍCULAS Y FX MASIVOS - Update v2.0
// Conserva compatibilidad con el sistema original (imgSmoke, imgFire1, etc.)
// y añade: shockwaves, sparks, debris, popups, screen shake, flash, slow-mo.
// =============================================================================

// Estado global de FX (accesible desde gameplay.js y render.js)
let MyGameFX = {
    shockwaves: [],
    popups: [],
    shake: 0,
    flash: 0,
    slowmo: 0
};

// ---- Helpers de creación ----------------------------------------------------

function makeFXParticle(x, y, vx, vy, kind, life, color, size) {
    return {
        center: { x: x, y: y },
        velocity: { x: vx, y: vy },
        kind: kind,            // 'spark' | 'smokeFX' | 'fireFX' | 'debris' | 'engine'
        life: life,
        maxLife: life,
        color: color,
        size: size,
        rotation: Math.random() * Math.PI * 2,
        rotationVel: (Math.random() - 0.5) * 0.02,
        image: null            // los FX procedurales no usan imagen
    };
}

// ---- Hit spark al impactar enemigo (sin matarlo) ----------------------------

function createHitSpark(particles, x, y, color) {
    const c = color || '#00FF41';
    for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.2 + Math.random() * 0.7) * 0.3; // velocidad escalada al canvas 1200x1600
        particles.particle.push(
            makeFXParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 'spark',
                220 + Math.random() * 200, c, 3 + Math.random() * 3)
        );
    }
}

// ---- Engine trail del fighter ----------------------------------------------

function createEngineTrail(particles, fighter) {
    const x = fighter.center.x - 14 + Math.random() * 28;
    const y = fighter.center.y + fighter.size.height / 2 - 4;
    particles.particle.push(
        makeFXParticle(x, y, 0, 0.4 + Math.random() * 0.3, 'engine',
            260, '#00BCFF', 6 + Math.random() * 5)
    );
}

// ---- Explosión masiva multicapa --------------------------------------------
// Reemplaza createEnemyDeathParticles / createPlayerDeathParticles añadiendo
// sparks + shockwaves + debris + más fuego. Sigue creando partículas con
// 'image' = 'fire1'/'fire2'/'smoke' para que se rendericen los assets originales.

function createEnemyDeathParticles(particles, enemies, enemy) {
    const cx = enemy.center.x;
    const cy = enemy.center.y;
    const isBoss = enemy.type === 'boss';

    // ---- 1) Partículas con sprites originales (fire1, fire2, smoke) --------
    const fireCount = isBoss ? 18 : 10;
    for (let i = 0; i < fireCount; i++) {
        let p = {
            center: { x: cx, y: cy },
            velocity: {
                x: (Math.random() - 0.5) * 0.4,
                y: (Math.random() - 0.5) * 0.4
            },
            rotation: Math.random() * 2 * Math.PI,
            rotationVel: (Math.random() - 0.5) * 0.02,
            size: { width: 30 + Math.random() * 40, height: 30 + Math.random() * 40 },
            life: 600 + Math.random() * 400,
            maxLife: 1000,
            image: Math.random() < 0.5 ? 'fire1' : 'fire2'
        };
        particles.particle.push(p);
    }
    const smokeCount = isBoss ? 14 : 8;
    for (let i = 0; i < smokeCount; i++) {
        let p = {
            center: { x: cx, y: cy },
            velocity: {
                x: (Math.random() - 0.5) * 0.2,
                y: (Math.random() - 0.5) * 0.2 - 0.05
            },
            rotation: Math.random() * 2 * Math.PI,
            rotationVel: (Math.random() - 0.5) * 0.01,
            size: { width: 50 + Math.random() * 50, height: 50 + Math.random() * 50 },
            life: 800 + Math.random() * 600,
            maxLife: 1400,
            image: 'smoke'
        };
        particles.particle.push(p);
    }

    // ---- 2) FX procedurales: sparks ----------------------------------------
    const sparkCount = isBoss ? 90 : 50;
    const sparkColors = isBoss
        ? ['#FF2E4A', '#FF7A00', '#FFD700', '#FFFFFF']
        : ['#00FF41', '#00BCFF', '#FFD700', '#FFFFFF'];
    for (let i = 0; i < sparkCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.3 + Math.random() * 1.4) * 0.4;
        particles.particle.push(
            makeFXParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 'spark',
                500 + Math.random() * 700,
                sparkColors[i % sparkColors.length],
                2 + Math.random() * 4)
        );
    }

    // ---- 3) FX procedurales: debris ----------------------------------------
    const debrisCount = isBoss ? 18 : 10;
    for (let i = 0; i < debrisCount; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.4 + Math.random() * 1.0) * 0.4;
        particles.particle.push(
            makeFXParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 'debris',
                700 + Math.random() * 500,
                sparkColors[i % sparkColors.length],
                6 + Math.random() * 8)
        );
    }

    // ---- 4) Anillo de luz blanca -------------------------------------------
    const ringCount = isBoss ? 32 : 20;
    for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        const sp = 0.5;
        particles.particle.push(
            makeFXParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 'spark',
                420, '#FFFFFF', 3)
        );
    }

    // ---- 5) Shockwaves -----------------------------------------------------
    MyGameFX.shockwaves.push({
        x: cx, y: cy, r: 8,
        maxR: isBoss ? 380 : 220,
        life: 600, maxLife: 600,
        color: isBoss ? '#FF2E4A' : '#00FF41'
    });
    if (isBoss) {
        MyGameFX.shockwaves.push({
            x: cx, y: cy, r: 8, maxR: 580,
            life: 900, maxLife: 900, color: '#FF7A00'
        });
        MyGameFX.shockwaves.push({
            x: cx, y: cy, r: 8, maxR: 280,
            life: 450, maxLife: 450, color: '#FFD700'
        });
    }

    // ---- 6) Screen shake + flash + slow-mo ---------------------------------
    MyGameFX.shake = Math.max(MyGameFX.shake, isBoss ? 30 : 10);
    MyGameFX.flash = Math.max(MyGameFX.flash, isBoss ? 0.7 : 0.25);
    if (isBoss) MyGameFX.slowmo = Math.max(MyGameFX.slowmo, 200);

    // --- MEJORA DE SCORE POPUP ---
    let pts = 50;
    if (enemy.type === 'butterfly') pts = enemy.diving ? 160 : 80;
    else if (enemy.type === 'boss') pts = enemy.diving ? 400 : 150;
    else if (enemy.type === 'bee') pts = enemy.diving ? 100 : 50;

    // Aumentamos el tamaño de 28 a 42 y usamos un color más brillante
    MyGameFX.popups.push({
        text: '+' + pts,
        x: cx, 
        y: cy,
        life: 1000, // Un poco más de tiempo en pantalla
        maxLife: 1000,
        color: '#FFD700', // Amarillo Oro Neón
        size: 42 // Tamaño mucho más grande y legible
    });
}

function createPlayerDeathParticles(fighter, particles) {
    const cx = fighter.center.x;
    const cy = fighter.center.y;

    // Fuego y humo con sprites originales
    for (let i = 0; i < 14; i++) {
        particles.particle.push({
            center: { x: cx, y: cy },
            velocity: { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5 },
            rotation: Math.random() * 2 * Math.PI,
            rotationVel: (Math.random() - 0.5) * 0.02,
            size: { width: 40 + Math.random() * 40, height: 40 + Math.random() * 40 },
            life: 700 + Math.random() * 500,
            maxLife: 1200,
            image: Math.random() < 0.5 ? 'fire1' : 'fire2'
        });
    }
    for (let i = 0; i < 12; i++) {
        particles.particle.push({
            center: { x: cx, y: cy },
            velocity: { x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.3 - 0.05 },
            rotation: Math.random() * 2 * Math.PI,
            rotationVel: (Math.random() - 0.5) * 0.01,
            size: { width: 60 + Math.random() * 50, height: 60 + Math.random() * 50 },
            life: 900 + Math.random() * 600,
            maxLife: 1500,
            image: 'smoke'
        });
    }

    // Sparks azules/blancos
    const colors = ['#00BCFF', '#E6FFFF', '#00FF41', '#FFFFFF'];
    for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.2 + Math.random() * 1.5) * 0.4;
        particles.particle.push(
            makeFXParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 'spark',
                500 + Math.random() * 600,
                colors[i % colors.length],
                2 + Math.random() * 3)
        );
    }
    // Debris
    for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.4 + Math.random()) * 0.4;
        particles.particle.push(
            makeFXParticle(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, 'debris',
                800 + Math.random() * 400,
                colors[i % colors.length],
                7 + Math.random() * 7)
        );
    }

    MyGameFX.shockwaves.push({
        x: cx, y: cy, r: 8, maxR: 320,
        life: 700, maxLife: 700, color: '#00BCFF'
    });
    MyGameFX.shake = Math.max(MyGameFX.shake, 24);
    MyGameFX.flash = Math.max(MyGameFX.flash, 0.6);
}

// ---- Update de partículas (extiende el original) ----------------------------

function updateParticles(particleArray, elapsedTime) {
    let remove = [];
    
    for (let i = 0; i < particleArray.length; i++) {
        let p = particleArray[i];

        // --- PROTECCIÓN ANTI-CONGELAMIENTO ---
        // Si la vida no es un número o no existe, la forzamos a 0 para que desaparezca
        if (typeof p.life !== 'number' || isNaN(p.life)) {
            p.life = 0;
        }

        p.life -= elapsedTime;

        // Movimiento
        if (p.velocity) {
            p.center.x += p.velocity.x * elapsedTime;
            p.center.y += p.velocity.y * elapsedTime;
        }

        // Rotación
        if (p.rotationVel !== undefined) {
            p.rotation += p.rotationVel * elapsedTime;
        }

        // Comportamiento por tipo (FX procedurales)
        if (p.kind === 'spark') {
            p.velocity.x *= 0.985;
            p.velocity.y *= 0.985;
        } else if (p.kind === 'debris') {
            p.velocity.y += 0.0005 * elapsedTime;
        } else if (p.kind === 'engine') {
            if (typeof p.size === 'number') p.size *= (1 - 0.002 * elapsedTime);
        }

        // Partículas con imagen (fire/smoke originales)
        if (p.image && p.size && p.size.width !== undefined) {
            if (p.image === 'smoke') {
                p.size.width += 0.04 * elapsedTime;
                p.size.height += 0.04 * elapsedTime;
            } else if (p.image === 'fire1' || p.image === 'fire2') {
                p.size.width *= (1 - 0.0006 * elapsedTime);
                p.size.height *= (1 - 0.0006 * elapsedTime);
            }
        }

        // --- LÓGICA DE ELIMINACIÓN ---
        // Si la vida es 0 o menos, o si la partícula se volvió invisible (size <= 0.3)
        if (p.life <= 0 || (typeof p.size === 'number' && p.size <= 0.3)) {
            remove.push(i);
        }
    }

    // Borrado eficiente desde el final del array
    for (let i = remove.length - 1; i >= 0; i--) {
        particleArray.splice(remove[i], 1);
    }
}


// ---- Update de FX globales (shockwaves, popups, shake, flash) --------------

function updateGlobalFX(elapsedTime) {
    // 1. Decaimiento de Shake y Flash (Efectos de pantalla)
    if (MyGameFX.shake > 0) MyGameFX.shake = Math.max(0, MyGameFX.shake - elapsedTime * 0.04);
    if (MyGameFX.flash > 0) MyGameFX.flash = Math.max(0, MyGameFX.flash - elapsedTime * 0.002);
    if (MyGameFX.slowmo > 0) MyGameFX.slowmo -= elapsedTime;

    // 2. Actualizar Ondas de Choque (Shockwaves)
    for (let i = MyGameFX.shockwaves.length - 1; i >= 0; i--) {
        const s = MyGameFX.shockwaves[i];
        s.life -= elapsedTime;
        // Evitamos división por cero si maxLife no existe
        const maxL = s.maxLife || 600; 
        const t = 1 - (s.life / maxL);
        s.r = 8 + (s.maxR - 8) * t;
        if (s.life <= 0) MyGameFX.shockwaves.splice(i, 1);
    }

    // 3. Actualizar Popups de Puntuación (Números flotantes)
    for (let i = MyGameFX.popups.length - 1; i >= 0; i--) {
        const p = MyGameFX.popups[i];
        p.life -= elapsedTime;
        
        // Movimiento: Sube suavemente y se desplaza un poco al azar
        p.y -= elapsedTime * 0.05; 
        
        if (p.life <= 0) {
            MyGameFX.popups.splice(i, 1);
        }
    }
}


function spawnPopup(text, x, y, color, size, life) {
    MyGameFX.popups.push({
        text: text, x: x, y: y,
        life: life || 1200, maxLife: life || 1200,
        color: color || '#00BCFF',
        size: size || 32
    });
}
