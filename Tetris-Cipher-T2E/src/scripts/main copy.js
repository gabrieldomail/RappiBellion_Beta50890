import "./extensions";
import "./level";
import { DensityCanvas } from "./widget/density-canvas";
import { GRID_PADDING, TARGET_FRAME_TIME } from "./constants";
import { GameStateType } from "./enum/game-state-type";
import { Board } from "./model/board";
import { Level } from "./model/level";
import { ParticleController } from "./controller/particle-controller";
import { GameStateMenu } from "./state/game-state-menu";
import { GameState } from "./state/game-state";
import { GameStatePlaying } from "./state/game-state-playing";
import { InputUtils } from "./util/input";
import { MouseUtils } from "./util/mouse";
import { GameStateOver } from "./state/game-state-over";
import { Cell } from "./model/cell";
import { GameStatePause } from "./state/game-state-pause";
import { UIStats } from "./ui/ui-stats";
import { UIPanel } from "./ui/ui-panel";
import { UIBag } from "./ui/ui-bag";
import { LocaleUtils } from "./util/locale";

export class Main {

	constructor() {
		// Setup canvas
		this.canvas = new DensityCanvas();
		this.ctx = this.canvas.context;

		// Misc variables
		this.currentLevelIndex = 0;
		this.chaosBoostLevel = 0; // boost de nivel por caos (incrementa velocidad)
		this.customGameWidth = null; // ancho personalizado desde el parent (para iframe)

		// Frame rate variables
		this.startFrameTime = 0;
		this.lastFrameTime = 0;
		this.frameCounter = 0;
		this.fpsTimer = 0;
		this.fps = 0;

		// Initialize controllers
		this.board = new Board();
		this.particleController = new ParticleController(this);

		// Initialize states
		this.#initializeStates();

		// Initialize ui panels
		this.#initializeUi();

		// Hook events
		this.#attachHooks();
	}

