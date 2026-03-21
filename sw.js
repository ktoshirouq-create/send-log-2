// =====================================================================
// THE MASTER VAULT (sw.js)
// =====================================================================
// RUTHLESS RULE: Every time you update your app.js, index.html, or 
// styles.css on GitHub, you MUST change this version number (e.g., v2, v3).
// If you do not change this, your phone will load the old cached version forever.
const CACHE_NAME = 'sendlog-cache-v4'; 

const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js'
];

// 1. Install Event: Lock the files in the vault
self.addEventListener('install', event => {
  // Force the new service worker to take over immediately
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. Fetch Event: Intercept network requests
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // If it's in the vault, return it instantly
        if (response) {
          return response;
        }
        // If not, fetch it from the internet
        return fetch(event.request);
      })
  );
});

// 3. Activate Event: The Clean-Up Crew
self.addEventListener('activate', event => {
  // Take control of all open pages immediately
  event.waitUntil(clients.claim());

  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // If a cache exists that doesn't match our new version number, burn it.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
