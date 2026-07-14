# KiwiCraft — Snowflake Training Site

Static site (HTML/CSS/JS, no build step) + Vercel serverless functions for
enrollment, Stripe payment, and post-payment fulfillment.

## Structure

```
index.html
firestore.rules   Firestore security rules — deploy separately (see below)
firebase.json     Firebase Hosting config + security headers (if you host there)
vercel.json       Vercel security headers + function config (this is the required host — see below)
_headers          Netlify equivalent security headers (unused unless you host there)
package.json      dependencies for the /api serverless functions
.env.example      required environment variables — copy real values into Vercel, not into this file
.gitignore
css/
  style.css        tokens, reset, typography, page/section layout
  components.css   nav, buttons, hero, pricing cards, panel, toast, success overlay, enrollment modal
  animations.css   keyframes + reveal/stagger classes (motion-only)
  responsive.css   breakpoint overrides
js/
  firebase-config.js     Firebase project config — fill in before deploying
  storage.js              Firestore-backed storage layer for course/site config
  auth.js                 admin sign-in gate for the settings panel
  country-codes.js        country calling codes for the phone dropdown
  courses.js               course data, pricing-card render, settings-panel forms
  enrollment-settings.js  admin panel section: Terms URL + receipt email template
  enroll.js                enrollment modal (name/email/phone/comments + consent) → Stripe Checkout
  ui.js                    settings panel, toast, success view (now shows QR + WhatsApp link), chrome
  faq.js                   small accordion courtesy behavior
  animations.js            scroll reveal, counters, cursor glow
  app.js                   currency detection/conversion + page init
api/                       Vercel serverless functions — see "Enrollment, payment & fulfillment backend"
  create-checkout-session.js   validates enrollment form, creates Stripe Checkout Session
  stripe-webhook.js            verifies Stripe signature, sends receipt email, syncs Google Sheet
  session-status.js            success page calls this to show QR code + WhatsApp link
  _lib/
    firebaseAdmin.js   server-side Firestore access (Admin SDK — bypasses firestore.rules)
    validate.js         server-side input validation (real security boundary, not js/enroll.js)
    email.js            Nodemailer/SMTP receipt email sending
    googleSheets.js      Google Sheets row append via service account
    qrcode.js            WhatsApp-group QR code PNG generation
tests/                      real, runnable unit tests — `npm test` (see below for what is/isn't covered)
assets/                     put real images/icons here (empty placeholders for now)
```

## Before you publish — things intentionally left as placeholders

I did not invent content to fill these in. Each is a real gap, not a design
choice:

- **Firebase config.** `js/firebase-config.js` has placeholder values
  (`REPLACE_ME_...`). The site will not connect to any backend — and will
  fall back to hard-coded default course data — until you fill these in
  with your own Firebase project's config. See "Firebase setup" below.
- **Admin UID in `firestore.rules`.** Same story — replace
  `REPLACE_WITH_YOUR_ADMIN_UID` with your real admin account's UID before
  publishing the rules, or nobody (not even you) will be able to save
  changes.
- **Stats section** (`students trained`, `countries`, `rating`, `completion`)
  — currently all zeros. These are marketing claims; only put real numbers
  in once you have them.
- **Testimonials** — three placeholder cards with bracketed text. Don't
  publish invented quotes attributed to real people; use only reviews you
  actually have permission to display.
- **Instructor bio** — bracketed placeholders, same as the original file.
- **Newsletter / contact forms** — client-side only right now; submitting
  shows a toast saying they're not connected. Wire them to an email tool or
  your inbox/CRM before relying on them.
- **Floating WhatsApp button** — placeholder number (`wa.me/000000000`).
  Replace with your real number.
- **Course Stripe Price ID / WhatsApp group links** — set these per course
  in the Settings panel (gear icon, admin-only). Without a Stripe Price ID,
  that course's button shows "Not configured" and can't be enrolled in —
  see "Enrollment, payment & fulfillment backend" below for the full setup.

## Firebase setup

Config now lives in Firebase, not in the page source, and is pulled fresh
on every page load. This needs a one-time setup — I can't do this part for
you since it requires creating and owning a Google Cloud project:

