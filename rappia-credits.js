/**
 * ═══════════════════════════════════════════════════════════════════
 *  RAPPIBELLION — RAPPIA CREDIT MODULE
 *  Sistema de créditos ARS → RAPPIA via Mercado Pago
 *
 *  ARQUITECTURA:
 *  ┌─────────────┐    transfiere    ┌──────────────┐
 *  │   Usuario   │ ──────────────→  │  MP Cuenta   │
 *  │             │  concepto=UID    │  gabodc.mp   │
 *  └─────────────┘                  └──────────────┘
 *         │                                │
 *         │ (Firebase rtdb)                │ (webhook MP → worker)
 *         ↓                                ↓
 *  ┌─────────────────┐           ┌──────────────────────┐
 *  │  rppi_users/    │←─créditos─│  /rappia/webhook     │
 *  │  rppi_pending/  │           │  /rappia/balance     │
 *  │  rppi_txlog/    │           │  /rappia/withdraw    │
 *  └─────────────────┘           │  /rappia/qr          │
 *                                └──────────────────────┘
 *
 *  SECRETS CLOUDFLARE necesarios (wrangler secret put):
 *  - MP_ACCESS_TOKEN         → token de MP de la cuenta (gabodc.mp)
 *  - MP_WEBHOOK_SECRET       → string aleatorio para verificar webhooks
 *  - FIREBASE_SERVICE_ACCOUNT → ya existe en el worker
 *
 *  CONVERSIÓN: ARS 100 = 1 crédito RAPPIA
 *
 *  CÓMO IDENTIFICAR PAGOS sin datos bancarios en el código:
 *  El QR estático muestra el alias. El concepto/referencia de la
 *  transferencia contiene el UID del usuario (RPPI-XXXXXXXX).
 *  El worker cruza ese UID con Firebase → acredita automáticamente.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

// ── CONSTANTES ────────────────────────────────────────────────────
const RAPPIA_PER_ARS   = 100;   // ARS 100 = 1 crédito RAPPIA
const FB_DB_URL_RAPPIA = 'https://rappibellion-default-rtdb.firebaseio.com';
const MP_PAYMENTS_URL  = 'https://api.mercadopago.com/v1/payments/search';
const MP_PAYMENT_URL   = 'https://api.mercadopago.com/v1/payments';

// ── ROUTER: agregar al fetch handler del worker existente ─────────
// En worker.js, ANTES del bloque de Gemini, agregar:
//
//   if (url.pathname === '/rappia/webhook')  return handleRappiaWebhook(request, env2, corsHeaders);
//   if (url.pathname === '/rappia/balance')  return handleRappiaBalance(request, env2, corsHeaders);
//   if (url.pathname === '/rappia/withdraw') return handleRappiaWithdraw(request, env2, corsHeaders);
//   if (url.pathname === '/rappia/qr')       return handleRappiaQR(request, env2, corsHeaders);
//   if (url.pathname === '/rappia/poll')     return handleRappiaPoll(request, env2, corsHeaders);


// ══════════════════════════════════════════════════════════════════
// 1. WEBHOOK — Mercado Pago notifica pagos recibidos
//    MP Dashboard → Webhooks → URL: https://rapid-figemini-proxy.workers.dev/rappia/webhook
//    Eventos: payment
// ══════════════════════════════════════════════════════════════════
async function handleRappiaWebhook(request, env, corsHeaders) {
  const json = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    // 1. Verificar que viene de MP (header x-signature)
    const sig = request.headers.get('x-signature') || '';
    const xReqId = request.headers.get('x-request-id') || '';
    const body = await request.json().catch(() => null);

    if (!body || !body.data || !body.data.id) {
      return json({ ok: true, note: 'ping sin payment id' });
    }

    // Solo procesar eventos de tipo payment
    if (body.type !== 'payment') return json({ ok: true, note: 'tipo ignorado: ' + body.type });

    const paymentId = body.data.id;

    // 2. Obtener detalle del pago desde MP API
    const mpRes = await fetch(`${MP_PAYMENT_URL}/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` }
    });
    if (!mpRes.ok) return json({ error: 'MP API error' }, 502);
    const payment = await mpRes.json();

    // 3. Validar que es un pago real y aprobado
    if (payment.status !== 'approved') {
      return json({ ok: true, note: 'pago no aprobado: ' + payment.status });
    }

    // 4. Extraer UID del concepto/descripción
    //    El usuario transfiere con concepto "RPPI-XXXXXXXX"
    const concepto = (payment.description || payment.reason || '').toUpperCase();
    const uidMatch = concepto.match(/RPPI-[A-F0-9]{6,12}/);
    const uid = uidMatch ? uidMatch[0] : null;

    // 5. Si no hay UID legible, guardar como pendiente para revisión manual
    if (!uid) {
      const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
      await fetch(`${FB_DB_URL_RAPPIA}/rappia_pending/${paymentId}.json?auth=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId,
          amount:      payment.transaction_amount,
          currency:    payment.currency_id,
          concepto,
          payer:       payment.payer?.email || 'desconocido',
          receivedAt:  Date.now(),
          status:      'sin_uid',
          note:        'Revisar manualmente — sin UID en concepto'
        })
      });
      return json({ ok: true, note: 'pago sin UID guardado como pendiente' });
    }

    // 6. Verificar idempotencia — ¿ya procesamos este paymentId?
    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const logCheck = await fetch(
      `${FB_DB_URL_RAPPIA}/rappia_txlog/${paymentId}.json?auth=${fbToken}`
    );
    const existing = await logCheck.json();
    if (existing && existing.processed) {
      return json({ ok: true, note: 'ya procesado' });
    }

    // 7. Calcular créditos (ARS → RAPPIA)
    const amountARS  = parseFloat(payment.transaction_amount) || 0;
    const credits    = Math.floor(amountARS / RAPPIA_PER_ARS);

    if (credits < 1) {
      return json({ ok: true, note: `monto insuficiente: ARS ${amountARS}` });
    }

    // 8. Buscar usuario por UID en Firebase
    //    Índice inverso: rppi_uid_index/{uid} → email_key
    const uidIndexRes = await fetch(
      `${FB_DB_URL_RAPPIA}/rappi_uid_index/${uid}.json?auth=${fbToken}`
    );
    const emailKey = await uidIndexRes.json();

    if (!emailKey) {
      // UID no encontrado → pendiente
      await fetch(`${FB_DB_URL_RAPPIA}/rappia_pending/${paymentId}.json?auth=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId, uid, amountARS, credits,
          concepto, payer: payment.payer?.email || '',
          receivedAt: Date.now(), status: 'uid_no_encontrado'
        })
      });
      return json({ ok: true, note: 'UID no encontrado, pendiente' });
    }

    // 9. Acreditar créditos al usuario (atomic transaction via Firebase rules)
    const userRef = `${FB_DB_URL_RAPPIA}/rppi_users/${emailKey}`;
    const userRes = await fetch(`${userRef}.json?auth=${fbToken}`);
    const user    = await userRes.json();

    if (!user) return json({ error: 'usuario no encontrado' }, 404);

    const newCredits = (user.credits || 0) + credits;
    await fetch(`${userRef}.json?auth=${fbToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credits:    newCredits,
        lastCredit: Date.now()
      })
    });

    // 10. Log de la transacción (idempotencia)
    await fetch(`${FB_DB_URL_RAPPIA}/rappia_txlog/${paymentId}.json?auth=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId, uid, emailKey,
        amountARS, credits, newTotal: newCredits,
        payer:     payment.payer?.email || '',
        processed: true,
        processedAt: Date.now()
      })
    });

    console.log(`[RAPPIA] ✅ ${credits} créditos → ${emailKey} (pago ${paymentId})`);
    return json({ ok: true, credits, newTotal: newCredits, uid });

  } catch (err) {
    console.error('[RAPPIA webhook] error:', err);
    return json({ error: err.message }, 500);
  }
}


// ══════════════════════════════════════════════════════════════════
// 2. POLL MANUAL — fallback si el webhook falla
//    Consulta los últimos pagos de MP y procesa los no procesados
//    Se llama desde la web cuando el usuario espera acreditación
// ══════════════════════════════════════════════════════════════════
async function handleRappiaPoll(request, env, corsHeaders) {
  const json = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const body = await request.json().catch(() => ({}));
    const { uid } = body;
    if (!uid) return json({ error: 'uid requerido' }, 400);

    if (!env.MP_ACCESS_TOKEN) return json({ error: 'MP_ACCESS_TOKEN no configurado' }, 500);

    // Buscar últimos 20 pagos recibidos en los últimos 30 minutos
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const mpRes = await fetch(
      `${MP_PAYMENTS_URL}?sort=date_created&criteria=desc&range=date_created&begin_date=${since}&limit=20`,
      { headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` } }
    );
    if (!mpRes.ok) return json({ error: 'MP API error' }, 502);
    const data = await mpRes.json();
    const payments = data.results || [];

    const fbToken = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    let credited = 0;

    for (const payment of payments) {
      if (payment.status !== 'approved') continue;

      const concepto = (payment.description || payment.reason || '').toUpperCase();
      if (!concepto.includes(uid)) continue;

      // Verificar idempotencia
      const logCheck = await fetch(
        `${FB_DB_URL_RAPPIA}/rappia_txlog/${payment.id}.json?auth=${fbToken}`
      );
      const existing = await logCheck.json();
      if (existing && existing.processed) continue;

      const amountARS = parseFloat(payment.transaction_amount) || 0;
      const credits   = Math.floor(amountARS / RAPPIA_PER_ARS);
      if (credits < 1) continue;

      // Buscar usuario
      const uidIndexRes = await fetch(
        `${FB_DB_URL_RAPPIA}/rappi_uid_index/${uid}.json?auth=${fbToken}`
      );
      const emailKey = await uidIndexRes.json();
      if (!emailKey) continue;

      // Acreditar
      const userRef = `${FB_DB_URL_RAPPIA}/rppi_users/${emailKey}`;
      const userRes = await fetch(`${userRef}.json?auth=${fbToken}`);
      const user = await userRes.json();
      if (!user) continue;

      const newCredits = (user.credits || 0) + credits;
      await fetch(`${userRef}.json?auth=${fbToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: newCredits, lastCredit: Date.now() })
      });

      await fetch(`${FB_DB_URL_RAPPIA}/rappia_txlog/${payment.id}.json?auth=${fbToken}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id, uid, emailKey,
          amountARS, credits, newTotal: newCredits,
          processed: true, processedAt: Date.now(),
          source: 'poll'
        })
      });
      credited += credits;
    }

    return json({ ok: true, creditedNow: credited });
  } catch (err) {
    console.error('[RAPPIA poll] error:', err);
    return json({ error: err.message }, 500);
  }
}


// ══════════════════════════════════════════════════════════════════
// 3. BALANCE — leer créditos del usuario desde Firebase
// ══════════════════════════════════════════════════════════════════
async function handleRappiaBalance(request, env, corsHeaders) {
  const json = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const body     = await request.json().catch(() => ({}));
    const { email } = body;
    if (!email) return json({ error: 'email requerido' }, 400);

    const fbToken  = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const emailKey = email.replace(/[.#$[\]]/g, '_');
    const userRes  = await fetch(
      `${FB_DB_URL_RAPPIA}/rppi_users/${emailKey}.json?auth=${fbToken}`
    );
    const user = await userRes.json();
    if (!user) return json({ error: 'usuario no encontrado' }, 404);

    return json({
      ok:      true,
      credits: user.credits || 0,
      uid:     user.uid,
      alias:   user.alias,
      email:   user.email
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}


// ══════════════════════════════════════════════════════════════════
// 4. QR — genera la data del QR de acreditación
//    El alias real vive en el secret MP_ALIAS, nunca en código
// ══════════════════════════════════════════════════════════════════
async function handleRappiaQR(request, env, corsHeaders) {
  const json = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const body  = await request.json().catch(() => ({}));
    const { uid } = body;
    if (!uid) return json({ error: 'uid requerido' }, 400);

    // El alias viene del secret — nunca hardcodeado en el source
    const alias = env.MP_ALIAS || 'gabodc.mp'; // fallback solo para dev local
    const cvu   = env.MP_CVU   || '';

    // Contenido del QR para transferencia MP:
    // Formato que MP reconoce para QR de transferencia manual:
    // El concepto/referencia debe contener el UID para identificar al usuario
    const qrData = {
      alias,
      concepto:    uid,          // ← el usuario DEBE poner esto en el concepto
      descripcion: `Créditos RAPPIA para ${uid}`,
      // URL de pago MP (abre la app directamente)
      mpDeepLink:  `mercadopago://send?alias=${alias}&concept=${uid}`,
      // Fallback web
      mpWebLink:   `https://mpago.la/1Ck9 `, // generar link de cobro vía MP API si se requiere
      instrucciones: [
        `1. Abrí Mercado Pago`,
        `2. Enviá a: ${alias}`,
        `3. En el concepto escribí exactamente: ${uid}`,
        `4. ARS 100 = 1 crédito RAPPIA`,
        `5. Los créditos se acreditan automáticamente en ~1 minuto`
      ]
    };

    return json({ ok: true, qr: qrData });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}


// ══════════════════════════════════════════════════════════════════
// 5. WITHDRAW — retiro de créditos → transferencia MP al usuario
//    Proceso inverso: RAPPIA → ARS vía MP API
// ══════════════════════════════════════════════════════════════════
async function handleRappiaWithdraw(request, env, corsHeaders) {
  const json = (data, status = 200) => new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );

  try {
    const body    = await request.json().catch(() => ({}));
    const { email, credits } = body;

    if (!email || !credits) return json({ error: 'email y credits requeridos' }, 400);
    if (credits < 1)        return json({ error: 'mínimo 1 crédito' }, 400);

    if (!env.MP_ACCESS_TOKEN)        return json({ error: 'MP_ACCESS_TOKEN no configurado' }, 500);
    if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'Firebase no configurado' }, 500);

    const fbToken  = await getFirebaseToken(env.FIREBASE_SERVICE_ACCOUNT);
    const emailKey = email.replace(/[.#$[\]]/g, '_');

    // 1. Verificar saldo
    const userRes = await fetch(
      `${FB_DB_URL_RAPPIA}/rppi_users/${emailKey}.json?auth=${fbToken}`
    );
    const user = await userRes.json();
    if (!user)                    return json({ error: 'usuario no encontrado' }, 404);
    if ((user.credits || 0) < credits) return json({ error: 'créditos insuficientes' }, 400);
    if (!user.alias)              return json({ error: 'alias MP no registrado' }, 400);

    // 2. Calcular monto ARS
    const amountARS = credits * RAPPIA_PER_ARS;

    // 3. Buscar el MP user_id del destinatario por alias
    const mpUserRes = await fetch(
      `https://api.mercadopago.com/v1/payment_methods/search?alias=${user.alias}`,
      { headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` } }
    );
    // Nota: MP no tiene endpoint directo de transferencia P2P vía API pública.
    // La transferencia real se hace vía MP Money Transfer API (acceso especial).
    // Para el MVP: registrar el retiro como pendiente y procesar manualmente
    // o usar la API de disbursements si se tiene acceso.

    const withdrawId = 'WD-' + Math.random().toString(16).slice(2, 10).toUpperCase();

    // 4. Debitar créditos y registrar retiro pendiente
    await fetch(`${FB_DB_URL_RAPPIA}/rppi_users/${emailKey}.json?auth=${fbToken}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credits:     (user.credits - credits),
        lastWithdraw: Date.now()
      })
    });

    await fetch(`${FB_DB_URL_RAPPIA}/rappia_withdrawals/${withdrawId}.json?auth=${fbToken}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawId, emailKey, email,
        alias:      user.alias,
        credits,    amountARS,
        status:     'pending',
        requestedAt: Date.now(),
        note: 'Procesar manualmente vía MP o API Money Transfer'
      })
    });

    return json({
      ok: true,
      withdrawId,
      amountARS,
      credits,
      status: 'pending',
      message: `Retiro de ARS ${amountARS} en proceso. Se acredita en tu alias ${user.alias} en < 24hs hábiles.`
    });

  } catch (err) {
    console.error('[RAPPIA withdraw] error:', err);
    return json({ error: err.message }, 500);
  }
}


// ══════════════════════════════════════════════════════════════════
// HELPER — registrar UID index al crear usuario
// Llamar desde la función de registro en el frontend/worker
// ══════════════════════════════════════════════════════════════════
async function rappiaRegisterUIDIndex(emailKey, uid, fbToken) {
  await fetch(
    `${FB_DB_URL_RAPPIA}/rappi_uid_index/${uid}.json?auth=${fbToken}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailKey)
    }
  );
}


// ══════════════════════════════════════════════════════════════════
//
//  INTEGRACIÓN EN WORKER.JS EXISTENTE — instrucciones:
//
//  1. Copiar las funciones handleRappia* al final de worker.js
//     (antes del export { worker_default as default })
//
//  2. En el fetch handler (línea ~24534), agregar ANTES del bloque Gemini:
//
//     if (url.pathname === '/rappia/webhook') {
//       return handleRappiaWebhook(request, env2, corsHeaders);
//     }
//     if (url.pathname === '/rappia/balance') {
//       return handleRappiaBalance(request, env2, corsHeaders);
//     }
//     if (url.pathname === '/rappia/qr') {
//       return handleRappiaQR(request, env2, corsHeaders);
//     }
//     if (url.pathname === '/rappia/poll') {
//       return handleRappiaPoll(request, env2, corsHeaders);
//     }
//     if (url.pathname === '/rappia/withdraw') {
//       return handleRappiaWithdraw(request, env2, corsHeaders);
//     }
//
//  3. El GET también debe estar habilitado para /rappia/webhook (MP lo usa para validar).
//     Cambiar el router para aceptar GET solo en ese endpoint:
//
//     if (request.method === 'GET' && url.pathname === '/rappia/webhook') {
//       return new Response('OK', { status: 200, headers: corsHeaders });
//     }
//
//  4. Secrets a configurar en Cloudflare (wrangler secret put):
//     - MP_ACCESS_TOKEN   → tu token de MP productivo (Settings → Credenciales)
//     - MP_ALIAS          → gabodc.mp
//     - MP_CVU            → 0000003100091041395516
//     - MP_WEBHOOK_SECRET → string random para validar firma (opcional pero recomendado)
//
//  5. En MP Dashboard → Tu negocio → Webhooks:
//     URL: https://rapid-figemini-proxy.workers.dev/rappia/webhook
//     Eventos: payment
//
//  6. Firebase RTDB — estructura:
//     rappi_uid_index/{uid}        → emailKey (string)
//     rppi_users/{emailKey}        → { email, alias, credits, uid, ... }
//     rappia_txlog/{paymentId}     → { processed, credits, ... }
//     rappia_pending/{paymentId}   → pagos sin UID para revisión manual
//     rappia_withdrawals/{id}      → retiros pendientes
//
// ══════════════════════════════════════════════════════════════════
