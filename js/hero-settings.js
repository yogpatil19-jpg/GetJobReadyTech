/**
 * hero-settings.js
 * ---------------------------------------------------------------------------
 * Admin-configurable content for the event-style hero banner (eyebrow,
 * headline, tagline, city/date badge for the demo session), plus a flag to
 * hide the "Choose Your Track" courses section entirely, and the on-page
 * demo-session registration form (first/last name, email, phone).
 *
 * Content is stored in Firestore via the same window.storage.get/set used
 * everywhere else, under its own key — reuses the existing
 * admin-auth-gated save path.
 *
 * The registration form submits to /api/demo-registration (a new, minimal
 * serverless function — see that file's header comment). It only stores
 * the lead in Firestore right now; it does not send a confirmation email
 * or sync to Google Sheets the way paid enrollments do. If you want that
 * too, say so and it can be added the same way the enrollment flow was.
 */
const HERO_SETTINGS_KEY = 'site-hero-settings-v1';

const defaultHeroSettings = {
  eyebrow: 'SNOWFLAKE TRAINING · FREE DEMO SESSION',
  title: 'FREE SNOWFLAKE\nDEMO SESSION',
  tagline: 'MAKING YOU JOB-READY, FASTER',
  city: 'ONLINE',
  date: 'DATE TO BE ANNOUNCED',
  hideChooseTrack: false,
  demoDateTime: '',       // "YYYY-MM-DDTHH:mm" wall-clock time, e.g. "2026-09-03T10:00"
  demoUtcOffset: '+12:00', // e.g. "+12:00" for NZ — used to convert demoDateTime to exact UTC for the calendar invite
  demoTimezoneLabel: 'NZST', // shown in the email text, purely cosmetic
  demoDurationMinutes: 60,
  calendarInviteLink: ''   // Zoom/Meet/Teams link included in the invite and email
};

let heroSettings = { ...defaultHeroSettings };

async function loadHeroSettings() {
  try {
    const res = await window.storage.get(HERO_SETTINGS_KEY, true);
    heroSettings = res && res.value ? { ...defaultHeroSettings, ...JSON.parse(res.value) } : { ...defaultHeroSettings };
  } catch (e) {
    console.warn('[hero-settings] Falling back to defaults — Firestore read failed:', e);
    heroSettings = { ...defaultHeroSettings };
  }
  applyHeroSettings();
  renderHeroSettingsForm();
}

function applyHeroSettings() {
  const eyebrowEl = document.getElementById('heroEyebrow');
  const titleEl = document.getElementById('heroTitle');
  const taglineEl = document.getElementById('heroTagline');
  const cityEl = document.getElementById('heroCity');
  const dateEl = document.getElementById('heroDate');

  if (eyebrowEl) eyebrowEl.textContent = heroSettings.eyebrow;
  if (titleEl) titleEl.innerHTML = escapeHtml(heroSettings.title).replace(/\n/g, '<br>');
  if (taglineEl) taglineEl.textContent = heroSettings.tagline;
  if (cityEl) cityEl.textContent = heroSettings.city;
  if (dateEl) dateEl.textContent = heroSettings.date;

  updateSectionVisibility();
}

/**
 * Decides whether the "Choose Your Track" (#courses) and FAQ (#faq)
 * sections should be visible. Hidden when EITHER:
 *   - the admin manually checked "Hide the Choose Your Track section", OR
 *   - no course currently has its "Show this course on the website"
 *     checkbox checked (see js/courses.js — course.enabled).
 * Called after both course data and hero settings have loaded — from
 * whichever of js/courses.js / js/hero-settings.js finishes loading last,
 * since either order is possible depending on network timing.
 */