1. **Create a project.** [Firebase Console](https://console.firebase.google.com)
   → Add project.
2. **Add a Web app** to that project (</> icon on the project overview
   page). Copy the `firebaseConfig` object it gives you into
   `js/firebase-config.js`, replacing every `REPLACE_ME_*` value.
3. **Enable Firestore.** Build → Firestore Database → Create database
   (production mode is fine — the rules file below replaces the default).
4. **Enable Email/Password sign-in.** Build → Authentication → Sign-in
   method → Email/Password → Enable.
5. **Restrict authorized domains.** Build → Authentication → Settings →
   Authorized domains. Remove any domain you don't control, and make sure
   your real production domain (and `localhost` only while you're testing
   locally) are the only entries. This is what stops someone from standing
   up a copy of your login page on another domain and using it to phish
   your admin credentials against your real Firebase project — it's a
   Console setting, not something this code can enforce for you.
6. **Create your admin account.** Build → Authentication → Users → Add
   user. Use a real email and a strong, unique password — this account can
   edit live pricing and payment links for every visitor.
7. **Copy that user's UID** from the Users table, and paste it into
   `firestore.rules` in place of `REPLACE_WITH_YOUR_ADMIN_UID`.
8. **Publish the rules.** Firestore Database → Rules → paste the contents
   of `firestore.rules` → Publish (or use the Firebase CLI's
   `firebase deploy --only firestore:rules` if you have it set up).
9. **Deploy the site** as usual (see Deployment below), then open it,
   click the small "Admin" link in the footer, and sign in with the
   account from step 6. The gear icon appears once you're signed in.

I have not verified these exact menu paths against Firebase's current
console UI — Google reorganizes it periodically, so the labels above may
have shifted slightly by the time you set this up. The order of operations
(project → web app → Firestore → Auth → rules) should hold either way.

### Why this is secure (and what "secure" means here)

- **Reads are public on purpose** — anyone visiting the site needs to read
  course data to see the page, so `firestore.rules` allows open read
  access to the `site-config` collection.
- **Writes require a specific admin UID and a correct password** before
  Firestore accepts them — enforced by Firebase's servers via
  `firestore.rules`, not by anything running in the visitor's browser.
  Even someone with devtools open, bypassing this site's UI entirely, hits
  the same server-side check.
- **Authorized domains are restricted** in Firebase Console (step 5 above)
  so your login flow can't be cloned onto another domain and used to
  phish credentials against your real project.
- **The `firebaseConfig` values being public is expected Firebase
  behavior** — it identifies your project, it doesn't grant access.
- **A Content-Security-Policy** is set (see the `<meta http-equiv=
  "Content-Security-Policy">` tag in `index.html`) restricting which
  domains scripts, styles, and network calls can come from — this limits
  the damage if a third-party script you add later turns out to be
  malicious or compromised.
- **HTTP security headers** (`X-Frame-Options`, `X-Content-Type-Options`,
  `Strict-Transport-Security`, etc.) are configured for whichever host you
  use — `_headers` (Netlify), `firebase.json` (Firebase Hosting), or
  `vercel.json` (Vercel). Only one of these applies depending on where you
  deploy; the others are simply unused. GitHub Pages / S3 don't support
  custom response headers the same way — if you deploy there, this
  particular protection won't apply and you'd need a CDN in front (e.g.
  CloudFront) to add it.
- Course text is HTML-escaped on render (`escapeHtml` in `courses.js`), so
  even a successful malicious write couldn't inject a script that runs in
  visitors' browsers — it could only change visible text/links.

### What's still not covered, and things worth testing before you trust this

- **No MFA (multi-factor authentication)** on the admin account — it's
  email/password only right now. If that password leaks, the account is
  compromised. Firebase supports adding a second factor later
  (Authentication → Sign-in method → Multi-factor authentication) if you
  want to add it back in.
- **No audit trail or versioning** — a compromised or careless admin
  session overwriting `paymentLink` leaves no history beyond the
  `updatedAt`/`updatedBy` fields Firestore stores per document.
- **Revoking an admin** means editing `firestore.rules` and redeploying,
  not clicking a toggle — there's no admin-management UI here.
- **Break-glass:** you always retain direct access to Firebase Console
  (Authentication + Firestore Rules) via your Google account, independent
  of this site's login flow.
- I have not set up Firebase App Check, server-side rate limiting beyond
  what Firebase Auth does by default, or reCAPTCHA — worth looking into if
  this ever handles more than a couple of admins or higher-value data. I
  don't have enough context on your threat model to recommend specifics.



## Course logic

- `STORAGE_KEY` and `defaultCourses` are preserved from the original
  prototype. The payment flow has changed: clicking "Enroll & Pay" now
  opens a form (name/email/phone/comments + consent checkboxes) instead of
  directly opening a static payment link — see "Enrollment, payment &
  fulfillment backend" below.
- The `?enrolled=<id>` success view is preserved but now also verifies the
  payment really happened (via `session_id`) before showing anything, and
  displays a QR code for the WhatsApp group alongside the join button.
- The local-currency estimate (ipapi.co + api.frankfurter.app) is
  unchanged. I have not re-verified the current uptime, rate limits, or
  terms of service of either external API — check both before relying on
  this in production.

## Enrollment, payment & fulfillment backend

When someone clicks **Enroll & Pay**, here's the full flow:

1. A form collects **name, email, phone (country-code dropdown + number),
   comments**, and three checkboxes: accept Terms & Conditions, "I'm on
   WhatsApp and okay to get updates," and "I've confirmed my details."
2. On submit, the browser calls `/api/create-checkout-session` (a Vercel
   serverless function) — this is where your **Stripe secret key never
   leaves the server**. It re-validates everything (never trusts the
   browser), saves a "lead" record in Firestore, creates a Stripe Checkout
   Session, and returns the Stripe-hosted payment URL.
3. The visitor pays on Stripe's own page — card details never touch your
   server or Firestore at all, which is both simpler and more secure.
4. Stripe calls `/api/stripe-webhook` (server-to-server, not from the
   visitor's browser) once payment succeeds. That function verifies
   Stripe's signature, then: marks the lead "paid," generates a WhatsApp
   QR code, emails the visitor a receipt with the QR code attached, and
   appends a row to your Google Sheet.
5. The visitor is redirected back to your site's success page, which calls
   `/api/session-status` to show the QR code and WhatsApp link immediately
   on-page too — so they're not stuck waiting on an email that might be
   delayed or land in spam.

### Why this needs Vercel specifically

This backend is built as **Vercel Serverless Functions** (the `/api`
folder, using Vercel's own routing convention). It will **not** work if
you deploy to GitHub Pages, S3, or similar static-only hosts — those can't
run server code at all, and secrets like your Stripe key would have
nowhere safe to live. Netlify and Firebase Hosting *can* run serverless
functions, but with different folder conventions (`netlify/functions`,
Cloud Functions) — this code is written specifically for Vercel, matching
what you're already using.

### Step-by-step setup

**1. Stripe — create a product & price per course**
- [Stripe Dashboard](https://dashboard.stripe.com) → Product catalog → **Add product**.
- One product per course (e.g. "Snowflake Identity"), with a one-time price matching your course fee.
- Copy the **Price ID** (looks like `price_1AbC...`) — you'll paste this into the course's settings in your site's admin panel (Settings → the course → "Stripe Price ID").
- Repeat for each course.
- Stay in **Test mode** (toggle top-right of the Dashboard) until you've fully tested the flow — test-mode payments use fake card numbers and never charge real money.

**2. Stripe — get your API keys**
- Developers → API keys → copy the **Secret key** (`sk_test_...` while testing, `sk_live_...` once you go live). This becomes `STRIPE_SECRET_KEY`.

**3. Firebase — generate a service account key**
- Firebase Console → ⚙️ Project settings → **Service accounts** tab → **Generate new private key**. This downloads a JSON file.
- Open that file, copy its entire contents as one string, and that becomes `FIREBASE_SERVICE_ACCOUNT_KEY`.
- This is a much more powerful credential than the public `js/firebase-config.js` values — it bypasses `firestore.rules` entirely. Never put it in client-side code or commit it to GitHub; it only ever goes into Vercel's environment variables.

**4. Google Sheets — create the sheet and share it with your service account**
- Create a new Google Sheet. Add a tab named exactly `Enrollments` (or change `sheetTab` in `api/_lib/googleSheets.js` if you'd rather name it something else).
- Copy the spreadsheet ID from its URL (`.../spreadsheets/d/THIS_PART/edit`) — this becomes `GOOGLE_SHEETS_SPREADSHEET_ID`.
- In [Google Cloud Console](https://console.cloud.google.com), for the same project as your Firebase service account (or a new one): enable the **Google Sheets API**, then either reuse the same service account from step 3 or create a new one (IAM & Admin → Service Accounts → Create) and download its JSON key — this becomes `GOOGLE_SERVICE_ACCOUNT_KEY`.
- **Critical step people miss:** open your Google Sheet → **Share** → paste the service account's email address (found inside the JSON key file, field `client_email`, looks like `something@project-id.iam.gserviceaccount.com`) → give it **Editor** access. Without this, the API call will fail with a permissions error.

**5. Email — set up SMTP**
- Any provider works: a Gmail account with an [App Password](https://myaccount.google.com/apppasswords) (not your regular password), or a transactional email service's SMTP relay (SendGrid, Mailgun, Postmark, Resend, etc.).
- Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (see `.env.example`).
- I'd recommend a transactional email provider over personal Gmail for anything beyond testing — better deliverability, and Gmail SMTP has sending limits meant for personal use, not customer receipts.

**6. Add all environment variables to Vercel**
- Vercel Dashboard → your project → **Settings → Environment Variables**.
- Add every variable from `.env.example` with your real values (from steps 1–5).
- Apply them to all environments (Production, Preview, Development) unless you specifically want test/live keys to differ by environment.
- **Redeploy** after adding them — Vercel doesn't retroactively apply new env vars to an already-running deployment.

**7. Stripe — create the webhook (do this AFTER your first deploy, since it needs your live URL)**
- Stripe Dashboard → Developers → Webhooks → **Add endpoint**.
- Endpoint URL: `https://your-domain.vercel.app/api/stripe-webhook`
- Event to listen for: `checkout.session.completed`
- After creating it, copy the **Signing secret** (`whsec_...`) → add it to Vercel as `STRIPE_WEBHOOK_SECRET` → redeploy again.

**8. Admin panel — fill in the course-level settings**
- Sign in as admin (footer "Admin" link) → for each course, fill in: **Stripe Price ID** (from step 1), **WhatsApp group invite link**.
- In the new **"Enrollment & receipt email"** section: set your **Terms & Conditions URL**, and optionally customize the receipt email subject/body (placeholders: `{{name}}`, `{{courseTitle}}`, `{{amount}}`, `{{whatsappLink}}`).

### Testing the enrollment flow (do this before going live)

I was able to genuinely test the input-validation logic, the email-template
filling, and QR code generation — those have real automated tests in
`tests/` (run `npm test`; all 12 currently pass). I could **not** test the
live Stripe checkout, the webhook delivery, Firestore writes, real email
sending, or the Google Sheets append — those all require live credentials
I don't have access to. Please test them yourself, in this order, using
Stripe **test mode**:

1. `npm install` locally, then `npm test` — confirms the logic above still passes on your machine.
2. Deploy to Vercel with test-mode Stripe keys.
3. Use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks to your deployed URL, or simply complete a real test-mode checkout on your live Vercel URL (Stripe's webhook will fire for real against your deployed `/api/stripe-webhook`).
4. On the course card, click **Enroll & Pay**, fill in the form with your own name/email/a real phone number, and use a [Stripe test card](https://stripe.com/docs/testing) (e.g. `4242 4242 4242 4242`, any future expiry, any CVC).
5. Confirm, in order: (a) you land back on the success page and see the WhatsApp QR code and link, (b) a receipt email actually arrives in your inbox with the QR code attached, (c) a new row appears in your Google Sheet, (d) in Firestore Console → `leads` collection, the matching document shows `status: "paid"`, `emailSent: true`, `sheetSynced: true`.
6. Try it a second time deliberately triggering a webhook retry (Stripe Dashboard → Webhooks → your endpoint → find the event → "Resend") and confirm you do **not** get a duplicate email or duplicate spreadsheet row — this checks the idempotency logic actually works.
7. Only after all of that passes, switch `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to live-mode values and repeat step 4 with a real small payment to yourself before announcing it publicly.

### Configurable, at a glance

| What | Where to change it |
|---|---|
| Course price shown to visitors | Admin panel → course → Fee/Currency (display only) |
| Actual amount charged | Stripe Dashboard → the course's Price, referenced by Stripe Price ID in admin panel |
| WhatsApp group link | Admin panel → course → WhatsApp group invite link |
| Terms & Conditions link | Admin panel → Enrollment & receipt email → Terms URL |
| Receipt email subject/body | Admin panel → Enrollment & receipt email |
| Which fields are required | `api/_lib/validate.js` (server) + `js/enroll.js` (client UX) |
| Country code list | `js/country-codes.js` |
| Google Sheet tab name | `sheetTab` parameter in `api/_lib/googleSheets.js` |
| Webhook function timeout | `vercel.json` → `functions` → `maxDuration` (check your Vercel plan's actual limit — I have not verified the current cap) |

## Deployment

This site now requires **Vercel** specifically, because of the serverless
functions in `/api` (see "Enrollment, payment & fulfillment backend"
above) — the earlier "any static host works" note no longer applies once
you're using the payment flow. If you only need the public course pages
without online payment, the rest of the site (Firebase-backed config,
admin panel) would still work on GitHub Pages/Netlify/Firebase Hosting —
just the Enroll & Pay button wouldn't have anywhere to send its API calls.

Complete the "Firebase setup" and "Enrollment, payment & fulfillment
backend" steps above *before* your first real deploy with payments live.

## SEO / accessibility notes

Meta tags, Open Graph, Twitter Card, and a basic Course schema.org block
are included in `index.html` with placeholder URLs (`your-domain-here.example`)
— replace with your real domain. Focus states, `prefers-reduced-motion`
handling, and a skip-link are included; re-test with a real screen reader
before publishing, since I can't verify accessibility behavior without
one.
