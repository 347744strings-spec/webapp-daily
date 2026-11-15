const CACHE = 'team-project-evidence-notebook-v1';
const CORE = ['./', 'index.html', 'styles.css', 'engine.js', 'app.js', 'data/patterns.json', 'data/judgement-words.json', 'data/risk-rules.json', 'data/peer-presets.json', 'data/samples.json', 'data/sources.json', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'privacy.html', 'kakao-export-guide/', 'team-project-free-rider-guide/', 'peer-evaluation-evidence/'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('team-project-evidence-notebook-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match('index.html'))));
});
