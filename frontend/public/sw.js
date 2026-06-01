const CACHE_NAME = 'questdo-v3';

// Przy instalacji - otwórz cache
self.addEventListener('install', (event) => {
    console.log('SW installing...');
    self.skipWaiting(); // Wymusza aktywację nowego SW
});

// Przy aktywacji - usuń stare cache i przejmij kontrolę
self.addEventListener('activate', (event) => {
    console.log('SW activating...');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => {
                    console.log('Deleting old cache:', key);
                    return caches.delete(key);
                })
            );
        })
    );
    event.waitUntil(clients.claim()); // Przejmij kontrolę nad wszystkimi klientami
});

// Przy każdym żądaniu - najpierw sieć, potem cache
self.addEventListener('fetch', (event) => {
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
            return caches.match(event.request);
        })
    );
});