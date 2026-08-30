# =============================================================================
# SURGERY-011A — Black Terminal Market Proxy
# Cache-first + stale-while-revalidate + single-flight por provider.
# LOCAL DEV BACKEND ONLY (http://127.0.0.1:8787). NO es un endpoint
# production/PWA. El frontend (index.html) NO se modifica en esta surgery.
# =============================================================================

import asyncio
import datetime
import time
from collections import Counter

from aiohttp import web, ClientSession, ClientTimeout
from zoneinfo import ZoneInfo

# ── Upstream endpoints ──
PIONEX_BASE = "https://api.pionex.com"

# ── Claves API: NUNCA hardcoded ni comiteadas ──
# Se cargan desde (1) variables de entorno, o (2) el archivo local
# .env.market_proxy (gestionado por .gitignore). Los valores no se
# imprimen ni se registran en logs.
import os as _os


def _market_secrets():
    _s = {}
    try:
        with open(_os.path.join(_os.path.dirname(__file__), ".env.market_proxy"),
                  "r", encoding="utf-8") as _fh:
            for _line in _fh:
                _line = _line.strip()
                if not _line or _line.startswith("#") or "=" not in _line:
                    continue
                _k, _, _v = _line.partition("=")
                _s[_k.strip()] = _v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return _s


_MKT_SECRETS = _market_secrets()


def _api_key(name):
    v = _os.environ.get(name) or _MKT_SECRETS.get(name)
    if not v:
        print(f"WARNING: API key '{name}' no configurada "
              "(env o .env.market_proxy).")
    return v


TWELVEDATA_KEY = _api_key("TWELVEDATA_KEY")
FINNHUB_KEY = _api_key("FINNHUB_KEY")
FRED_KEY = _api_key("FRED_KEY")

PORT = 8787
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

