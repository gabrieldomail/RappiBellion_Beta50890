// Rappibellion — AI Proxy Worker (OpenRouter)
// La API key se guarda en Variables de Entorno (Secrets), nunca en el código
import { ethers } from 'ethers';

const ALLOWED_ORIGINS = [
  'https://rappibellion.com',
  'https://www.rappibellion.com',
  'https://gabrieldomail.github.io',
];

// ── Configuración de pagos ─────────────────────────────────────────────────
const OPTIMISM_RPC      = 'https://mainnet.optimism.io';
const USDT_ADDRESS      = '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58'; // USDT Optimism
const HOUSE_FEE_PCT     = 3;    // 3% del pozo
const BOOST_COST_USDT   = 1.0;  // 1 USDT por boost
const USDT_DECIMALS     = 6;

// ABI mínimo ERC-20 para transferir USDT
const USDT_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)'
];

// Firebase REST base URL (Realtime DB)
const FB_DB_URL          = 'https://rappibellion-comments-default-rtdb.firebaseio.com'; // apuestas / bets (misma DB que comments)
const FB_COMMENTS_DB_URL = 'https://rappibellion-comments-default-rtdb.firebaseio.com'; // opiniones / comments

// ── Pool de opiniones diarias (seed automático via cron) ──────────────────────
const SEED_OPINIONS = [
  { username: 'CryptoPibe_BA',    opinion: 'Jugué 3 duelos y gané 2. El sistema T2E funciona diferente, no es suerte sino velocidad mental. Me gustó mucho.' },
  { username: 'xX_NeoHacker_Xx', opinion: 'Al principio pensé que era como todos los P2E de siempre pero no. PAC-HACK es adictivo y encima te pagás el café si ganás jaja' },
  { username: 'LauraDeFuego',     opinion: 'Me pareció muy original. La UI está buena, el circuito carga rápido. Espero que cuando salga completo tenga más modos de juego.' },
  { username: 'ElViejo_Hodler',   opinion: 'Llevo años en crypto y esto me parece uno de los conceptos más frescos que vi. T2E tiene sentido: si sos bueno ganás, punto.' },
  { username: 'NachoCriptoNerd',  opinion: 'Perdí el primer duelo por UN segundo de diferencia. Me voy a entrenar y vuelvo. RAPPIA va a ser grande.' },
  { username: 'Marisol_9000',     opinion: 'Me costó conectar la wallet al principio pero una vez dentro voló. El sistema de BOOST está bueno para darle emoción.' },
  { username: 'darknet_gaucho',   opinion: 'El concepto de Think-to-Earn es lo que faltaba. Nada de staking aburrido, acá te medís contra otro humano. Eso sí es un juego.' },
  { username: 'SebastianX',       opinion: 'Beta muy sólida. El flujo apuesta → duelo → pago funciona muy bien. Sigan así.' },
  { username: 'CrackDelTeclado',  opinion: 'Tres duelos hoy. Gané los tres. No sé si mis rivales estaban dormidos pero RAPPIA pega diferente 👀' },
  { username: 'AgusWEB3',         opinion: 'El T2E me parece el futuro de los juegos crypto. Rappibellion va por buen camino, solo falta más marketing para que explote.' },
  { username: 'PixelBandit_OK',   opinion: 'Jugué en modo gratuito para practicar y después metí fichas reales. Buena decisión. Gané mi primer duel con 5 puntos de ventaja.' },
  { username: 'MarianoStake',     opinion: 'Qué locura encontrar un proyecto tan bien armado. La interfaz es top, el PAC-HACK es divertidísimo.' },
  { username: 'SilverHands2025',  opinion: 'Los boosts cambian el juego completamente. Estrategia pura. Me fui con +3 USDT después de 2 horas. No está nada mal.' },
  { username: 'Roque_Despierto',  opinion: 'Soy escéptico de todo en crypto pero esto me convenció. Es simple: ganás o perdés en base a lo que jugás. Sin trampa.' },
  { username: 'turbodelcia',      opinion: 'El circuito lag un poco el primer día pero hoy estuvo perfecta toda la sesión. Quedé top 3 en el ranking. Fuego 🔥' },
  { username: 'Valentina_NFT',    opinion: 'El sistema de duelos evita los bots porque necesitás jugar de verdad. Eso vale mucho en este ambiente.' },
  { username: 'EL_GRAN_PICHI',    opinion: 'Peeero por qué no saqué esto antes jajaja. Llevaba meses buscando algo entretenido en web3. Rappia to the moon 🚀' },
];

