/* API client. Screens call window.API.*; this file picks the back end:
     MODE 'mock'   → js/mock-api.js (demo, in the browser)
     MODE 'portal' → the Bongo Trivia public API in the Bluetrain Portal (worker/routes/bongo-public.js),
                     reached same-origin at /bongo-trivia/api/* through the bongo-trivia-web Worker's PORTAL binding.
   Every function resolves to the shapes the screens use (documented next to each one) and throws
   { status, code, message } on failure. The portal adapter translates between the two. */
{
  const C = window.BT_CONFIG;
  const M = () => window.BTMock;
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ======================= portal adapter =======================
  const P = {
    token: store.get('bt_token'),        // 64-hex bearer token from /auth/verify, valid 30 days
    phone: store.get('bt_phone'),        // the player's own number, kept on this device for display only
    campaign: null,                      // GET /campaigns/:code
    rounds: {},                          // roundId -> { next question, answers summary, result }
    entries: {}                          // entryId -> roundId once a round has started from it
  };
  const err = (status, code, message, extra) => Object.assign(new Error(message || code), { status, code, message }, extra || {});

  async function call(method, path, body) {
    const headers = { 'Accept': 'application/json', 'Accept-Language': I18N.lang };
    if (body) headers['Content-Type'] = 'application/json';
    if (P.token) headers['Authorization'] = 'Bearer ' + P.token;
    let res;
    try { res = await fetch(C.API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw err(0, 'network'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && P.token) { P.token = null; store.set('bt_token', null); }
    if (!res.ok) throw err(res.status, codeFor(res.status, data.error || '', data.code), data.error || '');
    return data;
  }
  // The portal answers { error: "<plain sentence>", code: "<stable code>" } (bongo-public.js, 14 Nov 2026). The screens
  // branch on a few codes; any other code keeps the sentence (shown as-is) under 'server'. Text matching stays only as
  // a fallback for answers without a code.
  const PORTAL_CODES = { invalid_code: 'invalid_code', expired_code: 'expired_code', too_many_attempts: 'too_many_attempts',
    age_required: 'not_registered', invalid_msisdn: 'invalid_msisdn', payment_pending: 'payment_pending',
    limit_reached: 'limit_reached', rate_limited: 'rate_limited', payment_required: 'payment_required', unauthenticated: 'unauthenticated', test_only: 'test_only', rounds_waiting: 'rounds_waiting' };
  function codeFor(status, msg, code) {
    if (status === 401) return 'unauthenticated';
    if (code) return PORTAL_CODES[code] || 'server';
    const m = msg.toLowerCase();
    if (m.includes('code is wrong')) return 'invalid_code';
    if (m.includes('too many wrong codes')) return 'too_many_attempts';
    if (m.includes('expired') || m.includes('ask for a new one') || m.includes('already used')) return 'expired_code';
    if (m.includes('confirm your age')) return 'not_registered';
    if (m.includes('tanzanian mobile')) return 'invalid_msisdn';
    if (m.includes('payment prompt was just sent')) return 'payment_pending';
    if (status === 429 && (m.includes('rounds an hour') || m.includes("today's limit"))) return 'limit_reached';
    if (status === 429) return 'rate_limited';
    if (status === 402) return 'payment_required';
    return 'server';
  }
  const e164 = msisdn => '+' + String(msisdn).replace(/^\+/, '');
  const localPrefs = () => store.get('bt_prefs_' + (P.phone || ''), {});   // device copy of categories + tutorial flag (the portal stores both since 0005)
  const savePrefs = patch => store.set('bt_prefs_' + (P.phone || ''), Object.assign(localPrefs(), patch));

  // Portal player → the user object the screens use.
  function userOf(pl) {
    const prefs = localPrefs();
    return {
      id: pl.id, msisdn: (P.phone || '').replace('+', ''), msisdn_masked: '',
      categories: (pl.categories && pl.categories.length ? pl.categories : prefs.categories) || [],
      sms_marketing: !!pl.marketing_opt_in, lang: pl.locale || I18N.lang,
      tutorial_done: !!(pl.tutorial_done_at || prefs.tutorial_done),
      status: pl.status, wins: pl.wins || [], campaigns: pl.campaigns || []
    };
  }
  // Campaign settings drive price, questions, timer and prizes on screen (Bongo Trivia → Campaigns in the portal).
  function applyCampaign(c) {
    const camp = c.campaign;
    C.PRICE_TZS = camp.entry.priceTzs || C.PRICE_TZS;
    C.QUESTIONS_PER_SET = camp.questions;
    C.QUESTION_SECONDS = camp.seconds;
    C.PLAY_MODE = camp.entry.playMode;                // 'paid' | 'off' (payments switched off: free) | 'free'
    const hourly = c.prizes.find(p => p.tier === 'hourly'), daily = c.prizes.find(p => p.tier === 'daily');
    if (hourly && hourly.amount_tzs) C.PRIZES.hourly = hourly.amount_tzs;
    if (daily && daily.amount_tzs) C.PRIZES.daily = daily.amount_tzs;
  }
  // Agent links: /r/CODE[/CAMPAIGN][?s=subid] arrive as /?ref=CODE&c=CAMPAIGN&s=subid (Worker redirect).
  function referral() { return store.get('bt_ref', {}); }

  // Start a round from a paid entry (or free, when payments are off) and remember its first question.
  async function startRound(entryId) {
    const prefs = userCats();
    // The portal picks one easy, one medium and one hard question across all the player's categories.
    const r = await call('POST', '/rounds', {
      campaign: C.CAMPAIGN_CODE, entryId: entryId || undefined,
      categories: prefs, channel: 'web', device: deviceId()
    });
    P.rounds[r.id] = { next: r.question, seconds: r.seconds, items: [], result: null };
    return r.id;
  }
  const userCats = () => (window.API._user && window.API._user.categories) || localPrefs().categories || [];
  function deviceId() { let d = store.get('bt_device'); if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('bt_device', d); } return d; }

  const portal = {
    // Load the campaign once at boot; returns categories [{id, name_sw, name_en}] for the pickers.
    async categories() {
      try { P.campaign = await call('GET', `/campaigns/${encodeURIComponent(C.CAMPAIGN_CODE)}`); }
      catch (e) { if (e.status === 404) C.CAMPAIGN_STATUS = 'none'; throw e; }   // not published yet: the app shows "coming soon"
      C.CAMPAIGN_STATUS = P.campaign.campaign.status;
      C.TEST = !!P.campaign.campaign.test;                                       // test campaign: banner, test numbers only                            // ready | live | paused | closed
      applyCampaign(P.campaign);
      return P.campaign.categories;
    },
    // Signup and login are one flow on the portal: /auth/start sends the code to any valid number.
    async sendOtp(msisdn, intent) {
      const r = await call('POST', '/auth/start', { phone: e164(msisdn), locale: I18N.lang });
      return { request_id: r.otpId, expires_in: r.expiresIn, resend_in: C.OTP_RESEND_SECONDS, intent };
    },
    // New numbers need adult: true (sign-up form); an existing player just signs in.
    async verifyOtp({ request_id, msisdn, code, consents }) {
      const ref = referral();
      const r = await call('POST', '/auth/verify', {
        otpId: request_id, phone: e164(msisdn), code,
        adult: !!(consents && consents.age_confirmed), marketing: !!(consents && consents.sms_marketing),
        locale: I18N.lang, campaign: C.CAMPAIGN_CODE, channel: ref.code ? 'link' : 'web',
        ref: ref.typed || undefined, click: ref.click || undefined, subid: ref.subid || undefined, utm: ref.utm || undefined,
        device: deviceId()
      });
      P.token = r.token; store.set('bt_token', r.token);
      P.phone = e164(msisdn); store.set('bt_phone', P.phone);
      const u = userOf(r.player); window.API._user = u;
      return { user: u, is_new: !u.categories.length };
    },
    async me() {
      if (!P.token) throw err(401, 'unauthenticated');
      const r = await call('GET', '/me'); const u = userOf(r.player); window.API._user = u; return u;
    },
    async logout() { await call('POST', '/auth/logout').catch(() => {}); P.token = null; store.set('bt_token', null); store.set('bt_phone', null); return { ok: true }; },
    async saveCategories(ids) {
      if (!ids.length) throw err(422, 'no_categories');
      savePrefs({ categories: ids });
      const r = await call('POST', '/me', { categories: ids });
      const u = userOf(r.player); u.categories = ids; window.API._user = u; return u;
    },
    async saveConsents(sms) { const r = await call('POST', '/me', { marketing: !!sms }); const u = userOf(r.player); window.API._user = u; return u; },
    async savePreferences(lang) { if (!P.token) return null; const r = await call('POST', '/me', { locale: lang }); return userOf(r.player); },
    async completeTutorial() { savePrefs({ tutorial_done: true }); return call('POST', '/me', { tutorialDone: true }).catch(() => null); },

    // Play: paid → POST /entries (USSD push from EmGlobe), then poll; payments off or free → straight to a round.
    async startPlay() {
      if (C.PLAY_MODE !== 'paid') {
        const roundId = await startRound(null);
        const id = 'free_' + roundId; P.entries[id] = roundId;
        return { play_id: id, status: 'success', round_id: roundId, free: true };
      }
      const r = await call('POST', '/entries', { campaign: C.CAMPAIGN_CODE, rounds: 1 });
      return { play_id: r.entry.id, amount: r.entry.amount_tzs, merchant: C.MERCHANT, status: 'pending', expires_in: C.PAYMENT_TIMEOUT_SECONDS };
    },
    // Entry status → screen status. A paid entry starts its round once (remembered per entry).
    async paymentStatus(playId) {
      if (P.entries[playId]) return { status: 'success', round_id: P.entries[playId] };
      const { entry } = await call('GET', `/entries/${playId}`);
      if (entry.status === 'paid') {
        // Paid: start the round. If it can't start now (e.g. the hourly limit), the paid round is kept for later.
        try { const rid = await startRound(entry.id); P.entries[playId] = rid; return { status: 'success', round_id: rid }; }
        catch (e) { return { status: 'saved', reason: e.code }; }
      }
      if (entry.status === 'failed') return { status: /cancel|declin|reject/i.test(entry.error || '') ? 'cancelled' : 'failed', reason: entry.error };
      if (entry.status === 'expired') return { status: 'expired' };
      return { status: 'pending' };
    },
    // The portal sends the next question with each answer; GET /rounds/:id is the fallback (reload, resume).
    async question(roundId) {
      const st = P.rounds[roundId] || (P.rounds[roundId] = { items: [] });
      let q = st.next, seconds = st.seconds || C.QUESTION_SECONDS;
      if (!q) {
        const r = await call('GET', `/rounds/${roundId}`);
        if (r.status !== 'open') throw err(409, 'round_complete');
        q = r.question; seconds = Math.max(1, Math.round(r.msLeft / 1000));
      }
      st.current = q; st.next = null;
      return { index: q.index + 1, total: q.total, seconds, question: { id: q.index, text: q.text, image: q.image, category: q.category ? q.category.id : null, difficulty: q.difficulty || null, options: q.options.map((t, i) => ({ id: i, text: t })) } };
    },
    async answer(roundId, { question_id, option_id }) {
      const st = P.rounds[roundId];
      const r = await call('POST', `/rounds/${roundId}/answer`, { index: Number(question_id), choice: option_id === null ? null : Number(option_id) });
      const q = st.current;
      st.items.push({ question: q.text, your_answer: option_id === null || r.timedOut ? null : q.options[Number(option_id)], correct_answer: q.options[r.correctIndex], correct: !!r.ok });
      if (r.done) st.result = r.result; else st.next = r.question;
      return { correct: !!r.ok, timed_out: !!r.timedOut, correct_option_id: r.correctIndex, next: !r.done };
    },
    async result(roundId) {
      const st = P.rounds[roundId] || { items: [] };
      let res = st.result;
      if (!res) { const r = await call('GET', `/rounds/${roundId}`); res = r.result; }
      const allRight = res.correct === res.total;          // brief: all 3 right enters the draws (campaign pass_mark = 3)
      return { score: res.correct, total: res.total, qualified: !!res.qualified && allRight, items: st.items,
        draws: res.qualified ? [{ tier: 'hourly', amount: C.PRIZES.hourly }, { tier: 'daily', amount: C.PRIZES.daily }] : [] };
    },
    // Draw entries now (qualifying rounds this hour and today). Null hides the tally.
    async entries() {
      try { return await call('GET', `/me/draw-entries?campaign=${encodeURIComponent(C.CAMPAIGN_CODE)}`); }
      catch (e) { return null; }
    },
    // Paid rounds already bought and not yet played (they never expire once paid).
    async paidRounds() { if (C.PLAY_MODE !== 'paid') return 0; try { return (await call('GET', `/entries?campaign=${encodeURIComponent(C.CAMPAIGN_CODE)}`)).roundsLeft || 0; } catch (e) { return 0; } },
    async playPaid() { const roundId = await startRound(null); const id = 'paid_' + roundId; P.entries[id] = roundId; return { play_id: id, status: 'success', round_id: roundId }; },
    // Ads for a free play (paid campaigns while payments are collected): offer, next ad, complete, click.
    async adOffer() { try { return await call('GET', `/ads?campaign=${encodeURIComponent(C.CAMPAIGN_CODE)}`); } catch (e) { return null; } },
    async nextAd() { return call('POST', '/ads/next', { campaign: C.CAMPAIGN_CODE, device: deviceId() }); },
    async completeAd(token) { return call('POST', `/ads/${token}/complete`, {}); },
    async clickAd(token) { return call('POST', `/ads/${token}/click`, {}); },
    // A round from a free play earned by an ad (the portal uses a paid entry first if one is waiting).
    async startFreePlay() { const roundId = await startRound(null); const id = 'ad_' + roundId; P.entries[id] = roundId; return { play_id: id, status: 'success', round_id: roundId, free: true }; },
    // Agent link click (once per visit with ?ref=): returns a token used at sign-up.
    async trackClick({ code, campaign, subid, utm }) { const r = await call('POST', '/click', { code, campaign, subid, utm, channel: 'link' }); return r.token; }
  };

  // ======================= mock =======================
  const mock = {
    categories: () => M().categories(),
    sendOtp: (msisdn, intent) => M().sendOtp({ msisdn, intent }),
    verifyOtp: (p) => M().verifyOtp(p),
    me: () => M().me(),
    logout: () => M().logout(),
    saveCategories: (ids) => M().saveCategories({ category_ids: ids }),
    saveConsents: (sms) => M().saveConsents({ sms_marketing: sms }),
    savePreferences: (lang) => M().savePreferences({ lang }),
    completeTutorial: () => M().savePreferences({ tutorial_done: true }),
    startPlay: () => M().startPlay(),
    paymentStatus: (id) => M().paymentStatus(id),
    question: (id) => M().question(id),
    answer: (id, p) => M().answer(id, p),
    result: (id) => M().result(id),
    entries: () => M().entries(),
    trackClick: async () => 'demo-click'
  };

  window.API = Object.assign({ _user: null, mode: C.MODE, store }, C.MODE === 'portal' ? portal : mock);

  // Capture agent referrals before anything else: ?ref=CODE&c=CAMPAIGN&s=subid&utm_*
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('ref')) {
      const utm = {}; for (const [k, v] of q) if (/^(utm_\w+|gclid|fbclid|ttclid)$/.test(k)) utm[k] = v;
      const ref = { code: q.get('ref').toUpperCase(), campaign: q.get('c') || C.CAMPAIGN_CODE, subid: q.get('s') || null, utm, at: Date.now() };
      store.set('bt_ref', ref);
      window.API.trackClick(ref).then(token => store.set('bt_ref', Object.assign(ref, { click: token }))).catch(() => {});
      history.replaceState(null, '', location.pathname + location.hash);
    }
  } catch (e) {}
}
