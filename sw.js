// ============================================================
// SIAP JALAN - Service Worker
// ============================================================

const CACHE_NAME = 'siapjalan-v2.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
  'https://i.ibb.co.com/ymJxJr64/Chat-GPT-Image-Jul-5-2026-01-13-27-AM.png'
];

// ============================================================
// INSTALL - CACHE ASSETS
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Menyimpan cache untuk SIAP JALAN');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.log('❌ Gagal cache:', error);
      })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE - CLEAN OLD CACHES
// ============================================================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ============================================================
// FETCH - NETWORK FIRST, FALLBACK TO CACHE
// ============================================================
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip for Google Apps Script exec requests (biarkan online)
  if (url.hostname === 'script.google.com' && url.pathname.includes('/macros/s/')) {
    event.respondWith(
      fetch(request).catch(function() {
        // Jika offline, tampilkan halaman offline
        return caches.match('/offline.html') || new Response(
          '<h1>📴 Offline</h1><p>Silakan periksa koneksi internet Anda untuk mengakses SIAP JALAN.</p>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }
  
  // Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then(function(response) {
        // Cache kopi dari response
        if (request.method === 'GET' && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback untuk halaman offline
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 404 });
        });
      })
  );
});

// ============================================================
// PUSH NOTIFICATION (Opsional)
// ============================================================
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SIAP JALAN';
  const options = {
    body: data.body || 'Ada pembaruan di SIAP JALAN',
    icon: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    badge: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || 'https://script.google.com/macros/s/AKfycbxaPxtTpQgWpwfMPKLCR15QiCEqL4j6UT0qegDi46EaOWft7jLbcA8Xyg5Z4iSrv84N7Q/exec'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('🔔 Service Worker SIAP JALAN aktif!');