	#initializeStates() {
		this.state = GameStateType.MENU;
		this.stateOver = new GameStateOver(this);
		this.stateMenu = new GameStateMenu(this);
		this.statePaused = new GameStatePause(this);
		this.statePlaying = new GameStatePlaying(this);
	}

	#initializeUi() {
		this.ui = {
			score: new UIStats(this),
			bag: new UIBag(this)
		};
	}

	reset() {
		this.currentLevelIndex = 0;
		this.board.fill(Cell.empty);
	}

	// #region Event handlers
	#attachHooks() {
		window.addLoadEventListener(this.#onLoad.bind(this));
		window.addEventListener("resize", this.#onResize.bind(this));
		window.addVisibilityChangeEventListener(this.#onVisibilityChange.bind(this));

		// Initialize mouse utility
		// MouseUtils.attachHooks(this.canvas.canvas);
	}

	async #onLoad() {
		// Initialize the locale utility
		await LocaleUtils.initialize();

		// Attach the canvas to the document body
		this.canvas.attachToElement(document.querySelector("#wrapper"));

		// Set the initial sizing of the canvas
		this.#onResize();

		// Request the first frame
		this.lastFrameTime = performance.now();
		this.#invalidate();
	}

	#onResize() {
		// Usar ancho personalizado si está definido, sino usar window.innerWidth
		const gameWidth = this.customGameWidth || window.innerWidth;
		
		// PASS 1: Calcular cellSize preliminar para medir el panel NEXT
		const preliminarCellSize = Math.floor((gameWidth - GRID_PADDING * 2) / 10);
		const preliminarPanelWidth = preliminarCellSize * 4 + 20; // 4 cells + padding
		
		// PASS 2: Ancho disponible restando el panel
		const availableWidth = gameWidth - GRID_PADDING * 2 - preliminarPanelWidth;
		
		// Calculate the board size con el ancho剩余
		this.board.setSize({
			width: Math.max(availableWidth, 100), // minimo 100px
			height: window.innerHeight - GRID_PADDING * 2,
		});

		// Fetch the window size
		const size = {
			width: this.board.width,
			height: this.board.height
		};

		// Calculate offsets based on detached UI Panels
		let uiPanelWidthOffset = 0;
		this.uiPanels.forEach((panel) => {
			// Calculate the panel size based on the board size
			panel.calculateSize(size);

			// Increase the canvas width to accommodate the panel, if needed
			const panelOffset = panel.size.width + panel.padding;
			if (panelOffset > uiPanelWidthOffset) uiPanelWidthOffset = panelOffset;
		});
		size.width += uiPanelWidthOffset;

		// Set the canvas size
		this.canvas.setSize(size);
	}

	#onVisibilityChange(isVisible) {
		if (!isVisible && this.currentGameState == GameStateType.PLAYING) {
			this.currentGameState = GameStateType.PAUSED;
			this.lastFrameTime = performance.now();
		}
	}

	#onFrame() {
		// Calculate the delta time
		this.startFrameTime = performance.now();
		const deltaTime = (this.startFrameTime - this.lastFrameTime) / 1000;

		// Handle fps counter
		this.frameCounter ++;
		this.fpsTimer += deltaTime;
		if (this.fpsTimer > 1) {
			this.fpsTimer -= 1;
			this.fps = this.frameCounter;
			this.frameCounter = 0;
		}

		// Render the frame
		this.#onRender(deltaTime);

		// Request next frame
		this.#invalidate();
	}
	// #endregion

	// #region Rendering
	#onRender(deltaTime) {
		// Clear canvas
		this.canvas.clear();

		// Update gamepad, if available
		InputUtils.update();

		// Update current game state
		const state = this.currentGameState;
		state?.update(deltaTime);
		state?.render(this.ctx, deltaTime);

		// Draw FPS Counter
		this.#drawFps();
	}

	#drawFps() {
		// Draw FPS Counter
		this.ctx.fillStyle = "white";
		this.ctx.fillText(`${this.fps} FPS`, 10, 20);
	}
	// #endregion

	#invalidate() {
		if (window.hasOwnProperty("requestAnimationFrame")) {
			requestAnimationFrame(this.#onFrame.bind(this));
		} else {
			// Calculate the time the frame took
			const frameTime = (this.startFrameTime - performance.now());
			// Compensate delays or rushes from this frame in the timing for the next
			const delay = Math.clamp(TARGET_FRAME_TIME - frameTime, 0, TARGET_FRAME_TIME);
			// Schedule next frame
			setTimeout(this.#onFrame.bind(this), delay);
		}

		this.lastFrameTime = performance.now();
	}

	/**
	 * @return {Level}
	 */
	get currentLevel() {
		// chaosBoostLevel aumenta la velocidad de caida sin afectar el indice real
		const boostedIndex = Math.min(
			this.currentLevelIndex + (this.chaosBoostLevel || 0),
			Level.list.length - 1
		);
		return Level.list[boostedIndex];
	}

	/**
	 * @return {GameState}
	 */
	get currentGameState() {
		switch (this.state) {
			case GameStateType.MENU:
				return this.stateMenu;

			case GameStateType.PLAYING:
				return this.statePlaying;

			case GameStateType.GAMEOVER:
				return this.stateOver;

			case GameStateType.PAUSED:
				return this.statePaused;

			default:
				return null;
		}
	}

	/**
	 * @return {Array<UIPanel>}
	 */
	get uiPanels() {
		/* const buffer = [];
		for (const key in this.ui) {
			if (this.ui.hasOwnProperty(key)) buffer.push(this.ui[key]);
		} */

		return Object.values(this.ui);
	}

}