# ── Symbol mapping: BT_SYMBOL -> {provider, provider_symbol} ──
PROVIDER_MAP = {
    # PIONEX — crypto + tokenized (bulk tickers endpoint, 24/7, 1 call all)
    # SURGERY-011C: scan pionex 329 pairs / 50 tokenized X-suffix (evidence:
    # war_room/artifacts/pionex_tickers.json). META/GOOGL/IONQ/WTI/SI/SOL/BNB
    # movidos a Pionex 24/7; SPX/NDQ swapped a tokenized SPYX/QQQX.
    "BTC":     {"provider": "pionex", "symbol": "BTC_USDT"},
    "ETH":     {"provider": "pionex", "symbol": "ETH_USDT"},
    "SOL":     {"provider": "pionex", "symbol": "SOL_USDT"},
    "BNB":     {"provider": "pionex", "symbol": "BNB_USDT"},
    "XRP":     {"provider": "pionex", "symbol": "XRP_USDT"},
    "NVDA":    {"provider": "pionex", "symbol": "NVDAX_USDT"},
    "AAPL":    {"provider": "pionex", "symbol": "AAPLX_USDT"},
    "TSLA":    {"provider": "pionex", "symbol": "TSLAX_USDT"},
    "META":    {"provider": "pionex", "symbol": "METAX_USDT"},
    "GOOGL":   {"provider": "pionex", "symbol": "GOOGLX_USDT"},
    "IONQ":    {"provider": "pionex", "symbol": "IONQX_USDT"},
    "SPX":     {"provider": "pionex", "symbol": "SPYX_USDT"},  # x10 via PIONEX_FACTORS = indice
    "NDQ":     {"provider": "pionex", "symbol": "QQQX_USDT"},  # FIX 'NDX'->'NDQ'; x41.05 = NDX puntos
    "GOLD":    {"provider": "pionex", "symbol": "XAUT_USDT"},
    "WTI":     {"provider": "pionex", "symbol": "USOX_USDT"},  # USO ETF tracks WTI (proxy, no futuro directo)
    "SI":      {"provider": "pionex", "symbol": "SLVX_USDT"},  # SLV tokenized silver

    # TWELVEDATA (3) — refresco SOLO en sesión regular (política de cuota)
    "EUR/USD": {"provider": "twelvedata", "symbol": "EUR/USD"},
    "BTC/USD": {"provider": "twelvedata", "symbol": "BTC/USD"},
    "ETH/USD": {"provider": "twelvedata", "symbol": "ETH/USD"},

    # FINNHUB (22) — stocks/ETFs sin tokenizado en Pionex, SOLO en sesión regular
    "DJI":   {"provider": "finnhub", "symbol": "DIA"},     # x100 = DJI puntos
    "RUT":   {"provider": "finnhub", "symbol": "IWM"},     # x10 = RUT puntos
    "VIX":   {"provider": "finnhub", "symbol": "VIXY"},    # x0.82163 = VIX indice
    "MSFT":  {"provider": "finnhub", "symbol": "MSFT"},
    "NFLX":  {"provider": "finnhub", "symbol": "NFLX"},
    "AVGO":  {"provider": "finnhub", "symbol": "AVGO"},
    "QTUM":  {"provider": "finnhub", "symbol": "QTUM"},    # 011D: conectado
    "SPCX":  {"provider": "finnhub", "symbol": "SPCX"},    # 011D: conectado
    "XLE":   {"provider": "finnhub", "symbol": "XLE"},
    "XLB":   {"provider": "finnhub", "symbol": "XLB"},
    "XLF":   {"provider": "finnhub", "symbol": "XLF"},
    "XLK":   {"provider": "finnhub", "symbol": "XLK"},
    "XLV":   {"provider": "finnhub", "symbol": "XLV"},
    "XLU":   {"provider": "finnhub", "symbol": "XLU"},
    "XLP":   {"provider": "finnhub", "symbol": "XLP"},
    "KRE":   {"provider": "finnhub", "symbol": "KRE"},
    "IGV":   {"provider": "finnhub", "symbol": "IGV"},
    "MAGS":  {"provider": "finnhub", "symbol": "MAGS"},
    "SOXX":  {"provider": "finnhub", "symbol": "SOXX"},
    "ARKQ":  {"provider": "finnhub", "symbol": "ARKQ"},
    "HYG":   {"provider": "finnhub", "symbol": "HYG"},
    "TLT":   {"provider": "finnhub", "symbol": "TLT"},

    # FRED (3) — macro, sin clock bursátil
    "US02Y": {"provider": "fred", "symbol": "DGS2"},
    "US10Y": {"provider": "fred", "symbol": "DGS10"},
    "EU02":  {"provider": "fred", "symbol": "IRLTLT01DEM156N"},

    # YAHOO v8 chart (SURGERY-011E) — índices globales, 24/7 request-triggered.
    # Fuente NO-OFICIAL: cache-first + last-known-good obligatorios.
    # Keys = keys exactas de BT_ASSETS (bug clase-NDX evitado).
    "IBEX35": {"provider": "yahoo", "symbol": "^IBEX"},
    "DAX40":  {"provider": "yahoo", "symbol": "^GDAXI"},
    "FTSE":   {"provider": "yahoo", "symbol": "^FTSE"},
    "NKY":    {"provider": "yahoo", "symbol": "^N225"},
    "HSI":    {"provider": "yahoo", "symbol": "^HSI"},
    "KOSPI":  {"provider": "yahoo", "symbol": "^KS11"},
    "DXY":    {"provider": "yahoo", "symbol": "DX-Y.NYB"},
    # MSCI = MSCI World — aprobado por decisión de producto (user 2026-08-28)
    "MSCI":   {"provider": "yahoo", "symbol": "^990100-USD-STRD"},

    # MOEX ISS (SURGERY-011E) — IMOEX, API pública oficial, sin key
    "MOEX":   {"provider": "moex", "symbol": "IMOEX"},
}

# SPX x10 = indice; NDQ x41.05 calibrado a cierre NDX 29433.43 (717.54 tokenizado)
PIONEX_FACTORS = {"SPX": 10.0, "NDQ": 41.05}

