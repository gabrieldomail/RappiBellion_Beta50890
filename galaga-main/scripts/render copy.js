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
        // Flash blanco-cyan
        if (MyGameFX.flash > 0) {
            ctx.fillStyle = 'rgba(230,255,255,' + (MyGameFX.flash * 0.5) + ')';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    }

    function clear() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Fondo negro profundo
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Grid cyberpunk sutil
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
                    // Coloración cyberpunk: 18% rosa, 30% cyan, resto blanco
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

            // Glow neón sutil tras el sprite (color por tipo)
            const glowColor = type === 'boss' ? '#FF2E4A'
                            : type === 'butterfly' ? '#FF2D78'
                            : '#00BCFF';
            ctx.save();
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 14;
            drawTexture(enemies[type].images[sprite], enemy.center, rotation, size);
            ctx.restore();
        }
    }

    function drawEnemies(enemies) {
        for (let i = 0; i < enemies.enemy.length; i++) drawEnemy(enemies, enemies.enemy[i]);
    }

    function drawFighter(fighter) {
    if (fighter.img.isReady && !fighter.dead) {
        const boost = (typeof MyGameState !== 'undefined' && MyGameState.boostActive > 0);
        const aura = boost ? '#FFD700' : '#00BCFF';
        
        ctx.save();
        if (fighter.invulnerableTimer > 0 && Math.floor(performance.now() / 80) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }

        // --- MEJORA DE SHADOW (Sombra Neón) ---
        ctx.shadowColor = aura;
        ctx.shadowBlur = boost ? 40 : 25; // Aumentamos el brillo
        
        // Dibujamos el sprite
        drawTexture(fighter.img, fighter.center, 0, fighter.size);

        // --- EFECTO DE NÚCLEO (Glow interno) ---
        ctx.globalCompositeOperation = 'lighter'; // Suma de colores para efecto luz
        ctx.fillStyle = aura;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(fighter.center.x, fighter.center.y, fighter.size.width * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Aura de boost (el círculo dorado)
        if (boost) {
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 25;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 80);
            ctx.beginPath();
            ctx.arc(fighter.center.x, fighter.center.y, fighter.size.width * 0.75, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
        }
    }


    function drawTorpedos(torpedos) {
        // Friendly: torpedo con glow + halo radial cyan/verde
        if (torpedos.img1.isReady) {
            for (let i = 0; i < torpedos.friendly.length; i++) {
                let t = torpedos.friendly[i];
                // Halo radial
                const g = ctx.createRadialGradient(
                    t.center.x, t.center.y, 0,
                    t.center.x, t.center.y, 28);
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
        // Enemy: torpedo con glow rosa
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

    // ---- Renderizado de partículas extendido ------------------------------

    function drawParticles(particles) {
        for (let i in particles.particle) {
            let p = particles.particle[i];
            if (p.image) {
                // Partícula con sprite original (fire1/fire2/smoke)
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
                // FX procedural
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
            const g = ctx.createRadialGradient(
                p.center.x, p.center.y, 0,
                p.center.x, p.center.y, p.size);
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
        // Calculamos la transparencia (fade out)
        const a = Math.max(0, Math.min(1, p.life / Math.max(1, p.maxLife)));
        ctx.globalAlpha = a;

        // 1. TIPOGRAFÍA CYBERPUNK
        // Intentamos usar Orbitron o Share Tech Mono, si no, Courier New.
        ctx.font = 'bold ' + p.size + "px 'Orbitron', 'Share Tech Mono', 'Courier New', monospace";
        
        // 2. EFECTO DE BRILLO (GLOW)
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20; // Aumentamos el resplandor
        
        // 3. CONTORNO DE CONTRASTE (Stroke)
        // Dibujamos un borde negro muy fino para que el texto se lea bien sobre cualquier fondo
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(p.text, p.x, p.y);

        // 4. EL TEXTO PRINCIPAL
        ctx.fillText(p.text, p.x, p.y);
    }

        // Limpieza total para no afectar otros dibujos
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
