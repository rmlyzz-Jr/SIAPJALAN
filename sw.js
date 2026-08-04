// ============================================================
// SIAP JALAN - Service Worker v2.3
// ============================================================

const CACHE_NAME = 'siapjalan-v2.3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png'
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Cache SIAP JALAN v2.3');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.log('⚠️ Gagal cache:', error);
      })
  );
  self.skipWaiting();
});

// ============================================================
// ACTIVATE
// ============================================================
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Hapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH
// ============================================================
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // Google Apps Script - biarkan online
  if (url.hostname === 'script.google.com') {
    event.respondWith(fetch(request));
    return;
  }
  
  // Cache first untuk asset statis
  event.respondWith(
    caches.match(request).then(function(cached) {
      return cached || fetch(request).then(function(response) {
        if (request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
      return new Response('', { status: 404 });
    })
  );
});

console.log('🔔 Service Worker SIAP JALAN v2.3 aktif!');
