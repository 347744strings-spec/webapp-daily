/* 한파TBM 5분 — app.js (빌드: /workspace/webapps/_build/hanpa/a1~a6.js 이어붙임) */
(function () {
'use strict';
var R = window.HanpaRules;
var P = 'hanpatbm.';
var K = { sites: P + 'sites', active: P + 'activeSiteId', logs: P + 'logs', cache: P + 'cache', draft: P + 'draft', prefs: P + 'prefs', manual: P + 'manual' };
var FORECAST = 'https://api.open-meteo.com/v1/forecast';
var GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
var KMA_ALERT = 'https://www.weather.go.kr/w/special-report/overall.do';
var DISC = '참고용, 법적 의무 이행을 대체하지 않음';
var RULES = null, CARDS = {};
var LANGS = [['ko', '한국어'], ['zh', '中文'], ['vi', 'Tiếng Việt'], ['en', 'English']];
var CITIES = [
  ['서울', 37.5665, 126.978], ['부산', 35.1796, 129.0756], ['인천', 37.4563, 126.7052], ['대구', 35.8714, 128.6014], ['대전', 36.3504, 127.3845],
  ['광주', 35.1595, 126.8526], ['울산', 35.5384, 129.3114], ['세종', 36.48, 127.289], ['수원', 37.2636, 127.0286], ['고양', 37.6584, 126.832],
  ['성남', 37.42, 127.1265], ['용인', 37.2411, 127.1776], ['화성', 37.1995, 126.8312], ['평택', 36.9921, 127.1129], ['파주', 37.76, 126.78],
  ['춘천', 37.8813, 127.7298], ['원주', 37.3422, 127.9202], ['강릉', 37.7519, 128.8761], ['철원', 38.1467, 127.3133], ['대관령(평창)', 37.6771, 128.718],
  ['청주', 36.6424, 127.489], ['충주', 36.991, 127.9259], ['천안', 36.8151, 127.1139], ['당진', 36.8898, 126.6458], ['전주', 35.8242, 127.148],
  ['군산', 35.9676, 126.7366], ['목포', 34.8118, 126.3922], ['여수', 34.7604, 127.6622], ['포항', 36.019, 129.3435], ['구미', 36.1195, 128.3446],
  ['안동', 36.5684, 128.7294], ['창원', 35.2279, 128.6811], ['진주', 35.18, 128.1076], ['제주', 33.4996, 126.5312], ['서귀포', 33.2541, 126.56]
];
var WT = { general: '옥외 일반', heavy: '중작업', sanitation: '환경미화·상하차' };

function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function isNum(x) { return typeof x === 'number' && isFinite(x); }
function fmtT(x) { return isNum(x) ? (Math.round(x * 10) / 10).toFixed(1).replace('-', '−') + '℃' : '—'; }
function fmtN(x, d) { return isNum(x) ? x.toFixed(d == null ? 1 : d).replace('-', '−') : '—'; }

/* KST 날짜·시각 (기기 시간대와 무관) */
function kstParts(d) {
  var f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  var o = {}; f.formatToParts(d || new Date()).forEach(function (p) { o[p.type] = p.value; });
  return { date: o.year + '-' + o.month + '-' + o.day, hour: parseInt(o.hour, 10), min: o.minute };
}
function todayKST() { return kstParts().date; }
function addDays(ds, n) { var d = new Date(ds + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
var WD = ['일', '월', '화', '수', '목', '금', '토'];
function dayLabel(ds) { var d = new Date(ds + 'T12:00:00Z'); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' (' + WD[d.getUTCDay()] + ')'; }
function fmtStamp(iso) { if (!iso) return '—'; var p = kstParts(new Date(iso)); return p.date.slice(5).replace('-', '/') + ' ' + String(p.hour).padStart(2, '0') + ':' + p.min + ' KST'; }
function fmtDur(sec) { if (!isNum(sec)) return '—'; var m = Math.floor(sec / 60), s = Math.round(sec % 60); return m + '분 ' + s + '초'; }

/* 저장소: 앱 접두사 키, 깨진 JSON은 기본값으로 복구 */
function load(k, def) {
  try { var v = localStorage.getItem(k); if (v == null) return def; var j = JSON.parse(v); return j == null ? def : j; }
  catch (e) { try { localStorage.removeItem(k); } catch (e2) {} state.recovered = true; return def; }
}
function save(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { toast('기기 저장 공간이 부족해요. 일지를 내보낸 뒤 오래된 기록을 지워 주세요.'); return false; }
}
var state = { recovered: false, wx: {}, loading: {}, selDate: null, briefStart: null };
function sites() { var s = load(K.sites, []); return Array.isArray(s) ? s.map(R.sanitizeSite).filter(Boolean) : []; }
function activeSite() { var id = load(K.active, null), ss = sites(); return ss.filter(function (s) { return s.id === id; })[0] || ss[0] || null; }
function logs() { var l = load(K.logs, []); return Array.isArray(l) ? l.map(R.sanitizeLog).filter(Boolean) : []; }
function prefs() { var p = load(K.prefs, {}); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; }
function setPref(k, v) { var p = prefs(); p[k] = v; save(K.prefs, p); }
function cacheAll() { var c = load(K.cache, {}); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; }
function manualAll() { var c = load(K.manual, {}); return c && typeof c === 'object' && !Array.isArray(c) ? c : {}; }
function draft() { var d = load(K.draft, null); return d && typeof d === 'object' && d.id ? d : null; }

/* 선 그림 픽토그램 (흑백 인쇄에서도 식별) */
var ICON = {
  clothes: '<path d="M24 10l-12 7 5 11 5-3v29h28V25l5 3 5-11-12-7c-2 5-6 8-12 8s-10-3-12-8z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M36 26v28" stroke="currentColor" stroke-width="3"/>',
  shelter: '<path d="M10 34L36 12l26 22" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 30v28h38V30" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M31 58V44h10v14" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M28 22c0-4 4-4 4-8M38 20c0-4 4-4 4-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  cup: '<path d="M16 26h32v18a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><path d="M48 31h4a6 6 0 0 1 0 12h-4" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M24 20c0-4 4-4 4-8M34 20c0-4 4-4 4-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M12 62h40" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
  clock: '<circle cx="36" cy="38" r="22" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M36 24v14l10 6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 10h16" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
  phone: '<path d="M20 12h10l4 12-6 4c3 7 8 12 15 15l4-6 12 4v10c0 3-2 5-5 5C33 56 16 39 16 17c0-3 2-5 4-5z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/><text x="46" y="26" font-size="14" font-weight="800" fill="currentColor" font-family="sans-serif">119</text>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/>',
  print: '<path d="M7 9V3h10v6M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2M7 14h10v7H7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  share: '<circle cx="18" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" stroke="currentColor" stroke-width="2"/>'
};
function picto(name, vb) { return '<svg viewBox="' + (vb || '0 0 72 72') + '" aria-hidden="true" focusable="false">' + ICON[name] + '</svg>'; }
function ico(name) { return picto(name, '0 0 24 24'); }
/* ---------- 공통 UI ---------- */
var toastT = null;
function toast(msg) {
  var t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3200);
}
var lastFocus = null;
function openModal(html, onReady) {
  lastFocus = document.activeElement;
  var root = $('#modal-root');
  root.innerHTML = '<div class="modal-bg" data-close="1"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mh">' + html + '</div></div>';
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
  var first = $('input,select,textarea,button', bg); if (first) first.focus();
  if (onReady) onReady(bg);
}
function closeModal() { $('#modal-root').innerHTML = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }
function confirmBox(title, body, okLabel, cb, danger) {
  openModal('<h2 id="mh">' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-dismiss="1" type="button">취소</button><button class="btn grow ' + (danger ? 'danger' : 'pri') + '" id="mok" type="button">' + esc(okLabel) + '</button></div>',
    function (bg) { $('#mok', bg).addEventListener('click', function () { closeModal(); cb(); }); });
}

function discHtml() { return '<p class="disc">ⓘ ' + DISC + '</p>'; }
function stageBadge(id) { var m = R.stageMeta(id, RULES); return '<span class="badge ' + esc(id || 'none') + '">' + esc(m.short) + '</span>'; }
function wcLabel(id) { var s = RULES.windChillStages.filter(function (x) { return x.id === id; })[0]; return s ? s.label : ''; }
function stepper(n) { var h = '<div class="stepper" aria-hidden="true">'; for (var i = 1; i <= 4; i++) h += '<span class="' + (i <= n ? 'on' : '') + '"></span>'; return h + '</div><p class="small muted" style="margin:-6px 0 8px">브리핑 ' + n + '/4 단계</p>'; }

/* ---------- 라우터 ---------- */
var routes = {};
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render(soft) {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('/').filter(Boolean), name = parts[0] || '', arg = parts[1] || '';
  var site = activeSite();
  if (!name) name = site ? 'dash' : 'setup';
  if (name === 'dash' && !site) name = 'setup';
  if (!routes[name]) name = site ? 'dash' : 'setup';
  var fn = routes[name];
  var view = $('#view');
  view.innerHTML = '';
  fn(view, arg);
  var tab = { dash: 'dash', check: 'dash', sign: 'dash', log: 'history', cards: 'cards', card: 'cards', history: 'history', basis: 'basis', setup: 'dash' }[name];
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var hd = $('h1', view) || $('h2', view);
  if (render.navigated && !soft) { if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  render.navigated = true;
  document.title = pageTitle(hd ? hd.textContent : '');
}
render.navigated = false;
/* 화면 제목이 앱 이름과 같거나 비어 있으면 접미사를 붙이지 않음 ('한파TBM 5분 — 한파TBM 5분' 중복 방지) */
function pageTitle(h) { var APPN = '한파TBM 5분', t = String(h || '').replace(/\s+/g, ' ').trim(); return !t || t === APPN ? APPN : t + ' — ' + APPN; }
window.__pageTitle = pageTitle;
/* ---------- S1 현장 설정 + 첫 방문 안내 ---------- */
routes.setup = function (view) {
  var ss = sites(), first = !ss.length;
  var pick = null; /* {lat,lon,place} */
  var ladder = RULES.tempStages.map(function (s) { return '<div style="background:' + s.color + (s.id === 'warning' ? ';color:#fff' : '') + '"><b>' + esc(s.criterion.replace('영하 ', '−').replace(' 이하', '')) + '</b>' + esc(s.short) + '</div>'; }).join('');
  var h = '';
  if (first) {
    h += '<section class="card hero" aria-labelledby="t1"><h1 id="t1">한파TBM 5분</h1>' +
      '<p>현장 위치만 고르면 <b>오늘 06~18시 최저기온·체감온도</b>로 고용노동부 한파 예방 단계를 판정하고, 조치 체크리스트 → 외국어 그림 카드 → 참석자 서명 → TBM 일지(PDF)까지 5분에 끝내요.</p>' +
      '<div class="ladder" role="list" aria-label="온도기준 단계">' + ladder.replace(/<div /g, '<div role="listitem" ') + '</div>' +
      '<p class="small" style="margin:6px 0 0">06~18시 최저기온 기준 · 한파특보 발효 시 단계 상향 · ' + DISC + '</p>' +
      '<div class="steps" aria-hidden="true"><div>① 위치</div><div>② 단계·체크</div><div>③ 서명·일지</div></div></section>';
  } else {
    h += '<h1>현장 설정</h1>';
  }
  h += '<section class="card" aria-labelledby="t2"><h2 id="t2">' + (first ? '현장 위치 정하기' : '새 현장 추가') + '</h2>' +
    '<button class="btn pri block" id="geo" type="button">' + ico('pin') + '현재 위치로 시작</button>' +
    '<div id="geomsg" role="alert" class="small" style="margin-top:8px"></div>' +
    '<label class="f" for="q">지역 검색</label><div class="row"><input id="q" type="search" class="grow" style="flex:1 1 160px" placeholder="예: 수원, 천안, 강릉" autocomplete="off" enterkeyhint="search"><button class="btn" id="qs" type="button">검색</button></div>' +
    '<ul class="results" id="res" aria-label="검색 결과"></ul>' +
    '<label class="f" for="city">또는 주요 도시에서 고르기</label><select id="city"><option value="">— 도시 선택 —</option>' + CITIES.map(function (c, i) { return '<option value="' + i + '">' + esc(c[0]) + '</option>'; }).join('') + '</select>' +
    '<p id="picked" class="small" role="status" style="margin-top:8px"></p>' +
    '<label class="f" for="sname">현장 이름</label><input id="sname" type="text" maxlength="40" placeholder="예: ○○아파트 3공구" value="' + (first ? '우리 현장' : '') + '">' +
    '<fieldset style="margin-top:12px"><legend>작업 유형</legend><div class="chips">' +
    RULES.workTypes.map(function (w, i) { return '<label class="chip"><input type="radio" name="wt" value="' + w.id + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(w.label) + '</span></label>'; }).join('') + '</div></fieldset>' +
    '<label class="f" for="off">현장 보정 (미기후)</label><select id="off">' + [-5, -4, -3, -2, -1, 0, 1, 2, 3].map(function (v) { return '<option value="' + v + '"' + (v === 0 ? ' selected' : '') + '>' + (v === 0 ? '보정 없음' : (v > 0 ? '+' : '−') + Math.abs(v) + '℃' + (v < 0 ? ' (하천변·산간·고층 등 더 추운 곳)' : '')) + '</option>'; }).join('') + '</select>' +
    '<p class="small muted">예보는 격자 평균이라 하천변·고층·산간은 더 추울 수 있어요. 보정값은 모든 기온에 더해져요.</p>' +
    '<button class="btn pri block" id="save" type="button" style="margin-top:12px" disabled>위치를 고르면 시작할 수 있어요</button></section>';
  if (!first) {
    h += '<section class="card" aria-labelledby="t3"><h2 id="t3">저장된 현장</h2><ul class="list">' + ss.map(function (s) {
      var on = activeSite() && activeSite().id === s.id;
      return '<li><div class="row" style="background:#fff;border:2px solid ' + (on ? 'var(--pri)' : 'var(--line)') + ';border-radius:12px;padding:8px 10px"><div class="grow"><b>' + esc(s.name) + '</b>' + (on ? ' <span class="badge">사용 중</span>' : '') + '<br><span class="small muted">' + esc(s.place) + ' · ' + esc(WT[s.workType]) + (s.offset ? ' · 보정 ' + fmtN(s.offset, 0) + '℃' : '') + '</span></div>' +
        (on ? '' : '<button class="btn" type="button" data-use="' + esc(s.id) + '">사용</button>') +
        '<button class="iconbtn" type="button" data-del="' + esc(s.id) + '" aria-label="' + esc(s.name) + ' 삭제">✕</button></div></li>';
    }).join('') + '</ul></section>';
  }
  h += privacyBlurb();
  view.innerHTML = h;

  function setPick(p) {
    pick = p;
    $('#picked').innerHTML = p ? '✔ 선택한 위치: <b>' + esc(p.place) + '</b>' : '';
    var b = $('#save'); b.disabled = !p; b.textContent = p ? (first ? '이 위치로 오늘 단계 보기' : '이 현장 저장') : '위치를 고르면 시작할 수 있어요';
  }
  function saveSite(p, auto) {
    var name = ($('#sname').value || '').trim() || (first ? '우리 현장' : p.place.split(' ')[0] + ' 현장');
    var wt = ($('input[name=wt]:checked') || {}).value || 'general';
    var s = R.sanitizeSite({ id: uid('site'), name: name, place: p.place, lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4, workType: wt, offset: parseFloat($('#off').value) || 0 });
    var all = sites(); all.push(s);
    if (save(K.sites, all)) { save(K.active, s.id); state.selDate = null; toast((auto ? '현재 위치로 ' : '') + '“' + s.name + '” 현장을 저장했어요'); go('#/dash'); }
  }
  $('#geo').addEventListener('click', function () {
    var msg = $('#geomsg'), btn = this;
    function denied(text) {
      msg.className = 'card alert small'; msg.style.marginTop = '10px';
      msg.innerHTML = '<b>' + esc(text) + '</b><br>아래 <b>지역 검색</b>이나 <b>주요 도시</b>에서 고르면 똑같이 판정돼요.';
      $('#q').focus();
    }
    if (!('geolocation' in navigator)) { denied('이 브라우저는 위치 기능을 지원하지 않아요.'); return; }
    btn.disabled = true; msg.className = 'small'; msg.textContent = '위치 확인 중…';
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false; msg.textContent = '';
      var p = { lat: pos.coords.latitude, lon: pos.coords.longitude, place: '현재 위치 (' + pos.coords.latitude.toFixed(2) + ', ' + pos.coords.longitude.toFixed(2) + ')' };
      setPick(p); saveSite(p, true);
    }, function (err) {
      btn.disabled = false;
      denied(err && err.code === 1 ? '위치 권한이 거부되어 현재 위치를 쓸 수 없어요.' : '현재 위치를 확인하지 못했어요.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
  function localMatches(q) { return CITIES.filter(function (c) { return c[0].indexOf(q) >= 0; }).map(function (c) { return { lat: c[1], lon: c[2], place: c[0], local: true }; }); }
  function showResults(list, note) {
    var ul = $('#res');
    ul.innerHTML = (note ? '<li class="small" role="status">' + esc(note) + '</li>' : '') + list.slice(0, 6).map(function (r, i) { return '<li><button type="button" data-r="' + i + '">' + esc(r.place) + (r.local ? ' <span class="small muted">(주요 도시)</span>' : '') + '</button></li>'; }).join('');
    $$('button[data-r]', ul).forEach(function (b) { b.addEventListener('click', function () { setPick(list[+b.getAttribute('data-r')]); ul.innerHTML = ''; $('#sname').focus(); }); });
  }
  function search() {
    var q = ($('#q').value || '').trim();
    if (!q) { showResults([], '지역 이름을 입력해 주세요.'); $('#q').focus(); return; }
    var loc = localMatches(q);
    showResults(loc, '검색 중…');
    fetchJSON(GEOCODE + '?name=' + encodeURIComponent(q) + '&count=5&language=ko', 8000).then(function (j) {
      if (!j || j.error || (j.results && !Array.isArray(j.results))) throw new Error('bad');
      var rs = (j.results || []).filter(function (r) { return isNum(r.latitude) && isNum(r.longitude); }).sort(function (a, b) { return (b.country_code === 'KR') - (a.country_code === 'KR'); })
        .map(function (r) { return { lat: r.latitude, lon: r.longitude, place: [r.admin1, r.admin2, r.name].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(' ') + (r.country_code && r.country_code !== 'KR' ? ' (' + r.country + ')' : '') }; });
      var all = loc.concat(rs);
      showResults(all, all.length ? '' : '검색 결과가 없어요. 주요 도시 목록에서 가까운 곳을 고르세요.');
    }).catch(function () {
      showResults(loc, '지금은 지역 검색을 할 수 없어요(오프라인 또는 서비스 오류). ' + (loc.length ? '주요 도시 중에서 고르세요.' : '아래 주요 도시 목록에서 고르세요.'));
    });
  }
  $('#qs').addEventListener('click', search);
  $('#q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  $('#city').addEventListener('change', function () { var c = CITIES[+this.value]; if (this.value !== '' && c) setPick({ lat: c[1], lon: c[2], place: c[0] }); });
  $('#save').addEventListener('click', function () { if (pick) saveSite(pick); });
  $$('[data-use]', view).forEach(function (b) { b.addEventListener('click', function () { save(K.active, b.getAttribute('data-use')); state.selDate = null; go('#/dash'); }); });
  $$('[data-del]', view).forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-del');
      confirmBox('현장 삭제', '이 현장 설정과 저장된 예보를 지울까요? (저장한 일지는 남아요)', '삭제', function () {
        save(K.sites, sites().filter(function (s) { return s.id !== id; }));
        var c = cacheAll(); delete c[id]; save(K.cache, c);
        if (load(K.active, null) === id) { var r = sites()[0]; save(K.active, r ? r.id : null); }
        toast('현장을 삭제했어요'); render();
      }, true);
    });
  });
};
function privacyBlurb() {
  return '<section class="card info small" aria-labelledby="pv"><h2 id="pv" style="font-size:1rem">개인정보 안내</h2><p>현장·서명·일지는 <b>이 기기 브라우저에만</b> 저장돼요(서버 전송·로그인·분석 도구 없음). 예보 조회 때 현장 좌표(소수 둘째 자리 수준)만 Open-Meteo로 보내져요. 서명은 참석 확인 용도로만 쓰고, 필요 없으면 <a href="#/basis">근거·설정</a>에서 모두 지울 수 있어요.</p></section>';
}
/* ---------- 날씨: 조회·캐시·직접 입력 ---------- */
function swReady() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return Promise.resolve();
  if (navigator.serviceWorker.controller) return Promise.resolve();
  return new Promise(function (res) {
    var done = false, fin = function () { if (!done) { done = true; res(); } };
    navigator.serviceWorker.addEventListener('controllerchange', fin);
    setTimeout(fin, 2500);
  });
}
function fetchJSON(url, ms) {
  return swReady().then(function () {
    var ctl = 'AbortController' in window ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms || 10000);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t);
      return r.json().catch(function () { return { error: true, reason: 'parse' }; }).then(function (j) { if (!r.ok && j && !j.error) j.error = true; return j; });
    }, function (e) { clearTimeout(t); throw e; });
  });
}
function validForecast(j) {
  return j && !j.error && j.hourly && Array.isArray(j.hourly.time) && Array.isArray(j.hourly.temperature_2m) && j.hourly.time.length === j.hourly.temperature_2m.length && j.hourly.time.length > 0;
}
function loadWeather(site, force) {
  if (state.loading[site.id]) return state.loading[site.id];
  var url = FORECAST + '?latitude=' + site.lat.toFixed(2) + '&longitude=' + site.lon.toFixed(2) + '&hourly=temperature_2m,wind_speed_10m,apparent_temperature&daily=temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=7';
  var p = fetchJSON(url, 12000).then(function (j) {
    if (!validForecast(j)) throw new Error('invalid');
    var rec = { fetchedAt: new Date().toISOString(), lat: site.lat, lon: site.lon,
      hourly: { time: j.hourly.time, temperature_2m: j.hourly.temperature_2m, wind_speed_10m: j.hourly.wind_speed_10m || [] },
      daily: j.daily && Array.isArray(j.daily.time) ? { time: j.daily.time, temperature_2m_min: j.daily.temperature_2m_min || [] } : null };
    var c = cacheAll(); c[site.id] = rec; save(K.cache, c);
    state.wx[site.id] = { status: 'live', rec: rec };
  }).catch(function () {
    var c = cacheAll()[site.id];
    state.wx[site.id] = c && c.hourly && Array.isArray(c.hourly.time) ? { status: 'cache', rec: c } : { status: 'error', rec: null };
  }).then(function () { delete state.loading[site.id]; });
  state.loading[site.id] = p;
  return p;
}
/* 판정 입력 묶음: 직접 입력 > 예보(실시간/캐시) */
function currentData(site, date) {
  var man = (manualAll()[site.id] || {})[date];
  var wx = state.wx[site.id];
  if (man && isNum(man.minTemp)) {
    var t = R.r1(man.minTemp), wkmh = isNum(man.windMs) ? R.msToKmh(man.windMs) : null, wc = R.windChill(t, wkmh);
    return { kind: 'manual', label: '직접 입력', fetchedAt: man.at, minT: t, minTHour: null, minWC: wc === null ? null : R.r1(wc), wcReason: R.windChillReason(t, wkmh), windMs: man.windMs, hours: [] };
  }
  if (wx && wx.rec) {
    var w = R.dayWindow(wx.rec.hourly, date, site.offset || 0);
    if (w.minT === null) return null;
    var coldest = w.hours.filter(function (x) { return x.h === w.minTHour; })[0] || {};
    return { kind: wx.status, label: 'Open-Meteo 예보' + (wx.status === 'cache' ? ' (저장된 자료)' : ''), fetchedAt: wx.rec.fetchedAt, minT: w.minT, minTHour: w.minTHour, minWC: w.minWC, minWCHour: w.minWCHour,
      wcReason: w.minWC === null ? (coldest.wcReason || 'calm') : 'ok', windMs: isNum(coldest.w) ? R.r1(R.kmhToMs(coldest.w)) : null, hours: w.hours };
  }
  return null;
}
function alertFor(date) { var a = (prefs().alerts || {})[date]; return ['advisory', 'warning'].indexOf(a) >= 0 ? a : 'none'; }
function wcReasonText(d) {
  if (d.wcReason === 'warm') return '산출 조건 아님 (기온 10℃ 초과)';
  if (d.wcReason === 'calm') return '산출 조건 아님 (바람 1.3 m/s 미만)';
  return '산출 조건 아님 (풍속 자료 없음)';
}
function openManual(site, date, prefill) {
  var man = (manualAll()[site.id] || {})[date] || {};
  var t0 = isNum(man.minTemp) ? man.minTemp : (prefill && isNum(prefill.minT) ? prefill.minT : '');
  var w0 = isNum(man.windMs) ? man.windMs : (prefill && isNum(prefill.windMs) ? prefill.windMs : '');
  openModal('<h2 id="mh">직접 입력 · ' + esc(dayLabel(date)) + '</h2><p class="small muted">현장 온도계·기상청 예보 값을 넣으면 그 값으로 판정해요. 현장 보정은 더하지 않아요.</p>' +
    '<form id="mf" novalidate><label class="f" for="mt">06~18시 최저기온 (℃)</label><input id="mt" type="number" inputmode="decimal" step="0.1" min="-40" max="40" required value="' + esc(t0) + '">' +
    '<label class="f" for="mw">그때 풍속 (m/s, 모르면 비움)</label><input id="mw" type="number" inputmode="decimal" step="0.1" min="0" max="60" value="' + esc(w0) + '">' +
    '<p id="merr" role="alert" class="small" style="color:var(--bad);font-weight:700"></p>' +
    '<div class="row" style="margin-top:6px">' + (isNum(man.minTemp) ? '<button class="btn ghost grow" type="button" id="mclr">입력 지우고 예보 사용</button>' : '<button class="btn ghost grow" type="button" data-dismiss="1">취소</button>') + '<button class="btn pri grow" type="submit">이 값으로 판정</button></div></form>',
    function (bg) {
      $('#mf', bg).addEventListener('submit', function (e) {
        e.preventDefault();
        var t = parseFloat($('#mt', bg).value), w = $('#mw', bg).value === '' ? null : parseFloat($('#mw', bg).value);
        if (!isNum(t) || t < -40 || t > 40) { $('#merr', bg).textContent = '기온을 −40~40 사이 숫자로 입력해 주세요.'; $('#mt', bg).focus(); return; }
        if (w !== null && (!isNum(w) || w < 0 || w > 60)) { $('#merr', bg).textContent = '풍속은 0~60 m/s 사이로 입력해 주세요.'; $('#mw', bg).focus(); return; }
        var m = manualAll(); m[site.id] = m[site.id] || {}; m[site.id][date] = { minTemp: t, windMs: w, at: new Date().toISOString() }; save(K.manual, m);
        closeModal(); toast('직접 입력값으로 판정했어요'); render();
      });
      var c = $('#mclr', bg); if (c) c.addEventListener('click', function () { var m = manualAll(); if (m[site.id]) delete m[site.id][date]; save(K.manual, m); closeModal(); toast('예보 자료로 돌아왔어요'); render(); });
    });
}

