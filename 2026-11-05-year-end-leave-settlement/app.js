/* 연말 연차 정산표 — 앱 (외부 요청 0, localStorage 'leave-settlement:v1') */
(function(){
'use strict';
const C=window.LS,R=C.RULES,APP=R.appName,KEY='leave-settlement:v1';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>window.__TODAY||C.todayKST();
function pageTitle(h){return h&&h!==APP?h+' — '+APP:APP}
window.pageTitle=pageTitle;
function blank(){return {settings:{year:+today().slice(0,4)||2026,deadline:'',basis:'fiscal',monthlyHours:209,dailyHours:8},
  inputs:{remainingDays:null,monthlyWage:null,hireDate:'',leaveExpireDate:'',resignDate:'',underOneYear:false,maybeUnder5:false,fixedTerm:false,myName:''},
  promotion:{q1:'',q2:'',q3:'',q4:'',q5:'',verdict:'needCheck'},dates:[],board:{lane:'',checks:{}}}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.settings&&s.inputs)return Object.assign(blank(),s)}catch(e){}return null}
let S=load()||blank();
function save(){S.settings.deadline=C.deadlineOf(S.settings,S.inputs);S.promotion.verdict=C.verdict(S.promotion);localStorage.setItem(KEY,JSON.stringify(S))}
const started=()=>!!localStorage.getItem(KEY);
const uid=p=>p+'_'+Math.random().toString(36).slice(2,8);
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)}
function src(k){const s=C.SRC[k];return s?`<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${esc(s.t)}</a>`:''}
const TAGOK='<span class="tag ok">원문 확인</span>',TAGCK='<span class="tag">확인 필요</span>';
const DISC=`<p class="disc" data-disc>이 앱의 신호등은 공개된 법령·보도·행정해석을 바탕으로 한 <b>점검 힌트</b>이며, 개별 사안의 법적 효력을 단정하지 않습니다. <b>법률 자문이 아니에요.</b> 금액은 세전 참고값이고 회사 급여 규정·통상임금 범위에 따라 달라질 수 있어요. 최종 판단은 관할 지방고용노동관서(☎1350)·노무사 확인. 기준일 ${R.asOf}. <a href="#/guide">출처 보기</a> · <a href="privacy.html">개인정보 안내</a></p>`;
const PII_WARN='<p class="notice">이 내용에는 <b>월급(통상임금)·잔여 연차·회사 촉진 내용</b> 같은 개인정보가 들어 있어요. 회사 단체방·공개 게시판에 올리지 말고, 받는 사람을 확인한 뒤 보내세요. 보관이 끝나면 지워 주세요.</p>';
function openDlg(html,onSubmit){const d=$('#dlg'),f=$('#dlg-f');f.innerHTML=html;const prev=document.activeElement;
  return new Promise(res=>{const done=v=>{d.close();res(v);if(prev&&prev.focus&&document.contains(prev))prev.focus()};
    f.onsubmit=ev=>{ev.preventDefault();const b=ev.submitter;const v=b&&b.value;if(v==='cancel')return done(null);done(onSubmit?onSubmit(f,v):v||'ok')};
    d.oncancel=ev=>{ev.preventDefault();done(null)};d.showModal();const fi=f.querySelector('[autofocus]')||f.querySelector('input,select,textarea,button');fi&&fi.focus()})}
function ask(title,body,ok='확인',danger){return openDlg(`<h2 id="dlg-h">${esc(title)}</h2><div>${body}</div><div class="row" style="margin-top:14px"><button class="btn ghost grow" value="cancel">취소</button><button class="btn ${danger?'danger':''} grow" value="ok" id="dlg-ok">${esc(ok)}</button></div>`).then(v=>v==='ok')}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.hidden=true;a.textContent=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
async function copy(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch(_){}ta.remove();return ok}}
function sample(){const s=blank();s.sample=true;Object.assign(s.settings,{year:2026,basis:'fiscal'});
  Object.assign(s.inputs,{remainingDays:5,monthlyWage:3000000,hireDate:'2023-03-02'});
  Object.assign(s.promotion,{q1:'yes',q2:'no',q3:'yes',q4:'unknown',q5:''});
  s.dates=[{id:'d1',date:'2026-12-15',note:'2차 지정(샘플)',status:'planned'},{id:'d2',date:'2026-12-16',note:'2차 지정(샘플)',status:'planned'},{id:'d3',date:'2026-12-17',note:'2차 지정(샘플)',status:'planned'}];
  s.board.lane='checking';return s}
