/* 팀플 증거노트 엔진 — 순수 함수(브라우저 window.TPN / node require). 서버·외부 요청 없음. */
(function (root, factory) { const m = factory(); if (typeof module === 'object' && module.exports) module.exports = m; else root.TPN = m; })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* ---------- 날짜 (기기 현지 시각, 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:mm' 문자열) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const toN = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
  const fromN = n => { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const addDays = (s, n) => fromN(toN(s) + n);
  const diffDays = (a, b) => toN(a) - toN(b);
  const weekday = s => new Date(toN(s) * 864e5).getUTCDay();
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromN(toN(s)) === s;
  const isAt = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && isDate(s.slice(0, 10)) && +s.slice(11, 13) < 24 && +s.slice(14, 16) < 60;
  const localAt = (d) => { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const md = s => s ? `${+s.slice(5, 7)}/${+s.slice(8, 10)}` : '';
  const mdw = s => s ? `${md(s)}(${WD[weekday(s)]})` : '';
  const hm = at => at && at.length > 10 ? at.slice(11, 16) : '';
  const minutesBetween = (a, b) => (toN(a) - toN(b)) * 1440 + (+a.slice(11, 13) * 60 + +a.slice(14, 16)) - (+b.slice(11, 13) * 60 + +b.slice(14, 16));
  const addMinutes = (at, m) => { let n = toN(at) * 1440 + +at.slice(11, 13) * 60 + +at.slice(14, 16) + m; const day = Math.floor(n / 1440); n -= day * 1440; return fromN(day) + 'T' + pad(Math.floor(n / 60)) + ':' + pad(n % 60); };
  const josa = (w, a, b) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); if (c >= 0xac00 && c <= 0xd7a3) return w + ((c - 0xac00) % 28 ? a : b); return w + a + '(' + b + ')'; };

  /* ---------- SHA-256 (순수 JS, Web Crypto와 같은 값 — E2E로 대조) ---------- */
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256bytes(str) {
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
    const out = new Uint8Array(32); const ov = new DataView(out.buffer); h.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
  }
  const sha256 = s => [...sha256bytes(s)].map(b => b.toString(16).padStart(2, '0')).join('');
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32(bytes) { let bits = 0, val = 0, out = ''; for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; }
  /* 키 순서와 무관한 직렬화 — 해시 입력용 */
  function stable(v) { if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v); if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']'; return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'; }

  /* ---------- 카톡 대화 내보내기 파서 ---------- */
  const FMT_NAME = { android: '안드로이드', ios: '아이폰', iosOld: '아이폰(예전 형식)', iosEn: '아이폰(영어 설정)', pc: 'Windows PC', pcEn: 'Windows PC(영어 설정)', mac: 'Mac(CSV)' };
  const EN_M = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12, January: 1, February: 2, March: 3, April: 4, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
  function compile(P) {
    if (P._c) return P._c; const L = P.lines; const r = s => new RegExp(s);
    P._c = { header: L.header.map(r), pcDate: r(L.pcDate), pcDateEn: r(L.pcDateEn), iosDate: r(L.iosDate), androidDate: r(L.androidDate), androidMsg: r(L.androidMsg), androidSys: r(L.androidSys), iosOldMsg: r(L.iosOldMsg), iosOldSys: r(L.iosOldSys), iosEnMsg: r(L.iosEnMsg), iosEnSys: r(L.iosEnSys), iosMsg: r(L.iosMsg), iosSys: r(L.iosSys), pcMsg: r(L.pcMsg), standaloneSystem: r(L.standaloneSystem), looksLikeHeader: r(L.looksLikeHeader), file: new RegExp(P.file, 'i'), promise: r(P.promise), done: r(P.done), request: r(P.request), pronouns: new RegExp(P.pronouns, 'g'), particle: r(P.particle) };
    return P._c;
  }
  const h24 = (ap, h, m) => { h = +h; if (ap === '오전') h = h === 12 ? 0 : h; else if (ap === '오후') h = h === 12 ? 12 : h + 12; return pad(h) + ':' + pad(m); };
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  function parseCSV(text) { const rows = []; let row = [], cur = '', q = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += ch; } if (cur || row.length) { row.push(cur); rows.push(row); } return rows; }
  function parseKakao(text, P) {
    const C = compile(P); text = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const msgs = [], unparsed = [], st = { lines: 0, msg: 0, date: 0, system: 0, meta: 0, cont: 0, unparsed: 0 }, fmtCount = {};
    const push = (fmt, date, time, name, body, n) => { fmtCount[fmt] = (fmtCount[fmt] || 0) + 1; const m = { i: msgs.length, line: n, at: date + 'T' + time, name: name.trim(), text: body, fmt }; msgs.push(m); st.msg++; return m; };
    if (/^\s*Date,User,Message\s*$/.test(text.split('\n')[0])) {
      const rows = parseCSV(text.trim()); st.meta = 1; st.lines = rows.length;
      rows.slice(1).forEach((r, k) => { const m = r.length === 3 && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(r[0]); if (m && r[1]) push('mac', `${m[1]}-${m[2]}-${m[3]}`, `${m[4]}:${m[5]}`, r[1], r[2], k + 2); else { st.unparsed++; unparsed.push({ n: k + 2, line: r.join(',').slice(0, 80) }); } });
      return finish();
    }
    let cur = null, curDate = null; const lines = text.split('\n');
    lines.forEach((raw, k) => {
      const n = k + 1, line = raw.replace(/\s+$/, ''); if (!line.trim()) return; st.lines++; let m;
      if (!msgs.length && !cur && C.header.some(re => re.test(line))) { st.meta++; return; }
      if ((m = C.pcDate.exec(line))) { curDate = ymd(m[1], m[2], m[3]); st.date++; cur = null; return; }
      if ((m = C.pcDateEn.exec(line)) && EN_M[m[1]]) { curDate = ymd(m[3], EN_M[m[1]], m[2]); st.date++; cur = null; return; }
      if ((m = C.iosDate.exec(line))) { curDate = ymd(m[1], m[2], m[3]); st.date++; cur = null; return; }
      if ((m = C.androidDate.exec(line))) { curDate = ymd(m[1], m[2], m[3]); st.date++; cur = null; return; }
      if ((m = C.androidMsg.exec(line))) { cur = push('android', ymd(m[1], m[2], m[3]), h24(m[4], m[5], m[6]), m[7], m[8], n); return; }
      if ((m = C.androidSys.exec(line))) { st.system++; cur = null; return; }
      if ((m = C.iosOldMsg.exec(line))) { cur = push('iosOld', ymd(m[1], m[2], m[3]), h24(m[4], m[5], m[6]), m[7], m[8], n); return; }
      if ((m = C.iosOldSys.exec(line))) { st.system++; cur = null; return; }
      if ((m = C.iosEnMsg.exec(line)) && EN_M[m[1]]) { cur = push('iosEn', ymd(m[3], EN_M[m[1]], m[2]), pad(m[4]) + ':' + m[5], m[6], m[7], n); return; }
      if ((m = C.iosEnSys.exec(line)) && EN_M[m[1]] && !/ : /.test(m[6])) { st.system++; cur = null; return; }
      if (curDate && (m = C.iosMsg.exec(line))) { cur = push('ios', curDate, h24(m[1], m[2], m[3]), m[4], m[5], n); return; }
      if (curDate && (m = C.iosSys.exec(line))) { st.system++; cur = null; return; }
      if (curDate && (m = C.pcMsg.exec(line))) { cur = push('pc', curDate, m[2] ? h24(m[2], m[3], m[4]) : pad(m[3]) + ':' + m[4], m[1], m[5], n); return; }
      if (C.standaloneSystem.test(line) && /습니다\.?$/.test(line.trim())) { st.system++; cur = null; return; }
      if (!cur || C.looksLikeHeader.test(line)) { st.unparsed++; unparsed.push({ n, line: line.slice(0, 80) }); if (cur) cur.text += '\n' + line; return; }
      cur.text += '\n' + line; st.cont++;
    });
    return finish();
    function finish() {
      msgs.forEach(m => { m.file = m.text.split('\n').some(l => C.file.test(l.trim())); });
      const fmt = Object.keys(fmtCount).sort((a, b) => fmtCount[b] - fmtCount[a])[0] || null;
      const denom = st.msg + st.unparsed; const sp = {};
      msgs.forEach(m => { const s = sp[m.name] || (sp[m.name] = { name: m.name, count: 0, first: m.at, last: m.at, dates: [] }); s.count++; s.last = m.at > s.last ? m.at : s.last; const d = m.at.slice(0, 10); if (!s.dates.includes(d)) s.dates.push(d); });
      return { messages: msgs, stats: Object.assign(st, { rate: denom ? st.msg / denom : 0, ratePct: denom ? Math.floor(st.msg / denom * 1000) / 10 : 0, format: fmt, formatName: fmt ? FMT_NAME[fmt] : '알 수 없음', formats: fmtCount }), unparsed, speakers: Object.values(sp) };
    }
  }

  /* ---------- 날짜 표현 → 기한 (메시지 시각 기준) ---------- */
  const WDK = '일월화수목금토';
  function resolveDue(text, baseAt) {
    const s = String(text || ''); const base = baseAt.slice(0, 10); const bw = weekday(base); let date = null, expr = '', m;
    const withYear = (mo, d) => { let y = +base.slice(0, 4); if (mo < 1 || mo > 12 || d < 1 || d > 31) return null; let c = ymd(y, mo, d); if (!isDate(c)) return null; if (diffDays(c, base) < -180) c = ymd(y + 1, mo, d); return isDate(c) ? c : null; };
    if ((m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s))) { date = withYear(+m[1], +m[2]); expr = m[0]; }
    else if ((m = /(?<![\d/:.])(\d{1,2})\/(\d{1,2})(?![\d/])/.exec(s))) { date = withYear(+m[1], +m[2]); expr = m[0]; }
    else if ((m = /(이번\s?주|다음\s?주|담주)?\s?([일월화수목금토])요일/.exec(s))) {
      const X = WDK.indexOf(m[2]); const mon = addDays(base, -((bw + 6) % 7));
      if (m[1]) date = addDays(mon, (X + 6) % 7 + (/다음|담/.test(m[1]) ? 7 : 0)); else date = addDays(base, (X - bw + 7) % 7);
      expr = m[0].trim();
    }
    else if ((m = /(오늘|금일|내일|낼|모레|글피)/.exec(s))) { date = addDays(base, { 오늘: 0, 금일: 0, 내일: 1, 낼: 1, 모레: 2, 글피: 3 }[m[1]]); expr = m[0]; }
    else if ((m = /(?<![\d/])(\d{1,2})\s?일\s?(까지|안에|전까지|에)/.exec(s))) { const d = +m[1]; let c = ymd(base.slice(0, 4), +base.slice(5, 7), d); if (!isDate(c) || diffDays(c, base) < 0) { const nm = addDays(base.slice(0, 8) + '01', 32); c = ymd(nm.slice(0, 4), +nm.slice(5, 7), d); } date = isDate(c) ? c : null; expr = m[1] + '일'; }
    if (!date) return null;
    let time = '23:59', tm;
    if ((tm = /(오전|오후|밤|저녁|아침|새벽|낮)?\s?(\d{1,2})\s?시\s?(반|(\d{1,2})\s?분)?/.exec(s))) { let h = +tm[2]; const ap = tm[1]; if ((ap === '오후' || ap === '밤' || ap === '저녁' || ap === '낮') && h < 12) h += 12; if (ap === '오전' && h === 12) h = 0; if (h === 24) { h = 23; } const mi = tm[3] === '반' ? 30 : tm[4] ? +tm[4] : 0; if (h < 24 && mi < 60) time = pad(h) + ':' + pad(h === 23 && +tm[2] === 24 ? 59 : mi); }
    else if ((tm = /(?<!\d)(\d{1,2}):(\d{2})(?!\d)/.exec(s)) && +tm[1] < 24) time = pad(tm[1]) + ':' + tm[2];
    return { date, time, expr };
  }
  const DATE_EXPR = /(\d{1,2}\s*월\s*\d{1,2}\s*일|(?<![\d/])\d{1,2}\/\d{1,2}(?![\d/])|(이번\s?주|다음\s?주|담주)?\s?[일월화수목금토]요일|오늘\s?밤|오늘|금일|내일|낼|모레|글피|\d{1,2}\s?일(?=\s?(까지|안에|전까지|에))|(오전|오후|밤|저녁|아침|새벽|낮)?\s?\d{1,2}\s?시(\s?반|\s?\d{1,2}\s?분)?)(\s?(까지|안에|전까지|에|중으로|중에))?/g;
  function taskOf(sentence, kind, P) {
    const C = compile(P); let s = String(sentence || '').replace(/https?:\/\/\S+/g, ' ');
    const re = kind === 'promise' ? C.promise : kind === 'done' ? C.done : null; let m;
    if (re && (m = re.exec(s))) s = s.slice(0, m.index);
    s = s.replace(DATE_EXPR, ' ').replace(/[!?~.,…]+/g, ' ').replace(/ㅋ+|ㅎ+|ㅠ+|ㅜ+/g, ' ').replace(C.pronouns, ' ').replace(/\s+/g, ' ').trim();
    const ws = s.split(' ').filter(Boolean).map((w, i, a) => i < a.length - 1 && w.length >= 3 && /[은는]$/.test(w) ? w.slice(0, -1) : w); if (ws.length) { const last = ws.length - 1; const t = ws[last].replace(C.particle, ''); if (t.length) ws[last] = t; else ws.pop(); }
    return ws.join(' ').slice(0, 24).trim();
  }
  function bigrams(s) { s = String(s || '').replace(/\s+/g, ''); const out = new Set(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out; }
  function similarity(a, b) { const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return String(a || '').replace(/\s/g, '') === String(b || '').replace(/\s/g, '') && !!a ? 1 : 0; let i = 0; A.forEach(x => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); }
  const quoteOf = t => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > 200 ? t.slice(0, 199) + '…' : t; };
  /* 채택 후보: 약속·완료·요청 + 무응답 구간. 결과는 "후보"일 뿐, 사용자가 ✓로 채택 */
  function candidates(parsed, P, opt) {
    const C = compile(P); opt = opt || {}; const today = opt.today; const out = []; const M = parsed.messages;
    M.forEach((m, idx) => {
      const sentences = m.text.split(/\n|(?<=[.!?~])\s+/).map(x => x.trim()).filter(Boolean); const seen = {};
      const add = (kind, extra) => { if (seen[kind]) return; seen[kind] = 1; out.push(Object.assign({ id: 'c' + idx + kind[0], kind, msg: idx, name: m.name, at: m.at, quote: quoteOf(m.text) }, extra)); };
      sentences.forEach(sn => {
        if (C.promise.test(sn)) {
          let due = resolveDue(sn, m.at) || resolveDue(m.text, m.at);
          if (!due) { const nx = M.slice(idx + 1, idx + 3).find(x => x.name === m.name && minutesBetween(x.at, m.at) <= 30); if (nx) due = resolveDue(nx.text, m.at); }
          add('promise', { task: taskOf(sn, 'promise', P), due: due ? due.date : '', dueTime: due ? due.time : '', dueExpr: due ? due.expr : '' });
        }
        if (C.done.test(sn)) add('done', { task: taskOf(sn, 'done', P) });
        if (C.request.test(sn)) add('request', { task: '' });
      });
      if (m.file) { const fl = m.text.split('\n').map(l => l.trim()).find(l => C.file.test(l)) || ''; add('done', { task: (fl.replace(/^파일:\s*/, '') || '파일').slice(0, 40), file: true }); }
    });
    const names = parsed.speakers.map(s => s.name);
    parsed.speakers.forEach(s => {
      const after = M.filter(m => m.at > s.last && m.name !== s.name && new RegExp('(@\\s?' + esc(s.name) + '|' + esc(s.name) + '(님|씨|아|야)?)').test(m.text));
      const days = today ? diffDays(today, s.last.slice(0, 10)) : 0;
      if (today && days >= (opt.noReplyDays || 3)) out.push({ id: 'n_' + s.name, kind: 'noreply', name: s.name, at: s.last, days, mentions: after.length, task: '', quote: `마지막 메시지 ${md(s.last)} ${hm(s.last)} · 이후 이름이 불린 메시지 ${after.length}건` });
    });
    return out.filter(c => names.includes(c.name));
  }
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* ---------- 장부 항목 + SHA-256 해시 체인 ---------- */
  const TYPES = { promise: '맡음', done: '완료', late: '지연', request: '요청', noreply: '무응답', meeting: '회의 참석', absent: '회의 불참', agree: '합의', memo: '메모' };
  const HASH_FIELDS = ['id', 'type', 'memberId', 'task', 'size', 'due', 'dueTime', 'at', 'evidence', 'createdAt', 'edits', 'deleted', 'deletedAt', 'link', 'stepLevel', 'meta'];
  const content = e => { const o = {}; HASH_FIELDS.forEach(k => { if (e[k] !== undefined) o[k] = e[k]; }); return o; };
  const entryHash = (prev, e) => sha256((prev || '') + stable(content(e)));
  function rechain(entries) { let prev = ''; return entries.map(e => { const x = Object.assign({}, e, { prevHash: prev }); x.hash = entryHash(prev, x); prev = x.hash; return x; }); }
  function verifyChain(entries) {
    let prev = ''; const bad = [];
    (entries || []).forEach((e, i) => { if (e.prevHash !== prev || e.hash !== entryHash(prev, e)) bad.push(i); prev = e.hash; });
    return { ok: !bad.length, bad, count: (entries || []).length, last: prev };
  }
  function addEntry(entries, e) { return rechain(entries.concat([e])); }
  function editEntry(entries, id, patch, nowAt) {
    return rechain(entries.map(e => { if (e.id !== id) return e; const before = {}; Object.keys(patch).forEach(k => { if (stable(e[k]) !== stable(patch[k])) before[k] = e[k] === undefined ? null : e[k]; }); if (!Object.keys(before).length) return e; return Object.assign({}, e, patch, { edits: (e.edits || []).concat([{ at: nowAt, before }]) }); }));
  }
  function deleteEntry(entries, id, nowAt) { return rechain(entries.map(e => e.id === id ? Object.assign({}, e, { deleted: true, deletedAt: nowAt, edits: (e.edits || []).concat([{ at: nowAt, before: { deleted: false } }]) }) : e)); }

  /* ---------- 상태·요약·권장 단계 ---------- */
  const live = es => (es || []).filter(e => !e.deleted);
  const dueAtOf = p => p.due ? p.due + 'T' + (p.dueTime || '23:59') : null;
  function promiseStatus(p, entries, nowAt) {
    const es = live(entries); let done = null;
    if (p.link && p.link !== 'none') done = es.find(e => e.id === p.link) || null;
    else if (p.link !== 'none') done = es.filter(e => e.type === 'done' && e.memberId === p.memberId && similarity(e.task, p.task) >= 0.6 && (e.at || '') >= (p.at || '')).sort((a, b) => a.at < b.at ? -1 : 1)[0] || null;
    const dueAt = dueAtOf(p);
    if (done) return { status: dueAt && done.at > dueAt ? 'doneLate' : 'done', done };
    if (dueAt && nowAt > dueAt) return { status: 'late', overdue: diffDays(nowAt.slice(0, 10), p.due) };
    return { status: 'open' };
  }
  const STATUS = { open: '진행 중', done: '완료', doneLate: '기한 후 완료', late: '지연' };
  function activity(project, memberId) {
    const ds = new Set(); live(project.entries).forEach(e => { if (e.memberId === memberId && ['promise', 'done', 'meeting', 'agree', 'memo'].includes(e.type) && e.at) ds.add(e.at.slice(0, 10)); });
    ((project.chat && project.chat.dates && project.chat.dates[memberId]) || []).forEach(d => ds.add(d)); return [...ds].sort();
  }
  function lastActiveAt(project, memberId) {
    let last = ''; live(project.entries).forEach(e => { if (e.memberId === memberId && ['promise', 'done', 'meeting', 'agree'].includes(e.type) && e.at > last) last = e.at; });
    const c = project.chat && project.chat.last && project.chat.last[memberId]; if (c && c > last) last = c; return last || null;
  }
  function memberSummary(project, memberId, nowAt) {
    const es = live(project.entries); const today = nowAt.slice(0, 10);
    const ps = es.filter(e => e.type === 'promise' && e.memberId === memberId).map(p => Object.assign({ p }, promiseStatus(p, es, nowAt)));
    const c = { taken: ps.length, done: ps.filter(x => x.status === 'done').length, doneLate: ps.filter(x => x.status === 'doneLate').length, late: ps.filter(x => x.status === 'late').length, open: ps.filter(x => x.status === 'open').length };
    const judged = ps.filter(x => x.status !== 'open').length; const onTime = judged ? Math.round(c.done / judged * 100) : null;
    const last = lastActiveAt(project, memberId); const acts = activity(project, memberId);
    let longest = 0; for (let i = 1; i < acts.length; i++) longest = Math.max(longest, diffDays(acts[i], acts[i - 1])); if (acts.length) longest = Math.max(longest, diffDays(today, acts[acts.length - 1]));
    const sizeDone = ps.filter(x => x.status === 'done' || x.status === 'doneLate').reduce((s, x) => s + (x.p.size || 1), 0);
    return Object.assign(c, { items: ps, onTime, last, sinceLast: last ? diffDays(today, last.slice(0, 10)) : null, longest, sizeDone, mentions: (project.chat && project.chat.mentions && project.chat.mentions[memberId]) || 0 });
  }
  const LEVEL_NAME = { 0: '기록만 하기', 1: '1단계 부드러운 확인', 2: '2단계 기한 통보', 3: '3단계 역할 재분배 합의' };
  function stepFor(project, memberId, nowAt) {
    const s = Object.assign({ noReplyDays: 3, escalateHours: 48 }, project.settings || {}); const sum = memberSummary(project, memberId, nowAt);
    const quiet = sum.sinceLast !== null && sum.sinceLast >= s.noReplyDays; const trig = sum.late > 0 || quiet;
    const reasons = []; if (sum.late) reasons.push(`지연 ${sum.late}건`); if (quiet) reasons.push(`마지막 활동 후 ${sum.sinceLast}일`);
    const steps = (project.steps || []).filter(x => x.memberId === memberId && !x.undone).sort((a, b) => a.sentAt < b.sentAt ? -1 : 1); const last = steps[steps.length - 1];
    if (!last) return { level: trig ? 1 : 0, reasons, sum };
    const changed = live(project.entries).some(e => e.memberId === memberId && ['done', 'promise', 'agree', 'meeting'].includes(e.type) && e.at > last.sentAt) || ((project.chat && project.chat.last && project.chat.last[memberId]) || '') > last.sentAt;
    if (!trig && changed) return { level: 0, reasons: ['요청 뒤 응답·완료 기록이 있어요'], sum, last };
    if (changed) return { level: last.level, reasons: reasons.concat(['요청 뒤 응답이 있어 같은 단계 유지']), sum, last };
    if (last.level === 1) { const h = minutesBetween(nowAt, last.sentAt) / 60; return h >= s.escalateHours ? { level: 2, reasons: reasons.concat([`1단계 요청(${md(last.sentAt)}) 뒤 ${Math.floor(h)}시간 변화 없음`]), sum, last } : { level: 1, wait: addMinutes(last.sentAt, s.escalateHours * 60), reasons: reasons.concat([`1단계 요청 보냄 · ${s.escalateHours}시간 기다리는 중`]), sum, last, sent: true }; }
    if (last.level === 2) return last.deadline && nowAt > last.deadline ? { level: 3, reasons: reasons.concat([`2단계 기한 ${md(last.deadline)} ${hm(last.deadline)} 지남`]), sum, last, report: true } : { level: 2, wait: last.deadline, reasons: reasons.concat(['2단계 기한까지 기다리는 중']), sum, last, sent: true };
    return { level: 3, reasons: reasons.concat(['3단계 제안 보냄 — 보고서·교수 상담 권장']), sum, last, report: true, sent: true };
  }
  function projectStep(project, nowAt) {
    let best = { level: 0, memberId: null, reasons: [] };
    (project.members || []).filter(m => !m.me).forEach(m => { const r = stepFor(project, m.id, nowAt); if (r.level > best.level) best = Object.assign({ memberId: m.id }, r); });
    return best;
  }

  /* ---------- 이름 표기 ---------- */
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function initials(name) { return [...String(name || '').replace(/\s+/g, '')].map(ch => { const c = ch.charCodeAt(0); if (c >= 0xac00 && c <= 0xd7a3) return CHO[Math.floor((c - 0xac00) / 588)]; return /[A-Za-z]/.test(ch) ? ch.toUpperCase() : ''; }).join('').slice(0, 4) || '○'; }
  function namer(project, style) { return id => { const m = (project.members || []).find(x => x.id === id); if (!m) return '알 수 없음'; return style === 'initial' ? initials(m.name) : m.name; }; }
  const fmtTime = t => !t ? '' : t === '23:59' ? '23시 59분' : (+t.slice(3) ? `${+t.slice(0, 2)}시 ${+t.slice(3)}분` : `${+t.slice(0, 2)}시`);
  const voc = n => { const c = String(n).slice(-1).charCodeAt(0); return n + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? '아' : '야'); };

  /* ---------- 3단계 문구 + 교수 메일 ---------- */
  const TONES = { polite: '존댓말 정중', casual: '동기 반말', senior: '선후배(편한 존댓말)' };
  function factsFor(project, memberId, nowAt) {
    const sum = memberSummary(project, memberId, nowAt); const late = sum.items.filter(x => x.status === 'late'); const open = sum.items.filter(x => x.status === 'open');
    const main = late[0] || open[0] || null; return { sum, late, open, main, task: main ? main.p.task : '', due: main ? main.p.due : '', today: nowAt.slice(0, 10), last: sum.last };
  }
  function makeMessage(project, o, nowAt) {
    const N = namer(project, 'full')(o.memberId); const f = factsFor(project, o.memberId, nowAt); const tone = o.tone || 'polite';
    const T = f.task || '맡은 작업', D = f.due ? mdw(f.due) : '', TD = mdw(f.today), LAST = f.last ? mdw(f.last.slice(0, 10)) : '';
    const ND = o.newDue ? `${mdw(o.newDue)} ${fmtTime(o.newTime || '18:00')}` : '';
    const s2 = (project.steps || []).filter(x => x.memberId === o.memberId && x.level === 2 && !x.undone).slice(-1)[0];
    const R = o.reassignTo ? namer(project, 'full')(o.reassignTo) : ''; const ALT = o.altTask || '남은 작업 중 하고 싶은 부분'; const RB = o.replyBy ? mdw(o.replyBy) : mdw(addDays(f.today, 1));
    const hasTask = !!f.task; const facts = [];
    if (hasTask) facts.push(`${T} · 기한 ${D}${f.late.length ? ` · ${TD} 기준 ${f.late[0].overdue}일 지남` : ' · 기한 전'}`); if (f.last) facts.push(`마지막 활동 ${LAST} (${f.sum.sinceLast}일 전)`); if (s2) facts.push(`2단계 요청 ${md(s2.sentAt)} · 기한 ${md(s2.deadline)} ${hm(s2.deadline)}`);
    let text = '';
    const L1 = { polite: hasTask ? `${N}님, 바쁘신데 확인 한 번 부탁드려요. ${D}까지로 정했던 ${T} 진행 상황이 궁금해서요(오늘 ${TD}). 어려운 부분이 있으면 편하게 말씀해 주세요. 같이 방법을 찾아볼게요.` : `${N}님, 단톡 확인 한 번 부탁드려요. 마지막으로 이야기 나눈 게 ${LAST}라 진행 상황이 궁금해서요(오늘 ${TD}). 편할 때 답 주세요.`,
      casual: hasTask ? `${voc(N)}, 혹시 ${T} 어떻게 되고 있어? ${D}까지 하기로 했던 거라 확인차 물어봐(오늘 ${TD}). 어려운 거 있으면 말해 줘, 같이 보자.` : `${voc(N)}, 단톡 한 번만 확인해 줘. 마지막으로 얘기한 게 ${LAST}라 어떻게 되고 있는지 궁금해서(오늘 ${TD}). 편할 때 답 줘.`,
      senior: hasTask ? `${N}님, ${T} 진행 상황 한 번만 공유해 줄 수 있을까요? ${D}까지로 정했던 거라 확인차 연락했어요(오늘 ${TD}). 막히는 부분 있으면 같이 봐요.` : `${N}님, 단톡 한 번만 확인 부탁해요. 마지막으로 이야기한 게 ${LAST}라 진행 상황이 궁금해서요(오늘 ${TD}).` };
    const why = { polite: hasTask ? `${D}까지 받기로 한 ${T} 파트가 아직 안 올라와서요(오늘 ${TD}).` : `${LAST} 이후로 답이 없어서 다시 연락드려요(오늘 ${TD}).`, casual: hasTask ? `${D}까지 하기로 한 ${T} 아직 안 올라와서(오늘 ${TD}).` : `${LAST} 이후로 답이 없어서 다시 연락해(오늘 ${TD}).`, senior: hasTask ? `${D}까지였던 ${josa(T, '이', '가')} 아직 안 올라와서 연락해요(오늘 ${TD}).` : `${LAST} 이후로 답이 없어서 다시 연락해요(오늘 ${TD}).` };
    const L2 = { polite: `${N}님, 고생 많아요. ${why.polite} ${ND}까지 올려 주실 수 있을지 답 부탁드려요. 어려우면 오늘 중에 말해 주시면 나머지 분량을 같이 나눠 볼게요.`,
      casual: `${voc(N)}, ${why.casual} ${ND}까지 올려 줄 수 있는지 답 줘. 어려우면 오늘 안에 말해 주면 남은 분량 같이 나눌게.`,
      senior: `${N}님, ${why.senior} ${ND}까지 올려 줄 수 있는지 답 부탁해요. 어려우면 오늘 중에 말해 주면 남은 분량 같이 나눠 볼게요.` };
    const prior = s2 ? `${md(s2.sentAt)}에 ${md(s2.deadline)}까지 부탁드렸는데` : '앞서 부탁드렸는데';
    const L3 = { polite: `${N}님, ${T}${D ? `(${D} 기한)` : ''} 관련해서 ${prior} 아직 답이 없어서 역할을 다시 나누자고 제안드려요.\n제안: ${josa(T, '은', '는')} ${R ? josa(R, '이', '가') : '제가'} 맡고, ${N}님은 ${josa(ALT, '을', '를')} 맡아 주시면 어떨까요?\n${RB}까지 동의 여부만 답 주세요. 답이 없으면 제안대로 진행하고, 이 과정은 팀 활동 기록에 사실대로 남겨 둘게요.`,
      casual: `${voc(N)}, ${T}${D ? `(${D} 기한)` : ''} ${prior.replace('부탁드렸는데', '부탁했는데')} 아직 답이 없어서 역할을 다시 나누자고 제안할게.\n제안: ${josa(T, '은', '는')} ${R ? josa(R, '이', '가') : '내가'} 맡고, 너는 ${josa(ALT, '을', '를')} 맡으면 어때?\n${RB}까지 동의하는지만 답 줘. 답이 없으면 제안대로 진행하고, 이 과정은 팀 활동 기록에 사실대로 남겨 둘게.`,
      senior: `${N}님, ${T}${D ? `(${D} 기한)` : ''} ${prior.replace('부탁드렸는데', '부탁했는데')} 아직 답이 없어서 역할을 다시 나누자고 제안해요.\n제안: ${josa(T, '은', '는')} ${R ? josa(R, '이', '가') : '제가'} 맡고, ${N}님은 ${josa(ALT, '을', '를')} 맡아 주면 어떨까요?\n${RB}까지 동의 여부만 답 주세요. 답이 없으면 제안대로 진행하고, 이 과정은 팀 활동 기록에 사실대로 남겨 둘게요.` };
    if (o.level === 1) text = L1[tone]; else if (o.level === 2) text = L2[tone]; else if (o.level === 3) text = L3[tone];
    else { const pe = profEmail(project, o, nowAt); return { text: pe.text, subject: pe.subject, facts: pe.facts, tone: 'polite' }; }
    return { text, facts, tone };
  }
  function profEmail(project, o, nowAt) {
    const nm = namer(project, 'full'); const me = (project.members || []).find(m => m.me); const today = nowAt.slice(0, 10); const facts = [];
    (project.members || []).filter(m => !m.me).forEach(m => { const f = factsFor(project, m.id, nowAt); f.late.forEach(x => facts.push(`${m.name}: ${x.p.task}(${mdw(x.p.due)} 기한) ${mdw(today)} 기준 미제출`)); if (f.sum.sinceLast !== null && f.sum.sinceLast >= ((project.settings || {}).noReplyDays || 3)) facts.push(`${m.name}: 마지막 활동 ${mdw(f.last.slice(0, 10))}(${f.sum.sinceLast}일 전)`); });
    const st = (project.steps || []).filter(x => !x.undone).sort((a, b) => a.sentAt < b.sentAt ? -1 : 1);
    const stepsLine = st.length ? st.map(x => `${md(x.sentAt)} ${nm(x.memberId)}님께 ${LEVEL_NAME[x.level].slice(4)} 문구`).join(', ') + '를 보냈습니다' : '아직 단계별 요청 문구를 보낸 기록은 없습니다';
    const subject = `[${project.course || '과목'}] ${project.title || '조별과제'} 팀 활동 관련 상담 요청드립니다`;
    const text = `제목: ${subject}\n\n${o.profName ? o.profName + ' ' : ''}교수님, 안녕하세요. ${project.course || ''} 수강생 ${me ? me.name : ''}입니다.\n\n${project.title || '조별과제'} 진행 중 역할 이행과 관련해 상담을 요청드리고 싶어 메일드립니다. 제 팀 기록을 바탕으로 사실만 정리했습니다(${mdw(today)} 기준).\n\n${facts.length ? facts.map(x => '- ' + x).join('\n') : '- 현재 기한이 지난 작업은 없습니다.'}\n\n팀 안에서는 ${stepsLine}. 상담 가능한 시간을 알려 주시면 맞춰 찾아뵙겠습니다. 필요하시면 팀 활동 기록(자기 기록 기반 참고 자료)을 함께 드리겠습니다.\n\n감사합니다.\n${me ? me.name : ''} 드림`;
    return { subject, text, facts };
  }
  /* 평가어 감지: 위치와 사실형 안내 */
  function findJudgement(text, J) { const out = []; const s = String(text || ''); (J.words || []).forEach(w => { let i = s.indexOf(w.w); while (i >= 0) { out.push({ w: w.w, index: i, len: w.w.length, tip: w.tip }); i = s.indexOf(w.w, i + w.w.length); } }); return out.sort((a, b) => a.index - b.index).filter((h, k, a) => !k || h.index >= a[k - 1].index + a[k - 1].len); }
  function factExample(J, f) { return (J.factTemplate || '').replace('{due}', f.due ? md(f.due) : '정한 날짜').replace('{task}', f.task || '맡은 작업').replace('{today}', md(f.today)).replace('이(가)', f.task ? josa(f.task, '이', '가').slice(f.task.length) : '이'); }

  /* ---------- 공개글 점검 (특정 가능성) ---------- */
  const CAPS_STOP = ['PPT', 'PDF', 'DM', 'OK', 'TA', 'AI', 'SNS', 'URL', 'HWP', 'DOC', 'MT', 'OT', 'PT', 'GPT', 'IT', 'LOL'];
  function riskCheck(text, RR, J, extra) {
    const s = String(text || ''); extra = extra || {}; const hits = [];
    RR.categories.forEach(c => {
      const pats = c.patterns.slice(); if (c.id === 'name') (extra.names || []).filter(n => n && n.length >= 2).forEach(n => pats.push(esc(n))); if (c.id === 'course' && extra.course && extra.course.length >= 2) pats.push(esc(extra.course));
      if (c.useJudgementWords) (J.words || []).forEach(w => pats.push(esc(w.w)));
      pats.forEach(p => { const re = new RegExp(p, 'g'); let m; while ((m = re.exec(s))) { if (!m[0].length) { re.lastIndex++; continue; } if (c.id === 'name' && CAPS_STOP.includes(m[0])) continue; hits.push({ cat: c.id, label: c.label, identity: c.identity, index: m.index, len: m[0].length, text: m[0] }); } });
    });
    hits.sort((a, b) => a.index - b.index || b.len - a.len); const uniq = []; hits.forEach(h => { const p = uniq[uniq.length - 1]; if (p && h.index < p.index + p.len) return; uniq.push(h); });
    const cats = [...new Set(uniq.map(h => h.cat))]; const idn = cats.filter(c => RR.categories.find(x => x.id === c).identity).length; const cap = cats.includes('capture'), ins = cats.includes('insult');
    const level = idn >= 2 || (idn >= 1 && (cap || ins)) ? 'high' : idn === 1 || cap || ins ? 'mid' : 'low';
    return { level, hits: uniq, cats, identityCount: idn };
  }
  function eraseIdentifiers(text, res) { let s = String(text || ''); res.hits.filter(h => h.identity || h.cat === 'capture').sort((a, b) => b.index - a.index).forEach(h => { s = s.slice(0, h.index) + '○○' + s.slice(h.index + h.len); }); return s; }

  /* ---------- 보고서·동료평가 ---------- */
  function buildReport(project, opt, nowAt) {
    opt = opt || {}; const nm = namer(project, opt.nameStyle || 'full'); const es = live(project.entries); const today = nowAt.slice(0, 10); const me = (project.members || []).find(m => m.me);
    const roles = es.filter(e => e.type === 'promise').map(p => { const s = promiseStatus(p, es, nowAt); return { id: p.id, name: nm(p.memberId), memberId: p.memberId, task: p.task, due: p.due, status: s.status, label: STATUS[s.status], doneAt: s.done ? s.done.at : '', quote: (opt.quotes || []).includes(p.id) && p.evidence && p.evidence.quote ? p.evidence.quote : '' }; });
    const tot = { n: roles.length, done: roles.filter(r => r.status === 'done' || r.status === 'doneLate').length, late: roles.filter(r => r.status === 'late').length, open: roles.filter(r => r.status === 'open').length };
    const summary = [`팀원 ${(project.members || []).length}명이 작업 ${tot.n}개를 맡았고, ${mdw(today)} 기준 완료 ${tot.done}개 · 지연 ${tot.late}개 · 진행 중 ${tot.open}개예요.`];
    const lateBy = {}; roles.filter(r => r.status === 'late').forEach(r => { (lateBy[r.memberId] = lateBy[r.memberId] || []).push(r); });
    const lateLine = Object.keys(lateBy).map(id => { const s = memberSummary(project, id, nowAt); return `${nm(id)}: ${lateBy[id].map(r => `${r.task}(${md(r.due)} 기한)`).join(', ')} 미제출${s.last ? `, 마지막 활동 ${md(s.last)}` : ''}`; });
    summary.push(lateLine.length ? lateLine.join(' / ') + '.' : '기한이 지난 미완료 작업은 없어요.');
    const steps = (project.steps || []).filter(x => !x.undone).sort((a, b) => a.sentAt < b.sentAt ? -1 : 1);
    summary.push(steps.length ? `팀 안에서 단계별 요청을 ${steps.length}번 보냈어요(${steps.map(x => `${md(x.sentAt)} ${x.level}단계`).join(', ')}).` : '앱으로 기록한 단계별 요청은 아직 없어요.');
    const timeline = es.filter(e => ['request', 'noreply', 'agree', 'meeting', 'absent', 'done', 'late'].includes(e.type)).sort((a, b) => a.at < b.at ? -1 : 1).slice(-14).map(e => ({ at: e.at, name: nm(e.memberId), type: TYPES[e.type], text: e.type === 'request' ? (e.stepLevel ? `${e.stepLevel}단계 요청 보냄` : '메시지') + (e.meta && e.meta.to ? ` → ${nm(e.meta.to)}` : '') : e.type === 'noreply' ? `${(e.meta && e.meta.days) || ''}일째 응답 없음` : e.task || '', quote: (opt.quotes || []).includes(e.id) && e.evidence ? e.evidence.quote : '' }));
    const v = verifyChain(project.entries || []);
    return { course: project.course, title: project.title, author: me ? nm(me.id) : '', date: today, members: (project.members || []).map(m => nm(m.id)), summary, roles, timeline, steps: steps.map(x => ({ at: x.sentAt, level: x.level, name: nm(x.memberId) })), requests: opt.requests || [], hashShort: v.last ? v.last.slice(0, 12) : '', chainOk: v.ok, chainCount: v.count, edited: es.filter(e => (e.edits || []).length).length, deleted: (project.entries || []).filter(e => e.deleted).length, alerts: (project.chainAlerts || []).length };
  }
  const REQUESTS = { consult: '교수님 상담을 요청드립니다', peer: '동료평가에 위 기록을 참고해 주시기를 요청드립니다', exclude: '결과물 이름 표기(제외 여부)에 대해 여쭙고 싶습니다' };
  function reportText(r) {
    const L = [`[팀 활동 사실 보고] ${r.course || ''} · ${r.title || ''}`, `작성자 ${r.author} · 작성일 ${r.date} · 팀원 ${r.members.join(', ')}`, '', '■ 요약', ...r.summary.map(s => '- ' + s), '', '■ 역할 분담', ...r.roles.map(x => `- ${x.name} | ${x.task} | 기한 ${x.due ? md(x.due) : '-'} | ${x.label}${x.doneAt ? ' ' + md(x.doneAt) : ''}${x.quote ? ` | 근거: "${x.quote}"` : ''}`), '', '■ 연락·요청 기록', ...(r.timeline.length ? r.timeline.map(x => `- ${md(x.at)} ${hm(x.at)} ${x.name} ${x.type} ${x.text}${x.quote ? ` "${x.quote}"` : ''}`) : ['- 기록 없음']), '', '■ 팀 내 조치', ...(r.steps.length ? r.steps.map(x => `- ${md(x.at)} ${x.name}님께 ${LEVEL_NAME[x.level]} 문구 보냄`) : ['- 기록 없음'])];
    if (r.requests.length) L.push('', '■ 요청 사항', ...r.requests.map(k => '- ' + REQUESTS[k]));
    L.push('', `기록 무결성 표시: 항목 ${r.chainCount}개 · 마지막 해시 앞 12자리 ${r.hashShort} · 체인 검증 ${r.chainOk ? '통과' : '실패(수정 흔적)'} · 수정된 항목 ${r.edited}개 · 삭제 표시 ${r.deleted}개`, '※ 작성자 본인의 기록에 기반한 참고 자료예요. 해시는 이 앱 안에서 수정 여부를 표시할 뿐 법적 증거력을 보장하지 않으며, 이 문서는 법률 자문이 아니에요.');
    return L.join('\n');
  }
  function peerDraft(project, memberId, nowAt, style) {
    const nm = namer(project, style || 'full'); const s = memberSummary(project, memberId, nowAt); const today = nowAt.slice(0, 10); const out = [];
    const lst = xs => xs.map(x => `${md(x.p.due) || '기한 없음'} ${x.p.task}`).join(', ');
    const on = s.items.filter(x => x.status === 'done'), dl = s.items.filter(x => x.status === 'doneLate'), lt = s.items.filter(x => x.status === 'late'), op = s.items.filter(x => x.status === 'open');
    if (!s.taken) out.push('장부에 맡은 작업 기록이 없어요.');
    else { let t = on.length ? `맡은 ${s.taken}개 작업 중 ${on.length}개를 기한 내 완료(${lst(on)})` : `맡은 ${s.taken}개 작업 중 기한 내 완료 기록은 없고`; if (dl.length) t += `, ${dl.length}개는 기한 후 완료(${lst(dl)})`; if (lt.length) t += `, ${lt.length}개(${lst(lt)})는 ${md(today)} 기준 미제출`; if (op.length) t += `, ${op.length}개(${lst(op)})는 기한 전 진행 중`; out.push(t + '.'); }
    if (s.last) out.push(`마지막 활동 ${md(s.last)}(${s.sinceLast}일 전), 활동 사이 최장 간격 ${s.longest}일.`);
    const st = (project.steps || []).filter(x => x.memberId === memberId && !x.undone); if (st.length) out.push(`팀 내 요청 ${st.length}회(${st.map(x => md(x.sentAt)).join(', ')}).`);
    const ag = project.agreement && (project.agreement.confirms || []).find(c => c.memberId === memberId); if (ag) out.push(`팀 합의문 확인 ${md(ag.at)}.`);
    return { name: nm(memberId), sentences: out, sum: s };
  }

  /* ---------- 합의문·확인 코드·링크 ---------- */
  const agreementHash = a => sha256(stable(a));
  const stampOf = at => at.slice(5, 7) + at.slice(8, 10) + at.slice(11, 13) + at.slice(14, 16);
  const confirmCode = (h, memberId, stamp) => stamp + '-' + base32(sha256bytes(h + memberId + stamp)).slice(0, 6);
  function verifyCode(h, members, code) { const m = /^\s*(\d{8})-([A-Z2-7]{6})\s*$/.exec(String(code || '').toUpperCase()); if (!m) return null; return (members || []).find(x => confirmCode(h, x.id, m[1]) === m[1] + '-' + m[2]) || null; }
  const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  async function pipe(bytes, Stream, mode) { const cs = new Stream(mode); const w = cs.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {}); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); }
  async function encodeAgreement(a) { const raw = new TextEncoder().encode(JSON.stringify(a)); if (typeof CompressionStream === 'function') { try { return 'z' + b64u(await pipe(raw, CompressionStream, 'deflate-raw')); } catch (e) { /* 아래로 */ } } return 'u' + b64u(raw); }
  async function decodeAgreement(s) { s = String(s || ''); const k = s[0], body = s.slice(1); let bytes = unb64u(body); if (k === 'z') bytes = await pipe(bytes, DecompressionStream, 'deflate-raw'); else if (k !== 'u') throw new Error('형식'); const a = JSON.parse(new TextDecoder().decode(bytes)); if (!a || a.v !== 1 || !Array.isArray(a.members)) throw new Error('형식'); return a; }
  function agreementText(a) {
    return [`[팀 합의문] ${a.course || ''} · ${a.title || ''}`, `최종 마감 ${a.deadline ? mdw(a.deadline.slice(0, 10)) + ' ' + hm(a.deadline) : '-'} · 내부 마감 ${a.internal ? mdw(a.internal.slice(0, 10)) + ' ' + hm(a.internal) : '-'}${a.presentation ? ' · 발표 ' + mdw(a.presentation.slice(0, 10)) : ''}`, '', '■ 역할', ...a.members.map(m => `- ${m.name}: ${m.role || '역할 미정'}${m.due ? ` (${md(m.due)}까지)` : ''}`), '', '■ 연락 규칙', `- 단톡 메시지에는 ${a.replyHours || 24}시간 안에 답하기`, ...(a.rules || []).map(r => '- ' + r), '', '■ 약속이 지켜지지 않으면', '- 1단계 부드러운 확인 → 2단계 기한 안내 → 3단계 역할 재분배 합의', ...(a.peerConsent ? ['- 이 합의와 팀 기록을 동료평가 근거로 쓰는 데 동의해요'] : [])].join('\n');
  }

  /* ---------- .ics (TZID Asia/Seoul, RFC 5545) ---------- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { const out = []; let cur = '', bytes = 0; for (const ch of line) { const b = new TextEncoder().encode(ch).length; if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; } out.push(cur); return out.map((l, i) => (i ? ' ' : '') + l).join('\r\n'); }
  const icsAt = at => at.replace(/[-:]/g, '') + '00';
  function toICS(events, o) {
    o = o || {}; const stamp = new Date(o.now || Date.now()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//team-project-evidence-notebook//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(o.calName || '팀플 마감'), 'X-WR-TIMEZONE:Asia/Seoul',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'X-LIC-LOCATION:Asia/Seoul', 'BEGIN:STANDARD', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'DTSTART:19700101T000000', 'END:STANDARD', 'END:VTIMEZONE'];
    events.forEach((e, i) => {
      const end = e.end || e.start; const start = e.end ? e.start : addMinutes(e.start, -30);
      L.push('BEGIN:VEVENT', 'UID:tpn-' + icsAt(e.start) + '-' + i + '-' + (o.uid || 'x') + '@webapp-daily', 'DTSTAMP:' + stamp, 'DTSTART;TZID=Asia/Seoul:' + icsAt(start), 'DTEND;TZID=Asia/Seoul:' + icsAt(end), 'SUMMARY:' + icsEsc(e.title), 'DESCRIPTION:' + icsEsc((e.desc ? e.desc + '\n' : '') + '팀플 증거노트에서 만든 일정'));
      if (e.alarm) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.alarmText || e.title), 'TRIGGER:' + e.alarm, 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
  }
  function memberEvents(project, memberId, a) {
    const nm = namer(project, 'full'); const ev = []; const es = live(project.entries); const nowAt = '0000';
    es.filter(e => e.type === 'promise' && e.memberId === memberId && e.due).forEach(p => ev.push({ title: `[${project.course || '팀플'}] ${p.task} 기한`, start: p.due + 'T' + (p.dueTime || '23:59'), desc: `${nm(memberId)} 맡은 작업` }));
    if (a && a.internal) ev.push({ title: `[${project.course || '팀플'}] 내부 마감`, start: a.internal, desc: '최종 마감 전 팀 내부 마감', alarm: '-P1D', alarmText: '내일 내부 마감이에요' });
    if (project.deadline) ev.push({ title: `[${project.course || '팀플'}] ${project.title || '과제'} 최종 마감`, start: project.deadline, desc: '최종 제출' });
    if (a && a.presentation) ev.push({ title: `[${project.course || '팀플'}] 발표`, start: a.presentation, desc: '발표일' });
    void nowAt; return ev.sort((x, y) => x.start < y.start ? -1 : 1);
  }

  /* ---------- 가져오기·백업 ---------- */
  function chatMeta(parsed, mapping, cands) {
    const last = {}, dates = {}, mentions = {};
    parsed.speakers.forEach(s => { const id = mapping[s.name]; if (!id) return; if (!last[id] || s.last > last[id]) last[id] = s.last; dates[id] = [...new Set((dates[id] || []).concat(s.dates))].sort(); const nr = (cands || []).find(c => c.kind === 'noreply' && c.name === s.name); if (nr) mentions[id] = nr.mentions; });
    return { format: parsed.stats.format, ratePct: parsed.stats.ratePct, msgs: parsed.stats.msg, unparsed: parsed.stats.unparsed, last, dates, mentions };
  }
  function entryFromCandidate(c, memberId, nowAt, n) {
    const e = { id: 'e' + sha256(nowAt + c.id + n).slice(0, 10), type: c.kind, memberId, task: c.task || '', at: c.kind === 'noreply' ? nowAt : c.at, evidence: { kind: 'kakao', quote: quoteOf(c.quote), at: c.at }, createdAt: nowAt, edits: [] };
    if (c.kind === 'promise') { e.size = 2; e.due = c.due || ''; e.dueTime = c.dueTime || ''; }
    if (c.kind === 'noreply') e.meta = { days: c.days, since: c.at, mentions: c.mentions };
    if (c.file) e.evidence.file = c.task; return e;
  }
  function validateBackup(o) {
    const err = []; if (!o || typeof o !== 'object') return { ok: false, errors: ['JSON 객체가 아니에요'] };
    if (o.version !== 1) err.push('version이 1이 아니에요'); if (!Array.isArray(o.projects)) err.push('projects 배열이 없어요');
    (o.projects || []).forEach((p, i) => { if (!p || typeof p.id !== 'string') err.push(`${i + 1}번째 과목에 id가 없어요`); if (!Array.isArray(p && p.members) || p.members.length < 1) err.push(`${i + 1}번째 과목에 팀원이 없어요`); if (!Array.isArray(p && p.entries)) err.push(`${i + 1}번째 과목에 entries가 없어요`); });
    return { ok: !err.length, errors: err };
  }
  /* 예시 과목: 샘플 대화(안드로이드 형식)를 그대로 파싱해 후보를 전부 채택 */
  function buildDemo(sample, P, nowAt) {
    const members = [{ id: 'm1', name: '서윤', me: true, role: '팀장·취합' }, { id: 'm2', name: '준호', role: '설문 문항·분석' }, { id: 'm3', name: '민지', role: '참고문헌·서론' }, { id: 'm4', name: '도윤', role: '발표 자료' }];
    const project = { id: 'p_demo', demo: true, course: '마케팅원론', title: '설문 기반 보고서', deadline: '2026-12-10T23:59', midDeadlines: ['2026-11-27T18:00'], peerEval: { used: true, weightPct: 20 }, members, entries: [], steps: [], settings: { noReplyDays: 3, escalateHours: 48, nameStyle: 'full', keepRaw: false }, createdAt: nowAt };
    const parsed = parseKakao(sample, P); const cands = candidates(parsed, P, { today: nowAt.slice(0, 10), noReplyDays: 3 }); const map = {}; members.forEach(m => { map[m.name] = m.id; });
    let entries = []; cands.forEach((c, n) => { const id = map[c.name]; if (!id || c.file) return; const e = entryFromCandidate(c, id, nowAt, n); if (c.kind === 'request' && /도윤/.test(c.quote)) e.meta = { to: 'm4' }; entries.push(e); });
    entries.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0); project.entries = rechain(entries); project.chat = chatMeta(parsed, map, cands); return { project, parsed, cands };
  }

  /* ---------- 자체 검사 (설정 화면·테스트) ---------- */
  function runSelfTest(P, J, RR) {
    const fails = []; const eq = (a, b, n) => { if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(n + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
    eq(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256');
    const a = parseKakao('2026년 11월 4일 오후 9:00, 준호 : 설문 문항 초안은 제가 금요일까지 만들게요\n2026년 11월 4일 오후 9:01, 민지 : 사진', P); eq([a.stats.msg, a.stats.ratePct, a.messages[0].at, a.messages[1].file], [2, 100, '2026-11-04T21:00', true], 'android');
    const b = parseKakao('2026년 11월 4일 수요일\n오전 12:05, 준호 : 네\n둘째 줄', P); eq([b.stats.msg, b.messages[0].at, b.stats.cont], [1, '2026-11-04T00:05', 1], 'ios');
    const c = parseKakao('--------------- 2026년 11월 4일 수요일 ---------------\n[도윤] [오후 9:05] 발표 자료 틀은 11/13까지 할게요', P); eq([c.stats.msg, c.messages[0].at, c.messages[0].name], [1, '2026-11-04T21:05', '도윤'], 'pc');
    eq(resolveDue('금요일까지', '2026-11-04T21:00'), { date: '2026-11-06', time: '23:59', expr: '금요일' }, 'due 금요일'); eq(resolveDue('이번 주 금요일까지', '2026-11-11T20:30').date, '2026-11-13', 'due 이번 주');
    eq(resolveDue('내일 오후 6시까지', '2026-12-31T10:00'), { date: '2027-01-01', time: '18:00', expr: '내일' }, 'due 연말 내일'); eq(resolveDue('1/5까지', '2026-12-20T10:00').date, '2027-01-05', 'due 해 넘김');
    let es = rechain([{ id: 'a', type: 'promise', memberId: 'm', task: 'x', at: '2026-11-01T10:00' }, { id: 'b', type: 'done', memberId: 'm', task: 'x', at: '2026-11-02T10:00' }]); eq(verifyChain(es).ok, true, 'chain ok');
    const t = es.map(e => Object.assign({}, e)); t[0].task = 'y'; eq(verifyChain(t).bad, [0], 'chain tamper');
    if (J) eq(findJudgement('진짜 잠수 타고 민폐야', J).map(h => h.w), ['잠수', '민폐'], 'judgement');
    if (RR && J) eq(['마케팅원론 3조 ㅈㄷㅇ 단톡 캡처 올림', '팀원이 연락이 안 돼요'].map(s => riskCheck(s, RR, J).level), ['high', 'low'], 'risk');
    return { ok: !fails.length, fails };
  }

  return { pad, WD, toN, fromN, addDays, diffDays, weekday, isDate, isAt, localAt, md, mdw, hm, minutesBetween, addMinutes, josa, sha256, sha256bytes, base32, stable, FMT_NAME, parseKakao, resolveDue, taskOf, similarity, candidates, quoteOf, TYPES, rechain, verifyChain, entryHash, addEntry, editEntry, deleteEntry, live, promiseStatus, STATUS, memberSummary, stepFor, projectStep, LEVEL_NAME, initials, namer, fmtTime, TONES, factsFor, makeMessage, profEmail, findJudgement, factExample, riskCheck, eraseIdentifiers, buildReport, reportText, REQUESTS, peerDraft, agreementHash, stampOf, confirmCode, verifyCode, encodeAgreement, decodeAgreement, agreementText, toICS, fold, icsEsc, memberEvents, chatMeta, entryFromCandidate, validateBackup, buildDemo, runSelfTest };
});
