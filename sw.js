const VERSION = 'v6'; // bump this after any deploy
const SCOPE = new URL(self.registration.scope).pathname; // "/CCS_GameManager/"
const PRECACHE = [
  '', 'index.html', 'style.css', 'app.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png'
].map(p => new URL(p, SCOPE).toString());

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        const clone = resp.clone();
        caches.open(VERSION).then(cache => cache.put(e.request, clone));
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
