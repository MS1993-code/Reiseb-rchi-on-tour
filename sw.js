// Reisebärchi on Tour – Service Worker v2.0
const CACHE_NAME = 'reisebaerchi-v8';
const APP_SHELL = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png',
  './splash.mp4',
  './reisebaerchi.webp',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
];
// Bibliotheken, Schriften und Bilder ändern sich nie: direkt aus dem Zwischenspeicher
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function putInCache(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isStatic = STATIC_HOSTS.includes(url.hostname) || (sameOrigin && /\.(png|webp|jpg|mp4|woff2?)$/i.test(url.pathname));

  if (isStatic) {
    // Cache zuerst, sonst Netz (und merken)
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => putInCache(req, res)))
    );
    return;
  }
  if (sameOrigin) {
    // App selbst: sofort aus dem Zwischenspeicher, im Hintergrund aktualisieren
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => putInCache(req, res)).catch(() => cached || caches.match('./index.html'));
        return cached || network;
      })
    );
    return;
  }
  // Fremde Dienste (Wetter, Karten, Kurse): Netz zuerst, bei Funkloch der letzte Stand
  event.respondWith(
    fetch(req).then((res) => putInCache(req, res)).catch(() => caches.match(req))
  );
});