const ctx=()=>{const st=S.settings,i=S.inputs,t=today(),dl=C.deadlineOf(st,i);return {st,i,t,dl,dd:C.daysBetween(t,dl),r:C.calc(i.monthlyWage,i.remainingDays,st.monthlyHours,st.dailyHours),v:C.verdict(S.promotion)}};
function ddText(dd){return dd>0?'D-'+dd:dd===0?'D-DAY':'마감 지남'}
function vBadge(v){const x=C.VERDICT[v];return `<span class="vb ${x.cls}" id="verdict">${x.label}</span>`}
function special(i,t){const u1=i.underOneYear||C.underOneYear(i.hireDate,t);let h='';
  if(u1){const s=C.scheduleUnder1(i.hireDate);h+=`<div class="notice" data-sp="u1"><b>1년 미만 근속</b> — 1개월 개근 시 1일씩 생기는 연차(최대 11일)는 사용기간이 ‘최초 1년의 근로가 끝날 때까지’이고, 촉진 일정이 따로 있어요(제61조②: 1년 끝나기 3개월 전 기준 10일 이내 촉구 → 1개월 전까지 지정 통보, 촉구 뒤 생긴 휴가는 1개월 전 기준 5일 이내 → 10일 전까지).${s?` 입사일 기준 예상: 최초 1년 끝 <span class="num">${s.end}</span>, 1차 <span class="num">${s.first.from}~${s.first.to}</span>, 2차 <span class="num">${s.second.by}</span>까지.`:''} 회계연도 일정과 다르니 회사 규정·관할 고용노동관서(☎1350)로 확인하세요. ${TAGOK}<br><span class="src">${src('law6061')}</span></div>`}
  if(i.fixedTerm)h+=`<div class="notice" data-sp="ft"><b>기간제</b> — 계약 기간이 1년 미만이면 촉진 적용이 제한된다는 해설이 있지만, 이 앱은 단정하지 않아요. 계약 기간·갱신 여부에 따라 달라지니 <b>회사 규정·관할 고용노동관서(☎1350) 확인</b>이 필요해요. ${TAGCK}<br><span class="src">${src('beone')}</span></div>`;
  if(i.maybeUnder5)h+=`<div class="notice" data-sp="u5"><b>상시 5인 미만 의심</b> — 상시 5인 미만 사업장은 연차 유급휴가 규정 적용이 다를 수 있어요. 이 앱의 금액·신호등이 그대로 맞지 않을 수 있으니 먼저 확인하세요. ${TAGCK}</div>`;
  if(i.resignDate)h+=`<div class="notice" data-sp="rs"><b>연말 전 퇴사 예정(${esc(i.resignDate)})</b> — 사용기간 만료 전 퇴직 시 남은 연차 정산이 문제되는 경우가 많아요. 퇴사 전 남은 일수를 회사와 확인하세요. ${TAGCK}</div>`;
  return h}
const V={};
V.home=()=>{const {i,t,dl,dd,r,v,st}=ctx();const roll=C.yearRolled(st,t);
  const top=`<section class="card"><div class="mu sm">올해 연차 사용기간 마감 <span class="num">${esc(C.fmtK(dl))}</span></div><div class="big" id="dday">${ddText(dd)}</div>
  ${roll?`<p class="notice" id="roll">${st.year}년 사용기간이 끝났어요. 새해 기준으로 바꿀까요? <button class="btn sm" id="nextyear">${st.year+1}년으로 넘기기</button></p>`:''}</section>`;
  if(!started())return {h:APP,html:`<h1>${APP}</h1>${top}
  <section class="card"><h2>남은 연차 × 월급 → 수당 얼마 · 촉진 유효? · 12/31 전에 할 일</h2><p>가입 없이 5분. 남은 연차와 월 통상임금만 넣으면 수당 금액(세전 참고), 사용촉진 점검 신호등, 지정일 할 일을 한 장으로 정리해요.</p>
  <div class="row"><a class="btn grow" href="#/calc" id="start">내 연차로 시작</a><button class="btn ghost grow" id="sample">샘플로 둘러보기</button></div>
  <p class="info" style="margin-top:12px">🔒 월급·연차 정보는 이 기기 브라우저에만 저장돼요. 서버로 보내지 않아요.</p></section>
  <section class="card"><h2>더 읽기</h2><p class="sm"><a href="leave-pay-calculator/">미사용 연차수당 계산법</a> · <a href="leave-promotion-check/">연차 사용촉진 유효 점검</a> · <a href="designated-day-record/">지정일 업무지시 기록법</a></p></section>${DISC}`,
  after(){$('#sample').onclick=()=>{S=sample();save();toast('샘플을 불러왔어요');render()};$('#start').onclick=()=>{save()};nyBind()}};
  return {h:APP,html:`<h1>${APP}</h1>${S.sample?'<p class="notice">샘플로 보고 있어요. 내 값으로 바꾸려면 <a href="#/calc">계산</a>에서 고치거나 <a href="#/settings">설정 → 전체 삭제</a> 하세요.</p>':''}${top}
  <section class="card"><h2>오늘 기준 요약</h2>
  <div class="kv"><span>잔여 연차</span><b id="h-days">${i.remainingDays==null?'-':i.remainingDays+'일'}</b></div>
  <div class="kv"><span>미사용수당(세전 참고)</span><b id="h-pay">${r?C.won(r.raw):'-'}</b></div>
  <div class="kv"><span>사용촉진 점검 힌트</span><b>${vBadge(v)}</b></div>
  <div class="row" style="margin-top:10px"><a class="btn grow" href="#/calc">이어서 계산</a><a class="btn ghost grow" href="#/result">결과 한 장</a></div></section>
  ${special(i,t)}
  <section class="card"><h2>다가오는 지정일</h2>${upcoming(3)}<p class="sm"><a href="#/cal">날짜 관리</a></p></section>
  <section class="card"><p class="sm"><a href="leave-pay-calculator/">미사용 연차수당 계산법</a> · <a href="leave-promotion-check/">사용촉진 유효 점검</a> · <a href="designated-day-record/">지정일 업무지시 기록법</a> · <a href="#/guide">가이드·출처</a></p></section>${DISC}`,after(){nyBind()}}};