// ── Pool de aplicantes al staff (seed cada 2 días via cron) ──────────────────
const SEED_STAFF_APPS = [
  { username: 'GonzaFuerte_BA',   statement: 'Llevo 2 años en gaming web3 y Rappibellion es el único proyecto que me parece honesto. Quiero ser parte del equipo que lo lleva al próximo nivel.' },
  { username: 'Tomi_Arcade',      statement: 'Soy diseñador UX y gamer desde los 10 años. El T2E de Rappia es exactamente el concepto que esperaba que alguien construyera. Me uno o muero en el intento.' },
  { username: 'NathyDev',         statement: 'Front-end dev con experiencia en DApps. Vi el código del circuito y está prolijo. Quiero aportar en la parte visual y en testing de la beta.' },
  { username: 'ElRebelde_Crypto', statement: 'Community manager con 4k seguidores en X. Ya estoy hablando de Rappibellion en mis posts. Hagámoslo oficial.' },
  { username: 'PichiMarketer',    statement: 'Trabajo en marketing digital crypto. La propuesta de T2E es vendible sin hype vacío, solo con el producto. Quiero ser el que lo comunique.' },
  { username: 'ZeusCodex',        statement: 'Fullstack con Solidity. He auditado contratos para 3 proyectos DeFi. Rappibellion necesita alguien que cuide el código on-chain. Soy ese alguien.' },
  { username: 'Camila_Web3',      statement: 'Estoy haciendo mi tesis sobre gamificación en blockchain y Rappibellion es mi caso de estudio favorito. Quiero aprender y aportar a la vez.' },
  { username: 'MatiasRPPI',       statement: 'Moderé comunidades de 10k+ usuarios. El orden y la energía positiva en una comunidad crypto hacen la diferencia. Yo lo sé hacer.' },
  { username: 'darkfire_gamer',   statement: 'Top 5 en el ranking de la beta. Si alguien conoce las mecánicas de PAC-HACK de adentro, soy yo. Quiero ayudar a equilibrar los duelos.' },
  { username: 'ValentinaPixel',   statement: 'Illustradora y animadora 2D. El arte de Rappia ya está bueno pero yo tengo ideas para llevarlo al siguiente nivel. Portafolio listo para compartir.' },
];

// ── Wallets ficticias para el ranking simulado ──────────────────────────────
const _W = [
  '0xd9e7f2a4c8b1e3d5f7a9c2e4b6d8f1a3c5e7b9d1', // rebelde_alpha
  '0x7b3d5f9a1c4e7b2d4f6a8c1e3b5d7f9a2c4e6b8d', // sombra_digital
  '0x4c8e2a6f1d5b9e3c7a1f5d9b3e7c1a5f9d3b7e2c', // crack_0xff
  '0x1f4a8c2e6b9d3f7a1c5e9b2d6f8a3c7e1b4d8f2a', // turbo_hack
  '0x8d2f6b1e4a9c3f7d1b5e9a2f4d8c1b3f7e2a6d9c', // pichi_neo
];

