/**
 * ============================================================================
 * MARKET WORKER — BLACK TERMINAL FEED (Cloudflare Workers)
 * ============================================================================
 * Replica PRODUCTION del market_proxy.py (cache-first + stale-while-revalidate
 * + single-flight + sesión USA + aislamiento de fallos por provider).
 *
 * ENDPOINT:   GET /api/market/tickers
 * SCHEMA:     { success: true, timestamp: <int>, data: { "<BT_SYM>": price } }
 *
 * DESPLEGAR como worker NUEVO (no pegar en WORKER-CF.js que es un bundle
 * compilado del backend de gaming). Rutas:
 *   /            -> respuesta raíz informativa
 *   /api/market/tickers -> feed (CORS *)
 *
 * SECRETS OPCIONALES (Worker Settings -> Variables):
 *   FINNHUB_KEY, TWELVEDATA_KEY, FRED_KEY
 * Si faltan, esos providers se omiten silenciosamente (Pionex/Yahoo/MOEX
 * funcionan sin key).
 * ============================================================================
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// TTLs (seg) — iguales al proxy local
const TTL = {
  pionex: 5,
  finnhub: 60,
  twelvedata: 120,
  fred: 6 * 3600,
  yahoo: 300,
  moex: 300,
};

// FINNHUB: techo duro de seguridad 45 llamadas/min (no objetivo)
const FINNHUB_MAX_PER_MIN = 45;
const FINNHUB_CONCURRENCY = 5;

// Factores de escala (idénticos al proxy)
const PIONEX_FACTORS = { SPX: 10.0, NDQ: 41.05 };
const FINNHUB_FACTORS = { VIX: 0.82163, DJI: 100.0, RUT: 10.0 };

// Mapa BT_SYMBOL -> { provider, symbol } (paridad con market_proxy.py)
const PROVIDER_MAP = {
  // PIONEX — crypto + tokenizados, bulk 24/7 sin key
  BTC:   { provider: 'pionex', symbol: 'BTC_USDT' },
  ETH:   { provider: 'pionex', symbol: 'ETH_USDT' },
  SOL:   { provider: 'pionex', symbol: 'SOL_USDT' },
  BNB:   { provider: 'pionex', symbol: 'BNB_USDT' },
  XRP:   { provider: 'pionex', symbol: 'XRP_USDT' },
  NVDA:  { provider: 'pionex', symbol: 'NVDAX_USDT' },
  AAPL:  { provider: 'pionex', symbol: 'AAPLX_USDT' },
  TSLA:  { provider: 'pionex', symbol: 'TSLAX_USDT' },
  META:  { provider: 'pionex', symbol: 'METAX_USDT' },
  GOOGL: { provider: 'pionex', symbol: 'GOOGLX_USDT' },
  IONQ:  { provider: 'pionex', symbol: 'IONQX_USDT' },
  SPX:   { provider: 'pionex', symbol: 'SPYX_USDT' },
  NDQ:   { provider: 'pionex', symbol: 'QQQX_USDT' },
  GOLD:  { provider: 'pionex', symbol: 'XAUT_USDT' },
  WTI:   { provider: 'pionex', symbol: 'USOX_USDT' },
  SI:    { provider: 'pionex', symbol: 'SLVX_USDT' },

  // YAHOO v8 — índices globales, sin key (NO oficial)
  IBEX35: { provider: 'yahoo', symbol: '^IBEX' },
  DAX40:  { provider: 'yahoo', symbol: '^GDAXI' },
  FTSE:   { provider: 'yahoo', symbol: '^FTSE' },
  NKY:    { provider: 'yahoo', symbol: '^N225' },
  HSI:    { provider: 'yahoo', symbol: '^HSI' },
  KOSPI:  { provider: 'yahoo', symbol: '^KS11' },
  DXY:    { provider: 'yahoo', symbol: 'DX-Y.NYB' },
  MSCI:   { provider: 'yahoo', symbol: '^990100-USD-STRD' },

  // MOEX ISS — IMOEX, oficial sin key
  MOEX:   { provider: 'moex', symbol: 'IMOEX' },

  // FINNHUB — stocks/ETFs, sesión USA, key en secret
  DJI:   { provider: 'finnhub', symbol: 'DIA' },
  RUT:   { provider: 'finnhub', symbol: 'IWM' },
  VIX:   { provider: 'finnhub', symbol: 'VIXY' },
  MSFT:  { provider: 'finnhub', symbol: 'MSFT' },
  NFLX:  { provider: 'finnhub', symbol: 'NFLX' },
  AVGO:  { provider: 'finnhub', symbol: 'AVGO' },
  QTUM:  { provider: 'finnhub', symbol: 'QTUM' },
  SPCX:  { provider: 'finnhub', symbol: 'SPCX' },
  XLE:   { provider: 'finnhub', symbol: 'XLE' },
  XLB:   { provider: 'finnhub', symbol: 'XLB' },
  XLF:   { provider: 'finnhub', symbol: 'XLF' },
  XLK:   { provider: 'finnhub', symbol: 'XLK' },
  XLV:   { provider: 'finnhub', symbol: 'XLV' },
  XLU:   { provider: 'finnhub', symbol: 'XLU' },
  XLP:   { provider: 'finnhub', symbol: 'XLP' },
  KRE:   { provider: 'finnhub', symbol: 'KRE' },
  IGV:   { provider: 'finnhub', symbol: 'IGV' },
  MAGS:  { provider: 'finnhub', symbol: 'MAGS' },
  SOXX:  { provider: 'finnhub', symbol: 'SOXX' },
  ARKQ:  { provider: 'finnhub', symbol: 'ARKQ' },
  HYG:   { provider: 'finnhub', symbol: 'HYG' },
  TLT:   { provider: 'finnhub', symbol: 'TLT' },

  // TWELVEDATA — FX, sesión USA, key en secret
  'EUR/USD': { provider: 'twelvedata', symbol: 'EUR/USD' },
  'BTC/USD': { provider: 'twelvedata', symbol: 'BTC/USD' },
  'ETH/USD': { provider: 'twelvedata', symbol: 'ETH/USD' },

  // FRED — tasas, 6h, key en secret
  US02Y: { provider: 'fred', symbol: 'DGS2' },
  US10Y: { provider: 'fred', symbol: 'DGS10' },
  EU02:  { provider: 'fred', symbol: 'IRLTLT01DEM156N' },
};

// Reverso symbol -> bt por provider
const SYM_BY_PROVIDER = {};
for (const [bt, info] of Object.entries(PROVIDER_MAP)) {
  (SYM_BY_PROVIDER[info.provider] = SYM_BY_PROVIDER[info.provider] || {})[info.symbol] = bt;
}

// ── Estado (por isolate; single-flight + last-known-good) ──
const MEM = {};      // provider -> { data:{bt:{val,ts}}, ts } (merge)
const INFLIGHT = {}; // provider -> Promise (single-flight)
const CALL_LOG = []; // finnhub rolling minute

function serve(data, init) {
  return new Response(JSON.stringify({ success: true, timestamp: Math.floor(Date.now() / 1000), data }),
    { headers: { ...CORS, 'Content-Type': 'application/json' }, ...init });
}

function nyIsRegularSession() {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const wd = get('weekday');
    const hh = parseInt(get('hour'), 10), mm = parseInt(get('minute'), 10);
    if (wd === 'Sat' || wd === 'Sun') return false;
    const mins = hh * 60 + (isNaN(mm) ? 0 : mm);
    return mins >= 570 && mins < 960; // 09:30 - 16:00
  } catch (e) { return true; } // fallback permisivo si Intl falla
}

async function fetchJson(url, timeoutMs = 8000, headers = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers }, signal: ac.signal });
    if (res.status !== 200) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

// ── Refrescos por provider ──
async function refreshPionex() {
  const data = await fetchJson('https://api.pionex.com/api/v1/market/tickers');
  const out = {};
  const ticks = (data?.data?.tickers) || [];
  for (const t of ticks) {
    const bt = SYM_BY_PROVIDER.pionex[t.symbol];
    if (!bt) continue;
    const p = parseFloat(t.close ?? t.last ?? t.price);
    if (isFinite(p) && p > 0) out[bt] = p * (PIONEX_FACTORS[bt] ?? 1);
  }
  return out;
}

async function refreshYahoo() {
  const out = {};
  const syms = Object.keys(SYM_BY_PROVIDER.yahoo);
  for (const sym of syms) {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=1d&interval=1d';
    const data = await fetchJson(url);
    const meta = data?.chart?.result?.[0]?.meta;
    const p = parseFloat(meta?.regularMarketPrice);
    if (isFinite(p) && p > 0) out[SYM_BY_PROVIDER.yahoo[sym]] = p;
  }
  return out;
}

async function refreshMoex() {
  const url = 'https://iss.moex.com/iss/engines/stock/markets/index/boards/SNDX/securities/IMOEX.json?iss.only=marketdata';
  const data = await fetchJson(url);
  const md = data?.marketdata || {};
  const cols = md?.columns || [];
  const rows = md?.data || [];
  const i = cols.indexOf('CURRENTVALUE');
  if (i < 0 || !rows.length) throw new Error('MOEX schema-changed');
  const p = parseFloat(rows[0][i]);
  const out = {};
  if (isFinite(p) && p > 0) out.MOEX = p;
  return out;
}

async function refreshFinnhub(env) {
  if (!env.FINNHUB_KEY) return {};
  if (!nyIsRegularSession()) return {}; // gate de sesión USA
  const out = {};
  const syms = Object.keys(SYM_BY_PROVIDER.finnhub);
  const allowed = [];
  for (const s of syms) if (finnhubAllowed()) allowed.push(s);
  let idx = 0;
  async function worker() {
    while (idx < allowed.length) {
      const s = allowed[idx++];
      const url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(s) + '&token=' + env.FINNHUB_KEY;
      const data = await fetchJson(url);
      const p = parseFloat(data?.c);
      const bt = SYM_BY_PROVIDER.finnhub[s];
      if (isFinite(p) && p > 0) out[bt] = p * (FINNHUB_FACTORS[bt] ?? 1);
    }
  }
  await Promise.all(Array.from({ length: Math.min(FINNHUB_CONCURRENCY, allowed.length) }, worker));
  return out;
}

async function refreshTwelvedata(env) {
  if (!env.TWELVEDATA_KEY) return {};
  if (!nyIsRegularSession()) return {}; // gate de sesión USA
  const out = {};
  const syms = Object.keys(SYM_BY_PROVIDER.twelvedata);
  await Promise.all(syms.map(async (s) => {
    const url = 'https://api.twelvedata.com/quote?symbol=' + encodeURIComponent(s) + '&apikey=' + env.TWELVEDATA_KEY;
    const data = await fetchJson(url);
    const p = parseFloat(data?.close);
    if (isFinite(p) && p > 0) out[SYM_BY_PROVIDER.twelvedata[s]] = p;
  }));
  return out;
}

async function refreshFred(env) {
  if (!env.FRED_KEY) return {};
  const out = {};
  const syms = Object.keys(SYM_BY_PROVIDER.fred);
  await Promise.all(syms.map(async (s) => {
    const url = 'https://api.stlouisfed.org/fred/series/observations?series_id=' + encodeURIComponent(s)
      + '&api_key=' + env.FRED_KEY + '&file_type=json&limit=1&sort_order=desc';
    const data = await fetchJson(url);
    const v = data?.observations?.[0]?.value;
    const p = parseFloat(v);
    if (isFinite(p)) out[SYM_BY_PROVIDER.fred[s]] = p;
  }));
  return out;
}

const REFRESHERS = {
  pionex: refreshPionex,
  yahoo: refreshYahoo,
  moex: refreshMoex,
  finnhub: refreshFinnhub,
  twelvedata: refreshTwelvedata,
  fred: refreshFred,
};

function merge(provider, values) {
  const now = Date.now();
  const slot = MEM[provider] = MEM[provider] || { data: {} };
  for (const [bt, val] of Object.entries(values)) {
    if (isFinite(val) && val > 0) slot.data[bt] = { val, ts: now };
  }
  slot.ts = now;
}

function snapshot() {
  const data = {};
  for (const slot of Object.values(MEM)) {
    for (const [bt, e] of Object.entries(slot.data)) data[bt] = e.val;
  }
  return data;
}

function stale(provider) {
  const slot = MEM[provider];
  if (!slot || !slot.ts) return true;
  return (Date.now() - slot.ts) / 1000 > TTL[provider];
}

function ensureRefreshes(env, ctx) {
  for (const prov of Object.keys(TTL)) {
    if (!stale(prov)) continue;
    if ((prov === 'finnhub' || prov === 'twelvedata') && !nyIsRegularSession()) continue;
    if (INFLIGHT[prov]) continue; // single-flight
    INFLIGHT[prov] = (async () => {
      try {
        const values = await REFRESHERS[prov](env);
        if (values && Object.keys(values).length) merge(prov, values);
      } catch (e) { /* aislar fallo: conservar last-known-good */ }
      finally { delete INFLIGHT[prov]; }
    })();
    ctx.waitUntil(INFLIGHT[prov]);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname !== '/api/market/tickers') {
      return new Response('{"ok":"MARKET WORKER","route":"/api/market/tickers"}',
        { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    // cache-first + stale-while-revalidate: nunca esperar los upstream
    ensureRefreshes(env, ctx);
    return serve(snapshot());
  },
};