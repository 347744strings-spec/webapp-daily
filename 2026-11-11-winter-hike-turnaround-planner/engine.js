/* 겨울산행 하산 마감표 — 계산 엔진 (브라우저·Node 공용, 외부 의존 없음) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WinterHike = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PACE = { fast: { label: '빠름', factor: 0.9 }, normal: { label: '보통', factor: 1.0 }, beginner: { label: '초보 많음', factor: 1.25 }, senior: { label: '어르신 포함', factor: 1.4 } };
  var SURFACE = [{ v: 1.0, label: '마른 노면' }, { v: 1.1, label: '부분 결빙' }, { v: 1.2, label: '적설·결빙 (+20%)' }, { v: 1.3, label: '깊은 눈·러셀' }];
  var DEFAULTS = { margin: 90, minMargin: 60, maxMargin: 120, restPerHour: 10, ascentKmh: 4, ascentPer100: 10, descentKmh: 5, descentPer100: 5, chillWarn: -10, gustWarn: 15, sunriseLead: 10, sunriseStay: 30, yellowBand: 30 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseHM(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }
  function fmtHM(min) {
    if (min === null || min === undefined || !isFinite(min)) return '--:--';
    var m = Math.round(min), d = Math.floor(m / 1440); m = ((m % 1440) + 1440) % 1440;
    var s = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
    return d < 0 ? '전날 ' + s : d > 0 ? '익일 ' + s : s;
  }
  function fmtDur(min) {
    if (min === null || !isFinite(min)) return '-';
    var m = Math.round(Math.abs(min)), h = Math.floor(m / 60), r = m % 60;
    return (min < 0 ? '-' : '') + (h ? h + '시간' + (r ? ' ' + r + '분' : '') : r + '분');
  }
  function monthOf(dateISO) { var m = /^\d{4}-(\d{2})-\d{2}$/.exec(dateISO || ''); return m ? +m[1] : null; }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function weekday(dateISO) { return '일월화수목금토'[new Date(dateISO + 'T00:00:00Z').getUTCDay()]; }

  /* ---------- 산행 시간 추정 ---------- */
  function estimate(o) {
    var pace = PACE[o.pace] ? PACE[o.pace].factor : 1;
    var surf = Math.min(1.3, Math.max(1.0, +o.winterFactor || 1));
    var rest = o.restPerHour === undefined ? DEFAULTS.restPerHour : +o.restPerHour;
    function leg(km, m, kmh, per100, manual) {
      if (manual !== null && manual !== undefined && manual !== '' && isFinite(+manual) && +manual > 0)
        return { base: null, adjusted: null, rest: null, total: Math.round(+manual), manual: true };
      km = Math.max(0, +km || 0); m = Math.max(0, +m || 0);
      var base = km / kmh * 60 + m / 100 * per100;
      var adj = base * pace * surf;
      var r = adj / 60 * rest;
      return { base: base, adjusted: adj, rest: r, total: Math.max(0, Math.ceil(adj + r - 1e-9)), manual: false };
    }
    var up = leg(o.ascentKm, o.ascentM, DEFAULTS.ascentKmh, DEFAULTS.ascentPer100, o.manualAscent);
    var dm = (o.descentM === undefined || o.descentM === null || o.descentM === '') ? o.ascentM : o.descentM;
    var down = leg(o.descentKm, dm, DEFAULTS.descentKmh, DEFAULTS.descentPer100, o.manualDescent);
    return { ascent: up.total, descent: down.total, up: up, down: down, pace: pace, surface: surf, restPerHour: rest };
  }

  /* ---------- 통제시간 ---------- */
  function seasonOf(item, dateISO) {
    var m = monthOf(dateISO);
    if (!item || !item.winterMonths || m === null) return null;
    return item.winterMonths.indexOf(m) >= 0 ? 'winter' : 'summer';
  }
  function control(item, dateISO, hutIndex) {
    if (!item || !item.winter) return null;
    var season = seasonOf(item, dateISO);
    var t = item[season];
    var ext = 0, hutLabel = '';
    if (hutIndex !== null && hutIndex !== undefined && hutIndex !== '' && item.hut && item.hut[+hutIndex]) { ext = item.hut[+hutIndex].minutes; hutLabel = item.hut[+hutIndex].label; }
    var leave = item.summitLeave ? parseHM(item.summitLeave[season]) : null;
    var gates = (item.gates || []).map(function (g) { return { name: g.name, close: parseHM(g[season]) }; });
    return { season: season, seasonLabel: season === 'winter' ? '동절기' : '하절기', open: parseHM(t.open), close: parseHM(t.close) + ext, baseClose: parseHM(t.close), ext: ext, hutLabel: hutLabel, summitLeave: leave, gates: gates };
  }

  /* ---------- NOAA 일출·일몰 근사 ---------- */
  function sun(dateISO, lat, lon, tzHours) {
    if (!validDate(dateISO) || !isFinite(lat) || !isFinite(lon)) return null;
    tzHours = tzHours === undefined ? 9 : tzHours;
    var p = dateISO.split('-').map(Number);
    var a = Math.floor((14 - p[1]) / 12), y = p[0] + 4800 - a, mo = p[1] + 12 * a - 3;
    var jdn = p[2] + Math.floor((153 * mo + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    var rad = Math.PI / 180;
    function at(jd) {
      var T = (jd - 2451545) / 36525;
      var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
      var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      var C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
      var trueLong = L0 + C;
      var omega = 125.04 - 1934.136 * T;
      var lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
      var eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
      var eps = eps0 + 0.00256 * Math.cos(omega * rad);
      var decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) / rad;
      var yv = Math.pow(Math.tan(eps * rad / 2), 2);
      var eqt = 4 / rad * (yv * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * yv * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * yv * yv * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
      return { decl: decl, eqt: eqt };
    }
    function event(rise) {
      var jd = jdn - 0.5 + 0.5 - lon / 360; // approx solar noon (UT)
      var t;
      for (var i = 0; i < 3; i++) {
        var s = at(jd);
        var cosH = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(s.decl * rad)) / (Math.cos(lat * rad) * Math.cos(s.decl * rad));
        if (cosH > 1 || cosH < -1) return null;
        var H = Math.acos(cosH) / rad * (rise ? 1 : -1);
        t = 720 - 4 * (lon + H) - s.eqt; // minutes UTC
        jd = jdn - 0.5 + t / 1440;
      }
      return t + tzHours * 60;
    }
    var r = event(true), s2 = event(false);
    if (r === null || s2 === null) return null;
    return { sunrise: Math.round(r), sunset: Math.round(s2), source: 'NOAA 근사' };
  }

  /* ---------- 기상청 겨울철 체감온도 ---------- */
  function windChillKMA(T, vms) {
    if (!isFinite(T) || !isFinite(vms)) return null;
    if (T > 10 || vms < 1.3) return null; // 기상청: 기온 10℃ 이하, 풍속 1.3m/s 이상에서만 산출
    var V = Math.pow(vms * 3.6, 0.16);
    return Math.round((13.12 + 0.6215 * T - 11.37 * V + 0.3965 * V * T) * 10) / 10;
  }

  /* ---------- Open-Meteo 응답 요약 ---------- */
  function weatherSummary(json, dateISO, fromMin, toMin, th) {
    th = th || {};
    var chillWarn = isFinite(th.chillWarn) ? th.chillWarn : DEFAULTS.chillWarn, gustWarn = isFinite(th.gustWarn) ? th.gustWarn : DEFAULTS.gustWarn;
    if (!json || !json.hourly || !Array.isArray(json.hourly.time)) throw new Error('예보 형식이 올바르지 않습니다');
    var h = json.hourly, rows = [];
    var lo = Math.floor(Math.max(0, fromMin) / 60), hi = Math.ceil(Math.min(1440, toMin) / 60);
    for (var i = 0; i < h.time.length; i++) {
      var t = h.time[i];
      if (t.slice(0, 10) !== dateISO) continue;
      var hr = +t.slice(11, 13);
      if (hr < lo || hr > hi) continue;
      var T = h.temperature_2m ? h.temperature_2m[i] : null, ws = h.wind_speed_10m ? h.wind_speed_10m[i] : null;
      rows.push({ time: t.slice(11, 16), temp: T, apparent: h.apparent_temperature ? h.apparent_temperature[i] : null, wind: ws, gust: h.wind_gusts_10m ? h.wind_gusts_10m[i] : null, snow: h.snowfall ? h.snowfall[i] : null, code: h.weather_code ? h.weather_code[i] : null, kma: windChillKMA(T, ws) });
    }
    if (!rows.length) throw new Error('해당 날짜 예보가 없습니다');
    function pick(k, f) { var v = rows.map(function (r) { return r[k]; }).filter(function (x) { return x !== null && isFinite(x); }); return v.length ? f.apply(null, v) : null; }
    var out = { rows: rows, minTemp: pick('temp', Math.min), minApparent: pick('apparent', Math.min), maxWind: pick('wind', Math.max), maxGust: pick('gust', Math.max), minKma: pick('kma', Math.min), snowTotal: Math.round(rows.reduce(function (a, r) { return a + (r.snow || 0); }, 0) * 10) / 10, elevation: json.elevation, warnings: [] };
    var sr = json.daily && json.daily.sunrise && json.daily.time ? json.daily.time.indexOf(dateISO) : -1;
    if (sr >= 0) { out.sunrise = parseHM(json.daily.sunrise[sr].slice(11, 16)); out.sunset = parseHM(json.daily.sunset[sr].slice(11, 16)); }
    if (out.minApparent !== null && out.minApparent <= chillWarn) out.warnings.push('체감온도 ' + out.minApparent + '℃ (기준 ' + chillWarn + '℃ 이하) — 저체온·동상 대비, 보온의·장갑 여벌');
    if (out.maxGust !== null && out.maxGust >= gustWarn) out.warnings.push('돌풍 최대 ' + out.maxGust + 'm/s (기준 ' + gustWarn + 'm/s 이상) — 능선·정상 체류 최소화, 코스 단축 검토');
    if (out.snowTotal > 0) out.warnings.push('산행 시간대 적설 예보 ' + out.snowTotal + 'cm — 겨울 노면 계수 재확인, 아이젠·스패츠');
    return out;
  }

  /* ---------- 반환 시각 계산 ---------- */
  function plan(p, item, sunInfo) {
    var est = estimate(p);
    var ctl = control(item, p.date, p.hut);
    var margin = Math.min(DEFAULTS.maxMargin, Math.max(DEFAULTS.minMargin, +p.margin || DEFAULTS.margin));
    var stay = Math.max(0, +p.summitStay || 0);
    var start = parseHM(p.startTime);
    var sunset = sunInfo ? sunInfo.sunset : null, sunrise = sunInfo ? sunInfo.sunrise : null;
    var r = { est: est, control: ctl, margin: margin, stay: stay, sunset: sunset, sunrise: sunrise, reasons: [], mode: p.mode === 'sunrise' ? 'sunrise' : 'normal', headlamp: false };
    if (r.mode === 'sunrise') {
      var lead = isFinite(+p.sunriseLead) && p.sunriseLead !== '' ? +p.sunriseLead : DEFAULTS.sunriseLead;
      r.summitTarget = sunrise - lead;
      r.start = r.summitTarget - est.ascent;
      r.plannedSummit = r.summitTarget;
      var sStay = isFinite(+p.sunriseStay) && p.sunriseStay !== '' ? +p.sunriseStay : DEFAULTS.sunriseStay;
      r.plannedFinish = sunrise + sStay + est.descent;
      r.headlamp = true;
      r.signal = 'green';
      if (ctl) {
        if (r.start < ctl.open) { r.signal = 'red'; r.reasons.push('역산 출발 ' + fmtHM(r.start) + '이 입산 시작 ' + fmtHM(ctl.open) + '보다 이릅니다 — 코스 단축·일출 조망지 변경 검토'); }
        else if (r.start - ctl.open < DEFAULTS.yellowBand) { r.signal = 'yellow'; r.reasons.push('입산 시작 ' + fmtHM(ctl.open) + '과 출발 사이 여유가 ' + fmtDur(r.start - ctl.open) + '뿐입니다'); }
        if (r.start > ctl.close) { r.signal = 'red'; r.reasons.push('출발이 입산 통제 ' + fmtHM(ctl.close) + ' 이후입니다'); }
      }
      if (r.signal === 'green') r.reasons.push('일출 ' + lead + '분 전 정상 도착 기준으로 ' + fmtHM(r.start) + ' 출발');
      r.reasons.push('일출 전 야간 산행 — 이마등·여분 배터리 필수');
      return r;
    }
    r.start = start;
    r.descentTarget = sunset - margin;
    r.targetSource = '일몰 ' + fmtHM(sunset) + ' − 여유 ' + margin + '분';
    var sd = r.descentTarget - est.descent - stay;
    r.summitDeadlineSource = '하산 목표 − 하산 ' + fmtDur(est.descent) + (stay ? ' − 정상 체류 ' + stay + '분' : '');
    if (ctl && ctl.summitLeave !== null && ctl.summitLeave - stay < sd) { sd = ctl.summitLeave - stay; r.summitDeadlineSource = '공원 지정 하산 시작 ' + fmtHM(ctl.summitLeave) + (stay ? ' − 정상 체류 ' + stay + '분' : ''); }
    r.summitDeadline = sd;
    var byTime = sd - est.ascent;
    r.entryDeadline = ctl ? Math.min(ctl.close, byTime) : byTime;
    r.entrySource = ctl && ctl.close <= byTime ? '입산 통제 ' + fmtHM(ctl.close) + (ctl.ext ? ' (대피소 예약 +' + ctl.ext / 60 + '시간)' : '') : '정상 마감 − 오름 ' + fmtDur(est.ascent);
    r.plannedSummit = start + est.ascent;
    r.plannedLeave = r.plannedSummit + stay;
    r.plannedFinish = r.plannedLeave + est.descent;
    r.slack = r.descentTarget - r.plannedFinish;
    r.checkpoints = (p.checkpoints || []).filter(function (c) { return c && c.name && parseHM(c.plannedTime) !== null; }).map(function (c) {
      var t = parseHM(c.plannedTime);
      var dl = sd - (r.plannedSummit - t);
      var gate = ctl ? ctl.gates.filter(function (g) { return g.name === c.name; })[0] : null;
      var src = '정상 마감 − ' + fmtDur(r.plannedSummit - t);
      if (gate && gate.close < dl) { dl = gate.close; src = '공원 통제소 마감'; }
      return { name: c.name, planned: t, deadline: dl, source: src };
    });
    var red = false, yellow = false;
    if (ctl) {
      if (start < ctl.open) { red = true; r.reasons.push('출발 ' + fmtHM(start) + '이 입산 시작 ' + fmtHM(ctl.open) + '보다 이릅니다'); }
      if (start > ctl.close) { red = true; r.reasons.push('출발 ' + fmtHM(start) + '이 입산 통제 ' + fmtHM(ctl.close) + ' 이후입니다'); }
      if (ctl.summitLeave !== null && r.plannedLeave > ctl.summitLeave) { red = true; r.reasons.push('정상 출발 예정 ' + fmtHM(r.plannedLeave) + '이 공원 지정 하산 시작 ' + fmtHM(ctl.summitLeave) + '보다 늦습니다'); }
    }
    if (r.plannedFinish > sunset) { red = true; r.reasons.push('하산 예정 ' + fmtHM(r.plannedFinish) + '이 일몰 ' + fmtHM(sunset) + ' 이후입니다'); }
    else if (r.slack < -DEFAULTS.yellowBand) { red = true; r.reasons.push('하산 예정이 하산 목표(일몰 ' + margin + '분 전)를 ' + fmtDur(-r.slack) + ' 넘깁니다'); }
    else if (r.slack < 0) { yellow = true; r.reasons.push('하산 예정이 하산 목표를 ' + fmtDur(-r.slack) + ' 넘깁니다 (30분 이내)'); }
    if (r.plannedFinish > sunset - 30) r.headlamp = true;
    r.signal = red ? 'red' : yellow ? 'yellow' : 'green';
    if (r.signal === 'green') r.reasons.unshift('하산 예정 ' + fmtHM(r.plannedFinish) + ' — 일몰까지 ' + fmtDur(sunset - r.plannedFinish) + ' 여유');
    return r;
  }

  /* ---------- 초성 검색 ---------- */
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function chosung(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i) - 0xAC00; out += c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : s[i]; }
    return out;
  }
  function norm(s) { return String(s || '').replace(/[\s·~()\-→,]/g, '').toLowerCase(); }
  function search(items, q) {
    q = norm(q);
    if (!q) return items.slice();
    var isCho = /^[ㄱ-ㅎ]+$/.test(q);
    var terms = String(arguments[1]).trim().split(/\s+/).map(norm).filter(Boolean);
    var hits = items.filter(function (it) {
      var hay = norm(it.park + it.name + it.summitName);
      if (isCho) return chosung(hay).indexOf(q) >= 0;
      return terms.every(function (t) { return /^[ㄱ-ㅎ]+$/.test(t) ? chosung(hay).indexOf(t) >= 0 : hay.indexOf(t) >= 0 || hay.indexOf(t.replace(/산$/, '')) >= 0; });
    });
    function score(it) { var pk = norm(it.park); return (isCho ? chosung(pk).indexOf(q) === 0 : pk.indexOf(terms[0].replace(/산$/, '')) === 0) ? 0 : 1; }
    return hits.map(function (it, i) { return [score(it), i, it]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).map(function (x) { return x[2]; });
  }

  /* ---------- 장비 ---------- */
  function gear(r, weather) {
    var g = [
      { k: 'crampon', t: '아이젠 (체인·발톱형)', req: true },
      { k: 'headlamp', t: '이마등 + 여분 배터리', req: true, strong: !!(r && r.headlamp) },
      { k: 'insulation', t: '여벌 보온의 (패딩·플리스)', req: true },
      { k: 'gloves', t: '장갑 2켤레 (속·겉)', req: true },
      { k: 'thermos', t: '보온병 따뜻한 물', req: true },
      { k: 'food', t: '비상식 (사탕·초콜릿·떡)', req: true },
      { k: 'battery', t: '보조배터리 (추위에 빨리 닳음)', req: true },
      { k: 'whistle', t: '호루라기', req: true },
      { k: 'shell', t: '방풍·방수 재킷', req: true },
      { k: 'hat', t: '방한 모자·넥워머', req: true }
    ];
    if (r && r.mode === 'sunrise') g.push({ k: 'pad', t: '정상 대기용 방석·핫팩', req: true });
    if (weather && weather.snowTotal > 0) g.push({ k: 'gaiter', t: '스패츠 (적설 예보)', req: true });
    if (weather && weather.maxGust !== null && weather.maxGust >= 10) g.push({ k: 'goggle', t: '고글·안면 마스크 (강풍)', req: false });
    g.push({ k: 'poles', t: '스틱', req: false });
    g.push({ k: 'firstaid', t: '구급약·은박 담요(대장·후미대장)', req: false });
    return g;
  }

  /* ---------- 공지문 ---------- */
  function notice(p, item, r, o) {
    o = o || {};
    var L = [];
    var title = p.title || ((item ? item.park + ' ' : '') + (item ? item.summitName : '') + ' 산행');
    L.push('[겨울산행 공지] ' + title);
    L.push('■ 날짜: ' + p.date + '(' + weekday(p.date) + ')');
    if (p.meetTime || p.meetPlace) L.push('■ 집결: ' + (p.meetTime || '') + (p.meetPlace ? ' ' + p.meetPlace : ''));
    if (item) L.push('■ 코스: ' + item.park + ' ' + item.name + ' → ' + item.summitName + ' (' + item.summitElev + 'm)');
    if (r.mode === 'sunrise') {
      L.push('■ 해맞이: 출발 ' + fmtHM(r.start) + ' → 정상 도착 목표 ' + fmtHM(r.summitTarget) + ' (일출 ' + fmtHM(r.sunrise) + ')');
      L.push('■ 야간 산행입니다. 이마등 없으면 참가할 수 없습니다.');
    } else {
      L.push('■ 출발 ' + fmtHM(r.start) + ' → 정상 예정 ' + fmtHM(r.plannedSummit) + ' → 하산 예정 ' + fmtHM(r.plannedFinish) + ' (일몰 ' + fmtHM(r.sunset) + ')');
      L.push('■ 반환 기준 ★');
      L.push(' - 정상 도착 마감 ' + fmtHM(r.summitDeadline) + ' — ' + fmtHM(r.summitDeadline) + '까지 정상에 못 가면 그 자리에서 하산합니다.');
      (r.checkpoints || []).forEach(function (c) { L.push(' - ' + c.name + ' 통과 마감 ' + fmtHM(c.deadline)); });
      L.push(' - 하산 완료 목표 ' + fmtHM(r.descentTarget));
    }
    if (r.control) L.push('■ 입산 가능: ' + r.control.seasonLabel + ' ' + fmtHM(r.control.open) + '~' + fmtHM(r.control.close) + (o.sourceLine ? ' (' + o.sourceLine + ')' : ''));
    var gl = gear(r, o.weather).filter(function (x) { return x.req; }).map(function (x) { return x.t.replace(/ \(.*\)/, ''); });
    L.push('■ 필수 장비: ' + gl.join(', '));
    L.push('■ 원칙: 입산통제·기상특보 시 코스 변경 또는 취소. 대열은 대장이 앞, 후미대장이 뒤. 갈림길마다 인원 확인.');
    L.push('■ 돌아서는 것도 완주입니다.');
    var c = [];
    if (o.leaderPhone) c.push('대장 ' + o.leaderPhone);
    if (o.sweepPhone) c.push('후미대장 ' + o.sweepPhone);
    L.push('■ 비상연락: ' + (c.length ? c.join(' / ') + ' / ' : '') + '사고 시 119 — 가까운 산악위치표지판 번호 또는 국가지점번호(노란 표지판, 한글 2자+숫자 8자리)를 알려 주세요.');
    L.push('※ 최종 판단은 현장·국립공원 공지 우선. 출발 전 공식 통제·기상특보를 다시 확인합니다.');
    return L.join('\n');
  }

  /* ---------- .ics ---------- */
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { var out = [], s = line; while (s.length > 70) { out.push(s.slice(0, 70)); s = ' ' + s.slice(70); } out.push(s); return out.join('\r\n'); }
  function ics(p, item, r, stampUTC) {
    var d = p.date.replace(/-/g, '');
    function dt(min) { return d + 'T' + pad(Math.floor(min / 60)) + pad(min % 60) + '00'; }
    var name = item ? item.park + ' ' + item.summitName : (p.title || '산행');
    var ev = [];
    if (parseHM(p.meetTime) !== null) ev.push(['meet', '집결 · ' + name, parseHM(p.meetTime), p.meetPlace || '']);
    if (r.mode === 'sunrise') {
      ev.push(['entry', '해맞이 출발 · ' + name, r.start, '일출 ' + fmtHM(r.sunrise)]);
      ev.push(['summit', '정상 도착 목표 · ' + name, r.summitTarget, '일출 전 도착']);
      ev.push(['descent', '하산 완료 예정 · ' + name, Math.min(r.plannedFinish, 1439), '']);
    } else {
      ev.push(['entry', '입산 마감 · ' + name, r.entryDeadline, '이 시각 이후 출발 금지']);
      ev.push(['summit', '정상 도착 마감 · ' + name, r.summitDeadline, '못 가면 그 자리에서 하산']);
      ev.push(['descent', '하산 완료 목표 · ' + name, r.descentTarget, '일몰 ' + fmtHM(r.sunset)]);
    }
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//winter-hike-turnaround-planner//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE'];
    ev.forEach(function (e) {
      if (!isFinite(e[2]) || e[2] < 0) return;
      L.push('BEGIN:VEVENT', 'UID:' + d + '-' + e[0] + '-' + (p.id || 'plan') + '@winter-hike', 'DTSTAMP:' + stampUTC, 'DTSTART;TZID=Asia/Seoul:' + dt(e[2]), 'DURATION:PT10M', fold('SUMMARY:' + icsEscape(e[1])));
      if (e[3]) L.push(fold('DESCRIPTION:' + icsEscape(e[3] + ' · 최종 판단은 현장·국립공원 공지 우선')));
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(e[1]), 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  /* ---------- 공유 링크 (이름·전화번호 제외) ---------- */
  var SHARE_KEYS = ['title', 'trailheadId', 'date', 'startTime', 'meetTime', 'meetPlace', 'ascentKm', 'ascentM', 'descentKm', 'descentM', 'manualAscent', 'manualDescent', 'pace', 'winterFactor', 'margin', 'summitStay', 'hut', 'mode', 'sunriseLead', 'sunriseStay', 'elev'];
  var PHONE = /(\+?82[-\s.]?0?|0)\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g;
  function scrub(s) { return String(s).replace(PHONE, '').slice(0, 80); }
  function shareObject(p) {
    var o = { v: 1 };
    SHARE_KEYS.forEach(function (k) { if (p[k] !== undefined && p[k] !== null && p[k] !== '') o[k] = typeof p[k] === 'string' ? scrub(p[k]) : p[k]; });
    if (p.custom) o.custom = { park: scrub(p.custom.park || ''), summitName: scrub(p.custom.summitName || ''), summitElev: +p.custom.summitElev || 0, lat: +p.custom.lat, lon: +p.custom.lon, open: p.custom.open || '', close: p.custom.close || '' };
    if (p.checkpoints) o.checkpoints = p.checkpoints.map(function (c) { return { name: scrub(c.name || ''), plannedTime: c.plannedTime }; });
    return o;
  }
  function b64e(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    return decodeURIComponent(escape(atob(s)));
  }
  function encodeShare(p) { return b64e(JSON.stringify(shareObject(p))); }
  function decodeShare(s) {
    if (!s || s.length > 6000) throw new Error('링크가 비었거나 너무 깁니다');
    var o = JSON.parse(b64d(s));
    if (!o || o.v !== 1 || !validDate(o.date)) throw new Error('지원하지 않는 링크입니다');
    var clean = shareObject(o); delete clean.v; clean.shared = true; // 받은 데이터도 화이트리스트 재적용
    return clean;
  }

  /* ---------- 인원 점검 ---------- */
  function parseNames(text) {
    var seen = {}, out = [];
    String(text || '').split(/\r?\n/).forEach(function (l) {
      var n = l.replace(PHONE, '').replace(/^\s*\d+[.)]\s*/, '').trim().slice(0, 20);
      if (n && !seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.slice(0, 80);
  }
  function rosterStatus(roster, cp) {
    var names = roster.names || [], marks = (roster.checks || {})[cp] || {};
    var ok = names.filter(function (n) { return marks[n]; });
    return { total: names.length, confirmed: ok.length, missing: names.filter(function (n) { return !marks[n]; }) };
  }

  /* ---------- 비상 카드 ---------- */
  function emergency(item, p, headcount) {
    var where = item ? item.park + ' ' + item.name + ' → ' + item.summitName + ' 방향' : (p && p.custom ? p.custom.park + ' ' + p.custom.summitName : '산 이름');
    return [
      { k: '1', t: '“등산 중 사고입니다.”', d: '119에 먼저 상황 한마디.' },
      { k: '2', t: '산 이름 · 코스', d: where },
      { k: '3', t: '위치 번호', d: '가장 가까운 산악위치표지판 번호 또는 국가지점번호(노란 표지판, 한글 2자 + 숫자 8자리, 예: 가나 8253 7983). 안 보이면 주소정보누리집(juso.go.kr) → 국가지점번호 → 나의 위치 지점번호.' },
      { k: '4', t: '인원', d: (headcount ? '일행 ' + headcount + '명 중 ' : '') + '다친 사람 수·고립된 사람 수' },
      { k: '5', t: '상태', d: '의식·호흡·출혈·골절 의심·저체온(떨림, 말 어눌함)' },
      { k: '6', t: '연락처', d: '신고한 휴대전화 번호. 통화 후 배터리 아끼고 전화 켜 두기.' }
    ];
  }

  /* ---------- 자체 점검 ---------- */
  function selfTest() {
    var fails = [];
    function eq(a, b, m) { if (a !== b) fails.push(m + ': ' + a + ' !== ' + b); }
    var e = estimate({ ascentKm: 5.5, ascentM: 1000, descentKm: 5.5, pace: 'beginner', winterFactor: 1.2 });
    eq(e.ascent, 320, 'ascent'); eq(e.descent, 203, 'descent');
    eq(windChillKMA(5, 6), 0.9, 'kma1'); eq(windChillKMA(0, 4), -4.3, 'kma2'); eq(windChillKMA(12, 5), null, 'kma-range');
    var s = sun('2026-11-14', 36.957, 128.485);
    if (!s || Math.abs(s.sunset - parseHM('17:17')) > 2) fails.push('sun');
    var dec = decodeShare(encodeShare({ date: '2026-12-13', meetPlace: '양재역 010-1234-5678', names: ['홍길동'], leaderPhone: '010-1111-2222' }));
    if (JSON.stringify(dec).indexOf('010') >= 0 || dec.names || dec.leaderPhone) fails.push('share-privacy');
    eq(chosung('소백산'), 'ㅅㅂㅅ', 'cho');
    return { ok: fails.length === 0, fails: fails };
  }

  return { PACE: PACE, SURFACE: SURFACE, DEFAULTS: DEFAULTS, parseHM: parseHM, fmtHM: fmtHM, fmtDur: fmtDur, validDate: validDate, weekday: weekday, estimate: estimate, seasonOf: seasonOf, control: control, sun: sun, windChillKMA: windChillKMA, weatherSummary: weatherSummary, plan: plan, chosung: chosung, search: search, gear: gear, notice: notice, ics: ics, encodeShare: encodeShare, decodeShare: decodeShare, shareObject: shareObject, parseNames: parseNames, rosterStatus: rosterStatus, emergency: emergency, selfTest: selfTest };
});