// ── Pool de duelos simulados (seed cada 3 días via cron) ─────────────────────
// W[0] = 3 wins | W[1] = 2 wins | W[2] = 2 wins | W[3] = 1 win | W[4] = 2 wins
const SEED_BETS = [
  { creator: _W[0], acceptor: _W[1], amount: 10, winner: _W[0] }, // W0 win #1
  { creator: _W[1], acceptor: _W[2], amount: 5,  winner: _W[1] }, // W1 win #1
  { creator: _W[2], acceptor: _W[0], amount: 8,  winner: _W[2] }, // W2 win #1
  { creator: _W[0], acceptor: _W[3], amount: 5,  winner: _W[0] }, // W0 win #2
  { creator: _W[3], acceptor: _W[1], amount: 10, winner: _W[3] }, // W3 win #1
  { creator: _W[4], acceptor: _W[0], amount: 5,  winner: _W[0] }, // W0 win #3
  { creator: _W[1], acceptor: _W[4], amount: 8,  winner: _W[1] }, // W1 win #2
  { creator: _W[2], acceptor: _W[4], amount: 5,  winner: _W[4] }, // W4 win #1
  { creator: _W[3], acceptor: _W[2], amount: 10, winner: _W[2] }, // W2 win #2
  { creator: _W[4], acceptor: _W[3], amount: 5,  winner: _W[4] }, // W4 win #2
];

const GEMINI_MODEL        = 'gemini-2.5-flash';
const GEMINI_API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default {
  async fetch(request, env) {    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ── Routing ──────────────────────────────────────────────────────────────
    if (url.pathname === '/payout') {
      return handlePayout(request, env, corsHeaders);
    }
    if (url.pathname === '/refund') {
      return handleRefund(request, env, corsHeaders);
    }
    if (url.pathname === '/dispute') {
      return handleDispute(request, env, corsHeaders);
    }
    if (url.pathname === '/contact') {
      return handleContact(request, env, corsHeaders);
    }
    // ── Gemini API proxy (passthrough — el frontend ya envía formato Gemini) ──
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Worker: API key no configurada' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      const body = await request.json();
      const res  = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status:  res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Worker error: ' + err.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  },

  // ── Cron triggers ──────────────────────────────────────────────────────────
  // 0 10 * * *    → 1 opinión T2E por día (10:00 UTC)
  // 0 16 */2 * *  → 1 aplicante al staff cada 2 días (16:00 UTC)
  // 0 12 */3 * *  → 1 duelo simulado en el ranking cada 3 días (12:00 UTC)
  async scheduled(event, env, ctx) {
    if (event.cron === '0 16 */2 * *') {
      ctx.waitUntil(seedStaffApplication(event.scheduledTime, env));
    } else if (event.cron === '0 12 */3 * *') {
      ctx.waitUntil(seedSimulatedBet(event.scheduledTime, env));
    } else {
      ctx.waitUntil(seedDailyOpinion(event.scheduledTime, env));
    }
  }
};

// ── seedDailyOpinion — publica una opinión automática en Firebase ─────────────
async function seedDailyOpinion(scheduledTime, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[seed] FIREBASE_SERVICE_ACCOUNT no configurado');
    return;
  }

  // Elegir opinión según el número de día (cicla la pool completa)
  const dayIndex = Math.floor(scheduledTime / 1000 / 86400);
  const entry    = SEED_OPINIONS[dayIndex % SEED_OPINIONS.length];

  // Timestamp con variación aleatoria ±2h para que no siempre aparezca a la misma hora exacta
  const jitterMs   = Math.floor((Math.random() * 4 - 2) * 60 * 60 * 1000);
  const timestamp  = scheduledTime + jitterMs;
  const date       = new Date(timestamp).toLocaleString('es-ES', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  });

  const opinion = {
    username:  entry.username,
    opinion:   entry.opinion,
    timestamp,
    date,
    seeded:    true   // flag para distinguirlas de las reales si alguna vez hace falta
  };

  try {
    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const res = await fetch(`${FB_COMMENTS_DB_URL}/t2e-opinions.json?auth=${fbToken}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(opinion)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[seed] Firebase error:', err);
    } else {
      console.log(`[seed] Opinión publicada: ${entry.username} (día ${dayIndex})`);
    }
  } catch (err) {
    console.error('[seed] Error general:', err.message);
  }
}

// ── seedStaffApplication — publica una aplicación al staff cada 2 días ────────
async function seedStaffApplication(scheduledTime, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[staff-seed] FIREBASE_SERVICE_ACCOUNT no configurado');
    return;
  }

  // Ciclar la pool por número de evento (día / 2)
  const eventIndex = Math.floor(scheduledTime / 1000 / 86400 / 2);
  const entry      = SEED_STAFF_APPS[eventIndex % SEED_STAFF_APPS.length];

  // Jitter ±3h para que no aparezca siempre a la misma hora exacta
  const jitterMs  = Math.floor((Math.random() * 6 - 3) * 60 * 60 * 1000);
  const timestamp = scheduledTime + jitterMs;
  const date      = new Date(timestamp).toLocaleString('es-ES', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  });

  const application = {
    username:  entry.username,
    message:   entry.statement,   // campo que espera el frontend
    timestamp,
    date,
    seeded:    true
  };

  try {
    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const res = await fetch(`${FB_COMMENTS_DB_URL}/rebellion-comments.json?auth=${fbToken}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(application)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[staff-seed] Firebase error:', err);
    } else {
      console.log(`[staff-seed] Aplicación publicada: ${entry.username} (evento ${eventIndex})`);
    }
  } catch (err) {
    console.error('[staff-seed] Error general:', err.message);
  }
}

