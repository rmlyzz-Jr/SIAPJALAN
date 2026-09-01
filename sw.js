// ============================================================
// SIAP JALAN - Service Worker v2.6.2
// ============================================================

const CACHE_NAME = 'siapjalan-v2.6.2';
const APP_URL = 'https://script.google.com/macros/s/AKfycbwMRu1M1Tzq_qptbcna4M6bpKj3gQnlc9MtMG1FerSxboiwjhvU2cv4n34pXz5FpC88p4/exec';

// Daftar file yang akan di-cache
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png'
];

// ============================================================
// INSTALL - Cache semua file
// ============================================================
self.addEventListener('install', function(event) {
  console.log('📦 Instal Service Worker SIAP JALAN v2.6.2');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('📦 Menyimpan cache:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(function() {
        console.log('✅ Cache berhasil disimpan');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.log('⚠️ Gagal menyimpan cache:', error);
      })
  );
});

// ============================================================
// ACTIVATE - Hapus cache lama
// ============================================================
self.addEventListener('activate', function(event) {
  console.log('🔓 Activate Service Worker');
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
      console.log('✅ Service Worker aktif dan mengambil kontrol');
      return self.clients.claim();
    })
  );
});

// ============================================================
// FETCH - Strategi: Cache First, Network Fallback
// ============================================================
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // ============================================================
  // 1. LEWATKAN REQUEST KE GOOGLE APPS SCRIPT
  //    (biarkan online, jangan di-cache)
  // ============================================================
  if (url.hostname === 'script.google.com') {
    event.respondWith(
      fetch(request).catch(function(error) {
        console.log('📴 Offline - Google Apps Script tidak dapat diakses');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Offline - Periksa koneksi internet',
            offline: true 
          }),
          { 
            headers: { 'Content-Type': 'application/json' },
            status: 503
          }
        );
      })
    );
    return;
  }
  
  // ============================================================
  // 2. LEWATKAN REQUEST KE i.ibb.co.com (gambar eksternal)
  // ============================================================
  if (url.hostname === 'i.ibb.co.com' || url.hostname === 'i.ibb.co') {
    event.respondWith(
      fetch(request).catch(function() {
        // Jika gambar tidak bisa diambil, berikan placeholder
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#0D2F5F"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="24" fill="#F5B400">SIAP JALAN</text></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      })
    );
    return;
  }
  
  // ============================================================
  // 3. REQUEST NAVIGASI (HTML) - Cache First
  // ============================================================
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then(function(cached) {
          if (cached) {
            console.log('📄 Navigasi dari cache');
            return cached;
          }
          // Jika tidak ada cache, ambil dari network
          return fetch(request).then(function(response) {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put('./index.html', clone);
              });
            }
            return response;
          });
        })
        .catch(function() {
          // Jika offline dan tidak ada cache, berikan halaman offline
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Offline - SIAP JALAN</title><style>body{font-family:sans-serif;text-align:center;padding:50px;background:#0D2F5F;color:white;}h1{color:#F5B400;}a{color:#F5B400;}</style></head><body><h1>📴 Offline</h1><p>Koneksi internet terputus. Silakan periksa koneksi Anda.</p><p style="margin-top:20px;font-size:14px;opacity:0.7;">SIAP JALAN v2.6.2</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }
  
  // ============================================================
  // 4. REQUEST STATIC (CSS, JS, dll) - Cache First
  // ============================================================
  event.respondWith(
    caches.match(request)
      .then(function(cached) {
        if (cached) {
          // Kembalikan dari cache
          return cached;
        }
        
        // Jika tidak ada di cache, ambil dari network
        return fetch(request).then(function(response) {
          // Hanya cache response yang sukses
          if (response && response.status === 200 && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, clone);
            });
          }
          return response;
        });
      })
      .catch(function() {
        // Jika error, coba kembalikan dari cache untuk asset lain
        return caches.match('./index.html');
      })
  );
});

// ============================================================
// PUSH NOTIFICATION (Opsional)
// ============================================================
self.addEventListener('push', function(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'SIAP JALAN', body: 'Ada notifikasi baru!' };
  }
  
  const options = {
    body: data.body || 'Ada aduan baru yang perlu diperiksa',
    icon: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    badge: 'https://i.ibb.co.com/XZTqS2bX/LOGO-SJ.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: '🔍 Buka Aplikasi' },
      { action: 'dismiss', title: '❌ Tutup' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || '📢 SIAP JALAN',
      options
    )
  );
});

// ============================================================
// NOTIFICATION CLICK
// ============================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then(function(clientList) {
        // Jika sudah ada tab yang terbuka, fokus ke tab tersebut
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url.includes('script.google.com') && 'focus' in client) {
            return client.focus();
          }
        }
        // Jika tidak ada, buka tab baru
        return clients.openWindow(APP_URL);
      })
  );
});

console.log('🔔 Service Worker SIAP JALAN v2.6.2 siap!');
