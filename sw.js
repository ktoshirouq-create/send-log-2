const CACHE_NAME = 'crag-logger-v77'; // 
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/app.js',
  '/dashboard.js',
  '/manifest.json'
];

// 1. INSTALL: Pack the backpack with our core files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Caching App Shell');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Clean out old versions of the cache
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

// 3. FETCH: The Bulletproof Interceptor (Network First, Fallback to Cache)
self.addEventListener('fetch', e => {
  // Only intercept GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // We have internet! Clone the response and update the cache so we always have the freshest version offline.
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // WE ARE OFFLINE. The network request failed.
        return caches.match(e.request, { ignoreSearch: true }).then(cached => {
          // Serve the exact cached file if we have it
          if (cached) {
            return cached;
          }
          // THE FAILSAFE: If it's a page refresh/navigation request and we couldn't find it, forcefully serve index.html
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
