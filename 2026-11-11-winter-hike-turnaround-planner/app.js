/* 겨울산행 하산 마감표 — 기기 안에서만 계산·저장. 날씨는 동의 후에만 Open-Meteo 요청. */
(function () {
  'use strict';
  const W = window.WinterHike;
  const PKEY = 'wh_plans_v1', RKEY = 'wh_rosters_v1', SKEY = 'wh_settings_v1', CKEY = 'wh_contacts_v1', APP = '겨울산행 하산 마감표';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const HM = W.fmtHM;
  let DATA = null, loadNote = '', D = null, mem = { wx: {}, contacts: null, notice: {}, wake: null };
  const todayKST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const nowMinKST = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value])); return +p.hour * 60 + +p.minute; };
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ---------- 저장 ---------- */
  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast('저장 공간이 부족해 저장하지 못했어요'); return false; } }
  const plans = () => (Array.isArray(load(PKEY, [])) ? load(PKEY, []) : []).filter(p => p && p.id && W.validDate(p.date));
  const getPlan = id => plans().find(p => p.id === id) || null;
  function putPlan(p) { const all = plans().filter(x => x.id !== p.id); all.unshift(p); save(PKEY, all.slice(0, 30)); }
  function delPlan(id) { save(PKEY, plans().filter(p => p.id !== id)); const r = load(RKEY, {}); delete r[id]; save(RKEY, r); }
  const settings = () => Object.assign({ hc: false, chillWarn: W.DEFAULTS.chillWarn, gustWarn: W.DEFAULTS.gustWarn, onboarded: false }, load(SKEY, {}));
  const setSettings = patch => save(SKEY, Object.assign(settings(), patch));
  function contacts() { if (mem.contacts) return mem.contacts; const c = load(CKEY, null); mem.contacts = c && typeof c === 'object' ? { leader: String(c.leader || '').slice(0, 20), sweep: String(c.sweep || '').slice(0, 20), saved: true } : { leader: '', sweep: '', saved: false }; return mem.contacts; }

  /* ---------- 데이터 ---------- */
  const itemById = id => DATA && DATA.items.find(i => i.id === id) || null;
  function itemFor(p) {
    if (p.trailheadId) { const it = itemById(p.trailheadId); if (!it) return null; return p.elev ? Object.assign({}, it, { summitElev: +p.elev, elevEdited: true }) : it; }
    if (p.custom) {
      const c = p.custom, it = { id: 'custom', park: c.park || '직접 입력', name: '직접 입력', summitName: c.summitName || '정상', summitElev: +c.summitElev || 0, lat: +c.lat, lon: +c.lon, custom: true, geoApprox: false, elevApprox: false };
      if (W.parseHM(c.open || '') !== null && W.parseHM(c.close || '') !== null) Object.assign(it, { winterMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], winter: { open: c.open, close: c.close }, summer: { open: c.open, close: c.close }, winterLabel: '직접 입력' });
      return it;
    }
    return null;
  }
  function sunFor(p, it) {
    const w = mem.wx[wxKey(p, it)];
    if (w && w.status === 'ok' && w.data.sunset != null) return { sunrise: w.data.sunrise, sunset: w.data.sunset, source: 'Open-Meteo 예보' };
    const s = W.sun(p.date, it.lat, it.lon);
    return s ? Object.assign(s, { source: 'NOAA 천문 계산(근사)' }) : null;
  }
  const wxKey = (p, it) => [p.date, (+it.lat).toFixed(2), (+it.lon).toFixed(2), Math.round(it.summitElev)].join('|');
  function compute(p) {
    const it = itemFor(p); if (!it) return null;
    const s = sunFor(p, it); if (!s) return null;
    return { it, sun: s, r: W.plan(p, it, s) };
  }

  /* ---------- UI 헬퍼 ---------- */
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  function confirmBox(title, text, ok = '계속') {
    const d = $('#confirm'); $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-ok').textContent = ok;
    return new Promise(res => { d.returnValue = ''; d.onclose = () => res(d.returnValue === 'ok'); d.showModal(); });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }
  function download(name, text, type) { const a = document.createElement('a'); a.textContent = name; a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; a.style.display = 'none'; a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const disclaimer = () => `<p class="disclaimer"><strong>최종 판단은 현장·국립공원 공지 우선.</strong> 국립공원 공식 통제·기상특보가 항상 우선이며, 출발 전 공식 공지를 다시 확인하세요. <a href="${DATA ? DATA.source : 'https://knps.or.kr/portal/main/contents.do?menuNo=8000198'}" target="_blank" rel="noopener">국립공원공단 입산시간지정제</a> · <a href="https://visithalla.jeju.go.kr/contents/contents.do?id=49" target="_blank" rel="noopener">한라산 탐방 안내</a></p>`;
  const note = () => loadNote ? `<p class="note" role="status">${esc(loadNote)}</p>` : '';

  /* ---------- 라우팅 ---------- */
  const TITLES = { home: '몇 시에 돌아설지, 출발 전에 정하세요', step1: '① 산·들머리 고르기', step2: '② 날짜·출발·코스', step3: '③ 팀 페이스·겨울 노면', plan: '산행표', notice: '산행 공지문', roster: '인원 점검', card: '119 비상 카드', shared: '공유받은 산행표 (읽기 전용)', sources: '출처·계산 기준·개인정보', missing: '계획을 찾을 수 없어요' };
  function pageTitle(key, extra) { return (extra ? extra + ' · ' : '') + (TITLES[key] || '') + ' — ' + APP; }
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    const parts = h.split('/');
    document.body.classList.remove('has-bar');
    let key = 'home', extra = '';
    if (!DATA && !loadNote) return;
    try {
      if (parts[0] === 'new') { key = 'step' + (parts[1] || '1'); if (!TITLES[key]) key = 'step1'; renderStep(+key.slice(4)); }
      else if (parts[0] === 'plan') {
        const p = getPlan(parts[1]);
        if (!p) { key = 'missing'; renderMissing(); }
        else { mem.cur = p; const sub = parts[2] || 'plan'; key = TITLES[sub] && ['notice', 'roster', 'card'].includes(sub) ? sub : 'plan'; extra = planName(p); ({ plan: renderPlan, notice: renderNotice, roster: renderRoster, card: renderCard })[key](p); }
      } else if (parts[0] === 's') { key = 'shared'; renderShared(parts.slice(1).join('/')); }
      else if (parts[0] === 'sources') { key = 'sources'; renderSources(); }
      else renderHome();
    } catch (e) { console.warn(e); view().innerHTML = `<h1>화면을 그리지 못했어요</h1><p>입력값을 확인하거나 홈으로 돌아가 주세요.</p><a class="btn" href="#/">홈으로</a>`; }
    document.title = pageTitle(key, extra);
    window.scrollTo(0, 0);
  }
  const view = () => $('#view');
  const planName = p => p.title || (() => { const it = itemFor(p); return it ? it.park + ' ' + it.summitName : '산행'; })();

  /* ---------- 홈 ---------- */
  function renderHome() {
    const ps = plans(), st = settings(), m = +todayKST().slice(5, 7);
    const ny = (m >= 10 ? +todayKST().slice(0, 4) + 1 : +todayKST().slice(0, 4)) + '-01-01';
    view().innerHTML = `${note()}
<section class="card hero"><p class="eyebrow">산악회 산행대장 · 안내산악회용</p><h1>몇 시에 돌아설지, 출발 전에 정하세요</h1><p>들머리와 출발 시각, 팀 페이스만 넣으면 국립공원 동절기 입산통제시간과 일몰로 <strong>입산 마감 · 정상 도착 마감 · 하산 목표</strong>를 계산해요. 돌아서는 것도 완주입니다.</p><div class="row"><a class="btn light" href="#/new/1" data-act="new">새 산행 계획</a></div></section>
${[11, 12, 1].includes(m) ? `<section class="card season"><h2>12월 송년산행 · 1월 1일 해맞이</h2><p>해맞이 모드는 일출 시각에서 거꾸로 출발 시각을 계산하고 이마등을 필수로 표시해요.</p><button class="btn ghost" data-act="new-sunrise" data-date="${ny}">해맞이 산행 계획 (${ny.slice(0, 4)}년 1월 1일)</button></section>` : ''}
${st.onboarded ? '' : `<section class="card" aria-labelledby="ob"><h2 id="ob">처음이세요? 3단계면 끝나요</h2><ol><li><strong>들머리</strong> — 50곳의 국립공원 통제시간이 출처·기준일과 함께 들어 있어요. 초성(예: ㅅㅂㅅ)도 돼요.</li><li><strong>날짜·코스</strong> — 오름 거리·누적 오름만 넣으면 표준 공식으로 시간을 잡아요. 직접 입력도 돼요.</li><li><strong>팀 페이스</strong> — 가장 느린 회원 기준으로 고르면 반환 시각표가 나와요.</li></ol><p class="hint">날씨는 버튼을 눌러 동의할 때만 불러와요. 명단·연락처는 이 기기에만 저장돼요.</p><button class="btn ghost sm" data-act="onboarded">알겠어요</button></section>`}
<section class="card"><h2>최근 계획</h2>${ps.length ? `<ul class="plans">${ps.map(p => { const c = compute(p); return `<li><a href="#/plan/${esc(p.id)}"><span class="dot ${c ? c.r.signal : ''}" aria-hidden="true"></span><span><b>${esc(planName(p))}</b><br><small class="mut"><span class="num">${esc(p.date)}(${W.weekday(p.date)})</span> · ${p.mode === 'sunrise' ? '해맞이' : '출발 <span class="num">' + esc(p.startTime) + '</span>'}</small></span><span class="badge">${c ? ({ green: '여유', yellow: '빠듯', red: '수정 필요' })[c.r.signal] : '확인'}</span></a></li>`; }).join('')}</ul>` : `<p class="mut">아직 저장된 계획이 없어요. <strong>새 산행 계획</strong>으로 첫 반환 시각표를 만들어 보세요.</p>`}</section>
<section class="card"><h2>들어 있는 기준</h2><p>통제시간 <strong class="num">${DATA ? DATA.items.length : 0}곳</strong> · ${esc(DATA ? DATA.notice : '데이터 없음')}</p><p class="hint">공원마다 동절기 정의가 달라요: 대부분 11~3월, 북한산·무등산 12~2월, 한려해상 11~4월, 한라산 10~3월.</p><a href="#/sources">출처·계산 기준 보기</a></section>${disclaimer()}`;
  }

  /* ---------- 입력 3단계 ---------- */
  function freshDraft() { return { id: '', title: '', trailheadId: '', custom: null, elev: '', hut: '', date: addDays(todayKST(), 3), startTime: '08:00', meetTime: '07:30', meetPlace: '', ascentKm: '', ascentM: '', descentKm: '', descentM: '', manualAscent: '', manualDescent: '', pace: 'normal', winterFactor: 1.2, margin: 90, summitStay: 0, mode: 'normal', sunriseLead: 10, sunriseStay: 30, checkpoints: [], q: '' }; }
  function bar(step) {
    document.body.classList.add('has-bar');
    return `<div class="bar noprint"><div class="in">${step > 1 ? `<a class="btn ghost" href="#/new/${step - 1}">이전</a>` : `<a class="btn ghost" href="#/">취소</a>`}<button class="btn" type="submit" form="stepform">${step < 3 ? '다음' : '산행표 만들기'}</button></div></div>`;
  }
  const stepsUI = s => `<ol class="steps" aria-label="3단계 중 ${s}단계">${[1, 2, 3].map(i => `<li class="${i <= s ? 'on' : ''}"></li>`).join('')}</ol>`;
  function renderStep(s) {
    if (!D) D = freshDraft();
    if (s > 1 && !D.trailheadId && !D.custom) { location.replace('#/new/1'); return; }
    if (s === 3 && !D.date) { location.replace('#/new/2'); return; }
    view().innerHTML = note() + stepsUI(s) + ({ 1: step1, 2: step2, 3: step3 })[s]() + bar(s);
    bindStep(s);
  }
  function itemLine(it, date) { const c = W.control(it, date); return `${esc(it.park)} · ${esc(it.summitName)} ${it.summitElev}m${c ? ` · ${c.seasonLabel} <span class="num">${HM(c.open)}~${HM(c.close)}</span>` : ''}`; }
  function step1() {
    const it = D.trailheadId ? itemById(D.trailheadId) : null, cu = D.custom;
    return `<h1>① 산·들머리 고르기</h1><form id="stepform" novalidate>
<label for="q">산·들머리 검색</label><input id="q" name="q" type="search" autocomplete="off" placeholder="예: 소백산 희방, 설악 오색, ㅈㄹㅅ" value="${esc(D.q)}" aria-describedby="q-hint"><p class="hint" id="q-hint">부분 일치·초성 검색. ${DATA ? DATA.items.length : 0}곳 · 국립공원공단 페이지 기준(2026-11-11 확인)</p>
<div class="results" id="results" role="group" aria-label="검색 결과"></div>
${it ? `<div class="card" id="picked"><h2>선택한 들머리</h2><p><strong>${esc(it.park)} ${esc(it.name)}</strong></p><p class="small">${itemLine(it, D.date)}</p>
<label for="elev">정상 고도 (m) <span class="badge warn">근사 · 수정 가능</span></label><input id="elev" name="elev" type="number" inputmode="numeric" min="0" max="2000" value="${esc(D.elev || it.summitElev)}">
${it.hut.length ? `<label for="hut">대피소 예약 (통제시간 연장)</label><select id="hut" name="hut"><option value="">예약 없음</option>${it.hut.map((h, i) => `<option value="${i}" ${String(D.hut) === String(i) ? 'selected' : ''}>${esc(h.label)} · +${h.minutes / 60}시간</option>`).join('')}</select><p class="hint">국립공원공단 표 비고 기준. 예약 확인자만 해당돼요.</p>` : ''}</div>` : ''}
<details ${cu ? 'open' : ''} id="customBox"><summary>목록에 없어요 — 직접 입력</summary>
<label for="c-park">산 이름</label><input id="c-park" name="c-park" maxlength="30" value="${esc(cu ? cu.park : '')}">
<label for="c-summit">정상 이름</label><input id="c-summit" name="c-summit" maxlength="30" value="${esc(cu ? cu.summitName : '')}">
<div class="grid2"><div><label for="c-elev">정상 고도(m)</label><input id="c-elev" name="c-elev" type="number" inputmode="numeric" min="0" max="2000" value="${esc(cu ? cu.summitElev : '')}"></div><div></div>
<div><label for="c-lat">위도</label><input id="c-lat" name="c-lat" inputmode="decimal" placeholder="예: 37.66" value="${esc(cu ? cu.lat : '')}"></div><div><label for="c-lon">경도</label><input id="c-lon" name="c-lon" inputmode="decimal" placeholder="예: 126.98" value="${esc(cu ? cu.lon : '')}"></div>
<div><label for="c-open">입산 시작 (선택)</label><input id="c-open" name="c-open" type="time" value="${esc(cu ? cu.open : '')}"></div><div><label for="c-close">입산 통제 (선택)</label><input id="c-close" name="c-close" type="time" value="${esc(cu ? cu.close : '')}"></div></div>
<p class="hint">직접 입력한 통제시간은 <strong>확인 필요</strong>로 표시돼요. 비우면 일몰 기준으로만 계산해요. 위도·경도는 지도 앱에서 정상 좌표를 복사해 넣으세요.</p><button class="btn ghost sm" type="button" data-act="use-custom">직접 입력으로 진행</button></details>
<p class="err" id="err" role="alert"></p></form>`;
  }
  function drawResults() {
    const box = $('#results'); if (!box || !DATA) return;
    const q = $('#q').value; D.q = q;
    const list = W.search(DATA.items, q);
    const shown = q.trim() ? list.slice(0, 12) : [];
    box.innerHTML = q.trim() ? (shown.length ? shown.map(it => `<button type="button" class="pick" data-pick="${esc(it.id)}" aria-pressed="${D.trailheadId === it.id}"><b>${esc(it.park)} · ${esc(it.name)}</b><span>${itemLine(it, D.date)}</span></button>`).join('') + (list.length > 12 ? `<p class="hint">${list.length - 12}곳 더 있어요. 검색어를 더 넣어 보세요.</p>` : '') : `<p class="mut">“${esc(q)}”에 맞는 들머리가 없어요. 아래 <strong>직접 입력</strong>을 쓰세요.</p>`) : `<p class="hint">예시: <button type="button" class="btn ghost sm" data-q="소백산 희방">소백산 희방</button> <button type="button" class="btn ghost sm" data-q="한라 성판악">한라 성판악</button> <button type="button" class="btn ghost sm" data-q="ㅂㅎㅅ">ㅂㅎㅅ</button></p>`;
  }
  function readCustom() {
    const v = id => ($('#' + id) || {}).value || '';
    return { park: v('c-park').trim(), summitName: v('c-summit').trim(), summitElev: v('c-elev'), lat: v('c-lat').trim(), lon: v('c-lon').trim(), open: v('c-open'), close: v('c-close') };
  }
  function validCustom(c) {
    if (!c.park) return '산 이름을 넣어 주세요.';
    const lat = +c.lat, lon = +c.lon;
    if (!c.lat || !c.lon || !isFinite(lat) || !isFinite(lon) || lat < 33 || lat > 38.7 || lon < 124.5 || lon > 131) return '위도 33~38.7, 경도 124.5~131 범위의 좌표를 넣어 주세요 (일몰 계산에 필요해요).';
    if (c.summitElev !== '' && (!(+c.summitElev >= 0) || +c.summitElev > 2000)) return '정상 고도는 0~2000m로 넣어 주세요.';
    if ((c.open && !c.close) || (!c.open && c.close)) return '입산 시작·통제는 둘 다 넣거나 둘 다 비워 주세요.';
    return '';
  }
  function step2() {
    const it = itemFor(D) || {}, gates = (it.gates || []);
    if (!D.checkpoints.length && gates.length) D.checkpoints = gates.map(g => ({ name: g.name, plannedTime: '' }));
    const cps = D.checkpoints.length ? D.checkpoints : [{ name: '', plannedTime: '' }];
    return `<h1>② 날짜·출발·코스</h1><p class="mut small">${esc(it.park || '')} ${esc(it.name || '')} → ${esc(it.summitName || '')}</p><form id="stepform" novalidate>
<fieldset class="seg" style="border:0;padding:0;margin:0"><legend class="small" style="font-weight:700;margin-bottom:6px">산행 모드</legend><label><input type="radio" name="mode" value="normal" ${D.mode !== 'sunrise' ? 'checked' : ''}>일반 산행</label><label><input type="radio" name="mode" value="sunrise" ${D.mode === 'sunrise' ? 'checked' : ''}>해맞이 (일출 역산)</label></fieldset>
<label for="title">산행 이름 (선택)</label><input id="title" name="title" maxlength="40" placeholder="예: 12월 송년산행" value="${esc(D.title)}">
<div class="grid2"><div><label for="date">날짜</label><input id="date" name="date" type="date" min="2026-01-01" max="2035-12-31" value="${esc(D.date)}" required></div>
<div id="startWrap" ${D.mode === 'sunrise' ? 'hidden' : ''}><label for="startTime">들머리 출발</label><input id="startTime" name="startTime" type="time" value="${esc(D.startTime)}"></div>
<div><label for="meetTime">집결 시각</label><input id="meetTime" name="meetTime" type="time" value="${esc(D.meetTime)}"></div><div><label for="meetPlace">집결 장소</label><input id="meetPlace" name="meetPlace" maxlength="40" placeholder="예: 들머리 주차장" value="${esc(D.meetPlace)}"></div></div>
<h2>코스 (정상까지 왕복 기준)</h2>
<div class="grid2"><div><label for="ascentKm">오름 거리 km</label><input id="ascentKm" name="ascentKm" inputmode="decimal" placeholder="예: 5.5" value="${esc(D.ascentKm)}"></div><div><label for="ascentM">누적 오름 m</label><input id="ascentM" name="ascentM" inputmode="numeric" placeholder="예: 1000" value="${esc(D.ascentM)}"></div>
<div><label for="descentKm">하산 거리 km</label><input id="descentKm" name="descentKm" inputmode="decimal" placeholder="오름과 같으면 비움" value="${esc(D.descentKm)}"></div><div><label for="descentM">누적 하강 m</label><input id="descentM" name="descentM" inputmode="numeric" placeholder="비우면 오름과 같게" value="${esc(D.descentM)}"></div></div>
<p class="hint">거리·고도는 탐방로 안내판·국립공원 누리집·지도 앱 값을 넣으세요. 앱이 임의로 채우지 않아요.</p>
<details ${D.manualAscent || D.manualDescent ? 'open' : ''}><summary>예상 시간을 직접 넣을래요 (공식 덮어쓰기)</summary><div class="grid2"><div><label for="manualAscent">오름 시간(분)</label><input id="manualAscent" name="manualAscent" inputmode="numeric" placeholder="예: 300" value="${esc(D.manualAscent)}"></div><div><label for="manualDescent">하산 시간(분)</label><input id="manualDescent" name="manualDescent" inputmode="numeric" placeholder="예: 200" value="${esc(D.manualDescent)}"></div></div><p class="hint">직접 넣은 시간에는 페이스·노면·휴식 계수를 곱하지 않아요.</p></details>
<div id="cpWrap" ${D.mode === 'sunrise' ? 'hidden' : ''}><h2>중간 체크포인트 (선택)</h2><p class="hint">갈림길·대피소 이름과 <strong>예상 통과 시각</strong>을 넣으면 통과 마감을 계산해요.${gates.length ? ' 한라산 통제소는 관리소 마감과 비교해 더 이른 쪽을 써요.' : ''}</p>
${cps.map((c, i) => `<div class="grid2"><div><label for="cpn${i}">지점 ${i + 1}</label><input id="cpn${i}" name="cpn${i}" maxlength="20" value="${esc(c.name)}" placeholder="예: 연화봉"></div><div><label for="cpt${i}">예상 통과</label><input id="cpt${i}" name="cpt${i}" type="time" value="${esc(c.plannedTime)}"></div></div>`).join('')}
${cps.length < 4 ? `<button type="button" class="btn ghost sm" data-act="add-cp">지점 추가</button>` : ''}</div>
<p class="err" id="err" role="alert"></p></form>`;
  }
  function readStep2() {
    const f = $('#stepform'), v = n => (f.elements[n] ? f.elements[n].value : '').trim();
    D.mode = (f.querySelector('input[name=mode]:checked') || {}).value === 'sunrise' ? 'sunrise' : 'normal';
    ['title', 'date', 'startTime', 'meetTime', 'meetPlace', 'ascentKm', 'ascentM', 'descentKm', 'descentM', 'manualAscent', 'manualDescent'].forEach(k => D[k] = v(k));
    const cps = []; for (let i = 0; i < 4; i++) if (f.elements['cpn' + i]) cps.push({ name: v('cpn' + i), plannedTime: v('cpt' + i) });
    D.checkpoints = cps;
  }
  function validStep2() {
    if (!W.validDate(D.date)) return '날짜를 확인해 주세요.';
    if (D.mode !== 'sunrise' && W.parseHM(D.startTime) === null) return '들머리 출발 시각을 넣어 주세요.';
    const n = (x, max) => x === '' || (isFinite(+x) && +x >= 0 && +x <= max);
    if (!n(D.ascentKm, 40) || !n(D.descentKm, 40)) return '거리는 0~40km 숫자로 넣어 주세요.';
    if (!n(D.ascentM, 3000) || !n(D.descentM, 3000)) return '누적 오름·하강은 0~3000m 숫자로 넣어 주세요.';
    if (!n(D.manualAscent, 900) || !n(D.manualDescent, 900)) return '직접 입력 시간은 0~900분으로 넣어 주세요.';
    const hasUp = +D.manualAscent > 0 || +D.ascentKm > 0 || +D.ascentM > 0;
    if (!hasUp) return '오름 거리·누적 오름 또는 오름 시간을 넣어 주세요.';
    if (D.descentKm === '' && !(+D.manualDescent > 0)) D.descentKm = D.ascentKm;
    const bad = D.checkpoints.find(c => (c.name && !c.plannedTime) || (!c.name && c.plannedTime));
    if (D.mode !== 'sunrise' && bad) return '체크포인트는 이름과 예상 통과 시각을 함께 넣어 주세요.';
    if (D.mode !== 'sunrise' && D.checkpoints.find(c => c.plannedTime && W.parseHM(c.plannedTime) < W.parseHM(D.startTime))) return '체크포인트 통과 시각이 출발보다 빨라요.';
    return '';
  }
  function step3() {
    return `<h1>③ 팀 페이스·겨울 노면</h1><form id="stepform" novalidate>
<fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:800">가장 느린 회원 기준 페이스</legend><div class="seg">${Object.entries(W.PACE).map(([k, v]) => `<label><input type="radio" name="pace" value="${k}" ${D.pace === k ? 'checked' : ''}>${v.label} <span class="num small mut">×${v.factor}</span></label>`).join('')}</div></fieldset>
<fieldset style="border:0;padding:0;margin:12px 0 0"><legend style="font-weight:800">겨울 노면 계수 (1.0~1.3)</legend><div class="seg">${W.SURFACE.map(s => `<label><input type="radio" name="winterFactor" value="${s.v}" ${+D.winterFactor === s.v ? 'checked' : ''}>${s.label} <span class="num small mut">×${s.v.toFixed(1)}</span></label>`).join('')}</div></fieldset>
<div id="normalOpts" ${D.mode === 'sunrise' ? 'hidden' : ''}><label for="margin">일몰 전 하산 여유: <output id="marginOut" class="num">${D.margin}분</output></label><input id="margin" name="margin" type="range" min="60" max="120" step="10" value="${D.margin}" aria-describedby="margin-hint"><p class="hint" id="margin-hint">기본 90분(해 지기 1시간 30분 전 하산). 60~120분 조절.</p>
<label for="summitStay">정상 체류 (분)</label><input id="summitStay" name="summitStay" inputmode="numeric" value="${esc(D.summitStay)}" placeholder="0"></div>
<div id="sunriseOpts" ${D.mode === 'sunrise' ? '' : 'hidden'}><div class="grid2"><div><label for="sunriseLead">일출 몇 분 전 도착</label><input id="sunriseLead" name="sunriseLead" inputmode="numeric" value="${esc(D.sunriseLead)}"></div><div><label for="sunriseStay">일출 후 정상 체류(분)</label><input id="sunriseStay" name="sunriseStay" inputmode="numeric" value="${esc(D.sunriseStay)}"></div></div></div>
<div class="formula" id="formula" aria-live="polite"></div>
<p class="err" id="err" role="alert"></p></form>`;
  }
  function readStep3() {
    const f = $('#stepform');
    D.pace = (f.querySelector('input[name=pace]:checked') || {}).value || 'normal';
    D.winterFactor = +((f.querySelector('input[name=winterFactor]:checked') || {}).value || 1.2);
    if (f.elements.margin) D.margin = +f.elements.margin.value;
    ['summitStay', 'sunriseLead', 'sunriseStay'].forEach(k => { if (f.elements[k]) D[k] = f.elements[k].value.trim(); });
  }
  function formulaHTML(p) {
    const e = W.estimate(p), pf = W.PACE[p.pace] ? W.PACE[p.pace].factor : 1, wf = +p.winterFactor || 1;
    const leg = (name, l, km, m, kmh, per) => l.manual ? `<li>${name}: 직접 입력 <b class="num">${W.fmtDur(l.total)}</b></li>` : `<li>${name}: (${+km || 0}km÷${kmh}km/h + ${+m || 0}m÷100×${per}분 = <span class="num">${Math.round(l.base)}분</span>) × 페이스 ${pf} × 노면 ${wf} = <span class="num">${Math.round(l.adjusted)}분</span> + 휴식 시간당 10분 <span class="num">${Math.round(l.rest)}분</span> → <b class="num">${W.fmtDur(l.total)}</b></li>`;
    const dm = p.descentM === '' || p.descentM == null ? p.ascentM : p.descentM;
    return `<strong>참고용 표준 공식</strong><ul style="margin:.3em 0;padding-left:1.1em">${leg('오름', e.up, p.ascentKm, p.ascentM, 4, 10)}${leg('하산', e.down, p.descentKm, dm, 5, 5)}</ul><p class="hint" style="margin:0">평지 4km/h·오름 100m당 10분, 하산 5km/h·하강 100m당 5분. 계수는 앱 기본값이며 실제 팀 기록이 있으면 직접 입력이 더 정확해요.</p>`;
  }
  function bindStep(s) {
    const f = $('#stepform');
    if (s === 1) {
      drawResults();
      $('#q').addEventListener('input', drawResults);
      const el = $('#elev'); if (el) el.addEventListener('input', () => { D.elev = el.value; });
      const hu = $('#hut'); if (hu) hu.addEventListener('change', () => { D.hut = hu.value; });
    }
    if (s === 2) {
      $$('input[name=mode]').forEach(r => r.addEventListener('change', () => { readStep2(); $('#startWrap').hidden = D.mode === 'sunrise'; $('#cpWrap').hidden = D.mode === 'sunrise'; }));
    }
    if (s === 3) {
      const upd = () => { readStep3(); $('#marginOut') && ($('#marginOut').textContent = D.margin + '분'); $('#formula').innerHTML = formulaHTML(D); };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    }
  }
  function submitStep(s) {
    const err = $('#err'); err.textContent = '';
    if (s === 1) {
      const it = D.trailheadId ? itemById(D.trailheadId) : null;
      if (!it && !D.custom) { err.textContent = '들머리를 고르거나 직접 입력을 완료해 주세요.'; $('#q').focus(); return; }
      if (it && $('#elev')) { const e = +$('#elev').value; if (!(e > 0 && e <= 2000)) { err.textContent = '정상 고도는 1~2000m로 넣어 주세요.'; $('#elev').focus(); return; } D.elev = e === it.summitElev ? '' : e; }
      location.hash = '#/new/2';
    } else if (s === 2) {
      readStep2(); const m = validStep2(); if (m) { err.textContent = m; return; } location.hash = '#/new/3';
    } else {
      readStep3();
      const st = +D.summitStay; if (D.summitStay !== '' && !(st >= 0 && st <= 180)) { err.textContent = '정상 체류는 0~180분으로 넣어 주세요.'; return; }
      if (D.mode === 'sunrise' && !(+D.sunriseLead >= 0 && +D.sunriseLead <= 120)) { err.textContent = '일출 전 도착은 0~120분으로 넣어 주세요.'; return; }
      const p = Object.assign({}, D); delete p.q;
      p.id = p.id || uid(); p.summitStay = +p.summitStay || 0; p.checkpoints = (p.checkpoints || []).filter(c => c.name && c.plannedTime);
      if (!compute(p)) { err.textContent = '일몰을 계산하지 못했어요. 좌표를 확인해 주세요.'; return; }
      putPlan(p); D = null; toast('산행표를 저장했어요'); location.hash = '#/plan/' + p.id;
    }
  }

  /* ---------- 결과 ---------- */
  const ptabs = (p, cur) => `<nav class="ptabs noprint" aria-label="산행 메뉴">${[['plan', '산행표', ''], ['notice', '공지문', '/notice'], ['roster', '인원 점검', '/roster'], ['card', '비상 카드', '/card']].map(([k, l, h]) => `<a href="#/plan/${esc(p.id)}${h}" ${k === cur ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>`;
  function sourceLine(it) {
    if (!it || it.custom) return it && it.winter ? '직접 입력 · 확인 필요' : '';
    return `${esc(it.sourceName)} 기준(2026-11-11 확인), 출발 전 공식 공지 재확인`;
  }
  function timeline(r) {
    const s0 = Math.min(r.start, r.plannedSummit) - 20, s1 = Math.max(r.sunset, r.plannedFinish) + 20, span = s1 - s0;
    const pc = t => Math.max(0, Math.min(100, (t - s0) / span * 100)), x = t => pc(t).toFixed(2) + '%';
    const lb = (t, cls, txt) => { const v = pc(t), tr = v < 18 ? 'translateX(0)' : v > 82 ? 'translateX(-100%)' : 'translateX(-50%)'; return `<span class="lb ${cls}" style="left:${x(t)};transform:${tr}">${txt}</span>`; };
    const over = r.plannedFinish > r.descentTarget ? `<div class="over" style="left:${x(r.descentTarget)};width:calc(${x(r.plannedFinish)} - ${x(r.descentTarget)})" title="하산 목표 초과 구간"></div>` : '';
    return `<div class="timeline" role="img" aria-label="출발 ${HM(r.start)}, 정상 예정 ${HM(r.plannedSummit)}, 하산 예정 ${HM(r.plannedFinish)}, 하산 목표 ${HM(r.descentTarget)}, 일몰 ${HM(r.sunset)}"><div class="track"></div><div class="fill" style="left:${x(r.start)};width:calc(${x(r.plannedFinish)} - ${x(r.start)})"></div>${over}
${(r.checkpoints || []).map(c => `<div class="mk" style="left:${x(c.planned)};background:#fff"></div>`).join('')}<div class="mk" style="left:${x(r.plannedSummit)}"></div>
<div class="sunset" style="left:${x(r.sunset)}"></div>${lb(r.start, 't', '출발 ' + HM(r.start))}${lb(r.plannedSummit, 't', '정상 ' + HM(r.plannedSummit))}${lb(r.sunset, 'b sun', '일몰 ' + HM(r.sunset))}${lb(r.plannedFinish, 'b' + (Math.abs(pc(r.plannedFinish) - pc(r.sunset)) < 22 ? ' b2' : ''), '하산 ' + HM(r.plannedFinish))}</div>
<p class="legend"><span>━ 산행 예정</span><span style="color:var(--sunt)">┃ 일몰</span>${over ? '<span style="color:var(--rt)">▨ 하산 목표 초과</span>' : ''}</p>`;
  }
  function weatherCard(p, it, r) {
    const key = wxKey(p, it), w = mem.wx[key] || { status: 'idle' }, st = settings();
    const t0 = todayKST(), inRange = p.date >= t0 && p.date <= addDays(t0, 15);
    let body = '';
    if (!inRange) body = `<p><span class="badge">예보 범위 밖</span> Open-Meteo 예보는 약 16일 이내만 제공돼요. 지금은 일출·일몰만 천문 계산(근사)으로 보여 줘요. 출발 2주 전부터 다시 확인하세요.</p>`;
    else if (w.status === 'idle') body = `<p>버튼을 누르고 동의하면 <strong>정상 좌표(소수점 2자리)·정상 고도·날짜</strong>를 Open-Meteo에 보내 시간별 체감온도·풍속·돌풍·적설을 받아요. 이름·명단·연락처는 보내지 않아요.</p><button class="btn" data-act="wx">정상 날씨 불러오기</button>`;
    else if (w.status === 'loading') body = `<p role="status">정상 고도 ${it.summitElev}m 예보를 불러오는 중…</p>`;
    else if (w.status === 'error') body = `<div class="note" role="alert" id="wx-error"><strong>날씨를 불러오지 못했어요.</strong> ${esc(w.msg)}<br>일몰은 천문 계산(근사)으로 계속 보여 줘요. 출발 전 <a href="https://www.weather.go.kr/w/index.do" target="_blank" rel="noopener">기상청 날씨누리</a>의 산악 예보·기상특보와 <a href="https://www.knps.or.kr/" target="_blank" rel="noopener">국립공원공단</a>·<a href="https://visithalla.jeju.go.kr/main/main.do" target="_blank" rel="noopener">한라산</a> 탐방로 통제 현황을 직접 확인하세요.</div><p class="hint">경고 기준(체감 ${st.chillWarn}℃ 이하, 돌풍 ${st.gustWarn}m/s 이상)에 하나라도 해당하면 코스 단축·취소를 검토하세요.</p><button class="btn ghost" data-act="wx">다시 시도</button>`;
    else {
      const d = w.data;
      body = `<div class="wx"><div><small>체감 최저</small><b>${d.minApparent ?? '-'}℃</b></div><div><small>기온 최저</small><b>${d.minTemp ?? '-'}℃</b></div><div><small>풍속 최대</small><b>${d.maxWind ?? '-'}m/s</b></div><div><small>돌풍 최대</small><b>${d.maxGust ?? '-'}m/s</b></div><div><small>적설 합계</small><b>${d.snowTotal}cm</b></div><div><small>기상청식 체감 최저</small><b>${d.minKma ?? '-'}${d.minKma != null ? '℃' : ''}</b></div></div>
<p class="hint">Open-Meteo 예보 · 정상 고도 ${Math.round(d.elevation)}m 보정 · ${HM(r.mode === 'sunrise' ? r.start : r.start)}~${HM(r.plannedFinish)} 시간대. 기상청식: 13.12+0.6215T−11.37V<sup>0.16</sup>+0.3965V<sup>0.16</sup>T (V km/h, 기온 10℃ 이하·풍속 1.3m/s 이상에서만).</p>
${d.warnings.length ? `<ul class="warns">${d.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p><span class="badge ok">경고 기준 해당 없음</span></p>'}
<details><summary>시간별 예보</summary><ul class="srclist">${d.rows.map(x => `<li><b>${x.time}</b> · 체감 ${x.apparent}℃ · 기온 ${x.temp}℃ · 풍속 ${x.wind}m/s · 돌풍 ${x.gust}m/s · 눈 ${x.snow}cm</li>`).join('')}</ul></details>`;
    }
    return `<section class="card" id="wx"><h2>정상 날씨 (선택)</h2>${body}
<details><summary>경고 기준 바꾸기</summary><div class="grid2"><div><label for="chillWarn">체감온도 경고 (℃ 이하)</label><input id="chillWarn" type="number" min="-40" max="10" value="${st.chillWarn}"></div><div><label for="gustWarn">돌풍 경고 (m/s 이상)</label><input id="gustWarn" type="number" min="5" max="40" value="${st.gustWarn}"></div></div><button class="btn ghost sm" data-act="save-th">기준 저장</button></details></section>`;
  }
  function renderPlan(p, shared) {
    const c = compute(p);
    if (!c) { renderMissing('들머리 데이터를 찾지 못했어요.'); return; }
    const { it, sun, r } = c, ctl = r.control;
    const label = { green: '계획대로 진행 가능', yellow: '빠듯해요 — 반환 기준 엄수', red: '계획을 고치세요' }[r.signal];
    const stats = r.mode === 'sunrise'
      ? [['출발 (역산)', r.start, 'key'], ['정상 도착 목표', r.summitTarget, ''], ['일출', r.sunrise, 'sunset'], ['하산 예정', r.plannedFinish, '']]
      : [['입산 마감', r.entryDeadline, ''], ['정상 도착 마감', r.summitDeadline, 'key'], ['하산 목표', r.descentTarget, ''], ['일몰', r.sunset, 'sunset']];
    view().innerHTML = `${note()}${shared ? `<p class="ro">공유받은 읽기 전용 산행표예요. 참가자 이름·전화번호는 들어 있지 않아요.</p>` : ptabs(p, 'plan')}
<h1>${esc(planName(p))}</h1><p class="mut"><span class="num">${esc(p.date)}(${W.weekday(p.date)})</span> · ${esc(it.park)} ${esc(it.name)} → ${esc(it.summitName)} <span class="num">${it.summitElev}m</span>${it.elevApprox || it.elevEdited ? ' <span class="badge">고도 근사</span>' : ''}</p>
<section class="card signal ${r.signal}" aria-live="polite"><span class="light" aria-hidden="true"></span><h2>${{ green: '초록', yellow: '노랑', red: '빨강' }[r.signal]} · ${label}</h2><p class="small" style="margin:0">${r.mode === 'sunrise' ? '해맞이 모드' : `하산 예정 <span class="num">${HM(r.plannedFinish)}</span> · ${r.slack >= 0 ? `목표보다 <span class="num">${W.fmtDur(r.slack)}</span> 이름` : `목표보다 <span class="num">${W.fmtDur(-r.slack)}</span> 늦음`}`}</p><ul>${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
<div class="stats">${stats.map(([l, v, cls]) => `<div class="stat ${cls}"><small>${l}</small><b>${HM(v)}</b></div>`).join('')}</div>
${r.mode === 'sunrise' ? `<p class="turn">일출 <span class="num">${HM(r.sunrise)}</span> ${p.sunriseLead || 10}분 전 정상 도착 → <span class="num">${HM(r.start)}</span> 들머리 출발. <span style="color:var(--rt)">이마등 필수</span>.</p>` :
      `<p class="turn">정상 도착 마감 <span class="num">${HM(r.summitDeadline)}</span> — <span class="num">${HM(r.summitDeadline)}</span>까지 ${esc(it.summitName)}에 못 가면 그 자리에서 하산합니다.</p>
${r.checkpoints.length ? `<h2>체크포인트 통과 마감</h2><ul class="cps">${r.checkpoints.map(x => `<li><span>${esc(x.name)} <small class="mut">예정 <span class="num">${HM(x.planned)}</span> · ${esc(x.source)}</small></span><b>${HM(x.deadline)}</b></li>`).join('')}</ul>` : ''}
<section class="card"><h2>타임라인</h2>${timeline(r)}</section>`}
<section class="card"><h2>입산 통제 · 일몰</h2>${ctl ? `<p>이 들머리 ${ctl.seasonLabel} 입산 <b class="num">${HM(ctl.open)}~${HM(ctl.baseClose)}</b>${it.openVerified === false ? ' <span class="badge warn">입산 시작 확인 필요</span>' : ''}${ctl.ext ? ` → 대피소 예약(${esc(ctl.hutLabel)}) <b class="num">${HM(ctl.close)}</b>까지` : ''}</p>${ctl.summitLeave !== null ? `<p>공원 지정 하산 시작: ${esc(it.summitName)} <b class="num">${HM(ctl.summitLeave)}</b></p>` : ''}${ctl.gates.length ? `<p>통제소: ${ctl.gates.map(g => `${esc(g.name)} <b class="num">${HM(g.close)}</b>`).join(', ')}</p>` : ''}
<p class="hint">동절기 정의: ${esc(it.winterLabel || '')} · ${it.custom ? '<span class="badge warn">직접 입력 · 확인 필요</span>' : `<a href="${esc(it.source)}" target="_blank" rel="noopener">${esc(it.sourceName)}</a>`}</p><p class="small"><strong>${it.custom ? '직접 입력값 — 확인 필요' : (it.park === '한라산' ? '한라산국립공원 탐방예약시스템 기준(2026-11-11 확인), 출발 전 공식 공지 재확인' : '국립공원공단 페이지 기준(2026-11-11 확인), 출발 전 공식 공지 재확인')}</strong>${it.park === '한라산' ? ' · 제주특별자치도 한라산국립공원관리소 관리' : ''}</p>${it.note ? `<p class="hint">${esc(it.note)}</p>` : ''}` : '<p><span class="badge warn">통제시간 미입력</span> 일몰 기준으로만 계산했어요. 해당 산의 입산 통제를 직접 확인하세요.</p>'}
<p>일출 <b class="num">${HM(sun.sunrise)}</b> · 일몰 <b class="num">${HM(sun.sunset)}</b> <span class="badge">${esc(sun.source)}</span></p>${it.geoApprox ? '<p class="hint">좌표는 정상 근사값이에요. 산그늘·능선 방향에 따라 실제 어두워지는 시각은 더 이를 수 있어요.</p>' : ''}</section>
${weatherCard(p, it, r)}
<section class="card"><h2>필수 장비</h2><ul class="gear">${W.gear(r, (mem.wx[wxKey(p, it)] || {}).data).map(g => `<li><label class="check ${g.strong ? 'strong' : ''}"><input type="checkbox" data-gear="${g.k}" ${(p.gear || {})[g.k] ? 'checked' : ''} ${shared ? 'disabled' : ''}>${esc(g.t)}${g.strong ? ' — 필수' : g.req ? '' : ' (권장)'}</label></li>`).join('')}</ul></section>
<details><summary>계산 공식·계수 보기</summary><div class="formula">${formulaHTML(p)}<p class="hint">하산 목표 = min(일몰 − 여유 ${r.margin}분, 공원 지정 하산 기준). 정상 도착 마감 = 하산 목표 − 하산 시간${r.stay ? ' − 정상 체류' : ''}. 입산 마감 = 통제시간과 (정상 마감 − 오름 시간) 중 이른 값. 신호등: 하산 예정이 하산 목표 이내면 초록, 30분 이내 초과면 노랑, 그보다 늦거나 일몰 후·통제시간 밖이면 빨강.</p></div></details>
<div class="actions noprint">${shared ? `<button class="btn" data-act="adopt">내 계획으로 저장</button><button class="btn ghost" data-act="ics">.ics 저장</button><a class="btn ghost" href="#/">홈</a>` : `<a class="btn" href="#/plan/${esc(p.id)}/notice">공지문 복사</a><a class="btn" href="#/plan/${esc(p.id)}/roster">인원 점검 시작</a><button class="btn ghost" data-act="share">공유 링크</button><button class="btn ghost" data-act="ics">.ics 저장</button><button class="btn ghost" data-act="edit">계획 수정</button><button class="btn warn" data-act="delete">계획 삭제</button>`}</div>
${disclaimer()}`;
    view().dataset.plan = shared ? '' : p.id;
    mem.cur = p;
  }
  function renderMissing(msg) { view().innerHTML = `<h1>계획을 찾을 수 없어요</h1><p>${esc(msg || '삭제됐거나 다른 기기에서 만든 계획이에요. 계획은 이 기기 브라우저에만 저장돼요.')}</p><a class="btn" href="#/">홈으로</a>`; }

  async function fetchWeather(p) {
    const it = itemFor(p), key = wxKey(p, it);
    const ok = await confirmBox('Open-Meteo에 예보를 요청할까요?', `정상 좌표(소수점 2자리 ${(+it.lat).toFixed(2)}, ${(+it.lon).toFixed(2)}), 정상 고도 ${it.summitElev}m, 날짜 ${p.date}를 api.open-meteo.com에 보내요.\nIP 등 접속 정보가 전달될 수 있어요. 이름·명단·연락처는 보내지 않고, 결과는 저장하지 않아요.`, '동의하고 불러오기');
    if (!ok) return;
    mem.wx[key] = { status: 'loading' }; route();
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    Object.entries({ latitude: (+it.lat).toFixed(2), longitude: (+it.lon).toFixed(2), elevation: Math.round(it.summitElev), hourly: 'temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,snowfall,weather_code', daily: 'sunrise,sunset', timezone: 'Asia/Seoul', wind_speed_unit: 'ms', start_date: p.date, end_date: p.date }).forEach(([k, v]) => u.searchParams.set(k, v));
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(u, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
      if (!res.ok) throw new Error('예보 서버가 응답하지 않았어요 (' + res.status + ').');
      const json = await res.json();
      const base = compute(p).r, st = settings();
      const from = base.mode === 'sunrise' ? base.start : base.start, to = base.plannedFinish;
      mem.wx[key] = { status: 'ok', data: W.weatherSummary(json, p.date, from, to, st) };
    } catch (e) { mem.wx[key] = { status: 'error', msg: e.name === 'AbortError' ? '예보 서버 응답이 늦어요.' : (e.message || '네트워크를 확인해 주세요.') }; }
    finally { clearTimeout(timer); }
    route();
  }

  /* ---------- 공지문 ---------- */
  function renderNotice(p) {
    const c = compute(p); if (!c) return renderMissing();
    const ct = contacts();
    const text = mem.notice[p.id] != null ? mem.notice[p.id] : W.notice(p, c.it, c.r, { leaderPhone: ct.leader, sweepPhone: ct.sweep, sourceLine: c.it.custom ? '직접 입력·확인 필요' : '국립공원공단 페이지 기준 2026-11-11 확인, 출발 전 재확인', weather: (mem.wx[wxKey(p, c.it)] || {}).data });
    view().innerHTML = `${ptabs(p, 'notice')}<h1>산행 공지문</h1><p class="mut">밴드·카톡에 그대로 붙일 수 있게 줄을 나눴어요. 고쳐 쓴 뒤 복사하세요.</p>
<section class="card"><h2>비상연락 (선택)</h2><div class="grid2"><div><label for="leader">대장 전화</label><input id="leader" type="tel" inputmode="tel" maxlength="20" autocomplete="off" value="${esc(ct.leader)}"></div><div><label for="sweep">후미대장 전화</label><input id="sweep" type="tel" inputmode="tel" maxlength="20" autocomplete="off" value="${esc(ct.sweep)}"></div></div>
<label class="check"><input type="checkbox" id="saveContacts" ${ct.saved ? 'checked' : ''}>이 기기에 연락처 저장 (기본: 저장 안 함)</label><p class="hint">저장하지 않으면 이 화면을 떠나면 지워져요. 공유 링크에는 어떤 경우에도 들어가지 않아요.</p><button class="btn ghost sm" data-act="regen">연락처 넣어 다시 만들기</button></section>
<label for="noticeText">공지문</label><textarea id="noticeText" rows="16">${esc(text)}</textarea>
<div class="actions"><button class="btn" data-act="copy-notice">공지문 복사</button><button class="btn ghost" data-act="reset-notice">처음 문구로</button></div>${disclaimer()}`;
  }

  /* ---------- 인원 점검 ---------- */
  const CPS = ['출발', '갈림길1', '정상', '하산', '탑승'];
  function rosters() { const r = load(RKEY, {}); return r && typeof r === 'object' ? r : {}; }
  function rosterFor(id) { const r = rosters()[id]; return r && Array.isArray(r.names) ? { names: r.names.slice(0, 80), checks: r.checks || {}, cp: CPS.includes(r.cp) ? r.cp : '출발' } : { names: [], checks: {}, cp: '출발' }; }
  function putRoster(id, r) { const all = rosters(); all[id] = r; save(RKEY, all); }
  function cpDeadline(c, cp) { const r = c.r; if (r.mode === 'sunrise') return cp === '출발' ? r.start : cp === '정상' ? r.summitTarget : null; return { '출발': r.entryDeadline, '갈림길1': r.checkpoints[0] ? r.checkpoints[0].deadline : null, '정상': r.summitDeadline, '하산': r.descentTarget }[cp] ?? null; }
  function renderRoster(p) {
    const c = compute(p); if (!c) return renderMissing();
    const ro = rosterFor(p.id), cp = ro.cp, st = W.rosterStatus(ro, cp), dl = cpDeadline(c, cp);
    const late = p.date === todayKST() && dl !== null && nowMinKST() > dl && st.missing.length;
    view().innerHTML = `${ptabs(p, 'roster')}<h1>인원 점검</h1>
${ro.names.length ? `<div class="cptabs" role="group" aria-label="체크포인트">${CPS.map(x => { const s2 = W.rosterStatus(ro, x); return `<button type="button" data-cp="${x}" aria-pressed="${x === cp}">${x} <span class="num">${s2.confirmed}/${s2.total}</span></button>`; }).join('')}</div>
<section class="card"><p class="count" aria-live="polite">${st.confirmed}/${st.total} 확인${st.missing.length ? ` · 미확인 ${st.missing.length}명` : ' ✓'}</p><p class="hint">${esc(cp)}${dl !== null ? ` 통과 마감 <span class="num">${HM(dl)}</span>` : ''} · 이름을 누르면 확인/취소, 시각이 자동 기록돼요.</p>
${late ? `<p class="banner-red" role="alert">${esc(cp)} 통과 마감 ${HM(dl)}이 지났어요. 미확인 ${st.missing.length}명: ${st.missing.map(esc).join(', ')}</p>` : ''}
<div class="chips">${ro.names.map(n => { const t = (ro.checks[cp] || {})[n]; return `<button type="button" class="chip" data-name="${esc(n)}" aria-pressed="${!!t}">${esc(n)}<small>${t ? t + ' ✓' : '미확인'}</small></button>`; }).join('')}</div></section>
<div class="actions"><button class="btn ghost" data-act="roster-clear-cp">${esc(cp)} 체크 지우기</button><button class="btn warn" data-act="roster-delete">명단 삭제</button></div>` : `<p class="mut">아직 명단이 없어요. 참가자 이름을 한 줄에 한 명씩 붙여 넣으세요. 출발·갈림길1·정상·하산·탑승 다섯 지점에서 확인해요.</p>`}
<details ${ro.names.length ? '' : 'open'}><summary>${ro.names.length ? '명단 고치기' : '명단 붙여넣기'}</summary><label for="names">참가자 (한 줄에 한 명, 최대 80명)</label><textarea id="names" rows="8" placeholder="김대장&#10;이총무&#10;박회원">${esc(ro.names.join('\n'))}</textarea><p class="hint">전화번호처럼 보이는 숫자는 자동으로 빼요. 명단은 이 기기에만 저장되고 공유 링크에 들어가지 않아요.</p><button class="btn" data-act="roster-save">명단 저장</button></details>`;
  }

  /* ---------- 비상 카드 ---------- */
  function renderCard(p) {
    const c = compute(p); if (!c) return renderMissing();
    const ro = rosterFor(p.id), ct = contacts();
    view().innerHTML = `${ptabs(p, 'card')}<section class="card ecard"><p class="big119">119</p><h1>사고 나면 이 순서로 말하세요</h1><ol>${W.emergency(c.it, p, ro.names.length || null).map(x => `<li><span class="k">${x.k}</span><span><strong>${esc(x.t)}</strong><br>${esc(x.d)}</span></li>`).join('')}</ol>
${ct.leader || ct.sweep ? `<p>대장 <span class="num">${esc(ct.leader || '-')}</span> · 후미대장 <span class="num">${esc(ct.sweep || '-')}</span></p>` : ''}</section>
<section class="card"><h2>화면 꺼짐 방지</h2><p>비상 시 이 화면을 켜 두려면 아래 버튼을 누르거나, 휴대폰 설정에서 자동 잠금 시간을 늘리세요. 배터리는 추위에 빨리 닳아요.</p>${'wakeLock' in navigator ? `<button class="btn ghost" data-act="wake" aria-pressed="${!!mem.wake}">${mem.wake ? '화면 켜두기 끄기' : '화면 켜두기'}</button>` : '<p class="hint">이 브라우저는 화면 켜두기 기능이 없어요.</p>'}</section>
<p class="hint">국가지점번호: 노란 표지판, 한글 2자 + 숫자 8자리. 출처: <a href="https://www.korea.kr/news/policyNewsView.do?newsId=148900038" target="_blank" rel="noopener">대한민국 정책브리핑</a>, <a href="https://www.juso.go.kr/" target="_blank" rel="noopener">주소정보누리집</a></p>${disclaimer()}`;
  }

  /* ---------- 공유 ---------- */
  function renderShared(payload) {
    let p;
    try { p = W.decodeShare(payload); } catch (e) { view().innerHTML = `<h1>공유 링크를 열 수 없어요</h1><p>${esc(e.message || '링크가 잘렸거나 손상됐어요.')} 보낸 사람에게 다시 받아 주세요.</p><a class="btn" href="#/">홈으로</a>`; return; }
    p.id = 'shared';
    if (!itemFor(p)) { renderMissing('공유된 들머리를 이 버전에서 찾지 못했어요.'); return; }
    renderPlan(p, true);
  }

  /* ---------- 출처 ---------- */
  function renderSources() {
    const parks = {}; (DATA ? DATA.items : []).forEach(i => (parks[i.park] = parks[i.park] || []).push(i));
    view().innerHTML = `<h1>출처·계산 기준·개인정보</h1>${disclaimer()}
<section class="card"><h2>입산통제시간</h2><p><strong>${esc(DATA ? DATA.notice : '')}</strong></p><p>국립공원공단 <a href="${esc(DATA ? DATA.source : '')}" target="_blank" rel="noopener">탐방로별 입산시간지정제</a> 표에서 ${DATA ? DATA.items.filter(i => i.park !== '한라산').length : 0}곳을, 한라산은 제주특별자치도 <a href="https://visithalla.jeju.go.kr/contents/contents.do?id=49" target="_blank" rel="noopener">한라산탐방 예약시스템 등산허용 안내</a>(성판악·관음사 탐방로 안내 페이지 포함)에서 5곳을 옮겼어요. 기준일 2026-11-11 (한국 시간).</p>
<p class="hint">원문 표기 오류로 보정한 값: 무등산 하절기 “04:00~1700” → 17:00. 한라산 누리집 하단의 이전 표(동절기 1·2·11·12월, 입산 06:00)는 2026-09-28 관리소 발표와 달라 쓰지 않았어요 — 입산 시작 05:00은 <span class="badge warn">확인 필요</span>로 표시.</p>
${Object.entries(parks).map(([k, v]) => `<details><summary>${esc(k)} · ${v.length}곳 · 동절기 ${esc(v[0].winterLabel)}</summary><ul class="srclist">${v.map(i => `<li>${esc(i.name)} → ${esc(i.summitName)} <span class="num">${i.summitElev}m</span>${i.elevApprox ? ' <span class="badge">고도 근사</span>' : ''}<br>동절기 <b>${i.winter.open}~${i.winter.close}</b> · 하절기 <b>${i.summer.open}~${i.summer.close}</b>${i.hut.length ? '<br><small>' + i.hut.map(h => esc(h.label) + ' +' + h.minutes / 60 + '시간').join(', ') + '</small>' : ''}${i.summitLeave ? `<br><small>하산 시작 동절기 ${i.summitLeave.winter} · 하절기 ${i.summitLeave.summer}</small>` : ''}${i.openVerified === false ? ' <span class="badge warn">입산 시작 05:00 확인 필요</span>' : ''}</li>`).join('')}</ul></details>`).join('')}
<p class="hint">${esc(DATA ? DATA.geoNote : '')}</p></section>
<section class="card"><h2>계산 기준</h2><ul><li>오름 = 거리÷4km/h + 누적 오름 100m당 10분, 하산 = 거리÷5km/h + 누적 하강 100m당 5분 → × 페이스(빠름 0.9 · 보통 1.0 · 초보 1.25 · 어르신 1.4) × 겨울 노면(1.0~1.3) + 시간당 휴식 10분. <span class="badge">앱 기본값 · 참고용</span></li><li>하산 목표 = min(일몰 − 여유 60~120분(기본 90), 공원 지정 하산 시작). 정상 도착 마감 = 하산 목표 − 하산 시간. 입산 마감 = 통제시간과 (정상 마감 − 오름 시간) 중 이른 값.</li><li>일출·일몰: 날씨를 불러오면 Open-Meteo daily, 아니면 <a href="https://gml.noaa.gov/grad/solcalc/calcdetails.html" target="_blank" rel="noopener">NOAA 태양 계산식</a> 근사(해수면·지형 무시).</li><li>체감온도: Open-Meteo apparent_temperature, 보조로 <a href="https://data.kma.go.kr/climate/windChill/selectWindChillChart.do" target="_blank" rel="noopener">기상청 겨울철 체감온도식</a>.</li><li>경고 기본값(체감 −10℃ 이하, 돌풍 15m/s 이상)은 앱 기본값이며 바꿀 수 있어요.</li></ul></section>
<section class="card" id="privacy"><h2>개인정보</h2><p>계획·명단·체크 기록은 이 기기 브라우저(localStorage <code>wh_plans_v1</code>, <code>wh_rosters_v1</code>, <code>wh_settings_v1</code>)에만 저장되고 서버로 보내지 않아요. 전화번호는 기본으로 저장하지 않으며, 저장을 고른 경우에만 <code>wh_contacts_v1</code>에 둬요. 공유 링크에는 이름·전화번호가 들어가지 않아요. 날씨는 동의한 경우에만 정상 좌표·고도·날짜를 Open-Meteo에 보내요. <a href="privacy.html">개인정보 안내 전문</a></p><button class="btn warn" data-act="wipe">이 기기의 앱 데이터 모두 지우기</button></section>`;
  }

  /* ---------- 이벤트 ---------- */
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-act],[data-pick],[data-q],[data-cp],[data-name]'); if (!t) return;
    if (t.dataset.pick) { D.trailheadId = t.dataset.pick; D.custom = null; D.elev = ''; D.hut = ''; D.checkpoints = []; renderStep(1); $('#picked') && $('#picked').scrollIntoView({ block: 'nearest' }); return; }
    if (t.dataset.q) { $('#q').value = t.dataset.q; drawResults(); return; }
    const p = mem.cur;
    if (t.dataset.cp && p) { const ro = rosterFor(p.id); ro.cp = t.dataset.cp; putRoster(p.id, ro); renderRoster(p); $(`[data-cp="${t.dataset.cp}"]`).focus(); return; }
    if (t.dataset.name && p) {
      const ro = rosterFor(p.id), cp = ro.cp, n = t.dataset.name; ro.checks[cp] = ro.checks[cp] || {};
      if (ro.checks[cp][n]) delete ro.checks[cp][n]; else ro.checks[cp][n] = HM(nowMinKST());
      putRoster(p.id, ro); renderRoster(p); const b = $$('.chip').find(x => x.dataset.name === n); b && b.focus(); return;
    }
    const a = t.dataset.act;
    if (a === 'new') { D = freshDraft(); return; }
    if (a === 'new-sunrise') { e.preventDefault(); D = freshDraft(); D.mode = 'sunrise'; D.date = t.dataset.date; D.title = '해맞이 산행'; location.hash = '#/new/1'; return; }
    if (a === 'onboarded') { setSettings({ onboarded: true }); renderHome(); return; }
    if (a === 'use-custom') {
      const cu = readCustom(), m = validCustom(cu); const err = $('#err');
      if (m) { err.textContent = m; return; }
      D.custom = cu; D.trailheadId = ''; D.elev = ''; D.hut = ''; location.hash = '#/new/2'; return;
    }
    if (a === 'add-cp') { readStep2(); D.checkpoints.push({ name: '', plannedTime: '' }); if (D.checkpoints.length === 1) D.checkpoints.push({ name: '', plannedTime: '' }); renderStep(2); return; }
    if (a === 'wx' && p) { fetchWeather(p); return; }
    if (a === 'save-th') { const c = +$('#chillWarn').value, g = +$('#gustWarn').value; if (!(c >= -40 && c <= 10) || !(g >= 5 && g <= 40)) { toast('체감 −40~10℃, 돌풍 5~40m/s 사이로 넣어 주세요'); return; } setSettings({ chillWarn: c, gustWarn: g }); Object.keys(mem.wx).forEach(k => delete mem.wx[k]); toast('경고 기준을 저장했어요. 날씨를 다시 불러오세요'); route(); return; }
    if (a === 'share' && p) {
      if (!await confirmBox('공유 링크 만들기', '링크에는 산·들머리·날짜·시각·코스·체크포인트만 들어가요.\n참가자 이름·전화번호·체크 기록은 들어가지 않아요. 링크를 받은 사람은 누구나 볼 수 있어요.', '링크 복사')) return;
      const url = location.href.split('#')[0] + '#/s/' + W.encodeShare(p);
      toast(await copy(url) ? '공유 링크를 복사했어요 (이름·전화번호 제외)' : '복사하지 못했어요. 주소창에서 직접 복사해 주세요'); return;
    }
    if (a === 'ics' && p) {
      const c = compute(p); if (!c) return;
      if (!await confirmBox('.ics 일정 파일 저장', '산 이름·시각·집결 장소가 파일에 들어가요. 참가자 이름·전화번호는 들어가지 않아요. 받은 파일을 공유하면 누구나 볼 수 있어요.', '저장')) return;
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      download(`winter-hike-${p.date}.ics`, W.ics(p, c.it, c.r, stamp), 'text/calendar;charset=utf-8'); toast('.ics 파일을 저장했어요'); return;
    }
    if (a === 'edit' && p) { D = Object.assign(freshDraft(), JSON.parse(JSON.stringify(p))); location.hash = '#/new/1'; return; }
    if (a === 'delete' && p) { if (!await confirmBox('계획 삭제', '이 계획과 인원 점검 기록을 이 기기에서 지울까요? 되돌릴 수 없어요.', '삭제')) return; delPlan(p.id); toast('계획을 삭제했어요'); location.hash = '#/'; return; }
    if (a === 'adopt' && p) { const n = Object.assign({}, p, { id: uid() }); delete n.shared; putPlan(n); toast('내 계획으로 저장했어요'); location.hash = '#/plan/' + n.id; return; }
    if (a === 'regen' && p) { readContacts(); delete mem.notice[p.id]; renderNotice(p); toast('공지문을 다시 만들었어요'); return; }
    if (a === 'reset-notice' && p) { delete mem.notice[p.id]; renderNotice(p); return; }
    if (a === 'copy-notice' && p) {
      const txt = $('#noticeText').value; mem.notice[p.id] = txt;
      const hasPhone = /0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(txt);
      if (!await confirmBox('공지문 복사', (hasPhone ? '공지문에 전화번호가 들어 있어요. 붙여 넣는 방의 모든 사람이 볼 수 있어요.\n' : '') + '붙여 넣기 전에 집결 장소·연락처 공개 범위를 확인하세요.', '복사')) return;
      toast(await copy(txt) ? '공지문을 복사했어요' : '복사하지 못했어요. 길게 눌러 직접 복사해 주세요'); return;
    }
    if (a === 'roster-save' && p) { const names = W.parseNames($('#names').value); const ro = rosterFor(p.id); ro.names = names; putRoster(p.id, ro); toast(`${names.length}명 명단을 저장했어요`); renderRoster(p); return; }
    if (a === 'roster-clear-cp' && p) { const ro = rosterFor(p.id); if (!await confirmBox('체크 지우기', ro.cp + ' 체크 기록을 지울까요?', '지우기')) return; ro.checks[ro.cp] = {}; putRoster(p.id, ro); renderRoster(p); return; }
    if (a === 'roster-delete' && p) { if (!await confirmBox('명단 삭제', '이 계획의 참가자 명단과 체크 기록을 모두 지울까요?', '삭제')) return; const all = rosters(); delete all[p.id]; save(RKEY, all); renderRoster(p); toast('명단을 삭제했어요'); return; }
    if (a === 'wake') { try { if (mem.wake) { await mem.wake.release(); mem.wake = null; } else { mem.wake = await navigator.wakeLock.request('screen'); mem.wake.addEventListener('release', () => { mem.wake = null; }); } } catch (err) { toast('화면 켜두기를 켜지 못했어요'); } p && renderCard(p); return; }
    if (a === 'wipe') { if (!await confirmBox('모두 지우기', '이 기기의 계획·명단·연락처·설정을 모두 지울까요? 되돌릴 수 없어요.', '모두 지우기')) return; [PKEY, RKEY, SKEY, CKEY].forEach(k => localStorage.removeItem(k)); mem.contacts = null; document.documentElement.classList.remove('hc'); syncHC(); toast('모두 지웠어요'); location.hash = '#/'; return; }
  });
  function readContacts() {
    const leader = ($('#leader') || {}).value || '', sweep = ($('#sweep') || {}).value || '', keep = ($('#saveContacts') || {}).checked;
    mem.contacts = { leader: leader.trim().slice(0, 20), sweep: sweep.trim().slice(0, 20), saved: !!keep };
    if (keep) save(CKEY, { leader: mem.contacts.leader, sweep: mem.contacts.sweep }); else localStorage.removeItem(CKEY);
  }
  document.addEventListener('change', e => {
    const g = e.target.closest('[data-gear]');
    if (g && mem.cur && mem.cur.id !== 'shared') { const p = getPlan(mem.cur.id); if (p) { p.gear = p.gear || {}; p.gear[g.dataset.gear] = g.checked; putPlan(p); mem.cur = p; } }
    if (e.target.id === 'saveContacts' || e.target.id === 'leader' || e.target.id === 'sweep') readContacts();
    if (e.target.id === 'noticeText' && mem.cur) mem.notice[mem.cur.id] = e.target.value;
  });
  document.addEventListener('submit', e => {
    if (e.target.closest('dialog')) return;
    e.preventDefault();
    const m = /^#\/new\/(\d)/.exec(location.hash); if (m) submitStep(+m[1]);
  });
  function syncHC() { const on = document.documentElement.classList.contains('hc'); $('#hc-toggle').setAttribute('aria-pressed', String(on)); $('meta[name=theme-color]').content = on ? '#0E1418' : '#1F5F4A'; }
  $('#hc-toggle').addEventListener('click', () => { const on = !document.documentElement.classList.contains('hc'); document.documentElement.classList.toggle('hc', on); setSettings({ hc: on }); syncHC(); });
  $('.skip').addEventListener('click', e => { e.preventDefault(); $('#main').focus(); });
  window.addEventListener('hashchange', route);

  /* ---------- 시작 ---------- */
  syncHC();
  const st = W.selfTest(); if (!st.ok) console.warn('selfTest', st.fails);
  fetch('data/trailheads.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { if (!j || !Array.isArray(j.items) || !j.items.length) throw new Error('empty'); DATA = j; })
    .catch(() => { DATA = { items: [], source: 'https://knps.or.kr/portal/main/contents.do?menuNo=8000198', notice: '통제시간 데이터를 불러오지 못했어요', geoNote: '' }; loadNote = '들머리 통제시간 데이터를 불러오지 못했어요. 직접 입력으로 계속 쓸 수 있고, 통제시간은 국립공원 누리집에서 확인하세요.'; })
    .finally(route);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  window.__wh = { selfTest: W.selfTest, compute };
})();
