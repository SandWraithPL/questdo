/* global clients */

// Nazwa cache - zmieniamy przy aktualizacji aplikacji
const CACHE_NAME = 'questdo-v10';
// Ikona i tytuł powiadomień
const NOTIFICATION_ICON = '/notification-icon.svg';
const NOTIFICATION_TITLE = 'QuestDo';

// Statyczne pliki do cachowania przy instalacji
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/notification-icon.svg',
  '/favicon.svg',
  '/favicon.ico'
];

// ===== INSTALACJA =====
// Gdy Service Worker jest instalowany - zapisujemy statyczne pliki w cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Aktywujemy od razu (nie czekamy na zamknięcie przeglądarki)
  self.skipWaiting();
});

// ===== AKTYWACJA =====
// Gdy Service Worker staje się aktywny - usuwamy stare cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Usuwamy wszystkie cache oprócz obecnego
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => clients.claim()) // Przejmujemy kontrolę nad stronami
  );
});

// ===== WIADOMOŚCI =====
// Nasłuchuje na wiadomości od strony (np. "skip waiting")
self.addEventListener('message', (event) => {
  if (event.data?.type === 'QUESTDO_SKIP_WAITING') {
    self.skipWaiting(); // Aktywuje nową wersję SW
  }
});

// ===== PRZECHWYTYWANIE ZAPYTAŃ =====
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Zapytania do API NIGDY nie są cachowane - zawsze świeże dane
  if (requestUrl.hostname.includes('onrender.com') ||
      requestUrl.hostname.includes('azurewebsites.net') ||
      requestUrl.pathname.startsWith('/api') ||
      requestUrl.pathname.includes('/rankings') ||
      requestUrl.pathname.includes('/tasks') ||
      requestUrl.pathname.includes('/me') ||
      requestUrl.pathname.includes('/achievements') ||
      requestUrl.pathname.includes('/challenges') ||
      requestUrl.pathname.includes('/history') ||
      requestUrl.pathname.includes('/rare-drops') ||
      requestUrl.pathname.includes('/shopping') ||
      requestUrl.pathname.includes('/work') ||
      requestUrl.pathname.includes('/schedule') ||
      requestUrl.pathname.includes('/admin') ||
      requestUrl.pathname.includes('/free-days') ||
      requestUrl.pathname.includes('/push') ||
      requestUrl.pathname.includes('/token') ||
      requestUrl.pathname.includes('/register')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Dla pozostałych zapytań - najpierw sprawdzamy cache
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Jeśli jest w cache - zwracamy z cache
      if (cached) return cached;
      
      // Jeśli nie ma w cache - pobieramy z sieci
      return fetch(event.request).then((response) => {
        // Zapisujemy w cache tylko udane odpowiedzi (status 200) GET
        if (response && response.status === 200 && event.request.method === 'GET') {
          const url = new URL(event.request.url);
          // Tylko HTTP/HTTPS mogą być cachowane
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
      // Gdy offline - zwracamy stronę główną dla nawigacji
      if (event.request.mode === 'navigate') return caches.match('/');
      // W przeciwnym razie - błąd 503 (usługa niedostępna)
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});

// ===== POWIADOMIENIA PUSH =====
// Odbiera powiadomienia push z backendu
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
    // Jeśli nie JSON - używamy tekstu jako treści
    if (event.data?.text()) {
      body = event.data.text();
    }
  }

  // Wyświetlamy powiadomienie
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

// ===== KLIKNIĘCIE W POWIADOMIENIE =====
// Otwiera aplikację po kliknięciu w powiadomienie
function openAppFromNotification(event) {
  const targetUrl = event.notification?.data?.url || '/';
  event.notification.close(); // Zamykamy powiadomienie

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Szukamy istniejącego okna aplikacji
      for (const client of clientList) {
        if ('focus' in client) {
          // Jeśli jest - przenosimy na odpowiednią stronę
          if ('navigate' in client && targetUrl !== '/') {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      // Jeśli nie ma okna - otwieramy nowe
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
}

// Nasłuchuje na kliknięcie w powiadomienie
self.addEventListener('notificationclick', openAppFromNotification);

// Puste nasłuchiwanie na zamknięcie powiadomienia (wymagane przez API)
self.addEventListener('notificationclose', () => {});