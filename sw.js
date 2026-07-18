// ============================================================
// SERVICE WORKER - SIAP JALAN PWA
// ============================================================
const CACHE_NAME = 'siap-jalan-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install Event - Cache assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('🔧 Cache opened');
                return cache.addAll(ASSETS);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// Activate Event - Clean old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) {
                            return name !== CACHE_NAME;
                        })
                        .map(function(name) {
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                return self.clients.claim();
            })
    );
});

// Fetch Event - Network first with cache fallback
self.addEventListener('fetch', function(event) {
    // Skip Google Apps Script requests (dynamic)
    if (event.request.url.includes('script.google.com')) {
        return fetch(event.request);
    }
    
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                // Clone response for caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                return response;
            })
            .catch(function() {
                return caches.match(event.request)
                    .then(function(cachedResponse) {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        // Return offline fallback
                        return new Response('Offline - Data tidak tersedia', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Background Sync
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-aduan') {
        event.waitUntil(syncAduan());
    }
});

function syncAduan() {
    return Promise.resolve();
}

// Push Notification
self.addEventListener('push', function(event) {
    const options = {
        body: event.data ? event.data.text() : 'Ada aduan baru yang perlu ditindaklanjuti!',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Buka Aplikasi'
            },
            {
                action: 'close',
                title: 'Tutup'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('📋 SIAP JALAN', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});