const CACHE = 'intl-student-work-permit-guard-v1';
const CORE = ['./', 'index.html', 'styles.css', 'engine.js', 'app.js', 'data/rules.json', 'data/industries.json', 'data/holidays.json', 'data/schools.json', 'data/sources.json', 'i18n/ko.json', 'i18n/en.json', 'i18n/vi.json', 'i18n/zh.json', 'i18n/uz.json', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'privacy.html', 'd2-part-time-hours/', 'd4-language-student-part-time/', 'restricted-jobs-one-strike/'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('intl-student-work-permit-guard-')).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; }).catch(() => caches.match('index.html'))));
});
