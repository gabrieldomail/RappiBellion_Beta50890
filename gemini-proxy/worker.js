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
const FB_DB_URL = 'https://rappibellion-default-rtdb.firebaseio.com'; // ajustar si el proyecto tiene otro nombre

const OPENROUTER_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'qwen/qwen2.5-7b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
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

    // ── Gemini / OpenRouter proxy (ruta por defecto) ──────────────────────
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Worker: API key no configurada' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    try {
      // Recibe formato Gemini del frontend — convierte a OpenAI para OpenRouter
      const body = await request.json();

      const messages = [];

      // System instruction
      const sysText = body?.systemInstruction?.parts?.[0]?.text;
      if (sysText) messages.push({ role: 'system', content: sysText });

      // Historial de conversación
      for (const turn of (body.contents || [])) {
        const text = turn?.parts?.[0]?.text || '';
        const role = turn.role === 'model' ? 'assistant' : 'user';
        messages.push({ role, content: text });
      }

      // Intenta cada modelo en orden hasta que uno funcione
      let lastError = 'No models available';
      for (const model of OPENROUTER_MODELS) {
        const orRes = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://rappibellion.com',
            'X-Title': 'Rappibellion',
          },
          body: JSON.stringify({ model, messages }),
        });

        const data = await orRes.json();

        if (!orRes.ok) {
          lastError = data?.error?.message || 'OpenRouter error';
          // Errores de modelo/proveedor → probar el siguiente
          const retryable = orRes.status === 404 || orRes.status === 503 || orRes.status === 529 ||
            lastError.includes('No endpoints') || lastError.includes('not found') ||
            lastError.includes('Provider returned error') || lastError.includes('overloaded') ||
            lastError.includes('unavailable') || lastError.includes('not a valid model') ||
            lastError.includes('invalid model');
          if (retryable) continue;
          // Auth / rate limit global — no tiene sentido reintentar
          return new Response(JSON.stringify({ error: { message: lastError } }),
            { status: orRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Convierte respuesta OpenAI → formato Gemini para el frontend
        const replyText = data?.choices?.[0]?.message?.content || '';
        const geminiResponse = {
          candidates: [{ content: { parts: [{ text: replyText }] } }]
        };

        return new Response(JSON.stringify(geminiResponse), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Todos los modelos fallaron
      return new Response(JSON.stringify({ error: { message: lastError } }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (err) {
      return new Response(JSON.stringify({ error: { message: 'Worker error: ' + err.message } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  }
};

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
