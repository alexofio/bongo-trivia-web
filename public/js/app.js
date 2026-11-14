/* Bongo Trivia — player web app.
   Hash router (#home, #signup, #login, #verify, #categories, #play, #pay, #quiz, #result, #settings, #terms, #privacy).
   Each view = { auth?, render() -> html, bind(root) -> cleanup? }. All text through I18N.t. */
{
  const C = BT_CONFIG, t = I18N.t, fmt = I18N.fmt;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');

  // ---------- state ----------
  const S = {
    user: null, categories: [],
    auth: { intent: 'signup', msisdn: null, request_id: null, resendAt: 0, consents: null, prefill: '' },
    play: null,            // { play_id, startedAt }
    roundId: null, marks: [],
    autoNotice: false, legalBack: 'home'
  };

  // ---------- helpers ----------
  const normPhone = v => {
    let d = String(v).replace(/\D/g, '');
    if (d.startsWith('255')) d = d.slice(3); else if (d.startsWith('0')) d = d.slice(1);
    return /^[67]\d{8}$/.test(d) ? '255' + d : null;
  };
  const showPhone = m => `+255 ${m.slice(3, 6)} ${m.slice(6, 9)} ${m.slice(9)}`;
  const announce = msg => { const l = $('#live'); l.textContent = ''; setTimeout(() => (l.textContent = msg), 50); };
  function toast(msg) {
    const h = $('#toastHost'); h.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toast.t); toast.t = setTimeout(() => (h.innerHTML = ''), 3200);
  }
  const catName = c => (I18N.lang === 'en' ? c.name_en : c.name_sw);
  const errText = e => ({ network: t('err_network'), rate_limited: t('err_rate'), too_many_requests: t('err_rate'), limit_reached: t('pay_limit'), test_only: t('err_test_only') }[e.code] || (e.code === 'server' && e.message) || t('err_network'));
  const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? `<span class="spin" aria-hidden="true"></span>${esc(label)}` : esc(btn.dataset.label); };
  const go = v => { if (location.hash.slice(1) === v) route(); else location.hash = v; };

  // ---------- shell: nav, footer, demo banner ----------
  function chrome(view) {
    const nav = $('#nav');
    const cur = v => (view === v ? ' aria-current="page"' : '');
    nav.innerHTML = (S.user
      ? `<a href="#play"${cur('play')}>${t('nav_play')}</a><a href="#settings"${cur('settings')}>${t('nav_settings')}</a>`
      : `<a href="#login"${cur('login')}>${t('nav_login')}</a><a href="#signup"${cur('signup')}>${t('nav_signup')}</a>`)
      + `<button class="lang" type="button" id="langBtn" lang="${I18N.lang === 'sw' ? 'en' : 'sw'}" aria-label="${t('lang_switch_label')}">${t('lang_switch')}</button>`;
    $('#langBtn').onclick = switchLang;
    $('#footer').innerHTML = `
      <nav aria-label="Legal"><a href="#terms">${t('footer_terms')}</a><a href="#privacy">${t('footer_privacy')}</a><a href="#help-anchor" id="helpLink">${t('footer_help')}</a></nav>
      <p><span class="badge18" aria-hidden="true">18+</span>${t('footer_18')}</p>
      <p>${t('footer_operator')}</p>`;
    $('#helpLink').onclick = e => { e.preventDefault(); toast(`${t('footer_help')}: ${C.SUPPORT_PHONE} · ${C.SUPPORT_EMAIL}`); };
    const b = $('#demoBanner'); b.hidden = C.MODE !== 'mock' && !C.TEST; b.textContent = C.TEST ? t('test_banner', { code: C.CAMPAIGN_CODE }) : t('demo_banner');
    $('#skipLink').textContent = t('skip');
    document.documentElement.lang = I18N.lang;
  }

  async function switchLang() {
    I18N.set(I18N.lang === 'sw' ? 'en' : 'sw');
    if (S.user) API.savePreferences(I18N.lang).catch(() => {});
    const v = current();
    if (v === 'quiz' || v === 'pay') chrome(v); // don't reset a running timer or payment
    else route();
    $('#langBtn').focus();
  }


  // ---------- first-time "How to play" walkthrough ----------
  // Opens before a player's first set (user.tutorial_done is false) and from the "How to play" links.
  // Closing it any way (finish, skip, Esc) saves tutorial_done on the account so it shows once.
  const TOUR_ART = [
    // 1 pay: phone with the EMglobe push
    `<svg viewBox="0 0 400 190" aria-hidden="true"><rect x="150" y="18" width="100" height="168" rx="18" fill="#0A1A4A"/><rect x="157" y="26" width="86" height="152" rx="12" fill="#0087F0"/>
      <rect x="112" y="64" width="176" height="62" rx="12" fill="#fff"/><text x="200" y="86" text-anchor="middle" font-family="Lexend,sans-serif" font-size="12" font-weight="700" fill="#44527A">${esc(C.MERCHANT)}</text>
      <text x="200" y="106" text-anchor="middle" font-family="Lexend,sans-serif" font-size="15" font-weight="700" fill="#0A1A4A">TZS ${fmt(C.PRICE_TZS)}</text>
      <g fill="none" stroke="#0A1A4A" stroke-width="2"><circle cx="176" cy="148" r="6"/><circle cx="192" cy="148" r="6"/><circle cx="208" cy="148" r="6"/><circle cx="224" cy="148" r="6"/></g></svg>`,
    // 2 answer: question card, timer, options
    `<svg viewBox="0 0 400 190" aria-hidden="true"><rect x="96" y="16" width="208" height="160" rx="16" fill="#fff"/>
      <rect x="112" y="32" width="176" height="8" rx="4" fill="#EEF3FF"/><rect x="112" y="32" width="110" height="8" rx="4" fill="#023DC1"/>
      <rect x="112" y="52" width="150" height="10" rx="5" fill="#0A1A4A"/><rect x="112" y="68" width="96" height="10" rx="5" fill="#0A1A4A"/>
      <g fill="none" stroke="#C9D6F5" stroke-width="2"><rect x="112" y="90" width="176" height="18" rx="6"/><rect x="112" y="138" width="176" height="18" rx="6"/></g>
      <rect x="112" y="114" width="176" height="18" rx="6" fill="#E3F6EA" stroke="#0B6B35" stroke-width="2"/>
      <circle cx="320" cy="44" r="22" fill="#FFE22E"/><text x="320" y="50" text-anchor="middle" font-family="Lexend,sans-serif" font-size="16" font-weight="700" fill="#000">${C.QUESTION_SECONDS}s</text></svg>`,
    // 3 win: three ticks and the prize ribbon
    `<svg viewBox="0 0 400 190" aria-hidden="true"><g fill="#0B6B35">${[140, 200, 260].map(x => `<circle cx="${x}" cy="66" r="26"/>`).join('')}</g>
      <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${[140, 200, 260].map(x => `<path d="M${x - 11} 66l7 8 15-17"/>`).join('')}</g>
      <path d="M36 116h328l-14 22 14 22H36l14-22z" fill="#FFE22E"/><text x="200" y="145" text-anchor="middle" font-family="Lilita One,Lexend,sans-serif" font-size="20" fill="#000">TZS ${fmt(C.PRIZES.hourly)} · TZS ${fmt(C.PRIZES.daily)}</text></svg>`,
    // 4 ready: category chips
    `<svg viewBox="0 0 400 190" aria-hidden="true">${[['Soka', 80, 46, 1], ['Historia', 200, 46, 0], ['Sayansi', 320, 46, 1], ['Muziki', 80, 106, 0], ['Afrika', 200, 106, 1], ['Hesabu', 320, 106, 0]].map(([n, x, y, on]) =>
      `<rect x="${x - 52}" y="${y}" width="104" height="38" rx="19" fill="${on ? '#fff' : 'rgba(255,255,255,.18)'}"/><text x="${x}" y="${y + 25}" text-anchor="middle" font-family="Lexend,sans-serif" font-size="14" font-weight="600" fill="${on ? '#023DC1' : '#fff'}">${n}</text>`).join('')}
</svg>`
  ];

  function openTour({ onPlay } = {}) {
    const n = TOUR_ART.length; let i = 0; let done = false;
    const d = document.createElement('dialog');
    d.className = 'tour'; d.setAttribute('aria-labelledby', 'tourH');
    document.body.appendChild(d);
    const finish = (play) => {
      if (done) return; done = true;
      if (S.user && !S.user.tutorial_done) { S.user.tutorial_done = true; API.completeTutorial().catch(() => {}); }
      if (d.open) d.close(); d.remove();
      if (play && onPlay) onPlay();
    };
    const draw = () => {
      const last = i === n - 1;
      d.innerHTML = `<div class="art">${TOUR_ART[i]}${last ? '' : `<button type="button" class="skip" id="tSkip">${t('tour_skip')}</button>`}</div>
        <div class="body step-in">
          <p class="count" aria-live="polite">${t('tour_step', { i: i + 1, n })}</p>
          <h2 id="tourH" tabindex="-1">${t(`tour_${i + 1}_t`)}</h2>
          <p>${t(`tour_${i + 1}_b`)}</p>
          <div class="dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          ${last
            ? `<div class="stack"><button class="btn primary block" id="tPlay">${onPlay ? t('tour_play') : t('tour_done')}</button>${onPlay ? `<button class="btn text block" id="tLater" type="button">${t('tour_later')}</button>` : ''}</div>`
            : `<div class="nav2">${i ? `<button class="btn ghost" id="tBack" type="button">${t('tour_back')}</button>` : ''}<button class="btn blue" id="tNext">${t('tour_next')}</button></div>`}
        </div>`;
      const q = id => d.querySelector('#' + id);
      q('tSkip') && (q('tSkip').onclick = () => finish(false));
      q('tBack') && (q('tBack').onclick = () => { i--; draw(); });
      q('tNext') && (q('tNext').onclick = () => { i++; draw(); });
      q('tPlay') && (q('tPlay').onclick = () => finish(true));
      q('tLater') && (q('tLater').onclick = () => finish(false));
      (q('tNext') || q('tPlay')).focus();
    };
    d.addEventListener('cancel', e => { e.preventDefault(); finish(false); }); // Esc
    d.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' && i < n - 1) { i++; draw(); }
      if (e.key === 'ArrowLeft' && i > 0) { i--; draw(); }
    });
    draw(); d.showModal();
  }

  // ---------- views ----------
  const V = {};

  V.home = {
    render: () => `
      <section class="band"><div class="wide hero">
        <div>
          <h1>${t('hero_title')}</h1>
          <p>${t('hero_body')}</p>
          <div class="prizes" aria-label="Prizes">
            <div class="prize"><span class="ribbon">TZS ${fmt(C.PRIZES.hourly)}</span><span>${t('prize_hourly')}</span></div>
            <div class="prize"><span class="ribbon">TZS ${fmt(C.PRIZES.daily)}</span><span>${t('prize_daily')}</span></div>
          </div>
          <div class="actions">
            ${S.user ? `<a class="btn primary" href="#play">${t('play_cta')}</a>`
                     : `<a class="btn primary" href="#signup">${t('hero_cta')}</a><a class="btn ghost" href="#login">${t('hero_login')}</a>`}
          </div>
        </div>
        <figure class="ticket" aria-hidden="true">
          <span class="ribbon">TRIVIA · 2/3</span>
          <div class="bar"><i></i></div>
          <div class="qtext">${I18N.lang === 'en' ? 'What is the highest mountain in Tanzania?' : 'Mlima mrefu zaidi Tanzania ni upi?'}</div>
          <div class="opt"><b>A</b>Meru</div>
          <div class="opt pick"><b>B</b>Kilimanjaro</div>
          <div class="opt"><b>C</b>Rungwe</div>
          <div class="opt"><b>D</b>Hanang</div>
          <p class="sample">${I18N.lang === 'en' ? 'Sample question' : 'Mfano wa swali'}</p>
        </figure>
      </div></section>
      <section class="wide">
        <h2>${t('how_title')}</h2>
        <ol class="steps"><li>${t('how_1')}</li><li>${t('how_2')}</li><li>${t('how_3')}</li><li>${t('how_4')}</li></ol>
        <p class="hint" style="margin-top:16px">${t('prize_note')}</p>
      </section>`
  };

  // Sign up and log in share one screen; sign-up adds the consents.
  const startView = intent => ({
    render: () => {
      const su = intent === 'signup';
      return `<div class="col">
        <h1>${t(su ? 'start_signup_title' : 'start_login_title')}</h1>
        <p class="lead">${t(su ? 'start_signup_body' : 'start_login_body')}</p>
        <form id="f" novalidate>
          <div class="field">
            <label for="phone">${t('phone_label')}</label>
            <div class="phone"><span aria-hidden="true">+255</span>
              <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="712 345 678" aria-describedby="phoneHint phoneErr" value="${esc(S.auth.prefill)}" required>
            </div>
            <div class="hint" id="phoneHint">${t('phone_hint')}</div>
            <div class="err" id="phoneErr" role="alert"></div>
          </div>
          ${su ? `
          <fieldset style="border:0;padding:0;margin:18px 0 0">
            <legend class="sr">Consents</legend>
            <label class="check"><input type="checkbox" id="cTerms" aria-describedby="consentErr" required>
              <span class="req">${t('terms_accept', { terms: `<a href="#terms" data-legal>${t('terms_link')}</a>`, privacy: `<a href="#privacy" data-legal>${t('privacy_link')}</a>` })}</span></label>
            <label class="check"><input type="checkbox" id="cAge" aria-describedby="consentErr" required><span class="req">${t('age_confirm')}</span></label>
            <label class="check"><input type="checkbox" id="cSms"><span>${t('sms_optin')}</span></label>
            <div class="err" id="consentErr" role="alert"></div>
          </fieldset>` : ''}
          <div class="field"><button class="btn primary block" id="send" data-label="${t('send_code')}">${t('send_code')}</button></div>
        </form>
        <p style="margin-top:14px"><a href="#${su ? 'login' : 'signup'}">${t(su ? 'switch_to_login' : 'switch_to_signup')}</a></p>
      </div>`;
    },
    bind: root => {
      const su = intent === 'signup';
      root.querySelectorAll('[data-legal]').forEach(a => (a.onclick = () => { S.legalBack = intent; S.auth.prefill = $('#phone').value; }));
      $('#f').onsubmit = async e => {
        e.preventDefault();
        const inp = $('#phone'), pe = $('#phoneErr'), ce = $('#consentErr'), btn = $('#send');
        pe.textContent = ''; if (ce) ce.textContent = ''; inp.removeAttribute('aria-invalid');
        const raw = inp.value.trim(), m = normPhone(raw);
        if (!raw) { pe.textContent = t('phone_err_empty'); inp.setAttribute('aria-invalid', 'true'); return inp.focus(); }
        if (!m) { pe.textContent = t('phone_err_invalid'); inp.setAttribute('aria-invalid', 'true'); return inp.focus(); }
        if (su) {
          if (!$('#cTerms').checked) { ce.textContent = t('err_terms'); return $('#cTerms').focus(); }
          if (!$('#cAge').checked) { ce.textContent = t('err_age'); return $('#cAge').focus(); }
        }
        busy(btn, true, t('sending'));
        try {
          const r = await API.sendOtp(m, intent);
          S.auth = { intent, msisdn: m, request_id: r.request_id, resendAt: Date.now() + r.resend_in * 1000, prefill: raw,
            consents: su ? { terms: true, terms_version: C.TERMS_VERSION, privacy_version: C.PRIVACY_VERSION, age_confirmed: true, sms_marketing: $('#cSms').checked } : null };
          go('verify');
        } catch (er) {
          busy(btn, false);
          if (er.code === 'not_registered') { S.auth.prefill = raw; pe.innerHTML = `${t('not_registered')} <a href="#signup">${t('open_account')}</a>`; }
          else if (er.code === 'invalid_msisdn') pe.textContent = t('phone_err_invalid');
          else pe.textContent = errText(er);
        }
      };
    }
  });
  V.signup = startView('signup');
  V.login = startView('login');

  V.verify = {
    guard: () => !!S.auth.request_id || 'signup',
    render: () => `<div class="col">
      <h1>${t('verify_title')}</h1>
      <p class="lead">${t('verify_body', { phone: `<strong style="white-space:nowrap">${showPhone(S.auth.msisdn)}</strong>` })}</p>
      <form id="f" novalidate>
        <div class="field">
          <label for="code">${t('code_label')}</label>
          <input class="otp" id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="${C.OTP_LENGTH}" pattern="\\d{${C.OTP_LENGTH}}" aria-describedby="codeErr" required>
          <div class="err" id="codeErr" role="alert"></div>
        </div>
        <div class="field"><button class="btn primary block" id="vbtn" data-label="${t('verify_btn')}">${t('verify_btn')}</button></div>
      </form>
      <div class="row" style="margin-top:10px">
        <button class="btn text" id="resend" type="button"></button>
        <a href="#${S.auth.intent}">${t('change_number')}</a>
      </div>
    </div>`,
    bind: () => {
      const code = $('#code'), ce = $('#codeErr'), btn = $('#vbtn'), rs = $('#resend');
      code.focus();
      const tick = () => {
        const s = Math.max(0, Math.ceil((S.auth.resendAt - Date.now()) / 1000));
        rs.disabled = s > 0; rs.textContent = s > 0 ? t('resend_in', { s }) : t('resend');
      };
      tick(); const iv = setInterval(tick, 1000);
      rs.onclick = async () => {
        rs.disabled = true;
        try { const r = await API.sendOtp(S.auth.msisdn, S.auth.intent); S.auth.request_id = r.request_id; S.auth.resendAt = Date.now() + r.resend_in * 1000; ce.textContent = ''; code.value = ''; toast(t('resent')); announce(t('resent')); }
        catch (er) { ce.textContent = errText(er); }
        tick(); code.focus();
      };
      code.oninput = () => { code.value = code.value.replace(/\D/g, '').slice(0, C.OTP_LENGTH); code.removeAttribute('aria-invalid'); if (code.value.length === C.OTP_LENGTH) $('#f').requestSubmit(); };
      $('#f').onsubmit = async e => {
        e.preventDefault(); ce.textContent = '';
        if (code.value.length !== C.OTP_LENGTH) { ce.textContent = t('code_err_len'); code.setAttribute('aria-invalid', 'true'); return code.focus(); }
        busy(btn, true, t('verifying'));
        try {
          const r = await API.verifyOtp({ request_id: S.auth.request_id, msisdn: S.auth.msisdn, code: code.value, consents: S.auth.consents });
          S.user = r.user; S.auth = { intent: 'signup', prefill: '' };
          API.savePreferences(I18N.lang).catch(() => {});
          go(S.user.categories.length ? 'play' : 'categories');
        } catch (er) {
          busy(btn, false); code.setAttribute('aria-invalid', 'true'); code.select();
          if (er.code === 'not_registered') { ce.innerHTML = `${t('not_registered')} <a href="#signup">${t('open_account')}</a>`; return; }
          ce.textContent = er.code === 'invalid_code' ? (er.attempts_left != null ? t('code_err_invalid', { n: er.attempts_left }) : t('code_err_wrong'))
            : er.code === 'expired_code' ? t('code_err_expired')
            : er.code === 'too_many_attempts' ? t('code_err_locked') : errText(er);
        }
      };
      return () => clearInterval(iv);
    }
  };

  // Category picker, used on first login and inside Settings.
  const catsHtml = sel => `
    <fieldset class="cats" id="cats" aria-describedby="catErr"><legend class="sr">${t('cat_title')}</legend>
      ${S.categories.map(c => `<label class="cat"><input type="checkbox" value="${c.id}" ${sel.includes(c.id) ? 'checked' : ''}><span>${esc(catName(c))}</span></label>`).join('')}
    </fieldset>`;
  const readCats = () => [...document.querySelectorAll('#cats input:checked')].map(i => i.value);

  V.categories = {
    auth: true,
    render: () => `<div class="col">
      <h1>${t('cat_title')}</h1>
      <p class="lead">${t('cat_body')}</p>
      <div class="row"><span id="catCount" aria-live="polite"></span>
        <span><button class="btn text" type="button" id="all">${t('cat_all')}</button><button class="btn text" type="button" id="none">${t('cat_none')}</button></span></div>
      ${catsHtml(S.user.categories)}
      <div class="sticky"><div class="err" id="catErr" role="alert"></div>
        <button class="btn primary block" id="save" data-label="${t('cat_save')}">${t('cat_save')}</button></div>
    </div>`,
    bind: () => bindCats('play')
  };
  function bindCats(next) {
    const count = () => { $('#catCount').textContent = t('cat_selected', { n: readCats().length }); };
    count(); $('#cats').onchange = () => { count(); $('#catErr').textContent = ''; };
    $('#all').onclick = () => { document.querySelectorAll('#cats input').forEach(i => (i.checked = true)); count(); };
    $('#none').onclick = () => { document.querySelectorAll('#cats input').forEach(i => (i.checked = false)); count(); };
    $('#save').onclick = async () => {
      const ids = readCats(), btn = $('#save');
      if (!ids.length) { $('#catErr').textContent = t('cat_err'); return $('#cats input').focus(); }
      busy(btn, true, t('cat_save'));
      try { S.user = await API.saveCategories(ids); toast(t('cat_saved')); announce(t('cat_saved')); if (next) go(next); else busy(btn, false); }
      catch (er) { busy(btn, false); $('#catErr').textContent = errText(er); }
    };
  }

  V.play = {
    auth: true,
    guard: () => S.user.categories.length > 0 || 'categories',
    render: () => {
      const names = S.user.categories.map(id => S.categories.find(c => c.id === id)).filter(Boolean).map(catName);
      return `<div class="col stack">
        <section class="play-card band">
          <h1>${t('play_title')}</h1>
          <p>${t('prize_note')}</p>
          <div class="chips" aria-label="${esc(t('play_from', { cats: '' }))}">${names.map(n => `<span class="chip">${esc(n)}</span>`).join('')}</div>
          ${API.mode === 'portal' && C.CAMPAIGN_STATUS && C.CAMPAIGN_STATUS !== 'live'
            ? `<button class="btn primary block" id="playBtn" disabled>${t('soon_play')}</button>`
            : `<button class="btn primary block" id="playBtn">${C.PLAY_MODE && C.PLAY_MODE !== 'paid' ? t('play_cta_free') : t('play_cta')}</button>`}
          <p style="margin:12px 0 0;font-size:14px">${t('play_networks')} <a href="#settings" style="color:#fff">${t('play_edit_cats')}</a> · <button type="button" class="btn text" id="howBtn" style="color:#fff;padding:0;min-height:0;font-size:14px">${t('tour_open')}</button></p>
        </section>
        <section aria-labelledby="entH"><h2 id="entH" style="font-size:22px;margin-top:8px">${t('entries_title')}</h2>
          <div class="tally"><div><b id="eh">–</b>${t('entries_hour')}</div><div><b id="ed">–</b>${t('entries_day')}</div></div></section>
        <section class="soon" id="adCard" ${API.mode === 'portal' ? 'hidden' : 'aria-disabled="true"'}>
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><rect x="4" y="9" width="44" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M22 18v12l10-6z" fill="currentColor"/><path d="M18 45h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          <div id="adBody"><span class="tag">${t('ads_soon')}</span><h3 style="margin:0 0 4px">${t('ads_title')}</h3><p style="margin:0;font-size:15px">${t('ads_body')}</p>
            <button class="btn ghost" disabled style="margin-top:10px;min-height:44px">${t('ads_soon')}</button></div>
        </section>
        ${demoPanel()}
        <div class="err" id="playErr" role="alert"></div>
      </div>
      <dialog id="adDlg" aria-labelledby="adH" style="border:0;border-radius:22px;padding:0;max-width:440px;width:calc(100% - 24px);background:#0b1b2e;color:#fff">
        <div style="padding:14px">
          <p id="adH" style="margin:0 0 8px;font-size:14px;opacity:.8"></p>
          <div id="adMedia" style="background:#000;border-radius:14px;overflow:hidden;display:flex;justify-content:center;max-height:62vh"></div>
          <p id="adHead" style="margin:10px 0 0;font-weight:600"></p>
          <div class="meter" style="margin-top:10px"><i id="adBar" style="width:0%"></i></div>
          <p id="adCount" class="hint" style="color:#fff;opacity:.85" aria-live="polite"></p>
          <div class="stack"><button class="btn primary block" id="adDone" disabled></button><button class="btn text block" id="adMore" type="button" hidden style="color:#fff">${t('ads_more')}</button></div>
        </div>
      </dialog>
      <dialog id="notice" aria-labelledby="nH" style="border:0;border-radius:22px;padding:0;max-width:440px;width:calc(100% - 32px);background:var(--bg);color:var(--ink)">
        <div style="padding:24px">
          <h2 id="nH">${t('notice_title')}</h2>
          <p>${t('notice_body', { phone: `<strong style="white-space:nowrap">${showPhone(S.user.msisdn)}</strong>` })}</p>
          <p class="note warn">${t('notice_pin')}</p>
          <div class="err" id="nErr" role="alert"></div>
          <div class="stack" style="margin-top:18px">
            <button class="btn primary block" id="nOk" data-label="${t('notice_confirm')}">${t('notice_confirm')}</button>
            <button class="btn text block" id="nNo" type="button">${t('notice_cancel')}</button>
          </div>
        </div>
      </dialog>`;
    },
    bind: () => {
      API.entries().then(e => { const sec = $('#entH') && $('#entH').closest('section'); if (!e) { if (sec) sec.hidden = true; return; } $('#eh') && ($('#eh').textContent = e.hourly_current); $('#ed') && ($('#ed').textContent = e.daily); }).catch(() => {});
      bindDemo();
      const dlg = $('#notice');
      // Payments switched off (or a free campaign): no payment request, straight to the questions.
      const freePlay = async () => {
        const btn = $('#playBtn'); btn.disabled = true; $('#playErr').textContent = '';
        try { const r = await API.startPlay(); S.play = { play_id: r.play_id, startedAt: Date.now() }; S.roundId = r.round_id; S.marks = []; go('quiz'); }
        catch (er) { btn.disabled = false; $('#playErr').textContent = er.code === 'limit_reached' ? t('pay_limit') : errText(er); }
      };
      let paidLeft = 0;
      const playPaid = async () => {
        const btn = $('#playBtn'); btn.disabled = true; $('#playErr').textContent = '';
        try { const r = await API.playPaid(); S.play = { play_id: r.play_id, startedAt: Date.now() }; S.roundId = r.round_id; S.marks = []; go('quiz'); }
        catch (er) { btn.disabled = false; $('#playErr').textContent = er.code === 'limit_reached' ? t('paid_wait_limit') : errText(er); }
      };
      const open = () => { if (C.PLAY_MODE && C.PLAY_MODE !== 'paid') return freePlay(); if (paidLeft > 0) return playPaid(); $('#nErr').textContent = ''; dlg.showModal(); $('#nOk').focus(); };
      if (API.mode === 'portal' && C.PLAY_MODE === 'paid' && C.CAMPAIGN_STATUS === 'live') API.paidRounds().then(n => { paidLeft = n; const b = $('#playBtn'); if (n > 0 && b) b.textContent = t('play_paid_waiting', { n }); });
      $('#playBtn').onclick = open;
      $('#nNo').onclick = () => { dlg.close(); $('#playBtn').focus(); };
      $('#nOk').onclick = async () => {
        const btn = $('#nOk'); busy(btn, true, t('sending'));
        try { const r = await API.startPlay(); S.play = { play_id: r.play_id, startedAt: Date.now(), expires: r.expires_in }; dlg.close(); go('pay'); }
        catch (er) {
          busy(btn, false);
          if (er.code === 'no_categories') { dlg.close(); return go('categories'); }
          $('#nErr').textContent = er.code === 'limit_reached' ? t('pay_limit') : er.code === 'payment_pending' ? t('pay_wait_body') : er.code === 'rounds_waiting' ? t('paid_waiting_first') : errText(er);
        }
      };
      // Watch an ad for a free play (portal, paid campaigns while payments are collected).
      const adCard = async () => {
        const card = $('#adCard'); if (!card || API.mode !== 'portal' || C.PLAY_MODE !== 'paid' || C.CAMPAIGN_STATUS !== 'live') return;
        const o = await API.adOffer(); if (!o || (!o.available && !o.freePlays && !o.adsLeftToday)) { card.hidden = true; return; }
        card.hidden = false; card.removeAttribute('aria-disabled'); card.style.opacity = 1; card.style.borderStyle = 'solid';
        $('#adBody').innerHTML = `<h3 style="margin:0 0 4px">${t('ads_title')}</h3><p style="margin:0;font-size:15px">${t('ads_body')}</p>
          ${o.freePlays ? `<p style="margin:8px 0 0;font-weight:600">${t('ads_have', { n: o.freePlays })}</p><button class="btn primary" id="adPlay" style="margin-top:8px;min-height:44px">${t('ads_play_free')}</button>` : ''}
          ${o.available ? `<button class="btn ${o.freePlays ? 'ghost' : 'primary'}" id="adWatch" style="margin-top:8px;min-height:44px">${t('ads_watch')}</button><p class="hint" style="margin:6px 0 0">${t('ads_left', { n: o.adsLeftToday })}</p>`
            : `<p class="hint" style="margin:8px 0 0">${o.adsLeftToday ? t('ads_none') : t('ads_limit')}</p>`}`;
        if ($('#adPlay')) $('#adPlay').onclick = async () => {
          const b = $('#adPlay'); b.disabled = true; $('#playErr').textContent = '';
          try { const r = await API.startFreePlay(); S.play = { play_id: r.play_id, startedAt: Date.now() }; S.roundId = r.round_id; S.marks = []; go('quiz'); }
          catch (er) { b.disabled = false; $('#playErr').textContent = er.code === 'limit_reached' ? t('pay_limit') : errText(er); }
        };
        if ($('#adWatch')) $('#adWatch').onclick = watchAd;
      };
      const watchAd = async () => {
        const w = $('#adWatch'); w.disabled = true; $('#playErr').textContent = '';
        let ad; try { ad = await API.nextAd(); } catch (er) { w.disabled = false; $('#playErr').textContent = er.code === 'ads_limit' ? t('ads_limit') : er.code === 'no_ads' ? t('ads_none') : errText(er); return; }
        const d = $("#adDlg"), src = ad.media;
        $('#adH').textContent = t('ads_from', { name: ad.advertiser || '' }); $('#adHead').textContent = ad.headline || '';
        $('#adMedia').innerHTML = ad.format === 'video' ? `<video src="${esc(src)}" autoplay playsinline muted style="width:100%;max-height:62vh"></video>` : `<img src="${esc(src)}" alt="" style="width:100%;max-height:62vh;object-fit:contain">`;
        $('#adMore').style.display = ad.hasLink ? '' : 'none'; $('#adMore').onclick = async () => { try { const r = await API.clickAd(ad.token); if (r.url) window.open(r.url, '_blank', 'noopener'); } catch (e) {} };
        const done = $('#adDone'); done.disabled = true; done.textContent = t('ads_close');
        let closed = false; d.onclose = () => { closed = true; clearInterval(tick); };
        d.oncancel = e => { if (done.disabled) { e.preventDefault(); toast(t('ads_unfinished')); } };
        d.showModal();
        const start = Date.now(), need = (ad.seconds + 1) * 1000;
        const tick = setInterval(async () => {
          const left = Math.max(0, need - (Date.now() - start));
          $('#adBar').style.width = `${Math.min(100, 100 * (1 - left / need))}%`;
          $('#adCount').textContent = left ? t('ads_wait', { s: Math.ceil(left / 1000) }) : '';
          if (!left) {
            clearInterval(tick);
            try { await API.completeAd(ad.token); if (!closed) $('#adCount').textContent = t('ads_done'); toast(t('ads_done')); }
            catch (er) { $('#adCount').textContent = er.code === 'ad_not_finished' ? t('ads_unfinished') : errText(er); }
            done.disabled = false; done.focus();
          }
        }, 250);
        done.onclick = () => { d.close(); adCard(); };
      };
      adCard();
      $('#howBtn').onclick = () => openTour({ onPlay: open });
      if (S.autoNotice) { S.autoNotice = false; open(); }
      else if (!S.user.tutorial_done) openTour({ onPlay: open });
    }
  };

  // Demo-only control: pick what the fake aggregator does with the next payment.
  const demoPanel = () => C.MODE !== 'mock' ? '' : `<div class="demo-pay"><span class="hint">${t('demo_pay')}</span><div class="seg" id="demoSeg">
      ${['success', 'failed', 'cancelled', 'expired', 'limit'].map(o => `<button type="button" data-o="${o}" aria-pressed="${BTMock.outcome === o}">${t('demo_' + o)}</button>`).join('')}</div></div>`;
  const bindDemo = () => { const s = $('#demoSeg'); if (!s) return; s.onclick = e => { const b = e.target.closest('button'); if (!b) return; BTMock.setOutcome(b.dataset.o); s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); }; };

  V.pay = {
    auth: true,
    guard: () => !!S.play || 'play',
    render: () => `<div class="col" style="text-align:center">
      <div class="phonefig" id="pf" aria-hidden="true"><div class="scr"><div class="push"><b>${esc(C.MERCHANT)}</b>${t('pay_phone_msg')}<div class="pin"><i></i><i></i><i></i><i></i></div></div></div></div>
      <h1 id="payH">${t('pay_wait_title')}</h1>
      <div id="payBody">
        <p class="lead">${t('pay_wait_body')}</p>
        <div class="meter" role="progressbar" aria-label="${t('pay_wait_title')}" aria-valuemin="0" aria-valuemax="${C.PAYMENT_TIMEOUT_SECONDS}" id="pm"><i style="width:100%"></i></div>
        <p class="hint" id="payTimer"></p>
        <p class="hint">${t('pay_pending_note')}</p>
      </div>
    </div>`,
    bind: () => {
      let stop = false;
      const total = C.PAYMENT_TIMEOUT_SECONDS * 1000;
      const end = (state, extra) => {
        stop = true; $('#pf').classList.add('done');
        if (state === 'success') {
          $('#payH').textContent = t('pay_success');
          $('#payBody').innerHTML = `<p class="msg ok">${t('pay_success')}</p>`; announce(t('pay_success'));
          return setTimeout(() => go('quiz'), 1200);
        }
        if (state === 'saved') {
          // Money received but the round couldn't start now: it stays paid and can be played later.
          S.play = null; $('#payH').textContent = t('pay_success');
          $('#payBody').innerHTML = `<p class="msg ok" role="alert">${t(extra === 'limit_reached' ? 'pay_saved_limit' : 'pay_saved')}</p>
            <div class="stack" style="margin-top:18px"><a class="btn primary block" href="#play">${t('pay_back')}</a></div>`;
          announce(t('pay_saved')); return;
        }
        const key = { failed: 'pay_failed', cancelled: 'pay_cancelled', expired: 'pay_expired', limit: 'pay_limit' }[state] || 'pay_failed';
        S.play = null;
        $('#payBody').innerHTML = `<p class="msg bad" role="alert">${t(key)}</p>
          <div class="stack" style="margin-top:18px"><button class="btn primary block" id="retry">${t('pay_retry')}</button>
          <a class="btn text block" href="#play">${t('pay_back')}</a></div>${demoPanel()}`;
        bindDemo();
        $('#retry').onclick = () => { S.autoNotice = true; go('play'); };
        $('#retry').focus();
      };
      const poll = async () => {
        if (stop) return;
        const left = Math.max(0, total - (Date.now() - S.play.startedAt));
        $('#payTimer').textContent = t('pay_wait_timer', { s: Math.ceil(left / 1000) });
        $('#pm i').style.width = (left / total * 100) + '%'; $('#pm').setAttribute('aria-valuenow', Math.ceil(left / 1000));
        if (left <= 0) return end('expired');
        try {
          const r = await API.paymentStatus(S.play.play_id);
          if (stop) return;
          if (r.status === 'success') { S.roundId = r.round_id; S.marks = []; return end('success'); }
          if (r.status !== 'pending') return end(r.status, r.reason);
        } catch (er) { /* transient: keep polling until timeout */ }
        setTimeout(poll, C.POLL_MS);
      };
      announce(t('pay_wait_body')); poll();
      return () => { stop = true; };
    }
  };

  V.quiz = {
    auth: true,
    guard: () => !!S.roundId || 'play',
    render: () => `<div class="col"><div id="q"><p class="hint">…</p></div></div>`,
    bind: () => {
      let timer = null, alive = true, keyH = null;
      const L = ['A', 'B', 'C', 'D'];
      const pips = (n, cur) => `<div class="pips" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${S.marks[i] === true ? 'ok' : S.marks[i] === false ? 'no' : i === cur ? 'now' : ''}"></i>`).join('')}</div>`;
      async function load() {
        let d;
        try { d = await API.question(S.roundId); } catch (er) { if (er.code === 'round_complete') return go('result'); $('#q').innerHTML = `<p class="msg bad">${errText(er)}</p>`; return; }
        if (!alive) return;
        const q = d.question, cat = q.category && S.categories.find(c => c.id === q.category);
        const meta = [cat ? catName(cat) : '', q.difficulty ? t('diff_' + q.difficulty) : ''].filter(Boolean).join(' · ');
        $('#q').innerHTML = `${pips(d.total, d.index - 1)}
          <div class="qcard">
            <div class="qmeta"><span>${t('q_of', { i: d.index, n: d.total })}</span><span>${esc(meta)}</span></div>
            <h1 class="qtext" id="qt" tabindex="-1">${esc(q.text)}</h1>
            ${q.image ? `<img src="${esc(q.image)}" alt="" style="max-width:100%;border-radius:12px;margin:0 0 14px">` : ''}
            <div class="timer"><span class="sr">${t('q_time_left')}</span><div class="track"><i id="bar"></i></div><b id="secs" aria-hidden="true"></b></div>
            <div class="opts" role="group" aria-labelledby="qt">${q.options.map((o, i) => `<button class="opt-btn" data-id="${esc(o.id)}"><b aria-hidden="true">${L[i]}</b><span>${esc(o.text)}</span></button>`).join('')}</div>
            <div class="feedback" id="fb" role="status"></div>
            <div id="nextWrap"></div>
          </div>`;
        $('#qt').focus();
        const start = performance.now(), dur = d.seconds * 1000; let answered = false, lastSay = -1;
        const bar = $('#bar'), secs = $('#secs');
        const frame = () => {
          if (!alive || answered) return;
          const left = Math.max(0, dur - (performance.now() - start)), s = Math.ceil(left / 1000);
          bar.style.transform = `scaleX(${left / dur})`; bar.classList.toggle('low', s <= 5); secs.textContent = t('q_secs', { s });
          if ((s === 10 || s === 5) && s !== lastSay) { lastSay = s; announce(t('q_secs', { s })); }
          if (left <= 0) return submit(null);
          timer = requestAnimationFrame(frame);
        };
        frame();
        const btns = [...document.querySelectorAll('.opt-btn')];
        btns.forEach(b => (b.onclick = () => submit(b.dataset.id, b)));
        keyH = e => { const k = e.key.toUpperCase(); const i = L.indexOf(k) >= 0 ? L.indexOf(k) : '1234'.indexOf(k); if (i >= 0 && btns[i] && !answered && !e.target.matches('input')) submit(btns[i].dataset.id, btns[i]); };
        document.addEventListener('keydown', keyH);
        async function submit(optionId, btn) {
          if (answered) return; answered = true; cancelAnimationFrame(timer); document.removeEventListener('keydown', keyH);
          btns.forEach(b => (b.disabled = true));
          let r;
          try { r = await API.answer(S.roundId, { question_id: q.id, option_id: optionId }); }
          catch (er) { $('#fb').innerHTML = `<span class="err">${errText(er)}</span>`; return; }
          if (!alive) return;
          S.marks.push(r.correct);
          const right = btns.find(b => b.dataset.id === String(r.correct_option_id));
          right && right.classList.add('right');
          if (btn && !r.correct) btn.classList.add('wrong');
          const msg = r.correct ? t('q_correct') : r.timed_out ? t('q_timeout') : t('q_wrong');
          $('#fb').textContent = msg; $('#fb').style.color = r.correct ? 'var(--ok)' : 'var(--bad)';
          document.querySelector('.pips').outerHTML = pips(d.total, -1);
          $('#nextWrap').innerHTML = `<button class="btn blue block" id="nx" style="margin-top:14px">${r.next ? t('q_next') : t('q_finish')}</button>`;
          $('#nx').onclick = () => (r.next ? load() : go('result'));
          $('#nx').focus();
        }
      }
      load();
      return () => { alive = false; cancelAnimationFrame(timer); keyH && document.removeEventListener('keydown', keyH); };
    }
  };

  V.result = {
    auth: true,
    guard: () => !!S.roundId || 'play',
    render: () => `<div class="col" id="res"><p class="hint">…</p></div>`,
    bind: async () => {
      let r;
      try { r = await API.result(S.roundId); } catch (er) { $('#res').innerHTML = `<p class="msg bad">${errText(er)}</p>`; return; }
      S.roundId = null; S.play = null;
      const head = r.qualified
        ? `<div class="win"><span class="ribbon big">TZS ${fmt(C.PRIZES.hourly)} · TZS ${fmt(C.PRIZES.daily)}</span>
             <h1 tabindex="-1" id="rh">${t('res_win_title')}</h1><p class="lead">${t('res_win_body')}</p></div>`
        : `<div><div class="score" aria-hidden="true">${r.score}/${r.total}</div><h1 tabindex="-1" id="rh">${t('res_lose_title', { score: r.score })}</h1><p class="lead">${t('res_lose_body')}</p></div>`;
      $('#res').innerHTML = `${head}
        <div class="stack" style="margin-top:20px">
          <button class="btn primary block" id="again">${t('res_again')}</button>
          <a class="btn text block" href="#play">${t('res_home')}</a>
        </div>
        <h2 style="margin-top:28px">${t('res_summary')}</h2>
        <ol class="summary">${r.items.map(it => `<li class="${it.correct ? 'ok' : 'no'}"><span class="mark" aria-hidden="true">${it.correct ? '✓' : '✕'}</span><div>
          <p class="q">${esc(it.question)}</p>
          <p><span class="sr">${it.correct ? t('q_correct') : t('q_wrong')} </span>${t('res_your')}: <strong>${it.your_answer ? esc(it.your_answer) : t('res_none')}</strong></p>
          ${it.correct ? '' : `<small>${t('res_right')}: ${esc(it.correct_answer)}</small>`}</div></li>`).join('')}</ol>`;
      $('#rh').focus(); announce(r.qualified ? t('res_win_title') : t('res_lose_title', { score: r.score }));
      $('#again').onclick = () => { S.autoNotice = true; go('play'); };
    }
  };

  V.settings = {
    auth: true,
    render: () => `<div class="col">
      <h1>${t('set_title')}</h1>
      <section class="sec" style="border:0;margin-top:8px;padding-top:0"><h2>${t('set_account')}</h2>
        <div class="kv"><span>${t('set_phone')}</span><strong style="white-space:nowrap">${showPhone(S.user.msisdn)}</strong></div></section>
      <section class="sec" aria-labelledby="sc"><h2 id="sc">${t('set_cats')}</h2>
        <div class="row"><span id="catCount" aria-live="polite"></span><span><button class="btn text" type="button" id="all">${t('cat_all')}</button><button class="btn text" type="button" id="none">${t('cat_none')}</button></span></div>
        ${catsHtml(S.user.categories)}
        <div class="err" id="catErr" role="alert"></div>
        <button class="btn blue block" id="save" style="margin-top:14px" data-label="${t('cat_save_settings')}">${t('cat_save_settings')}</button></section>
      <section class="sec" aria-labelledby="ss"><h2 id="ss">${t('set_sms')}</h2>
        <label class="switch"><span>${t('set_sms_toggle')}</span><input type="checkbox" role="switch" id="sms" ${S.user.sms_marketing ? 'checked' : ''}></label>
        <p class="msg ${S.user.sms_marketing ? 'ok' : ''}" id="smsMsg" style="margin-top:12px;${S.user.sms_marketing ? '' : 'background:var(--soft)'}" role="status">${t(S.user.sms_marketing ? 'set_sms_on' : 'set_sms_off')}</p>
        <p class="hint">${t('set_sms_help')}</p></section>
      <section class="sec"><h2>${t('set_lang')}</h2>
        <div class="row" style="justify-content:flex-start">
          <button class="btn ${I18N.lang === 'sw' ? 'blue' : 'ghost'}" data-lang="sw" aria-pressed="${I18N.lang === 'sw'}" lang="sw">Kiswahili</button>
          <button class="btn ${I18N.lang === 'en' ? 'blue' : 'ghost'}" data-lang="en" aria-pressed="${I18N.lang === 'en'}" lang="en">English</button></div></section>
      <section class="sec"><h2>${t('tour_open')}</h2><button class="btn ghost" type="button" id="tourAgain">${t('tour_open')}</button></section>
      <section class="sec"><h2>${t('set_legal')}</h2><p><a href="#terms">${t('footer_terms')}</a><br><a href="#privacy">${t('footer_privacy')}</a></p></section>
      <section class="sec"><button class="btn ghost block" id="logout">${t('set_logout')}</button></section>
    </div>`,
    bind: () => {
      bindCats(null);
      $('#tourAgain').onclick = () => openTour();
      const sms = $('#sms'), m = $('#smsMsg');
      sms.onchange = async () => {
        sms.disabled = true; const v = sms.checked;
        try { S.user = await API.saveConsents(v); m.className = 'msg' + (v ? ' ok' : ''); m.style.background = v ? '' : 'var(--soft)'; m.textContent = t(v ? 'set_sms_on' : 'set_sms_off'); }
        catch (er) { sms.checked = !v; m.className = 'msg bad'; m.textContent = errText(er); }
        sms.disabled = false;
      };
      document.querySelectorAll('[data-lang]').forEach(b => (b.onclick = () => { if (b.dataset.lang !== I18N.lang) switchLang(); }));
      $('#logout').onclick = async () => { await API.logout().catch(() => {}); S.user = null; toast(t('logged_out')); go('home'); };
      S.legalBack = 'settings';
    }
  };

  const legalView = key => ({
    render: () => `<div class="col legal">
      <p class="note warn">${t('legal_draft')}</p>
      ${LEGAL[key]()}
      <p style="margin-top:28px"><a class="btn ghost" href="#${S.legalBack}">${t('back')}</a></p>
    </div>`
  });
  V.terms = legalView('terms');
  V.privacy = legalView('privacy');

  // ---------- router ----------
  let cleanup = null;
  const current = () => location.hash.slice(1) || 'home';
  function route() {
    let name = current();
    if (!V[name]) name = 'home';
    const v = V[name];
    // Portal mode before the campaign is published: a "coming soon" page (no sign-up, no SMS), legal pages stay open.
    if (API.mode === 'portal' && C.CAMPAIGN_STATUS === 'none' && !['terms', 'privacy'].includes(name)) {
      chrome('home');
      app.innerHTML = `<div class="col stack"><section class="play-card band"><h1>${t('soon_title')}</h1><p>${t('soon_body')}</p></section></div>`;
      document.title = 'Bongo Trivia · ' + t('tagline');
      return;
    }
    if (v.auth && !S.user) { S.auth.intent = 'login'; return go('login'); }
    if (v.guard) { const g = v.guard(); if (g !== true) return go(g); }
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    chrome(name);
    app.innerHTML = v.render();
    document.title = 'Bongo Trivia' + (name === 'home' ? ' · ' + t('tagline') : '');
    if (v.bind) { const c = v.bind(app); if (typeof c === 'function') cleanup = c; }
    if (!['quiz', 'result', 'verify'].includes(name)) { const h = app.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- boot ----------
  (async () => {
    document.documentElement.lang = I18N.lang;
    try { S.categories = await API.categories(); } catch (e) {}
    try { S.user = await API.me(); } catch (e) { S.user = null; }
    if (S.user && S.user.lang && S.user.lang !== I18N.lang) I18N.set(S.user.lang);
    route();
  })();
}
