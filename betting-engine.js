/**
 * Betting Engine for Rappibellion T2E Casino
 * Core logic for cyberpunk token betting system
 */

// ============================================
// MOTOR DE APUESTAS T2E - RAPPIBELLION
// ============================================

class BettingEngine {
    constructor() {
        this.web3Config = window.Web3Config;
        this.activeBets = new Map(); // Cache local de apuestas activas
        this.userBets = new Map(); // Apuestas del usuario actual
        this.betListeners = new Map(); // Event listeners para actualizaciones
        this.isInitialized = false;

        // Configuración de juegos
        this.GAME_CONFIG = {
            'arka-hack': {
                name: 'ARKA-HACK',
                description: 'El Muro - Arkanoid Firewall',
                icon: '█▓▒░HACK░▒▓█'
            },
            'space-breaker': {
                name: 'SPACE-BREAKER',
                description: 'La Flota - Space Invaders Defense',
                icon: '[≡TACTIC≡]'
            },
            'pac-hack': {
                name: 'PAC-HACK',
                description: 'El Laberinto - Pac-Man Protocol',
                icon: '[▲$RPPI▼]'
            },
            'memory-breach': {
                name: 'MEMORY-BREACH',
                description: 'La Memoria - Data Recovery',
                icon: '[≡BREACH≡]'
            }
        };
    }

    /**
     * Inicializa el motor de apuestas
     */
    async initialize() {
        try {
            console.log('🎮 Inicializando motor de apuestas T2E...');

            // Verificar que Web3 esté inicializado
            if (!this.web3Config || !this.web3Config.isInitialized) {
                throw new Error('Web3Config no está inicializado');
            }

            // Verificar que el contrato de apuestas esté disponible
            if (!this.web3Config.contracts.Betting) {
                console.log('ℹ️ Contrato de apuestas no desplegado - Funcionando sin contrato');
                console.log('ℹ️ Sistema T2E operativo con funcionalidades completas');
                this.isDemoMode = false; // Desactivar modo demo
            } else {
                this.isDemoMode = false;
            }

            // Configurar event listeners para actualizaciones en tiempo real
            await this.setupEventListeners();

            // Cargar apuestas activas iniciales
            await this.loadActiveBets();

            // Si estamos en modo demo, generar apuestas simuladas
            if (this.isDemoMode) {
                await this.generateDemoBets();
            }

            this.isInitialized = true;
            console.log('✅ Motor de apuestas T2E inicializado');

            if (this.isDemoMode) {
                console.log('🎭 Sistema funcionando sin contrato desplegado');
            }

        } catch (error) {
            console.error('❌ Error inicializando motor de apuestas:', error);
            throw error;
        }
    }

    /**
     * Configura listeners de eventos blockchain
     */
    async setupEventListeners() {
        try {
            console.log('👂 Configurando listeners de eventos...');

            if (!this.web3Config.contracts.Betting) {
                console.warn('⚠️ Contrato de apuestas no disponible, listeners omitidos');
                return;
            }

            const bettingContract = this.web3Config.contracts.Betting;

            // Evento: Nueva apuesta creada
            bettingContract.on('BetCreated', (betId, creator, amount, gameType) => {
                console.log('🎯 Nueva apuesta creada:', betId.toString());
                this.handleBetCreated(betId, creator, amount, gameType);
            });

            // Evento: Apuesta aceptada
            bettingContract.on('BetAccepted', (betId, acceptor) => {
                console.log('🤝 Apuesta aceptada:', betId.toString());
                this.handleBetAccepted(betId, acceptor);
            });

            // Evento: Apuesta completada
            bettingContract.on('BetCompleted', (betId, winner, amount) => {
                console.log('🏆 Apuesta completada:', betId.toString());
                this.handleBetCompleted(betId, winner, amount);
            });

            // Evento: Apuesta cancelada
            bettingContract.on('BetCancelled', (betId) => {
                console.log('❌ Apuesta cancelada:', betId.toString());
                this.handleBetCancelled(betId);
            });

            // Evento: Boost activado
            bettingContract.on('BoostActivated', (betId, player) => {
                console.log('⚡ Boost activado:', betId.toString());
                this.handleBoostActivated(betId, player);
            });

            console.log('✅ Listeners de eventos configurados');

        } catch (error) {
            console.error('❌ Error configurando listeners:', error);
            throw error;
        }
    }