# Factores Finnhub: ETF proxy -> escala del activo mostrado
# DJI = DIA x100 (convencion estandar); RUT = IWM x10;
# VIX = VIXY x0.82163 calibrado a VIXCLS real 14.51 (FRED) / 17.66 ETF
FINNHUB_FACTORS = {"VIX": 0.82163, "DJI": 100.0, "RUT": 10.0}

# Reverse index: provider -> {provider_symbol -> BT_SYMBOL}
SYM_BY_PROVIDER = {}
for _bt, _info in PROVIDER_MAP.items():
    SYM_BY_PROVIDER.setdefault(_info["provider"], {})[_info["symbol"]] = _bt

# ── Cadences / TTLs ──
PIONEX_TTL = 5.0                 # bulk refresh ~5s bajo demanda
FINNHUB_TTL = 60.0               # por-símbolo ~60s durante sesión
TWELVEDATA_TTL = 120.0           # set cada ~120s durante sesión
FRED_TTL = 6 * 3600.0            # ~cada 6h
YAHOO_TTL = 300.0                # SURGERY-011E: índices globales, conservador
MOEX_TTL = 300.0                 # SURGERY-011E: IMOEX, conservador
YAHOO_TTL = 300.0                # SURGERY-011E: índices globales, conservador
MOEX_TTL = 300.0                 # SURGERY-011E: IMOEX, conservador
FINNHUB_MAX_CALLS_PER_MINUTE = 45  # HARD SAFETY CEILING, no objetivo
FINNHUB_CONCURRENCY = 5
CACHE_TTL = FINNHUB_TTL          # alias compat

# ── US regular session clock (IANA tzdata America/New_York) ──
NY_TZ = ZoneInfo("America/New_York")
SESSION_START = 9 * 60 + 30      # 09:30 inclusive
SESSION_END = 16 * 60            # 16:00 exclusive


def ny_now(dt=None):
    """Interpreta dt como America/New_York (naive = NY wall time)."""
    if dt is None:
        return datetime.datetime.now(NY_TZ)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=NY_TZ)
    return dt.astimezone(NY_TZ)


def is_us_regular_session(dt=None):
    """Lun–Vie 09:30 <= t < 16:00 America/New_York.

    NOTA: NO es un calendario bursátil completo.
    NYSE HOLIDAY CALENDAR: NOT IMPLEMENTED.
    """
    d = ny_now(dt)
    if d.weekday() >= 5:
        return False
    mins = d.hour * 60 + d.minute
    return SESSION_START <= mins < SESSION_END

# ── Estado por provider ──
_cache = {}          # bt_sym -> last-known-good price
_cache_ts = {}       # bt_sym -> ts del último precio bueno
_attempt_ts = {}     # bt_sym -> ts del último intento de fetch (finnhub)
_provider_last = {}  # provider -> ts del último refresh completo exitoso
_ptask = {p: None for p in ("pionex", "twelvedata", "finnhub", "fred", "yahoo", "moex")}

STATS = {
    "pionex_refreshes": 0,
    "twelvedata_refreshes": 0,
    "finnhub_refreshes": 0,
    "fred_refreshes": 0,
    "yahoo_refreshes": 0,
    "moex_refreshes": 0,
    "finnhub_calls": 0,
    "twelvedata_calls": 0,
    "yahoo_calls": 0,
    "moex_calls": 0,
}

_rate_lock = asyncio.Lock()
_next_finnhub_call = time.monotonic()

cache = _cache  # compat alias


# ── Helpers ──
def _put(sym, price, ts):
    _cache[sym] = float(price)
    _cache_ts[sym] = ts


def _commit(provider, updates, ts):
    for sym, price in updates.items():
        if price is not None and price > 0:
            _put(sym, price, ts)
    if updates:
        _provider_last[provider] = ts


