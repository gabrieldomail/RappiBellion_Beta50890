/**
 * T2E Integration Layer
 * Connects Web3 functionality with the existing UI
 */

// ============================================
// INTEGRACIÓN T2E - CONEXIÓN UI/WEB3
// ============================================

class T2EIntegration {
    constructor() {
        this.web3Config = null;
        this.bettingEngine = null;
        this.isInitialized = false;
        this.currentGameType = null;
        this.selectedBetOptions = {
            amount: '',
            timeLimit: '',
            boostLimit: ''
        };
    }

    /**
     * Inicializa la integración T2E
     */
    async initialize() {
        try {
            console.log('🔗 Inicializando integración T2E...');

            // Verificar que los scripts Web3 están cargados
            if (typeof window.Web3Config === 'undefined' || typeof window.BettingEngine === 'undefined') {
                throw new Error('Scripts Web3 no están cargados. Web3Config: ' + typeof window.Web3Config + ', BettingEngine: ' + typeof window.BettingEngine);
            }

            this.web3Config = window.Web3Config;
            this.bettingEngine = window.BettingEngine;

            // Inicializar Web3
            await this.web3Config.initialize();

            // Inicializar motor de apuestas
            await this.bettingEngine.initialize();

            // Configurar event listeners de UI
            this.setupUIEventListeners();

        // Configurar listeners de blockchain
        this.setupBlockchainListeners();

        // Escuchar Firebase DESPUÉS de registrar los listeners (evita race condition)
        this.bettingEngine.listenFirebaseBets();

        // Configurar ventana flotante de apuestas del usuario
        this.setupUserBetsWindow();

        // Actualizar UI inicial
        await this.updateUI();

        this.isInitialized = true;
        console.log('✅ Integración T2E inicializada');

        } catch (error) {
            console.error('❌ Error inicializando integración T2E:', error);
            this.showError('Error inicializando sistema Web3: ' + error.message);
            throw error;
        }
    }

