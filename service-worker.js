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