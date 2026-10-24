/* 서명전에 (Before You Sign) — UI. 계산·규칙은 rules.js(window.BYS)에 있어요. */
(function () {
  'use strict';
  var B = window.BYS;
  var KEY = B.STORAGE_KEY;
  var won = B.won, comma = B.comma, isNum = B.isNum;

  // ---------- utils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function wonHtml(n) { return '<span class="num">' + comma(n) + '</span><span class="unit">원</span>'; }
  function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function catOf(q) { return B.CATEGORIES[q.category] || B.CATEGORIES.etc; }
  function vendorName(q) { return q.vendor && q.vendor.trim() ? q.vendor.trim() : '이름 없는 견적'; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

  // ---------- state ----------
  var S, loadNotice = null;
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return B.defaultState(); }
    if (raw == null) return B.defaultState();
    try { return B.sanitizeState(JSON.parse(raw)); } catch (e) {
      try { localStorage.setItem(KEY + '.corrupt.' + Date.now(), raw); } catch (e2) { /* ignore */ }
      loadNotice = '저장된 데이터를 읽지 못해 백업해 두고 새로 시작해요.';
      var d = B.defaultState();
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e3) { /* ignore */ }
      return d;
    }
  }
  var warned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { if (!warned) { warned = true; toast('이 브라우저에서는 저장이 안 될 수 있어요'); } }
    updateTabs();
  }
  S = load();
  function findQ(id) { for (var i = 0; i < S.quotes.length; i++) if (S.quotes[i].id === id) return S.quotes[i]; return null; }
  function inCompare(id) { return S.compareIds.indexOf(id) >= 0; }

  // ---------- toast / modal / sheet ----------
  var tT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(tT); tT = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function confirmModal(title, body, ok, danger) {
    return new Promise(function (resolve) {
      var root = $('#modal-root'), prev = document.activeElement;
      root.innerHTML = '<div class="modal-bg"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mT" aria-describedby="mB">' +
        '<h2 id="mT">' + esc(title) + '</h2><p id="mB">' + esc(body) + '</p>' +
        '<div class="btn-row"><button class="btn btn-sec" data-m="0">취소</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-m="1">' + esc(ok) + '</button></div></div></div>';
      function done(v) { root.innerHTML = ''; document.removeEventListener('keydown', key, true); if (prev && prev.focus) try { prev.focus({ preventScroll: true }); } catch (e) { } resolve(v); }
      function key(e) { if (e.key === 'Escape') { e.stopPropagation(); done(false); } }
      document.addEventListener('keydown', key, true);
      root.firstChild.addEventListener('click', function (e) {
        var b = e.target.closest('[data-m]');
        if (b) done(b.getAttribute('data-m') === '1'); else if (e.target.classList.contains('modal-bg')) done(false);
      });
      $('[data-m="0"]', root).focus();
    });
  }
  var sheetPrev = null;
  function openSheet(title, html) {
    var root = $('#sheet-root');
    sheetPrev = document.activeElement;
    root.innerHTML = '<div class="backdrop" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shT" tabindex="-1">' +
      '<div class="grab" aria-hidden="true"></div><h2 id="shT">' + esc(title) + '</h2>' + html +
      '<button class="btn btn-sec" data-act="sheet-close" style="margin-top:14px">닫기</button></div>';
    document.body.classList.add('locked');
    root.firstChild.getBoundingClientRect();
    requestAnimationFrame(function () { $$('.backdrop,.sheet', root).forEach(function (e) { e.classList.add('open'); }); $('.sheet', root).focus({ preventScroll: true }); });
  }
  function closeSheet() {
    var root = $('#sheet-root');
    if (!root.firstChild) return;
    $$('.backdrop,.sheet', root).forEach(function (e) { e.classList.remove('open'); });
    document.body.classList.remove('locked');
    setTimeout(function () { root.innerHTML = ''; }, reduced() ? 0 : 220);
    if (sheetPrev && sheetPrev.focus) try { sheetPrev.focus({ preventScroll: true }); } catch (e) { }
  }
  function infoSheet(key) {
    var h = B.FIELD_HELP[key];
    if (h) openSheet(h.t, '<p>' + esc(h.d) + '</p>');
  }
  function infoBtn(key) { return '<button type="button" class="info" data-act="info" data-k="' + key + '" aria-label="' + esc(B.FIELD_HELP[key].t) + ' 설명 보기"><span aria-hidden="true">i</span>설명</button>'; }

  // ---------- router ----------
  var navCount = 0, skipCount = false;
  var currentRoute = null;
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function replaceTo(hash) { if (location.hash === hash) { render(); return; } skipCount = true; location.replace(hash); }
  function parse() {
    var h = location.hash || '';
    if (h.indexOf('#s=') === 0) return { name: 'shared', payload: h.slice(3) };
    h = h.replace(/^#\/?/, '');
    var qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, qs = qi >= 0 ? h.slice(qi + 1) : '';
    var query = {};
    qs.split('&').forEach(function (p) { if (p) { var kv = p.split('='); try { query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); } catch (e) { } } });
    var parts = path.split('/').filter(Boolean);
    if (!parts.length) return { name: 'start', query: query };
    if (parts[0] === 'quote') {
      if (parts[1] === 'new') return { name: 'wizard', id: null, query: query };
      var id = parts[1] || '';
      try { id = decodeURIComponent(id); } catch (e) { }
      var sub = parts[2] || '';
      if (sub === 'edit') return { name: 'wizard', id: id, query: query };
      if (sub === 'questions') return { name: 'questions', id: id, query: query };
      if (sub === 'print') return { name: 'print', id: id, query: query };
      return { name: 'result', id: id, query: query };
    }
    return { name: parts[0], query: query };
  }
  var TAB_OF = { start: 'quote', store: 'quote', wizard: 'quote', result: 'quote', questions: 'quote', print: 'quote', shared: 'quote', compare: 'compare', help: 'help', checklist: 'help' };
  var TITLES = { start: '', store: '매장 정보', wizard: '견적 입력', result: '계산 결과', questions: '확인 질문지', print: '인쇄 리포트', shared: '공유받은 견적', compare: '견적 비교', help: '도움', checklist: '계약 전 체크리스트' };

  function updateTabs() {
    var r = currentRoute || { name: 'start' };
    $$('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === TAB_OF[r.name];
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    var c = $('#cmpCount'); c.hidden = !S.compareIds.length; c.textContent = S.compareIds.length;
    $('.tab[data-tab="compare"]').setAttribute('aria-label', '비교' + (S.compareIds.length ? ', ' + S.compareIds.length + '개 선택됨' : ''));
  }

  function render() {
    var r = parse();
    var prevName = currentRoute && currentRoute.name + (currentRoute.id || '');
    currentRoute = r;
    closeSheet();
    var v = $('#view'), html;
    try {
      switch (r.name) {
        case 'start': html = viewStart(); break;
        case 'store': html = viewStore(r); break;
        case 'wizard': html = viewWizard(r); break;
        case 'result': html = viewResult(r); break;
        case 'questions': html = viewQuestions(r); break;
        case 'print': html = viewPrint(r); break;
        case 'compare': html = viewCompare(); break;
        case 'checklist': html = viewChecklist(r); break;
        case 'help': html = viewHelp(); break;
        case 'shared': html = viewShared(r); break;
        default: replaceTo('#/'); return;
      }
    } catch (e) {
      if (window.console) console.warn(e);
      html = topbar('문제가 생겼어요', true) + '<div class="card empty"><div class="e-ic">🙏</div><b>화면을 그리지 못했어요</b><a class="btn btn-primary" href="#/">처음으로</a></div>';
    }
    v.innerHTML = html;
    document.title = (TITLES[r.name] ? TITLES[r.name] + ' · ' : '') + '서명전에 — 렌탈 위약금·총비용 계산기';
    updateTabs();
    if (prevName !== r.name + (r.id || '')) window.scrollTo(0, 0);
    afterRender(r);
  }
  window.addEventListener('hashchange', function () { if (skipCount) skipCount = false; else navCount++; render(); });

  function topbar(title, back, parent) {
    return '<header class="topbar">' + (back ? '<button class="back" data-act="back" data-parent="' + esc(parent || '#/') + '" aria-label="뒤로">‹</button>' : '') +
      '<h1 class="t" style="margin:0">' + esc(title) + '</h1></header>';
  }
  function disclaimerBlock() {
    return '<div class="disclaimer" role="note"><b>면책 고지</b> 참고용 계산이며 법률 자문이 아닙니다. 실제 금액은 계약서와 업체 서면 안내로 확인하세요.</div>';
  }
  function notFound(what) {
    return topbar(what, true) + '<div class="card empty"><div class="e-ic">🔍</div><b>견적을 찾을 수 없어요</b>삭제됐거나 다른 기기에서 만든 견적이에요.<a class="btn btn-primary" href="#/">견적 목록으로</a></div>';
  }

  // ---------- S0 start ----------
  function viewStart() {
    var ex = { units: 14, monthlyFeePerUnit: 18000, vatIncluded: false, termMonths: 36, payment: { type: 'VAN' }, termination: { type: 'full', promoRefund: 0 } };
    var exc = B.calc(ex, null);
    var h = '<header class="topbar"><div class="brand"><i aria-hidden="true">✍️</i>서명전에</div></header>';
    h += '<section class="hero"><span class="pill">중립 계산기 · 판매사와 무관 · 무료</span>' +
      '<h1>렌탈 계약,<br>도장 찍기 전에 3분 계산</h1>' +
      '<p>테이블오더·키오스크·POS·서빙로봇 견적서 숫자 몇 개만 넣으면 약정 총비용, 숨은 PG 수수료, 중도해지 위약금을 바로 보여드려요.</p>' +
      '<div class="preview" aria-label="계산 예시"><div class="cap">예시 · 테이블오더 14대 · 월 18,000원(VAT 별도) · 36개월</div>' +
      '<div class="row"><span>약정 총비용</span><b class="num">' + comma(exc.totalCost) + '<span class="unit">원</span></b></div>' +
      '<div class="row"><span>3개월 차 해지 위약금<br><span class="cap">잔여 이용료 전액 조건</span></span><b class="num red">' + comma(exc.penalty(3)) + '<span class="unit">원</span></b></div></div>' +
      '<div class="btns"><button class="btn btn-primary" data-act="new-quote">내 견적 넣기</button>' +
      '<button class="btn btn-white" data-act="load-sample">예시로 먼저 보기</button></div></section>';
    var qs = S.quotes.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    if (qs.length) {
      h += '<div class="sec"><span>이어서 보기 · 내 견적 ' + qs.length + '개</span>' + (qs.some(function (q) { return q.isSample; }) ? '<button class="btn btn-ghost btn-sm" data-act="clear-sample">예시 지우기</button>' : '') + '</div>';
      qs.forEach(function (q) { h += quoteLink(q); });
    }
    h += '<div class="sec"><span>이런 걸 알려드려요</span></div>' +
      '<div class="card"><div class="warn" style="padding-top:0"><span class="ic" style="background:var(--red-bg)" aria-hidden="true">📉</span><div><b>해지 시점별 위약금</b><p>"6개월 뒤 폐업하면 얼마?" 슬라이더로 바로 확인해요.</p></div></div>' +
      '<div class="warn"><span class="ic" style="background:var(--amber-bg)" aria-hidden="true">💳</span><div><b>숨은 PG 수수료</b><p>월 카드매출을 넣으면 기존보다 매달 얼마 더 나가는지 환산해요.</p></div></div>' +
      '<div class="warn"><span class="ic" style="background:var(--blue-bg)" aria-hidden="true">📝</span><div><b>업체에 보낼 확인 질문지</b><p>위험한 항목만 골라 문자로 보낼 질문을 만들어 드려요.</p></div></div></div>';
    h += '<a class="btn btn-sec" href="#/checklist">✅ 계약 전 체크리스트 12문항</a>';
    h += '<p class="cap" style="margin:16px 4px 0">🔒 입력한 내용은 이 기기에만 저장돼요. 서버로 보내지 않고, 로그인도 필요 없어요.</p>';
    h += disclaimerBlock();
    return h;
  }
  function quoteLink(q) {
    var c = B.calc(q, S.store), w = B.riskCounts(B.evaluateRules(q, S.store));
    return '<a class="q-item" href="#/quote/' + encodeURIComponent(q.id) + '"><span class="em" aria-hidden="true">' + catOf(q).emoji + '</span>' +
      '<span class="mid"><span class="nm">' + esc(vendorName(q)) + (q.isSample ? ' <span class="tag info">예시</span>' : '') + '</span>' +
      '<span class="meta">' + catOf(q).label + ' · ' + q.units + '대 · ' + q.termMonths + '개월</span></span>' +
      '<span class="rt"><b class="num">' + comma(c.totalCost) + '<span class="unit">원</span></b>' +
      (w.red ? '<span class="tag red">확인 필요 ' + w.red + '</span>' : w.yellow ? '<span class="tag amber">주의 ' + w.yellow + '</span>' : '<span class="tag green">경고 없음</span>') + '</span></a>';
  }

  // ---------- samples ----------
  function loadSamples() {
    var samples = B.sampleQuotes(Date.now());
    samples.forEach(function (s) { if (!findQ(s.id)) S.quotes.push(s); });
    if (!B.hasStore(S.store)) { S.store = JSON.parse(JSON.stringify(B.SAMPLE_STORE)); S.settings.sampleStore = true; }
    var ids = samples.map(function (s) { return s.id; });
    S.compareIds = ids.concat(S.compareIds.filter(function (i) { return ids.indexOf(i) < 0; })).slice(0, B.MAX_COMPARE);
    save();
  }
  function clearSamples() {
    S.quotes = S.quotes.filter(function (q) { return !q.isSample; });
    S.compareIds = S.compareIds.filter(function (id) { return !!findQ(id); });
    if (S.settings.sampleStore) { S.store = B.emptyStore(); S.settings.sampleStore = false; }
    save();
  }

  // ---------- S1 store ----------
  function viewStore(r) {
    var st = S.store, next = r.query.next === 'new';
    var h = topbar('매장 정보', true, '#/');
    h += '<div class="card"><p class="lead">PG 수수료가 매달 얼마나 더 나가는지 계산하려면 카드매출 정보가 필요해요.' + (next ? ' <b>처음 한 번만</b> 물어볼게요.' : '') + '</p>' +
      '<p class="cap">모르면 건너뛰어도 돼요. 이 경우 PG 추가분은 "계산 불가"로 표시해요.</p>' +
      (S.settings.sampleStore ? '<div class="warn-note">지금은 예시 매장 정보(월 카드매출 2,500만 원)가 들어 있어요. 내 매장 숫자로 바꿔 주세요.</div>' : '') + '</div>';
    h += '<div class="card">' +
      moneyField('st-sales', '월 카드매출', 'cardSales', st.monthlyCardSales, '예: 25,000,000', false) +
      pctField('st-share', '그중 기기로 결제되는 비율', 'share', st.deviceSharePct, '100', false, 'int') +
      pctField('st-fee', '현재 카드 수수료율', 'cardFee', st.currentCardFeePct, '예: 1.0', false, 'dec', '카드사 정산 내역이나 여신금융협회 가맹점 매출조회에서 확인할 수 있어요.') +
      '<p class="why" id="stWhy" aria-live="polite"></p>' +
      '<button class="btn btn-primary" id="stSave" data-act="store-save" data-next="' + (next ? 'new' : '') + '">' + (next ? '저장하고 견적 넣기' : '저장') + '</button>' +
      (next ? '<button class="btn btn-ghost" data-act="store-skip" style="margin-top:6px;width:100%">건너뛰기</button>' : '') + '</div>';
    return h;
  }
  function storeErrors() {
    var e = [];
    var sh = numVal('#st-share'), fee = numVal('#st-fee');
    if (sh !== null && (sh < 0 || sh > 100)) e.push('기기 결제 비율은 0~100% 사이로 넣어 주세요.');
    if (fee !== null && (fee < 0 || fee > 10)) e.push('카드 수수료율은 0~10% 사이로 넣어 주세요.');
    return e;
  }

  // ---------- field builders ----------
  function moneyField(id, label, help, val, ph, req, hint) {
    return '<div class="field"><div class="lab"><label for="' + id + '">' + esc(label) + (req ? '<span class="req">필수</span>' : '<span class="opt">선택</span>') + '</label>' + (help ? infoBtn(help) : '') + '</div>' +
      '<div class="input-wrap"><input class="input num" id="' + id + '" data-kind="money" inputmode="numeric" autocomplete="off" placeholder="' + esc(ph || '0') + '" value="' + (isNum(val) ? comma(val) : '') + '"' + (req ? ' aria-required="true"' : '') + '><span class="suffix" aria-hidden="true">원</span></div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function pctField(id, label, help, val, ph, req, kind, hint, suffix) {
    return '<div class="field"><div class="lab"><label for="' + id + '">' + esc(label) + (req ? '<span class="req">필수</span>' : '<span class="opt">선택</span>') + '</label>' + (help ? infoBtn(help) : '') + '</div>' +
      '<div class="input-wrap"><input class="input num" id="' + id + '" data-kind="' + (kind || 'dec') + '" inputmode="' + (kind === 'int' ? 'numeric' : 'decimal') + '" autocomplete="off" placeholder="' + esc(ph || '') + '" value="' + (isNum(val) ? val : '') + '"' + (req ? ' aria-required="true"' : '') + '><span class="suffix" aria-hidden="true">' + (suffix || '%') + '</span></div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  }
  function numVal(sel) {
    var el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) return null;
    var k = el.getAttribute('data-kind'), v = el.value.trim();
    if (!v) return null;
    if (k === 'money' || k === 'int') { var d = digits(v); return d ? Number(d) : null; }
    var n = Number(v.replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }
  function formatInput(el) {
    var k = el.getAttribute('data-kind');
    if (k === 'money') {
      var pos = el.selectionStart, before = el.value.slice(0, pos == null ? el.value.length : pos);
      var digitsBefore = digits(before).length;
      var d = digits(el.value).replace(/^0+(?=\d)/, '').slice(0, 12);
      el.value = d ? comma(Number(d)) : '';
      if (document.activeElement === el && el.setSelectionRange) {
        var i = 0, cnt = 0;
        while (i < el.value.length && cnt < digitsBefore) { if (/\d/.test(el.value[i])) cnt++; i++; }
        try { el.setSelectionRange(i, i); } catch (e) { }
      }
    } else if (k === 'int') {
      el.value = digits(el.value).slice(0, 4);
    } else if (k === 'dec') {
      var v = el.value.replace(/[^\d.]/g, '');
      var p = v.split('.');
      if (p.length > 2) v = p[0] + '.' + p.slice(1).join('');
      p = v.split('.');
      if (p[1] && p[1].length > 2) v = p[0] + '.' + p[1].slice(0, 2);
      if (p[0].length > 3) v = p[0].slice(0, 3) + (p[1] != null ? '.' + p[1] : '');
      el.value = v;
    }
  }

  // ---------- S2 wizard ----------
  var wiz = null;
  function blankDraft() {
    return {
      vendor: '', category: 'tableorder', units: null, monthlyFeePerUnit: null, vatIncluded: false, termMonths: 36, termCustom: false,
      upfrontCost: null, deposit: null, subsidy: null,
      payment: { type: null, pgFeePct: null },
      termination: { type: null, remainingFeePct: 50, devicePortionPerUnit: null, installClawback: null, promoRefund: null, fixedAmount: null, closureRelief: 'unknown' }
    };
  }
  function draftFrom(q) {
    var d = JSON.parse(JSON.stringify(q));
    d.termCustom = B.TERM_OPTIONS.indexOf(q.termMonths) < 0;
    if (!isNum(d.termination.remainingFeePct)) d.termination.remainingFeePct = 50;
    return d;
  }
  function viewWizard(r) {
    var key = r.id || 'new';
    if (r.id && !findQ(r.id)) return notFound('견적 수정');
    if (!wiz || wiz.key !== key) wiz = { key: key, id: r.id, step: 1, d: r.id ? draftFrom(findQ(r.id)) : blankDraft() };
    var step = Math.min(3, Math.max(1, Number(r.query.step) || 1));
    for (var s = 1; s < step; s++) if (wizErrors(s, wiz.d).length) { step = s; break; }
    wiz.step = step;
    var names = ['기본 정보', '결제 방식', '해지 조건'];
    var h = topbar(r.id ? '견적 수정' : '새 견적 입력', true, r.id ? '#/quote/' + encodeURIComponent(r.id) : '#/');
    h += '<div class="step-label">' + step + '/3 단계 · ' + names[step - 1] + '</div><div class="progress" role="progressbar" aria-label="입력 진행" aria-valuemin="1" aria-valuemax="3" aria-valuenow="' + step + '">' +
      [1, 2, 3].map(function (i) { return '<i class="' + (i <= step ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    h += '<form id="wizForm" novalidate autocomplete="off" class="card">' + (step === 1 ? step1(wiz.d) : step === 2 ? step2(wiz.d) : step3(wiz.d)) +
      '<p class="why" id="wizWhy" aria-live="polite"></p>' +
      '<div class="nav-btns">' + (step > 1 ? '<button type="button" class="btn btn-sec" data-act="wiz-prev">이전</button>' : '<button type="button" class="btn btn-sec" data-act="back" data-parent="#/">취소</button>') +
      '<button type="submit" class="btn btn-primary" id="wizNext">' + (step < 3 ? '다음' : '결과 보기') + '</button></div></form>';
    h += disclaimerBlock();
    return h;
  }
  function step1(d) {
    var h = '';
    h += '<div class="field"><div class="lab"><label for="w-vendor">업체명<span class="opt">선택</span></label></div><input class="input" id="w-vendor" maxlength="30" placeholder="예: ○○테이블오더 대리점" value="' + esc(d.vendor) + '"></div>';
    h += '<div class="field"><div class="lab"><span class="l" id="l-cat">품목</span></div><div class="chips" role="radiogroup" aria-labelledby="l-cat">';
    Object.keys(B.CATEGORIES).forEach(function (k) { h += '<button type="button" class="chip" role="radio" data-act="w-cat" data-v="' + k + '" aria-checked="' + (d.category === k) + '">' + B.CATEGORIES[k].emoji + ' ' + B.CATEGORIES[k].label + '</button>'; });
    h += '</div></div>';
    h += pctField('w-units', '대수', 'units', d.units, '예: 14', true, 'int', null, '대');
    h += moneyField('w-fee', '월 이용료 (1대당)', 'monthlyFee', d.monthlyFeePerUnit, '예: 18,000', true);
    h += '<div class="field"><div class="lab"><span class="l" id="l-vat">견적 금액의 VAT</span>' + infoBtn('vat') + '</div><div class="seg" role="radiogroup" aria-labelledby="l-vat">' +
      '<button type="button" role="radio" data-act="w-vat" data-v="0" aria-checked="' + !d.vatIncluded + '">VAT 별도</button>' +
      '<button type="button" role="radio" data-act="w-vat" data-v="1" aria-checked="' + !!d.vatIncluded + '">VAT 포함</button></div></div>';
    h += '<div class="field"><div class="lab"><span class="l" id="l-term">약정 개월<span class="req">필수</span></span>' + infoBtn('term') + '</div><div class="chips" role="radiogroup" aria-labelledby="l-term">';
    B.TERM_OPTIONS.forEach(function (t) { h += '<button type="button" class="chip" role="radio" data-act="w-term" data-v="' + t + '" aria-checked="' + (!d.termCustom && d.termMonths === t) + '">' + t + '개월</button>'; });
    h += '<button type="button" class="chip" role="radio" data-act="w-term" data-v="custom" aria-checked="' + !!d.termCustom + '">직접 입력</button></div>';
    if (d.termCustom) h += '<div style="margin-top:12px">' + pctField('w-term', '약정 개월 직접 입력', null, d.termMonths, '예: 30', true, 'int', '1~120개월', '개월') + '</div>';
    h += '</div>';
    h += '<div class="group"><p class="group-t">있으면 입력하세요</p>' +
      moneyField('w-upfront', '초기비용 (설치비·단말 일시불)', 'upfront', d.upfrontCost, '0') +
      moneyField('w-subsidy', '지원금·현금 사은품', 'subsidy', d.subsidy, '0', false, '총비용에서 빼서 계산해요.') +
      moneyField('w-deposit', '보증금', 'deposit', d.deposit, '0', false, '반환 예정이라 총비용과 따로 보여드려요.') + '</div>';
    h += '<div class="live" id="w-live" aria-live="polite"></div>';
    return h;
  }
  function step2(d) {
    var p = d.payment, h = '';
    h += '<div class="field"><div class="lab"><span class="l" id="l-pay">카드 결제는 어떤 방식인가요?<span class="req">필수</span></span>' + infoBtn('payment') + '</div><div class="opts" role="radiogroup" aria-labelledby="l-pay">';
    [['VAN', 'VAN', '카드사 수수료만 내는 일반 방식이에요.'], ['PG', 'PG (결제대행)', '카드사 수수료와 별도로 PG 수수료가 붙어요.'], ['unknown', '모름', '계약서에서 찾기 어려우면 골라 주세요. 확인할 질문을 만들어 드려요.']].forEach(function (o) {
      h += '<button type="button" class="opt-card" role="radio" data-act="w-pay" data-v="' + o[0] + '" aria-checked="' + (p.type === o[0]) + '"><span class="ra" aria-hidden="true"></span><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>';
    });
    h += '</div></div>';
    if (p.type === 'PG') {
      h += pctField('w-pg', 'PG 수수료율', 'pgFee', p.pgFeePct, '예: 2.5', true, 'dec', '보통 0.8~2.5% 사이예요. 계약서나 견적서의 "결제 수수료"를 확인하세요.');
      if (!B.hasStore(S.store)) h += '<div class="warn-note">매장 정보가 없어서 PG 추가 부담은 "계산 불가"로 표시돼요. <a href="#/store">매장 정보 넣기</a></div>';
      else h += '<div class="live">매장 정보: 월 카드매출 <b class="num">' + comma(S.store.monthlyCardSales) + '원</b> · 기기 결제 ' + S.store.deviceSharePct + '% · 현재 수수료 ' + S.store.currentCardFeePct + '% <a href="#/store">수정</a></div>';
    }
    return h;
  }
  function step3(d) {
    var t = d.termination, h = '';
    h += '<div class="field"><div class="lab"><span class="l" id="l-tt">중도 해지하면 위약금은 어떻게 계산되나요?<span class="req">필수</span></span>' + infoBtn('termType') + '</div><div class="opts" role="radiogroup" aria-labelledby="l-tt">';
    [['full', '잔여 이용료 전액', '남은 개월 수 × 월 이용료를 모두 내요.'], ['partial', '잔여 이용료 일부 + 단말 잔여금 + 설치비 환수', '예: "잔여 이용료의 50% + 단말 할부 잔여금"'], ['fixed', '정액 위약금', '해지 시점과 상관없이 정해진 금액이에요.'], ['unknown', '모름', '가장 비싼 경우(잔여 이용료 전액)로 계산해 드려요.']].forEach(function (o) {
      h += '<button type="button" class="opt-card" role="radio" data-act="w-tt" data-v="' + o[0] + '" aria-checked="' + (t.type === o[0]) + '"><span class="ra" aria-hidden="true"></span><span><b>' + o[1] + '</b><small>' + o[2] + '</small></span></button>';
    });
    h += '</div></div>';
    if (t.type === 'partial') {
      h += pctField('w-rpct', '잔여 이용료 중 내는 비율', 'remainingPct', t.remainingFeePct, '50', true, 'dec');
      h += moneyField('w-dev', '월 이용료 중 단말 할부분 (1대당)', 'devicePortion', t.devicePortionPerUnit, '0', false, '모르면 비워 두세요(0원으로 계산).');
      h += moneyField('w-claw', '설치비 환수액', 'clawback', t.installClawback, '0');
    }
    if (t.type === 'fixed') h += moneyField('w-fixed', '정액 위약금', null, t.fixedAmount, '예: 3,000,000', true);
    if (t.type) {
      h += moneyField('w-promo', '프로모션·사은품 반환액', 'promo', t.promoRefund, '없으면 0', false, '비워 두면 "미확인"으로 보고 확인 질문을 만들어 드려요.');
      h += '<div class="field"><div class="lab"><span class="l" id="l-rel">폐업·양도 시 위약금 감면 조항</span>' + infoBtn('relief') + '</div><div class="seg" role="radiogroup" aria-labelledby="l-rel">';
      [['yes', '있음'], ['no', '없음'], ['unknown', '모름']].forEach(function (o) { h += '<button type="button" role="radio" data-act="w-rel" data-v="' + o[0] + '" aria-checked="' + (t.closureRelief === o[0]) + '">' + o[1] + '</button>'; });
      h += '</div></div>';
    }
    return h;
  }
  function readWizInputs() {
    if (!wiz) return;
    var d = wiz.d;
    function set(id, fn) { var el = $('#' + id); if (el) fn(el); }
    set('w-vendor', function (el) { d.vendor = el.value; });
    set('w-units', function (el) { d.units = numVal(el); });
    set('w-fee', function (el) { d.monthlyFeePerUnit = numVal(el); });
    set('w-term', function (el) { d.termMonths = numVal(el); });
    set('w-upfront', function (el) { d.upfrontCost = numVal(el); });
    set('w-subsidy', function (el) { d.subsidy = numVal(el); });
    set('w-deposit', function (el) { d.deposit = numVal(el); });
    set('w-pg', function (el) { d.payment.pgFeePct = numVal(el); });
    set('w-rpct', function (el) { d.termination.remainingFeePct = numVal(el); });
    set('w-dev', function (el) { d.termination.devicePortionPerUnit = numVal(el); });
    set('w-claw', function (el) { d.termination.installClawback = numVal(el); });
    set('w-fixed', function (el) { d.termination.fixedAmount = numVal(el); });
    set('w-promo', function (el) { d.termination.promoRefund = numVal(el); });
  }
  function wizErrors(step, d) {
    var e = [];
    if (step === 1) {
      if (!isNum(d.units) || d.units < 1) e.push({ f: 'w-units', m: '대수를 1대 이상 넣어 주세요' });
      if (!isNum(d.monthlyFeePerUnit) || d.monthlyFeePerUnit <= 0) e.push({ f: 'w-fee', m: '월 이용료를 넣어 주세요' });
      if (!isNum(d.termMonths) || d.termMonths < 1 || d.termMonths > 120) e.push({ f: 'w-term', m: '약정 개월을 1~120 사이로 넣어 주세요' });
    } else if (step === 2) {
      if (!d.payment.type) e.push({ f: null, m: '결제 방식을 골라 주세요 (모르면 "모름")' });
      else if (d.payment.type === 'PG' && (!isNum(d.payment.pgFeePct) || d.payment.pgFeePct > 20)) e.push({ f: 'w-pg', m: 'PG 수수료율을 0~20% 사이로 넣어 주세요' });
    } else {
      var t = d.termination;
      if (!t.type) e.push({ f: null, m: '위약금 산식을 골라 주세요 (모르면 "모름")' });
      if (t.type === 'partial') {
        if (!isNum(t.remainingFeePct) || t.remainingFeePct > 100) e.push({ f: 'w-rpct', m: '잔여 이용료 비율을 0~100% 사이로 넣어 주세요' });
        if (isNum(t.devicePortionPerUnit) && t.devicePortionPerUnit > d.monthlyFeePerUnit) e.push({ f: 'w-dev', m: '단말 할부분은 월 이용료(' + comma(d.monthlyFeePerUnit) + '원)보다 클 수 없어요' });
      }
      if (t.type === 'fixed' && !isNum(t.fixedAmount)) e.push({ f: 'w-fixed', m: '정액 위약금을 넣어 주세요' });
    }
    return e;
  }
  function refreshWizState() {
    if (!wiz) return;
    readWizInputs();
    var errs = wizErrors(wiz.step, wiz.d);
    var btn = $('#wizNext'), why = $('#wizWhy');
    if (btn) btn.disabled = errs.length > 0;
    if (why) why.textContent = errs.length ? '⚠ ' + errs.map(function (e) { return e.m; }).join(' · ') : '';
    $$('#wizForm .input').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    errs.forEach(function (e) { var el = e.f && $('#' + e.f); if (el && el.value.trim()) el.setAttribute('aria-invalid', 'true'); });
    var live = $('#w-live');
    if (live) {
      var d = wiz.d;
      if (isNum(d.units) && d.units > 0 && isNum(d.monthlyFeePerUnit) && d.monthlyFeePerUnit > 0 && isNum(d.termMonths) && d.termMonths > 0) {
        var mf = Math.round(B.monthlyFixRaw(d));
        live.innerHTML = '월 이용료 합계(VAT 포함) <b class="num">' + comma(mf) + '원</b> × ' + d.termMonths + '개월 = <b class="num">' + comma(Math.round(B.monthlyFixRaw(d) * d.termMonths)) + '원</b>';
      } else live.textContent = '대수와 월 이용료를 넣으면 월 이용료 합계를 바로 계산해 드려요.';
    }
  }
  function finishWizard() {
    readWizInputs();
    var d = wiz.d;
    for (var s = 1; s <= 3; s++) if (wizErrors(s, d).length) { wiz.step = s; replaceTo(wizHash(s)); return; }
    var now = Date.now(), existing = wiz.id ? findQ(wiz.id) : null;
    var raw = JSON.parse(JSON.stringify(d));
    delete raw.termCustom;
    raw.id = existing ? existing.id : B.newId(now);
    raw.vendor = (d.vendor || '').trim() || '견적 ' + (S.quotes.filter(function (q) { return !q.isSample; }).length + 1);
    raw.upfrontCost = d.upfrontCost || 0; raw.deposit = d.deposit || 0; raw.subsidy = d.subsidy || 0;
    if (raw.payment.type !== 'PG') raw.payment.pgFeePct = null;
    var t = raw.termination;
    if (t.type !== 'partial') { t.remainingFeePct = null; t.devicePortionPerUnit = null; t.installClawback = null; }
    if (t.type !== 'fixed') t.fixedAmount = null;
    raw.checklist = existing ? existing.checklist : {};
    raw.isSample = false;
    raw.createdAt = existing ? existing.createdAt : now;
    raw.updatedAt = now;
    var q = B.sanitizeQuote(raw);
    if (existing) S.quotes[S.quotes.indexOf(existing)] = q;
    else { S.quotes.push(q); if (S.compareIds.length < B.MAX_COMPARE) S.compareIds.push(q.id); }
    save();
    wiz = null;
    resultState.id = null;
    toast(existing ? '수정한 내용으로 다시 계산했어요' : '계산을 마쳤어요');
    replaceTo('#/quote/' + encodeURIComponent(q.id));
  }
  function wizHash(step) { return (wiz && wiz.id ? '#/quote/' + encodeURIComponent(wiz.id) + '/edit' : '#/quote/new') + '?step=' + step; }

  // ---------- S3 result ----------
  var resultState = { id: null, m: 6 };
  var graphCtx = null;
  function pgLine(c) {
    if (c.pgStatus === 'ok') return wonHtml(c.pgExtra);
    if (c.pgStatus === 'needStore') return '<span class="tag amber">계산 불가 · 매장 정보 필요</span>';
    if (c.pgStatus === 'needRate') return '<span class="tag amber">계산 불가 · 수수료율 필요</span>';
    if (c.pgStatus === 'unknownType') return '<span class="tag red">결제 방식 확인 필요</span>';
    return '<span class="sub">없음 (VAN)</span>';
  }
  function resultBody(q, store, opts) {
    opts = opts || {};
    var c = B.calc(q, store), ws = B.evaluateRules(q, store), rc = B.riskCounts(ws);
    if (resultState.id !== q.id) resultState = { id: q.id, m: Math.min(6, c.termMonths) };
    var m = Math.min(resultState.m, c.termMonths);
    var h = '';
    h += '<section class="card" id="summary"><div class="cap">' + catOf(q).emoji + ' ' + catOf(q).label + ' · ' + q.units + '대 · 월 ' + comma(q.monthlyFeePerUnit) + '원/대 (VAT ' + (q.vatIncluded ? '포함' : '별도') + ') · ' + q.termMonths + '개월</div>' +
      '<h2 style="margin:10px 0 0;font-size:18px;color:var(--sub)">약정 ' + c.termMonths + '개월 총비용 (예상)</h2>' +
      '<div class="big-total num" id="bigTotal" data-v="' + c.totalCost + '">' + comma(c.totalCost) + '<span class="unit">원</span></div>' +
      '<div class="cap">' + B.manwon(c.totalCost) + (c.pgStatus === 'needStore' || c.pgStatus === 'needRate' ? ' · PG 추가분 제외' : '') + '</div>' +
      '<div style="margin-top:12px">' +
      '<div class="kv"><span class="k">월 평균 실부담</span><span class="v" id="avgVal">' + wonHtml(c.monthlyAvg) + '</span></div>' +
      '<div class="kv"><span class="k">월 이용료 합계 (VAT 포함)</span><span class="v">' + wonHtml(c.monthlyFix) + '</span></div>' +
      '<div class="kv"><span class="k">PG 추가 부담 (월)</span><span class="v" id="pgVal">' + pgLine(c) + '</span></div>' +
      '<div class="kv"><span class="k">보증금 <span class="cap">(총비용 제외 · 반환 예정)</span></span><span class="v" id="depVal">' + (c.deposit ? wonHtml(c.deposit) : '<span class="sub">없음</span>') + '</span></div></div>';
    if (c.pgStatus === 'needStore') h += '<div class="warn-note">PG 방식이라 매달 수수료가 더 나갈 수 있어요. 매장 정보를 넣으면 금액을 계산해 드려요. ' + (opts.readonly ? '' : '<a href="#/store">매장 정보 넣기</a>') + '</div>';
    if (c.pgStatus === 'needRate') h += '<div class="warn-note">PG 수수료율을 넣으면 추가 부담을 계산해 드려요.</div>';
    h += '</section>';

    var b = c.breakdown, pos = b.fees + b.pg + b.upfront;
    var pct = function (x) { return pos > 0 ? (x / pos * 100).toFixed(2) + '%' : '0%'; };
    var pgUnk = c.pgStatus === 'needStore' || c.pgStatus === 'needRate';
    h += '<section class="card" id="breakdown"><h2>비용 구성</h2>' +
      '<div class="stack" role="img" aria-label="비용 구성: 월 이용료 ' + comma(b.fees) + '원, PG 추가분 ' + (pgUnk ? '계산 불가' : comma(b.pg) + '원') + ', 초기비용 ' + comma(b.upfront) + '원">' +
      '<i class="c-fee" style="width:' + pct(b.fees) + '"></i><i class="c-pg" style="width:' + pct(b.pg) + '"></i><i class="c-up" style="width:' + pct(b.upfront) + '"></i></div>' +
      '<ul class="legend">' +
      '<li><span class="sw c-fee"></span>월 이용료 × ' + c.termMonths + '개월<span class="lv">' + wonHtml(b.fees) + '</span></li>' +
      '<li><span class="sw c-pg"></span>PG 추가분' + (c.pgStatus === 'ok' ? ' × ' + c.termMonths + '개월' : '') + '<span class="lv">' + (pgUnk ? '<span class="tag amber">계산 불가</span>' : wonHtml(b.pg)) + '</span></li>' +
      '<li><span class="sw c-up"></span>초기비용<span class="lv">' + wonHtml(b.upfront) + '</span></li>' +
      '<li><span class="sw c-sub"></span>지원금·사은품 차감<span class="lv">' + (b.subsidy ? '−' : '') + wonHtml(b.subsidy) + '</span></li>' +
      '<li style="border-top:1px solid var(--border);margin-top:4px;padding-top:10px"><b>합계</b><span class="lv">' + wonHtml(c.totalCost) + '</span></li></ul></section>';

    h += '<section class="card" id="timeline"><h2>중도 해지 위약금 타임라인</h2>';
    if (c.worstCase) h += '<div class="worst" id="worstLabel">⚠ 최악 가정 — 해지 산식을 몰라서 잔여 이용료 전액으로 계산했어요.</div>';
    h += '<div class="cap">' + B.TERMINATION_TYPES[q.termination.type] + '</div>' +
      '<div class="penalty-read" aria-live="polite"><span class="pm" id="pMonth">' + m + '개월 차에 해지하면</span>' +
      '<span class="pv num" id="pVal">' + comma(c.penalty(m)) + '<span class="unit">원</span></span>' +
      '<span class="pe" id="pExit">그때까지 낸 돈 <b class="num">' + comma(c.paidUntil(m)) + '원</b> + 위약금 = 총 <b class="num">' + comma(c.exitCost(m)) + '원</b></span></div>' +
      '<div class="slider-wrap"><label for="mSlider" class="cap">해지 시점 (1~' + c.termMonths + '개월)</label>' +
      '<input type="range" id="mSlider" min="1" max="' + c.termMonths + '" step="1" value="' + m + '" aria-valuetext="' + m + '개월 차, 위약금 ' + comma(c.penalty(m)) + '원">' +
      '<div class="range-ends" aria-hidden="true"><span>1개월</span><span>' + c.termMonths + '개월</span></div></div>' +
      '<div class="chips" role="group" aria-label="해지 시점 바로가기">' + [3, 6, 12].filter(function (x) { return x <= c.termMonths; }).map(function (x) { return '<button type="button" class="chip" data-act="m-chip" data-v="' + x + '" aria-pressed="' + (x === m) + '">' + x + '개월</button>'; }).join('') + '</div>' +
      graphSvg(q, c, m) +
      '<div class="graph-legend"><span><i class="gl-solid"></i>예상 위약금</span><span><i class="gl-dash"></i>그때까지 낸 돈 + 위약금</span></div>' +
      '<details class="tbl"><summary>월별 표로 보기</summary>' + penaltyTable(c) + '</details></section>';

    h += '<section class="card" id="warnings"><h2>위험 경고 ' + rc.total + '개</h2>';
    if (ws.length) {
      h += '<div class="risk-sum">' + (rc.red ? '<span class="tag red">🔴 확인 필요 ' + rc.red + '</span>' : '') + (rc.yellow ? '<span class="tag amber">🟡 주의 ' + rc.yellow + '</span>' : '') + (rc.info ? '<span class="tag info">ℹ️ 참고 ' + rc.info + '</span>' : '') + '</div>';
      ws.forEach(function (w) {
        h += '<div class="warn ' + w.level + '" data-rule="' + w.id + '"><span class="ic" aria-hidden="true">' + (w.level === 'red' ? '🔴' : w.level === 'yellow' ? '🟡' : 'ℹ️') + '</span><div><b>' + esc(w.title) + '</b><p>' + esc(w.detail) + '</p></div></div>';
      });
    } else h += '<div class="ok-box">✅ 규칙 10개 기준으로 눈에 띄는 위험 신호가 없어요. 그래도 계약서 원문은 꼭 확인하세요.</div>';
    h += '</section>';
    return h;
  }
  function tableMonths(c) {
    var ms = [1, 3, 6, 12, 18, 24, 30, 36, 48, 60].filter(function (x) { return x <= c.termMonths; });
    if (ms.indexOf(c.termMonths) < 0) ms.push(c.termMonths);
    return ms;
  }
  function penaltyTable(c) {
    var h = '<table class="t"><thead><tr><th scope="col">해지 시점</th><th scope="col">낸 돈</th><th scope="col">위약금</th><th scope="col">합계</th></tr></thead><tbody>';
    tableMonths(c).forEach(function (m) { h += '<tr><td>' + m + '개월 차</td><td class="num">' + comma(c.paidUntil(m)) + '</td><td class="num">' + comma(c.penalty(m)) + '</td><td class="num">' + comma(c.exitCost(m)) + '</td></tr>'; });
    return h + '</tbody></table><p class="cap" style="margin-top:6px">단위: 원 · 예상치</p>';
  }
  function niceMax(v) {
    if (v <= 0) return 10000;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    var s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return s * p;
  }
  function shortWon(v) {
    if (v >= 100000000) return (Math.round(v / 10000000) / 10) + '억';
    if (v >= 10000) return comma(Math.round(v / 10000)) + '만';
    return comma(v);
  }
  function graphSvg(q, c, m, small) {
    var W = 340, H = small ? 170 : 210, L = 48, R = 12, T = 12, Bm = 28;
    var term = c.termMonths, maxV = 0, pts = [];
    for (var i = 1; i <= term; i++) { var p = c.penalty(i), e = c.exitCost(i); pts.push([i, p, e]); maxV = Math.max(maxV, p, e); }
    var top = niceMax(maxV);
    var x = function (mm) { return term === 1 ? (L + (W - R)) / 2 : L + (mm - 1) / (term - 1) * (W - L - R); };
    var y = function (v) { return T + (1 - v / top) * (H - T - Bm); };
    if (!small) graphCtx = { x: x, y: y, c: c };
    var g = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="해지 시점별 예상 위약금 그래프. 1개월 차 ' + comma(c.penalty(1)) + '원에서 ' + term + '개월 차 ' + comma(c.penalty(term)) + '원">';
    for (var k = 0; k <= 4; k++) {
      var v = top * k / 4, yy = y(v).toFixed(1);
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" stroke="#E2E7EF" stroke-width="1"/>';
      g += '<text x="' + (L - 6) + '" y="' + (Number(yy) + 4) + '" text-anchor="end">' + shortWon(v) + '</text>';
    }
    var stepT = term <= 12 ? 3 : term <= 36 ? 6 : 12;
    var ticks = [1]; for (var t = stepT; t <= term; t += stepT) ticks.push(t);
    if (ticks[ticks.length - 1] !== term) { if (term - ticks[ticks.length - 1] < stepT / 2 && ticks.length > 1) ticks.pop(); ticks.push(term); }
    ticks.forEach(function (tk) { g += '<text x="' + x(tk).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + tk + '개월</text>'; });
    var pathP = pts.map(function (pp, i2) { return (i2 ? 'L' : 'M') + x(pp[0]).toFixed(1) + ' ' + y(pp[1]).toFixed(1); }).join(' ');
    var pathE = pts.map(function (pp, i2) { return (i2 ? 'L' : 'M') + x(pp[0]).toFixed(1) + ' ' + y(pp[2]).toFixed(1); }).join(' ');
    g += '<path d="' + pathE + '" fill="none" stroke="#2F6BFF" stroke-width="2.5" stroke-dasharray="6 5"/>';
    g += '<path d="' + pathP + '" fill="none" stroke="#E0464E" stroke-width="3"/>';
    if (!small) {
      g += '<line id="mkLine" x1="' + x(m).toFixed(1) + '" x2="' + x(m).toFixed(1) + '" y1="' + T + '" y2="' + (H - Bm) + '" stroke="#14284B" stroke-width="1.5" stroke-dasharray="3 3"/>';
      g += '<circle id="mkE" cx="' + x(m).toFixed(1) + '" cy="' + y(c.exitCost(m)).toFixed(1) + '" r="5" fill="#fff" stroke="#2F6BFF" stroke-width="3"/>';
      g += '<circle id="mkP" cx="' + x(m).toFixed(1) + '" cy="' + y(c.penalty(m)).toFixed(1) + '" r="6" fill="#E0464E" stroke="#fff" stroke-width="2"/>';
    }
    return g + '</svg>';
  }
  function setMonth(m) {
    if (!graphCtx) return;
    var c = graphCtx.c;
    m = Math.min(c.termMonths, Math.max(1, Math.round(m)));
    resultState.m = m;
    var s = $('#mSlider');
    if (s) { s.value = m; s.setAttribute('aria-valuetext', m + '개월 차, 위약금 ' + comma(c.penalty(m)) + '원'); s.style.setProperty('--p', (c.termMonths > 1 ? (m - 1) / (c.termMonths - 1) * 100 : 100) + '%'); }
    var pm = $('#pMonth'); if (pm) pm.textContent = m + '개월 차에 해지하면';
    var pv = $('#pVal'); if (pv) pv.innerHTML = comma(c.penalty(m)) + '<span class="unit">원</span>';
    var pe = $('#pExit'); if (pe) pe.innerHTML = '그때까지 낸 돈 <b class="num">' + comma(c.paidUntil(m)) + '원</b> + 위약금 = 총 <b class="num">' + comma(c.exitCost(m)) + '원</b>';
    var X = graphCtx.x(m).toFixed(1);
    var l = $('#mkLine'); if (l) { l.setAttribute('x1', X); l.setAttribute('x2', X); }
    var p = $('#mkP'); if (p) { p.setAttribute('cx', X); p.setAttribute('cy', graphCtx.y(c.penalty(m)).toFixed(1)); }
    var e = $('#mkE'); if (e) { e.setAttribute('cx', X); e.setAttribute('cy', graphCtx.y(c.exitCost(m)).toFixed(1)); }
    $$('[data-act="m-chip"]').forEach(function (bb) { bb.setAttribute('aria-pressed', String(Number(bb.getAttribute('data-v')) === m)); });
  }
  function viewResult(r) {
    var q = findQ(r.id);
    if (!q) return notFound('계산 결과');
    var h = topbar(vendorName(q), true, '#/');
    if (q.isSample) h += '<div class="share-banner">예시 견적이에요 (가상업체 · 가상 요금). <button class="btn btn-ghost btn-sm" data-act="clear-sample">예시 지우기</button></div>';
    h += resultBody(q, S.store);
    var inC = inCompare(q.id), enc = encodeURIComponent(q.id);
    h += '<section class="actions no-print" aria-label="다음 할 일">' +
      '<a class="btn btn-primary wide" href="#/quote/' + enc + '/questions">📝 업체에 보낼 확인 질문지 만들기</a>' +
      '<button class="btn btn-sec" data-act="toggle-compare" data-id="' + esc(q.id) + '" aria-pressed="' + inC + '">' + (inC ? '✓ 비교에 담김' : '⚖️ 비교에 추가') + '</button>' +
      '<a class="btn btn-sec" href="#/quote/' + enc + '/edit">✏️ 수정</a>' +
      '<button class="btn btn-sec" data-act="duplicate" data-id="' + esc(q.id) + '">📄 복제</button>' +
      '<button class="btn btn-sec" data-act="share" data-id="' + esc(q.id) + '">🔗 공유 링크</button>' +
      '<a class="btn btn-sec" href="#/quote/' + enc + '/print">🖨️ 인쇄 리포트</a>' +
      '<a class="btn btn-sec" href="#/checklist?q=' + enc + '">✅ 체크리스트</a>' +
      '<button class="btn btn-danger wide" data-act="delete" data-id="' + esc(q.id) + '">🗑️ 이 견적 삭제</button></section>';
    h += disclaimerBlock();
    return h;
  }
  function countUp() {
    var el = $('#bigTotal');
    if (!el || reduced()) return;
    var target = Number(el.getAttribute('data-v')), start = null;
    function stepF(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / 400), e = 1 - Math.pow(1 - t, 3);
      if (el.isConnected) el.innerHTML = comma(t >= 1 ? target : target * e) + '<span class="unit">원</span>';
      if (t < 1) requestAnimationFrame(stepF);
    }
    requestAnimationFrame(stepF);
  }

  // ---------- S5 questions ----------
  var qSel = {};
  function selectedQuestions(q) {
    var list = B.buildQuestions(q, S.store), sel = qSel[q.id] || {};
    return list.map(function (it) { return { id: it.id, text: it.text, level: it.level, on: Object.prototype.hasOwnProperty.call(sel, it.id) ? sel[it.id] : it.on }; });
  }
  function viewQuestions(r) {
    var q = findQ(r.id);
    if (!q) return notFound('확인 질문지');
    var list = selectedQuestions(q);
    var h = topbar('확인 질문지', true, '#/quote/' + encodeURIComponent(q.id));
    h += '<div class="card"><p class="lead"><b>' + esc(vendorName(q)) + '</b> 견적에서 서면으로 받아 둘 내용이에요. 넣고 뺄 질문을 고른 뒤 복사해서 문자·카톡으로 보내세요.</p>';
    var ruleQs = list.filter(function (x) { return x.level !== 'extra'; });
    h += '<h2 style="font-size:19px;margin-top:8px">경고에서 나온 질문 ' + ruleQs.length + '개</h2>';
    if (!ruleQs.length) h += '<p class="sub">켜진 경고가 없어요. 아래 일반 질문을 골라 보세요.</p>';
    list.forEach(function (it, i) {
      if (it.level === 'extra' && (i === 0 || list[i - 1].level !== 'extra')) h += '<h2 style="font-size:19px;margin-top:18px">함께 물어보면 좋은 질문</h2>';
      h += '<label class="qrow"><input type="checkbox" data-q="' + it.id + '"' + (it.on ? ' checked' : '') + '><span class="qt">' + (it.level === 'red' ? '🔴 ' : it.level === 'yellow' ? '🟡 ' : it.level === 'info' ? 'ℹ️ ' : '') + esc(it.text) + '</span></label>';
    });
    h += '</div>';
    h += '<div class="card"><h2 style="font-size:19px"><label for="qText">보낼 내용 미리보기</label></h2>' +
      '<textarea id="qText" class="preview-text" readonly>' + esc(B.questionText(q, list.filter(function (x) { return x.on; }))) + '</textarea>' +
      '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="copy-q">📋 복사하기</button>' +
      (navigator.share ? '<button class="btn btn-sec" data-act="share-q">📤 보내기</button>' : '') + '</div></div>';
    h += disclaimerBlock();
    return h;
  }
  function refreshQuestionText(q) {
    var list = selectedQuestions(q).filter(function (x) { return x.on; });
    var ta = $('#qText'); if (ta) ta.value = B.questionText(q, list);
    var b = $('[data-act="copy-q"]'); if (b) b.disabled = !list.length;
  }
  function copyText(text, ta) {
    function fallback() {
      if (ta) { ta.focus(); ta.select(); try { ta.setSelectionRange(0, ta.value.length); } catch (e) { } }
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      toast(ok ? '복사됐어요' : '텍스트 전체를 선택했어요. 길게 눌러 복사해 주세요');
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('복사됐어요'); }, fallback);
    else fallback();
  }

  // ---------- S4 compare ----------
  function viewCompare() {
    var h = topbar('견적 비교', false);
    if (!S.quotes.length) {
      return h + '<div class="card empty"><div class="e-ic">⚖️</div><b>아직 저장된 견적이 없어요</b>견적을 2개 이상 넣으면 총비용과 위약금을 나란히 비교해 드려요.' +
        '<button class="btn btn-primary" data-act="load-sample">예시 불러오기</button><button class="btn btn-sec" data-act="new-quote" style="margin-top:10px">내 견적 넣기</button></div>' + disclaimerBlock();
    }
    h += '<p class="sub" style="margin:0 2px 10px">비교할 견적을 최대 ' + B.MAX_COMPARE + '개까지 고르세요. (' + S.compareIds.length + '/' + B.MAX_COMPARE + ')</p>';
    S.quotes.slice().sort(function (a, b) { return a.createdAt - b.createdAt; }).forEach(function (q) {
      var on = inCompare(q.id), c = B.calc(q, S.store);
      h += '<button type="button" class="q-item" role="checkbox" aria-checked="' + on + '" data-act="cmp-toggle" data-id="' + esc(q.id) + '">' +
        '<span class="check" aria-hidden="true">' + (on ? '✓' : '') + '</span>' +
        '<span class="mid"><span class="nm">' + esc(vendorName(q)) + (q.isSample ? ' <span class="tag info">예시</span>' : '') + '</span><span class="meta">' + catOf(q).label + ' · ' + q.units + '대 · ' + q.termMonths + '개월</span></span>' +
        '<span class="rt"><b class="num">' + comma(c.totalCost) + '<span class="unit">원</span></b></span></button>';
    });
    h += '<div class="btn-row" style="margin:6px 0 4px"><button class="btn btn-sec btn-sm" data-act="new-quote">＋ 견적 추가</button>' +
      (S.quotes.some(function (q) { return q.isSample; }) ? '<button class="btn btn-sec btn-sm" data-act="clear-sample">예시 지우기</button>' : '<button class="btn btn-sec btn-sm" data-act="load-sample">예시 불러오기</button>') + '</div>';
    var sel = S.compareIds.map(findQ).filter(Boolean);
    if (sel.length < 2) {
      h += '<div class="card empty" style="margin-top:14px"><div class="e-ic">☝️</div><b>견적을 2개 이상 골라 주세요</b>고른 견적끼리 항목별로 가장 유리한 값을 표시해 드려요.</div>';
      return h + disclaimerBlock();
    }
    var rows = B.compare(sel, S.store);
    var wins = {}; sel.forEach(function (q) { wins[q.id] = 0; });
    var counted = 0;
    rows.forEach(function (r) { if (r.cells.some(function (c) { return c.best; }) && !r.cells.every(function (c) { return c.best; })) { counted++; r.cells.forEach(function (c) { if (c.best) wins[c.id]++; }); } });
    var top = Math.max.apply(null, sel.map(function (q) { return wins[q.id]; }));
    var leaders = sel.filter(function (q) { return wins[q.id] === top; });
    h += '<div class="sec" id="cmpResult"><span>비교 결과</span></div>';
    if (counted && leaders.length === 1 && top > 0) h += '<div class="winner"><b>' + esc(vendorName(leaders[0])) + '</b><br>' + counted + '개 항목 중 ' + top + '개에서 가장 유리해요. 위약금 항목도 꼭 함께 보세요.</div>';
    else h += '<div class="winner" style="background:var(--blue-bg);color:var(--navy)">항목마다 유리한 견적이 달라요. 오래 쓸 계획인지, 중간에 그만둘 가능성이 있는지에 따라 골라 보세요.</div>';
    var terms = sel.map(function (q) { return q.termMonths; });
    if (terms.some(function (t) { return t !== terms[0]; })) h += '<div class="warn-note" style="margin-bottom:12px">약정 기간이 서로 달라요. 총비용보다 월 평균 실부담을 함께 비교하세요.</div>';
    var pgNote = false;
    rows.forEach(function (r) {
      h += '<section class="card metric tight" data-metric="' + r.key + '"><h3>' + r.label + '</h3>';
      r.cells.forEach(function (cell) {
        var q = findQ(cell.id);
        if (cell.pgNote) pgNote = true;
        var val = cell.value === null ? '<span class="sub">해당 없음</span>' : r.key === 'risk' ? cell.value + '개' : comma(cell.value) + '<span class="unit">원</span>' + (cell.pgNote ? ' *' : '');
        h += '<div class="mrow' + (cell.best ? ' best' : '') + '"><a class="who" href="#/quote/' + encodeURIComponent(q.id) + '">' + esc(vendorName(q)) + '</a>' +
          (cell.best ? '<span class="best-badge">✓ 유리</span>' : '') + '<span class="val num">' + val + '</span></div>';
      });
      h += '</section>';
    });
    if (pgNote) h += '<p class="cap">* PG 추가분 계산 불가(매장 정보 또는 수수료율 필요) — 실제보다 적게 보일 수 있어요.</p>';
    return h + disclaimerBlock();
  }

  // ---------- S6 checklist ----------
  function viewChecklist(r) {
    var qid = r.query.q && findQ(r.query.q) ? r.query.q : '';
    var q = qid ? findQ(qid) : null;
    var ans = q ? q.checklist : S.settings.checklist;
    var sc = B.checklistScore(ans);
    var h = topbar('계약 전 체크리스트', true, q ? '#/quote/' + encodeURIComponent(q.id) : '#/help');
    h += '<div class="card"><label for="ckQuote" class="cap" style="display:block;margin-bottom:6px">어떤 견적을 점검할까요?</label>' +
      '<select id="ckQuote" class="input" style="font-size:18px">' + '<option value="">일반 점검 (견적 선택 안 함)</option>' +
      S.quotes.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === qid ? ' selected' : '') + '>' + esc(vendorName(x)) + '</option>'; }).join('') + '</select>' +
      '<div style="margin-top:16px" aria-live="polite"><span class="cap">준비도</span><div class="score num" id="ckScore">' + sc.yes + ' / ' + sc.total + '</div>' +
      '<div class="bar" aria-hidden="true"><i id="ckBar" style="width:' + (sc.yes / sc.total * 100).toFixed(1) + '%"></i></div>' +
      '<p class="sub" id="ckMsg">' + ckMessage(sc) + '</p></div></div>';
    h += '<div class="card">';
    B.CHECKLIST.forEach(function (c, i) {
      var a = ans[c.id];
      h += '<div class="ck"><div class="ckq" id="ck-' + c.id + '">' + (i + 1) + '. ' + esc(c.text) + '</div><div class="seg" role="radiogroup" aria-labelledby="ck-' + c.id + '">' +
        [['yes', '예'], ['no', '아니오'], ['unknown', '모름']].map(function (o) { return '<button type="button" role="radio" data-act="ck" data-c="' + c.id + '" data-v="' + o[0] + '" aria-checked="' + (a === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
    });
    h += '</div>';
    h += '<button class="btn btn-sec" data-act="ck-reset" data-q="' + esc(qid) + '">답변 지우기</button>';
    return h + disclaimerBlock();
  }
  function ckMessage(sc) {
    if (!sc.answered) return '항목마다 예 / 아니오 / 모름을 골라 주세요.';
    if (sc.yes === sc.total) return '모두 확인했어요. 서명 준비가 잘 됐어요.';
    if (sc.yes >= 9) return '거의 다 됐어요. "아니오·모름" 항목만 서면으로 확인하세요.';
    return '"아니오·모름" 항목은 서명 전에 업체에 서면으로 확인하는 게 안전해요.';
  }

  // ---------- S7 help ----------
  // 연락처는 2026-10-24 각 기관 공식 사이트에서 직접 확인 (출처는 HANDOFF.md)
  var HOTLINES = [
    {
      name: '소상공인 불공정거래 피해상담센터', org: '소상공인시장진흥공단',
      desc: '불공정거래 피해 상담과 전문가(변호사 등) 상담을 받을 수 있어요. 전화·방문·우편·온라인으로 신청해요.',
      phones: [['1599-0209', '전화상담'], ['1357', '관할 센터 안내 · 중소벤처기업부 통합콜센터(국번 없이)']],
      url: 'https://www.sbiz.or.kr/unfair/main.do', urlLabel: '온라인 상담 신청'
    },
    {
      name: '한국공정거래조정원 분쟁조정', org: '한국공정거래조정원',
      desc: '이미 분쟁이 생겼다면 분쟁조정을 신청할 수 있어요. 신청 전 상담은 분쟁조정 콜센터에서 받아요. (유료 전화, 평일 09:00~18:00)',
      phones: [['1588-1490', '분쟁조정 콜센터']],
      url: 'https://fairnet.kofair.or.kr/web/main/mainPage.do', urlLabel: '온라인 분쟁조정 신청'
    }
  ];
  function viewHelp() {
    var h = topbar('도움', false);
    h += '<section class="card" id="dispute"><h2>분쟁·상담 안내</h2><p>계약 내용이 불공정해 보이거나 이미 위약금 분쟁이 생겼다면 아래 공공 창구에 문의할 수 있어요.</p>';
    HOTLINES.forEach(function (x) {
      h += '<div class="hotline"><b>' + esc(x.name) + '</b><span class="cap">' + esc(x.org) + '</span><span>' + esc(x.desc) + '</span><div class="links">' +
        x.phones.map(function (p) { return '<a class="btn btn-sec btn-sm" href="tel:' + p[0].replace(/-/g, '') + '">📞 ' + p[0] + '<span class="cap" style="margin-left:4px">' + esc(p[1]) + '</span></a>'; }).join('') +
        '<a class="btn btn-sec btn-sm" href="' + x.url + '" target="_blank" rel="noopener">🌐 ' + esc(x.urlLabel) + '</a></div></div>';
    });
    h += '<div class="muted-box" style="margin-top:10px"><b>상담 전에 챙기면 좋은 자료</b><ul style="margin:6px 0 0;padding-left:20px"><li>계약서·견적서 사본</li><li>영업 담당자와 주고받은 문자·메신저</li><li>청구서·위약금 안내문</li><li>이 앱의 인쇄 리포트(PDF)</li></ul></div>' +
      '<p class="cap" style="margin-top:8px">연락처는 2026년 10월 24일 각 기관 공식 홈페이지에서 확인했어요. 운영 시간은 바뀔 수 있어요.</p></section>';
    h += '<section class="card"><h2>용어 사전</h2>' + B.GLOSSARY.map(function (g) { return '<details class="gl"><summary>' + esc(g.term) + '</summary><p>' + esc(g.desc) + '</p></details>'; }).join('') + '</section>';
    h += '<section class="card"><h2>계산 방법</h2><p style="font-size:16px">총비용 = 초기비용 + (월 이용료 × 대수 × VAT + PG 추가분) × 약정 개월 − 지원금</p><p style="font-size:16px">PG 추가분(월) = 월 카드매출 × 기기 결제 비율 × (PG 수수료율 − 현재 카드 수수료율)</p><p class="sub" style="font-size:16px">위약금은 고르신 산식(전액 / 일부 / 정액 / 모름=전액)으로 남은 개월 수에 맞춰 계산해요. 보증금은 돌려받는 돈이라 총비용에서 뺐어요.</p></section>';
    h += '<a class="btn btn-sec" href="#/checklist" style="margin-bottom:14px">✅ 계약 전 체크리스트 12문항</a>';
    h += '<section class="card" id="guides"><h2>더 알아보기</h2><a class="btn btn-ghost" href="tableorder-penalty/">테이블오더 위약금 계산 안내 →</a><a class="btn btn-ghost" href="kiosk-rental-cost/">키오스크 렌탈 총비용 계산 안내 →</a></section>';
    h += '<section class="card" id="privacy"><h2>개인정보 안내</h2><p>입력한 견적과 매장 정보는 <b>이 기기의 브라우저에만</b> 저장돼요. 서버로 보내거나 수집하지 않고, 로그인·쿠키·광고 추적도 없어요.</p><p class="sub">공유 링크를 만들면 링크 안에 견적 숫자가 담겨요. 받는 사람을 확인하고 보내세요.</p></section>';
    h += '<section class="card" id="disclaimer"><h2>면책 고지</h2><p>이 계산은 입력하신 숫자와 고르신 산식을 바탕으로 한 <b>참고용 예상치</b>이며 법률 자문이 아닙니다. 실제 금액은 계약서와 업체 서면 안내로 확인하세요.</p><p class="sub">서명전에는 특정 판매사로부터 돈을 받지 않으며, 실제 업체명이나 요금을 담고 있지 않아요.</p></section>';
    h += '<section class="card"><h2>데이터 관리</h2>' +
      '<a class="btn btn-sec" href="#/store" style="margin-bottom:10px">🏪 매장 정보 ' + (B.hasStore(S.store) ? '수정' : '입력') + '</a>' +
      (S.quotes.some(function (q) { return q.isSample; }) ? '<button class="btn btn-sec" data-act="clear-sample" style="margin-bottom:10px">예시 지우기</button>' : '') +
      '<button class="btn btn-sec" data-act="export" style="margin-bottom:10px">💾 백업 파일 내보내기</button>' +
      '<label class="btn btn-sec" style="margin-bottom:10px;cursor:pointer;position:relative">📂 백업 파일 가져오기<input type="file" id="importFile" accept="application/json,.json" style="position:absolute;inset:0;opacity:0;width:100%;cursor:pointer"></label>' +
      '<button class="btn btn-danger" data-act="reset">데이터 초기화</button></section>';
    h += '<p class="cap" style="text-align:center;margin:10px 0">서명전에 (Before You Sign) v1.0.0</p>';
    return h;
  }

  // ---------- S8 print ----------
  function viewPrint(r) {
    var q = findQ(r.id);
    if (!q) return notFound('인쇄 리포트');
    return topbar('인쇄 리포트', true, '#/quote/' + encodeURIComponent(q.id)) +
      '<div class="no-print" style="margin-bottom:12px"><button class="btn btn-primary" data-act="print">🖨️ 인쇄 / PDF로 저장</button><p class="cap" style="margin-top:6px">인쇄 창에서 "PDF로 저장"을 고르면 파일로 보관할 수 있어요. A4 한 장에 맞춰져 있어요.</p></div>' +
      reportHtml(q, S.store);
  }
  function reportHtml(q, store) {
    var c = B.calc(q, store), ws = B.evaluateRules(q, store);
    var pgTxt = c.pgStatus === 'ok' ? won(c.pgExtra) : c.pgStatus === 'none' ? '없음 (VAN)' : c.pgStatus === 'unknownType' ? '결제 방식 확인 필요' : '계산 불가';
    var t = q.termination;
    var h = '<article class="report" id="report"><div class="rhead"><div><h1>렌탈 계약 점검 리포트</h1><div>' + esc(vendorName(q)) + ' · ' + catOf(q).label + ' ' + q.units + '대 · 월 ' + comma(q.monthlyFeePerUnit) + '원/대 (VAT ' + (q.vatIncluded ? '포함' : '별도') + ') · ' + q.termMonths + '개월</div></div>' +
      '<div style="text-align:right;font-size:12px;color:var(--sub)">작성일 ' + todayStr() + '<br>서명전에</div></div>';
    h += '<div class="grid2">' +
      '<div class="box"><div class="k">약정 ' + c.termMonths + '개월 총비용 (예상)</div><div class="v">' + won(c.totalCost) + '</div></div>' +
      '<div class="box"><div class="k">월 평균 실부담</div><div class="v">' + won(c.monthlyAvg) + '</div></div>' +
      '<div class="box"><div class="k">월 이용료 합계(VAT 포함) / PG 추가분(월)</div><div class="v" style="font-size:15px">' + won(c.monthlyFix) + ' / ' + pgTxt + '</div></div>' +
      '<div class="box"><div class="k">초기비용 / 지원금 차감 / 보증금(별도)</div><div class="v" style="font-size:15px">' + won(q.upfrontCost) + ' / ' + won(q.subsidy) + ' / ' + won(q.deposit) + '</div></div></div>';
    h += '<h3>조건</h3><div>결제: ' + B.PAYMENT_TYPES[q.payment.type] + (q.payment.type === 'PG' ? ' ' + (isNum(q.payment.pgFeePct) ? q.payment.pgFeePct + '%' : '(요율 미입력)') : '') +
      ' · 해지 산식: ' + B.TERMINATION_TYPES[t.type] + (t.type === 'partial' ? ' (잔여 ' + t.remainingFeePct + '%, 단말분 ' + comma(t.devicePortionPerUnit || 0) + '원/대, 설치비 환수 ' + comma(t.installClawback || 0) + '원)' : '') +
      (t.type === 'fixed' ? ' (' + won(t.fixedAmount) + ')' : '') +
      ' · 사은품 반환: ' + (isNum(t.promoRefund) ? won(t.promoRefund) : '미확인') + ' · 폐업 감면: ' + B.RELIEF[t.closureRelief] +
      (B.hasStore(store) ? ' · 매장: 월 카드매출 ' + won(store.monthlyCardSales) + ', 기기 ' + store.deviceSharePct + '%, 현재 수수료 ' + store.currentCardFeePct + '%' : '') + '</div>';
    h += '<h3>해지 시점별 예상 금액' + (c.worstCase ? ' (최악 가정)' : '') + '</h3><div class="grid2" style="align-items:start"><table class="t"><thead><tr><th>해지</th><th>낸 돈</th><th>위약금</th><th>합계</th></tr></thead><tbody>' +
      tableMonths(c).map(function (m) { return '<tr><td>' + m + '개월</td><td class="num">' + comma(c.paidUntil(m)) + '</td><td class="num">' + comma(c.penalty(m)) + '</td><td class="num">' + comma(c.exitCost(m)) + '</td></tr>'; }).join('') +
      '</tbody></table><div>' + graphSvg(q, c, 0, true) + '<div style="font-size:11px;color:var(--sub)">실선(빨강): 예상 위약금 · 점선(파랑): 낸 돈 + 위약금</div></div></div>';
    h += '<h3>위험 경고 ' + B.riskCounts(ws).total + '개</h3>' + (ws.length ? '<ul>' + ws.map(function (w) { return '<li>' + (w.level === 'red' ? '[확인 필요] ' : w.level === 'yellow' ? '[주의] ' : '[참고] ') + esc(w.title) + ' — ' + esc(w.detail) + '</li>'; }).join('') + '</ul>' : '<div>눈에 띄는 위험 신호 없음</div>');
    if (ws.length) h += '<h3>업체에 서면으로 확인할 질문</h3><ul>' + ws.map(function (w) { return '<li>' + esc(w.question) + '</li>'; }).join('') + '</ul>';
    h += '<div class="foot">참고용 계산이며 법률 자문이 아닙니다. 실제 금액은 계약서와 업체 서면 안내로 확인하세요. · 분쟁 상담: 소상공인 불공정거래 피해상담센터 1599-0209 · 한국공정거래조정원 1588-1490 · 서명전에 347744strings-spec.github.io/webapp-daily/2026-10-24-before-you-sign/</div></article>';
    return h;
  }

  // ---------- shared (#s=) ----------
  var sharedData = null;
  function viewShared(r) {
    var h = topbar('공유받은 견적', true, '#/');
    try { sharedData = B.decodeShare(r.payload); } catch (e) {
      sharedData = null;
      return h + '<div class="card empty"><div class="e-ic">🔗</div><b>링크를 읽을 수 없어요</b>링크가 잘렸거나 손상된 것 같아요. 보낸 분께 다시 받아 주세요.<a class="btn btn-primary" href="#/">처음으로</a></div>';
    }
    var q = sharedData.quote, st = sharedData.store || S.store;
    h += '<div class="share-banner"><b>' + esc(vendorName(q)) + '</b> 견적을 공유받았어요. 아래 결과는 보낸 분이 본 것과 같은 계산이에요.' +
      (!sharedData.store && q.payment.type === 'PG' ? ' (매장 정보는 담기지 않았어요)' : '') +
      '<button class="btn btn-primary" data-act="import-shared" style="margin-top:10px">내 견적함에 저장</button></div>';
    resultState.id = null;
    h += resultBody(q, sharedData.store, { readonly: true });
    return h + disclaimerBlock();
  }
  function importShared() {
    if (!sharedData) return;
    var q = JSON.parse(JSON.stringify(sharedData.quote));
    q.id = B.newId(); q.isSample = false; q.createdAt = q.updatedAt = Date.now(); q.checklist = {};
    q = B.sanitizeQuote(q);
    S.quotes.push(q);
    if (S.compareIds.length < B.MAX_COMPARE) S.compareIds.push(q.id);
    var note = '';
    if (sharedData.store && (!B.hasStore(S.store) || S.settings.sampleStore)) { S.store = sharedData.store; S.settings.sampleStore = false; note = ' (매장 정보도 함께 저장)'; }
    else if (sharedData.store) note = '. 내 매장 정보로 계산돼요';
    save();
    toast('내 견적함에 저장했어요' + note);
    replaceTo('#/quote/' + encodeURIComponent(q.id));
  }
  function shareQuote(q) {
    var url = location.href.split('#')[0] + '#s=' + B.encodeShare(q, S.store);
    openSheet('공유 링크', '<p>이 링크를 연 사람은 같은 계산 결과를 볼 수 있어요. 서버에 저장되지 않고 링크 안에 견적 숫자가 담겨요.</p>' +
      '<label for="shareUrl" class="cap">링크</label><input id="shareUrl" class="input" readonly value="' + esc(url) + '" style="font-size:15px;margin:6px 0 12px">' +
      '<div class="btn-row"><button class="btn btn-primary" data-act="copy-link">📋 링크 복사</button>' + (navigator.share ? '<button class="btn btn-sec" data-act="native-share">📤 보내기</button>' : '') + '</div>' +
      (B.hasStore(S.store) ? '<p class="cap" style="margin-top:10px">매장 정보(카드매출·수수료율)도 함께 담겨요.</p>' : ''));
  }

  // ---------- afterRender bindings ----------
  var pendingAnchor = null;
  function afterRender(r) {
    if (r.name === 'result' || r.name === 'shared') {
      var s = $('#mSlider');
      if (s) { s.addEventListener('input', function () { setMonth(Number(s.value)); }); setMonth(Number(s.value)); }
      if (r.name === 'result') countUp();
    }
    if (r.name === 'wizard' && wiz) refreshWizState();
    if (r.name === 'store') { var f = function () { var e = storeErrors(); $('#stSave').disabled = e.length > 0; $('#stWhy').textContent = e.join(' '); }; $$('#view .input').forEach(function (el) { el.addEventListener('input', f); }); f(); }
    if (r.name === 'questions' && findQ(r.id)) refreshQuestionText(findQ(r.id));
    if (r.name === 'help') {
      var fi = $('#importFile');
      if (fi) fi.addEventListener('change', importBackup);
      if (pendingAnchor) { var a = document.getElementById(pendingAnchor); pendingAnchor = null; if (a) setTimeout(function () { a.scrollIntoView({ block: 'start' }); }, 0); }
    }
    if (r.name === 'checklist') { var sel = $('#ckQuote'); if (sel) sel.addEventListener('change', function () { replaceTo('#/checklist' + (sel.value ? '?q=' + encodeURIComponent(sel.value) : '')); }); }
  }

  // ---------- global events ----------
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[data-kind]')) formatInput(el);
    if (currentRoute && currentRoute.name === 'wizard') refreshWizState();
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[data-q]') && currentRoute && currentRoute.name === 'questions') {
      var q = findQ(currentRoute.id); if (!q) return;
      qSel[q.id] = qSel[q.id] || {};
      qSel[q.id][el.getAttribute('data-q')] = el.checked;
      refreshQuestionText(q);
    }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'wizForm') return;
    e.preventDefault();
    if (!wiz) return;
    refreshWizState();
    if (wizErrors(wiz.step, wiz.d).length) return;
    if (wiz.step < 3) { wiz.step++; replaceTo(wizHash(wiz.step)); }
    else finishWizard();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('#sheet-root').firstChild && !$('#modal-root').firstChild) closeSheet();
  });
  function goBack(parent) {
    if (navCount > 0) { navCount--; skipCount = true; history.back(); }
    else replaceTo(parent || '#/');
  }
  document.addEventListener('click', function (e) {
    var ha = e.target.closest('[data-help-anchor]');
    if (ha) { pendingAnchor = ha.getAttribute('data-help-anchor'); if (currentRoute && currentRoute.name === 'help') { e.preventDefault(); var tg = document.getElementById(pendingAnchor); pendingAnchor = null; if (tg) tg.scrollIntoView({ block: 'start' }); } return; }
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act'), id = el.getAttribute('data-id');
    var q = id ? findQ(id) : null;
    switch (act) {
      case 'back': goBack(el.getAttribute('data-parent')); break;
      case 'info': infoSheet(el.getAttribute('data-k')); break;
      case 'sheet-close': closeSheet(); break;
      case 'new-quote': wiz = null; go(S.settings.onboarded ? '#/quote/new' : '#/store?next=new'); break;
      case 'load-sample': loadSamples(); toast('가상 견적 2개를 불러왔어요'); go('#/compare'); break;
      case 'clear-sample':
        clearSamples(); toast('예시를 지웠어요');
        if (currentRoute.name === 'result' && !findQ(currentRoute.id)) replaceTo('#/'); else render();
        break;
      case 'store-save': {
        if (storeErrors().length) return;
        S.store = B.sanitizeStore({ monthlyCardSales: numVal('#st-sales'), deviceSharePct: numVal('#st-share'), currentCardFeePct: numVal('#st-fee') });
        S.settings.sampleStore = false; S.settings.onboarded = true; save();
        toast('매장 정보를 저장했어요');
        if (el.getAttribute('data-next') === 'new') { wiz = null; replaceTo('#/quote/new'); }
        else goBack('#/');
        break;
      }
      case 'store-skip': S.settings.onboarded = true; save(); wiz = null; replaceTo('#/quote/new'); break;
      case 'w-cat': readWizInputs(); wiz.d.category = el.getAttribute('data-v'); render(); break;
      case 'w-vat': readWizInputs(); wiz.d.vatIncluded = el.getAttribute('data-v') === '1'; render(); break;
      case 'w-term': {
        readWizInputs(); var v = el.getAttribute('data-v');
        if (v === 'custom') { wiz.d.termCustom = true; } else { wiz.d.termCustom = false; wiz.d.termMonths = Number(v); }
        render(); if (v === 'custom') { var ti = $('#w-term'); if (ti) ti.focus(); }
        break;
      }
      case 'w-pay': readWizInputs(); wiz.d.payment.type = el.getAttribute('data-v'); render(); break;
      case 'w-tt': readWizInputs(); wiz.d.termination.type = el.getAttribute('data-v'); render(); break;
      case 'w-rel': readWizInputs(); wiz.d.termination.closureRelief = el.getAttribute('data-v'); render(); break;
      case 'wiz-prev': readWizInputs(); wiz.step = Math.max(1, wiz.step - 1); replaceTo(wizHash(wiz.step)); break;
      case 'm-chip': setMonth(Number(el.getAttribute('data-v'))); break;
      case 'toggle-compare': case 'cmp-toggle': {
        if (!q) break;
        if (inCompare(q.id)) S.compareIds = S.compareIds.filter(function (x) { return x !== q.id; });
        else if (S.compareIds.length >= B.MAX_COMPARE) { toast('비교는 최대 ' + B.MAX_COMPARE + '개까지 할 수 있어요. 하나를 먼저 빼 주세요'); break; }
        else S.compareIds.push(q.id);
        save();
        if (act === 'toggle-compare') toast(inCompare(q.id) ? '비교에 담았어요' : '비교에서 뺐어요');
        var y = window.scrollY; render(); window.scrollTo(0, y);
        break;
      }
      case 'duplicate': {
        if (!q) break;
        var cp = JSON.parse(JSON.stringify(q)), now = Date.now();
        cp.id = B.newId(now); cp.vendor = (vendorName(q) + ' (복사본)').slice(0, 30); cp.isSample = false; cp.createdAt = cp.updatedAt = now;
        S.quotes.push(cp); save();
        toast('복제했어요. 조건을 바꿔 비교해 보세요');
        go('#/quote/' + encodeURIComponent(cp.id));
        break;
      }
      case 'delete': {
        if (!q) break;
        confirmModal('이 견적을 삭제할까요?', '"' + vendorName(q) + '" 견적과 체크리스트 답변이 지워지고 되돌릴 수 없어요.', '삭제', true).then(function (ok) {
          if (!ok) return;
          S.quotes = S.quotes.filter(function (x) { return x.id !== q.id; });
          S.compareIds = S.compareIds.filter(function (x) { return x !== q.id; });
          save(); toast('삭제했어요'); replaceTo('#/');
        });
        break;
      }
      case 'share': if (q) shareQuote(q); break;
      case 'copy-link': { var u = $('#shareUrl'); copyText(u.value, u); break; }
      case 'native-share': { var u2 = $('#shareUrl'); navigator.share({ title: '서명전에 — 견적 계산 결과', url: u2.value }).catch(function () { }); break; }
      case 'copy-q': { var ta = $('#qText'); copyText(ta.value, ta); break; }
      case 'share-q': { var ta2 = $('#qText'); navigator.share({ title: '계약 전 확인 요청', text: ta2.value }).catch(function () { }); break; }
      case 'import-shared': importShared(); break;
      case 'print': window.print(); break;
      case 'ck': {
        var rr = currentRoute, qq = rr.query.q ? findQ(rr.query.q) : null, store = qq ? qq.checklist : S.settings.checklist;
        var cid = el.getAttribute('data-c'), v2 = el.getAttribute('data-v');
        if (store[cid] === v2) delete store[cid]; else store[cid] = v2;
        if (qq) qq.updatedAt = Date.now();
        save();
        $$('[data-act="ck"][data-c="' + cid + '"]').forEach(function (bb) { bb.setAttribute('aria-checked', String(store[cid] === bb.getAttribute('data-v'))); });
        var sc = B.checklistScore(store);
        $('#ckScore').textContent = sc.yes + ' / ' + sc.total; $('#ckBar').style.width = (sc.yes / sc.total * 100).toFixed(1) + '%'; $('#ckMsg').textContent = ckMessage(sc);
        break;
      }
      case 'ck-reset': {
        var qr = el.getAttribute('data-q') ? findQ(el.getAttribute('data-q')) : null;
        if (qr) qr.checklist = {}; else S.settings.checklist = {};
        save(); render(); toast('답변을 지웠어요');
        break;
      }
      case 'export': exportBackup(); break;
      case 'reset':
        confirmModal('모든 데이터를 지울까요?', '저장된 견적, 매장 정보, 체크리스트가 모두 삭제되고 되돌릴 수 없어요.', '모두 삭제', true).then(function (ok) {
          if (!ok) return;
          try { localStorage.removeItem(KEY); } catch (e2) { }
          S = B.defaultState(); wiz = null; qSel = {};
          updateTabs(); toast('모든 데이터를 지웠어요'); replaceTo('#/');
        });
        break;
    }
  });

  function exportBackup() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'seomyeong-backup-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('백업 파일을 저장했어요');
  }
  function importBackup(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var st = B.sanitizeState(JSON.parse(rd.result));
        confirmModal('백업을 불러올까요?', '지금 기기에 있는 데이터가 백업 파일(견적 ' + st.quotes.length + '개)로 바뀌어요.', '불러오기').then(function (ok) {
          if (!ok) return; S = st; save(); toast('백업을 불러왔어요'); render();
        });
      } catch (err) { toast('백업 파일을 읽을 수 없어요'); }
    };
    rd.readAsText(f);
  }

  // ---------- self test (spec §12: 콘솔에서 runSelfTest()) ----------
  window.runSelfTest = function () {
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    var base = { units: 14, monthlyFeePerUnit: 18000, vatIncluded: false, termMonths: 36, upfrontCost: 0, deposit: 0, subsidy: 0, payment: { type: 'VAN', pgFeePct: null }, termination: { type: 'full', promoRefund: 0, closureRelief: 'unknown' } };
    var store = { monthlyCardSales: 25000000, deviceSharePct: 100, currentCardFeePct: 1.0 };
    var tc2 = clone(base); tc2.payment = { type: 'PG', pgFeePct: 2.5 };
    var tc4 = clone(base); tc4.termination = { type: 'partial', remainingFeePct: 50, devicePortionPerUnit: 9000, installClawback: 300000, promoRefund: 0, closureRelief: 'unknown' };
    var tc5 = clone(base); tc5.termination = { type: 'unknown', promoRefund: 0, closureRelief: 'unknown' };
    var c2 = B.calc(tc2, store), c5 = B.calc(tc5, null);
    var res = [
      ['TC1 총비용', B.calc(base, null).totalCost, 9979200],
      ['TC2 PG 추가분(월)', c2.pgExtra, 375000],
      ['TC2 총비용', c2.totalCost, 23479200],
      ['TC3 full m=3', B.penalty(base, 3), 9147600],
      ['TC4 partial m=3', B.penalty(tc4, 3), 7160700],
      ['TC5 unknown = full', c5.penalty(3), B.penalty(base, 3)],
      ['TC5 최악 가정 라벨', c5.worstCase, true],
      ['PG·매장정보 없음 → 계산 불가(null)', B.calc(tc2, null).pgExtra, null]
    ].map(function (r) { return { case: r[0], got: r[1], expected: r[2], pass: r[1] === r[2] }; });
    if (console.table) console.table(res); else console.log(res);
    return { pass: res.every(function (r) { return r.pass; }), results: res };
  };

  // ---------- boot ----------
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
  render();
  if (loadNotice) setTimeout(function () { toast(loadNotice); }, 300);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
})();
