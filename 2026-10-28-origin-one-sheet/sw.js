const C='origin-one-sheet-v1';
const A=['./','index.html','styles.css','rules.js','rules.json','app.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('origin-one-sheet-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin){
    // 외부 API 없음. Pretendard CSS(no-cors)만 stale-while-revalidate, 오프라인이면 시스템 글꼴. 폰트 파일 등 cors 요청은 그대로 네트워크.
    if(req.mode==='cors'||url.hostname!=='cdn.jsdelivr.net')return;
    e.respondWith(caches.open(C).then(c=>c.match(req).then(hit=>{
      const net=fetch(req).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(req,res.clone());return res})
        .catch(()=>hit||(req.destination==='style'?new Response('/* offline: system font */',{headers:{'Content-Type':'text/css'}}):Response.error()));
      return hit||net;
    })));
    return;
  }
  // 같은 출처: 캐시 우선 + 백그라운드 갱신, 오프라인 내비게이션은 index.html
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp))}return res});
    if(hit){net.catch(()=>{});return hit}
    return net.catch(()=>req.mode==='navigate'?caches.match('index.html'):Response.error());
  }));
});
