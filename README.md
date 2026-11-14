# Bongo Trivia — player website (front end)

Built 14 Nov 2026. Vanilla HTML, CSS and JavaScript: no framework, no build step. Swahili first, English toggle. Runs on a demo back end (`MODE: 'mock'`) or on the Bluetrain Portal's Bongo Trivia API (`MODE: 'portal'`); see INTEGRATION.md.

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

`/bongo-trivia/*` and `/r/*` run `worker/index.js` first: API calls go to the portal through the `PORTAL` binding, and agent links become `?ref=` for the app. To go live follow INTEGRATION.md §3: set `MODE: 'portal'` and `CAMPAIGN_CODE`, move the domain off the portal Worker, and remove the noindex lines.

Security headers (CSP, HSTS, nosniff, frame and permissions policy) are set in `public/_headers`.

## File structure

```
bongo-trivia-web/
├── wrangler.jsonc    Worker config: static assets, custom domains, /api/* routing
├── worker/index.js   www → apex; /bongo-trivia/* → portal (PORTAL binding); /r/CODE agent links → ?ref=
├── .github/workflows/deploy.yml   Optional CI deploy
└── public/
├── _headers          Security and cache headers; noindex during demo
├── robots.txt, 404.html, favicon-32.png, apple-touch-icon.png
├── img/              Logos (white for blue backgrounds, blue for white), app icons, share image (FB cover)
├── index.html        Shell: header band, <main id="app">, live region, footer, script order
├── css/styles.css    Brand tokens (royal blue gradient, ribbon yellow), light + dark theme, all components
├── js/config.js      MODE, CAMPAIGN_CODE, price, timers, prizes (campaign overrides in portal mode), [TBC] legal values
├── js/i18n.js        Every interface string in Swahili and English; I18N.t(key, vars)
├── js/api.js         Adapter: same functions for mock and portal modes (INTEGRATION.md §4)
├── js/mock-api.js    Demo back end mirroring the portal: 3 options, portal category ids, payments, grading
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
| (dialog) | **First-time "How to play" walkthrough**, 4 steps: pay TZS 950 from EMglobe (PIN on phone only) · answer 3 questions, 15 s each · 3/3 enters hourly + daily random draws · change categories and SMS in Settings. Opens before the first set; Skip, Back/Next, arrow keys, Esc; replay from Play and Settings | Payment notice ("Play now") or Play |
| `#play` | Play card "Play 3 questions for TZS 950", chosen categories, draw entries this hour/today, Phase 2 "Watch ads" (disabled, Coming soon) | Payment notice dialog |
| (dialog) | "You will get a TZS 950 request from EMglobe on +255 …; enter your PIN on your phone only" | Pay |
| `#pay` | Phone with push, 90 s countdown, polling. States: success, failed, declined, timed out, limit reached; each with Try again | Quiz on success |
| `#quiz` | 3 questions one at a time, 15 s bar each, A–D or 1–4 keys, right/wrong shown after each | Result |
| `#result` | 3/3 → "You're in this hour's TZS 5,000 draw and today's TZS 100,000 draw"; otherwise score + try again. Answer summary always | Play again (opens notice) |
| `#settings` | Phone, categories editor, SMS offers switch (opt-out) + STOP/ACHA help, language, legal links, log out | — |
| `#terms`, `#privacy` | Legal drafts, linked from footer, sign-up and Settings | Back |

Signed-out visits to app screens redirect to `#login`. Questions never show before the payment status is `success`; the round id only comes back from the payment status call.

## Back end

The game back end is the Bongo Trivia module of the **Bluetrain Portal** (`alexofio/bluetrain-portal`, D1 `bongo-trivia`). The website reaches it same-origin at `/bongo-trivia/api/*` through the Worker's `PORTAL` service binding. **See [INTEGRATION.md](INTEGRATION.md)** for the architecture, go-live checklist, website ↔ portal API mapping, endpoint details and proposed portal changes.

`public/js/config.js` → `MODE: 'mock'` (demo, code 123456) or `'portal'` (live), plus `CAMPAIGN_CODE`.

## Assumptions

- Framework: none. Plain ES2020, works on low-end Android Chrome; no bundle to ship.
- In portal mode the campaign sets price, questions per round, seconds per question and prize amounts.
- 90 s payment wait before "timed out"; poll every 2 s.
- 18+ confirmation added at sign-up: MSISDN KYC proves the line owner, not age.
- Login with an unregistered number is refused and offers sign-up; sign-up with a registered number just logs in.
- Language preference saved to the account.
- Logo from Bongo-Profile1/2 PNGs (14 Nov); FB cover is the social share image.
- Demo questions are illustrative; live questions come from the portal's Questions module.

## Decided (14 Nov 2026)

- TZS 950 per set of 3 questions. Promoter: Bluetrain. Hourly and daily winners drawn at random from 3/3 entries. Categories and questions as set in the admin panel. Domain bongotrivia.co.tz, own repo and own Worker.

## Open items before launch

- GBT permit: Bluetrain is promoter; licence not yet held (application to follow). Paid entry + draw = consideration + chance [LEGAL-TBC].
- SMS shortcode, sender ID, support phone and email, retention period, number of winners per period.
- Vector logo: header uses a transparent PNG cut from the 500 px profile logo; replace with SVG when a clean vector file is available.
- Swahili legal text and a native-speaker pass on interface copy.
- Phase 2: ad-watch for free sets (Perfect 7-style ad platform).
