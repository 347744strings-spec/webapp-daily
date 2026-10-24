const C='before-you-sign-v1';
const A=['./','index.html','styles.css','rules.js','app.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('before-you-sign-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const sameOrigin=new URL(req.url).origin===self.location.origin;
  if(!sameOrigin){ // Pretendard CDN만: stale-while-revalidate (cors 요청은 opaque 캐시와 충돌하므로 네트워크로 통과)
    if(req.mode==='cors')return;
    e.respondWith(caches.open(C).then(c=>c.match(req).then(hit=>{const net=fetch(req).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone());return res}).catch(()=>hit||(req.destination==='style'?new Response('/* offline: system font */',{headers:{'Content-Type':'text/css'}}):Response.error()));return hit||net})));
    return;
  }
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(r=>r||fetch(req).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp))}return res}).catch(()=>req.mode==='navigate'?caches.match('index.html'):undefined)));
});
