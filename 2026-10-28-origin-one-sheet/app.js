/* 원산지 한 장 — app.js (빌드: /workspace/webapps/_build/origin/b1~b6.js 이어붙임) */
(function () {
'use strict';
var R = window.OriginRules;
var APP = '원산지 한 장';
var P = 'origin1.';
var K = { shop: P + 'shop', menus: P + 'menus', origins: P + 'origins', history: P + 'history', receipts: P + 'receipts', checks: P + 'checks', prefs: P + 'prefs', draft: P + 'draft' };
var RULES = null;
var TYPES = [['general', '일반음식점', '식당·고깃집·횟집·주점 등'], ['rest', '휴게음식점', '분식·카페·패스트푸드·제과 등'], ['catering', '위탁급식·집단급식소', '구내식당·학교·병원 급식 등']];
var CAT = { livestock: '축산물', agri: '농산물', sea: '수산물' };
var EMO = { beef: '🐄', pork: '🐖', chicken: '🐔', duck: '🦆', lamb: '🐑', goat: '🐐', rice: '🍚', kimchi: '🥬', soy: '🫘' };

function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function todayKST() {
  var f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  var o = {}; f.formatToParts(new Date()).forEach(function (p) { o[p.type] = p.value; });
  return o.year + '-' + o.month + '-' + o.day;
}
function fmtD(ds) { return ds ? ds.replace(/-/g, '.') : '—'; }
function emo(id) { var it = R.itemById(RULES, id); return EMO[id] || (it && it.cat === 'sea' ? '🐟' : '•'); }

/* 저장소: 앱 접두사 키, 깨진 JSON은 기본값으로 복구 */
var flags = { recovered: false };
function load(k, def) {
  try { var v = localStorage.getItem(k); if (v == null) return def; var j = JSON.parse(v); return j == null ? def : j; }
  catch (e) { try { localStorage.removeItem(k); } catch (e2) {} flags.recovered = true; return def; }
}
function save(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { toast('기기 저장 공간이 부족해요. 내보내기 후 오래된 장부를 지워 주세요.'); return false; }
}
function obj(x) { return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
function shop() { var s = obj(load(K.shop, {})); return { name: String(s.name || '').slice(0, 30), type: ['general', 'rest', 'catering'].indexOf(s.type) >= 0 ? s.type : '', lang: s.lang === 'ko+en' ? 'ko+en' : 'ko' }; }
function menus() { return R.cleanMenus(load(K.menus, []), RULES); }
function origins() { return R.cleanOrigins(load(K.origins, {}), RULES); }
function history() { var h = load(K.history, []); return Array.isArray(h) ? h.filter(function (x) { return x && R.isDate(x.date); }) : []; }
function receipts() { var r = load(K.receipts, []); return Array.isArray(r) ? r.filter(function (x) { return x && R.isDate(x.date); }) : []; }
function checks() { return obj(load(K.checks, {})); }
function prefs() { var p = obj(load(K.prefs, {})); p.bulk = obj(p.bulk); return p; }
function setPref(k, v) { var p = prefs(); p[k] = v; save(K.prefs, p); }
function fullState() { return { shop: shop(), menus: menus(), origins: origins(), prefs: prefs() }; }
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
  var first = $('input,select,textarea,button', bg); if (first) first.focus();
  if (onReady) onReady(bg);
}
function closeModal() { $('#modal-root').innerHTML = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }
function confirmBox(title, body, okLabel, cb, danger) {
  openModal('<h2 id="mh">' + esc(title) + '</h2><p>' + esc(body) + '</p><div class="row" style="margin-top:14px"><button class="btn ghost grow" data-dismiss="1" type="button">취소</button><button class="btn grow ' + (danger ? 'danger' : 'pri') + '" id="mok" type="button">' + esc(okLabel) + '</button></div>',
    function (bg) { $('#mok', bg).addEventListener('click', function () { closeModal(); cb(); }); });
}
/* 복사: Clipboard API → 실패 시 textarea 선택 복사 */
function copyText(text, what) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
    toast(ok ? (what || '내용') + '을 복사했어요. 붙여넣기 하세요.' : '복사가 막혀 있어요. 글자를 길게 눌러 직접 복사해 주세요.');
  }
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast((what || '내용') + '을 복사했어요. 붙여넣기 하세요.'); }, fallback);
  else fallback();
}
function hotline() { return RULES.hotline; }
function discHtml() { return '<p class="disc">ⓘ 참고용 도구이며 최종 판단은 농관원(<a href="' + hotline().telHref + '">' + hotline().tel + '</a>)·관할 기관 확인이 필요해요.</p>'; }
function stepper(n, total) { var h = '<div class="stepper" aria-hidden="true">'; for (var i = 1; i <= total; i++) h += '<span class="' + (i <= n ? 'on' : '') + '"></span>'; return h + '</div>'; }
function seasonHtml() {
  if (prefs().hideSeason) return '';
  var s = R.seasonFor(todayKST(), RULES.seasons);
  if (!s) return '<div class="card season"><p class="small"><b>📅 원산지 점검은 연중 수시로 있어요.</b> 명절·김장철 등 시기마다 집중 점검이 있으니 표시판을 미리 붙여 두세요.</p></div>';
  var src = s.src ? RULES.sources.filter(function (x) { return x.id === s.src; })[0] : null;
  return '<div class="card season" id="season"><p><b>📅 ' + esc(s.title) + '</b></p><p class="small">' + esc(s.text) + '</p>' +
    (s.fact ? '<p class="small muted">' + esc(s.fact) + (src ? ' <a href="' + esc(src.url) + '" target="_blank" rel="noopener">출처<span class="sr"> (새 창)</span></a>' : '') + '</p>' : '') + '</div>';
}

