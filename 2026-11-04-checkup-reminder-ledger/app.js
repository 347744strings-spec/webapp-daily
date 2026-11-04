/* 연말 검진 독려 장부 — 앱 (외부 요청 0, localStorage 'checkup-ledger:v1') */
(function(){
'use strict';
const C=window.CK, R=C.RULES, APP=R.appName, KEY='checkup-ledger:v1';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>window.__TODAY||C.todayKST();
const nowIso=()=>{const t=today();const d=new Date(Date.now()+9*3600e3).toISOString().slice(11,16);return t+'T'+d+':00+09:00'};
function pageTitle(h){return h&&h!==APP?h+' — '+APP:APP}
function blank(){return {settings:{company:'',manager:'',managerContact:'',year:2026,deadline:'2026-12-31',violationLevel:1},employees:[],logs:[]}}
let S=load();
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.settings&&Array.isArray(s.employees)&&Array.isArray(s.logs))return s}catch(e){}return blank()}
function save(){localStorage.setItem(KEY,JSON.stringify(S))}
const uid=p=>p+'_'+Math.random().toString(36).slice(2,8);
const Y=()=>+S.settings.year||2026;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2600)}
function srcLink(k){const s=C.SRC[k];return s?`<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${esc(s.t)}</a>`:''}
const DISC=`<p class="disc" data-disc>참고용 도구예요. <b>법률 자문이 아니에요.</b> 대상 판정·과태료 금액은 참고용이며, 실제 공단 대상자 조회와 관할 지방고용노동관서·국민건강보험공단 확인이 최종 기준이에요. 안내 횟수로 과태료가 면제된다는 기준은 법령에 없으며, 이 앱은 권장 흐름과 기록만 도와요. 기준일 ${R.asOf}. <a href="#/settings">출처 보기</a> · <a href="privacy.html">개인정보 안내</a></p>`;

/* 다이얼로그 */
function openDlg(html,onSubmit){const d=$('#dlg'),f=$('#dlg-f');f.innerHTML=html;const prev=document.activeElement;
  return new Promise(res=>{const done=v=>{d.close();res(v);if(prev&&prev.focus&&document.contains(prev))prev.focus()};
    f.onsubmit=ev=>{ev.preventDefault();const b=ev.submitter;const v=b&&b.value;if(v==='cancel')return done(null);done(onSubmit?onSubmit(f,v):v||'ok')};
    d.oncancel=ev=>{ev.preventDefault();done(null)};d.showModal();const fi=f.querySelector('[autofocus]')||f.querySelector('input,select,textarea,button');fi&&fi.focus()})}
function ask(title,body,ok='확인',danger){return openDlg(`<h2 id="dlg-h">${esc(title)}</h2><div>${body}</div><div class="row" style="margin-top:14px"><button class="btn ghost grow" value="cancel">취소</button><button class="btn ${danger?'danger':''} grow" value="ok" id="dlg-ok">${esc(ok)}</button></div>`).then(v=>v==='ok')}
const PII_WARN='<p class="notice">내보낸 파일에는 직원 이름·부서·연락처 같은 <b>개인정보</b>가 들어 있어요. 업무 목적 외로 공유하지 말고, 메신저 단체방이나 개인 클라우드에 올리지 마세요. 보관이 끝나면 지워 주세요.</p>';

/* 다운로드 */
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

/* 샘플 */
function sample(){const e=(o)=>Object.assign({id:uid('e'),dept:'',birthYear:'',hireDate:'',lastCheckup:'',nhisTarget:'',special:false,contact:'',status:'unbooked',bookedDate:'',doneDate:''},o);
  const E=[e({name:'김서윤',dept:'경영지원',jobType:'office',birthYear:1995,hireDate:'2022-03-02',lastCheckup:'2025-05-20',contact:'010-0000-0001'}),
    e({name:'박준호',dept:'개발',jobType:'office',birthYear:1990,hireDate:'2021-07-01',lastCheckup:'2024-10-11',status:'booked',bookedDate:'2026-11-02',contact:'junho@example.com'}),
    e({name:'이도현',dept:'창고',jobType:'nonoffice',birthYear:1988,hireDate:'2020-01-06',lastCheckup:'2025-11-28',contact:'010-0000-0003'}),
    e({name:'최민지',dept:'창고',jobType:'nonoffice',birthYear:1999,hireDate:'2023-04-03',lastCheckup:'2026-09-12'}),
    e({name:'정하늘',dept:'영업지원',jobType:'office',birthYear:1993,hireDate:'2019-09-02',nhisTarget:'Y',contact:'010-0000-0005'}),
    e({name:'한지우',dept:'디자인',jobType:'office',hireDate:'2024-02-01'}),
    e({name:'오세진',dept:'물류',jobType:'nonoffice',birthYear:2001,hireDate:'2026-08-01'}),
    e({name:'윤태경',dept:'도장',jobType:'nonoffice',birthYear:1985,hireDate:'2018-05-14',special:true})];
  const s=blank();Object.assign(s.settings,{company:'(샘플) 한빛물류',manager:'김서윤',managerContact:'02-000-0000'});s.employees=E;s.sample=true;
  s.logs=[{id:uid('l'),employeeId:E[2].id,stage:'notice1',channel:'sms',at:'2026-10-20T10:12:00+09:00',received:false,memo:'(샘플)'},
          {id:uid('l'),employeeId:E[1].id,stage:'notice1',channel:'email',at:'2026-10-20T10:15:00+09:00',received:true,memo:'(샘플) 예약했다고 회신'}];
  return s}

