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
  const errText = e => ({ network: t('err_network'), rate_limited: t('err_rate'), too_many_requests: t('err_rate') }[e.code] || t('err_network'));
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
    const b = $('#demoBanner'); b.hidden = !C.USE_MOCK; b.textContent = t('demo_banner');
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
          ce.textContent = er.code === 'invalid_code' ? t('code_err_invalid', { n: er.attempts_left })
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
          <button class="btn primary block" id="playBtn">${t('play_cta')}</button>
          <p style="margin:12px 0 0;font-size:14px">${t('play_networks')} <a href="#settings" style="color:#fff">${t('play_edit_cats')}</a></p>
        </section>
        <section aria-labelledby="entH"><h2 id="entH" style="font-size:22px;margin-top:8px">${t('entries_title')}</h2>
          <div class="tally"><div><b id="eh">–</b>${t('entries_hour')}</div><div><b id="ed">–</b>${t('entries_day')}</div></div></section>
        <section class="soon" aria-disabled="true">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><rect x="4" y="9" width="44" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M22 18v12l10-6z" fill="currentColor"/><path d="M18 45h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          <div><span class="tag">${t('ads_soon')}</span><h3 style="margin:0 0 4px">${t('ads_title')}</h3><p style="margin:0;font-size:15px">${t('ads_body')}</p>
            <button class="btn ghost" disabled style="margin-top:10px;min-height:44px">${t('ads_soon')}</button></div>
        </section>
        ${demoPanel()}
        <div class="err" id="playErr" role="alert"></div>
      </div>
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
      API.entries().then(e => { $('#eh') && ($('#eh').textContent = e.hourly_current); $('#ed') && ($('#ed').textContent = e.daily); }).catch(() => {});
      bindDemo();
      const dlg = $('#notice');
      const open = () => { $('#nErr').textContent = ''; dlg.showModal(); $('#nOk').focus(); };
      $('#playBtn').onclick = open;
      $('#nNo').onclick = () => { dlg.close(); $('#playBtn').focus(); };
      $('#nOk').onclick = async () => {
        const btn = $('#nOk'); busy(btn, true, t('sending'));
        try { const r = await API.startPlay(); S.play = { play_id: r.play_id, startedAt: Date.now(), expires: r.expires_in }; dlg.close(); go('pay'); }
        catch (er) {
          busy(btn, false);
          if (er.code === 'no_categories') { dlg.close(); return go('categories'); }
          $('#nErr').textContent = er.code === 'limit_reached' ? t('pay_limit') : errText(er);
        }
      };
      if (S.autoNotice) { S.autoNotice = false; open(); }
    }
  };

  // Demo-only control: pick what the fake aggregator does with the next payment.
  const demoPanel = () => !C.USE_MOCK ? '' : `<div class="demo-pay"><span class="hint">${t('demo_pay')}</span><div class="seg" id="demoSeg">
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
      const end = (state) => {
        stop = true; $('#pf').classList.add('done');
        if (state === 'success') {
          $('#payH').textContent = t('pay_success');
          $('#payBody').innerHTML = `<p class="msg ok">${t('pay_success')}</p>`; announce(t('pay_success'));
          return setTimeout(() => go('quiz'), 1200);
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
          if (r.status !== 'pending') return end(r.status);
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
        const q = d.question, diff = t('diff_' + q.difficulty), cat = S.categories.find(c => c.id === q.category);
        $('#q').innerHTML = `${pips(d.total, d.index - 1)}
          <div class="qcard">
            <div class="qmeta"><span>${t('q_of', { i: d.index, n: d.total })}</span><span>${esc(cat ? catName(cat) : q.category)} · ${diff}</span></div>
            <h1 class="qtext" id="qt" tabindex="-1">${esc(q.text)}</h1>
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
          const right = btns.find(b => b.dataset.id === r.correct_option_id);
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
      <section class="sec"><h2>${t('set_legal')}</h2><p><a href="#terms">${t('footer_terms')}</a><br><a href="#privacy">${t('footer_privacy')}</a></p></section>
      <section class="sec"><button class="btn ghost block" id="logout">${t('set_logout')}</button></section>
    </div>`,
    bind: () => {
      bindCats(null);
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
