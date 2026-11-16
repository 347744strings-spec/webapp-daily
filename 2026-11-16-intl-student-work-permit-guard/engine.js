/* 알바 허가 지킴이 — 계산 엔진 (브라우저 + node require 겸용, 외부 의존 없음) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WPGEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const pad = n => String(n).padStart(2, '0');
  const isYmd = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
  const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const ymd = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); t.setUTCDate(Math.min(d, last)); return ymd(t); };
  const dowIdx = s => (toD(s).getUTCDay() + 6) % 7; // 0=월 … 6=일
  const weekKey = s => addDays(s, -dowIdx(s));
  const diffDays = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const hm = t => { if (typeof t !== 'string' || !/^\d{1,2}:\d{2}$/.test(t)) return NaN; const [h, m] = t.split(':').map(Number); return h > 24 || m > 59 || (h === 24 && m) ? NaN : h * 60 + m; };
  const fmtH = mins => { const h = Math.round(mins / 6) / 10; return (Number.isInteger(h) ? String(h) : h.toFixed(1)); };
  const inRange = (s, r) => r && isYmd(r.start) && isYmd(r.end) && s >= r.start && s <= r.end;

  /* ---------- 한국어 능력 ---------- */
  function langLevel(lang, rules) {
    if (!lang || lang.type === 'unknown') return { level: 0, unknown: true, english: false, excellent: false };
    const L = rules.langReq; let level = 0, excellent = false;
    if (lang.type === 'topik') { level = Number(lang.value) || 0; excellent = level >= rules.bonusDef.koreanExcellent.topik; }
    else if (lang.type === 'kiip') { level = Number(lang.value) || 0; excellent = level >= rules.bonusDef.koreanExcellent.kiip || !!lang.kiipFinal; }
    else if (lang.type === 'kiipPre') { const sc = Number(lang.value) || 0; for (const [min, lv] of L.kiipPreToLevel) if (sc >= min) { level = lv; break; } }
    else if (lang.type === 'sejong') { level = L.sejongToLevel[lang.value] || 0; }
    else if (lang.type === 'english') return { level: 0, unknown: false, english: true, excellent: false };
    return { level: Math.min(level, 6), unknown: false, english: false, excellent };
  }
  function reqLevel(p, rules) {
    const L = rules.langReq;
    if (p.visa === 'D-4') return L.d4;
    if (p.program === 'associate') return L.associate;
    if (p.program === 'bachelor') return (p.year === 1 || p.year === 2) ? L.bachelor12 : L.bachelor34; // 학년 모름 → 3~4학년 기준(보수적)
    return L.grad;
  }

  /* ---------- 내 한도 ---------- */
  function computeLimit(p, rules, today) {
    const out = { ok: true, visa: p.visa, met: false, unknown: [], weekdayCap: null, totalCap: null, unlimited: false, bonus: false,
      maxPlaces: 2, permitMaxMonths: 12, eligibleNow: true, eligibleFrom: null, status: 'verified', src: 'moj_manual', profileId: '', req: null, level: null };
    if (!p || !p.visa) return Object.assign(out, { ok: false, reason: 'noProfile' });
    if (p.visa === 'thesis') {
      const h = rules.hours.thesis; Object.assign(out, { profileId: 'thesis', met: true, totalCap: h.total, unlimited: false, status: h.status, src: h.src, maxPlaces: rules.places.thesis.max, permitMaxMonths: rules.places.thesis.permitMaxMonths });
      return out;
    }
    const lv = langLevel(p.lang, rules); const req = reqLevel(p, rules); out.req = req; out.level = lv.level;
    if (lv.unknown) out.unknown.push('lang');
    if (p.program === 'bachelor' && !(p.year >= 1 && p.year <= 4)) out.unknown.push('year');
    const met = p.visa === 'D-2' && lv.english ? true : (!lv.unknown && lv.level >= req);
    out.met = met;
    const b = p.bonus;
    const bonusUnknown = b === 'unknown';
    if (bonusUnknown && met) out.unknown.push('bonus');
    const bonus = met && (lv.excellent || (Array.isArray(b) && (b.includes('certified') || b.includes('gradeA'))));
    out.bonus = !!bonus; out.bonusByLang = met && lv.excellent;
    if (p.visa === 'D-4') {
      const h = rules.hours.d4; out.profileId = 'd4'; out.maxPlaces = rules.places['D-4'].max; out.permitMaxMonths = rules.places['D-4'].permitMaxMonths; out.src = h.src;
      out.totalCap = !met ? h.notMetTotal : (bonus ? h.bonusTotal : h.metTotal);
      out.status = !met ? h.statusNotMet : (bonus ? h.statusBonus : h.status);
      out.unlimited = false;
      if (!isYmd(p.entryDate)) { out.eligibleNow = false; out.unknown.push('entryDate'); }
      else { out.eligibleFrom = addMonths(p.entryDate, rules.d4WaitMonths); out.eligibleNow = !!today && today >= out.eligibleFrom; }
      return out;
    }
    const grad = p.program === 'master' || p.program === 'doctor';
    const h = grad ? rules.hours.d2_grad : rules.hours.d2_undergrad; out.profileId = grad ? 'd2_grad' : (p.program === 'associate' ? 'd2_assoc' : ((p.year === 1 || p.year === 2) ? 'd2_ba12' : 'd2_ba34'));
    out.maxPlaces = rules.places['D-2'].max; out.permitMaxMonths = rules.places['D-2'].permitMaxMonths; out.status = h.status; out.src = h.src;
    if (!met) { out.totalCap = h.notMetTotal; out.unlimited = false; }
    else { out.weekdayCap = bonus ? h.bonusWeekday : h.metWeekday; out.unlimited = true; }
    return out;
  }

  /* ---------- 날짜 분류 ---------- */
  function holidayMap(hol) { const m = {}; for (const h of (hol && hol.holidays) || []) m[h.date] = h.name; return m; }
  function dayType(s, school, hmap) {
    if (school && Array.isArray(school.vacations) && school.vacations.some(r => inRange(s, r))) return 'vacation';
    if (hmap && hmap[s]) return 'holiday';
    return dowIdx(s) >= 5 ? 'weekend' : 'weekday';
  }

  /* ---------- 근무표 펼치기 (자정 넘김 분할) ---------- */
  function segmentsFor(date, sh) {
    const a = hm(sh.start), b = hm(sh.end); if (isNaN(a) || isNaN(b) || a === b) return [];
    if (b > a) return [{ date, from: a, to: b, mins: b - a }];
    const segs = [{ date, from: a, to: 1440, mins: 1440 - a }]; if (b > 0) segs.push({ date: addDays(date, 1), from: 0, to: b, mins: b, carry: true }); return segs;
  }
  function expand(state, from, to) {
    const out = []; const wps = {}; for (const w of state.workplaces || []) wps[w.id] = w;
    const skip = new Set((state.skips || []).map(k => k.wpId + '|' + k.date));
    for (let d = addDays(from, -1); d <= to; d = addDays(d, 1)) {
      for (const sh of state.shifts || []) {
        const w = wps[sh.wpId]; if (!w) continue;
        let hit = false;
        if (sh.date) hit = sh.date === d;
        else if (typeof sh.dow === 'number') hit = sh.dow === dowIdx(d) && (!isYmd(w.startOn) || d >= w.startOn) && (!isYmd(w.endOn) || d <= w.endOn) && !skip.has(sh.wpId + '|' + d);
        if (!hit) continue;
        for (const sg of segmentsFor(d, sh)) if (sg.date >= from && sg.date <= to) out.push(Object.assign(sg, { wpId: sh.wpId, startDate: d, shift: sh }));
      }
    }
    return out.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : x.from - y.from);
  }

  /* ---------- 주별 집계 ---------- */
  function aggregate(state, limit, hol, monday, nWeeks) {
    const hmap = holidayMap(hol); const weeks = [];
    for (let i = 0; i < nWeeks; i++) {
      const ws = addDays(monday, 7 * i), we = addDays(ws, 6); const segs = expand(state, ws, we);
      const days = []; for (let k = 0; k < 7; k++) { const d = addDays(ws, k); days.push({ date: d, type: dayType(d, state.school, hmap), mins: 0, holiday: hmap[d] || null, outOfData: !!hol && (d < hol.from || d > hol.through) }); }
      let wd = 0, other = 0; const byWp = {};
      for (const sg of segs) { const day = days[diffDays(ws, sg.date)]; sg.type = day.type; day.mins += sg.mins; if (sg.type === 'weekday') wd += sg.mins; else other += sg.mins; byWp[sg.wpId] = (byWp[sg.wpId] || 0) + sg.mins; }
      const counted = limit.unlimited ? wd : wd + other; const capH = limit.unlimited ? limit.weekdayCap : limit.totalCap; const cap = capH == null ? null : capH * 60;
      const over = cap != null && counted > cap; const near = !over && cap != null && counted >= cap * 0.85 && counted > 0;
      weeks.push({ week: ws, end: we, days, segs, weekdayMins: wd, otherMins: other, totalMins: wd + other, countedMins: counted, capMins: cap, over, near, overBy: over ? counted - cap : 0, byWp, status: over ? 'stop' : (near ? 'warn' : 'ok') });
    }
    return weeks;
  }

  /* ---------- 조정 제안 ---------- */
  function suggest(week, limit) {
    if (!week.over) return [];
    const out = []; const need = week.overBy;
    if (limit.unlimited) {
      const target = week.days.find(d => d.type !== 'weekday');
      const wdSegs = week.segs.filter(s => s.type === 'weekday').sort((a, b) => b.mins - a.mins);
      let pick = wdSegs.find(s => s.mins >= need);
      if (!pick) pick = wdSegs[0];
      if (pick && target) out.push({ kind: 'move', date: pick.date, dow: dowIdx(pick.date), from: pick.from, to: pick.to, mins: pick.mins, toDate: target.date, toDow: dowIdx(target.date), toType: target.type, fixes: pick.mins >= need, wpId: pick.wpId });
      if (pick && pick.mins >= need) {} else out.push({ kind: 'cut', mins: need });
      if (!target) out.push({ kind: 'cut', mins: need });
    } else {
      const segs = week.segs.slice().sort((a, b) => b.mins - a.mins); const pick = segs.find(s => s.mins >= need) || segs[0];
      out.push({ kind: 'cut', mins: need, date: pick && pick.date, dow: pick ? dowIdx(pick.date) : null, from: pick && pick.from, to: pick && pick.to, wpId: pick && pick.wpId });
    }
    return out;
  }

  /* ---------- 업종 신호등 ---------- */
  function classifyIndustry(text, industries, level) {
    const s = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s) return { signal: 'unknown', matched: [], ids: [] };
    const order = industries.signals; const hits = [];
    for (const it of industries.items) { const m = it.kw.filter(k => s.includes(k.toLowerCase())); if (m.length) hits.push({ it, m }); }
    if (!hits.length) return { signal: 'unknown', matched: [], ids: [] };
    hits.sort((a, b) => order[a.it.signal].order - order[b.it.signal].order);
    const top = hits[0].it; let signal = top.signal;
    const res = { signal, matched: hits.flatMap(h => h.m), ids: hits.map(h => h.it.id), top: top.id, oneStrike: !!top.oneStrike };
    if (top.id === 'manufacturing') res.levelOk = typeof level === 'number' && level >= top.needLevel;
    return res;
  }

  /* ---------- 경고 ---------- */
  const SEV = { stop: 0, warn: 1, check: 2, info: 3 };
  function warnings(state, limit, rules, industries, weeks, today) {
    const W = []; const p = state.profile || {}; const wps = state.workplaces || [];
    const add = (id, sev, params, src, status) => W.push({ id, sev, params: params || {}, src: src || 'moj_manual', status: status || 'verified' });
    const overs = weeks.filter(w => w.over); // 반복 근무로 여러 주가 넘으면 카드 1장에 주 목록으로 묶음
    if (overs.length) add('over', 'stop', { n: overs.length, weeks: overs.map(w => ({ week: w.week, counted: w.countedMins, cap: w.capMins })), week: overs[0].week, counted: overs[0].countedMins, cap: overs[0].capMins, unlimited: limit.unlimited }, limit.src, limit.status);
    if (wps.length > limit.maxPlaces) add('places', 'stop', { n: wps.length, max: limit.maxPlaces, visa: limit.visa }, 'moj_manual');
    if (p.visa === 'D-4' && !limit.eligibleNow) {
      const has = weeks.some(w => w.segs.some(s => !limit.eligibleFrom || s.date < limit.eligibleFrom));
      add('d4wait', has ? 'stop' : 'info', { from: limit.eligibleFrom }, 'moj_manual');
    }
    const lv = langLevel(p.lang, rules);
    for (const wp of wps) {
      const segs = weeks.flatMap(w => w.segs.filter(s => s.wpId === wp.id));
      const first = segs[0];
      if (first && (!wp.permitted || !isYmd(wp.permitFrom))) add('noPermit', 'stop', { wp: wp.name, date: first.date }, 'law_immig');
      else if (first && wp.permitFrom && first.date < wp.permitFrom) add('beforePermit', 'stop', { wp: wp.name, date: first.date, from: wp.permitFrom }, 'law_immig');
      if (wp.permitted && isYmd(wp.permitTo)) { const late = segs.find(s => s.date > wp.permitTo); if (late) add('afterPermit', 'stop', { wp: wp.name, date: late.date, to: wp.permitTo }, 'law_immig'); }
      if (wp.permitted && isYmd(wp.permitFrom) && isYmd(wp.permitTo) && wp.permitTo > addMonths(wp.permitFrom, limit.permitMaxMonths)) add('permitLong', 'check', { wp: wp.name, months: limit.permitMaxMonths }, 'moj_manual');
      if (wp.permitHours > 0) for (const w of weeks) { const m = w.byWp[wp.id] || 0; if (m > wp.permitHours * 60) { add('permitHours', 'stop', { wp: wp.name, week: w.week, mins: m, cap: wp.permitHours * 60 }, 'moj_manual'); break; } }
      if (isYmd(wp.changedOn)) {
        add('changeNewPermit', 'warn', { wp: wp.name, date: wp.changedOn }, 'moj_manual');
        const due = addDays(wp.changedOn, rules.changeReportDays);
        if (!isYmd(wp.reportedOn) && today > due) add('changeReport', 'warn', { wp: wp.name, due }, rules.changeSrc, 'check');
      }
      if (Number(wp.commuteMin) >= rules.commuteMin) add('commute', 'warn', { wp: wp.name, min: wp.commuteMin }, rules.commuteSrc, 'school');
      const ind = classifyIndustry(wp.industry, industries, lv.unknown ? null : lv.level);
      if (ind.signal === 'ban') add('indBan', 'stop', { wp: wp.name, kw: ind.matched.slice(0, 3).join(', '), from: rules.oneStrike.from }, rules.oneStrike.src);
      else if (ind.signal === 'restricted') add('indRestricted', 'stop', { wp: wp.name, kw: ind.matched.slice(0, 3).join(', ') }, 'moj_manual');
      else if (ind.signal === 'conditional') add(ind.top === 'manufacturing' && !ind.levelOk ? 'indMfgLow' : 'indConditional', ind.top === 'manufacturing' && !ind.levelOk ? 'stop' : 'warn', { wp: wp.name, kw: ind.matched.slice(0, 3).join(', ') }, 'moj_manual');
      else if (ind.signal === 'unknown' && wp.industry) add('indUnknown', 'check', { wp: wp.name }, 'moj_manual', 'check');
    }
    if (typeof p.gpa === 'number' && p.gpa < rules.minGpa) add('gpa', 'warn', { gpa: p.gpa, min: rules.minGpa }, rules.gpaSrc);
    if (p.visa === 'D-4' && typeof p.attendance === 'number' && p.attendance < rules.d4MinAttendance) add('attendance', 'warn', { v: p.attendance, min: rules.d4MinAttendance }, 'moj_manual');
    if (isYmd(p.visaExpiry) && diffDays(today, p.visaExpiry) <= rules.visaRemindDays) add('visaSoon', 'warn', { date: p.visaExpiry, d: diffDays(today, p.visaExpiry) }, 'moj_manual');
    if (isYmd(p.topikExpiry) && p.topikExpiry < today && state.school && state.school.expiredTopik === 'rejected') add('topikExpired', 'warn', { date: p.topikExpiry }, state.school.src || 'hallym', 'school');
    if (isYmd(p.topikExpiry) && p.topikExpiry < today && (!state.school || state.school.expiredTopik !== 'rejected' && state.school.expiredTopik !== 'accepted')) add('topikExpiredUnknown', 'check', { date: p.topikExpiry }, 'yonsei', 'check');
    for (const u of limit.unknown) add('unknown_' + u, 'check', {}, 'moj_manual', 'check');
    if (weeks.some(w => w.days.some(d => d.outOfData && d.mins > 0))) add('holidayRange', 'check', {}, 'kasa_2027', 'check');
    return W.sort((a, b) => SEV[a.sev] - SEV[b.sev]);
  }

  /* ---------- 절차 타임라인 ---------- */
  function timeline(state, rules, today) {
    const ev = []; const p = state.profile || {};
    for (const wp of state.workplaces || []) {
      if (isYmd(wp.startOn) && !wp.permitted) {
        ev.push({ id: 'ask', date: addDays(wp.startOn, -rules.recommendLeadDays), wp: wp.name, src: rules.leadSrc, status: rules.leadStatus });
        ev.push({ id: 'apply', date: addDays(wp.startOn, -rules.processingDays), wp: wp.name, src: rules.processingSrc, status: 'gov' });
        ev.push({ id: 'start', date: wp.startOn, wp: wp.name, src: 'law_immig', status: 'verified' });
      }
      if (isYmd(wp.changedOn)) ev.push({ id: 'report', date: addDays(wp.changedOn, rules.changeReportDays), wp: wp.name, src: rules.changeSrc, status: 'check' });
      if (wp.permitted && isYmd(wp.permitTo)) ev.push({ id: 'permitEnd', date: wp.permitTo, wp: wp.name, src: 'moj_manual', status: 'verified' });
    }
    if (isYmd(p.visaExpiry)) ev.push({ id: 'visa', date: addDays(p.visaExpiry, -rules.visaRemindDays), ref: p.visaExpiry, src: 'moj_manual', status: 'check' });
    if (isYmd(p.topikExpiry)) ev.push({ id: 'topik', date: addDays(p.topikExpiry, -rules.topikRemindDays), ref: p.topikExpiry, src: state.school && state.school.src || 'yonsei', status: 'school' });
    return ev.map(e => Object.assign(e, { past: e.date < today, dday: diffDays(today, e.date) })).sort((a, b) => a.date < b.date ? -1 : 1);
  }

  /* ---------- .ics (RFC 5545) ---------- */
  function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line; const out = []; let cur = '', n = 0, lim = 75; for (const ch of line) { const b = enc.encode(ch).length; if (n + b > lim) { out.push(cur); cur = ' ' + ch; n = 1 + b; lim = 75; } else { cur += ch; n += b; } } out.push(cur); return out.join('\r\n'); }
  function buildICS(events, stamp) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WebAppDaily//intl-student-work-permit-guard//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:알바 허가 지킴이'];
    const ds = String(stamp || '20261116T000000Z');
    events.forEach((e, i) => {
      const d = e.date.replace(/-/g, ''), d2 = addDays(e.date, 1).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:wpg-' + e.id + '-' + d + '-' + i + '@webapp-daily', 'DTSTAMP:' + ds, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2, 'SUMMARY:' + icsEsc(e.summary), 'DESCRIPTION:' + icsEsc(e.description || ''), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.summary), 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
  }

  /* ---------- 급여 참고 ---------- */
  function wage(hourly, weeklyH, year, rules) {
    const min = rules.minWage[String(year)] || null; const h = Number(hourly) || 0, wh = Number(weeklyH) || 0;
    const juhyu = wh >= rules.juhyuMinWeekly; const juhyuPay = juhyu ? Math.round(Math.min(wh, 40) / 40 * 8 * h) : 0;
    return { min, below: min != null && h > 0 && h < min, juhyu, juhyuPay, weekPay: Math.round(h * wh) };
  }

  /* ---------- 텍스트 근무표 파서 ("월 18-22, 토 10-18") ---------- */
  const DOWMAP = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6, t2: 0, t3: 1, t4: 2, t5: 3, t6: 4, t7: 5, cn: 6, '周一': 0, '周二': 1, '周三': 2, '周四': 3, '周五': 4, '周六': 5, '周日': 6, dush: 0, sesh: 1, chor: 2, pay: 3, jum: 4, shan: 5, yak: 6, du: 0, se: 1, ju: 4 };
  function normT(x) { x = x.trim(); if (/^\d{1,2}$/.test(x)) return pad(+x) + ':00'; const m = x.match(/^(\d{1,2})[:.](\d{2})$/); return m ? pad(+m[1]) + ':' + m[2] : null; }
  function parseScheduleText(text) {
    const ok = [], bad = [];
    for (const raw of String(text || '').split(/[,;\n]+/)) {
      const part = raw.trim(); if (!part) continue;
      const m = part.toLowerCase().match(/^(t[2-7]|[^\d\s]+)\s*(\d{1,2}(?:[:.]\d{2})?)\s*[-~–]\s*(\d{1,2}(?:[:.]\d{2})?)$/);
      if (!m) { bad.push(part); continue; }
      const key = m[1].replace(/요일$/, '').replace(/\.$/, ''); let idx = DOWMAP[key]; if (idx === undefined) idx = DOWMAP[key.slice(0, 3)];
      if (idx === undefined && /^(월|화|수|목|금|토|일)/.test(key)) idx = DOWMAP[key[0]];
      const s = normT(m[2]), e = normT(m[3]);
      if (idx === undefined || !s || !e || isNaN(hm(s)) || isNaN(hm(e)) || s === e) { bad.push(part); continue; }
      ok.push({ dow: idx, start: s, end: e });
    }
    return { ok, bad };
  }

  /* ---------- 백업 검증 ---------- */
  const ID_PAT = /(\d{6}\s*-\s*[1-8]\d{6})|\b[A-Z]{1,2}\d{7,8}\b/;
  function validateBackup(o) {
    if (!o || typeof o !== 'object' || o.app !== 'wpg' || !o.data || typeof o.data !== 'object') return { ok: false, err: 'format' };
    const d = o.data; if (!Array.isArray(d.workplaces || []) || !Array.isArray(d.shifts || [])) return { ok: false, err: 'format' };
    if ((d.workplaces || []).length > 6 || (d.shifts || []).length > 200) return { ok: false, err: 'size' };
    if (ID_PAT.test(JSON.stringify(d))) return { ok: false, err: 'idnum' };
    return { ok: true, data: d };
  }
  function hasIdNumber(s) { return ID_PAT.test(String(s || '')); }
  function initials(name) { return String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + '.').join(' ').slice(0, 12); }

  /* ---------- 자체 테스트 ---------- */
  function runSelfTest(rules, industries, hol) {
    const R = []; const ck = (n, v) => R.push({ name: n, pass: !!v });
    const T = '2026-11-16';
    const c1 = computeLimit({ visa: 'D-2', program: 'bachelor', year: 2, lang: { type: 'topik', value: 3 }, bonus: [] }, rules, T);
    ck('case1 학사2 TOPIK3 → 주중 25, 무제한', c1.weekdayCap === 25 && c1.unlimited && c1.totalCap === null);
    const c2 = computeLimit({ visa: 'D-2', program: 'bachelor', year: 3, lang: { type: 'topik', value: 3 }, bonus: [] }, rules, T);
    ck('case2 학사3 TOPIK3 → 미충족 주 10, 무제한 X', !c2.met && c2.totalCap === 10 && !c2.unlimited && c2.weekdayCap === null);
    const c3 = computeLimit({ visa: 'D-2', program: 'master', lang: { type: 'topik', value: 5 }, bonus: [] }, rules, T);
    ck('case3 석사 TOPIK5 → 주중 35, 무제한', c3.weekdayCap === 35 && c3.unlimited && c3.bonus);
    const c4 = computeLimit({ visa: 'D-4', program: 'language', lang: { type: 'topik', value: 2 }, entryDate: '2026-07-16', bonus: [] }, rules, T);
    ck('case4 D-4 4개월 → 아직 불가, 2027-01-16부터', !c4.eligibleNow && c4.eligibleFrom === '2027-01-16');
    const c5 = computeLimit({ visa: 'D-4', program: 'language', lang: { type: 'topik', value: 2 }, entryDate: '2026-03-16', bonus: [] }, rules, T);
    ck('case5 D-4 8개월 → 주 20(방학 포함), 무제한 X', c5.eligibleNow && c5.totalCap === 20 && !c5.unlimited && c5.maxPlaces === 1);
    const c6 = computeLimit({ visa: 'thesis', program: 'master' }, rules, T);
    ck('case6 논문준비생 → 주 30, 무제한 X', c6.totalCap === 30 && !c6.unlimited);
    const st = { profile: { visa: 'D-2' }, school: { vacations: [{ start: '2026-12-21', end: '2027-02-28' }] }, workplaces: [{ id: 'a', name: 'A', permitted: true, permitFrom: '2026-11-01', permitTo: '2027-10-31' }], shifts: [{ wpId: 'a', dow: 4, start: '22:00', end: '02:00' }] };
    const segs = expand(st, '2026-11-16', '2026-11-22');
    ck('midnight split 금 22–02 → 금 2h + 토 2h', segs.length === 2 && segs[0].mins === 120 && segs[1].date === '2026-11-21' && segs[1].mins === 120);
    ck('weekKey Monday', weekKey('2026-11-22') === '2026-11-16' && weekKey('2026-11-16') === '2026-11-16');
    const hmap = holidayMap(hol);
    ck('dayType holiday 2026-12-25', dayType('2026-12-25', {}, hmap) === 'holiday');
    ck('dayType vacation overrides', dayType('2026-12-24', st.school, hmap) === 'vacation');
    ck('industry 배달 → ban', classifyIndustry('업태 서비스 종목 배달대행', industries).signal === 'ban');
    ck('industry 카페 → ok', classifyIndustry('휴게음식점 커피전문점 카페', industries).signal === 'ok');
    ck('parser 월 18-22, 토 10-18', JSON.stringify(parseScheduleText('월 18-22, 토 10-18').ok) === JSON.stringify([{ dow: 0, start: '18:00', end: '22:00' }, { dow: 5, start: '10:00', end: '18:00' }]));
    const ics = buildICS([{ id: 'x', date: '2026-12-01', summary: '테스트, 일정' }], '20261116T000000Z');
    ck('ics CRLF + VALARM -P1D', /\r\n/.test(ics) && ics.includes('TRIGGER:-P1D') && ics.includes('DTSTART;VALUE=DATE:20261201'));
    ck('backup rejects 외국인등록번호 pattern', validateBackup({ app: 'wpg', data: { workplaces: [{ name: '990101-5123456' }], shifts: [] } }).err === 'idnum');
    const pass = R.filter(r => r.pass).length; return { pass, total: R.length, results: R };
  }

  return { DOW, isYmd, ymd, addDays, addMonths, dowIdx, weekKey, diffDays, hm, fmtH, langLevel, reqLevel, computeLimit, holidayMap, dayType, segmentsFor, expand, aggregate, suggest, classifyIndustry, warnings, timeline, buildICS, fold, wage, parseScheduleText, validateBackup, hasIdNumber, initials, runSelfTest };
});
