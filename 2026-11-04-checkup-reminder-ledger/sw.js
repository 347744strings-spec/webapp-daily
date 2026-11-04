const C='checkup-reminder-ledger-v3';
const A=['./','index.html','styles.css','rules.js','app.js','manifest.webmanifest','icon.svg','icon-192.png','favicon-32.png','privacy.html','data/rules.json','data/templates.json','checkup-penalty-guide/','reminder-message-flow/','january-carryover/'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('checkup-reminder-ledger-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const q=e.request; if(q.method!=='GET')return; const u=new URL(q.url); if(u.origin!==self.location.origin)return;
  e.respondWith(caches.match(q,{ignoreSearch:true}).then(hit=>{
    const net=fetch(q).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(q,cp))}return r});
    if(hit){net.catch(()=>{});return hit}
    return net.catch(()=>q.mode==='navigate'?caches.match('index.html'):Response.error());
  }));
});
