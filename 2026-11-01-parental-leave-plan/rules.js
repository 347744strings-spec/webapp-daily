/* 우리 육휴 설계도 — 계산 규칙 (UMD: window.LeaveRules / require) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.LeaveRules = f(); })(this, function () {
'use strict';
var APP_ID = 'parental-leave-plan';
var WD = ['일', '월', '화', '수', '목', '금', '토'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
function parseD(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; var y = +m[1], mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null; return { y: y, m: mo, d: d }; }
function isD(s) { return !!parseD(s); }
function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function toD(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
function ms(s) { var p = parseD(s); return Date.UTC(p.y, p.m - 1, p.d); }
function fromMs(t) { var x = new Date(t); return toD(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function addDays(s, n) { return fromMs(ms(s) + n * 86400000); }
function addMonths(s, n) { var p = parseD(s), t = p.y * 12 + (p.m - 1) + n, y = Math.floor(t / 12), m = t % 12 + 1; return toD(y, m, Math.min(p.d, dim(y, m))); }
function diffDays(a, b) { return Math.round((ms(b) - ms(a)) / 86400000); }
function dow(s) { return new Date(ms(s)).getUTCDay(); }
function today(now) { var d = now || new Date(); return toD(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
function fmtD(s) { var p = parseD(s); return p ? p.y + '. ' + p.m + '. ' + p.d + '.(' + WD[dow(s)] + ')' : ''; }
function fmtShort(s) { var p = parseD(s); return p ? String(p.y).slice(2) + '.' + pad(p.m) + '.' + pad(p.d) : ''; }
function won(n) { return Math.round(n).toLocaleString('en-US') + '원'; }
function man(n) { var v = Math.round(n / 1000) / 10; return (Math.round(v * 10) / 10).toLocaleString('en-US') + '만원'; }
function num(n) { return Math.round(n).toLocaleString('en-US'); }
function parseWon(s) {
  var t = String(s == null ? '' : s).replace(/[\s,원]/g, ''); if (!t) return NaN;
  var m = /^(\d+(?:\.\d+)?)만$/.exec(t); if (m) return Math.round(parseFloat(m[1]) * 10000);
  return /^\d+$/.test(t) ? +t : NaN;
}
function r3(x) { return Math.round(x * 1000) / 1000; }
/* 한 블록을 '개월째' 단위로 자르기: 시작일부터 한 달씩, 마지막 부분 월은 그 부분이 시작한 날부터 한 달 일수로 일할 */
function periods(b) {
  var out = [], p = b.start;
  while (p <= b.end) {
    var next = addMonths(p, 1), full = addDays(next, -1);
    if (full <= b.end) { out.push({ start: p, end: full, days: diffDays(p, next), frac: 1 }); p = next; }
    else { var days = diffDays(p, b.end) + 1, den = diffDays(p, next); out.push({ start: p, end: b.end, days: days, den: den, frac: days / den }); break; }
  }
  return out;
}
function validBlocks(par) { return (par.blocks || []).filter(function (b) { return isD(b.start) && isD(b.end) && b.end >= b.start; }).slice().sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; }); }
function units(par) {
  var c = 0, out = [];
  validBlocks(par).forEach(function (b, bi) { periods(b).forEach(function (u) { u.block = b; u.bi = bi; u.c0 = c; c += u.frac; u.c1 = c; out.push(u); }); });
  return out;
}
function totalMonths(par) { var u = units(par); return u.length ? u[u.length - 1].c1 : 0; }
function deadline18(birth) { return addDays(addMonths(birth, 18), -1); }
function rowFor(table, k) { for (var i = 0; i < table.length; i++) if (k >= table[i].from && k <= table[i].to) return table[i]; return table[table.length - 1]; }
function monthly(scheme, k, wage, RJ) {
  var cap, rate;
  if (scheme === 'ppt') { cap = RJ.parentsTogether.caps[k - 1]; rate = RJ.parentsTogether.rate; }
  else { var r = rowFor(scheme === 'single' ? RJ.singleParent : RJ.general, k); cap = r.cap; rate = r.rate; }
  var base = wage * rate, v = Math.max(RJ.floor, Math.min(cap, base));
  return { amount: v, cap: cap, rate: rate, base: base, floored: base < RJ.floor, capped: base > cap };
}
function canLeave(par) { return par && (par.insured === 'employee' || par.insured === 'civil'); }
/* 계획 전체 판정 */
function evaluate(plan, RJ) {
  var P = plan.parents, A = P[0], B = P[1] || { key: 'B', insured: 'none', blocks: [] }, single = !!plan.single;
  var dl = deadline18(plan.birthDate), warns = [];
  var U = [units(A), single ? [] : units(B)], T = U.map(function (u) { return u.length ? u[u.length - 1].c1 : 0; });
  var used = [validBlocks(A).length > 0, !single && validBlocks(B).length > 0];
  /* 1년 6개월 연장 */
  var bothThree = !single && canLeave(A) && canLeave(B) && T[0] >= RJ.extensionEachMinMonths - 1e-9 && T[1] >= RJ.extensionEachMinMonths - 1e-9;
  var maxM = (single || bothThree) ? RJ.extendedMaxMonths : RJ.maxMonths;
  /* 6+6 공통 개월 */
  var pptOk = !single && A.insured === 'employee' && B.insured === 'employee' && used[0] && used[1];
  var E = U.map(function (us) { return (us.reduce(function (s, u) { if (u.block.start > dl) return s; return s + Math.max(0, Math.min(u.c1, 6) - Math.min(u.c0, 6)); }, 0)); });
  var N = pptOk ? Math.min(E[0], E[1], 6) : 0;
  var res = [0, 1].map(function (i) {
    var par = i ? B : A, us = U[i], wage = +par.wage || 0, rows = {}, total = 0, paidMonths = 0, daily = [];
    var scheme0 = single && i === 0 ? 'single' : 'general', payable = par.insured === 'employee' && wage > 0;
    us.forEach(function (u) {
      var uAmt = 0, c = u.c0;
      while (c < u.c1 - 1e-12) {
        var k = Math.floor(c + 1e-9) + 1, segEnd = Math.min(u.c1, k);
        if (pptOk && c < N - 1e-12 && u.block.start <= dl) segEnd = Math.min(segEnd, N);
        var portion = segEnd - c;
        if (c >= maxM - 1e-12) { (rows['over|' + k] = rows['over|' + k] || { k: k, scheme: 'over', portion: 0, amount: 0 }).portion += portion; }
        else {
          if (segEnd > maxM) { portion = maxM - c; }
          var sch = (pptOk && c < N - 1e-12 && u.block.start <= dl) ? 'ppt' : scheme0, mo = monthly(sch, k, wage, RJ), amt = payable ? portion * mo.amount : 0;
          var key = sch + '|' + k, r = rows[key] || (rows[key] = { k: k, scheme: sch, portion: 0, amount: 0, cap: mo.cap, rate: mo.rate, monthly: mo.amount, floored: mo.floored, capped: mo.capped });
          r.portion += portion; r.amount += amt; uAmt += amt; total += amt; paidMonths += portion;
          if (segEnd > maxM) { (rows['over|' + k] = rows['over|' + k] || { k: k, scheme: 'over', portion: 0, amount: 0 }).portion += segEnd - maxM; }
        }
        c = segEnd;
      }
      daily.push({ start: u.start, end: u.end, perDay: uAmt / u.days });
    });
    var list = Object.keys(rows).map(function (k) { var r = rows[k]; r.portion = r3(r.portion); return r; }).sort(function (a, b) { return a.k - b.k || (a.scheme === 'ppt' ? -1 : 1); });
    return { key: par.key, label: par.label || par.key, months: r3(T[i]), paidMonths: r3(paidMonths), total: Math.floor(total + 1e-6), rows: list, units: us, daily: daily, payable: payable, wage: wage };
  });
  /* 경고 */
  [A, B].forEach(function (par, i) {
    if (i === 1 && single) return;
    var nm = par.label || par.key, bl = validBlocks(par), raw = par.blocks || [];
    raw.forEach(function (b) { if (!isD(b.start) || !isD(b.end)) warns.push({ level: 'red', who: par.key, code: 'date', text: nm + ': 날짜가 비었거나 잘못된 블록이 있어요.' }); else if (b.end < b.start) warns.push({ level: 'red', who: par.key, code: 'order', text: nm + ': 끝나는 날이 시작일보다 빨라요 (' + b.start + ' ~ ' + b.end + ').' }); });
    for (var j = 1; j < bl.length; j++) if (bl[j].start <= bl[j - 1].end) warns.push({ level: 'red', who: par.key, code: 'overlap', text: nm + ': 휴직 블록이 서로 겹쳐요 (' + bl[j - 1].start + ' ~ ' + bl[j - 1].end + ' / ' + bl[j].start + ' ~).' });
    if (!bl.length) return;
    if (par.insured === 'none') warns.push({ level: 'red', who: par.key, code: 'none', text: nm + ': 고용보험 미가입으로 표시했어요. 육아휴직급여 대상이 아니라서 급여 0원으로 계산했어요.' });
    if (par.insured === 'civil') warns.push({ level: 'yellow', who: par.key, code: 'civil', text: nm + ': 공무원·교원은 고용보험 육아휴직급여(6+6 포함) 대상이 아니에요. 공무원 육아휴직 수당은 이 앱에서 계산하지 않아요.' });
    if (par.insured === 'employee' && !(+par.wage > 0)) warns.push({ level: 'yellow', who: par.key, code: 'wage', text: nm + ': 통상임금이 비어 있어 급여를 0원으로 보여 줘요.' });
    var normal = bl.filter(function (b) { return b.type !== 'short'; });
    if (normal.length > RJ.segmentsMax) warns.push({ level: 'red', who: par.key, code: 'split', text: nm + ': 일반 육아휴직이 ' + normal.length + '구간이에요. 분할은 3회(네 구간)까지예요. 단기 육아휴직은 횟수에서 빠져요.' });
    var shorts = bl.filter(function (b) { return b.type === 'short'; }), yrs = {};
    shorts.forEach(function (b) { var d = diffDays(b.start, b.end) + 1; if (d !== 7 && d !== 14) warns.push({ level: 'red', who: par.key, code: 'short-len', text: nm + ': 단기 육아휴직은 1주(7일) 또는 2주(14일)예요. 지금 ' + d + '일이에요.' }); if (b.start < RJ.shortLeave.since) warns.push({ level: 'red', who: par.key, code: 'short-since', text: nm + ': 단기 육아휴직은 ' + RJ.shortLeave.since + '부터 쓸 수 있어요.' }); var y = b.start.slice(0, 4); yrs[y] = (yrs[y] || 0) + 1; });
    Object.keys(yrs).forEach(function (y) { if (yrs[y] > 1) warns.push({ level: 'red', who: par.key, code: 'short-year', text: nm + ': 단기 육아휴직은 1년에 1회예요(' + y + '년 ' + yrs[y] + '회).' }); });
    if (T[i] > maxM + 1e-9) warns.push({ level: 'red', who: par.key, code: 'max', text: nm + ': 합계 ' + r3(T[i]) + '개월로 최대 ' + maxM + '개월을 넘어요. 넘는 기간은 급여에서 뺐어요.' + (maxM === 12 ? ' 두 사람 모두 3개월 이상 쓰면 1년 6개월까지 늘릴 수 있어요.' : '') });
    var days = bl.reduce(function (s, b) { return s + diffDays(b.start, b.end) + 1; }, 0);
    if (days < RJ.minLeaveDays) warns.push({ level: 'yellow', who: par.key, code: 'min30', text: nm + ': 합계 ' + days + '일이에요. 육아휴직급여는 (12개월 안에 합산) 30일 이상 써야 받아요.' });
    if (pptOk) bl.forEach(function (b) { if (b.start > dl) warns.push({ level: 'yellow', who: par.key, code: 'after18', text: nm + ': ' + b.start + ' 시작 블록은 생후 18개월(' + dl + ')이 지나 시작해서 6+6에서 빠져요. 일반 급여로 계산했어요.' }); });
  });
  /* 연장분 신청 시점: 배우자의 3개월 사용이 신청 때 확인돼야 함 */
  if (bothThree) [0, 1].forEach(function (i) {
    var us = U[i], j = 1 - i, par = i ? B : A; if (T[i] <= RJ.maxMonths + 1e-9) return;
    var x = crossDate(us, RJ.maxMonths), sp = crossDate(U[j], RJ.extensionEachMinMonths, true);
    if (x && sp) { var earliest = addDays(sp, 32); if (x < earliest) warns.push({ level: 'red', who: par.key, code: 'ext-timing', text: (par.label || par.key) + ': 13개월째(' + x + ')부터는 연장 기간이에요. 연장분 신청 때 배우자의 3개월 사용이 이미 끝나 있어야 해요(배우자 3개월 끝: ' + sp + '). 가장 이른 연장 시작은 ' + earliest + ' 무렵이에요(1350 상담 예시 기준).' }); }
  });
  if (pptOk && N > 0) warns.push({ level: 'info', who: '', code: 'ppt-pay', text: '6+6은 두 번째로 휴직한 사람이 급여를 신청할 때 첫 번째 사람 몫의 차액도 함께 신청해요. 먼저 쉬는 사람은 처음엔 일반 급여를 받고 나중에 차액을 받아요.' });
  if (!single && used[0] && used[1] && !pptOk && A.insured !== 'none' && B.insured !== 'none') warns.push({ level: 'info', who: '', code: 'no-ppt', text: '두 사람 모두 고용보험 근로자일 때만 6+6이 적용돼요. 근로자 쪽은 일반 급여로 계산했어요.' });
  return { birth: plan.birthDate, deadline18: dl, single: single, maxMonths: maxM, extended: maxM === RJ.extendedMaxMonths, bothThree: bothThree, ppt: pptOk && N > 0, N: r3(N), Nexact: N, E: E.map(r3), parents: res, total: res[0].total + res[1].total, warns: warns };
}
function crossDate(us, m, endDay) {
  for (var i = 0; i < us.length; i++) { var u = us[i]; if (u.c1 >= m - 1e-9) { var off = Math.round((m - u.c0) / u.frac * u.days); return endDay ? addDays(u.start, Math.max(0, off - 1)) : addDays(u.start, off); } }
  return null;
}
/* 마감일 */
function deadlines(plan, RJ) {
  var out = [{ id: 'd18', who: '', date: deadline18(plan.birthDate), title: '6+6 개시 마감(생후 18개월 이내 시작)', verified: false }];
  plan.parents.forEach(function (par, i) {
    if (i === 1 && plan.single) return;
    validBlocks(par).forEach(function (b, j) {
      var nm = (par.label || par.key) + ' ' + (j + 1) + '번째' + (b.type === 'short' ? '(단기)' : '');
      out.push({ id: 'notice-' + par.key + j, who: par.key, date: addDays(b.start, -RJ.noticeDays), title: nm + ' 회사 신청 마감(개시 30일 전)', block: b });
      out.push({ id: 'claim-' + par.key + j, who: par.key, date: addMonths(b.start, RJ.claimStartAfterMonths), title: nm + ' 급여 신청 시작(개시 1개월 후)', block: b });
      out.push({ id: 'claimEnd-' + par.key + j, who: par.key, date: addMonths(b.end, RJ.claimDeadlineAfterEndMonths), title: nm + ' 급여 신청 최종 기한(종료 후 12개월)', block: b });
    });
  });
  return out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}
