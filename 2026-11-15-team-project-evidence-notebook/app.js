/* 팀플 증거노트 — 화면. 데이터는 localStorage 'tpn:v1' 하나에만 저장 */
(function () {
  'use strict';
  const E = window.TPN; const KEY = 'tpn:v1';
  const $ = (s, r) => (r || document).querySelector(s); const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const S = { data: null, cfg: null, ui: {} }; const T = window.__tpn = { engine: E, S };
  const nowAt = () => E.localAt(new Date()); const today = () => nowAt().slice(0, 10);
  const uid = p => p + E.sha256(nowAt() + Math.random()).slice(0, 10);

  /* ---------- 아이콘 (SVG, 장식용) ---------- */
  const sv = d => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${d}</svg>`;
  const IC = {
    open: sv('<path d="M3 1.5v13M3 2h8l-2 3 2 3H3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
    done: sv('<path d="M2.5 8.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    doneLate: sv('<path d="M1.5 8.5l3 3 5-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="10" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 8.4V10h1.3" stroke="currentColor" stroke-width="1.3" fill="none"/>'),
    late: sv('<circle cx="8" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 5v4l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    noreply: sv('<path d="M2 3h12v8H7l-3 3v-3H2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 14L14 2" stroke="currentColor" stroke-width="1.6"/>'),
    request: sv('<path d="M1.5 7.5L14.5 2 10 14l-2.5-4.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
    agree: sv('<path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.2 1.2a2.8 2.8 0 01-4-4L5 7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
    memo: sv('<path d="M3 2h7l3 3v9H3z M10 2v3h3M5 8h6M5 11h4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
    meeting: sv('<circle cx="5" cy="5" r="2.3" fill="currentColor"/><circle cx="11" cy="5" r="2.3" fill="currentColor"/><path d="M1 14c0-3 2-4.5 4-4.5s4 1.5 4 4.5M7 14c0-3 2-4.5 4-4.5s4 1.5 4 4.5" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
    absent: sv('<circle cx="7" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 14c0-3 2.2-4.8 5-4.8M10.5 10.5l4 4M14.5 10.5l-4 4" fill="none" stroke="currentColor" stroke-width="1.6"/>'),
    edited: sv('<path d="M2.5 13.5l1-3.5 7.5-7.5 2.5 2.5L6 12.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'),
    tamper: sv('<path d="M8 1.5l5.5 2v4c0 3.5-2.4 5.9-5.5 7-3.1-1.1-5.5-3.5-5.5-7v-4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.6"/>'),
    ok: sv('<path d="M8 1.5l5.5 2v4c0 3.5-2.4 5.9-5.5 7-3.1-1.1-5.5-3.5-5.5-7v-4z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.2 8.2l2 2 3.6-4" fill="none" stroke="currentColor" stroke-width="1.7"/>'),
    high: sv('<path d="M8 1.5L15 14H1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 6v4" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="12" r="1" fill="currentColor"/>'),
    mid: sv('<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 4.5v4.5" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/>'),
    low: sv('<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5 8.2l2 2 4-4.2" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
    deleted: sv('<path d="M3 4h10M6 4V2.5h4V4M4.5 4l.8 10h5.4l.8-10" fill="none" stroke="currentColor" stroke-width="1.5"/>')
  };
  const LABEL = { open: '진행 중', done: '완료', doneLate: '기한 후 완료', late: '지연', noreply: '무응답', request: '요청', agree: '합의', memo: '메모', meeting: '회의 참석', absent: '회의 불참', edited: '수정됨', tamper: '변조 의심', ok: '검증 통과', deleted: '삭제 표시', promise: '맡음' };
  const chip = (k, text) => `<span class="st st-${k}">${IC[k] || ''}${esc(text || LABEL[k])}</span>`;
  const RISK = { high: '특정 가능성 높음', mid: '특정 가능성 중간', low: '특정 가능성 낮음' };
  const rchip = l => `<span class="rk rk-${l}">${IC[l]}${RISK[l]}</span>`;
  const LEGEND_KEYS = ['open', 'done', 'doneLate', 'late', 'noreply', 'request', 'agree', 'absent', 'edited', 'tamper'];
  const LEGEND_DESC = { open: '파란 실선', done: '초록 굵은 실선', doneLate: '초록 실선+시계', late: '주황 점선(대시)', noreply: '보라 점선(도트)', request: '회색 이중선', agree: '청록 실선', absent: '주황 왼쪽 굵은 선', edited: '회색 점선', tamper: '빨간 이중선' };
  const legend = (keys, title) => `<div class="legendbox"><p class="small" style="margin:8px 0 0"><b>${esc(title || '표시 읽는 법')}</b> — 색·테두리 모양·아이콘·글자로 구분해요</p><ul class="legend" aria-label="${esc(title || '표시 읽는 법')}">${(keys || LEGEND_KEYS).map(k => `<li>${chip(k)}<span>${LEGEND_DESC[k]}</span></li>`).join('')}</ul></div>`;
  const lvBadge = l => `<span class="lv l${l}" aria-hidden="true">${l || '–'}</span>`;

  /* ---------- 저장 ---------- */
  const blank = () => ({ version: 1, projects: [], current: null, meta: { semesterEnd: '', events: { copyMsg: 0, report: 0, passInterest: 0 }, checklistHidden: false } });
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.version === 1 && Array.isArray(d.projects)) return d; } catch (e) { /* 손상 → 새로 */ } return blank(); }
  function save() { localStorage.setItem(KEY, JSON.stringify(S.data)); }
  const proj = () => S.data.projects.find(p => p.id === S.data.current) || null;
  const bump = k => { S.data.meta.events[k] = (S.data.meta.events[k] || 0) + 1; save(); };
  const memberName = (p, id) => { const m = p.members.find(x => x.id === id); return m ? m.name : '알 수 없음'; };
  function setEntries(p, entries) { p.entries = entries; save(); }

  /* ---------- 대화상자·토스트·복사·내려받기 ---------- */
  function ask(title, html, okText, cancelText) {
    return new Promise(res => { const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-b').innerHTML = html; $('#dlg-ok').textContent = okText || '확인'; $('#dlg-no').textContent = cancelText || '취소'; $('#dlg-no').hidden = cancelText === null; d.returnValue = ''; d.onclose = () => res(d.returnValue === 'ok'); d.showModal(); });
  }
  const PRIV = '<p>이 내용에는 <b>팀원 이름·대화 인용 같은 개인정보</b>가 들어 있을 수 있어요.</p><ul class="small"><li>필요한 사람(팀원·교수님·조교)에게만 보내 주세요.</li><li>에브리타임 같은 공개 게시판에는 올리지 마세요.</li><li>필요하면 [이니셜] 표기로 바꿀 수 있어요.</li></ul>';
  const privacy = what => ask('개인정보 확인', `<p><b>${esc(what)}</b> 전에 확인해 주세요.</p>` + PRIV, '확인하고 계속', '취소');
  let toastTimer; function toast(msg, action) { const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button" id="toast-act">${esc(action.label)}</button>` : ''); t.classList.add('on'); clearTimeout(toastTimer); if (action) $('#toast-act').onclick = () => { t.classList.remove('on'); action.run(); }; toastTimer = setTimeout(() => t.classList.remove('on'), action ? 8000 : 2600); }
  async function copy(text, label) {
    T.lastCopy = text; let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (x) { ok = false; } ta.remove(); }
    if (!ok) toast('복사하지 못했어요. 글자를 길게 눌러 직접 복사해 주세요.'); else if (label) toast(label); return ok;
  }
  function download(name, data, type) { const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain;charset=utf-8' }); T.lastDownload = { name, size: blob.size, text: typeof data === 'string' ? data : null }; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- 라우터 ---------- */
  const TITLES = { home: '팀플 증거노트 — 저격 대신 기록, 조별과제 대응 키트', dash: '홈 | 팀플 증거노트', setup: '과목 만들기 | 팀플 증거노트', setupEdit: '과목 정보 수정 | 팀플 증거노트', import: '카톡 가져오기 | 팀플 증거노트', ledger: '기여 장부 | 팀플 증거노트', msg: '요청 문구 | 팀플 증거노트', report: '교수님께 낼 한 장 | 팀플 증거노트', peer: '동료평가 초안 | 팀플 증거노트', check: '공개글 점검 | 팀플 증거노트', agree: '팀 합의문 | 팀플 증거노트', recv: '합의문 확인 | 팀플 증거노트', settings: '설정 | 팀플 증거노트', sources: '출처 | 팀플 증거노트', more: '더보기 | 팀플 증거노트', nf: '페이지를 찾을 수 없어요 | 팀플 증거노트', err: '불러오기 오류 | 팀플 증거노트' };
  function render(html, key, tab) {
    const v = $('#view'); v.innerHTML = html; document.title = TITLES[key] || TITLES.home; T.route = key;
    $$('.tabs a').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === tab)); $$('.tabs a').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#fab').hidden = !proj() || !['dash', 'ledger'].includes(key);
  }
  function route() {
    const h = location.hash || '#/';
    if (h.startsWith('#agree=')) return viewRecv(h.slice(7));
    const [path, qs] = h.replace(/^#\/?/, '').split('?'); const q = new URLSearchParams(qs || ''); S.ui.q = q;
    const p = proj(); const need = fn => p ? fn(p) : viewNeedProject();
    const r = { '': () => p ? viewDash(p) : viewLanding(), setup: viewSetup, import: () => need(viewImport), ledger: () => need(viewLedger), msg: () => need(viewMsg), report: () => need(viewReport), peer: () => need(viewPeer), check: viewCheck, agree: () => p ? viewAgree(p) : viewSetup('agree'), settings: viewSettings, sources: viewSources, more: viewMore }[path];
    (r || viewNF)(); window.scrollTo(0, 0); if (S.ui.focus !== false) { const h1 = $('#view h1'); if (h1 && T.booted) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); } } T.booted = true;
  }
  function viewNF() { render('<h1>페이지를 찾을 수 없어요</h1><p class="lead">주소가 잘못됐거나 지워진 화면이에요.</p><p><a class="btn" href="#/">홈으로</a></p>', 'nf', ''); }
  function viewNeedProject() { render('<h1>먼저 과목을 만들어 주세요</h1><div class="card soft"><p>과목명·마감일·팀원 이름만 있으면 30초면 돼요. 팀원은 앱에 가입하지 않아도 돼요.</p><div class="actions"><a class="btn" href="#/setup">과목 만들기</a><button class="btn ghost" id="demo-b" type="button">예시로 둘러보기</button></div></div>', 'nf', ''); $('#demo-b').onclick = loadDemo; }

  /* ---------- 예시 ---------- */
  function loadDemo() {
    const d = E.buildDemo(S.cfg.samples.android, S.cfg.P, nowAt()); const ex = S.data.projects.findIndex(p => p.id === 'p_demo');
    if (ex >= 0) S.data.projects.splice(ex, 1); S.data.projects.push(d.project); S.data.current = d.project.id; save(); toast('예시 과목(마케팅원론 3조)을 불러왔어요. 지어낸 대화예요.');
    if (location.hash === '#/' || !location.hash) route(); else location.hash = '#/';
  }
  T.loadDemo = loadDemo;

  /* ---------- 첫 화면 ---------- */
  function previewHTML() {
    try {
      const d = E.buildDemo(S.cfg.samples.android, S.cfg.P, nowAt()).project; const r = E.buildReport(d, {}, nowAt());
      const rows = r.roles.filter(x => ['도윤', '준호', '민지'].includes(x.name)).slice(0, 3);
      return `<div class="preview" aria-label="보고서 미리보기(예시)"><p class="pt">📄 교수님께 낼 한 장 — 예시</p><p class="small">${esc(r.summary[0])}</p><table class="tbl"><colgroup><col style="width:22%"><col><col style="width:34%"></colgroup><thead><tr><th scope="col">팀원</th><th scope="col">맡은 일 · 기한</th><th scope="col">상태</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.task)} <span class="num">${E.md(x.due)}</span></td><td>${chip(x.status)}</td></tr>`).join('')}</tbody></table><p class="small" style="margin-top:6px">기록 해시 <span class="mono">${esc(r.hashShort)}</span> · 자기 기록 기반 참고 자료</p></div>`;
    } catch (e) { return ''; }
  }
  function viewLanding() {
    render(`<section class="hero"><span class="badge-safe">🔒 대화는 업로드되지 않아요 · 서버 없음</span>
      <h1>팀플 증거노트</h1><p class="lead"><span class="mark">싸우지 말고, 날짜로 말하세요.</span> 카톡 대화를 붙여 넣으면 누가 언제 무엇을 맡았고 지켰는지 장부가 되고, 감정 없는 요청 문구와 교수님께 낼 A4 한 장까지 이어져요.</p>
      <div class="stack" style="margin-top:12px"><a class="btn block" href="#/setup">지금 상황 정리하기</a><a class="btn ghost block" href="#/agree">팀 시작 전 합의문 만들기</a><button type="button" class="btn ghost block" id="demo">예시로 둘러보기</button></div></section>
      <section class="card"><h2>3분 뒤 이런 한 장이 나와요</h2>${previewHTML()}</section>
      <section class="card"><h2>이렇게 써요</h2><ol class="steps3"><li><b>① 기록</b>카톡 내보내기 붙여넣기 → 약속·완료 후보 채택</li><li><b>② 말하기</b>1·2·3단계 사실형 요청 문구 복사</li><li><b>③ 보고</b>A4 사실 보고서·근거 붙은 동료평가 초안</li></ol>
      <p class="small" style="margin-top:8px">팀원은 앱에 가입하지 않아도 돼요. 갈등이 생긴 뒤에 혼자 시작해도 지난 대화로 소급 정리할 수 있어요.</p></section>
      <section class="card note"><h2>저격글 쓰기 전에</h2><p>실명이 없어도 과목명·학과·단톡 캡처로 사람을 알아볼 수 있으면 법적 분쟁이 될 수 있어요. 올리기 전에 <a href="#/check">공개글 점검</a>으로 특정 가능성을 확인하고, 공식 경로(문구·교수 상담·보고서)를 먼저 써 보세요.</p></section>
      <p class="small">팀원끼리 비교하는 점수나 줄 세우기는 만들지 않아요. 모든 표시는 내 기록에 기반한 참고 자료예요.</p>`, 'home', 'home');
    $('#demo').onclick = loadDemo;
  }

  /* ---------- 홈(대시보드) ---------- */
  function dday(p) { if (!p.deadline) return ''; const n = E.diffDays(p.deadline.slice(0, 10), today()); return n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `마감 ${-n}일 지남`; }
  function viewDash(p) {
    const at = nowAt(); const st = E.projectStep(p, at); const v = E.verifyChain(p.entries);
    const others = p.members; const sums = others.map(m => ({ m, s: E.memberSummary(p, m.id, at), step: m.me ? { level: 0 } : E.stepFor(p, m.id, at) }));
    const maxSize = Math.max(1, ...sums.map(x => x.s.sizeDone)); const sem = S.data.meta.semesterEnd && today() >= S.data.meta.semesterEnd;
    const ck = [['과목 만들기', true], ['카톡 가져오기 또는 기록 3개', p.entries.length >= 3], ['요청 문구 복사', (p.steps || []).length > 0 || S.data.meta.events.copyMsg > 0], ['보고서 만들기', S.data.meta.events.report > 0]];
    render(`${sem ? `<div class="card note" role="alert"><b>학기 종료일(${esc(S.data.meta.semesterEnd)})이 지났어요.</b> 필요한 보고서를 저장했다면 <a href="#/settings">설정 → 백업·전체 삭제</a>에서 기록을 지워 주세요.</div>` : ''}
      ${!v.ok ? `<div class="card err" role="alert">${chip('tamper')} <b>장부 체인 검증에 실패했어요.</b> ${v.bad.map(i => i + 1).join(', ')}번째 항목이 앱 밖에서 바뀐 것 같아요. <a href="#/ledger">장부에서 확인</a></div>` : ''}
      <h1>${esc(p.course)} <span class="small">${esc(p.title || '')}</span></h1>
      ${S.data.projects.length > 1 ? `<label for="psw" class="sr-only">과목 전환</label><select id="psw">${S.data.projects.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.course)}${x.demo ? ' (예시)' : ''}</option>`).join('')}</select>` : ''}
      <section class="card soft" id="stepcard"><p class="small" style="margin:0">최종 마감 <b class="num">${p.deadline ? esc(E.mdw(p.deadline.slice(0, 10)) + ' ' + p.deadline.slice(11, 16)) : '미정'}</b> · <b class="num">${dday(p)}</b>${p.demo ? ' · <span class="st st-memo">예시 데이터</span>' : ''}</p>
        <div class="stepbox" style="margin-top:8px">${lvBadge(st.level)}<div><b id="step-label">지금 단계: ${esc(E.LEVEL_NAME[st.level])}${st.level ? ' 권장' : ''}${st.memberId ? ' · ' + esc(memberName(p, st.memberId)) : ''}</b><span class="small">${st.reasons.length ? esc(st.reasons.join(' · ')) : '기한이 지난 작업이나 오래된 무응답이 없어요. 기록만 이어 가면 돼요.'}</span></div></div>
        ${st.level ? `<div class="actions"><a class="btn" href="#/msg?m=${esc(st.memberId)}&level=${st.level}">${st.level}단계 문구 만들기</a>${st.level >= 3 ? '<a class="btn ghost" href="#/report">보고서 만들기</a>' : ''}</div>` : ''}</section>
      ${!S.data.meta.checklistHidden && !ck.every(x => x[1]) ? `<section class="card" id="checklist"><h2>시작 체크리스트</h2><ul class="list">${ck.map(([t, ok]) => `<li>${ok ? chip('done', '완료') : chip('open', '할 일')} ${esc(t)}</li>`).join('')}</ul><div class="actions"><a class="btn sm" href="#/import">카톡 가져오기</a><button class="btn ghost sm" type="button" id="ck-hide">체크리스트 숨기기</button></div></section>` : ''}
      <section class="card"><h2>팀원별 기록</h2><p class="small">입력한 순서대로 보여요. 팀원끼리 비교하는 점수는 만들지 않아요.</p>
        <div class="cards" role="list" tabindex="0" aria-label="팀원별 기록 카드(옆으로 넘겨 보기)">${sums.map(({ m, s, step }) => `<article class="mcard" role="listitem"><h3>${esc(m.name)}${m.me ? ' <span class="st st-memo">나</span>' : ''}${step.level ? ` <span class="steptag">${lvBadge(step.level)}<span>${step.level}단계 권장</span></span>` : ''}</h3><p class="small" style="margin:0">${esc(m.role || '역할 미정')}</p>
          <div class="chips" style="margin-top:6px">${chip('open', '맡음 ' + s.taken)}${chip('done', '완료 ' + (s.done + s.doneLate))}${chip('late', '지연 ' + s.late)}</div>
          <dl class="kv"><dt>기한 준수율</dt><dd class="num">${s.onTime === null ? '판단 전' : s.onTime + '%'}</dd><dt>최장 무응답</dt><dd class="num">${s.longest}일</dd><dt>마지막 활동</dt><dd class="num">${s.last ? E.mdw(s.last.slice(0, 10)) : '기록 없음'}</dd>${s.mentions ? `<dt>이후 불린 횟수</dt><dd class="num">${s.mentions}건</dd>` : ''}</dl></article>`).join('')}</div>
        ${legend(['open', 'done', 'late'], '카드 표시')}</section>
      <section class="card"><h2>완료 분량 <span class="st st-memo">참고용 · 자기 기록 기반</span></h2><p class="small">작업 크기(S=1·M=2·L=3)는 내가 정한 값이에요. 공개 비교용이 아니에요.</p>
        <div class="bars">${sums.map(({ m, s }) => `<div class="bl"><span>${esc(m.name)}</span><span class="bar" role="img" aria-label="${esc(m.name)} 완료 분량 ${s.sizeDone}"><i style="width:${Math.round(s.sizeDone / maxSize * 100)}%"></i></span><span class="num small">${s.sizeDone}</span></div>`).join('')}</div></section>
      <section class="card"><h2>타임라인</h2>${timeline(p, at)}${legend(['done', 'late', 'open', 'request', 'noreply'], '타임라인 점')}</section>
      <section class="card"><h2>다음에 할 일</h2><div class="stack"><a class="btn ghost block" href="#/import">카톡 대화 가져오기</a><a class="btn ghost block" href="#/report">교수님께 낼 한 장</a><a class="btn ghost block" href="#/peer">동료평가 초안</a></div></section>`, 'dash', 'home');
    const sw = $('#psw'); if (sw) sw.onchange = () => { S.data.current = sw.value; save(); route(); };
    const h = $('#ck-hide'); if (h) h.onclick = () => { S.data.meta.checklistHidden = true; save(); route(); };
  }
  function timeline(p, at) {
    const es = E.live(p.entries).filter(e => e.at); if (!es.length) return '<p class="small">아직 기록이 없어요. 카톡을 가져오거나 [+ 기록]으로 추가해 보세요.</p>';
    const t0 = es.map(e => e.at.slice(0, 10)).sort()[0]; let start = E.addDays(t0, -((E.weekday(t0) + 6) % 7)); const endD = [today(), p.deadline ? p.deadline.slice(0, 10) : today()].sort().pop(); let end = E.addDays(endD, 7 - ((E.weekday(endD) + 6) % 7));
    if (E.diffDays(end, start) > 70) start = E.addDays(end, -70); const span = E.diffDays(end, start); const pos = d => Math.max(0, Math.min(100, E.diffDays(d.slice(0, 10), start) / span * 100));
    const kind = e => e.type === 'promise' ? E.promiseStatus(e, p.entries, at).status.replace('doneLate', 'done') : e.type; const row = { done: 0, late: 1, open: 1, request: 2, noreply: 3 };
    const items = es.filter(e => e.at.slice(0, 10) >= start).map(e => ({ k: kind(e), x: pos(e.type === 'promise' && e.due ? e.due : e.at), e })).filter(x => row[x.k] !== undefined);
    let h = '<div class="tlwrap"><div class="tl" role="img" aria-label="' + esc(`${E.md(start)}부터 ${E.md(end)}까지 기록 ${items.length}개, 오늘 ${E.md(today())}${p.deadline ? ', 최종 마감 ' + E.md(p.deadline) : ''}`) + '">';
    for (let d = start; d <= end; d = E.addDays(d, 7)) h += `<span class="wkl" style="left:${pos(d)}%"></span>${pos(d) < 96 ? `<span class="wk num" style="left:${Math.max(4, pos(d))}%">${E.md(d)}</span>` : ''}`;
    items.forEach(it => { h += `<span class="dot d-${it.k}" style="left:${it.x}%;bottom:${8 + row[it.k] * 20}px" title="${esc(E.md(it.e.at) + ' ' + memberName(p, it.e.memberId) + ' ' + (it.e.task || LABEL[it.k]))}"></span>`; });
    if (p.deadline && p.deadline.slice(0, 10) <= end) h += `<span class="flag" style="left:${pos(p.deadline)}%"><span>⚑ 마감</span></span>`;
    h += `<span class="today" style="left:${pos(today())}%"><span>오늘</span></span></div></div>`;
    return h;
  }

  /* ---------- 과목 만들기 ---------- */
  function viewSetup(next) {
    next = typeof next === 'string' ? next : (S.ui.q && S.ui.q.get('next')) || ''; const edit = S.ui.q && S.ui.q.get('edit') === '1' && proj(); const p = edit ? proj() : null;
    const ms = p ? p.members.map(m => Object.assign({}, m)) : [{ id: 'm1', name: '', me: true, role: '' }, { id: 'm2', name: '', role: '' }, { id: 'm3', name: '', role: '' }];
    S.ui.setup = ms;
    render(`<h1>${p ? '과목 정보 수정' : '과목 만들기'}</h1><p class="lead">30초면 돼요. 팀원은 별명으로 적어도 돼요.</p>
      <form id="sf" novalidate class="card">
        <label for="f-course">과목명 <span class="small">(필수)</span></label><input type="text" id="f-course" value="${esc(p ? p.course : '')}" placeholder="예: 마케팅원론" autocomplete="off" aria-describedby="e-course"><p class="errtxt" id="e-course" hidden></p>
        <label for="f-title">과제명</label><input type="text" id="f-title" value="${esc(p ? p.title : '')}" placeholder="예: 설문 기반 보고서" autocomplete="off">
        <div class="two"><div><label for="f-dd">최종 마감일 <span class="small">(필수)</span></label><input type="date" id="f-dd" value="${esc(p && p.deadline ? p.deadline.slice(0, 10) : '')}" aria-describedby="e-dd"></div><div><label for="f-dt">시각</label><input type="time" id="f-dt" value="${esc(p && p.deadline ? p.deadline.slice(11, 16) : '23:59')}"></div></div><p class="errtxt" id="e-dd" hidden></p>
        <label for="f-mid">중간 마감 <span class="small">(선택)</span></label><input type="date" id="f-mid" value="${esc(p && p.midDeadlines && p.midDeadlines[0] ? p.midDeadlines[0].slice(0, 10) : '')}">
        <label class="check"><input type="checkbox" id="f-peer" ${p && p.peerEval && p.peerEval.used ? 'checked' : ''}> 동료평가가 성적에 반영돼요</label>
        <div id="peerw" ${p && p.peerEval && p.peerEval.used ? '' : 'hidden'}><label for="f-peerw">반영 비율(%)</label><input type="number" id="f-peerw" min="0" max="100" inputmode="numeric" value="${esc(p && p.peerEval ? p.peerEval.weightPct || '' : '')}"></div>
        <h2 style="margin-top:16px">팀원</h2><p class="hint">나를 포함해 2명 이상. [나]는 한 명만 고를 수 있어요.</p><div id="mlist"></div><p class="errtxt" id="e-m" hidden></p>
        <button type="button" class="btn ghost block" id="madd">＋ 팀원 추가</button>
        <div class="actions"><button class="btn" type="submit">${p ? '저장' : next === 'agree' ? '저장하고 합의문 만들기' : '저장하고 카톡 가져오기'}</button></div>
      </form>`, p ? 'setupEdit' : 'setup', '');
    const draw = () => { $('#mlist').innerHTML = S.ui.setup.map((m, i) => `<fieldset class="card" style="margin:8px 0;padding:10px"><legend class="small">팀원 ${i + 1}</legend><div class="two"><div><label for="mn${i}">이름·별명</label><input type="text" id="mn${i}" data-i="${i}" data-k="name" value="${esc(m.name)}" autocomplete="off"></div><div><label for="mr${i}">역할</label><input type="text" id="mr${i}" data-i="${i}" data-k="role" value="${esc(m.role || '')}" placeholder="예: 설문 분석" autocomplete="off"></div></div><div class="row"><label class="check" style="margin:0"><input type="radio" name="me" value="${i}" ${m.me ? 'checked' : ''}> 나</label>${S.ui.setup.length > 2 ? `<button type="button" class="btn ghost sm" data-del="${i}" aria-label="팀원 ${i + 1} 빼기">빼기</button>` : ''}</div></fieldset>`).join(''); };
    draw();
    $('#mlist').addEventListener('input', e => { const t = e.target; if (t.dataset.k) S.ui.setup[+t.dataset.i][t.dataset.k] = t.value; });
    $('#mlist').addEventListener('change', e => { if (e.target.name === 'me') S.ui.setup.forEach((m, i) => { m.me = i === +e.target.value; }); });
    $('#mlist').addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { S.ui.setup.splice(+d.dataset.del, 1); if (!S.ui.setup.some(m => m.me)) S.ui.setup[0].me = true; draw(); } });
    $('#madd').onclick = () => { const ids = S.ui.setup.map(m => +String(m.id).replace(/\D/g, '') || 0); S.ui.setup.push({ id: 'm' + (Math.max(0, ...ids) + 1), name: '', role: '' }); draw(); $('#mn' + (S.ui.setup.length - 1)).focus(); };
    $('#f-peer').onchange = e => { $('#peerw').hidden = !e.target.checked; };
    const err = (id, msg, field) => { const el = $('#' + id); el.hidden = !msg; el.textContent = msg || ''; if (field) field.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !!msg; };
    $('#sf').onsubmit = e => {
      e.preventDefault(); const course = $('#f-course').value.trim(); const dd = $('#f-dd').value; const members = S.ui.setup.map(m => Object.assign({}, m, { name: m.name.trim(), role: (m.role || '').trim() })).filter(m => m.name);
      let bad = false; bad = err('e-course', course ? '' : '과목명을 적어 주세요.', $('#f-course')) || bad; bad = err('e-dd', E.isDate(dd) ? '' : '최종 마감일을 골라 주세요.', $('#f-dd')) || bad;
      const dup = members.length !== new Set(members.map(m => m.name)).size; bad = err('e-m', members.length < 2 ? '나를 포함해 팀원을 2명 이상 적어 주세요.' : dup ? '같은 이름이 두 번 있어요. 별명으로 구분해 주세요.' : !members.some(m => m.me) ? '[나]를 골라 주세요.' : '') || bad;
      if (bad) { const f = $('[aria-invalid=true]') || $('#mn0'); if (f) f.focus(); return; }
      const data = { course, title: $('#f-title').value.trim(), deadline: dd + 'T' + ($('#f-dt').value || '23:59'), midDeadlines: $('#f-mid').value ? [$('#f-mid').value + 'T23:59'] : [], peerEval: { used: $('#f-peer').checked, weightPct: +$('#f-peerw').value || 0 }, members };
      if (p) { Object.assign(p, data); save(); toast('과목 정보를 저장했어요.'); location.hash = '#/'; return; }
      const np = Object.assign({ id: uid('p_'), entries: [], steps: [], settings: { noReplyDays: 3, escalateHours: 48, nameStyle: 'full', keepRaw: false }, createdAt: nowAt() }, data);
      S.data.projects.push(np); S.data.current = np.id; save(); toast('과목을 만들었어요.'); location.hash = next === 'agree' ? '#/agree' : '#/import';
    };
  }

  /* ---------- 카톡 가져오기 ---------- */
  function viewImport(p) {
    const keep = p.settings.keepRaw;
    render(`<h1>카톡 대화 가져오기</h1><p class="lead">내보낸 대화(.txt·.csv)를 붙여 넣으면 약속·완료·요청 후보를 찾아 드려요. <b>업로드되지 않고 이 기기에서만 분석해요.</b></p>
      <details><summary>카톡 대화 내보내기 방법 (안드로이드·아이폰·PC·Mac)</summary><ul class="small">
        <li><b>안드로이드·아이폰</b>: 채팅방 → 오른쪽 위 메뉴(≡) → 채팅방 설정(톱니바퀴) → 대화 내용 내보내기 → 텍스트 메시지만 저장/보내기 → 파일로 저장하거나 나에게 메일 보내기</li>
        <li><b>Windows PC</b>: 채팅방 창에서 Ctrl+S 또는 메뉴의 대화 내보내기 → .txt 저장</li><li><b>Mac</b>: Cmd+S → .csv 저장</li></ul>
        <p class="small">메뉴 이름은 앱 버전에 따라 다를 수 있어요(카카오 공식 도움말에서 다시 확인 필요). <a href="kakao-export-guide/">자세한 안내</a></p></details>
      <section class="card"><label for="chat">대화 내용</label><textarea id="chat" placeholder="여기에 붙여 넣으세요" spellcheck="false" aria-describedby="chat-h">${esc(S.ui.importText || '')}</textarea><p class="hint" id="chat-h">아이폰·안드로이드·Windows PC(.txt), Mac(.csv) 형식을 읽어요.</p>
        <div class="row"><label class="btn ghost sm" for="chatf" style="margin:0">파일 선택</label><input type="file" id="chatf" accept=".txt,.csv,text/plain,text/csv" class="sr-only"><span class="small">예시 넣기:</span><button type="button" class="btn ghost sm" data-s="android">안드로이드</button><button type="button" class="btn ghost sm" data-s="ios">아이폰</button><button type="button" class="btn ghost sm" data-s="pc">PC</button></div>
        <label class="check"><input type="checkbox" id="keep" ${keep ? 'checked' : ''}> 원문도 이 기기에 보관하기 <span class="small">(기본 꺼짐 — 끄면 채택한 인용 200자만 저장)</span></label>
        <p class="errtxt" id="e-chat" hidden></p><div class="actions"><button type="button" class="btn" id="parse">분석하기</button><a class="btn ghost" href="#/">건너뛰고 직접 기록</a></div></section>
      <div id="res" aria-live="polite"></div>`, 'import', '');
    $$('[data-s]').forEach(b => { b.onclick = () => { $('#chat').value = S.cfg.samples[b.dataset.s]; S.ui.importText = $('#chat').value; }; });
    $('#chatf').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#chat').value = String(r.result); S.ui.importText = $('#chat').value; analyze(p); }; r.onerror = () => toast('파일을 읽지 못했어요.'); r.readAsText(f, 'utf-8'); };
    $('#chat').oninput = () => { S.ui.importText = $('#chat').value; };
    $('#parse').onclick = () => analyze(p);
    if (S.ui.imp && S.ui.importText) drawImport(p);
  }
  function analyze(p) {
    const text = $('#chat').value; const e = $('#e-chat');
    if (!text.trim()) { e.hidden = false; e.textContent = '대화 내용을 붙여 넣거나 파일을 골라 주세요.'; $('#chat').setAttribute('aria-invalid', 'true'); $('#chat').focus(); return; }
    e.hidden = true; $('#chat').removeAttribute('aria-invalid');
    const parsed = E.parseKakao(text, S.cfg.P); const cands = E.candidates(parsed, S.cfg.P, { today: today(), noReplyDays: p.settings.noReplyDays });
    const map = {}; parsed.speakers.forEach(s => { const m = p.members.find(x => x.name === s.name) || p.members.find(x => s.name.includes(x.name) || x.name.includes(s.name)); map[s.name] = m ? m.id : ''; });
    S.ui.imp = { parsed, cands, map, on: {}, tab: 'promise', edits: {} }; T.lastParse = parsed; drawImport(p);
  }
  function drawImport(p) {
    const I = S.ui.imp; const st = I.parsed.stats; const r = st.ratePct; const res = $('#res');
    if (!st.msg) { res.innerHTML = `<section class="card err" role="alert"><h2>대화를 읽지 못했어요</h2><p>카톡 대화 내보내기 형식이 아닌 것 같아요(인식한 메시지 0개, 인식 못 한 줄 ${st.unparsed}개). 위 [내보내기 방법]대로 다시 내보내거나, [건너뛰고 직접 기록]을 써 주세요.</p>${unparsedList(I.parsed)}</section>`; return; }
    const lvl = r >= 95 ? ['done', '잘 읽었어요', 'var(--done)'] : r >= 80 ? ['late', '일부 줄을 못 읽었어요', 'var(--late)'] : ['tamper', '형식을 확인해 주세요', 'var(--risk)'];
    const tabs = [['promise', '약속'], ['done', '완료'], ['request', '요청'], ['noreply', '무응답']]; const cnt = k => I.cands.filter(c => c.kind === k && I.map[c.name]).length; const nOn = Object.values(I.on).filter(Boolean).length;
    res.innerHTML = `<section class="card" id="rate-card"><h2>인식 결과</h2><div class="row" style="justify-content:space-between"><div><span class="big num" id="rate">${r}%</span><p class="small" style="margin:0">발화자·시각 인식률 · ${esc(st.formatName)} 형식</p></div>${chip(lvl[0], lvl[1])}</div>
        <div class="meter" role="img" aria-label="인식률 ${r}%"><i style="width:${r}%;background:${lvl[2]}"></i></div>
        <dl class="kv" id="rate-kv"><dt>인식한 메시지</dt><dd class="num" id="r-msg">${st.msg}줄</dd><dt>인식 못 한 줄</dt><dd class="num" id="r-bad">${st.unparsed}줄</dd><dt>여러 줄 메시지로 이어 붙임</dt><dd class="num">${st.cont}줄</dd><dt>날짜·알림·머리말</dt><dd class="num">${st.date + st.system + st.meta}줄</dd><dt>전체(빈 줄 제외)</dt><dd class="num">${st.lines}줄</dd></dl>
        <p class="small">인식률 = 인식한 메시지 ÷ (인식한 메시지 + 인식 못 한 줄). 인식 못 한 줄은 앞 메시지에 이어 붙였어요.</p>${unparsedList(I.parsed)}</section>
      <section class="card"><h2>대화 속 이름 ↔ 팀원</h2>${I.parsed.speakers.map((s, i) => `<div class="two" style="align-items:center"><label for="sp${i}" style="margin:6px 0">${esc(s.name)} <span class="small num">(${s.count}개)</span></label><select id="sp${i}" data-sp="${esc(s.name)}"><option value="">팀원 아님(제외)</option>${p.members.map(m => `<option value="${esc(m.id)}" ${I.map[s.name] === m.id ? 'selected' : ''}>${esc(m.name)}${m.me ? ' (나)' : ''}</option>`).join('')}</select></div>`).join('')}</section>
      <section class="card"><h2>후보 고르기</h2><p class="small">찾은 내용은 <b>후보</b>일 뿐이에요. 맞는 것만 ✓ 채택하고, 작업명·기한은 고칠 수 있어요.</p>
        <div class="seg" role="group" aria-label="후보 종류">${tabs.map(([k, l]) => `<button type="button" class="btn ghost sm" data-tab="${k}" aria-pressed="${I.tab === k}">${l} <span class="num">${cnt(k)}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn ghost sm" id="all-on">이 탭 모두 채택</button><button type="button" class="btn ghost sm" id="all-off">이 탭 모두 해제</button></div>
        <div id="clist">${I.cands.filter(c => c.kind === I.tab && I.map[c.name]).map(c => candHTML(p, c)).join('') || '<p class="small">이 종류의 후보가 없어요.</p>'}</div></section>
      <div class="actions"${nOn ? ' style="position:sticky;bottom:70px"' : ''}><button type="button" class="btn block" id="adopt" ${nOn ? '' : 'disabled'}>${nOn ? `채택한 ${nOn}개 장부에 넣기` : '후보를 ✓ 채택하면 넣을 수 있어요'}</button></div>`;
    $$('[data-sp]').forEach(s => { s.onchange = () => { I.map[s.dataset.sp] = s.value; drawImport(p); }; });
    $$('#res [data-tab]').forEach(b => { b.onclick = () => { I.tab = b.dataset.tab; drawImport(p); }; });
    $('#all-on').onclick = () => { I.cands.filter(c => c.kind === I.tab && I.map[c.name]).forEach(c => { I.on[c.id] = true; }); drawImport(p); };
    $('#all-off').onclick = () => { I.cands.filter(c => c.kind === I.tab).forEach(c => { I.on[c.id] = false; }); drawImport(p); };
    $('#clist').addEventListener('click', e => { const b = e.target.closest('[data-on]'); if (b) { I.on[b.dataset.on] = b.dataset.v === '1'; drawImport(p); const nb = $(`[data-on="${b.dataset.on}"][data-v="${b.dataset.v}"]`); if (nb) nb.focus(); } });
    $('#clist').addEventListener('input', e => { const t = e.target; if (t.dataset.ed) { I.edits[t.dataset.ed] = Object.assign(I.edits[t.dataset.ed] || {}, { [t.dataset.f]: t.value }); } });
    $('#adopt').onclick = () => adopt(p);
  }
  function unparsedList(parsed) { const u = parsed.unparsed; if (!u.length) return ''; return `<details><summary>인식 못 한 줄 ${u.length}개 보기</summary><ul class="small" id="unparsed">${u.slice(0, 8).map(x => `<li><span class="num">${x.n}번째 줄</span>: ${esc(x.line)}</li>`).join('')}</ul></details>`; }
  function candHTML(p, c) {
    const I = S.ui.imp; const on = !!I.on[c.id]; const ed = I.edits[c.id] || {}; const kc = { promise: 'open', done: 'done', request: 'request', noreply: 'noreply' }[c.kind];
    return `<article class="cand" data-on="${on}"><div class="top2"><span>${chip(kc, c.kind === 'promise' ? '약속' : LABEL[kc])} <b>${esc(c.name)}</b> <span class="small num">${E.md(c.at)} ${E.hm(c.at)}</span></span><span class="row"><button type="button" class="btn sm ${on ? '' : 'ghost'}" data-on="${c.id}" data-v="1" aria-pressed="${on}" aria-label="${esc(c.name + ' ' + E.md(c.at) + ' 후보 채택')}">✓ 채택</button><button type="button" class="btn ghost sm" data-on="${c.id}" data-v="0" aria-label="${esc(c.name + ' ' + E.md(c.at) + ' 후보 제외')}">✕</button></span></div>
      <p style="margin:6px 0"><span class="quote">${esc(c.quote)}</span></p>
      ${c.kind === 'promise' || c.kind === 'done' ? `<div class="two"><div><label for="t-${c.id}" class="small">작업명</label><input type="text" id="t-${c.id}" data-ed="${c.id}" data-f="task" value="${esc(ed.task != null ? ed.task : c.task)}"></div>${c.kind === 'promise' ? `<div><label for="d-${c.id}" class="small">기한${c.dueExpr ? ` <span class="num">(“${esc(c.dueExpr)}”)</span>` : ''}</label><input type="date" id="d-${c.id}" data-ed="${c.id}" data-f="due" value="${esc(ed.due != null ? ed.due : c.due)}"></div>` : ''}</div>` : ''}</article>`;
  }
  function adopt(p) {
    const I = S.ui.imp; const at = nowAt(); let es = p.entries.slice(); let n = 0;
    I.cands.forEach((c, k) => { if (!I.on[c.id] || !I.map[c.name]) return; const ed = I.edits[c.id] || {}; const cc = Object.assign({}, c, ed.task != null ? { task: ed.task.trim() } : {}, ed.due != null ? { due: ed.due } : {}); const e = E.entryFromCandidate(cc, I.map[c.name], at, k + ':' + es.length); if (c.kind === 'request') { const to = p.members.find(m => m.id !== I.map[c.name] && c.quote.includes(m.name)); if (to) e.meta = { to: to.id }; } es.push(e); n++; });
    es = E.rechain(es); p.entries = es; const meta = E.chatMeta(I.parsed, I.map, I.cands); p.chat = Object.assign({ importedAt: at }, meta); p.settings.keepRaw = $('#keep').checked;
    if (p.settings.keepRaw) p.raw = S.ui.importText; else delete p.raw;
    save(); S.ui.imp = null; S.ui.importText = ''; toast(`장부에 ${n}개를 넣었어요.`); location.hash = '#/';
  }

  /* ---------- 장부 ---------- */
  function entryChip(p, e, at) { if (e.deleted) return chip('deleted'); if (e.type === 'promise') return chip(E.promiseStatus(e, p.entries, at).status); return chip({ done: 'done', late: 'late', request: 'request', noreply: 'noreply', agree: 'agree', memo: 'memo', meeting: 'meeting', absent: 'absent' }[e.type] || 'memo', E.TYPES[e.type]); }
  function viewLedger(p) {
    const at = nowAt(); const v = E.verifyChain(p.entries); const f = S.ui.lf || (S.ui.lf = { m: '', t: '', s: '', del: false });
    if (!v.ok) { p.chainAlerts = p.chainAlerts || []; const key = v.bad.join(','); if (!p.chainAlerts.some(a => a.bad === key)) { p.chainAlerts.push({ at, bad: key }); save(); } }
    let es = p.entries.map((e, i) => ({ e, i })).filter(({ e }) => (f.del || !e.deleted) && (!f.m || e.memberId === f.m) && (!f.t || e.type === f.t));
    if (f.s) es = es.filter(({ e }) => e.type === 'promise' && E.promiseStatus(e, p.entries, at).status === f.s);
    es.sort((a, b) => (b.e.at || '') < (a.e.at || '') ? -1 : 1);
    render(`<h1>기여 장부</h1>
      <section class="card ${v.ok ? '' : 'err'}" id="chain">${v.ok ? chip('ok', '체인 검증 통과') : chip('tamper', '변조 의심')} <span class="small">항목 <b class="num">${v.count}</b>개 · 마지막 해시 <span class="mono">${esc((v.last || '').slice(0, 12))}</span></span>
        ${v.ok ? '' : `<p><b>${v.bad.map(i => i + 1).join(', ')}번째 항목</b>이 앱 밖에서 바뀐 것 같아요(해시가 맞지 않음). 보고서에도 이 사실이 표시돼요.</p>`}
        <p class="small">해시(SHA-256 체인)는 이 앱 안에서 기록이 고쳐졌는지 표시할 뿐, <b>법적 증거력을 보장하지 않아요</b>.</p></section>
      <section class="card"><div class="two"><div><label for="lf-m">사람</label><select id="lf-m"><option value="">모두</option>${p.members.map(m => `<option value="${esc(m.id)}" ${f.m === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div><div><label for="lf-t">유형</label><select id="lf-t"><option value="">모두</option>${Object.entries(E.TYPES).map(([k, l]) => `<option value="${k}" ${f.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <label for="lf-s">상태(맡은 작업)</label><select id="lf-s"><option value="">모두</option>${Object.entries(E.STATUS).map(([k, l]) => `<option value="${k}" ${f.s === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <label class="check"><input type="checkbox" id="lf-del" ${f.del ? 'checked' : ''}> 삭제 표시한 항목도 보기</label></section>
      <section class="card"><h2>기록 <span class="num small">${es.length}개</span></h2>${es.length ? `<ul class="list" id="elist">${es.map(({ e, i }) => `<li><button type="button" class="item" data-e="${esc(e.id)}"><span class="meta num">${e.at ? esc(E.md(e.at) + ' ' + E.hm(e.at)) : ''} · ${esc(memberName(p, e.memberId))}</span><br>${entryChip(p, e, at)} ${e.type === 'promise' ? '<span class="small">맡음</span> ' : ''}<b>${esc(e.task || (e.type === 'noreply' ? `${(e.meta && e.meta.days) || ''}일째 응답 없음` : e.type === 'request' ? '요청 메시지' + (e.meta && e.meta.to ? ' → ' + memberName(p, e.meta.to) : '') : ''))}</b>${e.due ? ` <span class="small num">기한 ${esc(E.md(e.due))}</span>` : ''}${(e.edits || []).filter(x => !('deleted' in x.before)).length ? ' ' + chip('edited', '수정됨 ' + e.edits.filter(x => !('deleted' in x.before)).length + '회') : ''}${v.bad.includes(i) ? ' ' + chip('tamper') : ''}${e.evidence && e.evidence.quote ? `<br><span class="quote small">${esc(e.evidence.quote.slice(0, 70))}${e.evidence.quote.length > 70 ? '…' : ''}</span>` : ''}</button></li>`).join('')}</ul>` : `<p class="small">조건에 맞는 기록이 없어요.</p><div class="actions"><a class="btn ghost sm" href="#/import">카톡 가져오기</a><button type="button" class="btn ghost sm" id="add2">＋ 기록</button></div>`}
      ${legend(['open', 'done', 'doneLate', 'late', 'noreply', 'request', 'agree', 'absent', 'edited', 'tamper'], '장부 표시')}</section>`, 'ledger', 'ledger');
    ['m', 't', 's'].forEach(k => { $('#lf-' + k).onchange = e => { f[k] = e.target.value; viewLedger(p); }; }); $('#lf-del').onchange = e => { f.del = e.target.checked; viewLedger(p); };
    const a2 = $('#add2'); if (a2) a2.onclick = () => quickAdd(p);
    const el = $('#elist'); if (el) el.onclick = e => { const b = e.target.closest('[data-e]'); if (b) detail(p, b.dataset.e); };
  }
  function sheet(html) { const d = $('#sheet'); $('#sheet-b').innerHTML = html; if (!d.open) d.showModal(); return d; }
  function detail(p, id) {
    const e = p.entries.find(x => x.id === id); if (!e) return; const at = nowAt(); const idx = p.entries.indexOf(e); const v = E.verifyChain(p.entries); const st = e.type === 'promise' ? E.promiseStatus(e, p.entries, at) : null;
    const dones = E.live(p.entries).filter(x => x.type === 'done' && x.memberId === e.memberId);
    sheet(`<h2 id="sheet-t">${esc(E.TYPES[e.type])} · ${esc(memberName(p, e.memberId))}</h2><p>${entryChip(p, e, at)}${v.bad.includes(idx) ? ' ' + chip('tamper') : ''}</p>
      <dl class="kv"><dt>작업</dt><dd>${esc(e.task || '-')}</dd><dt>일시</dt><dd class="num">${esc(e.at ? E.mdw(e.at.slice(0, 10)) + ' ' + E.hm(e.at) : '-')}</dd>${e.type === 'promise' ? `<dt>기한</dt><dd class="num">${esc(e.due ? E.mdw(e.due) + ' ' + (e.dueTime || '23:59') : '없음')}</dd><dt>크기</dt><dd>${['', 'S', 'M', 'L'][e.size || 2]}</dd>` : ''}<dt>기록 시각</dt><dd class="num">${esc(e.createdAt ? e.createdAt.slice(0, 16).replace('T', ' ') : '')}</dd></dl>
      ${e.evidence && e.evidence.quote ? `<p class="small">근거${e.evidence.kind === 'kakao' ? '(카톡 인용, 최대 200자)' : ''}</p><p><span class="quote">${esc(e.evidence.quote)}</span></p>` : ''}
      ${st && st.done ? `<p class="small">연결된 완료: ${esc(E.md(st.done.at))} ${esc(st.done.task)}</p>` : ''}
      ${e.type === 'promise' && !e.deleted ? `<label for="lk">완료 기록 연결</label><select id="lk"><option value="" ${!e.link ? 'selected' : ''}>자동(같은 사람·비슷한 작업명)</option><option value="none" ${e.link === 'none' ? 'selected' : ''}>연결 안 함</option>${dones.map(d => `<option value="${esc(d.id)}" ${e.link === d.id ? 'selected' : ''}>${esc(E.md(d.at) + ' ' + d.task)}</option>`).join('')}</select>` : ''}
      ${(e.edits || []).length ? `<h3>수정 이력</h3><ul class="small">${e.edits.map(x => `<li><span class="num">${esc(x.at.replace('T', ' '))}</span> — 이전 값: ${esc(Object.entries(x.before).map(([k, val]) => `${k}=${typeof val === 'object' ? JSON.stringify(val) : val}`).join(', '))}</li>`).join('')}</ul>` : ''}
      <p class="small">해시 <span class="mono wrap">${esc(e.hash || '')}</span></p>
      <div class="actions">${e.deleted ? '' : '<button type="button" class="btn" id="d-edit">수정</button><button type="button" class="btn danger" id="d-del">삭제</button>'}<button type="button" class="btn ghost" id="d-close">닫기</button></div>`);
    $('#d-close').onclick = () => $('#sheet').close();
    const lk = $('#lk'); if (lk) lk.onchange = () => { setEntries(p, E.editEntry(p.entries, id, { link: lk.value || undefined }, nowAt())); toast('완료 연결을 바꿨어요.'); detail(p, id); viewLedgerIf(p); };
    if (!e.deleted) {
      $('#d-del').onclick = async () => { $('#sheet').close(); if (await ask('이 기록을 삭제할까요?', '<p>장부에서 숨기고 <b>삭제 표시</b>를 남겨요. 해시 체인에는 삭제 이력이 남아요.</p>', '삭제', '취소')) { setEntries(p, E.deleteEntry(p.entries, id, nowAt())); toast('삭제 표시했어요.'); route(); } };
      $('#d-edit').onclick = () => editForm(p, id);
    }
  }
  const viewLedgerIf = p => { if (T.route === 'ledger') viewLedger(p); };
  function editForm(p, id) {
    const e = p.entries.find(x => x.id === id);
    sheet(`<h2 id="sheet-t">기록 수정</h2><form id="ef"><label for="ef-task">작업명</label><input type="text" id="ef-task" value="${esc(e.task || '')}">
      <div class="two"><div><label for="ef-d">일시(날짜)</label><input type="date" id="ef-d" value="${esc((e.at || '').slice(0, 10))}"></div><div><label for="ef-t">시각</label><input type="time" id="ef-t" value="${esc((e.at || '').slice(11, 16))}"></div></div>
      ${e.type === 'promise' ? `<div class="two"><div><label for="ef-due">기한</label><input type="date" id="ef-due" value="${esc(e.due || '')}"></div><div><label for="ef-size">크기</label><select id="ef-size">${[1, 2, 3].map(n => `<option value="${n}" ${(e.size || 2) === n ? 'selected' : ''}>${['', 'S(작음)', 'M(보통)', 'L(큼)'][n]}</option>`).join('')}</select></div></div>` : ''}
      <label for="ef-q">근거 메모·인용 (최대 200자)</label><textarea id="ef-q" maxlength="200" style="min-height:80px">${esc(e.evidence ? e.evidence.quote || '' : '')}</textarea>
      <p class="small">수정하면 이전 값이 이력에 남고 '수정됨' 표시가 붙어요.</p><div class="actions"><button class="btn" type="submit">저장</button><button class="btn ghost" type="button" id="ef-x">취소</button></div></form>`);
    $('#ef-x').onclick = () => detail(p, id);
    $('#ef').onsubmit = ev => { ev.preventDefault(); const patch = { task: $('#ef-task').value.trim(), at: ($('#ef-d').value || (e.at || '').slice(0, 10)) + 'T' + ($('#ef-t').value || '00:00'), evidence: Object.assign({}, e.evidence || { kind: 'note' }, { quote: E.quoteOf($('#ef-q').value) }) }; if (e.type === 'promise') { patch.due = $('#ef-due').value; patch.size = +$('#ef-size').value; }
      setEntries(p, E.editEntry(p.entries, id, patch, nowAt())); toast('수정했어요. 이전 값은 이력에 남아요.'); $('#sheet').close(); route(); };
  }
  /* 빠른 추가: 사람 → 유형 → 작업 (탭 3번) */
  function quickAdd(p) {
    const q = S.ui.qa = { m: '', t: '' };
    const draw = () => sheet(`<h2 id="sheet-t">기록 추가</h2>
      <fieldset style="border:0;padding:0;margin:0"><legend class="small"><b>① 누구</b></legend><div class="seg">${p.members.map(m => `<button type="button" class="btn ghost sm" data-qm="${esc(m.id)}" aria-pressed="${q.m === m.id}">${esc(m.name)}</button>`).join('')}</div></fieldset>
      <fieldset style="border:0;padding:0;margin:10px 0 0"><legend class="small"><b>② 무엇</b></legend><div class="seg">${['promise', 'done', 'request', 'meeting', 'absent', 'agree', 'memo'].map(k => `<button type="button" class="btn ghost sm" data-qt="${k}" aria-pressed="${q.t === k}">${E.TYPES[k]}</button>`).join('')}</div></fieldset>
      <form id="qf"><label for="q-task">③ 작업·내용</label><input type="text" id="q-task" placeholder="예: 설문 분석" autocomplete="off">
      <div id="q-pro" ${q.t === 'promise' ? '' : 'hidden'}><div class="two"><div><label for="q-due">기한</label><input type="date" id="q-due"></div><div><label for="q-size">크기</label><select id="q-size"><option value="1">S(작음)</option><option value="2" selected>M(보통)</option><option value="3">L(큼)</option></select></div></div></div>
      <label for="q-ev">근거 메모 <span class="small">(선택, 200자)</span></label><input type="text" id="q-ev" maxlength="200" placeholder="예: 11/20 회의에서 말함 · 파일명">
      <p class="errtxt" id="q-err" hidden></p><div class="actions"><button class="btn" type="submit" id="q-save">저장</button><button class="btn ghost" type="button" id="q-x">닫기</button></div></form>`);
    const bind = () => {
      $$('[data-qm]').forEach(b => { b.onclick = () => { q.m = b.dataset.qm; const keep = $('#q-task').value; draw(); bind(); $('#q-task').value = keep; $(`[data-qm="${q.m}"]`).focus(); }; });
      $$('[data-qt]').forEach(b => { b.onclick = () => { q.t = b.dataset.qt; const keep = $('#q-task').value; draw(); bind(); $('#q-task').value = keep; $('#q-task').focus(); }; });
      $('#q-x').onclick = () => $('#sheet').close();
      $('#qf').onsubmit = ev => { ev.preventDefault(); const task = $('#q-task').value.trim(); const err = !q.m ? '사람을 골라 주세요.' : !q.t ? '유형을 골라 주세요.' : !task && ['promise', 'done'].includes(q.t) ? '작업명을 적어 주세요.' : ''; if (err) { const x = $('#q-err'); x.hidden = false; x.textContent = err; return; }
        const at = nowAt(); const e = { id: uid('e'), type: q.t, memberId: q.m, task, at, createdAt: at, edits: [], evidence: { kind: 'note', quote: E.quoteOf($('#q-ev').value) } }; if (q.t === 'promise') { e.due = $('#q-due').value; e.dueTime = ''; e.size = +$('#q-size').value; }
        setEntries(p, E.addEntry(p.entries, e)); $('#sheet').close(); toast('기록했어요.'); route(); };
    };
    draw(); bind();
  }
  $('#fab').onclick = () => { const p = proj(); if (p) quickAdd(p); };

  /* ---------- 문구 ---------- */
  function highlightJW(text) {
    const hs = E.findJudgement(text, S.cfg.J); if (!hs.length) return { html: esc(text), hs };
    let out = '', i = 0; hs.forEach(h => { out += esc(text.slice(i, h.index)) + `<mark class="jw">${esc(text.slice(h.index, h.index + h.len))}</mark>`; i = h.index + h.len; }); out += esc(text.slice(i)); return { html: out, hs };
  }
  function viewMsg(p) {
    const others = p.members.filter(m => !m.me); if (!others.length) { render('<h1>요청 문구</h1><div class="card soft"><p>[나] 말고 다른 팀원이 있어야 문구를 만들 수 있어요.</p><a class="btn" href="#/setup?edit=1">팀원 추가</a></div>', 'msg', 'msg'); return; }
    const at = nowAt(); const ps = E.projectStep(p, at); const q = S.ui.q;
    const o = S.ui.msg && S.ui.msg.pid === p.id ? S.ui.msg : (S.ui.msg = { pid: p.id, memberId: ps.memberId || others[0].id, level: ps.level || 1, tone: 'polite', newDue: E.addDays(today(), 2), newTime: '18:00', reassignTo: (p.members.find(m => m.me) || {}).id || '', altTask: '', replyBy: E.addDays(today(), 1) });
    if (q && q.get('level')) o.level = +q.get('level') || o.level; if (q && q.get('m') && p.members.some(m => m.id === q.get('m'))) o.memberId = q.get('m');
    const st = E.stepFor(p, o.memberId, at); const gen = E.makeMessage(p, o, at); const text = o.edited != null && o.editKey === key(o) ? o.edited : gen.text;
    function key(x) { return [x.memberId, x.level, x.tone, x.newDue, x.newTime, x.reassignTo, x.altTask, x.replyBy].join('|'); }
    render(`<h1>요청 문구</h1><p class="lead">장부의 사실(작업·기한·경과일)이 자동으로 들어가요. 평가하는 말 대신 날짜로 말해요.</p>
      <section class="card"><div class="two"><div><label for="mm">받는 사람</label><select id="mm">${others.map(m => `<option value="${esc(m.id)}" ${o.memberId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></div><div><label for="mt">말투</label><select id="mt">${Object.entries(E.TONES).map(([k, l]) => `<option value="${k}" ${o.tone === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <p class="small" style="margin:8px 0 4px">권장: ${lvBadge(st.level)} <b>${esc(E.LEVEL_NAME[st.level])}</b>${st.reasons.length ? ' · ' + esc(st.reasons.join(' · ')) : ''}</p>
        <div class="seg" role="group" aria-label="단계">${[[1, '1단계 확인'], [2, '2단계 기한'], [3, '3단계 재분배'], [4, '교수 메일']].map(([l, t]) => `<button type="button" class="btn ghost sm" data-lv="${l}" aria-pressed="${o.level === l}">${t}</button>`).join('')}</div>
        ${o.level === 2 ? `<div class="two"><div><label for="nd">새 기한</label><input type="date" id="nd" value="${esc(o.newDue)}"></div><div><label for="nt">시각</label><input type="time" id="nt" value="${esc(o.newTime)}"></div></div>` : ''}
        ${o.level === 3 ? `<div class="two"><div><label for="ra">그 작업을 맡을 사람</label><select id="ra">${p.members.filter(m => m.id !== o.memberId).map(m => `<option value="${esc(m.id)}" ${o.reassignTo === m.id ? 'selected' : ''}>${esc(m.name)}${m.me ? ' (나)' : ''}</option>`).join('')}</select></div><div><label for="rb">답 받을 날짜</label><input type="date" id="rb" value="${esc(o.replyBy)}"></div></div><label for="alt">대신 맡길 작업</label><input type="text" id="alt" value="${esc(o.altTask)}" placeholder="예: 발표 대본 정리">` : ''}
        ${o.level === 4 ? `<label for="pn">교수님 성함 <span class="small">(선택)</span></label><input type="text" id="pn" value="${esc(o.profName || '')}" autocomplete="off">` : ''}
      </section>
      <section class="card"><h2>들어간 사실</h2>${gen.facts.length ? `<ul class="small" id="facts">${gen.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '<p class="small">장부에 이 팀원의 기록이 아직 없어요. 장부에 맡은 작업을 넣으면 사실이 자동으로 들어가요.</p>'}</section>
      <section class="card"><label for="mtxt">문구 <span class="small">(직접 고쳐도 돼요)</span></label><textarea id="mtxt" style="min-height:170px">${esc(text)}</textarea>
        <div id="jw" aria-live="polite"></div>
        <div class="actions"><button type="button" class="btn" id="mcopy">복사하기</button>${o.edited != null ? '<button type="button" class="btn ghost" id="mreset">처음 문구로</button>' : ''}</div>
        <p class="small">${o.level <= 3 ? `복사하면 장부에 '요청(${o.level}단계) 보냄'이 기록돼요(되돌리기 가능).` : '교수님 메일은 장부에 단계 기록을 남기지 않아요.'}</p></section>
      ${legend(['request', 'noreply', 'late'], '단계와 관련된 표시')}`, 'msg', 'msg');
    const re = () => { o.edited = null; viewMsg(p); };
    $('#mm').onchange = e => { o.memberId = e.target.value; re(); }; $('#mt').onchange = e => { o.tone = e.target.value; re(); };
    $$('[data-lv]').forEach(b => { b.onclick = () => { o.level = +b.dataset.lv; if (S.ui.q) S.ui.q.delete('level'); history.replaceState(null, '', '#/msg'); re(); }; });
    [['nd', 'newDue'], ['nt', 'newTime'], ['ra', 'reassignTo'], ['rb', 'replyBy'], ['alt', 'altTask'], ['pn', 'profName']].forEach(([id, k]) => { const el = $('#' + id); if (el) el.onchange = () => { o[k] = el.value; re(); }; });
    const drawJW = () => { const v = $('#mtxt').value; const r = highlightJW(v); const f = E.factsFor(p, o.memberId, at);
      $('#jw').innerHTML = r.hs.length ? `<div class="card err" style="margin-top:8px"><p><b>평가하는 말 ${r.hs.length}개</b>가 있어요. 사실로 바꾸면 갈등이 줄어요.</p><div class="echo">${r.html}</div><ul class="small">${[...new Map(r.hs.map(h => [h.w, h])).values()].map(h => `<li>${esc(h.tip)}</li>`).join('')}</ul><p class="small">사실형 예시: ${esc(E.factExample(S.cfg.J, f))}</p></div>` : ''; };
    $('#mtxt').oninput = () => { o.edited = $('#mtxt').value; o.editKey = key(o); drawJW(); }; drawJW();
    const rs = $('#mreset'); if (rs) rs.onclick = re;
    $('#mcopy').onclick = async () => {
      const v = $('#mtxt').value; if (!(await privacy('문구 복사'))) return; if (!(await copy(v))) return; bump('copyMsg');
      if (o.level > 3) { toast('복사했어요. 메일 앱에 붙여 넣으세요.'); return; }
      const sentAt = nowAt(); const e = { id: uid('e'), type: 'request', memberId: (p.members.find(m => m.me) || {}).id, task: `${o.level}단계 요청 문구 보냄`, at: sentAt, createdAt: sentAt, edits: [], stepLevel: o.level, meta: { to: o.memberId }, evidence: { kind: 'note', quote: E.quoteOf(v) } };
      setEntries(p, E.addEntry(p.entries, e)); const step = { level: o.level, sentAt, memberId: o.memberId, entryId: e.id }; if (o.level === 2) step.deadline = o.newDue + 'T' + (o.newTime || '18:00'); if (o.level === 3) step.deadline = o.replyBy + 'T23:59';
      p.steps = (p.steps || []).concat([step]); save();
      toast(`복사했어요. '요청(${o.level}단계) 보냄'을 장부에 기록했어요.`, { label: '되돌리기', run: () => { p.entries = E.rechain(p.entries.filter(x => x.id !== e.id)); p.steps = p.steps.filter(x => x.entryId !== e.id); save(); toast('기록을 되돌렸어요.'); if (T.route === 'msg') viewMsg(p); } });
      viewMsg(p);
    };
  }

  /* ---------- 보고서 ---------- */
  function viewReport(p) {
    const at = nowAt(); const o = S.ui.rep && S.ui.rep.pid === p.id ? S.ui.rep : (S.ui.rep = { pid: p.id, nameStyle: p.settings.nameStyle || 'full', requests: [], quotes: [] });
    const r = E.buildReport(p, o, at); const quotable = E.live(p.entries).filter(e => e.evidence && e.evidence.quote && ['promise', 'request', 'done', 'agree'].includes(e.type)).slice(-12);
    const ico = s => ({ done: '✓', doneLate: '✓⏱', late: '!', open: '…' }[s] || '');
    render(`<h1>교수님께 낼 한 장</h1><p class="lead">사실만 담은 A4 보고서예요. 인쇄 → PDF로 저장하거나 텍스트로 메일에 붙여 넣으세요.</p>
      ${r.roles.length ? '' : '<div class="card soft"><p>장부에 맡은 작업이 아직 없어요. 카톡을 가져오거나 [+ 기록]으로 맡은 작업을 넣으면 표가 채워져요.</p><a class="btn ghost sm" href="#/import">카톡 가져오기</a></div>'}
      <section class="card no-print"><fieldset style="border:0;padding:0;margin:0"><legend><b>이름 표기</b></legend><div class="seg"><label class="check"><input type="radio" name="ns" value="full" ${o.nameStyle === 'full' ? 'checked' : ''}> 이름 그대로</label><label class="check"><input type="radio" name="ns" value="initial" ${o.nameStyle === 'initial' ? 'checked' : ''}> 이니셜(초성)</label></div></fieldset>
        <fieldset style="border:0;padding:0;margin:8px 0 0"><legend><b>요청 사항</b> <span class="small">(선택)</span></legend>${Object.entries(E.REQUESTS).map(([k, l]) => `<label class="check"><input type="checkbox" data-rq="${k}" ${o.requests.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</fieldset>
        ${quotable.length ? `<details><summary>카톡 인용 넣기 (${o.quotes.length}/${quotable.length})</summary><p class="small">필요한 줄만 고르세요.</p>${quotable.map(e => `<label class="check"><input type="checkbox" data-qt="${esc(e.id)}" ${o.quotes.includes(e.id) ? 'checked' : ''}> <span class="small"><span class="num">${esc(E.md(e.at))}</span> ${esc(memberName(p, e.memberId))}</span> ${esc(e.evidence.quote.slice(0, 50))}</label>`).join('')}</details>` : ''}
        <div class="actions"><button type="button" class="btn" id="rprint">인쇄 / PDF 저장</button><button type="button" class="btn ghost" id="rcopy">텍스트 복사</button></div></section>
      <section class="card print-area"><div class="a4wrap"><article class="a4" id="a4" aria-label="A4 보고서 미리보기">
        <h2>팀 활동 사실 보고</h2><p>${esc(r.course || '')} · ${esc(r.title || '')}<br>작성자 ${esc(r.author)} · 작성일 <span class="num">${esc(r.date)}</span> · 팀원 ${esc(r.members.join(', '))}</p>
        <h3>요약</h3><ul>${r.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <h3>역할 분담</h3>${r.roles.length ? `<table><colgroup><col style="width:15%"><col><col style="width:16%"><col style="width:22%"></colgroup><thead><tr><th scope="col">팀원</th><th scope="col">맡은 작업·근거</th><th scope="col">기한</th><th scope="col">상태</th></tr></thead><tbody>${r.roles.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.task)}${x.quote ? `<br><span class="small">“${esc(x.quote)}”</span>` : ''}</td><td class="num">${esc(x.due ? E.md(x.due) : '-')}</td><td><span class="ic-mark" aria-hidden="true">${ico(x.status)}</span> ${esc(x.label)}${x.doneAt ? ` <span class="num">${esc(E.md(x.doneAt))}</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p>기록 없음</p>'}
        <h3>연락·요청 기록</h3>${r.timeline.length ? `<ul>${r.timeline.map(x => `<li><span class="num">${esc(E.md(x.at) + ' ' + E.hm(x.at))}</span> ${esc(x.name)} · ${esc(x.type)} · ${esc(x.text)}${x.quote ? ` “${esc(x.quote)}”` : ''}</li>`).join('')}</ul>` : '<p>기록 없음</p>'}
        <h3>팀 안에서 해 본 조치</h3>${r.steps.length ? `<ul>${r.steps.map(x => `<li><span class="num">${esc(E.md(x.at))}</span> ${esc(x.name)}님께 ${esc(E.LEVEL_NAME[x.level])} 문구 보냄</li>`).join('')}</ul>` : '<p>앱으로 기록한 단계별 요청은 아직 없어요.</p>'}
        ${r.requests.length ? `<h3>요청 사항</h3><ul>${r.requests.map(k => `<li>${esc(E.REQUESTS[k])}</li>`).join('')}</ul>` : ''}
        <p class="ft">기록 무결성 표시: 항목 <span class="num">${r.chainCount}</span>개 · 마지막 해시 앞 12자리 <span class="mono">${esc(r.hashShort)}</span> · 체인 검증 ${r.chainOk ? '통과' : '<b>실패(앱 밖 수정 흔적)</b>'} · 수정된 항목 ${r.edited}개 · 삭제 표시 ${r.deleted}개<br>※ 작성자 본인의 기록에 기반한 <b>참고 자료</b>예요. 해시는 이 앱 안에서 수정 여부를 표시할 뿐 법적 증거력을 보장하지 않으며, 이 문서는 법률 자문이 아니에요.</p>
      </article></div></section>`, 'report', 'report');
    $$('[name=ns]').forEach(x => { x.onchange = () => { o.nameStyle = x.value; viewReport(p); }; });
    $$('[data-rq]').forEach(x => { x.onchange = () => { o.requests = x.checked ? o.requests.concat([x.dataset.rq]) : o.requests.filter(k => k !== x.dataset.rq); viewReport(p); }; });
    $$('[data-qt]').forEach(x => { x.onchange = () => { o.quotes = x.checked ? o.quotes.concat([x.dataset.qt]) : o.quotes.filter(k => k !== x.dataset.qt); viewReport(p); const d = $('.no-print details'); if (d) d.open = true; }; });
    $('#rprint').onclick = async () => { if (!(await privacy('보고서 인쇄·PDF 저장'))) return; bump('report'); window.print(); };
    $('#rcopy').onclick = async () => { if (!(await privacy('보고서 텍스트 복사'))) return; if (await copy(E.reportText(r), '보고서 텍스트를 복사했어요.')) bump('report'); };
  }

  /* ---------- 동료평가 ---------- */
  function viewPeer(p) {
    const at = nowAt(); const items = S.cfg.peer.items; const o = S.ui.peer && S.ui.peer.pid === p.id ? S.ui.peer : (S.ui.peer = { pid: p.id, on: items.filter(i => i.default).map(i => i.label), custom: '', scores: {}, style: 'full' });
    const labels = o.on.concat(o.custom.split(/[,\n]/).map(s => s.trim()).filter(Boolean)); const ds = p.members.map(m => Object.assign({ m }, E.peerDraft(p, m.id, at, o.style)));
    const text = () => ds.map(d => [`[${d.m.me ? '자기평가 · ' : ''}${d.name}]`, ...labels.map(l => `- ${l}: ${o.scores[d.m.id + '|' + l] || '(점수 직접 입력)'}`), '근거: ' + d.sentences.join(' ')].join('\n')).join('\n\n');
    render(`<h1>동료평가 초안</h1><p class="lead">장부 근거를 붙인 문장 초안이에요. <b>점수는 직접 고르세요</b> — 앱은 점수를 추천하지 않아요.</p>
      ${p.peerEval && p.peerEval.used ? `<p class="small">이 과목은 동료평가가 성적에 반영돼요${p.peerEval.weightPct ? ` (${p.peerEval.weightPct}%)` : ''}.</p>` : ''}
      <section class="card"><fieldset style="border:0;padding:0;margin:0"><legend><b>평가 항목</b></legend><p class="small">${esc(S.cfg.peer.note)}</p>${items.map(i => `<label class="check"><input type="checkbox" data-pi="${esc(i.label)}" ${o.on.includes(i.label) ? 'checked' : ''}> ${esc(i.label)}</label>`).join('')}</fieldset>
        <label for="pc">직접 입력 <span class="small">(쉼표로 구분)</span></label><input type="text" id="pc" value="${esc(o.custom)}" placeholder="예: 아이디어 제시, 자료 조사">
        <div class="seg" style="margin-top:8px"><label class="check"><input type="radio" name="pst" value="full" ${o.style === 'full' ? 'checked' : ''}> 이름 그대로</label><label class="check"><input type="radio" name="pst" value="initial" ${o.style === 'initial' ? 'checked' : ''}> 이니셜</label></div></section>
      ${ds.map(d => `<section class="card"><h2>${esc(d.name)}${d.m.me ? ' <span class="small">(자기평가)</span>' : ''}</h2><p class="echo">${esc(d.sentences.join(' '))}</p>
        ${labels.map((l, k) => `<div class="two" style="align-items:center"><label for="sc-${esc(d.m.id)}-${k}" style="margin:4px 0">${esc(l)}</label><select id="sc-${esc(d.m.id)}-${k}" data-sc="${esc(d.m.id + '|' + l)}"><option value="">점수 선택</option>${[5, 4, 3, 2, 1].map(n => `<option ${o.scores[d.m.id + '|' + l] === String(n) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</section>`).join('')}
      <div class="actions"><button type="button" class="btn block" id="pcopy">전체 복사</button></div>
      <p class="small">근거 문장은 내 장부 기록만으로 만든 참고 자료예요. 제출 전에 사실과 다른 곳이 없는지 확인해 주세요.</p>`, 'peer', '');
    $$('[data-pi]').forEach(x => { x.onchange = () => { o.on = x.checked ? o.on.concat([x.dataset.pi]) : o.on.filter(k => k !== x.dataset.pi); viewPeer(p); }; });
    $('#pc').onchange = e => { o.custom = e.target.value; viewPeer(p); }; $$('[name=pst]').forEach(x => { x.onchange = () => { o.style = x.value; viewPeer(p); }; });
    $$('[data-sc]').forEach(x => { x.onchange = () => { o.scores[x.dataset.sc] = x.value; }; });
    $('#pcopy').onclick = async () => { if (await privacy('동료평가 초안 복사')) copy(text(), '동료평가 초안을 복사했어요.'); };
  }

  /* ---------- 공개글 점검 ---------- */
  const CHECK_SAMPLES = [
    ['과목명+이니셜+캡처', '마케팅원론 3조 ㅈㄷㅇ 단톡 캡처 올립니다. 발표 자료 하나도 안 했어요'],
    ['학과+수업 시간', '화목 3시 수업 경영학과 조원 2주째 연락 안 됨'],
    ['캡처 언급만', '팀플 단톡 스샷 보면 다들 알 거예요'],
    ['이름 단서만', '같은 조 김모씨가 2주째 답이 없어요'],
    ['단서 없음', '팀원이 연락이 안 될 때 다들 어떻게 하셨나요?']
  ];
  function viewCheck() {
    const p = proj(); const v = S.ui.chk || '';
    render(`<h1>공개글 점검</h1><p class="lead">커뮤니티에 올리기 전에 <b>사람을 알아볼 수 있는 단서</b>가 있는지 이 기기에서 확인해요.</p>
      <section class="card"><label for="ctx">올리려는 글</label><textarea id="ctx" placeholder="여기에 붙여 넣으세요">${esc(v)}</textarea>
        <div class="row"><span class="small">예시:</span>${CHECK_SAMPLES.map(([l], i) => `<button type="button" class="btn ghost sm" data-cs="${i}">${i + 1}. ${esc(l)}</button>`).join('')}</div>
        <div class="actions"><button type="button" class="btn" id="crun">점검하기</button></div></section>
      <div id="cres" aria-live="polite"></div>
      <section class="card note"><h2>알아 두면 좋은 사실</h2><ul class="small">
        <li>정보통신망법 제70조: 비방할 목적으로 정보통신망을 통해 공공연하게 사실을 드러내 명예를 훼손하면 3년 이하 징역 또는 3천만원 이하 벌금, 거짓 사실이면 7년 이하 징역·10년 이하 자격정지 또는 7천만원 이하 벌금이에요. 피해자가 원하지 않으면 처벌할 수 없는 죄(반의사불벌)예요. <span class="num">(2026-10-02 시행본 기준)</span></li>
        <li>실명이 없어도 과목명·학과·단톡 캡처 등으로 누구인지 알 수 있으면 ‘특정성’이 인정될 수 있다는 보도가 있어요. <a href="https://www.newsis.com/view/NISX20261102_0003850984" rel="noopener noreferrer" target="_blank">뉴시스 보도(2026-11-06) 요지 보기</a></li>
        <li>같은 보도는 대안으로 동료평가·공식 중재, 팀 내 공식 논의 기록을 확보해 지도 교수에게 전달하는 방법을 권했어요.</li></ul>
        <p class="small"><b>법률 자문이 아니에요.</b> 이 점검은 단어 규칙에 따른 참고용이며, 결과가 ‘낮음’이어도 법적으로 안전하다는 뜻이 아니에요.</p></section>`, 'check', 'more');
    $$('[data-cs]').forEach(b => { b.onclick = () => { $('#ctx').value = CHECK_SAMPLES[+b.dataset.cs][1]; runCheck(p); }; });
    $('#crun').onclick = () => runCheck(p); if (v) runCheck(p);
  }
  function runCheck(p) {
    const text = $('#ctx').value; S.ui.chk = text; const box = $('#cres');
    if (!text.trim()) { box.innerHTML = '<p class="errtxt" role="alert">점검할 글을 붙여 넣어 주세요.</p>'; return; }
    const res = E.riskCheck(text, S.cfg.RR, S.cfg.J, p ? { names: p.members.map(m => m.name), course: p.course } : {});
    let html = '', i = 0; res.hits.forEach(h => { html += esc(text.slice(i, h.index)) + `<mark class="${h.identity ? 'rh' : 'rc'}" title="${esc(h.label)}">${esc(text.slice(h.index, h.index + h.len))}</mark>`; i = h.index + h.len; }); html += esc(text.slice(i));
    const lv = { low: 1, mid: 2, high: 3 }[res.level]; const cats = res.cats.map(c => S.cfg.RR.categories.find(x => x.id === c).label);
    box.innerHTML = `<section class="card" id="risk-card"><h2>결과</h2><p id="risk-level">${rchip(res.level)}</p><div class="gauge" role="img" aria-label="특정 가능성 ${['', '낮음', '중간', '높음'][lv]}">${[1, 2, 3].map(n => `<span class="${n <= lv ? 'on' + lv : ''}"></span>`).join('')}</div>
      <p class="small">${cats.length ? `찾은 단서: ${esc(cats.join(', '))}` : '규칙에 걸린 단서가 없어요.'} · 기준: ${esc(S.cfg.RR.levels[res.level])}</p>
      ${res.hits.length ? `<div class="echo">${html}</div><p class="small"><mark class="rh">빨간 배경</mark> 신원 단서 · <mark class="rc">주황 점선</mark> 캡처 언급·비난어</p><div class="actions"><button type="button" class="btn ghost sm" id="cerase">특정 정보 지우기</button></div>` : ''}
      <h3>대신 공식 경로로</h3><div class="stack"><a class="btn ghost block" href="#/msg">단계별 요청 문구</a><a class="btn ghost block" href="#/msg?level=4">교수님 상담 메일</a><a class="btn ghost block" href="#/report">사실 보고서</a></div></section>`;
    const er = $('#cerase'); if (er) er.onclick = () => { $('#ctx').value = E.eraseIdentifiers(text, res); runCheck(p); toast('신원 단서를 ○○로 바꿨어요. 비난어는 직접 사실로 바꿔 주세요.'); };
  }

  /* ---------- 팀 합의문 ---------- */
  function agreementFrom(p, f) {
    const a = { v: 1, course: p.course, title: p.title || '', deadline: p.deadline, internal: f.internal || '', presentation: f.presentation || '', replyHours: f.replyHours || 24, rules: f.rules || [], peerConsent: !!f.peerConsent, members: p.members.map(m => ({ id: m.id, name: m.name, role: (f.roles && f.roles[m.id] != null ? f.roles[m.id] : m.role) || '', due: (f.dues && f.dues[m.id]) || '' })), createdAt: f.createdAt || nowAt() };
    return JSON.parse(JSON.stringify(a));
  }
  function viewAgree(p) {
    const ag = p.agreement || null; const def = p.deadline ? E.addDays(p.deadline.slice(0, 10), -3) + 'T' + p.deadline.slice(11, 16) : '';
    const f = S.ui.ag && S.ui.ag.pid === p.id ? S.ui.ag : (S.ui.ag = ag && ag.data ? { pid: p.id, internal: ag.data.internal, presentation: ag.data.presentation, replyHours: ag.data.replyHours, rules: ag.data.rules, peerConsent: ag.data.peerConsent, roles: Object.fromEntries(ag.data.members.map(m => [m.id, m.role])), dues: Object.fromEntries(ag.data.members.map(m => [m.id, m.due])), createdAt: ag.data.createdAt } : { pid: p.id, internal: def, presentation: '', replyHours: 24, rules: [], peerConsent: true, roles: {}, dues: {} });
    const confirms = ag ? ag.confirms || [] : [];
    render(`<h1>팀 합의문</h1><p class="lead">첫 회의 때 역할·내부 마감·연락 규칙을 정해 두면 나중에 다툴 일이 줄어요.</p>
      <form id="agf" class="card" novalidate>
        <label for="ag-in">내부 마감 <span class="small">(최종 마감 3일 전 자동)</span></label><input type="datetime-local" id="ag-in" value="${esc(f.internal)}"><label for="ag-pr">발표일 <span class="small">(선택)</span></label><input type="datetime-local" id="ag-pr" value="${esc(f.presentation)}">
        <p class="small">최종 마감 <span class="num">${p.deadline ? esc(E.mdw(p.deadline.slice(0, 10)) + ' ' + p.deadline.slice(11, 16)) : '미정'}</span></p>
        <h2>역할</h2>${p.members.map(m => `<div class="two"><div><label for="ar-${esc(m.id)}">${esc(m.name)} 역할</label><input type="text" id="ar-${esc(m.id)}" data-role="${esc(m.id)}" value="${esc(f.roles[m.id] != null ? f.roles[m.id] : m.role || '')}"></div><div><label for="ad-${esc(m.id)}">기한</label><input type="date" id="ad-${esc(m.id)}" data-due="${esc(m.id)}" value="${esc(f.dues[m.id] || '')}"></div></div>`).join('')}
        <label for="ag-rh">단톡 답장 시간(시간 안에)</label><input type="number" id="ag-rh" min="1" max="168" inputmode="numeric" value="${esc(f.replyHours)}">
        <label for="ag-ru">추가 규칙 <span class="small">(한 줄에 하나)</span></label><textarea id="ag-ru" style="min-height:70px" placeholder="예: 회의 불참 시 전날까지 알리기">${esc((f.rules || []).join('\n'))}</textarea>
        <label class="check"><input type="checkbox" id="ag-pc" ${f.peerConsent ? 'checked' : ''}> 이 합의와 팀 기록을 동료평가 근거로 쓰는 데 동의</label>
        <div class="actions"><button type="submit" class="btn">합의문 저장·미리보기</button></div></form>
      ${ag ? `<section class="card"><h2>미리보기</h2><p class="echo" id="agtext">${esc(ag.text)}</p><canvas id="agc" class="agcard" width="1080" height="1350" role="img" aria-label="합의문 카드 이미지"></canvas>
        <div class="actions"><button type="button" class="btn" id="ag-png">이미지 저장(PNG)</button><button type="button" class="btn ghost" id="ag-copy">텍스트 복사</button><button type="button" class="btn ghost" id="ag-link">확인 링크 만들기</button></div><div id="aglink"></div>
        <p class="small">합의문 해시 <span class="mono">${esc(ag.hash.slice(0, 12))}</span></p></section>
      <section class="card"><h2>내 캘린더에 넣기 (.ics)</h2><p class="small">팀원별 기한·내부 마감(전날 알림)·최종 마감·발표일. 시간대 Asia/Seoul.</p><div class="row">${p.members.map(m => `<button type="button" class="btn ghost sm" data-ics="${esc(m.id)}">${esc(m.name)}</button>`).join('')}</div><p class="small">실제 아이폰·구글 캘린더 가져오기는 아직 기기에서 확인하지 못했어요.</p></section>
      <section class="card"><h2>팀원 확인 코드 붙여넣기</h2><p class="small">팀원이 링크에서 [동의]를 누르면 나오는 코드(예: 11271504-ABC234)를 붙여 넣으세요.</p><label for="ag-code">확인 코드</label><div class="row"><input type="text" id="ag-code" autocomplete="off" autocapitalize="characters" spellcheck="false" style="flex:1;min-width:0"><button type="button" class="btn" id="ag-ver">확인</button></div><p class="errtxt" id="ag-err" role="alert" hidden></p>
        <ul class="list" id="confirms">${p.members.filter(m => !m.me).map(m => { const c = confirms.find(x => x.memberId === m.id); return `<li>${c ? chip('agree', '합의 확인') : chip('open', '확인 전')} ${esc(m.name)}${c ? ` <span class="small num">${esc(E.md(c.at) + ' ' + E.hm(c.at))} · ${esc(c.code)}</span>` : ''}</li>`; }).join('')}</ul>
        <p class="small">확인 코드는 ‘이 합의문을 받아 동의 버튼을 눌렀다’는 표시일 뿐 본인 인증이 아니에요. 링크를 가진 사람은 누구나 코드를 만들 수 있어요.</p></section>` : ''}`, 'agree', 'more');
    $('#agf').onsubmit = e => { e.preventDefault(); f.internal = $('#ag-in').value; f.presentation = $('#ag-pr').value; f.replyHours = Math.max(1, Math.min(168, +$('#ag-rh').value || 24)); f.rules = $('#ag-ru').value.split('\n').map(s => s.trim()).filter(Boolean); f.peerConsent = $('#ag-pc').checked;
      $$('[data-role]').forEach(x => { f.roles[x.dataset.role] = x.value.trim(); }); $$('[data-due]').forEach(x => { f.dues[x.dataset.due] = x.value; });
      const a = agreementFrom(p, f); const h = E.agreementHash(a); const keep = ag && ag.hash === h ? ag.confirms : (ag && ag.confirms && ag.confirms.length ? [] : []);
      if (ag && ag.hash !== h && ag.confirms && ag.confirms.length) toast('합의문 내용이 바뀌어 이전 확인 기록은 새 합의문에 적용되지 않아요.');
      p.agreement = { data: a, hash: h, text: E.agreementText(a), confirms: keep || [], at: nowAt() }; save(); S.ui.ag = null; viewAgree(p); toast('합의문을 저장했어요.'); };
    if (!ag) return;
    drawCard(ag); $('#ag-png').onclick = async () => { if (!(await privacy('합의문 이미지 저장'))) return; $('#agc').toBlob(b => download(`팀합의문-${p.course}.png`, b, 'image/png'), 'image/png'); };
    $('#ag-copy').onclick = async () => { if (await privacy('합의문 텍스트 복사')) copy(ag.text, '합의문 텍스트를 복사했어요.'); };
    $('#ag-link').onclick = async () => {
      if (!(await privacy('확인 링크 공유'))) return; const enc = await E.encodeAgreement(ag.data); const url = location.href.split('#')[0] + '#agree=' + enc; T.lastLink = url; const box = $('#aglink');
      if (url.length > 2000) { box.innerHTML = `<div class="card note" id="toolong"><p>링크가 <b class="num">${url.length.toLocaleString('ko-KR')}자</b>로 2,000자를 넘어 메신저에서 잘릴 수 있어요. 대신 <b>텍스트로 복사</b>해 단톡에 올려 주세요.</p><button type="button" class="btn" id="ag-fb">텍스트로 복사</button></div>`; $('#ag-fb').onclick = () => copy(ag.text, '합의문 텍스트를 복사했어요.'); return; }
      box.innerHTML = `<p class="small">링크 <span class="num">${url.length.toLocaleString('ko-KR')}자</span> · 대화 내용은 들어가지 않고 합의문만 담겨요.</p><div class="actions"><button type="button" class="btn" id="ag-lc">링크 복사</button></div>`; $('#ag-lc').onclick = () => copy(url, '확인 링크를 복사했어요. 단톡에 붙여 넣으세요.'); $('#ag-lc').focus();
    };
    $$('[data-ics]').forEach(b => { b.onclick = async () => { if (!(await privacy('일정 파일(.ics) 저장'))) return; const m = p.members.find(x => x.id === b.dataset.ics); const ev = E.memberEvents(p, m.id, ag.data); if (!ev.length) { toast('넣을 일정이 없어요. 마감일을 먼저 정해 주세요.'); return; } download(`${p.course}-${m.name}-일정.ics`, E.toICS(ev, { calName: `${p.course} 팀플`, uid: E.sha256(p.id + m.id).slice(0, 8) }), 'text/calendar;charset=utf-8'); toast(`${m.name} 일정 ${ev.length}개를 .ics로 저장했어요.`); }; });
    $('#ag-ver').onclick = () => { const err = $('#ag-err'); const code = $('#ag-code').value.trim().toUpperCase(); const m = E.verifyCode(ag.hash, ag.data.members, code);
      if (!m) { err.hidden = false; err.textContent = /^\d{8}-[A-Z2-7]{6}$/.test(code) ? '이 합의문으로 만든 코드가 아니에요. 최신 링크로 다시 받았는지 확인해 주세요.' : '코드 형식은 숫자 8자리-영문·숫자 6자리예요(예: 11271504-ABC234).'; $('#ag-code').setAttribute('aria-invalid', 'true'); return; }
      const at = nowAt(); ag.confirms = (ag.confirms || []).filter(c => c.memberId !== m.id).concat([{ memberId: m.id, code, at }]);
      setEntries(p, E.addEntry(p.entries, { id: uid('e'), type: 'agree', memberId: m.id, task: '팀 합의문 확인', at, createdAt: at, edits: [], evidence: { kind: 'code', quote: code }, meta: { agreementHash: ag.hash.slice(0, 12) } })); toast(`${m.name}님의 합의 확인을 장부에 기록했어요.`); viewAgree(p); };
  }
  function wrapLines(ctx, text, max) { const out = []; text.split('\n').forEach(par => { let line = ''; for (const ch of par) { if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch; } else line += ch; } out.push(line); }); return out; }
  function drawCard(ag) {
    const c = $('#agc'); if (!c || !c.getContext) return; const x = c.getContext('2d'); if (!x) return; const font = 'system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
    x.fillStyle = '#F7F6F2'; x.fillRect(0, 0, 1080, 1350); x.fillStyle = '#fff'; x.fillRect(48, 48, 984, 1254); x.fillStyle = '#2F5D8A'; x.fillRect(48, 48, 984, 14);
    x.fillStyle = '#1F2430'; x.font = `800 52px ${font}`; x.fillText('팀 합의문', 96, 150); x.font = `500 30px ${font}`; x.fillStyle = '#4B5563';
    let y = 210; const lines = wrapLines(x, ag.text.split('\n').slice(1).join('\n'), 888); x.fillStyle = '#1F2430';
    lines.forEach(l => { if (y > 1220) return; x.font = l.startsWith('■') ? `800 32px ${font}` : `400 29px ${font}`; x.fillText(l, 96, y); y += l ? 46 : 22; });
    x.fillStyle = '#94A3B8'; x.font = `400 22px ui-monospace,Menlo,monospace`; x.fillText('hash ' + ag.hash.slice(0, 12) + ' · 팀플 증거노트', 96, 1266);
  }
  async function viewRecv(enc) {
    render('<h1>합의문 확인</h1><p class="lead">불러오는 중…</p>', 'recv', '');
    let a; try { a = await E.decodeAgreement(decodeURIComponent(enc)); } catch (e) { render('<h1>합의문 확인</h1><section class="card err" role="alert"><h2>링크를 읽지 못했어요</h2><p>링크가 중간에 잘렸거나 바뀐 것 같아요. 보낸 팀원에게 링크를 다시 받거나 합의문 텍스트를 받아 주세요.</p><a class="btn ghost" href="#/">팀플 증거노트 첫 화면</a></section>', 'recv', ''); return; }
    const h = E.agreementHash(a); const others = a.members;
    render(`<h1>합의문 확인</h1><p class="lead">팀원이 보낸 합의문이에요. 내 이름을 고르고 동의하면 확인 코드가 나와요. <b>이 기기에 아무것도 저장하지 않아요.</b></p>
      <section class="card"><p class="echo" id="rtext">${esc(E.agreementText(a))}</p><p class="small">합의문 해시 <span class="mono">${esc(h.slice(0, 12))}</span></p></section>
      <section class="card"><fieldset style="border:0;padding:0;margin:0"><legend><b>나는 누구인가요?</b></legend>${others.map((m, i) => `<label class="check"><input type="radio" name="who" value="${esc(m.id)}" ${i ? '' : ''}> ${esc(m.name)}${m.role ? ` <span class="small">(${esc(m.role)})</span>` : ''}</label>`).join('')}</fieldset><p class="errtxt" id="r-err" role="alert" hidden></p>
        <div class="actions"><button type="button" class="btn" id="r-ok">동의하고 확인 코드 만들기</button></div><div id="r-code" aria-live="polite"></div>
        <p class="small">확인 코드는 본인 인증이 아니라 ‘받아서 동의를 눌렀다’는 표시예요.</p></section>`, 'recv', '');
    $('#r-ok').onclick = () => { const w = $('[name=who]:checked'); const err = $('#r-err'); if (!w) { err.hidden = false; err.textContent = '내 이름을 골라 주세요.'; return; } err.hidden = true;
      const code = E.confirmCode(h, w.value, E.stampOf(nowAt())); T.lastCode = code;
      $('#r-code').innerHTML = `<p>확인 코드</p><p class="code" id="code">${esc(code)}</p><div class="actions"><button type="button" class="btn" id="r-copy">코드 복사</button></div><p class="small">단톡에 이 코드를 보내 주세요.</p>`; $('#r-copy').onclick = () => copy(code, '확인 코드를 복사했어요.'); };
  }

  /* ---------- 설정 ---------- */
  function viewSettings() {
    const p = proj(); const st = E.runSelfTest(S.cfg.P, S.cfg.J, S.cfg.RR); T.selfTest = st;
    render(`<h1>설정</h1>
      ${p ? `<section class="card"><h2>권장 단계 기준 · ${esc(p.course)}</h2><form id="thf"><div class="two"><div><label for="th-n">무응답 며칠부터 1단계</label><input type="number" id="th-n" min="1" max="30" inputmode="numeric" value="${p.settings.noReplyDays}"></div><div><label for="th-h">2단계까지 기다릴 시간</label><input type="number" id="th-h" min="1" max="336" inputmode="numeric" value="${p.settings.escalateHours}"></div></div>
        <fieldset style="border:0;padding:0;margin:8px 0 0"><legend><b>기본 이름 표기</b></legend><div class="seg"><label class="check"><input type="radio" name="dn" value="full" ${p.settings.nameStyle !== 'initial' ? 'checked' : ''}> 이름 그대로</label><label class="check"><input type="radio" name="dn" value="initial" ${p.settings.nameStyle === 'initial' ? 'checked' : ''}> 이니셜</label></div></fieldset>
        <div class="actions"><button class="btn" type="submit">저장</button><a class="btn ghost" href="#/setup?edit=1">과목·팀원 수정</a></div></form></section>` : ''}
      <section class="card"><h2>과목</h2>${S.data.projects.length ? `<ul class="list">${S.data.projects.map(x => `<li class="row" style="justify-content:space-between"><span>${esc(x.course)}${x.demo ? ' <span class="st st-memo">예시</span>' : ''}${x.id === S.data.current ? ' <span class="small">(지금 보는 과목)</span>' : ''}</span><span class="row">${x.id === S.data.current ? '' : `<button type="button" class="btn ghost sm" data-use="${esc(x.id)}">열기</button>`}<button type="button" class="btn ghost sm" data-delp="${esc(x.id)}" aria-label="${esc(x.course)} 과목 삭제">삭제</button></span></li>`).join('')}</ul>` : '<p class="small">아직 과목이 없어요.</p>'}<div class="actions"><a class="btn ghost sm" href="#/setup">＋ 새 과목</a></div></section>
      <section class="card"><h2>학기 끝나면 지우기</h2><label for="sem">학기 종료일</label><input type="date" id="sem" value="${esc(S.data.meta.semesterEnd)}"><p class="small">이 날짜가 지나면 첫 화면에 삭제 안내가 떠요(이 앱이 열렸을 때만).</p></section>
      <section class="card"><h2>백업·복원</h2><p class="small">기록은 이 브라우저(localStorage)에만 있어요. 기기를 바꾸기 전에 백업하세요.</p><div class="actions"><button type="button" class="btn" id="bk">JSON 백업</button><label class="btn ghost" for="rs" style="margin:0">백업 불러오기</label><input type="file" id="rs" accept=".json,application/json" class="sr-only"></div><p class="errtxt" id="rs-err" role="alert" hidden></p></section>
      <section class="card err"><h2>전체 삭제</h2><p class="small">모든 과목·장부·합의문을 이 기기에서 지워요. 되돌릴 수 없어요.</p><button type="button" class="btn danger" id="wipe">전체 삭제</button></section>
      <section class="card"><h2>앱 상태</h2><p>${st.ok ? chip('ok', '자체 검사 통과') : chip('tamper', '자체 검사 실패')} <span class="small">계산 엔진 점검(해시·날짜·파서 등)</span></p>${st.ok ? '' : `<ul class="small">${st.fails.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}
        <p class="small">학기 패스(유료)에 관심 있으면 눌러 주세요. 이 기기에만 횟수가 저장되고 어디에도 전송되지 않아요.</p><button type="button" class="btn ghost sm" id="pass">관심 있어요 <span class="num">(${S.data.meta.events.passInterest || 0})</span></button></section>`, 'settings', 'more');
    if (p) $('#thf').onsubmit = e => { e.preventDefault(); p.settings.noReplyDays = Math.max(1, Math.min(30, +$('#th-n').value || 3)); p.settings.escalateHours = Math.max(1, Math.min(336, +$('#th-h').value || 48)); p.settings.nameStyle = ($('[name=dn]:checked') || {}).value || 'full'; S.ui.rep = null; save(); toast('기준을 저장했어요.'); viewSettings(); };
    $$('[data-use]').forEach(b => { b.onclick = () => { S.data.current = b.dataset.use; save(); location.hash = '#/'; }; });
    $$('[data-delp]').forEach(b => { b.onclick = async () => { const x = S.data.projects.find(q => q.id === b.dataset.delp); if (!(await ask('과목을 삭제할까요?', `<p><b>${esc(x.course)}</b>의 장부·합의문이 모두 지워져요.</p>`, '삭제', '취소'))) return; S.data.projects = S.data.projects.filter(q => q !== x); if (S.data.current === x.id) S.data.current = S.data.projects[0] ? S.data.projects[0].id : null; save(); toast('과목을 삭제했어요.'); viewSettings(); }; });
    $('#sem').onchange = e => { S.data.meta.semesterEnd = e.target.value; save(); toast(e.target.value ? '학기 종료일을 저장했어요.' : '학기 종료일을 지웠어요.'); };
    $('#bk').onclick = async () => { if (!(await privacy('백업 파일 저장'))) return; download(`팀플증거노트-백업-${today()}.json`, JSON.stringify(S.data, null, 1), 'application/json'); toast('백업 파일을 저장했어요.'); };
    $('#rs').onchange = e => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); const err = $('#rs-err');
      r.onload = async () => { let o; try { o = JSON.parse(String(r.result)); } catch (x) { err.hidden = false; err.textContent = 'JSON 파일이 아니에요.'; return; } const v = E.validateBackup(o); if (!v.ok) { err.hidden = false; err.textContent = '백업 형식이 맞지 않아요: ' + v.errors.slice(0, 3).join(', '); return; } err.hidden = true;
        if (!(await ask('백업을 불러올까요?', `<p>과목 <b class="num">${o.projects.length}</b>개가 들어 있어요. 지금 이 기기의 기록은 <b>백업 내용으로 바뀌어요</b>.</p>`, '불러오기', '취소'))) return;
        o.meta = Object.assign(blank().meta, o.meta || {}); o.meta.events = Object.assign(blank().meta.events, o.meta.events || {}); if (!o.projects.some(q => q.id === o.current)) o.current = o.projects[0] ? o.projects[0].id : null; S.data = o; save(); S.ui = {}; toast('백업을 불러왔어요.'); location.hash = '#/'; route(); };
      r.readAsText(file, 'utf-8'); e.target.value = ''; };
    $('#wipe').onclick = async () => {
      if (!(await ask('정말 모두 지울까요? (1/2)', '<p>모든 과목·장부·합의문·설정이 이 기기에서 지워져요. 필요하면 먼저 백업하세요.</p>', '다음', '취소'))) return;
      if (!(await ask('마지막 확인 (2/2)', '<p>지우면 되돌릴 수 없어요. 정말 전체 삭제할까요?</p>', '전체 삭제', '취소'))) return;
      localStorage.removeItem(KEY); S.data = blank(); S.ui = {}; toast('모든 기록을 지웠어요.'); location.hash = '#/'; route();
    };
    $('#pass').onclick = () => { bump('passInterest'); toast('관심을 기록했어요. 이 기기에만 저장돼요.'); viewSettings(); };
  }

  /* ---------- 출처·더보기 ---------- */
  function viewSources() {
    const s = S.cfg.sources; const link = x => x.url ? `<a href="${esc(x.url)}" rel="noopener noreferrer" target="_blank">${esc(x.linkText || x.source)}</a>` : esc(x.source);
    render(`<h1>출처</h1><p class="lead">앱에 쓴 숫자와 사실의 출처예요. 확인일 ${esc(s.checked)}.</p>
      <section class="card"><h2>확인한 사실</h2><ul class="list">${s.verified.map(x => `<li><b>${esc(x.title)}</b><br><span class="small">${esc(x.fact)}</span><br><span class="small">${link(x)}${x.date ? ` · <span class="num">${esc(x.date)}</span>` : ''}</span></li>`).join('')}</ul></section>
      <section class="card note"><h2>확인 필요</h2><ul class="small">${s.unverified.map(x => `<li><b>${esc(x.title)}</b> — ${esc(x.why)}</li>`).join('')}</ul></section>
      <section class="card"><h2>기획서와 다르게 고친 점</h2><ul class="small">${s.corrections.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`, 'sources', 'more');
  }
  function viewMore() {
    const L = [['#/check', '공개글 점검', '올리기 전에 특정 가능성 확인'], ['#/peer', '동료평가 초안', '근거 붙은 문장, 점수는 직접'], ['#/agree', '팀 합의문', '역할·내부 마감·확인 코드·.ics'], ['#/import', '카톡 다시 가져오기', '새 대화 추가 분석'], ['#/settings', '설정·백업', '단계 기준·학기 종료·전체 삭제'], ['#/sources', '출처', '통계·법 조항 원문 링크']];
    render(`<h1>더보기</h1><ul class="list">${L.map(([h, t, d]) => `<li><a class="item" href="${h}"><b>${t}</b><br><span class="meta">${d}</span></a></li>`).join('')}</ul>
      <section class="card">${legend(null, '전체 표시 읽는 법')}<ul class="legend" aria-label="단계 배지">${[0, 1, 2, 3].map(l => `<li>${lvBadge(l)}<span>${esc(E.LEVEL_NAME[l])}</span></li>`).join('')}</ul><ul class="legend" aria-label="공개글 점검 결과">${['high', 'mid', 'low'].map(l => `<li>${rchip(l)}</li>`).join('')}</ul></section>
      <section class="card"><h2>안내</h2><ul class="small"><li><a href="kakao-export-guide/">카톡 대화 내보내기 방법</a></li><li><a href="team-project-free-rider-guide/">연락 안 되는 팀원 대처 순서</a></li><li><a href="peer-evaluation-evidence/">근거 있는 동료평가 쓰기</a></li><li><a href="privacy.html">개인정보 처리 안내</a></li></ul></section>`, 'more', 'more');
  }

  /* ---------- 시작 ---------- */
  async function boot() {
    const files = { P: 'patterns', J: 'judgement-words', RR: 'risk-rules', peer: 'peer-presets', samples: 'samples', sources: 'sources' };
    try { const ent = await Promise.all(Object.entries(files).map(async ([k, f]) => { const r = await fetch(`data/${f}.json`); if (!r.ok) throw new Error(f + ' ' + r.status); return [k, await r.json()]; })); S.cfg = Object.fromEntries(ent); }
    catch (e) { render(`<h1>불러오기 오류</h1><section class="card err" role="alert"><p>앱 데이터를 불러오지 못했어요(${esc(e.message)}). 인터넷 연결을 확인하고 다시 시도해 주세요. 한 번 열린 뒤에는 오프라인에서도 동작해요.</p><button type="button" class="btn" id="reload">다시 시도</button></section>`, 'err', ''); $('#reload').onclick = () => location.reload(); return; }
    S.data = load(); T.ready = true; route(); window.addEventListener('hashchange', route);
    $('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) $('#sheet').close(); });
  }
  T.route = ''; boot();
})();
