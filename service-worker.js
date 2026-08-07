const CACHE_NAME = 'workout-tracker-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './cloud.js',
  './data.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Only manage the app's own files. Firebase/Firestore/gstatic requests
  // (auth, sync, SDK CDN) must go straight to the network unintercepted --
  // Firestore's live connections and offline queue manage themselves.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  // Network-first: whenever online, always serve the freshest deployed code
  // and refresh the cache from it. Only fall back to the cache when the
  // network fails, so offline use still works but a live connection never
  // shows a stale version waiting on a second reload.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
