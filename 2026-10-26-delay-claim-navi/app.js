/* 지연보상내비 app.js — 화면·상태. 판정 규칙은 rules.js(DCN_RULES), 공항 데이터는 airports.js(DCN_AIRPORTS) */
(function () {
  'use strict';
  var R = window.DCN_RULES, AIRPORTS = window.DCN_AIRPORTS || [];
  var KEY = 'delayclaim.v1';
  var FX_URL = 'https://open.er-api.com/v6/latest/USD';
  var view = document.getElementById('view');
  var state = load();
  var draft = null;          // 질문 흐름 중인 사건
  var timerId = null;
  var fxStatus = 'idle';     // idle | loading | ok | fail

  /* ---------- 저장 ---------- */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return R.emptyState(); }
    if (!raw) return R.emptyState();
    try { return R.sanitizeState(JSON.parse(raw)); }
    catch (e) {
      try { localStorage.setItem(KEY + '.corrupt.' + Date.now(), raw); } catch (e2) { /* 무시 */ }
      window.__dcnRecovered = true;
      return R.emptyState();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('저장 공간이 부족해 저장하지 못했어요'); return false; }
  }

  /* ---------- 도우미 ---------- */
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function airport(code) { for (var i = 0; i < AIRPORTS.length; i++) if (AIRPORTS[i].code === code) return AIRPORTS[i]; return null; }
  function apLabel(code) { var a = airport(code); return a ? a.city + ' ' + a.code : (code || '기타 공항'); }
  function findClaim(id) { for (var i = 0; i < state.claims.length; i++) if (state.claims[i].id === id) return state.claims[i]; return null; }
  function nowIso() { var d = new Date(), off = -d.getTimezoneOffset(), s = off >= 0 ? '+' : '-', p = function (n) { return (n < 10 ? '0' : '') + n; };
    return R.ymd(d) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + s + p(Math.floor(Math.abs(off) / 60)) + ':' + p(Math.abs(off) % 60); }
  var ICONS = {
    plane: '<path d="M2.5 13.5l19-6.5-3 3.5-6.5 1.5-4 6h-2l1.5-5-3.5.5L2.5 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    cancel: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    seat: '<path d="M7 4v9a2 2 0 002 2h7l2 5M7 13h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 4l6 6M20 4l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    doc: '<path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    check: '<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 7l9 4 9-4M12 11v10" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v6M12 7.5v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 006 6L16 13l5 2v3a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    alert: '<path d="M12 3l10 18H2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10v5M12 18v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    chev: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function icon(n, cls) { return '<svg class="' + (cls || 'i') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[n] || '') + '</svg>'; }
  function sigPill(s) { return '<span class="pill sig-' + s + '"><span class="sig-dot" aria-hidden="true"></span>' + esc(R.signalLabel(s)) + '</span>'; }
  var toastTimer = null;
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200); }
  function confirmBox(title, body, okLabel, onOk) {
    var root = document.getElementById('modal-root'), prev = document.activeElement;
    root.innerHTML = '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="m-t" aria-describedby="m-b"><h2 id="m-t" class="mt0">' + esc(title) + '</h2><p id="m-b">' + esc(body) +
      '</p><div class="row"><button type="button" class="btn secondary" id="m-no">취소</button><button type="button" class="btn danger" id="m-ok">' + esc(okLabel) + '</button></div></div></div>';
    function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); }
    function onKey(e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') { var f = $$('#modal-root button'); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } } }
    document.addEventListener('keydown', onKey);
    $('#m-no').onclick = close; $('#m-ok').onclick = function () { close(); onOk(); };
    $('#m-no').focus();
  }
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? '복사했어요' : '복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('복사했어요'); }, fallback);
    else fallback();
  }
  function shareText(title, text) {
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () { /* 사용자가 취소 */ }); }
    else copyText(text);
  }
  function setTitle(t) { document.title = t ? t + ' · 지연보상내비' : '지연보상내비 — 비행기 지연·결항 보상 3분 판정과 청구서'; }
  function topBar(title, backHref) {
    return '<header class="top">' + (backHref ? '<a class="back" href="' + backHref + '" aria-label="뒤로">' + icon('back') + '</a>' : '') + '<h1>' + esc(title) + '</h1></header>';
  }
  function chrome(mode) { // mode: 'tabs' | 'none'
    var tb = document.getElementById('tabbar'); tb.hidden = mode !== 'tabs';
    var r = location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
    $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function render(html, mode, title) {
    if (timerId) { clearInterval(timerId); timerId = null; }
    view.innerHTML = html; chrome(mode); setTitle(title);
    window.scrollTo(0, 0);
  }
  function focusMain() { var h = $('#view h2') || $('#view h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }

  /* ---------- S1 홈 ---------- */
  function viewHome() {
    var n = state.claims.length, atAirport = !!state.settings.atAirport;
    var onboard = state.settings.onboarded ? '' :
      '<section class="card" aria-labelledby="ob-t"><h2 id="ob-t" class="mt0">처음 오셨나요? 이렇게 써요</h2><ol class="todo">' +
      '<li><span>무슨 일이 있었는지 고르고 질문 5개에 답해요.</span></li><li><span>한국 기준·EU261 중 어떤 기준인지, 예상 배상액과 신호등을 봐요.</span></li><li><span>청구서를 복사해 항공사에 보내고, 14일 회신 기한을 여기서 챙겨요.</span></li></ol>' +
      '<p class="small">입력한 내용은 이 기기 브라우저에만 저장돼요. 서버로 보내지 않아요. 결과는 참고용이며 법률 자문이 아니에요.</p>' +
      '<button type="button" class="btn secondary" id="ob-ok">알겠어요</button></section>';
    var recovered = window.__dcnRecovered ? '<div class="notice" role="alert">저장된 기록을 읽지 못해 새로 시작했어요. 이전 기록은 이 기기에 백업해 두었어요.</div>' : '';
    var html = '<section class="hero" aria-labelledby="app-t"><h1 id="app-t">지연보상내비</h1><p class="tag">비행기 늦었을 때, 받을 수 있는 것과 보낼 청구서를 3분 안에.</p>' +
      '<div class="demo" aria-label="예시 결과"><div>' + icon('plane') + '</div><div><div class="lbl">예시 · 김포→제주 2시간 40분 늦게 도착, 기준 운임 44,000원</div><div class="amt">8,800원 <span class="pill sig-green"><span class="sig-dot" aria-hidden="true"></span>받을 가능성 높음</span></div></div></div></section>' +
      recovered +
      '<h2 id="what">무슨 일이 있었나요?</h2>' +
      '<div class="incident" role="list" aria-labelledby="what">' +
      '<a role="listitem" href="#/new/delay"><span class="ic">' + icon('clock') + '</span><span>늦게 도착했어요<small>국내선 1시간·국제선 2시간·EU 3시간부터</small></span></a>' +
      '<a role="listitem" href="#/new/cancel"><span class="ic">' + icon('cancel') + '</span><span>결항됐어요<small>대체편 도착 시각과 통보 시점으로 판정</small></span></a>' +
      '<a role="listitem" href="#/new/overbook"><span class="ic">' + icon('seat') + '</span><span>초과판매로 못 탔어요<small>국제선은 USD 정액(최고 한도)</small></span></a></div>' +
      '<label class="switch" for="at-ap"><span>아직 공항이에요</span><input type="checkbox" role="switch" id="at-ap"' + (atAirport ? ' checked' : '') + '></label>' +
      (atAirport ? '<a class="boxlink" href="#/airport"><span>' + icon('check') + ' 지금 공항에서 남겨 둘 것 6가지</span>' + icon('chev') + '</a>' : '<p class="small" style="margin-top:6px">켜면 지금 공항에서 요구하고 남겨 둘 것을 먼저 보여 드려요.</p>') +
      '<a class="boxlink" href="#/box"><span>' + icon('box') + ' 내 청구함(' + n + ')</span>' + icon('chev') + '</a>' + onboard;
    render(html, 'tabs');
    var ob = $('#ob-ok'); if (ob) ob.onclick = function () { state.settings.onboarded = true; save(); viewHome(); $('#what').focus && focusWhat(); };
    $('#at-ap').onchange = function () { state.settings.atAirport = this.checked; save(); viewHome(); $('#at-ap').focus(); };
  }
  function focusWhat() { var w = $('#what'); if (w) { w.setAttribute('tabindex', '-1'); w.focus(); } }

  /* ---------- S2 질문 흐름 ---------- */
  var DKEY = KEY + '.draft';
  function saveDraft() { try { sessionStorage.setItem(DKEY, JSON.stringify(draft)); } catch (e) { /* 무시 */ } }
  function loadDraft() { try { var d = JSON.parse(sessionStorage.getItem(DKEY) || 'null'); return d && typeof d === 'object' ? d : null; } catch (e) { return null; } }
  function newDraft(type) {
    draft = { type: R.TYPES[type] ? type : 'delay', from: '', to: '', fromRegion: null, toRegion: null, distanceKm: null, custom: false, flightNo: '', date: '',
      airlineCode: '', timeMode: 'dur', scheduledArr: '', actualArr: '', delayMinutes: null, delayUnknown: false, noticeDaysBefore: null, noticeUnknown: false,
      noAlt: false, altRejected: false, lateCheckin: 'unknown', altFlightDelayMinutes: null, reason: '', fareTotal: null, fareTaxes: null, totalUnknown: false, taxUnknown: false };
    saveDraft(); location.hash = '#/q/1';
  }
  var STEP_TITLES = ['노선', '항공사', '시간', '사유', '운임'];
  function stepShell(n, inner) {
    return topBar(R.TYPES[draft.type] + ' · ' + n + '/5', n === 1 ? '#/' : '#/q/' + (n - 1)) +
      '<div class="progress" role="progressbar" aria-label="질문 진행" aria-valuemin="1" aria-valuemax="5" aria-valuenow="' + n + '" aria-valuetext="5단계 중 ' + n + '단계 ' + STEP_TITLES[n - 1] + '"><i style="width:' + (n * 20) + '%"></i></div>' +
      inner + '<p class="err" id="q-err" role="alert"></p>' +
      '<div class="navbar"><div class="in"><a class="btn secondary" href="' + (n === 1 ? '#/' : '#/q/' + (n - 1)) + '">이전</a><button type="button" class="btn primary" id="q-next">' + (n === 5 ? '결과 보기' : '다음') + '</button></div></div>';
  }
  function err(msg) { var e = $('#q-err'); e.textContent = msg; return false; }
  function minutesOf(a, b) { var x = new Date(a), y = new Date(b); if (isNaN(x) || isNaN(y)) return null; return Math.round((y - x) / 60000); }

  function airportPicker(which, label) {
    var code = draft[which], a = airport(code);
    if (a) return '<label class="f" id="' + which + '-l">' + label + '</label><div class="picked" aria-labelledby="' + which + '-l"><span>' + esc(a.city + ' · ' + a.nameKo + ' (' + a.code + ')') + '</span><button type="button" class="btn ghost small" data-clear="' + which + '" aria-label="' + label + ' 바꾸기">바꾸기</button></div>';
    return '<label class="f" for="' + which + '-q">' + label + '</label><input type="search" id="' + which + '-q" autocomplete="off" placeholder="공항 코드나 도시 (예: 제주, CJU)" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="' + which + '-list">' +
      '<ul class="sugg" id="' + which + '-list" role="listbox" aria-label="' + label + ' 검색 결과" hidden></ul>';
  }
  function bindPicker(which) {
    var inp = $('#' + which + '-q'); if (!inp) { var b = $('[data-clear="' + which + '"]'); if (b) b.onclick = function () { draft[which] = ''; saveDraft(); viewStep(1); var q = $('#' + which + '-q'); if (q) q.focus(); }; return; }
    var list = $('#' + which + '-list'), items = [], active = -1;
    function draw() {
      items = R.searchAirports(AIRPORTS, inp.value, 8); active = items.length ? 0 : -1;
      if (!inp.value.trim()) { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); return; }
      list.innerHTML = items.length ? items.map(function (a, i) { return '<li role="option" id="' + which + '-o' + i + '" aria-selected="' + (i === active) + '" data-code="' + a.code + '"><b>' + a.code + '</b><span>' + esc(a.city + ' · ' + a.nameKo) + '</span></li>'; }).join('')
        : '<li role="option" aria-selected="false" aria-disabled="true">찾는 공항이 없어요. 아래 ‘목록에 없어요’를 눌러 주세요.</li>';
      list.hidden = false; inp.setAttribute('aria-expanded', 'true'); upd();
    }
    function upd() { $$('li[role=option]', list).forEach(function (li, i) { li.setAttribute('aria-selected', String(i === active)); }); if (active >= 0) inp.setAttribute('aria-activedescendant', which + '-o' + active); else inp.removeAttribute('aria-activedescendant'); }
    function pick(code) { draft[which] = code; draft.custom = false; saveDraft(); viewStep(1); var nxt = which === 'from' ? $('#to-q') : $('#flightNo'); if (nxt) nxt.focus(); }
    inp.addEventListener('input', draw);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); active = Math.min(items.length - 1, active + 1); upd(); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); active = Math.max(0, active - 1); upd(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && items[active]) pick(items[active].code); }
      else if (e.key === 'Escape') { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }
    });
    list.addEventListener('click', function (e) { var li = e.target.closest('li[data-code]'); if (li) pick(li.getAttribute('data-code')); });
  }
  function viewStep(n) {
    if (!draft) draft = loadDraft();
    if (!draft) { location.hash = '#/'; return; }
    n = Math.max(1, Math.min(5, n | 0));
    var h = '';
    if (n === 1) {
      h = '<h2>어느 노선이었나요?</h2>' + airportPicker('from', '출발 공항') + airportPicker('to', '도착 공항') +
        '<details' + (draft.custom ? ' open' : '') + ' id="custom-d"><summary>목록에 없어요</summary>' +
        '<p class="small">공항을 찾지 못했다면 지역과 거리를 직접 골라 주세요. 출발·도착 공항을 하나만 골랐어도 괜찮아요.</p>' +
        '<label class="f" for="fromRegion">출발 지역</label><select id="fromRegion"><option value="">선택</option><option value="KR">한국</option><option value="EU">EU·EEA·스위스</option><option value="OTHER">그 외</option></select>' +
        '<label class="f" for="toRegion">도착 지역</label><select id="toRegion"><option value="">선택</option><option value="KR">한국</option><option value="EU">EU·EEA·스위스</option><option value="OTHER">그 외</option></select>' +
        '<label class="f" for="distanceKm">운항 거리(km, 모르면 비워 두세요)</label><input type="number" inputmode="numeric" id="distanceKm" min="0" max="20000" value="' + esc(draft.distanceKm || '') + '"></details>' +
        '<label class="f" for="flightNo">편명 <span class="small">(선택)</span></label><input type="text" id="flightNo" maxlength="8" autocapitalize="characters" placeholder="예: LJ301" value="' + esc(draft.flightNo) + '">' +
        '<label class="f" for="fdate">운항일 <span class="small">(선택)</span></label><input type="date" id="fdate" value="' + esc(draft.date) + '">';
    } else if (n === 2) {
      h = '<h2>운항 항공사는 어디였나요?</h2><p class="sub">공동운항이면 실제로 비행기를 운항한 항공사를 골라 주세요. EU261은 운항 항공사 기준이에요.</p><div class="choices" role="radiogroup" aria-label="항공사">' +
        R.AIRLINES.map(function (al) { var sel = draft.airlineCode === al.code; return '<button type="button" class="choice" role="radio" aria-checked="' + sel + '" tabindex="' + (sel || (!draft.airlineCode && al.code === 'KE') ? 0 : -1) + '" data-al="' + al.code + '">' + esc(al.nameKo) + (al.code.length === 2 ? ' <span class="small">' + al.code + '</span>' : '') + (al.isEuCarrier ? '<span class="eu">EU 항공사</span>' : '') + '</button>'; }).join('') + '</div>';
    } else if (n === 3) {
      h = stepTime();
    } else if (n === 4) {
      var rs = [['none', '안내 없음'], ['weather', '기상 악화'], ['maintenance', '정비·기술 문제'], ['connection', '앞편 지연(연결)'], ['airport', '공항 사정'], ['other', '기타'], ['unknown', '모르겠어요']];
      h = '<h2>항공사가 말한 사유는 무엇이었나요?</h2><p class="sub">문자·방송·카운터에서 들은 사유를 골라 주세요.</p><div class="choices" role="radiogroup" aria-label="지연 사유">' +
        rs.map(function (r, i) { var sel = draft.reason === r[0]; return '<button type="button" class="choice" role="radio" aria-checked="' + sel + '" tabindex="' + (sel || (!draft.reason && i === 0) ? 0 : -1) + '" data-rs="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>';
    } else {
      h = '<h2>운임을 알려 주세요</h2><p class="sub">한국 기준은 총 결제액에서 세금·유류할증료·수수료를 뺀 ‘운임’의 비율이에요. 예약 확인 메일이나 영수증에서 볼 수 있어요.</p>' +
        '<label class="f" for="fareTotal">총 결제액(원)</label><input type="number" inputmode="numeric" id="fareTotal" min="0" placeholder="예: 59000" value="' + esc(draft.fareTotal === null ? '' : draft.fareTotal) + '"' + (draft.totalUnknown ? ' disabled' : '') + '>' +
        '<label class="check" for="totalUnknown"><input type="checkbox" id="totalUnknown"' + (draft.totalUnknown ? ' checked' : '') + '><span>총액을 몰라요(비율로만 보여 드려요)</span></label>' +
        '<label class="f" for="fareTaxes">세금·유류할증료·수수료 합계(원)</label><input type="number" inputmode="numeric" id="fareTaxes" min="0" placeholder="예: 15000" value="' + esc(draft.fareTaxes === null ? '' : draft.fareTaxes) + '"' + (draft.taxUnknown || draft.totalUnknown ? ' disabled' : '') + '>' +
        '<label class="check" for="taxUnknown"><input type="checkbox" id="taxUnknown"' + (draft.taxUnknown ? ' checked' : '') + '><span>모르겠어요(총액 기준으로 계산 — 실제는 더 적을 수 있음)</span></label>';
    }
    render(stepShell(n, h), 'none', STEP_TITLES[n - 1]);
    bindStep(n);
    focusMain();
  }

  function durWidget(id, label, minutes, unknown) {
    var m = minutes === null || minutes === undefined ? 0 : minutes, h = Math.floor(m / 60), mm = m % 60;
    return '<fieldset class="card" id="' + id + '-fs" style="border:1px solid var(--line)"><legend class="f" style="padding:0 4px">' + label + '</legend>' +
      '<div class="row"><div><label class="small" for="' + id + '-h">시간</label><input type="number" inputmode="numeric" id="' + id + '-h" min="0" max="168" value="' + (minutes === null ? '' : h) + '"' + (unknown ? ' disabled' : '') + '></div>' +
      '<div><label class="small" for="' + id + '-m">분</label><input type="number" inputmode="numeric" id="' + id + '-m" min="0" max="59" step="5" value="' + (minutes === null ? '' : mm) + '"' + (unknown ? ' disabled' : '') + '></div></div>' +
      '<label class="sr" for="' + id + '-r">' + label + ' 슬라이더</label><input type="range" id="' + id + '-r" min="0" max="900" step="5" value="' + Math.min(900, m) + '" style="width:100%;min-height:44px;accent-color:#1B64CC"' + (unknown ? ' disabled' : '') + '>' +
      '<p class="small" id="' + id + '-out" aria-live="polite">' + (minutes === null || unknown ? '아직 입력하지 않았어요' : esc(R.hm(m) || '0분')) + '</p>' +
      '<label class="check" for="' + id + '-u"><input type="checkbox" id="' + id + '-u"' + (unknown ? ' checked' : '') + '><span>모르겠어요</span></label></fieldset>';
  }
  function bindDur(id, get, set) {
    var h = $('#' + id + '-h'), m = $('#' + id + '-m'), r = $('#' + id + '-r'), out = $('#' + id + '-out'), u = $('#' + id + '-u');
    function fromHM() { var hv = R.num(h.value), mv = R.num(m.value); if (hv === null && mv === null) { set(null); out.textContent = '아직 입력하지 않았어요'; return; } var t = Math.max(0, (hv || 0) * 60 + (mv || 0)); set(t); r.value = Math.min(900, t); out.textContent = R.hm(t) || '0분'; }
    function fromR() { var t = Number(r.value); set(t); h.value = Math.floor(t / 60); m.value = t % 60; out.textContent = R.hm(t) || '0분'; }
    h.oninput = fromHM; m.oninput = fromHM; r.oninput = fromR;
    u.onchange = function () { [h, m, r].forEach(function (x) { x.disabled = u.checked; }); set(u.checked ? null : get()); draft[id + 'Unknown'] = u.checked; saveDraft(); out.textContent = u.checked ? '모름으로 판정해요' : (get() === null ? '아직 입력하지 않았어요' : R.hm(get()) || '0분'); };
  }
  function stepTime() {
    var t = draft.type, h = '';
    if (t === 'delay') {
      h = '<h2>목적지에 얼마나 늦게 도착했나요?</h2><p class="sub">출발이 아니라 <b>도착</b> 기준이에요.</p>' +
        '<div class="tabs" role="tablist" aria-label="입력 방식"><button type="button" role="tab" id="tm-dur" aria-selected="' + (draft.timeMode !== 'clock') + '" aria-controls="tp">몇 시간 늦었는지</button><button type="button" role="tab" id="tm-clock" aria-selected="' + (draft.timeMode === 'clock') + '" aria-controls="tp">시각으로 입력</button></div><div id="tp" role="tabpanel">' +
        (draft.timeMode === 'clock'
          ? '<label class="f" for="sArr">예정 도착 시각</label><input type="datetime-local" id="sArr" value="' + esc(draft.scheduledArr) + '"><label class="f" for="aArr">실제 도착 시각</label><input type="datetime-local" id="aArr" value="' + esc(draft.actualArr) + '"><p class="small" id="clk-out" aria-live="polite">' + (draft.delayMinutes !== null ? '도착 ' + esc(R.hm(draft.delayMinutes) || '0분') + ' 지연' : '') + '</p>'
          : durWidget('delay', '도착 지연 시간', draft.delayMinutes, draft.delayUnknown)) + '</div>';
    } else if (t === 'cancel') {
      h = '<h2>결항 통보와 대체편을 알려 주세요</h2>' +
        '<label class="f" for="notice">출발 며칠 전에 결항을 통보받았나요?</label><input type="number" inputmode="numeric" id="notice" min="0" max="365" placeholder="당일이면 0" value="' + esc(draft.noticeDaysBefore === null ? '' : draft.noticeDaysBefore) + '"' + (draft.noticeUnknown ? ' disabled' : '') + '>' +
        '<label class="check" for="notice-u"><input type="checkbox" id="notice-u"' + (draft.noticeUnknown ? ' checked' : '') + '><span>모르겠어요</span></label>' +
        altBlock('대체편으로 원래 도착 예정보다 얼마나 늦게 도착했나요?', 'delay', draft.delayMinutes);
    } else {
      h = '<h2>대체편과 체크인 시각을 알려 주세요</h2>' + altBlock('대체편으로 원래 도착 예정보다 얼마나 늦게 도착했나요?', 'alt', draft.altFlightDelayMinutes) +
        '<label class="check" for="altRej"><input type="checkbox" id="altRej"' + (draft.altRejected ? ' checked' : '') + '><span>항공사가 준 대체편을 거절했어요</span></label>' +
        '<fieldset style="border:0;padding:0;margin:12px 0 0"><legend class="f">탑승수속 마감 시간 전에 체크인 카운터에 도착했나요?</legend><div class="choices two" role="radiogroup" aria-label="체크인 마감 전 도착 여부">' +
        [['no', '네, 마감 전'], ['yes', '아니요, 마감 후'], ['unknown', '모르겠어요']].map(function (o) { var sel = draft.lateCheckin === o[0]; return '<button type="button" class="choice" role="radio" aria-checked="' + sel + '" tabindex="' + (sel ? 0 : -1) + '" data-lc="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></fieldset>';
    }
    return h;
  }
  function altBlock(label, id, val) {
    return '<fieldset style="border:0;padding:0;margin:12px 0 0"><legend class="f">대체편이 있었나요?</legend><div class="choices two" role="radiogroup" aria-label="대체편 여부">' +
      '<button type="button" class="choice" role="radio" aria-checked="' + (!draft.noAlt) + '" tabindex="' + (!draft.noAlt ? 0 : -1) + '" data-alt="yes">대체편을 탔어요</button>' +
      '<button type="button" class="choice" role="radio" aria-checked="' + (!!draft.noAlt) + '" tabindex="' + (draft.noAlt ? 0 : -1) + '" data-alt="no">대체편이 없었어요</button></div></fieldset>' +
      (draft.noAlt ? '' : durWidget(id, label, val, draft[id + 'Unknown']));
  }
  function radioKeys(container, attr, onPick) {
    var btns = $$('[' + attr + ']', container);
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { onPick(b.getAttribute(attr)); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, j = null;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % btns.length; else if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
        if (j !== null) { e.preventDefault(); btns.forEach(function (x) { x.tabIndex = -1; }); btns[j].tabIndex = 0; btns[j].focus(); }
      });
    });
  }
  function bindStep(n) {
    var next = $('#q-next');
    if (n === 1) {
      bindPicker('from'); bindPicker('to');
      var fr = $('#fromRegion'), tr = $('#toRegion'), dk = $('#distanceKm');
      fr.value = draft.fromRegion || ''; tr.value = draft.toRegion || '';
      fr.onchange = function () { draft.fromRegion = fr.value || null; draft.custom = true; saveDraft(); };
      tr.onchange = function () { draft.toRegion = tr.value || null; draft.custom = true; saveDraft(); };
      dk.oninput = function () { draft.distanceKm = R.num(dk.value); saveDraft(); };
      $('#flightNo').oninput = function () { draft.flightNo = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); saveDraft(); };
      $('#fdate').onchange = function () { draft.date = this.value; saveDraft(); };
      next.onclick = function () {
        var fromOk = draft.from || draft.fromRegion, toOk = draft.to || draft.toRegion;
        if (!fromOk || !toOk) return err('출발·도착 공항을 골라 주세요. 목록에 없으면 ‘목록에 없어요’에서 지역을 골라 주세요.');
        if (draft.from && draft.to && draft.from === draft.to) return err('출발과 도착 공항이 같아요.');
        location.hash = '#/q/2';
      };
    } else if (n === 2) {
      radioKeys(view, 'data-al', function (code) { draft.airlineCode = code; saveDraft(); $$('[data-al]').forEach(function (b) { var s = b.getAttribute('data-al') === code; b.setAttribute('aria-checked', String(s)); b.tabIndex = s ? 0 : -1; }); err(''); });
      next.onclick = function () { if (!draft.airlineCode) return err('항공사를 골라 주세요. 모르면 ‘모르겠어요’를 골라 주세요.'); location.hash = '#/q/3'; };
    } else if (n === 3) {
      if (draft.type === 'delay') {
        var tabs = [$('#tm-dur'), $('#tm-clock')];
        tabs.forEach(function (tb, i) { tb.tabIndex = tb.getAttribute('aria-selected') === 'true' ? 0 : -1; tb.onclick = function () { draft.timeMode = i ? 'clock' : 'dur'; saveDraft(); viewStep(3); (i ? $('#tm-clock') : $('#tm-dur')).focus(); };
          tb.onkeydown = function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); tabs[1 - i].click(); } }; });
        if (draft.timeMode === 'clock') {
          var s = $('#sArr'), a = $('#aArr');
          var upd = function () { draft.scheduledArr = s.value; draft.actualArr = a.value; var m = minutesOf(s.value, a.value); draft.delayMinutes = m !== null && m >= 0 ? m : null; draft.delayUnknown = false; saveDraft(); $('#clk-out').textContent = m === null ? '' : m < 0 ? '실제 도착이 예정보다 빨라요. 시각을 확인해 주세요.' : '도착 ' + (R.hm(m) || '0분') + ' 지연'; };
          s.onchange = upd; a.onchange = upd;
        } else bindDur('delay', function () { return draft.delayMinutes; }, function (v) { draft.delayMinutes = v; saveDraft(); });
        next.onclick = function () { if (draft.delayMinutes === null && !draft.delayUnknown) return err(draft.timeMode === 'clock' ? '예정·실제 도착 시각을 모두 입력해 주세요.' : '지연 시간을 입력하거나 ‘모르겠어요’를 골라 주세요.'); location.hash = '#/q/4'; };
      } else {
        var vid = draft.type === 'cancel' ? 'delay' : 'alt', key = draft.type === 'cancel' ? 'delayMinutes' : 'altFlightDelayMinutes';
        if (draft.type === 'cancel') {
          var nt = $('#notice'), nu = $('#notice-u');
          nt.oninput = function () { draft.noticeDaysBefore = R.num(nt.value); saveDraft(); };
          nu.onchange = function () { draft.noticeUnknown = nu.checked; nt.disabled = nu.checked; if (nu.checked) draft.noticeDaysBefore = null; saveDraft(); };
        } else {
          $('#altRej').onchange = function () { draft.altRejected = this.checked; saveDraft(); };
          radioKeys(view, 'data-lc', function (v) { draft.lateCheckin = v; saveDraft(); $$('[data-lc]').forEach(function (b) { var s2 = b.getAttribute('data-lc') === v; b.setAttribute('aria-checked', String(s2)); b.tabIndex = s2 ? 0 : -1; }); });
        }
        radioKeys(view, 'data-alt', function (v) { draft.noAlt = v === 'no'; saveDraft(); viewStep(3); var f = $('[data-alt="' + v + '"]'); if (f) f.focus(); });
        if (!draft.noAlt) bindDur(vid, function () { return draft[key]; }, function (v) { draft[key] = v; saveDraft(); });
        next.onclick = function () {
          if (draft.type === 'cancel' && draft.noticeDaysBefore === null && !draft.noticeUnknown) return err('통보받은 날짜를 입력하거나 ‘모르겠어요’를 골라 주세요.');
          if (!draft.noAlt && draft[key] === null && !draft[vid + 'Unknown']) return err('대체편 도착 지연 시간을 입력하거나 ‘모르겠어요’를 골라 주세요.');
          location.hash = '#/q/4';
        };
      }
    } else if (n === 4) {
      radioKeys(view, 'data-rs', function (v) { draft.reason = v; saveDraft(); $$('[data-rs]').forEach(function (b) { var s3 = b.getAttribute('data-rs') === v; b.setAttribute('aria-checked', String(s3)); b.tabIndex = s3 ? 0 : -1; }); err(''); });
      next.onclick = function () { if (!draft.reason) return err('사유를 골라 주세요. 모르면 ‘모르겠어요’를 골라 주세요.'); location.hash = '#/q/5'; };
    } else {
      var ft = $('#fareTotal'), fx = $('#fareTaxes'), tu = $('#totalUnknown'), xu = $('#taxUnknown');
      ft.oninput = function () { draft.fareTotal = R.num(ft.value); saveDraft(); };
      fx.oninput = function () { draft.fareTaxes = R.num(fx.value); saveDraft(); };
      tu.onchange = function () { draft.totalUnknown = tu.checked; ft.disabled = tu.checked; fx.disabled = tu.checked || xu.checked; saveDraft(); };
      xu.onchange = function () { draft.taxUnknown = xu.checked; fx.disabled = xu.checked || tu.checked; saveDraft(); };
      next.onclick = function () {
        if (!draft.totalUnknown && (draft.fareTotal === null || draft.fareTotal <= 0)) return err('총 결제액을 입력하거나 ‘총액을 몰라요’를 골라 주세요.');
        if (!draft.totalUnknown && !draft.taxUnknown && draft.fareTaxes === null) return err('세금·유류할증료 합계를 입력하거나 ‘모르겠어요’를 골라 주세요.');
        if (!draft.totalUnknown && !draft.taxUnknown && draft.fareTaxes > draft.fareTotal) return err('세금·유류할증료가 총액보다 커요. 숫자를 확인해 주세요.');
        finishDraft();
      };
    }
  }
  function finishDraft() {
    var d = draft;
    var c = R.sanitizeClaim({
      id: 'c_' + Date.now(), createdAt: nowIso(), type: d.type, flightNo: d.flightNo, date: d.date, from: d.from, to: d.to,
      fromRegion: d.from ? null : d.fromRegion, toRegion: d.to ? null : d.toRegion, distanceKm: d.distanceKm, airlineCode: d.airlineCode,
      isEuCarrier: (R.airlineByCode(d.airlineCode) || {}).isEuCarrier, scheduledArr: d.timeMode === 'clock' ? d.scheduledArr : '', actualArr: d.timeMode === 'clock' ? d.actualArr : '',
      delayMinutes: d.type === 'overbook' ? null : d.delayMinutes, altFlightDelayMinutes: d.type === 'overbook' ? d.altFlightDelayMinutes : null,
      noticeDaysBefore: d.type === 'cancel' ? d.noticeDaysBefore : null, noAlt: d.type !== 'delay' && d.noAlt, altRejected: d.type === 'overbook' && d.altRejected,
      lateCheckin: d.type === 'overbook' ? d.lateCheckin : 'unknown', reason: d.reason === 'unknown' ? 'none' : d.reason,
      fareTotal: d.totalUnknown ? null : d.fareTotal, fareTaxes: d.totalUnknown || d.taxUnknown ? null : d.fareTaxes, stage: 'draft', name: state.settings.name
    });
    var ev = R.evaluate(c, AIRPORTS);
    c.fareBase = ev.fareBase;
    c.result = summarize(ev);
    state.claims.unshift(c); save();
    try { sessionStorage.removeItem(DKEY); } catch (e) { /* 무시 */ }
    draft = null;
    location.hash = '#/result/' + c.id;
  }
  function summarize(ev) {
    var top = ev.results.filter(function (r) { return r.regime === ev.primary; })[0] || ev.results[0];
    return { regime: ev.regime, amountMin: top.amountMin, amountMax: top.amountMax, currency: top.currency, signal: ev.signal, basis: top.basis.slice(0, 6) };
  }

  /* ---------- 환율 (실패 시 수동 입력) ---------- */
  function fxValid() { var s = state.settings; if (!s.fxUSD || !s.fxEUR) return false; if (s.fxSource === 'manual') return true; var t = Date.parse(s.fxUpdatedAt || ''); return !isNaN(t) && (Date.now() - t) < 24 * 3600 * 1000; }
  function fetchFx(done) {
    if (fxStatus === 'loading') return;
    fxStatus = 'loading';
    // 서비스 워커가 아직 페이지를 제어하지 않으면 잠깐(최대 2.5초) 기다린다. SW가 네트워크 실패를 오류 JSON으로 바꿔 줘서 콘솔에 네트워크 오류가 남지 않는다.
    var sw = navigator.serviceWorker;
    if (sw && /^https?:$/.test(location.protocol) && !sw.controller) {
      var went = false, go = function () { if (went) return; went = true; doFetchFx(done); };
      sw.addEventListener('controllerchange', go); setTimeout(go, 2500); return;
    }
    doFetchFx(done);
  }
  function doFetchFx(done) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    var p;
    try { p = fetch(FX_URL, ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' }); } catch (e) { p = Promise.reject(e); }
    p.then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
      clearTimeout(to);
      var krw = j && j.result === 'success' && j.rates ? Number(j.rates.KRW) : NaN, eur = j && j.rates ? Number(j.rates.EUR) : NaN;
      if (!(krw > 0) || !(eur > 0)) throw new Error('shape');
      state.settings.fxUSD = Math.round(krw * 100) / 100; state.settings.fxEUR = Math.round(krw / eur * 100) / 100;
      state.settings.fxUpdatedAt = new Date().toISOString(); state.settings.fxSource = 'api'; save(); fxStatus = 'ok'; done();
    }).catch(function () { clearTimeout(to); fxStatus = 'fail'; done(); });
  }
  function fxBoxHtml(results) {
    var need = results.filter(function (r) { return (r.currency === 'USD' || r.currency === 'EUR') && r.amountMax !== null && r.eligible !== false; });
    if (!need.length) return '';
    var s = state.settings, inner;
    if (fxValid()) {
      inner = need.map(function (r) { var lo = R.toKRW(r.amountMin, r.currency, { USD: s.fxUSD, EUR: s.fxEUR }), hi = R.toKRW(r.amountMax, r.currency, { USD: s.fxUSD, EUR: s.fxEUR });
        return '<p class="krw"><b>' + esc(R.amountText(r)) + '</b> ≈ ' + (lo !== hi ? R.fmtMoney(lo, 'KRW') + ' ~ ' : '') + R.fmtMoney(hi, 'KRW') + '</p>'; }).join('') +
        '<p class="small">환율: USD 1 = ' + R.fmtMoney(s.fxUSD, 'KRW') + ', EUR 1 = ' + R.fmtMoney(s.fxEUR, 'KRW') + ' · ' + (s.fxSource === 'manual' ? '직접 입력' : '자동(open.er-api.com, ' + esc(String(s.fxUpdatedAt).slice(0, 10)) + ')') + ' · 실제 지급 환율과 달라요</p>' +
        '<button type="button" class="btn ghost small" id="fx-edit">환율 직접 입력</button>';
    } else if (fxStatus === 'fail') {
      inner = '<p class="notice" role="status">환율을 불러오지 못했어요. 외화 금액은 그대로 보여 드리고, 원화로 보려면 환율을 직접 입력해 주세요.</p>' + fxForm();
    } else {
      inner = '<p class="small" role="status">원화 환산을 위해 환율을 불러오는 중이에요…</p>';
    }
    return '<section class="card" id="fx-box" aria-labelledby="fx-t"><h3 id="fx-t">원화로 환산</h3>' + inner + '</section>';
  }
  function fxForm() {
    var s = state.settings;
    return '<div class="fxrow"><div><label class="f" for="fx-usd">USD 1 = 원</label><input type="number" inputmode="decimal" id="fx-usd" min="1" step="0.01" placeholder="예: 1400" value="' + esc(s.fxUSD || '') + '"></div>' +
      '<div><label class="f" for="fx-eur">EUR 1 = 원</label><input type="number" inputmode="decimal" id="fx-eur" min="1" step="0.01" placeholder="예: 1600" value="' + esc(s.fxEUR || '') + '"></div></div>' +
      '<p class="err" id="fx-err" role="alert"></p><div class="row"><button type="button" class="btn secondary small" id="fx-save">환율 저장</button><button type="button" class="btn ghost small" id="fx-retry">다시 불러오기</button></div>';
  }
  function bindFx(rerender) {
    var e = $('#fx-edit'); if (e) e.onclick = function () { $('#fx-box').innerHTML = '<h3 id="fx-t">원화로 환산</h3>' + fxForm(); bindFx(rerender); $('#fx-usd').focus(); };
    var sv = $('#fx-save'); if (sv) sv.onclick = function () {
      var u = R.num($('#fx-usd').value), eu = R.num($('#fx-eur').value);
      if (!(u > 0) || !(eu > 0)) { $('#fx-err').textContent = 'USD·EUR 환율을 모두 0보다 큰 숫자로 입력해 주세요.'; return; }
      state.settings.fxUSD = u; state.settings.fxEUR = eu; state.settings.fxSource = 'manual'; state.settings.fxUpdatedAt = new Date().toISOString(); save(); toast('환율을 저장했어요'); rerender();
    };
    var rt = $('#fx-retry'); if (rt) rt.onclick = function () { fxStatus = 'idle'; state.settings.fxSource = null; state.settings.fxUSD = null; state.settings.fxEUR = null; save(); rerender(); };
  }

  /* ---------- S3 결과 ---------- */
  function resultCard(r, primary) {
    var amt = R.amountText(r), isText = r.amountMax === null || r.amountMax === undefined;
    var reducedEu = r.regime === 'EU261' && r.amountMin !== null && r.amountMin !== r.amountMax && r.amountMin * 2 === r.amountMax;
    var h = '<section class="card ' + (primary ? 'result-main s-' + r.signal : 'second') + '" aria-labelledby="t-' + r.regime + '">' +
      '<div class="regime">' + (primary ? '적용 기준' : '함께 확인할 기준') + '</div><h3 id="t-' + r.regime + '">' + esc(r.title) + '</h3>';
    if (r.applies === false) {
      h += '<p><b>미적용</b> — ' + esc(r.basis[0] || '') + '</p></section>';
      return h;
    }
    if (r.eligible === false) h += '<p class="amount text">기준 미해당</p>';
    else if (amt) h += '<p class="amount' + (isText ? ' text' : '') + '">' + esc(amt) + '</p>' + (reducedEu ? '<p><b>항공사가 50% 감액하면 ' + R.fmtMoney(r.amountMin, 'EUR') + '</b>, 감액하지 않으면 ' + R.fmtMoney(r.amountMax, 'EUR') + '이에요.</p>' : '') + '<p class="est">참고용 예상치' + (r.upperBound ? ' · 실제는 더 적을 수 있음' : '') + (r.cap ? ' · 숙식비 포함 최고 한도' : '') + '</p>';
    else h += '<p class="amount text">판정 보류</p>';
    h += '<p style="margin-top:8px">' + sigPill(r.signal) + '</p>';
    if (r.uncertain.length) h += '<div class="unc"><b>' + icon('alert') + ' 판단이 갈릴 수 있어요</b><ul>' + r.uncertain.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></div>';
    if (r.notes.length) h += '<ul class="basis small">' + r.notes.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul>';
    h += '<details' + (primary || r.eligible === false ? ' open' : '') + '><summary>왜 이렇게 나왔나</summary><ul class="basis">' + r.basis.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>' +
      '<p class="small">출처: ' + r.sources.map(function (id) { var s = R.SOURCES.filter(function (x) { return x.id === id; })[0]; return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title.split(' — ')[0]) + '</a>' : ''; }).join(' · ') + '</p></details></section>';
    return h;
  }
  function todoList(c, ev) {
    var items = [];
    if (ev.needsReasonRequest) items.push('항공사에 지연 사유와 증빙을 <b>서면으로</b> 요청하세요. 면책은 항공사가 증명해야 해요. <a href="#/letter/' + c.id + '/reason_request_ko">사유 증빙 요청서</a>');
    if (ev.regime !== 'NONE') items.push('청구서를 항공사 공식 홈페이지 고객센터에서 접수하고 ‘보냈어요’를 눌러 14일 회신 기한을 챙기세요.');
    else items.push('기준에는 못 미쳐도 식사·숙박 등 실제로 쓴 경비는 영수증과 함께 항공사에 요청할 수 있어요.');
    items.push('탑승권, 지연 안내 문자·전광판 캡처, 식사·숙박·교통 영수증을 모아 두세요.');
    if (ev.regime !== 'NONE' && items.length < 3) items.push('14일 안에 회신이 없거나 결과가 불만족스러우면 1372 소비자상담센터에 상담하세요.');
    return '<section class="card" aria-labelledby="todo-t"><h3 id="todo-t">지금 할 일 ' + Math.min(3, items.length) + '가지</h3><ol class="todo">' + items.slice(0, 3).map(function (t) { return '<li><span>' + t + '</span></li>'; }).join('') + '</ol></section>';
  }
  function viewResult(id) {
    var c = findClaim(id);
    if (!c) return viewMissing();
    var ev = R.evaluate(c, AIRPORTS);
    var a = airport(c.from), b = airport(c.to);
    var head = '<p class="sub">' + esc(R.TYPES[c.type]) + ' · ' + esc(apLabel(c.from)) + ' → ' + esc(apLabel(c.to)) + (ev.distanceKm !== null ? ' · 약 ' + ev.distanceKm.toLocaleString('en-US') + 'km' : '') + (c.flightNo ? ' · ' + esc(c.flightNo) : '') + '</p>';
    var none = ev.regime === 'NONE' ? '<section class="card result-main s-gray" aria-labelledby="none-t"><div class="regime">판정</div><h3 id="none-t">지금 입력으로는 배상 기준에 해당하지 않아요</h3><p style="margin-top:8px">' + sigPill('gray') + '</p><ul class="basis">' +
      ev.results.map(function (r) { return '<li>' + esc(r.basis[r.basis.length - 1] || '') + '</li>'; }).join('') + '</ul><p class="small">시간·노선을 잘못 넣었다면 다시 판정해 보세요.</p></section>' : '';
    var cards = ev.results.map(function (r, i) { return resultCard(r, ev.regime !== 'NONE' && i === 0); }).join('');
    var ck = c.checklist;
    var evid = '<section class="card" aria-labelledby="ev-t"><h3 id="ev-t">숙식비·증빙 체크</h3><p class="notice">' + esc(R.MEAL_NOTICE) + '</p>' +
      '<label class="check" for="ck-r"><input type="checkbox" id="ck-r" data-ck="receipts"' + (ck.receipts ? ' checked' : '') + '><span>식사·숙박·교통 영수증을 보관했어요</span></label>' +
      '<label class="check" for="ck-w"><input type="checkbox" id="ck-w" data-ck="reasonInWriting"' + (ck.reasonInWriting ? ' checked' : '') + '><span>지연 사유를 서면(문자·이메일)으로 받았어요</span></label>' +
      '<label class="check" for="ck-s"><input type="checkbox" id="ck-s" data-ck="screenshot"' + (ck.screenshot ? ' checked' : '') + '><span>안내 문자·전광판 사진을 찍어 두었어요</span></label><p class="small">사진은 내 휴대폰에만 두세요. 이 앱은 파일을 저장하지 않고 체크만 기록해요.</p></section>';
    var agency = '';
    if (ev.eu.applies && ev.eu.eligible !== false && ev.eu.amountMax) {
      var rows = R.agencyNet(ev.eu.amountMax);
      agency = '<section class="card" aria-labelledby="ag-t"><h3 id="ag-t">직접 청구 vs 대행 실수령</h3><table class="cmp"><caption class="sr">EU261 ' + ev.eu.amountMax + '유로 기준 실수령 비교</caption><thead><tr><th scope="col">방법</th><th scope="col">수수료</th><th scope="col">실수령</th></tr></thead><tbody>' +
        rows.map(function (x) { return '<tr><th scope="row">' + esc(x.label) + '</th><td>' + (x.fee ? x.fee.toLocaleString('en-US') + '유로' : '0') + '</td><td><b>' + x.net.toLocaleString('en-US') + '유로</b></td></tr>'; }).join('') +
        '</tbody></table><p class="small">수수료율은 예시예요(대행사마다 다르고 바뀔 수 있어요). 직접 청구는 영어 청구서로 할 수 있어요.</p></section>';
    }
    var html = topBar('판정 결과', '#/') + head +
      '<div class="disclaimer">' + icon('info') + '<span>' + esc(R.DISCLAIMER) + '</span></div>' +
      (state.settings.atAirport ? '<a class="boxlink" href="#/airport"><span>' + icon('check') + ' 아직 공항이라면: 지금 남겨 둘 것</span>' + icon('chev') + '</a>' : '') +
      none + cards + '<div id="fx-slot">' + fxBoxHtml(ev.results) + '</div>' + todoList(c, ev) + evid + agency +
      '<p class="small">' + esc(ev.complexNote) + '</p>' +
      '<div class="row" style="margin-top:8px"><button type="button" class="btn secondary" id="r-share">결과 공유</button><a class="btn secondary" href="#/airport">공항 체크리스트</a></div>' +
      (ev.needsReasonRequest ? '<a class="btn secondary" style="margin-top:10px" href="#/letter/' + c.id + '/reason_request_ko">사유 증빙 요청서 만들기</a>' : '') +
      '<a class="btn ghost" style="margin-top:6px" href="#/new/' + c.type + '">다시 판정하기</a>' +
      '<div class="navbar"><div class="in"><a class="btn secondary" href="#/box">청구함</a><a class="btn primary" href="#/letter/' + c.id + '">청구서 만들기</a></div></div>';
    render(html, 'none', '판정 결과');
    $$('[data-ck]').forEach(function (x) { x.onchange = function () { c.checklist[x.getAttribute('data-ck')] = x.checked; save(); }; });
    $('#r-share').onclick = function () {
      var top = ev.results[0];
      var t = '[지연보상내비] ' + R.TYPES[c.type] + ' ' + apLabel(c.from) + '→' + apLabel(c.to) + (c.flightNo ? ' ' + c.flightNo : '') + '\n' + (ev.regime === 'NONE' ? '기준 미해당' : top.title + ': ' + (R.amountText(top) || '') + ' (' + R.signalLabel(top.signal) + ')') + '\n' + R.DISCLAIMER + '\n' + location.href.split('#')[0];
      shareText('지연보상내비 결과', t);
    };
    var refx = function () { var slot = $('#fx-slot'); if (slot) { slot.innerHTML = fxBoxHtml(ev.results); bindFx(refx); } };
    bindFx(refx);
    if ($('#fx-box') && !fxValid() && fxStatus !== 'fail') fetchFx(refx);
    focusMain();
  }
  function viewMissing() {
    render(topBar('찾을 수 없어요', '#/') + '<div class="card empty">' + icon('alert') + '<h2>이 기록을 찾을 수 없어요</h2><p class="sub">삭제됐거나 다른 기기에서 만든 기록일 수 있어요.</p><a class="btn primary" href="#/">처음으로</a></div>', 'tabs', '찾을 수 없음');
    focusMain();
  }

  /* ---------- S4 청구서 ---------- */
  function viewLetter(id, tpl) {
    var c = findClaim(id); if (!c) return viewMissing();
    var ev = R.evaluate(c, AIRPORTS);
    var keys = ['claim_ko', 'claim_en', 'reason_request_ko', 'ccn1372_summary_ko'];
    if (keys.indexOf(tpl) < 0) tpl = (ev.primary === 'EU261' || (R.airlineByCode(c.airlineCode) || {}).isEuCarrier) ? 'claim_en' : 'claim_ko';
    var text = R.fill(R.TEMPLATES[tpl], R.buildVars(c, ev, { airports: AIRPORTS, name: state.settings.name }));
    var html = topBar('청구서', '#/result/' + c.id) +
      '<div class="tabs" role="tablist" aria-label="문안 종류">' + keys.map(function (k) { return '<button type="button" role="tab" aria-selected="' + (k === tpl) + '" tabindex="' + (k === tpl ? 0 : -1) + '" data-tpl="' + k + '" aria-controls="ltr-panel">' + esc(R.TEMPLATE_LABELS[k]) + '</button>'; }).join('') + '</div>' +
      '<div id="ltr-panel" role="tabpanel"><h2 class="mt0">' + esc(R.TEMPLATE_LABELS[tpl]) + '</h2>' +
      '<label class="f" for="nm">이름(청구인)</label><input type="text" id="nm" maxlength="40" autocomplete="name" value="' + esc(state.settings.name) + '" placeholder="예: 김하린">' +
      '<label class="f" for="ltr">문안 <span class="small">(직접 고칠 수 있어요)</span></label><textarea id="ltr" spellcheck="false">' + esc(text) + '</textarea>' +
      '<p class="small">(확인 필요)로 표시된 곳은 직접 채워 주세요. 항공사 고객센터 주소는 항공사 공식 홈페이지에서 확인하세요.</p>' +
      '<div class="row" style="margin-top:10px"><button type="button" class="btn secondary" id="l-copy">복사</button>' + (navigator.share ? '<button type="button" class="btn secondary" id="l-share">공유</button>' : '') + '<a class="btn secondary" id="l-mail" href="#">메일 앱</a></div></div>' +
      '<div class="disclaimer" style="margin-top:14px">' + icon('info') + '<span>' + esc(R.DISCLAIMER) + '</span></div>' +
      '<div class="navbar"><div class="in"><a class="btn secondary" href="#/result/' + c.id + '">결과</a><button type="button" class="btn primary" id="l-sent">' + (c.sentAt ? '보낸 날 다시 기록' : '보냈어요') + '</button></div></div>';
    render(html, 'none', '청구서');
    var ta = $('#ltr');
    function mailHref() { var subj = tpl === 'claim_en' ? 'Compensation claim ' + (c.flightNo || '') : (tpl === 'reason_request_ko' ? '지연·결항 사유 및 증빙 요청 ' : '항공편 지연·결항 배상 청구 ') + (c.flightNo || ''); return 'mailto:?subject=' + encodeURIComponent(subj.trim()) + '&body=' + encodeURIComponent(ta.value); }
    $('#l-mail').onclick = function (e) { e.preventDefault(); location.href = mailHref(); };
    var tabs = $$('[data-tpl]');
    tabs.forEach(function (b, i) { b.onclick = function () { location.replace('#/letter/' + c.id + '/' + b.getAttribute('data-tpl')); };
      b.onkeydown = function (e) { var j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : null; if (j !== null) { e.preventDefault(); tabs[j].focus(); } }; });
    $('#nm').onchange = function () { state.settings.name = this.value.trim().slice(0, 40); c.name = state.settings.name; save(); var keep = ta.value; ta.value = R.fill(R.TEMPLATES[tpl], R.buildVars(c, ev, { airports: AIRPORTS })); if (keep === ta.value) return; toast('이름을 넣었어요'); };
    $('#l-copy').onclick = function () { copyText(ta.value); };
    var sh = $('#l-share'); if (sh) sh.onclick = function () { shareText(R.TEMPLATE_LABELS[tpl], ta.value); };
    $('#l-sent').onclick = function () { c.sentAt = nowIso(); if (c.stage === 'draft') c.stage = 'sent'; save(); toast('보낸 날을 기록했어요. 14일 기한을 챙겨 드릴게요'); location.hash = '#/box'; };
    focusMain();
  }

  /* ---------- S5 지금 공항에서 ---------- */
  var AP_CHECKS = [
    ['reason', '지연·결항 사유를 문자나 이메일로 달라고 요청했어요', '카운터 직원에게 “사유를 서면으로 받을 수 있나요?”라고 물어보세요. 면책은 항공사가 증명해야 해요.'],
    ['capture', '안내 문자·앱 알림·전광판을 캡처했어요', '시각이 보이게 찍어 두세요.'],
    ['boarding', '탑승권(모바일 포함)을 보관했어요', '청구서 첨부에 필요해요.'],
    ['meal', '식사·숙박이 필요하면 항공사에 먼저 요구했어요', '체재가 필요하면 적정 숙식비 등 경비는 항공사 부담이에요.'],
    ['receipts', '직접 쓴 식사·숙박·교통 영수증을 모았어요', '사진으로도 남겨 두세요.'],
    ['arrival', '실제 도착 시각을 기록했어요', '배상 기준은 출발이 아니라 목적지 도착 시각이에요.']
  ];
  var MILESTONES = [[30, '30분마다 지연 사유와 진행 상황을 안내받아야 해요'], [120, '2시간 초과: 적절한 음식물(물·식사)을 제공받아야 해요'], [180, '3시간: 국내선 기내(지상) 대기 한도'], [240, '4시간: 국제선 기내(지상) 대기 한도']];
  function viewAirport() {
    var ap = state.airport, done = AP_CHECKS.filter(function (x) { return ap.checks[x[0]]; }).length;
    var html = topBar('지금 공항에서', '') + '<h2 class="mt0">지금 남겨 둘 것 <span class="small">(' + done + '/' + AP_CHECKS.length + ')</span></h2><section class="card">' +
      AP_CHECKS.map(function (x) { return '<label class="check" for="ap-' + x[0] + '"><input type="checkbox" id="ap-' + x[0] + '" data-ap="' + x[0] + '"' + (ap.checks[x[0]] ? ' checked' : '') + '><span><b>' + esc(x[1]) + '</b><br><span class="small">' + esc(x[2]) + '</span></span></label>'; }).join('') + '</section>' +
      '<h2>기내 대기 타이머</h2><section class="card" aria-labelledby="tm-t"><h3 id="tm-t" class="sr">기내 대기 타이머</h3><p class="sub">탑승한 채로 활주로·계류장에서 기다리고 있다면 시작을 눌러 두세요. 시작 시각은 이 기기에 저장돼요.</p>' +
      '<div class="timer" id="tm" aria-live="off">' + (ap.waitStart ? '' : '00:00') + '</div><p class="small" id="tm-s">' + (ap.waitStart ? '시작: ' + esc(new Date(ap.waitStart).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })) : '아직 시작하지 않았어요') + '</p>' +
      '<ul class="ms" id="ms">' + MILESTONES.map(function (m) { return '<li data-m="' + m[0] + '"><span class="dot" aria-hidden="true"></span><span>' + esc(m[1]) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="row" style="margin-top:10px">' + (ap.waitStart ? '<button type="button" class="btn secondary" id="tm-stop">타이머 끄기</button>' : '<button type="button" class="btn primary" id="tm-start">대기 시작</button>') + '</div>' +
      '<p class="small" style="margin-top:8px">근거: 항공사업법 제61조의2(이동지역 지연 금지). 안전·보안상 이유 등 예외가 있어요.</p><p class="sr" id="tm-live" aria-live="polite"></p></section>' +
      '<a class="btn secondary" href="#/" style="margin-top:6px">무슨 일인지 판정하러 가기</a>';
    render(html, 'tabs', '지금 공항에서');
    $$('[data-ap]').forEach(function (x) { x.onchange = function () { state.airport.checks[x.getAttribute('data-ap')] = x.checked; save(); var h = $('#view h2 .small'); if (h) h.textContent = '(' + AP_CHECKS.filter(function (y) { return state.airport.checks[y[0]]; }).length + '/' + AP_CHECKS.length + ')'; }; });
    var st = $('#tm-start'); if (st) st.onclick = function () { state.airport.waitStart = Date.now(); save(); viewAirport(); $('#tm-stop').focus(); };
    var sp = $('#tm-stop'); if (sp) sp.onclick = function () { confirmBox('타이머를 끌까요?', '기록한 시작 시각이 지워져요.', '끄기', function () { state.airport.waitStart = null; save(); viewAirport(); }); };
    var lastHit = -1;
    function tick() {
      if (!state.airport.waitStart) return;
      var mins = Math.max(0, Math.floor((Date.now() - state.airport.waitStart) / 60000)), el = $('#tm'); if (!el) return;
      el.textContent = (Math.floor(mins / 60) < 10 ? '0' : '') + Math.floor(mins / 60) + ':' + (mins % 60 < 10 ? '0' : '') + (mins % 60);
      var hits = 0; $$('#ms li').forEach(function (li) { var on = mins >= Number(li.getAttribute('data-m')); li.classList.toggle('hit', on); if (on) hits++; });
      if (hits !== lastHit && lastHit !== -1 && hits > 0) $('#tm-live').textContent = MILESTONES[hits - 1][1];
      lastHit = hits;
    }
    tick(); if (state.airport.waitStart) timerId = setInterval(tick, 15000);
    focusMain();
  }

  /* ---------- S6 내 청구함 ---------- */
  function viewBox() {
    var list = state.claims;
    var body = !list.length ? '<div class="card empty">' + icon('box') + '<h2>아직 청구가 없어요</h2><p class="sub">판정을 마치면 여기에 저장되고, ‘보냈어요’를 누르면 14일 회신 기한을 챙겨 드려요.</p><a class="btn primary" href="#/">판정 시작하기</a></div>'
      : list.map(function (c) {
        var d = R.dday(c.sentAt), r = c.result || { signal: 'gray' };
        var amt = r.amountMax !== null && r.amountMax !== undefined ? R.amountText({ amountMin: r.amountMin, amountMax: r.amountMax, currency: r.currency, cap: r.regime === 'KR_INTL_OVERBOOK', upperBound: false }) : (r.regime === 'NONE' ? '기준 미해당' : '금액 확인 필요');
        var dd = d ? '<span class="dday' + (d.overdue ? ' over' : d.left <= 3 ? ' soon' : '') + '">' + esc(d.label) + '</span>' : '<span class="dday">보내기 전</span>';
        return '<article class="card claim" aria-labelledby="h-' + c.id + '"><div class="head"><div><div class="fl" id="h-' + c.id + '">' + esc(c.flightNo || '편명 미입력') + ' · ' + esc(apLabel(c.from)) + ' → ' + esc(apLabel(c.to)) + '</div><div class="small">' + esc(R.TYPES[c.type]) + (c.date ? ' · ' + esc(c.date) : '') + ' · 만든 날 ' + esc(String(c.createdAt).slice(0, 10)) + '</div></div>' + dd + '</div>' +
          '<p style="margin:8px 0 4px"><b>' + esc(amt) + '</b> <span class="small">참고용 예상치</span></p><p>' + sigPill(r.signal) + '</p>' +
          (d ? '<p class="small">보낸 날 ' + esc(String(c.sentAt).slice(0, 10)) + ' · 회신 기한 ' + esc(d.due) + ' (항공사업법 제61조: 접수일부터 14일, 특별한 사유가 있으면 60일)</p>' : '') +
          (d && d.overdue && (c.stage === 'sent') ? '<div class="notice" role="note">14일이 지났어요. 회신이 없다면 <a href="#/ccn/' + c.id + '">1372 상담 안내</a>로 다음 단계를 진행하세요.</div>' : '') +
          '<label class="f" for="st-' + c.id + '">진행 단계</label><select id="st-' + c.id + '" data-stage="' + c.id + '">' + R.STAGES.map(function (s) { return '<option value="' + s.id + '"' + (c.stage === s.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select>' +
          '<div class="row" style="margin-top:10px"><a class="btn secondary small" href="#/result/' + c.id + '">결과</a><a class="btn secondary small" href="#/letter/' + c.id + '">청구서</a><a class="btn secondary small" href="#/ccn/' + c.id + '">1372</a></div>' +
          '<button type="button" class="btn ghost small" style="color:#B83232;margin-top:4px" data-del="' + c.id + '">이 기록 삭제</button></article>';
      }).join('');
    render(topBar('내 청구함 (' + list.length + ')', '') + body, 'tabs', '내 청구함');
    $$('[data-stage]').forEach(function (s) { s.onchange = function () { var c = findClaim(s.getAttribute('data-stage')); if (!c) return; c.stage = s.value; if (s.value !== 'draft' && !c.sentAt) c.sentAt = nowIso(); save(); toast('단계를 바꿨어요'); if (s.value === 'ccn1372') location.hash = '#/ccn/' + c.id; }; });
    $$('[data-del]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-del'); confirmBox('이 기록을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', '삭제', function () { state.claims = state.claims.filter(function (c) { return c.id !== id; }); save(); toast('삭제했어요'); viewBox(); }); }; });
    focusMain();
  }

  /* ---------- S7 1372 안내 ---------- */
  function viewCcn(id) {
    var c = id ? findClaim(id) : null, ev = c ? R.evaluate(c, AIRPORTS) : null;
    var summary = c ? R.fill(R.TEMPLATES.ccn1372_summary_ko, R.buildVars(c, ev, { airports: AIRPORTS, name: state.settings.name })) : '';
    var html = topBar('1372 상담 안내', c ? '#/box' : '') + '<h2 class="mt0">항공사 회신이 없거나 불만족스러울 때</h2>' +
      '<section class="card"><ol class="todo"><li><span><b>항공사 회신 기한 확인</b> — 항공사는 피해구제 신청을 접수한 날부터 14일 안에 결과를 알려야 해요(번역 등 특별한 사유가 있으면 60일, 사유를 밝혀야 함).</span></li>' +
      '<li><span><b>1372 소비자상담센터 상담</b> — 국번 없이 1372(평일 09:00~18:00, 통화료 발신자 부담) 또는 홈페이지 인터넷 상담.</span></li>' +
      '<li><span><b>한국소비자원 피해구제</b> — 항공사가 기한 내 처리가 어렵거나 소비자가 요청하면 항공사는 신청서를 한국소비자원에 이송해야 해요(항공사업법 제61조 5항).</span></li></ol>' +
      '<div class="row" style="margin-top:10px"><a class="btn primary" href="tel:1372">' + icon('phone') + ' 1372 전화</a><a class="btn secondary" href="https://www.ccn.go.kr" target="_blank" rel="noopener">상담센터 열기</a></div></section>' +
      '<section class="card" aria-labelledby="prep-t"><h3 id="prep-t">준비물</h3><ul class="basis"><li>탑승권·예약 확인서(운임 영수증)</li><li>지연·결항 안내 문자, 전광판 사진</li><li>식사·숙박·교통 영수증</li><li>항공사에 보낸 청구서와 보낸 날짜, 받은 회신</li></ul></section>' +
      (c ? '<section class="card" aria-labelledby="sum-t"><h3 id="sum-t">상담용 요약</h3><label class="sr" for="sum">상담용 요약 문안</label><textarea id="sum" spellcheck="false" style="min-height:260px">' + esc(summary) + '</textarea><button type="button" class="btn secondary" id="sum-copy" style="margin-top:8px">요약 복사</button>' +
        (c.stage !== 'ccn1372' && c.stage !== 'kca' && c.stage !== 'done' ? '<button type="button" class="btn ghost" id="to-ccn">단계를 ‘1372 상담’으로 바꾸기</button>' : '') + '</section>'
        : '<p class="small">청구함의 건에서 열면 상담용 요약을 자동으로 만들어 드려요.</p>') +
      '<div class="disclaimer">' + icon('info') + '<span>' + esc(R.DISCLAIMER) + '</span></div>';
    render(html, 'tabs', '1372 상담 안내');
    var sc = $('#sum-copy'); if (sc) sc.onclick = function () { copyText($('#sum').value); };
    var tc = $('#to-ccn'); if (tc) tc.onclick = function () { c.stage = 'ccn1372'; save(); toast('단계를 바꿨어요'); viewCcn(id); };
    focusMain();
  }

  /* ---------- S8 정보·면책 ---------- */
  function viewInfo() {
    var s = state.settings;
    var html = topBar('정보·출처', '') + '<h2 class="mt0">이 앱의 기준과 한계</h2>' +
      '<div class="disclaimer">' + icon('info') + '<span>' + esc(R.DISCLAIMER) + '</span></div>' +
      '<section class="card" aria-labelledby="src-t"><h3 id="src-t">기준 출처</h3><p class="small">기준 확인일 <b>' + esc(R.CHECKED_AT) + '</b> · 규칙 버전 ' + esc(R.RULES_VERSION) + '</p><ul class="src">' +
      R.SOURCES.map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + '</a><br><span class="small">' + esc(x.note) + '</span></li>'; }).join('') + '</ul></section>' +
      '<section class="card" aria-labelledby="lim-t"><h3 id="lim-t">이렇게 판단해요</h3><ul class="basis">' +
      '<li>한국 기준(소비자분쟁해결기준)은 분쟁 해결을 위한 합의·권고 기준이에요. 항공사가 받아들이지 않으면 바로 강제되지는 않아요.</li>' +
      '<li>원문 구간이 경계 시각(예: 정확히 2시간)에서 겹치는 곳은 두 비율을 범위로 보여 줘요.</li>' +
      '<li>EU261의 지연 보상(도착 3시간 이상)과 3~4시간 지연 50% 감액은 규정 본문이 아니라 EU 사법재판소 판례 해석이에요.</li>' +
      '<li>EEA(노르웨이 등)·스위스 노선의 EU261 적용은 협정에 따른 것으로, 이 앱에서 원문을 확인하지 못해 ‘판단이 갈릴 수 있어요’로 표시해요. 영국 출발편은 EU261이 아니라 영국 규정이라 다루지 않아요.</li>' +
      '<li>개정 EU 규정 (EU) 2026/2202는 2027-10-23부터 적용돼요. 그 전까지는 기존 규정 기준이에요.</li>' +
      '<li>경유·공동운항은 최종 목적지 도착 시각과 실제 운항 항공사 기준으로 항공사에 확인하세요.</li></ul></section>' +
      '<section class="card" aria-labelledby="gd-t"><h3 id="gd-t">기준 쉽게 읽기</h3><ul class="basis"><li><a href="domestic-flight-delay-compensation/">국내선 지연 보상 기준</a></li><li><a href="eu261-compensation/">EU261 보상 한국어 안내</a></li><li><a href="flight-cancellation-overbooking/">결항·초과판매 보상</a></li></ul></section>' +
      '<section class="card" aria-labelledby="pv-t"><h3 id="pv-t">개인정보</h3><p>입력한 편명·운임·이름은 이 기기 브라우저(localStorage, 키 <code>delayclaim.v1</code>)에만 저장돼요. 서버·로그인·광고 추적이 없어요.</p><p class="small">원화 환산을 위해 공개 환율 API(open.er-api.com)에 환율만 요청해요. 입력한 정보는 보내지 않아요.</p></section>' +
      '<section class="card" aria-labelledby="fxs-t"><h3 id="fxs-t">환율 설정</h3><p class="small">' + (s.fxUSD ? 'USD 1 = ' + esc(R.fmtMoney(s.fxUSD, 'KRW')) + ', EUR 1 = ' + esc(R.fmtMoney(s.fxEUR, 'KRW')) + ' (' + (s.fxSource === 'manual' ? '직접 입력' : '자동') + ')' : '아직 환율이 없어요. 결과 화면에서 자동으로 불러오거나 여기서 직접 입력하세요.') + '</p><div id="fx-box">' + fxForm() + '</div></section>' +
      '<section class="card" aria-labelledby="st-t"><h3 id="st-t">자체 점검</h3><p class="small">판정 규칙과 스펙의 테스트 케이스 9개를 이 기기에서 다시 계산해요.</p><button type="button" class="btn secondary" id="selftest">자체 점검 실행</button><div id="st-out" aria-live="polite"></div></section>' +
      '<section class="card" aria-labelledby="del-t"><h3 id="del-t">전체 삭제</h3><p class="small">청구함, 공항 체크리스트, 환율, 이름을 모두 지워요.</p><button type="button" class="btn danger" id="wipe">모든 기록 삭제</button></section>';
    render(html, 'tabs', '정보·출처');
    bindFx(viewInfo);
    $('#selftest').onclick = function () { var r = runSelfTest(); $('#st-out').innerHTML = '<p style="margin-top:10px"><b>' + r.passed + '/' + r.total + ' 통과</b></p><ul class="basis small">' + r.results.filter(function (x) { return x.id !== 'R'; }).map(function (x) { return '<li>' + (x.pass ? '통과' : '실패') + ' · ' + esc(x.id + ' ' + x.name) + (x.pass ? '' : ' — ' + esc(x.fails.join(', '))) + '</li>'; }).join('') + '</ul>'; };
    $('#wipe').onclick = function () { confirmBox('모든 기록을 삭제할까요?', '청구함 ' + state.claims.length + '건과 설정이 모두 지워지고 되돌릴 수 없어요.', '모두 삭제', function () {
      try { localStorage.removeItem(KEY); sessionStorage.removeItem(DKEY); } catch (e) { /* 무시 */ }
      state = R.emptyState(); state.settings.onboarded = true; save(); fxStatus = 'idle'; toast('모두 삭제했어요'); location.hash = '#/'; }); };
    focusMain();
  }

  function runSelfTest() {
    var results = R.selfTest(AIRPORTS), passed = results.filter(function (r) { return r.pass; }).length;
    return { total: results.length, passed: passed, ok: passed === results.length, results: results.map(function (r) { return { id: r.id, name: r.name, pass: r.pass, fails: r.fails }; }) };
  }
  window.runSelfTest = runSelfTest;

  /* ---------- 라우터 ---------- */
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var p = parts[0] || '';
    if (p === 'new') return newDraft(parts[1]);
    if (p === 'q') return viewStep(Number(parts[1]) || 1);
    if (p === 'result') return viewResult(parts[1]);
    if (p === 'letter') return viewLetter(parts[1], parts[2]);
    if (p === 'airport') return viewAirport();
    if (p === 'box') return viewBox();
    if (p === 'ccn') return viewCcn(parts[1]);
    if (p === 'info') return viewInfo();
    return viewHome();
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시 없이도 동작 */ }); });
  }
})();
