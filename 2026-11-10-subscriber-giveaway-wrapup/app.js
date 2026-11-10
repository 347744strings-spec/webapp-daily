/* 구독자 이벤트 정리판 — 기기 안에서만 계산·저장. 외부 요청 없음. */
(function () {
  'use strict';
  const KEY = 'gp_events_v1', SKEY = 'gp_settings_v1', APP = '구독자 이벤트 정리판';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let R = null, S = null, SET = null, loadNote = '', mem = { winners: null, reserves: null, forHash: '' };
  const view = () => $('#view');
  const todayKST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const nowKST = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; };

  /* ---------- 저장 ---------- */
  const TYPES = ['giftcard', 'mobile', 'physical', 'contest'];
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const okDate = v => (typeof v === 'string' && GP.parseDate(v) ? v : '');
  const rrnMask = s => String(s || '').replace(/(?<!\d)\d{6}\s*-?\s*[1-8]\d{6}(?!\d)/g, '******-*******');
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function freshEvent() {
    return { id: uid('ev'), title: '', createdAt: nowKST().replace(' ', 'T') + ':00+09:00', sample: false, prizes: [], notice: { platform: 'youtube', handle: '', how: '', start: '', end: '', announceDate: '', announceMethod: 'dm', replyDays: 3, phraseSource: '', copiedAt: '' }, draw: null, participantsRaw: '', drawOpts: { dedupe: true, keyword: '', exclude: '', reserves: 2, maskMode: 'end' }, guideCopiedAt: '', payout: { paidDate: '', shippedDate: '', retentionDays: 30 }, checklist: {} };
  }
  const CHECKS = [['receipts', '경품 구매 영수증·시가 근거 보관'], ['winnerCapture', '당첨자 발표 화면 캡처(마스킹본)'], ['payProof', '발송·지급 증빙(송장·이체 내역)'], ['withholdingFiled', '원천세 신고·납부 완료'], ['statementFiled', '지급명세서 제출(또는 제출 불필요 확인)'], ['loserDataDeleted', '미당첨자 참여 정보 파기'], ['winnerDataDeleted', '당첨자 개인정보 파기'], ['rrnDeleted', '주민등록번호 파기(수집한 경우)']];
  function cleanEvent(e) {
    if (!e || typeof e !== 'object') return null;
    const f = freshEvent();
    f.id = str(e.id, 40) || f.id; f.title = rrnMask(str(e.title, 60)); f.createdAt = /^\d{4}-\d{2}-\d{2}/.test(str(e.createdAt, 30)) ? str(e.createdAt, 30) : f.createdAt; f.sample = !!e.sample;
    f.prizes = (Array.isArray(e.prizes) ? e.prizes : []).slice(0, 30).map(p => {
      const v = GP.toInt(p && p.unitValue), q = GP.toInt(p && p.qty);
      if (!p || isNaN(v) || v < 0 || v > 1e10) return null;
      return { id: str(p.id, 40) || uid('p'), name: rrnMask(str(p.name, 60)) || '경품', unitValue: v, qty: q >= 1 && q <= 1000 ? q : 1, type: TYPES.includes(p.type) ? p.type : 'giftcard', sender: p.sender === 'sponsor' ? 'sponsor' : 'me', taxBearer: p.taxBearer === 'me' ? 'me' : 'winner' };
    }).filter(Boolean);
    const n = e.notice || {};
    f.notice = { platform: GP.PLAT[n.platform] ? n.platform : 'youtube', handle: str(n.handle, 40), how: rrnMask(str(n.how, 300)), start: okDate(n.start), end: okDate(n.end), announceDate: okDate(n.announceDate), announceMethod: n.announceMethod === 'list' ? 'list' : 'dm', replyDays: GP.toInt(n.replyDays) >= 1 && GP.toInt(n.replyDays) <= 30 ? GP.toInt(n.replyDays) : 3, phraseSource: str(n.phraseSource, 120), copiedAt: str(n.copiedAt, 30) };
    const d = e.draw;
    if (d && typeof d === 'object' && typeof d.listHash === 'string' && /^[0-9a-f]{64}$/.test(d.listHash) && Array.isArray(d.winners)) {
      f.draw = { phrase: str(d.phrase, 300), participantCount: GP.toInt(d.participantCount) || 0, listHash: d.listHash, seed: /^[0-9a-f]{64}$/.test(d.seed) ? d.seed : '', maskMode: d.maskMode === 'middle' ? 'middle' : 'end', drawnAt: str(d.drawnAt, 30), winners: d.winners.slice(0, 1000).map(w => ({ prizeId: str(w.prizeId, 40), maskedId: str(w.maskedId, 80), commentAt: str(w.commentAt, 40) })), reserves: (Array.isArray(d.reserves) ? d.reserves : []).slice(0, 50).map(w => ({ maskedId: str(w.maskedId, 80), commentAt: str(w.commentAt, 40) })) };
    }
    f.participantsRaw = str(e.participantsRaw, 1000000);
    const o = e.drawOpts || {};
    f.drawOpts = { dedupe: o.dedupe !== false, keyword: str(o.keyword, 60), exclude: str(o.exclude, 5000), reserves: GP.toInt(o.reserves) >= 0 && GP.toInt(o.reserves) <= 20 ? GP.toInt(o.reserves) : 2, maskMode: o.maskMode === 'middle' ? 'middle' : 'end' };
    f.guideCopiedAt = str(e.guideCopiedAt, 30);
    const py = e.payout || {};
    f.payout = { paidDate: okDate(py.paidDate), shippedDate: okDate(py.shippedDate), retentionDays: GP.toInt(py.retentionDays) >= 0 && GP.toInt(py.retentionDays) <= 365 ? GP.toInt(py.retentionDays) : 30 };
    const c = e.checklist || {};
    f.checklist = Object.fromEntries(CHECKS.map(([k]) => [k, c[k] === true]));
    return f;
  }
  const fresh = () => ({ v: 1, events: [] });
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); const st = JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; SET = { tourDone: !!st.tourDone, proInterest: !!st.proInterest }; }
    catch (e) { SET = { tourDone: false, proInterest: false }; if (raw === null) { loadNote = '이 브라우저는 저장소를 쓸 수 없어요(사생활 보호 모드 등). 입력은 이 탭을 닫으면 사라져요.'; return fresh(); } }
    if (!raw) return fresh();
    try {
      const s = JSON.parse(raw);
      if (!s || !Array.isArray(s.events)) throw Error('형식');
      return { v: 1, events: s.events.map(cleanEvent).filter(Boolean).slice(0, 1) };
    } catch (e) {
      try { localStorage.setItem(KEY + '_corrupt', raw); } catch (_) { /* 무시 */ }
      loadNote = '저장된 데이터를 읽지 못해 새로 시작했어요. 원래 내용은 따로 보관해 두었어요. 백업 파일이 있다면 도움말 → 복원을 쓰세요.';
      return fresh();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); localStorage.setItem(SKEY, JSON.stringify(SET)); return true; }
    catch (e) { toast('저장하지 못했어요. 저장 공간이 가득 찼거나 막혀 있어요. 백업을 내려받아 두세요.'); return false; }
  }
  const ev = () => S.events[0] || null;
  let DRAFT = null;
  const cur = () => ev() || (DRAFT = DRAFT || freshEvent());
  function ensureEvent() { if (!ev()) { S.events = [cur()]; DRAFT = null; save(); } return ev(); }

  /* ---------- 도우미 ---------- */
  const won = n => `<span class="num">${Math.round(n).toLocaleString('ko-KR')}원</span>`;
  const fd = s => s ? `<span class="num">${esc(s)}(${GP.weekday(s)})</span>` : '—';
  const dd = s => { const n = GP.diffDays(todayKST(), s); return n === 0 ? 'D-day' : n > 0 ? `D-${n}` : `D+${-n}`; };
  const src = key => { const s = R.sources[key]; return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : ''; };
  const need = t => `<span class="chip need">확인 필요${t ? ' · ' + esc(t) : ''}</span>`;
  const LIGHT = { green: ['g', '초록 · 원천징수 없음'], orange: ['o', '주황 · 22% 원천징수'], red: ['r', '빨강 · 주최자 부담 급증'] };
  const lightChip = a => a.light === 'none' ? '' : `<span class="chip ${LIGHT[a.light][0]}"><i class="dot ${LIGHT[a.light][0]}" aria-hidden="true"></i>${LIGHT[a.light][1]}</span>`;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 3200); }
  function confirmBox(title, text, okLabel = '계속') {
    const d = $('#confirm');
    $('#confirm-title').textContent = title; $('#confirm-text').textContent = text; $('#confirm-ok').textContent = okLabel;
    return new Promise(res => {
      const done = () => { d.removeEventListener('close', done); res(d.returnValue === 'ok'); };
      d.returnValue = ''; d.addEventListener('close', done);
      if (d.showModal) d.showModal(); else res(window.confirm(title + '\n' + text));
    });
  }
  const PRIV = '이 내용은 이 기기 안에서만 처리됐어요. 내보내면 받는 사람·앱·클라우드에 그대로 남아요. 꼭 필요한 곳에만 보내고, 보낸 뒤 파기 일정에 맞춰 지워 주세요.';
  const privacyOk = what => confirmBox('개인정보가 들어 있어요', `${what}\n\n${PRIV}`, '확인하고 계속');
  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg || '복사했어요.'); return true; }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('aria-hidden', 'true'); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* 무시 */ } ta.remove(); toast(ok ? (msg || '복사했어요.') : '복사하지 못했어요. 글을 길게 눌러 직접 복사하세요.'); return ok; }
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const assess = p => GP.assessPrize(p, R);
  const prizeById = id => cur().prizes.find(p => p.id === id);

  const stat = (label, val, plain) => `<div class="stat${String(plain).length > 10 ? ' wide' : ''}"><span class="small mut">${label}</span><b>${val}</b></div>`;
  const wonLen = n => Math.round(n).toLocaleString('ko-KR') + '원';
  /* ---------- 단계 상태 ---------- */
  function stepDone(e) {
    if (!e) return [false, false, false, false, false];
    const dl = GP.deadlines(e, R);
    return [e.prizes.length > 0, !!e.notice.copiedAt, !!e.draw, !!e.guideCopiedAt, !!e.payout.paidDate && dl.length > 0 && dl.every(d => e.checklist[d.check])];
  }
  const STEPS = [['prizes', '① 경품', '경품', '금액별 22% 신호등·내 부담'], ['notice', '② 공지문', '공지', '사칭 주의·수집 안내 자동 포함'], ['draw', '③ 추첨', '추첨', '공개 문구로 누구나 재현'], ['winners', '④ 당첨 안내', '안내', '최소 수집 DM·폼 질문'], ['close', '⑤ 마감·증빙', '마감', '원천세·지급명세서·파기 캘린더']];
  function stepper(i) {
    return `<p class="stepper noprint" aria-label="진행 단계">${STEPS.map((s, k) => k === i ? `<b>${esc(s[1])}</b>` : `<span>${esc(s[1])}</span>`).join('<span aria-hidden="true">›</span>')}</p>`;
  }
  function nextLink(i) {
    const n = STEPS[i + 1];
    return n ? `<p class="row end noprint"><a class="btn" href="#/${n[0]}">다음: ${esc(n[1])}</a></p>` : `<p class="row end noprint"><a class="btn" href="#/report">결산 한 장 보기</a></p>`;
  }

  /* ---------- 홈 ---------- */
  function quickVerdict(v, type, bearer) {
    const n = GP.toInt(v);
    if (String(v).trim() === '') return '<p class="mut">금액을 넣으면 바로 판정해요.</p>';
    if (isNaN(n)) return '<p class="alert r" role="alert">숫자만 넣어 주세요. 예: 100000</p>';
    const a = assess({ unitValue: n, qty: 1, type, taxBearer: bearer, sender: 'me' });
    return verdictBlock(a);
  }
  function verdictBlock(a) {
    if (!a.valid) return '';
    let h = `<div class="verdict"><div>${lightChip(a)}`;
    if (!a.taxable) h += `<p class="big">세금 없음</p><p>${a.contest ? `대회 상금이라 80%를 필요경비로 빼면 소득금액 ${won(a.income)}으로 5만원 이하예요.` : '1건 5만원 이하라 원천징수하지 않아요.'} <b>주민등록번호는 받지 마세요.</b></p>`;
    else if (a.bearer === 'me') h += `<p class="big">내 부담 ${won(a.unitValue + a.grossTax)}</p><p>세금까지 대신 내면 그 세금도 소득이 돼서 소득금액 약 ${won(a.gross)}, 세액 약 ${won(a.grossTax)}이에요(근사치).</p>`;
    else h += `<p class="big">세액 ${won(a.tax)}</p><p>${a.contest ? `소득금액 ${won(a.income)}(상금의 20%) × 22%` : `${won(a.unitValue)} × 22%`} = 소득세 ${won(a.incomeTax)} + 지방소득세 ${won(a.localTax)}. 당첨자 부담이면 세금만큼 미리 받아 신고·납부해요.</p>`;
    if (a.taxable && a.statement === 'exempt') h += `<p class="small">1건 10만원 이하 추첨 경품은 지급명세서 제출 제외 대상일 수 있어요. ${need('주민번호 수집 필요 여부')}</p>`;
    if (a.high) h += `<p class="alert r small">3억원을 넘는 고액 경품은 별도 세율 규정이 있을 수 있어요. 전문가 상담을 받으세요.</p>`;
    return h + '</div></div>';
  }
  function vHome() {
    const e = ev(), done = stepDone(e), s = e ? GP.summarize(e.prizes, R) : null;
    let h = '';
    if (loadNote) h += `<div class="alert o" role="alert"><p>${esc(loadNote)}</p></div>`;
    h += `<section class="card hero"><h1>구독자 이벤트, <span class="em">추첨 다음이 진짜 일</span>입니다</h1><p class="lead">경품 금액만 넣으면 22% 제세공과금 신호등이 켜지고, 공지문·공정 추첨·당첨자 최소 수집 안내·신고·파기 캘린더가 이어져요. 가입 없이 이 기기에서만 처리돼요.</p>
<form id="quick" class="noprint" aria-labelledby="qh"><h2 id="qh" class="small" style="margin:.6em 0 .2em">경품 금액만 넣어 보기 — 세금·주민번호 60초 판정</h2>
<div class="inline2"><label class="field"><span>경품 1개 금액(시가)</span><input id="q-v" inputmode="numeric" autocomplete="off" placeholder="예: 100000" value="100000"></label>
<label class="field"><span>종류</span><select id="q-t"><option value="giftcard">현금·상품권</option><option value="mobile">모바일 쿠폰</option><option value="physical">실물</option><option value="contest">대회 상금</option></select></label></div>
<fieldset><legend>세금은 누가 내나요?</legend><div class="row"><label class="check"><input type="radio" name="q-b" value="winner" checked>당첨자</label><label class="check"><input type="radio" name="q-b" value="me">내가 대신(대납)</label></div></fieldset>
<div id="q-out" aria-live="polite">${quickVerdict('100000', 'giftcard', 'winner')}</div></form>
<div class="grid2 noprint" style="margin-top:10px">${e ? `<a class="btn" href="#/${STEPS[Math.max(0, done.indexOf(false))] ? STEPS[Math.max(0, done.indexOf(false))][0] : 'close'}">이어서 정리하기</a>` : '<a class="btn" href="#/prizes" data-act="start">내 이벤트 정리 시작</a>'}<button class="btn ghost" type="button" data-act="sample">예시로 둘러보기</button></div>
<p class="small mut">✓ 가입 없음 ✓ 외부 전송 없음 ✓ 실명·주민번호 입력칸 없음</p></section>`;
    if (!SET.tourDone) h += `<section class="card" aria-labelledby="tour-h"><h2 id="tour-h">이렇게 써요</h2><ol class="small"><li><b>경품</b>을 넣고 신호등을 봐요 — 5만원 넘는 경품은 22% 원천징수, 대납은 부담이 더 커져요.</li><li><b>공지문</b>을 복사해 올려요 — 사칭 주의·당첨자만 수집 문구가 자동으로 들어가요.</li><li>마감 후 <b>참여자 목록</b>을 붙여 넣고 공개 문구로 추첨해요. 검증 링크로 누구나 다시 돌려볼 수 있어요.</li><li>당첨자에게는 <b>꼭 필요한 정보만</b> 받고, 신고·파기 날짜를 캘린더에 넣어요.</li></ol><button class="btn ghost sm" type="button" data-act="tour-done">알겠어요</button></section>`;
    if (e) {
      h += `<section class="card" aria-labelledby="prog-h"><h2 id="prog-h">${esc(e.title || '내 이벤트')} 진행 ${done.filter(Boolean).length}/5</h2><ol class="steps">${STEPS.map((st, i) => `<li class="${done[i] ? 'done' : ''}"><a href="#/${st[0]}"><span class="no" aria-hidden="true">${done[i] ? '✓' : i + 1}</span><span><span class="t">${esc(st[1])}</span><span class="s">${done[i] ? '완료' : esc(st[3])}</span></span></a></li>`).join('')}</ol></section>`;
      if (s.count) h += `<section class="card" aria-labelledby="sum-h"><h2 id="sum-h">한눈에</h2><div class="stats">${stat('경품 총액', won(s.prizeValue), wonLen(s.prizeValue))}${stat('제세공과금', won(s.taxTotal), wonLen(s.taxTotal))}${stat('내 실제 부담', won(s.myCost), wonLen(s.myCost))}<div class="stat"><span class="small mut">신호등</span><b class="lights"><span class="num"><i class="dot g" aria-hidden="true"></i> ${s.lights.green}</span> <span class="num"><i class="dot o" aria-hidden="true"></i> ${s.lights.orange}</span> <span class="num"><i class="dot r" aria-hidden="true"></i> ${s.lights.red}</span><span class="sr">초록 ${s.lights.green}, 주황 ${s.lights.orange}, 빨강 ${s.lights.red}</span></b></div></div></section>`;
      const dl = GP.deadlines(e, R).filter(d => !e.checklist[d.check]);
      if (dl.length) h += `<section class="card" aria-labelledby="dl-h"><h2 id="dl-h">다가오는 마감</h2>${dl.slice(0, 3).map(d => `<p><span class="chip ${GP.diffDays(todayKST(), d.date) < 0 ? 'r' : GP.diffDays(todayKST(), d.date) <= 7 ? 'o' : ''}">${dd(d.date)}</span> ${fd(d.date)} ${esc(d.title)}</p>`).join('')}<a href="#/close">⑤ 마감·증빙에서 캘린더 받기</a></section>`;
    } else {
      h += `<section class="card empty" aria-labelledby="empty-h"><div class="ico" aria-hidden="true">🎁</div><h2 id="empty-h">아직 이벤트가 없어요</h2><p class="mut">경품부터 넣으면 나머지 단계가 자동으로 채워져요. 예시로 먼저 둘러봐도 좋아요.</p></section>`;
    }
    h += `<section class="card" aria-labelledby="why-h"><h2 id="why-h">왜 필요할까요?</h2><ul class="small"><li>5만원을 넘는 경품은 주는 사람이 22%를 떼서 다음 달 10일까지 신고·납부해야 해요(소득세법 제84조·제127조·제128조·제129조).</li><li>개인정보위 가이드: 발송 정보는 <b>당첨자에 한해</b> 발표 이후 수집, 발표는 아이디 일부를 가리고, 미당첨자 정보는 지체 없이 파기.</li><li>“조작 아니냐”는 질문에 검증 링크 하나로 답할 수 있어요.</li></ul><p class="small">안내 글: <a href="tax-22-percent/">경품 22% 계산</a> · <a href="personal-info-guide/">당첨자 개인정보</a> · <a href="fair-draw/">공정 추첨 검증</a></p></section>`;
    return h;
  }

  /* ---------- ① 경품 ---------- */
  function prizeForm(p) {
    p = p || { id: '', name: '', unitValue: '', qty: 1, type: 'giftcard', sender: 'me', taxBearer: 'winner' };
    const opt = (v, l) => `<option value="${v}"${p.type === v ? ' selected' : ''}>${l}</option>`;
    return `<form id="prize-form" class="card noprint" aria-labelledby="pf-h" novalidate><h2 id="pf-h">${p.id ? '경품 고치기' : '경품 추가'}</h2><input type="hidden" name="pid" value="${esc(p.id)}">
<label class="field"><span>경품 이름</span><input name="name" maxlength="60" value="${esc(p.name)}" placeholder="예: 모바일 상품권 1만원" autocomplete="off"></label>
<div class="inline2"><label class="field"><span>1개 금액(시가)</span><input name="unitValue" inputmode="numeric" value="${esc(p.unitValue)}" placeholder="예: 30000" autocomplete="off"><span class="hint">실물은 구입가가 아닌 시가</span></label><label class="field"><span>개수(당첨 인원)</span><input name="qty" inputmode="numeric" value="${esc(p.qty)}" autocomplete="off"></label></div>
<label class="field"><span>종류</span><select name="type">${opt('giftcard', '현금·상품권(계좌이체 등)')}${opt('mobile', '모바일 쿠폰·기프티콘')}${opt('physical', '실물(택배)')}${opt('contest', '대회 상금(순위 경쟁)')}</select><span class="hint">대회 상금: 다수가 순위를 겨루는 대회 입상 상금만 80% 필요경비</span></label>
<fieldset><legend>누가 보내나요?</legend><div class="row"><label class="check"><input type="radio" name="sender" value="me"${p.sender !== 'sponsor' ? ' checked' : ''}>내가</label><label class="check"><input type="radio" name="sender" value="sponsor"${p.sender === 'sponsor' ? ' checked' : ''}>협찬사가 직접</label></div></fieldset>
<fieldset><legend>세금(22%)은 누가 내나요?</legend><div class="row"><label class="check"><input type="radio" name="taxBearer" value="winner"${p.taxBearer !== 'me' ? ' checked' : ''}>당첨자</label><label class="check"><input type="radio" name="taxBearer" value="me"${p.taxBearer === 'me' ? ' checked' : ''}>내가 대납</label></div></fieldset>
<p id="pf-err" class="alert r" role="alert" hidden></p>
<div class="row end">${p.id ? '<button class="btn ghost" type="button" data-act="cancel-edit">취소</button>' : ''}<button class="btn" type="submit">${p.id ? '저장' : '경품 추가'}</button></div></form>`;
  }
  function prizeCard(p) {
    const a = assess(p);
    let h = `<li class="prize light ${LIGHT[a.light] ? LIGHT[a.light][0] : ''}"><div class="row" style="justify-content:space-between"><span class="t">${esc(p.name)}</span>${lightChip(a)}</div>
<div class="m"><span class="num">${won(a.unitValue)} × ${a.qty}</span><span class="chip">${esc(GP.TYPES[p.type])}</span>${p.sender === 'sponsor' ? '<span class="chip">협찬사 발송</span>' : ''}${a.taxable ? `<span class="chip">${a.bearer === 'me' ? '대납' : '당첨자 부담'}</span>` : ''}</div>`;
    if (a.taxable) {
      h += `<dl class="kv small"><dt>소득금액(1개)</dt><dd>${won(a.bearer === 'me' ? a.gross : a.income)}${a.contest ? ' <span class="mut">(80% 필요경비 공제)</span>' : ''}${a.approx ? ' <span class="chip need">근사치</span>' : ''}</dd><dt>세액(1개)</dt><dd>${won(a.taxUnit)}${a.bearer === 'me' ? '' : ` <span class="mut">(소득세 ${Math.round(a.incomeTax).toLocaleString('ko-KR')} + 지방 ${Math.round(a.localTax).toLocaleString('ko-KR')})</span>`}</dd><dt>내 부담(합계)</dt><dd>${won(a.myCost)}</dd><dt>지급명세서</dt><dd>${a.withholder === 'sponsor' ? '협찬사가 판단·제출' : a.statement === 'required' ? '제출 대상' : a.statement === 'exempt' ? '제출 제외 대상일 수 있음 ' + need() : '확인 필요 ' + need('대납 포함 시 10만원 초과')}</dd><dt>주민번호</dt><dd>${a.withholder === 'sponsor' ? '협찬사가 받음 — 나는 받지 않기' : a.rrn === 'required' ? '당첨자에게 필요(근거 법령 안내)' : '수집 여부 ' + need()}</dd></dl>`;
      if (p.sender === 'sponsor') h += `<p class="alert info small">협찬사가 직접 보내면 원천징수 의무자는 <b>협찬사</b>예요. 아래 확인 메시지를 협찬사에 보내 두세요. ${need('계약 내용에 따라 다를 수 있음')}</p><button class="btn ghost sm" type="button" data-act="copy-sponsor" data-id="${esc(p.id)}">협찬사 확인 메시지 복사</button>`;
    } else h += `<p class="small mut">${a.contest ? `소득금액 ${won(a.income)} ≤ 5만원` : '1건 5만원 이하'} → 원천징수 없음 · 주민번호 받지 않기</p>`;
    h += `<div class="row end noprint"><button class="btn ghost sm" type="button" data-act="edit-prize" data-id="${esc(p.id)}">고치기</button><button class="btn danger sm" type="button" data-act="del-prize" data-id="${esc(p.id)}">삭제</button></div></li>`;
    return h;
  }
  let editing = '';
  function vPrizes() {
    const e = cur(), s = GP.summarize(e.prizes, R);
    let h = stepper(0) + `<h1>① 경품 판정</h1><p class="lead">경품마다 22% 제세공과금 신호등과 내가 실제로 내는 돈을 보여 줘요.</p>
<label class="field noprint"><span>이벤트 이름</span><input id="ev-title" data-bind="title" maxlength="60" value="${esc(e.title)}" placeholder="예: 구독자 1만 명 감사 이벤트" autocomplete="off"></label>`;
    if (!e.prizes.length) h += `<div class="card empty"><div class="ico" aria-hidden="true">🎁</div><h2>경품을 넣어 주세요</h2><p class="mut">금액과 종류만 넣으면 바로 판정해요.</p></div>`;
    else {
      h += `<section class="card" aria-labelledby="ps-h"><h2 id="ps-h">합계</h2><div class="stats">${stat('경품 총액', won(s.prizeValue), wonLen(s.prizeValue))}${stat('제세공과금', won(s.taxTotal), wonLen(s.taxTotal))}${stat('내 실제 부담', won(s.myCost), wonLen(s.myCost))}${stat('당첨 인원', `<span class="num">${s.units}명</span>`, s.units + '명')}</div>`;
      if (s.needWithholding) h += `<p class="alert o small">원천징수할 경품이 있어요. 지급한 달의 다음 달 10일까지 신고·납부해야 해요(⑤에서 날짜 계산).</p>`;
      else h += `<p class="alert g small">내가 원천징수할 경품이 없어요. 당첨자 주민번호는 받지 마세요.</p>`;
      h += `</section><ul class="list" aria-label="경품 목록">${e.prizes.map(prizeCard).join('')}</ul><div class="sumbar noprint" aria-label="합계"><span>경품비 ${won(s.prizeValue)}</span><span>제세공과금 ${won(s.taxTotal)}</span><span>내 부담 <b>${won(s.myCost)}</b></span></div>`;
    }
    h += prizeForm(editing ? e.prizes.find(p => p.id === editing) : null);
    h += `<details class="noprint"><summary>계산 기준과 출처 (기준일 ${esc(R.checkedAt)})</summary><div class="small"><ul><li>건별 5만원 이하 기타소득은 과세하지 않아요 — ${src('income84')}</li><li>원천징수세율 20%, 지방소득세는 그 10% → 합계 22% — ${src('income129')} · ${src('localTax')}</li><li>대회 상금 80% 필요경비 — ${src('decree87')}</li><li>1건 10만원 이하 추첨 경품 지급명세서 제출 제외 — ${src('decree214')}</li><li>대납 시 세액도 소득에 포함하는 계산(gross-up)은 세무사 칼럼 기준의 근사치예요 — ${src('winnertax')} ${need('세무사 확인')}</li><li>끝수(원 단위) 처리: 원 미만 버림으로 계산했어요 ${need('신고 시스템 기준')}</li></ul></div></details>`;
    return h + nextLink(0);
  }
  function sponsorMsg(p) {
    const a = assess(p);
    return `안녕하세요, ${ev().title || '구독자 이벤트'} 주최자입니다. 협찬해 주신 「${p.name}」(시가 ${a.unitValue.toLocaleString('ko-KR')}원 × ${a.qty}개)을 당첨자에게 직접 발송해 주실 예정이라 확인 부탁드려요.\n\n1) 1건 5만원을 넘는 경품이라 제세공과금(22%) 원천징수·신고를 귀사에서 진행하시는지\n2) 세금은 ${a.bearer === 'me' ? '주최 측 부담(대납)' : '당첨자 부담'}으로 안내해도 되는지\n3) 당첨자 개인정보(성명·연락처·주소·주민등록번호 등)는 귀사가 직접 받으시는지, 보유·파기 기간은 어떻게 되는지\n\n공지문에 그대로 안내하려고 해요. 감사합니다.`;
  }

  /* ---------- ② 공지문 ---------- */
  function vNotice() {
    const e = cur(), n = e.notice;
    const sel = (k, v) => (n[k] === v ? ' selected' : '');
    const text = GP.noticeText(e, R);
    let h = stepper(1) + `<h1>② 공지문</h1><p class="lead">개인정보위 가이드에 맞춘 안전 문구가 자동으로 들어가요. 고친 내용은 바로 저장돼요.</p>`;
    if (!e.prizes.length) h += `<p class="alert o">경품이 아직 없어요. <a href="#/prizes">① 경품</a>을 먼저 넣으면 22% 안내가 맞게 들어가요.</p>`;
    h += `<form class="card noprint" id="notice-form" aria-labelledby="nf-h"><h2 id="nf-h">기본 정보</h2>
<div class="inline2"><label class="field"><span>플랫폼</span><select data-bind="notice.platform">${Object.entries(GP.PLAT).map(([k, l]) => `<option value="${k}"${sel('platform', k)}>${l}</option>`).join('')}</select></label><label class="field"><span>공식 계정</span><input data-bind="notice.handle" maxlength="40" value="${esc(n.handle)}" placeholder="@내채널" autocomplete="off"></label></div>
<label class="field"><span>참여 방법</span><input data-bind="notice.how" maxlength="300" value="${esc(n.how)}" placeholder="예: 이 영상에 댓글 달기(1인 1회)" autocomplete="off"><span class="hint">아이디·댓글만으로 참여하게 하세요. 응모 단계에서 연락처를 받지 않아요.</span></label>
<div class="inline2"><label class="field"><span>시작일</span><input type="date" data-bind="notice.start" value="${esc(n.start)}"></label><label class="field"><span>마감일</span><input type="date" data-bind="notice.end" value="${esc(n.end)}"></label></div>
<div class="inline2"><label class="field"><span>발표일</span><input type="date" data-bind="notice.announceDate" value="${esc(n.announceDate)}"></label><label class="field"><span>답장 기한(일)</span><input inputmode="numeric" data-bind="notice.replyDays" value="${esc(n.replyDays)}"></label></div>
<fieldset><legend>발표 방법</legend><div class="row"><label class="check"><input type="radio" name="am" data-bind="notice.announceMethod" value="dm"${n.announceMethod !== 'list' ? ' checked' : ''}>개별 DM(권장)</label><label class="check"><input type="radio" name="am" data-bind="notice.announceMethod" value="list"${n.announceMethod === 'list' ? ' checked' : ''}>목록 공개(일부 가림)</label></div></fieldset>
<label class="field"><span>추첨 문구 출처(미리 약속)</span><input data-bind="notice.phraseSource" maxlength="120" value="${esc(n.phraseSource)}" placeholder="예: 12월 12일 로또 6/45 당첨번호" autocomplete="off"><span class="hint">마감 뒤에야 알 수 있는 공개 값으로 미리 정해 두면 주최자도 결과를 고를 수 없어요.</span></label>
<p id="date-err" class="alert r small" role="alert" ${datesOk(n) ? 'hidden' : ''}>날짜 순서를 확인해 주세요: 시작일 ≤ 마감일 ≤ 발표일</p></form>
<section class="card" aria-labelledby="no-h"><h2 id="no-h">공지문 미리보기</h2><pre class="out" id="notice-out" tabindex="0" aria-label="공지문 미리보기">${esc(text)}</pre><p class="small mut" id="notice-len">${text.length.toLocaleString('ko-KR')}자${text.length > 1500 ? ' · 글이 길어요. 플랫폼에 따라 ‘더보기’로 접히거나 잘릴 수 있어요.' : ''}</p>
<div class="grid2 noprint"><button class="btn" type="button" data-act="copy-notice">공지문 복사</button><a class="btn ghost" href="#/draw">③ 추첨으로</a></div></section>
<section class="card" aria-labelledby="auto-h"><h2 id="auto-h">자동으로 들어간 문구와 이유</h2><ul class="autos small"><li><b>사칭 주의</b> — 당첨 안내를 사칭한 개인정보·입금 요구 피해를 막아요. ${src('pipcNews')}</li><li><b>댓글에 연락처 쓰지 않기</b> — 응모 단계에서는 아이디만. ${src('pipcNews')}</li><li><b>당첨자에 한해 발표 이후 수집</b> — 가이드 예시 문구 그대로예요. ${src('pipc2023')}</li><li><b>발송에만 이용·지체 없이 파기, 미당첨자 정보 파기</b> ${src('pipc2023')}</li>${GP.summarize(e.prizes, R).taxableUnits ? `<li><b>제세공과금 22%·부담 주체·주민번호 수집 근거 법령</b> — 5만원 초과 경품이 있어서 들어갔어요. ${src('income129')}</li>` : ''}<li><b>미제출 시 처리</b> — 답이 없으면 예비 당첨자에게 넘어가요.</li></ul><p class="small">2023.5. 가이드는 현재 「분야별 개인정보 보호 안내서(2024.12.)」로 통합됐어요 — ${src('pipc2024')} ${need('통합본 세부 문구')}</p></section>`;
    return h + nextLink(1);
  }
  const datesOk = n => !((n.start && n.end && n.start > n.end) || (n.end && n.announceDate && n.end > n.announceDate));

  /* ---------- ③ 추첨 ---------- */
  function parsed(e) {
    const p = GP.parseParticipants(e.participantsRaw);
    const f = GP.filterEntries(p.entries, e.drawOpts);
    return { p, f, ids: GP.normalizedIds(f.list) };
  }
  function recomputeWinners(e) {
    if (!e.draw || !e.participantsRaw) return null;
    const { f, ids } = parsed(e);
    if (GP.listHashOf(ids) !== e.draw.listHash) return null;
    const r = GP.draw({ ids, phrase: e.draw.phrase, prizes: e.prizes, reserves: e.draw.reserves.length });
    const first = {}; f.list.forEach(x => { if (!first[x.norm]) first[x.norm] = x; });
    return { winners: r.winners.map(w => ({ ...w, orig: (first[w.norm] || {}).id || w.norm })), reserves: r.reserves.map(id => (first[id] || {}).id || id) };
  }
  function parseStats(e) {
    if (!e.participantsRaw.trim()) return '<p class="mut small">아직 목록이 없어요.</p>';
    const { p, f, ids } = parsed(e);
    return `<p class="small"><b>${p.format === 'csv' ? 'CSV' : '한 줄 텍스트'}</b>로 읽었어요: 원본 <span class="num">${p.entries.length}줄</span> → 추첨 대상 <b class="num">${ids.length}명</b>${f.removedDup ? ` · 중복 ${f.removedDup}` : ''}${f.removedKeyword ? ` · 키워드 없음 ${f.removedKeyword}` : ''}${f.removedExcluded ? ` · 제외 ${f.removedExcluded}` : ''}${p.skipped ? ` · 읽지 못한 줄 ${p.skipped}` : ''}</p><p class="small">목록 지문(SHA-256): <span class="mono" id="list-hash">${GP.listHashOf(ids)}</span></p>`;
  }
  function winnersBlock(e) {
    const d = e.draw;
    const re = recomputeWinners(e);
    let h = `<section class="card" aria-labelledby="res-h"><h2 id="res-h">추첨 결과</h2><p class="small mut">추첨 ${esc(d.drawnAt)} · 대상 <span class="num">${d.participantCount}명</span> · 문구 “${esc(d.phrase)}”</p><div id="winners">`;
    d.winners.forEach((w, i) => {
      const p = prizeById(w.prizeId);
      h += `<div class="winner"><span><span class="small mut">${esc(p ? p.name : '삭제된 경품')}</span><br><span class="id">${esc(w.maskedId)}</span>${w.commentAt ? ` <span class="small mut num">댓글 ${esc(w.commentAt)}</span>` : ''}</span>${re && re.winners[i] ? `<span class="small">원본: <b>${esc(re.winners[i].orig)}</b></span>` : ''}</div>`;
    });
    if (d.reserves.length) h += `<p class="small"><b>예비</b>: ${d.reserves.map((r, i) => `${i + 1}. ${esc(r.maskedId)}${re && re.reserves[i] ? ` (원본 ${esc(re.reserves[i])})` : ''}`).join(' · ')}</p>`;
    const mk = d.winners.map(w => w.maskedId + '|' + w.commentAt), mOnly = d.winners.map(w => w.maskedId);
    if (new Set(mOnly).size < mOnly.length) h += `<p class="alert o small">가린 아이디가 같은 당첨자가 있어요${new Set(mk).size < mk.length ? '' : '(댓글 시간으로는 구분돼요)'}. 발표문에 댓글 시간을 함께 쓰거나 ‘중간 가리기’를 고려하세요(추첨 결과는 그대로).</p>`;
    h += `</div>${re ? '<p class="small mut">원본 아이디는 저장하지 않아요. 아래 참여자 목록이 남아 있는 동안만 다시 계산해 보여 줘요.</p>' : '<p class="small mut">원본 아이디는 저장하지 않았어요(마스킹본만 저장). DM 보낼 때는 플랫폼 댓글에서 확인하세요.</p>'}
<div class="grid2 noprint"><button class="btn" type="button" data-act="copy-announce">발표문 복사</button><button class="btn ghost" type="button" data-act="copy-verify">검증 링크 복사</button><button class="btn ghost" type="button" data-act="dl-list"${e.participantsRaw ? '' : ' disabled'}>검증용 목록 받기</button><a class="btn ghost" href="#/verify/${GP.encodeVerify(e)}">검증 화면 보기</a></div>
<details class="noprint"><summary>추첨 다시 하기</summary><div><p class="small">같은 문구·같은 목록이면 결과는 늘 같아요. 문구를 바꿔 다시 뽑으면 신뢰를 잃을 수 있어요.</p><button class="btn danger sm" type="button" data-act="reset-draw">추첨 기록 지우기</button></div></details></section>`;
    return h;
  }
  function vDraw() {
    const e = cur(), o = e.drawOpts;
    let h = stepper(2) + `<h1>③ 공정 추첨</h1><p class="lead">참여자 목록 지문(해시)과 미리 약속한 공개 문구로 뽑아요. 누구나 같은 결과를 다시 만들 수 있어요.</p>`;
    if (!e.prizes.length) return h + `<div class="card empty"><div class="ico" aria-hidden="true">🎲</div><h2>경품이 있어야 추첨할 수 있어요</h2><a class="btn" href="#/prizes">① 경품 넣기</a></div>`;
    if (e.draw) h += winnersBlock(e);
    if (e.draw && e.participantsRaw) h += `<div class="alert o noprint" role="note"><p><b>추첨이 끝났어요.</b> 미당첨자 정보는 지체 없이 파기하는 게 원칙이에요. 검증용 목록을 받아 둔 뒤 아래 ‘목록 지우기’를 눌러 주세요.</p></div>`;
    h += `<section class="card noprint" aria-labelledby="pl-h"><h2 id="pl-h">1. 참여자 목록</h2><label class="field"><span>댓글 목록 붙여 넣기</span><textarea id="raw" data-bind="participantsRaw" placeholder="한 줄에 한 명: @아이디 댓글 내용 2026-12-05 21:10&#10;또는 CSV(아이디,댓글,시간)" spellcheck="false">${esc(e.participantsRaw)}</textarea><span class="hint">아이디·댓글·시간만 넣으세요. 연락처가 섞여 있다면 지운 뒤 붙여 넣으세요.</span></label>
<div class="row"><label class="btn ghost sm" for="raw-file">파일 불러오기(.txt·.csv)</label><input id="raw-file" type="file" accept=".txt,.csv,text/plain,text/csv" hidden><button class="btn ghost sm" type="button" data-act="sample-list">예시 목록</button><button class="btn danger sm" type="button" data-act="clear-raw"${e.participantsRaw ? '' : ' disabled'}>목록 지우기</button></div>
<fieldset><legend>정리 규칙</legend><label class="check"><input type="checkbox" data-bind="drawOpts.dedupe"${o.dedupe ? ' checked' : ''}>같은 아이디 중복 제거(1인 1회)</label>
<div class="inline2"><label class="field"><span>필수 키워드</span><input data-bind="drawOpts.keyword" maxlength="60" value="${esc(o.keyword)}" placeholder="예: 1만 축하" autocomplete="off"></label><label class="field"><span>예비 당첨자 수</span><input inputmode="numeric" data-bind="drawOpts.reserves" value="${esc(o.reserves)}"></label></div>
<label class="field"><span>제외할 아이디</span><textarea data-bind="drawOpts.exclude" style="min-height:70px" placeholder="본인·운영진·지난 당첨자 (줄바꿈·쉼표로 구분)" spellcheck="false">${esc(o.exclude)}</textarea></label>
<label class="field"><span>발표 마스킹</span><select data-bind="drawOpts.maskMode"><option value="end"${o.maskMode === 'end' ? ' selected' : ''}>끝 3자 가리기 (chppe***)</option><option value="middle"${o.maskMode === 'middle' ? ' selected' : ''}>중간 가리기 (c*pp*ac*)</option></select></label></fieldset>
<div id="parse-out" aria-live="polite">${parseStats(e)}</div>
<button class="btn ghost sm" type="button" data-act="copy-hash"${e.participantsRaw ? '' : ' disabled'}>목록 지문 복사(추첨 전 공개용)</button></section>
<form class="card noprint" id="draw-form" aria-labelledby="dr-h" novalidate><h2 id="dr-h">2. 공개 문구로 추첨</h2><label class="field"><span>추첨 문구</span><input id="phrase" maxlength="300" autocomplete="off" placeholder="${esc(e.notice.phraseSource || '예: 3 11 19 25 34 42 + 7')}" value="${e.draw ? esc(e.draw.phrase) : ''}"><span class="hint">공지에서 약속한 값을 그대로. 띄어쓰기 하나만 달라도 결과가 달라져요.</span></label><p id="draw-err" class="alert r" role="alert" hidden></p><button class="btn wide" type="submit">${e.draw ? '같은 조건으로 다시 확인' : '추첨하기'}</button></form>
<details><summary>추첨 방식(누구나 재현 가능)</summary><div class="small"><ol><li>아이디 앞뒤 공백·@ 제거, 소문자로 바꾸고(선택) 중복 제거, 가나다·알파벳 순 정렬</li><li>목록 지문 = SHA-256(아이디들을 줄바꿈으로 이은 글)</li><li>시드 = SHA-256(문구 + "|" + 목록 지문)</li><li>시드 앞 16바이트 → 32비트 정수 4개로 sfc32 난수 시작, 처음 12개 버림</li><li>Fisher–Yates 섞기(i = n−1…1, j = ⌊난수×(i+1)⌋) 후 경품 순서대로 배정, 한 사람 1개, 다음 순서가 예비</li></ol></div></details>`;
    return h + nextLink(2);
  }

  /* ---------- ④ 당첨 안내 ---------- */
  function vWinners() {
    const e = cur();
    let h = stepper(3) + `<h1>④ 당첨 안내</h1><p class="lead">경품마다 꼭 필요한 정보만 받는 DM·수집 안내·구글폼 질문을 만들어요.</p>`;
    if (!e.prizes.length) return h + `<div class="card empty"><div class="ico" aria-hidden="true">✉️</div><h2>경품이 없어요</h2><a class="btn" href="#/prizes">① 경품 넣기</a></div>`;
    if (!e.draw) h += `<p class="alert info small">아직 추첨 전이에요. 안내문은 미리 만들어 둘 수 있어요.</p>`;
    e.prizes.forEach(p => {
      const c = GP.collectItems(p, R), a = c.a;
      const w = e.draw ? e.draw.winners.filter(x => x.prizeId === p.id) : [];
      h += `<section class="card light ${LIGHT[a.light] ? LIGHT[a.light][0] : ''}" aria-label="${esc(p.name)} 안내"><h2>${esc(p.name)} ${lightChip(a)}</h2>${w.length ? `<p class="small">당첨: ${w.map(x => `<b>${esc(x.maskedId)}</b>`).join(', ')}</p>` : ''}`;
      if (p.sender === 'sponsor') h += `<p class="alert info small">협찬사가 직접 발송 — 당첨자 정보는 협찬사가 받도록 안내하고, 나는 아이디만 전달해요. ${a.taxable ? '원천징수 의무자도 협찬사예요.' : ''}</p>`;
      h += `<h3>받을 정보</h3><table><caption class="small mut" style="text-align:left">수집 항목·이유</caption><thead><tr><th scope="col">항목</th><th scope="col">이유</th></tr></thead><tbody>${c.items.map(i => `<tr><td>${esc(i.k)}${i.optional ? ' <span class="chip">필요 시</span>' : ''}${i.check ? ' ' + need() : ''}</td><td>${esc(i.why)}</td></tr>`).join('')}</tbody></table>`;
      if (!a.taxable) h += `<p class="small alert g">5만원 이하 — <b>주민등록번호를 받지 마세요.</b> 받으면 과다 수집이에요(개인정보위 가이드).</p>`;
      const hasCheck = c.items.some(i => i.check);
      if (hasCheck) h += `<label class="check small noprint"><input type="checkbox" data-act="inc-check" data-id="${esc(p.id)}"${incCheck[p.id] ? ' checked' : ''}>‘확인 필요’ 주민번호 항목도 안내문에 넣기(세무사 확인 후)</label>`;
      h += `<details><summary>당첨 DM 문구</summary><div><pre class="out" tabindex="0" aria-label="DM 문구">${esc(GP.dmText(e, { prizeId: p.id }, R, { includeCheck: !!incCheck[p.id] }))}</pre><button class="btn sm" type="button" data-act="copy-dm" data-id="${esc(p.id)}">DM 문구 복사</button></div></details>
<details><summary>구글폼 질문 목록</summary><div><ol class="small">${GP.formQuestions(p, R, { includeCheck: !!incCheck[p.id] }).map(q => `<li>${esc(q)}</li>`).join('')}</ol><p class="small mut">응답 시트는 발송 후 보유기간이 지나면 폼·시트째 지우세요.</p><button class="btn ghost sm" type="button" data-act="copy-form" data-id="${esc(p.id)}">질문 목록 복사</button></div></details></section>`;
    });
    h += `<section class="card" aria-labelledby="nr-h"><h2 id="nr-h">미제출 처리 규칙</h2><p>당첨 안내 후 <b class="num">${e.notice.replyDays}일</b> 안에 답이 없으면 당첨을 취소하고 예비 당첨자 순서대로 넘겨요. 취소된 당첨자에게 받은 정보가 있다면 바로 파기해요.</p><button class="btn ghost sm noprint" type="button" data-act="copy-norule">규칙 문구 복사</button></section>
<details><summary>근거</summary><div class="small"><ul><li>모바일 쿠폰은 연락처, 실물은 성명·연락처·주소, 5만원 초과로 제세공과금 신고가 필요하면 주민등록번호(근거 법령 고지) — ${src('pipc2023')}</li><li>1건 10만원 이하 추첨 경품은 지급명세서 제출 제외 → 주민번호가 필요 없을 수 있음 — ${src('decree214')} · ${src('pipcQA')}</li><li>계좌정보는 가이드 예시에 없어서 ‘필요한 경우에만’으로 표시했어요 ${need()}</li></ul></div></details>`;
    return h + nextLink(3);
  }
  const incCheck = {};

  /* ---------- ⑤ 마감·증빙 ---------- */
  function vClose() {
    const e = cur(), py = e.payout, s = GP.summarize(e.prizes, R);
    const dl = GP.deadlines(e, R);
    let h = stepper(4) + `<h1>⑤ 마감·증빙</h1><p class="lead">지급일·발송일을 넣으면 원천세·지급명세서·파기 날짜를 계산해 캘린더(.ics)로 드려요.</p>
<form class="card noprint" aria-labelledby="pd-h"><h2 id="pd-h">날짜</h2><div class="inline2"><label class="field"><span>경품 지급일</span><input type="date" data-bind="payout.paidDate" value="${esc(py.paidDate)}"><span class="hint">상품권 발송·이체한 날</span></label><label class="field"><span>발송 완료일</span><input type="date" data-bind="payout.shippedDate" value="${esc(py.shippedDate)}"></label></div><label class="field"><span>당첨자 정보 보유기간(발송 후 일수)</span><input inputmode="numeric" data-bind="payout.retentionDays" value="${esc(py.retentionDays)}"><span class="hint">공지·DM에 안내한 기간과 같아야 해요</span></label></form>`;
    if (!dl.length) h += `<div class="card empty"><div class="ico" aria-hidden="true">📅</div><h2>계산할 날짜가 아직 없어요</h2><p class="mut">${s.needWithholding ? '지급일을 넣으면 원천세·지급명세서 기한이 나와요.' : '원천징수할 경품은 없어요. 추첨일·발송일을 넣으면 파기 날짜가 나와요.'}</p></div>`;
    else {
      h += `<section class="card" aria-labelledby="dl2-h"><h2 id="dl2-h">마감 일정</h2><div id="deadlines">${dl.map(d => `<div class="deadline"><span class="chip ${GP.diffDays(todayKST(), d.date) < 0 && !e.checklist[d.check] ? 'r' : GP.diffDays(todayKST(), d.date) <= 7 ? 'o' : ''}">${dd(d.date)}</span><div><span class="d">${fd(d.date)}</span> <b>${esc(d.title)}</b>${d.optional ? ' ' + need('면제 여부') : ''}${d.shift && d.shift.shifted ? `<p class="small alert o">법정기한 ${fd(d.legal)}이 ${esc(d.shift.reasons.join(', '))}이라 다음 날로 밀려요(국세기본법 제5조).</p>` : ''}${d.shift && d.shift.holidayUnknown ? `<p class="small">${need('공휴일')} 이 날짜는 확인된 공휴일 목록(${esc(R.holidays.from)}~${esc(R.holidays.through)}) 밖이라 주말만 반영했어요.</p>` : ''}<p class="small mut">${esc(d.desc)}</p><label class="check small"><input type="checkbox" data-check="${esc(d.check)}"${e.checklist[d.check] ? ' checked' : ''}>완료</label></div></div>`).join('')}</div>
<div class="grid2 noprint"><button class="btn" type="button" data-act="ics">캘린더(.ics) 받기</button><a class="btn ghost" href="${esc(R.sources.hometax.url)}" target="_blank" rel="noopener">홈택스 열기</a></div><p class="small mut">아이폰: 파일을 열고 ‘모두 추가’ · 안드로이드: 파일을 구글 캘린더 앱으로 열기. 하루 전 알림이 들어 있어요.</p></section>`;
    }
    h += `<section class="card" aria-labelledby="ck-h"><h2 id="ck-h">증빙 체크리스트</h2>${CHECKS.filter(([k]) => k !== 'rrnDeleted' || s.rrnAny).map(([k, l]) => `<label class="check"><input type="checkbox" data-check="${k}"${e.checklist[k] ? ' checked' : ''}>${esc(l)}</label>`).join('')}<p class="small mut">증빙 3종(영수증·당첨자 발표 캡처·지급 증빙)은 세무 신고 때 필요해요.</p><a class="btn ghost noprint" href="#/report">결산 한 장(인쇄)</a></section>
<details><summary>기한 근거 (기준일 ${esc(R.checkedAt)})</summary><div class="small"><ul><li>원천세: 징수일이 속하는 달의 다음 달 10일 — ${src('income128')}</li><li>지방소득세(소득세의 10%) 같은 날 — ${src('localTax')}</li><li>지급명세서: 다음 연도 2월 말일, 미제출 가산세 1% — ${src('income164')} · ${src('penalty')}</li><li>기한이 토·일·공휴일이면 다음 날 — ${src('basic5')} · ${src('ntsSchedule')} · 공휴일 ${src('kasa')}</li><li>반기별 납부 승인을 받은 사업자는 기한이 달라요 ${need()}</li><li>파기: 보유기간 경과 시 지체 없이 — ${src('pipc2023')}</li></ul></div></details>`;
    return h + nextLink(4);
  }

  /* ---------- 결산 한 장 ---------- */
  function vReport() {
    const e = ev();
    if (!e) return `<h1>결산 한 장</h1><div class="card empty"><p>이벤트가 없어요.</p><a class="btn" href="#/">홈으로</a></div>`;
    const s = GP.summarize(e.prizes, R), dl = GP.deadlines(e, R);
    return `<h1>결산 한 장 — ${esc(e.title || '구독자 이벤트')}</h1><p class="small mut">작성 ${esc(nowKST())} (한국 시간) · 기준일 ${esc(R.checkedAt)} · 이 기기에서 생성</p><p class="noprint"><button class="btn" type="button" data-act="print">인쇄·PDF 저장</button></p>
<section class="card"><h2>경품</h2><ul class="list noprint">${e.prizes.map(p => { const a = assess(p); return `<li><b>${esc(p.name)}</b>${p.sender === 'sponsor' ? ' (협찬사)' : ''}<br><span class="small">${esc(LIGHT[a.light] ? LIGHT[a.light][1] : '')}</span><dl class="kv small"><dt>금액×수량</dt><dd>${won(a.unitValue)} × <span class="num">${a.qty}</span></dd><dt>세액</dt><dd>${won(a.taxTotal)}</dd><dt>내 부담</dt><dd>${won(a.myCost)}</dd></dl></li>`; }).join('')}<li><b>합계</b><dl class="kv small"><dt>경품 총액</dt><dd>${won(s.prizeValue)}</dd><dt>세액</dt><dd>${won(s.taxTotal)}</dd><dt>내 부담</dt><dd>${won(s.myCost)}</dd></dl></li></ul><div class="tablewrap printonly"><table><thead><tr><th scope="col">경품</th><th scope="col">금액×수량</th><th scope="col">판정</th><th scope="col">세액</th><th scope="col">내 부담</th></tr></thead><tbody>${e.prizes.map(p => { const a = assess(p); return `<tr><td>${esc(p.name)}${p.sender === 'sponsor' ? ' (협찬사)' : ''}</td><td>${won(a.unitValue)}×${a.qty}</td><td>${esc(LIGHT[a.light] ? LIGHT[a.light][1] : '')}</td><td>${won(a.taxTotal)}</td><td>${won(a.myCost)}</td></tr>`; }).join('')}<tr><th scope="row">합계</th><td>${won(s.prizeValue)}</td><td></td><td>${won(s.taxTotal)}</td><td>${won(s.myCost)}</td></tr></tbody></table></div></section>
<section class="card"><h2>추첨</h2>${e.draw ? `<p class="small">문구 “${esc(e.draw.phrase)}” · 대상 ${e.draw.participantCount}명 · ${esc(e.draw.drawnAt)}</p><p class="small">목록 지문 <span class="mono">${e.draw.listHash}</span></p><p>${e.draw.winners.map(w => `${esc((prizeById(w.prizeId) || {}).name || '')}: <b>${esc(w.maskedId)}</b>`).join(' · ')}</p>` : '<p class="mut">아직 추첨 전</p>'}</section>
<section class="card"><h2>마감·증빙</h2>${dl.length ? `<ul>${dl.map(d => `<li>${e.checklist[d.check] ? '☑' : '☐'} ${fd(d.date)} ${esc(d.title)}</li>`).join('')}</ul>` : '<p class="mut">날짜 미입력</p>'}<ul>${CHECKS.slice(0, 3).map(([k, l]) => `<li>${e.checklist[k] ? '☑' : '☐'} ${esc(l)}</li>`).join('')}</ul></section>
<p class="small mut">비공식 계산 보조 도구예요. 세무 처리는 세무사·국세청(126), 개인정보는 개인정보위 안내를 따르세요.</p>`;
  }

  /* ---------- 검증 ---------- */
  function vVerify(arg) {
    const pl = arg ? GP.decodeVerify(arg) : null;
    let h = `<h1>추첨 검증</h1><p class="lead">공개된 문구와 참여자 목록으로 같은 당첨자가 나오는지 이 기기에서 직접 확인해요.</p>`;
    if (!arg) return h + `<section class="card"><h2>검증 링크가 필요해요</h2><p class="small">주최자가 공개한 검증 링크를 열거나, 아래에 붙여 넣으세요.</p><form id="vlink-form" novalidate><label class="field"><span>검증 링크</span><input id="vlink" autocomplete="off" placeholder="https://…#/verify/…"></label><p id="vlink-err" class="alert r" role="alert" hidden></p><button class="btn" type="submit">열기</button></form></section>`;
    if (!pl) return h + `<div class="alert r" role="alert"><p><b>검증 링크를 읽지 못했어요.</b> 링크가 잘렸거나 바뀌었을 수 있어요. 주최자에게 원래 링크를 다시 받아 주세요.</p></div><a class="btn ghost" href="#/verify">다른 링크 넣기</a>`;
    h += `<section class="card"><h2>${esc(pl.t || '구독자 이벤트')}</h2><dl class="kv small"><dt>문구</dt><dd>“${esc(pl.p)}”</dd><dt>참여자</dt><dd><span class="num">${esc(pl.n)}명</span></dd><dt>목록 지문</dt><dd class="mono">${esc(pl.h)}</dd><dt>방식</dt><dd>${esc(pl.a)}</dd>${pl.at ? `<dt>추첨</dt><dd>${esc(pl.at)}</dd>` : ''}</dl>
<h3>공개된 당첨자</h3><ul class="small">${pl.w.map(w => { const z = pl.z.find(x => x[0] === w[0]); return `<li>${esc(z ? z[1] : '')}: <b>${esc(w[1])}</b>${w[2] ? ` (댓글 ${esc(w[2])})` : ''}</li>`; }).join('')}</ul></section>
<form class="card" id="verify-form" novalidate aria-labelledby="vf-h"><h2 id="vf-h">참여자 목록으로 확인</h2><p class="small">주최자가 공개한 검증용 목록(.txt, 한 줄에 아이디 하나)을 올리거나 붙여 넣으세요.</p><div class="row"><label class="btn ghost sm" for="vfile">목록 파일 올리기</label><input id="vfile" type="file" accept=".txt,text/plain" hidden></div><label class="field"><span>또는 붙여 넣기</span><textarea id="vtext" spellcheck="false"></textarea></label><button class="btn" type="submit">다시 추첨해 비교</button></form><div id="vresult" aria-live="polite"></div>`;
    return h;
  }
  function showVerify(pl, text) {
    const out = $('#vresult'); if (!out) return;
    if (!text.trim()) { out.innerHTML = '<p class="alert o" role="alert">목록이 비어 있어요.</p>'; return; }
    const r = GP.verifyWith(pl, text);
    let h = r.match ? `<div class="alert g" role="alert"><p class="verdict"><span class="big">✓ 일치</span></p><p>같은 문구와 목록으로 다시 뽑았더니 공개된 당첨자와 똑같아요.</p></div>` : `<div class="alert r" role="alert"><p class="verdict"><span class="big">✗ 불일치</span></p><p>${r.hashMatch ? '목록은 같지만 당첨자가 달라요. 공개된 결과가 바뀌었을 수 있어요.' : `목록 지문이 달라요(올린 목록 ${r.count}명${r.countMatch ? '' : ` / 공개 ${pl.n}명`}). 한 글자라도 다르면 지문이 달라져요.`}</p></div>`;
    h += `<p class="small">올린 목록 지문: <span class="mono">${r.listHash}</span></p>`;
    if (r.rows.length) h += `<div class="tablewrap"><table><thead><tr><th scope="col">경품</th><th scope="col">공개</th><th scope="col">재계산</th><th scope="col">결과</th></tr></thead><tbody>${r.rows.map(x => `<tr><td>${esc(x.prizeName)}</td><td>${esc(x.published)}</td><td>${esc(x.recomputed)}</td><td>${x.same ? '일치' : '불일치'}</td></tr>`).join('')}</tbody></table></div>`;
    out.innerHTML = h;
  }

  /* ---------- 도움말 ---------- */
  function vHelp() {
    const st = GP.selfTest(R), ok = st.filter(x => x.ok).length;
    return `<h1>도움말·출처</h1><section class="card"><h2>꼭 알아 두세요</h2><p>이 앱은 비공식 계산·작성 보조 도구예요. 세법 해석·신고 대리가 아니며, 결과는 참고용이에요. 금액이 크거나 애매하면 세무사·국세청(126)에, 개인정보는 개인정보보호위원회 안내에 따르세요. 규칙 확인 기준일: <b>${esc(R.checkedAt)}</b></p></section>
<section class="card"><h2>규칙 요약</h2><div class="tablewrap"><table><thead><tr><th scope="col">항목</th><th scope="col">값</th><th scope="col">상태</th></tr></thead><tbody>
<tr><td>과세최저한(건별)</td><td>5만원 이하 비과세</td><td>법령 확인</td></tr><tr><td>원천징수 세율</td><td>20% + 지방 2% = 22%</td><td>법령 확인</td></tr><tr><td>대회 상금 필요경비</td><td>80%</td><td>법령 확인</td></tr><tr><td>지급명세서 제외</td><td>추첨 경품 1건 10만원 이하</td><td>국세청 확인</td></tr><tr><td>원천세 기한</td><td>다음 달 10일</td><td>법령 확인</td></tr><tr><td>지급명세서 기한</td><td>다음 연도 2월 말일</td><td>법령 확인</td></tr><tr><td>대납 gross-up</td><td>V ÷ (1 − 0.22)</td><td>확인 필요</td></tr><tr><td>5만~10만원 주민번호</td><td>필요 없을 수 있음</td><td>확인 필요</td></tr></tbody></table></div></section>
<section class="card"><h2>출처</h2><ul class="small">${Object.keys(R.sources).map(k => `<li>${src(k)} <span class="mut">(${esc(R.sources[k].kind)})</span></li>`).join('')}</ul></section>
<section class="card"><h2>내 데이터</h2><p class="small">모든 데이터는 이 브라우저 저장소(${KEY})에만 있어요. 서버로 보내지 않고, 분석 도구도 없어요.</p><div class="grid2"><button class="btn ghost" type="button" data-act="backup">백업 받기</button><label class="btn ghost" for="restore">복원하기</label></div><input id="restore" type="file" accept=".json,application/json" hidden><p class="row" style="margin-top:8px"><button class="btn danger" type="button" data-act="wipe">모든 데이터 지우기</button></p></section>
<section class="card"><h2>자체 점검 ${ok}/${st.length}</h2><ul class="small">${st.map(x => `<li>${x.ok ? '✓' : '✗'} ${esc(x.name)}</li>`).join('')}</ul></section>
<section class="card"><h2>프로(준비 중)</h2><p class="small">여러 이벤트 보관, 협찬사 정산서, 발표 이미지 카드를 준비하고 있어요.</p><button class="btn pink" type="button" data-act="pro">${SET.proInterest ? '알림 신청됨' : '출시 알림 받기'}</button></section>
<p class="small"><a href="privacy.html">개인정보 안내</a> · <a href="tax-22-percent/">경품 22% 계산</a> · <a href="personal-info-guide/">당첨자 개인정보</a> · <a href="fair-draw/">공정 추첨 검증</a></p>`;
  }

  /* ---------- 라우터 ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, ...rest] = h.split('/');
    return { name: name || '', arg: rest.join('/') };
  }
  const TITLES = { '': APP + ' — 경품 22%·공정 추첨·당첨자 개인정보', prizes: '① 경품 판정', notice: '② 공지문', draw: '③ 공정 추첨', winners: '④ 당첨 안내', close: '⑤ 마감·증빙', report: '결산 한 장', verify: '추첨 검증', help: '도움말·출처' };
  function pageTitle(rt = route()) { const t = TITLES[rt.name]; return rt.name === '' || !t ? TITLES[''] : `${t} — ${APP}`; }
  function render() {
    const rt = route();
    const map = { '': vHome, prizes: vPrizes, notice: vNotice, draw: vDraw, winners: vWinners, close: vClose, report: vReport, verify: () => vVerify(rt.arg), help: vHelp };
    const fn = map[rt.name] || vHome;
    view().innerHTML = (loadNote && rt.name !== '' ? `<div class="alert o" role="alert"><p>${esc(loadNote)}</p></div>` : '') + fn();
    document.title = pageTitle(rt);
    const done = stepDone(ev());
    $$('.tabs a').forEach(a => { const t = a.dataset.tab; a.toggleAttribute('aria-current', false); if (t === rt.name) a.setAttribute('aria-current', 'page'); const i = STEPS.findIndex(s => s[0] === t); a.classList.toggle('done', i >= 0 && done[i]); });
  }
  function rerenderKeep() {
    const y = window.scrollY; render(); window.scrollTo(0, y);
  }

  /* ---------- 바인딩 ---------- */
  function setPath(obj, path, val) { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }
  let saveT = null;
  function onBind(el) {
    const e = ensureEvent(), path = el.dataset.bind;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'radio' && !el.checked) return;
    if (/replyDays|retentionDays|reserves/.test(path)) { const n = GP.toInt(v); if (isNaN(n)) return; v = Math.min(path.includes('retention') ? 365 : 30, Math.max(path.includes('reply') ? 1 : 0, n)); if (path.includes('reserves')) v = Math.min(20, v); }
    if (typeof v === 'string' && path !== 'participantsRaw') v = rrnMask(v);
    if (path === 'participantsRaw' && v.length > 1000000) { toast('목록이 너무 길어요(100만 자). 나눠서 정리해 주세요.'); return; }
    setPath(e, path, v);
    clearTimeout(saveT); saveT = setTimeout(save, 250);
    const rt = route().name;
    if (rt === 'notice') { const t = GP.noticeText(e, R); $('#notice-out').textContent = t; $('#notice-len').textContent = t.length.toLocaleString('ko-KR') + '자' + (t.length > 1500 ? ' · 글이 길어요. 플랫폼에 따라 ‘더보기’로 접히거나 잘릴 수 있어요.' : ''); $('#date-err').hidden = datesOk(e.notice); }
    else if (rt === 'draw') { $('#parse-out').innerHTML = parseStats(e); $$('[data-act=copy-hash],[data-act=clear-raw]').forEach(x => { x.disabled = !e.participantsRaw; }); }
    else if (rt === 'close' && el.type !== 'text') { save(); rerenderKeep(); }
  }
  document.addEventListener('input', ev2 => {
    const el = ev2.target;
    if (el.matches('#q-v,#q-t,[name=q-b]')) { const b = $('input[name=q-b]:checked'); $('#q-out').innerHTML = quickVerdict($('#q-v').value, $('#q-t').value, b ? b.value : 'winner'); return; }
    if (el.dataset.bind && el.type !== 'date' && el.type !== 'radio' && el.type !== 'checkbox' && el.tagName !== 'SELECT') onBind(el);
  });
  document.addEventListener('change', async ev2 => {
    const el = ev2.target;
    if (el.matches('#q-t,[name=q-b]')) { const b = $('input[name=q-b]:checked'); $('#q-out').innerHTML = quickVerdict($('#q-v').value, $('#q-t').value, b ? b.value : 'winner'); return; }
    if (el.dataset.bind) { onBind(el); if (el.type === 'date' || el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'checkbox') { save(); if (route().name === 'close') rerenderKeep(); } return; }
    if (el.dataset.check) { ensureEvent().checklist[el.dataset.check] = el.checked; save(); rerenderKeep(); return; }
    if (el.dataset.act === 'inc-check') { incCheck[el.dataset.id] = el.checked; rerenderKeep(); return; }
    if (el.id === 'raw-file' && el.files[0]) {
      const f = el.files[0];
      if (f.size > 1000000) { toast('파일이 너무 커요(1MB 이하).'); el.value = ''; return; }
      const t = await f.text(); const e = ensureEvent(); e.participantsRaw = t; save(); rerenderKeep(); toast(`${f.name}을(를) 불러왔어요.`); return;
    }
    if (el.id === 'vfile' && el.files[0]) { const t = await el.files[0].text(); $('#vtext').value = t; const pl = GP.decodeVerify(route().arg); if (pl) showVerify(pl, t); return; }
    if (el.id === 'restore' && el.files[0]) {
      try {
        const o = JSON.parse(await el.files[0].text());
        const evs = (o && Array.isArray(o.events) ? o.events : []).map(cleanEvent).filter(Boolean);
        if (!evs.length) throw Error('비어 있음');
        if (!(await confirmBox('복원할까요?', '지금 이 기기의 이벤트를 백업 내용으로 바꿔요.', '복원'))) return;
        S = { v: 1, events: evs.slice(0, 1) }; save(); toast('복원했어요.'); location.hash = '#/';
        render();
      } catch (err) { toast('백업 파일을 읽지 못했어요. 이 앱에서 받은 .json 파일인지 확인해 주세요.'); }
      el.value = '';
    }
  });
  function announceText(e) {
    const d = e.draw;
    const L = [`🎉 ${e.title || '구독자 이벤트'} 당첨자 발표`, ''];
    e.prizes.forEach(p => { const w = d.winners.filter(x => x.prizeId === p.id); if (w.length) L.push(`■ ${p.name}`, ...w.map(x => `· ${x.maskedId}${x.commentAt ? ` (댓글 ${x.commentAt})` : ''}`), ''); });
    L.push(`당첨자분께는 ${e.notice.handle || '공식 계정'}으로 개별 연락드려요. ${e.notice.replyDays}일 안에 답이 없으면 예비 당첨자에게 넘어가요.`);
    L.push('공식 계정 외의 당첨 연락·입금 요구는 사칭이에요.', '');
    L.push(`추첨 검증: 문구 “${d.phrase}” · 참여 ${d.participantCount}명 · 목록 지문 ${d.listHash.slice(0, 16)}…`);
    return L.join('\n');
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
    const cols = ['#5B3DF5', '#FF5A7A', '#16A34A', '#F59E0B'];
    for (let i = 0; i < 40; i++) { const c = document.createElement('i'); c.style.left = (i * 97 % 100) + '%'; c.style.background = cols[i % 4]; c.style.animationDelay = (i % 10) * 0.05 + 's'; box.appendChild(c); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 1600);
  }
  document.addEventListener('submit', async e2 => {
    const f = e2.target;
    if (f.closest('dialog')) return;
    e2.preventDefault();
    if (f.id === 'prize-form') {
      const fd2 = new FormData(f), err = $('#pf-err');
      const v = GP.toInt(fd2.get('unitValue')), q = GP.toInt(fd2.get('qty'));
      const name = rrnMask(String(fd2.get('name') || '').trim()).slice(0, 60);
      const msg = !name ? '경품 이름을 넣어 주세요.' : isNaN(v) ? '금액은 숫자로 넣어 주세요. 예: 30000' : v > 1e10 ? '금액이 너무 커요.' : isNaN(q) || q < 1 || q > 1000 ? '개수는 1~1000 사이로 넣어 주세요.' : '';
      if (msg) { err.textContent = msg; err.hidden = false; return; }
      const e = ensureEvent(), id = fd2.get("pid");
      const p = { id: id || uid('p'), name, unitValue: v, qty: q, type: TYPES.includes(fd2.get('type')) ? fd2.get('type') : 'giftcard', sender: fd2.get('sender') === 'sponsor' ? 'sponsor' : 'me', taxBearer: fd2.get('taxBearer') === 'me' ? 'me' : 'winner' };
      if (id) { const i = e.prizes.findIndex(x => x.id === id); if (i >= 0) e.prizes[i] = p; } else { if (e.prizes.length >= 30) { err.textContent = '경품은 30개까지 넣을 수 있어요.'; err.hidden = false; return; } e.prizes.push(p); }
      if (e.draw) toast('경품이 바뀌었어요. 이미 한 추첨 결과와 맞지 않을 수 있어요.');
      editing = ''; save(); rerenderKeep(); if (!e.draw) toast(id ? '고쳤어요.' : '경품을 넣었어요.');
      return;
    }
    if (f.id === 'draw-form') {
      const e = ensureEvent(), err = $('#draw-err'), phrase = $('#phrase').value.trim();
      const { ids } = parsed(e);
      const show = m => { err.textContent = m; err.hidden = false; };
      if (!ids.length) return show('참여자 목록이 비어 있어요. 댓글 목록을 붙여 넣어 주세요.');
      if (!phrase) return show('추첨 문구를 넣어 주세요. 공지에서 약속한 값을 그대로 쓰세요.');
      const slots = e.prizes.reduce((n, p) => n + p.qty, 0);
      if (e.draw) {
        const r = GP.draw({ ids, phrase, prizes: e.prizes, reserves: e.drawOpts.reserves });
        const same = r.listHash === e.draw.listHash && r.seed === e.draw.seed;
        toast(same ? '같은 문구·목록이라 결과도 같아요.' : '문구나 목록이 달라 결과가 달라져요. 바꾸려면 추첨 기록을 먼저 지우세요.');
        return;
      }
      if (!(await confirmBox('이 문구로 추첨할까요?', `문구 “${phrase}” · 대상 ${ids.length}명 · 당첨 ${slots}명${ids.length < slots ? ' (참여자가 당첨 인원보다 적어요)' : ''}\n추첨 후에는 결과를 바꾸지 않는 게 원칙이에요.`, '추첨하기'))) return;
      const r = GP.draw({ ids, phrase, prizes: e.prizes, reserves: e.drawOpts.reserves });
      const first = {}; parsed(e).f.list.forEach(x => { if (!first[x.norm]) first[x.norm] = x; });
      const mm = e.drawOpts.maskMode;
      e.draw = { phrase: r.phrase, participantCount: r.participantCount, listHash: r.listHash, seed: r.seed, maskMode: mm, drawnAt: nowKST(), winners: r.winners.map(w => ({ prizeId: w.prizeId, maskedId: GP.mask(w.norm, mm), commentAt: (first[w.norm] || {}).time || '' })), reserves: r.reserves.map(id => ({ maskedId: GP.mask(id, mm), commentAt: (first[id] || {}).time || '' })) };
      if (!e.payout.paidDate && e.notice.announceDate) { /* 지급일은 사용자가 넣음 */ }
      save(); rerenderKeep(); confetti(); toast(r.shortage ? `참여자가 부족해 ${r.shortage}자리는 비었어요.` : '추첨했어요! 발표문과 검증 링크를 복사하세요.');
      return;
    }
    if (f.id === 'verify-form') { const pl = GP.decodeVerify(route().arg); if (pl) showVerify(pl, $('#vtext').value); return; }
    if (f.id === 'vlink-form') {
      const v = $('#vlink').value.trim(), m = v.match(/#\/?verify\/([A-Za-z0-9_-]+)/);
      if (!m) { const er = $('#vlink-err'); er.textContent = '검증 링크 형식이 아니에요. #/verify/로 시작하는 부분이 있어야 해요.'; er.hidden = false; return; }
      location.hash = '#/verify/' + m[1]; return;
    }
  });
  document.addEventListener('click', async e2 => {
    if (e2.target.closest('.skip')) { e2.preventDefault(); const m = $('#main'); m.focus(); m.scrollIntoView(); return; }
    const b = e2.target.closest('[data-act]'); if (!b || b.tagName === 'INPUT') return;
    const act = b.dataset.act, e = cur();
    if (act === 'start') return;
    if (act === 'tour-done') { SET.tourDone = true; save(); rerenderKeep(); return; }
    if (act === 'sample') {
      if (e && (e.prizes.length || e.participantsRaw) && !(await confirmBox('예시를 불러올까요?', '지금 이벤트를 예시로 바꿔요. 필요하면 먼저 도움말에서 백업을 받으세요.', '예시 불러오기'))) return;
      const s = cleanEvent(GP.sampleEvent()); s.sample = true; s.participantsRaw = GP.sampleParticipants(); S.events = [s]; SET.tourDone = true; save(); location.hash = '#/prizes'; toast('예시 이벤트를 불러왔어요.'); return;
    }
    if (act === 'edit-prize') { editing = b.dataset.id; rerenderKeep(); const n = $('#prize-form input[name=name]'); if (n) { n.focus(); n.scrollIntoView({ block: 'center' }); } return; }
    if (act === 'cancel-edit') { editing = ''; rerenderKeep(); return; }
    if (act === 'del-prize') { const p = prizeById(b.dataset.id); if (p && await confirmBox('경품을 지울까요?', `「${p.name}」을(를) 지워요.`, '삭제')) { e.prizes = e.prizes.filter(x => x.id !== p.id); save(); rerenderKeep(); toast('지웠어요.'); } return; }
    if (act === 'copy-sponsor') { const p = prizeById(b.dataset.id); if (p) copy(sponsorMsg(p), '협찬사 확인 메시지를 복사했어요.'); return; }
    if (act === 'copy-notice') { if (await copy(GP.noticeText(e, R), '공지문을 복사했어요.')) { e.notice.copiedAt = nowKST(); save(); rerenderKeep(); } return; }
    if (act === 'sample-list') { if (e.participantsRaw && !(await confirmBox('예시 목록으로 바꿀까요?', '지금 붙여 넣은 목록이 지워져요.', '바꾸기'))) return; e.participantsRaw = GP.sampleParticipants(); save(); rerenderKeep(); return; }
    if (act === 'clear-raw') { if (await confirmBox('참여자 목록을 지울까요?', '붙여 넣은 목록(participantsRaw)을 이 기기에서 완전히 지워요. 마스킹된 당첨 결과와 목록 지문은 남아요.', '목록 지우기')) { e.participantsRaw = ''; if (e.draw) e.checklist.loserDataDeleted = true; save(); rerenderKeep(); toast('참여자 목록을 지웠어요.'); } return; }
    if (act === 'copy-hash') { const { ids } = parsed(e); copy(`참여자 ${ids.length}명 목록 지문(SHA-256): ${GP.listHashOf(ids)}\n추첨 문구: ${e.notice.phraseSource || '(공지에서 약속한 값)'}`, '목록 지문을 복사했어요. 추첨 전에 공개해 두세요.'); return; }
    if (act === 'copy-announce') { copy(announceText(e), '발표문을 복사했어요.'); return; }
    if (act === 'copy-verify') { if (!(await privacyOk('검증 링크에는 추첨 문구, 참여자 수, 목록 지문, 마스킹된 당첨 아이디가 들어 있어요.'))) return; copy(location.href.split('#')[0] + '#/verify/' + GP.encodeVerify(e), '검증 링크를 복사했어요.'); return; }
    if (act === 'dl-list') { if (!(await privacyOk('검증용 목록에는 참여자 아이디 전체(정리·정렬본)가 들어 있어요. 공개하면 누구나 볼 수 있어요.'))) return; const { ids } = parsed(e); download('participants-verify.txt', ids.join('\n') + '\n', 'text/plain;charset=utf-8'); toast('검증용 목록을 내려받았어요.'); return; }
    if (act === 'reset-draw') { if (await confirmBox('추첨 기록을 지울까요?', '이미 발표했다면 다시 뽑는 것은 신뢰를 잃을 수 있어요.', '기록 지우기')) { e.draw = null; e.checklist.loserDataDeleted = false; save(); rerenderKeep(); } return; }
    if (act === 'copy-dm') { const p = prizeById(b.dataset.id); if (p && await copy(GP.dmText(e, { prizeId: p.id }, R, { includeCheck: !!incCheck[p.id] }), 'DM 문구를 복사했어요.')) { e.guideCopiedAt = nowKST(); save(); } return; }
    if (act === 'copy-form') { const p = prizeById(b.dataset.id); if (p && await copy(GP.formQuestions(p, R, { includeCheck: !!incCheck[p.id] }).map((q, i) => `${i + 1}. ${q}`).join('\n'), '질문 목록을 복사했어요.')) { e.guideCopiedAt = nowKST(); save(); } return; }
    if (act === 'copy-norule') { copy(`당첨 안내 후 ${e.notice.replyDays}일 안에 답이 없으면 당첨이 취소되고 예비 당첨자 순서대로 넘어갑니다. 취소된 당첨자에게 받은 정보는 바로 파기합니다.`, '규칙 문구를 복사했어요.'); return; }
    if (act === 'ics') { const dl = GP.deadlines(e, R); download('event-deadlines.ics', GP.buildICS(dl, { calName: (e.title || '구독자 이벤트') + ' 마감', uidPrefix: e.id }), 'text/calendar;charset=utf-8'); toast('캘린더 파일을 내려받았어요.'); return; }
    if (act === 'print') { window.print(); return; }
    if (act === 'backup') { if (!(await privacyOk('백업 파일에는 경품, 공지, 마스킹된 당첨 결과와 함께 붙여 넣은 참여자 목록(아이디·댓글)이 그대로 들어 있어요.'))) return; download(`giveaway-backup-${todayKST()}.json`, JSON.stringify(S, null, 1), 'application/json'); toast('백업을 내려받았어요.'); return; }
    if (act === 'wipe') { if (await confirmBox('모든 데이터를 지울까요?', '이 기기의 이벤트·목록·결과가 모두 사라지고 되돌릴 수 없어요.', '모두 지우기')) { S = fresh(); DRAFT = null; try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_corrupt'); } catch (_) { /* 무시 */ } save(); location.hash = '#/'; render(); toast('모두 지웠어요.'); } return; }
    if (act === 'pro') { SET.proInterest = true; save(); rerenderKeep(); toast('관심 표시를 이 기기에만 기록했어요. 출시되면 갤러리에서 알려 드려요.'); return; }
  });
  window.addEventListener('hashchange', () => { editing = ''; render(); const m = $('#main'); if (m) m.focus({ preventScroll: true }); window.scrollTo(0, 0); });

  /* ---------- 시작 ---------- */
  async function boot() {
    try { R = await (await fetch('data/rules.json')).json(); }
    catch (e) { view().innerHTML = '<h1>구독자 이벤트 정리판</h1><div class="alert r" role="alert"><p>규칙 파일을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p></div>'; return; }
    S = load(); render();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.GiveawayApp = { pageTitle: () => pageTitle(), state: () => S, runSelfTest: () => GP.selfTest(R), rules: () => R };
  boot();
})();