/* ---------- 라우터 ---------- */
var routes = {};
function go(h) { if (location.hash === h) render(); else location.hash = h; }
function render(soft) {
  var h = location.hash.replace(/^#/, '') || '/';
  var parts = h.split('/').filter(Boolean), name = parts[0] || 'home', arg = decodeURIComponent(parts[1] || '');
  if (!routes[name]) name = 'home';
  /* 화면마다 새 main 요소(이전 화면의 이벤트 위임이 남지 않게) */
  var old = $('#view'), view = old.cloneNode(false); old.parentNode.replaceChild(view, old);
  routes[name](view, arg);
  var tab = { menus: 'menus', type: 'menus', menu: 'menus', origin: 'menus', result: 'menus', out: 'out', check: 'check', ledger: 'ledger' }[name];
  $$('#tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var hd = $('h1', view) || $('h2', view);
  if (render.navigated && !soft) { if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  render.navigated = true;
  document.title = R.pageTitle(hd ? hd.textContent : '', APP);
}
render.navigated = false;
window.__pageTitle = function (h) { return R.pageTitle(h, APP); };
/* ---------- 홈 ---------- */
function progressInfo() {
  var ms = menus(), os = origins(), used = R.usedTargets(ms, RULES);
  var done = used.filter(function (t) { return R.itemValid(t, os, RULES).errors.length === 0; }).length;
  return { menus: ms.length, used: used.length, done: done };
}
routes.home = function (v) {
  var pi = progressInfo(), s = shop();
  var started = pi.menus > 0;
  v.innerHTML = '<section class="card hero"><p class="kicker">음식점 원산지 표시 셀프 체크 · 무료</p><h1>원산지 한 장</h1>' +
    '<p class="headline">원산지 표시, 종이 한 장으로 끝</p>' +
    '<p>메뉴만 고르면 표시 대상 재료를 골라 주고, <b>A3 원산지 표시판</b>·메뉴판·배달앱 문구까지 한 번에 만들어요.</p>' +
    '<ol class="steps"><li><b>1</b>업종·메뉴</li><li><b>2</b>재료 원산지</li><li><b>3</b>표시판 인쇄</li></ol></section>' +
    seasonHtml() +
    (started ? '<section class="card"><h2>' + esc(s.name || '우리 가게') + ' 현황</h2><p>메뉴 <b>' + pi.menus + '개</b> · 표시 대상 재료 <b>' + pi.done + '/' + pi.used + '</b> 입력</p>' +
      '<div class="prog" aria-hidden="true"><i style="width:' + (pi.used ? Math.round(pi.done / pi.used * 100) : 0) + '%"></i></div>' +
      '<div class="grid2"><a class="btn" href="#/result">결과 보기</a><a class="btn" href="#/out/board">표시판 인쇄</a><a class="btn" href="#/check">셀프 점검</a><a class="btn" href="#/ledger">영수증 장부</a></div></section>' : '') +
    '<div class="sticky-cta"><a class="btn pri block" id="start" href="' + (started ? '#/menus' : '#/type') + '">' + (started ? '내 메뉴 고치기' : '시작하기 — 업종 고르기') + '</a></div>' +
    '<section class="card"><h2>이런 걸 대신 챙겨요</h2><ul class="bul">' +
    '<li>떡볶이 쌀떡·열무김치·황태처럼 <b>표시 대상이 아닌 경우</b>를 구분</li><li>국내산 쇠고기는 <b>한우·육우·젖소</b>까지</li><li>배추김치는 <b>배추·고춧가루 각각</b></li><li>섞어 쓰면 <b>비율 높은 순 "섞음"</b> 문구</li><li>축산물 영수증 <b>6개월 보관</b> 만료일 계산</li></ul></section>' +
    '<p class="privacy small muted">🔒 입력한 내용은 이 기기 브라우저에만 저장돼요. 서버로 보내지 않고 로그인도 없어요.</p>' + discHtml();
};

/* ---------- 업종 ---------- */
routes.type = function (v) {
  var s = shop();
  v.innerHTML = stepper(1, 4) + '<h1>업종 고르기</h1><p class="muted">업종에 따라 표시 방법이 조금 달라요.</p>' +
    '<form id="tf"><fieldset><legend class="sr">업종</legend><div class="opts">' + TYPES.map(function (t) {
      return '<label class="opt"><input type="radio" name="type" value="' + t[0] + '"' + (s.type === t[0] ? ' checked' : '') + '><span><b>' + t[1] + '</b><small>' + t[2] + '</small></span></label>';
    }).join('') + '</div></fieldset>' +
    '<label class="f" for="shopname">가게 이름 <span class="muted small">(선택 · 포장 스티커에 들어가요)</span></label><input type="text" id="shopname" maxlength="30" autocomplete="organization" value="' + esc(s.name) + '">' +
    '<p class="small muted" id="tnote"></p>' +
    '<div class="sticky-cta"><button class="btn pri block" type="submit">다음: 메뉴 고르기</button></div></form>';
  function note() {
    var t = ($('input[name=type]:checked', v) || {}).value;
    $('#tnote', v).textContent = t === 'catering' ? '급식소는 식당·취식장소에 월간 메뉴표·메뉴판·게시판·푯말 등으로 표시해요. 미성년자 대상 급식소는 원산지 적힌 주간·월간 메뉴표를 가정통신문이나 홈페이지에도 알려야 해요. 표시판은 게시용으로 쓸 수 있어요.' : t ? '일반·휴게음식점은 기준에 맞는 원산지 표시판을 붙이면 메뉴판·게시판의 원산지 표시를 생략할 수 있어요.' : '';
  }
  v.addEventListener('change', note); note();
  $('#tf', v).addEventListener('submit', function (e) {
    e.preventDefault();
    var t = ($('input[name=type]:checked', v) || {}).value;
    if (!t) { toast('업종을 골라 주세요.'); $('input[name=type]', v).focus(); return; }
    var s2 = shop(); s2.type = t; s2.name = $('#shopname', v).value.trim().slice(0, 30); save(K.shop, s2);
    go('#/menus');
  });
};

/* ---------- 메뉴 고르기 ---------- */
function presetIngs(p) { return p.ings.map(function (g) { var r = { item: g.item }; if (g.use) r.use = g.use; return r; }); }
function ingSummary(m) {
  var mt = R.menuTargets(m, RULES);
  var on = mt.targets.map(function (t) { return R.itemById(RULES, t.item).name; });
  var off = mt.exempt.map(function (x) { return R.itemById(RULES, x.item).name; });
  return (on.length ? '<span class="tag on">표시: ' + esc(on.join('·')) + '</span>' : '<span class="tag">표시 대상 재료 없음</span>') +
    (off.length ? ' <span class="tag off">제외: ' + esc(off.join('·')) + '</span>' : '') + (mt.needUse.length ? ' <span class="tag warn">쓰임새 선택 필요</span>' : '');
}
routes.menus = function (v) {
  var ms = menus(), q = '';
  function has(name) { return ms.some(function (m) { return m.name === name; }); }
  v.innerHTML = stepper(2, 4) + '<h1>메뉴 고르기</h1><p class="muted">파는 메뉴를 누르면 표시 대상 재료가 자동으로 들어가요. 재료는 나중에 고칠 수 있어요.</p>' +
    '<label class="f" for="q">메뉴 찾기</label><input type="search" id="q" placeholder="예: 김치찌개, 회, 국수" autocomplete="off">' +
    '<div class="presets" id="presets"></div>' +
    '<details class="card" id="custom"><summary>목록에 없는 메뉴 직접 넣기</summary><form id="cf"><label class="f" for="cname">메뉴 이름</label><input type="text" id="cname" maxlength="30">' +
    '<button class="btn block" type="submit" style="margin-top:10px">메뉴 추가 후 재료 고르기</button></form></details>' +
    '<h2 id="mine-h">내 메뉴 <span class="count">' + ms.length + '</span></h2><ul class="mlist" id="mine"></ul>' +
    '<div class="sticky-cta"><a class="btn pri block" id="next" href="#/origin">다음: 재료 원산지</a></div>';
  function drawPresets() {
    var list = RULES.menuPresets.filter(function (p) { return !q || p.name.indexOf(q) >= 0 || p.cat.indexOf(q) >= 0; });
    $('#presets', v).innerHTML = list.length ? list.map(function (p) {
      var on = has(p.name);
      return '<button type="button" class="pre" data-name="' + esc(p.name) + '" aria-pressed="' + on + '"><span aria-hidden="true">' + p.emoji + '</span>' + esc(p.name) + (on ? '<span class="sr"> (선택됨)</span>' : '') + '</button>';
    }).join('') : '<p class="muted">찾는 메뉴가 없어요. 아래 "직접 넣기"를 써 주세요.</p>';
  }
  function drawMine() {
    $('#mine', v).innerHTML = ms.length ? ms.map(function (m) {
      return '<li><div class="mn"><b>' + esc(m.name) + '</b><div class="tags">' + ingSummary(m) + '</div></div><div class="row"><a class="btn sm" href="#/menu/' + encodeURIComponent(m.id) + '">재료 고치기<span class="sr"> — ' + esc(m.name) + '</span></a>' +
        '<button type="button" class="iconbtn" data-del="' + esc(m.id) + '" aria-label="' + esc(m.name) + ' 빼기">✕</button></div></li>';
    }).join('') : '<li class="muted empty">아직 고른 메뉴가 없어요.</li>';
    $('#mine-h .count', v).textContent = ms.length;
    $('#next', v).classList.toggle('dis', !ms.length);
  }
  function persist() { save(K.menus, ms); drawPresets(); drawMine(); }
  $('#q', v).addEventListener('input', function (e) { q = e.target.value.trim(); drawPresets(); });
  $('#presets', v).addEventListener('click', function (e) {
    var b = e.target.closest('.pre'); if (!b) return;
    var name = b.getAttribute('data-name');
    if (has(name)) ms = ms.filter(function (m) { return m.name !== name; });
    else { var p = RULES.menuPresets.filter(function (x) { return x.name === name; })[0]; ms.push({ id: uid('m'), name: p.name, ings: presetIngs(p) }); }
    persist();
    var nb = $('.pre[data-name="' + name.replace(/"/g, '\\"') + '"]', v); if (nb) nb.focus();
  });
  $('#mine', v).addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var id = b.getAttribute('data-del'); ms = ms.filter(function (m) { return m.id !== id; }); persist(); toast('메뉴를 뺐어요.');
  });
  $('#cf', v).addEventListener('submit', function (e) {
    e.preventDefault();
    var n = $('#cname', v).value.trim().slice(0, 30);
    if (!n) { toast('메뉴 이름을 적어 주세요.'); $('#cname', v).focus(); return; }
    if (has(n)) { toast('이미 있는 메뉴예요.'); return; }
    var m = { id: uid('m'), name: n, ings: [] }; ms.push(m); save(K.menus, ms); go('#/menu/' + encodeURIComponent(m.id));
  });
  $('#next', v).addEventListener('click', function (e) { if (!ms.length) { e.preventDefault(); toast('메뉴를 1개 이상 골라 주세요.'); } });
  drawPresets(); drawMine();
};

/* ---------- 메뉴 재료 고치기 ---------- */
function itemOptions(sel) {
  var h = '<option value="">재료 고르기</option>';
  ['livestock', 'agri', 'sea'].forEach(function (c) {
    h += '<optgroup label="' + CAT[c] + '">' + RULES.items.filter(function (i) { return i.cat === c; }).map(function (i) {
      return '<option value="' + i.id + '"' + (sel === i.id ? ' selected' : '') + '>' + esc(i.name + (i.alias ? ' (' + i.alias + ')' : '')) + '</option>';
    }).join('') + '</optgroup>';
  });
  return h;
}
routes.menu = function (v, id) {
  var ms = menus(), m = ms.filter(function (x) { return x.id === id; })[0];
  if (!m) { v.innerHTML = '<h1>메뉴를 찾을 수 없어요</h1><a class="btn block" href="#/menus">메뉴 목록으로</a>'; return; }
  var ings = clone(m.ings);
  v.innerHTML = '<h1>' + esc(m.name) + ' 재료</h1><p class="muted">표시 대상 29품목 중 이 메뉴에 들어가는 재료를 골라요. 쌀·콩·김치·명태는 쓰임새에 따라 대상이 달라요.</p>' +
    '<label class="f" for="mname">메뉴 이름</label><input type="text" id="mname" maxlength="30" value="' + esc(m.name) + '">' +
    '<ul class="ings" id="ings"></ul><button type="button" class="btn block" id="adding">+ 재료 추가</button>' +
    '<div class="sticky-cta"><button type="button" class="btn pri block" id="savem">저장하고 메뉴 목록으로</button></div>';
  function draw() {
    $('#ings', v).innerHTML = ings.length ? ings.map(function (g, i) {
      var it = R.itemById(RULES, g.item), a = g.item ? R.applies(g, RULES) : null;
      return '<li class="card ing"><label class="f" for="it' + i + '">재료 ' + (i + 1) + '</label><select id="it' + i + '" data-i="' + i + '" data-k="item">' + itemOptions(g.item) + '</select>' +
        (it && it.uses ? '<label class="f" for="us' + i + '">쓰임새</label><select id="us' + i + '" data-i="' + i + '" data-k="use"><option value="">쓰임새 고르기</option>' + it.uses.map(function (u) { return '<option value="' + u[0] + '"' + (g.use === u[0] ? ' selected' : '') + '>' + esc(u[1]) + '</option>'; }).join('') + '</select>' : '') +
        (a ? '<p class="small ' + (a.applies ? 'ok' : 'muted') + '" role="status">' + (a.applies ? '✓ ' : '— ') + esc(a.reason) + '</p>' + (a.unsure ? '<p class="small warn">⚠ ' + esc(a.unsure) + '</p>' : '') : '') +
        '<button type="button" class="btn ghost sm" data-rm="' + i + '">이 재료 빼기</button></li>';
    }).join('') : '<li class="muted empty">재료가 없어요. 표시 대상 재료가 없으면 비워 둬도 돼요.</li>';
  }
  v.addEventListener('change', function (e) {
    var t = e.target, i = t.getAttribute('data-i'); if (i == null) return;
    var k = t.getAttribute('data-k'); ings[i][k] = t.value; if (k === 'item') delete ings[i].use;
    var it2 = R.itemById(RULES, ings[i].item), fid = k === 'item' && it2 && it2.uses ? 'us' + i : t.id;
    draw(); var n = $('#' + fid, v); if (n) n.focus();
  });
  v.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (b) { ings.splice(+b.getAttribute('data-rm'), 1); draw(); $('#adding', v).focus(); }
  });
  $('#adding', v).addEventListener('click', function () { ings.push({ item: '' }); draw(); $('#it' + (ings.length - 1), v).focus(); });
  $('#savem', v).addEventListener('click', function () {
    var n = $('#mname', v).value.trim().slice(0, 30);
    if (!n) { toast('메뉴 이름을 적어 주세요.'); $('#mname', v).focus(); return; }
    var bad = ings.filter(function (g) { return g.item && R.itemById(RULES, g.item).uses && !g.use; });
    if (bad.length) { toast('쓰임새를 골라 주세요.'); var j = ings.indexOf(bad[0]); $('#us' + j, v).focus(); return; }
    m.name = n; m.ings = ings.filter(function (g) { return g.item; });
    save(K.menus, ms); toast('저장했어요.'); go('#/menus');
  });
  draw();
};
/* ---------- 재료 원산지 ---------- */
function countryOptions(val, other) {
  var inList = RULES.countries.indexOf(val) >= 0;
  return '<option value="">국가 고르기</option>' + RULES.countries.map(function (c) { return '<option value="' + c + '"' + (val === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
    '<option value="__other"' + ((other || (val && !inList)) ? ' selected' : '') + '>목록에 없음 (직접 입력)</option>';
}
function fid(path, f, x) { return 'f-' + path.replace(/\./g, '_') + '-' + f + (x != null ? '-' + x : ''); }
function chips(path, f, list, cur, legend) {
  return '<fieldset class="fs"><legend>' + legend + '</legend><div class="chips">' + list.map(function (o, i) {
    return '<label class="chip"><input type="radio" id="' + fid(path, f, i) + '" name="' + fid(path, f) + '" data-path="' + path + '" data-f="' + f + '" value="' + o[0] + '"' + (cur === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>';
  }).join('') + '</div></fieldset>';
}
function countryField(path, f, o, label) {
  var other = o._other || (o[f] && RULES.countries.indexOf(o[f]) < 0);
  return '<label class="f" for="' + fid(path, f) + '">' + label + '</label><select id="' + fid(path, f) + '" data-path="' + path + '" data-f="' + f + '" data-country="1">' + countryOptions(o[f], o._other) + '</select>' +
    (other ? '<label class="f" for="' + fid(path, f + 'Text') + '">국가 이름 직접 입력</label><input type="text" maxlength="20" id="' + fid(path, f + 'Text') + '" data-path="' + path + '" data-f="' + f + '" data-text="1" value="' + esc(o[f] || '') + '" placeholder="예: 우루과이">' : '');
}
function oEditor(path, o, item, isPart) {
  o = o || {};
  var types = [['domestic', '국내산'], ['import', '수입']];
  if (item.cat === 'sea') types.push(['distant', '원양산']);
  if (!isPart) { types.push(['mixed', '섞어 씀']); types.push(['foreign', '"외국산" 가공품']); }
  var h = chips(path, 'type', types, o.type, isPart ? '원산지' : '원산지 고르기');
  if (o.type === 'domestic') {
    if (item.beefKind) h += chips(path, 'beefKind', R.KINDS.map(function (k) { return [k, k]; }), o.beefKind, '식육 종류 <b class="req">꼭 골라요</b>');
    if (item.cat === 'sea' && !isPart) h += chips(path, 'label', [['', '국내산'], ['연근해산', '연근해산']], o.label || '', '표기');
    if (item.raiseMonths && !isPart) {
      h += '<label class="cb"><input type="checkbox" id="' + fid(path, 'raisedHere') + '" data-path="' + path + '" data-f="raisedHere"' + (o.raisedHere ? ' checked' : '') + '><span>수입한 ' + item.animal + '를 국내에서 ' + item.raiseMonths + '개월 이상 키웠어요 <small>(출생국을 함께 적어요)</small></span></label>';
      if (o.raisedHere) h += countryField(path, 'bornIn', o, '출생 국가');
    }
  } else if (o.type === 'import') h += countryField(path, 'country', o, '수입 국가 (통관 원산지)');
  else if (o.type === 'distant') h += '<label class="f" for="' + fid(path, 'sea') + '">해역 <span class="muted small">(선택 · 예: 태평양)</span></label><input type="text" maxlength="20" id="' + fid(path, 'sea') + '" data-path="' + path + '" data-f="sea" data-text="1" value="' + esc(o.sea || '') + '">';
  else if (o.type === 'foreign') h += '<p class="small muted">국내에서 가공한 재료의 원료 원산지가 자주 바뀌어 포장재에 "외국산"으로 적혀 있을 때만 써요. (예: 피자(햄(돼지고기: 외국산)))</p>';
  else if (o.type === 'mixed') {
    var ps = o.parts || [], sum = 0;
    h += '<p class="small muted">섞은 원산지와 대략의 비율을 넣으면 <b>비율 높은 순서</b>로 "섞음" 문구를 만들어요.</p><ol class="parts">';
    ps.forEach(function (p, i) {
      sum += Number(p.pct) || 0;
      h += '<li class="part"><p class="ph">' + (i + 1) + '번째 원산지</p>' + oEditor(path + '.parts.' + i, p, item, true) +
        '<label class="f" for="' + fid(path + '.parts.' + i, 'pct') + '">섞는 비율(%)</label><input type="number" inputmode="numeric" min="1" max="99" id="' + fid(path + '.parts.' + i, 'pct') + '" data-path="' + path + '.parts.' + i + '" data-f="pct" data-text="1" value="' + esc(p.pct == null ? '' : p.pct) + '">' +
        (ps.length > 2 ? '<button type="button" class="btn ghost sm" data-rmpart="' + path + '" data-i="' + i + '">이 원산지 빼기</button>' : '') + '</li>';
    });
    h += '</ol><p class="small" data-sum="' + path + '">비율 합계 ' + sum + '%</p>' + (ps.length < 5 ? '<button type="button" class="btn sm" data-addpart="' + path + '">+ 원산지 추가</button>' : '');
  }
  return h;
}
var D = null;
function getAt(path, create) {
  var segs = path.split('.'), o = D;
  for (var i = 0; i < segs.length; i++) {
    var k = segs[i];
    if (o[k] == null) { if (!create) return null; o[k] = {}; }
    o = o[k];
  }
  return o;
}
function cardHtml(t, saved) {
  var item = R.itemById(RULES, t.item), o = D[t.item] || {};
  var v = R.itemValid(t, D, RULES), ok = v.errors.length === 0, ph = R.itemPhrase(t, D, RULES, prefs(), false);
  var h = '<section class="card oc' + (ok ? ' done' : '') + '" id="oc-' + t.item + '" aria-labelledby="h-' + t.item + '"><h2 id="h-' + t.item + '"><span aria-hidden="true">' + emo(t.item) + '</span> ' + esc(item.name) +
    (item.alias ? ' <small>(' + esc(item.alias) + ')</small>' : '') + '<span class="st ' + (ok ? 'ok' : 'todo') + '">' + (ok ? '✓ 완료' : '입력 필요') + '</span></h2>' +
    '<p class="small muted">' + esc(t.menus.join(' · ')) + '</p>';
  if (item.kimchi) {
    var needChili = R.kimchiNeedsChili(t.uses);
    h += chips(t.item, 'method', [['direct', '직접 담금'], ['import', '수입 완제품']], o.method, '배추김치를 어떻게 쓰나요?');
    if (o.method === 'direct') {
      h += '<div class="sub"><h3>배추 <small>(절인 배추 포함)</small></h3>' + oEditor(t.item + '.cabbage', o.cabbage, { cat: 'agri', name: '배추' }) + '</div>';
      if (needChili) h += '<div class="sub"><h3>고춧가루</h3>' + oEditor(t.item + '.chili', o.chili, { cat: 'agri', name: '고춧가루' }) + '</div>';
      else h += '<p class="small muted">백김치만 써서 고춧가루 표시는 빼요.</p>';
    } else if (o.method === 'import') h += countryField(t.item, 'country', o, '제조·가공한 국가');
  } else h += oEditor(t.item, o, item, false);
  h += '<p class="preview" id="pv-' + t.item + '" aria-live="polite">' + (ph ? '표시 문구 → <b>' + esc(ph) + '</b>' : '표시 문구가 여기에 보여요') + '</p>' +
    '<ul class="errs" id="er-' + t.item + '">' + v.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + v.warnings.map(function (x) { return '<li class="w">' + esc(x) + '</li>'; }).join('') + '</ul></section>';
  return h;
}
routes.origin = function (v, focusItem) {
  var ms = menus(), used = R.usedTargets(ms, RULES), p = prefs();
  var dr = load(K.draft, null);
  D = dr && typeof dr === 'object' && !Array.isArray(dr) ? dr : clone(origins());
  if (!used.length) { v.innerHTML = stepper(3, 4) + '<h1>재료 원산지</h1><div class="card info"><p>고른 메뉴에 표시 대상 재료가 없어요.</p><a class="btn block" href="#/menus">메뉴 고르기로</a></div>'; return; }
  v.innerHTML = stepper(3, 4) + '<h1>재료 원산지</h1>' + (p.setupDone ? '<div class="card info"><p class="small"><b>변경 모드</b> — 바뀐 재료만 고치고 저장하면 <b>변경 기록</b>에 남고, 표시판·문구가 자동으로 바뀌어요.</p></div>' : '<p class="muted">거래명세서·포장지에 적힌 원산지대로 골라 주세요.</p>') +
    '<div class="progwrap"><p class="small" id="progt"></p><div class="prog" role="progressbar" aria-label="원산지 입력 진행" aria-valuemin="0" aria-valuemax="' + used.length + '" id="progb"><i></i></div></div>' +
    '<div id="errsum"></div><div id="cards">' + used.map(function (t) { return cardHtml(t); }).join('') + '</div>' +
    '<div class="sticky-cta"><button type="button" class="btn pri block" id="saveo">저장하고 결과 보기</button></div>';
  function prog() {
    var done = used.filter(function (t) { return R.itemValid(t, D, RULES).errors.length === 0; }).length;
    $('#progt', v).textContent = '원산지 입력 ' + done + ' / ' + used.length;
    var b = $('#progb', v); b.setAttribute('aria-valuenow', done); b.firstChild.style.width = Math.round(done / used.length * 100) + '%';
  }
  function tOf(id) { return used.filter(function (t) { return t.item === id; })[0]; }
  function redraw(itemId, focusId) {
    var c = $('#oc-' + itemId, v); if (!c) return;
    var tmp = document.createElement('div'); tmp.innerHTML = cardHtml(tOf(itemId)); c.parentNode.replaceChild(tmp.firstChild, c);
    if (focusId) { var f = document.getElementById(focusId); if (f) f.focus(); }
    prog(); save(K.draft, D);
  }
  function light(itemId) {
    var t = tOf(itemId), vv = R.itemValid(t, D, RULES), ph = R.itemPhrase(t, D, RULES, prefs(), false);
    $('#pv-' + itemId, v).innerHTML = ph ? '표시 문구 → <b>' + esc(ph) + '</b>' : '표시 문구가 여기에 보여요';
    $('#er-' + itemId, v).innerHTML = vv.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + vv.warnings.map(function (x) { return '<li class="w">' + esc(x) + '</li>'; }).join('');
    var c = $('#oc-' + itemId, v), ok = vv.errors.length === 0; c.classList.toggle('done', ok);
    var st = $('.st', c); st.className = 'st ' + (ok ? 'ok' : 'todo'); st.textContent = ok ? '✓ 완료' : '입력 필요';
    $$('[data-sum]', c).forEach(function (s) { var o = getAt(s.getAttribute('data-sum')); s.textContent = '비율 합계 ' + (o.parts || []).reduce(function (a, p) { return a + (Number(p.pct) || 0); }, 0) + '%'; });
    prog(); save(K.draft, D);
  }
  v.addEventListener('change', function (e) {
    var t = e.target, path = t.getAttribute('data-path'), f = t.getAttribute('data-f');
    if (!path || t.getAttribute('data-text')) return;
    var root = path.split('.')[0], o = getAt(path, true);
    if (f === 'type') {
      var keep = o.pct; Object.keys(o).forEach(function (k) { delete o[k]; }); o.type = t.value; if (keep != null) o.pct = keep;
      if (t.value === 'mixed') o.parts = [{ type: 'domestic', pct: '' }, { type: 'import', pct: '' }];
    } else if (f === 'method') { Object.keys(o).forEach(function (k) { delete o[k]; }); o.method = t.value; }
    else if (f === 'raisedHere') { if (t.checked) o.raisedHere = true; else { delete o.raisedHere; delete o.bornIn; delete o._other; } }
    else if (t.getAttribute('data-country')) { if (t.value === '__other') { o._other = true; o[f] = ''; } else { delete o._other; o[f] = t.value; } }
    else if (f === 'label') { if (t.value) o.label = t.value; else delete o.label; }
    else o[f] = t.value;
    redraw(root, t.id);
  });
  v.addEventListener('input', function (e) {
    var t = e.target, path = t.getAttribute('data-path'); if (!path || !t.getAttribute('data-text')) return;
    var o = getAt(path, true), f = t.getAttribute('data-f');
    o[f] = f === 'pct' ? (t.value === '' ? '' : Number(t.value)) : t.value.slice(0, 20);
    light(path.split('.')[0]);
  });
  v.addEventListener('click', function (e) {
    var a = e.target.closest('[data-addpart]'), r = e.target.closest('[data-rmpart]');
    if (a) { var o = getAt(a.getAttribute('data-addpart')); o.parts.push({ type: 'import', pct: '' }); redraw(a.getAttribute('data-addpart').split('.')[0]); var ins = $$('#oc-' + a.getAttribute('data-addpart').split('.')[0] + ' .part', v); if (ins.length) $('input', ins[ins.length - 1]).focus(); }
    if (r) { var o2 = getAt(r.getAttribute('data-rmpart')); o2.parts.splice(+r.getAttribute('data-i'), 1); redraw(r.getAttribute('data-rmpart').split('.')[0]); }
    var j = e.target.closest('[data-jump]'); if (j) { var c = $('#oc-' + j.getAttribute('data-jump'), v); if (c) { c.scrollIntoView({ block: 'start' }); var fi = $('input,select', c); if (fi) fi.focus(); } }
  });
  $('#saveo', v).addEventListener('click', function () {
    var errs = [];
    used.forEach(function (t) { R.itemValid(t, D, RULES).errors.forEach(function (x) { errs.push([t.item, x]); }); });
    if (errs.length) {
      $('#errsum', v).innerHTML = '<div class="card alert" role="alert" tabindex="-1" id="errbox"><h2>아직 고를 게 ' + errs.length + '개 있어요</h2><ul class="jl">' + errs.map(function (x) { return '<li><button type="button" class="linkbtn" data-jump="' + x[0] + '">' + esc(x[1]) + '</button></li>'; }).join('') + '</ul></div>';
      $('#errbox', v).focus(); window.scrollTo(0, 0); return;
    }
    commitOrigins(used);
    go('#/result');
  });
  prog();
  if (focusItem && $('#oc-' + focusItem, v)) setTimeout(function () { var c = $('#oc-' + focusItem); if (!c) return; c.scrollIntoView({ block: 'start' }); $('h2', c).setAttribute('tabindex', '-1'); $('h2', c).focus({ preventScroll: true }); }, 0);
};
function commitOrigins(used) {
  var before = origins(), after = R.cleanOrigins(D, RULES), p = prefs(), pr = prefs(), hist = history(), today = todayKST(), changed = [];
  if (p.setupDone) used.forEach(function (t) {
    var b = R.itemPhrase(t, before, RULES, pr, false), a = R.itemPhrase(t, after, RULES, pr, false);
    if (b && a && b !== a) { hist.push({ date: today, itemId: t.item, before: b, after: a }); changed.push(R.itemById(RULES, t.item).name); }
  });
  var merged = origins(); Object.keys(after).forEach(function (k) { merged[k] = after[k]; });
  save(K.origins, merged);
  try { localStorage.removeItem(K.draft); } catch (e) {}
  if (changed.length) { save(K.history, hist.slice(-300)); p.pendingFix = { date: today, items: changed, done: {} }; toast('변경 기록에 ' + changed.length + '건 남겼어요. 표시판·배달앱도 고쳐 주세요.'); }
  else toast('저장했어요.');
  p.setupDone = true; save(K.prefs, p);
}
/* ---------- 결과 ---------- */
function fixBanner() {
  var p = prefs(), f = p.pendingFix; if (!f) return '';
  var L = [['board', '원산지 표시판 다시 인쇄'], ['menu', '메뉴판·게시판 문구'], ['delivery', '배달앱 메뉴 원산지'], ['pack', '포장 스티커·영수증 문구'], ['fridge', '냉장고 라벨']];
  return '<section class="card alert no-print" id="fix"><h2>배달앱 고치셨나요?</h2><p class="small">' + fmtD(f.date) + ' 원산지가 바뀌었어요: <b>' + esc(f.items.join(', ')) + '</b>. 아래 문구는 이미 자동으로 바뀌었으니, 붙여 둔 곳도 같이 고쳐 주세요.</p><ul class="chk">' +
    L.map(function (x) { return '<li class="fx"><label><input type="checkbox" data-fix="' + x[0] + '"' + (f.done && f.done[x[0]] ? ' checked' : '') + '><span>' + x[1] + '</span></label><a class="btn sm" href="#/out/' + x[0] + '">보기<span class="sr"> — ' + x[1] + '</span></a></li>'; }).join('') +
    '</ul><button type="button" class="btn ghost sm" id="fixdone">다 고쳤어요 (알림 닫기)</button></section>';
}
function bindFix(v) {
  v.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-fix'); if (!k) return;
    var p = prefs(); if (!p.pendingFix) return; p.pendingFix.done = p.pendingFix.done || {}; p.pendingFix.done[k] = e.target.checked;
    var all = ['board', 'menu', 'delivery', 'pack', 'fridge'].every(function (x) { return p.pendingFix.done[x]; });
    if (all) { delete p.pendingFix; save(K.prefs, p); toast('모두 고쳤어요. 알림을 닫았어요.'); render(true); } else save(K.prefs, p);
  });
  v.addEventListener('click', function (e) { if (e.target.id === 'fixdone') { var p = prefs(); delete p.pendingFix; save(K.prefs, p); render(true); } });
}
routes.result = function (v) {
  var st = fullState(), ms = st.menus, used = R.usedTargets(ms, RULES), os = st.origins;
  var missing = used.filter(function (t) { return R.itemValid(t, os, RULES).errors.length; });
  var exempt = [], unsure = [];
  ms.forEach(function (m) { var mt = R.menuTargets(m, RULES); mt.exempt.forEach(function (x) { exempt.push([m.name, x]); }); mt.unsure.forEach(function (x) { unsure.push([m.name, x]); }); });
  var hasSea = used.some(function (t) { return R.itemById(RULES, t.item).cat === 'sea'; });
  var b = R.boardModel(st, RULES);
  v.innerHTML = stepper(4, 4) + '<h1>결과</h1>' + fixBanner() +
    '<p>메뉴 <b>' + ms.length + '개</b> · 표시 대상 재료 <b>' + used.length + '개</b></p>' +
    (missing.length ? '<section class="card alert"><h2>원산지 입력이 ' + missing.length + '개 남았어요</h2><ul>' + missing.map(function (t) { return '<li>' + esc(R.itemById(RULES, t.item).name) + ' — <a href="#/origin/' + t.item + '">입력하기</a></li>'; }).join('') + '</ul></section>' :
      (used.length ? '<section class="card okbox"><p><b>✓ 모든 표시 대상 재료의 원산지를 입력했어요.</b></p></section>' : '')) +
    (shop().type === 'catering' ? '<section class="card info"><p class="small">급식소는 월간 메뉴표·메뉴판·게시판·푯말 등으로 표시해요. 미성년자 대상이면 원산지 적힌 주간·월간 메뉴표를 가정통신문·홈페이지에도 알려 주세요.</p></section>' : '') +
    '<section class="card"><h2>메뉴판 문구 미리보기</h2><ul class="lines" id="lines">' + ms.map(function (m) { var l = R.menuLine(m, os, RULES, st.prefs); return '<li>' + (l ? esc(l) : esc(m.name) + ' <span class="muted small">— 표시 대상 재료 없음</span>') + '</li>'; }).join('') + '</ul></section>' +
    (exempt.length ? '<section class="card info" id="exempt"><h2>표시 대상이 아니라서 뺐어요</h2><ul>' + exempt.map(function (x) { return '<li><b>' + esc(x[0]) + '</b> · ' + esc(R.itemById(RULES, x[1].item).name) + ': ' + esc(x[1].reason) + '</li>'; }).join('') + '</ul><p class="small muted">손님이 헷갈리지 않게 자율로 적어도 돼요(표시 기준은 지켜야 해요).</p></section>' : '') +
    (unsure.length ? '<section class="card warnbox"><h2>확인 필요</h2><ul>' + unsure.map(function (x) { return '<li><b>' + esc(x[0]) + '</b>: ' + esc(x[1].reason) + '</li>'; }).join('') + '</ul><p class="small">농관원 ' + hotline().tel + ' 또는 관할 기관에 확인해 주세요.</p></section>' : '') +
    (hasSea ? '<section class="card info"><p class="small">🐟 ' + esc(RULES.liveSeafoodNote) + '</p></section>' : '') +
    '<section class="card" id="bulkbox"><h2>모든 메뉴에 같은 원산지면 한 줄로</h2><p class="small muted">표시판·메뉴판에서 해당 재료를 메뉴마다 쓰지 않고 맨 위에 한 번만 적어요.</p><ul class="chk">' +
    used.map(function (t) {
      var can = R.canBulk(t, os, RULES), ph = can ? R.bulkPhrase(t, os, RULES, st.prefs) : '';
      return '<li><label><input type="checkbox" data-bulk="' + t.item + '"' + (can ? '' : ' disabled') + (can && st.prefs.bulk[t.item] ? ' checked' : '') + '><span>' + (can ? esc(ph) : esc(R.itemById(RULES, t.item).name) + ' <small class="muted">— 섞어 쓰거나 입력 전이라 한 줄 표시는 못 해요</small>') + '</span></label></li>';
    }).join('') + '</ul></section>' +
    '<div class="row gap"><a class="btn grow" href="#/origin">원산지 바뀜 (변경)</a><a class="btn grow" href="#/menus">메뉴 고치기</a></div>' +
    '<div class="sticky-cta"><a class="btn pri block" id="toboard" href="#/out/board">표시판 미리보기 (' + (b.entries.length + b.bulk.length) + '줄)</a></div>' + discHtml();
  v.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-bulk'); if (!k) return;
    var p = prefs(); if (e.target.checked) p.bulk[k] = true; else delete p.bulk[k]; save(K.prefs, p);
    var st2 = fullState(); $('#lines', v).innerHTML = st2.menus.map(function (m) { var l = R.menuLine(m, st2.origins, RULES, st2.prefs, p.bulk); return '<li>' + (l ? esc(l) : esc(m.name) + ' <span class="muted small">— 공통 표시로 묶음</span>') + '</li>'; }).join('');
  });
  bindFix(v);
};

/* ---------- 출력 ---------- */
var OUTS = [['board', '표시판'], ['menu', '메뉴판'], ['delivery', '배달앱'], ['pack', '포장'], ['fridge', '냉장고']];
var MM = 96 / 25.4;
function sheetHtml(blocks) {
  return '<div class="paper"><div class="sheet"><div class="b-title">' + esc(RULES.format.title) + '</div>' + blocks.join('') + '</div></div>';
}
function blockHtml(x, kind) {
  if (kind === 'bulk') return '<div class="blk"><p class="o-line">' + esc(x.text) + '</p></div>';
  var head = x.head.role === 'name' ? '<p class="n-line">' + esc(x.head.text) + '</p>' : '<p class="o-line">' + esc(x.head.text) + '</p>' + (x.head.sub ? '<p class="n-line en">' + esc(x.head.sub) + '</p>' : '');
  return '<div class="blk">' + head + x.lines.map(function (l) { return (l.role === 'name' ? '<p class="n-line">' : '<p class="o-line">') + esc(l.text) + '</p>' + (l.sub ? '<p class="n-line en">' + esc(l.sub) + '</p>' : ''); }).join('') + '</div>';
}
/* 실제 mm 크기로 재서 A3 여러 장으로 나눔 */
function paginate(model) {
  var f = RULES.format, innerH = (f.paperMm[1] - 2 * f.marginMm) * MM;
  var blocks = model.bulk.map(function (x) { return blockHtml(x, 'bulk'); }).concat(model.entries.map(function (x) { return blockHtml(x); }));
  var m = document.createElement('div'); m.className = 'measure'; m.setAttribute('aria-hidden', 'true');
  m.innerHTML = '<div class="sheet"><div class="b-title">' + esc(f.title) + '</div>' + blocks.join('') + '</div>';
  document.body.appendChild(m);
  var titleH = $('.b-title', m).getBoundingClientRect().height + 8 * MM;
  var hs = $$('.blk', m).map(function (b) { return b.getBoundingClientRect().height + 6 * MM; });
  document.body.removeChild(m);
  var pages = [[]], used = titleH, over = false;
  hs.forEach(function (hh, i) {
    if (used + hh > innerH && pages[pages.length - 1].length) { pages.push([]); used = titleH; }
    if (titleH + hh > innerH) over = true;
    pages[pages.length - 1].push(blocks[i]); used += hh;
  });
  return { pages: pages, over: over };
}
function fitPreview(v) {
  var w = $('#pv', v); if (!w || !document.body.contains(w)) return;
  var avail = w.clientWidth, pw = RULES.format.paperMm[0] * MM, ph = RULES.format.paperMm[1] * MM, s = Math.min(1, avail / pw);
  $$('.pv-frame', w).forEach(function (fr) { fr.style.height = Math.ceil(ph * s) + 'px'; var p = $('.paper', fr); p.style.transform = 'scale(' + s + ')'; });
}
function specCheck(v) {
  var f = RULES.format, sh = $('.sheet', v); if (!sh) return [];
  var o = $('.o-line', v), n = $('.n-line', v), t = $('.b-title', v);
  var px = function (el) { return el ? parseFloat(getComputedStyle(el).fontSize) : 0; };
  var pt = function (el) { return Math.round(px(el) * 0.75 * 10) / 10; };
  return [
    ['제목 "원산지 표시판"', t && t.textContent === '원산지 표시판'],
    ['크기 ' + f.paperMm[0] / 10 + '×' + f.paperMm[1] / 10 + 'cm (기준 29×42cm 이상)', f.paperMm[0] >= f.minMm[0] && f.paperMm[1] >= f.minMm[1]],
    ['원산지 글자 ' + (o ? pt(o) : '—') + 'pt (기준 60pt 이상)', !o || pt(o) >= f.originPt],
    ['음식명 글자 ' + (n ? pt(n) : '—') + 'pt (기준 30pt 이상)', !n || pt(n) >= f.namePt],
    ['흰 바탕에 검은 글자 (명암비 21:1)', getComputedStyle(sh).color === 'rgb(0, 0, 0)']
  ];
}
routes.out = function (v, tab) {
  if (!OUTS.some(function (x) { return x[0] === tab; })) tab = 'board';
  var st = fullState(), used = R.usedTargets(st.menus, RULES);
  var missing = used.filter(function (t) { return R.itemValid(t, st.origins, RULES).errors.length; });
  var nav = '<nav class="otabs no-print" aria-label="출력 종류">' + OUTS.map(function (x) { return '<a href="#/out/' + x[0] + '"' + (x[0] === tab ? ' aria-current="page"' : '') + '>' + x[1] + '</a>'; }).join('') + '</nav>';
  var head = '<h1 class="no-print">' + { board: 'A3 원산지 표시판', menu: '메뉴판·게시판 문구', delivery: '배달앱 문구', pack: '포장·영수증 문구', fridge: '냉장고 라벨' }[tab] + '</h1>';
  if (!used.length) { v.innerHTML = nav + head + '<div class="card info"><p>아직 표시할 메뉴·재료가 없어요.</p><a class="btn block" href="#/type">업종·메뉴부터 고르기</a></div>' + discHtml(); return; }
  var warn = missing.length ? '<div class="card alert no-print"><p><b>원산지 입력이 ' + missing.length + '개 남았어요.</b> 빈 재료는 문구에서 빠져요. <a href="#/origin">입력하기</a></p></div>' : '';
  if (tab === 'board') {
    var model = R.boardModel(st, RULES), pg = paginate(model);
    v.innerHTML = nav + head + fixBanner() + warn +
      '<div class="no-print"><fieldset class="fs"><legend>표시판 배치</legend><div class="chips">' +
      '<label class="chip"><input type="radio" name="layout" value="byMenu"' + (st.prefs.layout !== 'byItem' ? ' checked' : '') + '><span>메뉴별</span></label>' +
      '<label class="chip"><input type="radio" name="layout" value="byItem"' + (st.prefs.layout === 'byItem' ? ' checked' : '') + '><span>재료별 (짧게)</span></label></div></fieldset>' +
      '<div class="spec" id="spec"></div>' +
      (pg.pages.length > 1 ? '<p class="small warn">표시판이 A3 <b>' + pg.pages.length + '장</b>이에요. 결과 화면의 "한 줄로" 공통 표시나 재료별 배치를 쓰면 줄어요.</p>' : '<p class="small muted">A3 한 장에 들어가요.</p>') +
      (pg.over ? '<p class="small warn">한 메뉴의 문구가 너무 길어 한 장을 넘어요. 재료별 배치를 써 주세요.</p>' : '') + '</div>' +
      '<div id="pv" class="pv" role="region" aria-label="A3 원산지 표시판 미리보기 ' + pg.pages.length + '장">' + pg.pages.map(function (p) { return '<div class="pv-frame">' + sheetHtml(p) + '</div>'; }).join('') + '</div>' +
      '<div class="no-print"><p class="small muted">인쇄 설정: 용지 <b>A3</b>, 배율 <b>100%(실제 크기)</b>, 여백 기본. A3 프린터가 없으면 PDF로 저장해 인쇄소·편의점에서 A3로 뽑아요. 가장 큰 게시판 옆이나 아래(없으면 출입구 들어와 정면)에 붙여요.</p>' +
      '<div class="sticky-cta"><button type="button" class="btn pri block" id="print">A3로 인쇄 · PDF 저장</button></div>' + discHtml() + '</div>';
    fitPreview(v);
    var sc = specCheck(v), allOk = sc.every(function (x) { return x[1]; });
    $('#spec', v).innerHTML = '<p class="badge-spec ' + (allOk ? 'ok' : 'bad') + '" id="specbadge">' + (allOk ? '✓ 규격 충족' : '⚠ 규격 확인 필요') + '</p><ul class="speclist">' + sc.map(function (x) { return '<li>' + (x[1] ? '✓ ' : '✗ ') + esc(x[0]) + '</li>'; }).join('') + '</ul>';
    var onResize = function () { if (!document.body.contains(v)) { window.removeEventListener('resize', onResize); return; } fitPreview(v); };
    window.addEventListener('resize', onResize);
    v.addEventListener('change', function (e) { if (e.target.name === 'layout') { setPref('layout', e.target.value); render(true); var r = $('input[name=layout][value=' + e.target.value + ']'); if (r) r.focus(); } });
    $('#print', v).addEventListener('click', function () { window.print(); });
    bindFix(v);
    return;
  }
  var o = R.outputs(st, RULES), text = o[tab];
  var help = {
    menu: '메뉴판·게시판의 음식명 바로 옆이나 밑에 적어요. 원산지 글자는 음식명 글자와 같거나 더 크게 써요. "한 줄로" 공통 표시를 고르면 맨 위에 한 번만 적어요.',
    delivery: '배달앱 사장님 화면의 메뉴 설명·원산지 칸에 붙여넣어요. 앱마다 칸 이름이 달라요. 배달 음식은 포장재(어려우면 스티커·전단·영수증)에도 표시해요.',
    pack: '배달·포장 스티커나 영수증 하단에 넣는 짧은 문구예요.',
    fridge: '냉장고·보관 용기 앞면에 붙이는 라벨이에요. 거래명세서로 원산지를 확인할 수 있으면 생략할 수 있어요.'
  }[tab];
  v.innerHTML = nav + head + fixBanner() + warn + '<p class="muted">' + help + '</p>' +
    '<pre class="out" id="out-text" tabindex="0" aria-label="복사할 문구">' + esc(text) + '</pre>' +
    '<div class="sticky-cta"><button type="button" class="btn pri block" id="copy">' + { menu: '메뉴판 문구', delivery: '배달앱 문구', pack: '포장 문구', fridge: '냉장고 라벨' }[tab] + ' 복사</button></div>' + discHtml();
  $('#copy', v).addEventListener('click', function () { copyText(text, { menu: '메뉴판 문구', delivery: '배달앱 문구', pack: '포장 문구', fridge: '냉장고 라벨' }[tab]); });
  bindFix(v);
};
/* ---------- 셀프 점검 ---------- */
function fineById(id) { return RULES.fines.filter(function (f) { return f.id === id; })[0]; }
function fineText(f) { return f.amounts ? f.amounts.map(function (a, i) { return (i + 1 === f.amounts.length ? (i + 1) + '차 이상 ' : (i + 1) + '차 ') + a + f.unit; }).join(' · ') : f.text; }
routes.check = function (v) {
  var ans = checks(), used = R.usedTargets(menus(), RULES);
  var hasBeef = used.some(function (t) { return t.item === 'beef'; }), hasKimchi = used.some(function (t) { return t.item === 'kimchi'; });
  v.innerHTML = '<h1>셀프 점검</h1><p class="muted">10문항에 답하면 신호등으로 보여 줘요. 답은 이 기기에 저장돼요.</p>' +
    '<section class="card light" id="light" aria-live="polite"></section>' +
    '<ol class="qs">' + RULES.checklist.map(function (c, i) {
      var hint = c.id === 'q3' && !hasBeef ? '쇠고기 메뉴가 없으면 "해당 없음"' : c.id === 'q4' && !hasKimchi ? '배추김치가 없으면 "해당 없음"' : '';
      var opts = [['yes', '예'], ['no', '아니요']]; if (c.na) opts.push(['na', '해당 없음']);
      return '<li class="card q" id="' + c.id + '"><fieldset><legend><span class="qn">' + (i + 1) + '.</span> ' + esc(c.q) + '</legend>' + (hint ? '<p class="small muted">' + hint + '</p>' : '') +
        '<div class="chips">' + opts.map(function (o) { return '<label class="chip ' + o[0] + '"><input type="radio" name="' + c.id + '" value="' + o[0] + '"' + (ans[c.id] === o[0] ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div></fieldset>' +
        '<div class="fine" id="fine-' + c.id + '"' + (ans[c.id] === 'no' ? '' : ' hidden') + '><p class="small"><b>과태료 예시</b> (영업소·집단급식소, 위반 횟수별)</p><ul class="small">' +
        c.fines.map(function (fid2) { var f = fineById(fid2); return '<li>' + esc(f.label) + ': ' + esc(fineText(f)) + '</li>'; }).join('') + '</ul>' +
        '<p class="small muted">출처: <a href="' + esc(RULES.finesSource.url) + '" target="_blank" rel="noopener">' + esc(RULES.finesSource.label) + '<span class="sr"> (새 창)</span></a> · <b>최신 법령 확인</b> 필요 (이후 개정될 수 있어요). 거짓 표시는 과태료가 아니라 형사처벌 대상이에요.</p></div></li>';
    }).join('') + '</ol>' +
    '<div class="row gap"><button type="button" class="btn ghost grow" id="creset">답 지우기</button><a class="btn grow" href="#/sources">근거·출처 보기</a></div>' + discHtml();
  function draw() {
    var a = checks(), tl = R.trafficLight(a, RULES.checklist);
    $('#light', v).className = 'card light ' + tl.color;
    $('#light', v).innerHTML = '<div class="tl" aria-hidden="true"><i class="r"></i><i class="y"></i><i class="g"></i></div><div><p class="tl-l"><b>' + esc(tl.label) + '</b></p><p class="small">아니요 ' + tl.no.length + '개 · 안 답한 문항 ' + tl.unanswered + '개' + (a.checkedAt ? ' · 마지막 점검 ' + esc(a.checkedAt) : '') + '</p></div>';
  }
  v.addEventListener('change', function (e) {
    var t = e.target; if (!/^q\d+$/.test(t.name)) return;
    var a = checks(); a[t.name] = t.value; a.checkedAt = fmtD(todayKST()); save(K.checks, a);
    $('#fine-' + t.name, v).hidden = t.value !== 'no'; draw();
  });
  $('#creset', v).addEventListener('click', function () { confirmBox('답을 지울까요?', '셀프 점검 답 10개를 모두 지워요.', '지우기', function () { save(K.checks, {}); render(true); toast('답을 지웠어요.'); }, true); });
  draw();
};

/* ---------- 장부 (영수증 · 변경 기록) ---------- */
routes.ledger = function (v) {
  var today = todayKST(), rc = RULES.receipt, os = origins();
  var list = receipts().map(function (r) { var s = R.receiptStatus(r.date, today, rc.months, rc.warnDays); r.s = s; return r; }).sort(function (a, b) { return a.s.expiresAt < b.s.expiresAt ? -1 : 1; });
  var soon = list.filter(function (r) { return r.s.status === 'soon'; }).length, done = list.filter(function (r) { return r.s.status === 'done'; }).length;
  var itemOpts = RULES.items.filter(function (i) { return i.cat !== 'sea'; }).map(function (i) { return [i.name, i.name + (rc.required.indexOf(i.id) >= 0 ? ' (보관 필수)' : '')]; });
  itemOpts.push(['수산물', '수산물']); itemOpts.push(['기타', '기타']);
  var hist = history().slice().reverse();
  v.innerHTML = '<h1>장부</h1><p class="muted">축산물(쇠·돼지·닭·오리·양·염소고기) 원산지가 적힌 영수증·거래명세서는 <b>매입일부터 6개월</b> 보관해요. 여기엔 날짜·품목·원산지·공급처만 적어요(사진·금액은 저장 안 해요).</p>' +
    '<section class="card"><h2>영수증 장부 <span class="count">' + list.length + '</span></h2>' +
    '<p class="sumline">' + (soon ? '<span class="tag warn">만료 임박 ' + soon + '건</span> ' : '') + (done ? '<span class="tag off">보관 기간 끝 ' + done + '건</span>' : '') + (!soon && !done ? '<span class="tag on">임박 없음</span>' : '') + '</p>' +
    '<form id="rf" class="rf" novalidate><label class="f" for="rdate">매입일</label><input type="date" id="rdate" value="' + today + '" max="' + today + '" required>' +
    '<label class="f" for="ritem">품목</label><select id="ritem">' + itemOpts.map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[1]) + '</option>'; }).join('') + '</select>' +
    '<label class="f" for="rorigin">원산지</label><input type="text" id="rorigin" maxlength="60" placeholder="예: 국내산 한우">' +
    '<label class="f" for="rsup">공급처</label><input type="text" id="rsup" maxlength="40" placeholder="예: ○○축산">' +
    '<p class="small" id="rexp" aria-live="polite"></p><button class="btn pri block" type="submit">장부에 추가</button></form>' +
    '<ul class="rlist" id="rlist">' + (list.length ? list.map(function (r) {
      return '<li class="rc ' + r.s.status + '"><div><b>' + esc(r.item) + '</b> · ' + esc(r.origin || '원산지 미기재') + '<br><span class="small muted">매입 ' + fmtD(r.date) + ' · ' + esc(r.supplier || '공급처 미기재') + '</span><br><span class="small">보관 만료일 <b>' + fmtD(r.s.expiresAt) + '</b></span></div>' +
        '<div class="rside"><span class="tag ' + (r.s.status === 'keep' ? 'on' : r.s.status === 'soon' ? 'warn' : 'off') + '">' + esc(r.s.label) + '</span><button type="button" class="iconbtn" data-rdel="' + esc(r.id) + '" aria-label="' + esc(fmtD(r.date) + ' ' + r.item + ' 기록 지우기') + '">✕</button></div></li>';
    }).join('') : '<li class="muted empty">아직 기록이 없어요.</li>') + '</ul>' +
    (done ? '<button type="button" class="btn ghost block" id="rclean">보관 기간 끝난 ' + done + '건 지우기</button>' : '') + '</section>' +
    '<section class="card" id="hist"><h2>원산지 변경 기록 <span class="count">' + hist.length + '</span></h2>' +
    (hist.length ? '<ul class="hlist">' + hist.map(function (h) { var it = R.itemById(RULES, h.itemId); return '<li><span class="small muted">' + fmtD(h.date) + '</span> <b>' + esc(it ? it.name : h.itemId) + '</b><br><s>' + esc(h.before) + '</s> → <b>' + esc(h.after) + '</b></li>'; }).join('') + '</ul>' : '<p class="muted">원산지를 바꾸면 날짜와 함께 여기에 남아요.</p>') +
    '<a class="btn block" href="#/origin">원산지 바뀜 (변경하기)</a></section>' + discHtml();
  function expHint() {
    var d = $('#rdate', v).value; if (!R.isDate(d)) { $('#rexp', v).textContent = ''; return; }
    var s = R.receiptStatus(d, today, rc.months, rc.warnDays);
    $('#rexp', v).innerHTML = '보관 만료일 <b>' + fmtD(s.expiresAt) + '</b> (매입일 + 6개월, 이날까지 보관)';
  }
  function fillOrigin() {
    var name = $('#ritem', v).value, it = RULES.items.filter(function (i) { return i.name === name; })[0];
    if (it && os[it.id] && !it.kimchi) $('#rorigin', v).value = R.basePhrase(os[it.id], it, prefs());
  }
  $('#rdate', v).addEventListener('input', expHint); $('#ritem', v).addEventListener('change', fillOrigin);
  $('#rf', v).addEventListener('submit', function (e) {
    e.preventDefault();
    var d = $('#rdate', v).value;
    if (!R.isDate(d)) { toast('매입일을 골라 주세요.'); $('#rdate', v).focus(); return; }
    if (d > today) { toast('매입일은 오늘 이전이어야 해요.'); $('#rdate', v).focus(); return; }
    var all = receipts();
    all.push({ id: uid('r'), date: d, item: $('#ritem', v).value, origin: $('#rorigin', v).value.trim().slice(0, 60), supplier: $('#rsup', v).value.trim().slice(0, 40), expiresAt: R.receiptExpiry(d, rc.months) });
    save(K.receipts, all); toast('장부에 추가했어요. 보관 만료일 ' + fmtD(R.receiptExpiry(d, rc.months))); render(true); var h2 = $('#rlist'); if (h2) h2.scrollIntoView({ block: 'nearest' });
  });
  v.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rdel]');
    if (b) { var id = b.getAttribute('data-rdel'); confirmBox('기록을 지울까요?', '이 영수증 기록 1건을 장부에서 지워요. (실제 영수증은 6개월 보관해야 해요)', '지우기', function () { save(K.receipts, receipts().filter(function (r) { return r.id !== id; })); render(true); toast('지웠어요.'); }, true); }
    if (e.target.id === 'rclean') confirmBox('끝난 기록을 지울까요?', '보관 기간(6개월)이 끝난 기록 ' + done + '건을 지워요.', '지우기', function () { save(K.receipts, receipts().filter(function (r) { return R.receiptStatus(r.date, today, rc.months, rc.warnDays).status !== 'done'; })); render(true); toast('지웠어요.'); }, true);
  });
  fillOrigin(); expHint();
};

