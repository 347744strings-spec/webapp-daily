const CACHE = 'pet-departure-quarantine-countdown-v1';
const CORE = ['./', 'index.html', 'styles.css', 'calc.js', 'app.js', 'data/rules.json', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'privacy.html', 'japan/', 'eu-uk/', 'us-australia/'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('pet-departure-quarantine-countdown-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/rules.json')) { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match('index.html'))));
});