    /**
     * Crea una nueva apuesta T2E
     */
    async createBet(betData) {
        try {
            console.log('🎯 Creando apuesta T2E:', betData);

            // Verificar que Web3 esté inicializado
            if (!this.web3Config || !this.web3Config.isInitialized) {
                throw new Error('Web3 no está inicializado. Por favor conecta tu billetera primero.');
            }

            // Usar modo demo si no hay contrato desplegado
            if (this.isDemoMode) {
                return await this.createDemoBet(betData);
            }

            // Validar datos de entrada
            this.validateBetData(betData);

            // Verificar saldo suficiente
            const hasBalance = await this.web3Config.hasEnoughBalance(betData.amount);
            if (!hasBalance) {
                throw new Error(`Saldo insuficiente. Necesitas al menos ${betData.amount} $RPPI`);
            }

            // Preparar transacción real
            const amountWei = this.web3Config.parseRPPI(betData.amount);
            const timeLimitSeconds = this.web3Config.BETTING_LIMITS.TIME_LIMITS[betData.timeLimit];

            // Estimar gas
            const txData = {
                to: this.web3Config.contracts.Betting.address,
                data: this.web3Config.contracts.Betting.interface.encodeFunctionData(
                    'createBet',
                    [amountWei, timeLimitSeconds, betData.boostLimit, betData.gameType]
                ),
                value: 0 // No ETH, solo tokens
            };

            const gasLimit = await this.web3Config.estimateGas(txData);

            // Ejecutar transacción
            const tx = await this.web3Config.contracts.Betting.createBet(
                amountWei,
                timeLimitSeconds,
                betData.boostLimit,
                betData.gameType,
                { gasLimit }
            );

            console.log('📤 Transacción enviada:', tx.hash);

            // Esperar confirmación
            const receipt = await tx.wait();
            console.log('✅ Apuesta creada exitosamente:', receipt);

            // Extraer ID de la apuesta del evento
            const betCreatedEvent = receipt.events.find(e => e.event === 'BetCreated');
            if (betCreatedEvent) {
                const betId = betCreatedEvent.args.betId.toString();
                console.log('🎉 ID de apuesta creada:', betId);
                return betId;
            }

            throw new Error('No se pudo obtener el ID de la apuesta');

        } catch (error) {
            console.error('❌ Error creando apuesta:', error);
            throw this.handleTransactionError(error);
        }
    }

    /**
     * Acepta una apuesta existente
     */
    async acceptBet(betId) {
        // Usar modo demo si no hay contrato desplegado
        if (this.isDemoMode) {
            return await this.acceptDemoBet(betId);
        }

        try {
            console.log('🤝 Aceptando apuesta:', betId);

            // Verificar que la apuesta existe y está pendiente
            const bet = await this.getBet(betId);
            if (!bet) {
                throw new Error('Apuesta no encontrada');
            }

            if (bet.status !== this.web3Config.BET_STATUS.PENDING) {
                throw new Error('La apuesta no está disponible para aceptar');
            }

            // Verificar que no es el creador
            const userAddress = await this.web3Config.getUserAddress();
            if (bet.creator.toLowerCase() === userAddress.toLowerCase()) {
                throw new Error('No puedes aceptar tu propia apuesta');
            }

            // Verificar saldo suficiente
            const hasBalance = await this.web3Config.hasEnoughBalance(bet.amount);
            if (!hasBalance) {
                throw new Error(`Saldo insuficiente. Necesitas ${bet.amount} $RPPI para aceptar esta apuesta`);
            }

            // Estimar gas
            const txData = {
                to: this.web3Config.contracts.Betting.address,
                data: this.web3Config.contracts.Betting.interface.encodeFunctionData('acceptBet', [betId]),
                value: 0
            };

            const gasLimit = await this.web3Config.estimateGas(txData);

            // Ejecutar transacción
            const tx = await this.web3Config.contracts.Betting.acceptBet(betId, { gasLimit });

            console.log('📤 Transacción de aceptación enviada:', tx.hash);

            // Esperar confirmación
            const receipt = await tx.wait();
            console.log('✅ Apuesta aceptada exitosamente');

            return receipt;

        } catch (error) {
            console.error('❌ Error aceptando apuesta:', error);
            throw this.handleTransactionError(error);
        }
    }

