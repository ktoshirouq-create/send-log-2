const CACHE_NAME = 'climb-log-v16'; // Leapfrogging your old version!

// The essential files we know we need
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',   
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache and saving local assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.error('Cache addAll failed:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Ignore the Google Apps Script database so we don't accidentally cache old logs
    if (event.request.method !== 'GET' || event.request.url.includes('script.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // 1. If we already saved it in the vault, use it!
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // 2. If it's not in the vault, fetch it from the internet...
            return fetch(event.request).then((networkResponse) => {
                // 3. ...and if it's a Google Font or a CSS file we missed, save it to the vault automatically for next time!
                if (event.request.url.includes('fonts.googleapis.com') || 
                    event.request.url.includes('fonts.gstatic.com') ||
                    event.request.url.includes('.css')) {
                    
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                console.log('Offline and asset not cached:', event.request.url);
            });
        })
    );
});
