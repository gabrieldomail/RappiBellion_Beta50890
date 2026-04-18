/**
 * ═══════════════════════════════════════════════════
 *  RAPPIBELLION — PAC-HACK PvP BRIDGE v1.0
 *  Conector entre el juego Pac-Man y el HUD competitivo
 * ═══════════════════════════════════════════════════
 *
 *  CÓMO FUNCIONA:
 *  1. Lee el rol del jugador desde la URL: ?player=p1 o ?player=p2
 *  2. Detecta cambios de puntaje automáticamente (3 métodos)
 *  3. Envía postMessage() al HUD padre en cada cambio
 *  4. Escucha eventos del rival (boost, fin de partida)
 *
 *  INTEGRACIÓN EN game.html:
 *  Agregar antes del </body>:
 *  <script src="pvp-bridge.js"></script>
 * ═══════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ── 1. ROL DEL JUGADOR (desde URL) ──
  // El HUD carga el iframe así:
  // <iframe src="game.html?player=p1">  ← Jugador 1
  // <iframe src="game.html?player=p2">  ← Jugador 2
  const params = new URLSearchParams(window.location.search);
  const PLAYER = params.get('player') || 'p1';
  const IS_IFRAME = window.self !== window.top;

  // Si no estamos en un iframe, el bridge no hace nada
  if (!IS_IFRAME) {
    console.info('[PvP Bridge] Modo standalone — bridge inactivo');
    return;
  }

  console.info('[PvP Bridge] Activo como ' + PLAYER.toUpperCase());

  // ── 2. ESTADO ──
  let lastScore = 0;
  let boostsUsed = 0;
  let gameActive = false;
  let matchEnded = false;
  let pollInterval = null;

  // ── 3. DETECCIÓN DE PUNTAJE ──
  // Intentamos tres métodos, de más a menos específico:

  // MÉTODO A: Hook directo en Score.js
  // Si tu Score.js tiene una función como Score.add() o Score.set(),
  // podemos interceptarla aquí una vez que cargue.
  function tryHookScoreObject() {
    // Nombres comunes en implementaciones de Pac-Man JS
    // Ajustá según lo que veas en source/score/Score.js
    const candidates = [
      () => window.Score,
      () => window.score,
      () => window.GameScore,
      () => window.game && window.game.score,
    ];

    for (const getter of candidates) {
      try {
        const obj = getter();
        if (obj && typeof obj.get === 'function') {
          // Wrapeamos el método que actualiza
          const originalGet = obj.get.bind(obj);
          Object.defineProperty(obj, '_pvpHooked', { value: true, writable: false });
          console.info('[PvP Bridge] Hook en Score.get() exitoso');
          return true;
        }
      } catch(e) {}
    }
    return false;
  }

  // MÉTODO B: MutationObserver sobre el DOM
  // Si el score se renderiza como texto en algún elemento
  function tryObserveDOM() {
    // Selectores comunes donde se muestra el puntaje
    const selectors = [
      '.score', '#score', '[class*="score"]',
      '.points', '#points', '.hud-score',
      'canvas' // fallback — vemos cambios en canvas
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent !== undefined && el.tagName !== 'CANVAS') {
        const observer = new MutationObserver(() => {
          const val = parseInt(el.textContent.replace(/\D/g, ''), 10);
          if (!isNaN(val) && val !== lastScore) {
            onScoreChange(val);
          }
        });
        observer.observe(el, { childList: true, subtree: true, characterData: true });
        console.info('[PvP Bridge] MutationObserver activo en:', sel);
        return true;
      }
    }
    return false;
  }

  // MÉTODO C: Polling de variables globales (fallback seguro)
  // Busca el puntaje en las variables más comunes del juego
  function startPolling() {
    console.info('[PvP Bridge] Iniciando polling de score...');
    pollInterval = setInterval(() => {
      if (matchEnded) return;

      const score = readScoreFromGame();
      if (score !== null && score !== lastScore) {
        onScoreChange(score);
      }
    }, 150); // cada 150ms — suficientemente rápido sin ser costoso
  }

  function readScoreFromGame() {
    // ── AJUSTÁ ESTA LISTA según tu Score.js ──
    // Revisá source/score/Score.js y buscá la variable
    // donde se guarda el puntaje. Agregala acá arriba:
    const attempts = [
      // Patrones directos
      () => window.score,
      () => window.Score && window.Score.score,
      () => window.Score && window.Score.points,
      () => window.Score && window.Score.value,
      () => window.Score && window.Score.current,
      // Patrones de objeto de juego
      () => window.game && window.game.score,
      () => window.game && window.game.Score,
      () => window.Pacman && window.Pacman.score,
      // Patrones de Data.js (que está en tu proyecto)
      () => window.Data && window.Data.score,
      () => window.GameData && window.GameData.score,
    ];

    for (const attempt of attempts) {
      try {
        const val = attempt();
        if (typeof val === 'number' && !isNaN(val)) return val;
      } catch(e) {}
    }
    return null;
  }

  // ── 4. HANDLER DE CAMBIO DE PUNTAJE ──
  function onScoreChange(newScore) {
    lastScore = newScore;
    if (!matchEnded) {
      sendToParent({
        type: 'SCORE_UPDATE',
        player: PLAYER,
        score: newScore,
        boosts: boostsUsed,
      });
    }
  }

  // ── 5. BOOST / POWER-UP ──
  // Llamar esta función desde el juego cuando Pac-Man
  // come un power pellet (las bolitas grandes).
  // O conectarla manualmente en Food.js / Fruit.js
  window.PvPBridge = {

    // Llamar cuando se usa un boost (HACK IT button or ate a power pellet).
    // Also triggers fright mode in the pac-hack engine so it has a real game effect.
    onPowerPellet: function() {
      if (matchEnded) return;
      boostsUsed++;
      // === REAL GAME EFFECT: frighten all ghosts ====
      // Access the Ghosts singleton that Init.js creates and call frighten()
      try {
        // The ghosts variable is local to Init.js IIFE; we trigger via a custom event
        // that Init.js listens for, OR we simulate eating an energizer food tile.
        // Simplest reliable approach: dispatch a custom "pvpBoost" event on document.
        document.dispatchEvent(new CustomEvent('pvpBoost', { detail: { boostsUsed: boostsUsed } }));
      } catch(e) {}
      sendToParent({
        type: 'BOOST_USED',
        player: PLAYER,
        score: lastScore,
        boosts: boostsUsed,
      });
      console.info('[PvP Bridge] Boost enviado. Total:', boostsUsed);
    },

    // Llamar si el juego termina antes del timer del HUD
    onGameOver: function() {
      if (matchEnded) return;
      sendToParent({ type: 'GAME_OVER', player: PLAYER, score: lastScore });
    },

    // Forzar envío de score (por si necesitás llamarlo manualmente)
    reportScore: function(score) {
      onScoreChange(score);
    },

    // Debug: ver el score detectado actualmente
    debug: function() {
      console.table({
        player: PLAYER,
        lastScore: lastScore,
        boostsUsed: boostsUsed,
        matchEnded: matchEnded,
        detected: readScoreFromGame(),
      });
    }
  };

  // ── 6. ESCUCHAR MENSAJES DEL HUD PADRE ──
  window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.type) return;

    switch(data.type) {

      // ⚡️ NUEVO: Escuchar el nivel de caos del padre
      case 'CHAOS_LEVEL':
        const level = data.level;
        console.log('[PvP Bridge] Ajustando velocidad de caos a: ' + level + '%');
        
        // Aquí es donde ocurre la magia: 
        // Buscamos la variable de velocidad en el motor del juego (Data.js / Init.js)
        // Normalmente el juego usa un multiplicador. 
        // El 0% sería velocidad 1.0, el 100% sería velocidad 1.8 aprox.
        if (window.Data && window.Data.gameSpeed !== undefined) {
             window.Data.gameSpeed = 1 + (level / 100) * 0.8; 
        } else if (window.game && window.game.speed !== undefined) {
             window.game.speed = 1 + (level / 100) * 0.8;
        }
        // Si el juego tiene una función de actualización de velocidad, la llamamos
        if (typeof window.updateGameSpeed === 'function') {
            window.updateGameSpeed(level);
        }
        break;

      case 'MATCH_ENDED':
        matchEnded = true;
        clearInterval(pollInterval);
        freezeGame();
        showMatchResult(data.winner);
        break;

      case 'RIVAL_BOOST':
        showRivalBoostWarning(data.boostsRemaining);
        break;

      case 'TRIGGER_BOOST':
        if (!matchEnded) window.PvPBridge.onPowerPellet();
        break;

      case 'RIVAL_SCORE':
        break;
    }
  });


  // ── 7. CONGELAR JUEGO AL TERMINAR ──
  function freezeGame() {
    // Intentamos pausar usando las teclas/eventos nativos del juego
    // Simulamos presionar 'P' (pausa) o Espacio
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', keyCode: 80, bubbles: true }));
    } catch(e) {}

    // Overlay encima del canvas para bloquear input
    const overlay = document.createElement('div');
    overlay.id = 'pvp-freeze-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.0);
      cursor: not-allowed;
    `;
    // Bloquea clicks pero no se ve
    document.body.appendChild(overlay);
  }

  // ── 8. OVERLAY DE RESULTADO ──
  function showMatchResult(winner) {
    const isWinner = winner === PLAYER;
    const isDraw = winner === 'draw';

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(3,10,6,0.88);
      font-family: 'Courier New', monospace;
      animation: pvpFadeIn 0.4s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pvpFadeIn { from { opacity:0; } to { opacity:1; } }
      @keyframes pvpGlow { 0%,100%{text-shadow:0 0 20px currentColor} 50%{text-shadow:0 0 40px currentColor,0 0 60px currentColor} }
    `;
    document.head.appendChild(style);

    const title = isDraw ? '⚡ EMPATE' : isWinner ? '▶ VICTORIA' : '✕ DERROTA';
    const color = isDraw ? '#ffb700' : isWinner ? '#00e5ff' : '#ff2244';

    overlay.innerHTML = `
      <div style="
        font-size: clamp(32px, 8vw, 64px);
        font-weight: 900;
        color: ${color};
        letter-spacing: 8px;
        animation: pvpGlow 1.5s ease-in-out infinite;
        margin-bottom: 12px;
      ">${title}</div>
      <div style="color:rgba(0,255,65,0.5); font-size:14px; letter-spacing:4px;">
        SCORE FINAL: ${lastScore}
      </div>
    `;

    document.body.appendChild(overlay);
  }

  // ── 9. AVISO VISUAL DE BOOST RIVAL ──
  function showRivalBoostWarning(boostsRemaining) {
    const warn = document.createElement('div');
    warn.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      background: rgba(255,0,170,0.12);
      border: 1px solid rgba(255,0,170,0.5);
      color: #ff00aa;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      letter-spacing: 3px;
      padding: 8px 20px;
      z-index: 8000;
      pointer-events: none;
      animation: pvpFadeIn 0.2s ease;
    `;
    warn.textContent = '⚡ RIVAL ACTIVÓ INMUNIDAD';
    document.body.appendChild(warn);
    setTimeout(() => warn.remove(), 2000);
  }

  // ── 10. ENVIAR AL PADRE ──
  function sendToParent(data) {
    try {
      window.parent.postMessage(data, '*');
    } catch(e) {
      console.warn('[PvP Bridge] Error enviando mensaje:', e);
    }
  }

  // ── 11. INICIALIZACIÓN ──
  function applyPvpScale() {
    // El canvas tiene 336x396px fijos (seteados por Board.js).
    // El container mide ~354x414px (canvas + padding de 1em=12px c/lado).
    // Usamos transform:scale() para estirar todo al viewport del iframe.
    var GAME_W = 354;
    var GAME_H = 414;

    function scale() {
        var container = document.getElementById('container');
        if (!container) return;

        var scaleX = window.innerWidth  / GAME_W;
        var scaleY = window.innerHeight / GAME_H;
        var s      = Math.min(scaleX, scaleY);

        container.style.position  = 'fixed';
        container.style.top       = '50%';
        container.style.left      = '50%';
        container.style.margin    = '0';
        container.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
        container.style.transformOrigin = 'center center';

        console.info('[PvP Bridge] Scale aplicado: ' + s.toFixed(3) +
            ' (' + Math.round(window.innerWidth) + 'x' + Math.round(window.innerHeight) + ')');
    }

    // Esperar a que Board.js cree el container y los canvas
    var attempts = 0;
    var waitForContainer = setInterval(function() {
        attempts++;
        if (document.getElementById('container') || attempts > 20) {
            clearInterval(waitForContainer);
            scale();
            window.addEventListener('resize', scale);
        }
    }, 100);
}

function initBridge() {
    gameActive = true;

    // Escalar el juego para llenar el iframe
    applyPvpScale();

    // Intentar los 3 métodos en orden
    const hooked = tryHookScoreObject();
    if (!hooked) tryObserveDOM();
    startPolling(); // siempre activo como respaldo

    console.info('[PvP Bridge] Inicializado. Jugador:', PLAYER.toUpperCase());
    console.info('[PvP Bridge] Para debug: PvPBridge.debug()');
    console.info('[PvP Bridge] Si el score no detecta, revisá Score.js y ajustá readScoreFromGame()');
  }

  // Esperar a que el juego esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initBridge, 500); // pequeño delay para que el juego inicialice
    });
  } else {
    setTimeout(initBridge, 500);
  }

})();
