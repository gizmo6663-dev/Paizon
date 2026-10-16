/* Enkel service worker: gjør appen tilgjengelig uten nett etter første besøk. */
const CACHE = 'paizon-v2';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/logic.js',
  'js/media.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Nettverk først (så oppdateringer kommer med en gang), cache som reserve uten nett.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html')))
  );
});
