/* 겨울방학 돌봄 빈칸표 — UI */
(function () {
  'use strict';
  const E = window.GapEngine;
  const KEY = E.STORAGE_KEY, SKEY = E.SETTINGS_KEY;
  const BASE = 'https://347744strings-spec.github.io/webapp-daily/2026-11-13-winter-break-care-gap-planner/';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'id' + Math.random().toString(36).slice(2, 9);
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2400); };

  let H = null, R = null, HELP = null, LOAD_ERR = null, S = null, PREF = { onboarded: false };
  let DRAFT = null, INCLUDE_UNC = false, WEEK_START = null, SHEET = null;

  function loadPref() {
    try { PREF = Object.assign({ onboarded: false }, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { PREF = { onboarded: false }; }
  }
  function savePref() { try { localStorage.setItem(SKEY, JSON.stringify(PREF)); } catch (e) {} }
  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || o.version !== 1) return null;
      return o;
    } catch (e) { return null; }
  }
  function saveState() {
    if (!S || S.demo) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.'); }
  }
  function hasPlan(st) {
    return !!(st && !st.demo && st.children && st.children[0] && E.isDate(st.children[0].breakStart) && E.isDate(st.children[0].schoolReturn));
  }

  function currentState() { return hasPlan(S) ? S : E.officialDemo(); }

  function analyzeNow(st) {
    const s = st || currentState();
    s.settings = s.settings || {};
    s.settings.includeUnconfirmed = INCLUDE_UNC;
    return E.analyze(s, H, { includeUnconfirmed: INCLUDE_UNC });
  }

  function route() {
    const h = (location.hash || '#/').replace(/^#/, '');
    const p = h.replace(/^\//, '').split('/');
    const name = decodeURIComponent(p[0] || '');
    return { name: name || 'home', parts: p.slice(1), raw: h };
  }

  function pageTitle(r) {
    r = r || route();
    const base = '겨울방학 돌봄 빈칸표';
    const map = {
      home: base + ' — 혼자 있는 시간을 0으로',
      onboard: '아이·방학 정보 — ' + base,
      gaps: '빈칸 지도 — ' + base,
      fill: '빈칸 메꾸기 — ' + base,
      cost: '연차·비용 — ' + base,
      todos: '할 일·달력 — ' + base,
      share: '공유·당번표 — ' + base,
      help: '도움·출처 — ' + base,
      settings: '설정 — ' + base,
      day: '하루 타임라인 — ' + base,
      preset: '학교 일정 불러오기 — ' + base,
      error: '불러오기 오류 — ' + base
    };
    if (r.name === 'onboard') {
      const step = r.parts[0] === '2' ? '부모 정보' : r.parts[0] === '3' ? '확인' : '아이·방학 정보';
      return step + ' — ' + base;
    }
    if (r.name === 'day' && r.parts[0]) return E.fmt(r.parts[0]) + ' 타임라인 — ' + base;
    if (r.name === 'preset') return map.preset;
    if (!map[r.name] && r.name) return '페이지를 찾을 수 없어요 — ' + base;
    return map[r.name] || map.home;
  }

  function go(hash) { location.hash = hash.charAt(0) === '#' ? hash : '#/' + hash; }

  function confirmDlg(title, html, okLabel) {
    return new Promise(res => {
      const d = $('#dlg');
      $('#dlg-t').textContent = title;
      $('#dlg-b').innerHTML = html;
      $('#dlg-ok').textContent = okLabel || '계속';
      const on = ev => { d.removeEventListener('close', on); res(d.returnValue === 'ok'); };
      d.addEventListener('close', on);
      if (typeof d.showModal === 'function') d.showModal(); else res(window.confirm(title));
    });
  }

  function closeSheet() {
    SHEET = null;
    const sh = $('#sheet'), bg = $('#sheet-bg');
    sh.classList.remove('on'); bg.classList.remove('on');
    sh.hidden = true; bg.hidden = true; sh.innerHTML = '';
  }
  function openSheet(title, html) {
    const sh = $('#sheet'), bg = $('#sheet-bg');
    sh.innerHTML = '<div class="handle" aria-hidden="true"></div><h2 id="sheet-t">' + esc(title) + '</h2>' + html;
    sh.hidden = false; bg.hidden = false;
    requestAnimationFrame(() => { sh.classList.add('on'); bg.classList.add('on'); });
    const b = sh.querySelector('button, [href], input, select');
    if (b) b.focus();
  }

  /* ——— render helpers ——— */
  function counterBar(an) {
    if (!an || !an.ok) return '';
    const done = an.gapSlots === 0;
    return '<div class="counter' + (done ? ' done' : '') + '" role="status"><span>남은 빈칸 <b class="num">' + an.gapSlots + '칸</b> · <span class="num">' + an.gapHours + '시간</span></span>' +
      (done ? '<span class="badge ok">빈칸 0 · 완료</span>' : '') + '</div>';
  }
  function heatBlock(an, selected) {
    if (!an || !an.ok) return '';
    const by = Object.create(null);
    an.days.forEach(d => { by[d.date] = d; });
    const months = [];
    an.days.forEach(d => {
      const ym = d.date.slice(0, 7);
      if (!months.length || months[months.length - 1].ym !== ym) months.push({ ym, days: [] });
      months[months.length - 1].days.push(d);
    });
    const dow = '<div class="heat">' + ['일', '월', '화', '수', '목', '금', '토'].map(x => '<div class="dow">' + x + '</div>').join('') +
      '</div>';
    return months.map(m => {
      const [y, mo] = m.ym.split('-').map(Number);
      const first = m.ym + '-01';
      const startWd = E.weekday(first);
      const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      let cells = '';
      for (let i = 0; i < startWd; i++) cells += '<div class="cell mute" aria-hidden="true"></div>';
      for (let d = 1; d <= dim; d++) {
        const iso = m.ym + '-' + String(d).padStart(2, '0');
        const rec = by[iso];
        if (!rec) { cells += '<div class="cell mute"><span class="num">' + d + '</span></div>'; continue; }
        const hrs = rec.gapMin / 60;
        const cls = rec.gapMin <= 0 ? 'g0' : hrs <= 1 ? 'g1' : hrs <= 3 ? 'g2' : 'g3';
        const lab = E.fmt(iso, 'short') + (rec.holidayName ? ' ' + rec.holidayName : '') + ', 빈칸 ' + rec.gapHours + '시간';
        cells += '<button type="button" class="' + cls + '"' + (iso === selected ? ' aria-current="true"' : '') + ' data-act="openday" data-date="' + iso + '" aria-label="' + esc(lab) + '"><span class="num">' + d + '</span></button>';
      }
      return '<h3 class="month">' + y + '년 ' + mo + '월</h3><div class="heatwrap"><div class="heat">' +
        ['일', '월', '화', '수', '목', '금', '토'].map(x => '<div class="dow">' + x + '</div>').join('') + cells + '</div></div>';
    }).join('') + '<p class="legend"><i style="background:#EEF8F2"></i>빈칸 0 <i style="background:#FDE2E2"></i>~1시간 <i style="background:#F9A8A8"></i>~3시간 <i style="background:#E5484D"></i>그 이상 · 빈칸 날에는 ✕</p>';
  }

  function timelineHtml(day) {
    if (!day) return '';
    const layers = [];
    (day.covers || []).forEach(c => {
      layers.push({ from: c.iv[0], to: c.iv[1], kind: c.kind, label: c.label, unc: c.confirmed === false });
    });
    return '<div class="tl" role="list">' + day.slots.map(s => {
      const hit = layers.find(l => l.from < s.to && l.to > s.from);
      const kinds = [];
      if (s.gap) kinds.push('gap');
      if (s.lunch) kinds.push('lunchmark');
      if (hit) kinds.push(hit.kind === 'schoolCare' ? 'school' : hit.kind);
      if (hit && hit.unc) kinds.push('unc');
      const lab = hit && !s.gap ? esc(hit.label) : (s.gap ? '빈칸' : '');
      return '<div class="slot ' + kinds.join(' ') + '" role="listitem"><div class="tm num">' + s.fromLabel + '</div><div class="band">' + lab + (s.lunch ? ' <span class="badge">점심</span>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function top3(an) {
    if (!an.top || !an.top.length) return '<p class="hint">반복되는 큰 빈칸이 없어요.</p>';
    return '<ol class="list">' + an.top.map(t => '<li><div><strong>' + esc(t.label) + '</strong><div class="small">합계 <span class="num">' + t.hours + '</span>시간</div></div></li>').join('') + '</ol>';
  }

  /* ——— views ——— */
  function viewHome() {
    const saved = hasPlan(S);
    const demo = E.officialDemo();
    const an = analyzeNow(demo);
    return '<section class="hero"><p class="badge ex">예시 데이터로 미리 보기</p><h1>겨울방학, 우리 아이 혼자 있는 시간 몇 시간일까요?</h1><p class="lead">방학 일정과 두 사람의 근무시간을 겹치면, 혼자 있게 되는 칸이 빨갛게 표시됩니다. 앱은 혼자 있어도 되는 시간을 판단하지 않으며, 기본 허용은 0분입니다.</p>' +
      '<div class="actions"><button class="btn block" type="button" data-act="start">3분 만에 확인</button>' +
      (saved ? '<button class="btn ghost block" type="button" data-act="resume">이어서 하기</button>' : '<button class="btn ghost block" type="button" data-act="start">내 값으로 시작</button>') +
      '</div></section>' +
      (an.ok ? '<section class="card" style="border:2px solid var(--gap)"><p class="badge ex">예시</p><p>방학 <span class="num">' + an.totalDays + '</span>일 중 평일 <span class="num">' + an.weekdays + '</span>일, 아이 혼자인 시간 총 <span class="num">' + an.gapHours + '</span>시간 / 빨간 칸 <span class="num">' + an.gapSlots + '</span>개</p></section>' +
        '<div class="stats"><div class="stat hl"><small>빈칸</small><b class="num">' + an.gapHours + '시간</b></div><div class="stat"><small>도시락 필요</small><b class="num">' + an.packedDays + '일</b></div></div>' +
        '<section class="card"><h2>가장 큰 빈칸</h2>' + top3(an) + '</section>' +
        '<section class="card"><h2>빈칸 달력</h2>' + heatBlock(an) + '</section>' : '') +
      '<p class="small">예시: 초1, 방학 2026-12-31~2027-03-02, 학교 돌봄 08:30~16:30(도시락), 2/24~26 미운영, 맞벌이. 공휴일은 우주항공청 월력요항(확인일 2026-11-14). <span class="badge check">임시공휴일 미반영</span></p>';
  }

  function viewOnboard() {
    const step = (route().parts[0] === '2') ? 2 : (route().parts[0] === '3') ? 3 : 1;
    if (!DRAFT) DRAFT = emptyDraft();
    const d = DRAFT;
    const dots = '<div class="stepdots" aria-hidden="true"><i class="' + (step >= 1 ? 'on' : '') + '"></i><i class="' + (step >= 2 ? 'on' : '') + '"></i><i class="' + (step >= 3 ? 'on' : '') + '"></i></div>';
    if (step === 1) {
      return dots + '<h1>아이와 방학 일정</h1><p class="lead">학교 가정통신문의 날짜를 그대로 넣으면 됩니다. 모르면 비워 두고 나중에 넣을 수 있어요.</p>' +
        '<form class="card" data-form="ob1"><label for="nick">아이 별명</label><input id="nick" name="nick" maxlength="20" value="' + esc(d.nick) + '" placeholder="예: 첫째" autocomplete="nickname">' +
        '<label>학년</label><div class="chips">' + [1, 2, 3, 4, 5, 6].map(g => '<label><input type="radio" name="grade" value="' + g + '"' + (Number(d.grade) === g ? ' checked' : '') + '><span>' + g + '학년</span></label>').join('') + '</div>' +
        '<label>출생 구분(아이돌봄 A/B형)</label><div class="seg"><label><input type="radio" name="birth" value="A"' + (d.birthGroup !== 'B' ? ' checked' : '') + '><span>A형(2019.1.1 이후)</span></label><label><input type="radio" name="birth" value="B"' + (d.birthGroup === 'B' ? ' checked' : '') + '><span>B형(2018.12.31 이전)</span></label></div>' +
        '<div class="grid2"><div><label for="bs">방학 시작일</label><input id="bs" name="bs" type="date" value="' + esc(d.breakStart) + '"></div>' +
        '<div><label for="sr">개학일</label><input id="sr" name="sr" type="date" value="' + esc(d.schoolReturn) + '"></div></div>' +
        '<p class="hint" id="ob1-err" hidden></p>' +
        '<label class="check"><input type="checkbox" name="useCare" ' + (d.useCare ? 'checked' : '') + '> 방학 중 학교 돌봄 이용</label>' +
        (d.useCare ? ('<div class="grid2"><div><label for="cs">돌봄 시작</label><input id="cs" name="cs" type="time" value="' + esc(d.careStart) + '"></div><div><label for="ce">돌봄 종료</label><input id="ce" name="ce" type="time" value="' + esc(d.careEnd) + '"></div></div>' +
          '<p class="small">기본 08:30~16:30은 <span class="badge ex">예시</span>입니다. 우리 학교 시간으로 바꿔 주세요.</p>' +
          '<label>점심</label><div class="seg three"><label><input type="radio" name="lunch" value="provided"' + (d.lunch === 'provided' ? ' checked' : '') + '><span>제공</span></label><label><input type="radio" name="lunch" value="packed"' + (d.lunch === 'packed' ? ' checked' : '') + '><span>도시락</span></label><label><input type="radio" name="lunch" value="unknown"' + (d.lunch === 'unknown' ? ' checked' : '') + '><span>모름</span></label></div>' +
          '<label for="closed">미운영일(선택)</label><input id="closed" name="closed" placeholder="예: 2027-02-24~2027-02-26 소독" value="' + esc(d.closedText) + '">' +
          '<p class="hint">날짜 범위와 이유를 적으면 반영됩니다.</p><div class="actions"><button type="button" class="btn ghost" data-act="preset-closed" data-kind="clean">소독 3일 예시</button><button type="button" class="btn ghost" data-act="preset-closed" data-kind="home">가정학습 예시</button></div>' +
          '') : '') +
        '<label for="mid">중간 등교일(선택)</label><input id="mid" name="mid" placeholder="예: 2027-02-05" value="' + esc(d.midText) + '"><p class="small">졸업식·등교일. 시간 기본 08:30~13:00은 <span class="badge ex">예시</span>입니다.</p>' +
        '<div class="actions"><button class="btn block" type="submit">다음 · 부모 정보</button></div></form>';
    }
    if (step === 2) {
      const gcard = (g, i) => '<div class="card" data-gid="' + g.id + '"><h2>보호자 ' + (i + 1) + (i === 0 ? '' : ' <button type="button" class="btn ghost" data-act="del-g" data-id="' + g.id + '">빼기</button>') + '</h2>' +
        '<label>이름(별칭)</label><input name="gname" value="' + esc(g.name) + '" maxlength="16">' +
        '<div class="grid2"><div><label>출근</label><input type="time" name="gstart" value="' + esc(g.start) + '"></div><div><label>퇴근</label><input type="time" name="gend" value="' + esc(g.end) + '"></div></div>' +
        '<label>편도 통근(분)</label><input type="number" name="gcomm" min="0" max="180" value="' + esc(g.commuteMin) + '">' +
        '<p class="small">부재 시간은 출근 − 통근부터 퇴근 + 통근까지로 계산합니다.</p>' +
        '<label>근무 요일</label><div class="chips">' + E.WD.map((w, di) => '<label><input type="checkbox" name="gwd" value="' + di + '"' + ((g.workDays || []).includes(di) ? ' checked' : '') + '><span>' + w + '</span></label>').join('') + '</div>' +
        '<label class="check"><input type="checkbox" name="gshift" ' + (g.pattern ? 'checked' : '') + '> 교대 패턴(주 단위 반복)</label>' +
        (g.pattern ? '<p class="small">앵커(패턴 시작 월요일)와 주차별 출퇴근을 넣어요.</p><label>앵커 날짜</label><input type="date" name="ganchor" value="' + esc(g.pattern.anchor || '2026-12-28') + '">' +
          (g.pattern.weeks || []).map((w, wi) => '<div class="grid2"><div><label>주 ' + (wi + 1) + ' 출근</label><input type="time" name="pwstart' + wi + '" value="' + esc(w.start) + '"></div><div><label>퇴근</label><input type="time" name="pwend' + wi + '" value="' + esc(w.end) + '"></div></div>').join('') : '') +
        '<div class="grid2"><div><label>남은 연차(일)</label><input type="number" name="gann" min="0" max="40" step="0.25" value="' + esc(g.annualLeft) + '"></div>' +
        '<div><label>가족돌봄휴가 잔여</label><input type="number" name="gfam" min="0" max="10" step="0.5" value="' + esc(g.familyCareLeft) + '"></div></div>' +
        '<p class="src">가족돌봄휴가는 무급, 연 최대 10일. 회사 규정을 확인하세요. <a href="https://www.law.go.kr/법령/남녀고용평등과일·가정양립지원에관한법률/제22조의2" rel="noopener">남녀고용평등법 제22조의2</a> · 확인일 2026-11-14. 법률 자문이 아닙니다.</p></div>';
      return dots + '<h1>보호자 근무·연차</h1><p class="lead">한부모면 보호자 1명만 두어도 됩니다. 교대근무는 패턴을 켜 주세요.</p>' +
        '<form data-form="ob2">' + d.guardians.map(gcard).join('') +
        (d.guardians.length < 2 ? '<p><button type="button" class="btn ghost" data-act="add-g">보호자 추가</button></p>' : '') +
        '<div class="actions"><button class="btn ghost" type="button" data-act="ob-back">이전</button><button class="btn" type="submit">다음 · 확인</button></div></form>';
    }
    /* step 3 */
    const tmp = draftToState(d);
    const an = E.analyze(tmp, H);
    const body = an.ok
      ? ('<div class="stats"><div class="stat hl"><small>혼자인 시간</small><b class="num">' + an.gapHours + '시간</b></div><div class="stat"><small>빨간 칸</small><b class="num">' + an.gapSlots + '개</b></div></div>' +
        '<p>방학 ' + an.totalDays + '일 중 평일 ' + an.weekdays + '일. 가장 큰 빈칸:</p>' + top3(an))
      : '<p class="err">방학 시작일과 개학일을 확인해 주세요. 개학일은 시작일보다 뒤여야 합니다.</p>';
    return dots + '<h1>이렇게 계산됐어요</h1>' + body +
      '<div class="actions"><button class="btn ghost" type="button" data-act="ob-back2">이전</button><button class="btn" type="button" data-act="ob-save"' + (an.ok ? '' : ' disabled') + '>빈칸 메꾸기 시작</button></div>';
  }

  function emptyDraft() {
    return {
      nick: '', grade: 1, birthGroup: 'A',
      breakStart: '', schoolReturn: '',
      useCare: true, careStart: '08:30', careEnd: '16:30', lunch: 'packed', closedText: '',
      midText: '',
      guardians: [blankG('g1', '보호자1')]
    };
  }
  function blankG(id, name) {
    return { id: id || uid(), name: name || '', workDays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', commuteMin: 30, pattern: null, annualLeft: 0, familyCareLeft: 10 };
  }
  function parseClosed(text) {
    const out = [];
    String(text || '').split(/[;\n]/).forEach(part => {
      const m = part.trim().match(/(\d{4}-\d{2}-\d{2})\s*[~～\-–]\s*(\d{4}-\d{2}-\d{2})(?:\s+(.+))?/);
      if (m) out.push({ from: m[1], to: m[2], reason: (m[3] || '').trim() });
      else {
        const n = part.trim().match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
        if (n) out.push({ from: n[1], to: n[1], reason: (n[2] || '').trim() });
      }
    });
    return out;
  }
  function draftToState(d) {
    const st = E.defaultState();
    st.demo = false;
    st.children = [{ id: 'c1', nick: d.nick || '아이', grade: Number(d.grade) || 1, birthGroup: d.birthGroup || 'A', breakStart: d.breakStart, schoolReturn: d.schoolReturn, midSchoolDays: parseClosed(d.midText).map(x => x.from) }];
    st.guardians = (d.guardians || []).map(g => Object.assign({}, g));
    st.layers = [];
    if (d.useCare) {
      st.layers.push({ id: 'l1', childId: 'c1', type: 'schoolCare', label: '학교 방학 돌봄', days: [1, 2, 3, 4, 5], start: d.careStart || '08:30', end: d.careEnd || '16:30', lunch: d.lunch || 'unknown', confirmed: true, closed: parseClosed(d.closedText) });
    }
    st.todos = [];
    return st;
  }
  function readOb1(form) {
    const fd = new FormData(form);
    DRAFT.nick = String(fd.get('nick') || '').slice(0, 20);
    DRAFT.grade = Number(fd.get('grade') || 1);
    DRAFT.birthGroup = fd.get('birth') === 'B' ? 'B' : 'A';
    DRAFT.breakStart = fd.get('bs') || '';
    DRAFT.schoolReturn = fd.get('sr') || '';
    DRAFT.useCare = form.querySelector('[name=useCare]') ? form.querySelector('[name=useCare]').checked : true;
    DRAFT.careStart = fd.get('cs') || DRAFT.careStart;
    DRAFT.careEnd = fd.get('ce') || DRAFT.careEnd;
    DRAFT.lunch = fd.get('lunch') || DRAFT.lunch;
    if (form.querySelector('[name=closed]')) DRAFT.closedText = form.querySelector('[name=closed]').value;
    if (form.querySelector('[name=mid]')) DRAFT.midText = form.querySelector('[name=mid]').value;
  }
  function readOb2(form) {
    $$('.card[data-gid]', form).forEach(card => {
      const id = card.getAttribute('data-gid');
      const g = DRAFT.guardians.find(x => x.id === id);
      if (!g) return;
      g.name = $('[name=gname]', card).value.slice(0, 16);
      g.start = $('[name=gstart]', card).value;
      g.end = $('[name=gend]', card).value;
      g.commuteMin = Number($('[name=gcomm]', card).value) || 0;
      g.workDays = $$('[name=gwd]', card).filter(i => i.checked).map(i => Number(i.value));
      g.annualLeft = Number($('[name=gann]', card).value) || 0;
      g.familyCareLeft = Number($('[name=gfam]', card).value) || 0;
      const sh = $('[name=gshift]', card);
      if (sh && sh.checked) {
        g.pattern = { type: 'weekly-rotate', anchor: $('[name=ganchor]', card) ? $('[name=ganchor]', card).value : '2026-12-28', weeks: [
          { start: ($('[name=pwstart0]', card) && $('[name=pwstart0]', card).value) || g.start, end: ($('[name=pwend0]', card) && $('[name=pwend0]', card).value) || g.end },
          { start: ($('[name=pwstart1]', card) && $('[name=pwstart1]', card).value) || '15:00', end: ($('[name=pwend1]', card) && $('[name=pwend1]', card).value) || '23:00' }
        ] };
      } else g.pattern = null;
    });
  }

  function needPlanView() {
    return '<div class="empty"><div class="ico" aria-hidden="true">▦</div><h1>아직 우리 집 계획이 없어요</h1><p>방학 날짜를 넣으면 빈칸을 계산합니다. 먼저 예시로 살펴볼 수도 있어요.</p><div class="actions"><a class="btn" href="#/onboard">내 값으로 시작</a><a class="btn ghost" href="#/">예시 보기</a></div></div>';
  }

  function viewGaps() {
    if (!hasPlan(S)) return needPlanView();
    const an = analyzeNow();
    if (!an.ok) return '<div class="card warn"><h1>입력 필요</h1><p>' + esc(an.message || '방학 기간을 확인해 주세요.') + '</p><a class="btn" href="#/onboard">입력하러 가기</a></div>';
    return counterBar(an) + '<h1>빈칸 지도</h1>' +
      '<p>방학 <span class="num">' + an.totalDays + '</span>일 중 평일 <span class="num">' + an.weekdays + '</span>일 · 혼자인 시간 <b class="num">' + an.gapHours + '</b>시간 / 빨간 칸 <b class="num">' + an.gapSlots + '</b>개' +
      (an.lunchUnknownDays ? ' · <span class="badge check">점심 모름 ' + an.lunchUnknownDays + '일</span>' : '') +
      ' · 도시락 <span class="num">' + an.packedDays + '</span>일</p>' +
      '<p class="toggle"><span>미확정 일정도 커버로 보기</span><label class="check" style="margin:0"><input type="checkbox" data-act="toggle-unc"' + (INCLUDE_UNC ? ' checked' : '') + '> 포함</label></p>' +
      '<section class="card"><h2>가장 큰 빈칸 3가지</h2>' + top3(an) + '<a class="btn" href="#/fill">빈칸 메꾸기</a></section>' +
      '<section class="card"><h2>달력</h2>' + heatBlock(an) + '</section>' +
      '<p class="small"><span class="badge check">임시공휴일 미반영</span> 공휴일 출처: 우주항공청 월력요항 · 확인일 2026-11-14</p>';
  }

  function viewDay() {
    if (!hasPlan(S) && !currentState()) return needPlanView();
    const iso = route().parts[0];
    const an = analyzeNow();
    if (!an.ok) return viewGaps();
    const day = an.days.find(d => d.date === iso);
    if (!day) return '<div class="card"><h1>해당 날짜가 방학 기간에 없어요</h1><a class="btn" href="#/gaps">달력으로</a></div>';
    const title = E.fmt(iso) + (day.holidayName ? ' · ' + day.holidayName : '');
    const gaps = day.gaps.map(g => E.fromMin(g[0]) + '–' + E.fromMin(g[1])).join(', ') || '없음';
    return counterBar(an) + '<p><a href="#/gaps">← 달력</a></p><h1>' + esc(title) + '</h1>' +
      '<p>빈칸 <b class="num">' + day.gapHours + '</b>시간' + (gaps !== '없음' ? ' (' + gaps + ')' : '') +
      (day.lunchPacked ? ' · <span class="badge check">도시락</span>' : '') +
      (day.closed.length ? ' · <span class="badge bad">' + esc(day.closed[0].reason || '미운영') + '</span>' : '') +
      (day.midSchool ? ' · <span class="badge info">중간 등교 <span class="badge ex">예시 시간</span></span>' : '') + '</p>' +
      timelineHtml(day) +
      (day.gaps.length ? '<div class="actions"><button class="btn" data-act="fill-day" data-date="' + iso + '">이 날 빈칸 메꾸기</button></div>' : '');
  }

  function viewFill() {
    if (!hasPlan(S)) return needPlanView();
    const an = analyzeNow();
    if (!an.ok) return viewGaps();
    const groups = an.top;
    const daysWith = an.days.filter(d => d.gapMin > 0);
    return counterBar(an) + '<h1>빈칸 메꾸기</h1>' +
      (an.gapSlots === 0 ? '<section class="card ok"><h2>빈칸이 0이 됐어요</h2><p>연차·비용 탭에서 소진과 예상 비용을 확인하고, 할 일과 당번표를 저장하세요.</p></section>' : '') +
      '<section class="card"><h2>같은 패턴 일괄 배정</h2>' +
      (groups.length ? '<ul class="list">' + groups.map((g, i) => '<li><div><strong>' + esc(g.label) + '</strong><div class="small">' + g.count + '일</div></div><button class="btn ghost" data-act="batch" data-from="' + g.from + '" data-to="' + g.to + '" data-dates="' + g.days.join(',') + '">일괄 배정</button></li>').join('') + '</ul>' : '<p class="hint">반복 패턴이 없어요.</p>') +
      '</section><section class="card"><h2>돌봄 일정 추가</h2><form data-form="layer"><label for="ltype">유형</label><select id="ltype" name="ltype"><option value="academy">학원</option><option value="center">틈새돌봄·센터</option><option value="grandparent">조부모·친척</option><option value="other">기타</option></select>' +
      '<label for="llabel">이름</label><input id="llabel" name="llabel" maxlength="20" placeholder="예: 태권도">' +
      '<div class="grid2"><div><label for="ls">시작</label><input id="ls" name="ls" type="time" value="16:40"></div><div><label for="le">끝</label><input id="le" name="le" type="time" value="17:40"></div></div>' +
      '<label>요일</label><div class="chips">' + E.WD.map((w, di) => '<label><input type="checkbox" name="ldays" value="' + di + '"' + ([1, 2, 3, 4, 5].includes(di) ? ' checked' : '') + '><span>' + w + '</span></label>').join('') + '</div>' +
      '<label for="llunch">점심</label><select id="llunch" name="llunch"><option value="none">해당 없음</option><option value="provided">제공</option><option value="packed">도시락</option><option value="unknown">모름</option></select>' +
      '<div class="grid2"><div><label for="lcost">비용</label><input id="lcost" name="lcost" type="number" min="0" value="0"></div><div><label for="lper">단위</label><select id="lper" name="lper"><option value="month">월</option><option value="week">주</option><option value="day">일</option></select></div></div>' +
      '<label for="ltravel">이동(분)</label><input id="ltravel" name="ltravel" type="number" min="0" max="60" value="0">' +
      '<label class="check"><input type="checkbox" name="lveh"> 학원 차량(이동 시간 커버)</label>' +
      '<label class="check"><input type="checkbox" name="lconf" checked> 확정</label>' +
      '<div class="actions"><button class="btn" type="submit">일정 추가</button><button class="btn ghost" type="button" data-act="preset-center" data-kind="A">센터 09–18</button><button class="btn ghost" type="button" data-act="preset-center" data-kind="B">센터 11–20</button></div></form>' +
      ((S.layers || []).length ? '<ul class="list">' + (S.layers || []).map(l => '<li><div><strong>' + esc(l.label) + '</strong> ' + esc(l.start) + '–' + esc(l.end) + (l.confirmed === false ? ' <span class="badge">미확정</span>' : '') + '</div><button class="btn ghost" data-act="del-layer" data-id="' + l.id + '">삭제</button></li>').join('') + '</ul>' : '') +
      '</section><section class="card"><h2>빈칸이 있는 날</h2><ul class="list">' +
      daysWith.slice(0, 80).map(d => '<li><div><a href="#/day/' + d.date + '"><strong>' + E.fmt(d.date, 'short') + '</strong></a> <span class="num">' + d.gapHours + '시간</span><div class="small">' + d.gaps.map(g => E.fromMin(g[0]) + '–' + E.fromMin(g[1])).join(', ') + (d.closed.length ? ' · 미운영' : '') + '</div></div><button class="btn ghost" data-act="fill-day" data-date="' + d.date + '">배정</button></li>').join('') +
      '</ul></section>';
  }

  function meansButtons(date, from, to, dates) {
    const gs = (S.guardians || []).map(g => '<button type="button" class="btn ghost" data-act="assign" data-means="annual" data-who="' + g.id + '">' + esc(g.name || '보호자') + ' 연차</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="half" data-who="' + g.id + '">' + esc(g.name || '보호자') + ' 반차</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="quarter" data-who="' + g.id + '">' + esc(g.name || '보호자') + ' 반반차</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="familyCare" data-who="' + g.id + '">' + esc(g.name || '보호자') + ' 돌봄휴가</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="wfh" data-who="' + g.id + '">' + esc(g.name || '보호자') + ' 재택</button>').join('');
    return '<p class="small">' + (dates && dates.length > 1 ? dates.length + '일에 같은 시간 ' : E.fmt(date, 'short') + ' ') + esc(from) + '–' + esc(to) + '</p>' +
      '<div class="actions">' + gs +
      '<button type="button" class="btn ghost" data-act="assign" data-means="grandparent">조부모·친척</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="sitter">아이돌보미</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="center">틈새돌봄</button>' +
      '<button type="button" class="btn ghost" data-act="assign" data-means="academy">학원 추가</button></div>' +
      '<p class="small">반차 4시간, 반반차 2시간(회사에 있는 경우만). 가족돌봄휴가는 무급·연 최대 10일, 회사 규정 확인. 아이돌보미는 1회 최소 2시간입니다. <span class="badge check">2027 고시 전 참고값</span></p>' +
      '<input type="hidden" id="as-date" value="' + esc(date || '') + '"><input type="hidden" id="as-from" value="' + esc(from || '') + '"><input type="hidden" id="as-to" value="' + esc(to || '') + '"><input type="hidden" id="as-dates" value="' + esc((dates || []).join(',')) + '">';
  }

  function viewCost() {
    if (!hasPlan(S)) return needPlanView();
    const an = analyzeNow();
    const lv = E.leaveUsage(S);
    const idb = S.settings.idolbom || {};
    const cost = E.sitterCost(S, R, H);
    const oth = E.otherCosts(S, an.ok ? an.start : null, an.ok ? an.end : null);
    const total = cost.copayTotal + oth.academy + oth.center + oth.extra;
    const bars = lv.rows.map(r => {
      const pct = r.annualLeft > 0 ? Math.min(100, Math.round(r.annualUsed / r.annualLeft * 100)) : (r.annualUsed > 0 ? 100 : 0);
      return '<div class="card' + (r.annualOver || r.familyOver ? ' bad' : '') + '"><h3>' + esc(r.name) + '</h3>' +
        '<p>연차 <span class="num">' + r.annualUsed + '</span> / 잔여 ' + r.annualLeft + '일' + (r.annualOver ? ' <span class="badge bad">초과</span>' : '') + '</p>' +
        '<div class="bar" aria-hidden="true"><span class="' + (r.annualOver ? 'over' : '') + '" style="width:' + pct + '%"></span></div>' +
        '<p class="small">가족돌봄휴가 <span class="num">' + r.familyUsed + '</span> / ' + r.familyLeft + '일' + (r.familyOver ? ' <span class="badge bad">초과</span>' : '') + '</p></div>';
    }).join('');
    return '<h1>연차·비용</h1>' + (lv.imbalance ? '<p class="banner">연차가 ' + esc(lv.imbalance.name) + '에게 ' + lv.imbalance.share + '% 몰렸습니다(기준 ' + lv.imbalance.threshold + '% , 사용자가 정한 값).</p>' : '') +
      bars +
      '<section class="card"><h2>아이돌봄 예상 본인부담 <span class="badge check">2027 고시 전 참고값</span></h2>' +
      '<form class="grid2" data-form="idolbom"><div><label for="inc">소득유형</label><select id="inc" name="inc">' + ['가', '나', '다', '라', '마'].map(x => '<option' + (idb.incomeType === x ? ' selected' : '') + '>' + x + '형</option>').join('') + '</select></div>' +
      '<div><label for="kind">서비스</label><select id="kind" name="kind"><option value="basic"' + (idb.kind !== 'comprehensive' ? ' selected' : '') + '>기본형</option><option value="comprehensive"' + (idb.kind === 'comprehensive' ? ' selected' : '') + '>종합형</option></select></div>' +
      '<div><label for="hh">가구</label><select id="hh" name="hh"><option value="general"' + (idb.household !== 'vulnerable' ? ' selected' : '') + '>일반</option><option value="vulnerable"' + (idb.household === 'vulnerable' ? ' selected' : '') + '>한부모·장애·청소년부모</option></select></div>' +
      '<div><label for="used">올해 이미 쓴 지원시간</label><input id="used" name="used" type="number" min="0" max="960" value="' + esc(idb.usedHoursThisYear || 0) + '"></div></form>' +
      '<label class="check"><input type="checkbox" data-act="multi"' + (idb.multiChild ? ' checked' : '') + '> 다자녀 본인부담 10% 추가 지원</label>' +
      '<div class="stats"><div class="stat hl"><small>예상 본인부담</small><b class="num">' + cost.copayTotal.toLocaleString('ko-KR') + '원</b></div><div class="stat"><small>방학 사용 시간</small><b class="num">' + cost.billedHours + '시간</b></div></div>' +
      '<p class="small">시간당 본인부담 <span class="num">' + cost.info.copay.toLocaleString('ko-KR') + '</span>원 · 연 960시간 중 남은 지원 <span class="num">' + cost.remainAnnual + '</span>시간.' +
      (cost.minWarns ? ' 최소 2시간 미만 배정 ' + cost.minWarns + '건은 2시간으로 계산했습니다.' : '') +
      ' 야간(22~06시)·일요일·공휴일은 기본요금의 50% 할증(중복 없음). 토요일은 공휴일이 아니면 할증 없음.</p>' +
      '<p class="src">출처: <a href="https://www.law.go.kr/LSW/flDownload.do?flSeq=160764877" rel="noopener">고시 제2025-12호</a>, <a href="https://www.idolbom.go.kr/front/srvcGuide" rel="noopener">아이돌봄 누리집</a> · 확인일 2026-11-14. ' + esc(cost.surchargeNote || '') + '</p></section>' +
      '<section class="card"><h2>방학 돌봄 비용 합계</h2>' +
      '<p>아이돌봄 <span class="num">' + cost.copayTotal.toLocaleString('ko-KR') + '</span>원 + 학원 <span class="num">' + oth.academy.toLocaleString('ko-KR') + '</span>원 + 센터 <span class="num">' + oth.center.toLocaleString('ko-KR') + '</span>원 + 기타 <span class="num">' + oth.extra.toLocaleString('ko-KR') + '</span>원 = <b class="num">' + total.toLocaleString('ko-KR') + '원</b></p>' +
      '<p class="small">학원·센터 금액은 여러분이 입력한 값입니다. 도시락 필요일 <span class="num">' + (an.ok ? an.packedDays : 0) + '</span>일' + (an.ok && an.lunchUnknownDays ? ' · 점심 모름 ' + an.lunchUnknownDays + '일' : '') + '.</p></section>';
  }

  function viewTodos() {
    if (!hasPlan(S)) return needPlanView();
    const an = analyzeNow();
    const list = S.todos || [];
    return '<h1>할 일</h1><p class="lead">날짜는 직접 넣은 값만 씁니다. 도시락 전날 저녁, 미운영 D-7 알림은 보낼 때 선택할 수 있어요.</p>' +
      '<form class="card" data-form="todo"><label for="tt">할 일</label><input id="tt" name="tt" required maxlength="80" placeholder="학교 방학 돌봄 수요조사 회신">' +
      '<label for="td">날짜</label><input id="td" name="td" type="date" required>' +
      '<div class="actions"><button class="btn" type="submit">추가</button></div></form>' +
      '<div class="actions"><button class="btn ghost" type="button" data-act="todo-preset" data-kind="survey">수요조사 회신</button><button class="btn ghost" type="button" data-act="todo-preset" data-kind="center">틈새돌봄 문의</button><button class="btn ghost" type="button" data-act="todo-preset" data-kind="idolbom">아이돌봄 신청</button><button class="btn ghost" type="button" data-act="todo-preset" data-kind="leave">연차 신청</button></div>' +
      '<section class="card"><h2>목록</h2>' + (list.length ? '<ul class="list">' + list.map(t => '<li><label class="check"><input type="checkbox" data-act="todo-done" data-id="' + t.id + '"' + (t.done ? ' checked' : '') + '><span><strong>' + esc(t.title) + '</strong> · ' + (E.fmt(t.date, 'short')) + '</span></label><button class="btn ghost" data-act="todo-del" data-id="' + t.id + '">삭제</button></li>').join('') + '</ul>' : '<p class="hint">아직 할 일이 없어요.</p>') + '</section>' +
      '<section class="card"><h2>.ics 달력으로 보내기</h2>' +
      '<label class="check"><input type="checkbox" id="ics-lunch"> 도시락 필요일 전날 저녁 알림</label>' +
      '<label class="check"><input type="checkbox" id="ics-closed"> 미운영일 D-7 알림</label>' +
      '<div class="actions"><button class="btn" data-act="ics">.ics 내보내기</button></div>' +
      '<p class="small">파일은 Asia/Seoul, 유효한 VCALENDAR입니다. 실제 휴대전화에서 불러와 보지는 못했으니, 캘린더 앱에서 한 번 확인해 주세요.</p></section>';
  }

  function viewShare() {
    if (!hasPlan(S)) return needPlanView();
    const an = analyzeNow();
    const start = WEEK_START || (an.ok ? mondayOf(an.start) : E.todayKST());
    WEEK_START = start;
    return '<h1>공유</h1>' +
      '<section class="card"><h2>주간 당번표</h2><label for="wk">주 시작(월요일)</label><input id="wk" type="date" value="' + start + '" data-act="week">' +
      '<div id="roster-preview">' + rosterText(start, an, false) + '</div>' +
      '<label class="check"><input type="checkbox" id="roster-pii"> 담당 이름·연락처·알레르기 메모 포함</label>' +
      '<div class="actions"><button class="btn" data-act="roster-png">PNG 저장</button><button class="btn ghost" data-act="roster-txt">텍스트 복사</button></div></section>' +
      '<section class="card"><h2>부부 합의 요약</h2><pre id="couple-txt" style="white-space:pre-wrap;font:inherit">' + esc(coupleSummary(an)) + '</pre>' +
      '<button class="btn ghost" data-act="copy-couple">텍스트 복사</button></section>' +
      '<section class="card"><h2>학교 프리셋 링크</h2><p class="small">방학·돌봄 시간·미운영일만 들어갑니다. 아이 별명과 연락처는 넣지 않습니다.</p>' +
      '<div class="actions"><button class="btn" data-act="preset-link">링크 복사</button></div></section>' +
      '<section class="card"><h2>결과 카드</h2><p>개인정보 없이 “빈칸 N칸 → 지금 M칸”만 담습니다.</p>' +
      '<div class="actions"><button class="btn" data-act="card-png">이미지 저장</button></div></section>' +
      '<canvas id="share-cv" width="1080" height="1350" hidden></canvas>';
  }

  function mondayOf(iso) {
    const wd = E.weekday(iso);
    const back = wd === 0 ? 6 : wd - 1;
    return E.addDays(iso, -back);
  }
  function rosterText(start, an, withPii) {
    const days = [];
    for (let i = 0; i < 7; i++) days.push(E.addDays(start, i));
    const st = currentState();
    const lines = ['주간 당번표 ' + E.fmt(start, 'short') + '–' + E.fmt(E.addDays(start, 6), 'short')];
    days.forEach(iso => {
      const d = an && an.ok ? an.days.find(x => x.date === iso) : null;
      const assigns = (st.assignments || []).filter(a => a.date === iso);
      const who = assigns.map(a => {
        const g = (st.guardians || []).find(x => x.id === a.who);
        const lab = (E.MEANS[a.means] && E.MEANS[a.means].label) || '';
        return (g && withPii ? g.name : lab) + (a.from ? ' ' + a.from + '–' + a.to : ' 종일');
      }).join(', ');
      const gap = d && d.gapMin ? ' 빈칸 ' + d.gapHours + '시간' : '';
      lines.push(E.fmt(iso, 'short') + ' ' + (who || '미정') + gap);
    });
    if (withPii) {
      lines.push('', '연락처·픽업·알레르기는 기기에 적은 메모를 확인하세요.');
    }
    return '<pre style="white-space:pre-wrap;font:inherit">' + esc(lines.join('\n')) + '</pre>';
  }
  function coupleSummary(an) {
    const lv = E.leaveUsage(S);
    const cost = E.sitterCost(S, R, H);
    const oth = E.otherCosts(S, an && an.ok ? an.start : null, an && an.ok ? an.end : null);
    const total = cost.copayTotal + oth.academy + oth.center + oth.extra;
    const leaveLines = lv.rows.map(r => r.name + ' 연차 ' + r.annualUsed + '일' + (r.annualDates.length ? ' (' + r.annualDates.map(x => x.date).join(', ') + ')' : '')).join('\n');
    return '겨울방학 돌봄 합의 요약\n남은 빈칸 ' + (an && an.ok ? an.gapSlots : '—') + '칸, ' + (an && an.ok ? an.gapHours : '—') + '시간\n' + leaveLines + '\n예상 비용 합계 ' + total.toLocaleString('ko-KR') + '원 (아이돌봄은 2026 고시 참고값)\n이 앱은 조율 도구이며 법률·안전 판단이 아닙니다.';
  }

  function viewHelp() {
    const items = (HELP && HELP.items) || [];
    return '<h1>도움·출처</h1><p class="lead">수치와 문의처는 공식 출처와 확인일을 함께 적었습니다. 지역 센터 목록은 정확도 때문에 넣지 않습니다.</p>' +
      items.map(it => '<section class="card"><h2>' + esc(it.title) + (it.example ? ' <span class="badge ex">예시</span>' : '') + '</h2><p>' + esc(it.body) + (it.phone ? ' ☎ ' + esc(it.phone) : '') + '</p>' +
        (it.sample ? '<blockquote class="small">' + esc(it.sample) + '</blockquote>' : '') +
        (it.questions ? '<ol>' + it.questions.map(q => '<li>' + esc(q) + '</li>').join('') + '</ol>' : '') +
        '<p class="src">출처: <a href="' + esc(it.url) + '" rel="noopener">' + esc(it.sourceName) + '</a>' +
        (it.alsoUrl ? ' · <a href="' + esc(it.alsoUrl) + '" rel="noopener">' + esc(it.alsoName) + '</a>' : '') +
        ' · 확인일 ' + esc(it.checked) + '</p></section>').join('') +
      '<p class="small">아이돌봄 요금은 <span class="badge check">2027 고시 전 참고값</span>입니다. 공휴일은 <span class="badge check">임시공휴일 미반영</span>입니다.</p>';
  }

  function viewSettings() {
    const st = S && !S.demo ? S : (S = E.defaultState());
    const s = st.settings || {};
    return '<h1>설정</h1><form class="card" data-form="settings">' +
      '<div class="grid2"><div><label for="ss">슬롯 시작</label><input id="ss" name="ss" type="time" value="' + esc(s.slotStart || '07:00') + '"></div>' +
      '<div><label for="se">슬롯 끝</label><input id="se" name="se" type="time" value="' + esc(s.slotEnd || '21:00') + '"></div></div>' +
      '<div class="grid2"><div><label for="l0">점심 시작</label><input id="l0" name="l0" type="time" value="' + esc((s.lunch || ['12:00', '13:00'])[0]) + '"></div>' +
      '<div><label for="l1">점심 끝</label><input id="l1" name="l1" type="time" value="' + esc((s.lunch || ['12:00', '13:00'])[1]) + '"></div></div>' +
      '<label for="alone">혼자 있음 허용(분)</label><input id="alone" name="alone" type="number" min="0" max="240" step="10" value="' + esc(s.aloneAllowedMin || 0) + '">' +
      '<p class="small">기본 0분. 이 앱은 몇 분이 안전한지 판단하지 않습니다. 고학년 가정에서만 여러분이 기준을 정하세요.</p>' +
      '<label for="imb">연차 편중 경고 기준(%)</label><input id="imb" name="imb" type="number" min="50" max="100" value="' + esc(s.leaveImbalance || 70) + '">' +
      '<div class="actions"><button class="btn" type="submit">저장</button></div></form>' +
      '<section class="card"><h2>데이터</h2><div class="actions"><button class="btn ghost" data-act="export">JSON 내보내기</button><label class="btn ghost" style="margin:0">JSON 가져오기<input type="file" accept="application/json" data-act="import" hidden></label><button class="btn warn" data-act="wipe">전체 삭제</button></div>' +
      '<p class="small">저장 키 <code>gapPlanner.v1</code>. 서버로 보내지 않습니다.</p></section>' +
      '<p><a href="privacy.html">개인정보 안내</a> · <a href="tests.html">계산 테스트</a></p>';
  }

  function viewPreset() {
    const token = route().parts.join('/');
    let p, err;
    try { p = E.decodePreset(token); } catch (e) { err = true; }
    if (err) return '<div class="card bad"><h1>링크를 읽을 수 없어요</h1><p>학교 프리셋 링크가 손상되었거나 형식이 달라요.</p><a class="btn" href="#/">홈으로</a></div>';
    return '<div class="card"><h1>학교 일정을 가져올까요?</h1><p>방학 ' + esc(p.breakStart) + ' → 개학 ' + esc(p.schoolReturn) + ', 돌봄 ' + esc(p.schoolCare.start) + '–' + esc(p.schoolCare.end) + ', 점심 ' + esc(p.schoolCare.lunch) + ', 미운영 ' + (p.schoolCare.closed.length ? p.schoolCare.closed.map(c => c.from + '–' + c.to).join(', ') : '없음') + '.</p><p class="small">아이 별명·연락처는 링크에 들어 있지 않습니다.</p>' +
      '<div class="actions"><button class="btn" data-act="apply-preset">가져오기</button><a class="btn ghost" href="#/">취소</a></div></div>';
  }

  function view404() {
    return '<div class="empty"><h1>페이지를 찾을 수 없어요</h1><p>주소를 확인해 주세요.</p><a class="btn" href="#/">홈으로</a></div>';
  }
  function viewError() {
    return '<div class="card bad"><h1>자료를 불러오지 못했어요</h1><p>공휴일·요금 JSON을 읽지 못했습니다. 네트워크 또는 파일 경로를 확인해 주세요.</p><button class="btn" data-act="retry">다시 시도</button></div>';
  }

  /* ——— canvas ——— */
  function downloadCanvas(cv, name) {
    cv.toBlob(b => {
      if (!b) { toast('이미지를 만들지 못했어요'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('이미지를 저장했어요');
    }, 'image/png');
  }
  function paintRoster(start, withPii) {
    const cv = $('#share-cv');
    const an = analyzeNow();
    const w = 1080, h = 1350;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#F7F8FC'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2F4BA0'; ctx.fillRect(0, 0, w, 140);
    ctx.fillStyle = '#fff'; ctx.font = '700 44px system-ui,sans-serif';
    ctx.fillText('주간 당번표', 56, 70);
    ctx.font = '400 28px system-ui,sans-serif';
    ctx.fillText(E.fmt(start) + ' – ' + E.fmt(E.addDays(start, 6)), 56, 110);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(E.addDays(start, i));
    days.forEach((iso, i) => {
      const y = 180 + i * 150;
      ctx.fillStyle = '#fff';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(48, y, w - 96, 136, 16); ctx.fill(); }
      else ctx.fillRect(48, y, w - 96, 136);
      const d = an.ok ? an.days.find(x => x.date === iso) : null;
      ctx.fillStyle = '#1F2433'; ctx.font = '700 32px system-ui,sans-serif';
      ctx.fillText(E.fmt(iso), 72, y + 48);
      const assigns = (currentState().assignments || []).filter(a => a.date === iso);
      const st = currentState();
      const who = assigns.map(a => {
        const g = (st.guardians || []).find(x => x.id === a.who);
        const lab = (E.MEANS[a.means] && E.MEANS[a.means].label) || '';
        return (withPii && g ? g.name : lab) + (a.from ? ' ' + a.from + '–' + a.to : ' 종일');
      }).join(' · ') || '미정';
      ctx.font = '400 28px system-ui,sans-serif'; ctx.fillStyle = '#3A4156';
      ctx.fillText(who.slice(0, 36), 72, y + 90);
      if (d && d.gapMin) { ctx.fillStyle = '#E5484D'; ctx.fillText('빈칸 ' + d.gapHours + '시간', 72, y + 122); }
    });
    ctx.fillStyle = '#6B7280'; ctx.font = '400 22px system-ui,sans-serif';
    ctx.fillText('돌봄 빈칸표 · 개인 일정은 기기에만 저장', 56, h - 40);
    downloadCanvas(cv, 'duty-roster.png');
  }
  function paintCard() {
    const cv = $('#share-cv');
    const an = analyzeNow();
    const demoAn = E.analyze(E.officialDemo(), H);
    const startSlots = demoAn.ok ? demoAn.gapSlots : 0; /* not this — use first computed? we don't store initial. Show current only or "지금 N칸" */
    const cvw = 1080, cvh = 1080;
    cv.width = cvw; cv.height = cvh;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#2F4BA0'; ctx.fillRect(0, 0, cvw, cvh);
    ctx.fillStyle = '#fff'; ctx.font = '700 40px system-ui,sans-serif';
    ctx.fillText('우리 집 겨울방학 빈칸', 80, 200);
    ctx.font = '800 96px system-ui,sans-serif';
    const n = an && an.ok ? an.gapSlots : '—';
    ctx.fillText(String(n) + '칸', 80, 360);
    ctx.font = '400 36px system-ui,sans-serif';
    ctx.fillText((an && an.ok ? an.gapHours : '—') + '시간 · 평일 ' + (an && an.ok ? an.weekdays : '—') + '일', 80, 440);
    if (an && an.ok && an.gapSlots === 0) {
      ctx.fillStyle = '#8DCEB0';
      ctx.font = '700 48px system-ui,sans-serif';
      ctx.fillText('빈칸 0으로 맞췄어요', 80, 560);
    }
    ctx.fillStyle = '#C9D4F8'; ctx.font = '400 28px system-ui,sans-serif';
    ctx.fillText('돌봄 빈칸표 · 개인정보 없이 공유', 80, 980);
    downloadCanvas(cv, 'care-gap-card.png');
  }

  /* ——— events ——— */
  function applyAssignment(means, who) {
    const date = $('#as-date').value;
    const from = $('#as-from').value;
    const to = $('#as-to').value;
    const dates = ($('#as-dates').value || '').split(',').filter(E.isDate);
    const list = dates.length ? dates : (E.isDate(date) ? [date] : []);
    if (!list.length) return;
    let from2 = from, to2 = to;
    if (means === 'half' && E.toMin(from) != null) to2 = E.fromMin(E.toMin(from) + 240);
    if (means === 'quarter' && E.toMin(from) != null) to2 = E.fromMin(E.toMin(from) + 120);
    const allDay = means === 'annual' || means === 'familyCare';
    if (means === 'sitter' && E.toMin(from) != null && E.toMin(to) != null && (E.toMin(to) - E.toMin(from)) < 120) {
      toast('아이돌보미는 1회 최소 2시간이라, 비용은 2시간으로 계산합니다.');
    }
    list.forEach(iso => {
      S.assignments = S.assignments || [];
      S.assignments.push({ id: uid(), date: iso, from: allDay ? undefined : from2, to: allDay ? undefined : to2, allDay, childId: (S.children[0] || {}).id, means, who: who || undefined });
    });
    S.demo = false;
    saveState();
    closeSheet();
    render();
    toast(list.length + '일에 배정했어요');
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'start') { DRAFT = emptyDraft(); PREF.onboarded = true; savePref(); go('onboard'); return; }
    if (act === 'resume') { go('gaps'); return; }
    if (act === 'retry') { location.reload(); return; }
    if (act === 'ob-back') { readOb2(e.target.closest('form') || $('#view form')); go('onboard'); return; }
    if (act === 'ob-back2') { go('onboard/2'); return; }
    if (act === 'add-g') { const form = $('#view form'); if (form) readOb2(form); if (DRAFT.guardians.length < 2) DRAFT.guardians.push(blankG('g2', '보호자2')); render(); return; }
    if (act === 'del-g') { const form = $('#view form'); if (form) readOb2(form); DRAFT.guardians = DRAFT.guardians.filter(g => g.id !== btn.getAttribute('data-id')); if (!DRAFT.guardians.length) DRAFT.guardians.push(blankG('g1', '보호자1')); render(); return; }
    if (act === 'preset-closed') {
      const kind = btn.getAttribute('data-kind');
      const inp = $('#closed');
      if (!inp) return;
      inp.value = kind === 'home' ? '2027-01-25~2027-01-29 가정학습 기간' : '2027-02-24~2027-02-26 소독·새 학기 준비';
      toast('예시 날짜입니다. 우리 학교 안내로 바꿔 주세요.');
      return;
    }
    if (act === 'ob-save') {
      if (!DRAFT) return;
      S = draftToState(DRAFT);
      S.demo = false;
      PREF.onboarded = true; savePref(); saveState();
      go('gaps');
      return;
    }
    if (act === 'openday') { go('day/' + btn.getAttribute('data-date')); return; }
    if (act === 'toggle-unc') {
      INCLUDE_UNC = btn.checked;
      render();
      return;
    }
    if (act === 'fill-day') {
      const iso = btn.getAttribute('data-date');
      const an = analyzeNow();
      const day = an.days.find(d => d.date === iso);
      const g = (day && day.gaps[0]) ? day.gaps[0] : [E.toMin('16:30'), E.toMin('18:30')];
      SHEET = { date: iso, from: E.fromMin(g[0]), to: E.fromMin(g[1]) };
      openSheet('이 날 메꾸기', meansButtons(iso, SHEET.from, SHEET.to, [iso]));
      return;
    }
    if (act === 'batch') {
      const from = btn.getAttribute('data-from'), to = btn.getAttribute('data-to');
      const dates = (btn.getAttribute('data-dates') || '').split(',').filter(E.isDate);
      SHEET = { from, to, dates };
      openSheet('같은 패턴 일괄 배정', meansButtons(dates[0], from, to, dates));
      return;
    }
    if (act === 'assign') {
      if (!hasPlan(S)) { S = currentState(); S.demo = false; }
      applyAssignment(btn.getAttribute('data-means'), btn.getAttribute('data-who'));
      return;
    }
    if (act === 'del-layer') { S.layers = (S.layers || []).filter(l => l.id !== btn.getAttribute('data-id')); saveState(); render(); return; }
    if (act === 'preset-center') {
      const kind = btn.getAttribute('data-kind');
      const form = btn.closest('form');
      if (form) {
        form.ltype.value = 'center';
        form.llabel.value = kind === 'B' ? '틈새돌봄(11~20시)' : '틈새돌봄(09~18시)';
        form.ls.value = kind === 'B' ? '11:00' : '09:00';
        form.le.value = kind === 'B' ? '20:00' : '18:00';
      }
      toast('프리셋입니다. 우리 센터 시간으로 바꿔 주세요.');
      return;
    }
    if (act === 'multi') {
      S.settings = S.settings || {}; S.settings.idolbom = S.settings.idolbom || {};
      S.settings.idolbom.multiChild = btn.checked; saveState(); render(); return;
    }
    if (act === 'todo-del') { S.todos = (S.todos || []).filter(t => t.id !== btn.getAttribute('data-id')); saveState(); render(); return; }
    if (act === 'todo-done') {
      const t = (S.todos || []).find(x => x.id === btn.getAttribute('data-id'));
      if (t) { t.done = btn.checked; saveState(); }
      return;
    }
    if (act === 'todo-preset') {
      const kind = btn.getAttribute('data-kind');
      const map = { survey: '학교 방학 돌봄 수요조사 회신', center: '틈새돌봄 센터 문의(12월 첫 주)', idolbom: '아이돌봄서비스 신청', leave: '회사 연차 신청 제출' };
      $('#tt').value = map[kind] || '';
      if (kind === 'center') $('#td').value = '2026-12-01';
      $('#tt').focus();
      return;
    }
    if (act === 'ics') {
      const ok = await confirmDlg('달력 파일 내보내기', '<p>할 일 제목과 날짜가 파일에 포함됩니다. 아이 별명은 넣지 않습니다. 이 기기에만 있던 일정을 파일로 저장합니다.</p>', '내보내기');
      if (!ok) return;
      const ev = E.buildIcsEvents(S, analyzeNow(), { lunchEve: $('#ics-lunch') && $('#ics-lunch').checked, closedD7: $('#ics-closed') && $('#ics-closed').checked });
      if (!ev.length) { toast('내보낼 일정이 없어요'); return; }
      const ics = E.toICS(ev, { calName: '겨울방학 돌봄 할 일', uidSeed: 'app' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      a.download = 'winter-break-care.ics'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('달력 파일을 저장했어요');
      return;
    }
    if (act === 'week') return;
    if (act === 'roster-txt') {
      const withPii = $('#roster-pii') && $('#roster-pii').checked;
      if (withPii) {
        const ok = await confirmDlg('개인정보 포함', '<p>담당 이름·연락처·알레르기 메모가 텍스트에 들어갈 수 있습니다. 보낼 상대를 확인해 주세요.</p>', '복사');
        if (!ok) return;
      }
      const an = analyzeNow();
      const txt = rosterText(WEEK_START, an, withPii).replace(/<[^>]+>/g, '');
      try { await navigator.clipboard.writeText(txt); toast('복사했어요'); } catch (err) { toast('복사에 실패했어요'); }
      return;
    }
    if (act === 'roster-png') {
      const withPii = $('#roster-pii') && $('#roster-pii').checked;
      if (withPii) {
        const ok = await confirmDlg('개인정보 포함', '<p>담당 이름이 이미지에 들어갈 수 있습니다. 연락처는 기본으로 넣지 않습니다.</p>', '저장');
        if (!ok) return;
      } else {
        const ok = await confirmDlg('당번표 이미지', '<p>선택한 주의 일정 요약 이미지를 저장합니다. 기본으로는 보호자 실명·연락처를 넣지 않습니다.</p>', '저장');
        if (!ok) return;
      }
      paintRoster(WEEK_START, withPii);
      return;
    }
    if (act === 'copy-couple') {
      const ok = await confirmDlg('요약 복사', '<p>연차 사용일과 비용 합계가 포함됩니다. 아이 별명은 넣지 않았습니다.</p>', '복사');
      if (!ok) return;
      try { await navigator.clipboard.writeText(coupleSummary(analyzeNow())); toast('복사했어요'); } catch (err) { toast('복사에 실패했어요'); }
      return;
    }
    if (act === 'preset-link') {
      try {
        const token = E.encodePreset(S);
        const url = BASE + '#/preset/' + token;
        const ok = await confirmDlg('학교 프리셋 링크', '<p>방학·돌봄 시간·미운영일만 들어 있습니다. 별명·연락처는 빠집니다.</p><p class="small">' + esc(url) + '</p>', '복사');
        if (!ok) return;
        await navigator.clipboard.writeText(url);
        toast('링크를 복사했어요');
      } catch (err) { toast('방학 기간을 먼저 넣어 주세요'); }
      return;
    }
    if (act === 'card-png') {
      const ok = await confirmDlg('결과 카드', '<p>빈칸 칸 수와 시간만 들어갑니다. 이름·연락처는 넣지 않습니다.</p>', '저장');
      if (!ok) return;
      if (!$('#share-cv')) return;
      paintCard();
      return;
    }
    if (act === 'apply-preset') {
      const token = route().parts.join('/');
      try {
        const p = E.decodePreset(token);
        if (!S || S.demo) S = E.defaultState();
        E.applyPreset(S, p);
        S.demo = false;
        saveState();
        go('onboard');
        toast('학교 일정을 넣었어요. 우리 집 정보만 이어서 적어 주세요.');
      } catch (err) { toast('링크를 적용하지 못했어요'); }
      return;
    }
    if (act === 'export') {
      const ok = await confirmDlg('JSON 내보내기', '<p>아이 별명, 근무·연차, 할 일이 파일에 포함될 수 있습니다. 이 파일을 다른 곳에 올리기 전에 내용을 확인해 주세요.</p>', '내보내기');
      if (!ok) return;
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gapPlanner.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      return;
    }
    if (act === 'wipe') {
      const ok = await confirmDlg('전체 삭제', '<p>이 기기에 저장된 돌봄 빈칸표 데이터를 모두 지웁니다. 되돌릴 수 없어요.</p>', '삭제');
      if (!ok) return;
      localStorage.removeItem(KEY);
      S = null; DRAFT = null;
      toast('삭제했어요');
      go('/');
      return;
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.getAttribute('data-act') === 'import' && t.files && t.files[0]) {
      const f = t.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const o = JSON.parse(reader.result);
          if (!o || o.version !== 1) throw new Error('bad');
          const ok = await confirmDlg('JSON 가져오기', '<p>파일에 있는 별명·일정이 이 기기 저장 내용을 바꿉니다.</p>', '가져오기');
          if (!ok) return;
          S = o; S.demo = false; saveState(); toast('가져왔어요'); go('gaps');
        } catch (err) { toast('올바른 계획 JSON이 아니에요'); }
      };
      reader.readAsText(f);
      t.value = '';
      return;
    }
    if (t.id === 'wk') { WEEK_START = t.value; render(); return; }
    if (t.getAttribute('data-act') === 'toggle-unc') { INCLUDE_UNC = t.checked; render(); return; }
    if (t.getAttribute('data-act') === 'multi') { S.settings.idolbom = S.settings.idolbom || {}; S.settings.idolbom.multiChild = t.checked; saveState(); render(); return; }
    const form = t.closest('form[data-form=idolbom]');
    if (form) {
      const fd = new FormData(form);
      S.settings = S.settings || {};
      S.settings.idolbom = Object.assign({}, S.settings.idolbom, {
        incomeType: String(fd.get('inc') || '라').replace('형', ''),
        kind: fd.get('kind') || 'basic',
        household: fd.get('hh') || 'general',
        usedHoursThisYear: Number(fd.get('used') || 0)
      });
      saveState(); render();
    }
  }

  function onSubmit(e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    const kind = form.getAttribute('data-form');
    if (!kind) return;
    e.preventDefault();
    if (kind === 'ob1') {
      readOb1(form);
      const err = $('#ob1-err');
      if (DRAFT.breakStart && DRAFT.schoolReturn && !(E.isDate(DRAFT.breakStart) && E.isDate(DRAFT.schoolReturn) && E.toN(DRAFT.schoolReturn) > E.toN(DRAFT.breakStart))) {
        if (err) { err.hidden = false; err.className = 'err'; err.textContent = '개학일은 방학 시작일보다 뒤여야 해요.'; }
        const el = $('#sr'); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
        return;
      }
      go('onboard/2');
      return;
    }
    if (kind === 'ob2') { readOb2(form); go('onboard/3'); return; }
    if (kind === 'layer') {
      const fd = new FormData(form);
      const days = $$('[name=ldays]', form).filter(i => i.checked).map(i => Number(i.value));
      S.layers = S.layers || [];
      S.layers.push({
        id: uid(), childId: (S.children[0] || {}).id, type: fd.get('ltype') || 'other',
        label: String(fd.get('llabel') || '일정').slice(0, 20),
        days: days.length ? days : [1, 2, 3, 4, 5],
        start: fd.get('ls') || '16:00', end: fd.get('le') || '18:00',
        lunch: fd.get('llunch') || 'none',
        cost: { amount: Number(fd.get('lcost') || 0), per: fd.get('lper') || 'month' },
        confirmed: !!(form.lconf && form.lconf.checked),
        travelMin: Number(fd.get('ltravel') || 0),
        vehicle: !!(form.lveh && form.lveh.checked),
        closed: []
      });
      saveState(); toast('일정을 넣었어요'); render(); return;
    }
    if (kind === 'todo') {
      const title = form.tt.value.trim();
      const date = form.td.value;
      if (!title || !E.isDate(date)) { toast('제목과 날짜를 넣어 주세요'); return; }
      S.todos = S.todos || [];
      S.todos.push({ id: uid(), title, date, done: false });
      saveState(); render();
      return;
    }
    if (kind === 'settings') {
      const fd = new FormData(form);
      if (!S) S = E.defaultState();
      S.settings = Object.assign({}, S.settings, {
        slotStart: fd.get('ss') || '07:00',
        slotEnd: fd.get('se') || '21:00',
        lunch: [fd.get('l0') || '12:00', fd.get('l1') || '13:00'],
        aloneAllowedMin: Number(fd.get('alone') || 0),
        leaveImbalance: Number(fd.get('imb') || 70)
      });
      if (S.demo) { /* settings only pref? still allow if no plan */ }
      if (hasPlan(S)) saveState();
      else {
        /* persist settings into existing or leave unsaved until plan exists — also write if state exists */
        try { if (localStorage.getItem(KEY)) saveState(); } catch (err) {}
      }
      toast('설정을 저장했어요');
      render();
    }
  }

  function setTabs(r) {
    const tab = { gaps: 'gaps', fill: 'fill', cost: 'cost', todos: 'todos', share: 'share', day: 'gaps' }[r.name] || '';
    $$('.tabs a').forEach(a => {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function render() {
    const r = LOAD_ERR ? { name: 'error', parts: [] } : route();
    document.title = pageTitle(r);
    const view = $('#view');
    let html;
    if (r.name === 'error') html = viewError();
    else if (r.name === 'home' || r.name === '') html = viewHome();
    else if (r.name === 'onboard') html = viewOnboard();
    else if (r.name === 'gaps') html = viewGaps();
    else if (r.name === 'fill') html = viewFill();
    else if (r.name === 'cost') html = viewCost();
    else if (r.name === 'todos') html = viewTodos();
    else if (r.name === 'share') html = viewShare();
    else if (r.name === 'help') html = viewHelp();
    else if (r.name === 'settings') html = viewSettings();
    else if (r.name === 'day') html = viewDay();
    else if (r.name === 'preset') html = viewPreset();
    else html = view404();
    view.innerHTML = html;
    setTabs(r);
    view.focus({ preventScroll: true });
  }

  async function boot() {
    loadPref();
    S = loadState();
    try {
      const [h, r, help] = await Promise.all([
        fetch('data/holidays.json').then(x => { if (!x.ok) throw new Error('h'); return x.json(); }),
        fetch('data/idolbom-rates-2026.json').then(x => { if (!x.ok) throw new Error('r'); return x.json(); }),
        fetch('data/help-links.json').then(x => { if (!x.ok) throw new Error('p'); return x.json(); })
      ]);
      H = h; R = r; HELP = help;
    } catch (e) {
      LOAD_ERR = e;
    }
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    $('#sheet-bg').addEventListener('click', closeSheet);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeSheet(); });
    addEventListener('hashchange', render);
    /* checkbox in onboard: rerender when useCare / shift toggled */
    document.addEventListener('change', ev => {
      const t = ev.target;
      if (t && t.name === 'useCare' && DRAFT) { readOb1(t.form); DRAFT.useCare = t.checked; render(); }
      if (t && t.name === 'gshift' && DRAFT) { readOb2(t.form); render(); }
    });
    render();
  }

  window.runSelfTest = function () { return E.runSelfTest(H, R); };
  window.GapApp = { pageTitle, analyzeNow, currentState, route, officialDemo: E.officialDemo };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