/* ---------- S2 대시보드 ---------- */
routes.dash = function (view) {
  var site = activeSite();
  var wx = state.wx[site.id];
  if (!wx && !state.loading[site.id]) { loadWeather(site).then(function () { if (['', '#', '#/', '#/dash'].indexOf(location.hash) >= 0) render(true); }); }
  var dates = wx && wx.rec ? R.listDates(wx.rec.hourly) : [];
  var today = todayKST(), now = kstParts();
  if (!state.selDate || (dates.length && dates.indexOf(state.selDate) < 0 && state.selDate !== today && state.selDate !== addDays(today, 1))) state.selDate = now.hour >= 18 ? addDays(today, 1) : today;
  var date = state.selDate;
  var d = currentData(site, date);
  var alert = alertFor(date);
  var h = '<div class="row" style="justify-content:space-between;margin-bottom:8px"><div><h1 style="margin:0">' + esc(site.name) + '</h1><p class="small muted" style="margin:0">' + esc(site.place) + ' · ' + esc(WT[site.workType]) + (site.offset ? ' · 보정 ' + fmtN(site.offset, 0) + '℃' : '') + '</p></div><a class="btn ghost" href="#/setup">현장 변경</a></div>';
  h += '<fieldset style="margin-bottom:12px"><legend class="sr">날짜 선택</legend><div class="chips">' + [[today, '오늘'], [addDays(today, 1), '내일']].map(function (x) { return '<label class="chip"><input type="radio" name="dd" value="' + x[0] + '"' + (x[0] === date ? ' checked' : '') + '><span>' + x[1] + ' ' + esc(dayLabel(x[0])) + '</span></label>'; }).join('') + '</div></fieldset>';
  var busy = !!state.loading[site.id] && !wx;
  if (busy) {
    h += '<section class="card" aria-busy="true"><h2>예보 불러오는 중…</h2><p class="muted">Open-Meteo에서 06~18시 시간별 기온·바람을 가져오고 있어요.</p><button class="btn block" type="button" id="man0">기다리지 않고 직접 입력</button></section>';
  } else if (wx && wx.status === 'cache' && !(d && d.kind === 'manual')) {
    h += '<section class="card alert" role="alert"><h2 style="font-size:1.05rem">최신 예보를 불러오지 못했어요</h2><p class="small">마지막으로 저장한 자료(' + esc(fmtStamp(wx.rec.fetchedAt)) + ' 조회)로 판정했어요. 연결되면 다시 시도하거나 현장 값을 직접 입력하세요.</p><div class="row"><button class="btn grow" type="button" data-retry="1">다시 시도</button><button class="btn grow" type="button" id="man1">직접 입력</button></div></section>';
  }
  if (!busy && !d) {
    h += '<section class="card alert" role="alert" aria-labelledby="et"><h2 id="et">' + (wx && wx.status === 'error' ? '날씨 예보를 불러오지 못했어요' : '이 날짜의 예보 자료가 없어요') + '</h2>' +
      '<p>' + (wx && wx.status === 'error' ? '인터넷 연결이 없거나 예보 서비스에 문제가 있어요. 저장된 자료도 없어요.' : '저장된 자료가 이 날짜를 포함하지 않아요.') + ' <b>현장 온도계나 기상청 예보 값을 직접 입력</b>하면 바로 판정할 수 있어요.</p>' +
      '<div class="row"><button class="btn pri grow" type="button" id="man2">최저기온·풍속 직접 입력</button><button class="btn grow" type="button" data-retry="1">다시 시도</button></div></section>';
  }
  if (d) {
    var ev = R.evaluate({ minTemp: d.minT, minWC: d.minWC, alert: alert, workType: site.workType }, RULES);
    var meta = R.stageMeta(ev.stage, RULES), tmeta = R.stageMeta(ev.tempStage, RULES);
    state.ev = { site: site, date: date, d: d, ev: ev, alert: alert };
    h += '<section class="stage ' + ev.stage + '" aria-labelledby="sl"><p class="small" style="margin:0;font-weight:700">' + esc(dayLabel(date)) + ' 판정 · 고용노동부 한랭질환 예방 단계</p>' +
      '<p class="lv" id="sl">' + esc(meta.label) + '</p>' +
      '<p class="small" style="margin:0;font-weight:700">' + (ev.stage === 'none' ? '06~18시 최저기온이 0℃보다 높아요. 체크리스트 조치 대상 단계가 아니에요.' : '기준: ' + esc(meta.criterion) + (ev.raised ? ' · 한파특보 발효로 상향 (온도기준: ' + esc(tmeta.short) + ')' : '')) + '</p>' +
      '<div class="kv"><div><span class="small">' + (d.kind === 'manual' ? '최저기온 (입력)' : '06~18시 최저기온') + '</span><b class="num">' + fmtT(d.minT) + '</b><span class="small">' + (d.minTHour !== null ? '가장 추운 때 ' + String(d.minTHour).padStart(2, '0') + '시' : '직접 입력값') + '</span></div>' +
      '<div><span class="small">최저 체감온도 (기상청 식)</span>' + (d.minWC !== null ? '<b class="num">' + fmtT(d.minWC) + '</b><span class="small">체감 단계 ' + esc(wcLabel(ev.wcStage)) + (d.minWCHour !== null && d.minWCHour !== undefined ? ' · ' + String(d.minWCHour).padStart(2, '0') + '시' : '') + '</span>' : '<b style="font-size:1rem">' + esc(wcReasonText(d)) + '</b><span class="small">기온 ' + fmtT(d.minT) + '</span>') + '</div></div>' +
      '<p class="small" style="margin:0">자료: ' + esc(d.label) + ' · ' + (d.kind === 'manual' ? '입력 ' : '조회 ') + esc(fmtStamp(d.fetchedAt)) + ' · 기상청 공식 특보 아님</p>' + discHtml() + '</section>';
    h += '<button class="btn pri block" type="button" id="brief" style="margin-bottom:14px">▶ 브리핑 시작 (' + (ev.actions.length ? '조치 ' + ev.actions.length + '개' : '카드·서명') + ' · 5분)</button>';
    h += '<section class="card" aria-labelledby="alt"><h2 id="alt">한파특보 발효 여부</h2><p class="small muted">날씨누리에서 우리 지역 특보를 확인한 뒤 고르세요. 특보가 발효되면 기온이 기준에 못 미쳐도 해당 단계 조치를 해요(고용노동부 가이드).</p>' +
      '<fieldset><legend class="sr">한파특보</legend><div class="chips">' + RULES.alerts.map(function (a) { return '<label class="chip"><input type="radio" name="al" value="' + a.id + '"' + (a.id === alert ? ' checked' : '') + '><span>' + esc(a.label) + '</span></label>'; }).join('') + '</div></fieldset>' +
      '<a class="btn ghost block" style="margin-top:10px" href="' + KMA_ALERT + '" target="_blank" rel="noopener">날씨누리 특보 확인하기<span class="sr"> (새 창)</span> ↗</a></section>';
    if (ev.wcStage && (ev.wcStage === 'wc_warning' || ev.wcStage === 'wc_danger')) {
      var ws = RULES.windChillStages.filter(function (x) { return x.id === ev.wcStage; })[0];
      h += '<section class="card info" aria-labelledby="wct"><h2 id="wct" style="font-size:1.05rem">바람 주의: 체감온도 ' + esc(ws.label) + ' 단계</h2><p class="small">바람이 불 때는 체감온도를 고려해 적극적으로 조치하는 것이 바람직해요(가이드 비고). 단계 판정은 기온 기준이에요.</p><ul class="small">' + ws.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></section>';
    }
    if (d.hours.length) h += graphHtml(d.hours);
    h += '<p><button class="linkbtn" type="button" id="man3">' + (d.kind === 'manual' ? '직접 입력값 수정·해제' : '현장 값으로 직접 입력·보정') + '</button>' + (d.kind !== 'manual' ? ' <button class="linkbtn" type="button" data-retry="1">예보 새로고침</button>' : '') + '</p>';
  }
  if (wx && wx.rec) h += weekHtml(site, wx.rec, date);
  var dr = draft();
  if (dr && dr.siteId === site.id) h += '<section class="card info"><p style="margin:0 0 8px"><b>진행 중인 브리핑</b> · ' + esc(dayLabel(dr.date)) + ' · 서명 ' + dr.attendees.length + '명</p><a class="btn block" href="#/check">이어서 하기</a></section>';
  var lastLog = logs().filter(function (l) { return l.siteId === site.id && l.date === date; }).pop();
  if (lastLog) h += '<section class="card okbox"><p style="margin:0"><b>✔ ' + esc(dayLabel(date)) + ' TBM 일지 저장됨</b> · 참석 ' + lastLog.attendees.length + '명' + (lastLog.durationSec ? ' · 소요 ' + fmtDur(lastLog.durationSec) : '') + ' · <a href="#/log/' + esc(lastLog.id) + '">일지 보기</a></p></section>';
  view.innerHTML = h;
  $$('input[name=dd]', view).forEach(function (r) { r.addEventListener('change', function () { state.selDate = r.value; render(); }); });
  $$('input[name=al]', view).forEach(function (r) { r.addEventListener('change', function () { var p = prefs(); p.alerts = p.alerts || {}; p.alerts[date] = r.value; save(K.prefs, p); toast(r.value === 'none' ? '특보 없음으로 판정해요' : '특보 발효로 단계를 다시 판정했어요'); render(); var x = $('input[name=al][value="' + r.value + '"]'); if (x) x.focus(); }); });
  ['#man0', '#man1', '#man2', '#man3'].forEach(function (s) { var b = $(s, view); if (b) b.addEventListener('click', function () { openManual(site, date, d); }); });
  $$('[data-retry]', view).forEach(function (b) { b.addEventListener('click', function () { delete state.wx[site.id]; toast('예보를 다시 불러와요'); render(true); }); });
  $$('[data-day]', view).forEach(function (b) { b.addEventListener('click', function () { state.selDate = b.getAttribute('data-day'); render(); }); });
  var bb = $('#brief', view); if (bb) bb.addEventListener('click', function () { startBriefing(); });
};
function graphHtml(hours) {
  var W = 340, H = 190, L = 34, Rr = 18, T = 14, B = 30;
  var vals = []; hours.forEach(function (x) { vals.push(x.t); if (x.wc !== null) vals.push(x.wc); });
  var lo = Math.min.apply(null, vals.concat([-16])), hi = Math.max.apply(null, vals.concat([2]));
  lo = Math.floor(lo / 2) * 2 - 1; hi = Math.ceil(hi / 2) * 2 + 1;
  function X(h) { return L + (h - 6) * (W - L - Rr) / 12; }
  function Y(v) { return T + (hi - v) * (H - T - B) / (hi - lo); }
  var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="gt"><title id="gt">06~18시 기온·체감온도 그래프. 최저기온 ' + fmtT(Math.min.apply(null, hours.map(function (x) { return x.t; }))) + '</title>';
  RULES.tempStages.forEach(function (st) { if (st.maxTemp >= lo && st.maxTemp <= hi) { var y = Y(st.maxTemp); s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y + '" y2="' + y + '" stroke="' + st.color + '" stroke-width="2" stroke-dasharray="' + (st.id === 'daily' ? '0' : '5 4') + '"/><text x="' + (L - 3) + '" y="' + (y + 4) + '" font-size="10" text-anchor="end" fill="#14213D">' + st.maxTemp + '</text>'; } });
  [6, 9, 12, 15, 18].forEach(function (h) { s += '<text x="' + X(h) + '" y="' + (H - 10) + '" font-size="11" text-anchor="middle" fill="#14213D">' + String(h).padStart(2, '0') + '시</text>'; });
  var pt = hours.map(function (x) { return X(x.h).toFixed(1) + ',' + Y(x.t).toFixed(1); }).join(' ');
  s += '<polyline points="' + pt + '" fill="none" stroke="#1D4E89" stroke-width="3"/>';
  var wcs = hours.filter(function (x) { return x.wc !== null; });
  if (wcs.length > 1) s += '<polyline points="' + wcs.map(function (x) { return X(x.h).toFixed(1) + ',' + Y(x.wc).toFixed(1); }).join(' ') + '" fill="none" stroke="#14213D" stroke-width="2" stroke-dasharray="3 3"/>';
  var mn = hours.reduce(function (a, x) { return x.t < a.t ? x : a; }, hours[0]);
  hours.forEach(function (x) { s += '<circle cx="' + X(x.h).toFixed(1) + '" cy="' + Y(x.t).toFixed(1) + '" r="' + (x === mn ? 5 : 3) + '" fill="' + (x === mn ? '#D62828' : '#1D4E89') + '"/>'; });
  s += '<text x="' + X(mn.h) + '" y="' + (Y(mn.t) + 18) + '" font-size="11" font-weight="700" text-anchor="middle" fill="#14213D">' + fmtT(mn.t) + '</text></svg>';
  var tbl = '<table class="tbl num"><caption class="sr">시간별 기온과 체감온도</caption><thead><tr><th scope="col">시각</th><th scope="col">기온</th><th scope="col">풍속</th><th scope="col">체감온도</th></tr></thead><tbody>' + hours.map(function (x) { return '<tr><td>' + String(x.h).padStart(2, '0') + '시</td><td>' + fmtT(x.t) + '</td><td>' + (isNum(x.w) ? fmtN(R.kmhToMs(x.w)) + ' m/s' : '—') + '</td><td>' + (x.wc !== null ? fmtT(x.wc) : '산출 조건 아님') + '</td></tr>'; }).join('') + '</tbody></table>';
  return '<section class="card graph" aria-labelledby="gh"><h2 id="gh">06~18시 기온 흐름</h2><p class="small muted">— 실선: 기온(현장 보정 포함) · - - 점선: 체감온도 · 가로선: 0/−6/−12/−15℃ 기준 · ● 빨강: 가장 추운 때</p>' + s + '<details><summary>시간별 표로 보기</summary>' + tbl + '</details></section>';
}
function weekHtml(site, rec, sel) {
  var dates = R.listDates(rec.hourly).slice(0, 7);
  var rows = dates.map(function (dt) {
    var w = R.dayWindow(rec.hourly, dt, site.offset || 0); if (w.minT === null) return '';
    var st = R.applyAlert(R.tempStage(w.minT, RULES), alertFor(dt), RULES), meta = R.stageMeta(st, RULES);
    var pct = Math.max(4, Math.min(100, (5 - w.minT) / 25 * 100));
    var di = rec.daily && rec.daily.time ? rec.daily.time.indexOf(dt) : -1, dmin = di >= 0 ? rec.daily.temperature_2m_min[di] : null;
    return '<li><button type="button" data-day="' + dt + '" aria-current="' + (dt === sel ? 'true' : 'false') + '"><span class="num small" style="font-weight:700">' + esc(dayLabel(dt)) + '</span><span style="display:block"><span class="bar"><i style="width:' + pct.toFixed(0) + '%;background:' + meta.color + '"></i></span><span class="small muted num" style="display:block">' + fmtT(w.minT) + (isNum(dmin) ? ' (하루 ' + fmtT(dmin + (site.offset || 0)) + ')' : '') + '</span></span>' + stageBadge(st) + '</button></li>';
  }).join('');
  return '<section class="card" aria-labelledby="wk"><h2 id="wk">7일 미리보기</h2><p class="small muted">막대·첫 숫자 = 06~18시 최저기온(판정 기준), 괄호 = 하루 최저. 막대가 길수록 추워요. 날짜를 누르면 그날로 판정해요.</p><ul class="week">' + rows + '</ul>' + discHtml().replace('class="disc"', 'class="disc" style="background:#F4F7FA"') + '</section>';
}
/* ---------- 브리핑 (S3 체크 → S4 카드 → S5 서명 → S6 일지) ---------- */
function startBriefing() {
  var x = state.ev; if (!x) return;
  var old = draft();
  var begin = function () {
    var dr = { id: uid('log'), startedAt: new Date().toISOString(), siteId: x.site.id, siteName: x.site.name, place: x.site.place, workType: x.site.workType, date: x.date,
      source: x.d.label, fetchedAt: x.d.fetchedAt, minTemp: x.d.minT, minTHour: x.d.minTHour, minWindChill: x.d.minWC, wcStage: x.ev.wcStage, wcNote: x.d.minWC === null ? wcReasonText(x.d) : '',
      tempStage: x.ev.tempStage, stage: x.ev.stage, alertToggle: x.alert, actions: x.ev.actions, checked: [], memo: '', attendees: [], author: prefs().author || '' };
    if (save(K.draft, dr)) go('#/check');
  };
  if (old && old.siteId === x.site.id && old.date === x.date) { go('#/check'); return; }
  if (old) confirmBox('새 브리핑 시작', '진행 중이던 브리핑(' + dayLabel(old.date) + ', 서명 ' + old.attendees.length + '명)을 버리고 새로 시작할까요?', '새로 시작', begin, true);
  else begin();
}
function needDraft(view) {
  var dr = draft();
  if (!dr) { view.innerHTML = '<h1>진행 중인 브리핑이 없어요</h1><section class="card"><p>오늘 화면에서 단계를 확인한 뒤 <b>브리핑 시작</b>을 눌러 주세요.</p><a class="btn pri block" href="#/dash">오늘 화면으로</a></section>'; return null; }
  return dr;
}
routes.check = function (view) {
  var dr = needDraft(view); if (!dr) return;
  var meta = R.stageMeta(dr.stage, RULES), n = dr.actions.length;
  var h = stepper(1) + '<h1>조치 체크리스트</h1>' +
    '<section class="stage ' + dr.stage + '" style="padding:12px"><p style="margin:0;font-weight:800;font-size:1.15rem">' + esc(meta.label) + ' · ' + esc(dayLabel(dr.date)) + '</p><p class="small" style="margin:0">최저 ' + fmtT(dr.minTemp) + (dr.alertToggle !== 'none' ? ' · ' + (dr.alertToggle === 'warning' ? '한파경보' : '한파주의보') + ' 발효 반영' : '') + ' · ' + esc(WT[dr.workType]) + '</p>' + discHtml() + '</section>';
  if (!n) h += '<section class="card info"><p style="margin:0">0℃를 넘는 날이라 단계별 조치 대상은 아니에요. 그래도 작업자 카드로 한랭질환 증상과 119를 안내하고 서명을 받을 수 있어요.</p></section>';
  else {
    h += '<p class="small muted" style="margin:0">고용노동부 가이드 "일상적 관리 조치 + 해당 단계 조치" 문구 그대로예요. 했거나 오늘 할 일을 체크하세요.</p>' +
      '<div class="prog" role="progressbar" aria-label="체크 진행률" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + dr.checked.length + '"><i style="width:' + (dr.checked.length / n * 100) + '%"></i></div><p class="small num" id="pc" aria-live="polite">' + dr.checked.length + ' / ' + n + ' 완료</p>';
    var grp = { warning: '경보 단계 핵심', daily: '일상적 관리 (0℃ 이하)', watch: '한파 관심 단계 추가', advisory: '한파 주의보 단계 추가', extra: '작업유형(' + WT[dr.workType] + ') 추가' }, last = '';
    h += '<ul class="chk">';
    dr.actions.forEach(function (a, i) {
      var g = a.group === 'warning' && !a.emphasis ? 'warning2' : a.group;
      if (g !== last) { h += '<li><h2 style="font-size:1rem;margin:10px 0 4px">' + esc(g === 'warning2' ? '한파 경보 단계 추가' : grp[g]) + '</h2></li>'; last = g; }
      var src = RULES.sources[a.src]; h += '<li class="' + (a.emphasis ? 'em' : '') + '"><label><input type="checkbox" data-a="' + esc(a.id) + '"' + (dr.checked.indexOf(a.id) >= 0 ? ' checked' : '') + '><span>' + (a.emphasis ? '<b>' : '') + esc(a.text) + (a.emphasis ? '</b>' : '') + '<span class="src">출처: ' + esc(src ? src.title.replace(/「|」/g, '') : a.src) + '</span></span></label></li>';
    });
    h += '</ul>';
  }
  h += '<label class="f" for="memo">메모 (특이사항·조치 계획)</label><textarea id="memo" maxlength="2000" placeholder="예: 06~08시 철근 작업 09시로 조정, 쉼터 난로 점검">' + esc(dr.memo) + '</textarea>' +
    '<div class="sticky-cta"><a class="btn pri block" href="#/cards">다음: 작업자 카드 →</a></div>';
  view.innerHTML = h;
  $$('input[data-a]', view).forEach(function (c) {
    c.addEventListener('change', function () {
      var d2 = draft(); var id = c.getAttribute('data-a');
      d2.checked = d2.checked.filter(function (x) { return x !== id; }); if (c.checked) d2.checked.push(id);
      save(K.draft, d2);
      var pb = $('.prog', view); pb.setAttribute('aria-valuenow', d2.checked.length); $('i', pb).style.width = (d2.checked.length / n * 100) + '%';
      $('#pc', view).textContent = d2.checked.length + ' / ' + n + ' 완료';
    });
  });
  $('#memo', view).addEventListener('input', function () { var d2 = draft(); d2.memo = this.value; save(K.draft, d2); });
};
function loadCards(lang) {
  if (CARDS[lang]) return Promise.resolve(CARDS[lang]);
  return fetch('cards.' + lang + '.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { CARDS[lang] = j; return j; });
}
function qrSvg(text) {
  try {
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    var n = q.getModuleCount(), m = 2, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" role="img" aria-label="이 언어 카드를 여는 QR 코드" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  } catch (e) { return ''; }
}
function cardUrl(lang) { return location.href.split('#')[0].split('?')[0] + '#/card/' + lang; }
function cardsView(view, lang, worker) {
  lang = LANGS.map(function (l) { return l[0]; }).indexOf(lang) >= 0 ? lang : (prefs().cardLang || 'ko');
  var dr = worker ? null : draft();
  var head = (dr ? stepper(2) : '') + '<h1>' + (worker ? '한파 안전 카드' : '작업자 카드') + '</h1>' +
    '<div class="tabs" role="tablist" aria-label="카드 언어">' + LANGS.map(function (l) { return '<button type="button" role="tab" id="tab-' + l[0] + '" aria-controls="cardp" aria-selected="' + (l[0] === lang) + '" tabindex="' + (l[0] === lang ? '0' : '-1') + '" data-l="' + l[0] + '" lang="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>' +
    '<div id="cardp" role="tabpanel" aria-labelledby="tab-' + lang + '" aria-busy="true"><p class="muted">카드 불러오는 중…</p></div>';
  view.innerHTML = head;
  var tabs = $$('[role=tab]', view);
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { setPref('cardLang', t.getAttribute('data-l')); go(worker ? '#/card/' + t.getAttribute('data-l') : '#/cards/' + t.getAttribute('data-l')); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, j = k === 'ArrowRight' ? (i + 1) % tabs.length : k === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : -1;
      if (j >= 0) { e.preventDefault(); tabs[j].focus(); tabs[j].click(); }
    });
  });
  loadCards(lang).then(function (c) {
    var p = $('#cardp', view); if (!p) return;
    var h = '<div lang="' + esc(c.lang) + '">' + (c.reviewed ? '' : '<p><span class="badge warn">⚠ ' + esc(c.badge) + '</span></p>') +
      '<h2>' + esc(c.title) + '</h2><div class="picto">' + c.rules.map(function (r, i) { return '<div class="pc">' + picto(r.icon) + '<div><h3>' + (i + 1) + '. ' + esc(r.h) + '</h3><p style="margin:0">' + esc(r.t) + '</p></div></div>'; }).join('') + '</div>' +
      '<section class="card alert" style="margin-top:12px"><h2 style="font-size:1.1rem">' + esc(c.symptomsTitle) + '</h2><ul>' + c.symptoms.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="card okbox"><h2 style="font-size:1.1rem">✋ ' + esc(c.rightTitle) + '</h2><p style="margin:0">' + esc(c.right) + '</p></section>' +
      '<a class="call" href="tel:119">' + picto('phone', '0 0 72 72').replace('<svg ', '<svg style="width:40px;height:40px;color:#fff" ') + esc(c.call) + '</a></div>';
    if (!worker) h += '<section class="card" style="margin-top:14px" aria-labelledby="qrh"><h2 id="qrh" style="font-size:1.05rem">작업자 휴대폰으로 보기</h2><div class="qr">' + qrSvg(cardUrl(c.lang)) + '<p class="small" style="margin:0">QR을 찍으면 이 <b>' + esc(c.name) + '</b> 카드가 그대로 열려요(설치·로그인 없음).<br><span class="muted" style="word-break:break-all">' + esc(cardUrl(c.lang)) + '</span></p></div></section>';
    h += '<p class="small muted" style="margin-top:10px">근거: 고용노동부·질병관리청 「한랭질환 예방수칙」(한파안전 5대 기본수칙). 중국어·베트남어·영어는 원어민 검수 전 번역이에요. 공식 18개 모국어 번역본은 <a href="https://www.moel.go.kr/local/seoul/news/notice/noticeView.do?bbs_seq=20251200661" target="_blank" rel="noopener">고용노동부 서울청 게시물<span class="sr"> (새 창)</span></a>에서 받을 수 있어요.</p>';
    if (dr) h += '<div class="sticky-cta"><a class="btn pri block" href="#/sign">다음: 참석자 서명 →</a></div>';
    else if (worker) h += '<p style="margin-top:12px"><a class="btn ghost block" href="#/">현장 관리자용 화면으로</a></p>';
    p.innerHTML = h; p.removeAttribute('aria-busy');
  }).catch(function () {
    var p = $('#cardp', view); if (p) { p.removeAttribute('aria-busy'); p.innerHTML = '<section class="card alert" role="alert"><p>카드를 불러오지 못했어요. 인터넷에 연결된 뒤 한 번 열면 그다음부터는 오프라인에서도 볼 수 있어요.</p><button class="btn" type="button" onclick="location.reload()">다시 시도</button></section>'; }
  });
}
routes.cards = function (view, arg) { cardsView(view, arg, false); };
routes.card = function (view, arg) { cardsView(view, arg, true); };

/* 서명: 획을 0~300 × 0~120 좌표 SVG 경로로 저장(가벼움, 인쇄 선명) */
function sigSvg(path, cls) { return path ? '<svg viewBox="0 0 300 120" role="img" aria-label="서명"' + (cls ? ' class="' + cls + '"' : '') + '><path d="' + esc(path) + '" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<span class="small muted">(서명 없음·이름 확인)</span>'; }
routes.sign = function (view) {
  var dr = needDraft(view); if (!dr) return;
  var h = stepper(3) + '<h1>참석자 서명</h1><p class="small muted">이름을 적고 칸에 손가락으로 서명한 뒤 <b>추가</b>를 누르세요. 다음 사람에게 휴대폰을 넘기면 돼요.</p>' +
    '<section class="card"><label class="f" for="an" style="margin-top:0">참석자 이름</label><input id="an" type="text" maxlength="40" autocomplete="off" placeholder="예: 김민수 / Nguyen Van A">' +
    '<p class="f" id="sgl" style="margin-bottom:6px">서명</p><div class="sigpad"><canvas id="pad" aria-labelledby="sgl" role="img"></canvas><span class="ph" id="ph">여기에 서명</span></div>' +
    '<p id="serr" role="alert" class="small" style="color:var(--bad);font-weight:700;margin:6px 0 0"></p>' +
    '<div class="row" style="margin-top:8px"><button class="btn ghost grow" type="button" id="clr">서명 지우기</button><button class="btn pri grow" type="button" id="add">추가</button></div></section>' +
    '<h2 id="cnt" aria-live="polite">참석 ' + dr.attendees.length + '명</h2><ul class="att" id="att"></ul>' +
    (dr.attendees.length ? '' : '<p class="muted" id="emp">아직 서명한 사람이 없어요.</p>') +
    '<div class="sticky-cta"><a class="btn pri block" href="#/log">다음: 일지 미리보기 →</a></div>';
  view.innerHTML = h;
  function list() {
    var d2 = draft();
    $('#att', view).innerHTML = d2.attendees.map(function (a, i) { return '<li><span class="nm">' + (i + 1) + '. ' + esc(a.name) + '</span>' + sigSvg(a.sig) + '<button class="iconbtn" type="button" data-rm="' + i + '" aria-label="' + esc(a.name) + ' 서명 삭제">✕</button></li>'; }).join('');
    $('#cnt', view).textContent = '참석 ' + d2.attendees.length + '명';
    var e = $('#emp', view); if (e) e.hidden = d2.attendees.length > 0;
    $$('[data-rm]', view).forEach(function (b) { b.addEventListener('click', function () { var d3 = draft(); var gone = d3.attendees.splice(+b.getAttribute('data-rm'), 1)[0]; save(K.draft, d3); list(); toast((gone ? gone.name : '') + ' 서명을 삭제했어요'); $('#an', view).focus(); }); });
  }
  list();
  var cv = $('#pad', view), ctx = cv.getContext('2d'), strokes = [], cur = null;
  function fit() { if (!document.body.contains(cv)) return; var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); ctx.setTransform(dpr * r.width / 300, 0, 0, dpr * r.height / 120, 0, 0); redraw(); }
  function redraw() { ctx.clearRect(0, 0, 300, 120); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; strokes.forEach(function (s) { ctx.beginPath(); s.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (s.length === 1) ctx.lineTo(s[0][0] + 0.1, s[0][1]); ctx.stroke(); }); var ph = $('#ph', view); if (ph) ph.hidden = strokes.length > 0; }
  function pt(e) { var r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 300), Math.round((e.clientY - r.top) / r.height * 120)]; }
  cv.addEventListener('pointerdown', function (e) { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) {} cur = [pt(e)]; strokes.push(cur); redraw(); });
  cv.addEventListener('pointermove', function (e) { if (!cur) return; var p = pt(e), l = cur[cur.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= 2) { cur.push(p); redraw(); } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { cv.addEventListener(t, function () { cur = null; }); });
  fit(); var onRs = function () { if (!document.body.contains(cv)) { window.removeEventListener('resize', onRs); return; } fit(); }; window.addEventListener('resize', onRs);
  $('#clr', view).addEventListener('click', function () { strokes = []; redraw(); });
  function pathStr() { return strokes.map(function (s) { return s.map(function (p, i) { return (i ? 'L' : 'M') + Math.max(0, Math.min(300, p[0])) + ' ' + Math.max(0, Math.min(120, p[1])); }).join('') + (s.length === 1 ? 'l1 0' : ''); }).join(''); }
  function add(allowNoSig) {
    var name = ($('#an', view).value || '').trim();
    if (!name) { $('#serr', view).textContent = '참석자 이름을 입력해 주세요.'; $('#an', view).focus(); return; }
    if (!strokes.length && !allowNoSig) {
      confirmBox('서명 없이 추가', name + ' 님을 서명 없이 이름만 추가할까요? (서명이 어려운 경우 구두 확인으로 기록)', '이름만 추가', function () { add(true); });
      return;
    }
    var d2 = draft(); d2.attendees.push({ name: name, sig: strokes.length ? pathStr() : null });
    if (!save(K.draft, d2)) return;
    strokes = []; redraw(); $('#an', view).value = ''; $('#serr', view).textContent = '';
    list(); toast(name + ' 님 서명 추가 · 총 ' + d2.attendees.length + '명'); $('#an', view).focus();
  }
  $('#add', view).addEventListener('click', function () { add(false); });
  $('#an', view).addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(false); } });
};
/* ---------- S6 일지 미리보기·저장 / 저장된 일지 ---------- */
function sheetHtml(l, actions) {
  var meta = R.stageMeta(l.stage, RULES), tmeta = R.stageMeta(l.tempStage || l.stage, RULES);
  var act = actions && actions.length ? actions.map(function (a) { var on = l.checked.indexOf(a.id) >= 0; return '<li>' + (on ? '☑ ' : '☐ ') + esc(a.text) + (on ? '' : ' <i>(미체크)</i>') + '</li>'; }).join('')
    : (l.checkedText && l.checkedText.length ? l.checkedText.map(function (t) { return '<li>☑ ' + esc(t) + '</li>'; }).join('') : '<li>체크한 조치 없음</li>');
  return '<article class="sheet" aria-label="TBM 일지"><h2>한파 대비 TBM 일지</h2><table><tbody>' +
    '<tr><th scope="row">작업일</th><td class="num">' + esc(l.date) + ' (' + WD[new Date(l.date + 'T12:00:00Z').getUTCDay()] + ')</td></tr>' +
    '<tr><th scope="row">현장</th><td>' + esc(l.siteName) + (l.place ? ' · ' + esc(l.place) : '') + ' · ' + esc(WT[l.workType] || '') + '</td></tr>' +
    '<tr><th scope="row">기상 자료</th><td>' + esc(l.source) + ' · ' + esc(fmtStamp(l.fetchedAt)) + '<br>06~18시 최저기온 <b class="num">' + fmtT(l.minTemp) + '</b>' + (isNum(l.minTHour) ? ' (' + String(l.minTHour).padStart(2, '0') + '시)' : '') + ' · 최저 체감온도 ' + (isNum(l.minWindChill) ? '<b class="num">' + fmtT(l.minWindChill) + '</b>' + (l.wcStage ? ' (' + esc(wcLabel(l.wcStage)) + ')' : '') : esc(l.wcNote || '산출 조건 아님')) + '</td></tr>' +
    '<tr><th scope="row">한파특보</th><td>' + esc({ none: '특보 없음(사용자 확인)', advisory: '한파주의보 발효', warning: '한파경보 발효' }[l.alertToggle]) + '</td></tr>' +
    '<tr><th scope="row">판정 단계</th><td><b>' + esc(meta.label) + '</b> [' + esc(meta.short) + ']' + (l.tempStage && l.tempStage !== l.stage ? ' · 온도기준 ' + esc(tmeta.short) + '에서 특보로 상향' : '') + '</td></tr>' +
    '<tr><th scope="row">조치 사항</th><td><ul style="margin:0;padding-left:0;list-style:none">' + act + '</ul></td></tr>' +
    '<tr><th scope="row">메모</th><td>' + (l.memo ? esc(l.memo).replace(/\n/g, '<br>') : '—') + '</td></tr>' +
    '<tr><th scope="row">참석자 (' + l.attendees.length + '명)</th><td>' + (l.attendees.length ? '<table><tbody>' + l.attendees.map(function (a, i) { return '<tr><td style="width:2.4em">' + (i + 1) + '</td><td>' + esc(a.name) + '</td><td class="sigcell">' + sigSvg(a.sig) + '</td></tr>'; }).join('') + '</tbody></table>' : '없음') + '</td></tr>' +
    '<tr><th scope="row">작성자</th><td id="sheet-author">' + (l.author ? esc(l.author) : '—') + (l.savedAt ? ' · 저장 ' + esc(fmtStamp(l.savedAt)) : '') + '</td></tr>' +
    '</tbody></table><p class="small" style="margin-top:8px">※ ' + DISC + '. 단계는 고용노동부 한랭질환 예방가이드 온도기준(06~18시 예보 최저기온)과 기상청 체감온도 식으로 계산한 값이며 기상청 공식 특보가 아님. 만든 곳: 한파TBM 5분</p></article>';
}
function shareText(l) {
  var m = R.stageMeta(l.stage, RULES);
  return '[한파 TBM] ' + dayLabel(l.date) + ' ' + l.siteName + '\n단계: ' + m.label + ' (06~18시 최저 ' + fmtT(l.minTemp) + ')\n참석 ' + l.attendees.length + '명 · 조치 체크 ' + l.checked.length + '개\n' + DISC + ' · 기상청 공식 특보 아님';
}
function doShare(l) {
  var text = shareText(l);
  if (navigator.share) { navigator.share({ title: '한파 TBM 일지', text: text }).catch(function () {}); return; }
  var done = function () { toast('요약을 복사했어요. 단톡방에 붙여 넣으세요'); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text) ? done() : toast('복사하지 못했어요'); });
  else fallbackCopy(text) ? done() : toast('복사하지 못했어요');
}
function fallbackCopy(t) { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok; }
routes.log = function (view, id) {
  if (id) return savedLog(view, id);
  var dr = needDraft(view); if (!dr) return;
  var el = Math.round((Date.now() - new Date(dr.startedAt).getTime()) / 1000);
  var h = '<div class="no-print">' + stepper(4) + '<h1>TBM 일지 미리보기</h1><p class="small muted">브리핑 시작 후 <b class="num">' + fmtDur(el) + '</b> 지났어요 (목표 5분).</p>' +
    '<label class="f" for="au">작성자 (관리감독자)</label><input id="au" type="text" maxlength="40" autocomplete="name" value="' + esc(dr.author) + '" placeholder="이름">' +
    '<p id="aerr" role="alert" class="small" style="color:var(--bad);font-weight:700;margin:6px 0"></p></div>' +
    sheetHtml(dr, dr.actions) +
    '<div class="no-print" style="margin-top:12px"><button class="btn pri block" type="button" id="sv">일지 저장하고 마치기</button>' +
    '<div class="row" style="margin-top:10px"><button class="btn grow" type="button" id="pr">' + ico('print') + '인쇄·PDF</button><button class="btn grow" type="button" id="sh">' + ico('share') + '공유</button></div>' +
    '<div class="row" style="margin-top:10px"><a class="btn ghost grow" href="#/check">체크 수정</a><a class="btn ghost grow" href="#/sign">서명 수정</a></div></div>';
  view.innerHTML = h;
  $('#au', view).addEventListener('input', function () { var d2 = draft(); d2.author = this.value; save(K.draft, d2); var c = $('#sheet-author', view); if (c) c.textContent = this.value || '—'; });
  $('#pr', view).addEventListener('click', function () { window.print(); });
  $('#sh', view).addEventListener('click', function () { doShare(draft()); });
  $('#sv', view).addEventListener('click', function () {
    var d2 = draft(); var au = ($('#au', view).value || '').trim();
    if (!au) { $('#aerr', view).textContent = '작성자 이름을 입력해 주세요.'; $('#au', view).focus(); return; }
    var dur = Math.round((Date.now() - new Date(d2.startedAt).getTime()) / 1000);
    var l = { id: d2.id, date: d2.date, siteId: d2.siteId, siteName: d2.siteName, place: d2.place, workType: d2.workType, fetchedAt: d2.fetchedAt, source: d2.source,
      minTemp: d2.minTemp, minTHour: d2.minTHour, minWindChill: d2.minWindChill, wcStage: d2.wcStage, wcNote: d2.wcNote, tempStage: d2.tempStage, stage: d2.stage, alertToggle: d2.alertToggle,
      checked: d2.checked, checkedText: d2.actions.filter(function (a) { return d2.checked.indexOf(a.id) >= 0; }).map(function (a) { return a.text; }),
      actionsTotal: d2.actions.length, memo: d2.memo, attendees: d2.attendees, author: au, savedAt: new Date().toISOString(), durationSec: dur };
    var all = load(K.logs, []); if (!Array.isArray(all)) all = [];
    all.push(l);
    if (!save(K.logs, all)) return;
    setPref('author', au);
    try { localStorage.removeItem(K.draft); } catch (e) {}
    toast('일지를 저장했어요 · 소요 ' + fmtDur(dur));
    state.selDate = l.date; if (activeSite() && activeSite().id !== l.siteId && sites().some(function (s) { return s.id === l.siteId; })) save(K.active, l.siteId);
    go('#/dash');
  });
};
function rawLogs() { var a = load(K.logs, []); return Array.isArray(a) ? a : []; }
function savedLog(view, id) {
  var raw = rawLogs().filter(function (x) { return x && x.id === id; })[0];
  var l = raw ? Object.assign({}, R.sanitizeLog(raw), { place: raw.place || '', tempStage: raw.tempStage, wcStage: raw.wcStage, wcNote: raw.wcNote, minTHour: raw.minTHour }) : null;
  if (!l || !l.id) { view.innerHTML = '<h1>일지를 찾을 수 없어요</h1><section class="card"><p>삭제되었거나 다른 기기에서 만든 일지예요.</p><a class="btn block" href="#/history">일지 기록으로</a></section>'; return; }
  view.innerHTML = '<div class="no-print"><h1>TBM 일지 · ' + esc(dayLabel(l.date)) + '</h1></div>' + sheetHtml(l, null) +
    '<div class="no-print" style="margin-top:12px"><div class="row"><button class="btn pri grow" type="button" id="pr">' + ico('print') + '인쇄·PDF</button><button class="btn grow" type="button" id="sh">' + ico('share') + '공유</button></div>' +
    '<div class="row" style="margin-top:10px"><a class="btn ghost grow" href="#/history">← 기록 목록</a><button class="btn danger grow" type="button" id="del">이 일지 삭제</button></div></div>';
  $('#pr', view).addEventListener('click', function () { window.print(); });
  $('#sh', view).addEventListener('click', function () { doShare(l); });
  $('#del', view).addEventListener('click', function () { confirmBox('일지 삭제', dayLabel(l.date) + ' ' + l.siteName + ' 일지를 지울까요? 되돌릴 수 없어요.', '삭제', function () { save(K.logs, rawLogs().filter(function (x) { return !x || x.id !== id; })); toast('일지를 삭제했어요'); go('#/history'); }, true); });
}

