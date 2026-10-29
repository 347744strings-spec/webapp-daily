/* 2027 인건비 리허설 — 계산 규칙 (UMD: window.LaborRules / require) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.LaborRules = f(); })(this, function () {
'use strict';
var DAY = ['월', '화', '수', '목', '금', '토', '일'];
var WEEK = 7 * 1440;

function num(v) { if (typeof v === 'number') return isFinite(v) ? v : NaN; var t = String(v == null ? '' : v).replace(/[,\s원%]/g, ''); if (t === '') return NaN; var n = Number(t); return isFinite(n) ? n : NaN; }
function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); if (!m) return NaN; var h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return NaN; return h * 60 + mi; }
function fmtMin(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mi = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi; }
function r2(x) { return Math.round(x * 100) / 100; }
function won(x) { return Math.round(x); }

/* 휴게: 근로기준법 제54조 — 근로 4시간 30분, 8시간 1시간 (근로시간 기준) */
function breakRequired(workMin, rules) {
  var br = (rules && rules.breakRule) || [{ over: 4, minutes: 30 }, { over: 8, minutes: 60 }], need = 0;
  br.forEach(function (b) { if (workMin >= b.over * 60) need = Math.max(need, b.minutes); });
  return need;
}
/* 근무 길이(span)에 맞는 최소 휴게 제안 */
function suggestBreak(spanMin, rules) {
  var opts = [0, 30, 60];
  for (var i = 0; i < opts.length; i++) { var w = spanMin - opts[i]; if (w > 0 && breakRequired(w, rules) <= opts[i]) return opts[i]; }
  return 60;
}
function span(sh) {
  var s = toMin(sh.start), e = toMin(sh.end);
  if (isNaN(s) || isNaN(e)) return null;
  if (e <= s) e += 1440; /* 자정 넘김 */
  return { s: s, e: e, len: e - s, overnight: e > 1440 };
}
function validateShift(sh, rules) {
  var errs = [];
  if (!(sh && sh.day >= 0 && sh.day <= 6 && sh.day === Math.floor(sh.day))) errs.push('요일을 골라 주세요.');
  var sp = sh ? span(sh) : null;
  if (!sp) { errs.push('시작·종료 시간을 골라 주세요.'); return errs; }
  if (toMin(sh.start) === toMin(sh.end)) errs.push('시작과 종료 시간이 같아요.');
  var b = num(sh.breakMin || 0);
  if (!(b >= 0)) errs.push('휴게시간이 올바르지 않아요.');
  else if (b >= sp.len) errs.push('휴게시간이 근무시간보다 길어요.');
  return errs;
}
/* 근무 구간(주 시작 월 00:00 기준 절대 분). 휴게는 근무 한가운데에 있다고 가정 */
function shiftWork(sh) {
  var sp = span(sh); if (!sp) return null;
  var b = Math.max(0, Math.min(num(sh.breakMin || 0) || 0, sp.len)), off = sh.day * 1440;
  var a = off + sp.s, z = off + sp.e, mid = (a + z) / 2, ints = [];
  if (b > 0) { if (mid - b / 2 > a) ints.push([a, mid - b / 2]); if (z > mid + b / 2) ints.push([mid + b / 2, z]); }
  else ints.push([a, z]);
  return { day: sh.day, ints: ints, work: sp.len - b, span: sp.len, brk: b, overnight: sp.overnight, a: a, z: z };
}
function overlap(a1, a2, b1, b2) { return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)); }
/* 자정 분리: 역일(달력 날짜)별 근로 분 (일요일 밤 → 다음 주 월요일은 월요일로 접음) */
function splitByDay(ints) {
  var d = [0, 0, 0, 0, 0, 0, 0];
  ints.forEach(function (iv) { for (var k = Math.floor(iv[0] / 1440); k * 1440 < iv[1]; k++) { var o = overlap(iv[0], iv[1], k * 1440, (k + 1) * 1440); if (o > 0) d[((k % 7) + 7) % 7] += o; } });
  return d;
}
function nightMin(ints, rules) {
  var p = (rules && rules.premium) || { nightStart: 22, nightEnd: 6 }, ns = p.nightStart * 60, ne = (24 + p.nightEnd) * 60, t = 0;
  ints.forEach(function (iv) { for (var k = Math.floor(iv[0] / 1440) - 1; k * 1440 < iv[1]; k++) t += overlap(iv[0], iv[1], k * 1440 + ns, k * 1440 + ne); });
  return t;
}
function staffIntervals(st) { var out = []; (st.shifts || []).forEach(function (sh) { if (validateShift(sh).length) return; var w = shiftWork(sh); if (w) out.push(w); }); return out; }
function invalidCount(st) { return (st.shifts || []).filter(function (sh) { return validateShift(sh).length > 0; }).length; }
function validateStaff(st, rules) {
  var errs = [], ws = [];
  if (!String(st.alias || '').trim()) errs.push({ f: 'alias', m: '별칭을 적어 주세요(예: 오전 알바).' });
  var w26 = num(st.wageNow), w27 = num(st.wage2027);
  if (st.wageNow !== null && st.wageNow !== undefined && st.wageNow !== '' && !(w26 > 0 && w26 < 1000000)) errs.push({ f: 'wageNow', m: '지금 시급을 숫자로 적어 주세요.' });
  if (st.wage2027 !== null && st.wage2027 !== undefined && st.wage2027 !== '' && !(w27 > 0 && w27 < 1000000)) errs.push({ f: 'wage2027', m: '2027 시급을 숫자로 적어 주세요.' });
  (st.shifts || []).forEach(function (sh, i) {
    validateShift(sh, rules).forEach(function (m) { errs.push({ f: 'shift' + i, m: DAY[sh.day] ? DAY[sh.day] + '요일: ' + m : m }); });
    var w = shiftWork(sh); if (w && !validateShift(sh, rules).length) ws.push({ i: i, w: w });
  });
  for (var i = 0; i < ws.length; i++) for (var j = i + 1; j < ws.length; j++) {
    var A = ws[i].w, B = ws[j].w;
    var o = overlap(A.a, A.z, B.a, B.z) + overlap(A.a + WEEK, A.z + WEEK, B.a, B.z) + overlap(A.a, A.z, B.a + WEEK, B.z + WEEK);
    if (o > 0) errs.push({ f: 'shift' + ws[j].i, m: DAY[B.day] + '요일 근무가 ' + DAY[A.day] + '요일 근무와 겹쳐요.' });
  }
  return errs;
}
/* 주휴일: 직원 지정값, 없으면 일→토→월… 중 근무 없는 첫 요일. 7일 모두 근무면 일요일(휴일근로) */
function holidayFor(st) {
  if (st.holiday >= 0 && st.holiday <= 6) return st.holiday;
  var used = {}; (st.shifts || []).forEach(function (s) { used[s.day] = 1; });
  var order = [6, 5, 0, 1, 2, 3, 4];
  for (var i = 0; i < order.length; i++) if (!used[order[i]]) return order[i];
  return 6;
}
/* 주휴시간: 15시간 미만 0, 이상이면 (주시간 ÷ 40) × 8, 최대 8시간 */
function juhuHours(weeklyHours, rules) {
  var j = (rules && rules.weeklyHolidayPay) || { minWeeklyHours: 15, maxHours: 8, fullWeekHours: 40 };
  if (!(weeklyHours >= j.minWeeklyHours)) return 0;
  return Math.min(weeklyHours / j.fullWeekHours * j.maxHours, j.maxHours);
}
/* 한 주 계산 */
function weekCalc(st, wage, opt, rules) {
  opt = opt || {}; var p = rules.premium, ws = staffIntervals(st), hol = holidayFor(st);
  var all = [], byStart = {}, holMin = 0, nonHolMin = 0, total = 0;
  ws.forEach(function (w) { all = all.concat(w.ints); total += w.work; if (w.day === hol) holMin += w.work; else { nonHolMin += w.work; byStart[w.day] = (byStart[w.day] || 0) + w.work; } });
  var hours = total / 60, perDay = splitByDay(all).map(function (m) { return m / 60; });
  var dailyOT = 0; Object.keys(byStart).forEach(function (d) { dailyOT += Math.max(0, byStart[d] - p.dailyHours * 60); });
  var weeklyOT = Math.max(0, (nonHolMin - dailyOT) - p.weeklyHours * 60);
  var otH = (dailyOT + weeklyOT) / 60, nightH = nightMin(all, rules) / 60;
  var hol8 = Math.min(holMin, 480) / 60, holOver = Math.max(0, holMin - 480) / 60;
  var jh = juhuHours(hours, rules);
  var base = hours * wage, juhu = jh * wage;
  var prem = (otH * p.overtime + nightH * p.night + hol8 * p.holiday + holOver * p.holidayOver8) * wage;
  var five = !!opt.fivePlus;
  var weekly = base + juhu + (five ? prem : 0);
  var wpm = rules.weeksPerMonth;
  return {
    wage: wage, hours: hours, perDay: perDay, holiday: hol, juhuH: jh, otH: otH, nightH: nightH, hol8: hol8, holOver: holOver,
    base: base, juhu: juhu, premium: five ? prem : 0, premiumIfFive: prem, fivePlus: five,
    weekly: weekly, monthly: weekly * wpm, annual: weekly * wpm * 12, monthHours: hours * wpm,
    overnight: ws.some(function (w) { return w.overnight; }),
    breakShort: ws.filter(function (w) { return w.brk < breakRequired(w.work, rules); }).map(function (w) { return w.day; })
  };
}
function minWageFor(year, rules) { return num(rules.minWage[String(year)]); }
function wagesOf(st, store, rules) {
  var cur = num(store && store.currentWage); if (!(cur > 0)) cur = minWageFor(2026, rules);
  var now = num(st.wageNow); if (!(now > 0)) now = cur;
  var y27 = num(st.wage2027); if (!(y27 > 0)) y27 = Math.max(now, minWageFor(2027, rules));
  return { now: now, y27: y27, autoNow: !(num(st.wageNow) > 0), auto27: !(num(st.wage2027) > 0) };
}
function probationOk(st) { return !!(st && st.probation && st.probation.on && st.probation.year1 && st.probation.notSimple); }
function minWageCheck(wage, year, st, rules) {
  var min = minWageFor(year, rules), floor = min;
  if (year === 2027 && probationOk(st)) floor = Math.ceil(min * rules.probation.rate);
  return { ok: wage >= floor, min: min, floor: floor, short: Math.max(0, floor - wage), probation: floor !== min };
}
function fiveFlag(store) { return store && store.fivePlus === 'yes'; }
function insRate(store, year) {
  var ins = store && store.insurance; if (!ins || !ins.on) return null;
  var t = 0, n = 0; Object.keys(ins.rates || {}).forEach(function (k) { var v = num(ins.rates[k] && ins.rates[k][String(year)]); if (v >= 0 && v < 30) { t += v; n++; } });
  return n ? t / 100 : 0;
}
function insFor(calc, store, year, rules) {
  var r = insRate(store, year); if (r === null) return 0;
  if (calc.monthHours < rules.socialInsurance.monthlyHoursThreshold) return 0;
  return calc.monthly * r;
}
/* 매장 전체 계산 (staff·ownerShifts·shortPremium 덮어쓰기 가능) */
function storeCalc(store, rules, o) {
  o = o || {}; var staff = o.staff || store.staff || [], five = fiveFlag(store), prem = num(o.shortPremium != null ? o.shortPremium : store.shortPremium) || 0;
  var rows = [], t = { m26: 0, m27: 0, ins26: 0, ins27: 0, hours: 0, ifFive27: 0 };
  staff.forEach(function (st) {
    var wg = wagesOf(st, store, rules);
    var probe = weekCalc(st, wg.y27, { fivePlus: five }, rules);
    var w27 = wg.y27 + (prem > 0 && probe.hours > 0 && probe.hours < rules.weeklyHolidayPay.minWeeklyHours ? prem : 0);
    var c26 = weekCalc(st, wg.now, { fivePlus: five }, rules), c27 = w27 === wg.y27 ? probe : weekCalc(st, w27, { fivePlus: five }, rules);
    var i26 = insFor(c26, store, 2026, rules), i27 = insFor(c27, store, 2027, rules);
    var mw27 = minWageCheck(wg.y27, 2027, st, rules), mw26 = minWageCheck(wg.now, 2026, st, rules);
    var b = rules.boundaries, badges = [];
    if (c27.hours >= b.weekly[0] && c27.hours <= b.weekly[1]) badges.push('w15');
    if (c27.monthHours >= b.monthly[0] && c27.monthHours <= b.monthly[1]) badges.push('m60');
    var warn = [];
    if (!mw27.ok) warn.push('minwage');
    if (c27.breakShort.length) warn.push('break');
    if (c27.overnight || c27.nightH > 0) warn.push('night');
    if (five && c27.hours > rules.premium.weeklyMax) warn.push('w52');
    rows.push({ id: st.id, alias: st.alias, wage: wg, w27: w27, shortPrem: w27 - wg.y27, c26: c26, c27: c27, ins26: i26, ins27: i27, m26: c26.monthly + i26, m27: c27.monthly + i27, mw27: mw27, mw26: mw26, badges: badges, warn: warn });
    t.m26 += c26.monthly + i26; t.m27 += c27.monthly + i27; t.ins26 += i26; t.ins27 += i27; t.hours += c27.hours; t.ifFive27 += c27.premiumIfFive;
  });
  var head = staff.filter(function (s) { return (s.shifts || []).length; }).length, b = rules.boundaries;
  t.a26 = t.m26 * 12; t.a27 = t.m27 * 12; t.dm = t.m27 - t.m26; t.da = t.a27 - t.a26;
  t.pct = t.m26 > 0 ? t.dm / t.m26 * 100 : 0;
  t.ifFiveMonthly = five ? 0 : t.ifFive27 * rules.weeksPerMonth;
  return { rows: rows, t: t, head: head, fiveBadge: head >= b.headcount[0] && head <= b.headcount[1], five: five, fiveUnknown: store.fivePlus === 'unknown', shortPremium: prem, insOn: insRate(store, 2027) !== null };
}
/* 커버리지(15분 칸) — 휴게 포함 근무 구간 기준 */
function slots(staff, ownerShifts) {
  var set = {};
  function add(sh) { if (validateShift(sh).length) return; var sp = span(sh); if (!sp) return; for (var m = sh.day * 1440 + sp.s; m < sh.day * 1440 + sp.e; m += 15) set[Math.floor((m % WEEK) / 15)] = 1; }
  (staff || []).forEach(function (st) { (st.shifts || []).forEach(add); });
  (ownerShifts || []).forEach(add);
  return set;
}
function gapHours(origStaff, scen) {
  var a = slots(origStaff, []), b = slots(scen.staff, scen.ownerShifts), g = 0;
  Object.keys(a).forEach(function (k) { if (!b[k]) g++; });
  return g * 15 / 60;
}
function shiftsHours(list) { var t = 0; (list || []).forEach(function (sh) { if (validateShift(sh).length) return; var w = shiftWork(sh); if (w) t += w.span; }); return t / 60; }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
/* 대안 자동 제안: 쪼개기(기준 회피용 분할)는 만들지 않음 */
function genScenarios(store, rules) {
  var staff = clone(store.staff || []).filter(function (s) { return (s.shifts || []).length; }), out = [];
  var hrs = staff.map(function (s) { return { s: s, h: weekCalc(s, 1, {}, rules).hours }; }).sort(function (a, b) { return a.h - b.h; });
  /* A: 사장님 직접 근무 — 근무시간이 가장 짧은 자리를 사장님이 맡음 */
  if (hrs.length) {
    var tgt = hrs[0].s;
    out.push({ id: 'auto-owner', kind: 'owner', name: '사장님이 ' + tgt.alias + ' 시간 직접 근무', staff: staff.filter(function (s) { return s.id !== tgt.id; }), ownerShifts: clone(tgt.shifts) });
  } else out.push({ id: 'auto-owner', kind: 'owner', name: '사장님 직접 근무', na: '직원 근무가 없어 만들 수 없어요.', staff: [], ownerShifts: [] });
  /* B: 짧은 근무 두 자리 합치기 — 한 사람이 두 시간대를 모두 맡음(주휴 생김, 구인 쉬움) */
  var pair = null;
  for (var i = 0; i < hrs.length && !pair; i++) for (var j = i + 1; j < hrs.length && !pair; j++) {
    var m = { shifts: hrs[i].s.shifts.concat(hrs[j].s.shifts), alias: 'x' };
    if (!validateStaff(m, rules).some(function (e) { return /겹쳐요/.test(e.m); })) pair = [hrs[i].s, hrs[j].s];
  }
  if (pair) {
    var w1 = wagesOf(pair[0], store, rules), w2 = wagesOf(pair[1], store, rules);
    var merged = { id: 'merged-' + pair[0].id, alias: pair[0].alias + '+' + pair[1].alias + ' 합친 자리', wageNow: Math.max(w1.now, w2.now), wage2027: Math.max(w1.y27, w2.y27), probation: null, holiday: -1, shifts: clone(pair[0].shifts.concat(pair[1].shifts)) };
    out.push({ id: 'auto-merge', kind: 'merge', name: '두 자리를 한 사람이 맡기', staff: staff.filter(function (s) { return s.id !== pair[0].id && s.id !== pair[1].id; }).concat([merged]), ownerShifts: [] });
  } else out.push({ id: 'auto-merge', kind: 'merge', name: '두 자리를 한 사람이 맡기', na: hrs.length < 2 ? '직원이 2명 이상일 때 만들 수 있어요.' : '근무 시간이 겹쳐서 한 사람이 맡을 수 없어요.', staff: [], ownerShifts: [] });
  /* C: 피크 외 시간 축소 — 5시간 이상 근무의 마지막 1시간을 줄임(영업 공백이 생김) */
  var trimmed = 0, st3 = clone(staff);
  st3.forEach(function (s) { s.shifts.forEach(function (sh) { var w = shiftWork(sh); if (w && w.work >= 300) { sh.end = fmtMin(toMin(sh.end) - 60); trimmed++; } }); });
  if (trimmed) out.push({ id: 'auto-trim', kind: 'trim', name: '한산한 마감 1시간 줄이기', staff: st3, ownerShifts: [] });
  else out.push({ id: 'auto-trim', kind: 'trim', name: '한산한 마감 1시간 줄이기', na: '5시간 이상 근무가 없어 줄일 시간이 없어요.', staff: [], ownerShifts: [] });
  return out;
}
function compare(store, rules, scens) {
  var base = storeCalc(store, rules), list = [{ id: 'base', kind: 'base', name: '지금 근무표(원안)', calc: base, gap: 0, ownerH: 0 }];
  (scens || []).forEach(function (sc) {
    if (sc.na) { list.push({ id: sc.id, kind: sc.kind, name: sc.name, na: sc.na }); return; }
    var c = storeCalc(store, rules, { staff: sc.staff });
    list.push({ id: sc.id, kind: sc.kind, name: sc.name, calc: c, gap: gapHours(store.staff, sc), ownerH: shiftsHours(sc.ownerShifts), diffA: c.t.a27 - base.t.a27 });
  });
  return list;
}
/* 가격 역산 */
function pricing(deltaAnnual, p, store) {
  var ticket = num(p && p.avgTicket), margin = num(p && p.marginRate), sales = num(p && p.dailySales);
  var days = (store && store.openDays && store.openDays.length) || 7, dpy = days * 365 / 7, vat = !(p && p.vat === false);
  var errs = {};
  if (!(ticket > 0)) errs.avgTicket = '객단가(대표 메뉴 가격)를 원 단위로 적어 주세요.';
  if (!(margin > 0 && margin <= 100)) errs.marginRate = '마진율은 1~100 사이 %로 적어 주세요.';
  if (!(sales > 0)) errs.dailySales = '하루 판매량을 1 이상으로 적어 주세요.';
  if (Object.keys(errs).length) return { ok: false, errs: errs };
  if (!(deltaAnnual > 0)) return { ok: true, none: true, dpy: dpy };
  var vf = vat ? 1.1 : 1, perDay = deltaAnnual / dpy;
  var rawUp = perDay * vf / sales, up = Math.ceil(rawUp / 10) * 10;
  var unitProfit = ticket / vf * margin / 100, rawExtra = perDay / unitProfit, extra = Math.ceil(rawExtra);
  return { ok: true, perDay: perDay, dpy: dpy, rawUp: rawUp, up: up, rawExtra: rawExtra, extra: extra, unitProfit: unitProfit, vat: vat, pctUp: up / ticket * 100 };
}
/* 인상폭 x원 적용 시 상쇄율과 남는 하루 추가 판매량 */
function coverWith(up, deltaAnnual, p, store) {
  var r = pricing(deltaAnnual, p, store); if (!r.ok || r.none) return r;
  var vf = r.vat ? 1.1 : 1, gain = up / vf * num(p.dailySales) * r.dpy, left = Math.max(0, deltaAnnual - gain);
  return { pct: Math.min(100, gain / deltaAnnual * 100), left: left, extra: Math.ceil(left / r.dpy / r.unitProfit) };
}
function fmtWon(x) { return won(x).toLocaleString('ko-KR') + '원'; }
function fmtH(h) { var r = Math.round(h * 100) / 100; return (r % 1 ? r.toFixed(2).replace(/0$/, '') : String(r)) + '시간'; }
function man(x) { var v = Math.round(x / 1000) / 10; return v.toLocaleString('ko-KR') + '만 원'; }
function noticeText(row, store) {
  var nm = (store && store.name) || '우리 매장';
  return '[' + nm + '] ' + row.alias + '님, 2027년 시급 안내드려요.\n' +
    '· 2027년 1월 1일 근무분부터 시급: ' + fmtWon(row.wage.y27) + ' (2026년 ' + fmtWon(row.wage.now) + ')\n' +
    '· 2027 최저임금: 시간급 10,700원 (고용노동부 고시 제2026-60호)\n' +
    '· 지금 근무표 기준 주 ' + fmtH(row.c27.hours) + (row.c27.juhuH > 0 ? ', 주휴수당 포함' : '') + ' 예상 월 급여(세전): 약 ' + fmtWon(Math.round(row.c27.monthly / 10) * 10) + '\n' +
    '· 실제 급여는 근무한 시간에 따라 달라질 수 있어요. 바뀐 내용은 근로계약서에 적어 다시 드릴게요.\n' +
    '궁금한 점은 편하게 말씀해 주세요. 올해도 고맙습니다.';
}
function csv(store, calc) {
  var lines = [['월', '직원(별칭)', '주 근로시간', '2027 시급', '2027 월 인건비(원)', '사업주 4대보험 추정(원)', '2026 같은 근무 월(원)', '증가(원)']];
  for (var m = 1; m <= 12; m++) calc.rows.forEach(function (r) {
    lines.push(['2027-' + (m < 10 ? '0' : '') + m, r.alias, r2(r.c27.hours), r.w27, won(r.c27.monthly), won(r.ins27), won(r.m26), won(r.m27 - r.m26)]);
  });
  lines.push(['합계(12개월)', '', '', '', won(calc.t.a27 - calc.t.ins27 * 12), won(calc.t.ins27 * 12), won(calc.t.a26), won(calc.t.da)]);
  return '\ufeff' + lines.map(function (l) { return l.map(function (c) { var s = String(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }).join('\r\n');
}
/* 공유 카드 문구 — 직원 이름(별칭) 없음 */
function shareLines(calc, store) {
  return ['2027 인건비 리허설', '내년 인건비 ' + (calc.t.da >= 0 ? '+' : '−') + man(Math.abs(calc.t.da)) + ' / 년', '월 ' + man(calc.t.m26) + ' → ' + man(calc.t.m27), '직원 ' + calc.head + '명 · 주 ' + fmtH(calc.t.hours), '최저임금 10,700원 기준 · 참고용 계산'];
}
function pageTitle(h, app) {
  var t = String(h == null ? '' : h).replace(/\s+/g, ' ').trim();
  return (!t || t === app) ? app : t + ' — ' + app;
}
/* 가져오기 정리 */
function isTime(t) { return !isNaN(toMin(t)); }
function cleanShift(sh) {
  if (!sh || typeof sh !== 'object') return null;
  var d = Math.floor(num(sh.day)); if (!(d >= 0 && d <= 6) || !isTime(sh.start) || !isTime(sh.end)) return null;
  var b = num(sh.breakMin); b = b >= 0 && b <= 480 ? Math.round(b) : 0;
  return { day: d, start: fmtMin(toMin(sh.start)), end: fmtMin(toMin(sh.end)), breakMin: b };
}
function str(s, n) { return String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n || 30); }
function optNum(v) { var n = num(v); return n > 0 && n < 1000000 ? Math.round(n) : null; }
function cleanStaff(st, i) {
  if (!st || typeof st !== 'object') return null;
  var pr = st.probation && typeof st.probation === 'object' ? { on: !!st.probation.on, year1: !!st.probation.year1, notSimple: !!st.probation.notSimple } : null;
  var h = Math.floor(num(st.holiday));
  return { id: str(st.id || ('s' + i), 40), alias: str(st.alias, 20) || ('직원 ' + (i + 1)), wageNow: optNum(st.wageNow), wage2027: optNum(st.wage2027 != null ? st.wage2027 : st.wage), probation: pr, holiday: h >= 0 && h <= 6 ? h : -1, shifts: (Array.isArray(st.shifts) ? st.shifts : []).map(cleanShift).filter(Boolean).slice(0, 21) };
}
function cleanStore(s, i) {
  if (!s || typeof s !== 'object') return null;
  var ins = s.insurance && typeof s.insurance === 'object' ? s.insurance : {}, rates = {};
  Object.keys(ins.rates || {}).forEach(function (k) { if (!/^[a-z]{2,12}$/.test(k)) return; var o = ins.rates[k] || {}; rates[k] = {}; ['2026', '2027'].forEach(function (y) { var v = num(o[y]); rates[k][y] = v >= 0 && v < 30 ? v : null; }); });
  var p = s.pricing && typeof s.pricing === 'object' ? s.pricing : {};
  var days = Array.isArray(s.openDays) ? s.openDays.map(function (d) { return Math.floor(num(d)); }).filter(function (d, k, a) { return d >= 0 && d <= 6 && a.indexOf(d) === k; }) : [0, 1, 2, 3, 4, 5, 6];
  var chk = {}; Object.keys(s.checklist || {}).forEach(function (k) { if (/^[a-z0-9-]{1,20}$/.test(k)) chk[k] = !!s.checklist[k]; });
  return {
    id: str(s.id || ('st' + i), 40), name: str(s.name, 24) || '우리 매장', industry: str(s.industry, 20), fivePlus: ['no', 'yes', 'unknown'].indexOf(s.fivePlus) >= 0 ? s.fivePlus : 'no',
    currentWage: optNum(s.currentWage), openDays: days.length ? days : [0, 1, 2, 3, 4, 5, 6], example: !!s.example,
    staff: (Array.isArray(s.staff) ? s.staff : []).map(cleanStaff).filter(Boolean).slice(0, 30),
    scenarios: (Array.isArray(s.scenarios) ? s.scenarios : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, 6).map(function (x, k) { return { id: str(x.id || ('sc' + k), 40), kind: 'custom', name: str(x.name, 24) || '내 수정안', staff: (Array.isArray(x.staff) ? x.staff : []).map(cleanStaff).filter(Boolean), ownerShifts: (Array.isArray(x.ownerShifts) ? x.ownerShifts : []).map(cleanShift).filter(Boolean) }; }),
    shortPremium: Math.max(0, Math.min(3000, Math.round(num(s.shortPremium) || 0))),
    pricing: { avgTicket: optNum(p.avgTicket), marginRate: num(p.marginRate) > 0 && num(p.marginRate) <= 100 ? num(p.marginRate) : null, dailySales: optNum(p.dailySales), vat: p.vat !== false, menu: str(p.menu, 20) },
    insurance: { on: !!ins.on, rates: rates }, checklist: chk, updatedAt: str(s.updatedAt, 30)
  };
}
function sanitizeImport(o) {
  if (!o || typeof o !== 'object' || o.app !== 'labor-cost-rehearsal-2027' || !Array.isArray(o.stores)) return null;
  var stores = o.stores.map(cleanStore).filter(Boolean).slice(0, 20);
  return stores.length ? { stores: stores, activeId: stores.some(function (s) { return s.id === o.activeId; }) ? o.activeId : stores[0].id } : null;
}
function selfTest(rules) {
  var res = [];
  function eq(name, a, b) { var ok = typeof b === 'number' ? Math.abs(a - b) < 1e-6 : JSON.stringify(a) === JSON.stringify(b); res.push({ name: name, pass: ok, got: a, want: b }); }
  var R = rules, mk = function (shifts, o) { var s = { id: 't', alias: 't', shifts: shifts }; for (var k in o) s[k] = o[k]; return s; };
  eq('minWage 2026', R.minWage['2026'], 10320); eq('minWage 2027', R.minWage['2027'], 10700);
  eq('juhu <15h = 0', juhuHours(14.75, R), 0); eq('juhu 15h = 3h', juhuHours(15, R), 3); eq('juhu 20h = 4h', juhuHours(20, R), 4); eq('juhu 40h = 8h', juhuHours(40, R), 8); eq('juhu 45h cap 8h', juhuHours(45, R), 8);
  var c = weekCalc(mk([0, 2, 4].map(function (d) { return { day: d, start: '10:00', end: '14:00', breakMin: 0 }; })), 10700, {}, R);
  eq('12h/week weekly pay', c.weekly, 128400); eq('12h monthly', c.monthly, 557898);
  c = weekCalc(mk([0, 1, 2, 3, 4].map(function (d) { return { day: d, start: '10:00', end: '14:30', breakMin: 30 }; })), 10700, {}, R);
  eq('20h hours', c.hours, 20); eq('20h juhu pay', c.juhu, 42800); eq('20h weekly', c.weekly, 256800);
  var night = mk([{ day: 4, start: '22:00', end: '06:00', breakMin: 60 }]);
  c = weekCalc(night, 10700, { fivePlus: true }, R);
  eq('overnight hours 7', c.hours, 7); eq('night hours 7', c.nightH, 7); eq('split Fri 2h / Sat 5h', [c.perDay[4], c.perDay[5]], [2, 5]); eq('night premium 5+', c.premium, 37450);
  c = weekCalc(night, 10700, { fivePlus: false }, R); eq('night premium <5 = 0', c.premium, 0); eq('premiumIfFive kept', c.premiumIfFive, 37450);
  var six = mk([0, 1, 2, 3, 4, 5].map(function (d) { return { day: d, start: '09:00', end: '17:00', breakMin: 30 }; }));
  c = weekCalc(six, 10700, { fivePlus: true }, R); eq('45h OT 5h', c.otH, 5); eq('45h OT premium', c.premium, 26750);
  c = weekCalc(six, 10700, { fivePlus: false }, R); eq('45h <5 no OT premium', c.premium, 0);
  var hol = mk([{ day: 6, start: '10:00', end: '20:00', breakMin: 60 }], { holiday: 6 });
  c = weekCalc(hol, 10700, { fivePlus: true }, R); eq('holiday 9h: 8×50% + 1×100%', c.premium, 53500);
  eq('suggestBreak 3h45m', suggestBreak(225, R), 0); eq('suggestBreak 4h span → 30', suggestBreak(240, R), 30); eq('suggestBreak 5h', suggestBreak(300, R), 30); eq('suggestBreak 9h', suggestBreak(540, R), 60);
  eq('pageTitle same', pageTitle('2027 인건비 리허설', '2027 인건비 리허설'), '2027 인건비 리허설'); eq('pageTitle other', pageTitle('결과', 'A'), '결과 — A');
  var pr = pricing(3000000, { avgTicket: 4500, marginRate: 60, dailySales: 120, vat: true }, { openDays: [0, 1, 2, 3, 4, 5] });
  eq('pricing up 90원', pr.up, 90); eq('pricing extra 4/day', pr.extra, 4);
  var pass = res.filter(function (r) { return r.pass; }).length;
  return { pass: pass, fail: res.length - pass, total: res.length, results: res };
}
return { invalidCount: invalidCount, DAY: DAY, num: num, toMin: toMin, fmtMin: fmtMin, span: span, breakRequired: breakRequired, suggestBreak: suggestBreak, validateShift: validateShift, validateStaff: validateStaff, shiftWork: shiftWork, splitByDay: splitByDay, nightMin: nightMin, holidayFor: holidayFor, juhuHours: juhuHours, weekCalc: weekCalc, wagesOf: wagesOf, minWageFor: minWageFor, minWageCheck: minWageCheck, probationOk: probationOk, insRate: insRate, storeCalc: storeCalc, slots: slots, gapHours: gapHours, shiftsHours: shiftsHours, genScenarios: genScenarios, compare: compare, pricing: pricing, coverWith: coverWith, fmtWon: fmtWon, fmtH: fmtH, man: man, noticeText: noticeText, csv: csv, shareLines: shareLines, pageTitle: pageTitle, cleanStore: cleanStore, cleanStaff: cleanStaff, cleanShift: cleanShift, sanitizeImport: sanitizeImport, selfTest: selfTest };
});
