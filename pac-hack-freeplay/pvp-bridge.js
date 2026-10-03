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
  const params = new URLSearchParams(window.location.search);
  const PLAYER = params.get('player');

  // ── 2. MODO ── Freeplay o PvP
  const IS_PVP = PLAYER === 'p1' || PLAYER === 'p2';
  const IS_IFRAME = window.self !== window.top;

  // Siempre escalar el juego para llenar el iframe (freeplay y PvP)
  // applyPvpScale corre en ambos modos
  if (IS_IFRAME) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(applyPvpScale, 300); });
    } else {
      setTimeout(applyPvpScale, 300);
    }
  }

  // Solo PvP continúa: score polling, BOOST_USED, MATCH_ENDED overlay, etc.
  if (!IS_PVP) {
    // Freeplay: solo escalar. El efecto de juego y la emisión de BOOST_USED
    // son responsabilidad ÚNICA del listener TRIGGER_BOOST en Init.js (R2A:
    // una autoridad → 1 frighten + 1 BOOST_USED, sin duplicar el efecto).
    return;
  }

  // Solo PvP llega aquí
  console.info('[PvP Bridge] Activo como ' + PLAYER.toUpperCase());

  // ── 2. ESTADO ──
  let lastScore = 0;
  let boostsUsed = 0;
  let gameActive = false;
  let matchEnded = false;
  let pollInterval = null;

  // R2A-FIX 01oct2026: deteccion local ELIMINADA. Unica via: Score.js -> PvPBridge.reportScore().
  function startPolling() {}
  function tryHookScoreObject() { return false; }
  function tryObserveDOM() { return false; }
  function readScoreFromGame() { return null; }
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
    // R2A-FIX 01oct2026: relay puro. El efecto frighten lo hace Init.js (TRIGGER_BOOST).
    onPowerPellet: function() {
      if (matchEnded) return;
      boostsUsed++;
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

  // R2A-FIX 01oct2026: switch recortado.
  window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.type) return;
    if (data.type === 'MATCH_ENDED') {
      matchEnded = true;
      clearInterval(pollInterval);
    }
  });

  function showRivalBoostWarning() {}

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

    // Nota: applyPvpScale ya fue llamado al inicio (antes del guard PvP)
    // para que el freeplay también escale correctamente

    // R2A-FIX 01oct2026: deteccion local eliminada. Unica via: Score.js -> PvPBridge.reportScore().

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
