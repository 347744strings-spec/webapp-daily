/* 방문조사 7일 노트 — app.js (빌드: /workspace/webapps/_build/visit/b1~b6.js 이어붙임) */
(function () {
'use strict';
var R = window.VisitRules;
var APP = '방문조사 7일 노트';
var K = { profile: 'vn7.profile', logs: 'vn7.logs', checklist: 'vn7.checklist', care: 'vn7.care', prefs: 'vn7.prefs' };
var D = null, L = null, G = null; /* domains.json, limits-2026.json, grades.json */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function uid() { return 'l-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function now() { return new Date(); }
function today() { return R.today(now()); }
function W(n) { return R.won(n); }

/* ---------- 저장: 이 기기 localStorage(vn7.*)에만. 서버 전송 없음 ---------- */
var flags = { recovered: [], storageError: false };
var S = { profile: null, logs: [], checklist: {}, care: null, prefs: { onboarded: false, example: false, todo: {} } };
function readKey(k) {
  var raw = null; try { raw = localStorage.getItem(k); } catch (e) { flags.storageError = true; return undefined; }
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch (e) { flags.recovered.push(k); try { localStorage.removeItem(k); } catch (e2) {} return undefined; }
}
function loadState() {
  var p = readKey(K.profile), lg = readKey(K.logs), ck = readKey(K.checklist), c = readKey(K.care), pr = readKey(K.prefs);
  S.profile = R.cleanProfile(p, D, L);
  if (lg !== undefined && !Array.isArray(lg)) { flags.recovered.push(K.logs); lg = []; }
  var raw = Array.isArray(lg) ? lg : [];
  S.logs = raw.map(function (l) { return R.cleanLog(l, D); }).filter(Boolean);
  if (raw.length !== S.logs.length) flags.recovered.push(K.logs);
  S.checklist = {}; if (ck && typeof ck === 'object') D.checklist.forEach(function (x) { if (ck[x.id] === true) S.checklist[x.id] = true; });
  S.care = R.cleanCare(c, D);
  S.prefs = { onboarded: !!(pr && pr.onboarded), example: !!(pr && pr.example), todo: pr && pr.todo && typeof pr.todo === 'object' ? pr.todo : {} };
}
function put(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { toast('저장 공간이 부족하거나 막혀 있어요. 내보내기로 백업한 뒤 오래된 기록을 지워 주세요.'); return false; }
}
function save(which) {
  var ok = true;
  (which || ['profile', 'logs', 'checklist', 'care', 'prefs']).forEach(function (w) { ok = put(K[w], S[w]) && ok; });
  return ok;
}
function wipeAll() {
  try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('vn7.') === 0) localStorage.removeItem(k); }); } catch (e) {}
  S = { profile: R.cleanProfile({}, D, L), logs: [], checklist: {}, care: R.cleanCare({}, D), prefs: { onboarded: false, example: false, todo: {} } };
}
function lbl(list, id) { var x = list.filter(function (o) { return o.id === id; })[0]; return x ? x.label : ''; }
function ageLabel() { return lbl(D.ageBands, S.profile.ageBand); }
function alias() { return S.profile.alias || '가족'; }
function sumNow(end) { return R.summarize(S.logs, end || today(), D); }

