import "./extensions";
import "./level";
import { DensityCanvas } from "./widget/density-canvas";
import { GRID_PADDING, TARGET_FRAME_TIME } from "./constants";
import { GameStateType } from "./enum/game-state-type";
import { Board } from "./model/board";
import { Level } from "./model/level";
import { ParticleController } from "./controller/particle-controller";
import { GameStateMenu } from "./ui/state/game-state-menu";
import { GameState } from "./ui/state/game-state";
import { GameStatePlaying } from "./ui/state/game-state-playing";
import { InputUtils } from "./util/input";
import { MouseUtils } from "./util/mouse";
import { GameStateOver } from "./ui/state/game-state-over";
import { Cell } from "./model/cell";
import { GameStatePause } from "./ui/state/game-state-pause";
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
		this.chaosBoostLevel = 0; // Incremento de velocidad por caos
		this.customGameWidth = null; // Ancho personalizado desde el parent (iframe)

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
	}

	async #onLoad() {
		await LocaleUtils.initialize();
		this.canvas.attachToElement(document.querySelector("#wrapper"));
		this.#onResize();
		this.lastFrameTime = performance.now();
		this.#invalidate();
	}

	#onResize() {
		// Priorizar el ancho enviado por el padre (iframe), si no, usar el ancho de la ventana
		const gameWidth = this.customGameWidth || window.innerWidth;
		
		const preliminarCellSize = Math.floor((gameWidth - GRID_PADDING * 2) / 10);
		const preliminarPanelWidth = preliminarCellSize * 4 + 20; 
		const availableWidth = gameWidth - GRID_PADDING * 2 - preliminarPanelWidth;
		
		this.board.setSize({
			width: Math.max(availableWidth, 100), 
			height: window.innerHeight - GRID_PADDING * 2,
		});

		const size = {
			width: this.board.width,
			height: this.board.height
		};

		let uiPanelWidthOffset = 0;
		this.uiPanels.forEach((panel) => {
			panel.calculateSize(size);
			const panelOffset = panel.size.width + panel.padding;
			if (panelOffset > uiPanelWidthOffset) uiPanelWidthOffset = panelOffset;
		});
		size.width += uiPanelWidthOffset;

		this.canvas.setSize(size);
	}

	#onVisibilityChange(isVisible) {
		if (!isVisible && this.currentGameState == GameStateType.PLAYING) {
			this.currentGameState = GameStateType.PAUSED;
			this.lastFrameTime = performance.now();
		}
	}

	#onFrame() {
		this.startFrameTime = performance.now();
		const deltaTime = (this.startFrameTime - this.lastFrameTime) / 1000;

		this.frameCounter ++;
		this.fpsTimer += deltaTime;
		if (this.fpsTimer > 1) {
			this.fpsTimer -= 1;
			this.fps = this.frameCounter;
			this.frameCounter = 0;
		}

		this.#onRender(deltaTime);
		this.#invalidate();
	}

	#onRender(deltaTime) {
		this.canvas.clear();
		InputUtils.update();

		const state = this.currentGameState;
		state?.update(deltaTime);
		state?.render(this.ctx, deltaTime);

		this.#drawFps();
	}

	#drawFps() {
		this.ctx.fillStyle = "white";
		this.ctx.fillText(`${this.fps} FPS`, 10, 20);
	}

	#invalidate() {
		if (window.hasOwnProperty("requestAnimationFrame")) {
			requestAnimationFrame(this.#onFrame.bind(this));
		} else {
			const frameTime = (this.startFrameTime - performance.now());
			const delay = Math.clamp(TARGET_FRAME_TIME - frameTime, 0, TARGET_FRAME_TIME);
			setTimeout(this.#onFrame.bind(this), delay);
		}
		this.lastFrameTime = performance.now();
	}

	get currentLevel() {
		const boostedIndex = Math.min(
			this.currentLevelIndex + (this.chaosBoostLevel || 0),
			Level.list.length - 1
		);
		return Level.list[boostedIndex];
	}

	get currentGameState() {
		switch (this.state) {
			case GameStateType.MENU: return this.stateMenu;
			case GameStateType.PLAYING: return this.statePlaying;
			case GameStateType.GAMEOVER: return this.stateOver;
			case GameStateType.PAUSED: return this.statePaused;
			default: return null;
		}
	}

	get uiPanels() {
		return Object.values(this.ui);
	}
}

