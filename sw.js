// ========================
// AITR Service Worker
// Run from the same folder as index.html (GitHub Pages / any static host).
// ========================

const CACHE_NAME = 'aitr-shell-v10';
const SHELL_ASSETS = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => { /* fine if a path 404s in some hosting setups */ })
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

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept writes (status updates, new items, doc generation) —
  // those must always hit the network live.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppsScriptCall = url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com');

  if (isAppsScriptCall) {
    // Data fetch: try the network first (so data is always fresh when online),
    // but fall back to the last successful response if offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell / static assets: serve cached copy instantly, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
