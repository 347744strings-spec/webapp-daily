/* 주문방패 app.js — UI (vanilla JS). 계산·규칙은 rules.js(JMBP) */
(function () {
  'use strict';
  var J = window.JMBP;
  var view = document.getElementById('view');
  var KEY = J.STORAGE_KEY;
  var state;
  var draft = { answers: {}, i: 0 };
  var justFinished = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- storage ----------
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return J.defaultState(); }
    if (!raw) return J.defaultState();
    try { return J.sanitizeState(JSON.parse(raw)); }
    catch (e) {
      try { localStorage.setItem(KEY + '.corrupt.' + Date.now(), raw); } catch (e2) { /* 저장 공간 부족 */ }
      var s = J.defaultState();
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e3) { /* noop */ }
      setTimeout(function () { toast('저장된 데이터가 손상돼 새로 시작했어요. 이전 데이터는 백업해 두었어요.', 4000); }, 300);
      return s;
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { toast('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.'); return false; }
  }

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function replace(h) { history.replaceState(null, '', h); route(); }
  function fmtDate(ts) { var d = new Date(ts); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? (+m[2]) + '월 ' + (+m[3]) + '일' : ''; }
  function won(n) { return J.comma(n) + '원'; }
  function getCheck(id) { for (var i = 0; i < state.checks.length; i++) if (state.checks[i].id === id) return state.checks[i]; return null; }
  function getLog(id) { for (var i = 0; i < state.log.length; i++) if (state.log[i].id === id) return state.log[i]; return null; }
  function topbar(title, back) {
    return '<header class="topbar">' + (back ? '<a class="icon-btn" href="' + back + '" aria-label="뒤로">‹</a>' : '') + '<h1>' + title + '</h1></header>';
  }
  function disclaimer() { return '<div class="disclaimer" role="note"><b>안내</b> ' + esc(J.DISCLAIMER) + '</div>'; }

  var toastTimer;
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }
  function confirmModal(title, body, okLabel, onOk, danger) {
    var root = document.getElementById('modal-root'), prev = document.activeElement;
    root.innerHTML = '<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle"><h2 id="mTitle">' + esc(title) + '</h2><p class="sub">' + esc(body) + '</p>' +
      '<div class="row2" style="margin-top:16px"><button class="btn btn-soft" data-m="0">취소</button><button class="btn ' + (danger ? 'btn-start' : 'btn-primary') + '" data-m="1">' + esc(okLabel) + '</button></div></div></div>';
    document.body.classList.add('locked');
    function close(ok) {
      root.innerHTML = ''; document.body.classList.remove('locked'); document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) try { prev.focus(); } catch (e) { /* noop */ }
      if (ok) onOk();
    }
    function onKey(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Tab') { var b = $$('button', root), f = b[0], l = b[b.length - 1]; if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); } else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); } }
    }
    document.addEventListener('keydown', onKey);
    root.querySelector('.modal-back').addEventListener('click', function (e) { if (e.target.classList.contains('modal-back')) close(false); });
    $('[data-m="0"]', root).onclick = function () { close(false); };
    $('[data-m="1"]', root).onclick = function () { close(true); };
    $('[data-m="0"]', root).focus();
  }
  // 클립보드: API → execCommand → 전체 선택 안내
  function copyText(text, ta) {
    function fallback() {
      var ok = false;
      if (ta) { ta.focus(); ta.select(); try { ta.setSelectionRange(0, ta.value.length); } catch (e) { /* noop */ } }
      try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; }
      if (ok) toast('복사됐어요');
      else { if (ta) { ta.focus(); ta.select(); } toast('글자를 모두 선택했어요. 길게 눌러 복사해 주세요.', 3500); }
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast('복사됐어요'); }, fallback);
    } else fallback();
  }
  function bindAmount(input, onChange) {
    input.addEventListener('input', function () {
      var v = J.parseAmount(input.value);
      var pos = input.value.length - input.selectionStart;
      input.value = v === null ? '' : J.comma(v);
      try { var p = Math.max(0, input.value.length - pos); input.setSelectionRange(p, p); } catch (e) { /* noop */ }
      onChange(v);
    });
  }
  function shareApp() {
    var text = J.shareText();
    if (navigator.share) {
      navigator.share({ title: '주문방패', text: text }).catch(function (e) { if (e && e.name !== 'AbortError') copyText(text); });
    } else copyText(text);
  }
  // ---------- S0 홈 ----------
  function startCheck() {
    draft = { answers: {}, i: 0 };
    if (!state.settings.onboarded) go('#/settings?next=check'); else go('#/check');
  }
  function renderHome() {
    var last = state.checks.length ? state.checks[state.checks.length - 1] : null;
    var h = '<header class="topbar"><div class="brand"><span class="logo" aria-hidden="true">🛡️</span>주문방패</div><a class="icon-btn" href="#/settings" aria-label="매장 설정">⚙️</a></header>';
    h += '<section class="hero"><span class="pill">무료 · 로그인 없음 · 기록은 내 기기에만</span>' +
      '<h1>단체 주문 전화,<br>끊기 전에 60초 점검</h1>' +
      '<p>질문 10개에 예/아니오로 답하면 위험 신호등과 지금 할 일, 바로 보낼 문자까지 알려드려요.</p>' +
      '<div class="stop2"><b class="t">이 요청이 나오면 멈추세요</b><ul><li>매장에서 안 파는 물건 대리구매·선결제</li><li>상대가 지정한 업체·계좌로 송금</li></ul>' +
      '<p class="cap" style="margin-top:6px">서울시 공고: 군은 납품업체에 대금 대납을 요구하지 않아요.</p></div>' +
      '<div class="stack"><button class="btn btn-start" data-act="start">📞 지금 단체 주문 전화 받았어요</button>' +
      '<a class="btn btn-line" href="#/learn">어떤 수법인지 먼저 보기</a></div></section>';
    h += '<section class="card"><h2>이렇게 진행돼요</h2><div class="steps3"><div><span aria-hidden="true">✅</span>질문 10개<br>예·아니오</div><div><span aria-hidden="true">🚦</span>신호등과<br>할 일 3가지</div><div><span aria-hidden="true">💬</span>문자 복사<br>바로 보내기</div></div></section>';
    if (last) {
      var info = J.levelInfo(J.evaluate(last.answers));
      h += '<section class="card"><h2>최근 점검</h2><a class="litem" style="box-shadow:none;border:1px solid var(--border)" href="#/result/' + esc(last.id) + '"><i class="dot ' + last.level + '" aria-hidden="true"></i><div class="m"><b>' + info.emoji + ' ' + esc(info.title) + '</b><span>' + fmtDate(last.createdAt) + (last.orderAmount ? ' · 주문 ' + won(last.orderAmount) : '') + '</span></div><span aria-hidden="true">›</span></a></section>';
    } else {
      h += '<section class="card"><h2>최근 점검</h2><p class="sub">아직 점검 기록이 없어요. 단체 주문 전화를 받으면 위의 빨간 버튼을 눌러 주세요.</p></section>';
    }
    h += '<section class="card"><h2>미리 해 두면 좋아요</h2><div class="stack">' +
      '<a class="btn btn-soft" href="#/verify">📞 공식 확인 번호 보기</a>' +
      '<a class="btn btn-soft" href="#/quiz">🎓 직원 교육 퀴즈 5문제</a>' +
      '<a class="btn btn-soft" href="#/poster">🖨️ 카운터 포스터 인쇄</a>' +
      '<button class="btn btn-soft" data-act="share">📣 옆 가게에도 알리기</button></div></section>';
    h += '<p class="foot">' + esc(J.DISCLAIMER) + '<br><a href="#/settings#privacy">개인정보 안내</a></p>';
    view.innerHTML = h;
    $('[data-act="start"]').onclick = startCheck;
    $('[data-act="share"]').onclick = shareApp;
  }

  // ---------- S1 매장 설정 ----------
  function renderSettings(q) {
    var s = state.settings, next = q.next === 'check';
    var h = topbar(next ? '매장 정보 (처음 한 번)' : '매장 설정', next ? '#/' : '#/');
    if (next) h += '<p class="sub">문자에 들어갈 정보예요. 지금 넣지 않아도 "저희 매장"으로 채워져요.</p>';
    h += '<form class="card" id="setForm" novalidate>' +
      '<div class="field"><label for="s-name">매장명</label><input class="input" id="s-name" maxlength="40" autocomplete="organization" placeholder="예: 광수반점" value="' + esc(s.storeName) + '"></div>' +
      '<div class="field"><label for="s-pct">예약금 비율 <span class="pctval num" id="pctVal">' + s.depositPct + '%</span></label><input type="range" id="s-pct" min="10" max="100" step="5" value="' + s.depositPct + '" aria-valuetext="' + s.depositPct + '퍼센트"><div class="help">주문 금액의 몇 %를 먼저 받을지 정해요. 기본 30%.</div></div>' +
      '<div class="field"><label for="s-acc">입금 계좌 문구</label><input class="input" id="s-acc" maxlength="80" placeholder="예: OO은행 000-0000-0000 (예금주 홍길동)" value="' + esc(s.accountText) + '"><div class="help">예약금 문자에 그대로 들어가요.</div></div>' +
      '<div class="field"><label for="s-sig">문자 서명</label><input class="input" id="s-sig" maxlength="40" placeholder="예: 광수반점 사장 이광수" value="' + esc(s.signature) + '"></div>' +
      '<div class="stack"><button class="btn btn-primary" type="submit">' + (next ? '저장하고 점검 시작' : '저장') + '</button>' +
      (next ? '<button class="btn btn-ghost" type="button" data-act="skip">건너뛰고 바로 점검</button>' : '') + '</div></form>';
    h += '<section class="card" id="privacy"><h2>개인정보 안내</h2><p>매장 정보, 점검 결과, 장부(손님 이름·전화번호 포함)는 <b>이 기기의 브라우저에만</b> 저장돼요. 서버로 보내거나 수집하지 않고, 로그인·광고 추적도 없어요.</p><p class="sub">공용 기기라면 사용 후 아래 [전체 삭제]를 눌러 주세요.</p></section>';
    if (!next) h += '<section class="card"><h2>데이터 관리</h2><p class="sub">점검 ' + state.checks.length + '건 · 장부 ' + state.log.length + '건이 저장돼 있어요.</p><div class="stack"><button class="btn btn-danger" data-act="wipe">전체 삭제</button></div></section>';
    view.innerHTML = h;
    var pct = $('#s-pct');
    pct.oninput = function () { $('#pctVal').textContent = pct.value + '%'; pct.setAttribute('aria-valuetext', pct.value + '퍼센트'); };
    $('#setForm').onsubmit = function (e) {
      e.preventDefault();
      state.settings.storeName = $('#s-name').value.trim().slice(0, 40);
      state.settings.depositPct = J.clampPct(pct.value);
      state.settings.accountText = $('#s-acc').value.trim().slice(0, 80);
      state.settings.signature = $('#s-sig').value.trim().slice(0, 40);
      state.settings.onboarded = true; save();
      if (next) { draft = { answers: {}, i: 0 }; replace('#/check'); } else toast('저장했어요');
    };
    if (next) $('[data-act="skip"]').onclick = function () { state.settings.onboarded = true; save(); draft = { answers: {}, i: 0 }; replace('#/check'); };
    var w = $('[data-act="wipe"]');
    if (w) w.onclick = function () {
      confirmModal('모든 데이터를 지울까요?', '매장 정보, 점검 기록, 장부, 퀴즈 기록이 이 기기에서 모두 지워지고 되돌릴 수 없어요.', '전체 삭제', function () {
        try { Object.keys(localStorage).forEach(function (k) { if (k === KEY || k.indexOf(KEY + '.') === 0) localStorage.removeItem(k); }); } catch (e) { /* noop */ }
        state = J.defaultState(); draft = { answers: {}, i: 0 }; toast('모두 지웠어요'); go('#/');
      }, true);
    };
    if (location.hash.indexOf('#privacy') > 0) { var p = $('#privacy'); if (p) p.scrollIntoView(); }
  }

  // ---------- S2 점검 ----------
  function renderCheck() {
    var i = Math.min(draft.i, J.QUESTIONS.length - 1), q = J.QUESTIONS[i], cur = draft.answers[q.id];
    var h = '<div class="checkwrap"><header class="topbar"><button class="icon-btn" data-act="prev" aria-label="' + (i ? '이전 문항' : '점검 그만두기') + '">‹</button><h1>60초 점검</h1></header>' +
      '<div class="progress" role="progressbar" aria-label="진행" aria-valuemin="1" aria-valuemax="10" aria-valuenow="' + (i + 1) + '"><i style="width:' + ((i + 1) * 10) + '%"></i></div>' +
      '<div class="qcount">' + (i + 1) + ' / ' + J.QUESTIONS.length + '</div>' +
      '<div class="qcard"><p class="qtxt" id="qtxt">' + q.html + '</p>' + (q.id === 'Q10' ? '<p class="qhint">아직 확인 전이라면 [아니오]를 누르세요.</p>' : q.critical ? '<p class="qhint">하나라도 [예]면 바로 결과로 넘어가요.</p>' : '') + '</div>' +
      '<div class="answers" role="group" aria-labelledby="qtxt"><div class="ab-row"><button class="btn ab ab-yes' + (cur === 'yes' ? ' sel' : '') + '" data-a="yes">예</button><button class="btn ab ab-no' + (cur === 'no' ? ' sel' : '') + '" data-a="no">아니오</button></div>' +
      '<button class="btn ab ab-unk' + (cur === 'unknown' ? ' sel' : '') + '" data-a="unknown">모름 · 아직 확인 못 함</button></div></div>';
    view.innerHTML = h;
    $$('[data-a]').forEach(function (b) { b.onclick = function () { answer(b.getAttribute('data-a')); }; });
    $('[data-act="prev"]').onclick = function () { if (draft.i > 0) { draft.i--; renderCheck(); } else go('#/'); };
  }
  function answer(a) {
    var q = J.QUESTIONS[draft.i];
    draft.answers[q.id] = a;
    var n = J.nextIndex(draft.i, q.id, a);
    if (n === -1) {
      if (J.shouldStop(q.id, a)) J.QUESTIONS.slice(draft.i + 1).forEach(function (qq) { delete draft.answers[qq.id]; });
      finishCheck();
    } else { draft.i = n; renderCheck(); var b = $('.ab-yes'); if (b) b.focus({ preventScroll: true }); }
  }
  function finishCheck() {
    var ev = J.evaluate(draft.answers), now = Date.now();
    var c = { id: J.newId('c', now), answers: JSON.parse(JSON.stringify(draft.answers)), score: ev.score, level: ev.level, critical: ev.critical, orderAmount: null, createdAt: now };
    state.checks.push(c);
    if (state.checks.length > 50) state.checks = state.checks.slice(-50);
    save(); draft = { answers: {}, i: 0 }; justFinished = c.id;
    replace('#/result/' + c.id);
  }

  // ---------- S3 결과 ----------
  function renderResult(id) {
    var c = getCheck(id);
    if (!c) { view.innerHTML = topbar('결과', '#/') + '<div class="card empty"><div class="big" aria-hidden="true">🔍</div><h2>점검 결과를 찾을 수 없어요</h2><p class="sub">지워졌거나 다른 기기에서 만든 결과예요.</p><div class="stack"><button class="btn btn-start" data-act="start">새로 점검하기</button></div></div>'; $('[data-act="start"]').onclick = startCheck; return; }
    var ev = J.evaluate(c.answers), info = J.levelInfo(ev), fresh = justFinished === id; justFinished = null;
    var lg = state.log.filter(function (e) { return e.checkId === id; })[0];
    var h = topbar('점검 결과', '#/');
    h += '<section class="light ' + ev.level + (fresh ? ' anim-in' : '') + '" aria-labelledby="lvTitle"><div class="lamp" aria-hidden="true"><i class="r"></i><i class="y"></i><i class="g"></i></div>' +
      '<div class="lvl">' + info.emoji + ' ' + info.name + ' 신호</div><h1 id="lvTitle" tabindex="-1">' + esc(info.title) + '</h1><p>' + esc(info.sub) + '</p>' +
      '<div class="bar" role="img" aria-label="위험 정도 ' + (ev.critical ? '최고' : ev.level === 'red' ? '높음' : ev.level === 'yellow' ? '보통' : '낮음') + '"><i style="width:' + Math.max(4, J.barPct(ev)) + '%"></i></div>' +
      '<div class="cap">' + fmtDate(c.createdAt) + ' 점검' + (Object.keys(c.answers).length < 10 && ev.critical ? ' · 결정적 신호로 남은 문항은 건너뛰었어요' : '') + '</div></section>';
    h += '<section class="card"><h2>지금 할 일 3가지</h2><ol class="todo">' + info.todo.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></section>';
    h += '<section class="card" id="signals"><h2>켜진 위험 신호 ' + ev.signals.length + '개</h2>';
    if (ev.signals.length) h += ev.signals.map(function (qid) { var q = J.QMAP[qid]; return '<div class="sig" data-sig="' + qid + '"><b>' + (q.critical ? '🔴 ' : '🟡 ') + esc(q.label) + '</b><span class="sub">' + esc(q.reason) + '</span></div>'; }).join('');
    else h += '<p class="sub">켜진 신호가 없어요.</p>';
    if (ev.verified) h += '<div class="sig"><b class="good">✓ 공식 대표번호로 확인함</b><span class="sub">' + (ev.verifyIgnored ? '확인 전화를 했더라도 대리구매·송금 요청은 정당해지지 않아 감점하지 않았어요.' : '확인한 만큼 위험도를 낮춰 계산했어요.') + '</span></div>';
    h += '</section>';
    if (ev.unknowns.length) h += '<section class="card" id="unknowns"><h2>확인 필요 ' + ev.unknowns.length + '개</h2><p class="sub">[모름]으로 답한 항목이에요. 점수에는 넣지 않았어요.</p><ul>' + ev.unknowns.map(function (qid) { return '<li data-unk="' + qid + '">' + esc(J.QMAP[qid].label) + '</li>'; }).join('') + '</ul></section>';
    h += '<section class="card"><h2>바로 보낼 문자</h2><div class="field"><label for="r-amt">주문 금액 (선택)</label><div class="input-wrap"><input class="input num" id="r-amt" inputmode="numeric" autocomplete="off" placeholder="예: 980,000" value="' + (c.orderAmount ? J.comma(c.orderAmount) : '') + '"><span class="unit">원</span></div>' +
      '<div class="depbox"><span>예약금 (' + state.settings.depositPct + '%)</span><b class="num" id="r-dep" aria-live="polite">' + depositLabel(c.orderAmount) + '</b></div><div class="help">금액을 넣으면 예약금이 천 원 단위로 계산돼 문자에 들어가요.</div></div>' +
      '<div class="stack">' + J.TEMPLATE_ORDER.map(function (t) { var tp = J.TEMPLATES[t]; return '<a class="btn ' + (t === info.primary ? 'btn-primary' : 'btn-line') + '" href="#/messages?type=' + t + '&check=' + encodeURIComponent(id) + '">' + tp.emoji + ' ' + esc(tp.name) + ' 문자</a>'; }).join('') + '</div></section>';
    h += '<section class="card"><div class="stack" style="margin-top:0"><a class="btn btn-soft" href="#/verify">📞 공식 번호로 확인하기</a>' +
      (lg ? '<a class="btn btn-soft" href="#/log/' + esc(lg.id) + '">📒 장부 기록 보기</a>' : '<a class="btn btn-soft" href="#/log/new?check=' + encodeURIComponent(id) + '">📒 이 주문 기록하기</a>') +
      '<button class="btn btn-soft" data-act="share">📣 옆 가게에도 알리기</button><button class="btn btn-ghost" data-act="again">다시 점검하기</button></div></section>';
    h += disclaimer();
    view.innerHTML = h;
    bindAmount($('#r-amt'), function (v) { c.orderAmount = v && v > 0 ? v : null; $('#r-dep').textContent = depositLabel(c.orderAmount); save(); });
    $('[data-act="share"]').onclick = shareApp;
    $('[data-act="again"]').onclick = function () { draft = { answers: {}, i: 0 }; go('#/check'); };
    if (fresh) {
      if (ev.level === 'red' && !reduceMotion && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate(200); } catch (e) { /* noop */ }
      var t = $('#lvTitle'); if (t) t.focus({ preventScroll: true });
    }
  }
  function depositLabel(amount) { var d = J.deposit(amount, state.settings.depositPct); return d === null ? '—' : won(d); }
  // ---------- S4 문자 ----------
  function renderMessages(q) {
    var type = J.TEMPLATES[q.type] ? q.type : 'deposit';
    var c = q.check ? getCheck(q.check) : null;
    var amount = c ? c.orderAmount : (msgAmount || null);
    var h = topbar('보낼 문자', c ? '#/result/' + encodeURIComponent(c.id) : '');
    h += '<div class="mtabs" role="tablist" aria-label="문자 종류">' + J.TEMPLATE_ORDER.map(function (t) {
      return '<button role="tab" id="tab-' + t + '" aria-controls="msgPanel" aria-selected="' + (t === type) + '" data-type="' + t + '" tabindex="' + (t === type ? 0 : -1) + '">' + J.TEMPLATES[t].emoji + '<br>' + esc(J.TEMPLATES[t].name) + '</button>';
    }).join('') + '</div>';
    h += '<section class="card" id="msgPanel" role="tabpanel" aria-labelledby="tab-' + type + '">';
    if (type === 'deposit') h += '<div class="field" style="margin-top:0"><label for="m-amt">주문 금액</label><div class="input-wrap"><input class="input num" id="m-amt" inputmode="numeric" autocomplete="off" placeholder="예: 980,000" value="' + (amount ? J.comma(amount) : '') + '"><span class="unit">원</span></div><div class="depbox"><span>예약금 (' + state.settings.depositPct + '%)</span><b class="num" id="m-dep" aria-live="polite">' + depositLabel(amount) + '</b></div></div>';
    h += '<div class="field"' + (type === 'deposit' ? '' : ' style="margin-top:0"') + '><label for="m-text">문자 내용 <span class="cap">(직접 고쳐도 돼요)</span></label><textarea class="input msg" id="m-text"></textarea><div id="m-missing"></div></div>' +
      '<div class="stack"><button class="btn btn-primary" data-act="copy">📋 복사하기</button><a class="btn btn-line" id="m-sms" href="#">📱 문자 앱으로 열기</a><button class="btn btn-ghost" data-act="reset">원래 문구로 되돌리기</button></div></section>';
    h += '<p class="sub" style="padding:0 4px">' + (type === 'refuse' ? '대리구매·대납 요청은 이 문자로 정중히 거절하면 충분해요. 길게 설명하지 않아도 돼요.' : type === 'verify' ? '확인은 명함·공문에 적힌 번호가 아니라 기관 공식 대표번호로 하세요. <a href="#/verify">공식 번호 보기</a>' : '예약금이 들어온 것을 확인한 뒤에 재료 준비를 시작하세요.') + '</p>';
    view.innerHTML = h;
    var ta = $('#m-text'), edited = false;
    function fill() {
      var vars = J.templateVars(state.settings, amount, J.todayStr());
      if (!edited) ta.value = J.fillTemplate(type, vars);
      var miss = J.missingFields(vars).filter(function (k) { return type === 'deposit' || k === 'storeName'; });
      var names = { storeName: '매장명', deposit: '주문 금액', accountText: '입금 계좌' };
      $('#m-missing').innerHTML = miss.length ? '<div class="missing">괄호 안 자리표시가 있어요: ' + miss.map(function (k) { return names[k]; }).join(', ') + '. ' + (miss.some(function (k) { return k !== 'deposit'; }) ? '<a href="#/settings">매장 설정에서 넣기</a>' : '') + '</div>' : '';
      sms();
    }
    function sms() { $('#m-sms').setAttribute('href', 'sms:?&body=' + encodeURIComponent(ta.value)); }
    ta.addEventListener('input', function () { edited = true; sms(); });
    var amt = $('#m-amt');
    if (amt) bindAmount(amt, function (v) { amount = v && v > 0 ? v : null; if (c) { c.orderAmount = amount; save(); } else msgAmount = amount; $('#m-dep').textContent = depositLabel(amount); edited = false; fill(); });
    $$('[role=tab]').forEach(function (b) {
      b.onclick = function () { history.replaceState(null, '', '#/messages?type=' + b.getAttribute('data-type') + (c ? '&check=' + encodeURIComponent(c.id) : '')); route(); var nb = $('#tab-' + b.getAttribute('data-type')); if (nb) nb.focus(); };
      b.onkeydown = function (e) { var i = J.TEMPLATE_ORDER.indexOf(b.getAttribute('data-type')); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = J.TEMPLATE_ORDER[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; $('#tab-' + n).click(); } };
    });
    $('[data-act="copy"]').onclick = function () { copyText(ta.value, ta); };
    $('[data-act="reset"]').onclick = function () { edited = false; fill(); toast('원래 문구로 되돌렸어요'); };
    fill();
  }
  var msgAmount = null;

  // ---------- S5 확인 방법 ----------
  function renderVerify() {
    var h = topbar('공식 번호로 확인하기', '');
    h += '<section class="card"><h2>확인 순서</h2>' +
      '<div class="vstep"><span class="n">1</span><div><b>명함·공문에 적힌 번호로 걸지 마세요</b><div class="sub">위조된 명함과 공문에는 상대가 받는 번호가 적혀 있을 수 있어요.</div></div></div>' +
      '<div class="vstep"><span class="n">2</span><div><b>기관 공식 홈페이지의 대표번호로 직접 걸어요</b><div class="sub">"○○ 소속 ○○○ 씨가 단체 주문을 했는데 맞나요?"라고 물어보면 돼요.</div></div></div>' +
      '<div class="vstep"><span class="n">3</span><div><b>확인 전에는 돈을 보내거나 준비를 시작하지 않아요</b><div class="sub">진짜 주문이라면 확인이 끝날 때까지 기다려 줘요.</div></div></div></section>';
    h += '<section class="card"><h2>군부대를 칭했다면</h2><p class="sub">서울시 공고에 안내된 번호예요. 친절하게 신분·공문서 진위를 확인해 준다고 안내돼 있어요.</p>' +
      J.CONTACTS.filter(function (x) { return x.id !== 'police'; }).map(telBtn).join('') + '</section>';
    h += '<section class="card"><h2>이미 돈을 보냈거나 피해가 의심되면</h2>' + telBtn(J.CONTACTS.filter(function (x) { return x.id === 'police'; })[0]) +
      '<p class="sub" style="margin-top:10px">송금한 은행에도 바로 알려 주세요.</p>' +
      '<a class="ext" href="' + J.LINKS.ecrm.url + '" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">📝</span>' + esc(J.LINKS.ecrm.name) + '<span class="a" aria-hidden="true">↗</span></a><p class="cap">' + esc(J.LINKS.ecrm.note) + '</p></section>';
    h += '<section class="card"><h2>번호·계좌 신고 이력 조회</h2><a class="ext" href="' + J.LINKS.cyber.url + '" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔎</span>' + esc(J.LINKS.cyber.name) + '<span class="a" aria-hidden="true">↗</span></a><p class="cap">' + esc(J.LINKS.cyber.note) + '</p></section>';
    h += '<p class="src">번호 출처: <a href="' + J.LINKS.seoul.url + '" target="_blank" rel="noopener noreferrer">' + esc(J.LINKS.seoul.name) + '</a> (' + J.CONTACTS_VERIFIED_ON + ' 확인). 번호는 바뀔 수 있으니 출처에서 한 번 더 확인해 주세요.</p>';
    h += disclaimer();
    view.innerHTML = h;
  }
  function telBtn(x) {
    return '<a class="tel' + (x.id === 'police' ? ' emg' : '') + '" href="tel:' + x.tel + '" data-tel="' + x.tel + '"><span class="ic" aria-hidden="true">' + (x.id === 'police' ? '🚨' : '📞') + '</span><span class="tx"><b>' + esc(x.name) + '</b><span>' + esc(x.note) + '</span></span><span class="no">' + esc(x.num) + '</span></a>';
  }

  // ---------- S6 배우기 ----------
  function renderLearn() {
    var h = topbar('배우기', '');
    h += '<p class="sub" style="padding:0 2px">실제 사례로 정리한 수법 3가지예요. 이런 말이 나오면 잠시 멈추고 확인하세요.</p>';
    h += J.TYPES.map(function (t) {
      return '<article class="card type" id="type-' + t.id + '"><h2><span aria-hidden="true">' + t.emoji + '</span> ' + esc(t.title) + '</h2><ol>' + t.flow.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol>' +
        '<div class="phr"><b>이런 말이 나오면 의심</b><ul>' + t.phrases.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="act">' + esc(t.action) + '</div><div class="src links">출처: ' + t.sources.map(function (s) { return '<a href="' + s.url + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + ' ↗</a>'; }).join('') + '</div></article>';
    }).join('');
    h += '<section class="card"><h2>매장 전체가 같은 기준으로</h2><div class="stack"><a class="btn btn-primary" href="#/quiz">🎓 직원 교육 퀴즈 5문제' + (state.quiz.bestScore != null ? ' · 최고 ' + state.quiz.bestScore + '점' : '') + '</a><a class="btn btn-line" href="#/poster">🖨️ 카운터 포스터 인쇄</a><button class="btn btn-soft" data-act="share">📣 옆 가게에도 알리기</button></div></section>';
    h += '<section class="card"><h2>더 읽어 보기</h2><div class="stack" style="margin-top:0"><a class="btn btn-ghost" href="military-impersonation-noshow/">군부대 사칭 노쇼 대처법 →</a><a class="btn btn-ghost" href="proxy-purchase-scam/">단체 주문 대리구매 사기 →</a><a class="btn btn-ghost" href="noshow-scam-prevention/">노쇼 사기 예방 체크리스트 →</a></div></section>';
    view.innerHTML = h;
    $('[data-act="share"]').onclick = shareApp;
  }

  // ---------- S8 퀴즈 ----------
  var quiz = null;
  function renderQuiz() {
    if (!quiz) quiz = { i: 0, score: 0, picked: null };
    var h = topbar('직원 교육 퀴즈', '#/learn');
    if (quiz.i >= J.QUIZ.length) {
      var best = state.quiz.bestScore;
      h += '<section class="card" style="text-align:center"><div class="scorebig num">' + quiz.score + ' / ' + J.QUIZ.length + '</div><h2>' + (quiz.score === J.QUIZ.length ? '모두 맞혔어요. 이 기준이면 충분해요.' : quiz.score >= 3 ? '잘했어요. 틀린 문항 해설만 다시 보세요.' : '기준 세 가지만 기억하세요.') + '</h2>' +
        '<p class="sub">대리구매·대납 거절 · 공식 대표번호 확인 · 예약금 먼저</p>' + (best != null ? '<p class="cap">최고 점수 ' + best + '점</p>' : '') +
        '<div class="stack"><button class="btn btn-primary" data-act="retry">다시 풀기</button><a class="btn btn-line" href="#/poster">카운터 포스터 인쇄</a></div></section>';
      view.innerHTML = h;
      $('[data-act="retry"]').onclick = function () { quiz = null; renderQuiz(); };
      return;
    }
    var it = J.QUIZ[quiz.i];
    h += '<div class="progress" role="progressbar" aria-label="퀴즈 진행" aria-valuemin="1" aria-valuemax="5" aria-valuenow="' + (quiz.i + 1) + '"><i style="width:' + ((quiz.i + 1) * 20) + '%"></i></div><div class="qcount">' + (quiz.i + 1) + ' / ' + J.QUIZ.length + '</div>';
    h += '<section class="card"><p style="font-size:19px;font-weight:700" id="qz">' + esc(it.q) + '</p><div role="group" aria-labelledby="qz">' + it.options.map(function (o, k) {
      var cls = quiz.picked == null ? '' : k === it.answer ? ' correct' : k === quiz.picked ? ' wrong' : '';
      return '<button class="opt' + cls + '" data-o="' + k + '"' + (quiz.picked != null ? ' disabled' : '') + '>' + (quiz.picked != null && k === it.answer ? '✓ ' : quiz.picked === k ? '✗ ' : '') + esc(o) + '</button>';
    }).join('') + '</div>';
    if (quiz.picked != null) h += '<div class="why" role="status"><b>' + (quiz.picked === it.answer ? '정답이에요.' : '정답은 ' + (it.answer + 1) + '번이에요.') + '</b> ' + esc(it.why) + '</div><div class="stack"><button class="btn btn-primary" data-act="next">' + (quiz.i + 1 < J.QUIZ.length ? '다음 문제' : '점수 보기') + '</button></div>';
    h += '</section>';
    view.innerHTML = h;
    $$('[data-o]').forEach(function (b) { b.onclick = function () { quiz.picked = +b.getAttribute('data-o'); if (quiz.picked === it.answer) quiz.score++; renderQuiz(); var n = $('[data-act="next"]'); if (n) n.focus(); }; });
    var nx = $('[data-act="next"]');
    if (nx) nx.onclick = function () {
      quiz.i++; quiz.picked = null;
      if (quiz.i >= J.QUIZ.length) { state.quiz.bestScore = Math.max(state.quiz.bestScore || 0, quiz.score); state.quiz.completedAt = Date.now(); save(); }
      renderQuiz(); window.scrollTo(0, 0);
    };
  }

  // ---------- S9 포스터 ----------
  function renderPoster() {
    var s = state.settings;
    var h = topbar('카운터 포스터', '#/learn') + '<p class="sub no-print">A4 한 장으로 인쇄돼요. 카운터나 전화기 옆에 붙여 두세요.</p>';
    h += '<article class="poster" aria-label="인쇄용 포스터"><div class="ph"><h2>🛡️ 단체 주문 전화 받으면</h2><p>' + (s.storeName ? esc(s.storeName) + ' 직원 공통 기준' : '우리 매장 직원 공통 기준') + '</p></div>' +
      '<div class="stopbox"><b>대리구매 · 대납 · 지정 계좌 송금 요청<br>= 사기입니다. 정중히 거절하세요.</b></div>' +
      '<h3>확인 순서 3단계</h3><ol><li>명함·공문 번호 말고 <b>기관 공식 대표번호</b>로 확인</li><li><b>예약금 ' + s.depositPct + '%</b>를 먼저 받고 준비 시작</li><li>이미 돈을 보냈다면 즉시 <b>112와 은행</b>에 신고</li></ol>' +
      '<h3>공식 번호</h3><div class="nums">' + J.CONTACTS.map(function (x) { return '<div><b>' + esc(x.num) + '</b><span>' + esc(x.name) + '</span></div>'; }).join('') + '</div>' +
      '<div class="url"><span class="cap">60초 점검 · 문자 템플릿</span><b>' + esc(J.APP_URL.replace('https://', '')) + '</b></div>' +
      '<p class="foot">번호 출처: 서울시 군 사칭 사기범죄 예방 공고(' + J.CONTACTS_VERIFIED_ON + ' 확인). 참고용 안내이며, 피해가 의심되면 112에 신고하세요.</p></article>';
    h += '<div class="stack no-print"><button class="btn btn-primary" data-act="print">🖨️ 인쇄하기</button></div>';
    view.innerHTML = h;
    $('[data-act="print"]').onclick = function () { window.print(); };
  }
  // ---------- S7 장부 ----------
  function renderLog() {
    var list = state.log.slice().sort(function (a, b) { return (b.date + b.updatedAt) < (a.date + a.updatedAt) ? -1 : 1; });
    var h = topbar('주문 기록 장부', '');
    h += '<div class="row2"><a class="btn btn-primary btn-sm" href="#/log/new">+ 새 기록</a><button class="btn btn-line btn-sm" data-act="csv"' + (list.length ? '' : ' disabled') + '>CSV 내보내기</button></div>';
    if (!list.length) {
      h += '<section class="card empty"><div class="big" aria-hidden="true">📒</div><h2>아직 기록이 없어요</h2><p class="sub">점검 결과 화면에서 [이 주문 기록하기]를 누르면 여기에 모여요. 같은 번호로 다시 전화가 오면 알려드려요.</p><div class="stack"><button class="btn btn-soft" data-act="sample">예시 기록 불러오기</button></div></section>';
    } else {
      h += list.map(function (e) {
        return '<a class="litem" href="#/log/' + esc(e.id) + '" data-log="' + esc(e.id) + '"><i class="dot ' + (e.level || 'none') + '" aria-hidden="true"></i><div class="m"><b>' + esc(e.claimedOrg || '소속 없음') + ' · ' + esc(e.callerName || '이름 없음') + (e.isSample ? ' <span class="tag gray">예시</span>' : '') + '</b><span>' + fmtDay(e.date) + ' · ' + esc(J.OUTCOMES[e.outcome]) + (e.phone ? ' · <span class="nowrap">' + esc(J.formatPhone(e.phone)) + '</span>' : '') + '</span></div><span class="amt">' + (e.amount ? J.comma(e.amount) + '원' : '') + '</span></a>';
      }).join('');
      if (list.some(function (e) { return e.isSample; })) h += '<button class="btn btn-ghost" data-act="clear-sample">예시 기록 지우기</button>';
      h += '<p class="cap" style="text-align:center">기록은 이 기기에만 저장돼요.</p>';
    }
    view.innerHTML = h;
    var b;
    if ((b = $('[data-act="sample"]'))) b.onclick = function () {
      state.log.push({ id: J.newId('l'), checkId: null, date: J.todayStr(), callerName: '김OO', claimedOrg: 'OO부대', phone: '01000000000', orderText: '볶음밥 70, 탕수육 10', amount: 980000, outcome: 'unknown', memo: '공문 사진 문자로 받음 (예시 기록)', level: 'red', isSample: true, updatedAt: Date.now() });
      save(); renderLog(); toast('예시 기록 1건을 불러왔어요');
    };
    if ((b = $('[data-act="clear-sample"]'))) b.onclick = function () { state.log = state.log.filter(function (e) { return !e.isSample; }); save(); renderLog(); toast('예시 기록을 지웠어요'); };
    if ((b = $('[data-act="csv"]'))) b.onclick = function () {
      var blob = new Blob([J.logToCsv(list)], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'jumunbangpae-log-' + J.todayStr() + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast('CSV 파일을 내려받았어요');
    };
  }
  function renderLogForm(id, q) {
    var isNew = id === 'new', e = isNew ? null : getLog(id);
    if (!isNew && !e) { view.innerHTML = topbar('기록', '#/log') + '<div class="card empty"><div class="big" aria-hidden="true">🔍</div><h2>기록을 찾을 수 없어요</h2><p class="sub">이미 지워진 기록이에요.</p><a class="btn btn-primary" href="#/log">장부로 가기</a></div>'; return; }
    var c = isNew && q.check ? getCheck(q.check) : (e && e.checkId ? getCheck(e.checkId) : null);
    var d = e ? JSON.parse(JSON.stringify(e)) : { id: null, checkId: c ? c.id : null, date: J.todayStr(), callerName: '', claimedOrg: '', phone: '', orderText: '', amount: c ? c.orderAmount : null, outcome: 'unknown', memo: '', level: c ? c.level : null };
    var h = topbar(isNew ? '새 기록' : '기록 상세', isNew && c ? '#/result/' + encodeURIComponent(c.id) : '#/log');
    if (d.level) h += '<p><span class="tag ' + d.level + '">' + (d.level === 'red' ? '🔴' : d.level === 'yellow' ? '🟡' : '🟢') + ' 점검 결과 ' + J.LEVEL_NAME[d.level] + '</span>' + (c ? ' <a href="#/result/' + esc(c.id) + '">결과 보기</a>' : '') + '</p>';
    h += '<form class="card" id="logForm" novalidate>' +
      '<div class="field"><label for="l-date">날짜</label><input class="input" type="date" id="l-date" value="' + esc(d.date) + '" required></div>' +
      '<div class="row2"><div class="field"><label for="l-name">주문자 이름</label><input class="input" id="l-name" maxlength="40" value="' + esc(d.callerName) + '" placeholder="예: 김OO"></div>' +
      '<div class="field"><label for="l-org">칭한 소속</label><input class="input" id="l-org" maxlength="60" value="' + esc(d.claimedOrg) + '" placeholder="예: OO부대"></div></div>' +
      '<div class="field"><label for="l-phone">전화번호</label><input class="input num" id="l-phone" type="tel" inputmode="tel" autocomplete="off" maxlength="20" value="' + esc(J.formatPhone(d.phone)) + '" placeholder="010-0000-0000" aria-describedby="l-dup"><div id="l-dup" aria-live="polite"></div></div>' +
      '<div class="field"><label for="l-order">주문 내용</label><textarea class="input" id="l-order" maxlength="300" placeholder="예: 볶음밥 70, 탕수육 10">' + esc(d.orderText) + '</textarea></div>' +
      '<div class="field"><label for="l-amt">금액</label><div class="input-wrap"><input class="input num" id="l-amt" inputmode="numeric" autocomplete="off" value="' + (d.amount ? J.comma(d.amount) : '') + '" placeholder="예: 980,000"><span class="unit">원</span></div></div>' +
      '<div class="field"><span class="l" id="l-out-l">결과</span><div class="seg" role="radiogroup" aria-labelledby="l-out-l">' + Object.keys(J.OUTCOMES).map(function (k) { return '<button type="button" role="radio" aria-checked="' + (d.outcome === k) + '" data-out="' + k + '" tabindex="' + (d.outcome === k ? 0 : -1) + '">' + esc(J.OUTCOMES[k]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><label for="l-memo">메모</label><textarea class="input" id="l-memo" maxlength="1000" placeholder="예: 공문 사진 문자로 받음">' + esc(d.memo) + '</textarea></div>' +
      '<div id="l-err" class="err" role="alert"></div>' +
      '<div class="stack"><button class="btn btn-primary" type="submit">' + (isNew ? '장부에 저장' : '수정 저장') + '</button>' + (isNew ? '' : '<button class="btn btn-danger" type="button" data-act="del">이 기록 삭제</button>') + '</div></form>';
    view.innerHTML = h;
    var phone = $('#l-phone');
    function dupCheck() {
      var dups = J.findDuplicatePhone(state.log, phone.value, d.id);
      $('#l-dup').innerHTML = dups.length ? '<div class="warn-box" data-dup="1">⚠️ 이전에 기록된 번호예요 (' + dups.length + '건). ' + dups.slice(0, 2).map(function (x) { return '<a href="#/log/' + esc(x.id) + '">' + fmtDay(x.date) + ' ' + esc(x.claimedOrg || x.callerName || '기록') + ' · ' + esc(J.OUTCOMES[x.outcome]) + '</a>'; }).join(', ') + '</div>' : '';
    }
    phone.addEventListener('input', dupCheck); dupCheck();
    bindAmount($('#l-amt'), function (v) { d.amount = v && v > 0 ? v : null; });
    $$('[data-out]').forEach(function (b, idx, all) {
      b.onclick = function () { d.outcome = b.getAttribute('data-out'); all.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; }); };
      b.onkeydown = function (ev) { if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); var n = all[(idx + (ev.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]; n.click(); n.focus(); } };
    });
    $('#logForm').onsubmit = function (ev) {
      ev.preventDefault();
      var date = $('#l-date').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('#l-err').textContent = '날짜를 넣어 주세요.'; $('#l-date').focus(); return; }
      var pd = J.normalizePhone(phone.value);
      if (pd && pd.length < 7) { $('#l-err').textContent = '전화번호를 확인해 주세요. 숫자 7자리 이상이어야 해요.'; phone.focus(); return; }
      var rec = J.sanitizeLog({ id: d.id || J.newId('l'), checkId: d.checkId, date: date, callerName: $('#l-name').value.trim(), claimedOrg: $('#l-org').value.trim(), phone: pd, orderText: $('#l-order').value.trim(), amount: d.amount, outcome: d.outcome, memo: $('#l-memo').value.trim(), level: d.level, isSample: e ? e.isSample : false, updatedAt: Date.now() });
      if (isNew) state.log.push(rec); else state.log = state.log.map(function (x) { return x.id === rec.id ? rec : x; });
      save(); toast(isNew ? '장부에 저장했어요' : '수정했어요');
      if (isNew) replace('#/log/' + rec.id); else renderLogForm(rec.id, {});
    };
    var del = $('[data-act="del"]');
    if (del) del.onclick = function () {
      confirmModal('이 기록을 삭제할까요?', '삭제하면 되돌릴 수 없어요.', '삭제', function () { state.log = state.log.filter(function (x) { return x.id !== d.id; }); save(); toast('삭제했어요'); replace('#/log'); }, true);
    };
  }

  // ---------- router ----------
  function parse() {
    var h = location.hash.replace(/^#/, '') || '/', qi = h.indexOf('?'), path = qi >= 0 ? h.slice(0, qi) : h, q = {};
    if (path.indexOf('#') >= 0) path = path.slice(0, path.indexOf('#'));
    if (qi >= 0) h.slice(qi + 1).split('#')[0].split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) try { q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); } catch (e) { /* noop */ } });
    return { parts: path.split('/').filter(Boolean), q: q };
  }
  var TITLES = { home: '주문방패 — 단체 주문 전화, 끊기 전에 60초 노쇼 사기 점검', check: '60초 점검 · 주문방패', result: '점검 결과 · 주문방패', messages: '보낼 문자 · 주문방패', verify: '공식 번호로 확인 · 주문방패', learn: '수법 도감 · 주문방패', quiz: '직원 교육 퀴즈 · 주문방패', poster: '카운터 포스터 · 주문방패', log: '주문 기록 장부 · 주문방패', settings: '매장 설정 · 주문방패' };
  function route() {
    var r = parse(), p = r.parts, tab = 'home', name = p[0] || 'home';
    document.getElementById('modal-root').innerHTML = ''; document.body.classList.remove('locked');
    if (name !== 'quiz') quiz = name === 'quiz' ? quiz : null;
    switch (name) {
      case 'home': renderHome(); break;
      case 'settings': renderSettings(r.q); break;
      case 'check': renderCheck(); break;
      case 'result': renderResult(p[1] || ''); break;
      case 'messages': tab = 'messages'; renderMessages(r.q); break;
      case 'verify': renderVerify(); break;
      case 'learn': case 'quiz': case 'poster': tab = 'learn'; (name === 'learn' ? renderLearn : name === 'quiz' ? renderQuiz : renderPoster)(); break;
      case 'log': tab = 'log'; if (p[1]) renderLogForm(p[1], r.q); else renderLog(); break;
      default: name = 'home'; renderHome();
    }
    document.title = TITLES[name] || TITLES.home;
    $$('.tabbar a').forEach(function (a) { if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (location.hash.indexOf('#privacy') < 0) window.scrollTo(0, 0);
  }

  // ---------- self test (콘솔: runSelfTest()) ----------
  window.runSelfTest = function () {
    var R = [], E = J.evaluate;
    function t(name, got, exp) { var ok = JSON.stringify(got) === JSON.stringify(exp); R.push({ case: name, pass: ok, got: got, expected: exp }); }
    function A(yes, rest) { var a = {}; J.QUESTIONS.forEach(function (q) { a[q.id] = rest || 'no'; }); yes.forEach(function (k) { a[k] = 'yes'; }); return a; }
    var e1 = E(A(['Q1'])); t('TC1 Q1=yes → critical red', [e1.critical, e1.level], [true, 'red']);
    t('TC1 Q1 yes → 남은 문항 건너뜀', [J.shouldStop('Q1', 'yes'), J.nextIndex(0, 'Q1', 'yes'), J.nextIndex(0, 'Q1', 'no')], [true, -1, 1]);
    var e2 = E(A(['Q3', 'Q4', 'Q5'])); t('TC2 Q3·Q4·Q5 → 35 red', [e2.score, e2.level, e2.critical], [35, 'red', false]);
    var e3 = E(A(['Q3', 'Q7'])); t('TC3 Q3·Q7 → 20 yellow', [e3.score, e3.level], [20, 'yellow']);
    var e4 = E(A(['Q3', 'Q4', 'Q5', 'Q10'])); t('TC4 Q3·Q4·Q5·Q10 → 5 green', [e4.score, e4.level], [5, 'green']);
    var e5 = E(A(['Q2', 'Q10'])); t('TC5 Q2·Q10 → critical red, Q10 감점 없음', [e5.critical, e5.level, e5.score, e5.verifyIgnored], [true, 'red', 40, true]);
    var e6 = E(A(['Q8', 'Q9'])); t('TC6 Q8·Q9 → 10 green', [e6.score, e6.level], [10, 'green']);
    var e7 = E(A([], 'unknown')); t('TC7 전부 모름 → 0 green, 확인 필요 10', [e7.score, e7.level, e7.unknowns.length], [0, 'green', 10]);
    t('경계: 15 yellow / 30 red / 0 하한', [E(A(['Q5'])).level, E(A(['Q5', 'Q6'])).level, E(A(['Q10'])).score], ['yellow', 'red', 0]);
    t('예약금 980,000×30% = 294,000', J.deposit(980000, 30), 294000);
    t('예약금 1,234,000×30% = 370,000 (370,200 반올림)', J.deposit(1234000, 30), 370000);
    t('예약금 빈 금액 → null → "(예약금)"', [J.deposit(null, 30), J.templateVars({}, null).deposit], [null, '(예약금)']);
    t('설정 없이 매장명 자리표시', J.fillTemplate('refuse', J.templateVars({}, null)).indexOf('안녕하세요, 저희 매장입니다.') === 0, true);
    var pass = R.every(function (x) { return x.pass; });
    if (window.console && console.table) console.table(R.map(function (x) { return { case: x.case, pass: x.pass, got: JSON.stringify(x.got) }; }));
    return { pass: pass, results: R };
  };

  // ---------- boot ----------
  state = load();
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', function (e) { if (e.key === KEY) { state = load(); route(); } });
  route();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 기능만 빠짐 */ }); });
  }
})();
