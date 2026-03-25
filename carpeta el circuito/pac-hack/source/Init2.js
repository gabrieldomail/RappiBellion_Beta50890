(function () {
    "use strict";
    
    var display, demo, animations, sounds, scores,
        score, food, fruit, ghosts, blob,
        animation, startTime, actions, shortcuts,
        soundFiles  = [ "start", "death", "eat1", "eat2", "kill" ],
        specialKeys = {
            "8"  : "BS",
            "13" : "Enter",
            "37" : "Left",
            "65" : "Left",
            "38" : "Up",
            "87" : "Up",
            "39" : "Right",
            "68" : "Right",
            "40" : "Down",
            "83" : "Down"
        };
    
    
    
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
            //  Empieza suave... termina siendo un infierno
            // ══════════════════════════════════════════
            if (!window._hackerStartTime) window._hackerStartTime = Date.now();
            const _elapsed  = (Date.now() - window._hackerStartTime) / 1000; // segundos jugados
            
            // ── ARRANCA EN EL EQUIVALENTE AL MINUTO 4 — sin aburrimiento ──
            // Sumamos 240s al elapsed para saltar los primeros 4 minutos aburridos
            const _offsetSecs = 240;  // offset: empezar en minuto 4
            const _minDiv     = 5;    // velocidad máxima (infierno puro)
            const _maxDiv     = 16;   // velocidad base (lo que sería minuto 0)
            const _rampSecs   = 480;  // 8 minutos de rampa total
            const _progress   = Math.min((_elapsed + _offsetSecs) / _rampSecs, 1);
            // Curva exponencial: ya arranca con impulso, brutal al final
            const _curve      = Math.pow(_progress, 2.5);
            const _divisor    = _maxDiv - (_curve * (_maxDiv - _minDiv));

            let speed = time / _divisor;

            // Límite progresivo también
            const _speedCap = 5 + (_curve * 6); // de 5 a 11
            if (speed > _speedCap) {
                return requestAnimation();
            }

            // Notificar al HUD padre el nivel de caos actual (0-100%)
            if (window.parent && window.parent !== window && Math.random() < 0.02) {
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

        // ── TOUCH CONTROLS — swipe + one-touch para mobile ──
        var _touchStartX = 0, _touchStartY = 0;
        var _touchStartTime = 0;

        // Bloquear scroll mientras se juega
        document.addEventListener('touchstart', function(e) {
            _touchStartX    = e.touches[0].clientX;
            _touchStartY    = e.touches[0].clientY;
            _touchStartTime = Date.now();
        }, { passive: false });

        document.addEventListener('touchmove', function(e) {
            if (!display.isMainScreen()) e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', function(e) {
            var touchEndX  = e.changedTouches[0].clientX;
            var touchEndY  = e.changedTouches[0].clientY;
            var dx         = touchEndX - _touchStartX;
            var dy         = touchEndY - _touchStartY;
            var absDx      = Math.abs(dx);
            var absDy      = Math.abs(dy);
            var elapsed    = Date.now() - _touchStartTime;
            var minSwipe   = 20;   // px para swipe
            var maxTap     = 200;  // ms para considerar tap

            // Pantalla principal — cualquier tap/swipe arranca el juego
            if (display.isMainScreen()) {
                actions['play']();
                return;
            }

            // ── ONE TOUCH — tap rápido (<200ms, movimiento <20px) ──
            // Divide la pantalla en 4 zonas triangulares desde el centro
            if (elapsed < maxTap && absDx < minSwipe && absDy < minSwipe) {
                var W  = window.innerWidth;
                var H  = window.innerHeight;
                var cx = W / 2;
                var cy = H / 2;
                var tx = _touchStartX - cx; // relativo al centro
                var ty = _touchStartY - cy;

                // One-touch — solo si no está en modo dpad
                if (window._controlMode === 'dpad') return;
                var _zone = null;
                if (Math.abs(tx) > Math.abs(ty)) {
                    if (tx > 0) { if (shortcuts.playing) shortcuts.playing.Right(); _zone = document.querySelector('.tz-right'); }
                    else        { if (shortcuts.playing) shortcuts.playing.Left();  _zone = document.querySelector('.tz-left');  }
                } else {
                    if (ty > 0) { if (shortcuts.playing) shortcuts.playing.Down(); _zone = document.querySelector('.tz-down'); }
                    else        { if (shortcuts.playing) shortcuts.playing.Up();   _zone = document.querySelector('.tz-up');   }
                }
                // Flash de la zona tocada
                if (_zone) {
                    _zone.classList.add('active');
                    setTimeout(function() { _zone.classList.remove('active'); }, 150);
                }
                return;
            }

            // ── SWIPE — solo si no está en modo dpad ──
            if (window._controlMode === 'dpad') return;
            if (absDx < minSwipe && absDy < minSwipe) return;

            if (absDx > absDy) {
                if (dx > 0) { if (shortcuts.playing) shortcuts.playing.Right(); }
                else        { if (shortcuts.playing) shortcuts.playing.Left();  }
            } else {
                if (dy > 0) { if (shortcuts.playing) shortcuts.playing.Down(); }
                else        { if (shortcuts.playing) shortcuts.playing.Up();   }
            }
        }, { passive: true });

        // ── D-PAD JOYSTICK — fijo abajo derecha (solo mobile) ──
        if ('ontouchstart' in window) {
            var _dpad = document.createElement('div');
            _dpad.id  = 'dpad';
            _dpad.innerHTML =
                // Grupo izquierdo: ▲ arriba, ◀ abajo-izquierda — L izquierda
                '<div id="dp-left-group">' +
                    '<div class="dp-row">' +
                        '<button class="dp dp-up"   id="dp-up">▲</button>' +
                        '<div class="dp-spacer"></div>' +
                    '</div>' +
                    '<div class="dp-row">' +
                        '<button class="dp dp-left" id="dp-left">◀</button>' +
                        '<div class="dp-spacer"></div>' +
                    '</div>' +
                '</div>' +
                // Grupo derecho: ▶ arriba-derecha, ▼ abajo — L derecha invertida
                '<div id="dp-right-group">' +
                    '<div class="dp-row">' +
                        '<div class="dp-spacer"></div>' +
                        '<button class="dp dp-right" id="dp-right">▶</button>' +
                    '</div>' +
                    '<div class="dp-row">' +
                        '<div class="dp-spacer"></div>' +
                        '<button class="dp dp-down"  id="dp-down">▼</button>' +
                    '</div>' +
                '</div>';

            var _dstyle = document.createElement('style');
            _dstyle.textContent =
                '#dpad{pointer-events:none;}' +

                /* Grupo izquierdo — esquina inferior izquierda */
                '#dp-left-group{' +
                    'position:fixed;bottom:88px;left:16px;z-index:200;' +
                    'display:none;flex-direction:column;gap:4px;' +
                    'opacity:0.75;pointer-events:auto;' +
                '}' +
                '#dp-left-group.show{display:flex;}' +

                /* Grupo derecho — esquina inferior derecha */
                '#dp-right-group{' +
                    'position:fixed;bottom:20px;right:16px;z-index:200;' +
                    'display:none;flex-direction:column;gap:4px;' +
                    'opacity:0.75;pointer-events:auto;' +
                '}' +
                '#dp-right-group.show{display:flex;}' +

                /* Fila interna de cada grupo */
                '.dp-row{display:flex;gap:4px;align-items:center;}' +

                /* Espaciador — ocupa el lugar del botón ausente */
                '.dp-spacer{width:64px;height:64px;}' +

                /* Botones */
                '.dp{' +
                    'width:64px;height:64px;' +
                    'background:rgba(5,10,15,0.82);' +
                    'border:2px solid rgba(0,255,255,0.5);' +
                    'color:rgba(0,255,255,0.9);' +
                    'font-size:26px;font-weight:900;' +
                    'font-family:"Orbitron",monospace;' +
                    'display:flex;align-items:center;justify-content:center;' +
                    'cursor:pointer;' +
                    'text-shadow:0 0 8px rgba(0,255,255,0.8);' +
                    'box-shadow:0 0 10px rgba(0,255,255,0.2),inset 0 0 10px rgba(0,0,0,0.5);' +
                    '-webkit-tap-highlight-color:transparent;' +
                    'user-select:none;' +
                    'transition:all 0.08s;' +
                    'border-radius:8px;' +
                '}' +

                /* Activo */
                '.dp:active,.dp.pressed{' +
                    'background:rgba(0,255,255,0.25);' +
                    'color:#fff;' +
                    'border-color:rgba(0,255,255,0.9);' +
                    'box-shadow:0 0 20px rgba(0,255,255,0.6),inset 0 0 15px rgba(0,255,255,0.15);' +
                    'text-shadow:0 0 16px #fff,0 0 32px rgba(0,255,255,1);' +
                    'transform:scale(0.92);' +
                '}';

            document.head.appendChild(_dstyle);
            document.body.appendChild(_dpad);

            // Mostrar/ocultar con el juego
            function _dpadShow() {
                var lg = document.getElementById('dp-left-group');
                var rg = document.getElementById('dp-right-group');
                if (lg) lg.classList.add('show');
                if (rg) rg.classList.add('show');
            }
            function _dpadHide() {
                var lg = document.getElementById('dp-left-group');
                var rg = document.getElementById('dp-right-group');
                if (lg) lg.classList.remove('show');
                if (rg) rg.classList.remove('show');
            }

            // Función para disparar dirección con feedback visual
            function _dpadFire(dir, btn) {
                if (shortcuts.playing && shortcuts.playing[dir]) {
                    shortcuts.playing[dir]();
                }
                btn.classList.add('pressed');
                setTimeout(function() { btn.classList.remove('pressed'); }, 120);
            }

            // Conectar botones con touchstart + touchmove para evitar inputs colgados
            var _dpMap = [
                { id:'dp-up',    dir:'Up'    },
                { id:'dp-down',  dir:'Down'  },
                { id:'dp-left',  dir:'Left'  },
                { id:'dp-right', dir:'Right' }
            ];

            var _lastDpDir = null; // última dirección disparada

            function _getDpFromTouch(touch) {
                // Detectar sobre qué botón está el dedo usando elementFromPoint
                var el = document.elementFromPoint(touch.clientX, touch.clientY);
                if (!el) return null;
                // Buscar el botón dp más cercano
                while (el && !el.classList.contains('dp')) {
                    el = el.parentElement;
                }
                return el;
            }

            _dpMap.forEach(function(m) {
                var btn = document.getElementById(m.id);
                if (!btn) return;

                btn.addEventListener('touchstart', function(e) {
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

            // touchmove — detectar si el dedo se mueve a otro botón
            document.addEventListener('touchmove', function(e) {
                if (!document.getElementById('dp-topleft').classList.contains('show')) return;
                e.preventDefault();
                e.stopPropagation();
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

            // touchend — limpiar estado
            document.addEventListener('touchend', function(e) {
                e.preventDefault();
                _lastDpDir = null;
                // Quitar pressed de todos
                _dpMap.forEach(function(m) {
                    var b = document.getElementById(m.id);
                    if (b) b.classList.remove('pressed');
                });
            }, { passive: false });

            // D-pad se muestra solo si el jugador lo eligió
            window._controlMode = null; // 'dpad' o 'swipe'

            function _applyControlMode(mode) {
                window._controlMode = mode;
                if (mode === 'dpad') {
                    _dpadShow();
                } else {
                    _dpadHide();
                }
            }

            // Escuchar SET_CONTROL desde el contenedor padre
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'SET_CONTROL') {
                    _applyControlMode(e.data.mode);
                }
            });
        }
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
    window.addEventListener("load", main, false);
    
}());
