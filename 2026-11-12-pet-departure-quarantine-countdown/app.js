/* 데려갈 수 있을까 — 화면 로직. 저장 키: petgo.v1(데이터), petgo.settings.v1(온보딩) — 이 기기에만 */
(function () {
  'use strict';
  const C = window.PetCalc, KEY = 'petgo.v1', SKEY = 'petgo.settings.v1', APP = '데려갈 수 있을까';
  const $ = (s, el) => (el || document).querySelector(s), $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');
  let R = null, RERR = null; const mem = { drawDate: null, arrival: null, shareUrl: '', shareOpts: { name: false, chip: false } };
  const today = () => C.todayKST();
  const F = (d, o) => '<span class="num">' + esc(C.fmt(d, o)) + '</span>';
  const ISO = d => '<span class="num">' + esc(d) + '</span>';
  /* ---------- 저장 ---------- */
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.pets) && Array.isArray(d.trips)) return d; } catch (e) { } return null; }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function settings() { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } }
  function setSettings(o) { localStorage.setItem(SKEY, JSON.stringify(Object.assign(settings(), o))); }
  const cur = () => { const d = load(); return d && d.pets[0] && d.trips[0] ? { d, pet: d.pets[0], trip: d.trips[0] } : null; };
  function calcPet(p) {
    return { name: p.name || '', chipNo: (p.chip && p.chip.no) || '', chipDate: (p.chip && p.chip.date) || null, birth: p.birth || null,
      shots: (p.rabies || []).filter(r => C.isDate(r.date)).map(r => ({ date: r.date, years: r.validMonths === 36 ? 3 : 1, validUntil: C.isDate(r.validUntil) ? r.validUntil : null })),
      titers: (p.titer || []).filter(t => C.isDate(t.drawDate)).map(t => ({ draw: t.drawDate, result: t.result === '' || t.result == null ? null : Number(t.result), lab: t.lab || '' })) };
  }
  function compute(pet, trip, o) {
    o = o || {}; const t = Object.assign({}, trip); if (o.arrival) t.arrival = o.arrival;
    if (t.departure && t.departure > t.arrival) t.departure = t.arrival;
    return C.plan(R, calcPet(pet), t, today(), { drawDate: o.drawDate || null });
  }
  const srcUrl = id => R.sources[id] ? R.sources[id].url : '';
  const srcLinks = ids => (ids || []).filter(id => R.sources[id]).map(id => `<a href="${esc(srcUrl(id))}" target="_blank" rel="noopener">${esc(R.sources[id].title)}</a>`).join(' · ');
  const cname = (trip) => { const c = R.countries[trip.country]; const sub = c.subs && trip.sub ? (c.subs.find(s => s[0] === trip.sub) || [])[1] : ''; return (sub || c.name); };
  /* ---------- 공통 UI ---------- */
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
  function confirmBox(title, html, ok) {
    return new Promise(res => { const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-b').innerHTML = html; $('#dlg-ok').textContent = ok || '계속'; d.returnValue = ''; d.showModal(); d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }); });
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.textContent = name + ' 받기'; a.hidden = true; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pageTitle(r) {
    const T = { home: '어디로, 언제 같이 가나요?', history: '주사·칩 기록 입력', verdict: '판정', timeline: '할 일 타임라인', docs: '서류 금고', share: '공유', vet: '동물병원 카드', rules: '나라별 규칙·출처', settings: '설정·데이터', shared: '공유받은 일정(읽기 전용)', notfound: '페이지를 찾을 수 없어요', error: '규칙을 불러오지 못했어요' };
    let t = T[r.name] || APP; if (r.name === 'rules' && r.arg && R && R.countries[r.arg]) t = R.countries[r.arg].name + ' 검역 규칙·출처';
    return t + ' — ' + APP + ' · 반려동물 출국 검역 역산표';
  }
  function route() {
    const h = location.hash.replace(/^#\/?/, ''); const [a, b] = h.split('/');
    if (!a) return { name: 'home' }; if (a === 's') return { name: 'shared', arg: h.slice(2) };
    if (['history', 'verdict', 'timeline', 'docs', 'share', 'vet', 'settings'].includes(a)) return { name: a }; if (a === 'rules') return { name: 'rules', arg: b };
    return { name: 'notfound' };
  }
  function render() {
    const r = RERR ? { name: 'error' } : route(); document.title = pageTitle(r);
    $$('.tabs a').forEach(a => { if (a.dataset.tab === r.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const fn = { home, history, verdict, timeline, docs, share, vet, rules, settings: settingsView, shared, notfound, error: errorView }[r.name];
    view.innerHTML = fn(r); bind(r); window.scrollTo(0, 0);
    if (render.n++) view.focus({ preventScroll: true });
  }
  render.n = 0;
  function noPlan(title) {
    return `<h1>${esc(title)}</h1><div class="card empty"><div class="ico" aria-hidden="true">🐶🐱</div><h2>아직 계산한 일정이 없어요</h2><p>홈에서 나라·도착일·생일만 넣으면 30초 안에 판정을 보여 드려요.</p><a class="btn" href="#/">판정 시작하기</a></div>`;
  }
  /* ---------- 홈 ---------- */
  function home() {
    const c = cur(); const st = settings(); const t = c ? c.trip : {}; const p = c ? c.pet : {};
    const ctry = Object.entries(R.countries).map(([k, v]) => `<label><input type="radio" name="country" value="${k}" ${t.country === k ? 'checked' : ''} required><span>${v.flag} ${esc(v.name)}</span></label>`).join('');
    const summary = c ? (() => { const r = compute(c.pet, c.trip); const v = r.verdict; return `<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">저장된 계획 · ${esc(p.name || '우리 아이')} ${esc(cname(t))}행</h2><p><span class="badge ${v.level === 'green' ? 'ok' : v.level === 'yellow' ? 'mid' : v.level === 'red' ? 'bad' : 'info'}">${esc(v.label)}</span> ${F(t.arrival)} 도착${r.earliest ? ' · 가장 빠른 도착 ' + F(r.earliest) : ''}</p><div class="actions"><a class="btn" href="#/verdict">판정 보기</a><a class="btn ghost" href="#/timeline">할 일 보기</a></div></section>`; })() : '';
    const onboard = st.onboarded ? '' : `<section class="card soft" aria-labelledby="ob-h"><h2 id="ob-h">처음이세요? 이렇게 써요</h2><ol class="reasons"><li><b>나라·도착일·생일</b>만 넣고 판정을 받아요.</li><li>주사·칩 기록이 있으면 넣어요 — 인정되는 주사를 자동으로 가려요.</li><li>할 일 타임라인을 <b>.ics</b>로 캘린더에 걸고, 가족·동물병원과 공유해요.</li></ol><p class="small">입력한 정보는 이 기기에만 저장돼요. 서버로 보내지 않아요.</p><button class="btn ghost" type="button" data-act="onboard">알겠어요</button></section>`;
    return `<section class="hero"><h1>어디로, 언제 같이 가나요?</h1><p class="lead">희망 도착일에 <b>같이 들어갈 수 있는지</b>(가능·빠듯·불가)와 계류 일수, 가장 빠른 도착일을 바로 계산해요.</p></section>
${summary}${onboard}
<form id="homeform" class="card" novalidate aria-labelledby="hf-h"><h2 id="hf-h">${c ? '새로 계산하기' : '30초 판정'}</h2>
<fieldset style="border:0;padding:0;margin:0"><legend><b>가려는 나라</b></legend><div class="chips" style="margin-top:8px">${ctry}</div></fieldset>
<div id="sub-wrap"></div>
<div class="grid2"><div><label for="arrival">희망 도착일</label><input id="arrival" name="arrival" type="date" min="${today()}" value="${esc(t.arrival || '')}" required aria-describedby="arrival-err"><p class="err" id="arrival-err" hidden></p></div>
<div><label for="pname">반려동물 이름 (선택)</label><input id="pname" name="pname" type="text" maxlength="20" autocomplete="off" value="${esc(p.name || '')}" placeholder="예: 콩이"></div></div>
<fieldset style="border:0;padding:0;margin:12px 0 0"><legend><b>개 / 고양이</b></legend><div class="seg" style="margin-top:8px"><label><input type="radio" name="species" value="dog" ${t.species !== 'cat' ? 'checked' : ''}><span>🐶 개</span></label><label><input type="radio" name="species" value="cat" ${t.species === 'cat' ? 'checked' : ''}><span>🐱 고양이</span></label></div></fieldset>
<div class="grid2"><div><label for="birth">생일</label><input id="birth" name="birth" type="date" max="${today()}" value="${esc(p.birth || '')}" aria-describedby="birth-err birth-h"><p class="hint" id="birth-h">91일령(일본)·12주령(EU·영국)·6개월령(미국) 확인에 써요.</p><p class="err" id="birth-err" hidden></p></div>
<div><label class="check" style="margin-top:42px"><input type="checkbox" name="nobirth" ${c && !p.birth ? 'checked' : ''}> 생일 모름(성견·성묘)</label></div></div>
<fieldset style="border:0;padding:0;margin:12px 0 0"><legend><b>지금까지 한 것</b></legend><div class="seg three" style="margin-top:8px"><label><input type="radio" name="start" value="none" ${!c || !(p.rabies || []).length ? 'checked' : ''}><span>아직 아무것도 안 했어요</span></label><label><input type="radio" name="start" value="records" ${c && (p.rabies || []).length ? 'checked' : ''}><span>주사·칩 기록 있어요</span></label></div></fieldset>
<p class="err" id="form-err" hidden role="alert"></p>
<button class="btn block" type="submit" style="margin-top:14px">같이 갈 수 있는지 보기</button>
<p class="small" style="margin-top:8px">모르는 칸은 비워 두면 보수적으로 “새로 시작”으로 계산해요.</p></form>`;
  }
  function subFields(country, trip) {
    if (country === 'EU') { const c = R.countries.EU; return `<label for="sub">EU 도착 국가</label><select id="sub" name="sub">${c.subs.map(s => `<option value="${s[0]}" ${trip.sub === s[0] ? 'selected' : ''}>${esc(s[1])}${s[2] ? ' (개 촌충 구제)' : ''}</option>`).join('')}</select>`; }
    if (country === 'JP') return `<label for="airport">도착 공항 (개는 지정 공항만)</label><select id="airport" name="airport"><option value="">선택 안 함</option>${R.countries.JP.dogAirports.map(a => `<option value="${a[0]}" ${trip.airport === a[0] ? 'selected' : ''}>${esc(a[1])} (${a[0]})</option>`).join('')}<option value="OTH_X" ${trip.airport === 'OTH_X' ? 'selected' : ''}>그 밖의 공항</option></select>`;
    if (country === 'AU') return `<div class="banner" role="note">🇦🇺 호주는 복잡도가 높아요 — 개요 일정만 보여 드려요. 경험 있는 운송 대행 상담을 권해요.</div>`;
    return '';
  }
  /* ---------- 이력 입력 ---------- */
  function history() {
    const c = cur(); if (!c) return noPlan('주사·칩 기록 입력'); const p = c.pet, t = c.trip;
    const rab = (p.rabies && p.rabies.length ? p.rabies : [{}]).map((r, i) => shotRow(r, i)).join('');
    const ti = (p.titer && p.titer[0]) || {};
    return `<h1>주사·칩 기록 입력</h1><p class="lead">${esc(p.name || '우리 아이')} · ${esc(cname(t))} ${F(t.arrival)} 도착. 모르면 비워 두세요 — 비우면 보수적으로 새로 시작으로 계산해요.</p>
<form id="histform" novalidate>
<section class="card"><h2>마이크로칩</h2><div class="grid2"><div><label for="chipdate">칩 이식일</label><input id="chipdate" name="chipdate" type="date" max="${today()}" value="${esc((p.chip && p.chip.date) || '')}"></div>
<div><label for="chipno">칩 번호 15자리 (선택)</label><input id="chipno" name="chipno" type="text" inputmode="numeric" maxlength="15" autocomplete="off" value="${esc((p.chip && p.chip.no) || '')}" aria-describedby="chipno-err"><p class="err" id="chipno-err" hidden></p></div></div>
<p class="hint">칩 번호는 이 기기에만 저장되고, 공유 링크에는 기본으로 빠져요.</p></section>
<section class="card"><h2>광견병 주사</h2><p class="hint">맞은 날짜와 유효기간(1년/3년)을 넣어요. 증명서에 적힌 유효기간 종료일이 있으면 그 날짜를 넣으면 더 정확해요.</p><div id="shots">${rab}</div><button class="btn ghost block" type="button" data-act="addshot">+ 주사 추가</button><div id="shotcheck" aria-live="polite"></div></section>
<section class="card"><h2>항체검사 (있으면)</h2><div class="grid2"><div><label for="draw">채혈일</label><input id="draw" name="draw" type="date" max="${today()}" value="${esc(ti.drawDate || '')}"></div>
<div><label for="titer">결과 (IU/ml, 대기 중이면 비움)</label><input id="titer" name="titer" type="number" step="0.01" min="0" max="999" value="${ti.result == null ? '' : esc(ti.result)}"></div></div>
<label for="lab">검사기관 (선택)</label><input id="lab" name="lab" type="text" maxlength="40" value="${esc(ti.lab || '')}" placeholder="예: 검역본부 서울지역본부 전염병검사과"></section>
<section class="card"><h2>여행 정보</h2><div class="grid2"><div><label for="departure">출국일 (비우면 도착일과 같음)</label><input id="departure" name="departure" type="date" min="${today()}" value="${esc(t.departure || '')}"></div>
<div><label for="ret">한국 귀국 예정일 (선택)</label><input id="ret" name="ret" type="date" min="${today()}" value="${esc(t.returnDate || '')}"></div></div>
${t.country === 'GB' || (t.country === 'EU' && R.countries.EU.subs.some(s => s[0] === t.sub && s[2])) ? `<label for="atime">도착 예정 시각 (촌충 구제 시간 창 계산)</label><input id="atime" name="atime" type="time" value="${esc(t.arrivalTime || '')}">` : ''}
${t.country === 'AU' ? `<label for="labdays">RNATT 시료 운송일 (일)</label><input id="labdays" name="labdays" type="number" min="0" max="60" value="${esc(t.labDays || 0)}">` : ''}
${t.country === 'JP' || t.country === 'EU' ? subFields(t.country, t) : ''}</section>
<p class="err" id="hist-err" hidden role="alert"></p>
<button class="btn block" type="submit">저장하고 판정 보기</button></form>`;
  }
  function shotRow(r, i) {
    return `<div class="shotrow" data-i="${i}"><div><label for="sd${i}">${i + 1}번째 주사 날짜</label><input id="sd${i}" name="sd" type="date" max="${today()}" value="${esc(r.date || '')}"></div>
<div><label for="sy${i}">유효기간</label><select id="sy${i}" name="sy"><option value="12" ${r.validMonths !== 36 ? 'selected' : ''}>1년</option><option value="36" ${r.validMonths === 36 ? 'selected' : ''}>3년</option></select></div>
<div><label for="su${i}">유효기간 종료일 (선택)</label><input id="su${i}" name="su" type="date" value="${esc(r.validUntil || '')}"></div>
<button class="btn ghost" type="button" data-act="delshot" aria-label="${i + 1}번째 주사 삭제">삭제</button></div>`;
  }
  function readShots() { return $$('#shots .shotrow').map(row => ({ date: $('[name=sd]', row).value, validMonths: Number($('[name=sy]', row).value), validUntil: $('[name=su]', row).value || null })).filter(r => r.date); }
  function shotCheck() {
    const c = cur(); if (!c) return; const P = R.countries[c.trip.country].params || {};
    const list = C.validVaccines($('#chipdate').value || null, readShots().map(r => ({ date: r.date, years: r.validMonths === 36 ? 3 : 1, validUntil: r.validUntil })), c.pet.birth, P.minAgeDays || 0);
    C.chain(list.filter(s => s.status === 'ok'));
    $('#shotcheck').innerHTML = list.length ? `<h3>판별 결과</h3>${list.map(s => `<div class="shot"><span>${F(s.date)}<br><span class="small">유효 ~${F(s.until)}</span></span><span>${s.status === 'ok' ? '<span class="badge ok">인정</span>' : `<span class="badge bad">불인정</span>`} ${s.status === 'ok' ? (s.link === 'broken' ? '<span class="badge bad">끊김 → 새 1차</span>' : s.link === 'continued' ? '<span class="badge info">이어짐</span>' : '<span class="badge info">1차</span>') : `<span class="small">${esc(s.reason)}</span>`}</span></div>`).join('')}` : '';
  }
  /* ---------- 판정 ---------- */
  function sigCard(r, trip, pet, shared) {
    const v = r.verdict; const nm = pet.name ? esc(pet.name) + ' · ' : '';
    const q = r.quarantineDays; const icon = { green: '✓', yellow: '!', red: '✕', info: 'i' }[v.level];
    const headline = `${esc(cname(trip))} ${ISO(trip.arrival)} 도착 → <b>${esc(v.label)}</b>`;
    let line = '';
    if (r.earliest) line = `${r.path === 'fresh' ? '오늘 시작 기준' : r.path === 'us' ? '6개월령·오늘 기준' : r.path === 'titerDone' ? '받은 항체검사 기준' : '맞은 주사 기록 기준'} 가장 빠른 도착일 ${F(r.earliest)}`;
    if (q > 0) line += ` · 이날 도착하면 약 <b class="num">${q}일</b> 계류(비용 보호자 부담)`;
    return `<section class="signal ${v.level}" aria-labelledby="sig-lv"><div class="sig-top"><span class="dot" aria-hidden="true">${icon}</span><div><div class="sig-lv" id="sig-lv">${esc(v.label)}${r.complex ? ' <span class="badge check">개요</span>' : ''}</div><div class="small">${nm}${esc(v.headline)}</div></div></div>
<p class="sig-head">${headline}</p>${line ? `<p>${line}</p>` : ''}
${r.earliest ? `<div class="stats"><div class="stat hl"><small>가장 빠른 도착</small><b>${esc(C.fmt(r.earliest, 'now'))}</b></div><div class="stat"><small>${r.slack >= 0 ? '여유' : '모자람'}</small><b>${Math.abs(r.slack)}일</b></div>${r.country === 'JP' ? `<div class="stat"><small>계류 예상</small><b>${q == null ? '계산 불가' : q + '일'}</b></div><div class="stat"><small>사전신고 마감</small><b>${esc(C.fmt(r.noticeDeadline, 'now'))}</b></div>` : ''}${r.country === 'US' && r.ageDate ? `<div class="stat"><small>6개월령 되는 날</small><b>${esc(C.fmt(r.ageDate, 'now'))}</b></div>` : ''}</div>` : ''}
${v.reasons && v.reasons.length ? `<ul class="reasons">${v.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
${v.basis ? `<p class="small" style="margin-top:8px">근거: ${esc(v.basis)} · ${srcLinks(r.src)} · 확인일 <span class="num">${esc(R.checkedAt)}</span></p>` : ''}
<p class="small"><b>최종 판단은 검역본부·도착국 공식 안내</b>를 따르세요.</p>${shared ? '' : ''}</section>`;
  }
  function warnList(r) { return r.warnings.length ? `<section class="card" aria-labelledby="w-h"><h2 id="w-h">확인할 점</h2><ul class="warns">${r.warnings.map(w => `<li class="${esc(w.level)}"><span aria-hidden="true">${w.level === 'bad' ? '⛔' : w.level === 'check' ? '🔎' : w.level === 'info' ? 'ℹ️' : '⚠️'}</span><span>${w.level === 'check' ? '<span class="badge check">확인 필요</span> ' : ''}${esc(w.text)}${w.src && w.src.length ? `<br><span class="small">${srcLinks(w.src)}</span>` : ''}</span></li>`).join('')}</ul></section>` : ''; }
  function todos(r, n) {
    const t = today(); const list = r.events.filter(e => (e.end || e.date) >= t && e.kind !== 'arrive').slice(0, n);
    return list.length ? `<ol class="todo">${list.map(e => `<li><span class="d">${F(e.date, 'short')}${e.end ? '~' + F(e.end, 'short') : ''}</span><span><b>${esc(e.title)}</b>${e.place ? `<br><span class="small">${esc(e.place)}</span>` : ''}</span></li>`).join('')}</ol>` : '<p class="small">남은 할 일이 없어요.</p>';
  }
  function verdict() {
    const c = cur(); if (!c) return noPlan('판정'); const { pet, trip } = c; const r = compute(pet, trip, mem);
    const A = mem.arrival || trip.arrival; const drawDone = r.steps && r.steps.draw && r.steps.draw.done;
    const sl = r.earliest ? `<section class="card" aria-labelledby="wi-h"><h2 id="wi-h">만약에? 날짜 바꿔 보기</h2>
<div class="slider"><div class="val"><label for="s-arr" style="margin:0">도착일</label><output id="o-arr" class="num">${esc(C.fmt(A))}</output></div><input id="s-arr" type="range" min="-120" max="240" step="1" value="${C.diff(A, trip.arrival)}" aria-valuetext="${esc(C.fmt(A))}"></div>
${r.steps && r.steps.draw && !drawDone ? `<div class="slider"><div class="val"><label for="s-draw" style="margin:0">채혈일</label><output id="o-draw" class="num">${esc(C.fmt(r.steps.draw.date))}</output></div><input id="s-draw" type="range" min="0" max="120" step="1" value="${C.diff(r.steps.draw.date, r.steps.draw.earliest)}" aria-valuetext="${esc(C.fmt(r.steps.draw.date))}"><p class="hint">가장 이른 채혈 가능일 ${F(r.steps.draw.earliest)}부터 늦춰 볼 수 있어요.</p></div>` : ''}
<div class="row"><button class="btn ghost" type="button" data-act="resetwhatif">원래 날짜로</button><button class="btn ghost" type="button" data-act="applyarr">이 도착일로 저장</button></div></section>` : '';
    const agent = (r.verdict.level === 'red' || r.verdict.level === 'yellow' || r.complex) ? `<section class="card" aria-labelledby="ag-h"><h2 id="ag-h">도움이 필요하면</h2><p>날짜가 빠듯하거나 절차가 복잡하면 검역 경험이 있는 동물병원이나 반려동물 운송 대행 상담을 받아 보세요. 이 앱은 특정 업체와 제휴하지 않아요.</p><p class="small">국가별 공식 안내문: ${srcLinks(['qia_list'])}</p></section>` : '';
    return `<h1>판정</h1>${r.complex ? '<div class="banner" role="note">🇦🇺 복잡도 높음, 대행 상담 권장 — 호주는 최소 6개월 이상 걸리는 복잡한 절차예요. 아래는 개요 일정이에요.</div>' : ''}
<div id="sig">${sigCard(r, Object.assign({}, trip, { arrival: A }), pet)}</div>
<section class="card" aria-labelledby="td-h"><h2 id="td-h">그럼 오늘 뭐 해요?</h2>${todos(r, 3)}<div class="actions"><a class="btn" href="#/timeline">전체 타임라인</a><button class="btn ghost" type="button" data-act="ics">.ics 받기</button></div></section>
${sl}${warnList(r)}${r.returnPlan ? returnCard(r) : ''}
<section class="card" aria-labelledby="sh-h"><h2 id="sh-h">주사 판별</h2>${shotsTable(r)}<a class="btn ghost block" href="#/history">기록 고치기</a></section>
${ruleCards(trip.country, 4)}${agent}`;
  }
  function returnCard(r) { const x = r.returnPlan; return `<section class="card" aria-labelledby="rt-h"><h2 id="rt-h">한국 귀국 ${F(x.date)}</h2><ul class="reasons">${x.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul><p class="small"><span class="badge check">확인 필요</span> 출발국의 광견병 비발생지역 여부 · ${srcLinks(['qia_import_en', 'qia_faq'])}${r.country === 'JP' ? ' · ' + srcLinks(['jp_export']) : ''}</p></section>`; }
  function shotsTable(r) {
    if (!r.shots || !r.shots.length) return '<p>입력한 주사가 없어요 — 1차부터 시작하는 경로로 계산했어요.</p>';
    return r.shots.map(s => `<div class="shot"><span>${F(s.date)}</span><span>${s.status === 'ok' ? '<span class="badge ok">인정</span> ' + (s.link === 'broken' ? '<span class="badge bad">끊김</span>' : s.link === 'continued' ? '<span class="badge info">이어짐</span>' : '<span class="badge info">1차</span>') : '<span class="badge bad">불인정</span> <span class="small">' + esc(s.reason) + '</span>'}</span></div>`).join('') + (r.brokenDead ? '<p class="err">마지막 주사의 유효기간이 지났어요 — 1차부터 다시 시작해요.</p>' : '');
  }
  function ruleCards(country, n) {
    const c = R.countries[country]; const list = n ? c.rules.slice(0, n) : c.rules;
    return `<section class="card" aria-labelledby="rc-h"><h2 id="rc-h">${c.flag} ${esc(c.name)} 규칙 ${n ? '요약' : ''}</h2>${list.map(rule => ruleCard(rule)).join('')}${n ? `<a class="btn ghost block" href="#/rules/${country}">${esc(c.name)} 규칙 모두 보기</a>` : ''}</section>`;
  }
  function ruleCard(rule) {
    return `<article class="rulecard"><h3>${esc(rule.label)}${rule.value != null ? ` <span class="badge info num">${esc(rule.value)}${esc(rule.unit || '')}</span>` : ''}${rule.status === 'check' ? ' <span class="badge check">확인 필요</span>' : ' <span class="badge ok">공식 확인</span>'}</h3><p>${esc(rule.text)}</p>${rule.note ? `<p class="small">${esc(rule.note)}</p>` : ''}<p class="src">출처: ${srcLinks(rule.src)} · 확인일 <span class="num">${esc(R.checkedAt)}</span></p></article>`;
  }
  /* ---------- 타임라인 ---------- */
  function stepsHtml(r, pet) {
    const t = today(); const items = [];
    const s = r.steps || {};
    if (s.chip && s.chip.done && s.chip.date) items.push({ date: s.chip.date, title: '마이크로칩 이식 (완료)', kind: 'past' });
    if (s.vax1 && s.vax1.done) items.push({ date: s.vax1.date, title: '광견병 ' + (s.vax2 ? '1차' : '') + ' 주사 (인정)', kind: 'past' });
    if (s.vax2 && s.vax2.done) items.push({ date: s.vax2.date, title: '광견병 2차 주사 (인정)', kind: 'past' });
    if (s.draw && s.draw.done) items.push({ date: s.draw.date, title: '항체검사 채혈' + (s.draw.pending ? ' (결과 대기)' : ' (완료)'), kind: 'past' });
    const all = items.concat(r.events).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    let todayShown = false; let html = '<ol class="steps">';
    all.forEach((e, i) => {
      if (!todayShown && e.date >= t) { html += `<li aria-label="오늘"><span class="today">오늘 ${esc(C.fmt(t, 'short'))}</span></li>`; todayShown = true; }
      const past = (e.end || e.date) < t || e.kind === 'past'; const cls = past ? 'past' : e.kind === 'deadline' ? 'deadline' : e.kind === 'arrive' ? 'arrive' : '';
      html += `<li class="${cls}"><span class="mk" aria-hidden="true">${past ? '✓' : e.kind === 'deadline' ? '!' : e.kind === 'arrive' ? '✈' : i + 1}</span><div class="when">${F(e.date)}${e.end ? ' ~ ' + F(e.end) : ''}</div><div class="what">${esc(e.title)}</div>${e.place ? `<div class="small">📍 ${esc(e.place)}</div>` : ''}${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}${e.src && e.src.length ? `<details><summary>출처</summary><p class="small">${srcLinks(e.src)} · 확인일 ${esc(R.checkedAt)}</p></details>` : ''}</li>`;
    });
    if (!todayShown) html += `<li><span class="today">오늘 ${esc(C.fmt(t, 'short'))}</span></li>`;
    return html + '</ol>';
  }
  function timeline() {
    const c = cur(); if (!c) return noPlan('할 일 타임라인'); const r = compute(c.pet, c.trip, mem);
    return `<h1>할 일 타임라인</h1><p class="lead">${esc(c.pet.name || '우리 아이')} · ${esc(cname(c.trip))} ${F(mem.arrival || c.trip.arrival)} 도착 · 오늘부터 날짜순</p>${r.complex ? '<div class="banner" role="note">복잡도 높음, 대행 상담 권장 — 개요 일정이에요.</div>' : ''}
<section class="card">${stepsHtml(r, c.pet)}</section><p class="small">검역본부 사무실은 평일만 운영해요(공휴일은 계산에 넣지 않았어요). 주말·공휴일이면 앞당겨 예약하세요.</p>
<div class="actions"><button class="btn" type="button" data-act="ics">.ics 받기 (알림 포함)</button><a class="btn ghost" href="#/vet">동물병원 카드</a></div>`;
  }
  /* ---------- 서류 금고 ---------- */
  const DOCS = {
    common: [['vaxcert', '광견병 접종증명서'], ['airline', '항공사 반려동물 예약 확인']],
    JP: [['titer', '항체검사 성적서 (칩 번호·채혈일 일치 확인)'], ['notice', '일본 사전신고 수리서(届出受理書)'], ['formac', 'Form AC (+ATTACH)'], ['export', '검역본부 수출검역증명서']],
    EU: [['titer', '항체검사 성적서 (지정 실험실)'], ['ahc', 'EU 동물건강증명서 (발급 10일 유효)'], ['decl', '비상업 이동 선언서']],
    GB: [['titer', '혈액검사 결과 (EU 승인 실험실)'], ['gbhc', 'GB 건강증명서 (발급 후 10일 안 입국)'], ['decl', '비판매 선언서'], ['tape', '촌충 구제 기록 (개)']],
    US: [['cdc', 'CDC Dog Import Form 영수증 (6개월 유효)'], ['export', '검역본부 수출검역증명서']],
    AU: [['identity', '정부 수의사 신원확인서 (선택)'], ['titer', 'RNATT 성적서·신고서 (12개월 유효)'], ['permit', '수입허가 (BICON)'], ['peq', 'Mickleham 계류 예약']]
  };
  function autoExpiry(key, r, pet) {
    if (key === 'vaxcert') { const ok = (r.shots || []).filter(s => s.status === 'ok'); return ok.length ? ok[ok.length - 1].until : null; }
    if (key === 'titer') { const d = r.steps && r.steps.draw; if (!d || !d.done) return null; if (r.country === 'JP') return C.addDays(C.addMonths(d.date, 24), -1); if (r.country === 'AU') return C.addDays(C.addMonths(d.date, 12), -1); }
    return null;
  }
  function docs() {
    const c = cur(); if (!c) return noPlan('서류 금고'); const { d, pet, trip } = c; const r = compute(pet, trip); const t = today();
    const store = ((d.docs || {})[pet.id] || {})[trip.country] || {};
    const list = DOCS.common.slice(0, 1).concat(DOCS[trip.country] || []).concat(DOCS.common.slice(1));
    const chipNo = (pet.chip && pet.chip.no) || '';
    const items = list.map(([k, label]) => {
      const s = store[k] || {}; const exp = s.expiry || autoExpiry(k, r, pet); const b = C.docBadge(exp, t);
      const badge = b === 'expired' ? '<span class="badge bad">만료</span>' : b === 'soon' ? '<span class="badge mid">30일 안 만료</span>' : b === 'ok' ? '<span class="badge ok">유효</span>' : '';
      return `<div class="rulecard" data-doc="${k}"><label class="check" style="margin:0"><input type="checkbox" name="done" ${s.done ? 'checked' : ''}> <span>${esc(label)}</span></label><div class="row" style="align-items:center">${badge}${exp ? `<span class="small">유효기간 ${F(exp)}${!s.expiry ? ' (자동 계산)' : ''}</span>` : ''}</div>
<div class="grid2"><div><label for="ex-${k}">유효기간 종료일 (선택)</label><input id="ex-${k}" name="expiry" type="date" value="${esc(s.expiry || '')}"></div><div><label for="me-${k}">메모</label><input id="me-${k}" name="memo" type="text" maxlength="80" value="${esc(s.memo || '')}"></div></div></div>`;
    }).join('');
    return `<h1>서류 금고</h1><p class="lead">${esc(cname(trip))}행 서류 체크리스트. 만료 30일 전이면 노랑, 지나면 빨강이에요. 사진은 저장하지 않고 글 메모만 남겨요.</p>
<section class="card"><h2>마이크로칩 번호</h2><label for="v-chip">15자리 숫자</label><input id="v-chip" type="text" inputmode="numeric" maxlength="15" autocomplete="off" value="${esc(chipNo)}" aria-describedby="v-chip-msg"><p id="v-chip-msg" class="small" aria-live="polite">${chipMsg(chipNo, trip)}</p><button class="btn ghost" type="button" data-act="savechip">칩 번호 저장</button></section>
<form id="docform" class="card" novalidate><h2>체크리스트</h2>${items}<button class="btn block" type="submit">서류 저장</button></form>`;
  }
  function chipMsg(no, trip) {
    if (!no) return '아직 입력하지 않았어요.';
    if (!C.chipValid(no)) return '<span class="err">칩 번호는 숫자 15자리여야 해요 (지금 ' + esc(String(no).length) + '자리).</span>';
    if (trip.country === 'JP' && /^900202/.test(no)) return '<span class="err">앞 6자리 900202 칩은 일본에서 당분간 인정되지 않아요.</span> ' + srcLinks(['jp_aqs']);
    return '<span class="badge ok">형식 OK</span> 항체검사 성적서·증명서의 번호와 한 자리도 다르지 않은지 확인하세요.';
  }
  /* ---------- 공유 ---------- */
  function share() {
    const c = cur(); if (!c) return noPlan('공유');
    const o = mem.shareOpts; const hasChip = C.chipValid((c.pet.chip && c.pet.chip.no) || '');
    return `<h1>공유</h1><p class="lead">가족 링크는 읽기 전용 타임라인을 열어요. 서버를 거치지 않고 링크 주소(#) 안에 일정만 담아요.</p>
<section class="card" aria-labelledby="fl-h"><h2 id="fl-h">가족 공유 링크</h2><p>기본으로 <b>이름·칩 번호·메모는 빠져요</b>. 날짜(생일·칩 이식일·주사·채혈)와 나라·도착일만 들어가요.</p>
<label class="check"><input type="checkbox" id="opt-name" ${o.name ? 'checked' : ''}> 반려동물 이름 포함</label>
<label class="check"><input type="checkbox" id="opt-chip" ${o.chip ? 'checked' : ''} ${hasChip ? '' : 'disabled'}> 칩 번호 포함 (뒤 6자리 가림)${hasChip ? '' : ' — 칩 번호 없음'}</label>
<button class="btn block" type="button" data-act="mklink">링크 만들기</button>
<div id="linkout">${mem.shareUrl ? linkBox(mem.shareUrl) : ''}</div></section>
<section class="card" aria-labelledby="vc-h"><h2 id="vc-h">동물병원 카드</h2><p>진료실에서 휴대폰 화면 하나로 보여 줄 큰 글씨 카드예요. 칩 번호는 이 기기 화면에만 보여요.</p><a class="btn ghost block" href="#/vet">동물병원 카드 열기</a></section>
<section class="card" aria-labelledby="im-h"><h2 id="im-h">D-day 이미지</h2><p>“${esc(c.pet.name || '우리 아이')} ${esc(R.countries[c.trip.country].city)}행 D-N” 이미지를 만들어 저장해요(이름이 들어가요).</p><button class="btn ghost block" type="button" data-act="img">이미지 저장</button></section>`;
  }
  const linkBox = u => `<label for="share-url">만든 링크</label><div class="linkbox"><input id="share-url" type="text" readonly value="${esc(u)}"><button class="btn" type="button" data-act="copylink">복사</button>${navigator.share ? '<button class="btn ghost" type="button" data-act="sharelink">보내기</button>' : ''}</div>`;
  /* ---------- 동물병원 카드 ---------- */
  function vet() {
    const c = cur(); if (!c) return noPlan('동물병원 카드'); const { pet, trip } = c; const r = compute(pet, trip);
    const chip = (pet.chip && pet.chip.no) || ''; const ok = (r.shots || []);
    return `<div class="vet"><h1>동물병원 카드</h1><section class="card"><dl class="kv"><dt>목적지</dt><dd><b>${esc(R.countries[trip.country].flag)} ${esc(cname(trip))}</b> · ${F(trip.arrival)} 도착</dd><dt>이름</dt><dd>${esc(pet.name || '—')} (${trip.species === 'cat' ? '고양이' : '개'})</dd><dt>생일</dt><dd>${pet.birth ? F(pet.birth) : '모름'}</dd><dt>칩 번호</dt><dd class="big num">${esc(chip || '미입력')}</dd><dt>칩 이식일</dt><dd>${pet.chip && pet.chip.date ? F(pet.chip.date) : '미입력'}</dd></dl></section>
<section class="card"><h2>광견병 주사</h2>${ok.length ? `<div class="tbl"><table><thead><tr><th scope="col">날짜</th><th scope="col">판별</th></tr></thead><tbody>${ok.map(s => `<tr><td>${F(s.date, 'short')}</td><td>${s.status === 'ok' ? (s.link === 'broken' ? '인정 · <b>끊김</b>' : '인정') : '<b>불인정</b>'}</td></tr>`).join('')}</tbody></table></div>` : '<p>기록 없음 → 1차부터</p>'}</section>
<section class="card"><h2>다음 할 일</h2>${todos(r, 3)}</section><section class="card"><h2>근거</h2><p class="small">${srcLinks(r.src)} · 확인일 ${esc(R.checkedAt)}</p></section></div>`;
  }
  /* ---------- 규칙·설정·공유보기 ---------- */
  function rules(rt) {
    if (rt.arg && R.countries[rt.arg]) return `<h1>${esc(R.countries[rt.arg].name)} 검역 규칙·출처</h1><p class="lead">모든 수치는 아래 출처에서만 가져왔어요. 확인일 <span class="num">${esc(R.checkedAt)}</span>.</p>${ruleCards(rt.arg)}${changed(rt.arg)}<a class="btn ghost block" href="#/rules">다른 나라 보기</a>`;
    return `<h1>나라별 규칙·출처</h1><p class="lead">규칙 카드마다 출처 링크와 확인일을 달았어요. <span class="badge check">확인 필요</span>는 공식 원문으로 확인하지 못한 항목이에요.</p>
<div class="actions">${Object.entries(R.countries).map(([k, v]) => `<a class="btn ghost" href="#/rules/${k}">${v.flag} ${esc(v.name)}</a>`).join('')}</div>
<section class="card"><h2>🇰🇷 한국 출국·귀국 공통</h2>${R.korea.rules.map(ruleCard).join('')}<h3>귀국(한국 입국)</h3>${R.korea.returnRules.map(ruleCard).join('')}</section>${changed('KR')}`;
  }
  function changed(k) { const u = 'https://github.com/347744strings-spec/webapp-daily/issues/new?title=' + encodeURIComponent('[반려동물 검역] ' + k + ' 규칙 변경 신고'); return `<section class="card"><h2>정보가 바뀌었어요</h2><p>공식 안내와 다른 점을 찾으면 알려 주세요. 링크를 누르면 GitHub 이슈 작성 화면이 열려요(개인정보는 적지 마세요).</p><a class="btn ghost block" href="${esc(u)}" target="_blank" rel="noopener">변경 신고하기</a></section>`; }
  function settingsView() {
    const c = cur();
    return `<h1>설정·데이터</h1><section class="card"><h2>내보내기·가져오기</h2><p>백업 파일(JSON)에는 이름·칩 번호·메모가 모두 들어가요.</p><div class="actions"><button class="btn" type="button" data-act="export" ${c ? '' : 'disabled'}>JSON 내보내기</button><label class="btn ghost" for="imp" style="margin:0">JSON 가져오기</label></div><input id="imp" type="file" accept="application/json,.json" class="sr-only"><p class="err" id="imp-err" hidden role="alert"></p></section>
<section class="card"><h2>전체 삭제</h2><p>이 기기에 저장된 계획·서류·설정을 모두 지워요. 되돌릴 수 없어요.</p><button class="btn warn" type="button" data-act="wipe">전체 삭제</button></section>
<section class="card"><h2>고지</h2><p><b>참고용 계산입니다. 최종 확인은 농림축산검역본부와 도착국 공식 안내</b>. 규칙 확인일 ${esc(R.checkedAt)}. 공휴일·항공사 규정(기내·수하물·견종)은 계산하지 않아요.</p><p><a href="privacy.html">개인정보 안내</a></p></section>`;
  }
  function shared(rt) {
    let s; try { s = C.decodeShare(rt.arg); } catch (e) { return `<h1>공유받은 일정(읽기 전용)</h1><div class="card empty" role="alert"><div class="ico" aria-hidden="true">🔗</div><h2>링크를 읽을 수 없어요</h2><p>주소가 잘렸거나 바뀐 것 같아요. 보낸 사람에게 링크를 다시 받아 주세요.</p><a class="btn" href="#/">홈으로</a></div>`; }
    if (!R.countries[s.trip.country]) return notfound();
    const pet = { name: s.pet.name, birth: s.pet.birth, chip: { date: s.pet.chipDate, no: '' }, rabies: s.pet.shots.map(x => ({ date: x.date, validMonths: x.years === 3 ? 36 : 12, validUntil: x.validUntil })), titer: s.pet.titers.map(x => ({ drawDate: x.draw, result: x.result })) };
    const r = compute(pet, s.trip); mem.sharedData = { pet, trip: s.trip };
    return `<h1>공유받은 일정(읽기 전용)</h1><p><span class="badge info">읽기 전용</span> ${s.pet.chipMasked ? `칩 번호 <span class="num">${esc(s.pet.chipMasked)}</span>` : '이름·칩 번호 없이 공유된 일정이에요.'}</p>
${sigCard(r, s.trip, pet, true)}<section class="card"><h2>타임라인</h2>${stepsHtml(r, pet)}</section>
<div class="actions"><button class="btn ghost" type="button" data-act="adopt">내 기기에 저장</button><a class="btn ghost" href="#/">내 계산 시작</a></div>`;
  }
  function notfound() { return `<h1>페이지를 찾을 수 없어요</h1><div class="card empty"><p>주소를 다시 확인해 주세요.</p><a class="btn" href="#/">홈으로</a></div>`; }
  function errorView() { return `<h1>규칙을 불러오지 못했어요</h1><div class="card empty" role="alert"><div class="ico" aria-hidden="true">📡</div><p>규칙 파일(data/rules.json)을 읽지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.</p><p class="small">${esc(RERR)}</p><button class="btn" type="button" data-act="retry">다시 시도</button></div>`; }
  /* ---------- 이벤트 ---------- */
  function bind(rt) {
    const hf = $('#homeform');
    if (hf) {
      const upd = () => { const v = (hf.country && [...hf.querySelectorAll('[name=country]')].find(x => x.checked) || {}).value; const c = cur(); $('#sub-wrap').innerHTML = v ? subFields(v, (c && c.trip.country === v) ? c.trip : {}) : ''; };
      hf.addEventListener('change', e => { if (e.target.name === 'country') upd(); if (e.target.name === 'nobirth') { hf.birth.disabled = e.target.checked; } });
      upd(); if (hf.nobirth.checked) hf.birth.disabled = true;
      hf.addEventListener('submit', e => { e.preventDefault(); homeSubmit(hf); });
    }
    const hs = $('#histform');
    if (hs) { hs.addEventListener('input', () => shotCheck()); hs.addEventListener('change', () => shotCheck()); shotCheck(); hs.addEventListener('submit', e => { e.preventDefault(); histSubmit(hs); }); }
    const sa = $('#s-arr'); if (sa) sa.addEventListener('input', () => whatIf());
    const sd = $('#s-draw'); if (sd) sd.addEventListener('input', () => whatIf());
    const df = $('#docform'); if (df) df.addEventListener('submit', e => { e.preventDefault(); saveDocs(df); });
    const vc = $('#v-chip'); if (vc) vc.addEventListener('input', () => { const c = cur(); $('#v-chip-msg').innerHTML = chipMsg(vc.value.trim(), c.trip); });
    const imp = $('#imp'); if (imp) imp.addEventListener('change', importJSON);
    ['opt-name', 'opt-chip'].forEach(id => { const x = $('#' + id); if (x) x.addEventListener('change', () => { mem.shareOpts = { name: $('#opt-name').checked, chip: $('#opt-chip').checked }; mem.shareUrl = ''; $('#linkout').innerHTML = ''; }); });
  }
  function homeSubmit(f) {
    const err = (id, m) => { const el = $('#' + id); el.textContent = m; el.hidden = !m; };
    const country = ([...f.querySelectorAll('[name=country]')].find(x => x.checked) || {}).value; const A = f.arrival.value; const nob = f.nobirth.checked; const B = nob ? '' : f.birth.value;
    err('form-err', ''); err('arrival-err', ''); err('birth-err', ''); f.arrival.removeAttribute('aria-invalid'); f.birth.removeAttribute('aria-invalid');
    const t = today(); let bad = false;
    if (!country) { err('form-err', '가려는 나라를 골라 주세요.'); bad = true; }
    if (!C.isDate(A)) { err('arrival-err', '희망 도착일을 넣어 주세요.'); f.arrival.setAttribute('aria-invalid', 'true'); bad = true; } else if (A < t) { err('arrival-err', '도착일은 오늘 이후여야 해요.'); f.arrival.setAttribute('aria-invalid', 'true'); bad = true; }
    if (!nob && !C.isDate(B)) { err('birth-err', '생일을 넣거나 “생일 모름”을 골라 주세요.'); f.birth.setAttribute('aria-invalid', 'true'); bad = true; } else if (B && B > t) { err('birth-err', '생일은 오늘보다 늦을 수 없어요.'); f.birth.setAttribute('aria-invalid', 'true'); bad = true; }
    if (bad) { const first = f.querySelector('[aria-invalid=true]') || f.querySelector('[name=country]'); first.focus(); return; }
    const old = cur(); const keep = old && old.trip.country === country;
    const d = old ? old.d : { pets: [], trips: [], docs: {}, settings: { lang: 'ko' } };
    const pet = Object.assign({ id: 'p1', rabies: [], titer: [], chip: { no: '', date: null } }, old ? old.pet : {}, { name: f.pname.value.trim().slice(0, 20), birth: B || null, species: f.species.value });
    const trip = Object.assign({ petId: 'p1' }, keep ? old.trip : {}, { country, arrival: A, species: f.species.value });
    if (f.sub) trip.sub = f.sub.value; if (f.airport) trip.airport = f.airport.value || null;
    if (trip.departure && trip.departure > A) trip.departure = null;
    d.pets = [pet]; d.trips = [trip]; save(d); mem.drawDate = null; mem.arrival = null; mem.shareUrl = '';
    location.hash = f.start.value === 'records' ? '#/history' : '#/verdict';
  }
  function histSubmit(f) {
    const c = cur(); const { d, pet, trip } = c; const e = $('#hist-err'); const no = f.chipno.value.trim();
    $('#chipno-err').hidden = true; e.hidden = true;
    if (no && !C.chipValid(no)) { const ce = $('#chipno-err'); ce.textContent = '칩 번호는 숫자 15자리여야 해요.'; ce.hidden = false; f.chipno.setAttribute('aria-invalid', 'true'); f.chipno.focus(); return; }
    const shots = readShots(); const t = today();
    if (shots.some(s => s.date > t) || (f.chipdate.value && f.chipdate.value > t) || (f.draw.value && f.draw.value > t)) { e.textContent = '이미 한 일만 넣어 주세요 — 오늘 이후 날짜가 있어요.'; e.hidden = false; return; }
    if (f.departure.value && f.departure.value > trip.arrival) { e.textContent = '출국일은 도착일보다 늦을 수 없어요.'; e.hidden = false; f.departure.focus(); return; }
    pet.chip = { no, date: f.chipdate.value || null }; pet.rabies = shots;
    pet.titer = f.draw.value ? [{ drawDate: f.draw.value, result: f.titer.value === '' ? null : Number(f.titer.value), lab: f.lab.value.trim().slice(0, 40) }] : [];
    trip.departure = f.departure.value || null; trip.returnDate = f.ret.value || null;
    if (f.atime) trip.arrivalTime = f.atime.value || ''; if (f.labdays) trip.labDays = Math.max(0, Math.min(60, parseInt(f.labdays.value, 10) || 0));
    if (f.sub) trip.sub = f.sub.value; if (f.airport) trip.airport = f.airport.value || null;
    save(d); mem.drawDate = null; mem.arrival = null; location.hash = '#/verdict'; toast('저장했어요');
  }
  function whatIf() {
    const c = cur(); const sa = $('#s-arr'), sd = $('#s-draw');
    const A = C.addDays(c.trip.arrival, Number(sa.value)); mem.arrival = A === c.trip.arrival ? null : A;
    let r = compute(c.pet, c.trip, { arrival: A });
    if (sd) { const D0 = r.steps.draw.earliest; const Dd = C.addDays(D0, Number(sd.value)); mem.drawDate = Dd === D0 ? null : Dd; r = compute(c.pet, c.trip, { arrival: A, drawDate: Dd }); $('#o-draw').textContent = C.fmt(Dd); sd.setAttribute('aria-valuetext', C.fmt(Dd)); }
    $('#o-arr').textContent = C.fmt(A); sa.setAttribute('aria-valuetext', C.fmt(A));
    $('#sig').innerHTML = sigCard(r, Object.assign({}, c.trip, { arrival: A }), c.pet);
  }
  function saveDocs(f) {
    const c = cur(); const { d, pet, trip } = c; d.docs = d.docs || {}; d.docs[pet.id] = d.docs[pet.id] || {}; const o = {};
    $$('[data-doc]', f).forEach(el => { o[el.dataset.doc] = { done: $('[name=done]', el).checked, expiry: $('[name=expiry]', el).value || null, memo: $('[name=memo]', el).value.trim().slice(0, 80) }; });
    d.docs[pet.id][trip.country] = o; save(d); render(); toast('서류를 저장했어요');
  }
  async function act(a, el) {
    const c = cur();
    if (a === 'onboard') { setSettings({ onboarded: true }); render(); return; }
    if (a === 'retry') { location.reload(); return; }
    if (a === 'addshot') { const n = $$('#shots .shotrow').length; if (n >= 20) return; $('#shots').insertAdjacentHTML('beforeend', shotRow({}, n)); $('#sd' + n).focus(); return; }
    if (a === 'delshot') { const row = el.closest('.shotrow'); row.remove(); $$('#shots .shotrow').forEach((r, i) => { r.dataset.i = i; ['sd', 'sy', 'su'].forEach(k => { const inp = $('[name=' + k + ']', r); const lb = $('label[for=' + inp.id + ']', r); inp.id = k + i; if (lb) lb.htmlFor = k + i; }); $('label', r).textContent = (i + 1) + '번째 주사 날짜'; $('[data-act=delshot]', r).setAttribute('aria-label', (i + 1) + '번째 주사 삭제'); }); shotCheck(); return; }
    if (a === 'resetwhatif') { mem.arrival = null; mem.drawDate = null; render(); return; }
    if (a === 'applyarr') { if (mem.arrival) { const { d } = c; d.trips[0].arrival = mem.arrival; if (d.trips[0].departure && d.trips[0].departure > mem.arrival) d.trips[0].departure = null; save(d); mem.arrival = null; render(); toast('도착일을 바꿨어요'); } else toast('도착일이 그대로예요'); return; }
    if (a === 'ics') {
      const ok = await confirmBox('.ics 파일 받기', `<p>캘린더 파일에 이런 정보가 들어가요.</p><ul><li>반려동물 이름${c.pet.name ? ' (“' + esc(c.pet.name) + '”)' : ''}과 나라·날짜별 할 일</li><li>칩 번호·메모는 <b>들어가지 않아요</b></li></ul><p class="small">파일을 다른 사람에게 보내면 위 정보가 함께 전달돼요.</p>`, '받기');
      if (!ok) return; const r = compute(c.pet, c.trip, mem);
      const evs = r.events.map(e => Object.assign({}, e, { srcUrls: (e.src || []).map(srcUrl) }));
      download('pet-quarantine-' + c.trip.country + '-' + (mem.arrival || c.trip.arrival) + '.ics', C.toICS(evs, { prefix: c.pet.name || '반려동물', calName: (c.pet.name || '반려동물') + ' ' + cname(c.trip) + '행 검역 일정', uidSeed: c.trip.country + (mem.arrival || c.trip.arrival) }), 'text/calendar;charset=utf-8');
      toast('.ics 파일을 받았어요'); return;
    }
    if (a === 'mklink') {
      const o = { name: $('#opt-name').checked, chip: $('#opt-chip').checked }; mem.shareOpts = o;
      const ok = await confirmBox('공유 링크 만들기', `<p>링크를 받은 사람은 이 정보를 볼 수 있어요.</p><ul><li>나라·도착일·생일·칩 이식일·주사·채혈 날짜</li><li>이름: <b>${o.name ? '포함' : '빠짐'}</b></li><li>칩 번호: <b>${o.chip ? '포함(뒤 6자리 가림)' : '빠짐'}</b></li><li>메모·서류 정보: 빠짐</li></ul>`, '만들기');
      if (!ok) return; const p = C.encodeShare({ pet: calcPet(c.pet), trip: c.trip }, { includeName: o.name, includeChip: o.chip });
      mem.shareUrl = location.href.split('#')[0] + '#/s/' + p; $('#linkout').innerHTML = linkBox(mem.shareUrl); $('#share-url').select(); toast('링크를 만들었어요'); return;
    }
    if (a === 'copylink') { try { await navigator.clipboard.writeText(mem.shareUrl); toast('링크를 복사했어요'); } catch (e) { $('#share-url').select(); toast('길게 눌러 복사해 주세요'); } return; }
    if (a === 'sharelink') { try { await navigator.share({ title: APP, url: mem.shareUrl }); } catch (e) { } return; }
    if (a === 'img') { const ok = await confirmBox('이미지 저장', `<p>이미지에 반려동물 이름${c.pet.name ? '(“' + esc(c.pet.name) + '”)' : ''}, 도시, 남은 날짜가 들어가요. 칩 번호는 들어가지 않아요.</p>`, '저장'); if (ok) imageCard(c); return; }
    if (a === 'savechip') { const v = $('#v-chip').value.trim(); if (v && !C.chipValid(v)) { $('#v-chip').setAttribute('aria-invalid', 'true'); $('#v-chip').focus(); toast('숫자 15자리를 확인해 주세요'); return; } const { d } = c; d.pets[0].chip = Object.assign({}, d.pets[0].chip, { no: v }); save(d); render(); toast('칩 번호를 저장했어요'); return; }
    if (a === 'export') { const ok = await confirmBox('JSON 내보내기', '<p>백업 파일에 <b>이름·칩 번호·메모</b>가 모두 들어가요. 안전한 곳에만 보관하세요.</p>', '내보내기'); if (ok) download('petgo-backup-' + today() + '.json', JSON.stringify(load(), null, 1), 'application/json'); return; }
    if (a === 'wipe') { const ok = await confirmBox('전체 삭제', '<p>이 기기에 저장된 계획·서류·설정을 모두 지울까요? 되돌릴 수 없어요.</p>', '모두 삭제'); if (ok) { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); mem.shareUrl = ''; toast('모두 지웠어요'); location.hash = '#/'; render(); } return; }
    if (a === 'adopt') { const ok = await confirmBox('내 기기에 저장', '<p>공유받은 일정을 이 기기에 저장해요. 지금 저장된 계획이 있으면 바뀌어요.</p>', '저장'); if (!ok) return; const s = mem.sharedData; save({ pets: [Object.assign({ id: 'p1', species: s.trip.species }, s.pet)], trips: [Object.assign({ petId: 'p1' }, s.trip)], docs: {}, settings: { lang: 'ko' } }); location.hash = '#/verdict'; toast('저장했어요'); }
  }
  function importJSON(e) {
    const f = e.target.files[0]; const er = $('#imp-err'); er.hidden = true; if (!f) return;
    const rd = new FileReader(); rd.onload = async () => {
      try {
        const d = JSON.parse(rd.result); if (!d || !Array.isArray(d.pets) || !Array.isArray(d.trips) || !d.pets[0] || !d.trips[0] || !R.countries[d.trips[0].country] || !C.isDate(d.trips[0].arrival)) throw new Error('형식');
        const ok = await confirmBox('가져오기', '<p>지금 저장된 계획을 이 파일 내용으로 바꿀까요?</p>', '가져오기'); if (!ok) return;
        save({ pets: [d.pets[0]], trips: [d.trips[0]], docs: d.docs || {}, settings: d.settings || {} }); toast('가져왔어요'); location.hash = '#/verdict';
      } catch (x) { er.textContent = '이 파일은 읽을 수 없어요 — 이 앱에서 내보낸 JSON인지 확인해 주세요.'; er.hidden = false; }
    }; rd.readAsText(f);
  }
  function imageCard(c) {
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1080; const g = cv.getContext('2d'); const r = compute(c.pet, c.trip);
    const dd = C.diff(c.trip.arrival, today()); g.fillStyle = '#FFFBF5'; g.fillRect(0, 0, 1080, 1080); g.fillStyle = '#0F766E'; g.fillRect(0, 0, 1080, 220);
    g.fillStyle = '#fff'; g.font = 'bold 64px system-ui, sans-serif'; g.fillText('데려갈 수 있을까', 70, 140);
    g.fillStyle = '#1F2937'; g.font = 'bold 92px system-ui, sans-serif'; g.fillText((c.pet.name || '우리 아이') + ' ' + R.countries[c.trip.country].city + '행', 70, 420);
    g.font = 'bold 220px system-ui, sans-serif'; g.fillStyle = '#0F766E'; g.fillText('D-' + Math.max(0, dd), 70, 680);
    g.font = '48px system-ui, sans-serif'; g.fillStyle = '#1F2937'; g.fillText(C.fmt(c.trip.arrival) + ' 도착 · ' + r.verdict.label, 70, 800);
    g.font = '34px system-ui, sans-serif'; g.fillStyle = '#5B6472'; g.fillText('참고용 계산 · 최종 확인은 검역본부·도착국 공식 안내', 70, 980);
    cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pet-dday.png'; a.textContent = '이미지 받기'; a.hidden = true; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('이미지를 저장했어요'); });
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) { e.preventDefault(); act(b.dataset.act, b); } });
  addEventListener('hashchange', () => { if (!/^#\/(verdict|timeline)/.test(location.hash)) { mem.arrival = null; mem.drawDate = null; } render(); });
  fetch('data/rules.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => { R = j; render(); }).catch(err => { RERR = String(err.message || err); render(); });
  window.__pq = { compute: (p, t, o) => compute(p, t, o), calcPet, rules: () => R, pageTitle };
})();
