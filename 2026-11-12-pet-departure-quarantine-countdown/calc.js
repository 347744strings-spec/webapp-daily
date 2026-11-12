/* 데려갈 수 있을까 — 계산 모듈 (UMD: window.PetCalc / require)
   모든 날짜는 Asia/Seoul 자정 기준 'YYYY-MM-DD' 문자열, 차이는 정수 일수. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.PetCalc = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000;
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  function toN(iso) {
    if (typeof iso !== 'string' || !RE.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number); const t = Date.UTC(y, m - 1, d); const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return Math.round(t / DAY);
  }
  const isDate = s => toN(s) !== null;
  const toISO = n => new Date(n * DAY).toISOString().slice(0, 10);
  const addDays = (iso, k) => toISO(toN(iso) + k);
  const diff = (a, b) => toN(a) - toN(b); // a − b (일)
  const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  /* 달력 개월 더하기. 같은 날짜가 없는 달(예: 8/31 + 6개월)은 다음 달 1일로 — 늦은 쪽(보수적)으로 계산 */
  function addMonths(iso, k) {
    let [y, m, d] = iso.split('-').map(Number); m = m - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    if (d > dim(y, m)) { m += 1; if (m > 11) { m = 0; y++; } d = 1; }
    return toISO(Math.round(Date.UTC(y, m, d) / DAY));
  }
  const max = (...a) => a.filter(Boolean).sort().pop();
  const min = (...a) => a.filter(Boolean).sort()[0];
  function todayKST(now) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now == null ? Date.now() : now));
    const g = t => p.find(x => x.type === t).value; return g('year') + '-' + g('month') + '-' + g('day');
  }
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function fmt(iso, opt) {
    if (!isDate(iso)) return '—'; const [y, m, d] = iso.split('-').map(Number); const w = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return (opt === 'short' ? '' : y + '. ') + m + '. ' + d + '.' + (opt === 'now' ? '' : ' (' + w + ')');
  }
  const weekday = iso => new Date(toN(iso) * DAY).getUTCDay();

  /* 주사 유효기간 끝(이날까지 다음 주사를 맞아야 이어짐). 증명서의 종료일을 입력하면 그 값을 우선 */
  function validUntil(s) { return isDate(s.validUntil) ? s.validUntil : addDays(addMonths(s.date, 12 * (s.years === 3 ? 3 : 1)), -1); }

  /* 인정/불인정 판별: 칩보다 먼저 = 불인정, 최소 일령 전 = 불인정 */
  function validVaccines(chipDate, list, birth, minAgeDays) {
    const minAge = isDate(birth) && minAgeDays ? addDays(birth, minAgeDays) : null;
    return (list || []).filter(s => s && isDate(s.date)).map(s => ({ date: s.date, years: s.years === 3 ? 3 : 1, validUntil: isDate(s.validUntil) ? s.validUntil : null }))
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).map(s => {
        const o = Object.assign({}, s, { until: validUntil(s) });
        if (!isDate(chipDate)) { o.status = 'noChip'; o.reason = '칩 날짜가 없어 인정 여부를 판단할 수 없어요'; }
        else if (s.date < chipDate) { o.status = 'beforeChip'; o.reason = '칩보다 먼저 맞은 주사 — 불인정'; }
        else if (minAge && s.date < minAge) { o.status = 'tooYoung'; o.reason = minAgeDays + '일령 전 주사 — 불인정'; }
        else { o.status = 'ok'; o.reason = '인정'; }
        return o;
      });
  }
  /* 유효기간 연결: 다음 주사가 이전 유효기간 끝 이후면 끊김(새 1차) */
  function chain(ok) {
    const segs = []; let cur = null;
    ok.forEach((s, i) => {
      if (!cur || s.date > ok[i - 1].until) { if (cur) s.link = 'broken'; else s.link = 'first'; cur = [s]; segs.push(cur); }
      else { s.link = 'continued'; cur.push(s); }
    });
    return segs;
  }
  function isContinuous(list) {
    const ok = list.filter(s => s.status === undefined || s.status === 'ok').map(s => Object.assign({}, s, { until: s.until || validUntil(s) }));
    const segs = chain(ok); return { continuous: segs.length <= 1, breaks: ok.filter(s => s.link === 'broken').map(s => s.date), segments: segs.length };
  }
  function level(slack) { return slack >= 14 ? 'green' : slack >= 0 ? 'yellow' : 'red'; }
  const LV = { green: '가능', yellow: '빠듯', red: '불가', info: '안내' };
  const examOK = (departure, day) => isDate(departure) && isDate(day) && day >= addDays(departure, -10) && day <= departure;
  const noticeOK = (arrival, today) => diff(arrival, today) >= 40;

  /* 공통 준비: 주사 분류·연결·현재 살아 있는 연결 */
  function prep(pet, P, today) {
    const shots = validVaccines(pet.chipDate, pet.shots, pet.birth, P.minAgeDays);
    const ok = shots.filter(s => s.status === 'ok'); const segs = chain(ok);
    const last = segs.length ? segs[segs.length - 1] : null;
    const alive = !!(last && today <= last[last.length - 1].until);
    const minAgeDate = isDate(pet.birth) ? addDays(pet.birth, P.minAgeDays || 0) : null;
    const brokenDead = segs.length > 0 && !alive;
    return { shots, ok, segs, last: alive ? last : null, alive, minAgeDate, brokenDead, hasBreak: ok.some(s => s.link === 'broken') };
  }
  function freshStart(pet, pp, today) {
    const s1 = max(today, pp.minAgeDate, isDate(pet.chipDate) && pet.chipDate > today ? pet.chipDate : null);
    return { s1, chipPlanned: !isDate(pet.chipDate) };
  }
  function pickTiter(pet, from, extraOK) {
    const t = (pet.titers || []).filter(x => x && isDate(x.draw)).sort((a, b) => a.draw < b.draw ? -1 : 1);
    const valid = t.filter(x => from && x.draw >= from && (!extraOK || extraOK(x)));
    const bad = t.filter(x => !valid.includes(x));
    const pass = valid.find(x => x.result === null || x.result === undefined || x.result === '' || Number(x.result) >= 0.5);
    const low = valid.filter(x => x.result !== null && x.result !== undefined && x.result !== '' && Number(x.result) < 0.5);
    return { pass: pass ? Object.assign({}, pass, { pending: pass.result === null || pass.result === undefined || pass.result === '' }) : null, low, bad };
  }
  function ev(date, title, o) { return Object.assign({ date, title, place: '', kind: 'step', src: [], alarm: '-P1D' }, o || {}); }
  function koreaEvents(R, departure, today, events) {
    const k = R.korea.rules; const cert = k.find(r => r.id === 'exportCertDays').value;
    const start = addDays(departure, -cert); const book = addDays(start, -1);
    if (book >= today) events.push(ev(book, '검역본부 방문 예약 (증명서 창구 첫날에 가려면 이날까지)', { place: '온라인 · 수출반려동물 검역예약시스템', kind: 'book', src: ['qia_list'], note: '최소 1일 전 예약, 당일 예약 불가 사무실 있음 · 평일만 운영' }));
    events.push(ev(start, '출국 검역증명서 창구 시작 (출국 전 10일 이내)', { end: departure, place: '검역본부 사무실 · 반려동물 동반', kind: 'window', src: ['easylaw', 'korea_brief'], note: '수수료 1만원' }));
  }

  function plan(R, pet, trip, today, opt) {
    opt = opt || {}; const C = R.countries[trip.country]; if (!C) throw new Error('unknown country');
    const P = C.params; const A = trip.arrival; const D = isDate(trip.departure) && trip.departure <= A ? trip.departure : A;
    const out = { country: trip.country, name: C.name, species: trip.species, arrival: A, departure: D, events: [], warnings: [], steps: {}, path: '', src: [] };
    const sp = trip.species === 'cat' ? 'cat' : 'dog';
    if (!isDate(A)) throw new Error('arrival required');
    if (trip.country === 'US' && sp === 'cat') {
      out.path = 'info'; out.earliest = null; out.verdict = { level: 'info', label: LV.info, slack: null, headline: '미국 고양이는 CDC 개 규정 대상이 아니에요', reasons: ['도착 주(州)와 항공사 규정을 확인하세요. 출국 검역(한국)은 똑같이 필요해요.'] };
      koreaEvents(R, D, today, out.events); out.events.push(ev(A, '미국 도착', { kind: 'arrive', alarm: '-P1D' })); out.shots = validVaccines(pet.chipDate, pet.shots, pet.birth, 0); return finish(out);
    }
    const pp = prep(pet, P, today); out.shots = pp.shots; out.hasBreak = pp.hasBreak; out.brokenDead = pp.brokenDead;
    if (!isDate(pet.chipDate)) out.warnings.push({ level: 'warn', text: '마이크로칩 날짜가 없어요. 칩을 먼저(또는 1차 주사와 같은 날) 심어야 그 뒤 주사가 인정돼요.', src: ['jp_aqs', 'eu_pets'] });
    if (!isDate(pet.birth)) out.warnings.push({ level: 'warn', text: '생일이 없어 최소 일령 조건을 확인하지 못했어요. 성견·성묘라고 가정했어요.', src: [] });
    if (pp.shots.some(s => s.status === 'beforeChip')) out.warnings.push({ level: 'warn', text: '칩보다 먼저 맞은 주사는 계산에서 뺐어요.' + (trip.country === 'JP' ? ' 일본은 조건부 수용 예외가 있으니 검역소와 상담하세요.' : ''), src: trip.country === 'JP' ? ['jp_aqs', 'jp_seido'] : ['eu_pets'] });
    if (pp.hasBreak || pp.brokenDead) out.warnings.push({ level: 'bad', text: '유효기간이 지난 뒤 맞은 주사가 있어요(끊김). 끊긴 뒤 주사부터 다시 1차로 계산해요.', src: trip.country === 'JP' ? ['jp_aqs'] : ['eu_pets'] });
    const f = { JP: planJP, EU: planEU, GB: planGB, US: planUS, AU: planAU }[trip.country];
    f(R, C, P, pet, trip, today, pp, out, opt, A, D, sp);
    if (out.earliest) {
      out.slack = diff(A, out.earliest); const lv = out.forceRed ? 'red' : level(out.slack);
      out.verdict = Object.assign({ level: lv, label: LV[lv], slack: out.slack }, out.verdict || {});
      if (!out.verdict.headline) out.verdict.headline = lv === 'red' ? '이 날짜엔 어려워요' : lv === 'yellow' ? '가능하지만 빠듯해요' : '같이 갈 수 있어요';
    }
    if (isDate(trip.returnDate)) returnPlan(R, pet, trip, out, today);
    return finish(out);
  }
  function finish(out) { out.events.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); return out; }

  function planJP(R, C, P, pet, trip, today, pp, out, opt, A, D, sp) {
    let v1 = null, v2 = null, drawFrom = null;
    if (pp.last) {
      const s = pp.last; let pair = null;
      for (let j = 1; j < s.length && !pair; j++) for (let i = 0; i < j; i++) if (diff(s[j].date, s[i].date) >= P.vax2MinDays && s[j].date <= s[i].until) { pair = [s[i], s[j]]; break; }
      if (pair) { v1 = { date: pair[0].date, done: true }; v2 = { date: pair[1].date, done: true }; out.path = 'readyDraw'; }
      else {
        const a = s[s.length - 1]; const s2 = max(today, addDays(a.date, P.vax2MinDays));
        if (s2 <= a.until) { v1 = { date: a.date, done: true }; v2 = { date: s2, done: false, until: a.until }; out.path = 'needVax2'; }
      }
    }
    let chipPlanned = false;
    if (!v1) { const fs = freshStart(pet, pp, today); chipPlanned = fs.chipPlanned; v1 = { date: fs.s1, done: false }; v2 = { date: addDays(fs.s1, P.vax2MinDays), done: false }; out.path = 'fresh'; }
    drawFrom = v2.done ? v2.date : null;
    const tt = pickTiter(pet, drawFrom); let draw, titer = null;
    if (tt.pass) { titer = tt.pass; draw = { date: titer.draw, done: true, pending: titer.pending }; out.path = titer.pending ? 'titerPending' : 'titerDone'; }
    else {
      const from = max(today, v2.date); let d = from;
      if (opt.drawDate && isDate(opt.drawDate) && opt.drawDate >= from) d = opt.drawDate;
      draw = { date: d, done: false, earliest: from };
      if (tt.low.length) out.warnings.push({ level: 'bad', text: '항체가 0.5IU/ml 미만 결과가 있어요 — 재검사가 필요해요(수의사와 상담).', src: ['jp_aqs'] });
    }
    if (tt.bad.length && !tt.pass) out.warnings.push({ level: 'warn', text: '2차 주사(인정) 전에 뽑은 채혈은 인정되지 않아 계산에서 뺐어요.', src: ['jp_aqs'] });
    out.steps = { chip: { date: chipPlanned ? v1.date : pet.chipDate, done: !chipPlanned }, vax1: v1, vax2: v2, draw };
    const waitEnd = addDays(draw.date, P.waitDays);
    const noticeFloor = addDays(today, P.noticeDaysBefore);
    out.earliest = max(waitEnd, noticeFloor);
    out.waitEnd = waitEnd; out.noticeDeadline = addDays(A, -P.noticeDaysBefore);
    const dA = diff(A, draw.date); const resultDate = addDays(draw.date, 14);
    out.verdict = { reasons: [] };
    if (!noticeOK(A, today)) { out.forceRed = true; out.verdict.reasons.push('사전신고 마감(도착 40일 전, ' + fmt(out.noticeDeadline) + ')이 이미 지났어요 — 원칙상 늦은 신고는 수리되지 않아요.'); }
    if (dA < 0 || (!draw.done && A < resultDate)) { out.quarantineDays = null; if (dA < P.waitDays) out.verdict.reasons.push('도착일이 채혈·결과보다 빨라요 — 조건 미충족이면 최장 180일 계류 또는 수입 불가예요.'); }
    else if (dA < P.waitDays) { out.quarantineDays = P.waitDays - dA; out.verdict.reasons.push('채혈일부터 180일이 안 돼요 — 모자란 ' + out.quarantineDays + '일만큼 도착 후 동물검역소 계류(비용 보호자 부담).'); }
    else out.quarantineDays = 0;
    out.verdict.basis = '채혈일부터 180일 대기 필요(일본 동물검역소)';
    // 접종 유효 유지
    const lastShot = pp.last ? pp.last[pp.last.length - 1] : null; let until = null;
    if (v2.done && lastShot) until = lastShot.until; else until = addDays(addMonths(v2.date, 12), -1);
    if (until < A) out.events.push(ev(until, '광견병 추가 접종 마감 (이날까지 맞아야 연결 유지)', { place: '동물병원', kind: 'booster', src: ['jp_aqs'], note: v2.done ? '' : '1년 유효 백신 가정' }));
    if (titer && !titer.pending) { const exp = addDays(addMonths(titer.draw, 24), -1); out.titerExpiry = exp; if (exp < A) out.warnings.push({ level: 'warn', text: '도착 전에 항체검사 유효기간(2년)이 끝나요 — 도착 전 2차 항체검사가 필요해요. 접종이 끊김 없이 이어졌다면 다시 180일을 기다리지 않아도 돼요.', src: ['jp_aqs', 'jp_seido'] }); }
    if (sp === 'dog' && trip.airport) { const ok = C.dogAirports.some(a => a[0] === trip.airport); if (!ok) out.warnings.push({ level: 'bad', text: '이 공항으로는 개가 입국할 수 없어요. 개는 지정 공항 11곳만 가능해요.', src: ['jp_aqs'] }); }
    if (sp === 'dog' && !trip.airport) out.warnings.push({ level: 'info', text: '개는 지정 공항 11곳으로만 들어갈 수 있어요. 도착 공항을 골라 주세요.', src: ['jp_aqs'] });
    if (/^900202/.test(pet.chipNo || '')) out.warnings.push({ level: 'bad', text: '앞 6자리가 900202인 칩은 일본에서 당분간 인정되지 않아요.', src: ['jp_aqs'] });
    // 이벤트
    const E = out.events;
    if (chipPlanned) E.push(ev(v1.date, '마이크로칩 이식 (1차 주사와 같은 날 가능)', { place: '동물병원', kind: 'todo', src: ['jp_aqs'] }));
    if (!v1.done) E.push(ev(v1.date, '광견병 1차 주사 가능일' + (pp.minAgeDate && v1.date === pp.minAgeDate ? ' (91일령)' : ''), { place: '동물병원', kind: 'todo', src: ['jp_aqs', 'jp_guide_ko'], note: '91일령 이후, 칩 이후(같은 날 가능)' }));
    if (!v2.done) E.push(ev(v2.date, '광견병 2차 주사 가능일 (1차 + 30일 이후)', { place: '동물병원', kind: 'todo', src: ['jp_aqs'], note: '1차 유효기간 안에' }));
    if (!draw.done) E.push(ev(draw.date, '항체검사 채혈 (2차 주사와 같은 날 가능)', { place: '동물병원 → 검역본부 서울지역본부 전염병검사과', kind: 'todo', src: ['jp_aqs', 'mafra_lab'], note: '수수료 11만원, 결과 약 2주' }));
    if (!draw.done || draw.pending) E.push(ev(resultDate, '항체검사 결과 확인 예정 (약 2주)', { place: '동물병원', kind: 'check', src: ['mafra_lab'] }));
    E.push(ev(waitEnd, '180일 대기 끝 — 이날부터 도착하면 계류 없음', { kind: 'milestone', src: ['jp_aqs'] }));
    E.push(ev(out.noticeDeadline, '일본 사전신고 마감 (도착 40일 전)', { place: '온라인 · NACCS 또는 이메일', kind: 'deadline', src: ['jp_aqs'], alarm: '-P7D' }));
    E.push(ev(addDays(D, -P.exportExamDays), '출국 전 임상검사·Form AC 창구 (출국 전 10일 이내)', { end: D, place: '동물병원 → 검역본부(배서)', kind: 'window', src: ['jp_aqs'] }));
    koreaEvents(R, D, today, E);
    E.push(ev(A, '일본 도착' + (trip.airport ? ' · ' + trip.airport : ''), { kind: 'arrive' }));
    if (titer && out.titerExpiry) E.push(ev(out.titerExpiry, '항체검사 결과 유효기간 끝 (채혈일부터 2년)', { kind: 'expiry', src: ['jp_aqs'], alarm: '-P30D' }));
    out.src = ['jp_aqs', 'jp_guide_ko'];
  }
  function vaxBase(P, pet, today, pp, out) {
    if (pp.last) return { vax: { date: pp.last[0].date, done: true }, lastShot: pp.last[pp.last.length - 1], chipPlanned: false };
    const fs = freshStart(pet, pp, today); out.path = 'fresh';
    return { vax: { date: fs.s1, done: false }, lastShot: null, chipPlanned: fs.chipPlanned };
  }
  function titerFlow(pet, from, today, opt, out, srcs) {
    const tt = pickTiter(pet, from);
    if (tt.pass) { out.path = tt.pass.pending ? 'titerPending' : 'titerDone'; return { date: tt.pass.draw, done: true, pending: tt.pass.pending, titer: tt.pass }; }
    if (tt.low.length) out.warnings.push({ level: 'bad', text: '항체가 0.5IU/ml 미만 결과가 있어요 — 재접종·재검사가 필요해요.', src: srcs });
    if (tt.bad.length) out.warnings.push({ level: 'warn', text: '조건(접종 후 최소 기간) 전에 뽑은 채혈은 계산에서 뺐어요.', src: srcs });
    const e = max(today, from); let d = e; if (opt.drawDate && isDate(opt.drawDate) && opt.drawDate >= e) d = opt.drawDate;
    if (!out.path) out.path = 'readyDraw';
    return { date: d, done: false, earliest: e };
  }
  function boosterEvent(lastShot, vax, A, out, src) {
    const until = lastShot ? lastShot.until : addDays(addMonths(vax.date, 12), -1);
    if (until < A) out.events.push(ev(until, '광견병 추가 접종 마감 (이날까지 맞아야 연결 유지)', { place: '동물병원', kind: 'booster', src: [src], note: lastShot ? '' : '1년 유효 백신 가정' }));
  }
  function planEU(R, C, P, pet, trip, today, pp, out, opt, A, D, sp) {
    const b = vaxBase(P, pet, today, pp, out); const drawFrom = addDays(b.vax.date, P.drawAfterVaxDays);
    const draw = titerFlow(pet, b.vax.done ? drawFrom : null, today, opt, out, ['eu_pets']);
    if (!b.vax.done) { draw.date = max(draw.date, drawFrom); draw.earliest = max(draw.earliest, drawFrom); if (opt.drawDate && opt.drawDate >= draw.earliest) draw.date = opt.drawDate; }
    out.steps = { chip: { date: b.chipPlanned ? b.vax.date : pet.chipDate, done: !b.chipPlanned }, vax1: b.vax, draw };
    const certFrom = addDays(draw.date, P.certAfterDrawDays);
    out.earliest = max(certFrom, addDays(b.vax.date, P.validityStartDays), today);
    const sub = (C.subs || []).find(s => s[0] === trip.sub); const E = out.events;
    out.verdict = { reasons: [], basis: '채혈일부터 90일 지나야 건강증명서 발급(EU 집행위원회)' };
    if (A < certFrom) out.verdict.reasons.push('채혈 후 90일 전에는 건강증명서를 발급할 수 없어요 — 가장 빠른 도착은 ' + fmt(out.earliest) + '예요.');
    if (b.chipPlanned) E.push(ev(b.vax.date, '마이크로칩 이식 (접종과 같은 날 가능)', { place: '동물병원', kind: 'todo', src: ['eu_pets'] }));
    if (!b.vax.done) E.push(ev(b.vax.date, '광견병 접종 가능일 (12주령 이상)', { place: '동물병원', kind: 'todo', src: ['eu_pets'] }));
    if (!draw.done) E.push(ev(draw.date, '항체검사 채혈 (접종 후 30일 이후)', { place: '동물병원 → EU 지정 실험실', kind: 'todo', src: ['eu_pets'] }));
    const issueFrom = max(certFrom, addDays(A, -P.certValidDays));
    E.push(ev(issueFrom, 'EU 건강증명서 발급 창 (채혈 + 90일 이후 · 도착 10일 이내)', { end: A, place: '수의사 → 검역본부 배서', kind: 'window', src: ['eu_pets'] }));
    if (sp === 'dog' && sub && sub[2]) E.push(ev(addDays(A, -5), sub[1] + '행 개 촌충 구제 창 (입국 120~24시간 전)', { end: addDays(A, -1), place: '동물병원', kind: 'window', src: ['eu_pets'], note: '정확한 시각은 입국 시각 기준' }));
    boosterEvent(b.lastShot, b.vax, A, out, 'eu_pets');
    koreaEvents(R, D, today, E); E.push(ev(A, (sub ? sub[1] : 'EU') + ' 도착', { kind: 'arrive' }));
    out.warnings.push({ level: 'check', text: '한국이 EU 항체검사 면제국이 아니라고 보고 계산했어요(면제국 목록 원문 확인 필요).', src: ['eu_636'] });
    out.src = ['eu_pets'];
  }
  function planGB(R, C, P, pet, trip, today, pp, out, opt, A, D, sp) {
    const b = vaxBase(P, pet, today, pp, out); const drawFrom = addDays(b.vax.date, P.drawAfterVaxDays);
    const draw = titerFlow(pet, b.vax.done ? drawFrom : null, today, opt, out, ['gb_blood']);
    if (!b.vax.done) { draw.date = max(draw.date, drawFrom); draw.earliest = max(draw.earliest, drawFrom); if (opt.drawDate && opt.drawDate >= draw.earliest) draw.date = opt.drawDate; }
    out.steps = { chip: { date: b.chipPlanned ? b.vax.date : pet.chipDate, done: !b.chipPlanned }, vax1: b.vax, draw };
    const wait = addMonths(draw.date, P.waitMonths);
    out.earliest = max(wait, addDays(b.vax.date, P.travelAfterVaxDays), today);
    out.verdict = { reasons: [], basis: '채혈일부터 3개월(달력) 대기(GOV.UK)' };
    if (A < wait) out.verdict.reasons.push('채혈일부터 3개월이 안 돼요 — 가장 빠른 도착은 ' + fmt(out.earliest) + '예요. 규칙을 못 지키면 최대 4개월 격리될 수 있어요.');
    const E = out.events;
    if (b.chipPlanned) E.push(ev(b.vax.date, '마이크로칩 이식 (접종 전 또는 같은 때)', { place: '동물병원', kind: 'todo', src: ['gb_vax'] }));
    if (!b.vax.done) E.push(ev(b.vax.date, '광견병 접종 가능일 (12주령 이상)', { place: '동물병원', kind: 'todo', src: ['gb_vax'] }));
    if (!draw.done) E.push(ev(draw.date, '혈액검사 채혈 (접종 후 30일 이후)', { place: '동물병원 → EU 승인 실험실', kind: 'todo', src: ['gb_blood'] }));
    E.push(ev(wait, '3개월 대기 끝 — 이날부터 영국 입국 가능', { kind: 'milestone', src: ['gb_blood'] }));
    E.push(ev(addDays(A, -P.certValidDays), 'GB 건강증명서 발급 창 (발급 후 10일 안 입국)', { end: A, place: '공식 수의사 → 검역본부', kind: 'window', src: ['gb_cert'] }));
    if (sp === 'dog') { const tw = tapeworm(A, trip.arrivalTime); out.tapeworm = tw; E.push(ev(addDays(A, -5), '촌충 구제 창 (도착 120~24시간 전)', { end: addDays(A, -1), place: '동물병원', kind: 'window', src: ['gb_main'], note: tw.text })); }
    boosterEvent(b.lastShot, b.vax, A, out, 'gb_vax');
    koreaEvents(R, D, today, E); E.push(ev(A, '영국 도착', { kind: 'arrive' }));
    out.src = ['gb_vax', 'gb_blood'];
  }
  /* 촌충 구제 시간 창: 도착 시각이 있으면 정확히(도착 −120h ~ −24h) */
  function tapeworm(A, time) {
    if (!/^\d{2}:\d{2}$/.test(time || '')) return { from: null, to: null, text: '도착 시각을 넣으면 정확한 시간 창을 계산해요 (도착 120시간 전 ~ 24시간 전).' };
    const from = addDays(A, -5) + ' ' + time; const to = addDays(A, -1) + ' ' + time;
    return { from, to, text: fmt(addDays(A, -5)) + ' ' + time + ' ~ ' + fmt(addDays(A, -1)) + ' ' + time + ' 사이 투약' };
  }
  function planUS(R, C, P, pet, trip, today, pp, out, opt, A, D, sp) {
    const ageOK = isDate(pet.birth) ? addMonths(pet.birth, P.minAgeMonths) : null;
    out.earliest = max(today, ageOK); out.path = 'us'; out.ageDate = ageOK;
    out.verdict = { reasons: [], basis: '입국 시 6개월령 이상(CDC)' };
    if (ageOK && A < ageOK) { out.forceRed = true; out.verdict.reasons.push('도착일에 6개월령이 안 돼요 — ' + fmt(ageOK) + '부터 입국 가능해요.'); }
    const E = out.events;
    if (!isDate(pet.chipDate)) E.push(ev(today, '마이크로칩 이식 (범용 스캐너로 읽히는 칩)', { place: '동물병원', kind: 'todo', src: ['cdc_low'] }));
    const cdcFrom = max(today, addDays(addMonths(A, -P.cdcReceiptMonths), 1));
    E.push(ev(cdcFrom, 'CDC Dog Import Form 작성 가능 (영수증 6개월 유효, 당일 작성도 가능)', { end: A, place: '온라인 · 무료', kind: 'window', src: ['cdc_low'] }));
    if (ageOK && ageOK > today) E.push(ev(ageOK, '6개월령 되는 날 — 이날부터 미국 입국 가능', { kind: 'milestone', src: ['cdc_low'] }));
    koreaEvents(R, D, today, E); E.push(ev(A, '미국 도착', { kind: 'arrive' }));
    out.warnings.push({ level: 'info', text: '최근 6개월 안에 CDC 고위험국에 머문 적이 있으면 다른(더 엄격한) 규정이 적용돼요.', src: ['cdc_high'] });
    out.src = ['cdc_low', 'cdc_high'];
  }
  function planAU(R, C, P, pet, trip, today, pp, out, opt, A, D, sp) {
    const b = vaxBase(P, pet, today, pp, out);
    const from = b.lastShot ? addDays(b.lastShot.date, P.drawAfterVaxDays) : addDays(b.vax.date, P.drawAfterVaxDays);
    const draw = titerFlow(pet, b.vax.done ? from : null, today, opt, out, ['au_g3']);
    if (!b.vax.done) { draw.date = max(draw.date, from); draw.earliest = max(draw.earliest, from); if (opt.drawDate && opt.drawDate >= draw.earliest) draw.date = opt.drawDate; }
    const lab = Math.max(0, Math.min(60, parseInt(trip.labDays, 10) || 0));
    const labArr = addDays(draw.date, lab); const exportFrom = addDays(labArr, P.residencyDays);
    out.steps = { chip: { date: b.chipPlanned ? b.vax.date : pet.chipDate, done: !b.chipPlanned }, vax1: b.vax, draw };
    out.earliest = max(exportFrom, today); out.complex = true;
    const rnattEnd = addDays(addMonths(draw.date, P.rnattValidMonths), -1);
    out.verdict = { reasons: [], basis: 'RNATT 시료 실험실 도착일부터 180일(호주 농림부) · 개요' };
    if (A < exportFrom) out.verdict.reasons.push('RNATT 시료가 실험실에 도착한 날부터 180일이 안 돼요(예외 없음) — 가장 빠른 출발은 ' + fmt(out.earliest) + '예요.');
    if (A > rnattEnd) { out.warnings.push({ level: 'bad', text: 'RNATT 유효기간(12개월, ' + fmt(rnattEnd) + ')을 넘겨요 — 재검사 후 다시 180일이 필요해요.', src: ['au_g3'] }); out.forceRed = true; out.verdict.reasons.push('RNATT 12개월 유효기간 뒤 도착이에요.'); }
    const E = out.events;
    if (!b.vax.done || b.chipPlanned) E.push(ev(today, '정부 수의사 신원확인 (선택 · 다른 준비보다 먼저, 채혈과 다른 날)', { place: '검역본부', kind: 'todo', src: ['au_g3'], note: '받으면 도착 후 계류 최소 10일(아니면 30일)' }));
    if (b.chipPlanned) E.push(ev(b.vax.date, '마이크로칩 확인·이식', { place: '동물병원', kind: 'todo', src: ['au_g3'] }));
    if (!b.vax.done) E.push(ev(b.vax.date, '광견병 접종 가능일 (84일령 이상)', { place: '동물병원', kind: 'todo', src: ['au_g3'] }));
    if (!draw.done) E.push(ev(draw.date, 'RNATT 채혈 (접종 후 3~4주)', { place: '동물병원 → 인정 실험실', kind: 'todo', src: ['au_g3'] }));
    E.push(ev(labArr, '수입허가 신청 (RNATT 신고서 후 · 보통 20~40영업일, 최대 123영업일)', { place: '온라인 · BICON', kind: 'todo', src: ['au_g3'] }));
    E.push(ev(exportFrom, '180일 거주 끝 — 이날부터 수출 가능', { kind: 'milestone', src: ['au_g3'] }));
    koreaEvents(R, D, today, E);
    E.push(ev(A, '멜버른 도착 → Mickleham 계류(최소 10일 또는 30일)', { kind: 'arrive', src: ['au_g3'] }));
    E.push(ev(addDays(A, 10), '계류 10일 끝 (신원확인을 받은 경우 최소)', { kind: 'milestone', src: ['au_g3'], alarm: '-P1D' }));
    E.push(ev(addDays(A, 30), '계류 30일 끝 (신원확인 없을 때 최소)', { kind: 'milestone', src: ['au_g3'], alarm: '-P1D' }));
    if (sp === 'cat') out.warnings.push({ level: 'check', text: '호주 일정은 개 안내서 기준이에요. 고양이는 DAFF 고양이 안내서를 확인하세요.', src: ['au_g3'] });
    if (lab === 0) out.warnings.push({ level: 'info', text: '시료가 실험실에 도착하는 날 기준이에요. 운송일(일)을 넣으면 그만큼 늦춰 계산해요.', src: ['au_g3'] });
    out.src = ['au_g3'];
  }
  function returnPlan(R, pet, trip, out, today) {
    const r = trip.returnDate; const d = out.steps && out.steps.draw ? out.steps.draw.date : null;
    const res = { date: r, items: [] };
    if (d) {
      const from = addDays(d, 30); const to = addMonths(d, 24);
      res.window = [from, to]; res.ok = r >= from && r <= to;
      res.items.push(res.ok ? '귀국일이 항체검사 인정 범위(선적 전 30일~24개월) 안이에요.' : '귀국일이 항체검사 인정 범위(' + fmt(from) + ' ~ ' + fmt(to) + ') 밖이에요 — 귀국 전 재검사가 필요해요.');
    } else res.items.push('항체검사 날짜가 없어 귀국 조건을 계산하지 못했어요.');
    res.items.push('출발국이 한국 고시상 광견병 비발생지역이면 칩만 확인해요 — 목록은 검역본부 홈페이지에서 확인하세요(확인 필요).');
    if (out.country === 'JP') { const ap = addDays(r, -14); res.items.push('일본에서 출국할 때 수출검사 신청은 출국 14일 전까지(' + fmt(ap) + ')예요.'); if (ap >= today) out.events.push(ev(ap, '일본 수출검사 신청 마감 (귀국 14일 전)', { place: '일본 동물검역소 · NACCS', kind: 'deadline', src: ['jp_export'], alarm: '-P7D' })); }
    out.events.push(ev(r, '한국 귀국 — 입국 검역', { kind: 'arrive', src: ['qia_import_en', 'qia_faq'] }));
    out.returnPlan = res;
  }

  /* .ics (RFC 5545): 종일 일정 + VALARM. 창(window)은 DTEND = 끝 + 1일 */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    const out = []; let cur = '', bytes = 0;
    for (const ch of line) { const b = new TextEncoder().encode(ch).length; if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; }
    out.push(cur); return out.map((l, i) => (i ? ' ' : '') + l).join('\r\n');
  }
  function toICS(events, o) {
    o = o || {}; const stamp = (o.now ? new Date(o.now) : new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//pet-departure-quarantine-countdown//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(o.calName || '반려동물 출국 검역 일정')];
    events.forEach((e, i) => {
      const s = e.date.replace(/-/g, ''); const en = addDays(e.end && e.end > e.date ? e.end : e.date, 1).replace(/-/g, '');
      const src = (e.srcUrls || []).join(' ');
      L.push('BEGIN:VEVENT', 'UID:pq-' + s + '-' + i + '-' + (o.uidSeed || 'x') + '@webapp-daily', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + s, 'DTEND;VALUE=DATE:' + en,
        'SUMMARY:' + icsEsc((o.prefix ? o.prefix + ' · ' : '') + e.title),
        'DESCRIPTION:' + icsEsc([e.place, e.note, src ? '출처: ' + src : '', '참고용 계산입니다. 최종 확인은 농림축산검역본부와 도착국 공식 안내'].filter(Boolean).join('\n')),
        'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:' + (e.alarm || '-P1D'), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
  }

  /* 공유 링크: 기본으로 이름·칩 번호·메모 제외. 옵션: 이름 포함, 칩 번호(뒤 6자리 가림) 포함 */
  const maskChip = no => /^\d{15}$/.test(no || '') ? no.slice(0, 9) + '******' : '';
  function b64e(s) { const u = new TextEncoder().encode(s); let b = ''; u.forEach(x => b += String.fromCharCode(x)); return (typeof btoa === 'function' ? btoa(b) : Buffer.from(b, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64d(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary'); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); }
  const CC = ['JP', 'EU', 'GB', 'US', 'AU'];
  function cleanShare(o) {
    const d = x => isDate(x) ? x : null; const r = {};
    r.c = CC.includes(o.c) ? o.c : null; if (!r.c) throw new Error('bad');
    r.sp = o.sp === 'cat' ? 'cat' : 'dog'; r.a = d(o.a); if (!r.a) throw new Error('bad');
    if (d(o.d)) r.d = o.d; if (typeof o.sub === 'string' && /^[A-Z]{2}$/.test(o.sub)) r.sub = o.sub; if (typeof o.ap === 'string' && /^[A-Z]{3}(_X)?$/.test(o.ap)) r.ap = o.ap;
    if (d(o.b)) r.b = o.b; if (d(o.cd)) r.cd = o.cd; if (d(o.r)) r.r = o.r; if (/^\d{2}:\d{2}$/.test(o.t || '')) r.t = o.t; if (Number.isInteger(o.lab) && o.lab >= 0 && o.lab <= 60) r.lab = o.lab;
    r.s = (Array.isArray(o.s) ? o.s : []).slice(0, 20).filter(x => Array.isArray(x) && d(x[0])).map(x => [x[0], x[1] === 3 ? 3 : 1].concat(d(x[2]) ? [x[2]] : []));
    r.ti = (Array.isArray(o.ti) ? o.ti : []).slice(0, 6).filter(x => Array.isArray(x) && d(x[0])).map(x => [x[0], typeof x[1] === 'number' && isFinite(x[1]) && x[1] >= 0 && x[1] < 1000 ? x[1] : null]);
    if (typeof o.n === 'string') { const n = o.n.replace(/[<>&"'`\u0000-\u001f]/g, '').slice(0, 20).trim(); if (n) r.n = n; }
    if (typeof o.ch === 'string' && /^\d{9}\*{6}$/.test(o.ch)) r.ch = o.ch;
    return r;
  }
  function encodeShare(st, opts) {
    opts = opts || {}; const p = st.pet, t = st.trip;
    const o = { v: 1, c: t.country, sp: t.species, a: t.arrival, d: t.departure, sub: t.sub, ap: t.airport, b: p.birth, cd: p.chipDate, r: t.returnDate, t: t.arrivalTime, lab: t.labDays ? parseInt(t.labDays, 10) : undefined,
      s: (p.shots || []).map(s => [s.date, s.years, s.validUntil]), ti: (p.titers || []).map(x => [x.draw, x.result === '' || x.result == null ? null : Number(x.result)]) };
    if (opts.includeName && p.name) o.n = p.name;
    if (opts.includeChip && maskChip(p.chipNo)) o.ch = maskChip(p.chipNo);
    return b64e(JSON.stringify(cleanShare(o)));
  }
  function decodeShare(s) {
    const o = cleanShare(JSON.parse(b64d(String(s || ''))));
    return { pet: { name: o.n || '', chipMasked: o.ch || '', birth: o.b || null, chipDate: o.cd || null, shots: o.s.map(x => ({ date: x[0], years: x[1], validUntil: x[2] || null })), titers: o.ti.map(x => ({ draw: x[0], result: x[1] })) },
      trip: { country: o.c, species: o.sp, arrival: o.a, departure: o.d || null, sub: o.sub || null, airport: o.ap || null, returnDate: o.r || null, arrivalTime: o.t || '', labDays: o.lab || 0 } };
  }
  /* 서류 금고 */
  const chipValid = no => /^\d{15}$/.test(String(no || '').trim());
  function docBadge(expiry, today) { if (!isDate(expiry)) return null; const k = diff(expiry, today); return k < 0 ? 'expired' : k <= 30 ? 'soon' : 'ok'; }

  function runSelfTest() {
    const T = '2026-11-12', fails = [];
    const eq = (a, b, n) => { if (a !== b) fails.push(n + ': ' + a + ' ≠ ' + b); };
    eq(addDays('2026-12-12', 180), '2027-06-10', '180일'); eq(addMonths('2026-08-31', 6), '2027-03-01', '말일 보정'); eq(diff('2027-03-15', '2026-12-12'), 93, 'diff');
    eq(validUntil({ date: '2024-03-10', years: 1 }), '2025-03-09', '유효기간'); eq(examOK('2027-03-15', '2027-03-05'), true, 'D-10'); eq(examOK('2027-03-15', '2027-03-04'), false, 'D-11');
    eq(noticeOK('2026-12-22', T), true, 'D-40'); eq(noticeOK('2026-12-21', T), false, 'D-39'); eq(level(14), 'green', 'L14'); eq(level(13), 'yellow', 'L13'); eq(level(-1), 'red', 'L-1');
    const sh = decodeShare(encodeShare({ pet: { name: '콩이', chipNo: '410123456789012', birth: '2021-05-02', shots: [], titers: [] }, trip: { country: 'JP', species: 'dog', arrival: '2027-03-15' } }));
    eq(sh.pet.name, '', '공유 이름 제외'); eq(sh.pet.chipMasked, '', '공유 칩 제외');
    return { ok: !fails.length, fails };
  }
  return { toN, toISO, isDate, addDays, addMonths, diff, max, min, todayKST, fmt, weekday, validUntil, validVaccines, chain, isContinuous, level, LV, examOK, noticeOK, plan, tapeworm, toICS, fold, icsEsc, encodeShare, decodeShare, cleanShare, maskChip, chipValid, docBadge, runSelfTest, b64e, b64d };
});