// ── seedSimulatedBet — publica un duelo completado en el ranking cada 3 días ──
async function seedSimulatedBet(scheduledTime, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[lb-seed] FIREBASE_SERVICE_ACCOUNT no configurado');
    return;
  }

  // Ciclar la pool por número de evento (día / 3)
  const eventIndex = Math.floor(scheduledTime / 1000 / 86400 / 3);
  const entry      = SEED_BETS[eventIndex % SEED_BETS.length];

  // Jitter ±4h para timestamps realistas
  const jitterMs  = Math.floor((Math.random() * 8 - 4) * 60 * 60 * 1000);
  const paidAt    = scheduledTime + jitterMs;
  const createdAt = paidAt - Math.floor((Math.random() * 30 + 5) * 60 * 1000); // 5-35 min antes

  const amount   = entry.amount;
  const totalPot = amount * 2;
  const houseFee = totalPot * (HOUSE_FEE_PCT / 100);
  const prize    = totalPot - houseFee;

  const bet = {
    creator:      entry.creator,
    acceptor:     entry.acceptor,
    amount:       amount,
    status:       'paid',
    payoutStatus: 'completed',
    winner:       entry.winner,
    prize:        prize.toFixed(6),
    houseFee:     houseFee.toFixed(6),
    createdAt,
    paidAt,
    creatorTxHash:  '0xsimulated_' + Math.random().toString(16).slice(2,18),
    acceptorTxHash: '0xsimulated_' + Math.random().toString(16).slice(2,18),
    payoutTxHash:   '0xsimulated_' + Math.random().toString(16).slice(2,18),
    seeded: true,
  };

  try {
    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const res = await fetch(`${FB_DB_URL}/t2e_bets.json?auth=${fbToken}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(bet)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[lb-seed] Firebase error:', err);
    } else {
      console.log(`[lb-seed] Duelo publicado: ${entry.winner.slice(0,8)}... ganó ${prize.toFixed(2)} USDT (evento ${eventIndex})`);
    }
  } catch (err) {
    console.error('[lb-seed] Error general:', err.message);
  }
}

// ── /payout handler ───────────────────────────────────────────────────────────
// Body esperado: { betId, winner, playerScore, rivalScore, boostsP1, boostsP2 }
async function handlePayout(request, env, corsHeaders) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  let betId; // hoisted — accesible en catch para marcar fallo en Firebase
  try {
    // 1. Validar secrets y autenticación
    if (!env.PAYOUT_PRIVATE_KEY)      return json({ error: 'PAYOUT_PRIVATE_KEY no configurado' }, 500);
    if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'FIREBASE_SERVICE_ACCOUNT no configurado' }, 500);

    // Verificar PAYOUT_SECRET (defensa en profundidad contra llamadas externas)
    if (env.PAYOUT_SECRET) {
      const reqSecret = request.headers.get('X-Payout-Secret');
      if (!reqSecret || reqSecret !== env.PAYOUT_SECRET) {
        return json({ error: 'No autorizado' }, 401);
      }
    }

    const body = await request.json();
    betId = body.betId; // asignada al let hoisted
    const { winner, playerScore, rivalScore, boostsP1 = 0, boostsP2 = 0 } = body;

    if (!betId || !winner) return json({ error: 'betId y winner son requeridos' }, 400);

    // 2. Leer apuesta de Firebase
    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const betRes  = await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`);
    const bet     = await betRes.json();

    if (!bet) return json({ error: 'Apuesta no encontrada' }, 404);
    if (bet.status === 'paid' || bet.payoutStatus === 'completed') {
      return json({ error: 'Apuesta ya pagada' }, 400);
    }

    // 3. Verificar que winner es participante legítimo (previene fraude)
    const validWinners = [bet.creator, bet.acceptor].filter(Boolean).map(a => a.toLowerCase());
    if (!validWinners.includes(winner.toLowerCase())) {
      return json({ error: 'winner no es participante de esta apuesta' }, 403);
    }

    // 4. Verificar que ambos depósitos existen en Firebase
    if (!bet.creatorTxHash || !bet.acceptorTxHash) {
      return json({ error: 'Faltan txHash de depósitos — jugadores no confirmaron' }, 400);
    }

    // 5. Calcular premio
    const amount      = parseFloat(bet.amount);
    const totalPot    = amount * 2;
    const totalBoosts = (parseInt(boostsP1) + parseInt(boostsP2)) * BOOST_COST_USDT;
    const houseFee    = totalPot * (HOUSE_FEE_PCT / 100);
    const prize       = totalPot - houseFee - totalBoosts;

    if (prize <= 0) return json({ error: 'Premio calculado es 0 o negativo' }, 400);

    // 6. Enviar USDT al ganador via ethers (bundleado via npm)
    const provider = new ethers.providers.JsonRpcProvider(OPTIMISM_RPC);
    const wallet   = new ethers.Wallet(env.PAYOUT_PRIVATE_KEY, provider);
    const usdt     = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

    const prizeRaw = ethers.utils.parseUnits(prize.toFixed(6), USDT_DECIMALS);
    const tx       = await usdt.transfer(winner, prizeRaw);
    const receipt  = await tx.wait(1);

    // 7. Marcar apuesta como pagada en Firebase
    await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:       'paid',
        payoutStatus: 'completed',
        winner,
        prize:        prize.toFixed(6),
        payoutTxHash: receipt.transactionHash,
        paidAt:       Date.now(),
        scores:       { p1: playerScore, p2: rivalScore },
        boosts:       { p1: boostsP1, p2: boostsP2 },
        houseFee:     houseFee.toFixed(6)
      })
    });

    return json({
      ok:      true,
      winner,
      prize:   prize.toFixed(2),
      txHash:  receipt.transactionHash,
      houseFee: houseFee.toFixed(2)
    });

  } catch (err) {
    console.error('[payout] error:', err);
    // Marcar fallo en Firebase para trazabilidad y habilitar retry desde la UI
    if (betId && env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
        await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payoutStatus: 'failed', payoutError: err.message, failedAt: Date.now() })
        });
      } catch (_) { /* si Firebase también falla, no bloquear la respuesta */ }
    }
    return json({ error: 'Payout error: ' + err.message }, 500);
  }
}

