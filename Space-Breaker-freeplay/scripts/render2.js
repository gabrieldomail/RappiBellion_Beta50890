"use strict";

/* ==========================================================================
   NEON FX — Sistema de efectos visuales estilo Rappibellion
   Completamente aditivo: no rompe assets ni lógica original.
   Expone: NeonFX.bigExplosion · NeonFX.spawnHitSpark · NeonFX.spawnPopup
           NeonFX.spawnEngineTrail · NeonFX.spawnTorpedoTrail · NeonFX.update
   ========================================================================== */
const NeonFX = {

    // ── Estado ─────────────────────────────────────────────────────────────
    shockwaves:  [],   // ondas expansivas
    particles:   [],   // sparks / fire / smoke / debris / engine (canvas)
    popups:      [],   // textos flotantes de score
    screenShake: 0,    // intensidad del shake (px)
    flash:       0,    // destello blanco 0-1
    slowmo:      0,    // ms restantes de cámara lenta
    bgScrollY:   0,    // scroll del grid
    nebula:      null, // blobs de nebulosa (init lazy)
    _lastCanvas: null,

    // ── Paleta Rappibellion ────────────────────────────────────────────────
    COL: {
        primario: '#00BCFF',
        verde:    '#00FF41',
        amarillo: '#FFD700',
        rosa:     '#FF2D78',
        rojo:     '#FF2E4A',
        naranja:  '#FF7A00',
        blanco:   '#E6FFFF'
    },

    // ── Init nebulosa (una sola vez) ──────────────────────────────────────
    _initNebula(W, H) {
        const cols = ['rgba(255,45,120,0.07)', 'rgba(0,188,255,0.07)',
                      'rgba(255,122,0,0.05)',  'rgba(0,255,65,0.04)'];
        this.nebula = [];
        for (let i = 0; i < 7; i++) {
            this.nebula.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: 200 + Math.random() * 320,
                c: cols[i % cols.length],
                vy: 0.008 + Math.random() * 0.012
            });
        }
    },

    // ── Helper: crear partícula ───────────────────────────────────────────
    _p(x, y, vx, vy, kind, life, color, size) {
        return { x, y, vx, vy, kind, life, maxLife: life, color, size,
                 rot: Math.random() * Math.PI * 2,
                 vr: (Math.random() - 0.5) * 0.04 };
    },

    // ── Update (llamado desde updateTime cada frame) ──────────────────────
    update(dt) {
        const canvas = document.getElementById('id-canvas');
        if (!canvas) return;
        const W = canvas.width, H = canvas.height;

        if (!this.nebula) this._initNebula(W, H);

        // Decaimiento de efectos globales
        if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 0.05);
        if (this.flash > 0)       this.flash       = Math.max(0, this.flash - dt * 0.0022);
        if (this.slowmo > 0)      this.slowmo      -= dt;

        // Scroll del grid
        this.bgScrollY = (this.bgScrollY + dt * 0.016) % 80;

        // Nebulosa
        for (const n of this.nebula) {
            n.y += n.vy * dt * 0.05;
            if (n.y - n.r > H) { n.y = -n.r; n.x = Math.random() * W; }
        }

        // Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            const s = this.shockwaves[i];
            s.life -= dt;
            const t = 1 - s.life / s.maxLife;
            s.r = 10 + (s.maxR - 10) * t;
            if (s.life <= 0) this.shockwaves.splice(i, 1);
        }

        // Partículas canvas
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if      (p.kind === 'smoke')  { p.vy -= 0.00007 * dt; p.size += 0.014 * dt; }
            else if (p.kind === 'fire')   { p.size *= (1 - 0.0008 * dt); p.vy -= 0.0002 * dt; }
            else if (p.kind === 'spark')  { p.vx  *= 0.983; p.vy  *= 0.983; }
            else if (p.kind === 'debris') { p.vy  += 0.0003 * dt; p.rot += p.vr * dt; }
            else if (p.kind === 'engine') { p.size *= (1 - 0.002 * dt); }
            if (p.life <= 0 || p.size <= 0.2) this.particles.splice(i, 1);
        }

        // Popups flotantes
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= dt;
            p.y -= dt * 0.065;
            if (p.life <= 0) this.popups.splice(i, 1);
        }
    },

    // ── API: Explosión grande ─────────────────────────────────────────────
    bigExplosion(x, y, type) {
        const C = this.COL;
        const isBoss   = type === 'boss';
        const isPlayer = type === 'player';
        const base     = isBoss ? 120 : (isPlayer ? 85 : 52);
        const colors   = isBoss   ? [C.rojo, C.naranja, C.amarillo, '#ffffff']
                       : isPlayer ? [C.primario, C.blanco, C.verde]
                                  : [C.verde, C.primario, C.rosa, C.amarillo, '#ffffff'];

        // Ondas expansivas
        this.shockwaves.push({ x, y, r: 10, maxR: isBoss ? 310 : 175,
            life: 600, maxLife: 600, color: isBoss ? C.rojo : C.verde });
        if (isBoss) {
            this.shockwaves.push({ x, y, r: 10, maxR: 490, life: 900, maxLife: 900, color: C.naranja });
            this.shockwaves.push({ x, y, r: 10, maxR: 215, life: 420, maxLife: 420, color: C.amarillo });
        }

        // Sparks
        for (let i = 0; i < base; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = 0.18 + Math.random() * 1.4;
            this.particles.push(this._p(x, y, Math.cos(a)*sp, Math.sin(a)*sp,
                'spark', 500 + Math.random()*700, colors[i % colors.length], 2 + Math.random()*4));
        }
        // Smoke
        for (let i = 0; i < 20; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = Math.random() * 0.22;
            this.particles.push(this._p(x, y, Math.cos(a)*sp, Math.sin(a)*sp - 0.04,
                'smoke', 900 + Math.random()*900, 'rgba(155,165,195,0.55)', 15 + Math.random()*20));
        }
        // Fire
        for (let i = 0; i < 30; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = 0.04 + Math.random() * 0.44;
            this.particles.push(this._p(x, y, Math.cos(a)*sp, Math.sin(a)*sp,
                'fire', 450 + Math.random()*500, colors[i % colors.length], 9 + Math.random()*14));
        }
        // Debris
        for (let i = 0; i < 14; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = 0.35 + Math.random() * 0.9;
            this.particles.push(this._p(x, y, Math.cos(a)*sp, Math.sin(a)*sp,
                'debris', 650 + Math.random()*500, colors[i % colors.length], 5 + Math.random()*9));
        }
        // Ring de luz
        for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            this.particles.push(this._p(x, y, Math.cos(a)*0.65, Math.sin(a)*0.65,
                'spark', 350, '#ffffff', 3));
        }

        this.screenShake = Math.max(this.screenShake, isBoss ? 28 : (isPlayer ? 20 : 9));
        this.flash       = Math.max(this.flash,       isBoss ? 0.70 : (isPlayer ? 0.55 : 0.22));
        this.slowmo      = Math.max(this.slowmo,      isBoss ? 180 : 0);
    },

    // ── API: Chispa de impacto ────────────────────────────────────────────
    spawnHitSpark(x, y, color) {
        color = color || this.COL.amarillo;
        for (let i = 0; i < 9; i++) {
            const a  = Math.random() * Math.PI * 2;
            const sp = 0.14 + Math.random() * 0.6;
            this.particles.push(this._p(x, y, Math.cos(a)*sp, Math.sin(a)*sp,
                'spark', 180 + Math.random()*200, color, 1.5 + Math.random()*2.5));
        }
    },

    // ── API: Popup de score ───────────────────────────────────────────────
    spawnPopup(text, x, y, color, size) {
        this.popups.push({
            text,
            x, y,
            color: color || this.COL.amarillo,
            size:  size  || 44,   // era 22 — ahora el doble
            life:  1100,
            maxLife: 1100
        });
    },

    // ── API: Trail del motor del fighter ─────────────────────────────────
    spawnEngineTrail(cx, cy) {
        this.particles.push(this._p(
            cx - 8 + Math.random() * 16,
            cy + 42,
            (Math.random() - 0.5) * 0.1,
            0.28 + Math.random() * 0.38,
            'engine',
            180 + Math.random() * 140,
            Math.random() < 0.5 ? this.COL.primario : this.COL.verde,
            5 + Math.random() * 5
        ));
    },

    // ── API: Trail de torpedo ─────────────────────────────────────────────
    spawnTorpedoTrail(x, y) {
        this.particles.push(this._p(
            x + (Math.random() - 0.5) * 5,
            y + 12,
            (Math.random() - 0.5) * 0.07,
            0.18 + Math.random() * 0.28,
            'engine',
            150 + Math.random() * 110,
            Math.random() < 0.6 ? this.COL.verde : this.COL.primario,
            3 + Math.random() * 4
        ));
    }
};