function nyBind(){const b=$('#nextyear');if(b)b.onclick=()=>{S.settings.year+=1;S.dates=S.dates.filter(d=>d.date>S.settings.year-1+'-12-31');save();toast(S.settings.year+'년 기준으로 넘겼어요');render()}}
function upcoming(n){const t=today();const up=S.dates.filter(d=>C.parse(d.date)>=C.parse(t)).sort((a,b)=>a.date<b.date?-1:1).slice(0,n);
  return up.length?`<ul class="dl">${up.map(d=>`<li><b class="num">${esc(C.fmtK(d.date))}</b> <span class="num mu">D-${C.daysBetween(t,d.date)}</span> <span class="sm">${esc(d.note||'')}</span></li>`).join('')}</ul>`:'<p class="mu sm">아직 없어요.</p>'}
V.calc=()=>{const {st,i}=ctx();const seg=(n,val,lab)=>`<button type="button" data-basis="${val}" aria-pressed="${st.basis===val}">${lab}</button>`;
  return {h:'수당 계산',html:`<h1>수당 계산</h1>
  <section class="card" id="paycard" aria-live="polite"></section>
  <form id="cf" novalidate class="card">
  <label for="c-days">잔여 연차 일수 (0.5일 단위)</label><input id="c-days" inputmode="decimal" type="number" step="0.5" min="0" max="400" value="${i.remainingDays??''}" aria-describedby="e-days">
  <label for="c-wage">월 통상임금 (원, 세전)</label><input id="c-wage" inputmode="numeric" type="number" min="0" step="1" value="${i.monthlyWage??''}" aria-describedby="h-wage e-wage">
  <p class="xs mu" id="h-wage">기본급 + 매달 고정으로 받는 수당. 확실치 않으면 급여명세서 합계로 시작하세요. 실수령액이 아니에요.</p>
  <div class="row"><div class="grow"><label for="c-mh">월 소정근로시간</label><input id="c-mh" type="number" inputmode="decimal" min="1" max="744" value="${st.monthlyHours}"></div><div class="grow"><label for="c-dh">1일 소정근로시간</label><input id="c-dh" type="number" inputmode="decimal" step="0.5" min="0.5" max="24" value="${st.dailyHours}"></div></div>
  <p class="xs mu">주 40시간이면 보통 월 209시간(주휴 포함). 취업규칙에 정한 산정시간이 있으면 그 값을 넣으세요.</p>
  <p class="err" id="e-days" role="alert"></p><p class="err" id="e-wage" role="alert"></p>
  <fieldset><legend>연차 기준</legend><div class="seg" role="group" aria-label="연차 기준">${seg('b','fiscal','회계연도')}${seg('b','hire','입사일 기준')}${seg('b','unknown','잘 모름')}</div></fieldset>
  <div id="hirebox" ${st.basis==='hire'?'':'hidden'}><label for="c-exp">내 연차 사용기간 마지막 날</label><input id="c-exp" type="date" value="${esc(i.leaveExpireDate)}"></div>
  <label for="c-hire">입사일 (선택, 1년 미만 확인용)</label><input id="c-hire" type="date" value="${esc(i.hireDate)}">
  <fieldset><legend>해당하면 켜세요</legend>
  <label class="chk"><input type="checkbox" id="t-u1" ${i.underOneYear?'checked':''}> 1년 미만 근속</label>
  <label class="chk"><input type="checkbox" id="t-ft" ${i.fixedTerm?'checked':''}> 기간제(계약직)</label>
  <label class="chk"><input type="checkbox" id="t-u5" ${i.maybeUnder5?'checked':''}> 상시 5인 미만 사업장일 수도</label></fieldset>
  <label for="c-rs">연말 전 퇴사 예정일 (선택)</label><input id="c-rs" type="date" value="${esc(i.resignDate)}">
  </form><div id="sp"></div>${DISC}`,
  after(){const f=$('#cf');const upd=()=>{const num=id=>{const v=$(id).value.trim();return v===''?null:+v};
      const d=num('#c-days'),w=num('#c-wage'),mh=num('#c-mh'),dh=num('#c-dh');let ok=true;
      const err=(id,inp,m)=>{$(id).textContent=m;$(inp).setAttribute('aria-invalid',m?'true':'false');if(m)ok=false};
      err('#e-days','#c-days',d!=null&&!(d>=0&&d<=400&&C.halfStep(d))?'잔여 일수는 0 이상, 0.5일 단위로 입력해 주세요.':'');
      err('#e-wage','#c-wage',w!=null&&!(w>=0&&w<=1e10)?'월 통상임금은 0 이상의 숫자로 입력해 주세요.':'');
      if(d==null||ok)S.inputs.remainingDays=d;if(w==null||ok)S.inputs.monthlyWage=w;
      if(mh>=1&&mh<=744)S.settings.monthlyHours=mh;if(dh>=0.5&&dh<=24)S.settings.dailyHours=dh;
      Object.assign(S.inputs,{leaveExpireDate:$('#c-exp').value,hireDate:$('#c-hire').value,resignDate:$('#c-rs').value,underOneYear:$('#t-u1').checked,fixedTerm:$('#t-ft').checked,maybeUnder5:$('#t-u5').checked});
      save();payCard();$('#sp').innerHTML=special(S.inputs,today())};
    f.addEventListener('input',upd);f.addEventListener('change',upd);f.onsubmit=e=>e.preventDefault();
    $$('[data-basis]').forEach(b=>b.onclick=()=>{S.settings.basis=b.dataset.basis;$$('[data-basis]').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#hirebox').hidden=S.settings.basis!=='hire';upd()});
    payCard();$('#sp').innerHTML=special(S.inputs,today())}}};
function payCard(){const {st,i,r,dl,dd}=ctx();const el=$('#paycard');if(!el)return;
  el.innerHTML=r?`<h2>미사용 연차수당 (세전 참고)</h2><div class="big pay" id="pay">${C.won(r.raw)}</div>
  <div class="kv"><span>통상시급 <span class="xs mu">월 ÷ ${st.monthlyHours}시간</span></span><b id="hourly">${C.won1(r.hourly)}</b></div>
  <div class="kv"><span>1일 통상임금 <span class="xs mu">× ${st.dailyHours}시간</span></span><b id="daily">${C.won1(r.daily)}</b></div>
  <div class="kv"><span>잔여 일수</span><b>× ${i.remainingDays}일</b></div>
  <p class="xs mu" id="rounding">계산식: ${C.won(i.monthlyWage)} ÷ ${st.monthlyHours} × ${st.dailyHours} × ${i.remainingDays} = <span class="num">${(Math.round(r.raw*100)/100).toLocaleString('ko-KR')}</span>원 → 마지막에 한 번만 원 단위 반올림. 시급·1일 금액을 먼저 반올림하면 몇 원 달라질 수 있어요.</p>
  ${st.basis==='unknown'?'<p class="notice sm">연차 기준을 ‘잘 모름’으로 골랐어요. 마감일은 12월 31일로 가정했어요. 회사에 기준(회계연도/입사일)을 확인하세요.</p>':''}
  <p class="sm">마감 <span class="num">${dl}</span> · <b class="num">${ddText(dd)}</b>. 적법한 사용촉진 후 쓰지 않으면 보상 의무가 없을 수 있어요 → <a href="#/check">촉진 점검</a></p>
  <p class="src">${TAGOK} ${src('dec6')} · ${src('law6061')} · ${src('moel1350')}</p>`:`<h2>미사용 연차수당</h2><p class="mu">잔여 일수와 월 통상임금을 넣으면 바로 계산해요.</p>`}
const QS=[
 {k:'q1',q:'7월 1일~10일 무렵 <b>나에게</b> 남은 일수를 적은 서면(전자결재·개인 메일 포함) 촉구를 받았나요?',why:'제61조①1호: 사용기간 끝나기 6개월 전을 기준으로 10일 이내에 근로자별 미사용 일수를 알리고, 사용 시기를 정해 통보하도록 서면 촉구해야 해요(회계연도면 7/1~7/10).',s:'law6061',o:['yes','no','unknown']},
 {k:'q2',q:'그때 10일 안에 사용할 날을 정해 회사에 답했나요?',why:'제61조①2호: 촉구받은 때부터 10일 이내에 근로자가 사용 시기를 통보하지 않으면 회사가 날짜를 정해요. 답했다면 내가 정한 날을 쓰는 흐름이에요.',s:'law6061',o:['yes','no','na','unknown']},
 {k:'q3',q:'10월 31일까지 <b>구체적 날짜</b>가 적힌 2차 서면 통보를 개인적으로 받았나요?',why:'제61조①2호: 사용기간 끝나기 2개월 전까지 회사가 사용 시기를 정해 서면으로 통보해야 해요(회계연도면 10/31).',s:'law6061',o:['yes','no','unknown']},
 {k:'q4',q:'통보가 단체 메일·단톡·게시판 공지뿐이었나요?',why:'단체 메일·게시판 공지는 개인별 서면 통보로 인정되지 않는다는 보도·해설이 있어요. 원문 행정해석은 확인 필요.',s:'maeil',o:['yes','no','unknown'],ck:1},
 {k:'q5',q:'지정일에 출근했거나 업무 지시(메신저·메일)를 받았나요? 또는 받을 것 같나요?',why:'회사가 지정일에 노무 수령 거부를 분명히 하지 않거나 업무를 시키면 자발적 미사용으로 보기 어렵다는 대법원 판결 해설이 있어요(사건번호·원문 확인 필요).',s:'yulchon',o:['yes','no','unknown'],ck:1}];
const OL={yes:'예',no:'아니오',na:'해당 없음',unknown:'모름'};
V.check=()=>{const {st,i,t}=ctx();const exp=C.deadlineOf(st,i),sc=C.schedule(exp);
  return {h:'촉진 점검',html:`<h1>사용촉진 점검</h1>${special(i,t)}
  <section class="card"><h2>${st.basis==='hire'?'내 사용기간':'회계연도'} 일정</h2>${sc?`<ol class="tl"><li><b>1차 서면 촉구</b> <span class="num">${sc.first.from} ~ ${sc.first.to}</span></li><li>근로자 답변 <span class="sm">촉구받고 10일 안</span></li><li><b>2차 지정 통보</b> <span class="num">${sc.second.by}</span>까지</li><li><b>사용기간 끝</b> <span class="num">${sc.expire}</span></li></ol>`:''}
  <p class="src">${TAGOK} ${src('law6061')}<br>회계연도 7/1~7/10·10/31 일정 안내: ${src('moelFiscal')}</p></section>
  <form id="qf" class="card"><h2>5문항</h2>${QS.map((x,n)=>`<fieldset class="q"><legend><span class="num">Q${n+1}.</span> ${x.q}</legend><div class="opts">${x.o.map(o=>`<label class="opt"><input type="radio" name="${x.k}" value="${o}" ${S.promotion[x.k]===o?'checked':''}> ${OL[o]}</label>`).join('')}</div>
   <details><summary>왜 묻나요?</summary><p class="sm">${x.why} ${x.ck?TAGCK:TAGOK}</p><p class="src">${src(x.s)}</p></details></fieldset>`).join('')}</form>
  <section class="card" id="vcard" aria-live="polite"></section>${DISC}`,
  after(){$('#qf').onchange=e=>{if(e.target.name){S.promotion[e.target.name]=e.target.value;save();vCard()}};vCard()}}};
function vCard(){const v=C.verdict(S.promotion),x=C.VERDICT[v];const el=$('#vcard');if(!el)return;
  const why=v==='invalidLikely'?'단체 공지만 있었거나, 1차 없이 2차만 있었거나, 지정일 업무 지시가 있었다고 답했어요.':v==='validLikely'?'1차·2차 개인별 서면이 있었고 지정일 업무 지시가 없다고 답했어요.':'모름·빈칸이 있거나 위 두 경우에 딱 맞지 않아요.';
  el.innerHTML=`<h2>점검 힌트</h2><div class="row">${vBadge(v)}<span class="sm">${x.sub}</span></div><p class="sm">${why}</p><p class="sm"><b>이 신호등은 점검 힌트예요.</b> 촉진의 법적 효력을 판정하지 않아요. 회사 서면 원문·날짜를 갖고 관할 지방고용노동관서(☎1350)·노무사에게 확인하세요.</p>
  <p class="sm"><a href="#/result">결정 보드·결과 한 장으로</a></p>`}
V.cal=()=>({h:'지정일 캘린더',html:`<h1>지정일 캘린더</h1>
  <form id="df" class="card" novalidate><h2>회사가 지정한 날 추가</h2><label for="d-date">날짜</label><input id="d-date" type="date" aria-describedby="e-d"><label for="d-note">메모 (선택)</label><input id="d-note" maxlength="40" placeholder="예: 2차 지정 통보">
  <p class="err" id="e-d" role="alert"></p><button class="btn full" id="d-add">추가</button></form>
  <section class="card"><h2>목록</h2><div id="dlist"></div><div class="row" style="margin-top:10px"><button class="btn grow" id="ics">캘린더에 넣기(.ics)</button></div></section>
  <section class="card"><h2>지정일 당일 체크리스트</h2><ul class="sm"><li>업무 지시 메시지·메일은 원문 그대로 캡처(보낸 사람·시각 보이게)</li><li>출근했다면 출입 기록·PC 로그온 시각 메모</li><li>상사에게 “오늘 지정 연차일인데 처리할까요?” 확인 기록 남기기</li><li>휴가 중 연락받은 직장인이 적지 않다는 설문 보도가 있어요 — ${src('yna')}</li></ul></section>${DISC}`,
  after(){const list=()=>{const t=today();const ds=[...S.dates].sort((a,b)=>a.date<b.date?-1:1);
      $('#dlist').innerHTML=ds.length?`<ul class="dl">${ds.map(d=>{const dd=C.daysBetween(t,d.date);return `<li class="drow"><div class="grow"><b class="num">${esc(C.fmtK(d.date))}</b> <span class="num ${dd<0?'mu':''}">${dd>0?'D-'+dd:dd===0?'오늘':'지남'}</span><div class="xs mu">${esc(d.note||'')}</div></div>
      <label class="sr" for="st-${d.id}">상태</label><select id="st-${d.id}" data-st="${d.id}" class="sel-sm">${[['planned','쓸 예정'],['used','쉬었음'],['worked','출근·업무지시'],['unknown','모름']].map(([k,l])=>`<option value="${k}" ${d.status===k?'selected':''}>${l}</option>`).join('')}</select>
      <button class="btn sm danger" data-del="${d.id}" aria-label="${esc(d.date)} 삭제">삭제</button></li>`}).join('')}</ul>`:'<p class="mu sm">아직 없어요.</p>';
      $$('[data-del]').forEach(b=>b.onclick=()=>{S.dates=S.dates.filter(x=>x.id!==b.dataset.del);save();list();toast('지웠어요')});
      $$('[data-st]').forEach(s=>s.onchange=()=>{const d=S.dates.find(x=>x.id===s.dataset.st);d.status=s.value;if(s.value==='worked'&&S.promotion.q5!=='yes'){S.promotion.q5='yes';toast('촉진 점검 Q5를 ‘예’로 바꿨어요')}save()})};
    $('#df').onsubmit=e=>{e.preventDefault();const v=$('#d-date').value;if(!v){$('#e-d').textContent='날짜를 골라 주세요.';$('#d-date').setAttribute('aria-invalid','true');$('#d-date').focus();return}
      if(S.dates.some(d=>d.date===v)){$('#e-d').textContent='이미 있는 날짜예요.';$('#d-date').focus();return}
      $('#e-d').textContent='';$('#d-date').removeAttribute('aria-invalid');S.dates.push({id:uid('d'),date:v,note:$('#d-note').value.trim(),status:'planned'});save();$('#d-date').value='';$('#d-note').value='';list();toast('추가했어요')};
    $('#ics').onclick=()=>{if(!S.dates.length){toast('먼저 날짜를 추가해 주세요');return}download('연차지정일.ics',C.ics(S.dates),'text/calendar');toast('.ics 파일을 내려받았어요')};list()}});
const LANES={use:{t:'쓸 예정',c:[['handover','인수인계 메모 남기기'],['autoreply','메일 자동응답 문구 켜기'],['saveMessages','휴가 중 지시 메시지 저장 준비'],['logonNote','출입 기록·PC 로그온 시각 메모']]},
 claim:{t:'수당 청구 검토',c:[['mailDraft','회사 확인 메일 초안 다듬기'],['payroll','급여 담당 면담 일정'],['call1350','☎1350 상담 메모']]},
 checking:{t:'확인 중',c:[['docPromo','촉진 메일·전자결재 원문 보관'],['docPay','급여명세서(통상임금 항목) 준비'],['docUse','연차 사용 내역 캡처']]}};
V.result=()=>{const {st,i,t,dl,dd,r,v}=ctx();const lane=S.board.lane;
  return {h:'결과 한 장',html:`<h1>결과 한 장</h1><p class="print-only">${APP} · ${t} 기준</p>
  <section class="card"><div class="kv"><span>마감</span><b>${dl} · ${ddText(dd)}</b></div><div class="kv"><span>잔여 연차</span><b>${i.remainingDays==null?'-':i.remainingDays+'일'}</b></div>
  <div class="kv"><span>1일 통상임금</span><b>${r?C.won1(r.daily):'-'}</b></div><div class="kv"><span>미사용수당(세전 참고)</span><b id="r-pay">${r?C.won(r.raw):'-'}</b></div><div class="kv"><span>촉진 점검 힌트</span><b>${vBadge(v)}</b></div>
  <h3>지정일</h3>${upcoming(10)}</section>${special(i,t)}
  <section class="card no-print-lanes"><h2>결정 보드</h2><div class="seg" role="group" aria-label="결정">${Object.entries(LANES).map(([k,x])=>`<button type="button" data-lane="${k}" aria-pressed="${lane===k}">${x.t}</button>`).join('')}</div>
  <div id="lanebox">${lane?LANES[lane].c.map(([k,l])=>`<label class="chk"><input type="checkbox" data-ck="${k}" ${S.board.checks[k]?'checked':''}> ${l}</label>`).join(''):'<p class="mu sm">하나를 고르면 할 일이 나와요.</p>'}</div></section>
  <section class="card"><h2>회사에 보낼 확인 메일 초안</h2><label for="m-name">내 이름 (선택, 이 기기에만 저장)</label><input id="m-name" value="${esc(i.myName)}" maxlength="20">
  <label for="mail">초안 (고쳐 써도 돼요)</label><textarea id="mail" rows="12">${esc(C.mailDraft(S,t))}</textarea><div class="row" style="margin-top:8px"><button class="btn grow" id="mcopy">초안 복사</button></div></section>
  <section class="card no-print"><h2>공유·인쇄</h2><label class="chk"><input type="checkbox" id="withMoney"> 월급·수당 금액도 포함 (기본은 빼요)</label>
  <div class="row"><button class="btn grow" id="share">공유 텍스트 복사</button><button class="btn ghost grow" id="print">인쇄</button></div></section>${DISC}`,
  after(){$$('[data-lane]').forEach(b=>b.onclick=()=>{S.board.lane=b.dataset.lane;save();render()});
    $$('[data-ck]').forEach(c=>c.onchange=()=>{S.board.checks[c.dataset.ck]=c.checked;save()});
    $('#m-name').oninput=e=>{S.inputs.myName=e.target.value.trim();save();$('#mail').value=C.mailDraft(S,today())};
    $('#mcopy').onclick=()=>copy($('#mail').value).then(ok=>toast(ok?'초안을 복사했어요':'복사하지 못했어요'));
    $('#share').onclick=()=>{const m=$('#withMoney').checked;const go=()=>copy(C.shareText(S,today(),m)).then(ok=>toast(ok?'공유 텍스트를 복사했어요':'복사하지 못했어요'));
      ask('공유 전에 확인',PII_WARN+(m?'<p><b>월급·수당 금액이 포함돼요.</b></p>':'<p>월급·수당 금액은 빼고 복사해요.</p>'),'복사').then(ok=>{if(ok)go()})};
    $('#print').onclick=()=>ask('인쇄 전에 확인',PII_WARN,'인쇄').then(ok=>{if(ok)window.print()})}}};
V.guide=()=>({h:'가이드·출처',html:`<h1>가이드·출처</h1>
  <section class="card"><h2>원문으로 확인한 것</h2><ul class="sm">
  <li>제60조⑤ 휴가 기간에는 취업규칙 등에서 정하는 통상임금 또는 평균임금 지급 · ⑦ 1년간 행사하지 않으면 소멸(사용자 귀책사유는 예외) ${TAGOK}<br>${src('law6061')}</li>
  <li>제61조① 1차: 사용기간 끝나기 6개월 전 기준 10일 이내 근로자별 미사용 일수 고지·서면 촉구 / 2차: 촉구 후 10일 내 미통보 시 끝나기 2개월 전까지 회사가 사용 시기를 정해 서면 통보 ${TAGOK}<br>${src('law6061')}</li>
  <li>제61조② 1년 미만: 3개월 전 기준 10일 이내 촉구 → 1개월 전까지 통보(후발분 1개월 전 기준 5일 이내 → 10일 전까지) ${TAGOK}<br>${src('law6061')}</li>
  <li>통상시급 = 월급 ÷ 월 통상임금 산정 기준시간, 일급 = 시간급 × 1일 소정근로시간 ${TAGOK}<br>${src('dec6')}</li>
  <li>1일 연차수당 = 1일 소정근로시간 × 통상시급(월 ÷ 209시간 예시) ${TAGOK}<br>${src('moel1350')}</li></ul></section>
  <section class="card"><h2>확인 필요</h2><ul class="sm">
  <li>단체 메일·게시판 공지는 서면 통보로 보기 어려움, 평균 잔여 3.5일 — 보도 ${TAGCK}<br>${src('maeil')}</li>
  <li>지정일 업무 지시 시 보상 의무 유지 — 대법원 판결 해설(사건번호는 스펙에 2020다279283·2019다279283 두 가지로 적혀 있어 원문 확인 전까지 표기하지 않아요) ${TAGCK}<br>${src('yulchon')}</li>
  <li>회계연도 7/1~7/10·10/31 일정 — 고용노동부 빠른상담 ${TAGCK}<br>${src('moelFiscal')}</li>
  <li>기간제 1년 미만 촉진 적용 제한 — 해설 ${TAGCK}<br>${src('beone')}</li>
  <li>상시 5인 미만 사업장 적용 범위, 미사용수당 청구 시효(보도상 3년) ${TAGCK}<br>${src('maeil')}</li>
  <li><b>개정 동향</b>: 2026-10-31 개정안(통상임금 산정기간)은 국가법령정보센터·국회 의안정보에서 찾지 못했어요. 통상임금 정의 신설 의원안(2207859·2208070)은 소위 계류, 법률 제21784호(연차 시간 단위 분할 청구 등)는 2026-12-10·2027-06-10 시행 예정으로 비공식 추적 사이트에 나와요. 이 앱 계산식에는 반영하지 않았어요. ${TAGCK}<br>${src('lawtrack')}</li></ul></section>
  <section class="card"><h2>자주 묻는 것</h2><details><summary>단체 메일로 받았어요</summary><p class="sm">개인별 서면이 아닐 수 있다는 보도가 있어요. 메일 원문을 보관하고 확인하세요.</p></details>
  <details><summary>지정일에 일을 시켰어요</summary><p class="sm">지시 메시지·출입 기록을 남기세요. 수당이 남을 수 있다는 판결 해설이 있어요.</p></details>
  <details><summary>연말 전에 퇴사해요</summary><p class="sm">남은 연차 정산을 퇴사 전에 회사와 확인하세요.</p></details>
  <details><summary>입사 1년이 안 됐어요</summary><p class="sm">월 1일씩 생기는 연차는 촉진 일정이 달라요(제61조②).</p></details></section>
  <p class="sm"><a href="leave-pay-calculator/">미사용 연차수당 계산법</a> · <a href="leave-promotion-check/">사용촉진 유효 점검</a> · <a href="designated-day-record/">지정일 업무지시 기록법</a> · <a href="privacy.html">개인정보 안내</a></p>${DISC}`});
V.settings=()=>({h:'설정',html:`<h1>설정</h1>
  <form id="sf" class="card" novalidate><label for="s-y">기준 연도</label><input id="s-y" type="text" inputmode="numeric" value="${S.settings.year}" aria-describedby="e-s"><p class="err" id="e-s" role="alert"></p><button class="btn full">저장</button></form>
  <section class="card"><h2>백업·삭제</h2><p class="sm">저장 위치: 이 기기 브라우저(localStorage <code>${KEY}</code>)</p>
  <div class="row"><button class="btn grow" id="bk">JSON 백업</button><label class="btn ghost grow" for="rs">JSON 복원</label></div><input id="rs" type="file" accept="application/json,.json" class="sr">
  <div class="row" style="margin-top:8px"><button class="btn danger grow" id="wipe">전체 삭제</button></div></section>
  <p class="sm"><a href="#/guide">가이드·출처</a> · <a href="privacy.html">개인정보 안내</a></p>${DISC}`,
  after(){$('#sf').onsubmit=e=>{e.preventDefault();const y=+$('#s-y').value;if(!(Number.isInteger(y)&&y>=2020&&y<=2035)){$('#e-s').textContent='기준 연도는 2020~2035 사이로 입력해 주세요.';$('#s-y').setAttribute('aria-invalid','true');$('#s-y').focus();return}
    S.settings.year=y;save();toast('저장했어요');render()};
   $('#bk').onclick=()=>ask('JSON 백업',PII_WARN,'내려받기').then(ok=>{if(ok){download(`연차정산_백업_${today()}.json`,JSON.stringify(S,null,1),'application/json');toast('백업 파일을 내려받았어요')}});
   $('#rs').onchange=ev=>{const file=ev.target.files[0];if(!file)return;file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){toast('JSON 파일이 아니에요');return}
     if(!d||!d.settings||!d.inputs){toast('이 앱의 백업 파일이 아니에요');return}
     ask('복원','<p>현재 데이터를 백업 파일로 바꿀까요?</p>','복원').then(ok=>{if(ok){S=Object.assign(blank(),d);save();toast('복원했어요');render()}})})};
   $('#wipe').onclick=()=>ask('전체 삭제','<p>이 기기에 저장된 <b>월급·연차·지정일·체크</b>를 모두 지울까요? 되돌릴 수 없어요.</p>','모두 삭제',true).then(ok=>{if(ok){localStorage.removeItem(KEY);S=blank();toast('모두 지웠어요');location.hash='#/';render()}})}});
