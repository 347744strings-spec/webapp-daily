const C='visit-assessment-7day-note-v1';
const A=['./','index.html','styles.css','rules.js','app.js','data/domains.json','data/limits-2026.json','data/grades.json','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('visit-assessment-7day-note-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return; // 외부 요청 없음(폰트 CDN·분석 도구 없음)
  // 같은 출처: 캐시 우선 + 백그라운드 갱신, 오프라인 내비게이션은 index.html
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req).then(res=>{if(res&&res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp))}return res});
    if(hit){net.catch(()=>{});return hit}
    return net.catch(()=>req.mode==='navigate'?caches.match('index.html'):Response.error());
  }));
});
