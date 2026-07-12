// Service Worker for Sorveteria Supreme (PWA compliance & performance)
const CACHE_NAME = 'supreme-cache-v15';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Pre-caching static resources individually');
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`Failed to pre-cache asset: ${url}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Cache strategy: Network-First falling back to Cache with Cache matching sanitization
self.addEventListener('fetch', (e) => {
  // Only handle HTTP/HTTPS GET requests to bypass chrome-extension schemes or non-GET requests safely
  if (!e.request.url.startsWith('http') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If response is valid, dynamically cache it for smooth offline experience
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback strategy when network fails (offline mode)
        return caches.match(e.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Strip search parameters (e.g. "?offline=true" or "?v=1") to match cache correctly
            return caches.match(e.request, { ignoreSearch: true });
          })
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Single Page Application: Fallback to cached index.html container on page navigations
            if (e.request.mode === 'navigate') {
              return caches.match('/index.html') || caches.match('/');
            }
          });
      })
  );
});
