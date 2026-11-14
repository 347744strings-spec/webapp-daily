const CACHE = 'winter-break-care-gap-planner-v1';
const CORE = ['./', 'index.html', 'styles.css', 'engine.js', 'app.js', 'data/holidays.json', 'data/idolbom-rates-2026.json', 'data/help-links.json', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'privacy.html', 'lunch-gap/', 'idolbom-cost/', 'duty-roster/', 'tests.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('winter-break-care-gap-planner-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/data\/.+\.json$/.test(u.pathname)) { e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match('index.html'))));
});