// ── RAPPIBELLION T2E ARENA INTEGRATION ──
window.addEventListener('message', function(event) {
	if (!event.data) return;

	var self = window.main; 
	if (!self) {
		console.error('[Tetris] Error: window.main no está listo.');
		return;
	}

	// 1. START MATCH - Inicia el juego y resetea el caos
	if (event.data.type === 'START_MATCH') {
		console.log('[Tetris] START_MATCH - Auto-starting game');
		self.chaosBoostLevel = 0; 
		self.state = GameStateType.PLAYING;
		if (self.statePlaying) {
			self.statePlaying.reset();
		}
		InputUtils.resetAllKeys();
	}

	// 1b. SET_GAME_WIDTH - Ajusta la resolución del canvas desde el padre
	if (event.data.type === 'SET_GAME_WIDTH') {
		var newWidth = parseInt(event.data.width) || null;
		self.customGameWidth = newWidth;
		window.dispatchEvent(new Event('resize'));
	}

	// 2. CHAOS_LEVEL - Aumenta velocidad de caida segun porcentaje de caos (0-100%)
	if (event.data.type === 'CHAOS_LEVEL') {
		var chaosLevel = parseInt(event.data.level) || 0;
		// Mapeo: cada 20% de caos sube 1 nivel de velocidad
		self.chaosBoostLevel = Math.floor(chaosLevel / 20);
	}

	// 3. UNLOCK_CHAOS - Activa la velocidad máxima permitida por el juego
	if (event.data.type === 'UNLOCK_CHAOS') {
		self.chaosBoostLevel = Level.list.length - 1;
		console.log('[Tetris] UNLOCK_CHAOS - Velocidad máxima activada');
	}

	// 4. CHAOS_DROP - Forzar Hard Drops (Intensidad de Caos)
	if (event.data.type === 'CHAOS_DROP') {
		InputUtils.triggerKey('Space', true);
		setTimeout(function() { InputUtils.triggerKey('Space', false); }, 20);
		setTimeout(function() {
			InputUtils.triggerKey('Space', true);
			setTimeout(function() { InputUtils.triggerKey('Space', false); }, 20);
		}, 80);
	}

 	// 5. MATCH_ENDED - Sincroniza puntaje final y fuerza el Game Over
 	if (event.data.type === 'MATCH_ENDED') {
 		if (self.statePlaying && self.statePlaying.stats) {
 			var finalScore = self.statePlaying.stats.score || 0;
 			window.parent.postMessage({ type: 'SCORE_UPDATE', score: finalScore }, '*');
 		}
 		self.state = GameStateType.GAMEOVER;
 		if (self.stateOver && self.stateOver.reset) {
 			self.stateOver.reset();
 		}
 	}

 	// 6. CHAOS_BOMB - Triple Boost T2E: 3 Bombas secuenciales
 	if (event.data.type === 'CHAOS_BOMB') {
 		console.log('[Tetris] 💣💣💣 TRIPLE CHAOS_BOMB ejecutando...');

 		// LIMPIEZA SEGURA DEL TABLERO (al inicio de la primer bomba)
 		if (self.board) {
 			self.board.fill(null); 
 			self.board.isBufferDirty = true;
 		}

 		// SUMA DE PUNTOS (1500 pts total por las 3 bombas: 500+500+500)
 		if (self.state === GameStateType.PLAYING && self.statePlaying && self.statePlaying.stats) {
 			self.statePlaying.stats.score += 1500;
 			window.parent.postMessage({ 
 				type: 'SCORE_UPDATE', 
 				score: self.statePlaying.stats.score 
 			}, '*');
 		}

 		// Notificar al HUD que el boost fue consumido
 		window.parent.postMessage({ type: 'BOOST_USED' }, '*');

 		// EFECTO VISUAL TRIPLE BOMBA
 		try {
 			// BOMBA 1 (0ms) - Cyan/Magenta + Audio
 			setTimeout(function() {
 				console.log('[Tetris] 💣 Bomba 1/3 - CYAN');
 				// Reproducir audio en el parent
 				window.parent.postMessage({ type: 'PLAY_AUDIO', src: '../sounds/bomba-chaos.mp3' }, '*');
 				var b1 = document.createElement('div');
 				b1.textContent = '💣';
 				b1.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.1);opacity:1;font-size:18vh;line-height:1;z-index:2147483647;pointer-events:none;text-shadow:0 0 30px cyan, 0 0 60px magenta, 0 0 90px cyan;transition:transform 0.4s cubic-bezier(0.25,1,0.5,1), opacity 0.8s ease-out;';
 				document.body.appendChild(b1);
 				requestAnimationFrame(function() {
 					b1.style.transform = 'translate(-50%,-50%) scale(10)';
 					b1.style.filter = 'brightness(3) drop-shadow(0 0 50px cyan) drop-shadow(0 0 100px magenta)';
 				});
 				setTimeout(function() { b1.style.opacity = '0'; }, 400);
 				setTimeout(function() { b1.remove(); }, 900);
 			}, 0);

 			// BOMBA 2 (740ms) - Amarillo/Dorado + Audio
 			setTimeout(function() {
 				console.log('[Tetris] 💣 Bomba 2/3 - DORADA');
 				// Reproducir audio en el parent
 				window.parent.postMessage({ type: 'PLAY_AUDIO', src: '../sounds/bomba-chaos.mp3' }, '*');
 				var b2 = document.createElement('div');
 				b2.textContent = '💣';
 				b2.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.1);opacity:1;font-size:22vh;line-height:1;z-index:2147483647;pointer-events:none;text-shadow:0 0 40px gold, 0 0 80px orange, 0 0 120px yellow;transition:transform 0.5s cubic-bezier(0.25,1,0.5,1), opacity 1s ease-out;';
 				document.body.appendChild(b2);
 				requestAnimationFrame(function() {
 					b2.style.transform = 'translate(-50%,-50%) scale(12)';
 					b2.style.filter = 'brightness(4) drop-shadow(0 0 60px gold) drop-shadow(0 0 120px orange)';
 				});
 				setTimeout(function() { b2.style.opacity = '0'; }, 500);
 				setTimeout(function() { b2.remove(); }, 1100);
 			}, 740);

 			// BOMBA 3 (1480ms) - Rojo/Rojo + Screen Flash + Audio
 			setTimeout(function() {
 				console.log('[Tetris] 💣💣 Bomba 3/3 - APOCALYPTIC ROJA');
 				// Reproducir audio en el parent
 				window.parent.postMessage({ type: 'PLAY_AUDIO', src: '../sounds/bomba-chaos.mp3' }, '*');
 				// Screen flash rojo
 				var flash = document.createElement('div');
 				flash.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(255,50,0,0.4) 50%, transparent 100%);z-index:2147483646;pointer-events:none;opacity:0;transition:opacity 0.2s;';
 				document.body.appendChild(flash);
 				requestAnimationFrame(function() { flash.style.opacity = '1'; });
 				setTimeout(function() { flash.style.opacity = '0'; }, 300);
 				setTimeout(function() { flash.remove(); }, 600);
 				
 				// Bomba roja gigante
 				var b3 = document.createElement('div');
 				b3.textContent = '💣';
 				b3.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.1);opacity:1;font-size:28vh;line-height:1;z-index:2147483647;pointer-events:none;text-shadow:0 0 50px #ff0000, 0 0 100px #ff3300, 0 0 150px #ff0000, 0 0 200px #ff6600;transition:transform 0.6s cubic-bezier(0.25,1,0.5,1), opacity 1.2s ease-out;';
 				document.body.appendChild(b3);
 				requestAnimationFrame(function() {
 					b3.style.transform = 'translate(-50%,-50%) scale(15)';
 					b3.style.filter = 'brightness(5) drop-shadow(0 0 80px red) drop-shadow(0 0 160px #ff4400)';
 				});
 				setTimeout(function() { b3.style.opacity = '0'; }, 600);
 				setTimeout(function() { b3.remove(); }, 1500);
 			}, 1480);

 		} catch (ex) { 
 			console.error('[Tetris] Error en animación TRIPLE BOMBA:', ex); 
 		}
 	}
 });

window.main = new Main();
