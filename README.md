# Bongo Trivia — player website (front end)

Built 14 Nov 2026 from Prompt Library v7. Vanilla HTML, CSS and JavaScript: no framework, no build step. Swahili first, English toggle. Runs fully on a mock back end today; switch `USE_MOCK` to `false` in `js/config.js` to call `bt-api`.

Live at **https://bongotrivia.co.tz** (Cloudflare Worker `bongo-trivia-web`). Promoter: Bluetrain Consultancy Ltd. Payment push merchant: EMglobe.

## Run it

```bash
npm install
npm run dev          # wrangler dev on http://localhost:8787 — demo OTP is 123456, no real money moves
```

## Deploy

Worker `bongo-trivia-web` serves `public/` with Workers Static Assets and owns the custom domains `bongotrivia.co.tz` and `www.bongotrivia.co.tz` (www redirects to the apex). The domain's zone must be in the same Cloudflare account as the Worker.

- **From a laptop:** `npx wrangler login` once, then `npm run deploy`.
- **On every push to main:** either connect this repo in Cloudflare (Workers & Pages → bongo-trivia-web → Settings → Builds), or use `.github/workflows/deploy.yml` with repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use one, not both.

`/api/*` runs `worker/index.js` first. Until `bt-api` exists it returns `503 api_not_live` and the site runs on the in-browser mock (`USE_MOCK: true` in `public/js/config.js`). To go live: deploy `bt-api`, add `"services": [{ "binding": "BT_API", "service": "bt-api" }]` to `wrangler.jsonc`, set `USE_MOCK: false`, and remove the `X-Robots-Tag` line in `public/_headers` and the `Disallow` in `public/robots.txt`.

Security headers (CSP, HSTS, nosniff, frame and permissions policy) are set in `public/_headers`.

## File structure

```
bongo-trivia-web/
├── wrangler.jsonc    Worker config: static assets, custom domains, /api/* routing
├── worker/index.js   www → apex redirect; /api/* → bt-api service binding (503 until it exists)
├── .github/workflows/deploy.yml   Optional CI deploy
└── public/
├── _headers          Security and cache headers; noindex during demo
├── robots.txt, 404.html, favicon-32.png, apple-touch-icon.png
├── img/              Logos (white for blue backgrounds, blue for white), app icons, share image (FB cover)
├── index.html        Shell: header band, <main id="app">, live region, footer, script order
├── css/styles.css    Brand tokens (royal blue gradient, ribbon yellow), light + dark theme, all components
├── js/config.js      Price, merchant, timers, prize amounts, [TBC] legal values, USE_MOCK switch
├── js/i18n.js        Every interface string in Swahili and English; I18N.t(key, vars)
├── js/api.js         One function per backend endpoint; routes to the mock when USE_MOCK is true
├── js/mock-api.js    Demo back end with the same shapes: OTP, consents, payments, 33 sample questions, grading
├── js/legal.js       Terms and Conditions + Privacy Policy drafts
└── js/app.js         Hash router, views, timers, accessibility handling
```

## Screens and user journey

| Hash | Screen | Leads to |
|---|---|---|
| `#home` | Landing: headline, prizes, sample question card, how to play | Sign up, Log in |
| `#signup` | Phone number + Terms/Privacy (required), 18+ (required), SMS offers opt-in (unchecked) | Verify |
| `#login` | Phone number only; unknown number shows "create account" | Verify |
| `#verify` | 6-digit OTP, auto-submit, resend after 60 s, wrong / expired / locked states | Categories (new) or Play |
| `#categories` | Pick one or more of 14 categories | Play |
| `#play` | Play card "Play 3 questions for TZS 950", chosen categories, draw entries this hour/today, Phase 2 "Watch ads" (disabled, Coming soon) | Payment notice dialog |
| (dialog) | "You will get a TZS 950 request from EMglobe on +255 …; enter your PIN on your phone only" | Pay |
| `#pay` | Phone with push, 90 s countdown, polling. States: success, failed, declined, timed out, limit reached; each with Try again | Quiz on success |
| `#quiz` | 3 questions one at a time, 15 s bar each, A–D or 1–4 keys, right/wrong shown after each | Result |
| `#result` | 3/3 → "You're in this hour's TZS 5,000 draw and today's TZS 100,000 draw"; otherwise score + try again. Answer summary always | Play again (opens notice) |
| `#settings` | Phone, categories editor, SMS offers switch (opt-out) + STOP/ACHA help, language, legal links, log out | — |
| `#terms`, `#privacy` | Legal drafts, linked from footer, sign-up and Settings | Back |

