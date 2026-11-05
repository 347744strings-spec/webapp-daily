/* 연말 연차 정산표 — 규칙·순수 함수 (브라우저/Node 공용). 기준일 2026-11-05 */
(function(root){
const SRC={
  law6061:{t:'근로기준법 제60조·제61조 원문 — 국가법령정보센터 [시행 2026.10.8.] 법률 제21533호',u:'https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1012792285',ok:true},
  dec6:{t:'근로기준법 시행령 제6조(통상임금: 월급 ÷ 월 통상임금 산정 기준시간, 일급 = 시간급 × 1일 소정근로시간) — 국가법령정보센터 [시행 2025.10.23.]',u:'https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1021695361',ok:true},
  moel1350:{t:'고용노동부 1350 상담(1일 연차수당 = 1일 소정근로시간 × 통상시급, 월 ÷ 209시간 예시, 2026.4.28. 답변)',u:'https://1350.moel.go.kr/rtmview.do?id=1000322406',ok:true},
  moelFiscal:{t:'고용노동부 빠른상담: 회계연도 기준 사용촉진 일정',u:'https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202512040525472060348',ok:false},
  maeil:{t:'매일신문(2026-09-26): 연차촉진 통보 마감 10월 31일… 단체 메일은 서면 아님, 평균 잔여 3.5일(보도)',u:'https://www.imaeil.com/page/view/2026092615565422025',ok:false},
  yulchon:{t:'법무법인 율촌: 지정일 노무수령 거부 표시 없으면 보상 의무(대법원 판결 해설)',u:'https://www.yulchon.com/ko/resources/publications/legal-update-view/41956/page.do',ok:false},
  yna:{t:'연합뉴스(2026-08-02): 직장갑질119 설문 — 48.8% 휴가 중 업무 연락 경험',u:'https://www.yna.co.kr/view/AKR20260802016100004',ok:false},
  beone:{t:'노무법인 비원: 회계연도 사용촉진 시기, 1년 미만 별도(해설)',u:'https://beonelaborlaw.com/annual-leave-promotion-fiscal-year-schedule/',ok:false},
  lawtrack:{t:'LAWtrack(비공식 추적): 근로기준법 개정 일정 — 법률 제21784호 시행 2026-12-10·2027-06-10, 통상임금 정의 의원안 소위 계류',u:'https://lawtrack.kr/law/001872',ok:false}
};
const RULES={asOf:'2026-11-05',appName:'연말 연차 정산표',monthlyHours:209,dailyHours:8,phone:'1350'};
const pad=n=>String(n).padStart(2,'0');
function todayKST(){return new Date(Date.now()+9*3600e3).toISOString().slice(0,10)}
function parse(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN}
function fmt(t){const d=new Date(t);return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
function addDays(s,n){return fmt(parse(s)+n*864e5)}
function addMonths(s,n){const t=new Date(parse(s));const y=t.getUTCFullYear(),m=t.getUTCMonth()+n,d=t.getUTCDate();const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return fmt(Date.UTC(y,m,Math.min(d,last)))}
function addYears(s,n){return addMonths(s,12*n)}
function daysBetween(a,b){return Math.round((parse(b)-parse(a))/864e5)}
const WD='일월화수목금토';
function weekday(s){return WD[new Date(parse(s)).getUTCDay()]}
function fmtK(s){const t=new Date(parse(s));return `${t.getUTCMonth()+1}월 ${t.getUTCDate()}일(${weekday(s)})`}
function validNum(v,min,max){return typeof v==='number'&&isFinite(v)&&v>=min&&v<=max}
/* 계산: 반올림은 마지막에 한 번(원 단위, 0.5 올림). 표시용 시급·1일 금액은 따로 반올림해 보여 줄 뿐 곱셈에 쓰지 않음 */
function calc(wage,days,mh,dh){if(mh==null)mh=209;if(dh==null)dh=8;
  if(!validNum(wage,0,1e10)||!validNum(days,0,400)||!validNum(mh,1,744)||!validNum(dh,0.5,24))return null;
  const hourly=wage/mh,daily=hourly*dh,raw=daily*days;
  return {hourly,daily,raw,hourlyWon:Math.round(hourly),dailyWon:Math.round(daily),payWon:Math.round(raw)}}
function halfStep(v){return Math.round(v*2)===v*2}
/* 신호등(휴리스틱, 7장) */
function verdict(p){p=p||{};
  if(p.q4==='yes'||(p.q1==='no'&&p.q3==='yes')||p.q5==='yes')return 'invalidLikely';
  if(p.q1==='yes'&&p.q3==='yes'&&p.q4==='no'&&p.q5==='no')return 'validLikely';
  return 'needCheck'}
const VERDICT={invalidLikely:{label:'무효 가능',sub:'수당 청구 검토',cls:'v-bad'},validLikely:{label:'유효 가능',sub:'쓰지 않으면 소멸·수당 어려울 수 있음',cls:'v-ok'},needCheck:{label:'확인 필요',sub:'모름·빈칸이 있거나 조건이 섞였어요',cls:'v-chk'}};
/* 촉진 일정: 사용기간 마지막 날 E → 다음 날 N 기준 (제61조①: N-6개월 기준 10일 이내, N-2개월 전까지) */
function schedule(expire){if(isNaN(parse(expire)))return null;const N=addDays(expire,1);const b1=addMonths(N,-6);
  return {expire,first:{from:b1,to:addDays(b1,9)},second:{by:addDays(addMonths(N,-2),-1)}}}
/* 1년 미만(제61조②): 최초 1년 끝(N=입사일+1년) 3개월 전 기준 10일 이내 / 1개월 전까지, 후발 휴가 1개월 전 기준 5일 이내 / 10일 전까지 */
function scheduleUnder1(hire){if(isNaN(parse(hire)))return null;const N=addYears(hire,1);const b1=addMonths(N,-3),b2=addMonths(N,-1);
  return {end:addDays(N,-1),first:{from:b1,to:addDays(b1,9)},second:{by:addDays(b2,-1)},late:{from:b2,to:addDays(b2,4),by:addDays(N,-10)}}}
function underOneYear(hire,today){return !isNaN(parse(hire))&&parse(addYears(hire,1))>parse(today)}
/* 마감일 */
function deadlineOf(st,inp){if(st.basis==='hire'&&inp&&!isNaN(parse(inp.leaveExpireDate)))return inp.leaveExpireDate;return (st.year||2026)+'-12-31'}
function yearRolled(st,today){return st.basis!=='hire'&&parse(today)>parse((st.year||2026)+'-12-31')}
/* ICS */
function icsEsc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n')}
function ics(dates,stamp){const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//webapp-daily//year-end-leave-settlement//KO','CALSCALE:GREGORIAN'];
  (dates||[]).forEach(d=>{if(isNaN(parse(d.date)))return;const a=d.date.replace(/-/g,''),b=addDays(d.date,1).replace(/-/g,'');
    L.push('BEGIN:VEVENT','UID:'+d.id+'-'+a+'@year-end-leave-settlement','DTSTAMP:'+(stamp||'20261105T000000Z'),'DTSTART;VALUE=DATE:'+a,'DTEND;VALUE=DATE:'+b,'SUMMARY:'+icsEsc('연차 지정일'+(d.note?' — '+d.note:'')),'DESCRIPTION:'+icsEsc('업무 지시·연락을 받으면 메시지 원문·시각을 저장해 두세요. (연말 연차 정산표)'),'END:VEVENT')});
  L.push('END:VCALENDAR');return L.join('\r\n')+'\r\n'}
const won=n=>Math.round(n).toLocaleString('ko-KR')+'원';
const won1=n=>(Math.round(n*10)/10).toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1})+'원';
/* 공유 텍스트: 기본은 금액·월급 제외 */
function shareText(S,today,withMoney){const st=S.settings,i=S.inputs,dl=deadlineOf(st,i),dd=daysBetween(today,dl),v=VERDICT[verdict(S.promotion)];
  const r=calc(i.monthlyWage,i.remainingDays,st.monthlyHours,st.dailyHours);const L=['[연말 연차 정산표] '+today+' 기준'];
  L.push(`사용기간 마감 ${dl} (${dd>=0?'D-'+dd:'지남'}) · 잔여 연차 ${i.remainingDays==null?'-':i.remainingDays+'일'}`);
  if(withMoney&&r){L.push(`월 통상임금 ${won(i.monthlyWage)} ÷ ${st.monthlyHours}시간 × ${st.dailyHours}시간 = 1일 ${won(r.daily)}`);L.push(`미사용수당(세전 참고) ${won(r.raw)}`)}
  L.push(`사용촉진 점검 힌트: ${v.label} (${v.sub})`);
  const up=(S.dates||[]).filter(d=>parse(d.date)>=parse(today)).sort((a,b)=>a.date<b.date?-1:1);if(up.length)L.push('지정일: '+up.map(d=>d.date).join(', '));
  L.push('※ 참고용 점검 힌트이며 법률 자문이 아니에요. 최종 판단은 관할 지방고용노동관서(☎1350)·노무사 확인.');return L.join('\n')}
function mailDraft(S,today){const i=S.inputs,p=S.promotion||{},n=x=>x||'';const L=[];
  L.push('제목: 미사용 연차 사용촉진·정산 관련 확인 요청드립니다','',`안녕하세요, ${n(i.myName)||'(이름)'}입니다.`,'',`${today} 기준 제 잔여 연차는 ${i.remainingDays==null?'(일수)':i.remainingDays+'일'}로 알고 있습니다. 연말 정산 전에 아래 사항을 확인 부탁드립니다.`,'');
  let k=1;L.push(`${k++}. 올해 1차 사용촉진(잔여 일수 고지·사용시기 지정 촉구)을 언제, 어떤 방식(개인별 서면)으로 보내셨는지`);
  L.push(`${k++}. 2차 사용시기 지정 통보(지정 날짜 포함)를 언제, 어떤 방식으로 보내셨는지`);
  if(p.q4==='yes')L.push(`${k++}. 단체 메일·게시판 공지 외에 개인별 서면 통보가 있었는지`);
  if(p.q5==='yes')L.push(`${k++}. 지정일에 업무 지시·연락이 있었던 날의 처리(사용 처리 여부)`);
  L.push(`${k++}. 사용하지 못한 연차의 수당 지급 여부와 지급 예정일`,'','확인을 위해 여쭙는 것이니 편하실 때 회신 부탁드립니다. 감사합니다.',`${n(i.myName)||'(이름)'} 드림`);return L.join('\n')}
const C={SRC,RULES,todayKST,parse,fmt,addDays,addMonths,addYears,daysBetween,weekday,fmtK,calc,halfStep,verdict,VERDICT,schedule,scheduleUnder1,underOneYear,deadlineOf,yearRolled,ics,won,won1,shareText,mailDraft};
if(typeof module!=='undefined')module.exports=C;else root.LS=C;
})(typeof window!=='undefined'?window:globalThis);
