/* Enkel service worker: gjør appen tilgjengelig uten nett etter første besøk. */
const CACHE = 'paizon-v3';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/logic.js',
  'js/media.js',
  'js/core.js',
  'js/games/spell.js',
  'js/games/count.js',
  'js/games/memory.js',
  'js/games/shapes.js',
  'js/start.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'sounds/letters/a.mp3',
  'sounds/letters/b.mp3',
  'sounds/letters/c.mp3',
  'sounds/letters/d.mp3',
  'sounds/letters/e.mp3',
  'sounds/letters/f.mp3',
  'sounds/letters/g.mp3',
  'sounds/letters/h.mp3',
  'sounds/letters/i.mp3',
  'sounds/letters/j.mp3',
  'sounds/letters/k.mp3',
  'sounds/letters/l.mp3',
  'sounds/letters/m.mp3',
  'sounds/letters/n.mp3',
  'sounds/letters/o.mp3',
  'sounds/letters/p.mp3',
  'sounds/letters/q.mp3',
  'sounds/letters/r.mp3',
  'sounds/letters/s.mp3',
  'sounds/letters/t.mp3',
  'sounds/letters/u.mp3',
  'sounds/letters/v.mp3',
  'sounds/letters/w.mp3',
  'sounds/letters/x.mp3',
  'sounds/letters/y.mp3',
  'sounds/letters/z.mp3',
  'sounds/letters/ae.mp3',
  'sounds/letters/oe.mp3',
  'sounds/letters/aa.mp3',
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