def _is_stale(provider):
    now = time.time()
    if provider == "pionex":
        t = _provider_last.get("pionex")
        return t is None or (now - t) > PIONEX_TTL
    if provider == "twelvedata":
        t = _provider_last.get("twelvedata")
        return t is None or (now - t) > TWELVEDATA_TTL
    if provider == "finnhub":
        for bt in SYM_BY_PROVIDER["finnhub"].values():
            ok = _cache_ts.get(bt, 0)
            at = _attempt_ts.get(bt, 0)
            if (now - ok) > FINNHUB_TTL and (now - at) > FINNHUB_TTL:
                return True
        return False
    if provider == "fred":
        t = _provider_last.get("fred")
        return t is None or (now - t) > FRED_TTL
    if provider == "yahoo":
        t = _provider_last.get("yahoo")
        return t is None or (now - t) > YAHOO_TTL
    if provider == "moex":
        t = _provider_last.get("moex")
        return t is None or (now - t) > MOEX_TTL
    return False


SESSION_GATED = ("finnhub", "twelvedata")


def ensure_refresh(provider):
    """Single-flight por provider: nunca dos refrescos del mismo provider."""
    task = _ptask.get(provider)
    if task is not None and not task.done():
        return
    if not _is_stale(provider):
        return
    if provider in SESSION_GATED and not is_us_regular_session():
        return
    t = asyncio.create_task(_refresh_engine(provider))
    _ptask[provider] = t
    STATS[provider + "_refreshes"] += 1


async def _refresh_engine(provider):
    task = asyncio.current_task()
    try:
        async with ClientSession(timeout=ClientTimeout(total=10)) as session:
            if provider == "pionex":
                await _refresh_pionex(session)
            elif provider == "twelvedata":
                await _refresh_twelvedata(session)
            elif provider == "finnhub":
                await _refresh_finnhub(session)
            elif provider == "fred":
                await _refresh_fred(session)
            elif provider == "yahoo":
                await _refresh_yahoo(session)
            elif provider == "moex":
                await _refresh_moex(session)
    except Exception as e:  # un provider nunca tumba el resto
        print(f"[{provider}] engine error: {type(e).__name__}: {e}")
    finally:
        if _ptask.get(provider) is task:
            _ptask[provider] = None


# ── PIONEX (bulk, 24/7, ~5s bajo demanda) ──
async def _refresh_pionex(session):
    url = f"{PIONEX_BASE}/api/v1/market/tickers"
    try:
        async with session.get(url) as resp:
            data = await resp.json()
    except Exception as e:
        print(f"[PIONEX] refresh error: {type(e).__name__}: {e}")
        return
    now = time.time()
    updates = {}
    rev = SYM_BY_PROVIDER["pionex"]
    for item in data.get("data", {}).get("tickers", []):
        bt = rev.get(item.get("symbol"))
        if not bt:
            continue
        price = float(item.get("close") or item.get("last") or item.get("price") or 0)
        if price > 0:
            updates[bt] = price * PIONEX_FACTORS.get(bt, 1.0)  # SPX x10 (SPY->indice)
    _commit("pionex", updates, now)


# ── TWELVEDATA (3, sesión regular, set cada >=120s) ──
async def _refresh_twelvedata(session):
    now0 = time.time()
    if (now0 - _provider_last.get("twelvedata", 0)) < TWELVEDATA_TTL:
        return
    syms = SYM_BY_PROVIDER["twelvedata"]

    async def one(fh):
        STATS["twelvedata_calls"] += 1
        url = f"https://api.twelvedata.com/quote?symbol={fh}&apikey={TWELVEDATA_KEY}"
        try:
            async with session.get(url) as resp:
                data = await resp.json()
            if "close" in data:
                return fh, float(data["close"])
        except Exception as e:
            print(f"[TWELVEDATA:{fh}] error: {type(e).__name__}: {e}")
        return fh, None

    res = await asyncio.gather(*(one(fh) for fh in syms), return_exceptions=True)
    ups = {}
    for r in res:
        if isinstance(r, tuple) and r[1]:
            ups[syms[r[0]]] = r[1]
    if ups:
        _commit("twelvedata", ups, time.time())