// ── RAPPIBELLION ARENA INTEGRATION ──
window.addEventListener('message', function(event) {
	if (!event.data) return;

	var self = window.main; 
	if (!self) {
		console.error('[Tetris] Error: window.main no está listo.');
		return;
	}

	// 1. START MATCH - Iniciar juego
	if (event.data.type === 'START_MATCH') {
		console.log('[Tetris] START_MATCH - auto starting');
		self.chaosBoostLevel = 0; // reset chaos speed al inicio de cada partida
		self.state = GameStateType.PLAYING;
		if (self.statePlaying) {
			self.statePlaying.reset();
		}
		InputUtils.resetAllKeys();
	}

	// 1b. SET_GAME_WIDTH - Ancho personalizado desde el parent (para iframe)
	if (event.data.type === 'SET_GAME_WIDTH') {
		var newWidth = parseInt(event.data.width) || null;
		self.customGameWidth = newWidth;
		console.log('[Tetris] SET_GAME_WIDTH:', newWidth);
		// Trigger resize event que sera captado por #onResize internamente
		window.dispatchEvent(new Event('resize'));
	}

	// 2. CHAOS_LEVEL - Aumentar velocidad de caida segun nivel de caos
	if (event.data.type === 'CHAOS_LEVEL') {
		var chaosLevel = parseInt(event.data.level) || 0;
		// Mapeo: 0-19% = +0, 20-39% = +1, 40-59% = +2, 60-79% = +3, 80-99% = +4, 100% = +5
		self.chaosBoostLevel = Math.floor(chaosLevel / 20);
		console.log('[Tetris] CHAOS_LEVEL:', chaosLevel, '-> speed boost +' + self.chaosBoostLevel);
	}

	// 3. UNLOCK_CHAOS - Caos sin tope: velocidad maxima
	if (event.data.type === 'UNLOCK_CHAOS') {
		self.chaosBoostLevel = Level.list.length - 1;
		console.log('[Tetris] UNLOCK_CHAOS - velocidad maxima activada');
	}

	// 4. CHAOS_DROP - Hard drop forzado (caos intensity)
	if (event.data.type === 'CHAOS_DROP') {
		console.log('[Tetris] CHAOS_DROP - forcing hard drops');
		// Primer hard drop
		InputUtils.triggerKey('Space', true);
		setTimeout(function() { InputUtils.triggerKey('Space', false); }, 20);
		// Segundo hard drop a los 80ms
		setTimeout(function() {
			InputUtils.triggerKey('Space', true);
			setTimeout(function() { InputUtils.triggerKey('Space', false); }, 20);
		}, 80);
	}

 	// 5. MATCH_ENDED - Forzar Game Over / Veredicto
 	if (event.data.type === 'MATCH_ENDED') {
 		console.log('[Tetris] MATCH_ENDED recibido - forzando veredicto');

 		// Capturar score final
 		if (self.statePlaying && self.statePlaying.stats) {
 			var finalScore = self.statePlaying.stats.score || 0;
 			console.log('[Tetris] Score final:', finalScore);
 			window.parent.postMessage({ type: 'SCORE_UPDATE', score: finalScore }, '*');
 		}

 		// Forzar estado GAMEOVER
 		self.state = GameStateType.GAMEOVER;
 		if (self.stateOver && self.stateOver.reset) {
 			self.stateOver.reset();
 		}
 	}

 	// 6. CHAOS_BOMB - Boost: limpia tablero + 500 puntos
 	if (event.data.type === 'CHAOS_BOMB') {
 		console.log('[Tetris] CHAOS_BOMB recibido - ejecutando');
 		// Limpiar tablero
 		if (self.currentGameState && self.currentGameState.arena) {
 			var arena = self.currentGameState.arena;
 			for (var y = 0; y < arena.length; y++) {
 				for (var x = 0; x < arena[y].length; x++) {
 					arena[y][x] = 0;
 				}
 			}
 			// Forzar re-render
 			if (self.currentGameState.board) {
 				self.currentGameState.board.isBufferDirty = true;
 			}
 		}
 		// Sumar 500 puntos
 		if (self.currentGameState && self.currentGameState.stats) {
 			self.currentGameState.stats.score += 500;
 			console.log('[Tetris] Score +500 ->', self.currentGameState.stats.score);
 			window.parent.postMessage({ type: 'SCORE_UPDATE', score: self.currentGameState.stats.score }, '*');
 		}
 		// Notificar boost usado al padre
 		window.parent.postMessage({ type: 'BOOST_USED' }, '*');
 		// Animación visual
 		try {
 			var bombWrap = document.createElement('div');
 			bombWrap.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;z-index:2147483647;pointer-events:none;overflow:hidden;';
 			var bomb = document.createElement('div');
 			bomb.textContent = '💣';
 			bomb.style.cssText = 'font-size:20vh;line-height:1;transform:scale(0.1);opacity:1;transition:transform 0.25s cubic-bezier(0.25,1,0.5,1), opacity 0.7s ease-out, filter 0.2s;filter:brightness(1.2) drop-shadow(0 0 12px cyan) saturate(1.2);';
 			bombWrap.appendChild(bomb);
 			document.body.appendChild(bombWrap);
 			setTimeout(function(){ bomb.style.transform = 'scale(8)'; bomb.style.filter = 'brightness(2.5) drop-shadow(0 0 40px magenta) saturate(2)'; }, 20);
 			setTimeout(function(){ bomb.style.transform = 'scale(10)'; bomb.style.opacity = '0'; }, 350);
 			setTimeout(function(){ bombWrap.remove(); }, 900);
 		} catch (ex) { console.error('[Tetris] Error anim CHAOS_BOMB:', ex); }
 	}
 });

window.main = new Main();