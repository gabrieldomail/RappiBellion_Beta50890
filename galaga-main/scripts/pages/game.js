// ------------------------------------------------------------------
// 
// This is the game object.  Everything about the game is located in 
// this object.
//
// ------------------------------------------------------------------

// Estado global expuesto para que render.js pueda leer boost
let MyGameState = { boostActive: 0 };

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

    // >>> NEW: postMessage Rappibellion
    const isInIframe = window.self !== window.top;
    let lastReportedScore = -1;
    function postParent(type, payload) {
        if (!isInIframe) return;
        try {
            window.parent.postMessage(Object.assign({ type: type }, payload || {}), '*');
        } catch (e) {}
    }
    setInterval(() => {
        if (!cancelNextRequest && stats.score !== lastReportedScore) {
            lastReportedScore = stats.score;
            postParent('SCORE_UPDATE', { score: stats.score });
        }
    }, 250);
     window.addEventListener('message', (ev) => {
         const data = ev.data || {};
         const type = data.type || data;
         if (type === 'TRIGGER_BOOST') {
             MyGameState.boostActive = 6000;
             if (fighter) {
                 fighter.invulnerableTimer = Math.max(fighter.invulnerableTimer || 0, 6000);
             }
             spawnPopup('>> BOOST_HACK_ON', canvas.width / 2, canvas.height / 2,
                 '#FFD700', 48, 1500);
         }
     });
    // <<< NEW

    function processInput(elapsedTime) {
        myKeyboard.update(elapsedTime);
    }

    function update(elapsedTime) {
        // >>> NEW: slow-mo
        if (MyGameFX.slowmo > 0) elapsedTime *= 0.55;
        // >>> NEW: boost timer
        if (MyGameState.boostActive > 0) MyGameState.boostActive -= elapsedTime;

        updateTime(elapsedTime, stats, fighter);
        if (fighter.lives !== 0) {
            updateBackgroundStars(elapsedTime, backgroundStars);
            updateEnemies(elapsedTime, enemies, stats, torpedos, fighter, sound);
            updateTorpedos(elapsedTime, torpedos);
            updateFighterMobile(elapsedTime, fighter);

            // >>> NEW: engine trail
            if (!fighter.dead && Math.random() < 0.6) {
                createEngineTrail(particles, fighter);
            }
            // >>> NEW: auto-fire de boost
            if (MyGameState.boostActive > 0) {
                fighter._autoFireT = (fighter._autoFireT || 0) - elapsedTime;
                if (fighter._autoFireT <= 0) {
                    fireTorpedo(fighter, torpedos, stats, sound);
                    fighter._autoFireT = 90;
                }
            }
        }
        if (attractMode) {
            updateAI(elapsedTime, ai, fighter, enemies, torpedos, stats, sound);
            if (stats.stage.currentStage === 3) endGame();
        }
        checkCollisions(torpedos, fighter, enemies, stats, particles, sound);
        updateParticles(particles.particle, elapsedTime);
        updateGlobalFX(elapsedTime); // >>> NEW
        checkEndStage(enemies, stats, fighter, elapsedTime, sound);
        if (fighter.lives === 0 && stats.endGameTimer <= 0) endGame();
    }

    function render() {
        graphics.clear();
        graphics.beginFrame();           // >>> NEW: shake
        graphics.drawBackgroundStars(backgroundStars);
        graphics.drawScore(stats);
        graphics.drawLives(fighter);
        graphics.drawStage(stats.stage);
        graphics.drawEnemies(enemies);
        graphics.drawFighter(fighter);
        graphics.drawTorpedos(torpedos);
        graphics.drawParticles(particles);
        graphics.drawShockwaves();       // >>> NEW
        graphics.drawPopups();           // >>> NEW
        graphics.showStats(stats);
        graphics.endFrame();             // >>> NEW: flash + restore
    }

    function gameLoop(time) {
        let elapsedTime = time - lastTimeStamp;
        lastTimeStamp = time;
        processInput(elapsedTime);
        update(elapsedTime);
        render();
        if (!cancelNextRequest) requestAnimationFrame(gameLoop);
    }

    function initialize() {
        backgroundStars = { stars: [] };
        fighter = { lives: 3, img: images.loadFighter(), center: { x: 600, y: 1470 },
            size: { width: 80, height: 80 }, dead: false, deadTimer: 0,
            invulnerableTimer: 1000, mobileMoveVal: 50 };
        torpedos = { friendly: [], enemy: [], img1: images.loadTorpedo1(),
            img2: images.loadTorpedo2(), size: { width: 15, height: 40 }, noLimit: true };
        stats = { score: 0, totalTorpedosFired: 0, totalHits: 0, currentTime: 0,
            showPlayerStats: false, showPlayerResults: false, endGameTimer: 5000,
            highScore: LocalScores.persistence.getHighScore() };
        stats.stage = { currentStage: 1, stageTime: 0, showStageTimer: 5000,
            torpedosFired: 0, hits: 0, endingStage: false, endingStageTimer: 500,
            stageEnemies: getStage(1),
            badge1: images.loadBadge1(), badge5: images.loadBadge5(),
            badge10: images.loadBadge10(), badge20: images.loadBadge20(),
            badge30: images.loadBadge30(), badge50: images.loadBadge50() };
        enemies = { enemy: [], divingTimer: 17000,
            formationSprite: 0, formationSpriteCount: 500, formationLeftRight: 4,
            formationOffsetX: 0, formationOffsetBreath: 1, formationBreathOut: true,
            "bee": { size: { width: 54, height: 60 }, size2: { width: 78, height: 60 },
                images: [images.loadBee1(), images.loadBee2()] },
            "butterfly": { size: { width: 54, height: 60 }, size2: { width: 78, height: 60 },
                images: [images.loadButterfly1(), images.loadButterfly2()] },
            "boss": { size: { width: 90, height: 90 }, size2: { width: 90, height: 96 },
                images: [images.loadFullBoss1(), images.loadFullBoss2(),
                         images.loadHalfBoss1(), images.loadHalfBoss2()] },
            "bonus1": { size: { width: 96, height: 78 }, size2: { width: 78, height: 60 },
                images: [images.loadBonus1()] },
            "bonus2": { size: { width: 108, height: 90 }, size2: { width: 78, height: 60 },
                images: [images.loadBonus2()] },
            "bonus3": { size: { width: 84, height: 96 }, size2: { width: 78, height: 60 },
                images: [images.loadBonus3()] }
        };
        particles = { particle: [], imgSmoke: images.loadSmoke(),
            imgFire1: images.loadFire1(), imgFire2: images.loadFire2(),
            imgFireBlue: images.loadFireBlue(), imgFireGreen: images.loadFireBlue() };
        sound = { theme: sounds.loadTheme(), diving: sounds.loadDiving(),
            enemyDeath: sounds.loadEnemyDeath(), levelStart: sounds.loadLevel(),
            playerDeath: sounds.loadPlayerDeath(), bossHurt: sounds.loadBossHurt(),
            bossDeath: sounds.loadBossDeath(), fireTorpedo: [], fireTorpedoQueue: 0 };
        for (let i = 0; i < 10; i++) sound.fireTorpedo.push(sounds.loadTorpedo());
        ai = { fireTimer: 5000 };

        myKeyboard.register('Escape', function() { quit = true; endGame(); });
        canvas.addEventListener('click', function() {
            fireTorpedo(fighter, torpedos, stats, sound);
        });
        mobileSupport(fighter, torpedos, stats, sound);

        // >>> NEW: notificar al padre que estamos listos
        postParent('READY', { game: 'galaga-rappibellion' });
    }

     function resetGame() {
         backgroundStars = { stars: [] };
         fighter = { lives: 3, img: images.loadFighter(), center: { x: 600, y: 1470 },
             size: { width: 80, height: 80 }, dead: false, deadTimer: 0,
             invulnerableTimer: 1000, mobileMoveVal: 50 };
         torpedos = { friendly: [], enemy: [], img1: images.loadTorpedo1(),
             img2: images.loadTorpedo2(), size: { width: 15, height: 40 }, noLimit: true };
         stats = { score: 0, totalTorpedosFired: 0, totalHits: 0,
             currentTime: 0, showPlayerStats: false, showPlayerResults: false,
             endGameTimer: 5000, highScore: LocalScores.persistence.getHighScore() };
         stats.stage = { currentStage: 1, stageTime: 0, showStageTimer: 5000,
             torpedosFired: 0, hits: 0, endingStage: false, endingStageTimer: 500,
             stageEnemies: getStage(1),
             badge1: images.loadBadge1(), badge5: images.loadBadge5(),
             badge10: images.loadBadge10(), badge20: images.loadBadge20(),
             badge30: images.loadBadge30(), badge50: images.loadBadge50() };
         enemies = { enemy: [], divingTimer: 17000,
             formationSprite: 0, formationSpriteCount: 500, formationLeftRight: 4,
             formationOffsetX: 0, formationOffsetBreath: 1, formationBreathOut: true,
             "bee": { size: { width: 54, height: 60 }, size2: { width: 78, height: 60 },
                 images: [images.loadBee1(), images.loadBee2()] },
             "butterfly": { size: { width: 54, height: 60 }, size2: { width: 78, height: 60 },
                 images: [images.loadButterfly1(), images.loadButterfly2()] },
             "boss": { size: { width: 90, height: 90 }, size2: { width: 90, height: 96 },
                 images: [images.loadFullBoss1(), images.loadFullBoss2(),
                          images.loadHalfBoss1(), images.loadHalfBoss2()] },
             "bonus1": { size: { width: 96, height: 78 }, size2: { width: 78, height: 60 },
                 images: [images.loadBonus1()] },
             "bonus2": { size: { width: 108, height: 90 }, size2: { width: 78, height: 60 },
                 images: [images.loadBonus2()] },
             "bonus3": { size: { width: 84, height: 96 }, size2: { width: 78, height: 60 },
                 images: [images.loadBonus3()] }
         };
         particles = { particle: [], imgSmoke: images.loadSmoke(),
             imgFire1: images.loadFire1(), imgFire2: images.loadFire2(),
             imgFireBlue: images.loadFireBlue(), imgFireGreen: images.loadFireGreen() };
         sound = { theme: sounds.loadTheme(), diving: sounds.loadDiving(),
             enemyDeath: sounds.loadEnemyDeath(), levelStart: sounds.loadLevel(),
             playerDeath: sounds.loadPlayerDeath(), bossHurt: sounds.loadBossHurt(),
             bossDeath: sounds.loadBossDeath(), fireTorpedo: [], fireTorpedoQueue: 0 };
         for (let i = 0; i < 10; i++) sound.fireTorpedo.push(sounds.loadTorpedo());
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
                if (theme.isReady) theme.play();
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
        lastReportedScore = -1;
        postParent('START_MATCH'); // >>> NEW
        requestAnimationFrame(gameLoop);
    }

    function endGame() {
        cancelNextRequest = true;
        // >>> NEW: notificar fin de partida al padre
        postParent('GAME_OVER', { player: 'p1', score: stats.score });

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

    return { initialize: initialize, run: run };
}(MyGame.game, MyGame.input, MyGame.graphics, MyGame.images, MyGame.sounds));
