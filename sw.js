// ============================================================
// SIAP JALAN - Service Worker v2.1
// ============================================================

const CACHE_NAME = 'siapjalan-v2.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
  'https://i.ibb.co.com/ymJxJr64/Chat-GPT-Image-Jul-5-2026-01-13-27-AM.png'
];

// ============================================================
// INSTALL
// ============================================================
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Menyimpan cache SIAP JALAN v2.1');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.log('⚠️ Gagal cache beberapa asset:', error);
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
  
  // IGNORE: Google Apps Script (biarkan online)
  if (url.hostname === 'script.google.com' && url.pathname.includes('/macros/s/')) {
    event.respondWith(
      fetch(request).catch(function() {
        return new Response(
          '<html><body style="text-align:center;padding:50px;font-family:sans-serif;background:#0D2F5F;color:white;"><h1>📴 Offline</h1><p>Periksa koneksi internet untuk mengakses SIAP JALAN.</p></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      })
    );
    return;
  }
  
  // CACHE FIRST untuk asset statis
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'i.ibb.co.com') {
    event.respondWith(
      caches.match(request).then(function(cached) {
        return cached || fetch(request);
      })
    );
    return;
  }
  
  // NETWORK FIRST dengan fallback cache
  event.respondWith(
    fetch(request)
      .then(function(response) {
        if (request.method === 'GET' && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        return caches.match(request).then(function(cached) {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 404 });
        });
      })
  );
});

console.log('🔔 Service Worker SIAP JALAN v2.1 aktif!');
