// ============================================================
// SERVICE WORKER - SIAP JALAN PWA
// ============================================================

const CACHE_NAME = 'siapjalan-v2.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
  'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png'
];

// Install Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Caching assets...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(function() {
        return self.skipWaiting();
      })
  );
});

// Activate Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch - Network First with cache fallback
self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Clone response untuk cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          // Cache hanya resource yang valid
          if (event.request.url.startsWith('http') && 
              !event.request.url.includes('googleapis.com')) {
            cache.put(event.request, responseClone);
          }
        });
        return response;
      })
      .catch(function() {
        // Jika offline, ambil dari cache
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback untuk halaman
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Handle push notifications (optional)
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SIAP JALAN';
  const options = {
    body: data.body || 'Ada pembaruan di aplikasi SIAP JALAN',
    icon: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    badge: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    vibrate: [200, 100, 200],
    data: data.url || '/'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});

console.log('✅ Service Worker loaded successfully');
