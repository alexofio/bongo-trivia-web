/* API client. One function per backend endpoint; with USE_MOCK it routes to BTMock instead of fetch.
   Session = httpOnly cookie set by bt-api on OTP verify (credentials: 'include'). Errors come back as
   { status, code, ...extra } so screens can switch on err.code. */
{
  const C = window.BT_CONFIG;

  async function http(method, path, body, headers = {}) {
    let res;
    try {
      res = await fetch(C.API_BASE + path, {
        method, credentials: 'include',
        headers: Object.assign({ 'Content-Type': 'application/json', 'Accept-Language': I18N.lang }, headers),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw Object.assign(new Error('network'), { status: 0, code: 'network' }); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.code || 'error'), { status: res.status, code: data.code || 'error' }, data);
    return data;
  }
  const idem = () => ({ 'Idempotency-Key': (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())) });
  const M = () => window.BTMock;
  const mock = C.USE_MOCK;

  window.API = {
    // POST /auth/otp/send  {msisdn, intent: 'signup'|'login'} -> {request_id, expires_in, resend_in}
    sendOtp: (msisdn, intent) => mock ? M().sendOtp({ msisdn, intent }) : http('POST', '/auth/otp/send', { msisdn, intent }),
    // POST /auth/otp/verify {request_id, msisdn, code, consents?} -> {user, is_new}; sets session cookie
    verifyOtp: (p) => mock ? M().verifyOtp(p) : http('POST', '/auth/otp/verify', p),
    // GET /me -> user
    me: () => mock ? M().me() : http('GET', '/me'),
    // POST /auth/logout
    logout: () => mock ? M().logout() : http('POST', '/auth/logout'),
    // GET /categories -> [{id, name_sw, name_en}]
    categories: () => mock ? M().categories() : http('GET', '/categories'),
    // PUT /me/categories {category_ids}
    saveCategories: (ids) => mock ? M().saveCategories({ category_ids: ids }) : http('PUT', '/me/categories', { category_ids: ids }),
    // PUT /me/consents {sms_marketing}
    saveConsents: (sms) => mock ? M().saveConsents({ sms_marketing: sms }) : http('PUT', '/me/consents', { sms_marketing: sms }),
    // PUT /me/preferences {lang}
    savePreferences: (lang) => mock ? M().savePreferences({ lang }) : http('PUT', '/me/preferences', { lang }),
    // POST /plays -> {play_id, payment_id, amount, merchant, status:'pending', expires_in}; triggers the mobile-money push
    startPlay: () => mock ? M().startPlay() : http('POST', '/plays', {}, idem()),
    // GET /plays/:id/payment -> {status: pending|success|failed|cancelled|expired, reason, round_id}
    paymentStatus: (playId) => mock ? M().paymentStatus(playId) : http('GET', `/plays/${playId}/payment`),
    // GET /rounds/:id/question -> {index, total, seconds, deadline_at, question:{id, text, options[{id,text}], category, difficulty}}
    question: (roundId) => mock ? M().question(roundId) : http('GET', `/rounds/${roundId}/question`),
    // POST /rounds/:id/answers {question_id, option_id|null} -> {correct, timed_out, correct_option_id, next}
    answer: (roundId, p) => mock ? M().answer(roundId, p) : http('POST', `/rounds/${roundId}/answers`, p, idem()),
    // GET /rounds/:id/result -> {score, total, qualified, items[], draws[]}
    result: (roundId) => mock ? M().result(roundId) : http('GET', `/rounds/${roundId}/result`),
    // GET /me/entries -> {hourly_current, daily}
    entries: () => mock ? M().entries() : http('GET', '/me/entries')
  };
}
