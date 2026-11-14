/* 우리 팀 2027 연휴 지도 — 계산 엔진 (UMD: window.LeaveMap / require). 날짜는 'YYYY-MM-DD' 문자열, 내부는 UTC 일수. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lib/lz-string.min.js'));
  else root.LeaveMap = factory(root.LZString);
})(typeof self !== 'undefined' ? self : this, function (LZ) {
  'use strict';
  const DAY = 86400000, RE = /^\d{4}-\d{2}-\d{2}$/;
  const toN = s => { if (!RE.test(s || '')) return null; const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); const n = t / DAY; return toISO(n) === s ? n : null; };
  const toISO = n => new Date(n * DAY).toISOString().slice(0, 10);
  const isDate = s => toN(s) !== null;
  const addDays = (s, k) => toISO(toN(s) + k);
  const diff = (a, b) => toN(a) - toN(b);
  const weekday = s => new Date(toN(s) * DAY).getUTCDay(); // 0=일
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const md = s => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  const fmt = (s, o) => o === 'long' ? `${s.slice(0, 4)}. ${+s.slice(5, 7)}. ${+s.slice(8, 10)}.(${WD[weekday(s)]})` : o === 'y' && s.slice(0, 4) !== '2027' ? `${s.slice(0, 4)}/${md(s)}(${WD[weekday(s)]})` : `${md(s)}(${WD[weekday(s)]})`;
  const range = (a, b) => { const out = []; for (let n = toN(a); n <= toN(b); n++) out.push(toISO(n)); return out; };
  const D0 = '2027-01-01', D1 = '2027-12-31', DEND = '2028-01-02';

  /* ---------- 공휴일 ---------- */
  const MODES = ['official', 'noSubstitute', 'custom'];
  function calendar(H, mode, custom) {
    mode = MODES.includes(mode) ? mode : 'official'; custom = custom || {};
    const map = new Map();
    H.holidays.forEach(h => { if (mode === 'noSubstitute' && h.type === 'sub') return; if (mode === 'custom' && (custom.removed || []).includes(h.date)) return; map.set(h.date, { name: h.name, type: h.type }); });
    if (mode === 'custom') (custom.added || []).forEach(c => { if (isDate(c.date)) map.set(c.date, { name: c.name || '회사 휴일', type: 'custom' }); });
    const cal = {
      mode, map,
      holiday: d => map.get(d) || null,
      isOff: d => { const w = weekday(d); return w === 0 || w === 6 || map.has(d); },
      kind: d => { const h = map.get(d); if (h) return h.type; const w = weekday(d); return w === 0 || w === 6 ? 'weekend' : null; }
    };
    return cal;
  }
  /* 관공서의 공휴일에 관한 규정 제3조를 그대로 구현해 대체공휴일을 다시 계산(자체 검증용) */
  function deriveSubstitutes(H) {
    const R = H.substituteRule; const base = H.holidays.filter(h => h.type === 'holiday');
    const isBase = d => base.some(h => h.date === d); const subs = [];
    const taken = d => subs.some(s => s.date === d);
    const trig = [];
    base.forEach(h => {
      const w = weekday(h.date);
      if (R.satSun.includes(h.cat) && (w === 0 || w === 6)) trig.push(h);
      else if (R.sunOnly.includes(h.cat) && w === 0) trig.push(h);
      else if (!R.none.includes(h.cat) && w !== 0 && w !== 6 && base.filter(x => x.date === h.date).length > 1) trig.push(h);
    });
    trig.forEach(h => {
      let c = addDays(h.date, 1);
      while (weekday(c) === 0 || weekday(c) === 6 || isBase(c) || taken(c)) c = addDays(c, 1);
      subs.push({ date: c, of: h.name, cat: h.cat });
    });
    return subs.sort((a, b) => a.date < b.date ? -1 : 1);
  }
  function countRestDays(cal, from, to) {
    let wk = 0, hol = 0; range(from || D0, to || D1).forEach(d => { const w = weekday(d); if (w === 0 || w === 6) wk++; else if (cal.holiday(d)) hol++; });
    return { weekend: wk, weekdayHolidays: hol, total: wk + hol };
  }
  /* 연차 날짜 → 이어지는 휴무 구간 */
  function restSpan(cal, leaveDates) {
    const set = new Set((leaveDates || []).filter(isDate));
    const off = d => cal.isOff(d) || set.has(d);
    const leave = [...set].filter(d => !cal.isOff(d)).sort();
    if (!leave.length) return null;
    const spans = []; let i = 0;
    while (i < leave.length) {
      let s = leave[i], e = leave[i];
      while (off(addDays(s, -1)) && toN(addDays(s, -1)) >= toN('2026-12-26')) s = addDays(s, -1);
      while (off(addDays(e, 1)) && toN(addDays(e, 1)) <= toN('2028-01-09')) e = addDays(e, 1);
      const inSpan = leave.filter(d => d >= s && d <= e);
      spans.push({ start: s, end: e, days: diff(e, s) + 1, leave: inSpan.length, leaveDates: inSpan });
      i += inSpan.length;
    }
    const total = spans.reduce((a, x) => a + x.days, 0);
    return { spans, start: spans[0].start, end: spans[spans.length - 1].end, days: spans.length === 1 ? spans[0].days : total, leave: leave.length, leaveDates: leave, contiguous: spans.length === 1, efficiency: Math.round(total / leave.length * 10) / 10 };
  }
  /* 최대(더 늘리려면 연차가 더 필요한) 휴무 구간 후보 */
  function windows(cal, maxLeave, needHoliday) {
    maxLeave = maxLeave || 5; const days = range(D0, DEND); const out = [];
    const isWork = i => i >= 0 && i < days.length && !cal.isOff(days[i]);
    for (let s = 0; s < days.length; s++) {
      if (s > 0 && !isWork(s - 1)) continue;
      let leave = 0, hasH = false;
      for (let e = s; e < days.length; e++) {
        if (isWork(e)) { leave++; if (leave > maxLeave) break; }
        const k = cal.kind(days[e]); if (k && k !== 'weekend' && weekday(days[e]) !== 0 && weekday(days[e]) !== 6) hasH = true;
        if (e + 1 < days.length && !isWork(e + 1)) continue;
        if (leave < 1 || toN(days[s]) > toN(D1)) continue;
        if (!isWork(s) && !isWork(e) || isWork(s) || isWork(e)) {
          if (needHoliday && !hasH) continue;
          const len = e - s + 1; const ld = days.slice(s, e + 1).filter((d, j) => isWork(s + j));
          out.push({ start: days[s], end: days[e], days: len, leave, leaveDates: ld, efficiency: Math.round(len / leave * 10) / 10, holiday: hasH });
        }
      }
    }
    return out;
  }
  /* 혼자 계산하기: 연차 n일로 겹치지 않는 연휴 구간 조합 중 총 휴무일 최대 (동률이면 연차 적게, 이른 날짜) */
  function bestCombo(cal, n) {
    n = Math.max(0, Math.min(25, n | 0));
    const W = windows(cal, 5, true).sort((a, b) => a.end < b.end ? -1 : a.end > b.end ? 1 : a.start < b.start ? -1 : 1);
    const prev = W.map((w, i) => { let j = i - 1; while (j >= 0 && toN(W[j].end) + 1 >= toN(w.start)) j--; return j; });
    const better = (a, b) => !b || a.rest > b.rest || (a.rest === b.rest && a.leave < b.leave);
    const memo = new Map();
    function f(i, b) {
      if (i < 0 || b <= 0) return { rest: 0, leave: 0, pick: [] };
      const key = i * 64 + b; if (memo.has(key)) return memo.get(key);
      let best = f(i - 1, b); const w = W[i];
      if (w.leave <= b) { const r = f(prev[i], b - w.leave); const c = { rest: r.rest + w.days, leave: r.leave + w.leave, pick: r.pick.concat([i]) }; if (better(c, best)) best = c; }
      memo.set(key, best); return best;
    }
    const r = f(W.length - 1, n);
    return { n, totalRest: r.rest, leaveUsed: r.leave, picks: r.pick.map(i => W[i]) };
  }

  /* ---------- SHA-256 (순수 JS, Web Crypto와 같은 값 — 테스트로 대조) ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(str) {
    const msg = new TextEncoder().encode(String(str)); const l = msg.length; const nb = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(nb); buf.set(msg); buf[l] = 0x80; const dv = new DataView(buf.buffer);
    dv.setUint32(nb - 4, (l * 8) >>> 0); dv.setUint32(nb - 8, Math.floor(l / 0x20000000));
    const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); const w = new Uint32Array(64);
    const rr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) { const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0, S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0; hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0; }
      h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
    }
    return [...h].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  /* 공개 추첨: seedHash = SHA-256(시드 + "|" + 마감), 각 팀원 키 = SHA-256(seedHash + ":" + 팀원 id) 오름차순 */
  function lottery(memberIds, seed, deadline) {
    const seedHash = sha256(String(seed || '') + '|' + String(deadline || ''));
    const keyed = memberIds.map(id => ({ id, key: sha256(seedHash + ':' + id) })).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    return { seedHash, order: keyed.map((x, i) => ({ id: x.id, pos: i + 1, key: x.key })) };
  }

  /* ---------- 팀 ---------- */
  function minStaffOn(team, d) { const m = team.minStaff || {}; const o = m.overrides || {}; if (o[d] != null) return +o[d]; if (o[d.slice(0, 7)] != null) return +o[d.slice(0, 7)]; return +(m.default || 0); }
  const pickDates = (cal, p) => (p.dates || []).filter(d => isDate(d) && !cal.isOff(d));
  const amount = (p, d) => p.half && p.half[d] ? 0.5 : 1;
  function latestWishes(wishes) { const m = new Map(); (wishes || []).forEach(w => { const o = m.get(w.memberId); if (!o || String(w.submittedAt) >= String(o.submittedAt)) m.set(w.memberId, w); }); return m; }
  function buddyOf(team, id) { const m = team.members.find(x => x.id === id); if (m && m.buddyId) return m.buddyId; const r = team.members.find(x => x.buddyId === id); return r ? r.id : null; }
  const josa = (w, withB, noB) => { const c = String(w).charCodeAt(String(w).length - 1); if (!(c >= 0xAC00 && c <= 0xD7A3)) return w + noB + '(' + withB + ')'; return w + ((c - 0xAC00) % 28 ? withB : noB); };
  const alias = (team, id) => (team.members.find(m => m.id === id) || {}).alias || id;
  const leaveDays = (cal, p) => pickDates(cal, p).reduce((a, d) => a + amount(p, d), 0);

  function heat(team, wishes, cal, o) {
    o = o || {}; const N = team.members.length; const W = latestWishes(wishes); const days = {};
    W.forEach(w => (w.picks || []).forEach(p => { if (o.rank1Only && p.rank !== 1) return; pickDates(cal, p).forEach(d => { const x = days[d] = days[d] || { date: d, ids: new Set(), r1: new Set(), amt: 0 }; if (!x.ids.has(w.memberId)) { x.ids.add(w.memberId); x.amt += amount(p, d); } if (p.rank === 1) x.r1.add(w.memberId); }); }));
    const out = {}; Object.values(days).forEach(x => {
      const min = minStaffOn(team, x.date); const allowed = Math.max(0, N - min); const ids = [...x.ids];
      const pairs = []; ids.forEach(a => { const b = buddyOf(team, a); if (b && x.ids.has(b) && a < b) pairs.push([a, b]); });
      out[x.date] = { date: x.date, count: ids.length, ids, present: N - x.amt, min, allowed, short: N - x.amt < min, excess: Math.max(0, Math.ceil(x.amt - allowed)), buddy: pairs, level: Math.min(4, Math.floor(ids.length / Math.max(1, N) * 5)) };
    });
    /* 충돌 구간: 희망 2명 이상인 근무일을 휴무일을 건너 이어 묶음 */
    const ds = Object.keys(out).filter(d => out[d].count >= 2).sort(); const segs = []; let cur = null;
    ds.forEach(d => { if (cur) { let gap = true; for (let c = addDays(cur.end, 1); c < d; c = addDays(c, 1)) if (!cal.isOff(c)) { gap = false; break; } if (gap) { cur.end = d; cur.dates.push(d); return; } } cur = { start: d, end: d, dates: [d] }; segs.push(cur); });
    segs.forEach(s => { s.maxCount = Math.max(...s.dates.map(d => out[d].count)); s.maxExcess = Math.max(...s.dates.map(d => out[d].excess)); s.short = s.dates.some(d => out[d].short); s.buddy = s.dates.some(d => out[d].buddy.length); s.min = Math.max(...s.dates.map(d => out[d].min)); });
    const top = segs.sort((a, b) => b.maxExcess - a.maxExcess || b.maxCount - a.maxCount || b.dates.length - a.dates.length || (a.start < b.start ? -1 : 1)).slice(0, 5);
    const buddyWarn = []; Object.values(out).forEach(x => x.buddy.forEach(([a, b]) => { let g = buddyWarn.find(z => z.a === a && z.b === b); if (!g) buddyWarn.push(g = { a, b, dates: [] }); g.dates.push(x.date); }));
    buddyWarn.forEach(g => g.dates.sort());
    return { days: out, top, buddyWarn, submitted: W.size, total: N };
  }

  function assign(team, wishes, cal, opts) {
    opts = opts || {}; const rule = team.rule || {}; const N = team.members.length;
    const W = latestWishes(wishes); const ids = team.members.map(m => m.id);
    const lot = lottery(ids, rule.seed, rule.deadline); const pos = {}; lot.order.forEach(x => pos[x.id] = x.pos);
    const absent = {}; const absentBy = {}; // date -> amount, date -> Set(id)
    const log = []; const assignments = {}; const forbidBuddy = rule.forbidBuddy !== false;
    const cls = id => { const m = team.members.find(x => x.id === id) || {}; const w = W.get(id) || {}; if (rule.type === 'rotation') return m.missed ? 0 : 1; if (rule.type === 'needFirst') return w.need ? 0 : 1; return 0; };
    const clsLabel = id => rule.type === 'rotation' && cls(id) === 0 ? '지난 연휴 우선권, ' : rule.type === 'needFirst' && cls(id) === 0 ? '필수 사유 우선, ' : '';
    function check(id, p) {
      const ds = pickDates(cal, p); if (!ds.length) return { ok: false, why: '근무일이 없는 선택' };
      for (const d of ds) {
        const min = minStaffOn(team, d); const present = N - (absent[d] || 0) - amount(p, d);
        if (present < min) return { ok: false, why: `${md(d)} 출근 ${present}명 < 최소 ${min}명`, date: d };
        if (forbidBuddy) { const b = buddyOf(team, id); if (b && absentBy[d] && absentBy[d].has(b)) return { ok: false, why: `${md(d)} 대행자 ${josa(alias(team, b), '과', '와')} 동시 부재`, date: d }; }
      }
      const worst = Math.min(...ds.map(d => N - (absent[d] || 0) - amount(p, d) - minStaffOn(team, d)));
      const wd = ds.find(d => N - (absent[d] || 0) - amount(p, d) - minStaffOn(team, d) === worst);
      return { ok: true, present: N - (absent[wd] || 0) - amount(p, wd), min: minStaffOn(team, wd), date: wd };
    }
    function take(id, p) { pickDates(cal, p).forEach(d => { absent[d] = (absent[d] || 0) + amount(p, d); (absentBy[d] = absentBy[d] || new Set()).add(id); }); }
    const label = p => { const ds = pickDates(cal, p); return ds.length > 3 ? md(ds[0]) + '~' + md(ds[ds.length - 1]) : ds.map(md).join('·'); };
    for (let r = 1; r <= 3; r++) {
      const q = ids.filter(id => !assignments[id] && W.has(id) && (W.get(id).picks || []).some(p => p.rank === r)).sort((a, b) => cls(a) - cls(b) || pos[a] - pos[b]);
      q.forEach(id => {
        const p = W.get(id).picks.find(x => x.rank === r); const c = check(id, p);
        if (c.ok) { take(id, p); assignments[id] = { memberId: id, rank: r, dates: pickDates(cal, p), half: p.half || {}, label: p.label || label(p), status: 'approved', leave: leaveDays(cal, p), span: restSpan(cal, p.dates) }; log.push(`${label(p)}: ${alias(team, id)} ${r}순위 승인 — ${clsLabel(id)}추첨 ${pos[id]}위, 출근 ${c.present}명 ≥ 최소 ${c.min}명`); }
        else log.push(`${label(p)}: ${alias(team, id)} ${r}순위 조정 필요 — ${clsLabel(id)}추첨 ${pos[id]}위, ${c.why}`);
      });
    }
    /* 대안: 같은 달(1순위 첫 날짜 기준) 남는 날 중 최소 인원·대행자 조건을 지키는 효율 높은 구간 2개, 부족하면 다른 달 */
    const cands = windows(cal, 5, false);
    const alternatives = [];
    ids.forEach(id => {
      if (assignments[id]) return; const w = W.get(id);
      if (!w || !(w.picks || []).length) { assignments[id] = { memberId: id, rank: null, dates: [], status: 'none', label: '제출 없음' }; return; }
      const p1 = w.picks.slice().sort((a, b) => a.rank - b.rank)[0]; const d1 = pickDates(cal, p1)[0] || '2027-01-01';
      const cap = Math.max(1, Math.ceil(Math.max(...w.picks.map(p => leaveDays(cal, p)))));
      const ok = cands.filter(c => c.leave <= cap && check(id, { dates: c.leaveDates }).ok).map(c => Object.assign({}, c, { sameMonth: c.start.slice(0, 7) === d1.slice(0, 7) || c.end.slice(0, 7) === d1.slice(0, 7) }));
      ok.sort((a, b) => (b.sameMonth - a.sameMonth) || b.efficiency - a.efficiency || b.days - a.days || Math.abs(diff(a.start, d1)) - Math.abs(diff(b.start, d1)));
      const opts2 = []; for (const c of ok) { if (opts2.length >= 2) break; if (opts2.some(x => !(toN(c.end) < toN(x.start) - 1 || toN(c.start) > toN(x.end) + 1))) continue; opts2.push(c); }
      assignments[id] = { memberId: id, rank: null, dates: [], status: 'alt', label: opts2.length ? '대안 제안' : '대안 없음 — 팀장 직접 협의' };
      alternatives.push({ memberId: id, options: opts2.map(c => ({ dates: c.leaveDates, start: c.start, end: c.end, days: c.days, leave: c.leave, efficiency: c.efficiency, sameMonth: c.sameMonth })), none: !opts2.length });
      log.push(`${alias(team, id)}: 모든 순위 조정 필요 → ${opts2.length ? '대안 ' + opts2.map(c => md(c.start) + '~' + md(c.end) + '(' + c.days + '일)').join(', ') : '대안 없음 — 팀장 직접 협의'}`);
    });
    /* 최소 인원 검증 */
    let minOk = true; const dayPresent = {}; Object.keys(absent).forEach(d => { dayPresent[d] = N - absent[d]; if (dayPresent[d] < minStaffOn(team, d)) minOk = false; });
    return { runAt: opts.runAt || null, rule: { type: rule.type || 'rankLottery', seed: rule.seed || '', deadline: rule.deadline || '', forbidBuddy }, seedHash: lot.seedHash, order: lot.order.map(x => ({ memberId: x.id, pos: x.pos })), assignments: ids.map(id => assignments[id]), alternatives, log, dayPresent, minOk };
  }

  /* ---------- 공유 코드 ---------- */
  const lz = { c: s => LZ.compressToEncodedURIComponent(s), d: s => LZ.decompressFromEncodedURIComponent(s) };
  const clean = (s, n) => String(s == null ? '' : s).replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, n);
  function encodeTeam(t) {
    const o = { v: 1, i: t.id, n: t.name, m: t.members.map(m => [m.id, m.alias, m.role || '', m.buddyId || '', m.missed ? 1 : 0]), s: [t.minStaff.default, t.minStaff.overrides || {}], h: t.holidayMode, c: t.custom || {}, r: [t.rule.type, t.rule.seed, t.rule.deadline, t.rule.forbidBuddy === false ? 0 : 1], f: t.under5 ? 1 : 0 };
    return lz.c(JSON.stringify(o));
  }
  function decodeTeam(code) {
    const raw = lz.d(String(code || '').trim()); if (!raw) throw new Error('bad'); const o = JSON.parse(raw); if (!o || o.v !== 1 || !Array.isArray(o.m)) throw new Error('bad');
    const members = o.m.slice(0, 30).map(x => ({ id: clean(x[0], 12), alias: clean(x[1], 20), role: clean(x[2], 20), buddyId: clean(x[3], 12) || null, missed: !!x[4] })).filter(m => m.id && m.alias);
    if (!members.length) throw new Error('bad');
    const ov = {}; Object.entries((o.s && o.s[1]) || {}).forEach(([k, v]) => { if ((/^\d{4}-\d{2}(-\d{2})?$/.test(k)) && Number.isInteger(v) && v >= 0 && v <= 30) ov[k] = v; });
    const cu = o.c || {}; const custom = { added: (cu.added || []).filter(x => x && isDate(x.date)).slice(0, 30).map(x => ({ date: x.date, name: clean(x.name, 20) })), removed: (cu.removed || []).filter(isDate).slice(0, 30) };
    const r = o.r || [];
    return { id: clean(o.i, 16), name: clean(o.n, 30), members, minStaff: { default: Math.max(0, Math.min(30, parseInt(o.s && o.s[0], 10) || 0)), overrides: ov }, holidayMode: MODES.includes(o.h) ? o.h : 'official', custom, rule: { type: ['rotation', 'rankLottery', 'needFirst'].includes(r[0]) ? r[0] : 'rankLottery', seed: clean(r[1], 60), deadline: clean(r[2], 20), forbidBuddy: r[3] !== 0 }, under5: !!o.f };
  }
  const WISH_RE = /W1\.[A-Za-z0-9+\-$]+/g;
  function encodeWish(w) {
    const o = { v: 1, t: w.teamId, m: w.memberId, a: w.alias, p: w.picks.map(p => [p.rank, p.dates, p.label || '', p.half || {}]), n: w.need ? 1 : 0, at: w.submittedAt };
    return 'W1.' + lz.c(JSON.stringify(o));
  }
  function decodeWish(code) {
    const s = String(code || '').trim(); if (!/^W1\./.test(s)) throw new Error('bad'); const raw = lz.d(s.slice(3)); if (!raw) throw new Error('bad');
    const o = JSON.parse(raw); if (!o || o.v !== 1 || !Array.isArray(o.p)) throw new Error('bad');
    const picks = o.p.filter(p => Array.isArray(p) && [1, 2, 3].includes(p[0]) && Array.isArray(p[1])).slice(0, 3).map(p => { const half = {}; Object.entries(p[3] || {}).forEach(([d, v]) => { if (isDate(d) && (v === 'am' || v === 'pm')) half[d] = v; }); return { rank: p[0], dates: p[1].filter(d => isDate(d) && d >= D0 && d <= D1).slice(0, 31), label: clean(p[2], 40), half }; }).filter(p => p.dates.length);
    const ranks = new Set(); const uniq = picks.filter(p => !ranks.has(p.rank) && ranks.add(p.rank));
    return { teamId: clean(o.t, 16), memberId: clean(o.m, 12), alias: clean(o.a, 20), picks: uniq, need: !!o.n, submittedAt: clean(o.at, 30) };
  }
  function parseWishCodes(text) { const found = String(text || '').match(WISH_RE) || []; const ok = [], bad = []; found.forEach(c => { try { ok.push(decodeWish(c)); } catch (e) { bad.push(c.slice(0, 16)); } }); return { ok, bad, found: found.length }; }

  /* ---------- 내보내기 ---------- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { const out = []; let cur = '', bytes = 0; for (const ch of line) { const b = new TextEncoder().encode(ch).length; if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; } out.push(cur); return out.map((l, i) => (i ? ' ' : '') + l).join('\r\n'); }
  function toICS(events, o) {
    o = o || {}; const stamp = new Date(o.now || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//team-2027-holiday-leave-map//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(o.calName || '2027 연휴 계획')];
    events.forEach((e, i) => {
      L.push('BEGIN:VEVENT', 'UID:lm-' + e.start.replace(/-/g, '') + '-' + i + '-' + (o.uid || 'x') + '@webapp-daily', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + e.start.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(e.end || e.start, 1).replace(/-/g, ''),
        'SUMMARY:' + icsEsc(e.title), 'DESCRIPTION:' + icsEsc((e.desc ? e.desc + '\n' : '') + '조율 도구이며 법률 자문 아님 · 회사 신청 절차는 별도'), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.alarmText || e.title), 'TRIGGER:' + (e.alarm || '-P30D'), 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
  }
  function memberEvents(team, result, id, applyBy) {
    const a = result.assignments.find(x => x.memberId === id); if (!a || a.status !== 'approved') return [];
    const sp = a.span; const ev = [{ start: sp.start, end: sp.end, title: `2027 연휴 ${sp.days}일 (연차 ${a.leave}일)`, desc: '연차 날짜: ' + a.dates.map(d => md(d) + (a.half && a.half[d] ? '(반차)' : '')).join(', ') + ` · ${a.rank}순위 확정`, alarm: '-P30D', alarmText: '휴가 30일 전 — 회사 연차 신청 확인' }];
    if (isDate(applyBy)) ev.push({ start: applyBy, end: applyBy, title: '연차 신청 기한 (팀 공지)', desc: `${fmt(sp.start)}~${fmt(sp.end, 'y')} 휴가 연차 신청`, alarm: '-P1D', alarmText: '내일이 연차 신청 기한이에요' });
    return ev;
  }
  const csvCell = v => { const s = String(v == null ? '' : v); const t = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  function toCSV(team, result) {
    const rows = [['팀원', '역할', '결과', '확정 순위', '연차 날짜', '연차 일수', '휴무 시작', '휴무 끝', '휴무 일수', '대안 1', '대안 2']];
    result.assignments.forEach(a => {
      const m = team.members.find(x => x.id === a.memberId) || {}; const alt = result.alternatives.find(x => x.memberId === a.memberId);
      const ao = i => alt && alt.options[i] ? `${alt.options[i].start}~${alt.options[i].end} (연차 ${alt.options[i].leave}일)` : '';
      rows.push([m.alias, m.role || '', a.status === 'approved' ? '확정' : a.status === 'alt' ? (alt && alt.none ? '대안 없음 — 팀장 직접 협의' : '대안 제안') : '제출 없음', a.rank || '', (a.dates || []).join(' '), a.leave || '', a.span ? a.span.start : '', a.span ? a.span.end : '', a.span ? a.span.days : '', ao(0), ao(1)]);
    });
    return '\ufeff' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  const RULE_NAME = { rotation: '순번제(지난 연휴 우선권 → 공개 추첨)', rankLottery: '순위 우선 + 공개 추첨', needFirst: '필수 사유 우선 → 공개 추첨' };
  function ruleNotice(team, link) {
    const r = team.rule; const missed = team.members.filter(m => m.missed).map(m => m.alias);
    return [`[${team.name}] 2027 연휴 연차 조율 기준 안내`, '', `• 배정 규칙: ${RULE_NAME[r.type] || RULE_NAME.rankLottery}`,
      '• 순서: 모든 사람의 1순위를 먼저 보고, 겹치면 규칙 순서대로 → 조정이 필요하면 2순위 → 3순위',
      r.type === 'rotation' ? `• 지난 연휴 우선권: ${missed.length ? missed.join(', ') : '없음'}` : r.type === 'needFirst' ? '• "꼭 필요한 사유 있음" 체크자 우선(사유 내용은 받지 않아요)' : '',
      `• 공개 추첨 시드: "${r.seed}" + 마감 ${r.deadline} → SHA-256으로 순서를 정해 누구나 같은 결과를 확인할 수 있어요`,
      `• 날짜별 최소 출근 ${team.minStaff.default}명${Object.keys(team.minStaff.overrides || {}).length ? ' (예외: ' + Object.entries(team.minStaff.overrides).map(([k, v]) => k + ' ' + v + '명').join(', ') + ')' : ''}`,
      r.forbidBuddy !== false ? '• 대행자 짝은 같은 날 함께 비우지 않도록 조율' : '', `• 희망 제출 마감: ${r.deadline}`, '• 조정이 필요한 분께는 대안 날짜를 함께 안내드려요',
      link ? `• 희망 제출 링크: ${link}` : '', '', '※ 팀 내 사전 조율 도구이며 법률 자문이 아니에요. 휴가 시기는 근로자 청구가 원칙이에요.'].filter(x => x !== '').join('\n');
  }
  function decisionNotice(team, result) {
    const lines = [`[${team.name}] 2027 연휴 연차 조율 결과`, '', `규칙: ${RULE_NAME[result.rule.type]} · 시드 "${result.rule.seed}" + ${result.rule.deadline}`, `추첨 해시: ${result.seedHash.slice(0, 16)}… (같은 팀 링크·희망 코드·시드로 [배정 실행]하면 같은 결과가 나와요)`, ''];
    result.assignments.forEach(a => { const n = alias(team, a.memberId); if (a.status === 'approved') lines.push(`✅ ${n}: ${a.rank}순위 ${a.label} → ${fmt(a.span.start)}~${fmt(a.span.end, 'y')} ${a.span.days}일`); else if (a.status === 'alt') { const alt = result.alternatives.find(x => x.memberId === a.memberId); lines.push(`🔄 ${n}: 조정 필요 — ${alt.none ? '대안 없음, 팀장과 직접 협의' : '대안 ' + alt.options.map(o => fmt(o.start) + '~' + fmt(o.end, 'y') + '(' + o.days + '일, 연차 ' + o.leave + '일)').join(' / ')}`); } else lines.push(`· ${n}: 제출 없음`); });
    lines.push('', `날짜별 최소 출근 인원 ${result.minOk ? '모두 지켰어요' : '확인 필요'}.`, '※ 팀 내 사전 조율 도구이며 법률 자문이 아니에요.');
    return lines.join('\n');
  }
  function adjustNotice(team, result, id, replyBy) {
    const alt = result.alternatives.find(x => x.memberId === id); if (!alt) return '';
    const w = result.log.filter(l => l.includes(alias(team, id) + ' 1순위')).map(l => l.split(':')[0])[0] || '희망하신 날짜';
    const opt = alt.options.map(o => `${fmt(o.start)}~${fmt(o.end, 'y')}(${o.days}일, 연차 ${o.leave}일)`);
    return [`${alias(team, id)}님, 희망하신 ${w}은(는) 날짜별 최소 출근 인원 기준으로 조정이 필요합니다.`, alt.none ? '지금 남는 날 중에서는 바로 제안드릴 구간을 찾지 못했어요. 편한 시간에 직접 이야기 나눠요.' : `대신 ${opt.join(' 또는 ')}를 제안드립니다.`, `다른 날짜를 원하시면 ${replyBy || '○일'}까지 알려 주세요.`, '', '이 앱은 팀 내 사전 조율 도구이며, 법적 판단이 필요하면 회사 인사담당·노무사와 확인하세요.'].join('\n');
  }

  function runSelfTest(H) {
    const f = []; const eq = (a, b, n) => { if (a !== b) f.push(n + ': ' + a + ' ≠ ' + b); };
    const cal = calendar(H, 'official');
    eq(countRestDays(cal).total, 119, '119일'); eq(H.holidays.filter(h => h.type === 'sub').length, 7, '대체 7개');
    eq(deriveSubstitutes(H).map(s => s.date).join(','), H.holidays.filter(h => h.type === 'sub').map(h => h.date).join(','), '대체 규칙 재계산');
    H.presets.forEach(p => { const s = restSpan(cal, p.leave); eq(s.start + '~' + s.end + ':' + s.days, p.expect.start + '~' + p.expect.end + ':' + p.expect.days, p.id); });
    eq(restSpan(calendar(H, 'noSubstitute'), ['2027-05-04']).days, 2, '대체 미적용 5/4');
    eq(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256');
    return { ok: !f.length, fails: f };
  }
  return { toN, toISO, isDate, addDays, diff, weekday, fmt, md, range, WD, MODES, calendar, deriveSubstitutes, countRestDays, restSpan, windows, bestCombo, sha256, lottery, minStaffOn, latestWishes, buddyOf, heat, assign, encodeTeam, decodeTeam, encodeWish, decodeWish, parseWishCodes, WISH_RE, toICS, fold, icsEsc, memberEvents, toCSV, csvCell, ruleNotice, decisionNotice, adjustNotice, RULE_NAME, runSelfTest, leaveDays, pickDates, josa };
});
