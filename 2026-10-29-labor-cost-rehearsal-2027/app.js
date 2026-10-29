/* 2027 인건비 리허설 — app.js (빌드: /workspace/webapps/_build/labor/a1~a6.js 이어붙임) */
(function () {
'use strict';
var R = window.LaborRules;
var APP = '2027 인건비 리허설';
var KEY = 'lh2027:v1';
var RULES = null;
var D = R.DAY;
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
var W = R.fmtWon, H = R.fmtH, M = R.man;
function signed(x, f) { var v = Math.round(x); return (v > 0 ? '+' : v < 0 ? '−' : '') + (f || W)(Math.abs(v)); }

/* ---------- 저장(단일 키 lh2027:v1, 깨지면 복구) ---------- */
var flags = { recovered: false };
var S = null;
function blank() { return { v: 1, app: 'labor-cost-rehearsal-2027', stores: [], activeId: null, prefs: { onboarded: false } }; }
function loadState() {
  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) {}
  if (raw == null) { S = blank(); return; }
  try {
    var j = JSON.parse(raw), cl = j && R.sanitizeImport({ app: 'labor-cost-rehearsal-2027', stores: j.stores, activeId: j.activeId });
    S = blank(); if (cl) { S.stores = cl.stores; S.activeId = cl.activeId; }
    S.prefs = j && j.prefs && typeof j.prefs === 'object' ? { onboarded: !!j.prefs.onboarded } : S.prefs;
    if (!Array.isArray(j.stores)) throw new Error('bad');
  } catch (e) { S = blank(); flags.recovered = true; try { localStorage.removeItem(KEY); } catch (e2) {} }
}
var saveT = null;
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { toast('기기 저장 공간이 부족해요. 설정에서 백업 후 안 쓰는 매장을 지워 주세요.'); return false; }
}
function saveNow(msg) { var st = store(); if (st) st.updatedAt = new Date().toISOString(); var ok = persist(); if (ok && msg) toast(msg); return ok; }
function store() { if (!S.stores.length) return null; var s = S.stores.filter(function (x) { return x.id === S.activeId; })[0]; if (!s) { s = S.stores[0]; S.activeId = s.id; } return s; }
function newStore(name) {
  var s = R.cleanStore({ id: uid('st'), name: name || '우리 매장', fivePlus: 'no', openDays: [0, 1, 2, 3, 4, 5, 6], staff: [] }, 0);
  s.currentWage = null; S.stores.push(s); S.activeId = s.id; persist(); return s;
}
function exampleStore() {
  var s = R.cleanStore({
    id: uid('ex'), name: '예시 카페', example: true, industry: 'cafe', fivePlus: 'no', currentWage: 10500, openDays: [0, 1, 2, 3, 4, 5, 6],
    staff: [
      { id: uid('s'), alias: '평일 오전', wageNow: 10500, shifts: [0, 1, 2, 3, 4].map(function (d) { return { day: d, start: '09:00', end: '14:00', breakMin: 30 }; }) },
      { id: uid('s'), alias: '평일 오후', wageNow: 10500, shifts: [0, 1, 2].map(function (d) { return { day: d, start: '14:00', end: '19:00', breakMin: 30 }; }) },
      { id: uid('s'), alias: '주말 A', wageNow: 10500, shifts: [5].map(function (d) { return { day: d, start: '10:00', end: '20:00', breakMin: 60 }; }) },
      { id: uid('s'), alias: '주말 B', wageNow: 10500, shifts: [6].map(function (d) { return { day: d, start: '11:00', end: '17:00', breakMin: 30 }; }) }
    ],
    pricing: { menu: '아메리카노', avgTicket: 4500, marginRate: 60, dailySales: 120, vat: true }
  }, 0);
  S.stores.push(s); S.activeId = s.id; persist(); return s;
}
function findStaff(scope, id) {
  var st = store(); if (!st) return null;
  var list = scope === 'main' ? st.staff : ((st.scenarios.filter(function (x) { return x.id === scope; })[0] || {}).staff);
  if (!list) return null;
  return { list: list, item: list.filter(function (x) { return x.id === id; })[0] || null };
}
function calcMain() { var st = store(); return st ? R.storeCalc(st, RULES) : null; }
/* ---------- 공통 UI ---------- */
var toastT = null;
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200); }
var lastFocus = null;
function openModal(html, onReady) {
  lastFocus = document.activeElement;
  var root = $('#modal-root');
  root.innerHTML = '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh">' + html + '</div></div>';
  var bg = root.firstChild;
  bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-dismiss]')) closeModal(); });
  bg.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      var f = $$('button,a[href],input,select,textarea', bg).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  var first = $('h2', bg); if (first) { first.setAttribute('tabindex', '-1'); first.focus(); }
  if (onReady) onReady(bg);
}
function closeModal() { $('#modal-root').innerHTML = ''; if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) try { lastFocus.focus(); } catch (e) {} }
function confirmBox(title, body, okLabel, cb, danger) {
  openModal('<h2 id="mh">' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-dismiss="1" type="button">취소</button><button class="btn grow ' + (danger ? 'danger' : 'pri') + '" id="mok" type="button">' + esc(okLabel) + '</button></div>',
    function (bg) { $('#mok', bg).addEventListener('click', function () { closeModal(); cb(); }); });
}
function srcLink(id) {
  var s = RULES.sources.filter(function (x) { return x.id === id; })[0]; if (!s) return '';
  return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '<span class="sr"> (새 창)</span></a>' + (s.verified ? '' : ' <b class="lock">확인 필요</b>');
}
/* "이게 무슨 뜻?" 바텀시트 */
function explain(key) {
  var x = RULES.explain[key]; if (!x) return;
  openModal('<h2 id="mh">' + esc(x.title) + '</h2>' + x.body.map(function (b) { return '<p>' + esc(b) + '</p>'; }).join('') +
    (x.src.length ? '<p class="sheet-src muted">근거: ' + x.src.map(srcLink).join(' · ') + '</p>' : '') +
    '<p class="sheet-src muted">참고용 설명이며 법률·노무 자문이 아니에요. 개별 사안은 고용노동부 ☎ <a href="tel:1350">1350</a>에 확인하세요.</p>' +
    '<button class="btn pri block" type="button" data-dismiss="1">알겠어요</button>');
}
var BADGE = { w15: ['주 15시간 경계', ''], m60: ['월 60시간 경계', ''], five: ['5인 경계', ''], minwage: ['최저임금 미달', 'red'], break: ['휴게 부족', 'red'], night: ['야간·자정 넘김', 'blue'], w52: ['주 52시간 초과', 'red'] };
function badgeBtn(k, extra) { var b = BADGE[k]; return '<button type="button" class="badge ' + b[1] + '" data-explain="' + k + '"><span aria-hidden="true">' + (b[1] === 'red' ? '⚠' : '●') + '</span> ' + esc(b[0]) + (extra ? ' ' + esc(extra) : '') + '<span class="sr"> — 무슨 뜻인지 보기</span> <span aria-hidden="true">ⓘ</span></button>'; }
function copyText(text, what) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    toast(ok ? (what || '내용') + '을 복사했어요. 카톡에 붙여넣기 하세요.' : '복사가 막혀 있어요. 글자를 길게 눌러 직접 복사해 주세요.');
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast((what || '내용') + '을 복사했어요. 카톡에 붙여넣기 하세요.'); }, fallback);
  else fallback();
}
function download(name, blob) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); a.remove();
}
function discHtml() { return '<p class="disc">ⓘ 참고용 계산이며 법률·노무 자문이 아니에요. 최저임금 10,700원은 ' + srcLink('moel-notice') + ' 기준이에요. 개별 사안은 고용노동부 ☎ <a href="tel:1350">1350</a>에 확인하세요.</p>'; }
function exBanner(st) { return st && st.example ? '<p class="card soft small"><span class="ex-tag">예시</span>예시 데이터예요. 숫자는 설명용이며, <a href="#/store">매장 설정</a>에서 우리 가게로 바꾸거나 <a href="#/settings">설정</a>에서 새 매장을 만드세요.</p>' : ''; }
function needStore(view) {
  if (store()) return false;
  view.innerHTML = '<h1>매장이 없어요</h1><div class="card"><p>먼저 매장을 만들면 근무표와 결과를 볼 수 있어요.</p><a class="btn pri block" href="#/start">바로 시작</a><p class="small muted" style="margin-top:10px">둘러보기만 하려면 <a href="#/example">예시 데이터 열기</a></p></div>';
  return true;
}
/* ---------- 라우터 ---------- */
var routes = {};
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render(soft) {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('/').filter(Boolean), name = parts[0] || 'home';
  if (!routes[name]) name = 'home';
  var old = $('#view'), view = old.cloneNode(false); old.parentNode.replaceChild(view, old);
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-explain]'); if (b) explain(b.getAttribute('data-explain')); });
  routes[name](view, parts.slice(1).map(decodeURIComponent));
  var tab = { staff: 'staff', edit: 'staff', store: 'staff', result: 'result', alt: 'alt', price: 'price', notice: 'notice' }[name];
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var hd = $('h1', view);
  if (render.navigated && !soft) { if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  render.navigated = true;
  document.title = R.pageTitle(hd ? hd.textContent : '', APP);
}
render.navigated = false;
window.__pageTitle = function (h) { return R.pageTitle(h, APP); };
/* ---------- 홈 / 온보딩 ---------- */
function mwCard() {
  var mw = RULES.minWage, mm = RULES.minWageMonthly;
  return '<div class="card"><p class="small muted" style="margin:0">2027년 1월 1일부터 최저임금</p><div class="mwc"><b>시급 ' + mw['2027'].toLocaleString('ko-KR') + '원</b><span>월 ' + mm['2027'].toLocaleString('ko-KR') + '원(209시간)</span></div>' +
    '<p class="small" style="margin:4px 0 0">2026년 ' + mw['2026'].toLocaleString('ko-KR') + '원보다 ' + RULES.minWageRaise.won + '원(' + RULES.minWageRaise.pct + '%) 올라요. <span class="muted">출처: ' + srcLink('moel-notice') + ', ' + srcLink('mw-decision') + '</span></p></div>';
}
routes.home = function (view) {
  var has = S.stores.length;
  var h = '<section class="hero"><h1>' + APP + '</h1><p>근무표만 넣으면 2027 인건비가 나와요. 주휴수당까지 계산하고, 올해보다 얼마 더 드는지, 어떤 근무표가 덜 드는지, 가격을 얼마 올려야 메꿔지는지 숫자로 보여 드려요.</p>' +
    '<div class="row"><a class="btn or grow" href="#/start">' + (has ? '새 매장 시작' : '바로 시작') + '</a>' + (has ? '' : '<a class="btn grow" style="background:transparent;color:#fff;border-color:#fff" href="#/example">예시로 둘러보기</a>') + '</div>' +
    '<p class="small" style="margin:10px 0 0">가입 없음 · 무료 · 입력한 내용은 이 기기에만 저장돼요</p></section>';
  if (flags.recovered) h += '<div class="card err" role="alert"><b>저장된 데이터가 손상돼 읽지 못했어요.</b><p class="small" style="margin:4px 0 0">빈 상태로 다시 시작했어요. 백업 파일이 있다면 <a href="#/settings">설정 → 백업 불러오기</a>로 복원하세요.</p></div>';
  h += mwCard();
  if (has) {
    h += '<h2>내 매장</h2>';
    S.stores.forEach(function (s) {
      var c = R.storeCalc(s, RULES), act = s.id === S.activeId;
      h += '<div class="card"><h3>' + (s.example ? '<span class="ex-tag">예시</span>' : '') + esc(s.name) + (act ? ' <span class="badge ok">선택됨</span>' : '') + '</h3>' +
        '<p class="small muted">직원 ' + c.head + '명 · ' + (c.head ? '연 ' + signed(c.t.da, M) : '근무표 입력 전') + '</p>' +
        '<div class="row"><button class="btn sm grow" type="button" data-open="' + esc(s.id) + '">' + (c.head ? '결과 보기' : '근무표 입력') + '</button></div></div>';
    });
  } else {
    h += '<h2>이렇게 써요 (5분)</h2><ol class="steps card"><li><b>매장 기본</b> — 업종, 지금 시급, 상시 5인 이상인지</li><li><b>직원 근무표</b> — 별칭, 요일, 시작·끝 시간, 휴게</li><li><b>결과</b> — 2026 vs 2027 월·연 인건비와 증가액, 경계선 경고</li><li><b>다음 행동</b> — 더 싼 근무표, 가격으로 메꾸기, 직원 안내문</li></ol>';
  }
  h += discHtml();
  view.innerHTML = h;
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (!b) return; S.activeId = b.getAttribute('data-open'); persist(); var c = calcMain(); go(c.head ? '#/result' : '#/staff'); });
};
routes.start = function () { var cur = store(); if (!cur || cur.example || cur.staff.length) newStore(S.stores.length ? '매장 ' + (S.stores.length + 1) : '우리 매장'); S.prefs.onboarded = true; persist(); location.replace('#/store'); };
routes.example = function () { var ex = S.stores.filter(function (s) { return s.example; })[0]; if (ex) S.activeId = ex.id; else exampleStore(); S.prefs.onboarded = true; persist(); location.replace('#/result'); };

