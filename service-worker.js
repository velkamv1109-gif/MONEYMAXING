/*
 * SERVICE WORKER - Offline caching for MONEYMAXING
 * Instala los recursos críticos para funcionar sin internet
 */
const CACHE_NAME = 'moneymaxing-v1';
const FILES_TO_CACHE = [
  '/MONEYMAXING-PWA.html',
  '/manifest.json',
  '/styles.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
      .catch(err => console.error('Install failed', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
