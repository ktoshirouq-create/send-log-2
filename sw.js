const CACHE_NAME = 'climb-log-v7';

const ASSETS = [
    './',
    './index.html',
    './styles.css?v=6',
    './app.js?v=6',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching core assets individually...');
            // We cache individually so if one file burps, it doesn't break the whole app
            ASSETS.forEach(asset => {
                cache.add(asset).catch(err => console.error('Failed to cache:', asset));
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    self.clients.claim();
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Burn the old caches to the ground so v6 can take over
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip database API calls so we don't break Google Sheets syncing
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        // ignoreSearch: true tells the phone to match 'styles.css' even if the query string changes
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse; // Use the offline vault if we have it
            }
            
            // Otherwise, get it from the internet and save it for later
            return fetch(event.request).then((networkResponse) => {
                if (event.request.method === 'GET' && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                console.log('Offline and asset not in vault:', event.request.url);
            });
        })
    );
});
