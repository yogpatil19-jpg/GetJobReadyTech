# KiwiCraft — Snowflake Training Site

Static, framework-free rebuild of the Snowflake enrollment page. Pure HTML/CSS/JS —
no build step required.

## Structure

```
index.html
css/
  style.css        tokens, reset, typography, page/section layout
  components.css   nav, buttons, hero, pricing cards, panel, toast, success overlay
  animations.css   keyframes + reveal/stagger classes (motion-only)
  responsive.css   breakpoint overrides
js/
  storage.js       stub storage layer — READ THIS FIRST (see below)
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

- **Storage backend.** `js/storage.js` is a stub backed by `localStorage`
  (per-browser only, doesn't sync between devices or visitors). It defines
  `window.storage.get/set/delete/list` with the same shape the rest of the
  site expects, so swapping in a real backend later means rewriting only
  this one file. I have not picked a specific backend for you — check
  current docs for whichever provider you choose (a simple REST endpoint,
  Supabase, Firebase, etc.) before wiring it in.
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
  Settings panel (gear icon) exactly as before; nothing changed here.

## Course logic (unchanged from the original prototype)

- `STORAGE_KEY`, `defaultCourses`, all element IDs, the payment flow
  (`window.open(course.paymentLink)`), the `?enrolled=<id>` success view,
  and the local-currency estimate (ipapi.co + api.frankfurter.app) are all
  preserved exactly. I have not re-verified the current uptime, rate
  limits, or terms of service of either external API — check both before
  relying on this in production.

## Deployment

This is a static site — no build step. Push the folder as-is to GitHub
Pages, Netlify, Vercel, Firebase Hosting, or S3 static hosting. The one
thing that will **not** work identically across environments is the
storage stub described above — it works everywhere (it's just
localStorage), but it is not a shared/synced backend anywhere. Don't
assume the settings panel is a real admin system; the in-app warning
banner says the same thing.

## SEO / accessibility notes

Meta tags, Open Graph, Twitter Card, and a basic Course schema.org block
are included in `index.html` with placeholder URLs (`your-domain-here.example`)
— replace with your real domain. Focus states, `prefers-reduced-motion`
handling, and a skip-link are included; re-test with a real screen reader
before publishing, since I can't verify accessibility behavior without
one.
