/* 한파TBM 5분 — 순수 규칙 모듈 (DOM·네트워크 없음). 브라우저: window.HanpaRules / node: require('./rules.js')
   근거: 고용노동부·안전보건공단 한랭질환 예방가이드 이행매뉴얼(예방단계별 사업주 조치사항), 2025 한랭질환 예방수칙,
   기상청 겨울철 체감온도 산출식(data.kma.go.kr). 참고용이며 법적 의무 이행을 대체하지 않음. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HanpaRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ORDER = ['none', 'daily', 'watch', 'advisory', 'warning'];
  var WC_MIN_MS = 1.3, WC_MAX_T = 10;

  function r1(x) { return Math.round(x * 10) / 10; }
  function msToKmh(ms) { return ms * 3.6; }
  function kmhToMs(k) { return k / 3.6; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }

  /* 기상청 겨울철 체감온도: 13.12 + 0.6215T - 11.37V^0.16 + 0.3965V^0.16·T (T ℃, V km/h)
     기온 10℃ 이하, 풍속 1.3 m/s 이상일 때만 산출. 조건 밖이면 null(=산출 조건 아님). */
  function windChill(tC, vKmh) {
    if (!isNum(tC) || !isNum(vKmh)) return null;
    if (tC > WC_MAX_T) return null;
    if (kmhToMs(vKmh) < WC_MIN_MS - 1e-9) return null;
    var p = Math.pow(vKmh, 0.16);
    return 13.12 + 0.6215 * tC - 11.37 * p + 0.3965 * p * tC;
  }
  function windChillReason(tC, vKmh) {
    if (!isNum(tC) || !isNum(vKmh)) return 'nodata';
    if (tC > WC_MAX_T) return 'warm';
    if (kmhToMs(vKmh) < WC_MIN_MS - 1e-9) return 'calm';
    return 'ok';
  }

  function stageIndex(id) { var i = ORDER.indexOf(id); return i < 0 ? 0 : i; }
  function maxStage(a, b) { return stageIndex(a) >= stageIndex(b) ? a : b; }

  /* 온도기준 단계: 0℃ 이하 일상적 관리, 영하 6℃ 이하 관심, 영하 12℃ 이하 주의보 단계, 영하 15℃ 이하 경보 단계 ('이하' = 경계 포함) */
  function tempStage(minT, rules) {
    if (!isNum(minT)) return null;
    var t = r1(minT), st = 'none';
    var ts = rules.tempStages.slice().sort(function (a, b) { return b.maxTemp - a.maxTemp; });
    for (var i = 0; i < ts.length; i++) if (t <= ts[i].maxTemp) st = ts[i].id;
    return st;
  }
  /* 체감온도 단계: 관심 -3.2 이상 / 주의 -10.5 이상 -3.2 미만 / 경고 -15.4 이상 -10.5 미만 / 위험 -15.4 미만 */
  function windChillStage(wc, rules) {
    if (!isNum(wc)) return null;
    var v = r1(wc), ws = rules.windChillStages.slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < ws.length; i++) if (v >= ws[i].min) return ws[i].id;
    return ws[ws.length - 1].id;
  }
  /* 한파특보 발효 시 기온이 온도기준에 맞지 않아도 해당 단계 조치 이행 → 단계 상향(하향 없음) */
  function applyAlert(stage, alert, rules) {
    var a = (rules.alerts || []).filter(function (x) { return x.id === alert; })[0];
    if (!a || !a.raiseTo) return stage;
    return maxStage(stage || 'none', a.raiseTo);
  }
  /* 체크리스트: 일상적 관리 조치 + 해당 단계 표의 조치(가이드: "일상적 관리 단계의 조치사항 외 아래 사항을 추가") + 작업유형 추가 */
  function actionsFor(stage, workType, rules) {
    var out = [];
    if (!stage || stage === 'none') return out;
    var push = function (list, group) { (list || []).forEach(function (a) { out.push({ id: a.id, text: a.text, src: a.src, emphasis: !!a.emphasis, group: group }); }); };
    if (stage === 'warning') push(rules.actions.warning.filter(function (a) { return a.emphasis; }), 'warning');
    push(rules.actions.daily, 'daily');
    if (stage !== 'daily') push(rules.actions[stage].filter(function (a) { return !(stage === 'warning' && a.emphasis); }), stage);
    var ex = (rules.workTypeExtras || {})[workType] || [];
    ex.forEach(function (a) { if (stageIndex(stage) >= stageIndex(a.minStage)) out.push({ id: a.id, text: a.text, src: a.src, emphasis: !!a.emphasis, group: 'extra' }); });
    return out;
  }

  /* Open-Meteo hourly → 날짜별 06~18시 창 */
  function dayWindow(hourly, date, offset) {
    offset = isNum(offset) ? offset : 0;
    var res = { date: date, hours: [], minT: null, minTHour: null, minWC: null, minWCHour: null, wcCount: 0 };
    if (!hourly || !hourly.time) return res;
    for (var i = 0; i < hourly.time.length; i++) {
      var tm = String(hourly.time[i]);
      if (tm.slice(0, 10) !== date) continue;
      var h = parseInt(tm.slice(11, 13), 10);
      if (!(h >= 6 && h <= 18)) continue;
      var t = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
      var w = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;
      if (!isNum(t)) continue;
      t = r1(t + offset);
      var wc = windChill(t, w), row = { h: h, t: t, w: isNum(w) ? w : null, wc: wc === null ? null : r1(wc), wcReason: windChillReason(t, w) };
      res.hours.push(row);
      if (res.minT === null || t < res.minT) { res.minT = t; res.minTHour = h; }
      if (row.wc !== null) { res.wcCount++; if (res.minWC === null || row.wc < res.minWC) { res.minWC = row.wc; res.minWCHour = h; } }
    }
    return res;
  }
  function listDates(hourly) {
    var seen = {}, out = [];
    ((hourly && hourly.time) || []).forEach(function (t) { var d = String(t).slice(0, 10); if (!seen[d]) { seen[d] = 1; out.push(d); } });
    return out;
  }
  function evaluate(input, rules) {
    var ts = tempStage(input.minTemp, rules);
    var stage = applyAlert(ts, input.alert || 'none', rules);
    return {
      tempStage: ts, stage: stage, raised: stage !== ts,
      wcStage: windChillStage(input.minWC, rules),
      actions: actionsFor(stage, input.workType || 'general', rules)
    };
  }
  function stageMeta(id, rules) {
    if (id === 'none' || !id) return rules.noneStage;
    return rules.tempStages.filter(function (s) { return s.id === id; })[0] || rules.noneStage;
  }

  /* 가져오기(JSON) 검증: 알 수 없는 값은 버리고 문자열 길이 제한 */
  function str(x, n) { return typeof x === 'string' ? x.slice(0, n || 200) : ''; }
  function sanitizeLog(l) {
    if (!l || typeof l !== 'object' || typeof l.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.date))) return null;
    var att = Array.isArray(l.attendees) ? l.attendees.slice(0, 200).map(function (a) {
      var sig = typeof (a && a.sig) === 'string' && /^[MLml0-9 .,-]*$/.test(a.sig) ? a.sig.slice(0, 20000) : null;
      return { name: str(a && a.name, 40), sig: sig };
    }).filter(function (a) { return a.name; }) : [];
    return {
      id: str(l.id, 60), date: l.date, siteId: str(l.siteId, 60), siteName: str(l.siteName, 60),
      fetchedAt: str(l.fetchedAt, 40), source: str(l.source, 60),
      minTemp: isNum(l.minTemp) ? l.minTemp : null, minWindChill: isNum(l.minWindChill) ? l.minWindChill : null,
      stage: ORDER.indexOf(l.stage) >= 0 ? l.stage : 'none', alertToggle: ['none', 'advisory', 'warning'].indexOf(l.alertToggle) >= 0 ? l.alertToggle : 'none',
      workType: ['general', 'heavy', 'sanitation'].indexOf(l.workType) >= 0 ? l.workType : 'general',
      checked: Array.isArray(l.checked) ? l.checked.filter(function (c) { return typeof c === 'string'; }).slice(0, 100) : [],
      checkedText: Array.isArray(l.checkedText) ? l.checkedText.filter(function (c) { return typeof c === 'string'; }).map(function (c) { return c.slice(0, 300); }).slice(0, 100) : [],
      memo: str(l.memo, 2000), attendees: att, author: str(l.author, 40),
      savedAt: str(l.savedAt, 40), durationSec: isNum(l.durationSec) ? l.durationSec : null,
      place: str(l.place, 80), wcNote: str(l.wcNote, 80), minTHour: isNum(l.minTHour) ? l.minTHour : null,
      tempStage: ORDER.indexOf(l.tempStage) >= 0 ? l.tempStage : null,
      wcStage: ['wc_attention', 'wc_caution', 'wc_warning', 'wc_danger'].indexOf(l.wcStage) >= 0 ? l.wcStage : null
    };
  }
  function sanitizeSite(s) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !isNum(s.lat) || !isNum(s.lon)) return null;
    if (Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180) return null;
    return { id: str(s.id, 60), name: str(s.name, 40) || '현장', place: str(s.place, 80), lat: s.lat, lon: s.lon,
      workType: ['general', 'heavy', 'sanitation'].indexOf(s.workType) >= 0 ? s.workType : 'general',
      offset: isNum(s.offset) && Math.abs(s.offset) <= 10 ? s.offset : 0 };
  }

  /* 자체 점검: 규칙 파일 값이 1차 출처와 같은지 + 경계값 + 체감온도 손계산/산출표 값 */
  function selfTest(rules) {
    var R = [];
    function ok(name, cond, got) { R.push({ name: name, pass: !!cond, got: got }); }
    var th = {}; rules.tempStages.forEach(function (s) { th[s.id] = s.maxTemp; });
    ok('온도기준 0/−6/−12/−15 (가이드 표)', th.daily === 0 && th.watch === -6 && th.advisory === -12 && th.warning === -15, JSON.stringify(th));
    var wm = {}; rules.windChillStages.forEach(function (s) { wm[s.id] = s.min; });
    ok('체감온도 단계 −3.2/−10.5/−15.4', wm.wc_attention === -3.2 && wm.wc_caution === -10.5 && wm.wc_warning === -15.4, JSON.stringify(wm));
    [[0.1, 'none'], [0, 'daily'], [-5.9, 'daily'], [-6, 'watch'], [-11.9, 'watch'], [-12, 'advisory'], [-14.9, 'advisory'], [-15, 'warning'], [-20, 'warning'], [-6.04, 'watch'], [-5.96, 'watch']]
      .forEach(function (c) { var g = tempStage(c[0], rules); ok('기온 ' + c[0] + '℃ → ' + c[1], g === c[1], g); });
    [[-3.2, 'wc_attention'], [-3.3, 'wc_caution'], [-10.5, 'wc_caution'], [-10.6, 'wc_warning'], [-15.4, 'wc_warning'], [-15.5, 'wc_danger'], [5, 'wc_attention']]
      .forEach(function (c) { var g = windChillStage(c[0], rules); ok('체감 ' + c[0] + ' → ' + c[1], g === c[1], g); });
    [[0, 1.4, -1.6], [-10, 8.3, -19.5], [-20, 16.7, -36.5], [-6, 5.6, -12.8], [-12, 2.8, -17.7], [-2, 13.9, -10.9]]
      .forEach(function (c) { var g = windChill(c[0], msToKmh(c[1])); ok('체감온도 ' + c[0] + '℃·' + c[1] + 'm/s = ' + c[2] + ' (산출표)', g !== null && r1(g) === c[2], g === null ? null : r1(g)); });
    var hand = windChill(0, 10); ok('손계산 0℃·10km/h = −3.3', hand !== null && Math.abs(hand - (-3.315)) < 0.01, hand === null ? null : Math.round(hand * 1000) / 1000);
    ok('산출 조건: 10.1℃ → 산출 안 함', windChill(10.1, 20) === null, windChill(10.1, 20));
    ok('산출 조건: 1.2 m/s → 산출 안 함', windChill(-5, msToKmh(1.2)) === null, windChill(-5, msToKmh(1.2)));
    ok('산출 조건: 10℃·1.3 m/s 경계 포함', windChill(10, msToKmh(1.3)) !== null, windChill(10, msToKmh(1.3)));
    ok('주의보 토글: 일상 → 주의보 단계', applyAlert('daily', 'advisory', rules) === 'advisory', applyAlert('daily', 'advisory', rules));
    ok('경보 토글: 0℃ 초과여도 → 경보 단계', applyAlert('none', 'warning', rules) === 'warning', applyAlert('none', 'warning', rules));
    ok('주의보 토글은 경보 단계를 낮추지 않음', applyAlert('warning', 'advisory', rules) === 'warning', applyAlert('warning', 'advisory', rules));
    var n = function (s, w) { return actionsFor(s, w || 'general', rules).length; };
    ok('조치 수 일상 6 / 관심 9 / 주의보 13 / 경보 15', n('daily') === 6 && n('watch') === 9 && n('advisory') === 13 && n('warning') === 15, [n('daily'), n('watch'), n('advisory'), n('warning')].join('/'));
    ok('중작업 추가 (경보 +4)', n('warning', 'heavy') === 19, n('warning', 'heavy'));
    var w0 = actionsFor('warning', 'general', rules)[0];
    ok('경보 단계 첫 항목 = 옥외작업 중지 또는 최소화', w0 && w0.emphasis && /중지 또는 최소화/.test(w0.text), w0 && w0.id);
    var pass = R.filter(function (x) { return x.pass; }).length;
    return { pass: pass, total: R.length, ok: pass === R.length, results: R };
  }

  return { ORDER: ORDER, r1: r1, msToKmh: msToKmh, kmhToMs: kmhToMs, windChill: windChill, windChillReason: windChillReason,
    tempStage: tempStage, windChillStage: windChillStage, applyAlert: applyAlert, maxStage: maxStage, stageIndex: stageIndex,
    actionsFor: actionsFor, dayWindow: dayWindow, listDates: listDates, evaluate: evaluate, stageMeta: stageMeta,
    sanitizeLog: sanitizeLog, sanitizeSite: sanitizeSite, selfTest: selfTest };
});