function render(){const path=location.hash.replace(/^#\/?/,'').split('?')[0];const key={'':'home',calc:'calc',check:'check',cal:'cal',result:'result',guide:'guide',settings:'settings'}[path]||'home';
  const v=V[key]();const m=$('#view');m.innerHTML=v.html;document.title=pageTitle(v.h);
  $$('#tabbar a').forEach(a=>{const k=a.getAttribute('href').replace('#/','');if(k===(key==='home'?'':key))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  v.after&&v.after();if(render.n++)m.focus({preventScroll:true});window.scrollTo(0,0)}
render.n=0;window.addEventListener('hashchange',render);
window.addEventListener('storage',e=>{if(e.key===KEY){S=load()||blank();render()}});
render();
window.runSelfTest=function(){const r=[],ok=(n,c)=>r.push({n,pass:!!c});
  const a=C.calc(3000000,3.5,209,8),b=C.calc(3000000,5,209,8);
  ok('3.5일 → 401,914원',a.payWon===401914);ok('raw 401913.87…',Math.floor(a.raw*100)===40191387);ok('5일 → 574,163원',b.payWon===574163);
  ok('1일 114,832.5…',Math.floor(a.daily*10)===1148325);ok('시급 14,354.07',Math.round(a.hourly*100)===1435407);
  ok('월 226시간·8 → 5일 530,973원',C.calc(3000000,5,226,8).payWon===530973);ok('0일 → 0원',C.calc(3000000,0).payWon===0);ok('음수 → null',C.calc(-1,1)===null);
  ok('신호등 단체만 → 무효 가능',C.verdict({q4:'yes'})==='invalidLikely');ok('1차 없이 2차 → 무효 가능',C.verdict({q1:'no',q3:'yes'})==='invalidLikely');
  ok('지정일 업무 → 무효 가능',C.verdict({q1:'yes',q3:'yes',q4:'no',q5:'yes'})==='invalidLikely');ok('모두 적법 → 유효 가능',C.verdict({q1:'yes',q3:'yes',q4:'no',q5:'no'})==='validLikely');
  ok('모름 → 확인 필요',C.verdict({q1:'yes',q3:'yes',q4:'no',q5:'unknown'})==='needCheck');
  const s=C.schedule('2026-12-31');ok('회계연도 1차 7/1~7/10',s.first.from==='2026-07-01'&&s.first.to==='2026-07-10');ok('2차 10/31',s.second.by==='2026-10-31');
  ok('D-56 (11/5→12/31)',C.daysBetween('2026-11-05','2026-12-31')===56);ok('연도 넘김 감지',C.yearRolled({year:2026,basis:'fiscal'},'2027-01-01'));
  ok('ICS VEVENT',/BEGIN:VEVENT[\s\S]*DTSTART;VALUE=DATE:20261215/.test(C.ics([{id:'x',date:'2026-12-15'}])));
  ok('공유 기본 금액 제외',!/원/.test(C.shareText(Object.assign(blank(),{inputs:Object.assign(blank().inputs,{remainingDays:3.5,monthlyWage:3000000})}),'2026-11-05',false).replace(/1350/,'').split('\n').slice(0,3).join('')));
  return {pass:r.filter(x=>x.pass).length,total:r.length,results:r}};
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
