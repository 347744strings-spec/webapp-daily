/* 우리 육휴 설계도 — app.js (빌드: /workspace/webapps/_build/leave/p1~p5.js 이어붙임) */
(function () {
'use strict';
var R = window.LeaveRules;
var APP = '우리 육휴 설계도';
var KEY = 'yukhyu.v1';
var RJ = null, S = null, PEND = null, IMP = null;
var flags = { recovered: false, storageError: false };
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function W(n) { return '<span class="amt">' + esc(R.won(Math.floor(n))) + '</span>'; }
function M(n) { return '<span class="amt">' + esc(R.man(n)) + '</span>'; }
function blank() { return { plans: [], activePlanId: '', settings: { onboarded: false, example: false } }; }
function load() {
  S = blank(); var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { flags.storageError = true; return; }
  if (raw == null) return;
  try {
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object') throw 0;
    S.plans = (Array.isArray(o.plans) ? o.plans : []).map(R.cleanPlan).filter(Boolean).slice(0, 3);
    S.activePlanId = typeof o.activePlanId === 'string' ? o.activePlanId : '';
    if (o.settings && typeof o.settings === 'object') { S.settings.onboarded = !!o.settings.onboarded; S.settings.example = !!o.settings.example; }
    if (S.plans.length) S.settings.onboarded = true;
  } catch (e) { flags.recovered = true; try { localStorage.removeItem(KEY); } catch (e2) {} }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!flags.storageError) { flags.storageError = true; toast('저장 공간에 쓸 수 없어요. 창을 닫으면 내용이 사라져요.'); } } }