/* ==========================================================================
   RENDER MODULE  (extiende y preserva toda la API original)
   ========================================================================== */
MyGame.graphics = (function() {
    'use strict';

    const canvas = document.getElementById('id-canvas');
    const ctx    = canvas.getContext('2d');
    const W      = canvas.width;   // 1200
    const H      = canvas.height;  // 1600

    // ── Screen shake vía CSS transform (no toca coordenadas de juego) ────
    function _applyShake() {
        if (NeonFX.screenShake > 0) {
            const sx = (Math.random() - 0.5) * NeonFX.screenShake;
            const sy = (Math.random() - 0.5) * NeonFX.screenShake;
            canvas.style.transform = `translate(${sx}px, ${sy}px)`;
        } else {
            canvas.style.transform = '';
        }
    }

    // ── Primitivos ────────────────────────────────────────────────────────
    function clear() {
        _applyShake();
        ctx.clearRect(0, 0, W, H);
    }

    function drawTexture(image, center, rotation, size) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);
        ctx.translate(-center.x, -center.y);
        ctx.drawImage(image,
            center.x - size.width  / 2,
            center.y - size.height / 2,
            size.width, size.height);
        ctx.restore();
    }

    function drawText(spec) {
        ctx.save();
        ctx.font         = spec.font;
        ctx.fillStyle    = spec.fillStyle;
        ctx.strokeStyle  = spec.strokeStyle;
        ctx.textBaseline = 'top';
        ctx.translate( spec.position.x,  spec.position.y);
        ctx.rotate(spec.rotation);
        ctx.translate(-spec.position.x, -spec.position.y);
        ctx.fillText(spec.text,   spec.position.x, spec.position.y);
        ctx.strokeText(spec.text, spec.position.x, spec.position.y);
        ctx.restore();
    }

    // ── Fondo: nebulosa + grid scrollable + estrellas ─────────────────────
    function drawBackgroundStars(backgroundStars) {
        // 1. Nebulosa
        if (NeonFX.nebula) {
            for (const n of NeonFX.nebula) {
                const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
                g.addColorStop(0, n.c);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
            }
        }

        // 2. Grid scrollable
        ctx.strokeStyle = 'rgba(0,188,255,0.055)';
        ctx.lineWidth   = 1;
        const gY = NeonFX.bgScrollY;
        for (let y = gY; y < H; y += 80) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        for (let x = 0; x < W; x += 80) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }

        // 3. Estrellas originales con micro-glow
        if (backgroundStars && backgroundStars.stars) {
            for (let i = 0; i < backgroundStars.stars.length; i++) {
                const star = backgroundStars.stars[i];
                if (star.sparkle) {
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI, false);
                    ctx.fillStyle    = 'white';
                    ctx.shadowColor  = 'rgba(200,230,255,0.8)';
                    ctx.shadowBlur   = 6;
                    ctx.fill();
                    ctx.shadowBlur   = 0;
                    ctx.stroke();
                }
            }
        }
    }

    // ── HUD — Score / Hi-Score con glow neon ─────────────────────────────
    function drawScore(stats) {
        ctx.save();

        // Score actual (izquierda)
        ctx.shadowColor = NeonFX.COL.primario; ctx.shadowBlur = 10;
        drawText({ font: "bold 34px 'Orbitron',Arial", fillStyle: NeonFX.COL.primario,
            strokeStyle: 'transparent',
            position: { x: 50, y: 50 }, rotation: 0,
            text: "SCORE  " + stats.score });

        // Hi-Score (centro)
        ctx.shadowColor = NeonFX.COL.rosa; ctx.shadowBlur = 14;
        drawText({ font: "bold 46px 'Orbitron',Arial", fillStyle: NeonFX.COL.rosa,
            strokeStyle: 'transparent',
            position: { x: W / 2 - 155, y: 2 }, rotation: 0,
            text: "HI-SCORE" });

        ctx.font = "bold 34px 'Orbitron',Arial";
        ctx.shadowColor = NeonFX.COL.amarillo; ctx.shadowBlur = 12;
        const hsW = ctx.measureText(String(stats.highScore)).width;
        drawText({ font: "bold 34px 'Orbitron',Arial", fillStyle: NeonFX.COL.amarillo,
            strokeStyle: 'transparent',
            position: { x: W / 2 - hsW / 2, y: 56 }, rotation: 0,
            text: String(stats.highScore) });

        ctx.restore();
    }

    function drawLives(fighter) {
        ctx.save();
        ctx.shadowColor = NeonFX.COL.primario; ctx.shadowBlur = 14;
        if (fighter.lives === 3) {
            drawTexture(fighter.img, { x: fighter.size.width / 2 + 10,       y: H - fighter.size.height / 2 - 5 }, 0, fighter.size);
            drawTexture(fighter.img, { x: fighter.size.width * 1.5 + 15,     y: H - fighter.size.height / 2 - 5 }, 0, fighter.size);
        } else if (fighter.lives === 2) {
            drawTexture(fighter.img, { x: fighter.size.width / 2 + 10,       y: H - fighter.size.height / 2 - 5 }, 0, fighter.size);
        }
        ctx.restore();
    }

    // ── Stage banner ──────────────────────────────────────────────────────
    function _showCurrentStageBeginning(stage) {
        if (stage.showStageTimer > 0) {
            ctx.save();
            ctx.shadowColor = NeonFX.COL.primario; ctx.shadowBlur = 20;
            const label = (stage.currentStage % 4 === 3)
                ? "CHALLENGING STAGE"
                : "STAGE  " + stage.currentStage;
            const xOff = (stage.currentStage % 4 === 3) ? 210 : 110;
            drawText({ font: "bold 52px 'Orbitron',Arial", fillStyle: NeonFX.COL.primario,
                strokeStyle: 'transparent',
                position: { x: W / 2 - xOff, y: H / 2 - 50 }, rotation: 0, text: label });
            ctx.restore();
        }
    }

    function drawStage(stage) {
        _showCurrentStageBeginning(stage);
        if (stage.currentStage < 5) {
            for (let i = 0; i < stage.currentStage; i++)
                drawTexture(stage.badge1, { x: W-(i*32)-16, y: H-32  }, 0, {width:28, height:60});
        } else if (stage.currentStage < 10) {
            for (let i = 0; i < stage.currentStage - 4; i++) {
                if (i === stage.currentStage - 5)
                    drawTexture(stage.badge5, { x: W-(i*32)-16, y: H-30 }, 0, {width:28, height:56});
                else
                    drawTexture(stage.badge1, { x: W-(i*32)-16, y: H-26 }, 0, {width:28, height:48});
            }
        } else if (stage.currentStage < 20) {
            drawTexture(stage.badge10, { x: W-30, y: H-30 }, 0, {width:52, height:56});
        } else {
            drawTexture(stage.badge20, { x: W-34, y: H-34 }, 0, {width:60, height:64});
        }
    }

    // ── Enemigos con glow por tipo ─────────────────────────────────────────
    function drawEnemy(enemies, enemy) {
        const type = enemy.type;
        if (!enemies[type].images[0].isReady) return;

        let rotation = 0;
        let sprite   = enemy.currentSprite;
        if (enemy.path.length === 0 && !enemy.diving) sprite = enemies.formationSprite;
        let size = enemies[type].size;
        if (sprite === 1) size = enemies[type].size2;
        if (type === "boss" && enemy.life === 1) sprite += 2;
        if (enemy.path.length > 0 && enemy.path[0].length === 3)
            rotation = enemy.path[0][2] * Math.PI / 180;
        else if (enemy.path.length === 0 && enemy.diving)
            rotation = Math.PI;  // 180 deg

        // Glow según tipo
        const glowColor = type === 'boss'      ? NeonFX.COL.rojo
                        : type === 'butterfly' ? NeonFX.COL.rosa
                        : type === 'bee'       ? NeonFX.COL.verde
                                               : NeonFX.COL.amarillo; // bonus
        ctx.save();
        ctx.shadowColor = glowColor;
        ctx.shadowBlur  = enemy.diving ? 22 : 12;
        drawTexture(enemies[type].images[sprite], enemy.center, rotation, size);
        ctx.restore();
    }

    function drawEnemies(enemies) {
        for (let i = 0; i < enemies.enemy.length; i++)
            drawEnemy(enemies, enemies.enemy[i]);
    }

    // ── Fighter con blink de invulnerabilidad ─────────────────────────────
    function drawFighter(fighter) {
        if (!fighter.img.isReady || fighter.dead) return;

        ctx.save();
        // Blink: visible cada 80ms durante invulnerabilidad
        if (fighter.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.35;
        }
        ctx.shadowColor = NeonFX.COL.primario;
        ctx.shadowBlur  = 20;
        drawTexture(fighter.img, fighter.center, 0, fighter.size);
        ctx.restore();
    }

    // ── Torpedos con glow neon ────────────────────────────────────────────
    function drawTorpedos(torpedos) {
        // Amigos — verde/cyan
        if (torpedos.img1.isReady) {
            for (const t of torpedos.friendly) {
                ctx.save();
                ctx.shadowColor = NeonFX.COL.verde; ctx.shadowBlur = 22;
                drawTexture(torpedos.img1, t.center, 0, torpedos.size);
                ctx.restore();
            }
        }
        // Enemigos — rosa/rojo
        if (torpedos.img2.isReady) {
            for (const t of torpedos.enemy) {
                const size = { width: torpedos.size.width * 1.2, height: torpedos.size.height * 1.2 };
                ctx.save();
                ctx.shadowColor = NeonFX.COL.rosa; ctx.shadowBlur = 20;
                drawTexture(torpedos.img2, t.center, Math.PI, size);
                ctx.restore();
            }
        }
    }

    // ── Partículas originales (imagen) — sin cambios ─────────────────────
    function drawParticles(particles) {
        for (let i in particles.particle) {
            const p = particles.particle[i];
            let image = null;
            if      (p.image === 'fire1')    image = particles.imgFire1;
            else if (p.image === 'fire2')    image = particles.imgFire2;
            else if (p.image === 'smoke')    image = particles.imgSmoke;
            else if (p.image === 'fireBlue') image = particles.imgFireBlue;
            else if (p.image === 'fireGreen')image = particles.imgFireGreen;
            if (image !== null && image.isReady) {
                drawTexture(image, p.center, p.rotation, p.size);
            }
        }
    }

    // ── showStats + capa NeonFX al final del frame ────────────────────────
    function showStats(stats) {
        if (stats.showPlayerStats && !attractMode) {
            ctx.save();
            ctx.shadowColor = NeonFX.COL.primario; ctx.shadowBlur = 12;
            drawText({ font: "bold 48px 'Orbitron',Arial", fillStyle: NeonFX.COL.primario,
                strokeStyle: 'transparent',
                position: { x: W / 2 - 190, y: H / 2 - 50 }, rotation: 0,
                text: "HITS  " + stats.stage.hits });
            ctx.restore();
        } else if (stats.showPlayerResults && !attractMode) {
            ctx.save();
            ctx.shadowColor = NeonFX.COL.rosa; ctx.shadowBlur = 16;
            drawText({ font: "bold 52px 'Orbitron',Arial", fillStyle: NeonFX.COL.rosa,
                strokeStyle: 'transparent',
                position: { x: W / 2 - 110, y: H / 2 - 160 }, rotation: 0, text: "RESULTS" });
            ctx.shadowColor = NeonFX.COL.primario; ctx.shadowBlur = 10;
            drawText({ font: "bold 42px 'Orbitron',Arial", fillStyle: NeonFX.COL.primario,
                strokeStyle: 'transparent',
                position: { x: W / 2 - 220, y: H / 2 - 50  }, rotation: 0,
                text: "SHOTS  " + stats.totalTorpedosFired });
            drawText({ font: "bold 42px 'Orbitron',Arial", fillStyle: NeonFX.COL.primario,
                strokeStyle: 'transparent',
                position: { x: W / 2 - 220, y: H / 2 + 60  }, rotation: 0,
                text: "HITS   " + stats.totalHits });
            ctx.shadowColor = NeonFX.COL.amarillo; ctx.shadowBlur = 14;
            const ratio = stats.totalTorpedosFired > 0
                ? (stats.totalHits / stats.totalTorpedosFired * 100).toFixed(1)
                : '0.0';
            drawText({ font: "bold 42px 'Orbitron',Arial", fillStyle: NeonFX.COL.amarillo,
                strokeStyle: 'transparent',
                position: { x: W / 2 - 220, y: H / 2 + 170 }, rotation: 0,
                text: "ACC    " + ratio + "%" });
            ctx.restore();
        }

        // ════ NeonFX layer ════
        _drawShockwaves();
        _drawNeonParticles();
        _drawPopups();

        // Flash screen
        if (NeonFX.flash > 0) {
            ctx.fillStyle = `rgba(230,255,255,${NeonFX.flash * 0.45})`;
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ── Shockwaves ────────────────────────────────────────────────────────
    function _drawShockwaves() {
        for (const s of NeonFX.shockwaves) {
            const a = Math.max(0, s.life / s.maxLife);
            ctx.globalAlpha = a * 0.85;
            ctx.strokeStyle = s.color;
            ctx.lineWidth   = 4;
            ctx.shadowColor = s.color; ctx.shadowBlur = 24;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.stroke();
            // anillo interior más suave
            ctx.lineWidth = 1; ctx.shadowBlur = 44;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.60, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    }

    // ── Partículas canvas (NeonFX) ─────────────────────────────────────────
    function _drawNeonParticles() {
        // Orden de dibujado: smoke primero (fondo), sparks al final (frente)
        const KINDS = ['smoke', 'fire', 'engine', 'debris', 'spark'];
        for (const kind of KINDS) {
            for (const p of NeonFX.particles) {
                if (p.kind !== kind) continue;
                const a = Math.max(0, p.life / p.maxLife);
                ctx.globalAlpha = a;

                if (kind === 'smoke') {
                    ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();

                } else if (kind === 'fire') {
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                    g.addColorStop(0, `rgba(255,255,255,${a})`);
                    g.addColorStop(0.4, p.color);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();

                } else if (kind === 'engine') {
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                    g.addColorStop(0, `rgba(255,255,255,${a})`);
                    g.addColorStop(1, 'rgba(0,188,255,0)');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();

                } else if (kind === 'debris') {
                    ctx.save();
                    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.strokeStyle = p.color; ctx.lineWidth = 2;
                    ctx.shadowColor = p.color; ctx.shadowBlur  = 8;
                    ctx.beginPath(); ctx.moveTo(-p.size/2, 0); ctx.lineTo(p.size/2, 0); ctx.stroke();
                    ctx.restore(); ctx.shadowBlur = 0;

                } else if (kind === 'spark') {
                    ctx.shadowColor = p.color; ctx.shadowBlur = 12;
                    ctx.fillStyle   = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur  = 0;
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    // ── Popups flotantes de score ─────────────────────────────────────────
    function _drawPopups() {
        ctx.textAlign = 'center';
        for (const p of NeonFX.popups) {
            const a = Math.min(1, p.life / 700);
            ctx.globalAlpha  = a;
            ctx.font         = `bold ${p.size}px 'Orbitron',Arial`;
            // Stroke oscuro para legibilidad sobre cualquier fondo
            ctx.strokeStyle  = 'rgba(0,0,0,0.75)';
            ctx.lineWidth    = 4;
            ctx.strokeText(p.text, p.x, p.y);
            // Fill con glow
            ctx.fillStyle    = p.color;
            ctx.shadowColor  = p.color; ctx.shadowBlur = 28;
            ctx.fillText(p.text, p.x, p.y);
            ctx.shadowBlur   = 0;
        }
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'start';
    }

    // ── API pública ───────────────────────────────────────────────────────
    return {
        get canvas()       { return canvas; },
        clear,
        drawTexture,
        drawText,
        drawBackgroundStars,
        drawScore,
        drawStage,
        drawLives,
        drawEnemies,
        drawFighter,
        drawTorpedos,
        drawParticles,
        showStats,
        // NeonFX shortcuts
        bigExplosion:    (x, y, type)         => NeonFX.bigExplosion(x, y, type),
        spawnHitSpark:   (x, y, color)        => NeonFX.spawnHitSpark(x, y, color),
        spawnPopup:      (txt, x, y, c, sz)   => NeonFX.spawnPopup(txt, x, y, c, sz)
    };
}());
