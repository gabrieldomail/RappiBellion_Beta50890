(function () {
    "use strict";
    
    var display, demo, animations, sounds, scores,
        score, food, fruit, ghosts, blob,
        animation, startTime, actions, shortcuts,
        soundFiles  = [ "start", "death", "eat1", "eat2", "kill" ],

        // ── PvP: detectar rol del jugador desde la URL ──
        // P1 juega con WASD | P2 con flechas | standalone usa ambos
        pvpPlayer = (new URLSearchParams(window.location.search)).get("player"),

        // Códigos separados por jugador para evitar conflicto de teclado
        specialKeys = (function() {
            var keys = { "8": "BS", "13": "Enter" };
            if (pvpPlayer === "p1") {
                // P1: solo WASD
                keys["65"] = "Left";   // A
                keys["87"] = "Up";     // W
                keys["68"] = "Right";  // D
                keys["83"] = "Down";   // S
            } else if (pvpPlayer === "p2") {
                // P2: solo flechas
                keys["37"] = "Left";
                keys["38"] = "Up";
                keys["39"] = "Right";
                keys["40"] = "Down";
            } else {
                // Standalone (sin parámetro): ambos sets (comportamiento original)
                keys["37"] = "Left";  keys["65"] = "Left";
                keys["38"] = "Up";    keys["87"] = "Up";
                keys["39"] = "Right"; keys["68"] = "Right";
                keys["40"] = "Down";  keys["83"] = "Down";
            }
            return keys;
        }());
    
    
    
    /**
     * Calls the Game Over animation and then deletes the game data
     */
    function gameOver() {
        display.set("ready");
        animations.gameOver(() => {
            food   = null;
            fruit  = null;
            ghosts = null;
            blob   = null;
            
            Board.clearAll();
            display.set("gameOver").show();
            scores.setInput();
        });
    }
    
    /**
     * Creates the Blob and the Ghosts, and starts the Ready animation
     * @param {boolean} newLife
     */
    function createPlayers(newLife) {
        ghosts = new Ghosts(newLife ? ghosts : null);
        blob   = new Blob();
        
        blob.draw();
        ghosts.draw();
        animations.ready(() => display.set("playing"));
    }
    
    
    /**
     * Called when the Blob enters a new tile
     */
    function blobEating() {
        let tile   = blob.getTile(),
            atPill = food.isAtPill(tile);
        
        if (atPill) {
            let value = food.eatPill(tile),
                total = food.getLeftPills();
            
            fruit.add(total);
            score.pill(value);
            ghosts.resetPenTimer();
            ghosts.checkElroyDots(total);
            
            if (value === Data.energizerValue) {
                ghosts.frighten(blob);
            }
            sounds[blob.getSound()]();
        
        } else if (fruit.isAtPos(tile)) {
            let text = score.fruit();
            fruit.eat();
            animations.fruitScore(text, Board.fruitTile);
        }
        blob.onEat(atPill, ghosts.areFrighten());
    }
    
    /**
     * Called to do the crash etween a ghost and th blob
     */
    function ghostCrash() {
        ghosts.crash(blob.getTile(), (eyesCounter, tile) => {
            let text = score.kill(eyesCounter);
            animations.ghostScore(text, tile);
            sounds.kill();
        }, () => {
            Board.clearGame();
            animations.death(blob, newLife);
            sounds.death();
        });
    }
    
    
    /**
     * Called after the Blob dies
     */
    function newLife() {
        if (!score.died()) {
            gameOver();
        } else {
            display.set("ready");
            createPlayers(true);
        }
    }
    
    /**
     * Called after we get to a new level
     */
    function newLevel() {
        animations.newLevel(score.getLevel(), () => {
            food  = new Food();
            fruit = new Fruit();
            
            Board.clearGame();
            food.draw();
            score.draw();
            createPlayers(false);
        });
    }
    
    
    /**
     * Request an animation frame
     */
    function requestAnimation() {
        startTime = new Date().getTime();
        animation = window.requestAnimationFrame(() => {
            let time  = new Date().getTime() - startTime;

            // ══════════════════════════════════════════
            //  MODO APOCALIPSIS — VELOCIDAD PROGRESIVA
            //  Emparentado con el timer del FP (START_MATCH)
            // ══════════════════════════════════════════
            const _elapsed    = window._hackerStartTime ? (Date.now() - window._hackerStartTime) / 1000 : 0;
            const _offsetSecs = 240;  // arrancar en el equivalente al minuto 4
            const _minDiv     = 5;    // velocidad máxima (infierno puro)
            const _maxDiv     = 16;   // velocidad base
            const _rampSecs   = 480;  // 8 minutos de rampa total
            const _progress   = Math.min((_elapsed + _offsetSecs) / _rampSecs, 1);
            const _curve      = Math.pow(_progress, 2.5);
            const _divisor    = _maxDiv - (_curve * (_maxDiv - _minDiv));

            // Clamp speed instead of recursing — recursive calls at high chaos
            // caused call-stack growth that made Pacman disappear and freeze the loop.
            const _speedCap = 4 + (_curve * 4); // progressive cap: 4 at 0% chaos → 8 at 100%
            let speed = Math.min(time / _divisor, _speedCap);

            // Notificar nivel de caos al HUD padre (~2% de frames)
            if (window._hackerStartTime && window.parent && window.parent !== window && Math.random() < 0.02) {
                window.parent.postMessage({
                    type: 'CHAOS_LEVEL',
                    level: Math.round(_curve * 100),
                    divisor: Math.round(_divisor * 10) / 10,
                    elapsed: Math.round(_elapsed)
                }, '*');
            }
            
            if (display.isMainScreen()) {
                demo.animate(time, speed);
            } else if (animations.isAnimating()) {
                animations.animate(time);
            } else if (display.isPlaying()) {
                Board.clearGame();
                food.wink();
                fruit.reduceTimer(time);
                ghosts.animate(time, speed, blob);
                let newTile = blob.animate(speed);
                animations.animate(time);
                
                if (newTile) {
                    ghosts.setTargets(blob);
                    blobEating();
                }
                if (food.getLeftPills() === 0) {
                    score.newLevel();
                    animations.endLevel(newLevel);
                }
                ghostCrash();
            }
            requestAnimation();
        });
    }
    
    /**
     * Cancel an animation frame
     */
    function cancelAnimation() {
        window.cancelAnimationFrame(animation);
    }
   
    
    /**
     * Starts a new Game
     */
    function newGame() {
        display.set("ready").show();
        cancelAnimation();
        
        score = new Score();
        food  = new Food();
        fruit = new Fruit();
        
        demo.destroy();
        Board.drawBoard();
        food.draw();
        score.draw();
        
        createPlayers(false);
        requestAnimation();
        sounds.start();
    }
    
    /**
     * Toggles the Game Pause
     */
    function togglePause() {
        if (display.isPaused()) {
            display.set("playing");
            animations.endAll();
        } else {
            display.set("paused");
            animations.paused();
        }
    }
    
    /**
     * Show the High Scores
     */
    function showHighScores() {
        display.set("highScores").show();
        scores.show();
    }
    
    /**
     * Saves the High Score
     */
    function saveHighScore() {
        if (scores.save(score.getLevel(), score.getScore())) {
            showHighScores();
        }
    }
    
    
    
    /**
     * Creates a shortcut object
     */
    function createActionsShortcuts() {
        actions = {
            play       : () => newGame(),
            highScores : () => showHighScores(),
            help       : () => display.set("help").show(),
            sound      : () => sounds.toggle(),
            save       : () => saveHighScore(),
            retore     : () => scores.restore(),
            mainScreen : () => display.set("mainScreen").show()
        };
        
        shortcuts = {
            mainScreen : {
                Enter : "play",
                Down  : "play",
                H     : "highScores",
                C     : "help",
                M     : "sound"
            },
            playing : {
                P     : () => togglePause(),
                M     : () => sounds.toggle(),
                Left  : () => blob.makeTurn({ x: -1, y:  0 }),
                Up    : () => blob.makeTurn({ x:  0, y: -1 }),
                Right : () => blob.makeTurn({ x:  1, y:  0 }),
                Down  : () => blob.makeTurn({ x:  0, y:  1 })
            },
            paused : {
                P     : () => togglePause()
            },
            gameOver : {
                Enter : () => saveHighScore(),
                B     : () => display.set("mainScreen").show()
            },
            highScores : {
                B     : () => display.set("mainScreen").show(),
                R     : () => scores.restore()
            },
            help : {
                B     : () => display.set("mainScreen").show()
            }
        };
    }
    
    /**
     * Stores the used DOM elements and initializes the Event Handlers
     */
    function initDomListeners() {
        document.body.addEventListener("click", (e) => {
            let element = Utils.getTarget(e);
            if (actions[element.dataset.action]) {
                actions[element.dataset.action](element.dataset.data || undefined);
                e.preventDefault();
            }
        });
        
        document.addEventListener("keydown", (e) => {
            var key  = e.keyCode,
                code = specialKeys[key] || String.fromCharCode(key);
            
            if (shortcuts[display.get()] && shortcuts[display.get()][code]) {
                if (typeof shortcuts[display.get()][code] === "string") {
                    actions[shortcuts[display.get()][code]]();
                } else {
                    shortcuts[display.get()][code]();
                }
                e.preventDefault();
            }
        });

        // ── TOUCH CONTROLS — swipe + one-touch + D-PAD ──
        var _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;

        document.addEventListener('touchstart', function(e) {
            _touchStartX    = e.touches[0].clientX;
            _touchStartY    = e.touches[0].clientY;
            _touchStartTime = Date.now();
        }, { passive: false });

        // Bloquear scroll solo mientras se juega
        document.addEventListener('touchmove', function(e) {
            if (display.isPlaying()) e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
            var touchEndX = e.changedTouches[0].clientX;
            var touchEndY = e.changedTouches[0].clientY;
            var dx        = touchEndX - _touchStartX;
            var dy        = touchEndY - _touchStartY;
            var absDx     = Math.abs(dx);
            var absDy     = Math.abs(dy);
            var elapsed   = Date.now() - _touchStartTime;
            var minSwipe  = 20;
            var maxTap    = 200;

            // Pantalla principal — tap arranca el juego
            if (display.isMainScreen()) {
                actions['play']();
                return;
            }

            // Si D-PAD activo — ignorar swipe/onetouch
            if (window._controlMode === 'dpad') return;

            // ONE TOUCH — tap rápido
            if (elapsed < maxTap && absDx < minSwipe && absDy < minSwipe) {
                if (!display.isPlaying()) return;
                var W  = window.innerWidth;
                var H  = window.innerHeight;
                var tx = _touchStartX - W / 2;
                var ty = _touchStartY - H / 2;
                var _zone = null;
                if (Math.abs(tx) > Math.abs(ty)) {
                    if (tx > 0) { shortcuts.playing.Right(); _zone = document.querySelector('.tz-right'); }
                    else        { shortcuts.playing.Left();  _zone = document.querySelector('.tz-left');  }
                } else {
                    if (ty > 0) { shortcuts.playing.Down(); _zone = document.querySelector('.tz-down'); }
                    else        { shortcuts.playing.Up();   _zone = document.querySelector('.tz-up');   }
                }
                if (_zone) {
                    _zone.classList.add('active');
                    setTimeout(function() { _zone.classList.remove('active'); }, 150);
                }
                return;
            }

            // SWIPE
            if (absDx < minSwipe && absDy < minSwipe) return;
            if (!display.isPlaying()) return;
            if (absDx > absDy) {
                if (dx > 0) shortcuts.playing.Right();
                else        shortcuts.playing.Left();
            } else {
                if (dy > 0) shortcuts.playing.Down();
                else        shortcuts.playing.Up();
            }
        }, { passive: true });

        // ── D-PAD — solo mobile ──
        if ('ontouchstart' in window) {
            var _dpad = document.createElement('div');
            _dpad.id  = 'dpad';
            _dpad.innerHTML =
                '<button class="dp dp-up"    id="dp-up">▲</button>' +
                '<div class="dp-mid">' +
                    '<button class="dp dp-left"  id="dp-left">◀</button>' +
                    '<div class="dp-center"></div>' +
                    '<button class="dp dp-right" id="dp-right">▶</button>' +
                '</div>' +
                '<button class="dp dp-down"  id="dp-down">▼</button>';

            var _dstyle = document.createElement('style');
            _dstyle.textContent =
                '#dpad{position:fixed;bottom:24px;right:20px;z-index:200;' +
                    'display:none;flex-direction:column;align-items:center;gap:4px;opacity:0.75;}' +
                '#dpad.show{display:flex;}' +

                '.dp-mid{display:flex;align-items:center;gap:4px;}' +
                '.dp-center{width:44px;height:44px;background:rgba(0,0,0,0.5);' +
                    'border:1px solid rgba(0,255,255,0.15);}' +

                '.dp{width:64px;height:64px;background:rgba(5,10,15,0.82);' +
                    'border:2px solid rgba(0,255,255,0.5);color:rgba(0,255,255,0.9);' +
                    'font-size:26px;font-weight:900;font-family:"Orbitron",monospace;' +
                    'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
                    'text-shadow:0 0 8px rgba(0,255,255,0.8);border-radius:8px;' +
                    'box-shadow:0 0 10px rgba(0,255,255,0.2),inset 0 0 10px rgba(0,0,0,0.5);' +
                    '-webkit-tap-highlight-color:transparent;user-select:none;transition:all 0.08s;}' +

                '.dp:active,.dp.pressed{background:rgba(0,255,255,0.25);color:#fff;' +
                    'border-color:rgba(0,255,255,0.9);transform:scale(0.92);' +
                    'box-shadow:0 0 20px rgba(0,255,255,0.6),inset 0 0 15px rgba(0,255,255,0.15);' +
                    'text-shadow:0 0 16px #fff,0 0 32px rgba(0,255,255,1);}';

            document.head.appendChild(_dstyle);
            document.body.appendChild(_dpad);

            window._controlMode = null;

            function _dpadShow() { _dpad.classList.add('show'); }
            function _dpadHide() { _dpad.classList.remove('show'); }

            function _dpadFire(dir, btn) {
                if (!display.isPlaying()) return;
                if (shortcuts.playing && shortcuts.playing[dir]) shortcuts.playing[dir]();
                btn.classList.add('pressed');
                setTimeout(function() { btn.classList.remove('pressed'); }, 120);
            }

            var _dpMap = [
                { id:'dp-up',    dir:'Up'    },
                { id:'dp-down',  dir:'Down'  },
                { id:'dp-left',  dir:'Left'  },
                { id:'dp-right', dir:'Right' }
            ];
            var _lastDpDir = null;

            function _getDpFromTouch(touch) {
                var el = document.elementFromPoint(touch.clientX, touch.clientY);
                while (el && !el.classList.contains('dp')) el = el.parentElement;
                return el;
            }

            _dpMap.forEach(function(m) {
                var btn = document.getElementById(m.id);
                if (!btn) return;
                btn.addEventListener('touchstart', function(e) {
                    if (!display.isPlaying()) return;
                    e.preventDefault();
                    e.stopPropagation();
                    _lastDpDir = m.dir;
                    _dpadFire(m.dir, btn);
                }, { passive: false });
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    _dpadFire(m.dir, btn);
                });
            });

            document.addEventListener('touchmove', function(e) {
                if (!display.isPlaying()) return;
                if (!_dpad.classList.contains('show')) return;
                var touch = e.touches[0];
                var btn   = _getDpFromTouch(touch);
                if (!btn) return;
                var newDir = null;
                _dpMap.forEach(function(m) {
                    if (document.getElementById(m.id) === btn) newDir = m.dir;
                });
                if (newDir && newDir !== _lastDpDir) {
                    _lastDpDir = newDir;
                    _dpadFire(newDir, btn);
                }
            }, { passive: false });

            document.addEventListener('touchend', function(e) {
                _lastDpDir = null;
                _dpMap.forEach(function(m) {
                    var b = document.getElementById(m.id);
                    if (b) b.classList.remove('pressed');
                });
            }, { passive: false });

            // Escuchar SET_CONTROL desde el padre
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'SET_CONTROL') {
                    window._controlMode = e.data.mode;
                    if (e.data.mode === 'dpad') _dpadShow();
                    else                        _dpadHide();
                }
            });
        }

        // PvP BOOST: frighten ghosts when HACK IT button is used
        // pvp-bridge.js dispatches this event via document.dispatchEvent(new CustomEvent("pvpBoost"))
        document.addEventListener('pvpBoost', function() {
            if (display.isPlaying() && ghosts && blob) {
                ghosts.frighten(blob);
            }
        });
    }
    
    /**
     * Destroys the demo when the display changes
     */
    function onShow() {
        if (!display.isMainScreen()) {
            demo.destroy();
        }
    }
    
    /**
     * The main Function
     */
    function main() {
        Board.create();
        display    = new Display(onShow);
        demo       = new Demo();
        animations = new Animations();
        sounds     = new Sounds(soundFiles, "pacman.sound", true);
        scores     = new HighScores();
        
        createActionsShortcuts();
        initDomListeners();
        requestAnimation();
    }
    
    
    // Load the game
    window.addEventListener("load", function() {
        main();

        // ── PvP: auto-arrancar cuando está en iframe ──
        // Si viene con ?player=p1 o ?player=p2, saltar el menú
        // y esperar la señal START_MATCH del padre (o arrancar tras 200ms)
        if (pvpPlayer === "p1" || pvpPlayer === "p2") {

            // Escuchar la señal de inicio sincronizado desde el HUD padre
            window.addEventListener("message", function(e) {
                var d = e.data;
                if (!d || !d.type) return;

                if (d.type === "START_MATCH") {
                    // Marcar el inicio del timer de caos (sincronizado con el FP timer)
                    window._hackerStartTime = Date.now();
                    // Arrancar el juego
                    if (display.isMainScreen()) {
                        newGame();
                    }
                }
                if (d.type === "MATCH_ENDED") {
                    // Pausar cuando termina el tiempo
                    if (display.isPlaying()) {
                        display.set("paused");
                        animations.paused();
                    }
                }
            });
        }
    }, false);
    
}());