function active() { var p = S.plans.filter(function (x) { return x.id === S.activePlanId; })[0]; if (!p && S.plans.length) { p = S.plans[0]; S.activePlanId = p.id; } return p || null; }
var CACHE = {};
function calc(p) {
  var k = JSON.stringify(p); if (CACHE.k === k) return CACHE.v;
  var sm = R.summary(p, RJ); sm.dl = R.deadlines(p, RJ); CACHE = { k: k, v: sm }; return sm;
}
/* ---------- 공통 UI ---------- */
var toastT = null;
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3400); }
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
      var f = $$('button,a[href],input,select,textarea', bg).filter(function (x) { return !x.disabled && (x.offsetParent !== null || x.type === 'radio' || x.type === 'checkbox'); });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.body.style.overflow = 'hidden';
  var h = $('h2', bg); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  if (onReady) onReady(bg);
}
function closeModal() { $('#modal-root').innerHTML = ''; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) try { lastFocus.focus(); } catch (e) {} }
function confirmBox(title, body, okLabel, cb, danger) {
  openModal('<h2 id="mh">' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-dismiss="1" type="button">취소</button><button class="btn grow ' + (danger ? 'danger solid' : 'pri') + '" id="mok" type="button">' + esc(okLabel) + '</button></div>',
    function (bg) { $('#mok', bg).addEventListener('click', function () { closeModal(); cb(); }); });
}
function copyText(text, what) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    toast(ok ? (what || '내용') + '을 복사했어요.' : '복사가 막혀 있어요. 아래 글자를 길게 눌러 직접 복사해 주세요.');
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast((what || '내용') + '을 복사했어요.'); }, fallback);
  else fallback();
}
function download(name, blob) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); a.remove();
}
function chips(name, list, cur) {
  return '<div class="chips">' + list.map(function (o) {
    return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(o.id) + '"' + (cur === o.id ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>';
  }).join('') + '</div>';
}
function val(name, el) { var x = $('input[name="' + name + '"]:checked', el || document); return x ? x.value : ''; }
function src(id) {
  var s = RJ.sources.filter(function (x) { return x.id === id; })[0]; if (!s) return '';
  return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '<span class="sr"> (새 창)</span></a>' + (s.verified ? '' : ' <b class="lock">확인 필요</b>');
}
function disc() {
  return '<div class="disc" data-disc="1"><p style="margin:0 0 4px"><b>참고 추정치, 실제 지급·자격은 고용센터가 결정</b>해요. 규칙 기준일 <b class="num">' + esc(RJ.baseDate) + '</b>.</p>'
    + '<a href="https://www.work24.go.kr/" target="_blank" rel="noopener noreferrer">고용24<span class="sr"> (새 창)</span></a><a href="tel:1350">고객상담센터 1350</a><a href="#/help">근거 보기</a></div>';
}
function exBanner() {
  if (!S.settings.example) return '';
  return '<div class="card warm"><span class="tag ex">예시</span> 예시 데이터예요(가상의 부부·가상 월급). <button class="btn ghost" type="button" data-act="clear-example" style="margin-top:8px">예시 지우고 우리 정보로 시작</button></div>';
}
var INS = [{ id: 'employee', label: '고용보험 근로자' }, { id: 'civil', label: '공무원·교원' }, { id: 'none', label: '미가입·프리랜서' }];
function insLabel(x) { return (INS.filter(function (o) { return o.id === x; })[0] || INS[0]).label; }
function who(p) { return '<span class="who' + (p.key === 'B' ? ' b' : '') + '">' + esc(p.label) + '</span>'; }
/* ---------- 라우터 ---------- */
var routes = {};
var TAB = { plan: 'plan', pick: 'plan', start: 'plan', compare: 'compare', out: 'out', help: 'help' };
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  var h = location.hash.replace(/^#/, '') || '/', name, parts;
  if (/^p=/.test(h)) { name = 'imp'; parts = [h.slice(2)]; }
  else { parts = h.split('/').filter(Boolean); name = parts[0] || 'home'; parts = parts.slice(1).map(decodeURIComponent); }
  if (!routes[name]) name = 'home';
  if (name === 'home' && S.plans.length) name = 'plan';
  document.body.classList.toggle('wide', ['plan', 'compare', 'pick'].indexOf(name) >= 0);
  var old = $('#view'), view = old.cloneNode(false); old.parentNode.replaceChild(view, old);
  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.getAttribute('data-act') === 'clear-example') confirmBox('예시를 지울까요?', '예시 계획을 모두 지우고 입력 화면으로 가요.', '예시 지우기', function () { S = blank(); S.settings.onboarded = true; save(); toast('예시를 지웠어요. 우리 정보를 넣어 주세요.'); go('#/start'); });
  });
  try { routes[name](view, parts); }
  catch (err) { view.innerHTML = '<h1>화면을 그리다 문제가 생겼어요</h1><div class="card danger" role="alert"><p>입력한 날짜나 값이 예상과 달라요. 블록 날짜를 고치거나 새로 설계해 주세요.</p><a class="btn block" href="#/start">새로 설계</a></div>'; if (window.console && console.warn) console.warn(err); }
  var tb = $('#tabbar'); tb.hidden = !S.settings.onboarded && !S.plans.length;
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === TAB[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (flags.recovered) { var n = document.createElement('div'); n.className = 'card danger'; n.setAttribute('role', 'alert'); n.innerHTML = '<p style="margin:0"><b>저장된 계획을 읽을 수 없어 비웠어요.</b> 공유 링크가 있으면 다시 열어 되살릴 수 있어요.</p>'; view.insertBefore(n, view.firstChild.nextSibling); flags.recovered = false; }
  var h1 = $('h1', view); document.title = R.pageTitle(h1 ? h1.textContent : '', APP);
  if (h1) { h1.setAttribute('tabindex', '-1'); if (!render.first) h1.focus({ preventScroll: true }); }
  render.first = false; var sc = view.getAttribute('data-scroll') && document.getElementById(view.getAttribute('data-scroll')); if (sc) sc.scrollIntoView(); else window.scrollTo(0, 0);
}
render.first = true;
/* ---------- 첫 화면(온보딩) ---------- */
function exampleInput() { return { birthDate: '2027-01-20', single: false, insA: 'employee', insB: 'employee', wageA: 3200000, wageB: 4000000, netA: 2700000, netB: 3300000, labelA: '예시 A', labelB: '예시 B', insuredOk: true }; }
routes.home = function (v) {
  var ex = R.recommend(exampleInput())[0], sm = R.summary(ex, RJ);
  v.innerHTML = '<h1>' + APP + '</h1>'
    + '<p class="hint" style="font-size:19px;color:var(--ink)">둘이 <b>몇 달씩, 언제</b> 쉬면 좋을지 한 장으로 짜요. 출산(예정)일과 두 사람 통상임금만 넣으면 추천 3가지가 나와요.</p>'
    + '<div class="card"><h2>이렇게 써요</h2><ol style="margin:0;padding-left:22px"><li><b>4가지 입력</b> — 출산(예정)일, 두 사람 월 통상임금, 고용보험 여부</li><li><b>추천 3가지 중 고르기</b> — 6+6 급여·가구 수입·마감일 비교</li><li><b>배우자에게 링크 공유·한 장 인쇄</b> — 서버에 아무것도 안 올라가요</li></ol></div>'
    + '<div class="card soft"><span class="tag ex">예시</span> <b>' + esc(ex.name) + '</b><div class="stats"><div class="stat wide"><span>예상 육아휴직급여 합계</span><b id="ex-total">' + R.won(sm.total) + '</b></div><div class="stat"><span>6+6 함께 쓴 달</span><b>' + sm.N + '개월</b></div><div class="stat"><span>가장 빠듯한 달 가구 수입</span><b>' + R.man(sm.low.total) + '</b></div></div><p class="hint" style="margin:0">가상의 부부(월 320만·400만), 2027-01-20 출산 예정 기준 예시예요.</p></div>'
    + '<div class="row"><a class="btn pri big grow" href="#/start">4가지 넣고 시작</a><button class="btn grow" id="load-ex" type="button">예시로 둘러보기</button></div>'
    + disc();
  $('#load-ex', v).addEventListener('click', function () {
    var list = R.recommend(exampleInput()); S.plans = list.map(R.cleanPlan); S.activePlanId = S.plans[0].id; S.settings.onboarded = true; S.settings.example = true; save(); toast('예시 계획 3개를 불러왔어요.'); go('#/plan');
  });
};
/* ---------- 입력 ---------- */
function wageText(n) { return n > 0 ? R.num(n) : ''; }
routes.start = function (v) {
  var p = active(), d = p ? { birthDate: p.birthDate, single: p.single, insA: p.parents[0].insured, insB: p.parents[1].insured, wageA: p.parents[0].wage, wageB: p.parents[1].wage, netA: p.parents[0].net, netB: p.parents[1].net, labelA: p.parents[0].label, labelB: p.parents[1].label } : { insA: 'employee', insB: 'employee' };
  if (S.settings.example) d = { insA: 'employee', insB: 'employee' };
  v.innerHTML = '<h1>4가지만 알려 주세요</h1>' + exBanner()
    + '<form id="f" novalidate class="card">'
    + '<label class="f" for="birth">① 출산(예정)일</label><input type="date" id="birth" value="' + esc(d.birthDate || '') + '" aria-describedby="e-birth"><p class="err" id="e-birth" role="alert"></p>'
    + '<fieldset style="border:0;padding:0;margin:14px 0 0"><legend class="f" style="font-weight:800">한부모인가요?</legend>' + chips('single', [{ id: 'no', label: '아니요, 두 사람' }, { id: 'yes', label: '네, 한부모' }], d.single ? 'yes' : 'no') + '</fieldset>'
    + '<fieldset style="border:0;padding:0;margin:14px 0 0"><legend class="f" style="font-weight:800">② <span id="la">' + esc(d.labelA || 'A') + '</span>의 고용보험</legend>' + chips('insA', INS, d.insA) + '</fieldset>'
    + '<label class="f" for="wageA">③ <span>' + esc(d.labelA || 'A') + '</span> 월 통상임금(세전)</label><input type="text" inputmode="numeric" id="wageA" placeholder="예: 3,200,000 또는 320만" value="' + esc(wageText(d.wageA)) + '" aria-describedby="e-wageA h-wage"><p class="err" id="e-wageA" role="alert"></p>'
    + '<div id="bwrap"><fieldset style="border:0;padding:0;margin:14px 0 0"><legend class="f" style="font-weight:800">B(배우자)의 고용보험</legend>' + chips('insB', INS, d.insB) + '</fieldset>'
    + '<label class="f" for="wageB">④ B 월 통상임금(세전)</label><input type="text" inputmode="numeric" id="wageB" placeholder="예: 4,000,000 또는 400만" value="' + esc(wageText(d.wageB)) + '" aria-describedby="e-wageB h-wage"><p class="err" id="e-wageB" role="alert"></p></div>'
    + '<p class="hint" id="h-wage">통상임금은 기본급+고정 수당이에요(상여·성과급 제외). 급여명세서로 확인하세요.</p>'
    + '<details style="margin-top:12px"><summary style="min-height:44px;font-weight:800;cursor:pointer">더 정확하게(선택): 이름·실수령액·휴직 시작일</summary>'
    + '<label class="f" for="labelA">A 부를 이름</label><input type="text" id="labelA" maxlength="12" value="' + esc(d.labelA && d.labelA !== 'A' ? d.labelA : '') + '" placeholder="예: 나">'
    + '<label class="f" for="labelB">B 부를 이름</label><input type="text" id="labelB" maxlength="12" value="' + esc(d.labelB && d.labelB !== 'B' ? d.labelB : '') + '" placeholder="예: 배우자">'
    + '<label class="f" for="netA">A 월 실수령액</label><input type="text" inputmode="numeric" id="netA" value="' + esc(wageText(d.netA)) + '" placeholder="비우면 통상임금으로 계산"><p class="err" id="e-netA" role="alert"></p>'
    + '<label class="f" for="netB">B 월 실수령액</label><input type="text" inputmode="numeric" id="netB" value="' + esc(wageText(d.netB)) + '" placeholder="비우면 통상임금으로 계산"><p class="err" id="e-netB" role="alert"></p>'
    + '<label class="f" for="aStart">A 휴직 시작일</label><input type="date" id="aStart" aria-describedby="h-as"><p class="hint" id="h-as">비우면 <b>출산 3개월 뒤</b>로 가정해요(출산전후휴가 90일 뒤). 출산전후휴가 급여는 계산하지 않아요.</p></details>'
    + '<p class="err" id="e-all" role="alert"></p>'
    + '<button class="btn pri big block" type="submit" style="margin-top:14px">추천 3가지 보기</button></form>' + disc();
  var f = $('#f', v);
  function sync() { var single = val('single', f) === 'yes'; $('#bwrap', f).hidden = single; }
  f.addEventListener('change', sync); sync();
  f.addEventListener('submit', function (e) {
    e.preventDefault(); $$('.err', f).forEach(function (x) { x.textContent = ''; }); $$('[aria-invalid]', f).forEach(function (x) { x.removeAttribute('aria-invalid'); });
    var bad = null; function err(id, msg) { $('#e-' + id, f).textContent = msg; var inp = $('#' + id, f); if (inp) inp.setAttribute('aria-invalid', 'true'); if (!bad) bad = inp || $('#e-' + id, f); }
    var birth = $('#birth', f).value, single = val('single', f) === 'yes', insA = val('insA', f) || 'employee', insB = single ? 'none' : (val('insB', f) || 'employee');
    if (!R.isD(birth)) err('birth', '출산(예정)일을 골라 주세요.');
    else if (birth < '2024-01-01' || birth > R.addMonths(RJ.baseDate, 30)) err('birth', '2024-01-01부터 ' + R.addMonths(RJ.baseDate, 30) + ' 사이 날짜만 계산할 수 있어요.');
    function wage(id, need) { var t = $('#' + id, f).value.trim(), n = R.parseWon(t); if (!t) { if (need) err(id, '월 통상임금을 적어 주세요. 예: 320만'); return 0; } if (!(n > 0) || n > 100000000) { err(id, '숫자로 적어 주세요(1억원 이하). 예: 3,200,000 또는 320만'); return 0; } return n; }
    var wA = wage('wageA', insA === 'employee'), wB = single ? 0 : wage('wageB', insB === 'employee'), nA = wage('netA', false), nB = single ? 0 : wage('netB', false);
    if (insA === 'none' && insB === 'none') err('all', '두 사람 모두 고용보험 미가입이면 육아휴직급여를 계산할 수 없어요. 가입 여부를 다시 확인해 주세요.');
    var as = $('#aStart', f).value; if (as && R.isD(birth) && as < birth) err('all', 'A 휴직 시작일이 출산일보다 빨라요.');
    if (bad) { bad.focus(); return; }
    PEND = R.recommend({ birthDate: birth, single: single, insA: insA, insB: insB, wageA: wA, wageB: wB, netA: nA, netB: nB, aStart: as, labelA: $('#labelA', f).value.trim() || 'A', labelB: $('#labelB', f).value.trim() || 'B' });
    if (S.settings.example) { S = blank(); }
    S.settings.onboarded = true; save(); go('#/pick');
  });
};
/* ---------- 추천 3가지 ---------- */
function kpis(p, sm) {
  return '<div class="kpi"><div><span>예상 급여 합계</span><b>' + R.won(sm.total) + '</b></div>'
    + p.parents.map(function (q, i) { return (i === 1 && p.single) ? '' : '<div><span>' + esc(q.label) + ' 휴직</span><b>' + sm.gap[i] + '개월</b></div>'; }).join('')
    + '<div><span>6+6 함께 쓴 달</span><b>' + (sm.ev.ppt ? sm.N + '개월' : '없음') + '</b></div>'
    + '<div><span>가장 빠듯한 달</span><b>' + R.man(sm.low.total) + '</b></div>'
    + '<div><span>경고</span><b>' + (sm.reds ? sm.reds + '건' : '없음') + '</b></div></div>';
}
function addPlans(list, cb) {
  var over = S.plans.length + list.length - 3;
  function doit() { if (over > 0) S.plans = S.plans.slice(over); list.forEach(function (p) { S.plans.push(R.cleanPlan(p)); }); S.activePlanId = S.plans[S.plans.length - list.length].id; S.settings.example = false; save(); cb(); }
  if (over > 0) confirmBox('저장 칸은 3개예요', '먼저 저장한 계획 ' + over + '개(' + S.plans.slice(0, over).map(function (x) { return x.name; }).join(', ') + ')를 지우고 저장할까요?', '바꿔서 저장', doit, true); else doit();
}
routes.pick = function (v) {
  if (!PEND) { v.innerHTML = '<h1>추천 3가지</h1><div class="card"><h2>아직 입력한 정보가 없어요</h2><p>출산(예정)일과 통상임금을 넣으면 추천 3가지를 만들어요.</p><a class="btn pri block" href="#/start">4가지 넣기</a></div>' + disc(); return; }
  v.innerHTML = '<h1>추천 3가지</h1><p class="hint">옆으로 밀어 비교하고 마음에 드는 안을 고르세요. 고른 뒤에 날짜를 자유롭게 고칠 수 있어요.</p><div class="scroller" role="list">'
    + PEND.map(function (p, i) { var sm = R.summary(p, RJ); return '<div class="sc" role="listitem"><h2>' + esc(p.name) + '</h2><p class="hint" style="margin:0">' + esc(p.note) + '</p>' + kpis(p, sm) + '<button class="btn pri" type="button" data-pick="' + i + '">이 안으로 설계</button></div>'; }).join('')
    + '</div><button class="btn block" id="all3" type="button">3가지 모두 저장해서 비교</button>' + disc();
  $$('[data-pick]', v).forEach(function (b) { b.addEventListener('click', function () { var p = PEND[+b.getAttribute('data-pick')]; addPlans([p], function () { PEND = null; toast('"' + p.name + '" 계획을 저장했어요.'); go('#/plan'); }); }); });
  $('#all3', v).addEventListener('click', function () { addPlans(PEND.slice(), function () { PEND = null; toast('3가지를 저장했어요.'); go('#/compare'); }); });
};
/* ---------- 타임라인 SVG ---------- */
function timeline(p, ev, opt) {
  opt = opt || {};
  var W0 = 720, L = 70, Rr = 30, top = 26, rowH = 34, gap = 10, rows = p.single ? 1 : 3, H = top + rows * (rowH + gap) + 26;
  var b = p.birthDate, endD = R.addMonths(b, 24), span = R.diffDays(b, endD);
  function X(d) { var t = R.diffDays(b, d); t = Math.max(0, Math.min(span, t)); return L + (W0 - L - Rr) * t / span; }
  var s = '<svg class="tl" viewBox="0 0 ' + W0 + ' ' + H + '" role="img" aria-labelledby="tl-t' + (opt.id || '') + '"><title id="tl-t' + (opt.id || '') + '">' + esc(timelineText(p, ev)) + '</title>';
  for (var m = 0; m <= 24; m += 3) { var x = X(R.addMonths(b, m)); s += '<line x1="' + x + '" y1="' + (top - 4) + '" x2="' + x + '" y2="' + (H - 22) + '" stroke="#E6E0D6"/><text x="' + x + '" y="' + (H - 6) + '" font-size="13" text-anchor="middle" fill="#4F5A5E">' + m + '개월</text>'; }
  var names = p.single ? [p.parents[0]] : [p.parents[0], p.parents[1], { label: '함께' }], cols = ['#5B7FD6', '#E0877A', '#8E6BBF'];
  names.forEach(function (q, i) {
    var y = top + i * (rowH + gap);
    s += '<text x="4" y="' + (y + rowH / 2 + 5) + '" font-size="15" font-weight="700" fill="#1F2A2E">' + esc(q.label.slice(0, 5)) + '</text><rect x="' + L + '" y="' + y + '" width="' + (W0 - L - Rr) + '" height="' + rowH + '" fill="#FAF7F2" rx="6"/>';
    if (i < 2) R.validBlocks(q).forEach(function (bk) { var x1 = X(bk.start), x2 = X(R.addDays(bk.end, 1)); if (x2 <= x1) return; s += '<rect x="' + x1 + '" y="' + (y + (bk.type === 'short' ? 6 : 0)) + '" width="' + Math.max(2, x2 - x1) + '" height="' + (bk.type === 'short' ? rowH - 12 : rowH) + '" rx="6" fill="' + cols[i] + '"' + (bk.type === 'short' ? ' stroke="#1F2A2E" stroke-dasharray="4 3"' : '') + '/>'; });
  });
  if (!p.single) {
    var y3 = top + 2 * (rowH + gap), A = R.validBlocks(p.parents[0]), B = R.validBlocks(p.parents[1]);
    A.forEach(function (a) { B.forEach(function (c) { var s1 = a.start > c.start ? a.start : c.start, e1 = a.end < c.end ? a.end : c.end; if (s1 <= e1) { var x1 = X(s1), x2 = X(R.addDays(e1, 1)); if (x2 > x1) s += '<rect x="' + x1 + '" y="' + y3 + '" width="' + (x2 - x1) + '" height="' + rowH + '" rx="6" fill="#8E6BBF"/>'; } }); });
  }
  var x18 = X(R.addDays(ev.deadline18, 1));
  s += '<line x1="' + x18 + '" y1="' + (top - 10) + '" x2="' + x18 + '" y2="' + (H - 22) + '" stroke="#D64545" stroke-width="3"/><text x="' + (x18 - 4) + '" y="' + (top - 12) + '" font-size="13" font-weight="700" text-anchor="end" fill="#B83232">생후 18개월 · 6+6 개시 마감</text>';
  return s + '</svg>';
}
function timelineText(p, ev) {
  return '휴직 타임라인. ' + p.parents.map(function (q, i) { if (i === 1 && p.single) return ''; var bl = R.validBlocks(q); return q.label + ': ' + (bl.length ? bl.map(function (b) { return b.start + '~' + b.end + (b.type === 'short' ? '(단기)' : ''); }).join(', ') : '휴직 없음'); }).join('. ') + '. 생후 18개월 마감 ' + ev.deadline18 + '.';
}
function legend(p) { return '<div class="legend" aria-hidden="true"><span><i style="background:#5B7FD6"></i>' + esc(p.parents[0].label) + '</span>' + (p.single ? '' : '<span><i style="background:#E0877A"></i>' + esc(p.parents[1].label) + '</span><span><i style="background:#8E6BBF"></i>함께 쉬는 기간</span>') + '<span><i style="background:#D64545"></i>생후 18개월선</span><span><i style="background:#fff;outline:2px dashed #1F2A2E;outline-offset:-2px"></i>단기 육아휴직</span></div>'; }
/* ---------- 설계 화면 ---------- */
var SCH = { ppt: '6+6', single: '한부모', general: '일반', over: '한도 초과' };
function payTab(p, sm) {
  var ev = sm.ev;
  return p.parents.map(function (q, i) {
    if (i === 1 && p.single) return '';
    var pr = ev.parents[i], head = '<h3 style="margin:14px 0 4px">' + who(q) + ' <span class="amt">' + R.won(pr.total) + '</span></h3>';
    if (!R.validBlocks(q).length) return head + '<p class="hint">휴직 블록이 없어요.</p>';
    if (!pr.payable) return head + '<p class="hint">' + (q.insured === 'employee' ? '통상임금이 비어 있어 계산하지 않았어요. <button class="btn ghost" type="button" data-act="wage">통상임금 넣기</button>' : insLabel(q.insured) + '라서 고용보험 육아휴직급여로 계산하지 않았어요.') + '</p>';
    return head + '<ul class="flist" id="flist-' + q.key + '">' + pr.rows.map(function (r, j) {
      var id = 'f-' + q.key + '-' + j;
      if (r.scheme === 'over') return '<li id="' + id + '"><span class="lab">' + r.k + '개월째 · 한도 초과</span><span class="formula"><span>' + r.portion + '개월</span><span>→ <b>0원</b></span><span>(최대 ' + ev.maxMonths + '개월 넘음)</span></span></li>';
      var base = q.wage * r.rate, how = r.floored ? '<span>→ 하한 ' + R.man(RJ.floor) + '</span>' : r.capped ? '<span>→ 상한 ' + R.man(r.cap) + '</span>' : '<span>(상한 ' + R.man(r.cap) + ' 이내)</span>';
      return '<li id="' + id + '"><span class="lab">' + r.k + '개월째 · ' + SCH[r.scheme] + '</span><span class="formula"><span>' + R.num(q.wage) + ' × ' + Math.round(r.rate * 100) + '%</span><span>= ' + R.num(base) + '</span>' + how + '<span>월 ' + R.num(r.monthly) + ' × ' + r.portion + '개월</span><span>= <b class="amt">' + R.won(Math.floor(r.amount)) + '</b></span></span></li>';
    }).join('') + '</ul>';
  }).join('') + '<p class="hint">개월수는 고용24 방식(달마다 해당 달 일수로 나눈 일할)으로 소수 셋째 자리까지 보여 줘요. 1원 미만은 버렸어요 <b class="lock">확인 필요</b>.</p>'
    + (ev.ppt ? '<p class="hint">6+6: 두 사람이 각자 생후 18개월 안에 시작한 첫 6개월 중 <b>짧은 쪽 ' + ev.N + '개월</b>까지 상향 상한(1개월 250만 → 6개월 450만)을 적용했어요.</p>' : '');
}
function chart(p, cf) {
  var W0 = 720, H = 260, L = 8, top = 24, bot = 34, n = cf.rows.length, bw = (W0 - L * 2) / n, max = Math.max(cf.base, cf.rows.reduce(function (a, r) { return Math.max(a, r.total); }, 0)) || 1;
  function Y(v) { return top + (H - top - bot) * (1 - v / max); }
  var s = '<svg class="chart" viewBox="0 0 ' + W0 + ' ' + H + '" role="img" aria-labelledby="ch-t"><title id="ch-t">월별 가구 수입 막대그래프. 가장 적은 달은 ' + cf.low.ym + ' ' + R.man(cf.low.total) + '.</title>';
  cf.rows.forEach(function (r, i) {
    var x = L + i * bw, lowR = r === cf.low, y = Y(r.total);
    s += '<rect x="' + (x + 2) + '" y="' + y + '" width="' + (bw - 4) + '" height="' + Math.max(1, H - bot - y) + '" rx="3" fill="' + (lowR ? '#D64545' : '#2F6F6A') + '"' + (lowR ? ' id="low-bar"' : '') + '/>';
    if (i % 3 === 0) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 14) + '" font-size="12" text-anchor="middle" fill="#4F5A5E">' + r.ym.slice(2).replace('-', '.') + '</text>';
    if (lowR) s += '<text x="' + Math.min(W0 - 60, Math.max(60, x + bw / 2)) + '" y="' + (y - 6) + '" font-size="14" font-weight="700" text-anchor="middle" fill="#B83232">최저 ' + R.man(r.total) + '</text>';
  });
  if (cf.base) s += '<line x1="' + L + '" x2="' + (W0 - L) + '" y1="' + Y(cf.base) + '" y2="' + Y(cf.base) + '" stroke="#1F2A2E" stroke-dasharray="6 4"/><text x="' + (W0 - L) + '" y="' + (Y(cf.base) - 5) + '" font-size="12" text-anchor="end" fill="#1F2A2E">평소 ' + R.man(cf.base) + '</text>';
  return s + '</svg>';
}
function cashTab(p, sm) {
  var cf = sm.cf;
  return '<div class="stats"><div class="stat wide"><span>가장 빠듯한 달 (' + cf.low.ym.replace('-', '년 ') + '월)</span><b id="low-amt">' + R.won(cf.low.total) + '</b></div><div class="stat"><span>평소 가구 수입</span><b>' + R.man(cf.base) + '</b></div><div class="stat"><span>줄어드는 폭</span><b>' + Math.round(cf.drop * 100) + '%</b></div></div>'
    + '<div class="chart-wrap" tabindex="0" role="group" aria-label="가구 수입 그래프, 옆으로 밀어 보기">' + chart(p, cf) + '</div>'
    + '<p class="hint">' + (cf.netGiven[0] || cf.netGiven[1] ? '실수령액을 넣은 사람은 실수령액으로, ' : '') + '안 넣은 사람은 통상임금(세전)으로 평소 수입을 잡았어요. 휴직한 날만큼 육아휴직급여로 바꿔 날짜 비율로 나눴어요. 6+6 차액은 실제로 나중에 한꺼번에 들어와요.</p>'
    + '<details><summary style="min-height:44px;font-weight:800;cursor:pointer">달마다 숫자로 보기</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">달</th><th scope="col" class="n">' + esc(p.parents[0].label) + '</th>' + (p.single ? '' : '<th scope="col" class="n">' + esc(p.parents[1].label) + '</th>') + '<th scope="col" class="n">합계</th></tr></thead><tbody>'
    + cf.rows.map(function (r) { return '<tr' + (r === cf.low ? ' style="background:#FBEAEA"' : '') + '><td class="nw">' + r.ym + '</td><td class="n">' + R.num(r.vals[0]) + '</td>' + (p.single ? '' : '<td class="n">' + R.num(r.vals[1]) + '</td>') + '<td class="n"><b>' + R.num(r.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div></details>';
}
function dlTab(p, sm) {
  var td = R.today(new Date());
  return '<ul class="dl-list">' + sm.dl.map(function (d) { return '<li><span class="d">' + R.fmtD(d.date) + (d.date < td ? ' <span class="tag">지남</span>' : '') + '</span><span>' + esc(d.title) + (d.verified === false ? ' <b class="lock">확인 필요</b>' : '') + '</span></li>'; }).join('') + '</ul>'
    + '<p class="hint">회사 신청은 휴직 시작 <b>30일 전까지</b>예요(조산·유산 등은 7일 전). 1350 상담 예시는 시작일 31일 전 신청을 안내하니 <b>하루 더 일찍</b> 내면 안전해요. 회사가 14일 안에 답하지 않으면 허용한 것으로 봐요. 생후 18개월 마감은 "출생일+18개월-1일"로 셌어요 <b class="lock">확인 필요</b>.</p>'
    + '<button class="btn block" type="button" data-act="ics">휴대폰 달력에 넣기(.ics)</button>';
}
function warnTab(p, sm) {
  var w = sm.ev.warns;
  if (!w.length) return '<div class="warn info" style="border-left-color:#3A9D6B"><b>경고가 없어요.</b> 그래도 회사·고용센터와 날짜를 한 번 더 확인하세요.</div>';
  var L = { red: '꼭 고치기', yellow: '확인', info: '알아 두기' };
  return w.map(function (x) { return '<div class="warn ' + (x.level === 'red' ? 'red' : x.level === 'info' ? 'info' : '') + '" data-code="' + x.code + '"><b>' + L[x.level] + '</b> ' + esc(x.text) + '</div>'; }).join('');
}
function blocksEditor(p) {
  return p.parents.map(function (q, i) {
    if (i === 1 && p.single) return '';
    if (q.insured === 'none' && !q.blocks.length) return '<div class="card"><h3 style="margin:0">' + who(q) + '</h3><p class="hint">고용보험 미가입이라 휴직 블록을 넣지 않았어요.</p></div>';
    return '<div class="card"><h3 style="margin:0 0 4px">' + who(q) + ' <span class="hint">(' + insLabel(q.insured) + ' · ' + calc(p).gap[i] + '개월)</span></h3>'
      + q.blocks.map(function (b, j) {
        var days = R.isD(b.start) && R.isD(b.end) ? R.diffDays(b.start, b.end) + 1 : 0;
        return '<div class="blk' + (i ? ' b' : '') + (b.type === 'short' ? ' short' : '') + '"><div class="row" style="justify-content:space-between"><b>' + (j + 1) + '번째 · ' + (b.type === 'short' ? '단기(1~2주)' : '육아휴직') + '</b><span class="hint num">' + days + '일</span></div>'
          + '<div class="dates"><div><label for="b-' + b.id + '-s">시작</label><input type="date" id="b-' + b.id + '-s" data-b="' + q.key + '|' + b.id + '|start" value="' + esc(b.start) + '"></div><div><label for="b-' + b.id + '-e">끝</label><input type="date" id="b-' + b.id + '-e" data-b="' + q.key + '|' + b.id + '|end" value="' + esc(b.end) + '"></div></div>'
          + '<button class="btn ghost" style="margin-top:8px;min-height:44px" type="button" data-del="' + q.key + '|' + b.id + '" aria-label="' + esc(q.label) + ' ' + (j + 1) + '번째 블록 지우기">지우기</button></div>';
      }).join('')
      + (q.blocks.length < 8 ? '<div class="row"><button class="btn grow" type="button" data-add="' + q.key + '|normal">+ 휴직 블록</button><button class="btn ghost grow" type="button" data-add="' + q.key + '|short">+ 단기 1주</button></div>' : '<p class="hint">블록은 8개까지 넣을 수 있어요.</p>') + '</div>';
  }).join('');
}
var PT = { pay: '월별 급여', cash: '가구 수입', dl: '마감일', warn: '경고' };
routes.plan = function (v, parts) {
  var p = active();
  if (!p) { v.innerHTML = '<h1>설계</h1><div class="card"><h2>아직 저장한 계획이 없어요</h2><p>출산(예정)일과 통상임금 4가지를 넣으면 추천 3가지를 만들어 드려요.</p><a class="btn pri block" href="#/start">4가지 넣고 시작</a></div>' + disc(); return; }
  var tab = PT[parts[0]] ? parts[0] : 'pay', sm = calc(p), ev = sm.ev, reds = sm.reds;
  var noWage = p.parents.some(function (q, i) { return !(i === 1 && p.single) && q.insured === 'employee' && !(q.wage > 0) && q.blocks.length; });
  v.innerHTML = '<h1>' + esc(p.name) + '</h1>' + exBanner()
    + (S.plans.length > 1 ? '<nav aria-label="저장한 계획" class="chips" style="margin-bottom:8px">' + S.plans.map(function (x) { return '<label class="chip"><input type="radio" name="pp" value="' + x.id + '"' + (x.id === p.id ? ' checked' : '') + '><span>' + esc(x.name) + '</span></label>'; }).join('') + '</nav>' : '')
    + (noWage ? '<div class="card warm" role="status"><b>통상임금이 비어 있어요.</b> 공유받은 링크에 월급이 빠져 있으면 급여가 0원으로 나와요. <button class="btn" type="button" data-act="wage" style="margin-top:8px">통상임금 넣기</button></div>' : '')
    + '<div class="two"><div class="g-sum">'
    + '<div class="stats"><div class="stat wide"><span>예상 육아휴직급여 합계</span><b id="sum-total">' + R.won(sm.total) + '</b></div>'
    + p.parents.map(function (q, i) { return (i === 1 && p.single) ? '' : '<div class="stat"><span>' + esc(q.label) + '</span><b id="sum-' + q.key + '">' + R.man(ev.parents[i].total) + '</b></div>'; }).join('')
    + '<div class="stat"><span>최대 기간</span><b>' + ev.maxMonths + '개월</b></div><div class="stat"><span>6+6</span><b>' + (ev.ppt ? ev.N + '개월' : '해당 없음') + '</b></div></div>'
    + (reds ? '<a class="warn red" style="display:block;color:inherit" href="#/plan/warn"><b>고칠 곳 ' + reds + '건</b> — 경고 탭에서 보기</a>' : '')
    + '<h2 style="margin-top:14px">타임라인 <span class="hint">(출생~24개월)</span></h2><div class="tl-wrap" tabindex="0" role="group" aria-label="타임라인, 옆으로 밀어 보기">' + timeline(p, ev) + '</div>' + legend(p)
    + '</div><div class="g-ed"><h2 style="margin-top:16px">휴직 블록 고치기</h2><p class="hint">날짜를 바꾸면 바로 다시 계산해요. 일반 휴직은 사람마다 네 구간(분할 3회)까지예요.</p>' + blocksEditor(p)
    + '<div class="row"><button class="btn ghost grow" type="button" data-act="wage">통상임금·이름 고치기</button><a class="btn ghost grow" href="#/start">처음부터 다시 추천</a></div>'
    + '</div><div class="g-res"><nav class="tabs2" id="tabs" aria-label="결과 보기" style="flex-wrap:wrap">' + Object.keys(PT).map(function (k) { return '<a href="#/plan/' + k + '"' + (k === tab ? ' aria-current="page"' : '') + ' style="flex:1 1 40%">' + PT[k] + (k === 'warn' && reds ? ' <span class="tag red">' + reds + '</span>' : '') + '</a>'; }).join('') + '</nav>'
    + '<section aria-label="' + PT[tab] + '" id="tabp">' + { pay: payTab, cash: cashTab, dl: dlTab, warn: warnTab }[tab](p, sm) + '</section>' + disc() + '</div></div>';
  if (parts[0]) v.setAttribute('data-scroll', 'tabs');
  function refresh(focusId) { var y = window.scrollY; CACHE = {}; save(); render(); window.scrollTo(0, y); var f = focusId && document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
  $$('input[name="pp"]', v).forEach(function (r) { r.addEventListener('change', function () { S.activePlanId = r.value; save(); render(); }); });
  $$('[data-b]', v).forEach(function (inp) { inp.addEventListener('change', function () {
    var a = inp.getAttribute('data-b').split('|'), q = p.parents[a[0] === 'B' ? 1 : 0], b = q.blocks.filter(function (x) { return x.id === a[1]; })[0]; if (!b) return;
    b[a[2]] = R.isD(inp.value) ? inp.value : '';
    if (a[2] === 'start' && b.type === 'short' && R.isD(b.start)) b.end = R.addDays(b.start, 6);
    refresh(inp.id);
  }); });
  $$('[data-del]', v).forEach(function (bt) { bt.addEventListener('click', function () { var a = bt.getAttribute('data-del').split('|'), q = p.parents[a[0] === 'B' ? 1 : 0]; q.blocks = q.blocks.filter(function (x) { return x.id !== a[1]; }); toast('블록을 지웠어요.'); refresh(); }); });
  $$('[data-add]', v).forEach(function (bt) { bt.addEventListener('click', function () {
    var a = bt.getAttribute('data-add').split('|'), q = p.parents[a[0] === 'B' ? 1 : 0], bl = R.validBlocks(q), last = bl.length ? R.addDays(bl[bl.length - 1].end, 1) : R.addMonths(p.birthDate, 3);
    if (a[1] === 'short' && last < RJ.shortLeave.since) last = RJ.shortLeave.since;
    var nb = { id: R.uid(), type: a[1], start: last, end: a[1] === 'short' ? R.addDays(last, 6) : R.addDays(R.addMonths(last, 1), -1) };
    q.blocks.push(nb); toast((a[1] === 'short' ? '단기 1주' : '1개월') + ' 블록을 더했어요. 날짜를 고쳐 주세요.'); refresh('b-' + nb.id + '-s');
  }); });
  $$('[data-act="wage"]', v).forEach(function (bt) { bt.addEventListener('click', function () { wageModal(p, refresh); }); });
  var ic = $('[data-act="ics"]', v); if (ic) ic.addEventListener('click', function () { icsDownload(p, sm); });
};
function wageModal(p, done) {
  openModal('<h2 id="mh">통상임금·이름 고치기</h2>' + p.parents.map(function (q, i) { if (i === 1 && p.single) return ''; return '<fieldset style="border:0;padding:0;margin:0 0 8px"><legend style="font-weight:800">' + esc(q.label) + '</legend><label class="f" for="m-l' + i + '">부를 이름</label><input type="text" id="m-l' + i + '" maxlength="12" value="' + esc(q.label) + '"><label class="f" for="m-w' + i + '">월 통상임금(세전)</label><input type="text" inputmode="numeric" id="m-w' + i + '" value="' + esc(wageText(q.wage)) + '" placeholder="예: 320만"><label class="f" for="m-n' + i + '">월 실수령액(선택)</label><input type="text" inputmode="numeric" id="m-n' + i + '" value="' + esc(wageText(q.net)) + '"></fieldset>'; }).join('')
    + '<p class="err" id="m-err" role="alert"></p><div class="row"><button class="btn ghost grow" type="button" data-dismiss="1">취소</button><button class="btn pri grow" type="button" id="m-ok">저장</button></div>', function (bg) {
    $('#m-ok', bg).addEventListener('click', function () {
      var ok = true, nx = [];
      p.parents.forEach(function (q, i) { if (i === 1 && p.single) return; var w = $('#m-w' + i, bg).value.trim(), n = $('#m-n' + i, bg).value.trim(), wv = w ? R.parseWon(w) : 0, nv = n ? R.parseWon(n) : 0; if (!(wv >= 0) || !(nv >= 0) || wv > 1e8 || nv > 1e8) ok = false; nx.push([q, wv, nv, $('#m-l' + i, bg).value.trim() || q.key]); });
      if (!ok) { $('#m-err', bg).textContent = '금액은 숫자로 적어 주세요. 예: 3,200,000 또는 320만'; return; }
      nx.forEach(function (x) { x[0].wage = x[1]; x[0].net = x[2]; x[0].label = x[3].slice(0, 12); });
      closeModal(); toast('저장하고 다시 계산했어요.'); done();
    });
  });
}
function icsDownload(p, sm) {
  var ev = sm.dl.filter(function (d) { return d.date >= R.today(new Date()); });
  if (!ev.length) { toast('앞으로 남은 마감일이 없어요.'); return; }
  download('yukhyu-deadlines.ics', new Blob([R.ics(ev)], { type: 'text/calendar;charset=utf-8' })); toast('마감일 ' + ev.length + '개를 달력 파일로 받았어요(7일 전 알림).');
}
/* ---------- 비교 ---------- */
routes.compare = function (v) {
  if (!S.plans.length) { v.innerHTML = '<h1>계획 비교</h1><div class="card"><h2>비교할 계획이 없어요</h2><p>추천 3가지를 모두 저장하면 나란히 비교할 수 있어요.</p><a class="btn pri block" href="#/start">4가지 넣고 시작</a></div>' + disc(); return; }
  var sms = S.plans.map(function (p) { return R.summary(p, RJ); }), best = Math.max.apply(null, sms.map(function (s) { return s.total; })), bestLow = Math.max.apply(null, sms.map(function (s) { return s.low.total; }));
  v.innerHTML = '<h1>계획 비교</h1>' + exBanner() + '<p class="hint">저장 칸은 3개예요. 새로고침해도 이 기기에 남아요.</p><div class="scroller" role="list">'
    + S.plans.map(function (p, i) { var sm = sms[i]; return '<div class="sc" role="listitem"' + (p.id === S.activePlanId ? ' aria-current="true"' : '') + '><h2>' + esc(p.name) + '</h2>' + (sm.total === best && S.plans.length > 1 ? '<span class="tag" style="background:#E2F2EA;color:#1F5A3C">급여 합계 최대</span>' : '') + (sm.low.total === bestLow && S.plans.length > 1 ? ' <span class="tag" style="background:#E4F0EE;color:#1E4E4A">가구 수입 가장 안정</span>' : '')
      + '<div style="margin:4px 0">' + timeline(p, sm.ev, { id: i }) + '</div>' + kpis(p, sm)
      + '<div class="row"><button class="btn pri grow" type="button" data-open="' + p.id + '">열기</button><button class="btn ghost grow" type="button" data-ren="' + p.id + '">이름</button><button class="btn danger grow" type="button" data-rm="' + p.id + '">지우기</button></div></div>'; }).join('')
    + '</div>' + (S.plans.length < 3 ? '<a class="btn block" href="#/start">계획 더 만들기 (' + S.plans.length + '/3)</a>' : '') + disc();
  $$('[data-open]', v).forEach(function (b) { b.addEventListener('click', function () { S.activePlanId = b.getAttribute('data-open'); save(); go('#/plan'); }); });
  $$('[data-rm]', v).forEach(function (b) { b.addEventListener('click', function () { var p = S.plans.filter(function (x) { return x.id === b.getAttribute('data-rm'); })[0]; confirmBox('"' + p.name + '" 계획을 지울까요?', '되돌릴 수 없어요.', '지우기', function () { S.plans = S.plans.filter(function (x) { return x !== p; }); if (S.activePlanId === p.id) S.activePlanId = S.plans[0] ? S.plans[0].id : ''; save(); toast('지웠어요.'); render(); }, true); }); });
  $$('[data-ren]', v).forEach(function (b) { b.addEventListener('click', function () { var p = S.plans.filter(function (x) { return x.id === b.getAttribute('data-ren'); })[0];
    openModal('<h2 id="mh">계획 이름 바꾸기</h2><label class="f" for="rn">이름</label><input type="text" id="rn" maxlength="40" value="' + esc(p.name) + '"><p class="err" id="rn-e" role="alert"></p><div class="row"><button class="btn ghost grow" type="button" data-dismiss="1">취소</button><button class="btn pri grow" type="button" id="rn-ok">저장</button></div>', function (bg) {
      $('#rn-ok', bg).addEventListener('click', function () { var n = $('#rn', bg).value.trim(); if (!n) { $('#rn-e', bg).textContent = '이름을 적어 주세요.'; return; } p.name = n.slice(0, 40); save(); closeModal(); render(); });
    }); }); });
};
/* ---------- 공유 링크 ---------- */
function streamBytes(bytes, T) { return new Response(new Blob([bytes]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
function encodeShare(p, withWage) {
  var raw = R.utf8(JSON.stringify(R.pack(p, withWage)));
  if (typeof CompressionStream === 'function') return streamBytes(raw, CompressionStream).then(function (z) { return 'z' + R.b64u(z); }, function () { return 'j' + R.b64u(raw); });
  return Promise.resolve('j' + R.b64u(raw));
}
function decodeShare(code) {
  return new Promise(function (ok, no) {
    try {
      var kind = code.charAt(0), bytes = R.unb64u(code.slice(1));
      var fin = function (b) { try { var o = R.unpack(JSON.parse(R.unutf8(b))); if (o) ok(o); else no(new Error('bad')); } catch (e) { no(e); } };
      if (kind === 'j') fin(bytes);
      else if (kind === 'z' && typeof DecompressionStream === 'function') streamBytes(bytes, DecompressionStream).then(fin, no);
      else no(new Error('kind'));
    } catch (e) { no(e); }
  });
}
function shareUrl(code) { return location.href.split('#')[0] + '#p=' + code; }
/* ---------- 출력 ---------- */
function agreeSheet(p, sm) {
  var ev = sm.ev, keyDl = sm.dl.filter(function (d) { return d.id === 'd18' || /^notice|^claimEnd/.test(d.id); }).slice(0, 9);
  return '<article class="agree" id="agree" aria-labelledby="ag-h"><h2 id="ag-h">부부 합의 한 장 — ' + esc(p.name) + '</h2>'
    + '<p class="hint" style="margin:0">출산(예정)일 ' + R.fmtD(p.birthDate) + ' · 규칙 기준일 ' + esc(RJ.baseDate) + ' · 만든 날 ' + R.today(new Date()) + '</p>'
    + '<div class="tl-wrap" tabindex="0" role="group" aria-label="타임라인, 옆으로 밀어 보기" style="margin:6px 0">' + timeline(p, ev, { id: 'p' }) + '</div>'
    + '<h3>누가, 언제</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">사람</th><th scope="col">기간</th><th scope="col" class="n">개월</th><th scope="col" class="n">예상 급여</th></tr></thead><tbody>'
    + p.parents.map(function (q, i) { if (i === 1 && p.single) return ''; var bl = R.validBlocks(q); return '<tr><td class="nw">' + esc(q.label) + '</td><td>' + (bl.length ? bl.map(function (b) { return '<span class="amt">' + R.fmtShort(b.start) + '~' + R.fmtShort(b.end) + '</span>' + (b.type === 'short' ? '(단기)' : ''); }).join(', ') : '없음') + '</td><td class="n">' + ev.parents[i].months + '</td><td class="n">' + R.man(ev.parents[i].total) + '</td></tr>'; }).join('')
    + '<tr><th scope="row" colspan="3">합계' + (ev.ppt ? ' (6+6 ' + ev.N + '개월)' : '') + '</th><td class="n"><b>' + R.man(sm.total) + '</b></td></tr></tbody></table></div>'
    + '<h3>가구 수입</h3><p>가장 빠듯한 달 <b>' + esc(sm.cf.low.ym) + ' ' + R.man(sm.cf.low.total) + '</b> (평소 ' + R.man(sm.cf.base) + ', ' + Math.round(sm.cf.drop * 100) + '% 감소)</p>'
    + '<h3>놓치면 안 되는 날</h3><ul style="margin:0;padding-left:18px">' + keyDl.map(function (d) { return '<li><b class="amt">' + R.fmtD(d.date) + '</b> ' + esc(d.title) + '</li>'; }).join('') + '</ul>'
    + (sm.reds ? '<p><b style="color:#B83232">고칠 곳 ' + sm.reds + '건이 남아 있어요.</b></p>' : '')
    + '<p style="font-size:9pt">' + esc(RJ.disclaimer) + ' 실제 지급·자격은 고용센터가 결정해요. 문의: 고용24(work24.go.kr) · 1350</p>'
    + '<div class="sign"><div>' + esc(p.parents[0].label) + ' 서명</div>' + (p.single ? '' : '<div>' + esc(p.parents[1].label) + ' 서명</div>') + '</div></article>';
}
routes.out = function (v) {
  var p = active();
  if (!p) { v.innerHTML = '<h1>출력·공유</h1><div class="card"><h2>출력할 계획이 없어요</h2><p>계획을 먼저 만들어 주세요.</p><a class="btn pri block" href="#/start">4가지 넣고 시작</a></div>' + disc(); return; }
  var sm = calc(p);
  v.innerHTML = '<h1>출력·공유</h1>' + exBanner()
    + '<div class="card"><h2>배우자에게 링크로 보내기</h2><div class="warnbox" role="note"><b>링크 안에 계획 내용이 그대로 들어 있어요.</b> 서버에 저장하지 않는 대신, 링크를 받은 사람은 누구나 열어 볼 수 있어요. 통상임금을 넣으면 <b>월급이 링크에 담겨</b> 메신저 기록·미리보기에 남을 수 있어요.</div>'
    + '<label class="chip" style="margin-top:12px"><input type="checkbox" id="sw"><span>통상임금·실수령액도 함께 넣기(민감 정보)</span></label>'
    + '<p class="hint" id="sw-h">기본은 <b>월급 빼고</b> 날짜만 보내요. 받는 사람이 자기 월급을 직접 넣어요.</p>'
    + '<button class="btn pri block" type="button" id="mk">공유 링크 만들기</button><div id="lk" hidden><p class="link-out" id="lk-t"></p><div class="row"><button class="btn grow" type="button" id="cp">링크 복사</button>' + (navigator.share ? '<button class="btn ghost grow" type="button" id="sh">다른 앱으로 보내기</button>' : '') + '</div></div></div>'
    + '<div class="card"><h2>부부 합의 한 장(A4)</h2><p class="hint">아래 미리보기를 A4 한 장으로 인쇄하거나 PDF로 저장해요.</p><div class="row"><button class="btn pri grow" type="button" id="pr">인쇄 / PDF 저장</button><button class="btn grow" type="button" id="ic">마감일 달력(.ics)</button></div></div>'
    + '<div class="card warm"><span class="prem">프리미엄 미리보기</span><p style="margin:6px 0 0">회사 제출용 육아휴직 신청서 초안, 분기별 다시 계산 알림은 준비 중이에요. 지금은 무료 기능만 있어요.</p></div>'
    + agreeSheet(p, sm) + disc();
  var sw = $('#sw', v);
  sw.addEventListener('change', function () { $('#sw-h', v).innerHTML = sw.checked ? '<b style="color:#B83232">월급이 링크에 들어가요.</b> 믿을 수 있는 배우자에게만 1:1로 보내세요.' : '기본은 <b>월급 빼고</b> 날짜만 보내요. 받는 사람이 자기 월급을 직접 넣어요.'; $('#lk', v).hidden = true; });
  $('#mk', v).addEventListener('click', function () { encodeShare(p, sw.checked).then(function (code) { var u = shareUrl(code); $('#lk-t', v).textContent = u; $('#lk', v).hidden = false; $('#lk', v).setAttribute('data-url', u); toast(sw.checked ? '월급 포함 링크를 만들었어요.' : '월급 뺀 링크를 만들었어요.'); }); });
  $('#cp', v).addEventListener('click', function () { copyText($('#lk', v).getAttribute('data-url'), '공유 링크'); });
  var sh = $('#sh', v); if (sh) sh.addEventListener('click', function () { navigator.share({ title: APP, url: $('#lk', v).getAttribute('data-url') }).catch(function () {}); });
  $('#pr', v).addEventListener('click', function () { window.print(); });
  $('#ic', v).addEventListener('click', function () { icsDownload(p, sm); });
};
/* ---------- 공유 받기 ---------- */
routes.imp = function (v, parts) {
  v.innerHTML = '<h1>공유받은 계획</h1><p class="hint" role="status">링크를 여는 중…</p>';
  decodeShare(parts[0] || '').then(function (p) {
    if (location.hash.slice(1, 3) !== 'p=') return;
    IMP = p; var sm = R.summary(p, RJ);
    v.innerHTML = '<h1>공유받은 계획</h1><p>배우자가 보낸 <b>' + esc(p.name) + '</b> 계획이에요. ' + (p.hasWage ? '월급이 들어 있어요.' : '<b>월급은 빠져 있어요.</b> 아래에 넣으면 급여를 계산해요(선택).') + '</p>'
      + '<div class="tl-wrap" tabindex="0" role="group" aria-label="타임라인, 옆으로 밀어 보기">' + timeline(p, sm.ev) + '</div>' + legend(p)
      + (p.hasWage ? kpis(p, sm) : p.parents.map(function (q, i) { if (i === 1 && p.single) return ''; return '<label class="f" for="iw' + i + '">' + esc(q.label) + ' 월 통상임금(선택)</label><input type="text" inputmode="numeric" id="iw' + i + '" placeholder="예: 320만">'; }).join('') + '<p class="err" id="iw-e" role="alert"></p>')
      + '<button class="btn pri block big" type="button" id="isv" style="margin-top:12px">내 기기에 저장하고 열기</button><a class="btn ghost block" href="#/" style="margin-top:8px">저장하지 않고 닫기</a>' + disc();
    document.title = R.pageTitle('공유받은 계획', APP);
    $('#isv', v).addEventListener('click', function () {
      if (!p.hasWage) { var bad = false; p.parents.forEach(function (q, i) { var el = $('#iw' + i, v); if (!el) return; var t = el.value.trim(); if (!t) return; var n = R.parseWon(t); if (!(n > 0) || n > 1e8) bad = true; else q.wage = n; }); if (bad) { $('#iw-e', v).textContent = '금액은 숫자로 적어 주세요. 예: 3,200,000 또는 320만'; return; } }
      addPlans([p], function () { S.settings.onboarded = true; save(); IMP = null; toast('공유받은 계획을 저장했어요.'); history.replaceState(null, '', location.pathname + location.search + '#/plan'); render(); });
    });
  }, function () {
    v.innerHTML = '<h1>링크를 열 수 없어요</h1><div class="card danger" role="alert"><p>링크가 잘렸거나 다른 앱의 링크예요. 보낸 사람에게 링크 전체를 다시 복사해 달라고 하세요.</p><a class="btn block" href="#/">처음 화면으로</a></div>' + disc();
    document.title = R.pageTitle('링크를 열 수 없어요', APP);
  });
};
/* ---------- 도움말 ---------- */
routes.help = function (v) {
  var g = RJ.general, pt = RJ.parentsTogether;
  v.innerHTML = '<h1>도움말·근거</h1>'
    + '<div class="card"><h2>이 앱이 쓰는 규칙 (기준일 ' + esc(RJ.baseDate) + ')</h2><ul style="padding-left:20px;margin:0">'
    + '<li>일반 육아휴직급여: 1~3개월 통상임금 100%(상한 ' + R.man(g[0].cap) + '), 4~6개월 100%(상한 ' + R.man(g[1].cap) + '), 7개월~ 80%(상한 ' + R.man(g[2].cap) + '), 하한 ' + R.man(RJ.floor) + '</li>'
    + '<li>부모함께 육아휴직제(6+6): 두 사람 모두 고용보험 근로자이고 생후 18개월 안에 시작하면, 첫 6개월 중 함께 쓴 개월수까지 1~6개월째 상한 ' + pt.caps.map(function (x) { return R.man(x); }).join('·') + '(100%)</li>'
    + '<li>한부모: 1~3개월 상한 ' + R.man(RJ.singleParent[0].cap) + '</li>'
    + '<li>기간: 1년, 부모 각각 3개월 이상 쓰면 각자 1년 6개월(한부모·장애아동 부모도 1년 6개월)</li>'
    + '<li>분할: 3회까지(네 구간). 임신 중 육아휴직·단기 육아휴직은 횟수에서 빠져요</li>'
    + '<li>단기 육아휴직: ' + RJ.shortLeave.since + '부터 1주 또는 2주, 자녀 1명당 연 1회, 기간에는 포함</li>'
    + '<li>신청: 회사에 개시 30일 전까지, 급여는 개시 1개월 후부터 종료 후 12개월 안에 고용24에서</li>'
    + '<li>공무원·교원은 고용보험 대상이 아니라 별도 수당이에요(이 앱은 계산하지 않아요)</li></ul></div>'
    + '<div class="card"><h2>원문 출처</h2><p class="hint">' + esc(RJ.lawAsOf) + '</p><ul style="padding-left:20px;margin:0">' + RJ.sources.map(function (s) { return '<li>' + src(s.id) + '</li>'; }).join('') + '</ul></div>'
    + '<div class="card warm"><h2>확인 필요</h2><p class="hint">원문에서 정확한 계산법을 찾지 못해 앱이 가정한 부분이에요.</p><ul style="padding-left:20px;margin:0" id="unv">' + RJ.unverified.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'
    + '<div class="card"><h2>개인정보</h2><p>입력한 내용은 이 기기 브라우저(localStorage, 키 <code>yukhyu.v1</code>)에만 저장돼요. 서버로 보내지 않아요. 공유 링크는 내용이 링크 안에 들어 있어요. <a href="privacy.html">개인정보 안내</a></p>'
    + '<div class="row"><button class="btn ghost grow" type="button" id="st">계산 자체 점검</button><button class="btn danger grow" type="button" id="wipe">모두 지우기</button></div><p class="hint" id="st-out" role="status"></p></div>'
    + '<div class="card"><h2>더 읽기</h2><ul style="padding-left:20px;margin:0"><li><a href="parental-leave-6plus6-calculator/">6+6 부모함께 육아휴직 급여 계산법</a></li><li><a href="parental-leave-18-months-extension/">육아휴직 1년 6개월 연장 조건</a></li><li><a href="parental-leave-application-deadline/">육아휴직 신청 마감일 정리</a></li></ul></div>' + disc();
  $('#st', v).addEventListener('click', function () { var r = R.selfTest(RJ); $('#st-out', v).textContent = '자체 점검 ' + r.pass + '/' + r.total + ' 통과' + (r.fail ? ' — 실패: ' + r.results.filter(function (x) { return !x.pass; }).map(function (x) { return x.name; }).join(', ') : ''); });
  $('#wipe', v).addEventListener('click', function () { confirmBox('전부 지울까요?', '저장한 계획 3개까지 모두 지워져요. 되돌릴 수 없어요.', '전체 지우기', function () { S = blank(); try { localStorage.removeItem(KEY); } catch (e) {} PEND = null; toast('모두 지웠어요.'); go('#/'); }, true); });
};
/* ---------- 시작 ---------- */
function boot() {
  load();
  fetch('rules-2026.json').then(function (r) { if (!r.ok) throw new Error('rules'); return r.json(); }).then(function (j) {
    RJ = j;
    if (flags.storageError) toast('이 브라우저는 저장이 막혀 있어요. 닫으면 내용이 사라져요.');
    window.addEventListener('hashchange', render); render();
    window.runSelfTest = function () { return R.selfTest(RJ); };
  }).catch(function () {
    $('#view').innerHTML = '<h1>규칙 자료를 불러오지 못했어요</h1><div class="card danger" role="alert"><p>인터넷 연결을 확인하고 다시 열어 주세요. 한 번 연 뒤에는 오프라인에서도 열려요.</p><button class="btn block" type="button" id="rl">다시 열기</button></div>';
    $('#rl').addEventListener('click', function () { location.reload(); });
    document.title = R.pageTitle('규칙 자료를 불러오지 못했어요', APP);
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
}
window.__yk = { state: function () { return S; }, encode: encodeShare };
boot();
})();