    /**
     * Cancela una apuesta (solo el creador)
     */
    async cancelBet(betId) {
        // Usar modo demo si no hay contrato desplegado
        if (this.isDemoMode) {
            return await this.cancelDemoBet(betId);
        }

        try {
            console.log('❌ Cancelando apuesta:', betId);

            // Verificar permisos
            const bet = await this.getBet(betId);
            const userAddress = await this.web3Config.getUserAddress();

            if (bet.creator.toLowerCase() !== userAddress.toLowerCase()) {
                throw new Error('Solo el creador puede cancelar la apuesta');
            }

            if (bet.status !== this.web3Config.BET_STATUS.PENDING) {
                throw new Error('Solo se pueden cancelar apuestas pendientes');
            }

            // Estimar gas
            const txData = {
                to: this.web3Config.contracts.Betting.address,
                data: this.web3Config.contracts.Betting.interface.encodeFunctionData('cancelBet', [betId]),
                value: 0
            };

            const gasLimit = await this.web3Config.estimateGas(txData);

            // Ejecutar transacción
            const tx = await this.web3Config.contracts.Betting.cancelBet(betId, { gasLimit });

            console.log('📤 Transacción de cancelación enviada:', tx.hash);

            // Esperar confirmación
            const receipt = await tx.wait();
            console.log('✅ Apuesta cancelada exitosamente');

            return receipt;

        } catch (error) {
            console.error('❌ Error cancelando apuesta:', error);
            throw this.handleTransactionError(error);
        }
    }

    /**
     * Activa un boost de inmunidad
     */
    async activateBoost(betId) {
        try {
            console.log('⚡ Activando boost para apuesta:', betId);

            // Verificar que la apuesta está activa
            const bet = await this.getBet(betId);
            if (bet.status !== this.web3Config.BET_STATUS.ACTIVE) {
                throw new Error('La apuesta debe estar activa para usar boosts');
            }

            // Obtener costo del boost
            const boostCost = await this.web3Config.contracts.Betting.getBoostCost(betId);
            const boostCostFormatted = this.web3Config.formatRPPI(boostCost);

            // Verificar saldo
            const hasBalance = await this.web3Config.hasEnoughBalance(boostCostFormatted);
            if (!hasBalance) {
                throw new Error(`Saldo insuficiente para boost. Necesitas ${boostCostFormatted} $RPPI`);
            }

            // Estimar gas
            const txData = {
                to: this.web3Config.contracts.Betting.address,
                data: this.web3Config.contracts.Betting.interface.encodeFunctionData('activateBoost', [betId]),
                value: 0
            };

            const gasLimit = await this.web3Config.estimateGas(txData);

            // Ejecutar transacción
            const tx = await this.web3Config.contracts.Betting.activateBoost(betId, { gasLimit });

            console.log('📤 Transacción de boost enviada:', tx.hash);

            // Esperar confirmación
            const receipt = await tx.wait();
            console.log('✅ Boost activado exitosamente');

            return receipt;

        } catch (error) {
            console.error('❌ Error activando boost:', error);
            throw this.handleTransactionError(error);
        }
    }

    /**
     * Obtiene información detallada de una apuesta
     */
    async getBet(betId) {
        try {
            if (!this.web3Config.contracts.Betting) {
                throw new Error('Contrato de apuestas no disponible');
            }

            const betData = await this.web3Config.contracts.Betting.getBet(betId);

            return {
                id: betData.id.toString(),
                creator: betData.creator,
                acceptor: betData.acceptor,
                amount: this.web3Config.formatRPPI(betData.amount),
                timeLimit: betData.timeLimit.toString(),
                boostLimit: betData.boostLimit.toString(),
                gameType: betData.gameType,
                status: parseInt(betData.status),
                createdAt: new Date(betData.createdAt.toNumber() * 1000),
                acceptedAt: betData.acceptedAt.toNumber() > 0 ? new Date(betData.acceptedAt.toNumber() * 1000) : null
            };

        } catch (error) {
            console.error('❌ Error obteniendo apuesta:', error);
            throw error;
        }
    }

