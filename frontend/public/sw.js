/* global clients */
const CACHE_NAME = 'questdo-v10';
const NOTIFICATION_ICON = '/notification-icon.svg';
const NOTIFICATION_TITLE = 'QuestDo';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/notification-icon.svg',
  '/favicon.svg',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUESTDO_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.hostname.includes('onrender.com') ||
      requestUrl.pathname.startsWith('/api') ||
      requestUrl.pathname.includes('/rankings') ||
      requestUrl.pathname.includes('/tasks') ||
      requestUrl.pathname.includes('/me') ||
      requestUrl.pathname.includes('/achievements') ||
      requestUrl.pathname.includes('/challenges') ||
      requestUrl.pathname.includes('/history') ||
      requestUrl.pathname.includes('/rare-drops')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // ⬇️ DODANY FILTER - tylko HTTP/HTTPS mogą być cache'owane
        if (response && response.status === 200 && event.request.method === 'GET') {
          const url = new URL(event.request.url);
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
        }
        return response;
      });
    }).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('/');
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});

self.addEventListener('push', (event) => {
  let title = NOTIFICATION_TITLE;
  let body = 'Masz nowe przypomnienie';
  let tag;
  let data = { url: '/' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      title = parsed.title || NOTIFICATION_TITLE;
      body = parsed.body || body;
      tag = parsed.tag;
      data = parsed.data || { url: parsed.url || '/' };
    }
  } catch {
    if (event.data?.text()) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag,
      data,
    })
  );
});

function openAppFromNotification(event) {
  const targetUrl = event.notification?.data?.url || '/';
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
}

self.addEventListener('notificationclick', openAppFromNotification);
self.addEventListener('notificationclose', () => {});