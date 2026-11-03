/* 수능 끝난 밤 결정표 — 앱 */
(function(){
'use strict';
var R=window.SND, APP='수능 끝난 밤 결정표', KEY='sbn-state-v1';
var DATA=null, view=document.getElementById('view'), SAMPLE=false, SHARED=null;
var SUBJ=[['kor','국어'],['math','수학'],['eng','영어'],['inq1','탐구1'],['inq2','탐구2'],['hist','한국사']];
var DEC={go:'응시',hold:'보류',drop:'포기'};
var ST={ok:['충족','✓','ok'],unknown:['모름','?','unk'],fail:['미충족','✕','fail']};
function today(){return window.__TODAY||new Date(Date.now()+9*36e5).toISOString().slice(0,10)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pageTitle(h){document.title=h&&h!==APP?h+' — '+APP:APP}
function blank(){return{grades:{kor:3,math:3,eng:3,inq1:3,inq2:3,hist:3},kinds:{inq1:'sci',inq2:'sci'},edge:{},cards:[],kidnapCheck:false,mode:'estimate'}}
function sample(){return{grades:{kor:2,math:3,eng:2,inq1:2,inq2:3,hist:3},kinds:{inq1:'sci',inq2:'sci'},edge:{math:'up'},
  cards:[{ruleId:'korea',variant:'nat',decision:'',memo:''},{ruleId:'khu',variant:'nat',decision:'',memo:''},{ruleId:'konkuk',variant:'nat',decision:'',memo:''},
  {ruleId:'sookmyung',variant:'nat',decision:'',memo:''},{ruleId:'soongsil',variant:'nat',decision:'',memo:''},{ruleId:'cau',variant:'nat',decision:'',memo:''}],kidnapCheck:true,mode:'estimate'}}
var state=load();
function load(){try{var s=JSON.parse(localStorage.getItem(KEY));if(s&&s.grades&&Array.isArray(s.cards)){var b=blank();s.kinds=s.kinds||b.kinds;s.edge=s.edge||{};return s}}catch(e){}return blank()}
var sampleState=null;
function cur(){return SAMPLE?sampleState:state}
function save(){if(SAMPLE)return;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function toast(t){var el=document.getElementById('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on')},2400)}
function findRule(id){return DATA.rules.filter(function(r){return r.id===id})[0]}
function resolve(c){
  if(c.custom)return{univ:c.custom.univ||'직접 입력',track:c.custom.track||'',unit:c.custom.unit||'',rule:c.custom.rule,exams:c.custom.exams||[],check:null,source:'',memo:'직접 입력한 기준 — 모집요강 원문과 대조하세요.',custom:true};
  var r=findRule(c.ruleId);if(!r)return null;var v=r.variants.filter(function(x){return x.key===c.variant})[0]||r.variants[0];
  return{univ:r.univ,track:r.track,unit:v.unit,rule:v.rule,exams:v.exams,check:v.check,source:r.source,sourceLabel:r.sourceLabel,memo:v.memo,id:r.id,variant:v.key};
}
function judged(s){s=s||cur();return s.cards.map(function(c,i){var d=resolve(c);if(!d)return null;var edge=s.mode==='final'?{}:s.edge;var j=R.judge(d.rule,s.grades,s.kinds,edge);return{i:i,c:c,d:d,j:j}}).filter(Boolean)}
function fmtDate(d){var p=d.split('-');var w='일월화수목금토'[new Date(Date.UTC(+p[0],p[1]-1,+p[2])).getUTCDay()];return(+p[1])+'/'+(+p[2])+'('+w+')'}
function badge(k){return{ok:'<span class="vb ok">원문 확인</span>',derived:'<span class="vb der">원문 규정으로 계산</span>',partial:'<span class="vb part">사본·공지로 확인</span>',check:'<span class="vb nc">확인 필요</span>'}[k]||''}
function examLine(e,check){
  check=check||{};var t=[];
  t.push('<b class="nw">'+fmtDate(e.date)+'</b>');
  if(e.start)t.push('시작 <b class="nw">'+esc(e.start)+'</b>'+(check.start?' '+badge(check.start):''));
  t.push('입실 '+(e.checkin?'<b class="nw">'+esc(e.checkin)+'</b> '+badge(check.checkin):'<b class="nw tbd">확인 필요</b>'));
  return t.join(' · ')+(e.note?'<br><small>'+esc(e.note)+'</small>':'');
}
var DISC='<div class="disc" role="note" data-disc><strong>가채점 기반 참고용</strong> — 이 표는 합격이나 수능최저 충족을 확정하지 않아요. 최종 기준은 각 대학 <b>2027학년도 모집요강 원문</b>과 12월 11일 성적통지표예요. 기준일 '+'2026-11-03'+'.</div>';
function tabs(on){var tb=document.getElementById('tabbar');tb.hidden=!on||!!SHARED;}
function setTab(t){[].forEach.call(document.querySelectorAll('#tabbar a'),function(a){if(a.dataset.tab===t)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')})}
function sampleBar(){return SAMPLE?'<div class="samplebar" role="status">예시 학생 ‘지우’의 결정표예요. 바꿔도 저장되지 않아요. <a class="btn sm" href="#/start">내 것 시작</a></div>':''}
/* ---------- 화면 ---------- */
function home(){
  pageTitle('');tabs(false);SAMPLE=false;
  var t=today(),d1=R.dday('2026-11-19',t),d2=R.dday('2026-12-11',t),after=d2<=0;
  var has=state.cards.length>0;
  view.innerHTML='<h1>'+APP+'</h1>'+DISC+
  '<p class="lead">수능 끝난 밤, 원서 6장 갈지 말지 10분에 정하기. 가채점 등급과 경계 과목만 넣으면 장마다 수능최저를 <b>충족·모름·미충족</b>으로 나누고, 주말 고사 겹침과 입실 시각, 수시 합격 시 정시 지원 불가 경고까지 한 장에 정리해요.</p>'+
  '<div class="dd"><div><span>수능</span><b class="nw" id="dd1">'+(d1>0?'D-'+d1:d1===0?'D-day':'D+'+(-d1))+'</b><small>2026-11-19(목)</small></div><div><span>성적 통지</span><b class="nw" id="dd2">'+(d2>0?'D-'+d2:d2===0?'D-day':'D+'+(-d2))+'</b><small>2026-12-11(금)</small></div></div>'+
  '<div class="cta"><button class="btn" id="sampleBtn" type="button">샘플로 먼저 보기</button><a class="btn pri" href="'+(has?'#/table':'#/start')+'" id="startBtn">'+(has?'내 결정표 열기':'내 것 시작')+'</a></div>'+
  '<p><button class="btn ghost" type="button" id="finalBtn" '+(after?'':'disabled aria-disabled="true"')+'>실채점 모드'+(after?(state.mode==='final'?' 끄기':' 켜기'):' (12/11 성적 통지 후 열려요)')+'</button></p>'+
  '<section class="card"><h2>이렇게 정해요</h2><ol class="steps"><li>원서 카드 추가 — 샘플 대학 8곳은 모집요강 원문으로 확인한 최저·고사일이 채워져요.</li><li>가채점 등급 입력 — 애매한 과목은 ‘위일 수도/아래일 수도’를 켜요.</li><li>결정표 — 경계 조합을 모두 계산해 충족·모름·미충족과 이유를 보여 줘요.</li><li>일정·공유 — 같은 날 겹침과 입실 시각을 보고, 부모님·담임께 링크를 보내요.</li></ol></section>'+
  '<section class="card"><h2>더 읽기</h2><ul class="links"><li><a href="suneung-minimum-calc/">탐구 2과목 평균·한국사·모집단위 예외, 수능최저 계산법</a></li><li><a href="susi-pass-no-jeongsi/">수시 합격하면 등록 안 해도 정시 지원 불가</a></li><li><a href="nonsul-weekend-overlap/">수능 후 논술 주말 겹침·입실 시각 정리</a></li><li><a href="#/about">기준·출처 (8개 대학 원문 확인 결과)</a></li></ul></section>';
}
function start(){SAMPLE=false;location.hash=state.cards.length?'#/table':'#/cards'}
function cardsView(){
  pageTitle('원서 카드');tabs(true);setTab('cards');var s=cur();
  var h='<h1>원서 카드</h1>'+sampleBar()+DISC+'<p class="muted">수시 원서는 보통 6장(최대 9장까지 넣을 수 있어요). 모집단위가 다르면 최저가 다를 수 있으니 꼭 고르세요.</p>';
  if(!s.cards.length)h+='<div class="empty"><p>아직 카드가 없어요.</p></div>';
  h+='<ul class="clist">'+s.cards.map(function(c,i){var d=resolve(c);if(!d)return'';
    var opts='';if(!d.custom){var r=findRule(c.ruleId);if(r.variants.length>1)opts='<label class="fld">모집단위<select data-variant="'+i+'">'+r.variants.map(function(v){return'<option value="'+v.key+'"'+(v.key===d.variant?' selected':'')+'>'+esc(v.unit)+'</option>'}).join('')+'</select></label>'}
    return'<li class="card"><h2 class="ct">'+esc(d.univ)+' <small>'+esc(d.track)+'</small></h2>'+(opts||'<p class="muted">'+esc(d.unit)+'</p>')+
    '<p class="rule">'+esc(R.describe(d.rule))+' '+(d.check?badge(d.check.rule):badge('check'))+'</p>'+
    d.exams.map(function(e){return'<p class="ex">'+examLine(e,d.check)+'</p>'}).join('')+
    '<p class="vnote">모집요강 원문으로 최종 확인하세요.'+(d.source?' <a href="'+esc(d.source)+'" target="_blank" rel="noopener">'+esc(d.sourceLabel)+'</a>':'')+'</p>'+
    '<div class="row"><button class="btn sm ghost" type="button" data-del="'+i+'" aria-label="'+esc(d.univ)+' 카드 삭제">삭제</button></div></li>'}).join('')+'</ul>';
  h+='<div class="cta">'+(s.cards.length<9?'<a class="btn pri" href="#/add">카드 추가</a>':'<p>최대 9장이에요.</p>')+'<a class="btn" href="#/grades">등급 입력으로</a></div>';
  view.innerHTML=h;
}
function addView(){
  pageTitle('카드 추가');tabs(true);setTab('cards');
  var h='<h1>카드 추가</h1>'+sampleBar()+'<section class="card"><h2>샘플 대학에서 고르기</h2><p class="muted">기준일 2026-11-03, 각 대학 2027학년도 수시 모집요강 원문 대조.</p><form id="pickF"><label class="fld">대학·전형<select id="pk">'+DATA.rules.map(function(r){return'<option value="'+r.id+'">'+esc(r.univ+' '+r.track)+'</option>'}).join('')+'</select></label><label class="fld">모집단위<select id="pv"></select></label><p id="pvd" class="rule"></p><button class="btn pri" type="submit">이 카드 추가</button></form></section>'+
  '<section class="card"><h2>직접 입력(규칙 빌더)</h2><form id="bF" novalidate>'+
  '<label class="fld">대학 이름<input id="bu" maxlength="30" required autocomplete="off"></label><p class="err" id="e-bu" role="alert"></p>'+
  '<label class="fld">전형·모집단위<input id="bt" maxlength="40" autocomplete="off"></label>'+
  '<label class="fld">최저 유형<select id="bty"><option value="sum">합(N개 영역 등급 합 M 이내)</option><option value="each">각(N개 영역 각 M등급 이내)</option><option value="none">최저 없음</option></select></label>'+
  '<fieldset class="fld" id="bar"><legend>반영 영역</legend>'+R.AREAS.map(function(a){return'<label class="chk"><input type="checkbox" name="ar" value="'+a+'" checked>'+R.NAME[a]+'</label>'}).join('')+'</fieldset>'+
  '<div class="two"><label class="fld">몇 개 영역(N)<input id="bn" type="number" inputmode="numeric" min="1" max="4" value="2"></label><label class="fld" id="bml">등급 합 상한(M)<input id="bm" type="number" inputmode="numeric" min="1" max="36" value="5"></label></div><p class="err" id="e-bn" role="alert"></p>'+
  '<fieldset class="fld"><legend>반드시 포함</legend>'+R.AREAS.map(function(a){return'<label class="chk"><input type="checkbox" name="mu" value="'+a+'">'+R.NAME[a]+'</label>'}).join('')+'</fieldset>'+
  '<label class="fld">하나 이상 포함<select id="bma"><option value="">없음</option><option value="math,sci">수학 또는 과탐</option><option value="kor,math">국어 또는 수학</option></select></label>'+
  '<label class="fld">탐구 반영<select id="bi"><option value="top1">상위 1과목</option><option value="avg2">2과목 평균</option><option value="both">2과목 각각(낮은 쪽 기준)</option></select></label>'+
  '<label class="fld">평균 소수 처리<select id="br"><option value="keep">그대로(버림 없음)</option><option value="floor">버림(절사)</option><option value="ceil">올림</option></select></label>'+
  '<label class="chk"><input type="checkbox" id="bem">영어 1·2등급을 1등급으로 봄</label>'+
  '<label class="fld">한국사 상한(없으면 비움)<input id="bh" type="number" inputmode="numeric" min="1" max="9"></label>'+
  '<div class="two"><label class="fld">고사일<input id="bd" type="date" min="2026-11-01" max="2026-12-31"></label><label class="fld">시작 시각<input id="bs" type="time"></label></div><label class="fld">입실 완료 시각<input id="bc" type="time"></label>'+
  '<button class="btn pri" type="submit">직접 입력 카드 추가</button></form></section>';
  view.innerHTML=h;
  var pk=document.getElementById('pk'),pv=document.getElementById('pv');
  function fill(){var r=findRule(pk.value);pv.innerHTML=r.variants.map(function(v){return'<option value="'+v.key+'">'+esc(v.unit)+'</option>'}).join('');desc()}
  function desc(){var r=findRule(pk.value),v=r.variants.filter(function(x){return x.key===pv.value})[0];document.getElementById('pvd').innerHTML=esc(R.describe(v.rule))+' · '+v.exams.map(function(e){return fmtDate(e.date)}).join(', ')+' <a href="'+esc(r.source)+'" target="_blank" rel="noopener">출처</a>'}
  pk.onchange=fill;pv.onchange=desc;fill();
  document.getElementById('pickF').onsubmit=function(e){e.preventDefault();var s=cur();if(s.cards.length>=9){toast('최대 9장이에요');return}s.cards.push({ruleId:pk.value,variant:pv.value,decision:'',memo:''});save();toast('카드를 추가했어요');location.hash='#/cards'};
  document.getElementById('bF').onsubmit=function(e){e.preventDefault();
    var u=document.getElementById('bu'),ty=document.getElementById('bty').value,n=+document.getElementById('bn').value,m=+document.getElementById('bm').value;
    var ok=true;['bu','bn'].forEach(function(id){document.getElementById('e-'+id).textContent='';document.getElementById(id).removeAttribute('aria-invalid')});
    if(!u.value.trim()){document.getElementById('e-bu').textContent='대학 이름을 적어 주세요.';u.setAttribute('aria-invalid','true');u.focus();ok=false}
    var areas=[].map.call(document.querySelectorAll('input[name=ar]:checked'),function(x){return x.value});
    if(ok&&ty!=='none'&&(!(n>=1)||n>areas.length||!(m>=1))){document.getElementById('e-bn').textContent='N은 1~'+areas.length+'(반영 영역 수), M은 1 이상이어야 해요.';var bn=document.getElementById('bn');bn.setAttribute('aria-invalid','true');bn.focus();ok=false}
    if(!ok)return;
    var rule={type:ty};if(ty!=='none'){rule.areas=areas;rule.pick=n;if(ty==='sum')rule.max=m;else rule.eachMax=m;
      var mu=[].map.call(document.querySelectorAll('input[name=mu]:checked'),function(x){return x.value});if(mu.length)rule.must=mu;
      var ma=document.getElementById('bma').value;if(ma)rule.mustAny=ma.split(',');rule.inq=document.getElementById('bi').value;rule.avgRounding=document.getElementById('br').value;
      if(document.getElementById('bem').checked)rule.engMerge12=true;var hh=document.getElementById('bh').value;if(hh)rule.history=+hh}
    var d=document.getElementById('bd').value;var s=cur();if(s.cards.length>=9){toast('최대 9장이에요');return}
    s.cards.push({custom:{univ:u.value.trim(),track:document.getElementById('bt').value.trim(),rule:rule,exams:d?[{date:d,start:document.getElementById('bs').value||'',checkin:document.getElementById('bc').value||''}]:[]},decision:'',memo:''});
    save();toast('직접 입력 카드를 추가했어요');location.hash='#/cards'};
  document.getElementById('bty').onchange=function(){document.querySelector('#bml').firstChild.textContent=this.value==='each'?'각 영역 등급 상한(M)':'등급 합 상한(M)'};
}
function gradesView(){
  pageTitle('가채점 등급');tabs(true);setTab('grades');var s=cur(),final=s.mode==='final';
  var h='<h1>가채점 등급</h1>'+sampleBar()+DISC+'<p class="muted">'+(final?'실채점 모드: 성적통지표 등급을 넣으세요. 경계 토글은 쓰지 않아요.':'애매한 과목은 ‘위일 수도’(한 등급 더 좋을 수도) 또는 ‘아래일 수도’를 고르면 두 경우를 모두 계산해요.')+'</p><form id="gF" class="glist">';
  SUBJ.forEach(function(p){var k=p[0],g=s.grades[k],e=s.edge[k]||'';
    h+='<fieldset class="gr card"><legend>'+p[1]+(k==='inq1'||k==='inq2'?' <select class="kind" data-kind="'+k+'" aria-label="'+p[1]+' 과목 구분"><option value="sci"'+(s.kinds[k]==='sci'?' selected':'')+'>과탐</option><option value="soc"'+(s.kinds[k]==='soc'?' selected':'')+'>사탐</option></select>':'')+'</legend>'+
    '<div class="step"><button type="button" class="sb" data-step="'+k+'" data-d="-1" aria-label="'+p[1]+' 한 등급 좋게">−</button><output id="g-'+k+'" class="gv nw" aria-live="polite">'+g+'등급</output><button type="button" class="sb" data-step="'+k+'" data-d="1" aria-label="'+p[1]+' 한 등급 낮게">+</button></div>'+
    (final?'':'<div class="seg" role="radiogroup" aria-label="'+p[1]+' 경계">'+[['','확실'],['up','위일 수도'],['down','아래일 수도']].map(function(o){return'<label><input type="radio" name="e-'+k+'" value="'+o[0]+'"'+(e===o[0]?' checked':'')+'><span>'+o[1]+'</span></label>'}).join('')+'</div>')+'</fieldset>'});
  h+='</form><p class="cta"><a class="btn pri" href="#/table">결정표 보기</a></p>';
  view.innerHTML=h;
}
function verdictCard(x,s,ov,shared){
  var st=ST[x.st||x.j.status],d=x.d,c=x.c;
  var dec='<div class="seg dec" role="radiogroup" aria-label="'+esc(d.univ)+' 결정">'+Object.keys(DEC).map(function(k){return'<label><input type="radio" name="dec-'+x.i+'" value="'+k+'" data-dec="'+x.i+'"'+(c.decision===k?' checked':'')+(shared?' disabled':'')+'><span>'+DEC[k]+'</span></label>'}).join('')+'</div>';
  var kid=s.kidnapCheck&&(x.st||x.j.status)!=='fail'?'<p class="kid" role="note"><b>⚠ 납치 주의</b> 이 대학에 합격하면 등록하지 않아도 정시 지원 불가. 정시로 더 나은 곳을 노린다면 응시를 다시 생각해 보세요. <a href="#/about" class="nw">근거</a></p>':'';
  var why=shared?(x.dec&&x.dec.length?x.dec.map(function(k){return R.NAME[k]}).join('·')+' 등급에 따라 갈림':'(등급은 공유되지 않음)'):esc(x.j.sentence);
  var scen=!shared&&x.j.total>1?'<details><summary>경계 조합 '+x.j.total+'가지 보기</summary><table class="sc"><thead><tr><th scope="col">조합</th><th scope="col">판정</th><th scope="col">계산</th></tr></thead><tbody>'+x.j.results.map(function(r){return'<tr><td>'+Object.keys(r.pick).map(function(k){return R.NAME[k]+r.pick[k]}).join(' ')+'</td><td><span class="nw">'+(r.pass?'✓ 충족':'✕ 미충족')+'</span></td><td class="n">'+esc(r.why)+'</td></tr>'}).join('')+'</tbody></table></details>':'';
  var ovl=ov?'<p class="ovw" role="note">⚠ '+fmtDate(ov.date)+' 같은 날 고사 '+ov.items.length+'개 — 일정 탭에서 하나를 고르세요.</p>':'';
  return'<li class="vc '+st[2]+'"><div class="vh"><span class="vs" aria-hidden="true">'+st[1]+'</span><b class="vl">'+st[0]+'</b><h2 class="ct">'+esc(d.univ)+' <small>'+esc(d.track)+'</small></h2></div>'+
  '<p class="muted">'+esc(d.unit)+'</p><p class="why">'+why+'</p>'+scen+
  d.exams.map(function(e){return'<p class="ex">'+examLine(e,d.check)+'</p>'}).join('')+ovl+kid+
  (shared?'<p><b>결정:</b> '+(DEC[c.decision]||'미정')+'</p>':dec)+
  (c.memo?'<p class="memo">메모: '+esc(c.memo)+'</p>':'')+
  '<p class="vnote"><small>최저 '+esc(R.describe(d.rule))+'. 모집요강 원문 확인'+(d.source?': <a href="'+esc(d.source)+'" target="_blank" rel="noopener">'+esc(d.sourceLabel||'출처')+'</a>':'')+'</small></p></li>';
}
var ORDER={ok:0,unknown:1,fail:2};
function overlapMap(list){var items=[];list.forEach(function(x){x.d.exams.forEach(function(e){items.push({date:e.date,start:/^\d/.test(e.start||'')&&!/또는/.test(e.start)?e.start:'',i:x.i,univ:x.d.univ})})});var ov=R.overlaps(items),m={};ov.forEach(function(o){o.items.forEach(function(it){m[it.i]=o})});return{map:m,list:ov}}
function kidnapBox(){var k=DATA.kidnap;return'<section class="card kbox"><h2>수시 합격하면 등록하지 않아도 정시 지원 불가</h2><p>'+esc(k.text)+' '+esc(k.except)+'</p><ul class="links">'+k.sources.map(function(s){return'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.label)+'</a></li>'}).join('')+'</ul></section>'}
function tableView(){
  pageTitle('결정표');tabs(true);setTab('table');var s=cur();
  if(!s.cards.length){view.innerHTML='<h1>결정표</h1>'+sampleBar()+DISC+'<div class="empty"><p>원서 카드를 먼저 추가하세요.</p><a class="btn pri" href="#/add">카드 추가</a></div>';return}
  var list=judged(s).sort(function(a,b){return ORDER[a.j.status]-ORDER[b.j.status]||a.i-b.i}),ov=overlapMap(list);
  var n={ok:0,unknown:0,fail:0};list.forEach(function(x){n[x.j.status]++});
  var h='<h1>결정표</h1>'+sampleBar()+DISC+(s.mode==='final'?'<p class="pill">실채점 모드</p>':'')+
  '<div class="sum" aria-label="판정 요약"><span class="ok">✓ 충족 <b id="n-ok">'+n.ok+'</b></span><span class="unk">? 모름 <b id="n-unk">'+n.unknown+'</b></span><span class="fail">✕ 미충족 <b id="n-fail">'+n.fail+'</b></span></div>'+
  '<label class="chk big"><input type="checkbox" id="kid"'+(s.kidnapCheck?' checked':'')+'> 정시로 이 대학들보다 나은 곳을 노린다(납치 경고 켜기)</label>'+
  (n.unknown?'<p class="muted">‘모름’은 경계 등급에 따라 갈리는 카드예요. 최저를 맞출 가능성이 있으니 응시 쪽으로 검토해 보세요. 결정은 본인이 해요.</p>':'')+
  '<ul class="vlist">'+list.map(function(x){return verdictCard(x,s,ov.map[x.i])}).join('')+'</ul>'+kidnapBox()+
  '<div class="cta noprint"><a class="btn pri" href="#/share">공유 링크 만들기</a><button class="btn" type="button" id="printBtn">인쇄(A4)</button></div>'+
  '<section class="printonly"><h2>주말 일정</h2>'+timelineHTML(list,ov)+'</section>';
  view.innerHTML=h;
}
function timelineHTML(list,ov){
  var by={};list.forEach(function(x){x.d.exams.forEach(function(e){(by[e.date]=by[e.date]||[]).push({x:x,e:e})})});
  var days=Object.keys(by).sort();if(!days.length)return'<p>고사일이 있는 카드가 없어요.</p>';
  return'<ol class="tl">'+days.map(function(d){var o=ov.list.filter(function(q){return q.date===d})[0];
    return'<li class="day'+(by[d].length>1?' clash':'')+'"><h3>'+fmtDate(d)+(by[d].length>1?' <span class="clw">⚠ 겹침 '+by[d].length+'개'+(o&&o.minGap!=null&&o.minGap>=180?' (시작 간격 '+Math.floor(o.minGap/60)+'시간 — 이동 시간 확인)':'')+'</span>':'')+'</h3><ul>'+
    by[d].sort(function(a,b){return(R.toMin(a.e.start)||0)-(R.toMin(b.e.start)||0)}).map(function(it){var st=ST[it.x.st||it.x.j.status];return'<li><span class="tag '+st[2]+'">'+st[1]+' '+st[0]+'</span> <b>'+esc(it.x.d.univ)+'</b> '+esc(it.x.d.unit)+'<br>'+examLine(it.e,it.x.d.check)+' · 결정: <b>'+(DEC[it.x.c.decision]||'미정')+'</b></li>'}).join('')+'</ul></li>'}).join('')+'</ol>';
}
function planView(){
  pageTitle('주말 일정');tabs(true);setTab('plan');var s=cur();
  var list=judged(s),ov=overlapMap(list);
  var h='<h1>주말 일정</h1>'+sampleBar()+DISC+'<p class="muted">수능 후 논술은 11/21~12/6에 몰려 있어요. 같은 날 두 장이면 입실 시각과 이동 시간을 보고 하나를 고르세요.</p>'+timelineHTML(list,ov);
  h+='<section class="card"><h2>이동 메모</h2><p class="muted">출발지·소요시간 등을 적어 두세요. 공유 링크에 함께 들어가니 주소 같은 개인정보는 쓰지 마세요.</p>'+list.map(function(x){return'<label class="fld">'+esc(x.d.univ)+' '+esc(x.d.unit)+'<input data-memo="'+x.i+'" maxlength="60" value="'+esc(x.c.memo||'')+'" autocomplete="off"></label>'}).join('')+'</section>';
  view.innerHTML=h;
}
/* ---------- 공유 ---------- */
function b64u(bytes){var s='';for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(t){t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';var s=atob(t),a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}
async function pipe(bytes,T){var cs=new T('deflate-raw');var w=cs.writable.getWriter();w.write(bytes).catch(function(){});w.close().catch(function(){});return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
async function encode(obj){var b=new TextEncoder().encode(JSON.stringify(obj));if(window.CompressionStream)return'z'+b64u(await pipe(b,CompressionStream));return'j'+b64u(b)}
async function decode(t){var b=unb64u(t.slice(1));if(t[0]==='z')b=await pipe(b,DecompressionStream);return JSON.parse(new TextDecoder().decode(b))}
function payload(withScores){var s=cur(),list=judged(s);
  var p={v:1,k:s.kidnapCheck?1:0,m:s.mode==='final'?1:0,c:list.map(function(x){var c=x.c;return{r:c.custom?null:c.ruleId,va:c.custom?null:c.variant,cu:c.custom?{univ:c.custom.univ,track:c.custom.track,rule:c.custom.rule,exams:c.custom.exams}:null,d:c.decision||'',me:c.memo||'',st:x.j.status,dc:x.j.deciders}})};
  if(withScores){p.g=s.grades;p.e=s.edge;p.ki=s.kinds}return p}
function shareView(){
  pageTitle('공유');tabs(true);setTab('table');
  view.innerHTML='<h1>공유</h1>'+sampleBar()+DISC+'<section class="card"><p>부모님·담임께 읽기 전용 결정표 링크를 보내요. 서버에 저장하지 않고 링크(주소) 안에 내용이 들어가요. 이름은 넣지 않아요.</p>'+
  '<label class="chk big"><input type="checkbox" id="incS"> 가채점 등급(점수)도 포함</label><p class="warn" id="sw" hidden role="alert">등급은 민감한 정보예요. 링크를 받은 사람은 누구나 등급을 볼 수 있고, 메신저 미리보기·기록에 남을 수 있어요. 꼭 필요할 때만 켜세요.</p>'+
  '<p class="muted">기본값: 등급은 빼고 대학·고사일·입실 시각·판정(충족/모름/미충족)·결정·이동 메모만 담아요.</p><button class="btn pri" type="button" id="mk">링크 만들기</button><div id="lk" hidden><label class="fld">공유 링크<input id="lku" readonly></label><button class="btn" type="button" id="cp">복사</button></div></section>';
}
async function sharedView(t){
  var p;try{p=await decode(t)}catch(e){view.innerHTML='<h1>공유 결정표</h1><p class="warn" role="alert">링크가 손상되었어요. 보낸 사람에게 다시 요청하세요.</p>';pageTitle('공유 결정표');return}
  SHARED=p;tabs(false);pageTitle('공유 결정표');
  var s={kidnapCheck:!!p.k,mode:p.m?'final':'estimate',grades:p.g,edge:p.e||{},kinds:p.ki||{}};
  var list=p.c.map(function(c,i){var cc={ruleId:c.r,variant:c.va,custom:c.cu,decision:c.d,memo:c.me};var d=resolve(cc);if(!d)return null;
    var x={i:i,c:cc,d:d,st:c.st,dec:c.dc};if(p.g){x.j=R.judge(d.rule,p.g,p.ki||{},p.m?{}:(p.e||{}));x.st=x.j.status}return x}).filter(Boolean);
  list.sort(function(a,b){return ORDER[a.st]-ORDER[b.st]||a.i-b.i});var ov=overlapMap(list);
  var h='<h1>공유 결정표</h1><div class="ro" role="note">읽기 전용이에요. 이 결정표는 학생이 직접 입력한 정보예요.</div>'+DISC+
  (p.g?'<section class="card"><h2>가채점 등급</h2><p class="gline">'+SUBJ.map(function(q){return q[1]+' <b class="nw">'+p.g[q[0]]+'</b>'+(p.e&&p.e[q[0]]?'('+(p.e[q[0]]==='up'?'위일 수도':'아래일 수도')+')':'')}).join(' · ')+'</p></section>':'<p class="muted">등급은 공유되지 않았어요.</p>')+
  '<ul class="vlist">'+list.map(function(x){return verdictCard(x,s,ov.map[x.i],!p.g)}).join('')+'</ul><section><h2>주말 일정</h2>'+timelineHTML(list,ov)+'</section>'+kidnapBox()+
  '<p class="cta noprint"><button class="btn" type="button" id="printBtn">인쇄(A4)</button><a class="btn" href="./">내 결정표 만들기</a></p>';
  view.innerHTML=h;
}
function aboutView(){
  pageTitle('기준·출처');tabs(true);setTab('');
  var h='<h1>기준·출처</h1>'+DISC+'<p>샘플 대학 8곳의 수능최저·고사일·입실 시각을 '+DATA.basis+'에 각 대학 2027학년도 수시 모집요강 원문(입학처 PDF)과 다시 대조했어요. 확인하지 못한 값은 ‘확인 필요’로 두었어요.</p>'+
  '<p class="legend">'+badge('ok')+' 요강 원문에 그대로 있음 '+badge('derived')+' 요강 규정(예: 시작 30분 전)으로 계산 '+badge('partial')+' 요강 사본·입학처 공지 보도로 확인 '+badge('check')+' 확인 필요</p>';
  h+=DATA.rules.map(function(r){return'<section class="card src"><h2>'+esc(r.univ)+' <small>'+esc(r.track)+'</small></h2><ul class="vlist2">'+
    r.variants.map(function(v){return'<li><h3>'+esc(v.unit)+'</h3><p class="rule">'+esc(R.describe(v.rule))+' '+badge(v.check.rule)+(v.check.rounding?' <span class="nw">소수 처리 '+badge(v.check.rounding)+'</span>':'')+'</p>'+v.exams.map(function(e){return'<p class="ex">'+examLine(e,v.check)+'</p>'}).join('')+(v.memo?'<p class="memo">'+esc(v.memo)+'</p>':'')+'</li>'}).join('')+'</ul><p><a href="'+esc(r.source)+'" target="_blank" rel="noopener">'+esc(r.sourceLabel)+'</a> · 기준일 '+DATA.basis+'</p></section>'}).join('');
  h+=kidnapBox()+'<section class="card"><h2>계산 방식</h2><ul><li>경계 과목은 입력 등급과 한 등급 위(또는 아래)를 모두 넣어 모든 조합(최대 64가지)을 계산해요. 모두 통과면 충족, 모두 실패면 미충족, 섞이면 모름.</li><li>한국사 기준을 먼저 보고, 탐구 값(상위 1과목/2과목 평균/소수 처리)을 정한 뒤 필수 영역을 넣고 가장 작은 합을 찾아요.</li><li>합격 가능성이나 등급 구분 점수는 계산하지 않아요.</li></ul></section>'+
  '<section class="card"><h2>참고한 자료</h2><ul class="links"><li><a href="https://suneung.re.kr/main.do?s=suneung" target="_blank" rel="noopener">한국교육과정평가원 수능 주요 일정</a></li><li><a href="https://ipsihub.thispost.co.kr/nonsul/" target="_blank" rel="noopener">입시허브 2027 논술 고사일·수능최저(2차 자료, 대조용)</a></li><li><a href="https://www.kyobit.com/news/articleView.html?idxno=6348" target="_blank" rel="noopener">교육을 비추다: 숙명여대 2027 논술 일정</a></li></ul><p>최종 기준은 각 대학 2027학년도 모집요강이에요.</p></section>';
  view.innerHTML=h;
}
/* ---------- 라우터 ---------- */
function route(){if(!DATA)return;
  var h=location.hash.replace(/^#\/?/,'');SHARED=null;
  if(h.indexOf('s=')===0){sharedView(h.slice(2));return}
  if(h==='sample'){SAMPLE=true;sampleState=sampleState||sample();h='table'}
  if(h==='start'){SAMPLE=false;location.hash=state.cards.length?'#/table':'#/cards';return}
  var f={'':home,cards:cardsView,add:addView,grades:gradesView,table:tableView,plan:planView,share:shareView,about:aboutView}[h.split('/')[0]];
  (f||home)();
  if(document.activeElement&&document.activeElement!==document.body&&!view.contains(document.activeElement))view.focus({preventScroll:true});
  window.scrollTo(0,0);
}
document.addEventListener('click',function(e){var t=e.target.closest('button,a');if(!t)return;
  if(t.id==='sampleBtn'){SAMPLE=true;sampleState=sample();location.hash='#/table';return}
  if(t.id==='finalBtn'&&!t.disabled){state.mode=state.mode==='final'?'estimate':'final';save();toast(state.mode==='final'?'실채점 모드로 바꿨어요':'가채점 모드로 바꿨어요');home();return}
  if(t.dataset.del!=null){var s=cur();var d=resolve(s.cards[+t.dataset.del]);if(confirm((d?d.univ:'카드')+' 카드를 지울까요?')){s.cards.splice(+t.dataset.del,1);save();cardsView();toast('지웠어요')}return}
  if(t.dataset.step){var s2=cur(),k=t.dataset.step;s2.grades[k]=Math.min(9,Math.max(1,s2.grades[k]+(+t.dataset.d)));save();document.getElementById('g-'+k).textContent=s2.grades[k]+'등급';return}
  if(t.id==='printBtn'){window.print();return}
  if(t.id==='mk'){var inc=document.getElementById('incS').checked;encode(payload(inc)).then(function(code){var u=location.href.split('#')[0]+'#s='+code;var lk=document.getElementById('lk');lk.hidden=false;lk.dataset.url=u;document.getElementById('lku').value=u;toast('링크를 만들었어요')});return}
  if(t.id==='cp'){var u2=document.getElementById('lku').value;(navigator.clipboard?navigator.clipboard.writeText(u2):Promise.reject()).then(function(){toast('복사했어요')},function(){document.getElementById('lku').select();toast('길게 눌러 복사하세요')});return}
});
document.addEventListener('change',function(e){var t=e.target,s=cur();
  if(t.dataset.variant!=null){s.cards[+t.dataset.variant].variant=t.value;save();cardsView();toast('모집단위를 바꿨어요');return}
  if(t.name&&t.name.indexOf('e-')===0){var k=t.name.slice(2);if(t.value)s.edge[k]=t.value;else delete s.edge[k];save();return}
  if(t.dataset.kind){s.kinds[t.dataset.kind]=t.value;save();return}
  if(t.dataset.dec!=null){s.cards[+t.dataset.dec].decision=t.value;save();toast(DEC[t.value]+'(으)로 정했어요');return}
  if(t.id==='kid'){s.kidnapCheck=t.checked;save();tableView();document.getElementById('kid').focus();return}
  if(t.id==='incS'){document.getElementById('sw').hidden=!t.checked;document.getElementById('lk').hidden=true;return}
  if(t.dataset.memo!=null){s.cards[+t.dataset.memo].memo=t.value.slice(0,60);save();toast('메모를 저장했어요');return}
});
window.addEventListener('hashchange',route);
fetch('data/rules-2027.json').then(function(r){return r.json()}).then(function(d){DATA=d;route()}).catch(function(){view.innerHTML='<h1>'+APP+'</h1><p class="warn" role="alert">기준 데이터를 불러오지 못했어요. 새로고침해 주세요.</p>'});
if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
window.__SBN={pageTitle:pageTitle,encode:encode,decode:decode};
})();
