/* 2027 출강 지원판 — 기기 안에서만 계산·저장. 외부 요청 없음. */
(function () {
  'use strict';
  const KEY = 'chulgang.v1', DRAFT_KEY = 'chulgang.v1.draft', APP = '2027 출강 지원판';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  let H = null, R = null, SAMPLES = null, S = null, loadNote = '', draft = null, timer = null;
  const view = () => $('#view');
  const TODAY = () => CG.today(new Date());

  /* ---------- 저장 ---------- */
  const fresh = () => ({ v: 1, settings: { postalBufferBizDays: 2, dayStart: '13:00', dayEnd: '18:00', seasonPassInterest: 0, contractDate: '2027-03-02', teacher: '', tourDone: false, sampleLoaded: false, includeApps: true }, currentClasses: [], applications: [], docs: [], travel: [], proposalBase: '' });
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { loadNote = '이 브라우저는 저장소를 쓸 수 없어요(사생활 보호 모드 등). 입력은 이 탭을 닫으면 사라져요.'; return fresh(); }
    if (!raw) return fresh();
    try { const s = JSON.parse(raw); const c = clean(s); if (c) return c; throw Error('형식'); }
    catch (e) {
      try { localStorage.setItem(KEY + '.corrupt', raw); } catch (_) { /* 무시 */ }
      loadNote = '저장된 데이터를 읽지 못해 새로 시작했어요. 원래 내용은 따로 보관해 두었어요. 백업 파일이 있다면 설정 → 복원을 쓰세요.';
      return fresh();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); loadNote = ''; return true; }
    catch (e) { toast('저장하지 못했어요. 저장 공간이 가득 찼거나 막혀 있어요. 백업을 내려받아 두세요.'); return false; }
  }
  const mask = s => String(s || '').replace(/(?<!\d)\d{6}\s*-?\s*[1-8]\d{6}(?!\d)/g, '******-*******');
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const okDate = v => { try { return typeof v === 'string' && !!CG.date(v) && v; } catch (e) { return ''; } };
  const okTime = v => { try { CG.time(v); return v; } catch (e) { return ''; } };
  const numOr = (v, lo, hi) => (typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null);
  function cleanApp(a) {
    if (!a || typeof a !== 'object' || !str(a.school, 40)) return null;
    const dt = x => (x && okDate(x.date) ? { date: x.date, time: okTime(x.time) || '' } : null);
    const p = a.pay || {};
    return {
      id: str(a.id, 40) || uid('a'), school: str(a.school, 40), program: str(a.program, 40), rawText: mask(str(a.rawText, 8000)), sample: !!a.sample,
      submitMethod: CG.METHODS[a.submitMethod] ? a.submitMethod : '', deadline: dt(a.deadline), postArrival: dt(a.postArrival),
      interview: a.interview && okDate(a.interview.date) ? { date: a.interview.date, time: okTime(a.interview.time) || '', duration: numOr(a.interview.duration, 10, 240) || 60 } : null,
      resultAt: okDate(a.resultAt) || '',
      slots: (Array.isArray(a.slots) ? a.slots : []).filter(s => s && DAYS.includes(s.day) && okTime(s.start) && okTime(s.end) && s.end > s.start).slice(0, 8).map(s => ({ day: s.day, start: s.start, end: s.end })),
      pay: { type: ['hourly', 'per_student'].includes(p.type) ? p.type : '', amount: numOr(p.amount, 0, 1e8), unit: p.unit === 'hour60' ? 'hour60' : 'session', sessionsPerWeek: numOr(p.sessionsPerWeek, 1, 10), weeks: numOr(p.weeks, 1, 60), students: numOr(p.students, 1, 500), months: numOr(p.months, 1, 24), sharePct: numOr(p.sharePct, 0, 100) },
      requiredDocs: (Array.isArray(a.requiredDocs) ? a.requiredDocs : []).filter(k => R.docs.some(d => d.key === k)),
      prepared: a.prepared && typeof a.prepared === 'object' ? Object.fromEntries(Object.entries(a.prepared).filter(([k, v]) => R.docs.some(d => d.key === k) && v === true)) : {},
      status: CG.STATUSES.some(s => s[0] === a.status) ? a.status : 'interest',
      crimeCheckRequestedAt: okDate(a.crimeCheckRequestedAt) || '',
      proposalChecks: Object.fromEntries(PCHECK.map(([k]) => [k, !!(a.proposalChecks && a.proposalChecks[k])])),
      proposalText: mask(str(a.proposalText, 8000)), sessions: (Array.isArray(a.sessions) ? a.sessions : []).slice(0, 40).map(x => mask(str(x, 120))),
      place: mask(str(a.place, 100)), items: mask(str(a.items, 300)), questions: mask(str(a.questions, 2000)), notes: mask(str(a.notes, 1000)),
      createdAt: str(a.createdAt, 30) || new Date().toISOString()
    };
  }
  function clean(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.applications)) return null;
    const f = fresh(), st = s.settings || {};
    f.settings.postalBufferBizDays = Number.isInteger(st.postalBufferBizDays) && st.postalBufferBizDays >= 0 && st.postalBufferBizDays <= 15 ? st.postalBufferBizDays : 2;
    f.settings.dayStart = okTime(st.dayStart) || '13:00'; f.settings.dayEnd = okTime(st.dayEnd) || '18:00';
    if (f.settings.dayEnd <= f.settings.dayStart) { f.settings.dayStart = '13:00'; f.settings.dayEnd = '18:00'; }
    f.settings.seasonPassInterest = numOr(st.seasonPassInterest, 0, 1e6) || 0;
    f.settings.contractDate = okDate(st.contractDate) || '2027-03-02';
    f.settings.teacher = mask(str(st.teacher, 20)); f.settings.tourDone = !!st.tourDone; f.settings.sampleLoaded = !!st.sampleLoaded; f.settings.includeApps = st.includeApps !== false;
    f.applications = s.applications.map(cleanApp).filter(Boolean).slice(0, 60);
    f.currentClasses = (Array.isArray(s.currentClasses) ? s.currentClasses : []).filter(c => c && str(c.school, 40) && DAYS.includes(c.day) && okTime(c.start) && okTime(c.end) && c.end > c.start).slice(0, 40).map(c => ({ id: str(c.id, 40) || uid('c'), school: str(c.school, 40), program: str(c.program, 40), day: c.day, start: c.start, end: c.end, sample: !!c.sample }));
    f.docs = (Array.isArray(s.docs) ? s.docs : []).filter(d => d && R.docs.some(r => r.key === d.key && r.scope === 'vault')).map(d => ({ key: d.key, issuedAt: okDate(d.issuedAt) || '', pqi: !!d.pqi, note: mask(str(d.note, 200)), sample: !!d.sample }));
    f.travel = (Array.isArray(s.travel) ? s.travel : []).filter(t => t && str(t.from, 40) && str(t.to, 40) && numOr(t.minutes, 0, 300) != null).slice(0, 60).map(t => ({ from: str(t.from, 40), to: str(t.to, 40), minutes: t.minutes, sample: !!t.sample }));
    f.proposalBase = mask(str(s.proposalBase, 8000));
    return f;
  }
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const vault = () => Object.fromEntries(S.docs.map(d => [d.key, { have: true, issuedAt: d.issuedAt || undefined, pqi: d.pqi }]));
  const ctx = () => ({ today: TODAY(), contractDate: S.settings.contractDate });
  const rule = k => R.docs.find(d => d.key === k);
  const findApp = id => S.applications.find(a => a.id === id);
  const PCHECK = [['schoolName', '학교명'], ['grade', '대상 학년'], ['sessions', '차시 수(기본 12)'], ['schedule', '운영 요일·시간'], ['materials', '재료비'], ['goal', '교육목표']];

  /* ---------- 표시 도우미 ---------- */
  const fd = s => { if (!s) return '—'; const y = s.slice(0, 4) !== TODAY().slice(0, 4) ? s.slice(0, 4) + '. ' : ''; return `<span class="num">${y}${CG.label(s)}</span>`; };
  const fdt = (d, t) => d ? fd(d) + (t ? ` <span class="num">${t}</span>` : '') : '—';
  const ddText = n => (n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`);
  const won = n => `<span class="num">${Number(n).toLocaleString('ko-KR')}원</span>`;
  const hm = m => CG.hhmm(m);
  const statusLabel = k => (CG.STATUSES.find(s => s[0] === k) || [, k])[1];
  const srcLink = key => { const s = R.sources[key]; return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : ''; };
  const need = t => `<span class="chip need">확인 필요${t ? ' · ' + esc(t) : ''}</span>`;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }
  function confirmBox(title, text, okLabel = '계속') {
    const d = $('#confirm');
    $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-ok').textContent = okLabel;
    return new Promise(res => {
      const done = () => { d.removeEventListener('close', done); res(d.returnValue === 'ok'); };
      d.returnValue = ''; d.addEventListener('close', done);
      if (d.showModal) d.showModal(); else res(window.confirm(title + '\n' + text));
    });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('복사했어요. 붙여 넣기 전에 한 번 다듬어 주세요.'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('aria-hidden', 'true'); document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* 무시 */ } ta.remove(); toast(ok ? '복사했어요.' : '복사하지 못했어요. 글을 길게 눌러 직접 복사하세요.'); }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- 계산 묶음 ---------- */
  const calc = a => CG.backCalc(a, S.settings, H, TODAY());
  const missing = a => CG.missingDocs(a, vault(), R, ctx());
  function allConflicts(includeApps) {
    const items = CG.timetableItems(S.currentClasses, S.applications, includeApps);
    const c = CG.conflicts(items, S.travel);
    let iv = [];
    try { iv = CG.interviewConflicts(S.applications, S.currentClasses, S.travel); } catch (e) { iv = []; }
    return { items, ...c, iv };
  }
  const active = a => !['fail', 'contracted'].includes(a.status);
  function nextAction(a) {
    const c = calc(a); if (c.error) return null;
    if (c.state === 'past') return { app: a, c, date: c.deadlineDate, what: '마감 지남', n: c.deadlineDday };
    if (c.sendBy && c.state === 'open') return { app: a, c, date: c.sendBy, what: '우편 발송 권장', n: c.dday };
    return { app: a, c, date: c.deadlineDate, what: '접수 마감', n: c.deadlineDday };
  }
  function upcoming() {
    const t = TODAY(), ev = [];
    for (const a of S.applications) {
      if (!active(a)) continue;
      const c = calc(a);
      if (!c.error && ['interest', 'preparing'].includes(a.status)) {
        if (c.sendBy && c.state === 'open') ev.push({ a, date: c.sendBy, time: '', what: '우편 발송 권장' });
        if (c.deadlineDate >= t) ev.push({ a, date: c.deadlineDate, time: c.deadlineTime, what: '접수 마감' });
      }
      if (a.interview && a.interview.date >= t) ev.push({ a, date: a.interview.date, time: a.interview.time, what: '면접' });
      if (a.resultAt && a.resultAt >= t) ev.push({ a, date: a.resultAt, time: '', what: '발표' });
    }
    return ev.sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || '')));
  }

  /* ---------- 공고 → 지원 건 ---------- */
  function parse(text) { return CG.parseNotice(text, { today: TODAY(), rules: R }); }
  function appFromParse(p, text) {
    const f = p.fields || {}, pay = f.pay || {}, slots = f.slots || [];
    const methods = f.methods || [];
    return {
      id: uid('a'), school: f.school ? f.school.value : '', program: f.program ? f.program.value : '', rawText: mask(text),
      submitMethod: methods.includes('post_arrival') ? 'post_arrival' : methods[0] || '',
      deadline: f.deadline ? { date: f.deadline.date, time: f.deadline.time || '' } : null,
      postArrival: f.postArrival ? { date: f.postArrival.date, time: f.postArrival.time || '' } : null,
      interview: f.interview ? { date: f.interview.date, time: f.interview.time || '', duration: 60 } : null,
      resultAt: f.result ? f.result.date : '', slots,
      pay: { type: pay.type || '', amount: pay.amount == null ? null : pay.amount, unit: 'session', sessionsPerWeek: pay.sessionsPerWeek || (slots.length || null), weeks: pay.weeks || null, students: pay.students || null, months: pay.months || null, sharePct: pay.sharePct == null ? (pay.type === 'per_student' ? null : null) : pay.sharePct },
      requiredDocs: f.docs || [], prepared: {}, status: 'interest', crimeCheckRequestedAt: '', proposalChecks: {}, proposalText: '', sessions: [], place: '', items: '', questions: '', notes: ''
    };
  }
  function setDraft(text, sample) {
    const p = parse(text);
    draft = { text, sample: !!sample, p, app: p.fields ? appFromParse(p, text) : appFromParse({ fields: {} }, text) };
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ text, sample: !!sample })); } catch (e) { /* 무시 */ }
  }
  function restoreDraft() {
    if (draft) return draft;
    try { const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); if (d && typeof d.text === 'string') setDraft(d.text, d.sample); } catch (e) { /* 무시 */ }
    return draft;
  }

  /* ---------- 홈 ---------- */
  function pasteForm(big) {
    return `<form id="paste-form" class="noprint" novalidate>
<label class="field" for="paste"><span>학교 공고문 붙여 넣기</span><span class="hint">HWP·PDF에서 복사한 공고 본문 통째로. 주민번호처럼 보이는 숫자는 가려요.</span></label>
<textarea id="paste" name="paste" rows="${big ? 5 : 4}" placeholder="예) 접수 기간: 2026. 11. 10.(화) ~ 11. 17.(화) 17:00까지&#10;※ 우편 접수 시 17:00 도착분에 한하여 인정&#10;운영 시간: 매주 화·목 14:00~15:20"></textarea>
<p id="paste-err" class="alert red" hidden></p>
<div class="grid2" style="margin-top:8px"><button class="btn" type="submit">추출하기</button><a class="btn ghost" href="#/new">직접 입력</a></div></form>`;
  }
  function vHome() {
    const apps = S.applications, t = TODAY();
    let h = loadNote ? `<p class="alert warn" role="alert">${esc(loadNote)}</p>` : '';
    if (!apps.length) {
      return h + `<section class="card hero"><h1>공고문을 붙여 넣으면<br>마감·서류·겹침을 한 번에</h1>
<p class="lead">방과후·늘봄 개인위탁 강사용. 여러 학교 지원의 <b>우편 도착분 발송일</b>, <b>서류 유효기간</b>, <b>시간표 겹침</b>을 한 화면에.</p>
${pasteForm(true)}
<p class="small" style="margin:12px 0 6px"><b id="try">예시 공고로 해 보기</b> <span class="mut">(실제 학교 아닌 예시)</span></p>
<div class="grid2">${SAMPLES.notices.map(n => `<button class="btn acc" type="button" data-act="sample" data-id="${n.id}">${n.id === 's1' ? '예시 1 · 우편' : '예시 2 · 이메일'}</button>`).join('')}</div></section>
<section class="card"><h2>예시 시즌 한 번에</h2><p class="small">공고 2건 + 지금 하는 수업 2개 + 서류 3개를 넣어 겹침·면접 충돌·계약 전 만료 경고를 바로 보여 줘요.</p><button class="btn" type="button" data-act="season" style="width:100%">예시 시즌 불러오기</button></section>
<section class="card"><h2>90초 둘러보기</h2><ol class="steps"><li>예시 공고 → 추출 카드에서 마감·제출 방법·수업 시간·서류 확인</li><li>저장 → “우편이면 언제까지 발송” D-day 배너</li><li>시간표 탭에서 빨간 겹침·면접 충돌, 서류 탭에서 계약 전 만료 경고</li></ol>
<p class="small mut">가입 없음 · 데이터는 이 기기 브라우저에만 저장 · 서류 파일은 올리지도 저장하지도 않아요(날짜만 기록) · 최종 기준은 각 학교 공고문.</p></section>`;
    }
    const ups = upcoming();
    const firstAct = S.applications.filter(a => active(a) && ['interest', 'preparing'].includes(a.status)).map(nextAction).filter(x => x && x.n >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
    h += `<h1>이번 시즌 지원 현황</h1>`;
    if (firstAct) {
      const a = firstAct.app, c = firstAct.c;
      h += `<a class="dday" href="#/app/${a.id}" style="text-decoration:none"><span class="big num">${ddText(c.deadlineDday)}</span><span><b>${esc(a.school)}</b> 마감 ${fdt(c.deadlineDate, c.deadlineTime)}${c.sendBy ? ` · 우편이면 <b>${fd(c.sendBy)}까지 발송 권장</b>` : c.remindAt ? ` · ${fdt(c.remindAt.date, c.remindAt.time)} 알림 권장` : ''}</span></a>`;
    } else h += `<p class="alert info">다가오는 접수 마감이 없어요. 새 공고를 붙여 넣어 보세요.</p>`;
    if (S.settings.sampleLoaded && !S.settings.tourDone) h += tourCard();
    const cf = allConflicts(true), miss = S.applications.filter(active).reduce((s, a) => s + missing(a).length, 0);
    const week = S.applications.filter(a => { const c = calc(a); return active(a) && !c.error && c.deadlineDate >= t && CG.diffDays(t, c.deadlineDate) <= 6; }).length;
    const cb = CG.combos(S.applications, S.currentClasses, S.travel, 1);
    h += `<section class="stats" aria-label="시즌 요약">
<a class="stat" href="#/apps"><span class="small mut">이번 주 마감</span><b class="num">${week}건</b></a>
<a class="stat" href="#/apps"><span class="small mut">누락 서류</span><b class="num">${miss}개</b></a>
<a class="stat" href="#/timetable"><span class="small mut">겹침·충돌</span><b class="num">${cf.overlaps.length + cf.iv.length}건</b></a>
<a class="stat" href="#/timetable"><span class="small mut">상위 조합 수입</span><b class="num">${cb.top[0] ? (cb.top[0].income / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만원' : '—'}</b></a></section>`;
    h += `<section class="card"><h2>다가오는 할 일</h2>${ups.length ? `<ul class="list">${ups.slice(0, 3).map(e => `<li><a href="#/app/${e.a.id}" class="check" style="text-decoration:none;color:inherit;display:block"><b>${fdt(e.date, e.time)}</b> ${esc(e.what)} · ${esc(e.a.school)} <span class="chip ${CG.diffDays(t, e.date) <= 2 ? 'red' : 'warn'} num">${ddText(CG.diffDays(t, e.date))}</span></a></li>`).join('')}</ul>` : '<p class="mut">다가오는 일정이 없어요.</p>'}</section>`;
    h += `<section class="card"><h2>새 공고 추가</h2>${pasteForm(false)}<details><summary>예시 공고 다시 보기</summary><div class="grid2">${SAMPLES.notices.map(n => `<button class="btn ghost" type="button" data-act="sample" data-id="${n.id}">${n.id === 's1' ? '예시 1 · 우편' : '예시 2 · 이메일'}</button>`).join('')}</div></details></section>`;
    h += passCard();
    return h;
  }
  function tourCard() {
    const s1 = S.applications.find(a => a.sample && /보드게임/.test(a.program)) || S.applications[0];
    return `<section class="card" style="border-color:#F2A541"><h2>예시 둘러보기</h2><ol class="steps">
<li><a href="#/app/${s1.id}">예시초등학교 상세</a>: 우편 도착분 11/17(화) 17:00 → <b>11/13(금) 발송 권장</b></li>
<li><a href="#/timetable">시간표</a>: 화요일 빨간 겹침, 주황 이동시간 부족, 수요일 면접-수업 충돌</li>
<li><a href="#/docs">서류</a>: 채용신체검사서가 2027-03-02 계약 전에 만료</li></ol>
<div class="grid2"><button class="btn ghost" type="button" data-act="tourdone">둘러보기 닫기</button><button class="btn danger" type="button" data-act="clearsample">예시 지우기</button></div></section>`;
  }
  function passCard() {
    const n = S.settings.seasonPassInterest;
    return `<section class="card"><h2>시즌 패스(준비 중)</h2><p class="small">무제한 지원 건·.ics 일괄·조합 비교·제안서 체크·현황표 인쇄를 묶은 12~3월 시즌 패스를 검토 중이에요(가격 미정, 가설). 지금은 모든 기능이 무료이고 결제는 없어요.</p>
<button class="btn ghost" type="button" data-act="pass" style="width:100%">시즌 패스 관심 있어요</button><p class="small mut" id="pass-count">${n ? `이 기기에서 <span class="num">${n}번</span> 눌렀어요. 메일 주소 등은 받지 않아요.` : '누르면 이 기기에만 횟수가 기록돼요.'}</p></section>`;
  }

  /* ---------- 추출 확인 · 입력 폼 ---------- */
  function fieldSummary(p) {
    const f = p.fields; if (!f) return '';
    const conf = x => (!x ? need('못 찾음') : x.confidence !== 'high' || (x.flags && x.flags.length) ? need(x.flags && x.flags[0]) : '<span class="chip ok">찾음</span>');
    const pay = f.pay || {};
    return `<dl class="kv">
<dt>학교</dt><dd>${esc(f.school.value) || '—'} ${conf(f.school.value ? f.school : null)}</dd>
<dt>프로그램</dt><dd>${esc(f.program.value) || '—'} ${f.program.value ? '' : need('못 찾음')}</dd>
<dt>접수 마감</dt><dd>${f.deadline ? fdt(f.deadline.date, f.deadline.time) : '—'} ${conf(f.deadline)}</dd>
${f.postArrival ? `<dt>우편 도착분</dt><dd>${fdt(f.postArrival.date, f.postArrival.time)} ${conf(f.postArrival)}</dd>` : ''}
<dt>제출 방법</dt><dd>${f.methods.length ? f.methods.map(m => esc(CG.METHODS[m])).join(', ') : '—'}${f.bannedMethods.length ? ` <span class="chip red">불가: ${f.bannedMethods.map(b => ({ post: '우편', visit: '방문', email: '이메일' }[b] || b)).join('·')}</span>` : ''} ${f.methods.length ? '' : need('못 찾음')}</dd>
<dt>면접</dt><dd>${f.interview ? fdt(f.interview.date, f.interview.time) : '—'} ${f.interview ? conf(f.interview) : ''}</dd>
<dt>수업</dt><dd>${f.slots.length ? f.slots.map(s => `<span class="num">${CG.DAY_KO[s.day]} ${s.start}~${s.end}</span>`).join(', ') : '—'} ${f.slots.length ? '' : need('못 찾음')}</dd>
<dt>강사료</dt><dd>${pay.type ? (pay.type === 'hourly' ? `${won(pay.amount)} / ${esc(pay.unitWord || '차시')}` : `1인 월 ${won(pay.amount)}${pay.sharePct != null ? ` · 강사 <span class="num">${pay.sharePct}%</span>` : ''}`) : '—'} ${pay.type ? '' : need('직접 입력')}</dd>
<dt>서류</dt><dd><span class="num">${f.docs.length}개</span> ${f.docs.length ? '' : need('못 찾음')}<br><span class="small">${f.docs.map(k => esc(rule(k).label)).join(', ')}</span></dd></dl>`;
  }
  function vReview() {
    const d = restoreDraft();
    if (!d) return `<h1>공고 추출 확인</h1><div class="card empty"><p class="ico" aria-hidden="true">📋</p><p>확인할 공고가 없어요. 홈에서 공고문을 붙여 넣거나 예시로 시작하세요.</p><a class="btn" href="#/">홈으로</a></div>`;
    const p = d.p;
    let h = `<h1>공고 추출 확인</h1>`;
    if (p.ok) h += `<p class="alert ok" role="status">자동으로 읽었어요. <b>노란 ‘확인 필요’ 칸</b>은 공고 원문과 비교해 아래 칸에서 고쳐 주세요. 최종 기준은 학교 공고문이에요.</p>`;
    else h += `<div class="alert red" role="alert"><p><b>자동 추출 실패:</b> ${esc(p.reason)}</p><p>공고에서 <b>‘접수 기간’ ‘접수 방법’ ‘운영 시간’ ‘제출 서류’</b> 줄을 찾아 아래 칸에 직접 넣으면 저장할 수 있어요. HWP·PDF는 글만 복사해 붙여 넣으면 더 잘 읽혀요.</p></div>`;
    if (d.sample) h += `<p class="chip warn">예시 데이터</p>`;
    if (/(?<!\d)\d{6}\s*-?\s*[1-8]\d{6}(?!\d)/.test(d.text)) h += `<p class="alert warn">주민등록번호처럼 보이는 숫자를 가려서 저장해요.</p>`;
    if (p.warnings.length) h += `<div class="alert warn"><p><b>확인할 점</b></p><ul>${p.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    if (p.fields) h += `<section class="card"><h2>추출 카드</h2>${fieldSummary(p)}</section>`;
    h += `<section class="card"><h2>저장 전 수정</h2>${appForm(d.app, 'review')}</section>`;
    h += `<details><summary>붙여 넣은 공고 원문</summary><div><pre class="raw">${esc(mask(d.text))}</pre></div></details>`;
    return h;
  }
  function slotRow(s, i) {
    return `<div class="slotrow" data-slot>
<label class="field" style="margin:0"><span class="small">요일</span><select name="slot_day" aria-label="수업 ${i + 1} 요일">${DAYS.map(d => `<option value="${d}"${s.day === d ? ' selected' : ''}>${CG.DAY_KO[d]}</option>`).join('')}</select></label>
<label class="field" style="margin:0"><span class="small">시작</span><input type="time" name="slot_start" value="${esc(s.start)}" aria-label="수업 ${i + 1} 시작"></label>
<label class="field" style="margin:0"><span class="small">끝</span><input type="time" name="slot_end" value="${esc(s.end)}" aria-label="수업 ${i + 1} 끝"></label>
<button class="btn danger" type="button" data-act="slotdel" aria-label="수업 ${i + 1} 삭제">✕</button></div>`;
  }
  function appForm(a, mode) {
    const v = x => (x == null ? '' : esc(x)), p = a.pay || {};
    const docOpts = R.docs.map(r => `<label class="check"><input type="checkbox" name="doc" value="${r.key}"${(a.requiredDocs || []).includes(r.key) ? ' checked' : ''}> ${esc(r.label)}</label>`).join('');
    return `<form id="app-form" data-mode="${mode}" novalidate>
<div id="form-err" class="alert red" role="alert" hidden></div>
<label class="field"><span>학교명 (필수)</span><input name="school" maxlength="40" value="${v(a.school)}" autocomplete="off" required></label>
<label class="field"><span>프로그램</span><input name="program" maxlength="40" value="${v(a.program)}" autocomplete="off"></label>
<label class="field"><span>제출 방법</span><select name="submitMethod"><option value="">고르세요</option>${Object.entries(CG.METHODS).map(([k, l]) => `<option value="${k}"${a.submitMethod === k ? ' selected' : ''}>${l}</option>`).join('')}</select><span class="hint">우편·방문 둘 다 되면 실제로 낼 방법을 고르세요. 우편 도착분이면 발송 권장일을 따로 계산해요.</span></label>
<div class="inline2"><label class="field"><span>접수 마감일 (필수)</span><input type="date" name="deadline_date" value="${v(a.deadline && a.deadline.date)}" required></label>
<label class="field"><span>마감 시각</span><input type="time" name="deadline_time" value="${v(a.deadline && a.deadline.time)}"></label></div>
<div class="inline2"><label class="field"><span>우편 도착분 마감</span><input type="date" name="post_date" value="${v(a.postArrival && a.postArrival.date)}"></label>
<label class="field"><span>도착분 시각</span><input type="time" name="post_time" value="${v(a.postArrival && a.postArrival.time)}"></label></div>
<div class="inline2"><label class="field"><span>면접·시연일</span><input type="date" name="iv_date" value="${v(a.interview && a.interview.date)}"></label>
<label class="field"><span>면접 시각</span><input type="time" name="iv_time" value="${v(a.interview && a.interview.time)}"></label></div>
<div class="inline2"><label class="field"><span>면접 예상 길이(분)</span><input type="number" inputmode="numeric" name="iv_dur" min="10" max="240" value="${v(a.interview && a.interview.duration || 60)}"></label>
<label class="field"><span>결과 발표일</span><input type="date" name="resultAt" value="${v(a.resultAt)}"></label></div>
<fieldset class="card" style="margin:10px 0"><legend><b>수업 요일·시간</b> (합격 시)</legend><div id="slots">${(a.slots || []).map(slotRow).join('')}</div>
<button class="btn ghost sm" type="button" data-act="slotadd">수업 시간 추가</button></fieldset>
<fieldset class="card" style="margin:10px 0"><legend><b>강사료(직접 입력한 추정)</b></legend>
<label class="field"><span>유형</span><select name="pay_type"><option value="">모름·나중에</option><option value="hourly"${p.type === 'hourly' ? ' selected' : ''}>강사료(차시·시간당)</option><option value="per_student"${p.type === 'per_student' ? ' selected' : ''}>수강료 1인 월 × 인원</option></select></label>
<div class="inline2"><label class="field"><span>금액(원)</span><input type="number" inputmode="numeric" name="pay_amount" min="0" max="100000000" value="${v(p.amount)}"></label>
<label class="field"><span>기준</span><select name="pay_unit"><option value="session"${p.unit !== 'hour60' ? ' selected' : ''}>1차시(1회)당</option><option value="hour60"${p.unit === 'hour60' ? ' selected' : ''}>60분당</option></select></label></div>
<div class="inline2"><label class="field"><span>주 회차</span><input type="number" inputmode="numeric" name="pay_spw" min="1" max="10" value="${v(p.sessionsPerWeek)}"></label>
<label class="field"><span>학기 주수</span><input type="number" inputmode="numeric" name="pay_weeks" min="1" max="60" value="${v(p.weeks)}"></label></div>
<div class="inline3"><label class="field"><span>예상 인원</span><input type="number" inputmode="numeric" name="pay_students" min="1" max="500" value="${v(p.students)}"></label>
<label class="field"><span>개월</span><input type="number" inputmode="numeric" name="pay_months" min="1" max="24" value="${v(p.months)}"></label>
<label class="field"><span>강사 몫 %</span><input type="number" inputmode="numeric" name="pay_share" min="0" max="100" value="${v(p.sharePct)}"></label></div>
<p class="hint">앱은 넣은 값으로 곱셈만 해요. 실제 지급액·수강 인원은 학교·계약에 따라 달라요(보장 아님).</p></fieldset>
<fieldset class="card" style="margin:10px 0"><legend><b>필요 서류</b></legend>${docOpts}</fieldset>
<label class="field"><span>메모</span><textarea name="notes" maxlength="1000" rows="3" placeholder="담당자, 서식 파일 위치 등. 주민등록번호는 적지 마세요.">${v(a.notes)}</textarea></label>
<div class="grid2"><button class="btn" type="submit">${mode === 'edit' ? '고친 내용 저장' : '저장하기'}</button><a class="btn ghost" href="${mode === 'edit' ? '#/app/' + a.id : '#/'}">취소</a></div></form>`;
  }
  function readForm(form, base) {
    const g = n => (form.elements[n] ? form.elements[n].value.trim() : '');
    const errs = [], bad = [];
    const err = (name, msg) => { errs.push(msg); bad.push(name); };
    const num = (n, lo, hi, label) => { const s = g(n); if (s === '') return null; const x = Number(s); if (!isFinite(x) || x < lo || x > hi) { err(n, `${label}은(는) ${lo}~${hi} 사이 숫자로 넣어 주세요.`); return null; } return x; };
    const a = JSON.parse(JSON.stringify(base));
    a.school = g('school'); a.program = g('program');
    if (!a.school) err('school', '학교명을 넣어 주세요.');
    for (const n of ['school', 'program', 'notes']) if (CG.rrnLike(g(n))) err(n, '주민등록번호처럼 보이는 숫자는 저장할 수 없어요. 지워 주세요.');
    a.submitMethod = g('submitMethod');
    const dd = g('deadline_date');
    if (!okDate(dd)) err('deadline_date', '접수 마감일을 넣어 주세요(공고의 ‘접수 기간’ 끝 날짜).');
    a.deadline = okDate(dd) ? { date: dd, time: g('deadline_time') } : null;
    a.postArrival = okDate(g('post_date')) ? { date: g('post_date'), time: g('post_time') } : null;
    if (a.submitMethod === 'post_arrival' && !a.postArrival && a.deadline) a.postArrival = { ...a.deadline };
    a.interview = okDate(g('iv_date')) ? { date: g('iv_date'), time: g('iv_time'), duration: num('iv_dur', 10, 240, '면접 길이') || 60 } : null;
    a.resultAt = okDate(g('resultAt')) ? g('resultAt') : '';
    a.slots = [];
    $$('[data-slot]', form).forEach((row, i) => {
      const s = { day: row.querySelector('[name=slot_day]').value, start: row.querySelector('[name=slot_start]').value, end: row.querySelector('[name=slot_end]').value };
      if (!s.start && !s.end) return;
      if (!okTime(s.start) || !okTime(s.end) || s.end <= s.start) { errs.push(`수업 ${i + 1}: 끝 시각이 시작보다 늦어야 해요.`); bad.push('slot_start'); return; }
      a.slots.push(s);
    });
    a.pay = { type: g('pay_type'), amount: num('pay_amount', 0, 100000000, '금액'), unit: g('pay_unit') === 'hour60' ? 'hour60' : 'session', sessionsPerWeek: num('pay_spw', 1, 10, '주 회차'), weeks: num('pay_weeks', 1, 60, '학기 주수'), students: num('pay_students', 1, 500, '예상 인원'), months: num('pay_months', 1, 24, '개월'), sharePct: num('pay_share', 0, 100, '강사 몫') };
    a.requiredDocs = $$('input[name=doc]:checked', form).map(x => x.value);
    a.notes = g('notes');
    return { a, errs, bad };
  }

  /* ---------- 지원 상세 ---------- */
  function calcCard(a) {
    const c = calc(a);
    if (c.error) return `<section class="card"><h2>마감 역산</h2><p class="alert red" role="alert">${esc(c.error)}</p><a class="btn ghost sm" href="#/edit/${a.id}">정보 고치기</a></section>`;
    const st = c.state === 'past' ? '<span class="chip red">마감 지남</span>' : c.state === 'late_send' ? '<span class="chip red">발송 권장일 지남</span>' : `<span class="chip ${c.deadlineDday <= 3 ? 'red' : c.deadlineDday <= 7 ? 'warn' : 'ok'} num">${ddText(c.deadlineDday)}</span>`;
    return `<section class="card" id="calc"><h2>마감 역산 ${st}</h2><dl class="kv">
<dt>제출 방법</dt><dd>${esc(CG.METHODS[a.submitMethod] || '미정')}</dd>
<dt>${a.submitMethod === 'post_arrival' ? '도착분 마감' : '접수 마감'}</dt><dd>${fdt(c.deadlineDate, c.deadlineTime)}</dd>
${c.sendBy ? `<dt>발송 권장</dt><dd><b>${fd(c.sendBy)}까지</b> <span class="chip num">${ddText(c.dday)}</span></dd>` : ''}
${c.remindAt ? `<dt>알림 권장</dt><dd>${fdt(c.remindAt.date, c.remindAt.time)}</dd>` : ''}</dl>
${c.warnings.map(w => `<p class="alert warn">${esc(w)}</p>`).join('')}
<ul class="small">${c.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="src">공휴일: <a href="${esc(H.sources[0])}" target="_blank" rel="noopener">우주항공청 2027년 월력요항</a> (확인 ${esc(H.checked)}) · 최종 기준은 학교 공고문</p>
<button class="btn ghost" type="button" data-act="ics" data-id="${a.id}" style="width:100%">이 지원 건 캘린더(.ics) 받기</button></section>`;
  }
  function docsCard(a) {
    const ms = missing(a), V = vault(), cx = ctx();
    const req = a.requiredDocs.map(rule).filter(Boolean);
    let h = `<section class="card" id="docs"><h2>필요 서류 대조 ${ms.length ? `<span class="chip red num">누락 ${ms.length}</span>` : req.length ? '<span class="chip ok">누락 없음</span>' : ''}</h2>`;
    if (ms.length) h += `<p class="alert red">누락 ${ms.length}: ${ms.map(m => esc(m.label)).join(', ')}</p>`;
    if (!req.length) h += `<p class="mut">필요 서류를 고르지 않았어요. <a href="#/edit/${a.id}">수정</a>에서 체크하세요.</p>`;
    h += '<ul class="list">' + req.map(r => {
      if (r.scope === 'per_application') return `<li><label class="check"><input type="checkbox" data-bind="prepared" data-key="${r.key}"${a.prepared[r.key] ? ' checked' : ''}> ${esc(r.label)} <span class="small mut">(이 학교용 준비)</span></label></li>`;
      const s = CG.docStatus(V[r.key], r, cx), cls = { valid: 'ok', soon: 'warn', check: 'warn', unknown: 'warn', none: 'red', expired: 'red', expires_before_contract: 'red', needs_tb: 'red' }[s.status];
      return `<li><b>${esc(r.label)}</b> <span class="chip ${cls}">${esc(s.text)}</span> <a class="small" href="#/docs">서류 금고</a></li>`;
    }).join('') + '</ul>';
    const cr = rule('crime_report');
    h += `<h3>범죄경력회보서 인쇄 마감</h3><p class="small">${esc(cr.note)}</p><label class="field"><span>이 학교 기준 신청일</span><input type="date" id="crime-${a.id}" data-bind="crime" value="${esc(a.crimeCheckRequestedAt)}"></label>`;
    if (a.crimeCheckRequestedAt) { const cp = CG.crimePrint(a.crimeCheckRequestedAt, cr); h += `<p class="alert ${cp.conservative < TODAY() ? 'red' : 'warn'}">신청일 + 5일 = <b>${fd(cp.plusDays)}</b>. 기간 계산 방식(신청 당일 포함 여부)은 ${need()} — 안전하게 <b>${fd(cp.conservative)}</b>까지 인쇄하세요.</p>`; }
    h += `<p class="src">출처: ${srcLink('chungnam')} (확인 ${esc(R.checked)})</p></section>`;
    return h;
  }
  function conflictCard(a) {
    const cf = allConflicts(true);
    const mine = cf.overlaps.filter(o => o.a.appId === a.id || o.b.appId === a.id), tr = cf.travelIssues.filter(o => o.a.appId === a.id || o.b.appId === a.id);
    const iv = cf.iv.map((x, i) => ({ x, i })).filter(o => o.x.app.id === a.id);
    let h = `<section class="card" id="conf"><h2>시간 겹침</h2>`;
    if (!a.slots.length && !a.interview) return h + '<p class="mut">수업 시간·면접일을 넣으면 겹침을 확인해요.</p></section>';
    if (!mine.length && !tr.length && !iv.length) h += `<p class="alert ok">현재 수업·다른 지원 건과 겹치지 않아요${S.currentClasses.length ? '' : '(지금 하는 수업이 아직 없어요)'}.</p>`;
    h += mine.map(o => `<p class="alert red">겹침: ${CG.DAY_KO[o.day]} ${esc(o.a.school)} <span class="num">${hm(o.a.start)}~${hm(o.a.end)}</span> ↔ ${esc(o.b.school)} <span class="num">${hm(o.b.start)}~${hm(o.b.end)}</span> (<span class="num">${o.minutes}분</span>)</p>`).join('');
    h += tr.map(o => `<p class="alert warn">이동시간 부족: ${CG.DAY_KO[o.day]} ${esc(o.a.school)} → ${esc(o.b.school)} 간격 <span class="num">${o.gap}분</span> &lt; 이동 <span class="num">${o.need}분</span></p>`).join('');
    h += iv.map(({ x, i }) => `<div class="alert red"><p>면접 ${fdt(x.date, x.start)}~<span class="num">${x.end}</span>이 ${esc(x.cls.school)} 수업(<span class="num">${x.cls.start}~${x.cls.end}</span>)과 겹쳐요${x.withTravel ? '(이동시간 포함)' : ''}.</p><button class="btn ghost sm" type="button" data-act="copyreq" data-i="${i}">시간 조정 요청 문구 복사</button></div>`).join('');
    return h + `<a class="btn ghost sm" href="#/timetable">주간 시간표 보기</a></section>`;
  }
  function proposalPanel(a) {
    const body = a.proposalText || S.proposalBase, pc = CG.proposalCheck(body, a, S.applications);
    let h = '';
    if (!body.trim()) return '<p class="mut">본문을 붙여 넣으면 다른 학교 이름이 남았는지 찾아요.</p>';
    h += pc.foreign.length ? `<p class="alert red" role="alert">다른 지원 건 학교명이 남아 있어요: <b>${pc.foreign.map(esc).join(', ')}</b> — 이 학교 이름으로 바꾸세요.</p>` : '<p class="alert ok">다른 지원 건 학교명은 보이지 않아요.</p>';
    if (pc.ownMissing) h += `<p class="alert warn">본문에 이 학교 이름(${esc(a.school)})이 없어요.</p>`;
    h += `<p class="small mut">${a.proposalText ? '이 학교용 본문' : '기본안'}을 검사했어요.</p>`;
    return h;
  }
  function proposalCard(a) {
    const sess = a.sessions.length ? a.sessions : Array(12).fill('');
    return `<section class="card" id="prop"><h2>제안서 변형 체크</h2>
<details${S.proposalBase ? '' : ' open'}><summary>기본안(모든 지원 건 공통)</summary><div><label class="field" for="pbase"><span>기본안 붙여 넣기</span></label><textarea id="pbase" data-bind="pbase" rows="5">${esc(S.proposalBase)}</textarea></div></details>
<label class="field" for="ptext-${a.id}"><span>이 학교용 본문(선택)</span><span class="hint">비워 두면 기본안을 검사해요.</span></label><textarea id="ptext-${a.id}" data-bind="ptext" rows="5">${esc(a.proposalText)}</textarea>
<div class="grid2" style="margin-top:8px"><button class="btn ghost sm" type="button" data-act="pcopybase" data-id="${a.id}">기본안 불러오기</button><button class="btn ghost sm" type="button" data-act="pcopy" data-id="${a.id}">본문 복사</button></div>
<div id="prop-check" aria-live="polite">${proposalPanel(a)}</div>
<h3>바꿔야 할 칸</h3>${PCHECK.map(([k, l]) => `<label class="check"><input type="checkbox" data-bind="pcheck" data-key="${k}"${a.proposalChecks[k] ? ' checked' : ''}> ${l}</label>`).join('')}
<h3>차시 계획표</h3><div id="sess">${sess.map((s, i) => `<div class="sess"><span class="no num">${i + 1}</span><input aria-label="${i + 1}차시 내용" data-bind="sess" data-i="${i}" value="${esc(s)}" maxlength="120"><button class="btn danger" type="button" data-act="sessdel" data-i="${i}" aria-label="${i + 1}차시 삭제">✕</button></div>`).join('')}</div>
<div class="grid2"><button class="btn ghost sm" type="button" data-act="sessadd">차시 추가</button><button class="btn ghost sm" type="button" data-act="sesscopy">차시표 복사</button></div></section>`;
  }
  function interviewCard(a) {
    const ph = '예) 안전사고 대처 / 수준 차이 큰 학생 지도 / 다른 학교 수업과 일정이 겹칠 때';
    return `<section class="card" id="iv"><h2>면접 카드</h2>
<p>${a.interview ? `면접·시연 ${fdt(a.interview.date, a.interview.time)} (<span class="num">${a.interview.duration}분</span> 예상)` : '면접일 미정 — 공고·통보를 확인하세요.'}</p>
<label class="field"><span>장소</span><input data-bind="place" maxlength="100" value="${esc(a.place)}"></label>
<label class="field"><span>준비물</span><input data-bind="items" maxlength="300" value="${esc(a.items)}" placeholder="예) 시연 교구, 신분증"></label>
<label class="field"><span>예상 질문 메모</span><textarea data-bind="questions" rows="4" maxlength="2000" placeholder="${ph}">${esc(a.questions)}</textarea></label>
<h3>타이머</h3><div class="timer"><span class="clock num" id="clock" role="timer" aria-live="off">00:00</span>
<button class="btn ghost sm" type="button" data-act="timer" data-min="3">자기소개 3분</button><button class="btn ghost sm" type="button" data-act="timer" data-min="5">시연 5분</button><button class="btn ghost sm" type="button" data-act="timer" data-min="10">시연 10분</button><button class="btn danger sm" type="button" data-act="timerstop">멈춤</button></div><p id="timer-msg" class="small mut" aria-live="polite"></p></section>`;
  }
  function vApp(id) {
    const a = findApp(id);
    if (!a) return notFound('지원 건을 찾지 못했어요. 지워졌거나 다른 기기 데이터일 수 있어요.');
    const inc = CG.appIncome(a);
    return `<p class="small"><a href="#/apps">← 지원 보드</a></p><h1>${esc(a.school)}${a.program ? ` <span class="mut" style="font-size:1rem">${esc(a.program)}</span>` : ''}</h1>
${a.sample ? '<p><span class="chip warn">예시 데이터</span></p>' : ''}
<section class="card"><h2>지원 상태</h2><div class="statusgrid" role="group" aria-label="지원 상태">${CG.STATUSES.map(([k, l]) => `<button class="btn" type="button" data-act="status" data-k="${k}" aria-pressed="${a.status === k}">${l}</button>`).join('')}</div></section>
${calcCard(a)}${docsCard(a)}${conflictCard(a)}
<section class="card"><h2>학기 예상 수입</h2>${inc.amount != null ? `<p><b style="font-size:1.3rem">${won(inc.amount)}</b></p><p class="small mut">${esc(inc.formula)} — 직접 넣은 값의 추정이에요. 보장 아님.</p>` : `<p class="mut">${esc(inc.why)}</p>`}<a class="btn ghost sm" href="#/edit/${a.id}">강사료 수정</a></section>
${proposalCard(a)}${interviewCard(a)}
${a.rawText ? `<details><summary>공고 원문</summary><div><pre class="raw">${esc(a.rawText)}</pre></div></details>` : ''}
${a.notes ? `<section class="card"><h2>메모</h2><p>${esc(a.notes)}</p></section>` : ''}
<div class="grid2"><a class="btn ghost" href="#/edit/${a.id}">정보 수정</a><button class="btn danger" type="button" data-act="delapp" data-id="${a.id}">지원 건 삭제</button></div>`;
  }
  function vEdit(id, isNew) {
    const a = isNew ? appFromParse({ fields: {} }, '') : findApp(id);
    if (!a) return notFound('지원 건을 찾지 못했어요.');
    if (isNew) { draft = { text: '', p: { ok: true, warnings: [] }, app: a, manual: true }; }
    return `<h1>${isNew ? '지원 건 직접 입력' : esc(a.school) + ' 수정'}</h1>${isNew ? '<p class="mut">공고를 보며 마감일·제출 방법·수업 시간만 넣어도 역산과 겹침을 볼 수 있어요.</p>' : ''}<section class="card">${appForm(a, isNew ? 'review' : 'edit')}</section>`;
  }

  /* ---------- 지원 보드 ---------- */
  function vApps() {
    let h = `<h1>지원 보드</h1>`;
    if (!S.applications.length) return h + `<div class="card empty"><p class="ico" aria-hidden="true">🗂️</p><p>아직 지원 건이 없어요.<br>홈에서 공고를 붙여 넣거나 예시로 시작하세요.</p><div class="grid2"><a class="btn" href="#/">공고 붙여 넣기</a><button class="btn ghost" type="button" data-act="season">예시 시즌</button></div></div>`;
    const cf = allConflicts(true), t = TODAY();
    const conflictIds = new Set([...cf.overlaps.flatMap(o => [o.a.appId, o.b.appId]), ...cf.iv.map(x => x.app.id)].filter(Boolean));
    h += `<div class="grid2 noprint"><a class="btn" href="#/">새 공고</a><button class="btn ghost" type="button" data-act="icsall">전체 .ics</button></div><p><a href="#/print">지원 현황표(인쇄용) 보기</a></p>`;
    for (const [k, l] of CG.STATUSES) {
      const xs = S.applications.filter(a => a.status === k);
      if (!xs.length) continue;
      h += `<h2>${l} <span class="chip num">${xs.length}</span></h2>` + xs.map(a => {
        const c = calc(a), ms = missing(a).length;
        const n = c.error ? null : c.deadlineDday;
        const cls = n == null ? '' : n < 0 ? '' : n <= 3 ? 'late' : n <= 7 ? 'soon' : '';
        return `<a class="appcard ${cls}" href="#/app/${a.id}"><span class="t">${esc(a.school)} <span class="mut" style="font-weight:500">${esc(a.program)}</span></span><span class="m">${c.error ? '<span class="chip warn">마감 확인 필요</span>' : `<span class="chip ${n < 0 ? '' : n <= 3 ? 'red' : n <= 7 ? 'warn' : 'ok'} num">${n < 0 ? '마감 지남' : ddText(n)}</span> 마감 ${fd(c.deadlineDate)}`}${ms ? ` <span class="chip red num">누락 ${ms}</span>` : ''}${conflictIds.has(a.id) ? ' <span class="chip red">⚠ 겹침</span>' : ''}${a.sample ? ' <span class="chip">예시</span>' : ''}</span></a>`;
      }).join('');
    }
    void t;
    return h;
  }

  /* ---------- 시간표 ---------- */
  function vTimetable() {
    const inc = S.settings.includeApps, cf = allConflicts(inc);
    const ds = CG.time(S.settings.dayStart), de = CG.time(S.settings.dayEnd), px = 1.1, height = (de - ds) * px;
    const bad = new Set(cf.overlaps.flatMap(o => [o.a.id, o.b.id]));
    let out = 0;
    const col = d => cf.items.filter(i => i.day === d).map(i => {
      const top = Math.max(i.start, ds), bot = Math.min(i.end, de);
      if (bot <= top) { out++; return ''; }
      return `<div class="blk ${bad.has(i.id) ? 'bad' : i.kind === 'current' ? 'cur' : 'app'}" style="top:${(top - ds) * px}px;height:${(bot - top) * px}px">${esc(i.school)}</div>`;
    }).join('');
    let hrs = ''; for (let m = Math.ceil(ds / 60) * 60; m <= de; m += 60) hrs += `<span style="top:${(m - ds) * px}px">${m / 60}</span>`;
    let h = `<h1>주간 시간표·겹침</h1>
<div class="seg" role="group" aria-label="표시 범위"><button class="btn" type="button" data-act="inc" data-v="0" aria-pressed="${!inc}">현재 수업만</button><button class="btn" type="button" data-act="inc" data-v="1" aria-pressed="${inc}">합격 가정 포함</button></div>
<div class="legend" aria-hidden="true"><span><i style="background:#D6E8DC;border:1px solid #7FB08F"></i>현재 수업</span><span><i style="background:#FCE3BC;border:1px dashed #B87914"></i>지원 건</span><span><i style="background:#F8CFCF;border:2px solid #D64545"></i>겹침</span></div>
<div class="tt" aria-hidden="true"><div></div>${DAYS.map(d => `<div class="hd">${CG.DAY_KO[d]}</div>`).join('')}<div class="hrs" style="height:${height}px">${hrs}</div>${DAYS.map(d => `<div class="col" style="height:${height}px">${col(d)}</div>`).join('')}</div>
${out ? `<p class="small alert warn">표시 범위(${S.settings.dayStart}~${S.settings.dayEnd}) 밖 수업 ${out}개 — 설정에서 범위를 바꿀 수 있어요.</p>` : ''}
<section class="card"><h2>요일별 목록</h2>${cf.items.length ? `<ul class="list">${DAYS.map(d => { const xs = cf.items.filter(i => i.day === d).sort((a, b) => a.start - b.start); return xs.length ? `<li><b>${CG.DAY_KO[d]}</b> ${xs.map(i => `<span class="num">${hm(i.start)}~${hm(i.end)}</span> ${esc(i.school)}${i.kind === 'app' ? '(지원)' : ''}${bad.has(i.id) ? ' <span class="chip red">겹침</span>' : ''}`).join(' · ')}</li>` : ''; }).join('')}</ul>` : '<p class="mut">아직 수업이 없어요. 아래에서 지금 하는 수업을 넣거나 지원 건에 수업 시간을 넣으세요.</p>'}</section>`;
    h += `<section class="card"><h2>충돌 경고</h2>`;
    if (!cf.overlaps.length && !cf.travelIssues.length && !cf.iv.length && !cf.missingTravel.length) h += '<p class="alert ok">겹침·이동시간 부족·면접 충돌이 없어요.</p>';
    h += cf.overlaps.map(o => `<p class="alert red">겹침 · ${CG.DAY_KO[o.day]} ${esc(o.a.school)} <span class="num">${hm(o.a.start)}~${hm(o.a.end)}</span> ↔ ${esc(o.b.school)} <span class="num">${hm(o.b.start)}~${hm(o.b.end)}</span></p>`).join('');
    h += cf.travelIssues.map(o => `<p class="alert warn">이동시간 부족 · ${CG.DAY_KO[o.day]} ${esc(o.a.school)} → ${esc(o.b.school)}: 간격 <span class="num">${o.gap}분</span>, 이동 <span class="num">${o.need}분</span></p>`).join('');
    h += cf.missingTravel.map(o => `<p class="alert info">이동시간 미입력 · ${CG.DAY_KO[o.day]} ${esc(o.a.school)} → ${esc(o.b.school)} (간격 <span class="num">${o.gap}분</span>) — 아래 이동시간 표에 넣어 주세요.</p>`).join('');
    h += cf.iv.map((x, i) => `<div class="alert red"><p>면접 충돌 · ${esc(x.app.school)} 면접 ${fdt(x.date, x.start)}~<span class="num">${x.end}</span> ↔ ${esc(x.cls.school)} 수업 <span class="num">${x.cls.start}~${x.cls.end}</span>${x.withTravel ? '(이동시간 포함)' : ''}</p><button class="btn ghost sm" type="button" data-act="copyreq" data-i="${i}">시간 조정 요청 문구 복사</button></div>`).join('');
    h += '</section>';
    const cb = CG.combos(S.applications, S.currentClasses, S.travel, 3);
    h += `<section class="card"><h2>동시 합격 조합 상위 3</h2><p class="small mut">불합격 제외 지원 건 중 서로·현재 수업과 겹치지 않는 조합을 학기 예상 수입순으로 보여 줘요. 수입은 직접 넣은 값의 추정(보장 아님).</p>`;
    h += cb.top.length ? cb.top.map((c, i) => `<div class="combo"><p><b>${i + 1}.</b> ${c.apps.map(a => esc(a.school)).join(' + ')}</p><p class="inc">${won(c.income)}${c.unknown ? ` <span class="chip warn num">수입 미입력 ${c.unknown}</span>` : ''}</p><p class="small">주 <span class="num">${Math.round(c.weeklyMinutes)}분</span> 수업 · 이동 <span class="num">${c.travelMinutes}분</span>/주${c.travelShort ? ` · <span class="chip warn">이동 부족 ${c.travelShort}</span>` : ''}</p></div>`).join('') + `<p class="small mut">가능한 조합 <span class="num">${cb.total}개</span>${cb.capped ? ' · 지원 건 14개까지만 계산' : ''}</p>` : '<p class="mut">수업 시간이 있는 지원 건이 없어요.</p>';
    h += '</section>';
    const schools = [...new Set([...S.currentClasses.map(c => c.school), ...S.applications.map(a => a.school)])];
    h += `<section class="card"><h2>지금 하는 수업</h2>${S.currentClasses.length ? `<ul class="list">${S.currentClasses.map(c => `<li class="row" style="justify-content:space-between"><span>${CG.DAY_KO[c.day]} <span class="num">${c.start}~${c.end}</span> ${esc(c.school)} ${esc(c.program)}</span><button class="btn danger sm" type="button" data-act="delclass" data-id="${c.id}" aria-label="${esc(c.school)} ${CG.DAY_KO[c.day]} 수업 삭제">삭제</button></li>`).join('')}</ul>` : '<p class="mut">계약 중인 수업을 넣으면 면접·새 수업과의 겹침을 알려 줘요.</p>'}
<form id="class-form" novalidate><datalist id="schools">${schools.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
<div id="class-err" class="alert red" role="alert" hidden></div>
<div class="inline2"><label class="field"><span>학교</span><input name="school" list="schools" maxlength="40" required></label><label class="field"><span>프로그램</span><input name="program" maxlength="40"></label></div>
<div class="inline3"><label class="field"><span>요일</span><select name="day">${DAYS.map(d => `<option value="${d}">${CG.DAY_KO[d]}</option>`).join('')}</select></label><label class="field"><span>시작</span><input type="time" name="start" required></label><label class="field"><span>끝</span><input type="time" name="end" required></label></div>
<button class="btn" type="submit" style="width:100%">수업 추가</button></form></section>`;
    h += `<section class="card" id="travel"><h2>학교 간 이동시간</h2>${S.travel.length ? `<ul class="list">${S.travel.map((t, i) => `<li class="row" style="justify-content:space-between"><span>${esc(t.from)} ↔ ${esc(t.to)} <b class="num">${t.minutes}분</b></span><button class="btn danger sm" type="button" data-act="deltravel" data-i="${i}" aria-label="${esc(t.from)}-${esc(t.to)} 이동시간 삭제">삭제</button></li>`).join('')}</ul>` : '<p class="mut">연속 수업 사이 이동시간을 넣으면 부족할 때 주황으로 알려 줘요.</p>'}
<form id="travel-form" novalidate><div id="travel-err" class="alert red" role="alert" hidden></div>
<div class="inline2"><label class="field"><span>출발 학교</span><input name="from" list="schools" maxlength="40" required></label><label class="field"><span>도착 학교</span><input name="to" list="schools" maxlength="40" required></label></div>
<label class="field"><span>이동시간(분)</span><input type="number" inputmode="numeric" name="minutes" min="0" max="300" required></label>
<button class="btn" type="submit" style="width:100%">이동시간 저장</button></form></section>`;
    return h;
  }

  /* ---------- 서류 금고 ---------- */
  function vDocs() {
    const cx = ctx(), V = vault();
    const vr = R.docs.filter(r => r.scope === 'vault'), pr = R.docs.filter(r => r.scope === 'per_application');
    const sts = vr.map(r => CG.docStatus(V[r.key], r, cx));
    const red = sts.filter(s => ['expired', 'expires_before_contract', 'needs_tb'].includes(s.status)).length, yel = sts.filter(s => ['soon', 'check', 'unknown'].includes(s.status)).length, grn = sts.filter(s => s.status === 'valid').length;
    let h = `<h1>서류 금고</h1><p class="alert info"><b>날짜만 기록해요.</b> 서류 파일은 올리지도 저장하지도 않아요. 주민등록번호 칸은 없어요. 규칙은 출처·기준일과 함께 보여 주며, <b>학교 공고가 다르면 공고를 따르세요.</b></p>
<div class="row" aria-label="신호등 요약"><span class="chip ok num">유효 ${grn}</span><span class="chip warn num">확인 ${yel}</span><span class="chip red num">문제 ${red}</span></div>
<label class="field"><span>계약 기준일(가정)</span><input type="date" data-bind="contract" value="${esc(S.settings.contractDate)}"><span class="hint">2027학년도 1학기 시작일로 잡은 기본값이에요. 학교별 계약일로 바꾸세요.</span></label>`;
    h += vr.map(r => {
      const d = S.docs.find(x => x.key === r.key), s = CG.docStatus(V[r.key], r, cx);
      const cls = { valid: 'ok', soon: 'warn', check: 'warn', unknown: 'warn', none: '', expired: 'red', expires_before_contract: 'red', needs_tb: 'red' }[s.status];
      const dl = r.validYears ? '검사일' : r.tbAfterYears ? '검진일' : '발급일(선택)';
      return `<section class="card" id="doc-${r.key}"><h2 style="margin-top:0">${esc(r.label)} <span class="chip ${cls}">${esc(s.text)}</span></h2>
<label class="check"><input type="checkbox" data-bind="dochave" data-key="${r.key}"${d ? ' checked' : ''}> 가지고 있어요</label>
${d ? `<label class="field"><span>${dl}</span><input type="date" data-bind="docdate" data-key="${r.key}" value="${esc(d.issuedAt)}"></label>${r.flag === 'pqi' ? `<label class="check"><input type="checkbox" data-bind="docpqi" data-key="${r.key}"${d.pqi ? ' checked' : ''}> 국가자격이거나 pqi.or.kr에 등록된 민간자격</label>` : ''}` : ''}
${s.lastValid ? `<p class="small">마지막 유효일(보수 계산): ${fd(s.lastValid)} — 검사일로부터 1년이 되는 날 하루 전까지로 잡았어요.</p>` : ''}
${r.note ? `<p class="small">${esc(r.note)}</p>` : ''}${r.source ? `<p class="src">출처: ${srcLink(r.source)} · 확인 ${esc(R.checked)}</p>` : `<p class="src">${need('학교 공고 기준')}</p>`}</section>`;
    }).join('');
    const cr = rule('crime_report');
    h += `<section class="card"><h2>범죄경력회보서 인쇄 마감 계산</h2><p class="small">${esc(cr.note)} 학교마다 따로 신청하므로 지원 상세에서 학교별 신청일을 넣어도 돼요.</p>
<label class="field"><span>신청일</span><input type="date" id="crime-any"></label><p id="crime-out" aria-live="polite"></p><p class="src">출처: ${srcLink('chungnam')} · 계산 방식 ${need()}</p></section>`;
    h += `<details><summary>학교 서식 서류(지원 건마다 따로)</summary><div><ul>${pr.map(r => `<li>${esc(r.label)}${r.note ? ` — <span class="small">${esc(r.note)}</span>` : ''}${r.source ? ` <span class="src">(${srcLink(r.source)})</span>` : ''}</li>`).join('')}</ul></div></details>`;
    return h;
  }

  /* ---------- 설정 ---------- */
  function vSettings() {
    const st = S.settings, srcs = Object.values(R.sources);
    return `<h1>설정·백업</h1>
<section class="card"><h2>계산 설정</h2><form id="set-form" novalidate><div id="set-err" class="alert red" role="alert" hidden></div>
<label class="field"><span>우편 여유 영업일</span><input type="number" inputmode="numeric" name="buf" min="0" max="15" value="${st.postalBufferBizDays}"><span class="hint">도착분 마감 앞으로 며칠(주말·공휴일 제외) 전에 보낼지. 기본 2는 이 앱이 정한 여유이고 규정이 아니에요.</span></label>
<div class="inline2"><label class="field"><span>시간표 시작</span><input type="time" name="ds" value="${st.dayStart}"></label><label class="field"><span>시간표 끝</span><input type="time" name="de" value="${st.dayEnd}"></label></div>
<label class="field"><span>계약 기준일(가정)</span><input type="date" name="cd" value="${st.contractDate}"></label>
<label class="field"><span>요청 문구에 넣을 이름(선택)</span><input name="teacher" maxlength="20" value="${esc(st.teacher)}" autocomplete="off"><span class="hint">이 기기에만 저장돼요.</span></label>
<button class="btn" type="submit" style="width:100%">설정 저장</button></form></section>
${passCard()}
<section class="card"><h2>백업·복원</h2><p class="small">기기를 바꿀 때 JSON 파일로 옮기세요. 파일에는 학교명·일정·메모가 들어 있어요.</p>
<div class="grid2"><button class="btn" type="button" data-act="export">백업 받기</button><button class="btn ghost" type="button" data-act="icsall">전체 .ics</button></div>
<label class="field"><span>백업 파일로 복원</span><input type="file" id="import" accept="application/json,.json"></label><p id="import-msg" aria-live="polite"></p>
<a class="btn ghost" href="#/print" style="width:100%">지원 현황표 인쇄</a></section>
<section class="card"><h2>데이터 지우기</h2><div class="grid2">${st.sampleLoaded ? '<button class="btn ghost" type="button" data-act="clearsample">예시만 지우기</button>' : '<button class="btn ghost" type="button" data-act="season">예시 시즌 넣기</button>'}<button class="btn danger" type="button" data-act="wipe">전체 삭제</button></div></section>
<section class="card"><h2>출처·면책</h2><p class="small">최종 기준은 <b>각 학교 공고문</b>이에요. 아래 규칙은 공개 자료에서 확인한 값이고, 학교·교육청마다 다를 수 있어요. 수입은 직접 넣은 추정치예요.</p>
<ul class="small">${srcs.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a> (확인 ${esc(R.checked)})</li>`).join('')}<li><a href="${esc(H.sources[0])}" target="_blank" rel="noopener">우주항공청 2027년 월력요항 · 공휴일</a> (확인 ${esc(H.checked)}, 범위 ${H.from}~${H.through})</li></ul>
<p class="small">${need()} 「결핵예방법」 조문 원문, 회보서 5일 기산 방식, 학교별 강사료 기준 — 학교 공고·담당자에게 확인하세요.</p>
<p class="links"><a href="privacy.html">개인정보 안내</a></p>
<button class="btn ghost sm" type="button" data-act="selftest">자체 점검 실행</button><p id="self-out" aria-live="polite"></p></section>`;
  }

  /* ---------- 인쇄 ---------- */
  function vPrint() {
    const rows = S.applications.map(a => { const c = calc(a), ms = missing(a), inc = CG.appIncome(a); return { a, c, ms, inc }; });
    return `<h1>지원 현황표</h1><p class="small mut">${fd(TODAY())} 기준 · 최종 기준은 각 학교 공고문 · 수입은 추정</p>
<button class="btn noprint" type="button" data-act="print" style="width:100%">인쇄(A4 세로)</button>
${rows.length ? rows.map(({ a, c, ms, inc }) => `<section class="card"><h2 style="margin-top:0">${esc(a.school)} <span class="chip">${statusLabel(a.status)}</span></h2><p>${esc(a.program)} · ${c.error ? '마감 확인 필요' : `마감 ${fdt(c.deadlineDate, c.deadlineTime)}${c.sendBy ? ` · 발송 ${fd(c.sendBy)}` : ''}`}</p><p class="small">면접 ${a.interview ? fdt(a.interview.date, a.interview.time) : '—'} · 누락 ${ms.length ? ms.map(m => esc(m.label)).join(', ') : '없음'} · 수입 ${inc.amount != null ? won(inc.amount) : '—'}</p></section>`).join('') : '<p class="card empty">지원 건이 없어요.</p>'}
<div class="printonly"><table><thead><tr><th>학교</th><th>상태</th><th>마감</th><th>발송</th><th>면접</th><th>누락 서류</th></tr></thead><tbody>${rows.map(({ a, c, ms }) => `<tr><td>${esc(a.school)} ${esc(a.program)}</td><td>${statusLabel(a.status)}</td><td>${c.error ? '' : c.deadlineDate + ' ' + (c.deadlineTime || '')}</td><td>${c.sendBy || ''}</td><td>${a.interview ? a.interview.date + ' ' + a.interview.time : ''}</td><td>${ms.map(m => esc(m.label)).join(', ')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function notFound(msg) { return `<h1>찾을 수 없어요</h1><div class="card empty"><p>${esc(msg || '없는 화면이에요.')}</p><a class="btn" href="#/">홈으로</a></div>`; }

  /* ---------- 라우터 ---------- */
  const route = () => { const p = location.hash.replace(/^#\/?/, '').split('/'); return { r: p[0] || '', id: decodeURIComponent(p[1] || '') }; };
  function pageTitle(rt = route()) {
    const a = rt.id && findApp(rt.id);
    const t = { '': `${APP} — 방과후·늘봄 강사 다학교 지원 관리`, apps: '지원 보드', review: '공고 추출 확인', new: '지원 건 직접 입력', timetable: '주간 시간표·겹침', docs: '서류 금고', settings: '설정·백업', print: '지원 현황표' };
    if (rt.r === 'app') return a ? `${a.school} 지원 상세 · ${APP}` : `지원 건 없음 · ${APP}`;
    if (rt.r === 'edit') return a ? `${a.school} 정보 수정 · ${APP}` : `지원 건 없음 · ${APP}`;
    if (rt.r === '') return t[''];
    return t[rt.r] ? `${t[rt.r]} · ${APP}` : `찾을 수 없음 · ${APP}`;
  }
  let lastRoute = null;
  function render() {
    const rt = route(), key = rt.r + '/' + rt.id, same = key === lastRoute;
    const ae = document.activeElement, fk = ae && ae !== document.body ? (ae.id ? '#' + ae.id : ae.dataset && ae.dataset.bind ? `[data-bind="${ae.dataset.bind}"]${ae.dataset.key ? `[data-key="${ae.dataset.key}"]` : ''}${ae.dataset.i ? `[data-i="${ae.dataset.i}"]` : ''}` : ae.dataset && ae.dataset.act ? `[data-act="${ae.dataset.act}"]${ae.dataset.k ? `[data-k="${ae.dataset.k}"]` : ''}${ae.dataset.v ? `[data-v="${ae.dataset.v}"]` : ''}` : null) : null;
    const y = window.scrollY;
    if (!same && timer) { clearInterval(timer); timer = null; }
    let html;
    try {
      html = ({ '': vHome, apps: vApps, app: () => vApp(rt.id), edit: () => vEdit(rt.id, false), new: () => vEdit('', true), review: vReview, timetable: vTimetable, docs: vDocs, settings: vSettings, print: vPrint })[rt.r];
      html = html ? html() : notFound();
    } catch (e) {
      html = `<h1>화면을 그리지 못했어요</h1><p class="alert red" role="alert">${esc(e.message)}</p><p>설정에서 백업을 받아 두고, 문제가 계속되면 해당 지원 건을 고쳐 주세요.</p><a class="btn" href="#/settings">설정으로</a>`;
      console.warn(e);
    }
    if (loadNote && rt.r !== '') html = `<p class="alert warn" role="alert">${esc(loadNote)}</p>` + html;
    view().innerHTML = html;
    document.title = pageTitle(rt);
    const tab = { app: 'apps', edit: 'apps', print: 'apps', review: '', new: '' }[rt.r] ?? rt.r;
    $$('.tabs a').forEach(a => (a.dataset.tab === tab ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    if (same) {
      window.scrollTo(0, y);
      if (fk) { const el = $(fk, view()); if (el) el.focus({ preventScroll: true }); }
    } else {
      if (lastRoute !== null) { window.scrollTo(0, 0); const h1 = $('h1', view()); if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } }
      lastRoute = key;
    }
  }
  const go = h => { if (location.hash === h) render(); else location.hash = h; };

  /* ---------- 동작 ---------- */
  function loadSeason() {
    removeSamples();
    const st = ['preparing', 'interest'];
    SAMPLES.notices.forEach((n, i) => { const p = parse(n.text); const a = cleanApp({ ...appFromParse(p, n.text), sample: true, status: st[i] }); if (a) S.applications.push(a); });
    S.currentClasses.push(...SAMPLES.currentClasses.map(c => ({ ...c, id: uid('c'), sample: true })));
    S.travel.push(...SAMPLES.travel.map(t => ({ ...t, sample: true })));
    for (const [k, d] of Object.entries(SAMPLES.docs)) if (!S.docs.some(x => x.key === k)) S.docs.push({ key: k, issuedAt: d.issuedAt || '', pqi: !!d.pqi, note: '', sample: true });
    if (!S.proposalBase) S.proposalBase = SAMPLES.proposalBase;
    S.settings.sampleLoaded = true; S.settings.tourDone = false;
    save();
  }
  function removeSamples() {
    S.applications = S.applications.filter(a => !a.sample); S.currentClasses = S.currentClasses.filter(c => !c.sample);
    S.travel = S.travel.filter(t => !t.sample); S.docs = S.docs.filter(d => !d.sample);
    if (S.proposalBase === SAMPLES.proposalBase) S.proposalBase = '';
    S.settings.sampleLoaded = false;
  }
  function icsFor(apps) {
    const ev = [];
    for (const a of apps) ev.push(...CG.appEvents(a, calc(a)));
    return { ev, text: CG.ics(ev) };
  }
  function startTimer(min) {
    clearInterval(timer);
    const end = performance.now() + min * 60000, msg = $('#timer-msg');
    if (msg) msg.textContent = `${min}분 타이머를 시작했어요.`;
    const tick = () => {
      const left = Math.max(0, Math.round((end - performance.now()) / 1000)), c = $('#clock');
      if (c) c.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) { clearInterval(timer); timer = null; const m = $('#timer-msg'); if (m) m.textContent = '시간 종료!'; }
    };
    tick(); timer = setInterval(tick, 250);
  }
  const curApp = () => { const rt = route(); return rt.r === 'app' ? findApp(rt.id) : null; };
  let saveT = null; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 400); };

  document.addEventListener('click', async e => {
    if (e.target.closest('.skip')) { e.preventDefault(); const m = $('#main'); m.focus(); m.scrollIntoView(); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, a = curApp();
    switch (act) {
      case 'sample': { const n = SAMPLES.notices.find(x => x.id === b.dataset.id); setDraft(n.text, true); go('#/review'); break; }
      case 'season': loadSeason(); toast('예시 시즌을 불러왔어요. 둘러보기 카드를 따라가 보세요.'); go('#/'); break;
      case 'clearsample': if (await confirmBox('예시 지우기', '예시 공고·수업·서류·이동시간만 지워요. 직접 넣은 내용은 남아요.', '예시 지우기')) { removeSamples(); save(); toast('예시를 지웠어요.'); go('#/'); } break;
      case 'tourdone': S.settings.tourDone = true; save(); render(); break;
      case 'pass': S.settings.seasonPassInterest++; save(); { const p = $('#pass-count'); if (p) p.innerHTML = `이 기기에서 <span class="num">${S.settings.seasonPassInterest}번</span> 눌렀어요. 메일 주소 등은 받지 않아요.`; } toast('관심 고마워요! 결제는 없어요.'); break;
      case 'status': if (a) { a.status = b.dataset.k; save(); render(); toast(`상태: ${statusLabel(a.status)}`); } break;
      case 'ics': case 'icsall': {
        const apps = act === 'ics' ? [findApp(b.dataset.id)].filter(Boolean) : S.applications.filter(active);
        const { ev, text } = icsFor(apps);
        if (!ev.length) { toast('내보낼 일정이 없어요. 마감일을 넣어 주세요.'); break; }
        if (await confirmBox('캘린더 파일 내보내기', `일정 ${ev.length}개(학교명·마감·면접)가 담긴 .ics 파일을 받아요. 다른 사람에게 보낼 때는 학교명·일정이 그대로 보인다는 점에 주의하세요. 시각은 한국 시간(KST) 기준이에요.`, '파일 받기')) {
          download(act === 'ics' ? `chulgang-${apps[0].id}.ics` : `chulgang-all-${TODAY()}.ics`, text, 'text/calendar;charset=utf-8'); toast('.ics 파일을 받았어요. 캘린더 앱에서 열어 가져오세요.');
        }
        break;
      }
      case 'copyreq': { const x = allConflicts(true).iv[+b.dataset.i]; if (x) copy(CG.requestText(x, S.settings.teacher)); break; }
      case 'delapp': if (await confirmBox('지원 건 삭제', '이 지원 건과 체크 내용·메모를 지워요. 되돌릴 수 없어요.', '삭제')) { S.applications = S.applications.filter(x => x.id !== b.dataset.id); save(); toast('지웠어요.'); go('#/apps'); } break;
      case 'slotadd': { const box = $('#slots'), n = $$('[data-slot]', box).length; if (n >= 8) { toast('수업 시간은 8개까지예요.'); break; } box.insertAdjacentHTML('beforeend', slotRow({ day: 'mon', start: '', end: '' }, n)); $$('[data-slot]', box).pop().querySelector('select').focus(); break; }
      case 'slotdel': { const row = b.closest('[data-slot]'); const nx = row.nextElementSibling || row.previousElementSibling; row.remove(); (nx ? nx.querySelector('select') : $('[data-act="slotadd"]')).focus(); break; }
      case 'sessadd': if (a) { if (!a.sessions.length) a.sessions = Array(12).fill(''); if (a.sessions.length < 40) a.sessions.push(''); save(); render(); const ins = $$('[data-bind="sess"]'); ins[ins.length - 1].focus(); } break;
      case 'sessdel': if (a) { if (!a.sessions.length) a.sessions = Array(12).fill(''); a.sessions.splice(+b.dataset.i, 1); save(); render(); } break;
      case 'sesscopy': if (a) { const s = a.sessions.length ? a.sessions : Array(12).fill(''); copy(s.map((x, i) => `${i + 1}차시: ${x}`).join('\n')); } break;
      case 'pcopybase': if (a) { if (!S.proposalBase) { toast('기본안이 비어 있어요.'); break; } a.proposalText = S.proposalBase; save(); render(); toast('기본안을 불러왔어요. 학교명·학년·요일을 바꾸세요.'); } break;
      case 'pcopy': if (a) { const t = a.proposalText || S.proposalBase; if (t) copy(t); else toast('복사할 본문이 없어요.'); } break;
      case 'timer': startTimer(+b.dataset.min); break;
      case 'timerstop': clearInterval(timer); timer = null; { const m = $('#timer-msg'); if (m) m.textContent = '멈췄어요.'; } break;
      case 'inc': S.settings.includeApps = b.dataset.v === '1'; save(); render(); break;
      case 'delclass': S.currentClasses = S.currentClasses.filter(c => c.id !== b.dataset.id); save(); render(); toast('수업을 지웠어요.'); break;
      case 'deltravel': S.travel.splice(+b.dataset.i, 1); save(); render(); break;
      case 'export':
        if (await confirmBox('백업 파일 받기', '파일에 학교명·일정·메모·서류 날짜가 들어 있어요(서류 파일·주민번호는 없음). 메신저·공용 PC에 남기지 말고 안전한 곳에 보관하세요.', '백업 받기')) {
          download(`chulgang-backup-${TODAY()}.json`, JSON.stringify({ app: 'chulgang', exportedAt: new Date().toISOString(), ...S }, null, 2), 'application/json'); toast('백업 파일을 받았어요.');
        }
        break;
      case 'wipe': if (await confirmBox('전체 삭제', '이 기기에 저장된 지원 건·수업·서류 날짜·설정을 모두 지워요. 되돌릴 수 없어요. 먼저 백업을 받아 두세요.', '전체 삭제')) { try { localStorage.removeItem(KEY); sessionStorage.removeItem(DRAFT_KEY); } catch (_) { /* 무시 */ } S = fresh(); draft = null; save(); toast('모두 지웠어요.'); go('#/'); } break;
      case 'selftest': { const r = CG.selfTest(H, R); $('#self-out').innerHTML = `<span class="chip ${r.passed === r.total ? 'ok' : 'red'} num">${r.passed}/${r.total} 통과</span> ${r.tests.filter(t => !t.pass).map(t => esc(t.name)).join(', ')}`; break; }
      case 'print': window.print(); break;
      case 'retry': location.reload(); break;
    }
  });

  function showErr(box, form, errs, bad) {
    $$('[aria-invalid]', form).forEach(x => x.removeAttribute('aria-invalid'));
    if (!errs.length) { box.hidden = true; return false; }
    box.hidden = false; box.innerHTML = `<b>고칠 곳 ${errs.length}개</b><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    bad.forEach(n => { const el = form.elements[n] || $(`[name="${n}"]`, form); if (el && el.setAttribute) el.setAttribute('aria-invalid', 'true'); });
    const first = bad.length && (form.elements[bad[0]] || $(`[name="${bad[0]}"]`, form));
    (first && first.focus ? first : box).focus && (first && first.focus ? first.focus() : box.focus());
    return true;
  }
  document.addEventListener('submit', e => {
    const f = e.target; if (f.closest('dialog')) return; e.preventDefault();
    if (f.id === 'paste-form') {
      const t = f.elements.paste.value.trim(), box = $('#paste-err');
      if (!t) { box.hidden = false; box.textContent = '공고문을 붙여 넣어 주세요. 공고가 없으면 [직접 입력]이나 예시로 시작할 수 있어요.'; f.elements.paste.setAttribute('aria-invalid', 'true'); f.elements.paste.focus(); return; }
      if (t.length > 20000) { box.hidden = false; box.textContent = '글이 너무 길어요(2만 자 이하). 공고 본문만 붙여 넣어 주세요.'; return; }
      setDraft(t, false); go('#/review'); return;
    }
    if (f.id === 'app-form') {
      const edit = f.dataset.mode === 'edit', rt = route();
      const base = edit ? findApp(rt.id) : (restoreDraft() || { app: appFromParse({ fields: {} }, '') }).app;
      if (!base) return;
      const { a, errs, bad } = readForm(f, base);
      if (showErr($('#form-err'), f, errs, bad)) return;
      const c = cleanApp({ ...a, sample: edit ? base.sample : !!(draft && draft.sample) });
      if (edit) { S.applications = S.applications.map(x => (x.id === c.id ? c : x)); }
      else { S.applications.push(c); draft = null; try { sessionStorage.removeItem(DRAFT_KEY); } catch (_) { /* 무시 */ } }
      if (save()) toast(edit ? '고친 내용을 저장했어요.' : '저장했어요. 마감 역산과 서류 누락을 확인하세요.');
      go('#/app/' + c.id); return;
    }
    if (f.id === 'class-form') {
      const g = n => f.elements[n].value.trim(), errs = [], bad = [];
      const c = { id: uid('c'), school: g('school'), program: g('program'), day: g('day'), start: g('start'), end: g('end') };
      if (!c.school) { errs.push('학교를 넣어 주세요.'); bad.push('school'); }
      if (CG.rrnLike(c.school + c.program)) { errs.push('주민등록번호처럼 보이는 숫자는 저장할 수 없어요.'); bad.push('school'); }
      if (!okTime(c.start) || !okTime(c.end) || c.end <= c.start) { errs.push('끝 시각이 시작보다 늦어야 해요.'); bad.push(okTime(c.start) ? 'end' : 'start'); }
      if (showErr($('#class-err'), f, errs, bad)) return;
      S.currentClasses.push(c); save(); render(); toast('수업을 추가했어요.'); return;
    }
    if (f.id === 'travel-form') {
      const g = n => f.elements[n].value.trim(), errs = [], bad = [];
      const t = { from: g('from'), to: g('to'), minutes: g('minutes') === '' ? NaN : Number(g('minutes')) };
      if (!t.from) { errs.push('출발 학교를 넣어 주세요.'); bad.push('from'); }
      if (!t.to) { errs.push('도착 학교를 넣어 주세요.'); bad.push('to'); }
      if (t.from && t.from === t.to) { errs.push('두 학교가 같아요.'); bad.push('to'); }
      if (!Number.isInteger(t.minutes) || t.minutes < 0 || t.minutes > 300) { errs.push('이동시간은 0~300분 정수로 넣어 주세요.'); bad.push('minutes'); }
      if (showErr($('#travel-err'), f, errs, bad)) return;
      S.travel = S.travel.filter(x => !((x.from === t.from && x.to === t.to) || (x.from === t.to && x.to === t.from)));
      S.travel.push(t); save(); render(); toast('이동시간을 저장했어요.'); return;
    }
    if (f.id === 'set-form') {
      const g = n => f.elements[n].value.trim(), errs = [], bad = [];
      const buf = Number(g('buf'));
      if (g('buf') === '' || !Number.isInteger(buf) || buf < 0 || buf > 15) { errs.push('우편 여유는 0~15 정수예요.'); bad.push('buf'); }
      if (!okTime(g('ds')) || !okTime(g('de')) || g('de') <= g('ds') || CG.time(g('de')) - CG.time(g('ds')) < 60) { errs.push('시간표 끝은 시작보다 1시간 이상 늦어야 해요.'); bad.push('de'); }
      if (!okDate(g('cd'))) { errs.push('계약 기준일을 넣어 주세요.'); bad.push('cd'); }
      if (CG.rrnLike(g('teacher'))) { errs.push('이름 칸에 주민등록번호처럼 보이는 숫자는 넣을 수 없어요.'); bad.push('teacher'); }
      if (showErr($('#set-err'), f, errs, bad)) return;
      Object.assign(S.settings, { postalBufferBizDays: buf, dayStart: g('ds'), dayEnd: g('de'), contractDate: g('cd'), teacher: g('teacher') });
      save(); toast('설정을 저장했어요.'); render();
    }
  });

  const rrnGuard = (el, v) => { if (CG.rrnLike(v)) { toast('주민등록번호처럼 보이는 숫자는 가려서 저장해요.'); return mask(v); } return v; };
  document.addEventListener('input', e => {
    const el = e.target, bind = el.dataset && el.dataset.bind; if (!bind) return;
    const a = curApp();
    if (bind === 'pbase') { S.proposalBase = rrnGuard(el, el.value).slice(0, 8000); saveSoon(); if (a) $('#prop-check').innerHTML = proposalPanel(a); }
    else if (a && bind === 'ptext') { a.proposalText = rrnGuard(el, el.value).slice(0, 8000); saveSoon(); $('#prop-check').innerHTML = proposalPanel(a); }
    else if (a && bind === 'sess') { if (!a.sessions.length) a.sessions = Array(12).fill(''); a.sessions[+el.dataset.i] = rrnGuard(el, el.value).slice(0, 120); saveSoon(); }
    else if (a && ['place', 'items', 'questions'].includes(bind)) { a[bind] = rrnGuard(el, el.value); saveSoon(); }
  });
  document.addEventListener('change', e => {
    const el = e.target, a = curApp();
    if (el.id === 'crime-any') {
      const out = $('#crime-out');
      if (!okDate(el.value)) { out.textContent = '날짜를 골라 주세요.'; return; }
      const cp = CG.crimePrint(el.value, rule('crime_report'));
      out.innerHTML = `신청일 + 5일 = <b>${fd(cp.plusDays)}</b> · 보수적으로 <b>${fd(cp.conservative)}</b>까지 인쇄하세요.`; return;
    }
    if (el.id === 'import') {
      const file = el.files && el.files[0], msg = $('#import-msg'); if (!file) return;
      if (file.size > 2e6) { msg.innerHTML = '<span class="alert red">파일이 너무 커요(2MB 이하).</span>'; el.value = ''; return; }
      file.text().then(async txt => {
        let c = null; try { c = clean(JSON.parse(txt)); } catch (_) { c = null; }
        if (!c) { msg.innerHTML = '<span class="alert red" role="alert">이 앱의 백업 파일이 아니거나 손상됐어요. 다른 파일을 골라 주세요.</span>'; el.value = ''; return; }
        if (await confirmBox('백업으로 복원', `지원 건 ${c.applications.length}개가 든 백업으로 지금 데이터를 모두 바꿔요. 되돌릴 수 없어요.`, '복원')) { S = c; save(); toast('복원했어요.'); go('#/apps'); }
        el.value = '';
      });
      return;
    }
    const bind = el.dataset && el.dataset.bind; if (!bind) return;
    if (a && bind === 'prepared') { if (el.checked) a.prepared[el.dataset.key] = true; else delete a.prepared[el.dataset.key]; save(); render(); }
    else if (a && bind === 'crime') { a.crimeCheckRequestedAt = okDate(el.value) || ''; save(); render(); }
    else if (a && bind === 'pcheck') { a.proposalChecks[el.dataset.key] = el.checked; save(); }
    else if (bind === 'contract') { if (okDate(el.value)) { S.settings.contractDate = el.value; save(); render(); } else toast('날짜를 골라 주세요.'); }
    else if (bind === 'dochave') { if (el.checked) S.docs.push({ key: el.dataset.key, issuedAt: '', pqi: false, note: '' }); else S.docs = S.docs.filter(d => d.key !== el.dataset.key); save(); render(); }
    else if (bind === 'docdate') { const d = S.docs.find(x => x.key === el.dataset.key); if (d) { if (el.value && (!okDate(el.value) || el.value > TODAY())) { toast('오늘 이후 날짜는 넣을 수 없어요.'); el.value = d.issuedAt; return; } d.issuedAt = el.value; d.sample = false; save(); render(); } }
    else if (bind === 'docpqi') { const d = S.docs.find(x => x.key === el.dataset.key); if (d) { d.pqi = el.checked; save(); render(); } }
  });
  window.addEventListener('hashchange', render);

  /* ---------- 시작 ---------- */
  async function init() {
    try {
      const get = u => fetch(u).then(r => { if (!r.ok) throw Error(u + ' ' + r.status); return r.json(); });
      [H, R, SAMPLES] = await Promise.all([get('data/holidays.json'), get('data/doc-rules.json'), get('data/samples.json')]);
    } catch (e) {
      view().innerHTML = `<h1>${APP}</h1><div class="alert red" role="alert"><p>규칙·공휴일 자료를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도하세요. 한 번 열었던 기기라면 오프라인에서도 열려요.</p></div><button class="btn" type="button" data-act="retry">다시 시도</button>`;
      document.title = `불러오기 실패 · ${APP}`;
      return;
    }
    S = load();
    render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 캐시 없이도 동작 */ });
  }
  window.ChulgangApp = { pageTitle: () => pageTitle(), state: () => S, runSelfTest: () => CG.selfTest(H, R) };
  window.runSelfTest = () => CG.selfTest(H, R);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
