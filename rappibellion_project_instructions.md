# RAPPIBELLION T2E — Instrucciones del Proyecto
> Para incluir en Claude Projects > Project Knowledge

---

## Qué es Rappibellion

Plataforma web de gaming blockchain (Think-to-Earn / T2E) construida sobre **Optimism** con token **$RPPI**. Los usuarios apuestan con su wallet cripto y compiten en minijuegos de habilidad en tiempo real. El proyecto está en **beta abierta** en `rappibellion.com`.

**Stack:** HTML/CSS/JS vanilla · Firebase Realtime DB · Ethers.js / Metamask · PWA (service worker, manifest) · iframes para los juegos

---

## Arquitectura de archivos clave

```
/
├── index.html              ← App principal Rappibellion (TODO está acá)
├── style.css               ← Estilos globales + media queries + PWA standalone
├── manifest.json           ← PWA manifest (icons, shortcuts, share_target)
├── service-worker.js       ← Cache-first assets / Network-first HTML
├── images/
├── sounds/                 ← mario-star.mp3, etc.
├── assets/audio/           ← bomba-chaos.mp3
│
├── Tetris-Cipher/          ← Juego Tetris (freeplay)
│   ├── index.html          ← Con D-PAD virtual + SET_CONTROL handler
│   └── scripts/
│       └── script_min.js   ← Bundle compilado (NO editar directamente)
│
├── Tetris-Cipher-T2E/      ← Juego Tetris (apuestas) — separado
│
├── pac-hack-freeplay/      ← Pac-Man freeplay
│   ├── game.html
│   ├── pvp-bridge.js       ← Scale + TRIGGER_BOOST (early exit si no es PvP)
│   └── source/
│       └── Init.js         ← Autostart: en iframe espera START_MATCH del padre
│
└── pac-hack/               ← Pac-Man T2E (con ?player=p1/p2)
    └── pvp-bridge.js       ← PvP completo con Firebase sync
```

---

## Comunicación postMessage (padre ↔ iframe)

### PADRE → IFRAME

| Mensaje | Descripción |
|---------|-------------|
| `START_MATCH` | Inicia la partida en el iframe |
| `MATCH_ENDED` | Fuerza fin de partida |
| `SET_CONTROL` `{ mode: 'dpad'|'swipe' }` | Muestra/oculta D-PAD en Tetris |
| `SET_GAME_WIDTH` `{ width: px }` | Ajusta canvas Tetris al iframe |
| `CHAOS_LEVEL` `{ level: 0-100 }` | Velocidad de caos |
| `UNLOCK_CHAOS` | Velocidad máxima |
| `CHAOS_DROP` | Hard drop forzado (Tetris) |
| `TRIGGER_BOOST` | Activa boost en pac-hack (fantasmas asustados) |
| `CHAOS_BOMB` | Borra tablero + 500pts + animación (Tetris) |

### IFRAME → PADRE

| Mensaje | Descripción |
|---------|-------------|
| `SCORE_UPDATE` `{ score }` | Score en tiempo real (poll 250ms) |
| `BOOST_USED` | Boost consumido — actualiza contador |
| `GAME_OVER` `{ player, score }` | Partida terminada |

---

## Sistema de Boost (HACK IT)

- **Freeplay:** 3 boosts gratis, sin apuesta, modo práctica
- **T2E:** límite definido por la apuesta (`bet.boostLimit`)
- **Tetris:** botón overlay `#fp-boost-tetris-overlay-btn` → envía `CHAOS_BOMB` → script_min.js maneja todo internamente
- **Pac-hack:** botón `#fp-boost-overlay-btn` → envía `TRIGGER_BOOST` → pvp-bridge.js despacha evento `pvpBoost` → fantasmas asustados
- El conteo se actualiza cuando el iframe responde `BOOST_USED`
- Ghost flash (Ghostbusters) solo para pac-hack, NO para Tetris

---

## Tetris Cipher — fuente JS

`main.js` → compilar con Browserify/Babel → `script_min.js`

