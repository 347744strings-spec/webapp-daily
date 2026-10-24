/*!
 * 서명전에 (Before You Sign) — 계산 엔진 + 위험 규칙 + 정적 데이터
 * 순수 함수만 있어요(DOM 없음). 브라우저에서는 window.BYS, node에서는 require('./rules.js').
 * 금액은 원 단위 정수로 저장하고, 계산 중에만 실수를 쓴 뒤 Math.round 해요.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BYS = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var STORAGE_KEY = 'seomyeong.v1';
  var TERM_OPTIONS = [12, 24, 36, 48, 60];
  var MAX_COMPARE = 4;

  var CATEGORIES = {
    tableorder: { label: '테이블오더', emoji: '📱' },
    kiosk: { label: '키오스크', emoji: '🖥️' },
    pos: { label: 'POS', emoji: '🧮' },
    cardterminal: { label: '카드단말기', emoji: '💳' },
    servingrobot: { label: '서빙로봇', emoji: '🤖' },
    etc: { label: '기타', emoji: '📦' }
  };
  var PAYMENT_TYPES = { VAN: 'VAN', PG: 'PG', unknown: '모름' };
  var TERMINATION_TYPES = {
    full: '잔여 이용료 전액',
    partial: '잔여 이용료 일부 + 단말 잔여금 + 설치비 환수',
    fixed: '정액 위약금',
    unknown: '모름 (최악 가정)'
  };
  var RELIEF = { yes: '있음', no: '없음', unknown: '모름' };

  // ---------- number helpers ----------
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function n0(v) { return isNum(v) ? v : 0; }
  function round(v) { return Math.round(v); }
  function comma(v) {
    var n = Math.round(Number(v) || 0);
    var s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + s;
  }
  function won(v) { return comma(v) + '원'; }
  function manwon(v) {
    // 1,234,567 → "약 123만 원" (읽기 보조)
    var n = Math.round(Number(v) || 0);
    if (Math.abs(n) < 10000) return comma(n) + '원';
    var eok = Math.floor(Math.abs(n) / 100000000);
    var man = Math.round((Math.abs(n) % 100000000) / 10000);
    if (man === 10000) { eok += 1; man = 0; }
    var s = (eok ? eok + '억 ' : '') + (man ? comma(man) + '만' : '');
    return (n < 0 ? '-' : '') + '약 ' + s.trim() + ' 원';
  }

  // ---------- store ----------
  function emptyStore() { return { monthlyCardSales: null, deviceSharePct: 100, currentCardFeePct: null }; }
  /** 매장 정보가 PG 계산에 충분한가: 월 카드매출 > 0 이고 현재 카드 수수료율이 숫자 */
  function hasStore(store) {
    return !!store && isNum(store.monthlyCardSales) && store.monthlyCardSales > 0 && isNum(store.currentCardFeePct);
  }
  function sharePct(store) { return store && isNum(store.deviceSharePct) ? store.deviceSharePct : 100; }

  // ---------- core formulas (spec §9-3) ----------
  function vatFactor(q) { return q.vatIncluded ? 1 : 1.1; }

  /** 월 고정비(원, 실수) = monthlyFeePerUnit × units × vat */
  function monthlyFixRaw(q) { return n0(q.monthlyFeePerUnit) * n0(q.units) * vatFactor(q); }

  /**
   * PG 추가분(원/월, 실수). status:
   *  'none'      VAN → 0
   *  'unknownType' 결제 방식 모름 → 0 (R1 경고)
   *  'needRate'  PG인데 수수료율 미입력 → 계산 불가
   *  'needStore' PG인데 매장 정보 없음 → 계산 불가 (0으로 숨기지 않음)
   *  'ok'        계산됨
   */
  function pgExtraInfo(q, store) {
    var p = q.payment || {};
    if (p.type === 'VAN') return { status: 'none', raw: 0 };
    if (p.type !== 'PG') return { status: 'unknownType', raw: 0 };
    if (!isNum(p.pgFeePct)) return { status: 'needRate', raw: 0 };
    if (!hasStore(store)) return { status: 'needStore', raw: 0 };
    var raw = store.monthlyCardSales * sharePct(store) / 100 * Math.max(0, p.pgFeePct - store.currentCardFeePct) / 100;
    return { status: 'ok', raw: raw };
  }

  function clampMonth(q, m) {
    var t = Math.max(1, Math.round(n0(q.termMonths)));
    m = Math.round(Number(m));
    if (!isFinite(m)) m = 1;
    return Math.min(t, Math.max(0, m));
  }

  /** 해지 시점 m(개월 차)의 예상 위약금(원, 정수). R = termMonths − m */
  function penalty(q, m) {
    m = clampMonth(q, m);
    var R = Math.round(n0(q.termMonths)) - m;
    var vat = vatFactor(q);
    var units = n0(q.units), fee = n0(q.monthlyFeePerUnit);
    var t = q.termination || {};
    var promo = n0(t.promoRefund);
    var raw;
    switch (t.type) {
      case 'partial': {
        var dev = Math.min(Math.max(0, n0(t.devicePortionPerUnit)), fee);
        var pct = isNum(t.remainingFeePct) ? t.remainingFeePct : 100;
        raw = (fee - dev) * units * vat * R * pct / 100 +
          dev * units * vat * R +
          n0(t.installClawback) + promo;
        break;
      }
      case 'fixed':
        raw = n0(t.fixedAmount) + promo;
        break;
      case 'full':
      case 'unknown':
      default:
        raw = fee * units * vat * R + promo;
    }
    return round(raw);
  }

  /** 견적 하나의 전체 계산 결과 */
  function calc(q, store) {
    var term = Math.max(1, Math.round(n0(q.termMonths)));
    var mf = monthlyFixRaw(q);
    var pg = pgExtraInfo(q, store);
    var upfront = n0(q.upfrontCost), subsidy = n0(q.subsidy);
    var totalRaw = upfront + (mf + pg.raw) * term - subsidy;
    function paidUntil(m) { m = clampMonth(q, m); return round(upfront + (mf + pg.raw) * m); }
    return {
      vat: vatFactor(q),
      termMonths: term,
      monthlyFix: round(mf),
      pgStatus: pg.status,
      pgExtra: pg.status === 'ok' ? round(pg.raw) : (pg.status === 'none' || pg.status === 'unknownType' ? 0 : null),
      pgIncluded: pg.status === 'ok',
      totalCost: round(totalRaw),
      monthlyAvg: round(totalRaw / term),
      deposit: n0(q.deposit),
      breakdown: {
        fees: round(mf * term),
        pg: round(pg.raw * term),
        upfront: upfront,
        subsidy: subsidy
      },
      worstCase: !q.termination || q.termination.type === 'unknown',
      penalty: function (m) { return penalty(q, m); },
      paidUntil: paidUntil,
      exitCost: function (m) { return paidUntil(m) + penalty(q, m); }
    };
  }

  /** 1..term 전체 타임라인 */
  function timeline(q, store) {
    var c = calc(q, store), out = [];
    for (var m = 1; m <= c.termMonths; m++) out.push({ m: m, penalty: c.penalty(m), paid: c.paidUntil(m), exit: c.exitCost(m) });
    return out;
  }

  // ---------- risk rules (spec §9-4) ----------
  var RULES = [
    {
      id: 'R1', level: 'red',
      test: function (q) { return q.payment.type === 'unknown'; },
      title: '결제가 VAN인지 PG인지 확인이 필요해요',
      detail: function () { return 'PG 방식이면 카드사 수수료 외에 별도 수수료가 붙을 수 있어요. 결제 방식에 따라 매달 내는 돈이 크게 달라져요.'; },
      question: '카드 결제 시 카드사 수수료 외에 별도 PG 수수료가 있습니까? 있다면 요율을 서면으로 주세요.'
    },
    {
      id: 'R2', level: 'yellow',
      test: function (q, s) {
        var p = q.payment;
        if (p.type !== 'PG' || !isNum(p.pgFeePct)) return false;
        if (!s || !isNum(s.currentCardFeePct)) return true; // 비교 기준 없음 → 확인 필요로 표시
        return p.pgFeePct > s.currentCardFeePct;
      },
      title: 'PG 수수료로 매달 추가 부담이 생겨요',
      detail: function (q, s, c) {
        if (c.pgStatus === 'ok') return '지금 카드 수수료보다 월 ' + won(c.pgExtra) + ', 약정 기간 동안 ' + won(c.breakdown.pg) + '을 더 내게 돼요.';
        return 'PG 수수료 ' + q.payment.pgFeePct + '%가 붙어요. 매장 정보(월 카드매출·현재 수수료율)를 넣으면 월 추가 부담을 계산해 드려요.';
      },
      question: 'PG 수수료율을 낮추거나 VAN 방식으로 바꿀 수 있습니까? 약정 기간 중 수수료율이 오를 수 있는지도 서면으로 알려 주세요.'
    },
    {
      id: 'R3', level: 'red',
      test: function (q) { return q.termination.type === 'unknown'; },
      title: '중도 해지 위약금 산식을 아직 몰라요',
      detail: function () { return '산식을 모르면 가장 비싼 경우(잔여 이용료 전액)로 계산했어요. 실제 산식을 서면으로 받아 보세요.'; },
      question: '중도 해지 시 위약금 산식(잔여 이용료 몇 %, 단말 잔여금, 설치비 환수, 사은품 반환)을 서면으로 주세요.'
    },
    {
      id: 'R4', level: 'red',
      test: function (q) { return q.termination.type === 'full'; },
      title: '해지하면 남은 기간 이용료를 전부 내는 구조예요',
      detail: function (q, s, c) { return '예를 들어 3개월 차에 해지하면 ' + won(c.penalty(3)) + '을 내야 해요.'; },
      question: '중도 해지 시 잔여 이용료 전액 대신 감액 산식(예: 잔여 이용료의 일부)을 적용할 수 있습니까?'
    },
    {
      id: 'R5', level: 'yellow',
      test: function (q) { return q.termination.closureRelief !== 'yes'; },
      title: '폐업·양도할 때 감면 조항을 확인해 주세요',
      detail: function (q) { return q.termination.closureRelief === 'no' ? '폐업해도 위약금이 그대로 나오는 계약이에요.' : '폐업·양도 시 위약금 감면이나 승계가 되는지 아직 몰라요.'; },
      question: '폐업·양도 시 위약금 감면이나 승계가 가능합니까?'
    },
    {
      id: 'R6', level: 'yellow',
      test: function (q) { return q.termMonths >= 48; },
      title: '약정 기간이 길어요',
      detail: function (q) { return q.termMonths + '개월 약정이에요. 기간이 길수록 중간에 그만둘 때 부담이 커져요.'; },
      question: '36개월 이하 약정 상품이 있습니까? 있다면 그때 월 요금은 얼마입니까?'
    },
    {
      id: 'R7', level: 'red',
      test: function (q, s, c) { return c.penalty(Math.min(3, c.termMonths)) >= c.totalCost * 0.5; },
      title: '3개월 안에 그만두면 총비용의 절반 이상을 내요',
      detail: function (q, s, c) { return '3개월 차 해지 위약금 ' + won(c.penalty(Math.min(3, c.termMonths))) + ' ≥ 총비용의 50% (' + won(c.totalCost * 0.5) + ')'; },
      question: '설치 후 3개월 안에 해지하면 실제로 청구되는 금액이 얼마인지 서면으로 주세요.'
    },
    {
      id: 'R8', level: 'yellow',
      test: function (q) { return n0(q.subsidy) > 0 || !isNum(q.termination.promoRefund); },
      title: '사은품·할인 반환 조건을 확인해 주세요',
      detail: function (q) {
        return n0(q.subsidy) > 0
          ? '지원금·사은품 ' + won(q.subsidy) + '을 받는 조건이에요. 해지할 때 돌려줘야 하는지 확인이 필요해요.'
          : '해지 시 프로모션·사은품 반환액을 아직 입력하지 않았어요.';
      },
      question: '해지 시 사은품·할인 금액을 반환해야 합니까? 금액은 얼마입니까?'
    },
    {
      id: 'R9', level: 'yellow',
      test: function (q) { return n0(q.upfrontCost) === 0 && q.payment.type !== 'VAN'; },
      title: "'무상 설치'인데 결제가 PG이거나 미확인이에요",
      detail: function () { return '설치비가 없는 대신 수수료나 위약금에 비용이 숨어 있을 수 있어요.'; },
      question: '무상 설치 비용이 월 요금이나 결제 수수료에 포함되어 있습니까? 해지 시 설치비를 따로 청구합니까?'
    },
    {
      id: 'R10', level: 'info',
      test: function (q) { return n0(q.deposit) > 0; },
      title: '보증금 반환 조건을 확인해 주세요',
      detail: function (q) { return '보증금 ' + won(q.deposit) + '은 총비용에서 빼고 따로 표시했어요(반환 예정).'; },
      question: '보증금 반환 시점과 차감 조건은 무엇입니까?'
    }
  ];

  function evaluateRules(q, store) {
    var c = calc(q, store);
    var out = [];
    RULES.forEach(function (r) {
      var on = false;
      try { on = !!r.test(q, store, c); } catch (e) { on = false; }
      if (on) out.push({ id: r.id, level: r.level, title: r.title, detail: r.detail(q, store, c), question: r.question });
    });
    return out;
  }
  function riskCounts(list) {
    var r = { red: 0, yellow: 0, info: 0, total: 0 };
    list.forEach(function (w) { r[w.level]++; if (w.level !== 'info') r.total++; });
    return r;
  }

  // 일반 확인 질문(경고와 무관, 기본 해제)
  var EXTRA_QUESTIONS = [
    { id: 'X1', text: '약정이 끝난 뒤 월 요금은 얼마이며, 자동 연장되는지 알려 주세요.' },
    { id: 'X2', text: '기기 고장 시 A/S·교체 비용과 처리 기간은 어떻게 됩니까?' },
    { id: 'X3', text: '할부금융(캐피털) 계약이 따로 있습니까? 있다면 그 계약서도 주세요.' },
    { id: 'X4', text: '영업 담당자가 말한 할인·사은품·조건을 계약서 특약에 적어 주실 수 있습니까?' }
  ];

  function buildQuestions(q, store) {
    var ws = evaluateRules(q, store);
    var list = ws.map(function (w) { return { id: w.id, text: w.question, level: w.level, fromRule: true, on: true }; });
    EXTRA_QUESTIONS.forEach(function (x) { list.push({ id: x.id, text: x.text, level: 'extra', fromRule: false, on: false }); });
    return list;
  }

  function questionText(q, items) {
    var cat = CATEGORIES[q.category] ? CATEGORIES[q.category].label : '렌탈';
    var lines = ['안녕하세요. ' + (q.vendor || '') + ' ' + cat + ' 견적(' + q.units + '대, ' + q.termMonths + '개월) 관련해 계약 전에 확인하고 싶은 내용이 있습니다.', ''];
    items.forEach(function (it, i) { lines.push((i + 1) + '. ' + it.text); });
    lines.push('', '위 내용을 문자·이메일 등 서면으로 회신해 주시거나 계약서 특약에 적어 주시면 감사하겠습니다.');
    return lines.join('\n').replace(/  +/g, ' ');
  }

  // ---------- compare ----------
  var COMPARE_METRICS = [
    { key: 'total', label: '약정 기간 총비용', get: function (c) { return c.totalCost; } },
    { key: 'avg', label: '월 평균 실부담', get: function (c) { return c.monthlyAvg; } },
    { key: 'p6', label: '6개월 차 해지 위약금', get: function (c) { return c.termMonths >= 6 ? c.penalty(6) : null; } },
    { key: 'p12', label: '12개월 차 해지 위약금', get: function (c) { return c.termMonths >= 12 ? c.penalty(12) : null; } },
    { key: 'risk', label: '위험 경고 수', get: function (c, w) { return riskCounts(w).total; } }
  ];
  function compare(quotes, store) {
    var rows = quotes.map(function (q) { return { q: q, c: calc(q, store), w: evaluateRules(q, store) }; });
    return COMPARE_METRICS.map(function (m) {
      var vals = rows.map(function (r) { return m.get(r.c, r.w); });
      var nums = vals.filter(isNum);
      var best = nums.length >= 2 ? Math.min.apply(null, nums) : null;
      return {
        key: m.key, label: m.label,
        cells: rows.map(function (r, i) {
          return {
            id: r.q.id, value: vals[i],
            best: best !== null && vals[i] === best,
            pgNote: (m.key === 'total' || m.key === 'avg') && (r.c.pgStatus === 'needStore' || r.c.pgStatus === 'needRate')
          };
        })
      };
    });
  }

  // ---------- checklist (P1) ----------
  var CHECKLIST = [
    { id: 'c1', text: '계약서 사본을 받았나요?' },
    { id: 'c2', text: '제품공급계약서와 결제서비스계약서를 구분해서 확인했나요?' },
    { id: 'c3', text: '월 요금이 VAT 포함인지 확인했나요?' },
    { id: 'c4', text: 'PG 수수료가 서면에 적혀 있나요?' },
    { id: 'c5', text: '약정 개월 수를 확인했나요?' },
    { id: 'c6', text: '중도해지 위약금 산식을 서면으로 받았나요?' },
    { id: 'c7', text: '폐업·양도 시 조항을 확인했나요?' },
    { id: 'c8', text: '사은품·할인 반환 조건을 확인했나요?' },
    { id: 'c9', text: 'A/S·고장 교체 조건을 확인했나요?' },
    { id: 'c10', text: '약정이 끝난 뒤 요금을 확인했나요?' },
    { id: 'c11', text: '할부금융(캐피털) 계약이 따로 있는지 확인했나요?' },
    { id: 'c12', text: '영업사원의 구두 약속을 특약에 적었나요?' }
  ];
  function checklistScore(answers) {
    answers = answers || {};
    var yes = 0, answered = 0;
    CHECKLIST.forEach(function (c) { var a = answers[c.id]; if (a === 'yes') yes++; if (a === 'yes' || a === 'no' || a === 'unknown') answered++; });
    return { yes: yes, answered: answered, total: CHECKLIST.length };
  }

  // ---------- glossary / field help ----------
  var GLOSSARY = [
    { term: 'VAN', desc: '카드 결제를 카드사로 연결해 주는 전통적인 방식이에요. 보통 카드사 수수료만 내고, 단말기 업체에 건당 소액을 내는 경우가 있어요.' },
    { term: 'PG', desc: '결제대행사를 거치는 방식이에요. 카드사 수수료와 별개로 PG사가 정한 수수료(보통 매출의 일정 %)를 내요. 계약마다 요율이 달라서 꼭 서면으로 받아야 해요.' },
    { term: '약정', desc: '몇 개월 동안 쓰기로 약속하는 기간이에요. 이 기간 안에 그만두면 위약금이 생겨요.' },
    { term: '환수', desc: '처음에 깎아 주거나 무료로 해 준 금액(설치비·할인·사은품)을 해지할 때 다시 돌려받는 것을 말해요.' },
    { term: '손해배상액의 예정', desc: '계약을 어기면 얼마를 물어낼지 미리 정해 둔 조항이에요. 지나치게 많으면 분쟁조정에서 줄어드는 경우가 있어요.' },
    { term: '할부금융(캐피털)', desc: '기기값을 캐피털사가 대신 내고 사장님이 나눠 갚는 계약이에요. 렌탈 계약과 별도로 해지가 안 될 수 있어요.' },
    { term: 'VAT 별도', desc: '적힌 금액에 부가세 10%를 더 내야 한다는 뜻이에요. 18,000원(VAT 별도)이면 실제로는 19,800원이에요.' }
  ];
  var FIELD_HELP = {
    units: { t: '대수', d: '설치하는 기기 수예요. 테이블오더는 보통 테이블 수만큼 들어가요.' },
    monthlyFee: { t: '월 이용료 (1대당)', d: '견적서의 "월 렌탈료", "월 이용료"를 1대 기준으로 넣어 주세요. 총액만 있다면 대수로 나눠 주세요.' },
    vat: { t: 'VAT 포함 여부', d: '견적서에 "VAT 별도"라고 적혀 있으면 실제 금액은 10% 더 많아요. 잘 모르겠으면 "별도"로 두면 더 안전하게(높게) 계산돼요.' },
    term: { t: '약정 개월', d: '계약서의 "계약기간", "의무사용기간"이에요. 36개월이 가장 흔해요.' },
    upfront: { t: '초기비용', d: '설치비, 단말기 일시불 등 처음에 한 번 내는 돈이에요. "무상 설치"면 0원이에요.' },
    deposit: { t: '보증금', d: '나중에 돌려받기로 한 돈이에요. 총비용에서는 빼고 따로 보여드려요.' },
    subsidy: { t: '지원금·현금 사은품', d: '업체가 주는 현금 지원, 상품권 등이에요. 총비용에서 빼서 계산해요. 해지 때 돌려줘야 하는지 꼭 확인하세요.' },
    payment: { t: '결제 방식 (VAN / PG)', d: '계약서에 "PG", "전자결제대행", "결제서비스 이용약관" 같은 말이 있으면 PG일 가능성이 높아요. 모르면 "모름"을 고르세요.' },
    pgFee: { t: 'PG 수수료율', d: 'PG사가 매출에서 떼어 가는 비율이에요. 보통 0.8~2.5% 사이로 계약마다 달라요.' },
    termType: { t: '위약금 산식', d: '계약서의 "중도해지", "손해배상" 조항에 적혀 있어요. 모르면 "모름"을 고르면 가장 비싼 경우로 계산해 드려요.' },
    remainingPct: { t: '잔여 이용료 %', d: '남은 기간 이용료 중 몇 %를 내는지예요. 예: "잔여 이용료의 50%".' },
    devicePortion: { t: '단말 할부분 (1대당)', d: '월 이용료 중 기기값을 나눠 내는 부분이에요. 해지하면 이 부분은 보통 남은 기간 전액을 내요.' },
    clawback: { t: '설치비 환수액', d: '무상으로 해 준 설치비를 해지할 때 돌려받는 금액이에요.' },
    promo: { t: '프로모션·사은품 반환액', d: '해지할 때 돌려줘야 하는 할인·사은품 금액이에요. 없으면 0을 넣으세요. 비워 두면 "미확인"으로 경고해 드려요.' },
    relief: { t: '폐업 시 감면 조항', d: '폐업하거나 가게를 넘길 때 위약금을 줄여 주거나 새 사장님이 이어받을 수 있는 조항이에요.' },
    cardSales: { t: '월 카드매출', d: '한 달 카드 결제 합계예요. 카드사 정산 내역이나 여신금융협회 가맹점 매출조회에서 확인할 수 있어요.' },
    share: { t: '기기 결제 비율', d: '카드매출 중 이 기기(테이블오더·키오스크)로 결제되는 비율이에요. 모두 기기로 받으면 100%예요.' },
    cardFee: { t: '현재 카드 수수료율', d: '지금 내고 있는 카드 수수료율이에요. 카드사 정산 내역이나 매출 조회 사이트에서 확인하세요.' }
  };

  // ---------- samples (가상 데이터, 실제 업체·요금 아님) ----------
  var SAMPLE_STORE = { monthlyCardSales: 25000000, deviceSharePct: 100, currentCardFeePct: 1.0 };
  function sampleQuotes(now) {
    now = now || Date.now();
    return [
      {
        id: 'q_sample_A', vendor: '가상업체 A', category: 'tableorder', units: 14, monthlyFeePerUnit: 18000, vatIncluded: false,
        termMonths: 36, upfrontCost: 0, deposit: 0, subsidy: 0,
        payment: { type: 'VAN', pgFeePct: null },
        termination: { type: 'partial', remainingFeePct: 50, devicePortionPerUnit: 9000, installClawback: 300000, promoRefund: 0, fixedAmount: null, closureRelief: 'unknown' },
        checklist: {}, isSample: true, createdAt: now, updatedAt: now
      },
      {
        id: 'q_sample_B', vendor: '가상업체 B', category: 'tableorder', units: 14, monthlyFeePerUnit: 12000, vatIncluded: false,
        termMonths: 36, upfrontCost: 0, deposit: 0, subsidy: 500000,
        payment: { type: 'PG', pgFeePct: 2.5 },
        termination: { type: 'full', remainingFeePct: null, devicePortionPerUnit: null, installClawback: null, promoRefund: null, fixedAmount: null, closureRelief: 'no' },
        checklist: {}, isSample: true, createdAt: now + 1, updatedAt: now + 1
      }
    ];
  }

  // ---------- state / sanitize ----------
  function defaultState() {
    return { version: VERSION, store: emptyStore(), quotes: [], compareIds: [], settings: { onboarded: false, sampleStore: false, checklist: {} } };
  }
  function numOrNull(v, min, max) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    if (isNum(min) && n < min) n = min;
    if (isNum(max) && n > max) n = max;
    return n;
  }
  function intOrNull(v, min, max) { var n = numOrNull(v, min, max); return n === null ? null : Math.round(n); }
  function oneOf(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }

  function sanitizeQuote(r) {
    if (!r || typeof r !== 'object') return null;
    var units = intOrNull(r.units, 1, 9999), fee = intOrNull(r.monthlyFeePerUnit, 0, 1e9), term = intOrNull(r.termMonths, 1, 120);
    if (!units || fee === null || !term) return null;
    var p = r.payment && typeof r.payment === 'object' ? r.payment : {};
    var t = r.termination && typeof r.termination === 'object' ? r.termination : {};
    var now = Date.now();
    var ans = {};
    if (r.checklist && typeof r.checklist === 'object') CHECKLIST.forEach(function (c) { if (['yes', 'no', 'unknown'].indexOf(r.checklist[c.id]) >= 0) ans[c.id] = r.checklist[c.id]; });
    return {
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 60) : newId(),
      vendor: String(r.vendor == null ? '' : r.vendor).slice(0, 30),
      category: oneOf(r.category, Object.keys(CATEGORIES), 'etc'),
      units: units,
      monthlyFeePerUnit: fee,
      vatIncluded: !!r.vatIncluded,
      termMonths: term,
      upfrontCost: intOrNull(r.upfrontCost, 0, 1e10) || 0,
      deposit: intOrNull(r.deposit, 0, 1e10) || 0,
      subsidy: intOrNull(r.subsidy, 0, 1e10) || 0,
      payment: { type: oneOf(p.type, ['VAN', 'PG', 'unknown'], 'unknown'), pgFeePct: p.type === 'PG' ? numOrNull(p.pgFeePct, 0, 20) : null },
      termination: {
        type: oneOf(t.type, ['full', 'partial', 'fixed', 'unknown'], 'unknown'),
        remainingFeePct: numOrNull(t.remainingFeePct, 0, 100),
        devicePortionPerUnit: intOrNull(t.devicePortionPerUnit, 0, 1e9),
        installClawback: intOrNull(t.installClawback, 0, 1e10),
        promoRefund: intOrNull(t.promoRefund, 0, 1e10),
        fixedAmount: intOrNull(t.fixedAmount, 0, 1e11),
        closureRelief: oneOf(t.closureRelief, ['yes', 'no', 'unknown'], 'unknown')
      },
      checklist: ans,
      isSample: !!r.isSample,
      createdAt: isNum(r.createdAt) ? r.createdAt : now,
      updatedAt: isNum(r.updatedAt) ? r.updatedAt : now
    };
  }
  function sanitizeStore(s) {
    var d = emptyStore();
    if (!s || typeof s !== 'object') return d;
    d.monthlyCardSales = intOrNull(s.monthlyCardSales, 0, 1e11);
    var sh = numOrNull(s.deviceSharePct, 0, 100); d.deviceSharePct = sh === null ? 100 : sh;
    d.currentCardFeePct = numOrNull(s.currentCardFeePct, 0, 10);
    return d;
  }
  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !Array.isArray(raw.quotes)) throw new Error('invalid state');
    var st = defaultState();
    st.store = sanitizeStore(raw.store);
    var seen = {};
    st.quotes = raw.quotes.map(sanitizeQuote).filter(function (q) { if (!q || seen[q.id]) return false; seen[q.id] = 1; return true; });
    st.compareIds = (Array.isArray(raw.compareIds) ? raw.compareIds : []).filter(function (id, i, a) { return seen[id] && a.indexOf(id) === i; }).slice(0, MAX_COMPARE);
    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    st.settings.onboarded = !!s.onboarded;
    st.settings.sampleStore = !!s.sampleStore;
    if (s.checklist && typeof s.checklist === 'object') CHECKLIST.forEach(function (c) { if (['yes', 'no', 'unknown'].indexOf(s.checklist[c.id]) >= 0) st.settings.checklist[c.id] = s.checklist[c.id]; });
    return st;
  }
  function newId(now) { now = now || Date.now(); return 'q_' + now + '_' + Math.random().toString(36).slice(2, 6); }

  // ---------- share (#s=) ----------
  function b64urlEncode(str) {
    var b64;
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') b64 = Buffer.from(str, 'utf8').toString('base64');
    else {
      var bytes = new TextEncoder().encode(str), bin = '';
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      b64 = btoa(bin);
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  function encodeShare(quote, store) {
    var q = JSON.parse(JSON.stringify(quote));
    delete q.checklist; delete q.createdAt; delete q.updatedAt; delete q.isSample;
    return b64urlEncode(JSON.stringify({ v: 1, q: q, s: hasStore(store) ? store : null }));
  }
  function decodeShare(str) {
    var o = JSON.parse(b64urlDecode(str));
    if (!o || o.v !== 1) throw new Error('bad share');
    var q = sanitizeQuote(o.q);
    if (!q) throw new Error('bad quote');
    return { quote: q, store: o.s ? sanitizeStore(o.s) : null };
  }

  return {
    VERSION: VERSION, STORAGE_KEY: STORAGE_KEY, TERM_OPTIONS: TERM_OPTIONS, MAX_COMPARE: MAX_COMPARE,
    CATEGORIES: CATEGORIES, PAYMENT_TYPES: PAYMENT_TYPES, TERMINATION_TYPES: TERMINATION_TYPES, RELIEF: RELIEF,
    RULES: RULES, EXTRA_QUESTIONS: EXTRA_QUESTIONS, CHECKLIST: CHECKLIST, GLOSSARY: GLOSSARY, FIELD_HELP: FIELD_HELP,
    SAMPLE_STORE: SAMPLE_STORE, sampleQuotes: sampleQuotes,
    isNum: isNum, comma: comma, won: won, manwon: manwon,
    emptyStore: emptyStore, hasStore: hasStore, monthlyFixRaw: monthlyFixRaw, pgExtraInfo: pgExtraInfo,
    penalty: penalty, calc: calc, timeline: timeline,
    evaluateRules: evaluateRules, riskCounts: riskCounts, buildQuestions: buildQuestions, questionText: questionText,
    compare: compare, checklistScore: checklistScore,
    defaultState: defaultState, sanitizeQuote: sanitizeQuote, sanitizeStore: sanitizeStore, sanitizeState: sanitizeState, newId: newId,
    encodeShare: encodeShare, decodeShare: decodeShare, b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode
  };
});
