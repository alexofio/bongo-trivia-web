/* Bongo Trivia — player web: runtime settings.
   Switch USE_MOCK to false once bt-api is live; everything else reads from here. */
window.BT_CONFIG = {
  USE_MOCK: true,                 // true = js/mock-api.js answers every call (demo)
  API_BASE: '/api/v1',            // served by Worker bt-api behind bt-web
  PRICE_TZS: 950,                 // per set of 3 questions (Alex, 14 Nov 2026)
  MERCHANT: 'EMglobe',            // name shown on the mobile-money push
  QUESTIONS_PER_SET: 3,
  QUESTION_SECONDS: 15,           // server-timed; ASSUMPTION from v3 round standard
  OTP_LENGTH: 6,
  OTP_RESEND_SECONDS: 60,
  PAYMENT_TIMEOUT_SECONDS: 90,    // stop waiting for the push after this
  POLL_MS: 2000,
  PRIZES: { hourly: 5000, daily: 100000 },
  DEFAULT_LANG: 'sw',
  TERMS_VERSION: '2026-11-draft',
  PRIVACY_VERSION: '2026-11-draft',
  // Confirmed 14 Nov: promoter Bluetrain, domain. Still to confirm — shown as-is in the legal drafts:
  SMS_SHORTCODE: '[TBC]',
  SMS_SENDER_ID: 'BONGOTRIVIA [TBC]',
  SUPPORT_PHONE: '[TBC]',
  SUPPORT_EMAIL: '[TBC]',
  PROMOTER: 'Bluetrain Consultancy Ltd',
  GBT_PERMIT: 'application pending [TBC]',
  DOMAIN: 'bongotrivia.co.tz'
};
