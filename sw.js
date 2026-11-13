/* Offline support for the trip app.
   The app's own files are kept on the device, so it opens with no internet.
   Fonts and the map library are kept after their first use. Map tiles and Google Maps always need internet. */
const VERSION = 'trail-v4';
const APP_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const RUNTIME = 'trail-runtime-v1';
const RUNTIME_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== RUNTIME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* App pages: try the network first so updates arrive, fall back to the saved copy when offline */
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('./index.html', copy));
          return res;
        }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
      );
      return;
    }
    event.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  /* Fonts and the map library: use the saved copy, refresh it in the background */
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME).then(cache =>
        cache.match(req).then(hit => {
          const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
  /* Everything else (map tiles, Google Maps) goes straight to the network */
});
