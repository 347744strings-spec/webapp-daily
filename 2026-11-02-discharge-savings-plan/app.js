/* 전역 목돈 설계도 — app.js (빌드: _build/discharge/p1~p3.js 이어붙임) */
(function () {
'use strict';
var R = window.SavRules, APP = '전역 목돈 설계도', KEY = 'jeonyeok-plan-v1';
var RJ, PAY, H, S, VIEW = null, flags = { bad: false, noStore: false };
function $(s, e) { return (e || document).querySelector(s); }
function $$(s, e) { return [].slice.call((e || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function A(n) { return '<span class="amt">' + R.won(n) + '</span>'; }
function T() { return R.today(window.__TODAY ? new Date(window.__TODAY) : new Date()); }
function load() {
  S = { plan: null, ex: false, draft: {} }; var raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { flags.noStore = true; return; }
  if (!raw) return;
  try { var o = JSON.parse(raw); if (o.plan) S.plan = R.clean(o.plan, RJ); S.ex = !!o.ex; S.draft = o.draft && typeof o.draft === 'object' ? o.draft : {}; }
  catch (e) { flags.bad = true; try { localStorage.removeItem(KEY); } catch (e2) {} }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (!flags.noStore) { flags.noStore = true; toast('저장이 막혀 있어요. 창을 닫으면 사라져요.'); } } }
var tt; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 3000); }
var lastF;
function modal(html, ready) {
  lastF = document.activeElement; var r = $('#modal-root');
  r.innerHTML = '<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh">' + html + '</div></div>';
  var bg = r.firstChild;
  bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-x]')) close(); });
  bg.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); if (e.key === 'Tab') { var f = $$('button,a[href],input', bg); if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } } });
  var h = $('#mh', bg); h.tabIndex = -1; h.focus(); if (ready) ready(bg);
}
function close() { $('#modal-root').innerHTML = ''; if (lastF && document.body.contains(lastF)) lastF.focus(); }
function confirmBox(title, body, ok, cb) { modal('<h2 id="mh">' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="row"><button class="btn ghost grow" data-x="1" type="button">취소</button><button class="btn pri grow" id="mok" type="button">' + esc(ok) + '</button></div>', function (bg) { $('#mok', bg).onclick = function () { close(); cb(); }; }); }
function chips(name, list, cur) { return '<div class="chips" role="radiogroup">' + list.map(function (o) { return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(o.id) + '"' + (o.id === cur ? ' checked' : '') + '><span>' + esc(o.label) + '</span></label>'; }).join('') + '</div>'; }
function val(n, e) { var x = $('input[name="' + n + '"]:checked', e); return x ? x.value : ''; }
function src(id) { var s = RJ.sources.filter(function (x) { return x.id === id; })[0]; return s ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '<span class="sr"> (새 창)</span></a>' + (s.verified ? '' : ' <b class="tag uv">확인 필요</b>') : ''; }
function disc() { return '<div class="disc" data-disc="1"><p style="margin:0"><b>' + esc(RJ.disclaimer) + '</b> 규칙 기준일 <b class="num">' + RJ.baseDate + '</b>.</p><a href="#/about">기준·출처</a><a href="https://www.mnd.go.kr/mnd/288/subview.do" target="_blank" rel="noopener noreferrer">국방부 안내<span class="sr"> (새 창)</span></a></div>'; }
function exBanner() { return S.ex ? '<div class="card"><span class="tag ex">예시</span> 예시 계획이에요(가상의 육군 이병). <button class="btn ghost" type="button" data-act="clr" style="margin-top:6px">예시 지우고 내 계획 만들기</button></div>' : ''; }
/* 라우터 */
var routes = {}, TAB = { plan: 'plan', share: 'plan', check: 'check', bucket: 'bucket', about: 'about' };
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  var h = location.hash.slice(1) || '/', name, parts;
  if (/^s=/.test(h)) { name = 'view'; parts = [h.slice(2)]; } else { parts = h.split('/').filter(Boolean); name = parts[0] || 'home'; parts = parts.slice(1); }
  if (!routes[name]) name = 'home';
  if (name === 'home' && S.plan) name = 'plan';
  var ae = document.activeElement; if (ae && ae !== document.body && $('#view').contains(ae) && ae.blur) ae.blur();
  var old = $('#view'), v = old.cloneNode(false); old.parentNode.replaceChild(v, old);
  v.addEventListener('click', function (e) { var b = e.target.closest('[data-act="clr"]'); if (b) confirmBox('예시를 지울까요?', '예시 계획을 지우고 처음 질문으로 가요.', '지우기', function () { S = { plan: null, ex: false, draft: {} }; save(); go('#/w/1'); }); });
  try { routes[name](v, parts); } catch (err) { v.innerHTML = '<h1>화면을 그리지 못했어요</h1><div class="card bad" role="alert"><p>입력한 날짜가 예상과 달라요. 다시 설계해 주세요.</p><a class="btn block" href="#/w/1">다시 설계</a></div>'; if (console && console.warn) console.warn(err); }
  $('#tabbar').hidden = !S.plan || name === 'view' || name === 'w';
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === TAB[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (flags.bad) { var n = document.createElement('div'); n.className = 'card bad'; n.setAttribute('role', 'alert'); n.textContent = '저장된 계획을 읽을 수 없어 비웠어요. 다시 설계해 주세요.'; v.insertBefore(n, v.children[1] || null); flags.bad = false; }
  var h1 = $('h1', v); document.title = R.pageTitle(h1 ? h1.textContent : '', APP);
  if (h1 && !render.first) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  render.first = false; window.scrollTo(0, 0);
}
render.first = true;
function exampleDraft() { return { branch: 'army', enlist: '2026-09-01', fixed: [{ n: '휴대폰 요금', a: 60000 }, { n: 'PX', a: 50000 }, { n: '기타', a: 0 }], leave: 40000, lastMonth: true }; }
function makePlan(d) {
  var p = R.clean({ branch: d.branch, months: d.months, enlist: d.enlist, discharge: d.discharge, fixed: d.fixed, leave: d.leave, old: d.old, join: d.join, lastMonth: d.lastMonth }, RJ);
  p.limit = d.old && d.cur ? d.cur : R.recommend(p, RJ, PAY); p.banks = R.defaultBanks(p.limit, RJ);
  p.bucket = [{ n: '비상금', a: 0 }, { n: '복학·재수', a: 0 }, { n: '자격증', a: 0 }, { n: '여행', a: 0 }, { n: '장기저축', a: 0 }];
  return p;
}
routes.home = function (v) {
  var ex = makePlan(exampleDraft()), pl = R.plan(ex, RJ, PAY, H, T());
  v.innerHTML = '<h1>' + APP + '</h1><p style="font-size:19px"><b>한 번 정하면 못 바꾸는 적금 한도</b>, 내 월급 흐름으로 3분 만에 안전하게 정해요.</p>'
    + '<div class="card ol"><span class="tag ex">예시</span> 육군 2026-09-01 입대 · 지출 월 15만 원 · 전역 달까지 18회 납입<div class="kv" style="margin-top:6px"><div><span>추천 한도</span><b id="ex-rec">월 ' + R.man(pl.rec) + '</b></div><div><span>전역 때 받을 돈</span><b>' + R.won(pl.mat.total) + '</b></div><div><span>매칭 입금일</span><b>' + R.fmtD(pl.match.date) + '</b></div></div></div>'
    + '<a class="btn pri block" href="#/w/1" style="min-height:58px;font-size:19px">3분 만에 한도 정하기</a><div class="row"><a class="btn grow" href="#/w/1?old">이미 가입했어요</a><button class="btn ghost grow" type="button" id="exb">예시로 둘러보기</button></div>'
    + '<p class="hint">로그인·서버 없음 · 한 번 열면 오프라인에서도 열려요 · 사지방 PC도 OK</p>' + disc();
  $('#exb', v).onclick = function () { S.plan = makePlan(exampleDraft()); S.ex = true; save(); toast('예시 계획을 불러왔어요.'); go('#/plan'); };
};
/* 위저드 */
routes.w = function (v, parts) {
  var step = Math.max(1, Math.min(4, +String(parts[0] || '1').split('?')[0] || 1)), d = S.draft;
  if (/\?old/.test(location.hash)) d.old = true;
  if (!d.fixed) d.fixed = [{ n: '휴대폰 요금', a: 0 }, { n: 'PX', a: 0 }, { n: '기타', a: 0 }];
  var Q = ['복무 구분', '입대일', '한 달 고정지출', '휴가·외출 비용'], body = '';
  if (step === 1) body = '<fieldset style="border:0;padding:0;margin:0"><legend class="f" style="font-weight:800">어디에서 복무하나요?</legend>' + chips('br', RJ.branches.map(function (b) { return { id: b.id, label: b.label + ' ' + b.months + '개월' + (b.id === 'alt' ? '(직접)' : '') }; }), d.branch || 'army') + '</fieldset>'
    + '<div id="altw" hidden><label class="f" for="mo">복무 개월수</label><input type="number" id="mo" inputmode="numeric" min="1" max="48" value="' + esc(d.months || 36) + '"><p class="hint">적금은 최대 24개월까지 넣어요.</p></div>'
    + (d.old ? '<div class="card ol"><b>이미 가입했어요 모드</b><label class="f" for="cur">지금 월 한도(합계)</label><input type="text" id="cur" inputmode="numeric" placeholder="예: 40만" value="' + (d.cur ? R.num(d.cur) : '') + '"><label class="f" for="jd">가입일</label><input type="date" id="jd" value="' + esc(d.join || '') + '"><p class="err" id="e-cur"></p></div>' : '');
  if (step === 2) { var b = R.branch(RJ, d.branch); body = '<label class="f" for="en">입대일(소집일)</label><input type="date" id="en" value="' + esc(d.enlist || '') + '" aria-describedby="e-en"><p class="err" id="e-en" role="alert"></p><label class="f" for="dis">전역(소집해제) 예정일 <span class="hint">자동 계산, 고칠 수 있어요</span></label><input type="date" id="dis" value="' + esc(d.discharge || '') + '"><p class="hint">' + esc(b.label) + ' ' + (d.months || b.months) + '개월 기준: 입대일 + 개월수 − 1일</p>'; }
  if (step === 3) body = '<p class="hint">모르면 비워 두세요. 매달 꼭 나가는 돈만 적어요.</p>' + d.fixed.map(function (x, i) { return '<label class="f" for="fx' + i + '">' + esc(x.n) + '</label><input type="text" id="fx' + i + '" inputmode="numeric" placeholder="예: 5만" value="' + (x.a ? R.num(x.a) : '') + '"><p class="err" id="e-fx' + i + '"></p>'; }).join('');
  if (step === 4) body = '<label class="f" for="lv">휴가·외출 비용(한 달 평균)</label><input type="text" id="lv" inputmode="numeric" placeholder="예: 7만" value="' + (d.leave ? R.num(d.leave) : '') + '"><p class="err" id="e-lv"></p><p class="hint">교통비·식비 등. 1년에 몇 번 나가는지 생각해 12로 나눠 보세요.</p>';
  v.innerHTML = '<h1>' + step + '/4 ' + Q[step - 1] + '</h1><div class="prog" role="progressbar" aria-label="진행" aria-valuemin="1" aria-valuemax="4" aria-valuenow="' + step + '"><i style="width:' + step * 25 + '%"></i></div><form id="f" novalidate class="card">' + body
    + '<div class="row" style="margin-top:14px">' + (step > 1 ? '<a class="btn ghost grow" href="#/w/' + (step - 1) + '">이전</a>' : '') + '<button class="btn pri grow" type="submit">' + (step < 4 ? '다음' : '결과 보기') + '</button></div></form>' + disc();
  var f = $('#f', v);
  if (step === 1) { var sy = function () { $('#altw', f).hidden = val('br', f) !== 'alt'; }; f.addEventListener('change', sy); sy(); }
  if (step === 2) $('#en', f).addEventListener('change', function () { var e = $('#en', f).value, b = R.branch(RJ, d.branch); if (R.isD(e)) $('#dis', f).value = R.dischargeOf(e, b.id === 'alt' ? (d.months || 36) : b.months); });
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var bad = null; $$('.err', f).forEach(function (x) { x.textContent = ''; }); $$('[aria-invalid]', f).forEach(function (x) { x.removeAttribute('aria-invalid'); });
    function err(id, m) { $('#e-' + id, f).textContent = m; var i = $('#' + id, f); if (i) i.setAttribute('aria-invalid', 'true'); bad = bad || i; }
    function money(id) { var t = $('#' + id, f).value.trim(); if (!t) return 0; var n = R.parseWon(t); if (!(n >= 0) || n > 5e6) { err(id, '숫자로 적어 주세요. 예: 50000 또는 5만'); return 0; } return n; }
    if (step === 1) { d.branch = val('br', f) || 'army'; if (d.branch === 'alt') d.months = Math.max(1, Math.min(48, +$('#mo', f).value || 36)); else delete d.months; d.discharge = '';
      if (d.old) { var c = R.parseWon($('#cur', f).value); if (!(c > 0) || c > RJ.personMax || c % RJ.unit) err('cur', '5만 원 단위, 55만 원 이하로 적어 주세요.'); else d.cur = c; d.join = $('#jd', f).value || ''; } }
    if (step === 2) { var en = $('#en', f).value, ds = $('#dis', f).value; if (!R.isD(en)) err('en', '입대일을 골라 주세요.'); else if (en < '2024-01-01' || en > R.addMonths(RJ.baseDate, 24)) err('en', '2024-01-01부터 ' + R.addMonths(RJ.baseDate, 24) + ' 사이만 계산해요.'); else if (!R.isD(ds) || ds <= en) err('en', '전역 예정일이 입대일보다 뒤여야 해요.'); d.enlist = en; d.discharge = ds; }
    if (step === 3) d.fixed.forEach(function (x, i) { x.a = money('fx' + i); });
    if (step === 4) d.leave = money('lv');
    if (bad) { bad.focus(); return; }
    save();
    if (step < 4) { go('#/w/' + (step + 1)); return; }
    if (!R.isD(d.enlist)) { go('#/w/2'); return; }
    S.plan = makePlan(d); S.ex = false; save(); toast('추천 한도: 월 ' + R.man(S.plan.limit)); go('#/plan');
  });
};
/* 막대그래프 */
function chart(flow) {
  var bw = 34, W = Math.max(320, flow.length * bw + 16), Hh = 220, top = 22, bot = 40, max = Math.max.apply(null, flow.map(function (r) { return Math.abs(r.surplus); }).concat([1]));
  var zero = top + (Hh - top - bot) * (max / (2 * max)), sc = (Hh - top - bot) / (2 * max);
  var s = '<svg class="chart" width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-labelledby="ch-t"><title id="ch-t">월별 잉여 막대그래프. 적자 달 ' + flow.filter(function (r) { return r.surplus < 0; }).length + '개.</title>';
  s += '<line x1="0" x2="' + W + '" y1="' + zero + '" y2="' + zero + '" stroke="currentColor" stroke-opacity=".5"/>';
  flow.forEach(function (r, i) {
    var x = 8 + i * bw, h = Math.max(1, Math.abs(r.surplus) * sc), neg = r.surplus < 0, y = neg ? zero : zero - h;
    s += '<rect x="' + (x + 4) + '" y="' + y + '" width="' + (bw - 8) + '" height="' + h + '" rx="3" fill="' + (neg ? '#C8442E' : '#2E7D5B') + '"' + (r.assumed ? ' fill-opacity=".6"' : '') + ' data-ym="' + r.ym + '"' + (neg ? ' data-neg="1"' : '') + '/>';
    s += '<text x="' + (x + bw / 2) + '" y="' + (Hh - 22) + '" font-size="11" text-anchor="middle" fill="currentColor">' + r.ym.slice(2).replace('-', '.') + '</text>';
    if (neg) s += '<text x="' + (x + bw / 2) + '" y="' + (Math.min(Hh - 44, y + h + 12)) + '" font-size="10" font-weight="700" text-anchor="middle" fill="#C8442E">-' + Math.round(-r.surplus / 1e4) + '만</text>';
  });
  return s + '</svg>';
}
function matCard(p, pl) {
  var m = pl.mat, n = m.n, banks = p.banks.length ? p.banks : [{ name: '', limit: p.limit, rate: RJ.defaultRate }];
  return '<div class="card" id="mat"><h2>전역 때 받을 돈</h2><div class="big" id="total">' + R.won(m.total) + '</div>'
    + '<div class="kv"><div><span>원금</span><b id="m-pr">' + R.won(m.principal) + '</b></div><div><span>은행 이자(비과세)</span><b id="m-in">' + R.won(m.interest) + '</b></div><div><span>매칭지원금</span><b id="m-ma" style="color:var(--gold-t)">' + R.won(m.matching) + '</b></div><div><span>비과세로 아낀 세금(참고)</span><b>' + R.won(m.taxSaved) + '</b></div></div>'
    + '<details style="margin-top:6px"><summary style="min-height:44px;font-weight:800;cursor:pointer">계산식 보기</summary><ul style="list-style:none;padding:0;margin:0" id="fx">'
    + '<li class="formula" id="f-pr"><span>원금 = 월 ' + R.num(p.limit) + '</span><span>× ' + n + '개월</span><span>= <b>' + R.won(m.principal) + '</b></span></li>'
    + banks.map(function (b, i) { return '<li class="formula" id="f-in' + i + '"><span>이자' + (b.name ? '(' + esc(b.name) + ')' : '') + ' = ' + R.num(b.limit) + ' × ' + (b.rate * 100).toFixed(1) + '% ÷ 12</span><span>× (' + n + '+…+1 = ' + n * (n + 1) / 2 + ')</span><span>= <b>' + R.won(Math.floor(b.limit * b.rate / 12 * n * (n + 1) / 2)) + '</b></span></li>'; }).join('')
    + '<li class="formula" id="f-ma"><span>매칭 = 2024년 이후 입금 원금</span><span>× 100%</span><span>= <b>' + R.won(m.matching) + '</b></span></li>'
    + '<li class="formula" id="f-tx"><span>아낀 세금 = 이자 ' + R.num(m.interest) + '</span><span>× 15.4%</span><span>= <b>' + R.won(m.taxSaved) + '</b></span></li></ul>'
    + '<p class="hint">이자는 KorCalc·국방부 예시와 같은 월 단리 근사예요. 실제는 입금일별 일수로 계산해 조금 달라요 <b class="tag uv">확인 필요</b></p></details></div>';
}
routes.plan = function (v) {
  var p = S.plan; if (!p) { v.innerHTML = '<h1>내 설계</h1><div class="card"><h2>아직 설계가 없어요</h2><p>질문 4개에 답하면 안전한 한도를 추천해요.</p><a class="btn pri block" href="#/w/1">3분 만에 시작</a></div>' + disc(); return; }
  var pl = R.plan(p, RJ, PAY, H, T()), md = pl.match;
  var reds = pl.warns.filter(function (w) { return w.level === 'red'; });
  v.innerHTML = '<h1>내 전역 목돈 설계</h1>' + exBanner() + '<div class="two"><div>' + matCard(p, pl)
    + '<div class="card ' + (pl.deficits ? 'bad' : 'ol') + '" id="limcard"><h2>월 한도 <span class="amt" id="lim">' + R.man(p.limit) + '</span>' + (!p.old && p.join >= RJ.noChangeSince ? ' <span class="tag red">중도 변경 불가</span>' : '') + '</h2>'
    + '<p style="margin:0" id="rec">추천: <b>월 ' + R.man(pl.rec) + '</b>까지는 모든 달 흑자예요.</p>'
    + '<label class="f" for="sl">한도 바꿔 보기 (5만 원 단위)</label><input type="range" id="sl" min="0" max="' + RJ.personMax + '" step="' + RJ.unit + '" value="' + p.limit + '" aria-valuetext="월 ' + R.man(p.limit) + '">'
    + '<p id="defmsg" role="status" style="font-weight:800;margin:4px 0">' + (pl.deficits ? '적자 달 ' + pl.deficits + '번 · 가장 부족한 달(' + pl.low.ym + ')엔 ' + R.won(-pl.low.surplus) + ' 부족해요.' : '모든 달 흑자예요. 가장 빠듯한 달 ' + pl.low.ym + ' 남는 돈 ' + R.won(pl.low.surplus)) + '</p>'
    + (pl.rec !== p.limit ? '<button class="btn" type="button" id="use-rec">추천 ' + R.man(pl.rec) + '으로 맞추기</button>' : '') + '</div>'
    + '<div class="card"><h2>월별 잉여 <span class="hint">(봉급 − 적금 − 지출)</span></h2><div class="chart-wrap" tabindex="0" role="group" aria-label="월별 잉여 그래프, 옆으로 밀기">' + chart(pl.flow) + '</div><p class="hint"><span style="color:var(--bad);font-weight:800">빨강</span>=적자 달 · 흐린 막대=2027년 이후 봉급 <b>가정</b></p></div>'
    + '</div><div>'
    + '<div class="card"><h2>매칭지원금 입금일</h2><div class="big" style="font-size:30px" id="md">' + R.fmtD(md.date) + '</div><p style="margin:2px 0"><b class="amt" id="dday">' + (pl.dday > 0 ? 'D-' + pl.dday : pl.dday === 0 ? 'D-day' : '지남') + '</b> · 전역(만기 해지) 다음 달 25일' + (md.date !== md.base ? ', 휴일이라 직전 평일' : '') + (md.verified ? '' : ' <b class="tag uv">확인 필요</b>') + '</p><p class="hint">전역일 ' + R.fmtD(p.discharge) + '에 해지한다고 가정했어요. 해지가 늦어지면 입금도 늦어져요.</p></div>'
    + bankCard(p) + breakCard(p, pl)
    + '<div class="card"><h2>달마다 보기</h2><div class="tbl-wrap" tabindex="0" role="group" aria-label="달마다 보기 표, 가로로 밀어 보기"><table class="tbl" id="mt"><thead><tr><th scope="col">달</th><th scope="col">계급</th><th scope="col" class="n">봉급</th><th scope="col" class="n">적금</th><th scope="col" class="n">남는 돈</th></tr></thead><tbody>'
    + pl.flow.map(function (r) { return '<tr' + (r.surplus < 0 ? ' class="neg"' : '') + '><td class="n">' + r.ym + '</td><td>' + esc(r.rank) + (r.assumed ? ' <span class="tag">가정</span>' : '') + '</td><td class="n">' + R.num(r.pay) + '</td><td class="n">' + R.num(r.dep) + '</td><td class="n">' + R.num(r.surplus) + '</td></tr>'; }).join('') + '</tbody></table></div><p class="hint">한 달 지출 ' + R.won(pl.flow[0].spend) + ' 포함. 입대·전역 달 봉급은 일할 <b class="tag uv">확인 필요</b></p></div>'
    + settings(p) + warnBox(pl) + '<a class="btn pri block" href="#/share">부모님께 공유·카드 저장·인쇄</a></div></div>' + disc();
  var sl = $('#sl', v);
  sl.addEventListener('input', function () { var q = JSON.parse(JSON.stringify(p)); q.limit = +sl.value; var f = R.flow(q, q.limit, RJ, PAY), bad = f.filter(function (r) { return r.surplus < 0; }), m = R.maturity(q, RJ); $('#lim', v).textContent = R.man(q.limit); $('#total', v).textContent = R.won(m.total); sl.setAttribute('aria-valuetext', '월 ' + R.man(q.limit)); var lo = f.reduce(function (a, r) { return r.surplus < a.surplus ? r : a; }); $('#defmsg', v).textContent = bad.length ? '적자 달 ' + bad.length + '번 · 가장 부족한 달(' + lo.ym + ')엔 ' + R.won(-lo.surplus) + ' 부족해요.' : '모든 달 흑자예요.'; $('#limcard', v).className = 'card ' + (bad.length ? 'bad' : 'ol'); $('.chart-wrap', v).innerHTML = chart(f); });
  sl.addEventListener('change', function () { setLimit(+sl.value); });
  var ur = $('#use-rec', v); if (ur) ur.onclick = function () { setLimit(pl.rec); };
  bindSettings(v, p);
};
function setLimit(L) { var p = S.plan; p.limit = L; p.banks = R.defaultBanks(L, RJ).map(function (b, i) { var o = S.plan.banks[i]; if (o) { b.name = o.name; b.rate = o.rate; } return b; }); save(); render(); }
function bankCard(p) {
  var opts = function (cur) { return '<option value="">은행 고르기</option>' + RJ.banks.map(function (b) { return '<option' + (b === cur ? ' selected' : '') + '>' + b + '</option>'; }).join(''); };
  var e = R.bankErrors(p, RJ);
  return '<div class="card"><h2>두 은행에 나누기</h2><p class="hint" style="margin-top:0">은행별 최대 30만 원, 같은 은행 2계좌는 안 돼요. 금리는 은행마다 달라요(기본 5%).</p>'
    + p.banks.map(function (b, i) { return '<div class="row" style="align-items:flex-end"><div class="grow"><label class="f" for="bn' + i + '">' + (i + 1) + '번 은행</label><select id="bn' + i + '" data-bk="' + i + '|name">' + opts(b.name) + '</select></div><div style="flex:1 1 90px"><label class="f" for="bl' + i + '">월 한도</label><select id="bl' + i + '" data-bk="' + i + '|limit">' + [50000, 100000, 150000, 200000, 250000, 300000].map(function (x) { return '<option value="' + x + '"' + (x === b.limit ? ' selected' : '') + '>' + R.man(x) + '</option>'; }).join('') + '</select></div><div style="flex:1 1 80px"><label class="f" for="br' + i + '">연 금리 %</label><input type="number" step="0.1" min="0.1" max="15" id="br' + i + '" data-bk="' + i + '|rate" value="' + (b.rate * 100).toFixed(1) + '"></div></div>'; }).join('')
    + (p.banks.length ? '' : '<p>한도가 0원이라 나눌 계좌가 없어요.</p>') + '<div id="bk-err" role="alert">' + e.map(function (t) { return '<p class="err">' + esc(t) + '</p>'; }).join('') + '</div>'
    + '<p class="hint">우대금리는 ' + src('kfb') + '에서 가입 전에 확인하세요.</p></div>';
}
function breakCard(p, pl) {
  var L = pl.loss;
  return '<div class="card bad" id="brk"><h2>지금 깨면 잃는 돈</h2><p style="margin:0">오늘(' + T() + ')까지 ' + L.months + '/' + L.of + '번 넣었다고 보면</p><div class="big" style="color:var(--bad);font-size:32px" id="loss">' + R.won(L.loss) + '</div>'
    + '<div class="kv"><div><span>못 받는 매칭지원금</span><b id="l-ma">' + R.won(L.matching) + '</b></div><div><span>추징되는 이자 세금(15.4%)</span><b>' + R.won(L.tax) + '</b></div><div><span>지금까지 넣은 원금</span><b>' + R.won(L.principal) + '</b></div></div>'
    + '<p class="hint">중도해지 이자도 크게 낮아져요(은행마다 다름, 예: NH 3개월 미만 0.1%). 질병·부상 등 특별중도해지는 은행에 증빙을 문의하세요. 급하면 대출 대신 <a href="https://www.ccrs.or.kr" target="_blank" rel="noopener noreferrer">신용회복위원회<span class="sr"> (새 창)</span></a>·금융감독원 1332 상담.</p></div>';
}
function warnBox(pl) { return pl.warns.length ? '<div class="card"><h2>확인할 것</h2>' + pl.warns.map(function (w) { return '<div class="warn' + (w.level === 'red' ? ' red' : '') + '" data-code="' + w.code + '">' + esc(w.text) + '</div>'; }).join('') + '</div>' : ''; }
function settings(p) {
  return '<details class="card" id="set"><summary style="min-height:44px;font-weight:800;cursor:pointer">진급일·가입일·2027 봉급 고치기</summary>'
    + '<p class="hint"><b class="tag">예시값</b> 이병 2·일병 6·상병 6개월은 흔히 쓰는 예시예요. <b>부대 실제 진급일로 수정하세요.</b></p>'
    + ['일병', '상병', '병장'].map(function (r) { return '<label class="f" for="pr-' + r + '">' + r + ' 진급일</label><input type="date" id="pr-' + r + '" data-pr="' + r + '" value="' + esc(p.promo[r]) + '">'; }).join('')
    + '<label class="f" for="jn">적금 가입일(첫 입금 달)</label><input type="date" id="jn" value="' + esc(p.join) + '"><p class="hint">입대 달은 봉급이 일할이라 빠듯해요. 다음 달에 가입하면 입금 횟수가 1번 줄어요.</p>'
    + '<label class="f" for="dis2">전역 예정일</label><input type="date" id="dis2" value="' + esc(p.discharge) + '">'
    + '<label class="f" for="rs">2027년 이후 봉급 인상률(%) <span class="tag">미확정·가정</span></label><input type="number" id="rs" step="0.5" min="-10" max="30" value="' + p.raise + '"><p class="hint">2027 봉급표가 확정되지 않아 기본은 2026과 같다고 가정해요(0%).</p>'
    + '<label class="chip" style="margin-top:8px"><input type="checkbox" id="lm"' + (p.lastMonth ? ' checked' : '') + '><span>전역 달에도 직접 입금</span></label>'
    + '<p class="err" id="e-set" role="alert"></p></details>';
}
function bindSettings(v, p) {
  $$('[data-bk]', v).forEach(function (el) { el.addEventListener('change', function () { var a = el.getAttribute('data-bk').split('|'), b = p.banks[+a[0]]; if (a[1] === 'rate') { var r = +el.value / 100; if (!(r > 0 && r < 0.15)) { toast('금리는 0.1~15% 사이로 적어 주세요.'); return; } b.rate = r; } else if (a[1] === 'limit') b.limit = +el.value; else b.name = el.value; save(); keep(el.id); }); });
  $$('[data-pr]', v).forEach(function (el) { el.addEventListener('change', function () { if (!R.isD(el.value)) return; p.promo[el.getAttribute('data-pr')] = el.value; p.promoEdited = true; save(); keep(el.id, true); }); });
  $('#jn', v).addEventListener('change', function () { if (R.isD(this.value)) { p.join = this.value; save(); keep('jn', true); } });
  $('#dis2', v).addEventListener('change', function () { if (R.isD(this.value) && this.value > p.enlist) { p.discharge = this.value; save(); keep('dis2', true); } else $('#e-set', v).textContent = '전역일은 입대일보다 뒤여야 해요.'; });
  $('#rs', v).addEventListener('change', function () { var x = +this.value; if (!(x >= -10 && x <= 30)) { $('#e-set', v).textContent = '인상률은 -10~30% 사이로 적어 주세요.'; return; } p.raise = x; save(); keep('rs', true); });
  $('#lm', v).addEventListener('change', function () { p.lastMonth = this.checked; save(); keep('lm', true); });
}
function keep(id, open) { var y = scrollY; render(); scrollTo(0, y); if (open) { var s = $('#set'); if (s) s.open = true; } var e = document.getElementById(id); if (e) e.focus({ preventScroll: true }); }
/* 공유 */
function stream(bytes, Tr) { return new Response(new Blob([bytes]).stream().pipeThrough(new Tr('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
function encode(p, spend) { var raw = R.utf8(JSON.stringify(R.pack(p, spend))); return typeof CompressionStream === 'function' ? stream(raw, CompressionStream).then(function (z) { return 'z' + R.b64u(z); }, function () { return 'j' + R.b64u(raw); }) : Promise.resolve('j' + R.b64u(raw)); }
function decode(c) { return new Promise(function (ok, no) { try { var k = c.charAt(0), b = R.unb64u(c.slice(1)), fin = function (x) { try { var p = R.unpack(JSON.parse(R.unutf8(x)), RJ); p ? ok(p) : no(); } catch (e) { no(e); } }; if (k === 'j') fin(b); else if (k === 'z' && typeof DecompressionStream === 'function') stream(b, DecompressionStream).then(fin, no); else no(); } catch (e) { no(e); } }); }
function summaryHTML(p, pl, ro) {
  return '<div class="card"><h2>' + esc(R.branch(RJ, p.branch).label) + ' · 전역 ' + R.fmtD(p.discharge) + '</h2><div class="big" id="s-total">' + R.won(pl.mat.total) + '</div>'
    + '<div class="kv"><div><span>월 한도</span><b>' + R.man(p.limit) + ' × ' + pl.mat.n + '개월</b></div><div><span>원금</span><b>' + R.won(pl.mat.principal) + '</b></div><div><span>이자</span><b>' + R.won(pl.mat.interest) + '</b></div><div><span>매칭지원금</span><b>' + R.won(pl.mat.matching) + '</b></div><div><span>매칭 입금일</span><b>' + R.fmtD(pl.match.date) + '</b></div>'
    + (ro && !p.fixed.length ? '' : '<div><span>적자 달</span><b>' + (pl.deficits ? pl.deficits + '번' : '없음') + '</b></div>') + '</div></div>'
    + '<div class="card"><h2>월별 잉여</h2><div class="chart-wrap" tabindex="0" role="group" aria-label="월별 잉여 그래프">' + chart(pl.flow) + '</div>' + (ro && !p.fixed.length ? '<p class="hint">지출은 공유되지 않아 봉급 − 적금만 보여요.</p>' : '') + '</div>';
}
routes.share = function (v) {
  var p = S.plan; if (!p) { v.innerHTML = '<h1>공유</h1><div class="card"><h2>공유할 설계가 없어요</h2><a class="btn pri block" href="#/w/1">설계 시작</a></div>' + disc(); return; }
  var pl = R.plan(p, RJ, PAY, H, T());
  v.innerHTML = '<h1>부모님께 공유</h1><div class="card no-print"><div class="card bad" role="note" style="margin-top:0"><b>링크 안에 내 설계가 그대로 들어 있어요.</b> 서버에 저장하지 않는 대신 링크를 받은 누구나 입대일·전역일·한도를 볼 수 있어요. 가족에게 1:1로만 보내세요. 이름·연락처는 넣지 않아요.</div>'
    + '<label class="chip"><input type="checkbox" id="sp"><span>지출·휴가비·목돈 배분 금액도 넣기</span></label><p class="hint" id="sp-h">기본은 <b>지출 금액 빼고</b> 한도·날짜만 보내요.</p>'
    + '<button class="btn pri block" type="button" id="mk">공유 링크 만들기</button><div id="lk" hidden><p class="link-out" id="lk-t"></p><div class="row"><button class="btn grow" type="button" id="cp">링크 복사</button><a class="btn grow" id="op" target="_blank" rel="noopener" href="#/">새 탭에서 미리 보기</a></div></div>'
    + '<div class="row"><button class="btn grow" type="button" id="png">결과 카드 이미지 저장</button><button class="btn grow" type="button" id="pr">A4 인쇄</button></div></div>'
    + summaryHTML(p, pl) + disc();
  var sp = $('#sp', v);
  sp.onchange = function () { $('#sp-h', v).innerHTML = sp.checked ? '<b style="color:var(--bad)">한 달 지출·배분 금액이 링크에 들어가요.</b>' : '기본은 <b>지출 금액 빼고</b> 한도·날짜만 보내요.'; $('#lk', v).hidden = true; };
  $('#mk', v).onclick = function () { encode(p, sp.checked).then(function (c) { var u = location.href.split('#')[0] + '#s=' + c; $('#lk-t', v).textContent = u; $('#lk', v).hidden = false; $('#lk', v).setAttribute('data-url', u); $('#op', v).href = u; toast('링크를 만들었어요.'); }); };
  $('#cp', v).onclick = function () { var u = $('#lk', v).getAttribute('data-url'); if (navigator.clipboard && isSecureContext) navigator.clipboard.writeText(u).then(function () { toast('복사했어요.'); }, function () { toast('길게 눌러 복사해 주세요.'); }); else toast('링크를 길게 눌러 복사해 주세요.'); };
  $('#pr', v).onclick = function () { window.print(); };
  $('#png', v).onclick = function () { cardPNG(p, pl); };
};
function cardPNG(p, pl) {
  var c = document.createElement('canvas'), W = 1080, Hh = 1080; c.width = W; c.height = Hh; var g = c.getContext('2d'), F = 'system-ui,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  g.fillStyle = '#1F2A1C'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#F5F3EC'; g.fillRect(48, 48, W - 96, Hh - 96);
  g.fillStyle = '#4B5D3A'; g.font = '800 44px ' + F; g.fillText(APP, 96, 140);
  g.fillStyle = '#222'; g.font = '600 36px ' + F; g.fillText('전역 때 받을 돈', 96, 240); g.font = '900 96px ' + F; g.fillText(R.won(pl.mat.total), 96, 350);
  var rows = [['월 한도', R.man(p.limit) + ' × ' + pl.mat.n + '개월'], ['원금', R.won(pl.mat.principal)], ['은행 이자', R.won(pl.mat.interest)], ['매칭지원금', R.won(pl.mat.matching)], ['매칭 입금일', R.fmtD(pl.match.date)]];
  g.font = '600 40px ' + F; rows.forEach(function (r, i) { var y = 470 + i * 84; g.fillStyle = '#5E5E5E'; g.fillText(r[0], 96, y); g.fillStyle = i === 3 ? '#7A5F00' : '#222'; g.textAlign = 'right'; g.fillText(r[1], W - 96, y); g.textAlign = 'left'; });
  g.fillStyle = '#5E5E5E'; g.font = '500 28px ' + F; g.fillText('참고용 계산 · 기준일 ' + RJ.baseDate + ' · 실제 금액은 은행·국방부 확인', 96, Hh - 100);
  c.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'jeonyeok-card.png'; a.hidden = true; a.textContent = '카드 이미지'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); toast('카드 이미지를 저장했어요.'); }, 'image/png');
}
routes.view = function (v, parts) {
  v.innerHTML = '<h1>공유받은 설계</h1><p role="status">여는 중…</p>';
  decode(parts[0] || '').then(function (p) {
    var pl = R.plan(p, RJ, PAY, H, T());
    v.innerHTML = '<h1>공유받은 설계</h1><p><span class="ro">읽기 전용</span> 링크에 담긴 값으로 다시 계산했어요. 이 기기에는 저장하지 않아요.</p>' + summaryHTML(p, pl, true)
      + '<a class="btn block" href="' + location.pathname + '#/">나도 설계해 보기</a>' + disc();
    document.title = R.pageTitle('공유받은 설계', APP);
  }, function () { v.innerHTML = '<h1>링크를 열 수 없어요</h1><div class="card bad" role="alert"><p>링크가 잘렸거나 다른 앱 링크예요. 보낸 사람에게 링크 전체를 다시 받아 주세요.</p><a class="btn block" href="#/">처음 화면</a></div>' + disc(); document.title = R.pageTitle('링크를 열 수 없어요', APP); });
};
/* 체크리스트 */
var CK = [['c1', '나라사랑포털 앱에서 전역(소집해제) 확인서 발급'], ['c2', '2개 은행이면 서류 2부 — 은행마다 따로 제출'], ['c3', '조기전역·신분전환자는 비대면 해지 불가 → 은행 방문 해지'], ['c4', '은행별 계좌 유지 — 매칭지원금이 각각 들어와요'], ['c5', '만기 뒤엔 이자가 낮고 과세라 전역하면 바로 해지'], ['c6', '군 자동이체는 전역 전달까지 — 전역 달 입금은 직접'], ['c7', '해지 다음 달 25일 매칭지원금 입금 확인']];
routes.check = function (v) {
  var p = S.plan; if (!p) { v.innerHTML = '<h1>전역 체크리스트</h1><div class="card"><h2>설계를 먼저 만들어 주세요</h2><a class="btn pri block" href="#/w/1">설계 시작</a></div>' + disc(); return; }
  var dd = R.diffDays(T(), p.discharge), hot = dd <= 30 && dd >= -60, done = CK.filter(function (c) { return p.check[c[0]]; }).length;
  v.innerHTML = '<h1>전역 체크리스트</h1><p><b class="amt">전역 ' + (dd > 0 ? 'D-' + dd : dd === 0 ? 'D-day' : (-dd) + '일 지남') + '</b> · ' + done + '/' + CK.length + ' 완료' + (hot ? ' <span class="tag red">지금 챙길 때</span>' : '') + '</p><div class="card">'
    + CK.map(function (c) { return '<label class="ck' + (hot && !p.check[c[0]] ? ' hot' : '') + '"><input type="checkbox" id="ck-' + c[0] + '" data-ck="' + c[0] + '"' + (p.check[c[0]] ? ' checked' : '') + '><span>' + esc(c[1]) + '</span></label>'; }).join('') + '</div>'
    + '<p class="hint">출처: ' + src('mma') + ' · ' + src('nh') + '</p>' + disc();
  $$('[data-ck]', v).forEach(function (el) { el.onchange = function () { p.check[el.getAttribute('data-ck')] = el.checked; save(); keep(el.id); }; });
};
/* 목돈 배분 */
function donut(items, total) {
  var C = ['#4B5D3A', '#C9A227', '#2E7D5B', '#8A6D3B', '#5C7C9E', '#9E5C7C', '#7C9E5C', '#3B6D8A', '#A0522D', '#6B6B6B'], a0 = -Math.PI / 2, s = '<svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-labelledby="dn-t"><title id="dn-t">목돈 배분 도넛 차트</title><circle cx="90" cy="90" r="70" fill="none" stroke="#DCD8CB" stroke-width="28"/>';
  items.forEach(function (x, i) { if (!(x.a > 0) || !total) return; var f = Math.min(1, x.a / total), a1 = a0 + f * 2 * Math.PI, lg = f > .5 ? 1 : 0; if (f >= .999) s += '<circle cx="90" cy="90" r="70" fill="none" stroke="' + C[i % 10] + '" stroke-width="28"/>'; else s += '<path d="M' + (90 + 70 * Math.cos(a0)) + ' ' + (90 + 70 * Math.sin(a0)) + 'A70 70 0 ' + lg + ' 1 ' + (90 + 70 * Math.cos(a1)) + ' ' + (90 + 70 * Math.sin(a1)) + '" fill="none" stroke="' + C[i % 10] + '" stroke-width="28"/>'; a0 = a1; });
  return { svg: s + '</svg>', C: C };
}
routes.bucket = function (v) {
  var p = S.plan; if (!p) { v.innerHTML = '<h1>전역 후 목돈 배분</h1><div class="card"><h2>설계를 먼저 만들어 주세요</h2><a class="btn pri block" href="#/w/1">설계 시작</a></div>' + disc(); return; }
  var tot = R.plan(p, RJ, PAY, H, T()).mat.total, sum = p.bucket.reduce(function (s, x) { return s + x.a; }, 0), rem = tot - sum, dn = donut(p.bucket, tot);
  v.innerHTML = '<h1>전역 후 목돈 배분</h1><div class="card"><p style="margin:0">나눌 돈(예상)</p><div class="big" style="font-size:30px">' + R.won(tot) + '</div><p id="rem" role="status" style="font-weight:800;color:' + (rem < 0 ? 'var(--bad)' : 'var(--ok)') + '">' + (rem < 0 ? R.won(-rem) + ' 넘었어요' : '남은 돈 ' + R.won(rem)) + '</p>'
    + '<div style="text-align:center">' + dn.svg + '</div>'
    + p.bucket.map(function (x, i) { return '<div class="row" style="align-items:flex-end"><span aria-hidden="true" style="width:14px;height:14px;border-radius:3px;background:' + dn.C[i % 10] + '"></span><div class="grow"><label class="f" for="bu' + i + '">' + esc(x.n) + ' <span class="hint">' + (tot ? Math.round(x.a / tot * 100) : 0) + '%</span></label><input type="text" inputmode="numeric" id="bu' + i + '" data-bu="' + i + '" value="' + (x.a ? R.num(x.a) : '') + '" placeholder="금액 또는 30%"></div></div>'; }).join('')
    + '<div class="row" style="margin-top:8px"><label class="sr" for="nb">새 항목 이름</label><input type="text" id="nb" maxlength="20" placeholder="새 항목 이름" class="grow" style="flex:1 1 160px"><button class="btn" type="button" id="addb">항목 더하기</button></div><p class="err" id="e-b" role="alert"></p></div>'
    + '<div class="card"><h2>전역 후 6개월 생활비</h2><label class="f" for="af">한 달 지출 계획</label><input type="text" inputmode="numeric" id="af" value="' + (p.after ? R.num(p.after) : '') + '" placeholder="예: 80만"><p id="af6" class="formula"><span>6개월 = ' + R.num(p.after) + ' × 6</span><span>= <b>' + R.won(p.after * 6) + '</b></span></p><p class="hint">비상금 버킷과 비교해 보세요.</p></div>'
    + '<p class="hint">고위험 투자·고금리 대출·온라인 도박은 목돈을 한 번에 잃을 수 있어요. 빚 고민은 <a href="https://www.ccrs.or.kr" target="_blank" rel="noopener noreferrer">신용회복위원회<span class="sr"> (새 창)</span></a>(1600-5500)·<a href="https://www.fss.or.kr" target="_blank" rel="noopener noreferrer">금융감독원<span class="sr"> (새 창)</span></a>(1332).</p>' + disc();
  $$('[data-bu]', v).forEach(function (el) { el.onchange = function () { var t = el.value.trim(), m = /^(\d{1,3})%$/.exec(t), n = m ? Math.round(tot * m[1] / 100) : (t ? R.parseWon(t) : 0); if (!(n >= 0) || n > 1e9) { $('#e-b', v).textContent = '금액(예: 200만) 또는 비율(예: 30%)로 적어 주세요.'; el.setAttribute('aria-invalid', 'true'); return; } p.bucket[+el.getAttribute('data-bu')].a = n; save(); keep(el.id); }; });
  $('#addb', v).onclick = function () { var n = $('#nb', v).value.trim(); if (!n) { $('#e-b', v).textContent = '항목 이름을 적어 주세요.'; return; } if (p.bucket.length >= 10) { $('#e-b', v).textContent = '10개까지 만들 수 있어요.'; return; } p.bucket.push({ n: n.slice(0, 20), a: 0 }); save(); keep('bu' + (p.bucket.length - 1)); };
  $('#af', v).onchange = function () { var n = this.value.trim() ? R.parseWon(this.value) : 0; if (!(n >= 0)) { $('#e-b', v).textContent = '숫자로 적어 주세요.'; return; } p.after = n; save(); keep('af'); };
};
/* 기준·출처 */
routes.about = function (v) {
  v.innerHTML = '<h1>기준·출처</h1><div class="card"><h2>규칙 (기준일 ' + RJ.baseDate + ')</h2><ul style="padding-left:20px;margin:0">'
    + '<li>개인 월 55만 원 · 은행별 30만 원 · 5만 원 단위 · 1인 2계좌(같은 은행 불가)</li><li>2025-01-02 이후 가입자는 납입한도 중도 변경 불가(이전 가입자는 1회 상향)</li><li>은행 이자 5% 수준, 이자 비과세(현행법: 2026-12-31까지 가입)</li><li>매칭지원금: 2024년 이후 입금 원금의 100% — 만기 전 해지하면 없음, 2023년 이전 입금분은 규칙이 달라 계산에서 빼요</li><li>매칭 입금: 만기 해지한 다음 달 25일(휴일이면 전 평일), 은행별 계좌로 각각</li><li>가입기간: 육군·해병·상근 18, 해군 20, 공군·사회복무 21, 대체복무 24개월까지</li>'
    + '<li>2026 병 봉급: 이병 ' + R.won(PAY['2026']['이병']) + ' · 일병 ' + R.won(PAY['2026']['일병']) + ' · 상병 ' + R.won(PAY['2026']['상병']) + ' · 병장 ' + R.won(PAY['2026']['병장']) + '</li><li>2027년 이후 봉급: <b>미확정 — 2026과 같다고 가정</b> <span class="tag uv">확인 필요</span></li></ul></div>'
    + '<div class="card"><h2>공식 출처</h2><ul style="padding-left:20px;margin:0">' + RJ.sources.map(function (s) { return '<li>' + src(s.id) + '</li>'; }).join('') + '</ul></div>'
    + '<div class="card"><h2>확인 필요</h2><ul style="padding-left:20px;margin:0" id="unv">' + RJ.unverified.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'
    + '<div class="card"><h2>내 기기 자료</h2><p>설계는 이 브라우저(localStorage <code>' + KEY + '</code>)에만 있어요. <a href="privacy.html">개인정보 안내</a></p><div class="row"><button class="btn ghost grow" type="button" id="st">계산 자체 점검</button><button class="btn danger grow" type="button" id="wipe">모두 지우기</button></div><p class="hint" id="st-out" role="status"></p></div>'
    + '<div class="card"><h2>더 읽기</h2><ul style="padding-left:20px;margin:0"><li><a href="military-savings-limit/">적금 한도 55만 원, 얼마로 정할까</a></li><li><a href="matching-fund-payment-date/">매칭지원금 입금일</a></li><li><a href="early-termination-loss/">중도해지하면 잃는 돈</a></li></ul></div>' + disc();
  $('#st', v).onclick = function () { var r = R.selfTest(RJ, PAY, H); $('#st-out', v).textContent = '자체 점검 ' + r.pass + '/' + r.total + ' 통과'; };
  $('#wipe', v).onclick = function () { confirmBox('모두 지울까요?', '설계·체크리스트·배분이 모두 지워져요.', '지우기', function () { S = { plan: null, ex: false, draft: {} }; try { localStorage.removeItem(KEY); } catch (e) {} toast('지웠어요.'); go('#/'); }); };
};
/* 시작 */
function boot() {
  Promise.all(['data/rules.json', 'data/pay.json', 'data/holidays.json'].map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); })).then(function (x) {
    RJ = x[0]; PAY = x[1]; H = x[2]; load(); if (flags.noStore) toast('저장이 막혀 있어요. 창을 닫으면 사라져요.');
    window.addEventListener('hashchange', render); render();
    window.runSelfTest = function () { return R.selfTest(RJ, PAY, H); };
  }).catch(function () {
    $('#view').innerHTML = '<h1>기준 자료를 불러오지 못했어요</h1><div class="card bad" role="alert"><p>연결을 확인하고 다시 열어 주세요. 한 번 연 뒤에는 오프라인에서도 열려요.</p><button class="btn block" type="button" id="rl">다시 열기</button></div>';
    $('#rl').onclick = function () { location.reload(); }; document.title = R.pageTitle('기준 자료를 불러오지 못했어요', APP);
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
}
window.__jy = { state: function () { return S; } };
boot();
})();