/* ---------- S7 기록 (최근 30일) · 내보내기/가져오기 ---------- */
routes.history = function (view) {
  var all = logs(), from = addDays(todayKST(), -29);
  var recent = all.filter(function (l) { return l.date >= from; }).sort(function (a, b) { return (b.date + b.savedAt).localeCompare(a.date + a.savedAt); });
  var older = all.length - recent.length;
  var h = '<h1>일지 기록</h1><p class="muted small">최근 30일(' + esc(dayLabel(from)) + '~) 일지 ' + recent.length + '건' + (older ? ' · 그 이전 ' + older + '건은 내보내기 파일에 포함돼요' : '') + '</p>';
  if (!recent.length) h += '<section class="card" aria-labelledby="emh"><h2 id="emh">아직 저장한 일지가 없어요</h2><p>오늘 화면에서 <b>브리핑 시작</b> → 체크 → 카드 → 서명 → 저장하면 여기에 쌓여요. 다른 기기에서 내보낸 파일이 있으면 가져오기 하세요.</p><a class="btn pri block" href="#/dash">오늘 화면으로</a></section>';
  else h += '<ul class="list">' + recent.map(function (l) { return '<li><a href="#/log/' + esc(l.id) + '"><span><b class="num">' + esc(dayLabel(l.date)) + '</b> ' + esc(l.siteName) + '<br><span class="small muted">최저 ' + fmtT(l.minTemp) + ' · 참석 ' + l.attendees.length + '명 · 체크 ' + l.checked.length + '개</span></span>' + stageBadge(l.stage) + '</a></li>'; }).join('') + '</ul>' + discHtml().replace('class="disc"', 'class="disc" style="background:#fff"');
  h += '<section class="card" aria-labelledby="bk"><h2 id="bk">백업 · 옮기기</h2><p class="small muted">기록은 이 기기에만 있어요. JSON 파일로 내보내 보관하거나 다른 기기에서 가져오세요. (서명 포함)</p>' +
    '<div class="row"><button class="btn grow" type="button" id="ex">JSON 내보내기</button><label class="btn grow" for="im" style="margin:0">JSON 가져오기</label></div><input id="im" type="file" accept="application/json,.json" class="sr"><p id="imsg" role="status" class="small" style="margin-top:8px"></p></section>';
  view.innerHTML = h;
  $('#ex', view).addEventListener('click', function () {
    var data = { app: 'hanpa-tbm', version: 1, exportedAt: new Date().toISOString(), sites: sites(), logs: rawLogs() };
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hanpa-tbm-backup-' + todayKST().replace(/-/g, '') + '.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); toast('내보내기 파일을 만들었어요');
  });
  $('#im', view).addEventListener('change', function () {
    var f = this.files && this.files[0], msg = $('#imsg', view); if (!f) return;
    if (f.size > 8 * 1024 * 1024) { msg.textContent = '파일이 너무 커요(8MB 초과).'; return; }
    var rd = new FileReader();
    rd.onload = function () {
      var j; try { j = JSON.parse(rd.result); } catch (e) { msg.textContent = '⚠ JSON 형식이 아니에요. 한파TBM에서 내보낸 파일인지 확인해 주세요.'; return; }
      if (!j || j.app !== 'hanpa-tbm' || !Array.isArray(j.logs)) { msg.textContent = '⚠ 한파TBM 백업 파일이 아니에요.'; return; }
      var cur = rawLogs(), ids = {}; cur.forEach(function (x) { if (x && x.id) ids[x.id] = 1; });
      var addL = 0, bad = 0; j.logs.forEach(function (x) { var s = R.sanitizeLog(x); if (!s) { bad++; return; } if (ids[s.id]) return; ['place', 'tempStage', 'wcStage', 'wcNote', 'minTHour'].forEach(function (k) { if (x[k] != null && typeof x[k] !== 'object') s[k] = typeof x[k] === 'string' ? x[k].slice(0, 80) : x[k]; }); cur.push(s); ids[s.id] = 1; addL++; });
      var cs = sites(), sid = {}; cs.forEach(function (s) { sid[s.id] = 1; }); var addS = 0;
      (Array.isArray(j.sites) ? j.sites : []).forEach(function (x) { var s = R.sanitizeSite(x); if (s && !sid[s.id]) { cs.push(s); sid[s.id] = 1; addS++; } });
      if (save(K.logs, cur) && save(K.sites, cs)) { if (!load(K.active, null) && cs[0]) save(K.active, cs[0].id); toast('가져오기 완료: 일지 ' + addL + '건, 현장 ' + addS + '곳'); render(); var m2 = $('#imsg'); if (m2) m2.textContent = '가져오기 완료: 일지 ' + addL + '건 추가' + (bad ? ', 형식 오류 ' + bad + '건 제외' : '') + ', 현장 ' + addS + '곳 추가'; }
    };
    rd.readAsText(f);
  });
};