/* 공통 */
function J(e){return C.judge(e,Y())}
function badge(e){const j=J(e);return `<span class="badge b-${j.code}">${esc(j.badge)}</span>`}
const ST={unbooked:'미예약',booked:'예약함',done:'완료',excluded:'제외'};
function empById(id){return S.employees.find(e=>e.id===id)}
function lastLog(id){return S.logs.filter(l=>l.employeeId===id).sort((a,b)=>a.at<b.at?1:-1)[0]}
function flowHtml(id){const f=C.flowFor(id,S.logs);const s=(ok,t)=>`<span class="${ok?'y':'x'}">${ok?'✓':'·'} ${t}</span>`;return `<div class="flow" aria-label="권장 흐름 기록">${s(f.notice1,'개별 안내')}${s(f.renotice,'재안내')}${s(f.received,'수신 확인')}</div>`}
function fmtAt(at){return at.slice(5,10).replace('-','.')+' '+at.slice(11,16)}

/* 화면 */
const V={};
V.home=()=>{
  const t=today(),dl=S.settings.deadline||Y()+'-12-31',dd=C.daysBetween(t,dl),bd=C.businessDays(t,dl);
  if(!S.employees.length) return {h:APP,html:`
  <h1>${APP}</h1>
  <section class="card"><div class="dday"><div><div class="mu sm">${Y()}년 일반건강진단 마감 ${esc(C.fmtDeadline(dl))}</div><div class="big" id="dday">${dd>=0?'D-'+dd:'마감 지남'}</div><div class="sm mu">남은 평일 <b class="num" id="bdays">${bd}일</b> (주말·12/25 제외)</div></div></div></section>
  <section class="card"><h2>명단만 붙여 넣으면 5분</h2><p>누가 올해 대상인지, 아직 안 받은 사람에게 무엇을 보낼지, 보냈다는 기록까지 한 장으로 남겨요.</p>
  <div class="row"><a class="btn grow" href="#/import">명단 붙여 넣기</a><button class="btn ghost grow" id="sample">샘플로 둘러보기</button></div>
  <p class="info" style="margin-top:12px">🔒 명단은 이 기기 브라우저에만 저장돼요. 서버로 보내지 않아요.</p></section>
  <section class="card"><h2>알아 두면 좋은 기준</h2><ul class="sm"><li>사무직 2년에 1회 이상, 그 밖의 근로자 1년에 1회 이상 <span class="tag ok">확인</span><br><span class="src">${srcLink('rule197')}</span></li>
  <li>사업주 과태료: 대상 근로자 1명당 1차 10만원·2차 20만원·3차 이상 30만원 <span class="tag ok">확인</span><br><span class="src">${srcLink('b35')}</span></li></ul>
  <p class="sm">더 읽기: <a href="checkup-penalty-guide/">미수검 과태료 안내</a> · <a href="reminder-message-flow/">독려 문자 권장 흐름</a> · <a href="january-carryover/">1월 이어가기</a></p></section>${DISC}`,
  after(){$('#sample').onclick=()=>{S=sample();save();toast('샘플 직원 8명을 불러왔어요');render()}}};
  const T=S.employees.filter(e=>C.isTarget(e,Y())), done=T.filter(e=>C.effStatus(e,Y())==='done').length, n=T.length, pct=n?Math.round(done/n*100):0;
  const w=C.weekTasks(S.employees,S.logs,Y(),t);
  const ring=`<svg class="ring" viewBox="0 0 36 36" role="img" aria-label="완료 ${done}명 / 대상 ${n}명"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" stroke-width="4"/><circle cx="18" cy="18" r="15.9" fill="none" stroke="#0F766E" stroke-width="4" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="25" transform="rotate(0 18 18)"/><text x="18" y="21" text-anchor="middle" font-size="9" font-weight="700" fill="#1F2937">${pct}%</text></svg>`;
  const task=(arr,label,act,href)=>`<div class="task"><div class="grow"><b class="num">${arr.length}명</b> ${label}${arr.length?`<div class="xs mu">${arr.slice(0,4).map(e=>esc(e.name)).join(', ')}${arr.length>4?' 외':''}</div>`:''}</div>${arr.length?`<a class="btn sm" href="${href}">${act}</a>`:'<span class="xs mu">없음</span>'}</div>`;
  const ids=a=>a.map(e=>e.id).join(',');
  return {h:APP,html:`<h1>${APP}</h1>
  ${S.sample?'<p class="notice">샘플 데이터로 보고 있어요. 실제 명단을 쓰려면 <a href="#/settings">설정 → 전체 삭제</a> 후 붙여 넣으세요.</p>':''}
  <section class="card"><div class="dday">${ring}<div class="grow"><div class="mu sm">${Y()}년 마감 ${esc(C.fmtDeadline(dl))}</div><div class="big" id="dday">${dd>=0?'D-'+dd:'마감 지남'}</div><div class="sm">완료 <b class="num" id="done-n">${done}/${n}명</b> · 남은 평일 <b class="num" id="bdays">${bd}일</b></div></div></div></section>
  <section class="card"><h2>이번 주 할 일</h2>
  ${task(w.noNotice,'미예약·안내 기록 없음 → 1차 안내','1차 안내',`#/msg?stage=notice1&ids=${ids(w.noNotice)}`)}
  ${task(w.overdue,'예약일 지남 → 수검 여부 확인','확인하기','#/board?tab=booked')}
  ${task(w.reno,'1차 안내 후 7일 지남·미예약 → 재안내','재안내',`#/msg?stage=renotice&ids=${ids(w.reno)}`)}
  <p class="xs mu">재안내 시점(7일)은 이 앱의 권장값이에요. 법정 기준이 아니에요.</p></section>
  <section class="card"><div class="row"><a class="btn ghost grow" href="#/fine">과태료 노출·1월 이어가기</a><a class="btn ghost grow" href="#/import">직원 추가</a></div></section>${DISC}`};
};
V.import=()=>({h:'명단 붙여 넣기',html:`<h1>명단 붙여 넣기</h1>
 <section class="card"><p class="sm">엑셀·공단 대상자 목록에서 표를 복사해 붙여 넣으세요. 탭·쉼표 구분을 자동으로 알아봐요. 첫 줄에 머리글(이름, 사무/비사무, 부서, 출생연도, 입사일, 최근검진일, 연락처, 공단대상)이 있으면 열을 자동으로 맞춰요.</p>
 <label for="paste">명단 표</label><textarea id="paste" placeholder="이름&#9;사무/비사무&#9;부서&#9;출생연도&#10;홍길동&#9;사무&#9;총무&#9;1994"></textarea>
 <div class="row" style="margin-top:8px"><button class="btn grow" id="preview">열 매핑 미리보기</button></div><div id="pv" aria-live="polite"></div></section>
 <section class="card"><h2>한 명씩 추가</h2><form id="one" novalidate>
 <label for="o-name">이름 (필수)</label><input id="o-name" autocomplete="off" required aria-describedby="e-o">
 <fieldset style="border:0;padding:0;margin:10px 0 0"><legend style="font-weight:600">근무 구분 (필수)</legend><div class="row"><label class="chk"><input type="radio" name="o-job" value="office">사무직</label><label class="chk"><input type="radio" name="o-job" value="nonoffice">비사무직</label></div></fieldset>
 <label for="o-dept">부서</label><input id="o-dept" autocomplete="off">
 <label for="o-by">출생연도</label><input id="o-by" inputmode="numeric" placeholder="예: 1994" autocomplete="off">
 <label for="o-hire">입사일</label><input id="o-hire" type="date">
 <label for="o-last">최근 일반검진일</label><input id="o-last" type="date">
 <label for="o-nhis">공단 대상 여부</label><select id="o-nhis"><option value="">모름</option><option value="Y">대상(Y)</option><option value="N">대상 아님(N)</option></select>
 <label for="o-ct">연락처 (선택)</label><input id="o-ct" autocomplete="off">
 <label class="chk" style="margin-top:8px"><input type="checkbox" id="o-sp">특수건강진단 대상(이 앱에서 관리 안 함)</label>
 <p id="e-o" class="sm" style="color:var(--bad)"></p><button class="btn full">추가</button></form></section>
 <p class="info">🔒 입력한 명단은 이 기기 브라우저(localStorage)에만 저장돼요.</p>${DISC}`,
 after(){let parsed=null;
  $('#preview').onclick=()=>{parsed=C.parseTable($('#paste').value);const pv=$('#pv');
   if(!parsed.rows.length){pv.innerHTML='<p class="sm" style="color:var(--bad)">붙여 넣은 내용이 없어요.</p>';return}
   const opts=k=>['',...Object.keys(LBL)].map(o=>`<option value="${o}"${o===k?' selected':''}>${o?LBL[o]:'(쓰지 않음)'}</option>`).join('');
   pv.innerHTML=`<p class="sm">구분: <b>${parsed.delim==='\t'?'탭':'쉼표'}</b> · ${parsed.rows.length}행${parsed.hasHead?' · 머리글 인식':''}</p>
   <div class="row" style="flex-direction:column;align-items:stretch">${parsed.head.map((h,i)=>`<div><label for="m${i}">${esc(h)} →</label><select id="m${i}" data-m="${i}">${opts(parsed.map[i])}</select></div>`).join('')}</div>
   <h3>첫 5행</h3><div class="tbl-wrap"><table id="pvt"><thead><tr>${parsed.head.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${parsed.rows.slice(0,5).map(r=>`<tr>${parsed.head.map((_,i)=>`<td>${esc(r[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
   <button class="btn full" id="doimp">가져오기</button>`;
   $('#doimp').onclick=()=>{const map=$$('[data-m]').map(s=>s.value);if(!map.includes('name')){toast('“이름” 열을 지정해 주세요');return}
     const r=C.rowsToEmployees(parsed,map);r.employees.forEach(e=>{e.id=uid('e');S.employees.push(e)});delete S.sample;save();
     toast(`${r.employees.length}명을 가져왔어요`+(r.errors.length?` · 확인 필요 ${r.errors.length}건`:''));location.hash='#/board'}};
  $('#one').onsubmit=ev=>{ev.preventDefault();const name=$('#o-name').value.trim(),job=($('input[name=o-job]:checked')||{}).value||'';
   if(!name||!job){$('#e-o').textContent=!name?'이름을 입력해 주세요.':'사무직/비사무직을 골라 주세요.';$('#o-name').setAttribute('aria-invalid',!name);(!name?$('#o-name'):$('input[name=o-job]')).focus();return}
   const by=C.normBirth($('#o-by').value);if($('#o-by').value&&!by){$('#e-o').textContent='출생연도는 4자리(예: 1994)로 입력해 주세요.';$('#o-by').focus();return}
   S.employees.push({id:uid('e'),name,jobType:job,dept:$('#o-dept').value.trim(),birthYear:by,hireDate:$('#o-hire').value,lastCheckup:$('#o-last').value,nhisTarget:$('#o-nhis').value,contact:$('#o-ct').value.trim(),special:$('#o-sp').checked,status:'unbooked',bookedDate:'',doneDate:''});
   save();toast(name+'님을 추가했어요');$('#one').reset();$('#e-o').textContent='';$('#o-name').focus()}}});
const LBL={name:'이름',jobType:'사무/비사무',dept:'부서',birthYear:'출생연도',hireDate:'입사일',lastCheckup:'최근검진일',contact:'연락처',nhisTarget:'공단대상'};
V.board=(q)=>{const tab=q.get('tab')||'unbooked';
  const T=S.employees.filter(e=>{const c=J(e).code;return C.TARGETISH.includes(c)||c==='done'});
  const others=S.employees.filter(e=>!T.includes(e));
  const cnt=k=>T.filter(e=>C.effStatus(e,Y())===k).length;
  const list=T.filter(e=>C.effStatus(e,Y())===tab);
  const card=e=>{const l=lastLog(e.id);return `<button class="emp${['special','nontarget','nontarget_est'].includes(J(e).code)?' gray':''}" data-emp="${e.id}"><span class="grow"><span class="nm">${esc(e.name)}</span> <span class="xs mu">${esc(e.dept)} · ${e.jobType==='office'?'사무':e.jobType==='nonoffice'?'비사무':'구분 없음'}</span><br>${badge(e)} ${e.bookedDate&&C.effStatus(e,Y())==='booked'?`<span class="xs num">예약 ${esc(e.bookedDate.slice(5).replace('-','.'))}</span>`:''}<span class="xs mu"> ${l?'마지막 안내 '+esc(l.at.slice(5,10).replace('-','.')):'안내 기록 없음'}</span></span><span aria-hidden="true">›</span></button>`};
  return {h:'상태 보드',html:`<h1>상태 보드</h1>
  ${S.employees.length?'':'<p class="notice">직원이 없어요. <a href="#/import">명단 붙여 넣기</a></p>'}
  <div class="seg" role="group" aria-label="상태">${['unbooked','booked','done'].map(k=>`<button data-tab="${k}" aria-pressed="${k===tab}">${ST[k]} <span class="num">${cnt(k)}</span></button>`).join('')}</div>
  <div id="list">${list.map(card).join('')||'<p class="mu sm">이 칸에 해당하는 직원이 없어요.</p>'}</div>
  ${others.length?`<h2 style="margin-top:16px">대상 아님·제외 <span class="num">${others.length}</span></h2>${others.map(card).join('')}`:''}${DISC}`,
  after(){$$('[data-tab]').forEach(b=>b.onclick=()=>{location.hash='#/board?tab='+b.dataset.tab});$$('[data-emp]').forEach(b=>b.onclick=()=>detail(b.dataset.emp))}}};
function detail(id){const e=empById(id);if(!e)return;const j=J(e),L=S.logs.filter(l=>l.employeeId===id).sort((a,b)=>a.at<b.at?-1:1);const st=C.effStatus(e,Y());const locked=j.code==='done'||j.code==='special';
  openDlg(`<h2 id="dlg-h">${esc(e.name)} ${badge(e)}</h2><p class="sm"><b>판정 근거</b> ${esc(j.reason)}</p>
  ${flowHtml(id)}
  <fieldset style="border:0;padding:0;margin:10px 0 0" ${locked?'disabled':''}><legend style="font-weight:600">상태</legend><div class="row">${['unbooked','booked','done'].map(k=>`<label class="chk"><input type="radio" name="d-st" value="${k}"${st===k?' checked':''}>${ST[k]}</label>`).join('')}</div></fieldset>
  ${locked?`<p class="xs mu">${j.code==='done'?'최근 검진일이 올해라 자동으로 완료예요.':'특수건강진단 대상은 이 앱에서 관리하지 않아요.'}</p>`:''}
  <label for="d-bk">예약일</label><input id="d-bk" type="date" value="${esc(e.bookedDate)}">
  <label for="d-dn">수검일</label><input id="d-dn" type="date" value="${esc(e.doneDate)}">
  <label class="chk" style="margin-top:8px"><input type="checkbox" id="d-sp"${e.special?' checked':''}>특수건강진단 대상(이 앱에서 관리 안 함)</label>
  <h3>안내 이력</h3>${L.length?`<ol class="tl" id="tl">${L.map(l=>`<li><b class="num">${esc(fmtAt(l.at))}</b> ${esc(C.STAGES[l.stage])} · ${esc(C.CHANNELS[l.channel])}${l.received?' · <span class="st-done">수신 확인</span>':''}${l.memo?`<div class="xs mu">${esc(l.memo)}</div>`:''}</li>`).join('')}</ol>`:'<p class="sm mu" id="tl">아직 기록이 없어요.</p>'}
  <div class="row" style="margin-top:12px"><button class="btn ghost grow" value="msg">메시지 만들기</button><button class="btn grow" value="save" id="d-save">저장</button></div>
  <div class="row" style="margin-top:8px"><button class="btn ghost grow" value="cancel">닫기</button><button class="btn danger grow" value="del">직원 삭제</button></div>`,(f,v)=>{
    if(v==='del')return 'del';
    const r=$('input[name=d-st]:checked',f);e.bookedDate=$('#d-bk',f).value;e.doneDate=$('#d-dn',f).value;e.special=$('#d-sp',f).checked;
    if(r)e.status=r.value;if(e.doneDate)e.status='done';else if(e.bookedDate&&e.status==='unbooked')e.status='booked';save();return v}).then(v=>{
    if(v==='del')return ask('직원 삭제',`<p>${esc(e.name)}님과 안내 기록을 지울까요? 되돌릴 수 없어요.</p>`,'삭제',true).then(ok=>{if(ok){S.employees=S.employees.filter(x=>x.id!==id);S.logs=S.logs.filter(l=>l.employeeId!==id);save();toast('삭제했어요')}render()});
    if(v==='msg'){location.hash='#/msg?ids='+id;return}
    if(v==='save'){toast('저장했어요');render()}})}
V.msg=(q)=>{const stage=q.get('stage')||'notice1';const pre=(q.get('ids')||'').split(',').filter(Boolean);
  const T=S.employees.filter(e=>C.TARGETISH.includes(J(e).code)&&C.effStatus(e,Y())!=='done');
  const sel=new Set(pre.length?pre:T.map(e=>e.id));
  return {h:'안내 메시지',html:`<h1>안내 메시지</h1>
  <section class="card"><label for="stage">차수</label><select id="stage">${Object.entries(C.STAGES).map(([k,v])=>`<option value="${k}"${k===stage?' selected':''}>${v}</option>`).join('')}</select>
  <fieldset style="border:0;padding:0;margin:12px 0 0"><legend style="font-weight:600">받는 사람 (미완료 대상자 ${T.length}명)</legend>
  ${T.map(e=>`<label class="chk"><input type="checkbox" data-to="${e.id}"${sel.has(e.id)?' checked':''}>${esc(e.name)} ${badge(e)}</label>`).join('')||'<p class="sm mu">미완료 대상자가 없어요.</p>'}</fieldset>
  ${(!S.settings.company||!S.settings.manager)?'<p class="notice">회사명·담당자를 <a href="#/settings">설정</a>에 넣으면 문구에 자동으로 들어가요.</p>':''}
  <button class="btn ghost full" id="bulk" style="margin-top:8px">선택한 사람 모두 한 번에 복사</button></section>
  <div id="prevs"></div>
  <p class="xs mu">권장 흐름: 1차 개별 안내 → 미수검 확인 후 재안내 → 최종 통보(수신 확인 요청) → 필요 시 거부 의사 확인. 횟수 기준은 법령에 없으니 <b>기록을 남기는 것</b>이 핵심이에요. ${srcLink('moel1350')}</p>${DISC}`,
  after(){const vars=e=>({이름:e.name,회사:S.settings.company,마감일:C.fmtDeadline(S.settings.deadline),담당자:S.settings.manager,담당자연락처:S.settings.managerContact});
   const draw=()=>{const st=$('#stage').value;const ids=$$('[data-to]:checked').map(c=>c.dataset.to);
    $('#prevs').innerHTML=ids.map(id=>{const e=empById(id),txt=C.fill(C.tplFor(st,e,Y()),vars(e)),ct=e.contact||'';const isMail=/@/.test(ct),phone=ct.replace(/[^\d+]/g,'');
     return `<section class="card" data-pv="${id}"><h2>${esc(e.name)} <span class="xs mu">${esc(C.STAGES[st])}${st==='notice1'&&J(e).code==='check'?' · 대상 확인 요청':''}</span></h2><div class="prev">${esc(txt)}</div>
     <div class="row" style="margin-top:8px"><button class="btn grow" data-copy="${id}">복사</button>
     <a class="btn ghost grow" data-open="${id}" href="sms:${isMail?'':esc(phone)}?body=${encodeURIComponent(txt)}">문자 앱</a>
     <a class="btn ghost grow" data-open="${id}" href="mailto:${isMail?esc(ct):''}?subject=${encodeURIComponent((S.settings.company||'')+' 일반건강검진 안내')}&body=${encodeURIComponent(txt)}">메일</a></div></section>`}).join('');
    $$('[data-copy]').forEach(b=>b.onclick=async()=>{const id=b.dataset.copy;await copyText(C.fill(C.tplFor($('#stage').value,empById(id),Y()),vars(empById(id))));toast('복사했어요');confirmSent([id],$('#stage').value,'messenger')});
    $$('[data-open]').forEach(a=>a.addEventListener('click',()=>{const ch=a.textContent.includes('메일')?'email':'sms';setTimeout(()=>confirmSent([a.dataset.open],$('#stage').value,ch),300)}));};
   $('#stage').onchange=draw;$$('[data-to]').forEach(c=>c.onchange=draw);draw();
   $('#bulk').onclick=async()=>{const st=$('#stage').value,ids=$$('[data-to]:checked').map(c=>c.dataset.to);if(!ids.length){toast('받는 사람을 골라 주세요');return}
    await copyText(ids.map(id=>C.fill(C.tplFor(st,empById(id),Y()),vars(empById(id)))).join('\n\n———\n\n'));toast(ids.length+'명분을 복사했어요');confirmSent(ids,st,'messenger')}}}};
async function copyText(t){try{await navigator.clipboard.writeText(t)}catch(e){const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('aria-hidden','true');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(_){}ta.remove()}}
function confirmSent(ids,stage,ch){const names=ids.map(id=>esc((empById(id)||{}).name)).join(', ');
  return openDlg(`<h2 id="dlg-h">보냈나요?</h2><p class="sm">${names} · ${esc(C.STAGES[stage])}</p>
  <label for="c-ch">보낸 수단</label><select id="c-ch">${Object.entries(C.CHANNELS).map(([k,v])=>`<option value="${k}"${k===ch?' selected':''}>${v}</option>`).join('')}</select>
  <label for="c-memo">메모 (선택)</label><input id="c-memo" autocomplete="off" placeholder="예: 단톡방 공지 후 개별 문자">
  <label class="chk" style="margin-top:8px"><input type="checkbox" id="c-rc">수신 확인(회신·읽음)을 받았어요</label>
  <p class="xs mu">기록 일시는 지금(${esc(nowIso().slice(0,16).replace('T',' '))})으로 남아요.</p>
  <div class="row" style="margin-top:12px"><button class="btn ghost grow" value="cancel">아직 안 보냄</button><button class="btn grow" value="ok" id="c-ok">기록하기</button></div>`,f=>{
    const at=nowIso();ids.forEach(id=>S.logs.push({id:uid('l'),employeeId:id,stage,channel:$('#c-ch',f).value,at,received:$('#c-rc',f).checked,memo:$('#c-memo',f).value.trim()}));save();return 'ok'}).then(v=>{if(v)toast(ids.length+'건 기록했어요')})}
V.log=(q)=>{const fe=q.get('e')||'',fs=q.get('s')||'',fc=q.get('c')||'';
  const L=S.logs.filter(l=>(!fe||l.employeeId===fe)&&(!fs||l.stage===fs)&&(!fc||l.channel===fc)).sort((a,b)=>a.at<b.at?1:-1);
  const sel=(id,lab,opts,v)=>`<div class="grow" style="min-width:96px"><label for="${id}">${lab}</label><select id="${id}"><option value="">전체</option>${opts.map(([k,t])=>`<option value="${k}"${k===v?' selected':''}>${esc(t)}</option>`).join('')}</select></div>`;
  const T=S.employees.filter(e=>C.TARGETISH.includes(J(e).code)||J(e).code==='done');
  return {h:'기록·증빙',html:`<h1>기록·증빙</h1>
  <div class="print-only"><h2>${esc(S.settings.company||'')} ${Y()}년 일반건강진단 안내 기록</h2><p>담당 ${esc(S.settings.manager||'')} · 출력일 ${esc(today())}</p></div>
  <section class="card no-print"><div class="row">${sel('f-e','직원',S.employees.map(e=>[e.id,e.name]),fe)}${sel('f-s','차수',Object.entries(C.STAGE_SHORT),fs)}${sel('f-c','수단',Object.entries(C.CHANNELS),fc)}</div></section>
  <section class="card"><h2>안내 로그 <span class="num">${L.length}건</span></h2>
  <div class="tbl-wrap"><table id="logt"><thead><tr><th scope="col">일시</th><th scope="col">이름</th><th scope="col">차수</th><th scope="col">수단·확인</th></tr></thead><tbody>
  ${L.map(l=>{const e=empById(l.employeeId)||{};return `<tr><td class="num">${esc(fmtAt(l.at))}</td><td class="nm">${esc(e.name||'(삭제됨)')}</td><td>${esc(C.STAGE_SHORT[l.stage])}</td><td>${esc(C.CHANNELS[l.channel])}${l.received?' <span aria-label="수신 확인">✓</span>':''}</td></tr>`}).join('')||'<tr><td colspan="4" class="mu">기록이 없어요.</td></tr>'}</tbody></table></div></section>
  <section class="card"><h2>직원별 권장 흐름 기록</h2><div class="tbl-wrap"><table id="flowt"><thead><tr><th scope="col">이름</th><th scope="col">상태</th><th scope="col">안내</th><th scope="col">재안내</th><th scope="col">수신</th></tr></thead><tbody>
  ${T.map(e=>{const f=C.flowFor(e.id,S.logs);const m=b=>b?'✓':'—';return `<tr><td class="nm">${esc(e.name)}</td><td class="st-${C.effStatus(e,Y())}">${ST[C.effStatus(e,Y())]}</td><td>${m(f.notice1)}</td><td>${m(f.renotice)}</td><td>${m(f.received)}</td></tr>`}).join('')}</tbody></table></div>
  <p class="xs mu">안내 = 1차 개별 안내, 재안내 = 재안내 또는 최종 통보, 수신 = 수신 확인 기록. ✓ 표시는 기록이 있다는 뜻일 뿐, 과태료 면제나 법적 요건 충족을 뜻하지 않아요.</p></section>
  <div class="row no-print"><button class="btn grow" id="print">인쇄용 증빙표</button><button class="btn ghost grow" id="csv">CSV 내려받기</button></div>
  ${DISC}`,
  after(){['f-e','f-s','f-c'].forEach(id=>$('#'+id).onchange=()=>{const p=new URLSearchParams();if($('#f-e').value)p.set('e',$('#f-e').value);if($('#f-s').value)p.set('s',$('#f-s').value);if($('#f-c').value)p.set('c',$('#f-c').value);location.hash='#/log'+(p.toString()?'?'+p:'');});
   $('#print').onclick=()=>ask('인쇄용 증빙표',PII_WARN,'인쇄하기').then(ok=>{if(ok)window.print()});
   $('#csv').onclick=()=>ask('CSV 내려받기',PII_WARN,'내려받기').then(ok=>{if(ok){download(`검진안내기록_${today()}.csv`,C.logsCsv(S.employees,S.logs),'text/csv;charset=utf-8');toast('CSV를 내려받았어요')}})}}};
V.fine=()=>{const P=C.pending(S.employees,Y()),lv=+S.settings.violationLevel||1,f=C.fineExposure(P.length,lv);
  const chk=S.employees.filter(e=>J(e).code==='check'&&C.effStatus(e,Y())!=='done');
  const carryList=S.employees.filter(e=>C.TARGETISH.includes(J(e).code)&&C.effStatus(e,Y())!=='done');
  return {h:'과태료 노출·1월 이어가기',html:`<h1>과태료 노출·1월 이어가기</h1>
  <section class="card"><h2>사업주 과태료 노출(참고용)</h2>
  <label for="lv">위반 차수</label><select id="lv">${[1,2,3].map(k=>`<option value="${k}"${k===lv?' selected':''}>${k===3?'3차 이상':k+'차'} — 1명당 ${C.won(R.fineEmployer[k])}</option>`).join('')}</select>
  <div class="kv"><span>미완료 대상자</span><b id="f-n">${f.n}명</b></div>
  <div class="kv"><span>1명당 기준</span><b id="f-per">${C.won(f.per)}</b></div>
  <div class="kv"><span>계산</span><b id="f-raw"><span class="num">${f.n}명</span> × <span class="num">${C.won(f.per)}</span></b></div>
  <div class="kv"><span>최대 노출액</span><b id="f-total" class="big" style="font-size:1.5rem">${C.won(f.capped)}</b></div>
  ${f.hitCap?`<p class="notice" id="f-cap">법률상 상한 ${C.won(R.fineEmployerCap.amount)}을 넘어 상한으로 표시했어요(계산값 ${C.won(f.raw)}).</p>`:''}
  <p class="sm">‘확인 필요’ ${chk.length}명은 계산에서 뺐어요. 실제 부과 여부·금액은 감독 시 사실관계, 위반 차수, 규모별 감경 등에 따라 달라지며 <b>관할 지방고용노동관서 확인</b>이 필요해요. 이 숫자는 참고용이에요.</p>
  <p class="src">${srcLink('b35')}<br>${srcLink('moel')}</p>
  <p class="xs mu">${esc(R.sizeReduction.note)}</p></section>
  <section class="card"><h2>근로자 과태료(설명)</h2><p class="sm">근로자가 사업주가 실시하는 건강진단을 받지 않으면(법 제133조) 1차 <span class="num">5만원</span>·2차 <span class="num">10만원</span>·3차 이상 <span class="num">15만원</span> 부과 기준이 있어요. 사업주가 개별 안내·재안내를 했는지가 누구 책임인지 판단에 쓰인다는 안내가 있지만, 안내 횟수로 면제되는 기준은 없어요.</p><p class="src">${srcLink('b35')}<br>${srcLink('kiha')}</p></section>
  <section class="card"><h2>1월 이어가기 — ${Y()+1}년 전년도 미수검자 추가 등록 명단</h2>
  <p class="sm">${C.daysBetween(today(),S.settings.deadline)>=0?'미리보기예요. 12월 31일이 지나면 아래 직원이 대상이 돼요.':'마감이 지났어요. 아래 직원을 추가 등록하세요.'}</p>
  <div class="tbl-wrap"><table id="carryt"><thead><tr><th scope="col">이름</th><th scope="col">구분</th><th scope="col">판정</th><th scope="col">경로</th></tr></thead><tbody>
  ${carryList.map(e=>`<tr><td class="nm">${esc(e.name)}</td><td>${e.jobType==='office'?'사무':e.jobType==='nonoffice'?'비사무':'?'}</td><td>${badge(e)}</td><td class="xs">${e.jobType==='office'?'회사 EDI 등록(A)':e.jobType==='nonoffice'?'자동 연장? 확인 필요':'확인 필요'}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">이월할 직원이 없어요.</td></tr>'}</tbody></table></div>
  <h3>가입 유형별 경로</h3><ul class="sm">${R.carry.map(c=>`<li><b>${esc(c.title)}</b> <span class="tag${c.status==='verified'?' ok':''}">${c.status==='verified'?'확인':'확인 필요'}</span> ${esc(c.text)}<br><span class="src">${srcLink(c.source)}</span></li>`).join('')}</ul>
  <p class="xs mu">지역가입자·피부양자 가족은 회사 과태료와 관계없어요(공단 고객센터·앱으로 개인 신청). 최종 확인: 국민건강보험공단 1577-1000.</p></section>${DISC}`,
  after(){$('#lv').onchange=()=>{S.settings.violationLevel=+$('#lv').value;save();render()}}}};
V.settings=()=>{const s=S.settings;return {h:'설정',html:`<h1>설정</h1>
  <section class="card"><form id="sf"><label for="s-co">회사명</label><input id="s-co" value="${esc(s.company)}" autocomplete="organization">
  <label for="s-mg">담당자 이름</label><input id="s-mg" value="${esc(s.manager)}" autocomplete="name">
  <label for="s-ct">담당자 연락처</label><input id="s-ct" value="${esc(s.managerContact)}" autocomplete="tel">
  <label for="s-y">기준 연도</label><input id="s-y" inputmode="numeric" value="${esc(s.year)}" aria-describedby="e-s">
  <p class="xs mu">마감일은 기준 연도 12월 31일로 자동 설정돼요.</p><p id="e-s" class="sm" style="color:var(--bad)"></p>
  <button class="btn full">저장</button></form></section>
  <section class="card"><h2>백업·복원·삭제</h2><p class="sm">기기를 바꾸거나 브라우저 데이터를 지우면 명단이 사라져요. JSON으로 백업해 두세요.</p>
  <div class="row"><button class="btn ghost grow" id="bk">JSON 백업</button><label class="btn ghost grow" for="rs" style="margin:0">JSON 복원</label><input type="file" id="rs" accept="application/json,.json" class="no-print" style="position:absolute;left:-9999px;width:1px;height:1px"></div>
  <button class="btn danger full" id="wipe" style="margin-top:10px">전체 삭제</button></section>
  <section class="card" id="sources"><h2>출처와 확인 상태 (기준일 ${R.asOf})</h2>
  <h3>확인한 값</h3><ul class="sm">
  <li>일반건강진단 주기: 사무직 2년에 1회 이상, 그 밖의 근로자 1년에 1회 이상 — ${srcLink('rule197')}</li>
  <li>사업주 과태료: 건강진단 대상 근로자 1명당 1차 10만원·2차 20만원·3차 이상 30만원([별표 35] 녀목), 근로자 1차 5만원·2차 10만원·3차 이상 15만원(셔목) — ${srcLink('b35')}</li>
  <li>건강진단 미실시 1,000만원 이하 과태료, 국민건강보험법 검진으로 대체 가능 — ${srcLink('moel')}</li>
  <li>주기는 회계연도(12/31) 기준, 사업주 조치 방식에 별도 규정 없음 — ${srcLink('moel1350')}</li>
  <li>국민건강보험 검진 주기(2년마다, 비사무직 1년 1회) — ${srcLink('nhisLaw')}</li>
  <li>대상 조회 채널(누리집·「건강보험25시」·1577-1000) — ${srcLink('kdca')}</li>
  <li>EDI 등록사유 A: 추가(전년도미수검) — ${srcLink('nhisEdi')}</li></ul>
  <h3>확인 필요</h3><ul class="sm">
  <li>2026년 짝수년도 출생자 대상 — 공단 발표 보도로 확인, 공단 원문 공지는 미확인 <span class="tag">확인 필요</span> ${srcLink('yna')}</li>
  <li>1월 추가 신청 후 6월 말까지 수검, 비사무직 자동 연장 — 보도 <span class="tag">확인 필요</span> ${srcLink('maeil')}</li>
  <li>[별표 35]는 2023.6.27. 개정본 원문으로 확인했어요. 이후 개정 여부는 국가법령정보센터에서 재확인 <span class="tag">확인 필요</span></li>
  <li>규모별 감경(10~50명 100분의 80 등)은 계산하지 않음</li></ul>
  <p class="sm">‘안내 N회면 면제’ 같은 횟수 기준은 법령에서 찾지 못했어요. 일부 기사의 “연 2회 안내 시 면책”은 이 앱에서 쓰지 않아요.</p></section>
  <p class="sm"><a href="privacy.html">개인정보 안내</a> · <a href="checkup-penalty-guide/">미수검 과태료 안내</a> · <a href="reminder-message-flow/">독려 문자 권장 흐름</a> · <a href="january-carryover/">1월 이어가기</a></p>${DISC}`,
  after(){$('#sf').onsubmit=ev=>{ev.preventDefault();const y=+$('#s-y').value;if(!(y>=2020&&y<=2035)){$('#e-s').textContent='기준 연도는 2020~2035 사이 숫자로 입력해 주세요.';$('#s-y').setAttribute('aria-invalid','true');$('#s-y').focus();return}
    Object.assign(S.settings,{company:$('#s-co').value.trim(),manager:$('#s-mg').value.trim(),managerContact:$('#s-ct').value.trim(),year:y,deadline:y+'-12-31'});save();toast('저장했어요');render()};
   $('#bk').onclick=()=>ask('JSON 백업',PII_WARN,'내려받기').then(ok=>{if(ok){download(`검진장부_백업_${today()}.json`,JSON.stringify(S,null,1),'application/json');toast('백업 파일을 내려받았어요')}});
   $('#rs').onchange=ev=>{const file=ev.target.files[0];if(!file)return;file.text().then(t=>{let d;try{d=JSON.parse(t)}catch(e){toast('JSON 파일이 아니에요');return}
     if(!d||!d.settings||!Array.isArray(d.employees)||!Array.isArray(d.logs)){toast('이 앱의 백업 파일이 아니에요');return}
     ask('복원',`<p>현재 데이터를 백업 파일(직원 ${d.employees.length}명, 기록 ${d.logs.length}건)로 바꿀까요?</p>`,'복원').then(ok=>{if(ok){S=d;save();toast('복원했어요');render()}})})};
   $('#wipe').onclick=()=>ask('전체 삭제',`<p>이 기기에 저장된 <b>직원 ${S.employees.length}명, 안내 기록 ${S.logs.length}건, 설정</b>을 모두 지울까요? 되돌릴 수 없어요. 필요하면 먼저 JSON 백업을 하세요.</p>`,'모두 삭제',true).then(ok=>{if(ok){localStorage.removeItem(KEY);S=blank();toast('모두 지웠어요');location.hash='#/'}})}}};

/* 라우터 */
function render(){const raw=location.hash.replace(/^#\/?/,'');const [path,qs]=raw.split('?');const q=new URLSearchParams(qs||'');
  const key={'':'home',import:'import',board:'board',msg:'msg',log:'log',fine:'fine',settings:'settings'}[path]||'home';
  const v=V[key](q);const m=$('#view');m.innerHTML=v.html;document.title=pageTitle(v.h);
  $$('#tabbar a').forEach(a=>{const k=a.getAttribute('href').replace('#/','');a.toggleAttribute('aria-current',false);if(k===path||(k===''&&key==='home'&&path===''))a.setAttribute('aria-current','page')});
  v.after&&v.after();
  if(render.n++)m.focus({preventScroll:true});window.scrollTo(0,0)}
render.n=0;
window.addEventListener('hashchange',render);
window.addEventListener('storage',e=>{if(e.key===KEY){S=load();render()}});
render();
/* 자체 점검 */
window.runSelfTest=function(){const r=[],ok=(n,c)=>r.push({n,pass:!!c});const y=2026;
  ok('비사무직 → 대상',C.judge({jobType:'nonoffice'},y).code==='target');
  ok('사무직 1990(짝) → 대상(추정)',C.judge({jobType:'office',birthYear:1990},y).code==='target_est');
  ok('사무직 1995(홀) → 대상 아님(추정)',C.judge({jobType:'office',birthYear:1995},y).code==='nontarget_est');
  ok('2027년엔 1995 → 대상(추정)',C.judge({jobType:'office',birthYear:1995},2027).code==='target_est');
  ok('공단 Y 우선(1993 홀수라도)',C.judge({jobType:'office',birthYear:1993,nhisTarget:'Y'},y).code==='target');
  ok('공단 N 우선(1990 짝수라도)',C.judge({jobType:'office',birthYear:1990,nhisTarget:'N'},y).code==='nontarget');
  ok('출생연도 없음 → 확인 필요',C.judge({jobType:'office'},y).code==='check');
  ok('올해 검진 → 완료',C.judge({jobType:'nonoffice',lastCheckup:'2026-03-01'},y).code==='done');
  ok('올해 입사 → 확인 필요',C.judge({jobType:'nonoffice',hireDate:'2026-08-01'},y).code==='check');
  ok('특수 → 제외',C.judge({jobType:'nonoffice',special:true},y).code==='special');
  ok('과태료 3명×10만=30만',C.fineExposure(3,1).capped===300000);
  ok('과태료 상한 101명×10만 → 1천만',C.fineExposure(101,1).capped===10000000);
  ok('D-57 (11/4→12/31)',C.daysBetween('2026-11-04','2026-12-31')===57);
  ok('남은 평일 41일',C.businessDays('2026-11-04','2026-12-31')===41);
  ok('CSV BOM',C.logsCsv([],[]).charCodeAt(0)===0xFEFF);
  ok('탭 구분 인식',C.detectDelim('a\tb')==='\t');
  ok('확인 필요 1차 = 대상 확인 요청 문구',/대상인지 확인해 주세요/.test(C.tplFor('notice1',{jobType:'office'},y))&&/대상이세요/.test(C.tplFor('notice1',{jobType:'nonoffice'},y)));
  return {pass:r.filter(x=>x.pass).length,total:r.length,results:r}};
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
