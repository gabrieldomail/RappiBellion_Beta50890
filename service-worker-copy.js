const CACHE_NAME = 'rappibellion-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // No cachear peticiones a Firebase u otras APIs externas
  if (event.request.url.includes('firebaseio') || 
      event.request.url.includes('ethers') ||
      event.request.url.includes('ipfs')) {
    return;
  }
  
  // No cachear el HTML principal para asegurar actualizaciones inmediatas
  if (event.request.url.includes('index.html') || 
      event.request.destination === 'document') {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request).then(networkResponse => {
          return networkResponse;
        });
      })
  );
});