# ── FINNHUB (24, sesión regular, TTL/símbolo ~60s, sin ráfagas) ──
async def _finnhub_slot():
    global _next_finnhub_call
    interval = 60.0 / FINNHUB_MAX_CALLS_PER_MINUTE
    async with _rate_lock:
        now = time.monotonic()
        wait = _next_finnhub_call - now
        if wait > 0:
            await asyncio.sleep(wait)
        _next_finnhub_call = max(_next_finnhub_call, time.monotonic()) + interval


async def _finnhub_quote(session, fh_sym):
    url = f"https://finnhub.io/api/v1/quote?symbol={fh_sym}&token={FINNHUB_KEY}"
    async with session.get(url) as resp:
        data = await resp.json()
    return float(data.get("c") or 0)


async def _refresh_finnhub(session):
    t0 = time.time()
    syms = SYM_BY_PROVIDER["finnhub"]
    stale = []
    for fh, bt in syms.items():
        ok = _cache_ts.get(bt, 0)
        at = _attempt_ts.get(bt, 0)
        if (t0 - ok) > FINNHUB_TTL and (t0 - at) > FINNHUB_TTL:
            stale.append(fh)
    if not stale:
        return
    sem = asyncio.Semaphore(FINNHUB_CONCURRENCY)

    async def one(fh):
        bt = syms[fh]
        async with sem:
            await _finnhub_slot()
            STATS["finnhub_calls"] += 1
            try:
                price = await _finnhub_quote(session, fh)
                if price > 0:
                    _put(bt, price * FINNHUB_FACTORS.get(bt, 1.0), time.time())
            except Exception as e:
                print(f"[FINNHUB:{fh}] error: {type(e).__name__}: {e}")
            finally:
                _attempt_ts[bt] = time.time()

    await asyncio.gather(*(one(fh) for fh in stale), return_exceptions=True)


# ── FRED (3, ~6h, sin clock bursátil) ──
async def _refresh_fred(session):
    now0 = time.time()
    if (now0 - _provider_last.get("fred", 0)) < FRED_TTL:
        return
    syms = SYM_BY_PROVIDER["fred"]

    async def one(fh):
        url = (f"https://api.stlouisfed.org/fred/series/observations?"
               f"series_id={fh}&api_key={FRED_KEY}&file_type=json"
               f"&limit=1&sort_order=desc")
        try:
            async with session.get(url) as resp:
                data = await resp.json()
            obs = data.get("observations", [])
            if obs:
                v = obs[0].get("value", ".")
                if v != ".":
                    return fh, float(v)
        except Exception as e:
            print(f"[FRED:{fh}] error: {type(e).__name__}: {e}")
        return fh, None

    res = await asyncio.gather(*(one(fh) for fh in syms), return_exceptions=True)
    ups = {}
    for r in res:
        if isinstance(r, tuple) and r[1] is not None:
            ups[syms[r[0]]] = r[1]
    if ups:
        _commit("fred", ups, time.time())


# ── YAHOO v8 chart (SURGERY-011E: 8 índices globales, NO-OFICIAL) ──
YAHOO_CONCURRENCY = 3            # techo conservador del plan
YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"


async def _refresh_yahoo(session):
    now0 = time.time()
    if (now0 - _provider_last.get("yahoo", 0)) < YAHOO_TTL:
        return
    syms = SYM_BY_PROVIDER["yahoo"]
    sem = asyncio.Semaphore(YAHOO_CONCURRENCY)

    async def one(fh):
        bt = syms[fh]
        async with sem:
            STATS["yahoo_calls"] += 1
            url = f"{YAHOO_BASE}/{fh}?range=1d&interval=1d"
            try:
                async with session.get(
                    url, headers={"User-Agent": "Mozilla/5.0"}
                ) as resp:
                    if resp.status != 200:
                        print(f"[YAHOO:{fh}] HTTP {resp.status}")
                        return
                    data = await resp.json(content_type=None)  # a veces HTML headers
                result = (data.get("chart", {}) or {}).get("result") or []
                if not result:
                    print(f"[YAHOO:{fh}] schema-changed (sin chart.result)")
                    return
                meta = result[0].get("meta") or {}
                price = meta.get("regularMarketPrice")
                if price is None:
                    return
                price = float(price)
                if not (price == price and price > 0):  # finite/sane
                    return
                _put(bt, price, time.time())
            except Exception as e:
                print(f"[YAHOO:{fh}] error: {type(e).__name__}: {e}")

    await asyncio.gather(*(one(fh) for fh in syms), return_exceptions=True)
    # Timestamp de INTENTO siempre: evita tormenta de reintentos si 1 símbolo
    # falla. Los last-known-good por símbolo ya quedaron en _cache_ts.
    _provider_last["yahoo"] = time.time()


