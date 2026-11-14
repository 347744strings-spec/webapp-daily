/* 겨울방학 돌봄 빈칸표 — 계산 엔진 (UMD: window.GapEngine / require) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GapEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DAY = 86400000;
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  const HM = /^\d{2}:\d{2}$/;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const STORAGE_KEY = 'gapPlanner.v1';
  const SETTINGS_KEY = 'gapPlanner.settings.v1';

  function toN(iso) {
    if (typeof iso !== 'string' || !RE.test(iso)) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d);
    const dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return Math.round(t / DAY);
  }
  const isDate = s => toN(s) !== null;
  const toISO = n => new Date(n * DAY).toISOString().slice(0, 10);
  const addDays = (iso, k) => toISO(toN(iso) + k);
  const diff = (a, b) => toN(a) - toN(b);
  const weekday = iso => new Date(toN(iso) * DAY).getUTCDay();
  function todayKST(now) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(now == null ? Date.now() : now));
    const g = t => p.find(x => x.type === t).value;
    return g('year') + '-' + g('month') + '-' + g('day');
  }
  function fmt(iso, opt) {
    if (!isDate(iso)) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    const w = WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return (opt === 'short' ? '' : y + '. ') + Number(m) + '. ' + Number(d) + '.' + (opt === 'now' ? '' : ' (' + w + ')');
  }
  function toMin(hm) {
    if (typeof hm !== 'string' || !HM.test(hm)) return null;
    const [h, m] = hm.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  function fromMin(n) {
    n = ((n % 1440) + 1440) % 1440;
    const h = Math.floor(n / 60), m = n % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function clampInt(n, lo, hi) {
    n = Number(n);
    if (!isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, Math.round(n)));
  }

  /* interval helpers: half-open [a,b) in minutes, may exceed 1440 for overnight */
  function merge(ivs) {
    const a = (ivs || []).filter(x => x && x[1] > x[0]).map(x => [x[0], x[1]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const out = [];
    for (const x of a) {
      if (!out.length || x[0] > out[out.length - 1][1]) out.push(x.slice());
      else out[out.length - 1][1] = Math.max(out[out.length - 1][1], x[1]);
    }
    return out;
  }
  function subtract(base, cut) {
    let cur = merge(base);
    for (const [c0, c1] of merge(cut)) {
      const next = [];
      for (const [a, b] of cur) {
        if (c1 <= a || c0 >= b) next.push([a, b]);
        else {
          if (a < c0) next.push([a, c0]);
          if (c1 < b) next.push([c1, b]);
        }
      }
      cur = next;
    }
    return cur;
  }
  function intersectLen(ivs, a, b) {
    let n = 0;
    for (const [x, y] of ivs) {
      const lo = Math.max(x, a), hi = Math.min(y, b);
      if (hi > lo) n += hi - lo;
    }
    return n;
  }
  function coversFully(ivs, a, b) {
    return intersectLen(ivs, a, b) >= (b - a);
  }
  function unionLen(ivs, a, b) {
    return merge(ivs.map(([x, y]) => [Math.max(x, a), Math.min(y, b)])).reduce((s, p) => s + Math.max(0, p[1] - p[0]), 0);
  }

  function holidayMap(holidays) {
    const m = Object.create(null);
    (holidays && holidays.days ? holidays.days : holidays || []).forEach(d => {
      const iso = d.date || d;
      if (isDate(iso)) m[iso] = d.name || '공휴일';
    });
    return m;
  }

  function buildDays(start, end, holidays) {
    if (!isDate(start) || !isDate(end) || toN(end) <= toN(start)) return [];
    const H = holidayMap(holidays);
    const out = [];
    for (let n = toN(start); n < toN(end); n++) {
      const iso = toISO(n);
      const wd = weekday(iso);
      const hname = H[iso] || null;
      out.push({
        date: iso,
        weekday: wd,
        wlabel: WD[wd],
        isWeekend: wd === 0 || wd === 6,
        isHoliday: !!hname,
        holidayName: hname,
        kind: hname ? 'holiday' : (wd === 0 || wd === 6 ? 'weekend' : 'weekday')
      });
    }
    return out;
  }

  function inClosed(closed, iso) {
    return (closed || []).some(c => c && isDate(c.from) && isDate(c.to) && iso >= c.from && iso <= c.to);
  }
  function closedReason(closed, iso) {
    const c = (closed || []).find(x => x && isDate(x.from) && isDate(x.to) && iso >= x.from && iso <= x.to);
    return c ? (c.reason || '미운영') : null;
  }

  /* 교대: weekly-rotate. weeks[].start/end, anchor date. */
  function patternTimes(g, iso) {
    const p = g.pattern;
    if (!p || p.type !== 'weekly-rotate' || !Array.isArray(p.weeks) || !p.weeks.length || !isDate(p.anchor)) {
      return { start: g.start, end: g.end };
    }
    const w = p.weeks.length;
    const idx = ((Math.floor((toN(iso) - toN(p.anchor)) / 7) % w) + w) % w;
    const rec = p.weeks[idx] || {};
    return { start: rec.start || g.start, end: rec.end || g.end, weekIndex: idx };
  }

  /* 보호자 부재 구간(분). 공휴일·주말은 workDays에 그 요일이 있고 worksHolidays일 때만 근무. */
  function guardianAway(g, day) {
    if (!g) return [];
    const wd = typeof day === 'object' ? day.weekday : weekday(day);
    const iso = typeof day === 'object' ? day.date : day;
    const isH = typeof day === 'object' ? day.isHoliday : false;
    const workDays = Array.isArray(g.workDays) ? g.workDays.map(Number) : [1, 2, 3, 4, 5];
    if (isH && !g.worksHolidays) return [];
    if (!workDays.includes(wd)) return [];
    const t = patternTimes(g, iso);
    const a = toMin(t.start), b = toMin(t.end);
    if (a == null || b == null) return [];
    const c = clampInt(g.commuteMin, 0, 180);
    if (b > a) return [[a - c, b + c]];
    /* overnight */
    return [[a - c, 1440 + (b + c)]];
  }

  function midSchoolOn(child, iso) {
    const list = (child && child.midSchoolDays) || [];
    const hit = list.find(x => (typeof x === 'string' ? x : x.date) === iso);
    if (!hit) return null;
    if (typeof hit === 'string') return { start: child.midStart || '08:30', end: child.midEnd || '13:00', example: true };
    return { start: hit.start || child.midStart || '08:30', end: hit.end || child.midEnd || '13:00', example: !hit.start };
  }

  function layerInterval(layer, iso, isHoliday) {
    if (!layer) return null;
    if (inClosed(layer.closed, iso)) return null;
    if (isHoliday && !layer.runsOnHoliday) return null;
    const days = Array.isArray(layer.days) ? layer.days.map(Number) : [1, 2, 3, 4, 5];
    if (!days.includes(weekday(iso))) return null;
    const a = toMin(layer.start), b = toMin(layer.end);
    if (a == null || b == null || b <= a) return null;
    return [a, b];
  }

  const MEANS = {
    annual: { leave: 'annual', unit: 1, label: '연차' },
    half: { leave: 'annual', unit: 0.5, label: '반차' },
    quarter: { leave: 'annual', unit: 0.25, label: '반반차' },
    familyCare: { leave: 'family', unit: 1, label: '가족돌봄휴가' },
    familyHalf: { leave: 'family', unit: 0.5, label: '가족돌봄휴가(반일)' },
    grandparent: { leave: null, unit: 0, label: '조부모·친척' },
    sitter: { leave: null, unit: 0, label: '아이돌보미' },
    center: { leave: null, unit: 0, label: '틈새돌봄·센터' },
    academy: { leave: null, unit: 0, label: '학원' },
    wfh: { leave: null, unit: 0, label: '재택' }
  };

  function assignmentInterval(a, slotStart, slotEnd) {
    if (!a) return null;
    if (a.allDay) return [slotStart, slotEnd];
    const x = toMin(a.from), y = toMin(a.to);
    if (x == null || y == null || y <= x) return null;
    return [x, y];
  }

  function leaveUnits(a) {
    const m = MEANS[a.means];
    if (!m || !m.leave) return 0;
    if (a.units != null && isFinite(Number(a.units))) return Number(a.units);
    return m.unit;
  }

  function defaultState() {
    return {
      version: 1,
      demo: false,
      children: [],
      guardians: [],
      layers: [],
      assignments: [],
      settings: {
        slotStart: '07:00', slotEnd: '21:00', slotMin: 30,
        lunch: ['12:00', '13:00'],
        aloneAllowedMin: 0,
        leaveImbalance: 70,
        includeUnconfirmed: false,
        idolbom: { incomeType: '라', kind: 'basic', multiChild: false, usedHoursThisYear: 0, household: 'general' }
      },
      todos: []
    };
  }

  function demoState() {
    return {
      version: 1,
      demo: true,
      children: [{
        id: 'c1', nick: '첫째', grade: 1, birthGroup: 'A',
        breakStart: '2026-12-31', schoolReturn: '2027-03-02',
        midSchoolDays: ['2027-02-05'], midStart: '08:30', midEnd: '13:00'
      }],
      guardians: [
        { id: 'g1', name: '엄마', workDays: [1, 2, 3, 4, 5], start: '08:00', end: '17:00', commuteMin: 40, pattern: null, annualLeft: 7, familyCareLeft: 10 },
        { id: 'g2', name: '아빠', workDays: [1, 2, 3, 4, 5], start: '08:00', end: '18:00', commuteMin: 0, pattern: null, annualLeft: 9, familyCareLeft: 10 }
      ],
      layers: [
        { id: 'l1', childId: 'c1', type: 'schoolCare', label: '학교 방학 돌봄', days: [1, 2, 3, 4, 5], start: '08:30', end: '16:30', lunch: 'packed', confirmed: true, closed: [{ from: '2027-02-24', to: '2027-02-26', reason: '소독·새 학기 준비' }] },
        { id: 'l2', childId: 'c1', type: 'academy', label: '태권도', days: [1, 3, 5], start: '16:40', end: '17:40', lunch: 'none', cost: { amount: 80000, per: 'month' }, confirmed: true, travelMin: 10, vehicle: false }
      ],
      assignments: [],
      settings: {
        slotStart: '07:00', slotEnd: '21:00', slotMin: 30,
        lunch: ['12:00', '13:00'],
        aloneAllowedMin: 0,
        leaveImbalance: 70,
        includeUnconfirmed: false,
        idolbom: { incomeType: '라', kind: 'basic', multiChild: false, usedHoursThisYear: 0, household: 'general' }
      },
      todos: [
        { id: 't1', title: '학교 방학 돌봄 수요조사 회신', date: '2026-11-20', done: false, kind: 'survey' }
      ]
    };
  }

  /* 페르소나에 맞게 아빠 출근 08:00(통근 0)로 두면 "8시~8시 반" 아침 빈칸이 그대로 드러납니다.
     스펙 예시 JSON은 08:30+통근 30분이라 부재 시작이 08:00으로 같고, 퇴근은 18:30이 됩니다.
     데모 첫 화면의 가치를 위해 퇴근은 18:00(통근 0)으로 단순화하지 않고, 스펙 예시의 08:30+30분(→08:00 출발) / 18:00+30분(→18:30 귀가)를 쓰되
     출근은 "08:00 출발"이 페르소나와 같도록 start 08:00 commute 0 또는 start 08:30 commute 30.
     저녁 빈칸을 분명히 보여 주려면 엄마 17:00+40=17:40 귀가, 학원 없는 날 16:30~17:40이 빈칸.
     아빠를 스펙대로 08:30+30 / 18:00+30 으로 두면 아침은 동일하게 08:00~08:30. 저녁은 엄마가 17:40에 귀가하므로 학원 없는 날 16:30-17:40.
     페르소나 "4시 반~7시"는 통근을 더 길게 가정한 고민이지 스펙 수치가 아님. 계산은 입력값을 따릅니다.
     데모는 스펙 예시 JSON을 그대로 쓰는 편이 정직합니다. */

  function demoStateFromSpec() {
    const d = demoState();
    d.guardians[1] = { id: 'g2', name: '아빠', workDays: [1, 2, 3, 4, 5], start: '08:30', end: '18:00', commuteMin: 30, pattern: null, annualLeft: 9, familyCareLeft: 10 };
    d.layers[1].cost = { amount: 0, per: 'month' };
    return d;
  }

  /* Use spec example as the official demo (values labeled 예시). */
  function officialDemo() { return demoStateFromSpec(); }

  function childRange(state) {
    const ch = (state.children || [])[0];
    if (!ch || !isDate(ch.breakStart) || !isDate(ch.schoolReturn)) return null;
    return { start: ch.breakStart, end: ch.schoolReturn, child: ch };
  }

  function settingsOf(state) {
    const s = Object.assign({
      slotStart: '07:00', slotEnd: '21:00', slotMin: 30,
      lunch: ['12:00', '13:00'], aloneAllowedMin: 0, includeUnconfirmed: false
    }, state && state.settings || {});
    const a = toMin(s.slotStart), b = toMin(s.slotEnd);
    s._slot0 = a == null ? 7 * 60 : a;
    s._slot1 = b == null || b <= s._slot0 ? 21 * 60 : b;
    s._step = s.slotMin === 15 ? 15 : 30;
    const l0 = toMin((s.lunch || [])[0]), l1 = toMin((s.lunch || [])[1]);
    s._lunch0 = l0 == null ? 12 * 60 : l0;
    s._lunch1 = l1 == null || l1 <= s._lunch0 ? s._lunch0 + 60 : l1;
    s._alone = clampInt(s.aloneAllowedMin, 0, 240);
    return s;
  }

  function presentIntervals(state, day) {
    /* 보호자 재가 = 슬롯 전체 − 부재, 연차·재택 배정은 부재에서 빼 줌 */
    const st = settingsOf(state);
    const window = [[st._slot0, st._slot1]];
    const away = [];
    (state.guardians || []).forEach(g => {
      const aw = guardianAway(g, day);
      /* 이 보호자의 연차·재택이 덮는 시간은 부재가 아님 */
      const cover = [];
      (state.assignments || []).forEach(a => {
        if (a.date !== day.date) return;
        if (a.means === 'wfh' && a.who && a.who !== g.id) return;
        if ((a.means === 'annual' || a.means === 'half' || a.means === 'quarter' || a.means === 'familyCare' || a.means === 'familyHalf') && a.who && a.who !== g.id) return;
        if (!(a.means === 'wfh' || a.means === 'annual' || a.means === 'half' || a.means === 'quarter' || a.means === 'familyCare' || a.means === 'familyHalf')) return;
        const iv = assignmentInterval(a, st._slot0, st._slot1);
        if (iv) cover.push(iv);
      });
      subtract(aw, cover).forEach(x => away.push(x));
    });
    /* 한 명이라도 집에 있으면 커버: 재가 = window − (모든 보호자의 부재 교집합)
       보호자가 0명이면 재가 없음.
       보호자별 부재를 A1, A2라 하면 둘 다 부재인 시간 = intersection(A1,A2).
       재가 = window − ∩ away_i
    */
    const lists = (state.guardians || []).map(g => {
      const aw = guardianAway(g, day);
      const cover = [];
      (state.assignments || []).forEach(a => {
        if (a.date !== day.date) return;
        const isLeave = a.means === 'annual' || a.means === 'half' || a.means === 'quarter' || a.means === 'familyCare' || a.means === 'familyHalf' || a.means === 'wfh';
        if (!isLeave) return;
        if (a.who && a.who !== g.id) return;
        const iv = assignmentInterval(a, st._slot0, st._slot1);
        if (iv) cover.push(iv);
      });
      return subtract(aw, cover);
    });
    if (!lists.length) return [];
    /* intersection of away lists */
    let inter = lists[0];
    for (let i = 1; i < lists.length; i++) {
      const nxt = [];
      for (const [a, b] of inter) {
        for (const [c, d] of lists[i]) {
          const lo = Math.max(a, c), hi = Math.min(b, d);
          if (hi > lo) nxt.push([lo, hi]);
        }
      }
      inter = merge(nxt);
    }
    return subtract(window, inter);
  }

  function layerCoverage(state, day, childId, includeUnconfirmed) {
    const st = settingsOf(state);
    const iso = day.date;
    const out = []; /* {iv, layer, travel?} */
    const mid = midSchoolOn((state.children || []).find(c => c.id === childId) || (state.children || [])[0], iso);
    if (mid) {
      const a = toMin(mid.start), b = toMin(mid.end);
      if (a != null && b != null && b > a) out.push({ iv: [a, b], kind: 'midSchool', label: '중간 등교', lunch: 'unknown', confirmed: true });
    }
    (state.layers || []).forEach(l => {
      if (childId && l.childId && l.childId !== childId) return;
      if (!includeUnconfirmed && l.confirmed === false) return;
      const iv = layerInterval(l, iso, day.isHoliday);
      if (!iv) return;
      out.push({ iv, kind: l.type, label: l.label, lunch: l.lunch || 'none', confirmed: l.confirmed !== false, layer: l, travelMin: l.travelMin || 0, vehicle: !!l.vehicle });
    });
    (state.assignments || []).forEach(a => {
      if (a.date !== iso) return;
      if (childId && a.childId && a.childId !== childId) return;
      const leaveLike = a.means === 'annual' || a.means === 'half' || a.means === 'quarter' || a.means === 'familyCare' || a.means === 'familyHalf' || a.means === 'wfh';
      /* leave/wfh already in presentIntervals; still a cover layer for timeline color */
      const iv = assignmentInterval(a, st._slot0, st._slot1);
      if (!iv) return;
      out.push({ iv, kind: a.means, label: (MEANS[a.means] && MEANS[a.means].label) || a.who || '배정', lunch: a.lunch || 'none', confirmed: true, assignment: a });
    });
    /* travel: after a layer, travelMin is covered only if vehicle */
    const travels = [];
    out.forEach(x => {
      if (x.layer && x.travelMin > 0 && x.vehicle) {
        travels.push({ iv: [x.iv[1], x.iv[1] + x.travelMin], kind: 'travel', label: '이동(차량)', lunch: 'none', confirmed: x.confirmed, travel: true });
      }
    });
    return out.concat(travels);
  }

  function filterShortGaps(gaps, allowed) {
    if (!allowed) return gaps.slice();
    return gaps.filter(([a, b]) => (b - a) > allowed);
  }

  function classifyGap(iv, lunch0, lunch1, slot0, slot1) {
    const [a, b] = iv;
    const mid = (a + b) / 2;
    const coversLunch = Math.max(a, lunch0) < Math.min(b, lunch1);
    const allDay = (b - a) >= Math.min(6 * 60, (slot1 - slot0) * 0.6);
    if (allDay) return '종일';
    if (coversLunch && a < lunch1 && b > lunch0 && (b - a) <= 150) return '점심';
    if (mid < lunch0) return '아침';
    return '저녁';
  }

  function analyze(state, holidays, opts) {
    opts = opts || {};
    const st = settingsOf(state);
    if (opts.includeUnconfirmed != null) st.includeUnconfirmed = !!opts.includeUnconfirmed;
    else st.includeUnconfirmed = !!st.includeUnconfirmed;
    const range = childRange(state);
    if (!range) return { ok: false, reason: 'input', message: '입력 필요 — 방학 시작일과 개학일을 넣어 주세요.' };
    const child = range.child;
    const days = buildDays(range.start, range.end, holidays);
    const step = st._step;
    const slotsMeta = [];
    for (let t = st._slot0; t < st._slot1; t += step) slotsMeta.push({ from: t, to: Math.min(t + step, st._slot1), fromLabel: fromMin(t), toLabel: fromMin(Math.min(t + step, st._slot1)) });

    const dayResults = [];
    let gapMinTotal = 0, gapSlotsTotal = 0, packedDays = 0, lunchUnknownDays = 0;
    const typeMin = { 아침: 0, 점심: 0, 저녁: 0, 종일: 0 };
    const patternMap = Object.create(null);

    days.forEach(day => {
      const present = presentIntervals(state, day);
      const covers = layerCoverage(state, day, child.id, st.includeUnconfirmed);
      const coverIvs = merge(covers.map(c => c.iv).concat(present));
      /* 이동(차량 없음)은 커버가 아님 — 이미 빼 둠. 빈칸 = window − cover */
      const rawGaps = subtract([[st._slot0, st._slot1]], coverIvs);
      const gaps = filterShortGaps(rawGaps, st._alone);
      const gapMin = gaps.reduce((s, p) => s + (p[1] - p[0]), 0);
      gapMinTotal += gapMin;

      const slotFlags = slotsMeta.map(s => {
        const uncovered = s.to - s.from - intersectLen(merge(gaps.map(g => [g[0], g[1]]).length ? gaps : []), s.from, s.to);
        /* red if intersects a (kept) gap */
        const un = intersectLen(gaps, s.from, s.to);
        const isLunch = s.from < st._lunch1 && s.to > st._lunch0;
        return { from: s.from, to: s.to, fromLabel: s.fromLabel, toLabel: s.toLabel, gapMin: un, gap: un > 0, lunch: isLunch };
      });
      gapSlotsTotal += slotFlags.filter(s => s.gap).length;

      /* lunch judgment: covering layers during lunch */
      const lunchCovers = covers.filter(c => c.iv[0] < st._lunch1 && c.iv[1] > st._lunch0);
      const lunchPresent = unionLen(present, st._lunch0, st._lunch1) >= (st._lunch1 - st._lunch0);
      const lunchGap = intersectLen(gaps, st._lunch0, st._lunch1) > 0;
      const lunchPacked = lunchCovers.some(c => c.lunch === 'packed');
      const lunchUnknown = lunchCovers.some(c => c.lunch === 'unknown') && !lunchCovers.some(c => c.lunch === 'provided' || c.lunch === 'packed');
      if (lunchPacked) packedDays += 1;
      if (lunchUnknown) lunchUnknownDays += 1;

      const closed = (state.layers || []).filter(l => l.type === 'schoolCare' && inClosed(l.closed, day.date));
      const types = gaps.map(g => classifyGap(g, st._lunch0, st._lunch1, st._slot0, st._slot1));
      types.forEach((t, i) => { typeMin[t] += gaps[i][1] - gaps[i][0]; });

      gaps.forEach(g => {
        const key = fromMin(g[0]) + '–' + fromMin(g[1]);
        if (!patternMap[key]) patternMap[key] = { from: fromMin(g[0]), to: fromMin(g[1]), minutes: 0, days: [], kind: classifyGap(g, st._lunch0, st._lunch1, st._slot0, st._slot1) };
        patternMap[key].minutes += g[1] - g[0];
        patternMap[key].days.push(day.date);
      });

      dayResults.push({
        date: day.date, weekday: day.weekday, wlabel: day.wlabel, kind: day.kind,
        holidayName: day.holidayName, isWeekend: day.isWeekend, isHoliday: day.isHoliday,
        midSchool: !!midSchoolOn(child, day.date),
        closed: closed.map(l => ({ label: l.label, reason: closedReason(l.closed, day.date) })),
        present, covers, gaps, gapMin,
        gapHours: Math.round(gapMin / 60 * 100) / 100,
        slots: slotFlags,
        lunchPacked, lunchUnknown, lunchGap, lunchPresent,
        types
      });
    });

    const weekdays = days.filter(d => d.kind === 'weekday').length;
    const weekends = days.filter(d => d.kind === 'weekend').length;
    const hols = days.filter(d => d.kind === 'holiday').length;
    const top = Object.keys(patternMap).map(k => patternMap[k])
      .sort((a, b) => b.minutes - a.minutes || b.days.length - a.days.length)
      .slice(0, 3)
      .map(p => ({
        from: p.from, to: p.to, kind: p.kind, minutes: p.minutes,
        hours: Math.round(p.minutes / 60 * 10) / 10,
        count: p.days.length, days: p.days, label: p.kind + ' ' + p.from + '–' + p.to + ' · ' + p.days.length + '일'
      }));

    return {
      ok: true,
      childId: child.id,
      start: range.start,
      end: range.end,
      totalDays: days.length,
      weekdays, weekends, holidays: hols,
      gapMin: gapMinTotal,
      gapHours: Math.round(gapMinTotal / 60 * 10) / 10,
      gapSlots: gapSlotsTotal,
      packedDays,
      lunchUnknownDays,
      typeHours: {
        아침: Math.round(typeMin.아침 / 60 * 10) / 10,
        점심: Math.round(typeMin.점심 / 60 * 10) / 10,
        저녁: Math.round(typeMin.저녁 / 60 * 10) / 10,
        종일: Math.round(typeMin.종일 / 60 * 10) / 10
      },
      top,
      days: dayResults,
      slotStart: st._slot0,
      slotEnd: st._slot1,
      step,
      lunch: [st._lunch0, st._lunch1],
      includeUnconfirmed: st.includeUnconfirmed,
      aloneAllowedMin: st._alone
    };
  }

  function leaveUsage(state) {
    const used = Object.create(null);
    (state.guardians || []).forEach(g => { used[g.id] = { annual: 0, family: 0, name: g.name, annualLeft: Number(g.annualLeft) || 0, familyCareLeft: Number(g.familyCareLeft) || 0 }; });
    const datesAnnual = Object.create(null), datesFamily = Object.create(null);
    (state.assignments || []).forEach(a => {
      const m = MEANS[a.means];
      if (!m || !m.leave) return;
      const id = a.who;
      if (!used[id]) return;
      const u = leaveUnits(a);
      used[id][m.leave === 'family' ? 'family' : 'annual'] += u;
      const bag = m.leave === 'family' ? datesFamily : datesAnnual;
      if (!bag[id]) bag[id] = [];
      bag[id].push({ date: a.date, units: u, means: a.means, from: a.from, to: a.to, allDay: !!a.allDay });
    });
    const rows = (state.guardians || []).map(g => {
      const u = used[g.id];
      const annualOver = u.annual > u.annualLeft + 1e-9;
      const familyOver = u.family > u.familyCareLeft + 1e-9;
      return {
        id: g.id, name: g.name,
        annualUsed: Math.round(u.annual * 100) / 100,
        annualLeft: u.annualLeft,
        annualRemain: Math.round((u.annualLeft - u.annual) * 100) / 100,
        annualOver,
        familyUsed: Math.round(u.family * 100) / 100,
        familyLeft: u.familyCareLeft,
        familyRemain: Math.round((u.familyCareLeft - u.family) * 100) / 100,
        familyOver,
        annualDates: datesAnnual[g.id] || [],
        familyDates: datesFamily[g.id] || []
      };
    });
    const totalAnnual = rows.reduce((s, r) => s + r.annualUsed, 0);
    const imbalancePct = Number((state.settings && state.settings.leaveImbalance) || 70);
    let imbalance = null;
    if (rows.length >= 2 && totalAnnual > 0) {
      const max = rows.reduce((a, b) => a.annualUsed >= b.annualUsed ? a : b);
      const share = max.annualUsed / totalAnnual * 100;
      if (share >= imbalancePct) imbalance = { who: max.id, name: max.name, share: Math.round(share), threshold: imbalancePct };
    }
    return { rows, imbalance, totalAnnual: Math.round(totalAnnual * 100) / 100 };
  }

  function copayPerHour(rates, settings) {
    const idb = (settings && settings.idolbom) || {};
    const household = idb.household === 'vulnerable' ? 'vulnerable' : 'general';
    const kind = idb.kind === 'comprehensive' ? 'comprehensive' : 'basic';
    const type = ['가', '나', '다', '라', '마'].includes(idb.incomeType) ? idb.incomeType : '라';
    const group = idb.birthGroup || (settings && settings._birthGroup) || 'A';
    const g = group === 'B' ? 'B' : 'A';
    const table = rates[household][kind];
    const copay = table[type][g];
    const rate = kind === 'comprehensive' ? rates.comprehensiveRate : rates.basicRate;
    return { copay, rate, household, kind, type, group: g, multi: !!idb.multiChild && type !== '마' };
  }

  function isHolidayOrSunday(iso, holidays) {
    if (weekday(iso) === 0) return true;
    const H = holidayMap(holidays);
    return !!H[iso];
  }
  function nightOverlap(from, to, nightFrom, nightTo) {
    /* night 22:00-06:00 may wrap */
    const nf = toMin(nightFrom), nt = toMin(nightTo);
    if (nf == null || nt == null) return 0;
    const windows = nf < nt ? [[nf, nt]] : [[nf, 1440], [0, nt]];
    let n = 0;
    windows.forEach(([a, b]) => { n += Math.max(0, Math.min(to, b) - Math.max(from, a)); });
    return n;
  }

  function sitterCost(state, rates, holidays) {
    const st = settingsOf(state);
    const child = (state.children || [])[0] || {};
    if (child.birthGroup) st._birthGroup = child.birthGroup;
    const info = copayPerHour(rates, st);
    const used0 = Number((st.idolbom && st.idolbom.usedHoursThisYear) || 0) || 0;
    const annual = rates.annualHours;
    const rows = [];
    let billedHours = 0, copayTotal = 0, supportHours = 0, overflowHours = 0, minWarns = 0, nightHours = 0, holHours = 0;
    const assigns = (state.assignments || []).filter(a => a.means === 'sitter');
    assigns.forEach(a => {
      const iv = assignmentInterval(a, st._slot0, st._slot1);
      const rawMin = iv ? (iv[1] - iv[0]) : 0;
      const step = rates.stepMin || 30;
      let billedMin = Math.ceil(rawMin / step) * step;
      let raised = false;
      if (billedMin < (rates.minHoursPerVisit * 60)) { billedMin = rates.minHoursPerVisit * 60; raised = true; minWarns += 1; }
      const hours = billedMin / 60;
      const hol = isHolidayOrSunday(a.date, holidays);
      const nightMin = iv ? nightOverlap(iv[0], iv[1], rates.night.from, rates.night.to) : 0;
      /* 할증은 해당 분에만, 야간+휴일은 중복 없음: 휴일이면 전체 할증, 아니면 야간 분만 할증 */
      let surchargeMin, normalMin;
      if (hol) { surchargeMin = billedMin; normalMin = 0; holHours += hours; }
      else { surchargeMin = nightMin; normalMin = billedMin - nightMin; nightHours += nightMin / 60; }
      /* 지원시간 차감은 실제(또는 최소) 청구 시간 */
      const remaining = Math.max(0, annual - used0 - supportHours);
      const supported = Math.min(hours, remaining);
      const overflow = hours - supported;
      supportHours += supported;
      overflowHours += overflow;
      /* 본인부담: 지원 구간은 고시 본인부담 ×(1+0.5 할증분 비율), 초과는 이용요금 전액(할증 포함) */
      const surRatio = billedMin ? (surchargeMin / billedMin) : 0;
      const avgCopay = info.copay * (1 + (rates.surcharge || 0.5) * surRatio);
      const avgRate = info.rate * (1 + (rates.surcharge || 0.5) * surRatio);
      let pay = avgCopay * supported + avgRate * overflow;
      if (info.multi) pay = pay * (1 - (rates.multiChildExtra || 0.1));
      pay = Math.round(pay);
      copayTotal += pay;
      billedHours += hours;
      rows.push({ date: a.date, from: a.from, to: a.to, rawMin, billedMin, hours, raised, holiday: hol, nightMin, pay, supported, overflow });
    });
    return {
      info, used0, annual, billedHours: Math.round(billedHours * 100) / 100,
      supportHours: Math.round(supportHours * 100) / 100,
      overflowHours: Math.round(overflowHours * 100) / 100,
      remainAnnual: Math.max(0, Math.round((annual - used0 - supportHours) * 100) / 100),
      copayTotal, minWarns,
      nightHours: Math.round(nightHours * 100) / 100,
      holHours: Math.round(holHours * 100) / 100,
      rows,
      badge: rates.badge || '2027 고시 전 참고값',
      note: rates.note,
      surchargeNote: rates.surchargeCopayNote
    };
  }

  function otherCosts(state, start, end) {
    /* 학원·센터: 월/주/일 비용을 방학 기간에 맞춰 합산 */
    let academy = 0, center = 0, extra = 0;
    const days = (isDate(start) && isDate(end)) ? diff(end, start) : 0;
    const weeks = days / 7;
    const months = days / 30;
    (state.layers || []).forEach(l => {
      const c = l.cost || {};
      const amt = Number(c.amount) || 0;
      if (!amt) return;
      let add = 0;
      if (c.per === 'day') {
        const dow = Array.isArray(l.days) ? l.days : [1, 2, 3, 4, 5];
        /* count matching days in range roughly: weeks * dow.length, minus closed? use exact if start/end */
        if (isDate(start) && isDate(end)) {
          for (let n = toN(start); n < toN(end); n++) {
            const iso = toISO(n);
            if (inClosed(l.closed, iso)) continue;
            if (dow.includes(weekday(iso))) add += amt;
          }
        }
      } else if (c.per === 'week') add = amt * weeks;
      else add = amt * Math.max(1, Math.round(months * 10) / 10); /* month: at least 1 month if period spans */
      if (l.type === 'academy') academy += add;
      else if (l.type === 'center') center += add;
      else extra += add;
    });
    (state.settings && state.settings.extraCost ? [state.settings.extraCost] : []).forEach(n => { extra += Number(n) || 0; });
    return { academy: Math.round(academy), center: Math.round(center), extra: Math.round(extra) };
  }

  function autoTodos(state, analysis, holidays) {
    const list = (state.todos || []).map(t => Object.assign({}, t));
    const have = k => list.some(t => t.kind === k);
    /* 사용자 입력 기반만 자동 추가: 이미 todos에 날짜가 있으면 유지. 도시락 전날·미운영 D-7은 옵션으로 생성하되 날짜는 계산됨 */
    return list;
  }

  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {
    const out = []; let cur = '', bytes = 0;
    const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    for (const ch of line) {
      const b = enc ? enc.encode(ch).length : unescape(encodeURIComponent(ch)).length;
      if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.map((l, i) => (i ? ' ' : '') + l).join('\r\n');
  }
  function toICS(events, o) {
    o = o || {};
    const stamp = (o.now ? new Date(o.now) : new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//webapp-daily//winter-break-care-gap-planner//KO',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEsc(o.calName || '겨울방학 돌봄 할 일'),
      'X-WR-TIMEZONE:Asia/Seoul',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'DTSTART:19700101T000000',
      'END:STANDARD', 'END:VTIMEZONE'
    ];
    (events || []).forEach((e, i) => {
      if (!isDate(e.date)) return;
      L.push('BEGIN:VEVENT');
      L.push('UID:caregap-' + e.date.replace(/-/g, '') + '-' + i + '-' + (o.uidSeed || 'x') + '@webapp-daily');
      L.push('DTSTAMP:' + stamp);
      if (e.time && toMin(e.time) != null) {
        const hm = e.time.replace(':', '') + '00';
        const endHm = e.endTime && toMin(e.endTime) != null ? e.endTime.replace(':', '') + '00' : null;
        L.push('DTSTART;TZID=Asia/Seoul:' + e.date.replace(/-/g, '') + 'T' + hm);
        if (endHm) L.push('DTEND;TZID=Asia/Seoul:' + e.date.replace(/-/g, '') + 'T' + endHm);
        else {
          /* default 1 hour */
          const end = fromMin(toMin(e.time) + 60).replace(':', '') + '00';
          L.push('DTEND;TZID=Asia/Seoul:' + e.date.replace(/-/g, '') + 'T' + end);
        }
      } else {
        const s = e.date.replace(/-/g, '');
        const en = addDays(e.end && e.end > e.date ? e.end : e.date, 1).replace(/-/g, '');
        L.push('DTSTART;VALUE=DATE:' + s);
        L.push('DTEND;VALUE=DATE:' + en);
      }
      L.push('SUMMARY:' + icsEsc((o.prefix ? o.prefix + ' · ' : '') + e.title));
      L.push('DESCRIPTION:' + icsEsc([e.note, e.src ? '출처: ' + e.src : '', '참고용 일정입니다. 학교·센터·공식 안내를 확인해 주세요.'].filter(Boolean).join('\n')));
      L.push('TRANSP:TRANSPARENT');
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(e.title), 'TRIGGER:' + (e.alarm || '-P1D'), 'END:VALARM');
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  function buildIcsEvents(state, analysis, opts) {
    opts = opts || {};
    const ev = [];
    (state.todos || []).forEach(t => {
      if (!t || !isDate(t.date) || (opts.selected && opts.selected.length && !opts.selected.includes(t.id))) return;
      ev.push({ date: t.date, title: t.title, note: t.note || '', src: t.src || '', kind: t.kind, id: t.id });
    });
    if (opts.lunchEve && analysis && analysis.ok) {
      analysis.days.filter(d => d.lunchPacked).forEach(d => {
        ev.push({ date: addDays(d.date, -1), time: '19:00', endTime: '19:30', title: '내일 도시락 준비', note: d.date + ' 도시락 지참 (학교 돌봄 점심=도시락)', alarm: '-PT0M' });
      });
    }
    if (opts.closedD7 && state.layers) {
      const seen = Object.create(null);
      (state.layers || []).forEach(l => (l.closed || []).forEach(c => {
        if (!isDate(c.from)) return;
        const key = c.from;
        if (seen[key]) return;
        seen[key] = 1;
        ev.push({ date: addDays(c.from, -7), title: '돌봄 미운영 D-7', note: c.from + (c.to && c.to !== c.from ? '–' + c.to : '') + ' ' + (c.reason || '미운영'), alarm: '-P0D' });
      }));
    }
    return ev;
  }

  /* 학교 프리셋: 개인정보 제외 */
  function b64e(s) {
    const u = (typeof TextEncoder === 'function' ? new TextEncoder() : { encode: str => Uint8Array.from(unescape(encodeURIComponent(str)), c => c.charCodeAt(0)) }).encode(s);
    let b = '';
    u.forEach(x => { b += String.fromCharCode(x); });
    return (typeof btoa === 'function' ? btoa(b) : Buffer.from(b, 'binary').toString('base64')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const b = typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('binary');
    return (typeof TextDecoder === 'function' ? new TextDecoder() : { decode: u => decodeURIComponent(escape(String.fromCharCode.apply(null, u))) }).decode(Uint8Array.from(b, c => c.charCodeAt(0)));
  }
  function encodePreset(state) {
    const ch = (state.children || [])[0] || {};
    const care = (state.layers || []).find(l => l.type === 'schoolCare') || {};
    const o = {
      v: 1,
      bs: isDate(ch.breakStart) ? ch.breakStart : null,
      sr: isDate(ch.schoolReturn) ? ch.schoolReturn : null,
      mid: (ch.midSchoolDays || []).map(x => typeof x === 'string' ? x : x.date).filter(isDate).slice(0, 20),
      ms: ch.midStart || '08:30', me: ch.midEnd || '13:00',
      cs: care.start || null, ce: care.end || null,
      lunch: care.lunch || null,
      days: Array.isArray(care.days) ? care.days : [1, 2, 3, 4, 5],
      closed: (care.closed || []).filter(c => isDate(c.from) && isDate(c.to)).map(c => ({ from: c.from, to: c.to, reason: String(c.reason || '').slice(0, 40) })).slice(0, 12)
    };
    if (!o.bs || !o.sr) throw new Error('bad');
    return b64e(JSON.stringify(o));
  }
  function decodePreset(s) {
    const o = JSON.parse(b64d(s));
    if (!o || o.v !== 1 || !isDate(o.bs) || !isDate(o.sr)) throw new Error('bad');
    return {
      breakStart: o.bs,
      schoolReturn: o.sr,
      midSchoolDays: (o.mid || []).filter(isDate),
      midStart: HM.test(o.ms) ? o.ms : '08:30',
      midEnd: HM.test(o.me) ? o.me : '13:00',
      schoolCare: {
        start: HM.test(o.cs) ? o.cs : '08:30',
        end: HM.test(o.ce) ? o.ce : '16:30',
        lunch: ['packed', 'provided', 'unknown', 'none'].includes(o.lunch) ? o.lunch : 'unknown',
        days: Array.isArray(o.days) ? o.days.map(Number).filter(n => n >= 0 && n <= 6) : [1, 2, 3, 4, 5],
        closed: (o.closed || []).filter(c => isDate(c.from) && isDate(c.to)).map(c => ({ from: c.from, to: c.to, reason: String(c.reason || '').slice(0, 40) }))
      }
    };
  }
  function applyPreset(state, p) {
    const s = state || defaultState();
    if (!s.children.length) s.children.push({ id: 'c1', nick: '', grade: 1, birthGroup: 'A' });
    const ch = s.children[0];
    ch.breakStart = p.breakStart; ch.schoolReturn = p.schoolReturn;
    ch.midSchoolDays = p.midSchoolDays; ch.midStart = p.midStart; ch.midEnd = p.midEnd;
    let care = (s.layers || []).find(l => l.type === 'schoolCare');
    if (!care) {
      care = { id: 'l1', childId: ch.id, type: 'schoolCare', label: '학교 방학 돌봄', confirmed: true };
      s.layers = (s.layers || []).concat([care]);
    }
    care.start = p.schoolCare.start; care.end = p.schoolCare.end; care.lunch = p.schoolCare.lunch;
    care.days = p.schoolCare.days; care.closed = p.schoolCare.closed;
    return s;
  }

  /* 시나리오 3개 (tests.html / 단위 테스트) */
  function scenarioDualIncome() {
    return officialDemo();
  }
  function scenarioShiftSingle() {
    return {
      version: 1, demo: true,
      children: [{ id: 'c1', nick: '둘째', grade: 2, birthGroup: 'A', breakStart: '2026-12-31', schoolReturn: '2027-03-02', midSchoolDays: [] }],
      guardians: [{
        id: 'g1', name: '보호자', workDays: [1, 2, 3, 4, 5], start: '07:00', end: '15:00', commuteMin: 30,
        pattern: { type: 'weekly-rotate', weeks: [{ start: '07:00', end: '15:00' }, { start: '15:00', end: '23:00' }], anchor: '2026-12-28' },
        annualLeft: 5, familyCareLeft: 10
      }],
      layers: [
        { id: 'l1', childId: 'c1', type: 'center', label: '틈새돌봄(11~20시)', days: [1, 2, 3, 4, 5], start: '11:00', end: '20:00', lunch: 'provided', confirmed: true, closed: [] }
      ],
      assignments: [],
      settings: officialDemo().settings,
      todos: []
    };
  }
  function scenarioGrade4NoCare() {
    return {
      version: 1, demo: true,
      children: [{ id: 'c1', nick: '초4', grade: 4, birthGroup: 'B', breakStart: '2026-12-31', schoolReturn: '2027-03-02', midSchoolDays: [] }],
      guardians: [
        { id: 'g1', name: '엄마', workDays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', commuteMin: 30, pattern: null, annualLeft: 8, familyCareLeft: 10 },
        { id: 'g2', name: '아빠', workDays: [1, 2, 3, 4, 5], start: '09:00', end: '18:00', commuteMin: 30, pattern: null, annualLeft: 8, familyCareLeft: 10 }
      ],
      layers: [],
      assignments: [],
      settings: officialDemo().settings,
      todos: []
    };
  }

  function runSelfTest(holidays, rates) {
    const fails = [];
    const eq = (a, b, n) => { if (a !== b) fails.push(n + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
    const close = (a, b, n) => { if (Math.abs(a - b) > 1e-6) fails.push(n + ': ' + a + ' ≠ ' + b); };
    eq(addDays('2026-12-31', 1), '2027-01-01', 'addDays year');
    eq(weekday('2026-12-31'), 4, 'Thu');
    eq(weekday('2027-02-07'), 0, '설날 일');
    eq(weekday('2027-02-09'), 2, '대체 화');
    eq(toMin('08:30'), 510, 'toMin');
    eq(fromMin(510), '08:30', 'fromMin');

    const H = holidays || { days: [
      { date: '2026-12-25', name: '기독탄신일' },
      { date: '2027-01-01', name: '1월 1일' },
      { date: '2027-02-06', name: '설날 전날' },
      { date: '2027-02-07', name: '설날' },
      { date: '2027-02-08', name: '설날 다음 날' },
      { date: '2027-02-09', name: '대체공휴일(설날)' },
      { date: '2027-03-01', name: '3·1절' }
    ] };

    const days = buildDays('2026-12-31', '2027-03-02', H);
    eq(days.length, 61, '기간 61일 (12/31~3/1)');
    eq(days.filter(d => d.isHoliday).length, 6, '공휴일 6일');
    eq(days.filter(d => d.kind === 'weekday').length, 39, '평일 39일 (61−16주말−6공휴일)');
    eq(days.filter(d => d.kind === 'weekend').length, 16, '주말(공휴일 아닌 토·일) 16일');

    /* 맞벌이 하루: 2027-01-04 월
       엄마 08:00-17:00 통근 40 → 부재 07:20-17:40
       아빠 08:30-18:00 통근 30 → 부재 08:00-18:30
       둘 다 부재: 08:00-17:40
       돌봄 08:30-16:30 → 빈칸 08:00-08:30 (30) + 16:30-17:40 (70) = 100분
    */
    const dual = scenarioDualIncome();
    const a1 = analyze(dual, H);
    eq(a1.ok, true, 'dual ok');
    const jan4 = a1.days.find(d => d.date === '2027-01-04');
    eq(!!jan4, true, 'jan4 exists');
    /* 월(학원 16:40-17:40, 이동 10분은 차량 없어 미커버): 08:00-08:30 + 16:30-16:40 = 40분 */
    close(jan4.gapMin, 40, '1/4 학원 있는 날 40분');
    eq(jan4.gaps.map(g => fromMin(g[0]) + '-' + fromMin(g[1])).join(','), '08:00-08:30,16:30-16:40', '1/4 구간');
    eq(jan4.lunchPacked, true, '1/4 도시락');

    const jan5 = a1.days.find(d => d.date === '2027-01-05'); /* Tue, no academy */
    close(jan5.gapMin, 100, '1/5 학원 없는 날 100분');

    const jan1 = a1.days.find(d => d.date === '2027-01-01');
    close(jan1.gapMin, 0, '신정 빈칸 0');
    const sat = a1.days.find(d => d.date === '2027-01-02');
    close(sat.gapMin, 0, '토요일 빈칸 0');

    const closed = a1.days.find(d => d.date === '2027-02-24');
    /* 수, 돌봄 미운영. 둘 다 부재 08:00-17:40 = 580분. 학원 없음(수요일은 3, 있음!). 2/24 is Wednesday = academy.
       08:00-08:30 + 08:30-16:30 (no care) + 16:30-16:40 travel + 16:40-17:40 academy covers, 엄마 17:40.
       둘 다 부재 08:00-17:40, academy 16:40-17:40. Gap 08:00-16:40 = 520분. */
    close(closed.gapMin, 520, '2/24 미운영+학원 520분');

    const thuClosed = a1.days.find(d => d.date === '2027-02-25'); /* Thu no academy, no care */
    close(thuClosed.gapMin, 580, '2/25 미운영 580분');

    /* 미확정 토글: 미확정 레이어를 넣으면 빈칸이 줄어야 함 */
    const dual2 = officialDemo();
    dual2.layers.push({ id: 'l3', childId: 'c1', type: 'grandparent', label: '할머니', days: [1, 2, 3, 4, 5], start: '16:30', end: '18:00', lunch: 'none', confirmed: false, closed: [] });
    const ex = analyze(dual2, H, { includeUnconfirmed: false });
    const inc = analyze(dual2, H, { includeUnconfirmed: true });
    if (!(inc.gapMin < ex.gapMin)) fails.push('미확정 포함 시 빈칸이 줄어야 함: ' + inc.gapMin + ' / ' + ex.gapMin);

    /* 교대 한부모: anchor 2026-12-28 월. 2027-01-04는 그로부터 7일 = week 1 → weeks[1] 15:00-23:00, 통근 30 → 부재 14:30-23:30
       센터 11:00-20:00. 슬롯 07-21.
       주간 근무가 아닌 날(week 1 야간) 오전은 집에 있음(15시 전).
       부재 14:30-21:00(슬롯끝+). 센터 11-20 커버. 빈칸 20:00-21:00? 14:30-11? no. 20:00-21:00 = 60분.
       2026-12-31 목. from 12/28 = 3 days, week 0. 07:00-15:00 +통근 30 → 06:30-15:30.
       센터 11-20. 빈칸 07:00-11:00 = 240분 (06:30 already before slot). 15:30 이후 귀가, 센터가 20시까지.
    */
    const sh = scenarioShiftSingle();
    const a2 = analyze(sh, H);
    const d1231 = a2.days.find(d => d.date === '2026-12-31');
    close(d1231.gapMin, 240, '교대 주간주 12/31 아침 240분');
    const d0104 = a2.days.find(d => d.date === '2027-01-04');
    close(d0104.gapMin, 60, '교대 야간주 1/4 저녁 60분');

    /* 초4 돌봄 없음: 둘 다 09:00-18:00 통근 30 → 부재 08:30-18:30, 교집합 08:30-18:30, 레이어 없음 → 600분/평일 */
    const g4 = scenarioGrade4NoCare();
    const a3 = analyze(g4, H);
    const g4d = a3.days.find(d => d.date === '2027-01-05');
    close(g4d.gapMin, 600, '초4 평일 600분');
    close(a3.days.find(d => d.date === '2027-01-01').gapMin, 0, '초4 공휴일 0');

    /* 아이돌봄 요금 손계산: 라형 A 기본형 10,870원 × 2시간 = 21,740원. 다자녀 10% → 19,566원 */
    if (rates) {
      const st = officialDemo();
      st.assignments = [{ id: 'a1', date: '2027-01-05', from: '16:30', to: '18:30', childId: 'c1', means: 'sitter' }];
      const c = sitterCost(st, rates, H);
      eq(c.info.copay, 10870, '라형 A 기본 본인부담');
      eq(c.rows[0].pay, 21740, '2시간 21,740원');
      eq(c.rows[0].raised, false, '최소 2시간 충족');
      st.assignments = [{ id: 'a1', date: '2027-01-05', from: '16:30', to: '17:30', childId: 'c1', means: 'sitter' }];
      const c2 = sitterCost(st, rates, H);
      eq(c2.rows[0].raised, true, '1시간 → 2시간 청구 경고');
      eq(c2.rows[0].pay, 21740, '최소 2시간 요금');
      st.settings.idolbom.multiChild = true;
      const c3 = sitterCost(st, rates, H);
      eq(c3.rows[0].pay, Math.round(21740 * 0.9), '다자녀 10%');
      /* 휴일 할증: 2027-01-01 2시간, 본인부담 10870*1.5*2 = 32610 */
      st.settings.idolbom.multiChild = false;
      st.assignments = [{ id: 'a1', date: '2027-01-01', from: '10:00', to: '12:00', childId: 'c1', means: 'sitter' }];
      const c4 = sitterCost(st, rates, H);
      eq(c4.rows[0].holiday, true, '신정 휴일');
      eq(c4.rows[0].pay, 32610, '휴일 50% 할증 본인부담');
      /* 토요일(공휴일 아님)은 할증 없음: 2027-01-02 */
      st.assignments = [{ id: 'a1', date: '2027-01-02', from: '10:00', to: '12:00', childId: 'c1', means: 'sitter' }];
      const c5 = sitterCost(st, rates, H);
      eq(c5.rows[0].holiday, false, '토요일 휴일할증 아님');
      eq(c5.rows[0].pay, 21740, '토요일 기본 요금');
    }

    /* 연차 초과 */
    const lv = officialDemo();
    lv.assignments = [
      { id: 'x1', date: '2027-02-24', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x2', date: '2027-02-25', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x3', date: '2027-02-26', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x4', date: '2027-01-04', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x5', date: '2027-01-05', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x6', date: '2027-01-06', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x7', date: '2027-01-07', allDay: true, childId: 'c1', means: 'annual', who: 'g1' },
      { id: 'x8', date: '2027-01-08', allDay: true, childId: 'c1', means: 'annual', who: 'g1' }
    ];
    const u = leaveUsage(lv);
    eq(u.rows[0].annualUsed, 8, '연차 8일');
    eq(u.rows[0].annualOver, true, '잔여 7일 초과');
    eq(u.imbalance.who, 'g1', '한쪽에 몰림');

    /* 프리셋에 별명·연락처 없음 */
    const token = encodePreset(officialDemo());
    const dec = decodePreset(token);
    eq(dec.breakStart, '2026-12-31', 'preset start');
    eq(JSON.stringify(dec).indexOf('첫째') === -1, true, 'preset no nick');
    const ics = toICS([{ date: '2026-11-20', title: '수요조사 회신', note: '학교', src: '사용자 입력' }], { now: '2026-11-14T10:00:00.000Z', uidSeed: 't' });
    if (ics.indexOf('BEGIN:VCALENDAR') !== 0) fails.push('ics begin');
    if (ics.indexOf('X-WR-TIMEZONE:Asia/Seoul') < 0) fails.push('ics tz');
    if (ics.indexOf('BEGIN:VTIMEZONE') < 0) fails.push('ics vtimezone');
    if (!/\r\n/.test(ics)) fails.push('ics crlf');

    /* 혼자 허용 30분: 1/4 학원 날 아침 30분은 제외, 이동 10분도 제외 → 0 */
    const al = officialDemo();
    al.settings.aloneAllowedMin = 30;
    const aAllow = analyze(al, H);
    const j4 = aAllow.days.find(d => d.date === '2027-01-04');
    close(j4.gapMin, 0, '30분 허용 시 1/4 빈칸 0');
    const j5 = aAllow.days.find(d => d.date === '2027-01-05');
    close(j5.gapMin, 70, '30분 허용 시 1/5 저녁 70분만');

    return { ok: !fails.length, fails, total: fails.length, passedHint: fails.length ? 0 : 1 };
  }

  return {
    STORAGE_KEY, SETTINGS_KEY, MEANS, WD,
    toN, toISO, isDate, addDays, diff, weekday, todayKST, fmt, toMin, fromMin,
    merge, subtract, holidayMap, buildDays, guardianAway, patternTimes,
    analyze, leaveUsage, sitterCost, otherCosts, copayPerHour,
    toICS, fold, icsEsc, buildIcsEvents,
    encodePreset, decodePreset, applyPreset, b64e, b64d,
    defaultState, officialDemo, demoState: officialDemo,
    scenarioDualIncome, scenarioShiftSingle, scenarioGrade4NoCare,
    runSelfTest, settingsOf, midSchoolOn, inClosed
  };
});
