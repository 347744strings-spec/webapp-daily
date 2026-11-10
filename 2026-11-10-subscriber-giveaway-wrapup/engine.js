/* 구독자 이벤트 정리판 — 계산 엔진 (브라우저·Node 공용, 외부 의존성 없음) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ALGO = 'gp-draw-v1';
  var TYPES = {
    giftcard: '현금·상품권(계좌이체 등)',
    mobile: '모바일 쿠폰·기프티콘',
    physical: '실물(택배 발송)',
    contest: '대회 상금(순위 경쟁)'
  };

  /* ---------- 숫자·날짜 ---------- */
  function won(n) { return Math.round(n).toLocaleString('ko-KR') + '원'; }
  function toInt(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.floor(v) : NaN;
    var s = String(v == null ? '' : v).replace(/[,\s원]/g, '');
    if (!/^\d+$/.test(s)) return NaN;
    return parseInt(s, 10);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function parseDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
    var p = s.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    return ymd(d) === s ? d : null;
  }
  function addDays(s, n) { var d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function weekday(s) { return WD[parseDate(s).getUTCDay()]; }
  function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }

  /* ---------- 경품 판정 ---------- */
  function assessPrize(p, rules) {
    var R = rules;
    var v = toInt(p.unitValue), qty = Math.max(1, toInt(p.qty) || 1);
    var out = { valid: !(isNaN(v) || v < 0), unitValue: v, qty: qty, type: p.type, notes: [] };
    if (!out.valid) { out.light = 'none'; return out; }
    var contest = p.type === 'contest';
    var incomeRatio = contest ? Math.round((1 - R.contestExpenseRatio) * 1e9) / 1e9 : 1;
    var income = contest ? v - Math.floor(v * R.contestExpenseRatio + 1e-7) : v;
    var taxable = income > R.threshold;
    out.contest = contest;
    out.income = income;
    out.expense = v - income;
    out.taxable = taxable;
    out.withholder = p.sender === 'sponsor' ? 'sponsor' : 'me';
    out.bearer = p.taxBearer === 'me' ? 'me' : 'winner';
    out.incomeTax = 0; out.localTax = 0; out.tax = 0;
    out.gross = v; out.grossIncome = income; out.grossTax = 0; out.approx = false;
    if (taxable) {
      out.incomeTax = Math.floor(income * R.incomeTaxRate + 1e-7);
      out.localTax = Math.floor(out.incomeTax * R.localTaxRate + 1e-7);
      out.tax = out.incomeTax + out.localTax;
      if (out.bearer === 'me') {
        // 대납: 당첨자가 세후 V를 받도록 세액까지 소득에 포함(gross-up) — 근사치
        var eff = Math.round(R.rate * incomeRatio * 1e9) / 1e9;
        var g = Math.floor(v / (1 - eff));
        out.gross = g;
        out.grossIncome = contest ? g - Math.floor(g * R.contestExpenseRatio + 1e-7) : g;
        out.grossTax = g - v;
        out.approx = true;
      }
    }
    // 지급명세서 / 주민번호
    var valueForStatement = out.bearer === 'me' && taxable ? out.gross : v;
    if (!taxable) { out.statement = 'none'; out.rrn = 'forbidden'; }
    else if (!contest && v <= R.statementExemptMax && valueForStatement <= R.statementExemptMax) { out.statement = 'exempt'; out.rrn = 'check'; }
    else if (!contest && v <= R.statementExemptMax) { out.statement = 'check'; out.rrn = 'required'; }
    else { out.statement = 'required'; out.rrn = 'required'; }
    if (out.withholder === 'sponsor' && taxable) out.rrnBy = 'sponsor'; else out.rrnBy = 'me';
    // 신호등
    if (!taxable) out.light = 'green';
    else if (out.bearer === 'me' || v > R.highValue) out.light = 'red';
    else out.light = 'orange';
    out.high = v > R.highValue;
    // 주최자 실제 부담(1개당)
    out.myCostUnit = out.withholder === 'sponsor' ? 0 : v + (taxable && out.bearer === 'me' ? out.grossTax : 0);
    out.taxUnit = taxable ? (out.bearer === 'me' ? out.grossTax : out.tax) : 0;
    out.myCost = out.myCostUnit * qty;
    out.taxTotal = out.taxUnit * qty;
    return out;
  }

  function summarize(prizes, rules) {
    var s = { count: 0, units: 0, prizeValue: 0, taxTotal: 0, myCost: 0, sponsorValue: 0, taxableUnits: 0, lights: { green: 0, orange: 0, red: 0 }, needWithholding: false, needStatement: false, statementCheck: false, rrnAny: false, sponsorTaxable: false };
    (prizes || []).forEach(function (p) {
      var a = assessPrize(p, rules);
      if (!a.valid) return;
      s.count++; s.units += a.qty; s.prizeValue += a.unitValue * a.qty;
      s.taxTotal += a.taxTotal; s.myCost += a.myCost;
      if (a.withholder === 'sponsor') s.sponsorValue += a.unitValue * a.qty;
      s.lights[a.light]++;
      if (a.taxable) {
        s.taxableUnits += a.qty;
        if (a.withholder === 'me') {
          s.needWithholding = true;
          if (a.statement === 'required') s.needStatement = true;
          if (a.statement === 'exempt' || a.statement === 'check') s.statementCheck = true;
          if (a.rrn !== 'forbidden') s.rrnAny = true;
        } else s.sponsorTaxable = true;
      }
    });
    return s;
  }

  /* ---------- 참여자 목록 ---------- */
  var TIME_RE = /(\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}\.?\s*(?:\d{1,2}:\d{2}(?::\d{2})?)?|\d{1,2}:\d{2}(?::\d{2})?)/;
  function splitCSVLine(line, sep) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(function (x) { return x.trim(); });
  }
  function cleanId(s) { return String(s || '').trim().replace(/^@+/, '').replace(/[:：,]+$/, '').trim(); }
  function parseParticipants(text) {
    var res = { entries: [], format: 'lines', skipped: 0, errors: [] };
    var raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    var lines = raw.split('\n').filter(function (l) { return l.trim() !== ''; });
    if (!lines.length) return res;
    var first = lines[0], sep = null;
    if (first.indexOf('\t') >= 0) sep = '\t'; else if (first.indexOf(',') >= 0) sep = ',';
    var header = sep ? splitCSVLine(first, sep).map(function (h) { return h.toLowerCase(); }) : null;
    function find(keys) { if (!header) return -1; for (var i = 0; i < header.length; i++) for (var k = 0; k < keys.length; k++) if (header[i].indexOf(keys[k]) >= 0) return i; return -1; }
    var iId = find(['아이디', '닉네임', 'author', 'user', 'name', 'id', '작성자', '계정']);
    if (header && iId >= 0) {
      res.format = 'csv';
      var iCm = find(['댓글', 'comment', 'text', '내용', 'message']);
      var iTm = find(['시간', 'time', 'date', '일시', '작성일', 'published']);
      for (var r = 1; r < lines.length; r++) {
        var cols = splitCSVLine(lines[r], sep);
        var id = cleanId(cols[iId]);
        if (!id) { res.skipped++; continue; }
        res.entries.push({ id: id, comment: iCm >= 0 ? (cols[iCm] || '') : '', time: iTm >= 0 ? (cols[iTm] || '') : '' });
      }
      return res;
    }
    lines.forEach(function (l) {
      var t = l.trim();
      var m = t.match(TIME_RE), time = '';
      if (m) { time = m[1].trim(); }
      var rest = m ? (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).trim() : t;
      var mm = rest.match(/^(@?[^\s:：,]+)[\s:：,]*(.*)$/);
      if (!mm) { res.skipped++; return; }
      var id = cleanId(mm[1]);
      if (!id) { res.skipped++; return; }
      res.entries.push({ id: id, comment: mm[2] || '', time: time });
    });
    return res;
  }
  function normId(id) { return String(id).normalize('NFC').trim().replace(/^@+/, '').toLowerCase(); }
  function filterEntries(entries, opt) {
    opt = opt || {};
    var kw = String(opt.keyword || '').trim().toLowerCase();
    var ex = {};
    String(opt.exclude || '').split(/[\n,\s]+/).forEach(function (x) { if (x.trim()) ex[normId(x)] = 1; });
    var seen = {}, list = [], dup = 0, kwOut = 0, exOut = 0;
    entries.forEach(function (e) {
      var n = normId(e.id);
      if (!n) return;
      if (ex[n]) { exOut++; return; }
      if (kw && String(e.comment || '').toLowerCase().indexOf(kw) < 0) { kwOut++; return; }
      if (opt.dedupe !== false && seen[n]) { dup++; return; }
      seen[n] = 1;
      list.push({ id: e.id, norm: n, comment: e.comment, time: e.time });
    });
    return { list: list, removedDup: dup, removedKeyword: kwOut, removedExcluded: exOut };
  }
  function normalizedIds(list) {
    return list.map(function (e) { return typeof e === 'string' ? normId(e) : e.norm || normId(e.id); }).filter(Boolean).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  }

  /* ---------- SHA-256 (순수 JS, Web Crypto와 결과 동일) ---------- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str)), a = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a;
  }
  function sha256Hex(str) {
    var msg = utf8(String(str));
    var l = msg.length, bitLen = l * 8;
    var n = ((l + 9 + 63) >> 6) << 6;
    var b = new Uint8Array(n); b.set(msg); b[l] = 0x80;
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    b[n - 8] = hi >>> 24; b[n - 7] = hi >>> 16 & 255; b[n - 6] = hi >>> 8 & 255; b[n - 5] = hi & 255;
    b[n - 4] = lo >>> 24; b[n - 3] = lo >>> 16 & 255; b[n - 2] = lo >>> 8 & 255; b[n - 1] = lo & 255;
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var W = new Array(64);
    for (var off = 0; off < n; off += 64) {
      for (var t = 0; t < 16; t++) W[t] = (b[off + t * 4] << 24 | b[off + t * 4 + 1] << 16 | b[off + t * 4 + 2] << 8 | b[off + t * 4 + 3]) >>> 0;
      for (t = 16; t < 64; t++) {
        var x = W[t - 15], y = W[t - 2];
        var s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3);
        var s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
        var S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
        var mj = (a & bb) ^ (a & c) ^ (bb & c);
        var t2 = (S0 + mj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map(function (w) { return ('00000000' + w.toString(16)).slice(-8); }).join('');
  }

  /* ---------- 추첨 ---------- */
  function sfc32(a, b, c, d) {
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      var t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = c << 21 | c >>> 11;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function listHashOf(ids) { return sha256Hex(ids.join('\n')); }
  function seedOf(phrase, listHash) { return sha256Hex(String(phrase).normalize('NFC').trim() + '|' + listHash); }
  function shuffle(ids, seedHex) {
    var w = [0, 1, 2, 3].map(function (i) { return parseInt(seedHex.slice(i * 8, i * 8 + 8), 16); });
    var rnd = sfc32(w[0], w[1], w[2], w[3]);
    for (var k = 0; k < 12; k++) rnd();
    var arr = ids.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }
  function slotsOf(prizes) {
    var s = [];
    (prizes || []).forEach(function (p) {
      var q = Math.max(1, toInt(p.qty) || 1);
      for (var i = 0; i < q; i++) s.push({ prizeId: p.id, prizeName: p.name, n: i + 1 });
    });
    return s;
  }
  /* ids: 정규화·정렬된 목록(중복 제거 꺼짐이면 중복 포함). 한 사람은 한 번만 당첨. */
  function draw(opt) {
    var ids = normalizedIds(opt.ids || []);
    var phrase = String(opt.phrase || '').normalize('NFC').trim();
    if (!phrase) throw new Error('추첨 문구가 비어 있어요');
    var slots = slotsOf(opt.prizes);
    var listHash = listHashOf(ids);
    var seed = seedOf(phrase, listHash);
    var order = shuffle(ids, seed);
    var won = {}, winners = [], reserves = [], si = 0;
    var nRes = Math.max(0, toInt(opt.reserves) || 0);
    for (var i = 0; i < order.length; i++) {
      var id = order[i];
      if (won[id]) continue;
      won[id] = 1;
      if (si < slots.length) { winners.push({ prizeId: slots[si].prizeId, prizeName: slots[si].prizeName, n: slots[si].n, norm: id }); si++; }
      else if (reserves.length < nRes) reserves.push(id);
      else break;
    }
    return { algo: ALGO, phrase: phrase, participantCount: ids.length, uniqueCount: Object.keys(ids.reduce(function (m, x) { m[x] = 1; return m; }, {})).length, listHash: listHash, seed: seed, winners: winners, reserves: reserves, shortage: Math.max(0, slots.length - winners.length) };
  }

  /* ---------- 마스킹 ---------- */
  function mask(id, mode) {
    var s = Array.from(String(id || ''));
    if (!s.length) return '';
    if (mode === 'middle') {
      if (s.length <= 2) return s[0] + '*';
      return s.map(function (ch, i) { return i % 3 === 1 ? '*' : ch; }).join('');
    }
    if (s.length <= 3) return s[0] + '*'.repeat(Math.max(1, s.length - 1));
    return s.slice(0, s.length - 3).join('') + '***';
  }

  /* ---------- 공지문·안내문 ---------- */
  var PLAT = { youtube: '유튜브', instagram: '인스타그램', blog: '블로그', chzzk: '치지직', soop: 'SOOP', etc: '채널' };
  function josa(word, pair) {
    var w = String(word || '').replace(/[\s)\]」』"'”’]+$/, '');
    var c = w.charCodeAt(w.length - 1);
    var has = c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 !== 0 : /[0-9]$/.test(w) ? /[013678]$/.test(w) : false;
    var map = { '은는': ['은', '는'], '이가': ['이', '가'], '을를': ['을', '를'] };
    return word + map[pair][has ? 0 : 1];
  }
  function prizeLine(p, a) {
    var t = '· ' + (p.name || '경품') + ' × ' + a.qty + ' (1개 ' + won(a.unitValue) + (p.type === 'physical' ? ', 시가 기준' : '') + ')';
    if (p.sender === 'sponsor') t += ' — 협찬사 직접 발송';
    return t;
  }
  function noticeText(ev, rules) {
    var n = ev.notice || {}, prizes = ev.prizes || [];
    var plat = PLAT[n.platform] || '채널';
    var handle = (n.handle || '').trim();
    var L = [];
    L.push('🎁 ' + (ev.title || '구독자 이벤트') );
    L.push('');
    L.push('■ 참여 방법: ' + ((n.how || '').trim() || '이 게시물에 댓글 달기'));
    L.push('■ 기간: ' + (n.start || '시작일') + ' ~ ' + (n.end || '마감일'));
    L.push('■ 발표: ' + (n.announceDate || '발표일') + ' · ' + (n.announceMethod === 'list' ? '당첨자 목록 공개(아이디 일부 가림)' : '당첨자에게 개별 연락(DM)'));
    L.push('');
    L.push('■ 경품');
    var tx = [];
    prizes.forEach(function (p) {
      var a = assessPrize(p, rules); if (!a.valid) return;
      L.push(prizeLine(p, a));
      if (a.taxable) tx.push({ p: p, a: a });
    });
    L.push('');
    L.push('■ 추첨 방식: 마감 후 참여자 목록을 정리해 목록 지문(해시)을 먼저 공개하고, 추첨 문구' + (n.phraseSource ? '(' + n.phraseSource + ')' : '') + '로 누구나 다시 돌려볼 수 있는 방식으로 추첨합니다.');
    L.push('');
    L.push('■ 꼭 읽어 주세요');
    L.push('· 당첨 안내는 ' + (handle ? handle + ' ' : '') + plat + ' 공식 계정으로만 드립니다. 다른 계정이 당첨을 알리며 개인정보·입금·링크 접속을 요구하면 사칭이니 응하지 마세요.');
    L.push('· 댓글에 전화번호·주소·이메일 등 개인정보를 적지 마세요.');
    L.push('· 경품 발송에 필요한 개인정보(성명, 연락처, 주소 등)는 당첨자 발표 이후 당첨자에 한하여 수집합니다.');
    L.push('· 수집된 개인정보는 경품 발송에만 이용되며, 경품 발송 완료 등 행사 종료 후 지체 없이 파기됩니다.');
    L.push('· 당첨되지 않은 분의 참여 정보는 추첨 후 지체 없이 파기합니다.');
    if (tx.length) {
      tx.forEach(function (o) {
        var who = o.a.withholder === 'sponsor' ? '협찬사' : '주최자';
        var bear = o.a.bearer === 'me' ? '주최자가 부담합니다' : '당첨자가 부담합니다';
        L.push('· ' + josa(o.p.name || '경품', '은는') + ' 5만원을 넘어 제세공과금(소득세 20% + 지방소득세 2% = 22%)이 발생하며, ' + bear + '. 신고는 ' + who + '가 합니다.');
      });
      var needRrn = tx.some(function (o) { return o.a.rrn === 'required' && o.a.withholder === 'me'; });
      if (needRrn) L.push('· 제세공과금 신고를 위해 해당 경품 당첨자의 주민등록번호를 수집합니다(근거: 「소득세법」 제21조, 제127조, 제164조). 신고에 필요한 정보를 기한 안에 주지 않으면 해당 경품 당첨이 취소될 수 있어요.');
    }
    L.push('· 당첨자가 안내 후 ' + (n.replyDays || 3) + '일 안에 답하지 않으면 당첨이 취소되고 예비 당첨자에게 넘어갑니다.');
    return L.join('\n');
  }
  function collectItems(p, rules) {
    var a = assessPrize(p, rules);
    var items = [];
    if (p.type === 'mobile') items.push({ k: '휴대전화 번호', why: '모바일 쿠폰 발송' }, { k: '성명', why: '발송에 꼭 필요한 경우에만', optional: true });
    else if (p.type === 'physical') items.push({ k: '성명', why: '택배 수령' }, { k: '휴대전화 번호', why: '택배 연락' }, { k: '배송 주소', why: '택배 발송' });
    else items.push({ k: '성명(예금주)', why: '이체 확인' }, { k: '은행·계좌번호', why: '상금·상품권 대금 이체(필요한 경우에만)' }, { k: '휴대전화 번호', why: '지급 안내(필요한 경우에만)', optional: true });
    if (a.valid && a.taxable && a.withholder === 'me') {
      if (a.rrn === 'required') items.push({ k: '주민등록번호', why: '원천징수·지급명세서 제출(「소득세법」 제21조·제127조·제164조)', legal: true });
      else if (a.rrn === 'check') items.push({ k: '주민등록번호', why: '확인 필요 — 원천징수는 하지만 1건 10만원 이하 경품은 지급명세서 제출 제외 대상이라 수집이 필요 없을 수 있어요. 세무사·개인정보위에 확인 후 결정하세요.', check: true });
    }
    return { a: a, items: items };
  }
  function dmText(ev, w, rules, opt) {
    opt = opt || {};
    var p = (ev.prizes || []).filter(function (x) { return x.id === w.prizeId; })[0] || {};
    var c = collectItems(p, rules);
    var days = (ev.notice && ev.notice.replyDays) || 3;
    var ret = (ev.payout && ev.payout.retentionDays) || 30;
    var items = c.items.filter(function (i) { return !i.check || opt.includeCheck; });
    var L = [];
    L.push('안녕하세요, ' + (ev.title || '구독자 이벤트') + ' 주최자입니다. 축하드려요! 「' + (p.name || '경품') + '」에 당첨되셨어요.');
    L.push('');
    if (c.a.withholder === 'sponsor') {
      L.push('경품은 협찬사에서 직접 보내 드리며, 발송에 필요한 정보는 협찬사 안내에 따라 제출해 주세요.');
    } else {
      L.push('경품 발송을 위해 아래 정보를 ' + days + '일 안에 이 대화로 보내 주세요.');
      items.forEach(function (i) { L.push('· ' + i.k); });
      L.push('');
      L.push('[개인정보 수집·이용 안내]');
      L.push('· 목적: 경품 발송' + (items.some(function (i) { return i.legal || i.check; }) ? ' 및 제세공과금 신고' : ''));
      L.push('· 항목: ' + items.map(function (i) { return i.k; }).join(', '));
      L.push('· 보유기간: 경품 발송 완료 후 ' + ret + '일(이후 지체 없이 파기)' + (items.some(function (i) { return i.legal; }) ? ' — 주민등록번호는 지급명세서 제출 후 지체 없이 파기' : ''));
      L.push('· 경품 발송 외 다른 목적으로 이용하지 않습니다.');
      L.push('· 동의를 거부할 수 있지만, 거부하시면 경품을 보내 드리기 어려워요.');
    }
    if (c.a.taxable) L.push('· 이 경품은 제세공과금 22%가 발생하며 ' + (c.a.bearer === 'me' ? '주최자가 부담합니다.' : '당첨자 부담입니다(금액: ' + won(c.a.tax) + ').'));
    L.push('');
    L.push(days + '일 안에 답이 없으면 당첨이 취소되고 예비 당첨자에게 넘어가요. 저는 계좌 비밀번호·인증번호·선입금을 요구하지 않아요.');
    return L.join('\n');
  }
  function formQuestions(p, rules, opt) {
    var c = collectItems(p, rules);
    var q = ['당첨된 아이디(댓글 작성 계정)'];
    c.items.forEach(function (i) { if (!i.check || (opt && opt.includeCheck)) q.push(i.k + (i.optional ? ' (선택)' : ' (필수)')); });
    q.push('개인정보 수집·이용 동의 (목적·항목·보유기간 안내 후 체크)');
    return q;
  }

  /* ---------- 기한 계산 ---------- */
  function isHoliday(s, H) { return H && H.dates.indexOf(s) >= 0; }
  function inCoverage(s, H) { return H && s >= H.from && s <= H.through; }
  function shiftDue(legal, H) {
    var d = legal, reasons = [], unknown = false;
    for (var guard = 0; guard < 15; guard++) {
      var wd = parseDate(d).getUTCDay();
      if (wd === 0 || wd === 6) { reasons.push(d + '(' + WD[wd] + ')'); d = addDays(d, 1); continue; }
      if (isHoliday(d, H)) { reasons.push(d + '(' + (H.labels[d] || '공휴일') + ')'); d = addDays(d, 1); continue; }
      if (!inCoverage(d, H)) unknown = true;
      break;
    }
    return { legal: legal, actual: d, shifted: d !== legal, reasons: reasons, holidayUnknown: unknown };
  }
  function withholdingDue(paidDate, rules) {
    var d = parseDate(paidDate); if (!d) return null;
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    m++; if (m > 12) { m = 1; y++; }
    return shiftDue(y + '-' + pad(m) + '-' + pad(rules.withholdingDueDay), rules.holidays);
  }
  function statementDue(paidDate, rules) {
    var d = parseDate(paidDate); if (!d) return null;
    var y = d.getUTCFullYear() + 1;
    var last = new Date(Date.UTC(y, 2, 0));
    return shiftDue(ymd(last), rules.holidays);
  }
  function deadlines(ev, rules) {
    var out = [], s = summarize(ev.prizes, rules), py = ev.payout || {};
    var drawn = ev.draw && ev.draw.drawnAt ? String(ev.draw.drawnAt).slice(0, 10) : '';
    if (s.needWithholding && parseDate(py.paidDate)) {
      var w = withholdingDue(py.paidDate, rules);
      out.push({ key: 'withholding', title: '원천세(소득세+지방소득세) 신고·납부', date: w.actual, legal: w.legal, shift: w, desc: '지급일(' + py.paidDate + ')이 속하는 달의 다음 달 10일. 홈택스에서 원천징수이행상황신고 후 납부, 지방소득세(소득세의 10%)는 위택스. 반기별 납부 승인 사업자는 기한이 다를 수 있어요.', check: 'withholdingFiled' });
      var st = statementDue(py.paidDate, rules);
      out.push({ key: 'statement', title: s.needStatement ? '기타소득 지급명세서 제출' : '기타소득 지급명세서 제출(면제 여부 확인)', date: st.actual, legal: st.legal, shift: st, desc: s.needStatement ? '지급일이 속하는 연도의 다음 연도 2월 말일. 미제출 시 지급금액의 1% 가산세(기한 후 3개월 이내 제출 0.5%).' : '1건 10만원 이하 추첨 경품은 제출 제외 대상일 수 있어요(시행령 제214조). 해당 여부는 세무사·국세청 126에 확인하세요.', check: 'statementFiled', optional: !s.needStatement });
    }
    if (parseDate(drawn)) out.push({ key: 'loser', title: '미당첨자 참여 정보 파기', date: drawn, legal: drawn, desc: '추첨이 끝나면 지체 없이 — 붙여넣은 참여자 목록을 지우세요(검증용 목록을 공개했다면 그 사본만 남겨요).', check: 'loserDataDeleted' });
    if (parseDate(py.shippedDate)) {
      var rd = Math.max(0, toInt(py.retentionDays) || 0);
      var dd = addDays(py.shippedDate, rd);
      if (s.rrnAny && s.needWithholding && parseDate(py.paidDate)) {
        var stD = statementDue(py.paidDate, rules).actual;
        out.push({ key: 'rrn', title: '당첨자 주민등록번호 파기', date: stD, legal: stD, desc: '지급명세서 제출(또는 제출 불필요 확인)이 끝나면 지체 없이 파기하세요. 세법상 장부 보관 필요 여부는 세무사에게 확인하세요.', check: 'rrnDeleted' });
      }
      out.push({ key: 'winner', title: '당첨자 개인정보 파기', date: dd, legal: dd, desc: '발송 완료(' + py.shippedDate + ') 후 안내한 보유기간 ' + rd + '일이 지나면 지체 없이 — DM·폼 응답·스프레드시트·택배 송장 사본까지.', check: 'winnerDataDeleted' });
    }
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  /* ---------- .ics ---------- */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    var bytes = utf8(line); if (bytes.length <= 75) return line;
    var out = [], cur = '', curLen = 0, limit = 75;
    Array.from(line).forEach(function (ch) {
      var l = utf8(ch).length;
      if (curLen + l > limit) { out.push(cur); cur = ' ' + ch; curLen = 1 + l; limit = 75; }
      else { cur += ch; curLen += l; }
    });
    out.push(cur);
    return out.join('\r\n');
  }
  function buildICS(items, opt) {
    opt = opt || {};
    var stamp = (opt.now || new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//webapp-daily//subscriber-giveaway-wrapup//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEscape(opt.calName || '구독자 이벤트 마감')];
    items.forEach(function (it, i) {
      var d = it.date.replace(/-/g, ''), e = addDays(it.date, 1).replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:' + (opt.uidPrefix || 'gp') + '-' + it.key + '-' + d + '-' + i + '@subscriber-giveaway-wrapup', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + e, 'SUMMARY:' + icsEscape(it.title), 'DESCRIPTION:' + icsEscape(it.desc + (it.shift && it.shift.shifted ? ' (법정기한 ' + it.legal + ' → ' + it.date + ', 국세기본법 제5조)' : '')), 'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape('내일: ' + it.title), 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  /* ---------- 검증 링크 ---------- */
  function b64urlEncode(str) {
    var bytes = utf8(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b = typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(bytes) : decodeURIComponent(escape(bin));
  }
  function verifyPayload(ev) {
    var d = ev.draw || {};
    return { v: 1, a: ALGO, t: ev.title || '', p: d.phrase, n: d.participantCount, h: d.listHash, m: d.maskMode || 'end', z: (ev.prizes || []).map(function (p) { return [p.id, p.name, Math.max(1, toInt(p.qty) || 1)]; }), r: (d.reserves || []).length, q: (d.reserves || []).map(function (x) { return x.maskedId; }), w: (d.winners || []).map(function (w) { return [w.prizeId, w.maskedId, w.commentAt || '']; }), at: d.drawnAt || '' };
  }
  function encodeVerify(ev) { return b64urlEncode(JSON.stringify(verifyPayload(ev))); }
  function decodeVerify(s) {
    try {
      var o = JSON.parse(b64urlDecode(s));
      if (!o || o.v !== 1 || typeof o.p !== 'string' || typeof o.h !== 'string' || !Array.isArray(o.z) || !Array.isArray(o.w)) return null;
      return o;
    } catch (e) { return null; }
  }
  /* 목록 텍스트(.txt, 한 줄 한 아이디)로 재추첨해 비교 */
  function verifyWith(payload, listText) {
    var ids = String(listText || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(function (x) { return normId(x); }).filter(Boolean);
    var sorted = normalizedIds(ids);
    var h = listHashOf(sorted);
    var res = { listHash: h, hashMatch: h === payload.h, count: sorted.length, countMatch: sorted.length === payload.n, rows: [] };
    if (!res.hashMatch) { res.match = false; return res; }
    var prizes = payload.z.map(function (z) { return { id: z[0], name: z[1], qty: z[2] }; });
    var r = draw({ ids: sorted, phrase: payload.p, prizes: prizes, reserves: payload.r });
    var ok = r.winners.length === payload.w.length;
    r.winners.forEach(function (w, i) {
      var pub = payload.w[i] || [];
      var mine = mask(w.norm, payload.m === 'middle' ? 'middle' : 'end');
      var same = pub[0] === w.prizeId && String(pub[1] || '').toLowerCase() === mine.toLowerCase();
      if (!same) ok = false;
      res.rows.push({ prizeName: w.prizeName, published: pub[1] || '—', recomputed: mine, same: same });
    });
    var pubQ = Array.isArray(payload.q) ? payload.q : null;
    res.reserveRows = r.reserves.map(function (id, i) {
      var mine = mask(id, payload.m === 'middle' ? 'middle' : 'end');
      var pub = pubQ ? pubQ[i] : null;
      var same = pub == null ? null : String(pub).toLowerCase() === mine.toLowerCase();
      if (same === false) ok = false;
      return { published: pub == null ? '—' : pub, recomputed: mine, same: same };
    });
    if (pubQ && pubQ.length !== r.reserves.length) ok = false;
    res.match = ok;
    return res;
  }

  /* ---------- 샘플 ---------- */
  function sampleEvent() {
    return {
      id: 'ev-sample', title: '구독자 1만 명 감사 이벤트', createdAt: '2026-11-10T19:00:00+09:00',
      prizes: [
        { id: 'p1', name: '모바일 상품권 1만원', unitValue: 10000, qty: 10, type: 'mobile', sender: 'me', taxBearer: 'winner' },
        { id: 'p2', name: '키보드(시가)', unitValue: 129000, qty: 1, type: 'physical', sender: 'me', taxBearer: 'me' },
        { id: 'p3', name: '협찬 이어폰', unitValue: 199000, qty: 1, type: 'physical', sender: 'sponsor', taxBearer: 'winner' }
      ],
      notice: { platform: 'youtube', handle: '@harin_draws', how: '이 영상에 “1만 축하” 댓글 달기 (1인 1회)', start: '2026-12-01', end: '2026-12-10', announceDate: '2026-12-13', announceMethod: 'list', replyDays: 3, phraseSource: '12월 12일 로또 6/45 당첨번호' },
      draw: null, participantsRaw: '', drawOpts: { dedupe: true, keyword: '1만 축하', exclude: '', reserves: 2, maskMode: 'end' },
      payout: { paidDate: '2026-12-20', shippedDate: '2026-12-22', retentionDays: 30 },
      checklist: {}
    };
  }
  function sampleParticipants() {
    var names = ['chppeacy', 'mint_choco', 'lazyotter', 'sky.walker', 'haru_haru', 'bluebird77', 'catnip', 'dodo_land', 'everglow', 'fjord_kim', 'gamja99', 'honeybee', 'ikura', 'jellyfish', 'kiwi_kiwi', 'lemonade', 'moonrise', 'nabi_c', 'orbit_j', 'pudding', 'quokka', 'raccoon', 'sunny_day', 'tteok', 'udon_m', 'violet', 'waffle', 'xenon', 'yuzu_tea', 'zebra_z'];
    var L = ['아이디,댓글,시간'];
    names.forEach(function (n, i) { L.push('@' + n + ',1만 축하해요!' + (i % 7 === 0 ? ' 늘 응원해요' : '') + ',2026-12-0' + (1 + i % 9) + ' ' + pad(9 + i % 12) + ':' + pad((i * 7) % 60)); });
    L.push('@mint_choco,1만 축하 또 남겨요,2026-12-05 21:10');
    L.push('@spam_bot,구독하고 갑니다,2026-12-06 03:00');
    return L.join('\n');
  }

  /* ---------- 자체 점검 ---------- */
  function selfTest(rules) {
    var R = rules, r = [];
    function t(name, ok) { r.push({ name: name, ok: !!ok }); }
    var g = assessPrize({ unitValue: 50000, qty: 1, type: 'giftcard' }, R);
    t('5만원 경품 → 초록·세금 0·주민번호 금지', g.light === 'green' && g.tax === 0 && g.rrn === 'forbidden');
    var o = assessPrize({ unitValue: 100000, qty: 1, type: 'giftcard' }, R);
    t('10만원 경품 → 주황·세액 22,000원', o.light === 'orange' && o.tax === 22000);
    t('10만원 이하 추첨 경품 → 지급명세서 제외 확인 필요', o.statement === 'exempt' && o.rrn === 'check');
    t('대회 상금 25만원 → 초록', assessPrize({ unitValue: 250000, qty: 1, type: 'contest' }, R).light === 'green');
    t('대회 상금 30만원 → 세액 13,200원', assessPrize({ unitValue: 300000, qty: 1, type: 'contest' }, R).tax === 13200);
    var gu = assessPrize({ unitValue: 100000, qty: 1, type: 'giftcard', taxBearer: 'me' }, R);
    t('대납 10만원 → 소득 128,205원·세액 28,205원', gu.gross === 128205 && gu.grossTax === 28205 && gu.light === 'red');
    t('SHA-256("abc") 표준값', sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    var ids = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];
    var pz = [{ id: 'x', name: 'X', qty: 2 }];
    var d1 = draw({ ids: ids, phrase: '로또 1 2 3', prizes: pz }), d2 = draw({ ids: ids.slice().reverse(), phrase: '로또 1 2 3', prizes: pz });
    t('같은 문구·목록 → 같은 당첨자(입력 순서 무관)', JSON.stringify(d1.winners) === JSON.stringify(d2.winners));
    var d3 = draw({ ids: ids, phrase: '로또 1 2 4', prizes: pz });
    t('문구 한 글자 변경 → 시드 변경', d3.seed !== d1.seed);
    t('끝 3자 마스킹 chppe***', mask('chppeacy') === 'chppe***');
    t('중간 마스킹 c*pp*ac*', mask('chppeacy', 'middle') === 'c*pp*ac*');
    var w = withholdingDue('2026-12-20', R), s = statementDue('2026-12-20', R);
    t('원천세 2027-01-10(일) → 01-11', w.legal === '2027-01-10' && w.actual === '2027-01-11');
    t('지급명세서 2027-02-28(일) → 3·1절 지나 03-02', s.legal === '2027-02-28' && s.actual === '2027-03-02');
    t('.ics 기본 구조', /BEGIN:VCALENDAR[\s\S]*BEGIN:VEVENT[\s\S]*TRIGGER:-P1D[\s\S]*END:VCALENDAR/.test(buildICS([{ key: 'k', title: 't', date: '2027-01-11', desc: 'd' }])));
    return r;
  }

  return { josa: josa, ALGO: ALGO, TYPES: TYPES, PLAT: PLAT, won: won, toInt: toInt, parseDate: parseDate, addDays: addDays, weekday: weekday, diffDays: diffDays, assessPrize: assessPrize, summarize: summarize, parseParticipants: parseParticipants, filterEntries: filterEntries, normId: normId, normalizedIds: normalizedIds, sha256Hex: sha256Hex, sfc32: sfc32, listHashOf: listHashOf, seedOf: seedOf, shuffle: shuffle, draw: draw, mask: mask, noticeText: noticeText, collectItems: collectItems, dmText: dmText, formQuestions: formQuestions, withholdingDue: withholdingDue, statementDue: statementDue, shiftDue: shiftDue, deadlines: deadlines, buildICS: buildICS, encodeVerify: encodeVerify, decodeVerify: decodeVerify, verifyPayload: verifyPayload, verifyWith: verifyWith, b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode, sampleEvent: sampleEvent, sampleParticipants: sampleParticipants, selfTest: selfTest };
});