    /**
     * Configura event listeners de la UI
     */
    setupUIEventListeners() {
        console.log('🎮 Configurando listeners de UI...');

        // Botones "MAKE YOUR BET" de juegos
        const betButtons = {
            'make-bet-arkahack': 'arka-hack',
            'make-bet-spacebreaker': 'space-breaker',
            'make-bet-pachack': 'pac-hack',
            'make-bet-memorybreach': 'memory-breach'
        };

        Object.entries(betButtons).forEach(([buttonId, gameType]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => this.openBetModal(gameType));
            }
        });

        // Modal de apuestas
        const closeBetModalBtn = document.getElementById('close-bet-modal');
        if (closeBetModalBtn) {
            closeBetModalBtn.addEventListener('click', () => this.closeBetModal());
        }

        // Click fuera del modal para cerrar
        const betModal = document.getElementById('make-bet-modal');
        if (betModal) {
            betModal.addEventListener('click', (e) => {
                if (e.target === betModal) {
                    this.closeBetModal();
                }
            });
        }

        // Input de monto
        const betAmountInput = document.getElementById('bet-amount');
        if (betAmountInput) {
            betAmountInput.addEventListener('input', (e) => {
                this.selectedBetOptions.amount = e.target.value;
                this.updateBetPreview();
            });
        }

        // Botones de opciones - tiempo
        const timeButtons = document.querySelectorAll('.bet-option-button[data-type="time"]');
        timeButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remover selección previa del grupo tiempo
                timeButtons.forEach(btn => btn.classList.remove('active'));

                // Seleccionar este botón
                button.classList.add('active');

                // Guardar selección
                this.selectedBetOptions.timeLimit = button.getAttribute('data-value');

                this.updateBetPreview();
            });
        });

        // Botones de opciones - boosts
        const boostButtons = document.querySelectorAll('.bet-option-button[data-type="boost"]');
        boostButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remover selección previa del grupo boosts
                boostButtons.forEach(btn => btn.classList.remove('active'));

                // Seleccionar este botón
                button.classList.add('active');

                // Guardar selección
                this.selectedBetOptions.boostLimit = button.getAttribute('data-value');

                this.updateBetPreview();
            });
        });

        // Botones de aceptar apuesta en el lobby
        this.setupBetAcceptanceListeners();

        console.log('✅ Listeners de UI configurados');
    }

    /**
     * Configura listeners para aceptar apuestas del lobby
     */
    setupBetAcceptanceListeners() {
        // Usar event delegation para botones din\u00e1micos (modal + lobby flotante)
        const containers = [
            document.querySelector('.bets-offers-list'),
            document.getElementById('lobby-float-list')
        ];
        containers.forEach(container => {
            if (!container) return;
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('bet-accept-button')) {
                    e.preventDefault();
                    const betItem = e.target.closest('.bet-offer-item');
                    if (betItem) {
                        const betData = this.extractBetDataFromDOM(betItem);
                        this.acceptBetFromLobby(betData);
                    }
                }
            });
        });
    }

    /**
     * Configura listeners de eventos blockchain
     */
    setupBlockchainListeners() {
        console.log('🔗 Configurando listeners blockchain...');

        // Listener para actualizaciones de apuestas activas
        this.bettingEngine.addBetListener('activeBetsLoaded', (bets) => {
            this.updateBetsLobby(bets);
        });

        // Listener para nuevas apuestas
        this.bettingEngine.addBetListener('betCreated', (bet) => {
            this.addBetToLobby(bet);
            this.showNotification('Nueva apuesta disponible!', 'success');
        });

        // Listener para apuestas aceptadas
        this.bettingEngine.addBetListener('betAccepted', (bet) => {
            this.removeBetFromLobby(bet.id);
            this.showNotification('\u00a1Apuesta aceptada! Iniciando partida...', 'success');            // Ocultar lobby mientras dura la partida
            if (typeof hideLobbyFloat === 'function') hideLobbyFloat();
            // Guardar bet completo para que la arena pueda leer amount/creator
            window._currentAcceptedBet = bet;
            // Abrir arena en AMBOS dispositivos (creador y aceptador)
            if (typeof fpOpenArena === 'function') {
                setTimeout(() => fpOpenArena(bet.id), 800);
            }
        });

        // Listener para apuestas completadas
        this.bettingEngine.addBetListener('betCompleted', (bet) => {
            this.showNotification('Apuesta completada!', 'success');
        });

        // Listener para boosts activados
        this.bettingEngine.addBetListener('boostActivated', (data) => {
            this.showNotification('Boost activado!', 'info');
        });

        console.log('✅ Listeners blockchain configurados');
    }

    /**
     * Abre el modal de apuestas para un tipo de juego específico
     */
    openBetModal(gameType) {
        console.log('🎯 Abriendo modal para juego:', gameType);

        if (!this.isInitialized) {
            this.showError('Sistema Web3 no inicializado');
            return;
        }

        this.currentGameType = gameType;
        this.selectedBetOptions = {
            amount: '',
            timeLimit: '',
            boostLimit: ''
        };

        // Actualizar título del modal
        const gameConfig = this.bettingEngine.getGameConfig(gameType);
        const betModalTitle = document.getElementById('bet-modal-title');
        if (betModalTitle && gameConfig) {
            betModalTitle.textContent = `CREAR APUESTA T2E: ${gameConfig.name}`;
        }

        // Resetear formulario
        this.resetBetForm();

        // Mostrar modal
        const betModal = document.getElementById('make-bet-modal');
        if (betModal) {
            betModal.classList.remove('game-menu-hidden');
            betModal.style.opacity = '1';
        }

        // Enfocar input de monto
        const betAmountInput = document.getElementById('bet-amount');
        if (betAmountInput) {
            setTimeout(() => betAmountInput.focus(), 100);
        }
    }

    /**
     * Cierra el modal de apuestas
     */
    closeBetModal() {
        const betModal = document.getElementById('make-bet-modal');
        if (betModal) {
            betModal.style.opacity = '0';
            setTimeout(() => {
                betModal.classList.add('game-menu-hidden');
            }, 300);
        }

        this.currentGameType = null;
        this.selectedBetOptions = {
            amount: '',
            timeLimit: '',
            boostLimit: ''
        };
    }

    /**
     * Resetea el formulario de apuestas
     */
    resetBetForm() {
        // Limpiar input de monto
        const betAmountInput = document.getElementById('bet-amount');
        if (betAmountInput) {
            betAmountInput.value = '';
        }

        // Deseleccionar todos los botones de opción
        const optionButtons = document.querySelectorAll('.bet-option-button');
        optionButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Resetear opciones seleccionadas
        this.selectedBetOptions = {
            amount: '',
            timeLimit: '',
            boostLimit: ''
        };

        this.updateBetPreview();
    }

    /**
     * Actualiza la vista previa de la apuesta
     */
    updateBetPreview() {
        const launchButton = document.getElementById('launch-bet-button');
        if (!launchButton) return;

        const { amount, timeLimit, boostLimit } = this.selectedBetOptions;
        const isComplete = amount && timeLimit && boostLimit && this.currentGameType;

        if (isComplete) {
            launchButton.disabled = false;
            launchButton.textContent = `🚀 LANZAR APUESTA: ${amount} USDT`;
            launchButton.style.backgroundColor = 'var(--color-caos-verde)';
        } else {
            launchButton.disabled = true;
            launchButton.textContent = '[ COMPLETA TODOS LOS CAMPOS ]';
            launchButton.style.backgroundColor = '#555';
        }
    }

    /**
     * Lanza la apuesta al blockchain
     */
    async launchBet() {
        // Guard: prevent double-submit
        if (this._creatingBet) return;
        this._creatingBet = true;
        const launchBtn = document.getElementById('launch-bet-button');
        if (launchBtn) launchBtn.disabled = true;
        try {
            if (!this.isInitialized) {
                throw new Error('Sistema no inicializado');
            }

            const { amount, timeLimit, boostLimit } = this.selectedBetOptions;

            if (!amount || !timeLimit || !boostLimit || !this.currentGameType) {
                throw new Error('Completa todos los campos');
            }

            // Preparar datos de la apuesta (declarar ANTES de usar en showLoading)
            const betData = {
                amount: amount,
                timeLimit: timeLimit,
                boostLimit: boostLimit,
                gameType: this.currentGameType
            };

            // Mostrar loading
            this.showLoading(`Esperando firma MetaMask para depositar ${betData.amount} USDT...`);

            // Crear apuesta
            const betId = await this.bettingEngine.createBet(betData);

            // Ocultar loading
            this.hideLoading();

            // Mostrar éxito con info del depósito
            this.showNotification(`✅ Depósito confirmado. Desafío activo — esperando oponente...`, 'success');

            // Cerrar modal
            this.closeBetModal();

            // NO abrimos la arena todavía: el creador espera que alguien acepte.
            // La arena se abrirá cuando Firebase dispare 'betAccepted' en ambos devices.

        } catch (error) {
            this.hideLoading();
            this.showError('Error creando apuesta: ' + error.message);
            console.error('❌ Error lanzando apuesta:', error);
        } finally {
            this._creatingBet = false;
            if (launchBtn) launchBtn.disabled = false;
        }
    }

    /**
     * Acepta una apuesta desde el lobby
     */
    async acceptBetFromLobby(betData) {
        try {
            console.log('🤝 Aceptando apuesta del lobby:', betData);

            this.showLoading('Esperando firma MetaMask para depositar...');

            // Aceptar apuesta
            await this.bettingEngine.acceptBet(betData.id);

            // Ocultar loading — la apertura de arena la dispara el listener 'betAccepted'
            this.hideLoading();

        } catch (error) {
            this.hideLoading();
            this.showError('Error aceptando apuesta: ' + error.message);
            console.error('❌ Error aceptando apuesta del lobby:', error);
        }
    }

    /**
     * Extrae datos de apuesta del DOM
     */
    extractBetDataFromDOM(betItem) {
        return {
            id: betItem.getAttribute('data-bet-id') || null
        };
    }

    async updateUI() {
        try {
            await this.updateRPPIBalance(); // ahora muestra USDT
            this.updateConnectionStatus();
            await this.updateBetsLobby();
        } catch (error) {
            console.error('❌ Error actualizando UI:', error);
        }
    }

    /**
     * Actualiza el saldo USDT en la UI
     */
    async updateRPPIBalance() {
        try {
            const balance = await this.web3Config.getUSDTBalance();
            const balanceElements = document.querySelectorAll('.rppi-balance');
            balanceElements.forEach(el => {
                el.textContent = `${parseFloat(balance).toFixed(2)} USDT`;
            });
        } catch (error) {
            // silencioso — puede fallar antes de conectar
        }
    }

    /**
     * Actualiza el estado de conexión
     */
    updateConnectionStatus() {
        const walletStatus = document.getElementById('wallet-status');
        const walletAddress = document.getElementById('wallet-address');

        if (this.web3Config.isInitialized) {
            if (walletStatus) {
                walletStatus.textContent = '✅ Conectado a Optimism';
                walletStatus.style.color = 'var(--color-caos-verde)';
            }
        } else {
            if (walletStatus) {
                walletStatus.textContent = '❌ Web3 no inicializado';
                walletStatus.style.color = '#ff4444';
            }
            if (walletAddress) {
                walletAddress.style.display = 'none';
            }
        }
    }

    /**
     * Actualiza el lobby de apuestas
     */
    async updateBetsLobby(bets = null) {
        const betsList = document.querySelector('.bets-offers-list');
        const floatList = document.getElementById('lobby-float-list');

        // Si no se pasaron apuestas, obtener del engine
        if (!bets) {
            bets = Array.from(this.bettingEngine.activeBets.values());
        }

        const emptyMsg = '<p style="text-align:center;color:#888;padding:20px;font-family:\'Courier New\',monospace;">No hay apuestas disponibles...</p>';

        // Actualizar lista en modal
        if (betsList) {
            betsList.innerHTML = '';
            if (bets.length === 0) {
                betsList.innerHTML = emptyMsg;
            } else {
                bets.forEach(bet => betsList.appendChild(this.createBetItem(bet)));
            }
        }

        // Actualizar ventana flotante
        if (floatList) {
            floatList.innerHTML = '';
            if (bets.length === 0) {
                floatList.innerHTML = emptyMsg;
            } else {
                bets.forEach(bet => floatList.appendChild(this.createBetItem(bet)));
            }
            if (typeof window.showLobbyFloat === 'function') {
                window.showLobbyFloat();
            }
        }

        console.log(`📋 Lobby actualizado con ${bets.length} apuestas`);
    }

    /**
     * Crea un elemento de apuesta para el lobby
     */
    createBetItem(bet) {
        const betItem = document.createElement('div');
        betItem.className = 'bet-offer-item';
        betItem.setAttribute('data-bet-id', bet.id);

        const gameConfig = this.bettingEngine.getGameConfig(bet.gameType);
        const gameName = gameConfig ? gameConfig.name : bet.gameType;
        const timeRemaining = this.bettingEngine.formatTimeRemaining(bet.createdAt, bet.timeLimit);

        betItem.innerHTML = `
            <span><strong>Nick:</strong> ${bet.creator.substring(0, 6)}<button onclick="navigator.clipboard.writeText('${bet.creator}')" title="Copiar wallet completa" style="background:none;border:none;cursor:pointer;padding:0 2px;font-size:0.9em;vertical-align:middle;opacity:0.8;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">📋</button>${bet.creator.substring(bet.creator.length - 4)}</span>
            <span><strong>Monto:</strong> ${bet.amount} USDT</span>
            <span><strong>Tiempo:</strong> ${timeRemaining}</span>
            <span><strong>Boosts:</strong> ${bet.boostLimit}x</span>
            <span><strong>Juego:</strong> ${gameName}</span>
            <button class="cta-button bet-accept-button">[ ACEPTAR HACK ]</button>
        `;

        return betItem;
    }

    /**
     * Agrega una apuesta al lobby
     */
    addBetToLobby(bet) {
        const betItem = this.createBetItem(bet);

        const betsList = document.querySelector('.bets-offers-list');
        if (betsList) {
            const emptyMsg = betsList.querySelector('p');
            if (emptyMsg) emptyMsg.remove();
            betsList.appendChild(betItem.cloneNode(true));
        }

        const floatList = document.getElementById('lobby-float-list');
        if (floatList) {
            const emptyMsg = floatList.querySelector('p');
            if (emptyMsg) emptyMsg.remove();
            floatList.appendChild(betItem);
            if (typeof window.showLobbyFloat === 'function') window.showLobbyFloat();
        }
    }

    /**
     * Remueve una apuesta del lobby
     */
    removeBetFromLobby(betId) {
        // querySelectorAll elimina el item en TODOS los contenedores (modal + float)
        document.querySelectorAll(`[data-bet-id="${betId}"]`).forEach(el => el.remove());

        // Verificar si las listas quedaron vacías
        const empty = '<p style="text-align:center;color:#888;padding:20px;font-family:\'Courier New\',monospace;">No hay apuestas disponibles...</p>';
        const betsList  = document.querySelector('.bets-offers-list');
        const floatList = document.getElementById('lobby-float-list');
        if (betsList  && betsList.children.length  === 0) betsList.innerHTML  = empty;
        if (floatList && floatList.children.length === 0) floatList.innerHTML = empty;
    }

    /**
     * Muestra un indicador de carga
     */
    showLoading(message = 'Procesando...') {
        // Crear overlay de loading si no existe
        let loadingOverlay = document.getElementById('t2e-loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 't2e-loading-overlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: var(--color-caos-verde);
                font-family: 'Courier New', monospace;
                font-size: 1.2em;
            `;
            document.body.appendChild(loadingOverlay);
        }

        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="font-size: 2em; margin-bottom: 20px;">⏳</div>
                <div>${message}</div>
            </div>
        `;
        loadingOverlay.style.display = 'flex';
    }

    /**
     * Oculta el indicador de carga
     */
    hideLoading() {
        const loadingOverlay = document.getElementById('t2e-loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Muestra una notificación
     */
    showNotification(message, type = 'info') {
        // Crear contenedor de notificaciones si no existe
        let notificationContainer = document.getElementById('t2e-notifications');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 't2e-notifications';
            notificationContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(notificationContainer);
        }

        // Crear notificación
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: rgba(5, 10, 15, 0.9);
            border: 2px solid ${type === 'success' ? 'var(--color-caos-verde)' : type === 'error' ? '#ff4444' : 'var(--color-caos-amarillo)'};
            color: var(--color-texto);
            padding: 15px 20px;
            margin-bottom: 10px;
            border-radius: 0;
            font-family: 'Courier New', monospace;
            animation: slideInRight 0.3s ease-out;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        `;

        notification.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #888; cursor: pointer; font-size: 1.2em;">×</button>
            </div>
        `;

        notificationContainer.appendChild(notification);

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    /**
     * Muestra un error
     */
    showError(message) {
        this.showNotification(message, 'error');
        console.error('❌ Error T2E:', message);
    }

    /**
     * Configura la ventana flotante de apuestas del usuario
     */
    setupUserBetsWindow() {
        console.log('🪟 Configurando ventana flotante de apuestas del usuario...');

        // Botón para cerrar la ventana
        const closeBtn = document.getElementById('close-user-bets-window');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideUserBetsWindow());
        }

        // Click fuera de la ventana para cerrar
        const windowElement = document.getElementById('user-bets-floating-window');
        if (windowElement) {
            windowElement.addEventListener('click', (e) => {
                if (e.target === windowElement) {
                    this.hideUserBetsWindow();
                }
            });
        }

        // Event delegation para botones de cancelar apuestas
        const betsList = document.getElementById('user-bets-list');
        if (betsList) {
            betsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('retire-hack-btn')) {
                    e.preventDefault();
                    const betId = e.target.getAttribute('data-bet-id');
                    if (betId) {
                        this.cancelUserBet(betId);
                    }
                }
            });
        }

        // Nota: La funcionalidad de mostrar apuestas al conectar wallet
        // se maneja automáticamente en updateUI() después de la inicialización

        console.log('✅ Ventana flotante de apuestas configurada');
    }

    /**
     * Muestra la ventana flotante de apuestas del usuario
     */
    async showUserBetsWindow() {
        const windowElement = document.getElementById('user-bets-floating-window');
        if (!windowElement) return;

        // Cargar apuestas del usuario
        await this.loadUserBetsIntoWindow();

        // Mostrar ventana
        windowElement.classList.remove('user-bets-floating-hidden');
        windowElement.style.opacity = '1';
    }

    /**
     * Oculta la ventana flotante de apuestas del usuario
     */
    hideUserBetsWindow() {
        const windowElement = document.getElementById('user-bets-floating-window');
        if (!windowElement) return;

        windowElement.style.opacity = '0';
        setTimeout(() => {
            windowElement.classList.add('user-bets-floating-hidden');
        }, 300);
    }

    /**
     * Carga las apuestas del usuario en la ventana flotante
     */
    async loadUserBetsIntoWindow() {
        const betsList = document.getElementById('user-bets-list');
        const emptyMessage = document.getElementById('user-bets-empty');

        if (!betsList || !emptyMessage) return;

        try {
            // Cargar apuestas del usuario desde el engine
            await this.bettingEngine.loadUserBets();
            const userBets = Array.from(this.bettingEngine.userBets.values());

            // Limpiar lista actual
            betsList.innerHTML = '';

            if (userBets.length === 0) {
                betsList.style.display = 'none';
                emptyMessage.style.display = 'block';
                return;
            }

            // Mostrar lista de apuestas
            betsList.style.display = 'block';
            emptyMessage.style.display = 'none';

            // Crear elementos para cada apuesta
            userBets.forEach(bet => {
                const betItem = this.createUserBetItem(bet);
                betsList.appendChild(betItem);
            });

            console.log(`👤 ${userBets.length} apuestas de usuario cargadas en ventana flotante`);

        } catch (error) {
            console.error('❌ Error cargando apuestas del usuario:', error);
            betsList.innerHTML = '<p style="text-align: center; color: #ff4444; padding: 20px;">Error cargando apuestas</p>';
        }
    }

    /**
     * Crea un elemento de apuesta para la ventana del usuario
     */
    createUserBetItem(bet) {
        const betItem = document.createElement('div');
        betItem.className = `user-bet-item ${this.getBetStatusClass(bet.status)}`;

        const gameConfig = this.bettingEngine.getGameConfig(bet.gameType);
        const gameName = gameConfig ? gameConfig.name : bet.gameType;
        const timeRemaining = this.bettingEngine.formatTimeRemaining(bet.createdAt, bet.timeLimit);
        const statusText = this.bettingEngine.formatBetStatus(bet.status);

        // Mostrar botón de cancelar si la apuesta está abierta (no aceptada) y pasaron 30 min
        const isOpen        = bet.status === this.web3Config.BET_STATUS.PENDING || bet.status === 'open';
        const myAddress     = this.web3Config.currentAccount;
        const isCreator     = myAddress && bet.creator?.toLowerCase() === myAddress.toLowerCase();
        const elapsed       = Date.now() - (bet.createdAt || 0);
        const canCancel     = isOpen && isCreator && elapsed >= 30 * 60 * 1000;
        const minutesLeft   = isOpen && isCreator && elapsed < 30 * 60 * 1000
            ? Math.ceil((30 * 60 * 1000 - elapsed) / 60000) : 0;
        const cancelButton  = canCancel
            ? `<button class="retire-hack-btn" data-bet-id="${bet.id}" title="Cancelar y recuperar USDT" onclick="window.T2EIntegration && window.T2EIntegration.cancelUserBet('${bet.id}')">[CANCELAR — REFUND USDT]</button>`
            : isOpen && isCreator && minutesLeft > 0
                ? `<button class="retire-hack-btn" disabled title="Esperá ${minutesLeft} min más" style="opacity:0.4;cursor:not-allowed;">[CANCELAR en ${minutesLeft} min]</button>`
                : '';

        betItem.innerHTML = `
            <div class="user-bet-header">
                <span class="user-bet-game">${gameName}</span>
                <span class="user-bet-amount">${bet.amount} $RPPI</span>
            </div>
            <div class="user-bet-details">
                <span><strong>ID:</strong> ${bet.id.substring(0, 8)}...</span>
                <span><strong>Tiempo:</strong> ${timeRemaining}</span>
                <span><strong>Boosts:</strong> ${bet.boostLimit}x</span>
            </div>
            <div class="user-bet-status ${this.getBetStatusClass(bet.status)}">
                ${statusText}
            </div>
            ${cancelButton}
        `;

        return betItem;
    }

    /**
     * Obtiene la clase CSS para el estado de la apuesta
     */
    getBetStatusClass(status) {
        const statusClasses = {
            [this.web3Config.BET_STATUS.PENDING]: 'pending',
            [this.web3Config.BET_STATUS.ACTIVE]: 'active',
            [this.web3Config.BET_STATUS.COMPLETED]: 'completed',
            [this.web3Config.BET_STATUS.CANCELLED]: 'cancelled',
            [this.web3Config.BET_STATUS.EXPIRED]: 'cancelled'
        };
        return statusClasses[status] || '';
    }

    /**
     * Cancela una apuesta abierta y solicita refund USDT al worker
     */
    async cancelUserBet(betId) {
        try {
            if (!confirm('¿Cancelar la apuesta y recuperar tu USDT? La transacción de refund puede tardar unos segundos.')) return;

            this.showLoading('Solicitando refund al worker...');

            const myAddress     = this.web3Config.currentAccount;
            const REFUND_URL    = 'https://rapid-figemini-proxy.gabrieldomail.workers.dev/refund';
            const PAYOUT_SECRET = null;

            const res  = await fetch(REFUND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Payout-Secret': PAYOUT_SECRET },
                body: JSON.stringify({ betId, requester: myAddress })
            });
            const data = await res.json();

            this.hideLoading();

            if (!data.ok) {
                this.showError('Error en refund: ' + (data.error || 'desconocido'));
                return;
            }

            const txMsg = data.refundTxHash
                ? `\nTX: ${data.refundTxHash.slice(0,10)}...`
                : ' (sin depósito on-chain)';
            this.showNotification(`✅ Apuesta cancelada — ${data.amount || ''} USDT devueltos${txMsg}`, 'success');

            await this.loadUserBetsIntoWindow();

        } catch (err) {
            this.hideLoading();
            this.showError('Error cancelando apuesta: ' + err.message);
            console.error('cancelUserBet error:', err);
        }
    }

    /**
     * Carga y muestra las apuestas del usuario (llamado cuando se conecta wallet)
     */
    async loadAndShowUserBets() {
        try {
            await this.bettingEngine.loadUserBets();
            const userBets = Array.from(this.bettingEngine.userBets.values());

            // Solo mostrar ventana si hay apuestas activas
            if (userBets.length > 0) {
                // Pequeño delay para que se note la conexión
                setTimeout(() => {
                    this.showUserBetsWindow();
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Error cargando apuestas del usuario al conectar:', error);
        }
    }

    /**
     * Utilidades para debugging
     */
    debugInfo() {
        return {
            isInitialized: this.isInitialized,
            web3Initialized: this.web3Config ? this.web3Config.isInitialized : false,
            bettingInitialized: this.bettingEngine ? this.bettingEngine.isInitialized : false,
            activeBets: this.bettingEngine ? this.bettingEngine.activeBets.size : 0,
            userBets: this.bettingEngine ? this.bettingEngine.userBets.size : 0,
            currentGameType: this.currentGameType,
            selectedOptions: this.selectedBetOptions
        };
    }
}

// Animaciones CSS para notificaciones
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(notificationStyles);

// Instancia global de integración T2E
const t2eIntegration = new T2EIntegration();

// Exportar para uso global
window.T2EIntegration = t2eIntegration;

// Inicializar automáticamente cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Pequeño delay para asegurar que todos los scripts estén cargados
        setTimeout(async () => {
            await t2eIntegration.initialize();
        }, 100);
    } catch (error) {
        console.error('❌ Error inicializando T2E Integration:', error);
    }
});