**Variables globales importantes en `window.main`:**
- `self.board.fill(null)` — limpiar tablero (CHAOS_BOMB)
- `self.board.isBufferDirty = true` — forzar re-render
- `self.statePlaying.stats.score` — score actual
- `self.chaosBoostLevel` — velocidad extra (0 = normal)
- `self.state = GameStateType.PLAYING/GAMEOVER/MENU`

**Score sync:** `setInterval` de 250ms lee `statePlaying.stats.score` y envía `SCORE_UPDATE` si cambió.

---

## Pac-Hack — Init.js

**Regla de autostart:**
```js
var _isInIframe = window.self !== window.top;
if (!_isInIframe) {
  setTimeout(newGame, 300); // standalone solo
}
// En iframe: esperar START_MATCH del padre
```

**pvp-bridge.js freeplay:**
- Si no hay `?player=p1/p2` en URL → early exit DESPUÉS de correr `applyPvpScale()`
- La escala del juego corre siempre (freeplay y PvP)

---

## CSS / Diseño

**Variables CSS:**
```css
--color-primario: #00BCFF
--color-caos-verde: #00FF41
--color-caos-amarillo: #FFD700
--color-caos-rosa: #FF2D78
--color-fondo-oscuro: #020408
```

**Fuentes:** Orbitron (títulos/HUD) · Courier New (terminal/código) · Rajdhani (cuerpo)

**PWA Standalone:** `@media (display-mode: standalone)` — la arena `.show` recibe `z-index: 99999`. Todos los overlays que vivan fuera del `#t2eplay-arena` en el DOM (veredicto, countdown, control selector) necesitan `z-index: 100001 !important` para no quedar tapados.

**Overlay DOM order:** La regla `#t2eplay-arena.show ~ * { pointer-events: none }` está ELIMINADA — mataba todos los botones. No reintroducirla.

---

## Arena freeplay — flujo completo

```
fpOpenFreeGame(src)
  → guard _fpFreeGameLoading (evita double-tap)
  → fpOpenArena(null)
      → mobile: si _fpSavedControlMode → auto fpStartWithControl(mode)
               si no → selector de control (5s auto-swipe)
      → desktop: setTimeout(fpStartCountdown, 1200)
  → iframe onload → re-envía SET_CONTROL si hay modo guardado
  → fpStartCountdown → 3,2,1 → START_MATCH al iframe
  → fpTick() cada segundo:
      - Tetris: calcula caos local → postMessage CHAOS_LEVEL
      - Pac-hack: recibe CHAOS_LEVEL del propio juego (Init.js lo calcula)
  → timeLeft = 0 → fpEndPractice()
      → MATCH_ENDED al iframe
      → 400ms → fpShowVerdict(score)   ← freeplay
      → 1500ms → fpShowVerdict(score)  ← T2E
```

---

## Patrones de bugs recurrentes

| Síntoma | Causa más común |
|---------|----------------|
| Botones del veredicto/countdown no responden en PWA | `z-index` de arena (99999) cubre el overlay. Agregar `z-index: 100001 !important` al elemento afectado |
| Loop 3,2,1 READY HACK en pac-hack mobile | Double-tap → `fpOpenFreeGame` llamado dos veces. Guard: `window._fpFreeGameLoading` |
| Score Tetris no se actualiza en HUD | Falta el `setInterval` de 250ms en `script_min.js` / `main.js` |
| Pac-hack canvas chico en desktop freeplay | `pvp-bridge.js` hacía early exit antes de `applyPvpScale()` |
| CHAOS_BOMB no limpia tablero | `currentGameState.arena` no existe — usar `self.board.fill(null)` |
| Dpad desaparece en restart/revancha | `fpState` se resetea → perder `controlMode`. Usar `window._fpSavedControlMode` |
| Contador boost va de 3 a 0 en un click | Doble conteo: `script_min.js` envía `BOOST_USED` Y `index.html` decrementaba manualmente. Solo uno debe decrementar |

---

## PWA

- **Android:** splash auto-generado desde manifest · `background_color: #020408`
- **iOS:** requiere `apple-touch-startup-image` con media queries por modelo de iPhone
- **Actualización:** service worker detecta nueva versión → banner "ACTUALIZAR" en la app
- **Instalar:** `beforeinstallprompt` capturado → botón `#pwa-install-btn` en `bottom: 145px` (sobre el chatbot)
- El botón se oculta al abrir la arena (está en la lista de `_fpHiddenPrev`)