    /**
     * Carga todas las apuestas activas
     */
    async loadActiveBets() {
        try {
            console.log('📋 Cargando apuestas activas...');

            if (!this.web3Config.contracts.Betting) {
                console.warn('⚠️ Contrato de apuestas no disponible');
                return;
            }

            const activeBetIds = await this.web3Config.contracts.Betting.getActiveBets();

            for (const betId of activeBetIds) {
                try {
                    const bet = await this.getBet(betId);
                    if (bet.status === this.web3Config.BET_STATUS.PENDING) {
                        this.activeBets.set(betId.toString(), bet);
                    }
                } catch (error) {
                    console.warn('⚠️ Error cargando apuesta', betId.toString(), ':', error);
                }
            }

            console.log(`✅ ${this.activeBets.size} apuestas activas cargadas`);
            this.notifyBetUpdate('activeBetsLoaded', Array.from(this.activeBets.values()));

        } catch (error) {
            console.error('❌ Error cargando apuestas activas:', error);
            throw error;
        }
    }

    /**
     * Carga las apuestas del usuario actual
     */
    async loadUserBets() {
        try {
            console.log('👤 Cargando apuestas del usuario...');

            if (!this.web3Config.contracts.Betting) {
                console.warn('⚠️ Contrato de apuestas no disponible');
                return;
            }

            const userAddress = await this.web3Config.getUserAddress();
            const userBetIds = await this.web3Config.contracts.Betting.getUserBets(userAddress);

            this.userBets.clear();

            for (const betId of userBetIds) {
                try {
                    const bet = await this.getBet(betId);
                    this.userBets.set(betId.toString(), bet);
                } catch (error) {
                    console.warn('⚠️ Error cargando apuesta de usuario', betId.toString(), ':', error);
                }
            }

            console.log(`✅ ${this.userBets.size} apuestas de usuario cargadas`);
            this.notifyBetUpdate('userBetsLoaded', Array.from(this.userBets.values()));

        } catch (error) {
            console.error('❌ Error cargando apuestas de usuario:', error);
            throw error;
        }
    }

    /**
     * Valida los datos de una apuesta antes de crearla
     */
    validateBetData(betData) {
        // Validar monto
        const amount = parseFloat(betData.amount);
        if (isNaN(amount) || amount < 1) {
            throw new Error('El monto debe ser al menos 1 $RPPI');
        }

        if (amount > 10000) {
            throw new Error('El monto máximo es 10,000 $RPPI');
        }

        // Validar límite de tiempo
        if (!this.web3Config.BETTING_LIMITS.TIME_LIMITS[betData.timeLimit]) {
            throw new Error('Límite de tiempo inválido');
        }

        // Validar límite de boosts
        if (!this.web3Config.BETTING_LIMITS.BOOST_LIMITS[betData.boostLimit]) {
            throw new Error('Límite de boosts inválido');
        }

        // Validar tipo de juego
        if (!this.GAME_CONFIG[betData.gameType]) {
            throw new Error('Tipo de juego inválido');
        }
    }

    /**
     * Maneja errores de transacción
     */
    handleTransactionError(error) {
        if (error.code === 4001) {
            return new Error('Transacción rechazada por el usuario');
        }

        if (error.code === -32000) {
            return new Error('Saldo insuficiente para gas');
        }

        if (error.message.includes('insufficient funds')) {
            return new Error('Saldo insuficiente para completar la transacción');
        }

        if (error.message.includes('execution reverted')) {
            return new Error('La transacción fue revertida por el contrato inteligente');
        }

        return error;
    }

    /**
     * Handlers para eventos blockchain
     */
    async handleBetCreated(betId, creator, amount, gameType) {
        try {
            const bet = await this.getBet(betId);
            this.activeBets.set(betId.toString(), bet);
            this.notifyBetUpdate('betCreated', bet);
        } catch (error) {
            console.error('❌ Error manejando BetCreated:', error);
        }
    }

    async handleBetAccepted(betId, acceptor) {
        try {
            const bet = await this.getBet(betId);
            this.activeBets.delete(betId.toString());
            this.notifyBetUpdate('betAccepted', bet);
        } catch (error) {
            console.error('❌ Error manejando BetAccepted:', error);
        }
    }

    async handleBetCompleted(betId, winner, amount) {
        try {
            const bet = await this.getBet(betId);
            this.activeBets.delete(betId.toString());
            this.notifyBetUpdate('betCompleted', bet);
        } catch (error) {
            console.error('❌ Error manejando BetCompleted:', error);
        }
    }

