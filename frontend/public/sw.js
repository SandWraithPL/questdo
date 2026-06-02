/* global clients */
const CACHE_NAME = 'questdo-v4';

// Przy instalacji - otwórz cache
self.addEventListener('install', () => {
    console.log('SW installing...');
    self.skipWaiting(); // Wymusza aktywację nowego SW
});

// Przy aktywacji - usuń stare cache i przejmij kontrolę
self.addEventListener('activate', (event) => {
    console.log('SW activating...');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log('Deleting old cache:', key);
                    return caches.delete(key);
                })
            )
        ).then(() => clients.claim())
        .then(() => clients.matchAll({ type: 'window', includeUncontrolled: true }))
        .then(clientList => {
            clientList.forEach(client => {
                client.postMessage({ type: 'QUESTDO_SW_ACTIVATED', cacheName: CACHE_NAME });
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'QUESTDO_SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Przy każdym żądaniu - najpierw sieć, potem cache
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    const requestUrl = new URL(event.request.url);
    const isSameOrigin = requestUrl.origin === self.location.origin;
    if (!isSameOrigin) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
        .then(response => {
            // Zapisz w cache tylko udane odpowiedzi
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        })
        .catch(() => {
            // Offline - zwróć z cache
            return caches.match(event.request).then(cached => {
                if (cached) return cached;
                if (event.request.mode === 'navigate') return caches.match('/');
                return new Response('', { status: 503, statusText: 'Offline' });
            });
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
