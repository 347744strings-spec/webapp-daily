/* 연말 검진 독려 장부 — 규칙·순수 함수 (브라우저/Node 공용). 기준일 2026-11-04 */
(function(root){
const SRC={
  rule197:{t:'산업안전보건법 시행규칙 제197조(일반건강진단의 주기 등) — 국가법령정보센터, 시행 2026.8.1.',u:'https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=154549'},
  b35:{t:'산업안전보건법 시행령 [별표 35] 과태료의 부과기준 원문(개정 2023.6.27.) — 국가법령정보센터',u:'https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110201&flSeq=162449929&gubun='},
  moel:{t:'고용노동부 빠른인터넷상담 답변(건강진단 미실시 1,000만원 이하 과태료, 국민건강보험법 검진으로 대체 가능)',u:'https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202210251754485021000'},
  moel1350:{t:'고용노동부 1350 상담(주기는 회계연도 기준, 사업주 조치 방식에 별도 규정 없음)',u:'https://1350.moel.go.kr/rtmview.do?id=1000310768'},
  nhisLaw:{t:'국민건강보험법 시행령 제25조(건강검진 주기: 2년마다, 비사무직 직장가입자 1년 1회)',u:'https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=69419'},
  nhisEdi:{t:'국민건강보험공단 건강보험 EDI — 건강검진 대상자 변경(추가·제외) 신청서 사양(등록사유 A: 추가(전년도미수검))',u:'https://edi.nhis.or.kr/webedi/file_sy/kungang(chuka_jewoi).html'},
  yna:{t:'연합뉴스(2026-10-08): 국민건강보험공단 — 2026년 대상 짝수년도 출생자, 비사무직 매년·사무직 2년마다',u:'https://www.yna.co.kr/view/AKR20261008065100530'},
  maeil:{t:'매일신문(2026-10-16): 12월 31일 놓쳐도 1월 신청하면 6월까지(보도)',u:'https://www.imaeil.com/page/view/2026101609192214309'},
  kdca:{t:'질병관리청 국가건강정보포털: 검진 대상 여부는 국민건강보험공단 홈페이지(www.nhis.or.kr)·모바일 앱 「건강보험25시」에서 조회, 1577-1000',u:'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6671'},
  kiha:{t:'한국건강관리협회 월간지 산업보건 Q&A(개별 안내·미수검 재안내 후 미수검 시 근로자 책임)',u:'https://kiha21.or.kr/monthly/2025/10/2025_10_11_s450.pdf'}
};
const RULES={
  asOf:'2026-11-04',
  appName:'연말 검진 독려 장부',
  cycle:{office:2,nonoffice:1,source:'rule197'},
  fineEmployer:{1:100000,2:200000,3:300000,unit:'건강진단 대상 근로자 1명당',source:'b35',verified:true},
  fineEmployerCap:{amount:10000000,source:'moel',verified:true,note:'법률상 상한(산업안전보건법 제175조제4항, 고용노동부 답변 기준)'},
  fineWorker:{1:50000,2:100000,3:150000,source:'b35',verified:true},
  sizeReduction:{note:'별표 35 제3호: 상시근로자 10명 이상 50명 미만 100분의 80 등 규모별 감경이 있으나, 같은 별표 제1호 마목(100만원 미만은 감경하지 않음 등) 적용 방식은 사안별 판단이라 이 앱은 감경을 계산하지 않아요.',source:'b35'},
  nhis2026:{text:'2026년 국가 일반건강검진: 만 20세 이상 짝수년도 출생자, 직장가입자 비사무직 매년·사무직 2년마다, 기간 12월 31일까지',source:'yna',verified:'공단 발표 보도(공단 원문 미확인)'},
  carry:[
    {k:'office',title:'사무직 직장가입자',text:'회사가 건강보험 EDI ‘건강검진 대상자 변경(추가·제외) 신청서’로 등록(등록사유 코드 A: 추가(전년도미수검)).',source:'nhisEdi',status:'verified'},
    {k:'nonoffice',title:'비사무직 직장가입자',text:'일반검진은 별도 신청 없이 이어진다는 보도가 있어요. 확인 필요 — 공단 사업장 지사(1577-1000) 확인.',source:'maeil',status:'check'},
    {k:'due',title:'추가 등록 후 수검 기한',text:'“1월 신청 시 6월 말까지 수검”은 보도 내용이에요. 확인 필요 — 공단 공지로 재확인.',source:'maeil',status:'check'},
    {k:'law',title:'산업안전보건법 위반 여부',text:'다음 해에 받더라도 올해 주기 위반이 해소되는지는 정해진 기준을 찾지 못했어요. 관할 지방고용노동관서 확인.',source:'moel1350',status:'check'}
  ]
};
const STAGES={notice1:'1차 개별 안내',renotice:'미수검 재안내',final:'최종 통보',refusalCheck:'거부 의사 확인'};
const STAGE_SHORT={notice1:'1차',renotice:'재안내',final:'최종',refusalCheck:'거부확인'};
const CHANNELS={sms:'문자',email:'메일',messenger:'메신저',letter:'공문',verbal:'구두'};
const TEMPLATES={
  notice1:'{이름}님, 안녕하세요. {회사} {담당자}입니다.\n올해 일반건강검진 대상이세요. {마감일}까지 받아 주셔야 해요.\n· 검진기관 찾기: 국민건강보험공단 누리집·모바일 앱 또는 고객센터 1577-1000\n· 받으신 뒤 날짜만 알려 주세요.\n연말에는 예약이 몰려서 이번 달 안에 예약해 두시길 권해요.\n문의: {담당자} {담당자연락처}',
  notice1Check:'{이름}님, 안녕하세요. {회사} {담당자}입니다.\n올해 일반건강검진 대상인지 확인해 주세요. 대상이면 {마감일}까지 받아 주셔야 해요.\n· 대상 조회: 국민건강보험공단 누리집(www.nhis.or.kr) 또는 모바일 앱 「건강보험25시」의 건강검진 대상 조회, 고객센터 1577-1000\n· 조회 결과(대상/대상 아님)를 회신해 주시면 회사 기록에 반영할게요.\n문의: {담당자} {담당자연락처}',
  renotice:'{이름}님, {회사} {담당자}입니다.\n아직 올해 일반건강검진 수검 기록이 확인되지 않아 다시 안내드려요. 마감은 {마감일}이에요.\n이미 받으셨다면 수검일을, 예약하셨다면 예약일을 회신해 주세요.\n문의: {담당자} {담당자연락처}',
  final:'{이름}님, {회사} {담당자}입니다.\n올해 일반건강검진 마감({마감일})이 가까워 마지막으로 안내드려요. 산업안전보건법상 근로자도 건강진단을 받을 의무가 있어요(제133조).\n이 메시지를 받으셨다면 “확인했습니다”라고 회신 부탁드려요.\n문의: {담당자} {담당자연락처}',
  refusalCheck:'{이름}님, {회사} {담당자}입니다.\n올해 일반건강검진을 받기 어려운 사정(휴직·치료 중·회사 외 검진 수검 등)이 있으시면 사유를 알려 주세요. 사정에 맞게 공단 대상 변경 등을 확인해 드릴게요.\n마감: {마감일} / 문의: {담당자} {담당자연락처}'
};
function pad(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())}
function parseYmd(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return null;const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return ymd(d)===s?d:null}
function todayKST(now){const t=(now||new Date()).getTime()+9*3600e3;return ymd(new Date(t))}
function daysBetween(a,b){const A=parseYmd(a),B=parseYmd(b);if(!A||!B)return NaN;return Math.round((B-A)/864e5)}
const HOLIDAYS=['2026-12-25','2027-01-01'];
function businessDays(from,to){/* from 다음 날이 아니라 오늘 포함 ~ to 포함, 주말·공휴일(12/25, 1/1) 제외 */
  const A=parseYmd(from),B=parseYmd(to);if(!A||!B||B<A)return 0;let n=0;
  for(let d=new Date(A);d<=B;d.setUTCDate(d.getUTCDate()+1)){const w=d.getUTCDay();if(w&&w<6&&!HOLIDAYS.includes(ymd(d)))n++}return n}
function weekdayKo(s){const d=parseYmd(s);return d?'일월화수목금토'[d.getUTCDay()]:''}
/* 판정 */
const TARGETISH=['target','target_est','check'];
function judge(e,year){
  year=+year||2026; const by=+e.birthYear||0, yStr=String(year);
  if(e.special) return {code:'special',badge:'특수(관리 안 함)',reason:'특수건강진단 대상 업무로 표시됨 — 이 앱에서는 관리하지 않아요.'};
  if(e.lastCheckup&&String(e.lastCheckup).slice(0,4)===yStr) return {code:'done',badge:'완료',reason:`최근 일반검진일(${e.lastCheckup})이 ${year}년 안이에요.`};
  if(e.hireDate&&String(e.hireDate).slice(0,4)===yStr) return {code:'check',badge:'확인 필요',reason:'올해 입사자 — 중도 입사자는 입사일·회계연도 기준으로 판단해요. 회사·관할 노동관서 확인.'};
  if(e.jobType==='nonoffice') return {code:'target',badge:'대상',reason:'비사무직은 매년(1년에 1회 이상) 대상이에요.'};
  if(e.jobType!=='office') return {code:'check',badge:'확인 필요',reason:'사무/비사무 구분이 없어요.'};
  if(e.nhisTarget==='Y') return {code:'target',badge:'대상',reason:'공단 대상자 조회 결과 “대상(Y)”을 입력했어요.'};
  if(e.nhisTarget==='N') return {code:'nontarget',badge:'대상 아님',reason:'공단 대상자 조회 결과 “대상 아님(N)”을 입력했어요.'};
  if(by>1900){const same=(by%2)===(year%2);
    return same?{code:'target_est',badge:'대상(추정)',reason:`사무직 2년 1회 — ${by}년생(${by%2?'홀수':'짝수'})이 ${year}년(${year%2?'홀수':'짝수'})과 같아 대상으로 추정해요. 공단 사업장 대상자 조회로 확인.`}
               :{code:'nontarget_est',badge:'대상 아님(추정)',reason:`사무직 2년 1회 — ${by}년생(${by%2?'홀수':'짝수'})은 ${year}년(${year%2?'홀수':'짝수'}) 대상이 아닌 것으로 추정해요. 공단 사업장 대상자 조회로 확인.`};}
  return {code:'check',badge:'확인 필요',reason:'사무직인데 출생연도·공단 대상 여부가 없어요.'};
}
function effStatus(e,year){const j=judge(e,year);if(j.code==='done')return 'done';if(j.code==='special')return 'excluded';return e.status==='done'?'done':e.status==='booked'?'booked':'unbooked'}
function isTarget(e,year){const c=judge(e,year).code;return TARGETISH.includes(c)||c==='done'}
function pending(emps,year){return emps.filter(e=>{const c=judge(e,year).code;return (c==='target'||c==='target_est')&&effStatus(e,year)!=='done'})}
function fineExposure(n,level){level=[1,2,3].includes(+level)?+level:1;const per=RULES.fineEmployer[level];const raw=n*per;const cap=RULES.fineEmployerCap.amount;return {n,level,per,raw,capped:Math.min(raw,cap),hitCap:raw>cap}}
function flowFor(id,logs){const L=logs.filter(l=>l.employeeId===id);return {notice1:L.some(l=>l.stage==='notice1'),renotice:L.some(l=>l.stage==='renotice'||l.stage==='final'),received:L.some(l=>l.received)}}
function weekTasks(emps,logs,year,today){
  const P=emps.filter(e=>TARGETISH.includes(judge(e,year).code)&&effStatus(e,year)!=='done');
  const noNotice=P.filter(e=>effStatus(e,year)==='unbooked'&&!logs.some(l=>l.employeeId===e.id));
  const overdue=P.filter(e=>effStatus(e,year)==='booked'&&e.bookedDate&&e.bookedDate<today);
  const reno=P.filter(e=>{const L=logs.filter(l=>l.employeeId===e.id);const n1=L.filter(l=>l.stage==='notice1').map(l=>l.at.slice(0,10)).sort()[0];
    return n1&&daysBetween(n1,today)>=7&&!L.some(l=>l.stage!=='notice1')&&effStatus(e,year)==='unbooked'});
  return {noNotice,overdue,reno};
}
function tplFor(stage,e,year){if(stage==='notice1'&&judge(e,year).code==='check')return TEMPLATES.notice1Check;return TEMPLATES[stage]}
function fill(tpl,v){return tpl.replace(/\{(이름|회사|마감일|담당자|담당자연락처)\}/g,(m,k)=>(v[k]!=null&&v[k]!=='')?v[k]:m)}
function fmtDeadline(s){const d=parseYmd(s);return d?`${d.getUTCMonth()+1}월 ${d.getUTCDate()}일(${weekdayKo(s)})`:s}
function won(n){return Math.round(n).toLocaleString('ko-KR')+'원'}
/* 붙여 넣기 */
const COLS={name:['이름','성명','name'],dept:['부서','팀','dept'],jobType:['사무/비사무','사무구분','근무구분','직종','구분','jobtype'],birthYear:['출생연도','생년','출생','birthyear','생년월일'],hireDate:['입사일','입사','hiredate','자격취득일'],lastCheckup:['최근검진일','최근 일반검진일','검진일','lastcheckup'],contact:['연락처','전화','휴대폰','이메일','contact'],nhisTarget:['공단대상','공단 대상','공단 대상 여부','대상여부','nhis']};
function splitRow(line,delim){if(delim==='\t')return line.split('\t').map(s=>s.trim());const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'&&line[i+1]==='"'){cur+='"';i++}else if(c==='"')q=false;else cur+=c}else if(c==='"')q=true;else if(c===','){out.push(cur.trim());cur=''}else cur+=c}out.push(cur.trim());return out}
function detectDelim(text){return /\t/.test(text)?'\t':','}
function normHead(h){return String(h).replace(/\s/g,'').toLowerCase()}
function guessMap(head){return head.map(h=>{const n=normHead(h);for(const k in COLS)if(COLS[k].some(a=>normHead(a)===n))return k;for(const k in COLS)if(COLS[k].some(a=>n.includes(normHead(a))))return k;return ''})}
function parseTable(text){const lines=String(text||'').replace(/\r/g,'').split('\n').filter(l=>l.trim());if(!lines.length)return {delim:',',head:[],rows:[],map:[],hasHead:false};
  const delim=detectDelim(text);const rows=lines.map(l=>splitRow(l,delim));const map=guessMap(rows[0]);const hasHead=map.filter(Boolean).length>=2;
  return {delim,head:hasHead?rows[0]:rows[0].map((_,i)=>'열'+(i+1)),rows:hasHead?rows.slice(1):rows,map:hasHead?map:rows[0].map((_,i)=>['name','jobType','dept','birthYear'][i]||''),hasHead}}
function normJob(v){const s=String(v||'').replace(/\s/g,'').toLowerCase();if(!s)return '';if(/^(비사무|비사무직|non|nonoffice|생산|생산직|현장|현장직|물류|창고|영업직|2)$/.test(s)||s.startsWith('비사무'))return 'nonoffice';if(/^(사무|사무직|office|1)$/.test(s))return 'office';return ''}
function normDate(v){let s=String(v||'').trim().replace(/[.\/]/g,'-').replace(/-$/,'');if(/^\d{8}$/.test(s))s=s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6);const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);if(!m)return '';const r=m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);return parseYmd(r)?r:''}
function normBirth(v){const m=/(19|20)\d{2}/.exec(String(v||''));return m?+m[0]:''}
function rowsToEmployees(parsed,mapOverride){const map=mapOverride||parsed.map;const out=[],errors=[];
  parsed.rows.forEach((r,i)=>{const o={};map.forEach((k,j)=>{if(k)o[k]=r[j]||''});
    const e={name:(o.name||'').trim(),dept:(o.dept||'').trim(),jobType:normJob(o.jobType),birthYear:normBirth(o.birthYear),hireDate:normDate(o.hireDate),lastCheckup:normDate(o.lastCheckup),contact:(o.contact||'').trim(),nhisTarget:/^(y|예|대상|o)$/i.test((o.nhisTarget||'').trim())?'Y':/^(n|아니오|비대상|x)$/i.test((o.nhisTarget||'').trim())?'N':'',special:false,status:'unbooked',bookedDate:'',doneDate:''};
    if(!e.name){errors.push(`${i+1}행: 이름 없음`);return}
    if(!e.jobType)errors.push(`${i+1}행(${e.name}): 사무/비사무 확인 필요`);
    out.push(e)});return {employees:out,errors}}
function csvEscape(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function logsCsv(emps,logs){const by=Object.fromEntries(emps.map(e=>[e.id,e]));const rows=[['일시','이름','부서','차수','수단','수신확인','메모']];
  logs.slice().sort((a,b)=>a.at<b.at?-1:1).forEach(l=>{const e=by[l.employeeId]||{};rows.push([l.at.replace('T',' ').slice(0,16),e.name||'(삭제됨)',e.dept||'',STAGES[l.stage]||l.stage,CHANNELS[l.channel]||l.channel,l.received?'Y':'',l.memo||''])});
  return '\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n')}
const api={SRC,RULES,STAGES,STAGE_SHORT,CHANNELS,TEMPLATES,TARGETISH,parseYmd,ymd,todayKST,daysBetween,businessDays,weekdayKo,judge,effStatus,isTarget,pending,fineExposure,flowFor,weekTasks,tplFor,fill,fmtDeadline,won,parseTable,rowsToEmployees,normJob,normDate,normBirth,logsCsv,detectDelim};
if(typeof module!=='undefined')module.exports=api;else root.CK=api;
})(typeof self!=='undefined'?self:this);
