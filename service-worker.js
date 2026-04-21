// ╔═══════════════════════════════════════════════════════════╗
// ║   RAPPIBELLION T2E — Service Worker v3.0                  ║
// ║   Estrategia: Cache-First assets / Network-First HTML      ║
// ╚═══════════════════════════════════════════════════════════╝

const CACHE_VERSION = 'rappibellion-v3';
const STATIC_CACHE  = CACHE_VERSION + '-static';
const DYNAMIC_CACHE = CACHE_VERSION + '-dynamic';

// Assets estáticos que se pre-cachean en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/rappibellion_logo_movil.png',
  '/images/rappia_logo_inicio_page.png',
  '/images/boost-ghost-no.png',
  '/images/rappia-boost-btn.png',
  '/sounds/mario-star.mp3',
  '/assets/audio/bomba-chaos.mp3',
];

// Rutas que NUNCA se cachean (Firebase, APIs externas, Metamask)
const NETWORK_ONLY = [
  'firebase',
  'googleapis.com',
  'metamask',
  'cloudflare',
  'etherscan',
  'optimism',
  'betting-engine',
  'cdn-cgi',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] No se pudo pre-cachear:', url, err.message);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando, limpiando caches viejos...');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Eliminando cache obsoleto:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const method = event.request.method;

  // Solo GET
  if (method !== 'GET') return;

  // Network-only para servicios externos críticos
  if (NETWORK_ONLY.some((pattern) => url.includes(pattern))) return;

  // HTML: Network-first (siempre fresco), fallback al cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets estáticos: Cache-first, network fallback + actualizar cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Actualizar en background (stale-while-revalidate)
        fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(DYNAMIC_CACHE).then((c) =>
                c.put(event.request, response)
              );
            }
          })
          .catch(() => {});
        return cached;
      }
      // No en cache: fetch + guardar
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((c) => c.put(event.request, clone));
        return response;
      });
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bets') {
    console.log('[SW] Background sync: sincronizando apuestas pendientes');
  }
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rappibellion T2E', {
      body: data.body || '¡Hay actividad en El Circuito!',
      icon: '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      tag: 'rappibellion-push',
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: '▶ Abrir' },
        { action: 'close', title: '✕ Cerrar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
