/* 참았지 (Held It) — vanilla JS, no server. Storage key: chamatji.v1 */
(function () {
  'use strict';

  var KEY = 'chamatji.v1';
  var VERSION = 1;
  var APP_VERSION = '1.0.0';
  var HOUR = 3600000;
  var DAY = 86400000;
  var COOL_OPTS = [1, 24, 72];

  var CATS = {
    fashion: { l: '패션', e: '👕' },
    beauty: { l: '뷰티', e: '💄' },
    tech: { l: '전자', e: '🎧' },
    food: { l: '식음료·배달', e: '🍔' },
    hobby: { l: '취미', e: '🎨' },
    etc: { l: '기타', e: '📦' }
  };
  var REASONS = {
    boredom: { l: '심심함', e: '🥱' },
    stress: { l: '스트레스', e: '😮‍💨' },
    sale: { l: '할인', e: '🏷️' },
    need: { l: '필요', e: '✅' },
    reward: { l: '보상심리', e: '🎁' }
  };
  var TIPS = {
    fashion: [
      '옷장에서 비슷한 옷 3벌을 먼저 찾아봐요. 의외로 있을지도 몰라요.',
      '이 옷과 어울리는 내 옷이 3개 이상 떠오르는지 생각해봐요.',
      '사는 대신 캡처해서 "위시 코디" 앨범에만 모아봐요.',
      '"가격 ÷ 입을 횟수"를 계산해보면 진짜 가치가 보여요.'
    ],
    beauty: [
      '지금 쓰는 제품을 다 쓰고 나서 다시 생각해봐요.',
      '샘플이나 미니 사이즈로 먼저 테스트해봐요.',
      '화장대 서랍 속에 비슷한 색이 있는지 찾아봐요.',
      '리뷰 영상 대신 성분표를 지금 쓰는 제품과 비교해봐요.'
    ],
    tech: [
      '지금 기기로 못 하는 일이 정확히 뭔지 한 줄로 적어봐요.',
      '다음 세일 시즌까지 가격 추이를 지켜봐요.',
      '중고·리퍼 시세와 한 번 비교해봐요.',
      '출시 1년 뒤 가격을 떠올려보면 조급함이 줄어요.'
    ],
    food: [
      '물 한 잔 마시고 10분만 기다려봐요.',
      '냉장고 재료로 10분 요리에 도전해봐요.',
      '배달비까지 합친 금액을 장보기 금액과 비교해봐요.',
      '진짜 배고픈 건지, 심심한 건지 체크해봐요.'
    ],
    hobby: [
      '이미 있는 장비로 이번 주에 한 번 더 즐겨봐요.',
      '커뮤니티에서 빌리거나 나눔을 찾아봐요.',
      '이번 달 이 취미에 쓴 돈을 먼저 확인해봐요.',
      '무료 강의나 체험으로 먼저 맛보기 해봐요.'
    ],
    etc: [
      '5분만 산책하고 돌아와서 다시 봐요.',
      '이 돈이면 목표에 얼마나 가까워지는지 떠올려봐요.',
      '친구에게 "이거 살까?" 하고 물어봐요.',
      '필요한 이유를 한 문장으로 적어보면 답이 보여요.'
    ]
  };

  // ---------- utils ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function comma(n) { return Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function won(n) { return '₩' + comma(n); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dkey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function digits(v) { return String(v || '').replace(/\D/g, ''); }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hoursLabel(h) { return h + '시간'; }
  var WD = ['일', '월', '화', '수', '목', '금', '토'];

  function fmtRemain(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    if (s >= 86400) {
      var d = Math.floor(s / 86400);
      return d + '일 ' + pad(Math.floor((s % 86400) / 3600)) + ':' + pad(Math.floor((s % 3600) / 60));
    }
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }

  function normUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { var p = new URL(u); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; } catch (e) { return ''; }
  }

  // ---------- state ----------
  function defaults() {
    return {
      version: VERSION,
      createdAt: new Date().toISOString(),
      settings: { defaultCooldownHours: 24, currency: 'KRW', onboarded: false },
      goal: null,
      items: [],
      noSpendDays: []
    };
  }

  function num(v) { return (v === null || v === undefined || v === '') ? NaN : Number(v); }

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !Array.isArray(raw.items)) throw new Error('invalid');
    var d = defaults();
    var s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    if (typeof raw.createdAt === 'string') d.createdAt = raw.createdAt;
    d.settings.defaultCooldownHours = COOL_OPTS.indexOf(s.defaultCooldownHours) >= 0 ? s.defaultCooldownHours : 24;
    d.settings.onboarded = !!s.onboarded;
    var g = raw.goal;
    if (g && typeof g === 'object' && num(g.amount) > 0) {
      d.goal = { name: String(g.name || '나의 목표').slice(0, 30), amount: Math.round(num(g.amount)) };
    }
    d.items = raw.items.filter(function (it) {
      return it && typeof it === 'object' && it.id && isFinite(num(it.price)) && isFinite(num(it.endsAt));
    }).map(function (it) {
      return {
        id: String(it.id),
        name: String(it.name || '이름 없는 물건').slice(0, 40),
        price: Math.max(0, Math.round(num(it.price))),
        category: CATS[it.category] ? it.category : 'etc',
        reason: REASONS[it.reason] ? it.reason : null,
        url: typeof it.url === 'string' ? normUrl(it.url) : '',
        createdAt: isFinite(num(it.createdAt)) ? num(it.createdAt) : Date.now(),
        endsAt: num(it.endsAt),
        status: (it.status === 'resisted' || it.status === 'bought') ? it.status : 'cooling',
        decidedAt: isFinite(num(it.decidedAt)) ? num(it.decidedAt) : null
      };
    });
    var seen = {};
    d.noSpendDays = (Array.isArray(raw.noSpendDays) ? raw.noSpendDays : []).filter(function (x) {
      if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x) || seen[x]) return false;
      seen[x] = 1; return true;
    }).sort();
    return d;
  }

  var storageWarned = false;
  var loadNotice = null;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return defaults(); }
    if (raw == null) return defaults();
    try {
      return sanitize(JSON.parse(raw));
    } catch (e) {
      loadNotice = '저장된 기록을 읽지 못해서 새로 시작해요. 놀라셨죠, 미안해요 🙏';
      var d = defaults();
      try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e2) { /* ignore */ }
      return d;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!storageWarned) { storageWarned = true; toast('이 브라우저에서는 저장이 안 될 수 있어요. 기록이 사라질 수 있어요 🥲'); }
    }
  }

  var state = load();

  // ---------- derived ----------
  function statusOf(it, now) {
    now = now || Date.now();
    return it.status === 'cooling' && now >= it.endsAt ? 'ready' : it.status;
  }
  function savedTotal() {
    return state.items.reduce(function (s, it) { return it.status === 'resisted' ? s + it.price : s; }, 0);
  }
  function progressOf(total) {
    if (!state.goal || !state.goal.amount) return 0;
    return Math.min(1, total / state.goal.amount);
  }
  function streak() {
    var set = {};
    state.noSpendDays.forEach(function (k) { set[k] = 1; });
    var d = new Date(); d.setHours(12, 0, 0, 0);
    if (!set[dkey(d)]) d.setDate(d.getDate() - 1);
    var n = 0;
    while (set[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function isNoSpend(k) { return state.noSpendDays.indexOf(k) >= 0; }
  function byStatus(st) {
    var now = Date.now();
    return state.items.filter(function (it) {
      var s = statusOf(it, now);
      return st === 'done' ? (s === 'resisted' || s === 'bought') : s === st;
    });
  }
  function findItem(id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; return null; }

  function monthStats(y, m) {
    var start = new Date(y, m, 1).getTime(), end = new Date(y, m + 1, 1).getTime();
    var r = { resisted: 0, resistedN: 0, bought: 0, boughtN: 0, noSpend: 0, reasons: {}, reasonTotal: 0 };
    state.items.forEach(function (it) {
      if (it.decidedAt != null && it.decidedAt >= start && it.decidedAt < end) {
        if (it.status === 'resisted') { r.resisted += it.price; r.resistedN++; }
        else if (it.status === 'bought') { r.bought += it.price; r.boughtN++; }
      }
      if (it.reason && it.createdAt >= start && it.createdAt < end) {
        r.reasons[it.reason] = (r.reasons[it.reason] || 0) + 1; r.reasonTotal++;
      }
    });
    var prefix = y + '-' + pad(m + 1) + '-';
    state.noSpendDays.forEach(function (k) { if (k.indexOf(prefix) === 0) r.noSpend++; });
    var dn = r.resistedN + r.boughtN;
    r.ratio = dn ? r.resistedN / dn : null;
    r.top = Object.keys(r.reasons).map(function (k) { return { k: k, n: r.reasons[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 3);
    return r;
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // ---------- router ----------
  var PAGES = ['home', 'cooldown', 'record', 'settings'];
  var SHEETS = ['add', 'item', 'share'];
  var baseRoute = 'home';
  var renderedPage = null;
  var sheetPushed = false;
  var sheetOpen = null; // {name, arg}
  var cdFilter = 'cooling';
  var now0 = new Date();
  var calY = now0.getFullYear(), calM = now0.getMonth();

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var q = qi >= 0 ? h.slice(qi + 1) : '';
    var parts = path.split('/').filter(Boolean);
    var query = {};
    q.split('&').forEach(function (p) { if (!p) return; var kv = p.split('='); query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
    var arg = null;
    if (parts[1]) { try { arg = decodeURIComponent(parts[1]); } catch (e) { arg = parts[1]; } }
    return { name: parts[0] || 'home', arg: arg, query: query };
  }

  function go(hash) {
    if (location.hash === hash) { onRoute(); return; }
    location.hash = hash;
  }
  function openSheetRoute(hash) {
    sheetPushed = true;
    go(hash);
  }
  function closeSheet() {
    if (!sheetOpen) return;
    if (sheetPushed) { sheetPushed = false; history.back(); }
    else location.replace('#/' + baseRoute);
  }

  function onRoute() {
    var r = parseHash();
    if (PAGES.indexOf(r.name) >= 0) {
      if (r.name === 'cooldown' && r.query.f && ['cooling', 'ready', 'done'].indexOf(r.query.f) >= 0) cdFilter = r.query.f;
      var changed = baseRoute !== r.name || renderedPage !== r.name;
      baseRoute = r.name;
      sheetPushed = false;
      hideSheet();
      renderPage(changed);
    } else if (SHEETS.indexOf(r.name) >= 0) {
      if (renderedPage !== baseRoute) renderPage(true);
      if (r.name === 'item' && !findItem(r.arg)) {
        toast('찾을 수 없는 물건이에요');
        location.replace('#/' + baseRoute);
        return;
      }
      showSheet(r.name, r.arg);
    } else {
      location.replace('#/home');
    }
  }

  // ---------- page render ----------
  var TITLES = { home: '홈', cooldown: '쿨다운', record: '기록', settings: '설정' };
  function renderPage(scrollTop) {
    var v = $('#view');
    var fn = { home: pageHome, cooldown: pageCooldown, record: pageRecord, settings: pageSettings }[baseRoute];
    v.innerHTML = fn();
    renderedPage = baseRoute;
    document.title = (baseRoute === 'home' ? '' : TITLES[baseRoute] + ' · ') + '참았지 — 충동구매 쿨다운 저금통';
    $$('.tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === baseRoute;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    updateBadge();
    if (scrollTop) window.scrollTo(0, 0);
    if (baseRoute === 'settings') bindSettings();
    tick(true);
  }

  function updateBadge() {
    var n = byStatus('ready').length;
    var b = $('#readyBadge');
    b.hidden = !n;
    b.textContent = n > 9 ? '9+' : String(n);
    var tab = $('.tab[data-tab="cooldown"]');
    tab.setAttribute('aria-label', '쿨다운' + (n ? ', 결정할 물건 ' + n + '개' : ''));
  }

  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return '늦은 밤이에요, 오늘도 수고했어요';
    if (h < 11) return '좋은 아침이에요 ☀️';
    if (h < 17) return '좋은 오후예요 🙂';
    if (h < 21) return '오늘 하루 어땠어요?';
    return '밤엔 지갑도 쉬어요 🌙';
  }
  function todayLabel() {
    var d = new Date();
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일';
  }

  function itemCard(it, now) {
    var s = statusOf(it, now);
    var c = CATS[it.category];
    var meta = c.l + (it.reason ? ' · ' + REASONS[it.reason].l : '');
    var right;
    if (s === 'cooling') right = '<span class="cd" data-ends="' + it.endsAt + '">' + fmtRemain(it.endsAt - now) + '</span><span class="cap">남았어요</span>';
    else if (s === 'ready') right = '<span class="badge b-ready">결정할 시간 ⏰</span>';
    else if (s === 'resisted') right = '<span class="badge b-res">참았다 🙌</span>';
    else right = '<span class="badge b-buy">샀다 🛒</span>';
    return '<a class="item ' + s + '" href="#/item/' + encodeURIComponent(it.id) + '" data-action="open-item" data-id="' + esc(it.id) + '">' +
      '<span class="emo" aria-hidden="true">' + c.e + '</span>' +
      '<span class="mid"><span class="nm" style="display:block">' + esc(it.name) + '</span>' +
      '<span class="pr num" style="display:block">' + won(it.price) + '</span>' +
      '<span class="meta" style="display:block">' + esc(meta) + '</span></span>' +
      '<span class="rt">' + right + '</span></a>';
  }

  function goalBlock(total, light) {
    if (!state.goal) {
      return light ? '' : '<a class="goal-cta" href="#/settings"><span>🎯 모으고 싶은 목표를 정해볼까요?</span><span aria-hidden="true">›</span></a>';
    }
    var p = progressOf(total);
    return '<div class="goal-row"><b>🎯 ' + esc(state.goal.name) + '</b><span class="num">' + Math.floor(p * 100) + '%</span></div>' +
      '<div class="bar' + (light ? ' light' : '') + '" role="progressbar" aria-label="목표 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.floor(p * 100) + '"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>' +
      '<div class="goal-row" style="opacity:.9"><span class="num">' + won(Math.min(total, state.goal.amount)) + ' / ' + won(state.goal.amount) + '</span>' +
      '<span>' + (p >= 1 ? '목표 달성! 🎉' : won(state.goal.amount - total) + ' 남았어요') + '</span></div>';
  }

  function pageHome() {
    var now = Date.now();
    var total = savedTotal();
    var todayOn = isNoSpend(dkey());
    var st = streak();
    var ready = byStatus('ready').sort(function (a, b) { return a.endsAt - b.endsAt; });
    var cooling = byStatus('cooling').sort(function (a, b) { return a.endsAt - b.endsAt; });
    var resistedN = byStatus('resisted').length;
    var h = '';
    h += '<header class="hdr"><div><p class="hello">' + greeting() + '</p><p class="date">' + todayLabel() + '</p></div>' +
      '<a class="iconbtn" href="#/settings" aria-label="설정">⚙️</a></header>';
    h += '<section class="card piggy" aria-label="저금통">' +
      '<span class="pig" aria-hidden="true">🐷</span>' +
      '<div class="lbl">지금까지 참은 돈</div>' +
      '<div class="big num" id="homeTotal">' + won(total) + '</div>' +
      goalBlock(total) +
      (resistedN ? '<div class="cap" style="color:#fff;opacity:.85;margin-top:8px">충동구매를 ' + resistedN + '번 참아냈어요</div>' : '') +
      '</section>';
    h += '<section class="card nospend">' +
      '<div class="ns-text"><div class="ns-title">오늘 무지출</div>' +
      '<div class="cap">' + (todayOn ? '오늘은 한 푼도 안 썼어요. 멋져요!' : '오늘 아무것도 안 샀다면 켜주세요') + '</div>' +
      '<div class="streak num" aria-label="연속 ' + st + '일">🔥 ' + st + '일 연속</div></div>' +
      '<div class="switch-hit"><button class="switch" role="switch" aria-checked="' + todayOn + '" aria-label="오늘 무지출" data-action="toggle-nospend"></button></div>' +
      '</section>';
    if (ready.length) {
      h += '<div class="sec-title"><span>⏰ 결정할 시간</span>' + (ready.length > 2 ? '<a href="#/cooldown?f=ready">' + ready.length + '개 모두 보기 ›</a>' : '') + '</div>';
      ready.slice(0, 2).forEach(function (it) { h += itemCard(it, now); });
    }
    h += '<div class="sec-title"><span>⏳ 쿨다운 중</span>' + (cooling.length ? '<a href="#/cooldown?f=cooling">전체 보기 ›</a>' : '') + '</div>';
    if (cooling.length) {
      var next = cooling[0];
      h += '<a class="card cool-summary" href="#/cooldown?f=cooling"><span class="ic" aria-hidden="true">⏳</span>' +
        '<span class="tx"><b style="display:block;font-size:16px">' + cooling.length + '개 참는 중이에요</b>' +
        '<span class="cap" style="display:block">다음 결정까지 <span class="cd" data-ends="' + next.endsAt + '">' + fmtRemain(next.endsAt - now) + '</span></span></span>' +
        '<span class="chev" aria-hidden="true">›</span></a>';
    } else if (!state.items.length) {
      h += '<div class="card empty"><div class="e-ic">🛍️</div><b>아직 담은 물건이 없어요</b>' +
        '사고 싶은 게 생기면 결제하기 전에 ＋를 눌러 담아보세요.<br>하루만 지나도 마음이 달라질 수 있어요.' +
        '<br><a class="btn btn-primary" href="#/add" data-action="open-add">＋ 첫 물건 담기</a></div>';
    } else {
      h += '<div class="card empty" style="padding:20px"><b>지금 참는 중인 물건은 없어요</b>사고 싶은 게 생기면 ＋로 담아두세요 🙂</div>';
    }
    return h;
  }

  function pageCooldown() {
    var now = Date.now();
    var groups = { cooling: byStatus('cooling'), ready: byStatus('ready'), done: byStatus('done') };
    groups.cooling.sort(function (a, b) { return a.endsAt - b.endsAt; });
    groups.ready.sort(function (a, b) { return a.endsAt - b.endsAt; });
    groups.done.sort(function (a, b) { return (b.decidedAt || 0) - (a.decidedAt || 0); });
    var labels = { cooling: '쿨다운 중', ready: '결정 대기', done: '완료' };
    var h = '<header class="hdr"><h1>쿨다운</h1><a class="iconbtn" href="#/settings" aria-label="설정">⚙️</a></header>';
    h += '<div class="seg" role="group" aria-label="필터">';
    ['cooling', 'ready', 'done'].forEach(function (k) {
      h += '<button type="button" data-action="filter" data-f="' + k + '" aria-pressed="' + (cdFilter === k) + '">' + labels[k] + '<span class="cnt">' + groups[k].length + '</span></button>';
    });
    h += '</div>';
    var list = groups[cdFilter];
    if (!list.length) {
      var em = {
        cooling: ['⏳', '쿨다운 중인 물건이 없어요', '사고 싶은 게 생기면 ＋로 담아두세요. 시간이 지나면 다시 물어볼게요.'],
        ready: ['🙂', '결정할 물건이 없어요', '쿨다운이 끝나면 여기에서 "참았다/샀다"를 고를 수 있어요.'],
        done: ['🐷', '아직 결정한 물건이 없어요', '참아낸 물건은 저금통에 쌓이고, 여기에 기록돼요.']
      }[cdFilter];
      h += '<div class="card empty"><div class="e-ic">' + em[0] + '</div><b>' + em[1] + '</b>' + em[2] +
        (cdFilter === 'cooling' ? '<br><a class="btn btn-primary" href="#/add" data-action="open-add">＋ 물건 담기</a>' : '') + '</div>';
    } else {
      list.forEach(function (it) { h += itemCard(it, now); });
    }
    return h;
  }

  function pageRecord() {
    var today = new Date();
    var tKey = dkey(today);
    var ms = monthStats(calY, calM);
    var first = new Date(calY, calM, 1);
    var days = new Date(calY, calM + 1, 0).getDate();
    var isCurMonth = calY === today.getFullYear() && calM === today.getMonth();
    var resistedDays = {};
    state.items.forEach(function (it) { if (it.status === 'resisted' && it.decidedAt != null) resistedDays[dkey(new Date(it.decidedAt))] = 1; });
    var h = '<header class="hdr"><h1>기록</h1><a class="iconbtn" href="#/settings" aria-label="설정">⚙️</a></header>';
    h += '<section class="card">';
    h += '<div class="cal-nav"><button type="button" data-action="cal-prev" aria-label="이전 달">‹</button>' +
      '<h2 id="calTitle">' + calY + '년 ' + (calM + 1) + '월</h2>' +
      '<button type="button" data-action="cal-next" aria-label="다음 달"' + (isCurMonth ? ' disabled' : '') + '>›</button></div>';
    h += '<div class="cal" role="grid" aria-labelledby="calTitle">';
    WD.forEach(function (w) { h += '<div class="wd" role="columnheader">' + w + '</div>'; });
    for (var i = 0; i < first.getDay(); i++) h += '<div aria-hidden="true"></div>';
    for (var d = 1; d <= days; d++) {
      var k = calY + '-' + pad(calM + 1) + '-' + pad(d);
      var ns = isNoSpend(k), rd = !!resistedDays[k];
      var cls = 'day' + (ns ? ' stamp' : '') + (k === tKey ? ' today' : '') + (k > tKey ? ' future' : '');
      var lab = (calM + 1) + '월 ' + d + '일' + (ns ? ', 무지출' : '') + (rd ? ', 참은 날' : '');
      h += '<div class="' + cls + '" role="gridcell" aria-label="' + lab + '" data-day="' + k + '"><span class="dn">' + d + '</span>' + (rd ? '<i class="dot"></i>' : '') + '</div>';
    }
    h += '</div><div class="legend"><span><i class="lg-stamp"></i>무지출 도장</span><span><i class="lg-dot"></i>참은 날</span></div></section>';

    var mLabel = (calM + 1) + '월';
    h += '<div class="stats">' +
      '<div class="stat hl"><div class="cap">' + mLabel + ' 참은 돈 🙌</div><div class="v num" id="mResisted">' + won(ms.resisted) + '</div><div class="cap">' + ms.resistedN + '번 참았어요</div></div>' +
      '<div class="stat"><div class="cap">샀다 🛒</div><div class="v num" id="mBought">' + won(ms.bought) + '</div><div class="cap">' + ms.boughtN + '번</div></div>' +
      '<div class="stat"><div class="cap">참은 비율</div><div class="v num" id="mRatio">' + (ms.ratio == null ? '—' : Math.round(ms.ratio * 100) + '%') + '</div><div class="cap">결정한 것 중</div></div>' +
      '<div class="stat"><div class="cap">무지출 데이</div><div class="v num" id="mNoSpend">' + ms.noSpend + '일</div><div class="cap">이번 달 도장</div></div>' +
      '<div class="stat"><div class="cap">연속 무지출</div><div class="v num">🔥 ' + streak() + '일</div><div class="cap">오늘 기준</div></div>' +
      '</div>';

    h += '<section class="card"><div style="font-weight:700;font-size:16px">사고 싶어진 이유 Top 3</div><div class="cap">' + mLabel + '에 담은 물건 기준</div>';
    if (ms.top.length) {
      ms.top.forEach(function (t, i) {
        var pct = Math.round(t.n / ms.reasonTotal * 100);
        h += '<div class="reason-row"><span class="rk">' + (i + 1) + '</span><span class="rn">' + REASONS[t.k].e + ' ' + REASONS[t.k].l + '</span>' +
          '<div class="bar light"><i style="width:' + pct + '%"></i></div><span class="rc num">' + t.n + '회</span></div>';
      });
      var topK = ms.top[0].k;
      var insight = {
        boredom: '심심할 때 담는 경우가 많네요. 그럴 땐 5분 산책이 꽤 효과 있어요.',
        stress: '스트레스 받을 때 사고 싶어지는군요. 오늘은 나를 위한 다른 보상을 찾아봐요.',
        sale: '할인에 마음이 흔들렸네요. 할인은 다음에도 또 와요 🙂',
        need: '필요해서 담은 게 많아요. 잘 고르고 있다는 뜻이에요!',
        reward: '보상심리가 1위예요. 이미 충분히 잘하고 있으니, 돈 안 드는 보상도 챙겨봐요.'
      }[topK];
      h += '<div class="tip" style="margin:12px 0 0"><b>💡 나의 패턴</b>' + insight + '</div>';
    } else {
      h += '<div class="empty" style="padding:18px 0 6px">담을 때 이유를 고르면<br>나의 충동구매 패턴이 보여요</div>';
    }
    h += '</section>';
    h += '<a class="btn btn-primary" href="#/share" data-action="open-share">📸 ' + mLabel + ' 공유 카드 만들기</a>';
    return h;
  }

  function pageSettings() {
    var g = state.goal || { name: '', amount: '' };
    var h = '<header class="hdr"><h1>설정</h1></header>';
    h += '<section class="card"><div style="font-weight:700;font-size:16px;margin-bottom:12px">🎯 저금통 목표</div>' +
      '<div class="field"><label for="gName">목표 이름</label><input class="input" id="gName" maxlength="30" placeholder="예) 제주도 여행" value="' + esc(g.name) + '" autocomplete="off"></div>' +
      '<div class="field"><label for="gAmt">목표 금액</label><div class="input-wrap"><input class="input num" id="gAmt" inputmode="numeric" placeholder="300,000" value="' + (g.amount ? comma(g.amount) : '') + '" autocomplete="off"><span class="suffix">원</span></div></div>' +
      '<button class="btn btn-primary" id="gSave" data-action="save-goal" disabled>목표 저장</button>' +
      (state.goal ? '<button class="btn btn-ghost" data-action="clear-goal" style="margin-top:6px;min-height:44px;font-size:14px">목표 없이 쓰기</button>' : '') +
      '</section>';
    h += '<section class="card"><div style="font-weight:700;font-size:16px">⏳ 기본 쿨다운 시간</div><div class="cap" style="margin-bottom:10px">물건을 담을 때 기본으로 선택돼요</div>' +
      '<div class="seg" role="radiogroup" aria-label="기본 쿨다운 시간" style="margin:0">';
    COOL_OPTS.forEach(function (o) {
      h += '<button type="button" role="radio" data-action="set-default-cool" data-h="' + o + '" aria-checked="' + (state.settings.defaultCooldownHours === o) + '">' + o + '시간</button>';
    });
    h += '</div></section>';
    h += '<section class="card"><div class="set-row"><div><div style="font-weight:700">데이터 초기화</div><div class="cap">담은 물건, 저금통, 도장이 모두 지워져요</div></div>' +
      '<button class="btn btn-danger" style="width:auto;padding:0 16px;min-height:44px;font-size:14px" data-action="reset">초기화</button></div></section>';
    h += '<p class="about">🐷 참았지 (Held It) v' + APP_VERSION + '<br>로그인 없이, 모든 기록은 이 기기에만 저장돼요.</p>';
    return h;
  }

  function bindSettings() {
    var n = $('#gName'), a = $('#gAmt'), b = $('#gSave');
    function upd() {
      var amt = Number(digits(a.value));
      var g = state.goal || { name: '', amount: 0 };
      var valid = n.value.trim().length > 0 && amt > 0;
      var changed = n.value.trim() !== g.name || amt !== g.amount;
      b.disabled = !(valid && changed);
    }
    n.addEventListener('input', upd);
    a.addEventListener('input', function () { formatMoneyInput(a); upd(); });
  }

  function formatMoneyInput(el) {
    var d = digits(el.value).replace(/^0+/, '').slice(0, 9);
    el.value = d ? comma(Number(d)) : '';
  }

  // ---------- sheets ----------
  var draft = null;

  function showSheet(name, arg) {
    var root = $('#sheet-root');
    var wasOpen = !!sheetOpen && root.firstChild;
    sheetOpen = { name: name, arg: arg };
    var html = name === 'add' ? sheetAdd() : name === 'item' ? sheetItem(findItem(arg)) : sheetShare();
    var label = { add: '사고 싶은 물건 담기', item: '물건 상세', share: '공유 카드' }[name];
    if (!wasOpen) {
      root.innerHTML = '<div class="backdrop" data-action="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + label + '"><div class="grab" aria-hidden="true"></div><div class="sheet-body"></div></div>';
    } else {
      $('.sheet', root).setAttribute('aria-label', label);
    }
    $('.sheet-body', root).innerHTML = html;
    document.body.classList.add('locked');
    if (!wasOpen) {
      // force reflow then animate
      root.firstChild.getBoundingClientRect();
      requestAnimationFrame(function () {
        $$('.backdrop,.sheet', root).forEach(function (e) { e.classList.add('open'); });
      });
    }
    if (name === 'add') bindAdd();
    if (name === 'share') drawShare();
    if (name === 'item') tick(true);
  }

  function hideSheet() {
    var root = $('#sheet-root');
    if (!sheetOpen && !root.firstChild) return;
    sheetOpen = null;
    draft = null;
    document.body.classList.remove('locked');
    var els = $$('.backdrop,.sheet', root);
    if (!els.length) return;
    els.forEach(function (e) { e.classList.remove('open'); });
    var done = false;
    var fin = function () { if (done) return; done = true; if (!sheetOpen) root.innerHTML = ''; };
    setTimeout(fin, reduced() ? 0 : 260);
  }

  function sheetAdd() {
    draft = { name: '', price: '', category: null, reason: null, url: '', hours: state.settings.defaultCooldownHours };
    var h = '<div class="sheet-hdr"><h2>사고 싶은 게 생겼나요?</h2><button class="x" data-action="close-sheet" aria-label="닫기">✕</button></div>';
    h += '<form id="addForm" novalidate autocomplete="off">';
    h += '<div class="field"><label for="fName">무엇을 사고 싶어요?</label><input class="input" id="fName" maxlength="40" placeholder="예) 니트 가디건" enterkeyhint="next"></div>';
    h += '<div class="field"><label for="fPrice">가격</label><div class="input-wrap"><input class="input big" id="fPrice" inputmode="numeric" placeholder="0" enterkeyhint="done"><span class="suffix">원</span></div></div>';
    h += '<div class="field"><div class="flabel" id="lCat">카테고리</div><div class="chips" role="group" aria-labelledby="lCat">';
    Object.keys(CATS).forEach(function (k) { h += '<button type="button" class="chip" data-action="pick-cat" data-v="' + k + '" aria-pressed="false">' + CATS[k].e + ' ' + CATS[k].l + '</button>'; });
    h += '</div></div>';
    h += '<div class="field"><div class="flabel" id="lRea">왜 사고 싶어졌어요? <span class="opt">(선택)</span></div><div class="chips" role="group" aria-labelledby="lRea">';
    Object.keys(REASONS).forEach(function (k) { h += '<button type="button" class="chip" data-action="pick-reason" data-v="' + k + '" aria-pressed="false">' + REASONS[k].e + ' ' + REASONS[k].l + '</button>'; });
    h += '</div></div>';
    h += '<div class="field"><label for="fUrl">링크 <span class="opt">(선택)</span></label><input class="input" id="fUrl" type="url" inputmode="url" placeholder="https://"></div>';
    h += '<div class="field"><div class="flabel" id="lCool">얼마나 참아볼까요?</div><div class="seg" role="radiogroup" aria-labelledby="lCool" style="margin:0">';
    COOL_OPTS.forEach(function (o) { h += '<button type="button" role="radio" data-action="pick-hours" data-h="' + o + '" aria-checked="' + (draft.hours === o) + '">' + o + '시간</button>'; });
    h += '</div></div>';
    h += '<button type="submit" class="btn btn-primary" id="fSubmit" disabled>⏳ 담기</button>';
    h += '<p class="cap" style="text-align:center;margin:10px 0 0">결제는 잠깐 미뤄요. 시간이 지나면 다시 물어볼게요.</p>';
    h += '</form>';
    return h;
  }

  function addValid() {
    return draft && draft.name.trim().length > 0 && Number(digits(draft.price)) > 0;
  }
  function bindAdd() {
    var f = $('#addForm'), n = $('#fName'), p = $('#fPrice'), u = $('#fUrl'), b = $('#fSubmit');
    function upd() { b.disabled = !addValid(); }
    n.addEventListener('input', function () { draft.name = n.value; upd(); });
    p.addEventListener('input', function () { formatMoneyInput(p); draft.price = p.value; upd(); });
    u.addEventListener('input', function () { draft.url = u.value; });
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); p.focus(); } });
    f.addEventListener('submit', function (e) { e.preventDefault(); submitAdd(); });
    setTimeout(function () { if (sheetOpen && sheetOpen.name === 'add' && window.matchMedia('(hover:hover)').matches) n.focus({ preventScroll: true }); }, 270);
  }

  function submitAdd() {
    if (!addValid()) return;
    var now = Date.now();
    var it = {
      id: 'i_' + now + '_' + Math.random().toString(36).slice(2, 7),
      name: draft.name.trim().slice(0, 40),
      price: Number(digits(draft.price)),
      category: draft.category || 'etc',
      reason: draft.reason || null,
      url: normUrl(draft.url),
      createdAt: now,
      endsAt: now + draft.hours * HOUR,
      status: 'cooling',
      decidedAt: null
    };
    state.items.unshift(it);
    save();
    toast(hoursLabel(draft.hours) + ' 뒤에 다시 물어볼게요 ⏳');
    cdFilter = 'cooling';
    sheetPushed = false;
    location.replace('#/cooldown');
  }

  function sheetItem(it) {
    var now = Date.now();
    var s = statusOf(it, now);
    var c = CATS[it.category];
    var created = new Date(it.createdAt);
    var meta = c.l + (it.reason ? ' · ' + REASONS[it.reason].e + ' ' + REASONS[it.reason].l : '') + ' · ' + (created.getMonth() + 1) + '/' + created.getDate() + ' 담음';
    var h = '<div class="sheet-hdr"><h2>' + (s === 'ready' ? '결정할 시간이에요' : s === 'cooling' ? '참는 중이에요' : '결정 완료') + '</h2><button class="x" data-action="close-sheet" aria-label="닫기">✕</button></div>';
    h += '<div class="detail-top"><div class="emo" aria-hidden="true">' + c.e + '</div><div class="nm">' + esc(it.name) + '</div>' +
      '<div class="pr num">' + won(it.price) + '</div><div class="meta">' + esc(meta) + '</div></div>';
    if (s === 'cooling') {
      h += '<div class="status-box cooling"><div class="cap">결정까지 남은 시간</div><div class="big" data-ends="' + it.endsAt + '">' + fmtRemain(it.endsAt - now) + '</div>' +
        '<div class="cap">기다리는 동안 마음이 정리됐다면 지금 참았다를 눌러도 돼요</div></div>';
    } else if (s === 'ready') {
      h += '<div class="status-box ready"><div class="big">⏰ 쿨다운이 끝났어요</div><div class="cap">지금도 여전히 갖고 싶은지 솔직하게 골라봐요</div></div>';
    } else {
      var dd = it.decidedAt ? new Date(it.decidedAt) : null;
      var when = dd ? (dd.getMonth() + 1) + '월 ' + dd.getDate() + '일' : '';
      h += s === 'resisted'
        ? '<div class="status-box resisted"><b>🙌 ' + when + ' 참아냈어요</b><div class="cap">저금통에 ' + won(it.price) + '이 들어있어요</div></div>'
        : '<div class="status-box bought"><b>🛒 ' + when + ' 샀어요</b><div class="cap">필요한 거였다면 잘 산 거예요 🙂</div></div>';
    }
    if (it.url) h += '<a class="btn btn-sec" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer" style="margin-bottom:12px">🔗 링크 열기</a>';
    if (s === 'cooling' || s === 'ready') {
      h += '<div class="dec">' +
        '<button class="btn btn-primary" data-action="resist" data-id="' + esc(it.id) + '">참았다 🙌</button>' +
        '<div class="btn-row"><button class="btn btn-sec" data-action="buy" data-id="' + esc(it.id) + '">샀다 🛒</button>' +
        (s === 'ready' ? '<button class="btn btn-warm" data-action="postpone" data-id="' + esc(it.id) + '">24h 더 미루기</button>' : '') +
        '</div></div>';
    }
    h += '<div class="small-actions"><button class="btn btn-ghost" data-action="delete" data-id="' + esc(it.id) + '">🗑️ 삭제</button>' +
      '<button class="btn btn-ghost" data-action="close-sheet">닫기</button></div>';
    return h;
  }

  function sheetShare() {
    var h = '<div class="sheet-hdr"><h2>' + (calM + 1) + '월 공유 카드</h2><button class="x" data-action="close-sheet" aria-label="닫기">✕</button></div>';
    h += '<div class="share-wrap"><canvas id="shareCanvas" width="1080" height="1920" role="img" aria-label="' + (calM + 1) + '월 참았지 기록 카드"></canvas></div>';
    h += '<div class="btn-row"><button class="btn btn-sec" data-action="share-save">⬇️ 이미지 저장</button><button class="btn btn-primary" data-action="share-share">📤 공유</button></div>';
    h += '<p class="cap" style="text-align:center;margin:10px 0 0">1080×1920 이미지로 저장돼요. 스토리에 딱 맞아요.</p>';
    return h;
  }

  // ---------- share card ----------
  var FONT_STACK = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitText(ctx, text, maxW, size, weight) {
    var s = size;
    do { ctx.font = weight + ' ' + s + 'px ' + FONT_STACK; s -= 4; } while (ctx.measureText(text).width > maxW && s > 20);
  }
  function drawShare() {
    var cv = $('#shareCanvas');
    if (!cv) return;
    var p = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('800 100px "Pretendard Variable"', '참았지₩0'), document.fonts.load('600 40px "Pretendard Variable"', '참았지')]).catch(function () {})
      : Promise.resolve();
    var timeout = new Promise(function (r) { setTimeout(r, 1500); });
    Promise.race([p, timeout]).then(function () { if ($('#shareCanvas') === cv) paintCard(cv); });
    paintCard(cv); // immediate paint (fallback font), repainted after font load
  }
  function paintCard(cv) {
    var ctx = cv.getContext('2d');
    var W = 1080, H = 1920;
    var ms = monthStats(calY, calM);
    var total = savedTotal();
    ctx.clearRect(0, 0, W, H);
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2BD3A6'); g.addColorStop(1, '#159A77');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(960, 180, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, 1700, 220, 0, Math.PI * 2); ctx.fill();

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    ctx.font = '800 56px ' + FONT_STACK; ctx.fillText('참았지', W / 2, 190);
    ctx.globalAlpha = 0.85; ctx.font = '600 40px ' + FONT_STACK;
    ctx.fillText(calY + '년 ' + (calM + 1) + '월의 기록', W / 2, 254); ctx.globalAlpha = 1;
    ctx.font = '230px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText('🐷', W / 2, 560);

    // white card
    var cx = 90, cy = 660, cw = W - 180, ch = 960;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#fff'; rr(ctx, cx, cy, cw, ch, 56); ctx.fill(); ctx.restore();

    ctx.fillStyle = '#6B7A72'; ctx.font = '600 44px ' + FONT_STACK;
    ctx.fillText((calM + 1) + '월에 참은 돈', W / 2, cy + 120);
    ctx.fillStyle = '#159A77';
    fitText(ctx, won(ms.resisted), cw - 100, 140, '800');
    ctx.fillText(won(ms.resisted), W / 2, cy + 270);
    ctx.fillStyle = '#1F2A24'; ctx.font = '700 46px ' + FONT_STACK;
    ctx.fillText(ms.resistedN ? '충동구매를 ' + ms.resistedN + '번 참았어요 🙌' : '천천히 시작해도 괜찮아요 🙂', W / 2, cy + 360);

    // stats row
    var cols = [
      ['참은 비율', ms.ratio == null ? '—' : Math.round(ms.ratio * 100) + '%'],
      ['무지출 데이', ms.noSpend + '일'],
      ['연속 무지출', streak() + '일']
    ];
    var colW = (cw - 80) / 3, sy = cy + 430;
    ctx.fillStyle = '#F7F8F5'; rr(ctx, cx + 40, sy, cw - 80, 200, 36); ctx.fill();
    cols.forEach(function (c, i) {
      var x = cx + 40 + colW * i + colW / 2;
      ctx.fillStyle = '#6B7A72'; ctx.font = '600 34px ' + FONT_STACK; ctx.fillText(c[0], x, sy + 76);
      ctx.fillStyle = i === 2 ? '#FF7A59' : '#1F2A24'; ctx.font = '800 60px ' + FONT_STACK; ctx.fillText(c[1], x, sy + 154);
    });

    // goal
    var gy = cy + 700;
    if (state.goal) {
      var pr = progressOf(total);
      ctx.textAlign = 'left'; ctx.fillStyle = '#1F2A24';
      fitText(ctx, '🎯 ' + state.goal.name, cw - 300, 42, '700');
      ctx.fillText('🎯 ' + state.goal.name, cx + 60, gy);
      ctx.textAlign = 'right'; ctx.fillStyle = '#159A77'; ctx.font = '800 42px ' + FONT_STACK;
      ctx.fillText(Math.floor(pr * 100) + '%', cx + cw - 60, gy);
      ctx.fillStyle = '#E6EAE7'; rr(ctx, cx + 60, gy + 34, cw - 120, 36, 18); ctx.fill();
      if (pr > 0) { ctx.fillStyle = '#22C59A'; rr(ctx, cx + 60, gy + 34, Math.max(36, (cw - 120) * pr), 36, 18); ctx.fill(); }
      ctx.textAlign = 'center'; ctx.fillStyle = '#6B7A72'; ctx.font = '600 34px ' + FONT_STACK;
      ctx.fillText('누적 ' + won(total) + ' / ' + won(state.goal.amount), W / 2, gy + 140);
    } else {
      ctx.fillStyle = '#6B7A72'; ctx.font = '600 38px ' + FONT_STACK;
      ctx.fillText('지금까지 참은 돈 누적 ' + won(total), W / 2, gy + 60);
    }
    if (ms.top.length) {
      ctx.fillStyle = '#6B7A72'; ctx.font = '600 32px ' + FONT_STACK; ctx.textAlign = 'center';
      ctx.fillText('가장 흔들린 이유: ' + REASONS[ms.top[0].k].l, W / 2, cy + ch - 50);
    }

    ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.font = '700 44px ' + FONT_STACK; ctx.fillText('사고 싶을 때, 일단 담고 하루만 참아봐요', W / 2, 1745);
    ctx.globalAlpha = 0.8; ctx.font = '600 34px ' + FONT_STACK; ctx.fillText('#참았지  #HeldIt  #무지출챌린지', W / 2, 1810); ctx.globalAlpha = 1;
  }

  function shareBlob() {
    return new Promise(function (resolve, reject) {
      var cv = $('#shareCanvas');
      if (!cv) return reject(new Error('no canvas'));
      paintCard(cv);
      if (cv.toBlob) cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('blob')); }, 'image/png');
      else reject(new Error('toBlob'));
    });
  }
  function shareFileName() { return 'chamatji-' + calY + '-' + pad(calM + 1) + '.png'; }
  function downloadBlob(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = shareFileName(); a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function doShareSave() {
    shareBlob().then(function (b) { downloadBlob(b); toast('이미지를 저장했어요 📸'); })
      .catch(function () { toast('이미지를 만들지 못했어요. 다시 시도해 주세요'); });
  }
  function doShareShare() {
    shareBlob().then(function (b) {
      var file = null;
      try { file = new File([b], shareFileName(), { type: 'image/png' }); } catch (e) { file = null; }
      var data = { files: file ? [file] : [], title: '참았지', text: (calM + 1) + '월에 참은 돈 ' + won(monthStats(calY, calM).resisted) + ' 🐷 #참았지' };
      if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        return navigator.share(data).catch(function (e) { if (e && e.name !== 'AbortError') { downloadBlob(b); toast('공유가 안 돼서 이미지로 저장했어요'); } });
      }
      downloadBlob(b);
      toast('이 브라우저는 바로 공유가 안 돼서 이미지로 저장했어요');
    }).catch(function () { toast('이미지를 만들지 못했어요. 다시 시도해 주세요'); });
  }

  // ---------- modal ----------
  function confirmModal(title, body, okLabel) {
    return new Promise(function (resolve) {
      var root = $('#modal-root');
      var prevFocus = document.activeElement;
      root.innerHTML = '<div class="modal-bg"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mTitle" aria-describedby="mBody">' +
        '<h3 id="mTitle">' + esc(title) + '</h3><p id="mBody">' + esc(body) + '</p>' +
        '<div class="btn-row"><button class="btn btn-sec" data-m="0">취소</button><button class="btn btn-danger" data-m="1">' + esc(okLabel || '확인') + '</button></div></div></div>';
      function finish(v) {
        root.innerHTML = '';
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus({ preventScroll: true }); } catch (e) { }
        resolve(v);
      }
      function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); finish(false); } }
      document.addEventListener('keydown', onKey, true);
      root.querySelector('.modal-bg').addEventListener('click', function (e) {
        var m = e.target.closest('[data-m]');
        if (m) finish(m.getAttribute('data-m') === '1');
        else if (e.target.classList.contains('modal-bg')) finish(false);
      });
      root.querySelector('[data-m="0"]').focus();
    });
  }

  // ---------- celebrate ----------
  function celebrate(it, prevTotal) {
    var total = savedTotal();
    var pPrev = progressOf(prevTotal), pNew = progressOf(total);
    var reachedNow = state.goal && pPrev < 1 && pNew >= 1;
    var root = $('#overlay-root');
    var rm = reduced();
    var h = '<div class="celebrate" role="dialog" aria-modal="true" aria-labelledby="celTitle">' +
      (rm ? '' : '<div class="coins" aria-hidden="true"><span>🪙</span><span>🪙</span><span>🪙</span></div>') +
      '<div class="cel-card"><div class="cel-pig" aria-hidden="true">🐷</div>' +
      '<h2 id="celTitle" class="num">' + won(it.price) + ' 지켰다!</h2>' +
      '<div class="cap">저금통에 쌓인 돈</div><div class="cel-total" id="celTotal">' + won(rm ? total : prevTotal) + '</div>';
    if (reachedNow) h += '<div class="goal-done">🎉 "' + esc(state.goal.name) + '" 목표 달성! 정말 대단해요</div>';
    if (state.goal) {
      h += '<div class="cel-goal"><div class="goal-row"><b>🎯 ' + esc(state.goal.name) + '</b><span class="num" id="celPct">' + Math.floor((rm ? pNew : pPrev) * 100) + '%</span></div>' +
        '<div class="bar light"><i id="celBar" style="width:' + ((rm ? pNew : pPrev) * 100).toFixed(1) + '%"></i></div></div>';
    }
    h += '<div class="tip"><b>💡 다음에 또 사고 싶어지면</b>' + esc(pick(TIPS[it.category] || TIPS.etc)) + '</div>' +
      '<button class="btn btn-primary" data-action="close-celebrate">확인</button></div></div>';
    root.innerHTML = h;
    var btn = root.querySelector('[data-action="close-celebrate"]');
    btn.focus({ preventScroll: true });
    if (!rm) {
      var start = null, dur = 600;
      var el = $('#celTotal');
      var step = function (ts) {
        if (!start) start = ts;
        var t = Math.min(1, (ts - start) / dur);
        var e = 1 - Math.pow(1 - t, 3);
        if (el && el.isConnected) el.textContent = won(prevTotal + (total - prevTotal) * e);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      requestAnimationFrame(function () {
        var bar = $('#celBar'), pct = $('#celPct');
        if (bar) bar.style.width = (pNew * 100).toFixed(1) + '%';
        if (pct) pct.textContent = Math.floor(pNew * 100) + '%';
      });
    }
  }
  function closeCelebrate() { $('#overlay-root').innerHTML = ''; }

  // ---------- onboarding ----------
  function showOnboarding() {
    var root = $('#overlay-root');
    root.innerHTML = '<div class="onb" role="dialog" aria-modal="true" aria-labelledby="onbTitle"><div class="onb-in">' +
      '<div class="onb-hero"><div class="ic" aria-hidden="true">🐷</div><h1 id="onbTitle">사고 싶을 때,<br>일단 담고 하루만 참아봐요</h1>' +
      '<p>참아낸 돈은 저금통에 차곡차곡 쌓여요.<br>로그인도, 은행 연동도 필요 없어요.</p></div>' +
      '<div class="card"><div style="font-weight:700;margin-bottom:12px">🎯 어떤 목표를 위해 모아볼까요?</div>' +
      '<div class="field"><label for="oName">목표 이름</label><input class="input" id="oName" maxlength="30" placeholder="예) 제주도 여행" autocomplete="off"></div>' +
      '<div class="field" style="margin-bottom:0"><label for="oAmt">목표 금액</label><div class="input-wrap"><input class="input num" id="oAmt" inputmode="numeric" placeholder="300,000" autocomplete="off"><span class="suffix">원</span></div></div></div>' +
      '<div class="grow"></div>' +
      '<button class="btn btn-primary" id="oStart" data-action="onb-start" disabled>시작하기</button>' +
      '<button class="btn btn-ghost" data-action="onb-skip">건너뛰기</button>' +
      '</div></div>';
    var n = $('#oName'), a = $('#oAmt'), b = $('#oStart');
    function upd() { b.disabled = !(n.value.trim() && Number(digits(a.value)) > 0); }
    n.addEventListener('input', upd);
    a.addEventListener('input', function () { formatMoneyInput(a); upd(); });
  }
  function finishOnboarding(withGoal) {
    if (withGoal) {
      var name = $('#oName').value.trim(), amt = Number(digits($('#oAmt').value));
      if (!name || !(amt > 0)) return;
      state.goal = { name: name.slice(0, 30), amount: amt };
    }
    state.settings.onboarded = true;
    save();
    $('#overlay-root').innerHTML = '';
    if (location.hash !== '#/home') location.replace('#/home'); else renderPage(true);
    toast(withGoal ? '좋아요! 같이 모아봐요 🐷' : '목표는 설정에서 언제든 정할 수 있어요');
  }

  // ---------- actions ----------
  function setDraftChip(group, v) {
    if (!draft) return;
    var key = group === 'pick-cat' ? 'category' : 'reason';
    draft[key] = draft[key] === v ? null : v;
    $$('[data-action="' + group + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === draft[key])); });
  }

  function decide(id, kind) {
    var it = findItem(id);
    if (!it) return;
    var now = Date.now();
    if (kind === 'resist') {
      var prev = savedTotal();
      it.status = 'resisted'; it.decidedAt = now;
      save(); closeSheet();
      celebrate(it, prev);
    } else if (kind === 'buy') {
      it.status = 'bought'; it.decidedAt = now;
      save(); closeSheet();
      toast('괜찮아요, 필요한 거였다면 잘 산 거예요 🙂');
    } else if (kind === 'postpone') {
      it.status = 'cooling'; it.endsAt = now + 24 * HOUR; it.decidedAt = null;
      save(); closeSheet();
      toast('좋아요, 24시간 더 기다려볼게요 ⏳');
    }
    setTimeout(function () { if (!sheetOpen) renderPage(false); }, 0);
  }

  function deleteItem(id) {
    var it = findItem(id);
    if (!it) return;
    var body = it.status === 'resisted'
      ? '"' + it.name + '"을(를) 지우면 저금통에서 ' + won(it.price) + '이 빠져요.'
      : '"' + it.name + '"을(를) 목록에서 지울게요.';
    confirmModal('삭제할까요?', body, '삭제').then(function (ok) {
      if (!ok) return;
      var wasRes = it.status === 'resisted';
      state.items = state.items.filter(function (x) { return x.id !== id; });
      save();
      closeSheet();
      toast(wasRes ? '삭제했어요. 저금통에서 ' + won(it.price) + '을 뺐어요' : '삭제했어요');
      setTimeout(function () { if (!sheetOpen) renderPage(false); }, 0);
    });
  }

  function toggleNoSpend() {
    var k = dkey();
    var on = !isNoSpend(k);
    if (on) { state.noSpendDays.push(k); state.noSpendDays.sort(); }
    else state.noSpendDays = state.noSpendDays.filter(function (x) { return x !== k; });
    save();
    renderPage(false);
    var st = streak();
    toast(on ? (st > 1 ? '오늘도 지켜냈어요! 🔥 ' + st + '일째예요' : '오늘 무지출 도장 쾅! 🐷') : '괜찮아요, 내일 다시 해봐요 🙂');
  }

  function saveGoal() {
    var name = $('#gName').value.trim(), amt = Number(digits($('#gAmt').value));
    if (!name || !(amt > 0)) return;
    state.goal = { name: name.slice(0, 30), amount: amt };
    save(); renderPage(false);
    toast('목표를 저장했어요 🎯');
  }

  function resetAll() {
    confirmModal('모든 기록을 지울까요?', '담은 물건, 저금통, 무지출 도장이 모두 사라지고 되돌릴 수 없어요.', '모두 지우기').then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (e) { }
      state = defaults();
      cdFilter = 'cooling';
      var t = new Date(); calY = t.getFullYear(); calM = t.getMonth();
      location.replace('#/home');
      renderPage(true);
      showOnboarding();
      toast('깨끗하게 초기화했어요');
    });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var a = el.getAttribute('data-action');
    var id = el.getAttribute('data-id');
    switch (a) {
      case 'open-add': e.preventDefault(); if (!sheetOpen || sheetOpen.name !== 'add') { if (sheetOpen) { sheetPushed = false; location.replace('#/add'); } else openSheetRoute('#/add'); } break;
      case 'open-item': e.preventDefault(); openSheetRoute('#/item/' + encodeURIComponent(id)); break;
      case 'open-share': e.preventDefault(); openSheetRoute('#/share'); break;
      case 'close-sheet': e.preventDefault(); closeSheet(); break;
      case 'pick-cat': case 'pick-reason': setDraftChip(a, el.getAttribute('data-v')); break;
      case 'pick-hours':
        if (!draft) break;
        draft.hours = Number(el.getAttribute('data-h'));
        $$('[data-action="pick-hours"]').forEach(function (b) { b.setAttribute('aria-checked', String(b === el)); });
        break;
      case 'resist': decide(id, 'resist'); break;
      case 'buy': decide(id, 'buy'); break;
      case 'postpone': decide(id, 'postpone'); break;
      case 'delete': deleteItem(id); break;
      case 'close-celebrate': closeCelebrate(); break;
      case 'toggle-nospend': toggleNoSpend(); break;
      case 'filter':
        cdFilter = el.getAttribute('data-f');
        history.replaceState(null, '', '#/cooldown?f=' + cdFilter);
        renderPage(false);
        break;
      case 'cal-prev': calM--; if (calM < 0) { calM = 11; calY--; } renderPage(false); break;
      case 'cal-next': {
        var t = new Date();
        if (calY < t.getFullYear() || (calY === t.getFullYear() && calM < t.getMonth())) { calM++; if (calM > 11) { calM = 0; calY++; } renderPage(false); }
        break;
      }
      case 'save-goal': saveGoal(); break;
      case 'clear-goal': state.goal = null; save(); renderPage(false); toast('목표 없이 저금통만 쌓을게요'); break;
      case 'set-default-cool':
        state.settings.defaultCooldownHours = Number(el.getAttribute('data-h'));
        save();
        $$('[data-action="set-default-cool"]').forEach(function (b) { b.setAttribute('aria-checked', String(b === el)); });
        toast('이제 기본 ' + el.getAttribute('data-h') + '시간 동안 참아볼게요');
        break;
      case 'reset': resetAll(); break;
      case 'share-save': doShareSave(); break;
      case 'share-share': doShareShare(); break;
      case 'onb-start': finishOnboarding(true); break;
      case 'onb-skip': finishOnboarding(false); break;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#modal-root').firstChild) return;
    if ($('.celebrate')) { closeCelebrate(); return; }
    if (sheetOpen) closeSheet();
  });

  // ---------- ticker ----------
  var lastReady = -1, lastDay = dkey();
  function tick(force) {
    var now = Date.now();
    $$('[data-ends]').forEach(function (el) {
      var t = fmtRemain(Number(el.getAttribute('data-ends')) - now);
      if (el.textContent !== t) el.textContent = t;
    });
    if (force === true) { lastReady = byStatus('ready').length; return; }
    var r = byStatus('ready').length;
    var day = dkey();
    if (r !== lastReady || day !== lastDay) {
      lastReady = r; lastDay = day;
      if (baseRoute !== 'settings') renderPage(false);
      else updateBadge();
      if (sheetOpen && sheetOpen.name === 'item' && findItem(sheetOpen.arg)) showSheet('item', sheetOpen.arg);
    }
  }
  setInterval(tick, 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });

  // ---------- boot ----------
  window.addEventListener('hashchange', onRoute);
  if (!location.hash || location.hash === '#' || location.hash === '#/') history.replaceState(null, '', '#/home');
  onRoute();
  if (!state.settings.onboarded) showOnboarding();
  if (loadNotice) setTimeout(function () { toast(loadNotice); }, 300);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { }); });
  }
})();
