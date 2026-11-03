/* 수능 끝난 밤 결정표 — 판정 엔진 (브라우저·node 공용) */
(function(root){
'use strict';
var AREAS=['kor','math','eng','inq'];
var NAME={kor:'국어',math:'수학',eng:'영어',inq:'탐구',sci:'과탐',hist:'한국사',inq1:'탐구1',inq2:'탐구2'};
var EPS=1e-9;
function clampG(g){g=Math.round(+g);return g<1?1:g>9?9:g}
function roundAvg(v,mode){if(mode==='floor')return Math.floor(v+EPS);if(mode==='ceil')return Math.ceil(v-EPS);return v}
function fmt(v){return Number.isInteger(v)?String(v):String(Math.round(v*100)/100)}
/* 탐구 값: top1(상위 1과목) | avg2(2과목 평균, avgRounding) | both(두 과목 중 낮은 쪽=큰 등급) | sciAlt(avg2와 과탐 상위1 중 우수) */
function inqValue(rule,g,kinds){
  var a=g.inq1,b=g.inq2,m=rule.inq||'top1';
  if(m==='top1')return Math.min(a,b);
  if(m==='both')return Math.max(a,b);
  var avg=roundAvg((a+b)/2,rule.avgRounding||'keep');
  if(m==='avg2')return avg;
  if(m==='sciAlt'){var s=bestSci(g,kinds);return s==null?avg:Math.min(avg,s)}
  return Math.min(a,b);
}
function bestSci(g,kinds){var r=null;kinds=kinds||{};if(kinds.inq1==='sci')r=g.inq1;if(kinds.inq2==='sci')r=r==null?g.inq2:Math.min(r,g.inq2);return r}
function areaValues(rule,g,kinds){
  var v={kor:g.kor,math:g.math,eng:g.eng,inq:inqValue(rule,g,kinds)};
  if(rule.engMerge12&&v.eng<=2)v.eng=1;
  return v;
}
function combos(arr,k){var out=[];(function rec(s,cur){if(cur.length===k){out.push(cur.slice());return}for(var i=s;i<arr.length;i++){cur.push(arr[i]);rec(i+1,cur);cur.pop()}})(0,[]);return out}
/* 한 가지 등급 조합에 대해 규칙 판정 */
function evalRule(rule,g,kinds){
  rule=rule||{type:'none'};
  if(rule.type==='none')return{pass:true,why:'수능최저 없음'};
  if(rule.history!=null&&g.hist>rule.history)return{pass:false,why:'한국사 '+g.hist+'등급 > 기준 '+rule.history+'등급',hist:true};
  var v=areaValues(rule,g,kinds),areas=(rule.areas&&rule.areas.length?rule.areas:AREAS).slice();
  if(rule.type==='each'){
    var lim=rule.eachMax,need=rule.pick||areas.length,okA=[];
    areas.forEach(function(a){
      var val=a==='inq'&&rule.inq==='both'?Math.max(g.inq1,g.inq2):v[a];
      if(val<=lim+EPS)okA.push(a)});
    var must=rule.must||[];for(var i=0;i<must.length;i++)if(okA.indexOf(must[i])<0)return{pass:false,why:NAME[must[i]]+' '+fmt(v[must[i]])+'등급 > '+lim+'등급'};
    var p=okA.length>=need;
    return{pass:p,why:(p?'':'')+need+'개 영역 각 '+lim+'등급 이내 필요 → '+okA.length+'개 충족',vals:v};
  }
  var pick=rule.pick||areas.length,max=rule.max,best=null;
  combos(areas,pick).forEach(function(c){
    var must=rule.must||[];for(var i=0;i<must.length;i++)if(c.indexOf(must[i])<0)return;
    var vv={};c.forEach(function(a){vv[a]=v[a]});
    if(rule.mustAny&&rule.mustAny.length){
      var ok=false;
      rule.mustAny.forEach(function(m){
        if(m==='sci'){if(c.indexOf('inq')>=0){var s=bestSci(g,kinds);if(s!=null){ok=true}}}
        else if(c.indexOf(m)>=0)ok=true});
      if(!ok)return;
      /* 수학 없이 과탐으로만 조건을 채우면 탐구 값은 과탐 등급 */
      if(rule.mustAny.indexOf('sci')>=0&&c.indexOf('inq')>=0&&!rule.mustAny.some(function(m){return m!=='sci'&&c.indexOf(m)>=0})){
        var s2=bestSci(g,kinds);if(rule.inq!=='avg2'&&rule.inq!=='both')vv.inq=s2;}
    }
    var sum=c.reduce(function(t,a){return t+vv[a]},0);
    if(best==null||sum<best.sum-EPS)best={sum:sum,picked:c,vals:vv};
  });
  if(!best)return{pass:false,why:'필수 영역 조건을 채울 수 없음'};
  var pass=best.sum<=max+EPS;
  return{pass:pass,sum:best.sum,picked:best.picked,why:best.picked.map(function(a){return NAME[a]+fmt(best.vals[a])}).join('+')+' = '+fmt(best.sum)+(pass?' ≤ ':' > ')+max};
}
/* 경계 과목: edge[subj]='up'(한 등급 위일 수도) | 'down'(한 등급 아래일 수도). 모든 조합 판정 */
var SUBJ=['kor','math','eng','inq1','inq2','hist'];
function scenarios(g,edge){
  var ed=[];edge=edge||{};
  SUBJ.forEach(function(s){if(!edge[s])return;var alt=clampG(g[s]+(edge[s]==='up'?-1:1));if(alt!==g[s])ed.push({s:s,vals:[g[s],alt]})});
  var out=[];var n=ed.length;
  for(var m=0;m<(1<<n);m++){var gg=Object.assign({},g),pick={};for(var i=0;i<n;i++){var val=ed[i].vals[(m>>i)&1];gg[ed[i].s]=val;pick[ed[i].s]=val}out.push({g:gg,pick:pick})}
  return{list:out,edges:ed};
}
function judge(rule,g,kinds,edge){
  var sc=scenarios(g,edge),res=sc.list.map(function(x){var r=evalRule(rule,x.g,kinds);return{pick:x.pick,pass:r.pass,why:r.why}});
  var np=res.filter(function(r){return r.pass}).length,n=res.length;
  var status=np===n?'ok':np===0?'fail':'unknown';
  var deciders=[];
  if(status==='unknown'){
    sc.edges.forEach(function(e){
      var differs=res.some(function(a){return res.some(function(b){
        if(a.pass===b.pass)return false;
        return Object.keys(a.pick).every(function(k){return k===e.s?a.pick[k]!==b.pick[k]:a.pick[k]===b.pick[k]})})});
      if(differs)deciders.push(e.s)});
  }
  var base=evalRule(rule,g,kinds);
  return{status:status,passCount:np,total:n,results:res,deciders:deciders,base:base,sentence:sentence(status,res,deciders,sc.edges,base)};
}
function sentence(status,res,dec,edges,base){
  if(status==='ok')return edges.length?'경계 등급을 모두 넣어도 충족 ('+res.length+'가지 모두)':'가채점 등급 기준 충족: '+base.why;
  if(status==='fail')return edges.length?'경계 등급을 좋게 잡아도 미충족 ('+res.length+'가지 모두)':'가채점 등급 기준 미충족: '+base.why;
  var parts=[];
  if(dec.length===1){
    var s=dec[0];var pv={};res.forEach(function(r){(pv[r.pick[s]]=pv[r.pick[s]]||[]).push(r.pass)});
    Object.keys(pv).sort().forEach(function(k){var a=pv[k];var all=a.every(Boolean),none=a.every(function(x){return!x});parts.push(NAME[s]+' '+k+'등급이면 '+(all?'충족':none?'미충족':'다른 과목에 따라 갈림'))});
    return parts.join(', ')+' — '+res.filter(function(r){return r.pass}).length+'/'+res.length+'가지 충족';
  }
  return dec.map(function(s){return NAME[s]}).join('·')+' 등급에 따라 갈림 — '+res.filter(function(r){return r.pass}).length+'/'+res.length+'가지 충족';
}
/* 규칙을 사람이 읽는 문장으로 */
function describe(rule){
  if(!rule||rule.type==='none')return'수능최저 없음';
  var ar=(rule.areas||AREAS).map(function(a){return NAME[a]}).join('·');
  var inq={top1:'탐구 상위 1과목',avg2:'탐구 2과목 평균'+({keep:'(소수 그대로)',floor:'(소수 버림)',ceil:'(소수 올림)'}[rule.avgRounding||'keep']),both:'탐구 2과목 각각',sciAlt:'탐구 2과목 평균(과탐 응시 시 과탐 상위 1과목과 비교해 우수한 등급)'}[rule.inq||'top1'];
  var s;
  if(rule.type==='each')s=ar+' 중 '+(rule.pick||(rule.areas||AREAS).length)+'개 영역 각 '+rule.eachMax+'등급 이내';
  else s=ar+' 중 '+(rule.pick||(rule.areas||AREAS).length)+'개 영역 등급 합 '+rule.max+' 이내';
  if(rule.must&&rule.must.length)s+=' ('+rule.must.map(function(a){return NAME[a]}).join('·')+' 반드시 포함)';
  if(rule.mustAny&&rule.mustAny.length)s+=' ('+rule.mustAny.map(function(a){return NAME[a]}).join(' 또는 ')+' 1개 이상 포함)';
  s+=', '+inq;
  if(rule.engMerge12)s+=', 영어 1·2등급은 1등급으로 봄';
  if(rule.history!=null)s+=', 한국사 '+rule.history+'등급 이내';
  return s;
}
/* 같은 날 고사 겹침 */
function toMin(t){var m=/^(\d{1,2}):(\d{2})/.exec(t||'');return m?(+m[1])*60+(+m[2]):null}
function overlaps(items){
  var by={};items.forEach(function(it){if(!it.date)return;(by[it.date]=by[it.date]||[]).push(it)});
  var out=[];Object.keys(by).sort().forEach(function(d){var a=by[d];if(a.length<2)return;
    var ts=a.map(function(x){return toMin(x.start)}),gap=null;
    if(ts.every(function(t){return t!=null})){ts.sort(function(x,y){return x-y});gap=Infinity;for(var i=1;i<ts.length;i++)gap=Math.min(gap,ts[i]-ts[i-1])}
    out.push({date:d,items:a,minGap:gap})});
  return out;
}
function dday(target,today){var a=Date.UTC.apply(null,target.split('-').map(function(x,i){return i===1?x-1:+x})),b=Date.UTC.apply(null,today.split('-').map(function(x,i){return i===1?x-1:+x}));return Math.round((a-b)/864e5)}
var api={AREAS:AREAS,NAME:NAME,evalRule:evalRule,judge:judge,scenarios:scenarios,describe:describe,overlaps:overlaps,inqValue:inqValue,areaValues:areaValues,dday:dday,fmt:fmt,roundAvg:roundAvg,toMin:toMin};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SND=api;
})(this);
