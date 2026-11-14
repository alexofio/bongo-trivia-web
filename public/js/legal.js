/* Terms and Privacy drafts. For review by Tanzanian counsel and GBT before launch; Swahili version required.
   Items marked [TBC] or [LEGAL-TBC] are not settled. */
{
  const C = window.BT_CONFIG;
  const f = n => Number(n).toLocaleString('en-US');

  window.LEGAL = {
    terms: () => `
<h1>Terms and Conditions</h1>
<p class="meta">Version ${C.TERMS_VERSION}. Promoter: ${C.PROMOTER}. Gaming Board of Tanzania permit: ${C.GBT_PERMIT}.</p>
<h2>1. Who can play</h2>
<p>You must be 18 or older, live in Tanzania and use a Tanzanian mobile number registered in your name for mobile money. Employees of the promoter, its agencies and their immediate families cannot win. We may ask for proof of age and identity (for example, NIDA) before paying a prize.</p>
<h2>2. Your account</h2>
<p>You sign up and log in with your phone number and a one-time code sent by SMS. Keep your phone and codes private. One account per number.</p>
<h2>3. How a set works</h2>
<p>The promoter is ${C.PROMOTER}. Payment requests appear on your phone from ${C.MERCHANT}, Bluetrain's parent group.</p>
<p>Each set has 3 multiple-choice questions and costs TZS ${f(C.PRICE_TZS)}, collected by a mobile-money payment request from ${C.MERCHANT}. Questions open only after the payment succeeds. Each question has ${C.QUESTION_SECONDS} seconds, timed by our server. An unanswered question counts as wrong. Questions are drawn at random from your chosen categories and difficulty levels.</p>
<h2>4. Draws and prizes</h2>
<p>A set with all 3 answers correct gives one entry into that hour's draw for TZS ${f(C.PRIZES.hourly)} and that day's draw for TZS ${f(C.PRIZES.daily)}. A set with any wrong answer gives no entry. Winners are picked at random from that period's qualifying entries: one hourly winner from the hour's entries and one daily winner from the day's entries [number of winners per period TBC]. Draws use [certified random number generator / GBT inspector — LEGAL-TBC].</p>
<p>Winners are told by SMS from ${C.SMS_SENDER_ID} and paid by mobile money to the number that played, after a registered-name check. Prizes cannot be transferred or exchanged. Taxes on winnings are handled as required by law [LEGAL-TBC]. Unclaimed or unpayable prizes: [TBC].</p>
<h2>5. Limits and fair play</h2>
<p>We may limit the number of sets per number per hour and per day. Using bots, scripts, multiple accounts or shared answers, or interfering with the service, voids entries and prizes and may close your account.</p>
<h2>6. Payments and refunds</h2>
<p>If a payment is taken but your questions do not open, contact support within 7 days with the payment reference; we will restore the set or refund it. Payments for completed sets are not refundable.</p>
<h2>7. Messages</h2>
<p>We send essential SMS (codes, receipts, win notices). Offer and news SMS are sent only if you opt in, no more than 3 a week and never between 20:00 and 08:00. Opt out in Settings or by texting STOP or ACHA to ${C.SMS_SHORTCODE}.</p>
<h2>8. Play responsibly</h2>
<p>Play for fun and within your budget. Paying does not guarantee a prize.</p>
<h2>9. Changes and law</h2>
<p>We may update these terms and will show the new version before you next play. These terms are governed by the laws of the United Republic of Tanzania.</p>
<h2>10. Contact</h2>
<p>Support: ${C.SUPPORT_PHONE} · ${C.SUPPORT_EMAIL}. Website: ${C.DOMAIN}.</p>`,

    privacy: () => `
<h1>Privacy Policy</h1>
<p class="meta">Version ${C.PRIVACY_VERSION}. Data controller: ${C.PROMOTER}, Dar es Salaam, registered with the Personal Data Protection Commission (PDPC). Payments are collected under the merchant name ${C.MERCHANT}, Bluetrain's parent group.</p>
<h2>What we collect</h2>
<ul>
<li>Your phone number and network.</li>
<li>Records of codes sent and verified, and your consents (terms, age confirmation, SMS choice), with dates.</li>
<li>Your chosen categories, language, answers, scores, timings and draw entries.</li>
<li>Payment references and status from the mobile-money provider. We never see or store your PIN.</li>
<li>Device and connection data (IP address, browser) to keep the service secure and stop fraud.</li>
<li>For prize payouts: the registered name on the mobile-money account, and ID details if needed for verification.</li>
</ul>
<h2>Why we use it</h2>
<ul>
<li>To run your account, collect payment, serve and score questions, run draws and pay prizes.</li>
<li>To prevent fraud, enforce limits and meet legal and regulatory duties, including Gaming Board of Tanzania reporting.</li>
<li>To send offer and news SMS, only if you opted in.</li>
</ul>
<h2>Who we share it with</h2>
<p>Payment aggregator and mobile network operators (to collect payments), Mixx by Yas (to pay prizes), our SMS provider, our hosting provider (Cloudflare), and regulators or authorities when the law requires. Winner announcements show masked numbers only. We do not sell your data. Sharing with campaign sponsors for their marketing happens only with your separate opt-in [TBC].</p>
<h2>How long we keep it</h2>
<p>Account and game records: [TBC — retention period]. Payment and prize records: as required by tax and gaming law [LEGAL-TBC].</p>
<h2>Your rights</h2>
<p>Under the Personal Data Protection Act, 2022 you can ask to see, correct or delete your data, object to marketing and withdraw consent at any time. Contact ${C.SUPPORT_EMAIL}. You can also complain to the PDPC.</p>
<h2>SMS choices</h2>
<p>Turn offer SMS on or off in Settings, or text STOP or ACHA to ${C.SMS_SHORTCODE}. Essential SMS about your account, payments and prizes continue while you have an account.</p>
<h2>Security</h2>
<p>Data is encrypted in transit, access is limited by role and logged, and payment PINs are handled only by your mobile-money provider.</p>`
  };
}
