/* 연말 기부금영수증 정리함 — 계산·파싱 규칙 (UMD: 브라우저 window.DonRules, node require)
   서버 전송 없음. 주민등록번호는 형식만 검사(체크섬 미사용). 가산세율·기한은 data/rules.json 값만 사용. */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.DonRules = f(); })(this, function () {
'use strict';
var APP_ID = 'donation-receipt-desk';
var WD = ['일', '월', '화', '수', '목', '금', '토'];
function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
/* ---------- 날짜 ---------- */
function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function toD(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
function parseD(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return null;
  var y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
  return { y: y, m: mo, d: d };
}
function isD(s) { return !!parseD(s); }
function ms(s) { var p = parseD(s); return Date.UTC(p.y, p.m - 1, p.d); }
function addDays(s, n) { var x = new Date(ms(s) + n * 86400000); return toD(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function addYears(s, n) { var p = parseD(s); return toD(p.y + n, p.m, Math.min(p.d, dim(p.y + n, p.m))); }
function dow(s) { return new Date(ms(s)).getUTCDay(); }
function today(now) { var d = now || new Date(); return toD(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
function fmtD(s) { var p = parseD(s); return p ? p.y + '년 ' + p.m + '월 ' + p.d + '일(' + WD[dow(s)] + ')' : ''; }
function fmtDot(s) { var p = parseD(s); return p ? p.y + '. ' + p.m + '. ' + p.d + '.' : ''; }
/* 거래일 문자열 → YYYY-MM-DD. 허용: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD(뒤에 시각 허용), YYYYMMDD, MM-DD·MM.DD·MM/DD(연도 보정) */
function parseDate(s, year) {
  var t = String(s == null ? '' : s).trim(), m, y, mo, d;
  if ((m = /^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})일?(?:[\sT].*)?$/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{4})(\d{2})(\d{2})(?:\s.*)?$/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[-./월]\s*(\d{1,2})일?(?:\s.*)?$/.exec(t))) { if (!year) return null; y = +year; mo = +m[1]; d = +m[2]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
  return toD(y, mo, d);
}
/* 금액: 쉼표·원·공백 제거, (1,000)·-1,000 은 음수 */
function parseAmount(s) {
  var t = String(s == null ? '' : s).trim(); if (!t) return 0;
  var neg = /^\(.*\)$/.test(t) || /^-/.test(t) || /^△/.test(t);
  t = t.replace(/[(),\s원₩\\+△-]/g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  var v = Math.round(parseFloat(t)); return neg ? -v : v;
}
function won(n) { return (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('en-US') + '원'; }
function num(n) { return Math.round(n).toLocaleString('en-US'); }
/* ---------- 표 파싱 (탭/쉼표, 큰따옴표 CSV) ---------- */
function splitCSVLine(line, delim) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur); return out.map(function (x) { return x.trim(); });
}
function parseTable(text) {
  var t = String(text == null ? '' : text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  var lines = t.split('\n').filter(function (l) { return l.trim() !== ''; });
  if (!lines.length) return { rows: [], delim: '' };
  var sample = lines.slice(0, 10).join('\n');
  var delim = sample.indexOf('\t') >= 0 ? '\t' : sample.indexOf(';') >= 0 && sample.indexOf(',') < 0 ? ';' : ',';
  return { rows: lines.map(function (l) { return delim === '\t' ? l.split('\t').map(function (x) { return x.trim().replace(/^"(.*)"$/, '$1'); }) : splitCSVLine(l, delim); }), delim: delim };
}
var HEAD = {
  date: /거래\s*일|일자|날짜|일시|date/i,
  out: /출금|찾으신|지급|인출|withdraw/i,
  inAmt: /^(?!.*(입금자|입금인|의뢰인)).*(입금|맡기신|받은\s*금액|deposit|금액|amount)/i,
  name: /보낸\s*분|입금자|의뢰인|성명|이름|기재\s*내용|받는\s*분|내용|name/i,
  memo: /메모|비고|적요|memo/i,
  bal: /잔액|balance/i
};
function colOf(head, re, used) { for (var i = 0; i < head.length; i++) if (used.indexOf(i) < 0 && re.test(head[i])) return i; return -1; }
/* 열 자동 추정 → {header, date, name, inAmt, out, memo, bal} (없으면 -1) */
function guessMap(rows, year) {
  var head = rows[0] || [], n = head.length, m = { header: false, date: -1, name: -1, inAmt: -1, out: -1, memo: -1, bal: -1 };
  var headerLike = head.some(function (h) { return HEAD.date.test(h); }) && head.some(function (h) { return HEAD.inAmt.test(h); });
  if (headerLike) {
    m.header = true; var used = [];
    ['date', 'bal', 'out', 'inAmt'].forEach(function (k) { var i = colOf(head, HEAD[k], used); if (i >= 0) { m[k] = i; used.push(i); } });
    var ni = colOf(head, /보낸\s*분|입금자|의뢰인|성명|이름|받는\s*분|기재\s*내용|name/i, used); if (ni < 0) ni = colOf(head, /내용/, used);
    if (ni >= 0) { m.name = ni; used.push(ni); }
    var mi = colOf(head, /메모|비고/i, used); if (mi < 0) mi = colOf(head, /적요/, used); if (mi >= 0) m.memo = mi;
    return m;
  }
  var body = rows.slice(0, 30), score = function (fn) { var s = []; for (var c = 0; c < n; c++) s[c] = body.filter(function (r) { return fn(r[c]); }).length; return s; };
  var ds = score(function (v) { return !!parseDate(v, year || 2000); });
  var ns = score(function (v) { var a = parseAmount(v); return v !== '' && !isNaN(a) && !parseDate(v, year || 2000); });
  var ss = score(function (v) { return v && isNaN(parseAmount(v)) && !parseDate(v, year || 2000); });
  m.date = ds.indexOf(Math.max.apply(null, ds)); if (ds[m.date] === 0) m.date = -1;
  var numCols = []; for (var c = 0; c < n; c++) if (c !== m.date && ns[c] >= body.length * 0.6) numCols.push(c);
  m.inAmt = numCols.length ? numCols[0] : -1;
  var best = -1; for (c = 0; c < n; c++) if (c !== m.date && numCols.indexOf(c) < 0 && (best < 0 || ss[c] > ss[best])) best = c;
  m.name = best;
  return m;
}
var INTEREST = /^(이자|결산|예금이자|결산이자)$|이자$/;
/* 거래 만들기: 출금·0원·이자·다른 연도·미래·날짜오류 행은 제외(사유 표시) */
function buildTx(rows, map, opt) {
  opt = opt || {}; var year = opt.year, now = opt.today, seq = opt.seq || 0, out = [];
  rows.slice(map.header ? 1 : 0).forEach(function (r, i) {
    var cell = function (k) { return map[k] >= 0 && map[k] < r.length ? r[map[k]] : ''; };
    var raw = cell('name'), memo = cell('memo'), d = parseDate(cell('date'), year), a = parseAmount(cell('inAmt')), o = map.out >= 0 ? parseAmount(cell('out')) : 0;
    var t = { id: 't' + (++seq), row: i + 1, date: d || '', rawName: raw, amount: isNaN(a) ? 0 : a, memo: memo, bal: cell('bal'), donorId: null, status: 'ok', reason: '' };
    if (!d) { t.status = 'excluded'; t.reason = '날짜를 읽을 수 없음(' + (cell('date') || '빈칸') + ')'; }
    else if (isNaN(a) || isNaN(o)) { t.status = 'excluded'; t.reason = '금액을 읽을 수 없음'; t.amount = 0; }
    else if (o > 0 && !(a > 0)) { t.status = 'excluded'; t.reason = '출금'; t.amount = -o; }
    else if (a < 0) { t.status = 'excluded'; t.reason = '출금(음수 금액)'; }
    else if (a === 0) { t.status = 'excluded'; t.reason = '0원'; }
    else if (INTEREST.test(String(raw).trim()) || /이자/.test(memo) && !raw) { t.status = 'excluded'; t.reason = '이자·결산'; }
    else if (year && d.slice(0, 4) !== String(year)) { t.status = 'excluded'; t.reason = '다른 연도(' + d.slice(0, 4) + ')'; }
    else if (now && d > now) { t.status = 'excluded'; t.reason = '미래 날짜'; }
    out.push(t);
  });
  return out;
}
function txSig(t) { return [t.date, t.rawName, t.amount, t.memo, t.bal].join('|'); }
/* ---------- 입금자명 정규화 ---------- */
function normName(raw, suffixes) {
  var s = String(raw == null ? '' : raw).replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|（[^）]*）/g, ' ').replace(/[0-9０-９]/g, '').replace(/[^가-힣a-zA-Z]/g, '');
  var sf = (suffixes || []).slice().sort(function (a, b) { return b.length - a.length; }), changed = true;
  while (changed) {
    changed = false;
    for (var i = 0; i < sf.length; i++) {
      var x = sf[i]; if (!x) continue;
      if (s.length - x.length >= 2 && s.slice(-x.length) === x) { s = s.slice(0, -x.length); changed = true; }
      else if (s.length - x.length >= 2 && s.slice(0, x.length) === x) { s = s.slice(x.length); changed = true; }
    }
  }
  return s;
}
function isCorpName(raw) { return /\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|재단|법인/.test(String(raw)); }
function corpKey(raw) { return String(raw).replace(/\s+/g, '').replace(/[^가-힣a-zA-Z0-9()㈜]/g, ''); }
function ruleFor(t, rules, suffixes) {
  var raw = String(t.rawName).trim(), n = normName(raw, suffixes);
  for (var i = 0; i < rules.length; i++) { var p = String(rules[i].pattern).trim(); if (p && (p === raw || (normName(p, suffixes) === n && n))) return rules[i]; }
  return null;
}
/* 기부자 묶기: 고정(pin) → 별칭 규칙 → 같은 이름(정규화) → 새 기부자. 2자 미만이면 미매칭(null). */
function assign(tx, donors, rules, suffixes, mkId) {
  var ds = donors.slice(), byName = {}, n = 0;
  mkId = mkId || function () { var id; do { id = 'd' + (++n); } while (ds.some(function (d) { return d.id === id; })); return id; };
  ds.forEach(function (d) { if (!d.split) { var k = d.kind === 'corp' ? corpKey(d.name) : normName(d.name, suffixes); if (k && !byName[k]) byName[k] = d.id; } });
  var out = tx.map(function (t) {
    var c = Object.assign({}, t); c.via = '';
    if (c.status !== 'ok') { c.donorId = null; return c; }
    if (c.pin && ds.some(function (d) { return d.id === c.donorId; })) { c.via = 'pin'; return c; }
    c.pin = false;
    var r = ruleFor(c, rules, suffixes);
    if (r && ds.some(function (d) { return d.id === r.donorId; })) { c.donorId = r.donorId; c.via = 'rule'; return c; }
    var corp = isCorpName(c.rawName), k = corp ? corpKey(c.rawName) : normName(c.rawName, suffixes);
    if (!k || k.length < 2) { c.donorId = null; c.via = 'none'; return c; }
    if (!byName[k]) { var nd = blankDonor(mkId(), corp ? String(c.rawName).trim() : k); nd.kind = corp ? 'corp' : 'person'; ds.push(nd); byName[k] = nd.id; }
    c.donorId = byName[k]; c.via = 'name'; return c;
  });
  return { tx: out, donors: ds };
}
function blankDonor(id, name) { return { id: id, name: name, kind: 'person', rrn: '', address: '', phone: '', code: '', submittedEtax: false, receiptNo: '', issuedAt: '', split: false }; }
/* ---------- 주민등록번호·사업자번호 (형식만, 체크섬 없음) ---------- */
function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function rrnCheck(s) {
  var d = digits(s);
  if (!d) return { ok: false, code: 'empty', msg: '주민등록번호가 없어요' };
  if (d.length !== 13) return { ok: false, code: 'len', msg: '주민등록번호는 숫자 13자리예요(지금 ' + d.length + '자리)' };
  var g = +d[6]; if (g < 1 || g > 8) return { ok: false, code: 'g', msg: '7번째 자리는 1~8이어야 해요' };
  var y = (g <= 2 || g === 5 || g === 6 ? 1900 : 2000) + +d.slice(0, 2), mo = +d.slice(2, 4), dd = +d.slice(4, 6);
  if (mo < 1 || mo > 12 || dd < 1 || dd > dim(y, mo)) return { ok: false, code: 'date', msg: '앞 6자리가 올바른 생년월일이 아니에요' };
  return { ok: true, code: 'ok', msg: '' };
}
function bizCheck(s) { var d = digits(s); if (!d) return { ok: false, code: 'empty', msg: '사업자등록번호가 없어요' }; return d.length === 10 ? { ok: true, code: 'ok', msg: '' } : { ok: false, code: 'len', msg: '사업자등록번호·고유번호는 숫자 10자리예요' }; }
function idCheck(d) { return d.kind === 'corp' ? bizCheck(d.rrn) : rrnCheck(d.rrn); }
function maskRrn(s) { var d = digits(s); if (d.length < 7) return d ? d.slice(0, 6) + (d.length > 6 ? '-' + d[6] : '') + '******' : ''; return d.slice(0, 6) + '-' + d[6] + '******'; }
function fmtRrn(s) { var d = digits(s); return d.length === 13 ? d.slice(0, 6) + '-' + d.slice(6) : d; }
function fmtBiz(s) { var d = digits(s); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-' + d.slice(5) : d; }
function maskBiz(s) { var d = digits(s); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 5) + '-*****' : d ? '***' : ''; }
function maskId(d) { return d.kind === 'corp' ? maskBiz(d.rrn) : maskRrn(d.rrn); }
function fullId(d) { return d.kind === 'corp' ? fmtBiz(d.rrn) : fmtRrn(d.rrn); }
/* ---------- 집계 ---------- */
function okTx(tx) { return tx.filter(function (t) { return t.status === 'ok'; }); }
function totals(tx) { var m = {}; okTx(tx).forEach(function (t) { if (!t.donorId) return; var x = m[t.donorId] || (m[t.donorId] = { n: 0, amt: 0 }); x.n++; x.amt += t.amount; }); return m; }
function summary(tx, donors) {
  var ok = okTx(tx), tot = totals(tx), ex = tx.filter(function (t) { return t.status === 'excluded'; });
  return { n: ok.length, amt: ok.reduce(function (s, t) { return s + t.amount; }, 0), donors: donors.filter(function (d) { return tot[d.id]; }).length, unmatched: ok.filter(function (t) { return !t.donorId; }).length, excluded: ex.length, totals: tot };
}
/* ---------- 위험 점검 ---------- */
var FEE = /회비|등록비|수강료|교재|식대|참가비|입회비|월회비/;
function issueList(tx, donors, rules, acks, suffixes) {
  acks = acks || {}; var out = [], tot = totals(tx), ok = okTx(tx);
  var push = function (it) { it.acked = !!acks[it.key]; it.ack = acks[it.key] || null; out.push(it); };
  donors.forEach(function (d) {
    var t = tot[d.id]; if (!t) return;
    var c = idCheck(d);
    if (!c.ok) push({ key: 'id|' + d.id, level: 'red', kind: c.code === 'empty' ? 'id-missing' : 'id-format', donorId: d.id, title: d.name + ': ' + (d.kind === 'corp' ? '사업자등록번호' : '주민등록번호') + (c.code === 'empty' ? ' 없음' : ' 형식 오류'), text: c.msg + '. 인적사항을 적지 않거나 잘못 적어 발급하면 영수증 금액의 5% 가산세 대상이에요.', fixable: false });
    if (t.amt <= 0) push({ key: 'amt|' + d.id, level: 'red', kind: 'amt', donorId: d.id, title: d.name + ': 연간 합계 ' + won(t.amt), text: '0원 이하는 영수증을 발급할 수 없어요. 환불·정정 거래를 확인하세요.', fixable: false });
    var names = {};
    ok.forEach(function (x) { if (x.donorId === d.id && x.via === 'rule') { var nn = normName(x.rawName, suffixes); if (nn !== normName(d.name, suffixes)) (names[x.rawName] = names[x.rawName] || []).push(x); } });
    Object.keys(names).forEach(function (raw) {
      var xs = names[raw], amt = xs.reduce(function (s, x) { return s + x.amount; }, 0);
      push({ key: 'alias|' + d.id + '|' + raw, level: 'red', kind: 'alias', donorId: d.id, raw: raw, amount: amt, title: '입금자 "' + raw + '" → ' + d.name + ' 명의로 합산 (' + xs.length + '건 ' + won(amt) + ')', text: '실제로 기부한 사람 명의로만 발급하세요. 가족 등 다른 사람 명의로 발급하면 영수증에 적힌 금액의 5%가 가산세예요(국세청 Q&A). 실제 기부자가 ' + d.name + ' 님이 맞을 때만 "확인함"을 누르세요.', fixable: true });
    });
  });
  ok.filter(function (t) { return !t.donorId; }).forEach(function (t) { push({ key: 'un|' + t.id, level: 'yellow', kind: 'unmatched', txId: t.id, title: '누구 입금인지 모름: "' + (t.rawName || '빈칸') + '" ' + won(t.amount) + ' (' + t.date + ')', text: '기부자를 지정하거나 영수증 대상에서 빼 주세요.', fixable: true }); });
  var seen = {};
  ok.forEach(function (t) { if (!t.donorId) return; var k = t.donorId + '|' + t.date + '|' + t.amount; (seen[k] = seen[k] || []).push(t); });
  Object.keys(seen).forEach(function (k) { var xs = seen[k]; if (xs.length < 2) return; var d = byId(donors, xs[0].donorId);
    push({ key: 'dup|' + k, level: 'yellow', kind: 'dup', donorId: xs[0].donorId, txIds: xs.map(function (x) { return x.id; }), title: (d ? d.name : '') + ': 같은 날 같은 금액 ' + xs.length + '번 (' + xs[0].date + ' ' + won(xs[0].amount) + ')', text: '통장 내역을 두 번 붙여 넣었거나 실제로 두 번 낸 경우예요. 하나를 빼거나 둘 다 맞으면 "확인함"을 누르세요.', fixable: true }); });
  ok.forEach(function (t) { if (t.donorId && FEE.test(t.memo + ' ' + t.rawName)) push({ key: 'fee|' + t.id, level: 'yellow', kind: 'fee', donorId: t.donorId, txId: t.id, title: '회비 성격일 수 있음: "' + (t.memo || t.rawName) + '" ' + won(t.amount), text: '회비·대가성 입금이 기부금인지는 단체가 판단해요(앱은 판단하지 않아요). 기부금이 아니면 빼 주세요.', fixable: true }); });
  return out;
}
function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
function donorLevel(issues, donorId) {
  var lv = 'green'; issues.forEach(function (it) { if (it.acked || it.donorId !== donorId) return; if (it.level === 'red') lv = 'red'; else if (lv !== 'red') lv = 'yellow'; }); return lv;
}
/* ---------- 가산세 (정수 계산, 원 미만 버림) ---------- */
function pen(amount, num, den) { return Math.floor(Math.max(0, Math.round(amount)) * num / den); }
function penaltyRisk(issues, donors, totalsMap, RJ, paperTotal, ledgerKept) {
  var P = {}; RJ.penalties.forEach(function (p) { P[p.id] = p; });
  var redDonors = {}; issues.forEach(function (it) { if (!it.acked && it.level === 'red' && it.donorId && totalsMap[it.donorId]) redDonors[it.donorId] = totalsMap[it.donorId].amt; });
  var infoBase = Object.keys(redDonors).reduce(function (s, k) { return s + Math.max(0, redDonors[k]); }, 0);
  return { infoBase: infoBase, info: pen(infoBase, P.info.num, P.info.den), ledgerBase: ledgerKept ? 0 : paperTotal, ledger: ledgerKept ? 0 : pen(paperTotal, P.ledger.num, P.ledger.den), donors: Object.keys(redDonors).length };
}
/* ---------- 영수증·발급명세 ---------- */
function receiptLines(donorId, tx, gran) {
  var xs = okTx(tx).filter(function (t) { return t.donorId === donorId; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  if (gran === 'each') return xs.map(function (t) { return { date: t.date, label: t.date.replace(/-/g, '.'), amount: t.amount, n: 1 }; });
  var m = {}, order = [];
  xs.forEach(function (t) { var k = t.date.slice(0, 7); if (!m[k]) { m[k] = { date: k, label: k.replace('-', '.') + ' (월 합계 ' , amount: 0, n: 0, first: t.date, last: t.date }; order.push(k); } m[k].amount += t.amount; m[k].n++; m[k].last = t.date; });
  return order.map(function (k) { var x = m[k]; x.label = k.replace('-', '.') + '. (' + x.n + '회)'; return x; });
}
var MAX_EACH = 24;
function effGran(lines, gran) { return gran === 'each' && lines > MAX_EACH ? 'month' : gran; }
function receiptNo(year, seq) { return year + '-' + pad(seq, 4); }
/* 발급번호: 이미 있는 번호는 유지, 없는 기부자에게 이름순으로 다음 번호 */
function assignNos(donors, ids, year, start, issueDate) {
  var used = donors.map(function (d) { var m = new RegExp('^' + year + '-(\\d{4,})$').exec(d.receiptNo || ''); return m ? +m[1] : 0; });
  var next = Math.max(start ? start - 1 : 0, Math.max.apply(null, used.concat([0]))) + 1, out = [];
  var targets = donors.filter(function (d) { return ids.indexOf(d.id) >= 0 && !d.receiptNo; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
  var map = {}; targets.forEach(function (d) { map[d.id] = receiptNo(year, next++); });
  return donors.map(function (d) { if (!map[d.id]) return d; var c = Object.assign({}, d); c.receiptNo = map[d.id]; c.issuedAt = issueDate; return c; });
}
function codeGroup(code, C) { var c = (C.codes || []).filter(function (x) { return x.code === code; })[0]; return c ? c.group : 'other'; }
/* 발급합계표: 종이 발급 대상(합계>0, 전자 제출 안 함) — 개인/법인 × 합계·특례(10)·일반(40·41) */
function sumTable(donors, totalsMap, C, defCode) {
  var z = function () { return { n: 0, amt: 0 }; }, t = { person: { all: z(), special: z(), general: z() }, corp: { all: z(), special: z(), general: z() } };
  donors.forEach(function (d) {
    var x = totalsMap[d.id]; if (!x || x.amt <= 0 || d.submittedEtax) return;
    var row = t[d.kind === 'corp' ? 'corp' : 'person'], g = codeGroup(d.code || defCode, C);
    row.all.n++; row.all.amt += x.amt; if (g === 'special') { row.special.n++; row.special.amt += x.amt; } if (g === 'general') { row.general.n++; row.general.amt += x.amt; }
  });
  return t;
}
function csvCell(v) { var s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s) && !/^-?\d[\d,.]*$/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCSV(rows) { return '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }
function ledgerRows(donors, tx, org, gran, defCode) {
  var rows = [['일련번호', '기부일자', '기부자 성명(상호)', '주민등록번호(사업자등록번호)', '주소(사업장)', '내용', '코드', '금액', '발급번호', '발급일자']], i = 0;
  donors.slice().sort(function (a, b) { return (a.receiptNo || 'z' + a.name).localeCompare(b.receiptNo || 'z' + b.name, 'ko'); }).forEach(function (d) {
    if (d.submittedEtax) return;
    var ls = receiptLines(d.id, tx, effGran(receiptLines(d.id, tx, 'each').length, gran)); if (!ls.length) return;
    ls.forEach(function (l) { rows.push([++i, l.n > 1 || l.date.length === 7 ? l.date + ' (' + l.n + '회 합계)' : l.date, d.name, d.rrn ? fullId(d) : '', d.address, '금전', d.code || defCode, l.amount, d.receiptNo || '', d.issuedAt || '']); });
  });
  return rows;
}
/* 전자 발급 준비표: 기부일자별(국세청: 전자는 기부일자별 입력). 열 순서는 앱 기준 — 홈택스 서식에 옮겨 붙이세요 */
function etaxRows(donors, tx, defCode, includeSubmitted) {
  var rows = [['기부자구분', '성명(상호)', '주민등록번호(사업자등록번호)', '기부일자(YYYYMMDD)', '기부금액', '기부금코드', '구분']], dupe = [];
  donors.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); }).forEach(function (d) {
    var ls = receiptLines(d.id, tx, 'each'); if (!ls.length) return;
    if (d.submittedEtax) { dupe.push(d.id); if (!includeSubmitted) return; }
    ls.forEach(function (l) { rows.push([d.kind === 'corp' ? '사업자' : '개인', d.name, d.rrn ? fullId(d) : '', l.date.replace(/-/g, ''), l.amount, d.code || defCode, '금전']); });
  });
  return { rows: rows, submitted: dupe };
}
function smsText(org, year, dateText) {
  return '[' + (org.name || '우리 단체') + '] ' + year + '년 기부금영수증 안내\n' + year + '년 기부금영수증은 ' + (dateText || '1월 ○일') + '부터 드려요.\n· 전자기부금영수증으로 발급되면 연말정산 간소화 서비스에서 자동으로 조회돼요(별도 제출 불필요).\n· 종이 영수증이 필요하시면 재정부로 말씀해 주세요.\n· 영수증은 실제로 입금·헌금하신 분 명의로만 발급돼요. 가족 명의로 입금하셨다면 미리 알려 주세요.\n문의: ' + (org.tel || '사무실');
}
/* ---------- 일정·.ics ---------- */
function schedule(year, RJ, issueDate) {
  var y1 = +year + 1, D = RJ.deadlines, ev = [];
  var mk = function (id, md, title, desc, alarms, extra) { var d = y1 + '-' + md, w = dow(d); var e = { id: id, date: d, title: title, desc: desc, alarms: alarms, weekend: w === 0 || w === 6 }; for (var k in extra || {}) e[k] = extra[k]; ev.push(e); };
  mk('recommend', D.recommend.md, year + '년 기부금영수증 발급 시작(권장)', D.recommend.text, [3], { verified: false });
  mk('etax', D.etaxMandatory.md, '전자기부금영수증 발급 기한(의무 단체)', D.etaxMandatory.text, [7, 2]);
  mk('summary', D.summary.md, year + '년 기부금영수증 발급합계표 제출 기한', D.summary.text, [14, 3]);
  if (isD(issueDate)) ev.push({ id: 'keep', date: addYears(issueDate, D.keep.years), title: '기부자별 발급명세 보관 기간 끝(' + issueDate + ' 발급분)', desc: D.keep.text, alarms: [], weekend: false });
  return ev;
}
function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function fold(line) {
  var out = [], cur = '', bytes = 0;
  for (var i = 0; i < line.length; i++) { var ch = line[i], b = unescape(encodeURIComponent(ch)).length, lim = out.length ? 74 : 75; if (bytes + b > lim) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; }
  out.push(cur); return out.join('\r\n ');
}
function ics(events, now) {
  var n = now || new Date();
  var st = n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()) + 'T' + pad(n.getUTCHours()) + pad(n.getUTCMinutes()) + pad(n.getUTCSeconds()) + 'Z';
  var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//' + APP_ID + '//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:기부금영수증 일정'];
  events.forEach(function (e) {
    var d = e.date.replace(/-/g, '');
    L.push('BEGIN:VEVENT', 'UID:' + e.id + '-' + d + '@' + APP_ID, 'DTSTAMP:' + st, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''), 'SUMMARY:' + icsEsc(e.title));
    if (e.desc) L.push('DESCRIPTION:' + icsEsc(e.desc));
    (e.alarms || []).forEach(function (a) { L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:-P' + a + 'D', 'END:VALARM'); });
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
}
/* ---------- 내보내기/가져오기 (주민번호 항상 제외) ---------- */
function stripRrn(donors) { return donors.map(function (d) { var c = Object.assign({}, d); delete c.rrn; return c; }); }
function exportObj(st) { return { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), note: '주민등록번호는 들어 있지 않아요.', org: st.org, donors: stripRrn(st.donors), rules: st.rules, tx: st.tx, settings: { receiptSeqStart: st.settings.receiptSeqStart, gran: st.settings.gran, acks: st.settings.acks || {} } }; }
function str(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, max || 200); }
function cleanDonor(d) {
  if (!d || typeof d !== 'object' || !/^[\w-]{1,40}$/.test(String(d.id || ''))) return null;
  return { id: String(d.id), name: str(d.name, 60).trim() || '이름 없음', kind: d.kind === 'corp' ? 'corp' : 'person', rrn: '', address: str(d.address, 200), phone: str(d.phone, 30), code: /^\d{2}$/.test(d.code || '') ? d.code : '', submittedEtax: !!d.submittedEtax, receiptNo: /^\d{4}-\d{4,}$/.test(d.receiptNo || '') ? d.receiptNo : '', issuedAt: isD(d.issuedAt) ? d.issuedAt : '', split: !!d.split, manual: !!d.manual };
}
function cleanTx(t) {
  if (!t || typeof t !== 'object') return null;
  return { id: /^[\w-]{1,40}$/.test(String(t.id || '')) ? String(t.id) : 't' + Math.random().toString(36).slice(2, 9), row: +t.row || 0, date: isD(t.date) ? t.date : '', rawName: str(t.rawName, 80), amount: isFinite(+t.amount) ? Math.round(+t.amount) : 0, memo: str(t.memo, 120), bal: str(t.bal, 30), donorId: t.donorId ? String(t.donorId) : null, status: ['ok', 'excluded', 'removed'].indexOf(t.status) >= 0 ? t.status : 'ok', reason: str(t.reason, 80), pin: !!t.pin, manual: !!t.manual };
}
function cleanOrg(o) { o = o && typeof o === 'object' ? o : {}; return { name: str(o.name, 80), bizNo: digits(o.bizNo).slice(0, 10), address: str(o.address, 200), rep: str(o.rep, 40), tel: str(o.tel, 30), type: str(o.type, 20), lawCode: /^\d{3}$/.test(o.lawCode || '') ? o.lawCode : '', defaultCode: /^\d{2}$/.test(o.defaultCode || '') ? o.defaultCode : '41', year: /^\d{4}$/.test(String(o.year)) ? +o.year : 0, issueDate: isD(o.issueDate) ? o.issueDate : '' }; }
function sanitizeImport(o) {
  if (!o || typeof o !== 'object' || o.app !== APP_ID || o.version !== 1) return null;
  var donors = (Array.isArray(o.donors) ? o.donors : []).map(cleanDonor).filter(Boolean);
  var tx = (Array.isArray(o.tx) ? o.tx : []).slice(0, 50000).map(cleanTx).filter(Boolean);
  var rules = (Array.isArray(o.rules) ? o.rules : []).filter(function (r) { return r && r.pattern && r.donorId; }).map(function (r) { return { pattern: str(r.pattern, 80), donorId: String(r.donorId) }; });
  return { org: cleanOrg(o.org), donors: donors, tx: tx, rules: rules, settings: o.settings && typeof o.settings === 'object' ? o.settings : {} };
}
function pageTitle(h, app) { var t = String(h == null ? '' : h).replace(/\s+/g, ' ').trim(); return (!t || t === app) ? app : t + ' — ' + app; }
/* ---------- 명부 CSV: 성명, 주민번호(사업자번호), 주소, 연락처, 구분 ---------- */
function parseRoster(text) {
  var t = parseTable(text).rows; if (!t.length) return [];
  var h = t[0], hasHead = h.some(function (x) { return /성명|이름/.test(x); }), idx = { name: 0, id: 1, addr: 2, phone: 3, kind: 4 };
  if (hasHead) h.forEach(function (x, i) { if (/성명|이름/.test(x)) idx.name = i; else if (/주민|사업자|번호/.test(x) && !/연락|전화/.test(x)) idx.id = i; else if (/주소/.test(x)) idx.addr = i; else if (/연락|전화|휴대/.test(x)) idx.phone = i; else if (/구분|유형/.test(x)) idx.kind = i; });
  return t.slice(hasHead ? 1 : 0).map(function (r) { return { name: (r[idx.name] || '').trim(), rrn: digits(r[idx.id]), address: r[idx.addr] || '', phone: r[idx.phone] || '', kind: /사업|법인/.test(r[idx.kind] || '') || digits(r[idx.id]).length === 10 ? 'corp' : 'person' }; }).filter(function (x) { return x.name; });
}
/* ---------- 자체 점검 ---------- */
function selfTest(C, RJ, SF) {
  var res = []; function eq(name, got, exp) { res.push({ name: name, pass: JSON.stringify(got) === JSON.stringify(exp), got: got, exp: exp }); }
  eq('날짜 형식 5종', [parseDate('2026.01.04 08:13:15'), parseDate('2026/1/4'), parseDate('2026-01-04'), parseDate('20260104'), parseDate('01-04', 2026)], ['2026-01-04', '2026-01-04', '2026-01-04', '2026-01-04', '2026-01-04']);
  eq('잘못된 날짜 거부(2/30·13월)', [parseDate('2026.02.30'), parseDate('2026-13-01'), parseDate('3/4')], [null, null, null]);
  eq('금액: 쉼표·원·괄호·음수', [parseAmount('1,234,000'), parseAmount('50,000원'), parseAmount('(10,000)'), parseAmount('-3,000'), parseAmount(''), isNaN(parseAmount('abc'))], [1234000, 50000, -10000, -3000, 0, true]);
  eq('정규화: 접미어·괄호·숫자', [normName('김하늘십일조', SF), normName('이바다(남편)', SF), normName('박소망 감사헌금', SF), normName('조믿음2', SF), normName('주', SF)], ['김하늘', '이바다', '박소망', '조믿음', '주']);
  eq('주민번호 형식: 정상·13월·7번째 9·자리수', [rrnCheck('800215-1000001').ok, rrnCheck('801345-2000008').code, rrnCheck('800215-9000001').code, rrnCheck('80021510').code, rrnCheck('').code], [true, 'date', 'g', 'len', 'empty']);
  eq('주민번호 체크섬 미사용(2020.10 이후 번호 허용)', rrnCheck('201015-3123456').ok, true);
  eq('2000년대 윤년 생일 000229-3', [rrnCheck('000229-3000000').ok, rrnCheck('010229-3000000').code], [true, 'date']);
  eq('마스킹', [maskRrn('8002151000001'), maskBiz('0008100001')], ['800215-1******', '000-81-*****']);
  var rows = parseTable('거래일시,보낸분,출금액,입금액,메모\n2026.01.04,김하늘십일조,0,"100,000",\n2026.01.05,관리비,"50,000",0,\n2026.01.06,이자,0,12,\n2026.01.11,김하늘 감사,0,"50,000",\n2026.01.11,정평화,0,0,\n2025.12.28,박소망,0,"10,000",\n2026.01.18,주,0,"5,000",').rows;
  var m = guessMap(rows, 2026); eq('열 자동 추정(머리글)', [m.header, m.date, m.name, m.out, m.inAmt, m.memo], [true, 0, 1, 2, 3, 4]);
  var tx = buildTx(rows, m, { year: 2026, today: '2026-10-31' });
  eq('제외: 출금·이자·0원·다른 연도', tx.filter(function (t) { return t.status === 'excluded'; }).map(function (t) { return t.reason; }), ['출금', '이자·결산', '0원', '다른 연도(2025)']);
  var a = assign(tx, [], [], SF); var tot = totals(a.tx);
  eq('같은 이름 묶기: 김하늘 2건 150,000, "주"는 미매칭', [a.donors.length, a.donors[0].name, tot[a.donors[0].id].amt, a.tx.filter(function (t) { return t.status === 'ok' && !t.donorId; }).length], [1, '김하늘', 150000, 1]);
  var tx2 = buildTx(parseTable('날짜\t입금자\t입금\n2026-02-01\t최민호\t200000\n2026-02-08\t최기쁨\t100000').rows, { header: true, date: 0, name: 1, inAmt: 2, out: -1, memo: -1, bal: -1 }, { year: 2026 });
  var a2 = assign(tx2, [], [], SF), target = a2.donors.filter(function (d) { return d.name === '최기쁨'; })[0];
  var a3 = assign(a2.tx, a2.donors, [{ pattern: '최민호', donorId: target.id }], SF), t3 = totals(a3.tx);
  var is3 = issueList(a3.tx, a3.donors, [], {}, SF).filter(function (i) { return i.kind === 'alias'; });
  eq('별칭 규칙 → 즉시 재집계 + 빨강 경고', [t3[target.id].amt, is3.length, is3[0].level, is3[0].amount], [300000, 1, 'red', 200000]);
  eq('가산세 5%·0.2% (원 미만 버림)', [pen(200000, 5, 100), pen(1234567, 5, 100), pen(31450000, 2, 1000), pen(1234567, 2, 1000)], [10000, 61728, 62900, 2469]);
  var ds = [{ id: 'a', name: '나', receiptNo: '' }, { id: 'b', name: '가', receiptNo: '2026-0003' }, { id: 'c', name: '다', receiptNo: '' }];
  eq('발급번호 연속(기존 유지, 이름순)', assignNos(ds, ['a', 'b', 'c'], 2026, 1, '2027-01-08').map(function (d) { return d.receiptNo; }), ['2026-0004', '2026-0003', '2026-0005']);
  var sd = [{ id: 'p1', kind: 'person', code: '41' }, { id: 'p2', kind: 'person', code: '10' }, { id: 'c1', kind: 'corp', code: '40' }, { id: 'p3', kind: 'person', code: '41', submittedEtax: true }];
  var st = sumTable(sd, { p1: { amt: 1000000 }, p2: { amt: 300000 }, c1: { amt: 2000000 }, p3: { amt: 500000 } }, C, '41');
  eq('발급합계표: 개인/법인 × 특례/일반, 전자 제출분 제외', [st.person.all, st.person.special, st.person.general, st.corp.all, st.corp.general], [{ n: 2, amt: 1300000 }, { n: 1, amt: 300000 }, { n: 1, amt: 1000000 }, { n: 1, amt: 2000000 }, { n: 1, amt: 2000000 }]);
  var ev = schedule(2026, RJ, '2027-01-08');
  eq('일정: 1/10(일) 주말 표시·6/30·5년 보관', [ev[1].date, ev[1].weekend, ev[2].date, ev[2].weekend, ev[3].date], ['2027-01-10', true, '2027-06-30', false, '2032-01-08']);
  var ic = ics(ev, new Date(Date.UTC(2026, 9, 31)));
  eq('.ics 종일·알림·줄 길이', [/DTSTART;VALUE=DATE:20270630/.test(ic), /TRIGGER:-P14D/.test(ic), ic.split('\r\n').every(function (x) { return unescape(encodeURIComponent(x)).length <= 75; })], [true, true, true]);
  var ex = exportObj({ org: {}, donors: [{ id: 'x', name: '가', rrn: '8002151000001' }], rules: [], tx: [], settings: { receiptSeqStart: 1 } });
  eq('JSON 내보내기에 주민번호 없음', [JSON.stringify(ex).indexOf('8002151000001'), 'rrn' in ex.donors[0]], [-1, false]);
  eq('가져오기: 다른 앱 거부·주민번호 버림', [sanitizeImport({ app: 'x', version: 1 }), sanitizeImport({ app: APP_ID, version: 1, donors: [{ id: 'a', name: '가', rrn: '8002151000001' }] }).donors[0].rrn], [null, '']);
  eq('CSV: BOM·따옴표·수식 방지', [toCSV([['a,b', '=1+1']]).charCodeAt(0), toCSV([['a,b', '=1+1']]).slice(1)], [0xFEFF, '"a,b",\'=1+1\r\n']);
  eq('pageTitle 중복 없음', [pageTitle('기부금영수증 정리함', '기부금영수증 정리함'), pageTitle('출력', 'A'), pageTitle('', 'A')], ['기부금영수증 정리함', '출력 — A', 'A']);
  var pass = res.filter(function (r) { return r.pass; }).length;
  return { pass: pass, fail: res.length - pass, total: res.length, results: res };
}
return { APP_ID: APP_ID, pad: pad, parseD: parseD, isD: isD, addDays: addDays, addYears: addYears, dow: dow, today: today, fmtD: fmtD, fmtDot: fmtDot, parseDate: parseDate, parseAmount: parseAmount, won: won, num: num,
  parseTable: parseTable, guessMap: guessMap, buildTx: buildTx, txSig: txSig, normName: normName, isCorpName: isCorpName, ruleFor: ruleFor, assign: assign, blankDonor: blankDonor,
  digits: digits, rrnCheck: rrnCheck, bizCheck: bizCheck, idCheck: idCheck, maskRrn: maskRrn, maskBiz: maskBiz, maskId: maskId, fmtRrn: fmtRrn, fmtBiz: fmtBiz, fullId: fullId,
  okTx: okTx, totals: totals, summary: summary, issueList: issueList, byId: byId, donorLevel: donorLevel, pen: pen, penaltyRisk: penaltyRisk,
  receiptLines: receiptLines, effGran: effGran, MAX_EACH: MAX_EACH, receiptNo: receiptNo, assignNos: assignNos, codeGroup: codeGroup, sumTable: sumTable, toCSV: toCSV, ledgerRows: ledgerRows, etaxRows: etaxRows, smsText: smsText,
  schedule: schedule, ics: ics, stripRrn: stripRrn, exportObj: exportObj, cleanDonor: cleanDonor, cleanTx: cleanTx, cleanOrg: cleanOrg, sanitizeImport: sanitizeImport, pageTitle: pageTitle, parseRoster: parseRoster, selfTest: selfTest };
});