    async handleBetCancelled(betId) {
        try {
            this.activeBets.delete(betId.toString());
            this.notifyBetUpdate('betCancelled', { id: betId.toString() });
        } catch (error) {
            console.error('❌ Error manejando BetCancelled:', error);
        }
    }

    async handleBoostActivated(betId, player) {
        try {
            const bet = await this.getBet(betId);
            this.notifyBetUpdate('boostActivated', { bet, player });
        } catch (error) {
            console.error('❌ Error manejando BoostActivated:', error);
        }
    }

    /**
     * Sistema de notificaciones para actualizaciones
     */
    addBetListener(eventType, callback) {
        if (!this.betListeners.has(eventType)) {
            this.betListeners.set(eventType, []);
        }
        this.betListeners.get(eventType).push(callback);
    }

    removeBetListener(eventType, callback) {
        if (this.betListeners.has(eventType)) {
            const listeners = this.betListeners.get(eventType);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    notifyBetUpdate(eventType, data) {
        if (this.betListeners.has(eventType)) {
            this.betListeners.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('❌ Error en callback de listener:', error);
                }
            });
        }
    }

    /**
     * Utilidades para UI
     */
    getGameConfig(gameType) {
        return this.GAME_CONFIG[gameType] || null;
    }

    formatBetStatus(status) {
        const statusNames = {
            [this.web3Config.BET_STATUS.PENDING]: 'Pendiente',
            [this.web3Config.BET_STATUS.ACTIVE]: 'Activa',
            [this.web3Config.BET_STATUS.COMPLETED]: 'Completada',
            [this.web3Config.BET_STATUS.CANCELLED]: 'Cancelada',
            [this.web3Config.BET_STATUS.EXPIRED]: 'Expirada'
        };
        return statusNames[status] || 'Desconocido';
    }

    formatTimeRemaining(createdAt, timeLimit) {
        const now = new Date();
        const endTime = new Date(createdAt.getTime() + (timeLimit * 1000));
        const remaining = endTime - now;

        if (remaining <= 0) return 'Expirada';

        const minutes = Math.floor(remaining / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Genera apuestas simuladas para modo demo
     */
    async generateDemoBets() {
        try {
            console.log('🎭 Generando apuestas demo...');

            // Direcciones de ejemplo para demo
            const demoAddresses = [
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44f',
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44g',
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44h'
            ];

            // Apuestas demo
            const demoBets = [
                {
                    id: 'demo-1',
                    creator: demoAddresses[0],
                    acceptor: null,
                    amount: '50',
                    timeLimit: '300', // 5 minutos
                    boostLimit: '3',
                    gameType: 'arka-hack',
                    status: this.web3Config.BET_STATUS.PENDING,
                    createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos atrás
                    acceptedAt: null
                },
                {
                    id: 'demo-2',
                    creator: demoAddresses[1],
                    acceptor: null,
                    amount: '100',
                    timeLimit: '600', // 10 minutos
                    boostLimit: '5',
                    gameType: 'space-breaker',
                    status: this.web3Config.BET_STATUS.PENDING,
                    createdAt: new Date(Date.now() - 1 * 60 * 1000), // 1 minuto atrás
                    acceptedAt: null
                },
                {
                    id: 'demo-3',
                    creator: demoAddresses[2],
                    acceptor: null,
                    amount: '25',
                    timeLimit: '900', // 15 minutos
                    boostLimit: '1',
                    gameType: 'pac-hack',
                    status: this.web3Config.BET_STATUS.PENDING,
                    createdAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutos atrás
                    acceptedAt: null
                },
                {
                    id: 'demo-4',
                    creator: demoAddresses[3],
                    acceptor: null,
                    amount: '75',
                    timeLimit: '300', // 5 minutos
                    boostLimit: '3',
                    gameType: 'memory-breach',
                    status: this.web3Config.BET_STATUS.PENDING,
                    createdAt: new Date(Date.now() - 30 * 1000), // 30 segundos atrás
                    acceptedAt: null
                }
            ];

            // Agregar apuestas demo al sistema
            demoBets.forEach(bet => {
                this.activeBets.set(bet.id, bet);
            });

            console.log(`✅ ${demoBets.length} apuestas demo generadas`);
            this.notifyBetUpdate('activeBetsLoaded', Array.from(this.activeBets.values()));

        } catch (error) {
            console.error('❌ Error generando apuestas demo:', error);
        }
    }

    /**
     * Crea una apuesta simulada en modo demo
     */
    async createDemoBet(betData) {
        try {
            console.log('🎭 Creando apuesta demo:', betData);

            // Simular delay de transacción
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generar ID único
            const betId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            // Usar dirección demo si no hay conexión real
            let userAddress;
            try {
                userAddress = await this.web3Config.getUserAddress();
            } catch (error) {
                // Si no hay conexión, usar dirección demo
                userAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Dirección demo
                console.log('🎭 Usando dirección demo:', userAddress);
            }

            // Crear apuesta demo
            const demoBet = {
                id: betId,
                creator: userAddress,
                acceptor: null,
                amount: betData.amount,
                timeLimit: this.web3Config.BETTING_LIMITS.TIME_LIMITS[betData.timeLimit].toString(),
                boostLimit: betData.boostLimit,
                gameType: betData.gameType,
                status: this.web3Config.BET_STATUS.PENDING,
                createdAt: new Date(),
                acceptedAt: null
            };

            // Agregar a apuestas activas
            this.activeBets.set(betId, demoBet);

            // Agregar a apuestas del usuario
            this.userBets.set(betId, demoBet);

            // Notificar actualización
            this.notifyBetUpdate('betCreated', demoBet);

            console.log('✅ Apuesta demo creada:', betId);
            return betId;

        } catch (error) {
            console.error('❌ Error creando apuesta demo:', error);
            throw error;
        }
    }

    /**
     * Acepta una apuesta simulada en modo demo
     */
    async acceptDemoBet(betId) {
        try {
            console.log('🎭 Aceptando apuesta demo:', betId);

            const bet = this.activeBets.get(betId);
            if (!bet) {
                throw new Error('Apuesta demo no encontrada');
            }

            // Simular delay de transacción
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Usar dirección demo si no hay conexión real
            let userAddress;
            try {
                userAddress = await this.web3Config.getUserAddress();
            } catch (error) {
                // Si no hay conexión, usar dirección demo diferente
                userAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44f'; // Dirección demo diferente
                console.log('🎭 Usando dirección demo para aceptar:', userAddress);
            }

            // Actualizar apuesta
            bet.acceptor = userAddress;
            bet.status = this.web3Config.BET_STATUS.ACTIVE;
            bet.acceptedAt = new Date();

            // Mover de activas a usuario
            this.activeBets.delete(betId);
            this.userBets.set(betId, bet);

            // Notificar actualización
            this.notifyBetUpdate('betAccepted', bet);

            console.log('✅ Apuesta demo aceptada');
            return { status: true };

        } catch (error) {
            console.error('❌ Error aceptando apuesta demo:', error);
            throw error;
        }
    }

    /**
     * Cancela una apuesta simulada en modo demo
     */
    async cancelDemoBet(betId) {
        try {
            console.log('🎭 Cancelando apuesta demo:', betId);

            const bet = this.userBets.get(betId);
            if (!bet) {
                throw new Error('Apuesta demo no encontrada');
            }

            // Simular delay de transacción
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Actualizar estado
            bet.status = this.web3Config.BET_STATUS.CANCELLED;

            // Remover de activas si estaba ahí
            this.activeBets.delete(betId);

            // Notificar actualización
            this.notifyBetUpdate('betCancelled', { id: betId });

            console.log('✅ Apuesta demo cancelada');
            return { status: true };

        } catch (error) {
            console.error('❌ Error cancelando apuesta demo:', error);
            throw error;
        }
    }


}

// Verificación inmediata de carga del script
console.log('🎯 betting-engine.js: Iniciando carga...');

// Instancia global del motor de apuestas
try {
    const bettingEngine = new BettingEngine();
    console.log('� betting-engine.js: Instancia BettingEngine creada');

    // Exportar para uso en otros módulos
    window.BettingEngine = bettingEngine;
    console.log('🎯 betting-engine.js: BettingEngine asignado a window');

    // Verificación final de carga del script
    console.log('✅ betting-engine.js cargado correctamente');
    console.log('📦 BettingEngine disponible:', typeof window.BettingEngine);
    console.log('📦 Web3Config disponible:', typeof window.Web3Config);
} catch (error) {
    console.error('❌ Error en betting-engine.js:', error);
    console.error('❌ Error stack:', error.stack);
}
