/* 원산지 한 장 — rules.js: 표시 대상 판정·문구 생성·영수증 보관 계산·신호등 (순수 함수, UMD) */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.OriginRules = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var APP = '원산지 한 장';
  var KINDS = ['한우', '육우', '젖소'];
  function str(x, max) { return String(x == null ? '' : x).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 60); }
  function itemById(rules, id) { for (var i = 0; i < rules.items.length; i++) if (rules.items[i].id === id) return rules.items[i]; return null; }
  function useOf(item, use) { if (!item || !item.uses) return null; for (var i = 0; i < item.uses.length; i++) if (item.uses[i][0] === use) return item.uses[i]; return null; }

  /* 표시 대상 판정: {applies, reason, unsure} */
  function applies(ing, rules) {
    var item = itemById(rules, ing && ing.item);
    if (!item) return { applies: false, reason: '표시 대상 품목이 아니에요' };
    if (!item.uses) return { applies: true, reason: item.name + '은(는) 표시 대상 29품목이에요' };
    var u = useOf(item, ing.use);
    if (!u) return { applies: false, reason: item.name + ': 쓰임새를 골라 주세요', needUse: true };
    var r = { applies: !!u[2], reason: (u[2] ? '표시 대상 — ' : '표시 대상 아님 — ') + item.rule + ' (' + u[1] + ')' };
    if (item.unsure && item.unsure[ing.use]) r.unsure = item.unsure[ing.use];
    return r;
  }

  /* 받침 여부로 조사 고르기 */
  function hasBatchim(w) {
    var s = String(w);
    for (var i = s.length - 1; i >= 0; i--) { var c = s.charCodeAt(i); if (c >= 0xAC00 && c <= 0xD7A3) return (c - 0xAC00) % 28 !== 0; if (/[0-9]/.test(s[i])) return /[013678]/.test(s[i]); }
    return false;
  }
  function josa(w, pair) { var p = pair.split('/'); return w + (hasBatchim(w) ? p[0] : p[1]); }
  function withSan(c) { c = str(c, 30); if (!c) return ''; return /산$/.test(c) ? c : c + '산'; }

  /* 원산지 한 덩어리 문구 */
  function basePhrase(o, item, prefs) {
    prefs = prefs || {};
    var dom = prefs.domLabel === '국산' ? '국산' : '국내산';
    if (!o || !o.type) return '';
    if (o.type === 'domestic') {
      var lbl = item && item.cat === 'sea' && o.label === '연근해산' ? '연근해산' : dom;
      var kind = item && item.beefKind && o.beefKind ? ' ' + o.beefKind : '';
      if (o.bornIn) return lbl + kind + '(출생국: ' + str(o.bornIn, 30) + ')';
      return lbl + kind;
    }
    if (o.type === 'import') return withSan(o.country);
    if (o.type === 'foreign') return '외국산';
    if (o.type === 'distant') return '원양산' + (o.sea ? ', ' + withSan(o.sea) : '');
    if (o.type === 'mixed') {
      var ps = sortedParts(o).map(function (p) { return basePhrase(p, item, prefs); }).filter(Boolean);
      if (ps.length < 2) return ps[0] || '';
      var out = '';
      for (var i = 0; i < ps.length; i++) {
        if (i === ps.length - 1) out += josa(ps[i], '을/를');
        else if (i === ps.length - 2) out += josa(ps[i], '과/와') + ' ';
        else out += ps[i] + ', ';
      }
      return out + ' 섞음';
    }
    return '';
  }
  function sortedParts(o) {
    var ps = (o.parts || []).map(function (p, i) { return { p: p, i: i }; });
    ps.sort(function (a, b) { var d = (Number(b.p.pct) || 0) - (Number(a.p.pct) || 0); return d || a.i - b.i; });
    return ps.map(function (x) { return x.p; });
  }

  /* 검증: 오류(막음) / 경고(안내) */
  function validateOrigin(o, item, opt) {
    var e = [], w = [];
    opt = opt || {};
    var who = opt.label || (item ? item.name : '');
    if (!o || !o.type) { e.push(who + ': 원산지를 골라 주세요'); return { errors: e, warnings: w }; }
    if (o.type === 'distant' && item && item.cat !== 'sea') e.push(who + ': 원양산은 수산물만 고를 수 있어요');
    if (o.type === 'import' && !str(o.country)) e.push(who + ': 수입 국가를 골라 주세요');
    if (o.type === 'domestic') {
      if (item && item.beefKind && KINDS.indexOf(o.beefKind) < 0) e.push(who + ': 국내산 쇠고기는 한우·육우·젖소 중 하나를 꼭 골라야 해요');
      if (o.raisedHere && !str(o.bornIn)) e.push(who + ': 출생 국가를 골라 주세요');
      if (o.bornIn && item && item.beefKind && o.beefKind === '한우') w.push(who + ': 수입한 소를 키운 경우는 보통 "육우"예요. 식육 종류를 다시 확인하세요');
    }
    if (o.type === 'mixed') {
      var ps = o.parts || [];
      if (ps.length < 2) e.push(who + ': 섞음은 원산지를 2개 이상 넣어 주세요');
      var sum = 0, seen = {};
      ps.forEach(function (p, i) {
        var pv = validateOrigin(p, item, { label: who + ' ' + (i + 1) + '번째' });
        if (p.type === 'mixed') pv.errors.push(who + ': 섞음 안에 섞음은 넣을 수 없어요');
        e = e.concat(pv.errors);
        var n = Number(p.pct);
        if (!(n > 0 && n < 100)) e.push(who + ' ' + (i + 1) + '번째: 비율(1~99%)을 넣어 주세요');
        sum += n || 0;
        var ph = basePhrase(p, item, {});
        if (ph && seen[ph]) e.push(who + ': 같은 원산지(' + ph + ')가 두 번 들어갔어요');
        seen[ph] = 1;
      });
      if (ps.length >= 2 && Math.round(sum) !== 100) e.push(who + ': 비율 합계가 ' + Math.round(sum) + '%예요. 100%가 되게 맞춰 주세요');
      var s = sortedParts(o);
      for (var i = 1; i < s.length; i++) if (Number(s[i].pct) === Number(s[i - 1].pct)) { w.push(who + ': 비율이 같은 원산지가 있어요. 입력한 순서대로 적어요'); break; }
    }
    return { errors: e, warnings: w };
  }

  /* 배추김치 */
  function kimchiNeedsChili(uses) { return uses.some(function (u) { return u !== 'baek'; }); }
  function validateKimchi(k, needChili) {
    var e = [], w = [];
    if (!k || !k.method) { e.push('배추김치: 직접 담금 / 수입 완제품 중에서 골라 주세요'); return { errors: e, warnings: w }; }
    if (k.method === 'import') { if (!str(k.country)) e.push('배추김치: 수입 완제품의 제조 국가를 골라 주세요'); return { errors: e, warnings: w }; }
    var cab = { cat: 'agri', name: '배추' }, chi = { cat: 'agri', name: '고춧가루' };
    var a = validateOrigin(k.cabbage, cab, { label: '배추김치의 배추' }); e = e.concat(a.errors); w = w.concat(a.warnings);
    if (needChili !== false) { var b = validateOrigin(k.chili, chi, { label: '배추김치의 고춧가루' }); e = e.concat(b.errors); w = w.concat(b.warnings); }
    return { errors: e, warnings: w };
  }
  function kimchiPhrase(k, needChili, prefs, inDish) {
    if (!k || !k.method) return '';
    if (k.method === 'import') return inDish ? '배추김치: ' + withSan(k.country) : '배추김치(' + withSan(k.country) + ')';
    var s = '배추: ' + basePhrase(k.cabbage, { cat: 'agri' }, prefs);
    if (needChili !== false) s += ', 고춧가루: ' + basePhrase(k.chili, { cat: 'agri' }, prefs);
    return '배추김치(' + s + ')';
  }

  /* 메뉴 → 표시 대상 재료(품목별로 묶음) */
  function menuTargets(menu, rules) {
    var map = {}, order = [], exempt = [], unsure = [], needUse = [];
    (menu.ings || []).forEach(function (g) {
      var a = applies(g, rules);
      if (a.needUse) { needUse.push(g.item); return; }
      if (!a.applies) { exempt.push({ item: g.item, use: g.use, reason: a.reason }); return; }
      if (a.unsure) unsure.push({ item: g.item, use: g.use, reason: a.unsure });
      if (!map[g.item]) { map[g.item] = { item: g.item, uses: [] }; order.push(g.item); }
      if (g.use) map[g.item].uses.push(g.use);
    });
    return { targets: order.map(function (k) { return map[k]; }), exempt: exempt, unsure: unsure, needUse: needUse };
  }
  function usedTargets(menus, rules) {
    var map = {}, order = [];
    (menus || []).forEach(function (m) {
      menuTargets(m, rules).targets.forEach(function (t) {
        if (!map[t.item]) { map[t.item] = { item: t.item, uses: [], menus: [] }; order.push(t.item); }
        map[t.item].uses = map[t.item].uses.concat(t.uses); map[t.item].menus.push(m.name);
      });
    });
    var idx = {}; rules.items.forEach(function (it, i) { idx[it.id] = i; });
    order.sort(function (a, b) { return idx[a] - idx[b]; });
    return order.map(function (k) { return map[k]; });
  }
  function itemPhrase(t, origins, rules, prefs, inDish) {
    var item = itemById(rules, t.item), o = origins[t.item];
    if (item.kimchi) return kimchiPhrase(o, kimchiNeedsChili(t.uses), prefs, inDish);
    var p = basePhrase(o, item, prefs);
    return p ? item.name + ': ' + p : '';
  }
  function itemValid(t, origins, rules) {
    var item = itemById(rules, t.item), o = origins[t.item];
    return item.kimchi ? validateKimchi(o, kimchiNeedsChili(t.uses)) : validateOrigin(o, item);
  }
  function menuLine(menu, origins, rules, prefs, bulk) {
    bulk = bulk || {};
    var parts = menuTargets(menu, rules).targets.filter(function (t) { return !bulk[t.item]; })
      .map(function (t) { return itemPhrase(t, origins, rules, prefs, true); }).filter(Boolean);
    return parts.length ? menu.name + '(' + parts.join(', ') + ')' : '';
  }
  /* 일괄 표시: 우리 업소에서는 "국내산 쌀"만 사용합니다 */
  function bulkPhrase(t, origins, rules, prefs) {
    var item = itemById(rules, t.item), o = origins[t.item];
    if (!o) return '';
    if (item.kimchi) {
      if (o.method === 'import') return '우리 업소에서는 "' + withSan(o.country) + ' 배추김치"만 사용합니다.';
      var cab = basePhrase(o.cabbage, { cat: 'agri' }, prefs), needChili = kimchiNeedsChili(t.uses);
      if (!needChili) return '우리 업소에서는 "' + cab + ' 배추로 만든 배추김치"만 사용합니다.';
      var chi = basePhrase(o.chili, { cat: 'agri' }, prefs);
      if (cab === chi) return '우리 업소에서는 "' + cab + ' 배추와 고춧가루로 만든 배추김치"만 사용합니다.';
      return '우리 업소에서는 "배추(' + cab + ')와 고춧가루(' + chi + ')로 만든 배추김치"만 사용합니다.';
    }
    var p = basePhrase(o, item, prefs);
    return '우리 업소에서는 "' + p + ' ' + item.name + '"만 사용합니다.';
  }
  function canBulk(t, origins, rules) {
    var o = origins[t.item]; if (!o) return false;
    if (o.type === 'mixed') return false;
    if (o.method === 'direct' && ((o.cabbage && o.cabbage.type === 'mixed') || (o.chili && o.chili.type === 'mixed'))) return false;
    return itemValid(t, origins, rules).errors.length === 0;
  }

  /* 표시판 모델 (A3) */
  function boardModel(st, rules) {
    var f = rules.format, prefs = st.prefs || {}, bulkSel = prefs.bulk || {}, origins = st.origins || {};
    var used = usedTargets(st.menus, rules), bulk = {}, bulkLines = [];
    used.forEach(function (t) { if (bulkSel[t.item] && canBulk(t, origins, rules)) { bulk[t.item] = 1; bulkLines.push(bulkPhrase(t, origins, rules, prefs)); } });
    var entries = [], en = st.shop && st.shop.lang === 'ko+en';
    if (prefs.layout === 'byItem') {
      used.forEach(function (t) {
        if (bulk[t.item]) return;
        var ph = itemPhrase(t, origins, rules, prefs, false); if (!ph) return;
        var item = itemById(rules, t.item);
        entries.push({ head: { text: ph, pt: f.originPt, sub: en ? enLabel(item, origins[t.item], rules) : '' }, lines: [{ text: t.menus.join(' · '), pt: f.namePt, role: 'name' }] });
      });
    } else {
      (st.menus || []).forEach(function (m) {
        var ts = menuTargets(m, rules).targets.filter(function (t) { return !bulk[t.item]; });
        var lines = ts.map(function (t) { return { text: itemPhrase(t, origins, rules, prefs, true), pt: f.originPt, role: 'origin', sub: en ? enLabel(itemById(rules, t.item), origins[t.item], rules) : '' }; }).filter(function (l) { return l.text; });
        if (lines.length) entries.push({ head: { text: m.name, pt: f.namePt, role: 'name' }, lines: lines });
      });
    }
    return { title: f.title, titlePt: f.titlePt, bulk: bulkLines.map(function (b) { return { text: b, pt: f.originPt }; }), entries: entries };
  }
  function enLabel(item, o, rules) {
    if (!item || !o) return '';
    var ce = rules.countryEn || {};
    function one(x) { if (!x) return ''; if (x.type === 'domestic') return 'Korea' + (x.beefKind ? ' (' + ({ '한우': 'Hanwoo', '육우': 'Yugwoo', '젖소': 'Dairy cattle' }[x.beefKind]) + ')' : ''); if (x.type === 'import') return ce[x.country] || x.country; if (x.type === 'distant') return 'Deep-sea'; if (x.type === 'foreign') return 'Imported'; if (x.type === 'mixed') return sortedParts(x).map(one).join(' + '); return ''; }
    if (item.kimchi) return 'Kimchi: ' + (o.method === 'import' ? (ce[o.country] || o.country) : 'cabbage ' + one(o.cabbage) + (o.chili && o.chili.type ? ', chili ' + one(o.chili) : ''));
    return item.en + ': ' + one(o);
  }

  /* 출력 텍스트 */
  function outputs(st, rules) {
    var prefs = st.prefs || {}, origins = st.origins || {}, menus = st.menus || [];
    var b = boardModel(st, rules);
    var full = menus.map(function (m) { return menuLine(m, origins, rules, prefs); }).filter(Boolean);
    var menuBoard = b.bulk.map(function (x) { return x.text; }).concat(menus.map(function (m) { return menuLine(m, origins, rules, prefs, bulkMap(st, rules)); }).filter(Boolean));
    var used = usedTargets(menus, rules);
    var shortParts = used.map(function (t) { return itemPhrase(t, origins, rules, prefs, false); }).filter(Boolean);
    var shop = st.shop && st.shop.name ? st.shop.name + ' ' : '';
    return {
      menu: menuBoard.join('\n'),
      delivery: '[원산지 표시]\n' + full.join('\n'),
      pack: shop + '원산지: ' + shortParts.join(' / '),
      fridge: used.map(function (t) { return '■ ' + itemPhrase(t, origins, rules, prefs, false).replace(/^([^:(]+): /, '$1 — '); }).join('\n')
    };
  }
  function bulkMap(st, rules) {
    var m = {}, sel = (st.prefs || {}).bulk || {};
    usedTargets(st.menus, rules).forEach(function (t) { if (sel[t.item] && canBulk(t, st.origins || {}, rules)) m[t.item] = 1; });
    return m;
  }

  /* 날짜: 영수증 보관 만료일 = 매입일 + N개월 (그달에 같은 날이 없으면 말일) */
  function parseD(ds) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ds || '')); if (!m) return null; var y = +m[1], mo = +m[2], d = +m[3]; if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null; return { y: y, m: mo, d: d }; }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function addMonths(ds, n) {
    var p = parseD(ds); if (!p) return null;
    var t = p.m - 1 + n, y = p.y + Math.floor(t / 12), m = ((t % 12) + 12) % 12 + 1;
    return y + '-' + pad(m) + '-' + pad(Math.min(p.d, daysIn(y, m)));
  }
  function dayNum(ds) { var p = parseD(ds); return p ? Date.UTC(p.y, p.m - 1, p.d) / 86400000 : NaN; }
  function daysBetween(a, b) { return dayNum(b) - dayNum(a); }
  function receiptExpiry(ds, months) { return addMonths(ds, months || 6); }
  function receiptStatus(ds, today, months, warnDays) {
    var exp = receiptExpiry(ds, months); if (!exp) return null;
    var left = daysBetween(today, exp), w = warnDays == null ? 30 : warnDays;
    var st = left < 0 ? 'done' : left <= w ? 'soon' : 'keep';
    return { expiresAt: exp, daysLeft: left, status: st, label: st === 'done' ? '보관 기간 끝' : st === 'soon' ? '만료 임박 D-' + left : '보관 중 D-' + left };
  }

  /* 셀프점검 신호등 */
  function trafficLight(answers, checklist) {
    var no = [], crit = [], un = 0;
    checklist.forEach(function (c) {
      var a = answers && answers[c.id];
      if (a === 'no') { no.push(c.id); if (c.crit) crit.push(c.id); }
      else if (a !== 'yes' && !(a === 'na' && c.na)) un++;
    });
    var color = crit.length ? 'red' : (no.length || un) ? 'yellow' : 'green';
    return { color: color, no: no, crit: crit, unanswered: un, label: { red: '빨강 — 오늘 바로 고쳐요', yellow: '노랑 — 확인할 게 남았어요', green: '초록 — 잘 지키고 있어요' }[color] };
  }

  function seasonFor(ds, seasons) {
    var p = parseD(ds); if (!p) return null;
    for (var i = 0; i < seasons.length; i++) if (seasons[i].months.indexOf(p.m) >= 0) return seasons[i];
    return null;
  }
  function pageTitle(h, app) {
    app = app || APP;
    var t = String(h || '').replace(/\s+/g, ' ').trim();
    return !t || t === app ? app : t + ' — ' + app;
  }

  /* 가져오기·저장 데이터 정리 */
  var OT = ['domestic', 'import', 'foreign', 'distant', 'mixed'];
  function cleanOrigin(o, depth) {
    if (!o || typeof o !== 'object' || OT.indexOf(o.type) < 0) return null;
    var r = { type: o.type };
    if (o.country) r.country = str(o.country, 30);
    if (KINDS.indexOf(o.beefKind) >= 0) r.beefKind = o.beefKind;
    if (o.raisedHere) r.raisedHere = true;
    if (o.bornIn) r.bornIn = str(o.bornIn, 30);
    if (o.label === '연근해산') r.label = '연근해산';
    if (o.sea) r.sea = str(o.sea, 30);
    if (o.pct != null && isFinite(Number(o.pct))) r.pct = Math.max(0, Math.min(100, Math.round(Number(o.pct))));
    if (o.type === 'mixed' && !depth) r.parts = (Array.isArray(o.parts) ? o.parts : []).slice(0, 5).map(function (p) { return cleanOrigin(p, 1); }).filter(Boolean);
    return r;
  }
  function cleanOrigins(src, rules) {
    var out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(function (k) {
      var item = itemById(rules, k); if (!item) return;
      var o = src[k];
      if (item.kimchi) {
        if (!o || (o.method !== 'direct' && o.method !== 'import')) return;
        var r = { method: o.method };
        if (o.country) r.country = str(o.country, 30);
        var c = cleanOrigin(o.cabbage), h = cleanOrigin(o.chili);
        if (c) r.cabbage = c; if (h) r.chili = h;
        out[k] = r;
      } else { var co = cleanOrigin(o); if (co) out[k] = co; }
    });
    return out;
  }
  function cleanMenus(src, rules) {
    return (Array.isArray(src) ? src : []).slice(0, 80).map(function (m, i) {
      if (!m || typeof m !== 'object') return null;
      var name = str(m.name, 30); if (!name) return null;
      var ings = (Array.isArray(m.ings) ? m.ings : []).map(function (g) {
        var item = g && itemById(rules, g.item); if (!item) return null;
        var r = { item: item.id }; if (item.uses && useOf(item, g.use)) r.use = g.use; return r;
      }).filter(Boolean).slice(0, 12);
      return { id: str(m.id, 40) || 'm' + i + '-' + name, name: name, ings: ings };
    }).filter(Boolean);
  }
  function isDate(ds) { return !!parseD(ds); }
  function sanitizeImport(obj, rules) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('JSON 형식이 아니에요');
    if (obj.app !== 'origin-one-sheet') throw new Error('원산지 한 장에서 내보낸 파일이 아니에요');
    var shop = obj.shop && typeof obj.shop === 'object' ? obj.shop : {};
    var types = ['general', 'rest', 'catering'];
    return {
      shop: { name: str(shop.name, 30), type: types.indexOf(shop.type) >= 0 ? shop.type : 'general', lang: shop.lang === 'ko+en' ? 'ko+en' : 'ko' },
      menus: cleanMenus(obj.menus, rules),
      origins: cleanOrigins(obj.origins, rules),
      history: (Array.isArray(obj.history) ? obj.history : []).filter(function (h) { return h && isDate(h.date) && itemById(rules, h.itemId); }).slice(-300)
        .map(function (h) { return { date: h.date, itemId: h.itemId, before: str(h.before, 200), after: str(h.after, 200) }; }),
      receipts: (Array.isArray(obj.receipts) ? obj.receipts : []).filter(function (r) { return r && isDate(r.date); }).slice(0, 2000)
        .map(function (r, i) { return { id: str(r.id, 40) || 'r' + i, date: r.date, item: str(r.item, 30), origin: str(r.origin, 60), supplier: str(r.supplier, 40), expiresAt: addMonths(r.date, 6) }; }),
      checks: (function (c) { var o = {}; if (c && typeof c === 'object') { Object.keys(c).forEach(function (k) { if (/^q\d+$/.test(k) && ['yes', 'no', 'na'].indexOf(c[k]) >= 0) o[k] = c[k]; }); if (c.checkedAt) o.checkedAt = str(c.checkedAt, 40); } return o; })(obj.checks),
      prefs: (function (p) { p = p && typeof p === 'object' ? p : {}; var b = {}; if (p.bulk && typeof p.bulk === 'object') Object.keys(p.bulk).forEach(function (k) { if (itemById(rules, k) && p.bulk[k]) b[k] = true; }); return { bulk: b, layout: p.layout === 'byItem' ? 'byItem' : 'byMenu', domLabel: p.domLabel === '국산' ? '국산' : '국내산', hideSeason: !!p.hideSeason, setupDone: !!p.setupDone }; })(obj.prefs)
    };
  }

  /* 자체 점검 */
  function selfTest(rules) {
    var res = [];
    function ok(name, cond, got) { res.push({ name: name, pass: !!cond, got: cond ? undefined : got }); }
    var I = function (id) { return itemById(rules, id); };
    ok('29 items', rules.items.length === 29, rules.items.length);
    ok('20 seafood', rules.items.filter(function (i) { return i.cat === 'sea'; }).length === 20);
    ok('떡볶이 쌀 제외', !applies({ item: 'rice', use: 'tteok' }, rules).applies);
    ok('밥 쌀 대상', applies({ item: 'rice', use: 'bap' }, rules).applies && applies({ item: 'rice', use: 'juk' }, rules).applies && applies({ item: 'rice', use: 'nurungji' }, rules).applies);
    ok('두부·콩국수·콩비지 대상, 된장 제외', applies({ item: 'soy', use: 'tofu' }, rules).applies && applies({ item: 'soy', use: 'kongguksu' }, rules).applies && applies({ item: 'soy', use: 'biji' }, rules).applies && !applies({ item: 'soy', use: 'jang' }, rules).applies);
    ok('열무김치 비대상, 겉절이·백김치 대상', !applies({ item: 'kimchi', use: 'yeolmu' }, rules).applies && applies({ item: 'kimchi', use: 'geotjeori' }, rules).applies && applies({ item: 'kimchi', use: 'baek' }, rules).applies);
    ok('황태 제외', !applies({ item: 'pollock', use: 'dried' }, rules).applies);
    ok('국내산 쇠고기 종류 강제', validateOrigin({ type: 'domestic' }, I('beef')).errors.length === 1);
    ok('국내산 한우', basePhrase({ type: 'domestic', beefKind: '한우' }, I('beef')) === '국내산 한우');
    ok('출생국 쇠고기', basePhrase({ type: 'domestic', beefKind: '육우', raisedHere: true, bornIn: '호주' }, I('beef')) === '국내산 육우(출생국: 호주)');
    ok('출생국 돼지', basePhrase({ type: 'domestic', raisedHere: true, bornIn: '덴마크' }, I('pork')) === '국내산(출생국: 덴마크)');
    var mx = { type: 'mixed', parts: [{ type: 'import', country: '미국', pct: 30 }, { type: 'domestic', pct: 70 }] };
    ok('섞음 순서', basePhrase(mx, I('pork')) === '국내산과 미국산을 섞음', basePhrase(mx, I('pork')));
    ok('섞음 한우와', basePhrase({ type: 'mixed', parts: [{ type: 'import', country: '호주', pct: 40 }, { type: 'domestic', beefKind: '한우', pct: 60 }] }, I('beef')) === '국내산 한우와 호주산을 섞음');
    ok('섞음 합계 검증', validateOrigin({ type: 'mixed', parts: [{ type: 'domestic', pct: 50 }, { type: 'import', country: '미국', pct: 40 }] }, I('pork')).errors.length === 1);
    ok('김치 직접', kimchiPhrase({ method: 'direct', cabbage: { type: 'domestic' }, chili: { type: 'import', country: '중국' } }, true) === '배추김치(배추: 국내산, 고춧가루: 중국산)');
    ok('김치 수입', kimchiPhrase({ method: 'import', country: '중국' }, true) === '배추김치(중국산)');
    ok('백김치 고춧가루 생략', kimchiPhrase({ method: 'direct', cabbage: { type: 'domestic' } }, false) === '배추김치(배추: 국내산)');
    ok('일괄 쌀', bulkPhrase({ item: 'rice', uses: ['bap'] }, { rice: { type: 'domestic' } }, rules) === '우리 업소에서는 "국내산 쌀"만 사용합니다.');
    ok('원양산 해역', basePhrase({ type: 'distant', sea: '태평양' }, I('redbream')) === '원양산, 태평양산');
    ok('만료 3/10', addMonths('2026-03-10', 6) === '2026-09-10');
    ok('만료 8/31', addMonths('2026-08-31', 6) === '2027-02-28');
    ok('만료 윤년', addMonths('2027-08-31', 6) === '2028-02-29');
    ok('만료 연말', addMonths('2026-12-15', 6) === '2027-06-15');
    var rs = receiptStatus('2026-05-10', '2026-10-28');
    ok('임박', rs.status === 'soon' && rs.daysLeft === 13, rs);
    ok('신호등', trafficLight({ q1: 'no' }, rules.checklist).color === 'red' && trafficLight({}, rules.checklist).color === 'yellow');
    ok('제목 중복 없음', pageTitle('원산지 한 장') === APP && pageTitle('셀프 점검') === '셀프 점검 — ' + APP);
    var pass = res.filter(function (r) { return r.pass; }).length;
    return { pass: pass, fail: res.length - pass, total: res.length, results: res };
  }

  return { APP: APP, KINDS: KINDS, itemById: itemById, applies: applies, josa: josa, basePhrase: basePhrase, sortedParts: sortedParts, validateOrigin: validateOrigin,
    validateKimchi: validateKimchi, kimchiPhrase: kimchiPhrase, kimchiNeedsChili: kimchiNeedsChili, menuTargets: menuTargets, usedTargets: usedTargets, itemPhrase: itemPhrase,
    itemValid: itemValid, menuLine: menuLine, bulkPhrase: bulkPhrase, canBulk: canBulk, boardModel: boardModel, outputs: outputs, addMonths: addMonths, daysBetween: daysBetween,
    receiptExpiry: receiptExpiry, receiptStatus: receiptStatus, trafficLight: trafficLight, seasonFor: seasonFor, pageTitle: pageTitle, sanitizeImport: sanitizeImport,
    cleanOrigins: cleanOrigins, cleanMenus: cleanMenus, isDate: isDate, selfTest: selfTest };
});
