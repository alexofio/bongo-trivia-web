/* Demo back end. Same request/response shapes as bt-api (see README "Backend endpoints").
   Answers stay in here and are never sent before the player answers, mirroring server-side grading.
   Sample questions only: every live question needs Swahili editor approval. */
{
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const err = (status, code, extra = {}) => Object.assign(new Error(code), { status, code }, extra);
  const id = p => p + '_' + Math.random().toString(36).slice(2, 10);

  const CATEGORIES = [
    ['tanzania', 'Tanzania', 'Tanzania'], ['bibilia', 'Bibilia', 'Bible'], ['michezo', 'Michezo', 'Sports'],
    ['dunia', 'Dunia', 'World'], ['historia', 'Historia', 'History'], ['ujuzi', 'Ujuzi wa jumla', 'General knowledge'],
    ['soka', 'Soka', 'Football'], ['hesabu', 'Hesabu', 'Maths'], ['sayansi', 'Sayansi', 'Science'],
    ['muziki', 'Muziki', 'Music'], ['afrika', 'Afrika', 'Africa'], ['urembo', 'Urembo', 'Beauty'],
    ['kabila', 'Kabila', 'Languages & heritage'], ['kiingereza', 'Kiingereza', 'English']
  ].map(([id, sw, en]) => ({ id, name_sw: sw, name_en: en }));

  // [category, difficulty, [sw question, en question], [[sw, en] x4], correctIndex]
  const BANK = [
    ['tanzania', 'easy', ['Mji mkuu wa Tanzania ni upi?', 'What is the capital city of Tanzania?'], [['Dodoma', 'Dodoma'], ['Dar es Salaam', 'Dar es Salaam'], ['Arusha', 'Arusha'], ['Mwanza', 'Mwanza']], 0],
    ['tanzania', 'easy', ['Mlima mrefu zaidi Tanzania ni upi?', 'What is the highest mountain in Tanzania?'], [['Meru', 'Meru'], ['Kilimanjaro', 'Kilimanjaro'], ['Rungwe', 'Rungwe'], ['Hanang', 'Hanang']], 1],
    ['tanzania', 'medium', ['Tanganyika ilipata uhuru mwaka gani?', 'In which year did Tanganyika gain independence?'], [['1957', '1957'], ['1964', '1964'], ['1961', '1961'], ['1970', '1970']], 2],
    ['bibilia', 'easy', ['Nani alijenga safina?', 'Who built the ark?'], [['Musa', 'Moses'], ['Nuhu', 'Noah'], ['Daudi', 'David'], ['Ibrahimu', 'Abraham']], 1],
    ['bibilia', 'medium', ['Kitabu cha kwanza cha Biblia ni kipi?', 'What is the first book of the Bible?'], [['Kutoka', 'Exodus'], ['Zaburi', 'Psalms'], ['Mathayo', 'Matthew'], ['Mwanzo', 'Genesis']], 3],
    ['michezo', 'easy', ['Michezo ya Olimpiki ya majira ya joto hufanyika kila baada ya miaka mingapi?', 'How often are the Summer Olympic Games held?'], [['Kila miaka 4', 'Every 4 years'], ['Kila miaka 2', 'Every 2 years'], ['Kila miaka 3', 'Every 3 years'], ['Kila miaka 5', 'Every 5 years']], 0],
    ['michezo', 'medium', ['Timu moja ya mpira wa kikapu ina wachezaji wangapi uwanjani?', 'How many players does one basketball team have on court?'], [['6', '6'], ['7', '7'], ['5', '5'], ['11', '11']], 2],
    ['dunia', 'easy', ['Bahari kubwa zaidi duniani ni ipi?', 'What is the largest ocean in the world?'], [['Hindi', 'Indian'], ['Atlantiki', 'Atlantic'], ['Aktiki', 'Arctic'], ['Pasifiki', 'Pacific']], 3],
    ['dunia', 'medium', ['Mlima Everest uko katika safu ya milima ipi?', 'Mount Everest is in which mountain range?'], [['Himalaya', 'Himalayas'], ['Alps', 'Alps'], ['Andes', 'Andes'], ['Rocky', 'Rockies']], 0],
    ['historia', 'easy', ['Rais wa kwanza wa Tanzania alikuwa nani?', 'Who was the first President of Tanzania?'], [['Ali Hassan Mwinyi', 'Ali Hassan Mwinyi'], ['Julius Nyerere', 'Julius Nyerere'], ['Benjamin Mkapa', 'Benjamin Mkapa'], ['Jakaya Kikwete', 'Jakaya Kikwete']], 1],
    ['historia', 'medium', ['Muungano wa Tanganyika na Zanzibar ulifanyika mwaka gani?', 'In which year did Tanganyika and Zanzibar unite?'], [['1961', '1961'], ['1963', '1963'], ['1964', '1964'], ['1967', '1967']], 2],
    ['historia', 'hard', ['Azimio la Arusha lilitangazwa mwaka gani?', 'In which year was the Arusha Declaration made?'], [['1961', '1961'], ['1972', '1972'], ['1977', '1977'], ['1967', '1967']], 3],
    ['ujuzi', 'easy', ['Mwaka mrefu (leap year) una siku ngapi?', 'How many days are in a leap year?'], [['366', '366'], ['365', '365'], ['364', '364'], ['360', '360']], 0],
    ['ujuzi', 'medium', ['Ipi kati ya hizi ni rangi ya msingi katika rangi za kupaka?', 'Which of these is a primary colour in paint?'], [['Kijani', 'Green'], ['Bluu', 'Blue'], ['Zambarau', 'Purple'], ['Machungwa', 'Orange']], 1],
    ['soka', 'easy', ['Mechi ya soka ina dakika ngapi za kawaida?', 'How many minutes is a standard football match?'], [['80', '80'], ['100', '100'], ['90', '90'], ['120', '120']], 2],
    ['soka', 'medium', ['Kombe la Dunia la FIFA 2022 lilifanyika nchi gani?', 'Which country hosted the 2022 FIFA World Cup?'], [['Urusi', 'Russia'], ['Brazil', 'Brazil'], ['Afrika Kusini', 'South Africa'], ['Qatar', 'Qatar']], 3],
    ['soka', 'hard', ['Nchi gani ilishinda Kombe la Dunia la FIFA 2022?', 'Which country won the 2022 FIFA World Cup?'], [['Argentina', 'Argentina'], ['Ufaransa', 'France'], ['Kroatia', 'Croatia'], ['Moroko', 'Morocco']], 0],
    ['hesabu', 'easy', ['12 × 8 = ?', '12 × 8 = ?'], [['86', '86'], ['96', '96'], ['98', '98'], ['108', '108']], 1],
    ['hesabu', 'medium', ['Asilimia 25 ya 840 ni ngapi?', 'What is 25% of 840?'], [['200', '200'], ['220', '220'], ['210', '210'], ['240', '240']], 2],
    ['hesabu', 'hard', ['Seti 3 za TZS 950 kila moja ni jumla ya shilingi ngapi?', '3 sets at TZS 950 each cost how much in total?'], [['2,750', '2,750'], ['2,950', '2,950'], ['3,850', '3,850'], ['2,850', '2,850']], 3],
    ['sayansi', 'easy', ['Gesi tunayovuta ili kuishi ni ipi?', 'Which gas do we breathe in to stay alive?'], [['Oksijeni', 'Oxygen'], ['Kaboni dioksidi', 'Carbon dioxide'], ['Naitrojeni', 'Nitrogen'], ['Hidrojeni', 'Hydrogen']], 0],
    ['sayansi', 'medium', ['Maji huchemka kwa nyuzi joto ngapi za Selsiasi usawa wa bahari?', 'At sea level, water boils at how many degrees Celsius?'], [['90', '90'], ['100', '100'], ['110', '110'], ['120', '120']], 1],
    ['sayansi', 'hard', ['Sayari iliyo karibu zaidi na Jua ni ipi?', 'Which planet is closest to the Sun?'], [['Zuhura', 'Venus'], ['Mirihi', 'Mars'], ['Zebaki', 'Mercury'], ['Dunia', 'Earth']], 2],
    ['muziki', 'easy', ['Ala ipi ya muziki ina funguo nyeupe na nyeusi?', 'Which instrument has black and white keys?'], [['Gitaa', 'Guitar'], ['Ngoma', 'Drum'], ['Filimbi', 'Flute'], ['Piano', 'Piano']], 3],
    ['muziki', 'medium', ['Muziki wa Bongo Flava ulianzia nchi gani?', 'In which country did Bongo Flava music begin?'], [['Tanzania', 'Tanzania'], ['Kenya', 'Kenya'], ['Uganda', 'Uganda'], ['Nigeria', 'Nigeria']], 0],
    ['afrika', 'easy', ['Mto mrefu zaidi barani Afrika ni upi?', 'What is the longest river in Africa?'], [['Kongo', 'Congo'], ['Naili', 'Nile'], ['Niger', 'Niger'], ['Zambezi', 'Zambezi']], 1],
    ['afrika', 'medium', ['Ziwa kubwa zaidi barani Afrika ni lipi?', 'What is the largest lake in Africa?'], [['Tanganyika', 'Tanganyika'], ['Nyasa', 'Malawi'], ['Viktoria', 'Victoria'], ['Turkana', 'Turkana']], 2],
    ['afrika', 'hard', ['Nchi ipi kati ya hizi haipakani na Tanzania?', 'Which of these countries does not border Tanzania?'], [['Kenya', 'Kenya'], ['Malawi', 'Malawi'], ['Msumbiji', 'Mozambique'], ['Ethiopia', 'Ethiopia']], 3],
    ['urembo', 'medium', ['Ngozi hutengeneza vitamini ipi inapopata mwanga wa jua?', 'Which vitamin does skin make in sunlight?'], [['Vitamini D', 'Vitamin D'], ['Vitamini C', 'Vitamin C'], ['Vitamini A', 'Vitamin A'], ['Vitamini K', 'Vitamin K']], 0],
    ['kabila', 'easy', ['Lugha ya taifa ya Tanzania ni ipi?', 'What is the national language of Tanzania?'], [['Kiingereza', 'English'], ['Kiswahili', 'Swahili'], ['Kiarabu', 'Arabic'], ['Kifaransa', 'French']], 1],
    ['kabila', 'medium', ['Kiswahili kimechukua maneno mengi kutoka lugha gani?', 'Swahili has borrowed many words from which language?'], [['Kichina', 'Chinese'], ['Kirusi', 'Russian'], ['Kiarabu', 'Arabic'], ['Kijapani', 'Japanese']], 2],
    ['kiingereza', 'easy', ['Wingi wa neno "child" kwa Kiingereza ni upi?', 'What is the plural of "child"?'], [['childs', 'childs'], ['childes', 'childes'], ['childer', 'childer'], ['children', 'children']], 3],
    ['kiingereza', 'medium', ['Kinyume cha neno "ancient" ni kipi?', 'What is the opposite of "ancient"?'], [['modern', 'modern'], ['old', 'old'], ['antique', 'antique'], ['aged', 'aged']], 0]
  ].map((r, i) => ({ id: 'q' + (i + 1), category: r[0], difficulty: r[1], text: r[2], options: r[3], answer: r[4] }));

  // ---- persisted demo state (one browser only) ----
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const users = load('bt_mock_users', {});
  let session = load('bt_mock_session', null);       // stands in for the httpOnly session cookie
  const otps = {};          // request_id -> {msisdn, code, expires, attempts, intent, consents}
  const plays = {};         // play_id -> {status, outcome, started, round_id}
  const rounds = {};        // round_id -> {questions, index, answers, deadline}
  const seen = new Set();   // question ids used this session (no repeats)
  const entries = load('bt_mock_entries', []); // timestamps of qualifying sets
  let demoOutcome = 'success';

  const me = () => { if (!session || !users[session]) throw err(401, 'unauthenticated'); return users[session]; };
  const mask = m => '+255 ' + m.slice(3, 5) + '* *** ' + m.slice(-3);
  const userOut = u => ({ id: u.id, msisdn: u.msisdn, msisdn_masked: mask(u.msisdn), categories: u.categories, sms_marketing: u.sms_marketing, lang: u.lang, tutorial_done: !!u.tutorial_done });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Random across the player's categories and across difficulty: aim for one easy, one medium, one hard.
  function drawQuestions(cats) {
    let pool = BANK.filter(q => cats.includes(q.category) && !seen.has(q.id));
    if (pool.length < BT_CONFIG.QUESTIONS_PER_SET) { seen.clear(); pool = BANK.filter(q => cats.includes(q.category)); }
    if (pool.length < BT_CONFIG.QUESTIONS_PER_SET) pool = BANK.slice(); // demo bank is small; live bank targets 500 per category
    const out = [];
    for (const d of shuffle(['easy', 'medium', 'hard'])) {
      const c = pool.filter(q => q.difficulty === d && !out.includes(q));
      if (c.length) out.push(pick(c));
    }
    while (out.length < BT_CONFIG.QUESTIONS_PER_SET) out.push(pick(pool.filter(q => !out.includes(q))));
    out.forEach(q => seen.add(q.id));
    // shuffle option order per player
    return shuffle(out).map(q => ({ ...q, order: shuffle([0, 1, 2, 3]) }));
  }

  const L = () => (I18N.lang === 'en' ? 1 : 0);
  const qOut = (q) => ({
    id: q.id, category: q.category, difficulty: q.difficulty, text: q.text[L()],
    options: q.order.map(i => ({ id: q.id + '_' + i, text: q.options[i][L()] }))
  });

  window.BTMock = {
    setOutcome(o) { demoOutcome = o; },
    get outcome() { return demoOutcome; },

    async sendOtp({ msisdn, intent }) {
      await wait(600);
      if (!/^255[67]\d{8}$/.test(msisdn)) throw err(422, 'invalid_msisdn');
      if (intent === 'login' && !users[msisdn]) throw err(404, 'not_registered');
      const request_id = id('otp');
      otps[request_id] = { msisdn, code: '123456', expires: Date.now() + 5 * 60e3, attempts: 0, intent };
      return { request_id, expires_in: 300, resend_in: BT_CONFIG.OTP_RESEND_SECONDS };
    },

    async verifyOtp({ request_id, code, consents }) {
      await wait(700);
      const o = otps[request_id];
      if (!o) throw err(410, 'expired_code');
      if (o.attempts >= 5) throw err(429, 'too_many_attempts');
      if (Date.now() > o.expires) throw err(410, 'expired_code');
      if (code !== o.code) { o.attempts++; throw err(400, 'invalid_code', { attempts_left: 5 - o.attempts }); }
      delete otps[request_id];
      let is_new = false;
      if (!users[o.msisdn]) {
        if (!consents || !consents.terms || !consents.age_confirmed) throw err(422, 'consent_required');
        users[o.msisdn] = { id: id('usr'), msisdn: o.msisdn, categories: [], sms_marketing: !!consents.sms_marketing, lang: I18N.lang, consents: { ...consents, at: new Date().toISOString() } };
        is_new = true;
      }
      session = o.msisdn; save('bt_mock_session', session); save('bt_mock_users', users);
      return { user: userOut(users[o.msisdn]), is_new };
    },

    async me() { await wait(150); return userOut(me()); },
    async logout() { session = null; save('bt_mock_session', null); return { ok: true }; },
    async categories() { await wait(200); return CATEGORIES; },
    async saveCategories({ category_ids }) {
      await wait(400); const u = me();
      if (!category_ids.length) throw err(422, 'no_categories');
      u.categories = category_ids; save('bt_mock_users', users); return userOut(u);
    },
    async saveConsents({ sms_marketing }) { await wait(400); const u = me(); u.sms_marketing = sms_marketing; save('bt_mock_users', users); return userOut(u); },
    async savePreferences({ lang, tutorial_done }) { const u = me(); if (lang) u.lang = lang; if (tutorial_done) u.tutorial_done = true; save('bt_mock_users', users); return userOut(u); },

    async startPlay() {
      await wait(700); const u = me();
      if (!u.categories.length) throw err(409, 'no_categories');
      if (demoOutcome === 'limit') throw err(429, 'limit_reached');
      const play_id = id('ply');
      plays[play_id] = { status: 'pending', outcome: demoOutcome, started: Date.now() };
      return { play_id, payment_id: id('pay'), amount: BT_CONFIG.PRICE_TZS, currency: 'TZS', merchant: BT_CONFIG.MERCHANT, status: 'pending', expires_in: BT_CONFIG.PAYMENT_TIMEOUT_SECONDS };
    },

    // Callback from the aggregator would flip the status server-side; here the chosen demo outcome lands after a few seconds.
    async paymentStatus(play_id) {
      await wait(250); const p = plays[play_id]; if (!p) throw err(404, 'not_found');
      const age = Date.now() - p.started;
      if (p.status === 'pending') {
        if (p.outcome === 'success' && age > 5000) {
          const rid = id('rnd');
          rounds[rid] = { questions: drawQuestions(me().categories), index: 0, answers: [], deadline: 0 };
          p.status = 'success'; p.round_id = rid;
        } else if (p.outcome === 'failed' && age > 5000) { p.status = 'failed'; p.reason = 'insufficient_funds'; }
        else if (p.outcome === 'cancelled' && age > 4000) p.status = 'cancelled';
        else if (p.outcome === 'expired' && age > 12000) p.status = 'expired'; // demo shortcut; live = PAYMENT_TIMEOUT_SECONDS
      }
      return { status: p.status, reason: p.reason || null, round_id: p.round_id || null };
    },

    async question(round_id) {
      await wait(200); const r = rounds[round_id]; if (!r) throw err(404, 'not_found');
      if (r.index >= r.questions.length) throw err(409, 'round_complete');
      const q = r.questions[r.index];
      r.deadline = Date.now() + BT_CONFIG.QUESTION_SECONDS * 1000;
      return { index: r.index + 1, total: r.questions.length, seconds: BT_CONFIG.QUESTION_SECONDS, deadline_at: new Date(r.deadline).toISOString(), question: qOut(q) };
    },

    async answer(round_id, { question_id, option_id }) {
      await wait(250); const r = rounds[round_id]; const q = r.questions[r.index];
      if (!q || q.id !== question_id) throw err(409, 'out_of_order');
      const late = Date.now() > r.deadline + 1500; // grace for network lag
      const correctId = q.id + '_' + q.answer;
      const correct = !late && option_id === correctId;
      r.answers.push({ q, option_id: late ? null : option_id, correct });
      r.index++;
      if (r.index === r.questions.length && r.answers.every(a => a.correct)) { entries.push(Date.now()); save('bt_mock_entries', entries); }
      return { correct, timed_out: late || option_id === null, correct_option_id: correctId, next: r.index < r.questions.length };
    },

    async result(round_id) {
      await wait(300); const r = rounds[round_id];
      const score = r.answers.filter(a => a.correct).length;
      const qualified = score === r.questions.length;
      const optText = (q, oid) => { if (!oid) return null; const i = +oid.split('_').pop(); return q.options[i][L()]; };
      return {
        score, total: r.questions.length, qualified,
        items: r.answers.map(a => ({ question: a.q.text[L()], category: a.q.category, your_answer: optText(a.q, a.option_id), correct_answer: a.q.options[a.q.answer][L()], correct: a.correct })),
        draws: qualified ? [{ tier: 'hourly', amount: BT_CONFIG.PRIZES.hourly }, { tier: 'daily', amount: BT_CONFIG.PRIZES.daily }] : []
      };
    },

    async entries() {
      await wait(150); me();
      const now = new Date(); const h0 = new Date(now); h0.setMinutes(0, 0, 0); const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
      return { hourly_current: entries.filter(t => t >= +h0).length, daily: entries.filter(t => t >= +d0).length };
    }
  };
}
