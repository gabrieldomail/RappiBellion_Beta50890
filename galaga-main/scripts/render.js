MyGame.graphics = (function() {
    'use strict';

    let canvas = document.getElementById('id-canvas');
    let ctx = canvas.getContext('2d');

    // === Shake/flash wrapper =================================================
    function beginFrame() {
        ctx.save();
        const sx = (Math.random() - 0.5) * (MyGameFX.shake || 0);
        const sy = (Math.random() - 0.5) * (MyGameFX.shake || 0);
        ctx.translate(sx, sy);
    }
    function endFrame() {
        if (MyGameFX.flash > 0) {
            ctx.fillStyle = 'rgba(230,255,255,' + (MyGameFX.flash * 0.5) + ')';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    }

    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(0,188,255,0.05)';
        ctx.lineWidth = 1;
        const grid = 80;
        for (let y = 0; y < canvas.height; y += grid) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
        }
        for (let x = 0; x < canvas.width; x += grid) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
    }

    function drawTexture(image, center, rotation, size) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(rotation);
        ctx.translate(-center.x, -center.y);
        ctx.drawImage(
            image,
            center.x - size.width / 2,
            center.y - size.height / 2,
            size.width, size.height);
        ctx.restore();
    }

    function drawText(spec) {
        ctx.save();
        ctx.font = spec.font;
        ctx.fillStyle = spec.fillStyle;
        ctx.strokeStyle = spec.strokeStyle;
        ctx.textBaseline = 'top';
        if (spec.shadowColor) {
            ctx.shadowColor = spec.shadowColor;
            ctx.shadowBlur = spec.shadowBlur || 10;
        }
        ctx.translate(spec.position.x, spec.position.y);
        ctx.rotate(spec.rotation);
        ctx.translate(-spec.position.x, -spec.position.y);
        ctx.fillText(spec.text, spec.position.x, spec.position.y);
        ctx.strokeText(spec.text, spec.position.x, spec.position.y);
        ctx.restore();
    }

    function drawBackgroundStars(backgroundStars) {
        if (backgroundStars && backgroundStars.stars) {
            for (let i = 0; i < backgroundStars.stars.length; i++) {
                let star = backgroundStars.stars[i];
                if (star.sparkle) {
                    ctx.beginPath();
                    ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI, false);
                    const c = star._c || (star._c = (Math.random() < 0.18 ? '#FF2D78'
                                       : (Math.random() < 0.3 ? '#00BCFF' : '#FFFFFF')));
                    ctx.fillStyle = c;
                    ctx.shadowColor = c;
                    ctx.shadowBlur = 6;
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    function drawScore(stats) {
        drawText({ font: "32px Arial", fillStyle: "#00BCFF", strokeStyle: "#00BCFF",
            shadowColor: '#00BCFF', shadowBlur: 10,
            position: { x: 50, y: 50 }, rotation: 0, text: "Score: " + stats.score });
        drawText({ font: "56px Arial", fillStyle: "#FF2E4A", strokeStyle: "black",
            shadowColor: '#FF2E4A', shadowBlur: 14,
            position: { x: canvas.width / 2 - 140, y: 2 }, rotation: 0, text: "High Score" });
        ctx.font = '42px Arial';
        const width = ctx.measureText(stats.highScore + "").width;
        drawText({ font: "42px Arial", fillStyle: "#E6FFFF", strokeStyle: "white",
            shadowColor: '#00BCFF', shadowBlur: 8,
            position: { x: canvas.width / 2 - (width / 2), y: 65 }, rotation: 0, text: stats.highScore });
    }

    function showCurrentStageBeginning(stage) {
        if (stage.showStageTimer > 0) {
            const txt = (stage.currentStage % 4 === 3)
                ? "Challenging Stage"
                : "Stage " + stage.currentStage;
            const x = (stage.currentStage % 4 === 3)
                ? canvas.width / 2 - 220
                : canvas.width / 2 - 110;
            drawText({
                font: "62px Arial", fillStyle: "#0fe3d3", strokeStyle: "black",
                shadowColor: '#00BCFF', shadowBlur: 22,
                position: { x: x, y: canvas.height / 2 - 50 }, rotation: 0, text: txt
            });
        }
    }

    function showStats(stats) {
        if (stats.showPlayerStats && !attractMode) {
            drawText({ font: "52px Arial", fillStyle: "#0fe3d3", strokeStyle: "black",
                shadowColor: '#00BCFF', shadowBlur: 12,
                position: { x: canvas.width / 2 - 160, y: canvas.height / 2 - 50 },
                rotation: 0, text: "Number of hits: " + stats.stage.hits });
        } else if (stats.showPlayerResults && !attractMode) {
            drawText({ font: "58px Arial", fillStyle: "#FF2E4A", strokeStyle: "black",
                shadowColor: '#FF2E4A', shadowBlur: 14,
                position: { x: canvas.width / 2 - 100, y: canvas.height / 2 - 150 },
                rotation: 0, text: "Results" });
            drawText({ font: "52px Arial", fillStyle: "#0fe3d3", strokeStyle: "black",
                shadowColor: '#00BCFF', shadowBlur: 10,
                position: { x: canvas.width / 2 - 200, y: canvas.height / 2 - 50 },
                rotation: 0, text: "Shots Fired: " + stats.totalTorpedosFired });
            drawText({ font: "52px Arial", fillStyle: "#0fe3d3", strokeStyle: "black",
                shadowColor: '#00BCFF', shadowBlur: 10,
                position: { x: canvas.width / 2 - 200, y: canvas.height / 2 + 50 },
                rotation: 0, text: "Number of hits: " + stats.totalHits });
            const ratio = stats.totalTorpedosFired > 0
                ? (stats.totalHits / stats.totalTorpedosFired * 100).toFixed(2) : "0.00";
            drawText({ font: "52px Arial", fillStyle: "#FFD700", strokeStyle: "black",
                shadowColor: '#FFD700', shadowBlur: 12,
                position: { x: canvas.width / 2 - 200, y: canvas.height / 2 + 150 },
                rotation: 0, text: "Hit-Miss Ratio: " + ratio + "%" });
        }
    }

    function drawStage(stage) {
        showCurrentStageBeginning(stage);
        if (stage.currentStage < 5) {
            for (let i = 0; i < stage.currentStage; i++) {
                drawTexture(stage.badge1, { x: canvas.width - (i * 32) - 16, y: canvas.height - 32 }, 0, { width: 28, height: 60 });
            }
        } else if (stage.currentStage < 10) {
            for (let i = 0; i < stage.currentStage - 4; i++) {
                if (i === stage.currentStage - 5) {
                    drawTexture(stage.badge5, { x: canvas.width - (i * 32) - 16, y: canvas.height - 30 }, 0, { width: 28, height: 56 });
                } else {
                    drawTexture(stage.badge1, { x: canvas.width - (i * 32) - 16, y: canvas.height - 26 }, 0, { width: 28, height: 48 });
                }
            }
        } else if (stage.currentStage < 20) {
            drawTexture(stage.badge10, { x: canvas.width - 30, y: canvas.height - 30 }, 0, { width: 52, height: 56 });
        } else {
            drawTexture(stage.badge20, { x: canvas.width - 34, y: canvas.height - 34 }, 0, { width: 60, height: 64 });
        }
    }

    function drawLives(fighter) {
        for (let i = 0; i < fighter.lives - 1; i++) {
            ctx.shadowColor = '#00BCFF';
            ctx.shadowBlur = 12;
            drawTexture(fighter.img,
                { x: fighter.size.width / 2 + 10 + i * (fighter.size.width + 5),
                  y: canvas.height - fighter.size.height / 2 - 5 },
                0, fighter.size);
            ctx.shadowBlur = 0;
        }
    }

    function drawEnemy(enemies, enemy) {
        let type = enemy.type;
        if (enemies[type].images[0].isReady) {
            let rotation = 0;
            let sprite = enemy.currentSprite;
            if (enemy.path.length === 0 && !enemy.diving) {
                sprite = enemies.formationSprite;
            }
            let size = enemies[type].size;
            if (sprite === 1) size = enemies[type].size2;
            if (type === "boss" && enemy.life === 1) sprite += 2;
            if (enemy.path.length > 0 && enemy.path[0].length === 3) {
                rotation = enemy.path[0][2] * Math.PI / 180;
            } else if (enemy.path.length === 0 && enemy.diving) {
                rotation = 180 * Math.PI / 180;
            }

            const glowColor = type === 'boss' ? '#FF2E4A'
                            : type === 'butterfly' ? '#FF2D78'
                            : '#00BCFF';
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 14;
            drawTexture(enemies[type].images[sprite], enemy.center, rotation, size);
            
            // --- BARRA DE VIDA UNIVERSAL (SÓLO SI HP > 1) ---
            if (enemy.maxHp && enemy.maxHp > 1) {
                const barW = size.width * 0.8;
                const barH = 4;
                const barX = enemy.center.x - barW / 2;
                const barY = enemy.center.y + size.height / 2 + 10;

                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(50, 0, 0, 0.7)';
                ctx.fillRect(barX, barY, barW, barH);

                const healthPct = enemy.hp / enemy.maxHp;
                ctx.fillStyle = healthPct > 0.5 ? '#00FF41' : (healthPct > 0.2 ? '#FFD700' : '#FF2E4A');
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 5;
                ctx.fillRect(barX, barY, barW * healthPct, barH);
                ctx.shadowBlur = 0;
            }

            ctx.restore();
        }
    }

    function drawEnemies(enemies) {
        for (let i = 0; i < enemies.enemy.length; i++) drawEnemy(enemies, enemies.enemy[i]);
    }

    function drawFighter(fighter) {
    if (fighter.img.isReady && !fighter.dead) {
        const isBoosting = (window.MyGameFX && MyGameFX.boostActive > 0);
        const auraColor = isBoosting ? '#FFD700' : '#00BCFF';
        
        ctx.save();

        // Parpadeo de invulnerabilidad
        if (fighter.invulnerableTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }

        // --- SISTEMA DE PULSACIÓN DINÁMICA ---
        // Creamos tres frecuencias distintas para que el movimiento se sienta orgánico y no robótico
        const time = performance.now();
        const pulseSlow = 0.8 + Math.sin(time / 400) * 0.2; // Latido lento (base)
        const pulseFast = 0.9 + Math.sin(time / 100) * 0.1; // Vibración rápida (energía)
        const flicker = Math.random() > 0.95 ? 0.8 : 1.0;   // Micro-parpadeos aleatorios

        const finalIntensity = pulseSlow * pulseFast * flicker;
        const blurAmount = isBoosting ? 45 * finalIntensity : 22 * finalIntensity;

        // 1. Sombra Neón Exterior (El resplandor que "respira")
        ctx.shadowColor = auraColor;
        ctx.shadowBlur = blurAmount;
        
        // Dibujamos la nave
        drawTexture(fighter.img, fighter.center, 0, fighter.size);

        // 2. NÚCLEO DE ENERGÍA (Luz interna dinámica)
        ctx.globalCompositeOperation = 'lighter'; 
        ctx.fillStyle = auraColor;
        // La opacidad del núcleo cambia con el pulso rápido
        ctx.globalAlpha = (isBoosting ? 0.5 : 0.2) * pulseFast;
        
        ctx.beginPath();
        // El núcleo también cambia ligeramente de tamaño con el pulso
        const nucleusSize = fighter.size.width * (0.35 + 0.05 * Math.sin(time / 200));
        ctx.arc(fighter.center.x, fighter.center.y, nucleusSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. EFECTO DE MOTOR (Fuego inferior)
        // Dibujamos un pequeño destello en la parte trasera que vibra
        ctx.fillStyle = isBoosting ? '#FF4500' : '#00FFFF';
        ctx.globalAlpha = 0.6 * pulseFast;
        ctx.beginPath();
        const engineY = fighter.center.y + fighter.size.height / 2 - 5;
        ctx.ellipse(fighter.center.x, engineY, 6 * pulseFast, 10 * pulseFast, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // 4. AURA DE BOOST (Sincronizada con el pulso)
        if (isBoosting) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20 * pulseFast;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time / 100);
            ctx.beginPath();
            ctx.arc(fighter.center.x, fighter.center.y, fighter.size.width * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

    function drawTorpedos(torpedos) {
        if (torpedos.img1.isReady) {
            for (let i = 0; i < torpedos.friendly.length; i++) {
                let t = torpedos.friendly[i];
                const g = ctx.createRadialGradient(t.center.x, t.center.y, 0, t.center.x, t.center.y, 28);
                g.addColorStop(0, 'rgba(255,255,255,0.9)');
                g.addColorStop(0.4, 'rgba(217, 255, 0, 0.39)');
                g.addColorStop(1, 'rgba(0,255,65,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(t.center.x, t.center.y, 28, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.shadowColor = '#00FF41';
                ctx.shadowBlur = 18;
                drawTexture(torpedos.img1, t.center, 0, torpedos.size);
                ctx.restore();
            }
        }
        if (torpedos.img2.isReady) {
            for (let i = 0; i < torpedos.enemy.length; i++) {
                let t = torpedos.enemy[i];
                let size = { width: torpedos.size.width * 1.2, height: torpedos.size.height * 1.2 };
                ctx.save();
                ctx.shadowColor = '#ff98bca0';
                ctx.shadowBlur = 14;
                drawTexture(torpedos.img2, t.center, 180 * Math.PI / 180, size);
                ctx.restore();
            }
        }
    }

    function drawParticles(particles) {
        for (let i in particles.particle) {
            let p = particles.particle[i];
            if (p.image) {
                let image = null;
                if (p.image === 'fire1') image = particles.imgFire1;
                else if (p.image === 'fire2') image = particles.imgFire2;
                else if (p.image === 'smoke') image = particles.imgSmoke;
                else if (p.image === 'fireBlue') image = particles.imgFireBlue;
                else if (p.image === 'fireGreen') image = particles.imgFireGreen;
                if (image && image.isReady && p.size && p.size.width > 0) {
                    const a = Math.max(0, p.life / (p.maxLife || 1000));
                    ctx.globalAlpha = a;
                    drawTexture(image, p.center, p.rotation || 0, p.size);
                    ctx.globalAlpha = 1;
                }
            } else if (p.kind) {
                drawProceduralParticle(p);
            }
        }
    }

    function drawProceduralParticle(p) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        if (p.kind === 'spark') {
            ctx.shadowColor = p.color; ctx.shadowBlur = 14;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.center.x, p.center.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (p.kind === 'debris') {
            ctx.save();
            ctx.translate(p.center.x, p.center.y);
            ctx.rotate(p.rotation);
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3;
            ctx.shadowColor = p.color; ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(-p.size / 2, 0);
            ctx.lineTo(p.size / 2, 0);
            ctx.stroke();
            ctx.restore();
            ctx.shadowBlur = 0;
        } else if (p.kind === 'engine') {
            const g = ctx.createRadialGradient(p.center.x, p.center.y, 0, p.center.x, p.center.y, p.size);
            g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
            g.addColorStop(1, 'rgba(0,188,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.center.x, p.center.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawShockwaves() {
        for (const s of MyGameFX.shockwaves) {
            const a = Math.max(0, s.life / s.maxLife);
            ctx.strokeStyle = s.color;
            ctx.globalAlpha = a;
            ctx.lineWidth = 5;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 22;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.shadowBlur = 38;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * 0.65, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    function drawPopups() {
        ctx.textAlign = 'center';
        for (const p of MyGameFX.popups) {
            const a = Math.max(0, Math.min(1, p.life / Math.max(1, p.maxLife)));
            ctx.globalAlpha = a;
            ctx.font = 'bold ' + p.size + "px 'Orbitron', 'Share Tech Mono', 'Courier New', monospace";
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = 1;
        ctx.textAlign = 'start';
    }

    let api = {
        get canvas() { return canvas; },
        clear: clear,
        beginFrame: beginFrame,
        endFrame: endFrame,
        drawTexture: drawTexture,
        drawText: drawText,
        drawBackgroundStars: drawBackgroundStars,
        drawScore: drawScore,
        drawStage: drawStage,
        drawLives: drawLives,
        drawEnemies: drawEnemies,
        drawFighter: drawFighter,
        drawTorpedos: drawTorpedos,
        drawParticles: drawParticles,
        drawShockwaves: drawShockwaves,
        drawPopups: drawPopups,
        showStats: showStats,
    };
    return api;
}());