/* ---------- 근거 · 개인정보 · 자체 점검 ---------- */
routes.basis = function (view) {
  var st = R.selfTest(RULES), S = RULES.sources;
  var h = '<h1>근거와 계산 방법</h1><section class="card"><h2>한파 예방 단계 (온도기준)</h2><p class="small">06~18시 시간별 예보 기온의 최저값(현장 보정 포함)을 아래 기준과 비교해요. "이하"라서 경계값(0·−6·−12·−15℃)은 그 단계에 들어가요.</p>' +
    '<table class="tbl"><thead><tr><th scope="col">단계</th><th scope="col">온도기준</th><th scope="col">조치 수</th></tr></thead><tbody>' + RULES.tempStages.map(function (s) { return '<tr><td>' + stageBadge(s.id) + ' ' + esc(s.label) + '</td><td>' + esc(s.criterion) + '</td><td class="num">' + R.actionsFor(s.id, 'general', RULES).length + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<p class="small" style="margin-top:8px">조치 문구: <a href="' + S.MOEL_GUIDE.url + '" target="_blank" rel="noopener">' + esc(S.MOEL_GUIDE.title) + '<span class="sr"> (새 창)</span></a> 표를 그대로 옮겼어요. 주의보·경보 단계는 가이드대로 "일상적 관리 조치 + 해당 단계 조치"예요. 한파특보 발효 시에는 기온이 기준에 못 미쳐도 해당 단계 조치를 해요(가이드 비고).</p>' +
    '<p class="small">경보 단계 "추운 시간대(새벽) 옥외작업 중지 또는 최소화"와 주의보 단계 "작업시간대 조정 또는 단축": <a href="' + S.OPS2025.url + '" target="_blank" rel="noopener">' + esc(S.OPS2025.title) + '<span class="sr"> (새 창)</span></a>, 건설·환경미화 06시→09시 조정: <a href="' + S.MOEL_PR_20251117.url + '" target="_blank" rel="noopener">' + esc(S.MOEL_PR_20251117.title) + '<span class="sr"> (새 창)</span></a></p></section>' +
    '<section class="card"><h2>체감온도 (기상청 공식 식)</h2><p class="num" style="font-weight:700">체감온도 = 13.12 + 0.6215T − 11.37V<sup>0.16</sup> + 0.3965V<sup>0.16</sup>T</p><p class="small">T: 기온(℃), V: 10분 평균 풍속(km/h). <b>기온 10℃ 이하, 풍속 1.3 m/s 이상일 때만</b> 계산하고, 그 밖에는 "산출 조건 아님"으로 표시해요. Open-Meteo의 apparent_temperature는 쓰지 않아요. 출처: <a href="' + S.KMA.url + '" target="_blank" rel="noopener">기상청 기상자료개방포털<span class="sr"> (새 창)</span></a></p>' +
    '<table class="tbl"><thead><tr><th scope="col">체감 단계</th><th scope="col">지수 범위</th></tr></thead><tbody>' + RULES.windChillStages.map(function (s) { return '<tr><td>' + esc(s.label) + '</td><td class="num">' + esc(s.range) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
    '<section class="card"><h2>날씨 자료</h2><p class="small"><a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo<span class="sr"> (새 창)</span></a> 시간별 예보(기온·10m 풍속, 7일, 한국시간)를 써요. 자료 라이선스 CC BY 4.0. 기상청 자료나 공식 특보가 아니므로 특보는 반드시 <a href="' + KMA_ALERT + '" target="_blank" rel="noopener">날씨누리<span class="sr"> (새 창)</span></a>에서 확인하세요. 예보를 못 불러오면 마지막 저장 자료나 직접 입력값으로 판정해요.</p></section>' +
    '<section class="card"><h2>자체 점검 <span class="badge ' + (st.ok ? 'daily' : 'warning') + '">' + st.pass + '/' + st.total + ' 통과</span></h2><p class="small muted">앱을 열 때마다 경계값(0·−6·−12·−15℃), 체감온도 단계 경계, 기상청 식(안전보건공단 산출표 값과 비교), 특보 상향, 조치 수를 자동 확인해요.</p><details><summary>점검 항목 보기</summary><ul class="small">' + st.results.map(function (r) { return '<li>' + (r.pass ? '✔ ' : '✖ ') + esc(r.name) + ' <span class="muted num">(' + esc(String(r.got)) + ')</span></li>'; }).join('') + '</ul></details></section>' +
    privacyBlurb() +
    '<section class="card"><h2>데이터 관리</h2><p class="small">이 기기의 한파TBM 자료(현장·예보·일지·서명·진행 중 브리핑)를 모두 지워요.</p><button class="btn danger block" type="button" id="wipe">모든 자료 지우기</button></section>' +
    '<p class="footer">' + DISC + ' · 기상청 공식 특보 아님 · 규칙 버전 ' + esc(RULES.version) + '<br>QR: qrcode-generator (MIT, Kazuhiko Arase)</p>';
  view.innerHTML = h;
  $('#wipe', view).addEventListener('click', function () { confirmBox('모든 자료 지우기', '현장, 일지, 서명, 저장된 예보가 모두 지워져요. 먼저 일지 기록에서 내보내기를 권해요.', '모두 지우기', function () { Object.keys(K).forEach(function (k) { try { localStorage.removeItem(K[k]); } catch (e) {} }); state.wx = {}; state.selDate = null; toast('모든 자료를 지웠어요'); go('#/setup'); }, true); });
};

/* ---------- 시작 ---------- */
function boot() {
  Promise.all([fetch('rules.json').then(function (r) { if (!r.ok) throw 0; return r.json(); })]).then(function (a) {
    RULES = a[0];
    var st = R.selfTest(RULES); window.__hanpaSelfTest = st;
    window.runSelfTest = function () { return R.selfTest(RULES); };
    window.addEventListener('hashchange', function () { closeModal(); render(); });
    render();
    if (state.recovered) toast('손상된 저장 자료를 초기화했어요');
  }).catch(function () {
    $('#view').innerHTML = '<section class="card alert" role="alert"><h1>앱을 불러오지 못했어요</h1><p>인터넷에 연결한 뒤 다시 열어 주세요. 한 번 열면 다음부터는 오프라인에서도 열려요.</p><button class="btn pri" type="button" onclick="location.reload()">다시 시도</button></section>';
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
}
boot();
})();
