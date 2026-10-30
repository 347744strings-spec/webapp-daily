/* 방문조사 7일 노트 — 계산 규칙 (UMD: 브라우저 window.VisitRules, node require)
   등급·점수 예측 기능 없음. 금액·기한은 data/*.json 값과 법정 규칙만 사용. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.VisitRules = f(); })(this, function () {
'use strict';
var APP_ID = 'visit-assessment-7day-note';
var WD = ['일', '월', '화', '수', '목', '금', '토'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
/* ---------- 날짜 (YYYY-MM-DD, 달력 날짜만 — 시간대 영향 없음) ---------- */
function parseD(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
  return { y: y, m: mo, d: d };
}
function isD(s) { return !!parseD(s); }
function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function toD(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
function ms(s) { var p = parseD(s); return Date.UTC(p.y, p.m - 1, p.d); }
function fromMs(t) { var x = new Date(t); return toD(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function addDays(s, n) { return fromMs(ms(s) + n * 86400000); }
/* 월 더하기: 없는 날짜는 그 달 말일로 (예: 11/30 + 3개월 = 2/28) */
function addMonths(s, n) { var p = parseD(s), t = p.m - 1 + n, y = p.y + Math.floor(t / 12), m = ((t % 12) + 12) % 12 + 1; return toD(y, m, Math.min(p.d, dim(y, m))); }
function diffDays(a, b) { return Math.round((ms(b) - ms(a)) / 86400000); }
function dow(s) { return new Date(ms(s)).getUTCDay(); }
function today(now) { var d = now || new Date(); return toD(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
function fmtD(s) { var p = parseD(s); return p ? p.y + '년 ' + p.m + '월 ' + p.d + '일(' + WD[dow(s)] + ')' : ''; }
function fmtS(s) { var p = parseD(s); return p ? p.m + '/' + p.d + '(' + WD[dow(s)] + ')' : ''; }
function dLabel(from, to) { var n = diffDays(from, to); return n === 0 ? 'D-day' : n > 0 ? 'D-' + n : 'D+' + (-n); }
function isTime(t) { var m = /^(\d{2}):(\d{2})$/.exec(String(t || '')); return !!m && +m[1] < 24 && +m[2] < 60; }
/* ---------- 기한 ---------- */
/* 노인장기요양보험법 제16조①: 신청서 제출일부터 30일 이내(부득이하면 30일 이내 연장). 초일 불산입(민법 제157조) 적용. */
function decisionDates(apply, L) {
  if (!isD(apply)) return null; var g = (L && L.legal) || { decisionDays: 30, decisionExtDays: 30 };
  return { d30: addDays(apply, g.decisionDays), d60: addDays(apply, g.decisionDays + g.decisionExtDays) };
}
/* 제55조②: 처분이 있음을 안 날부터 90일 이내, 처분이 있은 날부터 180일 경과 시 불가. 둘 중 이른 날이 마감. */
function appealDeadline(known, disp, L) {
  if (!isD(known)) return null; var g = (L && L.legal) || { appealDays: 90, appealMaxDays: 180 };
  var d90 = addDays(known, g.appealDays), d180 = isD(disp) ? addDays(disp, g.appealMaxDays) : null;
  var by180 = !!(d180 && d180 < d90), fin = by180 ? d180 : d90, w = dow(fin);
  return { d90: d90, d180: d180, final: fin, by: by180 ? 180 : 90, weekend: w === 0 || w === 6 };
}
/* 재신청 검토일: 관행(법정 기준 아님) */
function reapplyDate(base, L) { if (!isD(base)) return null; return addMonths(base, (L && L.legal && L.legal.reapplyMonths) || 3); }
/* ---------- 비용 ---------- */
function won(n) { return Math.round(n).toLocaleString('en-US') + '원'; }
function rateOf(type, L) { var t = (L.copayTypes || []).filter(function (x) { return x.id === type; })[0]; return t ? t.rate : null; }
function limitOf(grade, L) { var v = L.monthlyLimit[String(grade)]; return typeof v === 'number' ? v : null; }
/* 월 한도액 안에서는 본인부담률, 넘는 금액은 전액 본인부담(법 제40조③, 고시 제13조⑥). 원 미만 반올림. */
function copay(limit, rate, usage) {
  var max = Math.round(limit * rate);
  if (usage == null || usage === '' || !isFinite(usage)) return { limit: limit, rate: rate, max: max, usage: null };
  var u = Math.max(0, Math.round(+usage)), inL = Math.min(u, limit), over = Math.max(0, u - limit), c = Math.round(inL * rate);
  return { limit: limit, rate: rate, max: max, usage: u, inLimit: inL, over: over, copayIn: c, copay: c + over, nhis: inL - c };
}
function costTable(L) {
  return L.gradeOrder.map(function (g) {
    var lim = L.monthlyLimit[g];
    return { grade: g, label: L.gradeLabel[g], limit: lim, byType: L.copayTypes.map(function (t) { return { id: t.id, rate: t.rate, max: Math.round(lim * t.rate) }; }) };
  });
}
/* ---------- 기록 집계 ---------- */
function findItem(D, itemId) {
  for (var i = 0; i < D.domains.length; i++) for (var j = 0; j < D.domains[i].items.length; j++) if (D.domains[i].items[j].id === itemId) return { domain: D.domains[i], item: D.domains[i].items[j] };
  return null;
}
function windowOf(end) { return { start: addDays(end, -6), end: end }; }
function inWin(l, w) { return l.date >= w.start && l.date <= w.end; }
function summarize(logs, end, D) {
  var w = windowOf(end), list = (logs || []).filter(function (l) { return inWin(l, w); });
  var days = {}, doms = D.domains.map(function (d) { return { id: d.id, label: d.label, icon: d.icon, n: 0, items: [] }; });
  var risks = [], tags = { usual: 0, good: 0, bad: 0 };
  list.forEach(function (l) {
    var f = findItem(D, l.item); if (!f) return;
    days[l.date] = (days[l.date] || 0) + 1; tags[l.dayTag] = (tags[l.dayTag] || 0) + 1;
    var dm = doms.filter(function (x) { return x.id === f.domain.id; })[0]; dm.n++;
    var it = dm.items.filter(function (x) { return x.id === l.item; })[0];
    if (!it) { it = { id: l.item, label: f.item.label, vague: f.item.vague, n: 0, dist: [0, 0, 0, 0], days: {}, bad: 0, good: 0 }; dm.items.push(it); }
    it.n++; it.dist[l.help]++; it.days[l.date] = 1; if (l.dayTag === 'bad') it.bad++; if (l.dayTag === 'good') it.good++;
    (l.risk || []).forEach(function (r) { risks.push({ date: l.date, slot: l.slot, risk: r, item: f.item.label, note: l.note || '' }); });
  });
  var order = (D.slots || []).map(function (s) { return s.id; });
  risks.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : order.indexOf(a.slot) - order.indexOf(b.slot); });
  doms.forEach(function (dm) {
    var ord = (D.domains.filter(function (x) { return x.id === dm.id; })[0] || { items: [] }).items.map(function (x) { return x.id; });
    dm.items.forEach(function (it) { it.dayCount = Object.keys(it.days).length; it.modes = modes(it.dist); });
    dm.items.sort(function (a, b) { return ord.indexOf(a.id) - ord.indexOf(b.id); });
  });
  return { start: w.start, end: w.end, total: list.length, dayCount: Object.keys(days).length, days: days, domains: doms, risks: risks, tags: tags };
}
function modes(dist) { var mx = Math.max.apply(null, dist); if (!mx) return []; var r = []; for (var i = 3; i >= 0; i--) if (dist[i] === mx) r.push(i); return r; }
function distText(dist, D) { var r = []; for (var i = 3; i >= 0; i--) if (dist[i]) r.push(D.help[i].short + ' ' + dist[i]); return r.join(' · '); }
function modeText(it, D) {
  if (!it.modes.length) return '';
  if (it.modes.length === 1) return '주로 ' + D.help[it.modes[0]].label;
  return it.modes.map(function (m) { return D.help[m].label; }).join('·') + ' 각 ' + it.dist[it.modes[0]] + '회';
}
/* 브리핑 문장: "화장실 — 7일 중 5일, 6회 · 주로 준비·일부 도움 (전적 도움 1 · 일부 도움 4 · 혼자 1) · 나쁜 날 2회" */
function itemLine(it, D) {
  return it.label + ' — 7일 중 ' + it.dayCount + '일, ' + it.n + '회 · ' + modeText(it, D) + ' (' + distText(it.dist, D) + ')' + (it.bad ? ' · 나쁜 날 ' + it.bad + '회' : '');
}
function riskLabel(id, D) { var r = D.risks.filter(function (x) { return x.id === id; })[0]; return r ? r.label : id; }
function slotLabel(id, D) { var s = D.slots.filter(function (x) { return x.id === id; })[0]; return s ? s.label : ''; }
function slotOf(hour, D) { var r = D.slots[0].id; D.slots.forEach(function (s) { if (hour >= s.from) r = s.id; }); return r; }
/* 모호한 말 → 기록 기반 구체 문장 (AI 없음, 정적 템플릿) */
function concrete(it, D) {
  var helped = it.n - it.dist[0], top = it.modes.length ? D.help[it.modes[0]].label : '';
  if (helped === 0) return '최근 7일 동안 ' + it.label + ' ' + it.n + '회 기록, 모두 혼자 하셨어요.';
  return '최근 7일 동안 ' + it.label + ' ' + it.n + '회 중 ' + helped + '회는 도움이 필요했어요(주로 ' + top + ')' + (it.bad ? ', 나쁜 날이 ' + it.bad + '회' : '') + '.';
}
function briefLines(sum, D) {
  var out = [];
  sum.domains.forEach(function (dm) { dm.items.forEach(function (it) { out.push({ domain: dm.label, text: itemLine(it, D) }); }); });
  return out;
}
/* ---------- 이의신청(심사청구) 초안 ---------- */
function appealDraft(p, sum, dl, D, care) {
  var L = [];
  L.push('[장기요양 심사청구 — 취지와 이유 초안 · 가족 작성 참고용]');
  L.push('');
  L.push('■ 청구 취지');
  L.push('국민건강보험공단의 장기요양등급 판정(등급외) 처분에 이의가 있어, 신청인의 평소 상태를 다시 살펴 심사해 주실 것을 청구합니다.');
  L.push('');
  L.push('■ 청구 이유');
  var n = 1;
  if (dl) L.push((n++) + '. 결과 통지를 받은 날은 ' + fmtD(p.resultDate) + '입니다. (노인장기요양보험법 제55조: 안 날부터 90일 이내)');
  L.push((n++) + '. 신청인(' + (p.alias || '가족') + ', ' + (p.ageLabel || '') + ')은 ' + fmtD(sum.start) + '부터 ' + fmtD(sum.end) + '까지 가족이 기록한 결과, 다음과 같이 일상생활에서 다른 사람의 도움이 필요했습니다.');
  var any = false;
  sum.domains.forEach(function (dm) { dm.items.forEach(function (it) { if (it.n - it.dist[0] > 0 || dm.id === 'mind') { any = true; L.push('   - ' + itemLine(it, D)); } }); });
  if (!any) L.push('   - (기록에서 도움이 필요했던 항목이 아직 없어요. 기록을 더 남기면 이곳이 채워져요.)');
  if (sum.risks.length) {
    L.push((n++) + '. 같은 기간 위험 사건이 ' + sum.risks.length + '건 있었습니다.');
    sum.risks.forEach(function (r) { L.push('   - ' + fmtS(r.date) + ' ' + slotLabel(r.slot, D) + ' ' + riskLabel(r.risk, D) + (r.note ? ' (' + r.note + ')' : '')); });
  }
  if (sum.tags.good || sum.tags.bad) L.push((n++) + '. 기록상 좋은 날 ' + (sum.tags.good || 0) + '회, 나쁜 날 ' + (sum.tags.bad || 0) + '회로 상태 차이가 있어, 방문조사 당일 모습이 평소와 달랐을 수 있습니다.');
  if (care && care.alone) L.push((n++) + '. 혼자 지내는 시간: ' + care.alone + (care.caregiver ? ', 주 돌봄자: ' + care.caregiver : '') + '.');
  L.push((n++) + '. 첨부(있는 것만): 7일 생활기록(가족 작성 · 공단 공식 양식 아님), 복용약 목록, 진단서·입퇴원 기록.');
  L.push('');
  L.push('※ 이 초안은 가족 기록을 정리한 참고 문서이며 법률 자문이 아닙니다. 제출 방법·양식은 국민건강보험공단(☎ 1577-1000)에 확인하세요.');
  return L.join('\n');
}
/* ---------- .ics (RFC 5545) ---------- */
function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function fold(line) {
  var out = [], cur = '', bytes = 0;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i], b = unescape(encodeURIComponent(ch)).length, lim = out.length ? 74 : 75;
    if (bytes + b > lim) { out.push(cur); cur = ''; bytes = 0; lim = 74; }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join('\r\n ');
}
function ics(events, now) {
  var n = now || new Date();
  var st = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + pad(n.getUTCSeconds()) + 'Z';
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//' + APP_ID + '//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:방문조사 7일 노트'];
  events.forEach(function (e) {
    var d = e.date.replace(/-/g, '');
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '-' + d + '@' + APP_ID, 'DTSTAMP:' + st);
    if (e.time && isTime(e.time)) { var t = e.time.replace(':', '') + '00'; L.push('DTSTART:' + d + 'T' + t, 'DURATION:PT1H'); }
    else L.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''));
    L.push('SUMMARY:' + icsEsc(e.title));
    if (e.desc) L.push('DESCRIPTION:' + icsEsc(e.desc));
    (e.alarms || []).forEach(function (a) { L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:-P' + a + 'D', 'END:VALARM'); });
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
/* ---------- 데이터 정리·병합 ---------- */
function str(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function cleanLog(l, D) {
  if (!l || typeof l !== 'object') return null;
  var f = findItem(D, l.item); if (!f) return null;
  var h = Number(l.help); if (!(h === 0 || h === 1 || h === 2 || h === 3)) return null;
  if (!isD(l.date)) return null;
  var slots = D.slots.map(function (s) { return s.id; }), rk = D.risks.map(function (r) { return r.id; }), tg = D.dayTags.map(function (t) { return t.id; });
  var risk = Array.isArray(l.risk) ? l.risk.filter(function (r, i, a) { return rk.indexOf(r) >= 0 && a.indexOf(r) === i; }) : [];
  return {
    id: /^[\w-]{1,64}$/.test(String(l.id || '')) ? String(l.id) : 'l-' + Math.random().toString(36).slice(2, 10),
    date: l.date, slot: slots.indexOf(l.slot) >= 0 ? l.slot : 'day', domain: f.domain.id, item: f.item.id, help: h, risk: risk,
    dayTag: tg.indexOf(l.dayTag) >= 0 ? l.dayTag : 'usual', note: str(l.note, 60),
    author: D.authors.indexOf(l.author) >= 0 ? l.author : '다른 가족', ts: str(l.ts, 30)
  };
}
var PROXY = ['self', 'family', 'official', 'designated'];
function cleanProfile(p, D, L) {
  p = p && typeof p === 'object' ? p : {};
  var ids = function (a) { return a.map(function (x) { return x.id; }); };
  return {
    alias: D.aliases.indexOf(p.alias) >= 0 ? p.alias : '',
    ageBand: ids(D.ageBands).indexOf(p.ageBand) >= 0 ? p.ageBand : '',
    stage: ids(D.stages).indexOf(p.stage) >= 0 ? p.stage : '',
    proxy: PROXY.indexOf(p.proxy) >= 0 ? p.proxy : 'family',
    applyDate: isD(p.applyDate) ? p.applyDate : '', visitDate: isD(p.visitDate) ? p.visitDate : '', visitTime: isTime(p.visitTime) ? p.visitTime : '',
    resultDate: isD(p.resultDate) ? p.resultDate : '', dispDate: isD(p.dispDate) ? p.dispDate : '',
    grade: L && (p.grade === 'none' || L.gradeOrder.indexOf(String(p.grade)) >= 0) ? String(p.grade) : '',
    copayType: L && rateOf(p.copayType, L) != null ? p.copayType : 'normal',
    author: D.authors.indexOf(p.author) >= 0 ? p.author : '나'
  };
}
function cleanCare(c, D) {
  c = c && typeof c === 'object' ? c : {};
  var meds = Array.isArray(c.meds) ? c.meds.map(function (m) { return m && typeof m === 'object' ? { name: str(m.name, 30), when: str(m.when, 30) } : null; }).filter(function (m) { return m && m.name; }).slice(0, 30) : [];
  return { meds: meds, caregiver: D.caregivers.indexOf(c.caregiver) >= 0 ? c.caregiver : '', alone: D.aloneHours.indexOf(c.alone) >= 0 ? c.alone : '', memo: str(c.memo, 400) };
}
function sanitizeImport(o, D, L) {
  if (!o || typeof o !== 'object' || o.app !== APP_ID || o.version !== 1 || !Array.isArray(o.logs)) return null;
  var logs = o.logs.slice(0, 3000).map(function (l) { return cleanLog(l, D); }).filter(Boolean);
  var ck = {}; if (o.checklist && typeof o.checklist === 'object') D.checklist.forEach(function (c) { if (o.checklist[c.id] === true) ck[c.id] = true; });
  return { profile: cleanProfile(o.profile, D, L), logs: logs, checklist: ck, care: cleanCare(o.care, D), skipped: o.logs.length - logs.length };
}
function sig(l) { return [l.date, l.slot, l.item, l.help, (l.risk || []).slice().sort().join('+'), l.dayTag, l.note, l.author].join('|'); }
/* 형제자매 기록 합치기: 같은 id 또는 같은 내용이면 한 번만 */
function mergeLogs(local, inc) {
  var ids = {}, sigs = {}, out = local.slice(), added = 0, dup = 0;
  local.forEach(function (l) { ids[l.id] = 1; sigs[sig(l)] = 1; });
  inc.forEach(function (l) { if (ids[l.id] || sigs[sig(l)]) { dup++; return; } ids[l.id] = 1; sigs[sig(l)] = 1; out.push(l); added++; });
  out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { logs: out, added: added, dup: dup };
}
function mergeAll(cur, inc) {
  var m = mergeLogs(cur.logs, inc.logs), p = {}, k;
  for (k in cur.profile) p[k] = cur.profile[k];
  for (k in inc.profile) if ((p[k] === '' || p[k] == null) && inc.profile[k]) p[k] = inc.profile[k];
  var ck = {}; for (k in cur.checklist) ck[k] = cur.checklist[k]; for (k in inc.checklist) if (inc.checklist[k]) ck[k] = true;
  var care = { meds: cur.care.meds.slice(), caregiver: cur.care.caregiver || inc.care.caregiver, alone: cur.care.alone || inc.care.alone, memo: cur.care.memo || inc.care.memo };
  var names = {}; care.meds.forEach(function (x) { names[x.name.toLowerCase()] = 1; });
  inc.care.meds.forEach(function (x) { if (!names[x.name.toLowerCase()]) { names[x.name.toLowerCase()] = 1; care.meds.push(x); } });
  return { profile: p, logs: m.logs, checklist: ck, care: care, added: m.added, dup: m.dup };
}
function pageTitle(h, app) { var t = String(h == null ? '' : h).replace(/\s+/g, ' ').trim(); return (!t || t === app) ? app : t + ' — ' + app; }
function todoFor(date, list) { return list[((Math.floor(ms(date) / 86400000) % list.length) + list.length) % list.length]; }
/* ---------- 자체 점검 (손계산 값) ---------- */
function selfTest(D, L) {
  var res = [];
  function eq(name, got, exp) { res.push({ name: name, pass: JSON.stringify(got) === JSON.stringify(exp), got: got, exp: exp }); }
  eq('90일: 11/2 → 2027-01-31', appealDeadline('2026-11-02', '', L).d90, '2027-01-31');
  eq('90일 말일: 11/30 → 2027-02-28', appealDeadline('2026-11-30', '', L).d90, '2027-02-28');
  eq('90일 윤년: 2027-12-01 → 2028-02-29', appealDeadline('2027-12-01', '', L).d90, '2028-02-29');
  eq('90일 연말: 12/31 → 2027-03-31', appealDeadline('2026-12-31', '', L).d90, '2027-03-31');
  var a = appealDeadline('2027-01-05', '2026-10-01', L);
  eq('180일 우선: 처분 10/1 → 2027-03-30', [a.d180, a.final, a.by], ['2027-03-30', '2027-03-30', 180]);
  eq('주말 마감 표시(2027-01-31 일)', appealDeadline('2026-11-02', '', L).weekend, true);
  eq('판정 30일 원칙/60일', decisionDates('2026-10-20', L), { d30: '2026-11-19', d60: '2026-12-19' });
  eq('재신청 3개월 말일 보정', [reapplyDate('2026-11-30', L), reapplyDate('2027-11-30', L), reapplyDate('2026-08-31', L)], ['2027-02-28', '2028-02-29', '2026-11-30']);
  eq('한도 1등급', limitOf('1', L), 2512900);
  eq('한도 인지지원', limitOf('cognitive', L), 676320);
  eq('1등급 15/9/6/0%', ['normal', 'cut40', 'cut60', 'basic'].map(function (t) { return copay(2512900, rateOf(t, L)).max; }), [376935, 226161, 150774, 0]);
  eq('인지지원 9%·6% 반올림', [copay(676320, 0.09).max, copay(676320, 0.06).max], [60869, 40579]);
  var c = copay(1528200, 0.15, 1800000);
  eq('3등급 한도 초과 180만 15%', [c.copayIn, c.over, c.copay], [229230, 271800, 501030]);
  eq('3등급 100만 15% (한도 안)', copay(1528200, 0.15, 1000000).copay, 150000);
  eq('기초 0% 초과분만', copay(1528200, 0, 1800000).copay, 271800);
  var logs = [{ id: 'a', date: '2026-10-30', slot: 'night', item: 'toilet', help: 2, risk: ['fall'], dayTag: 'bad', note: '', author: '나' },
    { id: 'b', date: '2026-10-29', slot: 'morning', item: 'toilet', help: 3, risk: [], dayTag: 'usual', note: '', author: '나' },
    { id: 'c', date: '2026-10-29', slot: 'day', item: 'toilet', help: 2, risk: [], dayTag: 'usual', note: '', author: '나' },
    { id: 'd', date: '2026-10-23', slot: 'day', item: 'toilet', help: 0, risk: [], dayTag: 'good', note: '', author: '나' }];
  var s = summarize(logs, '2026-10-30', D), t = s.domains[0].items[0];
  eq('7일 창(10/24~10/30) 밖 제외', [s.start, s.total, t.n, t.dayCount], ['2026-10-24', 3, 3, 2]);
  eq('주 도움 수준', itemLine(t, D), '화장실 — 7일 중 2일, 3회 · 주로 준비·일부 도움 (전적 도움 1 · 일부 도움 2) · 나쁜 날 1회');
  eq('위험 사건', [s.risks.length, s.risks[0].risk], [1, 'fall']);
  var m = mergeLogs(logs.slice(0, 2), [logs[1], Object.assign({}, logs[2]), Object.assign({}, logs[0], { id: 'zz' })]);
  eq('병합: id·내용 중복 제거', [m.added, m.dup, m.logs.length], [1, 2, 3]);
  eq('제목 중복 없음', [pageTitle('방문조사 7일 노트', '방문조사 7일 노트'), pageTitle('브리핑', 'A'), pageTitle('', 'A')], ['방문조사 7일 노트', '브리핑 — A', 'A']);
  var ic = ics([{ id: 'x', date: '2027-01-31', title: '이의신청 마감, 꼭 확인', alarms: [7] }], new Date(Date.UTC(2026, 9, 30)));
  eq('ics 종일·알림·이스케이프', [/DTSTART;VALUE=DATE:20270131/.test(ic), /DTEND;VALUE=DATE:20270201/.test(ic), /TRIGGER:-P7D/.test(ic), /마감\\, 꼭/.test(ic)], [true, true, true, true]);
  eq('ics 줄 길이 ≤75바이트', ic.split('\r\n').every(function (x) { return unescape(encodeURIComponent(x)).length <= 75; }), true);
  eq('가져오기: 다른 앱 거부', sanitizeImport({ app: 'x', version: 1, logs: [] }, D, L), null);
  var pass = res.filter(function (r) { return r.pass; }).length;
  return { pass: pass, fail: res.length - pass, total: res.length, results: res };
}
return { APP_ID: APP_ID, WD: WD, parseD: parseD, isD: isD, addDays: addDays, addMonths: addMonths, diffDays: diffDays, dow: dow, today: today, fmtD: fmtD, fmtS: fmtS, dLabel: dLabel, isTime: isTime,
  decisionDates: decisionDates, appealDeadline: appealDeadline, reapplyDate: reapplyDate, won: won, rateOf: rateOf, limitOf: limitOf, copay: copay, costTable: costTable,
  findItem: findItem, windowOf: windowOf, summarize: summarize, modes: modes, distText: distText, modeText: modeText, itemLine: itemLine, riskLabel: riskLabel, slotLabel: slotLabel, slotOf: slotOf,
  concrete: concrete, briefLines: briefLines, appealDraft: appealDraft, ics: ics, cleanLog: cleanLog, cleanProfile: cleanProfile, cleanCare: cleanCare, sanitizeImport: sanitizeImport,
  mergeLogs: mergeLogs, mergeAll: mergeAll, sig: sig, pageTitle: pageTitle, todoFor: todoFor, selfTest: selfTest };
});