/* ---------- 예시 데이터 (화면에 "예시" 표시) ---------- */
function exampleData() {
  var t = today(), d = function (n) { return R.addDays(t, -n); };
  var raw = [
    [6, 'morning', 'toilet', 2, [], 'usual', ''], [6, 'night', 'daynight', 1, [], 'usual', '새벽 2시에 깨서 1시간'], [6, 'day', 'meds', 2, [], 'usual', '약 꺼내 드림'],
    [5, 'morning', 'dress', 2, [], 'usual', '단추를 못 채우심'], [5, 'day', 'move', 1, [], 'good', ''], [5, 'evening', 'repeat', 1, [], 'usual', '저녁 먹었는지 3번 물으심'],
    [4, 'dawn', 'toilet', 3, ['fall', 'incont'], 'bad', '화장실 앞에서 넘어지심'], [4, 'morning', 'bath', 3, [], 'bad', ''], [4, 'day', 'move', 2, [], 'bad', '벽 짚고 이동'],
    [3, 'morning', 'toilet', 2, [], 'usual', ''], [3, 'day', 'eat', 1, [], 'usual', '반찬 잘라 드림'], [3, 'evening', 'fireleft', 2, ['fire'], 'usual', '냄비 올려두고 잊으심'],
    [2, 'morning', 'meds', 2, ['dupmed'], 'usual', '아침약을 두 번 드실 뻔'], [2, 'day', 'stairs', 3, [], 'usual', '현관 계단 부축'], [2, 'night', 'wander', 1, ['wander'], 'bad', '밤에 현관문 여심'],
    [1, 'morning', 'dress', 2, [], 'usual', ''], [1, 'day', 'toilet', 2, [], 'usual', ''], [1, 'evening', 'confuse', 1, [], 'usual', '오늘이 무슨 요일인지 헷갈리심'],
    [0, 'morning', 'wash', 1, [], 'usual', ''], [0, 'day', 'alone', 0, [], 'usual', '낮 6시간 혼자 계심']
  ];
  return {
    profile: R.cleanProfile({ alias: '어머니', ageBand: '75', stage: 'visit', proxy: 'family', applyDate: R.addDays(t, -10), visitDate: R.addDays(t, 3), visitTime: '14:00', author: '나' }, D, L),
    logs: raw.map(function (r, i) { return R.cleanLog({ id: 'ex-' + i, date: d(r[0]), slot: r[1], item: r[2], help: r[3], risk: r[4], dayTag: r[5], note: r[6], author: i % 4 === 3 ? '둘째' : '나' }, D); }),
    checklist: { id: true, form: true }, care: R.cleanCare({ meds: [{ name: '혈압약(예시)', when: '아침' }, { name: '치매약(예시)', when: '저녁' }], caregiver: '자녀', alone: '하루 4~8시간', memo: '어머니는 조사원 앞에서 "다 혼자 해요"라고 하실 수 있어요. 지난주 새벽 화장실 앞 낙상을 꼭 말씀드려 주세요.' }, D)
  };
}
/* ---------- 공통 UI ---------- */
var toastT = null;
function toast(msg) { var t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3400); }
var lastFocus = null;
function openModal(html, onReady, label) {
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
  openModal('<h2 id="mh">' + esc(title) + '</h2><p>' + body + '</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-dismiss="1" type="button">취소</button><button class="btn grow ' + (danger ? 'danger solid' : 'pri') + '" id="mok" type="button">' + esc(okLabel) + '</button></div>',
    function (bg) { $('#mok', bg).addEventListener('click', function () { closeModal(); cb(); }); });
}
function src(id) {
  var s = L.sources.filter(function (x) { return x.id === id; })[0]; if (!s) return '';
  return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '<span class="sr"> (새 창)</span></a>' + (s.verified ? '' : ' <b class="lock">확인 필요</b>');
}
function srcs(ids) { return '<p class="src">근거: ' + ids.map(src).join(' · ') + ' <span>(' + L.checkedAt + ' 원문 확인)</span></p>'; }
function copyText(text, what) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    toast(ok ? (what || '내용') + '을 복사했어요.' : '복사가 막혀 있어요. 글자를 길게 눌러 직접 복사해 주세요.');
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast((what || '내용') + '을 복사했어요.'); }, fallback);
  else fallback();
}
function download(name, blob) {
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); a.remove();
}
function chips(name, list, cur, type, cls) {
  return '<div class="chips' + (cls ? ' ' + cls : '') + '">' + list.map(function (o) {
    var id = typeof o === 'string' ? o : o.id, lab = typeof o === 'string' ? o : o.label, on = Array.isArray(cur) ? cur.indexOf(id) >= 0 : cur === id;
    return '<label class="chip"><input type="' + (type || 'radio') + '" name="' + name + '" value="' + esc(id) + '"' + (on ? ' checked' : '') + '><span>' + (o.icon ? '<span aria-hidden="true">' + o.icon + '</span>' : '') + esc(lab) + '</span></label>';
  }).join('') + '</div>';
}
function val(name, el) { var x = $('input[name="' + name + '"]:checked', el || document); return x ? x.value : ''; }
function vals(name, el) { return $$('input[name="' + name + '"]:checked', el || document).map(function (x) { return x.value; }); }
function hl(v) { var h = D.help[v]; return '<span class="hl hl' + v + '"><span aria-hidden="true">' + h.icon + '</span>' + esc(h.label) + '</span>'; }
function exBanner() {
  if (!S.prefs.example) return '';
  return '<div class="card warm ex-banner"><span class="tag ex">예시</span><span class="grow">예시 데이터예요. 실제 기록이 아니에요.</span><button class="btn ghost" type="button" data-act="clear-example">예시 지우고 시작</button></div>';
}
function privacyLine() { return '<p class="notice-strip">🔒 기록은 <b>이 휴대폰에만</b> 저장돼요. 서버로 보내지 않아요. 이름 대신 호칭만 써요.</p>'; }
/* ---------- 라우터 ---------- */
var routes = {};
var TAB = { home: 'home', log: 'log', brief: 'brief', guide: 'brief', care: 'brief', result: 'result', fail: 'result' };
var TOP = { check: '#/check', timeline: '#/timeline', settings: '#/settings', info: '#/settings' };
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render(soft) {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('/').filter(Boolean), name = parts[0] || 'home';
  if (!routes[name]) name = 'home';
  if (!S.prefs.onboarded && ['start', 'example', 'info', 'settings'].indexOf(name) < 0) name = 'start';
  var old = $('#view'), view = old.cloneNode(false); old.parentNode.replaceChild(view, old);
  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'clear-example') confirmBox('예시를 지울까요?', '예시 기록과 설정을 모두 지우고 처음 화면으로 가요.', '예시 지우기', function () { wipeAll(); toast('예시를 지웠어요. 내 정보를 넣어 시작하세요.'); go('#/start'); });
    if (a === 'record') openRecord({});
    if (a === 'same') openSame();
  });
  document.body.classList.toggle('has-fab', name === 'home' || name === 'log');
  routes[name](view, parts.slice(1).map(decodeURIComponent));
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === TAB[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('.toplinks a').forEach(function (a) { if (a.getAttribute('href') === TOP[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#tabbar').style.display = S.prefs.onboarded ? '' : 'none';
  var hd = $('h1', view);
  if (render.navigated && !soft) { if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  render.navigated = true;
  document.title = R.pageTitle(hd ? hd.textContent : '', APP);
}
render.navigated = false;
window.__pageTitle = function (h) { return R.pageTitle(h, APP); };
/* ---------- 온보딩 (1화면) ---------- */
routes.start = function (view) {
  var p = S.profile, unknown = !p.visitDate && S.prefs.onboarded;
  view.innerHTML = '<h1>방문조사, 언제세요?</h1>' +
    '<p class="muted">30초면 끝나요. 이름은 묻지 않아요.</p>' + privacyLine() +
    '<form id="ob" novalidate>' +
    '<label class="f" for="vd">방문조사 날짜</label><input type="date" id="vd" value="' + esc(p.visitDate) + '" aria-describedby="vd-h">' +
    '<p class="hint" id="vd-h">공단에서 받은 문자·전화의 날짜예요.</p>' +
    '<label class="ck" style="border:0"><input type="checkbox" id="vdu"' + (unknown ? ' checked' : '') + '><span><b>아직 몰라요</b><span class="muted small">나중에 일정에서 넣을 수 있어요</span></span></label>' +
    '<fieldset><legend>누구를 위한 기록인가요? (호칭)</legend>' + chips('alias', D.aliases, p.alias) + '<p class="err" id="e-alias" role="alert"></p></fieldset>' +
    '<fieldset><legend>나이</legend>' + chips('age', D.ageBands, p.ageBand) + '<p class="err" id="e-age" role="alert"></p></fieldset>' +
    '<fieldset><legend>지금 어느 단계인가요?</legend>' + chips('stage', D.stages, p.stage || 'visit') + '</fieldset>' +
    '<button class="btn pri block big" type="submit" style="margin-top:18px">시작하고 첫 기록 하기</button>' +
    '</form>' +
    '<p style="margin-top:14px">먼저 보고 싶다면 <a href="#/example">예시로 둘러보기</a></p>' +
    (flags.recovered.length ? '<p class="card danger small" role="alert">저장된 기록 일부가 손상돼 읽을 수 없어 정리했어요. 백업 파일이 있으면 설정에서 가져오세요.</p>' : '');
  var f = $('#ob', view), vd = $('#vd', view), vdu = $('#vdu', view);
  vdu.addEventListener('change', function () { if (vdu.checked) vd.value = ''; });
  vd.addEventListener('input', function () { if (vd.value) vdu.checked = false; });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = val('alias', f), ag = val('age', f), ok = true;
    $('#e-alias', f).textContent = a ? '' : '호칭을 하나 골라 주세요.'; $('#e-age', f).textContent = ag ? '' : '나이 구간을 골라 주세요.';
    if (!a || !ag) { ok = false; (a ? $('input[name=age]', f) : $('input[name=alias]', f)).focus(); }
    if (vd.value && !R.isD(vd.value)) { ok = false; toast('날짜를 다시 확인해 주세요.'); }
    if (!ok) return;
    if (S.prefs.example) wipeAll();
    S.profile.alias = a; S.profile.ageBand = ag; S.profile.stage = val('stage', f) || 'visit'; S.profile.visitDate = vdu.checked ? '' : vd.value;
    S.prefs.onboarded = true; S.prefs.example = false; save();
    flags.firstRecord = true; go('#/');
  });
};
routes.example = function () {
  var ex = exampleData();
  S.profile = ex.profile; S.logs = ex.logs; S.checklist = ex.checklist; S.care = ex.care; S.prefs = { onboarded: true, example: true, todo: {} };
  save(); toast('예시 데이터를 열었어요. 화면마다 "예시"로 표시돼요.'); location.replace('#/');
};
/* ---------- 홈 ---------- */
routes.home = function (view) {
  var p = S.profile, t = today(), sum = sumNow(t), lines = R.briefLines(sum, D);
  var dd = p.visitDate ? R.diffDays(t, p.visitDate) : null;
  var dcard = p.visitDate
    ? '<div class="card soft"><p class="muted" style="margin:0">방문조사</p><p class="dday" id="dday">' + (dd >= 0 ? R.dLabel(t, p.visitDate) : '조사 끝남') + '</p><p style="margin:4px 0 0"><b>' + R.fmtD(p.visitDate) + (p.visitTime ? ' ' + esc(p.visitTime) : '') + '</b>' + (dd < 0 ? ' · 결과를 받으면 <a href="#/result">결과·비용</a>에서 등급을 넣어 주세요' : '') + '</p></div>'
    : '<div class="card soft"><p class="dday" id="dday" style="font-size:28px">조사일 미정</p><p style="margin:4px 0 0">날짜를 알게 되면 <a href="#/timeline">일정에 넣기</a></p></div>';
  var dots = '';
  for (var i = 6; i >= 0; i--) { var dt = R.addDays(t, -i), n = sum.days[dt] || 0; dots += '<li class="' + (n ? 'on' : '') + (i === 0 ? ' today' : '') + '"><span class="d" aria-hidden="true">' + (n || '·') + '</span><span>' + R.WD[R.dow(dt)] + '</span><span class="sr">' + R.fmtS(dt) + ' ' + (n ? n + '건 기록' : '기록 없음') + '</span></li>'; }
  var todo = R.todoFor(t, D.todos), tdone = !!S.prefs.todo[t];
  var yd = R.addDays(t, -1), ycnt = S.logs.filter(function (l) { return l.date === yd; }).length;
  var stageCard = '';
  if (p.stage === 'fail') { var dl = R.appealDeadline(p.resultDate, p.dispDate, L); stageCard = '<div class="card danger"><h2>등급외 판정을 받으셨나요?</h2><p>' + (dl ? '이의신청(심사청구) 마감 <b>' + R.fmtD(dl.final) + '</b> (' + R.dLabel(t, dl.final) + ')' : '결과 통지를 받은 날을 넣으면 이의신청 마감일을 계산해요.') + '</p><a class="btn pri block" href="#/fail">등급외 도우미 열기</a></div>'; }
  else if (p.stage === 'result') stageCard = '<div class="card"><h2>등급을 받으셨어요</h2><p>받은 등급으로 월 한도액과 본인부담을 계산해 보세요.</p><a class="btn block" href="#/result">결과·비용 보기</a></div>';
  view.innerHTML = '<h1>' + esc(alias()) + ' 방문조사 준비</h1>' + exBanner() +
    (flags.recovered.length ? '<p class="card danger small" role="alert">저장된 기록 일부가 손상돼 읽을 수 없는 부분을 정리했어요. 백업 파일이 있으면 <a href="#/settings">설정</a>에서 가져오세요.</p>' : '') +
    dcard + stageCard +
    '<div class="card"><h2>최근 7일 기록</h2><ol class="dots" id="dots">' + dots + '</ol><p style="margin:2px 0 10px" id="daycount"><b>7일 중 ' + sum.dayCount + '일</b> 기록했어요' + (sum.dayCount >= 4 ? ' · 잘하고 계세요' : ' · 하루 1분이면 충분해요') + '</p>' +
    '<div class="row"><button class="btn pri grow big" type="button" data-act="record">＋ 오늘 기록</button><button class="btn grow" type="button" data-act="same"' + (ycnt ? '' : ' aria-describedby="same-h"') + '>어제와 같음</button></div>' +
    (ycnt ? '' : '<p class="hint" id="same-h">어제 기록이 있으면 한 번에 오늘로 옮길 수 있어요.</p>') + '</div>' +
    '<div class="card"><h2>오늘 할 일 하나</h2><label class="ck" style="border:0"><input type="checkbox" id="todo"' + (tdone ? ' checked' : '') + '><span>' + esc(todo) + '</span></label></div>' +
    '<div class="card" id="bprev" aria-live="polite"><h2>브리핑 미리보기</h2>' +
    (lines.length ? '<ul class="bl">' + lines.slice(-3).reverse().map(function (x) { return '<li><span class="tag">' + esc(x.domain) + '</span> ' + esc(x.text) + '</li>'; }).join('') + '</ul>' + (lines.length > 3 ? '<p class="muted small">외 ' + (lines.length - 3) + '개 항목</p>' : '') + '<a class="btn block" href="#/brief">브리핑 전체 보기</a>'
      : '<p class="muted">아직 기록이 없어요. 오늘 있었던 일 하나만 기록하면 여기에 바로 한 줄이 생겨요.</p>') + '</div>' +
    privacyLine() +
    '<button class="fab" type="button" data-act="record">＋ 기록</button>';
  if (flags.firstRecord) { flags.firstRecord = false; setTimeout(function () { openRecord({ first: true }); }, 0); }
  $('#todo', view).addEventListener('change', function (e) { if (e.target.checked) S.prefs.todo[t] = true; else delete S.prefs.todo[t]; save(['prefs']); });
};
/* ---------- 기록 시트 (바텀시트) ---------- */
function openRecord(o) {
  o = o || {};
  var ed = o.id ? S.logs.filter(function (l) { return l.id === o.id; })[0] : null;
  var t = today(), h = now().getHours();
  var cur = ed || { date: t, slot: R.slotOf(h, D), domain: o.domain || '', item: '', help: null, risk: [], dayTag: 'usual', note: '' };
  var dateOpts = '';
  for (var i = 0; i < 7; i++) { var dt = R.addDays(t, -i); dateOpts += '<option value="' + dt + '"' + (cur.date === dt ? ' selected' : '') + '>' + (i === 0 ? '오늘 ' : i === 1 ? '어제 ' : i === 2 ? '그제 ' : '') + R.fmtS(dt) + '</option>'; }
  if (ed && R.diffDays(ed.date, t) > 6) dateOpts += '<option value="' + ed.date + '" selected>' + R.fmtS(ed.date) + '</option>';
  var title = ed ? '기록 고치기' : o.first ? '오늘 있었던 일 하나만 기록해 볼까요?' : '기록하기';
  openModal('<h2 id="mh">' + esc(title) + '</h2>' +
    (o.first ? '<p class="muted small" style="margin-top:0">영역 → 항목 → 도움 수준을 누르고 저장하면 끝이에요.</p>' : '') +
    '<form id="rf" novalidate>' +
    '<fieldset><legend>영역</legend>' + chips('dom', D.domains, cur.domain) + '</fieldset>' +
    '<fieldset id="itemset"><legend>무엇을 <span class="muted small">(공단 공식 문항 아님)</span></legend><div id="items"></div><p class="err" id="e-item" role="alert"></p></fieldset>' +
    '<fieldset><legend>얼마나 도와드렸나요?</legend><div class="lvs">' + D.help.map(function (x) { return '<label class="lv lv' + x.v + '"><input type="radio" name="help" value="' + x.v + '"' + (cur.help === x.v ? ' checked' : '') + '><span class="b"><span class="ic" aria-hidden="true">' + x.icon + '</span>' + esc(x.label) + '</span></label>'; }).join('') + '</div><p class="err" id="e-help" role="alert"></p></fieldset>' +
    '<fieldset><legend>언제</legend><label class="sr" for="rdate">날짜</label><select id="rdate">' + dateOpts + '</select><div style="margin-top:8px">' + chips('slot', D.slots, cur.slot) + '</div></fieldset>' +
    '<fieldset><legend>위험한 일이 있었나요? <span class="muted small">(있을 때만)</span></legend>' + chips('risk', D.risks, cur.risk, 'checkbox', 'risk') + '</fieldset>' +
    '<fieldset><legend>오늘 상태</legend>' + chips('tag', D.dayTags, cur.dayTag) + '</fieldset>' +
    '<label class="f" for="rnote">메모 한 줄 <span class="muted small">(선택 · 이름 대신 호칭)</span></label><input type="text" id="rnote" maxlength="60" value="' + esc(cur.note) + '" placeholder="예) 새벽 2시 화장실 앞에서 넘어지심" autocomplete="off">' +
    '<div class="sheet-foot"><button class="btn pri block big" type="submit" id="rsave">저장</button>' +
    (ed ? '<div class="row" style="margin-top:8px"><button class="btn grow" type="button" id="rdup">오늘도 같음</button><button class="btn danger grow" type="button" id="rdel">삭제</button></div>' : '') +
    '<button class="btn ghost block" type="button" data-dismiss="1" style="margin-top:8px">닫기</button></div>' +
    '</form>', function (bg) {
    var f = $('#rf', bg);
    function drawItems(keep) {
      var dm = D.domains.filter(function (d) { return d.id === val('dom', f); })[0];
      $('#items', f).innerHTML = dm ? chips('item', dm.items, keep) : '<p class="muted small" style="margin:0">먼저 위에서 영역을 골라 주세요.</p>';
    }
    drawItems(cur.item);
    f.addEventListener('change', function (e) {
      if (e.target.name === 'dom') { drawItems(''); $('#e-item', f).textContent = ''; var first = $('input[name=item]', f); if (first) $('#itemset', f).scrollIntoView({ block: 'nearest' }); }
      if (e.target.name === 'item') $('#e-item', f).textContent = '';
      if (e.target.name === 'help') $('#e-help', f).textContent = '';
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = val('item', f), help = val('help', f);
      $('#e-item', f).textContent = item ? '' : (val('dom', f) ? '항목을 하나 골라 주세요.' : '영역과 항목을 골라 주세요.');
      $('#e-help', f).textContent = help !== '' ? '' : '도움 수준을 골라 주세요.';
      if (!item || help === '') { (item ? $('input[name=help]', f) : ($('input[name=item]', f) || $('input[name=dom]', f))).focus(); return; }
      var rec = R.cleanLog({ id: ed ? ed.id : uid(), date: $('#rdate', f).value, slot: val('slot', f), item: item, help: +help, risk: vals('risk', f), dayTag: val('tag', f), note: $('#rnote', f).value, author: ed ? ed.author : S.profile.author, ts: new Date().toISOString() }, D);
      if (!rec) { toast('저장할 수 없는 값이 있어요. 다시 확인해 주세요.'); return; }
      if (ed) S.logs = S.logs.map(function (l) { return l.id === ed.id ? rec : l; }); else S.logs.push(rec);
      if (!save(['logs'])) return;
      closeModal(); render(true);
      toast((ed ? '고쳤어요' : '저장했어요') + ' · 브리핑에 바로 반영됐어요');
    });
    if (ed) {
      $('#rdup', bg).addEventListener('click', function () { var c = R.cleanLog(Object.assign({}, ed, { id: uid(), date: today(), risk: [], ts: new Date().toISOString() }), D); S.logs.push(c); save(['logs']); closeModal(); render(true); toast('오늘 기록으로 하나 더 저장했어요'); });
      $('#rdel', bg).addEventListener('click', function () { confirmBox('이 기록을 지울까요?', esc(R.fmtS(ed.date) + ' ' + (R.findItem(D, ed.item).item.label)) + ' 기록을 지워요. 되돌릴 수 없어요.', '삭제', function () { S.logs = S.logs.filter(function (l) { return l.id !== ed.id; }); save(['logs']); render(true); toast('기록을 지웠어요'); }, true); });
    }
  });
}
/* ---------- 어제와 같음 ---------- */
function openSame() {
  var t = today(), yd = R.addDays(t, -1), ys = S.logs.filter(function (l) { return l.date === yd; });
  if (!ys.length) { openModal('<h2 id="mh">어제 기록이 없어요</h2><p>어제(' + R.fmtS(yd) + ') 기록이 있어야 그대로 옮길 수 있어요. 오늘 있었던 일을 새로 기록해 주세요.</p><button class="btn pri block" type="button" id="go-rec">오늘 기록하기</button><button class="btn ghost block" type="button" data-dismiss="1" style="margin-top:8px">닫기</button>', function (bg) { $('#go-rec', bg).addEventListener('click', function () { closeModal(); openRecord({}); }); }); return; }
  openModal('<h2 id="mh">어제와 같은 일을 오늘로</h2><p class="muted small" style="margin-top:0">오늘도 똑같았던 것만 고르세요. 위험한 일은 날마다 다르니 기본으로 빼 두었어요.</p><form id="sf">' +
    ys.map(function (l) { var it = R.findItem(D, l.item).item; return '<label class="ck"><input type="checkbox" name="same" value="' + esc(l.id) + '"' + (l.risk.length ? '' : ' checked') + '><span><b>' + esc(it.label) + '</b> ' + hl(l.help) + ' <span class="muted small">' + esc(R.slotLabel(l.slot, D)) + (l.risk.length ? ' · 위험: ' + l.risk.map(function (r) { return R.riskLabel(r, D); }).join(', ') : '') + '</span></span></label>'; }).join('') +
    '<button class="btn pri block big" type="submit" style="margin-top:12px">오늘 기록으로 저장</button><button class="btn ghost block" type="button" data-dismiss="1" style="margin-top:8px">닫기</button></form>', function (bg) {
    $('#sf', bg).addEventListener('submit', function (e) {
      e.preventDefault(); var ids = vals('same', bg); if (!ids.length) { toast('옮길 기록을 하나 이상 골라 주세요.'); return; }
      ys.filter(function (l) { return ids.indexOf(l.id) >= 0; }).forEach(function (l) { S.logs.push(R.cleanLog(Object.assign({}, l, { id: uid(), date: t, risk: [], dayTag: 'usual', ts: new Date().toISOString(), author: S.profile.author }), D)); });
      save(['logs']); closeModal(); render(true); toast(ids.length + '개를 오늘 기록으로 저장했어요');
    });
  });
}
/* ---------- 기록 목록 ---------- */
routes.log = function (view) {
  var by = {}; S.logs.forEach(function (l) { (by[l.date] = by[l.date] || []).push(l); });
  var dates = Object.keys(by).sort().reverse(), order = D.slots.map(function (s) { return s.id; });
  view.innerHTML = '<h1>기록</h1>' + exBanner() +
    '<p class="muted small">기록을 누르면 고치거나 지울 수 있어요. 기록 항목은 가족용 생활 항목이며 공단 공식 조사 문항이 아니에요.</p>' +
    (dates.length ? dates.map(function (d) {
      return '<h2 class="day-h">' + R.fmtD(d) + ' <span class="muted small">' + by[d].length + '건</span></h2><ul class="list">' + by[d].sort(function (a, b) { return order.indexOf(a.slot) - order.indexOf(b.slot); }).map(function (l) {
        var f = R.findItem(D, l.item);
        return '<li><button type="button" class="entry" data-edit="' + esc(l.id) + '"><span class="i" aria-hidden="true">' + f.domain.icon + '</span><span><span class="t">' + esc(f.item.label) + '</span> ' + hl(l.help) +
          '<span class="m" style="display:block">' + esc(R.slotLabel(l.slot, D)) + ' · ' + esc(lbl(D.dayTags, l.dayTag)) + ' · 기록: ' + esc(l.author) + '</span>' +
          (l.risk.length ? '<span style="display:block">' + l.risk.map(function (r) { return '<span class="tag red">⚠ ' + esc(R.riskLabel(r, D)) + '</span>'; }).join(' ') + '</span>' : '') +
          (l.note ? '<span class="m" style="display:block">“' + esc(l.note) + '”</span>' : '') + '<span class="sr"> — 고치기</span></span></button></li>';
      }).join('') + '</ul>';
    }).join('') : '<div class="card"><h2>아직 기록이 없어요</h2><p>오늘 있었던 일 하나만 기록해 보세요. 영역 → 항목 → 도움 수준, 세 번 누르면 끝나요.</p><button class="btn pri block big" type="button" data-act="record">＋ 첫 기록 하기</button></div>') +
    (dates.length ? '<button class="fab" type="button" data-act="record">＋ 기록</button>' : '');
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-edit]'); if (b) openRecord({ id: b.getAttribute('data-edit') }); });
};
/* ---------- 조사일 브리핑 (A4 한 장) ---------- */
function briefTabs(cur) { return '<nav class="tabs2 screen-only" aria-label="브리핑 보기 방식"><a href="#/brief"' + (cur === 'brief' ? ' aria-current="page"' : '') + '>브리핑</a><a href="#/guide"' + (cur === 'guide' ? ' aria-current="page"' : '') + '>말 바꾸기 가이드</a></nav>'; }
function sayList(sum) {
  var all = [];
  sum.domains.forEach(function (dm) { dm.items.forEach(function (it) { var hp = it.n - it.dist[0]; if (hp > 0) all.push({ it: it, score: hp * 10 + it.dist[3] * 3 + it.bad }); }); });
  all.sort(function (a, b) { return b.score - a.score; });
  var out = all.slice(0, 3).map(function (x) { return R.concrete(x.it, D); });
  if (sum.risks.length) out.unshift('최근 7일 위험한 일 ' + sum.risks.length + '건: ' + sum.risks.slice(0, 3).map(function (r) { return R.fmtS(r.date) + ' ' + R.slotLabel(r.slot, D) + ' ' + R.riskLabel(r.risk, D); }).join(', ') + (sum.risks.length > 3 ? ' 외' : '') + '.');
  return out.slice(0, 4);
}
routes.brief = function (view) {
  var p = S.profile, t = today(), sum = sumNow(t), c = S.care;
  var head = '<h1>조사일 브리핑</h1>' + briefTabs('brief') + '<div class="screen-only">' + exBanner() + '</div>';
  if (!sum.total) {
    view.innerHTML = head + '<div class="card"><h2>최근 7일 기록이 없어요</h2><p>' + R.fmtS(sum.start) + '~' + R.fmtS(sum.end) + ' 사이에 기록이 있어야 브리핑이 만들어져요. 오늘 있었던 일 하나부터 기록해 보세요.</p><button class="btn pri block big" type="button" data-act="record">＋ 기록하기</button></div>';
    return;
  }
  var say = sayList(sum);
  var dom = sum.domains.filter(function (d) { return d.items.length; }).map(function (dm) {
    return '<h3><span aria-hidden="true">' + dm.icon + '</span> ' + esc(dm.label) + ' <span class="meta">(' + dm.n + '회)</span></h3><ul class="bl">' + dm.items.map(function (it) { return '<li>' + esc(R.itemLine(it, D)) + '</li>'; }).join('') + '</ul>';
  }).join('');
  var risk = sum.risks.length ? '<div class="tbl-wrap" tabindex="0" role="region" aria-label="위험 사건 표"><table class="tbl"><caption class="sr">위험 사건 목록</caption><thead><tr><th scope="col">날짜</th><th scope="col">때</th><th scope="col">사건</th><th scope="col">관련·메모</th></tr></thead><tbody>' +
    sum.risks.map(function (r) { return '<tr><td class="nw">' + R.fmtS(r.date) + '</td><td class="nw">' + esc(R.slotLabel(r.slot, D)) + '</td><td class="nw"><b>' + esc(R.riskLabel(r.risk, D)) + '</b></td><td>' + esc(r.item) + (r.note ? ' · ' + esc(r.note) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p>최근 7일 기록된 위험 사건 없음</p>';
  var meds = c.meds.length ? '<ul class="bl">' + c.meds.map(function (m) { return '<li>' + esc(m.name) + (m.when ? ' — ' + esc(m.when) : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">복용약 목록이 비어 있어요. <a class="screen-only" href="#/care">채우기</a></p>';
  view.innerHTML = head +
    '<div class="row screen-only" style="margin:8px 0"><button class="btn pri grow big" type="button" id="print">인쇄·PDF 저장 (A4 1장)</button><a class="btn grow" href="#/care">약·돌봄 정보 채우기</a></div>' +
    '<article class="sheet" id="sheet" aria-labelledby="sh-t">' +
    '<h2 id="sh-t">방문조사 브리핑 — ' + esc(alias()) + (ageLabel() ? ' (' + esc(ageLabel()) + ')' : '') + (S.prefs.example ? ' <span class="tag ex">예시</span>' : '') + '</h2>' +
    '<p class="meta">기록 기간 ' + R.fmtD(sum.start) + ' ~ ' + R.fmtD(sum.end) + ' · 7일 중 ' + sum.dayCount + '일, ' + sum.total + '회 기록' + (p.visitDate ? ' · 조사일 ' + R.fmtD(p.visitDate) + (p.visitTime ? ' ' + esc(p.visitTime) : '') : '') + ' · 좋은 날 ' + sum.tags.good + '회 / 나쁜 날 ' + sum.tags.bad + '회</p>' +
    '<h3>조사원께 꼭 말씀드릴 것</h3><ol class="bl say">' + say.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
    '<div class="cols"><div>' + dom + '</div><div>' +
    '<h3>위험 사건</h3>' + risk +
    '<h3>복용약</h3>' + meds +
    '<h3>돌봄 상황</h3><p>주 돌봄자: <b>' + esc(c.caregiver || '미입력') + '</b> · 혼자 있는 시간: <b>' + esc(c.alone || '미입력') + '</b></p>' +
    (c.memo ? '<h3>동석 보호자 메모</h3><p>' + esc(c.memo) + '</p>' : '') + '</div></div>' +
    '<p class="fine">도움 수준: 혼자 함 · 말로 안내 · 준비·일부 도움 · 전적 도움(가족이 본 횟수). 이 기록은 가족이 적은 생활 기록이며 공단 공식 조사표 문항이 아니고, 등급이나 점수를 예측하지 않아요. 판정은 국민건강보험공단이 합니다(☎ 1577-1000). 만든 곳: 방문조사 7일 노트</p>' +
    '</article>' +
    '<p class="muted small screen-only">브리핑은 조사원께 보여드리는 참고 자료예요. 과장하지도 줄이지도 말고, 기록된 횟수 그대로 전해 주세요.</p>';
  $('#print', view).addEventListener('click', function () { window.print(); });
};
routes.guide = function (view) {
  var sum = sumNow(today()), rec = [];
  sum.domains.forEach(function (dm) { dm.items.forEach(function (it) { rec.push(it); }); });
  var recIds = rec.map(function (x) { return x.id; });
  var tpl = [];
  D.domains.forEach(function (dm) { dm.items.forEach(function (it) { if (recIds.indexOf(it.id) < 0 && tpl.length < 5 && dm.id !== 'env') tpl.push(it); }); });
  var text = rec.map(function (it) { return R.concrete(it, D); }).join('\n');
  view.innerHTML = '<h1>말 바꾸기 가이드</h1>' + briefTabs('guide') + exBanner() +
    '<p>“괜찮아요”, “혼자 해요” 같은 말은 조사원이 평소 상태를 알기 어려워요. 기록된 <b>횟수와 도움 수준</b>으로 바꿔 말해 보세요. (AI 없이 기록에서 바로 만든 문장이에요)</p>' +
    (rec.length ? '<h2>내 기록으로 만든 문장</h2>' + rec.map(function (it) { return '<div class="vs"><span class="v"><span class="sr">모호한 말: </span>“' + esc(it.vague) + '”</span><span class="c"><span class="sr">구체적인 말: </span>→ ' + esc(R.concrete(it, D)) + '</span></div>'; }).join('') +
      '<button class="btn pri block" type="button" id="cp">문장 모두 복사</button>'
      : '<div class="card"><h2>아직 기록이 없어요</h2><p>기록이 쌓이면 여기 문장이 자동으로 채워져요.</p><button class="btn pri block" type="button" data-act="record">＋ 기록하기</button></div>') +
    '<h2 style="margin-top:22px">이렇게 바꿔 보세요 (빈칸 예시)</h2>' + tpl.map(function (it) { return '<div class="vs"><span class="v">“' + esc(it.vague) + '”</span><span class="c">→ 최근 7일 동안 ' + esc(it.label) + ' ___회 중 ___회는 도움이 필요했어요.</span></div>'; }).join('') +
    '<div class="card soft"><h2>조사 당일 팁</h2><ul><li>“좋은 날 한 번”과 “평소”를 나눠 말해 주세요. 기록의 나쁜 날 횟수를 보여 드리면 좋아요.</li><li>어르신이 “다 혼자 해요”라고 하셔도 다그치지 말고, 나중에 조사원께 기록을 따로 보여 드리세요.</li><li>보조기구·약 봉투는 평소 자리에 그대로 두세요.</li></ul></div>';
  var cp = $('#cp', view); if (cp) cp.addEventListener('click', function () { copyText(text, '문장'); });
};
/* ---------- 브리핑 정보(약·돌봄) ---------- */
routes.care = function (view) {
  var c = S.care;
  view.innerHTML = '<h1>약·돌봄 정보</h1>' + exBanner() + '<p class="muted small">브리핑에 들어가요. 이름 대신 호칭으로 적어 주세요.</p>' +
    '<div class="card"><h2>복용약</h2><ul class="list" id="medl">' + (c.meds.length ? c.meds.map(function (m, i) { return '<li class="row" style="border-bottom:1px solid var(--line);padding:6px 0"><span class="grow"><b>' + esc(m.name) + '</b>' + (m.when ? ' <span class="muted">' + esc(m.when) + '</span>' : '') + '</span><button class="btn ghost" type="button" data-rm="' + i + '">삭제<span class="sr"> ' + esc(m.name) + '</span></button></li>'; }).join('') : '<li class="muted">아직 없어요.</li>') + '</ul>' +
    '<form id="mf" novalidate><label class="f" for="mn">약 이름</label><input type="text" id="mn" maxlength="30" placeholder="예) 혈압약, 아리셉트" autocomplete="off"><label class="f" for="mw">먹는 때</label><input type="text" id="mw" maxlength="30" placeholder="예) 아침·저녁 식후" autocomplete="off"><p class="err" id="e-mn" role="alert"></p><button class="btn block" type="submit" style="margin-top:10px">＋ 약 추가</button></form></div>' +
    '<div class="card"><fieldset style="margin-top:0"><legend>주로 돌보는 사람</legend>' + chips('cg', D.caregivers, c.caregiver) + '</fieldset>' +
    '<fieldset><legend>혼자 있는 시간</legend>' + chips('al', D.aloneHours, c.alone) + '</fieldset>' +
    '<label class="f" for="memo">동석 보호자 메모 <span class="muted small">(조사 때 꼭 말할 것)</span></label><textarea id="memo" maxlength="400">' + esc(c.memo) + '</textarea>' +
    '<button class="btn pri block" type="button" id="csave" style="margin-top:12px">저장</button></div>' +
    '<a class="btn ghost block" href="#/brief">브리핑으로 돌아가기</a>';
  $('#mf', view).addEventListener('submit', function (e) {
    e.preventDefault(); var n = $('#mn', view).value.trim();
    if (!n) { $('#e-mn', view).textContent = '약 이름을 적어 주세요.'; $('#mn', view).focus(); return; }
    S.care.meds.push({ name: n.slice(0, 30), when: $('#mw', view).value.trim().slice(0, 30) }); save(['care']); render(true); toast('약을 추가했어요');
  });
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { S.care.meds.splice(+b.getAttribute('data-rm'), 1); save(['care']); render(true); toast('약을 지웠어요'); } });
  $('#csave', view).addEventListener('click', function () { S.care.caregiver = val('cg', view); S.care.alone = val('al', view); S.care.memo = $('#memo', view).value.slice(0, 400); save(['care']); toast('저장했어요 · 브리핑에 반영됐어요'); });
};
/* ---------- 준비물 체크리스트 ---------- */
routes.check = function (view) {
  var p = S.profile, u65 = p.ageBand === 'u65';
  var list = D.checklist.filter(function (c) { return c.when === 'proxy' ? p.proxy !== 'self' : c.when === 'proxy2' ? (p.proxy === 'official' || p.proxy === 'designated') : true; });
  var done = list.filter(function (c) { return S.checklist[c.id]; }).length, pct = Math.round(done / list.length * 100);
  var PX = [{ id: 'self', label: '본인' }, { id: 'family', label: '가족·친족' }, { id: 'official', label: '공무원·치매안심센터장' }, { id: 'designated', label: '시·군·구 지정 대리인' }];
  view.innerHTML = '<h1>준비물 체크리스트</h1>' + exBanner() +
    '<div class="card"><p style="margin:0"><b id="ckn">' + done + ' / ' + list.length + '</b> 준비했어요</p><div class="prog" role="progressbar" aria-label="준비 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div></div>' +
    '<fieldset><legend>누가 신청하나요?</legend>' + chips('px', PX, p.proxy) + '</fieldset>' +
    '<div class="card" id="ckl">' + list.map(function (c) {
      var note = c.id === 'doc' ? (u65 ? '65세 미만은 신청서와 함께 제출해야 해요.' : p.ageBand ? '65세 이상은 등급판정위원회 심의자료 제출 전까지 내도 돼요.' : '65세 미만은 신청 때 함께, 65세 이상은 심의 전까지') : c.note;
      return '<label class="ck"><input type="checkbox" data-ck="' + c.id + '"' + (S.checklist[c.id] ? ' checked' : '') + '><span><b>' + esc(c.label) + ' ' + (c.req ? '<span class="tag">필수</span>' : '<span class="tag">권장</span>') + '</b><span class="muted small">' + esc(note) + '</span></span></label>';
    }).join('') + '</div>' + srcs(D.checklistSrc) +
    '<p class="muted small">권장 항목은 법정 서류가 아니에요. 서류 기준은 국민건강보험공단(☎ <a href="tel:15771000">1577-1000</a>)에 확인하세요.</p>';
  view.addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-ck');
    if (id) { if (e.target.checked) S.checklist[id] = true; else delete S.checklist[id]; save(['checklist']); render(true); var x = $('[data-ck="' + id + '"]'); if (x) x.focus(); }
    if (e.target.name === 'px') { S.profile.proxy = e.target.value; save(['profile']); render(true); var y = $('input[name=px]:checked'); if (y) y.focus(); }
  });
};
/* ---------- 일정·기한 ---------- */
function timelineEvents() {
  var p = S.profile, ev = [], dd = R.decisionDates(p.applyDate, L), dl = R.appealDeadline(p.resultDate, p.dispDate, L);
  if (p.visitDate) ev.push({ id: 'visit', date: p.visitDate, time: p.visitTime, title: '장기요양 방문조사', desc: '방문조사 7일 노트 브리핑을 인쇄해 두세요. 문의 국민건강보험공단 1577-1000', alarms: [1] });
  if (dd && p.stage !== 'result' && p.stage !== 'fail') ev.push({ id: 'decision', date: dd.d30, title: '등급판정 예상일(원칙 30일)', desc: '신청일부터 30일 이내 판정이 원칙(노인장기요양보험법 제16조). 부득이하면 30일 이내 연장될 수 있어요(최대 ' + dd.d60 + ').', alarms: [] });
  if (dl && p.stage === 'fail') {
    ev.push({ id: 'appeal', date: dl.final, title: '장기요양 이의신청(심사청구) 마감', desc: '처분을 안 날부터 90일, 처분일부터 180일 중 이른 날(노인장기요양보험법 제55조). 통지서에 적힌 기한을 우선 확인하세요. 문의 1577-1000', alarms: [14, 7, 3] });
    ev.push({ id: 'reapply', date: R.reapplyDate(p.resultDate, L), title: '재신청 검토(관행 3개월 · 법정 기준 아님)', desc: '상태 변화가 있으면 다시 신청할 수 있어요. 3개월은 관행이며 법정 기준이 아니에요.', alarms: [7] });
  }
  return ev;
}
function icsDownload(ev, name) {
  if (!ev.length) { toast('넣을 날짜가 아직 없어요. 날짜를 먼저 입력해 주세요.'); return; }
  download(name, new Blob([R.ics(ev, new Date())], { type: 'text/calendar;charset=utf-8' })); toast('일정 파일(.ics)을 저장했어요. 열면 달력에 추가돼요.');
}
routes.timeline = function (view) {
  var p = S.profile, t = today(), dd = R.decisionDates(p.applyDate, L), dl = R.appealDeadline(p.resultDate, p.dispDate, L);
  var steps = [];
  steps.push(['신청', p.applyDate ? R.fmtD(p.applyDate) : '날짜 미입력', p.applyDate]);
  steps.push(['방문조사', p.visitDate ? R.fmtD(p.visitDate) + (p.visitTime ? ' ' + p.visitTime : '') + ' · ' + R.dLabel(t, p.visitDate) : '날짜 미입력', p.visitDate]);
  steps.push(['판정 예상', dd ? R.fmtD(dd.d30) + ' <span class="tag">원칙</span><br><span class="muted small">신청일부터 30일 이내가 원칙이며, 정밀조사 등 부득이하면 30일 이내 연장될 수 있어요(최대 ' + R.fmtS(dd.d60) + ').</span>' : '신청일을 넣으면 계산해요', dd && dd.d30]);
  if (p.stage === 'fail') {
    steps.push(['이의신청 마감', dl ? '<b>' + R.fmtD(dl.final) + '</b> · ' + R.dLabel(t, dl.final) : '결과 통지 받은 날을 넣으면 계산해요', dl && dl.final]);
    steps.push(['재신청 검토', dl ? R.fmtD(R.reapplyDate(p.resultDate, L)) + ' <span class="tag">관행 · 법정 기준 아님</span>' : '-', null]);
  }
  view.innerHTML = '<h1>일정·기한</h1>' + exBanner() +
    '<form id="tf" class="card" novalidate><fieldset style="margin-top:0"><legend>지금 단계</legend>' + chips('stage', D.stages, p.stage) + '</fieldset>' +
    '<label class="f" for="ad">신청일</label><input type="date" id="ad" value="' + esc(p.applyDate) + '">' +
    '<div class="row"><div class="grow"><label class="f" for="vd">방문조사 날짜</label><input type="date" id="vd" value="' + esc(p.visitDate) + '"></div><div class="grow"><label class="f" for="vt">시간(선택)</label><input type="time" id="vt" value="' + esc(p.visitTime) + '"></div></div>' +
    (p.stage === 'fail' || p.stage === 'result' ? '<label class="f" for="rd">결과 통지를 받은 날</label><input type="date" id="rd" value="' + esc(p.resultDate) + '">' : '') +
    '<p class="err" id="e-t" role="alert"></p><button class="btn pri block" type="submit" style="margin-top:12px">저장</button></form>' +
    '<div class="card"><h2>한눈에 보기</h2><dl class="kv" id="tl">' + steps.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd style="text-align:left">' + s[1] + '</dd>'; }).join('') + '</dl>' +
    '<button class="btn block" type="button" id="ics">달력에 넣기 (.ics 파일)</button></div>' + srcs(['law-16', 'law-55']);
  $('#tf', view).addEventListener('submit', function (e) {
    e.preventDefault(); var ad = $('#ad', view).value, vd = $('#vd', view).value, vt = $('#vt', view).value, rd = $('#rd', view) ? $('#rd', view).value : p.resultDate, msg = '';
    if ([ad, vd, rd].some(function (x) { return x && !R.isD(x); })) msg = '날짜 형식을 확인해 주세요.';
    else if (ad && vd && vd < ad) msg = '방문조사 날짜가 신청일보다 빨라요. 다시 확인해 주세요.';
    else if (rd && rd > t) msg = '결과 통지를 받은 날이 오늘보다 뒤예요. 다시 확인해 주세요.';
    $('#e-t', view).textContent = msg; if (msg) return;
    p.stage = val('stage', view) || p.stage; p.applyDate = ad; p.visitDate = vd; p.visitTime = R.isTime(vt) ? vt : ''; p.resultDate = rd || '';
    save(['profile']); render(true); toast('일정을 저장했어요');
  });
  $('#ics', view).addEventListener('click', function () { icsDownload(timelineEvents(), 'vn7-schedule.ics'); });
  view.addEventListener('change', function (e) { if (e.target.name === 'stage') { p.stage = e.target.value; save(['profile']); render(true); var y = $('input[name=stage]:checked'); if (y) y.focus(); } });
};
/* ---------- 결과·비용 (등급 예측 없음: 받은 등급을 고르면 금액만 보여 줌) ---------- */
routes.result = function (view) {
  var p = S.profile, GR = L.gradeOrder.map(function (g) { return { id: g, label: L.gradeLabel[g] }; }).concat([{ id: 'none', label: '등급외' }]);
  var TY = L.copayTypes.map(function (t) { return { id: t.id, label: t.label + ' ' + t.pct }; });
  view.innerHTML = '<h1>결과·비용</h1>' + exBanner() +
    '<p class="notice-strip">이 화면은 <b>이미 받은 등급</b>의 금액을 보여 줘요. 등급이나 점수를 예측하지 않아요. 판정은 국민건강보험공단이 해요.</p>' +
    '<form id="cf" novalidate><fieldset><legend>받은 등급</legend>' + chips('grade', GR, p.grade) + '</fieldset>' +
    '<fieldset><legend>본인부담 구분 <span class="muted small">(장기요양인정서·감경 통지에 적혀 있어요)</span></legend>' + chips('ctype', TY, p.copayType) + '</fieldset>' +
    '<label class="f" for="use">한 달 이용 예정 금액 <span class="muted small">(선택 · 원)</span></label><input type="text" inputmode="numeric" id="use" placeholder="예) 1800000" autocomplete="off" aria-describedby="use-h e-use"><p class="hint" id="use-h">방문요양·주야간보호 등 재가급여 합계예요. 비우면 한도를 꽉 채워 쓸 때로 계산해요.</p><p class="err" id="e-use" role="alert"></p></form>' +
    '<div id="cost" aria-live="polite"></div>' +
    '<details class="card"><summary>2026 등급별 월 한도액·본인부담 전체 표</summary><div class="tbl-wrap" tabindex="0" role="region" aria-label="등급별 금액 표"><table class="tbl" id="ctable"><caption class="sr">등급별 월 한도액과 한도를 꽉 채울 때 본인부담</caption><thead><tr><th scope="col">등급</th><th scope="col" class="n">월 한도액</th>' + L.copayTypes.map(function (t) { return '<th scope="col" class="n">' + t.pct + '</th>'; }).join('') + '</tr></thead><tbody>' +
    R.costTable(L).map(function (r) { return '<tr><th scope="row">' + esc(r.label) + '</th><td class="n">' + W(r.limit) + '</td>' + r.byType.map(function (b) { return '<td class="n">' + W(b.max) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div><p class="src">재가급여(복지용구 제외) 기준 · ' + esc(L.rounding) + '</p></details>' +
    srcs(['ltc-limit', 'notice-13']);
  var f = $('#cf', view);
  function draw() {
    var g = val('grade', f), ty = val('ctype', f) || 'normal', raw = $('#use', f).value.replace(/[,\s원]/g, ''), out = $('#cost', view);
    var use = null; $('#e-use', f).textContent = '';
    if (raw !== '') { if (!/^\d{1,9}$/.test(raw)) { $('#e-use', f).textContent = '숫자만 적어 주세요(예: 1800000).'; } else use = +raw; }
    if (!g) { out.innerHTML = '<div class="card"><p style="margin:0">받은 등급을 고르면 월 한도액과 본인부담을 계산해요. 아직 결과 전이라면 위 전체 표를 참고만 해 주세요.</p></div>'; return; }
    if (g === 'none') { out.innerHTML = '<div class="card danger"><h2>등급외 판정</h2><p>등급외면 재가급여 월 한도액이 없어요(0원). 처분을 안 날부터 90일 안에 이의신청(심사청구)을 할 수 있어요.</p><a class="btn pri block" href="#/fail">등급외 도우미 열기</a></div>'; return; }
    var t = L.copayTypes.filter(function (x) { return x.id === ty; })[0], lim = R.limitOf(g, L), c = R.copay(lim, t.rate, use);
    out.innerHTML = '<div class="card soft" id="costcard">' + (S.prefs.example ? '<span class="tag ex">예시</span> ' : '') +
      '<p class="muted" style="margin:0">' + esc(L.gradeLabel[g]) + ' · 2026 재가급여 월 한도액</p><p class="big-n" id="limit">' + W(lim) + '</p>' +
      '<dl class="kv num"><dt>한도를 꽉 채우면 본인부담(' + t.pct + ')</dt><dd id="maxcp">월 ' + W(c.max) + '</dd><dt>그때 공단 부담</dt><dd>월 ' + W(lim - c.max) + '</dd></dl>' +
      (use != null ? '<h3>이용 예정 ' + W(use) + '일 때</h3><dl class="kv num" id="usebox"><dt>한도 안 ' + W(c.inLimit) + ' × ' + t.pct + '</dt><dd>' + W(c.copayIn) + '</dd>' + (c.over ? '<dt>한도 초과분(전액 본인부담)</dt><dd class="lock">+ ' + W(c.over) + '</dd>' : '') + '<dt>월 본인부담 합계</dt><dd id="usecp" class="big-n" style="font-size:26px">' + W(c.copay) + '</dd></dl>' : '') +
      '<p class="small"><b>한도 초과분은 전액 본인부담</b>이에요(노인장기요양보험법 제40조③). 복지용구·비급여(식재료비 등)·야간·휴일 가산은 따로예요.</p></div>' +
      '<div class="card"><h2>' + esc(t.label) + ' ' + t.pct + '의 근거</h2><p class="small">' + esc(t.basis) + '</p>' + srcs(t.src) + '<p class="muted small">감경 대상인지는 공단이 확인해 통지해요. 모르면 일반 15%로 보세요.</p></div>';
  }
  f.addEventListener('change', function (e) { if (e.target.name === 'grade') { p.grade = e.target.value; if (p.grade === 'none' && p.stage !== 'fail') p.stage = 'fail'; else if (p.grade !== 'none' && (p.stage === 'fail' || p.stage === 'wait' || p.stage === 'visit')) p.stage = 'result'; } if (e.target.name === 'ctype') p.copayType = e.target.value; save(['profile']); draw(); });
  $('#use', f).addEventListener('input', draw);
  draw();
};
/* ---------- 등급외 도우미 ---------- */
routes.fail = function (view) {
  var p = S.profile, t = today(), sum = sumNow(t), dl = R.appealDeadline(p.resultDate, p.dispDate, L);
  var draft = R.appealDraft({ alias: alias(), ageLabel: ageLabel(), resultDate: p.resultDate }, sum, dl, D, S.care);
  view.innerHTML = '<h1>등급외 도우미</h1>' + exBanner() +
    '<form id="ff" class="card" novalidate><h2>결과 통지</h2>' +
    '<label class="f" for="rd">결과 통지를 받은 날 <span class="muted small">(처분을 안 날)</span></label><input type="date" id="rd" value="' + esc(p.resultDate) + '" max="' + t + '">' +
    '<label class="f" for="pd">통지서에 적힌 처분일 <span class="muted small">(선택)</span></label><input type="date" id="pd" value="' + esc(p.dispDate) + '" max="' + t + '">' +
    '<p class="err" id="e-f" role="alert"></p><button class="btn pri block" type="submit" style="margin-top:12px">기한 계산</button></form>' +
    '<div class="card ' + (dl ? 'danger' : '') + '" id="dlcard">' + (dl
      ? '<p class="muted" style="margin:0">이의신청(심사청구) 마감</p><p class="big-n red" id="dlfinal">' + R.fmtD(dl.final) + '</p><p><b>' + R.dLabel(t, dl.final) + '</b> · ' + (dl.by === 180 ? '처분일부터 180일이 먼저 끝나요' : '안 날부터 90일') + '</p>' +
        '<ul class="small"><li>안 날부터 90일: ' + R.fmtD(dl.d90) + '</li>' + (dl.d180 ? '<li>처분일부터 180일: ' + R.fmtD(dl.d180) + '</li>' : '') + '</ul>' +
        (dl.weekend ? '<p class="small"><b>마감일이 주말이에요.</b> 민법상 다음 날로 늘어날 수 있지만, 이 앱은 늦지 않도록 원래 날짜를 마감으로 보여 줘요.</p>' : '') +
        '<p class="small">기간은 받은 날 다음 날부터 셉니다(초일 불산입). 통지서에 적힌 기한이 있으면 그 날짜를 우선하고, 늦어도 며칠 여유를 두고 문서(전자문서 포함)로 내세요.</p>' +
        '<button class="btn block" type="button" id="ics">마감일 달력에 넣기 (.ics · 14·7·3일 전 알림)</button>'
      : '<p style="margin:0">결과 통지를 받은 날을 넣으면 마감일을 계산해요.</p>') + '</div>' + srcs(['law-55', 'easylaw-appeal']) +
    '<div class="card"><h2>이의신청 “취지와 이유” 초안</h2><p class="small muted">기록에서 자동으로 만든 참고 문장이에요. 사실과 다른 내용은 고쳐서 쓰세요.</p>' + (sum.total ? '' : '<p class="small"><b>최근 7일 기록이 없어 이유가 비어 있어요.</b> 기록을 남기면 채워져요.</p>') +
    '<div class="draft" id="draft" tabindex="0" role="region" aria-label="이의신청 초안">' + esc(draft) + '</div><button class="btn pri block" type="button" id="cpd" style="margin-top:10px">초안 복사</button></div>' +
    '<div class="card warm"><h2>알아 두세요</h2><p class="small">업계 자료에 따르면 이의신청이 받아들여지는 비율은 낮아요(2023년 749건 중 6건, 공단 통계 인용). ' + src('caring') + '</p><p class="small">그래서 상태가 바뀌었거나 기록이 더 쌓였다면 <b>재신청</b>도 함께 생각해 보세요.</p></div>' +
    '<div class="card"><h2>재신청 검토일</h2><p>' + (p.resultDate ? '<b id="reapply">' + R.fmtD(R.reapplyDate(p.resultDate, L)) + '</b> (결과 통지일 + 3개월)' : '결과 통지일을 넣으면 계산해요.') + '</p><p class="small"><span class="tag">관행 · 법정 기준 아님</span> 3개월은 업계에서 흔히 권하는 간격일 뿐, 법으로 정한 기다림 기간이 아니에요.</p></div>' +
    '<p class="small">심사청구 방법·양식은 국민건강보험공단 ☎ <a href="tel:15771000">1577-1000</a>에 확인하세요. 심사 결정에도 불복하면 결정통지를 받은 날부터 90일 이내에 재심사를 청구할 수 있어요(제56조).</p>';
  $('#ff', view).addEventListener('submit', function (e) {
    e.preventDefault(); var rd = $('#rd', view).value, pd = $('#pd', view).value, msg = '';
    if (!rd) msg = '결과 통지를 받은 날을 넣어 주세요.'; else if (!R.isD(rd) || (pd && !R.isD(pd))) msg = '날짜 형식을 확인해 주세요.'; else if (rd > t) msg = '결과 통지를 받은 날이 오늘보다 뒤예요.'; else if (pd && pd > rd) msg = '처분일은 통지를 받은 날보다 늦을 수 없어요.';
    $('#e-f', view).textContent = msg; if (msg) { $('#rd', view).focus(); return; }
    p.resultDate = rd; p.dispDate = pd || ''; p.stage = 'fail'; p.grade = 'none'; save(['profile']); render(true); toast('마감일을 계산했어요');
  });
  $('#cpd', view).addEventListener('click', function () { copyText(draft, '초안'); });
  var ib = $('#ics', view); if (ib) ib.addEventListener('click', function () { icsDownload(timelineEvents().filter(function (x) { return x.id === 'appeal' || x.id === 'reapply'; }), 'vn7-appeal.ics'); });
};
/* ---------- 설정: 가족 공유·백업·전체 삭제 ---------- */
function exportObj() { return { app: R.APP_ID, version: 1, exportedAt: new Date().toISOString(), profile: S.profile, logs: S.logs, checklist: S.checklist, care: S.care }; }
function exportName() { return 'vn7-' + today().replace(/-/g, '') + '.json'; }
function shareFile() {
  var name = exportName(), blob = new Blob([JSON.stringify(exportObj(), null, 1)], { type: 'application/json' });
  var file = null; try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: '방문조사 7일 노트 기록', text: '내 기록 파일이에요. 앱의 설정 → 가족 기록 합치기로 열어 주세요.' }).catch(function (e) { if (e && e.name !== 'AbortError') { download(name, blob); toast('공유가 안 돼서 파일로 저장했어요.'); } });
  } else { download(name, blob); toast('이 기기는 파일 공유를 지원하지 않아 파일로 저장했어요. 카톡에서 파일로 보내 주세요.'); }
}
function importFile(file) {
  if (!file) return;
  if (file.size > 3000000) { toast('파일이 너무 커요(3MB 이하).'); return; }
  var rd = new FileReader();
  rd.onload = function () {
    var o = null; try { o = JSON.parse(rd.result); } catch (e) {}
    var inc = o && R.sanitizeImport(o, D, L);
    if (!inc) { openModal('<h2 id="mh">열 수 없는 파일이에요</h2><p>방문조사 7일 노트에서 내보낸 기록 파일(vn7-날짜.json)만 열 수 있어요. 파일이 손상됐거나 다른 앱 파일일 수 있어요.</p><button class="btn pri block" type="button" data-dismiss="1">확인</button>'); return; }
    var m = R.mergeAll({ profile: S.profile, logs: S.logs, checklist: S.checklist, care: S.care }, inc);
    openModal('<h2 id="mh">가족 기록 합치기</h2><p id="mprev">새 기록 <b>' + m.added + '개</b>를 더하고, 이미 있는 기록 <b>' + m.dup + '개</b>는 건너뛰어요.' + (inc.skipped ? ' 읽을 수 없는 ' + inc.skipped + '개는 제외했어요.' : '') + '</p>' +
      '<button class="btn pri block big" type="button" id="mmerge">합치기</button><button class="btn block" type="button" id="mrep" style="margin-top:8px">이 파일로 덮어쓰기(복원)</button><button class="btn ghost block" type="button" data-dismiss="1" style="margin-top:8px">취소</button>', function (bg) {
      $('#mmerge', bg).addEventListener('click', function () { S.profile = m.profile; S.logs = m.logs; S.checklist = m.checklist; S.care = m.care; S.prefs.onboarded = true; S.prefs.example = false; save(); closeModal(); render(true); toast('합쳤어요 · 새 기록 ' + m.added + '개, 중복 ' + m.dup + '개 건너뜀'); });
      $('#mrep', bg).addEventListener('click', function () { confirmBox('지금 기록을 덮어쓸까요?', '이 기기의 기록 ' + S.logs.length + '개가 파일 내용(' + inc.logs.length + '개)으로 바뀌어요.', '덮어쓰기', function () { S.profile = inc.profile; S.logs = inc.logs; S.checklist = inc.checklist; S.care = inc.care; S.prefs.onboarded = true; S.prefs.example = false; save(); render(true); toast('파일로 복원했어요'); }, true); });
    });
  };
  rd.onerror = function () { toast('파일을 읽지 못했어요. 다시 시도해 주세요.'); };
  rd.readAsText(file);
}
routes.settings = function (view) {
  var p = S.profile;
  view.innerHTML = '<h1>설정</h1>' + exBanner() +
    (S.prefs.onboarded ? '<form id="pf" class="card" novalidate><h2>기본 정보</h2><fieldset style="margin-top:0"><legend>호칭</legend>' + chips('alias', D.aliases, p.alias) + '</fieldset><fieldset><legend>나이</legend>' + chips('age', D.ageBands, p.ageBand) + '</fieldset>' +
      '<fieldset><legend>이 기기 기록자 표시 <span class="muted small">(형제자매 기록을 합칠 때 구분)</span></legend>' + chips('author', D.authors, p.author) + '</fieldset><button class="btn pri block" type="submit">저장</button></form>' : '') +
    '<div class="card"><h2>가족과 기록 나누기</h2><p class="small">서버 없이 <b>파일</b>로 주고받아요. 받은 사람은 아래 “가족 기록 합치기”로 열면 같은 기록은 한 번만 남아요.</p>' +
    '<button class="btn pri block" type="button" id="share">가족에게 보내기 (파일 공유)</button>' +
    '<button class="btn block" type="button" id="exp" style="margin-top:8px">파일로 내보내기 (백업)</button>' +
    '<label class="btn block" for="imp" style="margin-top:8px">가족 기록 합치기 · 백업 열기</label><input type="file" id="imp" accept=".json,application/json" class="sr"></div>' +
    '<div class="card"><h2>개인정보</h2><ul class="small"><li>모든 기록은 이 휴대폰 브라우저(localStorage)에만 저장돼요. 서버·분석 도구·광고가 없고 외부로 요청을 보내지 않아요.</li><li>이름·주민번호·주소는 묻지 않아요. 호칭만 써요. 메모에도 이름을 적지 마세요.</li><li>내보낸 파일에는 건강 기록이 들어 있어요. 믿을 수 있는 가족에게만 보내 주세요.</li><li>브라우저 데이터를 지우면 기록도 사라져요. 가끔 백업해 두세요.</li></ul>' +
    '<button class="btn danger block" type="button" id="wipe">전체 삭제</button></div>' +
    '<div class="card"><h2>앱 정보</h2><p class="small"><a href="#/info">출처·면책·등급 기준 안내</a></p><button class="btn ghost block" type="button" id="selft">계산 자체 점검 실행</button><p id="selfr" class="small" aria-live="polite"></p></div>';
  var pf = $('#pf', view);
  if (pf) pf.addEventListener('submit', function (e) { e.preventDefault(); p.alias = val('alias', pf) || p.alias; p.ageBand = val('age', pf) || p.ageBand; p.author = val('author', pf) || p.author; save(['profile']); render(true); toast('저장했어요'); });
  $('#share', view).addEventListener('click', shareFile);
  $('#exp', view).addEventListener('click', function () { download(exportName(), new Blob([JSON.stringify(exportObj(), null, 1)], { type: 'application/json' })); toast('기록 파일을 저장했어요'); });
  $('#imp', view).addEventListener('change', function (e) { importFile(e.target.files[0]); e.target.value = ''; });
  $('#wipe', view).addEventListener('click', function () {
    confirmBox('모든 기록을 지울까요?', '이 휴대폰에 저장된 기록 <b>' + S.logs.length + '개</b>, 일정, 준비물, 약 정보가 모두 지워져요. <b>되돌릴 수 없어요.</b> 필요하면 먼저 파일로 내보내세요.', '모두 삭제', function () { wipeAll(); toast('모든 기록을 지웠어요'); go('#/start'); }, true);
  });
  $('#selft', view).addEventListener('click', function () { var r = R.selfTest(D, L); $('#selfr', view).textContent = '자체 점검 ' + r.pass + ' / ' + r.total + ' 통과' + (r.fail ? ' — 실패: ' + r.results.filter(function (x) { return !x.pass; }).map(function (x) { return x.name; }).join(', ') : ''); });
};
routes.info = function (view) {
  view.innerHTML = '<h1>출처·면책</h1>' +
    '<div class="card danger"><h2>꼭 알아 두세요</h2><ul><li><b>판정은 국민건강보험공단이 합니다.</b> 문의 ☎ <a href="tel:15771000">1577-1000</a></li><li>이 앱은 등급이나 점수를 <b>예측하지 않아요.</b> 공단 산정 방식은 이 앱에 들어 있지 않아요.</li><li>기록 항목은 가족용 생활 항목이며 <b>공단 공식 조사표 문항이 아니에요.</b></li><li>금액·기한은 참고용이며 법률 자문이 아니에요. 통지서와 공단 안내가 우선이에요.</li></ul></div>' +
    '<div class="card"><h2>방문조사는 이렇게 해요</h2><ul class="small">' + G.survey.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' + srcs(G.surveySrc) + '</div>' +
    '<div class="card"><h2>등급 판정 기준 (참고)</h2><p class="small">' + esc(G.note) + '</p><div class="tbl-wrap" tabindex="0" role="region" aria-label="등급 판정 기준 표"><table class="tbl"><caption class="sr">시행령 제7조 등급판정기준</caption><thead><tr><th scope="col">등급</th><th scope="col">인정점수</th><th scope="col">상태</th></tr></thead><tbody>' + G.rows.map(function (r) { return '<tr><th scope="row">' + esc(r.label) + '</th><td>' + esc(r.range) + '</td><td>' + esc(r.desc) + '</td></tr>'; }).join('') + '</tbody></table></div>' + srcs(G.src) + '</div>' +
    '<div class="card"><h2>앱이 쓰는 값</h2><ul class="small"><li>2026 재가급여 월 한도액(복지용구 제외): ' + L.gradeOrder.map(function (g) { return esc(L.gradeLabel[g]) + ' ' + W(L.monthlyLimit[g]); }).join(', ') + '</li>' +
    '<li>본인부담: 일반 15%, 40% 감경 9%, 60% 감경 6%, 기초생활수급자(의료급여) 0% · ' + esc(L.rounding) + '</li><li>판정: 신청일부터 30일 이내 원칙(부득이하면 30일 이내 연장)</li><li>이의신청: 안 날부터 90일, 처분일부터 180일 · 재심사: 결정통지일부터 90일</li><li>재신청 3개월: <b>관행 · 법정 기준 아님</b></li><li>계산에 넣지 않은 것: ' + L.notIncluded.map(esc).join(', ') + '</li></ul></div>' +
    '<div class="card"><h2>출처 (' + esc(L.checkedAt) + ' 원문 확인)</h2><ul class="small">' + L.sources.map(function (s) { return '<li>' + src(s.id) + '</li>'; }).join('') + '</ul></div>' +
    '<p class="small muted">방문조사 7일 노트 · 가입 없음 · 기록은 이 휴대폰에만 · <a href="visit-assessment-preparation/">방문조사 준비 가이드</a></p>';
};
/* ---------- 시작 ---------- */
function bootError(msg) {
  var v = $('#view'); $('#tabbar').style.display = 'none';
  v.innerHTML = '<h1>앱을 불러오지 못했어요</h1><div class="card danger" role="alert"><p>' + esc(msg) + '</p><p class="small">인터넷 연결을 확인하고 다시 시도해 주세요. 한 번 열었던 기기는 오프라인에서도 열려요. 저장된 기록은 지워지지 않았어요.</p><button class="btn pri block" type="button" id="retry">다시 시도</button></div>';
  document.title = R.pageTitle('앱을 불러오지 못했어요', APP);
  $('#retry', v).addEventListener('click', function () { location.reload(); });
}
function getJSON(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
Promise.all([getJSON('data/domains.json'), getJSON('data/limits-2026.json'), getJSON('data/grades.json')]).then(function (a) {
  D = a[0]; L = a[1]; G = a[2];
  if (!D.domains || !L.monthlyLimit || !G.rows) throw new Error('data');
  loadState();
  window.addEventListener('hashchange', function () { closeModal(); render(); });
  render();
}).catch(function () { bootError('기록 항목·금액 데이터 파일을 읽지 못했어요.'); });
window.__runSelfTest = function () { return R.selfTest(D, L); };
window.__state = function () { return S; };
window.__data = function () { return { D: D, L: L, G: G }; };
if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
