/* 전역 목돈 설계도 — 계산 엔진 (브라우저 window.SavRules / node require) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.SavRules = f(); })(this, function () {
'use strict';
var RANKS = ['이병', '일병', '상병', '병장'];
function pad(n) { return (n < 10 ? '0' : '') + n; }
function parseD(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null; var y = +m[1], mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null; return { y: y, m: mo, d: d }; }
function isD(s) { return !!parseD(s); }
function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function toD(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
function ms(s) { var p = parseD(s); return Date.UTC(p.y, p.m - 1, p.d); }
function fromMs(t) { var x = new Date(t); return toD(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function addDays(s, n) { return fromMs(ms(s) + n * 864e5); }
function addMonths(s, n) { var p = parseD(s), t = p.y * 12 + p.m - 1 + n, y = Math.floor(t / 12), m = t % 12 + 1; return toD(y, m, Math.min(p.d, dim(y, m))); }
function diffDays(a, b) { return Math.round((ms(b) - ms(a)) / 864e5); }
function dow(s) { return new Date(ms(s)).getUTCDay(); }
function ym(s) { return s.slice(0, 7); }
function nextYm(y) { var p = parseD(y + '-01'); return addMonths(y + '-01', 1).slice(0, 7); }
function today(now) { var d = now || new Date(); return toD(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
var WD = ['일', '월', '화', '수', '목', '금', '토'];
function fmtD(s) { var p = parseD(s); return p ? p.y + '. ' + p.m + '. ' + p.d + '.(' + WD[dow(s)] + ')' : ''; }
function won(n) { return Math.round(n).toLocaleString('en-US') + '원'; }
function man(n) { var v = Math.round(n / 1000) / 10; return v.toLocaleString('en-US') + '만원'; }
function num(n) { return Math.round(n).toLocaleString('en-US'); }
function parseWon(s) { var t = String(s == null ? '' : s).replace(/[\s,원]/g, ''); if (!t) return NaN; var m = /^(\d+(?:\.\d+)?)만$/.exec(t); if (m) return Math.round(parseFloat(m[1]) * 1e4); return /^\d+$/.test(t) ? +t : NaN; }
function branch(RJ, id) { for (var i = 0; i < RJ.branches.length; i++) if (RJ.branches[i].id === id) return RJ.branches[i]; return RJ.branches[0]; }
function dischargeOf(enlist, months) { return addDays(addMonths(enlist, months), -1); }
function firstOnOrAfter(s) { var p = parseD(s); return p.d === 1 ? s : addMonths(toD(p.y, p.m, 1), 1); }
function promoDefault(enlist, RJ) { var a = firstOnOrAfter(addMonths(enlist, RJ.promoExample['일병'])), b = addMonths(a, RJ.promoExample['상병']), c = addMonths(b, RJ.promoExample['병장']); return { '일병': a, '상병': b, '병장': c }; }
function rankAt(d, pr) { return d >= pr['병장'] ? '병장' : d >= pr['상병'] ? '상병' : d >= pr['일병'] ? '일병' : '이병'; }
function payOf(year, rank, PAY, raise) {
  if (year <= 2026) return { v: PAY['2026'][rank], assumed: false };
  if (PAY[String(year)]) return { v: PAY[String(year)][rank], assumed: false };
  return { v: Math.round(PAY['2026'][rank] * (1 + (+raise || 0) / 100)), assumed: true };
}
/* 계획 정리 */
function clean(p, RJ) {
  p = p && typeof p === 'object' ? p : {};
  var b = branch(RJ, p.branch), out = { branch: b.id, enlist: isD(p.enlist) ? p.enlist : '' };
  out.months = b.id === 'alt' ? Math.max(1, Math.min(48, Math.round(+p.months || b.months))) : b.months;
  out.discharge = isD(p.discharge) ? p.discharge : (out.enlist ? dischargeOf(out.enlist, out.months) : '');
  var pd = out.enlist ? promoDefault(out.enlist, RJ) : {};
  out.promo = {}; RANKS.slice(1).forEach(function (r) { out.promo[r] = p.promo && isD(p.promo[r]) ? p.promo[r] : (pd[r] || ''); });
  out.promoEdited = !!p.promoEdited;
  out.join = isD(p.join) ? p.join : out.enlist;
  out.fixed = (Array.isArray(p.fixed) ? p.fixed : []).slice(0, 8).map(function (x) { return { n: String(x && x.n || '').slice(0, 20), a: Math.max(0, Math.min(5e6, Math.round(+(x && x.a) || 0))) }; });
  out.leave = Math.max(0, Math.min(5e6, Math.round(+p.leave || 0)));
  out.limit = Math.max(0, Math.min(RJ.personMax, Math.round((+p.limit || 0) / RJ.unit) * RJ.unit));
  out.banks = (Array.isArray(p.banks) ? p.banks : []).slice(0, 2).map(function (x) { return { name: String(x && x.name || '').slice(0, 12), limit: Math.max(0, Math.round(+(x && x.limit) || 0)), rate: isFinite(+(x && x.rate)) && +x.rate > 0 && +x.rate < 0.2 ? +x.rate : RJ.defaultRate }; });
  out.old = !!p.old; out.raise = Math.max(-10, Math.min(30, +p.raise || 0)); out.lastMonth = !!p.lastMonth;
  out.bucket = (Array.isArray(p.bucket) ? p.bucket : []).slice(0, 10).map(function (x) { return { n: String(x && x.n || '').slice(0, 20), a: Math.max(0, Math.round(+(x && x.a) || 0)) }; });
  out.check = {}; if (p.check && typeof p.check === 'object') Object.keys(p.check).slice(0, 30).forEach(function (k) { if (/^[a-z0-9]{1,12}$/.test(k)) out.check[k] = !!p.check[k]; });
  out.after = Math.max(0, Math.min(1e7, Math.round(+p.after || 0)));
  return out;
}
function defaultBanks(limit, RJ) { var a = Math.min(RJ.bankMax, limit), b = limit - a; var r = [{ name: '', limit: a, rate: RJ.defaultRate }]; if (b > 0) r.push({ name: '', limit: b, rate: RJ.defaultRate }); return limit > 0 ? r : []; }
function bankErrors(p, RJ) {
  var e = [], sum = 0, names = {};
  if (p.limit % RJ.unit) e.push('한도는 5만 원 단위로만 정할 수 있어요.');
  if (p.limit > RJ.personMax) e.push('개인 한도는 월 55만 원까지예요.');
  if (p.banks.length > RJ.maxAccounts) e.push('계좌는 1인 2개까지예요.');
  p.banks.forEach(function (b, i) {
    sum += b.limit;
    if (b.limit > RJ.bankMax) e.push((i + 1) + '번 은행 한도가 30만 원을 넘어요.');
    if (b.limit % RJ.unit) e.push((i + 1) + '번 은행 한도는 5만 원 단위여야 해요.');
    if (b.name) { if (names[b.name]) e.push('같은 은행에 2계좌는 안 돼요(' + b.name + ').'); names[b.name] = 1; }
  });
  if (p.banks.length && sum !== p.limit) e.push('은행별 한도 합계(' + man(sum) + ')가 전체 한도(' + man(p.limit) + ')와 달라요.');
  return e;
}
/* 월별 흐름 */
function monthList(p) {
  var out = [], s = p.enlist.slice(0, 7), e = p.discharge.slice(0, 7);
  for (var y = s, i = 0; y <= e && i < 60; y = nextYm(y), i++) out.push(y);
  return out;
}
function depositMonths(p, RJ) {
  var b = branch(RJ, p.branch), last = p.lastMonth && parseD(p.discharge).d > 1 ? ym(p.discharge) : ym(addMonths(ym(p.discharge) + '-01', -1));
  var out = []; for (var y = ym(p.join); y <= last && out.length < b.saveMax; y = nextYm(y)) out.push(y);
  return out;
}
function payMonth(p, y, PAY) {
  var pp = parseD(y + '-01'), n = dim(pp.y, pp.m), tot = 0, assumed = false, ranks = {};
  for (var d = 1; d <= n; d++) {
    var ds = toD(pp.y, pp.m, d); if (ds < p.enlist || ds > p.discharge) continue;
    var r = rankAt(ds, p.promo), v = payOf(pp.y, r, PAY, p.raise); tot += v.v / n; assumed = assumed || v.assumed; ranks[r] = 1;
  }
  return { pay: Math.round(tot), assumed: assumed, rank: Object.keys(ranks).join('→') };
}
function flow(p, limit, RJ, PAY) {
  var dm = depositMonths(p, RJ), dset = {}; dm.forEach(function (y) { dset[y] = 1; });
  var fixed = p.fixed.reduce(function (s, x) { return s + x.a; }, 0);
  return monthList(p).map(function (y) {
    var pm = payMonth(p, y, PAY), dep = dset[y] ? limit : 0, sur = pm.pay - dep - fixed - p.leave;
    return { ym: y, pay: pm.pay, rank: pm.rank, assumed: pm.assumed, dep: dep, spend: fixed + p.leave, surplus: sur };
  });
}
function recommend(p, RJ, PAY) {
  for (var L = RJ.personMax; L >= 0; L -= RJ.unit) { var f = flow(p, L, RJ, PAY); if (f.every(function (r) { return r.surplus >= 0; })) return L; }
  return 0;
}
/* 이자: 월 단리, k번째 입금은 (n-k+1)개월 */
function interestOf(amount, rate, n) { return amount * rate / 12 * n * (n + 1) / 2; }
function maturity(p, RJ) {
  var n = depositMonths(p, RJ).length, banks = p.banks.length ? p.banks : [{ limit: p.limit, rate: RJ.defaultRate }];
  var principal = p.limit * n, interest = 0;
  banks.forEach(function (b) { interest += interestOf(b.limit, b.rate, n); });
  var dm = depositMonths(p, RJ), matchN = dm.filter(function (y) { return y >= RJ.matchSince.slice(0, 7); }).length;
  interest = Math.floor(interest);
  var matching = p.limit * matchN * RJ.matchRate;
  return { n: n, principal: principal, interest: interest, matching: matching, total: principal + interest + matching, taxSaved: Math.floor(interest * RJ.taxRate), preMatchExcluded: n - matchN };
}
function isHoliday(d, H) { var w = dow(d); if (w === 0 || w === 6) return true; var y = H[d.slice(0, 4)]; return !!(y && y.indexOf(d) >= 0); }
function matchDate(cancel, H) {
  var p = parseD(cancel), d = addMonths(toD(p.y, p.m, 25), 1);
  while (isHoliday(d, H)) d = addDays(d, -1);
  var verified = !!(H.verified && H.verified[d.slice(0, 4)]);
  return { date: d, verified: verified, base: addMonths(toD(p.y, p.m, 25), 1) };
}
function breakLoss(p, RJ, t) {
  var dm = depositMonths(p, RJ), paid = dm.filter(function (y) { return y <= t.slice(0, 7); }), n = dm.length, k = paid.length;
  var principal = p.limit * k, matching = paid.filter(function (y) { return y >= RJ.matchSince.slice(0, 7); }).length * p.limit;
  var accrued = 0; paid.forEach(function (y, i) { accrued += p.limit * RJ.defaultRate / 12 * (k - i); });
  return { months: k, of: n, principal: principal, matching: matching, accrued: Math.floor(accrued), tax: Math.floor(accrued * RJ.taxRate), loss: matching + Math.floor(accrued * RJ.taxRate) };
}
function warnings(p, RJ, PAY) {
  var w = [];
  if (!p.old && p.join >= RJ.noChangeSince) w.push({ code: 'nochange', level: 'red', text: '2025년 1월 2일 이후 가입자는 납입한도를 중도에 바꿀 수 없어요. 처음에 정한 한도로 전역까지 가요.' });
  if (p.old) w.push({ code: 'old', level: 'info', text: '2024-12-31 이전 가입자는 5만 원 단위로 복무 중 1회 한도를 올릴 수 있어요(은행 신청).' });
  if (p.join > RJ.taxFreeJoinUntil) w.push({ code: 'taxjoin', level: 'yellow', text: '현행 조세특례제한법은 2026-12-31까지 가입한 적금만 이자 비과세예요. 연장 개정안은 아직 확정 전이에요(확인 필요).' });
  if (p.join < p.enlist || p.join >= p.discharge) w.push({ code: 'join', level: 'red', text: '가입일은 입대일부터 전역일 전 사이여야 해요.' });
  else if (diffDays(p.join, p.discharge) < 30) w.push({ code: 'short', level: 'red', text: '잔여 복무기간이 1개월 이상일 때만 가입할 수 있어요.' });
  var pr = p.promo; if (!(pr['일병'] <= pr['상병'] && pr['상병'] <= pr['병장'])) w.push({ code: 'promo', level: 'red', text: '진급일 순서가 맞지 않아요(일병 → 상병 → 병장).' });
  bankErrors(p, RJ).forEach(function (t) { w.push({ code: 'bank', level: 'red', text: t }); });
  var f = flow(p, p.limit, RJ, PAY), bad = f.filter(function (r) { return r.surplus < 0; });
  if (bad.length) w.push({ code: 'deficit', level: 'red', text: '적자인 달이 ' + bad.length + '번 있어요. 가장 큰 부족분은 ' + won(-Math.min.apply(null, bad.map(function (r) { return r.surplus; }))) + '이에요.' });
  if (f.some(function (r) { return r.assumed; })) w.push({ code: 'assumed', level: 'yellow', text: '2027년 이후 봉급은 확정 전이라 가정값이에요.' });
  return w;
}
function plan(p, RJ, PAY, H, t) {
  var f = flow(p, p.limit, RJ, PAY), m = maturity(p, RJ), md = matchDate(p.discharge, H);
  var low = f.reduce(function (a, r) { return !a || r.surplus < a.surplus ? r : a; }, null);
  return { flow: f, mat: m, match: md, rec: recommend(p, RJ, PAY), low: low, deficits: f.filter(function (r) { return r.surplus < 0; }).length, warns: warnings(p, RJ, PAY), loss: breakLoss(p, RJ, t), dday: diffDays(t, md.date), ddDis: diffDays(t, p.discharge) };
}
/* 공유 */
function pack(p, withSpend) {
  var o = { v: 1, b: p.branch, e: p.enlist, d: p.discharge, m: p.months, pr: [p.promo['일병'], p.promo['상병'], p.promo['병장']], j: p.join, l: p.limit, bk: p.banks.map(function (b) { return [b.name, b.limit, b.rate]; }), o: p.old ? 1 : 0, r: p.raise, lm: p.lastMonth ? 1 : 0, s: withSpend ? 1 : 0 };
  if (withSpend) { o.f = p.fixed.map(function (x) { return [x.n, x.a]; }); o.lv = p.leave; o.bu = p.bucket.map(function (x) { return [x.n, x.a]; }); }
  return o;
}
function unpack(o, RJ) {
  if (!o || o.v !== 1 || !isD(o.e) || !isD(o.d)) return null;
  var pr = Array.isArray(o.pr) ? o.pr : [];
  return clean({ branch: o.b, enlist: o.e, discharge: o.d, months: o.m, promo: { '일병': pr[0], '상병': pr[1], '병장': pr[2] }, join: o.j, limit: o.l, banks: (o.bk || []).map(function (x) { return { name: x[0], limit: x[1], rate: x[2] }; }), old: o.o, raise: o.r, lastMonth: o.lm,
    fixed: (o.f || []).map(function (x) { return { n: x[0], a: x[1] }; }), leave: o.lv, bucket: (o.bu || []).map(function (x) { return { n: x[0], a: x[1] }; }) }, RJ);
}
function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(t) { t = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = typeof atob === 'function' ? atob(t) : Buffer.from(t, 'base64').toString('binary'), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function utf8(s) { return new TextEncoder().encode(s); }
function unutf8(a) { return new TextDecoder().decode(a); }
function pageTitle(h, app) { var t = String(h == null ? '' : h).replace(/\s+/g, ' ').trim(); return (!t || t === app) ? app : t + ' — ' + app; }
/* 자체 점검 */
function selfTest(RJ, PAY, H) {
  var res = []; function eq(name, got, exp) { res.push({ name: name, pass: JSON.stringify(got) === JSON.stringify(exp), got: got, exp: exp }); }
  var p = clean({ branch: 'army', enlist: '2026-10-14', limit: 550000 }, RJ);
  eq('육군 2026-10-14 입대 → 전역 2028-04-13', p.discharge, '2028-04-13');
  eq('진급 예시: 일병 2027-01-01·상병 07-01·병장 2028-01-01', [p.promo['일병'], p.promo['상병'], p.promo['병장']], ['2027-01-01', '2027-07-01', '2028-01-01']);
  var m = maturity(p, RJ);
  eq('55만·18개월·5%: 원금 9,900,000·매칭 9,900,000·이자 391,875', [m.n, m.principal, m.matching, m.interest], [18, 9900000, 9900000, 391875]);
  p.banks = defaultBanks(550000, RJ); m = maturity(p, RJ);
  eq('30만+25만 두 은행 5%도 이자 391,875', m.interest, 391875);
  eq('봉급 합계(2027 동결 가정) 19,685,484', flow(p, 0, RJ, PAY).reduce(function (s, r) { return s + r.pay; }, 0), 19685484);
  var q = clean({ branch: 'army', enlist: '2026-12-01', fixed: [{ n: '통신', a: 100000 }], leave: 100000 }, RJ);
  eq('추천 한도: 이병 75만 − 지출 20만 → 55만', recommend(q, RJ, PAY), 550000);
  q.fixed[0].a = 450000; eq('지출 55만이면 이병 달 기준 20만', recommend(q, RJ, PAY), 200000);
  eq('매칭 입금일: 2027-11 해지 → 2027-12-24(25일 토)', matchDate('2027-11-20', H).date, '2027-12-24');
  eq('매칭 입금일: 2026-08 해지 → 9/25·9/24 추석 → 2026-09-23', matchDate('2026-08-31', H).date, '2026-09-23');
  eq('매칭 입금일: 2028-03 해지 → 2028-04-25(화)', matchDate('2028-03-31', H).date, '2028-04-25');
  var e = clean({ branch: 'army', enlist: '2026-10-14', limit: 550000, banks: [{ name: '신한', limit: 300000 }, { name: '신한', limit: 250000 }] }, RJ);
  eq('같은 은행 2계좌 오류', bankErrors(e, RJ).some(function (t) { return /같은 은행/.test(t); }), true);
  e.banks = [{ name: 'A', limit: 350000 }, { name: 'B', limit: 200000 }]; eq('은행별 30만 초과 오류', bankErrors(e, RJ).some(function (t) { return /30만/.test(t); }), true);
  var u = unpack(JSON.parse(JSON.stringify(pack(clean({ branch: 'air', enlist: '2026-11-03', limit: 400000, fixed: [{ n: 'x', a: 1 }] }, RJ), false))), RJ);
  eq('공유: 지출 빼기·공군 21개월 왕복', [u.fixed.length, u.discharge, u.limit], [0, '2028-08-02', 400000]);
  eq('pageTitle 중복 없음', [pageTitle('전역 목돈 설계도', '전역 목돈 설계도'), pageTitle('기준', 'A')], ['전역 목돈 설계도', '기준 — A']);
  var pass = res.filter(function (r) { return r.pass; }).length;
  return { pass: pass, fail: res.length - pass, total: res.length, results: res };
}
return { RANKS: RANKS, parseD: parseD, isD: isD, addDays: addDays, addMonths: addMonths, diffDays: diffDays, dow: dow, today: today, fmtD: fmtD, won: won, man: man, num: num, parseWon: parseWon, branch: branch, dischargeOf: dischargeOf, promoDefault: promoDefault,
  payOf: payOf, clean: clean, defaultBanks: defaultBanks, bankErrors: bankErrors, depositMonths: depositMonths, flow: flow, recommend: recommend, maturity: maturity, matchDate: matchDate, breakLoss: breakLoss, warnings: warnings, plan: plan,
  pack: pack, unpack: unpack, b64u: b64u, unb64u: unb64u, utf8: utf8, unutf8: unutf8, pageTitle: pageTitle, selfTest: selfTest };
});
