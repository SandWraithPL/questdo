/* global clients */
const CACHE_NAME = 'questdo-v5';
const API_CACHE_NAME = 'questdo-api-v1';
const SYNC_QUEUE_NAME = 'questdo-sync-queue';

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
    '/tasks',
    '/me',
    '/rankings/all',
    '/achievements',
    '/challenges',
    '/rare-drops/inventory',
    '/history',
];

// Przy instalacji - otwórz cache
self.addEventListener('install', () => {
    console.log('SW installing...');
    self.skipWaiting();
});

// Przy aktywacji - usuń stare cache i przejmij kontrolę
self.addEventListener('activate', (event) => {
    console.log('SW activating...');
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME).map(key => {
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

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);
    if (event.tag === SYNC_QUEUE_NAME) {
        event.waitUntil(processSyncQueue());
    }
});

async function processSyncQueue() {
    try {
        // Open IndexedDB and get pending items
        const db = await openIndexedDB();
        const pendingItems = await getAllPendingSyncItems(db);
        
        for (const item of pendingItems) {
            try {
                let response;
                const headers = item.headers || {};
                
                if (item.method === 'POST') {
                    response = await fetch(item.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        body: JSON.stringify(item.payload),
                    });
                } else if (item.method === 'PATCH') {
                    response = await fetch(item.endpoint, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        body: JSON.stringify(item.payload),
                    });
                } else if (item.method === 'DELETE') {
                    response = await fetch(item.endpoint, {
                        method: 'DELETE',
                        headers,
                    });
                }
                
                if (response.ok) {
                    await updateSyncItemStatus(db, item.id, 'completed');
                } else {
                    await updateSyncItemStatus(db, item.id, 'failed');
                }
            } catch (err) {
                console.error('Sync item error:', err);
                await updateSyncItemStatus(db, item.id, 'failed');
            }
        }
        
        // Clean up completed items
        await deleteCompletedSyncItems(db);
    } catch (err) {
        console.error('Process sync queue error:', err);
    }
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuestDoDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

function getAllPendingSyncItems(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readonly');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('status');
        const request = index.getAll('pending');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuestDoDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('syncQueue')) {
                const store = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                store.createIndex('status', 'status', { unique: false });
            }
        };
    });
}

async function processSyncQueue() {
    try {
        const db = await openIndexedDB();
        const pendingItems = await getAllPendingSyncItems(db);
        
        for (const item of pendingItems) {
            try {
                let response;
                const headers = item.headers || {};
                
                if (item.method === 'POST') {
                    response = await fetch(item.endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        body: JSON.stringify(item.payload),
                    });
                    if (response.ok) {
                        const serverTask = await response.json();
                        if (item.payload.temp_id) {
                            await deleteTaskByTempId(db, item.payload.temp_id);
                            await addTaskToDB(db, { ...serverTask, sync_status: 'synced' });
                        }
                    }
                } else if (item.method === 'PATCH') {
                    response = await fetch(item.endpoint, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers,
                        },
                        body: JSON.stringify(item.payload),
                    });
                    if (response.ok) {
                        const taskId = item.endpoint.split('/').pop();
                        await updateTaskSyncStatus(db, parseInt(taskId), 'synced');
                    }
                } else if (item.method === 'DELETE') {
                    response = await fetch(item.endpoint, {
                        method: 'DELETE',
                        headers,
                    });
                }
                
                if (response.ok) {
                    await updateSyncItemStatus(db, item.id, 'completed');
                } else {
                    await updateSyncItemStatus(db, item.id, 'failed');
                }
            } catch (err) {
                console.error('Sync item error:', err);
                await updateSyncItemStatus(db, item.id, 'failed');
            }
        }
        
        await deleteCompletedSyncItems(db);
    } catch (err) {
        console.error('Process sync queue error:', err);
    }
}

function deleteTaskByTempId(db, tempId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');
        const index = store.index('temp_id');
        const request = index.getKey(tempId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            if (request.result) {
                store.delete(request.result).onsuccess = () => resolve();
            } else {
                resolve();
            }
        };
    });
}

function addTaskToDB(db, task) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');
        const request = store.add(task);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

function updateTaskSyncStatus(db, taskId, status) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['tasks'], 'readwrite');
        const store = transaction.objectStore('tasks');
        const request = store.get(taskId);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.sync_status = status;
                store.put(data).onsuccess = () => resolve();
            } else {
                resolve();
            }
        };
    });
}

function updateSyncItemStatus(db, id, status) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                data.status = status;
                const updateRequest = store.put(data);
                updateRequest.onerror = () => reject(updateRequest.error);
                updateRequest.onsuccess = () => resolve();
            } else {
                resolve();
            }
        };
    });
}

function deleteCompletedSyncItems(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['syncQueue'], 'readwrite');
        const store = transaction.objectStore('syncQueue');
        const index = store.index('status');
        const request = index.getAllKeys('completed');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const keys = request.result;
            keys.forEach(key => store.delete(key));
            resolve();
        };
    });
}

// Przy każdym żądaniu
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    const isAPI = requestUrl.pathname.startsWith('/api') || CACHEABLE_API_PATTERNS.some(pattern => requestUrl.pathname.includes(pattern));
    
    // Handle non-GET requests
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Handle API requests with cache-first strategy
    if (isAPI) {
        event.respondWith(
            caches.open(API_CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        // Return cached version immediately, then update in background
                        fetch(event.request).then(response => {
                            if (response && response.status === 200) {
                                cache.put(event.request, response.clone());
                            }
                        }).catch(() => {});
                        return cached;
                    }
                    
                    // No cache, fetch from network
                    return fetch(event.request).then(response => {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }
    
    // Handle same-origin static assets with network-first strategy
    const isSameOrigin = requestUrl.origin === self.location.origin;
    if (!isSameOrigin) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
        .then(response => {
            if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
            }
            return response;
        })
        .catch(() => {
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
