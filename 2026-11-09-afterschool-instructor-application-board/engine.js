/* 2027 출강 지원판 — 계산 엔진 (브라우저·Node 공용, 외부 의존 없음). 모든 날짜는 KST 달력 날짜 문자열 YYYY-MM-DD. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CG = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const DAY_KO = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
  const KO_DAY = { 월: 'mon', 화: 'tue', 수: 'wed', 목: 'thu', 금: 'fri', 토: 'sat', 일: 'sun' };
  const STATUSES = [
    ['interest', '관심'], ['preparing', '서류 준비'], ['submitted', '제출 완료'], ['doc_pass', '서류 합격'],
    ['interview', '면접'], ['final_pass', '최종 합격'], ['fail', '불합격'], ['contracted', '계약 완료']
  ];
  const METHODS = { post_arrival: '우편(도착분 기준)', post_postmark: '우편(소인 기준)', visit: '방문 제출', email: '이메일', online: '온라인(늘봄허브 등)' };

  /* ---------- 날짜·시각 ---------- */
  function date(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error('날짜 형식 오류: ' + s);
    const [y, m, d] = s.split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) throw Error('없는 날짜: ' + s);
    return t;
  }
  const fmt = t => t.toISOString().slice(0, 10);
  const make = (y, m, d) => { const s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; date(s); return s; };
  const addDays = (s, n) => { const t = date(s); t.setUTCDate(t.getUTCDate() + n); return fmt(t); };
  const diffDays = (a, b) => Math.round((date(b) - date(a)) / 864e5);
  const weekday = s => DAY_KEYS[date(s).getUTCDay()];
  function time(s) {
    if (typeof s !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw Error('시각 형식 오류: ' + s);
    return +s.slice(0, 2) * 60 + +s.slice(3);
  }
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  function today(now = new Date()) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const g = k => p.find(x => x.type === k).value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  }
  function nowKST(now = new Date()) {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    return { date: today(now), time: p };
  }
  const label = s => { const [, m, d] = s.split('-'); return `${+m}/${+d}(${DAY_KO[weekday(s)]})`; };
  /* 1년 유효: 검사일 기준 1년이 되는 날(해당일 없으면 그 달 말일)의 전날까지 — 보수적 계산 */
  function addYearsClamp(s, n) {
    const [y, m, d] = s.split('-').map(Number), last = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
    return make(y + n, m, Math.min(d, last));
  }

  /* ---------- 공휴일·영업일 ---------- */
  function isBiz(s, H) {
    if (s < H.from || s > H.through) throw Error(`공휴일 자료 범위(${H.from}~${H.through}) 밖 날짜예요. 달력으로 직접 확인하세요.`);
    const w = weekday(s);
    return w !== 'sat' && w !== 'sun' && !H.dates.includes(s);
  }
  function prevBizDays(s, n, H) {
    if (!Number.isInteger(n) || n < 0 || n > 15) throw Error('여유 영업일은 0~15 정수예요.');
    let d = s, k = 0;
    if (n === 0) { while (!isBiz(d, H)) d = addDays(d, -1); return d; }
    while (k < n) { d = addDays(d, -1); if (isBiz(d, H)) k++; }
    return d;
  }

  /* ---------- 공고 파서 ---------- */
  function normalize(text) {
    let t = String(text || '').normalize('NFKC').replace(/\r\n?/g, '\n');
    t = t.replace(/[∼〜～]/g, '~').replace(/[ㆍ・•]/g, '·').replace(/[–—―−]/g, '-').replace(/\u00a0/g, ' ');
    t = t.replace(/정오/g, '12:00');
    t = t.replace(/(오전|오후)?\s*(\d{1,2})\s*시(?!간)(?:\s*(\d{1,2})\s*분|\s*(반))?/g, (m, ap, h, mi, half) => {
      let H = +h; const M = half ? 30 : +(mi || 0);
      if (ap === '오후' && H < 12) H += 12; if (ap === '오전' && H === 12) H = 0;
      if (H > 23 || M > 59) return m;
      return hhmm(H * 60 + M);
    });
    return t;
  }
  function dateMentions(t, refDate) {
    const out = [], taken = [];
    const free = (a, b) => !taken.some(([x, y]) => a < y && x < b);
    const push = (idx, len, y, m, d, wd, explicitYear) => {
      if (!free(idx, idx + len)) return; taken.push([idx, idx + len]);
      out.push({ idx, len, y, m, d, wd, explicitYear });
    };
    let r = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*(?:일|\.)?(?:\s*\(\s*([월화수목금토일])(?:요일)?\s*\))?/g, m;
    while ((m = r.exec(t))) push(m.index, m[0].length, +m[1], +m[2], +m[3], m[4], true);
    r = /(?<![\d.])(\d{1,2})\s*월\s*(\d{1,2})\s*일(?:\s*\(\s*([월화수목금토일])(?:요일)?\s*\))?/g;
    while ((m = r.exec(t))) push(m.index, m[0].length, null, +m[1], +m[2], m[3], false);
    r = /(?<![\d.:])(\d{1,2})\s*[./]\s*(\d{1,2})\s*\.?\s*\(\s*([월화수목금토일])(?:요일)?\s*\)/g;
    while ((m = r.exec(t))) push(m.index, m[0].length, null, +m[1], +m[2], m[3], false);
    const fullYears = out.filter(x => x.explicitYear).map(x => { try { return make(x.y, x.m, x.d); } catch (e) { return null; } }).filter(Boolean).sort();
    const ref = fullYears[0] || refDate;
    const res = [];
    for (const x of out.sort((a, b) => a.idx - b.idx)) {
      const flags = [];
      let s = null;
      try {
        if (x.explicitYear) s = make(x.y, x.m, x.d);
        else {
          let y = +ref.slice(0, 4);
          s = make(y, x.m, x.d);
          if (s < addDays(ref, -60)) { y++; s = make(y, x.m, x.d); flags.push('연도 넘김 추정(' + y + ')'); }
          if (x.wd && DAY_KO[weekday(s)] !== x.wd) {
            for (const dy of [1, -1]) { const alt = make(y + dy, x.m, x.d); if (DAY_KO[weekday(alt)] === x.wd) { s = alt; flags.push('요일로 연도 보정'); break; } }
          }
        }
      } catch (e) { continue; }
      if (x.wd && DAY_KO[weekday(s)] !== x.wd) flags.push('요일 불일치 — 공고 확인');
      const after = t.slice(x.idx + x.len, x.idx + x.len + 14);
      const tm = /^\s*(?:\([월화수목금토일]\))?\s*,?\s*(\d{1,2}):(\d{2})(?!\s*[~\-]\s*\d{1,2}:\d{2})/.exec(after);
      let tt = null;
      if (tm && +tm[1] < 24 && +tm[2] < 60) tt = hhmm(+tm[1] * 60 + +tm[2]);
      const ls = t.lastIndexOf('\n', x.idx) + 1, le = t.indexOf('\n', x.idx), line = t.slice(ls, le < 0 ? undefined : le);
      res.push({ date: s, time: tt, idx: x.idx, line, flags });
    }
    return res;
  }
  const NEG = /면접|운영\s*능력|시연|심사|평가|발표|통보|계약\s*기간|운영\s*기간|공고\s*기간|교육\s*기간|합격|수업\s*기간|강의\s*기간|위탁\s*기간/;
  function scoreDeadline(x) {
    let s = 0; const l = x.line;
    if (/접수|원서|서류\s*제출|제출\s*기한|제출\s*기간/.test(l)) s += 3;
    if (/마감/.test(l)) s += 3;
    if (/까지/.test(l)) s += 2;
    if (/도착/.test(l)) s += 2;
    if (NEG.test(l)) s -= 6;
    return s;
  }
  function detectMethods(t) {
    const banned = new Set();
    const ban = /(우편|등기|팩스|FAX|이메일|전자\s*우편|방문|온라인)[^.\n]{0,14}?(불가|불인정|받지\s*않|인정하지\s*않)/gi;
    let m; while ((m = ban.exec(t))) {
      const seg = m[0];
      if (/우편|등기/.test(seg)) banned.add('post'); if (/이메일|전자\s*우편/.test(seg)) banned.add('email');
      if (/방문/.test(seg)) banned.add('visit'); if (/온라인/.test(seg)) banned.add('online');
    }
    const ms = [];
    if (!banned.has('post') && /우편|등기/.test(t)) ms.push(/소인/.test(t) && !/도착/.test(t) ? 'post_postmark' : 'post_arrival');
    if (!banned.has('visit') && /방문|직접\s*(?:제출|접수)|본인\s*(?:제출|접수)|(?:교무실|행정실)(?:로|에)?\s*(?:본인|직접)/.test(t)) ms.push('visit');
    if (!banned.has('email') && /이메일|e-?mail|전자\s*우편|[\w.+-]+@[\w-]+\.[\w.]+/i.test(t)) ms.push('email');
    if (!banned.has('online') && /늘봄허브|온라인\s*(?:접수|제출|등록)|인터넷\s*접수|홈페이지\s*(?:접수|등록)|웹\s*접수|구글\s*폼/.test(t)) ms.push('online');
    return { methods: ms, arrival: /도착\s*분|도착한\s*(?:서류|것|분)|도착\s*기준/.test(t), banned: [...banned] };
  }
  const SLOT_RE = /(?<![가-힣\d])((?:[월화수목금](?:요일)?\s*(?:[·,/、]|및|\s)\s*)*[월화수목금](?:요일)?)\s*(?:반)?[\s:/()]{0,4}(\d{1,2}:\d{2})\s*[~\-]\s*(\d{1,2}:\d{2})/g;
  function parseSlots(t) {
    const out = [];
    for (const line of t.split('\n')) {
      if (/면접|접수|발표|공고\s*기간|마감|도착/.test(line)) continue;
      let m; SLOT_RE.lastIndex = 0;
      while ((m = SLOT_RE.exec(line))) {
        let a, b;
        try { a = time(m[2].padStart(5, '0')); b = time(m[3].padStart(5, '0')); } catch (e) { continue; }
        if (b <= a || a < 7 * 60 || b > 22 * 60) continue;
        for (const ch of m[1].match(/[월화수목금]/g)) {
          const s = { day: KO_DAY[ch], start: hhmm(a), end: hhmm(b) };
          if (!out.some(o => o.day === s.day && o.start === s.start && o.end === s.end)) out.push(s);
        }
      }
    }
    return out;
  }
  function parsePay(t) {
    const num = s => +s.replace(/,/g, '');
    t = t.replace(/(?:1\s*)?시간\s*\(\s*차시\s*\)/g, '차시');
    const pay = {}; let m;
    if ((m = /(?:1\s*)?(시간|차시|회)\s*당\s*(?:강사료\s*)?([\d,]{4,})\s*원/.exec(t)) || (m = /강사료[^\n\d]{0,12}?(시간|차시|회)\s*당\s*([\d,]{4,})\s*원/.exec(t))) {
      pay.type = 'hourly'; pay.amount = num(m[2]); pay.unitWord = m[1];
    } else if ((m = /1\s*인\s*(?:당)?\s*(?:월)?\s*(?:수강료\s*)?([\d,]{4,})\s*원/.exec(t)) || (m = /수강료[^\n\d]{0,10}?월\s*([\d,]{4,})\s*원/.exec(t))) {
      pay.type = 'per_student'; pay.amount = num(m[1]);
    }
    if ((m = /(?:강사료|강사\s*몫|지급)[^\n%]{0,20}?(\d{1,3})\s*%/.exec(t)) && +m[1] <= 100) pay.sharePct = +m[1];
    if ((m = /주\s*(\d)\s*회/.exec(t))) pay.sessionsPerWeek = +m[1];
    if ((m = /총\s*(\d{1,2})\s*주|(\d{1,2})\s*주\s*(?:과정|간\s*운영|운영)|\(\s*(\d{1,2})\s*주\s*\)/.exec(t))) pay.weeks = +(m[1] || m[2] || m[3]);
    if ((m = /(\d{1,2})\s*개월/.exec(t))) pay.months = +m[1];
    if ((m = /(?:정원|모집\s*인원|예상\s*인원)[^\n\d]{0,6}(\d{1,3})\s*명/.exec(t))) pay.students = +m[1];
    return pay;
  }
  const DOC_WORD = /제안서|계획서|서류|확인서|동의서|증명서|사본|이력서|소개서|검사서|통보서|이수증|서약서|회보서|지원서|신청서|자격증|통장|신분증/;
  const DOC_HEAD = /제출\s*서류|구비\s*서류|제출\s*목록|서류\s*목록|(?:합격|계약)\s*(?:시|후)\s*(?:제출|구비)/;
  const ITEM = /^\s*(?:\d{1,2}\s*[.)]|[가-하]\s*[.)]|[○◦□■▶●]|-\s)/;
  function parseDocs(t, rules) {
    const lines = t.split('\n'), seg = [];
    let inSec = false, scoped = false;
    for (const l of lines) {
      if (DOC_HEAD.test(l)) { inSec = true; scoped = true; seg.push(l); continue; }
      if (inSec && ITEM.test(l) && !DOC_WORD.test(l)) inSec = false;
      if (inSec && /^\s*(?:\d{1,2}\s*\.\s*)?(?:기타|문의|유의\s*사항)/.test(l)) inSec = false;
      if (inSec) seg.push(l);
    }
    const body = scoped ? seg.join('\n') : t;
    const keys = [];
    for (const d of rules.docs) if (d.keywords.some(k => body.includes(k))) keys.push(d.key);
    if (keys.includes('crime_report') && keys.includes('consent_crime') && !/동의서/.test(body)) keys.splice(keys.indexOf('consent_crime'), 1);
    if (keys.includes('latent_tb') && keys.includes('tb_result') && !/결핵검진\s*결과/.test(body)) keys.splice(keys.indexOf('tb_result'), 1);
    if (keys.includes('latent_tb') && keys.includes('health_alt') && !/건강검진\s*대체|대체\s*통보서|건강검진(?!\s*확인)/.test(body.replace(/잠복결핵감염검진/g, ''))) keys.splice(keys.indexOf('health_alt'), 1);
    return { keys, scoped };
  }
  function parseSchool(t) {
    let m = /(?:학교명|기관명)\s*[:]\s*([^\n,(]{2,30})/.exec(t);
    if (m) return { value: m[1].trim(), confidence: 'high' };
    m = /([가-힣A-Za-z0-9]{2,20}(?:초등학교|중학교|고등학교))/.exec(t);
    if (m && !/^(?:각|해당|본|우리)/.test(m[1])) return { value: m[1], confidence: 'high' };
    m = /(?:^|[\s<「(\[])([가-힣]{2,10}(?:초|중|고))(?=[\s,.)\]>·」]|에서|의|는|$)/m.exec(t);
    if (m) return { value: m[1], confidence: 'low' };
    return { value: '', confidence: 'missing' };
  }
  function parseProgram(t) {
    let m = /(?:모집\s*분야|모집\s*과목|프로그램\s*명|프로그램|강좌\s*명|강좌|과목)\s*[:]\s*([^\n]{1,40})/.exec(t);
    if (m) {
      const v = m[1].replace(/\s*\d+\s*명.*$/, '').replace(/\s*[(\[].*$/, '').replace(/[,/].*$/, '').trim();
      if (v) return { value: v.slice(0, 30), confidence: 'high' };
    }
    m = /(?:방과후(?:학교)?|늘봄(?:학교)?)\s*([가-힣A-Za-z0-9 ]{2,20}?)\s*(?:외부)?\s*강사\s*(?:모집|공모|채용)/.exec(t);
    if (m && !/개인위탁|프로그램$/.test(m[1].trim())) return { value: m[1].trim(), confidence: 'low' };
    return { value: '', confidence: 'missing' };
  }
  function parseNotice(text, opts) {
    const rules = opts.rules, ref = opts.today;
    const t = normalize(text);
    const warnings = [];
    if (t.trim().length < 15) return { ok: false, reason: '붙여 넣은 글이 너무 짧아요.', fields: null, warnings };
    const ds = dateMentions(t, ref);
    const school = parseSchool(t), program = parseProgram(t);
    const mt = detectMethods(t);
    const cands = ds.map(x => ({ ...x, score: scoreDeadline(x) })).filter(x => x.score >= 2);
    cands.sort((a, b) => b.score - a.score || (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    let deadline = null, postArrival = null;
    if (cands.length) {
      const top = cands[0].score, lineBest = cands.filter(x => x.score === top);
      lineBest.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
      const pick = lineBest[0];
      deadline = { date: pick.date, time: pick.time, confidence: pick.flags.length || !pick.time ? 'low' : 'high', flags: pick.flags.slice() };
      if (!pick.time) deadline.flags.push('마감 시각 미기재 — 공고 확인');
    }
    const arr = ds.filter(x => /도착/.test(x.line));
    if (arr.length) { const a = arr[arr.length - 1]; postArrival = { date: a.date, time: a.time, confidence: a.time && !a.flags.length ? 'high' : 'low', flags: a.flags.slice() }; }
    const isIv = l => /면접|운영\s*능력|시연/.test(l) && !/(?:합격자|결과|최종)\s*(?:발표|공고)/.test(l);
    const iv = ds.filter(x => isIv(x.line));
    const rs = ds.filter(x => /발표|통보|합격자|결과/.test(x.line) && !/접수|도착/.test(x.line) && !isIv(x.line));
    const interview = iv.length ? { date: iv[0].date, time: iv[0].time, confidence: iv[0].time ? 'high' : 'low', flags: iv[0].flags.slice() } : null;
    const result = rs.length ? { date: rs[rs.length - 1].date, confidence: 'low', flags: rs[rs.length - 1].flags.slice() } : null;
    const slots = parseSlots(t);
    const pay = parsePay(t);
    const docs = parseDocs(t, rules);
    if (!deadline) warnings.push('접수 마감 날짜를 찾지 못했어요.');
    if (!school.value) warnings.push('학교명을 찾지 못했어요.');
    if (!mt.methods.length) warnings.push('제출 방법(우편·방문·이메일·온라인)을 찾지 못했어요.');
    if (!slots.length) warnings.push('수업 요일·시간을 찾지 못했어요.');
    if (!docs.scoped && docs.keys.length) warnings.push('‘제출 서류’ 항목을 찾지 못해 본문 전체에서 서류 이름을 찾았어요. 목록을 확인하세요.');
    if (pay.unitWord === '시간') warnings.push('‘시간당’이 60분인지 1차시(회)인지 공고·학교에 확인하세요.');
    const ok = !!(deadline && school.value);
    return {
      ok, reason: ok ? '' : '마감 날짜나 학교명을 자동으로 찾지 못했어요. 아래에 직접 입력해 저장할 수 있어요.',
      fields: { school, program, deadline, postArrival, methods: mt.methods, arrivalRule: mt.arrival, bannedMethods: mt.banned, interview, result, slots, pay, docs: docs.keys, docsScoped: docs.scoped },
      warnings
    };
  }

  /* ---------- 마감 역산 ---------- */
  function backCalc(app, settings, H, todayStr) {
    const method = app.submitMethod, notes = [], warnings = [];
    const base = method === 'post_arrival' && app.postArrival && app.postArrival.date ? app.postArrival : app.deadline;
    if (!base || !base.date) return { error: '마감 날짜가 없어요. 공고를 보고 직접 입력하세요.' };
    const res = { method, deadlineDate: base.date, deadlineTime: base.time || null, notes, warnings };
    if (!base.time) warnings.push('마감 시각이 없어요. 공고 원문을 확인하세요. 알림은 보수적으로 09:00으로 잡아요.');
    try {
      if (method === 'post_arrival') {
        const n = settings.postalBufferBizDays;
        res.sendBy = prevBizDays(base.date, n, H);
        notes.push(`도착분 기준이라 마감일 앞 ${n}영업일(주말·공휴일 제외) 전에 보내도록 계산했어요. ${n}영업일은 이 앱의 기본 여유이고 규정이 아니에요(설정에서 변경).`);
        if (base.time && time(base.time) < 12 * 60) notes.push('마감 시각이 오전이에요. 당일 배달로는 늦을 수 있으니 하루 더 여유를 두는 것도 생각해 보세요.');
        notes.push('등기 접수 마감 시각은 우체국마다 달라요.');
      } else if (method === 'post_postmark') {
        res.sendBy = base.date;
        notes.push('소인 기준이면 마감일 우체국 접수까지 인정되는지 공고 문구를 다시 확인하세요.');
      } else if (method === 'visit') {
        if (!isBiz(base.date, H)) warnings.push('마감일이 주말·공휴일이에요. 그날 방문 접수가 되는지 학교에 확인하세요.');
        notes.push('방문 제출은 점심시간(예: 12~13시) 접수 제외 여부를 공고에서 확인하세요.');
      } else if (method === 'email' || method === 'online') {
        const t = base.time ? time(base.time) : 9 * 60;
        const r = t - 60;
        res.remindAt = r >= 0 ? { date: base.date, time: hhmm(r) } : { date: addDays(base.date, -1), time: hhmm(r + 1440) };
        notes.push('마감 1시간 전 알림을 권장해요. 마감일에는 접속이 몰릴 수 있어요(서울시교육청 늘봄허브 공지).');
        if (method === 'email') notes.push('수신 확인 회신을 요청하거나 보낸메일함 기록을 남겨 두세요.');
      } else return { error: '제출 방법을 골라 주세요.' };
    } catch (e) { return { error: e.message }; }
    const action = res.sendBy || base.date;
    res.actionDate = action;
    res.dday = diffDays(todayStr, action);
    res.deadlineDday = diffDays(todayStr, base.date);
    if (res.deadlineDday < 0) res.state = 'past';
    else if (res.sendBy && diffDays(todayStr, res.sendBy) < 0) { res.state = 'late_send'; warnings.push('권장 발송일이 지났어요. 방문 제출이나 다른 방법이 되는지 학교에 문의하세요.'); }
    else res.state = 'open';
    return res;
  }

  /* ---------- 서류 금고 ---------- */
  function docStatus(doc, rule, ctx) {
    const out = { key: rule.key, label: rule.label, have: !!(doc && doc.have) };
    if (!doc || !doc.have) return { ...out, status: 'none', text: '없음' };
    if (rule.lifetime) return { ...out, status: 'valid', text: '보유(생애 1회 검진)' };
    if (rule.validYears) {
      if (!doc.issuedAt) return { ...out, status: 'unknown', text: '검사일을 넣으면 만료를 계산해요' };
      const anniv = addYearsClamp(doc.issuedAt, rule.validYears), last = addDays(anniv, -1);
      Object.assign(out, { anniversary: anniv, lastValid: last });
      if (last < ctx.today) return { ...out, status: 'expired', text: `만료(마지막 유효일 ${last})` };
      if (ctx.contractDate && last < ctx.contractDate) return { ...out, status: 'expires_before_contract', text: `계약 기준일 ${ctx.contractDate} 전에 만료(${last})` };
      if (diffDays(ctx.today, last) <= 30) return { ...out, status: 'soon', text: `곧 만료(${last})` };
      return { ...out, status: 'valid', text: `유효 · ${last}까지` };
    }
    if (rule.tbAfterYears) {
      if (!doc.issuedAt) return { ...out, status: 'unknown', text: '검진일을 넣으면 결핵검진 추가 여부를 알려 줘요' };
      const cut = addYearsClamp(doc.issuedAt, rule.tbAfterYears);
      Object.assign(out, { tbCut: cut });
      const ref = ctx.contractDate && ctx.contractDate > ctx.today ? ctx.contractDate : ctx.today;
      if (ref > cut) return { ...out, status: 'needs_tb', text: `기준일 ${ref}엔 검진 1년 초과 → 결핵검진 결과서 추가 필요` };
      return { ...out, status: 'valid', text: `${cut}까지 결핵검진 추가 없이 사용(공고 우선)` };
    }
    if (rule.flag === 'pqi' && !doc.pqi) return { ...out, status: 'check', text: '보유 · 민간자격이면 pqi.or.kr 등록 여부 확인' };
    return { ...out, status: 'valid', text: '보유' };
  }
  function crimePrint(requestedAt, rule) {
    date(requestedAt);
    const days = rule.printDays;
    return { plusDays: addDays(requestedAt, days), conservative: addDays(requestedAt, days - 1), days };
  }
  const ANY_OF = [['medical_cert', 'health_alt']];
  function missingDocs(app, vault, rules, ctx) {
    const miss = [], req = app.requiredDocs || [];
    const okVault = key => { const r = rules.docs.find(d => d.key === key); const st = docStatus(vault[key], r, ctx).status; return !['none', 'expired', 'expires_before_contract', 'needs_tb'].includes(st); };
    for (const key of req) {
      const r = rules.docs.find(d => d.key === key); if (!r) continue;
      const grp = ANY_OF.find(g => g.includes(key) && g.filter(k => req.includes(k)).length > 1);
      if (grp && grp.some(k => k !== key && req.includes(k) && okVault(k))) continue;
      if (r.scope === 'per_application') {
        if (!(app.prepared && app.prepared[key])) miss.push({ key, label: r.label, reason: '이 학교용으로 아직 준비 안 함' });
      } else {
        const s = docStatus(vault[key], r, ctx);
        if (s.status === 'none') miss.push({ key, label: r.label, reason: '서류 금고에 없음' });
        else if (s.status === 'expired' || s.status === 'expires_before_contract' || s.status === 'needs_tb') miss.push({ key, label: r.label, reason: s.text });
      }
    }
    return miss;
  }

  /* ---------- 시간표·충돌 ---------- */
  const travelMin = (travel, a, b) => {
    if (a === b) return 0;
    const t = (travel || []).find(x => (x.from === a && x.to === b) || (x.from === b && x.to === a));
    return t ? t.minutes : null;
  };
  function timetableItems(classes, apps, includeApps) {
    const items = [];
    for (const c of classes) items.push({ kind: 'current', id: c.id, school: c.school, label: c.program || '', day: c.day, start: time(c.start), end: time(c.end) });
    if (includeApps) for (const a of apps) if (!['fail'].includes(a.status)) (a.slots || []).forEach((s, i) => items.push({ kind: 'app', id: a.id + ':' + i, appId: a.id, school: a.school, label: a.program || '', day: s.day, start: time(s.start), end: time(s.end) }));
    return items;
  }
  function conflicts(items, travel) {
    const overlaps = [], travelIssues = [], missingTravel = [];
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri']) {
      const xs = items.filter(i => i.day === day).sort((a, b) => a.start - b.start || a.end - b.end);
      for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
        const a = xs[i], b = xs[j];
        if (a.start < b.end && b.start < a.end) overlaps.push({ day, a, b, minutes: Math.min(a.end, b.end) - Math.max(a.start, b.start) });
      }
      for (let i = 0; i + 1 < xs.length; i++) {
        const a = xs[i], b = xs[i + 1];
        if (a.school === b.school || b.start < a.end) continue;
        const need = travelMin(travel, a.school, b.school), gap = b.start - a.end;
        if (need == null) missingTravel.push({ day, a, b, gap });
        else if (gap < need) travelIssues.push({ day, a, b, gap, need });
      }
    }
    return { overlaps, travelIssues, missingTravel };
  }
  function interviewConflicts(apps, classes, travel) {
    const out = [];
    for (const a of apps) {
      if (!a.interview || !a.interview.date || !a.interview.time || ['fail', 'contracted'].includes(a.status)) continue;
      const s = time(a.interview.time), e = s + (a.interview.duration || 60), day = weekday(a.interview.date);
      for (const c of classes) {
        if (c.day !== day) continue;
        const cs = time(c.start), ce = time(c.end), buf = travelMin(travel, c.school, a.school) || 0;
        if (cs < e + buf && s < ce + buf) out.push({ app: a, cls: c, date: a.interview.date, start: hhmm(s), end: hhmm(e), withTravel: buf > 0 && !(cs < e && s < ce) });
      }
    }
    return out;
  }
  function requestText(c, teacher) {
    return `안녕하세요, ${c.app.school} 방과후 강사 지원자${teacher ? ' ' + teacher : ''}입니다. 안내해 주신 면접 일정(${label(c.date)} ${c.start})이 현재 출강 중인 수업(${DAY_KO[c.cls.day]} ${c.cls.start}~${c.cls.end}) 시간과 겹칩니다. 가능하시다면 같은 날 ${c.cls.end} 이후나 다른 시간으로 조정이 가능할지 여쭙습니다. 어려우시면 안내해 주시는 대로 따르겠습니다. 감사합니다.`;
  }

  /* ---------- 수입·조합 ---------- */
  function appIncome(a) {
    const p = a.pay || {}, n = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);
    if (p.type === 'hourly') {
      const amt = n(p.amount), weeks = n(p.weeks), per = n(p.sessionsPerWeek) || (a.slots || []).length;
      if (amt == null || !weeks || !per) return { amount: null, why: '강사료·주 회차·학기 주수를 넣으면 계산해요' };
      let unit = amt, f = `${amt.toLocaleString('ko-KR')}원 × 주 ${per}회 × ${weeks}주`;
      if (p.unit === 'hour60') {
        const mins = (a.slots || []).reduce((s, x) => s + time(x.end) - time(x.start), 0) / Math.max(1, (a.slots || []).length);
        unit = Math.round(amt * mins / 60); f = `${amt.toLocaleString('ko-KR')}원 × ${Math.round(mins)}분/60 × 주 ${per}회 × ${weeks}주`;
      }
      return { amount: Math.round(unit * per * weeks), formula: f };
    }
    if (p.type === 'per_student') {
      const amt = n(p.amount), st = n(p.students), mo = n(p.months), sh = p.sharePct == null ? 100 : n(p.sharePct);
      if (amt == null || !st || !mo || sh == null) return { amount: null, why: '1인 월 수강료·예상 인원·개월·강사 몫을 넣으면 계산해요' };
      return { amount: Math.round(amt * st * mo * sh / 100), formula: `${amt.toLocaleString('ko-KR')}원 × ${st}명 × ${mo}개월 × ${sh}%` };
    }
    return { amount: null, why: '강사료 유형을 고르세요' };
  }
  function combos(apps, classes, travel, limit = 3) {
    const cand = apps.filter(a => !['fail'].includes(a.status) && (a.slots || []).length).slice(0, 14);
    const base = timetableItems(classes, [], false);
    const res = [];
    for (let mask = 1; mask < (1 << cand.length); mask++) {
      const chosen = cand.filter((_, i) => mask & (1 << i));
      const items = base.concat(timetableItems([], chosen, true));
      const c = conflicts(items, travel);
      if (c.overlaps.length) continue;
      let income = 0, unknown = 0, minutes = 0;
      for (const a of chosen) { const x = appIncome(a); if (x.amount == null) unknown++; else income += x.amount; minutes += a.slots.reduce((s, y) => s + time(y.end) - time(y.start), 0); }
      const travelTotal = travelSum(items, travel);
      res.push({ apps: chosen, income, unknown, weeklyMinutes: minutes, travelMinutes: travelTotal, travelShort: c.travelIssues.length, missingTravel: c.missingTravel.length });
    }
    res.sort((a, b) => b.income - a.income || a.unknown - b.unknown || b.weeklyMinutes - a.weeklyMinutes || a.travelMinutes - b.travelMinutes || a.apps.length - b.apps.length);
    return { top: res.slice(0, limit), total: res.length, capped: apps.filter(a => !['fail'].includes(a.status) && (a.slots || []).length).length > 14 };
  }
  function travelSum(items, travel) {
    let s = 0;
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri']) {
      const xs = items.filter(i => i.day === day).sort((a, b) => a.start - b.start);
      for (let i = 0; i + 1 < xs.length; i++) if (xs[i].school !== xs[i + 1].school) s += travelMin(travel, xs[i].school, xs[i + 1].school) || 0;
    }
    return s;
  }

  /* ---------- 제안서 점검 ---------- */
  function schoolVariants(name) {
    const n = String(name || '').trim(); if (n.length < 2) return [];
    const v = new Set([n]);
    const m = /^(.+?)(초등학교|중학교|고등학교)$/.exec(n);
    if (m) { v.add(m[1] + { 초등학교: '초', 중학교: '중', 고등학교: '고' }[m[2]]); }
    const s = /^(.+?)(초|중|고)$/.exec(n);
    if (s && !m) v.add(s[1] + { 초: '초등학교', 중: '중학교', 고: '고등학교' }[s[2]]);
    return [...v].filter(x => x.length >= 3);
  }
  function proposalCheck(text, app, apps) {
    const body = String(text || '');
    const own = schoolVariants(app.school);
    const foreign = [];
    for (const o of apps) {
      if (o.id === app.id) continue;
      for (const v of schoolVariants(o.school)) {
        if (own.some(w => w.includes(v) || v.includes(w))) continue;
        if (body.includes(v)) { if (!foreign.some(f => f.includes(v) || v.includes(f))) foreign.push(v); break; }
      }
    }
    return { foreign, ownMissing: body.trim() !== '' && own.length > 0 && !own.some(v => body.includes(v)) };
  }

  /* ---------- 개인정보 보호 ---------- */
  const rrnLike = s => /(?<!\d)\d{6}\s*-?\s*[1-8]\d{6}(?!\d)/.test(String(s || ''));

  /* ---------- ICS ---------- */
  const escText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    const out = []; let cur = '', bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.map((l, i) => (i ? ' ' + l : l)).join('\r\n');
  }
  function utc(d, t) { const [y, m, dd] = d.split('-').map(Number), mi = time(t); return new Date(Date.UTC(y, m - 1, dd, Math.floor(mi / 60) - 9, mi % 60)); }
  const stamp = x => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function ics(events, now = new Date()) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//chulgang 2027//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const e of events) {
      const st = utc(e.date, e.time || '09:00'), en = new Date(st.getTime() + (e.minutes || 30) * 60000);
      L.push('BEGIN:VEVENT', 'UID:' + e.uid + '@chulgang.webapp-daily', 'DTSTAMP:' + stamp(now), 'DTSTART:' + stamp(st), 'DTEND:' + stamp(en), 'SUMMARY:' + escText(e.title));
      if (e.desc) L.push('DESCRIPTION:' + escText(e.desc));
      for (const tr of e.alarms || ['-P1D']) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escText(e.title), 'TRIGGER:' + tr, 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function appEvents(app, calc) {
    const ev = [], who = `${app.school}${app.program ? ' ' + app.program : ''}`, src = '앱 계산 · 최종 기준은 학교 공고문';
    if (calc && !calc.error) {
      if (calc.sendBy) ev.push({ uid: app.id + '-send', date: calc.sendBy, time: '09:00', title: `[발송 권장] ${who}`, desc: `우편 발송 권장일(${METHODS[app.submitMethod]}). ${src}` });
      ev.push({ uid: app.id + '-deadline', date: calc.deadlineDate, time: calc.deadlineTime || '09:00', title: `[마감] ${who}`, desc: (calc.deadlineTime ? '' : '마감 시각 미기재 → 09:00로 보수 표시. ') + src, alarms: calc.remindAt ? ['-P1D', '-PT1H'] : ['-P1D'] });
    }
    if (app.interview && app.interview.date) ev.push({ uid: app.id + '-interview', date: app.interview.date, time: app.interview.time || '09:00', minutes: app.interview.duration || 60, title: `[면접] ${who}`, desc: (app.interview.time ? '' : '면접 시각 미정 → 09:00 표시. ') + src });
    if (app.resultAt) ev.push({ uid: app.id + '-result', date: app.resultAt, time: '09:00', title: `[발표] ${who}`, desc: '발표 예정일. ' + src });
    return ev;
  }

  /* ---------- 자체 점검 ---------- */
  function selfTest(H, rules) {
    const T = [], ck = (n, v) => T.push({ name: n, pass: !!v });
    const p = s => parseNotice(s, { today: '2026-11-09', rules });
    ck('2026. 11. 17.(화) 17:00까지', (x => x.fields.deadline.date === '2026-11-17' && x.fields.deadline.time === '17:00')(p('예시초등학교 공고\n접수 마감: 2026. 11. 17.(화) 17:00까지')));
    ck('2026-11-17', p('예시초등학교\n서류 접수 마감 2026-11-17').fields.deadline.date === '2026-11-17');
    ck('11월 17일(화) 17:00', (x => x.fields.deadline.date === '2026-11-17' && x.fields.deadline.time === '17:00')(p('예시초등학교\n접수: 11월 17일(화) 17:00까지')));
    ck('우편 도착분', (x => x.fields.postArrival.date === '2026-11-17' && x.fields.postArrival.time === '17:00' && x.fields.arrivalRule)(p('예시초등학교\n※ 우편 접수시 11월 17일 17:00 도착분에 한하여 인정')));
    ck('발송 권장 11/13', prevBizDays('2026-11-17', 2, H) === '2026-11-13');
    ck('성탄 건너뜀', prevBizDays('2026-12-28', 2, H) === '2026-12-23');
    ck('신정·연도 넘김', prevBizDays('2027-01-04', 2, H) === '2026-12-30');
    ck('설 연휴', prevBizDays('2027-02-10', 2, H) === '2027-02-04');
    ck('신체검사 1년', docStatus({ have: true, issuedAt: '2026-01-20' }, rules.docs.find(d => d.key === 'medical_cert'), { today: '2026-11-09', contractDate: '2027-03-02' }).lastValid === '2027-01-19');
    ck('회보서 +5일', crimePrint('2026-11-10', rules.docs.find(d => d.key === 'crime_report')).plusDays === '2026-11-15');
    ck('겹침 탐지', conflicts([{ school: 'A', day: 'tue', start: 820, end: 860 }, { school: 'B', day: 'tue', start: 840, end: 920 }], []).overlaps.length === 1);
    ck('주민번호 패턴', rrnLike('900101-1234567') && !rrnLike('2026-11-17'));
    return { passed: T.filter(x => x.pass).length, total: T.length, tests: T };
  }

  return { DAY_KO, KO_DAY, STATUSES, METHODS, date, make, addDays, diffDays, weekday, time, hhmm, today, nowKST, label, addYearsClamp, isBiz, prevBizDays, normalize, dateMentions, detectMethods, parseSlots, parsePay, parseDocs, parseSchool, parseProgram, parseNotice, backCalc, docStatus, crimePrint, missingDocs, travelMin, timetableItems, conflicts, interviewConflicts, requestText, appIncome, combos, schoolVariants, proposalCheck, rrnLike, escText, fold, utc, ics, appEvents, selfTest };
});
