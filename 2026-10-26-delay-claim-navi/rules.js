/* 지연보상내비 rules.js — 순수 판정 규칙·문안 모듈 (DOM 없음). node: require('./rules.js') / 브라우저: window.DCN_RULES
   기준 확인일 2026-10-26 (KST). 원문 대조 내역은 HANDOFF.md 참고. */
(function (root) {
  'use strict';
  var CHECKED_AT = '2026-10-26';
  var RULES_VERSION = '2026-10-26.1';

  var AIRLINES = [
    { code: 'KE', nameKo: '대한항공', isEuCarrier: false },
    { code: 'OZ', nameKo: '아시아나항공', isEuCarrier: false },
    { code: 'LJ', nameKo: '진에어', isEuCarrier: false },
    { code: '7C', nameKo: '제주항공', isEuCarrier: false },
    { code: 'TW', nameKo: '티웨이항공', isEuCarrier: false },
    { code: 'BX', nameKo: '에어부산', isEuCarrier: false },
    { code: 'RS', nameKo: '에어서울', isEuCarrier: false },
    { code: 'ZE', nameKo: '이스타항공', isEuCarrier: false },
    { code: 'YP', nameKo: '에어프레미아', isEuCarrier: false },
    { code: 'AF', nameKo: '에어프랑스', isEuCarrier: true },
    { code: 'LH', nameKo: '루프트한자', isEuCarrier: true },
    { code: 'KL', nameKo: 'KLM 네덜란드항공', isEuCarrier: true },
    { code: 'AY', nameKo: '핀에어', isEuCarrier: true },
    { code: 'AZ', nameKo: 'ITA 항공', isEuCarrier: true },
    { code: 'LO', nameKo: 'LOT 폴란드항공', isEuCarrier: true },
    { code: 'EU_OTHER', nameKo: '그 밖의 EU 항공사', isEuCarrier: true },
    { code: 'OTHER', nameKo: '그 밖의 항공사(EU 외)', isEuCarrier: false },
    { code: 'UNKNOWN', nameKo: '모르겠어요', isEuCarrier: null }
  ];

  var REASONS = {
    weather: '기상 악화', maintenance: '정비·기술 문제', connection: '앞편 지연(연결)',
    airport: '공항 사정', none: '안내 없음', other: '기타'
  };
  var KR_EXEMPT = { weather: 1, maintenance: 1, connection: 1, airport: 1 };
  var TYPES = { delay: '늦게 도착', cancel: '결항', overbook: '초과판매로 탑승 거절' };
  var STAGES = [
    { id: 'draft', label: '작성' }, { id: 'sent', label: '보냄' }, { id: 'replied', label: '회신 받음' },
    { id: 'ccn1372', label: '1372 상담' }, { id: 'kca', label: '소비자원 피해구제' }, { id: 'done', label: '해결' }
  ];
  var SIGNAL_LABEL = { green: '받을 가능성 높음', yellow: '항공사 증명 필요', gray: '기준 미해당' };
  var DISCLAIMER = '참고용, 법률 자문 아님 · 최종 판단은 원문·항공사·1372';
  var MEAL_NOTICE = '체재가 필요했다면 적정 숙식비 등 경비는 항공사 부담이에요. 영수증을 꼭 보관하세요.';

  var SOURCES = [
    { id: 'kr_annex', title: '소비자분쟁해결기준 별표 2 항공(국내·국제여객) — 공정거래위원회 고시 제2025-14호(2025-12-18 시행)', url: 'https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulId=36810&efYd=0', note: '고시 현행 버전 확인' },
    { id: 'kr_airportal', title: '항공정보포털 게재 소비자분쟁해결기준 항공 부분(PDF)', url: 'https://www.airportal.go.kr/file/htmlOpen/upload/consumer/34.%20%EC%9A%B4%EC%88%98%EC%97%85(9%EA%B0%9C%20%EC%97%85%EC%A2%85)_%ED%95%AD%EA%B3%B5.pdf', note: '배상 비율·금액 원문 대조' },
    { id: 'kr_easylaw', title: '찾기쉬운 생활법령정보 — 국내선 지연·불이행 배상기준', url: 'https://www.easylaw.go.kr/CSP/CnpClsMainBtr.laf?ccfNo=2&cciNo=1&cnpClsNo=3&csmSeq=1662&popMenu=ov', note: '국내선 기준 교차 확인' },
    { id: 'kr_act61', title: '항공사업법 제61조(피해구제 신청 14일 이내 결과 통지, 특별 사유 60일)', url: 'https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1014909609', note: '회신 기한' },
    { id: 'eu261', title: 'Regulation (EC) No 261/2004 — 제3조(적용 범위)·제5조(결항)·제7조(보상액)', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32004R0261', note: '금액·거리 구간·14일 통보 규칙' },
    { id: 'eu_sturgeon', title: 'EU 사법재판소 Sturgeon 판결(C-402/07·C-432/07) — 도착 3시간 이상 지연 보상', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62007CJ0402', note: '지연 보상·3~4시간 50% 감액·기술 결함' },
    { id: 'eu_wallentin', title: 'EU 사법재판소 Wallentin-Hermann 판결(C-549/07) — 기술 결함은 원칙적으로 비상 상황 아님', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:62007CJ0549', note: '정비 사유' },
    { id: 'eu_2026', title: '개정 규정 (EU) 2026/2202 — 2027-10-23부터 적용', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32026R2202', note: '현재는 기존 규정 적용' },
    { id: 'ccn', title: '1372 소비자상담센터(국번 없이 1372, 평일 09:00~18:00)', url: 'https://www.ccn.go.kr', note: '항공사 회신이 없거나 불만족할 때' }
  ];

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : null;
  }
  function toRad(d) { return d * Math.PI / 180; }
  /** 대권거리(km), 지구 반지름 6371km — EU261 제7조 4항 great circle */
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  function indexAirports(list) { var m = {}; (list || []).forEach(function (a) { m[a.code] = a; }); return m; }
  function normalize(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
  function searchAirports(list, q, limit) {
    var n = normalize(q); if (!n) return [];
    var out = [];
    (list || []).forEach(function (a) {
      var code = a.code.toLowerCase(), score = -1;
      if (code === n) score = 100; else if (code.indexOf(n) === 0) score = 80;
      else if (normalize(a.city).indexOf(n) === 0 || normalize(a.nameKo).indexOf(n) === 0) score = 70;
      else if (normalize(a.city).indexOf(n) >= 0 || normalize(a.nameKo).indexOf(n) >= 0) score = 50;
      if (score >= 0) out.push({ a: a, s: score });
    });
    out.sort(function (x, y) { return y.s - x.s; });
    return out.slice(0, limit || 8).map(function (x) { return x.a; });
  }
  function airlineByCode(code) { for (var i = 0; i < AIRLINES.length; i++) if (AIRLINES[i].code === code) return AIRLINES[i]; return null; }

  /** 기준 운임 = 총 결제액 − 세금·유류할증료·수수료. 세금을 모르면 총액(상한) */
  function fareInfo(total, taxes) {
    var t = num(total), x = num(taxes);
    if (t === null || t <= 0) return { base: null, mode: 'none' };
    if (x === null) return { base: t, mode: 'total' };
    var b = t - x; if (b < 0) b = 0;
    return { base: b, mode: 'exact' };
  }
  function delayText(min) {
    var m = num(min); if (m === null) return '확인 필요';
    m = Math.max(0, Math.round(m));
    return (hm(m) || '0분') + ' 지연';
  }
  function hm(min) { var h = Math.floor(min / 60), r = min % 60; return (h ? h + '시간' : '') + (r ? (h ? ' ' : '') + r + '분' : ''); }

  /* ---------- 한국: 소비자분쟁해결기준 별표 2 항공 ---------- */
  // 원문 구간 문구가 경계에서 겹치는 곳(예: '1시간 이상~2시간 이내' / '2시간 이상~3시간 이내')은 edge로 표시하고 두 비율을 범위로 보여 준다.
  function krDelayBand(min, domestic) {
    var m = num(min); if (m === null) return { known: false };
    if (domestic) {
      if (m < 60) return { known: true, met: false, need: '국내선은 도착 1시간 이상 지연부터 배상 기준이 있어요' };
      if (m === 120) return { known: true, met: true, pMin: 10, pMax: 20, edge: '정확히 2시간은 원문 구간(‘1시간 이상~2시간 이내’ 10%, ‘2시간 이상~3시간 이내’ 20%)에 모두 걸려요' };
      if (m === 180) return { known: true, met: true, pMin: 20, pMax: 30, edge: '정확히 3시간은 원문 구간(‘2시간 이상~3시간 이내’ 20%, ‘3시간 이상’ 30%)에 모두 걸려요' };
      if (m < 120) return { known: true, met: true, pMin: 10, pMax: 10, band: '국내선 1시간 이상~2시간 이내 지연: 지연된 해당 구간 운임의 10%' };
      if (m < 180) return { known: true, met: true, pMin: 20, pMax: 20, band: '국내선 2시간 이상~3시간 이내 지연: 지연된 해당 구간 운임의 20%' };
      return { known: true, met: true, pMin: 30, pMax: 30, band: '국내선 3시간 이상 지연: 지연된 해당 구간 운임의 30%' };
    }
    if (m < 120) return { known: true, met: false, need: '국제선은 도착 2시간 이상 지연부터 배상 기준이 있어요' };
    if (m === 240) return { known: true, met: true, pMin: 10, pMax: 20, edge: '정확히 4시간은 원문 구간(‘2시간 이상~4시간 이내’ 10%, ‘4시간 이상~12시간 이내’ 20%)에 모두 걸려요' };
    if (m < 240) return { known: true, met: true, pMin: 10, pMax: 10, band: '국제선 2시간 이상~4시간 이내 지연: 지연된 해당 구간 운임의 10%' };
    if (m <= 720) return { known: true, met: true, pMin: 20, pMax: 20, band: '국제선 4시간 이상~12시간 이내 지연: 지연된 해당 구간 운임의 20%' };
    return { known: true, met: true, pMin: 30, pMax: 30, band: '국제선 12시간 초과 지연: 지연된 해당 구간 운임의 30%' };
  }

  function baseResult(regime, title) {
    return { regime: regime, title: title, applies: true, eligible: null, amountMin: null, amountMax: null, currency: 'KRW', pctMin: null, pctMax: null,
      cap: false, upperBound: false, textAmount: '', signal: 'gray', basis: [], notes: [], uncertain: [], sources: [] };
  }
  function krSignal(r, reason) {
    if (r.eligible === false) { r.signal = 'gray'; return; }
    r.signal = KR_EXEMPT[reason] ? 'yellow' : 'green';
    if (KR_EXEMPT[reason]) {
      r.notes.push('항공사가 말한 사유(' + REASONS[reason] + ')는 기준표의 면책 사유예요. 다만 면책은 항공사가 ‘증명한 경우’에만 인정돼요. 사유 증빙 요청서를 보내 보세요.');
      r.needsReasonRequest = true;
    }
  }
  function applyFare(r, fare, pMin, pMax) {
    r.pctMin = pMin; r.pctMax = pMax;
    if (fare.mode === 'none') {
      r.textAmount = '운임의 ' + (pMin === pMax ? pMin : pMin + '~' + pMax) + '%';
      r.notes.push('운임을 입력하면 금액으로 계산해 드려요.');
      return;
    }
    r.amountMin = Math.round(fare.base * pMin / 100);
    r.amountMax = Math.round(fare.base * pMax / 100);
    if (fare.mode === 'total') { r.upperBound = true; r.notes.push('세금·유류할증료를 몰라 총액으로 계산했어요. 실제는 더 적을 수 있음.'); }
  }

  function krDelay(c, ctx) {
    var domestic = ctx.domestic;
    var r = baseResult(domestic ? 'KR_DOM' : 'KR_INTL', domestic ? '한국 기준 · 국내선 지연' : '한국 기준 · 국제선 지연');
    r.sources = ['kr_annex', 'kr_airportal'].concat(domestic ? ['kr_easylaw'] : []);
    var minutes = c.delayMinutes;
    if (c.type === 'cancel') {
      r.title = domestic ? '한국 기준 · 국내선 결항(지연 기준 적용)' : '한국 기준 · 국제선 결항(지연 기준 적용)';
      r.notes.push('기준표에는 ‘결항’ 항목이 따로 없고 ‘운송 지연’과 ‘운송 불이행’만 있어요. 대체편으로 실제 도착이 늦어진 시간으로 지연 기준을 적용했어요. 항공사에 어느 기준으로 처리하는지 문의하세요.');
      r.uncertain.push('결항은 항공사가 지연 기준과 운송 불이행 기준 중 어느 쪽으로 처리하는지에 따라 금액이 달라질 수 있어요.');
      if (c.noAlt) {
        r.eligible = true;
        r.textAmount = domestic ? '운임 환급 + 해당 구간 항공권 또는 교환권' : '운임 환급 + 최대 USD 600';
        r.basis.push(domestic ? '운송 불이행 중 대체편을 제공하지 못한 경우: 불이행된 해당 구간 운임 환급 및 해당 구간 항공권 또는 교환권 제공(국내선)'
          : '운송 불이행 중 대체편을 제공하지 못한 경우: 불이행된 해당 구간 운임 환급 및 USD 600 배상(국제선, 숙식비 포함 최고 한도)');
        r.uncertain.push('대체편 없이 결항됐다면 운송 불이행(대체편 미제공) 기준이 적용될 수 있다고 보고 표시했어요.');
        krSignal(r, c.reason); return r;
      }
      if (num(c.noticeDaysBefore) !== null && num(c.noticeDaysBefore) >= 14) r.uncertain.push('출발 훨씬 전에 미리 통보된 결항은 항공사 약관·처리 기준을 함께 확인하세요.');
    }
    var b = krDelayBand(minutes, domestic);
    if (!b.known) { r.eligible = null; r.signal = 'gray'; r.uncertain.push('도착 지연 시간을 모르면 판정할 수 없어요. 실제 도착 시각을 확인해 주세요.'); return r; }
    if (!b.met) { r.eligible = false; r.signal = 'gray'; r.basis.push(b.need + '(목적지 도착 기준).'); return r; }
    r.eligible = true;
    if (b.edge) { r.uncertain.push(b.edge + '. 두 비율을 범위로 보여 드려요.'); r.basis.push((domestic ? '국내선' : '국제선') + ' 지연 ' + hm(num(minutes)) + ': 지연된 해당 구간 운임의 ' + b.pMin + '~' + b.pMax + '%'); }
    else r.basis.push(b.band);
    r.basis.push('기준은 출발이 아니라 목적지 도착 시각이고, ‘운임’은 유류할증료·공항이용료·기타 수수료를 뺀 금액이에요.');
    applyFare(r, ctx.fare, b.pMin, b.pMax);
    krSignal(r, c.reason);
    return r;
  }

  function krOverbook(c, ctx) {
    var domestic = ctx.domestic;
    var r = baseResult(domestic ? 'KR_DOM_OVERBOOK' : 'KR_INTL_OVERBOOK', domestic ? '한국 기준 · 국내선 운송 불이행(초과판매)' : '한국 기준 · 국제선 운송 불이행(초과판매)');
    r.sources = ['kr_annex', 'kr_airportal'];
    var a = num(c.altFlightDelayMinutes), noAlt = !!c.noAlt;
    if (domestic) {
      if (noAlt || (a !== null && a > 720)) {
        r.eligible = true; r.textAmount = '운임 환급 + 해당 구간 항공권 또는 교환권';
        r.basis.push('대체편을 제공하지 못한 경우: 불이행된 해당 구간 운임 환급 및 해당 구간 항공권 또는 교환권 제공');
        if (a !== null && a > 720) r.basis.push('대체편은 12시간 이내에 제공된 경우(타 항공사 포함)를 말해요. 12시간을 넘겼다면 ‘대체편 미제공’으로 봤어요.');
        krSignal(r, c.reason); return r;
      }
      if (a === null) { r.eligible = null; r.uncertain.push('대체편으로 얼마나 늦게 도착했는지 알려 주시면 판정할 수 있어요.'); return r; }
      if (a < 60) { r.eligible = false; r.basis.push('국내선은 1시간 이후 대체편부터 배상 비율이 있어요(목적지 도착 기준).'); return r; }
      r.eligible = true;
      var p1 = 20, p2 = 20;
      if (a === 60) { r.uncertain.push('정확히 1시간은 원문 ‘1시간 이후~3시간 이내’의 시작점이라 해석이 갈릴 수 있어요.'); p1 = 0; }
      if (a === 180) { r.uncertain.push('정확히 3시간은 원문 ‘3시간 이내’(20%)와 ‘3시간 이후’(30%)에 모두 걸려요.'); p2 = 30; }
      else if (a > 180) { p1 = 30; p2 = 30; }
      r.basis.push(a > 180 ? '3시간 이후(12시간 이내) 대체편 제공: 불이행된 해당 구간 운임의 30%' : '1시간 이후~3시간 이내 대체편 제공: 불이행된 해당 구간 운임의 20%');
      applyFare(r, ctx.fare, p1, p2); krSignal(r, c.reason); return r;
    }
    // 국제선: USD 정액(최고 한도)
    r.currency = 'USD'; r.cap = true;
    r.notes.push('금액은 숙식비 포함 최고 한도예요(체재 필요 시 적정 숙식비 등 경비 포함).');
    if (c.lateCheckin === 'yes') { r.eligible = false; r.basis.push('각 항공사가 정한 탑승수속 마감시간 이후에 도착했다면 이 기준에서 제외돼요.'); return r; }
    if (c.lateCheckin !== 'no') r.uncertain.push('탑승수속 마감시간 이후 도착자는 제외돼요. 마감 전에 도착했는지 확인하세요.');
    var dist = ctx.distanceKm, longRoute = dist === null ? null : dist > 3500;
    if (dist === null) r.uncertain.push('운항 거리를 알 수 없어 4시간(3,500km) 이내·초과 노선 금액을 범위로 보여 드려요.');
    else r.basis.push('운항시간 4시간은 운항거리 3,500km와 같게 봐요. 이 노선은 약 ' + Math.round(dist).toLocaleString('en-US') + 'km → ' + (longRoute ? '4시간 초과 노선' : '4시간 이내 노선') + '이에요.');
    if (c.altRejected) r.notes.push('대체편을 거절했다면: 불이행된 해당 구간 운임 환급 및 ‘최초 대체편 제공 가능 시기’를 기준으로 아래 금액에 준해 배상해요.');
    function set(lo, hi) { r.amountMin = lo; r.amountMax = hi; }
    if (noAlt) {
      r.eligible = true; set(600, 600); r.textAmount = '운임 환급 + USD 600 (최고 한도)';
      r.basis.push('대체편을 제공하지 못한 경우: 불이행된 해당 구간 운임 환급 및 USD 600 배상');
      krSignal(r, c.reason); return r;
    }
    if (a === null) { r.eligible = null; r.uncertain.push('대체편으로 얼마나 늦게 도착했는지 알려 주시면 판정할 수 있어요.'); return r; }
    if (a < 120) { r.eligible = false; r.basis.push('국제선은 2시간 이후 대체편부터 배상 금액이 있어요(목적지 도착 기준).'); return r; }
    r.eligible = true;
    var lo = a > 240 ? 400 : 200, hi = a > 240 ? 600 : 300;
    if (longRoute === true) set(hi, hi); else if (longRoute === false) set(lo, lo); else set(lo, hi);
    if (a === 120) { r.uncertain.push('정확히 2시간은 원문 ‘2시간 이후’의 시작점이라 해석이 갈릴 수 있어요.'); r.amountMin = 0; }
    r.basis.push((a > 240 ? '4시간 초과 대체편 제공' : '2시간 이후~4시간 이내 대체편 제공') + ': ' + (longRoute === null ? 'USD ' + lo + '(4시간 이내 노선) 또는 USD ' + hi + '(4시간 초과 노선)' : 'USD ' + r.amountMax) + ' 배상(숙식비 포함 최고 한도)');
    krSignal(r, c.reason);
    return r;
  }

  /* ---------- EU261: Regulation (EC) No 261/2004 ---------- */
  function euBand(dist, intra) {
    if (dist === null) return null;
    if (dist <= 1500) return { key: 'A', full: 250, reduceWithin: 120, label: '1,500km 이하' };
    if (intra) return { key: 'B', full: 400, reduceWithin: 180, label: 'EU 역내 1,500km 초과' };
    if (dist <= 3500) return { key: 'B', full: 400, reduceWithin: 180, label: '1,500~3,500km' };
    return { key: 'C', full: 600, reduceWithin: 240, label: '3,500km 초과' };
  }
  function euScope(c, ctx) {
    var f = ctx.fromRegion, t = ctx.toRegion, carrier = ctx.isEuCarrier;
    var s = { applies: false, maybe: false, why: '', notes: [] };
    if (f === 'EU') {
      s.applies = true; s.why = 'EU(또는 EEA·스위스) 공항에서 출발한 항공편이라 항공사와 관계없이 적용돼요(제3조 1항 a호).';
      if (ctx.fromNonEu) { s.maybe = true; s.notes.push('출발 공항이 EU 회원국이 아닌 EEA·스위스예요. 협정에 따라 적용되는 것으로 알려져 있지만 이 앱에서 원문을 확인하지 못했어요.'); }
      return s;
    }
    if (t === 'EU') {
      if (carrier === true) {
        s.applies = true; s.why = 'EU 밖에서 EU로 오는 편이고 운항 항공사가 EU 항공사라 적용돼요(제3조 1항 b호).';
        s.notes.push('출발국에서 이미 보상·지원을 받았다면 적용되지 않아요(제3조 1항 b호 단서).');
        if (ctx.toNonEu) { s.maybe = true; s.notes.push('도착 공항이 EU 회원국이 아닌 EEA·스위스예요. 적용 여부를 항공사에 확인하세요.'); }
        return s;
      }
      if (carrier === null) { s.applies = true; s.maybe = true; s.why = 'EU로 오는 편은 운항 항공사가 EU 항공사일 때만 적용돼요(제3조 1항 b호).'; s.notes.push('운항 항공사가 EU 항공사인지 확인하세요. 공동운항이면 실제로 비행기를 운항한 항공사 기준이에요.'); return s; }
      s.why = 'EU 출발이 아니고 운항 항공사도 EU 항공사가 아니어서 EU261 미적용이에요(제3조 1항).';
      return s;
    }
    s.why = 'EU 공항을 출발하거나 도착하는 노선이 아니어서 EU261 미적용이에요.';
    return s;
  }
  function eu261(c, ctx) {
    var r = baseResult('EU261', 'EU261 (EU 항공 승객 보상 규정)');
    r.currency = 'EUR'; r.sources = ['eu261'];
    var sc = euScope(c, ctx);
    if (!sc.applies) { r.applies = false; r.eligible = false; r.basis.push(sc.why); return r; }
    r.basis.push(sc.why);
    sc.notes.forEach(function (n) { (sc.maybe ? r.uncertain : r.notes).push(n); });
    if (sc.maybe && !sc.notes.length) r.uncertain.push(sc.why);
    var band = euBand(ctx.distanceKm, ctx.fromRegion === 'EU' && ctx.toRegion === 'EU');
    if (band) r.basis.push('대권거리 약 ' + Math.round(ctx.distanceKm).toLocaleString('en-US') + 'km(' + band.label + ') → 보상액 ' + band.full + '유로(제7조 1항).');
    else r.uncertain.push('운항 거리를 알 수 없어 250~600유로 범위로 보여 드려요.');
    var full = band ? band.full : 600, low = band ? band.full : 250;
    var reduced = false, eligible = true, m;
    if (c.type === 'overbook' && c.lateCheckin === 'yes') {
      r.eligible = false; r.signal = 'gray'; r.basis.push('안내된 시각(없으면 출발 45분 전)까지 체크인하지 않았다면 적용되지 않아요(제3조 2항).'); return r;
    }
    if (c.type === 'delay') {
      m = num(c.delayMinutes); r.sources.push('eu_sturgeon');
      if (m === null) { r.eligible = null; r.signal = 'yellow'; r.uncertain.push('도착 지연 시간을 알려 주시면 판정할 수 있어요.'); return r; }
      if (m < 180) { r.eligible = false; r.signal = 'gray'; r.basis.push('지연 보상은 최종 목적지에 3시간 이상 늦게 도착했을 때부터예요(Sturgeon 판결). 지금은 ' + hm(m) + ' 지연이라 EU261 보상 미해당이에요(식사 등 지원은 별도).'); return r; }
      r.basis.push('규정 본문(제6조)은 지연에 지원만 정하고 있고, 도착 3시간 이상 지연의 보상은 EU 사법재판소 Sturgeon 판결(C-402/07·C-432/07)이 결항과 같게 본 해석이에요.');
      if (band && m <= band.reduceWithin) reduced = true;
    } else if (c.type === 'cancel') {
      var n = num(c.noticeDaysBefore); m = c.noAlt ? null : num(c.delayMinutes);
      if (n !== null && n >= 14) { r.eligible = false; r.signal = 'gray'; r.basis.push('EU261 미해당: 출발 2주(14일) 이상 전에 결항을 통보받으면 보상 대상이 아니에요(제5조 1항 c호 i). 환불·대체편 선택권(제8조)은 남아 있어요.'); return r; }
      if (n === null) { eligible = null; r.uncertain.push('결항을 언제 통보받았는지에 따라 달라요. 출발 14일 이상 전 통보면 보상 미해당이에요(제5조 1항 c호).'); }
      else if (n >= 7 && !c.noAlt && m !== null && m < 240) { eligible = null; r.uncertain.push('출발 7~13일 전 통보 + 대체편이 원래보다 2시간 이내로 앞당겨 출발하고 4시간 안에 도착했다면 미해당이에요(제5조 1항 c호 ii). 대체편 출발 시각을 확인하세요.'); }
      else if (n < 7 && !c.noAlt && m !== null && m < 120) { eligible = null; r.uncertain.push('출발 7일 이내 통보 + 대체편이 원래보다 1시간 이내로 앞당겨 출발하고 2시간 안에 도착했다면 미해당이에요(제5조 1항 c호 iii). 대체편 출발 시각을 확인하세요.'); }
      if (!c.noAlt && m === null) r.uncertain.push('대체편 도착 지연 시간을 알려 주시면 감액 여부까지 계산해요.');
      if (band && m !== null && m <= band.reduceWithin) reduced = true;
      r.basis.push('결항 보상은 제5조 1항 c호와 제7조에 따라요.');
    } else {
      m = c.noAlt ? null : num(c.altFlightDelayMinutes);
      r.basis.push('본인 의사에 반해 탑승을 거절당하면 즉시 제7조에 따라 보상해야 해요(제4조 3항). 자발적으로 좌석을 양보했다면 합의한 혜택이 대신 적용돼요(제4조 1항).');
      if (band && m !== null && m <= band.reduceWithin) reduced = true;
    }
    r.eligible = eligible;
    if (reduced) {
      r.amountMin = full / 2; r.amountMax = full;
      r.basis.push('도착 지연이 ' + (band.reduceWithin / 60) + '시간 이내라 항공사가 50% 감액할 수 있어요(제7조 2항' + (c.type === 'delay' ? ', 지연에도 준용 — Sturgeon 판결 63항' : '') + '). 감액하면 ' + (full / 2) + '유로, 감액하지 않으면 ' + full + '유로예요.');
    } else { r.amountMin = low; r.amountMax = full; }
    // 신호: 제5조 3항 비상 상황(extraordinary circumstances)은 항공사가 증명해야 면제
    if (eligible === null) r.signal = 'yellow';
    else if (c.type === 'overbook') r.signal = 'green';
    else if (c.reason === 'maintenance') {
      r.signal = 'green'; r.sources.push('eu_wallentin');
      r.notes.push('일상적인 기술 결함·정비는 원칙적으로 ‘비상 상황’이 아니에요(Sturgeon·Wallentin-Hermann 판결). 드문 예외(제조사가 알린 숨은 결함 등)는 항공사가 증명해야 해요.');
    } else if (c.reason === 'weather' || c.reason === 'airport' || c.reason === 'connection') {
      r.signal = 'yellow'; r.needsReasonRequest = true;
      r.notes.push('항공사가 피할 수 없었던 비상 상황(기상·관제·공항 사정 등)을 증명하면 보상이 면제돼요(제5조 3항). 앞편 지연은 그 앞편의 원인에 따라 달라요.');
    } else r.signal = 'green';
    r.notes.push('개정 규정 (EU) 2026/2202는 2027-10-23부터 적용돼요. 지금은 기존 규정 기준이에요.');
    r.sources.push('eu_2026');
    return r;
  }

  /* ---------- 종합 판정 ---------- */
  function routeContext(c, airports) {
    var A = indexAirports(airports), f = A[c.from], t = A[c.to];
    var fromRegion = f ? f.region : (c.fromRegion || null), toRegion = t ? t.region : (c.toRegion || null);
    var dist = (f && t) ? haversine(f.lat, f.lon, t.lat, t.lon) : num(c.distanceKm);
    var al = airlineByCode(c.airlineCode);
    var isEu = typeof c.isEuCarrier === 'boolean' ? c.isEuCarrier : (al ? al.isEuCarrier : null);
    return { from: f || null, to: t || null, fromRegion: fromRegion, toRegion: toRegion, fromNonEu: !!(f && f.nonEu), toNonEu: !!(t && t.nonEu),
      distanceKm: dist === null ? null : Math.round(dist), domestic: fromRegion === 'KR' && toRegion === 'KR', isEuCarrier: isEu };
  }
  function evaluate(c, airports) {
    c = c || {};
    var ctx = routeContext(c, airports);
    ctx.fare = fareInfo(c.fareTotal, c.fareTaxes);
    var kr = c.type === 'overbook' ? krOverbook(c, ctx) : krDelay(c, ctx);
    if (ctx.fromRegion !== 'KR' && ctx.toRegion !== 'KR') kr.uncertain.push('한국 공항을 오가지 않는 노선은 한국 기준 적용 여부가 항공사·구매처에 따라 달라요.');
    var eu = eu261(c, ctx);
    var showEu = ctx.fromRegion === 'EU' || ctx.toRegion === 'EU';
    var list = [];
    var euOk = eu.applies && eu.eligible !== false, krOk = kr.eligible !== false && kr.eligible !== null;
    var primary;
    if (euOk) { primary = eu; list = [eu, kr]; }
    else if (krOk || kr.eligible === null) { primary = kr; list = showEu ? [kr, eu] : [kr]; }
    else { primary = null; list = showEu ? [kr, eu] : [kr]; }
    var regime = primary ? primary.regime : 'NONE';
    var top = primary || kr;
    var uncertain = list.some(function (r) { return r.uncertain.length > 0; });
    var res = {
      regime: regime,
      amountMin: top.amountMin, amountMax: top.amountMax, currency: top.currency,
      signal: regime === 'NONE' ? 'gray' : top.signal,
      basis: top.basis.slice(),
      primary: top.regime, results: list, kr: kr, eu: eu, euShown: showEu,
      distanceKm: ctx.distanceKm, domestic: ctx.domestic, fareMode: ctx.fare.mode, fareBase: ctx.fare.base,
      uncertain: uncertain,
      needsReasonRequest: list.some(function (r) { return r.needsReasonRequest && r.eligible !== false; }),
      notices: [MEAL_NOTICE, DISCLAIMER],
      complexNote: '경유·공동운항이면 최종 목적지 도착 시각과 실제 운항 항공사를 기준으로 항공사에 문의하세요.',
      rulesVersion: RULES_VERSION
    };
    return res;
  }
  function signalLabel(s) { return SIGNAL_LABEL[s] || SIGNAL_LABEL.gray; }

  /* ---------- 금액 표시 ---------- */
  function fmtMoney(v, cur) {
    if (v === null || v === undefined) return '';
    if (cur === 'KRW') return Math.round(v).toLocaleString('ko-KR') + '원';
    if (cur === 'USD') return 'USD ' + Math.round(v).toLocaleString('en-US');
    if (cur === 'EUR') return Math.round(v).toLocaleString('en-US') + '유로';
    return String(v);
  }
  function amountText(r) {
    if (!r) return '';
    if (r.amountMax === null || r.amountMax === undefined) return r.textAmount || '';
    var s = r.amountMin === r.amountMax || r.amountMin === null ? fmtMoney(r.amountMax, r.currency) : fmtMoney(r.amountMin, r.currency) + ' ~ ' + fmtMoney(r.amountMax, r.currency);
    if (r.upperBound || r.cap) s = '최대 ' + s;
    return s;
  }
  function toKRW(v, cur, fx) {
    if (v === null || v === undefined) return null;
    if (cur === 'KRW') return v;
    var rate = fx && (cur === 'USD' ? num(fx.USD) : cur === 'EUR' ? num(fx.EUR) : null);
    return rate ? Math.round(v * rate) : null;
  }

  /* ---------- 대행 실수령 비교 (수수료율은 예시) ---------- */
  var AGENCY_EXAMPLES = [
    { id: 'a25', label: '성공보수 25% + 부가세 예시', rate: 0.25, vat: 0.1 },
    { id: 'a35', label: '성공보수 35% 예시', rate: 0.35, vat: 0 }
  ];
  function agencyNet(amount) {
    var a = num(amount); if (a === null) return [];
    return [{ id: 'direct', label: '직접 청구', fee: 0, net: a }].concat(AGENCY_EXAMPLES.map(function (x) {
      var fee = Math.round(a * x.rate * (1 + x.vat) * 100) / 100;
      return { id: x.id, label: x.label, fee: fee, net: Math.round((a - fee) * 100) / 100 };
    }));
  }

  /* ---------- 문안 템플릿 ---------- */
  var FOOT_KO = '{today}\n첨부: 탑승권, 지연 안내 문자 캡처, 영수증';
  var TEMPLATES = {
    claim_ko: '[항공편 지연·결항 배상 청구서]\n\n수신: {airline} 고객센터(피해구제 접수 담당)\n청구인: {name}\n\n1. 사실관계\n- 편명/운항일: {flightNo} / {date}\n- 구간: {from} → {to}\n- 예정 도착: {scheduledArr}\n- 실제 도착: {actualArr} ({delayText})\n- 항공사가 안내한 사유: {reasonSaid}\n\n2. 적용 기준\n{basis}\n\n3. 청구 금액\n{amount}\n(기준 운임 {fareBase}, 유류할증료·공항이용료·수수료 제외)\n\n4. 면책 사유를 주장하시는 경우\n지연·결항 사유가 기상, 공항 사정, 항공기 정비, 앞편 지연 등 면책 사유에 해당한다고 보신다면 이를 증명할 자료(정비 기록, 기상 자료, 운항 기록 등)를 서면으로 제공해 주시기 바랍니다.\n\n5. 회신 요청\n항공사업법 제61조에 따른 처리 기한(접수일부터 14일) 안에 처리 결과를 회신해 주시기 바랍니다.\n\n입금 계좌: (은행 / 계좌번호 / 예금주)\n연락처: (전화 / 이메일)\n\n' + FOOT_KO,
    claim_en: 'Subject: Compensation claim — flight {flightNo} on {date}\n\nDear {airlineEn} Customer Relations,\n\nI was a passenger on flight {flightNo} from {fromEn} to {toEn} on {date}.\n- Scheduled arrival: {scheduledArr}\n- Actual arrival: {actualArr} ({delayTextEn})\n- Reason given by the airline: {reasonSaidEn}\n- Great-circle distance: approx. {distanceKm} km\n\n{legalBasisEn}\n\nI therefore request compensation of {amountEn}.\nIf you consider that extraordinary circumstances apply, please provide supporting evidence in writing.\n\nPlease reply within 14 days of receipt of this claim.\n\nName: {name}\nBooking reference: ( )\nBank details: ( )\nContact: ( )\n\n{todayEn}\nAttachments: boarding pass, screenshot of the delay notice, receipts',
    reason_request_ko: '[지연·결항 사유 및 증빙 자료 제공 요청]\n\n수신: {airline} 고객센터\n요청인: {name}\n\n- 편명/운항일: {flightNo} / {date}\n- 구간: {from} → {to}\n- 예정 도착 {scheduledArr} / 실제 도착 {actualArr} ({delayText})\n- 안내받은 사유: {reasonSaid}\n\n소비자분쟁해결기준(공정거래위원회 고시) 항공 부분에 따르면 기상 사정, 공항 사정, 항공기 접속관계(앞편 지연), 국토교통부 인가 정비 기준에 따른 점검 등은 항공사가 이를 증명한 경우에만 배상에서 제외됩니다.\n사유를 확인할 수 있도록 아래 자료를 서면(이메일 가능)으로 제공해 주시기 바랍니다.\n\n1. 지연·결항의 구체적인 사유와 발생 시각\n2. 앞편 지연이라면 해당 앞편의 편명과 지연 사유\n3. 정비라면 정비 내용과 사전에 예견할 수 없었다는 근거\n4. 기상·공항 사정이라면 관련 기상 자료 또는 공항 운영 정보\n\n' + FOOT_KO,
    ccn1372_summary_ko: '[1372 상담용 요약]\n\n- 사건: {typeText} / {flightNo} / {date} / {from} → {to}\n- 지연: 예정 도착 {scheduledArr}, 실제 도착 {actualArr} ({delayText})\n- 항공사 안내 사유: {reasonSaid}\n- 적용 기준(참고): {basis}\n- 청구액(참고용 예상치): {amount}\n- 항공사 청구일: {sentDate} / 항공사 회신: {replyText}\n- 요청 사항: 소비자분쟁해결기준에 따른 배상과 숙식비 등 경비 처리 확인\n\n' + FOOT_KO
  };
  var TEMPLATE_LABELS = { claim_ko: '배상 청구서(한국어)', claim_en: 'Claim letter (English)', reason_request_ko: '사유 증빙 요청서', ccn1372_summary_ko: '1372 상담용 요약' };
  var REASONS_EN = { weather: 'weather', maintenance: 'technical/maintenance issue', connection: 'late arrival of the previous flight', airport: 'airport circumstances', none: 'no reason given', other: 'other' };

  function fill(tpl, vars) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      var v = vars[k];
      return (v === undefined || v === null || v === '') ? '(확인 필요)' : String(v);
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtDT(s) { if (!s) return ''; return String(s).replace('T', ' '); }
  function buildVars(claim, ev, opts) {
    opts = opts || {};
    var A = indexAirports(opts.airports), f = A[claim.from], t = A[claim.to];
    var al = airlineByCode(claim.airlineCode);
    var top = ev && ev.results ? (ev.results.filter(function (r) { return r.regime === ev.primary; })[0] || ev.results[0]) : null;
    var isEu = top && top.regime === 'EU261';
    var amt = top ? amountText(top) : '';
    var amtEn = top ? (top.amountMax !== null && top.amountMax !== undefined ? (top.currency === 'EUR' ? 'EUR ' + top.amountMax : top.currency === 'USD' ? 'USD ' + top.amountMax : 'KRW ' + Math.round(top.amountMax).toLocaleString('en-US')) : (top.textAmount || '')) : '';
    var today = opts.today ? new Date(opts.today) : new Date();
    var legal = isEu
      ? 'Under Regulation (EC) No 261/2004 (Articles 5 and 7), as interpreted by the Court of Justice of the EU in Sturgeon (C-402/07 and C-432/07), passengers who reach their final destination three hours or more late are entitled to compensation. For this distance band the amount is EUR ' + top.amountMax + ' (Article 7(1)).'
      : 'Under the Korean Consumer Dispute Resolution Standards (Fair Trade Commission Notice No. 2025-14, Annex 2, air transport), the airline compensates passengers for delays measured at arrival unless it proves an exemption ground.';
    var delayMin = claim.type === 'overbook' ? claim.altFlightDelayMinutes : claim.delayMinutes;
    return {
      name: claim.name || opts.name || '',
      airline: al && al.code !== 'UNKNOWN' && al.code !== 'OTHER' && al.code !== 'EU_OTHER' ? al.nameKo + '(' + al.code + ')' : '',
      airlineEn: al && al.code.length === 2 ? al.code : 'the airline',
      flightNo: claim.flightNo || '', date: claim.date || '',
      from: f ? f.city + '(' + f.code + ')' : (claim.from || ''), to: t ? t.city + '(' + t.code + ')' : (claim.to || ''),
      fromEn: f ? f.code : (claim.from || ''), toEn: t ? t.code : (claim.to || ''),
      scheduledArr: fmtDT(claim.scheduledArr), actualArr: fmtDT(claim.actualArr),
      delayText: num(delayMin) === null ? '' : delayText(delayMin),
      delayTextEn: num(delayMin) === null ? '' : (Math.floor(num(delayMin) / 60) + 'h ' + (num(delayMin) % 60) + 'min late'),
      fareBase: ev && ev.fareBase !== null && ev.fareBase !== undefined ? fmtMoney(ev.fareBase, 'KRW') + (ev.fareMode === 'total' ? '(총액 기준)' : '') : '',
      amount: amt ? amt + ' (참고용 예상치)' : '', amountEn: amtEn,
      basis: top ? top.basis.join('\n') : '',
      reasonSaid: REASONS[claim.reason] || '', reasonSaidEn: REASONS_EN[claim.reason] || '',
      distanceKm: ev && ev.distanceKm !== null ? ev.distanceKm.toLocaleString('en-US') : '',
      legalBasisEn: legal,
      typeText: TYPES[claim.type] || '',
      sentDate: claim.sentAt ? String(claim.sentAt).slice(0, 10) : '',
      replyText: claim.stage === 'replied' || claim.stage === 'ccn1372' || claim.stage === 'kca' ? '회신 받음' : (claim.sentAt ? '아직 없음' : ''),
      today: ymd(today), todayEn: ymd(today)
    };
  }

  /* ---------- 14일 D-day (항공사업법 제61조 3항) ---------- */
  function dday(sentAt, now) {
    if (!sentAt) return null;
    var s = new Date(String(sentAt).slice(0, 10) + 'T00:00:00');
    if (isNaN(s.getTime())) return null;
    var due = new Date(s.getTime()); due.setDate(due.getDate() + 14);
    var n = now ? new Date(now) : new Date();
    var today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    var left = Math.round((due.getTime() - today.getTime()) / 86400000);
    return { due: ymd(due), left: left, overdue: left < 0, label: left > 0 ? 'D-' + left : left === 0 ? 'D-day' : 'D+' + (-left) };
  }

  /* ---------- 저장 데이터 정리 ---------- */
  var TYPE_SET = { delay: 1, cancel: 1, overbook: 1 }, REASON_SET = REASONS, STAGE_SET = {};
  STAGES.forEach(function (s) { STAGE_SET[s.id] = 1; });
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function emptyState() { return { version: 1, settings: { lang: 'ko', fxUSD: null, fxEUR: null, fxUpdatedAt: null, fxSource: null, onboarded: false, name: '' }, claims: [], airport: { checks: {}, waitStart: null } }; }
  function sanitizeClaim(c) {
    if (!c || typeof c !== 'object') return null;
    var o = {
      id: str(c.id, 40) || ('c_' + Date.now()), createdAt: str(c.createdAt, 40),
      type: TYPE_SET[c.type] ? c.type : 'delay', flightNo: str(c.flightNo, 12).toUpperCase(), date: str(c.date, 10),
      from: str(c.from, 8), to: str(c.to, 8), airlineCode: str(c.airlineCode, 10),
      isEuCarrier: typeof c.isEuCarrier === 'boolean' ? c.isEuCarrier : null,
      scheduledArr: str(c.scheduledArr, 20), actualArr: str(c.actualArr, 20),
      delayMinutes: num(c.delayMinutes), altFlightDelayMinutes: num(c.altFlightDelayMinutes), noticeDaysBefore: num(c.noticeDaysBefore),
      noAlt: !!c.noAlt, altRejected: !!c.altRejected, lateCheckin: c.lateCheckin === 'yes' || c.lateCheckin === 'no' ? c.lateCheckin : 'unknown',
      reason: REASON_SET[c.reason] ? c.reason : 'none',
      fareTotal: num(c.fareTotal), fareTaxes: num(c.fareTaxes), fareBase: num(c.fareBase), distanceKm: num(c.distanceKm),
      fromRegion: c.fromRegion === 'KR' || c.fromRegion === 'EU' || c.fromRegion === 'OTHER' ? c.fromRegion : null,
      toRegion: c.toRegion === 'KR' || c.toRegion === 'EU' || c.toRegion === 'OTHER' ? c.toRegion : null,
      result: c.result && typeof c.result === 'object' ? {
        regime: str(c.result.regime, 20), amountMin: num(c.result.amountMin), amountMax: num(c.result.amountMax), currency: str(c.result.currency, 3),
        signal: c.result.signal === 'green' || c.result.signal === 'yellow' ? c.result.signal : 'gray',
        basis: Array.isArray(c.result.basis) ? c.result.basis.filter(function (b) { return typeof b === 'string'; }).slice(0, 12).map(function (b) { return b.slice(0, 400); }) : []
      } : null,
      checklist: { reasonInWriting: !!(c.checklist && c.checklist.reasonInWriting), screenshot: !!(c.checklist && c.checklist.screenshot), receipts: !!(c.checklist && c.checklist.receipts) },
      sentAt: str(c.sentAt, 40) || null, stage: STAGE_SET[c.stage] ? c.stage : 'draft', memo: str(c.memo, 1000), name: str(c.name, 40)
    };
    if (o.delayMinutes !== null && (o.delayMinutes < 0 || o.delayMinutes > 10080)) o.delayMinutes = null;
    return o;
  }
  function sanitizeState(raw) {
    var s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    var st = raw.settings || {};
    s.settings.lang = st.lang === 'en' ? 'en' : 'ko';
    s.settings.fxUSD = num(st.fxUSD) && num(st.fxUSD) > 0 ? num(st.fxUSD) : null;
    s.settings.fxEUR = num(st.fxEUR) && num(st.fxEUR) > 0 ? num(st.fxEUR) : null;
    s.settings.fxUpdatedAt = str(st.fxUpdatedAt, 40) || null;
    s.settings.fxSource = st.fxSource === 'api' || st.fxSource === 'manual' ? st.fxSource : null;
    s.settings.onboarded = !!st.onboarded; s.settings.name = str(st.name, 40);
    if (Array.isArray(raw.claims)) s.claims = raw.claims.map(sanitizeClaim).filter(Boolean).slice(0, 200);
    if (raw.airport && typeof raw.airport === 'object') {
      var ch = raw.airport.checks || {}; Object.keys(ch).slice(0, 30).forEach(function (k) { if (/^[a-z0-9_]{1,30}$/.test(k)) s.airport.checks[k] = !!ch[k]; });
      s.airport.waitStart = num(raw.airport.waitStart);
    }
    return s;
  }

  /* ---------- 스펙 §12 테스트 케이스 (node 테스트와 앱 runSelfTest가 함께 씀) ---------- */
  var TEST_CASES = [
    { id: 'TC1', name: '김포→제주 160분, 총액 59,000·세금 15,000, 안내 없음', claim: { type: 'delay', from: 'GMP', to: 'CJU', airlineCode: 'LJ', delayMinutes: 160, reason: 'none', fareTotal: 59000, fareTaxes: 15000 },
      expect: { regime: 'KR_DOM', amountMin: 8800, amountMax: 8800, currency: 'KRW', signal: 'green' } },
    { id: 'TC2', name: '김포→제주 50분', claim: { type: 'delay', from: 'GMP', to: 'CJU', airlineCode: 'LJ', delayMinutes: 50, reason: 'none', fareTotal: 59000, fareTaxes: 15000 },
      expect: { regime: 'NONE', signal: 'gray', krEligible: false } },
    { id: 'TC3', name: '인천→방콕 5시간, 기준 운임 300,000, 앞편 지연', claim: { type: 'delay', from: 'ICN', to: 'BKK', airlineCode: '7C', delayMinutes: 300, reason: 'connection', fareTotal: 300000, fareTaxes: 0 },
      expect: { regime: 'KR_INTL', amountMin: 60000, amountMax: 60000, currency: 'KRW', signal: 'yellow', needsReasonRequest: true } },
    { id: 'TC4', name: '파리(CDG)→인천 5시간, 정비', claim: { type: 'delay', from: 'CDG', to: 'ICN', airlineCode: 'AF', delayMinutes: 300, reason: 'maintenance', fareTotal: 1200000, fareTaxes: 300000 },
      expect: { regime: 'EU261', amountMin: 600, amountMax: 600, currency: 'EUR', signal: 'green', krShown: true, krSignal: 'yellow' } },
    { id: 'TC5', name: '파리(CDG)→인천 3시간 30분', claim: { type: 'delay', from: 'CDG', to: 'ICN', airlineCode: 'AF', delayMinutes: 210, reason: 'none' },
      expect: { regime: 'EU261', amountMin: 300, amountMax: 600, currency: 'EUR' } },
    { id: 'TC6', name: '인천→파리 대한항공(KE) 5시간', claim: { type: 'delay', from: 'ICN', to: 'CDG', airlineCode: 'KE', delayMinutes: 300, reason: 'none', fareTotal: 1000000, fareTaxes: 0 },
      expect: { regime: 'KR_INTL', euApplies: false, amountMax: 200000, currency: 'KRW' } },
    { id: 'TC7', name: '인천→파리 에어프랑스(AF) 5시간', claim: { type: 'delay', from: 'ICN', to: 'CDG', airlineCode: 'AF', delayMinutes: 300, reason: 'none' },
      expect: { regime: 'EU261', euApplies: true, amountMax: 600, currency: 'EUR' } },
    { id: 'TC8', name: '국제선 초과판매, 4시간 이내 노선(인천→나리타), 대체편 3시간 후', claim: { type: 'overbook', from: 'ICN', to: 'NRT', airlineCode: 'KE', altFlightDelayMinutes: 180, lateCheckin: 'no', reason: 'none' },
      expect: { regime: 'KR_INTL_OVERBOOK', amountMax: 200, currency: 'USD', textIncludes: '숙식비 포함 최고 한도' } },
    { id: 'TC9', name: '결항, 출발 20일 전 통보(파리→인천)', claim: { type: 'cancel', from: 'CDG', to: 'ICN', airlineCode: 'AF', noticeDaysBefore: 20, delayMinutes: 90, reason: 'none' },
      expect: { euEligible: false, euTextIncludes: 'EU261 미해당' } }
  ];
  function checkCase(tc, airports) {
    var ev = evaluate(tc.claim, airports), e = tc.expect, fails = [];
    function eq(label, got, want) { if (got !== want) fails.push(label + ': ' + JSON.stringify(got) + ' ≠ ' + JSON.stringify(want)); }
    var top = ev.results.filter(function (r) { return r.regime === ev.primary; })[0];
    if ('regime' in e) eq('regime', ev.regime, e.regime);
    if ('amountMin' in e) eq('amountMin', top.amountMin, e.amountMin);
    if ('amountMax' in e) eq('amountMax', top.amountMax, e.amountMax);
    if ('currency' in e) eq('currency', top.currency, e.currency);
    if ('signal' in e) eq('signal', ev.signal, e.signal);
    if ('krEligible' in e) eq('krEligible', ev.kr.eligible, e.krEligible);
    if ('needsReasonRequest' in e) eq('needsReasonRequest', ev.needsReasonRequest, e.needsReasonRequest);
    if ('euApplies' in e) eq('euApplies', ev.eu.applies, e.euApplies);
    if ('euEligible' in e) eq('euEligible', ev.eu.eligible, e.euEligible);
    if ('krShown' in e) eq('krShown', ev.results.indexOf(ev.kr) >= 0, e.krShown);
    if ('krSignal' in e) eq('krSignal', ev.kr.signal, e.krSignal);
    if (e.textIncludes) { var all = JSON.stringify(ev.results); if (all.indexOf(e.textIncludes) < 0) fails.push('text missing: ' + e.textIncludes); }
    if (e.euTextIncludes && ev.eu.basis.join(' ').indexOf(e.euTextIncludes) < 0) fails.push('EU text missing: ' + e.euTextIncludes);
    if (ev.notices.indexOf(DISCLAIMER) < 0) fails.push('disclaimer missing');
    return { id: tc.id, name: tc.name, pass: fails.length === 0, fails: fails, ev: ev };
  }
  function selfTest(airports) {
    var out = TEST_CASES.map(function (tc) { return checkCase(tc, airports); });
    // 규칙 경계 검사
    var extra = [];
    function x(name, cond) { extra.push({ id: 'R', name: name, pass: !!cond, fails: cond ? [] : [name] }); }
    var dom = function (m) { return krDelayBand(m, true); }, intl = function (m) { return krDelayBand(m, false); };
    x('국내 59분 미해당', dom(59).met === false); x('국내 60분 10%', dom(60).pMax === 10); x('국내 120분 경계 10~20%', dom(120).pMin === 10 && dom(120).pMax === 20);
    x('국내 179분 20%', dom(179).pMax === 20); x('국내 181분 30%', dom(181).pMax === 30);
    x('국제 119분 미해당', intl(119).met === false); x('국제 120분 10%', intl(120).pMax === 10); x('국제 240분 경계 10~20%', intl(240).pMin === 10 && intl(240).pMax === 20);
    x('국제 720분 20%', intl(720).pMax === 20); x('국제 721분 30%', intl(721).pMax === 30);
    x('EU 1,500km 이하 250', euBand(1500, false).full === 250); x('EU 3,500km 400', euBand(3500, false).full === 400); x('EU 3,501km 600', euBand(3501, false).full === 600);
    x('EU 역내 4,000km 400', euBand(4000, true).full === 400);
    var d = haversine(49.009, 2.5541, 37.4691, 126.451); x('CDG–ICN 3,500km 초과', d > 3500);
    x('기준 운임 59,000−15,000=44,000', fareInfo(59000, 15000).base === 44000);
    return out.concat(extra);
  }

  var API = {
    CHECKED_AT: CHECKED_AT, RULES_VERSION: RULES_VERSION, AIRLINES: AIRLINES, REASONS: REASONS, TYPES: TYPES, STAGES: STAGES, SIGNAL_LABEL: SIGNAL_LABEL,
    DISCLAIMER: DISCLAIMER, MEAL_NOTICE: MEAL_NOTICE, SOURCES: SOURCES, TEMPLATES: TEMPLATES, TEMPLATE_LABELS: TEMPLATE_LABELS, TEST_CASES: TEST_CASES, AGENCY_EXAMPLES: AGENCY_EXAMPLES,
    num: num, haversine: haversine, searchAirports: searchAirports, airlineByCode: airlineByCode, fareInfo: fareInfo, delayText: delayText, hm: hm,
    krDelayBand: krDelayBand, euBand: euBand, evaluate: evaluate, signalLabel: signalLabel, fmtMoney: fmtMoney, amountText: amountText, toKRW: toKRW,
    agencyNet: agencyNet, fill: fill, buildVars: buildVars, dday: dday, ymd: ymd, emptyState: emptyState, sanitizeState: sanitizeState, sanitizeClaim: sanitizeClaim,
    checkCase: checkCase, selfTest: selfTest
  };
  if (typeof module === 'object' && module.exports) module.exports = API; else root.DCN_RULES = API;
})(typeof self !== 'undefined' ? self : this);