---

## Estilo de trabajo en este proyecto

- Los archivos compilados (`script_min.js`) se parchean con Python directamente sobre bytes — no se recompilan automáticamente. Siempre modificar también el fuente (`main.js`) para mantener sincronía.
- Las ediciones se hacen quirúrgicamente con búsqueda exacta de bytes o cadenas únicas — nunca reescribir archivos completos salvo que sea necesario.
- Antes de cada fix, verificar el estado actual del archivo subido — el archivo del repositorio puede diferir del que está en producción.
- El `index.html` es monolítico (~500KB+): contiene HTML, CSS inline, y múltiples bloques JS. Siempre trabajar con búsqueda de fragmentos únicos.

---

## Pendientes conocidos al cierre de esta sesión

- [ ] Verificar Tetris freeplay D-PAD en dispositivo real Android (el `InputUtils` no es global — usa `window.main.InputUtils` como fallback a `KeyboardEvent`)
- [ ] Verificar posición `top:28%; left:40%` del texto en la TV retro — ajustar según imagen real en producción
- [ ] Test del veredicto en PWA Android después del fix de `z-index: 100001`
- [ ] El score del veredicto freeplay usa `fpState.score` — verificar que el poll de 250ms actualiza ese campo correctamente antes de `fpEndPractice()`

--- 

## TIMBER ZEUS — Beta Freeplay (2026-04-30)

### Estado actual
- **Fase**: Beta Freeplay (demo gratuito) integrado
- **Disponible en**: /rtp-timberzeus/timberzeus.html
- **Acceso directo**:
  - Botón en Hero section: "MUNDO DIVINO - RTP TIMBER ZEUS"
  - Ventana promo flotante (esquina inferior derecha)
  - Se oculta automáticamente en modo arena (ody.arena-open #zeus-promo-window)

### Características técnicas
- **Tipo**: Slot machine / ruleta temática Zeus/Olimpo
- **RTP**: Alto (configurable)
- **Volatilidad**: Media-alta
- **Bonos**: Free spins, multiplicadores, thunder bonus
- **Assets completos**: /rtp-timberzeus/ (sprites, sonidos, animaciones, CSS, JS)
- **Imagen promocional**: /images/timberzeus.png

### Integración T2E
- **Estado**: En desarrollo — integración con Space-Breaker
- **Fecha adelantada**: La versión T2E (apuestas reales) se lanzará antes de lo previsto
- **Próximamente**:
  - Conexión de wallet (Metamask)
  - Apuestas con 
  - Leaderboard específico TIMBER ZEUS
  - Sync con Firebase para PvP

### Consideraciones de producto
- **Modelo**: Demo gratuito como pasatiempo/engagement driver
- **Transición**: Suave de freeplay → T2E (jugador prueba, luego apuesta)
- **Posicionamiento**: "Juega gratis ahora, apuesta cuando quieras"
- **No apoyamos** monetización agresiva en fase beta

###Respuestas frecuentes (FAQ) para usuarios
- **¿TIMBER ZEUS está disponible?** → "Sí, en modo demo gratuito (freeplay). Accede desde el botón 'MUNDO DIVINO' en la página principal."
- **¿Cuándo se puede apostar?** → "Estamos integrando T2E con Space-Breaker. La fecha se adelantó, próximamente podrás apostar ."
- **¿Es gratis?** → "Sí, el demo es 100% gratuito. Sin depósito, sin conexión de wallet."

### Notas técnicas para desarrollo
- La ventana promo tiene animación CSS loatAngelic (levitación suave)
- El header usa lex-grow: 1 para que el título ocupe todo el ancho hasta la X
- El botón de la ventana apunta a /rtp-timberzeus/timberzeus.html (ruta relativa desde raíz)
- En modo arena, la ventana se oculta completamente (no se minimiza)

### Archivos modificados/agregados (commit actual)
- index.html: botón Hero + ventana promo + CSS arena-open rule
- tp-timberzeus/: directorio completo con el juego
- images/timberzeus.png: asset promocional