const CACHE_NAME = 'gg-pettycash-v40';
// Only truly static, rarely-changing assets go through cache-first below.
// index.html itself is deliberately network-first (see fetch handler) so a
// new deploy is picked up the moment the app opens with internet, instead of
// waiting on cache-busting or the browser's own slow update check.
const ASSETS = [
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png',
  './logo-mark-v2.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];
const APP_SHELL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache each asset independently so a single failure (e.g. no internet
      // yet to reach the CDN) doesn't block the whole app from installing.
      Promise.allSettled(ASSETS.concat([APP_SHELL, './']).map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// index.html asks us to take over immediately once a new version has
// installed, rather than waiting for every open tab to be closed first.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Never intercept or cache cross-origin requests (in particular, the live
  // sync calls to script.google.com / the Apps Script host). This app is
  // live-only now — every fetch to the sync endpoint must reach the network
  // fresh every time, never be served or silently replayed from the cache.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isAppShell = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    (url.origin === self.location.origin && url.pathname.endsWith('/'));

  if (isAppShell) {
    // Network-first: always try to get the latest app code when online.
    // Only fall back to whatever's cached when there's no connection at all.
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL, copy));
          return resp;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match(APP_SHELL)))
    );
    return;
  }

  // Everything else (icons, libraries): cache-first, network fallback — these
  // rarely change and cache-first keeps the app fast and usable offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(APP_SHELL));
    })
  );
});