Signed-out visits to app screens redirect to `#login`. Questions never show before the payment status is `success`; the round id only comes back from the payment status call.

## Backend endpoints (bt-api, base `/api/v1`)

| Method | Path | Body | Returns | Errors |
|---|---|---|---|---|
| POST | `/auth/otp/send` | `{msisdn, intent: signup\|login}` | `{request_id, expires_in, resend_in}` | `invalid_msisdn`, `not_registered`, `rate_limited` |
| POST | `/auth/otp/verify` | `{request_id, msisdn, code, consents?: {terms, terms_version, privacy_version, age_confirmed, sms_marketing}}` | `{user, is_new}` + httpOnly session cookie | `invalid_code` (+`attempts_left`), `expired_code`, `too_many_attempts`, `consent_required` |
| GET | `/me` | — | `{id, msisdn, msisdn_masked, categories[], sms_marketing, lang}` | 401 |
| POST | `/auth/logout` | — | `{ok}` | — |
| GET | `/categories` | — | `[{id, name_sw, name_en}]` | — |
| PUT | `/me/categories` | `{category_ids[]}` | user | `no_categories` |
| PUT | `/me/consents` | `{sms_marketing}` | user (log consent change with timestamp + channel) | — |
| PUT | `/me/preferences` | `{lang}` | user | — |
| POST | `/plays` | header `Idempotency-Key` | `{play_id, payment_id, amount: 950, merchant: "EMglobe", status: pending, expires_in}` — sends the USSD push via the aggregator | `limit_reached`, `no_categories`, `network_unsupported` |
| GET | `/plays/:id/payment` | — | `{status: pending\|success\|failed\|cancelled\|expired, reason, round_id}` | 404 |
| GET | `/rounds/:id/question` | — | `{index, total, seconds, deadline_at, question: {id, text, category, difficulty, options[{id, text}]}}` | `round_complete` |
| POST | `/rounds/:id/answers` | `{question_id, option_id\|null}` | `{correct, timed_out, correct_option_id, next}` | `out_of_order` |
| GET | `/rounds/:id/result` | — | `{score, total, qualified, items[], draws[]}` | — |
| GET | `/me/entries` | — | `{hourly_current, daily}` | — |
| POST | `/callbacks/payment` | aggregator payload (server to server, signed) | flips the play to success/failed; creates the round | — |

Server rules the front end relies on: questions picked server-side at random across the player's categories and difficulty, no repeats per session; option order shuffled per player with opaque option ids; deadline enforced on the server (client bar is display only); grading server-side; draw entry written only when all 3 are correct; entry caps per MSISDN return `limit_reached`.

## Assumptions

- Framework: none. Plain ES2020, works on low-end Android Chrome; no bundle to ship.
- 15 seconds per question (from the v3 round standard); change `QUESTION_SECONDS`.
- 90 s payment wait before "timed out"; poll every 2 s.
- 18+ confirmation added at sign-up: MSISDN KYC proves the line owner, not age.
- Login with an unregistered number is refused and offers sign-up; sign-up with a registered number just logs in.
- Language preference saved to the account.
- Logo from Bongo-Profile1/2 PNGs (14 Nov); FB cover is the social share image.
- 33 sample questions are illustrative and need Swahili editor approval.

## Decided (14 Nov 2026)

- TZS 950 per set of 3 questions. Promoter: Bluetrain. Hourly and daily winners drawn at random from 3/3 entries. Categories and questions as set in the admin panel. Domain bongotrivia.co.tz, own repo and own Worker.

## Open items before launch

- GBT permit: Bluetrain is promoter; licence not yet held (application to follow). Paid entry + draw = consideration + chance [LEGAL-TBC].
- SMS shortcode, sender ID, support phone and email, retention period, number of winners per period.
- Vector logo: header uses a transparent PNG cut from the 500 px profile logo; replace with SVG when a clean vector file is available.
- Swahili legal text and a native-speaker pass on interface copy.
- Phase 2: ad-watch for free sets (Perfect 7-style ad platform).