function updateSectionVisibility() {
  const coursesSection = document.getElementById('courses');
  const faqSection = document.getElementById('faq');
  const coursesNavLink = document.querySelector('.nav-links a[href="#courses"]');
  const faqNavLink = document.querySelector('.nav-links a[href="#faq"]');

  // `courses` is the shared global list from js/courses.js (both files are
  // classic, non-module scripts, so a top-level `let` there is directly
  // visible here by name — but note it would NOT show up as
  // `window.courses`, since `let`/`const` don't attach to `window` the way
  // `var` does). Guarded with typeof in case this ever runs before
  // courses.js has executed.
  const anyCourseEnabled = typeof courses !== 'undefined' && Array.isArray(courses)
    ? courses.some(c => c.enabled !== false)
    : true; // assume visible until we know otherwise, to avoid a flash of hidden content

  const shouldHide = heroSettings.hideChooseTrack || !anyCourseEnabled;

  if (coursesSection) coursesSection.style.display = shouldHide ? 'none' : '';
  if (faqSection) faqSection.style.display = shouldHide ? 'none' : '';
  if (coursesNavLink) coursesNavLink.style.display = shouldHide ? 'none' : '';
  if (faqNavLink) faqNavLink.style.display = shouldHide ? 'none' : '';
}
window.KCUpdateSectionVisibility = updateSectionVisibility;

async function saveHeroSettings() {
  try {
    await window.storage.set(HERO_SETTINGS_KEY, JSON.stringify(heroSettings), true);
    applyHeroSettings();
    if (typeof showToast === 'function') showToast('Saved');
  } catch (e) {
    if (typeof showToast === 'function') showToast(e && e.message ? e.message : 'Save failed — try again');
  }
}

function renderHeroSettingsForm() {
  const container = document.getElementById('heroSettingsForm');
  if (!container) return;
  container.innerHTML = `
    <div class="field">
      <label>Eyebrow label (small text above headline)</label>
      <input id="hs-eyebrow" value="${escapeAttr(heroSettings.eyebrow)}">
    </div>
    <div class="field">
      <label>Headline <span class="field-hint">(press Enter for a line break, like the reference banner)</span></label>
      <textarea id="hs-title" rows="2">${escapeHtml(heroSettings.title)}</textarea>
    </div>
    <div class="field">
      <label>Tagline</label>
      <input id="hs-tagline" value="${escapeAttr(heroSettings.tagline)}">
    </div>
    <div class="row2">
      <div class="field">
        <label>City / location badge (top line)</label>
        <input id="hs-city" value="${escapeAttr(heroSettings.city)}">
      </div>
      <div class="field">
        <label>Demo session date (bottom line)</label>
        <input id="hs-date" placeholder="e.g. 3 SEPTEMBER 2026" value="${escapeAttr(heroSettings.date)}">
      </div>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="hs-hideChooseTrack" ${heroSettings.hideChooseTrack ? 'checked' : ''}>
      <span>Hide the "Choose Your Track" courses section from the page</span>
    </label>

    <h5 class="panel-subhead" style="margin-top:20px;border-top:none;padding-top:0;">Calendar invite (for demo registrations)</h5>
    <div class="row2">
      <div class="field">
        <label>Session date &amp; time <span class="field-hint">(the exact wall-clock time — used to build the calendar invite, separate from the display badge above)</span></label>
        <input type="datetime-local" id="hs-demoDateTime" value="${escapeAttr(heroSettings.demoDateTime)}">
      </div>
      <div class="field">
        <label>UTC offset <span class="field-hint">(e.g. "+12:00" for NZ — must be correct or the invite will land at the wrong time)</span></label>
        <input id="hs-demoUtcOffset" placeholder="+12:00" value="${escapeAttr(heroSettings.demoUtcOffset)}">
      </div>
    </div>
    <div class="row2">
      <div class="field">
        <label>Timezone label <span class="field-hint">(shown in the email text only, e.g. "NZST")</span></label>
        <input id="hs-demoTimezoneLabel" value="${escapeAttr(heroSettings.demoTimezoneLabel)}">
      </div>
      <div class="field">
        <label>Duration (minutes)</label>
        <input type="number" min="15" step="15" id="hs-demoDurationMinutes" value="${escapeAttr(heroSettings.demoDurationMinutes)}">
      </div>
    </div>
    <div class="field">
      <label>Calendar invite / join link <span class="field-hint">(Zoom, Google Meet, Teams — included in the invite and confirmation email)</span></label>
      <input id="hs-calendarInviteLink" placeholder="https://meet.google.com/..." value="${escapeAttr(heroSettings.calendarInviteLink)}">
    </div>
    <div class="field">
      <label class="field-hint">Leave "Session date &amp; time" blank to skip attaching a calendar invite — registrants will still get a confirmation email without one.</label>
    </div>
  `;
  container.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => {
      if (el.id === 'hs-hideChooseTrack') {
        heroSettings.hideChooseTrack = el.checked;
        return;
      }
      const map = {
        'hs-eyebrow': 'eyebrow', 'hs-title': 'title', 'hs-tagline': 'tagline',
        'hs-city': 'city', 'hs-date': 'date',
        'hs-demoDateTime': 'demoDateTime', 'hs-demoUtcOffset': 'demoUtcOffset',
        'hs-demoTimezoneLabel': 'demoTimezoneLabel', 'hs-demoDurationMinutes': 'demoDurationMinutes',
        'hs-calendarInviteLink': 'calendarInviteLink'
      };
      const key = map[el.id];
      if (key) heroSettings[key] = el.value;
    });
  });
}

