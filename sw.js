// automatisch erzeugt von scripts/make-sw.mjs
const PREFIX = 'app-code-';
const CACHE = PREFIX + '1e0fe1779c';
const ASSETS = ["./","apple-touch-icon.png","assets/index-CLZwHKzW.css","assets/index-DA2O9nmE.js","assets/jost-cyrillic-wght-normal-CjwCQKo9.woff2","assets/jost-latin-ext-wght-normal-BDUtSsKd.woff2","assets/jost-latin-wght-normal-ObQm3Zd1.woff2","icon-512.png","licenses/font-jost.txt","manifest.webmanifest","mint2go-logo.png","index.html"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() => caches.match('./'))),
  );
});
