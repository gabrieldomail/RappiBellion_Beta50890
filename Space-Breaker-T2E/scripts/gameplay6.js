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
            invulnerableTimer: 1000, mobileMoveVal: 50};

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

            // Deferir showScreen para que game.js termine initialize() primero
            setTimeout(function() {
                if (game && game.showScreen) game.showScreen('game-play');
            }, 0);

            // ── AUTO-FIRE (mantener = disparo continuo) ────────────────────
            var _fireHeld     = false;
            var _fireInterval = null;

            function _startAutoFire() {
                if (_fireHeld) return;
                _fireHeld = true;
                if (!cancelNextRequest && fighter && !fighter.dead && stats.currentTime > 0)
                    fireTorpedo(fighter, torpedos, stats, sound);
                _fireInterval = setInterval(function() {
                    if (!cancelNextRequest && fighter && !fighter.dead && stats.currentTime > 0)
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
                    window.parent.postMessage({ type: 'SCORE_UPDATE', score: stats.score }, '*');
            }, 250);

            // ── Mensajes del padre ─────────────────────────────────────────
            window.addEventListener('message', function(ev) {
                var d = ev.data || {};

                if (d.type === 'START_MATCH') {
                    if (cancelNextRequest) {
                        if (game && game.showScreen) game.showScreen('game-play');
                        run();
                    }
                    return;
                }
                if (d.type === 'MATCH_ENDED') {
                    if (!cancelNextRequest) {
                        cancelNextRequest = true;
                        window.parent.postMessage({ type: 'GAME_OVER', score: stats.score }, '*');
                    }
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
                if (d.type === 'ATOMIC_PULSE') {
                    if (enemies && enemies.enemy) {
                        for (var i = 0; i < enemies.enemy.length; i++) {
                            var e = enemies.enemy[i];
                            if (typeof NeonFX !== 'undefined')
                                NeonFX.bigExplosion(e.center.x, e.center.y, e.type);
                            addScore(stats, e);
                        }
                        enemies.enemy = [];
                    }
                    if (typeof NeonFX !== 'undefined') {
                        NeonFX.flash       = Math.max(NeonFX.flash,       0.92);
                        NeonFX.screenShake = Math.max(NeonFX.screenShake, 38);
                        NeonFX.slowmo      = Math.max(NeonFX.slowmo,      220);
                    }
                    window.parent.postMessage({ type: 'BOOST_USED' }, '*');
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
            window.parent.postMessage({ type: 'GAME_OVER', score: stats.score }, '*');
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
