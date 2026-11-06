'use strict';
const CACHE='alba-pay-check-v1';
const ASSETS=["./", "index.html", "styles.css", "app.js", "calc.js", "rules.json", "faq.json", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "privacy.html", "guide/index.html", "inclusive-wage/index.html", "year-change/index.html", "guide/", "inclusive-wage/", "year-change/"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('alba-pay-check-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>r)));});
