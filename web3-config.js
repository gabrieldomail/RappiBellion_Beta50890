/**
 * Web3 Configuration for Rappibellion T2E Casino
 * Cyberpunk betting system with $RPPI token on Optimism
 */

// ============================================
// CONFIGURACIÓN WEB3 - RAPPIBELLION T2E
// ============================================

class Web3Config {
    constructor() {
        this.isInitialized = false;
        this.provider = null;
        this.signer = null;
        this.contracts = {};
        this.networkConfig = {
            optimism: {
                chainId: '0xa', // 10 en decimal
                chainName: 'Optimism',
                nativeCurrency: {
                    name: 'Ethereum',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['https://mainnet.optimism.io'],
                blockExplorerUrls: ['https://optimistic.etherscan.io']
            }
        };

        // ── USDT en Optimism (modo producción) ──────────────────────────────
        this.USDT_CONFIG = {
            address: '0x91a25d42AcA05858f692CaC03Cb20BFAC9315732',
            abi: [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)"
            ],
            decimals: 6,   // USDT usa 6 decimales
            symbol: 'USDT'
        };

        // Wallet de la casa — recibe depósitos de ambos jugadores
        this.HOUSE_WALLET = '0xFea26FAA14722548Fbf45be049b5BD38F239D464';

        // Fee structure
        this.HOUSE_FEE_PCT  = 3;    // 3% del pozo total
        this.BOOST_COST_USDT = 1;   // 1 USDT fijo por boost

        // Mantener $RPPI config para compatibilidad visual (símbolo en UI)
        this.RPPI_CONFIG = {
            address: '0xb2f681ba962a1ef4dba7acf79b181814827abddc',
            abi: [
                "function balanceOf(address owner) view returns (uint256)",
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)"
            ],
            decimals: 18,
            symbol: '$RPPI'
        };

        // Configuración del contrato de apuestas T2E
        this.BETTING_CONTRACT_CONFIG = {
            // TODO: Desplegar contrato inteligente y agregar address aquí
            address: null, // Se configurará después del despliegue
            abi: [
                // Funciones del contrato de apuestas
                "function createBet(uint256 amount, uint256 timeLimit, uint256 boostLimit, string memory gameType) payable returns (uint256)",
                "function acceptBet(uint256 betId) payable returns (bool)",
                "function cancelBet(uint256 betId) returns (bool)",
                "function completeBet(uint256 betId, address winner) returns (bool)",
                "function getBet(uint256 betId) view returns (tuple(uint256 id, address creator, address acceptor, uint256 amount, uint256 timeLimit, uint256 boostLimit, string gameType, uint8 status, uint256 createdAt, uint256 acceptedAt))",
                "function getActiveBets() view returns (uint256[])",
                "function getUserBets(address user) view returns (uint256[])",
                "function activateBoost(uint256 betId) payable returns (bool)",
                "function getBoostCost(uint256 betId) view returns (uint256)",

                // Eventos
                "event BetCreated(uint256 indexed betId, address indexed creator, uint256 amount, string gameType)",
                "event BetAccepted(uint256 indexed betId, address indexed acceptor)",
                "event BetCompleted(uint256 indexed betId, address indexed winner, uint256 amount)",
                "event BetCancelled(uint256 indexed betId)",
                "event BoostActivated(uint256 indexed betId, address indexed player)"
            ]
        };

        // Configuración de límites y costos (lazy initialization)
        this._bettingLimits = null;
        this.getBettingLimits = () => {
            if (!this._bettingLimits) {
                if (typeof ethers === 'undefined') {
                    throw new Error('Ethers.js no está cargado');
                }
                this._bettingLimits = {
                    MIN_BET_AMOUNT: ethers.utils.parseEther("1"), // 1 $RPPI mínimo
                    MAX_BET_AMOUNT: ethers.utils.parseEther("10000"), // 10,000 $RPPI máximo
                    TIME_LIMITS: {
                        "5": 5 * 60, // 5 minutos en segundos
                        "10": 10 * 60, // 10 minutos
                        "15": 15 * 60  // 15 minutos
                    },
                    BOOST_LIMITS: {
                        "1": 1,
                        "3": 3,
                        "5": 5
                    },
                    BOOST_COST_PERCENTAGE: 10, // 10% del monto de la apuesta por boost
                    GAS_LIMIT_MULTIPLIER: 1.2 // Multiplicador para gas limit
                };
            }
            return this._bettingLimits;
        };