/* ---------- 설정 ---------- */
routes.settings = function (v) {
  var s = shop(), p = prefs();
  v.innerHTML = '<h1>설정</h1>' +
    '<section class="card"><h2>가게</h2><label class="f" for="sname">가게 이름</label><input type="text" id="sname" maxlength="30" value="' + esc(s.name) + '">' +
    '<label class="f" for="stype">업종</label><select id="stype"><option value="">고르기</option>' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (s.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
    '<label class="cb"><input type="checkbox" id="slang"' + (s.lang === 'ko+en' ? ' checked' : '') + '><span>표시판에 영어 함께 적기 <small>(한글 옆에 영문 추가 가능)</small></span></label>' +
    '<fieldset class="fs"><legend>국내산 표기</legend><div class="chips"><label class="chip"><input type="radio" name="dom" value="국내산"' + (p.domLabel !== '국산' ? ' checked' : '') + '><span>국내산</span></label><label class="chip"><input type="radio" name="dom" value="국산"' + (p.domLabel === '국산' ? ' checked' : '') + '><span>국산</span></label></div></fieldset>' +
    '<label class="cb"><input type="checkbox" id="sseason"' + (p.hideSeason ? '' : ' checked') + '><span>첫 화면에 점검 시즌 안내 보기 <small>(오늘 날짜로 자동 계산)</small></span></label></section>' +
    '<section class="card"><h2>백업·옮기기</h2><p class="small muted">메뉴·원산지·장부·점검 답을 JSON 파일 하나로 내보내고, 다른 기기에서 가져와요.</p>' +
    '<div class="grid2"><button type="button" class="btn" id="exp">JSON 내보내기</button><label class="btn" for="imp">JSON 가져오기</label></div><input type="file" id="imp" accept="application/json,.json" class="sr"></section>' +
    '<section class="card"><h2>초기화</h2><p class="small muted">이 기기에 저장된 원산지 한 장 기록을 모두 지워요. 먼저 내보내기를 권해요.</p><button type="button" class="btn danger block" id="reset">전체 초기화</button></section>' +
    '<p class="privacy small muted">🔒 모든 기록은 이 기기 브라우저(localStorage)에만 저장돼요. 서버·로그인·광고 추적이 없어요. 브라우저 기록을 지우면 함께 지워지니 가끔 내보내기 해 두세요.</p>' + discHtml();
  v.addEventListener('change', function (e) {
    var t = e.target, s2 = shop(), p2 = prefs();
    if (t.id === 'stype') { s2.type = t.value; save(K.shop, s2); toast('업종을 바꿨어요.'); }
    else if (t.id === 'slang') { s2.lang = t.checked ? 'ko+en' : 'ko'; save(K.shop, s2); toast(t.checked ? '표시판에 영어를 함께 적어요.' : '영어 병기를 껐어요.'); }
    else if (t.name === 'dom') { p2.domLabel = t.value; save(K.prefs, p2); toast('"' + t.value + '"으로 적어요.'); }
    else if (t.id === 'sseason') { p2.hideSeason = !t.checked; save(K.prefs, p2); }
    else if (t.id === 'imp' && t.files && t.files[0]) importFile(t.files[0], t);
  });
  $('#sname', v).addEventListener('change', function (e) { var s2 = shop(); s2.name = e.target.value.trim().slice(0, 30); save(K.shop, s2); toast('가게 이름을 저장했어요.'); });
  $('#exp', v).addEventListener('click', exportJson);
  $('#reset', v).addEventListener('click', function () {
    confirmBox('전체 초기화할까요?', '메뉴·원산지·변경 기록·영수증 장부·점검 답을 모두 지워요. 되돌릴 수 없어요.', '모두 지우기', function () {
      Object.keys(K).forEach(function (k) { try { localStorage.removeItem(K[k]); } catch (e) {} });
      toast('모두 지웠어요.'); go('#/');
    }, true);
  });
};
function exportJson() {
  var data = { app: 'origin-one-sheet', version: 1, exportedAt: new Date().toISOString(), shop: shop(), menus: menus(), origins: origins(), history: history(), receipts: receipts(), checks: checks(), prefs: prefs() };
  delete data.prefs.pendingFix;
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'origin-one-sheet-' + todayKST() + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  toast('JSON 파일로 내보냈어요.');
}
function importFile(file, input) {
  if (file.size > 2 * 1024 * 1024) { toast('파일이 너무 커요(2MB 이하).'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    var d;
    try { d = R.sanitizeImport(JSON.parse(String(rd.result)), RULES); } catch (e) { toast('가져오지 못했어요: ' + (e && e.message ? e.message : 'JSON 오류')); input.value = ''; return; }
    confirmBox('가져올까요?', '메뉴 ' + d.menus.length + '개, 원산지 ' + Object.keys(d.origins).length + '개, 영수증 ' + d.receipts.length + '건으로 지금 기록을 바꿔요.', '가져오기', function () {
      save(K.shop, d.shop); save(K.menus, d.menus); save(K.origins, d.origins); save(K.history, d.history); save(K.receipts, d.receipts); save(K.checks, d.checks); save(K.prefs, d.prefs);
      try { localStorage.removeItem(K.draft); } catch (e) {}
      toast('가져왔어요.'); go('#/result');
    });
    input.value = '';
  };
  rd.readAsText(file);
}

/* ---------- 근거·출처 ---------- */
routes.sources = function (v) {
  var hl = hotline();
  v.innerHTML = '<h1>근거·출처</h1><section class="card hotline"><p><b>문의·신고</b> — ' + esc(hl.org) + ' ' + esc(hl.label) + '</p><a class="btn pri block" href="' + hl.telHref + '">☎ ' + hl.tel + ' 전화하기</a><p class="small muted">수산물은 국립수산물품질관리원, 영업 신고·위생은 관할 시·군·구청에 확인하세요.</p></section>' +
    '<section class="card"><h2>법령·공식 자료</h2><ul class="src">' + RULES.sources.map(function (s) {
      return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '<span class="sr"> (새 창)</span></a><br><span class="small ' + (s.verified ? 'ok' : 'warn') + '">' + (s.verified ? '✓ 원문 확인 ' + esc(s.checked) : '확인 필요 · 내용 미확인 참고 링크') + (s.note ? ' · ' + esc(s.note) : '') + '</span></li>';
    }).join('') + '</ul></section>' +
    '<section class="card"><h2>표시 대상 29품목</h2><p class="small">' + ['livestock', 'agri', 'sea'].map(function (c) { return '<b>' + CAT[c] + '</b>: ' + RULES.items.filter(function (i) { return i.cat === c; }).map(function (i) { return esc(i.name + (i.rule ? '(' + i.rule.replace(/ 대상$/, '') + ')' : '')); }).join(', '); }).join('<br>') + '</p><p class="small muted">' + esc(RULES.liveSeafoodNote) + '</p></section>' +
    '<section class="card"><h2>과태료 기준 (영업소·집단급식소)</h2><table class="tbl"><caption class="sr">위반 유형별 과태료</caption><thead><tr><th scope="col">위반</th><th scope="col">금액</th></tr></thead><tbody>' +
    RULES.fines.map(function (f) { return '<tr><td>' + esc(f.label) + '</td><td>' + esc(fineText(f)) + '</td></tr>'; }).join('') + '</tbody></table>' +
    '<p class="small muted">' + esc(RULES.finesSource.label) + ' 기준. 최근 2년 같은 유형 위반 시 가중, 사정에 따라 2분의 1 범위 감경·가중. <b>최신 법령 확인</b>이 필요해요. 거짓·혼동 표시는 7년 이하 징역 또는 1억원 이하 벌금(형사처벌) 대상이에요.</p></section>' +
    '<section class="card warnbox"><h2>확인 필요 / 최신 법령 확인</h2><ul class="small"><li>과태료 별표는 2022.12.30. 개정본을 원문으로 확인했어요. 그 뒤 개정 여부는 국가법령정보센터에서 확인하세요.</li><li>코다리 등 반건조 명태가 "건조한 것(제외)"에 드는지는 법문에 없어요. 앱은 표시 대상으로 봐요.</li><li>영수증 6개월 보관은 축산물을 필수로, 나머지는 권장으로 안내해요.</li><li>배달앱(통신판매) 화면의 세부 표시 위치는 각 앱 안내와 시행규칙 별표 3을 확인하세요.</li><li>보관 만료일은 "매입일 + 6개월의 같은 날(없으면 그 달 말일)"로 계산해요. 넉넉히 보관하세요.</li></ul></section>' + discHtml();
};

/* ---------- 시작 ---------- */
function boot() {
  fetch('rules.json').then(function (r) { if (!r.ok) throw new Error('rules'); return r.json(); }).then(function (j) {
    RULES = j; window.__rules = j;
    window.addEventListener('hashchange', function () { render(); });
    render();
    if (flags.recovered) toast('저장된 기록 일부가 깨져 있어 비웠어요.');
  }).catch(function () {
    $('#view').innerHTML = '<h1>불러오지 못했어요</h1><p>규칙 파일을 읽지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p><button class="btn pri block" type="button" onclick="location.reload()">새로고침</button>';
  });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
}
window.__runSelfTest = function () { return R.selfTest(RULES); };
boot();
})();