// --- Demo session registration form (in the hero card) ---------------------

function populateHeroDemoCountryCodes() {
  const select = document.getElementById('heroDemoCountryCode');
  if (!select || !window.KC_COUNTRY_CODES) return;
  select.innerHTML = window.KC_COUNTRY_CODES
    .map(c => `<option value="${c.dial}">${c.dial} ${c.name}</option>`)
    .join('');
  const nz = window.KC_COUNTRY_CODES.findIndex(c => c.iso === 'NZ');
  select.selectedIndex = nz >= 0 ? nz : 0;
}

function initHeroDemoForm() {
  populateHeroDemoCountryCodes();
  const form = document.getElementById('heroDemoForm');
  const errorEl = document.getElementById('heroDemoError');
  const submitBtn = document.getElementById('heroDemoSubmitBtn');
  const termsLink = document.getElementById('heroDemoTermsLink');
  if (!form) return;

  if (termsLink && window.__KC_TERMS_URL__) {
    termsLink.href = window.__KC_TERMS_URL__;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const firstName = document.getElementById('heroDemoFirstName').value.trim();
    const lastName = document.getElementById('heroDemoLastName').value.trim();
    const email = document.getElementById('heroDemoEmail').value.trim();
    const dial = document.getElementById('heroDemoCountryCode').value;
    const localNumber = document.getElementById('heroDemoPhone').value.trim().replace(/[^\d]/g, '');
    const termsAccepted = document.getElementById('heroDemoTerms').checked;
    const whatsappOptIn = document.getElementById('heroDemoWhatsapp').checked;
    const detailsConfirmed = document.getElementById('heroDemoConfirm').checked;

    if (!firstName || !lastName || !email || !localNumber) {
      errorEl.textContent = 'Please fill in all fields.';
      return;
    }
    if (!termsAccepted) {
      errorEl.textContent = 'Please accept the Terms & Conditions to continue.';
      return;
    }
    if (!detailsConfirmed) {
      errorEl.textContent = 'Please confirm your details are correct to continue.';
      return;
    }

    const phone = `${dial}${localNumber}`;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering…';

    try {
      const res = await fetch('/api/demo-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, email, phone,
          termsAccepted, detailsConfirmed, whatsappOptIn
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not register — please try again.');

      form.style.display = 'none';
      const card = form.closest('.event-hero-card');
      if (card) {
        const confirmEl = document.createElement('div');
        confirmEl.className = 'hero-form-confirm';
        confirmEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Thanks, ${escapeHtml(firstName)}! You're registered for the free demo session — check your email for confirmation and a calendar invite.`;
        card.appendChild(confirmEl);
      }
    } catch (err) {
      console.error('[hero-demo-form] registration failed:', err);
      errorEl.textContent = err.message || 'Something went wrong — please try again.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register now';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('heroSettingsSaveBtn');
  if (btn) btn.addEventListener('click', saveHeroSettings);
  loadHeroSettings();
  initHeroDemoForm();
});