        // Estados de apuestas (constante interna)
        this._BET_STATUS = {
            PENDING: 0,
            ACTIVE: 1,
            COMPLETED: 2,
            CANCELLED: 3,
            EXPIRED: 4
        };

        // Tipos de juegos disponibles (constante interna)
        this._GAME_TYPES = {
            ARKA_HACK: "arka-hack",
            SPACE_BREAKER: "space-breaker",
            PAC_HACK: "pac-hack",
            MEMORY_BREACH: "memory-breach"
        };
    }

    /**
     * Inicializa la configuración Web3
     */
    async initialize() {
        try {
            console.log('🔧 Inicializando configuración Web3...');

            // Verificar si MetaMask está disponible
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask no está instalado');
            }

            // Crear provider y signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();

            // Verificar red
            await this.checkNetwork();

            // Inicializar contratos
            await this.initializeContracts();

            this.isInitialized = true;
            console.log('✅ Configuración Web3 inicializada correctamente');

            return true;

        } catch (error) {
            console.error('❌ Error inicializando Web3:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * Verifica y cambia a la red Optimism si es necesario
     */
    async checkNetwork() {
        try {
            const network = await this.provider.getNetwork();
            const optimismChainId = parseInt(this.networkConfig.optimism.chainId, 16);

            if (network.chainId !== optimismChainId) {
                console.log('🔄 Cambiando a red Optimism...');

                try {
                    // Intentar cambiar a Optimism
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: this.networkConfig.optimism.chainId }],
                    });
                } catch (switchError) {
                    // Si la red no está agregada, agregarla
                    if (switchError.code === 4902) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [this.networkConfig.optimism],
                        });
                    } else {
                        throw switchError;
                    }
                }

                // Recargar provider después del cambio
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
            }

            console.log('✅ Conectado a Optimism');
        } catch (error) {
            console.error('❌ Error verificando red:', error);
            throw new Error('Error conectando a la red Optimism');
        }
    }

    /**
     * Inicializa los contratos inteligentes
     */
    async initializeContracts() {
        try {
            console.log('📄 Inicializando contratos...');

            // Contrato USDT en Optimism (producción)
            this.contracts.USDT = new ethers.Contract(
                this.USDT_CONFIG.address,
                this.USDT_CONFIG.abi,
                this.signer
            );

            // Contrato $RPPI (mantener para compatibilidad)
            this.contracts.RPPI = new ethers.Contract(
                this.RPPI_CONFIG.address,
                this.RPPI_CONFIG.abi,
                this.signer
            );

            // Contrato de apuestas (si está desplegado)
            if (this.BETTING_CONTRACT_CONFIG.address) {
                try {
                    this.contracts.Betting = new ethers.Contract(
                        this.BETTING_CONTRACT_CONFIG.address,
                        this.BETTING_CONTRACT_CONFIG.abi,
                        this.signer
                    );
                    console.log('✅ Contrato de apuestas encontrado');
                } catch (error) {
                    console.warn('⚠️ Contrato de apuestas no disponible:', error.message);
                    this.contracts.Betting = null;
                }
            } else {
                console.log('ℹ️ Modo demo: Sin contrato de apuestas desplegado');
                this.contracts.Betting = null;
            }

            console.log('✅ Contratos inicializados');
        } catch (error) {
            console.error('❌ Error inicializando contratos:', error);
            throw error;
        }
    }

    /**
     * Deposita USDT a la house wallet — llamado al crear/aceptar una apuesta
     * @param {string} amountUsdt — monto en USDT (ej: "10")
     * @returns {string} txHash de la transacción
     */
    async depositToHouse(amountUsdt) {
        try {
            if (!this.contracts.USDT) throw new Error('Contrato USDT no inicializado');
            // USDT tiene 6 decimales
            const amountRaw = ethers.utils.parseUnits(amountUsdt.toString(), 6);
            const tx = await this.contracts.USDT.transfer(this.HOUSE_WALLET, amountRaw);
            console.log('💸 Depósito enviado, esperando confirmación...');
            const receipt = await tx.wait(1); // 1 confirmación es suficiente en Optimism
            console.log('✅ Depósito confirmado:', receipt.transactionHash);
            return receipt.transactionHash;
        } catch (error) {
            console.error('❌ Error en depósito:', error);
            // Mensajes de error legibles para el usuario
            if (error.code === 4001) throw new Error('Transacción rechazada por el usuario');
            if (error.message && error.message.includes('insufficient')) throw new Error('Saldo USDT insuficiente');
            throw error;
        }
    }

    /**
     * Obtiene el saldo USDT del usuario
     */
    async getUSDTBalance(address = null) {
        try {
            const userAddress = address || await this.signer.getAddress();
            const balance = await this.contracts.USDT.balanceOf(userAddress);
            return ethers.utils.formatUnits(balance, 6);
        } catch (error) {
            console.error('❌ Error obteniendo saldo USDT:', error);
            return '0';
        }
    }

    /**
     * Obtiene el saldo de $RPPI del usuario (mantenido para compatibilidad)
     */
    async getRPPIBalance(address = null) {
        try {
            const userAddress = address || await this.signer.getAddress();
            const balance = await this.contracts.RPPI.balanceOf(userAddress);
            return ethers.utils.formatEther(balance);
        } catch (error) {
            console.error('❌ Error obteniendo saldo RPPI:', error);
            return '0';
        }
    }

    /**
     * Obtiene la dirección del usuario conectado
     */
    async getUserAddress() {
        try {
            // Verificar si hay cuentas conectadas
            const accounts = await this.provider.listAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('No hay cuentas conectadas. Por favor conecta MetaMask.');
            }

            // Verificar si el signer está disponible
            if (!this.signer) {
                throw new Error('Signer no disponible. Web3 no está inicializado correctamente.');
            }

            return await this.signer.getAddress();
        } catch (error) {
            console.error('❌ Error obteniendo dirección del usuario:', error);
            throw new Error('MetaMask no está conectado. Haz clic en "CONECTA TU BILLETERA" primero.');
        }
    }

    /**
     * Verifica si el usuario tiene suficiente USDT
     */
    async hasEnoughBalance(amount) {
        try {
            const balance = await this.getUSDTBalance();
            return parseFloat(balance) >= parseFloat(amount);
        } catch (error) {
            console.error('❌ Error verificando saldo:', error);
            return false;
        }
    }

    /**
     * Formatea cantidad de $RPPI
     */
    formatRPPI(amount) {
        return ethers.utils.formatEther(amount);
    }

    /**
     * Parsea cantidad de $RPPI
     */
    parseRPPI(amount) {
        return ethers.utils.parseEther(amount.toString());
    }

    /**
     * Obtiene información de gas estimada
     */
    async estimateGas(tx) {
        try {
            const gasEstimate = await this.provider.estimateGas(tx);
            const limits = this.getBettingLimits();
            return gasEstimate.mul(limits.GAS_LIMIT_MULTIPLIER);
        } catch (error) {
            console.error('❌ Error estimando gas:', error);
            throw error;
        }
    }

    // Getter para BETTING_LIMITS (para compatibilidad)
    get BETTING_LIMITS() {
        return this.getBettingLimits();
    }

    // Getter para BET_STATUS (para compatibilidad)
    get BET_STATUS() {
        return this._BET_STATUS;
    }

    // Getter para GAME_TYPES (para compatibilidad)
    get GAME_TYPES() {
        return this._GAME_TYPES;
    }
}

// Verificación inmediata de carga del script
console.log('🔧 web3-config.js: Iniciando carga...');

// Instancia global de configuración Web3
try {
    const web3Config = new Web3Config();
    console.log('🔧 web3-config.js: Instancia Web3Config creada');

    // Exportar para uso en otros módulos
    window.Web3Config = web3Config;
    console.log('🔧 web3-config.js: Web3Config asignado a window');

    // Verificación final de carga del script
    console.log('✅ web3-config.js cargado correctamente');
    console.log('📦 Web3Config disponible:', typeof window.Web3Config);
    console.log('📦 ethers.js disponible:', typeof ethers);
} catch (error) {
    console.error('❌ Error en web3-config.js:', error);
    console.error('❌ Error stack:', error.stack);
}
