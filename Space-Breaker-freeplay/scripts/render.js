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
    lightPools:  [],
    enemyDamageStates: [],
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

        for (let i = this.lightPools.length - 1; i >= 0; i--) {
            const light = this.lightPools[i];
            light.age += dt;
            if (light.age >= light.duration) this.lightPools.splice(i, 1);
        }
        for (const state of this.enemyDamageStates) {
            state.flashAge += dt;
        }
    },

    showEnemyDamageState(enemy, remaining, total) {
        let state = this.enemyDamageStates.find(item => item.enemy === enemy);
        if (!state) {
            if (this.enemyDamageStates.length >= 8) this.enemyDamageStates.shift();
            state = { enemy };
            this.enemyDamageStates.push(state);
        }
        state.remaining = remaining;
        state.total = total;
        state.flashAge = 0;
    },

    clearEnemyDamageState(enemy) {
        for (let i = this.enemyDamageStates.length - 1; i >= 0; i--) {
            if (this.enemyDamageStates[i].enemy === enemy) this.enemyDamageStates.splice(i, 1);
        }
    },

    clearEnemyDamageStates() {
        this.enemyDamageStates.length = 0;
    },

    startAtomicPulse(x, y) {
        this.clearAtomicPulse();
        this.shockwaves.push({
            x, y, r: 10, maxR: 190, life: 560, maxLife: 560,
            color: this.COL.primario, kind: 'atomic-pulse'
        });
        this.shockwaves.push({
            x, y, r: 10, maxR: 125, life: 420, maxLife: 420,
            color: this.COL.amarillo, kind: 'atomic-pulse'
        });
    },

    clearAtomicPulse() {
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            if (this.shockwaves[i].kind === 'atomic-pulse') this.shockwaves.splice(i, 1);
        }
    },

    drawEnemyDamageStates(ctx, enemies) {
        if (!this.enemyDamageStates.length) return;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = this.enemyDamageStates.length - 1; i >= 0; i--) {
            const state = this.enemyDamageStates[i];
            const enemyIndex = enemies.enemy.indexOf(state.enemy);
            if (enemyIndex < 0) {
                this.enemyDamageStates.splice(i, 1);
                continue;
            }

            const enemy = state.enemy;
            const size = enemies[enemy.type].size;
            const width = Math.max(168, size.width * 1.8);
            const height = 46;
            const x = enemy.center.x - width / 2;
            const y = Math.max(4, enemy.center.y - size.height / 2 - height - 8);
            const lowHealth = state.remaining / state.total <= 0.5;
            const accent = lowHealth ? this.COL.rojo : this.COL.verde;
            const pulse = Math.max(0, 1 - state.flashAge / 180);

            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(2,8,18,0.94)';
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = pulse > 0 ? this.COL.blanco : accent;
            ctx.lineWidth = pulse > 0 ? 3 : 2;
            ctx.strokeRect(x, y, width, height);
            ctx.fillStyle = this.COL.blanco;
            ctx.font = 'bold 28px Orbitron,Arial';
            ctx.fillText(`HULL ${state.remaining}/${state.total}`, x + 8, y + 14);

            const barX = x + 8;
            const barY = y + 29;
            const gap = 4;
            const segmentWidth = (width - 16 - gap * (state.total - 1)) / state.total;
            for (let segment = 0; segment < state.total; segment++) {
                const segmentX = barX + segment * (segmentWidth + gap);
                ctx.fillStyle = segment < state.remaining ? accent : 'rgba(110,140,160,0.22)';
                ctx.fillRect(segmentX, barY, segmentWidth, 10);
                ctx.strokeStyle = segment < state.remaining ? accent : 'rgba(150,180,200,0.45)';
                ctx.lineWidth = 1;
                ctx.strokeRect(segmentX, barY, segmentWidth, 10);
            }
        }
        ctx.restore();
    },

    addLightPool(x, y, radius, color, ctx) {
        if (this.lightPools.length >= 3) this.lightPools.shift();
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,0.12)');
        gradient.addColorStop(0.38, hexToRgba(color, 0.08));
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        this.lightPools.push({ x, y, radius, gradient, age: 0, duration: 220 });
    },

    clearLightPools() {
        this.lightPools.length = 0;
    },

    drawLightPools(ctx) {
        if (!this.lightPools.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const light of this.lightPools) {
            const fadeIn = Math.min(1, light.age / 24);
            const fadeOut = Math.min(1, (light.duration - light.age) / 120);
            const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
            ctx.globalAlpha = alpha;
            ctx.fillStyle = light.gradient;
            ctx.beginPath();
            ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
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

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
}


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
    const BACKGROUND_PALETTE = ['#00BCFF', '#b26bff', '#39ff9a', '#ff5c5c', '#ffb020'];

    function drawBackgroundStars(backgroundStars, stageNumber = 1) {
        const accent = BACKGROUND_PALETTE[(Math.max(1, stageNumber) - 1) % BACKGROUND_PALETTE.length];
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
        ctx.strokeStyle = accent === '#00BCFF' ? 'rgba(0,188,255,0.055)' : `${accent}18`;
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
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI, false);
                ctx.globalAlpha = star.alpha * (0.72 + Math.sin(star.phase) * 0.28);
                ctx.fillStyle    = star.layer === 2 ? accent : '#d9f7ff';
                ctx.shadowColor  = star.layer === 2 ? accent : 'rgba(200,230,255,0.8)';
                ctx.shadowBlur   = star.layer === 2 ? 8 : 4;
                ctx.fill();
                ctx.shadowBlur   = 0;
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
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

    // ══════════════════════════════════════════════════════════════════════════
    // TRIUNVIRATO DE JEFES AAA: SECTOR COMMANDERS (+20% ESCALA: 312x216 px)
    // ══════════════════════════════════════════════════════════════════════════

    // ── 1. ACORAZADO // AEGIS DREADNOUGHT CLASS (312x216 px) ─────────────────
    function drawSectorCommanderDreadnought(enemy, enemies) {
        const cx = enemy.center.x;
        const cy = enemy.center.y;
        const time = performance.now();
        const enraged = enemy.enraged || (enemy.leftWingHp <= 0 && enemy.rightWingHp <= 0);

        ctx.save();
        ctx.translate(cx, cy);

        // 1. Toberas de propulsión gravitacional traseras
        const flamePulse = 22 + Math.sin(time * 0.04) * 10;
        const thrusterGrad = ctx.createLinearGradient(0, -70, 0, -70 - flamePulse);
        thrusterGrad.addColorStop(0, '#ffffff');
        thrusterGrad.addColorStop(0.3, enraged ? '#FF2E4A' : '#00BCFF');
        thrusterGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = thrusterGrad;
        ctx.beginPath();
        ctx.moveTo(-74, -60); ctx.lineTo(-60, -60 - flamePulse); ctx.lineTo(-46, -60); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(46, -60); ctx.lineTo(60, -60 - flamePulse); ctx.lineTo(74, -60); ctx.closePath(); ctx.fill();

        // 2. Chasis Acorazado Titanio (Dreadnought Armor Wings: 312x216 px)
        ctx.shadowColor = enraged ? '#FF2E4A' : '#00BCFF';
        ctx.shadowBlur = enraged ? 30 : 20;

        ctx.fillStyle = '#081422';
        ctx.strokeStyle = enraged ? '#FF2E4A' : '#00BCFF';
        ctx.lineWidth = 2.8;

        ctx.beginPath();
        ctx.moveTo(0, -84);
        ctx.lineTo(50, -62);
        ctx.lineTo(96, -50);
        ctx.lineTo(156, 10);
        ctx.lineTo(142, 58);
        ctx.lineTo(78, 42);
        ctx.lineTo(42, 74);
        ctx.lineTo(0, 60);
        ctx.lineTo(-42, 74);
        ctx.lineTo(-78, 42);
        ctx.lineTo(-142, 58);
        ctx.lineTo(-156, 10);
        ctx.lineTo(-96, -50);
        ctx.lineTo(-50, -62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Placas de blindaje secundarias internas
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-132, 24); ctx.lineTo(-54, 12); ctx.lineTo(-30, 42);
        ctx.moveTo(132, 24); ctx.lineTo(54, 12); ctx.lineTo(30, 42);
        ctx.stroke();

        // 3. Torretas de Alas Laterales (offset ±102 px)
        // Ala / Torreta Izquierda
        if (enemy.leftWingHp > 0) {
            ctx.save();
            ctx.translate(-102, 24);
            ctx.fillStyle = '#102438';
            ctx.strokeStyle = '#00BCFF';
            ctx.lineWidth = 2.2;
            ctx.fillRect(-22, -18, 44, 36);
            ctx.strokeRect(-22, -18, 44, 36);
            ctx.fillStyle = '#00BCFF';
            ctx.fillRect(-15, 18, 8, 20);
            ctx.fillRect(7, 18, 8, 20);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(-102, 24);
            ctx.fillStyle = '#181820';
            ctx.strokeStyle = '#444450';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-22, -12); ctx.lineTo(-10, 6); ctx.lineTo(-16, 18);
            ctx.lineTo(5, 10); ctx.lineTo(18, -14); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Ala / Torreta Derecha
        if (enemy.rightWingHp > 0) {
            ctx.save();
            ctx.translate(102, 24);
            ctx.fillStyle = '#102438';
            ctx.strokeStyle = '#00BCFF';
            ctx.lineWidth = 2.2;
            ctx.fillRect(-22, -18, 44, 36);
            ctx.strokeRect(-22, -18, 44, 36);
            ctx.fillStyle = '#00BCFF';
            ctx.fillRect(-15, 18, 8, 20);
            ctx.fillRect(7, 18, 8, 20);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(102, 24);
            ctx.fillStyle = '#181820';
            ctx.strokeStyle = '#444450';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-18, -14); ctx.lineTo(-5, 10); ctx.lineTo(16, 18);
            ctx.lineTo(10, 6); ctx.lineTo(22, -12); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // 4. Sprite Central de Galaga Boss escalado a 1.68x
        if (enemies.boss && enemies.boss.images[0] && enemies.boss.images[0].isReady) {
            const spr = enemy.coreHp < (enemy.coreMaxHp * 0.4) ? 2 : 0;
            const sprImg = enemies.boss.images[spr] || enemies.boss.images[0];
            ctx.save();
            ctx.shadowColor = enraged ? '#FF2E4A' : '#FFD700';
            ctx.shadowBlur = 24;
            drawTexture(sprImg, { x: 0, y: -6 }, 0, { width: 168, height: 168 });
            ctx.restore();
        }

        // 5. Reactor / Núcleo Central (PUNTO DÉBIL / WEAK POINT: ±46 px)
        const coreColor = enraged ? '#FF2E4A' : '#FFD700';
        const corePulse = 1 + Math.sin(time * (enraged ? 0.025 : 0.012)) * 0.14;

        ctx.save();
        ctx.translate(0, -6);
        ctx.shadowColor = coreColor;
        ctx.shadowBlur = enraged ? 36 : 22;

        // Anillo exterior contenedor rotativo
        ctx.save();
        ctx.rotate(time * (enraged ? 0.006 : 0.003));
        ctx.strokeStyle = coreColor;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, 31 * corePulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Núcleo esférico de plasma antimateria
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 20 * corePulse, 0, Math.PI * 2);
        ctx.fill();

        // Centro blanco hiper-incandescente
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 9 * corePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. Escudo Deflector Frontal (activo mientras haya alas)
        const isShielded = enemy.leftWingHp > 0 || enemy.rightWingHp > 0;
        if (isShielded) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(time * 0.008) * 0.15;
            ctx.strokeStyle = '#00BCFF';
            ctx.lineWidth = 2.8;
            ctx.shadowColor = '#00BCFF';
            ctx.shadowBlur = 18;
            ctx.setLineDash([12, 9]);
            ctx.lineDashOffset = -time * 0.04;
            ctx.beginPath();
            ctx.arc(0, 6, 82, -Math.PI * 0.85, -Math.PI * 0.15);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    // ── 2. BIO-REINA // CYBER-HORNET CLASS (312x216 px) ──────────────────────
    function drawCyberHornetBoss(enemy, enemies) {
        const cx = enemy.center.x;
        const cy = enemy.center.y;
        const time = performance.now();
        const enraged = enemy.enraged || (enemy.leftWingHp <= 0 && enemy.rightWingHp <= 0);

        ctx.save();
        ctx.translate(cx, cy);

        // 1. Toberas de bioplasma propulsor
        const flamePulse = 20 + Math.sin(time * 0.045) * 8;
        const amberGrad = ctx.createLinearGradient(0, -65, 0, -65 - flamePulse);
        amberGrad.addColorStop(0, '#ffffff');
        amberGrad.addColorStop(0.35, enraged ? '#FF3D00' : '#FFB300');
        amberGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = amberGrad;
        ctx.beginPath();
        ctx.moveTo(-54, -58); ctx.lineTo(-44, -58 - flamePulse); ctx.lineTo(-34, -58); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(34, -58); ctx.lineTo(44, -58 - flamePulse); ctx.lineTo(54, -58); ctx.closePath(); ctx.fill();

        // 2. Chasis Insectoide de Chitin Amber (312x216 px)
        ctx.shadowColor = enraged ? '#FF3D00' : '#FFB300';
        ctx.shadowBlur = enraged ? 32 : 20;

        ctx.fillStyle = '#141208';
        ctx.strokeStyle = enraged ? '#FF3D00' : '#FFB300';
        ctx.lineWidth = 2.8;

        ctx.beginPath();
        ctx.moveTo(0, -84);          // Corona cefalica superior
        ctx.lineTo(34, -70);
        ctx.lineTo(72, -50);
        ctx.lineTo(115, -35);
        ctx.lineTo(156, -5);         // Punta alar superior derecha
        ctx.lineTo(135, 45);
        ctx.lineTo(80, 55);
        ctx.lineTo(35, 65);
        ctx.lineTo(0, 92);           // Aguijón terminal inferior
        ctx.lineTo(-35, 65);
        ctx.lineTo(-80, 55);
        ctx.lineTo(-135, 45);
        ctx.lineTo(-156, -5);        // Punta alar superior izquierda
        ctx.lineTo(-115, -35);
        ctx.lineTo(-72, -50);
        ctx.lineTo(-34, -70);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Estrías de exoesqueleto y costillas quitinosas
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.28)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-125, 8); ctx.lineTo(-55, 14); ctx.lineTo(-24, 46);
        ctx.moveTo(125, 8); ctx.lineTo(55, 14); ctx.lineTo(24, 46);
        ctx.moveTo(-60, -35); ctx.lineTo(-20, -10);
        ctx.moveTo(60, -35); ctx.lineTo(20, -10);
        ctx.stroke();

        // 3. Módulos de Alas Sónicas Vibrantes (offset ±102 px)
        const wingVibe = Math.sin(time * 0.08) * 0.14;

        // Ala Izquierda
        if (enemy.leftWingHp > 0) {
            ctx.save();
            ctx.translate(-102, 10);
            ctx.rotate(wingVibe);
            const wGrad = ctx.createLinearGradient(-40, -40, 20, 30);
            wGrad.addColorStop(0, 'rgba(0, 229, 255, 0.55)');
            wGrad.addColorStop(1, 'rgba(255, 179, 0, 0.85)');
            ctx.fillStyle = wGrad;
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-42, -42); ctx.lineTo(18, -12); ctx.lineTo(-6, 32); ctx.lineTo(-38, 12); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Nervios de vibración sónica
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-35, -30); ctx.lineTo(5, -6);
            ctx.moveTo(-30, -10); ctx.lineTo(-10, 15);
            ctx.stroke();
            // Nodo capacitor sonico
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(-102, 10);
            ctx.fillStyle = '#1c1608';
            ctx.strokeStyle = '#5c4818';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-20, -14); ctx.lineTo(-8, 8); ctx.lineTo(-16, 20); ctx.lineTo(4, 10); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Ala Derecha
        if (enemy.rightWingHp > 0) {
            ctx.save();
            ctx.translate(102, 10);
            ctx.rotate(-wingVibe);
            const wGrad = ctx.createLinearGradient(40, -40, -20, 30);
            wGrad.addColorStop(0, 'rgba(0, 229, 255, 0.55)');
            wGrad.addColorStop(1, 'rgba(255, 179, 0, 0.85)');
            ctx.fillStyle = wGrad;
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(42, -42); ctx.lineTo(-18, -12); ctx.lineTo(6, 32); ctx.lineTo(38, 12); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Nervios sonicos
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(35, -30); ctx.lineTo(-5, -6);
            ctx.moveTo(30, -10); ctx.lineTo(10, 15);
            ctx.stroke();
            // Nodo capacitor sonico
            ctx.fillStyle = '#FFD700';
            ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(102, 10);
            ctx.fillStyle = '#1c1608';
            ctx.strokeStyle = '#5c4818';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(20, -14); ctx.lineTo(8, 8); ctx.lineTo(16, 20); ctx.lineTo(-4, 10); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // 4. Sprite Central de Galaga Bee escalado a 1.68x
        const beeSprites = enemies.bee ? enemies.bee.images : null;
        if (beeSprites && beeSprites[0] && beeSprites[0].isReady) {
            const sprIdx = enemies.formationSprite || 0;
            const sprImg = beeSprites[sprIdx] || beeSprites[0];
            ctx.save();
            ctx.shadowColor = enraged ? '#FF3D00' : '#FFD700';
            ctx.shadowBlur = 24;
            drawTexture(sprImg, { x: 0, y: -8 }, 0, { width: 168, height: 168 });
            ctx.restore();
        }

        // 5. Bio-Aguijón / Núcleo de Plasma (PUNTO DÉBIL: ±46 px)
        const stingerCol = enraged ? '#FF3D00' : '#FFC107';
        const stingerPulse = 1 + Math.sin(time * (enraged ? 0.03 : 0.015)) * 0.15;

        ctx.save();
        ctx.translate(0, 24);
        ctx.shadowColor = stingerCol;
        ctx.shadowBlur = enraged ? 38 : 24;

        // Anillo de resonancia eléctrica
        ctx.save();
        ctx.rotate(-time * (enraged ? 0.007 : 0.0035));
        ctx.strokeStyle = stingerCol;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 28 * stingerPulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Esfera de veneno bio-plasmático
        ctx.fillStyle = stingerCol;
        ctx.beginPath();
        ctx.arc(0, 0, 18 * stingerPulse, 0, Math.PI * 2);
        ctx.fill();

        // Centro blanco hiper-eléctrico
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 8 * stingerPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. Bio-Campo Deflector Hexagonal (activo mientras haya alas)
        const isShielded = enemy.leftWingHp > 0 || enemy.rightWingHp > 0;
        if (isShielded) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(time * 0.009) * 0.15;
            ctx.strokeStyle = '#FFB300';
            ctx.lineWidth = 2.8;
            ctx.shadowColor = '#FFB300';
            ctx.shadowBlur = 18;
            ctx.setLineDash([12, 9]);
            ctx.lineDashOffset = time * 0.035;
            ctx.beginPath();
            ctx.arc(0, 10, 84, -Math.PI * 0.85, -Math.PI * 0.15);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    // ── 3. MONARCA DEL VACÍO // VOID SERAPH CLASS (312x216 px) ────────────────
    function drawVoidSeraphBoss(enemy, enemies) {
        const cx = enemy.center.x;
        const cy = enemy.center.y;
        const time = performance.now();
        const enraged = enemy.enraged || (enemy.leftWingHp <= 0 && enemy.rightWingHp <= 0);

        ctx.save();
        ctx.translate(cx, cy);

        // 1. Aura de Singularidad Cósmica
        const auraPulse = 22 + Math.sin(time * 0.035) * 8;
        const auraGrad = ctx.createRadialGradient(0, -50, 5, 0, -50, 50 + auraPulse);
        auraGrad.addColorStop(0, '#ffffff');
        auraGrad.addColorStop(0.3, enraged ? '#D500F9' : '#E040FB');
        auraGrad.addColorStop(0.7, '#00E5FF');
        auraGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(0, -50, 48 + auraPulse, 0, Math.PI * 2);
        ctx.fill();

        // 2. Chasis Prisma Etéreo (312x216 px)
        ctx.shadowColor = enraged ? '#D500F9' : '#E040FB';
        ctx.shadowBlur = enraged ? 32 : 22;

        ctx.fillStyle = '#0E081A';
        ctx.strokeStyle = enraged ? '#D500F9' : '#E040FB';
        ctx.lineWidth = 2.8;

        ctx.beginPath();
        ctx.moveTo(0, -88);          // Cresta prismática superior
        ctx.lineTo(40, -68);
        ctx.lineTo(95, -55);
        ctx.lineTo(156, -15);        // Punta exterior del ala prismática
        ctx.lineTo(145, 38);
        ctx.lineTo(85, 48);
        ctx.lineTo(45, 78);          // Cauda espectral inferior
        ctx.lineTo(0, 62);
        ctx.lineTo(-45, 78);
        ctx.lineTo(-85, 48);
        ctx.lineTo(-145, 38);
        ctx.lineTo(-156, -15);
        ctx.lineTo(-95, -55);
        ctx.lineTo(-40, -68);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Facetas geométricas de refracción cuántica
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-135, 12); ctx.lineTo(-65, -12); ctx.lineTo(-20, 25);
        ctx.moveTo(135, 12); ctx.lineTo(65, -12); ctx.lineTo(20, 25);
        ctx.moveTo(0, -80); ctx.lineTo(0, 55);
        ctx.stroke();

        // 3. Módulos de Alas Prismáticas (offset ±102 px)
        // Ala Izquierda
        if (enemy.leftWingHp > 0) {
            ctx.save();
            ctx.translate(-102, 12);
            const pGrad = ctx.createLinearGradient(-35, -35, 35, 35);
            pGrad.addColorStop(0, 'rgba(224, 64, 251, 0.7)');
            pGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.5)');
            pGrad.addColorStop(1, 'rgba(255, 45, 120, 0.8)');
            ctx.fillStyle = pGrad;
            ctx.strokeStyle = '#E040FB';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-40, -38); ctx.lineTo(20, -10); ctx.lineTo(5, 32); ctx.lineTo(-35, 18); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Dispersión cromática interior
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(-32, -26); ctx.lineTo(8, -6); ctx.lineTo(-6, 22);
            ctx.stroke();
            // Cristal de enfoque cuántico
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(-102, 12);
            ctx.fillStyle = '#160822';
            ctx.strokeStyle = '#5a2285';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-18, -12); ctx.lineTo(-6, 10); ctx.lineTo(-14, 22); ctx.lineTo(6, 8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // Ala Derecha
        if (enemy.rightWingHp > 0) {
            ctx.save();
            ctx.translate(102, 12);
            const pGrad = ctx.createLinearGradient(35, -35, -35, 35);
            pGrad.addColorStop(0, 'rgba(224, 64, 251, 0.7)');
            pGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.5)');
            pGrad.addColorStop(1, 'rgba(255, 45, 120, 0.8)');
            ctx.fillStyle = pGrad;
            ctx.strokeStyle = '#E040FB';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(40, -38); ctx.lineTo(-20, -10); ctx.lineTo(-5, 32); ctx.lineTo(35, 18); ctx.closePath();
            ctx.fill(); ctx.stroke();
            // Dispersión cromática
            ctx.strokeStyle = '#00E5FF';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(32, -26); ctx.lineTo(-8, -6); ctx.lineTo(6, 22);
            ctx.stroke();
            // Cristal de enfoque cuántico
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.translate(102, 12);
            ctx.fillStyle = '#160822';
            ctx.strokeStyle = '#5a2285';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(18, -12); ctx.lineTo(6, 10); ctx.lineTo(14, 22); ctx.lineTo(-6, 8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }

        // 4. Sprite Central de Galaga Butterfly escalado a 1.68x
        const butterflySprites = enemies.butterfly ? enemies.butterfly.images : null;
        if (butterflySprites && butterflySprites[0] && butterflySprites[0].isReady) {
            const sprIdx = enemies.formationSprite || 0;
            const sprImg = butterflySprites[sprIdx] || butterflySprites[0];
            ctx.save();
            ctx.shadowColor = enraged ? '#D500F9' : '#FF2D78';
            ctx.shadowBlur = 24;
            drawTexture(sprImg, { x: 0, y: -8 }, 0, { width: 168, height: 168 });
            ctx.restore();
        }

        // 5. Ojo de Singularidad Psiónica (PUNTO DÉBIL: ±46 px)
        const eyeColor = enraged ? '#D500F9' : '#FF2D78';
        const eyePulse = 1 + Math.sin(time * (enraged ? 0.026 : 0.013)) * 0.14;

        ctx.save();
        ctx.translate(0, -6);
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = enraged ? 36 : 22;

        // Horizontes de sucesos concéntricos contra-rotativos
        ctx.save();
        ctx.rotate(time * (enraged ? 0.006 : 0.003));
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = 2.4;
        ctx.setLineDash([9, 7]);
        ctx.beginPath();
        ctx.arc(0, 0, 30 * eyePulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.rotate(-time * (enraged ? 0.008 : 0.004));
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 22 * eyePulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Vórtice psiónico central
        ctx.fillStyle = eyeColor;
        ctx.beginPath();
        ctx.arc(0, 0, 16 * eyePulse, 0, Math.PI * 2);
        ctx.fill();

        // Singularidad blanca pura
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 8 * eyePulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 6. Barrera Psiónica Deflectora (activa mientras haya alas)
        const isShielded = enemy.leftWingHp > 0 || enemy.rightWingHp > 0;
        if (isShielded) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.45 + Math.sin(time * 0.008) * 0.15;
            ctx.strokeStyle = '#FF2D78';
            ctx.lineWidth = 2.8;
            ctx.shadowColor = '#FF2D78';
            ctx.shadowBlur = 18;
            ctx.setLineDash([12, 9]);
            ctx.lineDashOffset = -time * 0.038;
            ctx.beginPath();
            ctx.arc(0, 6, 82, -Math.PI * 0.85, -Math.PI * 0.15);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    }

    // ── Enrutador de Enemigos con glow por tipo ─────────────────────────────
    function drawEnemy(enemies, enemy) {
        if (enemy.commander) {
            if (enemy.variant === 'hornet') {
                drawCyberHornetBoss(enemy, enemies);
            } else if (enemy.variant === 'seraph') {
                drawVoidSeraphBoss(enemy, enemies);
            } else {
                drawSectorCommanderDreadnought(enemy, enemies);
            }
            return;
        }

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

    // ── HUD MILITAR MULTI-MODULO: TELEMETRÍA DINÁMICA DEL TRIUNVIRATO ────────
    const HUD_COMMANDER_THEMES = {
        dreadnought: {
            title: 'AEGIS DREADNOUGHT // GOLIATH-01',
            lName: '[ L-TURRET ]',
            lOffline: '[ L-TURRET: OFFLINE ]',
            rName: '[ R-TURRET ]',
            rOffline: '[ R-TURRET: OFFLINE ]',
            wingCol: '#00BCFF',
            coreCol: '#FFD700',
            enragedCol: '#FF2E4A',
            enragedLabel: 'OVERHEAT // CORE VULNERABLE'
        },
        hornet: {
            title: 'CYBER-HORNET // HIVE QUEEN-IX',
            lName: '[ L-SONIC WING ]',
            lOffline: '[ L-SONIC WING: SHATTERED ]',
            rName: '[ R-SONIC WING ]',
            rOffline: '[ R-SONIC WING: SHATTERED ]',
            wingCol: '#FFB300',
            coreCol: '#FFC107',
            enragedCol: '#FF3D00',
            enragedLabel: 'FRENZY // CHITIN EXPOSED'
        },
        seraph: {
            title: 'VOID SERAPH // PHANTOM MONARCH',
            lName: '[ L-PRISM WING ]',
            lOffline: '[ L-PRISM WING: FRACTURED ]',
            rName: '[ R-PRISM WING ]',
            rOffline: '[ R-PRISM WING: FRACTURED ]',
            wingCol: '#E040FB',
            coreCol: '#FF2D78',
            enragedCol: '#D500F9',
            enragedLabel: 'SINGULARITY BREACH // EXPOSED'
        }
    };

    function drawCommanderHealth(enemies) {
        let commander = null;
        for (let i = 0; i < enemies.enemy.length; i++) {
            if (enemies.enemy[i].commander) {
                commander = enemies.enemy[i];
                break;
            }
        }
        if (!commander) return;

        const variant = commander.variant || 'dreadnought';
        const theme = HUD_COMMANDER_THEMES[variant] || HUD_COMMANDER_THEMES.dreadnought;
        const enraged = commander.enraged || (commander.leftWingHp <= 0 && commander.rightWingHp <= 0);
        const yTop = 72;

        ctx.save();

        // 1. SUB-BARRA: ALA / MODULO IZQUIERDO (x = 330, w = 195, h = 14)
        const lX = 330, lY = yTop + 6, lW = 195, lH = 14;
        ctx.fillStyle = 'rgba(2, 8, 18, 0.94)';
        ctx.fillRect(lX - 4, lY - 20, lW + 8, 44);

        if (commander.leftWingHp > 0) {
            const lFrac = Math.max(0, commander.leftWingHp / commander.leftWingMaxHp);
            ctx.strokeStyle = theme.wingCol;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(lX, lY, lW, lH);
            ctx.fillStyle = theme.wingCol;
            ctx.shadowColor = theme.wingCol;
            ctx.shadowBlur = 10;
            ctx.fillRect(lX + 2, lY + 2, (lW - 4) * lFrac, lH - 4);
            ctx.shadowBlur = 0;
            ctx.font = "bold 13px 'Orbitron', Arial";
            ctx.fillStyle = theme.wingCol;
            ctx.textAlign = 'left';
            ctx.fillText(`${theme.lName} ${Math.round(lFrac * 100)}%`, lX, lY - 6);
        } else {
            ctx.strokeStyle = 'rgba(255, 46, 74, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(lX, lY, lW, lH);
            ctx.font = "bold 12px 'Share Tech Mono', monospace, Arial";
            ctx.fillStyle = '#FF2E4A';
            ctx.textAlign = 'left';
            ctx.fillText(theme.lOffline, lX, lY - 6);
        }

        // 2. BARRA CENTRAL: REACTOR CORE / WEAK POINT (x = 540, w = 420, h = 24)
        const cX = 540, cY = yTop, cW = 420, cH = 24;
        ctx.fillStyle = 'rgba(2, 8, 18, 0.96)';
        ctx.fillRect(cX - 6, cY - 24, cW + 12, 58);

        const cFrac = Math.max(0, commander.coreHp / commander.coreMaxHp);
        const cColor = enraged ? theme.enragedCol : theme.coreCol;

        ctx.strokeStyle = cColor;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cX, cY, cW, cH);

        ctx.fillStyle = cColor;
        ctx.shadowColor = cColor;
        ctx.shadowBlur = 14;
        ctx.fillRect(cX + 2, cY + 2, (cW - 4) * cFrac, cH - 4);
        ctx.shadowBlur = 0;

        ctx.font = "bold 13px 'Orbitron', Arial";
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const statusLabel = enraged ? theme.enragedLabel : 'DEFLECTOR SHIELD ACTIVE';
        ctx.fillText(`${theme.title} // CORE: ${commander.coreHp}/${commander.coreMaxHp}  [${statusLabel}]`,
            cX + cW / 2, cY - 8);

        // 3. SUB-BARRA: ALA / MODULO DERECHO (x = 975, w = 195, h = 14)
        const rX = 975, rY = yTop + 6, rW = 195, rH = 14;
        ctx.fillStyle = 'rgba(2, 8, 18, 0.94)';
        ctx.fillRect(rX - 4, rY - 20, rW + 8, 44);

        if (commander.rightWingHp > 0) {
            const rFrac = Math.max(0, commander.rightWingHp / commander.rightWingMaxHp);
            ctx.strokeStyle = theme.wingCol;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rX, rY, rW, rH);
            ctx.fillStyle = theme.wingCol;
            ctx.shadowColor = theme.wingCol;
            ctx.shadowBlur = 10;
            ctx.fillRect(rX + 2, rY + 2, (rW - 4) * rFrac, rH - 4);
            ctx.shadowBlur = 0;
            ctx.font = "bold 13px 'Orbitron', Arial";
            ctx.fillStyle = theme.wingCol;
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(rFrac * 100)}% ${theme.rName}`, rX + rW, rY - 6);
        } else {
            ctx.strokeStyle = 'rgba(255, 46, 74, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(rX, rY, rW, rH);
            ctx.font = "bold 12px 'Share Tech Mono', monospace, Arial";
            ctx.fillStyle = '#FF2E4A';
            ctx.textAlign = 'right';
            ctx.fillText(`0% ${theme.rOffline}`, rX + rW, rY - 6);
        }

        ctx.restore();
    }

    // ── CAPSULAS DE LOOT Y HOLOGRABACIONES TACTICAS ────────────────────────
    function drawPowerups(items) {
        if (!items || !items.length) return;
        const config = {
            W: { color: NeonFX.COL.verde,    label: 'WPN UP',   glow: '#00FF41' },
            S: { color: NeonFX.COL.primario, label: 'SHIELD',   glow: '#00BCFF' },
            M: { color: NeonFX.COL.amarillo, label: '1-UP',     glow: '#FFD700' },
            B: { color: '#FF2D78',           label: 'P-BOMB',   glow: '#FF2D78' }
        };

        ctx.save();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const cfg = config[item.kind] || config.W;
            const color = cfg.color;
            const pulse = 1 + Math.sin(item.age * 6) * 0.07;
            const rad = 24 * pulse;

            ctx.save();
            ctx.translate(item.x, item.y);

            // 1. Resplandor exterior difuso de energia
            ctx.globalCompositeOperation = 'lighter';
            ctx.shadowColor = cfg.glow;
            ctx.shadowBlur = 22;

            // 2. Reticula exterior rotativa de telemetria militar
            ctx.save();
            ctx.rotate(item.age * 1.5);
            ctx.strokeStyle = hexToRgba(color, 0.6);
            ctx.lineWidth = 1.5;
            for (let a = 0; a < 4; a++) {
                ctx.beginPath();
                ctx.arc(0, 0, rad + 8, a * Math.PI / 2 + 0.15, a * Math.PI / 2 + Math.PI / 2 - 0.15);
                ctx.stroke();
            }
            // Micro-ticks en las 4 esquinas de telemetria
            ctx.fillStyle = color;
            for (let a = 0; a < 4; a++) {
                ctx.fillRect(rad + 6, -1.5, 4, 3);
                ctx.rotate(Math.PI / 2);
            }
            ctx.restore();

            // 3. Placa hexagonal blindada (Carbon Cyber-Crest)
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const angle = k * Math.PI / 3;
                const px = Math.cos(angle) * rad;
                const py = Math.sin(angle) * rad;
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(2, 8, 18, 0.94)';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Malla interior del hexagono
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
                const angle = k * Math.PI / 3;
                const px = Math.cos(angle) * (rad * 0.72);
                const py = Math.sin(angle) * (rad * 0.72);
                if (k === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle = hexToRgba(color, 0.35);
            ctx.lineWidth = 1;
            ctx.stroke();

            // 4. Iconografia vectorial de alta fidelidad
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.shadowColor = cfg.glow;
            ctx.shadowBlur = 12;

            if (item.kind === 'W') {
                // ICONO W: Doble cañon laser con rayos ascendentes
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(-7, 8); ctx.lineTo(-7, -4); ctx.lineTo(-5, -8); ctx.lineTo(-9, -8); ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(7, 8); ctx.lineTo(7, -4); ctx.lineTo(9, -8); ctx.lineTo(5, -8); ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -11); ctx.lineTo(3, -2); ctx.lineTo(1, -2); ctx.lineTo(1, 7);
                ctx.lineTo(-1, 7); ctx.lineTo(-1, -2); ctx.lineTo(-3, -2); ctx.closePath();
                ctx.fill();

            } else if (item.kind === 'S') {
                // ICONO S: Escudo energetico con chevron central
                ctx.beginPath();
                ctx.moveTo(0, -9);
                ctx.lineTo(8, -5);
                ctx.lineTo(7, 3);
                ctx.lineTo(0, 10);
                ctx.lineTo(-7, 3);
                ctx.lineTo(-8, -5);
                ctx.closePath();
                ctx.fillStyle = hexToRgba(color, 0.45);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                // Chevron interior
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(4, -1);
                ctx.lineTo(0, 6);
                ctx.lineTo(-4, -1);
                ctx.closePath();
                ctx.fillStyle = '#ffffff';
                ctx.fill();

            } else if (item.kind === 'M') {
                // ICONO M: Caza espacial en miniatura (Galaga Fighter)
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(3, -3);
                ctx.lineTo(9, 3);
                ctx.lineTo(7, 8);
                ctx.lineTo(3, 5);
                ctx.lineTo(2, 9);
                ctx.lineTo(-2, 9);
                ctx.lineTo(-3, 5);
                ctx.lineTo(-7, 8);
                ctx.lineTo(-9, 3);
                ctx.lineTo(-3, -3);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(0, -1, 2.2, 0, Math.PI * 2);
                ctx.fill();

            } else if (item.kind === 'B') {
                // ICONO B: Reactor de singularidad con aspas de radiacion
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                for (let k = 0; k < 3; k++) {
                    const ang = k * (Math.PI * 2 / 3) + item.age * 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, 8.5, ang - 0.4, ang + 0.4);
                    ctx.stroke();
                }
            }

            // 5. Micro-Etiqueta HUD inferior
            ctx.shadowBlur = 0;
            ctx.font = "bold 11px 'Share Tech Mono', monospace, Arial";
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(cfg.label, 0, rad + 11);

            ctx.restore();
        }
        ctx.restore();
    }

    // ── MISILES TACTICOS CYBERPUNK (ITANO CIRCUS / OVERDRIVE) ───────────────
    function drawMissiles(missiles) {
        if (!missiles || !missiles.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < missiles.length; i++) {
            const missile = missiles[i];
            const isPrimary = missile.role === 'primary';
            const color = isPrimary ? '#00BCFF' : '#FF2D78';
            const accent = isPrimary ? '#8ef0ff' : '#ffa6cc';

            ctx.save();
            ctx.translate(missile.center.x, missile.center.y);
            const angle = Math.atan2(missile.velocityY, missile.velocityX) + Math.PI / 2;
            ctx.rotate(angle);

            // Escala del misil segun rol
            const scale = isPrimary ? 1.2 : 1.0;
            ctx.scale(scale, scale);

            // 1. Tobera y llamarada de postcombustion (Thruster Flame)
            const flameLen = 14 + Math.sin(performance.now() * 0.05 + i) * 6;
            const flameGrad = ctx.createLinearGradient(0, 9, 0, 9 + flameLen);
            flameGrad.addColorStop(0, '#ffffff');
            flameGrad.addColorStop(0.35, color);
            flameGrad.addColorStop(1, 'rgba(0,0,0,0)');

            ctx.fillStyle = flameGrad;
            ctx.beginPath();
            ctx.moveTo(-4, 9);
            ctx.lineTo(0, 9 + flameLen);
            ctx.lineTo(4, 9);
            ctx.closePath();
            ctx.fill();

            // 2. Glow exterior del misil
            ctx.shadowColor = color;
            ctx.shadowBlur = 18;

            // 3. Aletas estabilizadoras posteriores (Delta Tail Fins)
            ctx.fillStyle = color;
            ctx.beginPath();
            // Aleta izquierda
            ctx.moveTo(-3, 3);
            ctx.lineTo(-11, 12);
            ctx.lineTo(-4, 10);
            // Aleta derecha
            ctx.moveTo(3, 3);
            ctx.lineTo(11, 12);
            ctx.lineTo(4, 10);
            ctx.fill();

            // 4. Fuselaje cilindrico blindado (Chasis titanio)
            ctx.fillStyle = '#0a1928';
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -21); // Ojiva afilada
            ctx.lineTo(4.5, -11); // Cono aerodinamico
            ctx.lineTo(4, 9);   // Costado lateral der
            ctx.lineTo(-4, 9);  // Base tobera
            ctx.lineTo(-4.5, -11); // Costado lateral izq
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 5. Canards delanteros (micro-aletas de maniobra)
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.moveTo(-4.5, -9);
            ctx.lineTo(-8.5, -5);
            ctx.lineTo(-4.5, -5);
            ctx.moveTo(4.5, -9);
            ctx.lineTo(8.5, -5);
            ctx.lineTo(4.5, -5);
            ctx.fill();

            // 6. Ojiva incandescente / Sensor de guia terminal
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(0, -20);
            ctx.lineTo(2, -12);
            ctx.lineTo(-2, -12);
            ctx.closePath();
            ctx.fill();

            // Sensor LED
            ctx.fillStyle = isPrimary ? '#00FF41' : '#FFD700';
            ctx.beginPath();
            ctx.arc(0, -10, 1.8, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        ctx.restore();
    }

    function drawAbilityHud(stats, fighter) {
        const x = 50, y = 112, width = 270, height = 14;
        const active = stats.overdriveTimer > 0;
        const fill = active ? Math.min(1, stats.overdriveTimer / 3200) : stats.overdriveMeter / 100;
        const color = active ? '#b26bff' : NeonFX.COL.primario;
        ctx.save();
        ctx.fillStyle = 'rgba(2,8,18,0.88)';
        ctx.fillRect(x - 8, y - 5, width + 16, 80);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 9;
        ctx.fillRect(x + 2, y + 2, (width - 4) * Math.max(0, fill), height - 4);
        ctx.shadowBlur = 0;
        ctx.fillStyle = NeonFX.COL.blanco;
        ctx.font = "bold 18px 'Orbitron',Arial";
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(active ? 'MISSILE OVERRIDE ' + (stats.overdriveTimer / 1000).toFixed(1) + 's'
            : stats.overdriveMeter >= 100 ? 'OVERDRIVE READY  [E]' : 'OVERDRIVE  [E]', x, y + 22);
        ctx.font = "bold 15px 'Orbitron',Arial";
        ctx.fillStyle = fighter.maneuverCooldown <= 0 ? NeonFX.COL.primario : 'rgba(230,255,255,0.65)';
        ctx.fillText(fighter.maneuverCooldown <= 0 ? 'ROLL READY [SHIFT/X]'
            : 'ROLL ' + (fighter.maneuverCooldown / 1000).toFixed(1) + 's', x, y + 44);
        ctx.font = "bold 18px 'Orbitron',Arial";
        ctx.textAlign = 'right';
        ctx.fillText('WPN ' + fighter.weaponTier +
            (fighter.weaponTier >= 5 ? '  MISSILES' : '') +
            '   SHIELD ' + fighter.shieldCharges, W - 38, H - 92);
        ctx.restore();
    }

    function drawAtomicDefenseField(fighter) {
        const time = Date.now();
        const remaining = Math.min(1, fighter.atomicImmune / 15000);
        const radius = Math.max(fighter.size.width, fighter.size.height) * 0.68;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.38 + (Math.sin(time / 140) + 1) * 0.1;
        ctx.strokeStyle = NeonFX.COL.primario;
        ctx.lineWidth = 2;
        ctx.shadowColor = NeonFX.COL.primario;
        ctx.shadowBlur = 9;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -(time / 45) % 11;
        ctx.beginPath();
        ctx.arc(fighter.center.x, fighter.center.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = NeonFX.COL.amarillo;
        ctx.lineWidth = 3;
        ctx.shadowColor = NeonFX.COL.amarillo;
        ctx.shadowBlur = 12;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(fighter.center.x, fighter.center.y, radius + 5,
            -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
        ctx.stroke();
        ctx.restore();
    }

    function drawAnimatedFighterSprite(fighter, offsetX = 0, offsetY = 0) {
        const bank = fighter.bank || 0;
        const maneuverRotation = fighter.maneuverRotation || 0;
        const roll = maneuverRotation + bank * 0.52;
        const projectedWidth = Math.max(0.14, Math.abs(Math.cos(roll)));
        const idleScale = 1 + 0.02 * Math.sin(performance.now() / 420);
        const scaleX = projectedWidth * idleScale;
        const scaleY = (1 + (1 - projectedWidth) * 0.08) * idleScale;
        ctx.save();
        ctx.translate(fighter.center.x + offsetX,
            fighter.center.y + offsetY + Math.sin(roll * 2) * 5);
        ctx.rotate(bank * 0.09);
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(fighter.img, -fighter.size.width / 2, -fighter.size.height / 2,
            fighter.size.width, fighter.size.height);
        ctx.restore();
    }

    // ── Fighter con blink de invulnerabilidad ─────────────────────────────
    function drawFighter(fighter) {
        if (!fighter.img.isReady || fighter.dead) return;

        ctx.save();

        // ── ATOMIC IMMUNITY: efecto dorado + glitch durante el boost ─────
        if (fighter.atomicImmune && fighter.atomicImmune > 0) {
            var t       = Date.now();
            var phase   = (t % 600) / 600;          // 0-1 ciclo lento
            var fastPhase = (t % 120) / 120;         // 0-1 ciclo rápido (parpadeo)
            var glitchPhase = (t % 80)  / 80;        // 0-1 ultra rápido (glitch)

            // ── Parpadeo dorado: alpha oscila entre 0.6 y 1.0 ────────────
            ctx.globalAlpha = 0.62 + Math.sin(fastPhase * Math.PI * 2) * 0.38;

            // ── Glow multicapa exagerado ───────────────────────────────────
            // Capa 1: halo dorado gigante
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur  = 55 + Math.sin(phase * Math.PI * 2) * 25;
            drawAnimatedFighterSprite(fighter);

            // Capa 2: borde negro pulsante (degradado dorado/negro)
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur  = 18;
            ctx.globalAlpha = 0.35 + Math.cos(fastPhase * Math.PI * 2) * 0.25;
            drawAnimatedFighterSprite(fighter);

            // Capa 3: glow blanco central en el pico del parpadeo
            if (fastPhase < 0.18) {
                ctx.shadowColor = 'rgba(255,255,220,0.95)';
                ctx.shadowBlur  = 30;
                ctx.globalAlpha = (0.18 - fastPhase) / 0.18;
                drawAnimatedFighterSprite(fighter);
            }

            // ── Efecto GLITCH: desplazamiento horizontal aleatorio ─────────
            if (glitchPhase < 0.22) {
                var glitchX = (Math.random() - 0.5) * 18;
                var glitchY = (Math.random() - 0.5) * 6;
                // Copia desplazada en cyan (canal izquierdo)
                ctx.globalAlpha = 0.55;
                ctx.shadowColor = NeonFX.COL.primario;
                ctx.shadowBlur  = 12;
                drawAnimatedFighterSprite(fighter, glitchX, glitchY);
                // Copia desplazada en rosa (canal derecho)
                ctx.shadowColor = NeonFX.COL.rosa;
                drawAnimatedFighterSprite(fighter, -glitchX, -glitchY);
            }

            // ── Anillo orbitante de sparks dorados ────────────────────────
            if (NeonFX && Math.random() < 0.45) {
                var orbitAngle = (t % 1800) / 1800 * Math.PI * 2;
                var orbitR     = fighter.size.width * 0.72;
                NeonFX.particles.push({
                    x: fighter.center.x + Math.cos(orbitAngle) * orbitR,
                    y: fighter.center.y + Math.sin(orbitAngle) * orbitR * 0.55,
                    vx: (Math.random()-0.5)*0.12,
                    vy: (Math.random()-0.5)*0.12,
                    kind: 'spark', life: 220, maxLife: 220,
                    color: Math.random() < 0.5 ? '#FFD700' : '#FFF8A0',
                    size: 2.5 + Math.random()*2,
                    rot: 0, vr: 0
                });
                // segundo spark en el lado opuesto
                NeonFX.particles.push({
                    x: fighter.center.x + Math.cos(orbitAngle + Math.PI) * orbitR,
                    y: fighter.center.y + Math.sin(orbitAngle + Math.PI) * orbitR * 0.55,
                    vx: (Math.random()-0.5)*0.12,
                    vy: (Math.random()-0.5)*0.12,
                    kind: 'spark', life: 180, maxLife: 180,
                    color: '#FF9500',
                    size: 2 + Math.random()*2,
                    rot: 0, vr: 0
                });
            }

        // ── INVULNERABILIDAD NORMAL: blink suave ──────────────────────────
        } else if (fighter.invulnerableTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.35;
            ctx.shadowColor = NeonFX.COL.primario;
            ctx.shadowBlur  = 20;
            drawAnimatedFighterSprite(fighter);

        // ── NORMAL: glow cyan base ────────────────────────────────────────
        } else {
            ctx.shadowColor = NeonFX.COL.primario;
            ctx.shadowBlur  = 20;
            drawAnimatedFighterSprite(fighter);
        }

        if (fighter.atomicImmune > 0) drawAtomicDefenseField(fighter);
        ctx.restore();

        if (fighter.shieldCharges > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = fighter.shieldCharges > 1 ? 0.82 : 0.58 + 0.12 * Math.sin(Date.now() / 90);
            ctx.strokeStyle = NeonFX.COL.primario;
            ctx.lineWidth = 3;
            ctx.shadowColor = NeonFX.COL.primario;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(fighter.center.x, fighter.center.y, fighter.size.width * 0.68, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }

    // ── PROYECTILES DE PLASMA PROCEDURALES (CYBERPUNK HIGH-ENERGY BOLTS) ──
    function drawPlasmaBolt(center, velocityX, velocityY, color, size, isEnemy = false) {
        const vy = velocityY || (isEnemy ? 800 : -2000);
        const vx = velocityX || 0;
        const angle = Math.atan2(vy, vx) + Math.PI / 2;

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.globalCompositeOperation = 'lighter';

        const h = size.height || 42;
        const w = size.width || 14;

        // 1. Estela conica de condensacion de plasma (tapered tail)
        const tailLen = h * 1.6;
        const tailGrad = ctx.createLinearGradient(0, -h * 0.1, 0, tailLen);
        tailGrad.addColorStop(0, hexToRgba(color, 0.9));
        tailGrad.addColorStop(0.35, hexToRgba(color, 0.4));
        tailGrad.addColorStop(1, hexToRgba(color, 0));

        ctx.fillStyle = tailGrad;
        ctx.beginPath();
        ctx.moveTo(-w * 0.45, 0);
        ctx.lineTo(0, tailLen);
        ctx.lineTo(w * 0.45, 0);
        ctx.closePath();
        ctx.fill();

        // 2. Halo de resplandor exterior neon
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.fillStyle = hexToRgba(color, 0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.85, h * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Vaina de plasma principal (ahusada como dardo de asalto energetico)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.58); // Punta afilada delantera
        ctx.lineTo(w * 0.55, -h * 0.12);
        ctx.lineTo(w * 0.38, h * 0.42);
        ctx.lineTo(0, h * 0.52);
        ctx.lineTo(-w * 0.38, h * 0.42);
        ctx.lineTo(-w * 0.55, -h * 0.12);
        ctx.closePath();
        ctx.fill();

        // 4. Nucleo hiper-incandescente blanco puro (Core Beam Laser)
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.52);
        ctx.lineTo(w * 0.22, -h * 0.1);
        ctx.lineTo(w * 0.15, h * 0.35);
        ctx.lineTo(0, h * 0.42);
        ctx.lineTo(-w * 0.15, h * 0.35);
        ctx.lineTo(-w * 0.22, -h * 0.1);
        ctx.closePath();
        ctx.fill();

        // 5. Destello frontal (Muzzle Spark Flare)
        ctx.beginPath();
        ctx.arc(0, -h * 0.5, 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    function drawTorpedos(torpedos) {
        ctx.save();
        // Disparos amigos (Verde Matrix / NeonFX.COL.verde)
        for (let i = 0; i < torpedos.friendly.length; i++) {
            const t = torpedos.friendly[i];
            drawPlasmaBolt(t.center, t.velocityX || 0, t.velocityY || -2000,
                NeonFX.COL.verde, torpedos.size, false);
        }

        // Disparos enemigos (Rosa Caos / NeonFX.COL.rosa)
        for (let i = 0; i < torpedos.enemy.length; i++) {
            const t = torpedos.enemy[i];
            const size = { width: torpedos.size.width * 1.25, height: torpedos.size.height * 1.25 };
            drawPlasmaBolt(t.center, t.velocityX || 0, t.velocityY || 800,
                NeonFX.COL.rosa, size, true);
        }
        ctx.restore();
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
                    g.addColorStop(1, hexToRgba(p.color, 0));
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
        drawLightPools: () => NeonFX.drawLightPools(ctx),
        drawEnemyDamageStates: enemies => NeonFX.drawEnemyDamageStates(ctx, enemies),
        showEnemyDamageState: (enemy, remaining, total) =>
            NeonFX.showEnemyDamageState(enemy, remaining, total),
        clearEnemyDamageState: enemy => NeonFX.clearEnemyDamageState(enemy),
        clearEnemyDamageStates: () => NeonFX.clearEnemyDamageStates(),
        startAtomicPulse: (x, y) => NeonFX.startAtomicPulse(x, y),
        clearAtomicPulse: () => NeonFX.clearAtomicPulse(),
        addLightPool: (x, y, radius, color) => NeonFX.addLightPool(x, y, radius, color, ctx),
        clearLightPools: () => NeonFX.clearLightPools(),
        drawScore,
        drawStage,
        drawLives,
        drawEnemies,
        drawCommanderHealth,
        drawPowerups,
        drawMissiles,
        drawAbilityHud,
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