/* ---------- 매장 설정 ---------- */
function chipsHtml(name, items, sel, type) {
  return items.map(function (it) {
    var on = type === 'checkbox' ? sel.indexOf(it[0]) >= 0 : sel === it[0];
    return '<label class="chip' + (type === 'checkbox' ? ' day' : '') + '"><input type="' + (type || 'radio') + '" name="' + name + '" value="' + esc(it[0]) + '"' + (on ? ' checked' : '') + '><span>' + esc(it[1]) + '</span></label>';
  }).join('');
}
routes.store = function (view) {
  if (needStore(view)) return;
  var st = store();
  view.innerHTML = '<h1>매장 기본 정보</h1>' + exBanner(st) +
    '<form id="sf" novalidate><div class="field"><label for="sname">매장 이름</label><input id="sname" type="text" maxlength="24" value="' + esc(st.name) + '" autocomplete="off"></div>' +
    '<fieldset><legend>업종</legend><div class="chips">' + chipsHtml('ind', RULES.industries, st.industry) + '</div></fieldset>' +
    '<fieldset><legend>영업 요일 <span class="small muted">(가격 역산의 연 영업일에 써요)</span></legend><div class="chips days">' + chipsHtml('od', D.map(function (d, i) { return [String(i), d]; }), st.openDays.map(String), 'checkbox') + '</div><p class="ferr" id="od-err" hidden>영업 요일을 하루 이상 골라 주세요.</p></fieldset>' +
    '<div class="field"><label for="cw">지금(2026) 기본 시급</label><input id="cw" type="text" inputmode="numeric" placeholder="비우면 ' + RULES.minWage['2026'].toLocaleString('ko-KR') + '원(2026 최저임금)" value="' + (st.currentWage || '') + '" aria-describedby="cw-h cw-e"><p class="hint" id="cw-h">직원별로 다르면 근무표에서 따로 적을 수 있어요.</p><p class="ferr" id="cw-e" hidden></p></div>' +
    '<fieldset><legend>상시 근로자 5인 이상인가요? <button type="button" class="badge blue" data-explain="five">이게 무슨 뜻?<span class="sr"> (상시 5인 기준 설명)</span> <span aria-hidden="true">ⓘ</span></button></legend><div class="chips">' +
    chipsHtml('five', [['no', '5인 미만'], ['yes', '5인 이상'], ['unknown', '모르겠어요']], st.fivePlus) + '</div>' +
    '<p class="small muted" id="five-note" style="margin-top:6px"></p></fieldset></form>' +
    '<div class="cta"><a class="btn pri block" href="#/staff">근무표 입력하기 →</a></div>' + discHtml();
  function note() {
    var c = calcMain(), t = st.fivePlus === 'yes' ? '연장·야간·휴일 근로에 50% 이상 가산수당을 계산해요.' : st.fivePlus === 'unknown' ? '5인 미만 기준으로 계산하고, 5인 이상이면 늘어나는 금액을 따로 보여 드려요.' : '가산수당(연장·야간·휴일 50%)은 계산하지 않아요. 주휴수당은 5인 미만도 적용돼요.';
    if (c.fiveBadge) t += ' 지금 근무표 직원 수가 ' + c.head + '명이라 5인 경계에 가까워요.';
    $('#five-note', view).textContent = t;
  }
  note();
  var f = $('#sf', view);
  f.addEventListener('submit', function (e) { e.preventDefault(); });
  f.addEventListener('input', function (e) {
    if (e.target.id === 'sname') { st.name = e.target.value.slice(0, 24) || '우리 매장'; saveNow(); }
    if (e.target.id === 'cw') {
      var v = e.target.value.trim(), n = R.num(v), er = $('#cw-e', view);
      if (!v) { st.currentWage = null; er.hidden = true; e.target.removeAttribute('aria-invalid'); saveNow(); }
      else if (!(n > 0 && n < 1000000)) { er.textContent = '시급을 숫자로 적어 주세요(예: 10500).'; er.hidden = false; e.target.setAttribute('aria-invalid', 'true'); }
      else { st.currentWage = Math.round(n); er.hidden = true; e.target.removeAttribute('aria-invalid'); saveNow();
        if (n < RULES.minWage['2026']) { er.textContent = '2026 최저임금(' + RULES.minWage['2026'].toLocaleString('ko-KR') + '원)보다 낮아요. 확인해 주세요.'; er.hidden = false; } }
    }
  });
  f.addEventListener('change', function (e) {
    var n = e.target.name;
    if (n === 'ind') st.industry = e.target.value;
    if (n === 'five') { st.fivePlus = e.target.value; note(); }
    if (n === 'od') {
      var days = $$('input[name=od]:checked', view).map(function (x) { return +x.value; });
      $('#od-err', view).hidden = days.length > 0; if (!days.length) return;
      st.openDays = days;
    }
    saveNow('저장했어요.');
  });
};
/* ---------- 근무표 ---------- */
var TIMES = (function () { var a = []; for (var m = 0; m < 1440; m += 15) a.push(R.fmtMin(m)); return a; })();
function timeOpts(sel, endFor) {
  var s = endFor != null ? R.toMin(endFor) : null;
  return TIMES.map(function (t) { var lab = t; if (s != null && R.toMin(t) <= s) lab = '다음날 ' + t; return '<option value="' + t + '"' + (t === sel ? ' selected' : '') + '>' + lab + '</option>'; }).join('');
}
function miniGrid(c) {
  return '<div class="mini" aria-hidden="true">' + D.map(function (d, i) { var h = c.perDay[i]; return '<div class="' + (h > 0 ? 'on' : '') + '"><b>' + d + '</b>' + (h > 0 ? (Math.round(h * 100) / 100) + 'h' : '–') + '</div>'; }).join('') + '</div>' +
    '<p class="sr">요일별 근로시간: ' + D.map(function (d, i) { return d + ' ' + (Math.round(c.perDay[i] * 100) / 100) + '시간'; }).join(', ') + '</p>';
}
function staffBadges(row, five) {
  var h = '';
  row.badges.forEach(function (b) { h += badgeBtn(b, b === 'w15' ? '(주 ' + H(row.c27.hours) + ')' : b === 'm60' ? '(월 ' + Math.round(row.c27.monthHours * 10) / 10 + '시간)' : ''); });
  row.warn.forEach(function (w) { h += badgeBtn(w, w === 'minwage' ? '(' + W(row.mw27.short) + ' 부족)' : ''); });
  return h ? '<div class="badges">' + h + '</div>' : '';
}
routes.staff = function (view) {
  if (needStore(view)) return;
  var st = store(), c = R.storeCalc(st, RULES);
  var h = '<h1>근무표</h1>' + exBanner(st) + '<p class="small muted">' + esc(st.name) + ' · ' + (st.fivePlus === 'yes' ? '5인 이상' : st.fivePlus === 'unknown' ? '5인 여부 모름' : '5인 미만') + ' · <a href="#/store">매장 설정</a></p>';
  if (c.fiveBadge) h += '<div class="badges">' + badgeBtn('five', '(직원 ' + c.head + '명)') + '</div>';
  if (!st.staff.length) {
    h += '<div class="card soft"><h2 style="margin-top:0">아직 직원이 없어요</h2><p>직원을 한 명씩 추가해 주세요. 실명 대신 "평일 오전", "주말 A" 같은 별칭을 권해요.</p></div>';
  }
  st.staff.forEach(function (s) {
    var row = c.rows.filter(function (r) { return r.id === s.id; })[0], bad = R.invalidCount(s);
    h += '<div class="card staffc"><h3><span>' + esc(s.alias) + '</span><span class="small muted">' + W(row.w27) + '/시간</span></h3>' + miniGrid(row.c27) +
      '<p class="small" style="margin:0">주 ' + H(row.c27.hours) + ' · 주휴 ' + H(row.c27.juhuH) + ' · 2027 월 ' + W(row.m27) + '</p>' + staffBadges(row) +
      (bad ? '<p class="ferr">입력 오류가 있는 근무 ' + bad + '개는 계산에서 빠졌어요.</p>' : '') + (!s.shifts.length ? '<p class="small muted">근무가 아직 없어요.</p>' : '') +
      '<div class="row" style="margin-top:8px"><a class="btn sm grow" href="#/edit/main/' + encodeURIComponent(s.id) + '">편집<span class="sr"> ' + esc(s.alias) + '</span></a><button class="btn sm ghost" type="button" data-dup="' + esc(s.id) + '">복제<span class="sr"> ' + esc(s.alias) + '</span></button><button class="btn sm danger" type="button" data-del="' + esc(s.id) + '">삭제<span class="sr"> ' + esc(s.alias) + '</span></button></div></div>';
  });
  h += '<button class="btn block" type="button" id="add">＋ 직원 추가</button>';
  h += '<div class="cta"><a class="btn pri block' + (c.head ? '' : '" aria-disabled="true') + '" href="#/result">결과 보기 →</a></div>' + discHtml();
  view.innerHTML = h;
  view.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.id === 'add') { var n = { id: uid('s'), alias: '직원 ' + (st.staff.length + 1), wageNow: null, wage2027: null, probation: null, holiday: -1, shifts: [] }; st.staff.push(n); saveNow(); go('#/edit/main/' + n.id); }
    if (t.dataset.dup) { var o = st.staff.filter(function (x) { return x.id === t.dataset.dup; })[0], cp = clone(o); cp.id = uid('s'); cp.alias = (o.alias + ' 복사').slice(0, 20); st.staff.splice(st.staff.indexOf(o) + 1, 0, cp); saveNow('복제했어요.'); render(true); }
    if (t.dataset.del) { var d = st.staff.filter(function (x) { return x.id === t.dataset.del; })[0]; confirmBox('직원 삭제', '"' + d.alias + '" 근무표를 지울까요? 되돌릴 수 없어요.', '삭제', function () { st.staff.splice(st.staff.indexOf(d), 1); saveNow('삭제했어요.'); render(true); }, true); }
  });
};
/* ---------- 직원 편집 (원안 main 또는 대안 scenario 공용) ---------- */
routes.edit = function (view, args) {
  if (needStore(view)) return;
  var scope = args[0] || 'main', f = findStaff(scope, args[1]), st = store();
  if (!f || !f.item) { view.innerHTML = '<h1>직원을 찾을 수 없어요</h1><div class="card"><p>지워졌거나 다른 매장의 직원이에요.</p><a class="btn pri block" href="#/staff">근무표로</a></div>'; return; }
  var s = f.item, back = scope === 'main' ? '#/staff' : '#/alt/' + encodeURIComponent(scope);
  var scName = scope === 'main' ? '' : (st.scenarios.filter(function (x) { return x.id === scope; })[0] || {}).name;
  s.probation = s.probation || { on: false, year1: false, notSimple: false };
  var qa = { days: [], start: '09:00', end: '14:00', breakMin: 30 };
  view.innerHTML = '<h1>' + esc(s.alias) + ' 근무</h1>' + (scName ? '<p class="card soft small">대안 "' + esc(scName) + '"의 근무예요. 원안은 바뀌지 않아요.</p>' : '') +
    '<form id="ef" novalidate><div id="esum" role="alert" class="card err" hidden></div>' +
    '<div class="field"><label for="alias">별칭</label><input id="alias" type="text" maxlength="20" value="' + esc(s.alias) + '" aria-describedby="alias-h"><p class="hint" id="alias-h">개인정보 보호를 위해 실명 대신 "평일 오전" 같은 별칭을 권해요.</p></div>' +
    '<div class="row" style="align-items:flex-start"><div class="field grow"><label for="w26">지금 시급(2026)</label><input id="w26" type="text" inputmode="numeric" value="' + (s.wageNow || '') + '" placeholder="' + R.wagesOf({}, st, RULES).now.toLocaleString('ko-KR') + '원(매장 기본)"></div>' +
    '<div class="field grow"><label for="w27">2027 시급</label><input id="w27" type="text" inputmode="numeric" value="' + (s.wage2027 || '') + '" placeholder="자동: 최저임금 이상" aria-describedby="w27-m"></div></div>' +
    '<div id="w27-m" aria-live="polite"></div>' +
    '<label class="cbx"><input type="checkbox" id="prob"' + (s.probation.on ? ' checked' : '') + '><span>수습 중이에요(수습 시작 3개월 이내)</span></label>' +
    '<div id="probx" class="card soft small"' + (s.probation.on ? '' : ' hidden') + '><p>수습 감액(최저임금의 90%)은 아래 두 조건을 <b>모두</b> 만족할 때만 가능해요. ' + srcLink('moel-probation') + '</p>' +
    '<label class="cbx"><input type="checkbox" id="py1"' + (s.probation.year1 ? ' checked' : '') + '><span>근로계약 기간이 1년 이상이에요</span></label>' +
    '<label class="cbx"><input type="checkbox" id="pns"' + (s.probation.notSimple ? ' checked' : '') + '><span>단순노무 직종이 아니에요(서빙·주방보조·판매 등 단순노무는 감액 불가일 수 있어요)</span></label></div>' +
    '<div class="field"><label for="hol">주휴일</label><select id="hol"><option value="-1">자동(근무 없는 날, 일요일 우선)</option>' + D.map(function (d, i) { return '<option value="' + i + '"' + (s.holiday === i ? ' selected' : '') + '>' + d + '요일</option>'; }).join('') + '</select><p class="hint">주휴일에 일하면 5인 이상 사업장은 휴일 가산(8시간까지 50%, 넘으면 100%)을 계산해요.</p></div>' +
    '<h2>빠르게 추가</h2><div class="card"><p class="small muted" style="margin-top:0">자주 쓰는 근무 <span class="small">(누르면 아래 칸이 채워져요)</span></p><div class="chips" id="presets">' + RULES.presets.map(function (p) { return '<button type="button" class="chip-btn" data-preset="' + p.id + '">' + esc(p.label) + '</button>'; }).join('') + '</div>' +
    '<fieldset style="margin-top:12px"><legend>요일</legend><div class="chips days" id="qdays">' + D.map(function (d, i) { return '<label class="chip day"><input type="checkbox" name="qd" value="' + i + '"><span>' + d + '</span></label>'; }).join('') + '</div></fieldset>' +
    '<div class="row"><div class="field grow"><label for="qs">시작</label><select id="qs">' + timeOpts(qa.start) + '</select></div><div class="field grow"><label for="qe">끝</label><select id="qe">' + timeOpts(qa.end, qa.start) + '</select></div></div>' +
    '<div class="field"><label for="qb">휴게</label><select id="qb">' + [0, 15, 30, 45, 60, 90, 120].map(function (m) { return '<option value="' + m + '"' + (m === 30 ? ' selected' : '') + '>' + (m ? m + '분' : '없음') + '</option>'; }).join('') + '</select><p class="hint" id="qb-h"></p></div>' +
    '<button class="btn block" type="button" id="qadd">선택한 요일에 근무 추가</button><p class="ferr" id="qerr" hidden></p></div>' +
    '<h2>근무 목록</h2><div id="shifts"></div></form>' +
    '<div class="card soft" id="live" aria-live="polite"></div>' +
    '<div class="cta"><button class="btn pri block" type="button" id="done">완료</button></div>' + discHtml();
  var form = $('#ef', view);
  function wmsg() {
    var wg = R.wagesOf(s, st, RULES), mc = R.minWageCheck(wg.y27, 2027, s, RULES), el = $('#w27-m', view), inp = $('#w27', view);
    if (!mc.ok) { el.innerHTML = '<div class="card err small" role="alert"><b>⚠ 2027 최저임금 미달</b> — 2027 시급 ' + W(wg.y27) + '은 ' + (mc.probation ? '수습 감액 하한 ' : '최저임금 ') + W(mc.floor) + '보다 ' + W(mc.short) + ' 적어요. ' + badgeBtn('minwage') + '</div>'; inp.setAttribute('aria-invalid', 'true'); }
    else { el.innerHTML = '<p class="small muted">2027 적용 시급 ' + W(wg.y27) + (wg.auto27 ? ' (자동: 지금 시급과 최저임금 중 큰 값)' : '') + (mc.probation ? ' · 수습 감액 하한 ' + W(mc.floor) : '') + '</p>'; inp.removeAttribute('aria-invalid'); }
  }
  function shiftRow(sh, i) {
    var w = R.shiftWork(sh), errs = R.validateShift(sh, RULES), meta = '';
    if (w && !errs.length) {
      var dd = R.splitByDay(w.ints).map(function (m, k) { return m ? D[k] + ' ' + H(m / 60) : ''; }).filter(Boolean);
      meta = '근무 ' + H(w.work / 60) + (w.overnight ? ' · 자정 분리: ' + dd.join(' + ') : '');
      var need = R.breakRequired(w.work, RULES); if (w.brk < need) meta += '</p><p class="ferr">휴게 부족: 근로 ' + (need === 60 ? '8' : '4') + '시간이면 ' + need + '분 이상 필요해요. <button type="button" class="btn sm ghost" data-fixbrk="' + i + '" data-need="' + need + '">휴게 ' + need + '분으로</button>';
    }
    return '<div class="shift" data-i="' + i + '"><div class="g"><div><label for="sd' + i + '">요일</label><select id="sd' + i + '" data-k="day">' + D.map(function (d, k) { return '<option value="' + k + '"' + (sh.day === k ? ' selected' : '') + '>' + d + '요일</option>'; }).join('') + '</select></div>' +
      '<div><label for="sb' + i + '">휴게</label><select id="sb' + i + '" data-k="breakMin">' + [0, 15, 30, 45, 60, 90, 120].map(function (m) { return '<option value="' + m + '"' + (sh.breakMin === m ? ' selected' : '') + '>' + (m ? m + '분' : '없음') + '</option>'; }).join('') + '</select></div>' +
      '<div><label for="ss' + i + '">시작</label><select id="ss' + i + '" data-k="start"' + (errs.length ? ' aria-invalid="true"' : '') + '>' + timeOpts(sh.start) + '</select></div>' +
      '<div><label for="se' + i + '">끝</label><select id="se' + i + '" data-k="end"' + (errs.length ? ' aria-invalid="true"' : '') + ' aria-describedby="sm' + i + '">' + timeOpts(sh.end, sh.start) + '</select></div></div>' +
      '<p class="meta" id="sm' + i + '">' + (errs.length ? '<span class="ferr">' + esc(errs.join(' ')) + '</span>' : meta) + '</p>' +
      '<button class="btn sm danger" type="button" data-rm="' + i + '">이 근무 삭제<span class="sr"> (' + D[sh.day] + ' ' + sh.start + ')</span></button></div>';
  }
  function drawShifts() {
    var sorted = s.shifts.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return a.x.day - b.x.day || R.toMin(a.x.start) - R.toMin(b.x.start); });
    $('#shifts', view).innerHTML = s.shifts.length ? sorted.map(function (o) { return shiftRow(o.x, o.i); }).join('') : '<p class="card soft small">근무가 없어요. 위에서 요일과 시간을 골라 추가해 주세요.</p>';
  }
  function live() {
    var c = R.storeCalc(st, RULES, { staff: [s] }), row = c.rows[0], ov = R.validateStaff(s, RULES).filter(function (e) { return /겹쳐요/.test(e.m); });
    $('#live', view).innerHTML = '<h3>이 직원 요약</h3>' + miniGrid(row.c27) + '<p class="small" style="margin:0">주 ' + H(row.c27.hours) + ' · 주휴 ' + H(row.c27.juhuH) + ' · 2027 월 ' + W(row.m27) + ' (2026 ' + W(row.m26) + ')</p>' + staffBadges(row) +
      (ov.length ? '<p class="ferr">' + esc(ov.map(function (e) { return e.m; }).join(' ')) + '</p>' : '');
  }
  function upd() { saveNow(); wmsg(); live(); }
  function qbHint() { var sp = R.span({ start: $('#qs', view).value, end: $('#qe', view).value }), sug = sp ? R.suggestBreak(sp.len, RULES) : 0; $('#qb-h', view).textContent = sp ? '근무 ' + H(sp.len / 60) + (sp.overnight ? '(자정 넘김)' : '') + ' → 법정 최소 휴게 ' + (sug ? sug + '분' : '없음') + ' 권장' : ''; }
  drawShifts(); wmsg(); live(); qbHint();
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.addEventListener('input', function (e) {
    var id = e.target.id;
    if (id === 'alias') { s.alias = e.target.value.slice(0, 20); upd(); }
    if (id === 'w26' || id === 'w27') { var v = e.target.value.trim(), n = R.num(v); s[id === 'w26' ? 'wageNow' : 'wage2027'] = v && n > 0 && n < 1000000 ? Math.round(n) : null; if (v && !(n > 0)) e.target.setAttribute('aria-invalid', 'true'); else if (id === 'w26') e.target.removeAttribute('aria-invalid'); upd(); }
  });
  form.addEventListener('change', function (e) {
    var t = e.target, row = t.closest('.shift');
    if (t.id === 'prob' || t.id === 'py1' || t.id === 'pns') { s.probation = { on: $('#prob', view).checked, year1: $('#py1', view).checked, notSimple: $('#pns', view).checked }; $('#probx', view).hidden = !s.probation.on; upd(); return; }
    if (t.id === 'hol') { s.holiday = +t.value; upd(); return; }
    if (t.id === 'qs') { var e2 = $('#qe', view), keep = e2.value; e2.innerHTML = timeOpts(keep, t.value); qbHint(); return; }
    if (t.id === 'qe') { qbHint(); return; }
    if (row && t.dataset.k) {
      var i = +row.dataset.i, k = t.dataset.k; s.shifts[i][k] = (k === 'day' || k === 'breakMin') ? +t.value : t.value;
      var fid = t.id; drawShifts(); upd(); var el = $('#' + fid, view); if (el) el.focus();
    }
  });
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.preset) {
      var p = RULES.presets.filter(function (x) { return x.id === b.dataset.preset; })[0];
      $$('input[name=qd]', view).forEach(function (x) { x.checked = p.days.indexOf(+x.value) >= 0; });
      $('#qs', view).value = p.start; $('#qe', view).innerHTML = timeOpts(p.end, p.start); $('#qb', view).value = String(p.breakMin); qbHint();
      toast('"' + p.label + '" 시간을 채웠어요. [선택한 요일에 근무 추가]를 누르세요.');
    }
    if (b.id === 'qadd') {
      var days = $$('input[name=qd]:checked', view).map(function (x) { return +x.value; }), er = $('#qerr', view);
      var sh0 = { start: $('#qs', view).value, end: $('#qe', view).value, breakMin: +$('#qb', view).value };
      var ve = R.validateShift({ day: 0, start: sh0.start, end: sh0.end, breakMin: sh0.breakMin }, RULES);
      if (!days.length) ve.unshift('요일을 하나 이상 골라 주세요.');
      if (ve.length) { er.textContent = ve.join(' '); er.hidden = false; return; }
      er.hidden = true;
      days.forEach(function (d) { s.shifts.push({ day: d, start: sh0.start, end: sh0.end, breakMin: sh0.breakMin }); });
      $$('input[name=qd]', view).forEach(function (x) { x.checked = false; });
      drawShifts(); upd(); toast(days.length + '일 근무를 추가했어요.');
    }
    if (b.dataset.rm != null) { s.shifts.splice(+b.dataset.rm, 1); drawShifts(); upd(); toast('근무를 삭제했어요.'); $('#qadd', view).focus(); }
    if (b.dataset.fixbrk != null) { s.shifts[+b.dataset.fixbrk].breakMin = +b.dataset.need; drawShifts(); upd(); }
    if (b.id === 'done') {
      var errs = R.validateStaff(s, RULES), sum = $('#esum', view);
      if (!String(s.alias || '').trim()) { s.alias = '직원'; }
      errs = errs.filter(function (x) { return x.f !== 'alias'; });
      if (errs.length) { sum.innerHTML = '<b>고칠 곳이 ' + errs.length + '개 있어요</b><ul class="small">' + errs.map(function (x) { return '<li>' + esc(x.m) + '</li>'; }).join('') + '</ul>'; sum.hidden = false; sum.setAttribute('tabindex', '-1'); sum.focus(); return; }
      saveNow('저장했어요.'); go(back);
    }
  });
};
/* ---------- 결과 대시보드 ---------- */
function insLine(c, st) {
  if (!c.insOn) return '<p class="small"><b>사업주 4대보험 부담분: 요율 확인 필요</b> — 지어낸 요율은 쓰지 않아요. <a href="#/settings">설정</a>에서 공식 확인된 요율을 넣거나 직접 입력하면 월 60시간 이상 직원에게 더해 계산해요.</p>';
  return '<p class="small">사업주 4대보험(입력한 요율, 월 60시간 이상 직원만): 2026 월 ' + W(c.t.ins26) + ' → 2027 월 ' + W(c.t.ins27) + ' <span class="muted">— 비어 있는 항목(요율 확인 필요)은 빠져 있어요.</span></p>';
}
routes.result = function (view) {
  if (needStore(view)) return;
  var st = store(), c = R.storeCalc(st, RULES);
  if (!c.head) {
    view.innerHTML = '<h1>2027 인건비 결과</h1>' + exBanner(st) + '<div class="card soft"><h2 style="margin-top:0">아직 계산할 근무가 없어요</h2><p>직원과 근무 시간을 넣으면 2026·2027 월·연 인건비와 증가액이 바로 나와요.</p><a class="btn pri block" href="#/staff">근무표 입력하기</a></div>' + mwCard() + discHtml();
    return;
  }
  var t = c.t, mx = Math.max(t.m26, t.m27, 1), up = t.da >= 0;
  var h = '<h1>2027 인건비 결과</h1>' + exBanner(st) +
    '<section class="card" aria-labelledby="sum-h"><h2 id="sum-h" class="small muted" style="margin:0 0 4px;font-size:15px">' + esc(st.name) + ' · 같은 근무표로 2027년이 되면</h2>' +
    '<p style="margin:0;font-weight:700">1년에</p><p class="big' + (up ? '' : ' down') + '">' + signed(t.da) + '</p>' +
    '<p style="margin:0">한 달에 <b>' + signed(t.dm) + '</b> (' + (t.pct >= 0 ? '+' : '') + t.pct.toFixed(1) + '%)</p>' +
    '<div class="bars" role="img" aria-label="월 인건비 2026년 ' + W(t.m26) + ', 2027년 ' + W(t.m27) + '">' +
    '<div class="bar"><span>2026</span><div><i style="width:' + (t.m26 / mx * 100).toFixed(1) + '%"></i><em>월 ' + W(t.m26) + '</em></div></div>' +
    '<div class="bar y27"><span>2027</span><div><i style="width:' + (t.m27 / mx * 100).toFixed(1) + '%"></i><em>월 ' + W(t.m27) + '</em></div></div></div>' +
    '<div class="kpis"><div class="kpi"><span>2026 연</span><b>' + M(t.a26) + '</b></div><div class="kpi"><span>2027 연</span><b>' + M(t.a27) + '</b></div><div class="kpi"><span>직원</span><b>' + c.head + '명</b></div><div class="kpi"><span>주 근로 합계</span><b>' + H(t.hours) + '</b></div></div></section>';
  var alerts = '';
  if (c.fiveBadge) alerts += badgeBtn('five', '(직원 ' + c.head + '명)');
  c.rows.forEach(function (r) { if (r.warn.indexOf('minwage') >= 0) alerts += badgeBtn('minwage', '— ' + r.alias); });
  if (alerts) h += '<div class="card warn"><h2 style="margin:0 0 6px;font-size:17px">확인할 점</h2><div class="badges">' + alerts + '</div></div>';
  h += '<div class="card small">' + (c.five ? '<p><b>상시 5인 이상</b>으로 연장·야간·휴일 가산수당(50%, 휴일 8시간 초과 100%)을 포함했어요.</p>' :
    '<p><b>' + (c.fiveUnknown ? '5인 여부를 몰라 5인 미만' : '5인 미만') + '</b>으로 계산해 가산수당은 빠져 있어요. 주휴수당은 포함했어요.' + (t.ifFiveMonthly > 0 ? ' <b>5인 이상이라면</b> 가산수당이 월 ' + W(t.ifFiveMonthly) + ' 더 생겨요.' : '') + ' ' + badgeBtn('five') + '</p>') +
    insLine(c, st) + '<p class="muted" style="margin:0">월 = 주 금액 × 4.345주(365÷7÷12), 연 = 월 × 12. 공휴일 유급휴일·연차·퇴직금(5인 이상·1년 이상 등)은 포함하지 않았어요.</p></div>';
  h += '<h2>직원별</h2><table class="tbl"><caption class="sr">직원별 주 근로시간과 2026·2027 월 인건비</caption><thead><tr><th scope="col">직원</th><th scope="col">주 시간</th><th scope="col">2026 월</th><th scope="col">2027 월</th></tr></thead><tbody>';
  c.rows.forEach(function (r) { h += '<tr><th scope="row" style="text-align:left;font-weight:600">' + esc(r.alias) + '</th><td>' + H(r.c27.hours) + (r.c27.juhuH ? '<br><span class="muted small">주휴 ' + H(r.c27.juhuH) + '</span>' : '') + '</td><td>' + W(r.m26) + '</td><td>' + W(r.m27) + '<br><span class="pos small">' + signed(r.m27 - r.m26) + '</span></td></tr>'; });
  h += '</tbody><tfoot><tr><th scope="row" style="text-align:left">합계(월)</th><td>' + H(t.hours) + '</td><td><b>' + W(t.m26) + '</b></td><td><b>' + W(t.m27) + '</b></td></tr><tr><th scope="row" style="text-align:left">합계(연)</th><td></td><td>' + W(t.a26) + '</td><td>' + W(t.a27) + '</td></tr></tfoot></table>';
  var bdg = ''; c.rows.forEach(function (r) { var b = staffBadges(r); if (b) bdg += '<div class="card"><h3>' + esc(r.alias) + '</h3>' + b + '</div>'; });
  if (bdg) h += '<h2>경계선·주의 표시</h2><p class="small muted">배지를 누르면 무슨 뜻인지 설명이 나와요.</p>' + bdg;
  h += '<h2>다음 행동</h2><div class="next">' +
    '<a href="#/alt"><div class="card"><h3>더 싼 근무표 찾기 →</h3><p class="small muted" style="margin:0">원안과 대안 근무표의 연 비용·사장님 추가 근무·영업 공백 비교</p></div></a>' +
    '<a href="#/price"><div class="card"><h3>가격으로 메꾸기 →</h3><p class="small muted" style="margin:0">' + (up ? '연 ' + M(t.da) + '를 메꾸는 가격 인상폭·하루 추가 판매량' : '증가액이 없어요') + '</p></div></a>' +
    '<a href="#/notice"><div class="card"><h3>직원 안내문 만들기 →</h3><p class="small muted" style="margin:0">2027 시급 안내 카톡 문구 + 근로계약 변경 체크리스트</p></div></a>' +
    '<a href="#/report"><div class="card"><h3>리포트·공유 →</h3><p class="small muted" style="margin:0">A4 1장 인쇄 · 12개월 예산 CSV · 공유 카드(이름 없이)</p></div></a></div>' + discHtml();
  view.innerHTML = h;
};
/* ---------- 대안 비교 ---------- */
function M0(x) { return Math.round(x / 10000).toLocaleString('ko-KR') + '만'; }
var KIND = {
  owner: '근무시간이 가장 짧은 자리를 사장님이 직접 맡는 안이에요. 인건비는 줄지만 사장님 시간이 늘어요.',
  merge: '짧은 근무 두 자리를 한 사람이 맡는 안이에요. 주휴수당이 생길 수 있지만 단시간 구인 부담이 줄어요.',
  trim: '5시간 이상 근무의 마지막 1시간을 줄이는 안이에요. 그 시간만큼 영업 공백(또는 사장님 근무)이 생겨요.',
  custom: '직접 고친 안이에요. 직원·시간을 자유롭게 바꿔 비교해 보세요.'
};
function allScens(st) { return R.genScenarios(st, RULES).concat(st.scenarios.map(function (x) { return { id: x.id, kind: 'custom', name: x.name, staff: x.staff, ownerShifts: x.ownerShifts }; })); }
routes.alt = function (view, args) {
  if (needStore(view)) return;
  if (args && args[0]) return routes.alt2(view, args);
  var st = store(), base = R.storeCalc(st, RULES);
  if (!base.head) { view.innerHTML = '<h1>대안 근무표 비교</h1><div class="card soft"><p>근무표를 먼저 넣으면 대안을 자동으로 만들어 비교해 드려요.</p><a class="btn pri block" href="#/staff">근무표 입력하기</a></div>' + discHtml(); return; }
  var sp = RULES.shortPremium;
  view.innerHTML = '<h1>대안 근무표 비교</h1>' + exBanner(st) +
    '<div class="card soft small"><p style="margin:0"><b>중립 비교예요.</b> 같은 일을 여러 명으로 쪼개 주휴·4대보험 기준을 피하는 안은 만들지 않고 권하지도 않아요. 단시간 구인은 어렵고 시급을 더 줘야 하는 경우가 많아 오히려 비쌀 수 있어요. 아래 슬라이더로 그 부담을 넣어 보세요.</p></div>' +
    '<div class="field card"><label for="prem">주 15시간 미만 자리의 단시간 구인 시급 프리미엄(가정): <output id="premo">' + W(st.shortPremium) + '</output></label>' +
    '<input id="prem" type="range" min="' + sp.min + '" max="' + sp.max + '" step="' + sp.step + '" value="' + st.shortPremium + '" aria-valuetext="' + W(st.shortPremium) + '"><p class="hint">모든 안에서 주 15시간 미만 직원의 2027 시급에 더해 계산해요.</p></div>' +
    '<div id="cmp"></div>' +
    '<h2>내 수정안</h2><p class="small muted">원안이나 자동 안을 복사해 직접 고쳐 보세요(최대 3개).</p><div id="mine"></div>' +
    '<button class="btn block" type="button" id="newc">＋ 원안 복사해서 내 수정안 만들기</button>' + discHtml();
  function draw() {
    var sc = allScens(st), list = R.compare(st, RULES, sc), ok = list.filter(function (x) { return !x.na; });
    var best = ok.slice(1).reduce(function (b, x) { return !b || x.calc.t.a27 < b.calc.t.a27 ? x : b; }, null);
    var tb = '<h2>비교표 (2027 기준)</h2><table class="tbl" id="cmpt"><caption class="sr">안별 2027 연 인건비, 원안 대비 차이, 사장님 추가 근무, 영업 공백</caption><thead><tr><th scope="col">안</th><th scope="col">연 비용(원)</th><th scope="col">원안 대비</th><th scope="col">사장님 +주</th><th scope="col">공백/주</th></tr></thead><tbody>';
    list.forEach(function (x) {
      if (x.na) { tb += '<tr><th scope="row" style="text-align:left;font-weight:600">' + esc(x.name) + '</th><td colspan="4" class="muted small" style="text-align:left">해당 없음: ' + esc(x.na) + '</td></tr>'; return; }
      var d = x.kind === 'base' ? 0 : x.diffA;
      tb += '<tr' + (best && x === best && d < 0 ? ' class="best"' : '') + '><th scope="row" style="text-align:left;font-weight:600">' + esc(x.name) + '</th><td>' + M0(x.calc.t.a27) + '</td><td class="' + (d > 0 ? 'pos' : d < 0 ? 'neg' : '') + '">' + (x.kind === 'base' ? '—' : signed(d, M0)) + '</td><td>' + (x.ownerH ? H(x.ownerH) : '0') + '</td><td>' + (x.gap ? H(x.gap) : '0') + '</td></tr>';
    });
    tb += '</tbody></table><p class="small muted">초록 줄은 연 비용이 가장 적은 안이에요. 비용만 보지 말고 사장님 시간·영업 공백·직원 사정을 함께 보세요. 실제 근무 변경은 직원과 합의하고 계약서에 적어야 해요.</p>';
    tb += '<h2>안별 설명</h2>';
    list.forEach(function (x) {
      if (x.kind === 'base') return;
      tb += '<div class="card"><h3>' + esc(x.name) + '</h3><p class="small">' + esc(KIND[x.kind]) + '</p>' + (x.na ? '<p class="small muted">해당 없음: ' + esc(x.na) + '</p>' :
        '<p class="small" style="margin:0">연 ' + M(x.calc.t.a27) + ' · 원안 대비 <span class="' + (x.diffA > 0 ? 'pos' : 'neg') + '">' + signed(x.diffA, M) + '</span> · 직원 ' + x.calc.head + '명</p>' +
        '<div class="row" style="margin-top:8px">' + (x.kind === 'custom' ? '<a class="btn sm grow" href="#/alt/' + encodeURIComponent(x.id) + '">편집<span class="sr"> ' + esc(x.name) + '</span></a>' : '<button class="btn sm grow" type="button" data-copy="' + esc(x.id) + '">고쳐 보기(복사)<span class="sr"> ' + esc(x.name) + '</span></button>') +
        '<button class="btn sm pri grow" type="button" data-adopt="' + esc(x.id) + '">이 안 채택<span class="sr"> ' + esc(x.name) + '</span></button></div>') + '</div>';
    });
    $('#cmp', view).innerHTML = tb;
    $('#mine', view).innerHTML = st.scenarios.length ? '' : '<p class="card soft small">아직 내 수정안이 없어요.</p>';
  }
  draw();
  var pr = $('#prem', view), tmr = null;
  pr.addEventListener('input', function () { st.shortPremium = +pr.value; $('#premo', view).textContent = W(st.shortPremium); pr.setAttribute('aria-valuetext', W(st.shortPremium)); clearTimeout(tmr); tmr = setTimeout(function () { saveNow(); draw(); }, 120); });
  function addCustom(src, name) {
    if (st.scenarios.length >= 3) { toast('내 수정안은 3개까지예요. 안 쓰는 안을 지워 주세요.'); return null; }
    var n = { id: uid('sc'), kind: 'custom', name: name.slice(0, 24), staff: clone(src.staff).map(function (s) { s.id = s.id || uid('s'); return s; }), ownerShifts: clone(src.ownerShifts || []) };
    st.scenarios.push(n); saveNow('내 수정안을 만들었어요.'); return n;
  }
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'newc') { var n = addCustom({ staff: st.staff }, '내 수정안 ' + (st.scenarios.length + 1)); if (n) go('#/alt/' + n.id); }
    if (b.dataset.copy) { var src = allScens(st).filter(function (x) { return x.id === b.dataset.copy; })[0]; var n2 = addCustom(src, src.name + ' (수정)'); if (n2) go('#/alt/' + n2.id); }
    if (b.dataset.adopt) {
      var sc = allScens(st).filter(function (x) { return x.id === b.dataset.adopt; })[0];
      confirmBox('이 안을 근무표로 채택할까요?', '"' + sc.name + '"의 직원 근무가 지금 근무표를 대신해요. ' + (sc.ownerShifts && sc.ownerShifts.length ? '사장님 근무(' + H(R.shiftsHours(sc.ownerShifts)) + '/주)는 직원 근무표에 넣지 않아요. ' : '') + '채택 전 근무표는 "채택 전 원안"으로 내 수정안에 남겨 둘게요.', '채택', function () {
        if (st.scenarios.length < 3) st.scenarios.push({ id: uid('sc'), kind: 'custom', name: '채택 전 원안', staff: clone(st.staff), ownerShifts: [] });
        st.staff = clone(sc.staff).map(function (s) { if (/^merged-/.test(s.id)) s.id = uid('s'); return s; });
        if (sc.kind === 'custom') st.scenarios = st.scenarios.filter(function (x) { return x.id !== sc.id; });
        saveNow('근무표에 반영했어요.'); go('#/result');
      });
    }
  });
};
/* 내 수정안 편집 화면 */
routes.alt2 = function (view, args) {
  var st = store(), sc = st && st.scenarios.filter(function (x) { return x.id === args[0]; })[0];
  if (!sc) { view.innerHTML = '<h1>수정안을 찾을 수 없어요</h1><div class="card"><a class="btn pri block" href="#/alt">대안 비교로</a></div>'; return; }
  var c = R.storeCalc(st, RULES, { staff: sc.staff }), base = R.storeCalc(st, RULES);
  var h = '<h1>' + esc(sc.name) + ' 편집</h1><div class="field"><label for="scn">안 이름</label><input id="scn" type="text" maxlength="24" value="' + esc(sc.name) + '"></div>' +
    '<div class="card"><p style="margin:0">이 안 2027 연 <b>' + M(c.t.a27) + '</b> · 원안 대비 <b class="' + (c.t.a27 - base.t.a27 > 0 ? 'pos' : 'neg') + '">' + signed(c.t.a27 - base.t.a27, M) + '</b></p>' + (sc.ownerShifts.length ? '<p class="small muted" style="margin:4px 0 0">사장님 근무 ' + H(R.shiftsHours(sc.ownerShifts)) + '/주 포함</p>' : '') + '</div>';
  sc.staff.forEach(function (s) { var r = c.rows.filter(function (x) { return x.id === s.id; })[0]; h += '<div class="card"><h3>' + esc(s.alias) + '</h3><p class="small" style="margin:0">주 ' + H(r.c27.hours) + ' · 2027 월 ' + W(r.m27) + '</p>' + miniGrid(r.c27) + '<div class="row"><a class="btn sm grow" href="#/edit/' + encodeURIComponent(sc.id) + '/' + encodeURIComponent(s.id) + '">근무 편집<span class="sr"> ' + esc(s.alias) + '</span></a><button class="btn sm danger" type="button" data-rm="' + esc(s.id) + '">빼기<span class="sr"> ' + esc(s.alias) + '</span></button></div></div>'; });
  h += '<button class="btn block" type="button" id="addp">＋ 이 안에 직원 추가</button><div class="row" style="margin-top:12px"><a class="btn pri grow" href="#/alt">비교표로</a><button class="btn danger" type="button" id="delsc">이 안 삭제</button></div>' + discHtml();
  view.innerHTML = h;
  $('#scn', view).addEventListener('input', function (e) { sc.name = e.target.value.slice(0, 24) || '내 수정안'; saveNow(); });
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'addp') { var n = { id: uid('s'), alias: '새 자리', wageNow: null, wage2027: null, probation: null, holiday: -1, shifts: [] }; sc.staff.push(n); saveNow(); go('#/edit/' + sc.id + '/' + n.id); }
    if (b.dataset.rm) { sc.staff = sc.staff.filter(function (x) { return x.id !== b.dataset.rm; }); saveNow('뺐어요.'); render(true); }
    if (b.id === 'delsc') confirmBox('수정안 삭제', '"' + sc.name + '"을 지울까요?', '삭제', function () { st.scenarios = st.scenarios.filter(function (x) { return x.id !== sc.id; }); saveNow('삭제했어요.'); go('#/alt'); }, true);
  });
};
/* ---------- 가격으로 메꾸기 ---------- */
routes.price = function (view) {
  if (needStore(view)) return;
  var st = store(), c = R.storeCalc(st, RULES), p = st.pricing;
  if (!c.head) { view.innerHTML = '<h1>가격으로 메꾸기</h1><div class="card soft"><p>근무표를 넣으면 늘어난 인건비를 메꾸는 가격 인상폭을 계산해요.</p><a class="btn pri block" href="#/staff">근무표 입력하기</a></div>' + discHtml(); return; }
  var ex = st.example ? ' <span class="ex-tag">예시</span>' : '';
  view.innerHTML = '<h1>가격으로 메꾸기</h1>' + exBanner(st) +
    '<div class="card"><p style="margin:0">메꿔야 할 금액: 2027 인건비 증가 <b class="pos">연 ' + W(c.t.da) + '</b> <span class="small muted">(하루 약 ' + W(Math.max(0, c.t.da) / (st.openDays.length * 365 / 7)) + ', 영업 ' + st.openDays.length + '일/주 기준)</span></p></div>' +
    '<form id="pf" novalidate><div class="field"><label for="pmenu">대표 메뉴 이름' + ex + '</label><input id="pmenu" type="text" maxlength="20" value="' + esc(p.menu || '') + '" placeholder="예: 아메리카노"></div>' +
    '<div class="row" style="align-items:flex-start"><div class="field grow"><label for="pt">객단가(원)</label><input id="pt" type="text" inputmode="numeric" value="' + (p.avgTicket || '') + '" placeholder="예: 4500" aria-describedby="pt-e"><p class="ferr" id="pt-e" hidden></p></div>' +
    '<div class="field grow"><label for="pm">마진율(%)</label><input id="pm" type="text" inputmode="decimal" value="' + (p.marginRate || '') + '" placeholder="예: 60" aria-describedby="pm-h pm-e"><p class="hint" id="pm-h">재료비 등 뺀 비율</p><p class="ferr" id="pm-e" hidden></p></div></div>' +
    '<div class="field"><label for="ps">하루 판매량(잔·그릇)</label><input id="ps" type="text" inputmode="numeric" value="' + (p.dailySales || '') + '" placeholder="예: 120" aria-describedby="ps-e"><p class="ferr" id="ps-e" hidden></p></div>' +
    '<label class="cbx"><input type="checkbox" id="pv"' + (p.vat !== false ? ' checked' : '') + '><span>메뉴 가격에 부가세 10%가 포함돼 있어요(일반과세자)</span></label></form>' +
    '<div id="pres" aria-live="polite"></div>' + discHtml();
  function show() {
    var r = R.pricing(c.t.da, p, st), box = $('#pres', view), menu = p.menu || '대표 메뉴';
    ['avgTicket', 'marginRate', 'dailySales'].forEach(function (k) { var id = { avgTicket: 'pt', marginRate: 'pm', dailySales: 'ps' }[k], el = $('#' + id, view), er = $('#' + id + '-e', view), msg = r.errs && r.errs[k], touched = el.value.trim() !== '';
      if (msg && touched) { er.textContent = msg; er.hidden = false; el.setAttribute('aria-invalid', 'true'); } else { er.hidden = true; el.removeAttribute('aria-invalid'); } });
    if (!r.ok) { box.innerHTML = '<div class="card soft small"><p style="margin:0">객단가·마진율·하루 판매량을 넣으면 필요한 가격 인상폭과 하루 추가 판매량이 나와요.</p></div>'; return; }
    if (r.none) { box.innerHTML = '<div class="card"><p style="margin:0">2027 인건비가 늘지 않아 메꿀 금액이 없어요.</p></div>'; return; }
    box.innerHTML = '<div class="card"><h2 style="margin-top:0">결과' + ex + '</h2>' +
      '<p class="big" style="font-size:32px">' + esc(menu) + ' +' + r.up.toLocaleString('ko-KR') + '원</p><p>판매량이 그대로라면 ' + esc(menu) + ' 가격을 <b>' + r.up.toLocaleString('ko-KR') + '원</b>(10원 단위 올림, 약 ' + r.pctUp.toFixed(1) + '%) 올리면 연 ' + M(c.t.da) + '가 메꿔져요.</p>' +
      '<p>가격을 그대로 두면 하루에 <b>' + r.extra.toLocaleString('ko-KR') + (r.extra ? '잔(그릇)' : '') + '</b> 더 팔아야 해요. <span class="small muted">(1개당 남는 돈 ' + W(r.unitProfit) + ')</span></p>' +
      '<div class="field"><label for="pup">인상폭 직접 정해 보기: <output id="pupo"></output></label><input id="pup" type="range" min="0" max="' + Math.max(500, r.up * 2) + '" step="10" value="' + r.up + '"></div><p id="pcov" class="small"></p>' +
      '<p class="small muted" style="margin:0">계산: 하루 메꿀 금액 ' + W(r.perDay) + (r.vat ? ' × 1.1(부가세)' : '') + ' ÷ ' + Number(p.dailySales).toLocaleString('ko-KR') + '개 = ' + r.rawUp.toFixed(1) + '원 → 10원 단위 올림. 연 영업일 ' + r.dpy.toFixed(1) + '일. 카드수수료·가격 인상 후 판매량 변화는 넣지 않았어요.</p></div>';
    var sl = $('#pup', view);
    function cov() { var v = +sl.value, cw = R.coverWith(v, c.t.da, p, st); $('#pupo', view).textContent = '+' + v.toLocaleString('ko-KR') + '원'; sl.setAttribute('aria-valuetext', '+' + v + '원'); $('#pcov', view).innerHTML = '+' + v.toLocaleString('ko-KR') + '원이면 증가액의 <b>' + cw.pct.toFixed(0) + '%</b>를 메꾸고, ' + (cw.left > 0 ? '남은 연 ' + M(cw.left) + '는 하루 ' + cw.extra + '개를 더 팔면 메꿔져요.' : '증가액을 모두 메꿔요.'); }
    sl.addEventListener('input', cov); cov();
  }
  show();
  var f = $('#pf', view);
  f.addEventListener('submit', function (e) { e.preventDefault(); });
  f.addEventListener('input', function (e) {
    var id = e.target.id, v = e.target.value.trim();
    if (id === 'pmenu') p.menu = v.slice(0, 20);
    if (id === 'pt') p.avgTicket = R.num(v) > 0 ? Math.round(R.num(v)) : (v ? -1 : null);
    if (id === 'pm') p.marginRate = R.num(v) > 0 && R.num(v) <= 100 ? R.num(v) : (v ? -1 : null);
    if (id === 'ps') p.dailySales = R.num(v) > 0 ? Math.round(R.num(v)) : (v ? -1 : null);
    saveNow(); show();
  });
  f.addEventListener('change', function (e) { if (e.target.id === 'pv') { p.vat = e.target.checked; saveNow(); show(); } });
};
/* ---------- 안내문 · 체크리스트 ---------- */
routes.notice = function (view) {
  if (needStore(view)) return;
  var st = store(), c = R.storeCalc(st, RULES);
  var h = '<h1>직원 안내문·체크리스트</h1>' + exBanner(st);
  if (!c.head) h += '<div class="card soft"><p>근무표를 넣으면 직원별 2027 시급 안내문이 만들어져요.</p><a class="btn pri block" href="#/staff">근무표 입력하기</a></div>';
  else {
    h += '<p class="small muted">카톡으로 보낼 수 있는 문구예요. 보내기 전에 내용을 꼭 확인하세요. 예상 월 급여는 세전·근무표 기준 추정치예요.</p>';
    c.rows.filter(function (r) { return r.c27.hours > 0; }).forEach(function (r, i) {
      var txt = R.noticeText(r, st);
      h += '<div class="card"><h2 style="margin-top:0;font-size:17px">' + esc(r.alias) + '</h2>' + (r.warn.indexOf('minwage') >= 0 ? '<p class="ferr">⚠ 2027 시급이 최저임금보다 낮아요. 근무표에서 시급을 고친 뒤 보내세요.</p>' : '') +
        '<label class="sr" for="nt' + i + '">' + esc(r.alias) + ' 안내문</label><textarea id="nt' + i + '" readonly>' + esc(txt) + '</textarea><button class="btn sm pri block" type="button" data-copy="' + i + '" style="margin-top:8px">복사<span class="sr"> ' + esc(r.alias) + ' 안내문</span></button></div>';
    });
  }
  var ck = st.checklist || {}, done = RULES.checklist.filter(function (x) { return ck[x.id]; }).length;
  h += '<h2>근로계약 변경 체크리스트</h2><p class="small muted">법률 조언이 아닌 확인용 목록이에요. 체크 상태는 이 기기에 저장돼요. <b id="ckc">' + done + '/' + RULES.checklist.length + '</b></p><ul class="chk card">' +
    RULES.checklist.map(function (x) { return '<li><label><input type="checkbox" data-ck="' + x.id + '"' + (ck[x.id] ? ' checked' : '') + '><span>' + esc(x.text) + (x.law ? '<small>' + esc(x.law) + '</small>' : '') + '</span></label></li>'; }).join('') + '</ul>' + discHtml();
  view.innerHTML = h;
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-copy]'); if (b) copyText($('#nt' + b.dataset.copy, view).value, '안내문'); });
  view.addEventListener('change', function (e) { var k = e.target.dataset.ck; if (!k) return; st.checklist = st.checklist || {}; st.checklist[k] = e.target.checked; saveNow(); $('#ckc', view).textContent = RULES.checklist.filter(function (x) { return st.checklist[x.id]; }).length + '/' + RULES.checklist.length; });
};
/* ---------- 리포트 · CSV · 공유 카드 ---------- */
function drawCard(c, st) {
  var cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080; var g = cv.getContext('2d'), L = R.shareLines(c, st);
  var F = '"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",sans-serif';
  g.fillStyle = '#1E3A5F'; g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = '#F28C28'; g.fillRect(0, 0, 1080, 16);
  g.fillStyle = '#C9D7E8'; g.font = '700 44px ' + F; g.fillText(L[0], 80, 140);
  g.fillStyle = '#FFFFFF'; g.font = '800 92px ' + F; g.fillText('내년 인건비', 80, 300);
  g.fillStyle = '#FFB566'; g.font = '900 120px ' + F; g.fillText(L[1].replace('내년 인건비 ', ''), 80, 450);
  var mx = Math.max(c.t.m26, c.t.m27, 1);
  g.fillStyle = '#9AA9BC'; g.fillRect(80, 540, 820 * c.t.m26 / mx, 70); g.fillStyle = '#F28C28'; g.fillRect(80, 650, 820 * c.t.m27 / mx, 70);
  g.fillStyle = '#FFFFFF'; g.font = '700 40px ' + F; g.fillText('2026 월 ' + M(c.t.m26), 100, 590); g.fillStyle = '#1F2933'; g.fillText('2027 월 ' + M(c.t.m27), 100, 700);
  g.fillStyle = '#E4ECF6'; g.font = '600 44px ' + F; g.fillText(L[3], 80, 820); g.font = '500 34px ' + F; g.fillText(L[4], 80, 900);
  g.fillStyle = '#C9D7E8'; g.font = '600 30px ' + F; g.fillText('2027 인건비 리허설 · 가입 없이 10분', 80, 1010);
  return cv;
}
routes.report = function (view) {
  if (needStore(view)) return;
  var st = store(), c = R.storeCalc(st, RULES);
  if (!c.head) { view.innerHTML = '<h1>리포트·공유</h1><div class="card soft"><p>근무표를 넣으면 인쇄용 리포트와 CSV, 공유 카드를 만들 수 있어요.</p><a class="btn pri block" href="#/staff">근무표 입력하기</a></div>' + discHtml(); return; }
  var sc = R.compare(st, RULES, R.genScenarios(st, RULES)).filter(function (x) { return !x.na; }), pr = R.pricing(c.t.da, st.pricing, st);
  var rep = '<section class="report" id="report" aria-labelledby="rph"><h2 id="rph">' + esc(st.name) + ' — 2027 인건비 리포트</h2>' + (st.example ? '<p><span class="ex-tag">예시</span>예시 데이터</p>' : '') +
    '<p>작성 ' + new Date().toLocaleDateString('ko-KR') + ' · ' + (c.five ? '상시 5인 이상(가산 포함)' : '5인 미만 기준(가산 제외)') + ' · 2027 최저임금 시간급 10,700원(고용노동부 고시 제2026-60호)</p>' +
    '<div class="report-sec"><p style="font-size:1.25em;margin:4px 0"><b>연 ' + signed(c.t.da) + '</b> (월 ' + W(c.t.m26) + ' → ' + W(c.t.m27) + ', ' + (c.t.pct >= 0 ? '+' : '') + c.t.pct.toFixed(1) + '%)</p>' +
    '<table class="tbl"><thead><tr><th scope="col">직원</th><th scope="col">주 시간</th><th scope="col">주휴</th><th scope="col">2027 시급</th><th scope="col">2026 월</th><th scope="col">2027 월</th></tr></thead><tbody>' +
    c.rows.map(function (r) { return '<tr><th scope="row" style="text-align:left;font-weight:600">' + esc(r.alias) + '</th><td>' + H(r.c27.hours) + '</td><td>' + H(r.c27.juhuH) + '</td><td>' + W(r.w27) + '</td><td>' + W(r.m26) + '</td><td>' + W(r.m27) + '</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><th scope="row" style="text-align:left">합계 월/연</th><td>' + H(c.t.hours) + '</td><td></td><td></td><td>' + W(c.t.m26) + '<br>' + W(c.t.a26) + '</td><td>' + W(c.t.m27) + '<br>' + W(c.t.a27) + '</td></tr></tfoot></table></div>' +
    '<div class="report-sec"><h3 style="margin-top:10px">대안 비교(2027 연)</h3><table class="tbl"><thead><tr><th scope="col">안</th><th scope="col">연 비용</th><th scope="col">원안 대비</th><th scope="col">사장님 +주</th><th scope="col">공백/주</th></tr></thead><tbody>' +
    sc.map(function (x) { return '<tr><th scope="row" style="text-align:left;font-weight:600">' + esc(x.name) + '</th><td>' + M(x.calc.t.a27) + '</td><td>' + (x.kind === 'base' ? '—' : signed(x.diffA, M)) + '</td><td>' + H(x.ownerH || 0) + '</td><td>' + H(x.gap || 0) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    (pr.ok && !pr.none ? '<p style="margin-top:8px"><b>가격 역산:</b> ' + esc(st.pricing.menu || '대표 메뉴') + ' +' + pr.up + '원 또는 하루 ' + pr.extra + '개 추가 판매로 상쇄(부가세 ' + (pr.vat ? '포함' : '미포함') + ').</p>' : '') +
    '<p class="small" style="margin-top:8px">4대보험 사업주 부담: ' + (c.insOn ? '입력 요율 반영(빈 항목 제외)' : '요율 확인 필요 — 미포함') + '. 공휴일 유급휴일·연차·퇴직금 미포함. 참고용 계산이며 법률·노무 자문이 아니에요.</p></section>';
  view.innerHTML = '<h1>리포트·공유</h1>' + exBanner(st) +
    '<div class="row screen-only no-print" style="margin-bottom:12px"><button class="btn pri grow" type="button" id="print">인쇄·PDF (A4 1장)</button><button class="btn grow" type="button" id="csv">12개월 예산 CSV</button></div>' + rep +
    '<h2 class="no-print">공유 카드</h2><div class="card share no-print"><p class="small">금액만 담기고 직원 이름(별칭)은 들어가지 않아요.</p><img id="cardimg" alt="공유 카드 미리보기: ' + esc(R.shareLines(c, st).slice(1).join(', ')) + '"><button class="btn block" type="button" id="png" style="margin-top:10px">카드 PNG 저장</button></div><div class="no-print">' + discHtml() + '</div>';
  var cv = drawCard(c, st); $('#cardimg', view).src = cv.toDataURL('image/png');
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.id === 'print') window.print();
    if (b.id === 'csv') { download('2027-인건비-예산-' + st.name.replace(/[^\w가-힣]+/g, '_') + '.csv', new Blob([R.csv(st, c)], { type: 'text/csv;charset=utf-8' })); toast('CSV를 저장했어요. 엑셀에서 열 수 있어요.'); }
    if (b.id === 'png') { cv.toBlob(function (bl) { download('2027-인건비-카드.png', bl); toast('카드 이미지를 저장했어요.'); }, 'image/png'); }
  });
};
/* ---------- 정보 ---------- */
routes.info = function (view) {
  var p = RULES.premium;
  view.innerHTML = '<h1>계산 규칙과 출처</h1><div class="card warn"><p style="margin:0"><b>참고용 계산이며 법률·노무 자문이 아니에요.</b> 실제 임금 지급·근로계약은 근로기준법·최저임금법과 개별 사정에 따라 달라져요. 고용노동부 ☎ <a href="tel:1350">1350</a> 또는 노무사와 확인하세요.</p></div>' +
    '<h2>이렇게 계산해요</h2><ul class="card small">' +
    '<li>최저임금: 2026년 ' + RULES.minWage['2026'].toLocaleString('ko-KR') + '원, 2027년 ' + RULES.minWage['2027'].toLocaleString('ko-KR') + '원 (data/rules.json에서 읽음)</li>' +
    '<li>주 근로시간 = 요일별 (끝 − 시작 − 휴게). 자정 넘는 근무는 날짜별로 나눠 보여 줘요.</li>' +
    '<li>주휴수당: 주 15시간 미만 0원, 15시간 이상 (주 시간 ÷ 40) × 8시간 × 시급, 최대 8시간분.</li>' +
    '<li>5인 이상일 때만: 연장(1일 8시간·1주 40시간 초과) 50%, 야간(' + p.nightStart + '~0' + p.nightEnd + '시) 50%, 휴일 8시간까지 50%·초과 100%. 연장과 휴일이 겹치면 휴일 할증만, 야간은 따로 더해요. 자정 넘어 이어진 근무는 시작한 날의 근로로 봐요.</li>' +
    '<li>휴게는 근무 한가운데에 있다고 보고 야간 시간을 계산해요.</li>' +
    '<li>월 = 주 금액 × ' + RULES.weeksPerMonth + '주, 연 = 월 × 12. (고시 월 환산 209시간과 약간 달라요)</li>' +
    '<li>4대보험 사업주 부담: 공식 확인한 요율만 [공식 확인값 넣기]로 채우고, 나머지는 "요율 확인 필요"로 비워 둬요. 월 60시간 미만 직원은 빼요.</li>' +
    '<li>포함하지 않은 것: 공휴일 유급휴일·연차·퇴직금, 소득세, 산재보험(업종별), 카드수수료.</li></ul>' +
    '<h2>출처</h2><ul class="card small">' + RULES.sources.map(function (s) { return '<li style="margin-bottom:6px">' + srcLink(s.id) + ' <span class="muted">— ' + esc(s.org) + (s.note ? ', ' + esc(s.note) : '') + '</span></li>'; }).join('') + '</ul><p class="small muted">출처 확인일: ' + RULES.checked + ' (KST)</p>' +
    '<h2>개인정보</h2><div class="card small"><p>입력한 매장·직원·근무 정보는 <b>이 기기의 브라우저 저장소(localStorage)에만</b> 저장되고 서버로 보내지 않아요. 회원가입·로그인·분석 도구가 없어요.</p><p style="margin:0">직원 실명 대신 별칭을 권해요. 공유 카드에는 직원 이름이 들어가지 않아요. 기기를 함께 쓴다면 설정에서 데이터를 지울 수 있어요.</p></div>' +
    '<h2>Pro 미리보기</h2><div class="card soft small"><p style="margin:0"><span class="lock">PRO 예정</span> 직원별 안내문 일괄 생성, 세무사 사무실용 로고 리포트는 정식 버전에서 제공할 예정이에요. 지금은 모든 기능이 무료예요.</p></div>' + discHtml();
};
/* ---------- 설정 ---------- */
routes.settings = function (view) {
  var st = store();
  var h = '<h1>설정</h1><h2>매장</h2>';
  S.stores.forEach(function (s) { h += '<div class="card"><h3>' + (s.example ? '<span class="ex-tag">예시</span>' : '') + esc(s.name) + (s.id === S.activeId ? ' <span class="badge ok">선택됨</span>' : '') + '</h3><div class="row">' + (s.id === S.activeId ? '<a class="btn sm grow" href="#/store">이름·기본 정보</a>' : '<button class="btn sm grow" type="button" data-use="' + esc(s.id) + '">이 매장 선택<span class="sr"> ' + esc(s.name) + '</span></button>') + '<button class="btn sm ghost" type="button" data-dupst="' + esc(s.id) + '">복제<span class="sr"> ' + esc(s.name) + '</span></button><button class="btn sm danger" type="button" data-delst="' + esc(s.id) + '">삭제<span class="sr"> ' + esc(s.name) + '</span></button></div></div>'; });
  if (!S.stores.length) h += '<p class="card soft small">아직 매장이 없어요.</p>';
  h += '<button class="btn block" type="button" id="addst">＋ 새 매장 만들기</button>';
  if (st) {
    var ins = st.insurance; ins.rates = ins.rates || {};
    var si = RULES.socialInsurance;
    h += '<h2>사업주 4대보험 요율 (선택)</h2><div class="card"><label class="cbx"><input type="checkbox" id="inson"' + (ins.on ? ' checked' : '') + '><span>결과에 사업주 4대보험 부담분 넣기(월 60시간 이상 직원)</span></label>' +
      '<p class="small muted">요율은 비워 둔 상태가 기본이에요. ' + esc(si.note) + '. 숫자는 % 단위(예: 5 = 5%)예요.</p>' +
      '<button class="btn sm block" type="button" id="insfill">공식 확인값 넣기(국민연금·건강보험)</button><table class="tbl" style="margin-top:10px"><caption class="sr">사업주 부담 요율 입력</caption><thead><tr><th scope="col">항목</th><th scope="col">2026 %</th><th scope="col">2027 %</th></tr></thead><tbody>';
    si.verified.concat(si.unverified).forEach(function (it) {
      var v = ins.rates[it.key] || {}, src = it.src ? srcLink(it.src) : '';
      h += '<tr><th scope="row" style="text-align:left;font-weight:600">' + esc(it.label) + '<br><span class="small muted" style="font-weight:400">' + (it.basis ? '공식 확인: ' + esc(it.basis) + ' · ' + src : '<b class="lock">요율 확인 필요</b> ' + esc(it.hint)) + '</span></th>' +
        ['2026', '2027'].map(function (y) { return '<td><label class="sr" for="r-' + it.key + '-' + y + '">' + esc(it.label) + ' ' + y + '년 요율(%)</label><input id="r-' + it.key + '-' + y + '" data-rk="' + it.key + '" data-ry="' + y + '" type="text" inputmode="decimal" style="min-width:64px" value="' + (v[y] != null ? v[y] : '') + '" placeholder="확인 필요"></td>'; }).join('') + '</tr>';
    });
    h += '</tbody></table></div>';
  }
  h += '<h2>백업·복원</h2><div class="card"><p class="small">모든 매장·근무표를 JSON 파일로 저장하거나 불러와요. 불러오면 지금 데이터를 대신해요.</p><div class="row"><button class="btn grow" type="button" id="exp">백업 저장(JSON)</button><label class="btn grow" for="imp">백업 불러오기</label></div><input type="file" id="imp" accept="application/json,.json" class="sr"></div>' +
    '<h2>초기화</h2><div class="card"><p class="small">이 기기에 저장된 매장·근무표·체크리스트를 모두 지워요.</p><button class="btn danger block" type="button" id="reset">모든 데이터 지우기</button></div>' +
    '<h2>자체 점검</h2><div class="card small"><button class="btn sm block" type="button" id="selft">계산 규칙 자체 점검 실행</button><p id="selfr" aria-live="polite"></p></div>' + discHtml();
  view.innerHTML = h;
  view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.use) { S.activeId = b.dataset.use; persist(); toast('매장을 바꿨어요.'); render(true); }
    if (b.dataset.dupst) { var o = S.stores.filter(function (x) { return x.id === b.dataset.dupst; })[0], cp = clone(o); cp.id = uid('st'); cp.name = (o.name + ' 복사').slice(0, 24); cp.example = false; S.stores.push(cp); persist(); toast('복제했어요.'); render(true); }
    if (b.dataset.delst) { var d = S.stores.filter(function (x) { return x.id === b.dataset.delst; })[0]; confirmBox('매장 삭제', '"' + d.name + '"과 근무표를 지울까요? 되돌릴 수 없어요.', '삭제', function () { S.stores = S.stores.filter(function (x) { return x !== d; }); if (S.activeId === d.id) S.activeId = S.stores.length ? S.stores[0].id : null; persist(); toast('삭제했어요.'); render(true); }, true); }
    if (b.id === 'addst') { newStore('매장 ' + (S.stores.length + 1)); toast('새 매장을 만들었어요.'); go('#/store'); }
    if (b.id === 'insfill') { RULES.socialInsurance.verified.forEach(function (it) { st.insurance.rates[it.key] = { '2026': it.rates['2026'], '2027': it.rates['2027'] }; }); st.insurance.on = true; saveNow('공식 확인된 요율만 넣었어요. 나머지는 확인 후 입력하세요.'); render(true); }
    if (b.id === 'exp') { var data = { app: 'labor-cost-rehearsal-2027', version: 1, exportedAt: new Date().toISOString(), activeId: S.activeId, stores: S.stores }; download('labor-2027-backup-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); toast('백업 파일을 저장했어요.'); }
    if (b.id === 'reset') confirmBox('모든 데이터 지우기', '매장·근무표·체크리스트가 모두 지워져요. 먼저 백업을 권해요.', '모두 지우기', function () { try { localStorage.removeItem(KEY); } catch (er) {} S = blank(); toast('모두 지웠어요.'); go('#/'); }, true);
    if (b.id === 'selft') { var r = R.selfTest(RULES); $('#selfr', view).textContent = '자체 점검 ' + r.pass + '/' + r.total + ' 통과' + (r.fail ? ' — 실패 ' + r.fail + '건' : ''); }
  });
  view.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'inson') { st.insurance.on = t.checked; saveNow(t.checked ? '4대보험 부담분을 결과에 넣어요.' : '4대보험 부담분을 뺐어요.'); }
    if (t.dataset.rk) { var v = t.value.trim(), n = R.num(v); st.insurance.rates[t.dataset.rk] = st.insurance.rates[t.dataset.rk] || {}; if (v && !(n >= 0 && n < 30)) { t.setAttribute('aria-invalid', 'true'); toast('요율은 0~30 사이 % 숫자로 적어 주세요.'); return; } t.removeAttribute('aria-invalid'); st.insurance.rates[t.dataset.rk][t.dataset.ry] = v ? n : null; saveNow('요율을 저장했어요.'); }
    if (t.id === 'imp' && t.files && t.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        var o = null; try { o = JSON.parse(fr.result); } catch (er) {}
        var cl = R.sanitizeImport(o);
        if (!cl) { openModal('<h2 id="mh">불러올 수 없는 파일이에요</h2><p>이 앱에서 저장한 백업(JSON) 파일인지 확인해 주세요. 지금 데이터는 그대로예요.</p><button class="btn pri block" type="button" data-dismiss="1">확인</button>'); t.value = ''; return; }
        confirmBox('백업 불러오기', '매장 ' + cl.stores.length + '개를 불러와 지금 데이터를 대신할까요?', '불러오기', function () { S.stores = cl.stores; S.activeId = cl.activeId; S.prefs.onboarded = true; persist(); toast('백업을 불러왔어요.'); go('#/result'); });
        t.value = '';
      };
      fr.onerror = function () { toast('파일을 읽지 못했어요.'); };
      fr.readAsText(t.files[0]);
    }
  });
};
/* ---------- 시작 ---------- */
function bootError(msg) {
  $('#view').innerHTML = '<h1>계산 규칙을 불러오지 못했어요</h1><div class="card err" role="alert"><p>' + esc(msg) + '</p><p class="small">인터넷 연결을 확인하고 다시 시도해 주세요. 한 번 열린 뒤에는 오프라인에서도 쓸 수 있어요.</p><button class="btn pri block" type="button" id="retry">다시 시도</button></div>';
  $('#retry').addEventListener('click', function () { location.reload(); });
  document.title = R.pageTitle('계산 규칙을 불러오지 못했어요', APP);
}
function boot() {
  loadState();
  fetch('data/rules.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
    if (!j || !j.minWage || !(j.minWage['2027'] > 0)) throw new Error('규칙 파일 형식이 올바르지 않아요.');
    RULES = j; window.__RULES = j;
    window.addEventListener('hashchange', function () { closeModal(); render(); });
    render();
  }).catch(function (e) { bootError(e && e.message ? '(' + e.message + ')' : ''); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
window.__runSelfTest = function () { return R.selfTest(RULES); };
window.__state = function () { return S; };
boot();
})();