/* 월별 가구 수입: 출생 달부터 24개월 */
function cashflow(plan, ev, months) {
  months = months || 24;
  var b = parseD(plan.birthDate), rows = [];
  var base = plan.parents.map(function (p, i) { return (i === 1 && plan.single) ? 0 : (+p.net > 0 ? +p.net : (+p.wage || 0)); });
  for (var m = 0; m < months; m++) {
    var t = b.y * 12 + (b.m - 1) + m, y = Math.floor(t / 12), mo = t % 12 + 1, first = toD(y, mo, 1), last = toD(y, mo, dim(y, mo)), nd = dim(y, mo);
    var row = { ym: y + '-' + pad(mo), vals: [], leave: [] };
    ev.parents.forEach(function (pr, i) {
      if (i === 1 && plan.single) { row.vals.push(0); row.leave.push(0); return; }
      var leaveDays = 0, ben = 0;
      pr.daily.forEach(function (d) { var s = d.start > first ? d.start : first, e = d.end < last ? d.end : last; if (s <= e) { var n = diffDays(s, e) + 1; leaveDays += n; ben += n * d.perDay; } });
      row.vals.push(Math.round(ben + base[i] * (nd - leaveDays) / nd)); row.leave.push(leaveDays / nd);
    });
    row.total = row.vals[0] + row.vals[1]; rows.push(row);
  }
  var baseTotal = base[0] + base[1], low = rows.reduce(function (a, r) { return !a || r.total < a.total ? r : a; }, null);
  return { rows: rows, base: baseTotal, low: low, drop: baseTotal ? 1 - low.total / baseTotal : 0, netGiven: plan.parents.map(function (p) { return +p.net > 0; }) };
}
/* 추천 시나리오 3개 */
function uid() { return Math.random().toString(36).slice(2, 10); }
function blk(s, months, type) { return { id: uid(), start: s, end: addDays(addMonths(s, months), -1), type: type || 'normal' }; }
function recommend(inp) {
  var S = isD(inp.aStart) ? inp.aStart : addMonths(inp.birthDate, 3);
  var mk = function (name, aB, bB, note) {
    return { id: uid(), name: name, note: note, birthDate: inp.birthDate, single: !!inp.single, insuredOk: !!inp.insuredOk,
      parents: [{ key: 'A', label: inp.labelA || 'A', insured: inp.insA, wage: inp.wageA, net: inp.netA || 0, blocks: aB },
                { key: 'B', label: inp.labelB || 'B', insured: inp.single ? 'none' : inp.insB, wage: inp.single ? 0 : inp.wageB, net: inp.single ? 0 : (inp.netB || 0), blocks: inp.single || inp.insB === 'none' ? [] : bB }] };
  };
  if (inp.single) return [mk('혼자 1년', [blk(S, 12)], [], '한부모 특례: 1~3개월 상한 300만원'), mk('혼자 1년 6개월', [blk(S, 18)], [], '한부모는 6개월 추가 가능'), mk('혼자 6개월', [blk(S, 6)], [], '짧게 쉬고 복귀')];
  return [
    mk('동시 6개월 + A 이어서', [blk(S, 12)], [blk(S, 6)], '처음 6개월을 함께 쉬고 A가 이어서 쉬어요'),
    mk('순차: A 12개월 → B 6개월', [blk(S, 12)], [blk(addMonths(S, 12), 6)], '한 사람씩 번갈아 쉬어 가구 수입이 덜 떨어져요'),
    mk('짧게: A 6개월 → B 6개월', [blk(S, 6)], [blk(addMonths(S, 6), 6)], '둘 다 6개월, 경력 공백이 같아요')
  ];
}
function summary(plan, RJ) {
  var ev = evaluate(plan, RJ), cf = cashflow(plan, ev);
  return { total: ev.total, N: ev.N, maxMonths: ev.maxMonths, low: cf.low, drop: cf.drop, gap: ev.parents.map(function (p) { return p.months; }), reds: ev.warns.filter(function (w) { return w.level === 'red'; }).length, ev: ev, cf: cf };
}
/* 공유: 짧은 키 JSON (압축은 app에서 CompressionStream) */
function pack(plan, withWage) {
  return { v: 1, n: plan.name, b: plan.birthDate, s: plan.single ? 1 : 0, w: withWage ? 1 : 0,
    p: plan.parents.map(function (p) { var o = { k: p.key, l: p.label, i: p.insured === 'civil' ? 'c' : p.insured === 'none' ? 'n' : 'e', b: (p.blocks || []).map(function (b) { return [b.start, b.end, b.type === 'short' ? 's' : 'n']; }) }; if (withWage) { o.g = +p.wage || 0; if (+p.net > 0) o.t = +p.net; } return o; }) };
}
function unpack(o) {
  if (!o || o.v !== 1 || !isD(o.b) || !Array.isArray(o.p) || !o.p.length) return null;
  return { id: uid(), name: String(o.n || '공유받은 계획').slice(0, 40), birthDate: o.b, single: !!o.s, shared: true, hasWage: !!o.w,
    parents: [0, 1].map(function (i) { var p = o.p[i] || { k: 'B', i: 'n', b: [] }; return { key: i ? 'B' : 'A', label: String(p.l || (i ? 'B' : 'A')).slice(0, 12), insured: p.i === 'c' ? 'civil' : p.i === 'n' ? 'none' : 'employee', wage: o.w ? (+p.g || 0) : 0, net: o.w ? (+p.t || 0) : 0,
      blocks: (Array.isArray(p.b) ? p.b : []).slice(0, 8).filter(function (x) { return Array.isArray(x) && isD(x[0]) && isD(x[1]); }).map(function (x) { return { id: uid(), start: x[0], end: x[1], type: x[2] === 's' ? 'short' : 'normal' }; }) }; }) };
}
function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(t) { t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('binary'), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function utf8(s) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Buffer.from(s, 'utf8'); }
function unutf8(a) { return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(a) : Buffer.from(a).toString('utf8'); }
/* .ics */
function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function fold(line) { var out = [], cur = '', bytes = 0; for (var i = 0; i < line.length; i++) { var ch = line[i], b = utf8(ch).length, lim = out.length ? 74 : 75; if (bytes + b > lim) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; } out.push(cur); return out.join('\r\n '); }
function ics(events, now) {
  var n = now || new Date(), st = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + pad(n.getUTCSeconds()) + 'Z';
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//' + APP_ID + '//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:우리 육휴 일정'];
  events.forEach(function (e) { var d = e.date.replace(/-/g, ''); L.push('BEGIN:VEVENT', 'UID:' + e.id + '-' + d + '@' + APP_ID, 'DTSTAMP:' + st, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''), 'SUMMARY:' + icsEsc(e.title), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT'); });
  L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
}
function pageTitle(h, app) { var t = String(h == null ? '' : h).replace(/\s+/g, ' ').trim(); return (!t || t === app) ? app : t + ' — ' + app; }
function cleanPlan(p) {
  if (!p || typeof p !== 'object' || !isD(p.birthDate) || !Array.isArray(p.parents)) return null;
  var ins = function (x) { return x === 'civil' || x === 'none' ? x : 'employee'; };
  return { id: /^[\w-]{1,20}$/.test(p.id || '') ? p.id : uid(), name: String(p.name || '계획').slice(0, 40), note: String(p.note || '').slice(0, 80), birthDate: p.birthDate, single: !!p.single, insuredOk: !!p.insuredOk,
    parents: [0, 1].map(function (i) { var q = p.parents[i] || {}; return { key: i ? 'B' : 'A', label: String(q.label || (i ? 'B' : 'A')).slice(0, 12), insured: ins(q.insured), wage: Math.max(0, Math.min(1e9, +q.wage || 0)), net: Math.max(0, Math.min(1e9, +q.net || 0)),
      blocks: (Array.isArray(q.blocks) ? q.blocks : []).slice(0, 8).map(function (b) { return { id: /^[\w-]{1,20}$/.test(b && b.id || '') ? b.id : uid(), start: isD(b && b.start) ? b.start : '', end: isD(b && b.end) ? b.end : '', type: b && b.type === 'short' ? 'short' : 'normal' }; }) }; }) };
}
/* ---------- 자체 점검(스펙 계산 체크리스트) ---------- */
function P2(birth, a, b, extra) {
  var p = { name: 't', birthDate: birth, single: false, parents: [{ key: 'A', insured: 'employee', wage: a.w, blocks: a.b.map(function (x) { return { start: x[0], end: x[1], type: x[2] || 'normal' }; }) }, { key: 'B', insured: b.i || 'employee', wage: b.w, blocks: b.b.map(function (x) { return { start: x[0], end: x[1], type: x[2] || 'normal' }; }) }] };
  for (var k in extra || {}) p[k] = extra[k]; if (a.i) p.parents[0].insured = a.i; return p;
}
function selfTest(RJ) {
  var res = []; function eq(name, got, exp) { res.push({ name: name, pass: JSON.stringify(got) === JSON.stringify(exp), got: got, exp: exp }); }
  var e;
  e = evaluate(P2('2026-01-01', { w: 3000000, b: [['2026-03-01', '2027-02-28']] }, { w: 0, b: [], i: 'none' }), RJ);
  eq('일반 300만·12개월 = 2,310만원', e.parents[0].total, 23100000);
  e = evaluate(P2('2026-01-01', { w: 5000000, b: [['2026-03-01', '2026-08-31']] }, { w: 5000000, b: [['2026-03-01', '2026-08-31']] }), RJ);
  eq('6+6 500만·각 6개월 = 각 2,000만원', [e.parents[0].total, e.parents[1].total, e.total, e.N], [20000000, 20000000, 40000000, 6]);
  e = evaluate(P2('2026-01-01', { w: 2800000, b: [['2026-03-01', '2026-08-31']] }, { w: 2800000, b: [['2026-09-01', '2027-02-28']] }), RJ);
  eq('6+6 280만·6개월 = 1,620만원', e.parents[0].total, 16200000);
  e = evaluate(P2('2025-12-01', { w: 5000000, b: [['2026-01-15', '2026-04-24']] }, { w: 5000000, b: [['2026-05-15', '2026-09-14']] }), RJ);
  eq('공통 3개월 10일(연합뉴스): N·엄마·아빠', [e.N, e.parents[0].total, e.parents[1].total], [3.333, 9166666, 10500000]);
  e = evaluate(P2('2026-01-01', { w: 600000, b: [['2026-03-01', '2026-03-31']] }, { w: 0, b: [], i: 'none' }), RJ);
  eq('통상임금 60만 → 하한 70만', e.parents[0].total, 700000);
  e = evaluate(P2('2026-01-01', { w: 5000000, b: [['2026-03-01', '2026-08-31']], i: 'civil' }, { w: 5000000, b: [['2026-03-01', '2026-08-31']] }), RJ);
  eq('한쪽 공무원 → 6+6 없음, 근로자 일반(250×3+200×3)', [e.ppt, e.parents[1].total, e.warns.some(function (w) { return w.code === 'civil'; })], [false, 13500000, true]);
  e = evaluate(P2('2026-01-01', { w: 3000000, b: [['2026-03-01', '2027-08-31']] }, { w: 3000000, b: [['2026-03-01', '2026-04-30']] }), RJ);
  var e2 = evaluate(P2('2026-01-01', { w: 3000000, b: [['2026-03-01', '2027-08-31']] }, { w: 3000000, b: [['2026-03-01', '2026-05-31']] }), RJ);
  eq('한쪽 2개월 → 최대 12, 3개월 → 18', [e.maxMonths, e.warns.some(function (w) { return w.code === 'max'; }), e2.maxMonths, e2.warns.some(function (w) { return w.code === 'max'; })], [12, true, 18, false]);
  e = evaluate(P2('2026-01-01', { w: 5000000, b: [['2026-03-01', '2026-05-31'], ['2027-08-01', '2027-10-31']] }, { w: 5000000, b: [['2026-03-01', '2026-08-31']] }), RJ);
  eq('생후 18개월 넘어 시작한 블록 → 6+6 제외 경고', [deadline18('2026-01-01'), e.N, e.warns.some(function (w) { return w.code === 'after18'; })], ['2027-06-30', 3, true]);
  var four = [['2026-03-01', '2026-03-31'], ['2026-05-01', '2026-05-31'], ['2026-07-01', '2026-07-31'], ['2026-09-01', '2026-09-30']];
  e = evaluate(P2('2026-01-01', { w: 3000000, b: four }, { w: 0, b: [], i: 'none' }), RJ);
  e2 = evaluate(P2('2026-01-01', { w: 3000000, b: four.concat([['2026-11-01', '2026-11-30']]) }, { w: 0, b: [], i: 'none' }), RJ);
  var e3 = evaluate(P2('2026-01-01', { w: 3000000, b: four.concat([['2026-10-05', '2026-10-11', 'short']]) }, { w: 0, b: [], i: 'none' }), RJ);
  eq('분할: 네 구간 OK, 다섯째 경고, 단기는 제외', [e.warns.some(function (w) { return w.code === 'split'; }), e2.warns.some(function (w) { return w.code === 'split'; }), e3.warns.some(function (w) { return w.code === 'split'; })], [false, true, false]);
  var d = deadlines(P2('2026-01-01', { w: 1, b: [['2026-04-15', '2027-01-14']] }, { w: 0, b: [], i: 'none' }), RJ).filter(function (x) { return x.who === 'A'; }).map(function (x) { return x.date; });
  eq('마감일: 신청 3/16, 급여 신청 5/15~2028-01-14', d, ['2026-03-16', '2026-05-15', '2028-01-14']);
  eq('고용24 일할 예시 9.874개월', r3(totalMonths({ blocks: [{ start: '2020-09-01', end: '2021-04-03' }, { start: '2021-05-02', end: '2021-07-25' }] })), 9.874);
  var pk = unpack(JSON.parse(JSON.stringify(pack(P2('2026-01-01', { w: 3000000, b: [['2026-03-01', '2026-08-31']] }, { w: 2000000, b: [] }), false))));
  eq('공유: 통상임금 빼기', [pk.parents[0].wage, pk.parents[0].blocks[0].end, pk.hasWage], [0, '2026-08-31', false]);
  eq('pageTitle 중복 없음', [pageTitle('우리 육휴 설계도', '우리 육휴 설계도'), pageTitle('비교', 'A')], ['우리 육휴 설계도', '비교 — A']);
  var pass = res.filter(function (r) { return r.pass; }).length;
  return { pass: pass, fail: res.length - pass, total: res.length, results: res };
}
return { APP_ID: APP_ID, pad: pad, parseD: parseD, isD: isD, addDays: addDays, addMonths: addMonths, diffDays: diffDays, dow: dow, today: today, fmtD: fmtD, fmtShort: fmtShort, won: won, man: man, num: num, parseWon: parseWon,
  periods: periods, units: units, totalMonths: totalMonths, validBlocks: validBlocks, deadline18: deadline18, monthly: monthly, evaluate: evaluate, deadlines: deadlines, cashflow: cashflow, recommend: recommend, summary: summary,
  pack: pack, unpack: unpack, b64u: b64u, unb64u: unb64u, utf8: utf8, unutf8: unutf8, ics: ics, pageTitle: pageTitle, cleanPlan: cleanPlan, uid: uid, selfTest: selfTest };
});
