/* 우리 팀 2027 연휴 지도 — 화면 */
(function () {
  'use strict';
  const L = window.LeaveMap; const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];
  const V = $('#view'); const APP = '우리 팀 2027 연휴 지도';
  const K = { teams: 'tvm.teams', settings: 'tvm.settings', wishes: id => 'tvm.wishes.' + id, results: id => 'tvm.results.' + id, draft: id => 'tvm.draft.' + id };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('이 브라우저에 저장하지 못했어요(저장 공간·비공개 모드 확인)'); return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* noop */ } }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { H: null, SRC: null, step: 1, edit: null, month: null, rank1Only: false, sel: null, solo: null, member: null };
  const T = window.__lm = { engine: L, S, lastCopy: null, lastDownload: null, store };
  const settings = () => store.get(K.settings, {});
  const setSettings = p => store.set(K.settings, Object.assign(settings(), p));
  const teams = () => { const t = store.get(K.teams, []); return Array.isArray(t) ? t : []; };
  const curTeam = () => { const ts = teams(); const id = settings().cur; return ts.find(t => t.id === id) || ts[0] || null; };
  function saveTeam(t) { const ts = teams().filter(x => x.id !== t.id); t.customHolidays = (t.custom && t.custom.added) || []; ts.push(t); store.set(K.teams, ts); setSettings({ cur: t.id }); }
  const wishesOf = id => store.get(K.wishes(id), []);
  const calOf = t => L.calendar(S.H, t.holidayMode, t.custom);
  const rid = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };
  const fmtSpan = sp => `${L.fmt(sp.start)}~${L.fmt(sp.end, 'y')}`;
  const pageTitle = s => { const t = s ? `${s} — ${APP}` : `${APP} — 팀장용 황금연휴 연차 조율판`; document.title = t; return t; };
  T.pageTitle = pageTitle;

  /* ---------- 공통 UI ---------- */
  let tt; function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('on'), 2400); }
  function dialog(title, html, okText) {
    return new Promise(res => { const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-b').innerHTML = html; $('#dlg-ok').textContent = okText || '계속'; d.returnValue = ''; d.onclose = () => res(d.returnValue === 'ok'); d.showModal(); });
  }
  const PRIV = '<p>이 내용에는 <b>팀원 별칭과 희망 날짜</b>가 들어 있어요. 실명 대신 별칭을 권장하고, 팀 대화방처럼 필요한 곳에만 공유하세요.</p><p class="small">이 앱은 어떤 서버로도 보내지 않아요. 복사·저장한 뒤의 관리는 사용하는 분 책임이에요.</p>';
  const privacy = what => dialog('개인정보 확인', `<p><b>${esc(what)}</b> 전에 확인해 주세요.</p>` + PRIV, '확인했어요');
  async function copy(text, msg) {
    T.lastCopy = text;
    try { await navigator.clipboard.writeText(text); toast(msg || '복사했어요'); return true; } catch (e) { /* fallback */ }
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove();
    if (ok) toast(msg || '복사했어요'); else dialog('직접 복사해 주세요', `<p class="small">이 브라우저는 자동 복사를 막았어요. 아래 내용을 길게 눌러 복사하세요.</p><textarea class="code" readonly aria-label="복사할 내용">${esc(text)}</textarea>`, '닫기');
    return ok;
  }
  function download(name, data, type) {
    T.lastDownload = { name, data, type };
    const blob = data instanceof Blob ? data : new Blob([data], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(name + ' 저장');
  }
  const baseURL = () => location.href.split('#')[0];
  function render(html, title, tab) {
    V.innerHTML = html; pageTitle(title); $$('.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function focusTop() { V.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  const emptyState = (ico, h, p, btns) => `<div class="card empty-state"><div class="ico" aria-hidden="true">${ico}</div><h2>${h}</h2><p class="small">${p}</p><div class="actions">${btns}</div></div>`;
  const tmpBadge = '<span class="badge tmp">임시공휴일 미반영</span>';
  const under5 = '<div class="card note" id="under5"><h2>5인 미만 사업장이라면</h2><p class="small">상시 5인 미만 사업장은 관공서 공휴일의 유급휴일 의무(근로기준법 제55조 제2항)와 연차유급휴가(제60조) 적용 대상이 아니에요. 회사 규정을 먼저 확인하세요. 노동절(5/1)은 별도 법률로 규모와 관계없이 유급휴일이라는 고용노동부 답변이 있지만(2025-04, 명칭 변경 전), 명칭 변경 뒤 근거는 <b>확인 필요</b>예요.</p></div>';

  /* ---------- 데모 ---------- */
  function demoTeam() {
    const names = ['박지훈', '이수민', '김도윤', '최유진', '정하늘', '한서준', '오민재', '윤지아', '장태오'];
    const roles = ['팀장', '선임', '선임', '주임', '주임', '사원', '사원', '사원', '사원'];
    const buddy = { m02: 'm04', m04: 'm02', m03: 'm05', m05: 'm03', m06: 'm07', m07: 'm06', m08: 'm09', m09: 'm08' };
    const members = names.map((n, i) => { const id = 'm0' + (i + 1); return { id, alias: n, role: roles[i], buddyId: buddy[id] || null, missed: id === 'm05' }; });
    const team = { id: 'demo2027', name: '영업지원팀', members, minStaff: { default: 3, overrides: { '2027-12': 4 } }, holidayMode: 'official', custom: { added: [], removed: [] }, rule: { type: 'rotation', seed: '영업지원팀-2027-추석', deadline: '2027-07-31', forbidBuddy: true }, under5: false, applyBy: '2027-08-13', createdAt: new Date().toISOString(), demo: true };
    const P = id => S.H.presets.find(p => p.id === id); const pk = (rank, id) => ({ rank, dates: P(id).leave.slice(), label: P(id).title, half: {} });
    const W = (m, picks, need) => ({ memberId: m, alias: members.find(x => x.id === m).alias, submittedAt: '2027-07-2' + m.slice(2) + 'T09:00:00+09:00', picks, need: !!need, history: [] });
    const wishes = [
      W('m02', [pk(1, 'chuseok'), { rank: 2, dates: ['2027-09-13'], label: '추석 앞 하루', half: {} }]),
      W('m03', [pk(1, 'chuseok'), pk(2, 'oct'), pk(3, 'yearend')]),
      W('m04', [pk(1, 'chuseok'), pk(2, 'oct'), pk(3, 'buddha')]),
      W('m05', [pk(1, 'chuseok'), pk(2, 'oct'), pk(3, 'yearend')], true),
      W('m06', [pk(1, 'chuseok'), pk(2, 'yearend'), pk(3, 'oct')]),
      W('m07', [pk(1, 'oct'), pk(2, 'chuseok'), pk(3, 'yearend')]),
      W('m08', [pk(1, 'chuseok'), pk(2, 'yearend'), { rank: 3, dates: ['2027-05-04', '2027-05-06'], label: '5월 초(반차 포함)', half: { '2027-05-06': 'pm' } }]),
      W('m09', [pk(1, 'oct'), pk(2, 'yearend'), pk(3, 'seol')])
    ];
    return { team, wishes };
  }
  function loadDemo() { const d = demoTeam(); saveTeam(d.team); store.set(K.wishes(d.team.id), d.wishes); store.del(K.results(d.team.id)); setSettings({ onboarded: true }); S.edit = null; S.step = 1; S.month = null; S.sel = null; toast('데모 팀(9명·8명 제출)을 불러왔어요'); }
  T.loadDemo = loadDemo; T.demoTeam = demoTeam;

  /* ---------- 홈 ---------- */
  function home() {
    const cal = L.calendar(S.H, 'official'); const pr = id => S.H.presets.find(p => p.id === id); const sp = id => L.restSpan(cal, pr(id).leave);
    const card = (title, ids) => { const a = sp(ids[0]); const b = ids[1] ? sp(ids[1]) : null; const p = pr(ids[0]);
      return `<article class="eff"><h3>${esc(title)}</h3><p class="big num">${a.days}${b ? '<small>/</small>' + b.days : ''}<small>일</small></p><p>연차 <b class="num">${a.leave}${b ? '/' + b.leave : ''}일</b> · ${p.leave.length > 2 ? L.md(p.leave[0]) + '~' + L.md(p.leave[p.leave.length - 1]) : p.leave.map(L.md).join('·')}</p><p class="num">${L.md(a.start)}~${L.md(b ? b.end : a.end)}</p><p class="ratio">효율 ${a.efficiency}배</p></article>`; };
    const rc = L.countRestDays(cal); const st = settings(); const t = curTeam();
    render(`<section class="hero"><h1>우리 팀 2027 연휴 지도</h1><p class="lead">2027년 연차로 가장 길게 쉬는 날을 보고, 팀원 희망이 겹치면 <b>미리 공개한 규칙</b>으로 공정하게 조율해요.</p><p class="small">${tmpBadge} <span class="badge info">2027 휴무일 ${rc.total}일</span> <span class="badge">대체공휴일 7일</span></p></section>
      <h2>2027년 연차로 가장 길게 쉬는 날</h2>
      <div class="cards" tabindex="0" role="region" aria-label="연휴 효율 카드 6장, 옆으로 넘겨 보기">${card('설 연휴', ['seol'])}${card('5월 초', ['may5', 'may9'])}${card('부처님오신날', ['buddha'])}${card('추석', ['chuseok'])}${card('10월 개천절·한글날', ['oct'])}${card('연말·신정', ['yearend'])}</div>
      <div class="actions"><a class="btn acc" href="#/team" id="go-lead">팀장으로 시작</a><a class="btn ghost" href="#open" id="go-open">팀원: 받은 링크 열기</a><a class="btn ghost" href="#/solo">혼자 계산하기</a></div>
      ${st.onboarded ? '' : `<section class="card soft" id="onboard"><h2>처음이세요? 3분이면 돼요</h2><ol class="small"><li><b>팀 만들기</b> — 팀원 별칭 붙여넣기, 날짜별 최소 출근 인원·대행자 짝</li><li><b>규칙 공지 → 링크 공유</b> — 팀원은 가입 없이 1·2·3순위를 고르고 희망 코드를 보내요</li><li><b>취합 → 배정 실행</b> — 겹치는 날 히트맵, 고정 시드 추첨, 조정이 필요한 분께는 대안 날짜</li></ol><div class="actions"><button class="btn" id="demo">데모 팀으로 바로 보기</button><button class="btn ghost" id="ob-close">닫기</button></div></section>`}
      ${t ? `<section class="card"><h2>${esc(t.name)} 이어서 하기</h2><p class="small">팀원 ${t.members.length}명 · 제출 ${L.latestWishes(wishesOf(t.id)).size}명</p><div class="actions"><a class="btn ghost" href="#/collect">취합 보기</a><a class="btn ghost" href="#/result">배정 결과</a></div></section>` : ''}
      <section class="card" id="open"><h2>받은 링크 열기</h2><p class="small">팀장에게 받은 팀 링크(#team=…) 또는 희망 코드(W1.…)를 붙여 넣으세요.</p><label for="open-in">링크 또는 코드</label><input id="open-in" type="text" autocomplete="off" placeholder="https://…#team=… 또는 W1.…"><p class="err" id="open-err" hidden></p><button class="btn block" id="open-go" style="margin-top:10px">열기</button></section>
      <section class="card"><h2>2027 공휴일 한눈에</h2><p class="small">토·일 <b class="num">${rc.weekend}일</b> + 평일 공휴일·대체공휴일 <b class="num">${rc.weekdayHolidays}일</b> = 주5일 기준 휴무 <b class="num">${rc.total}일</b></p><ul class="list">${S.H.holidays.filter(h => h.date < '2028').map(h => `<li><span><span class="num">${L.fmt(h.date)}</span> ${esc(h.name)}</span><span class="badge ${h.type === 'sub' ? 'tmp' : 'bad'}">${h.type === 'sub' ? '대체' : '공휴일'}</span></li>`).join('')}</ul><p class="small">현충일(6/6 일)은 대체공휴일 대상이 아니에요. ${tmpBadge}</p></section>
      ${under5}`, '', 'home');
    const dm = $('#demo'); if (dm) dm.onclick = () => { loadDemo(); location.hash = '#/collect'; };
    const oc = $('#ob-close'); if (oc) oc.onclick = () => { setSettings({ onboarded: true }); $('#onboard').remove(); };
    $('#go-open').onclick = e => { e.preventDefault(); $('#open').scrollIntoView({ block: 'center' }); $('#open-in').focus(); };
    $('#open-go').onclick = () => {
      const v = $('#open-in').value.trim(); const er = $('#open-err'); const m = v.match(/#(team|wish)=([^\s]+)/); const w = v.match(L.WISH_RE);
      if (m) { location.hash = '#' + m[1] + '=' + m[2]; return; }
      if (w) { location.hash = '#wish=' + w[0].slice(3); return; }
      er.hidden = false; er.textContent = '팀 링크(#team=…)나 희망 코드(W1.…)를 찾지 못했어요. 받은 내용을 그대로 붙여 넣어 주세요.'; $('#open-in').setAttribute('aria-invalid', 'true');
    };
  }

  /* ---------- 혼자 계산하기 ---------- */
  function solo() {
    const st = settings(); const n = Math.max(1, Math.min(15, st.soloN || 5)); const mode = st.soloMode === 'noSubstitute' ? 'noSubstitute' : 'official';
    render(`<h1>혼자 계산하기 — 내 연차로 2027 가장 길게</h1><p class="lead">팀 없이도 써요. 연차 일수를 정하면 겹치지 않는 연휴 조합 중 <b>총 휴무일이 가장 긴</b> 조합을 골라 드려요.</p>
      <section class="card"><label for="sl">내 연차 <output id="sl-o" class="num" for="sl">${n}</output>일</label><input class="slider" id="sl" type="range" min="1" max="15" step="1" value="${n}" aria-valuetext="${n}일">
      <fieldset class="opts" style="border:0;padding:0;margin:8px 0 0"><legend class="small">회사 휴일 기준</legend><label class="opt"><input type="radio" name="sm" value="official" ${mode === 'official' ? 'checked' : ''}><span><b>관공서 공휴일 그대로</b><span class="small">대체공휴일 포함</span></span></label><label class="opt"><input type="radio" name="sm" value="noSubstitute" ${mode === 'noSubstitute' ? 'checked' : ''}><span><b>대체공휴일 미적용</b><span class="small">대체공휴일 7일을 근무일로</span></span></label></fieldset></section>
      <section class="card" id="solo-out" aria-live="polite"></section>
      <div class="actions"><button class="btn acc" id="png">공유 카드 PNG 저장</button><a class="btn ghost" href="#/team">팀으로 조율하기</a></div>
      <p class="small">공유 카드에는 개인정보가 들어가지 않아요(연차 일수·날짜만). ${tmpBadge}</p>`, '혼자 계산하기', '');
    const draw = () => {
      const k = +$('#sl').value; const md = $('input[name=sm]:checked').value; const r = L.bestCombo(L.calendar(S.H, md), k); S.solo = r;
      $('#sl-o').textContent = k; $('#sl').setAttribute('aria-valuetext', k + '일'); setSettings({ soloN: k, soloMode: md });
      $('#solo-out').innerHTML = `<h2>연차 <span class="num">${r.leaveUsed}일</span> → 총 <span class="big num">${r.totalRest}일</span> 휴무</h2><p class="small">${md === 'noSubstitute' ? '대체공휴일 미적용 기준' : '관공서 공휴일 기준'} · 휴무 구간 ${r.picks.length}개${r.leaveUsed < k ? ` · 남는 연차 ${k - r.leaveUsed}일은 공휴일과 붙지 않아 따로 쓰는 게 좋아요` : ''}</p>${r.picks.map(p => `<div class="combo"><span><b class="num">${L.fmt(p.start)}~${L.fmt(p.end, 'y')}</b><br><span class="small">연차 ${p.leaveDates.map(L.md).join('·')}</span></span><span style="text-align:right"><b class="num">${p.days}일</b><br><span class="small num">연차 ${p.leave}일</span></span></div>`).join('')}`;
    };
    $('#sl').oninput = draw; $$('input[name=sm]').forEach(x => x.onchange = draw); draw();
    $('#png').onclick = () => soloPNG(S.solo);
  }
  function soloPNG(r) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d'); const F = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    g.fillStyle = '#1E3A5F'; g.fillRect(0, 0, 1080, 1350); g.fillStyle = '#FF7A59'; g.fillRect(0, 0, 1080, 16);
    g.fillStyle = '#fff'; g.font = `700 54px ${F}`; g.fillText('내 2027 연휴 계획', 72, 140);
    g.font = `800 132px ${F}`; g.fillText(`${r.totalRest}일`, 72, 300); g.font = `600 44px ${F}`; g.fillStyle = '#C9D6E8'; g.fillText(`연차 ${r.leaveUsed}일로 쉬는 날`, 72, 370);
    g.font = `600 38px ${F}`; let y = 460; r.picks.slice(0, 11).forEach(p => { g.fillStyle = '#fff'; g.fillText(`${L.fmt(p.start)} ~ ${L.fmt(p.end, 'y')}`, 72, y); g.fillStyle = '#FFB59E'; g.textAlign = 'right'; g.fillText(`${p.days}일 · 연차 ${p.leave}`, 1008, y); g.textAlign = 'left'; y += 68; });
    g.fillStyle = '#C9D6E8'; g.font = `500 30px ${F}`; g.fillText('우리 팀 2027 연휴 지도 · 우주항공청 2027 월력요항 기준 · 임시공휴일 미반영', 72, 1290);
    c.toBlob(b => { T.lastPng = { w: c.width, h: c.height, size: b ? b.size : 0 }; if (b) download(`2027-연휴-연차${r.leaveUsed}일.png`, b, 'image/png'); }, 'image/png');
  }

  /* ---------- 팀 설정 ---------- */
  function newTeam() { return { id: rid(8), name: '', members: [], minStaff: { default: 2, overrides: {} }, holidayMode: 'official', custom: { added: [], removed: [] }, rule: { type: 'rankLottery', seed: '', deadline: '', forbidBuddy: true }, under5: false, applyBy: '', createdAt: new Date().toISOString() }; }
  function parseMembers(text, prev) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean); const errs = []; const seen = new Set(); const out = [];
    lines.forEach(l => { const [a, r] = l.split('/').map(s => (s || '').trim()); const alias = a.replace(/[<>&"'`]/g, '');
      if (!alias) return; if (alias.length > 20) errs.push(`"${alias.slice(0, 10)}…" 이름은 20자 이내로`); if (seen.has(alias)) errs.push(`"${alias}" 이름이 두 번 있어요`); seen.add(alias);
      const old = (prev || []).find(m => m.alias === alias); out.push(old ? Object.assign({}, old, { role: (r || '').slice(0, 20) }) : { id: 'm' + rid(4), alias, role: (r || '').slice(0, 20), buddyId: null, missed: false }); });
    if (out.length < 2) errs.push('팀원을 2명 이상 넣어 주세요(한 줄에 한 명).'); if (out.length > 30) errs.push('팀원은 30명까지예요.');
    const ids = new Set(out.map(m => m.id)); out.forEach(m => { if (m.buddyId && !ids.has(m.buddyId)) m.buddyId = null; });
    return { members: out, errs };
  }
  function team() {
    if (!S.edit) { const t = curTeam(); S.edit = t ? JSON.parse(JSON.stringify(t)) : newTeam(); }
    const e = S.edit; const step = S.step; const isNew = !teams().some(t => t.id === e.id);
    const stp = `<ol class="steps" aria-label="3단계 중 ${step}단계">${['팀원', '인원·대행자', '회사 휴일'].map((s, i) => `<li class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}>${i + 1}. ${s}</li>`).join('')}</ol>`;
    let body = '';
    if (step === 1) body = `<label for="tn">팀 이름</label><input id="tn" type="text" maxlength="30" value="${esc(e.name)}" placeholder="예: 영업지원팀"><label for="tm">팀원 (한 줄에 한 명)</label><textarea id="tm" placeholder="박지훈 / 팀장&#10;이수민&#10;김도윤">${esc(e.members.map(m => m.alias + (m.role ? ' / ' + m.role : '')).join('\n'))}</textarea><p class="hint">실명 대신 <b>별칭</b>을 권장해요. 역할은 "이름 / 역할"처럼 적어요(선택). 5~20명 팀에 맞춰 만들었어요.</p><p class="err" id="e1" hidden></p>`;
    if (step === 2) {
      const N = e.members.length; const ov = Object.entries(e.minStaff.overrides || {});
      body = `<label for="ms">날짜별 최소 출근 인원(기본)</label><input id="ms" type="number" inputmode="numeric" min="0" max="${Math.max(0, N - 1)}" value="${e.minStaff.default}"><p class="hint">팀원 ${N}명 중 이 인원은 항상 출근하도록 맞춰요.</p>
      <h3>예외 (월 또는 날짜)</h3><div id="ovs">${ov.map(([k, v], i) => ovRow(k, v, i)).join('')}</div><button class="btn ghost sm" id="ov-add" type="button">예외 추가</button><p class="hint">예: <span class="num">2027-12</span> → 12월 전체 4명, <span class="num">2027-12-20</span> → 그날만 4명. 날짜 예외가 월 예외보다 우선해요.</p><p class="err" id="e2" hidden></p>
      <h3>대행자 짝 · 지난 연휴 우선권</h3><p class="hint">대행자 짝은 같은 날 함께 비우지 않도록 조율해요(규칙에서 끌 수 있어요). "지난 연휴 못 씀"은 순번제 규칙에서 먼저 배정돼요.</p>
      <div class="card" style="padding:4px 12px">${e.members.map(m => `<div class="mem"><span class="who">${esc(m.alias)}${m.role ? ` <span class="small">${esc(m.role)}</span>` : ''}</span><div class="row"><label class="sr-only" for="b-${m.id}">${esc(m.alias)} 대행자</label><select id="b-${m.id}" data-buddy="${m.id}"><option value="">대행자 없음</option>${e.members.filter(x => x.id !== m.id).map(x => `<option value="${x.id}" ${L.buddyOf(e, m.id) === x.id ? 'selected' : ''}>대행: ${esc(x.alias)}</option>`).join('')}</select></div><label class="check"><input type="checkbox" data-missed="${m.id}" ${m.missed ? 'checked' : ''}>지난 연휴 못 씀</label></div>`).join('')}</div>`;
    }
    if (step === 3) {
      const mode = e.holidayMode; const offs = S.H.holidays.filter(h => h.date < '2028');
      body = `<fieldset class="opts" style="border:0;padding:0;margin:0"><legend class="sr-only">회사 휴일 모드</legend>
      <label class="opt"><input type="radio" name="hm" value="official" ${mode === 'official' ? 'checked' : ''}><span><b>① 관공서 공휴일 그대로 (기본)</b><span class="small">대체공휴일 7일 포함, 휴무 119일</span></span></label>
      <label class="opt"><input type="radio" name="hm" value="noSubstitute" ${mode === 'noSubstitute' ? 'checked' : ''}><span><b>② 대체공휴일 미적용</b><span class="small">2/9·5/3·7/19·8/16·10/4·10/11·12/27을 근무일로, 휴무 112일</span></span></label>
      <label class="opt"><input type="radio" name="hm" value="custom" ${mode === 'custom' ? 'checked' : ''}><span><b>③ 직접 편집</b><span class="small">회사 창립기념일·임시공휴일 추가, 일부 공휴일 제외</span></span></label></fieldset>
      <div id="cust" ${mode === 'custom' ? '' : 'hidden'}><h3>휴일 추가</h3><div class="row"><div><label for="ca-d">날짜</label><input id="ca-d" type="date" min="2027-01-01" max="2027-12-31"></div><div><label for="ca-n">이름</label><input id="ca-n" type="text" maxlength="20" placeholder="예: 창립기념일"></div></div><button class="btn ghost sm" id="ca-add" type="button" style="margin-top:8px">추가</button><p class="err" id="e3" hidden></p>
      <ul class="list" id="ca-list">${(e.custom.added || []).map((c, i) => `<li><span><span class="num">${L.fmt(c.date)}</span> ${esc(c.name)}</span><button class="btn ghost sm" data-cdel="${i}" type="button">삭제</button></li>`).join('')}</ul>
      <h3>회사가 쉬지 않는 공휴일</h3>${offs.map(h => `<label class="check"><input type="checkbox" data-rm="${h.date}" ${(e.custom.removed || []).includes(h.date) ? 'checked' : ''}>${L.fmt(h.date)} ${esc(h.name)}</label>`).join('')}</div>
      <p class="small" style="margin-top:10px">${tmpBadge} 임시공휴일이 지정되면 ③에서 직접 추가하세요.</p>
      <label class="check"><input type="checkbox" id="u5" ${e.under5 ? 'checked' : ''}>우리 회사는 상시 5인 미만 사업장이에요</label>${e.under5 ? under5 : ''}`;
    }
    render(`<h1>${isNew ? '팀 만들기' : '팀 설정'}</h1><p class="lead">팀원 별칭과 최소 출근 인원만 있으면 돼요. 데모로 먼저 둘러볼 수도 있어요.</p>
      <div class="actions"><button class="btn ghost" id="demo2">데모 데이터 불러오기 (9명)</button></div>
      <section class="card">${stp}${body}<div class="row" style="margin-top:14px">${step > 1 ? '<button class="btn ghost" id="prev" type="button">이전</button>' : ''}${step < 3 ? '<button class="btn" id="next" type="button">다음</button>' : '<button class="btn acc" id="save" type="button">저장하고 팀 링크 만들기</button>'}</div></section>
      ${!isNew ? `<section class="card soft" id="link-card"><h2>팀 링크</h2><p class="small">팀원에게 이 링크를 보내면 가입 없이 희망을 제출해요. 규칙을 먼저 정해 공지하는 걸 권장해요.</p><div class="actions"><button class="btn" id="copy-link">팀 링크 복사</button><a class="btn ghost" href="#/rules">규칙 정하기</a></div><p class="small" id="link-len"></p></section>` : ''}`, step === 1 ? '팀 설정 1단계: 팀원' : step === 2 ? '팀 설정 2단계: 최소 인원·대행자' : '팀 설정 3단계: 회사 휴일', 'team');
    $('#demo2').onclick = () => { loadDemo(); team(); focusTop(); };
    const collect = () => {
      if (step === 1) { e.name = $('#tn').value.trim().replace(/[<>&"'`]/g, '').slice(0, 30); const r = parseMembers($('#tm').value, e.members); e.members = r.members; const er = []; if (!e.name) er.push('팀 이름을 적어 주세요.'); er.push(...r.errs); show('#e1', er); $('#tn').setAttribute('aria-invalid', String(!e.name)); $('#tm').setAttribute('aria-invalid', String(!!r.errs.length)); return !er.length; }
      if (step === 2) {
        const N = e.members.length; const d = parseInt($('#ms').value, 10); const er = [];
        if (!(d >= 0 && d < N)) er.push(`최소 출근 인원은 0~${N - 1}명이에요.`);
        const ov = {}; $$('#ovs .ovr').forEach(r => { const k = r.querySelector('input[type=text]').value.trim(); const v = parseInt(r.querySelector('input[type=number]').value, 10); if (!k) return; if (!/^2027-(0[1-9]|1[0-2])(-\d{2})?$/.test(k) || (k.length === 10 && !L.isDate(k))) er.push(`"${k}" 형식은 2027-12 또는 2027-12-20처럼 적어요.`); else if (!(v >= 0 && v < N)) er.push(`${k} 인원은 0~${N - 1}명이에요.`); else ov[k] = v; });
        $('#ms').setAttribute('aria-invalid', String(!(d >= 0 && d < N))); show('#e2', er); if (er.length) return false;
        e.minStaff = { default: d, overrides: ov }; return true;
      }
      if (step === 3) { e.holidayMode = $('input[name=hm]:checked').value; e.custom.removed = $$('[data-rm]').filter(x => x.checked).map(x => x.dataset.rm); e.under5 = $('#u5').checked; return true; }
    };
    const n = $('#next'); if (n) n.onclick = () => { if (collect()) { S.step++; team(); focusTop(); } };
    const p = $('#prev'); if (p) p.onclick = () => { if (step !== 2 || collect()) { S.step--; team(); focusTop(); } };
    const sv = $('#save'); if (sv) sv.onclick = () => { collect(); if (!e.name || e.members.length < 2) { S.step = 1; team(); return; } if (!e.rule.seed) e.rule.seed = e.name + '-2027'; saveTeam(e); S.edit = null; S.step = 1; toast('팀을 저장했어요'); team(); setTimeout(() => { const lc = $('#link-card'); if (lc) lc.scrollIntoView({ block: 'center' }); }, 0); };
    if (step === 2) {
      const bindOv = () => $$('[data-ovdel]').forEach(b => b.onclick = () => b.closest('.ovr').remove()); bindOv();
      $('#ov-add').onclick = () => { const i = Date.now() % 100000; $('#ovs').insertAdjacentHTML('beforeend', ovRow('', Math.min(e.members.length - 1, e.minStaff.default + 1), i)); bindOv(); $('#ovk' + i).focus(); };
      $$('[data-buddy]').forEach(s => s.onchange = () => { const a = s.dataset.buddy, b = s.value; e.members.forEach(m => { if (m.id === a || m.id === b || m.buddyId === a || (b && m.buddyId === b)) m.buddyId = null; }); if (b) { e.members.find(m => m.id === a).buddyId = b; e.members.find(m => m.id === b).buddyId = a; } if (collect() !== false) { team(); const el = document.getElementById('b-' + a); if (el) el.focus(); } });
      $$('[data-missed]').forEach(c => c.onchange = () => { e.members.find(m => m.id === c.dataset.missed).missed = c.checked; });
    }
    if (step === 3) {
      $$('input[name=hm]').forEach(r => r.onchange = () => { e.holidayMode = r.value; $('#cust').hidden = r.value !== 'custom'; });
      $('#u5').onchange = () => { collect(); team(); $('#u5').focus(); };
      $('#ca-add').onclick = () => { const d = $('#ca-d').value; const nm = $('#ca-n').value.trim().replace(/[<>&"'`]/g, '').slice(0, 20) || '회사 휴일'; if (!L.isDate(d) || d < '2027-01-01' || d > '2027-12-31') { show('#e3', ['2027년 날짜를 골라 주세요.']); $('#ca-d').setAttribute('aria-invalid', 'true'); return; } e.custom.added = (e.custom.added || []).filter(x => x.date !== d).concat([{ date: d, name: nm }]).sort((a, b) => a.date < b.date ? -1 : 1); collect(); team(); };
      $$('[data-cdel]').forEach(b => b.onclick = () => { e.custom.added.splice(+b.dataset.cdel, 1); collect(); team(); });
    }
    const cl = $('#copy-link'); if (cl) { const url = teamLink(curTeam()); $('#link-len').textContent = url.length > 2000 ? `링크가 ${url.length}자로 길어서 일부 메신저에서 잘릴 수 있어요. 잘리면 팀원 화면의 [받은 링크 열기]에 붙여 넣도록 안내하세요.` : `링크 길이 ${url.length}자`; cl.onclick = async () => { if (await privacy('팀 링크 복사')) copy(url, '팀 링크를 복사했어요'); }; }
  }
  const ovRow = (k, v, i) => `<div class="row ovr" style="align-items:flex-end"><div style="flex:2 1 140px"><label for="ovk${i}">월/날짜</label><input id="ovk${i}" type="text" inputmode="numeric" value="${esc(k)}" placeholder="2027-12"></div><div style="flex:1 1 80px"><label for="ovv${i}">최소 인원</label><input id="ovv${i}" type="number" min="0" value="${v}"></div><button class="btn ghost sm" type="button" data-ovdel="${i}" style="flex:0 0 auto">삭제</button></div>`;
  function show(sel, errs) { const el = $(sel); if (!el) return; el.hidden = !errs.length; el.innerHTML = errs.map(esc).join('<br>'); }
  const teamLink = t => baseURL() + '#team=' + L.encodeTeam(t);
  T.teamLink = () => teamLink(curTeam());

  /* ---------- 규칙 ---------- */
  function needTeam(title, tab) { render(`<h1>${title}</h1>` + emptyState('👥', '아직 팀이 없어요', '팀을 만들거나 데모 데이터로 먼저 둘러보세요.', '<a class="btn" href="#/team">팀 만들기</a><button class="btn ghost" id="demo3">데모 데이터</button>'), title + ' (팀 없음)', tab); $('#demo3').onclick = () => { loadDemo(); route(); }; }
  function rules() {
    const t = curTeam(); if (!t) return needTeam('배정 규칙', 'team');
    const r = t.rule; const R = (v, b, s) => `<label class="opt"><input type="radio" name="rt" value="${v}" ${r.type === v ? 'checked' : ''}><span><b>${b}</b><span class="small">${s}</span></span></label>`;
    render(`<h1>배정 규칙 — ${esc(t.name)}</h1><p class="lead">희망을 받기 <b>전에</b> 규칙과 추첨 시드를 공지하면, 누구나 같은 결과를 다시 계산해 확인할 수 있어요.</p>
      <section class="card"><fieldset class="opts" style="border:0;padding:0;margin:0"><legend class="sr-only">배정 규칙</legend>${R('rotation', '순번제', '지난 연휴에 원하는 날을 못 쓴 사람 먼저 → 그다음 공개 추첨')}${R('rankLottery', '순위 우선 + 공개 추첨', '1순위끼리 겹치면 추첨, 조정이 필요하면 2순위로')}${R('needFirst', '필수 사유 우선', '"꼭 필요한 사유 있음" 체크자 먼저(사유 내용은 받지 않아요) → 추첨')}</fieldset>
      <label for="seed">추첨 시드 (공지 때 고정)</label><input id="seed" type="text" maxlength="60" value="${esc(r.seed)}"><label for="dl">희망 제출 마감일</label><input id="dl" type="date" min="2026-11-01" max="2027-12-31" value="${esc(r.deadline)}"><p class="err" id="e4" hidden></p>
      <label class="check"><input type="checkbox" id="fb" ${r.forbidBuddy !== false ? 'checked' : ''}>대행자 짝은 같은 날 함께 비우지 않기</label>
      <p class="small">추첨 해시(SHA-256): <span class="num" id="sh"></span>…</p></section>
      ${t.members.some(m => m.missed) ? `<p class="small">지난 연휴 우선권: ${esc(t.members.filter(m => m.missed).map(m => m.alias).join(', '))} (팀 설정 2단계에서 바꿔요)</p>` : ''}
      <section class="card"><h2>규칙 공지문 미리보기</h2><textarea id="rn" readonly aria-label="규칙 공지문" style="min-height:220px"></textarea><div class="actions"><button class="btn acc" id="rn-copy">규칙 공지문 복사</button><button class="btn ghost" id="tl-copy">팀 링크 복사</button></div></section>
      <div class="actions"><a class="btn" href="#/collect">희망 취합으로</a></div>`, '배정 규칙·공지문', 'team');
    const upd = () => { t.rule = { type: $('input[name=rt]:checked').value, seed: $('#seed').value.trim().replace(/[<>&"'`]/g, '').slice(0, 60), deadline: $('#dl').value, forbidBuddy: $('#fb').checked }; saveTeam(t); $('#sh').textContent = L.lottery([], t.rule.seed, t.rule.deadline).seedHash.slice(0, 16); $('#rn').value = L.ruleNotice(t, teamLink(t)); };
    $$('input[name=rt]').forEach(x => x.onchange = upd); ['#seed', '#dl'].forEach(s => $(s).oninput = upd); $('#fb').onchange = upd; upd();
    const valid = () => { const er = []; if (!t.rule.seed) er.push('추첨 시드를 적어 주세요.'); if (!t.rule.deadline) er.push('제출 마감일을 골라 주세요.'); show('#e4', er); $('#seed').setAttribute('aria-invalid', String(!t.rule.seed)); $('#dl').setAttribute('aria-invalid', String(!t.rule.deadline)); return !er.length; };
    $('#rn-copy').onclick = async () => { if (valid() && await privacy('규칙 공지문 복사')) copy($('#rn').value, '규칙 공지문을 복사했어요'); };
    $('#tl-copy').onclick = async () => { if (await privacy('팀 링크 복사')) copy(teamLink(t), '팀 링크를 복사했어요'); };
  }

  /* ---------- 희망 추가 ---------- */
  function addWishes(t, list) {
    const cur = wishesOf(t.id); let added = 0, replaced = 0; const rej = [];
    list.forEach(w => {
      if (w.teamId !== t.id) { rej.push(`${w.alias || '?'}: 다른 팀 코드`); return; }
      const m = t.members.find(x => x.id === w.memberId); if (!m) { rej.push(`${w.alias || '?'}: 팀원 목록에 없음`); return; }
      if (!w.picks.length) { rej.push(`${m.alias}: 선택한 날짜 없음`); return; }
      const i = cur.findIndex(x => x.memberId === w.memberId);
      const rec = { memberId: w.memberId, alias: m.alias, submittedAt: w.submittedAt, picks: w.picks, need: w.need, history: [] };
      if (i >= 0) { const o = cur[i]; if (String(o.submittedAt) === String(w.submittedAt) && JSON.stringify(o.picks) === JSON.stringify(w.picks)) return; if (String(w.submittedAt) < String(o.submittedAt)) { rej.push(`${m.alias}: 이미 더 최신 제출이 있음`); return; } rec.history = (o.history || []).concat([{ submittedAt: o.submittedAt, picks: o.picks, need: o.need }]).slice(-10); cur[i] = rec; replaced++; }
      else { cur.push(rec); added++; }
    });
    store.set(K.wishes(t.id), cur); return { added, replaced, rej };
  }
  T.addWishes = text => addWishes(curTeam(), L.parseWishCodes(text).ok);

  /* ---------- 취합 ---------- */
  const nmOf = (t, id) => esc((t.members.find(m => m.id === id) || {}).alias || id);
  function collectView() {
    const t = curTeam(); if (!t) return needTeam('희망 취합', 'collect');
    const ws = wishesOf(t.id); const latest = L.latestWishes(ws); const cal = calOf(t); const hm = L.heat(t, ws, cal, { rank1Only: S.rank1Only });
    const N = t.members.length;
    if (S.month == null) S.month = hm.top[0] ? +hm.top[0].start.slice(5, 7) : 9;
    const hotM = new Set(Object.values(hm.days).filter(d => d.short || d.buddy.length).map(d => +d.date.slice(5, 7)));
    const pickLabel = p => p ? esc(p.label || (p.dates.length > 3 ? L.md(p.dates[0]) + '~' + L.md(p.dates[p.dates.length - 1]) : p.dates.map(L.md).join('·'))) : '<span class="small">—</span>';
    render(`<h1>희망 취합 — ${esc(t.name)}</h1>
      <section class="card"><h2>제출 현황 <span class="num" id="sub-count">${latest.size}/${N}</span></h2><div class="status">${t.members.map(m => `<span class="chip ${latest.has(m.id) ? 'on' : ''}">${latest.has(m.id) ? '✓' : '·'} ${esc(m.alias)}</span>`).join('')}</div>
      <label for="paste">희망 코드 붙여넣기 (여러 개 한 번에)</label><textarea id="paste" class="code" placeholder="W1.… 줄바꿈으로 여러 개"></textarea><p class="err" id="e5" hidden></p><div class="actions"><button class="btn" id="add">코드 추가</button><button class="btn ghost" id="tl2">팀 링크 복사</button></div><p class="small">같은 팀원이 다시 내면 최신본으로 바뀌고, 이전본은 이력으로 남아요.</p></section>
      ${!latest.size ? emptyState('📨', '아직 제출된 희망이 없어요', '팀 링크를 보내고, 팀원이 보낸 희망 코드를 위 칸에 붙여 넣으세요. 데모 데이터로 미리 볼 수도 있어요.', '<button class="btn ghost" id="demo4">데모 데이터</button>') : `
      <section class="card heat"><h2>2027 희망 히트맵</h2><div class="row" role="group" aria-label="집계 기준"><button class="btn sm ${S.rank1Only ? 'ghost' : ''}" id="r-all" aria-pressed="${!S.rank1Only}">전체 순위</button><button class="btn sm ${S.rank1Only ? '' : 'ghost'}" id="r-1" aria-pressed="${S.rank1Only}">1순위만</button></div>
      <div class="mtabs" role="group" aria-label="월 선택">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-m="${i + 1}" aria-pressed="${S.month === i + 1}" class="${hotM.has(i + 1) ? 'hot' : ''}" aria-label="${i + 1}월${hotM.has(i + 1) ? ', 조정 필요한 날 있음' : ''}">${i + 1}월</button>`).join('')}</div>
      <div id="calwrap">${monthGrid(t, cal, hm, S.month)}</div>
      <div class="legend"><span><i style="background:#EFF6FF"></i>적음</span><span><i style="background:#60A5FA"></i>보통</span><span><i style="background:#1E3A8A"></i>많음</span><span><i style="border:2px solid #E5484D;background:#fff"></i>최소 인원 미달</span><span>🔗 대행자 동시 부재</span><span style="color:var(--holt);font-weight:700">공휴일</span><span style="color:var(--subt);font-weight:700">대체</span></div>
      <div id="detail" aria-live="polite"></div></section>
      <section class="card" id="top5"><h2>충돌 구간 Top 5</h2>${hm.top.length ? `<ol class="list">${hm.top.map(s => `<li><span><b class="num">${L.md(s.start)}${s.end !== s.start ? '~' + L.md(s.end) : ''}</b> 최대 <b class="num">${s.maxCount}명</b> 희망${s.maxExcess ? ` · <span class="badge bad">최소 ${s.min}명 기준 ${s.maxExcess}명 조정 필요</span>` : ' · <span class="badge ok">인원 여유</span>'}${s.buddy ? ' · <span class="badge tmp">🔗 대행자</span>' : ''}</span><button class="btn ghost sm" data-go="${s.start}" aria-label="${L.md(s.start)} 구간 달력에서 보기">보기</button></li>`).join('')}</ol>` : '<p class="small">2명 이상 겹치는 날이 없어요.</p>'}</section>
      ${hm.buddyWarn.length ? `<section class="card warn" id="buddy-warn"><h2>🔗 대행자 동시 부재 경고</h2><ul class="list">${hm.buddyWarn.map(g => `<li><span><b>${nmOf(t, g.a)}·${nmOf(t, g.b)}</b> (서로 대행) — ${segs(g.dates, cal).map(x => `<span class="num">${x}</span>`).join(', ')} 같이 희망</span></li>`).join('')}</ul><p class="small">${t.rule.forbidBuddy !== false ? '배정할 때 한 사람은 다른 순위나 대안 날짜로 조율돼요.' : '규칙에서 대행자 동시 부재 금지가 꺼져 있어요.'}</p></section>` : ''}
      <section class="card"><h2>제출 목록</h2><table class="tbl"><colgroup><col class="c1"><col><col></colgroup><thead><tr><th scope="col">팀원</th><th scope="col">1순위</th><th scope="col">2·3순위</th></tr></thead><tbody>${[...latest.values()].map(w => { const pk = r => w.picks.find(p => p.rank === r); return `<tr><td><b>${nmOf(t, w.memberId)}</b>${w.need ? ' <span class="badge acc">필수</span>' : ''}${(w.history || []).length ? ` <span class="badge">재제출 ${w.history.length}</span>` : ''}</td><td>${pickLabel(pk(1))}</td><td>${pickLabel(pk(2))}<br>${pickLabel(pk(3))}</td></tr>`; }).join('')}</tbody></table></section>
      <div class="actions"><button class="btn acc" id="run">배정 실행</button><a class="btn ghost" href="#/rules">규칙 확인</a></div>`}`, `희망 취합 (${latest.size}/${N})`, 'collect');
    $('#add').onclick = () => {
      const p = L.parseWishCodes($('#paste').value); const er = [];
      if (!p.found) { show('#e5', ['희망 코드(W1.…)를 찾지 못했어요.']); $('#paste').setAttribute('aria-invalid', 'true'); return; }
      const r = addWishes(t, p.ok); p.bad.forEach(b => er.push(`${b}…: 코드가 잘렸거나 손상됐어요`)); er.push(...r.rej);
      toast(`추가 ${r.added} · 교체 ${r.replaced}${er.length ? ' · 확인 필요 ' + er.length : ''}`); S.month = null; collectView(); if (er.length) show('#e5', er);
    };
    $('#tl2').onclick = async () => { if (await privacy('팀 링크 복사')) copy(teamLink(t), '팀 링크를 복사했어요'); };
    const d4 = $('#demo4'); if (d4) d4.onclick = () => { loadDemo(); collectView(); };
    if (!latest.size) return;
    $('#r-all').onclick = () => { S.rank1Only = false; collectView(); $('#r-all').focus(); }; $('#r-1').onclick = () => { S.rank1Only = true; collectView(); $('#r-1').focus(); };
    $$('[data-m]').forEach(b => b.onclick = () => { S.month = +b.dataset.m; S.sel = null; collectView(); const x = $(`[data-m="${S.month}"]`); if (x) x.focus(); });
    $$('[data-go]').forEach(b => b.onclick = () => { S.month = +b.dataset.go.slice(5, 7); S.sel = b.dataset.go; collectView(); $('#calwrap').scrollIntoView({ block: 'start' }); });
    $$('.cell[data-d]').forEach(c => c.onclick = () => { S.sel = c.dataset.d; showDetail(t, cal, hm, latest); });
    if (S.sel) showDetail(t, cal, hm, latest);
    $('#run').onclick = () => { runAssign(t); location.hash = '#/result'; };
  }
  function segs(dates, cal) {
    const out = []; let st = null, en = null;
    dates.slice().sort().forEach(d => { if (en) { let gap = true; for (let c = L.addDays(en, 1); c < d; c = L.addDays(c, 1)) if (!cal.isOff(c)) { gap = false; break; } if (gap) { en = d; return; } out.push([st, en]); } st = en = d; });
    if (st) out.push([st, en]); return out.map(([a, b]) => a === b ? L.md(a) : L.md(a) + '~' + L.md(b));
  }
  function monthGrid(t, cal, hm, m) {
    const mm = String(m).padStart(2, '0'); const first = `2027-${mm}-01`; const days = new Date(Date.UTC(2027, m, 0)).getUTCDate(); const pad = L.weekday(first); const N = t.members.length;
    let h = `<h3 class="num">2027년 ${m}월</h3><div class="cal">` + L.WD.map((w, i) => `<span class="wd ${i === 0 ? 'sun' : ''}" aria-hidden="true">${w}</span>`).join('') + '<span class="cell empty" aria-hidden="true"></span>'.repeat(pad);
    for (let i = 1; i <= days; i++) {
      const d = `2027-${mm}-${String(i).padStart(2, '0')}`; const k = cal.kind(d); const x = hm.days[d]; const hol = cal.holiday(d);
      const cls = ['cell']; if (k === 'holiday' || k === 'custom' || L.weekday(d) === 0) cls.push('hol'); if (k === 'sub') cls.push('sub'); if (k && !x) cls.push('off'); if (x) cls.push('l' + x.level); if (x && x.short) cls.push('short');
      const lab = `${m}월 ${i}일 ${L.WD[L.weekday(d)]}요일${hol ? ', ' + hol.name : ''}${x ? `, 희망 ${x.count}명, 출근 ${x.present}명, 최소 ${x.min}명${x.short ? ', 최소 인원 미달' : ''}${x.buddy.length ? ', 대행자 동시 부재' : ''}` : k ? ', 휴무' : ''}`;
      h += x ? `<button type="button" class="${cls.join(' ')}" data-d="${d}"><span class="d">${i}</span><span class="c">${x.count}/${N}</span>${x.buddy.length ? '<span class="bd" aria-hidden="true">🔗</span>' : ''}<span class="sr-only">${esc(lab)}</span></button>` : `<span class="${cls.join(' ')}" role="img" aria-label="${esc(lab)}"><span class="d" aria-hidden="true">${i}</span></span>`;
    }
    return h + '</div>';
  }
  function showDetail(t, cal, hm, latest) {
    const d = S.sel; const x = hm.days[d]; const el = $('#detail'); if (!el || !x) return; const hol = cal.holiday(d);
    const who = x.ids.map(id => { const w = latest.get(id); const p = w.picks.filter(q => (q.dates || []).includes(d)).sort((a, b) => a.rank - b.rank)[0]; return `${nmOf(t, id)}(${p ? p.rank : '?'}순위${p && p.half && p.half[d] ? '·반차' : ''})`; });
    el.innerHTML = `<div class="card ${x.short ? 'warn' : 'soft'}" style="margin-top:10px"><h3 style="margin-top:0">${L.fmt(d, 'long')}${hol ? ' · ' + esc(hol.name) : ''}</h3><p>${t.members.length}명 중 <b class="num">${x.count}명</b> 희망 → 모두 쉬면 출근 <b class="num">${x.present}명</b> / 최소 <b class="num">${x.min}명</b>${x.short ? ` — <b>${x.excess}명 조정 필요</b>` : ' — 여유 있어요'}</p><p class="small">${who.join(', ')}</p>${x.buddy.length ? `<p class="small">🔗 대행자 동시 부재: ${x.buddy.map(([a, b]) => nmOf(t, a) + '·' + nmOf(t, b)).join(', ')}</p>` : ''}</div>`;
  }

  /* ---------- 배정 ---------- */
  const inputSig = (t, ws) => L.sha256(JSON.stringify([t.members, t.minStaff, t.holidayMode, t.custom, t.rule, [...L.latestWishes(ws).values()].map(w => [w.memberId, w.submittedAt, w.picks, w.need])]));
  function runAssign(t) { const ws = wishesOf(t.id); const r = L.assign(t, ws, calOf(t), { runAt: new Date().toISOString() }); r.inputSig = inputSig(t, ws); store.set(K.results(t.id), r); return r; }
  T.runAssign = () => runAssign(curTeam());
  function result() {
    const t = curTeam(); if (!t) return needTeam('배정 결과', 'result');
    const ws = wishesOf(t.id); const r = store.get(K.results(t.id), null); const latest = L.latestWishes(ws);
    if (!r) { render('<h1>배정 결과</h1>' + (latest.size ? emptyState('🎲', '아직 배정을 실행하지 않았어요', `제출 ${latest.size}/${t.members.length}명. 규칙·시드를 확인하고 실행하세요.`, '<button class="btn acc" id="run2">배정 실행</button><a class="btn ghost" href="#/collect">취합 보기</a>') : emptyState('📨', '제출된 희망이 없어요', '먼저 희망 코드를 모아 주세요.', '<a class="btn" href="#/collect">취합으로</a>')), '배정 결과 (실행 전)', 'result'); const b = $('#run2'); if (b) b.onclick = () => { runAssign(t); result(); }; return; }
    const stale = r.inputSig !== inputSig(t, ws); const nm = id => nmOf(t, id);
    const ap = r.assignments.filter(a => a.status === 'approved'); const alt = r.assignments.filter(a => a.status === 'alt');
    const row = a => { const al = r.alternatives.find(x => x.memberId === a.memberId);
      if (a.status === 'approved') return `<tr><td><b>${nm(a.memberId)}</b></td><td><span class="badge ok">${a.rank}순위 확정</span><br><span class="small">${esc(a.label)}</span></td><td><span class="num">${L.md(a.span.start)}~${L.md(a.span.end)}</span> <b class="num">${a.span.days}일</b><br><span class="small">연차 ${a.leave}일</span></td></tr>`;
      if (a.status === 'alt') return `<tr><td><b>${nm(a.memberId)}</b></td><td><span class="badge tmp">${al.none ? '직접 협의' : '대안 제안'}</span></td><td>${al.none ? '<span class="small">대안 없음 — 팀장 직접 협의</span>' : al.options.map(o => `<span class="num">${L.md(o.start)}~${L.md(o.end)}</span> <b class="num">${o.days}일</b>`).join('<br>')}</td></tr>`;
      return `<tr><td><b>${nm(a.memberId)}</b></td><td><span class="badge">제출 없음</span></td><td></td></tr>`; };
    render(`<h1>배정 결과 — ${esc(t.name)}</h1>
      ${stale ? '<div class="card warn" role="alert"><b>실행 뒤 제출이나 설정이 바뀌었어요.</b> 다시 실행해 결과를 갱신하세요.</div>' : ''}
      <section class="card soft"><p><b class="num">확정 ${ap.length}명</b> · <b class="num">대안 제안 ${alt.length}명</b> · ${r.minOk ? '<span class="badge ok">날짜별 최소 출근 인원 모두 지킴</span>' : '<span class="badge bad">최소 인원 확인 필요</span>'}</p><dl class="kv"><dt>규칙</dt><dd>${esc(L.RULE_NAME[r.rule.type])}</dd><dt>시드</dt><dd>${esc(r.rule.seed)} + ${esc(r.rule.deadline)}</dd><dt>해시</dt><dd class="num" id="seed-hash">${r.seedHash.slice(0, 16)}…</dd><dt>추첨 순서</dt><dd id="lot-order">${r.order.map(o => `${o.pos}.${nm(o.memberId)}`).join(' ')}</dd></dl></section>
      <section class="card"><h2>사람별 결과</h2><table class="tbl" id="res-tbl"><colgroup><col class="c1"><col class="c2"><col></colgroup><thead><tr><th scope="col">팀원</th><th scope="col">결과</th><th scope="col">휴무</th></tr></thead><tbody>${r.assignments.map(row).join('')}</tbody></table></section>
      ${r.alternatives.length ? `<section class="card" id="alts"><h2>조정이 필요한 분께 대안</h2>${r.alternatives.map(al => `<div class="pick"><h3>${nm(al.memberId)}</h3>${al.none ? '<p>대안 없음 — 팀장 직접 협의</p>' : `<ul class="list">${al.options.map(o => `<li><span><b class="num">${L.fmt(o.start)}~${L.fmt(o.end, 'y')}</b> ${o.days}일 · 연차 ${o.leave}일${o.sameMonth ? ' <span class="badge info">같은 달</span>' : ''}</span></li>`).join('')}</ul>`}<button class="btn ghost sm" data-adj="${al.memberId}">조정 안내문 복사</button></div>`).join('')}<label for="reply">대안 회신 기한(안내문에 표시)</label><input id="reply" type="date" value="${esc(t.replyBy || '')}"></section>` : ''}
      <details id="log"><summary>왜 이렇게 됐는지 (배정 로그 ${r.log.length}줄)</summary><ol>${r.log.map(l => `<li>${esc(l)}</li>`).join('')}</ol></details>
      <div class="actions"><button class="btn acc" id="notice">결정 공지 복사</button><a class="btn ghost" href="#/print">기록 인쇄(A4)</a><button class="btn ghost" id="csv">CSV 저장</button><button class="btn ghost" id="rerun">다시 실행해 확인</button></div>
      <section class="card"><h2>개인 .ics (캘린더)</h2><label for="apply">회사 연차 신청 기한 (알림용, 선택)</label><input id="apply" type="date" min="2026-11-01" max="2027-12-31" value="${esc(t.applyBy || '')}"><p class="small">확정 휴가 일정 + 휴가 30일 전 알림. 신청 기한을 넣으면 그날 일정도 함께 들어가요.</p><ul class="list">${ap.map(a => `<li><span>${nm(a.memberId)} <span class="small num">${L.md(a.span.start)}~${L.md(a.span.end)}</span></span><button class="btn ghost sm" data-ics="${a.memberId}" aria-label="${nm(a.memberId)} .ics 저장">.ics 저장</button></li>`).join('') || '<li class="small">확정된 휴가가 없어요.</li>'}</ul></section>`, '배정 결과', 'result');
    $('#notice').onclick = async () => { if (await privacy('결정 공지 복사')) copy(L.decisionNotice(t, r), '결정 공지를 복사했어요'); };
    $('#csv').onclick = async () => { if (await privacy('CSV 저장')) download(`${t.name}-2027-연차조율.csv`, L.toCSV(t, r), 'text/csv;charset=utf-8'); };
    $('#rerun').onclick = () => { const r2 = L.assign(t, ws, calOf(t), {}); const same = JSON.stringify(r2.assignments) === JSON.stringify(r.assignments) && r2.seedHash === r.seedHash && JSON.stringify(r2.log) === JSON.stringify(r.log); T.lastRerunSame = same; toast(same ? '같은 결과예요 ✓ 결정적 추첨' : '입력이 바뀌어 결과가 달라요 — 결과를 갱신했어요'); if (!same) { runAssign(t); result(); } };
    const rp = $('#reply'); if (rp) rp.onchange = () => { t.replyBy = rp.value; saveTeam(t); };
    $('#apply').onchange = () => { t.applyBy = $('#apply').value; saveTeam(t); };
    $$('[data-adj]').forEach(b => b.onclick = async () => { if (await privacy('조정 안내문 복사')) copy(L.adjustNotice(t, r, b.dataset.adj, t.replyBy ? L.fmt(t.replyBy) : ''), '조정 안내문을 복사했어요'); });
    $$('[data-ics]').forEach(b => b.onclick = async () => { const id = b.dataset.ics; if (!(await privacy('.ics 저장'))) return; const ev = L.memberEvents(t, r, id, t.applyBy); download(`2027-휴가-${(t.members.find(m => m.id === id) || {}).alias}.ics`, L.toICS(ev, { calName: t.name + ' 2027 휴가', uid: id }), 'text/calendar;charset=utf-8'); });
  }
  function printView() {
    const t = curTeam(); if (!t) return needTeam('결정 기록', 'result'); const r = store.get(K.results(t.id), null);
    if (!r) { render('<h1>결정 기록</h1>' + emptyState('🖨️', '배정 결과가 없어요', '배정을 실행한 뒤 기록을 인쇄할 수 있어요.', '<a class="btn" href="#/result">배정 결과로</a>'), '결정 기록 (결과 없음)', 'result'); return; }
    const nm = id => nmOf(t, id); const latest = L.latestWishes(wishesOf(t.id));
    const pl = p => p ? esc(p.label || p.dates.map(L.md).join('·')) : '—';
    const runKst = r.runAt ? new Date(new Date(r.runAt).getTime() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') + ' KST' : '';
    render(`<div class="no-print actions"><button class="btn acc" id="pr">인쇄 / PDF 저장</button><a class="btn ghost" href="#/result">결과로</a></div>
      <h1>${esc(t.name)} 2027 연휴 연차 조율 기록</h1><p class="small">작성일 ${esc(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))} · 배정 실행 ${esc(runKst)} · 팀 내 사전 조율 기록이며 법률 자문이 아님</p>
      <section class="card"><h2>규칙</h2><dl class="kv"><dt>규칙</dt><dd>${esc(L.RULE_NAME[r.rule.type])}</dd><dt>시드</dt><dd>${esc(r.rule.seed)} + ${esc(r.rule.deadline)}</dd><dt>SHA-256</dt><dd style="word-break:break-all;font-family:ui-monospace,monospace;font-size:.8rem">${r.seedHash}</dd><dt>최소 출근</dt><dd>${t.minStaff.default}명${Object.entries(t.minStaff.overrides || {}).map(([k, v]) => ` · ${esc(k)} ${v}명`).join('')}</dd><dt>대행자</dt><dd>${r.rule.forbidBuddy ? '동시 부재 금지' : '동시 부재 허용'}</dd><dt>회사 휴일</dt><dd>${t.holidayMode === 'official' ? '관공서 공휴일' : t.holidayMode === 'noSubstitute' ? '대체공휴일 미적용' : '직접 편집'}</dd></dl></section>
      <section class="card"><h2>제출 목록</h2><table class="tbl"><colgroup><col class="c1"><col><col></colgroup><thead><tr><th scope="col">팀원</th><th scope="col">1순위</th><th scope="col">2·3순위</th></tr></thead><tbody>${[...latest.values()].map(w => `<tr><td>${nm(w.memberId)}${w.need ? ' (필수)' : ''}</td><td>${pl(w.picks.find(p => p.rank === 1))}</td><td>${pl(w.picks.find(p => p.rank === 2))}<br>${pl(w.picks.find(p => p.rank === 3))}</td></tr>`).join('')}</tbody></table></section>
      <section class="card"><h2>배정 결과</h2><ul class="list">${r.assignments.map(a => `<li><span><b>${nm(a.memberId)}</b> ${a.status === 'approved' ? `${a.rank}순위 확정 — <span class="num">${fmtSpan(a.span)}</span> ${a.span.days}일(연차 ${a.leave}일)` : a.status === 'alt' ? esc(a.label) : '제출 없음'}</span></li>`).join('')}</ul></section>
      <section class="card"><h2>배정 로그</h2><ol class="small">${r.log.map(l => `<li>${esc(l)}</li>`).join('')}</ol></section>
      ${r.alternatives.length ? `<section class="card"><h2>대안 제시 이력</h2><ul class="list">${r.alternatives.map(al => `<li><span><b>${nm(al.memberId)}</b> ${al.none ? '대안 없음 — 팀장 직접 협의' : al.options.map(o => `${fmtSpan(o)} ${o.days}일`).join(' / ')}</span></li>`).join('')}</ul></section>` : ''}
      <p class="small">출처: 우주항공청 2027 월력요항, 관공서의 공휴일에 관한 규정 제2·3조 · 임시공휴일 미반영</p>`, '결정 기록 인쇄', 'result');
    $('#pr').onclick = async () => { if (await privacy('기록 인쇄')) window.print(); };
  }

  /* ---------- 팀원 제출 (#team=) ---------- */
  function member(code) {
    let t; try { t = L.decodeTeam(code); } catch (e) { return errorView('팀 링크를 열 수 없어요', '링크가 잘렸거나 손상됐어요. 팀장에게 링크를 다시 받거나, 전체를 복사해 [받은 링크 열기]에 붙여 넣으세요.'); }
    S.member = t; const cal = calOf(t); const dk = K.draft(t.id); const dr = store.get(dk, null) || { memberId: '', picks: {}, need: false }; dr.picks = dr.picks || {};
    const presets = S.H.presets; const optTxt = p => { const s = L.restSpan(cal, p.leave); return s ? `${p.title}: 연차 ${s.leave}일 → ${s.days}일 (${L.md(s.start)}~${L.md(s.end)})` : p.title; };
    const slot = r => { const v = (dr.picks[r] || {}).preset || ''; return `<div class="pick" id="pk${r}"><h3>${r}순위</h3><label class="sr-only" for="ps${r}">${r}순위 연휴</label><select id="ps${r}" data-r="${r}"><option value="">${r === 1 ? '연휴를 골라 주세요' : '선택 안 함'}</option>${presets.map(p => `<option value="${p.id}" ${v === p.id ? 'selected' : ''}>${esc(optTxt(p))}</option>`).join('')}<option value="custom" ${v === 'custom' ? 'selected' : ''}>달력에서 직접 고르기</option></select><div class="cus" ${v === 'custom' ? '' : 'hidden'}><div class="row" style="align-items:flex-end"><div style="flex:2 1 150px"><label for="cd${r}">연차 쓸 날</label><input id="cd${r}" type="date" min="2027-01-01" max="2027-12-31"></div><button class="btn ghost sm" type="button" data-add="${r}" style="flex:0 0 auto">날짜 추가</button></div><div class="dchips" id="ch${r}"></div></div><p class="sum" id="sm${r}"></p><p class="err" id="er${r}" hidden></p></div>`; };
    render(`<h1>희망 제출 — ${esc(t.name)}</h1><p class="lead">가입 없이 1·2·3순위를 고르고 <b>희망 코드</b>를 팀장에게 보내 주세요. 제출 마감 <b class="num">${esc(t.rule.deadline || '팀 공지 확인')}</b></p>
      <section class="card soft"><p class="small"><b>배정 규칙:</b> ${esc(L.RULE_NAME[t.rule.type])} · 추첨 시드 "${esc(t.rule.seed)}" · 최소 출근 ${t.minStaff.default}명${t.rule.forbidBuddy ? ' · 대행자 짝 동시 부재 조율' : ''}. 겹치면 다음 순위나 대안 날짜로 조율돼요.</p><p class="small">${tmpBadge} 회사 휴일: ${t.holidayMode === 'official' ? '관공서 공휴일' : t.holidayMode === 'noSubstitute' ? '대체공휴일 미적용' : '팀장이 직접 편집'}</p></section>
      ${t.under5 ? under5 : ''}
      <section class="card"><label for="who" style="margin-top:0">내 이름</label><select id="who"><option value="">이름을 골라 주세요</option>${t.members.map(m => `<option value="${m.id}" ${dr.memberId === m.id ? 'selected' : ''}>${esc(m.alias)}</option>`).join('')}</select><p class="err" id="er0" hidden></p></section>
      ${slot(1)}${slot(2)}${slot(3)}
      <label class="check"><input type="checkbox" id="need" ${dr.need ? 'checked' : ''}>꼭 필요한 사유가 있어요(가족 행사 등) — 내용은 적지 않아요</label>
      <div class="actions"><button class="btn acc" id="mk">희망 코드 만들기</button></div><div id="out"></div>`, `희망 제출: ${t.name}`, '');
    const getPick = r => { const p = dr.picks[r]; if (!p || !p.preset) return null; if (p.preset === 'custom') return { rank: r, dates: (p.dates || []).slice().sort(), label: '직접 선택', half: p.half || {} }; const pr = presets.find(x => x.id === p.preset); return pr ? { rank: r, dates: pr.leave.slice(), label: pr.title, half: {} } : null; };
    const save = () => store.set(dk, dr);
    const drawSlot = r => {
      const p = dr.picks[r] || {}; const box = $('#pk' + r); box.querySelector('.cus').hidden = p.preset !== 'custom';
      if (p.preset === 'custom') $('#ch' + r).innerHTML = (p.dates || []).slice().sort().map(d => { const h = (p.half || {})[d]; return `<span class="dchip"><span class="num">${L.fmt(d)}</span><button type="button" data-half="${r}|${d}">${h ? (h === 'am' ? '오전반차' : '오후반차') : '종일'}<span class="sr-only"> (${L.md(d)}, 눌러서 종일·오전반차·오후반차 바꾸기)</span></button><button type="button" data-del="${r}|${d}" aria-label="${L.md(d)} 빼기">✕</button></span>`; }).join('');
      const pk = getPick(r); const ld = pk ? L.pickDates(cal, pk) : []; const sp = pk && ld.length ? L.restSpan(cal, pk.dates) : null;
      $('#sm' + r).textContent = sp ? `이 선택으로 내 연차 ${L.leaveDays(cal, pk)}일 사용 → 총 ${sp.days}일 휴무 (${L.md(sp.start)}~${L.md(sp.end)}${sp.contiguous ? '' : ', 떨어진 구간 포함'})` : pk && pk.dates.length ? '고른 날이 모두 휴무일이라 연차가 필요 없어요' : '';
      $$(`[data-half^="${r}|"]`).forEach(b => b.onclick = () => { const d = b.dataset.half.split('|')[1]; p.half = p.half || {}; const nx = !p.half[d] ? 'am' : p.half[d] === 'am' ? 'pm' : null; if (nx) p.half[d] = nx; else delete p.half[d]; save(); drawSlot(r); const nb = $(`[data-half="${r}|${d}"]`); if (nb) nb.focus(); });
      $$(`[data-del^="${r}|"]`).forEach(b => b.onclick = () => { const d = b.dataset.del.split('|')[1]; p.dates = p.dates.filter(x => x !== d); if (p.half) delete p.half[d]; save(); drawSlot(r); });
    };
    [1, 2, 3].forEach(r => {
      $('#ps' + r).onchange = e => { const v = e.target.value; const old = dr.picks[r]; dr.picks[r] = v ? (v === 'custom' && old && old.preset === 'custom' ? old : { preset: v, dates: [], half: {} }) : null; save(); $('#er' + r).hidden = true; drawSlot(r); };
      $(`[data-add="${r}"]`).onclick = () => { const d = $('#cd' + r).value; const p = dr.picks[r]; const er = $('#er' + r);
        if (!L.isDate(d) || d < '2027-01-01' || d > '2027-12-31') { er.hidden = false; er.textContent = '2027년 날짜를 골라 주세요.'; $('#cd' + r).setAttribute('aria-invalid', 'true'); return; }
        if (cal.isOff(d)) { er.hidden = false; er.textContent = `${L.md(d)}은(는) 이미 쉬는 날이라 연차가 필요 없어요.`; return; }
        if ((p.dates || []).length >= 15) { er.hidden = false; er.textContent = '한 순위에 15일까지 고를 수 있어요.'; return; }
        er.hidden = true; $('#cd' + r).removeAttribute('aria-invalid'); p.dates = [...new Set((p.dates || []).concat([d]))]; save(); drawSlot(r); };
      drawSlot(r);
    });
    $('#who').onchange = e => { dr.memberId = e.target.value; save(); if (dr.memberId) { $('#er0').hidden = true; $('#who').removeAttribute('aria-invalid'); } };
    $('#need').onchange = e => { dr.need = e.target.checked; save(); };
    $('#mk').onclick = async () => {
      const er0 = $('#er0'); er0.hidden = !!dr.memberId; er0.textContent = '이름을 골라 주세요.'; $('#who').setAttribute('aria-invalid', String(!dr.memberId));
      const picks = [1, 2, 3].map(getPick).filter(p => p && L.pickDates(cal, p).length); const e1 = $('#er1');
      if (!picks.some(p => p.rank === 1)) { e1.hidden = false; e1.textContent = '1순위를 골라 주세요(직접 고를 땐 근무일을 1일 이상).'; } else e1.hidden = true;
      if (!dr.memberId || !picks.some(p => p.rank === 1)) { (dr.memberId ? $('#ps1') : $('#who')).focus(); return; }
      if (!(await privacy('희망 코드 만들기'))) return;
      const m = t.members.find(x => x.id === dr.memberId);
      const code = L.encodeWish({ teamId: t.id, memberId: m.id, alias: m.alias, picks, need: dr.need, submittedAt: new Date().toISOString() }); const link = baseURL() + '#wish=' + code.slice(3);
      const msg = `[${t.name}] 2027 연휴 희망 — ${m.alias}\n${picks.map(p => `${p.rank}순위 ${p.label}`).join(' / ')}\n${code}`;
      const mine = teams().find(x => x.id === t.id);
      $('#out').innerHTML = `<section class="card soft" id="wish-out"><h2>희망 코드가 만들어졌어요</h2><label for="wc">희망 코드</label><textarea id="wc" class="code" readonly>${esc(code)}</textarea><div class="actions"><button class="btn" id="cp-msg">카톡으로 보내기용 복사</button><button class="btn ghost" id="cp-link">링크로 복사</button>${mine ? '<button class="btn ghost" id="to-mine">이 기기 취합에 바로 추가</button>' : ''}</div><p class="small">${link.length > 2000 ? `링크가 ${link.length}자로 길어요. [카톡으로 보내기용 복사]로 코드를 보내 주세요.` : '다시 고치면 새 코드를 보내 주세요. 팀장 화면에서 최신본으로 바뀌어요.'}</p></section>`;
      T.lastWish = { code, link, msg };
      $('#cp-msg').onclick = () => copy(msg, '희망 코드를 복사했어요'); $('#cp-link').onclick = () => copy(link, '희망 링크를 복사했어요');
      const tm = $('#to-mine'); if (tm) tm.onclick = () => { setSettings({ cur: t.id }); const r = addWishes(mine, [L.decodeWish(code)]); toast(`추가 ${r.added} · 교체 ${r.replaced}`); };
      await copy(msg, '희망 코드를 복사했어요'); $('#wish-out').scrollIntoView({ block: 'center' });
    };
  }
  function wishImport(code) {
    let w; try { w = L.decodeWish('W1.' + code); } catch (e) { return errorView('희망 코드를 열 수 없어요', '링크가 잘렸거나 손상됐어요. 보낸 분께 코드를 다시 받아 [취합] 화면에 붙여 넣으세요.'); }
    const t = teams().find(x => x.id === w.teamId);
    if (!t) return errorView('이 기기에 해당 팀이 없어요', `${w.alias}님의 희망 코드예요. 팀을 만든 팀장 기기에서 열거나, 코드를 팀장에게 보내 주세요.`);
    setSettings({ cur: t.id }); const r = addWishes(t, [w]);
    render(`<h1>희망 코드 추가 — ${esc(t.name)}</h1><section class="card ${r.rej.length ? 'warn' : 'soft'}"><h2>${r.added ? '추가했어요' : r.replaced ? '최신본으로 교체했어요' : r.rej.length ? '추가하지 못했어요' : '이미 같은 제출이 있어요'}</h2><p>${esc(w.alias)} · ${w.picks.map(p => `${p.rank}순위 ${esc(p.label || p.dates.map(L.md).join('·'))}`).join(' / ')}</p>${r.rej.length ? `<p class="err">${r.rej.map(esc).join('<br>')}</p>` : ''}<div class="actions"><a class="btn" href="#/collect">취합 보기</a></div></section>`, `희망 코드 추가: ${w.alias}`, 'collect');
  }

  /* ---------- 출처·설정·기타 ---------- */
  function sources() {
    const H = S.H; const src = Object.entries(S.SRC.sources || {}); const off = L.calendar(H, 'official'); const subs = L.deriveSubstitutes(H); const st = L.runSelfTest(H);
    render(`<h1>데이터 출처와 계산 근거</h1><p class="lead">공휴일은 정부 발표 원문으로 확인했어요. 확인일 <b class="num">${esc(H.checkedAt)}</b> · ${tmpBadge}</p>
      <section class="card"><h2>2027 공휴일·대체공휴일</h2><table class="tbl"><colgroup><col class="c2"><col><col style="width:22%"></colgroup><thead><tr><th scope="col">날짜</th><th scope="col">이름</th><th scope="col">유형</th></tr></thead><tbody>${H.holidays.map(h => `<tr><td class="num">${L.fmt(h.date, 'y')}</td><td>${esc(h.name)}</td><td>${h.type === 'sub' ? '대체' : '공휴일'}</td></tr>`).join('')}</tbody></table>
      <p class="small">주5일 기준 휴무 계산 ${L.countRestDays(off).total}일(월력요항 ${H.official.fiveDayRestDays}일) · 관공서 공휴일 ${H.official.publicHolidays}일(일요일 포함) · 3일 이상 연휴 ${H.official.longWeekends3plus}번 · 2028-01-01은 연말 구간 계산용</p></section>
      <section class="card"><h2>대체공휴일 규칙 (코드로 재계산)</h2><p class="small">${esc(H.substituteRule.text)}</p><p class="small" id="derive">규칙을 다시 적용한 결과: ${subs.map(s => `${L.md(s.date)}(${esc(s.of)})`).join(', ')} — 표와 ${st.ok ? '<b>일치</b>' : '<b>불일치</b>'}. 자체 검사 ${st.ok ? '통과' : '실패: ' + esc(st.fails.join(' / '))}</p></section>
      <section class="card"><h2>출처</h2><ul class="list">${src.map(([, s]) => `<li><span><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><br><span class="small">${esc(s.used || '')}</span></span><span class="badge ${s.kind === 'primary' ? 'ok' : 'info'}">${s.kind === 'primary' ? '1차' : '보조'}</span></li>`).join('')}</ul></section>
      ${(S.SRC.unverified || []).length ? `<section class="card note"><h2>확인 필요</h2><ul class="small">${S.SRC.unverified.map(u => `<li>${esc(u)}</li>`).join('')}</ul></section>` : ''}
      <section class="card"><h2>계산 방법</h2><ul class="small"><li>휴무 구간: 연차 날짜 앞뒤로 토·일·공휴일을 이어 붙여 연속으로 쉬는 날을 세요.</li><li>공개 추첨: SHA-256(시드 + "|" + 마감일)로 해시를 만들고, 팀원마다 SHA-256(해시 + ":" + 팀원 ID) 값이 작은 순서가 추첨 순위예요. Web Crypto와 같은 값이에요(테스트로 대조).</li><li>배정: 1순위 → 2순위 → 3순위 차례로 묶음 전체를 승인하거나 다음 순위로 넘겨요. 어느 날이든 출근 인원이 최소 인원 아래로 내려가는 배정은 하지 않아요.</li><li>반차는 0.5명 부재로 계산해요.</li></ul></section>`, '데이터 출처·계산 근거', '');
  }
  function settingsView() {
    const ts = teams(); const c = curTeam();
    render(`<h1>설정 · 데이터 관리</h1>
      <section class="card"><h2>팀</h2>${ts.length ? `<label for="ts">지금 보는 팀</label><select id="ts">${ts.map(t => `<option value="${t.id}" ${c && c.id === t.id ? 'selected' : ''}>${esc(t.name)} (${t.members.length}명)</option>`).join('')}</select><div class="actions"><a class="btn ghost" href="#/team">팀 설정</a><button class="btn ghost" id="new-team">새 팀 만들기</button><button class="btn ghost" id="del-team">이 팀 삭제</button></div>` : '<p class="small">저장된 팀이 없어요.</p><div class="actions"><a class="btn" href="#/team">팀 만들기</a></div>'}</section>
      <section class="card"><h2>백업</h2><p class="small">팀·제출·결과를 JSON 파일로 저장하고 다른 기기에서 불러올 수 있어요.</p><div class="actions"><button class="btn ghost" id="exp">JSON 내보내기</button><label class="btn ghost" for="imp" style="margin:0">JSON 불러오기</label></div><input id="imp" type="file" accept="application/json,.json" class="sr-only"><p class="err" id="e6" hidden></p></section>
      <section class="card"><h2>모든 데이터 지우기</h2><p class="small">이 기기에 저장된 팀, 희망 제출, 배정 결과, 설정(tvm.* 키)을 모두 지워요. 되돌릴 수 없어요.</p><button class="btn ghost" id="wipe">모든 데이터 지우기</button></section>
      <section class="card"><h2>안내</h2><p class="small"><a href="privacy.html">개인정보 안내</a> · <a href="#/sources">데이터 출처</a> · 자체 검사 <b id="selftest">${L.runSelfTest(S.H).ok ? '통과' : '실패'}</b></p><button class="btn ghost sm" id="ob">처음 안내 다시 보기</button></section>`, '설정·데이터 관리', '');
    const tsel = $('#ts'); if (tsel) tsel.onchange = () => { setSettings({ cur: tsel.value }); S.edit = null; S.month = null; toast('팀을 바꿨어요'); };
    const nt = $('#new-team'); if (nt) nt.onclick = () => { S.edit = newTeam(); S.step = 1; location.hash = '#/team'; };
    const dt = $('#del-team'); if (dt) dt.onclick = async () => { const t = curTeam(); if (!(await dialog('팀 삭제', `<p><b>${esc(t.name)}</b> 팀과 제출·결과를 이 기기에서 지울까요?</p>`, '삭제'))) return; store.set(K.teams, teams().filter(x => x.id !== t.id)); store.del(K.wishes(t.id)); store.del(K.results(t.id)); store.del(K.draft(t.id)); setSettings({ cur: null }); S.edit = null; settingsView(); toast('삭제했어요'); };
    $('#exp').onclick = async () => { if (!(await privacy('JSON 내보내기'))) return; const o = { app: 'team-2027-holiday-leave-map', v: 1, exportedAt: new Date().toISOString(), data: {} }; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('tvm.')) o.data[k] = store.get(k, null); } download('2027-연휴지도-백업.json', JSON.stringify(o, null, 2), 'application/json'); };
    $('#imp').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const o = JSON.parse(rd.result); if (o.app !== 'team-2027-holiday-leave-map' || !o.data) throw new Error('x'); Object.entries(o.data).forEach(([k, v]) => { if (/^tvm\.[\w.-]+$/.test(k)) store.set(k, v); }); toast('불러왔어요'); S.edit = null; settingsView(); } catch (x) { show('#e6', ['이 앱에서 내보낸 JSON 파일이 아니에요.']); } }; rd.readAsText(f); };
    $('#wipe').onclick = async () => { if (!(await dialog('모든 데이터 지우기', '<p>이 기기의 팀·제출·결과·설정을 모두 지울까요? 되돌릴 수 없어요.</p>', '모두 지우기'))) return; const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('tvm.')) ks.push(k); } ks.forEach(k => store.del(k)); S.edit = null; S.month = null; toast('모두 지웠어요'); settingsView(); };
    $('#ob').onclick = () => { setSettings({ onboarded: false }); location.hash = '#/'; };
  }
  function errorView(h, p) { render(`<h1>${esc(h)}</h1>` + emptyState('⚠️', '다시 시도해 주세요', esc(p), '<a class="btn" href="#/">홈으로</a><a class="btn ghost" href="#open">받은 링크 열기</a>'), '오류: ' + h, ''); }
  T.errorView = errorView;
  function notFound() { render('<h1>페이지를 찾을 수 없어요</h1>' + emptyState('🧭', '없는 화면이에요', '주소가 바뀌었거나 잘못 입력됐어요.', '<a class="btn" href="#/">홈으로</a>'), '페이지 없음', ''); }

  /* ---------- 라우터 ---------- */
  function route() {
    const h = location.hash.replace(/^#/, '');
    try {
      if (h.startsWith('team=')) return member(h.slice(5));
      if (h.startsWith('wish=')) return wishImport(h.slice(5));
      if (h === 'open') { home(); setTimeout(() => { const o = $('#open'); if (o) { o.scrollIntoView({ block: 'center' }); $('#open-in').focus(); } }, 0); return; }
      const p = h.replace(/^\//, '').split('?')[0];
      ({ '': home, solo, team, rules, collect: collectView, result, print: printView, sources, settings: settingsView }[p] || notFound)();
    } catch (e) { console.warn(e); errorView('화면을 그리지 못했어요', '저장된 데이터가 손상됐을 수 있어요. [설정 → 모든 데이터 지우기] 후 다시 시도하세요.'); }
  }
  T.route = route;
  addEventListener('hashchange', () => { const h = location.hash; if (!h.startsWith('#team=') && h !== '#open') focusTop(); route(); });
  Promise.all(['data/holidays-2027.json', 'data/sources.json'].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); })))
    .then(([H, SRC]) => { S.H = H; S.SRC = SRC; T.ready = true; route(); })
    .catch(() => { render('<h1>데이터를 불러오지 못했어요</h1>' + emptyState('📡', '공휴일 데이터를 읽지 못했어요', '네트워크를 확인하고 새로고침해 주세요. 한 번 열었던 기기는 오프라인에서도 열려요.', '<button class="btn" id="reload">새로고침</button>'), '데이터 오류', ''); const b = $('#reload'); if (b) b.onclick = () => location.reload(); T.ready = 'error'; });
})();
