# KiwiCraft — Snowflake Training Site

Static, framework-free rebuild of the Snowflake enrollment page. Pure HTML/CSS/JS —
no build step required.

## Structure

```
index.html
firestore.rules   Firestore security rules — deploy separately (see below)
firebase.json     Firebase Hosting config + security headers (if you host there)
vercel.json       Vercel equivalent security headers (if you host there)
_headers          Netlify equivalent security headers (if you host there)
css/
  style.css        tokens, reset, typography, page/section layout
  components.css   nav, buttons, hero, pricing cards, panel, toast, success overlay
  animations.css   keyframes + reveal/stagger classes (motion-only)
  responsive.css   breakpoint overrides
js/
  firebase-config.js  Firebase project config — fill in before deploying
  storage.js       Firestore-backed storage layer — same get/set/delete/list
                    shape as before, now backed by a real shared backend
  auth.js          admin sign-in gate + phone-based MFA enroll/challenge
  courses.js       course data, pricing-card render, settings-panel forms
  ui.js            settings panel, toast, success view, theme/scroll/nav chrome
  faq.js           small accordion courtesy behavior
  animations.js    scroll reveal, counters, cursor glow
  app.js           currency detection/conversion + page init
assets/            put real images/icons here (empty placeholders for now)
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
- **Course payment links / WhatsApp group links** — set these in the
  Settings panel (gear icon, now admin-only — see below) exactly as before.

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
5. **Enable phone-based multi-factor authentication.** Build →
   Authentication → Sign-in method → scroll to "Multi-factor authentication"
   → enable the SMS/phone factor. Firebase may prompt you to upgrade the
   project to the Blaze (pay-as-you-go) plan to use this — I have not
   verified whether that's still required as of your signup date; the
   Console will tell you if it is. SMS verification also costs a small
   amount per send once you're past any free quota — check current pricing
   before enabling.
6. **Restrict authorized domains.** Build → Authentication → Settings →
   Authorized domains. Remove any domain you don't control, and make sure
   your real production domain (and `localhost` only while you're testing
   locally) are the only entries. This is what stops someone from standing
   up a copy of your login page on another domain and using it to phish
   your admin credentials against your real Firebase project — it's a
   Console setting, not something this code can enforce for you.
7. **Create your admin account.** Build → Authentication → Users → Add
   user. Use a real email and a strong, unique password — this account can
   edit live pricing and payment links for every visitor.
8. **Copy that user's UID** from the Users table, and paste it into
   `firestore.rules` in place of `REPLACE_WITH_YOUR_ADMIN_UID`.
9. **Publish the rules.** Firestore Database → Rules → paste the contents
   of `firestore.rules` → Publish (or use the Firebase CLI's
   `firebase deploy --only firestore:rules` if you have it set up).
10. **Deploy the site** as usual (see Deployment below), then open it,
    click the small "Admin" link in the footer, and sign in with the
    account from step 7. The first sign-in will prompt you to add a phone
    number for the second factor — you can't save changes until you do.
    After that, the gear icon appears once you're fully signed in
    (password + code).

I have not verified these exact menu paths against Firebase's current
console UI — Google reorganizes it periodically, so the labels above may
have shifted slightly by the time you set this up. The order of operations
(project → web app → Firestore → Auth → rules) should hold either way.

### Why this is secure (and what "secure" means here)

- **Reads are public on purpose** — anyone visiting the site needs to read
  course data to see the page, so `firestore.rules` allows open read
  access to the `site-config` collection.
- **Writes require: a specific admin UID, a correct password, AND a
  second factor (SMS code)** before Firestore accepts them — enforced by
  Firebase's servers via `firestore.rules`, not by anything running in the
  visitor's browser. Even someone with devtools open, bypassing this
  site's UI entirely, hits the same server-side check.
- **Authorized domains are restricted** in Firebase Console (step 6 above)
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

- **I have not run any of this against a live Firebase project.** The MFA
  code in `js/auth.js` and the stricter rule variant in `firestore.rules`
  use API shapes I'm confident about but have not verified against
  Firebase's current docs or tested end-to-end. Please do a full
  enroll → sign out → sign in → verify cycle yourself with your real admin
  account, and check the browser console for errors, before relying on
  this for real payment links.
- **No audit trail or versioning** — a compromised or careless admin
  session overwriting `paymentLink` leaves no history beyond the
  `updatedAt`/`updatedBy` fields Firestore stores per document.
- **Revoking an admin** means editing `firestore.rules` and redeploying,
  not clicking a toggle — there's no admin-management UI here.
- **Break-glass:** you always retain direct access to Firebase Console
  (Authentication + Firestore Rules) via your Google account, independent
  of this site's login flow — use that if MFA ever misbehaves and locks
  the app's own sign-in out.
- I have not set up Firebase App Check, server-side rate limiting beyond
  what Firebase Auth does by default, or reCAPTCHA Enterprise — worth
  looking into if this ever handles more than a couple of admins or
  higher-value data. I don't have enough context on your threat model to
  recommend specifics.



## Course logic (unchanged from the original prototype)

- `STORAGE_KEY`, `defaultCourses`, all element IDs, the payment flow
  (`window.open(course.paymentLink)`), the `?enrolled=<id>` success view,
  and the local-currency estimate (ipapi.co + api.frankfurter.app) are all
  preserved exactly. I have not re-verified the current uptime, rate
  limits, or terms of service of either external API — check both before
  relying on this in production.

## Deployment

This is a static site — no build step. Push the folder as-is to GitHub
Pages, Netlify, Vercel, Firebase Hosting, or S3 static hosting — any of
these work identically now, since config lives in Firebase rather than in
a per-host storage mechanism. Complete the "Firebase setup" steps above
*before* your first real deploy, or the site will run on the hard-coded
`defaultCourses` fallback (visible to everyone, but not editable) until
you do.

## SEO / accessibility notes

Meta tags, Open Graph, Twitter Card, and a basic Course schema.org block
are included in `index.html` with placeholder URLs (`your-domain-here.example`)
— replace with your real domain. Focus states, `prefers-reduced-motion`
handling, and a skip-link are included; re-test with a real screen reader
before publishing, since I can't verify accessibility behavior without
one.
