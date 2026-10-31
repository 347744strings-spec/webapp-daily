const C='donation-receipt-desk-v2';
const A=['./','index.html','styles.css','rules.js','app.js','data/codes.json','data/rules.json','data/suffixes.json','data/sample.csv','data/sample-roster.csv','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','favicon-32.png','privacy.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('donation-receipt-desk-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return; // 외부 요청 없음
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp))}return res});
    if(hit){net.catch(()=>{});return hit}
    return net.catch(()=>req.mode==='navigate'?caches.match('index.html'):Response.error());
  }));
});