// ── /dispute handler ────────────────────────────────────────────────────────
// Body esperado: { betId, requester, reason? }
// Cualquiera de los dos jugadores puede dispararlo.
// Condiciones para activarse:
//   a) El duelo está en 'in_progress' y pasaron más de DISPUTE_TIMEOUT_MS desde startedAt
//   b) O el frontend detectó un crash y envía reason: 'bug' (igual aplica el timeout como mínimo)
// Resultado: reembolso total a ambos jugadores (bet.amount × 2 txs). La casa absorbe el gas.
const DISPUTE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos desde que arrancó el duelo

async function handleDispute(request, env, corsHeaders) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (!env.PAYOUT_PRIVATE_KEY)       return json({ error: 'PAYOUT_PRIVATE_KEY no configurado' }, 500);
    if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'FIREBASE_SERVICE_ACCOUNT no configurado' }, 500);

    if (env.PAYOUT_SECRET) {
      const reqSecret = request.headers.get('X-Payout-Secret');
      if (!reqSecret || reqSecret !== env.PAYOUT_SECRET) {
        return json({ error: 'No autorizado' }, 401);
      }
    }

    const { betId, requester, reason } = await request.json();
    if (!betId || !requester) return json({ error: 'betId y requester son requeridos' }, 400);

    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const betRes  = await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`);
    const bet     = await betRes.json();

    if (!bet) return json({ error: 'Apuesta no encontrada' }, 404);

    // Bloquear si ya fue resuelta
    if (['paid', 'cancelled', 'disputed'].includes(bet.status) ||
        ['completed', 'refunded_both', 'refunded_creator'].includes(bet.payoutStatus)) {
      return json({ error: `Apuesta ya resuelta — estado: ${bet.status}` }, 400);
    }

    // Verificar que el requester es participante legítimo
    const participants = [bet.creator, bet.acceptor].filter(Boolean).map(a => a.toLowerCase());
    if (!participants.includes(requester.toLowerCase())) {
      return json({ error: 'Solo los participantes del duelo pueden abrir un dispute' }, 403);
    }

    // Verificar timeout — el duelo debe llevar al menos DISPUTE_TIMEOUT_MS sin resolverse
    const referenceTime = bet.startedAt || bet.createdAt || 0;
    const elapsed = Date.now() - referenceTime;
    if (elapsed < DISPUTE_TIMEOUT_MS) {
      const minutesLeft = Math.ceil((DISPUTE_TIMEOUT_MS - elapsed) / 60000);
      return json({
        error: `Dispute disponible en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''} — el duelo aún puede resolverse normalmente`
      }, 400);
    }

    const amount   = parseFloat(bet.amount);
    const provider = new ethers.providers.JsonRpcProvider(OPTIMISM_RPC);
    const wallet   = new ethers.Wallet(env.PAYOUT_PRIVATE_KEY, provider);
    const usdt     = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);
    const amountRaw = ethers.utils.parseUnits(amount.toFixed(6), USDT_DECIMALS);

    const txHashes = {};

    // Reembolsar al creador si depositó
    if (bet.creatorTxHash && bet.creator) {
      const tx = await usdt.transfer(bet.creator, amountRaw);
      const receipt = await tx.wait(1);
      txHashes.creator = receipt.transactionHash;
    }

    // Reembolsar al acceptor si depositó
    if (bet.acceptorTxHash && bet.acceptor) {
      const tx = await usdt.transfer(bet.acceptor, amountRaw);
      const receipt = await tx.wait(1);
      txHashes.acceptor = receipt.transactionHash;
    }

    const refundedCount = Object.keys(txHashes).length;
    const payoutStatus  = refundedCount === 2 ? 'refunded_both' : refundedCount === 1 ? 'refunded_creator' : 'cancelled_no_deposit';

    // Marcar como disputada en Firebase
    await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:          'disputed',
        payoutStatus,
        disputedAt:      Date.now(),
        disputeReason:   reason || 'timeout',
        disputeBy:       requester,
        refundTxCreator: txHashes.creator  || null,
        refundTxAcceptor:txHashes.acceptor || null,
      })
    });

    return json({
      ok:               true,
      payoutStatus,
      refundedPlayers:  refundedCount,
      amountEach:       amount.toFixed(2),
      txCreator:        txHashes.creator  || null,
      txAcceptor:       txHashes.acceptor || null,
      note:             'Gas de las transacciones absorbido por la casa.'
    });

  } catch (err) {
    console.error('[dispute] error:', err);
    return json({ error: 'Dispute error: ' + err.message }, 500);
  }
}

// ── /refund handler ───────────────────────────────────────────────────────────
// Body esperado: { betId }
// Solo puede llamarlo el creador — se verifica contra bet.creator en Firebase
// Solo aplica si la apuesta NO fue aceptada aún (status === 'open')
// Mínimo 30 minutos desde la creación antes de poder cancelar
const REFUND_MIN_WAIT_MS = 30 * 60 * 1000; // 30 minutos

async function handleRefund(request, env, corsHeaders) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    if (!env.PAYOUT_PRIVATE_KEY)       return json({ error: 'PAYOUT_PRIVATE_KEY no configurado' }, 500);
    if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'FIREBASE_SERVICE_ACCOUNT no configurado' }, 500);

    if (env.PAYOUT_SECRET) {
      const reqSecret = request.headers.get('X-Payout-Secret');
      if (!reqSecret || reqSecret !== env.PAYOUT_SECRET) {
        return json({ error: 'No autorizado' }, 401);
      }
    }

    const { betId, requester } = await request.json();
    if (!betId || !requester) return json({ error: 'betId y requester son requeridos' }, 400);

    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const betRes  = await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`);
    const bet     = await betRes.json();

    if (!bet)                    return json({ error: 'Apuesta no encontrada' }, 404);
    if (bet.status !== 'open')   return json({ error: `No se puede cancelar — estado actual: ${bet.status}` }, 400);
    if (bet.payoutStatus === 'completed') return json({ error: 'Apuesta ya pagada' }, 400);

    // Solo el creador puede pedir el refund
    if (bet.creator?.toLowerCase() !== requester.toLowerCase()) {
      return json({ error: 'Solo el creador puede cancelar la apuesta' }, 403);
    }

    // Verificar tiempo mínimo de espera
    const elapsed = Date.now() - (bet.createdAt || 0);
    if (elapsed < REFUND_MIN_WAIT_MS) {
      const minutesLeft = Math.ceil((REFUND_MIN_WAIT_MS - elapsed) / 60000);
      return json({ error: `Esperá ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''} más antes de cancelar` }, 400);
    }

    if (!bet.creatorTxHash) {
      // No hubo depósito on-chain — solo marcar como cancelada en Firebase
      await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', cancelledAt: Date.now() })
      });
      return json({ ok: true, refundTxHash: null, note: 'Sin depósito — apuesta cancelada sin transferencia' });
    }

    // Devolver USDT al creador
    const amount   = parseFloat(bet.amount);
    const provider = new ethers.providers.JsonRpcProvider(OPTIMISM_RPC);
    const wallet   = new ethers.Wallet(env.PAYOUT_PRIVATE_KEY, provider);
    const usdt     = new ethers.Contract(USDT_ADDRESS, USDT_ABI, wallet);

    const refundRaw = ethers.utils.parseUnits(amount.toFixed(6), USDT_DECIMALS);
    const tx        = await usdt.transfer(bet.creator, refundRaw);
    const receipt   = await tx.wait(1);

    // Marcar como cancelada en Firebase
    await fetch(`${FB_DB_URL}/t2e_bets/${betId}.json?auth=${fbToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status:        'cancelled',
        payoutStatus:  'refunded',
        cancelledAt:   Date.now(),
        refundTxHash:  receipt.transactionHash
      })
    });

    return json({ ok: true, refundTxHash: receipt.transactionHash, amount: amount.toFixed(2) });

  } catch (err) {
    console.error('[refund] error:', err);
    return json({ error: 'Refund error: ' + err.message }, 500);
  }
}

// ── /contact handler ──────────────────────────────────────────────────────────
// Body: { wallet, email, subject, message, betId? }
// Genera ticket RPPI-XXXXXX, guarda en Firebase /contact_tickets, envía emails via Resend
async function handleContact(request, env, corsHeaders) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Body inválido' }, 400);

    const { wallet, email, subject, message, betId } = body;
    if (!wallet || !email || !subject || !message)
      return json({ error: 'Faltan campos requeridos' }, 400);

    // Validaciones básicas de seguridad
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet))
      return json({ error: 'Wallet inválida' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: 'Email inválido' }, 400);
    if (message.length > 2000)
      return json({ error: 'Mensaje demasiado largo (máx 2000 caracteres)' }, 400);

    // Generar ticket ID: RPPI- + 6 hex mayúsculas
    const ticketId  = 'RPPI-' + Math.random().toString(16).slice(2, 8).toUpperCase();
    const createdAt = Date.now();

    // Guardar en Firebase
    if (env.FIREBASE_SERVICE_ACCOUNT) {
      const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
      await fetch(`${FB_DB_URL}/contact_tickets/${ticketId}.json?auth=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          wallet,
          email,
          subject,
          message,
          betId: betId || null,
          createdAt,
          status: 'open'
        })
      });
    }

    // Enviar emails via Resend API
    if (env.RESEND_API_KEY) {
      const resendHeaders = {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      };

      // Notificación interna al equipo
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: resendHeaders,
        body: JSON.stringify({
          from: 'Rappibellion Soporte <info@rappibellion.com>',
          to: ['info@rappibellion.com'],
          reply_to: email,
          subject: `[${ticketId}] ${subject}`,
          html: `
<h3 style="font-family:monospace;color:#ffdc00;background:#050a0f;padding:8px 12px;margin:0;">
  NUEVO TICKET &mdash; ${ticketId}
</h3>
<table style="font-family:monospace;font-size:13px;border-collapse:collapse;width:100%;margin-top:12px;">
  <tr><td style="padding:4px 8px;color:#555;width:100px;">Ticket</td><td style="padding:4px 8px;font-weight:bold;">${ticketId}</td></tr>
  <tr><td style="padding:4px 8px;color:#555;">Wallet</td><td style="padding:4px 8px;">${wallet}</td></tr>
  <tr><td style="padding:4px 8px;color:#555;">Email</td><td style="padding:4px 8px;">${email}</td></tr>
  <tr><td style="padding:4px 8px;color:#555;">Asunto</td><td style="padding:4px 8px;">${subject}</td></tr>
  <tr><td style="padding:4px 8px;color:#555;">Bet ID</td><td style="padding:4px 8px;">${betId || '&mdash;'}</td></tr>
</table>
<div style="font-family:monospace;font-size:13px;margin-top:12px;padding:12px;background:#f5f5f5;white-space:pre-wrap;">${message}</div>
          `
        })
      });

      // Auto-respuesta al usuario
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: resendHeaders,
        body: JSON.stringify({
          from: 'Rappibellion Soporte <info@rappibellion.com>',
          to: [email],
          subject: `Tu ticket fue recibido &mdash; ${ticketId}`,
          html: `
<div style="font-family:monospace;background:#050a0f;color:#e0e0e0;padding:24px;max-width:480px;">
  <h2 style="color:#ffdc00;font-size:16px;letter-spacing:3px;margin-bottom:4px;">RAPPIBELLION SOPORTE</h2>
  <p style="color:rgba(255,220,0,0.5);font-size:11px;letter-spacing:2px;margin-top:0;">// TICKET RECIBIDO //</p>
  <hr style="border:1px solid rgba(255,220,0,0.2);margin:16px 0;">
  <p>Recibimos tu consulta. Tu n&uacute;mero de ticket es:</p>
  <p style="font-size:22px;font-weight:bold;color:#ffdc00;letter-spacing:4px;margin:16px 0;">${ticketId}</p>
  <p>Asunto: <strong>${subject}</strong></p>
  <p style="color:rgba(255,255,255,0.5);font-size:12px;">Te respondemos en menos de 48hs h&aacute;biles.</p>
  <hr style="border:1px solid rgba(255,220,0,0.2);margin:16px 0;">
  <p style="color:rgba(255,255,255,0.35);font-size:10px;">&mdash; Equipo Rappibellion &middot; info@rappibellion.com</p>
</div>
          `
        })
      });
    }

    return json({ ok: true, ticketId });

  } catch (err) {
    console.error('[contact] error:', err);
    return json({ error: 'Contact error: ' + err.message }, 500);
  }
}

// ── Firebase Auth Token (Service Account → Bearer token) ─────────────────────
// ── Firebase Auth Token (Service Account → Bearer token) ─────────────────────
async function getFirebaseToken(serviceAccountJson) {
  const sa   = JSON.parse(serviceAccountJson);
  const now  = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
  };

  // Crear JWT firmado con RS256 usando la private key del service account
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g,'');
  const payload = btoa(JSON.stringify(claim)).replace(/=/g,'');
  const toSign  = `${header}.${payload}`;

  const keyData = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sigBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(toSign)
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');

  const jwt = `${toSign}.${sig}`;

  // Intercambiar JWT por access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}
