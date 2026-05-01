MyGame.screens['game-play'] = (function(game, input, graphics, images, sounds) {
    'use strict';

    let canvas = document.getElementById('id-canvas');
    let lastTimeStamp = performance.now();
    let cancelNextRequest = true;
    let quit = false;
    let myKeyboard = input.Keyboard();
    let backgroundStars = {};
    let fighter = {};
    let enemies = {};
    let torpedos = {};
    let stats = {};
    let particles = {};
    let sound = {};
    let ai = {};

    function processInput(elapsedTime) {
        myKeyboard.update(elapsedTime);
    }

    function update(elapsedTime) {
        updateTime(elapsedTime, stats, fighter);
        if (fighter.lives !== 0) {
            updateBackgroundStars(elapsedTime, backgroundStars);
            updateEnemies(elapsedTime, enemies, stats, torpedos, fighter, sound);
            updateTorpedos(elapsedTime, torpedos);
            updateFighterMobile(elapsedTime, fighter);
        }
        if (attractMode) {
            updateAI(elapsedTime, ai, fighter, enemies, torpedos, stats, sound);
            if (stats.stage.currentStage === 3) {
                endGame();
            }
        }
        checkCollisions(torpedos, fighter, enemies, stats, particles, sound);
        updateParticles(particles.particle, elapsedTime);
        checkEndStage(enemies, stats, fighter, elapsedTime, sound);
        if (fighter.lives === 0 && stats.endGameTimer <= 0) {
            endGame();
        }
    }

    function render() {
        graphics.clear();
        graphics.drawBackgroundStars(backgroundStars);
        graphics.drawScore(stats);
        graphics.drawLives(fighter);
        graphics.drawStage(stats.stage)
        graphics.drawEnemies(enemies);
        graphics.drawFighter(fighter);
        graphics.drawTorpedos(torpedos);
        graphics.drawParticles(particles);
        graphics.showStats(stats);
    }

    function gameLoop(time) {
        let elapsedTime = time - lastTimeStamp;
        lastTimeStamp = time;
        //console.log(elapsedTime);

        processInput(elapsedTime);
        update(elapsedTime);
        render();

        if (!cancelNextRequest) {
            requestAnimationFrame(gameLoop);
        }
    }

    function initialize() {
        backgroundStars = { stars: [] };

        fighter = { lives: 3, img: images.loadFighter(), center: { x: 600, y: 1470 }, size: { width: 80, height: 80 }, dead: false, deadTimer: 0, 
            invulnerableTimer: 1000, mobileMoveVal: 50, atomicImmune: 0};

        torpedos = { friendly: [], enemy: [], img1: images.loadTorpedo1(), img2: images.loadTorpedo2(), size: {width: 15, height: 40}, noLimit: true};

        stats = { score: 0, totalTorpedosFired: 0, totalHits: 0, currentTime: 0, showPlayerStats: false, showPlayerResults: false, endGameTimer: 5000, 
            highScore: LocalScores.persistence.getHighScore()};
        stats.stage = {currentStage: 1, stageTime: 0, showStageTimer: 5000, torpedosFired: 0, hits: 0, endingStage: false, endingStageTimer: 500, 
            stageEnemies: getStage(1), badge1: images.loadBadge1(), badge5: images.loadBadge5(), badge10: images.loadBadge10(), badge20: images.loadBadge20(), 
            badge30: images.loadBadge30(), badge50: images.loadBadge50()}
        
        enemies = { enemy: [], divingTimer: 17000, 
            formationSprite: 0, formationSpriteCount: 500, formationLeftRight: 4, formationOffsetX: 0, formationOffsetBreath: 1, formationBreathOut: true,
            "bee": {size: {width: 54, height: 60}, size2: {width: 78, height: 60}, images: [images.loadBee1(), images.loadBee2()]},
            "butterfly": { size: {width: 54, height: 60}, size2: {width: 78, height: 60}, images: [images.loadButterfly1(), images.loadButterfly2()]},
            "boss": { size: {width: 90, height: 90}, size2: {width: 90, height: 96}, images: [images.loadFullBoss1(), images.loadFullBoss2(), images.loadHalfBoss1(), 
                images.loadHalfBoss2()]},
            "bonus1": { size: {width: 96, height: 78}, size2: {width: 78, height: 60}, images: [images.loadBonus1()]},
            "bonus2": { size: {width: 108, height: 90}, size2: {width: 78, height: 60}, images: [images.loadBonus2()]},
            "bonus3": { size: {width: 84, height: 96}, size2: {width: 78, height: 60}, images: [images.loadBonus3()]}};

        particles = { particle: [], imgSmoke: images.loadSmoke(), imgFire1: images.loadFire1(), imgFire2: images.loadFire2(), imgFireBlue: images.loadFireBlue(), 
            imgFireGreen: images.loadFireBlue() };
        
        sound = { theme: sounds.loadTheme(), diving: sounds.loadDiving(), enemyDeath: sounds.loadEnemyDeath(), levelStart: sounds.loadLevel(), 
            playerDeath: sounds.loadPlayerDeath(), bossHurt: sounds.loadBossHurt(), bossDeath: sounds.loadBossDeath(), fireTorpedo: [], fireTorpedoQueue: 0};
        for (let i = 0; i < 10; i++) {
            sound.fireTorpedo.push(sounds.loadTorpedo());
        }

        ai = { fireTimer: 5000 };

        myKeyboard.register('Escape', function() {
            quit = true;
            endGame();
        });
        canvas.addEventListener('click', function() { fireTorpedo(fighter, torpedos, stats, sound); });

        mobileSupport(fighter, torpedos, stats, sound);

        // ── IFRAME BRIDGE ─────────────────────────────────────────────────
        var _inIframe = (window.self !== window.top);
        if (_inIframe) {

            // ── Rol del jugador (URL ?player=p1/p2) ───────────────────────
            var PLAYER      = (new URLSearchParams(window.location.search)).get('player') || 'p1';
            var _isBetMode  = false;
            var _boostLimit = 3;
            var _boostsUsed = 0;
            var _matchFrozen = false;

            // helper: postMessage con player siempre presente
            function _send(data) {
                if (!data.player) data.player = PLAYER;
                window.parent.postMessage(data, '*');
            }

            // Deferir showScreen para que game.js termine initialize() primero
            setTimeout(function() {
                if (game && game.showScreen) game.showScreen('game-play');
            }, 0);

            // ── AUTO-FIRE (mantener = disparo continuo) ────────────────────
            var _fireHeld     = false;
            var _fireInterval = null;

            function _startAutoFire() {
                if (_fireHeld || _matchFrozen) return;
                _fireHeld = true;
                if (!cancelNextRequest && fighter && !fighter.dead && stats.currentTime > 0)
                    fireTorpedo(fighter, torpedos, stats, sound);
                _fireInterval = setInterval(function() {
                    if (!cancelNextRequest && fighter && !fighter.dead && stats.currentTime > 0 && !_matchFrozen)
                        fireTorpedo(fighter, torpedos, stats, sound);
                }, 120);
            }
            function _stopAutoFire() {
                _fireHeld = false;
                if (_fireInterval) { clearInterval(_fireInterval); _fireInterval = null; }
            }

            // ── D-PAD dinámico (inyectado en el DOM del iframe) ───────────
            var _sbDpadLeft  = null;
            var _sbDpadRight = null;

            function _cleanupControls() {
                if (_sbDpadLeft) {
                    if (_sbDpadLeft._extraBtn && _sbDpadLeft._extraBtn.parentNode)
                        _sbDpadLeft._extraBtn.remove();
                    _sbDpadLeft.remove();
                    _sbDpadLeft  = null;
                }
                if (_sbDpadRight) { _sbDpadRight.remove(); _sbDpadRight = null; }
                fighter.mobileMoveVal = 50;
            }

            function _setupDpad() {
                _cleanupControls();
                var gameDiv = document.getElementById('game') || document.body;

                var baseStyle = [
                    'position:absolute','border-radius:50%','touch-action:none',
                    '-webkit-tap-highlight-color:transparent',
                    'display:flex','align-items:center','justify-content:center',
                    'cursor:pointer','pointer-events:auto','z-index:50'
                ].join(';');

                // ◀ IZQUIERDA — verde, esquina inferior izquierda
                _sbDpadLeft = document.createElement('button');
                _sbDpadLeft.style.cssText = baseStyle + ';' + [
                    'left:14px','bottom:28px','width:70px','height:70px',
                    'background:rgba(0,255,65,0.12)','border:2.5px solid rgba(0,255,65,0.85)',
                    'color:#00FF41','font-size:28px',
                    'box-shadow:0 0 14px rgba(0,255,65,0.45)'
                ].join(';');
                _sbDpadLeft.innerHTML = '&#9664;';

                // ▶ DERECHA — verde, pegada a la izquierda
                _sbDpadRight = document.createElement('button');
                _sbDpadRight.style.cssText = baseStyle + ';' + [
                    'left:92px','bottom:28px','width:70px','height:70px',
                    'background:rgba(0,255,65,0.12)','border:2.5px solid rgba(0,255,65,0.85)',
                    'color:#00FF41','font-size:28px',
                    'box-shadow:0 0 14px rgba(0,255,65,0.45)'
                ].join(';');
                _sbDpadRight.innerHTML = '&#9654;';

                // FIRE — amarillo Orbitron, lado derecho
                var _sbFireBtn = document.createElement('button');
                _sbFireBtn.style.cssText = baseStyle + ';' + [
                    'right:14px','bottom:20px','width:88px','height:88px',
                    'background:rgba(255,215,0,0.13)','border:2.5px solid rgba(255,215,0,0.9)',
                    'color:#FFD700',
                    'font-family:Orbitron,monospace','font-size:12px','font-weight:700',
                    'letter-spacing:0.15em','text-transform:uppercase',
                    'box-shadow:0 0 18px rgba(255,215,0,0.55)'
                ].join(';');
                _sbFireBtn.textContent = 'FIRE';

                gameDiv.appendChild(_sbDpadLeft);
                gameDiv.appendChild(_sbDpadRight);
                gameDiv.appendChild(_sbFireBtn);

                // Limpiar el fire btn también en cleanup
                var _origClean = _cleanupControls;
                _sbDpadLeft._extraBtn = _sbFireBtn;

                // Touch — flechas
                _sbDpadLeft.addEventListener('touchstart',  function(ev) { ev.preventDefault(); fighter.mobileMoveVal = 0;   }, { passive: false });
                _sbDpadLeft.addEventListener('touchend',    function()   { fighter.mobileMoveVal = 50; });
                _sbDpadLeft.addEventListener('touchcancel', function()   { fighter.mobileMoveVal = 50; });
                _sbDpadRight.addEventListener('touchstart',  function(ev) { ev.preventDefault(); fighter.mobileMoveVal = 100; }, { passive: false });
                _sbDpadRight.addEventListener('touchend',    function()   { fighter.mobileMoveVal = 50; });
                _sbDpadRight.addEventListener('touchcancel', function()   { fighter.mobileMoveVal = 50; });

                // Touch — FIRE
                _sbFireBtn.addEventListener('touchstart', function(ev) { ev.preventDefault(); _startAutoFire(); }, { passive: false });
                _sbFireBtn.addEventListener('touchend',   _stopAutoFire);
                _sbFireBtn.addEventListener('touchcancel',_stopAutoFire);
                _sbFireBtn.addEventListener('mousedown',  _startAutoFire);
                _sbFireBtn.addEventListener('mouseup',    _stopAutoFire);
                _sbFireBtn.addEventListener('mouseleave', _stopAutoFire);
            }

            function _setupSwipe() {
                _cleanupControls();
                var _sx = null, _moved = false;

                canvas.addEventListener('touchstart', function(ev) {
                    _sx = ev.touches[0].clientX; _moved = false;
                    fighter.mobileMoveVal = 50;
                }, { passive: true });

                canvas.addEventListener('touchmove', function(ev) {
                    ev.preventDefault();
                    if (_sx === null) return;
                    var dx = ev.touches[0].clientX - _sx;
                    if (Math.abs(dx) > 8) _moved = true;
                    fighter.mobileMoveVal = Math.max(0, Math.min(100, 50 + dx * 0.35));
                }, { passive: false });

                canvas.addEventListener('touchend', function() {
                    // Tap corto sin swipe = disparar
                    if (!_moved) { _startAutoFire(); setTimeout(_stopAutoFire, 150); }
                    _sx = null;
                    fighter.mobileMoveVal = 50;
                });
            }

            // ── Teclado: Spacebar = fire ───────────────────────────────────
            window.addEventListener('keydown', function(ev) {
                if ((ev.code === 'Space' || ev.key === ' ') && !ev.repeat) {
                    ev.preventDefault(); _startAutoFire();
                }
            });
            window.addEventListener('keyup', function(ev) {
                if (ev.code === 'Space' || ev.key === ' ') _stopAutoFire();
            });

            // ── SCORE_UPDATE cada 250ms ────────────────────────────────────
            setInterval(function() {
                if (!cancelNextRequest && stats && stats.score !== undefined)
                    _send({ type: 'SCORE_UPDATE', score: stats.score });
            }, 250);

            // ── Mensajes del padre ─────────────────────────────────────────
            window.addEventListener('message', function(ev) {
                var d = ev.data || {};

                if (d.type === 'START_MATCH') {
                    if (cancelNextRequest && !_matchFrozen) {
                        if (game && game.showScreen) game.showScreen('game-play');
                        run();
                    }
                    return;
                }

                // BET_CONFIG: recibir configuración de la apuesta
                if (d.type === 'BET_CONFIG') {
                    _isBetMode  = true;
                    _boostLimit = (typeof d.boostLimit === 'number') ? d.boostLimit : 0;
                    _boostsUsed = 0;
                    console.info('[Space T2E] BET_CONFIG — boostLimit:', _boostLimit, 'player:', PLAYER);
                    return;
                }

                if (d.type === 'MATCH_ENDED') {
                    // Congelar partida + notificar + overlay
                    _matchFrozen = true;
                    cancelNextRequest = true;
                    _stopAutoFire();
                    _send({ type: 'GAME_OVER', score: stats.score });
                    // Bloquear input
                    var _block = document.createElement('div');
                    _block.style.cssText = 'position:fixed;inset:0;z-index:9998;cursor:not-allowed;';
                    document.body.appendChild(_block);
                    // Overlay victoria/derrota
                    setTimeout(function() {
                        var isWinner = d.winner === PLAYER;
                        var isDraw   = d.winner === 'draw';
                        var color    = isDraw ? '#FFD700' : isWinner ? '#00BCFF' : '#FF2D78';
                        var title    = isDraw ? '⚡ EMPATE' : isWinner ? '▶ VICTORIA' : '✕ DERROTA';
                        var st = document.createElement('style');
                        st.textContent = '@keyframes sbFadeIn{from{opacity:0}to{opacity:1}}'
                            + '@keyframes sbGlow{0%,100%{text-shadow:0 0 20px currentColor}'
                            + '50%{text-shadow:0 0 45px currentColor,0 0 70px currentColor}}';
                        document.head.appendChild(st);
                        var ov = document.createElement('div');
                        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;'
                            + 'flex-direction:column;align-items:center;justify-content:center;'
                            + 'background:rgba(2,4,8,0.92);'
                            + 'font-family:Orbitron,Courier New,monospace;animation:sbFadeIn 0.4s ease;';
                        ov.innerHTML = '<div style="font-size:clamp(28px,8vw,62px);font-weight:900;color:'
                            + color + ';letter-spacing:6px;animation:sbGlow 1.5s ease-in-out infinite;'
                            + 'margin-bottom:16px;">' + title + '</div>'
                            + '<div style="color:rgba(0,255,65,0.6);font-size:13px;letter-spacing:4px;'
                            + 'font-family:\'Share Tech Mono\',monospace;">SCORE FINAL // '
                            + String(stats.score).padStart(6,'0') + '</div>'
                            + '<div style="margin-top:16px;color:rgba(0,188,255,0.35);font-size:10px;'
                            + 'letter-spacing:5px;font-family:\'Share Tech Mono\',monospace;">'
                            + 'RAPPIBELLION // SPACE-BREAKER T2E</div>';
                        document.body.appendChild(ov);
                    }, 400);
                    return;
                }

                if (d.type === 'RIVAL_BOOST') {
                    // Aviso visual cuando el rival usa su boost
                    var warn = document.createElement('div');
                    warn.style.cssText = 'position:fixed;top:50%;left:50%;'
                        + 'transform:translate(-50%,-50%);'
                        + 'background:rgba(255,45,120,0.14);'
                        + 'border:1px solid rgba(255,45,120,0.65);'
                        + 'color:#FF2D78;font-family:Orbitron,monospace;'
                        + 'font-size:clamp(10px,2vw,13px);letter-spacing:3px;'
                        + 'padding:10px 22px;z-index:8000;pointer-events:none;'
                        + 'white-space:nowrap;opacity:1;transition:opacity 0.4s;';
                    warn.textContent = '⚡ RIVAL — ATOMIC PULSE ACTIVO';
                    document.body.appendChild(warn);
                    setTimeout(function() { warn.style.opacity='0'; }, 1800);
                    setTimeout(function() { warn.remove(); }, 2200);
                    return;
                }

                if (d.type === 'FIRE_START') { _startAutoFire(); return; }
                if (d.type === 'FIRE_STOP')  { _stopAutoFire();  return; }

                if (d.type === 'SET_CONTROL') {
                    if (d.mode === 'dpad')  _setupDpad();
                    if (d.mode === 'swipe') _setupSwipe();
                    return;
                }

                // ATOMIC PULSE: limpia pantalla con explosión masiva
                // ═══════════════════════════════════════════════════════
                // ATOMIC PULSE — ITANO CIRCUS TRIBUTE
                // Sincronizado con los ~15s de atomic-robotech.mp3
                // ═══════════════════════════════════════════════════════
                if (d.type === 'ATOMIC_PULSE') {
                    // En betMode respetar el boostLimit de la apuesta
                    if (_isBetMode && _boostsUsed >= _boostLimit) {
                        console.warn('[Space T2E] ATOMIC_PULSE bloqueado — límite:', _boostLimit);
                        return;
                    }
                    _boostsUsed++;

                    var _nfx = (typeof NeonFX !== 'undefined') ? NeonFX : null;
                    var W_c  = canvas.width;
                    var H_c  = canvas.height;

                    // ── INMUNIDAD: 15 segundos exactos (duración del audio) ──
                    fighter.atomicImmune = 15000;
                    fighter.invulnerableTimer = 0;

                    // Colores Rappibellion + Macross
                    var MC = {
                        cyan:   '#00BCFF',
                        verde:  '#00FF41',
                        oro:    '#FFD700',
                        rosa:   '#FF2D78',
                        blanco: '#E8FFFF',
                        rojo:   '#FF2E4A'
                    };
                    var palette = [MC.cyan, MC.verde, MC.oro, MC.rosa, MC.cyan, MC.verde, MC.blanco];

                    // ── helper: crear partícula NeonFX ────────────────────
                    function _ap(x,y,vx,vy,kind,life,col,size) {
                        return { x:x, y:y, vx:vx, vy:vy, kind:kind,
                                 life:life, maxLife:life, color:col, size:size,
                                 rot:Math.random()*Math.PI*2, vr:(Math.random()-0.5)*0.06 };
                    }

                    // ── helper: misil NeonFX de arriba hacia abajo ────────
                    function _spawnMissile(xPos, col, speed) {
                        if (!_nfx) return;
                        var startY  = -30;
                        var steps   = Math.floor(H_c / (speed * 16));
                        var yNow    = startY;
                        var tick    = 0;
                        var iv = setInterval(function() {
                            yNow += speed * 16;
                            tick++;
                            if (yNow > H_c + 80 || tick > 180) { clearInterval(iv); return; }
                            // cabeza del misil
                            _nfx.particles.push(_ap(xPos, yNow, (Math.random()-0.5)*0.08, speed*0.1,
                                'spark', 90, MC.blanco, 4));
                            // cuerpo del misil (trail)
                            _nfx.particles.push(_ap(xPos+(Math.random()-0.5)*4, yNow+12,
                                (Math.random()-0.5)*0.05, speed*0.05,
                                'engine', 140, col, 7+Math.random()*4));
                            // exhaust
                            _nfx.particles.push(_ap(xPos+(Math.random()-0.5)*6, yNow+26,
                                (Math.random()-0.5)*0.12, -0.04,
                                'fire', 160, col, 10+Math.random()*6));
                        }, 16);
                        return iv;
                    }

                    // ── helper: misil en ESPIRAL (Itano Circus) ──────────
                    function _spawnSpiralMissile(cx, cy, angleDeg, speed, col) {
                        if (!_nfx) return;
                        var rad   = angleDeg * Math.PI / 180;
                        var vx    = Math.cos(rad) * speed;
                        var vy    = Math.sin(rad) * speed;
                        var x = cx, y = cy;
                        var tick  = 0;
                        // curva espiral: aceleramos ángulo con el tiempo
                        var iv = setInterval(function() {
                            tick++;
                            rad += 0.04; // rotación continua = espiral
                            vx = Math.cos(rad) * speed * (1 + tick * 0.012);
                            vy = Math.sin(rad) * speed * (1 + tick * 0.012);
                            x += vx * 16;
                            y += vy * 16;
                            if (x < -100 || x > W_c+100 || y < -100 || y > H_c+100 || tick > 160) {
                                clearInterval(iv); return;
                            }
                            _nfx.particles.push(_ap(x, y, vx*0.1, vy*0.1, 'spark',  80, MC.blanco, 3));
                            _nfx.particles.push(_ap(x, y, (Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3,
                                'engine', 130, col, 8+Math.random()*4));
                        }, 16);
                        return iv;
                    }

                    // ── helper: shockwave en punto ────────────────────────
                    function _sw(x, y, maxR, col, life) {
                        if (!_nfx) return;
                        _nfx.shockwaves.push({ x:x, y:y, r:10, maxR:maxR,
                            life:life, maxLife:life, color:col });
                    }

                    // ══════════════════════════════════════════════════════
                    // FASE 0 — Destello inicial (0ms)
                    // ══════════════════════════════════════════════════════
                    if (_nfx) {
                        _nfx.flash       = 0.95;
                        _nfx.screenShake = 45;
                        _sw(W_c/2, H_c/2, 600, MC.cyan,  700);
                        _sw(W_c/2, H_c/2, 420, MC.verde, 500);
                        _sw(W_c/2, H_c/2, 280, MC.oro,   380);
                    }

                    // Destruir enemigos actuales — escalonado rápido
                    var _ec0 = enemies && enemies.enemy ? enemies.enemy.slice() : [];
                    _ec0.forEach(function(e, i) {
                        setTimeout(function() {
                            if (_nfx) _nfx.bigExplosion(e.center.x, e.center.y, e.type);
                            addScore(stats, e);
                        }, i * 40);
                    });
                    if (enemies) enemies.enemy = [];

                    // ══════════════════════════════════════════════════════
                    // FASE 1 — Primera oleada de misiles (150ms)
                    // 12 misiles en columnas uniformes
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        for (var m = 0; m < 12; m++) {
                            (function(mi) {
                                var x   = (mi / 12) * W_c + (Math.random()-0.5) * (W_c/14);
                                var col = palette[mi % palette.length];
                                var spd = 0.8 + Math.random() * 0.5;
                                setTimeout(function() { _spawnMissile(x, col, spd); }, mi * 35);
                            })(m);
                        }
                    }, 150);

                    // ══════════════════════════════════════════════════════
                    // FASE 2 — Itano Circus espiral (1200ms)
                    // 16 misiles en espiral desde el centro-superior
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        if (!_nfx) return;
                        var cx = W_c / 2, cy = H_c * 0.18;
                        _sw(cx, cy, 350, MC.cyan, 600);
                        _nfx.flash = 0.55;
                        for (var s = 0; s < 16; s++) {
                            (function(si) {
                                var deg = (si / 16) * 360;
                                var col = palette[si % palette.length];
                                setTimeout(function() {
                                    _spawnSpiralMissile(cx, cy, deg, 0.55 + Math.random()*0.3, col);
                                }, si * 50);
                            })(s);
                        }
                    }, 1200);

                    // ══════════════════════════════════════════════════════
                    // FASE 3 — Segunda oleada densa (2600ms)
                    // 18 misiles, velocidades mixtas
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        for (var m = 0; m < 18; m++) {
                            (function(mi) {
                                var x   = Math.random() * W_c;
                                var col = palette[mi % palette.length];
                                var spd = 0.6 + Math.random() * 0.9;
                                setTimeout(function() { _spawnMissile(x, col, spd); }, mi * 28);
                            })(m);
                        }
                        if (_nfx) { _nfx.screenShake = 30; _nfx.flash = 0.42; }
                    }, 2600);

                    // ══════════════════════════════════════════════════════
                    // FASE 4 — Shockwaves en cascada (4000ms)
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        if (!_nfx) return;
                        var pts = [
                            [W_c*0.2, H_c*0.25], [W_c*0.8, H_c*0.25],
                            [W_c*0.5, H_c*0.15], [W_c*0.35,H_c*0.40],
                            [W_c*0.65,H_c*0.40]
                        ];
                        pts.forEach(function(pt, i) {
                            setTimeout(function() {
                                _sw(pt[0], pt[1], 280, palette[i % palette.length], 500);
                                // spark burst en cada punto
                                for (var k = 0; k < 18; k++) {
                                    var a = (k/18)*Math.PI*2;
                                    _nfx.particles.push(_ap(
                                        pt[0], pt[1],
                                        Math.cos(a)*0.9, Math.sin(a)*0.9,
                                        'spark', 400, palette[i % palette.length], 3+Math.random()*3
                                    ));
                                }
                            }, i * 140);
                        });
                    }, 4000);

                    // ══════════════════════════════════════════════════════
                    // FASE 5 — Tercer barrage (espejo del primero) (5800ms)
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        for (var m = 0; m < 16; m++) {
                            (function(mi) {
                                var x   = (mi / 16) * W_c;
                                var col = palette[(mi + 3) % palette.length];
                                var spd = 1.0 + Math.random() * 0.6;
                                setTimeout(function() { _spawnMissile(x, col, spd); }, mi * 30);
                            })(m);
                        }
                        if (_nfx) { _nfx.flash = 0.35; _nfx.screenShake = 20; }
                    }, 5800);

                    // ══════════════════════════════════════════════════════
                    // FASE 6 — Segundo Itano Circus (7500ms)
                    // Doble espiral desde las esquinas
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        if (!_nfx) return;
                        var origins = [[W_c*0.25, H_c*0.12], [W_c*0.75, H_c*0.12]];
                        origins.forEach(function(o, oi) {
                            _sw(o[0], o[1], 250, palette[oi*2], 500);
                            for (var s = 0; s < 10; s++) {
                                (function(si) {
                                    var deg = (si/10)*360 + oi*180;
                                    var col = palette[(si + oi*3) % palette.length];
                                    setTimeout(function() {
                                        _spawnSpiralMissile(o[0], o[1], deg, 0.5+Math.random()*0.4, col);
                                    }, si * 60);
                                })(s);
                            }
                        });
                        _nfx.flash = 0.5;
                        _nfx.screenShake = 25;
                    }, 7500);

                    // ══════════════════════════════════════════════════════
                    // FASE 7 — Clímax final (10000ms)
                    // Enemies nuevos del stage siguiente también explotan
                    // + barrage máximo densidad
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        if (!_nfx) return;

                        // Barrage final: 24 misiles muy rápidos
                        for (var m = 0; m < 24; m++) {
                            (function(mi) {
                                var x   = Math.random() * W_c;
                                var col = palette[mi % palette.length];
                                var spd = 1.3 + Math.random() * 0.8;
                                setTimeout(function() { _spawnMissile(x, col, spd); }, mi * 18);
                            })(m);
                        }

                        // Shockwaves concéntricas finales desde el centro
                        setTimeout(function() {
                            _sw(W_c/2, H_c/2, 700, MC.cyan,  1000);
                            _sw(W_c/2, H_c/2, 520, MC.verde,  800);
                            _sw(W_c/2, H_c/2, 360, MC.oro,    650);
                            _sw(W_c/2, H_c/2, 200, MC.rosa,   500);
                            _nfx.flash       = 0.98;
                            _nfx.screenShake = 55;
                            _nfx.slowmo      = 300;
                            // Explosiones en las 4 esquinas del área de juego
                            [[150,150],[W_c-150,150],[150,H_c-200],[W_c-150,H_c-200],
                             [W_c/2,H_c/2]].forEach(function(pt) {
                                _nfx.bigExplosion(pt[0], pt[1], 'boss');
                            });
                        }, 480);
                    }, 10000);

                    // ══════════════════════════════════════════════════════
                    // FASE 8 — Fade out (13500ms)
                    // ══════════════════════════════════════════════════════
                    setTimeout(function() {
                        if (!_nfx) return;
                        _nfx.flash = 0.25;
                        // Última onda suave de despedida
                        _sw(W_c/2, H_c/2, 400, MC.cyan, 1200);
                        // Sparks flotantes finales
                        for (var k = 0; k < 30; k++) {
                            var a = (k/30)*Math.PI*2;
                            _nfx.particles.push(_ap(
                                W_c/2 + Math.cos(a)*200,
                                H_c/2 + Math.sin(a)*200,
                                Math.cos(a)*0.2, Math.sin(a)*0.2,
                                'spark', 1200, palette[k % palette.length], 2+Math.random()*3
                            ));
                        }
                    }, 13500);

                    _send({ type: 'BOOST_USED' });
                    return;
                }
            });
        }
    }

    function resetGame() {
        backgroundStars = { stars: [] };
        
        fighter.lives = 3;
        fighter.center = { x: 600, y: 1470 };
        fighter.dead = false;
        fighter.deadTime = 0;
        fighter.invulnerableTimer = 1000;
        fighter.atomicImmune = 0;
        torpedos.friendly = [];
        torpedos.enemy = [];

        stats.score = 0;
        stats.totalTorpedosFired = 0;
        stats.totalHits = 0;
        stats.currentTime = 0;
        stats.showPlayerStats = false;
        stats.showPlayerResults = false;
        stats.endGameTimer = 5000;
        stats.highScore = LocalScores.persistence.getHighScore();
        stats.stage.currentStage = 1;
        stats.stage.stageTime = 0;
        stats.stage.showStageTimer = 5000;
        stats.stage.torpedosFired = 0;
        stats.stage.hits = 0;
        stats.stage.endingStage = false;
        stats.stage.endingStageTimer = 500;
        stats.stage.stageEnemies = getStage(1);

        enemies.enemy = [];
        enemies.divingTimer = 17000;
        enemies.formationSprite = 0;
        enemies.formationSpriteCount = 500; 
        enemies.formationLeftRight = 4;
        enemies.formationOffsetX = 0;
        enemies.formationOffsetBreath = 1;
        enemies.formationBreathOut = true;
        particles.particle = [];
        ai = { fireTimer: 5000 };
    }

    function run() {
        if (!attractMode) {
            let options = LocalOptions.persistence.getOptions();
            stats.highScore = LocalScores.persistence.getHighScore();
            for (let i = 0; i < options.length; i++) {
                let option = options[i];
                if (option.action === "left") {
                    myKeyboard.register(option.key, function() { moveFighterLeft(fighter, 1); });
                } else if (option.action === "right") {
                    myKeyboard.register(option.key, function() { moveFighterRight(fighter, 1); });
                } else if (option.action === "fire") {
                    myKeyboard.register(option.key, function() { fireTorpedo(fighter, torpedos, stats, sound); });
                    myKeyboard.setFireKey(option.key);
                }
            }
            torpedos.noLimit = !LocalOptions.persistence.getTorpedoLimit();
            if (stats.stage.currentStage === 1) {
                let theme = sound.theme;
                if (theme.isReady) {
                    theme.play();
                }
            }
        } else {
            torpedos.noLimit = false;
            canvas.addEventListener('mousedown', endGame);            
            canvas.addEventListener('keydown', endGame);
            canvas.addEventListener('mousemove', endGame);
        }
        
        lastTimeStamp = performance.now();
        cancelNextRequest = false;
        quit = false;
        requestAnimationFrame(gameLoop);
    }

    function endGame() {
        cancelNextRequest = true;
        // Iframe: notificar al padre, resetear, mostrar high-scores del canvas
        // El jugador ve su score y puede reiniciar desde ahí o esperar el veredicto.
        if (window.self !== window.top) {
            if (typeof _send === 'function') {
                _send({ type: 'GAME_OVER', score: stats.score });
            } else {
                window.parent.postMessage({ type: 'GAME_OVER', score: stats.score }, '*');
            }
            saveScoreValue(stats.score);
            resetGame();
            if (game && game.showScreen) game.showScreen('high-scores');
            return;
        }
        if (attractMode) {
            canvas.removeEventListener('mousedown', endGame);
            canvas.removeEventListener('keydown', endGame);
            canvas.removeEventListener('mousemove', endGame);
            attractMode = false;
            game.showScreen('main-menu');
        } else if (quit) {
            game.showScreen('main-menu');
        } else {
            saveScoreValue(stats.score);
            game.showScreen('high-scores');
        }
        resetGame();
    }

    return {
        initialize : initialize,
        run : run
    };

}(MyGame.game, MyGame.input, MyGame.graphics, MyGame.images, MyGame.sounds));
