/* global clients */
const CACHE_NAME = 'questdo-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico'
];

// Przy instalacji - cache statycznych assetów
self.addEventListener('install', (event) => {
  console.log('SW installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Przy aktywacji - usuń stare cache
self.addEventListener('activate', (event) => {
  console.log('SW activating...');
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => {
        console.log('Deleting old cache:', key);
        return caches.delete(key);
      })
    )).then(() => clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUESTDO_SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch - tylko cache dla statycznych assetów, API zawsze z sieci
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // API requests - zawsze z sieci, nigdy z cache
  if (requestUrl.pathname.startsWith('/api') || 
      requestUrl.pathname.includes('/rankings') ||
      requestUrl.pathname.includes('/tasks') ||
      requestUrl.pathname.includes('/me') ||
      requestUrl.pathname.includes('/achievements') ||
      requestUrl.pathname.includes('/challenges') ||
      requestUrl.pathname.includes('/history') ||
      requestUrl.pathname.includes('/rare-drops')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Statyczne assety - cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('/');
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
      return undefined;
    })
  );
});