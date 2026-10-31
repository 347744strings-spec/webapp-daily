/* 기부금영수증 정리함 — app.js (빌드: /workspace/webapps/_build/donation/p1~p6.js 이어붙임) */
(function () {
'use strict';
var R = window.DonRules;
var APP = '기부금영수증 정리함';
var K = { org: 'dr.org', tx: 'dr.tx', donors: 'dr.donors', rules: 'dr.rules', settings: 'dr.settings' };
var C = null, RJ = null, SF0 = null; /* data/codes.json, data/rules.json, data/suffixes.json */
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function today() { return R.today(new Date()); }
function W(n) { return R.won(n); }
var flags = { recovered: [], storageError: false };
var PEND = null; /* 가져오기 대기 중인 표(메모리만) */
var S = null;
function defSettings() { return { storeRrn: false, receiptSeqStart: 1, onboarded: false, example: false, gran: 'month', acks: {}, suffixes: null, sortBy: 'amt', ledgerKept: false }; }
function defOrg() { return R.cleanOrg({ year: new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0), defaultCode: '41' }); }
function blank() { return { org: defOrg(), tx: [], donors: [], rules: [], settings: defSettings() }; }
function readKey(k) {
  var raw = null; try { raw = localStorage.getItem(k); } catch (e) { flags.storageError = true; return undefined; }
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch (e) { flags.recovered.push(k); try { localStorage.removeItem(k); } catch (e2) {} return undefined; }
}
function loadState() {
  S = blank();
  var o = readKey(K.org), t = readKey(K.tx), d = readKey(K.donors), r = readKey(K.rules), st = readKey(K.settings);
  if (o !== undefined) S.org = R.cleanOrg(o); if (!S.org.year) S.org.year = defOrg().year;
  if (t !== undefined) { if (Array.isArray(t)) S.tx = t.map(R.cleanTx).filter(Boolean); else flags.recovered.push(K.tx); }
  if (d !== undefined) {
    if (Array.isArray(d)) S.donors = d.map(function (x) { var c = R.cleanDonor(x); if (c && x.rrn) c.rrn = R.digits(x.rrn).slice(0, 13); return c; }).filter(Boolean);
    else flags.recovered.push(K.donors);
  }
  if (Array.isArray(r)) S.rules = r.filter(function (x) { return x && x.pattern && x.donorId; }); else if (r !== undefined) flags.recovered.push(K.rules);
  if (st && typeof st === 'object') { var ds = defSettings(); for (var k in ds) if (st[k] !== undefined) ds[k] = st[k]; ds.storeRrn = st.storeRrn === true; ds.acks = st.acks && typeof st.acks === 'object' ? st.acks : {}; ds.receiptSeqStart = Math.max(1, parseInt(st.receiptSeqStart, 10) || 1); ds.gran = st.gran === 'each' ? 'each' : 'month'; S.settings = ds; }
  else if (st !== undefined) flags.recovered.push(K.settings);
  if (!S.settings.storeRrn) S.donors.forEach(function (x) { x.rrn = ''; }); /* 저장 안 함 설정이면 남아 있던 값도 버림 */
}
function put(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { toast('저장 공간이 부족하거나 막혀 있어요. 설정에서 내보내기로 백업해 주세요.'); return false; }
}
/* 주민번호는 storeRrn(옵트인)일 때만 localStorage에 들어가요 */
function save(which) {
  var ok = true;
  (which || ['org', 'tx', 'donors', 'rules', 'settings']).forEach(function (w) {
    var v = S[w]; if (w === 'donors' && !S.settings.storeRrn) v = R.stripRrn(S.donors);
    ok = put(K[w], v) && ok;
  });
  return ok;
}
function wipeAll() {
  try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('dr.') === 0) localStorage.removeItem(k); }); } catch (e) {}
  S = blank(); PEND = null;
}
function suffixes() { return Array.isArray(S.settings.suffixes) ? S.settings.suffixes : SF0; }
/* 다시 묶고 저장: 규칙 추가·명부 변경 즉시 재집계 */
function regroup() {
  var a = R.assign(S.tx, S.donors, S.rules, suffixes());
  S.tx = a.tx; S.donors = a.donors;
}
var CACHE = null;
function calc() {
  if (CACHE) return CACHE;
  var sum = R.summary(S.tx, S.donors), iss = R.issueList(S.tx, S.donors, S.rules, S.settings.acks, suffixes());
  var lv = {}; S.donors.forEach(function (d) { if (sum.totals[d.id]) lv[d.id] = R.donorLevel(iss, d.id); });
  var cnt = { red: 0, yellow: 0, green: 0 }; Object.keys(lv).forEach(function (k) { cnt[lv[k]]++; });
  var open = iss.filter(function (i) { return !i.acked; });
  var paper = S.donors.reduce(function (s, d) { var t = sum.totals[d.id]; return s + (t && !d.submittedEtax && t.amt > 0 ? t.amt : 0); }, 0);
  CACHE = { sum: sum, issues: iss, open: open, lv: lv, cnt: cnt, paper: paper, unmatchedOpen: open.filter(function (i) { return i.kind === 'unmatched'; }).length };
  return CACHE;
}
function commit(which) { CACHE = null; return save(which); }
function donor(id) { return R.byId(S.donors, id); }
function codeName(code) { var c = C.codes.filter(function (x) { return x.code === code; })[0]; return c ? c.name : code; }
function dCode(d) { return d.code || S.org.defaultCode || '41'; }
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
  var s = RJ.sources.filter(function (x) { return x.id === id; })[0]; if (!s) return '';
  return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.title) + '<span class="sr"> (새 창)</span></a>' + (s.verified ? '' : ' <b class="lock">확인 필요</b>');
}
function srcs(ids) { return '<p class="src">근거: ' + ids.map(src).join(' · ') + ' <span>(' + RJ.checkedAt + ' 원문 확인)</span></p>'; }
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
function exBanner() {
  if (!S.settings.example) return '';
  return '<div class="card warm ex-banner"><span class="tag ex">예시</span><span class="grow">예시 데이터예요(가상 단체·가짜 이름·가짜 주민번호).</span><button class="btn ghost" type="button" data-act="clear-example">예시 지우고 시작</button></div>';
}
function lvBadge(lv) { var t = { red: '빨강 · 위험', yellow: '노랑 · 확인', green: '초록 · 준비 완료' }[lv] || ''; return '<span class="st"><span class="dot ' + lv + '" aria-hidden="true"></span>' + t + '</span>'; }
function idView(d) { if (!d.rrn) return '<span class="lock">미입력</span>'; return '<span class="rrn-mask mask code">' + esc(R.maskId(d)) + '</span><span class="rrn-full code">' + esc(R.fullId(d)) + '</span>'; }
function noData(msg) { return '<div class="card"><h2>아직 거래내역이 없어요</h2><p>' + (msg || '통장 거래내역을 붙여 넣거나 예시 데이터로 먼저 둘러보세요.') + '</p><a class="btn pri block" href="#/start">통장 내역 붙여 넣기</a></div>'; }
/* ---------- 라우터 ---------- */
var routes = {};
var TAB = { home: 'home', excluded: 'home', donors: 'donors', donor: 'donors', receipt: 'donors', check: 'check', out: 'out', ledger: 'out', print: 'out' };
var TOP = { org: '#/org', help: '#/help', settings: '#/settings' };
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render() {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('/').filter(Boolean), name = parts[0] || 'home';
  if (!routes[name]) name = 'home';
  if (!S.settings.onboarded && ['start', 'map', 'example', 'help', 'settings'].indexOf(name) < 0) name = 'start';
  var old = $('#view'), view = old.cloneNode(false); old.parentNode.replaceChild(view, old);
  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'clear-example') confirmBox('예시를 지울까요?', '예시 거래·기부자·단체 정보를 모두 지우고 처음 화면으로 가요.', '예시 지우기', function () { wipeAll(); toast('예시를 지웠어요. 우리 단체 통장 내역을 붙여 넣으세요.'); go('#/start'); });
  });
  routes[name](view, parts.slice(1).map(decodeURIComponent));
  var tb = $('#tabbar'); tb.hidden = !S.settings.onboarded;
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === TAB[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $$('.toplinks a').forEach(function (a) { if (a.getAttribute('href') === TOP[name]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (flags.recovered.length && name !== 'start') { var n = document.createElement('div'); n.className = 'card danger'; n.setAttribute('role', 'alert'); n.innerHTML = '<p style="margin:0"><b>저장된 자료 일부를 읽을 수 없어 비웠어요</b>(' + esc(flags.recovered.join(', ')) + '). 내보내기 파일이 있으면 설정 → 가져오기로 되살릴 수 있어요.</p>'; view.insertBefore(n, view.firstChild.nextSibling); flags.recovered = []; }
  var h1 = $('h1', view); document.title = R.pageTitle(h1 ? h1.textContent : '', APP);
  if (h1) { h1.setAttribute('tabindex', '-1'); if (!render.first) h1.focus({ preventScroll: false }); }
  render.first = false; window.scrollTo(0, 0);
}
render.first = true;
/* ---------- 시작: 붙여넣기·파일·예시 ---------- */
function readFileText(file, cb) {
  var rd = new FileReader();
  rd.onload = function () {
    var buf = rd.result, txt = null;
    try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { try { txt = new TextDecoder('euc-kr').decode(buf); } catch (e2) { txt = null; } }
    cb(txt);
  };
  rd.onerror = function () { cb(null); };
  rd.readAsArrayBuffer(file);
}
function setPending(text, extra) {
  var t = R.parseTable(text);
  if (!t.rows.length) return '붙여 넣은 내용에서 표를 찾지 못했어요.';
  if (t.rows.length < 2) return '행이 1줄뿐이에요. 머리글과 거래가 함께 있는지 확인하세요.';
  var m = R.guessMap(t.rows, S.org.year);
  PEND = { rows: t.rows, delim: t.delim, map: m };
  if (extra) for (var k in extra) PEND[k] = extra[k];
  return '';
}
routes.start = function (view) {
  var y = new Date().getFullYear(), years = [y - 2, y - 1, y].map(String);
  view.innerHTML = '<h1>통장 거래내역을 붙여 넣으세요</h1>' +
    '<p>입금자를 기부자로 묶어 연간 합계를 내고, 가산세 위험을 점검한 뒤 기부금영수증·발급명세서·홈택스 준비표를 만들어요.</p>' +
    '<p class="notice-strip">🔒 <b>주민번호는 서버로 가지 않아요.</b> 기본으로 저장도 하지 않아요(새로고침하면 사라짐). 모든 처리는 이 기기 안에서만 해요.</p>' +
    (S.tx.length ? '<p class="ok-strip">지금 거래 ' + S.tx.length + '건이 있어요. 새로 넣으면 바꾸거나 더할 수 있어요. <a href="#/">요약으로</a></p>' : '') +
    '<form id="sf" class="card" novalidate><fieldset><legend>몇 년 기부금인가요? (귀속연도)</legend>' + chips('yr', years, String(S.org.year || y - 1)) + '</fieldset>' +
    '<label class="f" for="paste">통장 거래내역 (엑셀에서 복사해 붙여넣기)</label><textarea id="paste" rows="6" placeholder="거래일시	보낸분	출금액	입금액&#10;2026.01.04	김하늘십일조	0	100,000" aria-describedby="paste-h"></textarea>' +
    '<p class="hint" id="paste-h">탭이나 쉼표로 나뉜 표면 돼요. 머리글(날짜·입금자·입금액)이 있으면 열을 자동으로 맞춰요.</p>' +
    '<p style="margin:12px 0 4px"><b>또는 CSV 파일</b></p><label class="btn block" for="file">CSV 파일 고르기</label><input type="file" id="file" class="sr" accept=".csv,.txt,.tsv,text/csv,text/plain">' +
    '<p class="hint">엑셀(.xlsx)은 "다른 이름으로 저장 → CSV"로 바꿔 주세요. 한글이 깨진 CSV(EUC-KR)도 읽어요.</p>' +
    '<p class="err" id="e-paste" role="alert"></p><button class="btn pri block big" type="submit">열 맞추기 →</button></form>' +
    '<div class="card"><h2>처음이라면</h2><p>가상 교회의 거래 300행(가짜 이름·가짜 주민번호)으로 전체 흐름을 먼저 볼 수 있어요.</p><button class="btn block big" type="button" id="example">예시 데이터로 해 보기</button></div>';
  function year() { S.org.year = +val('yr', view) || S.org.year; }
  $('#sf', view).addEventListener('submit', function (e) {
    e.preventDefault(); year(); var txt = $('#paste', view).value, err = $('#e-paste', view);
    if (!txt.trim()) { err.textContent = '거래내역을 붙여 넣거나 CSV 파일을 골라 주세요.'; $('#paste', view).focus(); return; }
    var msg = setPending(txt); err.textContent = msg; if (msg) return; go('#/map');
  });
  $('#file', view).addEventListener('change', function () {
    var f = this.files && this.files[0], err = $('#e-paste', view); if (!f) return; year();
    if (f.size > 8000000) { err.textContent = '파일이 너무 커요(8MB 이하).'; return; }
    readFileText(f, function (txt) { if (txt == null) { err.textContent = '파일을 읽지 못했어요. CSV로 저장했는지 확인하세요.'; return; } var msg = setPending(txt); err.textContent = msg; if (!msg) go('#/map'); });
  });
  $('#example', view).addEventListener('click', function () { go('#/example'); });
};
routes.example = function (view) {
  view.innerHTML = '<h1>예시 데이터를 불러오는 중…</h1>';
  Promise.all([fetch('data/sample.csv').then(function (r) { if (!r.ok) throw 0; return r.text(); }), fetch('data/sample-roster.csv').then(function (r) { if (!r.ok) throw 0; return r.text(); })]).then(function (x) {
    wipeAll();
    S.org = R.cleanOrg({ name: '예시 은혜교회(가상)', bizNo: '0008200001', address: '예시시 예시구 가상로 10', rep: '홍예시', tel: '000-000-0000', type: '종교', lawCode: '405', defaultCode: '41', year: 2026, issueDate: '2027-01-08' });
    S.settings.example = true;
    setPending(x[0], { roster: R.parseRoster(x[1]), exRules: [['최민호', '최기쁨']] });
    location.replace('#/map');
  }).catch(function () { view.innerHTML = '<h1>예시를 불러오지 못했어요</h1><div class="card danger"><p>예시 파일을 읽지 못했어요. 인터넷이 끊긴 상태에서 처음 여는 중이면 한 번 온라인으로 열어 주세요.</p><a class="btn block" href="#/start">처음 화면으로</a></div>'; document.title = R.pageTitle('예시를 불러오지 못했어요', APP); });
};
/* ---------- 열 맞추기 ---------- */
routes.map = function (view) {
  if (!PEND) { view.innerHTML = '<h1>열 맞추기</h1><div class="card"><h2>가져올 표가 없어요</h2><p>먼저 통장 거래내역을 붙여 넣거나 CSV 파일을 골라 주세요.</p><a class="btn pri block" href="#/start">붙여 넣으러 가기</a></div>'; return; }
  var P = PEND, m = P.map, head = P.rows[0], ncol = Math.max.apply(null, P.rows.slice(0, 20).map(function (r) { return r.length; }));
  function colName(i) { return (i + 1) + '열' + (m.header && head[i] ? ': ' + head[i] : ': ' + (P.rows[0][i] || '')); }
  function sel(id, key, label, req) {
    var o = '<option value="-1">' + (req ? '— 골라 주세요 —' : '(없음)') + '</option>';
    for (var i = 0; i < ncol; i++) o += '<option value="' + i + '"' + (m[key] === i ? ' selected' : '') + '>' + esc(colName(i)) + '</option>';
    return '<label class="f" for="' + id + '">' + label + (req ? ' <span class="lock">필수</span>' : ' <span class="muted">(선택)</span>') + '</label><select id="' + id + '">' + o + '</select>';
  }
  var body = P.rows.slice(m.header ? 1 : 0, (m.header ? 1 : 0) + 5);
  var prev = '<div class="tbl-wrap" tabindex="0" role="region" aria-label="미리보기 5행"><table class="tbl prev-tbl"><caption class="sr">붙여 넣은 표 미리보기</caption><thead><tr>' + Array.apply(null, Array(ncol)).map(function (_, i) { return '<th scope="col">' + (i + 1) + '열' + (m.header && head[i] ? '<br>' + esc(head[i]) : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
    body.map(function (r) { return '<tr>' + Array.apply(null, Array(ncol)).map(function (_, i) { return '<td>' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  view.innerHTML = '<h1>열 맞추기</h1>' + exBanner() +
    '<p>' + (P.delim === '\t' ? '탭' : '쉼표') + '으로 나뉜 표 · ' + (P.rows.length - (m.header ? 1 : 0)) + '행. 자동으로 맞췄어요. 틀린 칸만 고쳐 주세요.</p>' + prev +
    '<form id="mf" class="card" novalidate><label class="ck"><input type="checkbox" id="m-head"' + (m.header ? ' checked' : '') + '><span><b>첫 줄은 머리글이에요</b></span></label>' +
    sel('m-date', 'date', '거래 날짜', true) + sel('m-name', 'name', '입금자명(보낸 분)', true) + sel('m-in', 'inAmt', '입금액', true) + sel('m-out', 'out', '출금액', false) + sel('m-memo', 'memo', '메모·적요', false) +
    (S.tx.length ? '<fieldset><legend>지금 있는 거래 ' + S.tx.length + '건은?</legend>' + chips('mode', [{ id: 'append', label: '더하기(같은 거래는 건너뜀)' }, { id: 'replace', label: '모두 바꾸기' }], 'append') + '</fieldset>' : '') +
    '<p class="hint">출금·0원·이자·다른 연도·미래 날짜 행은 자동으로 빼고, 뺀 목록은 따로 볼 수 있어요.</p>' +
    '<p class="err" id="e-map" role="alert"></p><button class="btn pri block big" type="submit" id="m-ok">가져오기</button><a class="btn ghost block" href="#/start" style="margin-top:8px">다시 붙여 넣기</a></form>';
  $('#mf', view).addEventListener('submit', function (e) {
    e.preventDefault();
    var mm = { header: $('#m-head', view).checked, date: +$('#m-date', view).value, name: +$('#m-name', view).value, inAmt: +$('#m-in', view).value, out: +$('#m-out', view).value, memo: +$('#m-memo', view).value, bal: m.bal };
    var err = '';
    if (mm.date < 0 || mm.name < 0 || mm.inAmt < 0) err = '날짜·입금자명·입금액 열을 골라 주세요.';
    else if (mm.date === mm.name || mm.date === mm.inAmt || mm.name === mm.inAmt) err = '날짜·입금자명·입금액은 서로 다른 열이어야 해요.';
    if (!err) { var test = R.buildTx(P.rows, mm, { year: S.org.year }); if (!test.some(function (t) { return t.date; })) err = '날짜 열에서 날짜를 하나도 읽지 못했어요. 날짜 열을 다시 골라 주세요.'; }
    $('#e-map', view).textContent = err; if (err) return;
    importPending(mm, val('mode', view) || 'append');
  });
};
function importPending(mm, mode) {
  var P = PEND, seq = S.tx.reduce(function (mx, t) { var n = +String(t.id).replace(/\D/g, ''); return n > mx ? n : mx; }, 0);
  var nt = R.buildTx(P.rows, mm, { year: S.org.year, today: today(), seq: seq }), skipped = 0;
  if (mode === 'replace') S.tx = nt;
  else { var sig = {}; S.tx.forEach(function (t) { sig[R.txSig(t)] = 1; }); nt.forEach(function (t) { if (sig[R.txSig(t)]) skipped++; else S.tx.push(t); }); }
  regroup();
  if (P.roster) applyRoster(P.roster, true);
  if (P.exRules) P.exRules.forEach(function (x) { var d = S.donors.filter(function (y) { return y.name === x[1]; })[0]; if (d) S.rules.push({ pattern: x[0], donorId: d.id }); });
  if (P.exRules) { regroup(); S.donors = S.donors.filter(function (d) { return S.tx.some(function (t) { return t.donorId === d.id; }) || d.manual; }); }
  S.settings.onboarded = true; PEND = null; commit();
  var c = calc();
  toast('입금 ' + c.sum.n.toLocaleString() + '건을 기부자 ' + c.sum.donors + '명으로 묶었어요' + (skipped ? ' · 같은 거래 ' + skipped + '건 건너뜀' : ''));
  go('#/');
}
function applyRoster(list, quiet) {
  var matched = 0, added = 0;
  list.forEach(function (p) {
    var d = S.donors.filter(function (x) { return x.name === p.name || R.normName(x.name, suffixes()) === R.normName(p.name, suffixes()) && p.kind !== 'corp'; })[0];
    if (!d) { d = R.blankDonor('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), p.name); d.manual = true; S.donors.push(d); added++; } else matched++;
    if (p.rrn) d.rrn = p.rrn.slice(0, 13); if (p.address) d.address = p.address; if (p.phone) d.phone = p.phone; d.kind = p.kind;
  });
  CACHE = null; if (!quiet) toast('명부 ' + list.length + '명: 기존 ' + matched + '명에 넣고 ' + added + '명을 새로 만들었어요');
  return { matched: matched, added: added };
}
/* ---------- 요약 ---------- */
routes.home = function (view) {
  var c = calc(), s = c.sum, y = S.org.year;
  if (!S.tx.length) { view.innerHTML = '<h1>' + y + '년 기부금 요약</h1>' + exBanner() + noData(); return; }
  var top = S.donors.filter(function (d) { return s.totals[d.id]; }).sort(function (a, b) { return s.totals[b.id].amt - s.totals[a.id].amt; }).slice(0, 5);
  var nx;
  var noIdN = c.open.filter(function (i) { return i.kind === 'id-missing'; }).length;
  if (noIdN >= 3 && !S.settings.storeRrn) nx = ['주민번호가 비어 있는 기부자 ' + noIdN + '명', '주민번호는 기본으로 저장하지 않아 새로고침하면 지워져요. 명부 CSV를 다시 넣거나 설정에서 저장을 켜세요.', '#/donors', '명부 다시 넣기'];
  else if (c.open.some(function (i) { return i.level === 'red'; })) nx = ['빨강 경고 ' + c.open.filter(function (i) { return i.level === 'red'; }).length + '건부터 해결하세요', '가산세(영수증 금액의 5%)로 이어질 수 있는 것들이에요.', '#/check', '점검함 열기'];
  else if (c.open.length) nx = ['확인이 필요한 ' + c.open.length + '건이 있어요', '미매칭·중복 의심·회비 성격 입금을 확인하세요.', '#/check', '점검함 열기'];
  else if (!S.org.name || !S.org.bizNo || !S.org.lawCode) nx = ['단체 정보를 넣어 주세요', '영수증에 단체명·고유번호·근거법령이 들어가야 해요.', '#/org', '단체 정보 넣기'];
  else nx = ['영수증을 출력할 준비가 됐어요', '종이 영수증 인쇄 또는 홈택스 전자 발급 준비표를 만드세요.', '#/out', '출력으로'];
  view.innerHTML = '<h1>' + y + '년 기부금 요약</h1>' + exBanner() +
    '<p class="ok-strip" id="sumline">입금 <b>' + s.n.toLocaleString() + '건</b>을 기부자 <b>' + s.donors + '명</b>으로 묶었어요.</p>' +
    '<div class="stats"><div class="stat wide"><b id="total">' + R.num(s.amt) + '</b><span>총액(원)</span></div><div class="stat"><b>' + s.n.toLocaleString() + '</b><span>입금 건수</span></div><div class="stat"><b>' + s.donors + '</b><span>기부자</span></div></div>' +
    '<p><a href="#/excluded" id="exlink">자동으로 뺀 행 ' + s.excluded + '개 보기</a>' + (s.unmatched ? ' · <a href="#/check">누구 입금인지 모르는 ' + s.unmatched + '건</a>' : '') + '</p>' +
    '<h2>신호등</h2><div class="lights" id="lights"><a class="light red" href="#/donors/red"><b>' + c.cnt.red + '</b>빨강</a><a class="light yellow" href="#/donors/yellow"><b>' + c.cnt.yellow + '</b>노랑</a><a class="light green" href="#/donors/green"><b>' + c.cnt.green + '</b>초록</a></div>' +
    '<div class="card soft" id="next"><h2>다음 할 일</h2><p><b>' + esc(nx[0]) + '</b><br>' + esc(nx[1]) + '</p><a class="btn pri block" href="' + nx[2] + '">' + esc(nx[3]) + '</a></div>' +
    '<h2>연간 합계 상위</h2><ul class="list" id="top">' + top.map(function (d) { return '<li>' + donorLink(d, s.totals[d.id], c.lv[d.id]) + '</li>'; }).join('') + '</ul><a class="btn ghost block" href="#/donors">기부자 전체 보기</a>' +
    nextDeadline() +
    '<a class="btn block" href="#/start" style="margin-top:12px">거래내역 더 넣기</a>';
};
function donorLink(d, t, lv) {
  return '<a class="dl" href="#/donor/' + encodeURIComponent(d.id) + '"><span class="dot ' + lv + '" aria-hidden="true"></span><span class="nm">' + esc(d.name) + (d.kind === 'corp' ? ' <span class="tag">사업자</span>' : '') + (d.submittedEtax ? ' <span class="tag">전자 제출함</span>' : '') + '<span class="sub">' + t.n + '건 · <span class="sr">상태 </span>' + { red: '빨강', yellow: '노랑', green: '초록' }[lv] + '</span></span><span class="am">' + W(t.amt) + '</span></a>';
}
function nextDeadline() {
  var ev = R.schedule(S.org.year, RJ, S.org.issueDate).filter(function (e) { return e.date >= today(); })[0]; if (!ev) return '';
  return '<div class="card"><h2>다가오는 일정</h2><p><b>' + esc(R.fmtD(ev.date)) + '</b> ' + esc(ev.title) + (ev.weekend ? ' <span class="tag red">주말</span>' : '') + '</p><a href="#/help">연간 일정 전체·달력에 넣기</a></div>';
}
/* ---------- 뺀 행 ---------- */
routes.excluded = function (view) {
  var ex = S.tx.filter(function (t) { return t.status !== 'ok'; });
  view.innerHTML = '<h1>영수증에서 뺀 행</h1>' + exBanner() + '<p>출금·0원·이자·다른 연도·날짜 오류는 자동으로 뺐어요. 직접 뺀 입금도 여기에 있어요. 기부금이 맞으면 "다시 넣기"를 누르세요.</p>' +
    (ex.length ? '<ul class="list" id="exl">' + ex.map(function (t) { return '<li class="card" style="margin:8px 0;padding:12px"><b>' + esc(t.date || '날짜 없음') + ' · ' + esc(t.rawName || '빈칸') + '</b> ' + W(t.amount) + '<br><span class="tag' + (t.status === 'removed' ? ' red' : '') + '">' + esc(t.status === 'removed' ? '직접 뺌' + (t.reason ? ': ' + t.reason : '') : t.reason) + '</span>' + (t.memo ? ' <span class="muted">' + esc(t.memo) + '</span>' : '') +
      (t.date && t.amount > 0 ? '<div style="margin-top:8px"><button class="btn sm" type="button" data-inc="' + esc(t.id) + '">다시 넣기<span class="sr"> ' + esc(t.rawName) + '</span></button></div>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="card"><p>뺀 행이 없어요.</p></div>') + '<a class="btn ghost block" href="#/">요약으로</a>';
  view.addEventListener('click', function (e) { var b = e.target.closest('[data-inc]'); if (!b) return; var t = S.tx.filter(function (x) { return x.id === b.getAttribute('data-inc'); })[0]; if (!t) return; t.status = 'ok'; t.reason = ''; regroup(); commit(); toast('다시 넣고 합계를 새로 냈어요'); render(); });
};
/* ---------- 기부자 목록 ---------- */
routes.donors = function (view, args) {
  var c = calc(), s = c.sum, f = args[0] || 'all';
  if (!S.tx.length && !S.donors.length) { view.innerHTML = '<h1>기부자</h1>' + exBanner() + noData(); return; }
  var all = S.donors.filter(function (d) { return s.totals[d.id] || d.manual; });
  view.innerHTML = '<h1>기부자 ' + all.length + '명</h1>' + exBanner() +
    '<label class="f" for="q">이름으로 찾기</label><input id="q" type="search" autocomplete="off" placeholder="예: 김하늘">' +
    '<fieldset><legend class="sr">신호등으로 거르기</legend>' + chips('flt', [{ id: 'all', label: '전체' }, { id: 'red', label: '빨강' }, { id: 'yellow', label: '노랑' }, { id: 'green', label: '초록' }, { id: 'etax', label: '전자 제출함' }], f) + '</fieldset>' +
    '<fieldset><legend class="sr">정렬</legend>' + chips('srt', [{ id: 'amt', label: '금액순' }, { id: 'name', label: '이름순' }], S.settings.sortBy || 'amt') + '</fieldset>' +
    '<p class="muted" id="cnt" aria-live="polite"></p><ul class="list" id="dlist"></ul>' +
    '<div class="card"><h2>명부·직접 추가</h2><p>교적·회원 명부 CSV(성명, 주민등록번호, 주소, 연락처, 구분)를 넣으면 이름으로 맞춰 채워요. 주민번호는 기본적으로 저장하지 않아요.</p>' +
    '<label class="btn block" for="roster">명부 CSV 넣기</label><input type="file" id="roster" class="sr" accept=".csv,.txt,text/csv"><p class="err" id="e-roster" role="alert"></p>' +
    '<button class="btn ghost block" type="button" id="add-d">기부자 직접 추가(현금 헌금 등)</button></div>';
  function draw() {
    var q = $('#q', view).value.trim(), fl = val('flt', view), so = val('srt', view);
    var xs = all.filter(function (d) {
      if (q && d.name.indexOf(q) < 0) return false;
      if (fl === 'etax') return d.submittedEtax;
      return fl === 'all' || (c.lv[d.id] || 'green') === fl;
    }).sort(so === 'name' ? function (a, b) { return a.name.localeCompare(b.name, 'ko'); } : function (a, b) { return (s.totals[b.id] ? s.totals[b.id].amt : 0) - (s.totals[a.id] ? s.totals[a.id].amt : 0); });
    $('#cnt', view).textContent = xs.length + '명 표시';
    $('#dlist', view).innerHTML = xs.length ? xs.map(function (d) { return '<li>' + donorLink(d, s.totals[d.id] || { n: 0, amt: 0 }, c.lv[d.id] || 'green') + '</li>'; }).join('') : '<li class="card">조건에 맞는 기부자가 없어요.</li>';
  }
  draw();
  $('#q', view).addEventListener('input', draw);
  view.addEventListener('change', function (e) { if (e.target.name === 'srt') { S.settings.sortBy = e.target.value; save(['settings']); } if (e.target.name === 'flt' || e.target.name === 'srt') draw(); });
  $('#roster', view).addEventListener('change', function () {
    var file = this.files && this.files[0], err = $('#e-roster', view); if (!file) return;
    readFileText(file, function (txt) {
      var list = txt == null ? [] : R.parseRoster(txt);
      if (!list.length) { err.textContent = '명부에서 이름을 찾지 못했어요. 첫 줄에 "성명" 머리글이 있는지 확인하세요.'; return; }
      applyRoster(list); regroup(); commit(); render();
    });
  });
  $('#add-d', view).addEventListener('click', function () {
    openModal('<h2 id="mh">기부자 직접 추가</h2><form id="adf" novalidate><label class="f" for="ad-name">이름(상호)</label><input id="ad-name" autocomplete="off"><p class="err" id="e-ad" role="alert"></p><button class="btn pri block" type="submit">추가</button><button class="btn ghost block" type="button" data-dismiss style="margin-top:8px">취소</button></form>', function (m) {
      $('#adf', m).addEventListener('submit', function (e) { e.preventDefault(); var n = $('#ad-name', m).value.trim(); if (n.length < 2) { $('#e-ad', m).textContent = '이름을 2글자 이상 적어 주세요.'; return; }
        var d = R.blankDonor('m' + Date.now().toString(36), n); d.manual = true; d.split = true; if (R.isCorpName(n)) d.kind = 'corp'; S.donors.push(d); commit(); closeModal(); go('#/donor/' + d.id); });
    });
  });
};
/* ---------- 기부자 상세 ---------- */
function ruleWarn(r, d) { return R.normName(r.pattern, suffixes()) !== R.normName(d.name, suffixes()); }
routes.donor = function (view, args) {
  var d = donor(args[0]);
  if (!d) { view.innerHTML = '<h1>기부자를 찾을 수 없어요</h1><div class="card"><p>지웠거나 다시 묶이면서 바뀌었을 수 있어요.</p><a class="btn block" href="#/donors">기부자 목록</a></div>'; return; }
  var c = calc(), t = c.sum.totals[d.id] || { n: 0, amt: 0 }, lv = c.lv[d.id] || 'green', corp = d.kind === 'corp';
  var my = c.open.filter(function (i) { return i.donorId === d.id; });
  var txs = S.tx.filter(function (x) { return x.status === 'ok' && x.donorId === d.id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  var rules = S.rules.filter(function (r) { return r.donorId === d.id; });
  var others = S.donors.filter(function (x) { return x.id !== d.id && c.sum.totals[x.id]; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  view.innerHTML = '<h1>' + esc(d.name) + '</h1>' + exBanner() +
    '<p>' + lvBadge(lv) + (d.submittedEtax ? ' <span class="tag">전자 제출함</span>' : '') + '</p>' +
    '<div class="stats"><div class="stat wide"><b id="d-total">' + R.num(t.amt) + '</b><span>연간 합계(원)</span></div><div class="stat"><b>' + t.n + '</b><span>입금 건수</span></div><div class="stat"><b>' + esc(codeName(dCode(d)).split(' ')[0]) + '</b><span>코드 ' + esc(dCode(d)) + '</span></div></div>' +
    (my.length ? '<div id="d-issues">' + my.map(issueCard).join('') + '</div>' : '') +
    '<a class="btn pri block big" id="to-rcpt" href="#/receipt/' + encodeURIComponent(d.id) + '">영수증 미리보기</a>' +
    '<form id="df" class="card" novalidate><h2>인적사항</h2>' +
    '<fieldset><legend>구분</legend>' + chips('kind', [{ id: 'person', label: '개인' }, { id: 'corp', label: '사업자·법인' }], d.kind) + '</fieldset>' +
    '<label class="f" for="d-name">성명(상호)</label><input id="d-name" value="' + esc(d.name) + '" autocomplete="off">' +
    '<div id="id-person"' + (corp ? ' hidden' : '') + '><p class="f" id="rrn-l" style="margin-bottom:4px"><b>주민등록번호</b></p><div class="split2" role="group" aria-labelledby="rrn-l"><label class="sr" for="rrn1">주민번호 앞 6자리</label><input id="rrn1" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="앞 6자리"><span aria-hidden="true">-</span><label class="sr" for="rrn2">주민번호 뒤 7자리</label><input id="rrn2" type="password" inputmode="numeric" maxlength="7" autocomplete="new-password" placeholder="뒤 7자리"></div></div>' +
    '<div id="id-corp"' + (corp ? '' : ' hidden') + '><label class="f" for="biz">사업자등록번호(10자리)</label><input id="biz" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="000-00-00000"></div>' +
    '<p class="hint" id="id-now">지금 값: ' + (d.rrn ? '<span class="mask code">' + esc(R.maskId(d)) + '</span> <button class="btn sm ghost" type="button" id="id-clear">지우기</button>' : '<span class="lock">미입력</span>') + '</p>' +
    '<p class="notice-strip">🔒 화면에는 항상 가려서 보여요(인쇄할 때만 전체). ' + (S.settings.storeRrn ? '<b>설정에서 "주민번호 저장"을 켜 두어 이 기기에 저장돼요.</b>' : '이 기기에 <b>저장하지 않아요</b> — 새로고침하면 다시 넣어야 해요.') + '</p>' +
    '<label class="f" for="d-addr">주소(소재지)</label><input id="d-addr" value="' + esc(d.address) + '" autocomplete="off">' +
    '<label class="f" for="d-code">기부금 코드</label><select id="d-code">' + C.codes.map(function (x) { return '<option value="' + x.code + '"' + (x.code === dCode(d) ? ' selected' : '') + '>' + x.code + ' ' + esc(x.name) + '</option>'; }).join('') + '</select>' +
    '<label class="ck"><input type="checkbox" id="d-etax"' + (d.submittedEtax ? ' checked' : '') + '><span><b>홈택스에 전자 발급 제출함</b><span class="muted">표시하면 종이 발급명세서·합계표에서 빠지고, 준비표를 다시 만들 때 중복 경고를 해요.</span></span></label>' +
    '<p class="err" id="e-id" role="alert"></p><button class="btn pri block" type="submit" id="d-save">저장</button></form>' +
    '<div class="card"><h2>입금 ' + txs.length + '건</h2>' + (txs.length ? '<div class="tbl-wrap" tabindex="0" role="region" aria-label="입금 내역"><table class="tbl"><caption class="sr">' + esc(d.name) + ' 입금 내역</caption><thead><tr><th scope="col">날짜</th><th scope="col">통장 이름</th><th scope="col">금액</th><th scope="col">작업</th></tr></thead><tbody>' +
      txs.map(function (x) { return '<tr><td class="num">' + esc(x.date.slice(5)) + '</td><td>' + esc(x.rawName) + (x.via === 'rule' ? ' <span class="tag' + (R.normName(x.rawName, suffixes()) !== R.normName(d.name, suffixes()) ? ' red' : '') + '">규칙</span>' : x.pin ? ' <span class="tag">지정</span>' : '') + '</td><td class="num">' + R.num(x.amount) + '</td><td><button class="btn sm ghost" type="button" data-mv="' + esc(x.id) + '">옮기기</button> <button class="btn sm danger" type="button" data-rm="' + esc(x.id) + '">빼기</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<p>아직 입금이 없어요.</p>') +
    '<details><summary>현금 입금 직접 넣기</summary><form id="cf" novalidate><label class="f" for="c-date">날짜</label><input id="c-date" type="date" min="' + S.org.year + '-01-01" max="' + (String(S.org.year) + '-12-31' < today() ? S.org.year + '-12-31' : today()) + '"><label class="f" for="c-amt">금액(원)</label><input id="c-amt" inputmode="numeric" autocomplete="off"><p class="err" id="e-cash" role="alert"></p><button class="btn block" type="submit">넣기</button></form></details></div>' +
    '<div class="card" id="rules"><h2>묶음 규칙</h2><p>통장에 다른 이름으로 찍힌 입금을 이 사람에게 모아요. 규칙을 더하면 바로 다시 합산해요.</p>' +
    (rules.length ? '<ul class="list">' + rules.map(function (r) { var w = ruleWarn(r, d); return '<li class="card' + (w ? ' danger' : '') + '" style="margin:6px 0;padding:10px"><b>"' + esc(r.pattern) + '"</b> → ' + esc(d.name) + (w ? '<br><span class="lock">⚠ 다른 사람 이름이에요.</span> 실제 기부자가 아닌 사람 명의로 발급하면 영수증 금액의 <b>5% 가산세</b> 대상이에요.' : '') + '<div><button class="btn sm ghost" type="button" data-delrule="' + esc(r.pattern) + '">규칙 지우기<span class="sr"> ' + esc(r.pattern) + '</span></button></div></li>'; }).join('') + '</ul>' : '') +
    '<form id="rf" novalidate><label class="f" for="rule-pat">통장에 찍힌 이름</label><input id="rule-pat" autocomplete="off" placeholder="예: 이바다(남편)"><p class="warn-strip" id="rule-warn" hidden role="status"></p><p class="err" id="e-rule" role="alert"></p><button class="btn block" type="submit" id="rule-add">규칙 더하기</button></form>' +
    (others.length ? '<button class="btn ghost block" type="button" id="merge" style="margin-top:8px">다른 기부자를 이 사람에게 합치기</button>' : '') + '</div>' +
    (d.manual && !txs.length ? '<button class="btn danger block" type="button" id="d-del">이 기부자 지우기</button>' : '');
  function setKind() { var k = val('kind', view); $('#id-person', view).hidden = k === 'corp'; $('#id-corp', view).hidden = k !== 'corp'; }
  view.addEventListener('change', function (e) { if (e.target.name === 'kind') setKind(); });
  if ($('#id-clear', view)) $('#id-clear', view).addEventListener('click', function () { d.rrn = ''; commit(['donors']); toast('번호를 지웠어요'); render(); });
  $('#df', view).addEventListener('submit', function (e) {
    e.preventDefault(); var err = $('#e-id', view), k = val('kind', view), nm = $('#d-name', view).value.trim(), nv = null;
    if (nm.length < 2) { err.textContent = '이름을 2글자 이상 적어 주세요.'; return; }
    if (k === 'corp') { var b = $('#biz', view).value; if (b.trim()) { var bc = R.bizCheck(b); if (!bc.ok) { err.textContent = bc.msg; $('#biz', view).focus(); return; } nv = R.digits(b); } }
    else { var a1 = R.digits($('#rrn1', view).value), a2 = R.digits($('#rrn2', view).value); if (a1 || a2) { var rc = R.rrnCheck(a1 + a2); if (!rc.ok) { err.textContent = rc.msg; $('#rrn1', view).focus(); return; } nv = a1 + a2; } }
    if (k !== d.kind && nv == null && d.rrn) d.rrn = '';
    d.kind = k; d.name = nm; d.split = true; if (nv != null) d.rrn = nv; d.address = $('#d-addr', view).value.trim(); d.code = $('#d-code', view).value; d.submittedEtax = $('#d-etax', view).checked;
    err.textContent = ''; commit(); toast('저장했어요' + (nv && !S.settings.storeRrn ? ' · 번호는 이 화면을 닫기 전까지만 기억해요' : '')); render();
  });
  var rp = $('#rule-pat', view);
  rp.addEventListener('input', function () { var w = $('#rule-warn', view), v = rp.value.trim(); var bad = v && ruleWarn({ pattern: v }, d); w.hidden = !bad; w.textContent = bad ? '⚠ "' + v + '"은(는) ' + d.name + ' 님과 다른 이름이에요. 다른 사람(가족 등) 명의 입금을 합쳐 발급하면 영수증 금액의 5% 가산세 대상이에요. 실제 기부자가 ' + d.name + ' 님일 때만 더하세요.' : ''; });
  $('#rf', view).addEventListener('submit', function (e) {
    e.preventDefault(); var v = rp.value.trim(), err = $('#e-rule', view);
    if (R.normName(v, suffixes()).length < 1 || v.length < 2) { err.textContent = '통장에 찍힌 이름을 2글자 이상 적어 주세요.'; return; }
    S.rules = S.rules.filter(function (r) { return r.pattern !== v; }); S.rules.push({ pattern: v, donorId: d.id });
    var before = (calc().sum.totals[d.id] || { amt: 0 }).amt; regroup(); commit(); var after = (calc().sum.totals[d.id] || { amt: 0 }).amt;
    toast('규칙을 더하고 다시 합산했어요: ' + W(before) + ' → ' + W(after)); render();
  });
  view.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-delrule]'))) { var p = b.getAttribute('data-delrule'); S.rules = S.rules.filter(function (r) { return !(r.pattern === p && r.donorId === d.id); }); regroup(); commit(); toast('규칙을 지우고 다시 합산했어요'); render(); }
    else if ((b = e.target.closest('[data-rm]'))) { var x = S.tx.filter(function (y) { return y.id === b.getAttribute('data-rm'); })[0]; confirmBox('이 입금을 영수증에서 뺄까요?', esc(x.date + ' ' + x.rawName + ' ' + W(x.amount)) + '. "뺀 행"에서 다시 넣을 수 있어요.', '빼기', function () { x.status = 'removed'; x.reason = '직접 뺌'; x.donorId = null; regroup(); commit(); toast('뺐어요'); render(); }, true); }
    else if ((b = e.target.closest('[data-mv]'))) moveTx(b.getAttribute('data-mv'));
  });
  $('#cf', view).addEventListener('submit', function (e) {
    e.preventDefault(); var dt = $('#c-date', view).value, am = R.parseAmount($('#c-amt', view).value), err = $('#e-cash', view);
    if (!R.isD(dt)) { err.textContent = '날짜를 골라 주세요.'; return; }
    if (dt.slice(0, 4) !== String(S.org.year)) { err.textContent = S.org.year + '년 날짜만 넣을 수 있어요.'; return; }
    if (dt > today()) { err.textContent = '미래 날짜는 기부일자로 쓸 수 없어요.'; return; }
    if (!(am > 0)) { err.textContent = '금액을 1원 이상 숫자로 적어 주세요.'; return; }
    S.tx.push({ id: 'c' + Date.now().toString(36), row: 0, date: dt, rawName: d.name + '(현금)', amount: am, memo: '현금 직접 입력', bal: '', donorId: d.id, status: 'ok', reason: '', pin: true, manual: true });
    regroup(); commit(); toast('현금 ' + W(am) + '을 넣었어요'); render();
  });
  if ($('#merge', view)) $('#merge', view).addEventListener('click', function () {
    openModal('<h2 id="mh">' + esc(d.name) + ' 님에게 합치기</h2><p>고른 기부자의 입금을 모두 ' + esc(d.name) + ' 님에게 옮기고, 그 이름을 묶음 규칙으로 남겨요.</p><p class="warn-strip">이름이 다른 사람을 합치면 5% 가산세 경고가 떠요. 동명이인·오타·상호 표기 차이처럼 같은 사람일 때만 합치세요.</p><label class="f" for="mg">합칠 기부자</label><select id="mg">' + others.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' · ' + W(c.sum.totals[x.id].amt) + '</option>'; }).join('') + '</select><button class="btn pri block" type="button" id="mg-ok" style="margin-top:12px">합치기</button><button class="btn ghost block" type="button" data-dismiss style="margin-top:8px">취소</button>', function (m) {
      $('#mg-ok', m).addEventListener('click', function () {
        var o = donor($('#mg', m).value); if (!o) return;
        var raws = {}; S.tx.forEach(function (x) { if (x.donorId === o.id) { raws[x.rawName] = 1; if (x.pin) x.donorId = d.id; } });
        Object.keys(raws).forEach(function (rw) { S.rules = S.rules.filter(function (r) { return r.pattern !== rw; }); S.rules.push({ pattern: rw, donorId: d.id }); });
        S.rules.forEach(function (r) { if (r.donorId === o.id) r.donorId = d.id; });
        S.donors = S.donors.filter(function (x) { return x.id !== o.id; });
        regroup(); commit(); closeModal(); toast(o.name + ' 님을 합치고 다시 합산했어요'); render();
      });
    });
  });
  if ($('#d-del', view)) $('#d-del', view).addEventListener('click', function () { confirmBox('기부자를 지울까요?', esc(d.name) + ' 님을 목록에서 지워요.', '지우기', function () { S.donors = S.donors.filter(function (x) { return x.id !== d.id; }); S.rules = S.rules.filter(function (r) { return r.donorId !== d.id; }); commit(); go('#/donors'); }, true); });
};
function moveTx(txId) {
  var x = S.tx.filter(function (y) { return y.id === txId; })[0]; if (!x) return; var c = calc();
  var list = S.donors.filter(function (d) { return c.sum.totals[d.id] || d.manual; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  openModal('<h2 id="mh">입금 기부자 지정</h2><p>' + esc(x.date) + ' "' + esc(x.rawName || '빈칸') + '" ' + W(x.amount) + '</p><label class="f" for="mv">누구의 기부인가요?</label><select id="mv">' + list.map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === x.donorId ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select>' +
    '<p class="hint">이 입금 한 건만 옮겨요. 같은 이름 입금을 모두 옮기려면 기부자 화면의 묶음 규칙을 쓰세요.</p><button class="btn pri block" type="button" id="mv-ok">지정</button><button class="btn danger block" type="button" id="mv-rm" style="margin-top:8px">기부금 아님 — 영수증에서 빼기</button><button class="btn ghost block" type="button" data-dismiss style="margin-top:8px">취소</button>', function (m) {
    $('#mv-ok', m).addEventListener('click', function () { x.donorId = $('#mv', m).value; x.pin = true; regroup(); commit(); closeModal(); toast('지정했어요'); render(); });
    $('#mv-rm', m).addEventListener('click', function () { x.status = 'removed'; x.reason = '기부금 아님'; x.donorId = null; regroup(); commit(); closeModal(); toast('뺐어요. "뺀 행"에서 되돌릴 수 있어요'); render(); });
  });
}
/* ---------- 영수증 (별지 제45호의2서식) ---------- */
function need(v, label) { return v ? esc(v) : '<span class="lock">' + label + ' 필요</span>'; }
function receiptHTML(d, gran) {
  var all = R.receiptLines(d.id, S.tx, 'each'), g = R.effGran(all.length, gran), ls = g === 'each' ? all : R.receiptLines(d.id, S.tx, 'month');
  var tot = ls.reduce(function (s, l) { return s + l.amount; }, 0), o = S.org, code = dCode(d), idate = o.issueDate || today();
  return '<section class="rcpt-page" aria-label="' + esc(d.name) + ' 기부금 영수증"><div class="rcpt">' +
    '<p class="law">■ ' + esc(RJ.form.law) + ' [' + esc(RJ.form.no) + '] &lt;개정 ' + esc(R.fmtDot(RJ.form.revised)) + '&gt;</p>' +
    '<p style="margin:2px 0">일련번호 <b class="rno">' + (d.receiptNo ? esc(d.receiptNo) : '(인쇄할 때 매김)') + '</b></p><h2>기부금 영수증</h2>' +
    '<table><tbody><tr><th colspan="4" class="sec" scope="colgroup">❶ 기부자</th></tr>' +
    '<tr><th scope="row">성명(법인명)</th><td>' + esc(d.name) + '</td><th scope="row">' + (d.kind === 'corp' ? '사업자등록번호' : '주민등록번호') + '<br><span class="law">(사업자등록번호)</span></th><td class="code">' + idView(d) + '</td></tr>' +
    '<tr><th scope="row">주소(소재지)</th><td colspan="3">' + need(d.address, '주소') + '</td></tr>' +
    '<tr><th colspan="4" class="sec" scope="colgroup">❷ 기부금 단체</th></tr>' +
    '<tr><th scope="row">단체명</th><td>' + need(o.name, '단체명') + '</td><th scope="row">사업자등록번호<br><span class="law">(고유번호)</span></th><td class="code">' + (o.bizNo ? esc(R.fmtBiz(o.bizNo)) : need('', '번호')) + '</td></tr>' +
    '<tr><th scope="row">소재지</th><td>' + need(o.address, '소재지') + '</td><th scope="row">기부금공제대상<br>기부금단체 근거법령</th><td class="code">' + need(o.lawCode, '코드') + '</td></tr>' +
    '<tr><th colspan="4" class="sec" scope="colgroup">❸ 기부금 모집처(언론기관 등)</th></tr>' +
    '<tr><th scope="row">단체명</th><td></td><th scope="row">사업자등록번호</th><td></td></tr>' +
    '</tbody></table>' +
    '<table><tbody><tr><th colspan="5" class="sec" scope="colgroup">❹ 기부내용</th></tr>' +
    '<tr><th scope="col">코드</th><th scope="col">구분</th><th scope="col">연월일</th><th scope="col">내용</th><th scope="col">금액(원)</th></tr>' +
    ls.map(function (l) { return '<tr><td>' + code + '</td><td>금전</td><td class="code">' + esc(g === 'each' ? l.date.replace(/-/g, '.') : l.label) + '</td><td>' + (g === 'each' ? '' : '월 합계') + '</td><td class="n">' + R.num(l.amount) + '</td></tr>'; }).join('') +
    '<tr><th colspan="4" scope="row">합계</th><td class="n"><b class="rtotal">' + R.num(tot) + '</b></td></tr></tbody></table>' +
    '<div class="cert"><p>「소득세법」 제34조, 「조세특례제한법」 제58조ㆍ제76조ㆍ제88조의4 및 「법인세법」 제24조에 따른 기부금을 위와 같이 기부하였음을 증명하여 주시기 바랍니다.</p>' +
    '<p class="sign">' + esc(R.fmtDot(idate)) + '<br>신청인 ' + esc(d.name) + ' (서명 또는 인)</p>' +
    '<p>위와 같이 기부금을 기부받았음을 증명합니다.</p><p class="sign">' + esc(R.fmtDot(idate)) + '<br>기부금 수령인 ' + need(o.name, '단체명') + (o.rep ? ' 대표 ' + esc(o.rep) : '') + ' (서명 또는 인)</p></div>' +
    '<p class="size">210mm×297mm[백상지 80g/㎡]</p></div></section>';
}
function paperTargets() { var c = calc(); return S.donors.filter(function (d) { var t = c.sum.totals[d.id]; return t && t.amt > 0 && !d.submittedEtax; }); }
/* 번호 매기기 확인 → cb */
function numberThen(ids, cb) {
  var need0 = S.donors.filter(function (d) { return ids.indexOf(d.id) >= 0 && !d.receiptNo; });
  if (!need0.length) { cb(); return; }
  var idate = S.org.issueDate || today();
  var next = R.assignNos(S.donors, ids, S.org.year, S.settings.receiptSeqStart, idate).filter(function (d) { return ids.indexOf(d.id) >= 0 && need0.some(function (x) { return x.id === d.id; }); }).map(function (d) { return d.receiptNo; }).sort();
  confirmBox('발급번호를 매길까요?', '<b>' + need0.length + '명</b>에게 <b>' + esc(next[0]) + (next.length > 1 ? ' ~ ' + esc(next[next.length - 1]) : '') + '</b>을 이름순으로 이어서 매기고, 발급일을 <b>' + esc(R.fmtDot(idate)) + '</b>로 적어요. 한 번 매긴 번호는 바뀌지 않아요.', '번호 매기고 인쇄', function () {
    S.donors = R.assignNos(S.donors, ids, S.org.year, S.settings.receiptSeqStart, idate); if (!S.org.issueDate) S.org.issueDate = idate; commit(); cb();
  });
}
function doPrint() { setTimeout(function () { try { window.print(); } catch (e) {} }, 60); }
routes.receipt = function (view, args) {
  var d = donor(args[0]);
  if (!d) { view.innerHTML = '<h1>영수증을 찾을 수 없어요</h1><div class="card"><a class="btn block" href="#/donors">기부자 목록</a></div>'; return; }
  var c = calc(), t = c.sum.totals[d.id], red = c.open.filter(function (i) { return i.donorId === d.id && i.level === 'red'; });
  var n = R.receiptLines(d.id, S.tx, 'each').length, g = S.settings.gran;
  view.innerHTML = '<h1>' + esc(d.name) + ' 영수증</h1>' + exBanner() +
    '<p class="muted screen-only">' + esc(RJ.form.no) + ' &lt;개정 ' + esc(R.fmtDot(RJ.form.revised)) + '&gt; 기준 · 서식 확인일 ' + esc(RJ.checkedAt) + '</p>' +
    (red.length ? '<div class="warn-strip" role="alert">빨강 경고 ' + red.length + '건: ' + esc(red[0].title) + ' — <a href="#/check">점검함</a>에서 확인하세요. 잘못 발급하면 영수증 금액의 5% 가산세 대상이에요.</div>' : '') +
    (!t || t.amt <= 0 ? '<div class="card danger"><p>영수증에 넣을 입금이 없어요.</p></div>' : '') +
    '<fieldset class="no-print"><legend>기부내용 적는 방법</legend>' + chips('gran', [{ id: 'month', label: '월별 합계' }, { id: 'each', label: '건별(' + n + '건)' }], g) + '</fieldset>' +
    (g === 'each' && n > R.MAX_EACH ? '<p class="hint">건별이 ' + R.MAX_EACH + '줄을 넘으면 A4 한 장에 맞추려고 월별 합계로 적어요.</p>' : '') +
    '<p class="hint">월별 합계로 적는 방식은 업계 관행이에요 <b class="lock">확인 필요</b>. 서식 칸 이름은 "연월일"이에요.</p>' +
    '<div class="rcpt-wrap" tabindex="0" role="region" aria-label="영수증 미리보기">' + receiptHTML(d, g) + '</div>' +
    '<button class="btn pri block big no-print" type="button" id="print"' + (!t || t.amt <= 0 ? ' disabled' : '') + '>이 영수증 인쇄</button>' +
    '<a class="btn ghost block no-print" href="#/donor/' + encodeURIComponent(d.id) + '" style="margin-top:8px">기부자 정보 고치기</a>';
  view.addEventListener('change', function (e) { if (e.target.name === 'gran') { S.settings.gran = e.target.value; save(['settings']); render(); } });
  $('#print', view).addEventListener('click', function () {
    var go2 = function () { numberThen([d.id], function () { render(); doPrint(); }); };
    if (red.length) confirmBox('빨강 경고가 있어요', '고치지 않고 인쇄하면 가산세 대상이 될 수 있어요. 그래도 인쇄할까요?', '그래도 인쇄', go2, true); else go2();
  });
};
routes.print = function (view) {
  var xs = paperTargets().slice().sort(function (a, b) { return (a.receiptNo || 'z' + a.name).localeCompare(b.receiptNo || 'z' + b.name, 'ko'); });
  view.innerHTML = '<h1>영수증 일괄 인쇄 ' + xs.length + '장</h1>' + exBanner() +
    '<div class="card no-print"><p>기부자 한 명당 A4 한 장이에요. 전자 제출함으로 표시한 기부자는 빠져요.</p><button class="btn pri block big" type="button" id="print-all"' + (xs.length ? '' : ' disabled') + '>인쇄하기</button><a class="btn ghost block" href="#/out" style="margin-top:8px">출력으로 돌아가기</a></div>' +
    (xs.length ? '<div class="rcpt-wrap" tabindex="0" role="region" aria-label="영수증 전체 미리보기">' + xs.map(function (d) { return receiptHTML(d, S.settings.gran); }).join('') + '</div>' : '<div class="card"><p>인쇄할 영수증이 없어요.</p></div>');
  if (xs.length) $('#print-all', view).addEventListener('click', function () { numberThen(xs.map(function (d) { return d.id; }), function () { render(); doPrint(); }); });
};
/* ---------- 점검함 ---------- */
function issueCard(i) {
  var d = i.donorId ? donor(i.donorId) : null;
  return '<div class="card issue ' + (i.acked ? 'done' : i.level) + '" data-key="' + esc(i.key) + '"><p style="margin:0 0 4px"><span class="st"><span class="dot ' + i.level + '" aria-hidden="true"></span>' + (i.level === 'red' ? '빨강' : '노랑') + '</span>' + (i.acked ? ' <span class="tag">확인함 ' + esc(i.ack.at || '') + '</span>' : '') + '</p><h3>' + esc(i.title) + '</h3><p>' + esc(i.text) + '</p>' +
    (i.acked && i.ack.memo ? '<p class="muted">메모: ' + esc(i.ack.memo) + '</p>' : '') +
    '<div class="row wrap">' +
    (i.kind === 'unmatched' ? '<button class="btn sm pri" type="button" data-assign="' + esc(i.txId) + '">기부자 지정</button>' : '') +
    (i.kind === 'dup' ? '<button class="btn sm danger" type="button" data-rmtx="' + esc(i.txIds[i.txIds.length - 1]) + '">한 건 빼기</button>' : '') +
    (i.kind === 'fee' ? '<button class="btn sm danger" type="button" data-rmtx="' + esc(i.txId) + '">기부금 아님 — 빼기</button>' : '') +
    (d && location.hash.indexOf('#/donor/') < 0 ? '<a class="btn sm ghost" href="#/donor/' + encodeURIComponent(d.id) + '">' + esc(d.name) + ' 보기</a>' : '') +
    (i.kind === 'id-missing' || i.kind === 'id-format' || i.kind === 'amt' ? '' : i.acked ? '<button class="btn sm ghost" type="button" data-unack="' + esc(i.key) + '">확인 취소</button>' : '<button class="btn sm ghost" type="button" data-ack="' + esc(i.key) + '">확인함</button>') +
    '</div></div>';
}
routes.check = function (view, args) {
  var c = calc(), f = args[0] === 'done' ? 'done' : 'open';
  if (!S.tx.length) { view.innerHTML = '<h1>점검함</h1>' + exBanner() + noData(); return; }
  var risk = R.penaltyRisk(c.issues, S.donors, c.sum.totals, RJ, c.paper, !!S.settings.ledgerKept), P = {};
  RJ.penalties.forEach(function (p) { P[p.id] = p; });
  var list = c.issues.filter(function (i) { return f === 'done' ? i.acked : !i.acked; }).sort(function (a, b) { return (a.level === 'red' ? 0 : 1) - (b.level === 'red' ? 0 : 1); });
  view.innerHTML = '<h1>점검함</h1>' + exBanner() +
    '<div class="card ' + (risk.info ? 'danger' : 'soft') + '" id="risk"><h2>가산세 위험 미리 보기</h2>' +
    '<dl class="kv"><dt>인적사항 오류·누락·명의 합산 (빨강 ' + risk.donors + '명)</dt><dd class="num">' + W(risk.infoBase) + ' × 5% = <b id="pen-info">' + W(risk.info) + '</b></dd>' +
    '<dt>발급명세 미작성·미보관(종이 발급분)</dt><dd class="num">' + W(risk.ledgerBase) + ' × 0.2% = <b id="pen-ledger">' + W(risk.ledger) + '</b></dd></dl>' +
    '<label class="ck"><input type="checkbox" id="kept"' + (S.settings.ledgerKept ? ' checked' : '') + '><span><b>발급명세서를 만들어 5년 보관할게요</b><span class="muted">출력 → 기부자별 발급명세서. 전자 발급분은 작성·보관 의무가 없어요.</span></span></label>' +
    '<ul class="small">' + RJ.penalties.map(function (p) { return '<li>' + esc(p.label) + ': ' + esc(p.rateText) + '</li>'; }).join('') + '</ul>' +
    '<p class="small">' + esc(RJ.penaltyNote) + ' ' + esc(RJ.rounding) + '</p>' + srcs(['law-81-7', 'law-75-4', 'nts-qna']) +
    '<p class="small muted">미리 보기일 뿐 세무 판단이 아니에요. 금액 차이 가산세(차액의 5%)는 앱이 알 수 없어 넣지 않았어요.</p></div>' +
    '<fieldset><legend class="sr">보기</legend>' + chips('cf', [{ id: 'open', label: '남은 것 ' + c.open.length }, { id: 'done', label: '확인한 것 ' + (c.issues.length - c.open.length) }], f) + '</fieldset>' +
    (list.length ? '<div id="iq">' + list.map(issueCard).join('') + '</div>' : '<div class="card soft" id="iq"><p>' + (f === 'open' ? '남은 경고가 없어요. 출력으로 가세요.' : '확인한 항목이 없어요.') + '</p>' + (f === 'open' ? '<a class="btn pri block" href="#/out">출력으로</a>' : '') + '</div>');
  $('#kept', view).addEventListener('change', function () { S.settings.ledgerKept = this.checked; commit(['settings']); render(); });
  view.addEventListener('change', function (e) { if (e.target.name === 'cf') go(e.target.value === 'done' ? '#/check/done' : '#/check'); });
};
function ackIssue(key) {
  var it = calc().issues.filter(function (i) { return i.key === key; })[0]; if (!it) return;
  openModal('<h2 id="mh">확인함으로 표시</h2><p>' + esc(it.title) + '</p>' + (it.kind === 'alias' ? '<p class="warn-strip">실제 기부자가 영수증 명의자와 같은 사람일 때만 표시하세요. 다르면 영수증 금액의 5% 가산세 대상이에요.</p>' : '') +
    '<label class="f" for="ack-memo">메모(선택)</label><textarea id="ack-memo" rows="2" placeholder="예: 본인 확인함(전화)"></textarea><button class="btn pri block" type="button" id="ack-ok" style="margin-top:12px">확인함</button><button class="btn ghost block" type="button" data-dismiss style="margin-top:8px">취소</button>', function (m) {
    $('#ack-ok', m).addEventListener('click', function () { S.settings.acks[key] = { at: today(), memo: $('#ack-memo', m).value.trim().slice(0, 200) }; commit(['settings']); closeModal(); toast('확인함으로 표시했어요'); render(); });
  });
}
document.addEventListener('click', function (e) {
  if (!e.target.closest || !e.target.closest('#view')) return;
  var b;
  if ((b = e.target.closest('[data-ack]'))) ackIssue(b.getAttribute('data-ack'));
  else if ((b = e.target.closest('[data-unack]'))) { delete S.settings.acks[b.getAttribute('data-unack')]; commit(['settings']); toast('확인을 취소했어요'); render(); }
  else if ((b = e.target.closest('[data-assign]'))) moveTx(b.getAttribute('data-assign'));
  else if ((b = e.target.closest('[data-rmtx]'))) { var x = S.tx.filter(function (y) { return y.id === b.getAttribute('data-rmtx'); })[0]; if (!x) return;
    confirmBox('이 입금을 영수증에서 뺄까요?', esc(x.date + ' ' + x.rawName + ' ' + W(x.amount)) + '. "뺀 행"에서 다시 넣을 수 있어요.', '빼기', function () { x.status = 'removed'; x.reason = '직접 뺌'; x.donorId = null; regroup(); commit(); toast('뺐어요'); render(); }, true); }
});
/* ---------- 출력 ---------- */
function sumTableHTML(st) {
  var cell = function (who, k) { var r = st[who][k]; return '<td class="num" data-k="' + who + '-' + k + '"><span data-n="' + r.n + '" data-a="' + r.amt + '">' + r.n + '건</span><br>' + R.num(r.amt) + '</td>'; };
  var row = function (lab, who) { return '<tr><th scope="row">' + lab + '</th>' + cell(who, 'all') + cell(who, 'special') + cell(who, 'general') + '</tr>'; };
  return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="발급합계표"><table class="tbl" id="sumtbl"><caption class="sr">기부금영수증 발급합계표(종이 발급분), 칸마다 건수와 금액(원)</caption><thead><tr><th scope="col">구분</th><th scope="col">합계</th><th scope="col">특례(10)</th><th scope="col">일반(40·41)</th></tr></thead><tbody>' +
    row('법인', 'corp') + row('개인', 'person') + '</tbody></table></div><p class="small muted">칸마다 위는 건수, 아래는 금액(원)이에요.</p>';
}
routes.out = function (view) {
  var c = calc(), y = S.org.year;
  if (!S.tx.length) { view.innerHTML = '<h1>출력</h1>' + exBanner() + noData(); return; }
  var paper = paperTargets(), numbered = paper.filter(function (d) { return d.receiptNo; }).length, red = c.open.filter(function (i) { return i.level === 'red'; }).length;
  var st = R.sumTable(S.donors, c.sum.totals, C, S.org.defaultCode), lr = R.ledgerRows(S.donors, S.tx, S.org, S.settings.gran, S.org.defaultCode);
  var ledgerSum = lr.slice(1).reduce(function (s, r) { return s + r[7]; }, 0), sumAll = st.person.all.amt + st.corp.all.amt, noId = paper.filter(function (d) { return !d.rrn; }).length;
  var subN = S.donors.filter(function (d) { return d.submittedEtax && c.sum.totals[d.id]; }).length;
  view.innerHTML = '<h1>출력</h1>' + exBanner() +
    (red ? '<div class="warn-strip" role="alert">빨강 경고 ' + red + '건이 남아 있어요. <a href="#/check">점검함</a>에서 먼저 확인하세요.</div>' : '') +
    '<div class="card"><h2>종이 영수증</h2><p>대상 <b>' + paper.length + '명</b> · 번호 매김 ' + numberedLabel(numbered, paper.length) + ' · 발급일 ' + esc(S.org.issueDate ? R.fmtDot(S.org.issueDate) : '인쇄하는 날') + '</p>' +
    '<a class="btn pri block big" href="#/print" id="batch">전체 영수증 인쇄 (' + paper.length + '장)</a><p class="hint">한 명당 A4 한 장, 발급번호는 ' + y + '-0001부터 이어서 매겨요(설정에서 시작 번호 변경).</p></div>' +
    '<div class="card"><h2>기부자별 발급명세서</h2><p>' + esc(RJ.ledgerForm.no) + ' &lt;개정 ' + esc(R.fmtDot(RJ.ledgerForm.revised)) + '&gt; · 종이 발급분 ' + (lr.length - 1) + '줄 · 합계 <b class="num" id="ledger-sum">' + W(ledgerSum) + '</b></p>' +
    '<p class="warn-strip">이 파일에는 <b>주민등록번호 전체</b>가 들어가요(법정 기재 사항). 발급한 날부터 5년 안전하게 보관하세요.' + (noId ? ' 지금 ' + noId + '명은 번호가 비어 있어요.' : '') + '</p>' +
    '<button class="btn block" type="button" id="ledger-csv">발급명세서 CSV 받기</button><a class="btn ghost block" href="#/ledger" style="margin-top:8px">발급명세서 인쇄용 보기</a></div>' +
    '<div class="card"><h2>발급합계표</h2><p>' + esc(RJ.sumForm.no) + ' · 종이 발급분만(전자 발급분 제외) · 유형: ' + need(S.org.type, '단체 유형') + '</p>' + sumTableHTML(st) +
    '<p class="' + (sumAll === ledgerSum ? 'ok-strip' : 'warn-strip') + '" id="sum-check">' + (sumAll === ledgerSum ? '✓ 합계표 합계 ' + W(sumAll) + ' = 발급명세서 합계' : '합계표 ' + W(sumAll) + ' ≠ 발급명세서 ' + W(ledgerSum) + ' — 0원 이하 기부자를 확인하세요') + '</p>' +
    '<p class="small">특례=코드 10, 일반=40·41. 20·42 코드는 합계에만 들어가요. 제출: ' + esc(y + 1) + '년 6월 30일까지(법인은 사업연도 종료 달 말일부터 6개월).</p>' + srcs(['form-29-7', 'law-160-3']) + '</div>' +
    '<div class="card"><h2>홈택스 전자 발급 준비표</h2><p>기부일자별 한 줄씩(국세청 안내) 만든 CSV예요. 홈택스 일괄발급 엑셀 서식의 같은 이름 칸에 옮겨 붙이세요.</p>' +
    '<p class="warn-strip">홈택스 엑셀 서식의 정확한 열 순서는 <b>확인 필요</b>예요(매뉴얼 원문을 열어 보지 못함). 주민번호 오류 행은 홈택스에서 빠질 수 있어요(2차 자료).</p>' +
    (subN ? '<p>전자 제출함으로 표시: <b>' + subN + '명</b></p>' : '') +
    '<button class="btn block" type="button" id="etax-csv">전자 발급 준비표 CSV 받기</button><button class="btn ghost block" type="button" id="mark-sub" style="margin-top:8px">준비표에 넣은 기부자를 "제출함"으로 표시</button>' + srcs(['nts-etax', 'nts-qna']) + '</div>' +
    '<div class="card"><h2>안내 문자</h2><label class="f" for="sms">교인·회원 안내 문구</label><textarea id="sms" rows="7" readonly>' + esc(R.smsText(S.org, y, S.org.issueDate ? R.fmtDot(S.org.issueDate).replace(/\.$/, '') : '')) + '</textarea><button class="btn block" type="button" id="sms-copy">문구 복사</button></div>' +
    '<a class="btn ghost block" href="#/help">연간 일정 달력에 넣기(.ics)</a>';
  $('#ledger-csv', view).addEventListener('click', function () {
    if (lr.length < 2) { toast('종이 발급 대상이 없어요'); return; }
    download('기부자별발급명세서-' + y + '.csv', new Blob([R.toCSV(lr)], { type: 'text/csv;charset=utf-8' })); toast('발급명세서 CSV를 받았어요 · 주민번호가 들어 있어요');
  });
  function etaxDl(incl) { var r = R.etaxRows(S.donors, S.tx, S.org.defaultCode, incl); download('전자기부금영수증-준비표-' + y + '.csv', new Blob([R.toCSV(r.rows)], { type: 'text/csv;charset=utf-8' })); toast('준비표 ' + (r.rows.length - 1) + '줄을 받았어요'); }
  $('#etax-csv', view).addEventListener('click', function () {
    var r = R.etaxRows(S.donors, S.tx, S.org.defaultCode, false);
    if (!r.submitted.length) { etaxDl(false); return; }
    var names = r.submitted.map(function (id) { return donor(id).name; });
    openModal('<h2 id="mh">중복 제출 주의</h2><p class="warn-strip" id="dup-warn">이미 홈택스에 "제출함"으로 표시한 기부자 <b>' + names.length + '명</b>이 있어요: ' + esc(names.slice(0, 8).join(', ')) + (names.length > 8 ? ' 외' : '') + '. 다시 올리면 영수증이 두 번 발급될 수 있어요.</p>' +
      '<button class="btn pri block" type="button" id="dup-skip">제출한 사람은 빼고 받기</button><button class="btn danger block" type="button" id="dup-all" style="margin-top:8px">모두 넣어 받기(중복 주의)</button><button class="btn ghost block" type="button" data-dismiss style="margin-top:8px">취소</button>', function (m) {
      $('#dup-skip', m).addEventListener('click', function () { closeModal(); etaxDl(false); });
      $('#dup-all', m).addEventListener('click', function () { closeModal(); etaxDl(true); });
    });
  });
  $('#mark-sub', view).addEventListener('click', function () {
    var ids = S.donors.filter(function (d) { return c.sum.totals[d.id] && c.sum.totals[d.id].amt > 0 && !d.submittedEtax; }).map(function (d) { return d.id; });
    if (!ids.length) { toast('표시할 기부자가 없어요'); return; }
    confirmBox('"제출함"으로 표시할까요?', '홈택스에 실제로 올린 뒤에 누르세요. ' + ids.length + '명이 종이 발급명세서·합계표에서 빠지고, 준비표를 다시 만들면 중복 경고를 해요.', '표시하기', function () { S.donors.forEach(function (d) { if (ids.indexOf(d.id) >= 0) d.submittedEtax = true; }); commit(); toast(ids.length + '명을 제출함으로 표시했어요'); render(); });
  });
  $('#sms-copy', view).addEventListener('click', function () { copyText($('#sms', view).value, '안내 문구'); });
};
function numberedLabel(a, b) { return a + '/' + b + '명'; }
routes.ledger = function (view) {
  var lr = R.ledgerRows(S.donors, S.tx, S.org, S.settings.gran, S.org.defaultCode), y = S.org.year;
  var byName = {}; S.donors.forEach(function (d) { byName[d.name] = d; });
  view.innerHTML = '<h1>기부자별 발급명세서</h1>' + exBanner() + '<p class="no-print">' + esc(RJ.ledgerForm.no) + ' 항목을 따른 표예요. 화면에는 주민번호를 가리고, 인쇄할 때만 전체가 나와요.</p>' +
    '<div class="card print-keep"><p class="print-only" style="font-weight:800">' + esc(S.org.name) + ' ' + y + '년 기부자별 발급명세서</p><div class="tbl-wrap" tabindex="0" role="region" aria-label="발급명세서"><table class="tbl small" id="ledger-tbl"><caption class="sr">기부자별 발급명세서</caption><thead><tr>' + lr[0].map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    lr.slice(1).map(function (r) { var d = byName[r[2]]; return '<tr>' + r.map(function (v, i) { if (i === 3) return '<td class="code">' + (d && d.rrn ? idView(d) : '') + '</td>'; return '<td' + (i === 7 ? ' class="num"' : '') + '>' + esc(i === 7 ? R.num(v) : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>' +
    '<button class="btn pri block no-print" type="button" id="lp">인쇄</button><a class="btn ghost block no-print" href="#/out" style="margin-top:8px">출력으로</a>';
  $('#lp', view).addEventListener('click', doPrint);
};
/* ---------- 단체 정보 ---------- */
routes.org = function (view) {
  var o = S.org, y = new Date().getFullYear();
  view.innerHTML = '<h1>단체 정보</h1>' + exBanner() + '<p>영수증의 ❷ 기부금 단체 칸에 들어가요.</p><form id="of" class="card" novalidate>' +
    '<label class="f" for="o-name">단체명</label><input id="o-name" value="' + esc(o.name) + '" autocomplete="organization">' +
    '<label class="f" for="o-biz">사업자등록번호(고유번호)</label><input id="o-biz" inputmode="numeric" value="' + esc(o.bizNo ? R.fmtBiz(o.bizNo) : '') + '" autocomplete="off" placeholder="000-00-00000">' +
    '<label class="f" for="o-addr">소재지</label><input id="o-addr" value="' + esc(o.address) + '" autocomplete="street-address">' +
    '<label class="f" for="o-rep">대표자</label><input id="o-rep" value="' + esc(o.rep) + '" autocomplete="off">' +
    '<label class="f" for="o-tel">연락처</label><input id="o-tel" value="' + esc(o.tel) + '" inputmode="tel" autocomplete="tel">' +
    '<fieldset><legend>단체 유형(발급합계표)</legend>' + chips('otype', RJ.orgTypes, o.type) + '</fieldset>' +
    '<label class="f" for="o-law">기부금단체 근거법령 코드</label><select id="o-law"><option value="">— 골라 주세요 —</option>' + C.lawCodes.map(function (x) { return '<option value="' + x.code + '"' + (x.code === o.lawCode ? ' selected' : '') + '>' + x.code + ' ' + esc(x.label) + '</option>'; }).join('') + '</select>' +
    '<p class="hint">2026. 1. 2. 개정 서식에 새로 생긴 칸이에요. 정확한 코드는 서식 뒷면 작성방법을 확인하세요.</p>' +
    '<label class="f" for="o-code">기본 기부금 코드</label><select id="o-code">' + C.codes.map(function (x) { return '<option value="' + x.code + '"' + (x.code === o.defaultCode ? ' selected' : '') + '>' + x.code + ' ' + esc(x.name) + '</option>'; }).join('') + '</select>' +
    '<p class="hint">' + esc(C.otherCodes) + '</p>' +
    '<fieldset><legend>귀속연도</legend>' + chips('oyear', [y - 2, y - 1, y].map(String), String(o.year)) + '</fieldset>' +
    '<label class="f" for="o-issue">발급일</label><input id="o-issue" type="date" value="' + esc(o.issueDate) + '" min="' + (o.year || y - 1) + '-01-01">' +
    '<p class="hint">비워 두면 인쇄하는 날로 적어요.</p>' +
    '<p class="err" id="e-org" role="alert"></p><button class="btn pri block" type="submit">저장</button></form>' + srcs(['form-45-2']);
  $('#of', view).addEventListener('submit', function (e) {
    e.preventDefault(); var err = $('#e-org', view), biz = $('#o-biz', view).value, iss = $('#o-issue', view).value, ny = +val('oyear', view) || o.year;
    if (biz.trim() && !R.bizCheck(biz).ok) { err.textContent = '고유번호·사업자등록번호는 숫자 10자리예요.'; $('#o-biz', view).focus(); return; }
    if (iss && iss.slice(0, 4) <= String(ny)) { err.textContent = '발급일은 귀속연도(' + ny + '년) 다음 해 이후여야 해요.'; $('#o-issue', view).focus(); return; }
    var yChanged = ny !== o.year;
    S.org = R.cleanOrg({ name: $('#o-name', view).value.trim(), bizNo: biz, address: $('#o-addr', view).value.trim(), rep: $('#o-rep', view).value.trim(), tel: $('#o-tel', view).value.trim(), type: val('otype', view), lawCode: $('#o-law', view).value, defaultCode: $('#o-code', view).value, year: ny, issueDate: iss });
    err.textContent = ''; commit(['org']); toast('저장했어요' + (yChanged ? ' · 귀속연도가 바뀌었어요. 거래내역을 다시 넣어 주세요' : '')); render();
  });
};
/* ---------- 도움말 ---------- */
routes.help = function (view) {
  var ev = R.schedule(S.org.year || new Date().getFullYear() - 1, RJ, S.org.issueDate);
  view.innerHTML = '<h1>도움말·근거</h1>' +
    '<div class="card soft"><h2>서식 기준일</h2><p>' + esc(RJ.form.law) + ' ' + esc(RJ.form.no) + ' <b>&lt;개정 ' + esc(R.fmtDot(RJ.form.revised)) + '&gt;</b><br>' + esc(RJ.ledgerForm.no) + '·(2) &lt;개정 ' + esc(R.fmtDot(RJ.ledgerForm.revised)) + '&gt;<br>원문 확인일 ' + esc(RJ.checkedAt) + '</p><p class="small">' + esc(RJ.form.note) + '</p></div>' +
    '<h2>' + esc(S.org.year) + '년 기부금 연간 일정</h2><ul class="list" id="sched">' + ev.map(function (e) { return '<li class="card" style="margin:6px 0;padding:12px"><b>' + esc(R.fmtD(e.date)) + '</b>' + (e.weekend ? ' <span class="tag red">주말</span>' : '') + (e.verified === false ? ' <b class="lock">확인 필요</b>' : '') + '<br>' + esc(e.title) + '<br><span class="small muted">' + esc(e.desc) + '</span></li>'; }).join('') + '</ul>' +
    '<p class="small">' + esc(RJ.weekend || '') + '</p>' +
    '<button class="btn block" type="button" id="ics">달력에 넣기(.ics)</button>' +
    '<h2>근거 자료</h2><ul class="list" id="srcs">' + RJ.sources.map(function (s) { return '<li style="margin:8px 0">' + src(s.id) + '</li>'; }).join('') + '</ul>' +
    '<div class="card warm" id="unverified"><h2>확인 필요</h2><ul>' + RJ.unverified.map(function (u) { return '<li>' + esc(u) + '</li>'; }).join('') + '</ul></div>' +
    '<div class="card" id="disclaimer"><h2>꼭 읽어 주세요</h2>' + DISC.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
    '<div class="card"><h2>개인정보</h2><p>거래내역·기부자 정보는 이 기기 브라우저에만 있어요. 서버로 보내지 않아요. 주민등록번호는 기본적으로 저장하지 않고(새로고침하면 사라짐), 설정에서 직접 켰을 때만 이 기기에 저장해요. 내보내기 파일(JSON)에는 주민등록번호가 들어가지 않아요.</p><a href="privacy.html">개인정보 안내 전문</a></div>';
  $('#ics', view).addEventListener('click', function () { download('donation-receipts-' + S.org.year + '.ics', new Blob([R.ics(ev)], { type: 'text/calendar;charset=utf-8' })); toast('일정 파일을 받았어요'); });
};
var DISC = ['이 앱은 정리·출력 도구이며 세무 자문이 아닙니다. 서식과 기준은 법제처·국세청 최신 자료로 확인하세요.', '실제로 받은 기부금만, 실제 기부자 명의로 발급하세요. 사실과 다른 발급은 영수증 금액의 5% 가산세 대상입니다.', '회비·대가성 입금이 기부금인지는 단체가 판단해요(앱은 판단하지 않아요).', '가산세 금액은 미리 보기용 계산이에요. 실제 부과액은 과세관청이 정해요.']
/* ---------- 설정 ---------- */
routes.settings = function (view) {
  var st = S.settings, nR = S.donors.filter(function (d) { return d.rrn; }).length;
  view.innerHTML = '<h1>설정</h1>' + exBanner() +
    '<div class="card"><h2>주민등록번호 저장</h2><label class="ck"><input type="checkbox" id="store-rrn"' + (st.storeRrn ? ' checked' : '') + '><span><b>이 기기에 주민번호 저장하기</b><span class="muted">기본은 꺼짐: 새로고침하면 지워져요. 켜면 이 브라우저 저장소에 암호화 없이 저장돼요 — 혼자 쓰는 기기에서만 켜세요.</span></span></label><p class="small">지금 기억하는 번호 ' + nR + '명</p></div>' +
    '<div class="card"><h2>발급번호</h2><label class="f" for="seq">시작 번호(' + esc(S.org.year) + '-0001 → 숫자 부분)</label><input id="seq" inputmode="numeric" value="' + esc(st.receiptSeqStart) + '"><p class="err" id="e-seq" role="alert"></p><button class="btn block" type="button" id="seq-save">저장</button>' +
    '<button class="btn ghost block" type="button" id="seq-reset" style="margin-top:8px">매긴 번호 모두 지우기</button></div>' +
    '<div class="card"><h2>이름 정리 꼬리말</h2><p class="small">통장 이름 끝에 붙는 말(예: 김하늘<b>십일조</b>)을 떼고 같은 사람으로 묶어요. 쉼표로 나누세요.</p><label class="f" for="sfx">꼬리말</label><textarea id="sfx" rows="3">' + esc(suffixes().join(', ')) + '</textarea><button class="btn block" type="button" id="sfx-save">저장하고 다시 묶기</button></div>' +
    '<div class="card"><h2>백업</h2><p>JSON 파일에는 <b>주민등록번호가 들어가지 않아요</b>.</p><button class="btn block" type="button" id="exp">내보내기(JSON)</button><label class="btn ghost block" for="imp" style="margin-top:8px">가져오기(JSON)</label><input type="file" id="imp" class="sr" accept=".json,application/json"><p class="err" id="e-imp" role="alert"></p></div>' +
    '<div class="card danger"><h2>전체 지우기</h2><p>거래·기부자·규칙·단체 정보·설정을 이 기기에서 모두 지워요.</p><button class="btn danger solid block" type="button" id="wipe">전체 지우기</button></div>' +
    '<div class="card"><h2>자체 점검</h2><button class="btn ghost block" type="button" id="st">계산 자체 점검 실행</button><p id="st-out" aria-live="polite"></p></div>';
  $('#store-rrn', view).addEventListener('change', function () {
    var cb = this;
    if (cb.checked) { cb.checked = false; confirmBox('주민번호를 이 기기에 저장할까요?', '브라우저 저장소에 <b>암호화 없이</b> 저장돼요. 다른 사람이 함께 쓰는 컴퓨터라면 켜지 마세요. 내보내기 파일에는 여전히 들어가지 않아요.', '저장 켜기', function () { S.settings.storeRrn = true; commit(); toast('주민번호를 이 기기에 저장해요'); render(); }, true); }
    else { S.settings.storeRrn = false; commit(); toast('저장을 껐어요 · 저장소에서 주민번호를 지웠어요'); render(); }
  });
  $('#seq-save', view).addEventListener('click', function () { var n = parseInt($('#seq', view).value, 10); if (!(n >= 1 && n <= 9999)) { $('#e-seq', view).textContent = '1~9999 사이 숫자를 적어 주세요.'; return; } S.settings.receiptSeqStart = n; commit(['settings']); toast('저장했어요'); });
  $('#seq-reset', view).addEventListener('click', function () { confirmBox('매긴 발급번호를 지울까요?', '이미 나눠 준 영수증 번호와 달라질 수 있어요. 새 연도를 시작할 때만 쓰세요.', '번호 지우기', function () { S.donors.forEach(function (d) { d.receiptNo = ''; d.issuedAt = ''; }); commit(['donors']); toast('번호를 지웠어요'); }, true); });
  $('#sfx-save', view).addEventListener('click', function () { S.settings.suffixes = $('#sfx', view).value.split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 60); regroup(); commit(); toast('다시 묶었어요'); });
  $('#exp', view).addEventListener('click', function () { download('donation-receipts-' + S.org.year + '.json', new Blob([JSON.stringify(R.exportObj(S), null, 1)], { type: 'application/json' })); toast('내보냈어요 · 주민번호는 빠져 있어요'); });
  $('#imp', view).addEventListener('change', function () {
    var f = this.files && this.files[0], err = $('#e-imp', view); if (!f) return;
    var rd = new FileReader(); rd.onload = function () {
      var o = null; try { o = R.sanitizeImport(JSON.parse(rd.result)); } catch (e) { o = null; }
      if (!o) { err.textContent = '이 앱에서 내보낸 JSON 파일이 아니에요.'; return; }
      confirmBox('가져올까요?', '지금 자료를 파일 내용(거래 ' + o.tx.length + '건, 기부자 ' + o.donors.length + '명)으로 바꿔요. 주민번호는 다시 넣어야 해요.', '가져오기', function () {
        S.org = o.org; S.tx = o.tx; S.donors = o.donors; S.rules = o.rules;
        if (o.settings.acks && typeof o.settings.acks === 'object') S.settings.acks = o.settings.acks; if (+o.settings.receiptSeqStart >= 1) S.settings.receiptSeqStart = +o.settings.receiptSeqStart; S.settings.gran = o.settings.gran === 'each' ? 'each' : 'month';
        S.settings.onboarded = true; S.settings.example = false; commit(); toast('가져왔어요'); go('#/');
      });
    }; rd.readAsText(f);
  });
  $('#wipe', view).addEventListener('click', function () { confirmBox('전부 지울까요?', '되돌릴 수 없어요. 필요하면 먼저 내보내기로 백업하세요.', '전체 지우기', function () { wipeAll(); toast('모두 지웠어요'); go('#/start'); }, true); });
  $('#st', view).addEventListener('click', function () { var r = R.selfTest(C, RJ, SF0); $('#st-out', view).textContent = '자체 점검 ' + r.pass + '/' + r.total + ' 통과' + (r.fail ? ' — 실패: ' + r.results.filter(function (x) { return !x.pass; }).map(function (x) { return x.name; }).join(', ') : ''); });
};
/* ---------- 시작 ---------- */
function boot() {
  Promise.all(['data/codes.json', 'data/rules.json', 'data/suffixes.json'].map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); })).then(function (x) {
    C = x[0]; RJ = x[1]; SF0 = x[2]; loadState();
    if (flags.storageError) toast('이 브라우저는 저장이 막혀 있어요. 닫으면 내용이 사라져요.');
    window.addEventListener('hashchange', render); render();
    window.runSelfTest = function () { return R.selfTest(C, RJ, SF0); };
  }).catch(function () {
    $('#view').innerHTML = '<h1>앱 자료를 불러오지 못했어요</h1><div class="card danger"><p>인터넷 연결을 확인하고 다시 열어 주세요. 한 번 연 뒤에는 오프라인에서도 열려요.</p><button class="btn block" type="button" onclick="location.reload()">다시 열기</button></div>';
    document.title = R.pageTitle('앱 자료를 불러오지 못했어요', APP);
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
}
window.__dr = { state: function () { return S; }, calc: function () { CACHE = null; return calc(); } };
boot();
})();
