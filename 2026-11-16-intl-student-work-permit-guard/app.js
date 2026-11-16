/* 알바 허가 지킴이 — UI */
(() => {
  'use strict';
  const E = window.WPGEngine; const KEY = 'wpg.v1'; const APP = '알바 허가 지킴이';
  const LANGS = ['ko', 'en', 'vi', 'zh', 'uz']; const MT = { vi: 1, zh: 1, uz: 1 };
  const HTMLLANG = { ko: 'ko', en: 'en', vi: 'vi', zh: 'zh-Hans', uz: 'uz-Latn' };
  const S = { ready: false, D: {}, I: {}, lang: 'ko', st: null, step: 1, draft: null };
  window.__wpg = S; S.engine = E;
  const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- i18n ---------- */
  function raw(lang, k) { const d = S.I[lang]; return d && d[k] != null ? d[k] : null; }
  function fill(s, p) { return String(s).replace(/\{(\w+)\}/g, (_, x) => p && p[x] != null ? p[x] : ''); }
  function t(k, p) { const s = raw(S.lang, k) ?? raw('en', k) ?? raw('ko', k) ?? k; return fill(s, p); }
  function tk(k, p) { return fill(raw('ko', k) ?? k, p); }
  function dual(k, p) { return esc(t(k, p)) + (S.lang !== 'ko' ? `<span class="ko" lang="ko">${esc(tk(k, p))}</span>` : ''); }
  function dowName(i) { return t('dow_' + E.DOW[i]); }
  function H(m) { return E.fmtH(m); }

  /* ---------- 저장 ---------- */
  function blank() { return { v: 1, lang: null, profile: null, school: { presetId: null, vacations: [], expiredTopik: 'unknown', certified: null, src: null }, workplaces: [], shifts: [], skips: [], wage: { hourly: null, weekly: null, year: 2026 } }; }
  function load() { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1) return Object.assign(blank(), o); } catch (e) { /* 손상 시 새로 */ } return blank(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S.st)); } catch (e) { toast(t('err_save')); } }

  /* ---------- 공통 UI ---------- */
  function toast(m) { const e = $('#toast'); e.textContent = m; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 2200); }
  function dialog(title, bodyHtml, okText, noText) {
    return new Promise(res => { const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-b').innerHTML = bodyHtml; $('#dlg-ok').textContent = okText || t('ok'); const no = $('#dlg-no'); no.textContent = noText || t('cancel'); no.hidden = noText === false;
      d.returnValue = ''; d.onclose = () => res(d.returnValue === 'ok'); d.showModal(); });
  }
  const STATUS = { verified: ['verified', '✔', 'vb_verified'], gov: ['gov', '🏛', 'vb_gov'], school: ['school', '🏫', 'vb_school'], check: ['check', '?', 'vb_check'], secondary: ['secondary', '📰', 'vb_secondary'], press: ['secondary', '📰', 'vb_secondary'] };
  function vb(status) { const [c, i, k] = STATUS[status] || STATUS.check; return `<span class="vb vb-${c}"><span aria-hidden="true">${i}</span>${esc(t(k))}</span>`; }
  function legendSrc() { return `<div class="legend" aria-label="${esc(t('legend_src'))}">${['verified', 'gov', 'school', 'secondary', 'check'].map(vb).join('')}</div>`; }
  function src(key, status) {
    const s = S.D.sources.sources[key]; if (!s) return '';
    const st = status || (s.kind === 'primary' ? 'verified' : s.kind === 'gov' ? 'gov' : s.kind === 'school' ? 'school' : (s.kind === 'secondary' || s.kind === 'press') ? 'secondary' : 'check');
    return `<span class="srcline"><button type="button" class="src" data-src="${esc(key)}">ⓘ ${esc(s.short || s.org)} · ${esc(t('asof'))} <span class="num">${esc(shortAsOf(s.asOf))}</span><span class="sr-only"> — ${esc(t('src_open'))}: ${esc(s.org)}, ${esc(s.asOf)}</span></button>${vb(st)}</span>`;
  }
  function shortAsOf(a) { const m = /\d{4}-\d{2}(-\d{2})?/.exec(a || ''); return m ? m[0] : '확인 필요'; }
  function showSrc(key) {
    const s = S.D.sources.sources[key];
    dialog(s.org, `<p><b>${esc(s.title)}</b></p><p class="small">${esc(t('asof'))}: ${esc(s.asOf)}</p><p>${esc(s.used)}</p><p><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(t('src_link'))}</a></p>`, t('close'), false);
  }
  const SIGI = { ok: ['s-ok', '✓', 'sig_ok'], ban: ['s-stop', '⛔', 'sig_ban'], restricted: ['s-rst', '🚫', 'sig_restricted'], conditional: ['s-warn', '⚠', 'sig_conditional'], unknown: ['s-chk', '?', 'sig_unknown'] };
  function sig(signal) { const [c, i, k] = SIGI[signal] || SIGI.unknown; return `<span class="sig ${c}"><span aria-hidden="true">${i}</span>${esc(t(k))}</span>`; }
  const SEVI = { stop: ['s-stop', '⛔'], warn: ['s-warn', '⚠'], check: ['s-chk', '?'], info: ['s-info', 'ℹ'] };
  function legendStatus() {
    return `<div class="legend" aria-label="${esc(t('legend'))}"><span class="lg s-ok">✓ ${esc(t('lg_ok'))}</span><span class="lg s-warn">⚠ ${esc(t('lg_warn'))}</span><span class="lg s-stop">⛔ ${esc(t('lg_stop'))}</span><span class="lg s-rst">🚫 ${esc(t('lg_rst'))}</span><span class="lg s-chk">? ${esc(t('lg_chk'))}</span><span class="lg s-unl">∞ ${esc(t('lg_unl'))}</span><span class="lg s-info">ℹ ${esc(t('lg_info'))}</span></div>`;
  }
  function legendDays() { return `<div class="legend"><span class="lg day">${esc(t('dt_weekday'))}</span><span class="lg day d-weekend">${esc(t('dt_weekend'))}</span><span class="lg day d-holiday">🎌 ${esc(t('dt_holiday'))}</span><span class="lg day d-vacation">🏖 ${esc(t('dt_vacation'))}</span></div>`; }
  function setTitle(k) { document.title = t('title_' + k) + ' — ' + t('app'); }
  function page(titleKey, html) { const v = $('#view'); v.innerHTML = html; setTitle(titleKey); }

  /* ---------- 데이터 로드 ---------- */
  async function getJSON(p) { const r = await fetch(p); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }
  async function loadLang(l) { if (!S.I[l]) S.I[l] = await getJSON('i18n/' + l + '.json'); }
  async function boot() {
    S.st = load();
    try {
      const [rules, industries, holidays, schools, sources] = await Promise.all(['rules', 'industries', 'holidays', 'schools', 'sources'].map(n => getJSON('data/' + n + '.json')));
      S.D = { rules, industries, holidays, schools, sources };
      await loadLang('ko'); await loadLang('en');
      const pref = S.st.lang || (navigator.language || 'ko').slice(0, 2); S.lang = LANGS.includes(pref) ? pref : 'ko';
      await loadLang(S.lang);
    } catch (e) {
      page('error', `<h1>${'앱 데이터를 불러오지 못했어요'}</h1><p>Could not load app data. 네트워크를 확인하고 다시 시도해 주세요.</p><button class="btn" id="reload" type="button">다시 불러오기 · Reload</button>`); document.title = '불러오기 오류 — ' + APP;
      $('#reload').onclick = () => location.reload(); return;
    }
    const sp = new URLSearchParams(location.search).get('school');
    if (sp && S.D.schools.schools.some(s => s.id === sp) && S.st.school.presetId !== sp) { applySchool(sp); save(); S.schoolFromUrl = sp; }
    $('#lang').value = S.lang; $('#lang').onchange = e => setLang(e.target.value);
    document.addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (b) { e.preventDefault(); showSrc(b.dataset.src); } });
    window.addEventListener('hashchange', route);
    chrome(); route(); fitFixed();
    if (window.ResizeObserver) { const ro = new ResizeObserver(fitFixed); ro.observe($('#final')); ro.observe($('.tabs')); ro.observe($('.top')); }
    window.addEventListener('resize', fitFixed); S.ready = true;
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  async function setLang(l) { if (!LANGS.includes(l)) return; await loadLang(l); S.lang = l; S.st.lang = l; save(); $('#lang').value = l; chrome(); route(); fitFixed(); }
  function chrome() {
    document.documentElement.lang = HTMLLANG[S.lang];
    $$('.tabs .tl').forEach(e => e.textContent = t(e.dataset.k));
    $('#tl-export').textContent = t('tab_export');
    $('.bname').textContent = t('app_short'); $('.brand').setAttribute('aria-label', t('app') + ' — ' + t('tab_home'));
    $('#foot-disc').textContent = t('foot_disc'); $('#foot-priv').textContent = t('foot_priv');
    const mt = $('#mt'); mt.hidden = !MT[S.lang]; const cmp = !!S.st.mtCompact; mt.classList.toggle('compact', cmp);
    mt.innerHTML = MT[S.lang] ? `<span class="mtx">⚙ ${cmp ? esc(t('mt_short')) : esc(t('mt_banner')) + ' <span lang="ko">(기계 번역 · 원어민 검수 필요)</span>'}</span><button type="button" class="mtb" id="mtb" aria-expanded="${!cmp}">${esc(t(cmp ? 'mt_more' : 'mt_less'))}</button>` : '';
    const mb = $('#mtb'); if (mb) mb.onclick = () => { S.st.mtCompact = !S.st.mtCompact; save(); chrome(); fitFixed(); };
    $('#final-tr').textContent = S.lang === 'ko' ? '' : t('final'); $('#final-tr').hidden = S.lang === 'ko';
    $('.tabs').setAttribute('aria-label', t('nav_main'));
  }
  function fitFixed() {
    const f = $('#final'), top = $('.top'); if (!f) return;
    const b = Math.max(0, Math.ceil(innerHeight - f.getBoundingClientRect().top)); const h = top ? Math.ceil(top.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--fixed-b', b + 'px'); document.documentElement.style.setProperty('--fixed-t', (h + 8) + 'px');
  }
  function applySchool(id) {
    const sc = S.D.schools.schools.find(s => s.id === id); if (!sc) return;
    Object.assign(S.st.school, { presetId: id, expiredTopik: sc.expiredTopik, certified: sc.certified, src: sc.src });
  }

  /* ---------- 라우팅 ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, ''); const [r, a] = h.split('/');
    $$('.tabs a').forEach(x => x.removeAttribute('aria-current'));
    const tab = { '': 'home', dash: 'home', limit: 'home', q: 'home', work: 'work', todo: 'todo', rules: 'rules' }[r] || null; if (tab) $(`.tabs a[data-tab="${tab}"]`).setAttribute('aria-current', 'page');
    try {
      if (r === 'q') return wizard(Math.min(6, Math.max(1, Number(a) || 1)));
      if (r === 'limit') return S.st.profile ? limitView() : landing();
      if (r === 'work') return workView();
      if (r === 'todo') return todoView();
      if (r === 'rules') return rulesView();
      if (r === 'export') return exportView();
      return S.st.profile ? dashView() : landing();
    } finally { window.scrollTo(0, 0); const v = $('#view'); if (route.n++) v.focus({ preventScroll: true }); }
  }
  route.n = 0;
  function limit() { return E.computeLimit(S.st.profile || {}, S.D.rules, today()); }

  /* ---------- S0 첫 화면 ---------- */
  function landing() {
    const R = S.D.rules;
    page('home', `<section class="card hero"><h1>${esc(t('app'))}</h1><p>${esc(t('hero_line'))}</p>
      <div class="langs" role="group" aria-label="Language / 언어">${LANGS.map(l => `<button type="button" data-lang="${l}" aria-pressed="${l === S.lang}" lang="${HTMLLANG[l]}">${esc(raw(l, 'lang_name') || { ko: '한국어', en: 'English', vi: 'Tiếng Việt', zh: '简体中文', uz: 'O‘zbekcha' }[l])}</button>`).join('')}</div>
      <p>🔒 ${esc(t('hero_local'))}</p>
      <div class="stack"><a class="btn block" href="#/q/1" id="start">${esc(t('start'))}</a></div></section>
      <section class="preview" aria-label="${esc(t('preview_label'))}"><p class="small">${esc(t('preview_label'))}</p>
       <p><b>${esc(t('ex_profile'))}</b></p><p class="big"><span class="num">25</span><small> ${esc(t('h_weekday'))}</small></p>
       <div class="chips"><span class="chip s-unl">∞ ${esc(t('unl_on'))}</span><span class="chip s-info">🏢 ${esc(t('places_n', { n: 2 }))}</span></div>
       ${src('moj_manual')}</section>
      <section class="card"><h2>${esc(t('why_h'))}</h2><p>${dual('one_strike', { from: R.oneStrike.from })}</p>${src('moj_hist')}
       <p class="small">${esc(t('why_steps'))}</p></section>`);
    $$('[data-lang]').forEach(b => b.onclick = () => setLang(b.dataset.lang));
  }

  /* ---------- S1 6문항 ---------- */
  function draft() { if (!S.draft) S.draft = JSON.parse(JSON.stringify(S.st.profile || { visa: null, program: null, year: null, lang: null, bonus: null, entryDate: null, gpa: null, attendance: null })); return S.draft; }
  function choice(val, cur, label, sub) { return `<button type="button" class="choice" data-v="${esc(val)}" aria-pressed="${String(cur) === String(val)}"><span class="cl"><span class="ct">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span aria-hidden="true">${String(cur) === String(val) ? '●' : '○'}</span></button>`; }
  function wizard(n) {
    const d = draft(); S.step = n;
    const head = (k, sub) => `<p class="small">${esc(t('q_step', { n, total: 6 }))}</p><div class="prog" role="progressbar" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${n}" aria-label="${esc(t('q_step', { n, total: 6 }))}"><i style="width:${n / 6 * 100}%"></i></div><h1 id="qh">${esc(t(k))}</h1>${sub ? `<p class="small">${esc(sub)}</p>` : ''}`;
    const nav = (canNext) => `<div class="actions"><a class="btn ghost" href="#/${n === 1 ? '' : 'q/' + (n - 1)}">${esc(t('back'))}</a><button type="button" class="btn" id="next" ${canNext ? '' : 'aria-disabled="true"'}>${esc(n === 6 ? t('see_limit') : t('next'))}</button></div><p class="err" id="qerr" hidden>${esc(t('q_pick'))}</p>`;
    let body = '';
    if (n === 1) body = head('q1') + `<div class="choices" role="group" aria-labelledby="qh">${choice('D-2', d.visa, t('v_d2'), t('v_d2_s'))}${choice('D-4', d.visa, t('v_d4'), t('v_d4_s'))}${choice('thesis', d.visa, t('v_thesis'), t('v_thesis_s'))}</div>` + nav(!!d.visa);
    if (n === 2) {
      if (d.visa === 'D-4') { d.program = 'language'; body = head('q2', t('q2_d4')) + nav(true); }
      else { const opts = d.visa === 'thesis' ? ['master', 'doctor'] : ['associate', 'bachelor', 'master', 'doctor']; body = head('q2') + `<div class="choices" role="group" aria-labelledby="qh">${opts.map(o => choice(o, d.program, t('p_' + o))).join('')}</div>` + nav(!!d.program); }
    }
    if (n === 3) {
      if (d.program !== 'bachelor') { d.year = null; body = head('q3', t('q3_skip')) + nav(true); }
      else body = head('q3') + `<div class="choices" role="group" aria-labelledby="qh">${[1, 2, 3, 4].map(y => choice(y, d.year, t('year_n', { n: y }))).join('')}${choice('unknown', d.year, t('unknown'), t('unknown_low'))}</div>` + nav(d.year != null);
    }
    if (n === 4) {
      if (d.visa === 'thesis') body = head('q4', t('q4_thesis')) + nav(true);
      else {
        const L = d.lang || {}; const types = ['topik', 'kiip', 'kiipPre', 'sejong'].concat(d.visa === 'D-2' ? ['english'] : []).concat(['none', 'unknown']);
        let val = '';
        if (L.type === 'topik') val = `<p class="f" id="tl">${esc(t('topik_lv'))}</p><div class="grid6" role="group" aria-labelledby="tl">${[1, 2, 3, 4, 5, 6].map(x => `<button type="button" class="choice" data-lv="${x}" aria-pressed="${L.value == x}">${x}</button>`).join('')}</div>`;
        if (L.type === 'kiip') val = `<p class="f" id="tl">${esc(t('kiip_lv'))}</p><div class="grid6" role="group" aria-labelledby="tl">${[0, 1, 2, 3, 4, 5].map(x => `<button type="button" class="choice" data-lv="${x}" aria-pressed="${L.value == x}">${x}</button>`).join('')}</div><label class="check"><input type="checkbox" id="kfinal" ${L.kiipFinal ? 'checked' : ''}>${esc(t('kiip_final'))}</label>`;
        if (L.type === 'kiipPre') val = `<label class="f" for="kpre">${esc(t('kiip_pre'))}</label><input id="kpre" type="number" inputmode="numeric" min="0" max="100" value="${esc(L.value ?? '')}">`;
        if (L.type === 'sejong') val = `<label class="f" for="sj">${esc(t('sejong_lv'))}</label><select id="sj">${['none', 'beginner1', 'beginner2', 'intermediate1', 'intermediate2', 'advanced'].map(x => `<option value="${x}" ${L.value === x ? 'selected' : ''}>${esc(t('sj_' + x))}</option>`).join('')}</select>`;
        body = head('q4', t('q4_sub')) + `<div class="choices" role="group" aria-labelledby="qh">${types.map(x => choice(x, L.type, t('lt_' + x), x === 'unknown' ? t('unknown_low') : (x === 'english' ? t('lt_english_s') : ''))).join('')}</div>${val}` + nav(!!L.type);
      }
    }
    if (n === 5) {
      const lim = E.computeLimit(Object.assign({}, d, { bonus: [] }), S.D.rules, today());
      if (d.visa === 'thesis' || !lim.met) body = head('q5', d.visa === 'thesis' ? t('q5_thesis') : t('q5_notmet')) + nav(true);
      else {
        const B = Array.isArray(d.bonus) ? d.bonus : []; const lv = E.langLevel(d.lang, S.D.rules);
        body = head('q5', t('q5_sub')) + `<div class="card">${lv.excellent ? `<p class="chip s-ok">✓ ${esc(t('bonus_auto'))}</p>` : ''}
          <label class="check"><input type="checkbox" data-b="certified" ${B.includes('certified') ? 'checked' : ''}>${esc(t('b_certified'))}</label>
          <label class="check"><input type="checkbox" data-b="gradeA" ${B.includes('gradeA') ? 'checked' : ''}>${esc(t('b_gradeA'))}</label></div>
          <div class="choices">${choice('none', d.bonus === 'none' || (Array.isArray(d.bonus) && !d.bonus.length) ? 'none' : '', t('b_none'))}${choice('unknown', d.bonus === 'unknown' ? 'unknown' : '', t('unknown'), t('unknown_low'))}</div>
          ${src('moj_manual')}` + nav(d.bonus != null);
      }
    }
    if (n === 6) {
      if (d.visa === 'D-4') body = head('q6_d4', t('q6_d4_sub')) + `<label class="f" for="entry">${esc(t('entry_date'))}</label><input type="date" id="entry" value="${esc(E.isYmd(d.entryDate) ? d.entryDate : '')}" max="${today()}">
        <label class="check"><input type="checkbox" id="entryUnknown" ${d.entryDate === 'unknown' ? 'checked' : ''}>${esc(t('unknown'))} — ${esc(t('unknown_low'))}</label>
        <label class="f" for="att">${esc(t('attendance'))}</label><input type="number" id="att" inputmode="decimal" min="0" max="100" step="0.1" value="${esc(d.attendance ?? '')}">` + nav(true);
      else body = head('q6_gpa', t('q6_gpa_sub')) + `<label class="f" for="gpa">${esc(t('gpa'))}</label><input type="number" id="gpa" inputmode="decimal" min="0" max="4.5" step="0.01" value="${esc(typeof d.gpa === 'number' ? d.gpa : '')}">
        <label class="check"><input type="checkbox" id="gpaFirst" ${d.gpa === 'first' ? 'checked' : ''}>${esc(t('gpa_first'))}</label>` + nav(true);
    }
    page('q' + n, body);
    // 이벤트
    $$('.choices .choice').forEach(b => b.onclick = () => {
      const v = b.dataset.v;
      if (n === 1) { if (d.visa !== v) { d.program = null; d.year = null; d.lang = null; d.bonus = null; } d.visa = v; }
      if (n === 2) d.program = v;
      if (n === 3) d.year = v === 'unknown' ? 'unknown' : Number(v);
      if (n === 4) d.lang = { type: v, value: null };
      if (n === 5) d.bonus = v;
      wizard(n); const f = $(`.choice[data-v="${CSS.escape(v)}"]`); if (f) f.focus();
    });
    $$('[data-lv]').forEach(b => b.onclick = () => { d.lang.value = Number(b.dataset.lv); wizard(n); $(`[data-lv="${b.dataset.lv}"]`).focus(); });
    $$('[data-b]').forEach(c => c.onchange = () => { const B = new Set(Array.isArray(d.bonus) ? d.bonus : []); c.checked ? B.add(c.dataset.b) : B.delete(c.dataset.b); d.bonus = [...B]; wizard(n); $(`[data-b="${c.dataset.b}"]`).focus(); });
    $('#next').onclick = () => {
      if (n === 4 && d.lang) { if (d.lang.type === 'kiipPre') d.lang.value = Number($('#kpre').value) || 0; if (d.lang.type === 'sejong') d.lang.value = $('#sj').value; if (d.lang.type === 'kiip') d.lang.kiipFinal = $('#kfinal').checked; }
      if (n === 4 && d.lang && ['topik', 'kiip'].includes(d.lang.type) && d.lang.value == null) { $('#qerr').hidden = false; return; }
      if (n === 5 && d.bonus === 'none') d.bonus = [];
      if (n === 5 && d.visa !== 'thesis' && d.bonus == null && E.computeLimit(Object.assign({}, d, { bonus: [] }), S.D.rules, today()).met) { $('#qerr').hidden = false; return; }
      if (n === 6) {
        if (d.visa === 'D-4') { d.entryDate = $('#entryUnknown').checked ? 'unknown' : ($('#entry').value || null); const a = parseFloat($('#att').value); d.attendance = isNaN(a) ? null : a; if (!d.entryDate) { $('#qerr').textContent = t('q_date'); $('#qerr').hidden = false; $('#entry').focus(); return; } }
        else { const g = parseFloat($('#gpa').value); d.gpa = $('#gpaFirst').checked ? 'first' : (isNaN(g) ? null : g); }
        if (d.visa !== 'D-4') { d.entryDate = null; }
        if (d.bonus == null) d.bonus = [];
        const keep = S.st.profile || {}; S.st.profile = Object.assign({}, d, { visaExpiry: keep.visaExpiry || null, topikExpiry: keep.topikExpiry || null }); S.draft = null; save(); location.hash = '#/limit'; return;
      }
      if ($('#next').getAttribute('aria-disabled') === 'true') { $('#qerr').hidden = false; return; }
      location.hash = '#/q/' + (n + 1);
    };
  }

  /* ---------- S2 내 한도 카드 ---------- */
  function limitBlock(L, compact) {
    const R = S.D.rules; const st = L.status;
    let big;
    if (L.visa === 'D-4' && !L.eligibleNow) big = `<p class="big" style="font-size:30px">${esc(t('d4_not_yet'))}</p><p><b>${L.eligibleFrom ? esc(t('d4_from', { date: L.eligibleFrom })) : esc(t('d4_need_date'))}</b></p>${src('moj_manual')}<p class="small">${esc(t('d4_after', { n: L.totalCap }))}</p>`;
    else if (L.unlimited) big = `<p class="big"><span class="num">${L.weekdayCap}</span><small> ${esc(t('h_weekday'))}</small></p>${src(L.src, st)}<div class="chips"><span class="chip s-unl">∞ ${esc(t('unl_on'))}</span></div>`;
    else big = `<p class="big"><span class="num">${L.totalCap}</span><small> ${esc(t('h_total'))}</small></p>${src(L.src, st)}<div class="chips"><span class="chip s-chk">✕ ${esc(t('unl_off'))}</span></div>`;
    const placeSrc = src('moj_manual');
    const badges = L.unknown.map(u => `<span class="chip s-chk">? ${esc(t('unk_' + u))}</span>`).join('');
    return `${big}<div class="chips"><span class="chip s-info">🏢 ${esc(t('places_n', { n: L.maxPlaces }))}</span><span class="chip s-info">📅 ${esc(t('permit_max', { n: L.permitMaxMonths }))}</span></div>${placeSrc}
      ${L.bonus ? `<p class="chip s-ok">✓ ${esc(t('bonus_applied'))}</p>` : ''}
      ${!L.met && L.visa !== 'thesis' ? `<p class="small">${esc(t('notmet_why', { lv: L.req }))}</p>` : ''}
      ${L.visa === 'thesis' ? `<p class="small">${esc(t('thesis_note'))}</p>` : ''}
      ${L.visa === 'D-4' ? `<p class="small">${esc(t('d4_note'))}</p>` : ''}
      ${badges ? `<div class="chips">${badges}</div>` : ''}
      ${compact ? '' : `<p class="chip s-chk">🏫 ${esc(t('school_diff'))}</p>`}`;
  }
  function limitView() {
    const L = limit();
    page('limit', `<h1>${esc(t('my_limit'))}</h1><section class="card limit" id="limitcard">${limitBlock(L)}</section><details class="card"><summary class="btn ghost sm">${esc(t('legend_src'))}</summary>${legendSrc()}${legendStatus()}</details>
      <div class="stack"><a class="btn block" href="#/work" id="to-work">${esc(t('to_work'))}</a><a class="btn ghost block" href="#/q/1">${esc(t('redo'))}</a></div>
      <section class="card"><h2>${esc(t('vac_h'))}</h2><p>${esc(L.unlimited ? t('vac_unl') : t('vac_lim'))}</p></section>`);
  }

  /* ---------- S6 대시보드 ---------- */
  function weeksNow(n) { const L = limit(); return { L, weeks: E.aggregate(S.st, L, S.D.holidays, E.weekKey(today()), n || 5) }; }
  function meter(w) { if (w.capMins == null) return ''; const pct = Math.min(100, w.capMins ? w.countedMins / w.capMins * 100 : 0); return `<div class="meter" role="img" aria-label="${esc(t('meter_aria', { used: H(w.countedMins), cap: H(w.capMins) }))}"><i class="${w.status}" style="width:${pct}%"></i></div>`; }
  function stChip(s) { const m = { ok: ['s-ok', '✓', 'wk_ok'], warn: ['s-warn', '⚠', 'wk_near'], stop: ['s-stop', '⛔', 'wk_over'] }[s]; return `<span class="chip ${m[0]}">${m[1]} ${esc(t(m[2]))}</span>`; }
  function wParams(w) { const p = Object.assign({}, w.params); if (p.counted != null) { p.counted = H(p.counted); p.cap = H(p.cap); } if (p.mins != null) { p.mins = H(p.mins); p.cap = H(p.cap); } return p; }
  function overList(w) { return (w.params.weeks || []).map(x => `${x.week.slice(5)}~ ${H(x.counted)}/${H(x.cap)}h`); }
  function warnHtml(w) {
    const p = wParams(w);
    const wk = w.id === 'over' ? `<span class="small">${esc(t('over_weeks'))}</span><span class="wkl">${overList(w).map(x => `<span class="kw num">${esc(x)}</span>`).join('')}</span>` : '';
    const [c, i] = SEVI[w.sev]; return `<li class="${c}" data-w="${esc(w.id)}"><b><span aria-hidden="true">${i}</span> ${dual('w_' + w.id, p)}</b>${wk}<span class="small">${esc(t('wd_' + w.id, p))}</span>${src(w.src, w.status)}</li>`;
  }
  function dashView() {
    const { L, weeks } = weeksNow(5); const W = E.warnings(S.st, L, S.D.rules, S.D.industries, weeks, today()); const w0 = weeks[0];
    const has = S.st.workplaces.length && S.st.shifts.length;
    const capLabel = L.unlimited ? t('h_weekday') : t('h_total');
    const sug = weeks.flatMap(w => E.suggest(w, L).map(s => Object.assign(s, { week: w.week }))).slice(0, 3);
    page('dash', `<h1>${esc(t('dash_h'))}</h1>
      <section class="card limit"><h2>${esc(t('my_limit'))}</h2>${limitBlock(L, true)}<a class="btn ghost sm" href="#/limit">${esc(t('detail'))}</a></section>
      ${!has ? `<section class="card" id="empty"><h2>${esc(t('empty_h'))}</h2><p>${esc(t('empty_p'))}</p><div class="stack"><a class="btn block" href="#/work">${esc(t('to_work'))}</a><button type="button" class="btn ghost block" id="sample">${esc(t('sample'))}</button></div></section>` : `
      <section class="card" id="thisweek"><h2>${esc(t('this_week'))} <span class="num small">${w0.week} ~ ${w0.end}</span></h2>
        ${w0.capMins == null ? `<p>${esc(t('no_cap'))}</p>` : `<p class="big" style="font-size:34px"><span class="num">${H(w0.countedMins)} / ${H(w0.capMins)}</span><small> h</small></p><p class="small">${esc(capLabel)} · ${esc(t('left', { h: H(Math.max(0, w0.capMins - w0.countedMins)) }))}</p>${meter(w0)}${stChip(w0.status)}`}
        ${L.unlimited ? `<p class="small">${esc(t('other_h', { h: H(w0.otherMins) }))}</p>` : ''}
        <div class="days" aria-label="${esc(t('week_days'))}">${w0.days.map(d => `<div class="day d-${d.type}"><b>${esc(dowName(E.dowIdx(d.date)))}</b><span class="num">${d.date.slice(5)}</span><br><span class="num">${d.mins ? H(d.mins) + 'h' : '–'}</span>${d.holiday ? '<br>🎌' : d.type === 'vacation' ? '<br>🏖' : ''}</div>`).join('')}</div>${legendDays()}</section>
      <section class="card"><h2>${esc(t('next_weeks'))}</h2>${weeks.map(w => `<div class="wk"><span class="num">${w.week.slice(5)}~</span>${w.capMins == null ? '<span></span>' : meter(w)}<span class="num">${H(w.countedMins)}${w.capMins != null ? '/' + H(w.capMins) : ''}h ${{ ok: '✓', warn: '⚠', stop: '⛔' }[w.status]}</span></div>`).join('')}${legendStatus()}</section>
      ${sug.length ? `<section class="card" id="sug"><h2>${esc(t('sug_h'))}</h2><ul class="wlist">${sug.map(s => `<li class="s-info">${esc(s.kind === 'move' ? t(s.fixes ? 'sug_move' : 'sug_move_part', { week: s.week.slice(5), dow: dowName(s.dow), from: hmS(s.from), to: hmS(s.to), toDow: dowName(s.toDow), toType: t('dt_' + s.toType), h: H(s.mins) }) : (s.dow != null ? t('sug_cut_at', { week: s.week.slice(5), h: H(s.mins), dow: dowName(s.dow), from: hmS(s.from), to: hmS(s.to) }) : t('sug_cut', { week: s.week.slice(5), h: H(s.mins) })))}</li>`).join('')}</ul></section>` : ''}`}
      <section class="card" id="warns"><h2>${esc(t('warn_h'))} <span class="num">(${W.length})</span></h2>${W.length ? `<ul class="wlist">${W.map(warnHtml).join('')}</ul>` : `<p class="chip s-ok">✓ ${esc(t('no_warn'))}</p>`}${legendStatus()}<p class="small">${esc(t('legend_src'))}</p>${legendSrc()}</section>`);
    const sb = $('#sample'); if (sb) sb.onclick = fillSample;
  }
  const hmS = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  function fillSample() {
    const st = S.st; const td = today(); const mon = E.weekKey(td);
    st.workplaces = [{ id: 'w1', name: t('sample_wp1'), industry: '휴게음식점 커피전문점', permitted: true, permitFrom: E.addDays(mon, -30), permitTo: E.addDays(mon, 300), permitHours: null, commuteMin: 20, startOn: E.addDays(mon, -30), changedOn: null, reportedOn: null }];
    st.shifts = [{ wpId: 'w1', dow: 0, start: '18:00', end: '22:00' }, { wpId: 'w1', dow: 2, start: '18:00', end: '22:00' }, { wpId: 'w1', dow: 3, start: '17:00', end: '23:00' }, { wpId: 'w1', dow: 4, start: '18:00', end: '23:00' }, { wpId: 'w1', dow: 5, start: '10:00', end: '18:00' }];
    save(); toast(t('sample_done')); dashView();
  }

  /* ---------- S3~S5 근무표 ---------- */
  function workView() {
    const st = S.st; const L = limit(); const lv = E.langLevel((st.profile || {}).lang, S.D.rules); const sc = st.school;
    const preset = S.D.schools.schools.find(s => s.id === sc.presetId);
    const wpOpts = st.workplaces.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('');
    page('work', `<h1>${esc(t('work_h'))}</h1>
      ${!st.profile ? `<p class="chip s-chk">? ${esc(t('need_profile'))}</p> <a class="btn sm" href="#/q/1">${esc(t('start'))}</a>` : ''}
      <section class="card" id="school"><h2>${esc(t('school_h'))}</h2>
        <label class="f" for="preset">${esc(t('school_preset'))}</label><select id="preset"><option value="">${esc(t('choose'))}</option>${S.D.schools.schools.map(s => `<option value="${s.id}" ${s.id === sc.presetId ? 'selected' : ''}>${esc(s.id === 'custom' ? t('custom') : s.name)}</option>`).join('')}</select>
        ${preset && preset.id !== 'custom' ? `<dl class="kv"><dt>${esc(t('expired_topik'))}</dt><dd>${esc(t('et_' + preset.expiredTopik))}</dd><dt>${esc(t('certified'))}</dt><dd>${esc(preset.certified === true ? t('yes_school') : t('check_needed'))}</dd></dl>${src(preset.src, 'school')}<p class="small">${esc(preset.note)}</p>` : `<label class="f" for="etopik">${esc(t('expired_topik'))}</label><select id="etopik">${['unknown', 'accepted', 'rejected'].map(x => `<option value="${x}" ${sc.expiredTopik === x ? 'selected' : ''}>${esc(t('et_' + x))}</option>`).join('')}</select>`}
        <h3>${esc(t('vac_dates'))}</h3><p class="small">${esc(t('vac_dates_p'))}</p>
        <div id="vacs">${sc.vacations.map((v, i) => `<div class="row"><span class="num">🏖 ${esc(v.start)} ~ ${esc(v.end)}</span><button type="button" class="btn sm ghost" data-delvac="${i}" aria-label="${esc(t('del'))} ${esc(v.start)}">✕</button></div>`).join('') || `<p class="small">${esc(t('no_vac'))}</p>`}</div>
        <div class="two"><div><label class="f" for="vs">${esc(t('vac_start'))}</label><input type="date" id="vs"></div><div><label class="f" for="ve">${esc(t('vac_end'))}</label><input type="date" id="ve"></div></div>
        <p class="err" id="verr" hidden>${esc(t('vac_err'))}</p><button type="button" class="btn ghost" id="addvac">${esc(t('vac_add'))}</button>
        <p class="small">${esc(t('holiday_auto', { from: S.D.holidays.from, to: S.D.holidays.through }))}</p>${src('kasa_2027')}</section>
      <section class="card" id="wps"><h2>${esc(t('wp_h'))} <span class="num">${st.workplaces.length}/${L.maxPlaces}</span></h2>${src('moj_manual')}
        ${st.workplaces.map(w => wpCard(w, lv)).join('') || `<p class="small">${esc(t('no_wp'))}</p>`}
        <details id="wpform-d" ${st.workplaces.length ? '' : 'open'}><summary class="btn ghost" id="wpadd-open">＋ ${esc(t('wp_add'))}</summary>${wpForm()}</details></section>
      <section class="card" id="shifts"><h2>${esc(t('shift_h'))}</h2>
        ${st.workplaces.length ? `<label class="f" for="swp">${esc(t('shift_wp'))}</label><select id="swp">${wpOpts}</select>
        <label class="f" for="paste">${esc(t('paste_label'))}</label><input type="text" id="paste" placeholder="${esc(t('paste_ph'))}"><p class="err" id="perr" hidden></p><button type="button" class="btn ghost" id="parse">${esc(t('paste_btn'))}</button>
        <div class="three"><div><label class="f" for="sdow">${esc(t('dow'))}</label><select id="sdow">${E.DOW.map((x, i) => `<option value="${i}">${esc(dowName(i))}</option>`).join('')}<option value="date">${esc(t('one_date'))}</option></select></div><div><label class="f" for="sst">${esc(t('from'))}</label><input type="time" id="sst" value="18:00"></div><div><label class="f" for="sen">${esc(t('to'))}</label><input type="time" id="sen" value="22:00"></div><button type="button" class="btn sm" id="sadd" aria-label="${esc(t('shift_add'))}">＋</button></div>
        <div id="sdate-w" hidden><label class="f" for="sdate">${esc(t('date'))}</label><input type="date" id="sdate"></div>
        <p class="small">${esc(t('midnight_note'))}</p>
        <ul class="wlist" id="slist">${st.shifts.map((s, i) => { const w = st.workplaces.find(x => x.id === s.wpId); return `<li class="s-info row"><span>${esc(w ? w.name : '?')} · <span class="num">${s.date ? esc(s.date) : esc(t('every', { dow: dowName(s.dow) }))} ${esc(s.start)}–${esc(s.end)}</span></span><button type="button" class="btn sm ghost" data-delsh="${i}" aria-label="${esc(t('del'))}">✕</button></li>`; }).join('')}</ul>
        ${st.shifts.length ? `<a class="btn block" href="#/">${esc(t('see_dash'))}</a>` : ''}` : `<p class="small">${esc(t('shift_need_wp'))}</p>`}</section>`);
    $('#preset').onchange = e => { if (e.target.value) applySchool(e.target.value); else st.school.presetId = null; save(); workView(); };
    const et = $('#etopik'); if (et) et.onchange = e => { st.school.expiredTopik = e.target.value; save(); };
    $('#addvac').onclick = () => { const a = $('#vs').value, b = $('#ve').value; if (!E.isYmd(a) || !E.isYmd(b) || b < a) { $('#verr').hidden = false; return; } st.school.vacations.push({ start: a, end: b }); save(); toast(t('saved')); workView(); };
    $$('[data-delvac]').forEach(b => b.onclick = () => { st.school.vacations.splice(+b.dataset.delvac, 1); save(); workView(); });
    $$('[data-delwp]').forEach(b => b.onclick = async () => { if (await dialog(t('del_wp_t'), `<p>${esc(t('del_wp_p'))}</p>`, t('del'))) { const id = b.dataset.delwp; st.workplaces = st.workplaces.filter(w => w.id !== id); st.shifts = st.shifts.filter(s => s.wpId !== id); save(); workView(); } });
    $$('[data-delsh]').forEach(b => b.onclick = () => { st.shifts.splice(+b.dataset.delsh, 1); save(); workView(); });
    const ind = $('#wind'); if (ind) ind.oninput = () => { const r = E.classifyIndustry(ind.value, S.D.industries, lv.unknown ? null : lv.level); $('#wsig').innerHTML = sigDetail(r); };
    $('#wpsave').onclick = async () => {
      const name = $('#wname').value.trim(); if (!name) { $('#werr').hidden = false; $('#wname').focus(); return; }
      if (E.hasIdNumber(name + ' ' + $('#wind').value)) { $('#werr').textContent = t('idnum_block'); $('#werr').hidden = false; return; }
      if (st.workplaces.length >= L.maxPlaces) { await dialog(t('places_block_t'), `<p class="s-stop" style="padding:8px;border-radius:8px">⛔ ${dual('places_block', { max: L.maxPlaces })}</p>${src('moj_manual')}`, t('ok'), false); return; }
      const num = id => { const v = parseFloat($(id).value); return isNaN(v) ? null : v; };
      const w = { id: uid(), name, industry: $('#wind').value.trim(), commuteMin: num('#wcom'), startOn: $('#wstart').value || null, permitted: $('#wperm').checked, permitFrom: $('#wpf').value || null, permitTo: $('#wpt').value || null, permitHours: num('#wph'), changedOn: $('#wch').value || null, reportedOn: $('#wrep').value || null };
      const r = E.classifyIndustry(w.industry, S.D.industries, lv.unknown ? null : lv.level);
      if (r.signal === 'ban' || r.signal === 'restricted') { const go = await dialog(t('ind_stop_t'), `<p>${sigDetail(r)}</p>`, t('ind_add_anyway'), t('cancel')); if (!go) return; }
      st.workplaces.push(w); save(); toast(t('saved')); workView();
    };
    if (!st.workplaces.length) return;
    $('#sdow').onchange = () => { $('#sdate-w').hidden = $('#sdow').value !== 'date'; };
    $('#sadd').onclick = () => { const wp = $('#swp').value, a = $('#sst').value, b = $('#sen').value; if (!a || !b || a === b) { toast(t('shift_err')); return; } const sh = { wpId: wp, start: a, end: b }; if ($('#sdow').value === 'date') { if (!E.isYmd($('#sdate').value)) { toast(t('shift_err')); return; } sh.date = $('#sdate').value; } else sh.dow = +$('#sdow').value; st.shifts.push(sh); save(); toast(t('saved')); workView(); };
    $('#parse').onclick = () => { const r = E.parseScheduleText($('#paste').value); const wp = $('#swp').value; if (!r.ok.length) { $('#perr').textContent = t('paste_err'); $('#perr').hidden = false; return; } r.ok.forEach(x => st.shifts.push(Object.assign({ wpId: wp }, x))); save(); toast(t('paste_ok', { n: r.ok.length, bad: r.bad.length })); workView(); };
  }
  function sigDetail(r) { return `${sig(r.signal)}${r.matched.length ? ` <span class="small kwline">${esc(t('kw_hit'))}: <span class="kws">${r.matched.slice(0, 4).map(k => `<span class="kw" lang="ko">${esc(k)}</span>`).join('')}</span></span>` : ''}<span class="small" style="display:block">${dual('sigd_' + (r.top === 'manufacturing' ? (r.levelOk ? 'mfg_ok' : 'mfg_low') : r.signal), { from: S.D.rules.oneStrike.from })}</span>`; }
  function wpCard(w, lv) {
    const r = E.classifyIndustry(w.industry, S.D.industries, lv.unknown ? null : lv.level);
    return `<div class="wpcard"><div class="row"><b>${esc(w.name)}</b><button type="button" class="btn sm ghost" data-delwp="${esc(w.id)}" aria-label="${esc(t('del'))} ${esc(w.name)}">✕</button></div>
      <p class="small">${esc(w.industry || t('no_industry'))}</p>${sigDetail(r)}${src(r.signal === 'ban' ? S.D.rules.oneStrike.src : 'moj_manual')}
      <dl class="kv"><dt>${esc(t('permit'))}</dt><dd>${w.permitted ? `<span class="num">${esc(w.permitFrom || '?')} ~ ${esc(w.permitTo || '?')}</span>` : esc(t('not_yet'))}</dd>${w.permitHours ? `<dt>${esc(t('permit_hours'))}</dt><dd class="num">${w.permitHours}h</dd>` : ''}${w.commuteMin != null ? `<dt>${esc(t('commute'))}</dt><dd class="num">${w.commuteMin}${esc(t('min'))}</dd>` : ''}${w.startOn ? `<dt>${esc(t('start_on'))}</dt><dd class="num">${esc(w.startOn)}</dd>` : ''}${w.changedOn ? `<dt>${esc(t('changed_on'))}</dt><dd class="num">${esc(w.changedOn)}</dd>` : ''}</dl></div>`;
  }
  function wpForm() {
    return `<div id="wpform"><label class="f" for="wname">${esc(t('wp_name'))}</label><input type="text" id="wname" maxlength="40" autocomplete="off" placeholder="${esc(t('wp_name_ph'))}">
      <p class="err" id="werr" hidden>${esc(t('wp_name_err'))}</p>
      <label class="f" for="wind">${esc(t('wp_ind'))}</label><textarea id="wind" placeholder="${esc(t('wp_ind_ph'))}"></textarea><div id="wsig" aria-live="polite">${sig('unknown')}</div>
      <div class="two"><div><label class="f" for="wcom">${esc(t('commute'))}</label><input type="number" id="wcom" inputmode="numeric" min="0" max="300"></div><div><label class="f" for="wstart">${esc(t('start_on'))}</label><input type="date" id="wstart"></div></div>
      <label class="check"><input type="checkbox" id="wperm">${esc(t('wp_permitted'))}</label>
      <div class="two"><div><label class="f" for="wpf">${esc(t('permit_from'))}</label><input type="date" id="wpf"></div><div><label class="f" for="wpt">${esc(t('permit_to'))}</label><input type="date" id="wpt"></div></div>
      <label class="f" for="wph">${esc(t('permit_hours_opt'))}</label><input type="number" id="wph" inputmode="numeric" min="0" max="60">
      <div class="two"><div><label class="f" for="wch">${esc(t('changed_on'))}</label><input type="date" id="wch"></div><div><label class="f" for="wrep">${esc(t('reported_on'))}</label><input type="date" id="wrep"></div></div>
      <p class="small">${esc(t('changed_help'))}</p>
      <button type="button" class="btn block" id="wpsave">${esc(t('wp_save'))}</button></div>`;
  }

  /* ---------- S7 할 일·일정 ---------- */
  function evText(e) { return t('ev_' + e.id, { wp: e.wp || '', ref: e.ref || '' }); }
  function todoView() {
    const p = S.st.profile || {}; const ev = E.timeline(S.st, S.D.rules, today());
    page('todo', `<h1>${esc(t('todo_h'))}</h1>
      <section class="card s-stop" style="border-radius:14px"><h2>⛔ ${dual('no_work_before')}</h2>${src('law_immig')}</section>
      <section class="card"><h2>${esc(t('dates_h'))}</h2><div class="two"><div><label class="f" for="vexp">${esc(t('visa_exp'))}</label><input type="date" id="vexp" value="${esc(p.visaExpiry || '')}"></div><div><label class="f" for="texp">${esc(t('topik_exp'))}</label><input type="date" id="texp" value="${esc(p.topikExpiry || '')}"></div></div>
        <p class="small">${esc(t('topik_exp_note', { st: t('et_' + (S.st.school.expiredTopik || 'unknown')) }))}</p><button type="button" class="btn ghost" id="dsave" ${S.st.profile ? '' : 'disabled'}>${esc(t('save'))}</button></section>
      <section class="card" id="tl"><h2>${esc(t('timeline_h'))}</h2>
        ${ev.length ? `<ol class="tline">${ev.map(e => `<li class="${e.past ? 'past' : ''}"><span class="tdate"><b class="num">${esc(e.date)}</b><span class="num">${e.past ? esc(t('past')) : 'D-' + e.dday}</span></span><span>${esc(evText(e))}</span>${src(e.src, e.status)}</li>`).join('')}</ol>
        <button type="button" class="btn block" id="ics">📅 ${esc(t('ics_btn'))}</button><p class="small">${esc(t('ics_note'))}</p>` : `<p>${esc(t('tl_empty'))}</p><a class="btn ghost" href="#/work">${esc(t('to_work'))}</a>`}
        <p class="small">${esc(t('lead_note', { a: S.D.rules.recommendLeadDays, b: S.D.rules.processingDays }))}</p>${src('gov24')}</section>
      <section class="card"><h2>${esc(t('change_h'))}</h2><p>${dual('change_conflict', { d: S.D.rules.changeReportDays })}</p>${src('moj_manual')}${src('gov24', 'check')}</section>`);
    $('#dsave').onclick = () => { if (!S.st.profile) return; S.st.profile.visaExpiry = $('#vexp').value || null; S.st.profile.topikExpiry = $('#texp').value || null; save(); toast(t('saved')); todoView(); };
    const ib = $('#ics'); if (ib) ib.onclick = async () => {
      if (!await personalWarn()) return;
      const evs = ev.filter(e => !e.past).map(e => ({ id: e.id, date: e.date, summary: '[' + t('app') + '] ' + evText(e), description: tk('ev_' + e.id, { wp: e.wp || '', ref: e.ref || '' }) + ' / ' + tk('final') }));
      if (!evs.length) { toast(t('tl_all_past')); return; }
      const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      download('work-permit-reminders.ics', E.buildICS(evs, now), 'text/calendar;charset=utf-8');
    };
  }
  async function personalWarn() { return dialog(t('pw_t'), `<p>${esc(t('pw_p'))}</p><p class="small" lang="ko">${S.lang !== 'ko' ? esc(tk('pw_p')) : ''}</p>`, t('pw_ok'), t('cancel')); }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ---------- S9 규칙·출처 ---------- */
  function rulesView() {
    const R = S.D.rules, h = R.hours; const src2 = Object.entries(S.D.sources.sources);
    const row = (a, b, c, d, e) => `<tr><th scope="row">${a}</th><td>${b}</td><td class="num">${c}</td><td class="num">${d}</td><td>${e}</td></tr>`;
    const W = S.st.wage; const wr = E.wage(W.hourly, W.weekly, W.year, R);
    page('rules', `<h1>${esc(t('rules_h'))}</h1><p class="small">${esc(t('rules_asof', { d: R.asOf }))}</p>
      <section class="card"><h2>${esc(t('tbl_h'))}</h2><div class="scrollx" tabindex="0" role="region" aria-label="${esc(t('tbl_h'))}"><table class="tbl"><thead><tr><th scope="col">${esc(t('th_course'))}</th><th scope="col">${esc(t('th_lang'))}</th><th scope="col">${esc(t('th_notmet'))}</th><th scope="col">${esc(t('th_met'))}</th><th scope="col">${esc(t('th_off'))}</th></tr></thead><tbody>
        ${row(esc(t('r_assoc_ba12')), 'TOPIK 3 · KIIP 3/61 · ' + esc(t('sj_intermediate1')), h.d2_undergrad.notMetTotal, h.d2_undergrad.metWeekday + ' (+5→' + h.d2_undergrad.bonusWeekday + ')', '∞')}
        ${row(esc(t('r_ba34')), 'TOPIK 4 · KIIP 4/81 · ' + esc(t('sj_intermediate2')), h.d2_undergrad.notMetTotal, h.d2_undergrad.metWeekday + ' (+5→' + h.d2_undergrad.bonusWeekday + ')', '∞')}
        ${row(esc(t('r_grad')), 'TOPIK 4 · KIIP 4/81 · ' + esc(t('sj_intermediate2')), h.d2_grad.notMetTotal, h.d2_grad.metWeekday + ' (+5→' + h.d2_grad.bonusWeekday + ')', '∞')}
        ${row(esc(t('r_d4')), 'TOPIK 2 · KIIP 2/41 · ' + esc(t('sj_beginner2')), h.d4.notMetTotal + ' ?', h.d4.metTotal + ' (+5→' + h.d4.bonusTotal + ' ?)', '✕')}
        ${row(esc(t('r_thesis')), '–', '–', h.thesis.total, '✕')}</tbody></table></div>
        <p class="small">${esc(t('tbl_note'))}</p>${src('moj_manual')}${src('studyinkorea', 'check')}<p class="small">${esc(t('d4_tbl_note'))}</p></section>
      <section class="card"><h2>${esc(t('ind_h'))}</h2>${['ban', 'restricted', 'conditional', 'ok', 'unknown'].map(s => `<p>${sig(s)} <span class="small">${esc(t('sigl_' + s))}</span></p>`).join('')}
        <p>${dual('one_strike', { from: R.oneStrike.from })}</p>${src('moj_hist')}${src('kw_notice')}
        <label class="f" for="indq">${esc(t('ind_try'))}</label><input type="text" id="indq" placeholder="${esc(t('wp_ind_ph'))}"><div id="indr" aria-live="polite"></div></section>
      <section class="card"><h2>${esc(t('pen_h'))}</h2><ul><li>${esc(t('pen_1'))}</li><li>${esc(t('pen_2'))}</li><li>${esc(t('pen_3'))}</li><li>${esc(t('pen_4'))}</li></ul>${src('moj_manual')}${src('law_immig')}</section>
      <section class="card"><h2>${esc(t('diff_h'))}</h2><ul><li>${esc(t('diff_1'))}</li><li>${esc(t('diff_2'))}</li><li>${esc(t('diff_3'))}</li><li>${esc(t('diff_4'))}</li></ul>${src('yonsei')}${src('hallym')}</section>
      <section class="card" id="wage"><h2>${esc(t('wage_h'))}</h2><div class="two"><div><label class="f" for="hw">${esc(t('hourly'))}</label><input type="number" id="hw" inputmode="numeric" value="${esc(W.hourly ?? '')}"></div><div><label class="f" for="wh">${esc(t('weekly_h'))}</label><input type="number" id="wh" inputmode="decimal" value="${esc(W.weekly ?? '')}"></div></div>
        <label class="f" for="wy">${esc(t('year'))}</label><select id="wy">${[2026, 2027].map(y => `<option ${W.year == y ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <div id="wageout">${wageOut(wr, W)}</div>${src('moel_2027')}${src('labor_act', 'check')}</section>
      <section class="card"><h2>${esc(t('src_h'))}</h2><p class="small">${esc(t('legend_src'))}</p>${legendSrc()}<ul class="wlist">${src2.map(([k, s]) => `<li class="s-info"><b>${esc(s.org)}</b><span class="small">${esc(s.title)} · ${esc(t('asof'))} ${esc(s.asOf)}</span>${src(k)}</li>`).join('')}</ul></section>
      <section class="card"><h2>${esc(t('tr_h'))}</h2><p>${esc(t('tr_p'))}</p><ul><li>한국어 — ${esc(t('tr_orig'))}</li><li>English — ${esc(t('tr_human'))}</li><li>Tiếng Việt · 简体中文 · O‘zbekcha — ${esc(t('tr_mt'))}</li></ul></section>`);
    $('#indq').oninput = e => { const lv = E.langLevel((S.st.profile || {}).lang, S.D.rules); $('#indr').innerHTML = e.target.value ? sigDetail(E.classifyIndustry(e.target.value, S.D.industries, lv.unknown ? null : lv.level)) : ''; };
    const upd = () => { const W2 = S.st.wage; W2.hourly = parseFloat($('#hw').value) || null; W2.weekly = parseFloat($('#wh').value) || null; W2.year = +$('#wy').value; save(); $('#wageout').innerHTML = wageOut(E.wage(W2.hourly, W2.weekly, W2.year, S.D.rules), W2); };
    ['#hw', '#wh', '#wy'].forEach(s => $(s).addEventListener('input', upd));
  }
  function wageOut(r, W) {
    return `<p>${esc(t('minwage', { y: W.year, w: (r.min || 0).toLocaleString('ko-KR') }))}</p>${r.below ? `<p class="chip s-stop">⛔ ${esc(t('below_min'))}</p>` : ''}
      ${W.weekly ? (r.juhyu ? `<p class="chip s-ok">✓ ${esc(t('juhyu_yes', { w: r.juhyuPay.toLocaleString('ko-KR') }))}</p>` : `<p class="chip s-chk">? ${esc(t('juhyu_no'))}</p>`) : ''}<p class="small">${esc(t('wage_note'))}</p>`;
  }

  /* ---------- S8 내보내기 ---------- */
  function exportView() {
    const st = S.st; const L = limit();
    page('export', `<h1>${esc(t('export_h'))}</h1>
      <section class="card" id="emp"><h2>${esc(t('emp_h'))}</h2><p class="small">${esc(t('emp_p'))}</p>
        <label class="f" for="ini">${esc(t('initials'))}</label><input type="text" id="ini" maxlength="12" placeholder="N.T.M." autocomplete="off">
        <p class="err" id="inierr" hidden>${esc(t('idnum_block'))}</p>
        ${st.workplaces.length ? `<label class="f" for="ewp">${esc(t('shift_wp'))}</label><select id="ewp">${st.workplaces.map(w => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>` : `<p class="chip s-chk">? ${esc(t('no_wp'))}</p>`}
        <button type="button" class="btn ghost block" id="empprev">${esc(t('preview'))}</button><div id="empout"></div></section>
      <section class="card" id="office"><h2>${esc(t('off_h'))}</h2><p class="small">${esc(t('off_p'))}</p><button type="button" class="btn ghost block" id="offprev">${esc(t('preview'))}</button><div id="offout"></div></section>
      <section class="card"><h2>${esc(t('bk_h'))}</h2><p class="small">${esc(t('bk_p'))}</p><div class="stack"><button type="button" class="btn ghost block" id="bk">💾 ${esc(t('bk_btn'))}</button>
        <label class="btn ghost block" for="rs">📂 ${esc(t('rs_btn'))}</label><input type="file" id="rs" accept="application/json,.json" class="sr-only"></div><p class="err" id="rserr" hidden></p></section>
      <section class="card"><h2>${esc(t('wipe_h'))}</h2><button type="button" class="btn danger block" id="wipe">${esc(t('wipe_btn'))}</button></section>`);
    const empHtml = () => employerCard($('#ini').value, $('#ewp') && $('#ewp').value, L);
    $('#empprev').onclick = () => { const ini = $('#ini').value; if (E.hasIdNumber(ini)) { $('#inierr').hidden = false; return; } $('#inierr').hidden = true; $('#empout').innerHTML = empHtml() + `<button type="button" class="btn block" id="empprint">🖨 ${esc(t('print'))}</button>`; $('#empprint').onclick = async () => { if (await personalWarn()) doPrint(empHtml()); }; };
    $('#offprev').onclick = () => { $('#offout').innerHTML = officeSheet(L) + `<button type="button" class="btn block" id="offprint">🖨 ${esc(t('print'))}</button>`; $('#offprint').onclick = async () => { if (await personalWarn()) doPrint(officeSheet(L)); }; };
    $('#bk').onclick = async () => { if (!await personalWarn()) return; download('work-permit-guard-backup-' + today() + '.json', JSON.stringify({ app: 'wpg', v: 1, exportedAt: today(), data: S.st }, null, 1), 'application/json'); };
    $('#rs').onchange = async e => { const f = e.target.files[0]; if (!f) return; let o; try { o = JSON.parse(await f.text()); } catch (x) { o = null; } const r = E.validateBackup(o); if (!r.ok) { $('#rserr').textContent = t('rs_err_' + r.err); $('#rserr').hidden = false; return; } if (await dialog(t('rs_t'), `<p>${esc(t('rs_p'))}</p>`, t('rs_ok'))) { S.st = Object.assign(blank(), r.data, { v: 1 }); save(); toast(t('rs_done')); location.hash = '#/'; route(); } };
    $('#wipe').onclick = async () => { if (!await dialog(t('wipe_t1'), `<p>${esc(t('wipe_p1'))}</p>`, t('next'))) return; if (!await dialog(t('wipe_t2'), `<p>${esc(t('wipe_p2'))}</p>`, t('wipe_btn'))) return; localStorage.removeItem(KEY); S.st = blank(); S.st.lang = S.lang; save(); toast(t('wiped')); location.hash = '#/'; route(); };
  }
  function monthSummary(wpId) { const td = today(); const from = td.slice(0, 8) + '01'; const segs = E.expand(S.st, from, E.addDays(E.addMonths(from, 1), -1)).filter(s => !wpId || s.wpId === wpId); const byDow = {}; for (const s of S.st.shifts.filter(x => !wpId || x.wpId === wpId)) { const k = s.date ? s.date : '매주 ' + tk('dow_' + E.DOW[s.dow]); (byDow[k] = byDow[k] || []).push(s.start + '–' + s.end); } return { segs, total: segs.reduce((a, s) => a + s.mins, 0), rows: Object.entries(byDow) }; }
  function employerCard(ini, wpId, L) {
    const w = S.st.workplaces.find(x => x.id === wpId) || {}; const m = monthSummary(wpId); const R = S.D.rules;
    const cap = L.unlimited ? `학기 중 주중 ${L.weekdayCap}시간 (주말·공휴일·방학 제한 없음)` : (L.visa === 'D-4' && !L.eligibleNow ? `아직 불가 (${L.eligibleFrom || '날짜 확인'}부터)` : `주 ${L.totalCap}시간 (주말·방학 포함)`);
    return `<div class="a4" lang="ko" id="empcard"><h2>유학생 시간제취업 사장님 확인 카드</h2><p class="small">작성 ${today()} · ${APP} · 기준 법무부 체류민원 자격별 안내 매뉴얼 ${R.asOf}판</p>
      <table class="tbl"><tbody><tr><th scope="row">학생(이니셜)</th><td>${esc(E.initials(ini) || '—')} · ${esc(L.visa === 'thesis' ? 'D-2 논문준비' : L.visa)}</td></tr>
      <tr><th scope="row">사업장</th><td>${esc(w.name || '—')}</td></tr><tr><th scope="row">허가 기간</th><td class="num">${w.permitted ? esc((w.permitFrom || '?') + ' ~ ' + (w.permitTo || '?')) : '허가 전 — 근무 시작 불가'}</td></tr>
      <tr><th scope="row">허용 한도</th><td>${esc(cap)}${w.permitHours ? ` · 허가서 기재 ${w.permitHours}시간` : ''}</td></tr>
      <tr><th scope="row">이번 달 근무</th><td>${m.rows.map(([k, v]) => esc(k + ' ' + v.join(', '))).join('<br>') || '—'} · 합계 약 ${H(m.total)}시간</td></tr>
      <tr><th scope="row">동시 근무</th><td>최대 ${L.maxPlaces}곳 · 고용주가 바뀌면 사전에 새 허가 필요</td></tr></tbody></table>
      <p>☐ 제한 업종이 아님(배달·택배·라이더, 건설, 유흥·사행, 파견·도급, 특수형태근로) &nbsp; ☐ 허가서의 사업장·기간과 일치 &nbsp; ☐ 표준근로계약서(시급 기재)</p>
      <p><b>양벌규정 안내:</b> 취업활동을 할 수 있는 체류자격(허가)이 없는 외국인을 고용하면 고용주도 처벌될 수 있어요(출입국관리법 제18조 제3항·제94조 제9호: 3년 이하 징역 또는 3천만원 이하 벌금, 법인·개인은 제99조의3 양벌규정).</p>
      <p class="small">확정 판정 아님 · 최종 확인: 국제처·하이코리아·1345 · 외국인등록번호·여권번호는 적지 않아요.</p></div>`;
  }
  function officeSheet(L) {
    const p = S.st.profile || {}; const { weeks } = weeksNow(5); const W = E.warnings(S.st, L, S.D.rules, S.D.industries, weeks, today()).slice(0, 6); const R = S.D.rules;
    const prog = { associate: '전문학사', bachelor: '학사', master: '석사', doctor: '박사', language: '어학연수' }[p.program] || '—';
    const lang = p.lang ? ({ topik: 'TOPIK ' + (p.lang.value ?? '?') + '급', kiip: 'KIIP ' + (p.lang.value ?? '?') + '단계', kiipPre: 'KIIP 사전평가 ' + (p.lang.value ?? '?') + '점', sejong: '세종학당 ' + tk('sj_' + p.lang.value), english: '영어트랙 증빙', none: '없음', unknown: '모름' }[p.lang.type]) : '—';
    const cap = L.unlimited ? `주중 ${L.weekdayCap}시간 + 주말·공휴일·방학 무제한` : (L.visa === 'D-4' && !L.eligibleNow ? `아직 불가(${L.eligibleFrom || '입국일 확인'}부터)` : `주 ${L.totalCap}시간(주말·방학 포함)`);
    return `<div class="a4" lang="ko" id="offsheet"><h2>국제처 상담용 한 장 — 시간제취업</h2><p class="small">작성 ${today()} · 기준 법무부 매뉴얼 ${R.asOf}판 · ${APP}</p>
      <table class="tbl"><tbody><tr><th scope="row">체류자격·과정</th><td>${esc(p.visa === 'thesis' ? 'D-2 논문준비생' : (p.visa || '—'))} · ${esc(prog)}${p.year ? ' ' + esc(p.year === 'unknown' ? '학년 모름' : p.year + '학년') : ''}</td></tr>
      <tr><th scope="row">한국어 증빙</th><td>${esc(lang)}${p.topikExpiry ? ' · 성적 만료 ' + esc(p.topikExpiry) : ''}</td></tr>
      <tr><th scope="row">앱 계산 한도</th><td>${esc(cap)} · 사업장 최대 ${L.maxPlaces}곳${L.unknown.length ? ' · 모름 항목은 낮은 값으로 계산' : ''}</td></tr>
      <tr><th scope="row">사업장</th><td>${S.st.workplaces.map(w => esc(w.name + (w.permitted ? ' (허가 ' + (w.permitFrom || '?') + '~' + (w.permitTo || '?') + ')' : ' (허가 전)'))).join('<br>') || '—'}</td></tr></tbody></table>
      <h3>향후 5주 근무(한도 계산 시간)</h3><table class="tbl"><thead><tr><th scope="col">주(월~일)</th><th scope="col">계산 시간</th><th scope="col">주말·공휴일·방학</th><th scope="col">상태</th></tr></thead><tbody>${weeks.map(w => `<tr><td class="num">${w.week}</td><td class="num">${H(w.countedMins)}${w.capMins != null ? ' / ' + H(w.capMins) : ''}h</td><td class="num">${H(w.otherMins)}h</td><td>${{ ok: '✓ 한도 안', warn: '⚠ 한도 근접', stop: '⛔ 초과' }[w.status]}</td></tr>`).join('')}</tbody></table>
      <h3>앱이 찾은 확인 사항</h3><ul>${W.map(w => `<li>${esc(tk('w_' + w.id, wParams(w)))}${w.id === 'over' ? ' — ' + esc(overList(w).join(', ')) : ''}</li>`).join('') || '<li>없음</li>'}</ul>
      <h3>여쭤볼 질문</h3><ol><li>만료된 TOPIK 성적도 우리 학교에서 인정되나요?</li><li>우리 학교가 인증대학인가요(주중 +5시간 우대 해당 여부)?</li><li>고용주가 바뀌면 새 허가와 15일 이내 변경 신고 중 무엇을 해야 하나요?</li></ol>
      <p class="small">확정 판정 아님 · 최종 확인: 국제처·하이코리아·1345 · 외국인등록번호·여권번호는 적지 않았어요.</p></div>`;
  }
  function doPrint(html) { const pr = $('#print'); pr.innerHTML = html; setTimeout(() => window.print(), 50); }

  window.addEventListener('afterprint', () => { $('#print').innerHTML = ''; });
  boot();
})();
