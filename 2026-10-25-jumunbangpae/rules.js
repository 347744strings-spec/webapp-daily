/* 주문방패 — 순수 규칙·계산 모듈 (DOM 없음, node에서 require 가능) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JMBP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 1;
  var STORAGE_KEY = 'jumunbangpae.v1';
  var APP_URL = 'https://347744strings-spec.github.io/webapp-daily/2026-10-25-jumunbangpae/';

  // ---------- 9-3 점검 문항 ----------
  var QUESTIONS = [
    { id: 'Q1', w: 40, critical: true, html: '매장에서 팔지 않는 물건(술·고기·물품 등)을 <b>대신 사 달라</b>거나, 다른 업체에 <b>먼저 결제해 달라</b>고 했나요?',
      label: '대리구매·선결제 요청', reason: '정상적인 기관·기업은 거래처 대금을 매장에 대신 내 달라고 하지 않아요.' },
    { id: 'Q2', w: 40, critical: true, html: '자기가 <b>지정한 업체나 계좌로 돈을 보내 달라</b>고 했나요?',
      label: '지정 업체·계좌 송금 요청', reason: '상대가 고른 계좌로 돈이 나가면 되돌리기 어려워요. 거래를 멈추고 확인하세요.' },
    { id: 'Q3', w: 10, html: '공공기관·군부대·대기업·연예인 매니저 등 <b>소속이나 직함</b>을 내세웠나요?',
      label: '소속·직함 강조', reason: '믿음을 주려고 기관·직함을 먼저 내세우는 경우가 많아요.' },
    { id: 'Q4', w: 10, html: '<b>공문·명함 사진</b>을 문자로 보내왔거나, 주문 <b>영수증 사진을 보내 달라</b>고 했나요?',
      label: '공문·명함·영수증 사진', reason: '공문과 명함은 위조될 수 있어요. 사진만으로는 확인이 안 돼요.' },
    { id: 'Q5', w: 15, html: '연락처가 <b>개인 휴대폰뿐</b>이고, 기관 대표번호로 확인하는 것을 꺼리나요?',
      label: '개인 휴대폰만 제시', reason: '진짜 주문이라면 기관 대표번호로 확인해도 문제가 없어요.' },
    { id: 'Q6', w: 15, html: '<b>예약금·선결제를 거부</b>하거나 "나중에 <b>한꺼번에 정산</b>하겠다"고 했나요?',
      label: '예약금 거부·일괄 정산', reason: '"나중에 한 번에 정산"은 준비 비용을 매장이 떠안게 만드는 흔한 말이에요.' },
    { id: 'Q7', w: 10, html: '평소 받던 단체 주문보다 <b>훨씬 큰 규모</b>인가요?',
      label: '평소보다 큰 규모', reason: '큰 매출 기대가 판단을 흐리게 만들 수 있어요.' },
    { id: 'Q8', w: 5, html: '오늘이나 내일처럼 <b>일정이 아주 급한가요</b>?',
      label: '급한 일정', reason: '시간을 촉박하게 잡으면 확인할 여유가 줄어요.' },
    { id: 'Q9', w: 5, html: '<b>처음 주문하는</b> 손님인가요?',
      label: '처음 주문하는 손님', reason: '거래 이력이 없으면 확인이 더 필요해요.' },
    { id: 'Q10', w: -30, html: '명함 번호가 아닌 <b>기관 공식 대표번호로 직접 전화해</b> 주문이 사실임을 확인했나요?',
      label: '공식 대표번호로 확인', reason: '공식 대표번호로 주문 사실을 확인했어요.' }
  ];
  var QMAP = {}; QUESTIONS.forEach(function (q) { QMAP[q.id] = q; });
  var ANSWERS = ['yes', 'no', 'unknown'];

  function evaluate(answers) {
    answers = answers || {};
    var critical = answers.Q1 === 'yes' || answers.Q2 === 'yes';
    var raw = 0, signals = [], unknowns = [], verified = answers.Q10 === 'yes';
    QUESTIONS.forEach(function (q) {
      var a = answers[q.id];
      if (a === 'yes') {
        if (q.w < 0) { if (!critical) raw += q.w; }
        else { raw += q.w; signals.push(q.id); }
      } else if (a === 'unknown') unknowns.push(q.id);
    });
    var score = Math.max(0, raw);
    var level = critical ? 'red' : score >= 30 ? 'red' : score >= 15 ? 'yellow' : 'green';
    return { critical: critical, raw: raw, score: score, level: level, signals: signals, unknowns: unknowns, verified: verified,
      verifyIgnored: critical && verified };
  }
  // 결정적 문항에서 yes면 남은 문항을 건너뜀
  function shouldStop(qid, answer) { return !!(QMAP[qid] && QMAP[qid].critical && answer === 'yes'); }
  function nextIndex(i, qid, answer) { return shouldStop(qid, answer) ? -1 : (i + 1 < QUESTIONS.length ? i + 1 : -1); }
  // 화면용 막대 비율 (0~100)
  function barPct(ev) { return ev.critical ? 100 : Math.min(100, Math.round(ev.score / 60 * 100)); }

  var LEVELS = {
    red_critical: { emoji: '🔴', name: '빨강', title: '멈추세요. 전형적인 사칭 노쇼 사기 수법입니다.',
      sub: '돈은 보내지 마세요. 대리구매·대납 요청은 정중히 거절하면 돼요.',
      todo: ['돈을 보내지 마세요', '거절 문자를 보내세요', '이미 보냈다면 즉시 112와 은행에 신고하세요'],
      primary: 'refuse' },
    red: { emoji: '🔴', name: '빨강', title: '위험 신호가 많아요. 확인 전까지 준비를 시작하지 마세요.',
      sub: '공식 대표번호로 확인하고, 예약금이 들어온 뒤에 준비해도 늦지 않아요.',
      todo: ['공식 대표번호로 확인', '예약금 요청', '예약금이 들어오기 전엔 재료 준비 보류'], primary: 'verify' },
    yellow: { emoji: '🟡', name: '노랑', title: '확인이 필요해요.',
      sub: '예약금과 공식 번호 확인, 두 가지만 챙기면 대부분 걸러져요.',
      todo: ['예약금 요청', '공식 번호 확인', '장부에 기록'], primary: 'deposit' },
    green: { emoji: '🟢', name: '초록', title: '큰 위험 신호는 없어요. 그래도 예약금은 받아두세요.',
      sub: '평소처럼 진행하되, 대리구매 이야기가 나오면 다시 점검하세요.',
      todo: ['예약금 요청', '장부에 기록', '대리구매 요청이 나오면 다시 점검'], primary: 'deposit' }
  };
  function levelInfo(ev) { return ev.critical ? LEVELS.red_critical : LEVELS[ev.level]; }
  var DISCLAIMER = '점검 결과는 참고용입니다. 초록이어도 사기가 아니라는 보장은 없으며, 피해가 의심되면 112에 신고하세요.';

  // ---------- 예약금 ----------
  function deposit(orderAmount, depositPct) {
    if (!isNum(orderAmount) || orderAmount <= 0 || !isNum(depositPct)) return null;
    return Math.round(orderAmount * depositPct / 100 / 1000) * 1000;
  }

  // ---------- 9-4 문자 템플릿 (원문 그대로) ----------
  var TEMPLATES = {
    deposit: { name: '예약금 요청', emoji: '💰',
      text: '안녕하세요, {storeName}입니다. 단체 주문 감사합니다. 저희 매장은 단체 주문 시 예약금을 먼저 받고 준비를 시작합니다. 예약금 {deposit}원을 {accountText}로 보내주시면 바로 준비하겠습니다. 입금이 확인되지 않으면 준비가 어려운 점 양해 부탁드립니다. - {signature}' },
    refuse: { name: '대리구매·대납 거절', emoji: '✋',
      text: '안녕하세요, {storeName}입니다. 저희 매장은 매장에서 판매하지 않는 물품의 대리구매, 다른 업체 대금 대납, 지정 계좌 송금을 하지 않습니다. 매장 메뉴 주문만 예약금 입금 후 진행 가능합니다. - {signature}' },
    verify: { name: '기관 확인 안내', emoji: '📞',
      text: '안녕하세요, {storeName}입니다. 단체 주문은 소속 기관 대표번호로 주문 사실을 확인한 뒤 진행하고 있습니다. 확인이 끝나면 다시 연락드리겠습니다. - {signature}' }
  };
  var TEMPLATE_ORDER = ['deposit', 'refuse', 'verify'];
  var PLACEHOLDER = { storeName: '저희 매장', deposit: '(예약금)', accountText: '(입금 계좌)', signature: '저희 매장' };

  function templateVars(settings, orderAmount, date) {
    settings = settings || {};
    var name = trim(settings.storeName);
    var dep = deposit(orderAmount, isNum(settings.depositPct) ? settings.depositPct : 30);
    return {
      storeName: name || PLACEHOLDER.storeName,
      deposit: dep === null ? PLACEHOLDER.deposit : comma(dep),
      accountText: trim(settings.accountText) || PLACEHOLDER.accountText,
      signature: trim(settings.signature) || name || PLACEHOLDER.signature,
      date: date || ''
    };
  }
  function fillTemplate(type, vars) {
    var t = TEMPLATES[type]; if (!t) return '';
    return t.text.replace(/\{(storeName|deposit|accountText|signature|date)\}/g, function (_, k) { return vars[k] == null ? '' : String(vars[k]); });
  }
  function missingFields(vars) {
    var m = [];
    if (vars.storeName === PLACEHOLDER.storeName) m.push('storeName');
    if (vars.deposit === PLACEHOLDER.deposit) m.push('deposit');
    if (vars.accountText === PLACEHOLDER.accountText) m.push('accountText');
    return m;
  }

  // ---------- 공식 연락처 (2026-10-25 출처 페이지에서 재확인) ----------
  var CONTACT_SOURCE = 'https://news.seoul.go.kr/economy/archives/566787';
  var CONTACTS = [
    { id: 'helpcall', name: '국방헬프콜', num: '1303', tel: '1303', note: '국번 없이 · 24시간 상담', src: CONTACT_SOURCE },
    { id: 'cdc_day', name: '수도방위사령부 (주간)', num: '02-524-1411', tel: '025241411', note: '부대 문의 · 신분·공문서 진위 확인', src: CONTACT_SOURCE },
    { id: 'cdc_night', name: '수도방위사령부 (야간·휴일)', num: '02-524-0301', tel: '025240301', note: '부대 문의 · 야간과 휴일', src: CONTACT_SOURCE },
    { id: 'police', name: '피해 신고 (경찰)', num: '112', tel: '112', note: '국번 없이 · 긴급 신고', src: CONTACT_SOURCE }
  ];
  var LINKS = {
    cyber: { name: '경찰청 사이버안전지킴이 — 전화·계좌번호 사기 신고 이력 조회', url: 'https://cyber.go.kr/prevention/sub7.jsp?mid=020600',
      note: '최근 3개월 동안 3회 이상 신고된 번호와 비교해요. 이력이 없어도 안전하다는 뜻은 아니에요.' },
    ecrm: { name: '사이버범죄 신고시스템 (ECRM)', url: 'https://ecrm.police.go.kr/minwon/main',
      note: '온라인으로 서류를 미리 작성하고, 경찰서를 방문해 정식 접수해요.' },
    seoul: { name: '서울시 「군인, 군부대 사칭 사기범죄 예방 공고」', url: CONTACT_SOURCE }
  };
  var CONTACTS_VERIFIED_ON = '2026-10-25';

  // ---------- 수법 도감 ----------
  var TYPES = [
    { id: 'A', emoji: '🍶', title: '유형 A · 단체 예약 후 술 대리구매',
      flow: ['수십 명 규모 단체 예약으로 안심시켜요', '"행사용 고급 술은 아는 전용 거래처가 있다"며 대리구매를 부탁해요', '거래처에 먼저 결제하면 식대와 함께 정산하겠다고 해요', '송금이 끝나면 나타나지 않고 연락을 끊어요'],
      phrases: ['"행사에 쓸 고급 술이 필요한데, 저희가 아는 전용 거래처가 있어요."', '"그쪽 거래처에 먼저 결제해 주시면 나중에 식대랑 같이 현금으로 정산할게요."', '"저녁 공식 모임이라 수십 명이 갑니다."'],
      action: '매장에서 팔지 않는 물건의 대리구매·선결제는 정중히 거절하세요.',
      sources: [{ name: '신한은행 노쇼 사기 예방가이드', url: 'https://solgit.shinhan.com/sc26080094.html' }] },
    { id: 'B', emoji: '🏛️', title: '유형 B · 기관 사칭 + 물품 대리구매',
      flow: ['공공기관·군부대·대기업 건설사 직원이라며 납품이나 단체 예약을 맡겨요', '위조한 공문과 명함을 보내 믿음을 쌓아요', '"다른 거래처가 더 싸니 대신 사서 같이 납품해 달라"며 이체를 유도해요', '송금하는 순간 예약이 취소되고 연락이 끊겨요'],
      phrases: ['"공문이랑 명함 보내드릴게요. 확인해 보세요."', '"추가로 필요한 물품이 있는데, 다른 거래처가 더 저렴해서 대신 구매해 같이 납품해 주세요."', '"저희가 지정한 업체 계좌로 보내 주시면 됩니다."'],
      action: '명함·공문에 적힌 번호가 아니라 기관 공식 대표번호로 확인하세요. 서울시 공고에 따르면 군은 납품업체에 대금 대납을 요구하지 않아요.',
      sources: [{ name: '신한은행 노쇼 사기 예방가이드', url: 'https://solgit.shinhan.com/sc26080094.html' }, { name: '서울시 군 사칭 사기 예방 공고', url: CONTACT_SOURCE }] },
    { id: 'C', emoji: '🥡', title: '유형 C · 대량 포장 주문 후 잠적',
      flow: ['군부대라며 탕수육 10개·볶음밥 70개 같은 대량 포장을 주문해요', '주문 내역 영수증 사진을 보내 달라고 해요', '다음 날 가짜 공문을 보내고 음료 등을 더해 주문이 커져요', '음식을 다 준비해도 아무도 오지 않고 연락이 끊겨요'],
      phrases: ['"탕수육 10개, 볶음밥 70개 포장해 주세요. 내일 오후에 가지러 갈게요."', '"주문 내역 영수증 사진 좀 보내 주세요."', '"음료도 추가해 주세요. 공문은 문자로 보내드릴게요."'],
      action: '예약금이 들어온 뒤에 준비를 시작하세요. 공식 대표번호로 주문 사실을 확인하면 더 확실해요.',
      sources: [{ name: '문화일보 (2025.04.19) 군부대 사칭 노쇼 사례', url: 'https://www.munhwa.com/article/11500041' }] }
  ];

  // ---------- 퀴즈 (P1) ----------
  var QUIZ = [
    { q: '40명 단체 예약 손님이 "행사용 고급 술은 저희가 아는 거래처가 있으니, 사장님이 먼저 결제해 주시면 식대랑 같이 정산할게요"라고 해요.',
      options: ['단골이 될 수 있으니 먼저 결제해 준다', '대리구매·선결제는 하지 않는다고 정중히 거절한다', '절반만 먼저 결제해 준다'], answer: 1,
      why: '매장에서 팔지 않는 물건을 대신 사 달라는 요청은 대표적인 수법이에요. 금액과 상관없이 거절하면 돼요.' },
    { q: '군부대 간부라며 공문 사진과 명함 사진을 문자로 보내왔어요. 명함에는 사무실 번호가 적혀 있어요.',
      options: ['명함 번호로 전화해 확인한다', '공문이 있으니 믿고 진행한다', '부대 공식 대표번호(수도방위사령부·국방헬프콜 1303)로 확인한다'], answer: 2,
      why: '공문과 명함은 위조될 수 있고, 적힌 번호도 상대 쪽일 수 있어요. 기관 공식 대표번호로 확인하세요.' },
    { q: '볶음밥 70인분 포장 주문이에요. "내일 오후에 가지러 갈 테니 예약금은 그때 한꺼번에 낼게요"라고 해요.',
      options: ['예약금이 들어온 뒤에 준비를 시작한다고 안내한다', '내일이니 오늘 밤부터 재료를 준비한다', '절반만 준비해 둔다'], answer: 0,
      why: '예약금을 먼저 받는 것이 가장 간단한 기준이에요. 진짜 손님이라면 대부분 예약금에 응해요.' },
    { q: '경찰청 사이버안전지킴이에서 손님 번호를 조회했더니 신고 이력이 없다고 나와요.',
      options: ['이제 안전하니 대리구매도 해 준다', '이력이 없어도 안전 보장은 아니므로, 예약금과 공식 번호 확인을 계속한다', '조회는 의미가 없으니 무시한다'], answer: 1,
      why: '최근 3개월 3회 이상 신고된 번호만 나와요. 새 번호는 이력이 없을 수 있어요.' },
    { q: '직원이 이미 손님이 알려 준 거래처 계좌로 돈을 보냈다고 해요.',
      options: ['손님 연락을 기다린다', '즉시 112와 송금한 은행에 신고한다', '다음 주문 때 정산해 달라고 문자 보낸다'], answer: 1,
      why: '빨리 신고할수록 대응할 수 있는 방법이 많아요. 112와 은행에 바로 알리세요.' }
  ];

  var OUTCOMES = { visited: '정상 방문', noshow: '노쇼', scam_attempt: '사기 시도', unknown: '모름' };

  // ---------- 유틸 ----------
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function trim(v) { return typeof v === 'string' ? v.trim() : ''; }
  function comma(n) { return isNum(n) ? Math.round(n).toLocaleString('en-US') : ''; }
  function parseAmount(s) { if (isNum(s)) return Math.max(0, Math.round(s)); var d = String(s == null ? '' : s).replace(/[^0-9]/g, ''); return d ? Math.min(Number(d), 1e12) : null; }
  function normalizePhone(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, '').slice(0, 15); }
  function formatPhone(d) {
    d = normalizePhone(d); if (!d) return '';
    if (/^02/.test(d)) { if (d.length === 9) return d.replace(/^(02)(\d{3})(\d{4})$/, '$1-$2-$3'); if (d.length === 10) return d.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3'); return d; }
    if (d.length === 11) return d.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
    if (d.length === 10) return d.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    if (d.length === 8) return d.replace(/^(\d{4})(\d{4})$/, '$1-$2');
    return d;
  }
  function findDuplicatePhone(log, phone, exceptId) {
    var d = normalizePhone(phone); if (d.length < 7) return [];
    return (log || []).filter(function (e) { return e && e.id !== exceptId && normalizePhone(e.phone) === d; });
  }
  function newId(prefix, now) { now = now || Date.now(); return prefix + '_' + now + '_' + Math.random().toString(36).slice(2, 4); }
  function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  function defaultState() {
    return { version: VERSION, settings: { storeName: '', depositPct: 30, accountText: '', signature: '', onboarded: false }, checks: [], log: [], quiz: { bestScore: null, completedAt: null } };
  }
  function clampPct(v) { v = Number(v); if (!isFinite(v)) return 30; return Math.min(100, Math.max(10, Math.round(v))); }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function sanitizeCheck(c) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string') return null;
    var ans = {};
    if (c.answers && typeof c.answers === 'object') QUESTIONS.forEach(function (q) { if (ANSWERS.indexOf(c.answers[q.id]) >= 0) ans[q.id] = c.answers[q.id]; });
    var ev = evaluate(ans);
    return { id: c.id.slice(0, 40), answers: ans, score: ev.score, level: ev.level, critical: ev.critical,
      orderAmount: isNum(c.orderAmount) && c.orderAmount > 0 ? Math.round(c.orderAmount) : null,
      createdAt: isNum(c.createdAt) ? c.createdAt : Date.now() };
  }
  function sanitizeLog(e) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string') return null;
    return { id: e.id.slice(0, 40), checkId: typeof e.checkId === 'string' ? e.checkId.slice(0, 40) : null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayStr(),
      callerName: str(e.callerName, 40), claimedOrg: str(e.claimedOrg, 60), phone: normalizePhone(e.phone),
      orderText: str(e.orderText, 300), amount: isNum(e.amount) && e.amount > 0 ? Math.round(e.amount) : null,
      outcome: OUTCOMES[e.outcome] ? e.outcome : 'unknown', memo: str(e.memo, 1000),
      level: ['red', 'yellow', 'green'].indexOf(e.level) >= 0 ? e.level : null,
      isSample: !!e.isSample, updatedAt: isNum(e.updatedAt) ? e.updatedAt : Date.now() };
  }
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) throw new Error('invalid state');
    var s = defaultState(), r = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    s.settings = { storeName: str(r.storeName, 40), depositPct: clampPct(r.depositPct == null ? 30 : r.depositPct), accountText: str(r.accountText, 80), signature: str(r.signature, 40), onboarded: !!r.onboarded };
    var seen = {};
    s.checks = (Array.isArray(raw.checks) ? raw.checks : []).map(sanitizeCheck).filter(function (c) { if (!c || seen[c.id]) return false; seen[c.id] = 1; return true; });
    seen = {};
    s.log = (Array.isArray(raw.log) ? raw.log : []).map(sanitizeLog).filter(function (e) { if (!e || seen[e.id]) return false; seen[e.id] = 1; return true; });
    var q = raw.quiz && typeof raw.quiz === 'object' ? raw.quiz : {};
    s.quiz = { bestScore: isNum(q.bestScore) ? Math.max(0, Math.min(QUIZ.length, q.bestScore)) : null, completedAt: isNum(q.completedAt) ? q.completedAt : null };
    return s;
  }

  // ---------- 장부 CSV ----------
  function csvCell(v) { v = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var LEVEL_NAME = { red: '빨강', yellow: '노랑', green: '초록' };
  function logToCsv(log) {
    var rows = [['날짜', '주문자', '칭한 소속', '전화번호', '주문 내용', '금액(원)', '점검 결과', '결과', '메모']];
    (log || []).forEach(function (e) { rows.push([e.date, e.callerName, e.claimedOrg, formatPhone(e.phone), e.orderText, e.amount == null ? '' : e.amount, e.level ? LEVEL_NAME[e.level] : '', OUTCOMES[e.outcome] || '', e.memo]); });
    return '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
  }

  function shareText() {
    return '단체 주문 전화 받을 때 쓰는 60초 점검 도구예요.\n· 매장에서 안 파는 물건 대리구매·선결제, 지정 계좌 송금 요청은 거절\n· 명함 번호 말고 기관 공식 대표번호로 확인\n· 예약금 먼저 받고 준비\n주문방패: ' + APP_URL;
  }

  return {
    VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, APP_URL: APP_URL, QUESTIONS: QUESTIONS, QMAP: QMAP, ANSWERS: ANSWERS,
    evaluate: evaluate, shouldStop: shouldStop, nextIndex: nextIndex, barPct: barPct, LEVELS: LEVELS, levelInfo: levelInfo, DISCLAIMER: DISCLAIMER,
    deposit: deposit, TEMPLATES: TEMPLATES, TEMPLATE_ORDER: TEMPLATE_ORDER, PLACEHOLDER: PLACEHOLDER, templateVars: templateVars, fillTemplate: fillTemplate, missingFields: missingFields,
    CONTACTS: CONTACTS, LINKS: LINKS, CONTACT_SOURCE: CONTACT_SOURCE, CONTACTS_VERIFIED_ON: CONTACTS_VERIFIED_ON, TYPES: TYPES, QUIZ: QUIZ, OUTCOMES: OUTCOMES, LEVEL_NAME: LEVEL_NAME,
    isNum: isNum, comma: comma, parseAmount: parseAmount, normalizePhone: normalizePhone, formatPhone: formatPhone, findDuplicatePhone: findDuplicatePhone,
    newId: newId, todayStr: todayStr, defaultState: defaultState, sanitizeState: sanitizeState, sanitizeCheck: sanitizeCheck, sanitizeLog: sanitizeLog, clampPct: clampPct,
    logToCsv: logToCsv, csvCell: csvCell, shareText: shareText
  };
});
