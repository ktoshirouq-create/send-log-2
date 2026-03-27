const CACHE_NAME = 'climb-log-v12';

const ASSETS = [
    './',
    './index.html',
    './app.js?v=12',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    // Force the new service worker to take over immediately
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('V12: Caching production assets...');
            return Promise.all(
                ASSETS.map(asset => {
                    return cache.add(asset).catch(err => console.error('Failed to cache:', asset, err));
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    // Take control of all open tabs immediately
    self.clients.claim();
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete any old versions (v11, v10, etc.) to free up phone space
                    if (cacheName !== CACHE_NAME) {
                        console.log('V12: Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Critical: Do NOT cache or intercept Google Script API calls
    // This ensures your "Save to Cloud" sync always hits the live network
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            // Return from vault if available (Offline First)
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // Otherwise, fetch from network and cache it for next time
            return fetch(event.request).then((networkResponse) => {
                if (event.request.method === 'GET' && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                console.log('V12: Resource unavailable offline:', event.request.url);
            });
        })
    );
});