# ── MOEX ISS (SURGERY-011E: IMOEX, API pública oficial) ──
MOEX_BASE = ("https://iss.moex.com/iss/engines/stock/markets/index"
             "/boards/SNDX/securities")


async def _refresh_moex(session):
    now0 = time.time()
    if (now0 - _provider_last.get("moex", 0)) < MOEX_TTL:
        return
    syms = SYM_BY_PROVIDER["moex"]  # {"IMOEX": "MOEX"}
    STATS["moex_calls"] += 1
    url = f"{MOEX_BASE}/IMOEX.json?iss.only=marketdata"
    try:
        async with session.get(url, headers={"User-Agent": "Mozilla/5.0"}) as resp:
            data = await resp.json(content_type=None)
        md = data.get("marketdata") or {}
        cols = md.get("columns") or []
        rows = md.get("data") or []
        if "CURRENTVALUE" not in cols or not rows:
            print("[MOEX] schema-changed (sin CURRENTVALUE)")
            return
        i_val = cols.index("CURRENTVALUE")
        val = rows[0][i_val]
        if val is None:
            return
        price = float(val)
        if price > 0:
            bt = syms.get("IMOEX")
            if bt:
                _put(bt, price, time.time())
                _provider_last["moex"] = time.time()
    except Exception as e:
        print(f"[MOEX] error: {type(e).__name__}: {e}")


# Aliases públicos compatibles con scripts previos
fetch_pionex = _refresh_pionex
fetch_twelvedata = _refresh_twelvedata
fetch_finnhub = _refresh_finnhub
fetch_fred = _refresh_fred


async def market_handler(request):
    for prov in ("pionex", "twelvedata", "finnhub", "fred", "yahoo", "moex"):
        try:
            ensure_refresh(prov)
        except Exception as e:
            print(f"[trigger:{prov}] error: {type(e).__name__}: {e}")
    return web.json_response({
        "success": True,
        "timestamp": int(time.time()),
        "data": dict(_cache),
    }, headers=CORS)


async def options_handler(request):
    return web.Response(headers=CORS)


async def on_startup(app):
    # Cold start: NO bloquear el puerto. Refrescos iniciales permitidos en
    # background; reglas de sesión aplican (finnhub/twelvedata fuera de
    # horario = 0 requests). Sin polling permanente.
    for prov in ("pionex", "twelvedata", "finnhub", "fred", "yahoo", "moex"):
        try:
            ensure_refresh(prov)
        except Exception as e:
            print(f"[startup:{prov}] error: {type(e).__name__}: {e}")


app = web.Application()
app.router.add_get("/api/market/tickers", market_handler)
app.router.add_options("/api/market/tickers", options_handler)
app.on_startup.append(on_startup)

if __name__ == "__main__":
    counts = Counter(v["provider"] for v in PROVIDER_MAP.values())
    print(f"Market Proxy (SURGERY-011A) -> http://127.0.0.1:{PORT}")
    print("LOCAL DEV BACKEND ONLY — NO es un endpoint production/PWA.")
    print("Providers:", dict(counts))
    print("US REGULAR SESSION CLOCK: IANA tzdata America/New_York")
    print("NYSE HOLIDAY CALENDAR: NOT IMPLEMENTED")
    web.run_app(app, host="127.0.0.1", port=PORT)